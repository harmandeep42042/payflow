import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Optional,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  CreatePaymentOrderDto,
} from './dto/create-payment-order.dto';

import {
  PaymentsService,
} from './payments.service';

import {
  PaymentJwtAuthGuard,
} from '../payment-auth/guards/payment-jwt-auth.guard';

import { PaymentOrderRateLimitService } from './security/payment-order-rate-limit.service';
import { MetricsService } from '../observability/metrics.service';
type AuthenticatedPaymentRequest = {
  user?: {
    id: string;
    email: string;
    role: string;
  };

  headers: {
    authorization?: string;
  };
};

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(PaymentJwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentOrderRateLimit: PaymentOrderRateLimitService,
    private readonly paymentsService:
      PaymentsService,
  
    @Optional()
    private readonly metrics?: MetricsService,
  ) {}

  @Post('orders')
  @ApiOperation({
    summary:
      'Create a payment order',
  })
  @ApiResponse({
    status: 201,
    description:
      'Payment order created successfully',
  })
  async createOrder(
    @Body()
    dto: CreatePaymentOrderDto,

    @Req()
    request: AuthenticatedPaymentRequest,
  ) {
    const startedAt = Date.now();

    try {
      await this.paymentOrderRateLimit.enforce(
        request.user?.id,
      );

      const result =
        await this.paymentsService.createOrder(
          dto,
          request.user?.id,
        );

      this.metrics?.recordPaymentOperation(
        'create_order',
        result?.replayed === true
          ? 'replay'
          : 'success',
        (Date.now() - startedAt) / 1000,
      );

      return result;
    } catch (error: unknown) {
      this.metrics?.recordPaymentOperation(
        'create_order',
        'failure',
        (Date.now() - startedAt) / 1000,
      );

      throw error;
    }
  }

  @Post(
    'orders/:orderId/confirm',
  )
  @ApiOperation({
    summary:
      'Confirm a mock payment and credit the wallet',
  })
  @ApiParam({
    name:
      'orderId',
    description:
      'Internal payment order UUID',
  })
  async confirmOrder(
    @Param(
      'orderId',
      new ParseUUIDPipe(),
    )
    orderId: string,

    @Req()
    request: AuthenticatedPaymentRequest,
  ) {
    const startedAt = Date.now();

    try {
      const result =
        await this.paymentsService.confirmOrder(
          orderId,
          request.user?.id,
          request.headers.authorization,
        );

      this.metrics?.recordPaymentOperation(
        'confirm_order',
        result?.replayed === true
          ? 'replay'
          : 'success',
        (Date.now() - startedAt) / 1000,
      );

      return result;
    } catch (error: unknown) {
      this.metrics?.recordPaymentOperation(
        'confirm_order',
        'failure',
        (Date.now() - startedAt) / 1000,
      );

      throw error;
    }
  }

  @Get('orders/:orderId')
  @ApiOperation({
    summary:
      'Get payment order details',
  })
  @ApiParam({
    name:
      'orderId',
    description:
      'Internal payment order UUID',
  })
  async getOrder(
    @Param('orderId')
    orderId: string,

    @Req()
    request: AuthenticatedPaymentRequest,
  ) {
    const order =
      await this.paymentsService
        .getOrder(
          orderId,
          request.user?.id,
        );

    if (!order) {
      throw new NotFoundException(
        'Payment order not found',
      );
    }

    return order;
  }

  @Get('users/:userId')
  @ApiOperation({
    summary:
      'Get payments belonging to a user',
  })
  @ApiParam({
    name:
      'userId',
    description:
      'Payflow user UUID',
  })
  getUserPayments(
    @Param('userId')
    userId: string,

    @Req()
    request: AuthenticatedPaymentRequest,
  ) {
    return this.paymentsService
      .getUserPayments(
        userId,
        request.user?.id,
      );
  }
}
