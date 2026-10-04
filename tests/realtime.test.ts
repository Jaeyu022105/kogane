import { describe, expect, test, beforeEach } from 'bun:test';
import { realtimeHub, type RealtimeTableMutation } from '../server/utils/realtimeHub';

describe('RealtimeHub pub/sub synchronization', () => {
  beforeEach(() => {
    realtimeHub.clear();
  });

  test('delivers mutations to subscribers of the matching business', () => {
    const received: RealtimeTableMutation[] = [];
    const unsubscribe = realtimeHub.subscribe('biz-100', (event) => {
      received.push(event);
    });

    realtimeHub.publish('biz-100', {
      table: 'orders',
      action: 'insert',
      recordId: 'order-1',
      data: { total: 450, table_number: '5', status: 'pending' },
    });

    expect(received.length).toBe(1);
    expect(received[0].table).toBe('orders');
    expect(received[0].action).toBe('insert');
    expect(received[0].recordId).toBe('order-1');
    expect(received[0].data?.total).toBe(450);
    expect(received[0].type).toBe('table-mutation');
    expect(typeof received[0].timestamp).toBe('string');

    unsubscribe();
  });

  test('isolates events between different businesses', () => {
    const biz1Received: RealtimeTableMutation[] = [];
    const biz2Received: RealtimeTableMutation[] = [];

    const un有機1 = realtimeHub.subscribe('biz-alpha', (e) => biz1Received.push(e));
    const un有機2 = realtimeHub.subscribe('biz-beta', (e) => biz2Received.push(e));

    realtimeHub.publish('biz-alpha', {
      table: 'inventory',
      action: 'update',
      recordId: 'item-9',
      data: { quantity: 50 },
    });

    expect(biz1Received.length).toBe(1);
    expect(biz1Received[0].table).toBe('inventory');
    expect(biz2Received.length).toBe(0);

    un有機1();
    un有機2();
  });

  test('supports multiple subscribers per business and clean unsubscription', () => {
    let sub1Calls = 0;
    let sub2Calls = 0;

    const un有機1 = realtimeHub.subscribe('biz-kds', () => { sub1Calls++; });
    const un有機2 = realtimeHub.subscribe('biz-kds', () => { sub2Calls++; });

    expect(realtimeHub.listenerCount('biz-kds')).toBe(2);

    realtimeHub.publish('biz-kds', {
      table: 'orders',
      action: 'update',
      recordId: 'ord-3',
      data: { status: 'preparing' },
    });

    expect(sub1Calls).toBe(1);
    expect(sub2Calls).toBe(1);

    un有機1();
    expect(realtimeHub.listenerCount('biz-kds')).toBe(1);

    realtimeHub.publish('biz-kds', {
      table: 'orders',
      action: 'update',
      recordId: 'ord-3',
      data: { status: 'fulfilled' },
    });

    expect(sub1Calls).toBe(1); // un有機1 should not have received 2nd update
    expect(sub2Calls).toBe(2);

    un有機2();
    expect(realtimeHub.listenerCount('biz-kds')).toBe(0);
  });
});
