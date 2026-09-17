import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions } from '@nestjs/microservices';
import { RmqAckInterceptor, ServiceExceptionFilter } from '@somnog/common';
import { rmqServerOptions } from '@somnog/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NotificationService');

  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  // These MUST be registered before connectMicroservice(). `inheritAppConfig`
  // copies the app's global filters and interceptors into the microservice at
  // the moment it is created - anything registered afterwards is not picked up,
  // and the ack interceptor silently never runs. Messages then pile up
  // unacknowledged until prefetchCount is reached and the service goes deaf.
  app.useGlobalFilters(new ServiceExceptionFilter());
  app.useGlobalInterceptors(new RmqAckInterceptor());

  app.connectMicroservice<MicroserviceOptions>(
    rmqServerOptions(
      config.getOrThrow<string>('RABBITMQ_URL'),
      config.get<string>('NOTIFICATION_QUEUE', 'notification_queue'),
    ),
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  const port = config.get<number>('NOTIFICATION_HEALTH_PORT', 3003);
  await app.listen(port);

  logger.log(
    `Consuming queue "${config.get('NOTIFICATION_QUEUE', 'notification_queue')}" | health on :${port}`,
  );
}

bootstrap();
