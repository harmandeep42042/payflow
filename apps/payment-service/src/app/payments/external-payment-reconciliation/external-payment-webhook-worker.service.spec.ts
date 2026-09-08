jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { ExternalPaymentWebhookWorkerService } from './external-payment-webhook-worker.service';

describe('ExternalPaymentWebhookWorkerService', () => {
  let prisma: any;
  let lifecycle: any;
  let webhookProcessor: any;
  let reconciliation: any;
  let service: ExternalPaymentWebhookWorkerService;

  beforeEach(() => {
    process.env.EXTERNAL_WEBHOOK_REVIEW_RECONCILIATION_ENABLED = 'true';
    prisma = {
      providerWebhookEvent: {
        findMany: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
      },
    };

    lifecycle = {
      process: jest.fn(),
    };

    webhookProcessor = {
      parkStaleProcessing: jest.fn().mockResolvedValue(0),
      claimNeedsReviewForReconciliation: jest.fn(),
      releaseReviewClaim: jest.fn(),
      markProcessed: jest.fn(),
    };

    reconciliation = {
      reconcileExternalPaymentByProviderOrderId: jest.fn(),
    };

    service = new ExternalPaymentWebhookWorkerService(
      prisma,
      lifecycle,
      webhookProcessor,
      reconciliation,
    );
  });

  it('selects only bounded RECEIVED Razorpay events', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([]);

    await service.processReceivedWebhookEvents();

    expect(prisma.providerWebhookEvent.findMany).toHaveBeenCalledWith({
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
  });

  it('passes durable events to lifecycle orchestration', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      { id: 'event-1' },
      { id: 'event-2' },
    ]);

    lifecycle.process.mockResolvedValue('PROCESSED');

    await service.processReceivedWebhookEvents();

    expect(lifecycle.process).toHaveBeenCalledTimes(2);

    expect(lifecycle.process).toHaveBeenNthCalledWith(1, 'event-1');

    expect(lifecycle.process).toHaveBeenNthCalledWith(2, 'event-2');
  });

  it('continues processing when one event throws', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      { id: 'event-1' },
      { id: 'event-2' },
    ]);

    lifecycle.process
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('PROCESSED');

    await service.processReceivedWebhookEvents();

    expect(lifecycle.process).toHaveBeenCalledTimes(2);

    expect(lifecycle.process).toHaveBeenLastCalledWith('event-2');
  });

  it('does not perform wallet or settlement work itself', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([{ id: 'event-1' }]);

    lifecycle.process.mockResolvedValue('NEEDS_REVIEW');

    await service.processReceivedWebhookEvents();

    expect(lifecycle.process).toHaveBeenCalledWith('event-1');
  });

  it('parks stale PROCESSING claims before selecting RECEIVED events', async () => {
    const callOrder: string[] = [];

    webhookProcessor.parkStaleProcessing.mockImplementation(
      async (staleBefore: Date) => {
        expect(staleBefore).toBeInstanceOf(Date);

        const ageMs = Date.now() - staleBefore.getTime();

        expect(ageMs).toBeGreaterThanOrEqual(14 * 60 * 1000);

        expect(ageMs).toBeLessThanOrEqual(16 * 60 * 1000);

        callOrder.push('recover');

        return 0;
      },
    );

    prisma.providerWebhookEvent.findMany.mockImplementation(async () => {
      callOrder.push('select');

      return [];
    });

    await service.processReceivedWebhookEvents();

    expect(webhookProcessor.parkStaleProcessing).toHaveBeenCalledTimes(1);

    expect(prisma.providerWebhookEvent.findMany).toHaveBeenCalledTimes(1);

    expect(callOrder).toEqual(['recover', 'select']);
  });

  it('selects only correlated NEEDS_REVIEW Razorpay events', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([]);

    await service.processNeedsReviewWebhookEvents();

    expect(prisma.providerWebhookEvent.findMany).toHaveBeenCalledWith({
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
  });

  it('skips authoritative reconciliation when review claim is lost', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'review-1',
        providerOrderId: 'order-1',
        providerPaymentId: null,
      },
    ]);

    webhookProcessor.claimNeedsReviewForReconciliation.mockResolvedValue(false);

    await service.processNeedsReviewWebhookEvents();

    expect(
      reconciliation.reconcileExternalPaymentByProviderOrderId,
    ).not.toHaveBeenCalled();

    expect(webhookProcessor.markProcessed).not.toHaveBeenCalled();

    expect(webhookProcessor.releaseReviewClaim).not.toHaveBeenCalled();
  });

  it('marks review event PROCESSED after authoritative AUTHORIZED recovery', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'review-1',
        providerOrderId: 'order-1',
        providerPaymentId: 'pay-1',
      },
    ]);

    webhookProcessor.claimNeedsReviewForReconciliation.mockResolvedValue(true);

    reconciliation.reconcileExternalPaymentByProviderOrderId.mockResolvedValue(
      'RECONCILED',
    );

    prisma.payment.findFirst.mockResolvedValue({
      providerOrderId: 'order-1',
      providerPaymentId: 'pay-1',
      status: 'AUTHORIZED',
    });

    await service.processNeedsReviewWebhookEvents();

    expect(webhookProcessor.markProcessed).toHaveBeenCalledWith('review-1');

    expect(webhookProcessor.releaseReviewClaim).not.toHaveBeenCalled();
  });

  it('idempotently marks review event PROCESSED when payment is already COMPLETED', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'review-2',
        providerOrderId: 'order-2',
        providerPaymentId: null,
      },
    ]);

    webhookProcessor.claimNeedsReviewForReconciliation.mockResolvedValue(true);

    reconciliation.reconcileExternalPaymentByProviderOrderId.mockResolvedValue(
      'RECONCILED',
    );

    prisma.payment.findFirst.mockResolvedValue({
      providerOrderId: 'order-2',
      providerPaymentId: 'pay-2',
      status: 'COMPLETED',
    });

    await service.processNeedsReviewWebhookEvents();

    expect(webhookProcessor.markProcessed).toHaveBeenCalledWith('review-2');
  });

  it('returns inconclusive authoritative review to NEEDS_REVIEW', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'review-3',
        providerOrderId: 'order-3',
        providerPaymentId: null,
      },
    ]);

    webhookProcessor.claimNeedsReviewForReconciliation.mockResolvedValue(true);

    reconciliation.reconcileExternalPaymentByProviderOrderId.mockResolvedValue(
      'RECONCILED',
    );

    prisma.payment.findFirst.mockResolvedValue({
      providerOrderId: 'order-3',
      providerPaymentId: null,
      status: 'NEEDS_REVIEW',
    });

    await service.processNeedsReviewWebhookEvents();

    expect(webhookProcessor.releaseReviewClaim).toHaveBeenCalledWith(
      'review-3',
      'Authoritative webhook review remains inconclusive',
    );

    expect(webhookProcessor.markProcessed).not.toHaveBeenCalled();
  });

  it('keeps review event in NEEDS_REVIEW when provider reconciliation fails', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'review-4',
        providerOrderId: 'order-4',
        providerPaymentId: null,
      },
    ]);

    webhookProcessor.claimNeedsReviewForReconciliation.mockResolvedValue(true);

    reconciliation.reconcileExternalPaymentByProviderOrderId.mockRejectedValue(
      new Error('provider unavailable'),
    );

    await service.processNeedsReviewWebhookEvents();

    expect(webhookProcessor.releaseReviewClaim).toHaveBeenCalledWith(
      'review-4',
      'Authoritative webhook review failed: provider unavailable',
    );

    expect(webhookProcessor.markProcessed).not.toHaveBeenCalled();
  });

  it('keeps providerPaymentId conflict in NEEDS_REVIEW', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'review-5',
        providerOrderId: 'order-5',
        providerPaymentId: 'pay-webhook',
      },
    ]);

    webhookProcessor.claimNeedsReviewForReconciliation.mockResolvedValue(true);

    reconciliation.reconcileExternalPaymentByProviderOrderId.mockResolvedValue(
      'RECONCILED',
    );

    prisma.payment.findFirst.mockResolvedValue({
      providerOrderId: 'order-5',
      providerPaymentId: 'pay-authoritative',
      status: 'AUTHORIZED',
    });

    await service.processNeedsReviewWebhookEvents();

    expect(webhookProcessor.releaseReviewClaim).toHaveBeenCalledWith(
      'review-5',
      'Authoritative providerPaymentId conflicts with webhook hint',
    );

    expect(webhookProcessor.markProcessed).not.toHaveBeenCalled();
  });

  it('never routes authoritative review back through normal RECEIVED lifecycle processing', async () => {
    prisma.providerWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'review-6',
        providerOrderId: 'order-6',
        providerPaymentId: null,
      },
    ]);

    webhookProcessor.claimNeedsReviewForReconciliation.mockResolvedValue(true);

    reconciliation.reconcileExternalPaymentByProviderOrderId.mockResolvedValue(
      'NOT_ELIGIBLE',
    );

    await service.processNeedsReviewWebhookEvents();

    expect(lifecycle.process).not.toHaveBeenCalled();

    expect(webhookProcessor.releaseReviewClaim).toHaveBeenCalled();

    expect(webhookProcessor.markProcessed).not.toHaveBeenCalled();
  });

  it('does nothing when review reconciliation is disabled', async () => {
    const original = process.env.EXTERNAL_WEBHOOK_REVIEW_RECONCILIATION_ENABLED;

    delete process.env.EXTERNAL_WEBHOOK_REVIEW_RECONCILIATION_ENABLED;

    try {
      await service.processNeedsReviewWebhookEvents();

      expect(prisma.providerWebhookEvent.findMany).not.toHaveBeenCalled();

      expect(
        webhookProcessor.claimNeedsReviewForReconciliation,
      ).not.toHaveBeenCalled();

      expect(
        reconciliation.reconcileExternalPaymentByProviderOrderId,
      ).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) {
        delete process.env.EXTERNAL_WEBHOOK_REVIEW_RECONCILIATION_ENABLED;
      } else {
        process.env.EXTERNAL_WEBHOOK_REVIEW_RECONCILIATION_ENABLED = original;
      }
    }
  });
});
