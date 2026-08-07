import {
  NestFactory,
} from '@nestjs/core';

import {
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

import {
  payflowConfig,
} from '@payflow/shared-config';

import {
  AppModule,
} from './app/app.module';

async function bootstrap():
  Promise<void> {
  const app =
    await NestFactory.create(
      AppModule,
    );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.connectMicroservice<
    MicroserviceOptions
  >({
    transport:
      Transport.RMQ,

    options: {
      urls: [
        payflowConfig
          .urls.rabbitMq,
      ],

      queue:
        payflowConfig
          .rabbitMq
          .walletEventsQueue,

      queueOptions: {
        durable: true,
      },

      noAck: false,

      prefetchCount:
        payflowConfig
          .rabbitMq
          .prefetchCount,
    },
  });

  await app
    .startAllMicroservices();

  await app.listen(
    payflowConfig
      .ports
      .notificationService,
  );

  console.log(
    `Notification Service HTTP/WebSocket listening on port ${
      payflowConfig
        .ports
        .notificationService
    }`,
  );

  console.log(
    `Notification Service consuming RabbitMQ queue: ${
      payflowConfig
        .rabbitMq
        .walletEventsQueue
    }`,
  );
}

void bootstrap();
