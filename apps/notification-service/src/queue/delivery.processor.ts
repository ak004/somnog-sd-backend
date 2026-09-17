import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationChannel, NotificationStatus } from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from '../templates/templates.service';
import { EmailChannel } from '../channels/email.channel';
import { NotificationChannelAdapter } from '../channels/channel.interface';
import { DELIVERY_QUEUE } from '../notifications/notifications.service';

interface DeliveryJob {
  notificationId: string;
}

/**
 * Where a notification actually gets sent.
 *
 * Separating this from the RabbitMQ consumer is what makes retries possible:
 * the consumer's job is to record the fact durably and return, and this worker
 * keeps trying the slow, failure-prone part with backoff.
 */
@Processor(DELIVERY_QUEUE)
export class DeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DeliveryProcessor.name);
  private readonly channels: Record<string, NotificationChannelAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    emailChannel: EmailChannel,
  ) {
    super();
    // Add an SmsChannel here and it becomes routable with no other change.
    this.channels = { EMAIL: emailChannel };
  }

  async process(job: Job<DeliveryJob>): Promise<void> {
    const { notificationId } = job.data;

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} no longer exists`);
      return;
    }
    if (notification.status === NotificationStatus.SENT) {
      return; // already delivered by an earlier attempt
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.SENDING,
        attempts: { increment: 1 },
      },
    });

    try {
      const { subject, body } = await this.templates.render(
        notification.templateKey,
        notification.payload as Record<string, unknown>,
        notification.channel as NotificationChannel,
      );

      const channel = this.channels[notification.channel];
      if (!channel) {
        throw new Error(`No adapter for channel ${notification.channel}`);
      }

      await channel.send({
        recipient: notification.recipient,
        subject,
        body,
      });

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          subject,
          body,
          sentAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: isLastAttempt
            ? NotificationStatus.FAILED
            : NotificationStatus.QUEUED,
          lastError: message,
        },
      });

      this.logger.error(
        `Attempt ${job.attemptsMade + 1} failed for ${notificationId}: ${message}`,
      );

      // Rethrow so BullMQ schedules the next attempt with backoff.
      throw error;
    }
  }
}
