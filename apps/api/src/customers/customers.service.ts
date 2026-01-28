import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { normalizePhoneKey } from '../common/utils/phone.util';

export interface CreateCustomerDto {
  name?: string;
  phoneKey?: string;
  phone1?: string;
  phone2?: string;
  country?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCustomerDto) {
    const phoneKey = data.phoneKey ? normalizePhoneKey(data.phoneKey) : undefined;
    
    return this.prisma.customer.create({
      data: {
        ...data,
        phoneKey,
      },
    });
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        leads: { orderBy: { createdAt: 'desc' }, take: 10 },
        orders: { orderBy: { orderDate: 'desc' }, take: 10 },
      },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async findByPhone(phoneKey: string) {
    const normalized = normalizePhoneKey(phoneKey);
    return this.prisma.customer.findUnique({
      where: { phoneKey: normalized },
    });
  }

  async findMany(search?: string, page = 1, limit = 50) {
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phoneKey: { contains: search } },
            { phone1: { contains: search } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(id: string, data: UpdateCustomerDto) {
    await this.findById(id);
    
    const phoneKey = data.phoneKey ? normalizePhoneKey(data.phoneKey) : undefined;
    
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...data,
        phoneKey: phoneKey || data.phoneKey,
      },
    });
  }

  async getOrCreate(phoneKey: string, defaultData?: Partial<CreateCustomerDto>) {
    const normalized = normalizePhoneKey(phoneKey);
    
    let customer = await this.prisma.customer.findUnique({
      where: { phoneKey: normalized },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          phoneKey: normalized,
          phone1: normalized,
          ...defaultData,
        },
      });
    }

    return customer;
  }
}
