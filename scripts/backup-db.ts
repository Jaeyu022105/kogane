/**
 * scripts/backup-db.ts
 *
 * Daily backup utility for Kogane SQLite database.
 * Creates timestamped snapshots in the ./backups directory.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'dev.db');
const BACKUPS_DIR = join(process.cwd(), 'backups');
const MAX_BACKUPS_RETAINED = 30; // Keep 30 daily snapshots

if (!existsSync(DB_PATH)) {
  console.error(`[ERROR] Database file not found at: ${DB_PATH}`);
  process.exit(1);
}

if (!existsSync(BACKUPS_DIR)) {
  mkdirSync(BACKUPS_DIR, { recursive: true });
}

const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFileName = `kogane-backup-${timestamp}.db`;
const backupFilePath = join(BACKUPS_DIR, backupFileName);

try {
  copyFileSync(DB_PATH, backupFilePath);
  const stats = statSync(backupFilePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('========================================================');
  console.log('  KOGANE RESTAURANT POS - DATABASE BACKUP COMPLETE');
  console.log('========================================================');
  console.log(`[+] Backup File: ${backupFileName}`);
  console.log(`[+] Full Path:   ${backupFilePath}`);
  console.log(`[+] File Size:   ${sizeMb} MB (${stats.size} bytes)`);
  console.log(`[+] Timestamp:   ${now.toLocaleString()}`);

  // Auto-prune old backups past retention limit
  const backupFiles = readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith('kogane-backup-') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (backupFiles.length > MAX_BACKUPS_RETAINED) {
    const toPrune = backupFiles.slice(MAX_BACKUPS_RETAINED);
    for (const oldFile of toPrune) {
      unlinkSync(join(BACKUPS_DIR, oldFile));
      console.log(`[x] Pruned old backup: ${oldFile}`);
    }
  }

  console.log('========================================================');
} catch (err: any) {
  console.error('[ERROR] Failed to create database backup:', err?.message || err);
  process.exit(1);
}
