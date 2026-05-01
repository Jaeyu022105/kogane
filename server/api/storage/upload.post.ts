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

  let actorType: 'admin' | 'inpoint' = 'admin';
  let actorName = 'Admin';
  let businessId: string;

  try {
    const { userId } = await verifyAdmin(event);
    const business = await getBusinessForAdminUser(userId);
    if (!business.data) {
      return { url: null, error: 'Business not found' };
    }
    businessId = business.data.id;
  } catch {
    const session = await verifyTerminalSession(event);
    actorType = 'inpoint';
    actorName = session.displayName;
    businessId = session.businessId;
  }

  const storage = useStorage();
  const physicalBucket = `biz-${businessId}`;
  const finalPath = `${safeLogicalBucket}/${safePath}`;
  const url = await storage.upload(physicalBucket, finalPath, {
    data: filePart.data,
    contentType,
    upsert: true,
  });

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

  return { url, error: null };
});
