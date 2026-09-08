import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  AppController,
} from './app.controller';

import {
  AppService,
} from './app.service';

describe('AppController', () => {
  let controller: AppController;

  const appServiceMock = {
    getHealth: jest.fn(),
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    appServiceMock.getHealth.mockReturnValue({
      status: 'ok',
      service: 'api-gateway',
      timestamp:
        '2026-08-30T00:00:00.000Z',
    });

    appServiceMock.getLiveness.mockReturnValue({
      status: 'ok',
      service: 'api-gateway',
      check: 'liveness',
      timestamp:
        '2026-08-30T00:00:00.000Z',
    });

    appServiceMock.getReadiness.mockReturnValue({
      status: 'ready',
      service: 'api-gateway',
      check: 'readiness',
      timestamp:
        '2026-08-30T00:00:00.000Z',
    });

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
        ],
      }).compile();

    controller =
      module.get<AppController>(
        AppController,
      );
  });

  it('should preserve gateway health', () => {
    expect(
      controller.getHealth(),
    ).toEqual({
      status: 'ok',
      service: 'api-gateway',
      timestamp:
        '2026-08-30T00:00:00.000Z',
    });

    expect(
      appServiceMock.getHealth,
    ).toHaveBeenCalledTimes(1);
  });

  it('should return gateway liveness', () => {
    expect(
      controller.getLiveness(),
    ).toEqual({
      status: 'ok',
      service: 'api-gateway',
      check: 'liveness',
      timestamp:
        '2026-08-30T00:00:00.000Z',
    });

    expect(
      appServiceMock.getLiveness,
    ).toHaveBeenCalledTimes(1);
  });

  it('should return gateway readiness', () => {
    expect(
      controller.getReadiness(),
    ).toEqual({
      status: 'ready',
      service: 'api-gateway',
      check: 'readiness',
      timestamp:
        '2026-08-30T00:00:00.000Z',
    });

    expect(
      appServiceMock.getReadiness,
    ).toHaveBeenCalledTimes(1);
  });
});