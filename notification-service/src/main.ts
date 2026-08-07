import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import {
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

import {
  AppModule,
} from './app/app.module';

async function bootstrap():
  Promise<void> {
  const logger =
    new Logger(
      'NotificationService',
    );

  const app =
    await NestFactory.create(
      AppModule,
    );

  app.setGlobalPrefix(
    'api/v1',
  );

  app.enableCors({
    origin:
      true,

    credentials:
      true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:
        true,

      transform:
        true,

      forbidNonWhitelisted:
        true,
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport:
      Transport.RMQ,

    options: {
      urls: [
        process.env['RABBITMQ_URL'] ??
          'amqp://payflow:payflow_password@localhost:5672',
      ],

      queue:
        process.env['RABBITMQ_QUEUE'] ??
        'wallet_events',

      queueOptions: {
        durable:
          true,
      },

      noAck:
        false,

      prefetchCount:
        10,
    },
  });

  await app.startAllMicroservices();

  const port =
    Number(
      process.env[
        'NOTIFICATION_SERVICE_PORT'
      ] ??
      process.env['PORT'] ??
      4006,
    );

  await app.listen(port);

  logger.log(
    `Notification HTTP API running at http://localhost:${port}/api/v1`,
  );

  logger.log(
    `Notification Service listening to RabbitMQ queue: ${
      process.env['RABBITMQ_QUEUE'] ??
      'wallet_events'
    }`,
  );
}

bootstrap();