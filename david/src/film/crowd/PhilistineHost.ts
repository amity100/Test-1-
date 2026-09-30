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
import { bit } from './crowdShader';

export function philistineClips(lite: boolean): CrowdClipSpec[] {
  const w = lite ? ['march', 'walk_b'] : ['march', 'march_c', 'walk_b', 'walk_d'];
  const s: CrowdClipSpec[] = [];
  for (const c of w) {
    s.push({ clip: c, carry: true });
    if (!lite) s.push({ clip: c, carry: true, mirror: true });
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
}

function hash(a: number, b: number) {
  const h = Math.sin(a * 12.9898 + b * 78.233 + 0.321) * 43758.5453;
  return h - Math.floor(h);
}

interface Man { ag: CrowdAgent; x: number; z: number; pace: number }

export class PhilistineHost {
  readonly crowd: Crowd;
  readonly anim: CrowdAnim;
  readonly center = new THREE.Vector3();
  /** marching speed (m/s); 0 halts (the men keep their pose) */
  speed = 1.2;
  heading: number;
  private readonly origin: THREE.Vector3;
  private readonly men: Man[] = [];
  private readonly ground: (x: number, z: number) => number;
  private readonly ownsAnim: boolean;
  private travelled = 0;

  static async create(o: PhilistineHostOptions): Promise<PhilistineHost> {
    const lite = o.tier.startsWith('mobile');
    const count = o.count ?? (o.tier === 'mobile-low' ? 360 : o.tier === 'mobile-high' ? 500 : o.tier === 'desktop-medium' ? 900 : 1400);
    const anim = o.anim ?? (await CrowdAnim.bake(philistineClips(lite)));
    const crowd = await Crowd.create({ army: 'philistine', anim, capacity: count, tier: o.tier, castShadow: [true, false, false] });
    return new PhilistineHost(crowd, anim, count, o, !o.anim, lite);
  }

  private constructor(crowd: Crowd, anim: CrowdAnim, count: number, o: PhilistineHostOptions, owns: boolean, lite: boolean) {
    this.crowd = crowd;
    this.anim = anim;
    this.ownsAnim = owns;
    this.origin = (o.origin ?? new THREE.Vector3()).clone();
    this.heading = o.heading ?? Math.PI / 2;
    this.ground = o.ground ?? (() => 0);
    if (o.trail && o.trail.length > 1) {
      this.trail = o.trail.map((p) => p.clone());
      this.cum = [0];
      for (let i = 1; i < this.trail.length; i++) this.cum.push(this.cum[i - 1] + this.trail[i].distanceTo(this.trail[i - 1]));
    }
    const files = this.trail ? Math.max(3, Math.round((o.columnWidth ?? 6.3) / 1.1)) : o.files ?? 24;
    const companies = o.companies ?? Math.max(1, Math.round(Math.sqrt(count / files / 6)));
    const perCompany = Math.ceil(count / companies);
    const clips = philistineClips(lite).map((c) => `${c.clip}${c.mirror ? ':m' : ''}:c`);
    for (let i = 0; i < count; i++) {
      const c = i % companies;
      const k = Math.floor(i / companies);
      const f = k % files, r = Math.floor(k / files);
      const h = (s: number) => hash(i * 0.713 + s * 13.1, s * 7.7 + c);
      const ranksPer = Math.ceil(perCompany / files);
      // companies side by side with gaps, the flanks a little behind (a loose, wide host)
      const col = !!this.trail;
      const lat = col ? (f - (files - 1) / 2) * 1.1 + (h(1) - 0.5) * 0.45 : (c - (companies - 1) / 2) * (files * 1.15 + 9) + (f - (files - 1) / 2) * 1.15 + (h(1) - 0.5) * 0.5;
      const back = col ? Math.floor(i / files) * 1.4 + (h(2) - 0.5) * 0.6 : r * 1.45 + Math.abs(c - (companies - 1) / 2) * 6 + (h(2) - 0.5) * 0.6;
      const ag = crowd.agents[i];
      const elite = (this.trail ? Math.floor(i / files) < 3 : r < 2 + Math.floor(h(3) * 2)) || h(4) < 0.08;
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
      this.men.push({ ag, x: lat, z: -back, pace: 0.95 + h(13) * 0.1 });
      void ranksPer;
    }
    this.place();
  }

  private readonly trail: THREE.Vector3[] | null = null;
  private readonly cum: number[] = [];
  private readonly _a = new THREE.Vector3();
  /** point and yaw at distance d along the trail (d < 0: extrapolated ahead of trail[0]) */
  private along(d: number, out: THREE.Vector3) {
    const T = this.trail!, C = this.cum;
    let i = 0;
    while (i < C.length - 2 && C[i + 1] < d) i++;
    const seg = Math.max(1e-6, C[i + 1] - C[i]);
    const u = (d - C[i]) / seg;
    out.copy(T[i]).lerp(T[i + 1], u);
    // the men walk toward trail[0] (the head): facing = from T[i+1] to T[i]
    return Math.atan2(T[i].x - T[i + 1].x, T[i].z - T[i + 1].z);
  }

  private place() {
    if (this.trail) {
      let cx = 0, cz = 0;
      for (const m of this.men) {
        const yaw = this.along(-m.z - this.travelled * m.pace, this._a);
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        const x = this._a.x + rx * m.x, z = this._a.z + rz * m.x;
        m.ag.pos.set(x, this.ground(x, z), z);
        m.ag.yaw = yaw;
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
      m.ag.pos.set(x, this.ground(x, z), z);
      m.ag.yaw = this.heading;
      cx += x;
      cz += z;
    }
    this.center.set(cx / this.men.length, 0, cz / this.men.length);
  }

  /** move the host (keeps the formation); t = 0 -> origin */
  setTravel(metres: number) {
    this.travelled = metres;
  }

  update(dt: number, camera: THREE.Camera) {
    this.travelled += dt * this.speed;
    for (const m of this.men) if (m.ag.cur) m.ag.cur.rate = (this.speed / Math.max(0.5, m.ag.cur.clip.speed)) * m.pace;
    this.place();
    this.crowd.update(dt, camera);
  }

  get group() {
    return this.crowd.group;
  }

  dispose() {
    this.crowd.dispose();
    if (this.ownsAnim) this.anim.dispose();
  }
}
