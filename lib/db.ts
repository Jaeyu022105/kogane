/**
 * Unified DB abstraction.
 * Switch DB implementation depending on environment — all server code
 * must import from here, never from db-sqlite or db-supabase directly.
 */

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

// Lazily instantiate the adapter so it's only created server-side
let _adapter: DbAdapter | null = null;

async function getAdapter(): Promise<DbAdapter> {
  if (_adapter) return _adapter;

  const isDevMode = process.env.DEV_MODE === 'true' || (!process.env.SUPABASE_URL && !process.env.SUPABASE_ANON_KEY);

  if (isDevMode) {
    const { SqliteAdapter } = await import('./db-sqlite');
    _adapter = new SqliteAdapter();
  } else {
    const { SupabaseAdapter } = await import('./db-supabase');
    _adapter = new SupabaseAdapter();
  }

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
