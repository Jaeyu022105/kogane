/**
 * Pages can declare `definePageMeta({ feature: 'pricing' })`. When that feature is off for this
 * release channel (for example pricing on `main`), the page responds as if it does not exist.
 */

import { isFeatureKey } from '~/lib/featureFlags';

export default defineNuxtRouteMiddleware((to) => {
  const feature = to.meta.feature;
  if (!isFeatureKey(feature)) return;

  const { isEnabled } = useFeatureFlags();
  if (isEnabled(feature)) return;

  return abortNavigation(createError({ statusCode: 404, statusMessage: 'Page not found' }));
});
