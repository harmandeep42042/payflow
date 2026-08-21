import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RewardsService } from './rewards.service';

@Controller('api/v1/rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}
  @Get('health')
  getHealth() { return this.rewardsService.getHealth(); }
  @Get()
  getRewards(@Query('userId') userId: string) { return this.rewardsService.getUserRewards(userId); }
  @Post('generate')
  generate(@Body() body: { userId: string; walletId: string; paymentId?: string }) { return this.rewardsService.generateScratchCard(body.userId, body.walletId, body.paymentId); }
  @Post(':rewardId/claim')
  claim(@Param('rewardId') rewardId: string, @Body() body: { userId: string }) { return this.rewardsService.claimReward(rewardId, body.userId); }
}


