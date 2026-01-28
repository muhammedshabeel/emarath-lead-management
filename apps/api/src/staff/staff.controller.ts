import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';
import { StaffService } from './staff.service';
import { AdminOnly } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { IsString, IsOptional, IsEnum, IsBoolean, IsEmail } from 'class-validator';

class CreateStaffBodyDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsEnum(StaffRole) role: StaffRole;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() cx3Extension?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

class UpdateStaffBodyDto {
  @IsString() @IsOptional() name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsEnum(StaffRole) @IsOptional() role?: StaffRole;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() cx3Extension?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @AdminOnly()
  @ApiOperation({ summary: 'List all staff' })
  async findAll(
    @Query('role') role?: StaffRole,
    @Query('active') active?: boolean,
  ) {
    return this.staffService.findAll(role, active);
  }

  @Get('agents')
  @ApiOperation({ summary: 'List agents (for assignment dropdowns)' })
  async findAgents(@Query('country') country?: string) {
    return this.staffService.findAgents(country);
  }

  @Get('workload')
  @AdminOnly()
  @ApiOperation({ summary: 'Get agent workload stats' })
  async getWorkloadStats() {
    return this.staffService.getWorkloadStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff by ID' })
  async findById(@Param('id') id: string) {
    return this.staffService.findById(id);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create staff member' })
  async create(@Body() dto: CreateStaffBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.create(dto, user.id);
  }

  @Put(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update staff member' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.update(id, dto, user.id);
  }

  @Post(':id/deactivate')
  @AdminOnly()
  @ApiOperation({ summary: 'Deactivate staff member' })
  async deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.deactivate(id, user.id);
  }

  @Post(':id/activate')
  @AdminOnly()
  @ApiOperation({ summary: 'Activate staff member' })
  async activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.activate(id, user.id);
  }
}
