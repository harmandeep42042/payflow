import {
  calculateEqualSplitAmount,
  defaultSplitDueAt,
  exactSplitAmountsMatch,
  getEffectiveSplitStatus,
  getSplitProgress,
  isFutureSplitDueAt,
  isSelectableSplitParticipant,
  isSplitAllocationPayable,
  isSupportedSplitType,
  matchesSplitHistoryStatus,
  matchesSplitHistoryView,
  minimumSplitDueAt,
  normalizeSplitAmount,
} from './split-bill-utils';

describe(
  'Split Bill utilities',
  () => {
    it('normalizes positive money', () => {
      expect(
        normalizeSplitAmount('500'),
      ).toBe('500.00');

      expect(
        normalizeSplitAmount('0500.5'),
      ).toBe('500.50');
    });

    it('rejects invalid money', () => {
      expect(
        normalizeSplitAmount('0'),
      ).toBeNull();

      expect(
        normalizeSplitAmount('-1'),
      ).toBeNull();

      expect(
        normalizeSplitAmount('1.001'),
      ).toBeNull();
    });

    it('supports only EQUAL and EXACT', () => {
      expect(
        isSupportedSplitType('EQUAL'),
      ).toBe(true);

      expect(
        isSupportedSplitType('EXACT'),
      ).toBe(true);

      expect(
        isSupportedSplitType('CUSTOM'),
      ).toBe(false);
    });

    it('calculates equal shares', () => {
      expect(
        calculateEqualSplitAmount(
          '120.00',
          3,
        ),
      ).toBe('40.00');

      expect(
        calculateEqualSplitAmount(
          '100.00',
          3,
        ),
      ).toBeNull();
    });

    it('matches exact allocation totals', () => {
      expect(
        exactSplitAmountsMatch(
          '100.00',
          ['30.00', '70.00'],
        ),
      ).toBe(true);

      expect(
        exactSplitAmountsMatch(
          '0.30',
          ['0.10', '0.20'],
        ),
      ).toBe(true);
    });

    it('rejects mismatched exact allocations', () => {
      expect(
        exactSplitAmountsMatch(
          '100.00',
          ['30.00', '60.00'],
        ),
      ).toBe(false);
    });

    it('excludes the creator', () => {
      expect(
        isSelectableSplitParticipant(
          'user-b',
          'user-a',
        ),
      ).toBe(true);

      expect(
        isSelectableSplitParticipant(
          'user-a',
          'user-a',
        ),
      ).toBe(false);
    });

    it('creates future due dates', () => {
      const now =
        new Date(
          '2026-09-07T10:00:00',
        );

      expect(
        defaultSplitDueAt(now),
      ).toBe(
        '2026-09-08T10:00',
      );

      expect(
        minimumSplitDueAt(now),
      ).toBe(
        '2026-09-07T10:05',
      );
    });

    it('validates future due dates', () => {
      const now =
        new Date(
          '2026-09-07T10:00:00',
        );

      expect(
        isFutureSplitDueAt(
          '2026-09-07T10:01',
          now,
        ),
      ).toBe(true);

      expect(
        isFutureSplitDueAt(
          '2026-09-07T09:59',
          now,
        ),
      ).toBe(false);
    });

    it('allows payable pending shares', () => {
      const now =
        new Date(
          '2026-09-07T10:00:00',
        );

      expect(
        isSplitAllocationPayable(
          'OPEN',
          'PENDING',
          '2026-09-08T10:00:00',
          now,
        ),
      ).toBe(true);
    });

    it('blocks expired shares', () => {
      const now =
        new Date(
          '2026-09-07T10:00:00',
        );

      expect(
        isSplitAllocationPayable(
          'OPEN',
          'PENDING',
          '2026-09-07T09:00:00',
          now,
        ),
      ).toBe(false);
    });

    it('blocks closed or paid allocations', () => {
      expect(
        isSplitAllocationPayable(
          'PAID',
          'PENDING',
          '2026-09-08T10:00:00',
        ),
      ).toBe(false);

      expect(
        isSplitAllocationPayable(
          'OPEN',
          'PAID',
          '2026-09-08T10:00:00',
        ),
      ).toBe(false);
    });

    it('derives EXPIRED for overdue active splits', () => {
      const now =
        new Date(
          '2026-09-07T10:00:00',
        );

      expect(
        getEffectiveSplitStatus(
          'OPEN',
          '2026-09-07T09:00:00',
          now,
        ),
      ).toBe('EXPIRED');

      expect(
        getEffectiveSplitStatus(
          'PARTIALLY_PAID',
          '2026-09-07T09:00:00',
          now,
        ),
      ).toBe('EXPIRED');
    });

    it('preserves non-expired and terminal statuses', () => {
      const now =
        new Date(
          '2026-09-07T10:00:00',
        );

      expect(
        getEffectiveSplitStatus(
          'OPEN',
          '2026-09-08T10:00:00',
          now,
        ),
      ).toBe('OPEN');

      expect(
        getEffectiveSplitStatus(
          'PAID',
          '2026-09-01T10:00:00',
          now,
        ),
      ).toBe('PAID');
    });

    it('matches created and incoming views', () => {
      expect(
        matchesSplitHistoryView(
          'CREATED',
          'user-a',
          ['user-b'],
          'user-a',
        ),
      ).toBe(true);

      expect(
        matchesSplitHistoryView(
          'INCOMING',
          'user-a',
          ['user-b'],
          'user-b',
        ),
      ).toBe(true);

      expect(
        matchesSplitHistoryView(
          'INCOMING',
          'user-a',
          ['user-b'],
          'user-a',
        ),
      ).toBe(false);
    });

    it('matches history status filters', () => {
      expect(
        matchesSplitHistoryStatus(
          'ACTIVE',
          'OPEN',
        ),
      ).toBe(true);

      expect(
        matchesSplitHistoryStatus(
          'ACTIVE',
          'PARTIALLY_PAID',
        ),
      ).toBe(true);

      expect(
        matchesSplitHistoryStatus(
          'PAID',
          'PAID',
        ),
      ).toBe(true);

      expect(
        matchesSplitHistoryStatus(
          'EXPIRED',
          'EXPIRED',
        ),
      ).toBe(true);
    });

    it('calculates participant progress', () => {
      expect(
        getSplitProgress([
          'PAID',
          'PAID',
          'PENDING',
          'PENDING',
        ]),
      ).toEqual({
        total: 4,
        paid: 2,
        pending: 2,
        cancelled: 0,
        percent: 50,
      });
    });

    it('tracks cancelled allocations', () => {
      expect(
        getSplitProgress([
          'PAID',
          'CANCELLED',
          'CANCELLED',
        ]),
      ).toEqual({
        total: 3,
        paid: 1,
        pending: 0,
        cancelled: 2,
        percent: 33,
      });
    });

    it('returns zero progress for no allocations', () => {
      expect(
        getSplitProgress([]),
      ).toEqual({
        total: 0,
        paid: 0,
        pending: 0,
        cancelled: 0,
        percent: 0,
      });
    });
  },
);
