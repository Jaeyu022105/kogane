/**
 * Backend selection — the one place that decides where Kogane keeps its data.
 *
 *   Local       SQLite (Bun) + uploads on local disk (`dev-storage/`)
 *   Production  Firebase: Cloud Firestore + uploads in Firestore blobs (Spark)
 *               or Cloud Storage (Blaze, when a bucket or GCP runtime is present)
 *
 * Everything else asks this module. Server code talks to `db` (lib/db.ts) and
 * `useStorage()` (lib/storage.ts) and never reads DB_PROVIDER, DEV_MODE or the
 * Firebase variables itself.
 *
 * This module must not import firebase-admin, so it stays cheap to load locally.
 */

import { Buffer } from 'node:buffer';

export type DbProvider = 'sqlite' | 'firebase';
export type StorageMode = 'local' | 'firestore' | 'cloud-storage';

// ── Firebase environment ────────────────────────────────────────────────────

/** FIREBASE_CONFIG is set automatically on Firebase App Hosting / Cloud Functions. */
export function parseFirebaseConfig(): { projectId?: string; storageBucket?: string } {
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { projectId?: string; storageBucket?: string };
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** FIREBASE_SERVICE_ACCOUNT_JSON accepts raw JSON or base64-encoded JSON. */
export function parseServiceAccountJson(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8');
  return JSON.parse(jsonText) as Record<string, string>;
}

function serviceAccountProjectId(): string | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;
  try {
    const projectId = parseServiceAccountJson(raw)?.project_id;
    return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function resolveFirebaseProjectId(explicitProjectId?: string): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID
    || explicitProjectId
    || serviceAccountProjectId()
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || parseFirebaseConfig().projectId
    || undefined
  );
}

/** The configured bucket, or the project's default `<project>.firebasestorage.app`. */
export function resolveFirebaseStorageBucket(explicitProjectId?: string): string | undefined {
  const explicitBucket = process.env.FIREBASE_STORAGE_BUCKET || parseFirebaseConfig().storageBucket;
  if (explicitBucket) return explicitBucket;
  const projectId = resolveFirebaseProjectId(explicitProjectId);
  return projectId ? `${projectId}.firebasestorage.app` : undefined;
}

/** True when the server has credentials (or a Google runtime) to reach Firebase. */
export function hasFirebaseCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
    || hasGoogleRuntime(),
  );
}

/** Running on Google infrastructure (App Hosting, Cloud Run, Functions), i.e. the Blaze plan. */
function hasGoogleRuntime(): boolean {
  return Boolean(
    process.env.FIREBASE_CONFIG?.trim()
    || process.env.GCLOUD_PROJECT?.trim()
    || process.env.GOOGLE_CLOUD_PROJECT?.trim(),
  );
}

// ── Selection ───────────────────────────────────────────────────────────────

function envFlag(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

/**
 * Which database to use:
 *   1. DB_PROVIDER, when set (`sqlite`, or `firebase` / `firestore`)
 *   2. DEV_MODE=true → SQLite
 *   3. Firebase credentials or FIREBASE_SPARK_MODE=true → Firebase
 *   4. otherwise SQLite
 */
export function getDbProvider(): DbProvider {
  const explicit = process.env.DB_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    if (explicit === 'sqlite') return 'sqlite';
    if (explicit === 'firebase' || explicit === 'firestore') return 'firebase';
    throw new Error(
      `DB_PROVIDER="${explicit}" is not supported. Use "sqlite" (local) or "firebase" (production), or leave it unset to detect automatically.`,
    );
  }

  if (envFlag('DEV_MODE')) return 'sqlite';
  if (hasFirebaseCredentials() || envFlag('FIREBASE_SPARK_MODE')) return 'firebase';
  return 'sqlite';
}

/** True when running on the local SQLite backend. */
export function isLocalBackend(): boolean {
  return getDbProvider() === 'sqlite';
}

/**
 * Where uploads go. Follows the database unless STORAGE_PROVIDER overrides it:
 *   SQLite                                              → local disk
 *   Firebase, FIREBASE_SPARK_MODE=true                  → Firestore blobs (≤ 700 KB each)
 *   Firebase with a bucket or a GCP runtime (Blaze)     → Cloud Storage
 *   DB_PROVIDER=firebase with neither (Spark)           → Firestore blobs
 *   Firebase detected from credentials alone            → Cloud Storage on the project's
 *                                                         default bucket (existing setups)
 */
export function getStorageMode(): StorageMode {
  const explicit = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (explicit === 'firestore') return 'firestore';
  if (explicit === 'firebase' || explicit === 'gcs') return 'cloud-storage';
  if (explicit === 'dev' || explicit === 'local') return 'local';

  if (getDbProvider() === 'sqlite') return 'local';

  if (envFlag('FIREBASE_SPARK_MODE')) return 'firestore';
  const hasBucket = Boolean(process.env.FIREBASE_STORAGE_BUCKET?.trim() || parseFirebaseConfig().storageBucket?.trim());
  if (hasBucket || hasGoogleRuntime()) return 'cloud-storage';

  const explicitFirebase = ['firebase', 'firestore'].includes(process.env.DB_PROVIDER?.trim().toLowerCase() ?? '');
  if (explicitFirebase) return 'firestore';
  return resolveFirebaseStorageBucket() ? 'cloud-storage' : 'firestore';
}
