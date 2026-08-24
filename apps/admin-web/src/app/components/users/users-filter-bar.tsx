import type { FormEvent } from 'react';
import { Button, Field, Input, Label, Select } from '../ui';
import { PAGE_SIZES } from './helpers';

type Props = {
  searchInput: string;
  status: string;
  role: string;
  limit: number;
  activeCount: number;
  disabled: boolean;
  onSearchInput: (value: string) => void;
  onStatus: (value: string) => void;
  onRole: (value: string) => void;
  onLimit: (value: number) => void;
  onSearch: () => void;
  onClear: () => void;
};

export function UsersFilterBar(props: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onSearch();
  }
  return (
    <section
      aria-labelledby="users-filters-title"
      className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="users-filters-title"
          className="text-sm font-semibold text-slate-900"
        >
          Filters
        </h2>
        <span className="text-xs text-slate-500">
          {props.activeCount} active
        </span>
      </div>
      <form
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_8rem_auto_auto] xl:items-end"
      >
        <Field>
          <Label htmlFor="users-search">Search</Label>
          <Input
            id="users-search"
            value={props.searchInput}
            onChange={(e) => props.onSearchInput(e.target.value)}
            placeholder="Name, email or phone"
          />
        </Field>
        <Field>
          <Label htmlFor="users-status">Status</Label>
          <Select
            id="users-status"
            value={props.status}
            onChange={(e) => props.onStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="BLOCKED">Blocked</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="users-role">Role</Label>
          <Select
            id="users-role"
            value={props.role}
            onChange={(e) => props.onRole(e.target.value)}
          >
            <option value="ALL">All roles</option>
            <option value="USER">Users</option>
            <option value="ADMIN">Admins</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="users-limit">Rows</Label>
          <Select
            id="users-limit"
            value={props.limit}
            onChange={(e) => props.onLimit(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          className="min-h-10 sm:self-end"
          type="submit"
          disabled={props.disabled}
        >
          Search
        </Button>
        <Button
          className="min-h-10 sm:self-end"
          variant="secondary"
          onClick={props.onClear}
          disabled={props.disabled || props.activeCount === 0}
        >
          Clear
        </Button>
      </form>
    </section>
  );
}
