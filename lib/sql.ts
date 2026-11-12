import { validateIdentifier } from './schemaUtils';

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
  'pragma',
  'attach',
  'detach',
  'replace',
  'reindex',
  'savepoint',
  'release',
  'rollback',
  'begin',
  'commit',
  'explain',
  'load_extension',
  'merge',
  'upsert',
  'into',
];

const FORBIDDEN_SYSTEM_TABLES = new Set([
  'users',
  'sessions',
  'businesses',
  'terminals',
  'audit_log',
  'presets',
  '__storage_blobs',
  'sqlite_master',
  'sqlite_schema',
  'sqlite_temp_master',
  'sqlite_temp_schema',
  'information_schema',
  'pg_catalog',
  'pg_class',
  'pg_tables',
  'pg_user',
  'pg_roles',
]);

/**
 * Replace ONLY single-quoted SQL string literals ('...') with ''.
 * Double-quoted tokens ("...") are SQL identifiers (e.g. "users") and MUST remain inspectable.
 */
function stripSingleQuotedLiterals(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "''");
}

export function normalizeSql(sql: string): string {
  if (typeof sql !== 'string') return '';
  return sql
    .replace(/('(?:''|[^'])*')|--[^\r\n]*|\/\*[\s\S]*?\*\//g, (_m, singleQuoted) =>
      singleQuoted !== undefined ? singleQuoted : ' ',
    )
    .trim();
}

export function validateReadOnlySql(sql: string): string {
  const normalized = normalizeSql(sql);
  if (!normalized) throw new Error('SQL is required');
  if (normalized.length > 8000) throw new Error('SQL query exceeds maximum allowed length');

  const withoutStrings = stripSingleQuotedLiterals(normalized);
  if (/\/\*|\*\//.test(withoutStrings)) {
    throw new Error('Unclosed SQL comment is not allowed');
  }

  const lower = withoutStrings.toLowerCase();
  if (!/^(select|with)\b/i.test(lower)) {
    throw new Error('Only SELECT statements are allowed');
  }

  // Allow at most one optional trailing semicolon outside string literals
  const trimmedNoTrailingSemi = withoutStrings.replace(/;+\s*$/, '');
  if (trimmedNoTrailingSemi.includes(';')) {
    throw new Error('Only a single read-only statement is allowed');
  }

  for (const token of DISALLOWED_SQL_TOKENS) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(lower)) {
      throw new Error(`Disallowed SQL keyword detected: ${token.toUpperCase()}`);
    }
  }

  return normalized.replace(/;+\s*$/, '');
}

function isForbiddenIdentifierName(name: string): boolean {
  const low = name.toLowerCase();
  return (
    FORBIDDEN_SYSTEM_TABLES.has(low) ||
    low.startsWith('biz_') ||
    low.startsWith('pragma_') ||
    low.startsWith('sqlite_') ||
    low.startsWith('pg_')
  );
}

function assertSingleTableReference(
  rawSegment: string,
  allowedSet: Set<string>,
  cteNames: Set<string>,
): boolean {
  const trimmed = rawSegment.trimStart();
  if (!trimmed) {
    throw new Error('Empty table reference in SQL query');
  }

  // Subquery: must start with SELECT or WITH (possibly nested parens)
  if (trimmed.startsWith('(')) {
    if (!/^\(\s*(?:\(\s*)*(?:SELECT|WITH)\b/i.test(trimmed)) {
      throw new Error('Only SELECT/WITH subqueries are allowed inside parentheses in FROM/JOIN');
    }
    return false;
  }

  // Reject quoted or string-literal table references like "users", `users`, [users], 'users'
  if (/^["`[']/.test(trimmed)) {
    throw new Error('Quoted or literal table references are not allowed in FROM/JOIN');
  }

  const match = /^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\.\s*("[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z_][a-zA-Z0-9_]*))?/.exec(trimmed);
  if (!match) {
    throw new Error('Could not verify referenced table against business tables');
  }

  if (match[2] !== undefined) {
    throw new Error(`Qualified table references ("${match[0].replace(/\s+/g, '')}") are not allowed; use your business table names directly`);
  }

  const target = match[1];
  const lowerTarget = target.toLowerCase();
  if (cteNames.has(lowerTarget)) {
    return false;
  }
  if (!allowedSet.has(target)) {
    throw new Error(`Table "${target}" does not exist in this business or is not accessible`);
  }
  return true;
}

const FROM_CLAUSE_STOP_KEYWORDS = new Set([
  'where',
  'group',
  'having',
  'order',
  'limit',
  'offset',
  'union',
  'intersect',
  'except',
  'window',
  'on',
  'using',
  'join',
  'inner',
  'left',
  'right',
  'full',
  'cross',
  'natural',
  'outer',
  'for',
  'values',
]);

/**
 * Scan every FROM <list> outside string/quoted-identifier tokens and validate
 * every comma-separated table reference in that FROM clause.
 */
function validateFromClauses(
  withoutStrings: string,
  allowedSet: Set<string>,
  cteNames: Set<string>,
): boolean {
  let hasTableRef = false;
  const fromRegex = /\bFROM\b/gi;
  let match: RegExpExecArray | null;

  while ((match = fromRegex.exec(withoutStrings)) !== null) {
    let pos = match.index + match[0].length;
    let expectTable = true;
    let depth = 0;

    while (pos < withoutStrings.length) {
      const ch = withoutStrings[pos];

      if (ch === "'" || ch === '"') {
        const quote = ch;
        if (expectTable && depth === 0) {
          assertSingleTableReference(withoutStrings.slice(pos), allowedSet, cteNames);
        }
        pos++;
        while (pos < withoutStrings.length) {
          if (withoutStrings[pos] === quote) {
            if (withoutStrings[pos + 1] === quote) {
              pos += 2;
              continue;
            }
            pos++;
            break;
          }
          pos++;
        }
        expectTable = false;
        continue;
      }

      if (ch === '(') {
        if (expectTable && depth === 0) {
          assertSingleTableReference(withoutStrings.slice(pos), allowedSet, cteNames);
          expectTable = false;
        }
        depth++;
        pos++;
        continue;
      }

      if (ch === ')') {
        if (depth === 0) break;
        depth--;
        pos++;
        continue;
      }

      if (depth === 0) {
        if (ch === ';') break;
        if (ch === ',') {
          expectTable = true;
          pos++;
          continue;
        }
        if (/\s/.test(ch)) {
          pos++;
          continue;
        }

        if (expectTable) {
          if (assertSingleTableReference(withoutStrings.slice(pos), allowedSet, cteNames)) {
            hasTableRef = true;
          }
          expectTable = false;
          // Advance past the identifier token
          const idMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(withoutStrings.slice(pos));
          pos += idMatch ? idMatch[0].length : 1;
          continue;
        }

        const wordMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(withoutStrings.slice(pos));
        if (wordMatch) {
          if (FROM_CLAUSE_STOP_KEYWORDS.has(wordMatch[0].toLowerCase())) {
            break;
          }
          pos += wordMatch[0].length;
          continue;
        }
      }

      pos++;
    }

    if (expectTable) {
      throw new Error('Could not verify referenced table in FROM clause');
    }
  }

  return hasTableRef;
}

/**
 * Validate a read-only SQL query and enforce strict per-tenant table isolation:
 * every referenced table in FROM / JOIN clauses must belong to `allowedTables`
 * (or be a CTE declared in the same query's WITH clause).
 */
export function validateAndQualifyBusinessSql(
  sql: string,
  schemaName: string,
  allowedTables: string[],
  prefixMode: boolean,
): string {
  validateIdentifier(schemaName);
  const validated = validateReadOnlySql(sql);
  const allowedSet = new Set(allowedTables);
  const withoutStrings = stripSingleQuotedLiterals(validated);

  // Reject non-ANSI backtick/bracket identifier quoting outside single-quoted literals
  if (/[`[\]]/.test(withoutStrings)) {
    throw new Error('Backtick and bracket identifiers are not allowed in custom reports');
  }

  // Collect CTE names declared in leading `WITH cte_name AS (...)`
  const cteNames = new Set<string>();
  const withRegex = /(?:^WITH\s+|,\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;
  let withMatch: RegExpExecArray | null;
  if (/^WITH\b/i.test(withoutStrings)) {
    if (/^WITH\s+RECURSIVE\b/i.test(withoutStrings)) {
      throw new Error('RECURSIVE CTEs are not allowed in custom reports');
    }
    while ((withMatch = withRegex.exec(withoutStrings)) !== null) {
      const cte = withMatch[1].toLowerCase();
      if (isForbiddenIdentifierName(cte)) {
        throw new Error(`CTE name "${withMatch[1]}" is forbidden`);
      }
      cteNames.add(cte);
    }
  }

  // Block any explicit mention of platform / catalog / other-tenant tables outside single-quoted literals
  // Check both unquoted identifiers AND double-quoted identifiers ("users", "biz_other_orders", etc.)
  const doubleQuotedIdRegex = /"([^"]*(?:""[^"]*)*)"/g;
  let dqMatch: RegExpExecArray | null;
  while ((dqMatch = doubleQuotedIdRegex.exec(withoutStrings)) !== null) {
    const inner = dqMatch[1].replace(/""/g, '"');
    if (isForbiddenIdentifierName(inner) && !allowedSet.has(inner) && !cteNames.has(inner.toLowerCase())) {
      throw new Error(`Access to table or schema "${inner}" is forbidden`);
    }
  }

  const loweredTokens = withoutStrings.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) ?? [];
  for (const tok of loweredTokens) {
    const low = tok.toLowerCase();
    if (isForbiddenIdentifierName(low) && !allowedSet.has(tok) && !cteNames.has(low)) {
      throw new Error(`Access to table or schema "${tok}" is forbidden`);
    }
  }

  // Validate every FROM clause (including multi-table comma joins) and every JOIN target
  let hasTableRef = validateFromClauses(withoutStrings, allowedSet, cteNames);

  const joinRegex = /\bJOIN\s+/gi;
  let joinMatch: RegExpExecArray | null;
  while ((joinMatch = joinRegex.exec(withoutStrings)) !== null) {
    const rest = withoutStrings.slice(joinMatch.index + joinMatch[0].length);
    if (assertSingleTableReference(rest, allowedSet, cteNames)) {
      hasTableRef = true;
    }
  }

  if (!hasTableRef && /\bFROM\b/i.test(withoutStrings) && cteNames.size === 0) {
    throw new Error('Could not verify referenced table against business tables');
  }

  // Replace unqualified business table tokens only outside single/double quotes and not after a dot
  const segments = validated.split(/('(?:''|[^'])*'|"(?:""|[^"])*")/g);
  return segments
    .map((segment, index) => {
      // Odd indices are quoted strings/identifiers — keep untouched
      if (index % 2 === 1) return segment;
      let out = segment;
      for (const table of allowedTables) {
        const qualified = prefixMode ? `"${schemaName}_${table}"` : `"${schemaName}"."${table}"`;
        const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(`(?<!\\.)\\b${escaped}\\b`, 'g'), qualified);
      }
      return out;
    })
    .join('');
}

export function limitSqlRows(sql: string, limit = 1000): string {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 1000) : 1000;
  return `SELECT * FROM (${sql}) AS report_query LIMIT ${safeLimit}`;
}
