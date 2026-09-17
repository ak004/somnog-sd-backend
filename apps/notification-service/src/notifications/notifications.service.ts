import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma } from '../prisma/prisma-client';
import { Queue } from 'bullmq';
import { rpc } from '@somnog/common';
import { AUTH_CLIENT } from '@somnog/config';
import {
  AUTH_PATTERNS,
  ListNotificationsQueryDto,
  NotificationChannel,
  NotificationStatus,
  paginate,
  PublicUser,
  skipTake,
  UserSummary,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';

export const DELIVERY_QUEUE = 'notification-delivery';

export interface EnqueueInput {
  /** envelope eventId - the idempotency key */
  sourceEventId?: string;
  templateKey: string;
  recipient: string;
  userId?: string | null;
  channel?: NotificationChannel;
  payload: Record<string, unknown>;
  /** preference category; defaults to the template key */
  category?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DELIVERY_QUEUE) private readonly queue: Queue,
    @Inject(AUTH_CLIENT) private readonly authClient: ClientProxy,
  ) {}

  /**
   * Record first, send second.
   *
   * The row is written before any delivery is attempted, so a crash between
   * the two leaves a QUEUED row an admin can see and retry - nothing is
   * silently lost. The unique constraint on (sourceEventId, templateKey,
   * recipient) is what makes a redelivered RabbitMQ message harmless.
   */
  async enqueue(input: EnqueueInput): Promise<string | null> {
    const channel = input.channel ?? NotificationChannel.EMAIL;

    if (
      input.userId &&
      !(await this.isEnabled(
        input.userId,
        channel,
        input.category ?? input.templateKey,
      ))
    ) {
      this.logger.log(
        `Skipped ${input.templateKey} for ${input.recipient}: opted out`,
      );
      return null;
    }

    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: input.userId ?? null,
          recipient: input.recipient,
          channel,
          templateKey: input.templateKey,
          payload: input.payload as Prisma.InputJsonValue,
          sourceEventId: input.sourceEventId ?? null,
          status: NotificationStatus.QUEUED,
        },
      });

      await this.queue.add(
        'deliver',
        { notificationId: notification.id },
        {
          attempts: 5,
          // 10s, 1m, 5m, 30m, 2h - long enough to ride out a mail server
          // being down for a couple of hours.
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 1000,
          removeOnFail: false,
        },
      );

      return notification.id;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        this.logger.warn(
          `Duplicate delivery suppressed for ${input.templateKey} -> ${input.recipient}`,
        );
        return null;
      }
      throw error;
    }
  }

  /** Looks up an email address in the auth service. */
  async resolveUser(userId: string): Promise<PublicUser> {
    return rpc<PublicUser>(this.authClient, AUTH_PATTERNS.FIND_BY_ID, {
      userId,
    });
  }

  /** Batch version, for anything fanning out to a whole attendee list. */
  async resolveUsers(userIds: string[]): Promise<Map<string, UserSummary>> {
    if (userIds.length === 0) return new Map();
    const users = await rpc<UserSummary[]>(
      this.authClient,
      AUTH_PATTERNS.FIND_MANY_BY_IDS,
      { userIds },
    );
    return new Map(users.map((user) => [user.id, user]));
  }

  // --- queries used by the gateway ---------------------------------------

  async listForUser(userId: string, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.channel && { channel: query.channel }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, limit),
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async listAll(query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      ...(query.status && { status: query.status }),
      ...(query.channel && { channel: query.channel }),
      ...(query.q && {
        recipient: { contains: query.q, mode: 'insensitive' as const },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, limit),
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  /** Puts a failed delivery back on the queue. */
  async retry(notificationId: string) {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.QUEUED, lastError: null },
    });

    await this.queue.add(
      'deliver',
      { notificationId: notification.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
    );

    return notification;
  }

  // --- preferences --------------------------------------------------------

  getPreferences(userId: string) {
    return this.prisma.preference.findMany({ where: { userId } });
  }

  updatePreference(
    userId: string,
    channel: NotificationChannel,
    category: string,
    enabled: boolean,
  ) {
    return this.prisma.preference.upsert({
      where: {
        userId_channel_category: { userId, channel, category },
      },
      update: { enabled },
      create: { userId, channel, category, enabled },
    });
  }

  /** Opt-out is explicit: no row means the user has not opted out. */
  private async isEnabled(
    userId: string,
    channel: NotificationChannel,
    category: string,
  ): Promise<boolean> {
    const preference = await this.prisma.preference.findUnique({
      where: { userId_channel_category: { userId, channel, category } },
    });
    return preference?.enabled ?? true;
  }
}
