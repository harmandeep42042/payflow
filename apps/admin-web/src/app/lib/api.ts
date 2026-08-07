import type {
  AdminLoginResponse,
  PayflowUser,
} from '@payflow/shared-types';

export const API_GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ??
  'http://localhost:4000/api/v1';

export type AdminUser = PayflowUser;

export type {
  AdminLoginResponse,
};

type WrappedResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string | string[];
  error?: string;
};

function getErrorMessage(
  responseBody: unknown,
): string {
  if (
    !responseBody ||
    typeof responseBody !== 'object'
  ) {
    return 'Request failed';
  }

  const errorResponse =
    responseBody as WrappedResponse<unknown>;

  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message.join(', ');
  }

  return (
    errorResponse.message ??
    errorResponse.error ??
    'Request failed'
  );
}

export async function adminApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_GATEWAY_URL}${path}`,
    {
      ...options,

      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    },
  );

  const responseBody =
    (await response.json()) as
      | WrappedResponse<T>
      | T;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(responseBody),
    );
  }

  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'data' in responseBody
  ) {
    const wrapped =
      responseBody as WrappedResponse<T>;

    if (wrapped.data !== undefined) {
      return wrapped.data;
    }
  }

  return responseBody as T;
}

export async function adminAuthenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAdminAccessToken();

  if (!token) {
    throw new Error(
      'Admin session is missing',
    );
  }

  return adminApiRequest<T>(
    path,
    {
      ...options,

      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    },
  );
}

export function saveAdminSession(
  loginResponse: AdminLoginResponse,
): void {
  if (loginResponse.user.role !== 'ADMIN') {
    throw new Error(
      'Only administrators can access this application',
    );
  }

  localStorage.setItem(
    'payflow_admin_access_token',
    loginResponse.accessToken,
  );

  localStorage.setItem(
    'payflow_admin_refresh_token',
    loginResponse.refreshToken,
  );

  localStorage.setItem(
    'payflow_admin_user',
    JSON.stringify(
      loginResponse.user,
    ),
  );
}

export function getAdminAccessToken():
  | string
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(
    'payflow_admin_access_token',
  );
}

export function getAdminRefreshToken():
  | string
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(
    'payflow_admin_refresh_token',
  );
}

export function getStoredAdmin():
  | PayflowUser
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedUser =
    localStorage.getItem(
      'payflow_admin_user',
    );

  if (!storedUser) {
    return null;
  }

  try {
    const user =
      JSON.parse(
        storedUser,
      ) as PayflowUser;

    if (user.role !== 'ADMIN') {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function hasValidAdminSession():
  boolean {
  return Boolean(
    getAdminAccessToken() &&
    getStoredAdmin(),
  );
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(
    'payflow_admin_access_token',
  );

  localStorage.removeItem(
    'payflow_admin_refresh_token',
  );

  localStorage.removeItem(
    'payflow_admin_user',
  );
}