/**
 * Cryptographic security primitives:
 * - Secret & encryption key derivation
 * - Token SHA-256 hashing & timing-safe comparison
 * - AES-256-GCM encryption/decryption at rest (for TOTP secrets)
 * - RFC 6238 TOTP generation & verification + QR code DataURL generation
 * - Hashed single-use backup recovery codes
 * - Safe redirect path validation
 */

import { Buffer } from 'node:buffer';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let warnedMissingSecret = false;

/**
 * Returns the HMAC session secret.
 * In production, prefers SESSION_SECRET / NUXT_SESSION_SECRET and warns if using a fallback.
 */
export function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.NUXT_SESSION_SECRET;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }

  if (process.env.NODE_ENV === 'production' && !warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      '[kogane/security] SESSION_SECRET is not set in production. Set SESSION_SECRET in your Firebase/server environment.',
    );
  }

  return (
    process.env.FIREBASE_PRIVATE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || 'kogane-dev-secret'
  );
}

/** Derives a 32-byte AES-256 key from ENCRYPTION_KEY or SESSION_SECRET. */
function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || getSessionSecret();
  return createHash('sha256').update(`kogane-aes-v1:${raw}`).digest();
}

/** Constant-time string equality check. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** SHA-256 hex digest of a session/bearer token for safe DB storage. */
export function hashTokenSha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Encrypts sensitive strings (e.g. TOTP secrets) using AES-256-GCM. */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypts AES-256-GCM encrypted strings; returns null if tampered or invalid. */
export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  if (!ciphertext.startsWith('enc:v1:')) {
    // Allow legacy unencrypted value fallback only if it looks like raw Base32
    return /^[A-Z2-7]+=*$/i.test(ciphertext) ? ciphertext : null;
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 5) return null;
  const [, , ivHex, tagHex, dataHex] = parts;

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/** RFC 4648 Base32 encoding (without padding). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/** RFC 4648 Base32 decoding. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Generates a 160-bit Base32 TOTP secret suitable for Google Authenticator / Authy. */
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

/** Generates a 6-digit RFC 6238 TOTP code for a given Base32 secret and timestamp. */
export function generateTotpCode(
  secretBase32: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
  digits = 6,
): string {
  const key = base32Decode(secretBase32);
  if (key.length === 0) {
    throw new Error('Invalid TOTP secret');
  }

  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return String(otp).padStart(digits, '0');
}

/** Verifies a 6-digit TOTP code allowing +/- windowSteps clock drift. */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  windowSteps = 1,
  timestampMs = Date.now(),
  stepSeconds = 30,
): boolean {
  const normalized = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const candidate = generateTotpCode(
      secretBase32,
      timestampMs + offset * stepSeconds * 1000,
      stepSeconds,
      6,
    );
    if (timingSafeEqualStr(normalized, candidate)) {
      return true;
    }
  }
  return false;
}

/** Builds a standard otpauth:// URI for authenticator apps. */
export function buildOtpAuthUri(options: {
  secret: string;
  email: string;
  issuer?: string;
}): string {
  const issuer = options.issuer || 'Kogane';
  const label = encodeURIComponent(`${issuer}:${options.email}`);
  const params = new URLSearchParams({
    secret: options.secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Generates a real scannable QR code Data URL (PNG) for an otpauth URI. */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 220,
    margin: 2,
    color: {
      dark: '#68293A',
      light: '#FFFFFF',
    },
  });
}

function normalizeBackupCode(code: string): string {
  return String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashBackupCode(normalizedCode: string, saltHex?: string): string {
  const salt = saltHex || randomBytes(8).toString('hex');
  const digest = createHash('sha256').update(`${salt}:${normalizedCode}`).digest('hex');
  return `bk$v1$${salt}$${digest}`;
}

/** Generates single-use recovery backup codes and their salted SHA-256 hashes. */
export function generateBackupCodes(count = 8): {
  plainCodes: string[];
  hashedCodes: string[];
} {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8);
    let raw = '';
    for (let j = 0; j < 8; j++) {
      raw += alphabet[bytes[j] % alphabet.length];
    }
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    plainCodes.push(formatted);
    hashedCodes.push(hashBackupCode(raw));
  }

  return { plainCodes, hashedCodes };
}

/** Verifies a backup code against stored hashes and consumes it if matched. */
export function verifyAndConsumeBackupCode(
  inputCode: string,
  storedHashes: string[],
): { matched: boolean; remainingHashes: string[] } {
  const normalized = normalizeBackupCode(inputCode);
  if (normalized.length < 6) {
    return { matched: false, remainingHashes: storedHashes };
  }

  let matchedIdx = -1;
  for (let i = 0; i < storedHashes.length; i++) {
    const stored = storedHashes[i];
    if (!stored || !stored.startsWith('bk$v1$')) continue;
    const parts = stored.split('$');
    if (parts.length !== 4) continue;
    const salt = parts[2];
    const candidate = hashBackupCode(normalized, salt);
    if (timingSafeEqualStr(candidate, stored)) {
      matchedIdx = i;
      break;
    }
  }

  if (matchedIdx === -1) {
    return { matched: false, remainingHashes: storedHashes };
  }

  const remainingHashes = storedHashes.filter((_, idx) => idx !== matchedIdx);
  return { matched: true, remainingHashes };
}

/** Validates internal redirect paths to prevent open-redirect attacks. */
export function isSafeRedirectPath(target: unknown): target is string {
  if (typeof target !== 'string') return false;
  if (!target.startsWith('/')) return false;
  if (target.startsWith('//') || target.startsWith('/\\')) return false;
  if (/^\/https?:/i.test(target)) return false;
  return true;
}
