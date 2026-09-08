jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { ExternalPaymentWebhookLifecycleService } from './external-payment-webhook-lifecycle.service';

describe('ExternalPaymentWebhookLifecycleService', () => {
  const webhookEventId = 'webhook-event-1';
  const providerOrderId = 'order_test_1';
  const providerPaymentId = 'pay_test_1';

  let prisma: any;
  let webhookProcessor: any;
  let reconciliation: any;
  let service: ExternalPaymentWebhookLifecycleService;

  beforeEach(() => {
    prisma = {
      providerWebhookEvent: {
        findUnique: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
      },
    };

    webhookProcessor = {
      claim: jest.fn(),
      markProcessed: jest.fn(),
      markNeedsReview: jest.fn(),
      releaseForRetry: jest.fn(),
    };

    reconciliation = {
      reconcileExternalPaymentByProviderOrderId:
        jest.fn(),
    };

    service =
      new ExternalPaymentWebhookLifecycleService(
        prisma,
        webhookProcessor,
        reconciliation,
      );
  });

  it('does nothing when durable claim is not acquired', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: false,
    });

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('NOT_CLAIMED');

    expect(
      prisma.providerWebhookEvent.findUnique,
    ).not.toHaveBeenCalled();

    expect(
      reconciliation
        .reconcileExternalPaymentByProviderOrderId,
    ).not.toHaveBeenCalled();

    expect(
      webhookProcessor.markProcessed,
    ).not.toHaveBeenCalled();
  });

  it('sends missing providerOrderId correlation to review', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId: null,
        providerPaymentId: null,
      });

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('NEEDS_REVIEW');

    expect(
      webhookProcessor.markNeedsReview,
    ).toHaveBeenCalledTimes(1);

    expect(
      reconciliation
        .reconcileExternalPaymentByProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it('sends unknown providerOrderId to review', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId,
      });

    prisma.payment.findFirst
      .mockResolvedValue(null);

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('NEEDS_REVIEW');

    expect(
      webhookProcessor.markNeedsReview,
    ).toHaveBeenCalledTimes(1);

    expect(
      reconciliation
        .reconcileExternalPaymentByProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it('rejects conflicting durable providerPaymentId', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId: 'pay_webhook',
      });

    prisma.payment.findFirst
      .mockResolvedValue({
        providerOrderId,
        providerPaymentId: 'pay_durable',
        status: 'ORDER_CREATED',
      });

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('NEEDS_REVIEW');

    expect(
      webhookProcessor.markNeedsReview,
    ).toHaveBeenCalledTimes(1);

    expect(
      reconciliation
        .reconcileExternalPaymentByProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it('idempotently acknowledges an already AUTHORIZED payment', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId,
      });

    prisma.payment.findFirst
      .mockResolvedValue({
        providerOrderId,
        providerPaymentId,
        status: 'AUTHORIZED',
      });

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('PROCESSED');

    expect(
      webhookProcessor.markProcessed,
    ).toHaveBeenCalledWith(
      webhookEventId,
    );

    expect(
      reconciliation
        .reconcileExternalPaymentByProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it('idempotently acknowledges an already COMPLETED payment', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId,
      });

    prisma.payment.findFirst
      .mockResolvedValue({
        providerOrderId,
        providerPaymentId,
        status: 'COMPLETED',
      });

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('PROCESSED');

    expect(
      webhookProcessor.markProcessed,
    ).toHaveBeenCalledWith(
      webhookEventId,
    );

    expect(
      reconciliation
        .reconcileExternalPaymentByProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it('processes event after authoritative reconciliation reaches AUTHORIZED', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId,
      });

    prisma.payment.findFirst
      .mockResolvedValueOnce({
        providerOrderId,
        providerPaymentId: null,
        status: 'ORDER_CREATED',
      })
      .mockResolvedValueOnce({
        providerOrderId,
        providerPaymentId,
        status: 'AUTHORIZED',
      });

    reconciliation
      .reconcileExternalPaymentByProviderOrderId
      .mockResolvedValue('RECONCILED');

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('PROCESSED');

    expect(
      reconciliation
        .reconcileExternalPaymentByProviderOrderId,
    ).toHaveBeenCalledWith(
      providerOrderId,
    );

    expect(
      webhookProcessor.markProcessed,
    ).toHaveBeenCalledWith(
      webhookEventId,
    );
  });

  it('releases event for retry when authoritative evidence is not captured yet', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId: null,
      });

    prisma.payment.findFirst
      .mockResolvedValueOnce({
        providerOrderId,
        providerPaymentId: null,
        status: 'ORDER_CREATED',
      })
      .mockResolvedValueOnce({
        providerOrderId,
        providerPaymentId: null,
        status: 'ORDER_CREATED',
      });

    reconciliation
      .reconcileExternalPaymentByProviderOrderId
      .mockResolvedValue('RECONCILED');

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('RETRY');

    expect(
      webhookProcessor.releaseForRetry,
    ).toHaveBeenCalledTimes(1);

    expect(
      webhookProcessor.markProcessed,
    ).not.toHaveBeenCalled();
  });

  it('marks event NEEDS_REVIEW when authoritative reconciliation leaves payment NEEDS_REVIEW', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId: null,
      });

    prisma.payment.findFirst
      .mockResolvedValueOnce({
        providerOrderId,
        providerPaymentId: null,
        status: 'ORDER_CREATED',
      })
      .mockResolvedValueOnce({
        providerOrderId,
        providerPaymentId: null,
        status: 'NEEDS_REVIEW',
        failureReason: 'Provider evidence mismatch',
      });

    reconciliation
      .reconcileExternalPaymentByProviderOrderId
      .mockResolvedValue('RECONCILED');

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('NEEDS_REVIEW');

    expect(
      webhookProcessor.markNeedsReview,
    ).toHaveBeenCalledWith(
      webhookEventId,
      'Provider evidence mismatch',
    );
  });

  it('releases event for retry on transient reconciliation failure', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId: null,
      });

    prisma.payment.findFirst
      .mockResolvedValue({
        providerOrderId,
        providerPaymentId: null,
        status: 'ORDER_CREATED',
      });

    reconciliation
      .reconcileExternalPaymentByProviderOrderId
      .mockRejectedValue(
        new Error('temporary provider failure'),
      );

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('RETRY');

    expect(
      webhookProcessor.releaseForRetry,
    ).toHaveBeenCalledWith(
      webhookEventId,
      'temporary provider failure',
    );

    expect(
      webhookProcessor.markProcessed,
    ).not.toHaveBeenCalled();
  });

  it('rejects webhook hint conflicting with authoritative providerPaymentId after reconciliation', async () => {
    webhookProcessor.claim.mockResolvedValue({
      claimed: true,
    });

    prisma.providerWebhookEvent.findUnique
      .mockResolvedValue({
        id: webhookEventId,
        providerOrderId,
        providerPaymentId: 'pay_webhook',
      });

    prisma.payment.findFirst
      .mockResolvedValueOnce({
        providerOrderId,
        providerPaymentId: null,
        status: 'ORDER_CREATED',
      })
      .mockResolvedValueOnce({
        providerOrderId,
        providerPaymentId: 'pay_authoritative',
        status: 'AUTHORIZED',
      });

    reconciliation
      .reconcileExternalPaymentByProviderOrderId
      .mockResolvedValue('RECONCILED');

    await expect(
      service.process(webhookEventId),
    ).resolves.toBe('NEEDS_REVIEW');

    expect(
      webhookProcessor.markNeedsReview,
    ).toHaveBeenCalledTimes(1);

    expect(
      webhookProcessor.markProcessed,
    ).not.toHaveBeenCalled();
  });
});