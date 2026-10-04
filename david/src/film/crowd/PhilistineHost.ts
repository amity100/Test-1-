/*
 * PhilistineHost — the Philistine army marching on the coastal plain (docs/intro-script.md shot 4, seen from far away:
 * "וַתְּהִי הַמִּלְחָמָה חֲזָקָה עַל־פְּלִשְׁתִּים כֹּל יְמֵי שָׁאוּל", 1 Sam 14:52).
 *
 * Accuracy (docs/visual-bible.md §3.9): clean-shaven men (Medinet Habu) — no beards; rank and file with the reed /
 * feather crown on a band, ribbed corselet over a kilt with a tasselled hem, round shields, spears; the front ranks
 * (elite) with bronze helmets (17:5), bronze greaves (17:6), bronze-bossed round shields, iron-headed spears and
 * long swords; better armed than Israel (13:19-21). No horned helmets, no crests, no Greek / Roman look, no lettering.
 * Chariots are not drawn (the bible allows only distant simple shapes, or none).
 *
 * The host is a set of loose blocks (companies) marching in step-less order at ~1.2 m/s along `heading`.
 */
import * as THREE from 'three';
import { Crowd, type CrowdAgent, type CrowdTier } from './Crowd';
import { CrowdAnim, type CrowdClipSpec } from './CrowdAnim';
import { CrowdDust } from './CrowdDust';
import { bit } from './crowdShader';
import { FILM_CAM } from '../FilmCams';
import { slice } from '../../core/slice';
import type { HostVanguard, VanguardCue, VanguardSlot } from './HostVanguard';

export function philistineClips(lite: boolean): CrowdClipSpec[] {
  // CMU marches + Rocketbox walks (cut v2): heavier and more varied, no two neighbours alike
  // (host1, wave 5: only natural walks whose natural speed is near the host's 1.2 m/s — walk_d 1.54 and walk_n2 1.46
  //  m/s were time-warped to 0.8x and read as slow-motion strides floating over the plain; the captured 'march' and
  //  'march_c' are parade high-kicks (bench probe: foot lift 0.36 / 0.88 m, thigh swing 62° / 77° vs ~0.2 m / 41°))
  const w = lite ? ['walk_b', 'walk_n1', 'walk_cool'] : ['walk_b', 'walk_n1', 'walk_cool', 'walk', 'walk_c'];
  const s: CrowdClipSpec[] = [];
  for (const c of w) {
    // (wave 5) the spear at the side (carry 'side'): the shaft beside the shoulder, never across the face
    s.push({ clip: c, carry: 'side' });
    if (!lite) s.push({ clip: c, carry: 'side', mirror: true });
  }
  return s;
}

export interface PhilistineHostOptions {
  tier: CrowdTier;
  /** number of men drawn (default by tier) */
  count?: number;
  /** centre of the host's front at t = 0 (feet), default origin */
  origin?: THREE.Vector3;
  /** marching direction (yaw, game convention: forward = (sin, 0, cos)); default east (+X) */
  heading?: number;
  ground?: (x: number, z: number) => number;
  anim?: CrowdAnim;
  /** company layout: files per company, companies side by side */
  files?: number;
  companies?: number;
  /**
   * COLUMN mode (the land set's coast anchors): march along this polyline (ground points; the head of the column at
   * trail[0], the ranks trailing back along the rest), `columnWidth` metres wide. Overrides origin / heading.
   */
  trail?: THREE.Vector3[];
  columnWidth?: number;
  /**
   * the land set's coast anchors (LandSet.anchors.coast): COLUMN mode along its road from `columnHead` back toward
   * the sea, `columnWidth` wide (same trail as the set's own placeholders). Overrides trail / columnWidth.
   */
  coast?: { route: THREE.Vector3[]; columnHead: THREE.Vector3; columnWidth: number };
  /**
   * column mode: lateral offsets (m, + = the camera side of the coast shots) of further columns marching in the fields
   * beside the road, so the host reads as an army and not a file of men. Default by tier: desktop-high [-21, -42],
   * others [-22].
   */
  flanks?: number[];
  /** far field as skeletal impostors (Crowd LOD3); default true. Counts include them. */
  impostors?: boolean;
  /** footstep dust puffs (CrowdDust, coastal-plain sand colour); default true */
  dust?: boolean;
  /** override the tier's mesh LOD caps (nearest first; the overflow falls to the next LOD / the impostors) */
  lodCaps?: [number, number, number];
  /** override the tier's mesh LOD switch distances (m) — (cut7, P6: the front ranks march up to the lens) */
  lodDistances?: [number, number, number];
  /**
   * (host1, wave 5) full actors for the men of the main column nearest the P6 lens (HostVanguard): the count (default
   * by tier, HostVanguard.VANGUARD; 0 = the crowd alone, as before). Column mode only.
   */
  vanguard?: number;
  /** the point the vanguard is chosen around (default: P6's lens at the crane, from FILM_CAM.threat) */
  lens?: THREE.Vector3;
}

function hash(a: number, b: number) {
  const h = Math.sin(a * 12.9898 + b * 78.233 + 0.321) * 43758.5453;
  return h - Math.floor(h);
}

interface Man {
  ag: CrowdAgent; x: number; z: number; pace: number; seg: number; gx: number; gz: number; gy: number;
  /** weave + head: phase, rate */ ph: number; hr: number;
  /** the front ranks of the main column (the large foreground of P4) */ front: boolean;
  /** the spear's own carry angle */ lean0: number;
  /** (wave 5) column (0 = the main column on the road), file, rank, elite kit, the hash seed of the slot */
  col: number; file: number; rank: number; elite: boolean; seedI: number;
  /** (wave 5) ground speed (m/s) of the last placement */
  speed: number;
}

export class PhilistineHost {
  readonly crowd: Crowd;
  readonly anim: CrowdAnim;
  readonly center = new THREE.Vector3();
  /** footstep dust (null if disabled) */
  readonly dust: CrowdDust | null;
  /** marching speed (m/s); 0 halts (the men keep their pose) */
  speed = 1.2;
  heading: number;
  private readonly origin: THREE.Vector3;
  private readonly men: Man[] = [];
  private clock = 0;
  private readonly ground: (x: number, z: number) => number;
  private readonly ownsAnim: boolean;
  private travelled = 0;

  static async create(o: PhilistineHostOptions): Promise<PhilistineHost> {
    const lite = o.tier.startsWith('mobile');
    const imp = o.impostors !== false;
    const count = o.count ?? (imp
      ? (o.tier === 'mobile-low' ? 1200 : o.tier === 'mobile-high' ? 1600 : o.tier === 'desktop-medium' ? 2600 : 3800)
      : (o.tier === 'mobile-low' ? 360 : o.tier === 'mobile-high' ? 500 : o.tier === 'desktop-medium' ? 900 : 1400));
    const anim = o.anim ?? (await CrowdAnim.bake(philistineClips(lite)));
    const crowd = await Crowd.create({ army: 'philistine', anim, capacity: count, tier: o.tier, castShadow: [true, false, false], impostors: imp, lodCaps: o.lodCaps, lodDistances: o.lodDistances, lodHysteresis: 0.12 });
    const host = new PhilistineHost(crowd, anim, count, o, !o.anim, lite);
    // (wave 5) the vanguard: full actors in the slots of the main column nearest the lens
    if (host.trail) {
      if (slice.due()) await slice.pause();
      const { HostVanguard, VANGUARD } = await import('./HostVanguard');
      const n = Math.max(0, Math.min(24, o.vanguard ?? VANGUARD[o.tier].n));
      if (n > 0) {
        try {
          await host.buildVanguard(HostVanguard, n, o);
        } catch (e) {
          console.warn('[host] vanguard failed (the crowd alone)', e);
          host.dropVanguard();
        }
      }
    }
    return host;
  }

  // ------------------------------------------------------------------------------------------------ the vanguard
  private vanguard: HostVanguard | null = null;
  private vanMen: Man[] = [];
  private vanCues: VanguardCue[] = [];
  /** the coastal breeze in the cloth (m/s, world), a slow gust on it */
  readonly wind = new THREE.Vector3(0.9, 0, 0.35);
  private readonly windNow = new THREE.Vector3();

  private async buildVanguard(V: typeof HostVanguard, n: number, o: PhilistineHostOptions) {
    // the lens of P6 when the crane starts: the vanguard are the men of the main column nearest it
    const c = o.coast;
    let lens = o.lens ?? null;
    if (!lens && c) {
      const T = FILM_CAM.threat;
      const hd = new THREE.Vector3().subVectors(this.trail![0], this.trail![1]).setY(0).normalize();
      lens = c.columnHead.clone().addScaledVector(hd, T.ahead0 - 1.2 * 2.4).addScaledVector(new THREE.Vector3(-hd.z, 0, hd.x), T.side0);
    }
    if (!lens) return;
    const cand = this.men.filter((m) => m.col === 0 && m.rank < 4);
    const d = (m: Man) => Math.hypot(m.ag.pos.x - lens!.x, m.ag.pos.z - lens!.z);
    // nearest first, whole ranks preferred (a rank half actors, half crowd figures would show the seam)
    cand.sort((a, b) => a.rank - b.rank || d(a) - d(b));
    const pick = cand.slice(0, n);
    const slots: VanguardSlot[] = pick.map((m) => ({ file: m.file, rank: m.rank, elite: m.elite, pace: m.pace, seed: 500 + m.seedI }));
    // the ground under the vanguard's way, sampled once on a local grid (the feet's IK reads it ~10 times a man a frame)
    const g = this.ground;
    const p0 = this.trail![0], p1 = this.trail![1];
    const fwd = new THREE.Vector3().subVectors(p0, p1).setY(0).normalize();
    const cx = p0.x + fwd.x * 8, cz = p0.z + fwd.z * 8;
    const R = 26, S = 0.5, N = Math.round((2 * R) / S) + 1;
    const grid = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) grid[j * N + i] = g(cx - R + i * S, cz - R + j * S);
      if (slice.due()) await slice.pause();
    }
    const local = (x: number, z: number) => {
      const fx = (x - (cx - R)) / S, fz = (z - (cz - R)) / S;
      if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return g(x, z);
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const a = grid[j * N + i], b = grid[j * N + i + 1], cc = grid[(j + 1) * N + i], dd = grid[(j + 1) * N + i + 1];
      return (a * (1 - u) + b * u) * (1 - v) + (cc * (1 - u) + dd * u) * v;
    };
    this.vanguard = await V.create({ tier: o.tier, slots, ground: local, dust: this.dust, parent: this.crowd.group });
    this.vanMen = pick;
    this.vanCues = pick.map((m) => ({ pos: m.ag.pos, yaw: m.ag.yaw, speed: this.speed }));
    for (const m of pick) m.ag.visible = false;
    for (const a of this.vanguard.actors) {
      a.ground = local;
      a.mocap.footIK = { enabled: true, ground: local, maxAdjust: 0.2, align: 0.6 };
    }
  }

  private dropVanguard() {
    this.vanguard?.dispose();
    this.vanguard = null;
    for (const m of this.vanMen) m.ag.visible = true;
    this.vanMen = [];
    this.vanCues = [];
  }

  /** the full actors of the vanguard (empty without) */
  get vanguardActors() {
    return this.vanguard?.actors ?? [];
  }

  /** (tests) the vanguard's numbers: actors, triangles of their meshes, footfalls so far */
  vanguardStats() {
    if (!this.vanguard) return null;
    let tris = 0, meshes = 0;
    const by: Record<string, number> = {};
    for (const a of this.vanguard.actors) {
      a.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible) return;
        meshes++;
        const g = m.geometry;
        const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        tris += n;
        const k = m.name || m.parent?.name || 'mesh';
        by[k] = (by[k] ?? 0) + n;
      });
    }
    const top = Object.entries(by).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}:${Math.round(v / this.vanguard!.actors.length)}`);
    let casters = 0;
    for (const a of this.vanguard.actors) a.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible && o.castShadow) casters++; });
    return { actors: this.vanguard.actors.length, meshes, tris: Math.round(tris), slots: this.vanMen.map((m) => `${m.file}:${m.rank}`), perActor: top, shadowCasters: casters, buildMs: this.vanguard.buildMs, totalMs: this.vanguard.totalMs };
  }

  /** the cut into the shot: the vanguard back on its takes' phases (FilmStage calls setTravel(0) on enter) */
  enter() {
    this.vanguard?.enter();
  }

  private constructor(crowd: Crowd, anim: CrowdAnim, count: number, o: PhilistineHostOptions, owns: boolean, lite: boolean) {
    this.crowd = crowd;
    this.anim = anim;
    this.ownsAnim = owns;
    this.dust = o.dust === false ? null : new CrowdDust({ tier: o.tier, color: 0xc9b38c });
    if (this.dust) crowd.group.add(this.dust.mesh);
    this.origin = (o.origin ?? new THREE.Vector3()).clone();
    this.heading = o.heading ?? Math.PI / 2;
    this.ground = o.ground ?? (() => 0);
    let trail = o.trail;
    let width = o.columnWidth;
    if (o.coast) {
      const c = o.coast;
      trail = [c.columnHead, ...c.route.slice().reverse().filter((p) => p.x < c.columnHead.x)];
      width = c.columnWidth;
    }
    if (trail && trail.length > 1) {
      this.trail = trail.map((p) => p.clone());
      this.cum = [0];
      for (let i = 1; i < this.trail.length; i++) this.cum.push(this.cum[i - 1] + this.trail[i].distanceTo(this.trail[i - 1]));
    }
    const clips = philistineClips(lite).map((c) => `${c.clip}${c.mirror ? ':m' : ''}:c`);
    const kit = (ag: CrowdAgent, h: (s: number) => number, elite: boolean) => {
      let mask = bit('skin', 'hair', 'eye', 'tunic', 'belt', 'scalp', 'spearShaft', 'spearHead');
      mask |= elite ? bit('helmet', 'greaves', 'sword') : bit('crown');
      mask |= h(5) < (elite ? 0.95 : 0.7) ? bit('shieldArm', 'boss') : 0;
      if (!elite && h(6) < 0.25) mask |= bit('sword');
      ag.mask = mask;
      ag.scale = 0.95 + h(7) * 0.1;
      ag.girth = 0.94 + h(8) * 0.12;
      ag.seed = h(9);
      ag.lean = 0.1 + h(10) * 0.25;
      ag.play(clips[Math.floor(h(11) * clips.length)], { fade: 0, time: h(12) * 3, rate: 1 });
    };
    if (this.trail) {
      // COLUMN mode: the main column on the road (half the men), companies of 16 ranks with a gap between them and an
      // elite rank at the head of each (bronze helmets and greaves catch the sun all along the column), flank columns
      // in the fields beside it, starting further back
      const flanks = o.flanks ?? (o.tier === 'desktop-high' ? [-21, -42] : [-22]);
      const cols = [{ lat: 0, files: Math.max(3, Math.round((width ?? 6.3) / 1.1)), start: 0, share: flanks.length ? 0.5 : 1 }];
      flanks.forEach((l, k) => cols.push({ lat: l, files: 8, start: 26 + k * 34, share: 0.5 / flanks.length }));
      let i = 0;
      cols.forEach((c, ci) => {
        const n = ci === cols.length - 1 ? count - i : Math.round(count * c.share);
        for (let k = 0; k < n && i < count; k++, i++) {
          const f = k % c.files, r = Math.floor(k / c.files);
          const comp = Math.floor(r / 16);
          const h = (s: number) => hash(i * 0.713 + s * 13.1, s * 7.7 + ci);
          // m.x is along the marching men's right = -(the land set's `side`), so a flank at + lies on the camera side
          const lat = -c.lat + (f - (c.files - 1) / 2) * 1.1 + (h(1) - 0.5) * 0.45;
          const back = c.start + r * 1.4 + comp * 5.5 + (h(2) - 0.5) * 0.6;
          // (wave 5) the champions of the front rank in bronze helmets and scale (17:5-6), the feathered crowns from the
          // second rank on (Medinet Habu) — before: three helmeted ranks, so no crown was ever near the lens
          const elite = (ci === 0 && r < 1) || r % 16 === 0 || h(4) < 0.06;
          const ag = crowd.agents[i];
          kit(ag, h, elite);
          // the front ranks (the lens' foreground): a wider spread of pace and carry, so no two neighbours step or hold
          // the spear alike
          const front = ci === 0 && r < 8;
          if (front) ag.lean = 0.06 + h(16) * 0.34;
          // (wave 5) the pace spread narrowed (0.97-1.03): over P6's 7 s a front-rank man drifts at most ±0.25 m from
          // his rank — alive, not a rank dissolving
          this.men.push({ ag, x: lat, z: -back, pace: front ? 0.97 + h(13) * 0.06 : 0.97 + h(13) * 0.06, seg: 0, gx: 1e9, gz: 1e9, gy: 0, ph: h(14) * 6.28, hr: 0.2 + h(15) * 0.5, front, lean0: ag.lean, col: ci, file: f, rank: r, elite, seedI: i, speed: 0 });
        }
      });
    } else {
      const files = o.files ?? 24;
      const companies = o.companies ?? Math.max(1, Math.round(Math.sqrt(count / files / 6)));
      for (let i = 0; i < count; i++) {
        const c = i % companies;
        const k = Math.floor(i / companies);
        const f = k % files, r = Math.floor(k / files);
        const h = (s: number) => hash(i * 0.713 + s * 13.1, s * 7.7 + c);
        // companies side by side with gaps, the flanks a little behind (a loose, wide host)
        const lat = (c - (companies - 1) / 2) * (files * 1.15 + 9) + (f - (files - 1) / 2) * 1.15 + (h(1) - 0.5) * 0.5;
        const back = r * 1.45 + Math.abs(c - (companies - 1) / 2) * 6 + (h(2) - 0.5) * 0.6;
        const ag = crowd.agents[i];
        const elite = r < 2 + Math.floor(h(3) * 2) || h(4) < 0.08;
        kit(ag, h, elite);
        this.men.push({ ag, x: lat, z: -back, pace: 0.95 + h(13) * 0.1, seg: 0, gx: 1e9, gz: 1e9, gy: 0, ph: h(14) * 6.28, hr: 0.2 + h(15) * 0.5, front: r < 3, lean0: ag.lean, col: c, file: f, rank: r, elite, seedI: i, speed: 0 });
      }
    }
    this.place();
  }

  private readonly trail: THREE.Vector3[] | null = null;
  private readonly cum: number[] = [];
  private readonly _a = new THREE.Vector3();
  /** point and yaw at distance d along the trail (d < 0: extrapolated ahead of trail[0]) */
  private along(d: number, out: THREE.Vector3, m?: Man) {
    const T = this.trail!, C = this.cum;
    let i = m ? Math.min(m.seg, C.length - 2) : 0;
    while (i > 0 && C[i] > d) i--;
    while (i < C.length - 2 && C[i + 1] < d) i++;
    if (m) m.seg = i;
    const seg = Math.max(1e-6, C[i + 1] - C[i]);
    const u = (d - C[i]) / seg;
    out.copy(T[i]).lerp(T[i + 1], u);
    // the men walk toward trail[0] (the head): facing = from T[i+1] to T[i]
    return Math.atan2(T[i].x - T[i + 1].x, T[i].z - T[i + 1].z);
  }

  /** ground under a man, re-sampled only every 0.3 m of his way (the land set's height function is costly) */
  private groundOf(m: Man, x: number, z: number) {
    if (Math.abs(x - m.gx) + Math.abs(z - m.gz) > 0.3) {
      m.gx = x;
      m.gz = z;
      m.gy = this.ground(x, z);
    }
    return m.gy;
  }

  private place() {
    if (this.trail) {
      let cx = 0, cz = 0;
      for (const m of this.men) {
        const d = -m.z - this.travelled * m.pace;
        const yaw = this.along(d, this._a, m);
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        // nobody walks on rails: a slow weave across the file (a man drifting, closing up, stepping round a stone)
        const wx = m.x + 0.14 * Math.sin(d * 0.21 + m.ph) + 0.06 * Math.sin(d * 0.63 + 2 * m.ph);
        // (wave 5) and he faces the way he walks: the weave turns the body (d falls as he marches), so a drifting man
        // never crabs sideways over the ground
        const dw = -(0.14 * 0.21 * Math.cos(d * 0.21 + m.ph) + 0.06 * 0.63 * Math.cos(d * 0.63 + 2 * m.ph));
        const x = this._a.x + rx * wx, z = this._a.z + rz * wx;
        m.ag.pos.set(x, this.groundOf(m, x, z), z);
        // (the lateral axis (rx, rz) is the men's left: the velocity is forward + dw * left -> yaw + atan(dw))
        m.ag.yaw = yaw + Math.atan(dw);
        m.speed = this.speed * m.pace * Math.hypot(1, dw);
        cx += x;
        cz += z;
      }
      this.center.set(cx / this.men.length, 0, cz / this.men.length);
      return;
    }
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    // local (lat, fwd) -> world; forward = (s, c), right = (c, -s)
    let cx = 0, cz = 0;
    for (const m of this.men) {
      const fwd = m.z + this.travelled * m.pace;
      const x = this.origin.x + c * m.x + s * fwd;
      const z = this.origin.z - s * m.x + c * fwd;
      m.ag.pos.set(x, this.groundOf(m, x, z), z);
      m.ag.yaw = this.heading;
      cx += x;
      cz += z;
    }
    this.center.set(cx / this.men.length, 0, cz / this.men.length);
  }

  /** move the host (keeps the formation); t = 0 -> origin. (wave 5) 0 = the cut into the shot: the vanguard re-enters */
  setTravel(metres: number) {
    this.travelled = metres;
    if (metres === 0) this.enter();
  }

  /** the impostor layer's live stats (null without impostors) */
  get impostors() {
    return this.crowd.meshes.length > 3 ? { drawn: this.crowd.stats.drawn[3] } : null;
  }

  update(dt: number, camera: THREE.Camera) {
    this.travelled += dt * this.speed;
    this.clock += dt;
    // (wave 5) the baked takes cover clip.speed x the rig's leg scale x the man's height scale per cycle: the playback
    // rate matches each man's own ground speed, so the planted feet stay planted (before: up to ±10 % slide)
    const legs = this.anim.legScale;
    for (const m of this.men) {
      const cur = m.ag.cur;
      if (cur) cur.rate = (m.speed || this.speed * m.pace) / Math.max(0.3, cur.clip.speed * legs * m.ag.scale);
      m.ag.stride = this.speed > 0.05 ? 1 : 0;
      // the heads are not locked forward: a glance to the side now and then; the front ranks look about (to a
      // neighbour, across the plain) on their own slow rhythms
      const g = Math.sin(this.clock * m.hr + m.ph);
      m.ag.headYaw = m.front
        ? 0.32 * Math.sin(this.clock * (0.45 + m.hr) + m.ph) * (0.45 + 0.55 * Math.sin(this.clock * 0.31 + 2.1 * m.ph))
        : 0.4 * Math.sign(g) * Math.max(0, Math.abs(g) - 0.6) / 0.4;
      // the carried spear sways with each man's own stride (never a fence of parallel shafts) — (wave 5) on his gait:
      // one forward nod per step, from his take's own phase (two steps a cycle), a little after the heel strike
      const ph = cur ? (cur.t / cur.clip.duration) * Math.PI * 4 : this.clock * 4.6 * m.pace;
      m.ag.lean = m.lean0 + (this.speed > 0.05 ? (m.front ? 0.05 : 0.03) * Math.sin(ph + m.ph) : 0);
    }
    this.place();
    if (this.vanguard) {
      // the actors stand where the host places their men (the crowd figures of those slots are hidden)
      for (let i = 0; i < this.vanMen.length; i++) {
        const m = this.vanMen[i], c = this.vanCues[i];
        c.pos = m.ag.pos;
        c.yaw = m.ag.yaw;
        c.speed = m.speed;
      }
      const gust = 0.75 + 0.25 * Math.sin(this.clock * 0.7) + 0.15 * Math.sin(this.clock * 2.3 + 1.1);
      this.windNow.copy(this.wind).multiplyScalar(gust);
      this.vanguard.update(this.vanCues, dt, camera, this.crowd.viewportHeight, this.windNow);
    }
    this.crowd.update(dt, camera);
    this.dust?.update(dt, this.crowd);
  }

  get group() {
    return this.crowd.group;
  }

  dispose() {
    this.vanguard?.dispose();
    this.vanguard = null;
    this.dust?.dispose();
    this.crowd.dispose();
    if (this.ownsAnim) this.anim.dispose();
  }
}
