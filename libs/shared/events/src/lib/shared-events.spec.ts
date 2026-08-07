import {
  WalletEventPattern,
  WalletTransferCompletedEvent,
} from './shared-events';

describe('shared-events', () => {
  it('provides wallet event patterns', () => {
    expect(
      WalletEventPattern.TransferCompleted,
    ).toBe(
      'wallet.transfer.completed',
    );
  });

  it('supports transfer event payloads', () => {
    const event: WalletTransferCompletedEvent = {
      type:
        WalletEventPattern.TransferCompleted,
      eventId: 'event-1',
      occurredAt:
        new Date().toISOString(),
      currency: 'INR',
      amount: '100.00',
      transferId: 'transfer-1',
      sourceWalletId: 'wallet-1',
      destinationWalletId: 'wallet-2',
      description: 'Test transfer',
      sender: {
        id: 'user-1',
        email: 'sender@payflow.com',
        firstName: 'Sender',
        lastName: 'User',
      },
      receiver: {
        id: 'user-2',
        email: 'receiver@payflow.com',
        firstName: 'Receiver',
        lastName: 'User',
      },
    };

    expect(event.amount).toBe(
      '100.00',
    );

    expect(event.sender.email).toBe(
      'sender@payflow.com',
    );
  });
});