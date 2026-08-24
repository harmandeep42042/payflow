import { NextResponse } from 'next/server';

import type {
  PayflowUser,
} from '@payflow/shared-types';

import {
  clearRefreshTokenCookie,
  gatewayRequest,
  getRefreshTokenCookie,
  readResponseBody,
  setRefreshTokenCookie,
  unwrapGatewayResponse,
} from '../../../lib/admin-session.server';
import { singleFlightRefresh } from '../../../lib/refresh-single-flight.server';

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
};

type ProfileResponse = {
  user: PayflowUser;
};

type RefreshOutcome = {
  status: number;
  body: unknown;
  refreshToken?: string;
};

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const refreshToken =
    getRefreshTokenCookie(request);

  if (!refreshToken) {
    return NextResponse.json(
      {
        message: 'Admin session is missing',
      },
      {
        status: 401,
      },
    );
  }

  const outcome = await singleFlightRefresh<RefreshOutcome>(refreshToken, async () => {
    const refreshResponse = await gatewayRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    const refreshBody = await readResponseBody(refreshResponse);
    if (!refreshResponse.ok) return { status: refreshResponse.status, body: refreshBody };

    const tokens = unwrapGatewayResponse<TokenResponse>(refreshBody);
    const profileResponse = await gatewayRequest('/auth/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const profileBody = await readResponseBody(profileResponse);
    if (!profileResponse.ok) return { status: profileResponse.status, body: profileBody };

    const profile = unwrapGatewayResponse<ProfileResponse>(profileBody);
    if (profile.user.role !== 'ADMIN') {
      return { status: 403, body: { message: 'Administrator access is required' } };
    }

    return {
      status: 200,
      body: { accessToken: tokens.accessToken, user: profile.user },
      refreshToken: tokens.refreshToken,
    };
  });

  const response = NextResponse.json(outcome.body, { status: outcome.status });
  if (outcome.refreshToken) setRefreshTokenCookie(response, outcome.refreshToken);
  else clearRefreshTokenCookie(response);
  return response;
}
