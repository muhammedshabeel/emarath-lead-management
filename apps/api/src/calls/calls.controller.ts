import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { AgentOrAdmin } from '../auth/decorators/roles.decorator';
import { IsString, IsOptional } from 'class-validator';

class InitiateCallDto {
  @IsString()
  leadId: string;

  @IsString()
  @IsOptional()
  phoneKey?: string;
}

class CallStatusWebhookDto {
  @IsString()
  callId: string;

  @IsString()
  status: string;

  @IsString()
  @IsOptional()
  endedAt?: string;
}

@ApiTags('Calls')
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post('initiate')
  @ApiBearerAuth()
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Initiate click-to-call via 3CX' })
  async initiateCall(
    @Body() dto: InitiateCallDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.callsService.initiateCall(dto, user.id);
  }

  @Public()
  @Post('webhook/status')
  @ApiOperation({ summary: '3CX callback for call status updates' })
  async handleStatusWebhook(@Body() dto: CallStatusWebhookDto) {
    await this.callsService.handleCallStatusUpdate(
      dto.callId,
      dto.status,
      dto.endedAt ? new Date(dto.endedAt) : undefined,
    );
    return { success: true };
  }

  @Get('lead/:leadId')
  @ApiBearerAuth()
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Get call history for a lead' })
  async getLeadCalls(@Param('leadId') leadId: string) {
    return this.callsService.getCallHistory(leadId);
  }

  @Get('my-calls')
  @ApiBearerAuth()
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Get current agent call history' })
  async getMyCalls(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
  ) {
    return this.callsService.getAgentCalls(user.id, limit);
  }
}
