import type { TerminalPermissions } from '~/lib/permissions';
import { isActionAllowed, normalizePermissions } from '~/lib/permissions';
import {
  CANVAS_RUNTIME_KEY,
  resolveRuntimePayload,
  shouldQueueAction,
  type RuntimeEventEnvelope,
} from '~/lib/runtime';
import {
  getElementEvents,
  type CartWidgetElementDef,
  type ElementDef,
  type EventTrigger,
  type RuntimeActionDefinition,
  type UiLayout,
} from '~/lib/uiTypes';

interface RuntimeState {
  inputs: Record<string, unknown>;
  queryResults: Record<string, Record<string, unknown>[]>;
  queryTables: Record<string, string>;
  cart: unknown[];
  uploads: Record<string, string>;
  permissions: TerminalPermissions;
  activeModalId: string | null;
  sessionVars: Record<string, unknown>;
}

interface RuntimeContext {
  terminalId: string;
  businessId: string;
  layout: UiLayout | null;
  sessionVars: Record<string, unknown>;
}

type RuntimeListener = (payload?: unknown) => void;

const listeners = new Map<string, Set<RuntimeListener>>();
const loadedElements = new Set<string>();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function useCanvasRuntime() {
  const runtimeState = useState<RuntimeState>('kogane:runtime:state', () => ({
    inputs: {},
    queryResults: {},
    queryTables: {},
    cart: [],
    uploads: {},
    permissions: normalizePermissions(),
    activeModalId: null,
    sessionVars: {},
  }));
  const context = useState<RuntimeContext>('kogane:runtime:context', () => ({
    terminalId: '',
    businessId: '',
    layout: null,
    sessionVars: {},
  }));
  const { enqueue } = useEventQueue();
  const { alert } = useModal();

  function reset() {
    runtimeState.value = {
      inputs: {},
      queryResults: {},
      queryTables: {},
      cart: [],
      uploads: {},
      permissions: normalizePermissions(),
      activeModalId: null,
      sessionVars: {},
    };
    loadedElements.clear();
    listeners.clear();
  }

  function configure(options: {
    terminalId: string;
    businessId: string;
    layout: UiLayout;
    permissions?: TerminalPermissions;
    sessionVars?: Record<string, unknown>;
  }) {
    context.value = {
      terminalId: options.terminalId,
      businessId: options.businessId,
      layout: options.layout,
      sessionVars: options.sessionVars ?? {},
    };
    runtimeState.value.permissions = normalizePermissions(options.permissions);
    runtimeState.value.sessionVars = options.sessionVars ?? {};
    runtimeState.value.activeModalId = null;
    loadedElements.clear();
  }

  function setInputValue(elementId: string, value: unknown) {
    runtimeState.value.inputs[elementId] = value;
  }

  function setCartValue(items: unknown[]) {
    runtimeState.value.cart = items;
  }

  function setSessionVar(key: string, value: unknown) {
    runtimeState.value.sessionVars[key] = value;
    context.value.sessionVars[key] = value;
  }

  function on(eventName: string, handler: RuntimeListener) {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName)?.add(handler);
    return () => listeners.get(eventName)?.delete(handler);
  }

  function emitLocal(eventName: string, payload?: unknown) {
    if (eventName === 'modal:open') {
      const modalId = (payload as { modalId?: string } | undefined)?.modalId ?? null;
      runtimeState.value.activeModalId = modalId;
    }

    if (eventName === 'modal:close') {
      runtimeState.value.activeModalId = null;
    }

    if (eventName === 'cart:clear') {
      runtimeState.value.cart = [];
    }

    const handlers = listeners.get(eventName);
    if (!handlers) return;
    for (const handler of handlers) handler(payload);
  }

  async function runQueryAction(elementId: string, action: RuntimeActionDefinition, trigger: EventTrigger) {
    if (!action.table && action.source !== 'audit-log') return [];

    const envelope: RuntimeEventEnvelope = {
      inpoint_id: context.value.terminalId,
      business_id: context.value.businessId,
      element_id: elementId,
      trigger,
      action,
      payload: action.payload ?? null,
      timestamp: new Date().toISOString(),
    };

    const response = await $fetch<{ results: Array<{ ok: boolean; data?: unknown; error?: string | null }> }>(
      '/api/runtime/event',
      {
        method: 'POST',
        body: envelope,
      },
    );

    const result = response.results[0];
    if (!result?.ok) {
      throw new Error(result?.error ?? 'Query failed');
    }

    const targetElementId = action.targetElementId ?? elementId;
    runtimeState.value.queryResults[targetElementId] = Array.isArray(result.data)
      ? result.data as Record<string, unknown>[]
      : [];
    runtimeState.value.queryTables[targetElementId] = action.table;
    return runtimeState.value.queryResults[targetElementId];
  }

  async function reloadElement(element: ElementDef) {
    loadedElements.delete(element.id);
    return loadElement(element);
  }

  async function pickFile(accept?: string[]) {
    if (!import.meta.client) return null;

    return new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept?.join(',') ?? '';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
  }

  async function runUploadAction(element: ElementDef, action: RuntimeActionDefinition) {
    const file = await pickFile(action.accept);
    if (!file) return null;

    const form = new FormData();
    const path = String(resolveRuntimePayload(action.path ?? `${element.id}/${file.name}`, {
      cart: runtimeState.value.cart,
      inputs: runtimeState.value.inputs,
      uploads: runtimeState.value.uploads,
      session: runtimeState.value.sessionVars,
      elementId: element.id,
    }) ?? `${element.id}/${file.name}`);

    form.append('file', file);
    form.append('bucket', action.bucket ?? 'assets');
    form.append('path', path);

    const response = await $fetch<{ url: string; error: string | null }>('/api/storage/upload', {
      method: 'POST',
      body: form,
    });

    if (response.error) {
      throw new Error(response.error);
    }

    runtimeState.value.uploads[element.id] = response.url;
    return response.url;
  }

  function applyOptimisticMutation(action: RuntimeActionDefinition, payload: unknown) {
    const previousQueries = clone(runtimeState.value.queryResults);

    if (!action.table) {
      return () => {
        runtimeState.value.queryResults = previousQueries;
      };
    }

    for (const [elementId, tableName] of Object.entries(runtimeState.value.queryTables)) {
      if (tableName !== action.table) continue;
      const rows = runtimeState.value.queryResults[elementId] ?? [];

      if (action.type === 'insert' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
        rows.unshift({
          id: `optimistic-${Date.now()}`,
          ...(payload as Record<string, unknown>),
        });
      }

      if (action.type === 'update' && action.rowId) {
        runtimeState.value.queryResults[elementId] = rows.map((row) =>
          row.id === action.rowId
            ? { ...row, ...(payload as Record<string, unknown>) }
            : row,
        );
      }

      if (action.type === 'delete' && action.rowId) {
        runtimeState.value.queryResults[elementId] = rows.filter((row) => row.id !== action.rowId);
      }
    }

    return () => {
      runtimeState.value.queryResults = previousQueries;
    };
  }

  function resolverContext(elementId?: string): import('~/lib/runtime').RuntimeResolverContext {
    return {
      cart: runtimeState.value.cart,
      inputs: runtimeState.value.inputs,
      uploads: runtimeState.value.uploads,
      session: runtimeState.value.sessionVars,
      elementId,
    };
  }

  function evaluateCondition(condition: string | undefined): boolean {
    if (!condition || !condition.trim()) return true;

    try {
      const ctx = resolverContext();
      // eslint-disable-next-line no-new-func
      const fn = new Function('inputs', 'session', 'cart', `return !!(${condition})`);
      return fn(ctx.inputs, ctx.session ?? {}, ctx.cart);
    } catch {
      return false;
    }
  }

  async function dispatch(action: RuntimeActionDefinition, options: {
    element: ElementDef;
    trigger: EventTrigger;
  }) {
    if (!isActionAllowed(runtimeState.value.permissions, action)) {
      await alert({
        title: 'Permission required',
        description: 'This action is disabled for the current role.',
        confirmLabel: 'Dismiss',
      });
      return null;
    }

    /* evaluate condition guard — dispatch onFailure branch if condition is falsy */
    if (action.condition !== undefined) {
      const passed = evaluateCondition(action.condition);

      if (!passed) {
        if (action.onFailure) {
          return dispatch(action.onFailure, options);
        }

        return null;
      }
    }

    if (action.type === 'emit') {
      emitLocal(action.event ?? 'runtime:event', action.payload);

      if (action.onSuccess) await dispatch(action.onSuccess, options);
      return null;
    }

    if (action.type === 'navigate') {
      if (import.meta.client && action.url) {
        window.location.href = action.url;
      }

      if (action.onSuccess) await dispatch(action.onSuccess, options);
      return null;
    }

    if (action.type === 'upload') {
      try {
        const result = await runUploadAction(options.element, action);
        if (action.onSuccess) await dispatch(action.onSuccess, options);
        return result;
      } catch {
        if (action.onFailure) await dispatch(action.onFailure, options);
        return null;
      }
    }

    if (action.type === 'query') {
      const resolvedWhere = action.where
        ? resolveRuntimePayload(action.where, resolverContext(options.element.id)) as Record<string, unknown>
        : undefined;

      try {
        const result = await runQueryAction(options.element.id, {
          ...action,
          where: resolvedWhere as any,
        }, options.trigger);

        if (action.onSuccess) await dispatch(action.onSuccess, options);
        return result;
      } catch {
        if (action.onFailure) await dispatch(action.onFailure, options);
        return null;
      }
    }

    const ctx = resolverContext(options.element.id);
    const resolvedPayload = resolveRuntimePayload(action.payload, ctx);
    const resolvedRowId = resolveRuntimePayload(action.rowId, ctx);
    const resolvedWhere = action.where
      ? resolveRuntimePayload(action.where, ctx) as Record<string, unknown>
      : undefined;

    const runtimeAction: RuntimeActionDefinition = {
      ...action,
      rowId: resolvedRowId as any,
      where: resolvedWhere as any,
    };

    const envelope: RuntimeEventEnvelope = {
      inpoint_id: context.value.terminalId,
      business_id: context.value.businessId,
      element_id: options.element.id,
      trigger: options.trigger,
      action: runtimeAction,
      payload: resolvedPayload,
      timestamp: new Date().toISOString(),
    };

    const rollback = applyOptimisticMutation(runtimeAction, resolvedPayload);

    try {
      const result = await enqueue(envelope, rollback);
      if (action.onSuccess) await dispatch(action.onSuccess, options);
      return result;
    } catch {
      rollback();
      if (action.onFailure) await dispatch(action.onFailure, options);
      return null;
    }
  }

  async function triggerElement(element: ElementDef, trigger: EventTrigger) {
    const events = getElementEvents(element).filter((binding) => binding.trigger === trigger);
    for (const binding of events) {
      await dispatch(binding.action, { element, trigger });
    }
  }

  async function loadElement(element: ElementDef) {
    if (loadedElements.has(element.id)) return;
    loadedElements.add(element.id);

    const events = getElementEvents(element).filter((binding) => binding.trigger === 'load');
    if (events.length > 0) {
      for (const binding of events) {
        await dispatch(binding.action, { element, trigger: 'load' });
      }
      return;
    }

    if (element.type === 'table-view' && element.source !== 'audit-log' && element.tableName) {
        await runQueryAction(element.id, {
          type: 'query',
          source: element.source ?? 'business-table',
          table: element.tableName,
          columns: element.columns,
          orderBy: element.orderBy,
          descending: element.descending,
          targetElementId: element.id,
          limit: element.pageSize ?? 20,
          where: element.filters,
      }, 'load');
    }

    if (element.type === 'table-view' && element.source === 'audit-log') {
      await runQueryAction(element.id, {
        type: 'query',
        source: 'audit-log',
        columns: element.columns.length > 0
          ? element.columns
          : ['created_at', 'actor_name', 'action_type', 'target_table'],
        targetElementId: element.id,
        limit: element.pageSize ?? 20,
        where: element.filters,
      }, 'load');
    }

    if (element.type === 'chart') {
      const defaultColumns = [element.labelColumn, element.valueColumn]
        .filter((column): column is string => Boolean(column));

      await runQueryAction(element.id, {
        type: 'query',
        source: element.source ?? 'business-table',
        table: element.source === 'audit-log' ? undefined : element.tableName,
        columns: defaultColumns.length > 0
          ? Array.from(new Set([...defaultColumns, 'created_at']))
          : ['created_at'],
        targetElementId: element.id,
        limit: 100,
        where: element.filters,
      }, 'load');
    }

    if (element.type === 'cart-widget') {
      const cartElement = element as CartWidgetElementDef;
      if (cartElement.productTable) {
        await runQueryAction(element.id, {
          type: 'query',
          source: 'business-table',
          table: cartElement.productTable,
          columns: ['*'],
          targetElementId: element.id,
          limit: 100,
        }, 'load');
      }
    }
  }

  function isElementDisabled(element: ElementDef) {
    const events = getElementEvents(element);
    if (events.length === 0) return false;
    return events.some((binding) => !isActionAllowed(runtimeState.value.permissions, binding.action));
  }

  return {
    state: readonly(runtimeState),
    context: readonly(context),
    configure,
    reset,
    on,
    emitLocal,
    setInputValue,
    setCartValue,
    setSessionVar,
    dispatch,
    triggerElement,
    loadElement,
    reloadElement,
    isElementDisabled,
  };
}

export { CANVAS_RUNTIME_KEY };
