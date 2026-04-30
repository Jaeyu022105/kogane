/**
 * useSchema — manages table listing and creation for the database editor.
 * Wraps the schema API routes with reactive state.
 */

import type { TableDef, ColumnDef, NormalizationHint } from '~/lib/schemaUtils';

export interface SchemaTable {
  name: string;
}

export function useSchema(businessId: Ref<string | undefined>) {
  const { authHeaders } = useAuth();

  const tables  = ref<string[]>([]);
  const loading = ref(false);
  const error   = ref<string | null>(null);

  async function fetchTables() {
    const id = businessId.value;
    if (!id) return;

    loading.value = true;
    error.value   = null;

    try {
      const res = await $fetch<{ tables: string[]; error: string | null }>('/api/schema/tables', {
        headers: authHeaders(),
        query:   { businessId: id },
      });
      tables.value = res.tables ?? [];
      error.value  = res.error;
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function createTable(def: TableDef): Promise<string | null> {
    const id = businessId.value;
    if (!id) return 'No business selected';

    const res = await $fetch<{ success: boolean; error: string | null }>('/api/schema/tables/create', {
      method:  'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body:    { businessId: id, table: def },
    });

    if (!res.error) await fetchTables();

    return res.error;
  }

  async function dropTable(tableName: string): Promise<string | null> {
    const id = businessId.value;
    if (!id) return 'No business selected';

    const res = await $fetch<{ success: boolean; error: string | null }>('/api/schema/tables/delete', {
      method:  'DELETE',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body:    { businessId: id, tableName, confirm: true },
    });

    if (!res.error) await fetchTables();

    return res.error;
  }

  async function analyzeTable(def: TableDef): Promise<NormalizationHint[]> {
    const res = await $fetch<{ hints: NormalizationHint[]; error: string | null }>(
      '/api/schema/tables/analyze',
      { method: 'POST', body: { table: def } },
    );
    return res.hints ?? [];
  }

  async function addColumns(tableName: string, columns: ColumnDef[]): Promise<string | null> {
    const id = businessId.value;
    if (!id) return 'No business selected';

    const res = await $fetch<{ success: boolean; error: string | null }>('/api/schema/tables/update', {
      method:  'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body:    { businessId: id, tableName, addColumns: columns },
    });

    return res.error;
  }

  async function fetchTableRows(tableName: string, page = 1, limit = 50): Promise<{
    columns: { name: string; type: string }[];
    rows:    Record<string, unknown>[];
    total:   number;
    error:   string | null;
  }> {
    const id = businessId.value;
    if (!id) return { columns: [], rows: [], total: 0, error: 'No business selected' };

    const res = await $fetch<{
      columns: { name: string; type: string }[];
      rows:    Record<string, unknown>[];
      total:   number;
      error:   string | null;
    }>('/api/schema/tables/rows', {
      headers: authHeaders(),
      query:   { businessId: id, tableName, page, limit },
    });

    return res;
  }

  return {
    tables,
    loading,
    error,
    fetchTables,
    createTable,
    dropTable,
    analyzeTable,
    addColumns,
    fetchTableRows,
  };
}
