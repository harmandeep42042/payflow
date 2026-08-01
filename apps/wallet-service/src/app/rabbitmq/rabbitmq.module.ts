import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitMqPublisher } from './rabbitmq.publisher';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'RABBITMQ_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL ??
              'amqp://payflow:payflow_password@localhost:5672',
          ],
          queue: 'wallet_events',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  providers: [RabbitMqPublisher],
  exports: [RabbitMqPublisher],
})
export class RabbitMqModule {}