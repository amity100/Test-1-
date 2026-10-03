/**
 * BOOT PROFILE (load1): a timeline of the boot — every step's start and duration (performance.now() ms since the
 * navigation start) plus named instants (the start screen, the start click, the first film frame, each film set ready).
 * Also written as User Timing entries ('boot:<name>') so a DevTools / CDP trace shows them. window.__boot exposes it in
 * every build (a few hundred bytes; the loading wave's before/after table reads it).
 */
export interface BootEntry {
  name: string;
  /** ms since the navigation start */
  start: number;
  ms: number;
}

export const bootLog = {
  steps: [] as BootEntry[],
  marks: {} as Record<string, number>,
};

/** a named instant of the boot (first one wins unless `again`) */
export function bootMark(name: string, again = false) {
  if (!again && bootLog.marks[name] !== undefined) return;
  bootLog.marks[name] = Math.round(performance.now());
  try {
    performance.mark('boot:' + name);
  } catch {
    /* old browsers */
  }
}

function record(name: string, t0: number) {
  const ms = performance.now() - t0;
  bootLog.steps.push({ name, start: Math.round(t0), ms: Math.round(ms) });
  try {
    performance.measure('boot:' + name, { start: t0, duration: ms });
  } catch {
    /* old browsers */
  }
}

/** time an async (or sync) boot step */
export async function bootStep<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    record(name, t0);
  }
}

/** time a synchronous step */
export function bootSync<T>(name: string, fn: () => T): T {
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    record(name, t0);
  }
}
