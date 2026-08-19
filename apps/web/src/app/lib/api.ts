import type {
  AdminLoginResponse,
  PayflowUser,
} from '@payflow/shared-types';

export const API_GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ??
  'http://localhost:4000/api/v1';

const ACCESS_TOKEN_KEY =
  'payflow_user_access_token';

const REFRESH_TOKEN_KEY =
  'payflow_user_refresh_token';

const PROFILE_KEY =
  'payflow_user_profile';

type WrappedResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string | string[];
  error?: string;
};

export type UserLoginResponse =
  AdminLoginResponse;

type RefreshTokenResponse = {
  message: string;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
};

let refreshPromise:
  Promise<string> | null = null;

function getErrorMessage(
  body: unknown,
): string {
  if (
    !body ||
    typeof body !== 'object'
  ) {
    return 'Request failed';
  }

  const response =
    body as WrappedResponse<unknown>;

  if (Array.isArray(response.message)) {
    return response.message.join(', ');
  }

  return (
    response.message ??
    response.error ??
    'Request failed'
  );
}

async function readResponseBody<T>(
  response: Response,
): Promise<
  WrappedResponse<T> | T | null
> {
  const contentType =
    response.headers.get(
      'content-type',
    );

  if (
    !contentType?.includes(
      'application/json',
    )
  ) {
    return null;
  }

  return response.json() as Promise<
    WrappedResponse<T> | T
  >;
}

function unwrapResponse<T>(
  body: WrappedResponse<T> | T | null,
): T {
  if (body === null) {
    return undefined as T;
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'data' in body
  ) {
    const wrapped =
      body as WrappedResponse<T>;

    if (wrapped.data !== undefined) {
      return wrapped.data;
    }
  }

  return body as T;
}

export function getUserAccessToken():
  | string
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(
    ACCESS_TOKEN_KEY,
  );
}

export function getUserRefreshToken():
  | string
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(
    REFRESH_TOKEN_KEY,
  );
}

export function saveUserTokens(
  accessToken: string,
  refreshToken: string,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    accessToken,
  );

  localStorage.setItem(
    REFRESH_TOKEN_KEY,
    refreshToken,
  );
}

export function saveUserSession(
  response: UserLoginResponse,
): void {
  if (response.user.role !== 'USER') {
    throw new Error(
      'Only normal users can access this portal',
    );
  }

  saveUserTokens(
    response.accessToken,
    response.refreshToken,
  );

  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify(response.user),
  );

  window.dispatchEvent(
    new Event(
      'payflow:auth-changed',
    ),
  );
}

export function getStoredUser():
  | PayflowUser
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored =
    localStorage.getItem(
      PROFILE_KEY,
    );

  if (!stored) {
    return null;
  }

  try {
    const user =
      JSON.parse(stored) as PayflowUser;

    return user.role === 'USER'
      ? user
      : null;
  } catch {
    return null;
  }
}

export function hasValidUserSession():
  boolean {
  return Boolean(
    getUserAccessToken() &&
    getUserRefreshToken() &&
    getStoredUser(),
  );
}

export function clearUserSession():
  void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );

  localStorage.removeItem(
    REFRESH_TOKEN_KEY,
  );

  localStorage.removeItem(
    PROFILE_KEY,
  );
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (
    window.location.pathname !==
    '/login'
  ) {
    window.location.href =
      '/login?sessionExpired=true';
  }
}

async function performTokenRefresh():
  Promise<string> {
  const refreshToken =
    getUserRefreshToken();

  if (!refreshToken) {
    clearUserSession();

    throw new Error(
      'Refresh token is missing',
    );
  }

  const response = await fetch(
    `${API_GATEWAY_URL}/auth/refresh`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        refreshToken,
      }),
    },
  );

  const body =
    await readResponseBody<
      RefreshTokenResponse
    >(response);

  if (!response.ok) {
    clearUserSession();

    throw new Error(
      getErrorMessage(body),
    );
  }

  const refreshResponse =
    unwrapResponse<
      RefreshTokenResponse
    >(body);

  if (
    !refreshResponse.accessToken ||
    !refreshResponse.refreshToken
  ) {
    clearUserSession();

    throw new Error(
      'Token refresh response was invalid',
    );
  }

  saveUserTokens(
    refreshResponse.accessToken,
    refreshResponse.refreshToken,
  );

  return refreshResponse.accessToken;
}

export async function refreshUserAccessToken():
  Promise<string> {
  if (!refreshPromise) {
    refreshPromise =
      performTokenRefresh()
        .finally(() => {
          refreshPromise = null;
        });
  }

  return refreshPromise;
}

export async function userApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_GATEWAY_URL}${path}`,
    {
      ...options,

      headers: {
        'Content-Type':
          'application/json',

        ...options.headers,
      },
    },
  );

  const body =
    await readResponseBody<T>(
      response,
    );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(body),
    );
  }

  return unwrapResponse<T>(body);
}

async function authenticatedRequest<T>(
  path: string,
  options: RequestInit,
  allowRefresh: boolean,
): Promise<T> {
  const accessToken =
    getUserAccessToken();

  if (!accessToken) {
    clearUserSession();
    redirectToLogin();

    throw new Error(
      'User session is missing',
    );
  }

  const response = await fetch(
    `${API_GATEWAY_URL}${path}`,
    {
      ...options,

      headers: {
        'Content-Type':
          'application/json',

        Authorization:
          `Bearer ${accessToken}`,

        ...options.headers,
      },
    },
  );

  const body =
    await readResponseBody<T>(
      response,
    );

  if (
    response.status === 401 &&
    allowRefresh
  ) {
    try {
      const newAccessToken =
        await refreshUserAccessToken();

      const retryResponse =
        await fetch(
          `${API_GATEWAY_URL}${path}`,
          {
            ...options,

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${newAccessToken}`,

              ...options.headers,
            },
          },
        );

      const retryBody =
        await readResponseBody<T>(
          retryResponse,
        );

      if (!retryResponse.ok) {
        if (
          retryResponse.status === 401
        ) {
          clearUserSession();
          redirectToLogin();
        }

        throw new Error(
          getErrorMessage(retryBody),
        );
      }

      return unwrapResponse<T>(
        retryBody,
      );
    } catch (refreshError) {
      clearUserSession();
      redirectToLogin();

      throw refreshError;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearUserSession();
      redirectToLogin();
    }

    throw new Error(
      getErrorMessage(body),
    );
  }

  return unwrapResponse<T>(body);
}

export async function userAuthenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return authenticatedRequest<T>(
    path,
    options,
    true,
  );
}


export async function logoutUser():
  Promise<void> {
  const refreshToken =
    getUserRefreshToken();

  try {
    if (refreshToken) {
      await userApiRequest<{
        message?: string;
      }>(
        '/auth/logout',
        {
          method: 'POST',

          body: JSON.stringify({
            refreshToken,
          }),
        },
      );
    }
  } finally {
    clearUserSession();
  }
}
export const getAccessToken =
  getUserAccessToken;

export const clearAuthSession =
  clearUserSession;