import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, requireServiceAccess } from '../../middleware/auth.middleware.js';
import { servicesService } from './services.service.js';
import { quotaValidator } from '../quotas/quota.validator.js';
import { prisma } from '../../prisma.js';
import { CreateServiceSchema, CreateEnvironmentSchema } from '@idp/shared';
import { Role } from '@prisma/client';

export const servicesRouter = Router();

servicesRouter.use(authenticateJWT);

/**
 * GET /api/v1/services
 */
servicesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const teamIdFilter = user.role === Role.admin ? (req.query.teamId as string) : user.teamId;

    const result = await servicesService.listServices({
      search: req.query.search as string,
      stack: req.query.stack as string,
      teamId: teamIdFilter,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/services
 */
servicesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const validated = CreateServiceSchema.parse(req.body);

    const targetTeamId = user.role === Role.admin && req.body.teamId ? req.body.teamId : user.teamId;

    const service = await servicesService.createService({
      ...validated,
      teamId: targetTeamId,
      ownerId: user.id,
      initialEnvironment: req.body.initialEnvironment,
    });

    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/services/:id
 */
servicesRouter.get('/:id', requireServiceAccess('read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await servicesService.getServiceById(req.params.id);
    if (!service) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return;
    }
    res.status(200).json(service);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/services/:id
 */
servicesRouter.patch('/:id', requireServiceAccess('write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await servicesService.updateService(req.params.id, req.user!.id, req.body);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/services/:id
 */
servicesRouter.delete('/:id', requireServiceAccess('write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await servicesService.deleteService(req.params.id, req.user!.id);
    res.status(200).json({ message: 'Service deleted successfully', service: deleted });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/services/:id/environments
 */
servicesRouter.get('/:id/environments', requireServiceAccess('read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const environments = await prisma.environment.findMany({
      where: { serviceId: req.params.id },
      include: {
        _count: {
          select: { envVariables: true, deployments: true },
        },
      },
    });
    res.status(200).json(environments);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/services/:id/environments
 */
servicesRouter.post('/:id/environments', requireServiceAccess('write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateEnvironmentSchema.parse(req.body);
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return;
    }

    // Check environment quota
    await quotaValidator.validateEnvironmentQuota({
      teamId: service.teamId,
      requestedCpuM: validated.cpuRequestM,
      requestedMemoryMb: validated.memoryRequestMb,
      replicas: validated.replicas,
    });

    const env = await prisma.environment.create({
      data: {
        serviceId: service.id,
        type: validated.type,
        k8sNamespace: validated.k8sNamespace || `idp-${service.name}-${validated.type}`,
        replicas: validated.replicas,
        cpuRequestM: validated.cpuRequestM,
        memoryRequestMb: validated.memoryRequestMb,
      },
    });

    res.status(201).json(env);
  } catch (error) {
    next(error);
  }
});
