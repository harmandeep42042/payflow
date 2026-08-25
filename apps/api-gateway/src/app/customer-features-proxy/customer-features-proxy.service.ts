import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { payflowConfig } from '@payflow/shared-config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CustomerFeaturesProxyService {
  private readonly target = payflowConfig.urls.walletService;
  constructor(private readonly http: HttpService) {}
  async forward(method: string, path: string, query: Record<string, unknown>, body: unknown, authorization?: string) {
    try {
      const response = await firstValueFrom(this.http.request({ method, url: `${this.target}/customer-features${path}`, params: query, data: body, headers: { ...(authorization ? { Authorization: authorization } : {}) } }));
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) throw new HttpException(error.response.data, error.response.status);
      throw new ServiceUnavailableException('Wallet feature service is unavailable');
    }
  }
}
