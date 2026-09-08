import { NextResponse } from 'next/server';
import {
  forward,
  gateway,
  read,
} from '../../../../lib/customer-session.server';

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const response = await gateway(
    '/auth/otp/mobile/request',
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

  return forward(response, value);
}
