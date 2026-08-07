import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';

import {
  NotificationPreferencesService,
  UpdateNotificationPreferencesInput,
} from './notification-preferences.service';

@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(
    private readonly preferencesService:
      NotificationPreferencesService,
  ) {}

  @Get()
  getPreferences(
    @Query(
      'userId',
      new ParseUUIDPipe(),
    )
    userId: string,
  ) {
    return this.preferencesService
      .getOrCreate(
        userId,
      );
  }

  @Patch()
  updatePreferences(
    @Query(
      'userId',
      new ParseUUIDPipe(),
    )
    userId: string,

    @Body()
    input:
      UpdateNotificationPreferencesInput,
  ) {
    return this.preferencesService
      .update(
        userId,
        input,
      );
  }
}
