import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export interface UpdateOrderDto {
  orderStatus?: OrderStatus;
  cancellationReason?: string;
  trackingNumber?: string;
  rto?: boolean;
  deliveryStaffId?: string;
  notes?: string;
  value?: number;
}

export interface OrderFilters {
  orderStatus?: OrderStatus;
  salesStaffId?: string;
  deliveryStaffId?: string;
  customerId?: string;
  country?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  rto?: boolean;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get order by key
   */
  async findById(orderKey: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderKey },
      include: {
        customer: true,
        salesStaff: { select: { id: true, name: true, email: true } },
        deliveryStaff: { select: { id: true, name: true, email: true } },
        sourceLead: { select: { id: true, leadNumber: true, phoneKey: true } },
        orderItems: { include: { product: true } },
        complaints: true,
        feedback: true,
        deliveryFollowups: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderKey} not found`);
    }

    return order;
  }

  /**
   * Get order by EM number
   */
  async findByEmNumber(emNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { emNumber },
      include: {
        customer: true,
        salesStaff: { select: { id: true, name: true } },
        deliveryStaff: { select: { id: true, name: true } },
        orderItems: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with EM number ${emNumber} not found`);
    }

    return order;
  }

  /**
   * List orders with filters
   */
  async findMany(filters: OrderFilters, page = 1, limit = 50) {
    const where: Prisma.OrderWhereInput = {};

    if (filters.orderStatus) where.orderStatus = filters.orderStatus;
    if (filters.salesStaffId) where.salesStaffId = filters.salesStaffId;
    if (filters.deliveryStaffId) where.deliveryStaffId = filters.deliveryStaffId;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.country) where.country = filters.country;
    if (filters.rto !== undefined) where.rto = filters.rto;

    if (filters.fromDate || filters.toDate) {
      where.orderDate = {};
      if (filters.fromDate) where.orderDate.gte = filters.fromDate;
      if (filters.toDate) where.orderDate.lte = filters.toDate;
    }

    if (filters.search) {
      where.OR = [
        { emNumber: { contains: filters.search, mode: 'insensitive' } },
        { trackingNumber: { contains: filters.search, mode: 'insensitive' } },
        { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
        { customer: { phoneKey: { contains: filters.search } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phoneKey: true } },
          salesStaff: { select: { id: true, name: true } },
          deliveryStaff: { select: { id: true, name: true } },
          orderItems: { select: { productCode: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get orders pipeline stats
   */
  async getPipelineStats(staffId?: string, role?: string) {
    const where: Prisma.OrderWhereInput = {};
    
    if (role === 'AGENT' && staffId) {
      where.salesStaffId = staffId;
    } else if (role === 'DELIVERY' && staffId) {
      where.deliveryStaffId = staffId;
    }

    const stats = await this.prisma.order.groupBy({
      by: ['orderStatus'],
      where,
      _count: { orderKey: true },
      _sum: { value: true },
    });

    const result: Record<string, { count: number; value: number }> = {
      ONGOING: { count: 0, value: 0 },
      DELIVERED: { count: 0, value: 0 },
      CANCELLED: { count: 0, value: 0 },
    };

    stats.forEach((s) => {
      result[s.orderStatus] = {
        count: s._count.orderKey,
        value: Number(s._sum.value) || 0,
      };
    });

    return result;
  }

  /**
   * Update order with HARD cancellation rule enforcement
   */
  async update(orderKey: string, data: UpdateOrderDto, actorId?: string) {
    const before = await this.findById(orderKey);

    // HARD ENFORCEMENT: Cancellation requires reason
    if (data.orderStatus === OrderStatus.CANCELLED) {
      if (!data.cancellationReason && !before.cancellationReason) {
        throw new BadRequestException(
          'Cancellation reason is REQUIRED when setting order status to Cancelled. Please provide a cancellation reason.',
        );
      }
    }

    // Clear cancellation reason if not cancelled
    if (data.orderStatus && data.orderStatus !== OrderStatus.CANCELLED) {
      data.cancellationReason = undefined;
    }

    const order = await this.prisma.order.update({
      where: { orderKey },
      data: {
        orderStatus: data.orderStatus,
        cancellationReason: data.cancellationReason,
        trackingNumber: data.trackingNumber,
        rto: data.rto,
        deliveryStaffId: data.deliveryStaffId,
        notes: data.notes,
        value: data.value,
      },
      include: {
        customer: true,
        salesStaff: { select: { id: true, name: true } },
        deliveryStaff: { select: { id: true, name: true } },
        orderItems: { include: { product: true } },
      },
    });

    await this.auditService.log({
      entityType: 'order',
      entityId: orderKey,
      action: 'UPDATE',
      actorUserId: actorId,
      before,
      after: order,
    });

    return order;
  }

  /**
   * Assign delivery staff
   */
  async assignDeliveryStaff(orderKey: string, deliveryStaffId: string, actorId?: string) {
    return this.update(orderKey, { deliveryStaffId }, actorId);
  }

  /**
   * Mark as delivered
   */
  async markDelivered(orderKey: string, actorId?: string) {
    return this.update(orderKey, { orderStatus: OrderStatus.DELIVERED }, actorId);
  }

  /**
   * Mark as cancelled (requires reason)
   */
  async markCancelled(orderKey: string, cancellationReason: string, actorId?: string) {
    if (!cancellationReason || cancellationReason.trim().length === 0) {
      throw new BadRequestException('Cancellation reason is required');
    }

    return this.update(
      orderKey,
      {
        orderStatus: OrderStatus.CANCELLED,
        cancellationReason: cancellationReason.trim(),
      },
      actorId,
    );
  }

  /**
   * Mark as RTO
   */
  async markRto(orderKey: string, actorId?: string) {
    return this.update(orderKey, { rto: true }, actorId);
  }

  /**
   * Update tracking number
   */
  async updateTracking(orderKey: string, trackingNumber: string, actorId?: string) {
    return this.update(orderKey, { trackingNumber }, actorId);
  }

  /**
   * Get orders for delivery staff
   */
  async getDeliveryOrders(deliveryStaffId: string) {
    return this.prisma.order.findMany({
      where: {
        deliveryStaffId,
        orderStatus: OrderStatus.ONGOING,
      },
      include: {
        customer: true,
        orderItems: { include: { product: true } },
        deliveryFollowups: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { orderDate: 'asc' },
    });
  }
}
