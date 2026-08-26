type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub — the only glue between sim, render and UI. */
export class Bus<Events extends object> {
  private map = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(key: K, fn: Handler<Events[K]>): () => void {
    let set = this.map.get(key);
    if (!set) this.map.set(key, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof Events>(key: K, payload: Events[K]): void {
    const set = this.map.get(key);
    if (!set) return;
    for (const fn of Array.from(set)) (fn as Handler<Events[K]>)(payload);
  }
}
