-- ==============================================================================
-- Kogane Production Schema & Supabase Setup
-- Run this script in the Supabase SQL Editor when deploying to production.
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Platform Core Tables

-- Businesses / Organizations
CREATE TABLE IF NOT EXISTS public.businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  name          TEXT NOT NULL,
  logo_url      TEXT,
  color_palette TEXT DEFAULT '{}',
  schema_name   TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Terminals / Workstations (Cashier, Kitchen, Inventory, Catalog, Reports)
CREATE TABLE IF NOT EXISTS public.terminals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  auth_user_id  TEXT,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',
  pin_hash      TEXT NOT NULL,
  pin_code      TEXT,
  pin_length    INTEGER NOT NULL DEFAULT 4,
  permissions   TEXT DEFAULT '{}',
  ui_layout     TEXT DEFAULT '{}',
  is_public     INTEGER NOT NULL DEFAULT 0,
  public_slug   TEXT UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Platform Preset Layouts & Templates
CREATE TABLE IF NOT EXISTS public.presets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  schema_definition TEXT DEFAULT '{}',
  ui_layout         TEXT DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Audit Log & Activity Trail
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_id       TEXT,
  actor_type     TEXT NOT NULL,
  actor_name     TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  target_table   TEXT,
  target_id      TEXT,
  payload_before TEXT,
  payload_after  TEXT,
  metadata       TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_terminals_business_id ON public.terminals(business_id);
CREATE INDEX IF NOT EXISTS idx_terminals_public_slug ON public.terminals(public_slug);
CREATE INDEX IF NOT EXISTS idx_audit_log_business_id ON public.audit_log(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- 3. Supabase RPC Gateways (required by lib/db-supabase.ts)

-- RPC to execute query and return rows as JSON
CREATE OR REPLACE FUNCTION public.execute_query(sql text, params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || sql || ') t'
  INTO result;
  RETURN result;
END;
$$;

-- RPC to execute DDL statements (schema creation, table alteration)
CREATE OR REPLACE FUNCTION public.execute_ddl(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 4. Enable Supabase Realtime for live updates (optional enhancement)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.terminals, public.audit_log;
COMMIT;
