export type ReportGrouping = 'day' | 'week' | 'month';

function parseDateInput(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;

  const raw = value.trim();
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const normalized = isDateOnly
    ? `${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : raw;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeDateRange(from?: string, to?: string) {
  const toDate = parseDateInput(to, true) ?? new Date();
  const fromDate = parseDateInput(from)
    ?? new Date(toDate.getTime() - 1000 * 60 * 60 * 24 * 30);

  return {
    from: fromDate,
    to: toDate,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function normalizeDateValue(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // SQLite datetime('now') format: YYYY-MM-DD HH:MM:SS (which is UTC in SQLite)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
      const hasTz = trimmed.includes('Z') || /[+-]\d{2}(:\d{2})?$/.test(trimmed);
      const iso = trimmed.replace(' ', 'T') + (hasTz ? '' : 'Z');
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toDateBucket(dateValue: string | number | Date, group: ReportGrouping): string {
  const date = normalizeDateValue(dateValue) ?? (dateValue instanceof Date ? dateValue : new Date(dateValue));
  const utc = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));

  if (group === 'day') {
    return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
  }

  if (group === 'month') {
    return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}`;
  }

  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${pad(weekNo)}`;
}

export function inDateRange(value: string | number | Date | null | undefined, from: Date, to: Date): boolean {
  if (!value) return false;
  const date = normalizeDateValue(value);
  if (!date || Number.isNaN(date.getTime())) return false;
  return date >= from && date <= to;
}
