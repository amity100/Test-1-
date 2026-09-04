export type Listener<T> = (payload: T) => void;

/** Minimal typed event emitter. */
export class Emitter<E extends Record<string, unknown>> {
  private listeners = new Map<keyof E, Set<Listener<never>>>();

  on<K extends keyof E>(event: K, fn: Listener<E[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<never>);
    return () => this.off(event, fn);
  }

  once<K extends keyof E>(event: K, fn: Listener<E[K]>): () => void {
    const off = this.on(event, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof E>(event: K, fn: Listener<E[K]>): void {
    this.listeners.get(event)?.delete(fn as Listener<never>);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      (fn as Listener<E[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
