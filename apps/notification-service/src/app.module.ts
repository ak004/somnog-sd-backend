import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import {
  AUTH_CLIENT,
  ENV_FILE_PATHS,
  notificationEnvSchema,
  rmqClientOptions,
} from '@somnog/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { AuthEventsConsumer } from './consumers/auth-events.consumer';
import { EventEventsConsumer } from './consumers/event-events.consumer';
import {
  DELIVERY_QUEUE,
  NotificationsService,
} from './notifications/notifications.service';
import { NotificationsMessageController } from './notifications/notifications.controller';
import { TemplatesService } from './templates/templates.service';
import { EmailChannel } from './channels/email.channel';
import { DeliveryProcessor } from './queue/delivery.processor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
      validationSchema: notificationEnvSchema,
      validationOptions: { abortEarly: false },
    }),
    PrismaModule,

    // Redis-backed retry queue. Separate from RabbitMQ on purpose: RabbitMQ
    // delivers the fact once, BullMQ owns the retrying of the slow part.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: DELIVERY_QUEUE }),

    // The one outbound call this service makes: asking auth for an email
    // address, because events publish user ids and nothing more.
    ClientsModule.registerAsync([
      {
        name: AUTH_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          rmqClientOptions(
            AUTH_CLIENT,
            config.getOrThrow<string>('RABBITMQ_URL'),
            config.get<string>('AUTH_QUEUE', 'auth_queue'),
          ),
      },
    ]),
  ],
  controllers: [
    HealthController,
    NotificationsMessageController,
    AuthEventsConsumer,
    EventEventsConsumer,
  ],
  providers: [
    NotificationsService,
    TemplatesService,
    EmailChannel,
    DeliveryProcessor,
  ],
})
export class AppModule {}
