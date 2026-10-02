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
import { FilmFlock } from './filmAnimals';
import { drift, portraitLens, takeBeat, takeDur } from './FilmCams';
import { INTRO_SHOTS } from '../content/introScript';

/**
 * The opening film's shots in the GAME WORLD around Bethlehem (CUT v4, docs/intro-script-v4.md: scene 5 "David" and
 * scene 6 "the logo"): camera takes (lens, framing, motivated moves) and the staging of the chapter's own actors —
 * David (DavidModel.performFilm) and the flock (FilmFlock). Every timed event is read from the shots' named BEATS in
 * src/content/introScript.ts; every move runs across its whole shot (FilmCams.drift). Everything is put back by leave()
 * (the game starts right after the film — at the end of D3 without a cut).
 *
 * Takes:
 *   'figure'       D1  (6 s) a slow crane / orbit behind David on his rock against the low sun, the flock below
 *   'face'         D2  (4 s) the push-in on his face as he turns into the light (beats.turn)
 *   'horizon'      D3  (10 s, CUT v4) THE LOGO SHOT: one long crane — from close behind his shoulder (his curls, the
 *                      low sun ahead) up, back and around behind him in a wide arc to the panorama (by ~4 s, from the
 *                      north-north-east: David small on the rock, his flock grazing on the slope below him, the hills to
 *                      the horizon in the haze), a slow drift under the logo, and from beats.settle a glide down and in,
 *                      round behind him, that lands EXACTLY on the gameplay camera at the end of the shot (the
 *                      `handoff` frame the player gives: CameraRig.followFrame) — the game takes over without a cut
 *   'vista'            a slow crane over the hills (only as the stand-in for a film set that failed to build)
 *   'rachel-dawn'  P3  of CUT v2 (Rachel's standing stone at dawn) — not filmed since CUT v3; its staging is only built
 *                      when the sheet has the take
 * The thicket and the bear's eyes (CUT v3 H1-H2) left the film in CUT v4: they open the bear's attack in gameplay
 * (src/gameplay/BearHook.ts, called from Story.bearAttack).
 *
 * World: +X east, -Z north (+Z south); the chapter's sun is low in the east (LAYOUT SUN: 13 deg, azimuth 100). David's
 * rock is LAYOUT.start (+0.2, +2.3) on the brow of the eastern slope (the ground falls ~15 m within 20 m to the east,
 * gently to the south), two boulders behind it to the north-west, the pasture SSE of it (~47 m, ~15 m lower), the
 * thicket (oaks / terebinths) 150 m east, Bethlehem on its ridge NW, Rachel's pillar on the road north of the town.
 */
export interface FilmWorldHost {
  engine: Engine;
  player: Player;
  flock: Flock;
  bear: BearActor;
  /** D3: the gameplay camera's first frame behind David (CameraRig.followFrame for HANDOFF) — the crane lands on it */
  handoff?: (out: ShotFrame) => ShotFrame;
}

/**
 * The hand-off from the film into play (CUT v4): David's heading on his rock at the end of D3 and in the first gameplay
 * frame (facing the pasture and the flock; the follow camera behind him is then clear of the two boulders NW of the
 * rock), the follow camera's pitch, and the height of its pivot over his feet (main.ts: cam.target = feet + 1.55).
 */
export const HANDOFF = { heading: 0.46, pitch: 0.15, pivotH: 1.55 };

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
  // (cut5, CUT v3: 6 s — a longer, slower orbit and crane: 10° round his right shoulder, 0.5 m out, 0.35 m up)
  figure: { az0: 48, az1: 58, r0: 3.3, r1: 3.8, h0: 1.5, h1: 1.85, lookAhead1: 12, lookDown1: 2.4, lookMix0: 0.08, lookMix1: 0.2, headH: 1.55, fov0: 34, fov1: 37, exp: 0.86 },
  // D2 (cut4): the push-in on the face, BACKLIT — `az` = SkySystem azimuth of the lens seen from his head (the low sun
  // stands ~115° round from it, behind his far shoulder); at `turn` he turns his head INTO the light toward `turnAz`
  // (a 3/4 profile catching the sun), never into the lens
  // (CUT v3: 4 s, the turn at beats.turn 0.8 — the push runs through the turn, the blink and the settled eyes)
  face: { az: -15, d0: 3.0, d1: 2.1, side0: 0.16, side1: 0.08, lookSide: 0.26, fov0: 21, fov1: 17.5, turnDur: 1.7, turnAz: 72 },
  // D3 (cut6, CUT v4): THE LOGO SHOT — one crane in David's frame. Keys [t (shot s), az (deg: heading of the lens seen
  // from his feet; 0 = south, 90 = east, 180 = north), r (m, horizontal distance), h (m over his feet), look (deg: heading
  // of the lens' axis), pitch (deg, + = down), fov (deg)]; the last key is the gameplay camera itself (HANDOFF), added at
  // run time. The channels are C1 monotone cubics (no overshoot), still at both ends (the landing is soft and exact).
  //  0.0  close behind his right shoulder (west of him, at his head's height), his curls against the low sun ahead
  //  0.8  pulling back to the south-west, clear of the boulder NW of him (collider r 0.99 m, top 2.63 m, 3.1 m out)
  //  1.5  up over that boulder's sector, high and looking down on him (the line of sight to his head stays above the
  //       boulder's near edge — checked against the colliders every 0.1 s: never occluded)
  //  2.2  on round behind him to the north, the crane pulling back and TILTING UP: the land and the horizon, the low
  //       sun's glow (≈51.2 s)
  //  3.0  behind him (north), the lens panning on to the south: his flock on the slope below him comes into view
  //  4.2  the panorama, from the north-north-east (over the brow of the eastern slope, the only side from which the
  //       slope south of the rock is not hidden behind it): David small on the rock right of centre, his flock grazing
  //       and walking on that slope below and left of him (cream sheep, dark goats: 12-36 m from him, 25-50 m from the
  //       lens), the hills to the horizon in the haze (≈43 % from the top), the sky's negative space for the logo
  //       (UI.logo); it drifts slowly back round toward his back and a little lower under the logo
  //  8.0  `settle`: then the glide down and in, round behind him, onto the gameplay camera (10.0)
  // The look of every key is solved so that his head sits at a chosen point of the frame (0.30 / -0.06 at the start,
  // 0.50 / -0.20 in the panorama; NDC, 16:9): the lens tilts with the crane and never loses him for long.
  horizon: {
    keys: [
      [0, 270, 1.2, 1.62, 101.59, 2.09, 42],
      [0.2, 270.8, 1.28, 1.66, 102.47, 3.47, 42.2],
      [0.8, 278, 2.6, 2.5, 108.69, 16.97, 43.5],
      [1.5, 252, 4.8, 5, 82.56, 26.42, 46.5],
      [2.2, 223, 8.4, 6.4, 53.51, 15.29, 50],
      [3, 186, 11.6, 5.2, 20.83, 9.89, 51],
      [4.2, 150, 13, 3.6, -6.35, 4.2, 52],
      [8, 156, 13.4, 3.4, -1.48, 2.87, 52.5],
    ] as [number, number, number, number, number, number, number][],
    // the flock staged in the panorama's lens (FilmFlock.stageInView at the lens of `stageAt` s): on the slopes below his
    // rock (the headings `sector` deg seen from him: south round through east to north-east), `minD`-`maxD` m from him —
    // near enough that the cream sheep read in the panorama (10-19 px long at 640 x 360), never so near that the game's
    // first objective ("go to the flock": 17 m from its centre, or 3 animals within 8 m) is met at once — at least
    // `below` m lower than his feet, and only where the lens really sees the ground (lineOfSight: the slope just south of
    // the rock is hidden behind its brow from the north-west); the sheep before the goats
    stageAt: 4.8, near: 10, far: 52, max: 18, minD: 12, maxD: 35, sector: [-40, 170] as [number, number], below: 1.0,
    // depth of field: on his curls at the start, deeper as the panorama opens, everything sharp before the hand-off
    fStop0: 2.4, fStop1: 6.5,
  },
};

export class FilmWorld {
  readonly takes = new Set(['rachel-dawn', 'figure', 'face', 'horizon', 'vista']);
  private readonly paths: Record<string, Path> = {};
  private readonly rachel: RachelShots | null;
  private readonly ground: (x: number, z: number) => number;
  private readonly rock = new THREE.Vector3();
  private readonly sunH = new THREE.Vector3();
  /** David's gaze over the land (between the low sun and the pasture) */
  private readonly viewDir = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
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
  /** P3 birds (cut4): small dark silhouettes crossing the dawn sky behind Rachel's stone. Built only when the sheet
   *  films P3 (pre-compiled), hidden outside that take. */
  private birds: { group: THREE.Group; mat: THREE.SpriteMaterial; tex: THREE.Texture; list: { s: THREE.Sprite; ph: number; k: number }[] } | null = null;
  private saved: { a: Animal; pos: THREE.Vector3; heading: number; ai: boolean; state: Animal['state'] }[] = [];
  private staged = '';
  /** world exposure before the film's per-take multipliers (-1 = not captured) */
  private exposure0 = -1;
  /** exposure multiplier of the current take (applied in tick: enter() runs before the engine restores the world
   *  view, so the renderer still holds the outgoing film set's exposure there) */
  private expK = 1;
  /** restores the cypresses cleared right round Rachel's pillar for P3's composition (visual-bible 3.10) */
  private restoreTrees: (() => void) | null = null;
  /** D1-D3: the flock staged inside the lens' view (anim: src/film/filmAnimals.ts) */
  private readonly ff: FilmFlock;
  private readonly stageCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 5000);
  /** D3: the crane's channels (az, r, h, look, pitch, fov) and the hand-off frame they land on */
  private readonly hand: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 52, roll: 0 };
  private readonly craneKeys: number[][] = [];
  /** D3: where David's feet are (his settled position on the rock: the game's physics may have nudged him) */
  private readonly feet = new THREE.Vector3();

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
    // P3 (CUT v2's Rachel's stone): staged only when the sheet films it (CUT v3 / v4 do not)
    const filmsRachel = INTRO_SHOTS.some((s) => s.set === 'world' && s.take === 'rachel-dawn');
    let rs: RachelShots | null = null;
    if (filmsRachel) {
      try {
        rs = rachelShots(this.ground, h.engine.village.rachelPillar);
      } catch (e) {
        console.warn('[film] rachel shots', e);
      }
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
    if (filmsRachel) {
      this.buildRachelCross();
      try {
        this.buildBirds();
      } catch (e) {
        console.warn('[film] birds', e);
      }
    }
    this.ff = new FilmFlock(h.flock, this.ground);
    this.feet.copy(this.rock);
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
    // every move runs across its whole shot and is still drifting at the cut (FilmCams.drift)
    const e = drift(uu);
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
      case 'horizon':
        // D3 — the crane, landing on the gameplay camera (the hand-off frame) at the end of the shot
        this.horizonFrame(t, out);
        return true;
    }
    const p = this.paths[take];
    if (!p) return false;
    const pe = p.ease ? e : uu;
    p.pos.getPoint(pe, out.pos);
    p.look.getPoint(pe, out.look);
    out.fov = p.fov[0] + (p.fov[1] - p.fov[0]) * pe;
    return true;
  }

  /** D3: the crane's keys with the hand-off frame as the last one (computed now: David's settled feet on the rock) */
  private craneKeysNow(): number[][] {
    const K = this.craneKeys;
    const base = WORLD_CAM.horizon.keys;
    K.length = 0;
    for (const k of base) K.push(k.slice());
    const T = takeDur('horizon', 10);
    const f = this.handoffFrame();
    const F = this.feet;
    const dx = f.pos.x - F.x, dz = f.pos.z - F.z;
    const last = base[base.length - 1];
    const near = (deg: number, ref: number) => ref + ((((deg - ref) % 360) + 540) % 360) - 180;
    const lx = f.look.x - f.pos.x, ly = f.look.y - f.pos.y, lz = f.look.z - f.pos.z;
    K.push([
      T,
      near(THREE.MathUtils.radToDeg(Math.atan2(dx, dz)), last[1]),
      Math.hypot(dx, dz),
      f.pos.y - F.y,
      near(THREE.MathUtils.radToDeg(Math.atan2(lx, lz)), last[4]),
      THREE.MathUtils.radToDeg(-Math.atan2(ly, Math.hypot(lx, lz))),
      f.fov ?? 52,
    ]);
    return K;
  }

  /** the gameplay camera's first frame behind David (the player gives CameraRig.followFrame; else its geometry) */
  private handoffFrame(): ShotFrame {
    const f = this.hand;
    if (this.h.handoff) return this.h.handoff(f);
    const yaw = HANDOFF.heading + Math.PI, cp = Math.cos(HANDOFF.pitch), sp = Math.sin(HANDOFF.pitch);
    const pivot = this.tmp2.copy(this.feet).add(V(0, HANDOFF.pivotH, 0));
    const dir = V(Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp);
    f.pos.copy(pivot).addScaledVector(dir, 3.6);
    f.look.copy(pivot).addScaledVector(dir, -4);
    f.fov = 52;
    f.roll = 0;
    return f;
  }

  /**
   * D3 at shot second t: the crane's channels in David's frame (az / r / h of the lens round his feet, the heading and
   * pitch of its axis, the lens), C1 monotone cubics still at both ends; at the end of the shot it IS the hand-off frame.
   */
  private horizonFrame(t: number, out: ShotFrame) {
    const T = takeDur('horizon', 10);
    if (t >= T - 1e-3) {
      const f = this.handoffFrame();
      out.pos.copy(f.pos);
      out.look.copy(f.look);
      out.fov = f.fov ?? 52;
      out.roll = 0;
      return;
    }
    const K = this.craneKeysNow();
    const tt = Math.max(0, t);
    const az = THREE.MathUtils.degToRad(crane(K, 1, tt)), r = crane(K, 2, tt), hh = crane(K, 3, tt);
    const lk = THREE.MathUtils.degToRad(crane(K, 4, tt)), pt = THREE.MathUtils.degToRad(crane(K, 5, tt));
    const F = this.feet;
    out.pos.set(F.x + Math.sin(az) * r, F.y + hh, F.z + Math.cos(az) * r);
    // never in the ground (the hand-off frame itself keeps the follow camera's own clearance)
    const settle = takeBeat('horizon', 'settle', 8);
    const gy = this.ground(out.pos.x, out.pos.z) + 0.5;
    if (out.pos.y < gy) out.pos.y = lerp(gy, out.pos.y, ss(T - 0.8, T, t));
    out.look.set(out.pos.x + Math.sin(lk) * Math.cos(pt) * 40, out.pos.y - Math.sin(pt) * 40, out.pos.z + Math.cos(lk) * Math.cos(pt) * 40);
    out.fov = crane(K, 6, tt);
    // a crane's slight bank into the arc, level again for the hand-off
    out.roll = 0.014 * Math.sin(Math.min(1, tt / 4.2) * Math.PI) * (1 - ss(settle - 1, settle + 1.2, t));
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
    // David and the flock: everything back near the pasture
    if (this.staged === 'rachel') {
      this.ff.restore();
      this.restoreFlock();
      this.putTreesBack();
      this.staged = '';
    }
    this.hideBear();
    if (take === 'horizon') {
      // D3: he stands as the game will have him (HANDOFF.heading); the flock re-staged in the panorama's lens (a cut)
      this.placeDavid(HANDOFF.heading);
      if (this.staged !== 'horizon') {
        this.staged = 'horizon';
        this.stageFlockHorizon();
      }
      this.expK = 1;
      return;
    }
    if (take === 'figure' || take === 'face' || take === 'vista') {
      this.placeDavid();
      if (this.staged !== 'david') {
        this.staged = 'david';
        this.stageFlockInView();
      }
      this.expK = take === 'figure' ? WORLD_CAM.figure.exp : 1;
    }
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
    const { player } = this.h;
    const m = player.model;
    this.setExposure(this.expK);
    if (take !== 'rachel-dawn') this.clearPushers();
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
        // he turns INTO the light (faceCam = a point 40 m out toward the low sun), not into the lens: offLens 0; the
        // turn on the contract's beat (D2 beats.turn)
        m.performFilm('reveal', t, { look: this.faceCam, turnAt: takeBeat('face', 'turn', 0.8), turnDur: WORLD_CAM.face.turnDur, offLens: 0 });
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      case 'horizon': {
        // D3: he looks out over his flock below him (the head following it), then up to the horizon; the wind, the
        // breath, the weight on the staff; from `settle` he comes back to the game's own idle stance for the hand-off
        this.feet.copy(player.pos);
        m.performFilm('horizon', t, { releaseAt: takeBeat('horizon', 'settle', 8), endAt: takeDur('horizon', 10), gaze: this.flockGaze() });
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      }
      case 'vista':
        m.performFilm('wide', t);
        return;
    }
  }

  /** D3: where his flock grazes, as a turn of his head (rad, + = to his left) from his facing (HANDOFF.heading) */
  private flockGaze(): number {
    const list = this.ff.animals;
    if (!list.length) return 0.35;
    let x = 0, z = 0;
    for (const a of list) {
      x += a.position.x;
      z += a.position.z;
    }
    x = x / list.length - this.feet.x;
    z = z / list.length - this.feet.z;
    const d = Math.atan2(x, z) - HANDOFF.heading;
    return Math.atan2(Math.sin(d), Math.cos(d));
  }

  /**
   * The composition's subject of a world take, where it differs from the focus point (phones in portrait re-aim their
   * narrow lens toward it — Intro.portrait): D1's focus racks out into the valley, but the shot is David on his rock;
   * D3 is David and his flock below him. null = use the focus point.
   */
  subject(take: string, out: THREE.Vector3): THREE.Vector3 | null {
    if (take === 'figure') return out.copy(this.rock).add(V(0, 1.35, 0));
    if (take === 'horizon') return out.copy(this.feet).add(V(0, 1.1, 0));
    return null;
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
      case 'horizon': {
        // on his curls at the start (the sunlit land soft beyond), deeper as the panorama opens (all of it sharp), and
        // the stop closes over the glide so nothing is soft when the game's camera (no depth of field) takes over
        const c = WORLD_CAM.horizon;
        const T = takeDur('horizon', 10), st = takeBeat('horizon', 'settle', 8);
        return { point: eye(this.tmp), fStop: lerp(c.fStop0, c.fStop1, ss(0.3, 3.6, t)) * (1 + 9 * ss(st, T - 0.4, t)) };
      }
      case 'rachel-dawn':
        return { point: this.tmp.copy(this.pillar).add(V(0, 1.4, 0)), fStop: 5.6 };
      default:
        return null;
    }
  }

  private placeDavid(heading = headingOf(this.viewDir)) {
    const { player } = this.h;
    if (Math.hypot(player.pos.x - this.rock.x, player.pos.z - this.rock.z) > 0.3 || Math.abs(player.heading - heading) > 1e-3) {
      player.place(this.rock.x, this.rock.z, heading);
    }
    this.feet.copy(player.pos);
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

  /** a stand-in camera at a take's frame (for staging the flock in the lens) — on a phone in portrait the lens the viewer
   *  really has (widened and turned toward the shot's subject: Intro.portrait / FilmCams.portraitLens) */
  private stageLens(take: string, t: number) {
    const f = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 36, roll: 0 };
    this.frame(take, t / takeDur(take, 6), t, f);
    const el = this.h.engine.renderer.domElement;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight) || 16 / 9;
    if (aspect < 0.95) portraitLens(f, this.subject(take, this.tmp2) ?? null, aspect, 1);
    const c = this.stageCam;
    c.aspect = aspect < 0.95 ? aspect : Math.max(1.25, this.h.engine.camera.aspect || 16 / 9);
    c.fov = f.fov ?? 36;
    c.position.copy(f.pos);
    c.lookAt(f.look);
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
    return c;
  }

  /** D1-D2: the flock grazing and walking below David INSIDE the D1 lens' first frame (FilmFlock.stageInView) */
  private stageFlockInView() {
    const c = this.stageLens('figure', 1.5);
    try {
      // (cut4, director-notes-v5 D1: the flock IN FRAME below him — from the lens on the rock the slope 4-7 m out lies
      //  under the frame and the letterbox, so the drove is staged where the lens sees the ground: 7-30 m)
      let n = this.ff.stageInView(c, this.rock, { near: 7, far: 30, max: 14 });
      // the slope beyond the rock drops out of the frame: then the drove where this lens does see ground (the slope
      // and the valley floor further out) — in frame, smaller
      // (orchestrator, v6 review: from this lens no ground nearer than ~50 m is in frame; keep the far drove above the
      //  2.39 letterbox — 4 of 14 stood under the bars)
      if (n < 6) n = this.ff.stageInView(c, this.rock, { near: 9, far: 70, max: 14, clear: 0.15, yMin: -0.68 });
      if (n > 0) return;
    } catch (e) {
      console.warn('[film] flock staging', e);
    }
    this.stageFlockBelow();
  }

  /**
   * D3: the flock on the slope below him INSIDE the panorama's lens (the crane at `stageAt` s, under the logo): from the
   * high angle the slope below the rock is in view. Beyond and below him (at least `below` m lower than his feet), at
   * least `minD` m from him, clear of his silhouette, above the 2.39 letterbox; a third walking, the rest grazing.
   */
  private stageFlockHorizon() {
    const c = WORLD_CAM.horizon;
    this.feet.copy(this.h.player.pos);
    const cam = this.stageLens('horizon', c.stageAt);
    try {
      const sector: [number, number] = [THREE.MathUtils.degToRad(c.sector[0]), THREE.MathUtils.degToRad(c.sector[1])];
      const rocks = (x: number, y: number, z: number) => this.h.engine.colliders.solidAt(x, y, z, 0.05);
      let n = this.ff.stageInView(cam, this.feet, { near: c.near, far: c.far, max: c.max, clear: 0.1, spacing: 1.5, yMin: -0.66, minFrom: this.feet, minDist: c.minD, maxDist: c.maxD, sector, maxY: this.feet.y - c.below, sheepFirst: true, lineOfSight: true, solid: rocks });
      // (a lens that sees too little of those slopes: anywhere below him in the frame, a little further out)
      if (n < 10) n = this.ff.stageInView(cam, this.feet, { near: c.near, far: c.far * 1.4, max: c.max, clear: 0.1, spacing: 1.5, yMin: -0.66, minFrom: this.feet, minDist: c.minD, maxDist: c.maxD * 1.5, maxY: this.feet.y - c.below, sheepFirst: true, lineOfSight: true, solid: rocks });
      if (n > 0) return;
    } catch (e) {
      console.warn('[film] D3 flock staging', e);
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

  /** the bear is never in the film (CUT v4: it is seen only after play begins) */
  private hideBear() {
    const { bear } = this.h;
    bear.model.eyeShine = 0;
    bear.model.darkness = 0;
    if (bear.visible) bear.visible = false;
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

  /** Birds per take (t = shot seconds): P3 a loose line of five crossing the dawn sky behind the stone, frame left -> right, high. */
  private tickBirds(take: string, t: number) {
    const b = this.birds;
    if (!b) return;
    const on = take === 'rachel-dawn';
    b.group.visible = on;
    if (!on) return;
    for (const { s, ph, k } of b.list) {
      const flap = 0.5 + 0.5 * Math.sin((t * 9.5 + ph * 6.28) * (1 + k * 0.07));
      // 25-40 m behind the stone, 9-14 m up, gliding south across the view
      const P = this.pillar;
      const d = 28 + ((k * 7) % 11), lat = -16 + t * (5.2 + (k % 3) * 0.6) - k * 2.2;
      s.position.copy(P).addScaledVector(this.axis, d).addScaledVector(this.axisR, lat);
      s.position.y = this.pillarTop.y + 8 + ((k * 5) % 6) + 0.6 * Math.sin(t * 1.3 + k);
      s.scale.set(0.42, 0.42 * (0.25 + 0.75 * flap) * 0.5, 1);
      s.visible = k < 5;
    }
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

  /**
   * Put the world back for gameplay (David's film performance off, flock AI on, bear hidden). `handoff` = the film ended
   * on D3 without a cut: the flock D3 staged stays where it grazes and the game's flock AI takes it over from there (it
   * drifts back toward its pasture by itself); otherwise (a skip: under the dissolve) every staged animal goes back.
   */
  leave(handoff = false) {
    const { player, flock, bear } = this.h;
    this.clearPushers();
    if (handoff) this.ff.release();
    else this.ff.restore();
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
    if (this.birds) {
      this.birds.group.removeFromParent();
      this.birds.mat.dispose();
      this.birds.tex.dispose();
      this.birds = null;
    }
    this.staged = '';
  }
}

/** C1 monotone cubic through keys[i][0] (time) -> keys[i][c] (Fritsch-Butland tangents: no overshoot), still at the
 *  first and the last key — D3's crane channels */
function crane(keys: readonly number[][], c: number, t: number): number {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][c];
  if (t >= keys[n - 1][0]) return keys[n - 1][c];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const slope = (k: number) => (keys[k + 1][c] - keys[k][c]) / (keys[k + 1][0] - keys[k][0]);
  const tan = (k: number) => {
    if (k <= 0 || k >= n - 1) return 0;
    const a = slope(k - 1), b = slope(k);
    if (a * b <= 0) return 0;
    const h0 = keys[k][0] - keys[k - 1][0], h1 = keys[k + 1][0] - keys[k][0];
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const t0 = keys[i][0], hh = keys[i + 1][0] - t0, s = (t - t0) / hh;
  const v0 = keys[i][c], v1 = keys[i + 1][c], m0 = tan(i) * hh, m1 = tan(i + 1) * hh;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1;
}
