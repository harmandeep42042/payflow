import {
  buildCategoryBreakdown,
  buildSpendingTrend,
  comparePeriods,
  formatMoneyString,
  moneyToMinorUnits,
} from './spending-insights';

describe('smart spending insights utilities', () => {
  it('keeps large financial amounts out of JavaScript Number arithmetic', () => {
    expect(
      moneyToMinorUnits(
        '9007199254740993.25',
      ),
    ).toBe(
      BigInt(
        '900719925474099325',
      ),
    );

    expect(
      formatMoneyString(
        '9007199254740993.25',
        'INR',
      ),
    ).toBe(
      '₹9,00,71,99,25,47,40,993.25',
    );
  });

  it('builds category percentages using integer minor units', () => {
    const result =
      buildCategoryBreakdown(
        [
          {
            category: 'FOOD',
            currencies: [
              {
                currency: 'INR',
                amount: '75.00',
              },
            ],
          },
          {
            category: 'TRAVEL',
            currencies: [
              {
                currency: 'INR',
                amount: '25.00',
              },
            ],
          },
        ],
        'INR',
      );

    expect(result).toEqual([
      {
        category: 'FOOD',
        amount: '75.00',
        percentage: 75,
      },
      {
        category: 'TRAVEL',
        amount: '25.00',
        percentage: 25,
      },
    ]);
  });

  it('compares periods without converting money to floating point', () => {
    expect(
      comparePeriods(
        '120.00',
        '100.00',
      ),
    ).toEqual({
      direction: 'UP',
      label: '+20.00%',
    });

    expect(
      comparePeriods(
        '80.00',
        '100.00',
      ),
    ).toEqual({
      direction: 'DOWN',
      label: '-20.00%',
    });

    expect(
      comparePeriods(
        '10.00',
        '0',
      ),
    ).toEqual({
      direction: 'NEW',
      label: 'New activity',
    });
  });

  it('creates bounded chart percentages from Decimal strings', () => {
    expect(
      buildSpendingTrend([
        {
          date: '2026-09-01',
          incoming: '0',
          outgoing: '10.00',
        },
        {
          date: '2026-09-02',
          incoming: '0',
          outgoing: '20.00',
        },
      ]),
    ).toEqual([
      {
        date: '2026-09-01',
        amount: '10.00',
        percentage: 50,
      },
      {
        date: '2026-09-02',
        amount: '20.00',
        percentage: 100,
      },
    ]);
  });
});