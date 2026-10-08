/**
 * useAuth — manages admin authentication state.
 * Manages admin session, local storage persistence, and API authorization headers.
 */

import { ref, computed } from 'vue';

export interface AdminSession {
  userId: string;
  email: string;
  token: string;
  fullName?: string;
  username?: string;
  profilePicture?: string;
  has2fa?: boolean;
  languagePreference?: string;
  isEnterprise?: boolean;
}

const session = ref<AdminSession | null>(null);

export function useAuth() {
  const isLoggedIn = computed(() => session.value !== null);

  function setSession(newSession: AdminSession) {
    session.value = newSession;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('kogane-session', JSON.stringify(newSession));
        localStorage.setItem('dev-session', JSON.stringify(newSession));
      } catch { /* ignore storage errors */ }
    }
  }

  function devLogin(email: string, extra?: Partial<AdminSession>) {
    const existing = session.value;
    const newSession: AdminSession = { 
      userId: extra?.userId ?? existing?.userId ?? 'dev-admin', 
      email, 
      token: extra?.token ?? existing?.token ?? 'dev-admin-token',
      fullName: extra?.fullName ?? existing?.fullName,
      username: extra?.username ?? existing?.username,
      profilePicture: extra?.profilePicture ?? existing?.profilePicture,
      languagePreference: extra?.languagePreference ?? existing?.languagePreference,
      ...extra 
    };
    setSession(newSession);
  }

  function loadDevSession() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('kogane-session') || localStorage.getItem('dev-session');
      if (raw) session.value = JSON.parse(raw);
    } catch { /* ignore parse errors */ }
  }

  function logout() {
    session.value = null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('kogane-session');
        localStorage.removeItem('dev-session');
      } catch { /* ignore storage errors */ }
    }
  }

  // ── Auth header helper used by all API calls ──────────────────────────────
  function authHeaders(): Record<string, string> {
    if (!session.value?.token) return {};
    return { Authorization: `Bearer ${session.value.token}` };
  }

  return {
    session: computed(() => session.value),
    isLoggedIn,
    setSession,
    devLogin,
    loadDevSession,
    loadSession: loadDevSession,
    logout,
    authHeaders,
  };
}
