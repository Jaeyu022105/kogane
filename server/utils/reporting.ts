export type ReportGrouping = 'day' | 'week' | 'month';

export function normalizeDateRange(from?: string, to?: string) {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 1000 * 60 * 60 * 24 * 30);

  return {
    from: Number.isNaN(fromDate.getTime()) ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) : fromDate,
    to: Number.isNaN(toDate.getTime()) ? new Date() : toDate,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toDateBucket(dateValue: string | number | Date, group: ReportGrouping): string {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
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
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= from && date <= to;
}
