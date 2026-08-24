import { NextResponse } from 'next/server';

import type {
  AdminLoginResponse,
  PayflowUser,
} from '@payflow/shared-types';

const REFRESH_TOKEN_COOKIE =
  'payflow_admin_refresh_token';

const API_GATEWAY_URL =
  process.env.API_GATEWAY_INTERNAL_URL ??
  process.env.API_GATEWAY_URL ??
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ??
  'http://localhost:4000/api/v1';

type WrappedResponse<T> = {
  data?: T;
};

export type RefreshedSession = {
  accessToken: string;
  user: PayflowUser;
};

export function unwrapGatewayResponse<T>(
  value: unknown,
): T {
  if (
    value &&
    typeof value === 'object' &&
    'data' in value
  ) {
    const wrapped = value as WrappedResponse<T>;

    if (wrapped.data !== undefined) {
      return wrapped.data;
    }
  }

  return value as T;
}

export async function gatewayRequest(
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${API_GATEWAY_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

export async function readResponseBody(
  response: Response,
): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      message: text,
    };
  }
}

export function forwardGatewayResponse(
  response: Response,
  body: unknown,
): NextResponse {
  return NextResponse.json(body, {
    status: response.status,
  });
}

export function setRefreshTokenCookie(
  response: NextResponse,
  refreshToken: string,
): void {
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: refreshToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearRefreshTokenCookie(
  response: NextResponse,
): void {
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export function getRefreshTokenCookie(
  request: Request,
): string | null {
  const cookieHeader =
    request.headers.get('cookie') ?? '';

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] =
      cookie.trim().split('=');

    if (name === REFRESH_TOKEN_COOKIE) {
      return decodeURIComponent(
        valueParts.join('='),
      );
    }
  }

  return null;
}

export function createPublicSession(
  login: AdminLoginResponse,
): RefreshedSession {
  return {
    accessToken: login.accessToken,
    user: login.user,
  };
}
