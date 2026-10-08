/**
 * Statutory and custom discount engine for Kogane POS.
 *
 * Implements Philippine Republic Act No. 9994 (Senior Citizens) & RA 10754 (PWDs):
 * - 1 PWD / Senior Citizen discount applies to ONE item unit only.
 * - The discount is automatically applied to the highest-priced unit(s) in the transaction.
 * - For multiple PWDs per table/transaction (N beneficiaries), the 20% statutory discount
 *   automatically applies to the top N highest-value units in the cart.
 * - Under Philippine tax law, sales to PWD/Seniors are also VAT-exempt.
 */

export type DiscountType = 'none' | 'pwd' | 'senior' | 'percent' | 'fixed';

export interface DiscountCartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface AppliedDiscountLine {
  id: string;
  name: string;
  price: number;
  qty: number;
  discountedQty: number;
  regularQty: number;
  discountAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  isTaxExempt: boolean;
}

export interface DiscountCalculationOptions {
  discountType: DiscountType;
  beneficiaryCount?: number;
  customPercent?: number;
  customFixed?: number;
  reference?: string | null;
}

export interface DiscountCalculationResult {
  discountType: DiscountType;
  beneficiaryCount: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  discountLabel: string;
  discountReference: string | null;
  taxExemptGross: number;
  taxableGross: number;
  lineItems: AppliedDiscountLine[];
  metadata: {
    discountType: DiscountType;
    beneficiaryCount: number;
    eligibleUnitsCount: number;
    eligibleGross: number;
    discountRate: number;
    reference: string | null;
  };
}

/**
 * Rounds a monetary amount to 2 decimal places.
 */
export function roundCurrency(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

/**
 * Calculates cart discounts and VAT exemption breakdowns.
 */
export function calculateOrderDiscounts(
  cart: DiscountCartItem[],
  options: DiscountCalculationOptions,
): DiscountCalculationResult {
  const discountType = options.discountType || 'none';
  const rawCount = Number(options.beneficiaryCount);
  const beneficiaryCount = Math.max(1, Number.isFinite(rawCount) ? Math.floor(rawCount) : 1);
  const reference = options.reference?.trim() || null;

  // Compute gross subtotal
  let subtotal = 0;
  for (const item of cart) {
    const qty = Math.max(0, Number(item.qty) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    subtotal += price * qty;
  }
  subtotal = roundCurrency(subtotal);

  if (discountType === 'none' || subtotal <= 0 || cart.length === 0) {
    return {
      discountType: 'none',
      beneficiaryCount: 1,
      discountAmount: 0,
      subtotal,
      total: subtotal,
      discountLabel: '',
      discountReference: reference,
      taxExemptGross: 0,
      taxableGross: subtotal,
      lineItems: cart.map((item) => {
        const qty = Math.max(0, Number(item.qty) || 0);
        const price = Math.max(0, Number(item.price) || 0);
        const lineSubtotal = roundCurrency(price * qty);
        return {
          id: item.id,
          name: item.name,
          price,
          qty,
          discountedQty: 0,
          regularQty: qty,
          discountAmount: 0,
          lineSubtotal,
          lineTotal: lineSubtotal,
          isTaxExempt: false,
        };
      }),
      metadata: {
        discountType: 'none',
        beneficiaryCount: 1,
        eligibleUnitsCount: 0,
        eligibleGross: 0,
        discountRate: 0,
        reference,
      },
    };
  }

  // Custom Percentage discount (applies across whole subtotal)
  if (discountType === 'percent') {
    const rawPct = Number(options.customPercent);
    const pct = Math.min(100, Math.max(0, Number.isFinite(rawPct) ? rawPct : 10));
    const discountAmount = roundCurrency(subtotal * (pct / 100));
    const total = Math.max(0, roundCurrency(subtotal - discountAmount));
    const discountLabel = `${pct}% Off`;

    return {
      discountType: 'percent',
      beneficiaryCount: 1,
      discountAmount,
      subtotal,
      total,
      discountLabel,
      discountReference: reference,
      taxExemptGross: 0,
      taxableGross: subtotal,
      lineItems: cart.map((item) => {
        const qty = Math.max(0, Number(item.qty) || 0);
        const price = Math.max(0, Number(item.price) || 0);
        const lineSubtotal = roundCurrency(price * qty);
        const lineDiscount = roundCurrency(lineSubtotal * (pct / 100));
        return {
          id: item.id,
          name: item.name,
          price,
          qty,
          discountedQty: qty,
          regularQty: 0,
          discountAmount: lineDiscount,
          lineSubtotal,
          lineTotal: Math.max(0, roundCurrency(lineSubtotal - lineDiscount)),
          isTaxExempt: false,
        };
      }),
      metadata: {
        discountType: 'percent',
        beneficiaryCount: 1,
        eligibleUnitsCount: cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
        eligibleGross: subtotal,
        discountRate: pct / 100,
        reference,
      },
    };
  }

  // Custom Fixed discount (applies across whole subtotal, clamped)
  if (discountType === 'fixed') {
    const rawFixed = Number(options.customFixed);
    const fixed = Math.max(0, Number.isFinite(rawFixed) ? rawFixed : 0);
    const discountAmount = roundCurrency(Math.min(subtotal, fixed));
    const total = Math.max(0, roundCurrency(subtotal - discountAmount));
    const discountLabel = `Fixed Discount`;

    return {
      discountType: 'fixed',
      beneficiaryCount: 1,
      discountAmount,
      subtotal,
      total,
      discountLabel,
      discountReference: reference,
      taxExemptGross: 0,
      taxableGross: subtotal,
      lineItems: cart.map((item) => {
        const qty = Math.max(0, Number(item.qty) || 0);
        const price = Math.max(0, Number(item.price) || 0);
        const lineSubtotal = roundCurrency(price * qty);
        return {
          id: item.id,
          name: item.name,
          price,
          qty,
          discountedQty: 0,
          regularQty: qty,
          discountAmount: 0,
          lineSubtotal,
          lineTotal: lineSubtotal,
          isTaxExempt: false,
        };
      }),
      metadata: {
        discountType: 'fixed',
        beneficiaryCount: 1,
        eligibleUnitsCount: 0,
        eligibleGross: discountAmount,
        discountRate: 0,
        reference,
      },
    };
  }

  // Statutory PWD or Senior Citizen 20% discount
  // 1 beneficiary = 1 unit discount applied to highest value item.
  // N beneficiaries = top N units get 20% discount.
  const rate = 0.20;

  // Deconstruct individual units from cart items
  interface UnitRecord {
    itemId: string;
    name: string;
    unitPrice: number;
  }

  const allUnits: UnitRecord[] = [];
  for (const item of cart) {
    const qty = Math.max(0, Number(item.qty) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    for (let i = 0; i < qty; i++) {
      allUnits.push({
        itemId: item.id,
        name: item.name,
        unitPrice: price,
      });
    }
  }

  // Sort descending by price so highest-value items get discounted first
  allUnits.sort((a, b) => b.unitPrice - a.unitPrice);

  const eligibleUnitsCount = Math.min(beneficiaryCount, allUnits.length);
  const eligibleUnits = allUnits.slice(0, eligibleUnitsCount);

  // Count how many units per itemId are eligible
  const discountedUnitsByItemId = new Map<string, number>();
  let eligibleGross = 0;
  let totalDiscount = 0;

  for (const unit of eligibleUnits) {
    eligibleGross += unit.unitPrice;
    const unitDiscount = roundCurrency(unit.unitPrice * rate);
    totalDiscount += unitDiscount;
    discountedUnitsByItemId.set(
      unit.itemId,
      (discountedUnitsByItemId.get(unit.itemId) ?? 0) + 1,
    );
  }

  const discountAmount = roundCurrency(totalDiscount);
  const total = Math.max(0, roundCurrency(subtotal - discountAmount));
  const taxExemptGross = roundCurrency(eligibleGross);
  const taxableGross = Math.max(0, roundCurrency(subtotal - taxExemptGross));

  const kindName = discountType === 'pwd' ? 'PWD' : 'Senior';
  const discountLabel = beneficiaryCount > 1
    ? `${kindName} (20% x ${eligibleUnitsCount})`
    : `${kindName} (20%)`;

  const remainingDiscountedByItemId = new Map(discountedUnitsByItemId);

  const lineItems: AppliedDiscountLine[] = cart.map((item) => {
    const qty = Math.max(0, Number(item.qty) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    const lineSubtotal = roundCurrency(price * qty);
    const availableDiscount = remainingDiscountedByItemId.get(item.id) ?? 0;
    const discountedQty = Math.min(qty, availableDiscount);
    remainingDiscountedByItemId.set(item.id, availableDiscount - discountedQty);
    const regularQty = Math.max(0, qty - discountedQty);
    const itemDiscount = roundCurrency(discountedQty * price * rate);
    const lineTotal = Math.max(0, roundCurrency(lineSubtotal - itemDiscount));

    return {
      id: item.id,
      name: item.name,
      price,
      qty,
      discountedQty,
      regularQty,
      discountAmount: itemDiscount,
      lineSubtotal,
      lineTotal,
      isTaxExempt: discountedQty > 0,
    };
  });

  return {
    discountType,
    beneficiaryCount,
    discountAmount,
    subtotal,
    total,
    discountLabel,
    discountReference: reference,
    taxExemptGross,
    taxableGross,
    lineItems,
    metadata: {
      discountType,
      beneficiaryCount,
      eligibleUnitsCount,
      eligibleGross,
      discountRate: rate,
      reference,
    },
  };
}
