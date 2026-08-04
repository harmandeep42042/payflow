import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

type AdminUsersQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  role?: string;
};

type AdminWalletsQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  currency?: string;
};

type AdminTransactionsQuery = {
  page?: string;
  limit?: string;
  search?: string;
  type?: string;
  status?: string;
};

type UpdateWalletStatusBody = {
  status:
    | 'ACTIVE'
    | 'FROZEN'
    | 'CLOSED';
};

@Injectable()
export class AdminProxyService {
  private readonly walletServiceUrl =
    process.env.WALLET_SERVICE_URL ??
    'http://localhost:4001/api/v1';

  constructor(
    private readonly httpService:
      HttpService,
  ) {}

  getDashboard() {
    return this.get('/admin/dashboard');
  }

  getUsers(
    query: AdminUsersQuery,
  ) {
    return this.getWithQuery(
      '/admin/users',
      query,
    );
  }

  getWallets(
    query: AdminWalletsQuery,
  ) {
    return this.getWithQuery(
      '/admin/wallets',
      query,
    );
  }

  getTransactions(
    query: AdminTransactionsQuery,
  ) {
    return this.getWithQuery(
      '/admin/transactions',
      query,
    );
  }

  getAnalytics(
    days?: string,
  ) {
    return this.getWithQuery(
      '/admin/analytics',
      {
        days,
      },
    );
  }

  getTransactionById(
    transactionId: string,
  ) {
    return this.get(
      `/admin/transactions/${transactionId}`,
    );
  }

  updateWalletStatus(
    walletId: string,
    body: UpdateWalletStatusBody,
  ) {
    return this.patch(
      `/admin/wallets/${walletId}/status`,
      body,
    );
  }

  private getWithQuery(
    path: string,
    query: Record<
      string,
      string | undefined
    >,
  ) {
    const searchParams =
      new URLSearchParams();

    for (
      const [key, value]
      of Object.entries(query)
    ) {
      if (value) {
        searchParams.set(key, value);
      }
    }

    const queryString =
      searchParams.toString();

    return this.get(
      queryString
        ? `${path}?${queryString}`
        : path,
    );
  }

  private async get(
    path: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.get(
            `${this.walletServiceUrl}${path}`,
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  private async patch(
    path: string,
    body: unknown,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.patch(
            `${this.walletServiceUrl}${path}`,
            body,
            {
              headers: {
                'Content-Type':
                  'application/json',
              },
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  private handleHttpError(
    error: unknown,
  ): never {
    if (error instanceof AxiosError) {
      if (error.response) {
        throw new HttpException(
          error.response.data ?? {
            message:
              'Admin service request failed',
          },
          error.response.status,
        );
      }

      throw new ServiceUnavailableException(
        'Wallet service is unavailable',
      );
    }

    throw new ServiceUnavailableException(
      'Unable to communicate with administration service',
    );
  }
}