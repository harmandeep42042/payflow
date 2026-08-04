import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type GatewayRole =
  | 'USER'
  | 'ADMIN';

export const Roles = (
  ...roles: GatewayRole[]
) => SetMetadata(ROLES_KEY, roles);