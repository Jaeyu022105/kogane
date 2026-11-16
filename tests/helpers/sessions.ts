/**
 * Test helpers that mint signed admin / terminal tokens AND record the matching session row,
 * the way the login routes do. The server rejects tokens that have no live session behind them.
 */

import { randomUUID } from 'node:crypto';
import {
  createAdminSessionToken,
  createTerminalSessionToken,
  type TerminalSessionPayload,
} from '../../lib/authUtils';
import { db } from '../../lib/db';
import { hashTokenSha256 } from '../../lib/security';

type AdminTokenInput = Parameters<typeof createAdminSessionToken>[0];
type TerminalTokenInput = Omit<TerminalSessionPayload, 'expiresAt'> & { expiresAt?: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createTestAdminToken(payload: AdminTokenInput): Promise<string> {
  const sid = payload.sid ?? `sess_test_${randomUUID().replace(/-/g, '')}`;
  const expiresAt = payload.expiresAt ?? new Date(Date.now() + DAY_MS).toISOString();
  const token = await createAdminSessionToken({ ...payload, sid, expiresAt });
  const nowIso = new Date().toISOString();

  await db.insert('sessions', {
    id: sid,
    session_type: 'admin',
    token_hash: hashTokenSha256(token),
    user_id: payload.userId,
    terminal_id: null,
    business_id: null,
    two_factor_verified: payload.twoFactorPending ? 0 : 1,
    ip_address: '127.0.0.1',
    user_agent: 'bun-test',
    last_active_at: nowIso,
    expires_at: expiresAt,
    revoked_at: null,
    created_at: nowIso,
  });

  return token;
}

export async function createTestTerminalToken(payload: TerminalTokenInput): Promise<string> {
  const sid = payload.sid ?? `tsess_test_${randomUUID().replace(/-/g, '')}`;
  const expiresAt = payload.expiresAt ?? new Date(Date.now() + DAY_MS).toISOString();
  const token = await createTerminalSessionToken({ ...payload, sid, expiresAt });
  const nowIso = new Date().toISOString();

  await db.insert('sessions', {
    id: sid,
    session_type: 'terminal',
    token_hash: hashTokenSha256(token),
    user_id: null,
    terminal_id: payload.terminalId,
    business_id: payload.businessId,
    two_factor_verified: 1,
    ip_address: '127.0.0.1',
    user_agent: 'bun-test',
    last_active_at: nowIso,
    expires_at: expiresAt,
    revoked_at: null,
    created_at: nowIso,
  });

  return token;
}
