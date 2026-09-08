import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Optional,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RazorpayWebhookIngestService } from './razorpay-webhook-ingest.service';
import { MetricsService } from '../../observability/metrics.service';

@Controller('payments/razorpay')
export class RazorpayWebhookController {
  constructor(
    private readonly ingestService: RazorpayWebhookIngestService,
  
    @Optional()
    private readonly metrics?: MetricsService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req()
    request: RawBodyRequest<Request>,

    @Headers('x-razorpay-signature')
    signature?: string,

    @Headers('x-razorpay-event-id')
    providerEventId?: string,
  ) {
    try {
      const rawBody = request.rawBody;

      if (
        !rawBody ||
        rawBody.length === 0
      ) {
        throw new BadRequestException(
          'Raw webhook body is required',
        );
      }

      const result =
        await this.ingestService.ingest(
          rawBody,
          signature,
          providerEventId,
        );

      this.metrics?.recordWebhookEvent(
        'ingest',
        result.replayed
          ? 'replay'
          : 'accepted',
      );

      return result;
    } catch (error: unknown) {
      this.metrics?.recordWebhookEvent(
        'ingest',
        'failure',
      );

      throw error;
    }
  }
}