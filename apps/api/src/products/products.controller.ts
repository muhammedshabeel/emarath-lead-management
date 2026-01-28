import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { AdminOnly } from '../auth/decorators/roles.decorator';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

class CreateProductBodyDto {
  @IsString() productCode: string;
  @IsString() productName: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

class UpdateProductBodyDto {
  @IsString() @IsOptional() productName?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products' })
  async findAll(@Query('activeOnly') activeOnly?: boolean) {
    return this.productsService.findAll(activeOnly);
  }

  @Get(':productCode')
  @ApiOperation({ summary: 'Get product by code' })
  async findByCode(@Param('productCode') productCode: string) {
    return this.productsService.findByCode(productCode);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create product' })
  async create(@Body() dto: CreateProductBodyDto) {
    return this.productsService.create(dto);
  }

  @Put(':productCode')
  @AdminOnly()
  @ApiOperation({ summary: 'Update product' })
  async update(@Param('productCode') productCode: string, @Body() dto: UpdateProductBodyDto) {
    return this.productsService.update(productCode, dto);
  }
}
