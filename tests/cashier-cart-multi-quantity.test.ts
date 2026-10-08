import { describe, expect, test, beforeEach } from 'bun:test';
import { BUILDER_PRESETS } from '../lib/builderPresets';
import { STATION_OBJECTS } from '../lib/stationObjects';

// Set up minimal globals required by useCanvasRuntime in bun test environment
const mockState: Record<string, any> = {};
(globalThis as any).useState = (key: string, init: () => any) => {
  if (!mockState[key]) {
    mockState[key] = { value: init() };
  }
  return mockState[key];
};
(globalThis as any).readonly = (val: any) => val;
(globalThis as any).useEventQueue = () => ({
  enqueue: async () => ({ ok: true }),
});
(globalThis as any).useModal = () => ({
  alert: async () => {},
});
(globalThis as any).useAuth = () => ({
  authHeaders: () => ({}),
});
(globalThis as any).useRealtimeSync = () => ({
  connect: () => {},
  disconnect: () => {},
});
(globalThis as any).$fetch = async () => ({ results: [] });

// Import useCanvasRuntime
const { useCanvasRuntime } = await import('../composables/useCanvasRuntime');

describe('Cashier Cart - Multiple / Repeated Items & Quantity Controls', () => {
  beforeEach(() => {
    // Reset runtime state before each test
    const runtime = useCanvasRuntime();
    runtime.reset();
  });

  test('clicking/tapping the same food repeatedly increments its quantity (1 -> 2 -> 3)', () => {
    const runtime = useCanvasRuntime();
    expect(runtime.state.value.cart).toEqual([]);

    // 1st click: Add Americano
    runtime.addToCart({ id: 'prod-americano', name: 'Americano', price: 120 });
    expect(runtime.state.value.cart.length).toBe(1);
    expect(runtime.state.value.cart[0]).toEqual({
      id: 'prod-americano',
      name: 'Americano',
      price: 120,
      qty: 1,
    });

    // 2nd click: Add same Americano again
    runtime.addToCart({ id: 'prod-americano', name: 'Americano', price: 120 });
    expect(runtime.state.value.cart.length).toBe(1);
    expect((runtime.state.value.cart[0] as any).qty).toBe(2);

    // 3rd click: Add same Americano again
    runtime.addToCart({ id: 'prod-americano', name: 'Americano', price: 120 });
    expect(runtime.state.value.cart.length).toBe(1);
    expect((runtime.state.value.cart[0] as any).qty).toBe(3);

    // Verify subtotal calculation
    const items = runtime.state.value.cart as Array<{ price: number; qty: number }>;
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    expect(subtotal).toBe(360);
  });

  test('handles multiple different products with separate quantities', () => {
    const runtime = useCanvasRuntime();

    runtime.addToCart({ id: 'food-croissant', name: 'Butter Croissant', price: 95 });
    runtime.addToCart({ id: 'food-latte', name: 'Matcha Latte', price: 155 });
    runtime.addToCart({ id: 'food-croissant', name: 'Butter Croissant', price: 95 });
    runtime.addToCart({ id: 'food-sandwich', name: 'Club Sandwich', price: 210 });
    runtime.addToCart({ id: 'food-latte', name: 'Matcha Latte', price: 155 });
    runtime.addToCart({ id: 'food-latte', name: 'Matcha Latte', price: 155 });

    const cart = runtime.state.value.cart as Array<{ id: string; name: string; price: number; qty: number }>;
    expect(cart.length).toBe(3);

    const croissant = cart.find((i) => i.id === 'food-croissant');
    const latte = cart.find((i) => i.id === 'food-latte');
    const sandwich = cart.find((i) => i.id === 'food-sandwich');

    expect(croissant?.qty).toBe(2);
    expect(latte?.qty).toBe(3);
    expect(sandwich?.qty).toBe(1);

    // Subtotal: 2*95 + 3*155 + 1*210 = 190 + 465 + 210 = 865
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    expect(subtotal).toBe(865);
  });

  test('inline quantity increment and decrement controls work properly', () => {
    const runtime = useCanvasRuntime();

    runtime.addToCart({ id: 'item-1', name: 'Espresso', price: 80 });
    expect((runtime.state.value.cart[0] as any).qty).toBe(1);

    // Cashier taps + button to increase qty
    runtime.updateCartItemQty('item-1', 2);
    expect((runtime.state.value.cart[0] as any).qty).toBe(2);

    runtime.updateCartItemQty('item-1', 5);
    expect((runtime.state.value.cart[0] as any).qty).toBe(5);

    // Cashier taps - button to decrease qty
    runtime.updateCartItemQty('item-1', 4);
    expect((runtime.state.value.cart[0] as any).qty).toBe(4);

    // Decreasing to 0 removes the item
    runtime.updateCartItemQty('item-1', 0);
    expect(runtime.state.value.cart.length).toBe(0);
  });

  test('removeFromCart deletes item immediately and clearCart empties all items', () => {
    const runtime = useCanvasRuntime();

    runtime.addToCart({ id: 'a', name: 'Item A', price: 10 });
    runtime.addToCart({ id: 'b', name: 'Item B', price: 20 });
    runtime.addToCart({ id: 'c', name: 'Item C', price: 30 });
    expect(runtime.state.value.cart.length).toBe(3);

    runtime.removeFromCart('b');
    expect(runtime.state.value.cart.length).toBe(2);
    expect(runtime.state.value.cart.some((i: any) => i.id === 'b')).toBe(false);

    runtime.clearCart();
    expect(runtime.state.value.cart).toEqual([]);
  });

  test('runtime event listeners handle cart:add, cart:update-qty, cart:remove, cart:clear', () => {
    const runtime = useCanvasRuntime();

    runtime.emitLocal('cart:add', { id: 'evt-item', name: 'Event Cake', price: 150 });
    expect(runtime.state.value.cart.length).toBe(1);
    expect((runtime.state.value.cart[0] as any).qty).toBe(1);

    runtime.emitLocal('cart:add', { id: 'evt-item', name: 'Event Cake', price: 150 });
    expect((runtime.state.value.cart[0] as any).qty).toBe(2);

    runtime.emitLocal('cart:update-qty', { id: 'evt-item', qty: 4 });
    expect((runtime.state.value.cart[0] as any).qty).toBe(4);

    runtime.emitLocal('cart:remove', 'evt-item');
    expect(runtime.state.value.cart.length).toBe(0);

    runtime.addToCart({ id: 'evt-item-2', name: 'Juice', price: 50 });
    expect(runtime.state.value.cart.length).toBe(1);

    runtime.emitLocal('cart:clear');
    expect(runtime.state.value.cart.length).toBe(0);
  });

  test('frozen/readonly objects do not break quantity increments or throw errors', () => {
    const runtime = useCanvasRuntime();

    // Simulate Vue 3 readonly-frozen objects in cart
    const frozenItem = Object.freeze({ id: 'frozen-food', name: 'Frozen Bagel', price: 85, qty: 1 });
    runtime.setCartValue([frozenItem]);

    // Adding more of the same food must clone and increment without throwing
    expect(() => {
      runtime.addToCart({ id: 'frozen-food', name: 'Frozen Bagel', price: 85 });
    }).not.toThrow();

    expect(runtime.state.value.cart.length).toBe(1);
    expect((runtime.state.value.cart[0] as any).qty).toBe(2);
  });

  test('generates accurate line items and order summary string with repeated quantities', () => {
    const cart = [
      { id: '1', name: 'Americano', price: 120, qty: 3 },
      { id: '2', name: 'Butter Croissant', price: 95, qty: 2 },
    ];

    const lineItems = cart.map((item) => ({
      ...item,
      subtotal: item.price * item.qty,
    }));

    const itemsSummary = lineItems
      .map((item) => `${item.name} x${item.qty}`)
      .join(', ');

    expect(itemsSummary).toBe('Americano x3, Butter Croissant x2');
    expect(lineItems[0].subtotal).toBe(360);
    expect(lineItems[1].subtotal).toBe(190);

    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
    expect(subtotal).toBe(550);

    // 20% PWD discount
    const discount = Math.round(subtotal * 0.2 * 100) / 100;
    const total = subtotal - discount;
    expect(discount).toBe(110);
    expect(total).toBe(440);
  });

  test('addToCart respects explicit item.qty and second argument quantity', () => {
    const runtime = useCanvasRuntime();

    // Adding item with qty: 3 in payload
    runtime.addToCart({ id: 'cold-brew', name: 'Cold Brew', price: 95, qty: 3 });
    expect(runtime.state.value.cart.length).toBe(1);
    expect((runtime.state.value.cart[0] as any).qty).toBe(3);

    // Adding 2 more via second argument
    runtime.addToCart({ id: 'cold-brew', name: 'Cold Brew', price: 95 }, 2);
    expect(runtime.state.value.cart.length).toBe(1);
    expect((runtime.state.value.cart[0] as any).qty).toBe(5);

    // Adding 1 more with default
    runtime.addToCart({ id: 'cold-brew', name: 'Cold Brew', price: 95 });
    expect((runtime.state.value.cart[0] as any).qty).toBe(6);
  });

  test('updateCartItemQty sanitizes invalid, negative, or NaN quantities by removing the item', () => {
    const runtime = useCanvasRuntime();

    runtime.addToCart({ id: 'matcha', name: 'Matcha', price: 120 });
    expect(runtime.state.value.cart.length).toBe(1);

    // Negative quantity removes item
    runtime.updateCartItemQty('matcha', -1);
    expect(runtime.state.value.cart.length).toBe(0);

    runtime.addToCart({ id: 'matcha', name: 'Matcha', price: 120 });
    expect(runtime.state.value.cart.length).toBe(1);

    // NaN or non-number removes item
    runtime.updateCartItemQty('matcha', NaN);
    expect(runtime.state.value.cart.length).toBe(0);
  });

  test('removeFromCart accepts both string ID and object with id property', () => {
    const runtime = useCanvasRuntime();

    runtime.addToCart({ id: 'p1', name: 'Product 1', price: 10 });
    runtime.addToCart({ id: 'p2', name: 'Product 2', price: 20 });
    expect(runtime.state.value.cart.length).toBe(2);

    runtime.removeFromCart({ id: 'p1' } as any);
    expect(runtime.state.value.cart.length).toBe(1);
    expect((runtime.state.value.cart[0] as any).id).toBe('p2');

    runtime.removeFromCart('p2');
    expect(runtime.state.value.cart.length).toBe(0);
  });
});

describe('Cashier Workstation Preset - Spacious Layout Verification', () => {
  test('cashier-station preset in BUILDER_PRESETS has generous dimensions', () => {
    const cashierPreset = BUILDER_PRESETS.find((p) => p.id === 'cashier-station');
    expect(cashierPreset).toBeDefined();

    const salePanel = cashierPreset?.layout.elements.find((el) => el.id === 'cashier-sale-panel');
    expect(salePanel).toBeDefined();
    expect(salePanel?.type).toBe('cart-widget');

    // Generous width and comfortable height
    expect(salePanel?.position.width).toBeGreaterThanOrEqual(780);
    expect(salePanel?.position.height).toBeGreaterThanOrEqual(572);

    const openOrders = cashierPreset?.layout.elements.find((el) => el.id === 'cashier-open-orders');
    expect(openOrders).toBeDefined();
    // Open orders height matches sale panel height
    expect(openOrders?.position.height).toBe(salePanel?.position.height);
  });

  test('cashier-sale-panel in STATION_OBJECTS has spacious default size', () => {
    const salePanelObj = STATION_OBJECTS.find((obj) => obj.id === 'cashier-sale-panel');
    expect(salePanelObj).toBeDefined();
    expect(salePanelObj?.defaultSize.width).toBeGreaterThanOrEqual(780);
    expect(salePanelObj?.defaultSize.height).toBeGreaterThanOrEqual(572);
  });
});

describe('Cashier Front Counter UI & Layout Robustness', () => {
  test('CartWidgetEl template enforces 2 generous columns and eliminates squished 3-column grid', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    const widgetPath = resolve(process.cwd(), 'components/elements/CartWidgetEl.vue');
    const widgetContent = readFileSync(widgetPath, 'utf-8');

    // Must not contain xl:grid-cols-3 or grid-cols-3 which squished product cards
    expect(widgetContent).not.toContain('xl:grid-cols-3');
    expect(widgetContent).not.toContain('grid-cols-3');

    // Catalog grid uses 2 columns
    expect(widgetContent).toContain('grid grid-cols-2 gap-3');
  });

  test('CartWidgetEl product cards allow multiline names and prevent price / Add overlap', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    const widgetPath = resolve(process.cwd(), 'components/elements/CartWidgetEl.vue');
    const widgetContent = readFileSync(widgetPath, 'utf-8');

    // Product name uses line-clamp-2 and break-words instead of single-line truncate
    expect(widgetContent).toContain('line-clamp-2 break-words');
    expect(widgetContent).toContain(':title="getProductName(product, getProductIdentifier(product, idx))"');

    // Price and Add button have dedicated space, shrink-0, and whitespace-nowrap
    expect(widgetContent).toContain('shrink-0 tabular-nums');
    expect(widgetContent).toContain('shrink-0 whitespace-nowrap');
  });

  test('CartWidgetEl maintains balanced panel sizing and multiline cart line items', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    const widgetPath = resolve(process.cwd(), 'components/elements/CartWidgetEl.vue');
    const widgetContent = readFileSync(widgetPath, 'utf-8');

    // Sidebar width is balanced (not xl:w-[430px] or md:w-[390px] that suffocated catalog)
    expect(widgetContent).not.toContain('xl:w-[430px]');
    expect(widgetContent).not.toContain('md:w-[390px]');
    expect(widgetContent).toContain('md:w-[330px]');

    // Cart line items support multiline wrapped names up to 3 lines
    expect(widgetContent).toContain('line-clamp-3 break-words');
    expect(widgetContent).toContain(':title="item.name"');
  });

  test('CartWidgetEl product cards feature clean category tags and collision-proof flex-wrap price row', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    const widgetPath = resolve(process.cwd(), 'components/elements/CartWidgetEl.vue');
    const widgetContent = readFileSync(widgetPath, 'utf-8');

    // Price row uses flex-wrap so long currencies or compact widths do not collide
    expect(widgetContent).toContain('flex-wrap mt-2 pt-2 border-t');

    // Category tags are rendered as clean bounded pills
    expect(widgetContent).toContain('inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate');

    // Button and product name explicitly specify high-contrast textColor
    expect(widgetContent).toContain(':style="{ color: textColor }"');
  });

  test('Queue-priority preset variant maintains spacious >=720px sale panel width', async () => {
    const { layoutVariantsForPreset } = await import('../lib/starterWorkstations');
    const variants = layoutVariantsForPreset('cashier-register');
    expect(variants.some((v) => v.id === 'queue-priority')).toBe(true);

    const { db } = await import('../lib/db');
    const biz = await db.queryOne<any>("SELECT * FROM businesses LIMIT 1");
    expect(biz.data).toBeDefined();

    const managedMod = await import('../server/utils/managedTerminals');
    const created = await managedMod.createManagedTerminal({
      businessId: biz.data.id,
      businessSchema: biz.data.schema_name,
      displayName: `Queue Register ${Date.now()}`,
      presetKey: 'cashier-register',
      layoutVariant: 'queue-priority',
    });

    expect(created.error).toBeNull();
    const layout = typeof created.terminal?.ui_layout === 'string'
      ? JSON.parse(created.terminal.ui_layout)
      : created.terminal?.ui_layout;
    const panel = layout?.elements?.find((el: any) => el.id === 'cashier-sale-panel');
    expect(panel).toBeDefined();
    expect(panel?.position?.width).toBeGreaterThanOrEqual(720);
  });

  test('Runtime handles long product names cleanly in cart summary and line items', () => {
    const runtime = useCanvasRuntime();

    const longItem = {
      id: 'prod-avocado-deluxe',
      name: 'Avocado Toast with Poached Egg and Organic Microgreens',
      price: 185,
    };
    const specialtyDrink = {
      id: 'prod-cold-brew-specialty',
      name: 'Single Origin Ethiopia Yirgacheffe Specialty Cold Brew',
      price: 160,
    };

    runtime.addToCart(longItem);
    runtime.addToCart(specialtyDrink, 2);

    const cart = runtime.state.value.cart as Array<{ id: string; name: string; price: number; qty: number }>;
    expect(cart.length).toBe(2);

    const summary = cart.map((i) => `${i.name} x${i.qty}`).join(', ');
    expect(summary).toBe(
      'Avocado Toast with Poached Egg and Organic Microgreens x1, Single Origin Ethiopia Yirgacheffe Specialty Cold Brew x2',
    );

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    expect(subtotal).toBe(185 + 160 * 2);
  });
});


