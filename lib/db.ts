/**
 * Unified DB abstraction.
 * Switch DB implementation depending on environment — all server code
 * must import from here, never from db-sqlite, db-firebase, or db-supabase directly.
 */

import { isFirebaseConfigured } from './firebaseAdmin';

export type DbProvider = 'sqlite' | 'firebase' | 'supabase';

export type QueryResult<T = Record<string, unknown>> = {
  data: T[] | null;
  error: string | null;
};

export type SingleResult<T = Record<string, unknown>> = {
  data: T | null;
  error: string | null;
};

export interface DbAdapter {
  /** Run a SELECT query and return rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /** Run a SELECT that returns exactly one row. */
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<SingleResult<T>>;

  /** INSERT a row into a table. */
  insert<T = Record<string, unknown>>(table: string, values: Record<string, unknown>, schema?: string): Promise<SingleResult<T>>;

  /** UPDATE rows in a table. */
  update(table: string, values: Record<string, unknown>, where: Record<string, unknown>, schema?: string): Promise<{ error: string | null }>;

  /** DELETE rows from a table. */
  delete(table: string, where: Record<string, unknown>, schema?: string): Promise<{ error: string | null }>;

  /** Execute raw DDL (CREATE TABLE, ALTER, etc.) — for schema management only. */
  execute(sql: string): Promise<{ error: string | null }>;
}

/** Resolves the active database provider dynamically from environment configuration. */
export function getDbProvider(): DbProvider {
  const explicit = process.env.DB_PROVIDER?.trim().toLowerCase();
  if (explicit === 'firebase' || explicit === 'firestore') return 'firebase';
  if (explicit === 'supabase' || explicit === 'postgres') return 'supabase';
  if (explicit === 'sqlite') return 'sqlite';

  if (process.env.DEV_MODE === 'true') return 'sqlite';

  if (isFirebaseConfigured()) return 'firebase';

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) return 'supabase';

  return 'sqlite';
}

// Lazily instantiate the adapter so it's only created server-side
let _adapter: DbAdapter | null = null;
let _adapterProvider: DbProvider | null = null;

export function setDbAdapterForTest(adapter: DbAdapter | null, provider: DbProvider = 'firebase') {
  _adapter = adapter;
  _adapterProvider = adapter ? provider : null;
}

export function resetDbAdapter() {
  _adapter = null;
  _adapterProvider = null;
}

async function getAdapter(): Promise<DbAdapter> {
  const provider = getDbProvider();
  if (_adapter && _adapterProvider === provider) return _adapter;

  if (provider === 'firebase') {
    const { FirestoreAdapter } = await import('./db-firebase');
    _adapter = new FirestoreAdapter();
  } else if (provider === 'supabase') {
    const { SupabaseAdapter } = await import('./db-supabase');
    _adapter = new SupabaseAdapter();
  } else {
    const { SqliteAdapter } = await import('./db-sqlite');
    _adapter = new SqliteAdapter();
  }

  _adapterProvider = provider;
  return _adapter;
}

export const db = {
  query: async <T>(sql: string, params?: unknown[]) => (await getAdapter()).query<T>(sql, params),
  queryOne: async <T>(sql: string, params?: unknown[]) => (await getAdapter()).queryOne<T>(sql, params),
  insert: async <T>(table: string, values: Record<string, unknown>, schema?: string) => (await getAdapter()).insert<T>(table, values, schema),
  update: async (table: string, values: Record<string, unknown>, where: Record<string, unknown>, schema?: string) => (await getAdapter()).update(table, values, where, schema),
  delete: async (table: string, where: Record<string, unknown>, schema?: string) => (await getAdapter()).delete(table, where, schema),
  execute: async (sql: string) => (await getAdapter()).execute(sql),
};
