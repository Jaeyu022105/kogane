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
  row?: Record<string, unknown>;
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

function resolveSingleRuntimeToken(
  token: string,
  context: RuntimeResolverContext,
): unknown {
  if (token === '$$cart') return context.cart;
  if (token === '$$row') return context.row ?? null;
  if (token === '$$element.id') return context.elementId ?? null;

  if (token.startsWith('$$input.')) {
    return context.inputs[token.slice('$$input.'.length)] ?? null;
  }

  if (token.startsWith('$$inputs.')) {
    return context.inputs[token.slice('$$inputs.'.length)] ?? null;
  }

  if (token.startsWith('$$upload.')) {
    return context.uploads[token.slice('$$upload.'.length)] ?? null;
  }

  if (token.startsWith('$$session.')) {
    return context.session?.[token.slice('$$session.'.length)] ?? null;
  }

  if (token.startsWith('$$row.')) {
    return context.row?.[token.slice('$$row.'.length)] ?? null;
  }

  return undefined;
}

const EXACT_RUNTIME_TOKEN_RE = /^(?:\$\$cart|\$\$row|\$\$element\.id|\$\$(?:inputs?|upload|session|row)\.[A-Za-z0-9_.:-]+)$/;
const BRACED_RUNTIME_TOKEN_RE = /\{\{\s*(\$\$(?:cart|element\.id|row(?:\.[A-Za-z0-9_.:-]+)?|(?:inputs?|upload|session)\.[A-Za-z0-9_.:-]+))\s*\}\}/g;
const INLINE_RUNTIME_TOKEN_RE = /\$\$(?:element\.id|row\.[A-Za-z0-9_.:-]+|(?:inputs?|upload|session)\.[A-Za-z0-9_.:-]+)/g;

function formatInterpolatedValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function resolveRuntimePayload(
  value: RuntimePayloadValue | undefined,
  context: RuntimeResolverContext,
): unknown {
  if (value == null) return value;

  if (typeof value === 'string') {
    if (EXACT_RUNTIME_TOKEN_RE.test(value)) {
      return resolveSingleRuntimeToken(value, context);
    }

    if (value.includes('$$')) {
      const withBraced = value.replace(BRACED_RUNTIME_TOKEN_RE, (_match, token) =>
        formatInterpolatedValue(resolveSingleRuntimeToken(token, context)),
      );
      return withBraced.replace(INLINE_RUNTIME_TOKEN_RE, (token) =>
        formatInterpolatedValue(resolveSingleRuntimeToken(token, context)),
      );
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
