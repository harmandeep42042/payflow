import {
  buildPaymentHelpHref,
  getPaymentHelpTransactionId,
} from './payment-help-deeplink';

const TRANSACTION_ID =
  '11111111-1111-4111-8111-111111111111';

describe(
  'payment help deep-link',
  () => {
    it(
      'accepts a valid transaction UUID',
      () => {
        expect(
          getPaymentHelpTransactionId(
            new URLSearchParams(
              `transactionId=${TRANSACTION_ID}`,
            ),
          ),
        ).toBe(
          TRANSACTION_ID,
        );
      },
    );

    it(
      'rejects missing or invalid transaction IDs',
      () => {
        expect(
          getPaymentHelpTransactionId(
            new URLSearchParams(),
          ),
        ).toBeNull();

        expect(
          getPaymentHelpTransactionId(
            new URLSearchParams(
              'transactionId=bad',
            ),
          ),
        ).toBeNull();
      },
    );

    it(
      'builds the safe Help deep-link',
      () => {
        expect(
          buildPaymentHelpHref(
            TRANSACTION_ID,
          ),
        ).toBe(
          `/help?transactionId=${TRANSACTION_ID}`,
        );
      },
    );

    it(
      'does not build a Help link for invalid IDs',
      () => {
        expect(
          buildPaymentHelpHref(
            'not-a-transaction',
          ),
        ).toBeNull();
      },
    );
  },
);
