/**
 * SQLite adapter for local development.
 * Uses bun:sqlite (built-in, sync API) wrapped in async to match the DbAdapter interface.
 * Schema mirrors Postgres using SQLite-compatible types.
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { DbAdapter, QueryResult, SingleResult } from './db';
import { hashPasswordSync } from './authUtils';

export function resolveSqliteDbPath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH;
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.replace(/^sqlite:\/\//, '');
  }
  const koganeDb = join(process.cwd(), 'kogane.db');
  if (existsSync(koganeDb)) {
    return koganeDb;
  }
  return join(process.cwd(), 'dev.db');
}
const DB_PATH = resolveSqliteDbPath();

export class SqliteAdapter implements DbAdapter {
  private db: Database;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath || DB_PATH, { create: true });

    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");

    this._bootstrap();
  }

  /** Create platform tables on first run if they don't exist. */
  private _bootstrap() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash       TEXT NOT NULL,
        full_name           TEXT,
        username            TEXT,
        profile_photo_url   TEXT,
        language_preference TEXT DEFAULT 'en',
        created_at          TEXT DEFAULT (datetime('now')),
        updated_at          TEXT DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS businesses (
        id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        admin_user_id TEXT NOT NULL,
        name          TEXT NOT NULL,
        logo_url      TEXT,
        color_palette TEXT DEFAULT '{}',
        country       TEXT DEFAULT 'US',
        currency      TEXT DEFAULT 'USD',
        currency_symbol TEXT DEFAULT '$',
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
        pin_code      TEXT,
        pin_length    INTEGER NOT NULL DEFAULT 4,
        permissions   TEXT DEFAULT '{}',
        ui_layout     TEXT DEFAULT '{}',
        is_public     INTEGER NOT NULL DEFAULT 0,
        public_slug   TEXT UNIQUE,
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
      this.db.run("ALTER TABLE terminals ADD COLUMN pin_code TEXT");
    } catch (e) { }

    try {
      this.db.run("ALTER TABLE terminals ADD COLUMN permissions TEXT DEFAULT '{}'");
    } catch (e) { }

    try {
      this.db.run("ALTER TABLE terminals ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
    } catch (e) { }

    try {
      this.db.run("ALTER TABLE terminals ADD COLUMN public_slug TEXT");
    } catch (e) { }

    try {
      this.db.run("ALTER TABLE businesses ADD COLUMN country TEXT DEFAULT 'US'");
    } catch (e) { }

    try {
      this.db.run("ALTER TABLE businesses ADD COLUMN currency TEXT DEFAULT 'USD'");
    } catch (e) { }

    try {
      this.db.run("ALTER TABLE businesses ADD COLUMN currency_symbol TEXT DEFAULT '$'");
    } catch (e) { }
    try {
      const existingUser = this.db.query("SELECT id FROM users WHERE email = 'admin@kogane.dev'").get();
      if (!existingUser) {
        const adminHash = hashPasswordSync('admin123');
        this.db.run(`
          INSERT INTO users (id, email, password_hash, full_name, username, language_preference)
          VALUES ('dev-admin', 'admin@kogane.dev', '${adminHash}', 'Restaurant Manager', 'admin', 'en')
        `);
      }
    } catch (e) { }

    try {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS biz_devadmin_products (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          category TEXT,
          available INTEGER NOT NULL DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      this.db.run(`
        CREATE TABLE IF NOT EXISTS biz_devadmin_orders (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          items TEXT NOT NULL,
          line_items TEXT,
          subtotal REAL,
          discount_type TEXT,
          discount_amount REAL,
          discount_label TEXT,
          discount_reference TEXT,
          total REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          table_number TEXT,
          staff_name TEXT,
          payment_method TEXT,
          payment_status TEXT,
          payment_reference TEXT,
          receipt_number TEXT,
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      this.db.run(`
        CREATE TABLE IF NOT EXISTS biz_devadmin_inventory (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          unit TEXT,
          reorder_at INTEGER,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
    } catch (e) { }

    try {
      const existingTerm = this.db.query("SELECT id FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'").get();
      if (!existingTerm) {
        let biz = this.db.query("SELECT id FROM businesses WHERE schema_name = 'biz_devadmin'").get() as { id: string } | null;
        if (!biz) {
          const bizId = 'biz_devadmin_id';
          this.db.run(`
            INSERT INTO businesses (id, admin_user_id, name, schema_name, country, currency, currency_symbol)
            VALUES ('${bizId}', 'dev-admin', 'Dev Store', 'biz_devadmin', 'US', 'USD', '$')
          `);
          biz = { id: bizId };
        }
        const defaultPinHash = createHash('sha256').update('1234').digest('hex');
        const defaultLayout = JSON.stringify({ version: 2, resolution: { width: 1280, height: 720 }, elements: [] });
        const defaultPerms = JSON.stringify({
          tables: {
            '*': { read: true, insert: true, update: true, delete: false },
            products: { read: true, insert: true, update: true, delete: true },
          },
          audit_log: { visible: false },
          reports: { visible: false },
        });
        this.db.run(`
          INSERT INTO terminals (id, business_id, display_name, role, pin_hash, pin_code, pin_length, permissions, ui_layout)
          VALUES (
            'd047d7294f03036a4f3fe94fa3be66d0',
            '${biz.id}',
            'Catalog Desk',
            'catalog-registrar',
            '${defaultPinHash}',
            '1234',
            4,
            '${defaultPerms}',
            '${defaultLayout}'
          )
        `);
      }
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
