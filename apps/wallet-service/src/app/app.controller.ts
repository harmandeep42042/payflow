import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AppService } from './app.service';
import { RabbitMqPublisher } from './rabbitmq/rabbitmq.publisher';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly rabbitMqPublisher: RabbitMqPublisher,
  ) {}

  @Get('health')
  getHealth() {
    return this.appService.getData();
  }

  @Get('health/live')
  getLiveness() {
    return {
      status: 'ok',
      service: 'wallet-service',
      check: 'liveness',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  async getReadiness() {
    const dependencies = {
      database:
        await this.appService.checkDatabaseReadiness(),
      rabbitmq:
        this.rabbitMqPublisher.isReady(),
    };

    const ready =
      dependencies.database &&
      dependencies.rabbitmq;

    const response = {
      status:
        ready ? 'ready' : 'not_ready',
      service: 'wallet-service',
      check: 'readiness',
      dependencies,
      timestamp: new Date().toISOString(),
    };

    if (!ready) {
      throw new ServiceUnavailableException(
        response,
      );
    }

    return response;
  }
}