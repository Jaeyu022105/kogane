/**
 * SQLite adapter for local development.
 * Uses bun:sqlite (built-in, sync API) wrapped in async to match the DbAdapter interface.
 * Schema mirrors Postgres using SQLite-compatible types.
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import type { DbAdapter, QueryResult, SingleResult } from './db';

const DB_PATH = join(process.cwd(), 'dev.db');

export class SqliteAdapter implements DbAdapter {
  private db: Database;

  constructor() {
    this.db = new Database(DB_PATH, { create: true });

    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");

    this._bootstrap();
  }

  /** Create platform tables on first run if they don't exist. */
  private _bootstrap() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS businesses (
        id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        admin_user_id TEXT NOT NULL,
        name          TEXT NOT NULL,
        logo_url      TEXT,
        color_palette TEXT DEFAULT '{}',
        schema_name   TEXT NOT NULL UNIQUE,
        created_at    TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS terminals (
        id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        auth_user_id  TEXT,
        display_name  TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'staff',
        pin_hash      TEXT NOT NULL,
        pin_length    INTEGER NOT NULL DEFAULT 4,
        permissions   TEXT DEFAULT '{}',
        ui_layout     TEXT DEFAULT '{}',
        created_at    TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS presets (
        id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name              TEXT NOT NULL,
        description       TEXT,
        schema_definition TEXT DEFAULT '{}',
        ui_layout         TEXT DEFAULT '{}',
        created_at        TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        business_id    TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        actor_id       TEXT,
        actor_type     TEXT NOT NULL,
        actor_name     TEXT NOT NULL,
        action_type    TEXT NOT NULL,
        target_table   TEXT,
        target_id      TEXT,
        payload_before TEXT,
        payload_after  TEXT,
        metadata       TEXT,
        created_at     TEXT DEFAULT (datetime('now'))
      )
    `);

    try {
      this.db.run("ALTER TABLE terminals ADD COLUMN pin_length INTEGER NOT NULL DEFAULT 4");
    } catch (e) { }

    try {
      this.db.run("ALTER TABLE terminals ADD COLUMN permissions TEXT DEFAULT '{}'");
    } catch (e) { }
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    try {
      const rows = this.db.query<T, unknown[]>(sql).all(...params);
      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<SingleResult<T>> {
    try {
      const row = this.db.query<T, unknown[]>(sql).get(...params) ?? null;
      return { data: row, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  }

  async insert<T>(table: string, values: Record<string, unknown>, schema?: string): Promise<SingleResult<T>> {
    try {
      const tbl = schema ? `${schema}_${table}` : table;
      const keys = Object.keys(values);
      const placeholders = keys.map(() => '?').join(', ');
      const cols = keys.join(', ');

      const row = this.db
        .query<T, unknown[]>(`INSERT INTO ${tbl} (${cols}) VALUES (${placeholders}) RETURNING *`)
        .get(...Object.values(values)) as T;

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

      this.db.query(`UPDATE ${tbl} SET ${setClause} WHERE ${whereClause}`).run(...params);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async delete(table: string, where: Record<string, unknown>, schema?: string): Promise<{ error: string | null }> {
    try {
      const tbl = schema ? `${schema}_${table}` : table;
      const whereClause = Object.keys(where).map(k => `${k} = ?`).join(' AND ');

      this.db.query(`DELETE FROM ${tbl} WHERE ${whereClause}`).run(...Object.values(where));
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async execute(sql: string): Promise<{ error: string | null }> {
    try {
      this.db.run(sql);
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
}
