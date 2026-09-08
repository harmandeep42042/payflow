jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { ConflictException } from '@nestjs/common';

import { InternalSettlementService } from './internal-settlement.service';

describe('InternalSettlementService', () => {
  const dto = {
    paymentId: '11111111-1111-4111-8111-111111111111',

    walletId: '22222222-2222-4222-8222-222222222222',

    providerPaymentId: 'pay_external_123',

    amountInPaise: 100,

    currency: 'INR',
  };

  function createHarness(options?: {
    existingDeposit?: unknown;
    depositResult?: unknown;
  }) {
    const prisma = {
      deposit: {
        findUnique: jest
          .fn()
          .mockResolvedValue(options?.existingDeposit ?? null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },

      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: dto.walletId,

          userId: 'user-1',
        }),
      },
    };

    const walletsService = {
      depositWallet: jest.fn().mockResolvedValue(
        options?.depositResult ?? {
          id: 'deposit-1',

          idempotencyKey: 'payment:' + dto.paymentId,

          walletId: dto.walletId,

          amount: '1.00',

          currency: 'INR',

          reference: 'EXTERNAL-PAYMENT-' + dto.paymentId,

          status: 'COMPLETED',

          replayed: false,
        },
      ),
    };

    const service = new InternalSettlementService(
      prisma as never,
      walletsService as never,
    );

    return {
      service,
      prisma,
      walletsService,
    };
  }

  it('derives deterministic settlement idempotency key server-side', async () => {
    const harness = createHarness();

    await harness.service.settleExternalPayment(dto);

    expect(harness.walletsService.depositWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'payment:' + dto.paymentId,
      }),
      'user-1',
    );
  });

  it('derives deterministic external settlement reference', async () => {
    const harness = createHarness();

    await harness.service.settleExternalPayment(dto);

    expect(harness.walletsService.depositWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'EXTERNAL-PAYMENT-' + dto.paymentId,
      }),
      'user-1',
    );
  });

  it('reuses existing matching deposit without crediting wallet again', async () => {
    const harness = createHarness({
      existingDeposit: {
        id: 'deposit-existing',

        idempotencyKey: 'payment:' + dto.paymentId,

        walletId: dto.walletId,

        amount: {
          toString: () => '1.00',
        },

        currency: 'INR',

        reference: 'EXTERNAL-PAYMENT-' + dto.paymentId,

        status: 'COMPLETED',

        settlementPaymentId: dto.paymentId,

        settlementProviderPaymentId: dto.providerPaymentId,

        completedAt: new Date(),

        wallet: {
          balance: {
            toString: () => '25.00',
          },
        },
      },
    });

    const result = await harness.service.settleExternalPayment(dto);

    expect(result.replayed).toBe(true);

    expect(harness.walletsService.depositWallet).not.toHaveBeenCalled();
  });

  it('rejects replay when wallet payload differs', async () => {
    const harness = createHarness({
      existingDeposit: {
        id: 'deposit-existing',

        idempotencyKey: 'payment:' + dto.paymentId,

        walletId: '33333333-3333-4333-8333-333333333333',

        amount: {
          toString: () => '1.00',
        },

        currency: 'INR',

        reference: 'EXTERNAL-PAYMENT-' + dto.paymentId,

        status: 'COMPLETED',

        completedAt: new Date(),

        wallet: {
          balance: {
            toString: () => '25.00',
          },
        },
      },
    });

    await expect(
      harness.service.settleExternalPayment(dto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(harness.walletsService.depositWallet).not.toHaveBeenCalled();
  });

  it('rejects replay when amount payload differs', async () => {
    const harness = createHarness({
      existingDeposit: {
        id: 'deposit-existing',

        idempotencyKey: 'payment:' + dto.paymentId,

        walletId: dto.walletId,

        amount: {
          toString: () => '9.99',
        },

        currency: 'INR',

        reference: 'EXTERNAL-PAYMENT-' + dto.paymentId,

        status: 'COMPLETED',

        completedAt: new Date(),

        wallet: {
          balance: {
            toString: () => '25.00',
          },
        },
      },
    });

    await expect(
      harness.service.settleExternalPayment(dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects wallet result that does not match durable settlement intent', async () => {
    const harness = createHarness({
      depositResult: {
        id: 'deposit-1',

        idempotencyKey: 'payment:' + dto.paymentId,

        walletId: dto.walletId,

        amount: '9.99',

        currency: 'INR',

        reference: 'EXTERNAL-PAYMENT-' + dto.paymentId,

        status: 'COMPLETED',
      },
    });

    await expect(
      harness.service.settleExternalPayment(dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not perform balance or ledger mutations directly', async () => {
    const harness = createHarness();

    await harness.service.settleExternalPayment(dto);

    expect(harness.walletsService.depositWallet).toHaveBeenCalledTimes(1);
  });
});
