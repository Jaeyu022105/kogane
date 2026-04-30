<script setup lang="ts">
/**
 * ElementRenderer — the central dispatch component.
 * Reads a single ElementDef and mounts the correct isolated element component.
 * Adding a new element type = add one case here + one new component. No other changes needed.
 */

import type { ElementDef } from '~/lib/uiTypes';
import ButtonEl     from '~/components/elements/ButtonEl.vue';
import TextEl       from '~/components/elements/TextEl.vue';
import ImageEl      from '~/components/elements/ImageEl.vue';
import TableViewEl  from '~/components/elements/TableViewEl.vue';
import InputFieldEl from '~/components/elements/InputFieldEl.vue';
import CartWidgetEl from '~/components/elements/CartWidgetEl.vue';

const props = defineProps<{
  element:    ElementDef;
  businessId: string;
  // In builder mode, elements are non-interactive overlays
  builderMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action',       element: ElementDef): void;
  (e: 'fieldUpdate',  field: string, value: unknown): void;
}>();

// Map element type to the correct component — renderer is the only place this dispatch lives
const ELEMENT_COMPONENT_MAP: Record<string, unknown> = {
  'button':      ButtonEl,
  'text':        TextEl,
  'image':       ImageEl,
  'table-view':  TableViewEl,
  'input-field': InputFieldEl,
  'cart-widget': CartWidgetEl,
};

const component = computed(() => ELEMENT_COMPONENT_MAP[props.element.type] ?? null);
</script>

<template>
  <div
    class="absolute"
    :class="{ 'inset-0': builderMode }"
    :style="builderMode ? {
      pointerEvents: 'none'
    } : {
      left:    `${element.position.x}px`,
      top:     `${element.position.y}px`,
      width:   `${element.position.width}px`,
      height:  `${element.position.height}px`,
      zIndex:  element.position.zIndex,
    }"
  >
    <component
      :is="component"
      :element="element as any"
      :business-id="businessId"
      @action="emit('action', $event)"
      @update="(field: string, value: unknown) => emit('fieldUpdate', field, value)"
    />
  </div>
</template>
