import { ref } from 'vue';

/**
 * useOnboarding — shared toggle for the onboarding modal.
 * Module-level ref ensures both the layout and settings page share the same state.
 */

const showOnboarding = ref(false);

export function useOnboarding() {
  function openOnboarding() {
    showOnboarding.value = true;
  }

  function closeOnboarding() {
    showOnboarding.value = false;
  }

  return { showOnboarding, openOnboarding, closeOnboarding };
}
