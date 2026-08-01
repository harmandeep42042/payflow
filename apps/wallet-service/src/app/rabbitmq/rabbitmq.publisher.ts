import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RabbitMqPublisher
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RabbitMqPublisher.name);

  constructor(
    @Inject('RABBITMQ_CLIENT')
    private readonly client: ClientProxy,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.log('RabbitMQ connected successfully');
    } catch (error) {
      this.logger.error(
        'RabbitMQ connection failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async publish(eventType: string, payload: unknown): Promise<void> {
    await firstValueFrom(this.client.emit(eventType, payload));

    this.logger.log(`Event published: ${eventType}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
    this.logger.log('RabbitMQ connection closed');
  }
}