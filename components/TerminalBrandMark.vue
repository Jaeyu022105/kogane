<script setup lang="ts">
/**
 * Business brand mark for terminal screens: the uploaded logo, or the business initials on the
 * brand color when no logo has been set. Falls back to initials if the logo fails to load.
 */
import { sanitizeImageSrc } from '~/lib/securityClient';
import { brandInitials, readableTextColor } from '~/lib/workspaceBranding';

const props = withDefaults(defineProps<{
  name?: string | null;
  logoUrl?: string | null;
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
  rounded?: 'rounded' | 'square';
}>(), {
  name: '',
  logoUrl: null,
  color: '#68293A',
  size: 'md',
  rounded: 'rounded',
});

const logoFailed = ref(false);
watch(() => props.logoUrl, () => {
  logoFailed.value = false;
});

const safeLogo = computed(() => (logoFailed.value ? '' : sanitizeImageSrc(props.logoUrl)));
const initials = computed(() => brandInitials(props.name));
const background = computed(() => props.color || '#68293A');
const ink = computed(() => readableTextColor(background.value));

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'w-6 h-6 text-[10px]';
  if (props.size === 'lg') return 'w-14 h-14 text-xl';
  return 'w-12 h-12 text-base';
});

const radiusClass = computed(() => {
  if (props.rounded === 'square') return props.size === 'sm' ? 'rounded' : 'rounded-lg';
  return props.size === 'sm' ? 'rounded-md' : 'rounded-2xl';
});
</script>

<template>
  <span
    class="terminal-brand-mark inline-flex shrink-0 items-center justify-center overflow-hidden font-serif leading-none"
    :class="[sizeClass, radiusClass]"
    :style="safeLogo ? { background: '#ffffff' } : { background, color: ink }"
  >
    <img
      v-if="safeLogo"
      :src="safeLogo"
      :alt="name ? `${name} logo` : 'Business logo'"
      class="h-full w-full object-contain"
      @error="logoFailed = true"
    />
    <span v-else aria-hidden="true">{{ initials }}</span>
  </span>
</template>
