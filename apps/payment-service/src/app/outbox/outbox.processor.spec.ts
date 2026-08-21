import {
  OutboxEventProducer,
  PaymentEventPattern,
  PaymentEventVersion,
} from '@payflow/shared-events';

jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import {
  OutboxProcessor,
} from './outbox.processor';

describe('Payment OutboxProcessor', () => {
  const event = {
    id: 'payment-event-1',
    producer:
      OutboxEventProducer.Payment,
    aggregateType: 'PAYMENT',
    aggregateId: 'payment-1',
    eventType:
      PaymentEventPattern.Completed,
    payload: {
      version:
        PaymentEventVersion.Completed,
      paymentId: 'payment-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      amount: '10.00',
      currency: 'INR',
    },
    status: 'PENDING',
    attempts: 0,
    createdAt:
      new Date(
        '2026-08-21T00:00:00.000Z',
      ),
    publishedAt: null,
    lastError: null,
  };

  function createHarness(
    events = [event],
  ) {
    const outboxService = {
      getPendingEvents:
        jest.fn().mockResolvedValue(events),
      markPublished:
        jest.fn().mockResolvedValue(undefined),
    };
    const publisher = {
      publish:
        jest.fn().mockResolvedValue(undefined),
    };
    const processor = new OutboxProcessor(
      outboxService as never,
      publisher as never,
    );

    return {
      processor,
      outboxService,
      publisher,
    };
  }

  it('publishes the versioned Payment event envelope and marks it published', async () => {
    const harness = createHarness();

    await harness.processor
      .processPendingEvents();

    expect(
      harness.publisher.publish,
    ).toHaveBeenCalledWith(
      PaymentEventPattern.Completed,
      {
        ...event.payload,
        type:
          PaymentEventPattern.Completed,
        eventId: event.id,
        occurredAt:
          event.createdAt.toISOString(),
        aggregateType:
          event.aggregateType,
        aggregateId:
          event.aggregateId,
      },
    );
    expect(
      harness.outboxService.markPublished,
    ).toHaveBeenCalledWith(event.id);
  });

  it('does not mark an event published when RabbitMQ publication fails', async () => {
    const harness = createHarness();
    harness.publisher.publish.mockRejectedValue(
      new Error('RabbitMQ unavailable'),
    );

    await harness.processor
      .processPendingEvents();

    expect(
      harness.outboxService.markPublished,
    ).not.toHaveBeenCalled();
  });

  it('does nothing when there are no pending Payment events', async () => {
    const harness = createHarness([]);

    await harness.processor
      .processPendingEvents();

    expect(
      harness.publisher.publish,
    ).not.toHaveBeenCalled();
    expect(
      harness.outboxService.markPublished,
    ).not.toHaveBeenCalled();
  });
});
