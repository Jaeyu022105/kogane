export type AuditActionType =
  | 'insert'
  | 'update'
  | 'delete'
  | 'schema:create'
  | 'schema:alter'
  | 'schema:drop'
  | 'preset:create'
  | 'preset:update'
  | 'preset:delete'
  | 'preset:apply'
  | 'preset:sync'
  | 'terminal:layout'
  | 'terminal:pin'
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

export type AuditDiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface AuditDiffEntry {
  key: string;
  kind: AuditDiffKind;
  before: unknown;
  after: unknown;
}

export interface AuditDiffSummary {
  entries: AuditDiffEntry[];
  added: string[];
  removed: string[];
  changed: string[];
  unchangedCount: number;
  hasChanges: boolean;
}

export interface RedactAuditOptions {
  mode?: 'strip' | 'mask';
  replacement?: string;
}

const SENSITIVE_EXACT_KEYS = new Set([
  'pin',
  'pincode',
  'pinhash',
  'newpin',
  'oldpin',
  'currentpin',
  'rawpin',
  'password',
  'passwordhash',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'passcode',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'authtoken',
  'idtoken',
  'csrftoken',
  'bearertoken',
  'secret',
  'clientsecret',
  'sessionsecret',
  'twofactorsecret',
  'twofactorbackupcodes',
  'backupcodes',
  'totpsecret',
  'apikey',
  'privatekey',
  'servicekey',
  'signingkey',
  'encryptionkey',
  'authorization',
  'cookie',
  'setcookie',
]);

const NON_SENSITIVE_BOOLEAN_FLAG_KEYS = new Set([
  'haspin',
  'requirespin',
  'requirepin',
  'usespin',
  'pinenabled',
  'pinrequired',
  'pinconfigured',
  'haspassword',
  'requirespassword',
  'requirepassword',
  'passwordrequired',
]);

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isSensitiveAuditKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  const compact = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (NON_SENSITIVE_BOOLEAN_FLAG_KEYS.has(compact)) return false;
  if (SENSITIVE_EXACT_KEYS.has(compact)) return true;
  if (/password|passcode|secret|backup_?codes/i.test(trimmed)) return true;
  if (/(?:^|_)pin(?:_code|_hash)?$|Pin(?:Code|Hash)?$/.test(trimmed)) return true;
  if (/(?:^|_)token(?:_hash)?$|Token(?:Hash)?$/.test(trimmed)) return true;
  if (/(?:api|private|service|signing|encryption)_?key$|(?:Api|Private|Service|Signing|Encryption)Key$/.test(trimmed)) return true;
  return false;
}

function redactAuditValueInternal(
  value: unknown,
  options: RedactAuditOptions,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth > 12) return null;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValueInternal(item, options, depth + 1, seen));
  }

  const mode = options.mode ?? 'strip';
  const replacement = options.replacement ?? '[REDACTED]';
  const out: Record<string, unknown> = {};

  for (const [key, rawVal] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) continue;

    if (isSensitiveAuditKey(key) || (key.toLowerCase() === 'session' && typeof rawVal === 'string')) {
      if (mode === 'mask') {
        out[key] = replacement;
      }
      continue;
    }

    out[key] = redactAuditValueInternal(rawVal, options, depth + 1, seen);
  }

  return out;
}

/**
 * Recursively strips (or masks) sensitive credential fields such as PINs,
 * PIN hashes, password hashes, auth tokens, and 2FA secrets from audit payloads.
 */
export function redactAuditPayload<T = unknown>(
  value: T,
  options: RedactAuditOptions = {},
): T {
  return redactAuditValueInternal(value, options, 0, new WeakSet<object>()) as T;
}

export function serializeAuditJson(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

export function parseAuditJson<T = unknown>(
  value: string | Record<string, unknown> | unknown[] | null | undefined,
): T | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function redactAuditJsonString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    return serializeAuditJson(redactAuditPayload(value));
  }
  const parsed = parseAuditJson(value);
  if (parsed !== null && typeof parsed === 'object') {
    return serializeAuditJson(redactAuditPayload(parsed));
  }
  return value;
}

/**
 * Parses timestamps stored either in SQLite `YYYY-MM-DD HH:MM:SS` (UTC)
 * or standard ISO-8601 strings.
 */
export function parseAuditTimestamp(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
      const hasTz = trimmed.includes('Z') || /[+-]\d{2}(:\d{2})?$/.test(trimmed);
      const iso = trimmed.replace(' ', 'T') + (hasTz ? '' : 'Z');
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeDiffInput(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null;

  let value: unknown = raw;
  if (typeof raw === 'string') {
    const parsed = parseAuditJson(raw);
    value = parsed !== null ? parsed : { value: raw };
  }

  if (value == null) return null;
  const redacted = redactAuditPayload(value);

  if (typeof redacted === 'object' && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>;
  }
  if (Array.isArray(redacted)) {
    return { items: redacted };
  }
  return { value: redacted };
}

function flattenDiffRecord(
  record: Record<string, unknown>,
  prefix = '',
  depth = 0,
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const [key, val] of Object.entries(record)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      val !== null
      && typeof val === 'object'
      && !Array.isArray(val)
      && !(val instanceof Date)
      && depth < 4
      && Object.keys(val as Record<string, unknown>).length > 0
      && Object.keys(out).length < 150
    ) {
      flattenDiffRecord(val as Record<string, unknown>, path, depth + 1, out);
    } else {
      out[path] = val;
    }
  }
  return out;
}

function areAuditValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, idx) => areAuditValuesEqual(item, b[idx]));
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k)
      && areAuditValuesEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Produces a redacted, field-level diff summary comparing `payloadBefore` and `payloadAfter`.
 */
export function summarizeAuditDiff(before: unknown, after: unknown): AuditDiffSummary {
  const beforeObj = normalizeDiffInput(before);
  const afterObj = normalizeDiffInput(after);

  const beforeFlat = beforeObj ? flattenDiffRecord(beforeObj) : {};
  const afterFlat = afterObj ? flattenDiffRecord(afterObj) : {};

  const orderedKeys: string[] = [];
  const seenKeys = new Set<string>();
  for (const key of [...Object.keys(afterFlat), ...Object.keys(beforeFlat)]) {
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    orderedKeys.push(key);
  }

  const changedEntries: AuditDiffEntry[] = [];
  const addedEntries: AuditDiffEntry[] = [];
  const removedEntries: AuditDiffEntry[] = [];
  const unchangedEntries: AuditDiffEntry[] = [];

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const key of orderedKeys) {
    const inBefore = Object.prototype.hasOwnProperty.call(beforeFlat, key);
    const inAfter = Object.prototype.hasOwnProperty.call(afterFlat, key);
    const beforeVal = inBefore ? beforeFlat[key] : undefined;
    const afterVal = inAfter ? afterFlat[key] : undefined;

    if (!inBefore && inAfter) {
      added.push(key);
      addedEntries.push({ key, kind: 'added', before: undefined, after: afterVal });
    } else if (inBefore && !inAfter) {
      removed.push(key);
      removedEntries.push({ key, kind: 'removed', before: beforeVal, after: undefined });
    } else if (!areAuditValuesEqual(beforeVal, afterVal)) {
      changed.push(key);
      changedEntries.push({ key, kind: 'changed', before: beforeVal, after: afterVal });
    } else {
      unchangedEntries.push({ key, kind: 'unchanged', before: beforeVal, after: afterVal });
    }
  }

  const entries = [...changedEntries, ...addedEntries, ...removedEntries, ...unchangedEntries];

  return {
    entries,
    added,
    removed,
    changed,
    unchangedCount: unchangedEntries.length,
    hasChanges: changed.length > 0 || added.length > 0 || removed.length > 0,
  };
}

/**
 * Escapes a single CSV cell per RFC 4180 while neutralizing Excel/Sheets formula injection.
 */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return '""';
  let str = typeof value === 'string' ? value : JSON.stringify(value);
  str = str.replace(/\0/g, '');
  const trimmed = str.trimStart();
  if (/^[=+\-@\t\r|%]/.test(str) || /^[=+\-@|%]/.test(trimmed)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildAuditCsv(entries: Array<Partial<AuditLogRecord> & Record<string, unknown>>): string {
  const headers = [
    'id',
    'created_at',
    'action_type',
    'actor_type',
    'actor_name',
    'actor_id',
    'target_table',
    'target_id',
    'changed_fields',
    'payload_before',
    'payload_after',
    'metadata',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const entry of entries) {
    const cleanBefore = redactAuditJsonString(entry.payload_before);
    const cleanAfter = redactAuditJsonString(entry.payload_after);
    const cleanMeta = redactAuditJsonString(entry.metadata);
    const diff = summarizeAuditDiff(cleanBefore, cleanAfter);
    const changedFields = [...diff.changed, ...diff.added, ...diff.removed].join(', ');

    const row = [
      entry.id ?? '',
      entry.created_at ?? '',
      entry.action_type ?? '',
      entry.actor_type ?? '',
      entry.actor_name ?? '',
      entry.actor_id ?? '',
      entry.target_table ?? '',
      entry.target_id ?? '',
      changedFields,
      cleanBefore ?? '',
      cleanAfter ?? '',
      cleanMeta ?? '',
    ];

    lines.push(row.map(escapeCsvCell).join(','));
  }

  return `\uFEFF${lines.join('\r\n')}`;
}
