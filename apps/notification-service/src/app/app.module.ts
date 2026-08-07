import {
  Module,
} from '@nestjs/common';

import {
  EmailModule,
} from './email/email.module';

import {
  NotificationsController,
} from './notifications.controller';

import {
  NotificationsGateway,
} from './notifications.gateway';

@Module({
  imports: [
    EmailModule,
  ],

  controllers: [
    NotificationsController,
  ],

  providers: [
    NotificationsGateway,
  ],
})
export class AppModule {}
