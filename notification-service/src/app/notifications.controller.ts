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
  handleTransferCompleted(
    @Payload()
    event: NotificationEvent,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    return this.handleEvent(
      'wallet.transfer.completed',
      event,
      context,
    );
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