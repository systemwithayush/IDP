import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, requireServiceAccess } from '../../middleware/auth.middleware.js';
import { deploymentsService } from './deployments.service.js';
import { CreateDeploymentSchema } from '@idp/shared';

export const deploymentsRouter = Router();

// All deployment routes require JWT authentication
deploymentsRouter.use(authenticateJWT);

/**
 * POST /api/v1/deployments
 * Trigger a new deployment
 */
deploymentsRouter.post(
  '/',
  requireServiceAccess('deploy'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = CreateDeploymentSchema.parse(req.body);
      const deployment = await deploymentsService.createDeployment({
        serviceId: validated.serviceId,
        environmentId: validated.environmentId,
        triggeredBy: req.user!.id,
        imageTag: validated.imageTag,
        gitSha: validated.gitSha,
      });

      res.status(201).json(deployment);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/deployments/:id
 * Retrieve deployment details and full event timeline
 */
deploymentsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deployment = await deploymentsService.getDeploymentById(req.params.id);
    if (!deployment) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Deployment not found' } });
      return;
    }
    res.status(200).json(deployment);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/deployments/:id/rollback
 * Trigger rollback targeting previous successful deployment
 */
deploymentsRouter.post('/:id/rollback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rollbackDeployment = await deploymentsService.rollback(req.params.id, req.user!.id);
    res.status(201).json(rollbackDeployment);
  } catch (error) {
    next(error);
  }
});
