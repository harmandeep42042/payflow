import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

const page =
  readFileSync(
    join(
      process.cwd(),
      'src/app/autopay/page.tsx',
    ),
    'utf8',
  );

function segment(
  start: string,
  end: string,
) {
  const from =
    page.indexOf(start);

  const to =
    page.indexOf(
      end,
      from + start.length,
    );

  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);

  return page.slice(
    from,
    to,
  );
}

describe(
  'AutoPay setup review contract',
  () => {
    it(
      'routes setup submit into review before the existing create path',
      () => {
        expect(
          page,
        ).toContain(
          'onSubmit={prepareMandateReview}',
        );

        const review =
          segment(
            'function prepareMandateReview(',
            'async function create',
          );

        expect(
          review,
        ).toContain(
          "setSetupReviewStep('review')",
        );

        expect(
          review,
        ).not.toContain(
          'userAuthenticatedRequest',
        );

        expect(
          review,
        ).not.toContain(
          '/customer-features/',
        );
      },
    );

    it(
      'shows the reviewed customer-entered mandate terms',
      () => {
        expect(
          page,
        ).toContain(
          'Review AutoPay mandate request',
        );

        for (
          const term of [
            'setupReview.merchant',
            'setupReview.amount',
            'setupReview.maxAmount',
            'setupReview.currency',
            'setupReview.frequency',
            'setupReview.startAt',
            'setupReview.endAt',
          ]
        ) {
          expect(
            page,
          ).toContain(term);
        }
      },
    );

    it(
      'requires review then a separate final confirmation',
      () => {
        expect(
          page,
        ).toContain(
          'Continue to confirmation',
        );

        expect(
          page,
        ).toContain(
          'Confirm mandate request',
        );

        expect(
          page,
        ).toContain(
          "setSetupReviewStep('confirm')",
        );

        expect(
          page,
        ).toContain(
          'form.requestSubmit()',
        );
      },
    );

    it(
      'keeps the real mandate POST behind the existing create handler',
      () => {
        const create =
          segment(
            'async function create',
            'async function ',
          );

        expect(
          create,
        ).toContain(
          '/customer-features/mandates',
        );

        expect(
          create,
        ).toMatch(
          /method\s*:\s*['"]POST['"]/,
        );
      },
    );

    it(
      'does not claim bank or UPI AutoPay activation',
      () => {
        expect(
          page,
        ).toContain(
          'does not prove that bank or UPI AutoPay is live',
        );

        expect(
          page,
        ).toContain(
          'performs no debit by itself',
        );
      },
    );
  },
);
