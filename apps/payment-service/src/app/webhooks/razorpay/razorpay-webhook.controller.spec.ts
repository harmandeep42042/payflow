jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));
import { BadRequestException } from '@nestjs/common';
import { RazorpayWebhookController } from './razorpay-webhook.controller';

describe('RazorpayWebhookController', () => {
  const ingestService = {
    ingest: jest.fn(),
  };

  let controller: RazorpayWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller =
      new RazorpayWebhookController(
        ingestService as never,
      );
  });

  it('passes exact raw body and provider headers to ingestion', async () => {
    const rawBody =
      Buffer.from(
        '{"event":"payment.captured"}',
      );

    ingestService.ingest.mockResolvedValue({
      accepted: true,
      replayed: false,
      eventId: 'event-1',
      eventType: 'payment.captured',
    });

    await controller.receive(
      {
        rawBody,
      } as never,
      'signature-value',
      'event-1',
    );

    expect(
      ingestService.ingest,
    ).toHaveBeenCalledWith(
      rawBody,
      'signature-value',
      'event-1',
    );
  });

  it('rejects a request without a raw body', async () => {
    await expect(
      controller.receive(
        {} as never,
        'signature-value',
        'event-1',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      ingestService.ingest,
    ).not.toHaveBeenCalled();
  });
});