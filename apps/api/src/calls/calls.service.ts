import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CallStatus } from '@prisma/client';
import { normalizePhoneKey } from '../common/utils/phone.util';

interface InitiateCallDto {
  leadId: string;
  phoneKey?: string; // Optional override
}

interface CxCallResponse {
  callId: string;
  status: string;
}

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly cxBaseUrl: string;
  private readonly cxAuth: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.cxBaseUrl = this.configService.get('CX3_BASE_URL') || '';
    this.cxAuth = this.configService.get('CX3_AUTH') || '';
  }

  /**
   * Initiate click-to-call via 3CX
   * Agent's extension calls the customer
   */
  async initiateCall(dto: InitiateCallDto, agentId: string) {
    // Get agent details
    const agent = await this.prisma.staff.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new BadRequestException('Agent not found');
    }

    if (!agent.cx3Extension) {
      throw new BadRequestException(
        'Agent does not have a 3CX extension configured. Please contact admin.',
      );
    }

    // Get lead and phone
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
    });

    if (!lead) {
      throw new BadRequestException('Lead not found');
    }

    const phoneKey = dto.phoneKey
      ? normalizePhoneKey(dto.phoneKey)
      : lead.phoneKey;

    if (!phoneKey) {
      throw new BadRequestException('No phone number available for this lead');
    }

    // Create call record
    const call = await this.prisma.call.create({
      data: {
        leadId: dto.leadId,
        agentId,
        phoneKey,
        status: CallStatus.INITIATED,
      },
    });

    // Trigger 3CX call
    try {
      const cxResponse = await this.trigger3cxCall(
        agent.cx3Extension,
        phoneKey,
      );

      // Update with 3CX call ID
      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          cxCallId: cxResponse?.callId,
          status: CallStatus.RINGING,
        },
      });

      this.logger.log(
        `Call initiated: ${call.id} from ext ${agent.cx3Extension} to ${phoneKey}`,
      );

      return {
        callId: call.id,
        status: 'ringing',
        cxCallId: cxResponse?.callId,
        extension: agent.cx3Extension,
        phoneKey,
      };
    } catch (error) {
      // Update call as failed
      await this.prisma.call.update({
        where: { id: call.id },
        data: { status: CallStatus.FAILED },
      });

      this.logger.error(`Call initiation failed: ${error.message}`);
      throw new BadRequestException(`Failed to initiate call: ${error.message}`);
    }
  }

  /**
   * Trigger call via 3CX API
   */
  private async trigger3cxCall(
    extension: string,
    destination: string,
  ): Promise<CxCallResponse | null> {
    if (!this.cxBaseUrl || !this.cxAuth) {
      this.logger.warn('3CX not configured, simulating call');
      return { callId: `sim_${Date.now()}`, status: 'simulated' };
    }

    try {
      // 3CX Call Control API - adjust based on your 3CX version/setup
      const response = await fetch(`${this.cxBaseUrl}/api/v1/callcontrol/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cxAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extension,
          destination,
          // Additional 3CX params as needed
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`3CX API error: ${error}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error(`3CX API call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle 3CX webhook callback for call status updates
   */
  async handleCallStatusUpdate(cxCallId: string, status: string, endedAt?: Date) {
    const call = await this.prisma.call.findFirst({
      where: { cxCallId },
    });

    if (!call) {
      this.logger.warn(`Unknown call ID from 3CX: ${cxCallId}`);
      return;
    }

    let callStatus: CallStatus;
    switch (status.toLowerCase()) {
      case 'ringing':
        callStatus = CallStatus.RINGING;
        break;
      case 'answered':
      case 'connected':
        callStatus = CallStatus.ANSWERED;
        break;
      case 'ended':
      case 'completed':
        callStatus = CallStatus.ENDED;
        break;
      case 'failed':
      case 'busy':
      case 'no_answer':
        callStatus = CallStatus.FAILED;
        break;
      default:
        callStatus = call.status;
    }

    await this.prisma.call.update({
      where: { id: call.id },
      data: {
        status: callStatus,
        endedAt: endedAt || (callStatus === CallStatus.ENDED ? new Date() : undefined),
      },
    });

    this.logger.log(`Call ${call.id} status updated: ${callStatus}`);
  }

  /**
   * Get call history for a lead
   */
  async getCallHistory(leadId: string) {
    return this.prisma.call.findMany({
      where: { leadId },
      include: {
        agent: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Get agent's recent calls
   */
  async getAgentCalls(agentId: string, limit = 50) {
    return this.prisma.call.findMany({
      where: { agentId },
      include: {
        lead: { select: { id: true, leadNumber: true, phoneKey: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
