import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { DeliveryOnly, AgentOrAdmin } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { IsString, IsOptional, IsDateString } from 'class-validator';

class CreateFollowupBodyDto {
  @IsString() orderKey: string;
  @IsString() @IsOptional() salesInstructions?: string;
  @IsString() @IsOptional() csUpdate?: string;
  @IsDateString() @IsOptional() deliveredCancelledDate?: string;
}

class UpdateFollowupBodyDto {
  @IsString() @IsOptional() salesInstructions?: string;
  @IsString() @IsOptional() csUpdate?: string;
  @IsDateString() @IsOptional() deliveredCancelledDate?: string;
}

@ApiTags('Delivery')
@ApiBearerAuth()
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('followups')
  @ApiOperation({ summary: 'List all delivery followups' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.deliveryService.findAll(page, limit);
  }

  @Get('followups/my')
  @DeliveryOnly()
  @ApiOperation({ summary: 'Get my delivery followups' })
  async getMyFollowups(@CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.findByDeliveryStaff(user.id);
  }

  @Get('followups/:id')
  @ApiOperation({ summary: 'Get followup by ID' })
  async findById(@Param('id') id: string) {
    return this.deliveryService.findById(id);
  }

  @Get('followups/order/:orderKey')
  @ApiOperation({ summary: 'Get followups for order' })
  async findByOrder(@Param('orderKey') orderKey: string) {
    return this.deliveryService.findByOrder(orderKey);
  }

  @Post('followups')
  @ApiOperation({ summary: 'Create delivery followup' })
  async create(@Body() dto: CreateFollowupBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.createFollowup(
      {
        ...dto,
        deliveredCancelledDate: dto.deliveredCancelledDate 
          ? new Date(dto.deliveredCancelledDate) 
          : undefined,
      },
      user.id,
      user.role,
    );
  }

  @Put('followups/:id')
  @ApiOperation({ summary: 'Update delivery followup' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFollowupBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deliveryService.update(
      id,
      {
        ...dto,
        deliveredCancelledDate: dto.deliveredCancelledDate 
          ? new Date(dto.deliveredCancelledDate) 
          : undefined,
      },
      user.id,
    );
  }
}
