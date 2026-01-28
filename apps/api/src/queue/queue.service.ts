import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

export interface WebhookJob {
  type: 'whatsapp' | '3cx';
  payload: any;
  attempt?: number;
}

export interface FollowupReminderJob {
  leadId: string;
  agentId: string;
  reminderType: 'followup' | 'stale_lead';
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: IORedis | null = null;
  private webhookQueue: Queue | null = null;
  private reminderQueue: Queue | null = null;
  private webhookWorker: Worker | null = null;
  private reminderWorker: Worker | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL');
    
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured, queues disabled');
      return;
    }

    try {
      this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

      // Webhook processing queue
      this.webhookQueue = new Queue('webhooks', { connection: this.connection });
      
      // Follow-up reminders queue
      this.reminderQueue = new Queue('reminders', { connection: this.connection });

      // Start workers
      this.startWorkers();

      this.logger.log('Queue service initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize queues: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await this.webhookWorker?.close();
    await this.reminderWorker?.close();
    await this.webhookQueue?.close();
    await this.reminderQueue?.close();
    await this.connection?.quit();
  }

  private startWorkers() {
    if (!this.connection) return;

    // Webhook worker
    this.webhookWorker = new Worker(
      'webhooks',
      async (job: Job<WebhookJob>) => {
        this.logger.debug(`Processing webhook job ${job.id}`);
        // Webhook processing is handled by WhatsappWebhookService
        // This is for retries and async processing
      },
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.webhookWorker.on('failed', (job, error) => {
      this.logger.error(`Webhook job ${job?.id} failed: ${error.message}`);
    });

    // Reminder worker
    this.reminderWorker = new Worker(
      'reminders',
      async (job: Job<FollowupReminderJob>) => {
        this.logger.debug(`Processing reminder job ${job.id}`);
        // TODO: Implement reminder notifications
        // - Check if lead is still in follow-up status
        // - Send notification to agent
      },
      {
        connection: this.connection,
        concurrency: 3,
      },
    );

    this.reminderWorker.on('failed', (job, error) => {
      this.logger.error(`Reminder job ${job?.id} failed: ${error.message}`);
    });
  }

  /**
   * Queue a webhook for processing
   */
  async queueWebhook(type: 'whatsapp' | '3cx', payload: any) {
    if (!this.webhookQueue) return null;

    return this.webhookQueue.add(
      'process-webhook',
      { type, payload },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }

  /**
   * Schedule a follow-up reminder
   */
  async scheduleFollowupReminder(leadId: string, agentId: string, delayMs: number) {
    if (!this.reminderQueue) return null;

    return this.reminderQueue.add(
      'followup-reminder',
      { leadId, agentId, reminderType: 'followup' },
      {
        delay: delayMs,
        attempts: 2,
      },
    );
  }

  /**
   * Get queue stats
   */
  async getStats() {
    if (!this.webhookQueue || !this.reminderQueue) {
      return { enabled: false };
    }

    const [webhookCounts, reminderCounts] = await Promise.all([
      this.webhookQueue.getJobCounts(),
      this.reminderQueue.getJobCounts(),
    ]);

    return {
      enabled: true,
      webhooks: webhookCounts,
      reminders: reminderCounts,
    };
  }
}
