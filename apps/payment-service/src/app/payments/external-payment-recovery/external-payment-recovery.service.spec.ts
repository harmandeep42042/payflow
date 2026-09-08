jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { ExternalPaymentRecoveryService } from './external-payment-recovery.service';

describe('ExternalPaymentRecoveryService', () => {
  const basePayment = {
    id: 'payment-1',
    amountInPaise: 100,
    currency: 'INR',
    processingStartedAt: new Date(Date.now() - 10 * 60 * 1000),
    lastRecoveryAt: null,
    recoveryAttempts: 0,
    provider: 'RAZORPAY',
    providerOrderId: null as string | null,
    status: 'PROCESSING',
  };

  function createHarness(options?: {
    providerResult?: unknown;
    providerError?: Error;
  }) {
    let currentPayment = {
      ...basePayment,
    };

    const payment = {
      findMany: jest.fn().mockResolvedValue([currentPayment]),

      updateMany: jest
        .fn()
        .mockImplementation(
          async ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => {
            if (where.id && where.id !== currentPayment.id) {
              return {
                count: 0,
              };
            }

            if (where.status && where.status !== currentPayment.status) {
              return {
                count: 0,
              };
            }

            const nextData = {
              ...data,
            } as Record<string, unknown>;

            if (
              nextData.recoveryAttempts &&
              typeof nextData.recoveryAttempts === 'object' &&
              nextData.recoveryAttempts !== null &&
              'increment' in nextData.recoveryAttempts
            ) {
              nextData.recoveryAttempts =
                currentPayment.recoveryAttempts +
                Number(
                  (
                    nextData.recoveryAttempts as {
                      increment: number;
                    }
                  ).increment,
                );
            }

            currentPayment = {
              ...currentPayment,
              ...nextData,
            };

            return {
              count: 1,
            };
          },
        ),
    };

    const prisma = {
      payment,
    };

    const rail = {
      name: 'RAZORPAY',

      isConfigured: jest.fn().mockReturnValue(true),

      createOrder: jest.fn(),

      findOrderByReceipt: options?.providerError
        ? jest.fn().mockRejectedValue(options.providerError)
        : jest.fn().mockResolvedValue(options?.providerResult ?? null),
    };

    const service = new ExternalPaymentRecoveryService(
      prisma as never,
      rail as never,
    );

    return {
      service,
      prisma,
      rail,
      getPayment: () => currentPayment,
    };
  }

  it('recovers stale PROCESSING to ORDER_CREATED when provider evidence matches', async () => {
    const harness = createHarness({
      providerResult: {
        provider: 'RAZORPAY',
        providerOrderId: 'order_123',
        amountMinor: 100,
        currency: 'INR',
        receipt: 'payflow_payment1',
        status: 'created',
      },
    });

    await harness.service.recoverStaleExternalPayments();

    expect(harness.rail.findOrderByReceipt).toHaveBeenCalledTimes(1);

    expect(harness.rail.createOrder).not.toHaveBeenCalled();

    expect(harness.getPayment().status).toBe('ORDER_CREATED');

    expect(harness.getPayment().providerOrderId).toBe('order_123');
  });

  it('moves stale PROCESSING to NEEDS_REVIEW when provider order is missing', async () => {
    const harness = createHarness({
      providerResult: null,
    });

    await harness.service.recoverStaleExternalPayments();

    expect(harness.rail.findOrderByReceipt).toHaveBeenCalledTimes(1);

    expect(harness.rail.createOrder).not.toHaveBeenCalled();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');
  });

  it('moves stale PROCESSING to NEEDS_REVIEW when provider lookup fails', async () => {
    const harness = createHarness({
      providerError: new Error('provider timeout'),
    });

    await harness.service.recoverStaleExternalPayments();

    expect(harness.rail.findOrderByReceipt).toHaveBeenCalledTimes(1);

    expect(harness.rail.createOrder).not.toHaveBeenCalled();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');
  });

  it('rejects mismatched provider amount and requires review', async () => {
    const harness = createHarness({
      providerResult: {
        provider: 'RAZORPAY',
        providerOrderId: 'order_bad_amount',
        amountMinor: 999,
        currency: 'INR',
      },
    });

    await harness.service.recoverStaleExternalPayments();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');

    expect(harness.rail.createOrder).not.toHaveBeenCalled();
  });

  it('rejects mismatched provider currency and requires review', async () => {
    const harness = createHarness({
      providerResult: {
        provider: 'RAZORPAY',
        providerOrderId: 'order_bad_currency',
        amountMinor: 100,
        currency: 'USD',
      },
    });

    await harness.service.recoverStaleExternalPayments();

    expect(harness.getPayment().status).toBe('NEEDS_REVIEW');

    expect(harness.rail.createOrder).not.toHaveBeenCalled();
  });

  it('does not recover when provider rail is not configured', async () => {
    const harness = createHarness();

    harness.rail.isConfigured.mockReturnValue(false);

    await harness.service.recoverStaleExternalPayments();

    expect(harness.prisma.payment.findMany).not.toHaveBeenCalled();

    expect(harness.rail.findOrderByReceipt).not.toHaveBeenCalled();

    expect(harness.rail.createOrder).not.toHaveBeenCalled();
  });

  it('never marks recovery result COMPLETED', async () => {
    const harness = createHarness({
      providerResult: {
        provider: 'RAZORPAY',
        providerOrderId: 'order_123',
        amountMinor: 100,
        currency: 'INR',
      },
    });

    await harness.service.recoverStaleExternalPayments();

    expect(harness.getPayment().status).not.toBe('COMPLETED');
  });

  it('increments recoveryAttempts during claim', async () => {
    const harness = createHarness({
      providerResult: null,
    });

    await harness.service.recoverStaleExternalPayments();

    expect(harness.getPayment().recoveryAttempts).toBe(1);
  });
});
