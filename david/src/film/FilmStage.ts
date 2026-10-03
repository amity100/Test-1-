import * as THREE from 'three';
import type { Engine, ViewSpec } from '../core/Engine';
import type { ShotFrame } from '../gameplay/CameraRig';
import type { LandSet, LandLocation } from './land/LandSet';
import type { GilgalSet, GilgalShotName } from './gilgal/GilgalSet';
import type { FilmActor, GilgalPerformance, RamahPerformance } from './cast';
import type { GilgalArmy } from './crowd/GilgalArmy';
import type { PhilistineHost } from './crowd/PhilistineHost';
import { landAtmo, cloudShared } from './land/landAtmo';
import { INTRO_SHOTS, type FilmSetName } from '../content/introScript';
import { baseTake, FILM_CAM, gilgalCam, gilgalFocus, landCam, SUN_CHEAT, takeBeat, takeExposure, TAKE_OFFSET, type GilgalCtx, type LandCamCtx } from './FilmCams';

/**
 * THE FILM STAGE of the opening film: the film-only sets, crowds and actors the shot sheet (INTRO_SHOTS) films in, built
 * behind the loading screen and disposed set by set as the film leaves it (phones!). This module is imported lazily (it
 * pulls in src/film/gilgal, src/film/cast, src/film/crowd, src/film/land and src/film/map through dynamic imports only).
 *
 * CUT v5 (docs/intro-script-v5.md, 134.5 s): the prologue films in the land sets 'judah' (P1 the flight), 'map' (P4-P5,
 * map1's realistic 3D map), 'coast' (P6 the Philistine host) and 'ramah' (P7 the elders), then 'gilgal' (G1-G7); the
 * rest is the game world (FilmWorld). EVERY SET IS AN INDEPENDENT ASYNC BUILDER (buildSet: no ordering assumptions, its
 * own progress, small yielding steps, its own build time in buildStats) so the loading wave can start the film once
 * judah (+ the world) is ready and build the map, coast, ramah and Gilgal in the background during the prologue:
 *
 *   const stage = await FilmStage.load(engine, { onProgress });     every used set in film order + the pre-compile
 *   // or progressively:
 *   const stage = FilmStage.create(engine, opts);
 *   await stage.buildSet('judah', (f) => bar(f));  await stage.precompileSet('judah');   ... the others later
 *   stage.sets.gilgal?.view                     ViewSpec for engine.setView
 *   stage.sets.gilgal?.frame(take, u, t, out)   camera of a take (u = normalised, t = shot seconds)
 *   stage.sets.gilgal?.enter(take)              on every cut into the set
 *   stage.sets.gilgal?.tick(take, t, dt)        per frame before engine.render (set beat, crowd, actors)
 *   stage.sets.gilgal?.focus(take, t)           DoF target
 *   stage.release('gilgal')                     dispose a set when the film is done with it; stage.dispose() = all
 *
 * ACTOR SLOTS (FilmActor per role; a failed or missing module falls back to the set's own placeholders so the cut
 * always plays):
 *   gilgal: saul, samuel (hero), armourBearer (desktop) -> GilgalPerformance; the army -> GilgalArmy
 *   ramah: samuel + 5-11 elders -> RamahPerformance; coast: the Philistine host -> PhilistineHost
 *
 * CAMERAS: every take is filmed by src/film/FilmCams.ts (gilgalCam: the eight Gilgal takes incl. 'tear:insert'; landCam
 * for the land takes 'flight' 'threat' 'elders') with the set's own move as a fallback; per-take exposure multiplies the
 * set's exposure (FilmCams.TAKE_LOOK). The map films itself (map1). Test only: ?filmsets=judah,map builds just those of
 * the used sets (the others fall back to a world vista).
 */
export type FilmStageSet = Exclude<FilmSetName, 'black' | 'world'>;

/** the film sets the shot sheet actually films in, in film order (CUT v5: judah, map, coast, ramah, gilgal) */
export const USED_SETS: ReadonlySet<FilmStageSet> = new Set(
  INTRO_SHOTS.map((s) => s.set).filter((n): n is FilmStageSet => n !== 'black' && n !== 'world'),
);

export interface FilmFocus {
  point: THREE.Vector3;
  fStop: number;
}

export interface FilmSetHandle {
  readonly name: FilmStageSet;
  readonly view: ViewSpec;
  readonly camera: THREE.PerspectiveCamera;
  /** Camera of `take` at normalised time u (0..1, already remapped to the shot's span); t = shot seconds. */
  frame(take: string, u: number, t: number, out: ShotFrame): boolean;
  /** On every cut into a take of this set. */
  enter(take: string): void;
  /** Per frame, before engine.render: the set's beat, crowds and actors. */
  tick(take: string, t: number, dt: number): void;
  /** Depth-of-field target of a take (null = deep focus). */
  focus(take: string, t: number): FilmFocus | null;
  /** What is real and what is placeholder in this set (for the report / HUD). */
  readonly status: string[];
  disposed: boolean;
  dispose(): void;
  /** OPTIONAL: the ground height under (x, z) in this view (the moving dissolve's depth estimate, Intro) */
  ground?(x: number, z: number): number;
  /** OPTIONAL: extra poses for the view's pre-compile (default: the middle of every take) */
  precompilePoses?: { pos: THREE.Vector3; look: THREE.Vector3 }[];
  /**
   * OPTIONAL: run the set through the seconds BEFORE its first shot while the previous shot is still on screen (t < 0 =
   * seconds before the cut; nothing is shown) — G1: the 1.5 s of blocking before the shofar, so the army's walk phases,
   * the horn blowers and the hair are exactly those of CUT v4's continuous playback. enter(take) after a preroll of the
   * same take keeps that state.
   */
  preroll?(take: string, t: number, dt: number): void;
}

export interface FilmStageOptions {
  onProgress?: (f: number, label: string) => void;
  /** build the cast (FilmActor humans). default true; ?filmcast=0 turns it off (placeholders) */
  cast?: boolean;
  /** build the GPU crowds. default true; ?filmcrowd=0 */
  crowd?: boolean;
  /**
   * load1 (the scheduling): what a builder's yieldFrame() awaits. Default: one macrotask (setTimeout 0) — the loading
   * screen's pace; the background builder (FilmSchedule) passes a frame-budgeted yield while the film plays.
   */
  yieldFrame?: () => Promise<void>;
}

/**
 * What a set builder gets (FilmStage.buildSet): everything it needs to build ONE set on its own — no ordering
 * assumptions about the other sets, its own progress, and a yield to call between heavy steps (the builder may run
 * while the film plays: no step may block the main thread for long, and no global state may be left changed across
 * a yield).
 */
export interface FilmSetBuildContext {
  readonly engine: Engine;
  /** engine.quality.tier ('desktop-high' | 'desktop-medium' | 'mobile-high' | 'mobile-low') */
  readonly tier: string;
  /** the takes the shot sheet films in this set (in film order) */
  readonly takes: readonly string[];
  /** build the cast (FilmActors) / the GPU crowds (tests: ?filmcast=0 / ?filmcrowd=0) */
  readonly cast: boolean;
  readonly crowd: boolean;
  /** this set's own build progress, 0..1 */
  progress(f: number): void;
  /** await between heavy steps: gives the event loop (and a running film) a frame */
  yieldFrame(): Promise<void>;
}

/** what a set's build cost (FilmStage.buildStats; window.__filmSetStats under ?test=1) */
export interface FilmSetBuildStat {
  /** wall-clock ms from the start of the build to the handle (incl. downloads and yields) */
  ms: number;
  /** the longest synchronous step between two yields (ms): what a background build would cost a frame */
  longestStepMs: number;
  /** pre-compile of the view (ms), once done */
  precompileMs?: number;
  /** JS heap growth over the build (MB, Chrome only) */
  heapMB?: number;
  ok: boolean;
  /** the land sets: each synchronous build step (ms) between two yields (LandSet.buildSteps) */
  steps?: { step: string; ms: number }[];
}

// ==== map1: the 'map' set (P4-P5) — map1 owns this block (src/film/map/**); cut7 owns the rest of this file ====
// The realistic 3D map (src/film/map/MapSet.ts): its own scene / camera / DOM labels, built in small yielding steps
// (fetch + off-thread decode of 4 small webp, the terrain mesh in row bands); its handle films 'exodus' and 'tribes'.
async function buildMapSet(c: FilmSetBuildContext): Promise<FilmSetHandle | null> {
  const { createMapSet } = await import('./map/MapSet');
  return createMapSet(c.engine, { onProgress: (f) => c.progress(f), yieldFrame: () => c.yieldFrame() });
}
// ==== end of map1's block ====

const smooth = (u: number) => u * u * (3 - 2 * u);

/** snap every actor's strand-hair simulation back to rest (on cuts) */
function resetHair(actors: readonly FilmActor[]) {
  for (const a of actors) {
    try {
      a.groom?.sim?.reset();
    } catch {
      /* hair is cosmetic */
    }
  }
}

/** Snapshot of the land sets' shared uniforms (sun / sky / haze / deck live in module singletons). */
interface LandSnap {
  sunDir: THREE.Vector3;
  sunCol: THREE.Color;
  sky: THREE.Texture | null;
  haze: THREE.Vector4;
  deck: THREE.Vector4;
}
const snapLand = (): LandSnap => ({
  sunDir: landAtmo.uSunDirA.value.clone(),
  sunCol: landAtmo.uSunColA.value.clone(),
  sky: landAtmo.tSkyCube.value,
  haze: landAtmo.uHaze.value.clone(),
  deck: (cloudShared.uDeck.value as THREE.Vector4).clone(),
});
const applyLand = (s: LandSnap) => {
  landAtmo.uSunDirA.value.copy(s.sunDir);
  landAtmo.uSunColA.value.copy(s.sunCol);
  landAtmo.tSkyCube.value = s.sky;
  landAtmo.uHaze.value.copy(s.haze);
  (cloudShared.uDeck.value as THREE.Vector4).copy(s.deck);
};

/** clips only the film uses (released after it; generic clips stay: gameplay may share them) */
const FILM_ONLY_CLIPS = ['walk_king', 'walk_halt', 'idle_king', 'grab_pull_R', 'old_turn_walk', 'walk_old', 'talk_gesture', 'argue', 'point_directions', 'idle_bus', 'walk_old_hunched'];

/**
 * P7 'elders': the elders per tier (landSites mark indices, in the order of RamahPerformance's parts) and those at the
 * 'near' LOD (real faces and beards) — (cut7, CUT v5) the ones the confrontation's lens is close to: the speaker (0),
 * the elder in profile between him and Samuel (3), the one at the right edge (5); the same counts per tier as before
 * (3 / 2 / 2 / 1), the hair simulation on two of them (RAMAH_SIM) — no cost increase on any tier
 */
const RAMAH_PLAN: Record<string, { idx: number[]; near: number[] }> = {
  'desktop-high': { idx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], near: [0, 3, 5] },
  'desktop-medium': { idx: [0, 1, 2, 3, 4, 5, 6, 7], near: [0, 3] },
  'mobile-high': { idx: [0, 2, 3, 4, 5, 6, 7], near: [0, 3] },
  'mobile-low': { idx: [0, 2, 3, 6, 7], near: [0] },
};
/** the elders whose strand hair is simulated (wind in the hair seen close): the speaker and the elder beside him */
const RAMAH_SIM = [0, 3];

/** the loading bar's label of each set's build */
const SET_LABEL: Record<FilmStageSet, string> = { judah: 'הָאָרֶץ…', map: 'הַדֶּרֶךְ…', coast: 'אֶרֶץ פְּלִשְׁתִּים…', ramah: 'הָרָמָה…', gilgal: 'הַגִּלְגָּל…' };
/** relative build cost of each set (the loading bar's shares) */
const SET_WEIGHT: Record<FilmStageSet, number> = { judah: 0.12, map: 0.1, coast: 0.14, ramah: 0.16, gilgal: 0.5 };

/** JS heap in use (MB; Chrome only, else null) */
function heapMB(): number | null {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return m ? m.usedJSHeapSize / 1048576 : null;
}

/** measures the longest main-thread block (ms) while it runs: the gaps of a 10 ms interval timer */
function blockMonitor() {
  let last = performance.now(), worst = 0;
  const id = setInterval(() => {
    const now = performance.now();
    worst = Math.max(worst, now - last - 10);
    last = now;
  }, 10);
  return { stop: () => (clearInterval(id), Math.max(0, Math.round(worst))) };
}

export class FilmStage {
  readonly sets: Partial<Record<FilmStageSet, FilmSetHandle>> = {};
  /** per set: build time, its longest main-thread block, the pre-compile, heap growth (the report / the loading wave) */
  readonly buildStats: Partial<Record<FilmStageSet, FilmSetBuildStat>> = {};
  loadMs = 0;
  private releaseTiles: (() => void) | null = null;
  private releaseClips: (() => void) | null = null;
  private readonly building: Partial<Record<FilmStageSet, Promise<FilmSetHandle | null>>> = {};
  private landModP: Promise<typeof import('./land/LandSet') | null> | null = null;
  private castModP: Promise<typeof import('./cast') | null> | null = null;
  private readonly landSteps: Partial<Record<FilmStageSet, { step: string; ms: number }[]>> = {};

  private constructor(private readonly engine: Engine, private readonly opts: FilmStageOptions = {}) {}

  /** An empty stage: build its sets one by one (buildSet + precompileSet) — the progressive loading path. */
  static create(engine: Engine, o: FilmStageOptions = {}): FilmStage {
    const s = new FilmStage(engine, o);
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1') (window as unknown as Record<string, unknown>).__filmSetStats = s.buildStats;
    return s;
  }

  /**
   * Build every film set the shot sheet uses, in film order (+ their crowds and actors), and pre-compile their views.
   * Never rejects: a failed set is left out (its shots fall back to a world vista, the cut keeps its timing).
   */
  static async load(engine: Engine, o: FilmStageOptions = {}): Promise<FilmStage> {
    const t0 = performance.now();
    const stage = FilmStage.create(engine, o);
    const prog = o.onProgress ?? (() => {});
    const names = stage.wantedSets();
    // the loading bar: each set's share by its build cost, then the pre-compile
    const COMPILE = 0.16;
    const sum = names.reduce((a, n) => a + SET_WEIGHT[n], COMPILE);
    let base = 0;
    for (const n of names) {
      const w = SET_WEIGHT[n] / sum, b = base;
      await stage.buildSet(n, (f) => prog(Math.min(0.999, b + w * f), SET_LABEL[n]));
      base += w;
    }
    const built = names.filter((n) => stage.sets[n]);
    for (let i = 0; i < built.length; i++) {
      await stage.precompileSet(built[i]);
      prog(Math.min(0.999, base + (COMPILE / sum) * ((i + 1) / built.length)), 'מֵכִין אֶת הַסֶּרֶט…');
    }
    stage.loadMs = performance.now() - t0;
    prog(1, '');
    return stage;
  }

  /** the film sets this stage builds: the sheet's sets in film order (tests: ?filmsets=judah,map narrows them) */
  wantedSets(): FilmStageSet[] {
    const only = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('filmsets') : null;
    return [...USED_SETS].filter((n) => !only || only.split(',').includes(n));
  }

  /**
   * Build ONE set (idempotent: the same promise for the same set; never rejects — null if it failed). Independent of
   * every other set: it imports and preloads what it needs itself, reports its own progress (0..1) and yields between
   * its heavy steps. The handle is in `sets` when the promise resolves; pre-compile it with precompileSet().
   */
  buildSet(name: FilmStageSet, onProgress?: (f: number) => void): Promise<FilmSetHandle | null> {
    return (this.building[name] ??= this.runBuilder(name, onProgress ?? (() => {})));
  }

  private async runBuilder(name: FilmStageSet, onProgress: (f: number) => void): Promise<FilmSetHandle | null> {
    const engine = this.engine;
    const t0 = performance.now();
    const heap0 = heapMB();
    const mon = blockMonitor();
    const c: FilmSetBuildContext = {
      engine,
      tier: engine.quality.tier,
      takes: INTRO_SHOTS.filter((s) => s.set === name).map((s) => s.take),
      cast: this.opts.cast !== false,
      crowd: this.opts.crowd !== false,
      progress: (f) => onProgress(Math.max(0, Math.min(1, f))),
      yieldFrame: this.opts.yieldFrame ?? (() => new Promise<void>((r) => setTimeout(r, 0))),
    };
    let h: FilmSetHandle | null = null;
    try {
      h = name === 'map' ? await buildMapSet(c) : name === 'gilgal' ? await this.buildGilgal(c) : await this.buildLand(name, c);
    } catch (e) {
      console.warn(`[film] set ${name} failed`, e);
      h = null;
    }
    if (h) this.sets[name] = h;
    const heap1 = heapMB();
    this.buildStats[name] = { ms: Math.round(performance.now() - t0), longestStepMs: mon.stop(), heapMB: heap0 !== null && heap1 !== null ? Math.round(heap1 - heap0) : undefined, ok: !!h, steps: this.landSteps[name] };
    onProgress(1);
    return h;
  }

  /**
   * Pre-compile one built set's view for this tier (compiles its programs, renders a frame from the middle of each of its
   * takes: uploads, shadow maps, first-use passes) so the first cut into it never hitches. It renders to the canvas:
   * call it behind the loading screen or under a black / an opaque frame.
   */
  async precompileSet(name: FilmStageSet): Promise<void> {
    const h = this.sets[name];
    if (!h) return;
    const t0 = performance.now();
    try {
      const f: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
      const poses = [...(h.precompilePoses ?? [])];
      for (const s of INTRO_SHOTS.filter((x) => x.set === name)) {
        h.enter(s.take);
        h.tick(s.take, s.dur * 0.5, 0);
        if (h.frame(s.take, 0.5, s.dur * 0.5, f)) poses.push({ pos: f.pos.clone(), look: f.look.clone() });
      }
      await this.engine.precompileView(h.view, poses);
    } catch (e) {
      console.warn(`[film] precompile ${name}`, e);
    }
    const st = this.buildStats[name];
    if (st) st.precompileMs = Math.round(performance.now() - t0);
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  /**
   * load1: prepare one built set WITHOUT the canvas — for a set that finishes building while the film plays (the
   * canvas pre-compile above would show it): Engine.prepareView compiles its programs (parallel where the driver can)
   * and uploads its geometry / textures / shadow map into a scratch target in frame-budgeted slices. It never calls the
   * handle's enter / tick (judah's and the coast's tick write the on-screen grade), except Gilgal's and Ramah's (their
   * own set, army and cast only), replayed exactly as precompileSet does so the simulations reach their shots unchanged.
   */
  async prepareSet(name: FilmStageSet, opts: { budgetMs?: number | (() => number); yieldFrame?: () => Promise<void> } = {}): Promise<void> {
    const h = this.sets[name];
    if (!h) return;
    const t0 = performance.now();
    try {
      const shots = INTRO_SHOTS.filter((x) => x.set === name);
      const f: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
      let pose = h.precompilePoses?.[0];
      if (!pose && shots[0] && h.frame(shots[0].take, 0.5, shots[0].dur * 0.5, f)) pose = { pos: f.pos.clone(), look: f.look.clone() };
      if (name === 'gilgal' || name === 'ramah') {
        // the same enter / tick history as precompileSet (the middle of every take, dt 0), so the hair sims and the
        // army's phases reach G1 / P7 exactly as with the old loading; these two handles touch only their own set
        for (const s of shots) {
          h.enter(s.take);
          h.tick(s.take, s.dur * 0.5, 0);
          await (opts.yieldFrame ?? (() => new Promise<void>((r) => setTimeout(r, 0))))();
        }
      }
      const r = await this.engine.prepareView(h.view, { budgetMs: opts.budgetMs, yieldFrame: opts.yieldFrame, pose });
      const st = this.buildStats[name];
      if (st) (st as FilmSetBuildStat & { prepare?: unknown }).prepare = r;
    } catch (e) {
      console.warn(`[film] prepare ${name}`, e);
    }
    const st = this.buildStats[name];
    if (st) st.precompileMs = Math.round(performance.now() - t0);
  }

  /** the land sets' module (the DEM tiles are released with the stage); null if it failed to load */
  private landModule(): Promise<typeof import('./land/LandSet') | null> {
    return (this.landModP ??= (async () => {
      try {
        const mod = await import('./land/LandSet');
        const data = await import('./land/landData');
        this.releaseTiles = () => data.releaseTiles();
        return mod;
      } catch (e) {
        console.warn('[film] land sets unavailable', e);
        return null;
      }
    })());
  }

  /** the cast module with the clips a set needs preloaded (each set asks for its own); null = the set's placeholders */
  private async castModule(pick: (m: typeof import('./cast')) => readonly string[]): Promise<typeof import('./cast') | null> {
    const mod = await (this.castModP ??= import('./cast').catch((e) => {
      console.warn('[film] cast unavailable (placeholders)', e);
      return null;
    }));
    if (!mod) return null;
    try {
      await mod.FilmActor.preloadClips([...pick(mod)]);
      if (!this.releaseClips) {
        const { MocapLibrary } = await import('../characters/mocap/MocapLibrary');
        this.releaseClips = () => MocapLibrary.shared.release(FILM_ONLY_CLIPS);
      }
      return mod;
    } catch (e) {
      console.warn('[film] cast clips unavailable (placeholders)', e);
      return null;
    }
  }

  // ------------------------------------------------------------------ the prologue's land sets: judah (P1), coast (P6), ramah (P7)
  private async buildLand(loc: LandLocation, c: FilmSetBuildContext): Promise<FilmSetHandle | null> {
    const engine = this.engine;
    const q = engine.quality;
    const landMod = await this.landModule();
    if (!landMod) return null;
    // the set itself takes this share of the set's bar (the coast's host and Ramah's cast the rest)
    const share = loc === 'judah' ? 1 : loc === 'coast' ? 0.55 : 0.4;
    const set = await landMod.LandSet.create({ renderer: engine.renderer, quality: q, location: loc, tex: engine.tex, onProgress: (f) => c.progress(f * share), yieldFrame: c.yieldFrame });
    this.landSteps[loc] = set.buildSteps;
    set.restoreSharedSun();
    engine.enforceTextureBudget(set.scene);
    const snap = snapLand();
    await c.yieldFrame();
    if (loc === 'judah') return this.landHandle('judah', set, snap, landMod.landView);
    if (loc === 'coast') {
      let host: PhilistineHost | null = null;
      if (c.crowd) {
        try {
          const { PhilistineHost } = await import('./crowd/PhilistineHost');
          const a = set.anchors.coast!;
          host = await PhilistineHost.create({
            tier: q.tier,
            coast: { route: a.route, columnHead: a.columnHead, columnWidth: a.columnWidth },
            ground: (x, z) => set.height.height(x, z),
          });
          set.scene.add(host.group);
          set.showPlaceholders(false);
        } catch (e) {
          console.warn('[film] Philistine host failed (placeholders)', e);
          host = null;
          set.showPlaceholders(true);
        }
      }
      return this.landHandle('coast', set, snap, landMod.landView, { host });
    }
    // ramah: Samuel in the gateway and the elders before him
    let perf: RamahPerformance | null = null;
    const actors: FilmActor[] = [];
    const castMod = c.cast ? await this.castModule((m) => m.RAMAH_CLIPS) : null;
    if (castMod) {
      try {
        const A = set.anchors.ramah!;
        const ground = (x: number, z: number) => set.height.height(x, z);
        const samuel = await castMod.FilmActor.create({ role: 'samuel', quality: q.name, msaa: q.msaa, lod: 'near', ground });
        actors.push(samuel);
        // P7 (cut4, director-notes-v5): "כֹּל זִקְנֵי יִשְׂרָאֵל" — 8-12 elders in a loose arc before Samuel (landSites marks
        // 0 speaker · 1 seated · 2-5 the arc · 6-7 the near pair the lens dollies in past · 8-10 the outer ring). The
        // 'near' LOD (real faces and beards) for the ones nearest the lens; fewer in all on phones (RAMAH_PLAN).
        const plan = RAMAH_PLAN[q.tier] ?? RAMAH_PLAN['mobile-low'];
        const marks = plan.idx.filter((i) => i < A.elders.length).map((i) => A.elders[i]);
        const elders: FilmActor[] = [];
        for (let k = 0; k < marks.length; k++) {
          const i = plan.idx[k];
          c.progress(share + (1 - share) * ((k + 1) / (marks.length + 1)));
          await c.yieldFrame();
          const e = await castMod.FilmActor.create({ role: 'elder', quality: q.name, msaa: q.msaa, seed: i + 1, lod: plan.near.includes(i) ? 'near' : 'crowd', ground });
          // the strand-hair simulation only where the wind in the hair is seen close (RAMAH_SIM)
          if (!RAMAH_SIM.includes(i)) {
            try {
              e.groom?.setSimulation(false);
            } catch {
              /* hair is cosmetic */
            }
          }
          elders.push(e);
          actors.push(e);
        }
        for (const a of actors) {
          a.addTo(set.scene);
          engine.enforceTextureBudget(a.root);
        }
        // `roles`: the landSites index of each elder (perf's parts: 0 rises, 2<->3 talk/nod, 6<->7 the near pair ...)
        perf = new castMod.RamahPerformance(samuel, elders, A.samuel, marks, ground, undefined, plan.idx.slice(0, marks.length));
        set.showPlaceholders(false);
      } catch (e) {
        console.warn('[film] Ramah cast failed (placeholders)', e);
        for (const a of actors) a.dispose();
        actors.length = 0;
        perf = null;
        set.showPlaceholders(true);
      }
    }
    return this.landHandle('ramah', set, snap, landMod.landView, { ramah: perf, actors });
  }

  // ------------------------------------------------------------------ Gilgal (G1-G7)
  private async buildGilgal(c: FilmSetBuildContext): Promise<FilmSetHandle | null> {
    const engine = this.engine;
    const q = engine.quality;
    const low = q.name === 'low';
    const castMod = c.cast ? await this.castModule((m) => m.GILGAL_CLIPS) : null;
    const [{ GilgalSet }, { gilgalView }] = await Promise.all([import('./gilgal/GilgalSet'), import('./gilgal/gilgalView')]);
    // the raymarched cloud deck of the old 'rise' (shot 13) only if a take still climbs into it (not since CUT v3)
    const deck = INTRO_SHOTS.some((s) => s.set === 'gilgal' && baseTake(s.take) === 'rise');
    const gilgal = await GilgalSet.create({ renderer: engine.renderer, quality: engine.quality, tex: engine.tex, deck, onProgress: (f) => c.progress(f * 0.3) });
    gilgal.restoreSharedSun();
    engine.enforceTextureBudget(gilgal.scene);
    await c.yieldFrame();
    let army: GilgalArmy | null = null;
    if (c.crowd) {
      try {
        const { GilgalArmy } = await import('./crowd/GilgalArmy');
        army = await GilgalArmy.create({ tier: engine.quality.tier, ground: (x, z) => gilgal.ground.height(x, z) });
        gilgal.scene.add(army.group);
      } catch (e) {
        console.warn('[film] Gilgal army failed', e);
        army = null;
      }
    }
    c.progress(0.5);
    await c.yieldFrame();
    let perf: GilgalPerformance | null = null;
    const actors: FilmActor[] = [];
    if (castMod) {
      try {
        const ground = (x: number, z: number) => gilgal.height(x, z);
        const saul = await castMod.FilmActor.create({ role: 'saul', quality: q.name, msaa: q.msaa, ground });
        actors.push(saul);
        c.progress(0.65);
        await c.yieldFrame();
        const samuel = await castMod.FilmActor.create({ role: 'samuel', quality: q.name, msaa: q.msaa, ground });
        actors.push(samuel);
        c.progress(0.8);
        let armourBearer: FilmActor | undefined;
        if (!low) {
          await c.yieldFrame();
          armourBearer = await castMod.FilmActor.create({ role: 'armourBearer', quality: q.name, msaa: q.msaa, seed: 3, lod: 'near', ground });
          actors.push(armourBearer);
        }
        for (const a of actors) {
          a.addTo(gilgal.scene);
          engine.enforceTextureBudget(a.root);
        }
        perf = new castMod.GilgalPerformance({ saul, samuel, armourBearer }, ground);
      } catch (e) {
        console.warn('[film] Gilgal cast failed (placeholders)', e);
        for (const a of actors) a.dispose();
        actors.length = 0;
        perf = null;
      }
    }
    // face lighting of the close-ups (src/film/cast/faceLight.ts, face pass): one fixed rig for the whole set,
    // added BEFORE the precompile (a light changes every shader); re-aimed per shot, off = intensity 0
    let rig: import('./cast/faceLight').FaceLightRig | null = null;
    if (perf && castMod) {
      try {
        const { FaceLightRig } = await import('./cast/faceLight');
        rig = new FaceLightRig({ quality: q.name });
        rig.addTo(gilgal.scene);
        rig.setPreset('off', 0);
        // the rig replaces the performances' own fill in its shots (no double key on the face)
        const FF = castMod.FACE_FILL as Partial<Record<string, [number, number]>>;
        for (const [shot, who] of [['king', 0], ['spearRaised', 0], ['saulAlone', 0], ['verdict', 1]] as [string, number][]) {
          const f = FF[shot];
          if (f) f[who] = 0;
        }
      } catch (e) {
        console.warn('[film] face light rig', e);
        rig = null;
      }
    }
    // the set's own stand-ins cover what the cast / crowd modules could not build
    if (!perf || !army) gilgal.showPlaceholders(true);
    c.progress(1);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 90000);
    return this.gilgalHandle(gilgal, gilgalView(gilgal, { camera: cam }), cam, army, perf, actors, rig);
  }

  /** Dispose one set (after the film has left it for good). */
  release(name: FilmStageSet) {
    const h = this.sets[name];
    if (!h || h.disposed) return;
    if (this.engine.view === h.view) return; // never while on screen
    try {
      h.dispose();
    } catch (e) {
      console.warn('[film] dispose', name, e);
    }
    h.disposed = true;
    delete this.sets[name];
  }

  /** Dispose everything (after the film, or when it is skipped). */
  dispose() {
    for (const n of Object.keys(this.sets) as FilmStageSet[]) {
      const h = this.sets[n];
      if (!h) continue;
      if (this.engine.view === h.view) this.engine.restoreWorldView();
      try {
        h.dispose();
      } catch (e) {
        console.warn('[film] dispose', n, e);
      }
      h.disposed = true;
      delete this.sets[n];
    }
    this.releaseTiles?.();
    this.releaseTiles = null;
    try {
      this.releaseClips?.();
    } catch {
      /* ignore */
    }
    this.releaseClips = null;
  }

  // ---------------------------------------------------------------------------------------------- handles
  private landHandle(
    name: 'judah' | 'coast' | 'ramah',
    set: LandSet,
    snap: LandSnap,
    landView: (s: LandSet, o: { camera?: THREE.PerspectiveCamera }) => ViewSpec,
    extra: { host?: PhilistineHost | null; ramah?: RamahPerformance | null; actors?: FilmActor[] } = {},
  ): FilmSetHandle {
    const camera = new THREE.PerspectiveCamera(45, 1, set.near, set.far);
    const base = landView(set, { camera });
    // per-take exposure (FilmCams.TAKE_LOOK) on top of the set's own
    let expMul = 1;
    const baseExp = base.exposure;
    // P6 (cut4's P4): harsher light with real contrast — the grade's contrast raised for the take, put back on leaving
    let savedContrast: number | null = null;
    // P1 (cut7): the last 1.5 s of the flight a touch warmer (the grade's highlight warmth) toward P2's morning
    let savedWarm: number | null = null;
    const restoreContrast = () => {
      if (savedWarm !== null) {
        engine0.post.grade.uniforms.uWarm.value = savedWarm;
        savedWarm = null;
      }
      if (savedContrast === null) return;
      engine0.post.grade.uniforms.uContrast.value = savedContrast;
      savedContrast = null;
    };
    const engine0 = this.engine;
    // the land sets share their sun / haze / deck uniforms (module singletons): each view puts its own back
    const view: ViewSpec = {
      ...base,
      exposure: () => (typeof baseExp === 'function' ? baseExp() : baseExp ?? 0.5) * expMul,
      update: (dt, cam) => {
        applyLand(snap);
        base.update?.(dt, cam);
      },
      onLeave: () => {
        restoreContrast();
        base.onLeave?.();
      },
    };
    // what the orchestration cameras read from the set (FilmCams.landCam)
    // test only: the cameras' numbers live (window.__filmCams) also when only land sets are built (?filmsets=judah)
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1') (window as unknown as Record<string, unknown>).__filmCams = FILM_CAM;
    const camCtx: LandCamCtx = {
      shotAt: (n, e) => {
        const s = set.shots[n];
        if (!s) return null;
        const f = s.at(Math.max(0, Math.min(1, e)), 0);
        return { pos: f.pos, look: f.look, fov: f.fov };
      },
      height: (x, z) => set.height.height(x, z),
      coast: set.anchors.coast ? { heading: set.anchors.coast.heading, columnHead: set.anchors.coast.columnHead } : undefined,
      ramah:
        name === 'ramah' && set.anchors.ramah
          ? // P5 (cut4): the dolly is laid out in the gate's own frame (landSites: x along the wall, z out of the gate)
            { samuel: set.anchors.ramah.samuel.pos, gate: set.anchors.ramah.gate, gateYaw: set.anchors.ramah.gateYaw }
          : undefined,
    };
    const engine = this.engine;
    const status: string[] = [];
    const tmp2 = new THREE.Vector3();
    if (name === 'coast') status.push(extra.host ? 'Philistine host: GPU crowd (PhilistineHost)' : 'Philistine host: set placeholders');
    if (name === 'ramah') status.push(extra.ramah ? `Samuel + ${(extra.actors?.length ?? 1) - 1} elders: FilmActor (RamahPerformance)` : 'Samuel + elders: set placeholders');
    const tmp = new THREE.Vector3();
    return {
      name,
      view,
      camera,
      status,
      disposed: false,
      ground: (x, z) => set.height.height(x, z),
      frame(take, u, t, out) {
        if (landCam(take, Math.max(0, Math.min(1, u)), t, camCtx, out)) return true;
        const s = set.shots[take];
        if (!s) return false;
        const f = set.frame(s, Math.max(0, Math.min(1, u)));
        out.pos.copy(f.pos);
        out.look.copy(f.look);
        out.fov = f.fov ?? 45;
        out.roll = f.roll ?? 0;
        return true;
      },
      enter(take) {
        resetHair(extra.actors ?? []);
        expMul = takeExposure(take);
        // the host marches from the head of its road at the cut into P4 (the lens is keyed to the column's head)
        if (extra.host && (take === 'threat' || take === 'glint')) extra.host.setTravel(0);
      },
      tick(take, t, dt) {
        expMul = takeExposure(take, t);
        if (name === 'judah' && take === 'flight') {
          // P1: the deck burns off a little once the lens is below it (broken, under-lit clouds over the ridge)
          const F = FILM_CAM.flight;
          const k = Math.max(0, Math.min(1, (t - F.thinAt[0]) / (F.thinAt[1] - F.thinAt[0])));
          set.setDeckCover(1 - (1 - F.thinTo) * k * k * (3 - 2 * k));
          // the end of the flight warmer (it dissolves into the world's warm morning); put back when the view is left
          const uw = engine.post.grade.uniforms.uWarm;
          if (savedWarm === null) savedWarm = uw.value as number;
          const w = Math.max(0, Math.min(1, (t - F.warmAt[0]) / (F.warmAt[1] - F.warmAt[0])));
          uw.value = savedWarm + F.warmAdd * w * w * (3 - 2 * w);
        }
        if (name === 'coast') {
          const u = engine.post.grade.uniforms.uContrast;
          if (take === 'glint' || take === 'threat') {
            if (savedContrast === null) savedContrast = u.value as number;
            u.value = savedContrast * (take === 'threat' ? FILM_CAM.threat.contrast : 1.14);
          } else restoreContrast();
        }
        const h = engine.renderer.domElement.height;
        if (extra.host) {
          extra.host.crowd.viewportHeight = h; // keeps the far spear shafts visible
          extra.host.update(dt, camera);
        }
        if (extra.ramah) extra.ramah.update(t, dt, camera, h);
      },
      focus(take, t) {
        if (name === 'ramah' && extra.ramah && extra.actors?.length) {
          const sam = extra.actors[0];
          // P7: on the elder who rises (the seated elder by the gate) through the demand, then on Samuel as he turns
          // his face away (the contract's `away`)
          if (take === 'elders' && extra.actors.length > 1) {
            const away = takeBeat('elders', 'away', 6.0);
            const k = Math.max(0, Math.min(1, (t - (away - 0.75)) / 0.6));
            const a = extra.actors[1].eyesWorld(tmp);
            const b = sam.eyesWorld(tmp2);
            return { point: a.lerp(b, k * k * (3 - 2 * k)), fStop: 3.2 };
          }
          return { point: sam.eyesWorld(tmp), fStop: 4 };
        }
        if (name === 'ramah' && set.anchors.ramah) return { point: tmp.copy(set.anchors.ramah.samuel.pos).add(new THREE.Vector3(0, 1.5, 0)), fStop: 4 };
        if (name === 'coast' && take === 'threat' && camCtx.coast) {
          // P6 (cut7): on the head of the column (it marches toward the lens): deep at the high start, the near files
          // sharp and the column behind them soft as the lens comes down
          const c = camCtx.coast;
          tmp.copy(c.columnHead).addScaledVector(c.heading, FILM_CAM.coast.march * t - FILM_CAM.threat.focusBack);
          tmp.y = set.height.height(tmp.x, tmp.z) + 1.5;
          return { point: tmp, fStop: FILM_CAM.threat.fStop };
        }
        if (name === 'coast' && take === 'glint' && camCtx.coast) {
          // P4 (cut4): the focus ~30 m down the column — the nearest files large and SOFT, the bronze further back sharp
          const c = camCtx.coast;
          tmp.copy(c.columnHead).addScaledVector(c.heading, FILM_CAM.coast.march * t - 30);
          tmp.y = set.height.height(tmp.x, tmp.z) + 1.5;
          return { point: tmp, fStop: 2.8 };
        }
        return null;
      },
      dispose() {
        restoreContrast();
        extra.host?.dispose();
        for (const a of extra.actors ?? []) a.dispose();
        set.dispose();
      },
    };
  }

  private gilgalHandle(
    gilgal: GilgalSet,
    view: ViewSpec,
    camera: THREE.PerspectiveCamera,
    army: GilgalArmy | null,
    perf: GilgalPerformance | null,
    actors: FilmActor[],
    rig: import('./cast/faceLight').FaceLightRig | null = null,
  ): FilmSetHandle {
    const engine = this.engine;
    const tmp = new THREE.Vector3();
    const H = (x: number, z: number) => gilgal.height(x, z);
    if (new URLSearchParams(location.search).get('test') === '1') {
      (window as unknown as Record<string, unknown>).__filmCams = FILM_CAM;
      // test only: the Gilgal cast (cut4 measures the blocking in the frames)
      (window as unknown as Record<string, unknown>).__gilgalActors = actors;
    }
    // what the cameras read from the cast (FilmCams): Saul's right hand (the grip), both men's eyes
    const handSocket = (a: FilmActor | undefined) => {
      try {
        return (a?.human?.sockets as Record<string, THREE.Object3D> | undefined)?.handGripR ?? null;
      } catch {
        return null;
      }
    };
    const ctx: GilgalCtx = {
      saulHand: (out) => {
        const s = handSocket(actors[0]);
        return s ? s.getWorldPosition(out) : null;
      },
      saulEyes: (out) => (actors[0] ? actors[0].eyesWorld(out) : null),
      samuelEyes: (out) => (actors[1] ? actors[1].eyesWorld(out) : null),
    };
    // per-take exposure (FilmCams.TAKE_LOOK) on top of the set's own
    let expMul = 1;
    const baseExp = view.exposure;
    view.exposure = () => (typeof baseExp === 'function' ? baseExp() : baseExp ?? 0.6) * expMul;
    let current: string | null = null;
    /** the take the set has been pre-rolled into under the previous shot (G1: CUT v5's hard cut on the shofar) */
    let prerolled: string | null = null;
    let armyOk = !!army;
    const status = [
      perf ? `Saul + Samuel${actors.length > 2 ? ' + armour-bearer' : ''}: FilmActor (GilgalPerformance)` : 'Saul + Samuel: set stand-ins',
      army ? `army: GPU crowd (GilgalArmy, ${army.ranks} ranks)` : 'army: set stand-ins',
    ];
    return {
      name: 'gilgal',
      view,
      camera,
      status,
      disposed: false,
      ground: H,
      preroll(take, t0, dt) {
        // CUT v5 (cut7): G1 comes in on a hard cut at its shofar (blocking time TAKE_OFFSET 1.5). The set, the army, the
        // horn blowers and the hair run the 1.5 s of blocking before it while P7 is still on screen — exactly what they
        // did under CUT v4's black — so the frames from the shofar on are CUT v4's (walk phases, hair, mocap clocks)
        if (current !== take || prerolled !== take) {
          this.enter(take);
          prerolled = take;
        }
        this.tick(take, t0, dt);
      },
      frame(take, u, t, out) {
        // the cut3 cameras (FilmCams) first, else the set's own move
        if (gilgalCam(take, Math.max(0, Math.min(1, u)), t + (TAKE_OFFSET[take] ?? 0), H, out, ctx)) return true;
        const info = gilgal.shots[take as GilgalShotName];
        if (!info) return false;
        const e = info.shot.ease !== false ? smooth(Math.max(0, Math.min(1, u))) : u;
        const f = info.shot.at(e, t);
        out.pos.copy(f.pos);
        out.look.copy(f.look);
        out.fov = f.fov ?? 40;
        out.roll = f.roll ?? 0;
        return true;
      },
      enter(take) {
        const name = baseTake(take);
        if (!gilgal.shots[name]) return;
        if (prerolled === take && current === take) {
          // the cut into a take the set has already been running under the previous shot: keep its state
          prerolled = null;
          expMul = takeExposure(take);
          gilgal.setSunCheat(SUN_CHEAT[take] ?? null);
          return;
        }
        prerolled = null;
        const cont = current !== null && current !== take && baseTake(current) === name; // 'tear' -> 'tear:insert'
        current = take;
        expMul = takeExposure(take);
        // the light cheat of the tear and the verdict: the sun behind the two men (FilmCams.SUN_CHEAT)
        gilgal.setSunCheat(SUN_CHEAT[take] ?? null);
        // every cut: the strand-hair sims start from rest (a pose / heading jump across a cut — Samuel turns back
        // between 10b and 11 — otherwise whips the hair and beard outward for a second)
        resetHair(actors);
        // Samuel's long hair and beard flare outward under the slow-motion tear (the guide sim leaves its collision
        // field there): the tear uses the exact groom; the verdict close-up has the simulation ON (cut4: the wind in
        // his hair and beard, director-notes-v5 G6)
        const samuelActor = actors[1];
        try {
          samuelActor?.groom?.setSimulation(name !== 'tear');
        } catch {
          /* hair is cosmetic */
        }
        if (cont) return; // a cut inside one blocking beat: the actors keep performing
        gilgal.setBeat(name, TAKE_OFFSET[take] ?? 0);
        if (perf) {
          try {
            perf.enter(name);
          } catch (e) {
            console.warn('[film] performance enter', e);
          }
        }
      },
      tick(take, t0, dt) {
        const name = baseTake(take);
        if (!gilgal.shots[name]) return;
        if (current !== take) this.enter(take);
        const t = t0 + (TAKE_OFFSET[take] ?? 0);
        expMul = takeExposure(take, t0);
        gilgal.setBeat(name, t);
        if (army && armyOk) {
          try {
            army.crowd.viewportHeight = engine.renderer.domElement.height;
            army.setBeat(name, t);
            army.update(dt, camera);
          } catch (e) {
            // a crowd error never stops the film: the set's stand-in army takes over
            console.warn('[film] army failed; stand-ins', e);
            armyOk = false;
            army.group.visible = false;
            gilgal.showPlaceholders(true);
          }
        }
        if (perf) {
          try {
            perf.update(t, dt, camera, engine.renderer.domElement.height);
          } catch (e) {
            console.warn('[film] performance', e);
          }
        }
        if (rig && actors.length >= 2) {
          // face light of the close shots (faceLight.ts presets): G2 / G3 / G7 'afternoonKing' on Saul, G5b
          // 'tearProfile' on Saul's profile (cut4), G6 'verdict' on Samuel; off in the wides
          const who = take === 'king' || take === 'saulAlone' || take === 'spearRaised' || take === 'tear:insert' ? actors[0] : take === 'verdict' ? actors[1] : null;
          if (who) {
            rig.setPreset(take === 'verdict' ? 'verdict' : take === 'tear:insert' ? 'tearProfile' : 'afternoonKing', take === 'spearRaised' ? 0.7 : 1);
            rig.update(who.eyesWorld(tmp), camera);
          } else rig.setPreset('off', 0);
        }
      },
      focus(take, t0) {
        const name = baseTake(take);
        const info = gilgal.shots[name];
        if (!info) return null;
        const t = t0 + (TAKE_OFFSET[take] ?? 0);
        // the cut3 focus pulls (FilmCams: eyes, the fist, the soldiers -> Samuel), else the set's
        const f = gilgalFocus(take, t, H, actors.length >= 2 ? ctx : undefined, tmp);
        if (f) return f;
        const fp = info.focus(t);
        if (!fp) return null;
        return { point: tmp.copy(fp), fStop: info.fStop };
      },
      dispose() {
        army?.dispose();
        rig?.dispose();
        for (const a of actors) a.dispose();
        gilgal.dispose();
      },
    };
  }
}
