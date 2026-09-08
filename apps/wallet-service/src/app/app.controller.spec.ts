import {
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RabbitMqPublisher } from './rabbitmq/rabbitmq.publisher';

describe('AppController', () => {
  let controller: AppController;

  const healthResponse = {
    status: 'ok',
    service: 'wallet-service',
    database: 'connected',
    timestamp:
      '2026-08-30T00:00:00.000Z',
  };

  const appServiceMock = {
    getData: jest.fn(),
    checkDatabaseReadiness:
      jest.fn(),
  };

  const rabbitMqPublisherMock = {
    isReady: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    appServiceMock.getData.mockResolvedValue(
      healthResponse,
    );

    appServiceMock.checkDatabaseReadiness.mockResolvedValue(
      true,
    );

    rabbitMqPublisherMock.isReady.mockReturnValue(
      true,
    );

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [
          AppController,
        ],
        providers: [
          {
            provide: AppService,
            useValue: appServiceMock,
          },
          {
            provide: RabbitMqPublisher,
            useValue:
              rabbitMqPublisherMock,
          },
        ],
      }).compile();

    controller =
      module.get<AppController>(
        AppController,
      );
  });

  it('should return wallet service health', async () => {
    await expect(
      controller.getHealth(),
    ).resolves.toEqual(
      healthResponse,
    );

    expect(
      appServiceMock.getData,
    ).toHaveBeenCalledTimes(1);
  });

  it('should return liveness without dependency checks', () => {
    const result =
      controller.getLiveness();

    expect(result).toEqual({
      status: 'ok',
      service: 'wallet-service',
      check: 'liveness',
      timestamp:
        expect.any(String),
    });

    expect(
      appServiceMock.checkDatabaseReadiness,
    ).not.toHaveBeenCalled();

    expect(
      rabbitMqPublisherMock.isReady,
    ).not.toHaveBeenCalled();
  });

  it('should return ready when dependencies are available', async () => {
    await expect(
      controller.getReadiness(),
    ).resolves.toEqual({
      status: 'ready',
      service: 'wallet-service',
      check: 'readiness',
      dependencies: {
        database: true,
        rabbitmq: true,
      },
      timestamp:
        expect.any(String),
    });
  });

  it('should reject readiness when database is unavailable', async () => {
    appServiceMock.checkDatabaseReadiness.mockResolvedValue(
      false,
    );

    await expect(
      controller.getReadiness(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('should reject readiness when RabbitMQ is unavailable', async () => {
    rabbitMqPublisherMock.isReady.mockReturnValue(
      false,
    );

    await expect(
      controller.getReadiness(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});