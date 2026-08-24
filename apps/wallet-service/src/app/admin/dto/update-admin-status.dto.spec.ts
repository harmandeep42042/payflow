import { validate } from 'class-validator';

import {
  AdminUserStatusValue,
  AdminWalletStatusValue,
  UpdateAdminUserStatusDto,
  UpdateAdminWalletStatusDto,
} from './update-admin-status.dto';

describe('Admin status DTO validation', () => {
  it('accepts supported user and wallet statuses', async () => {
    const user = new UpdateAdminUserStatusDto();
    user.status = AdminUserStatusValue.BLOCKED;
    const wallet = new UpdateAdminWalletStatusDto();
    wallet.status = AdminWalletStatusValue.FROZEN;

    await expect(validate(user)).resolves.toHaveLength(0);
    await expect(validate(wallet)).resolves.toHaveLength(0);
  });

  it('rejects unsupported status values', async () => {
    const user = new UpdateAdminUserStatusDto();
    user.status = 'DELETED' as AdminUserStatusValue;
    const wallet = new UpdateAdminWalletStatusDto();
    wallet.status = 'BLOCKED' as AdminWalletStatusValue;

    await expect(validate(user)).resolves.not.toHaveLength(0);
    await expect(validate(wallet)).resolves.not.toHaveLength(0);
  });
});
