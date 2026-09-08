import { Module } from '@nestjs/common';

import { PrismaModule } from '@payflow/database';

import { WalletsModule } from '../wallets/wallets.module';

import { InternalSettlementAuthGuard } from './internal-settlement-auth.guard';

import { InternalSettlementController } from './internal-settlement.controller';

import { InternalSettlementService } from './internal-settlement.service';

@Module({
  imports: [PrismaModule, WalletsModule],

  controllers: [InternalSettlementController],

  providers: [InternalSettlementService, InternalSettlementAuthGuard],
})
export class InternalSettlementModule {}
