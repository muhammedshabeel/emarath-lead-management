import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { AgentOrAdmin } from '../auth/decorators/roles.decorator';
import { IsString, IsOptional, IsArray } from 'class-validator';

class SendMessageDto {
  @IsString()
  phoneKey: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  templateName?: string;

  @IsString()
  @IsOptional()
  templateLanguage?: string;

  @IsArray()
  @IsOptional()
  templateComponents?: any[];
}

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly webhookService: WhatsappWebhookService,
  ) {}

  // ============ WEBHOOK ENDPOINTS ============

  @Public()
  @Get('webhook')
  @ApiOperation({ summary: 'WhatsApp webhook verification (Meta)' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const result = this.webhookService.verifyWebhook(mode, token, challenge);
    
    if (result) {
      return res.status(200).send(result);
    }
    
    return res.status(403).send('Verification failed');
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'WhatsApp webhook receiver (Meta)' })
  async receiveWebhook(
    @Body() body: any,
    @Res() res: Response,
  ) {
    // Always respond quickly to Meta
    res.status(200).send('OK');

    // Process asynchronously
    try {
      await this.webhookService.processWebhook(body);
    } catch (error) {
      console.error('Webhook processing error:', error);
    }
  }

  // ============ INBOX ENDPOINTS ============

  @Get('inbox')
  @ApiBearerAuth()
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Get WhatsApp inbox for current agent' })
  async getInbox(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsappService.getInbox(user.id);
  }

  @Get('conversations/:id')
  @ApiBearerAuth()
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Get conversation with messages' })
  async getConversation(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.whatsappService.getConversation(id, limit);
  }

  @Post('conversations/:id/read')
  @ApiBearerAuth()
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Mark conversation as read' })
  async markAsRead(@Param('id') id: string) {
    await this.whatsappService.markAsRead(id);
    return { success: true };
  }

  // ============ SEND MESSAGE ============

  @Post('send')
  @ApiBearerAuth()
  @AgentOrAdmin()
  @ApiOperation({ summary: 'Send WhatsApp message' })
  async sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const messageId = await this.whatsappService.sendMessage(dto, user.id);
    return { success: true, messageId };
  }
}
