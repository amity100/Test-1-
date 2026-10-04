/**
 * COOPERATIVE SLICING of long BUILD loops (load1, wave 4b). The film's background builder (FilmSchedule) installs a
 * slicer while a set builds; deep loops of the build code (a garment's per-vertex skinning, the hair's distance field
 * and strands, the land shading rows, the crowds' bakes) ask it now and then:
 *
 *   if (slice.due()) await slice.pause();
 *
 * `due()` is a clock comparison (cheap enough for every few vertices); `pause()` gives the browser a frame while the
 * film plays (or a macrotask while the start screen covers the picture). With no slicer installed (David at boot,
 * tools, tests) `due()` is always false: the code runs straight through, exactly as before. The loops themselves are
 * unchanged — the same operations in the same order — so every result is identical; only other tasks (the film's
 * frames) run in between.
 */
export interface Slicer {
  /** has the current slice used its main-thread budget? */
  due(): boolean;
  /** yield (a frame under the film, a macrotask behind a cover) and start a new slice */
  pause(): Promise<void>;
}

const never: Slicer = { due: () => false, pause: () => Promise.resolve() };
let current: Slicer = never;

export const slice = {
  due: (): boolean => current.due(),
  pause: (): Promise<void> => current.pause(),
  /** install (or with null remove) the active slicer: one builder at a time (FilmSchedule runs its jobs in sequence) */
  set(s: Slicer | null) {
    current = s ?? never;
  },
  get active(): boolean {
    return current !== never;
  },
};

/**
 * Drive a generator that yields at its own check points: synchronously to completion (no slicer), or with a pause each
 * time the slice is due. The generator decides where it may stop; the result is the generator's return value.
 */
export async function runSliced<T>(gen: Generator<unknown, T, void>): Promise<T> {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
    if (slice.due()) await slice.pause();
  }
}

/**
 * the value a string-labelled step generator (LandSet's build) yields for a slice pause inside one of its steps: its
 * driver pauses (slice.pause) without counting a step; yielded only when `slice.due()`
 */
export const SLICE_STEP = '\u0000slice';

/**
 * inside a string-labelled step generator: run a void step generator (e.g. SkySystem.setSunSteps) and yield SLICE_STEP
 * at its check points when the slice is due
 */
export function* sliceMarks(gen: Generator<unknown, void, void>): Generator<string, void, void> {
  for (let r = gen.next(); !r.done; r = gen.next()) if (slice.due()) yield SLICE_STEP;
}

/** the same generator, run straight through (sync callers) */
export function runSync<T>(gen: Generator<unknown, T, void>): T {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}
