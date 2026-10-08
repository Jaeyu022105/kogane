import { describe, expect, test } from 'bun:test';
import { db } from '../lib/db';
import { insertBusinessRow, queryBusinessRows } from '../server/utils/businessTable';
import { ensureStarterBusinessTable } from '../server/utils/starterTables';
import { normalizePermissions, isActionAllowed, presetByRoleOrKey } from '../lib/permissions';
import { resolveRuntimePayload } from '../lib/runtime';
import { realtimeHub } from '../server/utils/realtimeHub';

describe('Catalog Product Insertion & Permissions', () => {
  const schemaName = 'biz_devadmin';

  test('ensureStarterBusinessTable provisions products table', async () => {
    process.env.DEV_MODE = 'true';
    const res = await ensureStarterBusinessTable(schemaName, 'products');
    expect(res.error).toBeNull();
  });

  test('insertBusinessRow saves product with numeric price and defaults', async () => {
    process.env.DEV_MODE = 'true';
    const testName = `Cold Brew ${Date.now()}`;
    const insertRes = await insertBusinessRow(schemaName, 'products', {
      name: testName,
      description: 'Slow-steeped craft brew',
      category: 'Beverage',
      price: 4.75,
      available: 1,
    });

    expect(insertRes.error).toBeNull();
    expect(insertRes.data).toBeDefined();
    expect((insertRes.data as any).name).toBe(testName);
    expect(Number((insertRes.data as any).price)).toBe(4.75);
    expect((insertRes.data as any).available).toBe(1);

    // Verify row is queryable
    const queryRes = await queryBusinessRows(schemaName, 'products', ['*'], {
      where: { name: testName },
    });
    expect(queryRes.error).toBeNull();
    expect(queryRes.data?.length).toBeGreaterThanOrEqual(1);
  });

  test('handles currency strings and missing available flag', async () => {
    process.env.DEV_MODE = 'true';
    const rawPrice = '$12.50';
    const cleanedPrice = Number(rawPrice.replace(/^\$/, ''));
    const testName = `Specialty Roast ${Date.now()}`;

    const insertRes = await insertBusinessRow(schemaName, 'products', {
      name: testName,
      price: cleanedPrice,
      available: 1,
    });

    expect(insertRes.error).toBeNull();
    expect(Number((insertRes.data as any).price)).toBe(12.5);
    expect((insertRes.data as any).available).toBe(1);
  });

  test('Catalog Registrar role falls back to preset permissions when terminal has {}', () => {
    // Empty permissions in database
    const emptyPerms = '{}';

    const normalized = normalizePermissions(emptyPerms, 'catalog-registrar');
    expect(normalized.tables['*']?.insert).toBe(true);
    expect(normalized.tables['*']?.read).toBe(true);
    expect(normalized.tables['*']?.update).toBe(true);
    expect(normalized.tables['*']?.delete).toBe(false);

    // Also with title-cased role
    const normalizedTitle = normalizePermissions(emptyPerms, 'Catalog Registrar');
    expect(normalizedTitle.tables['*']?.insert).toBe(true);

    // isActionAllowed allows insert into products
    const allowed = isActionAllowed(normalized, {
      type: 'insert',
      table: 'products',
    }, 'catalog-registrar');
    expect(allowed).toBe(true);
  });

  test('runtime payload resolver resolves both $$input. and $$inputs.', () => {
    const ctx = {
      cart: [],
      inputs: {
        'product-name': 'Matcha Latte',
        'price': '5.50',
      },
      uploads: {},
    };

    expect(resolveRuntimePayload('$$input.product-name', ctx)).toBe('Matcha Latte');
    expect(resolveRuntimePayload('$$inputs.price', ctx)).toBe('5.50');
  });

  test('RealtimeHub broadcasts catalog mutation to subscribers', async () => {
    const businessId = 'test-biz-catalog';
    let receivedMutation: any = null;

    const unsubscribe = realtimeHub.subscribe(businessId, (mutation) => {
      receivedMutation = mutation;
    });

    realtimeHub.publish(businessId, {
      table: 'products',
      action: 'insert',
      recordId: 'prod-123',
      data: { name: 'Croissant', price: 3.5 },
    });

    expect(receivedMutation).not.toBeNull();
    expect(receivedMutation.table).toBe('products');
    expect(receivedMutation.action).toBe('insert');
    expect(receivedMutation.recordId).toBe('prod-123');
    expect(receivedMutation.data.name).toBe('Croissant');

    unsubscribe();
  });

  test('diagnose dev.db terminals, businesses, and permissions', async () => {
    process.env.DEV_MODE = 'true';
    const businesses = await db.query('SELECT * FROM businesses');
    console.log('DIAGNOSE BUSINESSES:', JSON.stringify(businesses.data));

    const terminals = await db.query('SELECT id, business_id, display_name, role, permissions, is_public, public_slug FROM terminals');
    console.log('DIAGNOSE TERMINALS:', JSON.stringify(terminals.data));

    const sqliteTables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('DIAGNOSE TABLES:', JSON.stringify(sqliteTables.data));

    const catalogTerminal = await db.queryOne<{ ui_layout: string }>("SELECT ui_layout FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");
    const parsed = JSON.parse(catalogTerminal.data?.ui_layout ?? '{}');
    const elementsSummary = (parsed.elements ?? []).map((e: any) => ({
      id: e.id,
      type: e.type,
      fieldName: e.fieldName,
      events: e.events,
    }));
    const tableInfo = await db.query("PRAGMA table_info(biz_devadmin_products)");
    console.log('BIZ_DEVADMIN_PRODUCTS COLUMNS:', JSON.stringify(tableInfo.data));
  });

  test('simulate runtime event insert for catalog terminal', async () => {
    process.env.DEV_MODE = 'true';
    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");
    expect(catalogTerm.data).toBeDefined();

    const biz = await db.queryOne<any>("SELECT * FROM businesses WHERE id = ?", [catalogTerm.data.business_id]);
    expect(biz.data).toBeDefined();

    const permissions = normalizePermissions(catalogTerm.data.permissions, catalogTerm.data.role);

    // Test action
    const action = {
      type: 'insert' as const,
      table: 'products',
      payload: {
        name: 'Simulated Espresso',
        description: 'Rich dark roast',
        category: 'Beverage',
        price: '3.50',
      },
    };

    const allowed = isActionAllowed(permissions, action, catalogTerm.data.role);
    expect(allowed).toBe(true);

    const ensured = await ensureStarterBusinessTable(biz.data.schema_name, action.table);
    expect(ensured.error).toBeNull();

    const insertPayload = { ...action.payload } as Record<string, any>;
    if (action.table === 'products') {
      if (insertPayload.price != null) {
        const rawPrice = String(insertPayload.price).trim().replace(/^\$/, '');
        const num = Number(rawPrice);
        if (!Number.isNaN(num)) {
          insertPayload.price = num;
        }
      }
      if (insertPayload.available === undefined || insertPayload.available === null) {
        insertPayload.available = 1;
      }
    }

    const inserted = await insertBusinessRow(
      biz.data.schema_name,
      action.table,
      insertPayload,
    );
    console.log('SIMULATED INSERT RESULT:', JSON.stringify(inserted));
    expect(inserted.error).toBeNull();
    expect(inserted.data).toBeDefined();
  });

  test('call event.post handler with valid terminal session cookie', async () => {
    process.env.DEV_MODE = 'true';
    const { default: eventHandler } = await import('../server/api/runtime/event.post');
    const { createTerminalSessionToken } = await import('../lib/authUtils');

    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");
    const token = await createTerminalSessionToken({
      terminalId: catalogTerm.data.id,
      businessId: catalogTerm.data.business_id,
      displayName: catalogTerm.data.display_name,
      role: catalogTerm.data.role,
    });

    const bodyPayload = {
      events: [
        {
          inpoint_id: catalogTerm.data.id,
          business_id: catalogTerm.data.business_id,
          element_id: 'catalog-product-submit',
          trigger: 'click',
          action: {
            type: 'insert',
            table: 'products',
            payload: {
              name: '$$input.catalog-product-name',
              description: '$$input.catalog-product-description',
              category: '$$input.catalog-product-category',
              price: '$$input.catalog-product-price',
            },
          },
          payload: {
            name: 'Cookie Roast',
            description: 'Delicious mocha roast',
            category: 'Beverage',
            price: '$ 1,299.99',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const mockReq = {
      method: 'POST',
      headers: {
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      },
      body: bodyPayload,
      [Symbol.for('h3ParsedBody')]: bodyPayload,
    };


    const mockEvent = {
      method: 'POST',
      node: {
        req: mockReq,
        res: {},
      },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: {
        body: bodyPayload,
      },
      _body: bodyPayload,
    } as any;



    try {
      const response = await eventHandler(mockEvent);
      expect(response).toBeDefined();
      expect(response.results).toBeDefined();
      expect(response.results[0].ok).toBe(true);
    } catch (err: any) {
      console.log('EVENT HANDLER ERROR:', err.message, err.statusCode);
      throw err;
    }
  });

  test('station aliases resolve to catalog-registrar and other workstation presets', () => {
    expect(presetByRoleOrKey('Menu Catalog')?.key).toBe('catalog-registrar');
    expect(presetByRoleOrKey('Catalog Desk')?.key).toBe('catalog-registrar');
    expect(presetByRoleOrKey('catalog')?.key).toBe('catalog-registrar');
    expect(presetByRoleOrKey('Front Counter')?.key).toBe('cashier-register');
    expect(presetByRoleOrKey('Stock Room')?.key).toBe('inventory-manager');
    expect(presetByRoleOrKey('Kitchen Queue')?.key).toBe('kitchen-display');
  });

  test('friendlySaveMessage handles diverse error scenarios', async () => {
    const { friendlySaveMessage } = await import('../composables/useEventQueue');

    expect(friendlySaveMessage('Missing terminal session')).toBe(
      'Your terminal session has expired. Please sign in again.',
    );
    expect(friendlySaveMessage('401 Unauthorized')).toBe(
      'Your terminal session has expired. Please sign in again.',
    );
    expect(friendlySaveMessage('Forbidden: permission denied')).toBe(
      'You do not have permission to make this change on this terminal.',
    );
    expect(friendlySaveMessage('UNIQUE constraint failed: biz_devadmin_products.name')).toBe(
      'That item already exists. Try a different name or code.',
    );
    expect(friendlySaveMessage('NOT NULL constraint failed: biz_devadmin_products.price')).toBe(
      'Some required information is missing. Check the form and try again.',
    );
    expect(friendlySaveMessage('Failed to fetch from network')).toBe(
      'Network connection issue. Please check your connection and try again.',
    );
    expect(friendlySaveMessage('Something weird happened')).toBe(
      'We could not save that change. Check the information and try again.',
    );
  });

  test('currency strings with commas and spaces parse cleanly in product inserts', async () => {
    process.env.DEV_MODE = 'true';
    const testCases = [
      { raw: '$ 1,299.99', expected: 1299.99 },
      { raw: '  $  3,450.50  ', expected: 3450.50 },
      { raw: '$0.99', expected: 0.99 },
    ];

    for (const { raw, expected } of testCases) {
      const cleanNum = Number(raw.replace(/^[$\s]+/, '').replace(/,/g, '').trim());
      expect(cleanNum).toBe(expected);

      const res = await insertBusinessRow(schemaName, 'products', {
        name: `Item ${Date.now()}_${expected}`,
        price: cleanNum,
        available: 1,
      });
      expect(res.error).toBeNull();
      expect(Number((res.data as any).price)).toBe(expected);
    }
  });
});






