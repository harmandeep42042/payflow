import { Module } from '@nestjs/common';
import { PrismaModule } from '@payflow/database';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [PrismaModule],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
