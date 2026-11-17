/**
 * useFeatureFlags — which release-channel features this build has turned on.
 * `main` (stable) builds hide unfinished features; dev and other branches (preview) show everything.
 */

import { computed } from 'vue';
import { featureFlagsFromConfig, normalizeReleaseChannel, type FeatureKey } from '~/lib/featureFlags';

export function useFeatureFlags() {
  const config = useRuntimeConfig();

  const flags = computed(() => featureFlagsFromConfig(config.public as { features?: unknown }));
  const releaseChannel = computed(() => normalizeReleaseChannel(config.public.releaseChannel) ?? 'preview');

  function isEnabled(key: FeatureKey) {
    return flags.value[key];
  }

  return { flags, releaseChannel, isEnabled };
}
