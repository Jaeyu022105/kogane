/**
 * Builds links that are safe to share with staff devices (cloud HTTPS domain in
 * online hosting, or NUXT_PUBLIC_SHARE_ORIGIN / active origin in local setups).
 */
export function useShareOrigin() {
  const config = useRuntimeConfig();

  function isLocalHostname(hostname: string): boolean {
    const h = hostname.toLowerCase();
    return (
      h === 'localhost'
      || h === '127.0.0.1'
      || h.startsWith('192.168.')
      || h.startsWith('10.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    );
  }

  const isOnlineHost = computed(() => {
    const provider = String(config.public.dbProvider || '').trim().toLowerCase();
    if (provider === 'firebase' || provider === 'supabase') return true;
    if (import.meta.client) {
      if (window.location.protocol === 'https:') return true;
      return !isLocalHostname(window.location.hostname);
    }
    return config.public.devMode !== true;
  });

  function currentOrigin() {
    if (!import.meta.client) return '';
    return window.location.origin;
  }

  function configuredOrigin() {
    const raw = String(config.public.shareOrigin || '').trim();
    if (!raw) return '';
    if (!/^https?:\/\//i.test(raw)) return '';
    return raw.replace(/\/+$/, '');
  }

  function resolveOrigin() {
    if (import.meta.client) {
      const loc = window.location;
      // If client is already connecting via a non-localhost host (domain or LAN IP), that origin works directly
      if (loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1') {
        return loc.origin;
      }
    }

    const configured = configuredOrigin();
    if (configured) return configured;

    if (import.meta.client) {
      return window.location.origin;
    }

    return '';
  }

  function buildShareUrl(path: string) {
    const origin = resolveOrigin();
    if (!origin) return '';
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    try {
      return new URL(cleanPath, origin).toString();
    } catch {
      return `${origin}${cleanPath}`;
    }
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    if (!import.meta.client || !text) return false;

    // First try modern clipboard API if supported and in secure context or localhost
    if (navigator?.clipboard?.writeText && (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall back below
      }
    }

    // Fallback for HTTP non-secure contexts (e.g. LAN client devices connecting over Wi-Fi/Ethernet)
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      el.setSelectionRange(0, text.length);
      const successful = document.execCommand('copy');
      document.body.removeChild(el);
      return successful;
    } catch {
      return false;
    }
  }

  return { buildShareUrl, copyToClipboard, resolveOrigin, isOnlineHost };
}
