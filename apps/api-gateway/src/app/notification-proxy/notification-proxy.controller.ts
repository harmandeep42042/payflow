import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import {
  GatewayJwtAuthGuard,
} from '../gateway-auth/guards/gateway-jwt-auth.guard';

import {
  NotificationProxyService,
} from './notification-proxy.service';

type AuthenticatedNotificationRequest = {
  headers: {
    authorization?: string;
  };
};

type NotificationQuery = {
  page?: string;
  limit?: string;
  unreadOnly?: string;
  type?: string;
};

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(GatewayJwtAuthGuard)
@Controller()
export class NotificationProxyController {
  constructor(
    private readonly notificationProxyService:
      NotificationProxyService,
  ) {}

  @Get('notifications')
  getNotifications(
    @Query()
    query: NotificationQuery,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationProxyService
      .getNotifications(
        query,
        request.headers.authorization,
      );
  }

  @Get('notifications/:notificationId')
  getNotification(
    @Param('notificationId')
    notificationId: string,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationProxyService
      .getNotification(
        notificationId,
        request.headers.authorization,
      );
  }

  @Patch('notifications/read-all')
  markAllAsRead(
    @Body()
    body: unknown,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationProxyService
      .markAllAsRead(
        body,
        request.headers.authorization,
      );
  }

  @Patch('notifications/:notificationId/read')
  markAsRead(
    @Param('notificationId')
    notificationId: string,

    @Body()
    body: unknown,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationProxyService
      .markAsRead(
        notificationId,
        body,
        request.headers.authorization,
      );
  }

  @Delete('notifications')
  clearNotifications(
    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationProxyService
      .clearNotifications(
        request.headers.authorization,
      );
  }

  @Delete('notifications/:notificationId')
  deleteNotification(
    @Param('notificationId')
    notificationId: string,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationProxyService
      .deleteNotification(
        notificationId,
        request.headers.authorization,
      );
  }

  @Get('notification-preferences')
  getPreferences(
    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationProxyService
      .getPreferences(
        request.headers.authorization,
      );
  }

  @Patch('notification-preferences')
  updatePreferences(
    @Body()
    body: unknown,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationProxyService
      .updatePreferences(
        body,
        request.headers.authorization,
      );
  }
}
