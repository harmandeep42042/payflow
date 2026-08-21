import { BadGatewayException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import {
  OutboxEventProducer,
  PaymentEventPattern,
  PaymentEventVersion,
} from '@payflow/shared-events';

import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const payment = {
    id: 'payment-1',
    userId: 'user-1',
    walletId: 'wallet-1',
    provider: 'MOCK',
    providerOrderId: 'mock-order-1',
    providerPaymentId: null,
    amount: '1.00',
    amountInPaise: 100,
    currency: 'INR',
    status: 'CREATED',
    description: null,
    idempotencyKey: 'create-payment-1',
    metadata: null,
    createdAt: new Date('2026-08-21T00:00:00.000Z'),
    updatedAt: new Date('2026-08-21T00:00:00.000Z'),
    completedAt: null,
  };

  const completedPayment = {
    ...payment,
    status: 'COMPLETED',
    providerPaymentId: 'mock-pay-1',
    completedAt: new Date('2026-08-21T00:01:00.000Z'),
  };

  const walletResponse = {
    deposit: {
      id: 'deposit-1',
    },
  };

  const rewardResponse = {
    generated: true,
  };

  function createHarness() {
    let paymentStatus = payment.status;

    const transactionPayment = {
      updateMany: jest.fn(async () => {
        if (paymentStatus !== 'CREATED') {
          return { count: 0 };
        }

        paymentStatus = 'COMPLETED';
        return { count: 1 };
      }),
    };

    const transactionOutbox = {
      create: jest.fn(async ({ data }) => data),
    };

    const prisma = {
      payment: {
        findUnique: jest.fn(async () =>
          paymentStatus === 'COMPLETED'
            ? completedPayment
            : payment,
        ),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          payment: transactionPayment,
          outboxEvent: transactionOutbox,
        }),
      ),
    };

    const http = {
      post: jest.fn((url: string) =>
        url.includes('/wallets/deposit')
          ? of({ data: walletResponse })
          : of({ data: rewardResponse }),
      ),
    };

    const service = new PaymentsService(
      prisma as never,
      http as never,
    );

    return {
      service,
      prisma,
      http,
      transactionPayment,
      transactionOutbox,
      setPaymentStatus: (status: string) => {
        paymentStatus = status;
      },
    };
  }

  it('creates exactly one PAYMENT_COMPLETED outbox event on successful completion', async () => {
    const harness = createHarness();

    const result = await harness.service.confirmOrder(
      payment.id,
      payment.userId,
      'Bearer token',
    );

    expect(result.replayed).toBe(false);
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(harness.transactionOutbox.create).toHaveBeenCalledTimes(1);
    expect(harness.transactionOutbox.create).toHaveBeenCalledWith({
      data: {
        producer: OutboxEventProducer.Payment,
        aggregateType: 'PAYMENT',
        aggregateId: payment.id,
        eventType: PaymentEventPattern.Completed,
        payload: {
          version: PaymentEventVersion.Completed,
          paymentId: payment.id,
          userId: payment.userId,
          walletId: payment.walletId,
          amount: payment.amount,
          currency: payment.currency,
        },
      },
    });
  });

  it('does not create another outbox event when a completed payment is replayed', async () => {
    const harness = createHarness();
    harness.setPaymentStatus('COMPLETED');

    const result = await harness.service.confirmOrder(
      payment.id,
      payment.userId,
      'Bearer token',
    );

    expect(result.replayed).toBe(true);
    expect(harness.http.post).not.toHaveBeenCalled();
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
    expect(harness.transactionOutbox.create).not.toHaveBeenCalled();
  });

  it('does not create duplicate outbox events for concurrent confirmation', async () => {
    const harness = createHarness();

    const results = await Promise.all([
      harness.service.confirmOrder(
        payment.id,
        payment.userId,
        'Bearer token',
      ),
      harness.service.confirmOrder(
        payment.id,
        payment.userId,
        'Bearer token',
      ),
    ]);

    expect(harness.transactionPayment.updateMany).toHaveBeenCalledTimes(2);
    expect(harness.transactionOutbox.create).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(1);
  });

  it('does not create an outbox event when wallet credit fails', async () => {
    const harness = createHarness();
    harness.http.post.mockImplementation(() =>
      throwError(() => new Error('wallet unavailable')),
    );

    await expect(
      harness.service.confirmOrder(
        payment.id,
        payment.userId,
        'Bearer token',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
    expect(harness.transactionOutbox.create).not.toHaveBeenCalled();
  });

  it('keeps create-order idempotency unchanged', async () => {
    const harness = createHarness();

    const result = await harness.service.createOrder(
      {
        userId: payment.userId,
        walletId: payment.walletId,
        amountInPaise: payment.amountInPaise,
        currency: payment.currency,
        idempotencyKey: payment.idempotencyKey,
      },
      payment.userId,
    );

    expect(result).toEqual({
      ...payment,
      replayed: true,
    });
    expect(harness.prisma.wallet.findUnique).not.toHaveBeenCalled();
    expect(harness.prisma.payment.create).not.toHaveBeenCalled();
  });
});
