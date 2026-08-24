import type { ApiErrorResponse, PayflowUser } from '@payflow/shared-types';

export const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000/api/v1';
type WrappedResponse<T> = { data?: T };
export type UserSessionResponse = { accessToken: string; user: PayflowUser };
export type UserLoginResponse = UserSessionResponse;

export class CustomerApiError extends Error {
  constructor(readonly status: number, message: string, readonly details: ApiErrorResponse | null = null) {
    super(message); this.name = 'CustomerApiError';
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<UserSessionResponse> | null = null;
let refreshFailure: CustomerApiError | null = null;
let redirectStarted = false;

function errorDetails(value: unknown): ApiErrorResponse | null {
  return value && typeof value === 'object' ? value as ApiErrorResponse : null;
}
function errorMessage(value: unknown): string {
  const detail = errorDetails(value); if (!detail) return 'Request failed';
  return Array.isArray(detail.message) ? detail.message.join(', ') : detail.message ?? detail.error ?? 'Request failed';
}
async function responseBody(response: Response): Promise<unknown> {
  const value = await response.text(); if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return { message: value }; }
}
function unwrap<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in value) {
    const wrapped = value as WrappedResponse<T>; if (wrapped.data !== undefined) return wrapped.data;
  }
  return value as T;
}
async function request<T>(url: string, options: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, options); } catch { throw new CustomerApiError(0, 'Unable to connect to Payflow'); }
  const value = await responseBody(response);
  if (!response.ok) throw new CustomerApiError(response.status, errorMessage(value), errorDetails(value));
  return unwrap<T>(value);
}

export function userApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(`${API_GATEWAY_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
}
export async function loginUser(email: string, password: string): Promise<UserSessionResponse> {
  resetRefreshState();
  clearUserSession();
  const session = await request<UserSessionResponse>('/api/customer-session/login', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  saveUserSession(session); return session;
}
async function refreshSession(): Promise<UserSessionResponse> {
  if (refreshFailure) throw refreshFailure;
  if (!refreshPromise) {
    refreshPromise = request<UserSessionResponse>('/api/customer-session/refresh', { method: 'POST', credentials: 'same-origin' })
      .then((session) => { saveUserSession(session); return session; })
      .catch((error: unknown) => {
        const failure = error instanceof CustomerApiError
          ? error
          : new CustomerApiError(0, 'Unable to refresh the customer session');
        refreshFailure = failure;
        clearUserSession();
        redirectToLogin();
        throw failure;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
function redirectToLogin(): void {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login' && !redirectStarted) {
    redirectStarted = true;
    window.location.assign('/login?sessionExpired=true');
  }
}
function resetRefreshState(): void {
  refreshFailure = null;
  redirectStarted = false;
}
export async function userAuthenticatedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = accessToken;
  if (!token) { try { token = (await refreshSession()).accessToken; } catch (error) { clearUserSession(); redirectToLogin(); throw error; } }
  const execute = (current: string) => userApiRequest<T>(path, { ...options, headers: { Authorization: `Bearer ${current}`, ...options.headers } });
  try { return await execute(token); } catch (error) { if (!isCustomerApiError(error) || error.status !== 401) throw error; }
  if (accessToken && accessToken !== token) return execute(accessToken);
  return execute((await refreshSession()).accessToken);
}

export async function customerSessionRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = accessToken;
  if (!token) {
    try { token = (await refreshSession()).accessToken; }
    catch (error) { clearUserSession(); redirectToLogin(); throw error; }
  }
  const execute = (current: string) => request<T>(`/api/customer-session${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current}`, ...options.headers },
  });
  try { return await execute(token); }
  catch (error) { if (!isCustomerApiError(error) || error.status !== 401) throw error; }
  if (accessToken && accessToken !== token) return execute(accessToken);
  return execute((await refreshSession()).accessToken);
}

export function saveUserSession(session: UserSessionResponse): void {
  if (session.user.role !== 'USER') throw new CustomerApiError(403, 'Only customers can access this portal');
  accessToken = session.accessToken;
  if (typeof window !== 'undefined') {
    localStorage.setItem('payflow_user_profile', JSON.stringify(session.user));
    window.dispatchEvent(new Event('payflow:auth-changed'));
  }
}
export function getUserAccessToken(): string | null { return accessToken; }
export const getAccessToken = getUserAccessToken;
export function getUserRefreshToken(): null { return null; }
export function getStoredUser(): PayflowUser | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem('payflow_user_profile'); if (!value) return null;
  try { const user = JSON.parse(value) as PayflowUser; return user.role === 'USER' ? user : null; } catch { return null; }
}
export function hasValidUserSession(): boolean { return Boolean(getStoredUser()); }
export async function restoreUserSession(): Promise<PayflowUser> {
  const stored = getStoredUser(); if (accessToken && stored) return stored; return (await refreshSession()).user;
}
export function clearUserSession(): void {
  const hadAccessToken = accessToken !== null;
  accessToken = null;
  if (typeof window !== 'undefined') {
    const sessionKeys = ['payflow_user_access_token', 'payflow_user_refresh_token', 'payflow_user_profile'];
    const hadStoredSession = sessionKeys.some((key) => localStorage.getItem(key) !== null);
    for (const key of sessionKeys) localStorage.removeItem(key);
    if (hadAccessToken || hadStoredSession) window.dispatchEvent(new Event('payflow:auth-changed'));
  }
}
export const clearAuthSession = clearUserSession;
export async function logoutUser(): Promise<void> {
  refreshFailure = new CustomerApiError(401, 'Customer session has ended');
  clearUserSession(); try { await request('/api/customer-session/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* local logout completed */ }
}
export function isCustomerApiError(error: unknown): error is CustomerApiError { return error instanceof CustomerApiError; }
export function __resetCustomerSessionForTests(): void { accessToken = null; refreshPromise = null; resetRefreshState(); }
