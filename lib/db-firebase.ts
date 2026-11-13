/**
 * Cloud Firestore adapter implementing DbAdapter for Firebase hosting.
 * Translates the application's parameterized SQL & CRUD operations into
 * Firestore collection operations, including tenant-prefixed business tables,
 * schema metadata tracking (__schema_meta), joins, filtering, sorting, and pagination.
 */

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { DbAdapter, QueryResult, SingleResult } from './db';
import { getFirestoreDb } from './firebaseAdmin';
import { stripUnsafeControlChars } from './securityClient';

export interface FirestoreDocRecord {
  id: string;
  [key: string]: unknown;
}

export interface FirestoreStore {
  getAll(collectionName: string): Promise<FirestoreDocRecord[]>;
  getById(collectionName: string, id: string): Promise<FirestoreDocRecord | null>;
  set(collectionName: string, id: string, data: Record<string, unknown>): Promise<void>;
  update(collectionName: string, id: string, data: Record<string, unknown>): Promise<void>;
  delete(collectionName: string, id: string): Promise<void>;
  clearCollection(collectionName: string): Promise<void>;
}

/** Real Cloud Firestore store backed by firebase-admin. */
class RealFirestoreStore implements FirestoreStore {
  private firestore: Firestore;

  constructor(firestore?: Firestore) {
    this.firestore = firestore ?? getFirestoreDb();
  }

  async getAll(collectionName: string): Promise<FirestoreDocRecord[]> {
    const snap = await this.firestore.collection(collectionName).get();
    return snap.docs.map((doc) => ({
      ...doc.data(),
      id: String(doc.data().id ?? doc.id),
    }));
  }

  async getById(collectionName: string, id: string): Promise<FirestoreDocRecord | null> {
    const doc = await this.firestore.collection(collectionName).doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data() ?? {};
    return { ...data, id: String(data.id ?? doc.id) };
  }

  async set(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
    await this.firestore.collection(collectionName).doc(id).set({ ...data, id });
  }

  async update(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
    await this.firestore.collection(collectionName).doc(id).set(data, { merge: true });
  }

  async delete(collectionName: string, id: string): Promise<void> {
    await this.firestore.collection(collectionName).doc(id).delete();
  }

  async clearCollection(collectionName: string): Promise<void> {
    const snap = await this.firestore.collection(collectionName).get();
    if (snap.empty) return;
    const batch = this.firestore.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

/** In-memory Firestore store for isolated unit & integration testing. */
export class InMemoryFirestoreStore implements FirestoreStore {
  private collections = new Map<string, Map<string, FirestoreDocRecord>>();

  private ensureCol(name: string) {
    let col = this.collections.get(name);
    if (!col) {
      col = new Map();
      this.collections.set(name, col);
    }
    return col;
  }

  async getAll(collectionName: string): Promise<FirestoreDocRecord[]> {
    return Array.from(this.ensureCol(collectionName).values()).map((doc) => ({ ...doc }));
  }

  async getById(collectionName: string, id: string): Promise<FirestoreDocRecord | null> {
    const doc = this.ensureCol(collectionName).get(id);
    return doc ? { ...doc } : null;
  }

  async set(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
    this.ensureCol(collectionName).set(id, { ...data, id });
  }

  async update(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
    const col = this.ensureCol(collectionName);
    const existing = col.get(id) ?? { id };
    col.set(id, { ...existing, ...data, id });
  }

  async delete(collectionName: string, id: string): Promise<void> {
    this.ensureCol(collectionName).delete(id);
  }

  async clearCollection(collectionName: string): Promise<void> {
    this.collections.delete(collectionName);
  }
}

const SCHEMA_META_COLLECTION = '__schema_meta';
const PLATFORM_COLLECTIONS = new Set([
  'users',
  'sessions',
  'businesses',
  'terminals',
  'presets',
  'audit_log',
  '__storage_blobs',
  SCHEMA_META_COLLECTION,
]);

function stripQuotes(identifier: string): string {
  return identifier.trim().replace(/^["`']+|["`']+$/g, '');
}

function normalizeCollectionFromSql(rawTable: string): string {
  const cleaned = rawTable.trim();
  // Convert "schema"."table" -> schema_table
  const schemaMatch = cleaned.match(/^"([^"]+)"\."([^"]+)"$/);
  if (schemaMatch) {
    return `${schemaMatch[1]}_${schemaMatch[2]}`;
  }
  return stripQuotes(cleaned);
}

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && input[i - 1] !== '\\') {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }
    if (!inSingleQuote) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitTopLevelAnd(clause: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let i = 0;

  while (i < clause.length) {
    const ch = clause[i];
    if (ch === "'" && clause[i - 1] !== '\\') {
      inSingleQuote = !inSingleQuote;
      current += ch;
      i++;
      continue;
    }

    if (!inSingleQuote) {
      const rest = clause.slice(i);
      const andMatch = rest.match(/^\s+AND\s+/i);
      if (andMatch) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        i += andMatch[0].length;
        continue;
      }
    }

    current += ch;
    i++;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSqlLiteral(raw: string): unknown {
  const trimmed = raw.trim();
  if (/^NULL$/i.test(trimmed)) return null;
  if (/^TRUE$/i.test(trimmed)) return true;
  if (/^FALSE$/i.test(trimmed)) return false;
  if (/^'[\s\S]*'$/.test(trimmed)) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function compareValues(a: unknown, b: unknown, caseInsensitive = false): number {
  if (a === b) return 0;
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  const strA = caseInsensitive ? String(a).toLowerCase() : String(a);
  const strB = caseInsensitive ? String(b).toLowerCase() : String(b);
  if (strA < strB) return -1;
  if (strA > strB) return 1;
  return 0;
}

function matchesLike(value: unknown, pattern: string): boolean {
  if (value == null) return false;
  // Iterative two-pointer SQL LIKE matcher (case-insensitive, immune to ReDoS)
  const s = String(value).toLowerCase();
  const p = String(pattern).toLowerCase();
  let si = 0;
  let pi = 0;
  let starIdx = -1;
  let matchIdx = 0;

  while (si < s.length) {
    if (pi < p.length && (p[pi] === '_' || p[pi] === s[si])) {
      si++;
      pi++;
    } else if (pi < p.length && p[pi] === '%') {
      starIdx = pi;
      matchIdx = si;
      pi++;
    } else if (starIdx !== -1) {
      pi = starIdx + 1;
      matchIdx++;
      si = matchIdx;
    } else {
      return false;
    }
  }

  while (pi < p.length && p[pi] === '%') {
    pi++;
  }

  return pi === p.length;
}

function extractSchemaAndShortName(fullTableName: string): { schemaName: string | null; shortName: string } {
  const parts = fullTableName.split('_');
  if (parts.length >= 3 && (parts[0] === 'biz' || parts[0] === 'tenant')) {
    return {
      schemaName: `${parts[0]}_${parts[1]}`,
      shortName: parts.slice(2).join('_'),
    };
  }
  return { schemaName: null, shortName: fullTableName };
}

function sanitizeFirestoreValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    return stripUnsafeControlChars(value, true);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    if (depth >= 10) return [];
    return value.map((v) => sanitizeFirestoreValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= 10) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      const cleanKey = stripUnsafeControlChars(k, false);
      if (cleanKey) {
        out[cleanKey] = sanitizeFirestoreValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export class FirestoreAdapter implements DbAdapter {
  private store: FirestoreStore;

  constructor(store?: FirestoreStore) {
    this.store = store ?? new RealFirestoreStore();
  }

  private async resolveSchemaAndShortName(
    fullTableName: string,
  ): Promise<{ schemaName: string | null; shortName: string }> {
    const businesses = await this.store.getAll('businesses');
    let matchedSchema: string | null = null;
    for (const biz of businesses) {
      const candidate = typeof biz.schema_name === 'string' ? biz.schema_name : '';
      if (candidate && fullTableName.startsWith(`${candidate}_`)) {
        if (!matchedSchema || candidate.length > matchedSchema.length) {
          matchedSchema = candidate;
        }
      }
    }
    if (matchedSchema) {
      return {
        schemaName: matchedSchema,
        shortName: fullTableName.slice(matchedSchema.length + 1),
      };
    }
    return extractSchemaAndShortName(fullTableName);
  }

  private createParamReader(params: unknown[]) {
    let cursor = 0;
    return (token: string): unknown => {
      const trimmed = token.trim();
      if (trimmed === '?') {
        const val = params[cursor];
        cursor++;
        return val;
      }
      const pgMatch = trimmed.match(/^\$(\d+)$/);
      if (pgMatch) {
        const idx = Number.parseInt(pgMatch[1], 10) - 1;
        return params[idx];
      }
      return parseSqlLiteral(trimmed);
    };
  }

  private evaluateWhereRows(
    rows: FirestoreDocRecord[],
    whereSql: string | undefined,
    readParam: (token: string) => unknown,
  ): FirestoreDocRecord[] {
    if (!whereSql || !whereSql.trim()) return rows;

    const conditions = splitTopLevelAnd(whereSql);
    const evaluators: Array<(row: FirestoreDocRecord) => boolean> = [];

    for (const cond of conditions) {
      const trimmed = cond.trim();

      // datetime("col") >= datetime(?)
      const dtMatch = trimmed.match(
        /^datetime\(\s*([^)]+)\s*\)\s*(>=|<=|>|<|=)\s*datetime\(\s*(\?|\$\d+|'[^']*')\s*\)$/i,
      );
      if (dtMatch) {
        const colName = stripQuotes(dtMatch[1]);
        const op = dtMatch[2];
        const targetRaw = readParam(dtMatch[3]);
        const targetMs = new Date(String(targetRaw ?? '')).getTime();
        evaluators.push((row) => {
          const valMs = new Date(String(row[colName] ?? '')).getTime();
          if (Number.isNaN(valMs) || Number.isNaN(targetMs)) return false;
          if (op === '>=') return valMs >= targetMs;
          if (op === '<=') return valMs <= targetMs;
          if (op === '>') return valMs > targetMs;
          if (op === '<') return valMs < targetMs;
          return valMs === targetMs;
        });
        continue;
      }

      // col IS NULL / IS NOT NULL
      const nullMatch = trimmed.match(/^([a-zA-Z0-9_."`]+)\s+IS\s+(NOT\s+)?NULL$/i);
      if (nullMatch) {
        const rawCol = nullMatch[1];
        const colName = stripQuotes(rawCol.includes('.') ? rawCol.split('.').pop()! : rawCol);
        const isNotNull = Boolean(nullMatch[2]);
        evaluators.push((row) => (isNotNull ? row[colName] != null : row[colName] == null));
        continue;
      }

      // col [NOT] IN (...)
      const inMatch = trimmed.match(/^([a-zA-Z0-9_."`]+)\s+(NOT\s+)?IN\s*\(([\s\S]+)\)$/i);
      if (inMatch) {
        const rawCol = inMatch[1];
        const colKey = rawCol.includes('.') ? rawCol : stripQuotes(rawCol);
        const shortCol = stripQuotes(rawCol.includes('.') ? rawCol.split('.').pop()! : rawCol);
        const isNotIn = Boolean(inMatch[2]);
        const itemTokens = splitTopLevelCommas(inMatch[3]);
        const targetValues = itemTokens.map((tok) => readParam(tok));

        evaluators.push((row) => {
          const actual = colKey in row ? row[colKey] : row[shortCol];
          if (actual == null) return false;
          const found = targetValues.some((target) => compareValues(actual, target, false) === 0);
          return isNotIn ? !found : found;
        });
        continue;
      }

      // col LIKE ?
      const likeMatch = trimmed.match(/^([a-zA-Z0-9_."`]+)\s+LIKE\s+(\?|\$\d+|'[^']*')$/i);
      if (likeMatch) {
        const rawCol = likeMatch[1];
        const colName = stripQuotes(rawCol.includes('.') ? rawCol.split('.').pop()! : rawCol);
        const pattern = String(readParam(likeMatch[2]) ?? '');
        evaluators.push((row) => matchesLike(row[colName], pattern));
        continue;
      }

      // col OP val [COLLATE NOCASE]
      const cmpMatch = trimmed.match(
        /^([a-zA-Z0-9_."`]+)\s*(=|!=|<>|>=|<=|>|<)\s*(\?|\$\d+|'[^']*'|\d+(?:\.\d+)?|NULL|TRUE|FALSE)(?:\s+COLLATE\s+NOCASE)?$/i,
      );
      if (cmpMatch) {
        const rawCol = cmpMatch[1];
        const isNocase = /COLLATE\s+NOCASE/i.test(trimmed);
        const colKey = rawCol.includes('.') ? rawCol : stripQuotes(rawCol);
        const shortCol = stripQuotes(rawCol.includes('.') ? rawCol.split('.').pop()! : rawCol);
        const op = cmpMatch[2];
        const expected = readParam(cmpMatch[3]);

        evaluators.push((row) => {
          const actual = colKey in row ? row[colKey] : row[shortCol];
          const cmp = compareValues(actual, expected, isNocase);
          if (op === '=') return cmp === 0;
          if (op === '!=' || op === '<>') return cmp !== 0;
          if (op === '>=') return cmp >= 0;
          if (op === '<=') return cmp <= 0;
          if (op === '>') return cmp > 0;
          if (op === '<') return cmp < 0;
          return false;
        });
        continue;
      }
    }

    return rows.filter((row) => evaluators.every((fn) => fn(row)));
  }

  private async handleMetaQuery<T>(sql: string, params: unknown[]): Promise<QueryResult<T> | null> {
    const trimmed = sql.trim();

    // PRAGMA table_info(table)
    const pragmaMatch = trimmed.match(/^PRAGMA\s+table_info\(([^)]+)\)/i);
    if (pragmaMatch) {
      const tableName = normalizeCollectionFromSql(pragmaMatch[1]);
      const meta = await this.store.getById(SCHEMA_META_COLLECTION, tableName);
      if (meta && Array.isArray(meta.columns)) {
        const cols = (meta.columns as Array<{ name: string; type: string; nullable?: boolean }>).map((c) => ({
          name: c.name,
          type: c.type?.toUpperCase() || 'TEXT',
          notnull: c.nullable === false ? 1 : 0,
        }));
        return { data: cols as unknown as T[], error: null };
      }

      // Fallback: infer columns from first existing document
      const docs = await this.store.getAll(tableName);
      if (docs.length > 0) {
        const keys = new Set<string>();
        for (const doc of docs) {
          for (const k of Object.keys(doc)) keys.add(k);
        }
        const cols = Array.from(keys).map((name) => ({
          name,
          type: typeof docs[0][name] === 'number' ? 'REAL' : 'TEXT',
          notnull: 0,
        }));
        return { data: cols as unknown as T[], error: null };
      }

      return { data: [] as unknown as T[], error: null };
    }

    // sqlite_master table listing
    if (/FROM\s+sqlite_master/i.test(trimmed)) {
      const pattern = String(params[0] ?? '').replace(/%$/, '');
      const metas = await this.store.getAll(SCHEMA_META_COLLECTION);
      const matching = metas
        .filter((m) => String(m.table_name ?? m.id).startsWith(pattern))
        .sort((a, b) => String(a.table_name ?? a.id).localeCompare(String(b.table_name ?? b.id)))
        .map((m) => ({ name: String(m.table_name ?? m.id) }));
      return { data: matching as unknown as T[], error: null };
    }

    // information_schema.tables
    if (/FROM\s+information_schema\.tables/i.test(trimmed)) {
      const schemaName = String(params[0] ?? '');
      const metas = await this.store.getAll(SCHEMA_META_COLLECTION);
      const matching = metas
        .filter((m) => m.schema_name === schemaName || String(m.id).startsWith(`${schemaName}_`))
        .sort((a, b) => String(a.short_name ?? '').localeCompare(String(b.short_name ?? '')))
        .map((m) => ({
          table_name: String(m.short_name ?? extractSchemaAndShortName(String(m.id)).shortName),
        }));
      return { data: matching as unknown as T[], error: null };
    }

    // information_schema.columns
    if (/FROM\s+information_schema\.columns/i.test(trimmed)) {
      const schemaName = String(params[0] ?? '');
      const shortTable = String(params[1] ?? '');
      const fullName = `${schemaName}_${shortTable}`;
      const meta = await this.store.getById(SCHEMA_META_COLLECTION, fullName);
      const cols = Array.isArray(meta?.columns)
        ? (meta!.columns as Array<{ name: string; type: string; nullable?: boolean }>).map((c) => ({
            column_name: c.name,
            data_type: c.type || 'text',
            is_nullable: c.nullable === false ? 'NO' : 'YES',
          }))
        : [];
      return { data: cols as unknown as T[], error: null };
    }

    return null;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    try {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      const metaResult = await this.handleMetaQuery<T>(normalizedSql, params);
      if (metaResult) return metaResult;

      // Handle INSERT ... RETURNING *
      const insertMatch = normalizedSql.match(
        /^INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(?:\s+RETURNING\s+\*)?$/i,
      );
      if (insertMatch) {
        const table = normalizeCollectionFromSql(insertMatch[1]);
        const cols = insertMatch[2].split(',').map((c) => stripQuotes(c));
        const valTokens = splitTopLevelCommas(insertMatch[3]);
        const readParam = this.createParamReader(params);
        const doc: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
          doc[cols[i]] = readParam(valTokens[i] ?? 'NULL');
        }
        const inserted = await this.insert<T>(table, doc);
        return { data: inserted.data ? [inserted.data] : [], error: inserted.error };
      }

      // Handle UPDATE ... SET ... WHERE ... [RETURNING *]
      const updateMatch = normalizedSql.match(
        /^UPDATE\s+([^\s]+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?)(?:\s+RETURNING\s+\*)?$/i,
      );
      if (updateMatch) {
        const table = normalizeCollectionFromSql(updateMatch[1]);
        const setParts = splitTopLevelCommas(updateMatch[2]);
        const whereSql = updateMatch[3];
        const readParam = this.createParamReader(params);

        const updates: Record<string, unknown> = {};
        for (const part of setParts) {
          const eqIdx = part.indexOf('=');
          if (eqIdx === -1) continue;
          const col = stripQuotes(part.slice(0, eqIdx));
          const valToken = part.slice(eqIdx + 1).trim();
          updates[col] = readParam(valToken);
        }

        const allRows = await this.store.getAll(table);
        const matched = this.evaluateWhereRows(allRows, whereSql, readParam);
        const updatedRows: FirestoreDocRecord[] = [];
        for (const row of matched) {
          await this.store.update(table, row.id, updates);
          updatedRows.push({ ...row, ...updates });
        }
        return { data: updatedRows as unknown as T[], error: null };
      }

      // Handle DELETE FROM ... WHERE ... [RETURNING *]
      const deleteMatch = normalizedSql.match(
        /^DELETE\s+FROM\s+([^\s]+)\s+WHERE\s+([\s\S]+?)(?:\s+RETURNING\s+\*)?$/i,
      );
      if (deleteMatch) {
        const table = normalizeCollectionFromSql(deleteMatch[1]);
        const whereSql = deleteMatch[2];
        const readParam = this.createParamReader(params);
        const allRows = await this.store.getAll(table);
        const matched = this.evaluateWhereRows(allRows, whereSql, readParam);
        for (const row of matched) {
          await this.store.delete(table, row.id);
        }
        return { data: matched as unknown as T[], error: null };
      }

      // Handle SELECT ... FROM ... [JOIN ...] [WHERE ...] [ORDER BY ...] [LIMIT ...] [OFFSET ...]
      const selectMatch = normalizedSql.match(
        /^SELECT\s+([\s\S]+?)\s+FROM\s+([^\s]+)(?:\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?(?:\s+JOIN\s+([^\s]+)(?:\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?\s+ON\s+([^\s=]+)\s*=\s*([^\s]+))?(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\?|\$\d+|\d+))?(?:\s+OFFSET\s+(\?|\$\d+|\d+))?$/i,
      );
      if (!selectMatch) {
        return { data: null, error: `Unsupported SQL query in FirestoreAdapter: ${normalizedSql}` };
      }

      const [
        ,
        selectColsSql,
        rawFromTable,
        fromAliasRaw,
        rawJoinTable,
        joinAliasRaw,
        joinLeft,
        joinRight,
        whereSql,
        orderBySql,
        limitToken,
        offsetToken,
      ] = selectMatch;

      // Prevent keywords like WHERE/ORDER/LIMIT from being parsed as table alias
      const reservedAliases = new Set(['WHERE', 'ORDER', 'LIMIT', 'OFFSET', 'JOIN']);
      const fromAlias = fromAliasRaw && !reservedAliases.has(fromAliasRaw.toUpperCase())
        ? fromAliasRaw
        : undefined;
      const joinAlias = joinAliasRaw && !reservedAliases.has(joinAliasRaw.toUpperCase())
        ? joinAliasRaw
        : undefined;

      const mainTable = normalizeCollectionFromSql(rawFromTable);
      const idWhereMatch = !rawJoinTable && !/\?/.test(selectColsSql) && whereSql
        ? whereSql.trim().match(/^(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?["`]?id["`]?\s*=\s*(\?|\$\d+|'[^']*')$/i)
        : null;

      let rows: FirestoreDocRecord[];
      if (idWhereMatch) {
        const idToken = idWhereMatch[1].trim();
        const rawId = idToken === '?'
          ? params[0]
          : idToken.startsWith('$')
            ? params[Number.parseInt(idToken.slice(1), 10) - 1]
            : parseSqlLiteral(idToken);
        if (rawId != null && String(rawId) !== '') {
          const single = await this.store.getById(mainTable, String(rawId));
          rows = single ? [single] : [];
        } else {
          rows = [];
        }
      } else {
        rows = await this.store.getAll(mainTable);
      }

      // Perform inner join if requested (e.g. terminals JOIN businesses ON b.id = t.business_id)
      if (rawJoinTable && joinLeft && joinRight) {
        const joinTable = normalizeCollectionFromSql(rawJoinTable);
        const joinRows = await this.store.getAll(joinTable);

        const [leftPrefix, leftCol] = joinLeft.includes('.')
          ? joinLeft.split('.')
          : [fromAlias ?? mainTable, joinLeft];
        const [rightPrefix, rightCol] = joinRight.includes('.')
          ? joinRight.split('.')
          : [joinAlias ?? joinTable, joinRight];

        const mainUsesLeft = leftPrefix === fromAlias || leftPrefix === mainTable;
        const mainJoinCol = stripQuotes(mainUsesLeft ? leftCol : rightCol);
        const otherJoinCol = stripQuotes(mainUsesLeft ? rightCol : leftCol);

        const joinMap = new Map<string, FirestoreDocRecord>();
        for (const jr of joinRows) {
          const key = String(jr[otherJoinCol] ?? '');
          if (key) joinMap.set(key, jr);
        }

        const joined: FirestoreDocRecord[] = [];
        for (const r of rows) {
          const key = String(r[mainJoinCol] ?? '');
          const match = joinMap.get(key);
          if (!match) continue;

          const combined: FirestoreDocRecord = { ...r };
          const mainPrefix = fromAlias || mainTable;
          const otherPrefix = joinAlias || joinTable;
          for (const [k, v] of Object.entries(r)) {
            combined[`${mainPrefix}.${k}`] = v;
          }
          for (const [k, v] of Object.entries(match)) {
            combined[`${otherPrefix}.${k}`] = v;
            if (!(k in combined)) combined[k] = v;
          }
          joined.push(combined);
        }
        rows = joined;
      }

      const readParam = this.createParamReader(params);
      rows = this.evaluateWhereRows(rows, whereSql, readParam);

      // COUNT(*)
      const countMatch = selectColsSql.trim().match(/^COUNT\(\*\)(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?$/i);
      if (countMatch) {
        const alias = countMatch[1] || 'c';
        return { data: [{ [alias]: rows.length }] as unknown as T[], error: null };
      }

      // ORDER BY
      if (orderBySql) {
        const orderSpecs = splitTopLevelCommas(orderBySql).map((part) => {
          const tokens = part.trim().split(/\s+/);
          const colRaw = tokens[0];
          const col = stripQuotes(colRaw.includes('.') ? colRaw.split('.').pop()! : colRaw);
          const desc = tokens[1]?.toUpperCase() === 'DESC';
          return { col, desc };
        });

        rows.sort((a, b) => {
          for (const spec of orderSpecs) {
            const cmp = compareValues(a[spec.col], b[spec.col]);
            if (cmp !== 0) return spec.desc ? -cmp : cmp;
          }
          return 0;
        });
      }

      // OFFSET & LIMIT
      const limitVal = limitToken ? Number(readParam(limitToken)) : null;
      const offsetVal = offsetToken ? Number(readParam(offsetToken)) : 0;
      if (offsetVal > 0 || (limitVal != null && !Number.isNaN(limitVal))) {
        const start = Math.max(0, Number.isNaN(offsetVal) ? 0 : offsetVal);
        const end = limitVal != null && !Number.isNaN(limitVal) ? start + limitVal : undefined;
        rows = rows.slice(start, end);
      }

      // Column projection
      if (selectColsSql.trim() !== '*') {
        const colSpecs = splitTopLevelCommas(selectColsSql);
        rows = rows.map((row) => {
          const projected: Record<string, unknown> = {};
          for (const spec of colSpecs) {
            const asMatch = spec.match(/^([\s\S]+?)\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
            const expr = (asMatch ? asMatch[1] : spec).trim();
            const outKey = asMatch
              ? stripQuotes(asMatch[2])
              : stripQuotes(expr.includes('.') ? expr.split('.').pop()! : expr);

            if (expr === '*') {
              Object.assign(projected, row);
            } else if (expr in row) {
              projected[outKey] = row[expr];
            } else {
              const short = stripQuotes(expr.includes('.') ? expr.split('.').pop()! : expr);
              projected[outKey] = row[short] ?? null;
            }
          }
          return projected as FirestoreDocRecord;
        });
      } else {
        // Remove dotted join keys from SELECT *
        rows = rows.map((row) => {
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            if (!k.includes('.')) clean[k] = v;
          }
          return clean as FirestoreDocRecord;
        });
      }

      return { data: rows as unknown as T[], error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<SingleResult<T>> {
    const res = await this.query<T>(sql, params);
    return {
      data: res.data?.[0] ?? null,
      error: res.error,
    };
  }

  async insert<T = Record<string, unknown>>(
    table: string,
    values: Record<string, unknown>,
    schema?: string,
  ): Promise<SingleResult<T>> {
    try {
      const collectionName = schema ? `${schema}_${table}` : table;
      const id = values.id ? String(values.id) : randomUUID().replace(/-/g, '');
      const nowIso = new Date().toISOString();
      const rawDoc: Record<string, unknown> = {
        ...values,
        id,
        created_at: values.created_at ?? nowIso,
      };
      if (collectionName === 'users' && typeof rawDoc.email === 'string') {
        rawDoc.email = rawDoc.email.trim().toLowerCase();
      }
      const doc = sanitizeFirestoreValue(rawDoc) as Record<string, unknown>;
      await this.store.set(collectionName, id, doc);
      await this.ensureSchemaMetaFromDoc(collectionName, doc);
      return { data: doc as unknown as T, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  }

  async update(
    table: string,
    values: Record<string, unknown>,
    where: Record<string, unknown>,
    schema?: string,
  ): Promise<{ error: string | null }> {
    try {
      const collectionName = schema ? `${schema}_${table}` : table;
      const cleanValues = sanitizeFirestoreValue(values) as Record<string, unknown>;
      const whereKeys = Object.keys(where);
      if (whereKeys.length === 1 && whereKeys[0] === 'id' && where.id != null && String(where.id) !== '') {
        const existing = await this.store.getById(collectionName, String(where.id));
        if (existing) {
          await this.store.update(collectionName, existing.id, cleanValues);
        }
        return { error: null };
      }
      const allRows = await this.store.getAll(collectionName);
      const matching = allRows.filter((row) =>
        Object.entries(where).every(([k, v]) => compareValues(row[k], v) === 0),
      );
      for (const row of matching) {
        await this.store.update(collectionName, row.id, cleanValues);
      }
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async delete(
    table: string,
    where: Record<string, unknown>,
    schema?: string,
  ): Promise<{ error: string | null }> {
    try {
      const collectionName = schema ? `${schema}_${table}` : table;
      const whereKeys = Object.keys(where);
      if (whereKeys.length === 1 && whereKeys[0] === 'id' && where.id != null && String(where.id) !== '') {
        await this.store.delete(collectionName, String(where.id));
        return { error: null };
      }
      const allRows = await this.store.getAll(collectionName);
      const matching = allRows.filter((row) =>
        Object.entries(where).every(([k, v]) => compareValues(row[k], v) === 0),
      );
      for (const row of matching) {
        await this.store.delete(collectionName, row.id);
      }
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async execute(sql: string): Promise<{ error: string | null }> {
    try {
      const normalized = sql.replace(/\s+/g, ' ').trim();

      if (/^CREATE\s+SCHEMA/i.test(normalized)) {
        return { error: null };
      }

      // CREATE TABLE [IF NOT EXISTS] <tbl> (<cols>)
      const createMatch = normalized.match(
        /^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)\s*\(([\s\S]+)\)\s*;?$/i,
      );
      if (createMatch) {
        const fullName = normalizeCollectionFromSql(createMatch[1]);
        const colDefs = splitTopLevelCommas(createMatch[2]);
        const columns: Array<{ name: string; type: string; nullable: boolean }> = [];

        for (const def of colDefs) {
          if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(def)) continue;
          const tokens = def.trim().split(/\s+/);
          const colName = stripQuotes(tokens[0] ?? '');
          if (!colName) continue;
          const colType = (tokens[1] ?? 'text').toLowerCase();
          const nullable = !/NOT\s+NULL/i.test(def);
          columns.push({ name: colName, type: colType, nullable });
        }

        const { schemaName, shortName } = await this.resolveSchemaAndShortName(fullName);
        await this.store.set(SCHEMA_META_COLLECTION, fullName, {
          id: fullName,
          table_name: fullName,
          schema_name: schemaName,
          short_name: shortName,
          columns,
          updated_at: new Date().toISOString(),
        });
        return { error: null };
      }

      // ALTER TABLE <tbl> ADD COLUMN <col> <type> ...
      const alterMatch = normalized.match(
        /^ALTER\s+TABLE\s+([^\s]+)\s+ADD\s+(?:COLUMN\s+)?([^\s]+)\s+([^;]+);?$/i,
      );
      if (alterMatch) {
        const fullName = normalizeCollectionFromSql(alterMatch[1]);
        const colName = stripQuotes(alterMatch[2]);
        const rest = alterMatch[3].trim();
        const colType = (rest.split(/\s+/)[0] ?? 'text').toLowerCase();
        const nullable = !/NOT\s+NULL/i.test(rest);

        const existingMeta = await this.store.getById(SCHEMA_META_COLLECTION, fullName);
        const existingCols = Array.isArray(existingMeta?.columns)
          ? ([...(existingMeta!.columns as Array<{ name: string; type: string; nullable: boolean }>)] )
          : [];
        if (!existingCols.some((c) => c.name === colName)) {
          existingCols.push({ name: colName, type: colType, nullable });
        }

        const { schemaName, shortName } = await this.resolveSchemaAndShortName(fullName);
        await this.store.set(SCHEMA_META_COLLECTION, fullName, {
          id: fullName,
          table_name: fullName,
          schema_name: schemaName,
          short_name: shortName,
          columns: existingCols,
          updated_at: new Date().toISOString(),
        });
        return { error: null };
      }

      // DROP TABLE [IF EXISTS] <tbl>
      const dropMatch = normalized.match(/^DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+([^\s;]+);?$/i);
      if (dropMatch) {
        const fullName = normalizeCollectionFromSql(dropMatch[1]);
        await this.store.clearCollection(fullName);
        await this.store.delete(SCHEMA_META_COLLECTION, fullName);
        return { error: null };
      }

      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  private async ensureSchemaMetaFromDoc(collectionName: string, doc: Record<string, unknown>) {
    if (PLATFORM_COLLECTIONS.has(collectionName)) return;
    const { schemaName, shortName } = await this.resolveSchemaAndShortName(collectionName);
    if (!schemaName) return;
    const existing = await this.store.getById(SCHEMA_META_COLLECTION, collectionName);
    if (existing) return;

    const columns = Object.keys(doc).map((name) => ({
      name,
      type: typeof doc[name] === 'number' ? 'numeric' : 'text',
      nullable: name !== 'id',
    }));
    await this.store.set(SCHEMA_META_COLLECTION, collectionName, {
      id: collectionName,
      table_name: collectionName,
      schema_name: schemaName,
      short_name: shortName,
      columns,
      updated_at: new Date().toISOString(),
    });
  }
}
