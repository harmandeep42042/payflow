import {
  defaultRequestExpiry,
  getEffectiveMoneyRequestStatus,
  getMoneyRequestStatusDescription,
  getMoneyRequestStatusLabel,
  isFutureRequestExpiry,
  isMoneyRequestActionable,
  matchesMoneyRequestHistoryFilter,
  minimumRequestExpiry,
  normalizeRequestAmount,
} from './request-money-utils';

describe('Request Money utilities', () => {
  it('accepts positive amounts with at most two decimals', () => {
    expect(
      normalizeRequestAmount('125.50'),
    ).toBe('125.50');

    expect(
      normalizeRequestAmount('0010.5'),
    ).toBe('10.5');
  });

  it('rejects zero and invalid monetary values', () => {
    expect(
      normalizeRequestAmount('0'),
    ).toBeNull();

    expect(
      normalizeRequestAmount('10.001'),
    ).toBeNull();

    expect(
      normalizeRequestAmount('-10'),
    ).toBeNull();

    expect(
      normalizeRequestAmount('abc'),
    ).toBeNull();
  });

  it('creates a future default expiry', () => {
    const now =
      new Date('2026-09-07T10:00:00.000Z');

    expect(
      isFutureRequestExpiry(
        defaultRequestExpiry(now),
        now.getTime(),
      ),
    ).toBe(true);
  });

  it('creates a future minimum expiry', () => {
    const now =
      new Date('2026-09-07T10:00:00.000Z');

    expect(
      isFutureRequestExpiry(
        minimumRequestExpiry(now),
        now.getTime(),
      ),
    ).toBe(true);
  });

  it('rejects expired and malformed expiry values', () => {
    const now =
      new Date(
        '2026-09-07T10:00:00.000Z',
      ).getTime();

    expect(
      isFutureRequestExpiry(
        '2026-09-07T09:00',
        now,
      ),
    ).toBe(false);

    expect(
      isFutureRequestExpiry(
        'not-a-date',
        now,
      ),
    ).toBe(false);
  });

  it('allows actions only on pending, unexpired requests', () => {
    const now =
      new Date(
        '2026-09-07T10:00:00.000Z',
      ).getTime();

    expect(
      isMoneyRequestActionable(
        'PENDING',
        '2026-09-07T11:00:00.000Z',
        now,
      ),
    ).toBe(true);
  });

  it('blocks expired or completed request actions', () => {
    const now =
      new Date(
        '2026-09-07T10:00:00.000Z',
      ).getTime();

    expect(
      isMoneyRequestActionable(
        'PENDING',
        '2026-09-07T09:00:00.000Z',
        now,
      ),
    ).toBe(false);

    expect(
      isMoneyRequestActionable(
        'ACCEPTED',
        '2026-09-07T11:00:00.000Z',
        now,
      ),
    ).toBe(false);
  });

  it('derives EXPIRED for stale pending requests', () => {
    const now =
      new Date(
        '2026-09-07T10:00:00.000Z',
      ).getTime();

    expect(
      getEffectiveMoneyRequestStatus(
        'PENDING',
        '2026-09-07T09:00:00.000Z',
        now,
      ),
    ).toBe('EXPIRED');
  });

  it('preserves non-expired and terminal statuses', () => {
    const now =
      new Date(
        '2026-09-07T10:00:00.000Z',
      ).getTime();

    expect(
      getEffectiveMoneyRequestStatus(
        'PENDING',
        '2026-09-07T11:00:00.000Z',
        now,
      ),
    ).toBe('PENDING');

    expect(
      getEffectiveMoneyRequestStatus(
        'DECLINED',
        '2026-09-07T09:00:00.000Z',
        now,
      ),
    ).toBe('DECLINED');
  });

  it('returns customer-friendly status labels', () => {
    expect(
      getMoneyRequestStatusLabel('PENDING'),
    ).toBe('Pending');

    expect(
      getMoneyRequestStatusLabel('EXPIRED'),
    ).toBe('Expired');
  });

  it('returns direction-aware status descriptions', () => {
    expect(
      getMoneyRequestStatusDescription(
        'PENDING',
        'outgoing',
      ),
    ).toBe(
      'Waiting for the payer to respond.',
    );

    expect(
      getMoneyRequestStatusDescription(
        'DECLINED',
        'incoming',
      ),
    ).toBe(
      'You declined this request.',
    );
  });

  it('filters request history by effective status', () => {
    expect(
      matchesMoneyRequestHistoryFilter(
        'ACCEPTED',
        'ALL',
      ),
    ).toBe(true);

    expect(
      matchesMoneyRequestHistoryFilter(
        'ACCEPTED',
        'ACCEPTED',
      ),
    ).toBe(true);

    expect(
      matchesMoneyRequestHistoryFilter(
        'DECLINED',
        'ACCEPTED',
      ),
    ).toBe(false);
  });
});
