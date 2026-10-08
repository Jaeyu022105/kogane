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
  let supabaseChannel: any = null;
  const handlers = new Set<MutationHandler>();

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
  }) {
    if (!import.meta.client) return;

    disconnect();

    if (options.onMutation) {
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

      eventSource.onopen = () => {
        isConnected.value = true;
        status.value = 'connected';
        error.value = null;
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload?.type === 'connected') {
            isConnected.value = true;
            status.value = 'connected';
          } else if (payload?.type === 'table-mutation' || payload?.table) {
            notify(payload as RealtimeTableMutation);
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

    // Optional Supabase Realtime fallback/dual-sync if public credentials are configured
    try {
      const config = useRuntimeConfig();
      const supabaseUrl = config.public?.supabaseUrl;
      const supabaseAnonKey = config.public?.supabaseAnonKey;

      if (
        supabaseUrl &&
        supabaseAnonKey &&
        !supabaseUrl.includes('your-project') &&
        typeof window !== 'undefined'
      ) {
        import('@supabase/supabase-js').then(({ createClient }) => {
          const client = createClient(supabaseUrl, supabaseAnonKey, {
            realtime: { params: { eventsPerSecond: 10 } },
          });

          supabaseChannel = client
            .channel(`public:realtime:${options.businessId || 'any'}`)
            .on('postgres_changes', { event: '*', schema: '*', table: '*' }, (payload: any) => {
              notify({
                type: 'table-mutation',
                table: payload.table,
                action: (payload.eventType?.toLowerCase() ?? 'update') as any,
                recordId: payload.new?.id ?? payload.old?.id ?? null,
                data: payload.new ?? null,
                timestamp: new Date().toISOString(),
              });
            })
            .subscribe();
        }).catch(() => {
          // Supabase Realtime optional dependency error handled silently
        });
      }
    } catch {
      // Ignore Supabase Realtime setup if runtime config is inaccessible
    }
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    if (supabaseChannel) {
      try {
        supabaseChannel.unsubscribe?.();
      } catch { }
      supabaseChannel = null;
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
