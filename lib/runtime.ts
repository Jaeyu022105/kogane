import type { ElementDef, EventTrigger, RuntimeActionDefinition, RuntimePayloadValue } from '~/lib/uiTypes';

export const CANVAS_RUNTIME_KEY = 'kogane:canvas-runtime';

export interface RuntimeEventEnvelope {
  inpoint_id: string;
  business_id: string;
  element_id: string;
  trigger: EventTrigger;
  action: RuntimeActionDefinition;
  payload: unknown;
  timestamp: string;
}

export interface RuntimeResolverContext {
  cart: unknown[];
  inputs: Record<string, unknown>;
  uploads: Record<string, string>;
  session?: Record<string, unknown>;
  elementId?: string;
}

export function isMutationAction(action: RuntimeActionDefinition): boolean {
  return action.type === 'insert' || action.type === 'update' || action.type === 'delete';
}

export function shouldQueueAction(action: RuntimeActionDefinition): boolean {
  return isMutationAction(action);
}

/** Resolve the small set of human-friendly placeholders allowed in upload paths. */
export function resolveRuntimePathTemplate(value: string, date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;

  return value.replaceAll('{{date}}', today).replaceAll('{date}', today);
}

export function resolveRuntimePayload(
  value: RuntimePayloadValue | undefined,
  context: RuntimeResolverContext,
): unknown {
  if (value == null) return value;

  if (typeof value === 'string') {
    if (value === '$$cart') return context.cart;

    if (value.startsWith('$$input.')) {
      return context.inputs[value.replace('$$input.', '')] ?? null;
    }

    if (value.startsWith('$$inputs.')) {
      return context.inputs[value.replace('$$inputs.', '')] ?? null;
    }

    if (value.startsWith('$$upload.')) {
      return context.uploads[value.replace('$$upload.', '')] ?? null;
    }

    if (value.startsWith('$$session.')) {
      return context.session?.[value.replace('$$session.', '')] ?? null;
    }

    if (value === '$$element.id') {
      return context.elementId ?? null;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveRuntimePayload(item, context));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveRuntimePayload(item as RuntimePayloadValue, context)]),
    );
  }

  return value;
}

export function elementHasTrigger(element: ElementDef, trigger: EventTrigger): boolean {
  return (element.events ?? []).some((event) => event.trigger === trigger);
}
