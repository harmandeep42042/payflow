export const PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED' as const;
export type ProviderStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'TIMEOUT' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
export type ProviderResult<T = unknown> = { status: ProviderStatus; value?: T; providerReference?: string; failureCode?: string; message?: string };
export type ProviderOperationResult = { status: 'SUCCEEDED'; value: unknown } | { status: 'FAILED'; code: 'PROVIDER_TIMEOUT' | 'PROVIDER_FAILURE' | typeof PROVIDER_NOT_CONFIGURED; message: string };
export async function runProviderOperation(provider: object | undefined, operation: () => Promise<unknown>, timeoutMs = 10_000): Promise<ProviderOperationResult> {
  if (!provider) return { status: 'FAILED', code: PROVIDER_NOT_CONFIGURED, message: 'Provider is not configured.' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PROVIDER_TIMEOUT')), timeoutMs); }); return { status: 'SUCCEEDED', value: await Promise.race([operation(), timeout]) }; }
  catch (error) { const timeout = error instanceof Error && error.message === 'PROVIDER_TIMEOUT'; return { status: 'FAILED', code: timeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_FAILURE', message: timeout ? 'Provider request timed out.' : 'Provider request failed.' }; }
  finally { if (timer) clearTimeout(timer); }
}
export interface RechargeProvider {
  validateRequest(input: { operator: string; mobileNumber: string; amount: string; currency: string; planId?: string }): Promise<ProviderResult>;
  getPlans(input: { operator: string; mobileNumber: string }): Promise<unknown>;
  createRecharge(input: Record<string, unknown>): Promise<ProviderResult>;
  getStatus(providerReference: string): Promise<ProviderResult>;
  cancel?(providerReference: string): Promise<ProviderResult>;
  retry?(providerReference: string): Promise<ProviderResult>;
}
export interface BillerProvider {
  lookupBillers(category: string): Promise<ProviderResult>;
  validateBill(input: Record<string, unknown>): Promise<ProviderResult>;
  fetchBill(input: Record<string, unknown>): Promise<ProviderResult>;
  initiatePayment(input: Record<string, unknown>): Promise<ProviderResult>;
  getPaymentStatus(providerReference: string): Promise<ProviderResult>;
}
export interface AutoPayProvider {
  createMandate(input: Record<string, unknown>): Promise<ProviderResult>;
  getMandate(providerMandateId: string): Promise<ProviderResult>;
  pause(providerMandateId: string): Promise<ProviderResult>;
  resume(providerMandateId: string): Promise<ProviderResult>;
  cancel(providerMandateId: string): Promise<ProviderResult>;
  initiateDebit(providerMandateId: string, input: Record<string, unknown>): Promise<ProviderResult>;
  getDebitStatus(providerReference: string): Promise<ProviderResult>;
}
