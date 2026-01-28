import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateEmSeriesDto {
  country: string;
  prefix: string;
  nextCounter?: number;
  active?: boolean;
}

export interface UpdateEmSeriesDto {
  prefix?: string;
  nextCounter?: number;
  active?: boolean;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ EM SERIES ============

  async getEmSeries() {
    return this.prisma.settingsEmSeries.findMany({
      orderBy: { country: 'asc' },
    });
  }

  async getEmSeriesByCountry(country: string) {
    const series = await this.prisma.settingsEmSeries.findUnique({
      where: { country },
    });
    if (!series) {
      throw new NotFoundException(`EM series for ${country} not found`);
    }
    return series;
  }

  async createEmSeries(data: CreateEmSeriesDto) {
    const existing = await this.prisma.settingsEmSeries.findUnique({
      where: { country: data.country },
    });
    if (existing) {
      throw new BadRequestException(`EM series for ${data.country} already exists`);
    }

    return this.prisma.settingsEmSeries.create({
      data: {
        country: data.country,
        prefix: data.prefix,
        nextCounter: data.nextCounter ?? 1,
        active: data.active ?? true,
      },
    });
  }

  async updateEmSeries(country: string, data: UpdateEmSeriesDto) {
    await this.getEmSeriesByCountry(country);
    return this.prisma.settingsEmSeries.update({
      where: { country },
      data,
    });
  }

  async deleteEmSeries(country: string) {
    await this.getEmSeriesByCountry(country);
    await this.prisma.settingsEmSeries.delete({
      where: { country },
    });
    return { success: true };
  }

  // ============ DASHBOARD STATS ============

  async getDashboardStats() {
    const [
      totalLeads,
      newLeads,
      wonLeads,
      totalOrders,
      ongoingOrders,
      deliveredOrders,
      totalCustomers,
      totalStaff,
    ] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { status: 'NEW' } }),
      this.prisma.lead.count({ where: { status: 'WON' } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { orderStatus: 'ONGOING' } }),
      this.prisma.order.count({ where: { orderStatus: 'DELIVERED' } }),
      this.prisma.customer.count(),
      this.prisma.staff.count({ where: { active: true } }),
    ]);

    return {
      leads: { total: totalLeads, new: newLeads, won: wonLeads },
      orders: { total: totalOrders, ongoing: ongoingOrders, delivered: deliveredOrders },
      customers: totalCustomers,
      staff: totalStaff,
    };
  }
}
