import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ENV_FILE_PATHS, eventsEnvSchema } from '@somnog/config';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
      validationSchema: eventsEnvSchema,
      validationOptions: { abortEarly: false },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EventsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
