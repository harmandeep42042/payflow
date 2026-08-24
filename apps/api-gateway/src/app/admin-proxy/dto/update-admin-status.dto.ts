import { IsEnum } from 'class-validator';

export enum AdminUserStatusValue {
  ACTIVE = 'ACTIVE', BLOCKED = 'BLOCKED', SUSPENDED = 'SUSPENDED',
}

export enum AdminWalletStatusValue {
  ACTIVE = 'ACTIVE', FROZEN = 'FROZEN', CLOSED = 'CLOSED',
}

export class UpdateAdminUserStatusDto {
  @IsEnum(AdminUserStatusValue)
  status!: AdminUserStatusValue;
}

export class UpdateAdminWalletStatusDto {
  @IsEnum(AdminWalletStatusValue)
  status!: AdminWalletStatusValue;
}
