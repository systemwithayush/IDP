import { Router, Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rate-limiter.middleware.js';
import { RegisterRequestSchema, LoginRequestSchema } from '@idp/shared';
import { auditService } from '../audit/audit.service.js';
import { prisma } from '../../prisma.js';

export const authRouter = Router();

// Apply rate limiting across auth endpoints
authRouter.use(authRateLimiter);

/**
 * POST /api/v1/auth/register
 */
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = RegisterRequestSchema.parse(req.body);
    const result = await authService.register(validated);

    // Set httpOnly refresh cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = LoginRequestSchema.parse(req.body);
    const result = await authService.login(validated);

    // Set httpOnly refresh cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 */
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token cookie or body parameter is required',
        },
      });
      return;
    }

    const tokens = await authService.refreshToken(token);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 */
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    // If caller provided a valid bearer token, record audit log
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = authService.verifyAccessToken(authHeader.split(' ')[1]);
        await auditService.logAction({
          userId: payload.id,
          action: 'USER_LOGOUT',
          entityType: 'User',
          entityId: payload.id,
        });
      } catch {
        // Ignore token verification error on logout
      }
    }

    res.status(200).json({ message: 'Successfully logged out' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 */
authRouter.get('/me', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        role: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            resourceQuota: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

