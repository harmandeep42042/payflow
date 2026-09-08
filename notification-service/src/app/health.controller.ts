import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  NotificationIdempotencyService,
} from './notification-idempotency.service';

import {
  NotificationRuntimeHealthState,
} from './notification-runtime-health-state.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly notificationIdempotency:
      NotificationIdempotencyService,
    private readonly runtimeHealth:
      NotificationRuntimeHealthState,
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLiveness() {
    return {
      status: 'ok',
      service: 'notification-service',
      check: 'liveness',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness() {
    const dependencies = {
      database:
        await this.notificationIdempotency
          .checkDatabaseReadiness(),
      rabbitmq:
        this.runtimeHealth
          .isRabbitMqStarted(),
    };

    const ready =
      dependencies.database &&
      dependencies.rabbitmq;

    const response = {
      status:
        ready
          ? 'ready'
          : 'not_ready',
      service: 'notification-service',
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