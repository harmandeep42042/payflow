import type { FormEvent } from 'react';
import { Button, Field, Input, Label, Select } from '../ui';
import { WALLET_PAGE_SIZES } from './helpers';

export function WalletsFilterBar({
  searchInput,
  status,
  currency,
  currencies,
  limit,
  activeCount,
  disabled,
  onSearchInput,
  onStatus,
  onCurrency,
  onLimit,
  onSearch,
  onClear,
}: {
  searchInput: string;
  status: string;
  currency: string;
  currencies: string[];
  limit: number;
  activeCount: number;
  disabled: boolean;
  onSearchInput: (value: string) => void;
  onStatus: (value: string) => void;
  onCurrency: (value: string) => void;
  onLimit: (value: number) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch();
  }
  return (
    <section aria-labelledby="wallet-filters-title" className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="wallet-filters-title" className="text-sm font-semibold text-slate-900">Filters</h2>
        <span className="text-xs text-slate-500">{activeCount} active</span>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_8rem_auto_auto] xl:items-end">
        <Field>
          <Label htmlFor="wallet-search">Search</Label>
          <Input id="wallet-search" value={searchInput} onChange={(event) => onSearchInput(event.target.value)} placeholder="Wallet ID, owner or email" />
        </Field>
        <Field>
          <Label htmlFor="wallet-status">Status</Label>
          <Select id="wallet-status" value={status} onChange={(event) => onStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="FROZEN">Frozen</option>
            <option value="CLOSED">Closed</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="wallet-currency">Currency</Label>
          <Select id="wallet-currency" value={currency} onChange={(event) => onCurrency(event.target.value)}>
            <option value="ALL">All currencies</option>
            {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="wallet-limit">Rows</Label>
          <Select id="wallet-limit" value={limit} onChange={(event) => onLimit(Number(event.target.value))}>
            {WALLET_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </Select>
        </Field>
        <Button className="min-h-10 sm:self-end" type="submit" disabled={disabled}>Search</Button>
        <Button className="min-h-10 sm:self-end" variant="secondary" onClick={onClear} disabled={disabled || activeCount === 0}>Clear</Button>
      </form>
    </section>
  );
}
