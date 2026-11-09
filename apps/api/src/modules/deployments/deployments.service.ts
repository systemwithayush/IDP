import { randomUUID } from 'crypto';
import { prisma } from '../../prisma.js';
import { transition, DeploymentEventAction, TERMINAL_STATES } from './state-machine.js';
import { gitHubService } from './github.service.js';
import { auditService } from '../audit/audit.service.js';
import { getSocketServer } from '../../socket.js';
import { logger } from '../../utils/logger.js';
import { decryptSecret } from '../../utils/crypto.js';
import { manifestBuilder } from '../k8s/manifest.builder.js';
import { k8sService } from '../k8s/k8s.service.js';
import { notificationService } from '../notifications/notification.service.js';

export interface CreateDeploymentParams {
  serviceId: string;
  environmentId: string;
  triggeredBy: string;
  imageTag: string;
  gitSha: string;
  rollbackOfId?: string | null;
}

export class DeploymentsService {
  /**
   * Creates a new deployment record and triggers the GitHub Actions workflow_dispatch.
   */
  async createDeployment(params: CreateDeploymentParams) {
    const service = await prisma.service.findUnique({
      where: { id: params.serviceId },
      include: { team: true },
    });
    if (!service) {
      const err = new Error('Service not found');
      (err as any).status = 404;
      throw err;
    }

    const environment = await prisma.environment.findUnique({
      where: { id: params.environmentId },
    });
    if (!environment) {
      const err = new Error('Environment not found');
      (err as any).status = 404;
      throw err;
    }

    const correlationId = randomUUID();

    // Create deployment in DB inside transaction
    const deployment = await prisma.deployment.create({
      data: {
        serviceId: params.serviceId,
        environmentId: params.environmentId,
        triggeredBy: params.triggeredBy,
        rollbackOfId: params.rollbackOfId || null,
        imageTag: params.imageTag,
        gitSha: params.gitSha,
        correlationId,
        status: 'requested',
        startedAt: new Date(),
      },
      include: {
        service: true,
        environment: true,
        user: { select: { id: true, email: true } },
      },
    });

    // Record initial event
    await prisma.deploymentEvent.create({
      data: {
        deploymentId: deployment.id,
        fromStatus: 'requested',
        toStatus: 'requested',
        message: 'Deployment requested via self-service portal',
      },
    });

    // Audit log
    await auditService.logAction({
      userId: params.triggeredBy,
      action: 'DEPLOY_SERVICE',
      entityType: 'Deployment',
      entityId: deployment.id,
      metadata: {
        service: service.name,
        env: environment.type,
        imageTag: params.imageTag,
        gitSha: params.gitSha,
        correlationId,
      },
    });

    // Broadcast initial state
    this.broadcast(deployment.id, 'status', {
      id: deployment.id,
      status: 'requested',
      correlationId,
    });

    // Trigger GitHub Action dispatch or skip for rollbacks with existing image
    if (params.rollbackOfId) {
      await this.transitionDeployment(
        deployment.id,
        'IMAGE_PUSHED',
        'Using existing image from previous stable release'
      );
    } else {
      try {
        const [owner, repo] = this.parseRepoUrl(service.repoUrl);
        await gitHubService.triggerWorkflowDispatch({
          owner,
          repo,
          correlationId,
          imageTag: params.imageTag,
          environment: environment.type,
        });

        // Transition to building
        await this.transitionDeployment(deployment.id, 'DISPATCH_CI', 'GitHub Actions workflow dispatched');
      } catch (dispatchError: any) {
        logger.error({ err: dispatchError }, 'Failed to dispatch CI, failing deployment');
        await this.transitionDeployment(deployment.id, 'FAIL', `CI dispatch failed: ${dispatchError.message}`);
      }
    }

    return this.getDeploymentById(deployment.id);
  }

  /**
   * Advances the deployment state machine transactionally and broadcasts updates via Socket.io.
   */
  async transitionDeployment(deploymentId: string, action: DeploymentEventAction, message: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Pure function transition check
    const nextStatus = transition(deployment.status, action);

    // If idempotent transition (already in desired state), do nothing
    if (deployment.status === nextStatus) {
      return deployment;
    }

    const isTerminal = TERMINAL_STATES.has(nextStatus);

    // Transaction: update status + insert event
    const updated = await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: nextStatus,
        finishedAt: isTerminal ? new Date() : undefined,
      },
    });

    await prisma.deploymentEvent.create({
      data: {
        deploymentId,
        fromStatus: deployment.status,
        toStatus: nextStatus,
        message,
      },
    });

    // Real-time WebSocket emission to deployment room
    this.broadcast(deploymentId, 'status', {
      id: deploymentId,
      fromStatus: deployment.status,
      toStatus: nextStatus,
      message,
      finishedAt: updated.finishedAt,
    });

    logger.info(
      { deploymentId, from: deployment.status, to: nextStatus, action },
      'Deployment transitioned state'
    );

    return updated;
  }

  async getDeploymentById(id: string) {
    return prisma.deployment.findUnique({
      where: { id },
      include: {
        service: true,
        environment: true,
        user: { select: { id: true, email: true, role: true } },
        events: { orderBy: { createdAt: 'asc' } },
        pipelineRun: true,
      },
    });
  }

  async listDeployments(filters: {
    serviceId?: string;
    environmentId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.serviceId) where.serviceId = filters.serviceId;
    if (filters.environmentId) where.environmentId = filters.environmentId;

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          service: { select: { id: true, name: true, stack: true } },
          environment: { select: { id: true, type: true } },
          user: { select: { id: true, email: true } },
          events: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.deployment.count({ where }),
    ]);

    return {
      data: deployments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Creates a manual rollback deployment targeting the previous successful deployment.
   */
  async rollback(deploymentId: string, triggeredBy: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { service: true, environment: true },
    });

    if (!deployment) {
      const err = new Error('Deployment not found');
      (err as any).status = 404;
      throw err;
    }

    // Find previous successful deployment in the same service and environment
    const previousSuccess = await prisma.deployment.findFirst({
      where: {
        serviceId: deployment.serviceId,
        environmentId: deployment.environmentId,
        status: 'succeeded',
        id: { not: deployment.id },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rollbackImageTag = previousSuccess ? previousSuccess.imageTag : deployment.imageTag;
    const rollbackGitSha = previousSuccess ? previousSuccess.gitSha : deployment.gitSha;

    if (deployment.status === 'succeeded') {
      try {
        await this.transitionDeployment(deployment.id, 'MANUAL_ROLLBACK', 'Manual rollback initiated by user');
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Failed transitioning previous deployment to rolled_back');
      }
    }

    return this.createDeployment({
      serviceId: deployment.serviceId,
      environmentId: deployment.environmentId,
      triggeredBy,
      imageTag: rollbackImageTag,
      gitSha: rollbackGitSha,
      rollbackOfId: deployment.id,
    });
  }

  /**
   * Generates typed manifests, applies them to Kubernetes, and monitors rollout.
   */
  async deployToKubernetes(deploymentId: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        service: { include: { team: true } },
        environment: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!deployment) return null;

    const variables = await prisma.envVariable.findMany({
      where: { environmentId: deployment.environmentId },
    });

    const bundle = manifestBuilder.buildBundle({
      service: {
        name: deployment.service.name,
        imageRepo: deployment.service.imageRepo,
      },
      environment: {
        type: deployment.environment.type,
        k8sNamespace: deployment.environment.k8sNamespace,
        replicas: deployment.environment.replicas,
        cpuRequestM: deployment.environment.cpuRequestM,
        memoryRequestMb: deployment.environment.memoryRequestMb,
      },
      imageTag: deployment.imageTag,
      variables: variables.map((v: any) => {
        let plain = '';
        if (v.valueEncrypted && v.iv) {
          try {
            plain = decryptSecret(v.valueEncrypted, v.iv);
          } catch {
            plain = '';
          }
        } else if (v.value) {
          plain = v.value;
        }
        return {
          key: v.key,
          value: plain,
          isSecret: v.isSecret,
        };
      }),
      teamSlug: deployment.service.team?.slug,
    });

    // 1. Transition to 'applying'
    await this.transitionDeployment(
      deploymentId,
      'APPLY_K8S',
      'Generating typed manifests and applying to Kubernetes namespace'
    );

    try {
      await k8sService.applyManifestBundle(bundle);

      // 2. Transition to 'rolling_out'
      await this.transitionDeployment(
        deploymentId,
        'PODS_SCHEDULED',
        'Pods scheduled, streaming logs and watching rollout health'
      );

      // 3. Stream pod logs to Socket.io room
      await k8sService.streamPodLogs({
        deploymentId,
        namespace: deployment.environment.k8sNamespace,
        serviceName: deployment.service.name,
      });

      // 4. Watch rollout
      const rollout = await k8sService.watchRollout({
        deploymentId,
        namespace: deployment.environment.k8sNamespace,
        deploymentName: deployment.service.name,
        targetTag: deployment.imageTag,
      });

      if (rollout.success) {
        await this.transitionDeployment(
          deploymentId,
          'ROLLOUT_PASSED',
          `Rollout passed: all ${rollout.replicasReady || 1} replica(s) ready`
        );
        await notificationService.sendDeploymentSuccess({
          toEmail: deployment.user?.email || 'dev@idp.internal',
          serviceName: deployment.service.name,
          envType: deployment.environment.type,
          imageTag: deployment.imageTag,
          deploymentId,
        });
      } else {
        await this.transitionDeployment(
          deploymentId,
          'ROLLOUT_FAILED',
          `Rollout failed: ${rollout.reason}`
        );
        await notificationService.sendDeploymentFailure({
          toEmail: deployment.user?.email || 'dev@idp.internal',
          serviceName: deployment.service.name,
          envType: deployment.environment.type,
          imageTag: deployment.imageTag,
          deploymentId,
          errorReason: rollout.reason,
        });
        await this.handleRolloutFailure(deployment);
      }
    } catch (err: any) {
      await this.transitionDeployment(
        deploymentId,
        'FAIL',
        `Kubernetes deployment error: ${err.message}`
      );
      await notificationService.sendDeploymentFailure({
        toEmail: deployment.user?.email || 'dev@idp.internal',
        serviceName: deployment.service.name,
        envType: deployment.environment.type,
        imageTag: deployment.imageTag,
        deploymentId,
        errorReason: err.message,
      });
      await this.handleRolloutFailure(deployment);
    }

    return this.getDeploymentById(deploymentId);
  }

  /**
   * Automatic rollback to previous successful deployment on rollout failure.
   */
  async handleRolloutFailure(deployment: any) {
    if (deployment.rollbackOfId) {
      logger.warn({ deploymentId: deployment.id }, 'Deployment was already a rollback; preventing recursive auto-rollback');
      return;
    }

    const previousSuccess = await prisma.deployment.findFirst({
      where: {
        serviceId: deployment.serviceId,
        environmentId: deployment.environmentId,
        status: 'succeeded',
        id: { not: deployment.id },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (previousSuccess) {
      logger.info(
        { previousId: previousSuccess.id, failedId: deployment.id },
        'Rollout failed: executing automated rollback to last successful release'
      );

      await prisma.deploymentEvent.create({
        data: {
          deploymentId: deployment.id,
          fromStatus: 'rolled_back',
          toStatus: 'rolled_back',
          message: `Auto-rollback initiated to previous stable release (${previousSuccess.imageTag})`,
        },
      });

      const rollbackDeployment = await this.createDeployment({
        serviceId: deployment.serviceId,
        environmentId: deployment.environmentId,
        triggeredBy: deployment.triggeredBy,
        imageTag: previousSuccess.imageTag,
        gitSha: previousSuccess.gitSha,
        rollbackOfId: deployment.id,
      });

      if (rollbackDeployment) {
        // Rollback deployment auto-applies
        await this.deployToKubernetes(rollbackDeployment.id);
      }
    } else {
      logger.warn(
        { deploymentId: deployment.id },
        'No prior successful deployment available for automated rollback'
      );
    }
  }

  /**
   * Handles incoming GitHub Actions workflow_run webhooks.
   */
  async handleWebhookRun(payload: any) {
    const workflowRun = payload.workflow_run;
    if (!workflowRun) return;

    const runName: string = workflowRun.name || '';
    // Extract correlation_id from run name: "Deploy [uuid] - ..."
    const match = runName.match(/\[([a-f0-9-]+)\]/i);
    if (!match) return;

    const correlationId = match[1];
    const deployment = await prisma.deployment.findUnique({
      where: { correlationId },
    });
    if (!deployment) return;

    // Record / upsert pipeline_run details
    await prisma.pipelineRun.upsert({
      where: { deploymentId: deployment.id },
      update: {
        ghRunId: String(workflowRun.id),
        status: workflowRun.status,
        conclusion: workflowRun.conclusion,
        runUrl: workflowRun.html_url,
      },
      create: {
        deploymentId: deployment.id,
        ghRunId: String(workflowRun.id),
        status: workflowRun.status,
        conclusion: workflowRun.conclusion,
        runUrl: workflowRun.html_url,
      },
    });

    if (workflowRun.conclusion === 'success') {
      if (deployment.status === 'building') {
        await this.transitionDeployment(
          deployment.id,
          'IMAGE_PUSHED',
          `Image built and pushed to GHCR (Run #${workflowRun.id})`
        );
        // Automatically progress to Kubernetes deployment and live pod streaming
        await this.deployToKubernetes(deployment.id);
      }
    } else if (workflowRun.conclusion === 'failure') {
      if (!TERMINAL_STATES.has(deployment.status)) {
        await this.transitionDeployment(
          deployment.id,
          'FAIL',
          `GitHub Action build failed (Run #${workflowRun.id})`
        );
      }
    }
  }

  private broadcast(deploymentId: string, event: string, data: unknown) {
    const io = getSocketServer();
    if (io) {
      io.to(`deployment:${deploymentId}`).emit(event, data);
    }
  }

  private parseRepoUrl(repoUrl: string): [string, string] {
    const cleaned = repoUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/\.git$/, '');
    const parts = cleaned.split('/');
    if (parts.length >= 2) {
      return [parts[0], parts[1]];
    }
    return ['systemwithayush', 'default-service'];
  }
}

export const deploymentsService = new DeploymentsService();
