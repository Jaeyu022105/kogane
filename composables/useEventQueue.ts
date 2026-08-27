import type { RuntimeEventEnvelope } from '~/lib/runtime';

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

function friendlySaveMessage(raw?: unknown) {
  const message = String(raw ?? '').toLowerCase();

  if (message.includes('duplicate') || message.includes('unique')) {
    return 'That item already exists. Try a different name or code.';
  }

  if (message.includes('required') || message.includes('not-null') || message.includes('null')) {
    return 'Some required information is missing. Check the form and try again.';
  }

  return 'We could not save that change. Check the information and try again.';
}

export function useEventQueue() {
  const { alert } = useModal();

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
      const response = await $fetch<{ results: Array<{ ok: boolean; data?: unknown; error?: string | null }> }>(
        '/api/runtime/event',
        {
          method: 'POST',
          body: {
            events: batch.map((item) => item.envelope),
          },
        },
      );

      const retryLater: QueuedRuntimeEvent[] = [];

      batch.forEach((item, index) => {
        const result = response.results[index];
        if (result?.ok) {
          item.resolve(result.data);
          return;
        }

        const nextRetryCount = item.retries + 1;
        if (nextRetryCount < MAX_RETRIES) {
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
      });

      if (retryLater.length > 0) {
        queue.value.unshift(...retryLater);
        scheduleFlush(2 ** retryLater[0].retries * FLUSH_INTERVAL_MS);
      } else if (queue.value.length > 0) {
        scheduleFlush();
      }

      if (lastFailure.value && retryLater.length === 0) {
        await alert({
          title: 'We could not save that change',
          description: lastFailure.value,
          confirmLabel: 'Dismiss',
        });
      }
    } catch (err) {
      const message = friendlySaveMessage((err as Error).message);
      const retryLater: QueuedRuntimeEvent[] = [];

      for (const item of batch) {
        const nextRetryCount = item.retries + 1;
        if (nextRetryCount < MAX_RETRIES) {
          retryLater.push({
            ...item,
            retries: nextRetryCount,
          });
        } else {
          item.rollback?.();
          item.reject(new Error(message));
          lastFailure.value = message;
        }
      }

      if (retryLater.length > 0) {
        queue.value.unshift(...retryLater);
        scheduleFlush(2 ** retryLater[0].retries * FLUSH_INTERVAL_MS);
      } else if (lastFailure.value) {
        await alert({
          title: 'We could not save that change',
          description: lastFailure.value,
          confirmLabel: 'Dismiss',
        });
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

      if (queue.value.length >= MAX_BATCH_SIZE) {
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
