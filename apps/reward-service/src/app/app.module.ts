import { Module } from '@nestjs/common';
import { RewardsModule } from './rewards/rewards.module';

@Module({
  imports: [RewardsModule],
})
export class AppModule {}
