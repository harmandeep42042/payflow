import { fireEvent, render, screen } from '@testing-library/react';
import { AuditLogDetailsDialog } from './audit-log-details-dialog';
import { AuditLogFilterBar } from './audit-log-filter-bar';
import { AuditLogsPagination } from './audit-logs-pagination';
import { AuditLogsTable } from './audit-logs-table';
import {
  actionLabel, activeAuditFilterCount, AUDIT_EXPORT_LIMIT, auditLogsToCsv,
  buildAuditApiQuery, buildAuditUrlQuery, clearAuditFilters, DEFAULT_AUDIT_FILTERS,
  escapeAuditCsvCell, formatAuditDate, LatestAuditRequest, metadataText,
  neutralizeCsvFormula, normalizeAuditLog, normalizeAuditLogs, normalizeAuditPage,
  parseAuditFilters, redactMetadata,
} from './helpers';
import type { AuditLogItem } from './types';

const log: AuditLogItem = {
  id: 'audit-id', actorUserId: 'admin-id', actorEmail: 'admin@payflow.test',
  action: 'BLOCK_USER', targetType: 'USER', targetId: 'target-id',
  description: 'User blocked', metadata: redactMetadata({ previousStatus: 'ACTIVE' }),
  ipAddress: '127.0.0.1', userAgent: 'Test browser', createdAt: '2026-01-01T10:00:00.000Z',
};

describe('Hardened Audit Logs', () => {
  it('normalizes responses and safely defaults missing fields', () => {
    expect(normalizeAuditLogs(null)).toEqual([]);
    expect(normalizeAuditLog({ id: 'one', metadata: 12 })).toMatchObject({
      id: 'one', action: 'UNKNOWN', targetType: 'UNKNOWN', actorEmail: null,
      metadata: { value: 12, truncated: false },
    });
    expect(normalizeAuditLog({ action: 'NO_ID' })).toBeNull();
  });

  it('recursively redacts all sensitive key variants', () => {
    const safe = redactMetadata({
      password: 'one', user: { passwordHash: 'two', access_token: 'three' },
      authorization: 'Bearer token', API_KEY: 'four', clientSecret: 'five',
      credentials: { jwt: 'six' }, requestBody: { safe: false }, public: 'visible',
    });
    const rendered = metadataText(safe);
    expect(rendered).toContain('"public": "visible"');
    expect(rendered.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(7);
    expect(rendered).not.toMatch(/one|two|three|Bearer|four|five|six/);
  });

  it('handles malformed circular metadata without crashing', () => {
    const circular: Record<string, unknown> = { safe: true };
    circular.self = circular;
    const safe = redactMetadata(circular);
    expect(safe?.truncated).toBe(true);
    expect(metadataText(safe)).toContain('[Circular reference]');
  });

  it('enforces depth, object-key, array and string limits', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'hidden' } } } } } };
    const many = Object.fromEntries(Array.from({ length: 70 }, (_, index) => [`key${index}`, index]));
    const safe = redactMetadata({ deep, many, array: Array.from({ length: 40 }, (_, index) => index), long: 'x'.repeat(700) });
    expect(safe?.truncated).toBe(true);
    const output = metadataText(safe);
    expect(output).toContain('Maximum depth reached');
    expect(output.length).toBeLessThan(5000);
  });

  it.each([[null, '—'], ['safe', 'safe'], [42, '42'], [true, 'true']])('renders safe primitive %p', (value, expected) => {
    expect(metadataText(redactMetadata(value))).toBe(expected);
  });

  it('uses an explicit neutral fallback for unknown actions', () => {
    expect(actionLabel('BLOCK_USER')).toBe('BLOCK USER');
    expect(actionLabel('FUTURE_EVENT')).toBe('Other');
  });

  it('parses, constructs and normalizes URL/API state', () => {
    const filters = parseAuditFilters(new URLSearchParams('action=BLOCK_USER&targetType=wallet&actorUserId=abc&page=3&pageSize=50'));
    expect(filters).toEqual({ action: 'BLOCK_USER', targetType: 'WALLET', actorUserId: 'abc', page: 3, limit: 50 });
    expect(buildAuditUrlQuery(filters)).toContain('pageSize=50');
    expect(buildAuditApiQuery(filters)).toBe('page=3&limit=50&action=BLOCK_USER&targetType=WALLET&actorUserId=abc');
    expect(parseAuditFilters(new URLSearchParams('targetType=BAD&page=-1&pageSize=7'))).toEqual(DEFAULT_AUDIT_FILTERS);
  });

  it('clears filters while preserving page size and normalizes out-of-range pages', () => {
    expect(clearAuditFilters({ action: 'A', targetType: 'USER', actorUserId: 'id', page: 4, limit: 100 })).toEqual({ ...DEFAULT_AUDIT_FILTERS, limit: 100 });
    expect(normalizeAuditPage(8, 3)).toBe(3);
    expect(normalizeAuditPage(8, 0)).toBe(8);
    expect(activeAuditFilterCount({ ...DEFAULT_AUDIT_FILTERS, action: 'A', actorUserId: 'id' })).toBe(2);
  });

  it('cancels stale requests and permits only the latest response', () => {
    const requests = new LatestAuditRequest(); const first = requests.begin(); const second = requests.begin();
    expect(first.controller.signal.aborted).toBe(true);
    expect(requests.isLatest(first.requestId)).toBe(false);
    expect(requests.isLatest(second.requestId)).toBe(true);
    requests.abort(); expect(second.controller.signal.aborted).toBe(true);
  });

  it.each(['=SUM(A1:A2)', '+123', '-123', '@cmd'])('neutralizes CSV formula text %s', (value) => {
    expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
    expect(escapeAuditCsvCell(value)).toContain(`'${value}`);
  });

  it('preserves normal values and legitimate negative numeric data', () => {
    expect(neutralizeCsvFormula('audit-id')).toBe('audit-id');
    expect(neutralizeCsvFormula(-123)).toBe('-123');
  });

  it('exports only redacted metadata and defines a bounded export limit', () => {
    const safeLog = { ...log, metadata: redactMetadata({ password: '=SECRET()', note: '=SUM(A1:A2)' }) };
    const csv = auditLogsToCsv([safeLog]);
    expect(csv).toContain('[REDACTED]');
    expect(csv).not.toContain('SECRET()');
    // Structured metadata is serialized as a JSON object cell, so the cell itself
    // begins with "{" and cannot be interpreted as a spreadsheet formula.
    expect(csv).toContain('=SUM(A1:A2)');
    expect(AUDIT_EXPORT_LIMIT).toBe(1000);
  });

  it('renders labelled exact-match filters and page controls', () => {
    const handlers = { onActionInput: jest.fn(), onTargetType: jest.fn(), onActorInput: jest.fn(), onLimit: jest.fn(), onApply: jest.fn(), onClear: jest.fn() };
    const { unmount } = render(<AuditLogFilterBar actionInput="" targetType="ALL" actorInput="" limit={20} activeCount={1} disabled={false} {...handlers} />);
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'BLOCK_USER' } });
    fireEvent.change(screen.getByLabelText('Target type'), { target: { value: 'USER' } });
    fireEvent.change(screen.getByLabelText('Actor user ID'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(handlers.onActionInput).toHaveBeenCalledWith('BLOCK_USER'); expect(handlers.onTargetType).toHaveBeenCalledWith('USER'); expect(handlers.onActorInput).toHaveBeenCalledWith('admin'); expect(handlers.onLimit).toHaveBeenCalledWith(100); expect(handlers.onApply).toHaveBeenCalled();
    unmount(); const onPage = jest.fn(); render(<AuditLogsPagination page={2} totalPages={3} total={50} start={21} end={40} hasPrevious hasNext disabled={false} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' })); fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenNthCalledWith(1, 1); expect(onPage).toHaveBeenNthCalledWith(2, 3);
  });

  it('preserves visible rows during background refresh and exposes accessibility states', () => {
    const { rerender } = render(<AuditLogsTable logs={[log]} initialLoading={false} filtered={false} onDetails={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('false'); expect(screen.getByText('admin@payflow.test')).toBeTruthy();
    rerender(<AuditLogsTable logs={[log]} initialLoading={false} filtered={false} onDetails={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByText('admin@payflow.test')).toBeTruthy();
    rerender(<AuditLogsTable logs={[]} initialLoading={false} filtered onDetails={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByText('No audit logs match these filters')).toBeTruthy();
  });

  it('opens an accessible redacted dialog, closes on Escape and restores focus', () => {
    const onClose = jest.fn(); const trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus();
    const { unmount } = render(<AuditLogDetailsDialog open log={{ ...log, metadata: redactMetadata({ token: 'secret', visible: 'safe' }) }} onClose={onClose} returnFocus={trigger} />);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close audit event details' }));
    fireEvent.click(screen.getByText('Safe metadata')); expect(screen.getByText(/redacted for security/i)).toBeTruthy(); expect(screen.queryByText('secret')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(onClose).toHaveBeenCalled();
    unmount(); expect(document.activeElement).toBe(trigger); trigger.remove();
  });

  it('formats invalid dates without displaying Invalid Date', () => {
    expect(formatAuditDate('bad')).toBe('Unknown time'); expect(formatAuditDate('')).toBe('Unknown time');
  });
});
