import type {
  AdminLoginResponse,
  PayflowTransaction,
  PayflowUser,
  PayflowWallet,
} from './shared-types';

describe('shared-types', () => {
  it('supports Payflow user, wallet and transaction contracts', () => {
    const user: PayflowUser = {
      id: 'user-1',
      email: 'user@payflow.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      status: 'ACTIVE',
    };

    const wallet: PayflowWallet = {
      id: 'wallet-1',
      userId: user.id,
      currency: 'INR',
      balance: '500.00',
      version: 1,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const transaction: PayflowTransaction = {
      id: 'transaction-1',
      type: 'DEPOSIT',
      amount: '500.00',
      currency: 'INR',
      status: 'COMPLETED',
      walletId: wallet.id,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    const loginResponse: AdminLoginResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        ...user,
        role: 'ADMIN',
      },
    };

    expect(user.email).toBe(
      'user@payflow.com',
    );

    expect(wallet.currency).toBe('INR');

    expect(transaction.type).toBe(
      'DEPOSIT',
    );

    expect(loginResponse.user.role).toBe(
      'ADMIN',
    );
  });
});