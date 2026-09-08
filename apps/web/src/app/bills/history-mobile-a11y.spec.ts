import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

function source(
  relativePath: string,
) {
  return readFileSync(
    join(
      process.cwd(),
      relativePath,
    ),
    'utf8',
  );
}

const recharge =
  source(
    'src/app/recharge/page.tsx',
  );

const bills =
  source(
    'src/app/bills/page.tsx',
  );

const savedBillers =
  source(
    'src/app/bills/SavedBillers.tsx',
  );

const reminders =
  source(
    'src/app/bills/BillReminders.tsx',
  );

describe(
  'Recharge and bill history / mobile / accessibility contract',
  () => {
    it(
      'retains customer recharge and bill history surfaces',
      () => {
        expect(
          recharge,
        ).toContain(
          '/customer-features/recharges',
        );

        expect(
          bills,
        ).toContain(
          '/customer-features/bill-payments',
        );

        expect(
          recharge,
        ).toMatch(
          /history|recent recharge/i,
        );

        expect(
          bills,
        ).toMatch(
          /history|recent bill/i,
        );
      },
    );

    it(
      'keeps saved billers and reminders responsive on small screens',
      () => {
        expect(
          savedBillers,
        ).toContain(
          'flex-col',
        );

        expect(
          savedBillers,
        ).toContain(
          'sm:',
        );

        expect(
          reminders,
        ).toContain(
          'flex-col',
        );

        expect(
          reminders,
        ).toContain(
          'sm:',
        );

        expect(
          reminders,
        ).toContain(
          'md:grid-cols-2',
        );

        expect(
          reminders,
        ).toContain(
          'min-w-0',
        );
      },
    );

    it(
      'keeps status messaging and actions accessible',
      () => {
        expect(
          savedBillers,
        ).toContain(
          'aria-live="polite"',
        );

        expect(
          reminders,
        ).toContain(
          'aria-live="polite"',
        );

        expect(
          reminders,
        ).toContain(
          'aria-atomic="true"',
        );

        expect(
          reminders,
        ).toContain(
          'aria-labelledby="bill-reminders-title"',
        );

        expect(
          reminders,
        ).toContain(
          'aria-label={`Delete reminder for ${label}`}',
        );

        expect(
          reminders,
        ).toContain(
          '<time',
        );
      },
    );

    it(
      'keeps reminders separate from AutoPay and payment execution',
      () => {
        expect(
          reminders,
        ).toContain(
          'They do not validate bills, authorize AutoPay, debit your wallet, or submit a payment.',
        );

        expect(
          reminders,
        ).not.toContain(
          '/customer-features/bills/validate',
        );

        expect(
          reminders,
        ).not.toContain(
          '/customer-features/bill-payments',
        );

        expect(
          reminders,
        ).not.toContain(
          '/customer-features/mandates',
        );
      },
    );
  },
);
