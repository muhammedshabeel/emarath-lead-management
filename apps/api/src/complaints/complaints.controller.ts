import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComplaintsService, CreateComplaintDto, UpdateComplaintDto } from './complaints.service';
import { CSOnly } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { IsString, IsOptional } from 'class-validator';

class CreateComplaintBodyDto {
  @IsString()
  orderKey: string;

  @IsString()
  complaint: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  notes1?: string;

  @IsString()
  @IsOptional()
  notes2?: string;
}

class UpdateComplaintBodyDto {
  @IsString()
  @IsOptional()
  complaint?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  notes1?: string;

  @IsString()
  @IsOptional()
  notes2?: string;
}

@ApiTags('Complaints')
@ApiBearerAuth()
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  @CSOnly()
  @ApiOperation({ summary: 'List all complaints' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('department') department?: string,
  ) {
    return this.complaintsService.findAll(page, limit, department);
  }

  @Get(':id')
  @CSOnly()
  @ApiOperation({ summary: 'Get complaint by ID' })
  async findById(@Param('id') id: string) {
    return this.complaintsService.findById(id);
  }

  @Get('order/:orderKey')
  @CSOnly()
  @ApiOperation({ summary: 'Get complaints for an order' })
  async findByOrder(@Param('orderKey') orderKey: string) {
    return this.complaintsService.findByOrder(orderKey);
  }

  @Post()
  @CSOnly()
  @ApiOperation({ summary: 'Create complaint' })
  async create(
    @Body() dto: CreateComplaintBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.complaintsService.create(dto, user.id);
  }

  @Put(':id')
  @CSOnly()
  @ApiOperation({ summary: 'Update complaint' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.complaintsService.update(id, dto, user.id);
  }
}
