import type { AuditLogFilters, AuditLogItem, SafeMetadata } from './types';

export const AUDIT_PAGE_SIZES = [10, 20, 50, 100] as const;
export const AUDIT_EXPORT_LIMIT = 1000;
export const DEFAULT_AUDIT_FILTERS: AuditLogFilters = {
  action: '', targetType: 'ALL', actorUserId: '', page: 1, limit: 20,
};

const TARGET_TYPES = ['ALL', 'USER', 'WALLET', 'TRANSACTION'];
const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'token', 'accesstoken', 'refreshtoken',
  'authorization', 'cookie', 'secret', 'apikey', 'privatekey',
  'clientsecret', 'credential', 'credentials', 'session', 'sessiontoken',
  'jwt', 'requestbody', 'responsebody',
]);
const MAX_DEPTH = 5;
const MAX_KEYS = 50;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 500;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}
function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function positiveInteger(value: unknown, fallback = 0): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate >= 0 ? Math.floor(candidate) : fallback;
}

function redactValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  state: { keys: number; truncated: boolean },
): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      state.truncated = true;
      return `${value.slice(0, MAX_STRING_LENGTH)}…`;
    }
    return value;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    state.truncated = true;
    return String(value).slice(0, MAX_STRING_LENGTH);
  }
  if (depth >= MAX_DEPTH) {
    state.truncated = true;
    return '[Maximum depth reached]';
  }
  if (seen.has(value)) {
    state.truncated = true;
    return '[Circular reference]';
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) state.truncated = true;
    const safe = value.slice(0, MAX_ARRAY_ITEMS).map((item) =>
      redactValue(item, depth + 1, seen, state));
    seen.delete(value);
    return safe;
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (state.keys >= MAX_KEYS) { state.truncated = true; break; }
    state.keys += 1;
    result[key] = SENSITIVE_KEYS.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase())
      ? '[REDACTED]'
      : redactValue(item, depth + 1, seen, state);
  }
  seen.delete(value);
  return result;
}

export function redactMetadata(value: unknown): SafeMetadata | null {
  if (value === null || value === undefined) return null;
  const state = { keys: 0, truncated: false };
  return { value: redactValue(value, 0, new WeakSet<object>(), state), truncated: state.truncated };
}

export function metadataText(metadata: SafeMetadata | null): string {
  if (!metadata) return '—';
  if (typeof metadata.value === 'string') return metadata.value;
  if (typeof metadata.value === 'number' || typeof metadata.value === 'boolean') return String(metadata.value);
  try { return JSON.stringify(metadata.value, null, 2); } catch { return 'Metadata unavailable'; }
}

export function normalizeAuditLog(value: unknown): AuditLogItem | null {
  const item = object(value);
  const id = text(item?.id);
  if (!item || !id) return null;
  return {
    id,
    actorUserId: text(item.actorUserId) || null,
    actorEmail: text(item.actorEmail) || null,
    action: text(item.action, 'UNKNOWN'),
    targetType: text(item.targetType, 'UNKNOWN'),
    targetId: text(item.targetId) || null,
    description: text(item.description) || null,
    metadata: redactMetadata(item.metadata),
    ipAddress: text(item.ipAddress) || null,
    userAgent: text(item.userAgent) || null,
    createdAt: text(item.createdAt),
  };
}

export function normalizeAuditLogs(value: unknown): AuditLogItem[] {
  return Array.isArray(value)
    ? value.map(normalizeAuditLog).filter((item): item is AuditLogItem => Boolean(item))
    : [];
}

export function parseAuditFilters(params: URLSearchParams): AuditLogFilters {
  const targetType = text(params.get('targetType'), 'ALL').toUpperCase();
  const page = Number(params.get('page'));
  const limit = Number(params.get('pageSize') ?? params.get('limit'));
  return {
    action: params.get('action')?.trim() ?? '',
    targetType: TARGET_TYPES.includes(targetType) ? targetType : 'ALL',
    actorUserId: params.get('actorUserId')?.trim() ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: AUDIT_PAGE_SIZES.includes(limit as 10 | 20 | 50 | 100) ? limit : 20,
  };
}

export function buildAuditApiQuery(filters: AuditLogFilters, limit = filters.limit, page = filters.page): string {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.action) params.set('action', filters.action);
  if (filters.targetType !== 'ALL') params.set('targetType', filters.targetType);
  if (filters.actorUserId) params.set('actorUserId', filters.actorUserId);
  return params.toString();
}
export function buildAuditUrlQuery(filters: AuditLogFilters): string {
  return new URLSearchParams({
    action: filters.action, targetType: filters.targetType,
    actorUserId: filters.actorUserId, page: String(filters.page),
    pageSize: String(filters.limit),
  }).toString();
}
export function clearAuditFilters(filters: AuditLogFilters): AuditLogFilters {
  return { ...DEFAULT_AUDIT_FILTERS, limit: filters.limit };
}
export function activeAuditFilterCount(filters: AuditLogFilters): number {
  return Number(Boolean(filters.action)) + Number(filters.targetType !== 'ALL') + Number(Boolean(filters.actorUserId));
}
export function normalizeAuditPage(page: number, totalPages: number): number {
  return totalPages > 0 && page > totalPages ? totalPages : page;
}

export function formatAuditDate(value: string): string {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return `${date.toLocaleString('en-IN')} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
}
export function truncateAuditText(value: string | null, maximum = 140): string {
  if (!value) return 'No description';
  return value.length > maximum ? `${value.slice(0, maximum)}…` : value;
}
export function actionTone(action: string): 'danger' | 'warning' | 'success' | 'neutral' {
  const tones: Record<string, 'danger' | 'warning' | 'success'> = {
    BLOCK_USER: 'danger', SUSPEND_USER: 'warning', ACTIVATE_USER: 'success',
    FREEZE_WALLET: 'warning', CLOSE_WALLET: 'danger', ACTIVATE_WALLET: 'success',
  };
  return tones[action] ?? 'neutral';
}
export function actionLabel(action: string): string {
  return actionTone(action) === 'neutral' ? 'Other' : action.replaceAll('_', ' ');
}

export function neutralizeCsvFormula(value: unknown, userControlled = true): string {
  if (typeof value === 'number') return String(value);
  const candidate = String(value ?? '');
  return userControlled && /^[=+\-@]/.test(candidate.trimStart()) ? `'${candidate}` : candidate;
}
export function escapeAuditCsvCell(value: unknown, userControlled = true): string {
  return `"${neutralizeCsvFormula(value, userControlled).replace(/"/g, '""')}"`;
}
export function auditLogsToCsv(logs: AuditLogItem[]): string {
  const headers = ['Audit Log ID', 'Action', 'Actor User ID', 'Actor Email', 'Target Type', 'Target ID', 'Description', 'Metadata', 'IP Address', 'User Agent', 'Created At'];
  const rows = logs.map((log) => [
    log.id, log.action, log.actorUserId ?? '', log.actorEmail ?? '', log.targetType,
    log.targetId ?? '', log.description ?? '', metadataText(log.metadata),
    log.ipAddress ?? '', log.userAgent ?? '', log.createdAt,
  ]);
  return [headers.map((item) => escapeAuditCsvCell(item, false)).join(','), ...rows.map((row) => row.map((item) => escapeAuditCsvCell(item)).join(','))].join('\r\n');
}

export class LatestAuditRequest {
  private controller: AbortController | null = null;
  private sequence = 0;
  begin() { this.controller?.abort(); this.controller = new AbortController(); return { controller: this.controller, requestId: ++this.sequence }; }
  isLatest(id: number) { return id === this.sequence && !this.controller?.signal.aborted; }
  abort() { this.controller?.abort(); }
}

export function auditPagination(value: unknown) {
  const item = object(value);
  return {
    total: positiveInteger(item?.total), totalPages: positiveInteger(item?.totalPages),
    hasNextPage: Boolean(item?.hasNextPage), hasPreviousPage: Boolean(item?.hasPreviousPage),
  };
}
