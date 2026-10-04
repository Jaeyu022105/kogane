export interface RealtimeTableMutation {
  type: 'table-mutation';
  table: string;
  action: 'insert' | 'update' | 'delete';
  recordId?: string | number | null;
  data?: Record<string, unknown> | null;
  timestamp: string;
}

export type RealtimeListener = (event: RealtimeTableMutation) => void;

class RealtimeHub {
  private listeners = new Map<string, Set<RealtimeListener>>();

  /**
   * Subscribe a listener for all real-time mutations occurring within a business workspace.
   * Returns an unsubscribe function.
   */
  subscribe(businessId: string, listener: RealtimeListener): () => void {
    if (!this.listeners.has(businessId)) {
      this.listeners.set(businessId, new Set());
    }
    const set = this.listeners.get(businessId)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(businessId);
      }
    };
  }

  /**
   * Publish a mutation event to all active streams for a business.
   */
  publish(businessId: string, mutation: {
    table: string;
    action: 'insert' | 'update' | 'delete';
    recordId?: string | number | null;
    data?: Record<string, unknown> | null;
    timestamp?: string;
  }): void {
    if (!businessId) return;
    const set = this.listeners.get(businessId);
    if (!set || set.size === 0) return;

    const event: RealtimeTableMutation = {
      type: 'table-mutation',
      table: mutation.table,
      action: mutation.action,
      recordId: mutation.recordId,
      data: mutation.data ?? null,
      timestamp: mutation.timestamp ?? new Date().toISOString(),
    };

    for (const listener of set) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[realtimeHub] listener error for business ${businessId}:`, err);
      }
    }
  }

  /**
   * Count active listeners for a business (useful for diagnostics & tests).
   */
  listenerCount(businessId: string): number {
    return this.listeners.get(businessId)?.size ?? 0;
  }

  /**
   * Clear all listeners (useful for test resets).
   */
  clear(): void {
    this.listeners.clear();
  }
}

export const realtimeHub = new RealtimeHub();
