import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { prisma } from '../../prisma.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.js';
import { auditService } from '../audit/audit.service.js';
import { UpsertEnvVariablesBatchSchema } from '@idp/shared';
import { Role } from '@prisma/client';

export const environmentsRouter = Router();

environmentsRouter.use(authenticateJWT);

/**
 * GET /api/v1/environments/:id/variables
 * Returns environment variables with secrets masked ("********")
 */
environmentsRouter.get('/:id/variables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const environmentId = req.params.id;
    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
      include: {
        service: true,
      },
    });

    if (!environment) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Environment not found' } });
      return;
    }

    const variables = await prisma.envVariable.findMany({
      where: { environmentId },
      orderBy: { key: 'asc' },
    });

    const response = variables.map((v) => {
      if (v.isSecret) {
        return {
          id: v.id,
          key: v.key,
          value: '********',
          isSecret: true,
          updatedAt: v.updatedAt,
        };
      }

      // Decrypt non-secret plaintext value for display
      try {
        const decrypted = decryptSecret(v.valueEncrypted, v.iv);
        return {
          id: v.id,
          key: v.key,
          value: decrypted,
          isSecret: false,
          updatedAt: v.updatedAt,
        };
      } catch {
        return {
          id: v.id,
          key: v.key,
          value: '',
          isSecret: false,
          updatedAt: v.updatedAt,
        };
      }
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/environments/:id/variables
 * Batch upserts environment variables, encrypting with AES-256-GCM
 */
environmentsRouter.put('/:id/variables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const environmentId = req.params.id;
    const validated = UpsertEnvVariablesBatchSchema.parse(req.body);

    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
      include: { service: true },
    });

    if (!environment) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Environment not found' } });
      return;
    }

    const upserted = [];
    for (const v of validated.variables) {
      const { encrypted, iv } = encryptSecret(v.value);

      const record = await prisma.envVariable.upsert({
        where: {
          environmentId_key: {
            environmentId,
            key: v.key,
          },
        },
        update: {
          valueEncrypted: encrypted,
          iv,
          isSecret: v.isSecret,
        },
        create: {
          environmentId,
          key: v.key,
          valueEncrypted: encrypted,
          iv,
          isSecret: v.isSecret,
        },
      });

      upserted.push({
        id: record.id,
        key: record.key,
        value: v.isSecret ? '********' : v.value,
        isSecret: record.isSecret,
      });
    }

    await auditService.logAction({
      userId: req.user!.id,
      action: 'UPSERT_ENV_VARIABLES',
      entityType: 'Environment',
      entityId: environmentId,
      metadata: { count: upserted.length, keys: upserted.map((u) => u.key) },
    });

    res.status(200).json(upserted);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/environments/:id/variables/reveal
 * Lead and Admin only: reveals plaintext values of encrypted secrets
 * Every call is strictly recorded in audit_log
 */
environmentsRouter.get(
  '/:id/variables/reveal',
  requireRole([Role.admin, Role.lead]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const environmentId = req.params.id;
      const user = req.user!;

      const environment = await prisma.environment.findUnique({
        where: { id: environmentId },
        include: { service: true },
      });

      if (!environment) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Environment not found' } });
        return;
      }

      // Check team boundary for Lead role
      if (user.role === Role.lead && environment.service.teamId !== user.teamId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: Leads can only reveal secrets for their own team',
          },
        });
        return;
      }

      const variables = await prisma.envVariable.findMany({
        where: { environmentId },
        orderBy: { key: 'asc' },
      });

      const revealed = variables.map((v) => {
        const plaintext = decryptSecret(v.valueEncrypted, v.iv);
        return {
          id: v.id,
          key: v.key,
          value: plaintext,
          isSecret: v.isSecret,
          updatedAt: v.updatedAt,
        };
      });

      // Audit log the secret reveal event
      await auditService.logAction({
        userId: user.id,
        action: 'REVEAL_SECRETS',
        entityType: 'Environment',
        entityId: environmentId,
        metadata: {
          serviceId: environment.serviceId,
          environmentType: environment.type,
          count: revealed.length,
        },
      });

      res.status(200).json(revealed);
    } catch (error) {
      next(error);
    }
  }
);
