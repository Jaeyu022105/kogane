import { defineEventHandler, setResponseHeader } from 'h3';
import { featureFlagsFromConfig, type FeatureKey } from '~/lib/featureFlags';
import { resolveServerSiteOrigin } from '../middleware/seoHeaders';

const LAST_MODIFIED = '2026-11-14';

interface SitemapEntry {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
  /** Only listed when this release-channel feature is on. */
  feature?: FeatureKey;
}

const PUBLIC_ROUTES: SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/features', changefreq: 'weekly', priority: '0.9' },
  { path: '/pricing', changefreq: 'weekly', priority: '0.9', feature: 'pricing' },
  { path: '/privacy', changefreq: 'monthly', priority: '0.4' },
  { path: '/terms', changefreq: 'monthly', priority: '0.4' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default defineEventHandler((event) => {
  const origin = resolveServerSiteOrigin(event);
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600');

  const runtimePublic = typeof useRuntimeConfig === 'function' ? useRuntimeConfig(event)?.public : undefined;
  const features = featureFlagsFromConfig(runtimePublic as { features?: unknown } | undefined);

  const urls = PUBLIC_ROUTES.filter((entry) => !entry.feature || features[entry.feature]).map((entry) => {
    const loc = escapeXml(`${origin}${entry.path}`);
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${LAST_MODIFIED}</lastmod>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      '  </url>',
    ].join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
});
