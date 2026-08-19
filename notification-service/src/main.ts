import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';
import helmet from 'helmet';

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
  app.use(helmet());

  app
    .getHttpAdapter()
    .getInstance()
    .disable('x-powered-by');

  app.setGlobalPrefix(
    'api/v1',
  );
  const allowedOrigins = (
    process.env['CORS_ALLOWED_ORIGINS'] ??
    'http://localhost:3000,http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin,
      callback,
    ) => {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          'Origin is not allowed by CORS policy',
        ),
        false,
      );
    },

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