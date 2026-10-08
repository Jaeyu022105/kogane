/**
 * scripts/restore-db.ts
 *
 * Restores Kogane database from a specified backup file.
 * Usage: bun run scripts/restore-db.ts <optional-path-to-backup-file>
 * If no path is provided, restores the latest backup from ./backups.
 */

import { existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'dev.db');
const BACKUPS_DIR = join(process.cwd(), 'backups');

const targetArg = process.argv[2];
let sourcePath = '';

if (targetArg) {
  sourcePath = targetArg.startsWith('.') ? join(process.cwd(), targetArg) : targetArg;
} else {
  if (!existsSync(BACKUPS_DIR)) {
    console.error('[ERROR] No backups directory found at ./backups');
    process.exit(1);
  }
  const files = readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith('kogane-backup-') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('[ERROR] No backup files found in ./backups');
    process.exit(1);
  }

  sourcePath = join(BACKUPS_DIR, files[0]);
}

if (!existsSync(sourcePath)) {
  console.error(`[ERROR] Backup file does not exist: ${sourcePath}`);
  process.exit(1);
}

// Create a safety snapshot of current DB before replacing
if (existsSync(DB_PATH)) {
  const safetyBackup = join(BACKUPS_DIR, `pre-restore-safety-${Date.now()}.db`);
  copyFileSync(DB_PATH, safetyBackup);
  console.log(`[!] Created safety snapshot of current DB at: ${safetyBackup}`);
}

try {
  copyFileSync(sourcePath, DB_PATH);
  const stats = statSync(DB_PATH);
  console.log('========================================================');
  console.log('  KOGANE RESTAURANT POS - DATABASE RESTORE COMPLETE');
  console.log('========================================================');
  console.log(`[+] Restored from: ${sourcePath}`);
  console.log(`[+] Database:     ${DB_PATH}`);
  console.log(`[+] Restored Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log('========================================================');
} catch (err: any) {
  console.error('[ERROR] Failed to restore database:', err?.message || err);
  process.exit(1);
}
