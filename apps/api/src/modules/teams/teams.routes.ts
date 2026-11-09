import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { prisma } from '../../prisma.js';
import { Role } from '@prisma/client';

export const teamsRouter = Router();

teamsRouter.use(authenticateJWT);

/**
 * GET /api/v1/teams
 * List all teams (authenticated users)
 */
teamsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        resourceQuota: true,
        _count: {
          select: {
            services: true,
            users: true,
          },
        },
      },
    });

    res.status(200).json(teams);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/teams/:id/usage
 * Get resource usage metrics and quota status for a team
 * - Admin: any team
 * - Lead / Developer: own team only
 */
teamsRouter.get('/:id/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.params.id;
    const user = req.user!;

    if (user.role !== Role.admin && user.teamId !== teamId) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden: You can only view resource usage for your own team',
        },
      });
      return;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        resourceQuota: true,
        services: {
          include: {
            environments: true,
          },
        },
      },
    });

    if (!team) {
      res.status(404).json({
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
        },
      });
      return;
    }

    // Aggregate CPU and Memory requests across all services and environments
    let totalCpuM = 0;
    let totalMemoryMb = 0;
    let totalReplicas = 0;

    for (const service of team.services) {
      for (const env of service.environments) {
        totalCpuM += env.cpuRequestM * env.replicas;
        totalMemoryMb += env.memoryRequestMb * env.replicas;
        totalReplicas += env.replicas;
      }
    }

    const quota = team.resourceQuota;
    const cpuUsagePercent = quota ? Math.min(100, Math.round((totalCpuM / quota.maxCpuMillicores) * 100)) : 0;
    const memoryUsagePercent = quota ? Math.min(100, Math.round((totalMemoryMb / quota.maxMemoryMb) * 100)) : 0;
    const servicesUsagePercent = quota ? Math.min(100, Math.round((team.services.length / quota.maxServices) * 100)) : 0;

    res.status(200).json({
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
      },
      quota: quota || null,
      usage: {
        servicesCount: team.services.length,
        totalReplicas,
        totalCpuM,
        totalMemoryMb,
        percentages: {
          cpu: cpuUsagePercent,
          memory: memoryUsagePercent,
          services: servicesUsagePercent,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});
