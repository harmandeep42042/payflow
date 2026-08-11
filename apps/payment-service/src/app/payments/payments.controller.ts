import {
  Body,
  Controller,
  Get,
  NotFoundException,
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
    private readonly paymentsService:
      PaymentsService,
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
  createOrder(
    @Body()
    dto: CreatePaymentOrderDto,

    @Req()
    request: AuthenticatedPaymentRequest,
  ) {
    return this.paymentsService
      .createOrder(
        dto,
        request.user?.id,
      );
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
  confirmOrder(
    @Param(
      'orderId',
      new ParseUUIDPipe(),
    )
    orderId: string,

    @Req()
    request: AuthenticatedPaymentRequest,
  ) {
    return this.paymentsService
      .confirmOrder(
        orderId,
        request.user?.id,
        request.headers.authorization,
      );
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
