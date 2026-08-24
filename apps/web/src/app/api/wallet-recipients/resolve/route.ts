import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { buildRecipientGatewayRequest } from './recipient-request';

const gatewayUrl =
  process.env.API_GATEWAY_INTERNAL_URL ??
  process.env.API_GATEWAY_URL ??
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ??
  'http://localhost:4000/api/v1';

export async function GET(
  request: NextRequest,
) {
  const params =
    request.nextUrl.searchParams;

  const authorization = request.headers.get('authorization');
  const protectedRequest = buildRecipientGatewayRequest(request.nextUrl, authorization);
  if (!protectedRequest) {
    return NextResponse.json({ message: 'Authentication is required' }, { status: 401 });
  }

  const email =
    params.get('email')?.trim() ?? '';

  const phone =
    params.get('phone')?.trim() ?? '';

  const vpa =
    params.get('vpa')?.trim() ?? '';

  const currency =
    params.get('currency')?.trim().toUpperCase() ??
    'INR';

  const excludeUserId =
    params.get('excludeUserId');

  if (!email && !phone && !vpa) {
    return NextResponse.json(
      {
        message:
          'Recipient email, phone or VPA is required',
      },
      {
        status: 400,
      },
    );
  }

  const query =
    new URLSearchParams();

  if (email) {
    query.set('email', email);
  }

  if (phone) {
    query.set('phone', phone);
  }

  if (vpa) {
    query.set('vpa', vpa);
  }

  query.set(
    'currency',
    currency,
  );

  if (excludeUserId) {
    query.set(
      'excludeUserId',
      excludeUserId,
    );
  }

  try {
    const response =
      await fetch(
        `${gatewayUrl}${protectedRequest.path}`,
        {
          cache: 'no-store',
          headers: { Authorization: protectedRequest.authorization },
        },
      );

    const body =
      await response.json();

    return NextResponse.json(
      body,
      {
        status: response.status,
      },
    );
  } catch {
    return NextResponse.json(
      {
        message:
          'Wallet Service is unavailable',
      },
      {
        status: 503,
      },
    );
  }
}
