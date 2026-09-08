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
import { WalletTransferRiskService } from './security/wallet-transfer-risk.service';
import { Decimal } from '@prisma/client/runtime/client';
import { ForbiddenException } from '@nestjs/common';

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
          {
            provide: WalletTransferRiskService,
            useValue: { evaluateTransfer: jest.fn() },
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

  it('rejects wallet creation for a body user that differs from JWT identity', async () => {
    await expect(service.createWallet({ userId: '11111111-1111-4111-8111-111111111111', currency: 'INR' }, '22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('compares withdrawal balances with Decimal precision', async () => {
    const prisma = {
      withdrawal: { findUnique: jest.fn().mockResolvedValue(null) },
      wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'wallet', userId: 'user', status: 'ACTIVE', currency: 'INR', balance: new Decimal('9007199254740992.00'), ledgerAccount: { id: 'ledger' } }) },
    };
    const preciseService = new WalletsService(prisma as never, { resolveRecipient: jest.fn() } as never, { evaluateTransfer: jest.fn() } as never);
    await expect(preciseService.withdrawWallet({ walletId: 'wallet', currency: 'INR', amount: '9007199254740992.01', idempotencyKey: 'precise-withdrawal', reference: 'precision-check' }, 'user')).rejects.toThrow('Insufficient wallet balance');
  });
});
