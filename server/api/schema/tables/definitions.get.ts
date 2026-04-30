import { defineEventHandler, getQuery } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import type { TableDef, ColumnDef } from '~/lib/schemaUtils';

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

  const isDevMode = process.env.DEV_MODE === 'true';
  const definitions: TableDef[] = [];

  if (isDevMode) {
    const { data: tablesData } = await db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ORDER BY name`,
      [`${business.schema_name}_%`],
    );

    for (const row of tablesData ?? []) {
      const realName = row.name.replace(`${business.schema_name}_`, '');
      const { data: colData } = await db.query<any>(`PRAGMA table_info("${row.name}")`);
      
      const columns: ColumnDef[] = (colData ?? []).map((c: any) => {
        let type = 'text';
        if (c.type === 'INTEGER') type = 'integer';
        else if (c.type === 'REAL') type = 'numeric';
        
        // guess references based on name convention (e.g., user_id -> users.id)
        let references;
        if (c.name.endsWith('_id') && c.name !== 'id') {
          const refTable = c.name.replace('_id', 's'); // simple pluralization
          references = { table: refTable, column: 'id' };
        }

        return {
          name: c.name,
          type: type as any,
          nullable: c.notnull === 0,
          references
        };
      });

      definitions.push({ name: realName, columns });
    }
  } else {
    // Postgres logic
    const { data: tablesData } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [business.schema_name],
    );

    for (const row of tablesData ?? []) {
      const { data: colData } = await db.query<{ column_name: string, data_type: string, is_nullable: string }>(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
        [business.schema_name, row.table_name],
      );

      const columns: ColumnDef[] = (colData ?? []).map(c => {
        let references;
        if (c.column_name.endsWith('_id') && c.column_name !== 'id') {
          const refTable = c.column_name.replace('_id', 's');
          references = { table: refTable, column: 'id' };
        }

        return {
          name: c.column_name,
          type: c.data_type as any, // good enough mapping
          nullable: c.is_nullable === 'YES',
          references
        };
      });

      definitions.push({ name: row.table_name, columns });
    }
  }

  return { tables: definitions, error: null };
});
