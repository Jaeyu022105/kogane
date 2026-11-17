/**
 * Release-channel feature flags.
 *
 * Every build belongs to a release channel:
 * - `stable`  — production builds from `main`. Features that are not ready for customers stay off.
 * - `preview` — `dev`, feature branches, and local development. Everything is on.
 *
 * The channel is decided once at build time in `nuxt.config.ts` (see `resolveReleaseChannel`) and
 * shipped to the app through `runtimeConfig.public`. A single feature can still be forced on or off
 * for one deployment with `KOGANE_FEATURES` (for example `KOGANE_FEATURES=pricing` or `-pricing`).
 */

export type ReleaseChannel = 'stable' | 'preview';

export interface FeatureFlagDefinition {
  /** Plain description shown in docs and logs. */
  description: string;
  /** Whether the feature is on in production (`main`) builds. Preview builds always turn it on. */
  stable: boolean;
}

export const FEATURE_FLAGS = {
  pricing: {
    description: 'Public pricing page, plus the navigation, footer, call-to-action, sitemap, and llms.txt links that point to it.',
    stable: false,
  },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type FeatureKey = keyof typeof FEATURE_FLAGS;
export type FeatureFlags = Record<FeatureKey, boolean>;

export const FEATURE_KEYS = Object.keys(FEATURE_FLAGS) as FeatureKey[];

/** Branches that build the production (`stable`) channel. */
const STABLE_BRANCHES = new Set(['main', 'master']);

export function isFeatureKey(value: unknown): value is FeatureKey {
  if (typeof value !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, value);
}

export function normalizeReleaseChannel(value: unknown): ReleaseChannel | null {
  const clean = String(value ?? '').trim().toLowerCase();
  if (clean === 'stable' || clean === 'production' || clean === 'prod') return 'stable';
  if (clean === 'preview' || clean === 'dev' || clean === 'development' || clean === 'staging') return 'preview';
  return null;
}

/**
 * Picks the release channel for a build.
 * 1. An explicit `KOGANE_RELEASE_CHANNEL` wins.
 * 2. Otherwise the git branch decides: `main` is stable, any other branch is preview.
 * 3. With no branch information, production builds default to stable so unfinished features stay hidden.
 */
export function resolveReleaseChannel(options: {
  explicitChannel?: unknown;
  branch?: string | null;
  isProductionBuild?: boolean;
}): ReleaseChannel {
  const explicit = normalizeReleaseChannel(options.explicitChannel);
  if (explicit) return explicit;

  const branch = String(options.branch ?? '').trim().replace(/^refs\/heads\//, '');
  if (branch && branch !== 'HEAD') return STABLE_BRANCHES.has(branch) ? 'stable' : 'preview';

  return options.isProductionBuild ? 'stable' : 'preview';
}

/**
 * Reads per-deployment overrides such as `pricing,-builder` or `pricing=off`.
 * Unknown feature names are ignored.
 */
export function parseFeatureOverrides(raw: unknown): Partial<FeatureFlags> {
  const overrides: Partial<FeatureFlags> = {};
  for (const token of String(raw ?? '').split(/[\s,]+/)) {
    const clean = token.trim().toLowerCase();
    if (!clean) continue;

    let key = clean;
    let enabled = true;
    if (clean.startsWith('-') || clean.startsWith('!')) {
      key = clean.slice(1);
      enabled = false;
    } else if (clean.includes('=')) {
      const [name, value] = clean.split('=');
      key = name;
      enabled = !['0', 'false', 'off', 'no'].includes(value ?? '');
    }

    if (isFeatureKey(key)) overrides[key] = enabled;
  }
  return overrides;
}

export function resolveFeatureFlags(channel: ReleaseChannel, overrides: Partial<FeatureFlags> = {}): FeatureFlags {
  const flags = {} as FeatureFlags;
  for (const key of FEATURE_KEYS) {
    flags[key] = overrides[key] ?? (channel === 'preview' ? true : FEATURE_FLAGS[key].stable);
  }
  return flags;
}

/**
 * Reads flags from a runtime config `public` object (client or server), falling back to the
 * process environment for scripts and tests that run outside Nuxt.
 */
export function featureFlagsFromConfig(publicConfig?: { features?: unknown } | null): FeatureFlags {
  const configured = publicConfig?.features;
  if (configured && typeof configured === 'object') {
    const source = configured as Record<string, unknown>;
    const flags = {} as FeatureFlags;
    for (const key of FEATURE_KEYS) {
      flags[key] = source[key] === true || source[key] === 'true';
    }
    return flags;
  }

  const env = typeof process !== 'undefined' ? process.env : {};
  const channel = resolveReleaseChannel({
    explicitChannel: env.KOGANE_RELEASE_CHANNEL ?? env.NUXT_PUBLIC_RELEASE_CHANNEL,
    branch: env.KOGANE_BRANCH,
    isProductionBuild: env.NODE_ENV === 'production' && env.DEV_MODE !== 'true',
  });
  return resolveFeatureFlags(channel, parseFeatureOverrides(env.KOGANE_FEATURES));
}
