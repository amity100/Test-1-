import { FEEL } from '../config';
import { activeVariant, type CombatVariant } from './variant';

/**
 * FLOW + POWER (a COMBAT LAB variant, built on PRECISION's combat): the body
 * itself changes. You run half again as fast, steer hard in the air, SLIDE
 * (crouch at a sprint), DOUBLE JUMP, KICK OFF WALLS, and a rift keeps every
 * bit of speed you carry into it (a door even adds a little): the portals
 * are a way to travel. Moving like that fills POWER; full, hold its key and
 * time all but stops: the camera pulls out, every man is lit, the crosshair
 * MARKS up to three of them, and on release you chain-dash through rifts
 * into each one in turn.
 *
 * Every number lives here. Systems ask `flowOn()`: CURRENT, PRECISION and
 * ONSLAUGHT (and the missions) never see any of it.
 */
export const FLOW = {
  move: {
    /** Walk and sprint speeds x this (m/s: 4.65 / 9.0). */
    speedMul: 1.5,
    /** Ground acceleration (FEEL's 14) and air control (FEEL's 0.35). */
    accel: 26,
    airControl: 0.8,
    /** Over the run cap on the ground (a slide, a wall kick, a rift) and still pushing on: you bleed this (m/s²) instead of stopping. */
    overspeedDecel: 4.5,
  },
  jump: {
    /** Jumps in the air (a wall kick gives it back). */
    airJumps: 1,
    doubleJumpSpeed: 7,
    /** A double jump turns your flight this much (0..1) toward the stick. */
    redirect: 0.7,
  },
  wall: {
    /** A wall this close to your side (m, from your axis) can be kicked off... */
    reach: 0.85,
    /** ...this hard out of it, this fast up (m/s); speed along the wall is kept. */
    out: 6.5,
    up: 7.2,
    /** At least this long in the air first, and between kicks (s). */
    minAir: 0.12,
    cooldown: 0.22,
    /** Only a wall this tall (m, its top over the floor under you) is kicked off: cover, rails and crates are not (the double jump is yours there). */
    minHeight: 1.6,
  },
  slide: {
    /** Crouch at this speed or more (m/s) and you slide; it adds `boost` (m/s) once... */
    minSpeed: 5.5,
    boost: 2.6,
    /** ...and bleeds this (m/s²); it ends below `endSpeed` or after `maxTime` s. */
    decel: 5.5,
    endSpeed: 3.6,
    maxTime: 1.5,
    /** Steering while sliding (1/s), and the lockout from slide to slide (s). */
    steer: 2.2,
    cooldown: 0.35,
    /** A slide's burst never takes you past this (m/s): slide after slide doesn't stack speed. */
    cap: 11.6,
    /** A jump out of a slide: this much more along it (m/s, to `cap`), and the slide's speed is kept. */
    jumpBoost: 1.2,
  },
  portal: {
    /** Out of a door or a wall end: speed x this (never above `cap`, m/s). Loops and floor ends are left alone. */
    exitBoost: 1.12,
    cap: 18,
  },
  meter: {
    /** At the start of a life. */
    start: 0.5,
    /**
     * Rates, sized so active, stylish play (running, jumping, sliding, a few
     * kills) fills it from empty in roughly half a minute; plain running
     * takes about a minute.
     */
    /** Per second, per m/s above walking pace. */
    speed: 0.0035,
    /** Per second sliding, per second in the air. */
    slide: 0.03,
    air: 0.02,
    /** One-offs: a wall kick, a double jump, a rift crossing. */
    wallJump: 0.03,
    airJump: 0.012,
    portal: 0.03,
    /** A kill; a stylish one (in the air, sliding, or rift-charged). */
    kill: 0.06,
    styleKill: 0.12,
    /** Per second standing still on the ground. */
    drain: 0.015,
  },
  power: {
    /** Time while it's held (scale), the longest it holds (real s), the lockout after (real s). */
    timeScale: 0.05,
    maxHold: 4,
    cooldown: 0.8,
    /**
     * Men it can mark; how far (m). Every man lit in range is markable (no
     * line of sight: you go to him through rifts). Marks snap: the crosshair
     * takes the lit man nearest it within `assist` x the screen's height; a
     * finger tapping the screen, the one within `tapRadius` (CSS px) of it;
     * a thumb resting the crosshair on a man `dwell` (real s) marks him too.
     */
    maxMarks: 3,
    range: 48,
    assist: 0.11,
    tapRadius: 64,
    dwell: 0.28,
    /** The chain: a beat before the first dash, between dashes, after the last (real s); time meanwhile (scale). */
    firstDelay: 0.12,
    stepTime: 0.22,
    tail: 0.35,
    chainScale: 0.18,
    /** Each strike: hitstop (real s), shake, the slow beat after the chain (scale, s). */
    hitstop: 0.09,
    shake: 0.75,
    afterScale: 0.35,
    afterT: 0.6,
    /** You come out of each dash this far past him (m), this fast (m/s), untouchable this long after the last (game s). */
    past: 1.1,
    exitSpeed: 9,
    safe: 0.9,
    /** A boss takes this instead of dying outright. */
    bossDamage: 150,
    /** Camera while held: this much further out (m), this much wider (deg). */
    camDist: 2.8,
    camFov: 14,
  },
};

/** The run / sprint caps under FLOW (m/s). */
export const FLOW_WALK = FEEL.walkSpeed * FLOW.move.speedMul;
export const FLOW_SPRINT = FEEL.sprintSpeed * FLOW.move.speedMul;

/** FLOW's rules apply (only that variant, only in the lab). */
export function flowOn(v: CombatVariant = activeVariant()): boolean {
  return v === 'flow';
}

/**
 * FLOW's BODY moves the player (faster run, slide, double jump, wall kicks,
 * rifts keep your speed): FLOW, and REACH / AIM PORTAL, which borrow the body and none of
 * the rest (no meter, no POWER moment).
 */
export function flowBodyOn(v: CombatVariant = activeVariant()): boolean {
  return v === 'flow' || v === 'reach' || v === 'aimportal';
}

/** A lit man where he is on screen (CSS px). */
export interface PowerCandidate {
  id: number;
  x: number;
  y: number;
}

/** The man a mark at (x, y) takes: the nearest lit one not yet marked, within `radius` px; null if none. */
export function pickMark(cands: readonly PowerCandidate[], x: number, y: number, radius: number, marked: readonly number[] = []): number | null {
  let best: number | null = null;
  let bd = radius * radius;
  for (const c of cands) {
    if (marked.includes(c.id)) continue;
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d <= bd) {
      bd = d;
      best = c.id;
    }
  }
  return best;
}

/** What the meter reads off the player each frame. */
export interface FlowMotion {
  /** Horizontal speed (m/s). */
  speed: number;
  grounded: boolean;
  sliding: boolean;
}

/** POWER: fills from moving like you mean it, drains a little at rest. 0..1. */
export class PowerMeter {
  value: number = FLOW.meter.start;

  reset() {
    this.value = FLOW.meter.start;
  }

  get ready() {
    return this.value >= 1;
  }

  add(n: number) {
    this.value = Math.min(1, Math.max(0, this.value + n));
  }

  /** Game seconds (slow motion fills it slowly). */
  update(dt: number, m: FlowMotion) {
    // full stays full until it's spent (READY never flickers off because you stopped)
    if (this.value >= 1) return;
    const M = FLOW.meter;
    let g = Math.max(0, m.speed - FLOW_WALK * 0.6) * M.speed;
    if (m.sliding) g += M.slide;
    if (!m.grounded) g += M.air;
    if (m.grounded && m.speed < 0.5) g -= M.drain;
    this.add(g * dt);
  }

  spend() {
    this.value = 0;
  }
}

export type PowerPhase = 'idle' | 'held' | 'chain';

/**
 * The POWER moment's timing: held (time near-stopped, marking), then the
 * chain (one strike per mark, a beat apart), then back to idle. Real seconds
 * throughout: it runs on the wall clock, not the slowed one.
 */
export class PowerMoment {
  phase: PowerPhase = 'idle';
  /** Marked enemy ids, in order. */
  marks: number[] = [];
  /** Real s held so far. */
  heldT = 0;
  /** Strikes dealt in this chain. */
  step = 0;
  private stepT = 0;
  /** Real s until it can be held again. */
  cd = 0;

  reset() {
    this.phase = 'idle';
    this.marks = [];
    this.heldT = 0;
    this.step = 0;
    this.stepT = 0;
    this.cd = 0;
  }

  canBegin(meterFull: boolean) {
    return this.phase === 'idle' && this.cd <= 0 && meterFull;
  }

  begin() {
    this.phase = 'held';
    this.marks = [];
    this.heldT = 0;
  }

  /** Mark a man (false: not holding, already marked, or full up). */
  mark(id: number): boolean {
    if (this.phase !== 'held' || this.marks.includes(id) || this.marks.length >= FLOW.power.maxMarks) return false;
    this.marks.push(id);
    return true;
  }

  /** Let go: the chain starts (true) if anyone is marked, else time just runs again. */
  release(): boolean {
    if (this.phase !== 'held') return false;
    this.cd = FLOW.power.cooldown;
    if (!this.marks.length) {
      this.phase = 'idle';
      return false;
    }
    this.phase = 'chain';
    this.step = 0;
    this.stepT = FLOW.power.firstDelay;
    return true;
  }

  /** Real seconds. `strike`: the marked id whose dash is now; `expired`: held too long (let go of it). */
  update(realDt: number): { strike: number | null; expired: boolean; done: boolean } {
    this.cd = Math.max(0, this.cd - realDt);
    if (this.phase === 'held') {
      this.heldT += realDt;
      return { strike: null, expired: this.heldT >= FLOW.power.maxHold, done: false };
    }
    if (this.phase !== 'chain') return { strike: null, expired: false, done: false };
    this.stepT -= realDt;
    if (this.stepT > 0) return { strike: null, expired: false, done: false };
    if (this.step < this.marks.length) {
      const id = this.marks[this.step++];
      this.stepT = this.step < this.marks.length ? FLOW.power.stepTime : FLOW.power.tail;
      return { strike: id, expired: false, done: false };
    }
    this.phase = 'idle';
    this.marks = [];
    return { strike: null, expired: false, done: true };
  }

  /** The time scale it asks for (1: none). */
  timeScale(): number {
    return this.phase === 'held' ? FLOW.power.timeScale : this.phase === 'chain' ? FLOW.power.chainScale : 1;
  }
}
