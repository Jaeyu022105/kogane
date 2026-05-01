export type AuditActionType =
  | 'insert'
  | 'update'
  | 'delete'
  | 'schema:create'
  | 'schema:alter'
  | 'schema:drop'
  | 'login'
  | 'logout'
  | 'upload'
  | 'permission:denied';

export type AuditActorType = 'admin' | 'inpoint';

export interface AuditLogRecord {
  id: string;
  business_id: string;
  actor_id: string | null;
  actor_type: AuditActorType;
  actor_name: string;
  action_type: AuditActionType;
  target_table: string | null;
  target_id: string | null;
  payload_before: string | null;
  payload_after: string | null;
  metadata: string | null;
  created_at: string;
}

export interface AuditWriteInput {
  businessId: string;
  actorId?: string | null;
  actorType: AuditActorType;
  actorName: string;
  actionType: AuditActionType;
  targetTable?: string | null;
  targetId?: string | null;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
  metadata?: Record<string, unknown> | null;
}

export function serializeAuditJson(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

export function parseAuditJson<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
