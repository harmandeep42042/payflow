import { serializeOperationalLog } from '../observability/operational-log';
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

  private ready = false;

  constructor(
    @Inject('RABBITMQ_CLIENT')
    private readonly client: ClientProxy,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.client.connect();
      this.ready = true;

      this.logger.log(serializeOperationalLog('rabbitmq.connection.opened'));
    } catch (error) {
      this.logger.error(
        serializeOperationalLog('rabbitmq.connection.failed'),
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  isReady(): boolean {
    return this.ready;
  }
  async publish(eventType: string, payload: unknown): Promise<void> {
    await firstValueFrom(this.client.emit(eventType, payload));

    this.logger.log(
      serializeOperationalLog(`rabbitmq.publish.completed:${eventType}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.ready = false;
    await this.client.close();

    this.logger.log(serializeOperationalLog('rabbitmq.connection.closed'));
  }
}
