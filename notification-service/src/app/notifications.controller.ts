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
      context.getChannelRef();

    const message =
      context.getMessage();

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

      channel.nack(
        message,
        false,
        true,
      );
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
      context.getChannelRef();

    const message =
      context.getMessage();

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

      channel.nack(
        message,
        false,
        true,
      );
    }
  }
}