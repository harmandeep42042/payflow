import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  WalletsController,
} from './wallets.controller';

import {
  WalletsService,
} from './wallets.service';

describe('WalletsController', () => {
  let controller:
    WalletsController;

  const walletsServiceMock = {
    getStatus: jest.fn(),
  };

  beforeEach(async () => {
    walletsServiceMock.getStatus
      .mockReturnValue({
        status: 'ok',
        feature: 'wallets',
        message:
          'Wallet module is working',
      });

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [
          WalletsController,
        ],
        providers: [
          {
            provide:
              WalletsService,
            useValue:
              walletsServiceMock,
          },
        ],
      }).compile();

    controller =
      module.get<WalletsController>(
        WalletsController,
      );
  });

  it('should be defined', () => {
    expect(
      controller,
    ).toBeDefined();
  });

  it('should return wallet status', () => {
    expect(
      controller.getWalletsStatus(),
    ).toEqual({
      status: 'ok',
      feature: 'wallets',
      message:
        'Wallet module is working',
    });
  });
});
