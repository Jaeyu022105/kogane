import { defineEventHandler, setResponseHeader } from 'h3';
import { resolveServerSiteOrigin } from '../middleware/seoHeaders';

export default defineEventHandler((event) => {
  const origin = resolveServerSiteOrigin(event);
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600');

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard/',
    'Disallow: /api/',
    'Disallow: /terminal/',
    'Disallow: /t/',
    'Disallow: /signup',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
});
