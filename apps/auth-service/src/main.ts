import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions } from '@nestjs/microservices';
import { RmqAckInterceptor, ServiceExceptionFilter } from '@somnog/common';
import { rmqServerOptions } from '@somnog/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('AuthService');

  // A hybrid app: HTTP serves /health only, RabbitMQ carries the real work.
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
      config.get<string>('AUTH_QUEUE', 'auth_queue'),
    ),
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  const port = config.get<number>('AUTH_HEALTH_PORT', 3001);
  await app.listen(port);

  logger.log(
    `Listening on queue "${config.get('AUTH_QUEUE', 'auth_queue')}" | health on :${port}`,
  );
}

bootstrap();
