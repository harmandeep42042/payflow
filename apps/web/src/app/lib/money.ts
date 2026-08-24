export type CurrencyAmount = { currency: string; amount: string };

export function normalizeDecimal(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  return `${whole.replace(/^0+(?=\d)/, '') || '0'}.${fraction.padEnd(2, '0')}`;
}

function minorUnits(value: string): bigint {
  const normalized = normalizeDecimal(value);
  if (!normalized) throw new Error('Invalid monetary amount');
  const [whole, fraction] = normalized.split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction);
}

function fromMinorUnits(value: bigint): string {
  const sign = value < BigInt(0) ? '-' : '';
  const absolute = value < BigInt(0) ? -value : value;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
}

export function addDecimalStrings(left: string, right: string): string {
  return fromMinorUnits(minorUnits(left) + minorUnits(right));
}

export function compareDecimalStrings(left: string, right: string): number {
  const difference = minorUnits(left) - minorUnits(right); return difference < BigInt(0) ? -1 : difference > BigInt(0) ? 1 : 0;
}

export function toMinorUnitNumber(value: string): number {
  const units = minorUnits(value);
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large');
  return Number(units);
}

export function formatMoney(amount: string, currency: string): string {
  const normalized = normalizeDecimal(amount) ?? '0.00';
  const [whole, fraction] = normalized.split('.');
  const grouped = BigInt(whole).toLocaleString('en-IN');
  return `${currency.trim().toUpperCase() || '—'} ${grouped}.${fraction}`;
}

export function groupCurrencyAmounts(items: Array<{ amount: string; currency: string }>): CurrencyAmount[] {
  const totals = new Map<string, string>();
  for (const item of items) {
    const amount = normalizeDecimal(item.amount); const currency = item.currency?.trim().toUpperCase();
    if (!amount || !currency) continue;
    totals.set(currency, addDecimalStrings(totals.get(currency) ?? '0.00', amount));
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount }));
}
