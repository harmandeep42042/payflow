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

type MobileVerifyResponse =
  | (AdminLoginResponse & {
      registrationRequired?: false;
    })
  | {
      registrationRequired: true;
      registrationToken: string;
    };

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const response = await gateway(
    '/auth/otp/mobile/verify',
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

  const result =
    unwrap<MobileVerifyResponse>(value);

  if (result.registrationRequired === true) {
    return NextResponse.json({
      registrationRequired: true,
      registrationToken:
        result.registrationToken,
    });
  }

  if (result.user.role !== 'USER') {
    await gateway('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        refreshToken: result.refreshToken,
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

  const success = NextResponse.json({
    registrationRequired: false,
    ...publicSession(result),
  });

  setToken(success, result.refreshToken);

  return success;
}
