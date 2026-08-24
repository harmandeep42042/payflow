import type { AdminLoginResponse, ApiErrorResponse, PayflowUser } from '@payflow/shared-types';

export const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000/api/v1';
export type AdminUser = PayflowUser;
export type { AdminLoginResponse };

type WrappedResponse<T> = { data?: T };
type AdminSessionResponse = { accessToken: string; user: PayflowUser };

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: ApiErrorResponse | null = null,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<AdminSessionResponse> | null = null;
let refreshFailure: AdminApiError | null = null;
let redirectStarted = false;

function errorDetails(body: unknown): ApiErrorResponse | null {
  return body && typeof body === 'object' ? body as ApiErrorResponse : null;
}

function errorMessage(body: unknown): string {
  const details = errorDetails(body);
  if (!details) return 'Request failed';
  if (Array.isArray(details.message)) return details.message.join(', ');
  return details.message ?? details.error ?? 'Request failed';
}

async function responseBody(response: Response): Promise<unknown> {
  const value = await response.text();
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { message: value };
  }
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body) {
    const wrapped = body as WrappedResponse<T>;
    if (wrapped.data !== undefined) return wrapped.data;
  }
  return body as T;
}

async function request<T>(url: string, options: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new AdminApiError(0, 'Unable to connect to Payflow');
  }
  const body = await responseBody(response);
  if (!response.ok) {
    throw new AdminApiError(response.status, errorMessage(body), errorDetails(body));
  }
  return unwrap<T>(body);
}

export function adminApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(`${API_GATEWAY_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

export async function loginAdmin(email: string, password: string): Promise<AdminSessionResponse> {
  resetRefreshState();
  clearAdminSession();
  const session = await request<AdminSessionResponse>('/api/admin-session/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  saveAdminSession(session);
  return session;
}

async function refreshAdminSession(): Promise<AdminSessionResponse> {
  if (refreshFailure) throw refreshFailure;
  if (!refreshPromise) {
    refreshPromise = request<AdminSessionResponse>('/api/admin-session/refresh', {
      method: 'POST',
      credentials: 'same-origin',
    }).then((session) => {
      saveAdminSession(session);
      return session;
    }).catch((error: unknown) => {
      const failure = error instanceof AdminApiError
        ? error
        : new AdminApiError(0, 'Unable to refresh the administrator session');
      refreshFailure = failure;
      clearAdminSession();
      redirectToLogin();
      throw failure;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function redirectToLogin(): void {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login' && !redirectStarted) {
    redirectStarted = true;
    window.location.assign('/login');
  }
}

function resetRefreshState(): void {
  refreshFailure = null;
  redirectStarted = false;
}

export async function adminAuthenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = accessToken;
  if (!token) {
    try {
      token = (await refreshAdminSession()).accessToken;
    } catch (error) {
      clearAdminSession();
      redirectToLogin();
      throw error;
    }
  }

  const execute = (currentToken: string) => adminApiRequest<T>(path, {
    ...options,
    headers: { Authorization: `Bearer ${currentToken}`, ...options.headers },
  });

  try {
    return await execute(token);
  } catch (error) {
    if (!isAdminApiError(error) || error.status !== 401) throw error;
  }

  if (accessToken && accessToken !== token) {
    return execute(accessToken);
  }

  const refreshed = await refreshAdminSession();
  return execute(refreshed.accessToken);
}

export function saveAdminSession(session: AdminSessionResponse | AdminLoginResponse): void {
  if (session.user.role !== 'ADMIN') {
    throw new AdminApiError(403, 'Only administrators can access this application');
  }
  accessToken = session.accessToken;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('payflow_admin_user', JSON.stringify(session.user));
  }
}

export function getAdminAccessToken(): string | null {
  return accessToken;
}

export function getStoredAdmin(): PayflowUser | null {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem('payflow_admin_user');
  if (!value) return null;
  try {
    const user = JSON.parse(value) as PayflowUser;
    return user.role === 'ADMIN' ? user : null;
  } catch {
    return null;
  }
}

export function hasValidAdminSession(): boolean {
  return Boolean(getStoredAdmin());
}

export async function restoreAdminSession(): Promise<PayflowUser> {
  const storedAdmin = getStoredAdmin();

  if (accessToken && storedAdmin) {
    return storedAdmin;
  }

  return (await refreshAdminSession()).user;
}

export function clearAdminSession(): void {
  accessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('payflow_admin_user');
    localStorage.removeItem('payflow_admin_access_token');
    localStorage.removeItem('payflow_admin_refresh_token');
    localStorage.removeItem('payflow_admin_user');
  }
}

export async function logoutAdmin(): Promise<void> {
  refreshFailure = new AdminApiError(401, 'Administrator session has ended');
  clearAdminSession();
  try {
    await request('/api/admin-session/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Local state is already cleared; logout remains safe and idempotent.
  }
}

export function isAdminApiError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError;
}

export function __resetAdminSessionForTests(): void {
  accessToken = null;
  refreshPromise = null;
  resetRefreshState();
}
