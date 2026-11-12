/**
 * Firebase Admin SDK singleton initialization.
 * Used exclusively server-side (Nitro API routes & Firebase Cloud Functions).
 * Supports:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON or base64-encoded JSON)
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 * 3. Application Default Credentials (automatic on Firebase App Hosting / Cloud Functions / Cloud Run)
 */

import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.DB_PROVIDER === 'firebase'
    || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
    || process.env.FIREBASE_CONFIG
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT,
  );
}

function parseServiceAccountJson(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8');
  return JSON.parse(jsonText) as Record<string, string>;
}

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

function parseServiceAccountProjectId(): string | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;
  try {
    const parsed = parseServiceAccountJson(raw);
    return typeof parsed?.project_id === 'string' && parsed.project_id.trim()
      ? parsed.project_id.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveFirebaseProjectId(explicitProjectId?: string): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID
    || explicitProjectId
    || parseServiceAccountProjectId()
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || parseFirebaseConfig().projectId
    || undefined
  );
}

export function resolveFirebaseStorageBucket(explicitProjectId?: string): string | undefined {
  const fbConfig = parseFirebaseConfig();
  const explicitBucket = process.env.FIREBASE_STORAGE_BUCKET || fbConfig.storageBucket;
  if (explicitBucket) return explicitBucket;
  const projectId = resolveFirebaseProjectId(explicitProjectId);
  return projectId ? `${projectId}.firebasestorage.app` : undefined;
}

export function getFirebaseApp(): App {
  if (cachedApp) return cachedApp;

  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0]!;
    return cachedApp;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const projectId = resolveFirebaseProjectId(serviceAccount.project_id);
    const storageBucket = resolveFirebaseStorageBucket(projectId);
    cachedApp = initializeApp({
      credential: cert(serviceAccount as any),
      projectId,
      storageBucket,
    });
    return cachedApp;
  }

  if (
    process.env.FIREBASE_PROJECT_ID
    && process.env.FIREBASE_CLIENT_EMAIL
    && process.env.FIREBASE_PRIVATE_KEY
  ) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const storageBucket = resolveFirebaseStorageBucket(projectId);
    cachedApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId,
      storageBucket,
    });
    return cachedApp;
  }

  const projectId = resolveFirebaseProjectId();
  const storageBucket = resolveFirebaseStorageBucket(projectId);
  cachedApp = initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
  });
  return cachedApp;
}

export function getFirestoreDb(): Firestore {
  if (cachedDb) return cachedDb;
  const app = getFirebaseApp();
  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() may throw if already called on this instance
  }
  cachedDb = db;
  return cachedDb;
}

export function getFirebaseStorage(): Storage {
  return getStorage(getFirebaseApp());
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
