import { describe, expect, test } from 'bun:test';
import { normalizeDateRange } from '../server/utils/reporting';
import { resolveRuntimePathTemplate } from '../lib/runtime';

describe('date ranges used by owner reports', () => {
  test('includes the complete selected end date', () => {
    const range = normalizeDateRange('2026-08-01', '2026-08-27');

    expect(range.from.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-08-27T23:59:59.999Z');
  });

  test('preserves explicit timestamp boundaries', () => {
    const range = normalizeDateRange('2026-08-01T08:30:00.000Z', '2026-08-27T17:45:00.000Z');

    expect(range.from.toISOString()).toBe('2026-08-01T08:30:00.000Z');
    expect(range.to.toISOString()).toBe('2026-08-27T17:45:00.000Z');
  });
});

describe('upload file naming', () => {
  test('turns the date placeholder into a readable file name', () => {
    const date = new Date(2026, 7, 27);

    expect(resolveRuntimePathTemplate('inventory/{{date}}.csv', date)).toBe('inventory/2026-08-27.csv');
  });
});
