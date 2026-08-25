import { PROVIDER_NOT_CONFIGURED, runProviderOperation } from './providers';
describe.each(['Recharge','Bills','AutoPay'])('%s mocked provider adapter', () => {
  it('returns success without fabricating the provider payload', async () => { const value = { providerReference: 'mock-reference', status: 'SUCCEEDED' }; await expect(runProviderOperation({}, jest.fn().mockResolvedValue(value))).resolves.toEqual({ status: 'SUCCEEDED', value }); });
  it('normalizes timeout without credentials', async () => { jest.useFakeTimers(); const promise = runProviderOperation({}, () => new Promise(() => undefined), 10); jest.advanceTimersByTime(10); await expect(promise).resolves.toMatchObject({ status: 'FAILED', code: 'PROVIDER_TIMEOUT' }); jest.useRealTimers(); });
  it('normalizes provider failure', async () => { await expect(runProviderOperation({}, jest.fn().mockRejectedValue(new Error('upstream failed')))).resolves.toMatchObject({ status: 'FAILED', code: 'PROVIDER_FAILURE' }); });
  it('preserves the unconfigured environment response', async () => { await expect(runProviderOperation(undefined, jest.fn())).resolves.toMatchObject({ status: 'FAILED', code: PROVIDER_NOT_CONFIGURED }); });
});
