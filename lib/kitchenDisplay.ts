/**
 * Helper utilities for kitchen display workstations and order inspection.
 */

export interface ParsedInspectionItem {
  id?: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
  discount?: number;
  discounted_qty?: number;
  taxable?: boolean;
  notes?: string;
}

/**
 * Parses line items from an order record for rich inspection in the kitchen modal.
 * Supports both JSON stringified line_items and plain text items summaries.
 */
export function parseInspectionItems(order: Record<string, unknown> | null): ParsedInspectionItem[] {
  if (!order) return [];

  if (order.line_items) {
    try {
      const parsed = typeof order.line_items === 'string'
        ? JSON.parse(order.line_items as string)
        : order.line_items;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => {
          const qty = Number(item.qty ?? item.quantity ?? 1) || 1;
          const price = Number(item.price ?? item.unit_price ?? 0) || 0;
          const subtotal = Number(item.subtotal ?? (price * qty)) || (price * qty);
          return {
            id: item.id ? String(item.id) : undefined,
            name: String(item.name ?? item.title ?? 'Item'),
            qty,
            price,
            subtotal,
            discount: item.discount != null ? Number(item.discount) : undefined,
            discounted_qty: item.discounted_qty != null ? Number(item.discounted_qty) : undefined,
            taxable: item.taxable,
            notes: item.notes ? String(item.notes) : undefined,
          };
        });
      }
    } catch {
      // Fall through to text summary parsing
    }
  }

  const rawSummary = String(order.items || '').trim();
  if (!rawSummary) return [];

  const parts = rawSummary.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  return parts.map((part, idx) => {
    const matchQty = part.match(/^(\d+)\s*[xX]\s*(.+)$/) || part.match(/^(.+?)\s*[xX]\s*(\d+)$/);
    let qty = 1;
    let name = part;
    if (matchQty) {
      if (/^\d+$/.test(matchQty[1])) {
        qty = parseInt(matchQty[1], 10);
        name = matchQty[2].trim();
      } else {
        name = matchQty[1].trim();
        qty = parseInt(matchQty[2], 10);
      }
    }

    const priceMatch = name.match(/\(([$\s0-9.,-]+)\)$/);
    let price = 0;
    if (priceMatch) {
      name = name.replace(/\(([$\s0-9.,-]+)\)$/, '').trim();
      const cleaned = priceMatch[1].replace(/[^0-9.-]+/g, '');
      const num = parseFloat(cleaned);
      if (Number.isFinite(num)) {
        price = num;
      }
    }

    let notes: string | undefined;
    const noteMatch = name.match(/\[(.*?)\]/) || name.match(/note:\s*([^)]+)/i);
    if (noteMatch) {
      notes = noteMatch[1].trim();
      name = name.replace(/\[(.*?)\]/, '').replace(/note:\s*[^)]+/i, '').trim();
    }

    return {
      id: `item-${idx}`,
      name,
      qty,
      price,
      subtotal: price * qty,
      notes,
    };
  });
}
