import { Buffer } from 'node:buffer';
import { defineEventHandler, readMultipartFormData } from 'h3';
import { verifyAdmin, verifyTerminalSession } from '~/lib/authUtils';
import { useStorage, sanitizeStoragePath } from '~/lib/storage';
import { getBusinessForAdminUser } from '~/server/utils/business';
import { writeAuditLog } from '~/server/utils/audit';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const DOCUMENT_TYPES = new Set(['application/pdf']);

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

  const safeLogicalBucket = sanitizeStoragePath(logicalBucket);
  const safePath = sanitizeStoragePath(rawPath);

  let actorType: 'admin' | 'inpoint' | 'signup' = 'admin';
  let actorName = 'Admin';
  let businessId: string | null = null;

  try {
    const { userId } = await verifyAdmin(event);
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
      // Unauthenticated uploads are only allowed for images (e.g. signup avatars)
      if (!IMAGE_TYPES.has(contentType)) {
        return { url: null, error: 'Authentication required for this file type' };
      }
      actorType = 'signup';
      actorName = 'Guest';
    }
  }

  const storage = useStorage();
  const physicalBucket = businessId ? `biz-${businessId}` : 'public';
  const finalPath = `${safeLogicalBucket}/${safePath}`;
  const url = await storage.upload(physicalBucket, finalPath, {
    data: filePart.data,
    contentType,
    upsert: true,
  });

  if (businessId) {
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
