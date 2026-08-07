import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  ConfirmMockPaymentDto,
} from './dto/confirm-mock-payment.dto';

import {
  CreateMockPaymentDto,
} from './dto/create-mock-payment.dto';

type MockPaymentStatus =
  | 'CREATED'
  | 'SUCCESS'
  | 'FAILED';

type MockPayment = {
  id: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  userId: string;
  walletId: string;
  amountInPaise: number;
  amount: string;
  currency: 'INR';
  description: string;
  status: MockPaymentStatus;
  createdAt: string;
  completedAt: string | null;
};

@Injectable()
export class MockPaymentService {
  private readonly payments =
    new Map<string, MockPayment>();

  createOrder(
    dto: CreateMockPaymentDto,
  ) {
    const id =
      randomUUID();

    const payment: MockPayment = {
      id,

      providerOrderId:
        `mock_order_${id.replace(
          /-/g,
          '',
        )}`,

      providerPaymentId:
        null,

      userId:
        dto.userId,

      walletId:
        dto.walletId,

      amountInPaise:
        dto.amountInPaise,

      amount:
        (
          dto.amountInPaise /
          100
        ).toFixed(2),

      currency:
        'INR',

      description:
        dto.description?.trim() ||
        'Mock wallet deposit',

      status:
        'CREATED',

      createdAt:
        new Date().toISOString(),

      completedAt:
        null,
    };

    this.payments.set(
      payment.id,
      payment,
    );

    return {
      message:
        'Mock payment order created successfully',

      payment,
    };
  }

  getOrder(
    paymentId: string,
  ) {
    const payment =
      this.payments.get(
        paymentId,
      );

    if (!payment) {
      throw new NotFoundException(
        'Mock payment order not found',
      );
    }

    return {
      payment,
    };
  }

  confirmOrder(
    paymentId: string,
    dto: ConfirmMockPaymentDto,
  ) {
    const payment =
      this.payments.get(
        paymentId,
      );

    if (!payment) {
      throw new NotFoundException(
        'Mock payment order not found',
      );
    }

    if (
      payment.status !==
      'CREATED'
    ) {
      throw new ConflictException(
        `Payment is already ${payment.status}`,
      );
    }

    const updatedPayment:
      MockPayment = {
      ...payment,

      providerPaymentId:
        dto.result === 'SUCCESS'
          ? `mock_pay_${randomUUID()
              .replace(/-/g, '')}`
          : null,

      status:
        dto.result,

      completedAt:
        new Date().toISOString(),
    };

    this.payments.set(
      paymentId,
      updatedPayment,
    );

    return {
      message:
        dto.result === 'SUCCESS'
          ? 'Mock payment completed successfully'
          : 'Mock payment failed',

      walletCreditRequired:
        dto.result === 'SUCCESS',

      payment:
        updatedPayment,
    };
  }
}