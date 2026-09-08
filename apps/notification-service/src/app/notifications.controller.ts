import { MetricsService } from './observability/metrics.service';
import { Controller, Logger } from '@nestjs/common';

import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

import { WalletEventPattern } from '@payflow/shared-events';

import { EmailService } from './email/email.service';

import {
  NotificationsGateway,
  RealtimeNotification,
} from './notifications.gateway';

import { NotificationIdempotencyService } from './notification-idempotency.service';

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
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly emailService: EmailService,

    private readonly notificationsGateway: NotificationsGateway,

    private readonly notificationIdempotency: NotificationIdempotencyService,

    private readonly metrics?: MetricsService,
  ) {}

  @EventPattern(WalletEventPattern.DepositCompleted)
  async handleDepositCompleted(
    @Payload()
    event: DepositEventPayload,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    await this.processMessage(context, 'deposit', async () => {
      const eventId = this.requireEventId(event.eventId);

      const email = this.requireEmail(
        event.user?.email,
        'Deposit event user email',
      );

      const dedupeKey = this.buildDedupeKey(eventId, 'deposit-email', email);

      await this.processNotificationSideEffect(
        {
          eventId,
          dedupeKey,

          eventType: WalletEventPattern.DepositCompleted,

          recipient: email,

          subject: 'Deposit completed successfully',
        },

        async () => {
          await this.emailService.sendDepositCompleted({
            email,

            firstName: event.user?.firstName,

            amount: event.amount ?? '0.00',

            currency: event.currency ?? 'INR',

            reference: event.reference,

            walletId: event.walletId,
          });

          this.emitRealtimeNotification({
            userId: event.user?.id,

            email,

            type: 'wallet.deposit.completed',

            title: 'Deposit completed',

            message: `${event.currency ?? 'INR'} ${event.amount ?? '0.00'} was added to your wallet.`,

            metadata: {
              transactionId: event.depositId,

              depositId: event.depositId,

              walletId: event.walletId,

              reference: event.reference,
            },
          });

          this.logger.log(`Deposit email processed for ${email}`);
        },
      );
    });
  }
  @EventPattern(WalletEventPattern.WithdrawalCompleted)
  async handleWithdrawalCompleted(
    @Payload()
    event: WithdrawalEventPayload,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    await this.processMessage(context, 'withdrawal', async () => {
      const eventId = this.requireEventId(event.eventId);

      const email = this.requireEmail(
        event.user?.email,
        'Withdrawal event user email',
      );

      const dedupeKey = this.buildDedupeKey(eventId, 'withdrawal-email', email);

      await this.processNotificationSideEffect(
        {
          eventId,
          dedupeKey,

          eventType: WalletEventPattern.WithdrawalCompleted,

          recipient: email,

          subject: 'Withdrawal completed successfully',
        },

        async () => {
          await this.emailService.sendWithdrawalCompleted({
            email,

            firstName: event.user?.firstName,

            amount: event.amount ?? '0.00',

            currency: event.currency ?? 'INR',

            reference: event.reference,

            walletId: event.walletId,
          });

          this.emitRealtimeNotification({
            userId: event.user?.id,

            email,

            type: 'wallet.withdrawal.completed',

            title: 'Withdrawal completed',

            message: `${event.currency ?? 'INR'} ${event.amount ?? '0.00'} was withdrawn from your wallet.`,

            metadata: {
              transactionId: event.withdrawalId,

              withdrawalId: event.withdrawalId,

              walletId: event.walletId,

              reference: event.reference,
            },
          });

          this.logger.log(`Withdrawal email processed for ${email}`);
        },
      );
    });
  }
  @EventPattern(WalletEventPattern.TransferCompleted)
  async handleTransferCompleted(
    @Payload()
    event: TransferEventPayload,

    @Ctx()
    context: RmqContext,
  ): Promise<void> {
    await this.processMessage(context, 'transfer', async () => {
      const eventId = this.requireEventId(event.eventId);

      const senderEmail = this.requireEmail(
        event.sender?.email,
        'Transfer sender email',
      );

      const receiverEmail = this.requireEmail(
        event.receiver?.email,
        'Transfer receiver email',
      );

      const senderName = this.getFullName(event.sender);

      const receiverName = this.getFullName(event.receiver);

      const senderDedupeKey = this.buildDedupeKey(
        eventId,
        'transfer-sender-email',
        senderEmail,
      );

      const receiverDedupeKey = this.buildDedupeKey(
        eventId,
        'transfer-receiver-email',
        receiverEmail,
      );

      await this.processNotificationSideEffect(
        {
          eventId,

          dedupeKey: senderDedupeKey,

          eventType: WalletEventPattern.TransferCompleted,

          recipient: senderEmail,

          subject: 'Money sent successfully',
        },

        async () => {
          await this.emailService.sendTransferSent({
            email: senderEmail,

            firstName: event.sender?.firstName,

            amount: event.amount ?? '0.00',

            currency: event.currency ?? 'INR',

            receiverName,

            description: event.description,

            transferId: event.transferId,
          });
        },
      );

      await this.processNotificationSideEffect(
        {
          eventId,

          dedupeKey: receiverDedupeKey,

          eventType: WalletEventPattern.TransferCompleted,

          recipient: receiverEmail,

          subject: 'Money received successfully',
        },

        async () => {
          await this.emailService.sendTransferReceived({
            email: receiverEmail,

            firstName: event.receiver?.firstName,

            amount: event.amount ?? '0.00',

            currency: event.currency ?? 'INR',

            senderName,

            description: event.description,

            transferId: event.transferId,
          });
        },
      );

      this.logger.log(
        `Transfer emails processed for ${senderEmail} and ${receiverEmail}`,
      );
    });
  }
  private requireEventId(eventId: string | undefined): string {
    const normalized = eventId?.trim();

    if (!normalized) {
      throw new Error('Notification eventId is missing');
    }

    return normalized;
  }

  private buildDedupeKey(
    eventId: string,
    sideEffect: string,
    recipient: string,
  ): string {
    return [eventId, sideEffect, recipient.trim().toLowerCase()].join(':');
  }

  private async processNotificationSideEffect(
    input: {
      eventId: string;
      dedupeKey: string;
      eventType: string;
      recipient: string;
      subject: string;
    },

    handler: () => Promise<void>,
  ): Promise<void> {
    const claim = await this.notificationIdempotency.begin(input);

    if (claim.action === 'SKIP_SENT') {
      this.metrics?.recordIdempotency(
        'duplicate',
      );

      this.metrics?.recordNotificationEvent(
        'delivery',
        'duplicate',
      );

      this.logger.log(`Notification already sent; skipping ${input.dedupeKey}`);

      return;
    }

    if (claim.action === 'BUSY') {
      this.metrics?.recordIdempotency(
        'busy',
      );

      this.metrics?.recordNotificationEvent(
        'delivery',
        'busy',
      );

      throw new Error(
        `Notification processing already active: ${input.dedupeKey}`,
      );
    }

    this.metrics?.recordIdempotency(
      'accepted',
    );

    const deliveryStartedAt =
      Date.now();

    let deliveryCompleted =
      false;

    try {
      await handler();

      deliveryCompleted =
        true;

      this.metrics?.recordDelivery(
        'email',
        'success',
        (Date.now() - deliveryStartedAt) / 1000,
      );

      await this.notificationIdempotency.markSent(input.dedupeKey);

      this.metrics?.recordNotificationEvent(
        'delivery',
        'processed',
      );
    } catch (error) {
      if (!deliveryCompleted) {
        this.metrics?.recordDelivery(
          'email',
          'failure',
          (Date.now() - deliveryStartedAt) / 1000,
        );
      }

      this.metrics?.recordNotificationEvent(
        'delivery',
        'failed',
      );

      try {
        await this.notificationIdempotency.markFailed(input.dedupeKey, error);
      } catch (trackingError) {
        this.logger.error(
          `Failed to persist notification failure: ${input.dedupeKey}`,

          trackingError instanceof Error
            ? trackingError.stack
            : String(trackingError),
        );
      }

      throw error;
    }
  }
  private emitRealtimeNotification(input: {
    userId?: string;
    email?: string;
    type: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  }): void {
    const now = new Date().toISOString();

    const notification: RealtimeNotification = {
      id: crypto.randomUUID(),

      userId: input.userId ?? null,

      email: input.email ?? null,

      type: input.type,

      title: input.title,

      message: input.message,

      channel: 'IN_APP',

      status: 'SENT',

      isRead: false,

      metadata: input.metadata,

      createdAt: now,

      readAt: null,

      updatedAt: now,
    };

    this.notificationsGateway.emitToUser(input.userId, notification);
  }

  private async processMessage(
    context: RmqContext,
    eventName: string,
    handler: () => Promise<void>,
  ): Promise<void> {
    const channel = context.getChannelRef();

    const message = context.getMessage();

    try {
      await handler();

      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `Failed to process ${eventName} event`,

        error instanceof Error ? error.stack : String(error),
      );

      channel.nack(message, false, true);
    }
  }

  private requireEmail(email: string | undefined, fieldName: string): string {
    const normalized = email?.trim();

    if (!normalized) {
      throw new Error(`${fieldName} is missing`);
    }

    return normalized;
  }

  private getFullName(user?: EventUser): string {
    const fullName = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return fullName || 'Payflow customer';
  }
}
