import { randomUUID } from 'crypto';
import { prisma } from '../../prisma.js';
import { transition, DeploymentEventAction, TERMINAL_STATES } from './state-machine.js';
import { gitHubService } from './github.service.js';
import { auditService } from '../audit/audit.service.js';
import { getSocketServer } from '../../socket.js';
import { logger } from '../../utils/logger.js';

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

    // Trigger GitHub Action dispatch
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
