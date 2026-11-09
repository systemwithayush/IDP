import { prisma } from '../../prisma.js';
import { quotaValidator } from '../quotas/quota.validator.js';
import { auditService } from '../audit/audit.service.js';
import { Prisma } from '@prisma/client';

export interface CreateServiceInput {
  name: string;
  stack: string;
  repoUrl: string;
  imageRepo: string;
  templateId?: string;
  teamId: string;
  ownerId: string;
  initialEnvironment?: {
    type: 'dev' | 'staging' | 'prod';
    replicas?: number;
    cpuRequestM?: number;
    memoryRequestMb?: number;
  };
}

export class ServicesService {
  async listServices(filters: {
    search?: string;
    stack?: string;
    teamId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {};

    if (filters.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters.stack) {
      where.stack = filters.stack;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { repoUrl: { contains: filters.search } },
      ];
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          team: {
            select: { id: true, name: true, slug: true },
          },
          owner: {
            select: { id: true, email: true, role: true },
          },
          template: true,
          environments: true,
        },
      }),
      prisma.service.count({ where }),
    ]);

    return {
      data: services,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getServiceById(id: string) {
    return prisma.service.findUnique({
      where: { id },
      include: {
        team: true,
        owner: {
          select: { id: true, email: true, role: true },
        },
        template: true,
        environments: {
          include: {
            _count: {
              select: { envVariables: true, deployments: true },
            },
          },
        },
      },
    });
  }

  async createService(input: CreateServiceInput) {
    // 1. Quota check: max services
    await quotaValidator.validateServiceQuota(input.teamId);

    // 2. Validate template if specified
    if (input.templateId) {
      const template = await prisma.goldenPathTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!template) {
        const err = new Error('Golden path template not found');
        (err as any).status = 404;
        throw err;
      }
    }

    // 3. Create service in transaction
    const service = await prisma.service.create({
      data: {
        name: input.name,
        stack: input.stack,
        repoUrl: input.repoUrl,
        imageRepo: input.imageRepo,
        templateId: input.templateId || null,
        teamId: input.teamId,
        ownerId: input.ownerId,
      },
    });

    // 4. Provision initial environment if requested
    if (input.initialEnvironment) {
      const envData = input.initialEnvironment;
      const replicas = envData.replicas || 1;
      const cpu = envData.cpuRequestM || 100;
      const mem = envData.memoryRequestMb || 128;

      await quotaValidator.validateEnvironmentQuota({
        teamId: input.teamId,
        requestedCpuM: cpu,
        requestedMemoryMb: mem,
        replicas,
      });

      await prisma.environment.create({
        data: {
          serviceId: service.id,
          type: envData.type,
          k8sNamespace: `idp-${service.name}-${envData.type}`,
          replicas,
          cpuRequestM: cpu,
          memoryRequestMb: mem,
        },
      });
    }

    // 5. Record audit log
    await auditService.logAction({
      userId: input.ownerId,
      action: 'CREATE_SERVICE',
      entityType: 'Service',
      entityId: service.id,
      metadata: { name: service.name, stack: service.stack, teamId: service.teamId },
    });

    return this.getServiceById(service.id);
  }

  async updateService(id: string, userId: string, data: Partial<{ name: string; repoUrl: string; imageRepo: string }>) {
    const updated = await prisma.service.update({
      where: { id },
      data,
    });

    await auditService.logAction({
      userId,
      action: 'UPDATE_SERVICE',
      entityType: 'Service',
      entityId: id,
      metadata: data,
    });

    return updated;
  }

  async deleteService(id: string, userId: string) {
    const service = await prisma.service.delete({
      where: { id },
    });

    await auditService.logAction({
      userId,
      action: 'DELETE_SERVICE',
      entityType: 'Service',
      entityId: id,
      metadata: { name: service.name },
    });

    return service;
  }
}

export const servicesService = new ServicesService();
