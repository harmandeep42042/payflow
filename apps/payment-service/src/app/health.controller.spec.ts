import { ServiceUnavailableException } from '@nestjs/common';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };

  const paymentOrderRateLimitService = {
    checkReadiness: jest.fn(),
  };

  const rabbitMqPublisher = {
    isReady: jest.fn(),
  };

  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new HealthController(
      prisma as never,
      paymentOrderRateLimitService as never,
      rabbitMqPublisher as never,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return payment service health', () => {
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('payment-service');
    expect(result.timestamp).toEqual(
      expect.any(String),
    );
  });

  it('should return payment service liveness', () => {
    const result = controller.getLiveness();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('payment-service');
    expect(result.check).toBe('liveness');
    expect(result.timestamp).toEqual(
      expect.any(String),
    );
  });

  it('should return ready when mandatory dependencies are ready', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        '?column?': 1,
      },
    ]);

    paymentOrderRateLimitService.checkReadiness.mockResolvedValue(
      true,
    );

    rabbitMqPublisher.isReady.mockReturnValue(
      true,
    );

    const result =
      await controller.getReadiness();

    expect(result).toEqual({
      status: 'ready',
      service: 'payment-service',
      check: 'readiness',
      dependencies: {
        database: true,
        redis: true,
        rabbitmq: true,
      },
      timestamp: expect.any(String),
    });
  });

  it('should reject readiness when database is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('database unavailable'),
    );

    paymentOrderRateLimitService.checkReadiness.mockResolvedValue(
      true,
    );

    rabbitMqPublisher.isReady.mockReturnValue(
      true,
    );

    await expect(
      controller.getReadiness(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('should reject readiness when Redis is unavailable', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        '?column?': 1,
      },
    ]);

    paymentOrderRateLimitService.checkReadiness.mockResolvedValue(
      false,
    );

    rabbitMqPublisher.isReady.mockReturnValue(
      true,
    );

    await expect(
      controller.getReadiness(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('should reject readiness when RabbitMQ is unavailable', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        '?column?': 1,
      },
    ]);

    paymentOrderRateLimitService.checkReadiness.mockResolvedValue(
      true,
    );

    rabbitMqPublisher.isReady.mockReturnValue(
      false,
    );

    await expect(
      controller.getReadiness(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});