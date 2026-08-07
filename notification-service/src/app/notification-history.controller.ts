import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';

import {
  NotificationsService,
} from './notifications.service';

@Controller('notifications')
export class NotificationHistoryController {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @Get()
  getNotifications(
    @Query('userId')
    userId?: string,

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
          userId?.trim() ||
          undefined,

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
  ) {
    return this.notificationsService
      .findById(
        notificationId,
      );
  }

  @Patch('read-all')
  markAllAsRead(
    @Query(
      'userId',
      new ParseUUIDPipe(),
    )
    userId: string,
  ) {
    return this.notificationsService
      .markAllAsRead(
        userId,
      );
  }

  @Patch(':notificationId/read')
  markAsRead(
    @Param(
      'notificationId',
      new ParseUUIDPipe(),
    )
    notificationId: string,
  ) {
    return this.notificationsService
      .markAsRead(
        notificationId,
      );
  }

  @Delete()
  clearNotifications(
    @Query(
      'userId',
      new ParseUUIDPipe(),
    )
    userId: string,
  ) {
    return this.notificationsService
      .deleteAllForUser(
        userId,
      );
  }

  @Delete(':notificationId')
  deleteNotification(
    @Param(
      'notificationId',
      new ParseUUIDPipe(),
    )
    notificationId: string,

    @Query(
      'userId',
      new ParseUUIDPipe(),
    )
    userId: string,
  ) {
    return this.notificationsService
      .deleteForUser(
        notificationId,
        userId,
      );
  }
}

