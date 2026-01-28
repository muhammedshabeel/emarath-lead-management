import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateComplaintDto {
  orderKey: string;
  complaint: string;
  department?: string;
  notes1?: string;
  notes2?: string;
}

export interface UpdateComplaintDto {
  complaint?: string;
  department?: string;
  notes1?: string;
  notes2?: string;
}

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(data: CreateComplaintDto, csStaffId: string) {
    // Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { orderKey: data.orderKey },
    });

    if (!order) {
      throw new NotFoundException(`Order ${data.orderKey} not found`);
    }

    const complaint = await this.prisma.complaint.create({
      data: {
        orderKey: data.orderKey,
        complaint: data.complaint,
        department: data.department,
        csStaffId,
        notes1: data.notes1,
        notes2: data.notes2,
      },
      include: {
        order: { select: { orderKey: true, emNumber: true } },
        csStaff: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      entityType: 'complaint',
      entityId: complaint.id,
      action: 'CREATE',
      actorUserId: csStaffId,
      after: complaint,
    });

    return complaint;
  }

  async findById(id: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            orderItems: { include: { product: true } },
          },
        },
        csStaff: { select: { id: true, name: true } },
      },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint ${id} not found`);
    }

    return complaint;
  }

  async findByOrder(orderKey: string) {
    return this.prisma.complaint.findMany({
      where: { orderKey },
      include: {
        csStaff: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(page = 1, limit = 50, department?: string) {
    const where = department ? { department } : {};

    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: {
          order: { select: { orderKey: true, emNumber: true } },
          csStaff: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return {
      data: complaints,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(id: string, data: UpdateComplaintDto, actorId: string) {
    const before = await this.findById(id);

    const complaint = await this.prisma.complaint.update({
      where: { id },
      data,
      include: {
        order: { select: { orderKey: true, emNumber: true } },
        csStaff: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      entityType: 'complaint',
      entityId: id,
      action: 'UPDATE',
      actorUserId: actorId,
      before,
      after: complaint,
    });

    return complaint;
  }
}
