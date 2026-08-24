import { UnauthorizedException } from '@nestjs/common';
import { RewardProxyController } from './reward-proxy.controller';
import { RewardProxyService } from './reward-proxy.service';

describe('RewardProxyController', () => {
  const rewardProxyService = {
    getUserRewards: jest.fn(),
    claimReward: jest.fn(),
  };

  const controller = new RewardProxyController(
    rewardProxyService as unknown as RewardProxyService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the authenticated identity when listing rewards', () => {
    controller.getRewards({
      headers: { authorization: 'Bearer access-token' },
      user: { id: 'authenticated-user' },
    });

    expect(rewardProxyService.getUserRewards).toHaveBeenCalledWith(
      'authenticated-user',
      'Bearer access-token',
    );
  });

  it('uses the authenticated identity when claiming a reward', () => {
    controller.claimReward('00000000-0000-4000-8000-000000000001', {
      headers: { authorization: 'Bearer access-token' },
      user: { id: 'authenticated-user' },
    });

    expect(rewardProxyService.claimReward).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      'authenticated-user',
      'Bearer access-token',
    );
  });

  it('rejects a request without an authenticated identity', () => {
    expect(() => controller.getRewards({ headers: {} })).toThrow(
      UnauthorizedException,
    );
    expect(rewardProxyService.getUserRewards).not.toHaveBeenCalled();
  });
});
