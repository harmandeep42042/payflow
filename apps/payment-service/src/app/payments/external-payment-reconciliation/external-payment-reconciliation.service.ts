import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '@payflow/database';

import { PaymentRailProvider } from '../../payment-rails/payment-rail-provider';
import { PAYMENT_RAIL_PROVIDER } from '../../payment-rails/payment-rail.tokens';

import { decideExternalPaymentReconciliation } from './external-payment-reconciliation.policy';
import { MetricsService } from '../../observability/metrics.service';
import { assertPaymentTransition, PaymentLifecycleStatus } from '../payment-state-machine/payment-state-machine';

@Injectable()
export class ExternalPaymentReconciliationService {
  private readonly logger = new Logger(
    ExternalPaymentReconciliationService.name,
  );

  private isReconciling = false;

  private readonly batchSize = Number(
    process.env.EXTERNAL_PAYMENT_RECONCILIATION_BATCH_SIZE ?? 25,
  );

  private readonly cooldownMs = Number(
    process.env.EXTERNAL_PAYMENT_RECONCILIATION_COOLDOWN_MS ?? 300000,
  );

  constructor(
    private readonly prisma: PrismaService,

    @Inject(PAYMENT_RAIL_PROVIDER)
    private readonly paymentRail: PaymentRailProvider,
  
    @Optional()
    private readonly metrics?: MetricsService,
  ) {}

  @Cron('15 */1 * * * *')
  async reconcileExternalPayments() {
    if (this.isReconciling) {
      return;
    }

    if (!this.paymentRail.isConfigured()) {
      return;
    }

    this.isReconciling = true;

    try {
      await this.reconcileBatch();
    } catch (error: unknown) {
      this.logger.error(
        'External payment reconciliation cycle failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isReconciling = false;
    }
  }

  private async reconcileBatch() {
    const cutoff = new Date(Date.now() - this.cooldownMs);

    const payments = await this.prisma.payment.findMany({
      where: {
        provider: 'RAZORPAY',

        status: {
          in: ['ORDER_CREATED', 'NEEDS_REVIEW'],
        },

        providerOrderId: {
          not: null,
        },

        OR: [
          {
            lastRecoveryAt: null,
          },
          {
            lastRecoveryAt: {
              lte: cutoff,
            },
          },
        ],
      },

      orderBy: {
        updatedAt: 'asc',
      },

      take: this.batchSize,
    });

    for (const payment of payments) {
      await this.reconcilePayment(payment, cutoff);
    }
  }

  /**
   * Reconcile one durable Razorpay payment using the same authoritative
   * provider-evidence path used by the scheduled reconciliation worker.
   *
   * This method does not settle a wallet and does not mark a payment
   * COMPLETED. Settlement remains owned by the existing settlement worker.
   */
  async reconcileExternalPaymentByProviderOrderId(
    providerOrderId: string,
  ): Promise<'RECONCILED' | 'NOT_FOUND' | 'NOT_ELIGIBLE'> {
    const normalizedProviderOrderId = providerOrderId.trim();

    if (!normalizedProviderOrderId) {
      return 'NOT_FOUND';
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: 'RAZORPAY',
        providerOrderId: normalizedProviderOrderId,
      },
    });

    if (!payment) {
      return 'NOT_FOUND';
    }

    if (
      payment.status !== 'ORDER_CREATED' &&
      payment.status !== 'NEEDS_REVIEW'
    ) {
      return 'NOT_ELIGIBLE';
    }

    const cutoff = new Date();

    await this.reconcilePayment(payment, cutoff);

    return 'RECONCILED';
  }

  private async reconcilePayment(
    payment: {
      id: string;
      status: string;
      providerOrderId: string | null;
      providerPaymentId: string | null;
      amountInPaise: number;
      currency: string;
      lastRecoveryAt: Date | null;
    },
    cutoff: Date,
  ) {
    if (!payment.providerOrderId) {
      return;
    }

    const claimedAt = new Date();

    const claim = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,

        provider: 'RAZORPAY',

        status: payment.status as 'ORDER_CREATED' | 'NEEDS_REVIEW',

        providerOrderId: payment.providerOrderId,

        OR: [
          {
            lastRecoveryAt: payment.lastRecoveryAt,
          },
          {
            lastRecoveryAt: {
              lte: cutoff,
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

    try {
      const providerPayments = await this.paymentRail.findPaymentsByOrderId(
        payment.providerOrderId,
      );

      const decision = decideExternalPaymentReconciliation(
        {
          providerOrderId: payment.providerOrderId,

          amountInPaise: payment.amountInPaise,

          currency: payment.currency,
        },

        providerPayments,
      );

      assertPaymentTransition(
        payment.status as PaymentLifecycleStatus,
        decision.status,
      );

      if (decision.status === 'ORDER_CREATED') {
        await this.prisma.payment.updateMany({
          where: {
            id: payment.id,

            provider: 'RAZORPAY',

            status: {
              in: ['ORDER_CREATED', 'NEEDS_REVIEW'],
            },
          },

          data: {
            status: 'ORDER_CREATED',

            failureReason: null,
          },
        });

        this.metrics?.recordRecoveryEvent(
          'reconciliation',
          'order_created',
        );

        return;
      }

      if (decision.status === 'AUTHORIZED') {
        await this.prisma.payment.updateMany({
          where: {
            id: payment.id,

            provider: 'RAZORPAY',

            status: {
              in: ['ORDER_CREATED', 'NEEDS_REVIEW'],
            },
          },

          data: {
            status: 'AUTHORIZED',

            providerPaymentId: decision.providerPaymentId,

            authorizedAt: new Date(),

            failureReason: null,
          },
        });

        this.metrics?.recordRecoveryEvent(
          'reconciliation',
          'authorized',
        );

        return;
      }

      await this.prisma.payment.updateMany({
        where: {
          id: payment.id,

          provider: 'RAZORPAY',

          status: {
            in: ['ORDER_CREATED', 'NEEDS_REVIEW'],
          },
        },

        data: {
          status: 'NEEDS_REVIEW',

          failureReason:
            decision.reason ??
            'External payment reconciliation requires review',
        },
      });

      this.metrics?.recordRecoveryEvent(
        'reconciliation',
        'needs_review',
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown reconciliation error';

      this.logger.warn(
        'External payment reconciliation inconclusive for payment ' +
          payment.id +
          ': ' +
          message,
      );

      
      this.metrics?.recordRecoveryEvent(
        'reconciliation',
        'provider_error',
      );

      /*
       * Provider read failure is not evidence that money
       * did or did not move. Preserve current durable state.
       *
       * We only stamped lastRecoveryAt/recoveryAttempts
       * during the atomic claim.
       */
    }
  }
}
