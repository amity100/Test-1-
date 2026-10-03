import * as THREE from 'three';
import { clamp, damp, angleDiff } from '../core/noise';
import type { Engine } from '../core/Engine';
import type { Input } from '../core/Input';
import type { UI, KeyHint } from '../ui/UI';
import type { CameraRig } from './CameraRig';
import type { Player } from './Player';
import type { BearActor } from './BearActor';
import type { GameAudio } from './GameAudio';
import type { SfxName } from '../audio/AudioEngine';
import { BEAR_MOVES, type BearActionName } from '../characters/BearModel';

/*
 * (bear1, docs/gameplay-v2.md §4) THE FIGHT — "וַיָּקָם עָלַי" … until "וְהֶחֱזַקְתִּי בִּזְקָנוֹ".
 *
 * The bear reads David's distance and chooses among telegraphed moves (BEAR_MOVES): a swat with either forepaw, the
 * bite lunge, the rear-and-slam, a stomping bluff lunge, the huff display at a distance (the sling's moment), real and
 * bluff charges (a bluff brakes short; a charge that runs into a boulder or a trunk crashes and staggers). Each blow is
 * resolved at its strike frame from the geometry (where David is relative to the bear's heading — a sidestep takes him
 * out of a charge's line and of the narrow bite, straight back does not outrun a charge), so dodging is a choice of
 * direction and time, not an invulnerability button.
 *
 * David: the staff's JAB (its end at the face and the nose, from out of reach), the swung STRIKE (the head, when it
 * overreaches), the sling, the sidestep. A blow in the bear's OPEN window (after its move, committed / off balance) is a
 * counter: it weighs much more and staggers it; a blow during its TELL is swatted through (little effect, the move goes
 * on); careless blows up close at neutral times are punished at once. Mashing therefore loses.
 *
 * It tires: fatigue rises with good hits and with time (slower moves, longer open windows, panting). The grip is
 * offered ONLY when it is exhausted and has taken enough counters: its next bite lunge shows the prompt — a timed
 * sidestep-and-seize; the struggle and the finishing blow are Story.clinch.
 */

export interface FightHost {
  engine: Engine;
  ui: UI;
  input: Input;
  audio: GameAudio;
  cam: CameraRig;
  player: Player;
  bear: BearActor;
  slowMo(scale: number): void;
  /** run fn after `seconds` of real time (cancelled on a restart) */
  later(seconds: number, fn: () => void): void;
  /** the HUD's key for the grip (interact) */
  gripKey: KeyHint;
}

export type FightResult = 'grip' | 'knockout';

/** the tuning (one place; the table in the bear1 report comes from bot runs against these) */
export const FIGHT = {
  /** fatigue per unit of hit value, and per second of fighting */
  fatiguePerHit: 0.0056,
  fatiguePerSec: 0.0021,
  /** the grip needs this fatigue AND this many counter hits */
  gripFatigue: 0.68,
  gripCounters: 10,
  /** hit values: [counter (open window), neutral, in its tell (swatted through)] */
  jabHead: [1.0, 0.45, 0.2],
  jabBody: [0.45, 0.2, 0.1],
  strikeHead: [1.6, 0.55, 0.25],
  strikeBody: [0.7, 0.3, 0.15],
  slingHead: [0.9, 0.7, 0.5],
  slingBody: [0.5, 0.35, 0.25],
  /** seconds between the bear's moves: fresh .. exhausted (+ up to `cdRand`) */
  cd0: 1.0,
  cd1: 2.0,
  cdRand: 0.7,
  /** David's body radius for the blows' hit test (m) */
  davidR: 0.36,
  /** charges: start distance band, speed, contact half-width, bluff share (fresh / exhausted) */
  chargeMin: 4.5,
  chargeMax: 10,
  chargeSpeed: 8.5,
  chargeHalfWidth: 0.95,
  bluff0: 0.35,
  bluff1: 0.6,
  /** the grip's window in the bite (clip seconds): the jaws out and snapping shut, the head low and extended */
  gripWin: [0.34, 0.74] as [number, number],
};

type Phase = 'stand' | 'engage' | 'move' | 'recover' | 'charge' | 'brake' | 'crash' | 'retreat' | 'display' | 'done';

interface MoveRun {
  name: BearActionName;
  side: number;
  /** the root's lunge forward during [l0, l1] clip seconds, metres */
  l0: number;
  l1: number;
  lunge: number;
  resolved: boolean;
  /** its opening has begun (one counter in it) */
  opened?: boolean;
  /** the grip was offered in this bite */
  gripOffer: boolean;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _face = new THREE.Vector3();

/**
 * how far a point is from the line the blow sweeps in front of him (his frame: forward, up) — the swung blow comes down
 * from over his shoulder to 1.75 m ahead at knee height and can land with the staff's length; the jab drives its last
 * part level out to 2.15 m. Deterministic (the clip's pose and blending never decide a hit); the tip only places the effect.
 */
export function staffDist(p: Player, _tip: THREE.Vector3, q: THREE.Vector3, kind: 'jab' | 'strike') {
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const a0 = kind === 'jab' ? 0.6 : 0.35, h0 = 1.1;
  const a1 = kind === 'jab' ? 2.15 : 1.75, h1 = kind === 'jab' ? 1.0 : 0.6;
  const dx = q.x - p.pos.x, dz = q.z - p.pos.z;
  const along = dx * fx + dz * fz, lat = dx * fz - dz * fx, up = q.y - p.pos.y;
  const sx = a1 - a0, sy = h1 - h0;
  const u = clamp(((along - a0) * sx + (up - h0) * sy) / (sx * sx + sy * sy), 0, 1);
  return Math.hypot(a0 + sx * u - along, h0 + sy * u - up, lat);
}

export class BearFight {
  fatigue = 0;
  counters = 0;
  /** total hit value landed (for the HUD bar) */
  dealt = 0;
  knockdowns = 0;
  /** seconds fought */
  time = 0;
  result: FightResult | null = null;
  /** the grip is earned: its next bite lunge offers it */
  gripReady = false;
  /** stats for the tuning table */
  readonly stats = { counters: 0, neutral: 0, tellHits: 0, slingHits: 0, misses: 0, knockdowns: 0, moves: {} as Record<string, number>, charges: 0, bluffs: 0, crashes: 0, gripOffers: 0 };

  private phase: Phase = 'stand';
  private pt = 0;
  private cd = 1.2;
  private move: MoveRun | null = null;
  private open = 0; // seconds of open window left (counter hits)
  /** counters still allowed in the current opening (one per opening; two after a crash): mashing earns nothing */
  private winBudget = 0;
  private openFromMove = false;
  private chargeDir = new THREE.Vector3();
  private chargeFrom = new THREE.Vector3();
  private chargeBluff = false;
  private chargeHit = false;
  private chargeStop = 0;
  private lastBearPos = new THREE.Vector3();
  private blockedT = 0;
  private circleDir = 1;
  private retreatTo = new THREE.Vector3();
  private punish = 0;
  private gripPressT = -1;
  private pantT = 0;

  constructor(private h: FightHost, startFatigue = 0) {
    this.fatigue = startFatigue;
  }

  /** the fight begins (the bear has risen against him): the framing, the HUD, the bear's cues */
  start() {
    const { bear, cam, player } = this.h;
    this.phase = 'stand';
    this.pt = 0;
    this.cd = 1.0;
    bear.model.fatigue = this.fatigue;
    bear.model.onCue = (cue, at, s) => this.onCue(cue, at, s);
    bear.model.onStep = (_leg, at, s) => this.sfxAt('bearStep', at, Math.min(1, 0.3 + 0.35 * s), 1.05 - 0.15 * Math.min(1, s));
    cam.combatFocus = bear.pos;
    player.strikeKind = () => this.strikeKind();
    player.strikeAt = () => this.headIfNear();
    this.lastBearPos.copy(bear.pos);
  }

  /** the struggle at the jaw failed: it shook him off — the fight goes on (still exhausted: the next bite offers the grip) */
  resume() {
    const { bear, cam, player } = this.h;
    this.result = null;
    this.move = null;
    bear.model.onCue = (cue, at, s) => this.onCue(cue, at, s);
    cam.combatFocus = bear.pos;
    player.strikeKind = () => this.strikeKind();
    player.strikeAt = () => this.headIfNear();
    this.cd = 1.2;
    this.openWindow(0.6);
    this.setPhase('recover');
  }

  /** 0..1: how far it is from being taken (fatigue and counters) */
  get progress() {
    return 0.65 * clamp(this.fatigue / FIGHT.gripFatigue, 0, 1) + 0.35 * clamp(this.counters / FIGHT.gripCounters, 0, 1);
  }

  /** for tests and the HUD */
  get state() {
    return { phase: this.phase, open: this.open, move: this.move?.name ?? null, fatigue: +this.fatigue.toFixed(3), counters: this.counters, gripReady: this.gripReady, time: +this.time.toFixed(1) };
  }

  dispose() {
    const { bear, cam, player, ui } = this.h;
    cam.combatFocus = null;
    player.strikeKind = undefined;
    player.strikeAt = undefined;
    bear.model.onCue = undefined;
    bear.model.onStep = undefined;
    ui.bossNote(null);
    ui.qte(null);
  }

  /** the head he squares up to when he swings (none when it is out of any blow's reach) */
  private headIfNear() {
    const { bear, player } = this.h;
    const hc = bear.model.headCenter.getWorldPosition(_face);
    return Math.hypot(hc.x - player.pos.x, hc.z - player.pos.z) < 3.4 ? hc : null;
  }

  /** the blow the staff button gives: the swung blow when the head is within its reach, else the jab */
  private strikeKind(): 'jab' | 'strike' {
    const { bear, player } = this.h;
    const hc = bear.model.headCenter.getWorldPosition(_v);
    const d = Math.hypot(hc.x - player.pos.x, hc.z - player.pos.z);
    return d < 1.55 ? 'strike' : 'jab';
  }

  // ---------------------------------------------------------------------------------------------- per frame
  update(dt: number) {
    if (this.result) return;
    const { bear, player, ui } = this.h;
    const m = bear.model;
    this.time += dt;
    this.pt += dt;
    this.open = Math.max(0, this.open - dt);
    this.punish = Math.max(0, this.punish - dt);
    this.fatigue = clamp(this.fatigue + FIGHT.fatiguePerSec * dt, 0, 1);
    m.fatigue = damp(m.fatigue, this.fatigue, 1.5, dt);
    // tired, it pants (one pair of breaths every ≈0.6 s; slower and heavier as it tires)
    this.pantT -= dt;
    if (this.fatigue > 0.35 && this.pantT <= 0 && this.phase !== 'charge' && !(m.current && m.current.tell)) {
      this.pantT = 0.6 + 0.25 * this.fatigue;
      this.sfxAt('bearPant', bear.pos, 0.45 + 0.5 * this.fatigue, 1 - 0.3 * this.fatigue);
    }
    m.lookTarget = player.pos;
    const B = bear.pos, D = player.pos;
    const dx = D.x - B.x, dz = D.z - B.z;
    const d = Math.hypot(dx, dz);
    const toD = _w.set(dx / (d || 1), 0, dz / (d || 1));
    // he is never inside the bear: a soft push out of its body
    if (d < 1.15 && this.phase !== 'charge') {
      player.pos.x = B.x + toD.x * 1.15;
      player.pos.z = B.z + toD.z * 1.15;
    }
    if (!this.gripReady && this.fatigue >= FIGHT.gripFatigue && this.counters >= FIGHT.gripCounters) {
      this.gripReady = true;
      ui.hint('<span class="h-item">הַדֹּב כּוֹשֵׁל וּמִתְנַשֵּׁף — בַּהִתְנַפְּלוּת הַבָּאָה שֶׁל פִּיו: זוּז הַצִּדָּה וּתְפֹס אוֹתוֹ בִּזְקָנוֹ</span>', 7);
    }

    switch (this.phase) {
      case 'stand': {
        // risen against him: it stands a moment, then drops to all fours to come at him
        bear.face(D, dt, 3);
        bear.stop(dt);
        if (this.pt > 1.3) {
          m.hold = 'none';
          this.setPhase('engage');
        }
        break;
      }
      case 'engage':
        this.engage(dt, d, toD);
        break;
      case 'move':
        this.runMove(dt, d);
        break;
      case 'recover': {
        bear.stop(dt);
        bear.face(D, dt, 1.5);
        // blows rained on it after its opening are answered as soon as it is on its feet
        if (this.punish > 0 && d < 2.4 && !m.busy) {
          this.punish = 0;
          this.startMove('swipe', this.sideOf(), 0.25);
          break;
        }
        if (this.pt > 0.25 && this.open <= 0) this.setPhase('engage');
        break;
      }
      case 'charge':
        this.runCharge(dt);
        break;
      case 'brake': {
        bear.brake(dt);
        if (this.pt > 0.25) bear.face(D, dt, 2);
        if (!m.busy && this.pt > 0.5) {
          this.openWindow(0.9);
          this.setPhase('recover');
        }
        break;
      }
      case 'crash': {
        bear.brake(dt);
        if (!m.busy && this.pt > 0.6) this.setPhase('recover');
        break;
      }
      case 'retreat': {
        // backs off to a distance, facing him, then the huff display (the sling's moment)
        const arrived = bear.moveTo(this.retreatTo, 1.3, dt, 0.6);
        if (arrived || this.pt > 2.6 || d > 7.5) {
          this.startMove('huff', 1);
          this.phase = 'display';
        }
        break;
      }
      case 'display': {
        bear.stop(dt);
        bear.face(D, dt, 2);
        if (!m.busy) this.setPhase('engage');
        break;
      }
      case 'done':
        break;
    }
    this.lastBearPos.copy(B);
    this.hud(d);
    if (player.health <= 0 && player.stunT <= 0.4) this.result = 'knockout';
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.pt = 0;
  }

  /** neutral: keep a distance that suits it, circle him, and choose the next move */
  private engage(dt: number, d: number, toD: THREE.Vector3) {
    const { bear, player } = this.h;
    const D = player.pos;
    bear.face(D, dt, 2.6);
    this.cd -= dt * (player.stunT > 0 ? 0.35 : 1);
    if (d > 9) bear.moveTo(D, 2.6, dt, 3);
    else if (d > 4.2) {
      // circles him at its distance (sideways steps), drifting in
      const side = _v.set(-toD.z * this.circleDir, 0, toD.x * this.circleDir);
      const tgt = _v.copy(bear.pos).addScaledVector(side, 1.2).addScaledVector(toD, 0.6);
      bear.moveTo(tgt, 0.9, dt, 0.2);
      if (Math.random() < dt * 0.3) this.circleDir *= -1;
    } else if (d > 2.6) bear.moveTo(D, 1.1, dt, 2.3);
    else bear.stop(dt);
    // a careless blow up close is answered at once
    if (this.punish > 0 && d < 2.4 && !bear.model.busy) {
      this.punish = 0;
      this.startMove('swipe', this.sideOf(), 0.25);
      return;
    }
    if (this.cd > 0) return;
    this.choose(d);
  }

  /** which forepaw: the one on David's side */
  private sideOf() {
    const { bear, player } = this.h;
    const r = (player.pos.x - bear.pos.x) * Math.cos(bear.heading) - (player.pos.z - bear.pos.z) * Math.sin(bear.heading);
    // +x of the bear's root = its left: David on its left → the left paw
    return r > 0 ? 1 : -1;
  }

  private choose(d: number) {
    const f = this.fatigue;
    const w: [string, number][] = [];
    const rearOk = f < 0.75 && this.h.bear.model.reared < 0.2;
    if (this.gripReady && d < 4.5) {
      w.push(['bite', 1]);
    } else if (d <= 2.5) {
      w.push(['swipe', 0.42], ['bite', 0.3], ['stomp', 0.1], ['rearSlam', rearOk ? 0.12 : 0], ['retreat', 0.06 + 0.1 * f]);
    } else if (d <= 4.2) {
      w.push(['bite', 0.36], ['swipe', 0.22], ['rearSlam', rearOk ? 0.16 : 0], ['stomp', 0.12], ['retreat', 0.1 + 0.08 * f]);
    } else if (d <= FIGHT.chargeMax) {
      w.push(['charge', d >= FIGHT.chargeMin ? 0.45 * (1 - 0.5 * f) : 0], ['retreat', 0.25], ['approach', 0.3]);
    } else w.push(['approach', 1]);
    let sum = 0;
    for (const [, x] of w) sum += x;
    let r = Math.random() * sum;
    let pick = w[0][0];
    for (const [n, x] of w) {
      r -= x;
      if (r <= 0) {
        pick = n;
        break;
      }
    }
    this.stats.moves[pick] = (this.stats.moves[pick] ?? 0) + 1;
    if (pick === 'approach') {
      this.cd = 0.6;
      return;
    }
    if (pick === 'retreat') {
      const { bear, player } = this.h;
      const away = _v.set(bear.pos.x - player.pos.x, 0, bear.pos.z - player.pos.z).normalize();
      this.retreatTo.copy(bear.pos).addScaledVector(away, Math.max(0, 6.2 - d));
      this.setPhase('retreat');
      return;
    }
    if (pick === 'charge') {
      this.startCharge();
      return;
    }
    // the bite and the swat need him near: the lunge carries it the rest of the way
    const lunge = pick === 'bite' ? clamp(d - 1.75, 0.35, 1.6) : pick === 'swipe' ? clamp(d - 1.35, 0.15, 1.1) : pick === 'stomp' ? 0.35 : pick === 'rearSlam' ? clamp(d - 1.4, 0.3, 1.2) : 0;
    this.startMove(pick as BearActionName, this.sideOf(), lunge);
  }

  private startMove(name: BearActionName, side: number, lunge = 0) {
    const { bear } = this.h;
    const l = name === 'bite' ? [0.24, 0.46] : name === 'swipe' ? [0.28, 0.47] : name === 'stomp' ? [0.34, 0.56] : name === 'rearSlam' ? [1.32, 1.62] : name === 'swipeHigh' ? [0.3, 0.5] : [0, 0];
    this.move = { name, side, l0: l[0], l1: l[1], lunge, resolved: false, gripOffer: false };
    bear.model.play(name, name === 'bite' ? [{ t: 0.41, fn: () => this.sfxAt('bearSnap', bear.pos, 1) }] : [], { side });
    if (name === 'bite' && this.gripReady) {
      this.move.gripOffer = true;
      this.stats.gripOffers++;
    }
    const growl = name === 'huff' ? 0 : name === 'rearSlam' ? 1 : 0.85;
    if (growl) this.sfxAt('bearGrowl', bear.pos, growl, name === 'bite' ? 1.1 : 1);
    this.setPhase(name === 'huff' ? 'display' : 'move');
  }

  private runMove(dt: number, d: number) {
    const { bear, player, ui, input } = this.h;
    const mv = this.move;
    const m = bear.model;
    const cur = m.current;
    if (!mv || !cur) {
      // the move ended: its open window runs on
      const mvn = mv?.name;
      this.move = null;
      ui.qte(null);
      // (the same opening: no new counter)
      if (mvn && BEAR_MOVES[mvn].open) this.open = Math.max(this.open, 0.35 / Math.max(0.3, m.actionRate));
      this.setPhase('recover');
      this.cd = this.cooldown();
      return;
    }
    const t = cur.t;
    // the lunge (the root itself goes forward), and it keeps turning a little toward him until the blow
    if (mv.lunge > 0 && t >= mv.l0 && t <= mv.l1) bear.speed = (mv.lunge / Math.max(0.05, mv.l1 - mv.l0)) * m.actionRate;
    else bear.speed = damp(bear.speed, 0, 12, dt);
    const hit = BEAR_MOVES[mv.name].hit;
    if (hit === undefined || t < hit - 0.15) bear.face(player.pos, dt, 2.2);
    // the blow
    if (!mv.resolved && hit !== undefined && t >= hit) {
      mv.resolved = true;
      this.resolveBlow(mv);
    }
    // the open window opens with the move's own
    const ow = BEAR_MOVES[mv.name].open;
    if (ow && t >= ow[0] && t <= ow[1]) {
      if (!mv.opened) {
        mv.opened = true;
        this.winBudget = 1;
      }
      this.open = Math.max(this.open, 0.05 / Math.max(0.3, m.actionRate));
    }
    // the grip: offered in the bite of an exhausted bear — a timed sidestep-and-seize
    if (mv.gripOffer) {
      const [g0, g1] = FIGHT.gripWin;
      const inWin = t >= g0 - 0.16 && t <= g1;
      if (inWin && d < 3.2) ui.qte('press', 0, 'תְּפֹס בִּזְקָנוֹ!', this.h.gripKey);
      else if (t > g1) ui.qte(null);
      if (input.take('interact') && player.stunT <= 0) {
        if (t >= g0 && t <= g1 && d < 3.2) {
          this.result = 'grip';
          ui.flashQte(true);
          ui.qte(null);
          this.setPhase('done');
          return;
        }
        // too early: the jaws are still coming — it is on him; too late: gone
        ui.flashQte(false);
        this.gripPressT = t;
      }
    }
  }

  private cooldown() {
    return FIGHT.cd0 + (FIGHT.cd1 - FIGHT.cd0) * this.fatigue + Math.random() * FIGHT.cdRand;
  }

  /** a new opening (a pulled-up charge, a crash, the fight resumed): `budget` counters may land in it */
  private openWindow(sec: number, budget = 1) {
    if (this.open <= 0) this.winBudget = budget;
    this.open = Math.max(this.open, sec / Math.max(0.3, this.h.bear.model.actionRate));
  }

  /** the strike frame: is David where the paw / the jaws / the forepaws land? */
  private resolveBlow(mv: MoveRun) {
    const { bear, player } = this.h;
    const spec = BEAR_MOVES[mv.name];
    if (spec.reach === undefined) return;
    const fx = Math.sin(bear.heading), fz = Math.cos(bear.heading);
    const rx = -fz, rz = fx; // the bear's right? (x = -cos h, z = sin h) → its left is -this
    const ox = player.pos.x - bear.pos.x, oz = player.pos.z - bear.pos.z;
    const along = ox * fx + oz * fz;
    const lat = Math.abs(ox * rx + oz * rz);
    const reach = spec.reach + FIGHT.davidR + 0.25;
    const width = (spec.width ?? 0.4) + FIGHT.davidR;
    const inBlow = along > 0.2 && along < reach && lat < width;
    this.sfxAt('whoosh', bear.pos, 0.8, 0.7);
    if (inBlow && player.knockDown(bear.pos, 1, mv.name === 'rearSlam' ? 1.9 : 1.5)) {
      this.knocked(mv.name === 'rearSlam' ? 1.2 : 1);
    } else this.stats.misses++;
  }

  private knocked(shake: number) {
    const { cam, engine } = this.h;
    this.knockdowns++;
    this.stats.knockdowns++;
    cam.addShake(shake);
    engine.post.grade.uniforms.uRed.value = 1;
  }

  // ---------------------------------------------------------------------------------------------- the charge
  private startCharge() {
    const { bear, player } = this.h;
    this.stats.charges++;
    const bluffP = FIGHT.bluff0 + (FIGHT.bluff1 - FIGHT.bluff0) * this.fatigue;
    this.chargeBluff = Math.random() < bluffP;
    if (this.chargeBluff) this.stats.bluffs++;
    this.chargeFrom.copy(bear.pos);
    this.chargeDir.set(player.pos.x - bear.pos.x, 0, player.pos.z - bear.pos.z).normalize();
    // a bluff pulls up 2.4-3.4 m short of him; a real charge runs on through where he stood
    const d = bear.pos.distanceTo(player.pos);
    this.chargeStop = this.chargeBluff ? Math.max(1.2, d - 2.4 - Math.random()) : d + 3.2;
    this.chargeHit = false;
    this.blockedT = 0;
    this.sfxAt('bearRoar', bear.pos, 0.9, 1.1);
    this.setPhase('charge');
  }

  private runCharge(dt: number) {
    const { bear, player } = this.h;
    const B = bear.pos;
    const run = (B.x - this.chargeFrom.x) * this.chargeDir.x + (B.z - this.chargeFrom.z) * this.chargeDir.z;
    // committed: it aims at where he was when it set off, re-aiming only a little (a sidestep beats it)
    const aim = _v.copy(player.pos).sub(B).setY(0).normalize();
    this.chargeDir.lerp(aim, Math.min(1, dt * 0.9)).normalize();
    const tgt = _v.copy(B).addScaledVector(this.chargeDir, 6);
    bear.charge(tgt, dt, FIGHT.chargeSpeed * (1 - 0.25 * this.fatigue), 0.1);
    // blocked by a boulder / a trunk: it crashes into it and staggers (the open window)
    const moved = Math.hypot(B.x - this.lastBearPos.x, B.z - this.lastBearPos.z);
    if (bear.speed > 3 && moved < bear.speed * dt * 0.35) this.blockedT += dt;
    else this.blockedT = 0;
    if (this.blockedT > 0.12) {
      this.stats.crashes++;
      bear.speed = 0;
      bear.model.play('stagger', [], { side: Math.random() < 0.5 ? 1 : -1 });
      this.sfxAt('bearHurt', B, 1);
      this.h.cam.addShake(0.4);
      this.openWindow(1.8, 2);
      this.fatigue = clamp(this.fatigue + 0.03, 0, 1);
      this.setPhase('crash');
      return;
    }
    // contact: he is in its line as it comes through
    if (!this.chargeHit && bear.speed > 3.5) {
      const ox = player.pos.x - B.x, oz = player.pos.z - B.z;
      const along = ox * this.chargeDir.x + oz * this.chargeDir.z;
      const lat = Math.abs(ox * -this.chargeDir.z + oz * this.chargeDir.x);
      if (along > -0.2 && along < 1.3 && lat < FIGHT.chargeHalfWidth) {
        this.chargeHit = true;
        if (player.knockDown(B, 1, 2.2)) this.knocked(1.3);
      }
    }
    if (run >= this.chargeStop || this.pt > 3.2) {
      bear.model.play('brake');
      this.setPhase('brake');
    }
  }

  // ---------------------------------------------------------------------------------------------- David's blows
  /** the staff connects (Story.onStaffImpact): head or body, counter / neutral / in its tell */
  onStaffHit(kind: 'jab' | 'strike', tip: THREE.Vector3): boolean {
    const { bear } = this.h;
    if (this.result) return false;
    const pts = bear.model.hitPoints([]);
    const head = pts[2];
    // the staff from his hands to its end (a blow can land with its length, not only its tip)
    const p = this.h.player;
    const dh = staffDist(p, tip, head, kind);
    const db = Math.min(staffDist(p, tip, pts[0], kind), staffDist(p, tip, pts[1], kind));
    const onHead = dh < (kind === 'jab' ? 0.5 : 0.6);
    if (!onHead && db > 0.75) return false;
    const table = onHead ? (kind === 'jab' ? FIGHT.jabHead : FIGHT.strikeHead) : kind === 'jab' ? FIGHT.jabBody : FIGHT.strikeBody;
    this.landed(table, 'staffBlow', tip, onHead, kind);
    return true;
  }

  /** a sling stone landed (Story's projectile zones) */
  onSlingHit(at: THREE.Vector3, onHead: boolean) {
    if (this.result) return;
    this.stats.slingHits++;
    this.landed(onHead ? FIGHT.slingHead : FIGHT.slingBody, 'stoneHitBear', at, onHead, 'sling');
  }

  private landed(table: number[], sound: string, at: THREE.Vector3, onHead: boolean, kind: 'jab' | 'strike' | 'sling') {
    const { bear, ui, cam, engine, player } = this.h;
    const m = bear.model;
    const cur = m.current;
    const tell = !!cur && cur.tell && !cur.open && (cur.name !== 'huff');
    // a counter: the first blow in its opening (one per opening — two after a crash); a stone in its huff display
    const slingDisplay = this.phase === 'display' && kind === 'sling';
    const counter = slingDisplay || ((this.open > 0 || this.phase === 'crash') && this.winBudget > 0);
    if (counter && !slingDisplay) this.winBudget--;
    const v = counter ? table[0] : tell ? table[2] : table[1];
    this.dealt += v;
    this.fatigue = clamp(this.fatigue + FIGHT.fatiguePerHit * v, 0, 1);
    this.sfxAt(sound, at, 1, sound === 'staffBlow' ? (onHead && kind === 'jab' ? 1.3 : onHead ? 1 : 0.9) : 1);
    this.sfxAt('bearHurt', bear.pos, 0.6 + 0.4 * Math.min(1, v));
    engine.particles.dustBurst(at, 5, 0.45, new THREE.Color(0.55, 0.42, 0.3));
    ui.hitMarker(counter);
    if (counter) {
      this.counters++;
      this.stats.counters++;
      cam.addShake(kind === 'strike' ? 0.7 : 0.35);
      ui.praise(onHead ? (kind === 'jab' ? 'בָּאַף!' : 'בָּרֹאשׁ!') : 'פְּגִיעָה', 1.1);
      // a heavy counter staggers it (away from the blow); a jab to the nose makes it flinch and give a step
      if (!this.move || this.move.resolved || this.phase !== 'move') {
        if (kind === 'strike' || (kind === 'sling' && onHead)) {
          const right = (player.pos.x - bear.pos.x) * Math.cos(bear.heading) - (player.pos.z - bear.pos.z) * Math.sin(bear.heading);
          m.play('stagger', [], { side: right > 0 ? -1 : 1 });
          this.move = null;
          // the stagger is the reward: no new opening (a second blow on it is a careless one)
          this.open = 0;
          this.cd = Math.max(this.cd, 1.05);
          this.setPhase('recover');
        } else if (!m.busy || cur?.name === 'huff') {
          m.play('hurt');
          if (this.phase === 'display') this.setPhase('engage');
        }
      }
    } else if (tell) {
      // swatted through: the move goes on
      this.stats.tellHits++;
      ui.praise('הוּא לֹא נֶעֱצַר', 0.9, true);
    } else {
      this.stats.neutral++;
      if (!m.busy) m.play('hurt');
      // careless blows up close are answered
      if (kind !== 'sling' && (this.phase === 'engage' || this.phase === 'recover')) this.punish = 1.6;
    }
  }

  // ---------------------------------------------------------------------------------------------- sounds, HUD
  private onCue(cue: string, at: THREE.Vector3, s: number) {
    const map: Record<string, string> = { huff: 'bearHuff', jawPop: 'bearJawPop', stomp: 'bearStomp', slam: 'bearSlam', land: 'bearLand', skid: 'bearSkid', collapse: 'bearCollapse' };
    const n = map[cue];
    if (n) this.sfxAt(n, at, cue === 'slam' ? 1.4 : Math.min(1, 0.6 + 0.3 * s));
    if (cue === 'slam' || cue === 'stomp') {
      this.h.cam.addShake(cue === 'slam' ? 0.6 : 0.25);
      this.h.engine.particles.dustBurst(at, cue === 'slam' ? 14 : 6, cue === 'slam' ? 1.1 : 0.6);
    }
    if (cue === 'skid') this.h.engine.particles.dustBurst(at, 12, 0.9);
  }

  private sfxAt(name: string, at: THREE.Vector3, v = 1, p = 1) {
    try {
      this.h.audio.at(name as SfxName, at, v, p);
    } catch {
      /* a sound never breaks the fight */
    }
  }

  /** the bar: how far it is from being taken (fatigue and counters); the note: its state / its tell / its opening */
  private hud(d: number) {
    const { ui, bear } = this.h;
    const cur = bear.model.current;
    if (this.gripReady) ui.bossNote('כּוֹשֵׁל — תְּפֹס אוֹתוֹ בַּנְּשִׁיכָה הַבָּאָה', false);
    else if (this.phase === 'charge') ui.bossNote(this.chargeBluff ? 'מִסְתָּעֵר!' : 'מִסְתָּעֵר!', true);
    else if (cur && cur.tell && !cur.open && cur.name !== 'huff') ui.bossNote('מִתְכּוֹנֵן לְהַכּוֹת', true);
    else if ((this.open > 0 || this.phase === 'crash') && this.winBudget > 0) ui.bossNote('פָּרוּץ — הַכֵּה עַכְשָׁו', false);
    else if (this.phase === 'display') ui.bossNote('נוֹשֵׁף וּמַקִּישׁ בְּשִׁנָּיו — הַקֶּלַע!', false);
    else if (this.fatigue > 0.45) ui.bossNote('מִתְעַיֵּף', false);
    else ui.bossNote(d > 6 ? 'אוֹרֵב' : null);
  }
}

// ------------------------------------------------------------------------------------------------ test bots
/**
 * (bear1) scripted players for tuning (?bot=careful|average|careless): they fight through the real controls — Input
 * presses and the touch stick (camera-relative), with a reaction time — never by touching the fight's state.
 *  careful: keeps 2.6-3.4 m, sidesteps every tell after ~0.18 s, one blow per open window, the sling at the huff
 *           display, the grip on time;
 *  average: reacts in ~0.34 s, sidesteps 70 % of the time (else straight back), strikes in half the windows and now
 *           and then outside them, the sling sometimes;
 *  careless: walks up to it and mashes the staff, dodges late and straight back.
 */
export class FightBot {
  private lastMove = '';
  private react = -1;
  private dodged = false;
  private struckWin = false;
  private mash = 0;
  private slingOn = false;
  private side = 1;
  private grip = -1;
  private pullDelay = -1;
  private pullRight = true;
  constructor(readonly level: 'careful' | 'average' | 'careless') {}

  private get rt() {
    return this.level === 'careful' ? 0.18 : this.level === 'average' ? 0.34 : 0.55;
  }

  private stick(h: FightHost, wx: number, wz: number) {
    const f = h.cam.forward(_v);
    const rx = -f.z, rz = f.x;
    const tm = (h.input as unknown as { touchMove: THREE.Vector2 }).touchMove;
    const l = Math.hypot(wx, wz);
    if (l < 1e-3) tm.set(0, 0);
    else tm.set((wx * rx + wz * rz) / l, (wx * f.x + wz * f.z) / l);
  }

  release(h: FightHost) {
    (h.input as unknown as { touchMove: THREE.Vector2 }).touchMove.set(0, 0);
    if (this.slingOn) h.input.holdSling(false);
    this.slingOn = false;
  }

  fight(dt: number, f: BearFight, h: FightHost) {
    const { input, player: p, bear: b } = h;
    const cur = b.model.current;
    const ox = b.pos.x - p.pos.x, oz = b.pos.z - p.pos.z;
    const d = Math.hypot(ox, oz) || 1;
    const tx = ox / d, tz = oz / d; // toward the bear
    const careful = this.level === 'careful', average = this.level === 'average';
    const phase = (f as unknown as { phase: string }).phase;
    const fo = f as unknown as { open: number; winBudget: number };
    const open = (fo.open > 0 || phase === 'crash') && fo.winBudget > 0;
    if (p.stunT > 0) {
      this.stick(h, 0, 0);
      return;
    }
    // a new move: the reaction clock starts
    const key = cur ? cur.name + Math.floor(cur.t * 0) : phase === 'charge' ? 'charge' : '';
    if (key && key !== this.lastMove) {
      this.lastMove = key;
      this.react = this.rt * (0.8 + 0.4 * Math.random());
      this.dodged = false;
      this.struckWin = false;
      this.side = Math.random() < 0.5 ? 1 : -1;
    }
    if (!key) this.lastMove = '';
    this.react -= dt;
    // ---- the sling at the huff display / when it backs off
    if ((careful || (average && Math.random() < 0.5)) && (phase === 'display' || phase === 'retreat') && d > 3.8 && p.stones > 0) {
      this.stick(h, 0, 0);
      if (!this.slingOn) {
        input.holdSling(true);
        this.slingOn = true;
      } else if (p.whirling && p.whirlT > 0.8) {
        const e = p.whirlPhase - Math.round(p.whirlPhase);
        if (Math.abs(e) < p.window * (careful ? 0.4 : 0.9)) {
          input.holdSling(false);
          this.slingOn = false;
        }
      }
      return;
    } else if (this.slingOn) {
      input.holdSling(false);
      this.slingOn = false;
    }
    // ---- the grip, in the bite of an exhausted bear
    if (f.gripReady && cur?.name === 'bite') {
      if (this.grip < 0) this.grip = careful ? 0.44 + Math.random() * 0.12 : average ? 0.25 + Math.random() * 0.6 : 2;
      if (cur.t >= this.grip) {
        input.press('interact');
        this.grip = 9;
      }
    } else this.grip = -1;
    // ---- a blow coming (its tell) or a charge: get out of its line
    const threat = (phase === 'charge' && d < 4.2) || (!!cur && cur.tell && !cur.open && cur.name !== 'huff' && d < 3.4);
    if (threat && !this.dodged && this.react <= 0) {
      this.dodged = true;
      const sideways = careful || (average && Math.random() < 0.7);
      if (this.level === 'careless' && Math.random() < 0.5) return; // it did not see it coming
      const sx = sideways ? -tz * this.side : -tx, sz = sideways ? tx * this.side : -tz;
      this.stick(h, sx, sz);
      input.press('dodge');
      return;
    }
    // ---- the opening: in and strike once
    if (open && !this.struckWin && (careful || (average && Math.random() < 0.55) || this.level === 'careless')) {
      // in to its head (the swung blow reaches ~1.5 m), the blow once he is free to swing
      const hc = b.model.headCenter.getWorldPosition(_w);
      const hx = hc.x - p.pos.x, hz = hc.z - p.pos.z;
      if (Math.hypot(hx, hz) > 1.4) this.stick(h, hx, hz);
      else {
        this.stick(h, 0, 0);
        if (!p.model.busy) {
          input.press('strike');
          this.struckWin = true;
        }
      }
      return;
    }
    // ---- careless: walks up and mashes; average: an occasional blow outside the windows
    if (this.level === 'careless') {
      this.mash -= dt;
      if (d > 1.7) this.stick(h, tx, tz);
      else this.stick(h, 0, 0);
      if (d < 2.6 && this.mash <= 0) {
        input.press('strike');
        this.mash = 0.35;
      }
      return;
    }
    if (average && d < 2.4 && Math.random() < dt * 0.5) input.press('strike');
    // ---- keep the distance: in the band, strafe slowly round it
    const lo = careful ? 2.6 : 2.2, hi = careful ? 3.4 : 3.9;
    if (d < lo) this.stick(h, -tx, -tz);
    else if (d > hi) this.stick(h, tx, tz);
    else this.stick(h, -tz * this.side * 0.4, tx * this.side * 0.4);
  }

  private sprint(h: FightHost, on: boolean) {
    (h.input as unknown as { touchSprint: boolean }).touchSprint = on;
  }

  /** aim the camera's line at a point (the sling throws along it) */
  private aimAt(h: FightHost, c: THREE.Vector3) {
    const o = h.engine.camera.position;
    const dx = c.x - o.x, dy = c.y - o.y, dz = c.z - o.z;
    h.cam.yaw = Math.atan2(-dx, -dz);
    h.cam.pitch = Math.atan2(-dy, Math.hypot(dx, dz));
  }

  /** a whirl of the sling released in its window (returns true while it is busy with it) */
  private slingAt(h: FightHost, c: THREE.Vector3) {
    const p = h.player;
    this.stick(h, 0, 0);
    this.sprint(h, false);
    this.aimAt(h, c);
    if (!this.slingOn) {
      h.input.holdSling(true);
      this.slingOn = true;
    } else if (p.whirling && p.whirlT > 0.8) {
      const e = p.whirlPhase - Math.round(p.whirlPhase);
      if (Math.abs(e) < p.window * (this.level === 'careful' ? 0.4 : 0.9)) {
        h.input.holdSling(false);
        this.slingOn = false;
      }
    }
  }

  /** (tests) the chase: after it at a run; when it stops to look back, the careful/average bot stands and throws */
  chase(dt: number, h: FightHost, looking: boolean) {
    const { player: p, bear: b } = h;
    const ox = b.pos.x - p.pos.x, oz = b.pos.z - p.pos.z;
    const d = Math.hypot(ox, oz) || 1;
    this.react -= dt;
    if (looking && this.level !== 'careless' && d > 7 && d < 24 && p.stones > 0) {
      this.slingAt(h, _w.copy(b.pos).setY(b.pos.y + 0.75));
      return;
    }
    if (this.slingOn) {
      h.input.holdSling(false);
      this.slingOn = false;
    }
    this.stick(h, ox / d, oz / d);
    this.sprint(h, d > 4);
  }

  /** (tests) the rescue: at its edge, out of its swats, a blow to its snout in its opening */
  rescue(dt: number, h: FightHost, open: boolean) {
    const { input, player: p, bear: b } = h;
    const cur = b.model.current;
    this.sprint(h, false);
    if (p.stunT > 0) {
      this.stick(h, 0, 0);
      return;
    }
    const ox = b.pos.x - p.pos.x, oz = b.pos.z - p.pos.z;
    const d = Math.hypot(ox, oz) || 1;
    const tx = ox / d, tz = oz / d;
    const key = cur ? cur.name : '';
    if (key && key !== this.lastMove) {
      this.lastMove = key;
      this.react = this.rt * (0.8 + 0.4 * Math.random());
      this.dodged = false;
      this.struckWin = false;
      this.side = Math.random() < 0.5 ? 1 : -1;
    }
    if (!key) this.lastMove = '';
    this.react -= dt;
    if (cur && cur.tell && !cur.open && d < 4.2 && !this.dodged && this.react <= 0) {
      this.dodged = true;
      if (this.level === 'careless' && Math.random() < 0.5) return;
      this.stick(h, -tz * this.side, tx * this.side);
      input.press('dodge');
      return;
    }
    if (open && !this.struckWin) {
      const hc = b.model.headCenter.getWorldPosition(_v);
      const dh = Math.hypot(hc.x - p.pos.x, hc.z - p.pos.z);
      if (dh > 1.35) this.stick(h, hc.x - p.pos.x, hc.z - p.pos.z);
      else {
        this.stick(h, 0, 0);
        if (!p.model.busy) {
          input.press('strike');
          this.struckWin = true;
        }
      }
      return;
    }
    // its edge: just out of the swat, inside the stomp (it lowers its head there)
    if (d < 2.7) this.stick(h, -tx, -tz);
    else if (d > 3.6) this.stick(h, tx, tz);
    else this.stick(h, -tz * this.side * 0.3, tx * this.side * 0.3);
  }

  /** (tests) walk to a point; true when there */
  walkTo(h: FightHost, at: THREE.Vector3, within = 1.2) {
    const p = h.player;
    const dx = at.x - p.pos.x, dz = at.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    this.sprint(h, false);
    if (d < within) {
      this.stick(h, 0, 0);
      return true;
    }
    this.stick(h, dx, dz);
    return false;
  }

  /** the struggle at the jaw: the stick x to hold (needSign = which way the arrow points; 0 = rest) */
  struggle(dt: number, needSign: number, h: FightHost) {
    const tm = (h.input as unknown as { touchMove: THREE.Vector2 }).touchMove;
    if (!needSign) {
      this.pullDelay = -1;
      tm.set(0, 0);
      return;
    }
    if (this.pullDelay < 0) {
      this.pullDelay = this.rt * (0.8 + 0.4 * Math.random());
      this.pullRight = this.level === 'careful' ? true : this.level === 'average' ? Math.random() < 0.85 : Math.random() < 0.5;
    }
    this.pullDelay -= dt;
    if (this.pullDelay > 0) return;
    tm.set(this.pullRight ? needSign : -needSign, 0);
  }
}
