import { serializeOperationalLog } from '../../observability/operational-log';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { HttpService } from '@nestjs/axios';

import { Cron } from '@nestjs/schedule';

import { firstValueFrom } from 'rxjs';

import { PrismaService } from '@payflow/database';
import {
  OutboxEventProducer,
  PaymentCompletedEventPayload,
  PaymentEventPattern,
  PaymentEventVersion,
} from '@payflow/shared-events';

import { PaymentRailProvider } from '../../payment-rails/payment-rail-provider';

import { PAYMENT_RAIL_PROVIDER } from '../../payment-rails/payment-rail.tokens';
import { assertPaymentTransition } from '../payment-state-machine/payment-state-machine';

@Injectable()
export class ExternalPaymentSettlementService {
  private readonly logger = new Logger(ExternalPaymentSettlementService.name);

  private isSettling = false;

  private readonly batchSize = Number(
    process.env.EXTERNAL_PAYMENT_SETTLEMENT_BATCH_SIZE ?? 25,
  );

  private readonly cooldownMs = Number(
    process.env.EXTERNAL_PAYMENT_SETTLEMENT_COOLDOWN_MS ?? 300000,
  );

  private readonly walletServiceUrl = (
    process.env.WALLET_SERVICE_URL ?? 'http://localhost:4001/api/v1'
  ).replace(/\/$/, '');

  constructor(
    private readonly prisma: PrismaService,

    private readonly http: HttpService,

    @Inject(PAYMENT_RAIL_PROVIDER)
    private readonly paymentRail: PaymentRailProvider,
  ) {}

  @Cron('30 */1 * * * *')
  async settleExternalPayments() {
    if (this.isSettling) {
      return;
    }

    if (!this.paymentRail.isConfigured()) {
      return;
    }

    const token = process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN;

    if (!token) {
      this.logger.warn(
        serializeOperationalLog('payment.settlement.auth_unconfigured'),
      );

      return;
    }

    this.isSettling = true;

    try {
      await this.settleBatch(token);
    } catch (error: unknown) {
      this.logger.error(
        serializeOperationalLog('payment.settlement.cycle_failed'),
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isSettling = false;
    }
  }

  private async settleBatch(token: string) {
    const cutoff = new Date(Date.now() - this.cooldownMs);

    const payments = await this.prisma.payment.findMany({
      where: {
        provider: 'RAZORPAY',

        status: 'AUTHORIZED',

        providerOrderId: {
          not: null,
        },

        providerPaymentId: {
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
      await this.settlePayment(payment, cutoff, token);
    }
  }

  private async settlePayment(
    payment: {
      id: string;

      walletId: string;

      status: string;

      providerOrderId: string | null;

      providerPaymentId: string | null;

      amountInPaise: number;

      currency: string;

      lastRecoveryAt: Date | null;
    },

    cutoff: Date,

    token: string,
  ) {
    if (!payment.providerOrderId || !payment.providerPaymentId) {
      return;
    }

    const claimedAt = new Date();

    /*
     * This is an atomic work claim, not a money-state
     * transition. We deliberately keep AUTHORIZED
     * until settlement evidence is durable.
     */
    const claim = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,

        provider: 'RAZORPAY',

        status: 'AUTHORIZED',

        providerOrderId: payment.providerOrderId,

        providerPaymentId: payment.providerPaymentId,

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
      /*
       * AUTHORIZED alone is not settlement evidence.
       * Re-read the provider before any wallet credit.
       */
      const providerPayments = await this.paymentRail.findPaymentsByOrderId(
        payment.providerOrderId,
      );

      const matching = providerPayments.filter(
        (item) =>
          item.providerOrderId === payment.providerOrderId &&
          item.providerPaymentId === payment.providerPaymentId &&
          item.amountMinor === payment.amountInPaise &&
          item.currency.trim().toUpperCase() ===
            payment.currency.trim().toUpperCase() &&
          (item.captured === true ||
            item.status.trim().toLowerCase() === 'captured'),
      );

      /*
       * Exactly one captured evidence item must bind
       * to the already-authorized providerPaymentId.
       */
      if (matching.length !== 1) {
        await this.prisma.payment.updateMany({
          where: {
            id: payment.id,

            provider: 'RAZORPAY',

            status: 'AUTHORIZED',

            providerPaymentId: payment.providerPaymentId,
          },

          data: {
            status: 'NEEDS_REVIEW',

            failureReason:
              'External settlement requires exactly one matching captured provider payment',
          },
        });

        return;
      }

      /*
       * The wallet endpoint derives payment:<paymentId>
       * itself and performs payload binding.
       */
      const walletResponse = await firstValueFrom(
        this.http.post(
          this.walletServiceUrl + '/internal/settlements/payment',
          {
            paymentId: payment.id,

            walletId: payment.walletId,

            providerPaymentId: payment.providerPaymentId,

            amountInPaise: payment.amountInPaise,

            currency: payment.currency,
          },
          {
            headers: {
              'Content-Type': 'application/json',

              'x-payflow-service-token': token,
            },
          },
        ),
      );

      const walletEvidence = walletResponse.data as {
        id?: string;
        paymentId?: string;
        providerPaymentId?: string;
        idempotencyKey?: string;
        walletId?: string;
        amount?: string;
        currency?: string;
        reference?: string;
        status?: string;
        completedAt?: string | Date | null;
        replayed?: boolean;
      };

      const expectedAmount = (payment.amountInPaise / 100).toFixed(2);

      const evidenceMatches =
        typeof walletEvidence.id === 'string' &&
        walletEvidence.paymentId === payment.id &&
        walletEvidence.providerPaymentId === payment.providerPaymentId &&
        walletEvidence.idempotencyKey === 'payment:' + payment.id &&
        walletEvidence.walletId === payment.walletId &&
        walletEvidence.amount === expectedAmount &&
        walletEvidence.currency?.trim().toUpperCase() ===
          payment.currency.trim().toUpperCase() &&
        walletEvidence.reference === 'EXTERNAL-PAYMENT-' + payment.id &&
        walletEvidence.status === 'COMPLETED';

      if (!evidenceMatches) {
        await this.prisma.payment.updateMany({
          where: {
            id: payment.id,

            provider: 'RAZORPAY',

            status: 'AUTHORIZED',

            providerPaymentId: payment.providerPaymentId,
          },

          data: {
            status: 'NEEDS_REVIEW',

            failureReason:
              'Wallet settlement evidence did not match the authorized external payment',
          },
        });

        return;
      }

      /*
       * Wallet credit is now durably proven.
       *
       * Payflow COMPLETED + payment outbox event
       * must commit atomically.
       */
      assertPaymentTransition('AUTHORIZED', 'COMPLETED');

      const completion = await this.prisma.$transaction(async (tx) => {
        const updateResult = await tx.payment.updateMany({
          where: {
            id: payment.id,

            provider: 'RAZORPAY',

            status: 'AUTHORIZED',

            providerPaymentId: payment.providerPaymentId,
          },

          data: {
            status: 'COMPLETED',

            completedAt: new Date(),

            failureReason: null,
          },
        });

        if (updateResult.count !== 1) {
          return {
            completed: false,
          } as const;
        }

        const durablePayment = await tx.payment.findUnique({
          where: {
            id: payment.id,
          },

          select: {
            userId: true,
          },
        });

        if (!durablePayment) {
          throw new Error('Payment disappeared during settlement completion');
        }

        const eventPayload: PaymentCompletedEventPayload = {
          version: PaymentEventVersion.Completed,

          paymentId: payment.id,

          userId: durablePayment.userId,

          walletId: payment.walletId,

          amount: expectedAmount,

          currency: payment.currency,
        };

        await tx.outboxEvent.create({
          data: {
            producer: OutboxEventProducer.Payment,

            aggregateType: 'PAYMENT',

            aggregateId: payment.id,

            eventType: PaymentEventPattern.Completed,

            payload: eventPayload,
          },
        });

        return {
          completed: true,
        } as const;
      });

      if (!completion.completed) {
        const current = await this.prisma.payment.findUnique({
          where: {
            id: payment.id,
          },

          select: {
            status: true,

            providerPaymentId: true,
          },
        });

        if (
          current?.status === 'COMPLETED' &&
          current.providerPaymentId === payment.providerPaymentId
        ) {
          return;
        }

        assertPaymentTransition('AUTHORIZED', 'NEEDS_REVIEW');

        await this.prisma.payment.updateMany({
          where: {
            id: payment.id,

            provider: 'RAZORPAY',

            status: 'AUTHORIZED',
          },

          data: {
            status: 'NEEDS_REVIEW',

            failureReason:
              'Wallet settlement completed but payment completion lost the atomic race',
          },
        });
      }
    } catch (error: unknown) {
      this.logger.warn(
        serializeOperationalLog('payment.settlement.inconclusive', {
          paymentId: payment.id,
          reason:
            error instanceof Error ? error.message : 'Unknown settlement error',
        }),
      );

      /*
       * Keep AUTHORIZED.
       *
       * A timeout could mean wallet credit committed
       * but the HTTP response was lost. The next run
       * uses the same paymentId, therefore the wallet
       * service derives the same idempotency key and
       * returns durable replay evidence.
       */
    }
  }
}
