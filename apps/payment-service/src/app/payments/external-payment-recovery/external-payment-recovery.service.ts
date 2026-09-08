import { serializeOperationalLog } from '../../observability/operational-log';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '@payflow/database';

import { PaymentRailProvider } from '../../payment-rails/payment-rail-provider';
import { PAYMENT_RAIL_PROVIDER } from '../../payment-rails/payment-rail.tokens';
import { assertPaymentTransition } from '../payment-state-machine/payment-state-machine';

@Injectable()
export class ExternalPaymentRecoveryService {
  private readonly logger = new Logger(ExternalPaymentRecoveryService.name);

  private isRecovering = false;

  private readonly processingTimeoutMs = Number(
    process.env.EXTERNAL_PAYMENT_PROCESSING_TIMEOUT_MS ?? 120000,
  );

  private readonly retryCooldownMs = Number(
    process.env.EXTERNAL_PAYMENT_RECOVERY_COOLDOWN_MS ?? 300000,
  );

  private readonly batchSize = Number(
    process.env.EXTERNAL_PAYMENT_RECOVERY_BATCH_SIZE ?? 25,
  );

  constructor(
    private readonly prisma: PrismaService,

    @Inject(PAYMENT_RAIL_PROVIDER)
    private readonly paymentRail: PaymentRailProvider,
  ) {}

  @Cron('*/30 * * * * *')
  async recoverStaleExternalPayments() {
    if (this.isRecovering) {
      return;
    }

    if (!this.paymentRail.isConfigured()) {
      return;
    }

    this.isRecovering = true;

    try {
      await this.recoverStaleProcessingPayments();
    } catch (error: unknown) {
      this.logger.error(
        serializeOperationalLog('payment.recovery.cycle_failed'),
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isRecovering = false;
    }
  }

  private async recoverStaleProcessingPayments() {
    const now = Date.now();

    const processingCutoff = new Date(now - this.processingTimeoutMs);

    const recoveryCutoff = new Date(now - this.retryCooldownMs);

    const payments = await this.prisma.payment.findMany({
      where: {
        provider: 'RAZORPAY',

        status: 'PROCESSING',

        processingStartedAt: {
          lte: processingCutoff,
        },

        OR: [
          {
            lastRecoveryAt: null,
          },
          {
            lastRecoveryAt: {
              lte: recoveryCutoff,
            },
          },
        ],
      },

      orderBy: {
        processingStartedAt: 'asc',
      },

      take: this.batchSize,
    });

    for (const payment of payments) {
      await this.recoverPayment(payment, recoveryCutoff);
    }
  }

  private async recoverPayment(
    payment: {
      id: string;
      amountInPaise: number;
      currency: string;
      processingStartedAt: Date | null;
      lastRecoveryAt: Date | null;
    },
    recoveryCutoff: Date,
  ) {
    const claimedAt = new Date();

    const claim = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,

        provider: 'RAZORPAY',

        status: 'PROCESSING',

        processingStartedAt: payment.processingStartedAt,

        OR: [
          {
            lastRecoveryAt: payment.lastRecoveryAt,
          },
          {
            lastRecoveryAt: {
              lte: recoveryCutoff,
            },
          },
        ],
      },

      data: {
        lastRecoveryAt: claimedAt,

        recoveryAttempts: {
          increment: 1,
        },
      },
    });

    if (claim.count !== 1) {
      return;
    }

    const receipt = this.buildReceipt(payment.id);

    try {
      const providerOrder = await this.paymentRail.findOrderByReceipt(receipt);

      if (!providerOrder) {
        await this.markNeedsReview(
          payment.id,
          'Provider order not found during recovery',
        );

        return;
      }

      const currencyMatches =
        providerOrder.currency.toUpperCase() === payment.currency.toUpperCase();

      const amountMatches = providerOrder.amountMinor === payment.amountInPaise;

      if (!currencyMatches || !amountMatches) {
        await this.markNeedsReview(
          payment.id,
          'Provider recovery evidence does not match durable payment intent',
        );

        return;
      }

      assertPaymentTransition('PROCESSING', 'ORDER_CREATED');

      const rebound = await this.prisma.payment.updateMany({
        where: {
          id: payment.id,

          provider: 'RAZORPAY',

          status: 'PROCESSING',
        },

        data: {
          status: 'ORDER_CREATED',

          providerOrderId: providerOrder.providerOrderId,

          processingStartedAt: null,

          failureReason: null,
        },
      });

      if (rebound.count !== 1) {
        this.logger.warn(
          serializeOperationalLog('payment.recovery.bind_race', {
            paymentId: payment.id,
          }),
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown provider recovery error';

      this.logger.warn(
        serializeOperationalLog('payment.recovery.uncertain', {
          paymentId: payment.id,
          reason: message,
        }),
      );

      await this.markNeedsReview(
        payment.id,
        'Provider recovery lookup was inconclusive',
      );
    }
  }

  private async markNeedsReview(paymentId: string, reason: string) {
    assertPaymentTransition('PROCESSING', 'NEEDS_REVIEW');

    await this.prisma.payment.updateMany({
      where: {
        id: paymentId,

        provider: 'RAZORPAY',

        status: 'PROCESSING',
      },

      data: {
        status: 'NEEDS_REVIEW',

        processingStartedAt: null,

        failureReason: reason,
      },
    });
  }

  private buildReceipt(paymentId: string) {
    return 'payflow_' + paymentId.replace(/-/g, '').slice(0, 32);
  }
}
