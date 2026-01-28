import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { IsString, IsOptional } from 'class-validator';

class CreateCustomerBodyDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phoneKey?: string;
  @IsString() @IsOptional() phone1?: string;
  @IsString() @IsOptional() phone2?: string;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() addressLine1?: string;
  @IsString() @IsOptional() addressLine2?: string;
}

class UpdateCustomerBodyDto extends CreateCustomerBodyDto {}

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers' })
  async findMany(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.customersService.findMany(search, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  async findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Get('phone/:phoneKey')
  @ApiOperation({ summary: 'Get customer by phone' })
  async findByPhone(@Param('phoneKey') phoneKey: string) {
    return this.customersService.findByPhone(phoneKey);
  }

  @Post()
  @ApiOperation({ summary: 'Create customer' })
  async create(@Body() dto: CreateCustomerBodyDto) {
    return this.customersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerBodyDto) {
    return this.customersService.update(id, dto);
  }
}
