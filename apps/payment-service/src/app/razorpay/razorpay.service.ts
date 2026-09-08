import type {
  PaymentRailProvider,
} from '../payment-rails/payment-rail-provider';

import {
  PAYMENT_RAIL_PROVIDER,
} from '../payment-rails/payment-rail.tokens';
import {
  Inject,
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  razorpayConfig,
} from '@payflow/shared-config';

import {
  CreateRazorpayOrderDto,
} from './dto/create-razorpay-order.dto';

@Injectable()
export class RazorpayService {
  constructor(
    @Inject(PAYMENT_RAIL_PROVIDER)
    private readonly paymentRail: PaymentRailProvider,
  ) {}


  async createOrder(
    dto: CreateRazorpayOrderDto,
  ) {
    if (!this.paymentRail.isConfigured()) {
      throw new ServiceUnavailableException(
        'Razorpay keys are not configured',
      );
    }

    const currency =
      (
        dto.currency ??
        'INR'
      )
        .trim()
        .toUpperCase();

    if (currency !== 'INR') {
      throw new BadRequestException(
        'Currently only INR is supported',
      );
    }

    const receipt =
      dto.receipt?.trim() ||
      `payflow_${Date.now()}`;

    try {
      const railOrder =
        await this.paymentRail.createOrder({
          amountMinor: dto.amountInPaise,
          currency: currency,
          receipt: receipt,
          notes: {

            source:
              'PAYFLOW',

            description:
              dto.description?.trim() ??
              'Payflow wallet deposit',
          
          },
        });

      const order =
        (railOrder.raw ?? {
          id: railOrder.providerOrderId,
          amount: railOrder.amountMinor,
          currency: railOrder.currency,
          status: railOrder.status,
        }) as Record<string, unknown>;

      return {
        message:
          'Razorpay order created successfully',

        keyId:
          razorpayConfig.keyId,

        order: {
          id:
            order.id,

          entity:
            order.entity,

          amount:
            order.amount,

          amountPaid:
            order.amount_paid,

          amountDue:
            order.amount_due,

          currency:
            order.currency,

          receipt:
            order.receipt,

          status:
            order.status,

          attempts:
            order.attempts,

          createdAt:
            order.created_at,
        },
      };
    } catch (error: unknown) {
      const providerError =
        error &&
        typeof error === 'object'
          ? error as {
              statusCode?: number;
              error?: {
                code?: string;
                description?: string;
                reason?: string;
                field?: string;
                source?: string;
                step?: string;
              };
              message?: string;
            }
          : null;

      const providerMessage =
        providerError?.error?.description ??
        providerError?.error?.reason ??
        providerError?.message ??
        (
          error instanceof Error
            ? error.message
            : String(error)
        );

      throw new BadGatewayException({
        message:
          'Unable to create Razorpay order',

        provider:
          'RAZORPAY',

        providerStatusCode:
          providerError?.statusCode ??
          null,

        providerCode:
          providerError?.error?.code ??
          null,

        providerMessage,

        providerReason:
          providerError?.error?.reason ??
          null,

        providerField:
          providerError?.error?.field ??
          null,

        providerSource:
          providerError?.error?.source ??
          null,

        providerStep:
          providerError?.error?.step ??
          null,
      });
    }
  }
}