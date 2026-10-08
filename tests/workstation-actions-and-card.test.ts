import { describe, expect, test } from 'bun:test';
import { isActionAllowed, normalizePermissions, presetByKey } from '../lib/permissions';
import { realtimeHub } from '../server/utils/realtimeHub';
import { db } from '../lib/db';
import { createTerminalSessionToken } from '../lib/authUtils';
import { ensureStarterBusinessTable } from '../server/utils/starterTables';
import eventHandler from '../server/api/runtime/event.post';

import { insertBusinessRow, queryBusinessRows } from '../server/utils/businessTable';

describe('Workstation Actions: Card Reader, Catalog CRUD, Kitchen Served', () => {
  test('Catalog Registrar preset grants both update and delete on products table', () => {
    const catalogPreset = presetByKey('catalog-registrar');
    expect(catalogPreset).toBeDefined();

    // Permissions on products table
    const perms = normalizePermissions(catalogPreset!.permissions, 'catalog-registrar');

    const canUpdateProducts = isActionAllowed(perms, {
      type: 'update',
      table: 'products',
      rowId: 'prod-1',
      payload: { name: 'Updated Latte', price: 4.5 },
    }, 'catalog-registrar');
    expect(canUpdateProducts).toBe(true);

    const canDeleteProducts = isActionAllowed(perms, {
      type: 'delete',
      table: 'products',
      rowId: 'prod-1',
    }, 'catalog-registrar');
    expect(canDeleteProducts).toBe(true);

    // Catalog registrar cannot delete orders or inventory
    const canDeleteOrders = isActionAllowed(perms, {
      type: 'delete',
      table: 'orders',
      rowId: 'ord-1',
    }, 'catalog-registrar');
    expect(canDeleteOrders).toBe(false);
  });

  test('Kitchen Display preset allows updating orders status to fulfilled / served', () => {
    const kitchenPreset = presetByKey('kitchen-display');
    expect(kitchenPreset).toBeDefined();

    const perms = normalizePermissions(kitchenPreset!.permissions, 'kitchen-display');

    const canMarkServed = isActionAllowed(perms, {
      type: 'update',
      table: 'orders',
      rowId: 'ord-99',
      payload: { status: 'fulfilled' },
    }, 'kitchen-display');
    expect(canMarkServed).toBe(true);

    // Kitchen display cannot delete orders or modify products
    const canDeleteOrders = isActionAllowed(perms, {
      type: 'delete',
      table: 'orders',
      rowId: 'ord-99',
    }, 'kitchen-display');
    expect(canDeleteOrders).toBe(false);

    const canUpdateProducts = isActionAllowed(perms, {
      type: 'update',
      table: 'products',
      rowId: 'prod-1',
      payload: { price: 10 },
    }, 'kitchen-display');
    expect(canUpdateProducts).toBe(false);
  });

  test('Server runtime event handles catalog product update and delete with sanitization', async () => {
    process.env.DEV_MODE = 'true';
    const catalogTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = 'd047d7294f03036a4f3fe94fa3be66d0'");
    expect(catalogTerm.data).toBeDefined();

    const biz = await db.queryOne<any>("SELECT * FROM businesses WHERE id = ?", [catalogTerm.data.business_id]);
    expect(biz.data).toBeDefined();

    await ensureStarterBusinessTable(biz.data.schema_name, 'products');

    const token = await createTerminalSessionToken({
      terminalId: catalogTerm.data.id,
      businessId: catalogTerm.data.business_id,
      displayName: catalogTerm.data.display_name,
      role: catalogTerm.data.role,
    });

    // 1. Insert a test product
    const insertRes = await insertBusinessRow(biz.data.schema_name, 'products', {
      name: 'Test Matcha',
      price: 5.0,
      category: 'Beverage',
      available: 1,
    });
    const productId = (insertRes.data as any)?.id;
    expect(productId).toBeDefined();

    // 2. Dispatch update event via event.post handler
    const updateBody = {
      events: [
        {
          inpoint_id: catalogTerm.data.id,
          business_id: catalogTerm.data.business_id,
          element_id: 'catalog-products-table',
          trigger: 'click',
          action: {
            type: 'update',
            table: 'products',
            rowId: productId,
          },
          payload: {
            name: 'Iced Matcha Supreme',
            price: '$ 6.75',
            category: 'Cold Drinks',
            available: false,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const mockUpdateReq = {
      method: 'POST',
      headers: {
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      },
      body: updateBody,
      [Symbol.for('h3ParsedBody')]: updateBody,
    };

    const mockUpdateEvent = {
      method: 'POST',
      node: { req: mockUpdateReq, res: {} },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: { body: updateBody },
      _body: updateBody,
    };

    const updateResponse = await eventHandler(mockUpdateEvent as any);
    expect(updateResponse.results[0].ok).toBe(true);

    // Verify row was updated in SQLite with parsed price and available integer
    const updatedRow = await db.queryOne<any>(
      `SELECT * FROM ${biz.data.schema_name}_products WHERE id = ?`,
      [productId]
    );
    expect(updatedRow.data.name).toBe('Iced Matcha Supreme');
    expect(Number(updatedRow.data.price)).toBe(6.75);
    expect(updatedRow.data.category).toBe('Cold Drinks');
    expect(Number(updatedRow.data.available)).toBe(0);

    // 3. Dispatch delete event via event.post handler
    const deleteBody = {
      events: [
        {
          inpoint_id: catalogTerm.data.id,
          business_id: catalogTerm.data.business_id,
          element_id: 'catalog-products-table',
          trigger: 'click',
          action: {
            type: 'delete',
            table: 'products',
            rowId: productId,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const mockDeleteReq = {
      method: 'POST',
      headers: {
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      },
      body: deleteBody,
      [Symbol.for('h3ParsedBody')]: deleteBody,
    };

    const mockDeleteEvent = {
      method: 'POST',
      node: { req: mockDeleteReq, res: {} },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: { body: deleteBody },
      _body: deleteBody,
    };

    const deleteResponse = await eventHandler(mockDeleteEvent as any);
    expect(deleteResponse.results[0].ok).toBe(true);

    // Verify row is deleted in SQLite
    const deletedRow = await db.queryOne<any>(
      `SELECT * FROM ${biz.data.schema_name}_products WHERE id = ?`,
      [productId]
    );
    expect(deletedRow.data).toBeNull();
  });

  test('Kitchen order bump updates status to fulfilled and broadcasts via RealtimeHub', async () => {
    process.env.DEV_MODE = 'true';
    const biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    expect(biz.data).toBeDefined();

    await ensureStarterBusinessTable(biz.data.schema_name, 'orders');

    // Create or find a kitchen terminal
    let kitchenTerm = await db.queryOne<any>(
      "SELECT * FROM terminals WHERE business_id = ? AND (role = 'kitchen-display' OR role = 'kitchen' OR role = 'kitchen-queue' OR role = 'Kitchen Display')",
      [biz.data.id]
    );
    if (!kitchenTerm.data) {
      const { createManagedTerminal } = await import('../server/utils/managedTerminals');
      const managed = await createManagedTerminal({
        businessId: biz.data.id,
        businessSchema: biz.data.schema_name,
        displayName: 'Kitchen Display',
        presetKey: 'kitchen-display',
      });
      kitchenTerm = { data: managed.terminal };
    }

    const token = await createTerminalSessionToken({
      terminalId: kitchenTerm.data.id,
      businessId: biz.data.id,
      displayName: 'Kitchen Expediter',
      role: 'kitchen-display',
    });

    // Insert a pending order
    const insertRes = await insertBusinessRow(biz.data.schema_name, 'orders', {
      items: '2x Americano, 1x Croissant',
      total: 14.5,
      status: 'pending',
      table_number: 'Table 7',
    });
    const orderId = (insertRes.data as any)?.id;
    expect(orderId).toBeDefined();

    // Listen for SSE broadcast via realtimeHub
    let realtimeEvent: any = null;
    const unsub = realtimeHub.subscribe(biz.data.id, (payload) => {
      if (payload.table === 'orders' && payload.action === 'update') {
        realtimeEvent = payload;
      }
    });

    // Dispatch order status bump to 'fulfilled'
    const bumpBody = {
      events: [
        {
          inpoint_id: kitchenTerm.data.id,
          business_id: biz.data.id,
          element_id: 'kitchen-orders-board',
          trigger: 'click',
          action: {
            type: 'update',
            table: 'orders',
            rowId: orderId,
          },
          payload: {
            status: 'fulfilled',
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
      body: bumpBody,
      [Symbol.for('h3ParsedBody')]: bumpBody,
    };

    const mockEvent = {
      method: 'POST',
      node: { req: mockReq, res: {} },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: { body: bumpBody },
      _body: bumpBody,
    };

    const response = await eventHandler(mockEvent as any);
    expect(response.results[0].ok).toBe(true);

    // Verify order in SQLite is fulfilled
    const orderRow = await db.queryOne<any>(
      `SELECT * FROM ${biz.data.schema_name}_orders WHERE id = ?`,
      [orderId]
    );
    expect(orderRow.data.status).toBe('fulfilled');

    // Verify real-time broadcast was fired
    expect(realtimeEvent).not.toBeNull();
    expect(realtimeEvent.table).toBe('orders');
    expect(realtimeEvent.action).toBe('update');
    expect(realtimeEvent.recordId).toBe(String(orderId));
    expect(realtimeEvent.data?.status).toBe('fulfilled');

    unsub();
  });

  test('Cashier card charge order creation dispatches properly with paid status and receipt metadata', async () => {
    process.env.DEV_MODE = 'true';
    const biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    expect(biz.data).toBeDefined();

    await ensureStarterBusinessTable(biz.data.schema_name, 'orders');

    const cashierTerm = await db.queryOne<any>(
      "SELECT * FROM terminals WHERE business_id = ? LIMIT 1",
      [biz.data.id]
    );

    const token = await createTerminalSessionToken({
      terminalId: cashierTerm.data.id,
      businessId: biz.data.id,
      displayName: 'Cashier Station 1',
      role: 'cashier-register',
    });

    const cardRef = `CARD-${Date.now()}`;
    const rcptNum = `RCPT-${Date.now()}`;

    const orderBody = {
      events: [
        {
          inpoint_id: cashierTerm.data.id,
          business_id: biz.data.id,
          element_id: 'cashier-sale-panel',
          trigger: 'click',
          action: {
            type: 'insert',
            table: 'orders',
          },
          payload: {
            items: 'Matcha Latte x1, Cookie x2',
            line_items: [
              { id: '1', name: 'Matcha Latte', price: 5.5, qty: 1 },
              { id: '2', name: 'Cookie', price: 2.0, qty: 2 },
            ],
            subtotal: 9.5,
            total: 9.5,
            status: 'pending',
            table_number: 'Counter',
            payment_method: 'card',
            payment_status: 'paid',
            payment_reference: cardRef,
            receipt_number: rcptNum,
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
      body: orderBody,
      [Symbol.for('h3ParsedBody')]: orderBody,
    };

    const mockEvent = {
      method: 'POST',
      node: { req: mockReq, res: {} },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: { body: orderBody },
      _body: orderBody,
    };

    const response = await eventHandler(mockEvent as any);
    expect(response.results[0].ok).toBe(true);
    const createdId = (response.results[0].data as any)?.id;
    expect(createdId).toBeDefined();

    // Verify stored in SQLite
    const orderInDb = await db.queryOne<any>(
      `SELECT * FROM ${biz.data.schema_name}_orders WHERE id = ?`,
      [createdId]
    );
    expect(orderInDb.data.payment_method).toBe('card');
    expect(orderInDb.data.payment_status).toBe('paid');
    expect(orderInDb.data.payment_reference).toBe(cardRef);
    expect(orderInDb.data.table_number).toBe('Counter');
    expect(Number(orderInDb.data.total)).toBe(9.5);
  });

  test('Schema-prefixed product updates and deletes are allowed and sanitized', async () => {
    process.env.DEV_MODE = 'true';
    const biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    expect(biz.data).toBeDefined();

    let catalogTerm = await db.queryOne<any>(
      "SELECT * FROM terminals WHERE business_id = ? AND (role = 'catalog-registrar' OR role = 'catalog' OR role = 'Menu Catalog' OR role = 'catalog-desk') LIMIT 1",
      [biz.data.id]
    );
    if (!catalogTerm.data) {
      const { createManagedTerminal } = await import('../server/utils/managedTerminals');
      const managed = await createManagedTerminal({
        businessId: biz.data.id,
        businessSchema: biz.data.schema_name,
        displayName: 'Catalog Registrar',
        presetKey: 'catalog-registrar',
      });
      catalogTerm = { data: managed.terminal };
    }

    const token = await createTerminalSessionToken({
      terminalId: catalogTerm.data.id,
      businessId: biz.data.id,
      displayName: 'Catalog Staff',
      role: 'catalog-registrar',
    });

    // 1. Insert product
    const insertRes = await insertBusinessRow(biz.data.schema_name, 'products', {
      name: 'Special Nitro Cold Brew',
      price: 6.0,
      category: 'Beverage',
      available: 1,
    });
    const prodId = (insertRes.data as any)?.id;
    expect(prodId).toBeDefined();

    // 2. Dispatch update with schema-prefixed table name and dirty currency string
    const updateBody = {
      events: [
        {
          inpoint_id: catalogTerm.data.id,
          business_id: biz.data.id,
          element_id: 'catalog-table',
          trigger: 'click',
          action: {
            type: 'update',
            table: `${biz.data.schema_name}_products`,
            rowId: prodId,
          },
          payload: {
            name: 'Special Nitro Cold Brew (Large)',
            price: '$ 8.50',
            available: 0,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const mockUpdateReq = {
      method: 'POST',
      headers: {
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      },
      body: updateBody,
      [Symbol.for('h3ParsedBody')]: updateBody,
    };

    const mockUpdateEvent = {
      method: 'POST',
      node: { req: mockUpdateReq, res: {} },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: { body: updateBody },
      _body: updateBody,
    };

    const updateRes = await eventHandler(mockUpdateEvent as any);
    expect(updateRes.results[0].ok).toBe(true);

    const updatedRow = await db.queryOne<any>(
      `SELECT * FROM ${biz.data.schema_name}_products WHERE id = ?`,
      [prodId]
    );
    expect(updatedRow.data.name).toBe('Special Nitro Cold Brew (Large)');
    expect(Number(updatedRow.data.price)).toBe(8.5);
    expect(Number(updatedRow.data.available)).toBe(0);

    // 3. Dispatch delete
    const deleteBody = {
      events: [
        {
          inpoint_id: catalogTerm.data.id,
          business_id: biz.data.id,
          element_id: 'catalog-table',
          trigger: 'click',
          action: {
            type: 'delete',
            table: `${biz.data.schema_name}_products`,
            rowId: prodId,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const mockDeleteReq = {
      method: 'POST',
      headers: {
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      },
      body: deleteBody,
      [Symbol.for('h3ParsedBody')]: deleteBody,
    };

    const mockDeleteEvent = {
      method: 'POST',
      node: { req: mockDeleteReq, res: {} },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: { body: deleteBody },
      _body: deleteBody,
    };

    const deleteRes = await eventHandler(mockDeleteEvent as any);
    expect(deleteRes.results[0].ok).toBe(true);

    const deletedCheck = await db.queryOne<any>(
      `SELECT * FROM ${biz.data.schema_name}_products WHERE id = ?`,
      [prodId]
    );
    expect(deletedCheck.data).toBeNull();
  });

  test('queryBusinessRows automatically injects id column when specific columns are requested without id', async () => {
    process.env.DEV_MODE = 'true';
    const biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    expect(biz.data).toBeDefined();

    await ensureStarterBusinessTable(biz.data.schema_name, 'orders');

    const insertRes = await insertBusinessRow(biz.data.schema_name, 'orders', {
      table_number: 'Table 42',
      items: '1x Pour Over, 1x Cinnamon Roll',
      total: 12.0,
      status: 'pending',
    });
    const orderId = (insertRes.data as any)?.id;
    expect(orderId).toBeDefined();

    // Query with only standard kitchen display columns (omitting id)
    const result = await queryBusinessRows<any>(
      biz.data.schema_name,
      'orders',
      ['created_at', 'table_number', 'items', 'status', 'total'],
      { where: { id: orderId } }
    );

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
    const row = result.data![0];
    expect(row.id).toBe(orderId);
    expect(row.table_number).toBe('Table 42');
    expect(row.status).toBe('pending');
  });

  test('Kitchen order served status is normalized to fulfilled in database and realtime broadcast', async () => {
    process.env.DEV_MODE = 'true';
    const biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    expect(biz.data).toBeDefined();

    await ensureStarterBusinessTable(biz.data.schema_name, 'orders');

    const insertRes = await insertBusinessRow(biz.data.schema_name, 'orders', {
      items: '1x Cold Brew',
      total: 5.5,
      status: 'preparing',
      table_number: 'Table 3',
    });
    const orderId = (insertRes.data as any)?.id;
    expect(orderId).toBeDefined();

    let kitchenTerm = await db.queryOne<any>(
      "SELECT * FROM terminals WHERE business_id = ? AND (role = 'kitchen-display' OR role = 'kitchen' OR role = 'kitchen-queue' OR role = 'Kitchen Display')",
      [biz.data.id]
    );
    if (!kitchenTerm.data) {
      kitchenTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE business_id = ? LIMIT 1", [biz.data.id]);
    }

    const token = await createTerminalSessionToken({
      terminalId: kitchenTerm.data.id,
      businessId: biz.data.id,
      displayName: 'Kitchen Display',
      role: 'kitchen-display',
    });

    let realtimeEvent: any = null;
    const unsub = realtimeHub.subscribe(biz.data.id, (payload) => {
      if (payload.table === 'orders' && payload.action === 'update') {
        realtimeEvent = payload;
      }
    });

    // Send update with status: 'served' instead of 'fulfilled'
    const serveBody = {
      events: [
        {
          inpoint_id: kitchenTerm.data.id,
          business_id: biz.data.id,
          element_id: 'kitchen-orders-board',
          trigger: 'click',
          action: {
            type: 'update',
            table: 'orders',
            rowId: orderId,
          },
          payload: {
            status: 'served',
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
      body: serveBody,
      [Symbol.for('h3ParsedBody')]: serveBody,
    };

    const mockEvent = {
      method: 'POST',
      node: { req: mockReq, res: {} },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: { body: serveBody },
      _body: serveBody,
    };

    const response = await eventHandler(mockEvent as any);
    expect(response.results[0].ok).toBe(true);

    const orderRow = await db.queryOne<any>(
      `SELECT * FROM ${biz.data.schema_name}_orders WHERE id = ?`,
      [orderId]
    );
    // Verified normalized to 'fulfilled'
    expect(orderRow.data.status).toBe('fulfilled');
    expect(realtimeEvent?.data?.status).toBe('fulfilled');

    unsub();
  });

  test('Public terminal endpoint returns session token for client storage', async () => {
    process.env.DEV_MODE = 'true';
    const biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    expect(biz.data).toBeDefined();

    const testSlug = 'kitchen-kiosk-test';
    const term = await db.queryOne<any>("SELECT id FROM terminals WHERE business_id = ? LIMIT 1", [biz.data.id]);
    expect(term.data).toBeDefined();
    await db.update('terminals', { is_public: 1, public_slug: testSlug }, { id: term.data.id });

    const publicHandler = (await import('../server/api/terminals/public/[slug].get')).default;
    const mockPublicEvent = {
      method: 'GET',
      node: { req: {}, res: { setHeader: () => {}, getHeader: () => undefined } },
      context: { params: { slug: testSlug } },
    };

    const result = await publicHandler(mockPublicEvent as any);
    expect(result.error).toBeNull();
    expect(result.session).toBeDefined();
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(10);
  });
});

