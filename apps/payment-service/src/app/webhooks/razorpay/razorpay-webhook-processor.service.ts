import { serializeOperationalLog } from '../../observability/operational-log';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@payflow/database';

export type RazorpayWebhookProcessResult =
  | {
      claimed: false;
      reason: 'NOT_RECEIVED';
    }
  | {
      claimed: true;
      status: 'PROCESSING';
    };

@Injectable()
export class RazorpayWebhookProcessorService {
  private static readonly MAX_ATTEMPTS = 3;

  private readonly logger = new Logger(RazorpayWebhookProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically claims one durable webhook event.
   *
   * IMPORTANT:
   * Claiming an event does not authorize a payment,
   * settle a payment, or move wallet funds.
   */
  async claim(webhookEventId: string): Promise<RazorpayWebhookProcessResult> {
    const claimed = await this.prisma.providerWebhookEvent.updateMany({
      where: {
        id: webhookEventId,
        provider: 'RAZORPAY',
        status: 'RECEIVED',
      },
      data: {
        status: 'PROCESSING',
        attempts: {
          increment: 1,
        },
        lastError: null,
      },
    });

    if (claimed.count !== 1) {
      return {
        claimed: false,
        reason: 'NOT_RECEIVED',
      };
    }

    this.logger.log(
      serializeOperationalLog('razorpay.webhook.claimed', {
        webhookEventId,
      }),
    );

    return {
      claimed: true,
      status: 'PROCESSING',
    };
  }

  /**
   * Marks a claimed event complete only after a caller
   * has finished its authoritative lifecycle work.
   */
  async markProcessed(webhookEventId: string): Promise<boolean> {
    const updated = await this.prisma.providerWebhookEvent.updateMany({
      where: {
        id: webhookEventId,
        provider: 'RAZORPAY',
        status: 'PROCESSING',
      },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        lastError: null,
      },
    });

    return updated.count === 1;
  }

  /**
   * A security/evidence inconsistency must not be retried
   * automatically as though it were a network failure.
   */
  async markNeedsReview(
    webhookEventId: string,
    reason: string,
  ): Promise<boolean> {
    const updated = await this.prisma.providerWebhookEvent.updateMany({
      where: {
        id: webhookEventId,
        provider: 'RAZORPAY',
        status: 'PROCESSING',
      },
      data: {
        status: 'NEEDS_REVIEW',
        processedAt: null,
        lastError: reason,
      },
    });

    return updated.count === 1;
  }

  /**
   * Returns a transiently failed claim to RECEIVED so a
   * later worker can retry it.
   *
   * attempts was already incremented by claim().
   */
  async releaseForRetry(
    webhookEventId: string,
    reason: string,
  ): Promise<boolean> {
    const released = await this.prisma.providerWebhookEvent.updateMany({
      where: {
        id: webhookEventId,
        provider: 'RAZORPAY',
        status: 'PROCESSING',
        attempts: {
          lt: RazorpayWebhookProcessorService.MAX_ATTEMPTS,
        },
      },
      data: {
        status: 'RECEIVED',
        processedAt: null,
        lastError: reason,
      },
    });

    if (released.count === 1) {
      return true;
    }

    const parked = await this.prisma.providerWebhookEvent.updateMany({
      where: {
        id: webhookEventId,
        provider: 'RAZORPAY',
        status: 'PROCESSING',
        attempts: {
          gte: RazorpayWebhookProcessorService.MAX_ATTEMPTS,
        },
      },
      data: {
        status: 'NEEDS_REVIEW',
        processedAt: null,
        lastError: 'Webhook retry budget exhausted: ' + reason,
      },
    });

    return parked.count === 1;
  }

  /**
   * Parks abandoned PROCESSING claims for authoritative review.
   *
   * A stale claim is not automatically replayed because the process
   * may have crashed after an external/provider side effect.
   */
  /**
   * Atomically claims one parked Razorpay webhook for authoritative
   * reconciliation. This is deliberately separate from the normal
   * RECEIVED delivery claim so review events are never blindly replayed.
   */
  async claimNeedsReviewForReconciliation(
    webhookEventId: string,
  ): Promise<boolean> {
    const claim = await this.prisma.providerWebhookEvent.updateMany({
      where: {
        id: webhookEventId,
        provider: 'RAZORPAY',
        status: 'NEEDS_REVIEW',
        providerOrderId: {
          not: null,
        },
      },
      data: {
        status: 'PROCESSING',
        processedAt: null,
      },
    });

    return claim.count === 1;
  }

  /**
   * Returns an authoritative-review claim to NEEDS_REVIEW without
   * routing it through normal webhook delivery retry.
   */
  async releaseReviewClaim(
    webhookEventId: string,
    reason: string,
  ): Promise<boolean> {
    const released = await this.prisma.providerWebhookEvent.updateMany({
      where: {
        id: webhookEventId,
        provider: 'RAZORPAY',
        status: 'PROCESSING',
      },
      data: {
        status: 'NEEDS_REVIEW',
        processedAt: null,
        lastError: reason,
      },
    });

    return released.count === 1;
  }
  async parkStaleProcessing(staleBefore: Date): Promise<number> {
    const parked = await this.prisma.providerWebhookEvent.updateMany({
      where: {
        provider: 'RAZORPAY',
        status: 'PROCESSING',
        updatedAt: {
          lt: staleBefore,
        },
      },
      data: {
        status: 'NEEDS_REVIEW',
        processedAt: null,
        lastError:
          'Webhook PROCESSING claim became stale; authoritative reconciliation required',
      },
    });

    if (parked.count > 0) {
      this.logger.warn(
        serializeOperationalLog('razorpay.webhook.stale_claims_parked', {
          status: 'NEEDS_REVIEW',
          reason: `stale_processing_claims:${parked.count}`,
        }),
      );
    }

    return parked.count;
  }
}
