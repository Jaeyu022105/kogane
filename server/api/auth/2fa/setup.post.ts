/**
 * POST /api/auth/2fa/setup
 * Generates a fresh TOTP secret, encrypts it at rest with AES-256-GCM,
 * and returns a scannable QR code Data URL + manual Base32 key.
 * 2FA remains disabled until verified via POST /api/auth/2fa/enable.
 */

import { defineEventHandler } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import {
  buildOtpAuthUri,
  encryptSecret,
  generateQrDataUrl,
  generateTotpSecret,
} from '~/lib/security';

export default defineEventHandler(async (event) => {
  const { userId, email } = await verifyAdmin(event);

  const { data: user } = await db.queryOne<{
    id: string;
    email: string;
    two_factor_enabled?: number | boolean;
  }>(
    'SELECT id, email, two_factor_enabled FROM users WHERE id = ?',
    [userId],
  );

  if (!user) {
    return { error: 'User account not found', qrCodeDataUrl: null, secret: null, otpauthUri: null };
  }

  if (user.two_factor_enabled === 1 || user.two_factor_enabled === true) {
    return {
      error: 'Two-factor authentication is already enabled on this account.',
      qrCodeDataUrl: null,
      secret: null,
      otpauthUri: null,
    };
  }

  const secret = generateTotpSecret(20);
  const encryptedSecret = encryptSecret(secret);
  const otpauthUri = buildOtpAuthUri({
    secret,
    email: user.email || email || 'admin@kogane.dev',
    issuer: 'Kogane',
  });
  const qrCodeDataUrl = await generateQrDataUrl(otpauthUri);

  const { error: updateErr } = await db.update('users', {
    two_factor_secret: encryptedSecret,
    two_factor_enabled: 0,
    updated_at: new Date().toISOString(),
  }, { id: userId });

  if (updateErr) {
    return { error: 'Failed to initialize 2FA setup', qrCodeDataUrl: null, secret: null, otpauthUri: null };
  }

  return {
    secret,
    otpauthUri,
    qrCodeDataUrl,
    error: null,
  };
});
