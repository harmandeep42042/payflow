import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { WALLET_ROLES_KEY } from '../wallet-auth/decorators/wallet-roles.decorator';
import { WalletJwtAuthGuard } from '../wallet-auth/guards/wallet-jwt-auth.guard';
import { WalletRolesGuard } from '../wallet-auth/guards/wallet-roles.guard';
import { RegulatedPaymentsController } from './regulated-payments.controller';

describe('RegulatedPaymentsController authorization boundary', () => {
  it('requires JWT authentication for every customer and admin route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, RegulatedPaymentsController)).toContain(WalletJwtAuthGuard);
  });

  it('requires the ADMIN role for operational visibility', () => {
    const handler = RegulatedPaymentsController.prototype.admin;
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(WalletRolesGuard);
    expect(Reflect.getMetadata(WALLET_ROLES_KEY, handler)).toEqual(['ADMIN']);
  });

  it('derives ownership from the authenticated request, not body or route userId', async () => {
    const service = { setVpa: jest.fn().mockResolvedValue({}), bankAccounts: jest.fn().mockResolvedValue([]) };
    const controller = new RegulatedPaymentsController(service as never);
    await controller.setVpa({ user: { id: 'jwt-owner' } }, { vpa: 'owner@payflow' });
    await controller.bankAccounts({ user: { id: 'jwt-owner' } });
    expect(service.setVpa).toHaveBeenCalledWith('jwt-owner', { vpa: 'owner@payflow' });
    expect(service.bankAccounts).toHaveBeenCalledWith('jwt-owner');
  });
});
