import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';

import {
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

@ApiTags('Payments')
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
  ) {
    return this.paymentsService
      .createOrder(dto);
  }

  @Get('orders/:orderId')
  @ApiOperation({
    summary:
      'Get payment order details',
  })
  @ApiParam({
    name: 'orderId',
    description:
      'Internal payment order UUID',
  })
  getOrder(
    @Param('orderId')
    orderId: string,
  ) {
    const order =
      this.paymentsService
        .getOrder(orderId);

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
    name: 'userId',
    description:
      'Payflow user UUID',
  })
  getUserPayments(
    @Param('userId')
    userId: string,
  ) {
    return this.paymentsService
      .getUserPayments(userId);
  }
}