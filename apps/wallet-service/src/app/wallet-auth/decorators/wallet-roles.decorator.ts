import {
  SetMetadata,
} from '@nestjs/common';

export const WALLET_ROLES_KEY =
  'wallet_roles';

export type WalletRole =
  | 'USER'
  | 'ADMIN';

export const WalletRoles = (
  ...roles: WalletRole[]
) => SetMetadata(
  WALLET_ROLES_KEY,
  roles,
);
