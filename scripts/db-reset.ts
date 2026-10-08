/**
 * scripts/db-reset.ts
 *
 * Clean database reset and initialization script for production/deployment:
 * - Wipes test orders, dummy transactions, and temporary test databases.
 * - Initializes platform schema: users, businesses, terminals, presets, audit_log.
 * - Seeds default admin account: admin@kogane.dev (password: admin123 or ADMIN_PASSWORD env).
 * - Provisions clean restaurant business: "Kogane Restaurant & Bar" (USD, $).
 * - Sets up 5 starter workstations with PIN 1234.
 * - Populates starter restaurant menu items & stock inventory.
 * - Keeps orders table at 0 rows (clean transaction ledger ready for day-one operations).
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hashPasswordSync } from '../lib/authUtils';
import { STARTER_BUSINESS_TABLES } from '../server/utils/starterTables';
import { BUILDER_PRESETS } from '../lib/builderPresets';
import { presetByKey, type PermissionPresetKey } from '../lib/permissions';
import { applyBrandingToLayout } from '../lib/workspaceBranding';
import { resolveSqliteDbPath } from '../lib/db-sqlite';

export const STARTER_WORKSTATIONS: Array<{
  id: string;
  displayName: string;
  role: string;
  presetKey: PermissionPresetKey;
  layoutPresetId: string;
  isPublic?: number;
  publicSlug?: string;
}> = [
  {
    id: 'd047d7294f03036a4f3fe94fa3be66d0',
    displayName: 'Menu Catalog',
    role: 'catalog-registrar',
    presetKey: 'catalog-registrar',
    layoutPresetId: 'catalog-station',
  },
  {
    id: 'cashier-register-001',
    displayName: 'Front Counter',
    role: 'cashier-register',
    presetKey: 'cashier-register',
    layoutPresetId: 'cashier-station',
  },
  {
    id: 'kitchen-display-001',
    displayName: 'Kitchen Queue',
    role: 'kitchen-display',
    presetKey: 'kitchen-display',
    layoutPresetId: 'kitchen-station',
  },
  {
    id: 'inventory-manager-001',
    displayName: 'Stock Room',
    role: 'inventory-manager',
    presetKey: 'inventory-manager',
    layoutPresetId: 'inventory-station',
  },
  {
    id: 'reports-viewer-001',
    displayName: 'Finance Console',
    role: 'reports-viewer',
    presetKey: 'reports-viewer',
    layoutPresetId: 'reports-station',
  },
];

export const SAMPLE_PRODUCTS = [
  { name: 'Espresso', price: 3.50, category: 'Coffee', description: 'Single origin rich espresso shot' },
  { name: 'Cold Brew', price: 4.75, category: 'Coffee', description: '18-hour slow-steeped smooth cold brew' },
  { name: 'Matcha Latte', price: 5.50, category: 'Tea', description: 'Ceremonial grade Uji matcha with oat milk' },
  { name: 'Artisan Croissant', price: 4.00, category: 'Bakery', description: 'Freshly baked flaky butter croissant' },
  { name: 'Margherita Pizza', price: 14.00, category: 'Mains', description: 'San Marzano tomatoes, fresh mozzarella, basil' },
  { name: 'Truffle Pasta', price: 18.50, category: 'Mains', description: 'Handmade tagliatelle with wild mushroom & black truffle' },
  { name: 'Caesar Salad', price: 11.00, category: 'Starters', description: 'Crisp romaine, shaved parmesan, garlic croutons' },
  { name: 'Sparkling Mineral Water', price: 3.00, category: 'Beverages', description: 'Chilled 500ml glass bottle' },
];

export const SAMPLE_INVENTORY = [
  { item_name: 'Espresso Beans', quantity: 35, unit: 'kg', reorder_at: 10 },
  { item_name: 'Oat Milk Barista', quantity: 24, unit: 'cartons', reorder_at: 8 },
  { item_name: 'Pizza Dough', quantity: 40, unit: 'portions', reorder_at: 15 },
  { item_name: 'Mozzarella Cheese', quantity: 20, unit: 'kg', reorder_at: 6 },
  { item_name: 'Truffle Oil', quantity: 8, unit: 'bottles', reorder_at: 3 },
  { item_name: 'To-Go Containers', quantity: 150, unit: 'units', reorder_at: 50 },
];

export interface InitDbOptions {
  dbPath?: string;
  forceReset?: boolean;
  silent?: boolean;
}

export function initializeDatabase(options: InitDbOptions = {}): {
  success: boolean;
  dbPath: string;
  workstationsSeeded: number;
  productsSeeded: number;
  adminEmail: string;
  isFresh: boolean;
} {
  const targetPath = options.dbPath || resolveSqliteDbPath();
  const silent = options.silent ?? false;
  const force = options.forceReset ?? false;

  const log = (...args: unknown[]) => {
    if (!silent) console.log(...args);
  };

  const fileExisted = existsSync(targetPath);
  const db = new Database(targetPath, { create: true });

  db.run('PRAGMA foreign_keys = OFF');
  db.run('PRAGMA journal_mode = WAL');

  if (force) {
    log('------------------------------------------------------------');
    log('  KOGANE RESTAURANT POS - DATABASE RESET & CLEAN INITIALIZATION');
    log('------------------------------------------------------------\n');

    // 1. Drop old test tables
    const existingTables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);

    for (const tableName of existingTables) {
      if (
        tableName.startsWith('test_') ||
        tableName.includes('_test_') ||
        tableName.startsWith('sqlite_')
      ) {
        if (!tableName.startsWith('sqlite_')) {
          log(`[x] Dropping legacy/test table: ${tableName}`);
          db.run(`DROP TABLE IF EXISTS "${tableName}"`);
        }
      }
    }
  }

  // 2. Ensure core platform tables
  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS businesses (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      admin_user_id   TEXT NOT NULL,
      name            TEXT NOT NULL,
      logo_url        TEXT,
      color_palette   TEXT DEFAULT '{}',
      country         TEXT DEFAULT 'US',
      currency        TEXT DEFAULT 'USD',
      currency_symbol TEXT DEFAULT '$',
      schema_name     TEXT NOT NULL UNIQUE,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS presets (
      id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name              TEXT NOT NULL,
      description       TEXT,
      schema_definition TEXT DEFAULT '{}',
      ui_layout         TEXT DEFAULT '{}',
      created_at        TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      business_id    TEXT NOT NULL,
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

  // Ensure terminal columns
  try { db.run("ALTER TABLE terminals ADD COLUMN pin_length INTEGER NOT NULL DEFAULT 4"); } catch {}
  try { db.run("ALTER TABLE terminals ADD COLUMN pin_code TEXT"); } catch {}
  try { db.run("ALTER TABLE terminals ADD COLUMN permissions TEXT DEFAULT '{}'"); } catch {}
  try { db.run("ALTER TABLE terminals ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE terminals ADD COLUMN public_slug TEXT"); } catch {}
  try { db.run("ALTER TABLE businesses ADD COLUMN country TEXT DEFAULT 'US'"); } catch {}
  try { db.run("ALTER TABLE businesses ADD COLUMN currency TEXT DEFAULT 'USD'"); } catch {}
  try { db.run("ALTER TABLE businesses ADD COLUMN currency_symbol TEXT DEFAULT '$'"); } catch {}

  // 3. Admin Account
  const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = hashPasswordSync(defaultPassword);

  const existingAdmin = db.query<{ id: string }, [string]>("SELECT id FROM users WHERE email = ?").get('admin@kogane.dev');
  if (force || !existingAdmin) {
    if (force) {
      db.run("DELETE FROM users WHERE email = 'admin@kogane.dev' OR id = 'dev-admin'");
    }
    db.run(`
      INSERT INTO users (id, email, password_hash, full_name, username, language_preference)
      VALUES ('dev-admin', 'admin@kogane.dev', ?, 'Restaurant Manager', 'admin', 'en')
    `, [passwordHash]);
    log('[+] Admin account ready: admin@kogane.dev (password: ' + defaultPassword + ')');
  }

  // 4. Default Business
  const bizId = 'biz_devadmin_id';
  const schemaName = 'biz_devadmin';
  const defaultPalette = JSON.stringify({
    primary: '#68293A',
    secondary: '#F6E6D7',
    accent: '#E65D75',
    background: '#FFFFFF',
    country: 'US',
    currency: 'USD',
    currencySymbol: '$',
  });

  const existingBiz = db.query<{ id: string }, [string]>("SELECT id FROM businesses WHERE id = ?").get(bizId);
  if (force || !existingBiz) {
    if (force) {
      db.run("DELETE FROM businesses WHERE id = ? OR schema_name = ?", [bizId, schemaName]);
    }
    db.run(`
      INSERT INTO businesses (id, admin_user_id, name, schema_name, country, currency, currency_symbol, color_palette)
      VALUES (?, 'dev-admin', 'Kogane Restaurant & Bar', ?, 'US', 'USD', '$', ?)
    `, [bizId, schemaName, defaultPalette]);
    log('[+] Business registered: Kogane Restaurant & Bar (biz_devadmin)');
  }

  // 5. Business Data Tables
  if (force) {
    db.run(`DROP TABLE IF EXISTS "${schemaName}_orders"`);
    db.run(`DROP TABLE IF EXISTS "${schemaName}_products"`);
    db.run(`DROP TABLE IF EXISTS "${schemaName}_inventory"`);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS "${schemaName}_products" (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL,
      category    TEXT,
      available   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS "${schemaName}_orders" (
      id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      items              TEXT NOT NULL,
      line_items         TEXT,
      subtotal           REAL,
      discount_type      TEXT,
      discount_amount    REAL,
      discount_label     TEXT,
      discount_reference TEXT,
      total              REAL NOT NULL,
      status             TEXT NOT NULL DEFAULT 'pending',
      table_number       TEXT,
      staff_name         TEXT,
      payment_method     TEXT,
      payment_status     TEXT,
      payment_reference  TEXT,
      receipt_number     TEXT,
      metadata           TEXT,
      created_at         TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS "${schemaName}_inventory" (
      id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      item_name  TEXT NOT NULL,
      quantity   INTEGER NOT NULL DEFAULT 0,
      unit       TEXT,
      reorder_at INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 6. Seed Starter Products
  const prodCount = db.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM "${schemaName}_products"`).get()?.count ?? 0;
  let productsSeeded = 0;
  if (force || prodCount === 0) {
    for (const p of SAMPLE_PRODUCTS) {
      db.run(`
        INSERT INTO "${schemaName}_products" (id, name, price, category, description, available)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 1)
      `, [p.name, p.price, p.category, p.description]);
      productsSeeded++;
    }
    log(`[+] Seeded ${productsSeeded} starter menu products.`);
  }

  // 7. Seed Starter Inventory
  const invCount = db.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM "${schemaName}_inventory"`).get()?.count ?? 0;
  if (force || invCount === 0) {
    for (const inv of SAMPLE_INVENTORY) {
      db.run(`
        INSERT INTO "${schemaName}_inventory" (id, item_name, quantity, unit, reorder_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
      `, [inv.item_name, inv.quantity, inv.unit, inv.reorder_at]);
    }
    log(`[+] Seeded ${SAMPLE_INVENTORY.length} inventory stock items.`);
  }

  // 8. Provision Starter Workstations
  const defaultPinCode = '1234';
  const defaultPinHash = createHash('sha256').update(defaultPinCode).digest('hex');

  if (force) {
    db.run('DELETE FROM terminals');
  }

  let workstationsSeeded = 0;
  for (const ws of STARTER_WORKSTATIONS) {
    const existing = db.query<{ id: string }, [string]>('SELECT id FROM terminals WHERE id = ?').get(ws.id);
    if (!existing) {
      const preset = presetByKey(ws.presetKey);
      const layoutSeed = BUILDER_PRESETS.find((p) => p.id === ws.layoutPresetId)?.layout ?? {
        version: 2,
        resolution: { width: 1280, height: 720 },
        elements: [],
      };
      const layoutData = applyBrandingToLayout(layoutSeed, JSON.parse(defaultPalette));
      const perms = JSON.stringify(preset?.permissions ?? {});

      db.run(`
        INSERT INTO terminals (id, business_id, display_name, role, pin_hash, pin_code, pin_length, permissions, ui_layout, is_public, public_slug)
        VALUES (?, ?, ?, ?, ?, ?, 4, ?, ?, 0, ?)
      `, [
        ws.id,
        bizId,
        ws.displayName,
        ws.role,
        defaultPinHash,
        defaultPinCode,
        perms,
        JSON.stringify(layoutData),
        ws.publicSlug || null,
      ]);
      workstationsSeeded++;
      log(`    - Station: "${ws.displayName}" (${ws.role}) - PIN: ${defaultPinCode}`);
    }
  }

  // 9. Reset Audit Log
  if (force) {
    db.run('DELETE FROM audit_log WHERE business_id = ?', [bizId]);
    db.run(`
      INSERT INTO audit_log (id, business_id, actor_id, actor_type, actor_name, action_type, metadata)
      VALUES (
        lower(hex(randomblob(16))),
        ?,
        'dev-admin',
        'system',
        'System Bootstrap',
        'db_reset',
        '{"message": "Clean database reset performed for deployment."}'
      )
    `, [bizId]);
  }

  db.run('PRAGMA foreign_keys = ON');
  if (force) {
    db.run('VACUUM');
  }

  if (force) {
    log('\n============================================================');
    log('  DATABASE RESET COMPLETE - READY FOR RESTAURANT ONBOARDING!');
    log('============================================================\n');
    log('Login credentials for counter & admin:');
    log('  URL:      http://localhost:3000/login');
    log(`  Email:    admin@kogane.dev`);
    log(`  Password: ${defaultPassword}`);
    log('Workstation PIN: 1234\n');
  }

  return {
    success: true,
    dbPath: targetPath,
    workstationsSeeded,
    productsSeeded,
    adminEmail: 'admin@kogane.dev',
    isFresh: !fileExisted || force,
  };
}

// Direct CLI execution
if (import.meta.main) {
  initializeDatabase({ forceReset: true });
}
