import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, requireServiceAccess, requireRole } from '../../middleware/auth.middleware.js';
import { aiService } from './ai.service.js';
import { z } from 'zod';

export const aiRouter = Router();

const GenerateRecommendationSchema = z.object({
  environmentId: z.string().uuid(),
});

const RejectRecommendationSchema = z.object({
  reason: z.string().optional(),
});

/**
 * POST /api/v1/services/:id/recommendations
 * Triggers metrics collection and AI recommendation generation
 */
aiRouter.post(
  '/services/:id/recommendations',
  authenticateJWT,
  requireServiceAccess('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = GenerateRecommendationSchema.parse(req.body);
      const recommendation = await aiService.generateRecommendation(
        req.params.id,
        validated.environmentId
      );

      res.status(201).json(recommendation);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/services/:id/recommendations
 * Lists all recommendations for a service
 */
aiRouter.get(
  '/services/:id/recommendations',
  authenticateJWT,
  requireServiceAccess('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recommendations = await aiService.listRecommendations(req.params.id);
      res.status(200).json({ data: recommendations });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/recommendations/:id/approve
 * Approves recommendation, updates environment config, and logs audit record
 */
aiRouter.post(
  '/recommendations/:id/approve',
  authenticateJWT,
  requireRole(['lead', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await aiService.approveRecommendation(req.params.id, req.user!.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/recommendations/:id/reject
 * Rejects recommendation without applying changes
 */
aiRouter.post(
  '/recommendations/:id/reject',
  authenticateJWT,
  requireRole(['lead', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = RejectRecommendationSchema.parse(req.body);
      const result = await aiService.rejectRecommendation(
        req.params.id,
        req.user!.id,
        validated.reason
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);
