import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ListNotificationsQueryDto,
  Message,
  NOTIFICATION_PATTERNS,
  NotificationChannel,
  SendDirectNotificationDto,
  UpsertTemplateDto,
  unwrap,
} from '@somnog/contracts';
import { NotificationsService } from './notifications.service';
import { TemplatesService } from '../templates/templates.service';

@Controller()
export class NotificationsMessageController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly templates: TemplatesService,
  ) {}

  @MessagePattern(NOTIFICATION_PATTERNS.LIST_FOR_USER)
  listForUser(
    @Payload()
    message: Message<ListNotificationsQueryDto & { userId: string }>,
  ) {
    const { userId, ...query } = unwrap(message);
    return this.notifications.listForUser(userId, query);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.MARK_READ)
  markRead(
    @Payload() message: Message<{ userId: string; notificationId: string }>,
  ) {
    const { userId, notificationId } = unwrap(message);
    return this.notifications.markRead(userId, notificationId);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.LIST_ALL)
  listAll(@Payload() message: Message<ListNotificationsQueryDto>) {
    return this.notifications.listAll(unwrap(message) ?? {});
  }

  @MessagePattern(NOTIFICATION_PATTERNS.RETRY)
  retry(@Payload() message: Message<{ notificationId: string }>) {
    return this.notifications.retry(unwrap(message).notificationId);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.PREFERENCES_GET)
  getPreferences(@Payload() message: Message<{ userId: string }>) {
    return this.notifications.getPreferences(unwrap(message).userId);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.PREFERENCES_UPDATE)
  updatePreference(
    @Payload()
    message: Message<{
      userId: string;
      channel: NotificationChannel;
      category: string;
      enabled: boolean;
    }>,
  ) {
    const { userId, channel, category, enabled } = unwrap(message);
    return this.notifications.updatePreference(
      userId,
      channel,
      category,
      enabled,
    );
  }

  @MessagePattern(NOTIFICATION_PATTERNS.TEMPLATE_LIST)
  listTemplates(@Payload() message: Message<{ channel?: NotificationChannel }>) {
    return this.templates.list(unwrap(message)?.channel);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.TEMPLATE_UPSERT)
  upsertTemplate(@Payload() message: Message<UpsertTemplateDto>) {
    return this.templates.upsert(unwrap(message));
  }

  /** Escape hatch for an admin sending a one-off message. */
  @MessagePattern(NOTIFICATION_PATTERNS.SEND_DIRECT)
  sendDirect(@Payload() message: Message<SendDirectNotificationDto>) {
    const dto = unwrap(message);
    return this.notifications.enqueue({
      sourceEventId: message.eventId,
      templateKey: dto.templateKey,
      recipient: dto.recipient,
      channel: dto.channel,
      payload: dto.payload ?? {},
    });
  }
}
