import { OutboxEventProducer } from '@payflow/shared-events';

import { OutboxProcessor } from './outbox.processor';

describe('OutboxProcessor', () => {
  it('continues publishing Wallet-owned events returned by the scoped relay', async () => {
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
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date('2026-08-21T00:00:00.000Z'),
      publishedAt: null,
      lastError: null,
    };
    const outboxService = {
      getPendingEvents: jest.fn().mockResolvedValue([event]),
      markPublished: jest.fn().mockResolvedValue(undefined),
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

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      event.eventType,
      expect.objectContaining({
        eventId: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      }),
    );
    expect(outboxService.markPublished).toHaveBeenCalledWith(event.id);
  });
});
