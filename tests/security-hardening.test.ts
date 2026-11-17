/**
 * Regression tests for the security hardening pass: dev backdoors, session secrets,
 * the live data stream, terminal binding, rate limiting and private file URLs.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyAdmin } from '../lib/authUtils';
import { db } from '../lib/db';
import { clearRateLimit, getClientIp, resetAllRateLimits } from '../lib/rateLimit';
import { decryptSecret, getSessionSecret, isStrongSecret } from '../lib/security';
import loginHandler from '../server/api/auth/login.post';
import terminalLoginHandler from '../server/api/terminals/login.post';
import streamHandler from '../server/api/realtime/stream.get';
import { serveStorageFile } from '../server/utils/storageServe';
import { createTestTerminalToken } from './helpers/sessions';

function mockEvent(opts: {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
  remoteAddress?: string;
  params?: Record<string, unknown>;
} = {}) {
  const method = opts.method ?? 'POST';
  const url = opts.url ?? '/';
  const body = opts.body;
  return {
    method,
    path: url,
    node: {
      req: {
        method,
        url,
        headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
        socket: { remoteAddress: opts.remoteAddress ?? '10.0.0.5' },
        body,
        [Symbol.for('h3ParsedBody')]: body,
      },
      res: { setHeader: () => {}, getHeader: () => undefined },
    },
    context: { body, params: opts.params ?? {} },
    _body: body,
    [Symbol.for('h3ParsedBody')]: body,
  } as any;
}

const ENV_KEYS = ['NODE_ENV', 'BUN_ENV', 'DB_PROVIDER', 'SESSION_SECRET', 'ENCRYPTION_KEY', 'TRUST_PROXY', 'KOGANE_SECRET_FILE'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  resetAllRateLimits();
});

describe('Dev backdoors', () => {
  test('dev-admin-token is rejected by a running server, whatever DEV_MODE says', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.BUN_ENV;
    process.env.DEV_MODE = 'true';
    try {
      await expect(
        verifyAdmin(mockEvent({ headers: { authorization: 'Bearer dev-admin-token' } })),
      ).rejects.toMatchObject({ statusCode: 401 });
    } finally {
      process.env.DEV_MODE = 'true';
    }
  });
});

describe('Session secrets', () => {
  test('placeholder and short secrets are not strong', () => {
    expect(isStrongSecret('change-this-to-a-64-char-random-secret-in-production')).toBe(false);
    expect(isStrongSecret('kogane-dev-secret')).toBe(false);
    expect(isStrongSecret('short')).toBe(false);
    expect(isStrongSecret(randomBytes(32).toString('base64url'))).toBe(true);
  });

  test('an online (Firebase) production server refuses a weak or missing SESSION_SECRET', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_PROVIDER = 'firebase';
    process.env.SESSION_SECRET = 'change-this-to-a-64-char-random-secret-in-production';
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET/);
    delete process.env.SESSION_SECRET;
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET/);
  });

  test('a local install without a secret generates a private one and keeps it on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kogane-secret-'));
    try {
      process.env.DB_PROVIDER = 'sqlite';
      delete process.env.SESSION_SECRET;
      process.env.KOGANE_SECRET_FILE = join(dir, '.kogane-secret');
      const secret = getSessionSecret();
      expect(isStrongSecret(secret)).toBe(true);
      expect(secret).not.toBe('kogane-dev-secret');
      expect(readFileSync(process.env.KOGANE_SECRET_FILE, 'utf8').trim()).toBe(secret);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('2FA secrets encrypted under an old placeholder ENCRYPTION_KEY still decrypt', () => {
    const placeholder = 'change-this-to-a-different-64-char-random-encryption-key';
    const key = createHash('sha256').update(`kogane-aes-v1:${placeholder}`).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update('JBSWY3DPEHPK3PXP', 'utf8'), cipher.final()]);
    const ciphertext = `enc:v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;

    process.env.ENCRYPTION_KEY = placeholder;
    expect(decryptSecret(ciphertext)).toBe('JBSWY3DPEHPK3PXP');
  });
});

describe('Client IP and rate limiting', () => {
  test('X-Forwarded-For is ignored unless TRUST_PROXY says a proxy is in front', () => {
    const event = mockEvent({ headers: { 'x-forwarded-for': '6.6.6.6, 1.2.3.4, 9.9.9.9' }, remoteAddress: '10.0.0.5' });
    delete process.env.TRUST_PROXY;
    expect(getClientIp(event)).toBe('10.0.0.5');
    process.env.TRUST_PROXY = '1';
    expect(getClientIp(event)).toBe('9.9.9.9');
    process.env.TRUST_PROXY = '2';
    expect(getClientIp(event)).toBe('1.2.3.4');
  });

  test('parallel admin login guesses cannot slip past the per-client limit', async () => {
    const email = `race-${Date.now()}@kogane.dev`;
    const attempts = await Promise.all(
      Array.from({ length: 25 }, () => loginHandler(mockEvent({ body: { email, password: 'WrongPassword1' } }))),
    );
    const throttled = attempts.filter((res: any) => /Too many login attempts/.test(res.error ?? ''));
    expect(throttled.length).toBe(15);
  });

  test('wrong PINs from many devices lock the terminal', async () => {
    const terminalId = 'd047d7294f03036a4f3fe94fa3be66d0';
    const results: string[] = [];
    for (let i = 0; i < 22; i += 1) {
      const res: any = await terminalLoginHandler(
        mockEvent({ body: { terminalId, pin: '0000' }, remoteAddress: `10.1.0.${i}` }),
      );
      results.push(res.error ?? '');
    }
    expect(results.slice(0, 20).every((error) => error === 'Invalid credentials')).toBe(true);
    expect(results.slice(20).every((error) => /Too many PIN attempts/.test(error))).toBe(true);
    clearRateLimit(`terminal_pin_any:${terminalId}`);
  });
});

describe('Live data stream', () => {
  test('requires a session: a business ID in the URL is not enough', async () => {
    const { data: business } = await db.queryOne<{ id: string }>('SELECT id FROM businesses LIMIT 1');
    await expect(
      streamHandler(mockEvent({ method: 'GET', url: `/api/realtime/stream?businessId=${business!.id}` })),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test('a terminal ID without that terminal\'s session is rejected', async () => {
    await expect(
      streamHandler(mockEvent({ method: 'GET', url: '/api/realtime/stream?terminalId=d047d7294f03036a4f3fe94fa3be66d0' })),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test('another terminal\'s session cannot open this terminal\'s stream', async () => {
    const { data: pair } = await db.queryOne<{ a_id: string; b_id: string; business_id: string; role: string }>(
      `SELECT a.id as a_id, b.id as b_id, a.business_id, a.role
         FROM terminals a JOIN terminals b ON b.business_id = a.business_id AND b.id <> a.id LIMIT 1`,
    );
    const token = await createTestTerminalToken({
      terminalId: pair!.a_id,
      businessId: pair!.business_id,
      displayName: 'Terminal A',
      role: pair!.role,
    });
    await expect(
      streamHandler(mockEvent({
        method: 'GET',
        url: `/api/realtime/stream?terminalId=${pair!.b_id}`,
        headers: { cookie: `kogane_terminal_session=${token}` },
      })),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('File URLs', () => {
  test('non-image files in a business bucket are not served without that business\'s session', async () => {
    const res = await serveStorageFile(mockEvent({
      method: 'GET',
      params: { path: ['biz-someone-else', 'reports', 'sales.pdf'] },
    }));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(404);
  });
});
