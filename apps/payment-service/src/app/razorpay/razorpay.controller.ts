import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  CreateRazorpayOrderDto,
} from './dto/create-razorpay-order.dto';

import {
  RazorpayService,
} from './razorpay.service';

@ApiTags('Razorpay Payments')
@Controller('payments/razorpay')
export class RazorpayController {
  constructor(
    private readonly razorpayService:
      RazorpayService,
  ) {}

  @Post('orders')
  @ApiOperation({
    summary:
      'Create a Razorpay payment order',
  })
  createOrder(
    @Body()
    dto: CreateRazorpayOrderDto,
  ) {
    return this.razorpayService
      .createOrder(dto);
  }
}