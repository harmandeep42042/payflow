import {
  getSplitBillDeepLink,
  getSplitBillNotificationHref,
} from './split-bill-deeplink';

const SPLIT_ID =
  '11111111-1111-4111-8111-111111111111';

const ALLOCATION_ID =
  '22222222-2222-4222-8222-222222222222';

describe(
  'Split Bill deep links',
  () => {
    it('accepts a valid split UUID', () => {
      expect(
        getSplitBillDeepLink(
          new URLSearchParams(
            `split=${SPLIT_ID}`,
          ),
        ),
      ).toEqual({
        splitId: SPLIT_ID,
        allocationId: null,
      });
    });

    it('accepts optional allocation targeting', () => {
      expect(
        getSplitBillDeepLink(
          new URLSearchParams(
            `split=${SPLIT_ID}&allocation=${ALLOCATION_ID}`,
          ),
        ),
      ).toEqual({
        splitId: SPLIT_ID,
        allocationId:
          ALLOCATION_ID,
      });
    });

    it('rejects an invalid split UUID', () => {
      expect(
        getSplitBillDeepLink(
          new URLSearchParams(
            'split=invalid',
          ),
        ),
      ).toBeNull();
    });

    it('ignores an invalid optional allocation UUID', () => {
      expect(
        getSplitBillDeepLink(
          new URLSearchParams(
            `split=${SPLIT_ID}&allocation=bad`,
          ),
        ),
      ).toEqual({
        splitId: SPLIT_ID,
        allocationId: null,
      });
    });

    it('builds a notification split link', () => {
      expect(
        getSplitBillNotificationHref({
          metadata: {
            splitId: SPLIT_ID,
          },
        }),
      ).toBe(
        `/split-bill?split=${SPLIT_ID}`,
      );
    });

    it('adds allocation targeting when available', () => {
      expect(
        getSplitBillNotificationHref({
          metadata: {
            splitId: SPLIT_ID,
            allocationId:
              ALLOCATION_ID,
          },
        }),
      ).toBe(
        `/split-bill?split=${SPLIT_ID}&allocation=${ALLOCATION_ID}`,
      );
    });

    it('supports nested metadata payloads', () => {
      expect(
        getSplitBillNotificationHref({
          metadata: {
            payload: {
              splitId: SPLIT_ID,
              allocationId:
                ALLOCATION_ID,
            },
          },
        }),
      ).toBe(
        `/split-bill?split=${SPLIT_ID}&allocation=${ALLOCATION_ID}`,
      );
    });

    it('requires a valid split id', () => {
      expect(
        getSplitBillNotificationHref({
          metadata: {
            splitId: 'bad',
          },
        }),
      ).toBeNull();

      expect(
        getSplitBillNotificationHref(null),
      ).toBeNull();
    });
  },
);
