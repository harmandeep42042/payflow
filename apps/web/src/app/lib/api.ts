export const API_GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ??
  'http://localhost:4000/api/v1';

export type PayflowUser = {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  role: string;
  status: string;
};

export type LoginResponse = {
  message: string;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  user: PayflowUser;
};

type WrappedResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export async function apiRequest<T>(
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

  const responseBody = (await response.json()) as
    | WrappedResponse<T>
    | T;

  if (!response.ok) {
    const errorResponse = responseBody as {
      message?: string | string[];
      error?: string;
    };

    const message = Array.isArray(
      errorResponse.message,
    )
      ? errorResponse.message.join(', ')
      : errorResponse.message ??
        errorResponse.error ??
        'Request failed';

    throw new Error(message);
  }

  const wrappedResponse =
    responseBody as WrappedResponse<T>;

  if (
    wrappedResponse &&
    typeof wrappedResponse === 'object' &&
    'data' in wrappedResponse &&
    wrappedResponse.data !== undefined
  ) {
    return wrappedResponse.data;
  }

  return responseBody as T;
}

export function saveAuthSession(
  loginResponse: LoginResponse,
): void {
  localStorage.setItem(
    'payflow_access_token',
    loginResponse.accessToken,
  );

  localStorage.setItem(
    'payflow_refresh_token',
    loginResponse.refreshToken,
  );

  localStorage.setItem(
    'payflow_user',
    JSON.stringify(loginResponse.user),
  );
}

export function getAccessToken(): string | null {
  return localStorage.getItem(
    'payflow_access_token',
  );
}

export function getStoredUser(): PayflowUser | null {
  const storedUser = localStorage.getItem(
    'payflow_user',
  );

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(
      storedUser,
    ) as PayflowUser;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  localStorage.removeItem(
    'payflow_access_token',
  );

  localStorage.removeItem(
    'payflow_refresh_token',
  );

  localStorage.removeItem(
    'payflow_user',
  );
}
