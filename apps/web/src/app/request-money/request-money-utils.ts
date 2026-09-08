export type MoneyRequestDirection =
  | 'incoming'
  | 'outgoing';

export type MoneyRequestHistoryFilter =
  | 'ALL'
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED';

export function normalizeRequestAmount(
  value: string,
): string | null {
  const trimmed = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [whole, fraction] = trimmed.split('.');

  const normalizedWhole =
    whole.replace(/^0+(?=\d)/, '') || '0';

  const normalized = fraction
    ? `${normalizedWhole}.${fraction}`
    : normalizedWhole;

  if (/^0(?:\.0{1,2})?$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function toLocalDateTimeInput(
  value: Date,
): string {
  const local = new Date(
    value.getTime() -
      value.getTimezoneOffset() * 60_000,
  );

  return local
    .toISOString()
    .slice(0, 16);
}

export function defaultRequestExpiry(
  now = new Date(),
): string {
  return toLocalDateTimeInput(
    new Date(
      now.getTime() +
        24 * 60 * 60 * 1000,
    ),
  );
}

export function minimumRequestExpiry(
  now = new Date(),
): string {
  return toLocalDateTimeInput(
    new Date(
      now.getTime() +
        60 * 1000,
    ),
  );
}

export function isFutureRequestExpiry(
  value: string,
  now = Date.now(),
): boolean {
  const expiry = new Date(value);

  return (
    Number.isFinite(expiry.getTime()) &&
    expiry.getTime() > now
  );
}

export function isMoneyRequestActionable(
  status: string,
  expiresAt: string,
  now = Date.now(),
): boolean {
  return (
    status === 'PENDING' &&
    isFutureRequestExpiry(
      expiresAt,
      now,
    )
  );
}

export function getEffectiveMoneyRequestStatus(
  status: string,
  expiresAt: string,
  now = Date.now(),
): string {
  if (
    status === 'PENDING' &&
    !isFutureRequestExpiry(
      expiresAt,
      now,
    )
  ) {
    return 'EXPIRED';
  }

  return status;
}

export function getMoneyRequestStatusLabel(
  status: string,
): string {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };

  return labels[status] ?? status;
}

export function getMoneyRequestStatusDescription(
  status: string,
  direction: MoneyRequestDirection,
): string {
  if (status === 'PENDING') {
    return direction === 'outgoing'
      ? 'Waiting for the payer to respond.'
      : 'Review the request before accepting or declining.';
  }

  if (status === 'ACCEPTED') {
    return direction === 'outgoing'
      ? 'The payer accepted this request.'
      : 'You accepted this request.';
  }

  if (status === 'DECLINED') {
    return direction === 'outgoing'
      ? 'The payer declined this request.'
      : 'You declined this request.';
  }

  if (status === 'CANCELLED') {
    return direction === 'outgoing'
      ? 'You cancelled this request.'
      : 'The requester cancelled this request.';
  }

  if (status === 'EXPIRED') {
    return 'This request expired before it was accepted.';
  }

  return 'Request status updated.';
}

export function matchesMoneyRequestHistoryFilter(
  status: string,
  filter: MoneyRequestHistoryFilter,
): boolean {
  return (
    filter === 'ALL' ||
    status === filter
  );
}
