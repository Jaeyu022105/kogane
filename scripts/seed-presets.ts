/**
 * scripts/seed-presets.ts
 * Seeds built-in preset templates into the dev.db database.
 * Run with: bun run scripts/seed-presets.ts
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const db = new Database(join(process.cwd(), 'dev.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ensure the presets table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS presets (
    id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name              TEXT NOT NULL,
    description       TEXT,
    schema_definition TEXT DEFAULT '{}',
    ui_layout         TEXT DEFAULT '{}',
    created_at        TEXT DEFAULT (datetime('now'))
  );
`);

const BUILT_IN_PRESETS = [
  {
    name: 'Café POS',
    description: 'Products, orders, and inventory tables for a café or restaurant.',
    schema_definition: JSON.stringify({
      tables: [
        {
          name: 'products',
          columns: [
            { name: 'name', type: 'text', nullable: false },
            { name: 'description', type: 'text', nullable: true },
            { name: 'price', type: 'numeric', nullable: false },
            { name: 'category', type: 'text', nullable: true },
            { name: 'available', type: 'boolean', nullable: false, default: '1' },
          ],
        },
        {
          name: 'orders',
          columns: [
            { name: 'items', type: 'text', nullable: false },
            { name: 'total', type: 'numeric', nullable: false },
            { name: 'status', type: 'text', nullable: false, default: "'pending'" },
            { name: 'staff_name', type: 'text', nullable: true },
          ],
        },
        {
          name: 'inventory',
          columns: [
            { name: 'item_name', type: 'text', nullable: false },
            { name: 'quantity', type: 'integer', nullable: false, default: '0' },
            { name: 'unit', type: 'text', nullable: true },
            { name: 'reorder_at', type: 'integer', nullable: true },
          ],
        },
      ],
    }),
  },
  {
    name: 'Inventory Tracker',
    description: 'Items, stock movements, and supplier tables.',
    schema_definition: JSON.stringify({
      tables: [
        {
          name: 'items',
          columns: [
            { name: 'sku', type: 'text', nullable: false, unique: true },
            { name: 'name', type: 'text', nullable: false },
            { name: 'category', type: 'text', nullable: true },
            { name: 'unit_cost', type: 'numeric', nullable: true },
            { name: 'quantity', type: 'integer', nullable: false, default: '0' },
          ],
        },
        {
          name: 'stock_movements',
          columns: [
            { name: 'item_id', type: 'text', nullable: false },
            { name: 'delta', type: 'integer', nullable: false },
            { name: 'reason', type: 'text', nullable: true },
            { name: 'moved_at', type: 'timestamptz', nullable: true },
          ],
        },
        {
          name: 'suppliers',
          columns: [
            { name: 'name', type: 'text', nullable: false },
            { name: 'contact', type: 'text', nullable: true },
            { name: 'email', type: 'text', nullable: true },
          ],
        },
      ],
    }),
  },
  {
    name: 'CRM',
    description: 'Contacts, companies, and interaction logs.',
    schema_definition: JSON.stringify({
      tables: [
        {
          name: 'companies',
          columns: [
            { name: 'name', type: 'text', nullable: false },
            { name: 'industry', type: 'text', nullable: true },
            { name: 'website', type: 'text', nullable: true },
          ],
        },
        {
          name: 'contacts',
          columns: [
            { name: 'first_name', type: 'text', nullable: false },
            { name: 'last_name', type: 'text', nullable: true },
            { name: 'email', type: 'text', nullable: true },
            { name: 'phone', type: 'text', nullable: true },
            { name: 'company_id', type: 'text', nullable: true },
          ],
        },
        {
          name: 'interactions',
          columns: [
            { name: 'contact_id', type: 'text', nullable: false },
            { name: 'type', type: 'text', nullable: false },
            { name: 'notes', type: 'text', nullable: true },
            { name: 'occurred_at', type: 'timestamptz', nullable: true },
          ],
        },
      ],
    }),
  },
];

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO presets (id, name, description, schema_definition)
  VALUES (lower(hex(randomblob(16))), ?, ?, ?)
`);

for (const preset of BUILT_IN_PRESETS) {
  insertStmt.run(preset.name, preset.description, preset.schema_definition);
}

console.log(`Seeded ${BUILT_IN_PRESETS.length} presets into dev.db`);
db.close();
