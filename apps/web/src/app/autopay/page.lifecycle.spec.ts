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

function lifecycleConfirmSegment() {
  let start =
    page.indexOf(
      'async function confirm',
    );

  if (start < 0) {
    start =
      page.indexOf(
        'function confirm',
      );
  }

  expect(
    start,
  ).toBeGreaterThanOrEqual(0);

  const maximumEnd =
    Math.min(
      page.length,
      start + 2400,
    );

  return page.slice(
    start,
    maximumEnd,
  );
}

describe(
  'AutoPay mandate lifecycle contract',
  () => {
    it(
      'shows Pause only for ACTIVE mandates',
      () => {
        expect(
          page,
        ).toContain(
          "item.status==='ACTIVE'",
        );

        expect(
          page,
        ).toContain(
          "setAction({item,name:'pause'})",
        );
      },
    );

    it(
      'shows Resume only for PAUSED mandates',
      () => {
        expect(
          page,
        ).toContain(
          "item.status==='PAUSED'",
        );

        expect(
          page,
        ).toContain(
          "setAction({item,name:'resume'})",
        );
      },
    );

    it(
      'does not offer Cancel for terminal cancelled or expired mandates',
      () => {
        expect(
          page,
        ).toContain(
          "!['CANCELLED','EXPIRED'].includes(item.status)",
        );

        expect(
          page,
        ).toContain(
          "setAction({item,name:'cancel'})",
        );
      },
    );

    it(
      'requires explicit confirmation before lifecycle mutation',
      () => {
        expect(
          page,
        ).toContain(
          'confirmLabel="Confirm"',
        );

        expect(
          page,
        ).toContain(
          'onConfirm={()=>void confirm()}',
        );

        expect(
          page,
        ).toContain(
          'onClose={()=>setAction(null)}',
        );

        expect(
          page,
        ).toContain(
          'No debit is performed by this action.',
        );
      },
    );

    it(
      'uses the selected JWT-owned mandate id and dynamic lifecycle action',
      () => {
        const confirm =
          lifecycleConfirmSegment();

        expect(
          confirm,
        ).toContain(
          '/customer-features/mandates/',
        );

        expect(
          confirm,
        ).toMatch(
          /action\??\.item\.id|action\.item\.id/,
        );

        expect(
          confirm,
        ).toMatch(
          /action\??\.name|action\.name/,
        );

        expect(
          confirm,
        ).toMatch(
          /method\s*:\s*['"]POST['"]/,
        );
      },
    );

    it(
      'does not add financial execution to the lifecycle confirmation path',
      () => {
        const confirm =
          lifecycleConfirmSegment();

        for (
          const forbidden of [
            'transferWallet',
            'ledgerEntry',
            'billPaymentAttempt.create',
            'rechargeAttempt.create',
            'paymentOrder',
            'executePayment',
            'debitWallet',
          ]
        ) {
          expect(
            confirm,
          ).not.toContain(
            forbidden,
          );
        }
      },
    );

    it(
      'keeps pause resume and cancel as separate user-selected actions',
      () => {
        expect(
          page,
        ).toContain(
          "name:'pause'",
        );

        expect(
          page,
        ).toContain(
          "name:'resume'",
        );

        expect(
          page,
        ).toContain(
          "name:'cancel'",
        );
      },
    );
  },
);
