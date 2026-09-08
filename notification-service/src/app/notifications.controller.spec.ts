jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { NotificationsController } from './notifications.controller';

describe('NotificationsController RabbitMQ reliability', () => {
  function createHarness() {
    const notificationsService = {
      process: jest.fn().mockResolvedValue(undefined),
    };
    const channel = {
      ack: jest.fn(),
      nack: jest.fn(),
      assertQueue: jest.fn().mockResolvedValue({}),
      sendToQueue: jest.fn().mockReturnValue(true),
    };
    const message = {
      content: Buffer.from('{"pattern":"wallet.deposit.completed"}'),
      properties: { headers: {}, contentType: 'application/json' },
    };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => message,
    };
    return {
      controller: new NotificationsController(notificationsService as never),
      notificationsService,
      channel,
      message,
      context,
    };
  }

  it('acknowledges only after successful notification persistence', async () => {
    const harness = createHarness();
    await harness.controller.handleDepositCompleted(
      { eventId: 'event-1', userId: 'user-1' },
      harness.context as never,
    );
    expect(harness.notificationsService.process).toHaveBeenCalled();
    expect(harness.channel.ack).toHaveBeenCalledWith(harness.message);
    expect(harness.channel.sendToQueue).not.toHaveBeenCalled();
  });
  it('schedules the first failed notification for delayed retry', async () => {
    const harness = createHarness();

    harness.notificationsService.process.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await harness.controller.handleDepositCompleted(
      {
        eventId: 'event-1',

        userId: 'user-1',
      },

      harness.context as never,
    );

    expect(harness.channel.assertQueue).toHaveBeenCalledWith(
      'wallet_events.retry.1',
      expect.objectContaining({
        durable: true,

        arguments: expect.objectContaining({
          'x-message-ttl': 5000,

          'x-dead-letter-exchange': '',

          'x-dead-letter-routing-key': 'wallet_events',
        }),
      }),
    );

    expect(harness.channel.sendToQueue).toHaveBeenCalledWith(
      'wallet_events.retry.1',
      harness.message.content,
      expect.objectContaining({
        persistent: true,

        headers: expect.objectContaining({
          'x-payflow-retry-count': 1,

          'x-payflow-event-name': 'wallet.deposit.completed',
        }),
      }),
    );

    expect(harness.channel.ack).toHaveBeenCalledWith(harness.message);

    expect(harness.channel.nack).not.toHaveBeenCalled();
  });

  it('increments retry count and schedules retry tier two', async () => {
    const harness = createHarness();

    harness.message.properties.headers = {
      'x-payflow-retry-count': 1,
    };

    harness.notificationsService.process.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await harness.controller.handleDepositCompleted(
      {
        eventId: 'event-1',

        userId: 'user-1',
      },

      harness.context as never,
    );

    expect(harness.channel.assertQueue).toHaveBeenCalledWith(
      'wallet_events.retry.2',
      expect.objectContaining({
        arguments: expect.objectContaining({
          'x-message-ttl': 15000,

          'x-dead-letter-routing-key': 'wallet_events',
        }),
      }),
    );

    expect(harness.channel.sendToQueue).toHaveBeenCalledWith(
      'wallet_events.retry.2',
      harness.message.content,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-payflow-retry-count': 2,
        }),
      }),
    );

    expect(harness.channel.ack).toHaveBeenCalledWith(harness.message);
  });

  it('moves an exhausted notification to the permanent dead-letter queue', async () => {
    const harness = createHarness();

    harness.message.properties.headers = {
      'x-payflow-retry-count': 3,
    };

    harness.notificationsService.process.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await harness.controller.handleDepositCompleted(
      {
        eventId: 'event-1',

        userId: 'user-1',
      },

      harness.context as never,
    );

    expect(harness.channel.assertQueue).toHaveBeenCalledWith(
      'wallet_events.dead',
      {
        durable: true,
      },
    );

    expect(harness.channel.sendToQueue).toHaveBeenCalledWith(
      'wallet_events.dead',
      harness.message.content,
      expect.objectContaining({
        persistent: true,

        headers: expect.objectContaining({
          'x-payflow-retry-count': 3,

          'x-payflow-dead-letter-reason': 'notification-retry-exhausted',

          'x-payflow-event-name': 'wallet.deposit.completed',
        }),
      }),
    );

    expect(harness.channel.ack).toHaveBeenCalledWith(harness.message);

    expect(harness.channel.nack).not.toHaveBeenCalled();
  });
  it('requeues the original when dead-letter routing fails', async () => {
    const harness = createHarness();
    harness.notificationsService.process.mockRejectedValue(
      new Error('Database unavailable'),
    );
    harness.channel.assertQueue.mockRejectedValue(
      new Error('RabbitMQ unavailable'),
    );
    await harness.controller.handleDepositCompleted(
      { eventId: 'event-1', userId: 'user-1' },
      harness.context as never,
    );
    expect(harness.channel.ack).not.toHaveBeenCalled();
    expect(harness.channel.nack).toHaveBeenCalledWith(
      harness.message,
      false,
      true,
    );
  });

  it.each([
    ['handleMoneyRequestCreated', 'money.request.created'],
    ['handleMoneyRequestAccepted', 'money.request.accepted'],
    ['handleMoneyRequestDeclined', 'money.request.declined'],
    ['handleMoneyRequestCancelled', 'money.request.cancelled'],
    ['handleSplitCreated', 'split.created'],
    ['handleSplitPaid', 'split.allocation.paid'],
    ['handleOfferClaimed', 'offer.claimed'],
    ['handleRechargeStatus', 'recharge.status'],
    ['handleBillPaymentStatus', 'bill.payment.status'],
    ['handleMandateCreated', 'mandate.created'],
    ['handleMandatePaused', 'mandate.pause'],
    ['handleMandateResumed', 'mandate.resume'],
    ['handleMandateCancelled', 'mandate.cancel'],
    ['handleCaseUpdated', 'support.case.updated'],
  ] as const)(
    'fans out %s once per unique intended recipient',
    async (handler, eventName) => {
      const harness = createHarness();
      await harness.controller[handler](
        { eventId: 'event-1', userIds: ['user-1', 'user-2', 'user-1'] },
        harness.context as never,
      );
      expect(harness.notificationsService.process).toHaveBeenCalledTimes(2);
      expect(harness.notificationsService.process).toHaveBeenNthCalledWith(
        1,
        eventName,
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(harness.notificationsService.process).toHaveBeenNthCalledWith(
        2,
        eventName,
        expect.objectContaining({ userId: 'user-2' }),
      );
      expect(harness.channel.ack).toHaveBeenCalledWith(harness.message);
    },
  );
});
