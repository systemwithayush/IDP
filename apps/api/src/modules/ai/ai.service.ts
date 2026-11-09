import { prisma } from '../../prisma.js';
import { RecommendationStatus } from '@prisma/client';
import { AIRecommendationOutputSchema } from '@idp/shared';
import { IOpenAIClient, MockOpenAIClient, RealOpenAIClient } from './openai.client.js';
import { IMetricsCollector, metricsCollector } from './metrics.collector.js';
import { quotaValidator } from '../quotas/quota.validator.js';
import { auditService } from '../audit/audit.service.js';
import { logger } from '../../utils/logger.js';
import { ZodError } from 'zod';

export class AIService {
  private client: IOpenAIClient;
  private metrics: IMetricsCollector;

  constructor(client?: IOpenAIClient, metrics?: IMetricsCollector) {
    this.client = client || (process.env.NODE_ENV === 'test' ? new MockOpenAIClient() : new RealOpenAIClient());
    this.metrics = metrics || metricsCollector;
  }

  public setOpenAIClient(client: IOpenAIClient) {
    this.client = client;
  }

  public setMetricsCollector(collector: IMetricsCollector) {
    this.metrics = collector;
  }

  /**
   * Generates metrics-grounded recommendation for an environment.
   */
  async generateRecommendation(serviceId: string, environmentId: string) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { team: true },
    });
    if (!service) {
      const err = new Error('Service not found');
      (err as any).status = 404;
      throw err;
    }

    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
    });
    if (!environment || environment.serviceId !== serviceId) {
      const err = new Error('Environment not found for this service');
      (err as any).status = 404;
      throw err;
    }

    // 1. Collect real metrics snapshot
    const metricsSnapshot = await this.metrics.collectMetrics({
      serviceId,
      environmentId,
      k8sNamespace: environment.k8sNamespace,
      serviceName: service.name,
      currentCpuRequestM: environment.cpuRequestM,
      currentMemoryRequestMb: environment.memoryRequestMb,
    });

    // 2. Call OpenAI with strict structured outputs, retrying once on schema failure
    let rawOutput: any;
    try {
      rawOutput = await this.client.generateRecommendation({
        serviceName: service.name,
        environmentType: environment.type,
        currentCpuRequestM: environment.cpuRequestM,
        currentMemoryRequestMb: environment.memoryRequestMb,
        currentReplicas: environment.replicas,
        metrics: metricsSnapshot,
      });
      // Validate schema
      AIRecommendationOutputSchema.parse(rawOutput);
    } catch (firstErr) {
      logger.warn({ err: firstErr }, 'Initial AI recommendation schema validation failed; retrying once');
      try {
        rawOutput = await this.client.generateRecommendation({
          serviceName: service.name,
          environmentType: environment.type,
          currentCpuRequestM: environment.cpuRequestM,
          currentMemoryRequestMb: environment.memoryRequestMb,
          currentReplicas: environment.replicas,
          metrics: metricsSnapshot,
        });
        AIRecommendationOutputSchema.parse(rawOutput);
      } catch (retryErr) {
        logger.error({ err: retryErr }, 'AI recommendation retry failed schema validation');
        if (retryErr instanceof ZodError) {
          const err = new Error('AI recommendation output schema validation rejected after retry');
          (err as any).status = 502;
          (err as any).details = retryErr.errors;
          throw err;
        }
        throw retryErr;
      }
    }

    const validatedRecommendation = AIRecommendationOutputSchema.parse(rawOutput);

    // 3. Post-validation against sane bounds
    // Sane bounds: limit >= request, floor >= 50m, memory >= 64MB
    let cpuReq = Math.max(50, validatedRecommendation.cpu_request_m);
    let cpuLim = Math.max(cpuReq, validatedRecommendation.cpu_limit_m);
    let memReq = Math.max(64, validatedRecommendation.memory_request_mb);
    let memLim = Math.max(memReq, validatedRecommendation.memory_limit_mb);
    let replicas = Math.max(1, Math.min(20, validatedRecommendation.replicas));

    // Post-validation against team quota
    await quotaValidator.validateEnvironmentQuota({
      teamId: service.teamId,
      requestedCpuM: cpuReq,
      requestedMemoryMb: memReq,
      replicas,
      existingEnvironmentId: environment.id, // Don't double count current environment allocation
    });

    const finalRecommendation = {
      ...validatedRecommendation,
      cpu_request_m: cpuReq,
      cpu_limit_m: cpuLim,
      memory_request_mb: memReq,
      memory_limit_mb: memLim,
      replicas,
    };

    // 4. Store in database
    const record = await prisma.aIRecommendation.create({
      data: {
        serviceId,
        inputMetrics: {
          metrics: metricsSnapshot,
          currentConfig: {
            environmentId,
            environmentType: environment.type,
            cpuRequestM: environment.cpuRequestM,
            memoryRequestMb: environment.memoryRequestMb,
            replicas: environment.replicas,
          },
        } as any,
        recommendation: finalRecommendation as any,
        status: RecommendationStatus.pending,
      },
      include: {
        service: true,
      },
    });

    return {
      id: record.id,
      serviceId,
      environmentId,
      status: record.status,
      current: {
        cpuRequestM: environment.cpuRequestM,
        memoryRequestMb: environment.memoryRequestMb,
        replicas: environment.replicas,
      },
      recommended: finalRecommendation,
      inputMetrics: metricsSnapshot,
      createdAt: record.createdAt,
    };
  }

  /**
   * Approves recommendation and updates environment config with audit trail.
   */
  async approveRecommendation(recommendationId: string, reviewedBy: string) {
    const recommendation = await prisma.aIRecommendation.findUnique({
      where: { id: recommendationId },
      include: { service: true },
    });

    if (!recommendation) {
      const err = new Error('Recommendation not found');
      (err as any).status = 404;
      throw err;
    }

    if (recommendation.status !== 'pending') {
      const err = new Error(`Cannot approve recommendation with status '${recommendation.status}'`);
      (err as any).status = 400;
      throw err;
    }

    const inputData = recommendation.inputMetrics as any;
    const environmentId = inputData?.currentConfig?.environmentId;
    const recData = recommendation.recommendation as any;

    if (!environmentId) {
      const err = new Error('Invalid recommendation payload: missing target environment');
      (err as any).status = 400;
      throw err;
    }

    // Apply recommendation to environment config
    const updatedEnvironment = await prisma.environment.update({
      where: { id: environmentId },
      data: {
        cpuRequestM: recData.cpu_request_m,
        memoryRequestMb: recData.memory_request_mb,
        replicas: recData.replicas,
      },
    });

    // Update recommendation status to approved
    const updatedRecommendation = await prisma.aIRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: RecommendationStatus.approved,
        reviewedBy,
        reviewedAt: new Date(),
      },
      include: { reviewer: { select: { id: true, email: true, role: true } } },
    });

    // Write audit log
    await auditService.logAction({
      userId: reviewedBy,
      action: 'APPROVE_AI_RECOMMENDATION',
      entityType: 'AIRecommendation',
      entityId: recommendationId,
      metadata: {
        serviceId: recommendation.serviceId,
        environmentId,
        previous: inputData.currentConfig,
        applied: recData,
      },
    });

    return {
      recommendation: updatedRecommendation,
      updatedEnvironment,
    };
  }

  /**
   * Rejects recommendation with reason and writes audit log.
   */
  async rejectRecommendation(recommendationId: string, reviewedBy: string, reason?: string) {
    const recommendation = await prisma.aIRecommendation.findUnique({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      const err = new Error('Recommendation not found');
      (err as any).status = 404;
      throw err;
    }

    if (recommendation.status !== 'pending') {
      const err = new Error(`Cannot reject recommendation with status '${recommendation.status}'`);
      (err as any).status = 400;
      throw err;
    }

    const updatedRecommendation = await prisma.aIRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: RecommendationStatus.rejected,
        reviewedBy,
        reviewedAt: new Date(),
      },
      include: { reviewer: { select: { id: true, email: true, role: true } } },
    });

    await auditService.logAction({
      userId: reviewedBy,
      action: 'REJECT_AI_RECOMMENDATION',
      entityType: 'AIRecommendation',
      entityId: recommendationId,
      metadata: {
        serviceId: recommendation.serviceId,
        reason: reason || 'Rejected by engineer review',
      },
    });

    return updatedRecommendation;
  }

  async listRecommendations(serviceId: string) {
    return prisma.aIRecommendation.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, email: true, role: true } },
      },
    });
  }
}

export const aiService = new AIService();
