import { payflowConfig } from '@payflow/shared-config';
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
    payflowConfig.urls.walletService;

  constructor(
    private readonly httpService:
      HttpService,
  ) {}

  getDashboard(authorization?: string) {
    return this.get('/admin/dashboard', authorization);
  }

  getUsers(
    query: AdminUsersQuery,
    authorization?: string,
  ) {
    return this.getWithQuery(
      '/admin/users',
      query,
      authorization,
    );
  }


  getUserById(
    userId: string,
    authorization?: string,
  ) {
    return this.get(`/admin/users/${userId}`, authorization);
  }

  updateUserStatus(
    userId: string,
    body: {
      status:
        | 'ACTIVE'
        | 'BLOCKED'
        | 'SUSPENDED';
    },
    authorization?: string,
  ) {
    return this.patch(
      `/admin/users/${userId}/status`,
      body,
      authorization,
    );
  }
  getWallets(
    query: AdminWalletsQuery,
    authorization?: string,
  ) {
    return this.getWithQuery(
      '/admin/wallets',
      query,
      authorization,
    );
  }

  getTransactions(
    query: AdminTransactionsQuery,
    authorization?: string,
  ) {
    return this.getWithQuery(
      '/admin/transactions',
      query,
      authorization,
    );
  }


  getAuditLogs(
    query: {
      page?: string;
      limit?: string;
      action?: string;
      targetType?: string;
      actorUserId?: string;
    },
    authorization?: string,
  ) {
    return this.getWithQuery(
      '/admin/audit-logs',
      query,
      authorization,
    );
  }
  getAnalytics(
    days?: string,
    authorization?: string,
  ) {
    return this.getWithQuery(
      '/admin/analytics',
      {
        days,
      },
      authorization,
    );
  }

  getTransactionById(
    transactionId: string,
    authorization?: string,
  ) {
    return this.get(
      `/admin/transactions/${transactionId}`,
      authorization,
    );
  }

  updateWalletStatus(
    walletId: string,
    body: UpdateWalletStatusBody,
    authorization?: string,
  ) {
    return this.patch(
      `/admin/wallets/${walletId}/status`,
      body,
      authorization,
    );
  }

  private getWithQuery(
    path: string,
    query: Record<
      string,
      string | undefined
    >,
  authorization?: string,
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
      authorization,
    );
  }

  private async get(
    path: string,
    authorization?: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.get(
            `${this.walletServiceUrl}${path}`,
            {
              headers: authorization
                ? {
                    Authorization:
                      authorization,
                  }
                : {},
            },
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
    authorization?: string,
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











