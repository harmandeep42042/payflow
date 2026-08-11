import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  NotificationsService,
} from './notifications.service';

import {
  AuthenticatedNotificationRequest,
  NotificationJwtAuthGuard,
} from './notification-auth/notification-jwt-auth.guard';

@Controller('notifications')
@UseGuards(NotificationJwtAuthGuard)
export class NotificationHistoryController {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @Get()
  getNotifications(
    @Req()
    request: AuthenticatedNotificationRequest,

    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('unreadOnly')
    unreadOnly?: string,

    @Query('type')
    type?: string,
  ) {
    return this.notificationsService
      .findAll({
        userId:
          request.user!.id,

        page:
          page
            ? Number(page)
            : 1,

        limit:
          limit
            ? Number(limit)
            : 20,

        unreadOnly:
          unreadOnly ===
          'true',

        type:
          type?.trim() ||
          undefined,
      });
  }

  @Get(':notificationId')
  getNotification(
    @Param(
      'notificationId',
      new ParseUUIDPipe(),
    )
    notificationId: string,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationsService
      .findByIdForUser(
        notificationId,
        request.user!.id,
      );
  }

  @Patch('read-all')
  markAllAsRead(
    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationsService
      .markAllAsRead(
        request.user!.id,
      );
  }

  @Patch(':notificationId/read')
  markAsRead(
    @Param(
      'notificationId',
      new ParseUUIDPipe(),
    )
    notificationId: string,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationsService
      .markAsRead(
        notificationId,
        request.user!.id,
      );
  }

  @Delete()
  clearNotifications(
    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationsService
      .deleteAllForUser(
        request.user!.id,
      );
  }

  @Delete(':notificationId')
  deleteNotification(
    @Param(
      'notificationId',
      new ParseUUIDPipe(),
    )
    notificationId: string,

    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.notificationsService
      .deleteForUser(
        notificationId,
        request.user!.id,
      );
  }
}

