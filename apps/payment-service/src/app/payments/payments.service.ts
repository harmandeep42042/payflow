import { PAYMENT_RAIL_PROVIDER } from '../payment-rails/payment-rail.tokens';

import type { PaymentRailProvider } from '../payment-rails/payment-rail-provider';

import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';

import { firstValueFrom } from 'rxjs';

import { randomUUID } from 'node:crypto';

import { PrismaService } from '@payflow/database';

import {
  OutboxEventProducer,
  PaymentCompletedEventPayload,
  PaymentEventPattern,
  PaymentEventVersion,
} from '@payflow/shared-events';

import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';

@Injectable()
export class PaymentsService {
  @Inject(PAYMENT_RAIL_PROVIDER)
  private readonly paymentRail?: PaymentRailProvider;

  private readonly walletServiceUrl = (
    process.env['WALLET_SERVICE_URL'] ?? 'http://localhost:4001/api/v1'
  ).replace(/\/$/, '');

  private readonly rewardServiceUrl = (
    process.env['REWARD_SERVICE_URL'] ?? 'http://localhost:4007/api/v1'
  ).replace(/\/$/, '');

  constructor(
    private readonly prisma: PrismaService,

    private readonly http: HttpService,
  ) {}

  async createOrder(dto: CreatePaymentOrderDto, authenticatedUserId?: string) {
    this.assertUserOwnership(
      dto.userId,
      authenticatedUserId,
      'You cannot create a payment for another user',
    );

    const existingPayment = await this.prisma.payment.findUnique({
      where: {
        idempotencyKey: dto.idempotencyKey,
      },
    });

    if (existingPayment) {
      this.assertIdempotentPaymentPayload(existingPayment, dto);
      return {
        ...existingPayment,
        replayed: true,
      };
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: {
        id: dto.walletId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    this.assertUserOwnership(
      wallet.userId,
      authenticatedUserId,
      'You do not own this wallet',
    );

    const provider = dto.provider ?? 'MOCK';

    const currency = dto.currency.trim().toUpperCase();

    const amount = (dto.amountInPaise / 100).toFixed(2);

    /*
     * Persist the Payflow payment intent BEFORE any
     * external provider request.
     *
     * For RAZORPAY providerOrderId deliberately starts
     * as null because no external order exists yet.
     */
    let payment;

    try {
      payment = await this.prisma.payment.create({
        data: {
          userId: dto.userId,

          walletId: dto.walletId,

          provider,

          providerOrderId:
            provider === 'MOCK' ? 'mock_order_' + randomUUID() : null,

          amount,

          amountInPaise: dto.amountInPaise,

          currency,

          status: 'CREATED',

          description: dto.description?.trim(),

          idempotencyKey: dto.idempotencyKey,

          metadata: {
            source: 'payment-service',

            mode: provider.toLowerCase(),
          },
        },
      });

      /*
       * Existing MOCK behaviour remains unchanged.
       * No external rail is involved.
       */
    } catch (error: unknown) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      /*
       * Another concurrent request may have won the
       * unique idempotency-key race.
       *
       * Re-read the winner, then apply the exact same
       * payload-binding rules as a normal replay.
       */
      const winner = await this.prisma.payment.findUnique({
        where: {
          idempotencyKey: dto.idempotencyKey,
        },
      });

      if (!winner) {
        throw error;
      }

      this.assertIdempotentPaymentPayload(winner, dto);

      return {
        ...winner,
        replayed: true,
      };
    }
    if (provider === 'MOCK') {
      return payment;
    }

    /*
     * Atomic local claim:
     *
     * CREATED -> PROCESSING
     *
     * Only one caller can own the provider operation.
     */
    const processingStartedAt = new Date();

    const claimResult = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,

        provider: 'RAZORPAY',

        status: 'CREATED',
      },

      data: {
        status: 'PROCESSING',

        processingStartedAt,

        failureReason: null,
      },
    });

    if (claimResult.count !== 1) {
      const currentPayment = await this.prisma.payment.findUnique({
        where: {
          id: payment.id,
        },
      });

      return {
        ...currentPayment,
        replayed: true,
      };
    }

    /*
     * A missing runtime provider is a definite local
     * configuration failure. No provider request occurred,
     * therefore FAILED is safe.
     */
    if (!this.paymentRail || !this.paymentRail.isConfigured()) {
      await this.prisma.payment.updateMany({
        where: {
          id: payment.id,

          status: 'PROCESSING',
        },

        data: {
          status: 'FAILED',

          processingStartedAt: null,

          failedAt: new Date(),

          failureReason: 'Razorpay provider is not configured',
        },
      });

      throw new ServiceUnavailableException(
        'Razorpay provider is not configured',
      );
    }

    /*
     * Deterministic receipt gives reconciliation a stable
     * Payflow-side reference without exposing secrets.
     */
    const receipt = 'payflow_' + payment.id.replace(/-/g, '').slice(0, 32);

    let railOrder: Awaited<ReturnType<PaymentRailProvider['createOrder']>>;

    try {
      railOrder = await this.paymentRail.createOrder({
        amountMinor: payment.amountInPaise,

        currency: payment.currency,

        receipt,

        notes: {
          source: 'PAYFLOW',

          paymentId: payment.id,
        },
      });
    } catch (error: unknown) {
      /*
       * Provider 4xx = provider definitely rejected request.
       *
       * No HTTP status / 5xx = outcome may be ambiguous:
       * provider could have accepted the order before a
       * timeout/network failure. Never blindly retry it.
       */
      const providerError =
        error && typeof error === 'object'
          ? (error as {
              statusCode?: number;
              error?: {
                code?: string;
                description?: string;
              };
              message?: string;
            })
          : null;

      const providerStatusCode = providerError?.statusCode;

      const definiteRejection =
        typeof providerStatusCode === 'number' &&
        providerStatusCode >= 400 &&
        providerStatusCode < 500;

      if (definiteRejection) {
        await this.prisma.payment.updateMany({
          where: {
            id: payment.id,

            status: 'PROCESSING',
          },

          data: {
            status: 'FAILED',

            processingStartedAt: null,

            failedAt: new Date(),

            failureReason:
              providerError?.error?.description ??
              providerError?.message ??
              'Provider rejected order creation',
          },
        });
      } else {
        await this.prisma.payment.updateMany({
          where: {
            id: payment.id,

            status: 'PROCESSING',
          },

          data: {
            status: 'NEEDS_REVIEW',

            processingStartedAt: null,

            lastRecoveryAt: new Date(),

            recoveryAttempts: {
              increment: 1,
            },

            failureReason:
              'Provider order outcome is uncertain and requires reconciliation',
          },
        });
      }

      throw new BadGatewayException({
        message: 'Unable to create external payment order',

        provider: 'RAZORPAY',

        paymentId: payment.id,

        paymentStatus: definiteRejection ? 'FAILED' : 'NEEDS_REVIEW',

        providerStatusCode: providerStatusCode ?? null,

        providerCode: providerError?.error?.code ?? null,

        providerMessage:
          providerError?.error?.description ??
          providerError?.message ??
          (error instanceof Error ? error.message : String(error)),
      });
    }

    /*
     * Provider order creation succeeded.
     *
     * Now bind providerOrderId durably.
     * A provider response such as status="created" is NOT
     * Payflow COMPLETED and must never credit the wallet.
     */
    let bindResult: {
      count: number;
    };

    try {
      bindResult = await this.prisma.payment.updateMany({
        where: {
          id: payment.id,

          provider: 'RAZORPAY',

          status: 'PROCESSING',
        },

        data: {
          status: 'ORDER_CREATED',

          providerOrderId: railOrder.providerOrderId,

          processingStartedAt: null,

          failureReason: null,
        },
      });
    } catch {
      /*
       * Provider succeeded but local durable binding failed.
       * Never call provider again automatically.
       */
      await this.prisma.payment.updateMany({
        where: {
          id: payment.id,

          status: 'PROCESSING',
        },

        data: {
          status: 'NEEDS_REVIEW',

          processingStartedAt: null,

          lastRecoveryAt: new Date(),

          recoveryAttempts: {
            increment: 1,
          },

          failureReason:
            'Provider order exists but local providerOrderId binding failed',
        },
      });

      throw new BadGatewayException({
        message: 'Provider order requires reconciliation',

        provider: 'RAZORPAY',

        paymentId: payment.id,

        paymentStatus: 'NEEDS_REVIEW',
      });
    }

    if (bindResult.count !== 1) {
      const currentPayment = await this.prisma.payment.findUnique({
        where: {
          id: payment.id,
        },
      });

      /*
       * A concurrent path may already have bound exactly
       * the same provider order.
       */
      if (
        currentPayment?.status === 'ORDER_CREATED' &&
        currentPayment.providerOrderId === railOrder.providerOrderId
      ) {
        return {
          ...currentPayment,
          replayed: true,
        };
      }

      await this.prisma.payment.updateMany({
        where: {
          id: payment.id,

          status: 'PROCESSING',
        },

        data: {
          status: 'NEEDS_REVIEW',

          processingStartedAt: null,

          lastRecoveryAt: new Date(),

          recoveryAttempts: {
            increment: 1,
          },

          failureReason:
            'Provider order exists but durable state binding was not confirmed',
        },
      });

      throw new BadGatewayException({
        message: 'Provider order requires reconciliation',

        provider: 'RAZORPAY',

        paymentId: payment.id,

        paymentStatus: 'NEEDS_REVIEW',
      });
    }

    const durablePayment = await this.prisma.payment.findUnique({
      where: {
        id: payment.id,
      },
    });

    return {
      ...durablePayment,
      replayed: false,
    };
  }

  async confirmOrder(
    orderId: string,
    authenticatedUserId?: string,
    authorization?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment order not found');
    }

    this.assertUserOwnership(payment.userId, authenticatedUserId);

    /*
     * If payment is already complete,
     * never credit wallet again.
     */
    if (payment.status === 'COMPLETED') {
      return {
        message: 'Payment already completed',

        payment,

        replayed: true,
      };
    }

    if (payment.status !== 'CREATED') {
      throw new ConflictException(
        `Payment cannot be confirmed from status ${payment.status}`,
      );
    }

    const walletDepositBody = {
      walletId: payment.walletId,

      amount: payment.amount.toString(),

      currency: payment.currency,

      reference: `PAYMENT-${payment.id}`,

      /*
       * Very important:
       * this makes wallet credit
       * idempotent.
       */
      idempotencyKey: `payment:${payment.id}`,
    };

    let walletResult: unknown;

    try {
      const response = await firstValueFrom(
        this.http.post(
          `${this.walletServiceUrl}/wallets/deposit`,
          walletDepositBody,
          {
            headers: {
              'Content-Type': 'application/json',

              ...(authorization
                ? {
                    Authorization: authorization,
                  }
                : {}),
            },
          },
        ),
      );

      walletResult = response.data;
    } catch {
      throw new BadGatewayException(
        'Wallet credit failed. Payment was not completed.',
      );
    }

    const providerPaymentId = `mock_pay_${randomUUID()}`;

    /*
     * Conditional update protects us
     * from concurrent confirmation calls.
     */
    const completionResult = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.payment.updateMany({
        where: {
          id: payment.id,

          status: 'CREATED',
        },

        data: {
          status: 'COMPLETED',

          providerPaymentId,

          completedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        return {
          completed: false,
        } as const;
      }

      const eventPayload: PaymentCompletedEventPayload = {
        version: PaymentEventVersion.Completed,
        paymentId: payment.id,
        userId: payment.userId,
        walletId: payment.walletId,
        amount: payment.amount.toString(),
        currency: payment.currency,
      };

      await tx.outboxEvent.create({
        data: {
          producer: OutboxEventProducer.Payment,
          aggregateType: 'PAYMENT',
          aggregateId: payment.id,
          eventType: PaymentEventPattern.Completed,
          payload: eventPayload,
        },
      });

      return {
        completed: true,
      } as const;
    });

    /*
     * Another concurrent request may
     * already have completed it.
     *
     * Wallet is still safe because the
     * deposit idempotency key is identical.
     */
    if (!completionResult.completed) {
      const currentPayment = await this.prisma.payment.findUnique({
        where: {
          id: payment.id,
        },
      });

      return {
        message: 'Payment already processed',

        payment: currentPayment,

        wallet: walletResult,

        replayed: true,
      };
    }

    const completedPayment = await this.prisma.payment.findUnique({
      where: {
        id: payment.id,
      },
    });

    let rewardResult: unknown = null;

    try {
      const rewardResponse = await firstValueFrom(
        this.http.post(
          `${this.rewardServiceUrl}/rewards/generate`,
          {
            userId: payment.userId,
            walletId: payment.walletId,
            paymentId: payment.id,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      rewardResult = rewardResponse.data;
    } catch {
      rewardResult = {
        generated: false,
      };
    }

    return {
      message: 'Payment completed successfully',

      payment: completedPayment,

      wallet: walletResult,

      reward: rewardResult,

      replayed: false,
    };
  }

  async getOrder(orderId: string, authenticatedUserId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: orderId,
      },
    });

    if (payment) {
      this.assertUserOwnership(payment.userId, authenticatedUserId);
    }

    return payment;
  }

  async getUserPayments(userId: string, authenticatedUserId?: string) {
    this.assertUserOwnership(
      userId,
      authenticatedUserId,
      "You cannot access another user's payments",
    );

    return this.prisma.payment.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 50,
    });
  }

  private assertIdempotentPaymentPayload(
    payment: {
      userId: string;
      walletId: string;
      provider: string;
      amountInPaise: number;
      currency: string;
      description: string | null;
    },
    dto: CreatePaymentOrderDto,
  ) {
    const requestedProvider = dto.provider ?? 'MOCK';

    const requestedCurrency = dto.currency.trim().toUpperCase();

    const requestedDescription = dto.description?.trim() || null;

    const payloadMatches =
      payment.userId === dto.userId &&
      payment.walletId === dto.walletId &&
      payment.provider === requestedProvider &&
      payment.amountInPaise === dto.amountInPaise &&
      payment.currency === requestedCurrency &&
      payment.description === requestedDescription;

    if (!payloadMatches) {
      throw new ConflictException(
        'Idempotency key is already bound to a different payment payload',
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (
        error as {
          code?: unknown;
        }
      ).code === 'P2002'
    );
  }
  private assertUserOwnership(
    resourceUserId: string,
    authenticatedUserId?: string,
    message = 'You do not own this payment',
  ) {
    if (!authenticatedUserId) {
      throw new ForbiddenException('Authenticated user identity is required');
    }

    if (resourceUserId !== authenticatedUserId) {
      throw new ForbiddenException(message);
    }
  }
}
