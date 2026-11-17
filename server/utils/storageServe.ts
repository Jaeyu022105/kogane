import { setHeader, type H3Event } from 'h3';
import { verifyAdmin, verifyTerminalSession } from '~/lib/authUtils';
import { sanitizeStoragePath, useStorage } from '~/lib/storage';
import { getBusinessForAdmin } from '~/server/utils/business';

/**
 * Images (logos, product photos, avatars) are public: they appear on login and kiosk pages
 * before anyone signs in. Anything else in a business bucket (`biz-<id>`, e.g. PDFs) is only
 * served to that business's owner or one of its terminals.
 */
async function canReadBusinessFile(event: H3Event, bucket: string): Promise<boolean> {
  const businessId = bucket.slice('biz-'.length);

  try {
    const { userId } = await verifyAdmin(event);
    if ((await getBusinessForAdmin(userId, businessId)).data) return true;
  } catch {
    // Not an admin session; try a terminal session.
  }
  try {
    const session = await verifyTerminalSession(event);
    return session.businessId === businessId;
  } catch {
    return false;
  }
}

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

  const type = MIME_TYPES[extension(safeFilePath)] ?? 'application/octet-stream';
  const isPublic = type.startsWith('image/') || !safeBucket.startsWith('biz-');
  if (!isPublic && !(await canReadBusinessFile(event, safeBucket))) {
    return new Response('Not found', { status: 404 });
  }

  const storage = useStorage();
  try {
    const file = await storage.read(safeBucket, safeFilePath);
    setHeader(event, 'Content-Type', type);
    setHeader(event, 'X-Content-Type-Options', 'nosniff');
    setHeader(event, 'Cache-Control', isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store');
    if (type === 'image/svg+xml') {
      setHeader(event, 'Content-Security-Policy', 'sandbox');
    }
    return file;
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
