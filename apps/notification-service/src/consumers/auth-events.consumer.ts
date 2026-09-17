import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  DOMAIN_EVENTS,
  Message,
  PasswordChangedPayload,
  PasswordResetRequestedPayload,
  TEMPLATE_KEYS,
  UserRegisteredPayload,
  unwrap,
} from '@somnog/contracts';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Listens to facts the auth service announced. Note what is NOT here: no
 * return values, and no way to tell the auth service anything back.
 */
@Controller()
export class AuthEventsConsumer {
  private readonly logger = new Logger(AuthEventsConsumer.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.get<string>('APP_WEB_URL', 'http://localhost:4200');
  }

  @EventPattern(DOMAIN_EVENTS.USER_REGISTERED)
  async onUserRegistered(@Payload() message: Message<UserRegisteredPayload>) {
    const data = unwrap(message);
    this.logger.log(`user.registered -> ${data.email}`);

    await this.notifications.enqueue({
      sourceEventId: message.eventId,
      templateKey: TEMPLATE_KEYS.WELCOME_VERIFY_EMAIL,
      recipient: data.email,
      userId: data.userId,
      payload: {
        firstName: data.firstName,
        verifyUrl: `${this.webUrl}/verify-email?token=${data.verificationToken}`,
      },
    });
  }

  @EventPattern(DOMAIN_EVENTS.USER_PASSWORD_RESET_REQUESTED)
  async onPasswordResetRequested(
    @Payload() message: Message<PasswordResetRequestedPayload>,
  ) {
    const data = unwrap(message);

    await this.notifications.enqueue({
      sourceEventId: message.eventId,
      templateKey: TEMPLATE_KEYS.PASSWORD_RESET,
      recipient: data.email,
      userId: data.userId,
      payload: {
        firstName: data.firstName,
        resetUrl: `${this.webUrl}/reset-password?token=${data.resetToken}`,
      },
    });
  }

  @EventPattern(DOMAIN_EVENTS.USER_PASSWORD_CHANGED)
  async onPasswordChanged(
    @Payload() message: Message<PasswordChangedPayload>,
  ) {
    const data = unwrap(message);

    await this.notifications.enqueue({
      sourceEventId: message.eventId,
      templateKey: TEMPLATE_KEYS.PASSWORD_CHANGED,
      recipient: data.email,
      userId: data.userId,
      payload: { firstName: data.firstName },
    });
  }
}
