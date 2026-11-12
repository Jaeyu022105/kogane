<script setup lang="ts">
/**
 * Root app entry — loads auth session and injects business theme on mount.
 */

const { hydrateSession } = useAuth();
const { loadLocale }     = useLocale();

onMounted(() => {
  loadLocale();
  void hydrateSession();
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ModalHost />
</template>
