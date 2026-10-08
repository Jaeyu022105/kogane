import { ref, readonly } from 'vue';
import type { RuntimeEventEnvelope } from '~/lib/runtime';
import { useAuth } from '~/composables/useAuth';

interface QueuedRuntimeEvent {
  envelope: RuntimeEventEnvelope;
  retries: number;
  rollback?: () => void;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

const MAX_BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const FLUSH_INTERVAL_MS = 500;

const queue = ref<QueuedRuntimeEvent[]>([]);
const flushing = ref(false);
const lastFailure = ref<string | null>(null);
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function friendlySaveMessage(raw?: unknown) {
  const message = String(raw ?? '').toLowerCase();

  if (message.includes('forbidden') || message.includes('not allowed') || message.includes('denied')) {
    return 'You do not have permission to make this change on this terminal.';
  }

  if (
    message.includes('session does not match') ||
    message.includes('session expired') ||
    message.includes('invalid session') ||
    message.includes('missing terminal session') ||
    message.includes('missing session') ||
    message.includes('terminal session') ||
    message.includes('401')
  ) {
    return 'Your terminal session has expired. Please sign in again.';
  }

  if (message.includes('duplicate') || message.includes('unique')) {
    return 'That item already exists. Try a different name or code.';
  }

  if (
    message.includes('required') ||
    message.includes('not-null') ||
    message.includes('not null') ||
    message.includes('null')
  ) {
    return 'Some required information is missing. Check the form and try again.';
  }

  if (message.includes('network') || message.includes('failed to fetch') || message.includes('connection')) {
    return 'Network connection issue. Please check your connection and try again.';
  }

  return 'We could not save that change. Check the information and try again.';
}

export function useEventQueue() {
  const { alert } = useModal();
  const { authHeaders } = useAuth();

  function scheduleFlush(delay = FLUSH_INTERVAL_MS) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush().catch(() => {});
    }, delay);
  }

  async function flush() {
    if (flushing.value || queue.value.length === 0) return;
    flushing.value = true;

    const batch = queue.value.splice(0, MAX_BATCH_SIZE);

    try {
      const headers: Record<string, string> = {
        ...authHeaders(),
      };
      const terminalId = batch[0]?.envelope?.inpoint_id;
      if (terminalId) {
        headers['x-terminal-id'] = terminalId;
        if (typeof window !== 'undefined') {
          const storedToken = sessionStorage.getItem(`kogane_term_token_${terminalId}`);
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
          body: {
            events: batch.map((item) => item.envelope),
          },
        },
      );

      const retryLater: QueuedRuntimeEvent[] = [];
      let failureToAlert: string | null = null;

      batch.forEach((item, index) => {
        const result = response.results[index];
        if (result?.ok) {
          item.resolve(result.data);
          return;
        }

        const isPermanent = result?.error && (
          result.error.toLowerCase().includes('forbidden') ||
          result.error.toLowerCase().includes('required') ||
          result.error.toLowerCase().includes('null') ||
          result.error.toLowerCase().includes('unique') ||
          result.error.toLowerCase().includes('duplicate') ||
          result.error.toLowerCase().includes('not allowed')
        );

        const nextRetryCount = item.retries + 1;
        if (!isPermanent && nextRetryCount < MAX_RETRIES) {
          retryLater.push({
            ...item,
            retries: nextRetryCount,
          });
          return;
        }

        item.rollback?.();
        const message = friendlySaveMessage(result?.error);
        item.reject(new Error(message));
        lastFailure.value = message;
        failureToAlert = message;
      });

      if (retryLater.length > 0) {
        queue.value.unshift(...retryLater);
        scheduleFlush(2 ** retryLater[0].retries * FLUSH_INTERVAL_MS);
      } else if (queue.value.length > 0) {
        scheduleFlush();
      }

      if (failureToAlert && retryLater.length === 0) {
        await alert({
          title: 'We could not save that change',
          description: failureToAlert,
          confirmLabel: 'Dismiss',
        });
        lastFailure.value = null;
      }
    } catch (err) {
      const message = friendlySaveMessage((err as Error).message);
      const isPermanent = message.includes('expired') || message.includes('permission');
      const retryLater: QueuedRuntimeEvent[] = [];
      let failureToAlert: string | null = null;

      for (const item of batch) {
        const nextRetryCount = item.retries + 1;
        if (!isPermanent && nextRetryCount < MAX_RETRIES) {
          retryLater.push({
            ...item,
            retries: nextRetryCount,
          });
        } else {
          item.rollback?.();
          item.reject(new Error(message));
          lastFailure.value = message;
          failureToAlert = message;
        }
      }

      if (retryLater.length > 0) {
        queue.value.unshift(...retryLater);
        scheduleFlush(2 ** retryLater[0].retries * FLUSH_INTERVAL_MS);
      } else if (failureToAlert) {
        await alert({
          title: 'We could not save that change',
          description: failureToAlert,
          confirmLabel: 'Dismiss',
        });
        lastFailure.value = null;
      }
    } finally {
      flushing.value = false;
    }
  }

  function enqueue(envelope: RuntimeEventEnvelope, rollback?: () => void) {
    return new Promise<unknown>((resolve, reject) => {
      queue.value.push({
        envelope,
        rollback,
        retries: 0,
        resolve,
        reject,
      });

      const actionType = envelope.action?.type;
      if (actionType === 'update' || actionType === 'delete' || queue.value.length >= MAX_BATCH_SIZE) {
        flush().catch(() => {});
      } else {
        scheduleFlush();
      }
    });
  }

  return {
    queue: readonly(queue),
    flushing: readonly(flushing),
    lastFailure: readonly(lastFailure),
    enqueue,
    flush,
  };
}
