import { NextResponse } from 'next/server';
import type {
  AdminLoginResponse,
} from '@payflow/shared-types';

import {
  clearToken,
  forward,
  gateway,
  publicSession,
  read,
  setToken,
  unwrap,
} from '../../../../lib/customer-session.server';

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const response = await gateway(
    '/auth/otp/mobile/register',
    {
      method: 'POST',
      body: await request.text(),
      headers: {
        'User-Agent':
          request.headers.get('user-agent') ?? '',
      },
    },
  );

  const value = await read(response);

  if (!response.ok) {
    const failure = forward(response, value);
    clearToken(failure);
    return failure;
  }

  const login =
    unwrap<AdminLoginResponse>(value);

  if (login.user.role !== 'USER') {
    await gateway('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        refreshToken: login.refreshToken,
      }),
    });

    const failure = NextResponse.json(
      {
        message:
          'Only customers can access this application',
      },
      { status: 403 },
    );

    clearToken(failure);
    return failure;
  }

  const walletResponse = await gateway(
    '/wallets',
    {
      method: 'POST',
      body: JSON.stringify({
        userId: login.user.id,
        currency: 'INR',
      }),
      headers: {
        Authorization:
          `Bearer ${login.accessToken}`,
      },
    },
  );

  if (
    !walletResponse.ok &&
    walletResponse.status !== 409
  ) {
    const walletFailure =
      await read(walletResponse);

    const failure = NextResponse.json(
      {
        message:
          'Account was created, but wallet setup could not be completed',
        wallet:
          walletFailure,
      },
      {
        status: 503,
      },
    );

    clearToken(failure);
    return failure;
  }

  const success =
    NextResponse.json(publicSession(login));

  setToken(success, login.refreshToken);

  return success;
}
