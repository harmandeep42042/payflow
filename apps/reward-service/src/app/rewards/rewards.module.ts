import { Module } from '@nestjs/common';
import { PrismaModule } from '@payflow/database';
import { RewardsController } from './rewards.controller';
import { RewardsConsumer } from './rewards.consumer';
import { RewardsService } from './rewards.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    RewardsController,
    RewardsConsumer,
  ],
  providers: [RewardsService],
})
export class RewardsModule {}
