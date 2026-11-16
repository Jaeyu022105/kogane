import { describe, expect, test } from 'bun:test';
import { Buffer } from 'node:buffer';
import {
  evaluateSafeCondition,
  hasUnsafeControlChars,
  sanitizeTextInput,
  stripUnsafeControlChars,
  validateAndSanitizeRecord,
  validateAndSanitizeValue,
  MAX_CONDITION_DEPTH,
  MAX_CONDITION_TOKENS,
  MAX_FIELD_STRING_LENGTH,
  MAX_OBJECT_DEPTH,
} from '../lib/securityClient';
import securityMiddleware, {
  MAX_JSON_BODY_BYTES,
  MAX_MULTIPART_BODY_BYTES,
} from '../server/middleware/security';
import runtimeEventHandler, { MAX_RUNTIME_EVENTS_BATCH } from '../server/api/runtime/event.post';
import terminalInsertHandler from '../server/api/terminals/insert.post';
import updateRowHandler from '../server/api/schema/tables/updateRow.post';
import onboardHandler from '../server/api/businesses/onboard.post';
import themePatchHandler from '../server/api/businesses/theme.patch';
import signupHandler from '../server/api/auth/signup.post';
import loginHandler from '../server/api/auth/login.post';
import changePasswordHandler from '../server/api/auth/change-password.post';
import terminalLoginHandler from '../server/api/terminals/login.post';
import {
  fetchRowById,
  insertBusinessRow,
  queryBusinessRows,
  updateBusinessRow,
} from '../server/utils/businessTable';
import { validateReadOnlySql } from '../lib/sql';
import { db } from '../lib/db';
import { createTestAdminToken, createTestTerminalToken } from './helpers/sessions';
import { ensureStarterBusinessTables } from '../server/utils/starterTables';
import { FirestoreAdapter, InMemoryFirestoreStore } from '../lib/db-firebase';

function makeMockEvent(options: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: Buffer | string;
}) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    headers.set(k.toLowerCase(), v);
  }

  const req: any = {
    method: options.method,
    url: options.url,
    headers: Object.fromEntries(headers.entries()),
    body: options.body,
    rawBody: options.rawBody,
    socket: { remoteAddress: '127.0.0.1', encrypted: true },
    on() { return this; },
    off() { return this; },
  };

  if (options.body !== undefined) {
    req[Symbol.for('h3ParsedBody')] = options.body;
  }
  if (options.rawBody !== undefined) {
    req[Symbol.for('h3RawBody')] = Promise.resolve(
      Buffer.isBuffer(options.rawBody) ? options.rawBody : Buffer.from(options.rawBody),
    );
  }

  const event: any = {
    method: options.method,
    path: options.url,
    headers,
    node: {
      req,
      res: {
        statusCode: 200,
        setHeader() {},
        getHeader() { return undefined; },
      },
    },
    context: options.body !== undefined ? { body: options.body } : {},
    ...(options.body !== undefined ? { _body: options.body } : {}),
  };

  return event;
}

describe('Payload Hardening & Input Sanitization Utilities', () => {
  test('hasUnsafeControlChars and stripUnsafeControlChars handle NUL bytes and binary control characters', () => {
    // Normal printable text
    expect(hasUnsafeControlChars('Hello World 123!')).toBe(false);
    expect(stripUnsafeControlChars('Hello World 123!')).toBe('Hello World 123!');

    // NUL byte injection
    expect(hasUnsafeControlChars('Admin\x00User')).toBe(true);
    expect(stripUnsafeControlChars('Admin\x00User')).toBe('AdminUser');

    // Binary control characters (C0 & C1)
    const dangerousStr = 'Header\x01\x02\x07\x08\x1FData\x7F\x80\x9F';
    expect(hasUnsafeControlChars(dangerousStr)).toBe(true);
    expect(stripUnsafeControlChars(dangerousStr)).toBe('HeaderData');

    // Multiline whitespace handling (\t, \n, \r)
    const multiline = 'Line 1\r\nLine 2\tIndented\x00Corrupt';
    expect(hasUnsafeControlChars(multiline, true)).toBe(true);
    expect(stripUnsafeControlChars(multiline, true)).toBe('Line 1\r\nLine 2\tIndentedCorrupt');
    expect(stripUnsafeControlChars(multiline, false)).toBe('Line 1Line 2IndentedCorrupt');
  });

  test('sanitizeTextInput enforces length caps, strips NUL/binary bytes, and handles edge cases', () => {
    expect(sanitizeTextInput(null)).toBe('');
    expect(sanitizeTextInput(undefined)).toBe('');
    expect(sanitizeTextInput(12345)).toBe('12345');

    // NUL byte and control character removal with length truncation
    const dirty = 'Product \x00Name\x01\x02 with trailing text';
    expect(sanitizeTextInput(dirty, 12, false)).toBe('Product Name');

    // Long payload capping
    const longString = 'A'.repeat(5000);
    expect(sanitizeTextInput(longString, 500).length).toBe(500);
    expect(sanitizeTextInput(longString, 0)).toBe('');
  });

  test('validateAndSanitizeRecord rejects deep nesting, prototype pollution, non-finite numbers, and oversized strings', () => {
    // 1. Valid record succeeds cleanly
    const valid = validateAndSanitizeRecord({
      name: 'Espresso',
      price: 3.5,
      available: true,
      tags: ['coffee', 'hot'],
      metadata: { sku: 'ESP-01' },
    });
    expect(valid.name).toBe('Espresso');
    expect(valid.price).toBe(3.5);

    // 2. NUL byte stripped from string fields
    const withNul = validateAndSanitizeRecord({
      title: 'Latte\x00Attack',
      note: 'Normal note',
    });
    expect(withNul.title).toBe('LatteAttack');

    // 3. Reject NUL byte when explicitly requested
    expect(() =>
      validateAndSanitizeRecord({ title: 'Latte\x00Attack' }, { rejectNullBytes: true }),
    ).toThrow('disallowed NUL byte');

    // 4. Oversized string field rejected
    expect(() =>
      validateAndSanitizeRecord({ big: 'X'.repeat(MAX_FIELD_STRING_LENGTH + 1) }),
    ).toThrow('exceeds maximum allowed length');

    // 5. Non-finite numbers rejected
    expect(() => validateAndSanitizeRecord({ price: NaN })).toThrow('must be finite');
    expect(() => validateAndSanitizeRecord({ price: Infinity })).toThrow('must be finite');

    // 6. Deep object/array nesting rejected
    let deepObj: any = { val: 'leaf' };
    for (let i = 0; i <= MAX_OBJECT_DEPTH + 2; i++) {
      deepObj = { child: deepObj };
    }
    expect(() => validateAndSanitizeRecord(deepObj)).toThrow('exceeds maximum nesting depth');

    // 7. Prototype pollution rejected
    expect(() => validateAndSanitizeRecord(JSON.parse('{"__proto__": {"evil": true}}'))).toThrow('Forbidden property');
    expect(() => validateAndSanitizeRecord(JSON.parse('{"constructor": {"evil": true}}'))).toThrow('Forbidden property');
    expect(() => validateAndSanitizeRecord(JSON.parse('{"prototype": {"evil": true}}'))).toThrow('Forbidden property');
  });
});

describe('evaluateSafeCondition Nesting Depth & Token Limits', () => {
  const ctx = {
    inputs: { qty: 2, code: 'VIP' },
    session: { role: 'Cashier' },
    cart: [{ id: 'item1', price: 10 }],
  };

  test('valid conditions still evaluate correctly', () => {
    expect(evaluateSafeCondition('inputs.qty === 2 && session.role === "Cashier"', ctx)).toBe(true);
    expect(evaluateSafeCondition('cart.length > 0 && inputs.code === "VIP"', ctx)).toBe(true);
    expect(evaluateSafeCondition('inputs.qty > 5 || cart[0].price === 10', ctx)).toBe(true);
  });

  test('token cap blocks expressions with excessive tokens', () => {
    // Build an expression with > MAX_CONDITION_TOKENS
    const manyTokens = Array(MAX_CONDITION_TOKENS + 10).fill('1 === 1').join(' && ');
    expect(evaluateSafeCondition(manyTokens, ctx)).toBe(false);
  });

  test('nesting depth cap prevents stack overflow on pathological parentheses nesting', () => {
    // 50 nested parentheses would cause stack overflow in unconstrained recursive descent
    const deepParens = '('.repeat(50) + 'inputs.qty === 2' + ')'.repeat(50);
    // Must return false cleanly without crashing Node/Bun stack
    expect(evaluateSafeCondition(deepParens, ctx)).toBe(false);
  });

  test('property access chain depth cap prevents pathological member chaining', () => {
    const deepChain = 'inputs' + '.prop'.repeat(MAX_CONDITION_DEPTH + 5);
    expect(evaluateSafeCondition(deepChain, ctx)).toBe(false);
  });

  test('evaluateSafeCondition returns false on expressions containing NUL bytes or control characters', () => {
    expect(evaluateSafeCondition('inputs.qty === 2\x00', ctx)).toBe(false);
    expect(evaluateSafeCondition('session.role === "Cashier\x01"', ctx)).toBe(false);
  });
});

describe('Server Middleware: Request Body Size Enforcement', () => {
  test('non-multipart request with Content-Length > 1MB is rejected with HTTP 413', async () => {
    const oversizedEvent = makeMockEvent({
      url: '/api/terminals/insert',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(MAX_JSON_BODY_BYTES + 500),
      },
      body: { data: 'test' },
    });

    let thrownError: any = null;
    try {
      await securityMiddleware(oversizedEvent);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeTruthy();
    expect(thrownError.statusCode).toBe(413);
    expect(thrownError.statusMessage).toBe('Payload Too Large');
  });

  test('non-multipart request with oversized buffered body is rejected with HTTP 413', async () => {
    const largePayload = 'A'.repeat(MAX_JSON_BODY_BYTES + 1024);
    const oversizedBodyEvent = makeMockEvent({
      url: '/api/runtime/event',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: { flood: largePayload },
    });

    let thrownError: any = null;
    try {
      await securityMiddleware(oversizedBodyEvent);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeTruthy();
    expect(thrownError.statusCode).toBe(413);
  });

  test('legitimate non-multipart JSON request (< 1MB) passes through cleanly', async () => {
    const normalEvent = makeMockEvent({
      url: '/api/terminals/login',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '64',
      },
      body: { pin: '1234' },
    });

    let thrownError: any = null;
    try {
      await securityMiddleware(normalEvent);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeNull();
  });

  test('legitimate multipart upload to /api/storage/upload is not blocked by 1MB JSON limit', async () => {
    // 3MB multipart upload header
    const multipartEvent = makeMockEvent({
      url: '/api/storage/upload',
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=----Boundary123',
        'content-length': String(3 * 1024 * 1024),
      },
    });

    let thrownError: any = null;
    try {
      await securityMiddleware(multipartEvent);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeNull();
  });

  test('oversized multipart upload (> 15MB) is rejected with HTTP 413', async () => {
    const oversizedMultipartEvent = makeMockEvent({
      url: '/api/storage/upload',
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=----Boundary123',
        'content-length': String(MAX_MULTIPART_BODY_BYTES + 1024),
      },
    });

    let thrownError: any = null;
    try {
      await securityMiddleware(oversizedMultipartEvent);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeTruthy();
    expect(thrownError.statusCode).toBe(413);
  });

  test('multipart payload to non-upload route is restricted to 1MB JSON limit', async () => {
    const fakeMultipartEvent = makeMockEvent({
      url: '/api/terminals/insert',
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=----Boundary123',
        'content-length': String(2 * 1024 * 1024), // 2MB
      },
    });

    let thrownError: any = null;
    try {
      await securityMiddleware(fakeMultipartEvent);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeTruthy();
    expect(thrownError.statusCode).toBe(413);
  });
});

describe('Database Rows & Endpoints Hardening', () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const schemaName = `biz_harden_${suffix}`;
  let adminId: string;
  let adminToken: string;
  let businessId: string;
  let terminalId: string;
  let terminalToken: string;

  test('setup test business, admin and terminal in SQLite and Firestore store', async () => {
    const owner = await db.insert<{ id: string }>('users', {
      email: `harden-${suffix}@example.com`,
      full_name: 'Harden Owner',
      password_hash: 'hash_123',
    });
    expect(owner.error).toBeNull();
    adminId = owner.data!.id;

    const biz = await db.insert<{ id: string }>('businesses', {
      name: `Harden Biz ${suffix}`,
      admin_user_id: adminId,
      schema_name: schemaName,
    });
    expect(biz.error).toBeNull();
    businessId = biz.data!.id;

    await ensureStarterBusinessTables(schemaName, ['products', 'orders', 'inventory']);

    const term = await db.insert<{ id: string }>('terminals', {
      business_id: businessId,
      display_name: 'Cashier Station',
      role: 'cashier',
      pin_hash: 'pin_1234',
      permissions: JSON.stringify({ orders: { read: true, write: true, insert: true, update: true } }),
    });
    expect(term.error).toBeNull();
    terminalId = term.data!.id;

    adminToken = await createTestAdminToken({
      userId: adminId,
      email: `harden-${suffix}@example.com`,
      role: 'admin',
    });

    terminalToken = await createTestTerminalToken({
      terminalId,
      businessId,
      displayName: 'Cashier Station',
      role: 'cashier',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
  });

  test('insertBusinessRow and updateBusinessRow strip NUL bytes and reject non-finite/oversized data', async () => {
    // 1. String with NUL byte is cleaned before SQLite insertion
    const inserted = await insertBusinessRow(schemaName, 'products', {
      name: 'Caramel\x00Macchiato',
      price: 150,
      available: 1,
    });
    expect(inserted.error).toBeNull();
    expect((inserted.data as any).name).toBe('CaramelMacchiato');

    // 2. Fetch row verifies stored value has no NUL byte
    const fetched = await fetchRowById(schemaName, 'products', (inserted.data as any).id);
    expect(fetched.error).toBeNull();
    expect((fetched.data as any).name).toBe('CaramelMacchiato');

    // 3. Update cleans NUL bytes
    const updated = await updateBusinessRow(schemaName, 'products', (inserted.data as any).id, {
      name: 'Iced\x00Macchiato\x01Special',
      price: 165,
    });
    expect(updated.error).toBeNull();
    expect((updated.data as any).name).toBe('IcedMacchiatoSpecial');

    // 4. Non-finite price is rejected
    expect(
      insertBusinessRow(schemaName, 'products', {
        name: 'Bad Price Item',
        price: NaN,
      }),
    ).rejects.toThrow('must be finite');

    // 5. Oversized string column is rejected
    expect(
      insertBusinessRow(schemaName, 'products', {
        name: 'Huge',
        description: 'X'.repeat(MAX_FIELD_STRING_LENGTH + 50),
      }),
    ).rejects.toThrow('exceeds maximum allowed length');
  });

  test('insertBusinessRow and updateBusinessRow also sanitize cleanly in FirestoreAdapter', async () => {
    const memStore = new InMemoryFirestoreStore();
    const fsDb = new FirestoreAdapter(memStore);

    const fsInserted = await fsDb.insert(
      'products',
      {
        id: 'fs-prod-1',
        name: 'Cold\x00Brew\x07Nitro',
        price: 180,
      },
      schemaName,
    );
    expect(fsInserted.error).toBeNull();

    const fsQueried = await fsDb.query<{ id: string; name: string }>(
      `SELECT id, name FROM "${schemaName}"."products" WHERE id = $1`,
      ['fs-prod-1'],
    );
    expect(fsQueried.error).toBeNull();
    expect(fsQueried.data?.[0]?.name).toBe('ColdBrewNitro');
  });

  test('validateReadOnlySql rejects queries with NUL bytes', () => {
    expect(() => validateReadOnlySql('SELECT * FROM orders\x00 WHERE id = 1')).toThrow('Disallowed NUL byte');
  });

  test('queryBusinessRows sanitizes where parameters and bounds limit', async () => {
    const queried = await queryBusinessRows(schemaName, 'products', ['id', 'name'], {
      where: { name: 'Iced\x00Macchiato\x01Special' },
      limit: 999999,
    });
    expect(queried.error).toBeNull();
    expect(queried.data?.length).toBe(1);
    expect(queried.data?.[0]?.name).toBe('IcedMacchiatoSpecial');
  });

  test('runtime/event.post.ts rejects batch exceeding MAX_RUNTIME_EVENTS_BATCH (50)', async () => {
    const oversizedBatch = Array(MAX_RUNTIME_EVENTS_BATCH + 5).fill({
      action: { type: 'query', table: 'orders' },
    });

    const event = makeMockEvent({
      url: '/api/runtime/event',
      method: 'POST',
      headers: {
        'x-terminal-session': terminalToken,
        'x-terminal-id': terminalId,
        'content-type': 'application/json',
      },
      body: { events: oversizedBatch },
    });

    let thrown: any = null;
    try {
      await runtimeEventHandler(event);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeTruthy();
    expect(thrown.statusCode).toBe(400);
    expect(thrown.message).toContain('exceeds maximum limit');
  });

  test('runtime/event.post.ts strips NUL bytes from payload and sanitizes fields', async () => {
    const event = makeMockEvent({
      url: '/api/runtime/event',
      method: 'POST',
      headers: {
        'x-terminal-session': terminalToken,
        'x-terminal-id': terminalId,
        'content-type': 'application/json',
      },
      body: {
        events: [
          {
            inpoint_id: terminalId,
            business_id: businessId,
            trigger: 'click',
            action: {
              type: 'insert',
              table: 'orders',
            },
            payload: {
              items: 'Table 1: 2x Croissant\x00Attack',
              total: 240,
              status: 'pending',
            },
          },
        ],
      },
    });

    const res = await runtimeEventHandler(event);
    expect(res.results.length).toBe(1);
    expect(res.results[0].ok).toBe(true);
    expect((res.results[0].data as any).items).toBe('Table 1: 2x CroissantAttack');
  });

  test('terminals/insert.post.ts sanitizes record, strips NUL bytes and rejects deep nesting', async () => {
    // 1. Record with NUL byte is cleaned
    const insertEv = makeMockEvent({
      url: '/api/terminals/insert',
      method: 'POST',
      headers: {
        'x-terminal-session': terminalToken,
        'x-terminal-id': terminalId,
        'content-type': 'application/json',
      },
      body: {
        terminalId,
        tableName: 'orders',
        record: {
          items: 'Counter\x00Order',
          total: 80,
          status: 'pending',
        },
      },
    });

    const insertRes = await terminalInsertHandler(insertEv);
    expect(insertRes.success).toBe(true);

    // 2. Deeply nested record is rejected
    let deep: any = { leaf: true };
    for (let i = 0; i < 15; i++) deep = { wrap: deep };

    const badEv = makeMockEvent({
      url: '/api/terminals/insert',
      method: 'POST',
      headers: {
        'x-terminal-session': terminalToken,
        'x-terminal-id': terminalId,
        'content-type': 'application/json',
      },
      body: {
        terminalId,
        tableName: 'orders',
        record: {
          items: deep,
        },
      },
    });

    const badRes = await terminalInsertHandler(badEv);
    expect(badRes.success).toBe(false);
    expect(badRes.error).toContain('nesting depth');
  });

  test('schema/tables/updateRow.post.ts sanitizes updates cleanly', async () => {
    // Insert order to update
    const inserted = await insertBusinessRow(schemaName, 'orders', {
      items: 'Initial Order',
      total: 100,
      status: 'pending',
    });

    const updateEv = makeMockEvent({
      url: '/api/schema/tables/updateRow',
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: {
        businessId,
        tableName: 'orders',
        rowId: (inserted.data as any).id,
        updates: {
          items: 'Updated\x00Clean Order',
          total: 150,
        },
      },
    });

    const updateRes = await updateRowHandler(updateEv);
    expect(updateRes.success).toBe(true);

    const checked = await fetchRowById(schemaName, 'orders', (inserted.data as any).id);
    expect((checked.data as any).items).toBe('UpdatedClean Order');
  });

  test('businesses/onboard.post.ts strips NUL bytes and bounds colorPalette', async () => {
    const suffixOnboard = Math.random().toString(36).slice(2, 8);
    const newOwner = await db.insert<{ id: string }>('users', {
      email: `onboard-${suffixOnboard}@example.com`,
      full_name: 'Onboard User',
      password_hash: 'hash_123',
    });
    const newAdminToken = await createTestAdminToken({
      userId: newOwner.data!.id,
      email: `onboard-${suffixOnboard}@example.com`,
      role: 'admin',
    });

    const onboardEv = makeMockEvent({
      url: '/api/businesses/onboard',
      method: 'POST',
      headers: {
        authorization: `Bearer ${newAdminToken}`,
        'content-type': 'application/json',
      },
      body: {
        businessName: 'Clean Bakery\x00Evil',
        businessType: 'retail',
        features: ['products', 'orders'],
        colorPalette: {
          primary: '#123456\x00',
          accent: '#abcdef',
        },
        schemaDef: {
          tables: [],
        },
      },
    });

    const onboardRes = await onboardHandler(onboardEv);
    expect(onboardRes.error).toBeNull();
    expect(onboardRes.business?.name).toBe('Clean BakeryEvil');
  });

  test('businesses/theme.patch.ts strips NUL bytes from name and currency fields', async () => {
    const themeEv = makeMockEvent({
      url: '/api/businesses/theme',
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: {
        name: 'Rebranded\x00Cafe',
        currency: 'USD\x00',
        currencySymbol: '$\x00',
      },
    });

    const themeRes = await themePatchHandler(themeEv);
    expect(themeRes.success).toBe(true);

    const bizRow = await db.queryOne<{ name: string; currency: string; currency_symbol: string }>(
      'SELECT name, currency, currency_symbol FROM businesses WHERE id = ?',
      [businessId],
    );
    expect(bizRow.data?.name).toBe('RebrandedCafe');
    expect(bizRow.data?.currency).toBe('USD');
    expect(bizRow.data?.currency_symbol).toBe('$');
  });

  test('auth endpoints reject NUL bytes and unsafe binary control characters in credentials', async () => {
    // 1. Signup with NUL in email
    const badSignupEmail = await signupHandler(
      makeMockEvent({
        url: '/api/auth/signup',
        method: 'POST',
        body: { email: 'user\x00@example.com', password: 'ValidPassword123' },
      }),
    );
    expect(badSignupEmail.session).toBeNull();
    expect(badSignupEmail.error).toBeTruthy();

    // 2. Signup with binary control character in email
    const badSignupEmailControl = await signupHandler(
      makeMockEvent({
        url: '/api/auth/signup',
        method: 'POST',
        body: { email: 'user\x01@example.com', password: 'ValidPassword123' },
      }),
    );
    expect(badSignupEmailControl.session).toBeNull();
    expect(badSignupEmailControl.error).toBeTruthy();

    // 3. Signup with NUL or control char in password
    const badSignupPass = await signupHandler(
      makeMockEvent({
        url: '/api/auth/signup',
        method: 'POST',
        body: { email: `good-${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'Bad\x00Password123' },
      }),
    );
    expect(badSignupPass.session).toBeNull();
    expect(badSignupPass.error).toBeTruthy();

    const badSignupPassControl = await signupHandler(
      makeMockEvent({
        url: '/api/auth/signup',
        method: 'POST',
        body: { email: `good-${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'Bad\x1FPassword123' },
      }),
    );
    expect(badSignupPassControl.session).toBeNull();
    expect(badSignupPassControl.error).toBeTruthy();

    // 4. Login with NUL or control char in email or password
    const badLogin = await loginHandler(
      makeMockEvent({
        url: '/api/auth/login',
        method: 'POST',
        body: { email: 'admin\x00@example.com', password: 'password123' },
      }),
    );
    expect(badLogin.session).toBeNull();
    expect(badLogin.error).toBeTruthy();

    const badLoginControl = await loginHandler(
      makeMockEvent({
        url: '/api/auth/login',
        method: 'POST',
        body: { email: 'admin\x07@example.com', password: 'password123' },
      }),
    );
    expect(badLoginControl.session).toBeNull();
    expect(badLoginControl.error).toBeTruthy();

    // 5. Change password with NUL or control char
    const badChangePass = await changePasswordHandler(
      makeMockEvent({
        url: '/api/auth/change-password',
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { currentPassword: 'old\x00pass', newPassword: 'new\x00pass123' },
      }),
    );
    expect(badChangePass.success).toBe(false);

    const badChangePassControl = await changePasswordHandler(
      makeMockEvent({
        url: '/api/auth/change-password',
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { currentPassword: 'old\x7Fpass', newPassword: 'new\x80pass123' },
      }),
    );
    expect(badChangePassControl.success).toBe(false);

    // 6. Terminal login with NUL or control char in PIN
    const badTermLogin = await terminalLoginHandler(
      makeMockEvent({
        url: '/api/terminals/login',
        method: 'POST',
        body: { terminalId, pin: '12\x0034' },
      }),
    );
    expect(badTermLogin.session).toBeNull();
    expect(badTermLogin.error).toBeTruthy();

    const badTermLoginControl = await terminalLoginHandler(
      makeMockEvent({
        url: '/api/terminals/login',
        method: 'POST',
        body: { terminalId, pin: '12\x0134' },
      }),
    );
    expect(badTermLoginControl.session).toBeNull();
    expect(badTermLoginControl.error).toBeTruthy();
  });
});
