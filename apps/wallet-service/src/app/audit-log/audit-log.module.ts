import {
  Module,
} from '@nestjs/common';

import {
  PrismaModule,
} from '@payflow/database';

import {
  AuditLogService,
} from './audit-log.service';

@Module({
  imports: [
    PrismaModule,
  ],

  providers: [
    AuditLogService,
  ],

  exports: [
    AuditLogService,
  ],
})
export class AuditLogModule {}