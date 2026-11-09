import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { prisma } from '../../prisma.js';
import { Role, Prisma } from '@prisma/client';

export const auditRouter = Router();

auditRouter.use(authenticateJWT);
auditRouter.use(requireRole([Role.admin, Role.lead]));

/**
 * GET /api/v1/audit-log
 * Filter by entity_type, entity_id
 * Restricted to Admin and Lead only
 */
auditRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const entityType = req.query.entity_type as string | undefined;
    const entityId = req.query.entity_id as string | undefined;
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (entityType) {
      where.entityType = entityType;
    }
    if (entityId) {
      where.entityId = entityId;
    }

    // Leads can only see actions performed by users in their own team
    if (user.role === Role.lead) {
      where.user = {
        teamId: user.teamId,
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              teamId: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

