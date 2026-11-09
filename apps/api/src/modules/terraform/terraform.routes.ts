import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, requireServiceAccess } from '../../middleware/auth.middleware.js';
import { terraformService } from './terraform.service.js';
import { prisma } from '../../prisma.js';

export const terraformRouter = Router();

terraformRouter.use(authenticateJWT);

/**
 * POST /api/v1/services/:id/terraform
 * Generates or regenerates multi-file Terraform HCL for a service.
 */
terraformRouter.post(
  '/:id/terraform',
  requireServiceAccess('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serviceId = req.params.id;
      const { cloudProvider, environment, enableDatabase, enableStorage } = req.body || {};

      const result = await terraformService.generateModule(serviceId, {
        cloudProvider,
        environment,
        enableDatabase,
        enableStorage,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/services/:id/terraform
 * Retrieves generated Terraform HCL files for a service.
 */
terraformRouter.get(
  '/:id/terraform',
  requireServiceAccess('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serviceId = req.params.id;
      const result = await terraformService.getModule(serviceId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/services/:id/terraform/download
 * Downloads the combined HCL file or a specific .tf file.
 */
terraformRouter.get(
  '/:id/terraform/download',
  requireServiceAccess('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serviceId = req.params.id;
      const fileKey = req.query.file as string | undefined;

      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found' } });
        return;
      }

      const generated = await terraformService.generateModule(serviceId);

      if (fileKey && generated.files[fileKey]) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileKey}"`);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.status(200).send(generated.files[fileKey]);
        return;
      }

      const filename = `${service.name}-infrastructure.tf`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send(generated.combinedHcl);
    } catch (error) {
      next(error);
    }
  }
);

