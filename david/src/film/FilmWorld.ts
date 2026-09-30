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
  rachel: { back0: 10.2, back1: 6.9, side0: -1.2, side1: -0.7, h0: 0.95, h1: 0.8, lookFar: 34, lookRight: 6.5, lookH: 1.9, fov0: 31, fov1: 27, flockD: 34, exp: 1.0 },
  // D1: the orbit / crane behind David (azimuth from his back, radius, height above his feet)
  figure: { az0: -70, az1: -40, r0: 2.8, r1: 3.2, h0: 1.3, h1: 2.1, lookAhead1: 26, lookDown1: 5.5, fov0: 34, fov1: 38, exp: 1.0 },
  // D2: the push-in on the face (distance from his head, lens round from the sun)
  face: { az: 100, d0: 2.95, d1: 2.15, fov0: 21, fov1: 17.5, turnDur: 1.6 },
  // H1 / H2: the hook
  hook: { lambSpeed: 0.55, walkUntil: 1.3, camBack: 1.75, camSide: 0.85, camH: 0.52, bearIn: 9.5, exp1: 0.66, exp2: 0.56 },
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
    this.buildPaths();
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
    // north -> south across the view (frame left -> right), ~30 m long
    this.crossA.copy(P).addScaledVector(this.axis, best).addScaledVector(this.axisR, -17);
    this.crossB.copy(P).addScaledVector(this.axis, best + 3).addScaledVector(this.axisR, 14);
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
    // D2 — THE FACE: the lens stands `az` deg round from the sun (south of him, the sun behind his far shoulder): a
    // golden side-back light on the face and a rim in the curls; he turns from the land into the lens
    const c = WORLD_CAM.face;
    const R = this.rock;
    const fa = THREE.MathUtils.degToRad(c.az);
    const camDir = V(Math.cos(fa), 0, Math.sin(fa));
    const fs = V(-camDir.z, 0, camDir.x);
    const head = R.clone().add(V(0, 1.56, 0));
    const c0 = head.clone().addScaledVector(camDir, c.d0).addScaledVector(fs, 0.16).add(V(0, -0.05, 0));
    const c1 = head.clone().addScaledVector(camDir, c.d1).addScaledVector(fs, 0.08).add(V(0, -0.02, 0));
    this.faceCam.copy(c1);
    const hl = head.clone().addScaledVector(fs, 0.26).add(V(0, 0.05, 0));
    this.paths.face = this.path([c0, c1], [hl, hl.clone().add(V(0, 0.015, 0))], [c.fov0, c.fov1]);
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
        // D1 — behind him on the left, low; the lens orbits round toward his back and cranes up while the look leaves
        // his shoulders for the valley below (the flock grazing on the slope, the Bethlehem hills)
        const c = WORLD_CAM.figure;
        const az = THREE.MathUtils.degToRad(lerp(c.az0, c.az1, e));
        // behind = -viewDir; the azimuth turns it toward his left (negative = left side)
        const back = this.tmp.copy(this.viewDir).negate();
        back.applyAxisAngle(V(0, 1, 0), az); // negative = toward his left (the side clear of the boulder behind him)
        const r = lerp(c.r0, c.r1, e);
        out.pos.copy(this.rock).addScaledVector(back, r);
        out.pos.y = Math.max(this.ground(out.pos.x, out.pos.z) + 0.6, this.rock.y + lerp(c.h0, c.h1, e));
        const shoulders = this.tmp2.copy(this.rock).add(V(0, 1.45, 0));
        const valley = this.rock.clone().addScaledVector(this.viewDir, c.lookAhead1);
        valley.y = this.ground(valley.x, valley.z) + 1.0;
        valley.y = Math.max(valley.y, this.rock.y - c.lookDown1);
        out.look.copy(shoulders).lerp(valley, lerp(0.12, 0.62, ss(0.15, 1, uu)));
        // out of the light-flash: the lens settles down from the sky into the hills (the answer to G7's whip up)
        const settle = 1 - ss(0, 0.85, t);
        out.look.y += 3.2 * settle * settle;
        out.fov = lerp(c.fov0, c.fov1, e);
        out.roll = -0.012 + 0.018 * e;
        return true;
      }
      case 'thicket': {
        // H1 — low in the grass behind and beside the lamb, following it to the dark edge of the thicket
        const c = WORLD_CAM.hook;
        const lamb = this.h.flock.lamb.position;
        const Sx = this.tmp.set(-this.out.z, 0, this.out.x);
        out.pos.copy(lamb).addScaledVector(this.out, c.camBack + 0.35 * (1 - e)).addScaledVector(Sx, c.camSide);
        out.pos.y = this.ground(out.pos.x, out.pos.z) + c.camH + 0.06 * e;
        out.look.copy(lamb).addScaledVector(this.out, -2.6).add(V(0, 0.42 + 0.15 * e, 0));
        out.fov = lerp(33, 29, e);
        return true;
      }
      case 'lamb': {
        // H2 — over the lamb into the dark between the trunks: a slow creep; the eyes open
        const c = WORLD_CAM.hook;
        const Sx = this.tmp.set(-this.out.z, 0, this.out.x);
        const base = this.lambStop;
        out.pos.copy(base).addScaledVector(this.out, 1.35 - 0.55 * e).addScaledVector(Sx, 0.38);
        out.pos.y = this.ground(out.pos.x, out.pos.z) + 0.72;
        out.look.copy(this.bearAt).add(V(0, 0.85, 0));
        out.fov = lerp(17, 14.5, e);
        void c;
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
        this.saveFlock();
        // the flock crosses behind the stone on the visible line (north -> south), the shepherd ahead of it
        const A = this.crossA, B = this.crossB;
        const dir = this.tmp2.copy(B).sub(A);
        const len = dir.length();
        dir.normalize();
        const n = flock.animals.length;
        flock.animals.forEach((a, i) => {
          if (a.state === 'carried') return;
          const s = len * 0.62 - i * (len * 0.75) / Math.max(1, n - 1) + ((i * 7) % 5) * 0.35;
          const lat = (((i * 37) % 9) - 4) * 0.55;
          const x = A.x + dir.x * s - dir.z * lat, z = A.z + dir.z * s + dir.x * lat;
          a.position.set(x, this.ground(x, z), z);
          a.heading = Math.atan2(dir.x, dir.z) + (((i * 13) % 7) - 3) * 0.06;
          a.aiEnabled = false;
          a.state = i % 6 === 5 ? 'graze' : 'walk';
          a.manualSpeed = i % 6 === 5 ? 0 : 0.95 * (0.9 + (i % 4) * 0.06);
        });
      }
      m.performFilm(null);
      m.hold = 'none';
      m.lookTarget = null;
      this.expK = WORLD_CAM.rachel.exp;
      return;
    }
    // David, the flock and the hook: everything back near the pasture
    if (this.staged === 'rachel') {
      this.restoreFlock();
      this.putTreesBack();
      this.staged = '';
    }
    if (take === 'figure' || take === 'face' || take === 'vista') {
      this.placeDavid();
      this.hideBear();
      if (this.staged !== 'david') {
        this.staged = 'david';
        this.stageFlockBelow();
      }
      this.expK = take === 'figure' ? WORLD_CAM.figure.exp : 1;
      return;
    }
    if (take === 'thicket' || take === 'lamb') {
      this.placeDavid();
      if (this.staged !== 'hook') {
        this.staged = 'hook';
        this.stageHook();
      }
      this.showBear();
      this.expK = 1;
    }
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
    switch (take) {
      case 'rachel-dawn': {
        // the shepherd walks ahead of his flock across the view (a small figure against the dawn)
        const A = this.crossA, B = this.crossB;
        const dir = this.tmp2.copy(B).sub(A);
        const len = dir.length();
        dir.normalize();
        const s = len * 0.72 + 1.0 * t;
        const x = A.x + dir.x * s + dir.z * 1.2, z = A.z + dir.z * s - dir.x * 1.2;
        player.place(x, z, Math.atan2(dir.x, dir.z));
        player.speed = 1.0;
        m.speed = 1.0;
        return;
      }
      case 'figure':
        m.performFilm('back', t);
        return;
      case 'face':
        m.performFilm('reveal', t, { look: this.faceCam, turnAt: 0.5, turnDur: WORLD_CAM.face.turnDur });
        return;
      case 'vista':
        m.performFilm('wide', t);
        return;
      case 'thicket':
      case 'lamb': {
        m.performFilm('wide', t + 10);
        const lamb = flock.lamb;
        const a = lamb as unknown as { alert: number; alertDir: number };
        if (take === 'thicket') {
          // it walks to the edge, stops and grazes; at 1.5 s its head comes up (the birds have stopped)
          const walking = t < c.walkUntil;
          lamb.state = walking ? 'walk' : 'graze';
          lamb.manualSpeed = walking ? c.lambSpeed : 0;
          if (t >= 1.5) {
            lamb.state = 'walk';
            lamb.manualSpeed = 0;
            a.alert = 1;
            a.alertDir = Math.atan2(-this.out.x, -this.out.z);
          } else a.alert = 0;
        } else {
          lamb.state = 'walk';
          lamb.manualSpeed = 0;
          a.alert = 1;
          a.alertDir = Math.atan2(-this.out.x, -this.out.z);
        }
        this.tickBear(take, t, dt);
        // the light goes out of the hook: down through H1, darker still in the thicket (H2)
        const k = take === 'thicket' ? ss(0.2, 2.5, t) : 1;
        this.setExposure(take === 'thicket' ? lerp(1, c.exp1, k) : lerp(c.exp1, c.exp2, ss(0, 0.8, t)));
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

  /** D1-D2: the flock grazing and walking on the slope below David, in the lens' view (never frozen) */
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
    if (bear.visible) bear.visible = false;
    if (this.eyes) this.eyes.visible = false;
  }

  /** the bear in the dark: a breath, the head lifting toward the lamb; the eyes open (the tapetum catching the light) */
  private tickBear(take: string, t: number, dt: number) {
    const { bear } = this.h;
    const ft = take === 'thicket' ? t : 2.5 + t;
    bear.heading = Math.atan2(this.out.x, this.out.z) + 0.1 * Math.sin(ft * 0.7);
    bear.speed = 0;
    bear.model.lookTarget = this.h.flock.lamb.position;
    void dt;
    const eyes = this.eyes;
    if (!eyes) return;
    // H2 0.7 s: the eyes open (beats.eyesOpen)
    const open = take === 'lamb' ? smooth(clamp01((t - 0.7) / 0.28)) : 0;
    const hc = bear.model.headCenter.getWorldPosition(this.tmp);
    const fwd = this.tmp2.set(Math.sin(bear.heading), 0, Math.cos(bear.heading));
    eyes.position.copy(hc).addScaledVector(fwd, 0.2).add(V(0, 0.05, 0));
    eyes.rotation.set(0, bear.heading, 0);
    eyes.visible = open > 0.01;
    for (const c of eyes.children) c.scale.set(0.1, 0.1 * Math.max(0.04, open), 1);
    if (this.eyeMat) this.eyeMat.opacity = Math.min(1, open * 1.25);
  }

  private buildEyes() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,200,1)');
    gr.addColorStop(0.22, 'rgba(255,190,90,0.85)');
    gr.addColorStop(0.55, 'rgba(160,90,20,0.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    this.eyeTex = new THREE.CanvasTexture(c);
    this.eyeTex.colorSpace = THREE.SRGBColorSpace;
    // visual-bible 3.15: a FAINT amber eyeshine (tapetum), never red, never a demon glow
    this.eyeMat = new THREE.SpriteMaterial({ map: this.eyeTex, color: new THREE.Color(1.7, 1.12, 0.52), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    const g = new THREE.Group();
    g.name = 'film:bear-eyes';
    for (const s of [-1, 1]) {
      const sp = new THREE.Sprite(this.eyeMat);
      sp.position.set(s * 0.075, 0, 0);
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
    if (this.eyes) {
      this.eyes.removeFromParent();
      this.eyes = null;
    }
    this.eyeMat?.dispose();
    this.eyeTex?.dispose();
    this.eyeMat = null;
    this.eyeTex = null;
    this.staged = '';
    this.extras.length = 0;
  }
}
