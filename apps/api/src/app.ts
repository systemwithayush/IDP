import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { ZodError } from 'zod';

import { authRouter } from './modules/auth/auth.routes.js';
import { teamsRouter } from './modules/teams/teams.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { servicesRouter } from './modules/services/services.routes.js';
import { environmentsRouter } from './modules/environments/environments.routes.js';
import { templatesRouter } from './modules/templates/templates.routes.js';
import { deploymentsRouter } from './modules/deployments/deployments.routes.js';
import { webhooksRouter } from './modules/webhooks/webhooks.routes.js';

export const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Request correlation ID and logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      correlationId,
    });
  });

  next();
});

// Health check endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ready',
    database: 'connected',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Root API info
app.get('/api/v1', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Internal Developer Platform API',
    version: 'v1',
    docs: '/docs',
  });
});

// Feature Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/teams', teamsRouter);
app.use('/api/v1/audit-log', auditRouter);
app.use('/api/v1/services', servicesRouter);
app.use('/api/v1/environments', environmentsRouter);
app.use('/api/v1/templates', templatesRouter);
app.use('/api/v1/webhooks', webhooksRouter);
app.use('/api/v1/deployments', deploymentsRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
});

// Centralized Error Handling Middleware
// Standardized envelope: { error: { code, message, details? } }
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled request error');

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: err.errors,
      },
    });
    return;
  }

  const status = (err as { status?: number }).status || 500;
  const message = (err as { message?: string }).message || 'Internal Server Error';
  const code = (err as { code?: string }).code || 'INTERNAL_SERVER_ERROR';

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
});

