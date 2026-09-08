jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RazorpayWebhookIdentityService } from './razorpay-webhook-identity.service';
import { RazorpayWebhookIngestService } from './razorpay-webhook-ingest.service';

describe('RazorpayWebhookIngestService', () => {
  const signatureService = {
    verify: jest.fn(),
  };

  const prisma = {
    providerWebhookEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const identityService =
    new RazorpayWebhookIdentityService();

  let service: RazorpayWebhookIngestService;

  beforeEach(() => {
    jest.clearAllMocks();

    service =
      new RazorpayWebhookIngestService(
        prisma as never,
        signatureService as never,
        identityService,
      );
  });

  it('verifies signature before durable persistence', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
      }),
    );

    prisma.providerWebhookEvent.create.mockResolvedValue({
      id: 'row-1',
    });

    await service.ingest(
      rawBody,
      'signature',
      'event-1',
    );

    expect(
      signatureService.verify,
    ).toHaveBeenCalledWith(
      rawBody,
      'signature',
    );

    expect(
      prisma.providerWebhookEvent.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'RAZORPAY',
        providerEventId: 'event-1',
        eventType: 'payment.captured',
        status: 'RECEIVED',
      }),
    });
  });

  it('accepts a fresh authenticated event', async () => {
    prisma.providerWebhookEvent.create.mockResolvedValue({
      id: 'row-1',
    });

    const result =
      await service.ingest(
        Buffer.from(
          JSON.stringify({
            event: 'payment.authorized',
          }),
        ),
        'signature',
        'event-fresh',
      );

    expect(result).toEqual({
      accepted: true,
      replayed: false,
      eventId: 'event-fresh',
      eventType: 'payment.authorized',
    });
  });

  it('returns replayed true for an identical duplicate', async () => {
    const rawBody =
      Buffer.from(
        JSON.stringify({
          event: 'payment.captured',
        }),
      );

    const hash =
      identityService.payloadHash(rawBody);

    prisma.providerWebhookEvent.create.mockRejectedValue({
      code: 'P2002',
    });

    prisma.providerWebhookEvent.findUnique.mockResolvedValue({
      eventType: 'payment.captured',
      payloadHash: hash,
    });

    const result =
      await service.ingest(
        rawBody,
        'signature',
        'event-duplicate',
      );

    expect(result.accepted).toBe(true);
    expect(result.replayed).toBe(true);
  });

  it('rejects same event id with different content', async () => {
    prisma.providerWebhookEvent.create.mockRejectedValue({
      code: 'P2002',
    });

    prisma.providerWebhookEvent.findUnique.mockResolvedValue({
      eventType: 'payment.captured',
      payloadHash: 'different-hash',
    });

    await expect(
      service.ingest(
        Buffer.from(
          JSON.stringify({
            event: 'payment.captured',
          }),
        ),
        'signature',
        'event-conflict',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects malformed JSON after signature verification', async () => {
    await expect(
      service.ingest(
        Buffer.from('{broken'),
        'signature',
        'event-json',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      signatureService.verify,
    ).toHaveBeenCalled();

    expect(
      prisma.providerWebhookEvent.create,
    ).not.toHaveBeenCalled();
  });

  it('rejects missing event type', async () => {
    await expect(
      service.ingest(
        Buffer.from('{}'),
        'signature',
        'event-no-type',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      prisma.providerWebhookEvent.create,
    ).not.toHaveBeenCalled();
  });
});