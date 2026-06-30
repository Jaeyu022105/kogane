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

  function buildShareUrl(path: string) {
    const origin = configuredOrigin() || currentOrigin();
    if (!origin) return '';
    return new URL(path, origin).toString();
  }

  return { buildShareUrl };
}
