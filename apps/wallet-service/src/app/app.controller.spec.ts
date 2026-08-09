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

  const healthResponse = {
    status: 'ok',
    service: 'wallet-service',
    database: 'connected',
    timestamp:
      '2026-08-09T00:00:00.000Z',
  };

  const appServiceMock = {
    getData: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    appServiceMock.getData.mockResolvedValue(
      healthResponse,
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
});
