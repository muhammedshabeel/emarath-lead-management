import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  actorUserId?: string;
  before?: any;
  after?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          actorUserId: entry.actorUserId,
          before: entry.before ? JSON.parse(JSON.stringify(entry.before)) : null,
          after: entry.after ? JSON.parse(JSON.stringify(entry.after)) : null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }

  async getByEntity(entityType: string, entityId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getByActor(actorUserId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { actorUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getRecent(limit = 100) {
    return this.prisma.auditLog.findMany({
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async search(params: {
    entityType?: string;
    action?: string;
    actorUserId?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (params.entityType) where.entityType = params.entityType;
    if (params.action) where.action = params.action;
    if (params.actorUserId) where.actorUserId = params.actorUserId;
    if (params.fromDate || params.toDate) {
      where.createdAt = {};
      if (params.fromDate) where.createdAt.gte = params.fromDate;
      if (params.toDate) where.createdAt.lte = params.toDate;
    }

    const page = params.page || 1;
    const limit = params.limit || 50;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
