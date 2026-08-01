import { NestFactory } from '@nestjs/core';
import {
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const app =
    await NestFactory.createMicroservice<MicroserviceOptions>(
      AppModule,
      {
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL ??
              'amqp://payflow:payflow_password@localhost:5672',
          ],
          queue:
            process.env.RABBITMQ_QUEUE ??
            'wallet_events',
          queueOptions: {
            durable: true,
          },
          noAck: false,
          prefetchCount: 10,
        },
      },
    );

  await app.listen();

  console.log(
    'Notification Service is listening to RabbitMQ queue: wallet_events',
  );
}

bootstrap();