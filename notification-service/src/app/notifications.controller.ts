import {
  Controller,
  Logger,
} from '@nestjs/common';

import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

import {
  NotificationEvent,
  NotificationsService,
} from './notifications.service';

type DeadLetterChannel = {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo: boolean, requeue: boolean): void;
  assertQueue(queue: string, options: Record<string, unknown>): Promise<unknown>;
  sendToQueue(queue: string, content: Buffer, options: Record<string, unknown>): boolean;
};

type DeadLetterMessage = {
  content: Buffer;
  properties?: {
    headers?: Record<string, unknown>;
    contentType?: string;
    contentEncoding?: string;
  };
};

@Controller()
export class NotificationsController {
  private readonly logger =
    new Logger(
      NotificationsController.name,
    );

  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @EventPattern(
    'wallet.deposit.completed',
  )
  handleDepositCompleted(
    @Payload()
    event: NotificationEvent,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    return this.handleEvent(
      'wallet.deposit.completed',
      event,
      context,
    );
  }

  @EventPattern(
    'wallet.withdrawal.completed',
  )
  handleWithdrawalCompleted(
    @Payload()
    event: NotificationEvent,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    return this.handleEvent(
      'wallet.withdrawal.completed',
      event,
      context,
    );
  }

  @EventPattern(
    'wallet.transfer.completed',
  )
  async handleTransferCompleted(
    @Payload()
    event: NotificationEvent,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    const channel =
      context.getChannelRef() as DeadLetterChannel;

    const message =
      context.getMessage() as unknown as DeadLetterMessage;

    try {
      this.logger.log(
        `Received wallet.transfer.completed: ${JSON.stringify(
          event,
        )}`,
      );

      const sender =
        event.sender as
          | {
              id?: string;
              email?: string;
              firstName?: string;
              lastName?: string;
            }
          | undefined;

      const receiver =
        event.receiver as
          | {
              id?: string;
              email?: string;
              firstName?: string;
              lastName?: string;
            }
          | undefined;

      if (!sender?.id || !receiver?.id) {
        throw new Error(
          'Transfer event sender/receiver userId is missing',
        );
      }

      const amount =
        event.amount ?? '0';

      const currency =
        event.currency ?? 'INR';

      const transferId =
        event.transferId ?? null;

      await Promise.all([
        this.notificationsService.process(
          'wallet.transfer.sent',
          {
            ...event,
            userId: sender.id,
            email:
              sender.email ?? null,
            type:
              'wallet.transfer.sent',
            title:
              'Money sent',
            message:
              `${currency} ${amount} was sent successfully.`,
            metadata: {
              transferId,
              direction: 'SENT',
              counterparty:
                receiver.email ?? null,
            },
          },
        ),

        this.notificationsService.process(
          'wallet.transfer.received',
          {
            ...event,
            userId: receiver.id,
            email:
              receiver.email ?? null,
            type:
              'wallet.transfer.received',
            title:
              'Money received',
            message:
              `${currency} ${amount} was received successfully.`,
            metadata: {
              transferId,
              direction: 'RECEIVED',
              counterparty:
                sender.email ?? null,
            },
          },
        ),
      ]);

      channel.ack(message);

      this.logger.log(
        'Acknowledged wallet.transfer.completed',
      );
    } catch (error) {
      this.logger.error(
        'Failed to process wallet.transfer.completed',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      await this.deadLetter(channel, message, 'wallet.transfer.completed');
    }
  }

  @EventPattern(
    'payment.completed',
  )
  handlePaymentCompleted(
    @Payload()
    event: NotificationEvent,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    return this.handleEvent(
      'payment.completed',
      event,
      context,
    );
  }

  @EventPattern(
    'user.registered',
  )
  handleUserRegistered(
    @Payload()
    event: NotificationEvent,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    return this.handleEvent(
      'user.registered',
      event,
      context,
    );
  }

  private async handleEvent(
    eventName: string,
    event: NotificationEvent,
    context: RmqContext,
  ): Promise<void> {
    const channel =
      context.getChannelRef() as DeadLetterChannel;

    const message =
      context.getMessage() as unknown as DeadLetterMessage;

    try {
      this.logger.log(
        `Received ${eventName}: ${JSON.stringify(
          event,
        )}`,
      );

      await this.notificationsService
        .process(
          eventName,
          event,
        );

      channel.ack(message);

      this.logger.log(
        `Acknowledged ${eventName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process ${eventName}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      await this.deadLetter(channel, message, eventName);
    }
  }

  private async deadLetter(
    channel: DeadLetterChannel,
    message: DeadLetterMessage,
    eventName: string,
  ): Promise<void> {
    const primaryQueue = process.env['RABBITMQ_QUEUE'] ?? 'wallet_events';
    const deadLetterQueue = `${primaryQueue}.dead`;

    try {
      await channel.assertQueue(deadLetterQueue, { durable: true });
      channel.sendToQueue(deadLetterQueue, message.content, {
        persistent: true,
        contentType: message.properties?.contentType,
        contentEncoding: message.properties?.contentEncoding,
        headers: {
          ...message.properties?.headers,
          'x-payflow-dead-letter-reason': 'notification-processing-failed',
          'x-payflow-event-name': eventName,
        },
      });
      channel.ack(message);
    } catch (routingError) {
      this.logger.error(
        `Failed to route ${eventName} to the notification dead-letter queue`,
        routingError instanceof Error ? routingError.stack : String(routingError),
      );
      channel.nack(message, false, true);
    }
  }
}
