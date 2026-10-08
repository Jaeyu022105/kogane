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

    // 1. Get business and kitchen terminal
    const biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    expect(biz.data).toBeDefined();

    const kitchenTerm = await db.queryOne<any>(
      "SELECT * FROM terminals WHERE business_id = ? AND (role LIKE '%kitchen%' OR display_name LIKE '%kitchen%')",
      [biz.data.id]
    );
    expect(kitchenTerm.data).toBeDefined();

    // Query orders as the kitchen display would query them
    const queriedOrders = await queryBusinessRows(
      biz.data.schema_name,
      'orders',
      ['created_at', 'table_number', 'items', 'status', 'total'],
      { limit: 20, orderBy: 'created_at', descending: true }
    );
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
