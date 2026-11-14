import { describe, expect, test } from 'bun:test';
import { db } from '../lib/db';
import { normalizePermissions, isActionAllowed, resolveTablePermissions } from '../lib/permissions';
import { createTerminalSessionToken } from '../lib/authUtils';
import eventHandler from '../server/api/runtime/event.post';
import { insertBusinessRow, queryBusinessRows, updateBusinessRow, fetchRowById } from '../server/utils/businessTable';
import { ensureStarterBusinessTable } from '../server/utils/starterTables';

describe('Break kitchen served - Links 1 to 12', () => {
  test('Step by step trace of kitchen mark as served', async () => {
    process.env.DEV_MODE = 'true';

    // 1. Get business and kitchen terminal (prefer biz_devadmin; seed kitchen terminal if missing)
    let biz = await db.queryOne<any>("SELECT * FROM businesses WHERE id = 'biz_devadmin' LIMIT 1");
    if (!biz.data) {
      biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    }
    expect(biz.data).toBeDefined();

    let kitchenTerm = await db.queryOne<any>(
      "SELECT * FROM terminals WHERE business_id = ? AND (role LIKE '%kitchen%' OR display_name LIKE '%kitchen%')",
      [biz.data.id]
    );
    if (!kitchenTerm.data) {
      const termId = `kitchen-display-test-${Date.now()}`;
      await db.insert('terminals', {
        id: termId,
        business_id: biz.data.id,
        display_name: 'Kitchen Queue',
        role: 'kitchen-display',
        pin_hash: '1234',
        pin_code: '1234',
        pin_length: 4,
        permissions: JSON.stringify(normalizePermissions({}, 'kitchen-display')),
        created_at: new Date().toISOString(),
      });
      kitchenTerm = await db.queryOne<any>("SELECT * FROM terminals WHERE id = ?", [termId]);
    }
    expect(kitchenTerm.data).toBeDefined();

    // Query orders as the kitchen display would query them (seed one if empty after db:reset)
    await ensureStarterBusinessTable(biz.data.schema_name, 'orders');
    let queriedOrders = await queryBusinessRows(
      biz.data.schema_name,
      'orders',
      ['created_at', 'table_number', 'items', 'status', 'total'],
      { limit: 20, orderBy: 'created_at', descending: true }
    );
    if (!queriedOrders.data || queriedOrders.data.length === 0) {
      await insertBusinessRow(biz.data.schema_name, 'orders', {
        table_number: 'T-01',
        items: '1x Matcha Latte',
        status: 'pending',
        total: 180,
      });
      queriedOrders = await queryBusinessRows(
        biz.data.schema_name,
        'orders',
        ['created_at', 'table_number', 'items', 'status', 'total'],
        { limit: 20, orderBy: 'created_at', descending: true }
      );
    }
    expect(queriedOrders.data?.length).toBeGreaterThan(0);
    const orderToServe = (queriedOrders.data as any[])[0];
    console.log('Order to serve:', orderToServe);
    expect(orderToServe.id).toBeDefined();

    // 2. Client dispatch payload test
    // What does TableViewEl dispatch?
    // action: { type: 'update', table: 'orders', rowId: orderToServe.id, payload: { status: 'fulfilled' } }
    // envelope: { action: { ... }, payload: { status: 'fulfilled' } }
    
    // Test what happens with token for this kitchen terminal
    const token = await createTerminalSessionToken({
      terminalId: kitchenTerm.data.id,
      businessId: biz.data.id,
      displayName: kitchenTerm.data.display_name,
      role: kitchenTerm.data.role,
    });

    const serveEvent = {
      inpoint_id: kitchenTerm.data.id,
      business_id: biz.data.id,
      element_id: 'kitchen-orders-board',
      trigger: 'click' as const,
      action: {
        type: 'update' as const,
        table: 'orders',
        rowId: orderToServe.id,
        payload: { status: 'fulfilled' },
      },
      payload: { status: 'fulfilled' },
      timestamp: new Date().toISOString(),
    };

    const mockReq = {
      method: 'POST',
      headers: {
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      },
      body: { events: [serveEvent] },
      [Symbol.for('h3ParsedBody')]: { events: [serveEvent] },
    };

    const mockEvent = {
      method: 'POST',
      node: { req: mockReq, res: {} },
      headers: new Headers({
        cookie: `kogane_terminal_session=${token}`,
        'content-type': 'application/json',
      }),
      context: { body: { events: [serveEvent] } },
      _body: { events: [serveEvent] },
    };

    const response = await eventHandler(mockEvent as any);
    console.log('Event handler response:', response);
    expect(response.results[0].ok).toBe(true);

    // Verify row was updated in SQLite
    const updatedRow = await fetchRowById(biz.data.schema_name, 'orders', orderToServe.id);
    console.log('Updated row in DB:', updatedRow.data);
    expect((updatedRow.data as any).status).toBe('fulfilled');
  });
});
