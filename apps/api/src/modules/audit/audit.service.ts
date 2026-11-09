import { prisma } from '../../prisma.js';
import { logger } from '../../utils/logger.js';
import { Prisma } from '@prisma/client';

export interface LogActionParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
}

export class AuditService {
  /**
   * Records an immutable entry in the audit_log table.
   * Logs are structured, indexed, and fail-safe.
   */
  async logAction(params: LogActionParams) {
    try {
      const record = await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: (params.metadata || {}) as Prisma.InputJsonValue,
        },
      });

      logger.info(
        {
          auditId: record.id,
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
        },
        'Audit log recorded'
      );

      return record;
    } catch (error) {
      logger.error({ error, params }, 'Failed to record audit log entry');
      throw error;
    }
  }

  /**
   * Retrieves audit log records with optional filtering by entity type or entity id.
   */
  async getAuditLogs(filters?: { entityType?: string; entityId?: string; limit?: number; offset?: number }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.entityId) where.entityId = filters.entityId;

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
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
    });
  }
}

export const auditService = new AuditService();
