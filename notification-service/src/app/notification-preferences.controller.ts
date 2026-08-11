import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  NotificationPreferencesService,
  UpdateNotificationPreferencesInput,
} from './notification-preferences.service';

import {
  AuthenticatedNotificationRequest,
  NotificationJwtAuthGuard,
} from './notification-auth/notification-jwt-auth.guard';

@Controller('notification-preferences')
@UseGuards(NotificationJwtAuthGuard)
export class NotificationPreferencesController {
  constructor(
    private readonly preferencesService:
      NotificationPreferencesService,
  ) {}

  @Get()
  getPreferences(
    @Req()
    request: AuthenticatedNotificationRequest,
  ) {
    return this.preferencesService
      .getOrCreate(
        request.user!.id,
      );
  }

  @Patch()
  updatePreferences(
    @Req()
    request: AuthenticatedNotificationRequest,

    @Body()
    input:
      UpdateNotificationPreferencesInput,
  ) {
    return this.preferencesService
      .update(
        request.user!.id,
        input,
      );
  }
}
