import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrderStatus, StaffRole } from '@prisma/client';
import { OrdersService, UpdateOrderDto } from './orders.service';
import { Roles, AdminOnly, DeliveryOnly } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean } from 'class-validator';

class UpdateOrderBodyDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  orderStatus?: OrderStatus;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsBoolean()
  @IsOptional()
  rto?: boolean;

  @IsString()
  @IsOptional()
  deliveryStaffId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  value?: number;
}

class CancelOrderBodyDto {
  @IsString()
  cancellationReason: string;
}

class AssignDeliveryBodyDto {
  @IsString()
  deliveryStaffId: string;
}

class UpdateTrackingBodyDto {
  @IsString()
  trackingNumber: string;
}

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ============ LIST & SEARCH ============

  @Get()
  @ApiOperation({ summary: 'List orders with filters' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'rto', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') orderStatus?: OrderStatus,
    @Query('country') country?: string,
    @Query('rto') rto?: boolean,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    // Filter based on role
    let salesStaffId: string | undefined;
    let deliveryStaffId: string | undefined;

    if (user.role === StaffRole.AGENT) {
      salesStaffId = user.id;
    } else if (user.role === StaffRole.DELIVERY) {
      deliveryStaffId = user.id;
    }

    return this.ordersService.findMany(
      {
        orderStatus,
        country,
        rto,
        search,
        salesStaffId,
        deliveryStaffId,
      },
      page,
      limit,
    );
  }

  @Get('pipeline-stats')
  @ApiOperation({ summary: 'Get order pipeline statistics' })
  async getPipelineStats(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getPipelineStats(user.id, user.role);
  }

  @Get('my-deliveries')
  @DeliveryOnly()
  @ApiOperation({ summary: 'Get orders assigned to current delivery staff' })
  async getMyDeliveries(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getDeliveryOrders(user.id);
  }

  // ============ SINGLE ORDER ============

  @Get(':orderKey')
  @ApiOperation({ summary: 'Get order by key' })
  async findById(@Param('orderKey') orderKey: string) {
    return this.ordersService.findById(orderKey);
  }

  @Get('em/:emNumber')
  @ApiOperation({ summary: 'Get order by EM number' })
  async findByEmNumber(@Param('emNumber') emNumber: string) {
    return this.ordersService.findByEmNumber(emNumber);
  }

  @Put(':orderKey')
  @ApiOperation({ summary: 'Update order' })
  async update(
    @Param('orderKey') orderKey: string,
    @Body() dto: UpdateOrderBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.update(orderKey, dto, user.id);
  }

  // ============ STATUS ACTIONS ============

  @Post(':orderKey/deliver')
  @ApiOperation({ summary: 'Mark order as delivered' })
  async markDelivered(
    @Param('orderKey') orderKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.markDelivered(orderKey, user.id);
  }

  @Post(':orderKey/cancel')
  @ApiOperation({ summary: 'Cancel order (requires reason)' })
  async cancelOrder(
    @Param('orderKey') orderKey: string,
    @Body() dto: CancelOrderBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.markCancelled(orderKey, dto.cancellationReason, user.id);
  }

  @Post(':orderKey/rto')
  @ApiOperation({ summary: 'Mark order as RTO' })
  async markRto(
    @Param('orderKey') orderKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.markRto(orderKey, user.id);
  }

  // ============ ASSIGNMENT ============

  @Post(':orderKey/assign-delivery')
  @Roles(StaffRole.ADMIN, StaffRole.AGENT)
  @ApiOperation({ summary: 'Assign delivery staff to order' })
  async assignDelivery(
    @Param('orderKey') orderKey: string,
    @Body() dto: AssignDeliveryBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.assignDeliveryStaff(orderKey, dto.deliveryStaffId, user.id);
  }

  // ============ TRACKING ============

  @Put(':orderKey/tracking')
  @ApiOperation({ summary: 'Update tracking number' })
  async updateTracking(
    @Param('orderKey') orderKey: string,
    @Body() dto: UpdateTrackingBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.updateTracking(orderKey, dto.trackingNumber, user.id);
  }
}
