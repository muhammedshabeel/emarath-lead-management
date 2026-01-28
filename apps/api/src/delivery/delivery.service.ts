import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateFollowupDto {
  orderKey: string;
  salesInstructions?: string;
  csUpdate?: string;
  deliveredCancelledDate?: Date;
}

export interface UpdateFollowupDto {
  salesInstructions?: string;
  csUpdate?: string;
  deliveredCancelledDate?: Date;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createFollowup(data: CreateFollowupDto, actorId: string, actorRole: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderKey: data.orderKey },
    });

    if (!order) {
      throw new NotFoundException(`Order ${data.orderKey} not found`);
    }

    const followup = await this.prisma.deliveryFollowup.create({
      data: {
        orderKey: data.orderKey,
        deliveryStaffId: actorRole === 'DELIVERY' ? actorId : undefined,
        salesStaffId: actorRole === 'AGENT' ? actorId : undefined,
        salesInstructions: data.salesInstructions,
        csUpdate: data.csUpdate,
        deliveredCancelledDate: data.deliveredCancelledDate,
      },
      include: {
        order: { select: { orderKey: true, emNumber: true, orderStatus: true } },
        deliveryStaff: { select: { id: true, name: true } },
        salesStaff: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      entityType: 'delivery_followup',
      entityId: followup.id,
      action: 'CREATE',
      actorUserId: actorId,
      after: followup,
    });

    return followup;
  }

  async findById(id: string) {
    const followup = await this.prisma.deliveryFollowup.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            orderItems: { include: { product: true } },
          },
        },
        deliveryStaff: { select: { id: true, name: true } },
        salesStaff: { select: { id: true, name: true } },
      },
    });

    if (!followup) {
      throw new NotFoundException(`Followup ${id} not found`);
    }

    return followup;
  }

  async findByOrder(orderKey: string) {
    return this.prisma.deliveryFollowup.findMany({
      where: { orderKey },
      include: {
        deliveryStaff: { select: { id: true, name: true } },
        salesStaff: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByDeliveryStaff(deliveryStaffId: string) {
    return this.prisma.deliveryFollowup.findMany({
      where: { deliveryStaffId },
      include: {
        order: {
          select: {
            orderKey: true,
            emNumber: true,
            orderStatus: true,
            customer: { select: { name: true, phoneKey: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(page = 1, limit = 50) {
    const [followups, total] = await Promise.all([
      this.prisma.deliveryFollowup.findMany({
        include: {
          order: {
            select: {
              orderKey: true,
              emNumber: true,
              orderStatus: true,
              customer: { select: { name: true } },
            },
          },
          deliveryStaff: { select: { id: true, name: true } },
          salesStaff: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deliveryFollowup.count(),
    ]);

    return {
      data: followups,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(id: string, data: UpdateFollowupDto, actorId: string) {
    const before = await this.findById(id);

    const followup = await this.prisma.deliveryFollowup.update({
      where: { id },
      data,
      include: {
        order: { select: { orderKey: true, emNumber: true } },
        deliveryStaff: { select: { id: true, name: true } },
        salesStaff: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      entityType: 'delivery_followup',
      entityId: id,
      action: 'UPDATE',
      actorUserId: actorId,
      before,
      after: followup,
    });

    return followup;
  }
}
