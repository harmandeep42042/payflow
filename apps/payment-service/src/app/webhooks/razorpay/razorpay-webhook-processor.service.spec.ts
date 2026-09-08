jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { RazorpayWebhookProcessorService } from './razorpay-webhook-processor.service';

describe('RazorpayWebhookProcessorService', () => {
  let updateMany: jest.Mock;
  let service: RazorpayWebhookProcessorService;

  beforeEach(() => {
    updateMany = jest.fn();

    const prisma = {
      providerWebhookEvent: {
        updateMany,
      },
    };

    service = new RazorpayWebhookProcessorService(prisma as never);
  });

  it('atomically claims a RECEIVED Razorpay event', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    const result = await service.claim('webhook-1');

    expect(result).toEqual({
      claimed: true,
      status: 'PROCESSING',
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'webhook-1',
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
  });

  it('does not double-claim an event', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.claim('webhook-1')).resolves.toEqual({
      claimed: false,
      reason: 'NOT_RECEIVED',
    });
  });

  it('marks PROCESSING event PROCESSED', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await expect(service.markProcessed('webhook-1')).resolves.toBe(true);

    const call = updateMany.mock.calls[0][0];

    expect(call.where).toEqual({
      id: 'webhook-1',
      provider: 'RAZORPAY',
      status: 'PROCESSING',
    });

    expect(call.data.status).toBe('PROCESSED');
    expect(call.data.lastError).toBeNull();
    expect(call.data.processedAt).toBeInstanceOf(Date);
  });

  it('moves unsafe evidence to NEEDS_REVIEW', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.markNeedsReview('webhook-1', 'Provider evidence mismatch'),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'webhook-1',
        provider: 'RAZORPAY',
        status: 'PROCESSING',
      },
      data: {
        status: 'NEEDS_REVIEW',
        processedAt: null,
        lastError: 'Provider evidence mismatch',
      },
    });
  });

  it('releases transient failures back to RECEIVED', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.releaseForRetry('webhook-1', 'Provider temporarily unavailable'),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'webhook-1',
        provider: 'RAZORPAY',
        status: 'PROCESSING',
        attempts: {
          lt: 3,
        },
      },
      data: {
        status: 'RECEIVED',
        processedAt: null,
        lastError: 'Provider temporarily unavailable',
      },
    });
  });

  it('cannot mark an event processed after losing the claim', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.markProcessed('webhook-1')).resolves.toBe(false);
  });

  it('cannot move an unclaimed event to review', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.markNeedsReview('webhook-1', 'Evidence mismatch'),
    ).resolves.toBe(false);
  });

  it('cannot release an unclaimed event for retry', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.releaseForRetry('webhook-1', 'Temporary provider failure'),
    ).resolves.toBe(false);
  });

  it('releases a transient failure below the retry budget', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      service.releaseForRetry(
        'evt-retry-below-budget',
        'temporary provider failure',
      ),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          attempts: {
            lt: 3,
          },
        }),
        data: expect.objectContaining({
          status: 'RECEIVED',
          lastError: 'temporary provider failure',
        }),
      }),
    );

    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('parks an exhausted transient failure in NEEDS_REVIEW', async () => {
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(
      service.releaseForRetry(
        'evt-retry-exhausted',
        'temporary provider failure',
      ),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          attempts: {
            gte: 3,
          },
        }),
        data: expect.objectContaining({
          status: 'NEEDS_REVIEW',
          lastError:
            'Webhook retry budget exhausted: temporary provider failure',
        }),
      }),
    );
  });

  it('cannot retry or park an event that is no longer PROCESSING', async () => {
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      service.releaseForRetry('evt-lost-claim', 'temporary provider failure'),
    ).resolves.toBe(false);

    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it('parks only stale PROCESSING claims for authoritative review', async () => {
    updateMany.mockResolvedValue({
      count: 2,
    });

    const staleBefore = new Date('2026-08-30T09:00:00.000Z');

    const parked = await service.parkStaleProcessing(staleBefore);

    expect(updateMany).toHaveBeenCalledTimes(1);

    expect(updateMany).toHaveBeenCalledWith({
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

    expect(parked).toBe(2);
  });

  it('never auto-replays stale PROCESSING claims to RECEIVED', async () => {
    updateMany.mockResolvedValue({
      count: 1,
    });

    await service.parkStaleProcessing(new Date('2026-08-30T09:00:00.000Z'));

    const mutation = updateMany.mock.calls[0][0];

    expect(mutation.where.status).toBe('PROCESSING');

    expect(mutation.data.status).toBe('NEEDS_REVIEW');

    expect(mutation.data.status).not.toBe('RECEIVED');
  });

  it('uses the stale cutoff so recent PROCESSING claims stay untouched', async () => {
    updateMany.mockResolvedValue({
      count: 0,
    });

    const staleBefore = new Date('2026-08-30T09:00:00.000Z');

    const parked = await service.parkStaleProcessing(staleBefore);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'RAZORPAY',
          status: 'PROCESSING',
          updatedAt: {
            lt: staleBefore,
          },
        }),
      }),
    );

    expect(parked).toBe(0);
  });

  it('claims only correlated NEEDS_REVIEW events for reconciliation', async () => {
    updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.claimNeedsReviewForReconciliation('review-1'),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'review-1',
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
  });

  it('does not claim review event after another worker wins the claim', async () => {
    updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.claimNeedsReviewForReconciliation('review-1'),
    ).resolves.toBe(false);
  });

  it('returns authoritative review claim to NEEDS_REVIEW without RECEIVED replay', async () => {
    updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.releaseReviewClaim('review-1', 'still ambiguous'),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'review-1',
        provider: 'RAZORPAY',
        status: 'PROCESSING',
      },
      data: {
        status: 'NEEDS_REVIEW',
        processedAt: null,
        lastError: 'still ambiguous',
      },
    });
  });
});
