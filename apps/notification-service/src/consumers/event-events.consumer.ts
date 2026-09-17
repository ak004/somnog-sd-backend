import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  DOMAIN_EVENTS,
  EventCancelledPayload,
  EventPublishedPayload,
  EventReminderDuePayload,
  Message,
  RegistrationCancelledPayload,
  RegistrationConfirmedPayload,
  RegistrationRejectedPayload,
  RegistrationWaitlistedPayload,
  TEMPLATE_KEYS,
  unwrap,
} from '@somnog/contracts';
import { NotificationsService } from '../notifications/notifications.service';

@Controller()
export class EventEventsConsumer {
  private readonly logger = new Logger(EventEventsConsumer.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.get<string>('APP_WEB_URL', 'http://localhost:4200');
  }

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Africa/Mogadishu',
    });
  }

  /**
   * The events service published userId, not an email address - it does not
   * have one and should not. So this consumer asks the auth service. That is
   * an RPC call inside an event handler, and it is the right shape: the
   * publisher is not waiting for any of it.
   */
  @EventPattern(DOMAIN_EVENTS.REGISTRATION_CONFIRMED)
  async onRegistrationConfirmed(
    @Payload() message: Message<RegistrationConfirmedPayload>,
  ) {
    const data = unwrap(message);
    const user = await this.notifications.resolveUser(data.userId);

    this.logger.log(`registration.confirmed -> ${user.email}`);

    await this.notifications.enqueue({
      sourceEventId: message.eventId,
      templateKey: TEMPLATE_KEYS.REGISTRATION_TICKET,
      recipient: user.email,
      userId: user.id,
      payload: {
        firstName: user.firstName,
        eventTitle: data.eventTitle,
        sessionTitle: data.sessionTitle,
        ticketCode: data.ticketCode,
        eventStartsAt: this.formatDate(data.eventStartsAt),
        venue: data.venue,
      },
    });
  }

  @EventPattern(DOMAIN_EVENTS.REGISTRATION_WAITLISTED)
  async onRegistrationWaitlisted(
    @Payload() message: Message<RegistrationWaitlistedPayload>,
  ) {
    const data = unwrap(message);
    const user = await this.notifications.resolveUser(data.userId);

    await this.notifications.enqueue({
      sourceEventId: message.eventId,
      templateKey: TEMPLATE_KEYS.REGISTRATION_WAITLISTED,
      recipient: user.email,
      userId: user.id,
      payload: {
        firstName: user.firstName,
        eventTitle: data.eventTitle,
        position: data.position,
      },
    });
  }

  @EventPattern(DOMAIN_EVENTS.REGISTRATION_CANCELLED)
  async onRegistrationCancelled(
    @Payload() message: Message<RegistrationCancelledPayload>,
  ) {
    const data = unwrap(message);
    const user = await this.notifications.resolveUser(data.userId);

    await this.notifications.enqueue({
      sourceEventId: message.eventId,
      templateKey: TEMPLATE_KEYS.REGISTRATION_CANCELLED,
      recipient: user.email,
      userId: user.id,
      payload: { firstName: user.firstName, eventTitle: data.eventTitle },
    });
  }

  @EventPattern(DOMAIN_EVENTS.REGISTRATION_REJECTED)
  async onRegistrationRejected(
    @Payload() message: Message<RegistrationRejectedPayload>,
  ) {
    const data = unwrap(message);
    const user = await this.notifications.resolveUser(data.userId);

    await this.notifications.enqueue({
      sourceEventId: message.eventId,
      templateKey: TEMPLATE_KEYS.REGISTRATION_REJECTED,
      recipient: user.email,
      userId: user.id,
      payload: {
        firstName: user.firstName,
        eventTitle: data.eventTitle,
        reason: data.reason,
      },
    });
  }

  @EventPattern(DOMAIN_EVENTS.EVENT_PUBLISHED)
  async onEventPublished(@Payload() message: Message<EventPublishedPayload>) {
    const data = unwrap(message);
    this.logger.log(`event.published -> ${data.title}`);

    // A student team building subscriptions would resolve the real audience
    // here. For now the fact is recorded and nothing is sent.
    this.logger.debug(
      `No subscriber list yet for category ${data.categoryName}`,
    );
  }

  @EventPattern(DOMAIN_EVENTS.EVENT_CANCELLED)
  async onEventCancelled(@Payload() message: Message<EventCancelledPayload>) {
    const data = unwrap(message);
    const users = await this.notifications.resolveUsers(data.affectedUserIds);

    for (const user of users.values()) {
      await this.notifications.enqueue({
        // One event, many recipients: the recipient is part of the
        // idempotency key, so all of these are distinct and none repeat.
        sourceEventId: message.eventId,
        templateKey: TEMPLATE_KEYS.EVENT_CANCELLED,
        recipient: user.email,
        userId: user.id,
        payload: {
          firstName: user.firstName,
          title: data.title,
          reason: data.reason,
        },
      });
    }
  }

  @EventPattern(DOMAIN_EVENTS.EVENT_REMINDER_DUE)
  async onReminderDue(@Payload() message: Message<EventReminderDuePayload>) {
    const data = unwrap(message);
    const users = await this.notifications.resolveUsers(
      data.recipients.map((r) => r.userId),
    );

    for (const recipient of data.recipients) {
      const user = users.get(recipient.userId);
      if (!user) continue;

      await this.notifications.enqueue({
        sourceEventId: message.eventId,
        templateKey: TEMPLATE_KEYS.EVENT_REMINDER,
        recipient: user.email,
        userId: user.id,
        category: 'event_reminder',
        payload: {
          firstName: user.firstName,
          title: data.title,
          startsAt: this.formatDate(data.startsAt),
          venue: data.venue,
          ticketCode: recipient.registrationId.slice(0, 8).toUpperCase(),
        },
      });
    }
  }
}
