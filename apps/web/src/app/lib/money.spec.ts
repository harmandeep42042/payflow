import { addDecimalStrings, compareDecimalStrings, formatMoney, groupCurrencyAmounts, normalizeDecimal } from './money';

describe('customer money helpers', () => {
  it('normalizes, adds, and compares exact decimals without floating point', () => {
    expect(normalizeDecimal('9007199254740993.1')).toBe('9007199254740993.10');
    expect(addDecimalStrings('9007199254740993.10', '0.20')).toBe('9007199254740993.30');
    expect(compareDecimalStrings('0.30', '0.29')).toBe(1);
  });

  it('keeps currencies separated', () => {
    expect(groupCurrencyAmounts([
      { amount: '1.10', currency: 'INR' },
      { amount: '2.20', currency: 'USD' },
      { amount: '0.20', currency: 'INR' },
    ])).toEqual([
      { currency: 'INR', amount: '1.30' },
      { currency: 'USD', amount: '2.20' },
    ]);
    expect(formatMoney('1234.50', 'USD')).toBe('USD 1,234.50');
  });
});
