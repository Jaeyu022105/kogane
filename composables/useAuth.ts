/**
 * useAuth — manages admin authentication state.
 * In dev mode, uses a mock session backed by localStorage.
 * In production, delegates to Supabase Auth.
 */

import { ref, computed } from 'vue';

export interface AdminSession {
  userId: string;
  email: string;
  token: string;
}

const session = ref<AdminSession | null>(null);

export function useAuth() {
  const isLoggedIn = computed(() => session.value !== null);

  // ── Dev Mode ─────────────────────────────────────────────────────────────
  function devLogin(email: string) {
    session.value = { userId: 'dev-admin', email, token: 'dev-admin-token' };
    localStorage.setItem('dev-session', JSON.stringify(session.value));
  }

  function loadDevSession() {
    try {
      const raw = localStorage.getItem('dev-session');
      if (raw) session.value = JSON.parse(raw);
    } catch { /* ignore parse errors */ }
  }

  function logout() {
    session.value = null;
    localStorage.removeItem('dev-session');
  }

  // ── Auth header helper used by all API calls ──────────────────────────────
  function authHeaders(): Record<string, string> {
    if (!session.value) return {};
    return { Authorization: `Bearer ${session.value.token}` };
  }

  return {
    session: computed(() => session.value),
    isLoggedIn,
    devLogin,
    loadDevSession,
    logout,
    authHeaders,
  };
}
