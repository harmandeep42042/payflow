import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RewardProxyService {
  private readonly rewardServiceUrl = (process.env['REWARD_SERVICE_URL'] ?? 'http://localhost:4007/api/v1').replace(/\/$/, '');

  constructor(private readonly httpService: HttpService) {}

  getUserRewards(userId: string, authorization?: string) {
    return this.get('/rewards?userId=' + encodeURIComponent(userId), authorization);
  }

  claimReward(rewardId: string, userId: string, authorization?: string) {
    return this.post('/rewards/' + rewardId + '/claim', { userId }, authorization);
  }

  private async get(path: string, authorization?: string) {
    try {
      const response = await firstValueFrom(this.httpService.get(this.rewardServiceUrl + path, { headers: authorization ? { Authorization: authorization } : {} }));
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private async post(path: string, body: unknown, authorization?: string) {
    try {
      const response = await firstValueFrom(this.httpService.post(this.rewardServiceUrl + path, body, { headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) } }));
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof AxiosError) {
      if (error.response) throw new HttpException(error.response.data ?? { message: 'Reward service request failed' }, error.response.status);
      throw new ServiceUnavailableException('Reward service is unavailable');
    }
    throw new ServiceUnavailableException('Unable to communicate with reward service');
  }
}
