/**
 * useAuth — manages admin authentication state.
 * Manages admin session, local storage persistence, and API authorization headers.
 */

import { ref, computed } from 'vue';

export interface AdminSession {
  userId: string;
  email: string;
  token: string;
  sessionId?: string;
  fullName?: string;
  username?: string;
  profilePicture?: string;
  has2fa?: boolean;
  languagePreference?: string;
  isEnterprise?: boolean;
}

const session = ref<AdminSession | null>(null);
const isHydrated = ref(false);
let hydrationPromise: Promise<AdminSession | null> | null = null;

export function useAuth() {
  const isLoggedIn = computed(() => session.value !== null);

  function setSession(newSession: AdminSession) {
    session.value = newSession;
    isHydrated.value = true;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('kogane-session', JSON.stringify(newSession));
        localStorage.setItem('dev-session', JSON.stringify(newSession));
      } catch { /* ignore storage errors */ }
    }
  }

  function clearLocalSession() {
    session.value = null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('kogane-session');
        localStorage.removeItem('dev-session');
      } catch { /* ignore storage errors */ }
    }
  }

  function devLogin(email: string, extra?: Partial<AdminSession>) {
    const existing = session.value;
    const newSession: AdminSession = {
      userId: extra?.userId ?? existing?.userId ?? 'dev-admin',
      email,
      token: extra?.token ?? existing?.token ?? 'dev-admin-token',
      sessionId: extra?.sessionId ?? existing?.sessionId,
      fullName: extra?.fullName ?? existing?.fullName,
      username: extra?.username ?? existing?.username,
      profilePicture: extra?.profilePicture ?? existing?.profilePicture,
      has2fa: extra?.has2fa ?? existing?.has2fa,
      languagePreference: extra?.languagePreference ?? existing?.languagePreference,
      ...extra,
    };
    setSession(newSession);
  }

  function loadDevSession() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('kogane-session') || localStorage.getItem('dev-session');
      if (raw) {
        const parsed = JSON.parse(raw) as AdminSession;
        if (parsed && parsed.userId && parsed.email) {
          session.value = parsed;
        }
      }
    } catch { /* ignore parse errors */ }
  }

  /**
   * Synchronizes client auth state with the authoritative stateful server session
   * (via HttpOnly cookie and/or stored Bearer token). Clears stale local sessions on 401.
   */
  async function hydrateSession(force = false): Promise<AdminSession | null> {
    if (typeof window === 'undefined') return session.value;
    if (!session.value) {
      loadDevSession();
    }
    if (isHydrated.value && !force) {
      return session.value;
    }
    if (hydrationPromise && !force) {
      return hydrationPromise;
    }

    hydrationPromise = (async () => {
      try {
        const headers: Record<string, string> = {};
        if (session.value?.token && session.value.token !== 'cookie-session') {
          headers.Authorization = `Bearer ${session.value.token}`;
        }

        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          headers,
        });

        if (res.status === 401 || res.status === 403) {
          clearLocalSession();
          isHydrated.value = true;
          return null;
        }

        if (!res.ok) {
          isHydrated.value = true;
          return session.value;
        }

        const data = (await res.json()) as {
          user?: {
            id?: string;
            userId?: string;
            email: string;
            fullName?: string;
            username?: string;
            profilePhotoUrl?: string;
            profilePicture?: string;
            has2fa?: boolean;
            languagePreference?: string;
            sessionId?: string | null;
          } | null;
        };

        const resolvedUserId = data?.user?.userId || data?.user?.id;
        if (data?.user && resolvedUserId) {
          const merged: AdminSession = {
            userId: resolvedUserId,
            email: data.user.email,
            token: session.value?.token || 'cookie-session',
            sessionId: data.user.sessionId ?? session.value?.sessionId,
            fullName: data.user.fullName,
            username: data.user.username,
            profilePicture: data.user.profilePicture ?? data.user.profilePhotoUrl,
            has2fa: data.user.has2fa,
            languagePreference: data.user.languagePreference,
            isEnterprise: session.value?.isEnterprise,
          };
          setSession(merged);
          return merged;
        }
        clearLocalSession();
        isHydrated.value = true;
        return null;
      } catch {
        isHydrated.value = true;
        return session.value;
      } finally {
        hydrationPromise = null;
      }
    })();

    return hydrationPromise;
  }

  async function logout(notifyServer = true): Promise<void> {
    const token = session.value?.token;
    clearLocalSession();
    isHydrated.value = true;

    if (notifyServer && typeof fetch !== 'undefined') {
      try {
        const headers: Record<string, string> = {};
        if (token && token !== 'cookie-session') {
          headers.Authorization = `Bearer ${token}`;
        }
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers,
        });
      } catch {
        // Ignore network errors during logout cleanup
      }
    }
  }

  // ── Auth header helper used by all API calls ──────────────────────────────
  function authHeaders(): Record<string, string> {
    if (!session.value?.token || session.value.token === 'cookie-session') return {};
    return { Authorization: `Bearer ${session.value.token}` };
  }

  return {
    session: computed(() => session.value),
    isLoggedIn,
    isHydrated: computed(() => isHydrated.value),
    setSession,
    clearLocalSession,
    devLogin,
    loadDevSession,
    loadSession: loadDevSession,
    hydrateSession,
    logout,
    authHeaders,
  };
}
