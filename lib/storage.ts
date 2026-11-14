import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { db, getDbProvider } from './db';

function parseFirebaseEnvConfig(): { projectId?: string; storageBucket?: string } {
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { projectId?: string; storageBucket?: string };
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseServiceAccountEnvProjectId(): string | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;
  try {
    const trimmed = raw.trim();
    const jsonText = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonText) as { project_id?: string };
    return typeof parsed?.project_id === 'string' && parsed.project_id.trim()
      ? parsed.project_id.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

function resolveFirebaseEnvProjectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID
    || parseServiceAccountEnvProjectId()
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || parseFirebaseEnvConfig().projectId
    || undefined
  );
}

function resolveFirebaseEnvStorageBucket(): string | undefined {
  const fbConfig = parseFirebaseEnvConfig();
  const explicitBucket = process.env.FIREBASE_STORAGE_BUCKET || fbConfig.storageBucket;
  if (explicitBucket) return explicitBucket;
  const projectId = resolveFirebaseEnvProjectId();
  return projectId ? `${projectId}.firebasestorage.app` : undefined;
}

export const FIRESTORE_STORAGE_COLLECTION = '__storage_blobs';
// 700 KB binary safely fits under Firestore's 1 MiB document limit after base64 expansion (~956 KB).
export const FIRESTORE_STORAGE_MAX_BYTES = 700 * 1024;

export interface StorageUploadInput {
  data: Uint8Array | ArrayBuffer | Buffer;
  contentType?: string;
  upsert?: boolean;
}

export interface StorageAdapter {
  upload(bucket: string, path: string, file: StorageUploadInput): Promise<string>;
  delete(bucket: string, path: string): Promise<void>;
  list(bucket: string, prefix?: string): Promise<string[]>;
  read(bucket: string, path: string): Promise<Buffer>;
}

const DEV_STORAGE_ROOT = resolve(process.cwd(), 'dev-storage');
const SAFE_PATH_RE = /^[A-Za-z0-9/_\-.]+$/;

export function sanitizeStoragePath(path: string): string {
  if (!path || !SAFE_PATH_RE.test(path) || path.includes('..') || path.includes('\\')) {
    throw new Error('Invalid storage path');
  }

  const normalized = path.replace(/^\/+/, '').replace(/\/+/g, '/');
  if (!normalized || normalized.split('/').some((seg) => seg === '.' || seg === '..')) {
    throw new Error('Invalid storage path');
  }
  return normalized;
}

function toBuffer(data: Uint8Array | ArrayBuffer | Buffer): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data);
}

function ensureInsideRoot(targetPath: string) {
  const rel = relative(DEV_STORAGE_ROOT, targetPath);
  if (rel.startsWith('..') || rel.startsWith('../') || rel.startsWith('..\\')) {
    throw new Error('Resolved path escapes dev storage root');
  }
}

function getDevFilePath(bucket: string, path: string) {
  const safeBucket = sanitizeStoragePath(bucket);
  const safePath = sanitizeStoragePath(path);
  const target = resolve(DEV_STORAGE_ROOT, safeBucket, safePath);
  ensureInsideRoot(target);
  return target;
}

class DevStorageAdapter implements StorageAdapter {
  async upload(bucket: string, path: string, file: StorageUploadInput): Promise<string> {
    const target = getDevFilePath(bucket, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, toBuffer(file.data));
    return `/api/dev/storage/${sanitizeStoragePath(bucket)}/${sanitizeStoragePath(path)}`;
  }

  async delete(bucket: string, path: string): Promise<void> {
    const target = getDevFilePath(bucket, path);
    await rm(target, { force: true });
  }

  async list(bucket: string, prefix = ''): Promise<string[]> {
    const safeBucket = sanitizeStoragePath(bucket);
    const safePrefix = prefix ? sanitizeStoragePath(prefix) : '';
    const baseDir = safePrefix
      ? getDevFilePath(safeBucket, safePrefix)
      : resolve(DEV_STORAGE_ROOT, safeBucket);
    ensureInsideRoot(baseDir);
    let stats;
    try {
      stats = await stat(baseDir);
    } catch {
      return [];
    }

    if (stats.isFile()) {
      return safePrefix ? [safePrefix] : [];
    }

    const entries = await readdir(baseDir, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      const childPrefix = [safePrefix.replace(/\/$/, ''), entry.name].filter(Boolean).join('/');
      if (entry.isDirectory()) {
        results.push(...await this.list(safeBucket, childPrefix));
      } else {
        results.push(sanitizeStoragePath(childPrefix));
      }
    }

    return results;
  }

  async read(bucket: string, path: string): Promise<Buffer> {
    const target = getDevFilePath(bucket, path);
    return readFile(target);
  }
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

class SupabaseStorageAdapter implements StorageAdapter {
  private client = getSupabaseClient();

  private async ensureBucket(bucket: string) {
    const { error } = await this.client.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: '10MB',
    });

    if (error && !/already exists/i.test(error.message)) {
      throw error;
    }
  }

  async upload(bucket: string, path: string, file: StorageUploadInput): Promise<string> {
    const safeBucket = sanitizeStoragePath(bucket);
    const safePath = sanitizeStoragePath(path);

    await this.ensureBucket(safeBucket);

    const { error } = await this.client.storage.from(safeBucket).upload(safePath, toBuffer(file.data), {
      upsert: file.upsert ?? true,
      contentType: file.contentType,
    });

    if (error) throw error;

    const signed = await this.client.storage.from(safeBucket).createSignedUrl(safePath, 60 * 60 * 24 * 365);
    if (signed.error || !signed.data?.signedUrl) {
      throw signed.error ?? new Error('Failed to generate signed URL');
    }

    return signed.data.signedUrl;
  }

  async delete(bucket: string, path: string): Promise<void> {
    const safeBucket = sanitizeStoragePath(bucket);
    const safePath = sanitizeStoragePath(path);
    const { error } = await this.client.storage.from(safeBucket).remove([safePath]);
    if (error) throw error;
  }

  async list(bucket: string, prefix = ''): Promise<string[]> {
    const safeBucket = sanitizeStoragePath(bucket);
    const safePrefix = prefix ? sanitizeStoragePath(prefix) : '';
    const { data, error } = await this.client.storage.from(safeBucket).list(safePrefix, {
      limit: 1000,
      offset: 0,
    });

    if (error) throw error;

    return (data ?? []).map((item) => [safePrefix, item.name].filter(Boolean).join('/'));
  }

  async read(bucket: string, path: string): Promise<Buffer> {
    const safeBucket = sanitizeStoragePath(bucket);
    const safePath = sanitizeStoragePath(path);
    const { data, error } = await this.client.storage.from(safeBucket).download(safePath);
    if (error || !data) throw error ?? new Error('File not found');
    return Buffer.from(await data.arrayBuffer());
  }
}

export class FirebaseStorageAdapter implements StorageAdapter {
  private getBucketName(): string {
    const bucket = resolveFirebaseEnvStorageBucket();
    if (!bucket) {
      throw new Error('Missing FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID');
    }
    return bucket;
  }

  private async getBucket() {
    const { getFirebaseStorage } = await import('./firebaseAdmin');
    return getFirebaseStorage().bucket(this.getBucketName());
  }

  private objectKey(bucket: string, path: string): string {
    return `${sanitizeStoragePath(bucket)}/${sanitizeStoragePath(path)}`;
  }

  async upload(bucket: string, path: string, file: StorageUploadInput): Promise<string> {
    const storageBucket = await this.getBucket();
    const key = this.objectKey(bucket, path);
    const gcsFile = storageBucket.file(key);
    await gcsFile.save(toBuffer(file.data), {
      resumable: false,
      metadata: {
        contentType: file.contentType || 'application/octet-stream',
      },
    });
    const [signedUrl] = await gcsFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365,
    });
    return signedUrl;
  }

  async delete(bucket: string, path: string): Promise<void> {
    const storageBucket = await this.getBucket();
    const key = this.objectKey(bucket, path);
    await storageBucket.file(key).delete({ ignoreNotFound: true });
  }

  async list(bucket: string, prefix = ''): Promise<string[]> {
    const storageBucket = await this.getBucket();
    const safeBucket = sanitizeStoragePath(bucket);
    const safePrefix = prefix ? sanitizeStoragePath(prefix) : '';
    const fullPrefix = safePrefix ? `${safeBucket}/${safePrefix}` : `${safeBucket}/`;
    const [files] = await storageBucket.getFiles({ prefix: fullPrefix });
    return files.map((f) => f.name.replace(`${safeBucket}/`, ''));
  }

  async read(bucket: string, path: string): Promise<Buffer> {
    const storageBucket = await this.getBucket();
    const key = this.objectKey(bucket, path);
    const [buffer] = await storageBucket.file(key).download();
    return buffer;
  }
}

export class FirestoreStorageAdapter implements StorageAdapter {
  private docId(safeBucket: string, safePath: string): string {
    return createHash('sha256').update(`${safeBucket}/${safePath}`).digest('hex');
  }

  private sanitizeObjectKey(bucket: string, path: string): { safeBucket: string; safePath: string } {
    const safeBucket = sanitizeStoragePath(bucket).replace(/\/+$/, '');
    const safePath = sanitizeStoragePath(path);
    if (!safeBucket || !safePath || safePath.endsWith('/')) {
      throw new Error('Invalid storage path');
    }
    return { safeBucket, safePath };
  }

  private async ensureCollectionReady(): Promise<void> {
    if (getDbProvider() === 'sqlite') {
      const res = await db.execute(
        `CREATE TABLE IF NOT EXISTS ${FIRESTORE_STORAGE_COLLECTION} (
          id TEXT PRIMARY KEY,
          bucket TEXT NOT NULL,
          path TEXT NOT NULL,
          content_type TEXT,
          size INTEGER,
          data_base64 TEXT NOT NULL,
          created_at TEXT,
          updated_at TEXT
        )`,
      );
      if (res.error) throw new Error(res.error);
    }
  }

  async upload(bucket: string, path: string, file: StorageUploadInput): Promise<string> {
    const { safeBucket, safePath } = this.sanitizeObjectKey(bucket, path);
    const buf = toBuffer(file.data);

    if (buf.length > FIRESTORE_STORAGE_MAX_BYTES) {
      throw new Error(
        `File size (${buf.length} bytes) exceeds Firestore Spark storage limit (${FIRESTORE_STORAGE_MAX_BYTES} bytes / 700 KB)`,
      );
    }

    await this.ensureCollectionReady();
    const id = this.docId(safeBucket, safePath);
    const nowIso = new Date().toISOString();
    const contentType = file.contentType || 'application/octet-stream';
    const dataBase64 = buf.toString('base64');

    const existing = await db.queryOne<{ id: string }>(
      `SELECT id FROM ${FIRESTORE_STORAGE_COLLECTION} WHERE id = ?`,
      [id],
    );
    if (existing.error) throw new Error(existing.error);

    if (existing.data) {
      if (file.upsert === false) {
        throw new Error(`Storage object already exists: ${safeBucket}/${safePath}`);
      }
      const upd = await db.update(
        FIRESTORE_STORAGE_COLLECTION,
        {
          bucket: safeBucket,
          path: safePath,
          content_type: contentType,
          size: buf.length,
          data_base64: dataBase64,
          updated_at: nowIso,
        },
        { id },
      );
      if (upd.error) throw new Error(upd.error);
    } else {
      const ins = await db.insert(FIRESTORE_STORAGE_COLLECTION, {
        id,
        bucket: safeBucket,
        path: safePath,
        content_type: contentType,
        size: buf.length,
        data_base64: dataBase64,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (ins.error) throw new Error(ins.error);
    }

    return `/api/storage/files/${safeBucket}/${safePath}`;
  }

  async delete(bucket: string, path: string): Promise<void> {
    const { safeBucket, safePath } = this.sanitizeObjectKey(bucket, path);
    await this.ensureCollectionReady();
    const res = await db.delete(FIRESTORE_STORAGE_COLLECTION, { id: this.docId(safeBucket, safePath) });
    if (res.error) throw new Error(res.error);
  }

  async list(bucket: string, prefix = ''): Promise<string[]> {
    const safeBucket = sanitizeStoragePath(bucket);
    const safePrefix = prefix ? sanitizeStoragePath(prefix) : '';
    await this.ensureCollectionReady();
    const res = await db.query<{ path?: string }>(
      `SELECT path FROM ${FIRESTORE_STORAGE_COLLECTION} WHERE bucket = ?`,
      [safeBucket],
    );
    if (res.error) throw new Error(res.error);

    const paths = (res.data ?? [])
      .map((row) => (typeof row.path === 'string' ? row.path : ''))
      .filter(Boolean);

    const filtered = safePrefix ? paths.filter((p) => p.startsWith(safePrefix)) : paths;
    return filtered.sort();
  }

  async read(bucket: string, path: string): Promise<Buffer> {
    const { safeBucket, safePath } = this.sanitizeObjectKey(bucket, path);
    await this.ensureCollectionReady();
    const res = await db.queryOne<{ data_base64?: string }>(
      `SELECT data_base64 FROM ${FIRESTORE_STORAGE_COLLECTION} WHERE id = ?`,
      [this.docId(safeBucket, safePath)],
    );
    if (res.error) throw new Error(res.error);
    if (!res.data || typeof res.data.data_base64 !== 'string') {
      throw new Error(`File not found: ${safeBucket}/${safePath}`);
    }
    return Buffer.from(res.data.data_base64, 'base64');
  }
}

let adapter: StorageAdapter | null = null;
let adapterMode: string | null = null;

export function useStorage(): StorageAdapter {
  const explicitStorageProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  const sparkMode = process.env.FIREBASE_SPARK_MODE === 'true';
  const isDevMode = process.env.DEV_MODE === 'true';
  const explicitDbProvider = process.env.DB_PROVIDER?.trim().toLowerCase();
  const fbConfig = parseFirebaseEnvConfig();
  const hasExplicitBucket = Boolean(process.env.FIREBASE_STORAGE_BUCKET?.trim() || fbConfig.storageBucket?.trim());
  const hasGcpBlazeRuntime = Boolean(
    process.env.GCLOUD_PROJECT?.trim()
    || process.env.GOOGLE_CLOUD_PROJECT?.trim()
    || process.env.FIREBASE_CONFIG?.trim(),
  );
  const hasFirebaseProjectOrBucket = Boolean(resolveFirebaseEnvStorageBucket());
  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

  let mode: 'firestore' | 'firebase' | 'supabase' | 'dev';

  if (explicitStorageProvider === 'firestore') {
    mode = 'firestore';
  } else if (explicitStorageProvider === 'firebase' || explicitStorageProvider === 'gcs') {
    mode = 'firebase';
  } else if (explicitStorageProvider === 'supabase') {
    mode = 'supabase';
  } else if (explicitStorageProvider === 'dev' || explicitStorageProvider === 'local') {
    mode = 'dev';
  } else if (sparkMode && explicitDbProvider !== 'sqlite' && explicitDbProvider !== 'supabase') {
    mode = 'firestore';
  } else if (
    (explicitDbProvider === 'firebase' || explicitDbProvider === 'firestore')
    && !hasExplicitBucket
    && !hasGcpBlazeRuntime
  ) {
    // Firebase Spark free tier has Cloud Firestore enabled without Blaze Firebase Storage / Cloud Run runtime.
    mode = 'firestore';
  } else {
    const explicitFirebaseStorage =
      hasFirebaseProjectOrBucket
      && (explicitDbProvider === 'firebase' || explicitDbProvider === 'firestore' || Boolean(process.env.FIREBASE_STORAGE_BUCKET));
    const explicitSupabaseStorage = explicitDbProvider === 'supabase' && hasSupabase && !explicitFirebaseStorage;
    const explicitSqliteStorage = explicitDbProvider === 'sqlite' && !process.env.FIREBASE_STORAGE_BUCKET;
    const hasFirebaseStorage =
      explicitFirebaseStorage || (!isDevMode && !explicitSupabaseStorage && !explicitSqliteStorage && hasFirebaseProjectOrBucket);

    mode = explicitFirebaseStorage
      ? 'firebase'
      : explicitSupabaseStorage
        ? 'supabase'
        : isDevMode || explicitSqliteStorage
          ? 'dev'
          : hasFirebaseStorage
            ? 'firebase'
            : hasSupabase
              ? 'supabase'
              : 'dev';
  }

  if (adapter && adapterMode === mode) return adapter;

  if (mode === 'firestore') {
    adapter = new FirestoreStorageAdapter();
  } else if (mode === 'firebase') {
    adapter = new FirebaseStorageAdapter();
  } else if (mode === 'supabase') {
    adapter = new SupabaseStorageAdapter();
  } else {
    adapter = new DevStorageAdapter();
  }
  adapterMode = mode;
  return adapter;
}
