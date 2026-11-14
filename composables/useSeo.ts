import { computed, toValue, type MaybeRefOrGetter } from 'vue';

export interface PageSeoOptions {
  title: string | (() => string);
  description: string | (() => string);
  path: string;
  noindex?: boolean;
  ogType?: 'website' | 'article';
  jsonLd?: MaybeRefOrGetter<Record<string, unknown> | Record<string, unknown>[]>;
}

const PRODUCTION_FALLBACK_ORIGIN = 'https://kogane.app';

const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ph: 'fil_PH',
  es: 'es_ES',
  ja: 'ja_JP',
  ko: 'ko_KR',
  zh: 'zh_CN',
};

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

export function normalizeCanonicalOrigin(raw: string): string {
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

export function normalizeCanonicalPath(rawPath: string): string {
  const trimmed = (rawPath || '/').trim();
  const basePath = trimmed.split('#')[0]?.split('?')[0] || '/';
  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

export function serializeJsonLd(payload: Record<string, unknown>): string {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

export function useSiteOrigin() {
  const config = useRuntimeConfig();
  let requestOriginRaw = '';

  try {
    const reqUrl = useRequestURL({ xForwardedHost: true, xForwardedProto: true });
    requestOriginRaw = reqUrl.origin;
  } catch {
    if (import.meta.client && typeof window !== 'undefined') {
      requestOriginRaw = window.location.origin;
    }
  }

  return computed(() => {
    const configuredSiteUrl = normalizeCanonicalOrigin(String(config.public?.siteUrl || ''));
    if (configuredSiteUrl) return configuredSiteUrl;

    const configuredShareOrigin = normalizeCanonicalOrigin(String(config.public?.shareOrigin || ''));
    if (configuredShareOrigin) {
      try {
        const parsedShare = new URL(configuredShareOrigin);
        if (!isLocalHostname(parsedShare.hostname)) {
          return configuredShareOrigin;
        }
      } catch {
        // Ignore invalid URL
      }
    }

    const requestOrigin = normalizeCanonicalOrigin(requestOriginRaw);
    if (requestOrigin) {
      try {
        const parsedReq = new URL(requestOrigin);
        if (!isLocalHostname(parsedReq.hostname) || import.meta.dev) {
          return requestOrigin;
        }
      } catch {
        // Ignore invalid URL
      }
    }

    if (import.meta.dev && configuredShareOrigin) {
      return configuredShareOrigin;
    }

    return PRODUCTION_FALLBACK_ORIGIN;
  });
}

export function usePageSeo(options: PageSeoOptions): void {
  const siteOrigin = useSiteOrigin();
  const { locale } = useLocale();
  const normalizedPath = normalizeCanonicalPath(options.path);

  const rawTitle = computed(() => String(toValue(options.title) ?? '').trim());
  const resolvedDescription = computed(() => String(toValue(options.description) ?? '').trim());

  const pageTitle = computed(() => {
    const t = rawTitle.value;
    if (!t) return 'Kogane';
    return t.replace(/\s+[—-]\s+Kogane$/i, '').trim() || t;
  });

  const fullTitle = computed(() => {
    const t = rawTitle.value;
    if (!t) return 'Kogane';
    if (/\bkogane\b/i.test(t)) {
      return t.replace(/\s+-\s+Kogane$/i, ' — Kogane');
    }
    return `${t} — Kogane`;
  });

  const canonicalUrl = computed(() => `${siteOrigin.value}${normalizedPath}`);
  const ogImageUrl = computed(() => `${siteOrigin.value}/og-image.png`);
  const ogLocale = computed(() => OG_LOCALE_MAP[locale.value] || 'en_US');

  useSeoMeta({
    title: () => pageTitle.value,
    description: () => resolvedDescription.value,
    ogTitle: () => fullTitle.value,
    ogDescription: () => resolvedDescription.value,
    ogUrl: () => canonicalUrl.value,
    ogType: options.ogType ?? 'website',
    ogImage: () => ogImageUrl.value,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: () => fullTitle.value,
    ogSiteName: 'Kogane',
    ogLocale: () => ogLocale.value,
    twitterCard: 'summary_large_image',
    twitterTitle: () => fullTitle.value,
    twitterDescription: () => resolvedDescription.value,
    twitterImage: () => ogImageUrl.value,
    twitterImageAlt: () => fullTitle.value,
    robots: () => (options.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'),
  });

  useHead(() => {
    const scripts: Array<{ key: string; type: string; innerHTML: string }> = [];

    if (options.jsonLd !== undefined) {
      const resolvedLd = toValue(options.jsonLd);
      const items = Array.isArray(resolvedLd) ? resolvedLd : [resolvedLd];
      items.forEach((item, index) => {
        if (item && typeof item === 'object') {
          scripts.push({
            key: `ldjson-${normalizedPath}-${index}`,
            type: 'application/ld+json',
            innerHTML: serializeJsonLd(item),
          });
        }
      });
    }

    return {
      link: options.noindex
        ? []
        : [
            {
              rel: 'canonical',
              href: canonicalUrl.value,
            },
          ],
      script: scripts,
    };
  });
}
