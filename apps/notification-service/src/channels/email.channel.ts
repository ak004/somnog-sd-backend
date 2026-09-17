import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  NotificationChannelAdapter,
  RenderedMessage,
} from './channel.interface';

/**
 * Locally this points at MailHog, so nothing ever leaves the machine and every
 * message is visible at http://localhost:8025. In production the same code
 * points at a real SMTP server - only the env changes.
 */
@Injectable()
export class EmailChannel implements NotificationChannelAdapter, OnModuleInit {
  readonly name = 'EMAIL' as const;
  private readonly logger = new Logger(EmailChannel.name);
  private transporter!: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 1025),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      ...(user ? { auth: { user, pass } } : {}),
      // MailHog speaks plain SMTP with no TLS.
      tls: { rejectUnauthorized: false },
    });
  }

  async send(message: RenderedMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.config.get<string>(
        'MAIL_FROM',
        'SomNOG Events <no-reply@somnog.so>',
      ),
      to: message.recipient,
      subject: message.subject,
      html: message.body,
      text: message.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });

    this.logger.log(`Sent "${message.subject}" to ${message.recipient} (${info.messageId})`);
  }
}
