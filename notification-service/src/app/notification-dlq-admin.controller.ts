import { UseGuards } from '@nestjs/common';
import { NotificationJwtAuthGuard } from './notification-auth/notification-jwt-auth.guard';
import { NotificationAdminGuard } from './notification-auth/notification-admin.guard';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { NotificationDlqAdminService } from './notification-dlq-admin.service';

type ReplayBody = {
  replayedBy?: string;
};

@UseGuards(NotificationJwtAuthGuard, NotificationAdminGuard)
@Controller('admin/dlq')
export class NotificationDlqAdminController {
  constructor(private readonly service: NotificationDlqAdminService) {}

  @Get()
  async list(
    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('status')
    status?: string,
  ) {
    return this.service.list(Number(page ?? 1), Number(limit ?? 20), status);
  }

  @Get(':id')
  async getById(
    @Param('id')
    id: string,
  ) {
    return this.service.getById(id);
  }

  @Post(':id/replay')
  async replay(
    @Param('id')
    id: string,

    @Body()
    body: ReplayBody,
  ) {
    const replayedBy = body.replayedBy?.trim() || 'internal-admin';

    return this.service.replay(id, replayedBy);
  }
}
