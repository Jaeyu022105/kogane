/**
 * Global HTTP security headers and request body size limit middleware for Nitro/Nuxt server routes and pages.
 */

import { Buffer } from 'node:buffer';
import { createError, defineEventHandler, getRequestHeader, setResponseHeader } from 'h3';

export const MAX_JSON_BODY_BYTES = 1 * 1024 * 1024; // 1 MiB for non-multipart JSON/text API requests
export const MAX_MULTIPART_BODY_BYTES = 15 * 1024 * 1024; // 15 MiB ceiling for multipart uploads

const PAYLOAD_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const RAW_BODY_SYMBOL = Symbol.for('h3RawBody');
const PARSED_BODY_SYMBOL = Symbol.for('h3ParsedBody');

function estimateBodyBytes(body: unknown): number {
  if (body == null) return 0;
  if (Buffer.isBuffer(body)) return body.length;
  if (body instanceof Uint8Array) return body.byteLength;
  if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');
  if (typeof body === 'object') {
    try {
      return Buffer.byteLength(JSON.stringify(body), 'utf8');
    } catch {
      return MAX_JSON_BODY_BYTES + 1;
    }
  }
  return 0;
}

async function readBoundedNodeStream(req: any, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const cleanup = () => {
      req.off?.('data', onData);
      req.off?.('end', onEnd);
      req.off?.('error', onError);
    };

    const onData = (chunk: Buffer | Uint8Array | string) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        settled = true;
        cleanup();
        if (typeof req.pause === 'function') req.pause();
        reject(
          createError({
            statusCode: 413,
            statusMessage: 'Payload Too Large',
            message: `Request body exceeds maximum allowed size of ${maxBytes} bytes`,
          }),
        );
        return;
      }
      chunks.push(buf);
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    const onError = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(event, 'X-Frame-Options', 'SAMEORIGIN');
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  setResponseHeader(event, 'X-XSS-Protection', '0');

  const proto = getRequestHeader(event, 'x-forwarded-proto');
  if (proto === 'https' || process.env.COOKIE_SECURE === 'true') {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  const method = (event.method || event.node?.req?.method || 'GET').toUpperCase();
  if (!PAYLOAD_METHODS.has(method)) {
    return;
  }

  const contentType = (getRequestHeader(event, 'content-type') || '').toLowerCase();
  const reqPath = event.path || event.node?.req?.url || '';
  const isStorageUpload = reqPath.startsWith('/api/storage/upload');
  const isMultipart = contentType.includes('multipart/form-data');
  const maxAllowed = (isStorageUpload && isMultipart) ? MAX_MULTIPART_BODY_BYTES : MAX_JSON_BODY_BYTES;

  // 1. Fast-path Content-Length check
  const contentLengthRaw = getRequestHeader(event, 'content-length');
  if (contentLengthRaw !== undefined && contentLengthRaw !== '') {
    const parsedLen = Number.parseInt(String(contentLengthRaw), 10);
    if (!Number.isFinite(parsedLen) || parsedLen < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Invalid Content-Length header',
      });
    }
    if (parsedLen > maxAllowed) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Payload Too Large',
        message: `Request body exceeds maximum allowed size of ${maxAllowed} bytes`,
      });
    }
  }

  // 2. Check pre-buffered / mock body payloads
  const req = event.node?.req as any;
  const preBuffered =
    (event as any)._body ??
    (event as any)._requestBody ??
    req?.[PARSED_BODY_SYMBOL] ??
    req?.rawBody ??
    req?.body;

  if (preBuffered !== undefined) {
    const byteLength = estimateBodyBytes(preBuffered);
    if (byteLength > maxAllowed) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Payload Too Large',
        message: `Request body exceeds maximum allowed size of ${maxAllowed} bytes`,
      });
    }
    return;
  }

  // 3. Guard streamed non-multipart Node requests (e.g. chunked transfer encoding without Content-Length)
  if (!isStorageUpload && req && typeof req.on === 'function' && !req[RAW_BODY_SYMBOL]) {
    const hasTransferEncoding = /\bchunked\b/i.test(String(getRequestHeader(event, 'transfer-encoding') ?? ''));
    const hasContentLength = Number.parseInt(String(contentLengthRaw ?? '0'), 10) > 0;
    if (hasTransferEncoding || hasContentLength) {
      const buf = await readBoundedNodeStream(req, MAX_JSON_BODY_BYTES);
      req[RAW_BODY_SYMBOL] = Promise.resolve(buf);
      req.rawBody = buf;
      (event as any)._requestBody = buf;
    }
  }
});
