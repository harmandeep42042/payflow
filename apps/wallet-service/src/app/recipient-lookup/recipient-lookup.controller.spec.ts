import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RecipientLookupController } from './recipient-lookup.controller';
import { RecipientLookupService } from './recipient-lookup.service';
import { WalletJwtAuthGuard } from '../wallet-auth/guards/wallet-jwt-auth.guard';

describe('RecipientLookupController', () => {
  const resolveRecipient = jest.fn();
  const controller = new RecipientLookupController({ resolveRecipient } as unknown as RecipientLookupService);

  beforeEach(() => resolveRecipient.mockReset());

  it('requires the Wallet access-token guard on direct requests', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      RecipientLookupController.prototype.resolveRecipient,
    ) as unknown[];

    expect(guards).toContain(WalletJwtAuthGuard);
  });

  it('uses the authenticated caller as the excluded user', async () => {
    resolveRecipient.mockResolvedValue({ recipient: { userId: 'recipient-1' } });

    await controller.resolveRecipient(
      { user: { id: 'caller-1' } },
      'recipient@example.test',
      undefined,
      undefined,
      'INR',
    );

    expect(resolveRecipient).toHaveBeenCalledWith({
      email: 'recipient@example.test',
      phone: undefined,
      vpa: undefined,
      currency: 'INR',
      excludeUserId: 'caller-1',
    });
  });
});
