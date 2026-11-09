import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { prisma } from '../../prisma.js';

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
