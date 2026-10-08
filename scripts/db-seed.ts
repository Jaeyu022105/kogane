/**
 * scripts/db-seed.ts
 *
 * Seeds starter restaurant products and inventory items if missing.
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'dev.db');
const db = new Database(DB_PATH, { create: true });

console.log('Seeding starter menu and inventory items...');

const biz = db.query<{ id: string; schema_name: string }, []>(
  "SELECT id, schema_name FROM businesses ORDER BY created_at ASC LIMIT 1",
).get();

if (!biz) {
  console.error('No business found. Please run "bun run db:reset" first.');
  process.exit(1);
}

const schemaName = biz.schema_name;

// Check existing products count
const productCount = db.query<{ count: number }, []>(
  `SELECT count(*) as count FROM "${schemaName}_products"`
).get()?.count ?? 0;

if (productCount === 0) {
  const sampleProducts = [
    { name: 'Espresso', price: 3.50, category: 'Coffee', description: 'Single origin rich espresso shot' },
    { name: 'Cold Brew', price: 4.75, category: 'Coffee', description: '18-hour slow-steeped smooth cold brew' },
    { name: 'Matcha Latte', price: 5.50, category: 'Tea', description: 'Ceremonial grade Uji matcha with oat milk' },
    { name: 'Artisan Croissant', price: 4.00, category: 'Bakery', description: 'Freshly baked flaky butter croissant' },
    { name: 'Margherita Pizza', price: 14.00, category: 'Mains', description: 'San Marzano tomatoes, fresh mozzarella, basil' },
    { name: 'Truffle Pasta', price: 18.50, category: 'Mains', description: 'Handmade tagliatelle with wild mushroom & black truffle' },
    { name: 'Caesar Salad', price: 11.00, category: 'Starters', description: 'Crisp romaine, shaved parmesan, garlic croutons' },
    { name: 'Sparkling Mineral Water', price: 3.00, category: 'Beverages', description: 'Chilled 500ml glass bottle' },
  ];

  for (const p of sampleProducts) {
    db.run(
      `INSERT INTO "${schemaName}_products" (id, name, price, category, description, available) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 1)`,
      [p.name, p.price, p.category, p.description]
    );
  }
  console.log(`[+] Seeded ${sampleProducts.length} starter menu products.`);
} else {
  console.log(`[*] Products table already has ${productCount} items. Skipping product seeding.`);
}

// Check existing inventory count
const invCount = db.query<{ count: number }, []>(
  `SELECT count(*) as count FROM "${schemaName}_inventory"`
).get()?.count ?? 0;

if (invCount === 0) {
  const sampleInventory = [
    { item_name: 'Espresso Beans', quantity: 35, unit: 'kg', reorder_at: 10 },
    { item_name: 'Oat Milk Barista', quantity: 24, unit: 'cartons', reorder_at: 8 },
    { item_name: 'Pizza Dough', quantity: 40, unit: 'portions', reorder_at: 15 },
    { item_name: 'Mozzarella Cheese', quantity: 20, unit: 'kg', reorder_at: 6 },
    { item_name: 'Truffle Oil', quantity: 8, unit: 'bottles', reorder_at: 3 },
    { item_name: 'To-Go Containers', quantity: 150, unit: 'units', reorder_at: 50 },
  ];

  for (const inv of sampleInventory) {
    db.run(
      `INSERT INTO "${schemaName}_inventory" (id, item_name, quantity, unit, reorder_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)`,
      [inv.item_name, inv.quantity, inv.unit, inv.reorder_at]
    );
  }
  console.log(`[+] Seeded ${sampleInventory.length} inventory stock items.`);
} else {
  console.log(`[*] Inventory table already has ${invCount} items. Skipping inventory seeding.`);
}

console.log('Seed completed successfully.');
