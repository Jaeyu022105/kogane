/**
 * Builds links that are safe to share with another device during LAN demos.
 * If NUXT_PUBLIC_SHARE_ORIGIN is set, copied terminal links use that origin
 * instead of localhost.
 */
export function useShareOrigin() {
  const config = useRuntimeConfig();

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
      // If client is already connecting via a non-localhost host (LAN IP or domain), that origin is proven to work!
      if (loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1') {
        return loc.origin;
      }
    }

    const configured = configuredOrigin();
    if (configured) return configured;

    if (import.meta.client) {
      const loc = window.location;
      // If viewed on localhost, fallback to default LAN IP so copied links work when opened on phones/tablets
      return `${loc.protocol}//192.168.1.16:${loc.port || '3000'}`;
    }

    return 'http://192.168.1.16:3000';
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

  return { buildShareUrl, copyToClipboard, resolveOrigin };
}
