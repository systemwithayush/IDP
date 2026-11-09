import { Request, Response, NextFunction } from 'express';
import { authService, TokenPayload } from '../modules/auth/auth.service.js';
import { prisma } from '../prisma.js';
import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware: Verifies Bearer JWT access token from Authorization header.
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header with Bearer token',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = authService.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid or has expired',
      },
    });
  }
};

/**
 * Middleware: Enforces that the user has one of the required roles.
 */
export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: requires one of [${allowedRoles.join(', ')}] role(s). Current role: ${req.user.role}`,
        },
      });
      return;
    }

    next();
  };
};

/**
 * Middleware: Enforces fine-grained service access and ownership rules.
 * - admin: access to all services across all teams
 * - lead: access to all services in own team
 * - developer:
 *   - read: access to own team services
 *   - write: only services they own
 *   - deploy: only services they own, to dev & staging only (prod requires lead)
 */
export const requireServiceAccess = (action: 'read' | 'write' | 'deploy') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    if (user.role === Role.admin) {
      return next();
    }

    const serviceId = req.params.serviceId || req.params.id || req.body.serviceId;
    if (!serviceId) {
      return next();
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      res.status(404).json({ error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found' } });
      return;
    }

    // Must belong to user's team
    if (service.teamId !== user.teamId) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden: Service belongs to a different team',
        },
      });
      return;
    }

    // Lead has full access to own team's services
    if (user.role === Role.lead) {
      return next();
    }

    // Developer role enforcement
    if (user.role === Role.developer) {
      if (action === 'read') {
        return next();
      }

      // Must be the owner of the service
      if (service.ownerId !== user.id) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: Developers can only modify or deploy services they own',
          },
        });
        return;
      }

      // Check target environment for deploy action
      if (action === 'deploy') {
        const targetEnv = req.body.envType || req.body.environment || req.query.env;
        if (targetEnv === 'prod') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Forbidden: Deployments to production require Team Lead or Admin role',
            },
          });
          return;
        }
      }
    }

    next();
  };
};
