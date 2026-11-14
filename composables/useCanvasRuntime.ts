import type { TerminalPermissions } from '~/lib/permissions';
import { isActionAllowed, normalizePermissions } from '~/lib/permissions';
import { findCountry, formatCurrencyAmount } from '~/lib/currency';
import { evaluateSafeCondition, sanitizeNavigationUrl, sanitizeTextInput } from '~/lib/securityClient';
import {
  CANVAS_RUNTIME_KEY,
  resolveRuntimePathTemplate,
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
  targetedQueries: Record<string, { table?: string; timestamp: number }>;
  cart: unknown[];
  uploads: Record<string, string>;
  permissions: TerminalPermissions;
  activeModalId: string | null;
  sessionVars: Record<string, unknown>;
  lastError: { title: string; description: string } | null;
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

function getAllLayoutElements(targetLayout: UiLayout | null | undefined): ElementDef[] {
  if (!targetLayout) return [];
  return [
    ...(targetLayout.elements ?? []),
    ...((targetLayout.modals ?? []).flatMap((modal) => modal.elements ?? [])),
  ];
}

function collectReferencedInputKeys(value: unknown, keys = new Set<string>()): string[] {
  if (typeof value === 'string') {
    const matches = value.matchAll(/\$\$inputs?\.([A-Za-z0-9_.:-]+)/g);
    for (const match of matches) {
      if (match[1]) keys.add(match[1]);
    }
    return Array.from(keys);
  }
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedInputKeys(item, keys);
    return Array.from(keys);
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectReferencedInputKeys(item, keys);
    }
  }
  return Array.from(keys);
}

export function useCanvasRuntime() {
  const runtimeState = useState<RuntimeState>('kogane:runtime:state', () => ({
    inputs: {},
    queryResults: {},
    queryTables: {},
    targetedQueries: {},
    cart: [],
    uploads: {},
    permissions: normalizePermissions(),
    activeModalId: null,
    sessionVars: {},
    lastError: null,
  }));
  const context = useState<RuntimeContext>('kogane:runtime:context', () => ({
    terminalId: '',
    businessId: '',
    layout: null,
    sessionVars: {},
  }));
  const { enqueue } = useEventQueue();
  const { alert } = useModal();
  const { authHeaders } = useAuth();
  const realtimeSync = useRealtimeSync();

  function reset() {
    realtimeSync.disconnect();
    runtimeState.value = {
      inputs: {},
      queryResults: {},
      queryTables: {},
      targetedQueries: {},
      cart: [],
      uploads: {},
      permissions: normalizePermissions(),
      activeModalId: null,
      sessionVars: {},
      lastError: null,
    };
    loadedElements.clear();
    listeners.clear();
  }

  function clearError() {
    runtimeState.value.lastError = null;
  }

  async function clearTargetQuery(elementId: string) {
    delete runtimeState.value.targetedQueries[elementId];
    const target = getAllLayoutElements(context.value.layout).find((el) => el.id === elementId);
    if (target) {
      await reloadElement(target);
    }
  }

  function getEffectiveRole() {
    return (runtimeState.value.sessionVars?.terminalRole as string)
      || (runtimeState.value.sessionVars?.role as string)
      || (context.value.sessionVars?.terminalRole as string)
      || (context.value.sessionVars?.role as string)
      || undefined;
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
    const effectiveRole = (options.sessionVars?.terminalRole as string)
      || (options.sessionVars?.role as string)
      || undefined;
    runtimeState.value.permissions = normalizePermissions(options.permissions, effectiveRole);
    runtimeState.value.sessionVars = options.sessionVars ?? {};
    runtimeState.value.activeModalId = null;
    runtimeState.value.targetedQueries = {};
    runtimeState.value.lastError = null;
    loadedElements.clear();

    const matchesTable = (tName: string | undefined, mutTable: string) => {
      if (!tName || !mutTable) return false;
      return tName === mutTable || tName.endsWith(`_${mutTable}`) || mutTable.endsWith(`_${tName}`);
    };

    if (options.businessId) {
      realtimeSync.connect({
        businessId: options.businessId,
        terminalId: options.terminalId,
        onMutation: async (mutation) => {
          if (
            mutation.table === 'terminals'
            && (!mutation.recordId || String(mutation.recordId) === String(options.terminalId) || mutation.data?.terminalId === options.terminalId)
          ) {
            emitLocal('terminal:updated', mutation.data ?? mutation);
          }

          emitLocal('realtime:table-update', mutation);

          for (const el of getAllLayoutElements(context.value.layout)) {
            if (el.type === 'table-view' && runtimeState.value.targetedQueries[el.id]) continue;
            if (el.type === 'table-view' && matchesTable((el as any).tableName, mutation.table)) {
              await reloadElement(el);
            } else if (el.type === 'chart' && matchesTable((el as any).tableName, mutation.table)) {
              await reloadElement(el);
            } else if (el.type === 'cart-widget' && matchesTable((el as any).productTable ?? 'products', mutation.table)) {
              await reloadElement(el);
            }
          }
        },
        onReconnect: async () => {
          emitLocal('realtime:reconnected');
          emitLocal('terminal:updated', { reason: 'reconnect', terminalId: context.value.terminalId });

          for (const el of getAllLayoutElements(context.value.layout)) {
            if (el.type === 'table-view' && runtimeState.value.targetedQueries[el.id]) continue;
            if (el.type === 'table-view' || el.type === 'chart' || el.type === 'cart-widget') {
              await reloadElement(el);
            }
          }
        },
      });
    }
  }

  function isSharedFieldName(fieldName: string, elementId: string) {
    const matches = getAllLayoutElements(context.value.layout).filter(
      (el) => (el.type === 'input-field' || el.type === 'scan-field') && (el as any).fieldName === fieldName,
    );
    return matches.some((el) => el.id !== elementId);
  }

  function setInputValue(elementId: string, value: unknown, fieldName?: string) {
    const sanitized = typeof value === 'string'
      ? sanitizeTextInput(value, 2000, false)
      : value;
    runtimeState.value.inputs[elementId] = sanitized;
    if (fieldName && !isSharedFieldName(fieldName, elementId)) {
      runtimeState.value.inputs[fieldName] = sanitized;
    }
  }

  function setCartValue(items: unknown[]) {
    runtimeState.value.cart = Array.isArray(items) ? clone(items) : [];
  }

  function addToCart(item: { id: string | number; name?: string; price?: number; qty?: number; [key: string]: unknown }, quantity?: number) {
    const itemId = String(item.id);
    const current = (runtimeState.value.cart || []) as Array<{ id: string; name: string; price: number; qty: number; [key: string]: unknown }>;
    const next = current.map((i) => ({ ...i }));
    const existingIndex = next.findIndex((i) => String(i.id) === itemId);
    const itemQty = Number(item.qty);
    const rawQty = quantity !== undefined ? Number(quantity) : (Number.isFinite(itemQty) && itemQty > 0 ? itemQty : 1);
    const addQty = Math.max(1, Number.isFinite(rawQty) ? Math.floor(rawQty) : 1);

    if (existingIndex >= 0) {
      next[existingIndex] = {
        ...next[existingIndex],
        qty: (Number(next[existingIndex].qty) || 0) + addQty,
      };
    } else {
      next.push({
        ...item,
        id: itemId,
        name: String(item.name ?? itemId),
        price: Number(item.price || 0),
        qty: addQty,
      });
    }
    runtimeState.value.cart = next;
    return next;
  }

  function updateCartItemQty(id: string | number, qty: number) {
    const itemId = typeof id === 'object' && id !== null && 'id' in id ? String((id as any).id) : String(id);
    const targetQty = Math.floor(Number(qty));
    if (!Number.isFinite(targetQty) || targetQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    const current = (runtimeState.value.cart || []) as Array<{ id: string; name: string; price: number; qty: number; [key: string]: unknown }>;
    runtimeState.value.cart = current.map((item) => {
      if (String(item.id) === itemId) {
        return { ...item, qty: targetQty };
      }
      return { ...item };
    });
  }

  function removeFromCart(id: string | number | { id: string | number }) {
    const itemId = typeof id === 'object' && id !== null && 'id' in id ? String((id as any).id) : String(id);
    const current = (runtimeState.value.cart || []) as Array<{ id: string; [key: string]: unknown }>;
    runtimeState.value.cart = current.filter((item) => String(item.id) !== itemId);
  }

  function clearCart() {
    runtimeState.value.cart = [];
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

    if (eventName === 'cart:add' && payload && typeof payload === 'object') {
      addToCart(payload as any);
    }

    if (eventName === 'cart:remove' && payload) {
      const id = typeof payload === 'object' && payload !== null && 'id' in payload
        ? (payload as any).id
        : payload;
      removeFromCart(String(id));
    }

    if (eventName === 'cart:update-qty' && payload && typeof payload === 'object') {
      const { id, qty } = payload as { id: string | number; qty: number };
      if (id !== undefined && qty !== undefined) {
        updateCartItemQty(id, qty);
      }
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

    const headers: Record<string, string> = {
      ...authHeaders(),
    };
    if (context.value.terminalId) {
      headers['x-terminal-id'] = context.value.terminalId;
      if (typeof window !== 'undefined') {
        const storedToken = sessionStorage.getItem(`kogane_term_token_${context.value.terminalId}`);
        if (storedToken) {
          headers['x-terminal-session'] = storedToken;
        }
      }
    }

    const response = await $fetch<{ results: Array<{ ok: boolean; data?: unknown; error?: string | null }> }>(
      '/api/runtime/event',
      {
        method: 'POST',
        headers,
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
    if (action.table) {
      runtimeState.value.queryTables[targetElementId] = action.table;
    }
    return runtimeState.value.queryResults[targetElementId];
  }

  async function reloadElement(element: ElementDef, queryOverrides?: { offset?: number; limit?: number }) {
    loadedElements.delete(element.id);
    return loadElement(element, queryOverrides);
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
    const path = resolveRuntimePathTemplate(String(resolveRuntimePayload(action.path ?? `${element.id}/${file.name}`, {
      cart: runtimeState.value.cart,
      inputs: runtimeState.value.inputs,
      uploads: runtimeState.value.uploads,
      session: runtimeState.value.sessionVars,
      elementId: element.id,
    }) ?? `${element.id}/${file.name}`));

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

    const targetElementIds = new Set<string>();
    for (const [elementId, tableName] of Object.entries(runtimeState.value.queryTables)) {
      if (tableName === action.table || tableName.endsWith(`_${action.table}`) || Boolean(action.table?.endsWith(`_${tableName}`))) {
        targetElementIds.add(elementId);
      }
    }
    for (const el of getAllLayoutElements(context.value.layout)) {
      const elTable = (el as any).tableName;
      if (elTable === action.table || elTable?.endsWith(`_${action.table}`) || Boolean(action.table?.endsWith(`_${elTable}`))) {
        targetElementIds.add(el.id);
      }
    }

    for (const elementId of targetElementIds) {
      const rows = runtimeState.value.queryResults[elementId] ? [...runtimeState.value.queryResults[elementId]] : [];

      if (action.type === 'insert' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const itemPayload = { ...(payload as Record<string, unknown>) };
        const isProducts = action.table === 'products' || Boolean(action.table?.endsWith('_products'));
        if (isProducts) {
          if (itemPayload.available === undefined || itemPayload.available === null) {
            itemPayload.available = 1;
          } else {
            const av = itemPayload.available;
            itemPayload.available = (av === 1 || av === true || av === '1' || av === 'true') ? 1 : 0;
          }
          if (itemPayload.price != null) {
            const cleanPrice = String(itemPayload.price).trim().replace(/^[$\s]+/, '').replace(/,/g, '').trim();
            const num = Number(cleanPrice);
            if (!Number.isNaN(num) && Number.isFinite(num)) {
              itemPayload.price = num;
            }
          }
        }
        const optimisticRow = {
          id: `optimistic-${Date.now()}`,
          ...itemPayload,
        };
        runtimeState.value.queryResults[elementId] = [optimisticRow, ...rows];
      }

      if (action.type === 'update' && action.rowId) {
        runtimeState.value.queryResults[elementId] = rows.map((row) =>
          String(row.id ?? (row as any)._id ?? (row as any).reference ?? '') === String(action.rowId)
            ? { ...row, ...(payload as Record<string, unknown>) }
            : row,
        );
      }

      if (action.type === 'delete' && action.rowId) {
        runtimeState.value.queryResults[elementId] = rows.filter((row) =>
          String(row.id ?? (row as any)._id ?? (row as any).reference ?? '') !== String(action.rowId)
        );
      }
    }

    return () => {
      runtimeState.value.queryResults = previousQueries;
    };
  }

  function resolverContext(elementId?: string, row?: Record<string, unknown>): import('~/lib/runtime').RuntimeResolverContext {
    return {
      cart: runtimeState.value.cart,
      inputs: runtimeState.value.inputs,
      uploads: runtimeState.value.uploads,
      session: runtimeState.value.sessionVars,
      elementId,
      row,
    };
  }

  function evaluateCondition(condition: string | undefined): boolean {
    if (!condition || !condition.trim()) return true;
    const ctx = resolverContext();
    return evaluateSafeCondition(condition, {
      inputs: ctx.inputs,
      session: (ctx.session ?? {}) as Record<string, unknown>,
      cart: ctx.cart,
    });
  }

  function validateInsert(action: RuntimeActionDefinition, payload: unknown) {
    const isProducts = action.table === 'products' || Boolean(action.table?.endsWith('_products'));
    if (action.type !== 'insert' || !isProducts) return null;

    const values = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const name = String(values.name ?? '').trim();
    const rawPrice = String(values.price ?? '').trim().replace(/^[$\s]+/, '').replace(/,/g, '').trim();

    if (!name) return 'Add a product name before saving.';
    const numPrice = Number(rawPrice);
    if (!rawPrice || !Number.isFinite(numPrice) || numPrice < 0) {
      return 'Enter a valid price before saving.';
    }

    return null;
  }

  async function dispatch(action: RuntimeActionDefinition, options: {
    element: ElementDef;
    trigger: EventTrigger;
    row?: Record<string, unknown>;
  }) {
    const effectiveRole = getEffectiveRole();
    if (!isActionAllowed(runtimeState.value.permissions, action, effectiveRole)) {
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
      const resolvedEmitPayload = action.payload !== undefined
        ? resolveRuntimePayload(action.payload as any, resolverContext(options.element.id, options.row))
        : undefined;
      emitLocal(action.event ?? 'runtime:event', resolvedEmitPayload);

      if (action.onSuccess) await dispatch(action.onSuccess, options);
      return null;
    }

    if (action.type === 'navigate') {
      if (import.meta.client && action.url) {
        const safeUrl = sanitizeNavigationUrl(action.url);
        if (!safeUrl) {
          await alert({
            title: 'Blocked navigation',
            description: 'This URL scheme is not allowed for security reasons.',
            confirmLabel: 'Dismiss',
          });
          return null;
        }
        window.location.href = safeUrl;
      }

      if (action.onSuccess) await dispatch(action.onSuccess, options);
      return null;
    }

    if (action.type === 'upload') {
      try {
        runtimeState.value.lastError = null;
        const result = await runUploadAction(options.element, action);
        if (result && action.onSuccess) await dispatch(action.onSuccess, options);
        return result;
      } catch (err: any) {
        const description = err?.data?.error || err?.message || 'File upload failed. Please try again.';
        runtimeState.value.lastError = { title: 'Upload failed', description };
        emitLocal('runtime:error', runtimeState.value.lastError);
        if (action.onFailure) {
          await dispatch(action.onFailure, options);
        } else {
          await alert({
            title: 'Upload failed',
            description,
            confirmLabel: 'Dismiss',
          });
        }
        return null;
      }
    }

    if (action.type === 'query') {
      const ctx = resolverContext(options.element.id, options.row);
      const resolvedWhere = action.where
        ? resolveRuntimePayload(action.where, ctx) as Record<string, unknown>
        : undefined;

      try {
        runtimeState.value.lastError = null;
        const result = await runQueryAction(options.element.id, {
          ...action,
          where: resolvedWhere as any,
        }, options.trigger);

        if (action.targetElementId && action.targetElementId !== options.element.id) {
          runtimeState.value.targetedQueries[action.targetElementId] = {
            table: action.table,
            timestamp: Date.now(),
          };
        }

        if (action.onSuccess) await dispatch(action.onSuccess, options);
        return result;
      } catch (err: any) {
        const description = err?.data?.error || err?.message || 'Unable to query records from this table.';
        runtimeState.value.lastError = { title: 'Query failed', description };
        emitLocal('runtime:error', runtimeState.value.lastError);
        if (action.onFailure) {
          await dispatch(action.onFailure, options);
        } else if (options.trigger !== 'load') {
          await alert({
            title: 'Query failed',
            description,
            confirmLabel: 'Dismiss',
          });
        }
        return null;
      }
    }

    const ctx = resolverContext(options.element.id, options.row);
    const resolvedPayload = resolveRuntimePayload(action.payload, ctx);
    const resolvedRowId = resolveRuntimePayload(action.rowId, ctx);
    const resolvedWhere = action.where
      ? resolveRuntimePayload(action.where, ctx) as Record<string, unknown>
      : undefined;

    const validationMessage = validateInsert(action, resolvedPayload);
    if (validationMessage) {
      await alert({
        title: 'Check the product details',
        description: validationMessage,
        confirmLabel: 'Close',
      });
      return null;
    }

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

      if (action.type === 'insert') {
        const referencedInputs = collectReferencedInputKeys(action.payload);
        for (const key of referencedInputs) {
          runtimeState.value.inputs[key] = '';
        }
      }

      if ((action.type === 'insert' || action.type === 'update' || action.type === 'delete') && action.table) {
        const actionTable = action.table;
        const matchesActionTable = (tName: string | undefined, actTable: string) => {
          if (!tName || !actTable) return false;
          return tName === actTable || tName.endsWith(`_${actTable}`) || actTable.endsWith(`_${tName}`);
        };

        for (const el of getAllLayoutElements(context.value.layout)) {
          if (el.type === 'table-view' && runtimeState.value.targetedQueries[el.id]) continue;
          if (el.type === 'table-view' && matchesActionTable((el as any).tableName, actionTable)) {
            reloadElement(el).catch(() => {});
          } else if (el.type === 'cart-widget' && matchesActionTable((el as any).productTable ?? 'products', actionTable)) {
            reloadElement(el).catch(() => {});
          } else if (el.type === 'chart' && matchesActionTable((el as any).tableName, actionTable)) {
            reloadElement(el).catch(() => {});
          }
        }
      }

      if (action.onSuccess) await dispatch(action.onSuccess, options);
      return result;
    } catch {
      rollback();
      if (action.onFailure) await dispatch(action.onFailure, options);
      return null;
    }
  }

  async function triggerElement(
    element: ElementDef,
    trigger: EventTrigger,
    options?: { row?: Record<string, unknown> },
  ) {
    const events = getElementEvents(element).filter((binding) => binding.trigger === trigger);
    for (const binding of events) {
      await dispatch(binding.action, { element, trigger, row: options?.row });
    }
  }

  async function loadElement(element: ElementDef, queryOverrides?: { offset?: number; limit?: number }) {
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
      const queryColumns = element.columns.length > 0 && !element.columns.includes('*') && !element.columns.includes('id')
        ? ['id', ...element.columns]
        : element.columns;

      await runQueryAction(element.id, {
        type: 'query',
        source: element.source ?? 'business-table',
        table: element.tableName,
        columns: queryColumns,
        orderBy: element.orderBy,
        descending: element.descending,
        targetElementId: element.id,
        limit: queryOverrides?.limit ?? element.pageSize ?? 20,
        offset: queryOverrides?.offset ?? 0,
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
        limit: queryOverrides?.limit ?? element.pageSize ?? 20,
        offset: queryOverrides?.offset ?? 0,
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
        limit: queryOverrides?.limit ?? 100,
        offset: queryOverrides?.offset ?? 0,
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
          limit: queryOverrides?.limit ?? 100,
          offset: queryOverrides?.offset ?? 0,
        }, 'load');
      }
    }
  }

  function isElementDisabled(element: ElementDef) {
    const events = getElementEvents(element);
    if (events.length === 0) return false;
    const effectiveRole = getEffectiveRole();
    return events.some((binding) => !isActionAllowed(runtimeState.value.permissions, binding.action, effectiveRole));
  }

  function formatCurrency(amount: unknown) {
    const rawCountry = (runtimeState.value.sessionVars?.country as string)
      || (context.value.sessionVars?.country as string)
      || undefined;
    const rawCurrency = (runtimeState.value.sessionVars?.currency as string)
      || (context.value.sessionVars?.currency as string)
      || undefined;
    const rawSymbol = (runtimeState.value.sessionVars?.currencySymbol as string)
      || (context.value.sessionVars?.currencySymbol as string)
      || undefined;

    const matched = findCountry(rawCountry || rawCurrency || rawSymbol);
    const country = rawCountry || matched.code;
    const currency = rawCurrency || matched.currency;
    const symbol = rawSymbol || matched.symbol;
    const decimals = matched.decimals;

    return formatCurrencyAmount(amount, { symbol, currency, country, decimals });
  }

  return {
    state: readonly(runtimeState),
    context: readonly(context),
    formatCurrency,
    configure,
    reset,
    clearError,
    clearTargetQuery,
    on,
    emitLocal,
    setInputValue,
    setCartValue,
    addToCart,
    updateCartItemQty,
    removeFromCart,
    clearCart,
    setSessionVar,
    dispatch,
    triggerElement,
    loadElement,
    reloadElement,
    isElementDisabled,
    realtime: realtimeSync,
  };
}

export { CANVAS_RUNTIME_KEY };
