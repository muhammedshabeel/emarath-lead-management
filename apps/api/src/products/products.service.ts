import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProductDto {
  productCode: string;
  productName: string;
  active?: boolean;
}

export interface UpdateProductDto {
  productName?: string;
  active?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { productCode: data.productCode },
    });
    if (existing) {
      throw new BadRequestException('Product code already exists');
    }

    return this.prisma.product.create({
      data: {
        productCode: data.productCode,
        productName: data.productName,
        active: data.active ?? true,
      },
    });
  }

  async findByCode(productCode: string) {
    const product = await this.prisma.product.findUnique({
      where: { productCode },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productCode} not found`);
    }
    return product;
  }

  async findAll(activeOnly = false) {
    return this.prisma.product.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { productName: 'asc' },
    });
  }

  async update(productCode: string, data: UpdateProductDto) {
    await this.findByCode(productCode);
    return this.prisma.product.update({
      where: { productCode },
      data,
    });
  }
}
