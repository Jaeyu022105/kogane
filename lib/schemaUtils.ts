/**
 * Schema utilities — identifier validation, SQL generation, normalization hints.
 * All DDL generation flows through here to ensure safety and consistency.
 */

export type ColumnType = 'text' | 'numeric' | 'integer' | 'boolean' | 'date' | 'timestamptz';

export interface ColumnDef {
  name:       string;
  type:       ColumnType;
  nullable:   boolean;
  unique?:    boolean;
  default?:   string;
  references?: { table: string; column: string };
}

export interface TableDef {
  name:    string;
  columns: ColumnDef[];
}

export interface SchemaDef {
  tables: TableDef[];
}

// Allowed characters for table/column identifiers — prevent SQL injection
const IDENTIFIER_RE = /^[a-z][a-z0-9_]{0,62}$/;

/** Validate identifier to prevent SQL injection. */
export function validateIdentifier(name: string): void {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(
      `Invalid identifier "${name}". Only lowercase letters, digits, and underscores are allowed (must start with a letter).`
    );
  }
}

/** Validate all identifiers within a table definition. */
export function validateTableDef(table: TableDef): void {
  validateIdentifier(table.name);
  for (const col of table.columns) {
    validateIdentifier(col.name);
  }
}

// Map app column types to Postgres/SQLite column types
const TYPE_MAP_PG: Record<ColumnType, string> = {
  text:        'text',
  numeric:     'numeric',
  integer:     'integer',
  boolean:     'boolean',
  date:        'date',
  timestamptz: 'timestamptz',
};

const TYPE_MAP_SQLITE: Record<ColumnType, string> = {
  text:        'TEXT',
  numeric:     'REAL',
  integer:     'INTEGER',
  boolean:     'INTEGER', // SQLite has no boolean — store as 0/1
  date:        'TEXT',
  timestamptz: 'TEXT',
};

/** Build a CREATE TABLE SQL string for Postgres. */
export function buildCreateTableSql(table: TableDef, schema: string, dialect: 'postgres' | 'sqlite' = 'postgres'): string {
  validateTableDef(table);

  const typeMap = dialect === 'sqlite' ? TYPE_MAP_SQLITE : TYPE_MAP_PG;
  const isSqlite = dialect === 'sqlite';

  // SQLite doesn't support schema namespacing — prefix the table name instead
  const tableName = isSqlite
    ? `${schema}_${table.name}`
    : `"${schema}"."${table.name}"`;

  const primaryKey = isSqlite
    ? `id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))`
    : `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`;

  const cols = [
    primaryKey,
    ...table.columns.map(col => buildColumnSql(col, typeMap)),
    `created_at ${isSqlite ? 'TEXT DEFAULT (datetime(\'now\'))' : 'timestamptz DEFAULT now()'}`,
  ];

  return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${cols.join(',\n  ')}\n);`;
}

function buildColumnSql(col: ColumnDef, typeMap: Record<ColumnType, string>): string {
  const parts: string[] = [`${col.name} ${typeMap[col.type]}`];
  if (!col.nullable) parts.push('NOT NULL');
  if (col.unique)    parts.push('UNIQUE');
  if (col.default !== undefined) parts.push(`DEFAULT ${col.default}`);
  if (col.references) {
    parts.push(`REFERENCES ${col.references.table}(${col.references.column})`);
  }
  return parts.join(' ');
}

/** Build DROP TABLE SQL. */
export function buildDropTableSql(tableName: string, schema: string, dialect: 'postgres' | 'sqlite' = 'postgres'): string {
  validateIdentifier(tableName);
  const tbl = dialect === 'sqlite'
    ? `${schema}_${tableName}`
    : `"${schema}"."${tableName}"`;
  return `DROP TABLE IF EXISTS ${tbl};`;
}

/** Build ALTER TABLE ADD COLUMN SQL. */
export function buildAddColumnSql(tableName: string, col: ColumnDef, schema: string, dialect: 'postgres' | 'sqlite' = 'postgres'): string {
  validateIdentifier(tableName);
  validateIdentifier(col.name);

  const typeMap = dialect === 'sqlite' ? TYPE_MAP_SQLITE : TYPE_MAP_PG;
  const tbl = dialect === 'sqlite'
    ? `${schema}_${tableName}`
    : `"${schema}"."${tableName}"`;

  return `ALTER TABLE ${tbl} ADD COLUMN ${buildColumnSql(col, typeMap)};`;
}

// ── Normalization Analysis ───────────────────────────────────────────────────

export interface NormalizationHint {
  severity: 'warning' | 'suggestion';
  message:  string;
  action?:  string;
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
      message:  `Found ${groups['address']!.length} address-related columns. Consider extracting them into a separate "addresses" table.`,
      action:   'split-table',
    });
  }

  // Multiple contact fields suggest a contacts or profile table
  if ((groups['contact']?.length ?? 0) > 1) {
    hints.push({
      severity: 'suggestion',
      message:  `Found multiple contact columns (${groups['contact']!.join(', ')}). Consider a dedicated contacts table.`,
      action:   'split-table',
    });
  }

  // Warn if there are too many columns — usually a sign of poor normalization
  if (table.columns.length > 15) {
    hints.push({
      severity: 'warning',
      message:  `Table "${table.name}" has ${table.columns.length} columns. Consider splitting into related tables to reduce redundancy.`,
    });
  }

  return hints;
}
