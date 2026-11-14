import { defineEventHandler, getRequestURL, setResponseHeader, type H3Event } from 'h3';

const NOINDEX_PREFIXES = ['/dashboard', '/api', '/terminal', '/t', '/signup', '/login'];
const PRODUCTION_FALLBACK_ORIGIN = 'https://kogane.app';

export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost'
    || h === '127.0.0.1'
    || h === '::1'
    || h === '[::1]'
    || h === '0.0.0.0'
    || h.endsWith('.local')
    || /^192\.168\./.test(h)
    || /^10\./.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

export function normalizeServerOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return '';
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname || parsed.hostname === '0.0.0.0') return '';
    if (!isLocalHostname(parsed.hostname) && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

export function resolveServerSiteOrigin(event: H3Event): string {
  const runtimePublic = typeof useRuntimeConfig === 'function' ? useRuntimeConfig(event)?.public : undefined;
  const siteUrl = normalizeServerOrigin(
    String(runtimePublic?.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || process.env.SITE_URL || ''),
  );
  if (siteUrl) return siteUrl;

  const shareOrigin = normalizeServerOrigin(
    String(runtimePublic?.shareOrigin || process.env.NUXT_PUBLIC_SHARE_ORIGIN || ''),
  );
  if (shareOrigin) {
    try {
      if (!isLocalHostname(new URL(shareOrigin).hostname)) {
        return shareOrigin;
      }
    } catch {
      // Ignore malformed share origin
    }
  }

  const isDev = Boolean((import.meta as { dev?: boolean }).dev || process.env.NODE_ENV === 'development');
  try {
    const reqUrl = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });
    const reqOrigin = normalizeServerOrigin(reqUrl.origin);
    if (reqOrigin && (!isLocalHostname(new URL(reqOrigin).hostname) || isDev)) {
      return reqOrigin;
    }
  } catch {
    // Ignore missing request URL
  }

  if (isDev && shareOrigin) return shareOrigin;
  return PRODUCTION_FALLBACK_ORIGIN;
}

export function isNoindexPath(rawPath: string): boolean {
  const pathname = (rawPath.split('?')[0] || '/').replace(/\/{2,}/g, '/').toLowerCase();
  return NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default defineEventHandler((event) => {
  const reqPath = event.path || event.node?.req?.url || '/';
  if (isNoindexPath(reqPath)) {
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
  }
});
