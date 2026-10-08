import { describe, expect, test } from 'bun:test';
import { calculateOrderDiscounts } from '../lib/discounts';
import { parseInspectionItems } from '../lib/kitchenDisplay';

describe('Kitchen Display Full Order Inspection & Line Items', () => {
  test('parses JSON stringified line_items into rich inspection items', () => {
    const rawLineItems = JSON.stringify([
      { id: '1', name: 'Wagyu Ribeye (Medium Rare)', qty: 2, price: 650, subtotal: 1300, notes: 'No butter' },
      { id: '2', name: 'Truffle Fries', qty: 1, price: 220, subtotal: 220, notes: 'Extra crispy' },
      { id: '3', name: 'House Red Wine', qty: 2, price: 350, subtotal: 700 },
    ]);

    const order = {
      id: 'ord-12345',
      receipt_number: 'RCPT-001',
      table_number: 'Table 7',
      created_at: '2026-10-08 14:30:00',
      status: 'pending',
      line_items: rawLineItems,
      items: '2x Wagyu Ribeye, 1x Truffle Fries, 2x House Red Wine',
      subtotal: 2220,
      total: 2220,
    };

    const parsed = parseInspectionItems(order);
    expect(parsed.length).toBe(3);
    expect(parsed[0].name).toBe('Wagyu Ribeye (Medium Rare)');
    expect(parsed[0].qty).toBe(2);
    expect(parsed[0].price).toBe(650);
    expect(parsed[0].subtotal).toBe(1300);
    expect(parsed[0].notes).toBe('No butter');
    expect(parsed[1].name).toBe('Truffle Fries');
    expect(parsed[1].qty).toBe(1);
    expect(parsed[1].notes).toBe('Extra crispy');
    expect(parsed[2].name).toBe('House Red Wine');
    expect(parsed[2].notes).toBeUndefined();
  });

  test('parses plain text items summaries when line_items JSON is absent or fallback', () => {
    const order = {
      id: 'ord-plain',
      items: '3x Cappuccino ($135.00), 1x Blueberry Muffin ($95.00), 2x Iced Latte ($150.00)',
      total: 800,
    };

    const parsed = parseInspectionItems(order);
    expect(parsed.length).toBe(3);

    expect(parsed[0]).toEqual({
      id: 'item-0',
      name: 'Cappuccino',
      qty: 3,
      price: 135,
      subtotal: 405,
      notes: undefined,
    });
    expect(parsed[1]).toEqual({
      id: 'item-1',
      name: 'Blueberry Muffin',
      qty: 1,
      price: 95,
      subtotal: 95,
      notes: undefined,
    });
    expect(parsed[2]).toEqual({
      id: 'item-2',
      name: 'Iced Latte',
      qty: 2,
      price: 150,
      subtotal: 300,
      notes: undefined,
    });
  });

  test('order with 2 PWD discounts retains discounted item details and metadata', () => {
    const cart = [
      { id: '1', name: 'Steak', price: 600, qty: 1 },
      { id: '2', name: 'Salmon', price: 450, qty: 1 },
      { id: '3', name: 'Soup', price: 120, qty: 2 },
    ];

    const discount = calculateOrderDiscounts(cart, {
      discountType: 'pwd',
      beneficiaryCount: 2,
      reference: 'PWD-A100, PWD-B200',
    });

    // 2 PWDs on 600 and 450
    // Steak: 600 * 0.2 = 120
    // Salmon: 450 * 0.2 = 90
    // Total discount = 210
    expect(discount.discountAmount).toBe(210);
    expect(discount.total).toBe(1080);
    expect(discount.taxExemptGross).toBe(1050); // 600 + 450
    expect(discount.taxableGross).toBe(240); // 120 * 2
    expect(discount.discountLabel).toBe('PWD (20% x 2)');
    expect(discount.discountReference).toBe('PWD-A100, PWD-B200');

    // Line items for persistence
    const lineItems = discount.lineItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      qty: item.qty,
      subtotal: item.lineSubtotal,
      discount: item.discountAmount,
      discounted_qty: item.discountedQty,
      taxable: !item.isTaxExempt,
      total: item.lineTotal,
    }));

    const steak = lineItems.find((l) => l.name === 'Steak');
    expect(steak?.discount).toBe(120);
    expect(steak?.taxable).toBe(false);
    expect(steak?.total).toBe(480);

    const salmon = lineItems.find((l) => l.name === 'Salmon');
    expect(salmon?.discount).toBe(90);
    expect(salmon?.taxable).toBe(false);
    expect(salmon?.total).toBe(360);

    const soup = lineItems.find((l) => l.name === 'Soup');
    expect(soup?.discount).toBe(0);
    expect(soup?.taxable).toBe(true);
    expect(soup?.total).toBe(240);
  });
});
