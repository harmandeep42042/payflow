import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GatewayJwtAuthGuard } from '../gateway-auth/guards/gateway-jwt-auth.guard';
import { RewardProxyService } from './reward-proxy.service';

type RewardRequest = { headers: { authorization?: string } };

@ApiTags('Rewards')
@ApiBearerAuth('access-token')
@UseGuards(GatewayJwtAuthGuard)
@Controller('rewards')
export class RewardProxyController {
  constructor(private readonly rewardProxyService: RewardProxyService) {}

  @Get()
  getRewards(@Query('userId') userId: string, @Req() request: RewardRequest) {
    return this.rewardProxyService.getUserRewards(userId, request.headers.authorization);
  }

  @Post(':rewardId/claim')
  claimReward(@Param('rewardId', new ParseUUIDPipe()) rewardId: string, @Body() body: { userId: string }, @Req() request: RewardRequest) {
    return this.rewardProxyService.claimReward(rewardId, body.userId, request.headers.authorization);
  }
}
