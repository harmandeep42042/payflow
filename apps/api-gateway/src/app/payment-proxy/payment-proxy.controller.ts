import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import {
  GatewayJwtAuthGuard,
} from '../gateway-auth/guards/gateway-jwt-auth.guard';

import {
  PaymentProxyService,
} from './payment-proxy.service';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(
  GatewayJwtAuthGuard,
)
@Controller('payments')
export class PaymentProxyController {
  constructor(
    private readonly paymentProxyService:
      PaymentProxyService,
  ) {}

  @Post('orders')
  @ApiOperation({
    summary:
      'Create a payment order through the protected Gateway route',
  })
  createOrder(
    @Body()
    body: unknown,
  ) {
    return this.paymentProxyService
      .createOrder(
        body,
      );
  }

  @Post(
    'orders/:orderId/confirm',
  )
  @ApiOperation({
    summary:
      'Confirm a payment order through the protected Gateway route',
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
  ) {
    return this.paymentProxyService
      .confirmOrder(
        orderId,
      );
  }

  @Get(
    'orders/:orderId',
  )
  @ApiOperation({
    summary:
      'Get payment order through the protected Gateway route',
  })
  @ApiParam({
    name:
      'orderId',
    description:
      'Internal payment order UUID',
  })
  getOrder(
    @Param(
      'orderId',
      new ParseUUIDPipe(),
    )
    orderId: string,
  ) {
    return this.paymentProxyService
      .getOrder(
        orderId,
      );
  }

  @Get(
    'users/:userId',
  )
  @ApiOperation({
    summary:
      'Get user payment history through the protected Gateway route',
  })
  @ApiParam({
    name:
      'userId',
    description:
      'Payflow user UUID',
  })
  getUserPayments(
    @Param(
      'userId',
      new ParseUUIDPipe(),
    )
    userId: string,
  ) {
    return this.paymentProxyService
      .getUserPayments(
        userId,
      );
  }
}
