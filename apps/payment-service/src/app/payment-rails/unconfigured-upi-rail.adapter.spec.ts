import { UnconfiguredUpiRailAdapter } from './unconfigured-upi-rail.adapter';

describe('UnconfiguredUpiRailAdapter', () => {
  const adapter = new UnconfiguredUpiRailAdapter();

  it('is fail-closed until a real UPI partner is configured', () => {
    expect(adapter.name).toBe('UNCONFIGURED');
    expect(adapter.isConfigured()).toBe(false);
    expect(adapter.getCapabilities()).toEqual([]);
  });

  it('cannot initiate UPI money movement', async () => {
    await expect(
      adapter.initiatePay({
        clientTransactionId: 'upi-test-1',
        payeeVpa: 'receiver@example',
        amountMinor: 100,
        currency: 'INR',
      }),
    ).rejects.toThrow(
      'Real UPI rail is not configured',
    );
  });

  it('cannot manufacture VPA verification', async () => {
    await expect(
      adapter.resolveVpa({
        vpa: 'receiver@example',
      }),
    ).rejects.toThrow(
      'Real UPI rail is not configured',
    );
  });
});