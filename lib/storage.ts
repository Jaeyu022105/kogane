import { Buffer } from 'node:buffer';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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
  if (!path || !SAFE_PATH_RE.test(path) || path.includes('..')) {
    throw new Error('Invalid storage path');
  }

  return path.replace(/^\/+/, '').replace(/\/+/g, '/');
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

let adapter: StorageAdapter | null = null;

export function useStorage(): StorageAdapter {
  if (adapter) return adapter;
  const isDevMode = process.env.DEV_MODE === 'true';
  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
  adapter = isDevMode || !hasSupabase
    ? new DevStorageAdapter()
    : new SupabaseStorageAdapter();
  return adapter;
}
