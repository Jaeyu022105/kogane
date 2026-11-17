import { afterEach, describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  FEATURE_FLAGS,
  featureFlagsFromConfig,
  parseFeatureOverrides,
  resolveFeatureFlags,
  resolveReleaseChannel,
} from '../lib/featureFlags';
import sitemapHandler from '../server/routes/sitemap.xml';
import llmsHandler from '../server/routes/llms.txt';

const savedEnv = {
  KOGANE_RELEASE_CHANNEL: process.env.KOGANE_RELEASE_CHANNEL,
  KOGANE_FEATURES: process.env.KOGANE_FEATURES,
};

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function mockEvent(path: string) {
  const headers: Record<string, string> = { host: 'kogane.app', 'x-forwarded-proto': 'https' };
  return {
    path,
    method: 'GET',
    node: {
      req: { url: path, method: 'GET', headers },
      res: { setHeader: () => {}, getHeader: () => undefined },
    },
    headers: new Headers(headers),
    context: {},
    _headers: {} as Record<string, string>,
  } as any;
}

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectFiles(full, out);
    else if (full.endsWith('.vue')) out.push(full);
  }
  return out;
}

describe('Release channel resolution', () => {
  test('main builds the stable channel and every other branch builds preview', () => {
    expect(resolveReleaseChannel({ branch: 'main' })).toBe('stable');
    expect(resolveReleaseChannel({ branch: 'refs/heads/main' })).toBe('stable');
    expect(resolveReleaseChannel({ branch: 'dev' })).toBe('preview');
    expect(resolveReleaseChannel({ branch: 'feat/release-channel-flags' })).toBe('preview');
  });

  test('an explicit channel wins over the branch', () => {
    expect(resolveReleaseChannel({ explicitChannel: 'preview', branch: 'main' })).toBe('preview');
    expect(resolveReleaseChannel({ explicitChannel: 'production', branch: 'dev' })).toBe('stable');
  });

  test('without branch information, production builds stay stable and local builds stay preview', () => {
    expect(resolveReleaseChannel({ branch: null, isProductionBuild: true })).toBe('stable');
    expect(resolveReleaseChannel({ branch: 'HEAD', isProductionBuild: true })).toBe('stable');
    expect(resolveReleaseChannel({ branch: null, isProductionBuild: false })).toBe('preview');
  });

  test('pricing is off on stable, on in preview, and can be forced per deployment', () => {
    expect(FEATURE_FLAGS.pricing.stable).toBe(false);
    expect(resolveFeatureFlags('stable').pricing).toBe(false);
    expect(resolveFeatureFlags('preview').pricing).toBe(true);
    expect(resolveFeatureFlags('stable', parseFeatureOverrides('pricing')).pricing).toBe(true);
    expect(resolveFeatureFlags('preview', parseFeatureOverrides('-pricing')).pricing).toBe(false);
    expect(resolveFeatureFlags('preview', parseFeatureOverrides('pricing=off')).pricing).toBe(false);
    expect(parseFeatureOverrides('unknown-feature, ,')).toEqual({});
  });

  test('flags read from runtime config take priority over the environment', () => {
    process.env.KOGANE_RELEASE_CHANNEL = 'preview';
    expect(featureFlagsFromConfig({ features: { pricing: false } }).pricing).toBe(false);
    expect(featureFlagsFromConfig({ features: { pricing: 'true' } }).pricing).toBe(true);
    expect(featureFlagsFromConfig(null).pricing).toBe(true);
  });
});

describe('Pricing stays hidden on the stable channel', () => {
  test('sitemap.xml and llms.txt list pricing only when the feature is on', async () => {
    process.env.KOGANE_RELEASE_CHANNEL = 'stable';
    const stableSitemap = String(await sitemapHandler(mockEvent('/sitemap.xml')));
    const stableLlms = String(await llmsHandler(mockEvent('/llms.txt')));
    expect(stableSitemap).not.toContain('/pricing');
    expect(stableSitemap).toContain('<loc>https://kogane.app/features</loc>');
    expect(stableLlms).not.toContain('/pricing');
    expect(stableLlms).not.toContain('Pricing Overview');

    process.env.KOGANE_RELEASE_CHANNEL = 'preview';
    const previewSitemap = String(await sitemapHandler(mockEvent('/sitemap.xml')));
    const previewLlms = String(await llmsHandler(mockEvent('/llms.txt')));
    expect(previewSitemap).toContain('<loc>https://kogane.app/pricing</loc>');
    expect(previewLlms).toContain('/pricing');
  });

  test('the pricing page declares its feature so the route guard can 404 it', () => {
    const pricingPage = readFileSync(join(process.cwd(), 'pages/pricing.vue'), 'utf8');
    expect(pricingPage).toContain("feature: 'pricing'");

    const guard = readFileSync(join(process.cwd(), 'middleware/feature-gate.global.ts'), 'utf8');
    expect(guard).toContain('statusCode: 404');
  });

  test('every link to /pricing outside the pricing page is gated by the pricing flag', () => {
    const files = [
      ...collectFiles(join(process.cwd(), 'pages')),
      ...collectFiles(join(process.cwd(), 'components')),
      ...collectFiles(join(process.cwd(), 'layouts')),
      join(process.cwd(), 'error.vue'),
      join(process.cwd(), 'app.vue'),
    ].filter((file) => !file.replace(/\\/g, '/').endsWith('pages/pricing.vue'));

    const ungated: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(/<(?:NuxtLink|a)\b[^>]*(?:to|href)="\/pricing[^"]*"[^>]*>/g)) {
        if (!match[0].includes("isEnabled('pricing')")) ungated.push(`${file}: ${match[0]}`);
      }
      if (/to:\s*'\/pricing'/.test(content) && !content.includes("isEnabled('pricing')")) {
        ungated.push(`${file}: navigation entry`);
      }
    }
    expect(ungated).toEqual([]);
  });
});
