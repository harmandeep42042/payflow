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
  WalletEventPattern,
} from '@payflow/shared-events';

import {
  EmailService,
} from './email/email.service';

import {
  NotificationsGateway,
  RealtimeNotification,
} from './notifications.gateway';

type EventUser = {
  id?: string;
  email?: string;
  phone?: string | null;
  firstName?: string;
  lastName?: string | null;
};

type DepositEventPayload = {
  eventId?: string;
  depositId?: string;
  walletId?: string;
  amount?: string;
  currency?: string;
  reference?: string;
  user?: EventUser;
};

type WithdrawalEventPayload = {
  eventId?: string;
  withdrawalId?: string;
  walletId?: string;
  amount?: string;
  currency?: string;
  reference?: string;
  user?: EventUser;
};

type TransferEventPayload = {
  eventId?: string;
  transferId?: string;
  sourceWalletId?: string;
  destinationWalletId?: string;
  amount?: string;
  currency?: string;
  description?: string | null;
  sender?: EventUser;
  receiver?: EventUser;
};

@Controller()
export class NotificationsController {
  private readonly logger =
    new Logger(
      NotificationsController.name,
    );

  constructor(
    private readonly emailService:
      EmailService,

    private readonly notificationsGateway:
      NotificationsGateway,
  ) {}

  @EventPattern(
    WalletEventPattern.DepositCompleted,
  )
  async handleDepositCompleted(
    @Payload()
    event: DepositEventPayload,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    await this.processMessage(
      context,
      'deposit',
      async () => {
        const email =
          this.requireEmail(
            event.user?.email,
            'Deposit event user email',
          );

        await this.emailService
          .sendDepositCompleted({
            email,

            firstName:
              event.user?.firstName,

            amount:
              event.amount ??
              '0.00',

            currency:
              event.currency ??
              'INR',

            reference:
              event.reference,

            walletId:
              event.walletId,
          });

        this.emitRealtimeNotification({
          userId:
            event.user?.id,

          email,

          type:
            'wallet.deposit.completed',

          title:
            'Deposit completed',

          message:
            `${event.currency ?? 'INR'} ${event.amount ?? '0.00'} was added to your wallet.`,

          metadata: {
            transactionId:
              event.depositId,

            depositId:
              event.depositId,

            walletId:
              event.walletId,

            reference:
              event.reference,
          },
        });

        this.logger.log(
          `Deposit email processed for ${email}`,
        );
      },
    );
  }

  @EventPattern(
    WalletEventPattern
      .WithdrawalCompleted,
  )
  async handleWithdrawalCompleted(
    @Payload()
    event: WithdrawalEventPayload,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    await this.processMessage(
      context,
      'withdrawal',
      async () => {
        const email =
          this.requireEmail(
            event.user?.email,
            'Withdrawal event user email',
          );

        await this.emailService
          .sendWithdrawalCompleted({
            email,

            firstName:
              event.user?.firstName,

            amount:
              event.amount ??
              '0.00',

            currency:
              event.currency ??
              'INR',

            reference:
              event.reference,

            walletId:
              event.walletId,
          });

        this.emitRealtimeNotification({
          userId:
            event.user?.id,

          email,

          type:
            'wallet.withdrawal.completed',

          title:
            'Withdrawal completed',

          message:
            `${event.currency ?? 'INR'} ${event.amount ?? '0.00'} was withdrawn from your wallet.`,

          metadata: {
            transactionId:
              event.withdrawalId,

            withdrawalId:
              event.withdrawalId,

            walletId:
              event.walletId,

            reference:
              event.reference,
          },
        });

        this.logger.log(
          `Withdrawal email processed for ${email}`,
        );
      },
    );
  }

  @EventPattern(
    WalletEventPattern.TransferCompleted,
  )
  async handleTransferCompleted(
    @Payload()
    event: TransferEventPayload,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    await this.processMessage(
      context,
      'transfer',
      async () => {
        const senderEmail =
          this.requireEmail(
            event.sender?.email,
            'Transfer sender email',
          );

        const receiverEmail =
          this.requireEmail(
            event.receiver?.email,
            'Transfer receiver email',
          );

        const senderName =
          this.getFullName(
            event.sender,
          );

        const receiverName =
          this.getFullName(
            event.receiver,
          );

        await Promise.all([
          this.emailService
            .sendTransferSent({
              email:
                senderEmail,

              firstName:
                event.sender
                  ?.firstName,

              amount:
                event.amount ??
                '0.00',

              currency:
                event.currency ??
                'INR',

              receiverName,

              description:
                event.description,

              transferId:
                event.transferId,
            }),

          this.emailService
            .sendTransferReceived({
              email:
                receiverEmail,

              firstName:
                event.receiver
                  ?.firstName,

              amount:
                event.amount ??
                '0.00',

              currency:
                event.currency ??
                'INR',

              senderName,

              description:
                event.description,

              transferId:
                event.transferId,
            }),
        ]);

        this.logger.log(
          `Transfer emails processed for ${senderEmail} and ${receiverEmail}`,
        );
      },
    );
  }

  private emitRealtimeNotification(
    input: {
      userId?: string;
      email?: string;
      type: string;
      title: string;
      message: string;
      metadata:
        Record<string, unknown>;
    },
  ): void {
    const now =
      new Date()
        .toISOString();

    const notification:
      RealtimeNotification = {
        id:
          crypto.randomUUID(),

        userId:
          input.userId ??
          null,

        email:
          input.email ??
          null,

        type:
          input.type,

        title:
          input.title,

        message:
          input.message,

        channel:
          'IN_APP',

        status:
          'SENT',

        isRead:
          false,

        metadata:
          input.metadata,

        createdAt:
          now,

        readAt:
          null,

        updatedAt:
          now,
      };

    this.notificationsGateway
      .emitToUser(
        input.userId,
        notification,
      );
  }

  private async processMessage(
    context: RmqContext,
    eventName: string,
    handler: () => Promise<void>,
  ): Promise<void> {
    const channel =
      context.getChannelRef();

    const message =
      context.getMessage();

    try {
      await handler();

      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `Failed to process ${eventName} event`,

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

  private requireEmail(
    email: string | undefined,
    fieldName: string,
  ): string {
    const normalized =
      email?.trim();

    if (!normalized) {
      throw new Error(
        `${fieldName} is missing`,
      );
    }

    return normalized;
  }

  private getFullName(
    user?: EventUser,
  ): string {
    const fullName = [
      user?.firstName,
      user?.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return fullName ||
      'Payflow customer';
  }
}




