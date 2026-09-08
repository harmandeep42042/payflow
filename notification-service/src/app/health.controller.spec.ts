jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));
import {
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  HealthController,
} from './health.controller';

describe('HealthController', () => {
  const notificationIdempotencyMock = {
    checkDatabaseReadiness:
      jest.fn(),
  };

  const runtimeHealthMock = {
    isRabbitMqStarted:
      jest.fn(),
  };

  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller =
      new HealthController(
        notificationIdempotencyMock as never,
        runtimeHealthMock as never,
      );
  });

  it('returns basic health', () => {
    const result =
      controller.getHealth();

    expect(result.status).toBe(
      'ok',
    );

    expect(result.service).toBe(
      'notification-service',
    );

    expect(
      typeof result.timestamp,
    ).toBe('string');
  });

  it('returns process-only liveness', () => {
    const result =
      controller.getLiveness();

    expect(result.status).toBe(
      'ok',
    );

    expect(result.check).toBe(
      'liveness',
    );

    expect(
      notificationIdempotencyMock
        .checkDatabaseReadiness,
    ).not.toHaveBeenCalled();

    expect(
      runtimeHealthMock
        .isRabbitMqStarted,
    ).not.toHaveBeenCalled();
  });

  it('returns ready when database and RabbitMQ bootstrap are ready', async () => {
    notificationIdempotencyMock
      .checkDatabaseReadiness
      .mockResolvedValue(true);

    runtimeHealthMock
      .isRabbitMqStarted
      .mockReturnValue(true);

    const result =
      await controller.getReadiness();

    expect(result.status).toBe(
      'ready',
    );

    expect(
      result.dependencies,
    ).toEqual({
      database: true,
      rabbitmq: true,
    });
  });

  it('returns 503 when database is unavailable', async () => {
    notificationIdempotencyMock
      .checkDatabaseReadiness
      .mockResolvedValue(false);

    runtimeHealthMock
      .isRabbitMqStarted
      .mockReturnValue(true);

    await expect(
      controller.getReadiness(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 503 when RabbitMQ bootstrap is not ready', async () => {
    notificationIdempotencyMock
      .checkDatabaseReadiness
      .mockResolvedValue(true);

    runtimeHealthMock
      .isRabbitMqStarted
      .mockReturnValue(false);

    await expect(
      controller.getReadiness(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});