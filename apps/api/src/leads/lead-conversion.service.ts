import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeadStatus, OrderStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { LeadsService } from './leads.service';

export interface ConvertLeadDto {
  paymentMethod?: string;
  notes?: string;
}

@Injectable()
export class LeadConversionService {
  private readonly logger = new Logger(LeadConversionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Convert a Lead to an Order
   * - Validates required data
   * - Creates/attaches customer
   * - Generates EM number atomically
   * - Creates order + order items
   * - Sets lead status to WON
   */
  async convertLead(leadId: string, dto: ConvertLeadDto, actorId?: string) {
    // Get full lead with relations
    const lead = await this.leadsService.findById(leadId);

    // Validation 1: Lead must have products
    if (!lead.leadProducts || lead.leadProducts.length === 0) {
      throw new BadRequestException('Cannot convert: Lead must have at least one product');
    }

    // Validation 2: Lead must have intake form with shipping address
    if (!lead.intakeForm) {
      throw new BadRequestException('Cannot convert: Lead intake form is required');
    }

    const intakeForm = lead.intakeForm;
    if (!intakeForm.shippingCountry || !intakeForm.shippingCity || !intakeForm.shippingAddressLine1) {
      throw new BadRequestException(
        'Cannot convert: Shipping country, city, and address are required',
      );
    }

    // Validation 3: Lead must have phone
    if (!lead.phoneKey) {
      throw new BadRequestException('Cannot convert: Lead phone number is required');
    }

    // Validation 4: Lead must not already be Won or Lost
    if (lead.status === LeadStatus.WON || lead.status === LeadStatus.LOST) {
      throw new BadRequestException(`Cannot convert: Lead is already ${lead.status}`);
    }

    // Execute conversion in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Step 1: Create or get customer
      let customerId = lead.customerId;
      
      if (!customerId) {
        // Try to find existing customer by phone
        let customer = await tx.customer.findUnique({
          where: { phoneKey: lead.phoneKey! },
        });

        if (!customer) {
          // Create new customer
          customer = await tx.customer.create({
            data: {
              phoneKey: lead.phoneKey!,
              phone1: lead.phoneKey!,
              name: intakeForm.customerName,
              country: intakeForm.shippingCountry,
              city: intakeForm.shippingCity,
              addressLine1: intakeForm.shippingAddressLine1,
              addressLine2: intakeForm.shippingAddressLine2,
            },
          });
          this.logger.log(`Created new customer: ${customer.id}`);
        }

        customerId = customer.id;

        // Link customer to lead
        await tx.lead.update({
          where: { id: leadId },
          data: { customerId },
        });
      }

      // Step 2: Generate EM number atomically
      const country = intakeForm.shippingCountry || lead.country || 'UAE';
      const emNumber = await this.generateEmNumber(tx, country);

      // Step 3: Calculate order value from lead products
      const orderValue = lead.leadProducts.reduce((sum, lp) => {
        const price = lp.priceEstimate ? Number(lp.priceEstimate) : 0;
        return sum + price * lp.quantity;
      }, 0);

      // Step 4: Create order
      const order = await tx.order.create({
        data: {
          emNumber,
          orderDate: new Date(),
          country,
          customerId,
          salesStaffId: lead.assignedAgentId,
          sourceLeadId: leadId,
          orderStatus: OrderStatus.ONGOING,
          paymentMethod: dto.paymentMethod || lead.paymentMethod,
          value: orderValue > 0 ? orderValue : null,
          notes: dto.notes || lead.notes,
        },
      });

      // Step 5: Create order items from lead products
      await tx.orderItem.createMany({
        data: lead.leadProducts.map((lp) => ({
          orderKey: order.orderKey,
          productCode: lp.productCode,
          quantity: lp.quantity,
          lineValue: lp.priceEstimate,
        })),
      });

      // Step 6: Update lead status to WON
      await tx.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.WON },
      });

      this.logger.log(`Converted lead ${leadId} to order ${order.orderKey} (${emNumber})`);

      return order;
    });

    // Audit the conversion
    await this.auditService.log({
      entityType: 'lead',
      entityId: leadId,
      action: 'CONVERT_TO_ORDER',
      actorUserId: actorId,
      before: { status: lead.status },
      after: { status: LeadStatus.WON, orderId: result.orderKey },
    });

    await this.auditService.log({
      entityType: 'order',
      entityId: result.orderKey,
      action: 'CREATE',
      actorUserId: actorId,
      after: result,
    });

    // Return the order with relations
    return this.prisma.order.findUnique({
      where: { orderKey: result.orderKey },
      include: {
        customer: true,
        salesStaff: true,
        orderItems: { include: { product: true } },
        sourceLead: true,
      },
    });
  }

  /**
   * Generate EM number atomically using row-level locking
   * Uses SELECT FOR UPDATE to prevent race conditions
   */
  private async generateEmNumber(
    tx: Prisma.TransactionClient,
    country: string,
  ): Promise<string> {
    // Get and lock the EM series row for this country
    const series = await tx.$queryRaw<Array<{
      id: string;
      prefix: string;
      next_counter: number;
    }>>`
      SELECT id, prefix, next_counter 
      FROM settings_em_series 
      WHERE country = ${country} AND active = true
      FOR UPDATE
    `;

    if (!series || series.length === 0) {
      // Create default series if not exists
      const newSeries = await tx.settingsEmSeries.create({
        data: {
          country,
          prefix: `EM-${country.toUpperCase()}-`,
          nextCounter: 2,
          active: true,
        },
      });
      return `${newSeries.prefix}${String(1).padStart(6, '0')}`;
    }

    const currentSeries = series[0];
    const emNumber = `${currentSeries.prefix}${String(currentSeries.next_counter).padStart(6, '0')}`;

    // Increment counter
    await tx.settingsEmSeries.update({
      where: { id: currentSeries.id },
      data: { nextCounter: currentSeries.next_counter + 1 },
    });

    return emNumber;
  }

  /**
   * Validate if a lead can be converted
   */
  async validateConversion(leadId: string): Promise<{
    canConvert: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const lead = await this.leadsService.findById(leadId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (lead.status === LeadStatus.WON) {
      errors.push('Lead is already converted (status: Won)');
    }

    if (lead.status === LeadStatus.LOST) {
      errors.push('Lead is lost and cannot be converted');
    }

    if (!lead.leadProducts || lead.leadProducts.length === 0) {
      errors.push('At least one product is required');
    }

    if (!lead.phoneKey) {
      errors.push('Lead phone number is required');
    }

    if (!lead.intakeForm) {
      errors.push('Lead intake form is required');
    } else {
      if (!lead.intakeForm.shippingCountry) {
        errors.push('Shipping country is required');
      }
      if (!lead.intakeForm.shippingCity) {
        errors.push('Shipping city is required');
      }
      if (!lead.intakeForm.shippingAddressLine1) {
        errors.push('Shipping address is required');
      }
      if (!lead.intakeForm.customerName) {
        warnings.push('Customer name is not set');
      }
    }

    if (!lead.assignedAgentId) {
      warnings.push('No agent assigned to this lead');
    }

    return {
      canConvert: errors.length === 0,
      errors,
      warnings,
    };
  }
}
