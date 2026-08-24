import {
  OutboxEventProducer,
  PaymentEventPattern,
  PaymentEventVersion,
  WalletEventPattern,
} from '@payflow/shared-events';

jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { RewardsConsumer } from './rewards.consumer';

describe('RewardsConsumer', () => {
  const event = {
    type: PaymentEventPattern.Completed,
    version: PaymentEventVersion.Completed,
    eventId: 'event-1',
    occurredAt: '2026-08-21T00:00:00.000Z',
    aggregateType: 'PAYMENT',
    aggregateId: 'payment-1',
    paymentId: 'payment-1',
    userId: 'user-1',
    walletId: 'wallet-1',
    amount: '10.00',
    currency: 'INR',
  };

  function createHarness() {
    const rewardsService = {
      generateScratchCard: jest.fn()
        .mockResolvedValue({
          success: true,
          created: true,
          reward: {
            id: 'reward-1',
          },
        }),
    };
    const channel = {
      ack: jest.fn(),
      nack: jest.fn(),
      assertQueue: jest.fn().mockResolvedValue({}),
      sendToQueue: jest.fn().mockReturnValue(true),
    };
    const message = {
      content: Buffer.from(JSON.stringify(event)),
      fields: {
        deliveryTag: 1,
      },
      properties: {
        headers: {},
        contentType: 'application/json',
      },
    };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => message,
    };
    const consumer = new RewardsConsumer(
      rewardsService as never,
    );

    return {
      consumer,
      rewardsService,
      channel,
      message,
      context,
    };
  }

  it('persists a PAYMENT_COMPLETED reward before acknowledging', async () => {
    const harness = createHarness();
    let persistenceCompleted = false;

    harness.rewardsService
      .generateScratchCard
      .mockImplementation(async () => {
        expect(
          harness.channel.ack,
        ).not.toHaveBeenCalled();
        persistenceCompleted = true;
        return {
          success: true,
          created: true,
          reward: {
            id: 'reward-1',
          },
        };
      });

    await harness.consumer
      .handlePaymentCompleted(
        event,
        harness.context as never,
      );

    expect(persistenceCompleted).toBe(true);
    expect(
      harness.rewardsService
        .generateScratchCard,
    ).toHaveBeenCalledWith(
      event.userId,
      event.walletId,
      event.paymentId,
    );
    expect(
      harness.channel.ack,
    ).toHaveBeenCalledWith(
      harness.message,
    );
    expect(
      harness.channel.nack,
    ).not.toHaveBeenCalled();
  });

  it('acknowledges an idempotent reward replay', async () => {
    const harness = createHarness();
    harness.rewardsService
      .generateScratchCard
      .mockResolvedValue({
        success: true,
        created: false,
        reward: {
          id: 'reward-1',
        },
      });

    await harness.consumer
      .handlePaymentCompleted(
        event,
        harness.context as never,
      );

    expect(
      harness.channel.ack,
    ).toHaveBeenCalledTimes(1);
    expect(
      harness.channel.nack,
    ).not.toHaveBeenCalled();
  });

  it.each([
    ['type', WalletEventPattern.DepositCompleted],
    ['version', 2],
    ['eventId', ''],
    ['paymentId', ''],
    ['userId', ''],
    ['walletId', ''],
    ['amount', '0'],
    ['currency', ''],
    ['occurredAt', 'not-a-date'],
    ['aggregateType', OutboxEventProducer.Wallet],
    ['aggregateId', 'another-payment'],
  ])(
    'routes an invalid %s field to bounded retry',
    async (field, value) => {
      const harness = createHarness();

      await harness.consumer
        .handlePaymentCompleted(
          {
            ...event,
            [field]: value,
          },
          harness.context as never,
        );

      expect(
        harness.rewardsService
          .generateScratchCard,
      ).not.toHaveBeenCalled();
      expect(
        harness.channel.sendToQueue,
      ).toHaveBeenCalledWith(
        'payment_events.retry',
        harness.message.content,
        expect.objectContaining({
          persistent: true,
          headers: expect.objectContaining({
            'x-payflow-retry-count': 1,
          }),
        }),
      );
      expect(harness.channel.ack).toHaveBeenCalledWith(
        harness.message,
      );
      expect(harness.channel.nack).not.toHaveBeenCalled();
    },
  );

  it('schedules a bounded retry when Reward persistence fails', async () => {
    const harness = createHarness();
    harness.rewardsService
      .generateScratchCard
      .mockRejectedValue(
        new Error('Database unavailable'),
      );

    await harness.consumer
      .handlePaymentCompleted(
        event,
        harness.context as never,
      );

    expect(harness.channel.sendToQueue).toHaveBeenCalledWith(
      'payment_events.retry',
      harness.message.content,
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-payflow-retry-count': 1 }),
      }),
    );
    expect(harness.channel.ack).toHaveBeenCalledWith(harness.message);
    expect(harness.channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters after three failed attempts without another retry', async () => {
    const harness = createHarness();
    harness.message.properties.headers = { 'x-payflow-retry-count': 3 };
    harness.rewardsService.generateScratchCard.mockRejectedValue(new Error('Database unavailable'));

    await harness.consumer.handlePaymentCompleted(event, harness.context as never);

    expect(harness.channel.sendToQueue).toHaveBeenCalledWith(
      'payment_events.dead',
      harness.message.content,
      expect.objectContaining({ persistent: true }),
    );
    expect(harness.channel.sendToQueue).not.toHaveBeenCalledWith(
      'payment_events.retry',
      expect.anything(),
      expect.anything(),
    );
    expect(harness.channel.ack).toHaveBeenCalledWith(harness.message);
  });

  it('keeps the original delivery when retry routing fails', async () => {
    const harness = createHarness();
    harness.rewardsService.generateScratchCard.mockRejectedValue(new Error('Database unavailable'));
    harness.channel.assertQueue.mockRejectedValue(new Error('RabbitMQ unavailable'));

    await harness.consumer.handlePaymentCompleted(event, harness.context as never);

    expect(harness.channel.ack).not.toHaveBeenCalled();
    expect(harness.channel.nack).toHaveBeenCalledWith(harness.message, false, true);
  });
});
