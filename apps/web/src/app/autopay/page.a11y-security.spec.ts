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

const dialog =
  readFileSync(
    join(
      process.cwd(),
      'src/app/components/customer/ui.tsx',
    ),
    'utf8',
  );

function setupForm() {
  const start =
    page.indexOf('<form');

  const close =
    page.indexOf(
      '</form>',
      start,
    );

  expect(start).toBeGreaterThanOrEqual(0);
  expect(close).toBeGreaterThan(start);

  return page.slice(
    start,
    close + '</form>'.length,
  );
}

describe(
  'AutoPay mobile accessibility and security contract',
  () => {
    it(
      'keeps each setup field associated with an id and visible label',
      () => {
        const form =
          setupForm();

        for (
          const name of [
            'merchant',
            'amount',
            'maxAmount',
            'currency',
            'frequency',
            'startAt',
            'endAt',
          ]
        ) {
          const matcher =
            new RegExp(
              `<(?:Field|SelectField)\\b(?=[^>]*\\bname=["']${name}["'])[^>]*>`,
              's',
            );

          const match =
            form.match(
              matcher,
            );

          expect(match).toBeTruthy();

          if (!match) {
            continue;
          }

          expect(
            match[0],
          ).toMatch(
            /\bid\s*=/,
          );

          expect(
            match[0],
          ).toMatch(
            /\blabel\s*=/,
          );
        }
      },
    );

    it(
      'associates consent text with the checkbox and keeps a generous touch target',
      () => {
        const form =
          setupForm();

        expect(
          form,
        ).toMatch(
          /<label\b[^>]*min-h-12[^>]*>[\s\S]*?<input\b[^>]*name=["']consent["'][^>]*>[\s\S]*?I explicitly consent[\s\S]*?<\/label>/,
        );
      },
    );

    it(
      'keeps responsive breakpoints and flexible lifecycle actions',
      () => {
        expect(
          page,
        ).toMatch(
          /\b(?:sm|md):/,
        );

        expect(
          page,
        ).toMatch(
          /flex\s+flex-wrap|flex-col/,
        );
      },
    );

    it(
      'uses a semantic accessible confirmation dialog',
      () => {
        expect(
          dialog,
        ).toContain(
          'role="dialog"',
        );

        expect(
          dialog,
        ).toContain(
          'aria-modal',
        );

        expect(
          dialog,
        ).toMatch(
          /aria-labelledby|aria-label/,
        );
      },
    );

    it(
      'keeps setup and lifecycle safety disclosures',
      () => {
        expect(
          page,
        ).toContain(
          'This is only a review.',
        );

        expect(
          page,
        ).toContain(
          'does not prove that bank or UPI AutoPay is live',
        );

        expect(
          page,
        ).toContain(
          'does not itself authorize a provider mandate',
        );

        expect(
          page,
        ).toContain(
          'performs no debit by itself',
        );

        expect(
          page,
        ).toContain(
          'No debit is performed by this action.',
        );
      },
    );

    it(
      'uses authenticated customer requests without browser-authoritative user identity',
      () => {
        expect(
          page,
        ).toContain(
          'userAuthenticatedRequest',
        );

        for (
          const forbiddenIdentity of [
            'userId:',
            '"userId"',
            "'userId'",
            "localStorage.getItem('userId",
            'localStorage.getItem("userId',
          ]
        ) {
          expect(
            page,
          ).not.toContain(
            forbiddenIdentity,
          );
        }
      },
    );

    it(
      'contains no direct financial execution primitives in customer AutoPay UI',
      () => {
        for (
          const forbidden of [
            'transferWallet',
            'ledgerEntry',
            'debitWallet',
            'executePayment',
            'billPaymentAttempt.create',
            'rechargeAttempt.create',
          ]
        ) {
          expect(
            page,
          ).not.toContain(
            forbidden,
          );
        }
      },
    );

    it(
      'retains review and lifecycle confirmation boundaries',
      () => {
        expect(
          page,
        ).toContain(
          'Review AutoPay mandate request',
        );

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
          'onConfirm={()=>void confirm()}',
        );
      },
    );
  },
);
