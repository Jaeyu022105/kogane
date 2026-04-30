/**
 * SQLite adapter for local development.
 * Uses better-sqlite3 (sync API) wrapped in async to match the DbAdapter interface.
 * Schema mirrors Postgres using SQLite-compatible types.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import type { DbAdapter, QueryResult, SingleResult } from './db';

const DB_PATH = join(process.cwd(), 'dev.db');

export class SqliteAdapter implements DbAdapter {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this._bootstrap();
  }

  /** Create platform tables on first run if they don't exist. */
  private _bootstrap() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS businesses (
        id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        admin_user_id TEXT NOT NULL,
        name          TEXT NOT NULL,
        logo_url      TEXT,
        color_palette TEXT DEFAULT '{}',
        schema_name   TEXT NOT NULL UNIQUE,
        created_at    TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inpoints (
        id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        auth_user_id  TEXT,
        display_name  TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'staff',
        pin_hash      TEXT NOT NULL,
        ui_layout     TEXT DEFAULT '{}',
        created_at    TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS presets (
        id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name              TEXT NOT NULL,
        description       TEXT,
        schema_definition TEXT DEFAULT '{}',
        ui_layout         TEXT DEFAULT '{}',
        created_at        TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as T[];
      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<SingleResult<T>> {
    try {
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params) as T | undefined;
      return { data: row ?? null, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  }

  async insert<T>(table: string, values: Record<string, unknown>, schema?: string): Promise<SingleResult<T>> {
    try {
      // SQLite has no schema namespace — prefix table name for scoped user tables
      const tbl = schema ? `${schema}_${table}` : table;
      const keys = Object.keys(values);
      const placeholders = keys.map(() => '?').join(', ');
      const cols = keys.join(', ');

      const stmt = this.db.prepare(
        `INSERT INTO ${tbl} (${cols}) VALUES (${placeholders}) RETURNING *`
      );
      const row = stmt.get(...Object.values(values)) as T;
      return { data: row, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  }

  async update(table: string, values: Record<string, unknown>, where: Record<string, unknown>, schema?: string): Promise<{ error: string | null }> {
    try {
      const tbl = schema ? `${schema}_${table}` : table;
      const setClause = Object.keys(values).map(k => `${k} = ?`).join(', ');
      const whereClause = Object.keys(where).map(k => `${k} = ?`).join(' AND ');
      const params = [...Object.values(values), ...Object.values(where)];

      this.db.prepare(`UPDATE ${tbl} SET ${setClause} WHERE ${whereClause}`).run(...params);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async delete(table: string, where: Record<string, unknown>, schema?: string): Promise<{ error: string | null }> {
    try {
      const tbl = schema ? `${schema}_${table}` : table;
      const whereClause = Object.keys(where).map(k => `${k} = ?`).join(' AND ');
      const params = Object.values(where);

      this.db.prepare(`DELETE FROM ${tbl} WHERE ${whereClause}`).run(...params);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async execute(sql: string): Promise<{ error: string | null }> {
    try {
      this.db.exec(sql);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
}
