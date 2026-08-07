import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import {
  ConfirmMockPaymentDto,
} from './dto/confirm-mock-payment.dto';

import {
  CreateMockPaymentDto,
} from './dto/create-mock-payment.dto';

import {
  MockPaymentService,
} from './mock-payment.service';

@ApiTags('Mock Payments')
@Controller('payments/mock')
export class MockPaymentController {
  constructor(
    private readonly mockPaymentService:
      MockPaymentService,
  ) {}

  @Post('orders')
  @ApiOperation({
    summary:
      'Create a mock payment order',
  })
  createOrder(
    @Body()
    dto: CreateMockPaymentDto,
  ) {
    return this.mockPaymentService
      .createOrder(dto);
  }

  @Get('orders/:paymentId')
  @ApiOperation({
    summary:
      'Get a mock payment order',
  })
  @ApiParam({
    name: 'paymentId',
  })
  getOrder(
    @Param(
      'paymentId',
      new ParseUUIDPipe(),
    )
    paymentId: string,
  ) {
    return this.mockPaymentService
      .getOrder(paymentId);
  }

  @Post('orders/:paymentId/confirm')
  @ApiOperation({
    summary:
      'Confirm or fail a mock payment',
  })
  confirmOrder(
    @Param(
      'paymentId',
      new ParseUUIDPipe(),
    )
    paymentId: string,

    @Body()
    dto: ConfirmMockPaymentDto,
  ) {
    return this.mockPaymentService
      .confirmOrder(
        paymentId,
        dto,
      );
  }
}