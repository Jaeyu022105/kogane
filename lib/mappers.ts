/**
 * Centralized DTO & schema mapping helpers.
 * Guarantees sensitive database fields (password_hash, pin_hash, two_factor_secret,
 * two_factor_backup_codes, token_hash) are never serialized to client responses,
 * and normalizes data shapes across SQLite, Firestore, and Postgres adapters.
 */

import { findCountry } from './currency';
import { normalizePermissions, type TerminalPermissions } from './permissions';
import { normalizeLayout, type UiLayout } from './uiTypes';

export interface UserProfileDto {
  id: string;
  email: string;
  fullName: string;
  username: string;
  profilePhotoUrl?: string;
  languagePreference: string;
  has2fa: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionSummaryDto {
  id: string;
  sessionType: 'admin' | 'terminal';
  terminalId: string | null;
  businessId: string | null;
  twoFactorVerified: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  deviceLabel: string;
  lastActiveAt: string | null;
  expiresAt: string;
  createdAt: string | null;
  isCurrent: boolean;
}

export interface TerminalDto {
  id: string;
  business_id: string;
  display_name: string;
  role: string;
  pin_length: number;
  pin_code?: string | null;
  permissions: TerminalPermissions;
  ui_layout: UiLayout;
  is_public: boolean;
  public_slug: string | null;
  created_at: string;
}

export interface BusinessDto {
  id: string;
  admin_user_id: string;
  name: string;
  logo_url: string | null;
  color_palette: Record<string, unknown>;
  country: string;
  currency: string;
  currency_symbol: string;
  schema_name: string;
  created_at: string;
}

export function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase();
}

export function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseUserAgentSummary(userAgent?: string | null): string {
  const ua = String(userAgent ?? '').trim();
  if (!ua) return 'Unknown device';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Bun\//i.test(ua)) browser = 'Bun client';
  else if (/curl/i.test(ua)) browser = 'cURL';

  let os = '';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}

/** Strips password_hash, 2FA secrets, and backup codes from user records. */
export function mapUserRecordToDto(row: Record<string, unknown>): UserProfileDto {
  const userId = String(row.id ?? '');
  return {
    id: userId,
    email: normalizeEmail(String(row.email ?? '')),
    fullName: String(row.full_name ?? '') || (userId === 'dev-admin' ? 'Restaurant Manager' : 'Admin User'),
    username: String(row.username ?? '') || 'admin',
    profilePhotoUrl: row.profile_photo_url ? String(row.profile_photo_url) : undefined,
    languagePreference: String(row.language_preference || 'en'),
    has2fa: Boolean(row.two_factor_enabled === 1 || row.two_factor_enabled === true),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

/** Strips token_hash from stateful session rows before returning to clients. */
export function mapSessionRecordToDto(
  row: Record<string, unknown>,
  currentSessionId?: string | null,
): SessionSummaryDto {
  const id = String(row.id ?? '');
  const ua = row.user_agent ? String(row.user_agent) : null;
  return {
    id,
    sessionType: row.session_type === 'terminal' ? 'terminal' : 'admin',
    terminalId: row.terminal_id ? String(row.terminal_id) : null,
    businessId: row.business_id ? String(row.business_id) : null,
    twoFactorVerified: row.two_factor_verified === 1 || row.two_factor_verified === true,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: ua,
    deviceLabel: parseUserAgentSummary(ua),
    lastActiveAt: row.last_active_at ? String(row.last_active_at) : null,
    expiresAt: String(row.expires_at ?? ''),
    createdAt: row.created_at ? String(row.created_at) : null,
    isCurrent: Boolean(currentSessionId && id === currentSessionId),
  };
}

/** Strips pin_hash and optionally pin_code from terminal records. */
export function mapTerminalRecordToDto(
  row: Record<string, unknown>,
  options: { includePin?: boolean } = {},
): TerminalDto {
  const role = String(row.role ?? 'staff');
  const parsedLayout = parseJsonSafe<Record<string, unknown> | null>(row.ui_layout, null);
  const dto: TerminalDto = {
    id: String(row.id ?? ''),
    business_id: String(row.business_id ?? ''),
    display_name: String(row.display_name ?? ''),
    role,
    pin_length: Number(row.pin_length ?? 4),
    permissions: normalizePermissions(row.permissions as string | null, role),
    ui_layout: normalizeLayout(parsedLayout as any),
    is_public: Boolean(row.is_public === 1 || row.is_public === true),
    public_slug: row.public_slug ? String(row.public_slug) : null,
    created_at: String(row.created_at ?? ''),
  };

  if (options.includePin) {
    dto.pin_code = row.pin_code != null ? String(row.pin_code) : null;
  }

  return dto;
}

/** Normalizes business rows and resolves country/currency fallbacks. */
export function mapBusinessRecordToDto(row: Record<string, unknown>): BusinessDto {
  const palette = parseJsonSafe<Record<string, unknown>>(row.color_palette, {});
  const resolved = findCountry(
    String(row.country || palette.country || 'US'),
  );

  return {
    id: String(row.id ?? ''),
    admin_user_id: String(row.admin_user_id ?? ''),
    name: String(row.name ?? ''),
    logo_url: row.logo_url ? String(row.logo_url) : null,
    color_palette: palette,
    country: String(row.country || palette.country || resolved.code),
    currency: String(row.currency || palette.currency || resolved.currency),
    currency_symbol: String(row.currency_symbol || palette.currencySymbol || resolved.symbol),
    schema_name: String(row.schema_name ?? ''),
    created_at: String(row.created_at ?? ''),
  };
}

/** Maps a business table name to a clean Firestore/SQL collection identifier. */
export function mapBusinessCollectionName(schemaName: string, tableName: string): string {
  const cleanSchema = String(schemaName).trim();
  const cleanTable = String(tableName).trim();
  if (cleanTable.startsWith(`${cleanSchema}_`)) {
    return cleanTable;
  }
  return `${cleanSchema}_${cleanTable}`;
}
