<script setup lang="ts">
/**
 * Dashboard "get ready to open" checklist: the few steps that turn a new workspace into
 * branded, staff-ready terminals. Each step links to where it gets done and the list
 * hides itself once every step is complete.
 */
import CheckIcon from 'reicon-vue/icons/Check';
import ArrowRightIcon from 'reicon-vue/icons/ArrowRight';
import { DEFAULT_TERMINAL_PIN } from '~/lib/permissions';

interface ChecklistTerminal {
  id: string;
  pin_code: string | null;
}

const props = defineProps<{
  hasLogo: boolean;
  terminals: ChecklistTerminal[];
  loading?: boolean;
}>();

const { t } = useLocale();

const defaultPinTerminals = computed(() =>
  props.terminals.filter((terminal) => !terminal.pin_code || terminal.pin_code === DEFAULT_TERMINAL_PIN),
);

const steps = computed(() => {
  const hasTerminals = props.terminals.length > 0;
  const firstDefaultPin = defaultPinTerminals.value[0];

  return [
    {
      key: 'brand',
      done: props.hasLogo,
      title: t('checklist_brand_title'),
      body: t('checklist_brand_body'),
      to: '/dashboard/settings',
    },
    {
      key: 'workstation',
      done: hasTerminals,
      title: t('checklist_workstation_title'),
      body: t('checklist_workstation_body'),
      to: '/dashboard/terminals',
    },
    {
      key: 'pins',
      done: hasTerminals && defaultPinTerminals.value.length === 0,
      title: t('checklist_pins_title'),
      body: defaultPinTerminals.value.length > 0
        ? t('checklist_pins_body_count', { count: defaultPinTerminals.value.length })
        : t('checklist_pins_body'),
      to: firstDefaultPin ? `/dashboard/terminals/${firstDefaultPin.id}` : '/dashboard/terminals',
    },
  ];
});

const completed = computed(() => steps.value.filter((step) => step.done).length);
const allDone = computed(() => completed.value === steps.value.length);
</script>

<template>
  <section v-if="!loading && !allDone" class="setup-checklist" aria-labelledby="setup-checklist-title">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: rgba(61,24,32,0.4);">{{ t('checklist_overline') }}</p>
        <h2 id="setup-checklist-title" class="font-serif text-2xl mt-1" style="color: rgb(var(--shell-sidebar));">{{ t('checklist_title') }}</h2>
      </div>
      <p class="font-mono text-xs tabular-nums" style="color: rgba(61,24,32,0.5);">
        {{ t('checklist_progress', { done: completed, total: steps.length }) }}
      </p>
    </div>

    <div class="setup-progress mb-5" role="progressbar" :aria-valuenow="completed" aria-valuemin="0" :aria-valuemax="steps.length">
      <span :style="{ width: `${(completed / steps.length) * 100}%` }" />
    </div>

    <ol class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <li v-for="(step, index) in steps" :key="step.key">
        <NuxtLink :to="step.to" class="setup-step group" :class="{ 'is-done': step.done }">
          <span class="setup-step-marker" aria-hidden="true">
            <CheckIcon v-if="step.done" class="w-3.5 h-3.5" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold" style="color: rgb(var(--shell-sidebar));">
              {{ step.title }}
              <span v-if="step.done" class="sr-only">({{ t('checklist_done') }})</span>
            </span>
            <span class="block text-xs leading-relaxed mt-1" style="color: rgba(61,24,32,0.55);">{{ step.body }}</span>
          </span>
          <ArrowRightIcon v-if="!step.done" class="w-4 h-4 shrink-0 mt-0.5 setup-step-arrow" />
        </NuxtLink>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.setup-checklist {
  margin-bottom: 3rem;
  padding: 1.75rem;
  border-radius: 1.25rem;
  background: #FFFFFF;
  border: 1px solid rgba(255, 87, 118, 0.18);
  box-shadow: 0 4px 12px rgba(61, 24, 32, 0.03);
}

.setup-progress {
  height: 6px;
  border-radius: 99px;
  background: #F6E6D7;
  overflow: hidden;
}

.setup-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgb(var(--shell-pink));
  transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.setup-step {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  height: 100%;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(61, 24, 32, 0.08);
  background: #FFFDFB;
  text-decoration: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.setup-step:hover {
  border-color: rgba(255, 87, 118, 0.4);
  box-shadow: 0 8px 20px -12px rgba(61, 24, 32, 0.25);
}

.setup-step.is-done {
  background: #FBF4ED;
}

.setup-step-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  flex-shrink: 0;
  border-radius: 99px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(var(--shell-pink));
  background: rgba(255, 87, 118, 0.1);
}

.setup-step.is-done .setup-step-marker {
  color: #FFFFFF;
  background: #059669;
}

.setup-step-arrow {
  color: rgb(var(--shell-pink));
  transition: transform 0.2s;
}

.setup-step:hover .setup-step-arrow {
  transform: translateX(2px);
}

@media (prefers-reduced-motion: reduce) {
  .setup-progress span,
  .setup-step-arrow {
    transition: none;
  }
}
</style>
