import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateFeedbackDto {
  orderKey: string;
  feedback?: string;
  googleReviewLink?: string;
  recommendedProduct?: string;
  notes?: string;
}

export interface UpdateFeedbackDto {
  feedback?: string;
  googleReviewLink?: string;
  recommendedProduct?: string;
  notes?: string;
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(data: CreateFeedbackDto, actorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderKey: data.orderKey },
    });

    if (!order) {
      throw new NotFoundException(`Order ${data.orderKey} not found`);
    }

    const feedback = await this.prisma.customerFeedback.create({
      data,
      include: { order: { select: { orderKey: true, emNumber: true } } },
    });

    await this.auditService.log({
      entityType: 'customer_feedback',
      entityId: feedback.id,
      action: 'CREATE',
      actorUserId: actorId,
      after: feedback,
    });

    return feedback;
  }

  async findById(id: string) {
    const feedback = await this.prisma.customerFeedback.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            orderItems: { include: { product: true } },
          },
        },
      },
    });

    if (!feedback) {
      throw new NotFoundException(`Feedback ${id} not found`);
    }

    return feedback;
  }

  async findByOrder(orderKey: string) {
    return this.prisma.customerFeedback.findMany({
      where: { orderKey },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(page = 1, limit = 50) {
    const [feedbacks, total] = await Promise.all([
      this.prisma.customerFeedback.findMany({
        include: {
          order: {
            select: { orderKey: true, emNumber: true },
            include: { customer: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customerFeedback.count(),
    ]);

    return {
      data: feedbacks,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(id: string, data: UpdateFeedbackDto, actorId: string) {
    const before = await this.findById(id);

    const feedback = await this.prisma.customerFeedback.update({
      where: { id },
      data,
      include: { order: { select: { orderKey: true, emNumber: true } } },
    });

    await this.auditService.log({
      entityType: 'customer_feedback',
      entityId: id,
      action: 'UPDATE',
      actorUserId: actorId,
      before,
      after: feedback,
    });

    return feedback;
  }
}
