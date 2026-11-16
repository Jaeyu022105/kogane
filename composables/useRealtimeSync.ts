import { ref, readonly } from 'vue';

export interface RealtimeTableMutation {
  type: 'table-mutation';
  table: string;
  action: 'insert' | 'update' | 'delete';
  recordId?: string | number | null;
  data?: Record<string, unknown> | null;
  timestamp: string;
}

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
export type MutationHandler = (mutation: RealtimeTableMutation) => void;

export function useRealtimeSync() {
  const isConnected = ref(false);
  const status = ref<RealtimeStatus>('idle');
  const lastMutation = ref<RealtimeTableMutation | null>(null);
  const error = ref<string | null>(null);

  let eventSource: EventSource | null = null;
  const handlers = new Set<MutationHandler>();
  let connectHandler: MutationHandler | null = null;
  let hasConnectedOnce = false;

  function onMutation(handler: MutationHandler) {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  function notify(mutation: RealtimeTableMutation) {
    lastMutation.value = mutation;
    for (const handler of handlers) {
      try {
        handler(mutation);
      } catch (err) {
        console.error('[useRealtimeSync] error in mutation handler:', err);
      }
    }
  }

  function connect(options: {
    businessId: string;
    terminalId?: string;
    slug?: string;
    onMutation?: MutationHandler;
    onReconnect?: () => void;
  }) {
    if (!import.meta.client) return;

    disconnect();
    hasConnectedOnce = false;

    if (options.onMutation) {
      connectHandler = options.onMutation;
      onMutation(options.onMutation);
    }

    if (!options.businessId && !options.terminalId && !options.slug) {
      status.value = 'error';
      error.value = 'Missing businessId, terminalId, or slug';
      return;
    }

    status.value = 'connecting';
    error.value = null;

    const query = new URLSearchParams();
    if (options.businessId) query.set('businessId', options.businessId);
    if (options.terminalId) query.set('terminalId', options.terminalId);
    if (options.slug) query.set('slug', options.slug);

    const streamUrl = `/api/realtime/stream?${query.toString()}`;

    try {
      eventSource = new EventSource(streamUrl);

      const markConnected = () => {
        const isReconnect = hasConnectedOnce && !isConnected.value;
        hasConnectedOnce = true;
        isConnected.value = true;
        status.value = 'connected';
        error.value = null;
        if (isReconnect) {
          options.onReconnect?.();
        }
      };

      eventSource.onopen = () => {
        markConnected();
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload?.type === 'connected') {
            markConnected();
          } else if (
            payload?.type === 'table-mutation'
            || payload?.type === 'terminal:updated'
            || payload?.type === 'terminal:layout'
            || payload?.table
          ) {
            notify({
              type: 'table-mutation',
              table: payload.table ?? 'terminals',
              action: payload.action ?? 'update',
              recordId: payload.recordId ?? payload.terminalId ?? null,
              data: payload.data ?? (payload.type !== 'table-mutation' ? payload : null),
              timestamp: payload.timestamp ?? new Date().toISOString(),
            });
          }
        } catch {
          // ignore non-json messages
        }
      };

      eventSource.onerror = () => {
        isConnected.value = false;
        status.value = 'error';
        error.value = 'Realtime connection interrupted; reconnecting...';
      };
    } catch (err) {
      status.value = 'error';
      error.value = (err as Error).message;
    }
  }

  function disconnect() {
    if (connectHandler) {
      handlers.delete(connectHandler);
      connectHandler = null;
    }

    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    isConnected.value = false;
    status.value = 'disconnected';
  }

  return {
    isConnected: readonly(isConnected),
    status: readonly(status),
    lastMutation: readonly(lastMutation),
    error: readonly(error),
    connect,
    disconnect,
    onMutation,
  };
}
