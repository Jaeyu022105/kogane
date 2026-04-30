<script setup lang="ts">
// Root redirect — send straight to dashboard or login
definePageMeta({ layout: 'default' });
const router = useRouter();
onMounted(() => router.push('/dashboard'));
</script>
<template><div /></template>
