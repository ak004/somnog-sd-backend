import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { publish } from '@somnog/common';
import { EVENT_BUS } from '@somnog/config';
import {
  DOMAIN_EVENTS,
  EventStatus,
  RegistrationStatus,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The one scheduled job in the system: 24-hour reminders.
 *
 * It does not send anything. It publishes a fact - "this event is due a
 * reminder" - and the notification service decides what that means. Keeping
 * the scheduler here and the sending there is the same separation as
 * everywhere else.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly bus: ClientProxy,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async emitDueReminders(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        startsAt: { gte: windowStart, lte: windowEnd },
      },
      include: {
        registrations: {
          where: { status: RegistrationStatus.CONFIRMED },
          select: { id: true, userId: true },
        },
      },
    });

    for (const event of events) {
      if (event.registrations.length === 0) continue;

      publish(this.bus, DOMAIN_EVENTS.EVENT_REMINDER_DUE, {
        eventId: event.id,
        title: event.title,
        startsAt: event.startsAt.toISOString(),
        venue: event.venue,
        recipients: event.registrations.map((r) => ({
          userId: r.userId,
          registrationId: r.id,
        })),
      });

      this.logger.log(
        `Reminder due for "${event.title}" (${event.registrations.length} attendees)`,
      );
    }
  }
}
