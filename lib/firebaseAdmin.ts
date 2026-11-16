/**
 * Firebase Admin SDK singleton initialization.
 * Used exclusively server-side (Nitro API routes & Firebase Cloud Functions).
 * Supports:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON or base64-encoded JSON)
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 * 3. Application Default Credentials (automatic on Firebase App Hosting / Cloud Functions / Cloud Run)
 */

import { createRequire } from 'node:module';
import type { App } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import { parseServiceAccountJson, resolveFirebaseProjectId, resolveFirebaseStorageBucket } from './backend';

const requireModule = createRequire(import.meta.url);

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseApp(): App {
  if (cachedApp) return cachedApp;

  const {
    cert,
    getApps,
    initializeApp,
    applicationDefault,
  } = requireModule('firebase-admin/app') as typeof import('firebase-admin/app');

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
  const { getFirestore } = requireModule('firebase-admin/firestore') as typeof import('firebase-admin/firestore');
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
  const { getStorage } = requireModule('firebase-admin/storage') as typeof import('firebase-admin/storage');
  return getStorage(getFirebaseApp());
}


