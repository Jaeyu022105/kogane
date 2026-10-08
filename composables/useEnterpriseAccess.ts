import { computed } from 'vue';

export function useEnterpriseAccess() {
  // All workstations and builder features are unlocked for local business operations.
  const isEnterprise = computed(() => true);

  return { isEnterprise };
}
