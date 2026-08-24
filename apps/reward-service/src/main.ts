import 'tslib';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.enableShutdownHooks();

  const rabbitMqUrl =
    process.env['RABBITMQ_URL'] ??
    'amqp://payflow:payflow_password@localhost:5672';
  const paymentEventsQueue =
    process.env['PAYMENT_RABBITMQ_QUEUE'] ??
    'payment_events';

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl],
      queue: paymentEventsQueue,
      queueOptions: {
        durable: true,
      },
      noAck: false,
      prefetchCount: 1,
    },
  });

  await app.startAllMicroservices();

  const port = Number(
    process.env.REWARD_SERVICE_PORT || 4007,
  );

  await app.listen(port, '0.0.0.0');

  Logger.log(
    `Reward Service running on http://localhost:${port}`,
    'Bootstrap',
  );

  Logger.log(
    `Reward Service consuming RabbitMQ queue: ${paymentEventsQueue}`,
    'Bootstrap',
  );
}

void bootstrap();
