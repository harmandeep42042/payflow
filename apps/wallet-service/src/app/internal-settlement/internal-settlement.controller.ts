import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { SettleExternalPaymentDto } from './dto/settle-external-payment.dto';

import { InternalSettlementAuthGuard } from './internal-settlement-auth.guard';

import { InternalSettlementService } from './internal-settlement.service';

@Controller('internal/settlements')
@UseGuards(InternalSettlementAuthGuard)
export class InternalSettlementController {
  constructor(private readonly service: InternalSettlementService) {}

  @Post('payment')
  settlePayment(
    @Body()
    dto: SettleExternalPaymentDto,
  ) {
    return this.service.settleExternalPayment(dto);
  }
}
