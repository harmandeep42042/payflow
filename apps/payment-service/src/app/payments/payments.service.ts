import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  HttpService,
} from '@nestjs/axios';

import {
  firstValueFrom,
} from 'rxjs';

import {
  randomUUID,
} from 'node:crypto';

import {
  PrismaService,
} from '@payflow/database';

import {
  CreatePaymentOrderDto,
} from './dto/create-payment-order.dto';

@Injectable()
export class PaymentsService {
  private readonly walletServiceUrl =
    (
      process.env[
        'WALLET_SERVICE_URL'
      ] ??
      'http://localhost:4001/api/v1'
    ).replace(
      /\/$/,
      '',
    );

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly http:
      HttpService,
  ) {}

  async createOrder(
    dto: CreatePaymentOrderDto,
  ) {
    const existingPayment =
      await this.prisma.payment.findUnique({
        where: {
          idempotencyKey:
            dto.idempotencyKey,
        },
      });

    if (existingPayment) {
      throw new ConflictException(
        'A payment order already exists for this idempotency key',
      );
    }

    const amount =
      (
        dto.amountInPaise /
        100
      ).toFixed(2);

    return this.prisma.payment.create({
      data: {
        userId:
          dto.userId,

        walletId:
          dto.walletId,

        provider:
          'MOCK',

        providerOrderId:
          `mock_order_${randomUUID()}`,

        amount,

        amountInPaise:
          dto.amountInPaise,

        currency:
          dto.currency
            .trim()
            .toUpperCase(),

        status:
          'CREATED',

        description:
          dto.description?.trim(),

        idempotencyKey:
          dto.idempotencyKey,

        metadata: {
          source:
            'payment-service',

          mode:
            'mock',
        },
      },
    });
  }

  async confirmOrder(
    orderId: string,
  ) {
    const payment =
      await this.prisma.payment.findUnique({
        where: {
          id:
            orderId,
        },
      });

    if (!payment) {
      throw new NotFoundException(
        'Payment order not found',
      );
    }

    /*
     * If payment is already complete,
     * never credit wallet again.
     */
    if (
      payment.status ===
      'COMPLETED'
    ) {
      return {
        message:
          'Payment already completed',

        payment,

        replayed:
          true,
      };
    }

    if (
      payment.status !==
      'CREATED'
    ) {
      throw new ConflictException(
        `Payment cannot be confirmed from status ${payment.status}`,
      );
    }

    const walletDepositBody = {
      walletId:
        payment.walletId,

      amount:
        payment.amount
          .toString(),

      currency:
        payment.currency,

      reference:
        `PAYMENT-${payment.id}`,

      /*
       * Very important:
       * this makes wallet credit
       * idempotent.
       */
      idempotencyKey:
        `payment:${payment.id}`,
    };

    let walletResult:
      unknown;

    try {
      const response =
        await firstValueFrom(
          this.http.post(
            `${this.walletServiceUrl}/wallets/deposit`,
            walletDepositBody,
          ),
        );

      walletResult =
        response.data;
    } catch {
      throw new BadGatewayException(
        'Wallet credit failed. Payment was not completed.',
      );
    }

    const providerPaymentId =
      `mock_pay_${randomUUID()}`;

    /*
     * Conditional update protects us
     * from concurrent confirmation calls.
     */
    const updateResult =
      await this.prisma.payment.updateMany({
        where: {
          id:
            payment.id,

          status:
            'CREATED',
        },

        data: {
          status:
            'COMPLETED',

          providerPaymentId,

          completedAt:
            new Date(),
        },
      });

    /*
     * Another concurrent request may
     * already have completed it.
     *
     * Wallet is still safe because the
     * deposit idempotency key is identical.
     */
    if (
      updateResult.count ===
      0
    ) {
      const currentPayment =
        await this.prisma.payment.findUnique({
          where: {
            id:
              payment.id,
          },
        });

      return {
        message:
          'Payment already processed',

        payment:
          currentPayment,

        wallet:
          walletResult,

        replayed:
          true,
      };
    }

    const completedPayment =
      await this.prisma.payment.findUnique({
        where: {
          id:
            payment.id,
        },
      });

    return {
      message:
        'Payment completed successfully',

      payment:
        completedPayment,

      wallet:
        walletResult,

      replayed:
        false,
    };
  }

  async getOrder(
    orderId: string,
  ) {
    return this.prisma.payment.findUnique({
      where: {
        id:
          orderId,
      },
    });
  }

  async getUserPayments(
    userId: string,
  ) {
    return this.prisma.payment.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt:
          'desc',
      },

      take: 50,
    });
  }
}
