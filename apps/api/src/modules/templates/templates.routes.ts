import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { prisma } from '../../prisma.js';
import { scaffoldService } from './scaffold.service.js';

export const templatesRouter = Router();

templatesRouter.use(authenticateJWT);

/**
 * GET /api/v1/templates
 * Lists all registered Golden Path templates
 */
templatesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.goldenPathTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    res.status(200).json(templates);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/templates/:id
 * Fetches a single Golden Path template
 */
templatesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.goldenPathTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!template) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
      return;
    }

    res.status(200).json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/templates/:id/scaffold
 * Scaffolds a complete project structure from the specified Golden Path template.
 */
templatesRouter.post('/:id/scaffold', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { serviceName, teamId, repoUrl, imageRepo, initialEnvironment, autoRegister } = req.body;

    if (!serviceName) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'serviceName is required' } });
      return;
    }

    const result = await scaffoldService.scaffold({
      templateId: req.params.id,
      serviceName,
      teamId: teamId || user.teamId,
      userId: user.id,
      repoUrl,
      imageRepo,
      initialEnvironment,
      autoRegister: autoRegister !== false,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
