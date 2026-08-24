import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  PrismaService,
} from '@payflow/database';

import {
  WalletsService,
} from './wallets.service';
import { RecipientLookupService } from '../recipient-lookup/recipient-lookup.service';

describe('WalletsService', () => {
  let service: WalletsService;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          WalletsService,
          {
            provide: PrismaService,
            useValue: {},
          },
          {
            provide: RecipientLookupService,
            useValue: { resolveRecipient: jest.fn() },
          },
        ],
      }).compile();

    service =
      module.get<WalletsService>(
        WalletsService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return wallet module status', () => {
    expect(
      service.getStatus(),
    ).toEqual({
      status: 'ok',
      feature: 'wallets',
      message:
        'Wallet module is working',
    });
  });
});
