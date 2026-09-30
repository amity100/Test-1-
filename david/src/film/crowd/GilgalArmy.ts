/*
 * GilgalArmy — Saul's army returning to Gilgal (1 Sam 15:12-13; docs/intro-script.md shots 6-9), driven by the gilgal
 * set's blocking (src/film/gilgal/gilgalBlocking.ts: armyAt / armySlot / timeScale / RAISE_DELAY_PER_RANK) so the
 * column stays in register with the camera shots and the placeholders it replaces.
 *
 * Accuracy (docs/visual-bible.md §3.0, §3.4, §3.16):
 *   - on foot only: no horses, chariots, camels; no banners, standards or drums; no uniforms (every man differs);
 *   - bearded men 20-50 in knee-length tunics of undyed wool (cream, beige, brown, grey), a few with a narrow madder or
 *     ochre stripe, leather belts, sandals or barefoot; head-cloths / headbands; rolled mantles and waterskins;
 *   - kit per 100 men ([DECISION] of the bible): ~45 spears, ~20 slingers, ~15 archers (bow + quiver of reeds), ~10 with
 *     a sword/dagger, ~10 with goads; ~35 carry a round oiled-leather shield (on the arm or slung on the back);
 *     at most one in twenty a leather corselet; NO bronze helmets or scale armour (those are Saul's alone);
 *   - loose column by clans, not Roman ranks: jittered slots, varied pace phase, the back fading into the dust.
 *
 * Beats: 'dustWall' / 'king' march (slow motion in 'king' through timeScale), 'spearRaised' halt + the roar: spears and
 * arms go up in a wave that runs from the king back through the ranks, 'silence' the arms come down at once and the
 * front ranks step aside to open the road for Samuel, heads turning toward him; later shots: standing, idle.
 */
import * as THREE from 'three';
import { armyAt, armySlot, timeScale, RAISE_DELAY_PER_RANK, MARCH_SPEED, type GilgalShotName } from '../gilgal/gilgalBlocking';
import { ARMY, SAMUEL } from '../gilgal/gilgalLayout';
import { Crowd, type CrowdAgent, type CrowdTier } from './Crowd';
import { CrowdAnim, type CrowdClipSpec } from './CrowdAnim';
import { bit } from './crowdShader';

const WALKS = ['march', 'march_c', 'walk_b', 'walk_c', 'walk_d'];
const CHEERS_SPEAR = ['raise_arm_R', 'cheer_reach', 'arms_high'];

/** clips the Israelite army needs (bake once; `lite` for phones: no mirrored takes) */
export function israelClips(lite: boolean): CrowdClipSpec[] {
  const s: CrowdClipSpec[] = [];
  for (const w of lite ? ['march', 'march_c', 'walk_b'] : WALKS) {
    s.push({ clip: w }, { clip: w, carry: true });
    if (!lite) s.push({ clip: w, mirror: true }, { clip: w, mirror: true, carry: true });
  }
  s.push({ clip: 'idle_soldier' }, { clip: 'idle_soldier', carry: true });
  if (!lite) s.push({ clip: 'idle_shift' }, { clip: 'idle_shift', carry: true }, { clip: 'idle_soldier', mirror: true, carry: true });
  for (const c of CHEERS_SPEAR) {
    s.push({ clip: c, peak: 'wrist.R' });
    if (!lite) s.push({ clip: c, peak: 'wrist.R', mirror: true });
  }
  s.push({ clip: 'cheer_arms' });
  return s;
}

type Kit = 'spear' | 'sling' | 'bow' | 'sword' | 'goad';

interface Soldier {
  ag: CrowdAgent;
  file: number;
  rank: number;
  kit: Kit;
  walk: string;
  mirror: boolean;
  carry: boolean;
  phase: number;
  pace: number;
  delay: number;
  state: 'none' | 'march' | 'idle' | 'raise' | 'lower' | 'step';
  raised: boolean;
  last: THREE.Vector3;
  gx: number;
  gz: number;
  gy: number;
}

export interface GilgalArmyOptions {
  tier: CrowdTier;
  /** ground height of the set (GilgalSet.ground.height or similar); default flat 0 */
  ground?: (x: number, z: number) => number;
  /** ranks near enough to be drawn as meshes (default: ARMY.ranks on desktop, fewer on phones) */
  ranks?: number;
  /**
   * the column behind them as skeletal impostors (Crowd LOD3) receding into the dust wall: true (default) = the tier's
   * tail (desktop-high 110 more ranks = 1650 men, desktop-medium 100, mobile-high 60, mobile-low 44), a number = that
   * many extra ranks, false = none.
   */
  impostors?: boolean | number;
  anim?: CrowdAnim;
}

/** what a formation slot does now: a FilmActor standing in for the crowd figure mirrors it */
export interface SlotState {
  file: number;
  rank: number;
  pos: THREE.Vector3;
  yaw: number;
  kit: 'spear' | 'sling' | 'bow' | 'sword' | 'goad';
  /** 'march' | 'idle' | 'raise' | 'lower' | 'step' | 'none' */
  state: string;
  /** baked clip key and its time (s) */
  clip: string;
  time: number;
  headYaw: number;
}

function hash(a: number, b: number) {
  const h = Math.sin(a * 12.9898 + b * 78.233 + 0.123) * 43758.5453;
  return h - Math.floor(h);
}

export class GilgalArmy {
  readonly crowd: Crowd;
  readonly anim: CrowdAnim;
  readonly soldiers: Soldier[] = [];
  readonly ranks: number;
  private readonly ground: (x: number, z: number) => number;
  private readonly ownsAnim: boolean;
  private beat: GilgalShotName | null = null;
  private beatT = 0;
  private raiseT = -1;
  private readonly lite: boolean;
  private readonly tmp = new THREE.Vector3();
  private readonly samuel = SAMUEL.pos.clone();

  static async create(o: GilgalArmyOptions): Promise<GilgalArmy> {
    const lite = o.tier.startsWith('mobile');
    const anim = o.anim ?? (await CrowdAnim.bake(israelClips(lite)));
    const near = o.ranks ?? (o.tier === 'mobile-low' ? 22 : o.tier === 'mobile-high' ? 30 : o.tier === 'desktop-medium' ? ARMY.ranks : Math.round(ARMY.ranks * 1.6));
    const tailDefault = o.tier === 'mobile-low' ? 44 : o.tier === 'mobile-high' ? 60 : o.tier === 'desktop-medium' ? 100 : 110;
    const tail = o.impostors === false ? 0 : typeof o.impostors === 'number' ? o.impostors : tailDefault;
    const ranks = near + tail;
    const crowd = await Crowd.create({ army: 'israel', anim, capacity: ranks * ARMY.files, tier: o.tier, impostors: tail > 0 });
    return new GilgalArmy(crowd, anim, ranks, o, !o.anim, lite);
  }

  /** the impostor layer's live stats (null without impostors) */
  get impostors() {
    return this.crowd.meshes.length > 3 ? { drawn: this.crowd.stats.drawn[3] } : null;
  }

  private slotIndex(file: number, rank: number) {
    return rank * ARMY.files + file;
  }

  /**
   * Hide the crowd figures in these formation slots (a FilmActor stands there instead; see slotState); pass [] to
   * show them all again. Slots: file 0..14 across the road (7 = its centre; 0 = north), rank 0 = first behind the king.
   */
  setActorSlots(slots: { file: number; rank: number }[]) {
    for (const s of this.soldiers) s.ag.visible = true;
    for (const { file, rank } of slots) {
      const s = this.soldiers[this.slotIndex(file, rank)];
      if (s) s.ag.visible = false;
    }
  }

  /** current pose of slot (file, rank) (after setBeat), for the FilmActor that replaces that figure */
  slotState(file: number, rank: number): SlotState | null {
    const s = this.soldiers[this.slotIndex(file, rank)];
    if (!s) return null;
    const c = s.ag.cur;
    return { file, rank, pos: s.ag.pos.clone(), yaw: s.ag.yaw, kit: s.kit, state: s.state, clip: c ? c.clip.clip : '', time: c ? c.t : 0, headYaw: s.ag.headYaw };
  }

  /** the n formation slots nearest to a point (e.g. the camera of shot 9), nearest first */
  nearestSlots(p: THREE.Vector3, n: number) {
    return this.soldiers
      .map((s) => ({ file: s.file, rank: s.rank, dist: Math.hypot(s.ag.pos.x - p.x, s.ag.pos.z - p.z) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, n);
  }

  private constructor(crowd: Crowd, anim: CrowdAnim, ranks: number, o: GilgalArmyOptions, owns: boolean, lite: boolean) {
    this.crowd = crowd;
    this.anim = anim;
    this.ranks = ranks;
    this.ground = o.ground ?? (() => 0);
    this.ownsAnim = owns;
    this.lite = lite;
    const walks = lite ? ['march', 'march_c', 'walk_b'] : WALKS;
    let i = 0;
    for (let r = 0; r < ranks; r++) {
      for (let f = 0; f < ARMY.files; f++, i++) {
        const ag = crowd.agents[i];
        const h = (k: number) => hash(f * 3.1 + k * 17.7, r * 1.7 + k * 5.3);
        // kit ([DECISION] mix of the bible; the king's bodyguard in the first two ranks: spear + shield)
        const u = h(1);
        const kit: Kit = r < 2 ? 'spear' : u < 0.45 ? 'spear' : u < 0.65 ? 'sling' : u < 0.8 ? 'bow' : u < 0.9 ? 'sword' : 'goad';
        let mask = bit('skin', 'hair', 'eye', 'tunic', 'belt', 'scalp', 'beard');
        const hc = h(2);
        if (hc < 0.4) mask |= bit('headcloth');
        else if (hc < 0.65) mask |= bit('headband');
        if (h(3) < 0.72) mask |= bit('sandals');
        if (h(4) < 0.05) mask |= bit('jerkin');
        if (h(5) < 0.4) mask |= bit('bedroll');
        if (h(6) < 0.3) mask |= bit('waterskin');
        if (kit === 'spear' || kit === 'goad') mask |= bit('spearShaft') | (kit === 'spear' ? bit('spearHead') : 0);
        if (kit === 'bow') mask |= bit('bow', 'quiver');
        if (kit === 'sword' || h(7) < 0.12) mask |= bit('dagger');
        const shield = r < 2 || h(8) < 0.35;
        if (shield) mask |= kit === 'spear' && h(9) < 0.6 ? bit('shieldArm', 'boss') : bit('shieldBack', 'bossBack');
        if ((mask & bit('shieldBack')) && (mask & bit('bedroll'))) mask &= ~bit('bedroll');
        if ((mask & bit('shieldBack')) && kit === 'bow') mask &= ~bit('shieldBack', 'bossBack');
        ag.mask = mask;
        // men of 20-50: height 1.60-1.80 (the man preset is 1.70), build
        ag.scale = 0.94 + h(10) * 0.12;
        ag.girth = 0.93 + h(11) * 0.14;
        ag.seed = h(12);
        ag.lean = kit === 'goad' ? 0.9 : 0.12 + h(13) * 0.25;
        const carry = kit === 'spear' || kit === 'goad';
        this.soldiers.push({
          ag, file: f, rank: r, kit, walk: walks[Math.floor(h(14) * walks.length)], mirror: !lite && h(15) < 0.5, carry,
          phase: h(16) * 3, pace: 0.94 + h(17) * 0.12, delay: 0, state: 'none', raised: false, last: new THREE.Vector3(), gx: 1e9, gz: 1e9, gy: 0,
        });
      }
    }
  }

  private key(clip: string, s: Soldier, carry = s.carry, mirror = s.mirror) {
    const k = `${clip}${mirror && !this.lite ? ':m' : ''}${carry ? ':c' : ''}`;
    if (this.anim.has(k)) return k;
    const k2 = `${clip}${carry ? ':c' : ''}`;
    return this.anim.has(k2) ? k2 : clip;
  }

  /**
   * Drive the army from the gilgal blocking. `shot`/`time` exactly as GilgalSet.setBeat; call every frame with the
   * real frame dt before update().
   */
  setBeat(shot: GilgalShotName, time: number) {
    const newBeat = shot !== this.beat || time < this.beatT - 0.05;
    this.beat = shot;
    this.beatT = time;
    const st = armyAt(shot, time);
    if (newBeat) this.raiseT = -1;
    if (st.raise > 0.01 && this.raiseT < 0) this.raiseT = time;
    const pos = this.tmp;
    for (const s of this.soldiers) {
      const ag = s.ag;
      armySlot(s.file, s.rank, st.frontX, st.part, 0.18, pos);
      // the set's ground function is costly (DEM + noise): re-sample it only every 0.3 m of a man's way
      if (Math.abs(pos.x - s.gx) + Math.abs(pos.z - s.gz) > 0.3) {
        s.gx = pos.x;
        s.gz = pos.z;
        s.gy = this.ground(pos.x, pos.z);
      }
      pos.y = s.gy;
      const moved = newBeat ? 0 : Math.hypot(pos.x - s.last.x, pos.z - s.last.z);
      ag.pos.copy(pos);
      s.last.copy(pos);
      const lookSamuel = shot === 'silence' || shot === 'faceOff' || shot === 'tear' || shot === 'verdict' || shot === 'saulAlone';
      // facing: east along the road; the front ranks turn their heads toward Samuel in the silence
      ag.yaw = Math.PI / 2 + (hash(s.file, s.rank) - 0.5) * 0.12;
      if (lookSamuel) {
        const want = Math.atan2(this.samuel.x - pos.x, this.samuel.z - pos.z) - ag.yaw;
        ag.headYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(want), Math.cos(want)), -0.9, 0.9) * (s.rank < 20 ? 1 : 0.5);
      } else ag.headYaw = 0;
      if (st.walk > 0) {
        if (s.state !== 'march' || newBeat) {
          const k = this.key(s.walk, s);
          const clip = this.anim.get(k);
          ag.play(k, { fade: s.state === 'none' || newBeat ? 0 : 0.4, time: s.phase, rate: (st.walk / Math.max(0.5, clip.speed)) * s.pace });
          s.state = 'march';
        }
        continue;
      }
      // halted
      const raiseOn = st.raise > 0.02 && this.raiseT >= 0 && time - this.raiseT > s.rank * RAISE_DELAY_PER_RANK + Math.abs(s.file - (ARMY.files - 1) / 2) * 0.03 + hash(s.file + 9, s.rank) * 0.25;
      if (shot === 'spearRaised' && raiseOn && s.state !== 'raise') {
        let clip: string;
        if (s.kit === 'spear' || s.kit === 'goad') clip = hash(s.file + 3, s.rank + 1) < 0.6 ? 'raise_arm_R' : 'cheer_reach';
        else clip = hash(s.file + 5, s.rank) < 0.5 ? 'cheer_arms' : 'arms_high';
        const pk = clip === 'cheer_arms' ? 'cheer_arms' : `${clip}${s.mirror && !this.lite && clip !== 'raise_arm_R' ? ':m' : ''}:p`;
        ag.play(this.anim.has(pk) ? pk : clip === 'cheer_arms' ? 'cheer_arms' : `${clip}:p`, { fade: 0.25, rate: 1.1 + hash(s.file, s.rank + 7) * 0.3 });
        s.state = 'raise';
        continue;
      }
      if (shot === 'silence' && s.state === 'raise' && st.raise < 0.97) {
        ag.play(this.key('idle_soldier', s), { fade: 0.9 + hash(s.file, s.rank + 2) * 0.5, time: s.phase });
        s.state = 'idle';
        continue;
      }
      if (shot === 'silence' && moved > 0.004 && s.state !== 'step') {
        ag.play(this.key('walk_c', s), { fade: 0.35, time: s.phase, rate: 0.8 });
        s.state = 'step';
        continue;
      }
      if (s.state === 'step' && moved < 0.002) {
        ag.play(this.key('idle_soldier', s), { fade: 0.5, time: s.phase });
        s.state = 'idle';
        continue;
      }
      if (s.state === 'none' || s.state === 'march' || (s.state === 'raise' && shot !== 'spearRaised' && shot !== 'silence')) {
        const idle = !this.lite && hash(s.file, s.rank + 11) < 0.5 ? 'idle_shift' : 'idle_soldier';
        ag.play(this.key(idle, s, s.carry, false), { fade: s.state === 'none' || newBeat ? 0 : 0.6, time: s.phase * 1.7 });
        s.state = 'idle';
      }
    }
  }

  /** per frame after setBeat: advances the clocks by dt × the shot's slow-motion factor */
  update(dt: number, camera: THREE.Camera) {
    const ts = this.beat ? timeScale(this.beat, this.beatT) : 1;
    this.crowd.update(dt * ts, camera);
  }

  get group() {
    return this.crowd.group;
  }

  dispose() {
    this.crowd.dispose();
    if (this.ownsAnim) this.anim.dispose();
  }
}

export { MARCH_SPEED };
