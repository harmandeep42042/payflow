import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@payflow/database';
import { RazorpayWebhookIdentityService } from './razorpay-webhook-identity.service';
import { RazorpayWebhookSignatureService } from './razorpay-webhook-signature.service';
import type { RazorpayWebhookPayload } from './razorpay-webhook.types';

type PrismaErrorLike = {
  code?: string;
};

export type RazorpayWebhookIngestResult = {
  accepted: true;
  replayed: boolean;
  eventId: string;
  eventType: string;
};

@Injectable()
export class RazorpayWebhookIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureService: RazorpayWebhookSignatureService,
    private readonly identityService: RazorpayWebhookIdentityService,
  ) {}

  async ingest(
    rawBody: Buffer,
    signature: string | undefined,
    providerEventId: string | undefined,
  ): Promise<RazorpayWebhookIngestResult> {
    // Authenticate the exact bytes before parsing or persistence.
    this.signatureService.verify(rawBody, signature);

    let payload: RazorpayWebhookPayload;

    try {
      payload = JSON.parse(
        rawBody.toString('utf8'),
      ) as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestException(
        'Webhook payload is not valid JSON',
      );
    }

    const eventType =
      typeof payload.event === 'string'
        ? payload.event.trim()
        : '';

    if (!eventType) {
      throw new BadRequestException(
        'Webhook event type is required',
      );
    }

    const eventId =
      this.identityService.eventId(
        rawBody,
        providerEventId,
      );

    const payloadHash =
      this.identityService.payloadHash(rawBody);

    try {
    const correlation =
      this.extractPaymentCorrelation(payload);
      await this.prisma.providerWebhookEvent.create({
        data: {
          providerOrderId: correlation.providerOrderId,
          providerPaymentId: correlation.providerPaymentId,
          provider: 'RAZORPAY',
          providerEventId: eventId,
          eventType,
          payloadHash,
          status: 'RECEIVED',
        },
      });

      return {
        accepted: true,
        replayed: false,
        eventId,
        eventType,
      };
    } catch (error: unknown) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existing =
        await this.prisma.providerWebhookEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider: 'RAZORPAY',
              providerEventId: eventId,
            },
          },
          select: {
            eventType: true,
            payloadHash: true,
          },
        });

      if (!existing) {
        throw new ConflictException(
          'Webhook replay state could not be resolved',
        );
      }

      if (
        existing.eventType !== eventType ||
        existing.payloadHash !== payloadHash
      ) {
        throw new ConflictException(
          'Webhook event id is already bound to a different payload',
        );
      }

      return {
        accepted: true,
        replayed: true,
        eventId,
        eventType,
      };
    }
  }

  private isUniqueViolation(
    error: unknown,
  ): boolean {
    if (
      typeof error !== 'object' ||
      error === null
    ) {
      return false;
    }

    return (error as PrismaErrorLike).code === 'P2002';
  }

  private extractPaymentCorrelation(
    payload: unknown,
  ): {
    providerOrderId: string | null;
    providerPaymentId: string | null;
  } {
    if (!payload || typeof payload !== 'object') {
      return {
        providerOrderId: null,
        providerPaymentId: null,
      };
    }

    const root = payload as Record<string, unknown>;

    const payloadNode =
      root['payload'] &&
      typeof root['payload'] === 'object'
        ? (root['payload'] as Record<string, unknown>)
        : null;

    const paymentNode =
      payloadNode?.['payment'] &&
      typeof payloadNode['payment'] === 'object'
        ? (payloadNode['payment'] as Record<string, unknown>)
        : null;

    const entityNode =
      paymentNode?.['entity'] &&
      typeof paymentNode['entity'] === 'object'
        ? (paymentNode['entity'] as Record<string, unknown>)
        : null;

    const providerOrderId =
      typeof entityNode?.['order_id'] === 'string' &&
      entityNode['order_id'].trim()
        ? entityNode['order_id'].trim()
        : null;

    const providerPaymentId =
      typeof entityNode?.['id'] === 'string' &&
      entityNode['id'].trim()
        ? entityNode['id'].trim()
        : null;

    return {
      providerOrderId,
      providerPaymentId,
    };
  }
}