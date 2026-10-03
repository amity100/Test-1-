import type { Engine } from '../core/Engine';
import { FilmStage, USED_SETS, type FilmStageOptions, type FilmStageSet } from './FilmStage';
import { shotStarts } from '../content/introScript';
import { TAKE_OFFSET } from './FilmCams';
import { bootMark } from '../core/bootProfile';

/**
 * THE PROGRESSIVE START (load1, CUT v5): the film's sets are built by ONE background builder, in the order of their
 * deadlines, while the start screen is up and while the prologue plays —
 *
 *   judah (P1)              before the start screen (the film opens on it)
 *   map (P4, film 24.0)     coast (P6, 46.0)     ramah (P7, 53.0)     gilgal (G1's pre-roll, 59.5)
 *
 * Two modes. COVERED (the loading / start screen or a black card covers the canvas): every builder step runs back to
 * back and a set is pre-compiled on the canvas (FilmStage.precompileSet: the full first-frame warm-up, what the old
 * loading did). FILM (the picture is on screen): builder steps are packed into frame-budgeted slices (a frame is awaited
 * once a slice has used its budget) and a set is prepared off the canvas (FilmStage.prepareSet → Engine.prepareView:
 * parallel program compiles, uploads into a scratch target, in slices). The start click is held (the start screen
 * stays, its bar running) until every later set is PREDICTED ready before its first shot with a margin: the prediction
 * scales each set's measured relative cost (REL_COST) by this device's measured speed on the sets built so far, and the
 * film-mode throughput (FILM_SHARE of the wall clock). If a set still falls behind during the film the slices grow
 * (urgent); the player's own fallback (a world vista for a missing set) stays the last resort.
 *
 *   const sched = FilmSchedule.start(engine, opts);   await sched.ready('judah');
 *   await sched.waitForStart((f) => bar(f));          // the click: hold until it is safe, then
 *   await sched.enterFilm(() => intro.t);             // no canvas pre-compile from here on
 *   sched.stop()                                       // the film is over / skipped: stop building (Intro.release)
 */
export type SetState = 'queued' | 'building' | 'compiling' | 'ready' | 'failed' | 'skipped';
/** a job of the builder: a film set, or 'world' — the game world's first-frame warm-up when the boot left it out */
export type FilmJob = FilmStageSet | 'world';

export interface FilmScheduleOptions extends FilmStageOptions {
  /**
   * the game world's first-frame warm-up, moved off the critical path (main.ts, when no benchmark needs it): run first,
   * on the canvas while covered, else off the canvas in slices — before the film's first shot in the world (P2)
   */
  primeWorld?: (covered: () => boolean, slice: { budgetMs: number; yieldFrame: () => Promise<void> }) => Promise<void>;
}

/**
 * Each set's cost relative to judah (build + pre-compile, covered), measured by load1 on the shared SwiftShader box
 * (mobile-low / desktop-high; see the report). Only ratios are used: the device's own speed scales them.
 */
const REL_COST: Record<'desktop' | 'mobile', Record<FilmJob, number>> = {
  desktop: { world: 1.0, judah: 1, map: 0.34, coast: 0.6, ramah: 3.6, gilgal: 4.1 },
  mobile: { world: 1.4, judah: 1, map: 0.31, coast: 0.71, ramah: 2.1, gilgal: 2.75 },
};
/** share of the wall clock the background builder gets while the film plays (frame-budgeted slices) */
const FILM_SHARE = 0.35;
/** a set must be predicted ready this many seconds (and this fraction) before its deadline */
const MARGIN_S = 3;
const MARGIN_F = 0.8;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const macrotask = () => new Promise<void>((r) => setTimeout(r, 0));

export class FilmSchedule {
  readonly stage: FilmStage;
  readonly order: FilmJob[];
  /** film time (s) by which each set must be built and prepared */
  readonly deadline: Partial<Record<FilmJob, number>> = {};
  readonly state: Partial<Record<FilmJob, SetState>> = {};
  /** wall-clock ms of each set (build, prepare, mode) for the report */
  readonly times: Partial<Record<FilmJob, { build: number; prep: number; covered: boolean; readyAt: number }>> = {};
  private readonly done: Partial<Record<FilmJob, Promise<void>>> = {};
  private readonly resolve: Partial<Record<FilmJob, () => void>> = {};
  private readonly progressOf: Partial<Record<FilmJob, number>> = {};
  private covered = true;
  private stopped = false;
  private urgent = false;
  private canvasBusy: Promise<void> | null = null;
  private sliceT = 0;
  private filmClock: (() => number) | null = null;
  /** the set being built / prepared */
  private current: FilmJob | null = null;
  private readonly primeWorld: FilmScheduleOptions['primeWorld'];
  /** film mode: the main-thread time of each background slice (what the builder costs a frame) */
  readonly slices = { n: 0, maxMs: 0, over16: 0, over50: 0, over100: 0, top: [] as { set: string; ms: number }[] };
  private readonly rel: Record<FilmJob, number>;
  /** this device's ms per unit of REL_COST (from the sets built so far, covered mode) */
  private unitMs = 0;
  /**
   * test only (?holdscale=0.1): predict as for a device that many times this one's build time — with the harness pacing
   * the film clock at the same factor, a slow software-GPU box plays the timeline of a 10x faster device
   */
  private readonly holdScale: number;
  private readonly budgetMs: number;

  private constructor(
    private readonly engine: Engine,
    opts: FilmScheduleOptions,
  ) {
    this.budgetMs = engine.quality.mobile ? 5 : 7;
    const hs = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('holdscale')) : NaN;
    this.holdScale = Number.isFinite(hs) && hs > 0 ? hs : 1;
    const { primeWorld, ...stageOpts } = opts;
    this.primeWorld = primeWorld;
    this.stage = FilmStage.create(engine, { ...stageOpts, yieldFrame: () => this.yieldSlice() });
    this.rel = REL_COST[engine.quality.mobile ? 'mobile' : 'desktop'];
    const starts = shotStarts();
    const only = this.stage.wantedSets();
    for (const p of starts) {
      const n = p.shot.set as FilmStageSet;
      if (!USED_SETS.has(n) || !only.includes(n) || this.deadline[n] !== undefined) continue;
      // a set must be ready when its first shot starts (a dissolve shows it from the cut); Gilgal earlier by its pre-roll
      this.deadline[n] = Math.max(0, p.start - (TAKE_OFFSET[p.shot.take] ?? 0));
    }
    const firstWorld = starts.find((p) => p.shot.set === 'world');
    if (primeWorld) this.deadline.world = firstWorld ? firstWorld.start : 0;
    this.order = (Object.keys(this.deadline) as FilmJob[]).sort((a, b) => this.deadline[a]! - this.deadline[b]!);
    for (const n of this.order) {
      this.state[n] = 'queued';
      this.progressOf[n] = 0;
      this.done[n] = new Promise<void>((r) => (this.resolve[n] = r));
    }
  }

  /** create the stage and start building (in deadline order) */
  static start(engine: Engine, opts: FilmScheduleOptions = {}): FilmSchedule {
    const s = new FilmSchedule(engine, opts);
    void s.run();
    return s;
  }

  /** resolves when the set is built and prepared (or failed / skipped: the player falls back to a world vista) */
  ready(name: FilmJob): Promise<void> {
    return this.done[name] ?? Promise.resolve();
  }

  /** the sets needed in the film's first seconds (before any background work could finish): judah */
  firstSets(): FilmJob[] {
    return this.order.filter((n) => n !== 'world' && this.deadline[n]! < 8);
  }

  states(): Partial<Record<FilmJob, SetState>> {
    return { ...this.state };
  }

  /** 0..1 progress of a set list (the loading bar) */
  progress(names: readonly FilmJob[] = this.order): number {
    let w = 0, d = 0;
    for (const n of names) {
      const r = this.rel[n] ?? 1;
      w += r;
      const st = this.state[n];
      d += r * (st === 'ready' || st === 'failed' || st === 'skipped' ? 1 : st === 'compiling' ? 0.7 + 0.3 * (this.progressOf[n] ?? 0) : st === 'building' ? 0.7 * (this.progressOf[n] ?? 0) : 0);
    }
    return w > 0 ? d / w : 1;
  }

  /**
   * Seconds the film start must still wait on this device (0 = safe now): for every set not ready yet, its predicted
   * ready time if the film started now (the remaining work in deadline order, at FILM_SHARE of the wall clock) must lie
   * MARGIN before its deadline. Before any set has been measured the answer is "not yet".
   */
  startWait(): number {
    if (this.unitMs <= 0) return Infinity;
    let cum = 0, wait = 0;
    for (const n of this.order) {
      const st = this.state[n];
      if (st === 'ready' || st === 'failed' || st === 'skipped') continue;
      const p = st === 'compiling' ? 0.7 + 0.3 * (this.progressOf[n] ?? 0) : st === 'building' ? 0.7 * (this.progressOf[n] ?? 0) : 0;
      const remain = ((this.rel[n] ?? 1) * (1 - p) * this.unitMs * this.holdScale) / 1000;
      cum += remain / FILM_SHARE;
      const limit = Math.min(this.deadline[n]! * MARGIN_F, this.deadline[n]! - MARGIN_S);
      // covered (holding) runs at full speed: the excess shrinks by FILM_SHARE of the remaining-work estimate per second
      if (cum > limit) wait = Math.max(wait, ((cum - limit) * FILM_SHARE) / this.holdScale);
    }
    return wait;
  }

  /**
   * The start click: hold (the caller keeps its cover up and shows `onProgress`) until the later sets are predicted
   * ready in time, building at full speed meanwhile. Resolves at once on a fast device.
   */
  async waitForStart(onProgress?: (f: number) => void): Promise<void> {
    this.covered = true;
    const first = this.startWait();
    for (;;) {
      if (this.stopped) return;
      const w = this.startWait();
      if (w <= 0) break;
      if (Number.isFinite(first) && first > 0) onProgress?.(Math.max(0, Math.min(0.99, 1 - w / first)));
      else onProgress?.(this.progress());
      await new Promise<void>((r) => setTimeout(r, 200));
    }
    onProgress?.(1);
  }

  /** the picture goes on screen: wait for a canvas pre-compile in progress, then only off-canvas work, in slices */
  async enterFilm(filmClock?: () => number): Promise<void> {
    this.covered = false;
    if (filmClock) this.filmClock = filmClock;
    while (this.canvasBusy) await this.canvasBusy;
    this.covered = false;
  }

  /** stop building (the film was skipped or is over); the stage's own dispose frees what was built */
  stop() {
    this.stopped = true;
    for (const n of this.order) {
      if (this.state[n] === 'queued') this.state[n] = 'skipped';
      this.resolve[n]?.();
    }
  }

  report() {
    return { order: this.order, deadline: this.deadline, state: this.state, times: this.times, unitMs: Math.round(this.unitMs), startWait: this.startWait(), slices: this.slices, stats: this.stage.buildStats };
  }

  // ------------------------------------------------------------------------------------------ the builder
  /** a builder step's yield: back-to-back while covered, a frame once a slice has used its budget while the film plays */
  private async yieldSlice(): Promise<void> {
    if (this.covered) return macrotask();
    const now = performance.now();
    if (this.current && this.filmClock) this.urgent = this.filmClock() > this.deadline[this.current]! - 8;
    if (now - this.sliceT < (this.urgent ? this.budgetMs * 4 : this.budgetMs)) return;
    this.noteSlice(now - this.sliceT);
    await nextFrame();
    this.sliceT = performance.now();
  }

  private noteSlice(ms: number) {
    const s = this.slices;
    s.n++;
    s.maxMs = Math.max(s.maxMs, Math.round(ms));
    if (ms > 16) s.over16++;
    if (ms > 50) s.over50++;
    if (ms > 100) s.over100++;
    if (ms > 16) {
      s.top.push({ set: this.current ?? '?', ms: Math.round(ms) });
      s.top.sort((a, b) => b.ms - a.ms);
      s.top.length = Math.min(s.top.length, 12);
    }
  }

  private async run() {
    let unitsDone = 0, msDone = 0;
    // the first sets (judah) before anything else: the start screen waits for them; then the rest by deadline
    const first = this.firstSets();
    const order = [...first, ...this.order.filter((n) => !first.includes(n))];
    for (const n of order) {
      if (this.stopped) break;
      // a set whose shots the film has already passed is not built any more (a late device; tests seeking ahead)
      const clock = this.filmClock?.();
      if (clock !== undefined && clock > this.deadline[n]! + 30) {
        this.state[n] = 'skipped';
        this.resolve[n]?.();
        continue;
      }
      if (!this.covered) {
        await nextFrame();
        this.sliceT = performance.now();
      }
      const t0 = performance.now();
      const covered0 = this.covered;
      this.state[n] = 'building';
      this.current = n;
      if (n === 'world') {
        // the game world's first-frame warm-up (no build: the world is built at boot)
        this.state[n] = 'compiling';
        // sliced in both modes (the start screen stays responsive): covered = bigger slices, a macrotask between them
        await this.primeWorld!(() => this.covered, { budgetMs: this.covered ? 40 : this.budgetMs, yieldFrame: () => this.frameYield() }).catch((e) => console.warn('[film] world prime', e));
        const t2w = performance.now();
        this.times[n] = { build: 0, prep: Math.round(t2w - t0), covered: covered0 && this.covered, readyAt: Math.round(t2w) };
        this.state[n] = 'ready';
        this.progressOf[n] = 1;
        bootMark('job:world');
        this.resolve[n]?.();
        continue;
      }
      const h = await this.stage.buildSet(n, (f) => (this.progressOf[n] = f));
      const t1 = performance.now();
      if (!h || this.stopped) {
        // stopped while it was building (the film was skipped / is over): free it at once
        if (h && this.stopped) this.stage.release(n);
        this.state[n] = this.stopped ? 'skipped' : 'failed';
        this.resolve[n]?.();
        continue;
      }
      this.state[n] = 'compiling';
      this.progressOf[n] = 0;
      if (this.covered) {
        // behind the loading / start screen: programs and uploads in slices first (the start screen stays responsive),
        // then — if the picture is still covered — the full warm-up on the canvas (a click waits for it: enterFilm)
        await this.stage.prepareSet(n, { budgetMs: 40, yieldFrame: () => this.frameYield() });
        if (this.covered) {
          const p = this.stage.precompileSet(n);
          this.canvasBusy = p;
          await p;
          this.canvasBusy = null;
        }
      } else {
        this.watchDeadline(n);
        await this.stage.prepareSet(n, { budgetMs: this.budgetMs, yieldFrame: () => this.frameYield() });
      }
      const t2 = performance.now();
      this.times[n] = { build: Math.round(t1 - t0), prep: Math.round(t2 - t1), covered: covered0 && this.covered, readyAt: Math.round(t2) };
      // the device's speed: measured in covered mode only (the film-mode wall clock is mostly the film's own frames)
      if (covered0 && this.covered) {
        unitsDone += this.rel[n] ?? 1;
        msDone += t2 - t0;
        this.unitMs = msDone / unitsDone;
      } else if (this.unitMs <= 0) this.unitMs = ((t2 - t0) * FILM_SHARE) / (this.rel[n] ?? 1);
      this.state[n] = 'ready';
      this.progressOf[n] = 1;
      bootMark('set:' + n);
      this.resolve[n]?.();
      // the start screen comes up the moment the first sets are ready (its continuation runs before the next job)
      if (first.includes(n)) await macrotask();
    }
    this.current = null;
    this.urgent = false;
  }

  /** a prepare slice's yield (same budget rule as the builder's) */
  private async frameYield(): Promise<void> {
    if (this.covered) return macrotask();
    this.noteSlice(performance.now() - this.sliceT);
    await nextFrame();
    this.sliceT = performance.now();
  }

  /** film mode: the slices grow if the set being prepared is close to its deadline on the film clock */
  private watchDeadline(n: FilmJob) {
    const t = this.filmClock?.();
    this.urgent = t !== undefined && t > this.deadline[n]! - 8;
  }

  /** for the report: is every set built and prepared (or given up)? */
  get settled(): boolean {
    return this.order.every((n) => this.state[n] !== 'queued' && this.state[n] !== 'building' && this.state[n] !== 'compiling');
  }
}
