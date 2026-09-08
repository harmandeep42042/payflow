import { OutboxEventProducer } from '@payflow/shared-events';

import { OutboxProcessor } from './outbox.processor';

describe('OutboxProcessor atomic claims', () => {
  it('publishes claimed event using the same worker ownership token', async () => {
    const event = {
      id: 'wallet-event-1',

      producer: OutboxEventProducer.Wallet,

      aggregateType: 'DEPOSIT',

      aggregateId: 'deposit-1',

      eventType: 'wallet.deposit.completed',

      payload: {
        depositId: 'deposit-1',

        walletId: 'wallet-1',

        amount: '10.00',

        currency: 'INR',
      },

      status: 'PROCESSING',

      attempts: 0,

      claimedAt: new Date(),

      claimedBy: 'worker',

      createdAt: new Date('2026-08-21T00:00:00.000Z'),

      publishedAt: null,

      lastError: null,
    };

    const outboxService = {
      claimPendingEvents: jest.fn().mockResolvedValue([event]),

      markPublished: jest.fn().mockResolvedValue({
        count: 1,
      }),

      recordPublishFailure: jest.fn(),
    };

    const publisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },

      wallet: {
        findUnique: jest.fn(),
      },
    };

    const processor = new OutboxProcessor(
      outboxService as never,
      publisher as never,
      prisma as never,
    );

    await processor.processPendingEvents();

    expect(outboxService.claimPendingEvents).toHaveBeenCalledTimes(1);

    const workerId = outboxService.claimPendingEvents.mock.calls[0][0];

    expect(typeof workerId).toBe('string');

    expect(workerId.length).toBeGreaterThan(0);

    expect(publisher.publish).toHaveBeenCalledTimes(1);

    expect(outboxService.markPublished).toHaveBeenCalledWith(
      event.id,
      workerId,
    );

    expect(outboxService.recordPublishFailure).not.toHaveBeenCalled();
  });

  it('records broker failure using the same worker ownership token', async () => {
    const event = {
      id: 'wallet-event-failure',

      producer: OutboxEventProducer.Wallet,

      aggregateType: 'DEPOSIT',

      aggregateId: 'deposit-failure',

      eventType: 'wallet.deposit.completed',

      payload: {},

      status: 'PROCESSING',

      attempts: 0,

      claimedAt: new Date(),

      claimedBy: 'worker',

      createdAt: new Date(),

      publishedAt: null,

      lastError: null,
    };

    const publishError = new Error('RabbitMQ unavailable');

    const outboxService = {
      claimPendingEvents: jest.fn().mockResolvedValue([event]),

      markPublished: jest.fn(),

      recordPublishFailure: jest.fn().mockResolvedValue({
        status: 'PENDING',

        attempts: 1,
      }),
    };

    const publisher = {
      publish: jest.fn().mockRejectedValue(publishError),
    };

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },

      wallet: {
        findUnique: jest.fn(),
      },
    };

    const processor = new OutboxProcessor(
      outboxService as never,
      publisher as never,
      prisma as never,
    );

    await processor.processPendingEvents();

    const workerId = outboxService.claimPendingEvents.mock.calls[0][0];

    expect(outboxService.recordPublishFailure).toHaveBeenCalledWith(
      event.id,
      publishError,
      workerId,
    );

    expect(outboxService.markPublished).not.toHaveBeenCalled();
  });
});
