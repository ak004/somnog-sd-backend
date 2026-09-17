import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { EVENT_BUS, rmqClientOptions } from '@somnog/config';
import { CategoriesMessageController } from '../categories/categories.controller';
import { CategoriesService } from '../categories/categories.service';
import { EventsMessageController } from './events.controller';
import { EventsService } from './events.service';
import { RegistrationsMessageController } from '../registrations/registrations.controller';
import { RegistrationsService } from '../registrations/registrations.service';
import { RemindersService } from './reminders.service';

@Module({
  imports: [
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
  controllers: [
    CategoriesMessageController,
    EventsMessageController,
    RegistrationsMessageController,
  ],
  providers: [
    CategoriesService,
    EventsService,
    RegistrationsService,
    RemindersService,
  ],
})
export class EventsModule {}
