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

type NotificationQuery = {
  page?: string;
  limit?: string;
  unreadOnly?: string;
  type?: string;
};

@Injectable()
export class NotificationProxyService {
  private readonly notificationServiceUrl =
    (
      process.env[
        'NOTIFICATION_SERVICE_URL'
      ] ??
      'http://notification-service:4006'
    ).replace(
      /\/$/,
      '',
    );

  constructor(
    private readonly httpService:
      HttpService,
  ) {}

  getNotifications(
    query: NotificationQuery,
    authorization?: string,
  ) {
    const supportedQuery: NotificationQuery = {
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
      type: query.type,
    };

    return this.request(
      'GET',
      '/api/v1/notifications',
      authorization,
      undefined,
      supportedQuery,
    );
  }

  getNotification(
    notificationId: string,
    authorization?: string,
  ) {
    return this.request(
      'GET',
      `/api/v1/notifications/${notificationId}`,
      authorization,
    );
  }

  markAllAsRead(
    body: unknown,
    authorization?: string,
  ) {
    return this.request(
      'PATCH',
      '/api/v1/notifications/read-all',
      authorization,
      body,
    );
  }

  markAsRead(
    notificationId: string,
    body: unknown,
    authorization?: string,
  ) {
    return this.request(
      'PATCH',
      `/api/v1/notifications/${notificationId}/read`,
      authorization,
      body,
    );
  }

  clearNotifications(
    authorization?: string,
  ) {
    return this.request(
      'DELETE',
      '/api/v1/notifications',
      authorization,
    );
  }

  deleteNotification(
    notificationId: string,
    authorization?: string,
  ) {
    return this.request(
      'DELETE',
      `/api/v1/notifications/${notificationId}`,
      authorization,
    );
  }

  getPreferences(
    authorization?: string,
  ) {
    return this.request(
      'GET',
      '/api/v1/notification-preferences',
      authorization,
    );
  }

  updatePreferences(
    body: unknown,
    authorization?: string,
  ) {
    return this.request(
      'PATCH',
      '/api/v1/notification-preferences',
      authorization,
      body,
    );
  }

  private async request(
    method: 'GET' | 'PATCH' | 'DELETE',
    path: string,
    authorization?: string,
    data?: unknown,
    params?: NotificationQuery,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.request({
            method,
            url:
              `${this.notificationServiceUrl}${path}`,
            data,
            params,
            headers: {
              ...(data !== undefined
                ? {
                    'Content-Type':
                      'application/json',
                  }
                : {}),

              ...(authorization
                ? {
                    Authorization:
                      authorization,
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

  private handleError(
    error: unknown,
  ): never {
    if (
      error instanceof
      AxiosError
    ) {
      if (error.response) {
        throw new HttpException(
          error.response.data ?? {
            message:
              'Notification service request failed',
          },
          error.response.status,
        );
      }

      throw new ServiceUnavailableException(
        'Notification service is unavailable',
      );
    }

    throw new ServiceUnavailableException(
      'Unable to communicate with notification service',
    );
  }
}
