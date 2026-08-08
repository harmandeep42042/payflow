import {
  HttpService,
} from '@nestjs/axios';

import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  AxiosError,
} from 'axios';

import {
  firstValueFrom,
} from 'rxjs';

@Injectable()
export class PaymentProxyService {
  private readonly paymentServiceUrl =
    (
      process.env[
        'PAYMENT_SERVICE_URL'
      ] ??
      'http://localhost:4005/api/v1'
    ).replace(
      /\/$/,
      '',
    );

  constructor(
    private readonly httpService:
      HttpService,
  ) {}

  createOrder(
    body: unknown,
  ) {
    return this.post(
      '/payments/orders',
      body,
    );
  }

  confirmOrder(
    orderId: string,
  ) {
    return this.post(
      `/payments/orders/${orderId}/confirm`,
      {},
    );
  }

  getOrder(
    orderId: string,
  ) {
    return this.get(
      `/payments/orders/${orderId}`,
    );
  }

  getUserPayments(
    userId: string,
  ) {
    return this.get(
      `/payments/users/${userId}`,
    );
  }

  private async get(
    path: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.get(
            `${this.paymentServiceUrl}${path}`,
          ),
        );

      return response.data;
    } catch (error) {
      this.handleError(
        error,
      );
    }
  }

  private async post(
    path: string,
    body: unknown,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.post(
            `${this.paymentServiceUrl}${path}`,
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
      this.handleError(
        error,
      );
    }
  }

  private handleError(
    error: unknown,
  ): never {
    if (
      error instanceof
      AxiosError
    ) {
      if (
        error.response
      ) {
        throw new HttpException(
          error.response.data ?? {
            message:
              'Payment service request failed',
          },
          error.response.status,
        );
      }

      throw new ServiceUnavailableException(
        'Payment service is unavailable',
      );
    }

    throw new ServiceUnavailableException(
      'Unable to communicate with payment service',
    );
  }
}
