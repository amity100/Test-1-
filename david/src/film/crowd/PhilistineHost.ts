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

export function philistineClips(lite: boolean): CrowdClipSpec[] {
  // CMU marches + Rocketbox walks (cut v2): heavier and more varied, no two neighbours alike
  const w = lite ? ['march', 'walk_b', 'walk_n1'] : ['march', 'march_c', 'walk_b', 'walk_d', 'walk_n1', 'walk_n2'];
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
}

function hash(a: number, b: number) {
  const h = Math.sin(a * 12.9898 + b * 78.233 + 0.321) * 43758.5453;
  return h - Math.floor(h);
}

interface Man { ag: CrowdAgent; x: number; z: number; pace: number; seg: number; gx: number; gz: number; gy: number; /** weave + head: phase, rate */ ph: number; hr: number; /** the front ranks of the main column (the large foreground of P4) */ front: boolean; /** the spear's own carry angle */ lean0: number }

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
    const crowd = await Crowd.create({ army: 'philistine', anim, capacity: count, tier: o.tier, castShadow: [true, false, false], impostors: imp, lodCaps: o.lodCaps, lodDistances: o.lodDistances });
    return new PhilistineHost(crowd, anim, count, o, !o.anim, lite);
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
          const elite = (ci === 0 && r < 3) || r % 16 === 0 || h(4) < 0.06;
          const ag = crowd.agents[i];
          kit(ag, h, elite);
          // the front ranks (the lens' foreground): a wider spread of pace and carry, so no two neighbours step or hold
          // the spear alike
          const front = ci === 0 && r < 8;
          if (front) ag.lean = 0.06 + h(16) * 0.34;
          this.men.push({ ag, x: lat, z: -back, pace: front ? 0.95 + h(13) * 0.1 : 0.97 + h(13) * 0.06, seg: 0, gx: 1e9, gz: 1e9, gy: 0, ph: h(14) * 6.28, hr: 0.2 + h(15) * 0.5, front, lean0: ag.lean });
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
        kit(ag, h, r < 2 + Math.floor(h(3) * 2) || h(4) < 0.08);
        this.men.push({ ag, x: lat, z: -back, pace: 0.95 + h(13) * 0.1, seg: 0, gx: 1e9, gz: 1e9, gy: 0, ph: h(14) * 6.28, hr: 0.2 + h(15) * 0.5, front: r < 3, lean0: ag.lean });
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
        const x = this._a.x + rx * wx, z = this._a.z + rz * wx;
        m.ag.pos.set(x, this.groundOf(m, x, z), z);
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
      m.ag.pos.set(x, this.groundOf(m, x, z), z);
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

  /** the impostor layer's live stats (null without impostors) */
  get impostors() {
    return this.crowd.meshes.length > 3 ? { drawn: this.crowd.stats.drawn[3] } : null;
  }

  update(dt: number, camera: THREE.Camera) {
    this.travelled += dt * this.speed;
    this.clock += dt;
    for (const m of this.men) {
      if (m.ag.cur) m.ag.cur.rate = (this.speed / Math.max(0.5, m.ag.cur.clip.speed)) * m.pace;
      m.ag.stride = this.speed > 0.05 ? 1 : 0;
      // the heads are not locked forward: a glance to the side now and then; the front ranks look about (to a
      // neighbour, across the plain) on their own slow rhythms
      const g = Math.sin(this.clock * m.hr + m.ph);
      m.ag.headYaw = m.front
        ? 0.32 * Math.sin(this.clock * (0.45 + m.hr) + m.ph) * (0.45 + 0.55 * Math.sin(this.clock * 0.31 + 2.1 * m.ph))
        : 0.4 * Math.sign(g) * Math.max(0, Math.abs(g) - 0.6) / 0.4;
      // the carried spear sways a little with each man's own stride (never a fence of parallel shafts)
      m.ag.lean = m.lean0 + (this.speed > 0.05 ? (m.front ? 0.06 : 0.035) * Math.sin(this.clock * 4.6 * m.pace + m.ph) : 0);
    }
    this.place();
    this.crowd.update(dt, camera);
    this.dust?.update(dt, this.crowd);
  }

  get group() {
    return this.crowd.group;
  }

  dispose() {
    this.dust?.dispose();
    this.crowd.dispose();
    if (this.ownsAnim) this.anim.dispose();
  }
}
