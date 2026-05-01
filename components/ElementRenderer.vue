<script setup lang="ts">
/**
 * ElementRenderer mounts the correct isolated element component for a canvas node.
 */

import { CANVAS_RUNTIME_KEY } from '~/lib/runtime';
import type { ElementDef } from '~/lib/uiTypes';
import ButtonEl from '~/components/elements/ButtonEl.vue';
import TextEl from '~/components/elements/TextEl.vue';
import ImageEl from '~/components/elements/ImageEl.vue';
import TableViewEl from '~/components/elements/TableViewEl.vue';
import InputFieldEl from '~/components/elements/InputFieldEl.vue';
import CartWidgetEl from '~/components/elements/CartWidgetEl.vue';
import UploadEl from '~/components/elements/UploadEl.vue';

const props = defineProps<{
  element: ElementDef;
  businessId: string;
  builderMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', element: ElementDef): void;
  (e: 'fieldUpdate', elementId: string, field: string, value: unknown): void;
}>();

const runtime = inject<any>(CANVAS_RUNTIME_KEY, null);

const ELEMENT_COMPONENT_MAP: Record<string, unknown> = {
  button: ButtonEl,
  text: TextEl,
  image: ImageEl,
  'table-view': TableViewEl,
  'input-field': InputFieldEl,
  'cart-widget': CartWidgetEl,
  upload: UploadEl,
};

const component = computed(() => ELEMENT_COMPONENT_MAP[props.element.type] ?? null);
</script>

<template>
  <div
    class="absolute"
    :class="{ 'inset-0': builderMode }"
    :style="builderMode ? {
      pointerEvents: 'none',
    } : {
      left: `${element.position.x}px`,
      top: `${element.position.y}px`,
      width: `${element.position.width}px`,
      height: `${element.position.height}px`,
      zIndex: element.position.zIndex,
    }"
  >
    <component
      :is="component"
      :element="element as any"
      :business-id="businessId"
      :runtime="runtime"
      :builder-mode="builderMode"
      @action="emit('action', $event)"
      @update="(field: string, value: unknown) => emit('fieldUpdate', element.id, field, value)"
    />
  </div>
</template>
