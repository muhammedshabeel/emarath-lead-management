import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeadStatus, StaffRole } from '@prisma/client';
import { LeadsService, CreateLeadDto, UpdateLeadDto, UpdateIntakeFormDto, LeadProductDto } from './leads.service';
import { LeadConversionService, ConvertLeadDto } from './lead-conversion.service';
import { Roles, AdminOnly, AgentOrAdmin } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

// DTOs
class CreateLeadBodyDto {
  @IsString()
  @IsOptional()
  phoneKey?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  adSource?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

class UpdateLeadBodyDto {
  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  lostReason?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsOptional()
  dispatchFlag?: boolean;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  csRemarks?: string;
}

class IntakeFormBodyDto {
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  altPhone?: string;

  @IsString()
  @IsOptional()
  shippingCountry?: string;

  @IsString()
  @IsOptional()
  shippingCity?: string;

  @IsString()
  @IsOptional()
  shippingAddressLine1?: string;

  @IsString()
  @IsOptional()
  shippingAddressLine2?: string;

  @IsString()
  @IsOptional()
  googleMapsLink?: string;

  @IsString()
  @IsOptional()
  preferredDeliveryTime?: string;

  @IsString()
  @IsOptional()
  specialInstructions?: string;
}

class LeadProductBodyDto {
  @IsString()
  productCode: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @IsOptional()
  priceEstimate?: number;
}

class SetLeadProductsBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadProductBodyDto)
  products: LeadProductBodyDto[];
}

class ConvertLeadBodyDto {
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

class ReassignLeadBodyDto {
  @IsString()
  agentId: string;
}

@ApiTags('Leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly conversionService: LeadConversionService,
  ) {}

  // ============ LIST & SEARCH ============

  @Get()
  @ApiOperation({ summary: 'List leads with filters' })
  @ApiQuery({ name: 'status', required: false, enum: LeadStatus })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: LeadStatus,
    @Query('country') country?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    // Agents can only see their own leads
    const agentId = user.role === StaffRole.AGENT ? user.id : undefined;

    return this.leadsService.findMany(
      {
        status,
        country,
        source,
        search,
        assignedAgentId: agentId,
      },
      page,
      limit,
    );
  }

  @Get('my-leads')
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Get leads assigned to current agent' })
  @ApiQuery({ name: 'status', required: false, isArray: true, enum: LeadStatus })
  async getMyLeads(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') statuses?: LeadStatus[],
  ) {
    return this.leadsService.findByAgent(user.id, statuses);
  }

  @Get('pipeline-stats')
  @ApiOperation({ summary: 'Get lead pipeline statistics' })
  async getPipelineStats(@CurrentUser() user: AuthenticatedUser) {
    const agentId = user.role === StaffRole.AGENT ? user.id : undefined;
    return this.leadsService.getPipelineStats(agentId);
  }

  // ============ SINGLE LEAD ============

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const lead = await this.leadsService.findById(id);

    // Agents can only view their own leads
    if (user.role === StaffRole.AGENT && lead.assignedAgentId !== user.id) {
      throw new Error('Access denied: You can only view your assigned leads');
    }

    return lead;
  }

  @Post()
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Create a new lead' })
  async create(@Body() dto: CreateLeadBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.create(
      {
        ...dto,
        assignedAgentId: user.id, // Auto-assign to creator if agent
      },
      user.id,
    );
  }

  @Put(':id')
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Update lead' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const lead = await this.leadsService.findById(id);

    // Agents can only update their own leads
    if (user.role === StaffRole.AGENT && lead.assignedAgentId !== user.id) {
      throw new Error('Access denied: You can only update your assigned leads');
    }

    return this.leadsService.update(id, dto, user.id);
  }

  // ============ INTAKE FORM ============

  @Put(':id/intake-form')
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Update lead intake form' })
  async updateIntakeForm(
    @Param('id') id: string,
    @Body() dto: IntakeFormBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.upsertIntakeForm(id, dto, user.id);
  }

  // ============ LEAD PRODUCTS ============

  @Put(':id/products')
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Set all lead products' })
  async setProducts(
    @Param('id') id: string,
    @Body() dto: SetLeadProductsBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.setLeadProducts(id, dto.products, user.id);
  }

  @Post(':id/products')
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Add product to lead' })
  async addProduct(
    @Param('id') id: string,
    @Body() dto: LeadProductBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.addProduct(id, dto, user.id);
  }

  @Delete(':id/products/:productCode')
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Remove product from lead' })
  async removeProduct(
    @Param('id') id: string,
    @Param('productCode') productCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.removeProduct(id, productCode, user.id);
  }

  // ============ CONVERSION ============

  @Get(':id/validate-conversion')
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Validate if lead can be converted' })
  async validateConversion(@Param('id') id: string) {
    return this.conversionService.validateConversion(id);
  }

  @Post(':id/convert')
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Convert lead to order' })
  async convertToOrder(
    @Param('id') id: string,
    @Body() dto: ConvertLeadBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversionService.convertLead(id, dto, user.id);
  }

  // ============ ADMIN FUNCTIONS ============

  @Post(':id/reassign')
  @AdminOnly()
  @ApiOperation({ summary: 'Reassign lead to another agent (Admin only)' })
  async reassign(
    @Param('id') id: string,
    @Body() dto: ReassignLeadBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.reassign(id, dto.agentId, user.id);
  }
}
