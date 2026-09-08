import { Injectable, Logger } from '@nestjs/common';
import { ExternalPaymentReconciliationService } from './external-payment-reconciliation.service';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@payflow/database';
import { ExternalPaymentWebhookLifecycleService } from './external-payment-webhook-lifecycle.service';
import { RazorpayWebhookProcessorService } from '../../webhooks/razorpay/razorpay-webhook-processor.service';

@Injectable()
export class ExternalPaymentWebhookWorkerService {
  private readonly logger = new Logger(
    ExternalPaymentWebhookWorkerService.name,
  );

  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ExternalPaymentWebhookLifecycleService,
    private readonly webhookProcessor: RazorpayWebhookProcessorService,

    private readonly reconciliation: ExternalPaymentReconciliationService,
  ) {}

  @Cron('*/10 * * * * *')
  async processReceivedWebhookEvents(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const staleBefore = new Date(Date.now() - 15 * 60 * 1000);

      await this.webhookProcessor.parkStaleProcessing(staleBefore);

      const events = await this.prisma.providerWebhookEvent.findMany({
        where: {
          provider: 'RAZORPAY',
          status: 'RECEIVED',
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 25,
        select: {
          id: true,
        },
      });

      for (const event of events) {
        try {
          await this.lifecycle.process(event.id);
        } catch (error) {
          const reason =
            error instanceof Error
              ? error.message
              : 'Unknown webhook lifecycle worker failure';

          this.logger.warn(
            'Webhook lifecycle worker failed for event ' +
              event.id +
              ': ' +
              reason,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Reconciles parked webhook events through authoritative payment
   * evidence. Review events are never returned to RECEIVED.
   */
  @Cron('45 */1 * * * *')
  async processNeedsReviewWebhookEvents(): Promise<void> {
    const reviewReconciliationEnabled =
      process.env.EXTERNAL_WEBHOOK_REVIEW_RECONCILIATION_ENABLED === 'true';

    if (!reviewReconciliationEnabled) {
      return;
    }
    if (this.running) {
      return;
    }

    if (!this.reconciliation) {
      return;
    }

    this.running = true;

    try {
      const events = await this.prisma.providerWebhookEvent.findMany({
        where: {
          provider: 'RAZORPAY',
          status: 'NEEDS_REVIEW',
          providerOrderId: {
            not: null,
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
        take: 10,
      });

      for (const event of events) {
        const claimed =
          await this.webhookProcessor.claimNeedsReviewForReconciliation(
            event.id,
          );

        if (!claimed) {
          continue;
        }

        try {
          if (!event.providerOrderId) {
            await this.webhookProcessor.releaseReviewClaim(
              event.id,
              'Webhook review event is missing providerOrderId correlation',
            );
            continue;
          }

          const result =
            await this.reconciliation.reconcileExternalPaymentByProviderOrderId(
              event.providerOrderId,
            );

          if (result === 'NOT_FOUND' || result === 'NOT_ELIGIBLE') {
            await this.webhookProcessor.releaseReviewClaim(
              event.id,
              'Authoritative webhook review could not reconcile durable payment',
            );
            continue;
          }

          const payment = await this.prisma.payment.findFirst({
            where: {
              provider: 'RAZORPAY',
              providerOrderId: event.providerOrderId,
            },
          });

          if (!payment) {
            await this.webhookProcessor.releaseReviewClaim(
              event.id,
              'Durable payment missing after authoritative webhook review',
            );
            continue;
          }

          if (
            event.providerPaymentId &&
            payment.providerPaymentId &&
            event.providerPaymentId !== payment.providerPaymentId
          ) {
            await this.webhookProcessor.releaseReviewClaim(
              event.id,
              'Authoritative providerPaymentId conflicts with webhook hint',
            );
            continue;
          }

          if (
            payment.status === 'AUTHORIZED' ||
            payment.status === 'COMPLETED'
          ) {
            await this.webhookProcessor.markProcessed(event.id);
            continue;
          }

          await this.webhookProcessor.releaseReviewClaim(
            event.id,
            'Authoritative webhook review remains inconclusive',
          );
        } catch (error: unknown) {
          await this.webhookProcessor.releaseReviewClaim(
            event.id,
            error instanceof Error
              ? 'Authoritative webhook review failed: ' + error.message
              : 'Authoritative webhook review failed',
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
