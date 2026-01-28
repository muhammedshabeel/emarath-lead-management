import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffRole } from '@prisma/client';

@Injectable()
export class LeadAssignmentService {
  private readonly logger = new Logger(LeadAssignmentService.name);
  
  // Track last assigned agent per country for round-robin
  private lastAssignedIndex: Map<string, number> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get next available agent for assignment using round-robin
   * Priority: Agents in the same country, then fallback to Admin
   */
  async getNextAgent(country?: string): Promise<string | null> {
    // Get all active agents (optionally filtered by country)
    const agents = await this.prisma.staff.findMany({
      where: {
        role: StaffRole.AGENT,
        active: true,
        ...(country ? { country } : {}),
      },
      orderBy: { name: 'asc' },
    });

    if (agents.length > 0) {
      // Round-robin among agents
      const key = country || 'global';
      const lastIndex = this.lastAssignedIndex.get(key) ?? -1;
      const nextIndex = (lastIndex + 1) % agents.length;
      this.lastAssignedIndex.set(key, nextIndex);
      
      this.logger.log(
        `Assigning to agent ${agents[nextIndex].name} (index ${nextIndex}) for country ${country || 'any'}`,
      );
      
      return agents[nextIndex].id;
    }

    // Fallback: Get any active agent globally
    if (country) {
      const globalAgents = await this.prisma.staff.findMany({
        where: {
          role: StaffRole.AGENT,
          active: true,
        },
        orderBy: { name: 'asc' },
      });

      if (globalAgents.length > 0) {
        const lastIndex = this.lastAssignedIndex.get('global') ?? -1;
        const nextIndex = (lastIndex + 1) % globalAgents.length;
        this.lastAssignedIndex.set('global', nextIndex);
        
        this.logger.log(
          `No agents for country ${country}, fallback to global agent ${globalAgents[nextIndex].name}`,
        );
        
        return globalAgents[nextIndex].id;
      }
    }

    // Final fallback: Admin
    const admin = await this.prisma.staff.findFirst({
      where: {
        role: StaffRole.ADMIN,
        active: true,
      },
    });

    if (admin) {
      this.logger.warn(`No agents available, falling back to admin ${admin.name}`);
      return admin.id;
    }

    this.logger.error('No agents or admins available for assignment!');
    return null;
  }

  /**
   * Get workload stats per agent (for intelligent assignment)
   */
  async getAgentWorkloads(country?: string) {
    const agents = await this.prisma.staff.findMany({
      where: {
        role: StaffRole.AGENT,
        active: true,
        ...(country ? { country } : {}),
      },
      include: {
        _count: {
          select: {
            assignedLeads: {
              where: {
                status: { notIn: ['WON', 'LOST'] },
              },
            },
          },
        },
      },
    });

    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      country: agent.country,
      activeLeadCount: agent._count.assignedLeads,
    }));
  }

  /**
   * Get least loaded agent (alternative to round-robin)
   */
  async getLeastLoadedAgent(country?: string): Promise<string | null> {
    const workloads = await this.getAgentWorkloads(country);
    
    if (workloads.length === 0) {
      return this.getNextAgent(country); // Fallback to regular logic
    }

    // Sort by workload ascending
    workloads.sort((a, b) => a.activeLeadCount - b.activeLeadCount);
    
    this.logger.log(
      `Assigning to least loaded agent ${workloads[0].name} with ${workloads[0].activeLeadCount} active leads`,
    );
    
    return workloads[0].id;
  }
}
