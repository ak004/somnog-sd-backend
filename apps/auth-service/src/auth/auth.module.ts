import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule } from '@nestjs/microservices';
import { EVENT_BUS, rmqClientOptions } from '@somnog/config';
import { AuthMessageController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from '../tokens/tokens.service';

@Module({
  imports: [
    JwtModule.register({}),
    // The only outbound connection this service has: the event bus it
    // publishes facts to. It never calls another service.
    ClientsModule.registerAsync([
      {
        name: EVENT_BUS,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          rmqClientOptions(
            EVENT_BUS,
            config.getOrThrow<string>('RABBITMQ_URL'),
            config.get<string>('NOTIFICATION_QUEUE', 'notification_queue'),
          ),
      },
    ]),
  ],
  controllers: [AuthMessageController],
  providers: [AuthService, TokensService],
  exports: [TokensService],
})
export class AuthModule {}
