import { Buffer } from 'node:buffer';
import { defineEventHandler, readMultipartFormData, setResponseStatus } from 'h3';
import type { AuditActorType } from '~/lib/audit';
import { verifyAdmin, verifyTerminalSession } from '~/lib/authUtils';
import { enforceRateLimit, getClientIp, recordRateLimitAttempt } from '~/lib/rateLimit';
import { useStorage, sanitizeStoragePath } from '~/lib/storage';
import { getBusinessForAdminUser } from '~/server/utils/business';
import { writeAuditLog } from '~/server/utils/audit';

const GUEST_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const DOCUMENT_TYPES = new Set(['application/pdf']);

const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

function maxBytesForType(contentType: string) {
  if (IMAGE_TYPES.has(contentType)) return 5 * 1024 * 1024;
  if (DOCUMENT_TYPES.has(contentType)) return 10 * 1024 * 1024;
  return 0;
}

export default defineEventHandler(async (event) => {
  const multipart = await readMultipartFormData(event);
  if (!multipart) {
    return { url: null, error: 'Expected multipart form data' };
  }

  const filePart = multipart.find((part) => part.name === 'file' && part.filename);
  const bucketPart = multipart.find((part) => part.name === 'bucket');
  const pathPart = multipart.find((part) => part.name === 'path');

  if (!filePart || !bucketPart?.data || !pathPart?.data) {
    return { url: null, error: 'Missing file, bucket, or path' };
  }

  const logicalBucket = Buffer.from(bucketPart.data).toString('utf8');
  const rawPath = Buffer.from(pathPart.data).toString('utf8');
  const contentType = filePart.type || 'application/octet-stream';
  const maxBytes = maxBytesForType(contentType);

  if (!maxBytes) {
    return { url: null, error: 'Unsupported file type' };
  }

  if (filePart.data.length > maxBytes) {
    return { url: null, error: 'File exceeds the allowed size limit' };
  }

  let safeLogicalBucket: string;
  let safePath: string;
  try {
    safeLogicalBucket = sanitizeStoragePath(logicalBucket);
    safePath = sanitizeStoragePath(rawPath);
  } catch {
    return { url: null, error: 'Invalid storage path' };
  }

  const fileName = safePath.split('/').pop() ?? '';
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx !== -1 ? fileName.slice(dotIdx + 1).toLowerCase() : '';
  const expectedMime = EXTENSION_MIME_MAP[ext];
  if (!expectedMime || expectedMime !== contentType) {
    return { url: null, error: 'File extension does not match declared file type' };
  }

  let actorType: AuditActorType | null = null;
  let actorName = 'Admin';
  let businessId: string | null = null;

  try {
    const { userId } = await verifyAdmin(event);
    actorType = 'admin';
    const business = await getBusinessForAdminUser(userId);
    if (business.data) {
      businessId = business.data.id;
    }
  } catch {
    try {
      const session = await verifyTerminalSession(event);
      actorType = 'inpoint';
      actorName = session.displayName;
      businessId = session.businessId;
    } catch {
      // Unauthenticated uploads are only allowed for safe raster images (e.g. signup avatars)
      if (!GUEST_IMAGE_TYPES.has(contentType)) {
        return { url: null, error: 'Authentication required for this file type' };
      }

      const rateWindowMs = 15 * 60 * 1000;
      const rate = enforceRateLimit(event, {
        scope: 'guest_image_upload',
        maxAttempts: 10,
        windowMs: rateWindowMs,
      });
      if (!rate.allowed) {
        setResponseStatus(event, 429);
        return {
          url: null,
          error: `Too many upload attempts. Try again in ${rate.retryAfterSeconds} seconds.`,
        };
      }
      recordRateLimitAttempt(`guest_image_upload:${getClientIp(event)}`, rateWindowMs);
    }
  }

  const storage = useStorage();
  const physicalBucket = businessId ? `biz-${businessId}` : 'public';
  const finalPath = `${safeLogicalBucket}/${safePath}`;
  let url: string;
  try {
    url = await storage.upload(physicalBucket, finalPath, {
      data: filePart.data,
      contentType,
      upsert: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage upload failed';
    setResponseStatus(event, /limit|exceeds|700 KB/i.test(message) ? 413 : 500);
    return { url: null, error: message };
  }

  if (businessId && actorType) {
    try {
      await writeAuditLog({
        businessId,
        actorType,
        actorName,
        actionType: 'upload',
        metadata: {
          bucket: safeLogicalBucket,
          filename: filePart.filename,
          path: finalPath,
          url,
          size: filePart.data.length,
          contentType,
        },
      });
    } catch {
      // Non-fatal if audit logging fails
    }
  }

  return { url, error: null };
});
