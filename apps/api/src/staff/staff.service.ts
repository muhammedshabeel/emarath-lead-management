import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export interface CreateStaffDto {
  name: string;
  email: string;
  role: StaffRole;
  country?: string;
  cx3Extension?: string;
  active?: boolean;
}

export interface UpdateStaffDto {
  name?: string;
  email?: string;
  role?: StaffRole;
  country?: string;
  cx3Extension?: string;
  active?: boolean;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(data: CreateStaffDto, actorId: string) {
    // Check for duplicate email
    const existing = await this.prisma.staff.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const staff = await this.prisma.staff.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        country: data.country,
        cx3Extension: data.cx3Extension,
        active: data.active ?? true,
      },
    });

    await this.auditService.log({
      entityType: 'staff',
      entityId: staff.id,
      action: 'CREATE',
      actorUserId: actorId,
      after: staff,
    });

    return staff;
  }

  async findById(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } },
            salesOrders: { where: { orderStatus: 'ONGOING' } },
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff ${id} not found`);
    }

    return staff;
  }

  async findAll(role?: StaffRole, active?: boolean) {
    const where: any = {};
    if (role) where.role = role;
    if (active !== undefined) where.active = active;

    return this.prisma.staff.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findAgents(country?: string, activeOnly = true) {
    return this.prisma.staff.findMany({
      where: {
        role: StaffRole.AGENT,
        active: activeOnly ? true : undefined,
        country: country || undefined,
      },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, data: UpdateStaffDto, actorId: string) {
    const before = await this.findById(id);

    // Check email uniqueness if changing
    if (data.email && data.email !== before.email) {
      const existing = await this.prisma.staff.findUnique({
        where: { email: data.email },
      });
      if (existing) {
        throw new BadRequestException('Email already exists');
      }
    }

    const staff = await this.prisma.staff.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      entityType: 'staff',
      entityId: id,
      action: 'UPDATE',
      actorUserId: actorId,
      before,
      after: staff,
    });

    return staff;
  }

  async deactivate(id: string, actorId: string) {
    return this.update(id, { active: false }, actorId);
  }

  async activate(id: string, actorId: string) {
    return this.update(id, { active: true }, actorId);
  }

  async getWorkloadStats() {
    const staff = await this.prisma.staff.findMany({
      where: { role: StaffRole.AGENT, active: true },
      include: {
        _count: {
          select: {
            assignedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } },
          },
        },
      },
    });

    return staff.map((s) => ({
      id: s.id,
      name: s.name,
      country: s.country,
      activeLeads: s._count.assignedLeads,
    }));
  }
}
