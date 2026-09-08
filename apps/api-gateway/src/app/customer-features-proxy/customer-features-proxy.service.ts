import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { payflowConfig } from '@payflow/shared-config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CustomerFeaturesProxyService {
  private readonly walletTarget = payflowConfig.urls.walletService;

  private readonly rewardTarget = (
    process.env['REWARD_SERVICE_URL'] ??
    'http://localhost:4007/api/v1'
  ).replace(/\/$/, '');

  constructor(private readonly http: HttpService) {}

  async forward(
    method: string,
    path: string,
    query: Record<string, unknown>,
    body: unknown,
    authorization?: string,
    userId?: string,
  ) {
    try {
      const isRewardRoute =
        path === '/rewards' ||
        path.startsWith('/rewards/');

      const target = isRewardRoute
        ? this.rewardTarget
        : `${this.walletTarget}/customer-features`;

      const params = { ...query };

      if (isRewardRoute && path === '/rewards' && userId) {
        params.userId = userId;
      }

      const response = await firstValueFrom(
        this.http.request({
          method,
          url: `${target}${path}`,
          params,
          data: body,
          headers: {
            ...(authorization
              ? { Authorization: authorization }
              : {}),
          },
        }),
      );

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }

      throw new ServiceUnavailableException(
        'Customer feature service is unavailable',
      );
    }
  }
}
