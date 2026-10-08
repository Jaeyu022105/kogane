import { defineEventHandler, getHeader, setHeader } from 'h3';
import { useStorage } from '~/lib/storage';

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

export default defineEventHandler(async (event) => {
  const rawPath = event.context.params?.path;
  const pathParts = Array.isArray(rawPath) ? rawPath : (typeof rawPath === 'string' ? rawPath.split('/') : []);
  if (pathParts.length < 2) {
    return new Response('Not found', { status: 404 });
  }

  const [bucket, ...rest] = pathParts;
  const filePath = rest.join('/');
  const storage = useStorage();
  try {
    const file = await storage.read(bucket, filePath);
    const type = MIME_TYPES[extension(filePath)] ?? getHeader(event, 'content-type') ?? 'application/octet-stream';
    setHeader(event, 'Content-Type', type);
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
    return file;
  } catch {
    return new Response('Not found', { status: 404 });
  }
});
