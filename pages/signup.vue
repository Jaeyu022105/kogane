<script setup lang="ts">
definePageMeta({ layout: 'default' });

await navigateTo('/login?mode=signup', { replace: true, redirectCode: 302 });
</script>

<template>
  <div />
</template>
