import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeadStatus, StaffRole, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { normalizePhoneKey } from '../common/utils/phone.util';

export interface CreateLeadDto {
  phoneKey?: string;
  country?: string;
  source?: string;
  adSource?: string;
  language?: string;
  notes?: string;
  assignedAgentId?: string;
}

export interface UpdateLeadDto {
  status?: LeadStatus;
  notes?: string;
  lostReason?: string;
  reason?: string;
  dispatchFlag?: boolean;
  paymentMethod?: string;
  csRemarks?: string;
  assignedAgentId?: string;
}

export interface UpdateIntakeFormDto {
  customerName?: string;
  altPhone?: string;
  shippingCountry?: string;
  shippingCity?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  googleMapsLink?: string;
  preferredDeliveryTime?: string;
  specialInstructions?: string;
}

export interface LeadProductDto {
  productCode: string;
  quantity: number;
  priceEstimate?: number;
}

export interface LeadFilters {
  status?: LeadStatus;
  assignedAgentId?: string;
  country?: string;
  source?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // Create a new lead
  async create(data: CreateLeadDto, actorId?: string) {
    const phoneKey = data.phoneKey ? normalizePhoneKey(data.phoneKey) : undefined;

    const lead = await this.prisma.lead.create({
      data: {
        phoneKey,
        country: data.country,
        source: data.source,
        adSource: data.adSource,
        language: data.language,
        notes: data.notes,
        assignedAgentId: data.assignedAgentId,
        status: LeadStatus.NEW,
      },
      include: {
        assignedAgent: true,
        customer: true,
        intakeForm: true,
        leadProducts: {
          include: { product: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'lead',
      entityId: lead.id,
      action: 'CREATE',
      actorUserId: actorId,
      after: lead,
    });

    return lead;
  }

  // Find lead by ID with full relations
  async findById(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignedAgent: true,
        customer: true,
        intakeForm: true,
        leadProducts: {
          include: { product: true },
        },
        orders: {
          select: { orderKey: true, emNumber: true, orderStatus: true },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return lead;
  }

  // Find leads with filters
  async findMany(filters: LeadFilters, page = 1, limit = 50) {
    const where: Prisma.LeadWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.assignedAgentId) where.assignedAgentId = filters.assignedAgentId;
    if (filters.country) where.country = filters.country;
    if (filters.source) where.source = filters.source;

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }

    if (filters.search) {
      where.OR = [
        { phoneKey: { contains: filters.search } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          assignedAgent: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phoneKey: true } },
          leadProducts: { select: { productCode: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get leads assigned to a specific agent (for agent dashboard)
  async findByAgent(agentId: string, statuses?: LeadStatus[]) {
    const where: Prisma.LeadWhereInput = {
      assignedAgentId: agentId,
    };

    if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    }

    return this.prisma.lead.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phoneKey: true } },
        leadProducts: { include: { product: true } },
        intakeForm: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Find open lead by phone key (for WhatsApp integration)
  async findOpenLeadByPhone(phoneKey: string) {
    const normalizedPhone = normalizePhoneKey(phoneKey);
    
    return this.prisma.lead.findFirst({
      where: {
        phoneKey: normalizedPhone,
        status: {
          notIn: [LeadStatus.WON, LeadStatus.LOST],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Update lead
  async update(id: string, data: UpdateLeadDto, actorId?: string) {
    const before = await this.findById(id);

    // Validation: Lost status requires lostReason
    if (data.status === LeadStatus.LOST && !data.lostReason && !before.lostReason) {
      throw new BadRequestException('Lost reason is required when setting status to Lost');
    }

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
        lostReason: data.lostReason,
        reason: data.reason,
        dispatchFlag: data.dispatchFlag,
        paymentMethod: data.paymentMethod,
        csRemarks: data.csRemarks,
        assignedAgentId: data.assignedAgentId,
      },
      include: {
        assignedAgent: true,
        customer: true,
        intakeForm: true,
        leadProducts: {
          include: { product: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'lead',
      entityId: lead.id,
      action: 'UPDATE',
      actorUserId: actorId,
      before,
      after: lead,
    });

    return lead;
  }

  // Update or create intake form
  async upsertIntakeForm(leadId: string, data: UpdateIntakeFormDto, actorId?: string) {
    await this.findById(leadId); // Ensure lead exists

    const intakeForm = await this.prisma.leadIntakeForm.upsert({
      where: { leadId },
      create: {
        leadId,
        ...data,
      },
      update: data,
    });

    await this.auditService.log({
      entityType: 'lead_intake_form',
      entityId: leadId,
      action: 'UPSERT',
      actorUserId: actorId,
      after: intakeForm,
    });

    return intakeForm;
  }

  // Manage lead products
  async setLeadProducts(leadId: string, products: LeadProductDto[], actorId?: string) {
    await this.findById(leadId); // Ensure lead exists

    // Delete existing and create new
    await this.prisma.$transaction([
      this.prisma.leadProduct.deleteMany({ where: { leadId } }),
      this.prisma.leadProduct.createMany({
        data: products.map((p) => ({
          leadId,
          productCode: p.productCode,
          quantity: p.quantity,
          priceEstimate: p.priceEstimate,
        })),
      }),
    ]);

    const leadProducts = await this.prisma.leadProduct.findMany({
      where: { leadId },
      include: { product: true },
    });

    await this.auditService.log({
      entityType: 'lead_products',
      entityId: leadId,
      action: 'SET',
      actorUserId: actorId,
      after: leadProducts,
    });

    return leadProducts;
  }

  // Add single product to lead
  async addProduct(leadId: string, product: LeadProductDto, actorId?: string) {
    await this.findById(leadId);

    const leadProduct = await this.prisma.leadProduct.upsert({
      where: {
        leadId_productCode: {
          leadId,
          productCode: product.productCode,
        },
      },
      create: {
        leadId,
        productCode: product.productCode,
        quantity: product.quantity,
        priceEstimate: product.priceEstimate,
      },
      update: {
        quantity: product.quantity,
        priceEstimate: product.priceEstimate,
      },
      include: { product: true },
    });

    return leadProduct;
  }

  // Remove product from lead
  async removeProduct(leadId: string, productCode: string, actorId?: string) {
    await this.prisma.leadProduct.delete({
      where: {
        leadId_productCode: {
          leadId,
          productCode,
        },
      },
    });

    return { success: true };
  }

  // Get pipeline stats for dashboard
  async getPipelineStats(agentId?: string) {
    const where: Prisma.LeadWhereInput = agentId ? { assignedAgentId: agentId } : {};

    const stats = await this.prisma.lead.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const result: Record<string, number> = {
      NEW: 0,
      CONTACTED: 0,
      FOLLOW_UP: 0,
      WON: 0,
      LOST: 0,
    };

    stats.forEach((s) => {
      result[s.status] = s._count.id;
    });

    return result;
  }

  // Reassign lead to another agent (Admin function)
  async reassign(leadId: string, newAgentId: string, actorId?: string) {
    const before = await this.findById(leadId);

    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: { assignedAgentId: newAgentId },
      include: { assignedAgent: true },
    });

    await this.auditService.log({
      entityType: 'lead',
      entityId: leadId,
      action: 'REASSIGN',
      actorUserId: actorId,
      before: { assignedAgentId: before.assignedAgentId },
      after: { assignedAgentId: newAgentId },
    });

    return lead;
  }
}
