import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import { shared } from '../core/Shared';
import type { ShotFrame, Shot } from '../gameplay/CameraRig';
import type { Player } from '../gameplay/Player';
import type { BearActor } from '../gameplay/BearActor';
import type { Flock, Animal } from '../characters/Flock';
import { LAYOUT } from '../world/Layout';
import { rachelShots, alongPolyline, type RachelShots } from './land/rachel';
import type { FilmFocus } from './FilmStage';

/**
 * The opening film's shots in the GAME WORLD around Bethlehem (docs/intro-script.md shots 3, 14-19): camera takes
 * (lens, framing, motivated moves) and the staging of the chapter's own actors — David (DavidModel.performFilm),
 * the flock and the lamb (Flock), the bear in the thicket (BearActor) — plus the eye-shine of shot 19.
 * Everything is put back by leave() (the game starts right after the film).
 *
 * Takes: 'rachel-dawn' / 'rachel-road' (shot 3, src/film/land/rachel.ts), 'bethlehem' (14), 'figure' (15),
 * 'face' (16), 'contrast' (17), 'peace' (18), 'thicket' + 'lamb' (19).
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

interface Path {
  pos: THREE.CatmullRomCurve3;
  look: THREE.CatmullRomCurve3;
  fov: [number, number];
  ease: boolean;
}

/** heading (DavidModel / Player convention: forward = (sin h, 0, cos h)) of a horizontal direction */
const headingOf = (d: THREE.Vector3) => Math.atan2(d.x, d.z);

export class FilmWorld {
  readonly takes = new Set(['rachel-dawn', 'rachel-road', 'bethlehem', 'figure', 'face', 'contrast', 'peace', 'thicket', 'lamb']);
  private readonly paths: Record<string, Path> = {};
  private readonly rachel: RachelShots | null;
  private readonly ground: (x: number, z: number) => number;
  private readonly rock = new THREE.Vector3();
  private readonly sunH = new THREE.Vector3();
  /** David's gaze over the land in 15-17 (between the low sun and the pasture) */
  private readonly viewDir = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly edge = new THREE.Vector3(); // the thicket's edge toward the pasture
  private readonly out = new THREE.Vector3(); // unit: thicket -> pasture
  private readonly lamb0 = new THREE.Vector3();
  private readonly bearAt = new THREE.Vector3();
  private readonly faceCam = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private eyes: THREE.Group | null = null;
  private eyeMat: THREE.SpriteMaterial | null = null;
  private eyeTex: THREE.Texture | null = null;
  private saved: { a: Animal; pos: THREE.Vector3; heading: number; ai: boolean }[] = [];
  private staged = '';
  private extras: Animal[] = [];

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
    // Rachel's pillar (shot 3): the land teammate's camera data around the village's pillar
    let rs: RachelShots | null = null;
    try {
      rs = rachelShots(this.ground, h.engine.village.rachelPillar);
    } catch (e) {
      console.warn('[film] rachel shots', e);
    }
    this.rachel = rs;
    // the thicket (shots 18-19)
    const T = L.thicket;
    this.out.set(L.pasture.x - T.x, 0, L.pasture.z - T.z).normalize();
    this.edge.set(T.x + this.out.x * T.r * 0.92, 0, T.z + this.out.z * T.r * 0.92);
    this.edge.y = this.ground(this.edge.x, this.edge.z);
    this.lamb0.copy(this.edge).addScaledVector(this.out, 7.2);
    this.lamb0.y = this.ground(this.lamb0.x, this.lamb0.z);
    this.bearAt.copy(this.edge).addScaledVector(this.out, -9.5);
    this.bearAt.y = this.ground(this.bearAt.x, this.bearAt.z);
    this.buildPaths();
  }

  private path(pos: THREE.Vector3[], look: THREE.Vector3[], fov: [number, number], ease = true): Path {
    // keep every camera key above the ground (the crane moves cross ridges and terraces)
    for (const p of pos) p.y = Math.max(p.y, this.ground(p.x, p.z) + 0.35);
    return { pos: new THREE.CatmullRomCurve3(pos, false, 'centripetal'), look: new THREE.CatmullRomCurve3(look, false, 'centripetal'), fov, ease };
  }

  private buildPaths() {
    const R = this.rock, D = this.viewDir, S = this.side;
    const at = (base: THREE.Vector3, fwd: number, right: number, up: number) => base.clone().addScaledVector(D, fwd).addScaledVector(S, right).add(V(0, up, 0));
    const G = (x: number, z: number, up = 0) => V(x, this.ground(x, z) + up, z);
    const L = LAYOUT;
    const beth = G(L.bethlehem.x, L.bethlehem.z, 14);
    const pasture = G(L.pasture.x, L.pasture.z, 1.2);

    // 14 — BETHLEHEM: out of the cloud dip, a high descending crane from the east over the falling pastures: the town
    //      on its ridge ahead in the low golden light (the sun behind the lens), the terraces, then the flock on the
    //      slope and the rock (the camera settles toward where the story begins).
    this.paths.bethlehem = this.path(
      [G(430, 150, 260), G(300, 118, 150), G(170, 88, 62), G(92, 70, 22)],
      [beth.clone(), beth.clone().lerp(pasture, 0.25), beth.clone().lerp(pasture, 0.62), pasture.clone().lerp(R, 0.4).add(V(0, 0.5, 0))],
      [44, 38],
    );
    // 15 — THE FIGURE: from behind, a little low, David against the land falling east and the low sun at the frame's
    //      left; a slow push toward him (the reference image: staff planted, wind in the curls).
    this.paths.figure = this.path(
      [at(R, -4.3, -1.0, 1.05), at(R, -3.2, -0.75, 1.15)],
      [at(R, 14, 0.8, 0.9), at(R, 14, 0.6, 1.0)],
      [36, 32],
    );
    // 16 — THE FACE: three-quarter front from the sun side, long lens at eye height; he turns his head into the light
    //      and toward us (DavidModel.performFilm('reveal')).
    const camDir = this.sunH.clone().multiplyScalar(0.7).addScaledVector(D, 0.3).normalize();
    const head = R.clone().add(V(0, 1.56, 0));
    const c0 = head.clone().addScaledVector(camDir, 2.9).add(V(0, -0.06, 0)).addScaledVector(S, 0.2);
    const c1 = head.clone().addScaledVector(camDir, 2.45).add(V(0, -0.04, 0)).addScaledVector(S, 0.12);
    this.faceCam.copy(c1);
    this.paths.face = this.path([c0, c1], [head.clone(), head.clone().add(V(0, 0.01, 0))], [22, 20]);
    // 17 — THE CONTRAST: a rising pull-back from behind his shoulder until he is a speck on his rock above the vast
    //      land falling to the desert (the answer to "taller than all the people").
    this.paths.contrast = this.path(
      [at(R, -5.5, 2.2, 2.0), at(R, -22, 12, 11), at(R, -62, 34, 36)],
      [at(R, 4, 0, 1.2), at(R, 40, 0, -2), at(R, 240, 0, -40)],
      [38, 50],
    );
    // 18 — PEACE: low in the grass, sheep grazing close to the lens, the white lamb drifting toward the dark edge of
    //      the thicket (backlit: the sun beyond the trees); a slow sideways track.
    const O = this.out, E = this.edge;
    const Sx = V(-O.z, 0, O.x);
    const l0 = this.lamb0;
    this.paths.peace = this.path(
      [l0.clone().addScaledVector(O, 8.5).addScaledVector(Sx, 3.2).add(V(0, 0.62, 0)), l0.clone().addScaledVector(O, 7.4).addScaledVector(Sx, 1.4).add(V(0, 0.58, 0))],
      [E.clone().addScaledVector(Sx, 1.5).add(V(0, 1.0, 0)), E.clone().addScaledVector(Sx, 0.4).add(V(0, 0.9, 0))],
      [34, 32],
    );
    // 19a — THE THICKET: over the lamb's back into the dark between the trunks, a creeping push; the eyes open.
    const lambEnd = l0.clone().addScaledVector(O, -2.6);
    const bearHead = this.bearAt.clone().add(V(0, 0.95, 0));
    this.paths.thicket = this.path(
      [lambEnd.clone().addScaledVector(O, 2.2).addScaledVector(Sx, 0.35).add(V(0, 0.72, 0)), lambEnd.clone().addScaledVector(O, 1.3).addScaledVector(Sx, 0.2).add(V(0, 0.68, 0))],
      [bearHead.clone(), bearHead.clone()],
      [30, 22],
      false,
    );
    // 19b — THE LAMB: reverse, low and close from the thicket side: it lifts its head.
    this.paths.lamb = this.path(
      [lambEnd.clone().addScaledVector(O, -1.55).addScaledVector(Sx, 0.55).add(V(0, 0.34, 0)), lambEnd.clone().addScaledVector(O, -1.4).addScaledVector(Sx, 0.5).add(V(0, 0.33, 0))],
      [lambEnd.clone().add(V(0, 0.42, 0)), lambEnd.clone().add(V(0, 0.46, 0))],
      [28, 27],
      false,
    );
  }

  /** Camera of a world take at normalised u (eased by the take) — false for an unknown take. */
  frame(take: string, u: number, t: number, out: ShotFrame): boolean {
    if (take === 'rachel-dawn' || take === 'rachel-road') {
      const s: Shot | undefined = this.rachel?.shots[take === 'rachel-dawn' ? 'dawn' : 'road'];
      if (!s) return this.fallback(u, out);
      const e = s.ease !== false ? smooth(clamp01(u)) : clamp01(u);
      const f = s.at(e, t);
      out.pos.copy(f.pos);
      out.look.copy(f.look);
      out.fov = f.fov ?? 38;
      out.roll = f.roll ?? 0;
      return true;
    }
    const p = this.paths[take];
    if (!p) return false;
    const uu = clamp01(u);
    const e = p.ease ? smooth(uu) : uu;
    p.pos.getPoint(e, out.pos);
    p.look.getPoint(e, out.look);
    out.fov = p.fov[0] + (p.fov[1] - p.fov[0]) * e;
    out.roll = 0;
    return true;
  }

  private fallback(u: number, out: ShotFrame) {
    // the pillar without the land teammate's data: a slow push from the west into the first light
    const P = this.h.engine.village.rachelPillar;
    out.pos.set(P.x - 9 + u * 2, this.ground(P.x - 9, P.z + 2) + 1.4, P.z + 2);
    out.look.set(P.x + 40, P.y + 2.4, P.z - 6);
    out.fov = 36;
    out.roll = 0;
    return true;
  }

  // ---------------------------------------------------------------------------------------------- staging
  /** Stage the world for a take (on the cut into it). */
  enter(take: string) {
    const { player, flock, bear } = this.h;
    const m = player.model;
    m.resetDynamics();
    if (take === 'rachel-dawn' || take === 'rachel-road') {
      // a shepherd and his flock cross the slope far behind the pillar (slot 'shepherd': David stands in for the
      // anonymous shepherd until a 'man' FilmActor is cast; at 150-300 m he is a small figure against the light)
      if (this.staged !== 'rachel') {
        this.staged = 'rachel';
        this.saveFlock();
        const A = this.rachel?.anchors;
        if (A) {
          flock.animals.forEach((a, i) => {
            if (a.state === 'carried') return;
            const s = 6 + i * 1.7 + (i % 3) * 0.6;
            const p = alongPolyline(A.flockRoute, s, this.tmp);
            const lat = ((i * 37) % 7) - 3;
            const nx = p.x + lat * 0.9, nz = p.z + ((i * 13) % 5) - 2;
            a.position.set(nx, this.ground(nx, nz), nz);
            const q = alongPolyline(A.flockRoute, s + 4, this.tmp2);
            a.heading = Math.atan2(q.x - p.x, q.z - p.z);
            a.aiEnabled = false;
            a.state = 'walk';
            a.manualSpeed = A.walkSpeed * (0.9 + (i % 4) * 0.06);
          });
        }
      }
      m.performFilm(null);
      m.hold = 'none';
      return;
    }
    // Act II + the hook: everything back at the pasture
    if (this.staged === 'rachel') {
      this.restoreFlock();
      this.staged = '';
    }
    if (take === 'bethlehem' || take === 'figure' || take === 'face' || take === 'contrast') {
      this.placeDavid();
      this.hideBear();
      return;
    }
    if (take === 'peace' || take === 'thicket' || take === 'lamb') {
      this.placeDavid();
      if (this.staged !== 'hook') {
        this.staged = 'hook';
        this.stageHook();
      }
      if (take !== 'peace') this.showBear();
      else this.hideBear();
    }
    void bear;
  }

  /** Per frame (world takes): the actors' performance. `t` = shot seconds. */
  tick(take: string, t: number, dt: number) {
    const { player, flock, bear } = this.h;
    const m = player.model;
    if (take === 'rachel-dawn' || take === 'rachel-road') {
      const A = this.rachel?.anchors;
      if (A) {
        // the shepherd walks ahead of his flock along the route (film time since shot 3 began)
        const s = 14 + this.rachelClock(take, t) * A.walkSpeed;
        const p = alongPolyline(A.shepherdRoute, s, this.tmp);
        const q = alongPolyline(A.shepherdRoute, s + 2, this.tmp2);
        player.place(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z));
        player.speed = A.walkSpeed;
        m.speed = A.walkSpeed;
      }
      return;
    }
    if (take === 'figure') m.performFilm('back', t);
    else if (take === 'face') m.performFilm('reveal', t, { look: this.faceCam, turnAt: 1.3, turnDur: 2.3 });
    else if (take === 'contrast') m.performFilm('wide', t);
    else if (take === 'bethlehem') m.performFilm('wide', t);
    else if (take === 'peace' || take === 'thicket' || take === 'lamb') m.performFilm('wide', t + 10);
    if (take === 'peace' || take === 'thicket' || take === 'lamb') {
      const lamb = flock.lamb;
      if (take === 'peace') {
        lamb.state = t < 3.6 ? 'walk' : 'graze';
        lamb.manualSpeed = t < 3.6 ? 0.5 : 0;
      } else {
        lamb.state = 'graze';
        lamb.manualSpeed = 0;
      }
      if (take === 'lamb') {
        // it lifts its head toward the thicket
        const a = lamb as unknown as { alert: number; alertDir: number };
        a.alert = t > 0.5 ? 1 : 0;
        a.alertDir = Math.atan2(-this.out.x, -this.out.z);
      }
      if (take === 'thicket' || take === 'lamb') this.tickBear(take, t, dt);
    }
    void bear;
  }

  /** seconds since shot 3 began (both of its takes) */
  private rachelClock(take: string, t: number) {
    return take === 'rachel-road' ? 4.6 + t : t;
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
      case 'figure':
        return { point: eye(this.tmp), fStop: 2.8 };
      case 'face':
        return { point: eye(this.tmp), fStop: 1.8 };
      case 'rachel-dawn': {
        const P = this.h.engine.village.rachelPillar;
        return { point: this.tmp.set(P.x, P.y + 1.3, P.z), fStop: 4 };
      }
      case 'peace':
        return { point: this.tmp.copy(this.h.flock.lamb.position).add(V(0, 0.4, 0)), fStop: 2.8 };
      case 'thicket':
        // the focus pulls from the lamb's back into the dark
        return { point: this.tmp.copy(this.h.flock.lamb.position).lerp(this.bearAt, smooth(clamp01((t - 0.4) / 1.6))).add(V(0, 0.8, 0)), fStop: 2.2 };
      case 'lamb':
        return { point: this.tmp.copy(this.h.flock.lamb.position).add(V(0, 0.42, 0)), fStop: 2.0 };
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
    for (const a of this.h.flock.animals) this.saved.push({ a, pos: a.position.clone(), heading: a.heading, ai: a.aiEnabled });
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

  /** the lamb near the thicket's edge, a few sheep grazing between it and the lens (shots 18-19) */
  private stageHook() {
    const { flock } = this.h;
    this.saveFlock();
    const lamb = flock.lamb;
    const O = this.out, Sx = V(-O.z, 0, O.x);
    lamb.position.copy(this.lamb0);
    lamb.heading = Math.atan2(-O.x, -O.z);
    lamb.aiEnabled = false;
    lamb.state = 'walk';
    lamb.manualSpeed = 0.5;
    // the nearest few animals graze close to the lens (the rest of the flock stays behind at the pasture)
    const others = flock.animals.filter((a) => a !== lamb && a.state !== 'carried');
    others.sort((a, b) => a.position.distanceToSquared(this.lamb0) - b.position.distanceToSquared(this.lamb0));
    this.extras = others.slice(0, 4);
    const spots: [number, number][] = [[5.2, -2.6], [6.4, 1.9], [3.6, 3.4], [9.5, -0.6]];
    this.extras.forEach((a, i) => {
      const [f, s] = spots[i];
      const x = this.lamb0.x + O.x * f + Sx.x * s, z = this.lamb0.z + O.z * f + Sx.z * s;
      a.position.set(x, this.ground(x, z), z);
      a.heading = Math.atan2(-O.x, -O.z) + (i - 1.5) * 0.7;
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
    if (bear.visible && this.staged !== 'hook-keep') bear.visible = false;
    if (this.eyes) this.eyes.visible = false;
  }

  /** the bear shifts in the dark; the eyes open (eye-shine: the tapetum catching the light from the open slope) */
  private tickBear(take: string, t: number, dt: number) {
    const { bear } = this.h;
    const ft = take === 'thicket' ? t : 3.9 + t;
    // something large shifts: a slow weight transfer toward the lamb, the head lifting
    bear.heading = Math.atan2(this.out.x, this.out.z) + 0.12 * Math.sin(ft * 0.7);
    bear.speed = ft > 1.0 && ft < 2.2 ? 0.25 : 0;
    bear.model.lookTarget = this.h.flock.lamb.position;
    void dt;
    const eyes = this.eyes;
    if (!eyes) return;
    const open = take === 'thicket' ? smooth(clamp01((t - 2.05) / 0.3)) : 1;
    const hc = bear.model.headCenter.getWorldPosition(this.tmp);
    const fwd = this.tmp2.set(Math.sin(bear.heading), 0, Math.cos(bear.heading));
    eyes.position.copy(hc).addScaledVector(fwd, 0.2).add(V(0, 0.05, 0));
    eyes.rotation.set(0, bear.heading, 0);
    eyes.visible = open > 0.01;
    for (const c of eyes.children) c.scale.set(0.055, 0.055 * Math.max(0.04, open), 1);
    if (this.eyeMat) this.eyeMat.opacity = Math.min(1, open * 1.2);
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
    this.eyeMat = new THREE.SpriteMaterial({ map: this.eyeTex, color: new THREE.Color(2.2, 1.6, 0.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false });
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

  /** Put the world back for gameplay (David's film performance off, flock AI on, bear hidden, eyes removed). */
  leave() {
    const { player, flock, bear } = this.h;
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
  }
}
