export type SafeMetadata = { value: unknown; truncated: boolean };

export type AuditLogItem = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  description: string | null;
  metadata: SafeMetadata | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AuditLogFilters = {
  action: string;
  targetType: string;
  actorUserId: string;
  page: number;
  limit: number;
};

export type AuditLogsResponse = {
  auditLogs?: unknown;
  pagination?: Record<string, unknown>;
};
