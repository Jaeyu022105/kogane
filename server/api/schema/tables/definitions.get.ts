import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import type { TableDef, ColumnDef } from '~/lib/schemaUtils';
import { listBusinessTables, qualifyBusinessTable } from '~/server/utils/business';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const { businessId } = getQuery(event) as { businessId: string };

  if (!businessId) {
    return { error: 'Missing businessId', tables: null };
  }

  const { data: business, error } = await db.queryOne<{ schema_name: string; admin_user_id: string }>(
    'SELECT schema_name, admin_user_id FROM businesses WHERE id = ?',
    [businessId],
  );

  if (error || !business) return { error: 'Business not found', tables: null };
  if (business.admin_user_id !== userId) return { error: 'Forbidden', tables: null };

  const definitions: TableDef[] = [];
  const { data: tableNames } = await listBusinessTables(business.schema_name);

  for (const tableName of tableNames ?? []) {
    const physicalName = qualifyBusinessTable(business.schema_name, tableName);
    const { data: colData } = await db.query<{ name: string; type: string; notnull: number }>(
      `PRAGMA table_info("${physicalName}")`,
    );

    const columns: ColumnDef[] = (colData ?? []).map((c) => {
      let type: ColumnDef['type'] = 'text';
      if (c.type === 'INTEGER') type = 'integer';
      else if (c.type === 'REAL') type = 'numeric';

      // guess references based on name convention (e.g., user_id -> users.id)
      let references: ColumnDef['references'];
      if (c.name.endsWith('_id') && c.name !== 'id') {
        const refTable = c.name.replace('_id', 's'); // simple pluralization
        references = { table: refTable, column: 'id' };
      }

      return {
        name: c.name,
        type,
        nullable: c.notnull === 0,
        references,
      };
    });

    definitions.push({ name: tableName, columns });
  }

  return { tables: definitions, error: null };
});
