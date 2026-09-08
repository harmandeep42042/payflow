import { ConflictException } from '@nestjs/common';

import { InternalSettlementService } from './internal-settlement.service';

describe('InternalSettlementService - Stage 7C.8F regression', () => {
  const paymentId = '11111111-1111-4111-8111-111111111111';
  const providerPaymentId = 'pay_provider_001';
  const walletId = '22222222-2222-4222-8222-222222222222';

  const dto = {
    paymentId,
    providerPaymentId,
    walletId,
    amountInPaise: 100,
    currency: 'INR',
  };

  function decimal(value: string) {
    return {
      toString: () => value,
    };
  }

  function existingDeposit(overrides: Record<string, unknown> = {}) {
    return {
      id: 'deposit-1',
      idempotencyKey: 'payment:' + paymentId,
      walletId,
      amount: decimal('1'),
      currency: 'INR',
      reference: 'EXTERNAL-PAYMENT-' + paymentId,
      status: 'COMPLETED',
      completedAt: new Date('2026-08-28T00:00:00.000Z'),
      settlementPaymentId: paymentId,
      settlementProviderPaymentId: providerPaymentId,
      wallet: {
        balance: decimal('156.00'),
      },
      ...overrides,
    };
  }

  function createHarness(options?: {
    existing?: any;
    wallet?: any;
    depositResult?: any;
    updateCount?: number;
    concurrent?: any;
  }) {
    const findUnique = jest.fn();

    /*
     * First findUnique is Deposit lookup.
     * Subsequent lookup can be used for concurrent binding evidence.
     */
    findUnique.mockResolvedValueOnce(
      options && Object.prototype.hasOwnProperty.call(options, 'existing')
        ? options.existing
        : null,
    );

    if (options?.concurrent !== undefined) {
      findUnique.mockResolvedValueOnce(options.concurrent);
    }

    const walletFindUnique = jest.fn().mockResolvedValue(
      options?.wallet ?? {
        id: walletId,
        userId: 'user-1',
      },
    );

    const depositUpdateMany = jest.fn().mockResolvedValue({
      count: options?.updateCount ?? 1,
    });

    const prisma = {
      deposit: {
        findUnique,
        updateMany: depositUpdateMany,
      },

      wallet: {
        findUnique: walletFindUnique,
      },
    };

    const depositWallet = jest.fn().mockResolvedValue(
      options?.depositResult ?? {
        id: 'deposit-1',
        idempotencyKey: 'payment:' + paymentId,
        walletId,
        amount: '1',
        currency: 'INR',
        reference: 'EXTERNAL-PAYMENT-' + paymentId,
        status: 'COMPLETED',
        completedAt: new Date('2026-08-28T00:00:00.000Z'),
        walletBalance: '156.00',
        replayed: false,
      },
    );

    const walletsService = {
      depositWallet,
    };

    const service = new InternalSettlementService(
      prisma as any,
      walletsService as any,
    );

    return {
      service,
      prisma,
      walletsService,
      findUnique,
      walletFindUnique,
      depositUpdateMany,
      depositWallet,
    };
  }

  it('accepts Decimal "1" as equal to expected "1.00" on replay', async () => {
    const harness = createHarness({
      existing: existingDeposit(),
    });

    const result = await harness.service.settleExternalPayment(dto);

    expect(result.replayed).toBe(true);
    expect(result.paymentId).toBe(paymentId);
    expect(result.providerPaymentId).toBe(providerPaymentId);

    expect(harness.depositWallet).not.toHaveBeenCalled();
    expect(harness.depositUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects a genuinely different amount on replay', async () => {
    const harness = createHarness({
      existing: existingDeposit({
        amount: decimal('1.01'),
      }),
    });

    await expect(
      harness.service.settleExternalPayment(dto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(harness.depositWallet).not.toHaveBeenCalled();
  });

  it('rejects a different durable payment binding', async () => {
    const harness = createHarness({
      existing: existingDeposit({
        settlementPaymentId:
          '33333333-3333-4333-8333-333333333333',
      }),
    });

    await expect(
      harness.service.settleExternalPayment(dto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(harness.depositWallet).not.toHaveBeenCalled();
  });

  it('rejects a different provider payment binding', async () => {
    const harness = createHarness({
      existing: existingDeposit({
        settlementProviderPaymentId: 'pay_other',
      }),
    });

    await expect(
      harness.service.settleExternalPayment(dto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(harness.depositWallet).not.toHaveBeenCalled();
  });

  it('backfills an unbound legacy settlement without moving money again', async () => {
    const harness = createHarness({
      existing: existingDeposit({
        settlementPaymentId: null,
        settlementProviderPaymentId: null,
      }),
      updateCount: 1,
    });

    const result = await harness.service.settleExternalPayment(dto);

    expect(result.replayed).toBe(true);

    expect(harness.depositWallet).not.toHaveBeenCalled();

    expect(harness.depositUpdateMany).toHaveBeenCalledTimes(1);

    expect(harness.depositUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          settlementPaymentId: paymentId,
          settlementProviderPaymentId: providerPaymentId,
        },
      }),
    );
  });

  it('accepts fresh wallet evidence amount "1" for expected "1.00"', async () => {
    const harness = createHarness({
      existing: null,

      depositResult: {
        id: 'deposit-1',
        idempotencyKey: 'payment:' + paymentId,
        walletId,
        amount: '1',
        currency: 'INR',
        reference: 'EXTERNAL-PAYMENT-' + paymentId,
        status: 'COMPLETED',
        completedAt: new Date('2026-08-28T00:00:00.000Z'),
        walletBalance: '156.00',
        replayed: false,
      },

      updateCount: 1,
    });

    const result = await harness.service.settleExternalPayment(dto);

    expect(result.paymentId).toBe(paymentId);
    expect(result.providerPaymentId).toBe(providerPaymentId);

    expect(harness.depositWallet).toHaveBeenCalledTimes(1);
    expect(harness.depositUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects fresh wallet evidence with a genuinely different amount', async () => {
    const harness = createHarness({
      existing: null,

      depositResult: {
        id: 'deposit-1',
        idempotencyKey: 'payment:' + paymentId,
        walletId,
        amount: '1.01',
        currency: 'INR',
        reference: 'EXTERNAL-PAYMENT-' + paymentId,
        status: 'COMPLETED',
        completedAt: new Date('2026-08-28T00:00:00.000Z'),
        walletBalance: '156.00',
        replayed: false,
      },
    });

    await expect(
      harness.service.settleExternalPayment(dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a concurrent binding that resolves to different external evidence', async () => {
    const unbound = existingDeposit({
      settlementPaymentId: null,
      settlementProviderPaymentId: null,
    });

    const concurrent = existingDeposit({
      settlementPaymentId: paymentId,
      settlementProviderPaymentId: 'pay_competing',
    });

    const harness = createHarness({
      existing: unbound,
      updateCount: 0,
      concurrent,
    });

    await expect(
      harness.service.settleExternalPayment(dto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(harness.depositWallet).not.toHaveBeenCalled();
  });
});