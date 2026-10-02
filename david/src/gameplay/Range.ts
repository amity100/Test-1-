import * as THREE from 'three';
import { mulberry32, clamp } from '../core/noise';
import { shared } from '../core/Shared';
import type { Engine } from '../core/Engine';
import type { HitTarget, ShotInfo, Projectiles } from './Projectiles';
import { Jar, jarGeometry, nextFrame } from './Props';
import { boulderGeometry, rockMaterial } from '../world/Rocks';
import { oakTree } from '../world/TreeGen';
import { foliageMaterial, gnarlyTube } from '../world/Vegetation';
import { LAYOUT } from '../world/Layout';

/*
 * (play1, docs/gameplay-v2.md §3) THE SLING RANGE in the wadi below the pasture, set up by David himself with a
 * shepherd's things (Iron Age I-IIA: clay water jars, bottle gourds, a goatskin waterskin, a rag on a stick; no
 * bullseyes, nothing modern):
 *   1. warm-up — three jars on a terrace wall at 12-16 m (learn the timing);
 *   2. at a distance — jars and gourds on the far bank at 22-35 m with a light wind (learn the drop and the drift; the
 *      wind shows in the grass, the dust and the rag);
 *   3. moving — a gourd swinging on a cord under a terebinth branch, a jar lashed to a log rolling down the slope
 *      (lead the target);
 *   4. the thin cord — a waterskin hangs from the terebinth on a thin cord ≈20 m out: hit the cord and the skin drops
 *      (Judg 20:16, the catalog's jdg_20_16_slingers, shown by the Story).
 * Every round keeps score (hits, perfect releases, streak, stones, time) and ends with one to three marks; a round
 * never blocks the story (after enough stones the player may go on), and the range can be played again.
 * Built lazily in small steps (≈20 ms in all) when the stones objective begins; nothing at boot.
 */

export interface RoundDef {
  title: string;
  /** what to do (the panel's note) */
  note: string;
  /** wind (m/s) and from which side of the station's line ('left' | 'right') */
  wind: number;
  windFrom: 'left' | 'right';
  /** stones after which the player may go on without finishing */
  maxStones: number;
  /** par: stones for three marks / two marks */
  par3: number;
  par2: number;
}

export const ROUNDS: RoundDef[] = [
  { title: 'הִתְחַמְּמוּת', note: 'שְׁלֹשָׁה כַּדִּים עַל הַגָּדֵר — לְמַד אֶת הַקֶּצֶב: שַׁחְרֵר כְּשֶׁהַכִּיס בָּאוֹר', wind: 0, windFrom: 'left', maxStones: 9, par3: 3, par2: 5 },
  { title: 'לְמֵרָחוֹק', note: 'עַל הַגָּדָה שֶׁמִּנֶּגֶד — הָאֶבֶן יוֹרֶדֶת בַּדֶּרֶךְ: כַּוֵּן גָּבוֹהַּ יוֹתֵר, וְשִׂים לֵב לָרוּחַ', wind: 4.2, windFrom: 'left', maxStones: 14, par3: 5, par2: 8 },
  { title: 'מַטָּרוֹת נָעוֹת', note: 'הַדְּלַעַת בַּחֶבֶל וְהַכַּד עַל הַבּוּל הַמִּתְגַּלְגֵּל — כַּוֵּן לְפָנֵיהֶם', wind: 1.5, windFrom: 'right', maxStones: 12, par3: 3, par2: 5 },
  { title: 'הַחֶבֶל הַדַּק', note: 'פְּגַע בַּחֶבֶל שֶׁעָלָיו תָּלוּי הַנֹּאד — לֹא בַּנֹּאד', wind: 0.8, windFrom: 'left', maxStones: 10, par3: 2, par2: 4 },
];

/** the Hebrew praise lines (narration style, never verses) */
const PRAISE = {
  hit: ['יָפֶה', 'קְלִיעָה', 'בְּדִיּוּק', 'יָד בְּטוּחָה'],
  perfect: ['מֻשְׁלָם', 'שִׁחְרוּר מֻשְׁלָם', 'כְּמוֹ חֵץ'],
  streak: ['שְׁתַּיִם בְּרֶצֶף', 'שָׁלֹשׁ בְּרֶצֶף', 'אַרְבַּע בְּרֶצֶף', 'אֵין מַחְטִיא'],
  far: ['מֵרָחוֹק', 'קְלִיעָה רְחוֹקָה'],
  cord: ['בַּחֶבֶל עַצְמוֹ'],
  skin: ['בַּנֹּאד — לֹא בַּחֶבֶל'],
  last: ['הַסִּבּוּב שֶׁלְּךָ'],
};
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** one thing to hit in a round */
interface RTarget {
  id: string;
  round: number;
  alive: boolean;
  /** counts for the round (the skin itself does not: only its cord) */
  counts: boolean;
  hit: HitTarget;
  update(dt: number, t: number): void;
  reset(): void;
  /** where the round's marker / the panel points */
  center(): THREE.Vector3;
}

export interface RangeHooks {
  /** slow motion (time scale) for `seconds` of real time */
  slowMo(scale: number, seconds: number): void;
  shake(a: number): void;
  sfx(name: string, volume?: number, pitch?: number): void;
  sfxAt(name: string, at: THREE.Vector3, volume?: number, pitch?: number): void;
  hitMarker(strong: boolean): void;
  praise(text: string): void;
  /** a perfect long shot: the lens may follow the stone (briefly) */
  followStone?(shot: ShotInfo): void;
  /** run fn after `seconds` (game clock) */
  later?(seconds: number, fn: () => void): void;
}

export interface RoundStats {
  round: number;
  hits: number;
  targets: number;
  stones: number;
  perfects: number;
  sweet: number;
  streak: number;
  bestStreak: number;
  time: number;
  done: boolean;
  marks: number;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export class Range {
  readonly group = new THREE.Group();
  /** where David stands to sling (the throwing mark by the stone heap) */
  readonly station = new THREE.Vector3();
  /** the station's line (toward the targets) and its right */
  readonly F = new THREE.Vector3();
  readonly R = new THREE.Vector3();
  readonly heap = new THREE.Vector3();
  built = false;
  /** 0 = no round; 1..4 */
  round = 0;
  live = false;
  /** he has left the throwing mark: the targets do not count (the stones pass them) until he is back */
  offMark = false;
  stats: RoundStats = blankStats(0);
  /** best marks per round (replays keep the best) */
  readonly best = [0, 0, 0, 0];
  private targets: RTarget[] = [];
  private solids: HitTarget[] = [];
  private time = 0;
  private cloth: { geo: THREE.BufferGeometry; base: Float32Array; pole: THREE.Vector3 } | null = null;
  private windDir = new THREE.Vector3();
  private windNow = 0;
  private savedWind = new THREE.Vector3();
  private savedStrength = 1;
  private windOn = false;
  onRoundDone?: (s: RoundStats) => void;

  constructor(private engine: Engine, private projectiles: Projectiles, private hooks: RangeHooks, private jarsOut: Jar[]) {
    const L = LAYOUT.range;
    this.station.set(L.x, engine.terrain.heightAt(L.x, L.z), L.z);
    this.F.set(Math.sin(L.facing), 0, Math.cos(L.facing));
    this.R.set(-this.F.z, 0, this.F.x); // his right when facing F (facing +Z, +X is his left)
    this.heap.copy(this.station).addScaledVector(this.R, 1.6).addScaledVector(this.F, -0.6);
    this.heap.y = engine.terrain.heightAt(this.heap.x, this.heap.z);
  }

  /** a point on the ground at `ahead` along the line and `right` across it (+ `up`) */
  at(ahead: number, right: number, up = 0, out = new THREE.Vector3()) {
    out.copy(this.station).addScaledVector(this.F, ahead).addScaledVector(this.R, right);
    out.y = this.engine.terrain.heightAt(out.x, out.z) + up;
    return out;
  }

  /**
   * Can the slinger see p from the throwing mark — from his eyes and from the aim lens behind his shoulder — over the
   * dry grass on the slope (`clear` above the ground along the sight line; none in the last metre before p)?
   */
  private visible(p: THREE.Vector3, clear = 0.3) {
    const eyes = [_v.copy(this.station).add(_w.set(0, 1.65, 0)), this.station.clone().addScaledVector(this.F, -1.85).add(_w.set(0, 2.1, 0))];
    for (const e of eyes) {
      const d = e.distanceTo(p), n = Math.max(12, Math.ceil(d / 0.3));
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const x = e.x + (p.x - e.x) * u, y = e.y + (p.y - e.y) * u, z = e.z + (p.z - e.z) * u;
        if (this.engine.terrain.heightAt(x, z) > y - ((1 - u) * d < 1 ? 0.04 : clear)) return false;
      }
    }
    return true;
  }

  /**
   * The base for a target on the ground at (ahead, right) whose middle is `mid` above its base: a cairn `want` high,
   * built up (to 2.6 m at most) when the slope would hide the target's middle.
   */
  private base(ahead: number, right: number, want: number, mid: number, rockMat: THREE.Material, rockGeo: THREE.BufferGeometry, rnd: () => number) {
    const p = this.at(ahead, right);
    const probe = new THREE.Vector3();
    const seen = (h: number) => this.visible(probe.set(p.x, p.y + h + mid, p.z));
    let h = want;
    if (!seen(h)) {
      let lo = h, hi = 2.6;
      if (seen(hi)) {
        for (let k = 0; k < 6; k++) {
          const m = (lo + hi) / 2;
          if (seen(m)) hi = m;
          else lo = m;
        }
      }
      h = Math.min(2.6, hi + 0.1);
    }
    if (h > 0.05) {
      // a cairn of fieldstones (the shepherd's stand for a target): instanced with the others; a tall one is broader
      const n = Math.max(2, Math.round(h / 0.18) + 1);
      const tall = Math.min(1, h / 2);
      for (let i = 0; i < n; i++) {
        const s = (0.2 + rnd() * 0.08) * (1 + 0.35 * tall) - i * 0.012 * (1 - 0.55 * tall);
        this.cairnM.push(new THREE.Matrix4().compose(
          new THREE.Vector3(p.x + (rnd() - 0.5) * 0.12, p.y + (i / n) * h + 0.05, p.z + (rnd() - 0.5) * 0.12),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd() * 0.3)),
          new THREE.Vector3(s * 1.3, s * 0.8, s * 1.15),
        ));
      }
      const bottom = new THREE.Vector3(p.x, p.y + 0.1, p.z), top = new THREE.Vector3(p.x, p.y + Math.max(0.1, h - 0.12), p.z);
      this.solids.push({ id: 'cairn', center: () => bottom.clone().lerp(top, 0.5), radius: 0.22, enabled: () => true, onHit: () => undefined, kind: 'solid', material: 'rock', segment: () => [bottom, top] as const });
    }
    p.y += h;
    return p;
  }

  private buildP: Promise<void> | null = null;
  /** main-thread ms of each build step (between the frames it yields) */
  readonly stepMs: number[] = [];
  private cairnM: THREE.Matrix4[] = [];
  /** build once (later calls wait for the same build) */
  build() {
    return (this.buildP ??= this.buildSteps());
  }
  private async buildSteps() {
    let t0 = performance.now();
    const lap = async () => {
      this.stepMs.push(+(performance.now() - t0).toFixed(1));
      await nextFrame();
      t0 = performance.now();
    };
    const eng = this.engine;
    const ground = (x: number, z: number) => eng.terrain.heightAt(x, z);
    const rnd = mulberry32(2016);
    const tex = eng.tex;
    const rockMat = rockMaterial(tex, 0xe6dccb);
    const rockGeo = boulderGeometry(12, 1);
    const clay = new THREE.MeshStandardMaterial({ color: 0xb4643a, roughness: 0.82 });
    const clayPale = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.85 });
    const jarGeo = jarGeometry();
    // ---- the station: a throwing mark of small stones in the dust, and the heap of sling stones beside it
    {
      const mark = new THREE.InstancedMesh(rockGeo, rockMat, 9);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 9; i++) {
        const p = this.at(0.55, (i - 4) * 0.22);
        const s = 0.045 + rnd() * 0.02;
        m4.compose(p.add(_w.set(0, s * 0.3, 0)), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, 0)), new THREE.Vector3(s * 1.4, s * 0.7, s));
        mark.setMatrixAt(i, m4);
      }
      mark.receiveShadow = true;
      this.group.add(mark);
      const heap = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0xd8ccb4, roughness: 0.75 }), 34);
      for (let i = 0; i < 34; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.32 * (1 - i / 60);
        const x = this.heap.x + Math.cos(a) * r, z = this.heap.z + Math.sin(a) * r;
        const s = 0.032 + rnd() * 0.014;
        const y = ground(x, z) + s * 0.4 + (0.32 - r) * 0.35;
        m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())), new THREE.Vector3(s * 1.2, s * 0.8, s));
        heap.setMatrixAt(i, m4);
      }
      heap.castShadow = true;
      heap.receiveShadow = true;
      this.group.add(heap);
    }
    await lap();
    // ---- 1. the warm-up: a terrace wall of fieldstones with three jars at 12-16 m
    {
      // (its own sector, right of the line: nothing farther out is behind it)
      const pts = [this.at(12.3, 3.2), this.at(14.0, 4.65), this.at(15.8, 6.3)];
      const dir = _w.subVectors(pts[2], pts[0]).setY(0).normalize().clone();
      const wall = new THREE.InstancedMesh(rockGeo, rockMat, 30);
      const m4 = new THREE.Matrix4();
      let k = 0;
      for (let i = 0; i < 15; i++) {
        for (let row = 0; row < 2; row++) {
          const t = (i - 7) * 0.42 + (row ? 0.2 : 0);
          const c = pts[1].clone().addScaledVector(dir, t);
          const y = ground(c.x, c.z) + row * 0.3 + 0.12;
          const s = 0.26 + rnd() * 0.08;
          m4.compose(new THREE.Vector3(c.x, y, c.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd() * 0.3)), new THREE.Vector3(s * 1.3, s, s));
          wall.setMatrixAt(k++, m4);
        }
      }
      wall.castShadow = wall.receiveShadow = true;
      this.group.add(wall);
      for (let i = -3; i <= 3; i++) {
        const c = pts[1].clone().addScaledVector(dir, i * 0.95);
        this.solids.push({ id: 'wall', center: () => new THREE.Vector3(c.x, ground(c.x, c.z) + 0.3, c.z), radius: 0.42, enabled: () => true, onHit: () => undefined, kind: 'solid', material: 'rock' });
      }
      for (let i = 0; i < 3; i++) {
        const c = pts[i].clone().addScaledVector(dir, (i - 1) * 0.3);
        const base = new THREE.Vector3(c.x, ground(c.x, c.z) + 0.62, c.z);
        this.addJar(1, base, 0.95 + rnd() * 0.15, i === 1 ? clayPale : clay, jarGeo, false);
      }
    }
    await lap();
    // ---- 2. at a distance: jars and gourds on the far bank, 22-35 m
    {
      const spots: [number, number, 'jar' | 'gourd'][] = [[22.5, -1.0, 'jar'], [26.5, 2.4, 'gourd'], [30.5, -3.0, 'jar'], [34.5, 1.2, 'gourd']];
      for (const [a, r, kind] of spots) {
        const b = this.base(a, r, 0.35, kind === 'jar' ? 0.28 * 1.25 : 0.15 * 1.2, rockMat, rockGeo, rnd);
        // (larger storage jars and big gourds out there: at 30 m a water jar is a few pixels on a phone)
        if (kind === 'jar') this.addJar(2, b, 1.25, clay, jarGeo, true);
        else this.addGourd(2, b, 1.2, rnd);
      }
      // the rag on its stick: shows the wind beside the far targets
      this.addCloth(this.at(27, -5.8), rnd);
      if (this.cairnM.length) {
        const im = new THREE.InstancedMesh(rockGeo, rockMat, this.cairnM.length);
        this.cairnM.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = im.receiveShadow = true;
        this.group.add(im);
      }
    }
    await lap();
    // ---- the terebinth (rounds 3 and 4): a gnarled tree on the near bank, a long low branch out over the line
    const tree = this.at(18.0, -9.6);
    // (a big old tree down on the wadi floor: its long low branch ≈4 m up, what hangs from it stands against the far bank)
    const branchEnd = this.at(19.9, -3.4, 4.05);
    const branchStart = tree.clone().add(_w.set(0, 3.1, 0));
    {
      const detail = { radial: 7, rings: 2.2, cards: 0.9 };
      const g = oakTree(433, detail, 'terebinth');
      const bark = new THREE.MeshStandardMaterial({ map: tex.bark, normalMap: tex.barkN, roughness: 0.93, color: 0x9a9184 });
      const leaves = foliageMaterial(tex.broadleaf, { sway: 0.045, flutter: 0.018, translucency: 0.4, roughness: 0.62 });
      const holder = new THREE.Group();
      holder.position.copy(tree).add(_w.set(0, -0.05, 0));
      holder.rotation.y = rnd() * 6;
      holder.scale.setScalar(1.25);
      const bm = new THREE.Mesh(g.bark, bark);
      const lm = new THREE.Mesh(g.leaves, leaves);
      bm.castShadow = lm.castShadow = true;
      bm.receiveShadow = lm.receiveShadow = true;
      holder.add(bm, lm);
      this.group.add(holder);
      // the long branch the shepherd hangs his targets from
      const mid = branchStart.clone().lerp(branchEnd, 0.5).add(_w.set(0, 0.35, 0));
      const pts = [branchStart, mid, branchEnd.clone().add(_w.set(0, -0.08, 0)), branchEnd.clone().addScaledVector(this.R, 0.45).add(_w.set(0, 0.12, 0))];
      const tube = gnarlyTube(pts, 0.11, 0.035, 20, 7, 0.25, 77);
      const br = new THREE.Mesh(tube, bark);
      br.castShadow = br.receiveShadow = true;
      this.group.add(br);
      this.solids.push({ id: 'trunk', center: () => tree.clone().add(_w.set(0, 1.6, 0)), radius: 0.36, enabled: () => true, onHit: () => undefined, kind: 'solid', material: 'wood', segment: () => [tree.clone().add(new THREE.Vector3(0, 0.2, 0)), tree.clone().add(new THREE.Vector3(0, 3.2, 0))] as const });
      this.solids.push({ id: 'branch', center: () => mid, radius: 0.09, enabled: () => true, onHit: () => undefined, kind: 'solid', material: 'wood', segment: () => [branchStart, branchEnd] as const });
    }
    await lap();
    // ---- 3. moving: a gourd swinging under the branch, a jar lashed to a rolling log
    {
      const pivot = branchStart.clone().lerp(branchEnd, 0.5).add(_w.set(0, 0.16, 0));
      this.addSwingGourd(3, pivot, 1.25, rnd);
      this.addLog(3, rnd, clay, jarGeo);
    }
    // ---- 4. the thin cord: a waterskin hanging from the branch's end
    this.addSkin(4, branchEnd.clone().add(_w.set(0, -0.06, 0)));
    for (const s of this.solids) this.projectiles.targets.push(s);
    this.setRoundVisible(0);
    this.stepMs.push(+(performance.now() - t0).toFixed(1));
    this.built = true;
  }

  // ------------------------------------------------------------------------------------------ targets
  private register(t: RTarget) {
    this.targets.push(t);
    this.projectiles.targets.push(t.hit);
  }

  private addJar(round: number, base: THREE.Vector3, scale: number, mat: THREE.Material, geo: THREE.BufferGeometry, water: boolean) {
    const jar = new Jar(mat, (x, z) => this.engine.terrain.heightAt(x, z), base, scale, geo);
    this.group.add(jar.group);
    if (round === 1) this.jarsOut.push(jar);
    const t: RTarget = {
      id: 'jar', round, alive: true, counts: true,
      hit: {
        id: 'jar', center: () => jar.center, radius: 0.22 * scale, kind: 'target', material: 'clay',
        enabled: () => this.live && !this.offMark && this.round === round && t.alive,
        onHit: (_at, vel, shot) => {
          t.alive = false;
          jar.shatter(vel);
          this.hooks.sfxAt('jarShatter', jar.center, 1, 0.85 + Math.random() * 0.3);
          this.engine.particles.dustBurst(jar.center, 10, 0.8, new THREE.Color(0.72, 0.45, 0.3));
          if (water) {
            this.hooks.sfxAt('waterSplash', jar.center, 0.9);
            this.spray(jar.center, vel, 26);
          }
          this.onTargetHit(t, shot);
        },
      },
      update: (dt) => jar.update(dt),
      reset: () => {
        t.alive = true;
        jar.reset();
      },
      center: () => jar.center,
    };
    t.hit.center = () => jar.center;
    this.register(t);
    (t as RTarget & { obj: THREE.Object3D }).obj = jar.group;
    return t;
  }

  private gourdGeo: THREE.BufferGeometry | null = null;
  private gourdMat: THREE.Material | null = null;
  private gourdParts() {
    if (!this.gourdGeo) {
      // a dry bottle gourd (Lagenaria): a bulb, a waist, a smaller top and a stub of stalk
      const pr: [number, number][] = [[0, 0], [0.07, 0.008], [0.11, 0.04], [0.125, 0.09], [0.11, 0.14], [0.065, 0.18], [0.05, 0.21], [0.065, 0.25], [0.07, 0.29], [0.055, 0.33], [0.02, 0.35], [0.012, 0.38], [0.0, 0.385]];
      this.gourdGeo = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 18);
      this.gourdMat = new THREE.MeshStandardMaterial({ color: 0xc9a467, roughness: 0.58 });
    }
    return { geo: this.gourdGeo!, mat: this.gourdMat! };
  }

  private addGourd(round: number, base: THREE.Vector3, scale: number, rnd: () => number) {
    const { geo, mat } = this.gourdParts();
    const g = new THREE.Group();
    const halves: THREE.Mesh[] = [];
    for (const s of [0, 1]) {
      // two halves (cut along the gourd's length) that split apart when hit
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.scale.set(s ? -1 : 1, 1, 1);
      halves.push(m);
      g.add(m);
    }
    g.position.copy(base);
    g.scale.setScalar(scale);
    g.rotation.y = rnd() * 6;
    this.group.add(g);
    const center = base.clone().add(new THREE.Vector3(0, 0.15 * scale, 0));
    const vel: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3()];
    const spin: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3()];
    let split = false;
    const t: RTarget = {
      id: 'gourd', round, alive: true, counts: true,
      hit: {
        id: 'gourd', center: () => center, radius: 0.15 * scale, kind: 'target', material: 'wood',
        enabled: () => this.live && !this.offMark && this.round === round && t.alive,
        onHit: (_at, v, shot) => {
          t.alive = false;
          split = true;
          const side = new THREE.Vector3(-v.z, 0, v.x).normalize();
          vel[0].copy(side).multiplyScalar(1.6).addScaledVector(v, 0.06).add(new THREE.Vector3(0, 2.2, 0));
          vel[1].copy(side).multiplyScalar(-1.6).addScaledVector(v, 0.06).add(new THREE.Vector3(0, 2.0, 0));
          spin[0].set(6, 2, 9);
          spin[1].set(-7, -3, -8);
          this.hooks.sfxAt('gourdSplit', center, 1);
          this.engine.particles.dustBurst(center, 7, 0.6, new THREE.Color(0.8, 0.7, 0.45));
          this.seeds(center, v);
          this.onTargetHit(t, shot);
        },
      },
      update: (dt) => {
        if (!split) return;
        for (let i = 0; i < 2; i++) {
          const h = halves[i];
          if (vel[i].lengthSq() < 1e-4) continue;
          vel[i].y -= 9.81 * dt;
          h.position.addScaledVector(vel[i], dt / scale);
          h.rotation.x += spin[i].x * dt;
          h.rotation.z += spin[i].z * dt;
          const wy = g.position.y + h.position.y * scale;
          const gy = this.engine.terrain.heightAt(g.position.x + h.position.x * scale, g.position.z + h.position.z * scale);
          if (wy < gy + 0.03) {
            h.position.y = (gy + 0.03 - g.position.y) / scale;
            vel[i].multiplyScalar(0.25);
            vel[i].y = Math.abs(vel[i].y) * 0.25;
            spin[i].multiplyScalar(0.4);
            if (vel[i].length() < 0.25) vel[i].set(0, 0, 0);
          }
        }
      },
      reset: () => {
        t.alive = true;
        split = false;
        for (const h of halves) {
          h.position.set(0, 0, 0);
          h.rotation.set(0, 0, 0);
        }
      },
      center: () => center,
    };
    this.register(t);
    (t as RTarget & { obj: THREE.Object3D }).obj = g;
    return t;
  }

  private addSwingGourd(round: number, pivot: THREE.Vector3, len: number, rnd: () => number) {
    const { geo, mat } = this.gourdParts();
    const g = new THREE.Group();
    const body = new THREE.Mesh(geo, mat);
    body.castShadow = true;
    body.position.y = -0.37; // hangs by its stalk
    g.add(body);
    this.group.add(g);
    const cordGeo = new THREE.BufferGeometry().setFromPoints([pivot, pivot.clone()]);
    const cord = new THREE.Line(cordGeo, new THREE.LineBasicMaterial({ color: 0xd9c49a }));
    cord.frustumCulled = false;
    this.group.add(cord);
    const center = new THREE.Vector3();
    const tip = new THREE.Vector3();
    let ang = 0, falling = false;
    const fallV = new THREE.Vector3();
    // a pendulum across the line of throw (it swings left-right in the slinger's view): ±0.45 m, ≈2.6 s a swing
    const amp = 0.36;
    const phase0 = rnd() * 6;
    const place = (t: number) => {
      ang = amp * Math.sin((2 * Math.PI * t) / 2.6 + phase0);
      tip.copy(pivot).addScaledVector(this.R, Math.sin(ang) * len).add(_w.set(0, -Math.cos(ang) * len, 0));
      g.position.copy(tip);
      g.rotation.set(0, 0, 0);
      g.rotateOnWorldAxis(this.F, -ang);
      center.copy(tip).add(_w.set(0, -0.22, 0));
      const p = cordGeo.getAttribute('position') as THREE.BufferAttribute;
      p.setXYZ(1, tip.x, tip.y, tip.z);
      p.needsUpdate = true;
    };
    place(0);
    const t: RTarget = {
      id: 'swing', round, alive: true, counts: true,
      hit: {
        id: 'gourd', center: () => center, radius: 0.17, kind: 'target', material: 'wood',
        enabled: () => this.live && !this.offMark && this.round === round && t.alive,
        onHit: (_at, v, shot) => {
          t.alive = false;
          falling = true;
          fallV.copy(v).multiplyScalar(0.05).add(_w.set(0, 1.2, 0));
          cord.visible = false;
          this.hooks.sfxAt('gourdSplit', center, 1);
          this.seeds(center, v);
          this.engine.particles.dustBurst(center, 6, 0.5, new THREE.Color(0.8, 0.7, 0.45));
          this.onTargetHit(t, shot);
        },
      },
      update: (dt, time) => {
        if (!falling) {
          place(time);
          return;
        }
        if (fallV.lengthSq() < 1e-4) return;
        fallV.y -= 9.81 * dt;
        g.position.addScaledVector(fallV, dt);
        g.rotateOnWorldAxis(this.R, dt * 4);
        const gy = this.engine.terrain.heightAt(g.position.x, g.position.z) + 0.05;
        if (g.position.y < gy) {
          g.position.y = gy;
          fallV.set(0, 0, 0);
          this.hooks.sfxAt('stoneOnEarth', g.position, 0.5, 0.7);
        }
      },
      reset: () => {
        t.alive = true;
        falling = false;
        cord.visible = true;
      },
      center: () => center,
    };
    this.register(t);
    (t as RTarget & { obj: THREE.Object3D }).obj = g;
    (t as RTarget & { extra: THREE.Object3D[] }).extra = [cord];
  }

  private addLog(round: number, rnd: () => number, clay: THREE.Material, jarGeo: THREE.BufferGeometry) {
    // the log rolls across the line at 28 m, on the foot of the far bank (in full view from the mark), toward its
    // lower side; a small jar lashed to its end (on its axis) turns with it
    const a = this.at(28.0, -9.0), b = this.at(28.0, 1.0);
    const down = a.y > b.y ? 1 : -1; // roll toward the lower end
    const from = down > 0 ? a : b, to = down > 0 ? b : a;
    const logR = 0.13, logL = 1.0;
    const bark = new THREE.MeshStandardMaterial({ map: this.engine.tex.bark, normalMap: this.engine.tex.barkN, color: 0x8a7a66, roughness: 0.95 });
    const log = new THREE.Mesh(new THREE.CylinderGeometry(logR, logR * 1.05, logL, 12, 1), bark);
    log.castShadow = true;
    const holder = new THREE.Group();
    const spinner = new THREE.Group();
    holder.add(spinner);
    spinner.add(log);
    log.rotation.x = Math.PI / 2; // the log's axis along the holder's z (the line of throw)
    const jar = new THREE.Mesh(jarGeo, clay);
    jar.castShadow = true;
    jar.scale.setScalar(0.62);
    jar.rotation.x = -Math.PI / 2; // lying on its side, its base against the log's end
    jar.position.set(0, 0, -logL / 2 - 0.01);
    spinner.add(jar);
    // lashing: a dark cord ring round the jar's neck to the log
    const lash = new THREE.Mesh(new THREE.TorusGeometry(logR * 0.85, 0.008, 5, 16), new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.9 }));
    lash.position.z = -logL / 2 + 0.03;
    spinner.add(lash);
    this.group.add(holder);
    const dir = _w.subVectors(to, from).setY(0).normalize().clone();
    const total = from.distanceTo(to);
    const yaw = Math.atan2(this.F.x, this.F.z);
    const center = new THREE.Vector3();
    let s = 0, wait = 0.6, rolling = true, alpha = 1;
    const jarWorld = new THREE.Vector3();
    const setAt = (dist: number) => {
      const p = from.clone().addScaledVector(dir, dist);
      p.y = this.engine.terrain.heightAt(p.x, p.z) + logR;
      holder.position.copy(p);
      holder.rotation.set(0, yaw, 0);
      spinner.rotation.z = -(dist / logR) * down * 0.999;
      jarWorld.set(0, 0, -logL / 2 - 0.12);
      spinner.localToWorld(jarWorld);
      center.copy(jarWorld);
    };
    setAt(0);
    const t: RTarget = {
      id: 'log', round, alive: true, counts: true,
      hit: {
        id: 'jar', center: () => center, radius: 0.18, kind: 'target', material: 'clay',
        enabled: () => this.live && !this.offMark && this.round === round && t.alive && alpha > 0.5,
        onHit: (_at, v, shot) => {
          t.alive = false;
          jar.visible = false;
          lash.visible = false;
          this.hooks.sfxAt('jarShatter', center, 1, 1.1);
          this.engine.particles.dustBurst(center, 10, 0.8, new THREE.Color(0.72, 0.45, 0.3));
          this.sherds(center, v);
          this.onTargetHit(t, shot);
        },
      },
      update: (dt) => {
        if (!this.live || this.round !== round) return;
        if (rolling) {
          if (wait > 0) {
            wait -= dt;
            return;
          }
          const sp = 1.15 + Math.min(0.75, s * 0.09); // it picks up speed down the slope
          s += sp * dt;
          setAt(Math.min(s, total));
          if (s >= total) {
            rolling = false;
            wait = 1.2;
          }
        } else {
          // at the bottom: it is set up again at the top (fade out / in) while it lasts
          wait -= dt;
          alpha = clamp(wait / 0.6, 0, 1);
          if (wait <= 0) {
            s = 0;
            rolling = true;
            wait = 0.9;
            alpha = 1;
            setAt(0);
          }
        }
        holder.visible = alpha > 0.05 || rolling;
      },
      reset: () => {
        t.alive = true;
        jar.visible = lash.visible = true;
        s = 0;
        rolling = true;
        wait = 0.6;
        alpha = 1;
        setAt(0);
        holder.visible = true;
      },
      center: () => center,
    };
    this.register(t);
    (t as RTarget & { obj: THREE.Object3D }).obj = holder;
    this.solids.push({ id: 'log', center: () => holder.position, radius: logR + 0.02, enabled: () => this.live && this.round === round, onHit: () => undefined, kind: 'solid', material: 'wood', segment: () => [holder.localToWorld(new THREE.Vector3(0, 0, -logL / 2)), holder.localToWorld(new THREE.Vector3(0, 0, logL / 2))] as const });
    void rnd;
  }

  private addSkin(round: number, pivot: THREE.Vector3) {
    // a goatskin waterskin (נֹאד): a full, bulging body, the neck tied, hung by a thin cord from the branch
    const pr: [number, number][] = [[0, 0], [0.09, 0.02], [0.17, 0.09], [0.2, 0.2], [0.19, 0.32], [0.14, 0.42], [0.07, 0.48], [0.035, 0.52], [0.04, 0.56], [0.0, 0.57]];
    const geo = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 16);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      // flattened front-to-back, lumpy (legs tied off), a skin not a pot
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const lump = 1 + 0.08 * Math.sin(x * 22 + y * 9) * Math.sin(z * 17);
      pos.setXYZ(i, x * 1.15 * lump, y, z * 0.72 * lump);
    }
    geo.computeVertexNormals();
    const leather = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.55, metalness: 0 });
    const skin = new THREE.Group();
    const body = new THREE.Mesh(geo, leather);
    body.castShadow = true;
    body.rotation.x = Math.PI; // the neck up
    body.position.y = 0.0;
    skin.add(body);
    this.group.add(skin);
    const len = 0.78;
    const cordGeo = new THREE.BufferGeometry().setFromPoints([pivot, pivot.clone()]);
    const cord = new THREE.Line(cordGeo, new THREE.LineBasicMaterial({ color: 0xe2cfa4 }));
    cord.frustumCulled = false;
    this.group.add(cord);
    const neck = new THREE.Vector3();
    const center = new THREE.Vector3();
    const cordA = new THREE.Vector3(), cordB = new THREE.Vector3();
    let sw = 0, swV = 0, cut = false;
    const fallV = new THREE.Vector3();
    let landed = false;
    const place = (dt: number) => {
      // a heavy, slow pendulum swayed a little by the wind (and hard by a stone on the skin)
      const wind = this.windNow * (this.windDir.dot(this.R));
      swV += (-9.81 / len * sw - 1.2 * swV + wind * 0.05) * dt;
      sw += swV * dt;
      neck.copy(pivot).addScaledVector(this.R, Math.sin(sw) * len).add(_w.set(0, -Math.cos(sw) * len, 0));
      skin.position.copy(neck);
      skin.rotation.set(0, Math.atan2(this.F.x, this.F.z), 0);
      skin.rotateOnWorldAxis(this.F, -sw);
      center.copy(neck).add(_w.set(0, -0.3, 0));
      cordA.copy(pivot);
      cordB.copy(neck);
      const p = cordGeo.getAttribute('position') as THREE.BufferAttribute;
      p.setXYZ(1, neck.x, neck.y, neck.z);
      p.needsUpdate = true;
    };
    place(0);
    const cordT: RTarget = {
      id: 'cord', round, alive: true, counts: true,
      hit: {
        id: 'cord', center: () => cordA.clone().lerp(cordB, 0.5), radius: 0.07, kind: 'target', material: 'skin',
        segment: () => [cordA, cordB] as const,
        enabled: () => this.live && !this.offMark && this.round === round && cordT.alive,
        onHit: (_at, v, shot) => {
          cordT.alive = false;
          cut = true;
          fallV.copy(v).multiplyScalar(0.02);
          // the cord snaps: its upper end springs up and stays on the branch
          const p = cordGeo.getAttribute('position') as THREE.BufferAttribute;
          p.setXYZ(1, pivot.x + 0.05, pivot.y - 0.28, pivot.z);
          p.needsUpdate = true;
          this.hooks.sfxAt('cordSnap', cordA.clone().lerp(cordB, 0.5), 1);
          this.onTargetHit(cordT, shot);
        },
      },
      update: (dt) => {
        if (!cut) {
          place(dt);
          return;
        }
        if (landed) return;
        fallV.y -= 9.81 * dt;
        skin.position.addScaledVector(fallV, dt);
        const gy = this.engine.terrain.heightAt(skin.position.x, skin.position.z) + 0.16;
        if (skin.position.y < gy) {
          skin.position.y = gy;
          landed = true;
          skin.rotation.z += 0.9; // it slumps over
          this.hooks.sfxAt('skinThud', skin.position, 1);
          this.hooks.sfxAt('waterSplash', skin.position, 0.7, 0.85);
          this.engine.particles.dustBurst(skin.position, 12, 0.9);
          this.spray(skin.position.clone().add(_w.set(0, 0.2, 0)), _v.set(0, -1, 0), 14);
        }
      },
      reset: () => {
        cordT.alive = true;
        cut = landed = false;
        sw = swV = 0;
        place(0);
      },
      center: () => cordA.clone().lerp(cordB, 0.5),
    };
    this.register(cordT);
    (cordT as RTarget & { obj: THREE.Object3D }).obj = skin;
    (cordT as RTarget & { extra: THREE.Object3D[] }).extra = [cord];
    // the skin itself: a stone on it only swings it (and a little water seeps); the cord is the target
    const skinT: RTarget = {
      id: 'skin', round, alive: true, counts: false,
      hit: {
        id: 'skin', center: () => center, radius: 0.21, kind: 'target', material: 'skin',
        enabled: () => this.live && !this.offMark && this.round === round && cordT.alive,
        onHit: (_at, v) => {
          swV += clamp(v.dot(this.R) * 0.05, -1.4, 1.4) + 0.3 * Math.sign(v.dot(this.R) || 1);
          this.hooks.sfxAt('skinThud', center, 0.6, 1.3);
          this.spray(center, v, 6);
          this.hooks.praise(pick(PRAISE.skin));
          this.stats.streak = 0;
        },
      },
      update: () => undefined,
      reset: () => undefined,
      center: () => center,
    };
    this.register(skinT);
  }

  /** the rag tied to a stick: it streams with the wind (the round's wind made visible) */
  private addCloth(at: THREE.Vector3, rnd: () => number) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0x7b6a52, roughness: 0.9 }));
    pole.position.copy(at).add(_w.set(0, 0.8, 0));
    pole.rotation.z = (rnd() - 0.5) * 0.1;
    pole.castShadow = true;
    this.group.add(pole);
    const geo = new THREE.PlaneGeometry(0.55, 0.13, 10, 1);
    geo.translate(0.275, 0, 0);
    const base = Float32Array.from((geo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb35a3c, roughness: 0.95, side: THREE.DoubleSide }));
    const top = at.clone().add(_w.set(0, 1.58, 0));
    mesh.position.copy(top);
    mesh.castShadow = true;
    this.group.add(mesh);
    this.cloth = { geo, base, pole: top };
  }

  private updateCloth(t: number) {
    const c = this.cloth;
    if (!c) return;
    const p = c.geo.getAttribute('position') as THREE.BufferAttribute;
    // stream downwind: the strip's x runs along the wind, droops when the air is still, flutters with gusts
    const w = this.windNow;
    const lift = clamp(w / 5, 0.15, 1);
    const yaw = Math.atan2(-this.windDir.z, this.windDir.x);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (let i = 0; i < p.count; i++) {
      const bx = c.base[i * 3], by = c.base[i * 3 + 1];
      const u = bx / 0.55;
      const flap = Math.sin(t * (5 + w) - u * 7) * 0.05 * u * (0.4 + lift);
      const droop = -(1 - lift) * u * 0.42;
      const x = bx * (0.55 + 0.45 * lift) * (1 - (1 - lift) * 0.3), y = by + droop + flap * 0.4;
      const z = flap;
      p.setXYZ(i, x * cy - z * sy, y, -x * sy - z * cy);
    }
    p.needsUpdate = true;
    c.geo.computeVertexNormals();
  }

  // ------------------------------------------------------------------------------------------ juice
  /** the water of a jar / the skin spraying out (bright droplets that fall) */
  private spray(at: THREE.Vector3, vel: THREE.Vector3, n: number) {
    const d = _v.copy(vel).normalize();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.8;
      this.engine.particles.emit({
        x: at.x, y: at.y + 0.05, z: at.z,
        vx: Math.cos(a) * s + d.x * 1.2, vy: 0.6 + Math.random() * 2.2, vz: Math.sin(a) * s + d.z * 1.2,
        max: 0.55 + Math.random() * 0.5, size: 0.05 + Math.random() * 0.06, grow: 0.05,
        r: 0.82, g: 0.88, b: 0.92, a: 0.85, drag: 0.6, grav: 9.8,
      });
    }
    for (let i = 0; i < 4; i++) {
      this.engine.particles.emit({ x: at.x, y: at.y - 0.1, z: at.z, vx: (Math.random() - 0.5) * 0.8, vy: 0.2, vz: (Math.random() - 0.5) * 0.8, max: 1.2, size: 0.3, grow: 0.5, r: 0.7, g: 0.66, b: 0.6, a: 0.35, drag: 2, grav: 0.1 });
    }
  }

  /** the pale seeds of a split gourd */
  private seeds(at: THREE.Vector3, vel: THREE.Vector3) {
    const d = _v.copy(vel).normalize();
    for (let i = 0; i < 14; i++) {
      this.engine.particles.emit({
        x: at.x, y: at.y, z: at.z,
        vx: (Math.random() - 0.5) * 2 + d.x, vy: 0.5 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2 + d.z,
        max: 0.8 + Math.random() * 0.4, size: 0.035, grow: 0, r: 0.95, g: 0.9, b: 0.75, a: 0.9, drag: 0.8, grav: 9.8,
      });
    }
  }

  /** sherds of a jar that is not a Jar (the log's) */
  private sherds(at: THREE.Vector3, vel: THREE.Vector3) {
    const d = _v.copy(vel).normalize();
    for (let i = 0; i < 16; i++) {
      this.engine.particles.emit({
        x: at.x, y: at.y, z: at.z,
        vx: (Math.random() - 0.5) * 3 + d.x * 1.5, vy: 0.6 + Math.random() * 2, vz: (Math.random() - 0.5) * 3 + d.z * 1.5,
        max: 0.9, size: 0.06, grow: 0, r: 0.7, g: 0.4, b: 0.25, a: 0.95, drag: 0.5, grav: 9.8,
      });
    }
  }

  // ------------------------------------------------------------------------------------------ rounds
  private setRoundVisible(r: number) {
    for (const t of this.targets) {
      const o = (t as RTarget & { obj?: THREE.Object3D }).obj;
      const extra = (t as RTarget & { extra?: THREE.Object3D[] }).extra ?? [];
      // round 1's jars and the tree's things stay up between rounds (they belong to the place); the far targets and the
      // log are set out for their round
      const show = t.round === 1 || t.round === 4 || t.round === 3 ? true : r === t.round || r === 0;
      if (o) o.visible = show;
      for (const e of extra) e.visible = show && t.alive;
    }
  }

  /** start (or restart) round r (1..4) */
  startRound(r: number) {
    this.round = r;
    this.live = true;
    this.time = 0;
    for (const t of this.targets) if (t.round === r) t.reset();
    this.setRoundVisible(r);
    const n = this.targets.filter((t) => t.round === r && t.counts).length;
    this.stats = blankStats(r);
    this.stats.targets = n;
    const def = ROUNDS[r - 1];
    this.setWind(def.wind, def.windFrom);
  }

  /** end the practice (the wind goes back to the land's own) */
  stop() {
    this.live = false;
    this.round = 0;
    this.setWind(0, 'left');
    if (this.windOn) {
      shared.uWind.value.copy(this.savedWind);
      shared.uWindStrength.value = this.savedStrength;
      this.windOn = false;
    }
  }

  private setWind(speed: number, from: 'left' | 'right') {
    if (!this.windOn) {
      this.savedWind.copy(shared.uWind.value);
      this.savedStrength = shared.uWindStrength.value;
      this.windOn = true;
    }
    // across the line of throw; 'left' = it blows from his left toward his right
    this.windDir.copy(this.R).multiplyScalar(from === 'left' ? 1 : -1).addScaledVector(this.F, 0.25).normalize();
    this.windNow = speed;
    this.projectiles.wind.copy(this.windDir).multiplyScalar(speed);
    // the grass, the trees and the dust show it (the shared wind of the world's shaders)
    shared.uWind.value.set(this.windDir.x, 0, this.windDir.z);
    shared.uWindStrength.value = this.savedStrength * (0.8 + speed * 0.22);
  }

  /** the wind line for the panel */
  windText() {
    if (this.windNow < 0.5) return '';
    const side = this.windDir.dot(this.R) > 0 ? 'מִשְּׂמֹאל' : 'מִיָּמִין';
    const strength = this.windNow > 3 ? 'רוּחַ' : 'רוּחַ קַלָּה';
    return `${strength} ${side} ${this.windDir.dot(this.R) > 0 ? '→' : '←'}`;
  }

  /** a stone left the sling (any throw while a round is live) */
  onShot(shot: ShotInfo) {
    if (!this.live) return;
    this.stats.stones++;
    if (shot.perfect) this.stats.perfects++;
    if (shot.sweet) this.stats.sweet++;
    if (shot.perfect && shot.aimDist > 19 && shot.intent && this.round >= 2) this.hooks.followStone?.(shot);
  }

  /** a throw is resolved: a miss breaks the streak */
  onResolve(shot: ShotInfo) {
    if (!this.live) return;
    if (!shot.hit || !this.targets.some((t) => t.hit === shot.hit && t.counts)) {
      if (!shot.hit || shot.hit.id !== 'skin') this.stats.streak = 0;
    }
  }

  private onTargetHit(t: RTarget, shot: ShotInfo | null) {
    const st = this.stats;
    st.hits++;
    st.streak++;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    const left = this.targets.filter((x) => x.round === this.round && x.counts && x.alive).length;
    const strong = !!shot?.perfect;
    this.hooks.hitMarker(strong);
    this.hooks.sfx('hitConfirm', 0.6);
    this.hooks.shake(strong ? 0.18 : 0.1);
    if (left === 0) {
      // the round's last hit: a beat of slow motion
      this.hooks.slowMo(0.3, 0.9);
      this.hooks.praise(t.id === 'cord' ? pick(PRAISE.cord) : pick(PRAISE.last));
      st.done = true;
      this.live = false;
      st.marks = this.marksFor(st);
      this.best[st.round - 1] = Math.max(this.best[st.round - 1], st.marks);
      if (this.hooks.later) this.hooks.later(1.1, () => this.onRoundDone?.(st));
      else setTimeout(() => this.onRoundDone?.(st), 1100);
      return;
    }
    if (st.streak >= 2) {
      this.hooks.sfx('streak', 0.7, 1 + 0.12 * (st.streak - 2));
      this.hooks.praise(PRAISE.streak[Math.min(PRAISE.streak.length - 1, st.streak - 2)]);
    } else if (shot?.perfect) this.hooks.praise(pick(PRAISE.perfect));
    else if (shot && shot.aimDist > 26) this.hooks.praise(pick(PRAISE.far));
    else this.hooks.praise(pick(PRAISE.hit));
  }

  /** one to three marks: stones used against the round's par, perfect releases count for a little */
  marksFor(st: RoundStats) {
    const def = ROUNDS[st.round - 1];
    if (!st.done) return 0;
    const eff = st.stones - Math.min(1, Math.floor(st.perfects / 2)) * 0.5;
    return eff <= def.par3 ? 3 : eff <= def.par2 ? 2 : 1;
  }

  /** the player may go on without finishing (enough stones spent) */
  get canSkip() {
    return this.live && this.round > 0 && this.stats.stones >= ROUNDS[this.round - 1].maxStones;
  }

  /** the round's targets (alive / hit) for the panel */
  targetStates() {
    return this.targets.filter((t) => t.round === this.round && t.counts).map((t) => !t.alive);
  }

  /** the centre of the round's targets (the marker) */
  focus(out = new THREE.Vector3()) {
    const list = this.targets.filter((t) => t.round === this.round && t.counts && t.alive);
    if (!list.length) return out.copy(this.station).addScaledVector(this.F, 14);
    out.set(0, 0, 0);
    for (const t of list) out.add(t.center());
    return out.multiplyScalar(1 / list.length);
  }

  update(dt: number) {
    if (!this.built) return;
    this.time += dt;
    if (this.live) this.stats.time += dt;
    for (const t of this.targets) t.update(dt, this.time);
    this.updateCloth(this.time);
  }
}

function blankStats(round: number): RoundStats {
  return { round, hits: 0, targets: 0, stones: 0, perfects: 0, sweet: 0, streak: 0, bestStreak: 0, time: 0, done: false, marks: 0 };
}
