import { NotConfiguredPaymentProvider, PROVIDER_NOT_CONFIGURED, runProviderOperation } from './providers';

describe('provider safety boundary', () => {
  it('returns provider-not-configured without a synthetic provider reference', async () => {
    const provider = new NotConfiguredPaymentProvider();
    for (const result of await Promise.all([
      provider.createPayment({ amount: '10.00' }), provider.createCollectRequest({ amount: '10.00' }),
      provider.verifyAccount({ bankName: 'Test', maskedAccountNumber: '******1234', ifsc: 'TEST0000001' }),
      provider.refund('unknown', {}),
    ])) expect(result).toEqual({ status: 'NOT_CONFIGURED', failureCode: PROVIDER_NOT_CONFIGURED, message: 'Provider is not configured.' });
  });

  it('fails closed when no provider implementation is injected', async () => {
    await expect(runProviderOperation(undefined, async () => ({ status: 'SUCCESS' }))).resolves.toEqual(expect.objectContaining({ status: 'FAILED', code: PROVIDER_NOT_CONFIGURED }));
  });
});
