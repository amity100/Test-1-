import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import { shared } from '../core/Shared';
import type { ShotFrame } from '../gameplay/CameraRig';
import type { Player } from '../gameplay/Player';
import type { BearActor } from '../gameplay/BearActor';
import type { Flock, Animal } from '../characters/Flock';
import { LAYOUT } from '../world/Layout';
import { rachelShots, hideTreesNear, type RachelShots } from './land/rachel';
import type { FilmFocus } from './FilmStage';
import { FilmFlock, lambAtEdge } from './filmAnimals';

/**
 * The opening film's shots in the GAME WORLD around Bethlehem (CUT v2, docs/intro-script-v2.md): camera takes (lens,
 * framing, motivated moves) and the staging of the chapter's own actors — David (DavidModel.performFilm), the flock
 * and the lamb (Flock), the bear in the thicket (BearActor) — plus the eye-shine of H2. Everything is put back by
 * leave() (the game starts right after the film).
 *
 * Takes (cut3):
 *   'rachel-dawn'  P3  a low dolly through the grass toward Rachel's standing stone at first light (the sun behind it);
 *                      a shepherd and his flock cross behind the stone (David stands in for the anonymous shepherd:
 *                      a small figure against the light)
 *   'figure'       D1  a crane / orbit behind David on his rock revealing the valley, the flock grazing below
 *   'face'         D2  the push-in on his face as he turns into the light
 *   'thicket'      H1  low in the grass following the lamb to the thicket's edge; the light dims
 *   'lamb'         H2  a slow creep into the dark of the thicket: two eyes open
 *   'vista'            a slow crane over the hills (only as the stand-in for a film set that failed to build)
 *
 * World: +X east, -Z north; the chapter's sun is low in the east (LAYOUT SUN: 13 deg, azimuth 100). David's rock is
 * LAYOUT.start (+0.2, +2.3), the pasture SSE of it, the thicket (oaks / terebinths) 150 m east, Bethlehem on its ridge
 * NW, Rachel's pillar on the road north of the town.
 */
export interface FilmWorldHost {
  engine: Engine;
  player: Player;
  flock: Flock;
  bear: BearActor;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const ss = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));

interface Path {
  pos: THREE.CatmullRomCurve3;
  look: THREE.CatmullRomCurve3;
  fov: [number, number];
  ease: boolean;
}

/** heading (DavidModel / Player convention: forward = (sin h, 0, cos h)) of a horizontal direction */
const headingOf = (d: THREE.Vector3) => Math.atan2(d.x, d.z);

/** Tunable numbers of the world takes (window.__filmWorldCams under ?test=1). */
export const WORLD_CAM = {
  // P3: the dolly toward the stone (metres from the pillar along the view axis / to its right), lens height
  // (the lens just above the grass tops: closer, the grass cards read as flat shards; the dawn sky held down a little)
  // (cut4, director-notes-v5 P3: a REAL low dolly through the grass — 4.9 m in 3 s, the lens ~1 m up — and the flock
  //  crossing just behind the stone, 12-20 m from the lens, on the nearest ground the lens sees past it)
  rachel: { back0: 11.5, back1: 6.6, side0: -1.3, side1: -0.7, h0: 1.2, h1: 1.1, lookFar: 34, lookRight: 6.5, lookH: 1.7, fov0: 31, fov1: 27, flockD: 5, crossL: 10, crossR: 9, exp: 0.85 },
  // D1: the orbit / crane behind David (azimuth from his back, radius, height above his feet)
  // (the look starts on his shoulders — he sits right of centre — and slides out over the valley as the lens cranes up)
  // (cut4, D1 against the low sun: the lens behind his RIGHT shoulder from the west-south-west — clear of the boulder
  //  WNW of the rock — looking past him into the sun-lit haze: a rim-lit figure, the hills in layers)
  figure: { az0: 50, az1: 56, r0: 3.3, r1: 3.7, h0: 1.5, h1: 1.75, lookAhead1: 12, lookDown1: 2.4, lookMix0: 0.08, lookMix1: 0.2, headH: 1.55, fov0: 34, fov1: 37, exp: 0.86 },
  // D2 (cut4): the push-in on the face, BACKLIT — `az` = SkySystem azimuth of the lens seen from his head (the low sun
  // stands ~115° round from it, behind his far shoulder); at `turn` he turns his head INTO the light toward `turnAz`
  // (a 3/4 profile catching the sun), never into the lens
  face: { az: -15, d0: 2.95, d1: 2.15, side0: 0.16, side1: 0.08, lookSide: 0.26, fov0: 21, fov1: 17.5, turnDur: 1.6, turnAz: 72 },
  // H1 / H2: the hook
  // (H2: the bear deep in the shade and the picture dark — only the eye-shine, additive and not tone-mapped, reads)
  // (cut4, H1: the lamb ≈20-25 % of the frame height — the lens ~4.1 -> 3.6 m behind and beside it, 0.95 m up, looking a little down
  //  over the grass, which spare grass pushers flatten along the lens' line; the dark bushes of buildProps behind it)
  hook: { dark: 0.85, lambSpeed: 0.55, walkUntil: 1.3, camBack0: 3.9, camBack1: 3.5, camSide0: 1.3, camSide1: 1.0, camH: 0.95, lookIn: 1.4, lookH: 0.32, fov0: 34, fov1: 31, bearIn: 12.5, exp1: 0.62, exp2: 0.17, h2H: 1.02, h2Fov0: 12.5, h2Fov1: 10.5, eye: 0.12, shine: 2.0 },
};

export class FilmWorld {
  readonly takes = new Set(['rachel-dawn', 'figure', 'face', 'thicket', 'lamb', 'vista']);
  private readonly paths: Record<string, Path> = {};
  private readonly rachel: RachelShots | null;
  private readonly ground: (x: number, z: number) => number;
  private readonly rock = new THREE.Vector3();
  private readonly sunH = new THREE.Vector3();
  /** David's gaze over the land (between the low sun and the pasture) */
  private readonly viewDir = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly edge = new THREE.Vector3(); // the thicket's edge toward the pasture
  private readonly out = new THREE.Vector3(); // unit: thicket -> pasture
  private readonly lamb0 = new THREE.Vector3();
  private readonly bearAt = new THREE.Vector3();
  private readonly faceCam = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  /** P3: the pillar, its top, the view axis (toward the dawn), the line the flock crosses on */
  private readonly pillar = new THREE.Vector3();
  private readonly pillarTop = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly axisR = new THREE.Vector3();
  private readonly crossA = new THREE.Vector3();
  private readonly crossB = new THREE.Vector3();
  /** H1 / H2 film-only set dressing (cut4): bushes made from the world's own bush meshes (shared geometry + material,
   *  so no shader program is compiled mid-film); removed in leave() */
  private props: { h1: THREE.InstancedMesh[]; h2: THREE.InstancedMesh[] } | null = null;
  /** restores the world trees cleared right at the H1 lens (a trunk filled a quarter of the frame) */
  private restoreHookTrees: (() => void) | null = null;
  /** P3 / H1 birds (cut4): small dark silhouettes — crossing the dawn sky behind Rachel's stone, flying up out of the
   *  thicket when the birds fall silent (H1 beats.birdsStop). Built once (pre-compiled), hidden outside those takes. */
  private birds: { group: THREE.Group; mat: THREE.SpriteMaterial; tex: THREE.Texture; list: { s: THREE.Sprite; ph: number; k: number }[] } | null = null;
  private eyes: THREE.Group | null = null;
  private eyeMat: THREE.SpriteMaterial | null = null;
  private eyeTex: THREE.Texture | null = null;
  private saved: { a: Animal; pos: THREE.Vector3; heading: number; ai: boolean; state: Animal['state'] }[] = [];
  private staged = '';
  private extras: Animal[] = [];
  /** world exposure before the film's per-take multipliers (-1 = not captured) */
  private exposure0 = -1;
  /** exposure multiplier of the current take (applied in tick: enter() runs before the engine restores the world
   *  view, so the renderer still holds the outgoing film set's exposure there) */
  private expK = 1;
  /** restores the cypresses cleared right round Rachel's pillar for P3's composition (visual-bible 3.10) */
  private restoreTrees: (() => void) | null = null;
  /** H1: where the lamb stands when it stops (the hook paths are built from it) */
  private readonly lambStop = new THREE.Vector3();
  /** D1-D2: the flock staged inside the lens' view (anim: src/film/filmAnimals.ts) */
  private readonly ff: FilmFlock;
  private readonly stageCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 5000);

  constructor(private readonly h: FilmWorldHost) {
    const g = h.engine.terrain;
    this.ground = (x, z) => g.heightAt(x, z);
    const G = (x: number, z: number, up = 0) => V(x, this.ground(x, z) + up, z);
    const L = LAYOUT;
    this.rock.copy(G(L.start.x + 0.2, L.start.z + 2.3));
    const sd = shared.uSunDir.value as THREE.Vector3;
    this.sunH.set(sd.x, 0, sd.z).normalize();
    const toPasture = V(L.pasture.x - this.rock.x, 0, L.pasture.z - this.rock.z).normalize();
    this.viewDir.copy(this.sunH).multiplyScalar(0.45).addScaledVector(toPasture, 0.55).normalize();
    this.side.set(-this.viewDir.z, 0, this.viewDir.x); // to David's right (viewed from behind)
    let rs: RachelShots | null = null;
    try {
      rs = rachelShots(this.ground, h.engine.village.rachelPillar);
    } catch (e) {
      console.warn('[film] rachel shots', e);
    }
    this.rachel = rs;
    // P3 geometry: the lens looks from the west toward the dawn (the low sun just beside the stone)
    this.pillar.copy(h.engine.village.rachelPillar);
    this.pillar.y = this.ground(this.pillar.x, this.pillar.z);
    this.pillarTop.copy(rs?.anchors.pillarTop ?? this.pillar.clone().add(V(0, 2.6, 0)));
    this.axis.set(this.sunH.x, 0, this.sunH.z).normalize();
    // swing the axis a little south of the sun so the sun disc stands beside the stone, not behind it
    this.axis.applyAxisAngle(V(0, 1, 0), -0.12);
    this.axisR.set(-this.axis.z, 0, this.axis.x);
    this.buildRachelCross();
    // the thicket (H1-H2)
    const T = L.thicket;
    this.out.set(L.pasture.x - T.x, 0, L.pasture.z - T.z).normalize();
    this.edge.set(T.x + this.out.x * T.r * 0.92, 0, T.z + this.out.z * T.r * 0.92);
    this.edge.y = this.ground(this.edge.x, this.edge.z);
    this.lamb0.copy(this.edge).addScaledVector(this.out, 3.1);
    this.lamb0.y = this.ground(this.lamb0.x, this.lamb0.z);
    this.bearAt.copy(this.edge).addScaledVector(this.out, -WORLD_CAM.hook.bearIn);
    this.bearAt.y = this.ground(this.bearAt.x, this.bearAt.z);
    this.lambStop.copy(this.lamb0).addScaledVector(this.out, -WORLD_CAM.hook.lambSpeed * WORLD_CAM.hook.walkUntil);
    this.lambStop.y = this.ground(this.lambStop.x, this.lambStop.z);
    this.ff = new FilmFlock(h.flock, this.ground);
    this.buildPaths();
    try {
      this.buildBirds();
    } catch (e) {
      console.warn('[film] birds', e);
    }
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1') {
      (window as unknown as Record<string, unknown>).__filmWorldCams = WORLD_CAM;
    }
  }

  /** P3: the line behind the stone the flock crosses on — the nearest distance (>= flockD) where the ground is seen */
  private buildRachelCross() {
    const c = WORLD_CAM.rachel;
    const P = this.pillar;
    const lens = P.clone().addScaledVector(this.axis, -c.back1);
    lens.y = this.ground(lens.x, lens.z) + c.h1;
    let best = c.flockD;
    for (let d = c.flockD; d <= c.flockD + 40; d += 2) {
      const q = P.clone().addScaledVector(this.axis, d);
      q.y = this.ground(q.x, q.z) + 0.45;
      let seen = true;
      for (let k = 1; k < 24 && seen; k++) {
        const r = lens.clone().lerp(q, k / 24);
        if (this.ground(r.x, r.z) > r.y - 0.05) seen = false;
      }
      if (seen) {
        best = d;
        break;
      }
    }
    // north -> south across the view (frame left -> right), about the width of the frame at that distance
    this.crossA.copy(P).addScaledVector(this.axis, best).addScaledVector(this.axisR, -c.crossL);
    this.crossB.copy(P).addScaledVector(this.axis, best + 1.5).addScaledVector(this.axisR, c.crossR);
  }

  private path(pos: THREE.Vector3[], look: THREE.Vector3[], fov: [number, number], ease = true): Path {
    // keep every camera key above the ground
    for (const p of pos) p.y = Math.max(p.y, this.ground(p.x, p.z) + 0.35);
    return { pos: new THREE.CatmullRomCurve3(pos, false, 'centripetal'), look: new THREE.CatmullRomCurve3(look, false, 'centripetal'), fov, ease };
  }

  private buildPaths() {
    const L = LAYOUT;
    const G = (x: number, z: number, up = 0) => V(x, this.ground(x, z) + up, z);
    const beth = G(L.bethlehem.x, L.bethlehem.z, 14);
    const pasture = G(L.pasture.x, L.pasture.z, 1.2);
    // the stand-in vista for a film set that failed to build: a high descending crane over the pastures
    this.paths.vista = this.path(
      [G(430, 150, 260), G(300, 118, 150), G(170, 88, 62)],
      [beth.clone(), beth.clone().lerp(pasture, 0.25), beth.clone().lerp(pasture, 0.62)],
      [44, 38],
    );
    // D2: see frame('face') — and the point his head turns to: far out toward the low sun (into the light)
    const ta = THREE.MathUtils.degToRad(WORLD_CAM.face.turnAz);
    this.faceCam.copy(this.rock).add(V(Math.sin(ta) * 40, 1.7, Math.cos(ta) * 40));
  }

  /** Camera of a world take at normalised u — false for an unknown take. */
  frame(take: string, u: number, t: number, out: ShotFrame): boolean {
    const uu = clamp01(u);
    const e = smooth(uu);
    out.roll = 0;
    switch (take) {
      case 'rachel-dawn': {
        // P3 — low in the grass, a dolly toward the stone; the stone on the left third against the dawn
        const c = WORLD_CAM.rachel;
        const P = this.pillar;
        out.pos.copy(P).addScaledVector(this.axis, -lerp(c.back0, c.back1, e)).addScaledVector(this.axisR, lerp(c.side0, c.side1, e));
        out.pos.y = this.ground(out.pos.x, out.pos.z) + lerp(c.h0, c.h1, e);
        out.look.copy(P).addScaledVector(this.axis, c.lookFar).addScaledVector(this.axisR, c.lookRight);
        out.look.y = this.pillarTop.y + c.lookH - 2.6 + 0.25 * e;
        out.fov = lerp(c.fov0, c.fov1, e);
        out.roll = 0.012 * Math.sin(uu * 2.4);
        return true;
      }
      case 'figure': {
        // D1 — behind him (his right shoulder, against the low sun); the lens orbits round toward his back and cranes up
        // while the look leaves his shoulders for the valley below (the flock grazing on the slope, the hills in haze)
        const c = WORLD_CAM.figure;
        const az = THREE.MathUtils.degToRad(lerp(c.az0, c.az1, e));
        // behind = -viewDir; the azimuth turns it toward his left (negative = left side)
        const back = this.tmp.copy(this.viewDir).negate();
        back.applyAxisAngle(V(0, 1, 0), az); // negative = toward his left (the side clear of the boulder behind him)
        const r = lerp(c.r0, c.r1, e);
        out.pos.copy(this.rock).addScaledVector(back, r);
        out.pos.y = Math.max(this.ground(out.pos.x, out.pos.z) + 0.6, this.rock.y + lerp(c.h0, c.h1, e));
        const shoulders = this.tmp2.copy(this.rock).add(V(0, c.headH, 0));
        const valley = this.rock.clone().addScaledVector(this.viewDir, c.lookAhead1);
        valley.y = this.ground(valley.x, valley.z) + 1.0;
        valley.y = Math.max(valley.y, this.rock.y - c.lookDown1);
        out.look.copy(shoulders).lerp(valley, lerp(c.lookMix0, c.lookMix1, ss(0.15, 1, uu)));
        // out of the light-flash: the lens settles down from the sky into the hills (the answer to G7's whip up)
        const settle = 1 - ss(0, 0.85, t);
        out.look.y += 3.2 * settle * settle;
        out.fov = lerp(c.fov0, c.fov1, e);
        out.roll = -0.012 + 0.018 * e;
        return true;
      }
      case 'face': {
        // D2 — the push-in on his face, backlit: the lens SSW of his head, the low sun behind his far shoulder (a rim on
        // the curls, the ear, the cheek; the face in the soft bounce of the sunlit grass); his face right of centre,
        // the verse at frame left; he turns his head into the light at `turn`
        const c = WORLD_CAM.face;
        const fa = THREE.MathUtils.degToRad(c.az);
        const camDir = this.tmp.set(Math.sin(fa), 0, Math.cos(fa));
        const fs = this.tmp2.set(-camDir.z, 0, camDir.x);
        const head = V(this.rock.x, this.rock.y + 1.56, this.rock.z);
        out.pos.copy(head).addScaledVector(camDir, lerp(c.d0, c.d1, e)).addScaledVector(fs, lerp(c.side0, c.side1, e));
        out.pos.y += lerp(-0.05, -0.02, e);
        out.look.copy(head).addScaledVector(fs, c.lookSide);
        out.look.y += 0.05 + 0.015 * e;
        out.fov = lerp(c.fov0, c.fov1, e);
        return true;
      }
      case 'thicket': {
        // H1 — low in the grass behind and beside the lamb, following it to the dark edge of the thicket
        const c = WORLD_CAM.hook;
        const lamb = this.h.flock.lamb.position;
        const Sx = this.tmp.set(-this.out.z, 0, this.out.x);
        out.pos.copy(lamb).addScaledVector(this.out, lerp(c.camBack0, c.camBack1, e)).addScaledVector(Sx, lerp(c.camSide0, c.camSide1, e));
        out.pos.y = this.ground(out.pos.x, out.pos.z) + c.camH + 0.05 * e;
        out.look.copy(lamb).addScaledVector(this.out, -c.lookIn);
        out.look.y = this.ground(out.look.x, out.look.z) + c.lookH + 0.06 * e;
        out.fov = lerp(c.fov0, c.fov1, e);
        return true;
      }
      case 'lamb': {
        // H2 — over the lamb into the dark between the trunks: a slow creep; the eyes open
        const c = WORLD_CAM.hook;
        const Sx = this.tmp.set(-this.out.z, 0, this.out.x);
        const base = this.lambStop;
        // (over the lamb's back into the dark between the trunks)
        out.pos.copy(base).addScaledVector(this.out, 1.35 - 0.55 * e).addScaledVector(Sx, 0.38);
        out.pos.y = this.ground(out.pos.x, out.pos.z) + c.h2H;
        out.look.copy(this.bearAt).add(V(0, 0.85, 0));
        // (cut4: a longer lens than cut v2's 17° — the two eyes ~12 cm apart must read as a PAIR at 640×360)
        out.fov = lerp(c.h2Fov0, c.h2Fov1, e);
        return true;
      }
    }
    const p = this.paths[take];
    if (!p) return false;
    const pe = p.ease ? e : uu;
    p.pos.getPoint(pe, out.pos);
    p.look.getPoint(pe, out.look);
    out.fov = p.fov[0] + (p.fov[1] - p.fov[0]) * pe;
    return true;
  }

  // ---------------------------------------------------------------------------------------------- staging
  /** Stage the world for a take (on the cut into it). */
  enter(take: string) {
    const { player, flock } = this.h;
    const m = player.model;
    m.resetDynamics();
    if (take === 'rachel-dawn') {
      this.showProps(null);
      if (this.staged !== 'rachel') {
        this.staged = 'rachel';
        // visual-bible 3.10: no cypress by the tomb — clear ONLY the trees immediately round the pillar for this
        // composition (small radius; the game world's vegetation is put back when the film leaves the pillar)
        if (!this.restoreTrees) {
          try {
            this.restoreTrees = hideTreesNear(this.h.engine.scene, this.h.engine.village.rachelPillar, 16);
          } catch (e) {
            console.warn('[film] hideTreesNear', e);
          }
        }
        // the shepherd crosses behind the stone on the visible line (south -> north: frame right -> left, toward the
        // stone) and his flock follows him in a loose drove into the open right half of the frame (perf's
        // FilmFlock.stageFollow: grazing, dropping behind, trotting to catch up)
        const dir = this.tmp2.copy(this.crossA).sub(this.crossB).setY(0).normalize();
        this.placeShepherd(0);
        try {
          this.ff.stageFollow(() => this.h.player.pos, dir, { count: 10, back: [1.6, 7.5], spread: 2.4 });
        } catch (e) {
          console.warn('[film] P3 flock', e);
        }
        void flock;
      }
      m.performFilm(null);
      m.hold = 'none';
      m.lookTarget = null;
      this.expK = WORLD_CAM.rachel.exp;
      return;
    }
    // David, the flock and the hook: everything back near the pasture
    if (this.staged === 'rachel') {
      this.ff.restore();
      this.restoreFlock();
      this.putTreesBack();
      this.staged = '';
    }
    if (take === 'figure' || take === 'face' || take === 'vista') {
      this.placeDavid();
      this.hideBear();
      this.showProps(null);
      this.putHookTreesBack();
      if (this.staged !== 'david') {
        this.staged = 'david';
        this.stageFlockInView();
      }
      this.expK = take === 'figure' ? WORLD_CAM.figure.exp : 1;
      return;
    }
    if (take === 'thicket' || take === 'lamb') {
      this.placeDavid();
      if (this.staged !== 'hook') {
        this.staged = 'hook';
        this.ff.restore();
        this.stageHook();
      }
      // H1: the bear is not in the picture yet (its breath is heard); H2: the eyes in the dark
      if (take === 'lamb') this.showBear();
      else {
        this.hideBear();
        if (!this.eyes) this.buildEyes();
      }
      this.showProps(take);
      if (take === 'thicket' && !this.restoreHookTrees) {
        try {
          const f = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 32, roll: 0 };
          this.frame('thicket', 0.5, 1.25, f);
          this.restoreHookTrees = hideTreesNear(this.h.engine.scene, f.pos, 3.2, ['oak', 'terebinth', 'carob', 'olive']);
        } catch (e) {
          console.warn('[film] hook trees', e);
        }
      }
      this.expK = 1;
    }
  }

  private putHookTreesBack() {
    const r = this.restoreHookTrees;
    this.restoreHookTrees = null;
    try {
      r?.();
    } catch (e) {
      console.warn('[film] restore hook trees', e);
    }
  }

  /**
   * The hook's film-only bushes (director-notes-v5 H1/H2): H1 a dense dark wall of bushes along the thicket's edge
   * BEHIND the lamb (not flat grass cards); H2 foliage silhouettes near the lens and round the bear, framing one gap
   * onto its head, a low bush in front of its body. The two takes are cut together (a cheat between angles).
   */
  private buildProps() {
    if (this.props) return this.props;
    // the world's bushes: bark stems ('tree-bush') and leaf domes in chunks ('tree-bush#N'); one source mesh per unique
    // geometry, leaves and stems kept apart (a prop bush = one leaf dome + one stem)
    const leaves: THREE.InstancedMesh[] = [], stems: THREE.InstancedMesh[] = [];
    const seen = new Set<string>();
    this.h.engine.vegetation?.group.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || !o.name.startsWith('tree-bush') || seen.has(m.geometry.uuid)) return;
      seen.add(m.geometry.uuid);
      (m.geometry.getAttribute('position').count >= 60 ? leaves : stems).push(m);
    });
    const O = this.out, Sx = V(-O.z, 0, O.x);
    const at = (b: THREE.Vector3, f: number, l: number) => b.clone().addScaledVector(O, f).addScaledVector(Sx, l);
    const E = this.edge, Ls = this.lambStop, Bp = this.bearAt;
    // [position, scale, yaw]; f = metres out of the thicket toward the pasture, l = lateral (the H1 lens sits at +0.85)
    const H1: [THREE.Vector3, number, number][] = [
      [at(E, 0.55, -1.5), 1.45, 0.4], [at(E, 0.15, 0.3), 1.75, 2.1], [at(E, 0.85, 1.9), 1.3, 1.2], [at(E, -0.9, -0.4), 2.1, 3.3],
      [at(E, -0.6, 1.4), 1.9, 5.0], [at(E, 0.35, -3.1), 1.6, 0.9], [at(E, -1.4, -2.3), 2.3, 4.2], [at(E, -1.2, 3.0), 2.2, 1.7],
      [at(E, 1.1, 3.6), 1.2, 2.6],
    ];
    const H2: [THREE.Vector3, number, number][] = [
      // near silhouettes at the frame's sides (2-4 m from the lens)
      [at(Ls, -1.0, -2.2), 1.15, 0.7], [at(Ls, -1.6, 2.5), 1.3, 2.4], [at(Ls, -0.4, 3.2), 1.0, 4.4], [at(Ls, -0.7, -3.1), 1.2, 5.6],
      // round the bear: a clear gap onto its head on the lens' line, a low bush in front of its body, a dark mass
      // behind it
      [at(Bp, 3.0, -2.5), 1.3, 1.1], [at(Bp, 2.6, 2.6), 1.4, 3.0], [at(Bp, 1.3, 0.25), 0.62, 0.2], [at(Bp, -1.8, 0.3), 2.2, 2.2],
      [at(Bp, -0.6, -2.6), 1.8, 4.9], [at(Bp, 0.1, 2.8), 1.9, 0.5],
    ];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = V(0, 1, 0);
    const make = (list: [THREE.Vector3, number, number][], name: string) => {
      const out: THREE.InstancedMesh[] = [];
      const add = (src: THREE.InstancedMesh[]) => src.forEach((m, v) => {
        const mine = list.filter((_, i) => i % src.length === v);
        if (!mine.length) return;
        const im = new THREE.InstancedMesh(m.geometry, m.material, mine.length);
        mine.forEach(([p, s, yaw], k) => {
          const y = this.ground(p.x, p.z) - 0.08;
          m4.compose(V(p.x, y, p.z), q.setFromAxisAngle(up, yaw), sc.set(s * 1.05, s * 0.95, s * 1.05));
          im.setMatrixAt(k, m4);
        });
        im.castShadow = true;
        im.receiveShadow = true;
        im.name = name;
        im.visible = false;
        im.computeBoundingSphere();
        this.h.engine.scene.add(im);
        out.push(im);
      });
      add(leaves);
      add(stems);
      return out;
    };
    this.props = { h1: make(H1, 'film:h1-bushes'), h2: make(H2, 'film:h2-bushes') };
    return this.props;
  }

  private showProps(take: string | null) {
    if (take === null && !this.props) return;
    const p = this.buildProps();
    for (const m of p.h1) m.visible = take === 'thicket';
    for (const m of p.h2) m.visible = take === 'lamb';
  }

  private removeProps() {
    if (!this.props) return;
    for (const m of [...this.props.h1, ...this.props.h2]) {
      m.removeFromParent();
      m.dispose(); // the instance buffers only: the geometry and material belong to the world's bushes
    }
    this.props = null;
  }

  /** P3: the shepherd on the crossing line behind the stone at shot second t (from the right of the frame, walking
   *  north = frame left, toward the stone; his flock trails behind him in the open right half) */
  private placeShepherd(t: number) {
    const A = this.crossA, B = this.crossB;
    const dir = V(A.x - B.x, 0, A.z - B.z);
    const len = dir.length();
    dir.normalize();
    const s = len * 0.1 + 0.9 * t;
    const x = B.x + dir.x * s - dir.z * 0.8, z = B.z + dir.z * s + dir.x * 0.8;
    this.h.player.place(x, z, Math.atan2(dir.x, dir.z));
  }

  /** spare grass pushers 3-5 back to rest (gameplay uses 0-2) */
  private clearPushers() {
    const pu = shared.uPushers.value as THREE.Vector4[];
    for (let k = 3; k < Math.min(6, pu.length); k++) pu[k].set(0, -999, 0, 0);
  }

  /** The film leaves the world for a film set / black: the world's own exposure comes back first. */
  suspend() {
    this.restoreExposure();
  }

  /** Per frame (world takes): the actors' performance. `t` = shot seconds. */
  tick(take: string, t: number, dt: number) {
    const { player, flock } = this.h;
    const m = player.model;
    const c = WORLD_CAM.hook;
    if (take !== 'thicket' && take !== 'lamb') this.setExposure(this.expK);
    if (take !== 'rachel-dawn' && take !== 'thicket') this.clearPushers();
    this.tickBirds(take, t);
    switch (take) {
      case 'rachel-dawn': {
        // the shepherd walks across the view behind the stone, his flock following (FilmFlock.stageFollow); the grass
        // right in front of the lens pressed down (spare pushers 3-5): no flat cards across the lens
        this.placeShepherd(t);
        const pu = shared.uPushers.value as THREE.Vector4[];
        if (pu.length >= 6) {
          const cp = this.h.engine.camera.position;
          for (let k = 0; k < 3; k++) {
            const x = cp.x + this.axis.x * (0.9 + 1.3 * k), z = cp.z + this.axis.z * (0.9 + 1.3 * k);
            pu[3 + k].set(x, this.ground(x, z), z, 1.7);
          }
        }
        player.speed = 1.0;
        m.speed = 1.0;
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      }
      case 'figure':
        m.performFilm('back', t);
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      case 'face':
        // he turns INTO the light (faceCam = a point 40 m out toward the low sun), not into the lens: offLens 0
        m.performFilm('reveal', t, { look: this.faceCam, turnAt: 0.5, turnDur: WORLD_CAM.face.turnDur, offLens: 0 });
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      case 'vista':
        m.performFilm('wide', t);
        return;
      case 'thicket':
      case 'lamb': {
        m.performFilm('wide', t + 10);
        const lamb = flock.lamb;
        // H1: the grass between the lens and the lamb pressed down (spare pushers 3-5 of the shared grass field)
        const pu = shared.uPushers.value as THREE.Vector4[];
        if (take === 'thicket' && pu.length >= 6) {
          // round the lamb (it stands in a trodden patch, readable), then two along the lens' line
          const cp = this.h.engine.camera.position;
          const F = [1.0, 0.72, 0.42], R = [1.9, 1.7, 1.6];
          for (let k = 0; k < 3; k++) {
            const x = lerp(cp.x, lamb.position.x, F[k]), z = lerp(cp.z, lamb.position.z, F[k]);
            pu[3 + k].set(x, this.ground(x, z), z, R[k]);
          }
        } else this.clearPushers();
        // H1: it walks to the edge, grazes, and at beats.lambHead (1.5 s) its head comes up toward the thicket (anim's
        // lambAtEdge); H2: it stands listening
        lambAtEdge(lamb, take === 'thicket' ? t : 2.5 + t, { lift: 1.5, toward: this.bearAt, walkUntil: c.walkUntil, speed: c.lambSpeed });
        this.tickBear(take, t, dt);
        // the light goes out of the hook: down through H1, darker still in the thicket (H2)
        const k = take === 'thicket' ? ss(0.2, 2.5, t) : 1;
        // H2: down into the dark at once (the bear only a suggestion; the eye-shine is additive and not tone-mapped)
        this.setExposure(take === 'thicket' ? lerp(1, c.exp1, k) : lerp(c.exp1 * 0.55, c.exp2, ss(0, 0.6, t)));
        return;
      }
    }
  }

  /** DoF target of a world take. */
  focus(take: string, t: number): FilmFocus | null {
    const m = this.h.player.model;
    const eye = (out: THREE.Vector3) => {
      const s = m.human?.sockets?.eyeL;
      if (s) return s.getWorldPosition(out);
      return out.copy(this.rock).add(V(0, 1.58, 0));
    };
    switch (take) {
      case 'figure': {
        // on his head, then deeper as the valley opens
        const p = eye(this.tmp);
        const far = this.tmp2.copy(this.rock).addScaledVector(this.viewDir, 14);
        return { point: p.lerp(far, 0.35 * ss(1.5, 4, t)), fStop: 4 };
      }
      case 'face':
        return { point: eye(this.tmp), fStop: 1.8 };
      case 'rachel-dawn':
        return { point: this.tmp.copy(this.pillar).add(V(0, 1.4, 0)), fStop: 5.6 };
      case 'thicket':
        return { point: this.tmp.copy(this.h.flock.lamb.position).add(V(0, 0.4, 0)), fStop: 2.8 };
      case 'lamb':
        // the focus pulls from the lamb's back into the dark
        return { point: this.tmp.copy(this.lambStop).lerp(this.bearAt, ss(0.1, 0.8, t)).add(V(0, 0.8, 0)), fStop: 2.2 };
      default:
        return null;
    }
  }

  private placeDavid() {
    const { player } = this.h;
    const heading = headingOf(this.viewDir);
    if (Math.hypot(player.pos.x - this.rock.x, player.pos.z - this.rock.z) > 0.05 || Math.abs(player.heading - heading) > 1e-3) {
      player.place(this.rock.x, this.rock.z, heading);
    }
    player.speed = 0;
    const m = player.model;
    m.hold = 'hero';
    m.staffMode = 'plant';
    m.lookTarget = null;
  }

  private saveFlock() {
    if (this.saved.length) return;
    for (const a of this.h.flock.animals) this.saved.push({ a, pos: a.position.clone(), heading: a.heading, ai: a.aiEnabled, state: a.state });
  }
  private restoreFlock() {
    for (const s of this.saved) {
      if (s.a.state === 'carried') continue;
      s.a.position.copy(s.pos);
      s.a.heading = s.heading;
      s.a.aiEnabled = s.ai;
      s.a.manualSpeed = 0;
      s.a.state = 'graze';
    }
    this.saved.length = 0;
  }

  /** D1-D2: the flock grazing and walking below David INSIDE the D1 lens' first frame (FilmFlock.stageInView) */
  private stageFlockInView() {
    const f = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 36, roll: 0 };
    this.frame('figure', 0.25, 1.0, f);
    const c = this.stageCam;
    c.aspect = this.h.engine.camera.aspect || 16 / 9;
    c.fov = f.fov ?? 36;
    c.position.copy(f.pos);
    c.lookAt(f.look);
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
    try {
      // (cut4, director-notes-v5 D1: the flock IN FRAME below him — from the lens on the rock the slope 4-7 m out lies
      //  under the frame and the letterbox, so the drove is staged where the lens sees the ground: 7-30 m)
      let n = this.ff.stageInView(c, this.rock, { near: 7, far: 30, max: 14 });
      // the slope beyond the rock drops out of the frame: then the drove where this lens does see ground (the slope
      // and the valley floor further out) — in frame, smaller
      if (n < 6) n = this.ff.stageInView(c, this.rock, { near: 9, far: 70, max: 14, clear: 0.15 });
      if (n > 0) return;
    } catch (e) {
      console.warn('[film] flock staging', e);
    }
    this.stageFlockBelow();
  }

  /** fallback: the flock grazing and walking on the slope below David along his gaze */
  private stageFlockBelow() {
    const { flock } = this.h;
    this.saveFlock();
    const D = this.viewDir, S = this.side;
    flock.animals.forEach((a, i) => {
      if (a.state === 'carried') return;
      const f = 15 + ((i * 29) % 23) + (i % 3) * 2.5;
      const s = (((i * 53) % 29) - 14) * 1.1;
      const x = this.rock.x + D.x * f + S.x * s, z = this.rock.z + D.z * f + S.z * s;
      a.position.set(x, this.ground(x, z), z);
      a.heading = Math.atan2(D.x, D.z) + (((i * 17) % 11) - 5) * 0.32;
      a.aiEnabled = false;
      const walks = i % 3 === 1;
      a.state = walks ? 'walk' : 'graze';
      a.manualSpeed = walks ? 0.28 + (i % 4) * 0.05 : 0;
    });
  }

  /** the lamb near the thicket's edge, a few sheep grazing behind it at the sides (H1-H2) */
  private stageHook() {
    const { flock } = this.h;
    this.saveFlock();
    const lamb = flock.lamb;
    const O = this.out, Sx = V(-O.z, 0, O.x);
    lamb.position.copy(this.lamb0);
    lamb.heading = Math.atan2(-O.x, -O.z);
    lamb.aiEnabled = false;
    lamb.state = 'walk';
    lamb.manualSpeed = WORLD_CAM.hook.lambSpeed;
    const others = flock.animals.filter((a) => a !== lamb && a.state !== 'carried');
    others.sort((a, b) => a.position.distanceToSquared(this.lamb0) - b.position.distanceToSquared(this.lamb0));
    this.extras = others.slice(0, 3);
    // out in the pasture behind the lens' line, off the lens (never between it and the lamb)
    const spots: [number, number][] = [[6.5, -4.2], [9.5, 3.6], [13.0, -2.0]];
    this.extras.forEach((a, i) => {
      const [f, s] = spots[i];
      const x = this.lamb0.x + O.x * f + Sx.x * s, z = this.lamb0.z + O.z * f + Sx.z * s;
      a.position.set(x, this.ground(x, z), z);
      a.heading = Math.atan2(-O.x, -O.z) + (i - 1) * 0.8;
      a.aiEnabled = false;
      a.state = 'graze';
      a.manualSpeed = 0;
    });
  }

  private showBear() {
    const { bear } = this.h;
    if (!bear.visible) {
      bear.place(this.bearAt.x, this.bearAt.z, Math.atan2(this.out.x, this.out.z));
      bear.visible = true;
      bear.model.hold = 'none';
      bear.model.roar = 0;
    }
    if (!this.eyes) this.buildEyes();
  }
  private hideBear() {
    const { bear } = this.h;
    bear.model.eyeShine = 0;
    bear.model.darkness = 0;
    if (bear.visible) bear.visible = false;
    if (this.eyes) this.eyes.visible = false;
  }

  private buildBirds() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const x = c.getContext('2d')!;
    // a small bird in flight seen from below / the side: two swept wings and a body (a soft-edged dark silhouette)
    x.fillStyle = 'rgba(28,22,18,1)';
    x.beginPath();
    x.moveTo(2, 9);
    x.quadraticCurveTo(18, 6, 30, 17);
    x.quadraticCurveTo(32, 21, 34, 17);
    x.quadraticCurveTo(46, 6, 62, 9);
    x.quadraticCurveTo(46, 12, 35, 22);
    x.quadraticCurveTo(32, 27, 29, 22);
    x.quadraticCurveTo(18, 12, 2, 9);
    x.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, color: 0x5a4c40, transparent: true, depthWrite: false, fog: false });
    const group = new THREE.Group();
    group.name = 'film:birds';
    const list: { s: THREE.Sprite; ph: number; k: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.3, 0.15, 1);
      sp.position.set(0, -500, 0);
      group.add(sp);
      list.push({ s: sp, ph: (i * 0.37) % 1, k: i });
    }
    this.h.engine.scene.add(group);
    // compile the sprite program now (behind the loading screen), not on the first frame of P3
    try {
      this.h.engine.renderer.compile(group, this.h.engine.camera, this.h.engine.scene);
    } catch {
      /* a later first render compiles it */
    }
    group.visible = false;
    this.birds = { group, mat, tex, list };
  }

  /**
   * Birds per take (t = shot seconds): P3 a loose line of five crossing the dawn sky behind the stone, frame left ->
   * right, high; H1 five flying up and away out of the thicket's bushes at beats.birdsStop (0.4 s).
   */
  private tickBirds(take: string, t: number) {
    const b = this.birds;
    if (!b) return;
    const on = take === 'rachel-dawn' || take === 'thicket';
    b.group.visible = on;
    if (!on) return;
    const cam = this.h.engine.camera;
    for (const { s, ph, k } of b.list) {
      const flap = 0.5 + 0.5 * Math.sin((t * 9.5 + ph * 6.28) * (1 + k * 0.07));
      if (take === 'rachel-dawn') {
        // 25-40 m behind the stone, 9-14 m up, gliding south across the view
        const P = this.pillar;
        const d = 28 + ((k * 7) % 11), lat = -16 + t * (5.2 + (k % 3) * 0.6) - k * 2.2;
        s.position.copy(P).addScaledVector(this.axis, d).addScaledVector(this.axisR, lat);
        s.position.y = this.pillarTop.y + 8 + ((k * 5) % 6) + 0.6 * Math.sin(t * 1.3 + k);
        s.scale.set(0.42, 0.42 * (0.25 + 0.75 * flap) * 0.5, 1);
        s.visible = k < 5;
      } else {
        // out of the bushes at the thicket's edge, up and away over the lens' shoulder
        const go = Math.max(0, t - 0.4 - k * 0.07);
        const O = this.out, Sx = this.tmp.set(-O.z, 0, O.x);
        s.position.copy(this.edge).addScaledVector(O, -0.6 + go * (1.6 + k * 0.25)).addScaledVector(Sx, -2.4 + k * 1.05 + go * (k % 2 ? 0.8 : -0.6));
        s.position.y = this.ground(this.edge.x, this.edge.z) + 0.6 + (k % 3) * 0.25 + go * (1.1 + (k % 2) * 0.4) + go * go * 0.5;
        const sz = go > 0 ? 0.26 : 0.0001;
        s.scale.set(sz, sz * (0.3 + 0.7 * flap) * 0.5, 1);
        s.visible = go > 0 && k < 5;
      }
      void cam;
    }
  }

  /** the bear in the dark: a breath, the head lifting toward the lamb; the eyes open (the tapetum catching the light) */
  private tickBear(take: string, t: number, dt: number) {
    const { bear } = this.h;
    const ft = take === 'thicket' ? t : 2.5 + t;
    bear.heading = Math.atan2(this.out.x, this.out.z) + 0.1 * Math.sin(ft * 0.7);
    bear.speed = 0;
    bear.model.lookTarget = this.h.flock.lamb.position;
    void dt;
    // H2 0.7 s: the eyes open (beats.eyesOpen) — the tapetum of the bear's REAL eyes (models' uniform) and a faint
    // amber glow locked exactly on them (the rig's eye sockets on the head bone; visual-bible 3.15: never red)
    const open = take === 'lamb' ? smooth(clamp01((t - 0.7) / 0.28)) : 0;
    bear.model.eyeShine = WORLD_CAM.hook.shine * open;
    // its body is not to be seen (models' darkness uniform: pelt, skin, claws, teeth — not the eyes' tapetum)
    bear.model.darkness = WORLD_CAM.hook.dark;
    const eyes = this.eyes;
    if (!eyes) return;
    const hc = bear.model.headCenter;
    hc.updateWorldMatrix(true, false);
    eyes.visible = open > 0.01;
    const es = WORLD_CAM.hook.eye;
    eyes.children.forEach((c, i) => {
      // eyeL / eyeR of the bear rig relative to its headCenter socket (rest frame of the head bone), a hair in front
      c.position.set(i === 0 ? 0.06185 : -0.06185, 0.0074, 0.0626);
      hc.localToWorld(c.position);
      c.scale.set(es, es * Math.max(0.04, open), 1);
    });
    if (this.eyeMat) this.eyeMat.opacity = Math.min(0.85, open);
  }

  private buildEyes() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,244,214,1)');
    gr.addColorStop(0.22, 'rgba(255,206,120,0.8)');
    gr.addColorStop(0.55, 'rgba(160,90,20,0.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    this.eyeTex = new THREE.CanvasTexture(c);
    this.eyeTex.colorSpace = THREE.SRGBColorSpace;
    // visual-bible 3.15: a FAINT amber eyeshine (tapetum), never red, never a demon glow
    // (cut4: no depth test — the glow sits exactly on the rig's eye sockets (verified: NDC within 0.03 of the head) and
    //  must read THROUGH the leaves in front of it: "two amber eyes open behind the leaves")
    this.eyeMat = new THREE.SpriteMaterial({ map: this.eyeTex, color: new THREE.Color(1.4, 1.2, 0.72), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false, fog: false });
    const g = new THREE.Group();
    g.name = 'film:bear-eyes';
    for (let i = 0; i < 2; i++) {
      const sp = new THREE.Sprite(this.eyeMat);
      sp.renderOrder = 10;
      g.add(sp);
    }
    g.visible = false;
    this.h.engine.scene.add(g);
    this.eyes = g;
  }

  /** world exposure × k (k = 1 restores the world's own) */
  private setExposure(k: number) {
    const r = this.h.engine.renderer;
    if (this.exposure0 < 0) this.exposure0 = r.toneMappingExposure;
    r.toneMappingExposure = this.exposure0 * k;
  }

  private restoreExposure() {
    if (this.exposure0 < 0) return;
    this.h.engine.renderer.toneMappingExposure = this.exposure0;
    this.exposure0 = -1;
  }

  private putTreesBack() {
    const r = this.restoreTrees;
    this.restoreTrees = null;
    try {
      r?.();
    } catch (e) {
      console.warn('[film] restore trees', e);
    }
  }

  /** Put the world back for gameplay (David's film performance off, flock AI on, bear hidden, eyes removed). */
  leave() {
    const { player, flock, bear } = this.h;
    this.removeProps();
    this.putHookTreesBack();
    this.clearPushers();
    this.ff.restore();
    this.putTreesBack();
    this.restoreExposure();
    player.model.performFilm(null);
    player.model.hold = 'none';
    player.model.lookTarget = null;
    this.restoreFlock();
    for (const a of flock.animals) {
      if (a.state === 'carried') continue;
      a.aiEnabled = true;
      a.manualSpeed = 0;
    }
    const lamb = flock.lamb as unknown as { alert: number };
    lamb.alert = 0;
    bear.visible = false;
    bear.speed = 0;
    bear.model.lookTarget = null;
    bear.model.eyeShine = 0;
    bear.model.darkness = 0;
    if (this.eyes) {
      this.eyes.removeFromParent();
      this.eyes = null;
    }
    if (this.birds) {
      this.birds.group.removeFromParent();
      this.birds.mat.dispose();
      this.birds.tex.dispose();
      this.birds = null;
    }
    this.eyeMat?.dispose();
    this.eyeTex?.dispose();
    this.eyeMat = null;
    this.eyeTex = null;
    this.staged = '';
    this.extras.length = 0;
  }
}
