import {
  HttpService,
} from '@nestjs/axios';

import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  payflowConfig,
} from '@payflow/shared-config';

import {
  AxiosError,
} from 'axios';

import {
  firstValueFrom,
} from 'rxjs';

type TransactionHistoryQuery = {
  type?: string;
  page?: string;
  limit?: string;
};

@Injectable()
export class WalletProxyService {
  private readonly walletServiceUrl =
    payflowConfig.urls.walletService;

  constructor(
    private readonly httpService:
      HttpService,
  ) {}

  createWallet(
    body: unknown,
  ) {
    return this.post(
      '/wallets',
      body,
    );
  }

  getWallet(
    walletId: string,
  ) {
    return this.get(
      `/wallets/${walletId}`,
    );
  }

  getUserWallets(
    userId: string,
  ) {
    return this.get(
      `/wallets/user/${userId}`,
    );
  }

  getTransactionHistory(
    walletId: string,
    query: TransactionHistoryQuery,
  ) {
    return this.get(
      `/wallets/${walletId}/transactions`,
      query,
    );
  }

  deposit(
    body: unknown,
  ) {
    return this.post(
      '/wallets/deposit',
      body,
    );
  }

  withdraw(
    body: unknown,
  ) {
    return this.post(
      '/wallets/withdraw',
      body,
    );
  }

  transfer(
    body: unknown,
    authorization?: string,
  ) {
    return this.post(
      '/wallets/transfer',
      body,
      authorization,
    );
  }

  private async get(
    path: string,
    params?: Record<string, unknown>,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.get(
            `${this.walletServiceUrl}${path}`,
            {
              params,
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private async post(
    path: string,
    body: unknown,
    authorization?: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.post(
            `${this.walletServiceUrl}${path}`,
            body,
            {
              headers: {
                'Content-Type':
                  'application/json',

                ...(authorization
                  ? {
                      Authorization:
                        authorization,
                    }
                  : {}),
              },
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(
    error: unknown,
  ): never {
    if (error instanceof AxiosError) {
      if (error.response) {
        throw new HttpException(
          error.response.data ?? {
            message:
              'Wallet service request failed',
          },
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