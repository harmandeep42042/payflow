import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@payflow/database';
import { RazorpayWebhookProcessorService } from '../../webhooks/razorpay/razorpay-webhook-processor.service';
import { ExternalPaymentReconciliationService } from './external-payment-reconciliation.service';

export type ExternalPaymentWebhookLifecycleResult =
  | 'NOT_CLAIMED'
  | 'PROCESSED'
  | 'NEEDS_REVIEW'
  | 'RETRY';

@Injectable()
export class ExternalPaymentWebhookLifecycleService {
  private readonly logger = new Logger(
    ExternalPaymentWebhookLifecycleService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookProcessor: RazorpayWebhookProcessorService,
    private readonly reconciliation: ExternalPaymentReconciliationService,
  ) {}

  async process(
    webhookEventId: string,
  ): Promise<ExternalPaymentWebhookLifecycleResult> {
    const claim =
      await this.webhookProcessor.claim(
        webhookEventId,
      );

    if (!claim.claimed) {
      return 'NOT_CLAIMED';
    }

    const event =
      await this.prisma.providerWebhookEvent.findUnique({
        where: {
          id: webhookEventId,
        },
      });

    if (!event) {
      await this.webhookProcessor.releaseForRetry(
        webhookEventId,
        'Webhook event disappeared after claim',
      );

      return 'RETRY';
    }

    if (!event.providerOrderId) {
      await this.webhookProcessor.markNeedsReview(
        webhookEventId,
        'Webhook event is missing providerOrderId correlation',
      );

      return 'NEEDS_REVIEW';
    }

    const payment =
      await this.prisma.payment.findFirst({
        where: {
          provider: 'RAZORPAY',
          providerOrderId: event.providerOrderId,
        },
      });

    if (!payment) {
      await this.webhookProcessor.markNeedsReview(
        webhookEventId,
        'No durable Razorpay payment matches webhook providerOrderId',
      );

      return 'NEEDS_REVIEW';
    }

    if (
      event.providerPaymentId &&
      payment.providerPaymentId &&
      event.providerPaymentId !==
        payment.providerPaymentId
    ) {
      await this.webhookProcessor.markNeedsReview(
        webhookEventId,
        'Webhook providerPaymentId conflicts with durable payment',
      );

      return 'NEEDS_REVIEW';
    }

    if (
      payment.status === 'AUTHORIZED' ||
      payment.status === 'COMPLETED'
    ) {
      await this.webhookProcessor.markProcessed(
        webhookEventId,
      );

      return 'PROCESSED';
    }

    if (
      payment.status !== 'ORDER_CREATED' &&
      payment.status !== 'NEEDS_REVIEW'
    ) {
      await this.webhookProcessor.markNeedsReview(
        webhookEventId,
        'Durable payment is not eligible for external reconciliation',
      );

      return 'NEEDS_REVIEW';
    }

    try {
      const result =
        await this.reconciliation
          .reconcileExternalPaymentByProviderOrderId(
            event.providerOrderId,
          );

      if (result === 'NOT_FOUND') {
        await this.webhookProcessor.markNeedsReview(
          webhookEventId,
          'Durable payment disappeared during reconciliation',
        );

        return 'NEEDS_REVIEW';
      }

      const latest =
        await this.prisma.payment.findFirst({
          where: {
            provider: 'RAZORPAY',
            providerOrderId: event.providerOrderId,
          },
        });

      if (!latest) {
        await this.webhookProcessor.markNeedsReview(
          webhookEventId,
          'Durable payment missing after reconciliation',
        );

        return 'NEEDS_REVIEW';
      }

      if (
        event.providerPaymentId &&
        latest.providerPaymentId &&
        event.providerPaymentId !==
          latest.providerPaymentId
      ) {
        await this.webhookProcessor.markNeedsReview(
          webhookEventId,
          'Authoritative providerPaymentId conflicts with webhook hint',
        );

        return 'NEEDS_REVIEW';
      }

      if (
        latest.status === 'AUTHORIZED' ||
        latest.status === 'COMPLETED'
      ) {
        await this.webhookProcessor.markProcessed(
          webhookEventId,
        );

        return 'PROCESSED';
      }

      if (latest.status === 'NEEDS_REVIEW') {
        await this.webhookProcessor.markNeedsReview(
          webhookEventId,
          latest.failureReason ||
            'Authoritative provider evidence requires manual review',
        );

        return 'NEEDS_REVIEW';
      }

      if (latest.status === 'ORDER_CREATED') {
        await this.webhookProcessor.releaseForRetry(
          webhookEventId,
          'Authoritative captured payment evidence is not available yet',
        );

        return 'RETRY';
      }

      await this.webhookProcessor.markNeedsReview(
        webhookEventId,
        'Unexpected payment state after reconciliation',
      );

      return 'NEEDS_REVIEW';
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : 'Unknown provider reconciliation failure';

      this.logger.warn(
        'Webhook reconciliation deferred for retry: ' +
          webhookEventId +
          ': ' +
          reason,
      );

      await this.webhookProcessor.releaseForRetry(
        webhookEventId,
        reason,
      );

      return 'RETRY';
    }
  }
}