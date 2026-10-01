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
import { baseTake, FILM_CAM, gilgalCam, gilgalFocus, landCam, SUN_CHEAT, takeExposure, TAKE_OFFSET, type GilgalCtx, type LandCamCtx } from './FilmCams';

/**
 * THE FILM STAGE of the opening film (CUT v2: docs/intro-script-v2.md): every film-only set, crowd and actor, built behind the
 * loading screen and disposed set by set as the film leaves it (phones!). This module is imported lazily (it pulls in
 * src/film/land, src/film/gilgal, src/film/cast and src/film/crowd through dynamic imports only).
 *
 *   const stage = await FilmStage.load(engine, { onProgress });
 *   stage.sets.gilgal?.view                     ViewSpec for engine.setView
 *   stage.sets.gilgal?.frame(take, u, t, out)   camera of a take (u = normalised, t = shot seconds)
 *   stage.sets.gilgal?.enter(take)              on every cut into the set
 *   stage.sets.gilgal?.tick(take, t, dt)        per frame before engine.render (set beat, crowd, actors)
 *   stage.sets.gilgal?.focus(take, t)           DoF target
 *   stage.release('coast')                      dispose a set when the film is done with it; stage.dispose() = all
 *
 * ACTOR SLOTS (FilmActor per role; the cast / crowd teammates' modules drop in here — a failed or missing module falls
 * back to the set's own placeholders so the cut always plays):
 *   gilgal: saul, samuel (hero), armourBearer (desktop) -> GilgalPerformance; the army -> GilgalArmy
 *   ramah:  samuel ('near' LOD, own instance), elders (crowd LOD, 6 / 4 / 3 per tier) -> RamahPerformance
 *   coast:  the Philistine host -> PhilistineHost (column mode on the set's road)
 *
 * CAMERAS (cut3): every take is filmed by src/film/FilmCams.ts (landCam: 'flight' / 'glint' / 'elders'; gilgalCam:
 * the eight Gilgal takes incl. 'tear:insert') with the set's own move as a fallback; per-take exposure multiplies
 * the set's exposure (FilmCams.TAKE_LOOK). Test only: ?filmsets=judah,gilgal builds just those sets.
 */
export type FilmStageSet = Exclude<FilmSetName, 'black' | 'world'>;

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
}

export interface FilmStageOptions {
  onProgress?: (f: number, label: string) => void;
  /** build the cast (FilmActor humans). default true; ?filmcast=0 turns it off (placeholders) */
  cast?: boolean;
  /** build the GPU crowds. default true; ?filmcrowd=0 */
  crowd?: boolean;
}

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

export class FilmStage {
  readonly sets: Partial<Record<FilmStageSet, FilmSetHandle>> = {};
  loadMs = 0;
  private releaseTiles: (() => void) | null = null;
  private releaseClips: (() => void) | null = null;

  private constructor(private readonly engine: Engine) {}

  /** Build every film set (+ crowds and actors) and pre-compile its view. Never rejects: a failed set is left out. */
  static async load(engine: Engine, o: FilmStageOptions = {}): Promise<FilmStage> {
    const t0 = performance.now();
    const stage = new FilmStage(engine);
    const prog = o.onProgress ?? (() => {});
    const wantCast = o.cast !== false;
    const wantCrowd = o.crowd !== false;
    const q = engine.quality;
    const low = q.name === 'low';
    // budget of the loading bar per step
    const steps = { judah: 0.14, coast: 0.14, ramah: 0.16, gilgal: 0.4, compile: 0.16 };
    let base = 0;
    const sub = (w: number, label: string) => {
      const b = base;
      base += w;
      return (f: number) => prog(Math.min(0.999, b + w * Math.max(0, Math.min(1, f))), label);
    };
    const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));
    // tests: ?filmsets=judah,gilgal builds only those sets (the others fall back to world vistas)
    const only = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('filmsets') : null;
    const wanted = (n: FilmStageSet) => !only || only.split(',').includes(n);

    let landMod: typeof import('./land/LandSet') | null = null;
    try {
      landMod = await import('./land/LandSet');
      const data = await import('./land/landData');
      stage.releaseTiles = () => data.releaseTiles();
    } catch (e) {
      console.warn('[film] land sets unavailable', e);
    }
    let castMod: typeof import('./cast') | null = null;
    if (wantCast) {
      try {
        castMod = await import('./cast');
        const clips = [...castMod.GILGAL_CLIPS, ...castMod.RAMAH_CLIPS];
        await castMod.FilmActor.preloadClips(clips);
        const { MocapLibrary } = await import('../characters/mocap/MocapLibrary');
        stage.releaseClips = () => MocapLibrary.shared.release(FILM_ONLY_CLIPS);
      } catch (e) {
        console.warn('[film] cast unavailable (placeholders)', e);
        castMod = null;
      }
    }

    // ------------------------------------------------------------------ prologue: the land (shots 2, 4, 5)
    const land = async (loc: LandLocation, w: number, label: string) => {
      if (!landMod || !wanted(loc)) {
        base += w;
        return null;
      }
      const p = sub(w, label);
      try {
        const set = await landMod.LandSet.create({ renderer: engine.renderer, quality: engine.quality, location: loc, tex: engine.tex, onProgress: (f) => p(f * 0.6) });
        set.restoreSharedSun();
        engine.enforceTextureBudget(set.scene);
        return { set, snap: snapLand(), p };
      } catch (e) {
        console.warn(`[film] land set ${loc} failed`, e);
        return null;
      }
    };

    const judah = await land('judah', steps.judah, 'הָאָרֶץ…');
    if (judah && landMod) stage.sets.judah = stage.landHandle('judah', judah.set, judah.snap, landMod.landView);
    await yieldFrame();

    const coast = await land('coast', steps.coast, 'אֶרֶץ פְּלִשְׁתִּים…');
    if (coast && landMod) {
      let host: PhilistineHost | null = null;
      if (wantCrowd) {
        try {
          const { PhilistineHost } = await import('./crowd/PhilistineHost');
          const a = coast.set.anchors.coast!;
          host = await PhilistineHost.create({
            tier: engine.quality.tier,
            coast: { route: a.route, columnHead: a.columnHead, columnWidth: a.columnWidth },
            ground: (x, z) => coast.set.height.height(x, z),
          });
          coast.set.scene.add(host.group);
          coast.set.showPlaceholders(false);
        } catch (e) {
          console.warn('[film] Philistine host failed (placeholders)', e);
          host = null;
          coast.set.showPlaceholders(true);
        }
      }
      coast.p(1);
      stage.sets.coast = stage.landHandle('coast', coast.set, coast.snap, landMod.landView, { host });
    }
    await yieldFrame();

    const ramah = await land('ramah', steps.ramah * 0.4, 'הָרָמָה…');
    if (ramah && landMod) {
      let perf: RamahPerformance | null = null;
      const actors: FilmActor[] = [];
      const p = sub(steps.ramah * 0.6, 'הָרָמָה…');
      if (castMod) {
        try {
          const A = ramah.set.anchors.ramah!;
          const ground = (x: number, z: number) => ramah.set.height.height(x, z);
          const samuel = await castMod.FilmActor.create({ role: 'samuel', quality: q.name, msaa: q.msaa, lod: 'near', ground });
          actors.push(samuel);
          // P5 (cut4, director-notes-v5): "כֹּל זִקְנֵי יִשְׂרָאֵל" — 8-12 elders in a loose arc before Samuel (landSites marks
          // 0 speaker · 1 seated · 2-5 the arc · 6-7 the near pair the lens dollies in past · 8-10 the outer ring). The
          // 'near' LOD (real faces and beards) for the ones nearest the lens; fewer in all on phones.
          const tierName = engine.quality.tier;
          // (desktop-high: 3 'near' LODs — 4 with hair sims cost ~27 ms/frame; only the near pair 6-7 keeps its sim)
          const plan = tierName === 'desktop-high' ? { idx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], near: [6, 7, 0] }
            : tierName === 'desktop-medium' ? { idx: [0, 1, 2, 3, 4, 5, 6, 7], near: [6, 7] }
              : tierName === 'mobile-high' ? { idx: [0, 2, 3, 4, 5, 6, 7], near: [6, 7] }
                : { idx: [0, 2, 3, 6, 7], near: [6] };
          const marks = plan.idx.filter((i) => i < A.elders.length).map((i) => A.elders[i]);
          const elders: FilmActor[] = [];
          for (let k = 0; k < marks.length; k++) {
            const i = plan.idx[k];
            p((k + 1) / (marks.length + 1));
            await yieldFrame();
            const e = await castMod.FilmActor.create({ role: 'elder', quality: q.name, msaa: q.msaa, seed: i + 1, lod: plan.near.includes(i) ? 'near' : 'crowd', ground });
            // the strand-hair simulation only where the wind in the hair is seen close: the near pair (6, 7)
            if (i !== 6 && i !== 7) {
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
            a.addTo(ramah.set.scene);
            engine.enforceTextureBudget(a.root);
          }
          // `roles`: the landSites index of each elder (perf's parts: 0 rises, 2<->3 talk/nod, 6<->7 the near pair ...)
          perf = new castMod.RamahPerformance(samuel, elders, A.samuel, marks, ground, undefined, plan.idx.slice(0, marks.length));
          ramah.set.showPlaceholders(false);
        } catch (e) {
          console.warn('[film] Ramah cast failed (placeholders)', e);
          for (const a of actors) a.dispose();
          actors.length = 0;
          perf = null;
          ramah.set.showPlaceholders(true);
        }
      }
      p(1);
      stage.sets.ramah = stage.landHandle('ramah', ramah.set, ramah.snap, landMod.landView, { ramah: perf, actors });
    }
    await yieldFrame();

    // ------------------------------------------------------------------ Act I: Gilgal (G1-G7)
    if (wanted('gilgal')) {
      const p = sub(steps.gilgal, 'הַגִּלְגָּל…');
      try {
        const [{ GilgalSet }, { gilgalView }] = await Promise.all([import('./gilgal/GilgalSet'), import('./gilgal/gilgalView')]);
        const gilgal = await GilgalSet.create({ renderer: engine.renderer, quality: engine.quality, tex: engine.tex, onProgress: (f) => p(f * 0.3) });
        gilgal.restoreSharedSun();
        engine.enforceTextureBudget(gilgal.scene);
        let army: GilgalArmy | null = null;
        if (wantCrowd) {
          try {
            const { GilgalArmy } = await import('./crowd/GilgalArmy');
            army = await GilgalArmy.create({ tier: engine.quality.tier, ground: (x, z) => gilgal.ground.height(x, z) });
            gilgal.scene.add(army.group);
          } catch (e) {
            console.warn('[film] Gilgal army failed', e);
            army = null;
          }
        }
        p(0.5);
        let perf: GilgalPerformance | null = null;
        const actors: FilmActor[] = [];
        if (castMod) {
          try {
            const ground = (x: number, z: number) => gilgal.height(x, z);
            const saul = await castMod.FilmActor.create({ role: 'saul', quality: q.name, msaa: q.msaa, ground });
            actors.push(saul);
            p(0.65);
            await yieldFrame();
            const samuel = await castMod.FilmActor.create({ role: 'samuel', quality: q.name, msaa: q.msaa, ground });
            actors.push(samuel);
            p(0.8);
            let armourBearer: FilmActor | undefined;
            if (!low) {
              await yieldFrame();
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
        p(1);
        const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 90000);
        stage.sets.gilgal = stage.gilgalHandle(gilgal, gilgalView(gilgal, { camera: cam }), cam, army, perf, actors, rig);
      } catch (e) {
        console.warn('[film] Gilgal set failed', e);
      }
    }

    // ------------------------------------------------------------------ pre-compile every view for the final tier
    {
      const p = sub(steps.compile, 'מֵכִין אֶת הַסֶּרֶט…');
      const names = Object.keys(stage.sets) as FilmStageSet[];
      let i = 0;
      for (const name of names) {
        const h = stage.sets[name]!;
        try {
          const takes = INTRO_SHOTS.filter((s) => s.set === name);
          const f: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
          const poses: { pos: THREE.Vector3; look: THREE.Vector3 }[] = [];
          for (const s of takes) {
            h.enter(s.take);
            h.tick(s.take, s.dur * 0.5, 0);
            if (h.frame(s.take, 0.5, s.dur * 0.5, f)) poses.push({ pos: f.pos.clone(), look: f.look.clone() });
          }
          await engine.precompileView(h.view, poses);
        } catch (e) {
          console.warn(`[film] precompile ${name}`, e);
        }
        p(++i / names.length);
        await yieldFrame();
      }
    }
    stage.loadMs = performance.now() - t0;
    prog(1, '');
    return stage;
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
    // P4 (cut4): harsher light with real contrast — the grade's contrast raised for the take, put back on leaving
    let savedContrast: number | null = null;
    const restoreContrast = () => {
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
        if (name === 'coast') {
          const u = engine.post.grade.uniforms.uContrast;
          if (take === 'glint') {
            if (savedContrast === null) savedContrast = u.value as number;
            u.value = savedContrast * 1.14;
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
          // P5: on the elder who rises (the seated elder by the gate), then on Samuel as he turns his face away
          if (take === 'elders' && extra.actors.length > 1) {
            const k = Math.max(0, Math.min(1, (t - 2.0) / 0.6));
            const a = extra.actors[1].eyesWorld(tmp);
            const b = sam.eyesWorld(tmp2);
            return { point: a.lerp(b, k * k * (3 - 2 * k)), fStop: 3.2 };
          }
          return { point: sam.eyesWorld(tmp), fStop: 4 };
        }
        if (name === 'ramah' && set.anchors.ramah) return { point: tmp.copy(set.anchors.ramah.samuel.pos).add(new THREE.Vector3(0, 1.5, 0)), fStop: 4 };
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
