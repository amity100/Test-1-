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
import { armyAt, armySlot, samuelAt, timeScale, BEATS, MARCH_SPEED, type GilgalShotName } from '../gilgal/gilgalBlocking';
import { ARMY, SAMUEL, roadZ } from '../gilgal/gilgalLayout';
import { Crowd, type CrowdAgent, type CrowdTier } from './Crowd';
import { CrowdAnim, type CrowdClipSpec } from './CrowdAnim';
import { CrowdDust } from './CrowdDust';
import { SpoilHerd } from './SpoilHerd';
import { bit } from './crowdShader';
import { ArmyHeroes, type HeroCue } from './ArmyHeroes';
import { gilgalCam, takeBeat, takeDur, TAKE_OFFSET } from '../FilmCams';
import type { ShotFrame } from '../../gameplay/CameraRig';

/** CUT v6.1 G3 `notice`: the nearest men's heads begin to turn toward the road (shot seconds; the contract's beat) */
const NOTICE = takeBeat('spearRaised', 'notice', 4.5);
/**
 * CUT v6.1 G1 `wipe` (shot seconds): the cut G1 -> G2 hides in a man of the front rank passing close across the lens.
 * cut7's lens (w6_notes 14:20) stands still beside the column's southern flank from ~2.4 s and pans to look north across
 * the march: the front rank's southern file walks across the frame 0.6-0.7 m in front of it at the march's own pace —
 * he enters at `wipe`, crosses the optical axis at ~3.75 s and fills the frame at the cut. WIPE_RANGE: the distances
 * from the lens (m) at which that man's own line makes a wipe (nearer: into the lens; further: no wipe)
 */
const WIPE = takeBeat('dustWall', 'wipe', 3.6);
const WIPE_RANGE: [number, number] = [0.35, 1.3];

/**
 * marching takes (CMU + Rocketbox): every man draws his own and his own phase — never in lockstep.
 * (host1, wave 6 — "every motion super natural": natural walks only, their natural speeds near the march's 1.35 m/s:
 *  walk 1.32, walk_b 1.19, walk_cool 1.14, walk_n1 1.11, walk_n2 1.46, walk_cool_b 1.46. Out: the captured 'march' and
 *  'march_c' are parade high-kicks (foot lift 0.36 / 0.88 m, thigh swing 62° / 77°, measured on the host1 bench), walk_d
 *  1.54 and walk_c 0.97 m/s would be time-warped to a floating 0.84x / a hurried 1.34x)
 */
const WALKS = ['walk_b', 'walk_n1', 'walk_cool', 'walk', 'walk_n2', 'walk_cool_b'];
const WALKS_LITE = ['walk_b', 'walk_n1', 'walk'];
/** standing takes (weight shifts, breath) */
const IDLES = ['idle_soldier', 'idle_shift', 'idle_n1', 'idle_n2'];
const IDLES_LITE = ['idle_soldier', 'idle_n1'];
/** THE ROAR (G3): Rocketbox cheers (m_cheer_01..05) + the CMU arm raises held at their peak */
const CHEERS = ['cheer_1', 'cheer_2', 'cheer_3', 'cheer_4', 'cheer_5'];
const PEAKS = ['raise_arm_R', 'cheer_reach', 'arms_high'];

/** every mocap clip the army and its hero soldiers may play (release them after the film) */
export const ARMY_CLIPS = [...new Set([...WALKS, ...IDLES, ...CHEERS, ...PEAKS, 'cheer_arms', 'look_around_L', 'look_around_R'])];

/** clips the Israelite army needs (bake once; `lite` for phones: fewer takes, no mirrored ones) */
export function israelClips(lite: boolean): CrowdClipSpec[] {
  const s: CrowdClipSpec[] = [];
  // (wave 6) the spear / goad carried at the side ('side': the fist at the hip, the shaft beside the shoulder and never
  // across the face; the shield arm half-damped by its weight) — as P6's Philistines
  for (const w of lite ? WALKS_LITE : WALKS) {
    s.push({ clip: w }, { clip: w, carry: 'side' });
    if (!lite) s.push({ clip: w, mirror: true }, { clip: w, mirror: true, carry: 'side' });
  }
  for (const w of lite ? IDLES_LITE : IDLES) {
    s.push({ clip: w }, { clip: w, carry: 'side' });
    if (!lite) s.push({ clip: w, mirror: true, carry: 'side' });
  }
  for (const c of CHEERS) {
    s.push({ clip: c });
    if (!lite) s.push({ clip: c, mirror: true });
  }
  for (const c of PEAKS) {
    s.push({ clip: c, peak: 'wrist.R' });
    if (!lite) s.push({ clip: c, peak: 'wrist.R', mirror: true });
  }
  s.push({ clip: 'cheer_arms' });
  // the silence (G4): men turn their whole body to look down the road
  s.push({ clip: 'look_around_L' }, { clip: 'look_around_R' });
  return s;
}

type Kit = 'spear' | 'sling' | 'bow' | 'sword' | 'goad';

interface Soldier {
  ag: CrowdAgent;
  file: number;
  rank: number;
  kit: Kit;
  walk: string;
  idle: string;
  cheer: string;
  mirror: boolean;
  carry: boolean;
  phase: number;
  pace: number;
  /** per-man random numbers (fixed): timing jitter, choices */
  r: number[];
  state: 'none' | 'march' | 'halt' | 'roar' | 'freeze' | 'lower' | 'look' | 'step' | 'idle';
  /** CUT v3: how many cheer takes the man has chained in this roar (the roar is held to the cut) */
  chain: number;
  last: THREE.Vector3;
  yaw: number;
  gx: number;
  gz: number;
  gy: number;
  /** (wave 6) ground speed of the last setBeat (m/s of action time): the hero standing in for him matches his take to it */
  speed: number;
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
  /** footstep dust puffs (CrowdDust); default true */
  dust?: boolean;
  /** the spoil herds beside the column (SpoilHerd, visual bible 3.5); default true */
  herds?: boolean;
  /** override the tier's mesh LOD caps (nearest first; the overflow falls to the next LOD / the impostors) */
  lodCaps?: [number, number, number];
  anim?: CrowdAnim;
  /**
   * full FilmActor soldiers standing in for the crowd figures nearest the lens (ArmyHeroes: the rams'-horn blowers of
   * G1 + near spear-men): false = none; default by tier (ArmyHeroes.HERO_COUNT)
   */
  heroes?: boolean | { horns: number; near: number };
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

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function hash(a: number, b: number) {
  const h = Math.sin(a * 12.9898 + b * 78.233 + 0.123) * 43758.5453;
  return h - Math.floor(h);
}

export class GilgalArmy {
  readonly crowd: Crowd;
  readonly anim: CrowdAnim;
  readonly soldiers: Soldier[] = [];
  readonly ranks: number;
  /** footstep dust (null if disabled) */
  readonly dust: CrowdDust | null;
  /** the driven flocks and herds (null if disabled) */
  readonly herd: SpoilHerd | null;
  private front = { x: 0, walk: false };
  readonly ground: (x: number, z: number) => number;
  private readonly ownsAnim: boolean;
  private beat: GilgalShotName | null = null;
  private beatT = 0;
  private lastDt = 1 / 30;
  private readonly lite: boolean;
  private readonly tmp = new THREE.Vector3();
  private readonly samuel = SAMUEL.pos.clone();
  /** (wave 6) the G1 wipe: the man (kept on his own line: no weave), his distance from the lens at the beat */
  private wipe: { s: Soldier; dist: number; ok: boolean } | null = null;
  private readonly wipeFrame: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };

  /**
   * (wave 6) plan the G1 wipe on entering G1: where cut7's lens (FilmCams.gilgalCam 'dustWall') stands at the cut and
   * the front-rank man whose own line passes nearest in front of it. He keeps that line (no weave), is played by a full
   * actor (castHeroes) and looks down the road; outside WIPE_RANGE there is no wipe.
   */
  private planWipe() {
    const off = TAKE_OFFSET.dustWall ?? 0;
    const dur = takeDur('dustWall', 4);
    const F = this.wipeFrame;
    // the lens at the cut (it stands still from ~2.4 s in cut7's G1): the man must pass in front of it
    const tc = off + dur;
    if (!gilgalCam('dustWall', 1, tc, this.ground, F)) {
      this.wipe = null;
      return;
    }
    const st = armyAt('dustWall', tc);
    // the front-rank man whose line (his file's lateral place) passes nearest in front of the lens
    let best: Soldier | null = null, bd = 1e9;
    const v = new THREE.Vector3();
    for (const s of this.soldiers) {
      if (s.rank !== 0) continue;
      armySlot(s.file, s.rank, st.frontX, 0, 0.18, v);
      const d = Math.abs(v.z - F.pos.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    this.wipe = best ? { s: best, dist: bd, ok: bd >= WIPE_RANGE[0] && bd <= WIPE_RANGE[1] } : null;
    if (this.wipe && !this.wipe.ok) console.info(`[army] G1 wipe: the front rank passes ${bd.toFixed(2)} m from the lens — outside ${WIPE_RANGE.join('-')} m`);
  }

  /** (tests) the G1 wipe as planned */
  get wipeInfo() {
    const w = this.wipe;
    return w ? { file: w.s.file, rank: w.s.rank, dist: +w.dist.toFixed(2), ok: w.ok } : null;
  }

  static async create(o: GilgalArmyOptions): Promise<GilgalArmy> {
    const lite = o.tier.startsWith('mobile');
    const anim = o.anim ?? (await CrowdAnim.bake(israelClips(lite)));
    const near = o.ranks ?? (o.tier === 'mobile-low' ? 22 : o.tier === 'mobile-high' ? 30 : o.tier === 'desktop-medium' ? ARMY.ranks : Math.round(ARMY.ranks * 1.6));
    const tailDefault = o.tier === 'mobile-low' ? 44 : o.tier === 'mobile-high' ? 60 : o.tier === 'desktop-medium' ? 100 : 110;
    const tail = o.impostors === false ? 0 : typeof o.impostors === 'number' ? o.impostors : tailDefault;
    const ranks = near + tail;
    const crowd = await Crowd.create({ army: 'israel', anim, capacity: ranks * ARMY.files, tier: o.tier, impostors: tail > 0, lodCaps: o.lodCaps });
    const army = new GilgalArmy(crowd, anim, ranks, o, !o.anim, lite);
    if (o.heroes !== false) {
      try {
        const h = typeof o.heroes === 'object' ? o.heroes : {};
        army.heroes = await ArmyHeroes.create({ tier: o.tier, ground: army.ground, ...h });
        army.heroes.addTo(army.group);
        for (const hero of army.heroes.heroes) hero.dust = army.dust;
      } catch (e) {
        console.warn('[army] hero soldiers unavailable', e);
        army.heroes = null;
      }
    }
    // test only (?test=1): the capture tools read wipeInfo / heroAt
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1') (window as unknown as Record<string, unknown>).__gilgalArmy = army;
    return army;
  }

  private lastCam: THREE.Camera | null = null;

  /** (tests) where each hero soldier stands now (world), its cast slot, and its distance from the last lens */
  heroAt() {
    const from = this.lastCam ? this.lastCam.getWorldPosition(new THREE.Vector3()) : null;
    return (this.heroes?.heroes ?? []).map((h, i) => {
      const p = h.actor.root.getWorldPosition(this.tmp);
      const s = this.soldiers[this.heroSlot[i] ?? -1];
      const d = from ? Math.hypot(p.x - from.x, p.z - from.z) : 0;
      return { i, slot: s ? `${s.file}/${s.rank}` : '-', x: +p.x.toFixed(2), z: +p.z.toFixed(2), d: +d.toFixed(2), vis: h.actor.root.visible };
    });
  }

  /** the FilmActor soldiers near the lens (null = none) */
  heroes: ArmyHeroes | null = null;
  /** per hero: the soldier index it stands in for this beat (-1 = none) */
  private heroSlot: number[] = [];
  private heroBeat: string | null = null;
  private heroFrames = 0;
  private readonly heroCues: HeroCue[] = [];
  private readonly samEyes = SAMUEL.pos.clone().setY(1.55);
  private readonly wind = new THREE.Vector3(1.4, 0, 0.3);
  private windClock = 0;

  /**
   * Recommended FilmActor stand-ins per shot (the crowd figures nearest the lens that are in frame): shot 9 opens with
   * the camera inside the column at rank 6 (the two slots within 0.9 m of the lens are hidden automatically); ranks 4-5
   * of the centre files fill the foreground at 1.7-4 m. Shots 6-8 need none (the nearest figures are >= 10 m away).
   */
  static readonly HERO_SLOTS: Partial<Record<GilgalShotName, { file: number; rank: number }[]>> = {
    silence: [{ file: 7, rank: 5 }, { file: 8, rank: 5 }, { file: 6, rank: 5 }, { file: 9, rank: 4 }],
  };

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

  /**
   * the n formation slots nearest to a point (e.g. the camera of shot 9) at a beat of the blocking (default: the
   * current one), nearest first. Use it to choose which crowd figures FilmActors replace (setActorSlots).
   */
  nearestSlots(p: THREE.Vector3, n: number, shot: GilgalShotName = this.beat ?? 'silence', time = this.beatT) {
    const st = armyAt(shot, time);
    const v = new THREE.Vector3();
    return this.soldiers
      .map((s) => {
        armySlot(s.file, s.rank, st.frontX, st.part, 0.18, v);
        return { file: s.file, rank: s.rank, dist: Math.hypot(v.x - p.x, v.z - p.z) };
      })
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
    this.dust = o.dust === false ? null : new CrowdDust({ tier: o.tier });
    if (this.dust) crowd.group.add(this.dust.mesh);
    this.herd = o.herds === false ? null : new SpoilHerd({ tier: o.tier, ground: this.ground });
    if (this.herd) crowd.group.add(this.herd.group);
    const walks = lite ? WALKS_LITE : WALKS;
    const idles = lite ? IDLES_LITE : IDLES;
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
        // the roar: every man his own take (spear-men mostly the right-arm raises, so the spear goes up)
        const ch = h(18);
        const cheer = carry
          ? (ch < 0.5 ? CHEERS[Math.floor(h(19) * 5)] : ch < 0.8 ? `${PEAKS[Math.floor(h(19) * 3)]}:p` : 'cheer_2')
          : (ch < 0.75 ? CHEERS[Math.floor(h(19) * 5)] : ch < 0.9 ? 'cheer_arms' : `${PEAKS[Math.floor(h(19) * 3)]}:p`);
        this.soldiers.push({
          ag, file: f, rank: r, kit, walk: walks[Math.floor(h(14) * walks.length)], idle: idles[Math.floor(h(20) * idles.length)], cheer,
          mirror: !lite && h(15) < 0.5, carry, phase: h(16) * 3, pace: 0.94 + h(17) * 0.12,
          r: [h(21), h(22), h(23), h(24), h(25), h(26)], state: 'none', chain: 0, last: new THREE.Vector3(), yaw: Math.PI / 2, gx: 1e9, gz: 1e9, gy: 0, speed: 0,
        });
      }
    }
  }

  private key(clip: string, s: Soldier, carry = s.carry, mirror = s.mirror) {
    const m = mirror && !this.lite ? ':m' : '';
    const k = `${clip}${m}${carry ? ':c' : ''}`;
    if (this.anim.has(k)) return k;
    const k2 = `${clip}${carry ? ':c' : ''}`;
    if (this.anim.has(k2)) return k2;
    const k3 = `${clip}${m}`;
    return this.anim.has(k3) ? k3 : clip;
  }

  /** the soldier's roar take (a peak key 'x:p' keeps its mirror before the ':p') */
  private cheerKey(s: Soldier) {
    if (s.cheer.endsWith(':p')) {
      const base = s.cheer.slice(0, -2);
      const km = `${base}:m:p`;
      if (s.mirror && !this.lite && base !== 'raise_arm_R' && this.anim.has(km)) return km;
      return this.anim.has(s.cheer) ? s.cheer : 'cheer_arms';
    }
    // spear-men do not mirror (their spear is in the right hand)
    return this.key(s.cheer, s, false, s.mirror && !s.carry);
  }

  /**
   * Drive the army from the gilgal blocking. `shot`/`time` exactly as GilgalSet.setBeat; call every frame with the
   * real frame dt before update(). The beats come from the timing contract (gilgalBlocking BEATS):
   *   G1-G2  the march: every man his own take, phase and pace, the head looking about now and then;
   *   G3     the halt ripples back from the king (the front ranks stop first), then THE ROAR: every man his own cheer
   *          take (Rocketbox m_cheer_01..05 / the CMU arm raises), started 0-roarSpread s after the beat (the front
   *          and the centre first), some turned to shout at a neighbour;
   *   G4     the roar cuts: the men freeze in their pose, then their heads turn down the road, the arms come down, some
   *          turn the whole body to look; the front ranks STEP aside (they turn into the step, walk, turn back);
   *   later  they stand, weight shifting, heads toward the two men.
   */
  setBeat(shot: GilgalShotName, time: number) {
    const newBeat = shot !== this.beat || time < this.beatT - 0.05;
    const prevBeat = this.beat;
    this.beat = shot;
    this.beatT = time;
    const st = armyAt(shot, time);
    if (newBeat && shot === 'dustWall') this.planWipe();
    // where the old man stands in this shot (heads and the heroes' eyes turn to him; G4 has its own mark, cut4 v6)
    const sp = samuelAt(shot, time).pos;
    this.samuel.copy(sp);
    this.samEyes.set(sp.x, this.ground(sp.x, sp.z) + 1.55, sp.z);
    this.front.x = st.frontX;
    this.front.walk = st.walk > 0.2;
    const pos = this.tmp;
    const midFile = (ARMY.files - 1) / 2;
    const legs = this.anim.legScale;
    // (wave 6) the walk's cadence matches each man's own ground speed: rate = speed / (take speed x leg scale x height)
    const rateFor = (ag: CrowdAgent, v: number) => (ag.cur ? v / Math.max(0.3, ag.cur.clip.speed * legs * ag.scale) : 1);
    for (const s of this.soldiers) {
      const ag = s.ag;
      const [r0, r1, r2, r3, r4] = s.r;
      armySlot(s.file, s.rank, st.frontX, st.part, 0.18, pos);
      // the halt of G3: the column still rolling in onto its marks (decelerating), the halt rippling back
      // (wave 6: ~1 s from the front rank to the 30th, every man his own jitter — never a halt in unison)
      let haltT = 0, v = st.walk;
      if (shot === 'spearRaised') {
        const B = BEATS.spearRaised;
        haltT = B.halt + 0.12 + s.rank * 0.035 + r0 * 0.3;
        const u = Math.min(1, time / haltT);
        pos.x -= MARCH_SPEED * haltT * 0.5 * (1 - u) * (1 - u);
        v = MARCH_SPEED * (1 - u);
      }
      // (wave 6) nobody walks on rails: a slow weave across the file, a function of the man's place on the road (the
      // same in every shot, so the halt and the silence keep each man where the march left him); the files beside G4's
      // lens lane barely weave
      const wiper = this.wipe?.ok === true && this.wipe.s === s && (shot === 'dustWall' || shot === 'king');
      const wa = wiper ? 0 : s.file >= 7 && s.file <= 10 ? 0.35 : 1;
      const wph = r4 * 6.28, wph2 = r3 * 6.28;
      pos.z += wa * (0.12 * Math.sin(pos.x * 0.21 + wph) + 0.05 * Math.sin(pos.x * 0.63 + wph2));
      const wslope = wa * (0.12 * 0.21 * Math.cos(pos.x * 0.21 + wph) + 0.05 * 0.63 * Math.cos(pos.x * 0.63 + wph2));
      // the set's ground function is costly (DEM + noise): re-sample it only every 0.3 m of a man's way
      if (Math.abs(pos.x - s.gx) + Math.abs(pos.z - s.gz) > 0.3) {
        s.gx = pos.x;
        s.gz = pos.z;
        s.gy = this.ground(pos.x, pos.z);
      }
      pos.y = s.gy;
      const dx = newBeat ? 0 : pos.x - s.last.x;
      const dz = newBeat ? 0 : pos.z - s.last.z;
      const moved = Math.hypot(dx, dz);
      ag.pos.copy(pos);
      s.last.copy(pos);
      const face = Math.PI / 2 + (r4 - 0.5) * 0.12;
      // marching east (+x): drifting south (+z) turns him to his right (yaw down)
      const faceWalk = face - Math.atan(wslope);
      if (newBeat) s.yaw = face;
      const toSam = Math.atan2(this.samuel.x - pos.x, this.samuel.z - pos.z);
      const headToSam = THREE.MathUtils.clamp(wrap(toSam - s.yaw), -1.1, 1.1) * (s.rank < 24 ? 1 : 0.6);
      ag.stride = st.walk > 0.2 ? 1 : s.state === 'step' ? 0.6 : 0;
      s.speed = 0;
      // ---------------------------------------------------------------- G1-G2: the march
      if (shot === 'dustWall' || shot === 'king') {
        if (s.state !== 'march' || newBeat) {
          ag.play(this.key(s.walk, s), { fade: 0, time: s.phase, rate: 1 });
          s.state = 'march';
        }
        if (ag.cur) ag.cur.rate = rateFor(ag, st.walk);
        s.speed = st.walk;
        // the head looks about (to a neighbour, the road, the dust) now and then — the man of the wipe keeps his eyes on
        // the road as he passes the lens (never a look into it)
        ag.headYaw = wiper && time > (TAKE_OFFSET.dustWall ?? 0) + 2.4 ? 0.04 : 0.35 * Math.sin(time * (0.35 + 0.3 * r1) + r2 * 6.28) * (r3 < 0.45 ? 1 : 0.25);
        s.yaw = faceWalk;
        ag.yaw = s.yaw;
        continue;
      }
      // ---------------------------------------------------------------- G3: the halt and THE ROAR
      if (shot === 'spearRaised') {
        const B = BEATS.spearRaised;
        if (time < haltT && s.state !== 'halt' && s.state !== 'roar') {
          if (s.state !== 'march' || newBeat) {
            ag.play(this.key(s.walk, s), { fade: 0, time: s.phase + time, rate: 1 });
            s.state = 'march';
          }
          // the cadence follows the slowing step (stride x cadence = speed: the planted foot stays planted) and the
          // walk ends when both feet are down (the blend into the stand then slides least)
          if (ag.cur) ag.cur.rate = Math.max(0.15, rateFor(ag, v));
          ag.stride = v / MARCH_SPEED;
          s.speed = v;
          const c = ag.contactsNow();
          if (v < 0.5 && (c & 3) !== 0 && (c & 12) !== 0) {
            ag.play(this.key(s.idle, s, s.carry, false), { fade: 0.45, time: s.phase * 1.7 });
            s.state = 'halt';
          }
          s.yaw += wrap(faceWalk - s.yaw) * 0.3;
        } else if (s.state === 'march' || s.state === 'none') {
          ag.play(this.key(s.idle, s, s.carry, false), { fade: s.state === 'none' ? 0 : 0.45, time: s.phase * 1.7 });
          s.state = 'halt';
        }
        // the roar runs back from the king: the front and the centre first, the spread of the contract, a jitter; a man
        // still walking in roars once he has stopped
        const roarT = B.roar + Math.min(B.roarSpread, s.rank * 0.009 + Math.abs(s.file - midFile) * 0.012 + r1 * 0.2);
        if (time >= roarT && s.state === 'halt') {
          ag.play(this.cheerKey(s), { fade: 0.22, time: r2 * 0.22, rate: 0.95 + r3 * 0.3 });
          s.state = 'roar';
          s.chain = 0;
        }
        if (s.state === 'roar') this.keepRoaring(s);
        // many shout to their neighbours (the head turned half toward the next file, then back to the front, some of
        // them twice); the others look about as they shout — CUT v3: the roar is 3.3 s long, every head keeps moving
        let shout = 0;
        if (s.state === 'roar') {
          const side = r3 < 0.5 ? -0.6 : 0.6;
          const w1 = ss(roarT + 0.25 + 0.3 * r0, roarT + 0.6 + 0.3 * r0, time) * (1 - ss(roarT + 1.3 + 0.4 * r1, roarT + 1.7 + 0.4 * r1, time));
          const w2 = ss(roarT + 2.0 + 0.3 * r2, roarT + 2.35 + 0.3 * r2, time) * (1 - ss(roarT + 2.9 + 0.3 * r0, roarT + 3.3 + 0.3 * r0, time));
          shout = r4 < 0.4 ? side * (w1 + (r4 < 0.2 ? 0 : -w2)) : r4 < 0.6 ? side * w2 : 0.14 * Math.sin(time * (0.9 + 0.5 * r1) + r2 * 6);
        }
        // (wave 6, CUT v6.1 `notice` 4.5) the men nearest the lens begin to turn their heads to the road — Samuel is
        // coming up it (the reason of the cut to G4): the nearest first, each his own moment
        const near = ag.dist > 0 ? THREE.MathUtils.clamp(1 - (ag.dist - 6) / 22, 0, 1) : s.rank < 8 ? 1 : 0;
        const nT = NOTICE + (1 - near) * 0.35 + r0 * 0.3;
        const noticed = near * ss(nT, nT + 0.45, time);
        ag.headYaw = THREE.MathUtils.lerp(shout + (s.state === 'roar' ? 0 : 0.12 * Math.sin(time * 0.8 + r2 * 6)), headToSam, noticed);
        ag.yaw = s.yaw;
        continue;
      }
      // ---------------------------------------------------------------- G4: the silence
      if (shot === 'silence') {
        const B = BEATS.silence;
        if (newBeat) {
          // the roar is cut: the shout breaks off, the arms begin to sink (coming from G3 the cheer slows into the drop);
          // seeking straight into the shot, they stand in the roar's peak
          if (prevBeat !== 'spearRaised' || s.state !== 'roar') {
            ag.play(this.cheerKey(s), { fade: 0, time: 1.1 + r2 * 0.5, rate: 0.3 });
          } else if (ag.cur) ag.cur.rate = 0.35;
          s.state = 'freeze';
        }
        // (wave 6, CUT v6.1) the arms come down from `roarCut` (each man his own moment and speed, eased), the heads turn
        // from `headsTurn`, the front ranks part from `part`
        const lowerT = B.roarCut + 0.05 + r1 * 0.3 + Math.min(0.3, s.rank * 0.01);
        const turnT = B.headsTurn + Math.min(0.35, s.rank * 0.012) + r0 * 0.25;
        const turned = ss(turnT, turnT + 0.5, time);
        ag.headYaw = headToSam * turned;
        if (s.state === 'freeze' && time >= lowerT) {
          if (s.rank >= 2 && r2 < 0.28 && !this.lite) {
            // a whole-body look down the road (Rocketbox look-around): the body turns, then back
            const side = wrap(toSam - s.yaw) > 0 ? 'look_around_R' : 'look_around_L';
            ag.play(side, { fade: 0.7, time: 0.35, rate: 1.1 });
            s.state = 'look';
          } else {
            ag.play(this.key(s.idle, s, s.carry, false), { fade: 0.55 + r3 * 0.35, time: s.phase * 1.7 });
            s.state = 'lower';
          }
        }
        // the front ranks step aside: they turn into the step, walk, and turn back toward the road
        const vStep = moved / Math.max(1e-3, this.lastDt);
        if (moved > 0.002 && s.state !== 'step' && time > B.part - 0.05) {
          ag.play(this.key(this.lite ? 'walk_b' : 'walk_n1', s), { fade: 0.3, time: s.phase, rate: 1 });
          s.state = 'step';
        }
        if (s.state === 'step') {
          if (ag.cur) ag.cur.rate = THREE.MathUtils.clamp(rateFor(ag, vStep), 0.25, 1.4);
          s.speed = vStep;
          const dir = Math.atan2(dx, dz);
          const k = THREE.MathUtils.clamp(vStep / 0.6, 0, 1);
          // the whole body turns into the step (no crabbing sideways), back toward the road as it ends
          s.yaw += wrap(face + wrap(dir - face) * k - s.yaw) * 0.22;
          ag.headYaw = headToSam * 0.6;
          if (moved < 0.0015) {
            ag.play(this.key(s.idle, s, s.carry, false), { fade: 0.5, time: s.phase * 1.7 });
            s.state = 'idle';
          }
        } else s.yaw += wrap(face - s.yaw) * 0.08;
        ag.yaw = s.yaw;
        continue;
      }
      // ---------------------------------------------------------------- later: standing, watching
      if (newBeat || s.state === 'none' || s.state === 'march' || s.state === 'roar' || s.state === 'freeze') {
        ag.play(this.key(s.idle, s, s.carry, false), { fade: newBeat ? 0 : 0.6, time: s.phase * 1.7 + r0 * 2 });
        s.state = 'idle';
      }
      s.yaw = face;
      ag.yaw = face;
      ag.headYaw = headToSam * (0.8 + 0.2 * Math.sin(time * 0.4 + r2 * 6));
    }
    this.fillHeroCues(shot, time);
  }

  /**
   * CUT v3: the roar is held for 3.3 s to the cut (G3) — no man may end on a held last frame: a cheer take that runs out
   * hands over to his next take (another cheer, the other side), and a raised spear held at its peak (the ':p' takes)
   * is pumped — back down the raise and up again, each man his own beat — so spears and fists keep going up and down.
   */
  private keepRoaring(s: Soldier) {
    const ag = s.ag;
    const c = ag.cur;
    if (!c) return;
    if (c.clip.key.endsWith(':p')) {
      const top = c.clip.duration - 1 / c.clip.fps;
      const depth = 0.3 + 0.3 * s.r[5];
      if (c.rate > 0 && c.t >= top) c.rate = -(0.55 + 0.4 * s.r[3]);
      else if (c.rate < 0 && c.t <= top - depth) c.rate = 0.8 + 0.45 * s.r[2];
      return;
    }
    if (ag.remaining() < 0.3) {
      s.chain++;
      const i = CHEERS.indexOf(s.cheer);
      const next = CHEERS[(Math.max(0, i) + 1 + Math.floor(s.r[5] * 3) + s.chain) % CHEERS.length];
      // spear-men do not mirror (the spear stays in the right hand); the others alternate sides
      const mirror = !s.carry && (s.mirror !== (s.chain % 2 === 1));
      ag.play(this.key(next, s, false, mirror), { fade: 0.35, time: 0.2 + s.r[4] * 0.45, rate: 0.95 + s.r[3] * 0.25 });
    }
  }

  /** the heroes mirror their slots' soldiers (see ArmyHeroes) */
  private fillHeroCues(shot: GilgalShotName, time: number) {
    const H = this.heroes;
    if (!H) return;
    const B = BEATS.spearRaised;
    H.heroes.forEach((h, i) => {
      const si = this.heroSlot[i] ?? -1;
      const s = si >= 0 ? this.soldiers[si] : null;
      if (!s) {
        h.cue = null;
        return;
      }
      let c = this.heroCues[i];
      if (!c) c = this.heroCues[i] = { file: 0, rank: 0, pos: new THREE.Vector3(), yaw: 0, headYaw: 0, state: '', walk: '', idle: '', cheer: '', mirror: false, phase: 0, pace: 1, roarT: -1, speed: 0 };
      c.file = s.file;
      c.rank = s.rank;
      c.pos.copy(s.ag.pos);
      c.yaw = s.ag.yaw;
      c.headYaw = s.ag.headYaw;
      c.state = s.state;
      c.walk = s.walk;
      c.idle = s.idle;
      // a peak take (held at its top by the crowd bake) is a full cheer on the hero
      c.cheer = s.cheer.endsWith(':p') ? 'cheer_1' : s.cheer;
      c.mirror = s.mirror && !this.lite;
      c.phase = s.phase;
      c.pace = s.pace;
      c.roarT = shot === 'spearRaised' ? B.roar : -1;
      c.speed = s.speed;
      h.cue = c;
      void time;
    });
  }

  /**
   * cast the heroes into the slots nearest the lens that are in view (the horn blowers first into the front rank in
   * G1); the crowd figures of those slots are hidden
   */
  private castHeroes(camera: THREE.Camera) {
    const H = this.heroes;
    if (!H || !this.beat) return;
    camera.getWorldPosition(this.tmp);
    const cam = this.tmp;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    dir.y = 0;
    dir.normalize();
    const cand: { i: number; d: number; rank: number }[] = [];
    this.soldiers.forEach((s, i) => {
      if (s.rank > 30) return;
      const dx = s.ag.pos.x - cam.x, dz = s.ag.pos.z - cam.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.4 || d > 40) return;
      if ((dx * dir.x + dz * dir.z) / d < 0.72) return; // inside a ~45 deg cone
      cand.push({ i, d, rank: s.rank });
    });
    cand.sort((a, b) => a.d - b.d);
    const taken = new Set<number>();
    const slots: { file: number; rank: number }[] = [];
    // (wave 6) G1: the man of the wipe is an actor (a crowd figure that close to the lens would be hidden by nearHide)
    const wipeI = this.beat === 'dustWall' && this.wipe?.ok ? this.soldiers.indexOf(this.wipe.s) : -1;
    let wipeGiven = false;
    // reserved before anyone is cast: the horn blowers (cast first into the nearest front-rank slots) must not take it
    if (wipeI >= 0) taken.add(wipeI);
    this.heroSlot = H.heroes.map((h) => {
      const horn = h.role.kit === 'horn';
      if (wipeI >= 0 && !wipeGiven && !horn) {
        wipeGiven = true;
        const s = this.soldiers[wipeI];
        slots.push({ file: s.file, rank: s.rank });
        return wipeI;
      }
      // G1: the horn blowers in the front rank (the nearest front-rank men in view); else the nearest men
      const pool = horn && this.beat === 'dustWall' ? cand.filter((c) => c.rank <= 1) : cand;
      const pick = pool.find((c) => !taken.has(c.i)) ?? cand.find((c) => !taken.has(c.i));
      if (!pick) return -1;
      taken.add(pick.i);
      const s = this.soldiers[pick.i];
      slots.push({ file: s.file, rank: s.rank });
      return pick.i;
    });
    this.setActorSlots(slots);
  }

  /** per frame after setBeat: advances the clocks by dt × the shot's slow-motion factor */
  update(dt: number, camera: THREE.Camera) {
    const ts = this.beat ? timeScale(this.beat, this.beatT) : 1;
    this.lastDt = dt;
    this.lastCam = camera;
    if (this.heroes && this.beat) {
      // (re)cast on the first frames of a beat (the camera of the new shot is set by then)
      if (this.heroBeat !== this.beat) {
        this.heroBeat = this.beat;
        this.heroFrames = 0;
        for (const hero of this.heroes.heroes) hero.reset();
      }
      if (this.heroFrames++ < 3) {
        this.castHeroes(camera);
        this.fillHeroCues(this.beat, this.beatT);
      }
      this.windClock += dt;
      this.wind.set(1.4, 0, 0.3).multiplyScalar(0.8 + 0.25 * Math.sin(this.windClock * 0.9));
      this.heroes.update(this.beat, this.beatT, dt * ts, camera, this.crowd.viewportHeight, this.wind, this.samEyes);
    }
    this.crowd.update(dt * ts, camera);
    this.dust?.update(dt * ts, this.crowd);
    this.herd?.update(dt * ts, this.front.x, this.front.walk, roadZ);
  }

  get group() {
    return this.crowd.group;
  }

  dispose() {
    this.heroes?.dispose();
    this.herd?.dispose();
    this.dust?.dispose();
    this.crowd.dispose();
    if (this.ownsAnim) this.anim.dispose();
  }
}

export { MARCH_SPEED };
