import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { PrismaService } from '@payflow/database';

import { PaymentOrderRateLimitService } from './payments/security/payment-order-rate-limit.service';
import { RabbitMqPublisher } from './rabbitmq/rabbitmq.publisher';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject('PAYMENT_HEALTH_PRISMA')
    private readonly prisma: PrismaService,
    private readonly paymentOrderRateLimitService: PaymentOrderRateLimitService,
    private readonly rabbitMqPublisher: RabbitMqPublisher,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Check Payment Service health',
  })
  getHealth() {
    return {
      status: 'ok',
      service: 'payment-service',
      timestamp:
        new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({
    summary:
      'Check Payment Service liveness',
  })
  getLiveness() {
    return {
      status: 'ok',
      service: 'payment-service',
      check: 'liveness',
      timestamp:
        new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary:
      'Check Payment Service readiness',
  })
  async getReadiness() {
    const dependencies = {
      database: false,
      redis: false,
      rabbitmq:
        this.rabbitMqPublisher.isReady(),
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dependencies.database = true;
    } catch {
      dependencies.database = false;
    }

    dependencies.redis =
      await this.paymentOrderRateLimitService.checkReadiness();

    const ready =
      dependencies.database &&
      dependencies.redis &&
      dependencies.rabbitmq;

    const response = {
      status:
        ready ? 'ready' : 'not_ready',
      service: 'payment-service',
      check: 'readiness',
      dependencies,
      timestamp:
        new Date().toISOString(),
    };

    if (!ready) {
      throw new ServiceUnavailableException(
        response,
      );
    }

    return response;
  }
}