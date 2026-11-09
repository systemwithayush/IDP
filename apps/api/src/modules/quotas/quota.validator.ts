import { prisma } from '../../prisma.js';
import { notificationService } from '../notifications/notification.service.js';

export class QuotaValidationError extends Error {
  status = 422;
  code = 'QUOTA_EXCEEDED';
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'QuotaValidationError';
    this.details = details;
  }
}

export class QuotaValidator {
  /**
   * Validates whether a team can register an additional service.
   * Throws 422 QuotaValidationError if team already reached maxServices.
   */
  async validateServiceQuota(teamId: string): Promise<void> {
    const quota = await prisma.resourceQuota.findUnique({
      where: { teamId },
    });

    if (!quota) {
      return; // No quota restriction defined
    }

    const currentServicesCount = await prisma.service.count({
      where: { teamId },
    });

    if (currentServicesCount >= quota.maxServices) {
      throw new QuotaValidationError(
        `Team service quota exceeded: current ${currentServicesCount} of max ${quota.maxServices} services allowed.`,
        {
          currentServices: currentServicesCount,
          maxAllowed: quota.maxServices,
        }
      );
    }
  }

  /**
   * Validates whether adding or resizing an environment fits within the team's CPU & Memory quotas.
   * Throws 422 QuotaValidationError with details if requested sizing exceeds limits.
   */
  async validateEnvironmentQuota(params: {
    teamId: string;
    requestedCpuM: number;
    requestedMemoryMb: number;
    replicas: number;
    existingEnvironmentId?: string;
  }): Promise<void> {
    const quota = await prisma.resourceQuota.findUnique({
      where: { teamId: params.teamId },
    });

    if (!quota) {
      return; // No quota restriction defined
    }

    // Get all current environments for the team's services
    const teamServices = await prisma.service.findMany({
      where: { teamId: params.teamId },
      include: {
        environments: true,
      },
    });

    let currentTotalCpuM = 0;
    let currentTotalMemoryMb = 0;

    for (const service of teamServices) {
      for (const env of service.environments) {
        // If updating an existing environment, don't count its old allocation
        if (params.existingEnvironmentId && env.id === params.existingEnvironmentId) {
          continue;
        }
        currentTotalCpuM += env.cpuRequestM * env.replicas;
        currentTotalMemoryMb += env.memoryRequestMb * env.replicas;
      }
    }

    const additionalCpuM = params.requestedCpuM * params.replicas;
    const additionalMemoryMb = params.requestedMemoryMb * params.replicas;

    const projectedCpuM = currentTotalCpuM + additionalCpuM;
    const projectedMemoryMb = currentTotalMemoryMb + additionalMemoryMb;

    // Quota warning alert at >= 80%
    const cpuPct = (projectedCpuM / quota.maxCpuMillicores) * 100;
    if (cpuPct >= 80 && cpuPct <= 100) {
      notificationService.sendQuotaWarning({
        toEmail: 'team-leads@idp.internal',
        teamName: params.teamId,
        resourceType: 'CPU',
        percentUsed: cpuPct,
        currentUsage: projectedCpuM,
        limit: quota.maxCpuMillicores,
      }).catch(() => {});
    }

    const memPct = (projectedMemoryMb / quota.maxMemoryMb) * 100;
    if (memPct >= 80 && memPct <= 100) {
      notificationService.sendQuotaWarning({
        toEmail: 'team-leads@idp.internal',
        teamName: params.teamId,
        resourceType: 'Memory',
        percentUsed: memPct,
        currentUsage: projectedMemoryMb,
        limit: quota.maxMemoryMb,
      }).catch(() => {});
    }

    if (projectedCpuM > quota.maxCpuMillicores) {
      throw new QuotaValidationError(
        `Team CPU quota exceeded: requested ${additionalCpuM}m would push total to ${projectedCpuM}m (limit: ${quota.maxCpuMillicores}m).`,
        {
          currentUsageM: currentTotalCpuM,
          requestedAdditionalM: additionalCpuM,
          projectedTotalM: projectedCpuM,
          maxAllowedM: quota.maxCpuMillicores,
        }
      );
    }

    if (projectedMemoryMb > quota.maxMemoryMb) {
      throw new QuotaValidationError(
        `Team Memory quota exceeded: requested ${additionalMemoryMb}MB would push total to ${projectedMemoryMb}MB (limit: ${quota.maxMemoryMb}MB).`,
        {
          currentUsageMb: currentTotalMemoryMb,
          requestedAdditionalMb: additionalMemoryMb,
          projectedTotalMb: projectedMemoryMb,
          maxAllowedMb: quota.maxMemoryMb,
        }
      );
    }
  }
}

export const quotaValidator = new QuotaValidator();
