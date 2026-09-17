import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Gateway');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: config.get<string>('APP_WEB_URL', 'http://localhost:4200'),
    credentials: true,
  });

  // Validation happens here and nowhere else. A service can trust that any
  // payload reaching it has already been checked against the shared DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SomNOG Event Management System')
    .setDescription(
      'One public API in front of the auth, events and notification services. ' +
        'Add a service by registering its queue and adding a controller here.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('events')
    .addTag('registrations')
    .addTag('notifications')
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
    { swaggerOptions: { persistAuthorization: true } },
  );

  const port = config.get<number>('GATEWAY_PORT', 3000);
  await app.listen(port);

  logger.log(`API      http://localhost:${port}`);
  logger.log(`Swagger  http://localhost:${port}/api/docs`);
}

bootstrap();
