import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { LeadsService } from '../leads/leads.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

interface WhatsappWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string; caption?: string };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

type WhatsappMessage = NonNullable<WhatsappWebhookPayload['entry'][0]['changes'][0]['value']['messages']>[0];

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private leadsService: LeadsService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }
    
    this.logger.warn('Webhook verification failed');
    return null;
  }

  async processWebhook(payload: WhatsappWebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      return;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          const value = change.value;
          
          if (value.messages) {
            for (const message of value.messages) {
              const contact = value.contacts?.[0];
              await this.processInboundMessage(message, contact);
            }
          }
          
          if (value.statuses) {
            for (const status of value.statuses) {
              await this.processStatusUpdate(status);
            }
          }
        }
      }
    }
  }

  private async processInboundMessage(
    message: WhatsappMessage,
    contact?: { profile: { name: string }; wa_id: string },
  ): Promise<void> {
    const phoneKey = this.normalizePhoneKey(message.from);

    this.logger.log(`Processing inbound message from ${phoneKey}`);

    const existingMessage = await this.prisma.whatsappMessage.findUnique({
      where: { waMessageId: message.id },
    });

    if (existingMessage) {
      this.logger.log(`Duplicate message ${message.id}, skipping`);
      return;
    }

    const conversation = await this.whatsappService.getOrCreateConversation(phoneKey);

    let lead = await this.prisma.lead.findFirst({
      where: {
        phoneKey,
        status: { notIn: ['WON', 'LOST'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lead) {
      lead = await this.leadsService.create({
        phoneKey,
        source: 'WhatsApp',
        country: this.detectCountryFromPhone(phoneKey),
      });

      const assignedAgent = await this.assignAgentRoundRobin(lead.country);
      if (assignedAgent) {
        lead = await this.leadsService.update(lead.id, {
          assignedAgentId: assignedAgent.id,
        });
        
        await this.prisma.whatsappConversation.update({
          where: { id: conversation.id },
          data: { assignedAgentId: assignedAgent.id },
        });
      }
    }

    if (conversation.activeLeadId !== lead.id) {
      await this.whatsappService.linkToLead(conversation.id, lead.id);
    }

    const storedMessage = await this.whatsappService.storeInboundMessage(
      conversation.id,
      message.id,
      this.extractMessageText(message),
      this.extractMediaUrl(message),
      new Date(parseInt(message.timestamp) * 1000),
      message as any,
    );

    const updatedConversation = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversation.id },
    });

    if (updatedConversation?.assignedAgentId) {
      this.realtimeGateway.sendToAgent(updatedConversation.assignedAgentId, 'new_message', {
        conversationId: conversation.id,
        message: storedMessage,
        lead: {
          id: lead.id,
          status: lead.status,
          phoneKey: lead.phoneKey,
        },
      });

      this.realtimeGateway.sendToAgent(updatedConversation.assignedAgentId, 'inbox_update', {
        conversationId: conversation.id,
        unreadCount: (updatedConversation.unreadCount || 0),
        lastMessage: this.extractMessageText(message),
        lastMessageAt: new Date(),
      });
    }

    this.logger.log(`Message stored for conversation ${conversation.id}`);
  }

  private async processStatusUpdate(status: {
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
  }): Promise<void> {
    this.logger.log(`Message ${status.id} status: ${status.status}`);
    
    await this.prisma.whatsappMessage.updateMany({
      where: { waMessageId: status.id },
      data: { 
        rawPayload: {
          status: status.status,
          statusTimestamp: status.timestamp,
        },
      },
    });
  }

  private normalizePhoneKey(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  private detectCountryFromPhone(phoneKey: string): string {
    if (phoneKey.startsWith('+971')) return 'UAE';
    if (phoneKey.startsWith('+966')) return 'KSA';
    if (phoneKey.startsWith('+974')) return 'Qatar';
    if (phoneKey.startsWith('+973')) return 'Bahrain';
    if (phoneKey.startsWith('+968')) return 'Oman';
    if (phoneKey.startsWith('+965')) return 'Kuwait';
    return 'UAE';
  }

  private async assignAgentRoundRobin(country: string | null): Promise<{ id: string } | null> {
    const agents = await this.prisma.staff.findMany({
      where: {
        role: 'AGENT',
        active: true,
        ...(country && { country }),
      },
      orderBy: { id: 'asc' },
    });

    if (agents.length === 0) {
      const anyAgent = await this.prisma.staff.findFirst({
        where: { role: 'AGENT', active: true },
      });
      return anyAgent;
    }

    const agentLeadCounts = await Promise.all(
      agents.map(async (agent) => {
        const count = await this.prisma.lead.count({
          where: {
            assignedAgentId: agent.id,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        });
        return { agent, count };
      }),
    );

    agentLeadCounts.sort((a, b) => a.count - b.count);
    return agentLeadCounts[0]?.agent || null;
  }

  private extractMessageText(message: WhatsappMessage): string | null {
    if (message.text) return message.text.body;
    if (message.image?.caption) return message.image.caption;
    if (message.video?.caption) return message.video.caption;
    return null;
  }

  private extractMediaUrl(message: WhatsappMessage): string | null {
    if (message.image) return message.image.id;
    if (message.audio) return message.audio.id;
    if (message.video) return message.video.id;
    if (message.document) return message.document.id;
    return null;
  }
}
