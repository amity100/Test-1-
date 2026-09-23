/**
 * Style: turns GameEvents into named tricks (DESIGN §6), runs the combo chain
 * and the D..SSS style rank.
 *
 * Pure logic, no DOM, no THREE import: safe in node tests and workers.
 */
import { LAW } from '../core/contracts';
import type {
  AirEvent, CrossEvent, GameEvent, KillEvent, KnockEvent, StyleAPI, StyleRank, StyleState,
  TrickAward, TrickId, V3,
} from '../core/contracts';

/** Base points per trick (DESIGN §6). LOOP and AIRTIME are computed (see below). */
export const TRICK_POINTS: Readonly<Record<TrickId, number>> = {
  returnToSender: 300,
  crossfire: 250,
  postage: 300,
  firingLine: 350,
  borrowedGun: 300,
  trapdoor: 200,
  splashdown: 200,
  void: 200,
  skyfall: 250,
  matador: 400,
  bowling: 350,
  headsUp: 300,
  loop: 50, // 50 + 50 per loop
  cannonball: 450,
  slingshot: 350,
  comet: 450,
  guillotine: 350,
  cargo: 300,
  boom: 250,
  finisher: 150,
  ghost: 150,
  airtime: 100, // per second
  double: 200,
  triple: 500,
  multi: 1000,
  mirror: 400,
  hijack: 300,
  juggle: 300,
};

export const TRICK_IDS: readonly TrickId[] = Object.keys(TRICK_POINTS) as TrickId[];

export const RANKS: readonly StyleRank[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

export function rankIndex(r: StyleRank): number {
  const i = RANKS.indexOf(r);
  return i < 0 ? 0 : i;
}

/** Every tunable of the style system in one place. */
export const STYLE_TUNING = {
  /** Seconds the chain waits for the next trick (on the ground). */
  chainWindow: 4,
  /** After landing, the chain gets at least this long (lets the AIRTIME award arrive). */
  landingGrace: 0.6,
  varietyCap: 8,
  /** A repeat of any of the last N trick ids scores half. */
  repeatMemory: 3,
  /** DOUBLE/TRIPLE/MULTI: each kill within this many seconds of the previous one. */
  multiWindow: 0.6,
  /** BOWLING: one impactor, ≥ 2 victims (knocked or killed), each within this of the previous hit. */
  bowlingWindow: 0.8,
  mirrorAge: 0.35,
  skyfallHeight: 10,
  juggleCrossings: 3,
  cannonballLoops: 2,
  airtimeMin: 3,
  loopMin: 3,
  /** LOOP ×N award points at these loop counts (then every +5), remainder when the run ends. */
  loopMilestones: [3, 6, 10] as readonly number[],
  /** Loops past this pay nothing more (no farming a loop forever). */
  loopPayCap: 12,
  /** A loop run with no crossing for this long has ended. */
  loopTimeout: 1.6,
  /** One BOOM per explosion: byBarrel kills within this window share it. */
  boomDedupe: 0.3,
  /** Style points needed to fill the meter of each rank (low ranks fill faster). */
  rankCost: [250, 400, 600, 850, 1100, 1400, 1800] as readonly number[],
  /** Meter lost per second at each rank (high ranks drain faster). */
  rankDecay: [0.04, 0.05, 0.067, 0.082, 0.1, 0.115, 0.13] as readonly number[],
  /** Meter inside the lower rank after a hurt drop. */
  hurtMeter: 0.5,
} as const;

interface LoopRun {
  who: string;
  loops: number;
  lastT: number;
  /** Loop count already paid out (0 = not yet awarded). */
  awarded: number;
  halved: boolean;
}

interface BowlRun {
  lastT: number;
  victims: number[];
  awarded: boolean;
}

interface AwardOpts {
  points?: number;
  suffix?: string;
  at?: V3 | null;
  /** Continuation of an award already in the repeat history (LOOP milestones). */
  continuation?: boolean;
  halved?: boolean;
}

function nextLoopMilestone(awarded: number): number {
  const ms = STYLE_TUNING.loopMilestones;
  for (const m of ms) if (m > awarded) return m;
  const last = ms[ms.length - 1];
  return last + Math.ceil((awarded - last + 1) / 5) * 5;
}

export class StyleSystem implements StyleAPI {
  readonly state: StyleState = {
    rank: 'D',
    meter: 0,
    chainPoints: 0,
    variety: 0,
    chain: [],
    chainT: 0,
    total: 0,
    bestCombo: 0,
    lastCombo: 0,
  };

  /** The chain that banked last (kept for the clip/replay window). */
  lastChain: TrickAward[] = [];
  /** Event-time span [first trick t, last trick t] of the last banked chain. */
  lastChainSpan: { from: number; to: number } | null = null;

  /** Style clock: max(event t, accumulated update dt). */
  private now = 0;
  private rankI = 0;
  private recent: TrickId[] = [];
  private chainIds = new Set<TrickId>();
  private chainFrom = 0;
  private chainTo = -Infinity;
  private wasAirborne = false;
  private streakT = -Infinity;
  private streakN = 0;
  private lastBoomT = -Infinity;
  private bowls = new Map<number, BowlRun>();
  private loops = new Map<string, LoopRun>();
  /** Awards produced inside update() (a loop run that timed out); returned by the next push() or drainLate(). */
  private late: TrickAward[] = [];

  get rankIndex(): number { return this.rankI; }

  /** Current running combo value (chainPoints × variety). */
  get comboValue(): number {
    return Math.round(this.state.chainPoints * Math.max(1, this.state.variety));
  }

  push(e: GameEvent): TrickAward[] {
    const out: TrickAward[] = this.late.length ? this.late.splice(0) : [];
    if (e.t > this.now) this.now = e.t;
    switch (e.type) {
      case 'kill': this.onKill(e, out); break;
      case 'knock': this.onKnock(e, out); break;
      case 'cross': this.onCross(e, out); break;
      case 'air': this.onAir(e, out); break;
      case 'hurt': if (e.amount > 0) this.dropRank(); break;
      case 'hijack': this.award('hijack', e.t, out, { at: e.at }); break;
      case 'death': this.bail(); break;
      default: break; // catch, shear (scored per victim by the kill), explode, zone, checkpoint
    }
    return out;
  }

  /** Awards produced by update() since the last push()/drainLate(). */
  drainLate(): TrickAward[] {
    return this.late.length ? this.late.splice(0) : [];
  }

  update(dt: number, playerAirborne: boolean): { banked: number } | null {
    if (!(dt > 0)) dt = 0;
    this.now += dt;
    const T = STYLE_TUNING;

    if (this.loops.size) {
      for (const [k, run] of this.loops) {
        if (this.now - run.lastT > T.loopTimeout) {
          this.finishLoop(run, this.now, this.late);
          this.loops.delete(k);
        }
      }
    }
    if (this.bowls.size) {
      for (const [k, b] of this.bowls) if (this.now - b.lastT > T.bowlingWindow * 2) this.bowls.delete(k);
    }

    // Rank meter decay.
    const st = this.state;
    st.meter -= T.rankDecay[this.rankI] * dt;
    while (st.meter < 0) {
      if (this.rankI === 0) { st.meter = 0; break; }
      this.rankI--;
      st.meter += 1;
    }
    st.rank = RANKS[this.rankI];

    // Chain timer: frozen while airborne.
    let res: { banked: number } | null = null;
    if (st.chain.length) {
      if (!playerAirborne) {
        if (this.wasAirborne && st.chainT < T.landingGrace) st.chainT = T.landingGrace;
        st.chainT -= dt;
        if (st.chainT <= 0) res = this.bank();
      }
    }
    this.wasAirborne = playerAirborne;
    return res;
  }

  /** Bank the running chain now (zone end, before a replay). */
  bankNow(): { banked: number } | null {
    return this.state.chain.length ? this.bank() : null;
  }

  reset(): void {
    const st = this.state;
    st.rank = 'D';
    st.meter = 0;
    st.chainPoints = 0;
    st.variety = 0;
    st.chain = [];
    st.chainT = 0;
    st.total = 0;
    st.bestCombo = 0;
    st.lastCombo = 0;
    this.lastChain = [];
    this.lastChainSpan = null;
    this.now = 0;
    this.rankI = 0;
    this.recent.length = 0;
    this.chainIds.clear();
    this.wasAirborne = false;
    this.streakT = -Infinity;
    this.streakN = 0;
    this.lastBoomT = -Infinity;
    this.bowls.clear();
    this.loops.clear();
    this.late.length = 0;
  }

  // -------------------------------------------------------------------------

  private onKill(e: KillEvent, out: TrickAward[]): void {
    const T = STYLE_TUNING;
    const t = e.t;
    const at = e.at;
    const proj = e.projectileKind;

    // Projectiles.
    if (e.ownShot) {
      this.award('returnToSender', t, out, { at });
      if (e.shotAge <= T.mirrorAge) this.award('mirror', t, out, { at });
    } else if (e.shotBy !== null && e.shotBy !== e.enemyId && !e.turretShot && (proj === 'bolt' || proj === null)) {
      this.award('crossfire', t, out, { at });
    }
    if (proj === 'grenade' && e.charged) this.award('postage', t, out, { at });
    if (proj === 'beam' && e.charged) this.award('firingLine', t, out, { at });
    if (e.turretShot) this.award('borrowedGun', t, out, { at });

    // The player's own body.
    if (e.byPlayer) {
      if (e.playerFling) this.award('slingshot', t, out, { at });
      if (e.speed >= LAW.cometSpeed) this.award('comet', t, out, { at });
    }

    // Props, barrels, bodies.
    if (e.byProp && !e.byBarrel) this.award('cargo', t, out, { at });
    if (e.byBarrel && t - this.lastBoomT > T.boomDedupe) {
      this.lastBoomT = t;
      this.award('boom', t, out, { at });
    }
    if (e.byBody) this.award('headsUp', t, out, { at });

    // Rift moves.
    if (e.cause === 'shear') this.award('guillotine', t, out, { at });
    if (e.cause === 'blade') this.award('finisher', t, out, { at });
    if (e.matador) this.award('matador', t, out, { at });
    if (e.viaTrapdoor) this.award('trapdoor', t, out, { at });
    const afterRift = e.victimCrossings > 0 || e.viaTrapdoor || e.matador || e.charged;
    if (e.cause === 'water' && afterRift) this.award('splashdown', t, out, { at });
    if (e.cause === 'void' && afterRift) this.award('void', t, out, { at });
    if (e.cause === 'fall' && e.fallHeight >= T.skyfallHeight) this.award('skyfall', t, out, { at });
    if (e.killerLoops >= T.cannonballLoops) this.award('cannonball', t, out, { at });
    if (e.victimCrossings >= T.juggleCrossings) this.award('juggle', t, out, { at });
    if (e.unaware && !e.witnessed) this.award('ghost', t, out, { at });

    // One impactor, several victims.
    if ((e.byBody || e.byProp) && e.impactorId !== null) this.bowlHit(e.impactorId, e.enemyId, t, at, out);

    // Multi-kills.
    if (t - this.streakT <= T.multiWindow) this.streakN++;
    else this.streakN = 1;
    this.streakT = t;
    const n = this.streakN;
    if (n === 2) this.award('double', t, out, { at });
    else if (n === 3) this.award('triple', t, out, { at });
    else if (n >= 4) this.award('multi', t, out, { at, suffix: n > 4 ? `×${n}` : undefined });
  }

  private onKnock(e: KnockEvent, out: TrickAward[]): void {
    if (e.impactorId !== null) this.bowlHit(e.impactorId, e.enemyId, e.t, e.at, out);
  }

  private bowlHit(impactor: number, victim: number, t: number, at: V3, out: TrickAward[]): void {
    if (victim === impactor) return;
    let b = this.bowls.get(impactor);
    if (!b || t - b.lastT > STYLE_TUNING.bowlingWindow) {
      b = { lastT: t, victims: [victim], awarded: false };
      this.bowls.set(impactor, b);
    } else {
      if (b.victims.indexOf(victim) < 0) b.victims.push(victim);
      b.lastT = t;
    }
    if (!b.awarded && b.victims.length >= 2) {
      b.awarded = true;
      this.award('bowling', t, out, { at });
    }
  }

  private onCross(e: CrossEvent, out: TrickAward[]): void {
    const T = STYLE_TUNING;
    const who = e.who;
    let run = this.loops.get(who);
    if (run && (e.loops <= run.loops || e.t - run.lastT > T.loopTimeout)) {
      this.finishLoop(run, e.t, out);
      run = undefined;
    }
    if (!run) {
      run = { who, loops: 0, lastT: e.t, awarded: 0, halved: false };
      this.loops.set(who, run);
    }
    run.loops = e.loops;
    run.lastT = e.t;
    if (run.loops >= T.loopMin && run.awarded < T.loopPayCap && run.loops >= nextLoopMilestone(run.awarded)) this.payLoop(run, e.t, out);
  }

  private finishLoop(run: LoopRun, t: number, out: TrickAward[]): void {
    if (run.loops >= STYLE_TUNING.loopMin && Math.min(run.loops, STYLE_TUNING.loopPayCap) > run.awarded) this.payLoop(run, t, out);
  }

  private payLoop(run: LoopRun, t: number, out: TrickAward[]): void {
    const first = run.awarded === 0;
    const upto = Math.min(run.loops, STYLE_TUNING.loopPayCap);
    const pts = (first ? TRICK_POINTS.loop : 0) + 50 * (upto - run.awarded);
    const a = this.award('loop', t, out, {
      points: pts,
      suffix: `×${run.loops}`,
      continuation: !first,
      halved: run.halved,
    });
    if (first) run.halved = !!a.halved;
    run.awarded = upto;
  }

  private onAir(e: AirEvent, out: TrickAward[]): void {
    if (e.phase !== 'end') return;
    const run = this.loops.get('player');
    if (run) {
      this.finishLoop(run, e.t, out);
      this.loops.delete('player');
    }
    if (e.seconds >= STYLE_TUNING.airtimeMin && e.crossings >= 1) {
      this.award('airtime', e.t, out, {
        points: Math.round(TRICK_POINTS.airtime * e.seconds),
        suffix: `${e.seconds.toFixed(1)}s`,
      });
    }
  }

  private award(id: TrickId, t: number, out: TrickAward[], o: AwardOpts = {}): TrickAward {
    let pts = o.points ?? TRICK_POINTS[id];
    let halved = false;
    if (o.continuation) {
      halved = !!o.halved;
    } else {
      halved = this.recent.indexOf(id) >= 0;
      this.recent.push(id);
      if (this.recent.length > STYLE_TUNING.repeatMemory) this.recent.shift();
    }
    if (halved) pts = Math.round(pts / 2);
    const a: TrickAward = { id, key: `trick.${id}`, points: pts, t };
    if (o.suffix) a.suffix = o.suffix;
    if (o.at) a.at = o.at.clone();
    if (halved) a.halved = true;
    this.addToChain(a);
    this.addMeter(pts);
    out.push(a);
    return a;
  }

  private addToChain(a: TrickAward): void {
    const st = this.state;
    if (!st.chain.length) {
      this.chainFrom = a.t;
      this.chainTo = a.t;
    } else if (a.t > this.chainTo) {
      this.chainTo = a.t;
    }
    st.chain.push(a);
    st.chainPoints += a.points;
    this.chainIds.add(a.id);
    st.variety = Math.min(STYLE_TUNING.varietyCap, this.chainIds.size);
    st.chainT = STYLE_TUNING.chainWindow;
  }

  private addMeter(points: number): void {
    const st = this.state;
    const cost = STYLE_TUNING.rankCost;
    let left = points;
    while (left > 0) {
      const need = (1 - st.meter) * cost[this.rankI];
      if (left >= need && this.rankI < RANKS.length - 1) {
        left -= need;
        this.rankI++;
        st.meter = 0;
      } else {
        st.meter = Math.min(1, st.meter + left / cost[this.rankI]);
        left = 0;
      }
    }
    st.rank = RANKS[this.rankI];
  }

  private dropRank(): void {
    const st = this.state;
    if (this.rankI > 0) {
      this.rankI--;
      st.meter = STYLE_TUNING.hurtMeter;
    } else {
      st.meter = 0;
    }
    st.rank = RANKS[this.rankI];
  }

  private bank(): { banked: number } {
    const st = this.state;
    const banked = Math.round(st.chainPoints * Math.max(1, st.variety));
    st.total += banked;
    st.lastCombo = banked;
    if (banked > st.bestCombo) st.bestCombo = banked;
    this.lastChain = st.chain;
    this.lastChainSpan = { from: this.chainFrom, to: this.chainTo };
    this.clearChain();
    return { banked };
  }

  /** The player died: the running chain is lost (not banked) and the rank resets. */
  private bail(): void {
    this.clearChain();
    this.rankI = 0;
    this.state.meter = 0;
    this.state.rank = 'D';
    this.streakN = 0;
    this.streakT = -Infinity;
    this.loops.clear();
    this.bowls.clear();
    this.late.length = 0;
  }

  private clearChain(): void {
    const st = this.state;
    st.chain = [];
    st.chainPoints = 0;
    st.variety = 0;
    st.chainT = 0;
    this.chainIds.clear();
    this.chainTo = -Infinity;
  }
}
