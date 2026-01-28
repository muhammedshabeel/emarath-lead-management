import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MessageDirection } from '@prisma/client';
import { normalizePhoneKey } from '../common/utils/phone.util';

interface SendMessageOptions {
  phoneKey: string;
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: any[];
}

interface WhatsappApiResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly apiUrl = 'https://graph.facebook.com/v18.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN') || '';
    this.phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID') || '';
  }

  /**
   * Get conversations for an agent (inbox)
   */
  async getInbox(agentId: string, limit = 50) {
    return this.prisma.whatsappConversation.findMany({
      where: { assignedAgentId: agentId },
      include: {
        customer: { select: { id: true, name: true } },
        activeLead: { select: { id: true, leadNumber: true, status: true } },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { unreadCount: 'desc' },
        { lastMessageAt: 'desc' },
      ],
      take: limit,
    });
  }

  /**
   * Get conversation by ID with messages
   */
  async getConversation(conversationId: string, messageLimit = 100) {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        activeLead: {
          include: {
            intakeForm: true,
            leadProducts: { include: { product: true } },
          },
        },
        assignedAgent: { select: { id: true, name: true } },
        messages: {
          orderBy: { timestamp: 'asc' },
          take: messageLimit,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    return conversation;
  }

  /**
   * Get conversation by phone key
   */
  async getConversationByPhone(phoneKey: string) {
    const normalizedPhone = normalizePhoneKey(phoneKey);
    
    return this.prisma.whatsappConversation.findUnique({
      where: { phoneKey: normalizedPhone },
      include: {
        customer: true,
        activeLead: true,
        assignedAgent: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get or create conversation
   */
  async getOrCreateConversation(phoneKey: string, agentId?: string) {
    const normalizedPhone = normalizePhoneKey(phoneKey);
    
    let conversation = await this.prisma.whatsappConversation.findUnique({
      where: { phoneKey: normalizedPhone },
    });

    if (!conversation) {
      // Check if customer exists
      const customer = await this.prisma.customer.findUnique({
        where: { phoneKey: normalizedPhone },
      });

      conversation = await this.prisma.whatsappConversation.create({
        data: {
          phoneKey: normalizedPhone,
          customerId: customer?.id,
          assignedAgentId: agentId,
        },
      });

      this.logger.log(`Created new conversation for ${normalizedPhone}`);
    }

    return conversation;
  }

  /**
   * Store inbound message (idempotent via wa_message_id)
   */
  async storeInboundMessage(
    conversationId: string,
    waMessageId: string,
    text: string | null,
    mediaUrl: string | null,
    timestamp: Date,
    rawPayload: any,
  ) {
    // Check for duplicate
    const existing = await this.prisma.whatsappMessage.findUnique({
      where: { waMessageId },
    });

    if (existing) {
      this.logger.debug(`Duplicate message ${waMessageId}, skipping`);
      return existing;
    }

    const message = await this.prisma.whatsappMessage.create({
      data: {
        conversationId,
        waMessageId,
        direction: MessageDirection.INBOUND,
        text,
        mediaUrl,
        timestamp,
        rawPayload,
      },
    });

    // Update conversation
    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: timestamp,
        unreadCount: { increment: 1 },
      },
    });

    return message;
  }

  /**
   * Send outbound message
   */
  async sendMessage(options: SendMessageOptions, agentId?: string): Promise<string> {
    const normalizedPhone = normalizePhoneKey(options.phoneKey);
    
    // Get or create conversation
    const conversation = await this.getOrCreateConversation(normalizedPhone, agentId);

    // Determine if within 24h window
    const lastInbound = await this.prisma.whatsappMessage.findFirst({
      where: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
      },
      orderBy: { timestamp: 'desc' },
    });

    const now = new Date();
    const isWithinWindow = lastInbound && 
      (now.getTime() - lastInbound.timestamp.getTime()) < 24 * 60 * 60 * 1000;

    let messagePayload: any;

    if (options.text && isWithinWindow) {
      // Send regular text message
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedPhone,
        type: 'text',
        text: { body: options.text },
      };
    } else if (options.templateName) {
      // Send template message
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: options.templateName,
          language: { code: options.templateLanguage || 'en' },
          components: options.templateComponents || [],
        },
      };
    } else if (options.text && !isWithinWindow) {
      throw new Error(
        'Cannot send text message outside 24h window. Use a template message instead.',
      );
    } else {
      throw new Error('Either text (within 24h) or templateName is required');
    }

    // Send to WhatsApp API
    const response = await this.sendToWhatsappApi(messagePayload);

    // Store outbound message
    const waMessageId = response.messages[0].id;
    await this.prisma.whatsappMessage.create({
      data: {
        conversationId: conversation.id,
        waMessageId,
        direction: MessageDirection.OUTBOUND,
        text: options.text,
        timestamp: now,
        rawPayload: messagePayload,
      },
    });

    // Update conversation
    await this.prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });

    this.logger.log(`Sent message to ${normalizedPhone}: ${waMessageId}`);
    return waMessageId;
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: string) {
    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  /**
   * Link conversation to lead
   */
  async linkToLead(conversationId: string, leadId: string) {
    await this.prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { activeLeadId: leadId },
    });
  }

  /**
   * Send request to WhatsApp Cloud API
   */
  private async sendToWhatsappApi(payload: any): Promise<WhatsappApiResponse> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn('WhatsApp credentials not configured, simulating send');
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: payload.to, wa_id: payload.to }],
        messages: [{ id: `sim_${Date.now()}` }],
      };
    }

    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`WhatsApp API error: ${error}`);
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    return response.json();
  }
}
