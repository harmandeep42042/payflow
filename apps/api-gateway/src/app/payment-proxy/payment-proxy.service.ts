import { HttpService } from '@nestjs/axios';

import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AxiosError } from 'axios';

import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaymentProxyService {
  private readonly paymentServiceUrl = (
    process.env['PAYMENT_SERVICE_URL'] ?? 'http://localhost:4005/api/v1'
  ).replace(/\/$/, '');

  constructor(private readonly httpService: HttpService) {}

  createOrder(body: unknown, authorization?: string, correlationId?: string) {
    return this.post('/payments/orders', body, authorization, correlationId);
  }

  confirmOrder(
    orderId: string,
    authorization?: string,
    correlationId?: string,
  ) {
    return this.post(
      `/payments/orders/${orderId}/confirm`,
      {},
      authorization,
      correlationId,
    );
  }

  getOrder(orderId: string, authorization?: string, correlationId?: string) {
    return this.get(
      `/payments/orders/${orderId}`,
      authorization,
      correlationId,
    );
  }

  getUserPayments(
    userId: string,
    authorization?: string,
    correlationId?: string,
  ) {
    return this.get(`/payments/users/${userId}`, authorization, correlationId);
  }

  private async get(
    path: string,
    authorization?: string,
    correlationId?: string,
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.paymentServiceUrl}${path}`, {
          headers: {
            ...(correlationId ? { 'x-correlation-id': correlationId } : {}),

            ...(authorization
              ? {
                  Authorization: authorization,
                }
              : {}),
          },
        }),
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
    correlationId?: string,
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.paymentServiceUrl}${path}`, body, {
          headers: {
            ...(correlationId ? { 'x-correlation-id': correlationId } : {}),

            'Content-Type': 'application/json',

            ...(authorization
              ? {
                  Authorization: authorization,
                }
              : {}),
          },
        }),
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
          error.response.data ?? {
            message: 'Payment service request failed',
          },
          error.response.status,
        );
      }

      throw new ServiceUnavailableException('Payment service is unavailable');
    }

    throw new ServiceUnavailableException(
      'Unable to communicate with payment service',
    );
  }
}
