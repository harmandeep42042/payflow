import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WalletProxyService {
  private readonly walletServiceUrl =
    process.env.WALLET_SERVICE_URL ??
    'http://localhost:4001/api/v1';

  constructor(private readonly httpService: HttpService) {}

  getWallet(walletId: string) {
    return this.get(`/wallets/${walletId}`);
  }

  getUserWallets(userId: string) {
    return this.get(`/wallets/user/${userId}`);
  }

  deposit(body: unknown) {
    return this.post('/wallets/deposit', body);
  }

  withdraw(body: unknown) {
    return this.post('/wallets/withdraw', body);
  }

  transfer(body: unknown) {
    return this.post('/wallets/transfer', body);
  }

  private async get(path: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.walletServiceUrl}${path}`,
        ),
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private async post(path: string, body: unknown) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.walletServiceUrl}${path}`,
          body,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof AxiosError) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }

      throw new ServiceUnavailableException(
        'Wallet service is unavailable',
      );
    }

    throw new ServiceUnavailableException(
      'Unable to communicate with wallet service',
    );
  }
}