/**
 * XueBaOS Event Bus — typed pub/sub for inter-app communication.
 * Lighter than Zustand, no external deps. EventTarget-based.
 */

type EventPayload = Record<string, unknown>;

// ── Event Types ───────────────────────────────────────────────
export interface OsEvents {
  'os:fact-captured': { fact: string; source: string; timestamp: number };
  'os:anchor-added': { anchorId: string; palaceId: string; concept: string };
  'os:window-opened': { appId: string; windowId: string };
  'os:window-closed': { appId: string; windowId: string };
  'os:window-focused': { appId: string; windowId: string };
  'os:theme-changed': { theme: 'light' | 'dark' | 'sepia' };
  'os:review-due': { count: number; nextDueAt: number };
}

type Listener<T = EventPayload> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  /**
   * Register a listener for a typed event.
   * Returns an unsubscribe function.
   */
  on<K extends keyof OsEvents>(event: K, callback: Listener<OsEvents[K]>): () => void;
  on(event: string, callback: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => this.off(event as keyof OsEvents, callback as any);
  }

  /**
   * Remove a specific listener.
   */
  off<K extends keyof OsEvents>(event: K, callback: Listener<OsEvents[K]>): void;
  off(event: string, callback: Listener): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit a typed event to all listeners.
   */
  emit<K extends keyof OsEvents>(event: K, payload: OsEvents[K]): void {
    // Fire all listeners for exact match
    this.listeners.get(event as string)?.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(`[eventBus] error in ${event} listener:`, e); }
    });

    // Also fire wildcard listeners
    this.listeners.get('*')?.forEach((fn) => {
      try { fn({ event, payload }); } catch (e) { console.error(`[eventBus] error in wildcard listener:`, e); }
    });
  }

  /**
   * Listen to all events (wildcard).
   */
  onAll(callback: Listener<{ event: string; payload: EventPayload }>): () => void {
    return this.on('*' as keyof OsEvents, callback as any);
  }

  /**
   * Clear all listeners for an event or entirely.
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Singleton export
export const eventBus = new EventBus();
