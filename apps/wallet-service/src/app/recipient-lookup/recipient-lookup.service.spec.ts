import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@payflow/database';
import { RecipientLookupService } from './recipient-lookup.service';

describe('RecipientLookupService privacy', () => {
  const findFirst = jest.fn();
  const service = new RecipientLookupService({
    user: { findFirst },
  } as unknown as PrismaService);

  beforeEach(() => findFirst.mockReset());

  it('rejects lookup of the authenticated caller', async () => {
    findFirst.mockResolvedValue({
      id: 'caller-1', email: 'caller@example.test', phone: null, vpa: 'caller@payflow',
      firstName: 'Caller', lastName: null, status: 'ACTIVE',
      wallets: [{ id: 'wallet-1', currency: 'INR', status: 'ACTIVE' }],
    });

    await expect(service.resolveRecipient({
      email: 'caller@example.test', currency: 'INR', excludeUserId: 'caller-1',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inactive or unavailable recipients without disclosing details', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.resolveRecipient({ email: 'missing@example.test', excludeUserId: 'caller-1' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the existing response contract for an authorized lookup', async () => {
    findFirst.mockResolvedValue({
      id: 'recipient-1', email: 'recipient@example.test', phone: null, vpa: 'recipient@payflow',
      firstName: 'Recipient', lastName: 'User', status: 'ACTIVE',
      wallets: [{ id: 'wallet-2', currency: 'USD', status: 'ACTIVE' }],
    });

    await expect(service.resolveRecipient({
      vpa: 'recipient@payflow', currency: 'USD', excludeUserId: 'caller-1',
    })).resolves.toMatchObject({
      recipient: { userId: 'recipient-1', walletId: 'wallet-2', currency: 'USD' },
    });
  });
});
