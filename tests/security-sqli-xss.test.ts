import { describe, expect, test } from 'bun:test';
import {
  buildAddColumnSql,
  buildCreateTableSql,
  buildDropTableSql,
  validateColumnDefault,
  validateIdentifier,
  validateTableDef,
} from '../lib/schemaUtils';
import {
  validateAndQualifyBusinessSql,
  validateReadOnlySql,
} from '../lib/sql';
import {
  evaluateSafeCondition,
  sanitizeImageSrc,
  sanitizeNavigationUrl,
} from '../lib/securityClient';
import { normalizeLayout } from '../lib/uiTypes';
import { FirestoreAdapter, InMemoryFirestoreStore } from '../lib/db-firebase';
import { SqliteAdapter } from '../lib/db-sqlite';
import { db } from '../lib/db';
import { createTestAdminToken } from './helpers/sessions';
import { ensureStarterBusinessTables } from '../server/utils/starterTables';
import rowsHandler from '../server/api/schema/tables/rows.get';
import customReportHandler from '../server/api/reports/custom.post';
import dataQueryHandler from '../server/api/data/query.post';
import schemaUpdateHandler from '../server/api/schema/tables/update.post';
import uploadHandler from '../server/api/storage/upload.post';
import themePatchHandler from '../server/api/businesses/theme.patch';

function makeMultipartUploadEvent(raw: Buffer, contentTypeHeader: string) {
  return {
    method: 'POST',
    path: '/api/storage/upload',
    node: {
      req: {
        method: 'POST',
        url: '/api/storage/upload',
        headers: {
          'content-type': contentTypeHeader,
        },
        socket: { remoteAddress: '10.20.30.50', encrypted: true },
        rawBody: raw,
      },
      res: {
        statusCode: 200,
        setHeader() {},
        getHeader() { return undefined; },
      },
    },
    headers: new Headers({
      'content-type': contentTypeHeader,
    }),
    context: {},
  } as any;
}

function makeAdminRequestEvent(url: string, method: 'GET' | 'POST' | 'PATCH', token: string, query?: Record<string, string>, body?: unknown) {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  return {
    method,
    path: `${url}${qs}`,
    node: {
      req: {
        method,
        url: `${url}${qs}`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body,
        ...(body !== undefined ? { [Symbol.for('h3ParsedBody')]: body } : {}),
      },
      res: {},
    },
    headers: new Headers({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    context: body !== undefined ? { body } : {},
    ...(body !== undefined ? { _body: body } : {}),
  } as any;
}

describe('SQL Injection (SQLi) Prevention', () => {
  test('validateIdentifier rejects SQLi payloads, non-strings, and prototype-pollution keys', () => {
    const badIdentifiers = [
      'orders; DROP TABLE users;--',
      'orders" OR "1"="1',
      'orders UNION SELECT * FROM users',
      '__proto__',
      'constructor',
      'prototype',
      '123orders',
      'Orders',
      'orders-table',
      'orders.id',
      '',
      'a'.repeat(65),
    ];

    for (const bad of badIdentifiers) {
      expect(() => validateIdentifier(bad)).toThrow();
    }
    expect(() => validateIdentifier(null as any)).toThrow();
    expect(() => validateIdentifier('valid_table_2')).not.toThrow();
  });

  test('validateTableDef and DDL builders reject injected column defaults, types, foreign keys, and schema names', () => {
    // Legitimate defaults work
    expect(() => validateColumnDefault('0')).not.toThrow();
    expect(() => validateColumnDefault('1')).not.toThrow();
    expect(() => validateColumnDefault("'pending'")).not.toThrow();
    expect(() => validateColumnDefault("'scheduled'")).not.toThrow();

    // SQLi defaults must fail
    expect(() => validateColumnDefault("0); DROP TABLE users; --")).toThrow();
    expect(() => validateColumnDefault("(SELECT password_hash FROM users LIMIT 1)")).toThrow();
    expect(() => validateColumnDefault("'a' || (SELECT 1)")).toThrow();

    expect(() =>
      buildCreateTableSql(
        {
          name: 'evil_tbl',
          columns: [
            { name: 'status', type: 'text', nullable: false, default: "0); DROP TABLE users;--" },
          ],
        },
        'biz_safe',
      ),
    ).toThrow();

    expect(() =>
      buildCreateTableSql(
        {
          name: 'evil_tbl',
          columns: [
            { name: 'col', type: 'text; DROP TABLE users' as any, nullable: false },
          ],
        },
        'biz_safe',
      ),
    ).toThrow();

    expect(() =>
      validateTableDef({
        name: 'evil_tbl',
        columns: [
          { name: 'ref_id', type: 'text', nullable: true, references: { table: 'users; DROP TABLE sessions', column: 'id' } },
        ],
      }),
    ).toThrow();

    expect(() => buildDropTableSql('orders', 'biz_safe"; DROP TABLE users;--')).toThrow();
    expect(() =>
      buildAddColumnSql('orders', { name: 'note', type: 'text', nullable: true }, 'biz_safe;--'),
    ).toThrow();
  });

  test('SqliteAdapter insert/update/delete enforce identifier validation and safe quoting', async () => {
    const adapter = new SqliteAdapter(':memory:');
    await adapter.execute('CREATE TABLE biz_sec_items (id TEXT PRIMARY KEY, name TEXT, qty INTEGER)');

    const okInsert = await adapter.insert('items', { id: 'i-1', name: 'Widget', qty: 5 }, 'biz_sec');
    expect(okInsert.error).toBeNull();

    // Malicious table or column names rejected cleanly
    const sqliInsertTable = await adapter.insert('items; DROP TABLE users;--', { id: 'i-2', name: 'X' }, 'biz_sec');
    expect(sqliInsertTable.error).toBeTruthy();

    const sqliInsertCol = await adapter.insert('items', { 'name) VALUES (1); DROP TABLE items;--': 'X' }, 'biz_sec');
    expect(sqliInsertCol.error).toBeTruthy();

    const sqliUpdateWhere = await adapter.update('items', { qty: 9 }, { 'id = 1 OR 1=1 --': 'i-1' }, 'biz_sec');
    expect(sqliUpdateWhere.error).toBeTruthy();

    const emptyDelete = await adapter.delete('items', {}, 'biz_sec');
    expect(emptyDelete.error).toBeTruthy();

    const okUpdate = await adapter.update('items', { qty: 10 }, { id: 'i-1' }, 'biz_sec');
    expect(okUpdate.error).toBeNull();
  });

  test('validateReadOnlySql & validateAndQualifyBusinessSql block stacked queries, PRAGMA, UNION platform leaks, and cross-tenant reads', () => {
    const allowed = ['orders', 'products'];
    const schema = 'biz_tenant_a';

    // Valid queries pass and qualify cleanly
    const valid = validateAndQualifyBusinessSql(
      "SELECT id, total FROM orders WHERE status != 'delete me' ORDER BY created_at DESC",
      schema,
      allowed,
    );
    expect(valid).toContain('"biz_tenant_a_orders"');

    const maliciousQueries = [
      'SELECT * FROM orders; DROP TABLE users',
      'PRAGMA table_info(users)',
      'ATTACH DATABASE "/tmp/pwn.db" AS pwn',
      'SELECT * FROM users',
      'SELECT * FROM sessions',
      'SELECT * FROM businesses',
      'SELECT * FROM terminals',
      'SELECT * FROM sqlite_master',
      'SELECT * FROM __storage_blobs',
      'SELECT id FROM orders UNION SELECT password_hash FROM users',
      'SELECT * FROM biz_tenant_b_orders',
      'SELECT * FROM biz_tenant_b.orders',
      'WITH RECURSIVE r AS (SELECT 1 UNION ALL SELECT 1 FROM r) SELECT * FROM r',
      "SELECT load_extension('evil.so')",
      'DELETE FROM orders',
    ];

    for (const q of maliciousQueries) {
      expect(() => validateAndQualifyBusinessSql(q, schema, allowed)).toThrow();
    }
    expect(() => validateReadOnlySql('PRAGMA database_list')).toThrow();
  });

  test('rows.get.ts and reports/custom.post.ts block SQLi and cross-tenant table access in real SQLite', async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const schemaA = `biz_sqli_a_${suffix}`;
    const schemaB = `biz_sqli_b_${suffix}`;

    const owner = await db.insert<{ id: string }>('users', {
      email: `sec-owner-${suffix}@example.com`,
      full_name: 'Sec Owner',
      password_hash: 'secret_hash_should_never_leak',
    });
    expect(owner.error).toBeNull();

    const bizA = await db.insert<{ id: string }>('businesses', {
      name: `Sec Biz A ${suffix}`,
      admin_user_id: owner.data!.id,
      schema_name: schemaA,
    });
    const bizB = await db.insert<{ id: string }>('businesses', {
      name: `Sec Biz B ${suffix}`,
      admin_user_id: 'other-admin-id',
      schema_name: schemaB,
    });
    expect(bizA.error).toBeNull();
    expect(bizB.error).toBeNull();

    await ensureStarterBusinessTables(schemaA, ['orders']);
    await ensureStarterBusinessTables(schemaB, ['orders']);
    await db.insert('orders', { items: 'Tenant A order', total: 100, status: 'pending' }, schemaA);
    await db.insert('orders', { items: 'Tenant B secret order', total: 999, status: 'pending' }, schemaB);

    const token = await createTestAdminToken({ userId: owner.data!.id, email: `sec-owner-${suffix}@example.com`, role: 'admin' });

    // 1. rows.get.ts rejects malicious tableName
    const sqliRowsRes = await rowsHandler(
      makeAdminRequestEvent('/api/schema/tables/rows', 'GET', token, {
        businessId: bizA.data!.id,
        tableName: 'orders" UNION SELECT id, email, password_hash FROM users--',
      }),
    );
    expect(sqliRowsRes.rows).toBeNull();
    expect(sqliRowsRes.error).toContain('Invalid identifier');

    // 2. rows.get.ts handles NaN page/limit gracefully without throwing SQL syntax error
    const validRowsRes = await rowsHandler(
      makeAdminRequestEvent('/api/schema/tables/rows', 'GET', token, {
        businessId: bizA.data!.id,
        tableName: 'orders',
        page: 'not-a-number',
        limit: 'NaN',
      }),
    );
    expect(validRowsRes.error).toBeNull();
    expect(Array.isArray(validRowsRes.rows)).toBe(true);
    expect(validRowsRes.rows!.length).toBe(1);

    // 3. reports/custom.post.ts blocks users/sessions/cross-tenant queries
    const leakUsers = await customReportHandler(
      makeAdminRequestEvent('/api/reports/custom', 'POST', token, undefined, {
        sql: 'SELECT id, email, password_hash FROM users',
      }),
    );
    expect(leakUsers.rows).toEqual([]);
    expect(leakUsers.error).toBeTruthy();

    const leakTenantB = await customReportHandler(
      makeAdminRequestEvent('/api/reports/custom', 'POST', token, undefined, {
        sql: `SELECT * FROM ${schemaB}_orders`,
      }),
    );
    expect(leakTenantB.rows).toEqual([]);
    expect(leakTenantB.error).toBeTruthy();

    // 4. Valid tenant query succeeds on own business table
    const okReport = await customReportHandler(
      makeAdminRequestEvent('/api/reports/custom', 'POST', token, undefined, {
        sql: 'SELECT items, total FROM orders',
      }),
    );
    expect(okReport.error).toBeNull();
    expect(okReport.rows.length).toBe(1);
    expect(okReport.rows[0].items).toBe('Tenant A order');
  });

  test('FirestoreAdapter LIKE matcher handles long wildcard patterns linearly without ReDoS', async () => {
    const store = new InMemoryFirestoreStore();
    const fsDb = new FirestoreAdapter(store);
    await fsDb.insert('items', { id: '1', name: 'a'.repeat(500) + 'c' }, 'biz_fs');

    const start = Date.now();
    const res = await fsDb.query<{ id: string }>(
      'SELECT id FROM "biz_fs"."items" WHERE name LIKE $1',
      ['a%a%a%a%a%a%a%a%a%a%a%a%a%a%a%a%a%a%b'],
    );
    const elapsedMs = Date.now() - start;
    expect(res.error).toBeNull();
    expect(res.data).toEqual([]);
    expect(elapsedMs).toBeLessThan(200);
  });
});

describe('XSS & Script Injection Prevention', () => {
  test('evaluateSafeCondition runs valid expressions and blocks arbitrary JS execution', () => {
    const ctx = {
      inputs: { qty: 3, discount_code: 'VIP', 'item-1': 'Latte' },
      session: { terminalName: 'Front Counter', role: 'Cashier Register' },
      cart: [{ id: '1', qty: 2 }],
    };

    expect(evaluateSafeCondition("inputs.qty > 0 && inputs.discount_code === 'VIP'", ctx)).toBe(true);
    expect(evaluateSafeCondition("inputs['item-1'] === 'Latte' && cart.length === 1", ctx)).toBe(true);
    expect(evaluateSafeCondition("!(cart.length === 0) && session.terminalName === 'Front Counter'", ctx)).toBe(true);
    expect(evaluateSafeCondition(undefined, ctx)).toBe(true);

    // Script injection / RCE / prototype access must all return false and NEVER execute
    let sideEffectTriggered = false;
    (globalThis as any).__koganeXssTestFlag = () => {
      sideEffectTriggered = true;
      return true;
    };

    try {
      const attackPayloads = [
        'globalThis.__koganeXssTestFlag()',
        'process.exit(1)',
        '(() => { globalThis.__koganeXssTestFlag(); return true; })()',
        "this.constructor.constructor('return globalThis.__koganeXssTestFlag()')()",
        'inputs.constructor.constructor("return 1")()',
        'inputs.__proto__',
        'inputs.prototype',
        'alert(1)',
        "window.location='https://evil.com'",
      ];

      for (const payload of attackPayloads) {
        expect(evaluateSafeCondition(payload, ctx)).toBe(false);
      }
      expect(sideEffectTriggered).toBe(false);
    } finally {
      delete (globalThis as any).__koganeXssTestFlag;
    }
  });

  test('sanitizeNavigationUrl & sanitizeImageSrc block javascript:, data:text/html, SVG data URIs, and protocol-relative URLs', () => {
    expect(sanitizeNavigationUrl('/dashboard/reports')).toBe('/dashboard/reports');
    expect(sanitizeNavigationUrl('https://kogane.example.com/help?v=1')).toBe('https://kogane.example.com/help?v=1');

    expect(sanitizeNavigationUrl('javascript:alert(document.cookie)')).toBeNull();
    expect(sanitizeNavigationUrl('JAVASCRIPT:alert(1)')).toBeNull();
    expect(sanitizeNavigationUrl('java\tscript:alert(1)')).toBeNull();
    expect(sanitizeNavigationUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeNavigationUrl('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeNavigationUrl('//evil.com/phish')).toBeNull();
    expect(sanitizeNavigationUrl('/\\evil.com')).toBeNull();

    expect(sanitizeImageSrc('/api/storage/files/logo.png')).toBe('/api/storage/files/logo.png');
    expect(sanitizeImageSrc('https://cdn.example.com/img.webp')).toBe('https://cdn.example.com/img.webp');
    expect(sanitizeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');

    expect(sanitizeImageSrc('javascript:alert(1)')).toBe('');
    expect(sanitizeImageSrc('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+')).toBe('');
    expect(sanitizeImageSrc('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeImageSrc('//evil.com/tracker.png')).toBe('');
  });

  test('normalizeLayout strips legacy custom-script actions and sanitizes navigate URLs & image sources', () => {
    const layout = normalizeLayout({
      version: 2,
      resolution: { width: 1280, height: 720 },
      elements: [
        {
          id: 'btn-xss-legacy',
          type: 'button',
          position: { x: 0, y: 0, width: 100, height: 40, zIndex: 1 },
          text: 'Click',
          variant: 'primary',
          action: {
            type: 'custom-script',
            payload: { script: 'alert(document.cookie)' },
          },
        },
        {
          id: 'btn-nav-xss',
          type: 'button',
          position: { x: 0, y: 50, width: 100, height: 40, zIndex: 1 },
          text: 'Nav',
          variant: 'secondary',
          events: [
            {
              id: 'ev-1',
              trigger: 'click',
              action: { type: 'navigate', url: 'javascript:alert(1)' },
            },
            {
              id: 'ev-2',
              trigger: 'click',
              action: { type: 'emit', event: 'runtime:legacy-script', payload: { script: 'alert(1)' } },
            },
          ],
        },
        {
          id: 'img-xss',
          type: 'image',
          position: { x: 0, y: 100, width: 100, height: 100, zIndex: 1 },
          src: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
          fit: 'cover',
        },
      ],
    });

    const btnLegacy = layout.elements.find((e) => e.id === 'btn-xss-legacy')!;
    expect(btnLegacy.events).toEqual([]);

    const btnNav = layout.elements.find((e) => e.id === 'btn-nav-xss')!;
    expect((btnNav.events ?? []).length).toBe(1);
    expect((btnNav.events?.[0]?.action as any)?.url).toBe('');

    const img = layout.elements.find((e) => e.id === 'img-xss') as any;
    expect(img.src).toBe('');
  });

  test('validateAndQualifyBusinessSql blocks quoted-identifier bypasses, multi-table comma joins, parenthesized tables, and zero-table queries', () => {
    const allowed = ['orders', 'products'];
    const schema = 'biz_tenant_a';

    // Double-quoted column alias still works cleanly
    const aliasQuery = validateAndQualifyBusinessSql(
      'SELECT COUNT(*) AS "Total Orders" FROM orders',
      schema,
      allowed,
    );
    expect(aliasQuery).toContain('"biz_tenant_a_orders"');
    expect(aliasQuery).toContain('"Total Orders"');

    const bypassQueries = [
      'SELECT * FROM "users"',
      'SELECT id FROM orders UNION SELECT password_hash FROM "users"',
      'SELECT * FROM orders JOIN "users" ON 1=1',
      'SELECT * FROM "biz_tenant_b_orders"',
      'SELECT * FROM `users`',
      'SELECT * FROM [sqlite_master]',
      'SELECT * FROM (users)',
      'SELECT * FROM ("users")',
      'SELECT * FROM orders, products, users',
      "SELECT * FROM pragma_table_info('users')",
      'WITH users AS (SELECT 1) SELECT * FROM users',
    ];

    for (const q of bypassQueries) {
      expect(() => validateAndQualifyBusinessSql(q, schema, allowed)).toThrow();
    }

    // Zero-table tenant cannot query any table
    expect(() => validateAndQualifyBusinessSql('SELECT * FROM users', 'biz_empty', [])).toThrow();
    expect(() => validateAndQualifyBusinessSql('SELECT * FROM orders', 'biz_empty', [])).toThrow();
  });

  test('reports/custom, data/query, and schema/tables/update enforce SQLi protections and return structured errors', async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const schema = `biz_sec_adv_${suffix}`;
    const owner = await db.insert<{ id: string }>('users', {
      email: `sec-adv-${suffix}@example.com`,
      full_name: 'Adv Sec Owner',
      password_hash: 'secret_hash_adv',
    });
    expect(owner.error).toBeNull();

    const biz = await db.insert<{ id: string }>('businesses', {
      name: `Sec Adv Biz ${suffix}`,
      admin_user_id: owner.data!.id,
      schema_name: schema,
    });
    expect(biz.error).toBeNull();
    await ensureStarterBusinessTables(schema, ['orders']);
    await db.insert('orders', { items: 'Latte', total: 120, status: 'pending' }, schema);

    const token = await createTestAdminToken({
      userId: owner.data!.id,
      email: `sec-adv-${suffix}@example.com`,
      role: 'admin',
    });

    // Double-quoted UNION attack blocked on /api/reports/custom
    const dqUnion = await customReportHandler(
      makeAdminRequestEvent('/api/reports/custom', 'POST', token, undefined, {
        sql: 'SELECT items FROM orders UNION SELECT password_hash FROM "users"',
      }),
    );
    expect(dqUnion.rows).toEqual([]);
    expect(dqUnion.error).toBeTruthy();

    // /api/data/query blocks malicious columns & non-array columns, allows valid query
    const badColQuery = await dataQueryHandler(
      makeAdminRequestEvent('/api/data/query', 'POST', token, undefined, {
        businessId: biz.data!.id,
        tableName: 'orders',
        columns: ['items FROM users--'],
      }),
    );
    expect(badColQuery.data).toBeNull();
    expect(badColQuery.error).toBeTruthy();

    const okDataQuery = await dataQueryHandler(
      makeAdminRequestEvent('/api/data/query', 'POST', token, undefined, {
        businessId: biz.data!.id,
        tableName: 'orders',
        columns: ['items', 'total'],
      }),
    );
    expect(okDataQuery.error).toBeNull();
    expect(okDataQuery.data?.length).toBe(1);
    expect((okDataQuery.data?.[0] as any)?.items).toBe('Latte');

    // /api/schema/tables/update catches invalid DDL defaults cleanly instead of throwing 500
    const badDdlRes = await schemaUpdateHandler(
      makeAdminRequestEvent('/api/schema/tables/update', 'POST', token, undefined, {
        businessId: biz.data!.id,
        tableName: 'orders',
        addColumns: [
          { name: 'evil_col', type: 'text', nullable: true, default: "0); DROP TABLE users;--" },
        ],
      }),
    );
    expect(badDdlRes.success).toBe(false);
    expect(badDdlRes.error).toBeTruthy();

    // /api/businesses/theme strips XSS logoUrl values
    await themePatchHandler(
      makeAdminRequestEvent('/api/businesses/theme', 'PATCH', token, undefined, {
        logoUrl: 'javascript:alert(1)',
      }),
    );
    const updatedBiz = await db.queryOne<{ logo_url: string | null }>(
      'SELECT logo_url FROM businesses WHERE id = ?',
      [biz.data!.id],
    );
    expect(updatedBiz.data?.logo_url ?? null).toBeNull();
  });

  test('upload.post.ts blocks extension/MIME spoofing and normalizeLayout recursively sanitizes chained onSuccess/onFailure actions', async () => {
    const boundary = '----KoganeTestBoundary123';
    const raw = Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="bucket"\r\n\r\n`
      + `avatars\r\n`
      + `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="path"\r\n\r\n`
      + `evil.svg\r\n`
      + `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="file"; filename="evil.svg"\r\n`
      + `Content-Type: image/png\r\n\r\n`
      + `<svg onload="alert(1)"></svg>\r\n`
      + `--${boundary}--\r\n`,
      'utf8',
    );
    const spoofEv = makeMultipartUploadEvent(raw, `multipart/form-data; boundary=${boundary}`);
    const spoofRes = await uploadHandler(spoofEv);
    expect(spoofRes.url).toBeNull();
    expect(spoofRes.error).toContain('File extension does not match');

    // Recursive onSuccess / onFailure sanitization in normalizeLayout
    const layout = normalizeLayout({
      version: 2,
      resolution: { width: 1280, height: 720 },
      elements: [
        {
          id: 'btn-chained-xss',
          type: 'button',
          position: { x: 0, y: 0, width: 120, height: 40, zIndex: 1 },
          text: 'Chained',
          variant: 'primary',
          events: [
            {
              id: 'ev-chain',
              trigger: 'click',
              action: {
                type: 'insert',
                table: 'orders',
                onSuccess: {
                  type: 'navigate',
                  url: 'javascript:alert(document.cookie)',
                },
                onFailure: {
                  type: 'emit',
                  event: 'runtime:legacy-script',
                  payload: { script: 'alert(1)' },
                },
              },
            },
          ],
        },
      ],
    });
    const chainedBtn = layout.elements.find((e) => e.id === 'btn-chained-xss')!;
    const rootAction = chainedBtn.events?.[0]?.action as any;
    expect(rootAction.onSuccess?.type).toBe('navigate');
    expect(rootAction.onSuccess?.url).toBe('');
    expect(rootAction.onFailure).toBeUndefined();
  });
});
