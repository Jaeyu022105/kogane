import { setHeader, type H3Event } from 'h3';
import { sanitizeStoragePath, useStorage } from '~/lib/storage';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

function extension(path: string): string {
  const match = path.match(/(\.[A-Za-z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? '';
}

export async function serveStorageFile(event: H3Event) {
  const rawPath = event.context.params?.path;
  const rawSegments = Array.isArray(rawPath)
    ? rawPath
    : typeof rawPath === 'string'
      ? rawPath.split('/')
      : [];

  const pathParts: string[] = [];
  for (const segment of rawSegments) {
    if (!segment) continue;
    try {
      pathParts.push(decodeURIComponent(segment));
    } catch {
      return new Response('Invalid storage path', { status: 400 });
    }
  }

  if (pathParts.length < 2) {
    return new Response('Not found', { status: 404 });
  }

  if (pathParts.some((seg) => seg === '.' || seg === '..' || seg.includes('..') || seg.includes('/') || seg.includes('\\'))) {
    return new Response('Invalid storage path', { status: 400 });
  }

  const [rawBucket, ...rest] = pathParts;
  const rawFilePath = rest.join('/');

  let safeBucket: string;
  let safeFilePath: string;
  try {
    safeBucket = sanitizeStoragePath(rawBucket);
    safeFilePath = sanitizeStoragePath(rawFilePath);
  } catch {
    return new Response('Invalid storage path', { status: 400 });
  }

  const storage = useStorage();
  try {
    const file = await storage.read(safeBucket, safeFilePath);
    const type = MIME_TYPES[extension(safeFilePath)] ?? 'application/octet-stream';
    setHeader(event, 'Content-Type', type);
    setHeader(event, 'X-Content-Type-Options', 'nosniff');
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
    if (type === 'image/svg+xml') {
      setHeader(event, 'Content-Security-Policy', 'sandbox');
    }
    return file;
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
