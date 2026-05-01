const DISALLOWED_SQL_TOKENS = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'create',
  'grant',
  'revoke',
  'truncate',
  'comment',
  'vacuum',
  'analyze',
  'copy',
  'listen',
  'unlisten',
  'execute',
  'call',
  'do',
];

export function normalizeSql(sql: string): string {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

export function validateReadOnlySql(sql: string): string {
  const normalized = normalizeSql(sql);
  if (!normalized) throw new Error('SQL is required');

  const lower = normalized.toLowerCase();
  if (!lower.startsWith('select') && !lower.startsWith('with')) {
    throw new Error('Only SELECT statements are allowed');
  }

  const statements = normalized
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  if (statements.length > 1) {
    throw new Error('Only a single read-only statement is allowed');
  }

  for (const token of DISALLOWED_SQL_TOKENS) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(lower)) {
      throw new Error(`Disallowed SQL keyword detected: ${token.toUpperCase()}`);
    }
  }

  return normalized.replace(/;+\s*$/, '');
}

export function limitSqlRows(sql: string, limit = 1000): string {
  return `SELECT * FROM (${sql}) AS report_query LIMIT ${limit}`;
}
