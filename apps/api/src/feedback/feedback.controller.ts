import { Controller, Get, Post, Put, Body, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CSOnly } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { IsString, IsOptional } from 'class-validator';

class CreateFeedbackBodyDto {
  @IsString() orderKey: string;
  @IsString() @IsOptional() feedback?: string;
  @IsString() @IsOptional() googleReviewLink?: string;
  @IsString() @IsOptional() recommendedProduct?: string;
  @IsString() @IsOptional() notes?: string;
}

class UpdateFeedbackBodyDto {
  @IsString() @IsOptional() feedback?: string;
  @IsString() @IsOptional() googleReviewLink?: string;
  @IsString() @IsOptional() recommendedProduct?: string;
  @IsString() @IsOptional() notes?: string;
}

@ApiTags('Feedback')
@ApiBearerAuth()
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @CSOnly()
  @ApiOperation({ summary: 'List all customer feedback' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.feedbackService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feedback by ID' })
  async findById(@Param('id') id: string) {
    return this.feedbackService.findById(id);
  }

  @Get('order/:orderKey')
  @ApiOperation({ summary: 'Get feedback for order' })
  async findByOrder(@Param('orderKey') orderKey: string) {
    return this.feedbackService.findByOrder(orderKey);
  }

  @Post()
  @CSOnly()
  @ApiOperation({ summary: 'Create feedback' })
  async create(@Body() dto: CreateFeedbackBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.feedbackService.create(dto, user.id);
  }

  @Put(':id')
  @CSOnly()
  @ApiOperation({ summary: 'Update feedback' })
  async update(@Param('id') id: string, @Body() dto: UpdateFeedbackBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.feedbackService.update(id, dto, user.id);
  }
}
