import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

const source =
  readFileSync(
    join(
      process.cwd(),
      'src/app/bills/page.tsx',
    ),
    'utf8',
  );

describe(
  'Bills page payment safety contract',
  () => {
    it(
      'keeps provider authority explicit',
      () => {
        expect(source).toContain(
          'Billers, bill details and successful payment status only come from an authoritative provider.',
        );

        expect(source).toContain(
          'PROVIDER_NOT_CONFIGURED',
        );

        expect(source).toContain(
          'No provider-returned billers are available.',
        );
      },
    );

    it(
      'keeps validation/review separate from explicit payment submission',
      () => {
        expect(source).toContain(
          '/customer-features/bills/validate',
        );

        expect(source).toContain(
          'onSubmit={(event)=>void prepare(event)}',
        );

        expect(source).toContain(
          'Validate and review',
        );

        expect(source).toContain(
          'title="Confirm bill payment attempt"',
        );

        expect(source).toContain(
          'confirmLabel="Submit attempt"',
        );

        expect(source).toContain(
          'onConfirm={()=>void submit()}',
        );

        expect(source).toContain(
          '/customer-features/bill-payments',
        );

        expect(source).toContain(
          'Payment is only successful if the provider confirms it.',
        );
      },
    );

    it(
      'integrates saved references without replacing the payment confirmation flow',
      () => {
        expect(source).toContain(
          "import SavedBillers from './SavedBillers';",
        );

        expect(source).toContain(
          '<SavedBillers />',
        );

        expect(source).toContain(
          'title="Confirm bill payment attempt"',
        );

        expect(source).toContain(
          'onConfirm={()=>void submit()}',
        );
      },
    );
  },
);
