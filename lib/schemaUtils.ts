/**
 * Schema utilities — identifier validation, SQL generation, normalization hints.
 * All DDL generation flows through here to ensure safety and consistency.
 */

export type ColumnType = 'text' | 'numeric' | 'integer' | 'boolean' | 'date' | 'timestamptz';

export interface ColumnDef {
  name: string;
  type: ColumnType;
  nullable: boolean;
  unique?: boolean;
  default?: string;
  references?: { table: string; column: string };
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
}

export interface SchemaDef {
  tables: TableDef[];
}

// Allowed characters for table/column identifiers — prevent SQL injection
const IDENTIFIER_RE = /^[a-z][a-z0-9_]{0,62}$/;
const FORBIDDEN_IDENTIFIERS = new Set(['__proto__', 'constructor', 'prototype']);

/** Validate identifier to prevent SQL injection and prototype pollution. */
export function validateIdentifier(name: string): void {
  if (typeof name !== 'string' || FORBIDDEN_IDENTIFIERS.has(name) || !IDENTIFIER_RE.test(name)) {
    throw new Error(
      `Invalid identifier "${String(name)}". Only lowercase letters, digits, and underscores are allowed (must start with a letter).`
    );
  }
}

const SAFE_DEFAULT_FUNCTIONS = new Set([
  'now()',
  'current_timestamp',
  'current_date',
  "(datetime('now'))",
  'gen_random_uuid()',
]);

/** Validate column DEFAULT expression so arbitrary SQL cannot be injected via schema definitions. */
export function validateColumnDefault(defaultValue: unknown): void {
  if (typeof defaultValue !== 'string') {
    throw new Error('Invalid column default value: must be a string literal.');
  }
  const trimmed = defaultValue.trim();
  if (!trimmed || trimmed.length > 128) {
    throw new Error('Invalid column default value: empty or exceeds 128 characters.');
  }
  if (SAFE_DEFAULT_FUNCTIONS.has(trimmed.toLowerCase())) {
    return;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return;
  }
  if (/^(true|false|null)$/i.test(trimmed)) {
    return;
  }
  if (/^'[A-Za-z0-9_ .,:+\-/@#()]{0,120}'$/.test(trimmed)) {
    return;
  }
  throw new Error(
    `Unsafe column default expression "${trimmed}". Only numeric, boolean/null, simple single-quoted text literals, or standard timestamp defaults are allowed.`
  );
}

/** Validate all identifiers, types, defaults, and foreign-key references within a table definition. */
export function validateTableDef(table: TableDef): void {
  if (!table || typeof table !== 'object' || !Array.isArray(table.columns)) {
    throw new Error('Invalid table definition.');
  }
  validateIdentifier(table.name);
  for (const col of table.columns) {
    if (!col || typeof col !== 'object') {
      throw new Error('Invalid column definition.');
    }
    validateIdentifier(col.name);
    if (!Object.prototype.hasOwnProperty.call(COLUMN_SQL_TYPES, col.type)) {
      throw new Error(`Unsupported column type "${String(col.type)}".`);
    }
    if (col.default !== undefined && col.default !== '') {
      validateColumnDefault(col.default);
    }
    if (col.references) {
      validateIdentifier(col.references.table);
      validateIdentifier(col.references.column);
    }
  }
}

// Map app column types to SQL column types. The SQLite engine and the Firestore
// translator both read this SQLite dialect.
const COLUMN_SQL_TYPES: Record<ColumnType, string> = {
  text: 'TEXT',
  numeric: 'REAL',
  integer: 'INTEGER',
  boolean: 'INTEGER', // SQLite has no boolean — store as 0/1
  date: 'TEXT',
  timestamptz: 'TEXT',
};

/** Business tables live as `<schema>_<table>` (no schema namespaces). */
function businessTableName(schema: string, tableName: string): string {
  validateIdentifier(schema);
  validateIdentifier(tableName);
  return `${schema}_${tableName}`;
}

/** Build a CREATE TABLE SQL string. */
export function buildCreateTableSql(table: TableDef, schema: string): string {
  validateIdentifier(schema);
  validateTableDef(table);

  const cols = [
    `id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))`,
    ...table.columns.map(buildColumnSql),
    `created_at TEXT DEFAULT (datetime('now'))`,
  ];

  return `CREATE TABLE IF NOT EXISTS ${businessTableName(schema, table.name)} (\n  ${cols.join(',\n  ')}\n);`;
}

function buildColumnSql(col: ColumnDef): string {
  validateIdentifier(col.name);
  if (!Object.prototype.hasOwnProperty.call(COLUMN_SQL_TYPES, col.type)) {
    throw new Error(`Unsupported column type "${String(col.type)}".`);
  }
  const parts: string[] = [`${col.name} ${COLUMN_SQL_TYPES[col.type]}`];
  if (!col.nullable) parts.push('NOT NULL');
  if (col.unique) parts.push('UNIQUE');
  if (col.default !== undefined && col.default !== '') {
    validateColumnDefault(col.default);
    parts.push(`DEFAULT ${col.default.trim()}`);
  }
  if (col.references) {
    validateIdentifier(col.references.table);
    validateIdentifier(col.references.column);
    parts.push(`REFERENCES ${col.references.table}(${col.references.column})`);
  }
  return parts.join(' ');
}

/** Build DROP TABLE SQL. */
export function buildDropTableSql(tableName: string, schema: string): string {
  return `DROP TABLE IF EXISTS ${businessTableName(schema, tableName)};`;
}

/** Build ALTER TABLE ADD COLUMN SQL. */
export function buildAddColumnSql(tableName: string, col: ColumnDef, schema: string): string {
  const tbl = businessTableName(schema, tableName);
  validateIdentifier(col.name);
  return `ALTER TABLE ${tbl} ADD COLUMN ${buildColumnSql(col)};`;
}

// ── Normalization Analysis ───────────────────────────────────────────────────

export interface NormalizationHint {
  severity: 'warning' | 'suggestion';
  message: string;
  action?: string;
}

const MIXED_CONCERN_PATTERNS = [
  { re: /_(name|title)$/, group: 'name-like' },
  { re: /_(price|cost|amount|fee)$/, group: 'monetary' },
  { re: /_(address|city|country|zip|postal)$/, group: 'address' },
  { re: /_(email|phone|contact)$/, group: 'contact' },
];

/** Analyze a table for normalization issues and return hints. */
export function analyzeNormalization(table: TableDef): NormalizationHint[] {
  const hints: NormalizationHint[] = [];
  const groups: Record<string, string[]> = {};

  for (const col of table.columns) {
    for (const pattern of MIXED_CONCERN_PATTERNS) {
      if (pattern.re.test(col.name)) {
        groups[pattern.group] = groups[pattern.group] ?? [];
        groups[pattern.group].push(col.name);
      }
    }
  }

  // Multiple address-like fields suggest a separate address table
  if ((groups['address']?.length ?? 0) > 1) {
    hints.push({
      severity: 'suggestion',
      message: `Found ${groups['address']!.length} address-related columns. Consider extracting them into a separate "addresses" table.`,
      action: 'split-table',
    });
  }

  // Multiple contact fields suggest a contacts or profile table
  if ((groups['contact']?.length ?? 0) > 1) {
    hints.push({
      severity: 'suggestion',
      message: `Found multiple contact columns (${groups['contact']!.join(', ')}). Consider a dedicated contacts table.`,
      action: 'split-table',
    });
  }

  // 3.5NF (Boyce-Codd / 3NF+) checks
  // 1. Check for functional dependencies that might not rely on the primary key (transitive dependencies)
  // Simple heuristic: if we have "department_id" AND "department_name", department_name should be in a separate table.
  const idColumns = table.columns.filter(c => c.name.endsWith('_id') && c.name !== 'id');
  for (const idCol of idColumns) {
    const prefix = idCol.name.slice(0, -3); // e.g., 'department'
    const relatedCols = table.columns.filter(c => c.name.startsWith(prefix + '_') && c.name !== idCol.name);
    if (relatedCols.length > 0) {
      hints.push({
        severity: 'warning',
        message: `Possible 3.5NF violation (Transitive Dependency): Columns like "${relatedCols.map(c => c.name).join(', ')}" seem to depend on "${idCol.name}" rather than the primary key. Extract them to a separate "${prefix}s" table.`,
        action: 'normalize-3.5nf',
      });
    }
  }

  // 2. Check for repeating groups (1NF/2NF)
  const repeatingGroups = new Map<string, number>();
  for (const col of table.columns) {
    const match = col.name.match(/^([a-z_]+)_([0-9]+)$/);
    if (match) {
      const base = match[1];
      repeatingGroups.set(base, (repeatingGroups.get(base) ?? 0) + 1);
    }
  }
  for (const [base, count] of repeatingGroups) {
    if (count > 1) {
      hints.push({
        severity: 'warning',
        message: `Possible 1NF violation: Found repeating columns like "${base}_1", "${base}_2". Consider extracting into a one-to-many relationship.`,
        action: 'normalize-1nf',
      });
    }
  }

  // Warn if there are too many columns — usually a sign of poor normalization
  if (table.columns.length > 15) {
    hints.push({
      severity: 'warning',
      message: `Table "${table.name}" has ${table.columns.length} columns. Consider splitting into related tables to reduce redundancy.`,
    });
  }

  return hints;
}
