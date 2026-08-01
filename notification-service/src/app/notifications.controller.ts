import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  @EventPattern('wallet.transfer.completed')
  handleTransferCompleted(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): void {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    try {
      this.logger.log(
        `Transfer event received: ${JSON.stringify(event)}`,
      );

      this.logger.log('Transfer notification sent');

      channel.ack(message);
    } catch (error) {
      this.logger.error(
        'Failed to process transfer event',
        error instanceof Error ? error.stack : String(error),
      );

      channel.nack(message, false, true);
    }
  }

  @EventPattern('wallet.deposit.completed')
  handleDepositCompleted(
    @Payload() event: unknown,
    @Ctx() context: RmqContext,
  ): void {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    try {
      this.logger.log(
        `Deposit event received: ${JSON.stringify(event)}`,
      );

      this.logger.log('Deposit notification sent');

      channel.ack(message);
    } catch (error) {
      this.logger.error(
        'Failed to process deposit event',
        error instanceof Error ? error.stack : String(error),
      );

      channel.nack(message, false, true);
    }
  }
}