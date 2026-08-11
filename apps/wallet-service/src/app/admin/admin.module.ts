import {
  AuditLogModule,
} from '../audit-log/audit-log.module';
import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import {
  WalletAuthModule,
} from '../wallet-auth/wallet-auth.module';

@Module({
  imports: [
    AuditLogModule,
    WalletAuthModule,
  ],
  controllers: [
    AdminController,
  ],

  providers: [
    AdminService,
  ],
})
export class AdminModule {}
