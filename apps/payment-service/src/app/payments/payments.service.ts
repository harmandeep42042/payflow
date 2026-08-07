import {
  ConflictException,
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '@payflow/database';

import {
  CreatePaymentOrderDto,
} from './dto/create-payment-order.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma:
      PrismaService,
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
        dto.amountInPaise / 100
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
          `mock_order_${crypto.randomUUID()}`,

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