import type { Engine } from '../core/Engine';
import { FilmStage, USED_SETS, type FilmStageOptions, type FilmStageSet } from './FilmStage';
import { shotStarts } from '../content/introScript';
import { TAKE_OFFSET } from './FilmCams';
import { bootMark } from '../core/bootProfile';
import { slice, type Slicer } from '../core/slice';

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
export type SetState = 'queued' | 'building' | 'built' | 'compiling' | 'ready' | 'failed' | 'skipped';
/** a job of the builder: a film set, or 'world' — the game world's first-frame warm-up when the boot left it out */
export type FilmJob = FilmStageSet | 'world';

export interface FilmScheduleOptions extends FilmStageOptions {
  /**
   * the game world's first-frame warm-up, moved off the critical path (main.ts, when no benchmark needs it): run first,
   * on the canvas while covered, else off the canvas in slices — before the film's first shot in the world (P2)
   */
  primeWorld?: (covered: () => boolean, slice: { budgetMs: () => number; yieldFrame: () => Promise<void> }) => Promise<void>;
}

/**
 * Each set's cost relative to judah (build + pre-compile, covered), measured by load1 on the shared SwiftShader box
 * (mobile-low / desktop-high; see the report). Only ratios are used: the device's own speed scales them.
 */
const REL_COST: Record<'desktop' | 'mobile', Record<FilmJob, number>> = {
  // desktop-high 1280x720: judah 16.0 + 85.0 s, world prime 88 s, map 1.0 + 46.8, coast 3.7 + 33.0, ramah 54.5 + 107.1,
  // gilgal 48.2 + 190.7 (build + pre-compile); mobile-low 390x844: judah 6.7 + 10.2, world 24.3, map 0.9 + 8.7,
  // coast 4.9 + 8.5, ramah 21.6 + 24.2, gilgal 11.2 + 48.3
  desktop: { world: 0.87, judah: 1, map: 0.47, coast: 0.36, ramah: 1.6, gilgal: 2.37 },
  mobile: { world: 1.44, judah: 1, map: 0.57, coast: 0.79, ramah: 2.7, gilgal: 3.5 },
};
/** the share of each set's cost that is its BUILD (the rest: its pre-compile / prepare), measured as above */
const BUILD_SHARE: Record<'desktop' | 'mobile', Record<FilmJob, number>> = {
  desktop: { world: 0, judah: 0.16, map: 0.02, coast: 0.1, ramah: 0.34, gilgal: 0.2 },
  mobile: { world: 0, judah: 0.4, map: 0.1, coast: 0.37, ramah: 0.47, gilgal: 0.19 },
};
/**
 * The sets with the big builds (the cast's FilmActors and crowds, the coast's terrain shading). Since wave 4b their
 * long loops run in slices (core/slice: the skinning fits, the hair's distance field and strands, the crowds' bakes, the
 * land shading rows), so on a device with KHR_parallel_shader_compile they are built under the film in deadline order
 * like everything else. Without parallel compiles the whole film is still built and compiled behind the cover (the
 * hold), and these builds go first there.
 */
const HEAVY: ReadonlySet<FilmJob> = new Set<FilmJob>(['coast', 'ramah', 'gilgal']);
/** share of the wall clock the background builder gets while the film plays (frame-budgeted slices; conservative) */
const FILM_SHARE_DESKTOP = 0.45;
const FILM_SHARE_MOBILE = 0.35;
/** a set must be predicted ready this many seconds (and this fraction) before its deadline */
const MARGIN_S = 3;
const MARGIN_F = 0.8;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const macrotask = () => new Promise<void>((r) => setTimeout(r, 0));
/** a macrotask without the timer clamp (chained setTimeouts wait >= 4 ms each): a covered slice's pause */
const yieldTask = (() => {
  if (typeof MessageChannel === 'undefined') return macrotask;
  const ch = new MessageChannel();
  const q: (() => void)[] = [];
  ch.port1.onmessage = () => q.shift()?.();
  return () =>
    new Promise<void>((r) => {
      q.push(r);
      ch.port2.postMessage(0);
    });
})();
const testParam = (k: string) => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get(k) : null);

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
  /** performance.now() ms when the picture went on screen (enterFilm; 0 = not yet) */
  private filmAt = 0;
  /** film mode: the last frame's time (rAF) and the display's frame interval, for the slices between frames */
  private rafAt = 0;
  private rafDt = 1000 / 60;
  /** film mode: every slice as [end ms, length ms, build 1 / prepare 0, urgent 1 / 0] (bounded; for frame traces) */
  readonly sliceLog: number[] = [];
  private filmClock: (() => number) | null = null;
  /** the set being built / prepared */
  private current: FilmJob | null = null;
  private readonly primeWorld: FilmScheduleOptions['primeWorld'];
  /**
   * film mode: the main-thread time of each background slice (what the builder costs a frame); `build` = the slices of
   * set builds alone (the rest are prepares: uploads, and on a device without parallel compiles the program links)
   */
  readonly slices = { n: 0, maxMs: 0, over16: 0, over50: 0, over100: 0, awaited: 0, top: [] as { set: string; ms: number }[], build: { n: 0, maxMs: 0, over8: 0, over16: 0, overMax: 0, urgent: 0, hist: [0, 0, 0, 0, 0, 0] as number[] } };
  /** (wave 4b) what the builder did when (performance.now() ms): for frame-time traces */
  readonly windows: { job: FilmJob; kind: 'build' | 'prep'; t0: number; t1: number; covered: boolean }[] = [];
  /** (wave 4b) the slicer the build code consults (core/slice): the builder's budget rule, inside the long loops */
  private readonly slicer: Slicer = {
    due: () => performance.now() - this.sliceT >= this.sliceBudget(),
    pause: () => this.slicePause(),
  };
  private readonly rel: Record<FilmJob, number>;
  private readonly bshare: Record<FilmJob, number>;
  /** this device's ms per unit of REL_COST (from the sets built so far, covered mode) */
  private unitMs = 0;
  /**
   * test only (?holdscale=0.1): predict as for a device that many times this one's build time — with the harness pacing
   * the film clock at the same factor, a slow software-GPU box plays the timeline of a 10x faster device
   */
  private readonly holdScale: number;
  private readonly budgetMs: number;
  private readonly share: number;
  /** KHR_parallel_shader_compile: programs compile off the main thread (else only behind a cover) */
  private readonly parallel: boolean;

  private constructor(
    private readonly engine: Engine,
    opts: FilmScheduleOptions,
  ) {
    this.budgetMs = engine.quality.mobile ? 5 : 7;
    this.share = engine.quality.mobile ? FILM_SHARE_MOBILE : FILM_SHARE_DESKTOP;
    // (test only: ?parallel=1 schedules as on a device with parallel compiles — on a software-GPU box the prepares then
    // stall the film; it exercises the film-time builds and the hold prediction)
    this.parallel = engine.renderer.extensions.has('KHR_parallel_shader_compile') || testParam('parallel') === '1';
    const hs = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('holdscale')) : NaN;
    this.holdScale = Number.isFinite(hs) && hs > 0 ? hs : 1;
    const { primeWorld, ...stageOpts } = opts;
    this.primeWorld = primeWorld;
    this.stage = FilmStage.create(engine, { ...stageOpts, yieldFrame: () => this.yieldSlice() });
    this.rel = REL_COST[engine.quality.mobile ? 'mobile' : 'desktop'];
    this.bshare = BUILD_SHARE[engine.quality.mobile ? 'mobile' : 'desktop'];
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

  /** resolves when every job is done (or given up) */
  whenSettled(): Promise<void> {
    return Promise.all(this.order.map((n) => this.ready(n))).then(() => undefined);
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
      d += r * this.doneFrac(n);
    }
    return w > 0 ? d / w : 1;
  }

  /** the fraction of a job's work done (its build share, then its prepare) */
  private doneFrac(n: FilmJob): number {
    const st = this.state[n], b = this.bshare[n] ?? 0.3, p = this.progressOf[n] ?? 0;
    if (st === 'ready' || st === 'failed' || st === 'skipped') return 1;
    if (st === 'compiling') return b + (1 - b) * p;
    if (st === 'built') return b;
    if (st === 'building') return b * p;
    return 0;
  }

  /**
   * Seconds the film start must still wait on this device (0 = safe now): for every job not ready its predicted ready
   * time if the film started now (the remaining work in deadline order, at `share` of the wall clock) must lie MARGIN
   * before its deadline. Every build runs in slices (wave 4b), so nothing has to be built before the picture goes on
   * screen; without KHR_parallel_shader_compile the programs cannot compile under the film, so everything is built and
   * compiled first. Before any set has been measured the answer is "not yet".
   */
  startWait(): number {
    if (this.unitMs <= 0) return Infinity;
    if (!this.parallel) {
      // (wave 4) without KHR_parallel_shader_compile every program compiles ON the main thread at its first draw: no
      // pre-compile may run under the film (it would stutter) — everything is done behind the cover first
      let all = 0;
      for (const n of this.order) all += ((this.rel[n] ?? 1) * (1 - this.doneFrac(n)) * this.unitMs) / 1000;
      return this.settled ? 0 : Math.max(0.2, all);
    }
    let cum = 0, wait = 0;
    for (const n of this.order) {
      const st = this.state[n];
      if (st === 'ready' || st === 'failed' || st === 'skipped') continue;
      const remain = ((this.rel[n] ?? 1) * (1 - this.doneFrac(n)) * this.unitMs * this.holdScale) / 1000;
      cum += remain / this.share;
      const limit = Math.min(this.deadline[n]! * MARGIN_F, this.deadline[n]! - MARGIN_S);
      // covered (holding) runs at full speed: the excess shrinks by `share` of the remaining-work estimate per second
      if (cum > limit) wait = Math.max(wait, ((cum - limit) * this.share) / this.holdScale);
    }
    return wait;
  }

  /**
   * The start click: hold (the caller keeps its cover up and shows `onProgress`) until the later sets are predicted
   * ready in time, building at full speed meanwhile. Resolves at once on a fast device.
   */
  async waitForStart(onProgress?: (f: number) => void): Promise<void> {
    this.covered = true;
    // test only: ?hold=0 starts at once (the harness exercises the film-time builds on a slow box)
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('hold') === '0') return;
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
    // the first film-mode slice is measured from here (covered work never counts as a slice)
    this.startSlice();
    this.filmAt = Math.round(this.sliceT);
    if (!this.settled) this.startFrameCount();
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
    return { order: this.order, deadline: this.deadline, state: this.state, times: this.times, unitMs: Math.round(this.unitMs), startWait: this.startWait(), parallel: this.parallel, slices: this.slices, windows: this.windows, filmAt: this.filmAt, sliceLog: this.sliceLog, stats: this.stage.buildStats };
  }

  // ------------------------------------------------------------------------------------------ the builder
  /** a builder step's yield: back-to-back while covered, a frame once a slice has used its budget while the film plays */
  private async yieldSlice(): Promise<void> {
    if (this.covered) {
      await macrotask();
      this.startSlice();
      return;
    }
    const now = performance.now();
    if (this.current && this.filmClock) this.urgent = this.filmClock() > this.deadline[this.current]! - 8;
    if (now - this.sliceT < (this.urgent ? this.budgetMs * 4 : this.budgetMs)) return;
    this.noteSlice(now - this.sliceT);
    await this.frameGap();
    this.startSlice();
  }

  /**
   * (wave 4b) the pause of a long build loop (core/slice), once its slice has used the budget: a frame while the film
   * plays, a task while covered (the start screen stays responsive)
   */
  private async slicePause(): Promise<void> {
    if (this.covered) {
      await yieldTask();
      this.startSlice();
      return;
    }
    this.noteSlice(performance.now() - this.sliceT);
    await this.frameGap();
    this.startSlice();
  }

  /**
   * (wave 4b) film mode, between two slices: if one more whole slice still fits in this frame's idle time before the
   * next frame (with a margin) it runs at once — a task, so input and the frame stay first — else after the next
   * frame's rendering. A paced phone (30 fps) has idle frames: the builder gets more of the wall clock, never a long task.
   */
  private async frameGap(): Promise<void> {
    if (this.rafAt > 0 && performance.now() + this.sliceBudget() + 4 < this.rafAt + this.rafDt) return yieldTask();
    await new Promise<void>((r) =>
      requestAnimationFrame((t) => {
        // the display's frame interval (60 Hz: 16.7 ms; 120 Hz: 8.3 ms), never assumed longer than 60 Hz's
        const d = t - this.rafAt;
        if (this.rafAt > 0 && d > 4) this.rafDt += (Math.min(1000 / 60, d) - this.rafDt) * 0.1;
        this.rafAt = t;
        setTimeout(r, 0);
      }),
    );
  }

  /** a slice's main-thread budget: big while covered (the start screen stays responsive), small while the film plays */
  private sliceBudget(): number {
    return this.covered ? 40 : this.urgent ? this.budgetMs * 4 : this.budgetMs;
  }

  /** a new slice starts now (its main-thread time is measured from here) */
  private startSlice() {
    this.sliceT = performance.now();
    this.sliceRaf = this.rafCount;
  }

  /** film mode: frames counted while the builder runs — a "slice" that spans a frame was an await on I/O, not work */
  private rafCount = 0;
  private sliceRaf = 0;
  private ticking = false;
  private startFrameCount() {
    if (this.ticking || typeof requestAnimationFrame === 'undefined') return;
    this.ticking = true;
    const tick = () => {
      this.rafCount++;
      if (this.ticking) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private noteSlice(ms: number) {
    const s = this.slices;
    const building = !!this.current && this.state[this.current] === 'building';
    // the slice spanned a frame: the builder awaited a download / decode / import meanwhile (not one block of work)
    const io = this.rafCount !== this.sliceRaf;
    if (this.sliceLog.length < 60000) this.sliceLog.push(Math.round(performance.now()), Math.round(ms * 10) / 10, io ? 2 : building ? 1 : 0, this.urgent ? 1 : 0);
    if (io) {
      s.awaited++;
      return;
    }
    if (building) {
      const b = s.build;
      b.n++;
      b.maxMs = Math.max(b.maxMs, Math.round(ms * 10) / 10);
      if (ms > 8) b.over8++;
      if (ms > 16) b.over16++;
      // past the budget = the last indivisible step of the slice (a loop's unit, or code that does not slice)
      b.overMax = Math.max(b.overMax, Math.round((ms - this.sliceBudget()) * 10) / 10);
      if (this.urgent) b.urgent++;
      b.hist[ms <= 6 ? 0 : ms <= 8 ? 1 : ms <= 12 ? 2 : ms <= 16 ? 3 : ms <= 33 ? 4 : 5]++;
    }
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
    // A: the first sets (judah) — the start screen waits for them; then everything else in deadline order (the world's
    // warm-up, the map, coast, ramah, gilgal), covered while the start screen is up, under the film after the click.
    // Without parallel compiles (B) the heavy builds go first, behind the cover (the hold waits for everything there).
    // The long build loops consult the slicer (core/slice) while it runs: no step blocks a frame for long.
    slice.set(this.slicer);
    try {
      const first = this.firstSets();
      for (const n of first) await this.job(n, false);
      // the start screen comes up the moment the first sets are ready (its continuation runs before the next job)
      await macrotask();
      if (!this.parallel) for (const n of this.order) if (HEAVY.has(n) && !first.includes(n)) await this.job(n, true);
      for (const n of this.order) if (!first.includes(n)) await this.job(n, false);
    } finally {
      slice.set(null);
      this.ticking = false;
      this.current = null;
      this.urgent = false;
    }
  }

  /** one job: build (unless built) and prepare a set — or only build it (`buildOnly`); 'world' = the world's warm-up */
  private async job(n: FilmJob, buildOnly: boolean): Promise<void> {
    if (this.stopped) return;
    const st0 = this.state[n];
    if (st0 === 'ready' || st0 === 'failed' || st0 === 'skipped' || (buildOnly && st0 === 'built')) return;
    // a set whose shots the film has already passed is not built any more (a late device; tests seeking ahead)
    const clock = this.filmClock?.();
    if (clock !== undefined && clock > this.deadline[n]! + 30) {
      this.state[n] = 'skipped';
      this.resolve[n]?.();
      return;
    }
    if (!this.covered) {
      await nextFrame();
      this.startSlice();
    }
    this.current = n;
    const t0 = performance.now();
    const covered0 = this.covered;
    const time = (this.times[n] ??= { build: 0, prep: 0, covered: true, readyAt: 0 });
    if (n === 'world') {
      // the game world's first-frame warm-up (no build: the world is built at boot); sliced in both modes (the start
      // screen stays responsive): covered = bigger slices, a macrotask between them
      this.state[n] = 'compiling';
      await this.primeWorld!(() => this.covered, { budgetMs: () => this.sliceBudget(), yieldFrame: () => this.frameYield() }).catch((e) => console.warn('[film] world prime', e));
      this.windows.push({ job: n, kind: 'prep', t0: Math.round(t0), t1: Math.round(performance.now()), covered: covered0 && this.covered });
      this.finish(n, t0, covered0, time, 'prep');
      return;
    }
    const name = n as FilmStageSet;
    if (this.state[n] !== 'built') {
      this.state[n] = 'building';
      this.progressOf[n] = 0;
      const h = await this.stage.buildSet(name, (f) => (this.progressOf[n] = f));
      time.build = Math.round(performance.now() - t0);
      this.windows.push({ job: n, kind: 'build', t0: Math.round(t0), t1: Math.round(performance.now()), covered: covered0 && this.covered });
      time.covered &&= covered0 && this.covered;
      if (!h || this.stopped) {
        // stopped while it was building (the film was skipped / is over): free it at once
        if (h && this.stopped) this.stage.release(name);
        this.state[n] = this.stopped ? 'skipped' : 'failed';
        this.resolve[n]?.();
        return;
      }
      this.state[n] = 'built';
      this.progressOf[n] = 0;
      this.calibrate(n, performance.now() - t0, covered0, this.bshare[n] ?? 0.3);
      if (buildOnly) return;
    }
    // (wave 4) the world's texture images download while the sets build; a set's first frames need them
    await this.engine.texturesReady.catch(() => undefined);
    const t1 = performance.now();
    const covered1 = this.covered;
    this.state[n] = 'compiling';
    if (this.covered) {
      // behind the loading / start screen: programs and uploads in slices first (the start screen stays responsive),
      // then — if the picture is still covered — the full warm-up on the canvas (a click waits for it: enterFilm). The
      // first sets (judah) are warmed up on the canvas only (wave 4): the loading screen needs no slices, and the canvas
      // warm-up compiles and uploads the same things itself
      if (!this.firstSets().includes(n)) await this.stage.prepareSet(name, { budgetMs: () => this.sliceBudget(), yieldFrame: () => this.frameYield() });
      if (this.covered) {
        const p = this.stage.precompileSet(name);
        this.canvasBusy = p;
        await p;
        this.canvasBusy = null;
      }
    } else {
      this.watchDeadline(n);
      await this.stage.prepareSet(name, { budgetMs: () => this.sliceBudget(), yieldFrame: () => this.frameYield() });
    }
    this.calibrate(n, performance.now() - t1, covered1, 1 - (this.bshare[n] ?? 0.3));
    this.windows.push({ job: n, kind: 'prep', t0: Math.round(t1), t1: Math.round(performance.now()), covered: covered1 && this.covered });
    this.finish(n, t1, covered1, time, 'prep');
  }

  private finish(n: FilmJob, t0: number, covered0: boolean, time: { build: number; prep: number; covered: boolean; readyAt: number }, part: 'prep') {
    const t = performance.now();
    time[part] = Math.round(t - t0);
    time.covered &&= covered0 && this.covered;
    time.readyAt = Math.round(t);
    this.state[n] = 'ready';
    this.progressOf[n] = 1;
    bootMark((n === 'world' ? 'job:' : 'set:') + n);
    this.resolve[n]?.();
  }

  /** the device's speed (ms per REL_COST unit), from work done while covered (film-mode wall time is mostly the film) */
  private unitsDone = 0;
  private msDone = 0;
  private calibrate(n: FilmJob, ms: number, covered: boolean, frac: number) {
    if (!(covered && this.covered)) return;
    this.unitsDone += (this.rel[n] ?? 1) * frac;
    this.msDone += ms;
    if (this.unitsDone > 0) this.unitMs = this.msDone / this.unitsDone;
  }

  /** a prepare slice's yield (same budget rule as the builder's) */
  private async frameYield(): Promise<void> {
    if (this.covered) {
      await macrotask();
      this.startSlice();
      return;
    }
    this.noteSlice(performance.now() - this.sliceT);
    await this.frameGap();
    this.startSlice();
  }

  /** film mode: the slices grow if the set being prepared is close to its deadline on the film clock */
  private watchDeadline(n: FilmJob) {
    const t = this.filmClock?.();
    this.urgent = t !== undefined && t > this.deadline[n]! - 8;
  }

  /** for the report: is every set built and prepared (or given up)? */
  get settled(): boolean {
    return this.order.every((n) => this.state[n] === 'ready' || this.state[n] === 'failed' || this.state[n] === 'skipped');
  }
}
