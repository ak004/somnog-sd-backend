import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import {
  AUTH_CLIENT,
  EVENTS_CLIENT,
  NOTIFICATION_CLIENT,
  rmqClientOptions,
} from '@somnog/config';

/**
 * Every downstream service the gateway can reach.
 *
 * A student team adds their service by appending ONE entry here and one
 * controller module. Nothing else in the repo changes - which is the point of
 * keeping the gateway thin.
 */
@Global()
@Module({
  imports: [
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
      {
        name: EVENTS_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          rmqClientOptions(
            EVENTS_CLIENT,
            config.getOrThrow<string>('RABBITMQ_URL'),
            config.get<string>('EVENTS_QUEUE', 'events_queue'),
          ),
      },
      {
        name: NOTIFICATION_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          rmqClientOptions(
            NOTIFICATION_CLIENT,
            config.getOrThrow<string>('RABBITMQ_URL'),
            config.get<string>('NOTIFICATION_QUEUE', 'notification_queue'),
          ),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GatewayClientsModule {}
