<script setup lang="ts">
const { state, close } = useModal();

const panelClass = computed(() => {
  if (state.value.confirmVariant === 'danger') {
    return 'bg-[#4b1419] text-white';
  }
  return 'bg-white text-[#3d1820]';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="v">
      <div
        v-if="state.open"
        class="fixed inset-0 z-[100] flex items-center justify-center px-4"
        style="background: rgba(15, 5, 7, 0.48); backdrop-filter: blur(10px);"
        @click.self="close(false)"
      >
        <div
          class="w-full max-w-md rounded-[28px] border shadow-2xl"
          :class="panelClass"
          style="border-color: rgba(61,24,32,0.12);"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-host-title"
        >
          <div class="px-6 py-5 space-y-2">
            <h2 id="modal-host-title" class="font-serif text-xl leading-tight">{{ state.title ?? state.name }}</h2>
            <p v-if="state.description" class="text-sm opacity-75 leading-relaxed">
              {{ state.description }}
            </p>
            <div
              v-if="state.kind === 'custom' && state.props"
              class="mt-4 rounded-2xl bg-black/5 px-4 py-3 text-xs leading-relaxed"
            >
              This workspace message is ready for your next step.
            </div>
          </div>

          <div class="flex gap-3 px-6 pb-6 pt-2">
            <button
              v-if="state.kind === 'confirm'"
              type="button"
              class="flex-1 rounded-full border px-4 py-2.5 text-sm font-medium"
              style="border-color: rgba(61,24,32,0.15);"
              @click="close(false)"
            >
              {{ state.cancelLabel ?? 'Cancel' }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold"
              :style="state.confirmVariant === 'danger'
                ? 'background: #fda4af; color: #4b1419;'
                : 'background: rgb(var(--shell-sidebar)); color: rgb(var(--shell-sidebar-text));'"
              @click="close(true)"
            >
              {{ state.confirmLabel ?? 'OK' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
