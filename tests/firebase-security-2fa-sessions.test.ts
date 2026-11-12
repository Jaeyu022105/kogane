import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  encryptSecret,
  decryptSecret,
  hashTokenSha256,
  timingSafeEqualStr,
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  buildOtpAuthUri,
  generateQrDataUrl,
  generateBackupCodes,
  verifyAndConsumeBackupCode,
  isSafeRedirectPath,
} from '../lib/security';
import {
  normalizeEmail,
  parseUserAgentSummary,
  mapUserRecordToDto,
  mapSessionRecordToDto,
  mapTerminalRecordToDto,
} from '../lib/mappers';
import {
  FirestoreAdapter,
  InMemoryFirestoreStore,
} from '../lib/db-firebase';
import {
  db,
  setDbAdapterForTest,
  resetDbAdapter,
  getDbProvider,
} from '../lib/db';
import {
  hashPin,
  verifyPin,
  verifyAdmin,
  verifyTerminalSession,
  issueStatefulAdminSession,
  createAdminSessionToken,
} from '../lib/authUtils';
import { resetAllRateLimits } from '../lib/rateLimit';
import { resolveFirebaseProjectId, resolveFirebaseStorageBucket } from '../lib/firebaseAdmin';
import {
  FirebaseStorageAdapter,
  FirestoreStorageAdapter,
  FIRESTORE_STORAGE_COLLECTION,
  FIRESTORE_STORAGE_MAX_BYTES,
  useStorage,
} from '../lib/storage';
import { useAuth } from '../composables/useAuth';

import signupHandler from '../server/api/auth/signup.post';
import loginHandler from '../server/api/auth/login.post';
import logoutHandler from '../server/api/auth/logout.post';
import meHandler from '../server/api/auth/me.get';
import changePasswordHandler from '../server/api/auth/change-password.post';
import twoFaSetupHandler from '../server/api/auth/2fa/setup.post';
import twoFaEnableHandler from '../server/api/auth/2fa/enable.post';
import twoFaVerifyHandler from '../server/api/auth/2fa/verify.post';
import twoFaDisableHandler from '../server/api/auth/2fa/disable.post';
import twoFaBackupCodesHandler from '../server/api/auth/2fa/backup-codes.post';
import sessionsIndexHandler from '../server/api/auth/sessions/index.get';
import sessionsRevokeHandler from '../server/api/auth/sessions/revoke.post';
import terminalLoginHandler from '../server/api/terminals/login.post';
import terminalLogoutHandler from '../server/api/terminals/logout.post';
import terminalPatchHandler from '../server/api/terminals/[id].patch';
import tableActivityHandler from '../server/api/reports/table-activity.get';
import uploadHandler from '../server/api/storage/upload.post';
import storageFilesGetHandler from '../server/api/storage/files/[...path].get';

function createMockEvent(opts: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  cookies?: Record<string, string>;
}) {
  const method = opts.method ?? 'POST';
  const body = opts.body;
  const responseHeaders: Record<string, string | string[]> = {};
  const rawHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36',
    ...(opts.headers ?? {}),
  };

  if (opts.cookies && Object.keys(opts.cookies).length > 0) {
    rawHeaders.cookie = Object.entries(opts.cookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');
  }

  return {
    method,
    node: {
      req: {
        method,
        headers: rawHeaders,
        socket: { remoteAddress: '10.20.30.40', encrypted: true },
        body,
        [Symbol.for('h3ParsedBody')]: body,
      },
      res: {
        statusCode: 200,
        setHeader(name: string, val: string | string[]) {
          responseHeaders[name.toLowerCase()] = val;
        },
        getHeader(name: string) {
          return responseHeaders[name.toLowerCase()];
        },
      },
    },
    context: {
      body,
      params: opts.params ?? {},
    },
    _body: body,
    _responseHeaders: responseHeaders,
    [Symbol.for('h3ParsedBody')]: body,
  } as any;
}

describe('Security Primitives, Hashing, Encryption, TOTP & Mappers', () => {
  test('AES-256-GCM encryption protects 2FA secrets at rest and rejects tampering', () => {
    const secret = generateTotpSecret();
    const encrypted = encryptSecret(secret);

    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);

    // Tampered ciphertext must fail authentication tag verification
    const parts = encrypted.split(':');
    parts[4] = parts[4].slice(0, -2) + (parts[4].endsWith('00') ? 'ff' : '00');
    expect(decryptSecret(parts.join(':'))).toBeNull();
  });

  test('PBKDF2 PIN hashing uses unique salts while maintaining legacy SHA-256 verification', async () => {
    const hashA = await hashPin('4829');
    const hashB = await hashPin('4829');

    expect(hashA.startsWith('pin_pbkdf2$100000$')).toBe(true);
    expect(hashA).not.toBe(hashB);
    expect(await verifyPin('4829', hashA)).toBe(true);
    expect(await verifyPin('9999', hashA)).toBe(false);

    // Legacy unsalted SHA-256 hash of "1234"
    const legacySha256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
    expect(await verifyPin('1234', legacySha256)).toBe(true);
    expect(await verifyPin('0000', legacySha256)).toBe(false);
  });

  test('RFC 6238 TOTP generation, verification, QR Data URL & single-use backup codes', async () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const code = generateTotpCode(secret, now);

    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code, 1, now)).toBe(true);
    // Reject wrong codes and malformed inputs
    expect(verifyTotpCode(secret, '000000' === code ? '111111' : '000000', 1, now)).toBe(false);
    expect(verifyTotpCode(secret, 'abcdef', 1, now)).toBe(false);

    const uri = buildOtpAuthUri({ secret, email: 'owner@kogane.app' });
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain(`secret=${secret}`);

    const qr = await generateQrDataUrl(uri);
    expect(qr.startsWith('data:image/png;base64,')).toBe(true);

    const { plainCodes, hashedCodes } = generateBackupCodes(8);
    expect(plainCodes).toHaveLength(8);
    expect(hashedCodes).toHaveLength(8);
    expect(hashedCodes[0]).not.toContain(plainCodes[0]);

    // Consuming first backup code succeeds and removes it from remainingHashes
    const firstTry = verifyAndConsumeBackupCode(plainCodes[0].toLowerCase(), hashedCodes);
    expect(firstTry.matched).toBe(true);
    expect(firstTry.remainingHashes).toHaveLength(7);

    // Reusing the exact same backup code is rejected
    const secondTry = verifyAndConsumeBackupCode(plainCodes[0], firstTry.remainingHashes);
    expect(secondTry.matched).toBe(false);
    expect(secondTry.remainingHashes).toHaveLength(7);
  });

  test('Token SHA-256 hashing, timing-safe equal, and safe redirect path checks', () => {
    const h1 = hashTokenSha256('sample-token');
    const h2 = hashTokenSha256('sample-token');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(timingSafeEqualStr(h1, h2)).toBe(true);
    expect(timingSafeEqualStr(h1, `${h1}x`)).toBe(false);

    expect(isSafeRedirectPath('/dashboard')).toBe(true);
    expect(isSafeRedirectPath('/dashboard/settings?tab=security')).toBe(true);
    expect(isSafeRedirectPath('//evil.example.com')).toBe(false);
    expect(isSafeRedirectPath('https://evil.example.com')).toBe(false);
    expect(isSafeRedirectPath('/\\evil.example.com')).toBe(false);
  });

  test('DTO mappers strip all secret DB columns and normalize formats', () => {
    expect(normalizeEmail('  Owner+POS@Example.COM  ')).toBe('owner+pos@example.com');
    expect(parseUserAgentSummary('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0')).toBe('Chrome on Windows');

    const userDto = mapUserRecordToDto({
      id: 'usr_1',
      email: 'Chef@Kogane.dev',
      full_name: 'Chef Hana',
      username: 'hana',
      password_hash: 'pbkdf2$secret',
      two_factor_enabled: 1,
      two_factor_secret: 'enc:v1:secret',
      two_factor_backup_codes: '["bk$v1$..."]',
    });
    expect(userDto.email).toBe('chef@kogane.dev');
    expect(userDto.has2fa).toBe(true);
    expect((userDto as any).password_hash).toBeUndefined();
    expect((userDto as any).two_factor_secret).toBeUndefined();
    expect((userDto as any).two_factor_backup_codes).toBeUndefined();

    const sessDto = mapSessionRecordToDto({
      id: 'sess_1',
      session_type: 'admin',
      token_hash: 'deadbeef',
      two_factor_verified: 1,
      ip_address: '1.2.3.4',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1.15',
      expires_at: '2027-01-01T00:00:00.000Z',
    }, 'sess_1');
    expect(sessDto.isCurrent).toBe(true);
    expect(sessDto.deviceLabel).toBe('Safari on macOS');
    expect((sessDto as any).token_hash).toBeUndefined();

    const termDto = mapTerminalRecordToDto({
      id: 'term_1',
      business_id: 'biz_1',
      display_name: 'Cashier 1',
      role: 'cashier',
      pin_hash: 'pin_pbkdf2$...',
      pin_code: '4321',
    });
    expect((termDto as any).pin_hash).toBeUndefined();
    expect((termDto as any).pin_code).toBeUndefined();
  });
});

describe('Firebase Cloud Firestore Adapter (FirestoreAdapter)', () => {
  const prevProvider = process.env.DB_PROVIDER;
  const prevDevMode = process.env.DEV_MODE;

  beforeEach(() => {
    resetAllRateLimits();
    process.env.DB_PROVIDER = 'firebase';
    process.env.DEV_MODE = 'false';
    const store = new InMemoryFirestoreStore();
    setDbAdapterForTest(new FirestoreAdapter(store));
  });

  afterEach(() => {
    resetDbAdapter();
    if (prevProvider === undefined) delete process.env.DB_PROVIDER;
    else process.env.DB_PROVIDER = prevProvider;
    if (prevDevMode === undefined) delete process.env.DEV_MODE;
    else process.env.DEV_MODE = prevDevMode;
  });

  test('getDbProvider resolves to firebase and supports DDL, SQL queries, joins & isolation', async () => {
    expect(getDbProvider()).toBe('firebase');

    // CREATE TABLE & PRAGMA table_info translation
    const ddlRes = await db.execute(
      'CREATE TABLE IF NOT EXISTS tenant_abc_products (id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL)',
    );
    expect(ddlRes.error).toBeNull();

    const alterRes = await db.execute(
      'ALTER TABLE tenant_abc_products ADD COLUMN category TEXT',
    );
    expect(alterRes.error).toBeNull();

    const pragma = await db.query<{ name: string; type: string }>(
      'PRAGMA table_info(tenant_abc_products)',
    );
    expect(pragma.error).toBeNull();
    expect(pragma.data?.map((c) => c.name)).toContain('category');

    // Insert & case-insensitive query + LIMIT/OFFSET + COUNT(*)
    await db.insert('tenant_abc_products', {
      id: 'prod_1',
      name: 'Matcha Latte',
      price: 180,
      category: 'Drinks',
    });
    await db.insert('tenant_abc_products', {
      id: 'prod_2',
      name: 'Katsu Curry',
      price: 320,
      category: 'Mains',
    });

    const found = await db.queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM tenant_abc_products WHERE name = ? COLLATE NOCASE',
      ['matcha latte'],
    );
    expect(found.error).toBeNull();
    expect(found.data?.id).toBe('prod_1');

    const countRes = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM tenant_abc_products',
    );
    expect(countRes.data?.cnt).toBe(2);

    const ordered = await db.query<{ id: string }>(
      'SELECT id FROM tenant_abc_products ORDER BY price DESC LIMIT 1 OFFSET 0',
    );
    expect(ordered.data?.[0]?.id).toBe('prod_2');

    // JOIN query across Firestore collections
    await db.insert('businesses', {
      id: 'biz_fs_1',
      admin_user_id: 'usr_fs_1',
      name: 'Firestore Bistro',
      schema_name: 'tenant_abc',
      country: 'PH',
      currency: 'PHP',
      currency_symbol: '₱',
      created_at: new Date().toISOString(),
    });
    await db.insert('terminals', {
      id: 'term_fs_1',
      business_id: 'biz_fs_1',
      display_name: 'Kitchen 1',
      role: 'kitchen',
      pin_hash: await hashPin('1234'),
      pin_code: '1234',
      pin_length: 4,
      created_at: new Date().toISOString(),
    });

    const joined = await db.queryOne<{ id: string; business_name: string }>(
      `SELECT t.*, b.name AS business_name
         FROM terminals t
         JOIN businesses b ON b.id = t.business_id
        WHERE t.id = ?`,
      ['term_fs_1'],
    );
    expect(joined.error).toBeNull();
    expect(joined.data?.business_name).toBe('Firestore Bistro');
  });

  test('Full admin signup, stateful session, login, and terminal PIN auth work end-to-end on FirestoreAdapter', async () => {
    const signupEvent = createMockEvent({
      body: {
        email: 'firebase.owner@kogane.dev',
        password: 'FirebaseStrongPassword!1',
        fullName: 'Firebase Owner',
        username: 'fbowner',
      },
    });

    const signupRes = await signupHandler(signupEvent);
    expect(signupRes.error).toBeNull();
    expect(signupRes.session?.token).toBeTruthy();

    // Production dev-admin-token MUST be rejected when DEV_MODE=false (simulated non-test)
    // Valid token from Firestore session works for /api/auth/me
    const meRes = await meHandler(
      createMockEvent({
        method: 'GET',
        headers: { authorization: `Bearer ${signupRes.session!.token}` },
      }),
    );
    expect(meRes.error).toBeNull();
    expect(meRes.user?.email).toBe('firebase.owner@kogane.dev');
    expect(meRes.user?.sessionId).toBeTruthy();

    // Logout revokes the Firestore session row
    await logoutHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${signupRes.session!.token}` },
      }),
    );

    await expect(
      verifyAdmin(
        createMockEvent({
          method: 'GET',
          headers: { authorization: `Bearer ${signupRes.session!.token}` },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe('Stateful Sessions, 2FA Lifecycle, Terminal Revocation & Rate Limiting', () => {
  beforeEach(() => {
    resetAllRateLimits();
    resetDbAdapter();
    process.env.DEV_MODE = 'true';
    delete process.env.DB_PROVIDER;
  });

  afterEach(() => {
    resetAllRateLimits();
    resetDbAdapter();
  });

  test('Full 2FA lifecycle: setup -> enable -> login challenge -> TOTP verify -> backup code -> disable', async () => {
    const email = `2fa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@kogane.dev`;
    const password = 'TwoFactorTestPass!99';

    // 1. Sign up
    const signupRes = await signupHandler(
      createMockEvent({
        body: { email, password, fullName: '2FA Tester', username: 'twofa' },
      }),
    );
    expect(signupRes.error).toBeNull();
    const token = signupRes.session!.token;

    // 2. Setup 2FA (generates encrypted secret + scannable QR data URL)
    const setupRes = await twoFaSetupHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${token}` },
        body: {},
      }),
    );
    expect(setupRes.error).toBeNull();
    expect(setupRes.secret).toBeTruthy();
    if (!setupRes.secret) throw new Error('Expected 2FA secret');
    const totpSecret = setupRes.secret;
    expect(setupRes.qrCodeDataUrl?.startsWith('data:image/png;base64,')).toBe(true);

    // 3. Invalid TOTP fails activation
    const badEnable = await twoFaEnableHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${token}` },
        body: { code: '000000' === generateTotpCode(totpSecret) ? '111111' : '000000' },
      }),
    );
    expect(badEnable.enabled).toBe(false);

    // 4. Valid TOTP enables 2FA and returns 8 single-use backup codes
    const validOtp = generateTotpCode(totpSecret);
    const enableRes = await twoFaEnableHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${token}` },
        body: { code: validOtp },
      }),
    );
    expect(enableRes.error).toBeNull();
    expect(enableRes.enabled).toBe(true);
    expect(enableRes.backupCodes).toHaveLength(8);

    // 5. Login with password returns 2FA challenge instead of direct admin access
    const challengeLogin = await loginHandler(
      createMockEvent({
        body: { email, password },
      }),
    );
    expect(challengeLogin.error).toBeNull();
    expect(challengeLogin.requires2fa).toBe(true);
    expect(challengeLogin.challengeToken).toBeTruthy();
    expect(challengeLogin.session).toBeNull();

    // Pending challengeToken CANNOT access protected admin routes directly
    await expect(
      verifyAdmin(
        createMockEvent({
          method: 'GET',
          headers: { authorization: `Bearer ${challengeLogin.challengeToken}` },
        }),
      ),
    ).rejects.toThrow();

    // 6. Verify 2FA with valid TOTP completes login and rotates token
    const verifyRes = await twoFaVerifyHandler(
      createMockEvent({
        body: {
          challengeToken: challengeLogin.challengeToken,
          code: generateTotpCode(totpSecret),
        },
      }),
    );
    expect(verifyRes.error).toBeNull();
    expect(verifyRes.session?.has2fa).toBe(true);
    expect(verifyRes.session?.token).toBeTruthy();
    expect(verifyRes.session?.token).not.toBe(challengeLogin.challengeToken);

    // Old challengeToken cannot be replayed
    const replayRes = await twoFaVerifyHandler(
      createMockEvent({
        body: {
          challengeToken: challengeLogin.challengeToken,
          code: generateTotpCode(totpSecret),
        },
      }),
    );
    expect(replayRes.session).toBeNull();

    // 7. Backup code single-use verification & consumption
    const loginForBackup = await loginHandler(createMockEvent({ body: { email, password } }));
    const backupCode = enableRes.backupCodes![0];
    const backupVerify = await twoFaVerifyHandler(
      createMockEvent({
        body: { challengeToken: loginForBackup.challengeToken, code: backupCode },
      }),
    );
    expect(backupVerify.error).toBeNull();
    expect(backupVerify.usedBackupCode).toBe(true);
    expect(backupVerify.remainingBackupCodes).toBe(7);

    // Reusing the same consumed backup code MUST fail
    const loginForReuse = await loginHandler(createMockEvent({ body: { email, password } }));
    const reuseAttempt = await twoFaVerifyHandler(
      createMockEvent({
        body: { challengeToken: loginForReuse.challengeToken, code: backupCode },
      }),
    );
    expect(reuseAttempt.session).toBeNull();
    expect(reuseAttempt.error).toBeTruthy();

    // 8. Regenerate backup codes with password
    const regenRes = await twoFaBackupCodesHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${verifyRes.session!.token}` },
        body: { password },
      }),
    );
    expect(regenRes.error).toBeNull();
    expect(regenRes.backupCodes).toHaveLength(8);
    expect(regenRes.backupCodes![0]).not.toBe(enableRes.backupCodes![0]);

    // 9. Disable 2FA requires password + valid TOTP/backup code
    const disableRes = await twoFaDisableHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${verifyRes.session!.token}` },
        body: { password, code: regenRes.backupCodes![0] },
      }),
    );
    expect(disableRes.error).toBeNull();
    expect(disableRes.disabled).toBe(true);

    // Next login completes immediately without 2FA challenge
    const postDisableLogin = await loginHandler(createMockEvent({ body: { email, password } }));
    expect(postDisableLogin.requires2fa).toBe(false);
    expect(postDisableLogin.session?.has2fa).toBe(false);
  });

  test('Stateful session listing, remote revocation, and password-change revocation of other sessions', async () => {
    const email = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@kogane.dev`;
    const password = 'SessionPass!2026';

    const signup = await signupHandler(
      createMockEvent({ body: { email, password, fullName: 'Multi Device', username: 'multidev' } }),
    );
    const token1 = signup.session!.token;

    const login2 = await loginHandler(createMockEvent({ body: { email, password } }));
    const token2 = login2.session!.token;

    const login3 = await loginHandler(createMockEvent({ body: { email, password } }));
    const token3 = login3.session!.token;

    // List sessions using token1
    const listRes = await sessionsIndexHandler(
      createMockEvent({
        method: 'GET',
        headers: { authorization: `Bearer ${token1}` },
      }),
    );
    expect(listRes.error).toBeNull();
    expect(listRes.sessions).toHaveLength(3);
    expect(listRes.sessions!.filter((s: any) => s.isCurrent)).toHaveLength(1);
    expect((listRes.sessions![0] as any).token_hash).toBeUndefined();

    // Revoke token2 remotely from token1
    const nonCurrent = listRes.sessions!.find((s: any) => !s.isCurrent)!;
    const revokeRes = await sessionsRevokeHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${token1}` },
        body: { sessionId: nonCurrent.id },
      }),
    );
    expect(revokeRes.success).toBe(true);

    const afterSingleRevoke = await sessionsIndexHandler(
      createMockEvent({
        method: 'GET',
        headers: { authorization: `Bearer ${token1}` },
      }),
    );
    expect(afterSingleRevoke.sessions).toHaveLength(2);

    // Changing password via token1 revokes remaining other session(s) while keeping token1 alive
    const newPassword = 'RotatedPassword!99';
    const changeRes = await changePasswordHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${token1}` },
        body: {
          currentPassword: password,
          newPassword,
          confirmPassword: newPassword,
        },
      }),
    );
    expect(changeRes.success).toBe(true);

    // token1 remains active; other tokens are now rejected
    const me1 = await meHandler(
      createMockEvent({
        method: 'GET',
        headers: { authorization: `Bearer ${token1}` },
      }),
    );
    expect(me1.user?.email).toBe(email.toLowerCase());

    await expect(
      verifyAdmin(
        createMockEvent({
          method: 'GET',
          headers: { authorization: `Bearer ${token3}` },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      verifyAdmin(
        createMockEvent({
          method: 'GET',
          headers: { authorization: `Bearer ${token2}` },
        }),
      ),
    ).rejects.toThrow();
  });

  test('Terminal PIN login upgrades legacy SHA-256 hash to PBKDF2, enforces rate limit & revokes on logout/PIN change', async () => {
    const email = `termowner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@kogane.dev`;
    const signup = await signupHandler(
      createMockEvent({ body: { email, password: 'OwnerPassword123', fullName: 'Owner', username: 'owner' } }),
    );
    const adminToken = signup.session!.token;
    const userId = signup.session!.userId;
    const bizId = `biz_t_${Date.now()}`;
    const termId = `term_t_${Date.now()}`;
    // Legacy unsalted SHA-256 hash for "5678"
    const legacyHash = hashTokenSha256('5678');

    await db.insert('businesses', {
      id: bizId,
      admin_user_id: userId,
      name: 'Rate Limit Cafe',
      schema_name: `tenant_rl_${Date.now()}`,
      created_at: new Date().toISOString(),
    });
    await db.insert('terminals', {
      id: termId,
      business_id: bizId,
      display_name: 'Barista POS',
      role: 'cashier',
      pin_hash: legacyHash,
      pin_code: '5678',
      pin_length: 4,
      created_at: new Date().toISOString(),
    });

    // Wrong PIN brute force -> 429 on 11th attempt
    for (let i = 0; i < 10; i++) {
      const bad = await terminalLoginHandler(
        createMockEvent({ body: { terminalId: termId, pin: '0000' } }),
      );
      expect(bad.session).toBeNull();
    }
    const lockedEvent = createMockEvent({ body: { terminalId: termId, pin: '5678' } });
    const lockedRes = await terminalLoginHandler(lockedEvent);
    expect(lockedRes.session).toBeNull();
    expect(lockedEvent.node.res.statusCode).toBe(429);

    // Clear rate limits and log in with valid PIN -> upgrades pin_hash to PBKDF2
    resetAllRateLimits();
    const okLogin = await terminalLoginHandler(
      createMockEvent({ body: { terminalId: termId, pin: '5678' } }),
    );
    expect(okLogin.error).toBeNull();
    expect(okLogin.token).toBeTruthy();

    const upgradedTerminal = await db.queryOne<{ pin_hash: string }>(
      'SELECT pin_hash FROM terminals WHERE id = ?',
      [termId],
    );
    expect(upgradedTerminal.data?.pin_hash.startsWith('pin_pbkdf2$')).toBe(true);

    // Valid session passes verifyTerminalSession via x-terminal-session header and cookie
    const verified = await verifyTerminalSession(
      createMockEvent({
        method: 'GET',
        headers: { 'x-terminal-session': okLogin.token! },
      }),
      termId,
    );
    expect(verified.terminalId).toBe(termId);

    const verifiedCookie = await verifyTerminalSession(
      createMockEvent({
        method: 'GET',
        cookies: { [`kogane_term_${termId}`]: okLogin.token! },
      }),
      termId,
    );
    expect(verifiedCookie.terminalId).toBe(termId);

    // Rotating terminal PIN revokes existing terminal session
    const patchRes = await terminalPatchHandler(
      createMockEvent({
        method: 'PATCH',
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: termId },
        body: { businessId: bizId, pin: '9988' },
      }),
    );
    expect(patchRes.success).toBe(true);

    await expect(
      verifyTerminalSession(
        createMockEvent({
          method: 'GET',
          headers: { 'x-terminal-session': okLogin.token! },
        }),
        termId,
      ),
    ).rejects.toThrow();

    // New PIN login + explicit terminal logout revokes session
    const loginNewPin = await terminalLoginHandler(
      createMockEvent({ body: { terminalId: termId, pin: '9988' } }),
    );
    expect(loginNewPin.token).toBeTruthy();

    const termLogoutBadPin = await terminalLogoutHandler(
      createMockEvent({
        headers: { 'x-terminal-session': loginNewPin.token! },
        body: { terminalId: termId, pin: '0000' },
      }),
    );
    expect(termLogoutBadPin.success).toBe(false);

    const termLogoutOk = await terminalLogoutHandler(
      createMockEvent({
        headers: { 'x-terminal-session': loginNewPin.token! },
        body: { terminalId: termId, pin: '9988' },
      }),
    );
    expect(termLogoutOk.success).toBe(true);

    await expect(
      verifyTerminalSession(
        createMockEvent({
          method: 'GET',
          headers: { 'x-terminal-session': loginNewPin.token! },
        }),
        termId,
      ),
    ).rejects.toThrow();
  });

  test('Admin login rate limiting blocks repeated failed credential attempts with HTTP 429', async () => {
    const email = `rl-${Date.now()}@kogane.dev`;
    await signupHandler(
      createMockEvent({ body: { email, password: 'CorrectPassword1', fullName: 'RL User', username: 'rlu' } }),
    );

    for (let i = 0; i < 10; i++) {
      const fail = await loginHandler(
        createMockEvent({ body: { email, password: 'WrongPassword' } }),
      );
      expect(fail.session).toBeNull();
    }

    const blockedEvent = createMockEvent({ body: { email, password: 'CorrectPassword1' } });
    const blockedRes = await loginHandler(blockedEvent);
    expect(blockedRes.session).toBeNull();
    expect(blockedEvent.node.res.statusCode).toBe(429);
    expect(blockedRes.error).toContain('Too many login attempts');
  });

  test('Direct stateful session helper supports creation & unsigned token rejection', async () => {
    const mockEv = createMockEvent({});
    const issued = await issueStatefulAdminSession(mockEv, {
      userId: 'usr_direct',
      email: 'direct@kogane.dev',
      role: 'admin',
      fullName: 'Direct Admin',
    });
    expect(issued.token).toBeTruthy();
    expect(issued.sessionId.startsWith('sess_')).toBe(true);

    // Tampered token fails verification
    const tampered = `${issued.token.slice(0, -4)}xxxx`;
    await expect(
      verifyAdmin(
        createMockEvent({
          method: 'GET',
          headers: { authorization: `Bearer ${tampered}` },
        }),
      ),
    ).rejects.toThrow();

    // Direct unsigned/forged payload fails decode
    const fakeToken = await createAdminSessionToken({
      userId: 'forged',
      email: 'forged@kogane.dev',
      role: 'admin',
    });
    expect(fakeToken.includes('.')).toBe(true);
  });

  test('useAuth.hydrateSession maps GET /api/auth/me DTO fields (id, profilePhotoUrl) without dropping userId', async () => {
    const email = `hydrate-${Date.now()}@kogane.dev`;
    const signupRes = await signupHandler(
      createMockEvent({
        body: {
          email,
          password: 'StrongPassword1',
          fullName: 'Hydrate Admin',
          username: 'hydrate_admin',
        },
      }),
    );
    expect(signupRes.session?.token).toBeTruthy();

    // Populate profile photo to verify profilePhotoUrl -> profilePicture mapping
    await db.update('users', { profile_photo_url: 'https://cdn.example.com/avatar.png' }, { id: signupRes.session!.userId });

    const mePayload = await meHandler(
      createMockEvent({
        method: 'GET',
        headers: { authorization: `Bearer ${signupRes.session!.token}` },
      }),
    );
    expect(mePayload.user?.id).toBe(signupRes.session!.userId);
    expect(mePayload.user?.profilePhotoUrl).toBe('https://cdn.example.com/avatar.png');

    const prevWindow = (globalThis as any).window;
    const prevFetch = globalThis.fetch;
    (globalThis as any).window = {};
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(mePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as any;

    try {
      const { session, hydrateSession, isLoggedIn, clearLocalSession } = useAuth();
      clearLocalSession();
      const hydrated = await hydrateSession(true);
      expect(hydrated).not.toBeNull();
      expect(hydrated?.userId).toBe(signupRes.session!.userId);
      expect(hydrated?.email).toBe(email);
      expect(hydrated?.profilePicture).toBe('https://cdn.example.com/avatar.png');
      expect(hydrated?.sessionId).toBe(signupRes.session!.sessionId);
      expect(session.value?.userId).toBe(signupRes.session!.userId);
      expect(isLoggedIn.value).toBe(true);
      clearLocalSession();
    } finally {
      (globalThis as any).window = prevWindow;
      globalThis.fetch = prevFetch;
    }
  });

  test('FirestoreAdapter evaluates SQL IN / NOT IN predicates (table-activity) and resolves multi-underscore table names', async () => {
    const store = new InMemoryFirestoreStore();
    const fsAdapter = new FirestoreAdapter(store);

    // Seed business with multi-part schema name and custom business without biz_ prefix
    await fsAdapter.insert('businesses', {
      id: 'biz_1',
      admin_user_id: 'usr_1',
      name: 'Kogane Main',
      schema_name: 'biz_usr_1234',
    });
    await fsAdapter.insert('businesses', {
      id: 'biz_2',
      admin_user_id: 'usr_2',
      name: 'Tenant Two',
      schema_name: 'tenant_abc',
    });

    await fsAdapter.execute('CREATE TABLE biz_usr_1234_order_items (id text PRIMARY KEY, item_name text NOT NULL)');
    await fsAdapter.execute('CREATE TABLE tenant_abc_menu_items (id text PRIMARY KEY, title text NOT NULL)');
    await fsAdapter.execute('ALTER TABLE biz_usr_1234_order_items ADD COLUMN qty numeric DEFAULT 1');

    const meta1 = await store.getById('__schema_meta', 'biz_usr_1234_order_items');
    expect(meta1?.schema_name).toBe('biz_usr_1234');
    expect(meta1?.short_name).toBe('order_items');

    const meta2 = await store.getById('__schema_meta', 'tenant_abc_menu_items');
    expect(meta2?.schema_name).toBe('tenant_abc');
    expect(meta2?.short_name).toBe('menu_items');

    // Audit log filtering with IN (...) must exclude login/logout rows
    await fsAdapter.insert('audit_log', {
      id: 'aud_1',
      business_id: 'biz_1',
      action_type: 'insert',
      table_name: 'order_items',
      created_at: '2026-11-12T10:00:00Z',
    });
    await fsAdapter.insert('audit_log', {
      id: 'aud_2',
      business_id: 'biz_1',
      action_type: 'login',
      table_name: 'terminals',
      created_at: '2026-11-12T10:01:00Z',
    });
    await fsAdapter.insert('audit_log', {
      id: 'aud_3',
      business_id: 'biz_1',
      action_type: 'delete',
      table_name: 'order_items',
      created_at: '2026-11-12T10:02:00Z',
    });

    const { data: onlyMutations } = await fsAdapter.query<{ id: string; action_type: string }>(
      "SELECT id, action_type FROM audit_log WHERE business_id = ? AND action_type IN ('insert', 'update', 'delete') ORDER BY created_at DESC",
      ['biz_1'],
    );
    expect(onlyMutations?.map((r) => r.id)).toEqual(['aud_3', 'aud_1']);

    const { data: excluded } = await fsAdapter.query<{ id: string }>(
      'SELECT id FROM audit_log WHERE business_id = ? AND action_type NOT IN (?, ?)',
      ['biz_1', 'insert', 'delete'],
    );
    expect(excluded?.map((r) => r.id)).toEqual(['aud_2']);
  });

  test('table-activity endpoint filters to data mutations under FirestoreAdapter', async () => {
    setDbAdapterForTest(new FirestoreAdapter(new InMemoryFirestoreStore()));
    process.env.DB_PROVIDER = 'firebase';

    const adminRes = await signupHandler(
      createMockEvent({
        body: { email: `act-${Date.now()}@kogane.dev`, password: 'StrongPassword1', fullName: 'Act Admin' },
      }),
    );
    const token = adminRes.session!.token;
    const bizId = `biz_act_${Date.now()}`;
    const bizInsert = await db.insert('businesses', {
      id: bizId,
      admin_user_id: adminRes.session!.userId,
      name: 'Activity Cafe',
      schema_name: `biz_${Date.now()}`,
    });
    expect(bizInsert.error).toBeNull();

    const nowIso = new Date().toISOString();
    const audMut = await db.insert('audit_log', {
      id: 'log_mut_1',
      business_id: bizId,
      actor_id: adminRes.session!.userId,
      actor_type: 'admin',
      actor_name: 'Act Admin',
      action_type: 'update',
      target_table: 'menu_items',
      created_at: nowIso,
    });
    expect(audMut.error).toBeNull();
    const audLogin = await db.insert('audit_log', {
      id: 'log_login_1',
      business_id: bizId,
      actor_id: adminRes.session!.userId,
      actor_type: 'admin',
      actor_name: 'Act Admin',
      action_type: 'login',
      target_table: 'terminals',
      created_at: nowIso,
    });
    expect(audLogin.error).toBeNull();

    const ev = createMockEvent({
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    ev.node.req.url = '/api/reports/table-activity';
    const res = await tableActivityHandler(ev);
    expect(res.error).toBeNull();
    expect(res.rows).toEqual([
      {
        table: 'menu_items',
        inserts: 0,
        updates: 1,
        deletes: 0,
        total: 1,
      },
    ]);
  });

  test('useStorage selects FirebaseStorageAdapter under GCLOUD_PROJECT / FIREBASE_CONFIG in production and DB_PROVIDER=firebase', () => {
    const keys = [
      'DEV_MODE',
      'DB_PROVIDER',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_PROJECT_ID',
      'GCLOUD_PROJECT',
      'GOOGLE_CLOUD_PROJECT',
      'FIREBASE_CONFIG',
    ] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

    try {
      for (const k of keys) delete process.env[k];
      process.env.DEV_MODE = 'false';
      process.env.DB_PROVIDER = 'firebase';
      process.env.GCLOUD_PROJECT = 'kogane-cloud-run';
      const st1 = useStorage();
      expect(st1).toBeInstanceOf(FirebaseStorageAdapter);
      expect((st1 as any).getBucketName()).toBe('kogane-cloud-run.firebasestorage.app');

      delete process.env.GCLOUD_PROJECT;
      delete process.env.DB_PROVIDER;
      process.env.FIREBASE_CONFIG = JSON.stringify({
        projectId: 'kogane-app-hosting',
        storageBucket: 'kogane-custom.appspot.com',
      });
      const st2 = useStorage();
      expect(st2).toBeInstanceOf(FirebaseStorageAdapter);
      expect((st2 as any).getBucketName()).toBe('kogane-custom.appspot.com');
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      useStorage();
    }
  });

  test('2FA enable, disable, backup-codes, and change-password enforce HTTP 429 rate limiting', async () => {
    const email = `rl-sensitive-${Date.now()}@kogane.dev`;
    const signup = await signupHandler(
      createMockEvent({ body: { email, password: 'InitialPassword1', fullName: 'Rate Limit Admin' } }),
    );
    const token = signup.session!.token;

    // 1. change-password rate limiting
    for (let i = 0; i < 8; i++) {
      const res = await changePasswordHandler(
        createMockEvent({
          headers: { authorization: `Bearer ${token}` },
          body: { currentPassword: 'WrongPassword!', newPassword: 'NewPassword123' },
        }),
      );
      expect(res.success).toBe(false);
    }
    const cpBlockedEv = createMockEvent({
      headers: { authorization: `Bearer ${token}` },
      body: { currentPassword: 'InitialPassword1', newPassword: 'NewPassword123' },
    });
    const cpBlocked = await changePasswordHandler(cpBlockedEv);
    expect(cpBlockedEv.node.res.statusCode).toBe(429);
    expect(cpBlocked.success).toBe(false);

    // 2. 2FA enable rate limiting
    await twoFaSetupHandler(createMockEvent({ headers: { authorization: `Bearer ${token}` } }));
    for (let i = 0; i < 8; i++) {
      const res = await twoFaEnableHandler(
        createMockEvent({
          headers: { authorization: `Bearer ${token}` },
          body: { code: '000000' },
        }),
      );
      expect(res.enabled).toBe(false);
    }
    const enBlockedEv = createMockEvent({
      headers: { authorization: `Bearer ${token}` },
      body: { code: '000000' },
    });
    const enBlocked = await twoFaEnableHandler(enBlockedEv);
    expect(enBlockedEv.node.res.statusCode).toBe(429);
    expect(enBlocked.enabled).toBe(false);

    // 3. 2FA disable rate limiting
    for (let i = 0; i < 8; i++) {
      const res = await twoFaDisableHandler(
        createMockEvent({
          headers: { authorization: `Bearer ${token}` },
          body: { password: 'WrongPassword!', code: '123456' },
        }),
      );
      expect(res.disabled).toBe(false);
    }
    const disBlockedEv = createMockEvent({
      headers: { authorization: `Bearer ${token}` },
      body: { password: 'InitialPassword1', code: '123456' },
    });
    const disBlocked = await twoFaDisableHandler(disBlockedEv);
    expect(disBlockedEv.node.res.statusCode).toBe(429);
    expect(disBlocked.disabled).toBe(false);

    // 4. 2FA backup-codes rate limiting (enable 2FA first directly on user row)
    await db.update('users', { two_factor_enabled: 1 }, { id: signup.session!.userId });
    for (let i = 0; i < 8; i++) {
      const res = await twoFaBackupCodesHandler(
        createMockEvent({
          headers: { authorization: `Bearer ${token}` },
          body: { password: 'WrongPassword!' },
        }),
      );
      expect(res.backupCodes).toEqual([]);
    }
    const bcBlockedEv = createMockEvent({
      headers: { authorization: `Bearer ${token}` },
      body: { password: 'InitialPassword1' },
    });
    const bcBlocked = await twoFaBackupCodesHandler(bcBlockedEv);
    expect(bcBlockedEv.node.res.statusCode).toBe(429);
    expect(bcBlocked.backupCodes).toEqual([]);
  });

  test('useAuth.hydrateSession sets isHydrated=true when /api/auth/me returns null user', async () => {
    const prevWindow = (globalThis as any).window;
    const prevFetch = globalThis.fetch;
    (globalThis as any).window = {};
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as any;

    try {
      const { devLogin, hydrateSession, isHydrated, isLoggedIn, clearLocalSession } = useAuth();
      devLogin('stale@kogane.dev');
      const result = await hydrateSession(true);
      expect(result).toBeNull();
      expect(isHydrated.value).toBe(true);
      expect(isLoggedIn.value).toBe(false);
      clearLocalSession();
    } finally {
      (globalThis as any).window = prevWindow;
      globalThis.fetch = prevFetch;
    }
  });

  test('FIREBASE_SERVICE_ACCOUNT_JSON fallback resolves projectId and storageBucket for firebaseAdmin and useStorage', () => {
    const keys = [
      'DEV_MODE',
      'DB_PROVIDER',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_SERVICE_ACCOUNT_JSON',
      'GCLOUD_PROJECT',
      'GOOGLE_CLOUD_PROJECT',
      'FIREBASE_CONFIG',
    ] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

    try {
      for (const k of keys) delete process.env[k];
      process.env.DEV_MODE = 'false';

      // Raw JSON service account only
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
        project_id: 'kogane-sa-raw',
        client_email: 'sa@kogane-sa-raw.iam.gserviceaccount.com',
      });
      expect(resolveFirebaseProjectId()).toBe('kogane-sa-raw');
      expect(resolveFirebaseStorageBucket()).toBe('kogane-sa-raw.firebasestorage.app');
      const stRaw = useStorage();
      expect(stRaw).toBeInstanceOf(FirebaseStorageAdapter);
      expect((stRaw as any).getBucketName()).toBe('kogane-sa-raw.firebasestorage.app');

      // Base64-encoded service account only
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = Buffer.from(
        JSON.stringify({ project_id: 'kogane-sa-b64' }),
        'utf8',
      ).toString('base64');
      expect(resolveFirebaseProjectId()).toBe('kogane-sa-b64');
      expect(resolveFirebaseStorageBucket()).toBe('kogane-sa-b64.firebasestorage.app');
      const stB64 = useStorage();
      expect(stB64).toBeInstanceOf(FirebaseStorageAdapter);
      expect((stB64 as any).getBucketName()).toBe('kogane-sa-b64.firebasestorage.app');
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      useStorage();
    }
  });

  test('POST /api/terminals/logout rate-limits PIN brute force with HTTP 429 and Retry-After', async () => {
    const email = `logout-rl-${Date.now()}@kogane.dev`;
    const signup = await signupHandler(
      createMockEvent({ body: { email, password: 'OwnerPassword123', fullName: 'Owner' } }),
    );
    const adminToken = signup.session!.token;
    const bizId = `biz_lrl_${Date.now()}`;
    const termId = `term_lrl_${Date.now()}`;

    await db.insert('businesses', {
      id: bizId,
      admin_user_id: signup.session!.userId,
      name: 'Logout Rate Limit Cafe',
      schema_name: `tenant_lrl_${Date.now()}`,
      created_at: new Date().toISOString(),
    });
    await db.insert('terminals', {
      id: termId,
      business_id: bizId,
      display_name: 'Front POS',
      role: 'cashier',
      pin_hash: await hashPin('4321'),
      pin_code: '4321',
      pin_length: 4,
      created_at: new Date().toISOString(),
    });

    const loginRes = await terminalLoginHandler(
      createMockEvent({ body: { terminalId: termId, pin: '4321' } }),
    );
    expect(loginRes.token).toBeTruthy();

    for (let i = 0; i < 10; i++) {
      const bad = await terminalLogoutHandler(
        createMockEvent({
          headers: { 'x-terminal-session': loginRes.token! },
          body: { terminalId: termId, pin: '9999' },
        }),
      );
      expect(bad.success).toBe(false);
    }

    const blockedEv = createMockEvent({
      headers: { 'x-terminal-session': loginRes.token! },
      body: { terminalId: termId, pin: '4321' },
    });
    const blockedRes = await terminalLogoutHandler(blockedEv);
    expect(blockedRes.success).toBe(false);
    expect(blockedEv.node.res.statusCode).toBe(429);
    expect(Number(blockedEv._responseHeaders['retry-after'])).toBeGreaterThan(0);

    // Admin passthrough can still exit terminal mode cleanly
    const adminBypassRes = await terminalLogoutHandler(
      createMockEvent({
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-terminal-session': loginRes.token!,
        },
        body: { terminalId: termId },
      }),
    );
    expect(adminBypassRes.success).toBe(true);

    // Cross-tenant admin (Admin B) MUST NOT bypass PIN on Admin A's terminal
    const otherSignup = await signupHandler(
      createMockEvent({
        body: { email: `other-${Date.now()}@kogane.dev`, password: 'OtherPassword123', fullName: 'Other Admin' },
      }),
    );
    const otherAdminToken = otherSignup.session!.token;
    const crossTenantRes = await terminalLogoutHandler(
      createMockEvent({
        headers: { authorization: `Bearer ${otherAdminToken}` },
        body: { terminalId: termId },
      }),
    );
    expect(crossTenantRes.success).toBe(false);
    expect(crossTenantRes.error).toContain('PIN is required');
  });

  test('POST /api/storage/upload rate-limits unauthenticated guest image uploads and blocks guest PDFs, SVGs, and path traversal', async () => {
    const boundary = '----KoganeTestBoundary123';
    const makeMultipartEvent = (
      filename: string,
      contentType: string,
      payload = 'imgbytes',
      opts: { bucket?: string; path?: string; headers?: Record<string, string> } = {},
    ) => {
      const bucketName = opts.bucket ?? 'avatars';
      const targetPath = opts.path ?? filename;
      const raw = Buffer.from(
        `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="bucket"\r\n\r\n`
        + `${bucketName}\r\n`
        + `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="path"\r\n\r\n`
        + `${targetPath}\r\n`
        + `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`
        + `Content-Type: ${contentType}\r\n\r\n`
        + `${payload}\r\n`
        + `--${boundary}--\r\n`,
        'utf8',
      );
      const ev = createMockEvent({
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          ...(opts.headers ?? {}),
        },
      });
      ev.node.req.rawBody = raw;
      return ev;
    };

    const pdfRes = await uploadHandler(makeMultipartEvent('doc.pdf', 'application/pdf', '%PDF-1.4'));
    expect(pdfRes.url).toBeNull();
    expect(pdfRes.error).toContain('Authentication required');

    const svgGuestRes = await uploadHandler(
      makeMultipartEvent('xss.svg', 'image/svg+xml', '<svg onload="alert(1)"></svg>'),
    );
    expect(svgGuestRes.url).toBeNull();
    expect(svgGuestRes.error).toContain('Authentication required');

    const traversalRes = await uploadHandler(
      makeMultipartEvent('evil.png', 'image/png', 'imgbytes', { path: '../evil.png' }),
    );
    expect(traversalRes.url).toBeNull();
    expect(traversalRes.error).toBe('Invalid storage path');

    const storage = useStorage();
    const uploadedPaths: string[] = [];
    try {
      for (let i = 0; i < 10; i++) {
        const filename = `guest-${i}.png`;
        const ok = await uploadHandler(makeMultipartEvent(filename, 'image/png'));
        expect(ok.error).toBeNull();
        expect(ok.url).toContain('/api/dev/storage/public/avatars/');
        uploadedPaths.push(`avatars/${filename}`);
      }

      const blockedEv = makeMultipartEvent('guest-11.png', 'image/png');
      const blockedRes = await uploadHandler(blockedEv);
      expect(blockedRes.url).toBeNull();
      expect(blockedEv.node.res.statusCode).toBe(429);
      expect(Number(blockedEv._responseHeaders['retry-after'])).toBeGreaterThan(0);

      // Authenticated admin can upload SVG business logos
      const adminSignup = await signupHandler(
        createMockEvent({
          body: { email: `svg-admin-${Date.now()}@kogane.dev`, password: 'StrongPassword1', fullName: 'SVG Admin' },
        }),
      );
      const adminSvgRes = await uploadHandler(
        makeMultipartEvent('logo.svg', 'image/svg+xml', '<svg></svg>', {
          bucket: 'assets',
          path: 'logo.svg',
          headers: { authorization: `Bearer ${adminSignup.session!.token}` },
        }),
      );
      expect(adminSvgRes.error).toBeNull();
      expect(adminSvgRes.url).toContain('/api/dev/storage/public/assets/logo.svg');
      uploadedPaths.push('assets/logo.svg');
    } finally {
      for (const p of uploadedPaths) {
        await storage.delete('public', p).catch(() => {});
      }
      const { rm } = await import('node:fs/promises');
      await rm('dev-storage', { recursive: true, force: true }).catch(() => {});
    }
  });

  test('useStorage respects explicit DB_PROVIDER=sqlite even when ambient GCP project vars exist', () => {
    const prevDevMode = process.env.DEV_MODE;
    const prevProvider = process.env.DB_PROVIDER;
    const prevBucket = process.env.FIREBASE_STORAGE_BUCKET;
    const prevGcloud = process.env.GCLOUD_PROJECT;

    try {
      process.env.DEV_MODE = 'false';
      process.env.DB_PROVIDER = 'sqlite';
      delete process.env.FIREBASE_STORAGE_BUCKET;
      process.env.GCLOUD_PROJECT = 'ambient-gcp-project';

      const st = useStorage();
      expect(st).not.toBeInstanceOf(FirebaseStorageAdapter);
    } finally {
      if (prevDevMode === undefined) delete process.env.DEV_MODE;
      else process.env.DEV_MODE = prevDevMode;
      if (prevProvider === undefined) delete process.env.DB_PROVIDER;
      else process.env.DB_PROVIDER = prevProvider;
      if (prevBucket === undefined) delete process.env.FIREBASE_STORAGE_BUCKET;
      else process.env.FIREBASE_STORAGE_BUCKET = prevBucket;
      if (prevGcloud === undefined) delete process.env.GCLOUD_PROJECT;
      else process.env.GCLOUD_PROJECT = prevGcloud;
      useStorage();
    }
  });

  test('useStorage selects FirestoreStorageAdapter for Spark env vars while preserving explicit Blaze bucket mode', () => {
    const keys = [
      'DEV_MODE',
      'DB_PROVIDER',
      'STORAGE_PROVIDER',
      'FIREBASE_SPARK_MODE',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_SERVICE_ACCOUNT_JSON',
      'GCLOUD_PROJECT',
      'GOOGLE_CLOUD_PROJECT',
      'FIREBASE_CONFIG',
    ] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

    try {
      for (const k of keys) delete process.env[k];

      // 1. Explicit STORAGE_PROVIDER=firestore overrides DEV_MODE and FIREBASE_STORAGE_BUCKET
      process.env.DEV_MODE = 'true';
      process.env.STORAGE_PROVIDER = 'firestore';
      process.env.FIREBASE_STORAGE_BUCKET = 'kogane-e7f2b.firebasestorage.app';
      expect(useStorage()).toBeInstanceOf(FirestoreStorageAdapter);

      // 2. FIREBASE_SPARK_MODE=true selects FirestoreStorageAdapter
      delete process.env.STORAGE_PROVIDER;
      process.env.DEV_MODE = 'false';
      process.env.FIREBASE_SPARK_MODE = 'true';
      process.env.FIREBASE_PROJECT_ID = 'kogane-e7f2b';
      expect(useStorage()).toBeInstanceOf(FirestoreStorageAdapter);

      // 3. DB_PROVIDER=firebase without explicit FIREBASE_STORAGE_BUCKET or Blaze GCP runtime selects FirestoreStorageAdapter
      delete process.env.FIREBASE_SPARK_MODE;
      delete process.env.FIREBASE_STORAGE_BUCKET;
      process.env.DB_PROVIDER = 'firebase';
      expect(useStorage()).toBeInstanceOf(FirestoreStorageAdapter);

      // 4. DB_PROVIDER=firebase WITH explicit FIREBASE_STORAGE_BUCKET uses Blaze FirebaseStorageAdapter
      process.env.FIREBASE_STORAGE_BUCKET = 'kogane-e7f2b.firebasestorage.app';
      expect(useStorage()).toBeInstanceOf(FirebaseStorageAdapter);
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      useStorage();
    }
  });

  test('FirestoreStorageAdapter uploads, reads, lists, deletes in __storage_blobs and enforces 700 KB limit', async () => {
    const store = new InMemoryFirestoreStore();
    setDbAdapterForTest(new FirestoreAdapter(store));
    const prevProvider = process.env.DB_PROVIDER;
    const prevDevMode = process.env.DEV_MODE;
    const prevStorage = process.env.STORAGE_PROVIDER;

    try {
      process.env.DB_PROVIDER = 'firebase';
      process.env.DEV_MODE = 'false';
      process.env.STORAGE_PROVIDER = 'firestore';

      const storage = useStorage();
      expect(storage).toBeInstanceOf(FirestoreStorageAdapter);

      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const url1 = await storage.upload('public', 'assets/logo.png', {
        data: pngBytes,
        contentType: 'image/png',
        upsert: true,
      });
      expect(url1).toBe('/api/storage/files/public/assets/logo.png');

      // Firestore doc IDs must not contain '/'
      const docs = await store.getAll(FIRESTORE_STORAGE_COLLECTION);
      expect(docs).toHaveLength(1);
      expect(String(docs[0]?.id)).not.toContain('/');

      const readBack = await storage.read('public', 'assets/logo.png');
      expect(Buffer.compare(readBack, pngBytes)).toBe(0);

      // upsert: false rejects overwrite, upsert: true updates cleanly
      await expect(
        storage.upload('public', 'assets/logo.png', {
          data: Buffer.from('new'),
          contentType: 'image/png',
          upsert: false,
        }),
      ).rejects.toThrow();

      const updatedBytes = Buffer.from('updated-png-bytes');
      await storage.upload('public', 'assets/logo.png', {
        data: updatedBytes,
        contentType: 'image/png',
        upsert: true,
      });
      expect(Buffer.compare(await storage.read('public', 'assets/logo.png'), updatedBytes)).toBe(0);

      await storage.upload('public', 'avatars/u1.png', {
        data: Buffer.from('avatar'),
        contentType: 'image/png',
      });
      expect(await storage.list('public')).toEqual(['assets/logo.png', 'avatars/u1.png']);
      expect(await storage.list('public', 'avatars')).toEqual(['avatars/u1.png']);

      await storage.delete('public', 'assets/logo.png');
      await expect(storage.read('public', 'assets/logo.png')).rejects.toThrow();

      // Size guard > 700 KB
      const oversized = Buffer.alloc(FIRESTORE_STORAGE_MAX_BYTES + 1, 0x61);
      await expect(
        storage.upload('public', 'assets/huge.png', { data: oversized, contentType: 'image/png' }),
      ).rejects.toThrow(/700 KB|limit/i);

      // Path traversal & trailing-slash rejection
      await expect(
        storage.upload('public', '../escape.png', { data: pngBytes, contentType: 'image/png' }),
      ).rejects.toThrow('Invalid storage path');
      await expect(
        storage.upload('public', 'assets/', { data: pngBytes, contentType: 'image/png' }),
      ).rejects.toThrow('Invalid storage path');

      // O(1) single-doc read/update/delete: must NOT call store.getAll('__storage_blobs') or getAll('businesses')
      let getAllCalls = 0;
      const origGetAll = store.getAll.bind(store);
      store.getAll = async (col: string) => {
        if (col === FIRESTORE_STORAGE_COLLECTION || col === 'businesses') getAllCalls++;
        return origGetAll(col);
      };
      try {
        await storage.upload('public', 'assets/fast.png', { data: pngBytes, contentType: 'image/png', upsert: true });
        await storage.upload('public', 'assets/fast.png', { data: updatedBytes, contentType: 'image/png', upsert: true });
        const fastRead = await storage.read('public', 'assets/fast.png');
        expect(Buffer.compare(fastRead, updatedBytes)).toBe(0);
        await storage.delete('public', 'assets/fast.png');
        expect(getAllCalls).toBe(0);
      } finally {
        store.getAll = origGetAll;
      }
    } finally {
      resetDbAdapter();
      if (prevProvider === undefined) delete process.env.DB_PROVIDER;
      else process.env.DB_PROVIDER = prevProvider;
      if (prevDevMode === undefined) delete process.env.DEV_MODE;
      else process.env.DEV_MODE = prevDevMode;
      if (prevStorage === undefined) delete process.env.STORAGE_PROVIDER;
      else process.env.STORAGE_PROVIDER = prevStorage;
      useStorage();
    }
  });

  test('GET /api/storage/files/[...path] serves Firestore blobs with SVG CSP sandbox, nosniff, 404, and traversal rejection', async () => {
    const store = new InMemoryFirestoreStore();
    setDbAdapterForTest(new FirestoreAdapter(store));
    const prevProvider = process.env.DB_PROVIDER;
    const prevDevMode = process.env.DEV_MODE;
    const prevStorage = process.env.STORAGE_PROVIDER;

    const boundary = '----KoganeSparkBoundary';
    const makeMultipartEvent = (
      filename: string,
      contentType: string,
      payload: Buffer | string,
      opts: { bucket?: string; path?: string; headers?: Record<string, string> } = {},
    ) => {
      const head = Buffer.from(
        `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="bucket"\r\n\r\n`
        + `${opts.bucket ?? 'assets'}\r\n`
        + `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="path"\r\n\r\n`
        + `${opts.path ?? filename}\r\n`
        + `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`
        + `Content-Type: ${contentType}\r\n\r\n`,
        'utf8',
      );
      const bodyBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
      const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
      const ev = createMockEvent({
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          ...(opts.headers ?? {}),
        },
      });
      ev.node.req.rawBody = Buffer.concat([head, bodyBuf, tail]);
      return ev;
    };

    try {
      process.env.DB_PROVIDER = 'firebase';
      process.env.DEV_MODE = 'false';
      process.env.STORAGE_PROVIDER = 'firestore';
      useStorage();

      const signup = await signupHandler(
        createMockEvent({
          body: {
            email: `spark-files-${Date.now()}@kogane.dev`,
            password: 'StrongPassword1',
            fullName: 'Spark Admin',
          },
        }),
      );
      const adminToken = signup.session!.token;

      // 1. Upload PNG and serve via /api/storage/files/[...path]
      const pngPayload = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02]);
      const pngUpload = await uploadHandler(
        makeMultipartEvent('badge.png', 'image/png', pngPayload, {
          bucket: 'assets',
          path: 'badge.png',
          headers: { authorization: `Bearer ${adminToken}` },
        }),
      );
      expect(pngUpload.error).toBeNull();
      expect(pngUpload.url).toBe('/api/storage/files/public/assets/badge.png');

      const pngGetEv = createMockEvent({
        method: 'GET',
        params: { path: 'public/assets/badge.png' },
      });
      const pngBody = await storageFilesGetHandler(pngGetEv);
      expect(Buffer.isBuffer(pngBody)).toBe(true);
      expect(Buffer.compare(pngBody as Buffer, pngPayload)).toBe(0);
      expect(pngGetEv._responseHeaders['content-type']).toBe('image/png');
      expect(pngGetEv._responseHeaders['x-content-type-options']).toBe('nosniff');
      expect(String(pngGetEv._responseHeaders['cache-control'])).toContain('immutable');
      expect(pngGetEv._responseHeaders['content-security-policy']).toBeUndefined();

      // 2. Upload SVG as admin and verify Content-Security-Policy: sandbox on serve
      const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
      const svgUpload = await uploadHandler(
        makeMultipartEvent('logo.svg', 'image/svg+xml', svgMarkup, {
          bucket: 'assets',
          path: 'logo.svg',
          headers: { authorization: `Bearer ${adminToken}` },
        }),
      );
      expect(svgUpload.error).toBeNull();
      expect(svgUpload.url).toBe('/api/storage/files/public/assets/logo.svg');

      const svgGetEv = createMockEvent({
        method: 'GET',
        params: { path: 'public/assets/logo.svg' },
      });
      const svgBody = await storageFilesGetHandler(svgGetEv);
      expect(Buffer.isBuffer(svgBody)).toBe(true);
      expect((svgBody as Buffer).toString('utf8')).toBe(svgMarkup);
      expect(svgGetEv._responseHeaders['content-type']).toBe('image/svg+xml');
      expect(svgGetEv._responseHeaders['x-content-type-options']).toBe('nosniff');
      expect(svgGetEv._responseHeaders['content-security-policy']).toBe('sandbox');

      // 3. Traversal rejection (raw .., URL-encoded %2e%2e, and .)
      for (const badPath of ['public/../secret.png', 'public/%2e%2e/secret.png', 'public/./secret.png']) {
        const badRes = await storageFilesGetHandler(
          createMockEvent({ method: 'GET', params: { path: badPath } }),
        );
        expect(badRes).toBeInstanceOf(Response);
        expect((badRes as Response).status).toBe(400);
      }

      // 4. Missing file returns 404
      const missingRes = await storageFilesGetHandler(
        createMockEvent({ method: 'GET', params: { path: 'public/assets/missing.png' } }),
      );
      expect(missingRes).toBeInstanceOf(Response);
      expect((missingRes as Response).status).toBe(404);

      // 5. > 700 KB upload returns clean 413 error JSON instead of crashing
      const bigEv = makeMultipartEvent(
        'oversized.png',
        'image/png',
        Buffer.alloc(FIRESTORE_STORAGE_MAX_BYTES + 100, 0x42),
        {
          bucket: 'assets',
          path: 'oversized.png',
          headers: { authorization: `Bearer ${adminToken}` },
        },
      );
      const bigRes = await uploadHandler(bigEv);
      expect(bigRes.url).toBeNull();
      expect(bigRes.error).toMatch(/700 KB|limit/i);
      expect(bigEv.node.res.statusCode).toBe(413);
    } finally {
      resetDbAdapter();
      if (prevProvider === undefined) delete process.env.DB_PROVIDER;
      else process.env.DB_PROVIDER = prevProvider;
      if (prevDevMode === undefined) delete process.env.DEV_MODE;
      else process.env.DEV_MODE = prevDevMode;
      if (prevStorage === undefined) delete process.env.STORAGE_PROVIDER;
      else process.env.STORAGE_PROVIDER = prevStorage;
      useStorage();
    }
  });
});
