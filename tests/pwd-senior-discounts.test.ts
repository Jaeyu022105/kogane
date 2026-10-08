import { describe, expect, test } from 'bun:test';
import { calculateOrderDiscounts, roundCurrency } from '../lib/discounts';

describe('PWD and Senior Citizen Statutory Discount Engine', () => {
  test('single PWD discount applies strictly to one highest-value item in cart', () => {
    // 3 different items: Ribeye Steak (550), Pasta (280), Iced Tea (90)
    const cart = [
      { id: 'item-tea', name: 'Iced Tea', price: 90, qty: 1 },
      { id: 'item-steak', name: 'Ribeye Steak', price: 550, qty: 1 },
      { id: 'item-pasta', name: 'Pasta Carbonara', price: 280, qty: 1 },
    ];

    const result = calculateOrderDiscounts(cart, {
      discountType: 'pwd',
      beneficiaryCount: 1,
      reference: 'PWD-12345',
    });

    // Subtotal: 550 + 280 + 90 = 920
    expect(result.subtotal).toBe(920);

    // Highest item is Ribeye Steak (550). 20% of 550 = 110.
    expect(result.discountAmount).toBe(110);
    expect(result.total).toBe(810);
    expect(result.taxExemptGross).toBe(550);
    expect(result.taxableGross).toBe(370);
    expect(result.metadata.eligibleUnitsCount).toBe(1);
    expect(result.discountLabel).toBe('PWD (20%)');
    expect(result.discountReference).toBe('PWD-12345');

    // Ribeye Steak should have 1 discounted unit; Pasta and Tea should have 0
    const steakLine = result.lineItems.find((l) => l.id === 'item-steak');
    const pastaLine = result.lineItems.find((l) => l.id === 'item-pasta');
    const teaLine = result.lineItems.find((l) => l.id === 'item-tea');

    expect(steakLine?.discountedQty).toBe(1);
    expect(steakLine?.discountAmount).toBe(110);
    expect(pastaLine?.discountedQty).toBe(0);
    expect(pastaLine?.discountAmount).toBe(0);
    expect(teaLine?.discountedQty).toBe(0);
    expect(teaLine?.discountAmount).toBe(0);
  });

  test('single PWD with multiple quantities of highest-value item discounts only 1 unit', () => {
    // 2x Cold Brew at 150 each, 1x Croissant at 95
    const cart = [
      { id: 'prod-brew', name: 'Cold Brew', price: 150, qty: 2 },
      { id: 'prod-croissant', name: 'Croissant', price: 95, qty: 1 },
    ];

    const result = calculateOrderDiscounts(cart, {
      discountType: 'pwd',
      beneficiaryCount: 1,
    });

    // Subtotal: 2*150 + 95 = 395
    expect(result.subtotal).toBe(395);

    // Only 1 Cold Brew gets 20%: 150 * 0.2 = 30
    expect(result.discountAmount).toBe(30);
    expect(result.total).toBe(365);
    expect(result.taxExemptGross).toBe(150);
    expect(result.taxableGross).toBe(245);

    const brewLine = result.lineItems.find((l) => l.id === 'prod-brew');
    expect(brewLine?.discountedQty).toBe(1);
    expect(brewLine?.regularQty).toBe(1);
    expect(brewLine?.discountAmount).toBe(30);
  });

  test('multiple PWDs per table (N = 2) applies 20% to the top 2 highest-value units', () => {
    // Wagyu Burger (350, qty 1), Club Sandwich (250, qty 2), Fries (120, qty 1)
    // Units sorted by price: [350, 250, 250, 120]
    // Top 2 units: 350 and 250
    const cart = [
      { id: 'item-burger', name: 'Wagyu Burger', price: 350, qty: 1 },
      { id: 'item-sandwich', name: 'Club Sandwich', price: 250, qty: 2 },
      { id: 'item-fries', name: 'Fries', price: 120, qty: 1 },
    ];

    const result = calculateOrderDiscounts(cart, {
      discountType: 'pwd',
      beneficiaryCount: 2,
    });

    // Subtotal: 350 + 500 + 120 = 970
    expect(result.subtotal).toBe(970);

    // Top 2: 350 * 0.2 = 70, 250 * 0.2 = 50. Total discount = 120.
    expect(result.discountAmount).toBe(120);
    expect(result.total).toBe(850);
    expect(result.taxExemptGross).toBe(600);
    expect(result.taxableGross).toBe(370);
    expect(result.discountLabel).toBe('PWD (20% x 2)');

    const burgerLine = result.lineItems.find((l) => l.id === 'item-burger');
    const sandwichLine = result.lineItems.find((l) => l.id === 'item-sandwich');
    const friesLine = result.lineItems.find((l) => l.id === 'item-fries');

    expect(burgerLine?.discountedQty).toBe(1);
    expect(burgerLine?.discountAmount).toBe(70);

    expect(sandwichLine?.discountedQty).toBe(1);
    expect(sandwichLine?.regularQty).toBe(1);
    expect(sandwichLine?.discountAmount).toBe(50);

    expect(friesLine?.discountedQty).toBe(0);
    expect(friesLine?.discountAmount).toBe(0);
  });

  test('multiple PWDs (N = 3) where N matches or exceeds total units clamps cleanly', () => {
    const cart = [
      { id: 'p1', name: 'Espresso', price: 100, qty: 1 },
      { id: 'p2', name: 'Latte', price: 150, qty: 1 },
    ];

    // N = 5 PWDs, but only 2 items in cart
    const result = calculateOrderDiscounts(cart, {
      discountType: 'pwd',
      beneficiaryCount: 5,
    });

    // Subtotal: 250
    expect(result.subtotal).toBe(250);
    // Both items discounted: 150 * 0.2 = 30, 100 * 0.2 = 20 -> 50
    expect(result.discountAmount).toBe(50);
    expect(result.total).toBe(200);
    expect(result.taxExemptGross).toBe(250);
    expect(result.taxableGross).toBe(0);
    expect(result.metadata.eligibleUnitsCount).toBe(2);
    expect(result.discountLabel).toBe('PWD (20% x 2)');
  });

  test('Senior Citizen discount works identically to PWD with Senior label', () => {
    const cart = [
      { id: 'p1', name: 'Roast Chicken', price: 320, qty: 1 },
      { id: 'p2', name: 'Soup', price: 110, qty: 1 },
    ];

    const result = calculateOrderDiscounts(cart, {
      discountType: 'senior',
      beneficiaryCount: 1,
      reference: 'OSCA-9876',
    });

    // Highest item is Roast Chicken (320). 20% of 320 = 64.
    expect(result.discountAmount).toBe(64);
    expect(result.total).toBe(366);
    expect(result.discountLabel).toBe('Senior (20%)');
    expect(result.discountReference).toBe('OSCA-9876');
  });

  test('empty cart and none discount type produce 0 discount', () => {
    const cartEmpty = calculateOrderDiscounts([], { discountType: 'pwd', beneficiaryCount: 2 });
    expect(cartEmpty.discountAmount).toBe(0);
    expect(cartEmpty.total).toBe(0);

    const cartNone = calculateOrderDiscounts(
      [{ id: 'p1', name: 'Cookie', price: 50, qty: 2 }],
      { discountType: 'none' },
    );
    expect(cartNone.discountAmount).toBe(0);
    expect(cartNone.total).toBe(100);
    expect(cartNone.taxExemptGross).toBe(0);
    expect(cartNone.taxableGross).toBe(100);
  });

  test('custom percent and fixed discounts apply properly', () => {
    const cart = [
      { id: 'p1', name: 'Pizza', price: 400, qty: 1 },
      { id: 'p2', name: 'Drink', price: 100, qty: 1 },
    ];

    // 15% custom discount on 500 subtotal = 75
    const pct = calculateOrderDiscounts(cart, {
      discountType: 'percent',
      customPercent: 15,
    });
    expect(pct.discountAmount).toBe(75);
    expect(pct.total).toBe(425);
    expect(pct.discountLabel).toBe('15% Off');

    // 60 fixed discount
    const fixed = calculateOrderDiscounts(cart, {
      discountType: 'fixed',
      customFixed: 60,
    });
    expect(fixed.discountAmount).toBe(60);
    expect(fixed.total).toBe(440);
  });

  test('duplicate cart items with same ID only consume allocated discount units once', () => {
    // 2 entries with identical id 'item-steak'
    const cart = [
      { id: 'item-steak', name: 'Ribeye Steak', price: 500, qty: 1 },
      { id: 'item-steak', name: 'Ribeye Steak', price: 500, qty: 1 },
    ];

    const result = calculateOrderDiscounts(cart, {
      discountType: 'pwd',
      beneficiaryCount: 1,
    });

    // Subtotal = 1000. 1 PWD = 20% on one 500 unit = 100 discount.
    expect(result.subtotal).toBe(1000);
    expect(result.discountAmount).toBe(100);
    expect(result.total).toBe(900);

    // Sum of discounts across line items must exactly equal order discount
    const lineDiscountTotal = result.lineItems.reduce((sum, item) => sum + item.discountAmount, 0);
    expect(lineDiscountTotal).toBe(100);

    const discountedLines = result.lineItems.filter((item) => item.discountedQty > 0);
    expect(discountedLines.length).toBe(1);
    expect(discountedLines[0].discountAmount).toBe(100);

    const regularLines = result.lineItems.filter((item) => item.regularQty > 0);
    expect(regularLines.length).toBe(1);
    expect(regularLines[0].discountAmount).toBe(0);
  });
});
