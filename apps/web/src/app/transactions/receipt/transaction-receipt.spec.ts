import {
  buildReceiptShareText,
  buildRepeatPaymentHref,
  findReceiptTransaction,
  getReceiptCounterpartyLabel,
  getReceiptDirection,
  getReceiptTransactionId,
  normalizeReceiptHistory,
  normalizeReceiptTransaction,
} from './transaction-receipt';

const TRANSACTION_ID =
  '11111111-1111-4111-8111-111111111111';

describe(
  'transaction receipt utilities',
  () => {
    const transaction = {
      id: TRANSACTION_ID,
      type: 'TRANSFER',
      status: 'COMPLETED',
      amount: '125.50',
      currency: 'INR',
      createdAt:
        '2026-09-07T10:00:00.000Z',
      description: 'Dinner',
      sourceWalletId:
        'wallet-source',
      destinationWalletId:
        'wallet-destination',
      counterparty: {
        firstName: 'Asha',
        lastName: 'Sharma',
        email:
          'asha@example.test',
        vpa: 'asha@payflow',
      },
    };

    it(
      'accepts a valid transaction UUID',
      () => {
        expect(
          getReceiptTransactionId(
            new URLSearchParams(
              `transactionId=${TRANSACTION_ID}`,
            ),
          ),
        ).toBe(TRANSACTION_ID);
      },
    );

    it(
      'rejects invalid transaction ids',
      () => {
        expect(
          getReceiptTransactionId(
            new URLSearchParams(
              'transactionId=bad',
            ),
          ),
        ).toBeNull();

        expect(
          getReceiptTransactionId(
            new URLSearchParams(),
          ),
        ).toBeNull();
      },
    );

    it(
      'normalizes a real transaction record',
      () => {
        expect(
          normalizeReceiptTransaction(
            transaction,
          ),
        ).toMatchObject({
          id: TRANSACTION_ID,
          amount: '125.50',
          currency: 'INR',
          status: 'COMPLETED',
          counterparty: {
            vpa: 'asha@payflow',
          },
        });
      },
    );

    it(
      'rejects incomplete records',
      () => {
        expect(
          normalizeReceiptTransaction({
            id: TRANSACTION_ID,
          }),
        ).toBeNull();
      },
    );

    it(
      'normalizes supported history envelopes',
      () => {
        expect(
          normalizeReceiptHistory([
            transaction,
          ]),
        ).toHaveLength(1);

        expect(
          normalizeReceiptHistory({
            transactions: [
              transaction,
            ],
          }),
        ).toHaveLength(1);

        expect(
          normalizeReceiptHistory({
            items: [
              transaction,
            ],
          }),
        ).toHaveLength(1);

        expect(
          normalizeReceiptHistory({
            data: [
              transaction,
            ],
          }),
        ).toHaveLength(1);
      },
    );

    it(
      'finds the requested transaction',
      () => {
        const normalized =
          normalizeReceiptHistory([
            transaction,
          ]);

        expect(
          findReceiptTransaction(
            normalized,
            TRANSACTION_ID,
          )?.id,
        ).toBe(
          TRANSACTION_ID,
        );
      },
    );

    it(
      'derives receipt direction from owned wallets',
      () => {
        const normalized =
          normalizeReceiptTransaction(
            transaction,
          );

        expect(normalized).not.toBeNull();

        if (!normalized) {
          return;
        }

        expect(
          getReceiptDirection(
            normalized,
            ['wallet-source'],
          ),
        ).toBe('Sent');

        expect(
          getReceiptDirection(
            normalized,
            ['wallet-destination'],
          ),
        ).toBe('Received');

        expect(
          getReceiptDirection(
            normalized,
            [
              'wallet-source',
              'wallet-destination',
            ],
          ),
        ).toBe(
          'Between your wallets',
        );
      },
    );

    it(
      'uses only returned counterparty identity data',
      () => {
        expect(
          getReceiptCounterpartyLabel({
            firstName: 'Asha',
            lastName: 'Sharma',
          }),
        ).toBe(
          'Asha Sharma',
        );

        expect(
          getReceiptCounterpartyLabel({
            email:
              'asha@example.test',
          }),
        ).toBe(
          'asha@example.test',
        );

        expect(
          getReceiptCounterpartyLabel(
            undefined,
          ),
        ).toBeNull();
      },
    );

    it(
      'builds receipt share text from transaction fields',
      () => {
        const normalized =
          normalizeReceiptTransaction(
            transaction,
          );

        expect(normalized).not.toBeNull();

        if (!normalized) {
          return;
        }

        const text =
          buildReceiptShareText(
            normalized,
          );

        expect(
          text,
        ).toContain(
          'Payflow transaction receipt',
        );

        expect(
          text,
        ).toContain(
          'Amount: INR 125.50',
        );

        expect(
          text,
        ).toContain(
          'Status: COMPLETED',
        );

        expect(
          text,
        ).toContain(
          `Transaction ID: ${TRANSACTION_ID}`,
        );
      },
    );

    it(
      'builds repeat navigation only from a returned valid VPA',
      () => {
        expect(
          buildRepeatPaymentHref({
            vpa: 'friend@payflow',
          }),
        ).toBe(
          '/send-money?vpa=friend%40payflow',
        );

        expect(
          buildRepeatPaymentHref({
            userId: 'user-2',
            walletId: 'wallet-2',
          }),
        ).toBeNull();

        expect(
          buildRepeatPaymentHref({
            vpa: 'not-a-vpa',
          }),
        ).toBeNull();

        expect(
          buildRepeatPaymentHref(
            undefined,
          ),
        ).toBeNull();
      },
    );
  },
);
