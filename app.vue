<script setup lang="ts">
/**
 * Root app entry — loads auth session and injects business theme on mount.
 */

const { loadDevSession } = useAuth();

onMounted(() => {
  // Restore dev session from localStorage on page load
  if (process.env.NODE_ENV !== 'production' || process.env.DEV_MODE === 'true') {
    loadDevSession();
  }
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ModalHost />
</template>
