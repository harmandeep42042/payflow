import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GatewayJwtAuthGuard } from '../gateway-auth/guards/gateway-jwt-auth.guard';
import { RewardProxyService } from './reward-proxy.service';

type RewardRequest = {
  headers: { authorization?: string };
  user?: { id?: string };
};

@ApiTags('Rewards')
@ApiBearerAuth('access-token')
@UseGuards(GatewayJwtAuthGuard)
@Controller('rewards')
export class RewardProxyController {
  constructor(
    private readonly rewardProxyService: RewardProxyService,
  ) {}

  @Get()
  getRewards(@Req() request: RewardRequest) {
    return this.rewardProxyService.getUserRewards(
      this.getAuthenticatedUserId(request),
      request.headers.authorization,
    );
  }

  @Post(':rewardId/claim')
  claimReward(
    @Param('rewardId', new ParseUUIDPipe()) rewardId: string,
    @Req() request: RewardRequest,
  ) {
    return this.rewardProxyService.claimReward(
      rewardId,
      this.getAuthenticatedUserId(request),
      request.headers.authorization,
    );
  }

  private getAuthenticatedUserId(request: RewardRequest): string {
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user identity is required',
      );
    }

    return userId;
  }
}
