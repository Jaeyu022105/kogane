import { describe, expect, test } from 'bun:test';
import { BUILDER_PRESETS } from '../lib/builderPresets';
import { TERMINAL_PERMISSION_PRESETS, isActionAllowed, presetByKey, inferPermissionPreset } from '../lib/permissions';
import { getStationName } from '../lib/starterWorkstations';

describe('Ecommerce elimination from builder presets', () => {
  test('builder presets only contain the 5 official workstation presets', () => {
    const ids = BUILDER_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      'cashier-station',
      'catalog-station',
      'inventory-station',
      'kitchen-station',
      'reports-station',
    ]);
  });

  test('no legacy pos-screen or checkout buttons exist in presets', () => {
    const posPreset = BUILDER_PRESETS.find((p) => p.id === 'pos-screen');
    expect(posPreset).toBeUndefined();

    for (const preset of BUILDER_PRESETS) {
      const checkoutEl = preset.layout.elements.find(
        (el) => el.id === 'pos-checkout' || (el as any).text === 'Checkout'
      );
      expect(checkoutEl).toBeUndefined();
    }
  });

  test('retail station naming is Cashier Register, not checkout', () => {
    expect(getStationName('retail', 'cashier-register')).toBe('Cashier Register');
  });
});

describe('Kitchen Display order status permissions', () => {
  test('kitchen-display preset allows updating orders status but denies other tables', () => {
    const kitchenPreset = presetByKey('kitchen-display');
    expect(kitchenPreset).not.toBeNull();

    // Updating orders should be ALLOWED
    const canUpdateOrders = isActionAllowed(kitchenPreset!.permissions, {
      type: 'update',
      table: 'orders',
      rowId: 'order-123',
      payload: { status: 'preparing' },
    });
    expect(canUpdateOrders).toBe(true);

    // Reading orders should be ALLOWED
    const canReadOrders = isActionAllowed(kitchenPreset!.permissions, {
      type: 'query',
      table: 'orders',
    });
    expect(canReadOrders).toBe(true);

    // Inserting new orders should be DENIED (Cashier does this, not kitchen)
    const canInsertOrders = isActionAllowed(kitchenPreset!.permissions, {
      type: 'insert',
      table: 'orders',
      payload: { total: 100 },
    });
    expect(canInsertOrders).toBe(false);

    // Deleting orders should be DENIED
    const canDeleteOrders = isActionAllowed(kitchenPreset!.permissions, {
      type: 'delete',
      table: 'orders',
      rowId: 'order-123',
    });
    expect(canDeleteOrders).toBe(false);

    // Updating products or inventory should be DENIED
    const canUpdateInventory = isActionAllowed(kitchenPreset!.permissions, {
      type: 'update',
      table: 'inventory',
      rowId: 'inv-1',
      payload: { quantity: 0 },
    });
    expect(canUpdateInventory).toBe(false);
  });

  test('inferPermissionPreset correctly identifies kitchen-display preset', () => {
    const kitchenPreset = presetByKey('kitchen-display')!;
    const inferred = inferPermissionPreset(kitchenPreset.permissions);
    expect(inferred?.key).toBe('kitchen-display');
  });
});
