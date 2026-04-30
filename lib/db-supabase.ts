/**
 * Supabase adapter for production.
 * Uses the service-role key server-side only — never exposed to the client.
 */

import { createClient } from '@supabase/supabase-js';
import type { DbAdapter, QueryResult, SingleResult } from './db';

function getClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;

  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');

  // Service role bypasses RLS — used exclusively in server routes
  return createClient(url, key, { auth: { persistSession: false } });
}

export class SupabaseAdapter implements DbAdapter {
  private client = getClient();

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    // Supabase PostgREST doesn't support raw SQL via the JS client —
    // use the rpc() gateway for raw queries in production
    const { data, error } = await this.client.rpc('execute_query', { sql, params });
    return { data: data as T[] | null, error: error?.message ?? null };
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<SingleResult<T>> {
    const result = await this.query<T>(sql, params);
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async insert<T>(table: string, values: Record<string, unknown>, schema = 'public'): Promise<SingleResult<T>> {
    const { data, error } = await this.client
      .schema(schema)
      .from(table)
      .insert(values)
      .select()
      .single();

    return { data: data as T | null, error: error?.message ?? null };
  }

  async update(table: string, values: Record<string, unknown>, where: Record<string, unknown>, schema = 'public'): Promise<{ error: string | null }> {
    let query = this.client.schema(schema).from(table).update(values);

    // Apply each where condition as an eq filter
    for (const [col, val] of Object.entries(where)) {
      query = (query as any).eq(col, val);
    }

    const { error } = await query;
    return { error: error?.message ?? null };
  }

  async delete(table: string, where: Record<string, unknown>, schema = 'public'): Promise<{ error: string | null }> {
    let query = this.client.schema(schema).from(table).delete();

    for (const [col, val] of Object.entries(where)) {
      query = (query as any).eq(col, val);
    }

    const { error } = await query;
    return { error: error?.message ?? null };
  }

  async execute(sql: string): Promise<{ error: string | null }> {
    const { error } = await this.client.rpc('execute_ddl', { sql });
    return { error: error?.message ?? null };
  }
}
