import { NextResponse } from 'next/server';

import type {
  AdminLoginResponse,
} from '@payflow/shared-types';

import {
  clearRefreshTokenCookie,
  createPublicSession,
  forwardGatewayResponse,
  gatewayRequest,
  getRefreshTokenCookie,
  readResponseBody,
  setRefreshTokenCookie,
  unwrapGatewayResponse,
} from '../../../lib/admin-session.server';

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const existingRefreshToken =
    getRefreshTokenCookie(request);

  if (existingRefreshToken) {
    try {
      await gatewayRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: existingRefreshToken,
        }),
      });
    } catch {
      // Login remains available even if cleanup of an older session fails.
    }
  }

  const response = await gatewayRequest(
    '/auth/login',
    {
      method: 'POST',
      body: await request.text(),
      headers: {
        'User-Agent':
          request.headers.get('user-agent') ?? '',
      },
    },
  );

  const body = await readResponseBody(response);

  if (!response.ok) {
    const failure = forwardGatewayResponse(
      response,
      body,
    );
    clearRefreshTokenCookie(failure);
    return failure;
  }

  const login =
    unwrapGatewayResponse<AdminLoginResponse>(body);

  if (login.user.role !== 'ADMIN') {
    await gatewayRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        refreshToken: login.refreshToken,
      }),
    });

    const forbidden = NextResponse.json(
      {
        message:
          'Only administrators can access this application',
      },
      {
        status: 403,
      },
    );
    clearRefreshTokenCookie(forbidden);
    return forbidden;
  }

  const success = NextResponse.json(
    createPublicSession(login),
  );
  setRefreshTokenCookie(
    success,
    login.refreshToken,
  );
  return success;
}
