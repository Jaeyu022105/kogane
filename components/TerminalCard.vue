<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff, KeyRound, Link2, Trash2, ArrowRight, Settings2 } from 'lucide-vue-next';
import TerminalThumbnail from '~/components/TerminalThumbnail.vue';
import { TERMINAL_PERMISSION_PRESETS } from '~/lib/permissions';

const props = defineProps<{
  terminal: {
    id: string;
    display_name: string;
    role: string;
    ui_layout: string | null;
    pin_code: string | null;
    is_public: number | boolean | null;
    public_slug: string | null;
  }
}>();

const emit = defineEmits<{
  (e: 'deleted'): void;
}>();

const { authHeaders } = useAuth();
const { confirm, alert } = useModal();
const { buildShareUrl } = useShareOrigin();

const showPin = ref(false);
const deleting = ref(false);
const copiedLink = ref(false);
const copiedPin = ref(false);

function roleLabel(value: string) {
  return TERMINAL_PERMISSION_PRESETS.find((preset) => preset.key === value)?.label ?? 'Staff workspace';
}

function friendlyTerminalError(value: unknown, fallback = 'We could not update this terminal. Please try again.') {
  const message = String(value ?? '').toLowerCase();
  if (message.includes('not found') || message.includes('forbidden') || message.includes('unauthorized')) {
    return 'This terminal is no longer available. Refresh the page and try again.';
  }
  return fallback;
}

function resolveTerminalUrl() {
  if (!import.meta.client) return '';
  const isPublic = props.terminal.is_public;
  const path = isPublic && props.terminal.public_slug
    ? `/t/${props.terminal.public_slug}`
    : `/terminal/${props.terminal.id}`;
  return buildShareUrl(path);
}

async function copyLink() {
  const target = resolveTerminalUrl();
  if (!target) return;

  try {
    if (!navigator.clipboard) throw new Error('clipboard-unavailable');
    await navigator.clipboard.writeText(target);
    copiedLink.value = true;
    setTimeout(() => (copiedLink.value = false), 1500);
  } catch {
    await alert({
      title: 'Unable to copy link',
      description: 'Copying is unavailable here. Please open the terminal and copy its address manually.',
      confirmLabel: 'Close',
    });
  }
}

async function copyPin() {
  if (!props.terminal.pin_code) return;

  try {
    if (!navigator.clipboard) throw new Error('clipboard-unavailable');
    await navigator.clipboard.writeText(props.terminal.pin_code);
    copiedPin.value = true;
    setTimeout(() => (copiedPin.value = false), 1500);
  } catch {
    await alert({
      title: 'Unable to copy PIN',
      description: 'Copying is unavailable here. Please select the PIN and copy it manually.',
      confirmLabel: 'Close',
    });
  }
}

async function deleteTerminal() {
  const approved = await confirm({
    title: 'Delete terminal?',
    description: `Remove ${props.terminal.display_name} and its assigned layout from this business.`,
    confirmLabel: 'Delete Terminal',
    confirmVariant: 'danger',
  });

  if (!approved) return;
  deleting.value = true;

  try {
    const res = await $fetch<{ success: boolean; error: string | null }>(`/api/terminals/${props.terminal.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    if (res.error) {
      await alert({
        title: 'Unable to delete terminal',
        description: friendlyTerminalError(res.error, 'We could not delete this terminal. Please try again.'),
        confirmLabel: 'Close',
      });
      return;
    }

    emit('deleted');
  } catch (err: any) {
    await alert({
      title: 'Unable to delete terminal',
      description: friendlyTerminalError(err?.data?.message ?? err?.data?.error ?? err?.message, 'We could not delete this terminal. Please try again.'),
      confirmLabel: 'Close',
    });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <article class="terminal-card">
    <!-- Thumbnail preview -->
    <div class="thumbnail-wrapper">
      <TerminalThumbnail :layout="terminal.ui_layout" :title="terminal.display_name" />
    </div>

    <!-- Avatar + name + role -->
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
        style="background: rgba(61, 24, 32, 0.07); color: rgb(var(--shell-sidebar));"
      >
        {{ terminal.display_name?.[0]?.toUpperCase() ?? '?' }}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm truncate" style="color: rgb(var(--shell-sidebar)); margin: 0;">
          {{ terminal.display_name }}
        </p>
        <p class="text-xs mt-0.5" style="color: rgba(61, 24, 32, 0.35); margin: 0;">{{ roleLabel(terminal.role) }}</p>
      </div>
      <button
        type="button"
        class="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center transition-all border-none cursor-pointer"
        style="background: rgba(239, 68, 68, 0.06); color: #b42318;"
        :disabled="deleting"
        :title="deleting ? 'Deleting...' : 'Delete terminal'"
        :aria-label="deleting ? 'Deleting terminal' : 'Delete terminal'"
        @click="deleteTerminal"
      >
        <div v-if="deleting" class="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        <Trash2 v-else class="w-4 h-4" />
      </button>
    </div>

    <!-- Info/Sharing buttons grid -->
    <div class="grid grid-cols-2 gap-2">
      <!-- Copy Link Button -->
      <button
        type="button"
        class="text-xs font-medium px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer"
        style="color: rgba(61, 24, 32, 0.65); background: rgba(61, 24, 32, 0.06);"
        :aria-label="copiedLink ? 'Terminal link copied' : 'Copy terminal link'"
        @click="copyLink"
      >
        <Link2 class="w-3.5 h-3.5" />
        {{ copiedLink ? 'Copied Link' : 'Copy Link' }}
      </button>

      <!-- PIN Code display / copy -->
      <div
        v-if="terminal.pin_code"
        class="text-xs font-medium rounded-lg flex items-center justify-between gap-1 overflow-hidden"
        style="background: rgba(61, 24, 32, 0.06);"
      >
        <button
          type="button"
          class="flex-1 h-full px-2.5 py-2 flex items-center gap-1 border-none cursor-pointer text-left font-mono font-medium transition-all"
          style="color: rgba(61, 24, 32, 0.65); background: transparent;"
          :aria-label="copiedPin ? 'PIN copied' : 'Copy terminal PIN'"
          @click="copyPin"
        >
          <KeyRound class="w-3.5 h-3.5 shrink-0" style="color: rgba(61, 24, 32, 0.5);" />
          <span>{{ copiedPin ? 'Copied!' : (showPin ? terminal.pin_code : '••••') }}</span>
        </button>
        <button
          type="button"
          class="h-full px-2 flex items-center justify-center border-none cursor-pointer hover:bg-black/5 transition-all text-gray-500 shrink-0"
          style="background: transparent; color: rgba(61, 24, 32, 0.55);"
          @click="showPin = !showPin"
          :title="showPin ? 'Hide PIN' : 'Show PIN'"
          :aria-label="showPin ? 'Hide PIN' : 'Show PIN'"
        >
          <EyeOff v-if="showPin" class="w-3.5 h-3.5" />
          <Eye v-else class="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        v-else
        class="text-xs font-medium px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 select-none"
        style="color: rgba(61, 24, 32, 0.35); background: rgba(61, 24, 32, 0.03);"
      >
        <KeyRound class="w-3.5 h-3.5 opacity-40" />
        <span>No PIN</span>
      </div>
    </div>

    <!-- Actions row -->
    <div class="flex items-center gap-2 mt-auto">

      <NuxtLink
        :to="`/dashboard/terminals/${terminal.id}`"
        class="flex-1 text-center text-xs font-medium px-3 py-1.5 rounded-md transition-all no-underline"
        style="color: rgba(61, 24, 32, 0.6); background: rgba(61, 24, 32, 0.06);"
      >
        <div class="flex items-center justify-center gap-1.5">
          <Settings2 class="w-3.5 h-3.5" /> Options
        </div>
      </NuxtLink>
      <NuxtLink
        :to="terminal.is_public && terminal.public_slug ? `/t/${terminal.public_slug}` : `/terminal/${terminal.id}`"
        class="text-center text-xs font-semibold px-3 py-1.5 rounded-md transition-all no-underline"
        style="color: rgb(var(--shell-pink)); background: rgba(232, 116, 138, 0.1);"
      >
        <div class="flex items-center justify-center gap-1.5">
          Open <ArrowRight class="w-3.5 h-3.5" />
        </div>
      </NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.terminal-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid rgba(61, 24, 32, 0.08);
  border-radius: 0.75rem;
  background: #fff;
  padding: 1.25rem;
  box-shadow: 0 4px 12px rgba(61, 24, 32, 0.02);
  transition: all 0.2s ease;
}

.terminal-card:hover {
  border-color: rgba(61, 24, 32, 0.18);
}

.thumbnail-wrapper {
  overflow: hidden;
  border-radius: 0.5rem;
}
</style>
