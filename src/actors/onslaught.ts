import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import type { NavGrid } from '../world/nav';
import { hdist, offAxis } from './aimath';
import { attend, endAttack, muzzleOf, reposition, startCharge, target, type Brain } from './behaviors';
import type { Enemy } from './enemy';
import { AI, ONS } from './tuning';

/**
 * ONSLAUGHT (COMBAT LAB; DESIGN §14): the enemy side that attacks. Every man
 * spawned with `SpawnDef.onslaught` fights here, as one squad:
 *
 *  STORMER     sprints at you zig-zagging, closes, and strikes: a RED 0.45 s
 *              wind-up, 25 and a knock back. Dodge it; a whiff leaves him open
 *              0.8 s (the blade finishes him). Comes in pairs.
 *  SUPPRESSOR  long bursts (8-10 rounds) behind an ORANGE lock, walking onto
 *              where you are (or your cover): keep moving or parry each round.
 *  WARDEN      a shield rush (red wind-up, then 9 m/s for 9 m): dodge it and
 *              he's open; his shield still turns parried rounds from the front.
 *  BRUTE       his charge (a DOOR in its path sends him through: MATADOR) and a
 *              ground slam: a red ring 0.8 s, then everything on the ground in it.
 *
 * The squad (OnsSquad): at most 3 guns and 2 melee attacks at once, no two
 * attacks landing within 0.3 s of each other; pinned in cover > 2 s, the
 * stormers flank you while the suppressors lay fire on your cover; a stormer
 * down, the others call it and the suppressors open up.
 * Grenadiers and snipers fight as in DESIGN §5, under the squad's gun cap.
 */

/** What the onslaught behaviours need beyond the plain Brain. */
export interface OnsBrain extends Brain {
  readonly squad: OnsSquad;
  readonly list: readonly Enemy[];
  gridFor(e: Enemy): NavGrid | null;
  /** He's in the fight and told where you are (give or take a few metres). */
  inform(e: Enemy, at: V3): void;
}

const _d = new THREE.Vector3();
const _g = new THREE.Vector3();
const _c = new THREE.Vector3();
const PLAYER_R = 0.4;

/** A melee attack: its wind-up and the recovery after (strike, bash, rush wind-up, slam). */
const MELEE_KINDS = new Set(['strike', 'bash', 'rush', 'slam']);

/** A man committed to a melee attack right now (wind-up, run, recovery don't count after the blow). */
export function inMelee(e: Enemy): boolean {
  if (!e.alive) return false;
  if (e.state === 'charge') return true;
  return (e.atk === 'windup' || e.atk === 'run') && MELEE_KINDS.has(e.atkKind);
}

/** Holds a gun turn (telegraphing or firing). */
function shooting(e: Enemy) {
  return e.alive && (e.atk === 'aim' || e.atk === 'fire');
}

/** A gun of the squad that can see you (the stormers' eyes don't count: they come to you). */
function gunEyes(e: Enemy) {
  return e.arch !== 'stormer' && e.kind !== 'warden' && e.kind !== 'brute';
}

/**
 * The squad director: one per EnemySystem, run each frame before the men
 * think. It books the moments attacks land (so they come one at a time),
 * knows when you're pinned, sends the flankers, and makes a death count.
 */
export class OnsSquad {
  /** Moments booked for an attack to land (game s), by whom; `melee`: a blow (they take turns). */
  readonly hits: { id: number; at: number; melee: boolean }[] = [];
  /** You've been out of every gun's sight this long (s), since one last had you (never: no cover to be pinned in). */
  coverT = 0;
  /** When a gun of the squad last saw you (game s). */
  seenT = -1e9;
  pinned = false;
  flankCd = 0;
  /** The squad's radio: the next word of where you are, in this long (s). */
  radioT = 0;
  /** Squad men alive and in the fight (last update). */
  count = 0;
  /** Flank orders given (tests, the lab's read-outs). */
  flanks = 0;
  private time = 0;

  reset() {
    this.hits.length = 0;
    this.coverT = 0;
    this.seenT = -1e9;
    this.pinned = false;
    this.flankCd = 0;
    this.radioT = 0;
    this.count = 0;
    this.flanks = 0;
  }

  /** Would an attack landing at `at` keep clear of every other booked one (blows: of other blows by a whole turn)? */
  clearAt(e: Enemy, at: number, melee = false) {
    for (const h of this.hits) {
      if (h.id === e.id) continue;
      const gap = melee && h.melee ? ONS.meleeTurn : ONS.hitGap;
      if (Math.abs(h.at - at) < gap) return false;
    }
    return true;
  }

  /** Book the moment his attack lands; false if another lands too close to it. */
  reserve(e: Enemy, at: number, melee = false): boolean {
    if (!this.clearAt(e, at, melee)) return false;
    // (his own older booking gives way to the new one)
    for (let i = this.hits.length - 1; i >= 0; i--) if (this.hits[i].id === e.id) this.hits.splice(i, 1);
    this.hits.push({ id: e.id, at, melee });
    return true;
  }

  /** Room for one more melee attack (he isn't one already)? */
  meleeFree(b: OnsBrain, e: Enemy) {
    let n = 0;
    for (const o of b.list) if (o !== e && o.ons && inMelee(o)) n++;
    return n < ONS.maxMelee;
  }

  /** A melee slot and a clear moment for his blow to land (`at`): both, or nothing. */
  meleeSlot(b: OnsBrain, e: Enemy, at: number) {
    return this.meleeFree(b, e) && this.reserve(e, at, true);
  }

  /** Guns of the squad telegraphing or firing now. */
  shooters(b: OnsBrain) {
    let n = 0;
    for (const o of b.list) if (o.ons && shooting(o)) n++;
    return n;
  }

  update(b: OnsBrain, dt: number) {
    this.time = b.time;
    for (let i = this.hits.length - 1; i >= 0; i--) if (this.hits[i].at < this.time - ONS.meleeTurn) this.hits.splice(i, 1);
    this.flankCd -= dt;
    this.radioT -= dt;
    const pl = b.ctx.player;
    // the radio: the squad never loses you for good (no search, no standing down): whoever can't
    // see you hears where you are, give or take, every few seconds
    if (this.radioT <= 0 && pl.alive) {
      this.radioT = ONS.squad.radio;
      for (const e of b.list) {
        if (!e.ons || !e.alive || !e.active || e.seesPlayer || e.held) continue;
        if (e.state === 'launched' || e.state === 'downed' || e.state === 'stunned') continue;
        b.inform(e, pl.pos);
      }
    }
    let n = 0;
    let seen = false;
    let guns = 0;
    for (const e of b.list) {
      if (!e.ons || !e.alive || !e.active || e.mode !== 'combat') continue;
      n++;
      if (gunEyes(e)) {
        guns++;
        if (e.seesPlayer) seen = true;
      }
      this.watch(b, e, dt);
    }
    this.count = n;
    if (!n || !pl.alive) {
      this.coverT = 0;
      this.pinned = false;
      // (a squad that comes in next hasn't had you yet: no cover to pin you in)
      if (!n) this.seenT = -1e9;
      return;
    }
    // in cover: a gun had you, and now none of them sees you (with no guns in the fight there's no pinning you;
    // out of their sight for long, you're somewhere else, not pinned)
    if (seen) this.seenT = this.time;
    this.coverT = guns && !seen && this.time - this.seenT < ONS.squad.coverFor ? this.time - this.seenT : 0;
    this.pinned = this.coverT >= ONS.squad.pinned;
    if (this.pinned && this.flankCd <= 0) this.flank(b);
  }

  /** Pinned: the stormers go round your sides (one each way), the suppressors lay fire on your cover. */
  private flank(b: OnsBrain) {
    const pl = b.ctx.player.pos;
    const stormers = b.list.filter((e) => e.arch === 'stormer' && e.alive && e.active && e.mode === 'combat' && e.atk === 'none' && e.state === 'combat');
    const supp = b.list.filter((e) => e.arch === 'suppressor' && e.alive && e.active && e.mode === 'combat');
    if (!stormers.length && !supp.length) return;
    this.flankCd = ONS.squad.cooldown;
    this.flanks++;
    // the line from the squad's guns to you; the flanks go out square to it
    _c.set(0, 0, 0);
    let k = 0;
    for (const e of b.list) {
      if (!e.ons || !e.alive || e.arch === 'stormer' || !gunEyes(e)) continue;
      _c.add(e.pos);
      k++;
    }
    if (k) _c.divideScalar(k);
    else _c.copy(stormers[0]?.pos ?? pl);
    _d.set(pl.x - _c.x, 0, pl.z - _c.z);
    if (_d.lengthSq() < 1e-4) _d.set(0, 0, 1);
    _d.normalize();
    const S = ONS.squad;
    stormers.forEach((e, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const o = e.ons!;
      o.flank.set(pl.x + _d.z * side * S.flankSide + _d.x * 2, pl.y, pl.z - _d.x * side * S.flankSide + _d.z * 2);
      o.flankT = S.flankTime;
      e.hasGoal = false;
      e.hasSpot = false;
    });
    if (stormers.length) b.bark(stormers[0], 'bark.flank', true);
    for (const e of supp) {
      e.ons!.suppressT = ONS.suppressor.coverFire;
      e.reloadT = Math.min(e.reloadT, 0.4);
    }
    if (supp.length && !stormers.length) b.bark(supp[0], 'bark.suppress', true);
  }

  /** A squad man died: a stormer's death is called out and the suppressors open up. */
  onDeath(b: OnsBrain, dead: Enemy) {
    if (dead.arch !== 'stormer') return;
    let caller: Enemy | null = null;
    let best = Infinity;
    for (const o of b.list) {
      if (o === dead || !o.ons || !o.alive || !o.active) continue;
      const d = o.pos.distanceToSquared(dead.pos);
      if (d < best) {
        best = d;
        caller = o;
      }
      if (o.arch === 'suppressor') {
        o.ons.suppressT = Math.max(o.ons.suppressT, ONS.squad.avenge);
        o.reloadT = Math.min(o.reloadT, 0.35);
      }
    }
    if (caller) b.bark(caller, 'bark.stormerDown', true);
  }

  /**
   * Nobody stands stuck: a man who is meant to move (not a holder, not a
   * perch, not busy with an attack, not reeling) and hasn't gone anywhere in
   * a while drops his plan; twice in a row, his ground moves in toward you.
   */
  private watch(b: OnsBrain, e: Enemy, dt: number) {
    const o = e.ons!;
    const S = ONS.squad;
    // a gun that hasn't had you in sight for long comes out after you: his ground widens
    if (gunEyes(e) && e.role && e.role !== 'holder' && !e.perched) {
      o.blindT = e.seesPlayer ? 0 : o.blindT + dt;
      if (o.blindT > S.blind) {
        o.blindT = 0;
        e.leash = Math.min(S.maxLeash, e.leash + S.widen);
        e.hasSpot = false;
      }
    }
    const busy = e.atk !== 'none' || e.state !== 'combat';
    const stands = e.role === 'holder' || e.perched || e.stranded;
    if (busy || stands || hdist(e.pos, o.stuckAt) > S.stuckMove) {
      o.stuckAt.copy(e.pos);
      o.stuckT = 0;
      if (!busy && !stands) o.unstuck = Math.max(0, o.unstuck - dt * 0.1);
      return;
    }
    o.stuckT += dt;
    // a gun that sees you may stand and shoot; a stormer never stands long
    const limit = e.arch === 'stormer' ? S.stuckTime * 0.6 : S.stuckTime;
    if (o.stuckT < limit || (e.seesPlayer && e.arch !== 'stormer' && e.kind !== 'warden' && e.kind !== 'brute')) return;
    o.stuckT = 0;
    o.unstuck++;
    e.hasSpot = false;
    e.hasGoal = false;
    e.pathLen = 0;
    e.pathFailed = false;
    o.flankT = 0;
    if (o.unstuck >= 2 && e.role) {
      // his ground comes a third of the way to you
      const pl = b.ctx.player.pos;
      e.post.set(e.post.x + (pl.x - e.post.x) / 3, e.post.y, e.post.z + (pl.z - e.post.z) / 3);
      e.leash = Math.max(e.leash, AI.hold.leash.anchor + 2);
      e.returning = false;
      e.retreating = false;
      o.unstuck = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// The squad men
// ---------------------------------------------------------------------------

/** His ONSLAUGHT fight this frame; false: the plain DESIGN §5 behaviour runs instead (grenadiers, snipers, a lost man). */
export function onsCombat(b: OnsBrain, e: Enemy, dt: number): boolean {
  if (!e.ons || !b.ctx.player.alive) return false;
  if (e.arch === 'stormer') {
    // (no word of you at all: he hunts like anyone else)
    if (e.searching && e.atk === 'none' && e.ons.flankT <= 0) return false;
    return stormer(b, e, dt), true;
  }
  if (e.arch === 'suppressor') {
    if (e.searching && e.atk === 'none' && e.ons.suppressT <= 0) return false;
    return suppressor(b, e, dt), true;
  }
  if (e.kind === 'warden') return warden(b, e, dt), true;
  if (e.kind === 'brute') return brute(b, e, dt), true;
  return false;
}

function sameFloor(b: Brain, e: Enemy) {
  return Math.abs(b.ctx.player.pos.y - e.pos.y) < 1.4;
}

/** The blow meets you: in reach, in front of him, at his level, and you're touchable. */
function meets(b: Brain, e: Enemy, reach: number, cone = 0.9) {
  const pl = b.ctx.player;
  if (!pl.alive || pl.safe) return false;
  return hdist(e.pos, pl.pos) <= reach + PLAYER_R && offAxis(e.yaw, e.pos, pl.pos) < cone && Math.abs(pl.pos.y - e.pos.y) < 1.6;
}

function push(e: Enemy, speed: number, up: number) {
  e.forward(_d).multiplyScalar(speed);
  _d.y = up;
  return _d.clone();
}

/** A melee wind-up begins: he stops, the red flash, the clip. */
function beginWindup(b: Brain, e: Enemy, kind: 'strike' | 'bash' | 'rush' | 'slam', secs: number, clip: 'strike' | 'push' | 'punch') {
  e.atk = 'windup';
  e.atkKind = kind;
  e.atkT = 0;
  e.atkDur = secs;
  e.ons!.landed = false;
  e.char.play(clip, kind === 'slam' ? { speed: 0.75 } : undefined);
  b.hooks.windup?.(e, kind, secs);
}

/** After the blow: `secs` to recover, open to the blade if it missed. */
function recoverFrom(b: Brain, e: Enemy, secs: number, open: boolean) {
  e.atk = 'recover';
  e.atkT = 0;
  e.atkDur = secs;
  if (open) b.hooks.opening?.(e, secs);
}

/** The wind-up tracks you until its last `commit` s: then it's locked (a dodge beats it). */
function windupFace(b: Brain, e: Enemy, dt: number, commit: number) {
  if (e.atkDur - e.atkT > commit) b.face(e, b.ctx.player.pos, dt);
}

/** A red line from his chest out along his facing, `len` m (the melee telegraph). */
function meleeTell(b: Brain, e: Enemy, len: number) {
  e.chest(e.muzzle);
  e.forward(_d);
  e.aimPt.copy(e.muzzle).addScaledVector(_d, len);
  b.hooks.telegraph(e, 'melee', e.muzzle, e.aimPt, Math.min(1, e.atkT / Math.max(1e-3, e.atkDur)));
}

// --- STORMER ---------------------------------------------------------------

function stormer(b: OnsBrain, e: Enemy, dt: number) {
  const S = ONS.stormer;
  const o = e.ons!;
  const pl = b.ctx.player;
  // (the first time he's close he sizes you up a moment before the first blow)
  if (!o.engaged && e.seesPlayer && hdist(e.pos, pl.pos) < S.stalk + 1.5) {
    o.engaged = true;
    e.meleeCd = Math.max(e.meleeCd, b.between(S.sizeUp));
  }
  e.meleeCd -= dt;
  if (strikeUpdate(b, e, dt)) return;
  const d = hdist(e.pos, pl.pos);
  const level = sameFloor(b, e);
  // hit and run: after a blow he springs back out of your reach before he comes again
  if (o.backT > 0) {
    o.backT -= dt;
    _d.set(e.pos.x - pl.pos.x, 0, e.pos.z - pl.pos.z);
    if (_d.lengthSq() < 1e-4) e.forward(_d).negate();
    _d.normalize();
    _g.set(e.pos.x + (_d.x - _d.z * o.side * 0.5) * 3, e.pos.y, e.pos.z + (_d.z + _d.x * o.side * 0.5) * 3);
    const grid = b.gridFor(e);
    if ((grid && !grid.walkable(_g.x, _g.z)) || d > S.backTo) o.backT = 0;
    else {
      b.moveTo(e, _g, S.sprint * 0.8, dt, false);
      b.face(e, pl.pos, dt);
      return;
    }
  }
  // sent round your flank
  if (o.flankT > 0) {
    o.flankT -= dt;
    const there = b.moveTo(e, o.flank, S.sprint, dt, true);
    if (there || (e.seesPlayer && d < 7)) o.flankT = 0;
    return;
  }
  // his turn: his own blow ready, a melee slot free, and nobody else's attack landing near when his would
  const dash = Math.max(0, d - S.strikeRange) / S.sprint;
  const turn = e.meleeCd <= 0 && e.lookT <= 0 && b.squad.meleeFree(b, e) && b.squad.clearAt(e, b.time + dash + S.windup, true);
  // in reach and his turn: the blow
  if (turn && e.seesPlayer && level && d <= S.strikeRange && offAxis(e.yaw, e.pos, pl.pos) < 1.2) {
    if (b.squad.meleeSlot(b, e, b.time + S.windup)) {
      beginWindup(b, e, 'strike', S.windup, 'strike');
      if (b.rand() < 0.35) b.bark(e, 'bark.stormer');
      return;
    }
  }
  if (e.seesPlayer && level && d < S.stalk + 1.5) {
    if (turn) {
      // the dash in (to just inside his reach, never onto you)
      _d.set(e.pos.x - pl.pos.x, 0, e.pos.z - pl.pos.z);
      if (_d.lengthSq() < 1e-4) e.forward(_d).negate();
      _d.normalize();
      _g.set(pl.pos.x + _d.x * (S.strikeRange - 0.6), e.pos.y, pl.pos.z + _d.z * (S.strikeRange - 0.6));
      b.moveTo(e, _g, S.sprint, dt, false);
      b.face(e, pl.pos, dt);
      return;
    }
    // not his turn: he circles you out of reach (too close, he steps back out)
    let a = Math.atan2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) + o.side * 0.6;
    const r = d < S.stalk - 1.5 ? S.stalk + 0.5 : S.stalk;
    _g.set(pl.pos.x + Math.sin(a) * r, e.pos.y, pl.pos.z + Math.cos(a) * r);
    const grid = b.gridFor(e);
    if (grid && !grid.walkable(_g.x, _g.z)) {
      o.side = -o.side;
      a = Math.atan2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) + o.side * 0.6;
      _g.set(pl.pos.x + Math.sin(a) * r, e.pos.y, pl.pos.z + Math.cos(a) * r);
    }
    b.moveTo(e, _g, e.tune.run, dt, false);
    b.face(e, pl.pos, dt);
    return;
  }
  // the sprint in: zig-zag on an open line, the nav's way round anything else
  const tgt = target(b, e);
  o.zig += dt * S.zigRate;
  const grid = b.gridFor(e);
  const open = !!grid && d > 4.5 && grid.clearLine(e.pos.x, e.pos.z, tgt.x, tgt.z);
  if (open) {
    const swing = S.zigAngle * Math.sin(o.zig) * Math.min(1, (d - 4) / 6);
    const base = Math.atan2(tgt.x - e.pos.x, tgt.z - e.pos.z) + swing;
    _g.set(e.pos.x + Math.sin(base) * 3, e.pos.y, e.pos.z + Math.cos(base) * 3);
    if (!grid.walkable(_g.x, _g.z)) _g.copy(tgt);
  } else _g.copy(tgt);
  b.moveTo(e, _g, S.sprint, dt, true);
  if (d < 6 && e.seesPlayer) b.face(e, pl.pos, dt);
}

function strikeUpdate(b: OnsBrain, e: Enemy, dt: number): boolean {
  if (e.atkKind !== 'strike' || (e.atk !== 'windup' && e.atk !== 'recover')) return false;
  const S = ONS.stormer;
  e.atkT += dt;
  if (e.atk === 'recover') {
    b.halt(e, dt);
    if (e.atkT >= e.atkDur) {
      e.atk = 'none';
      e.atkT = 0;
      e.meleeCd = b.between(S.cooldown);
      e.ons!.side = b.rand() < 0.5 ? -1 : 1;
      e.ons!.backT = S.backOff;
    }
    return true;
  }
  windupFace(b, e, dt, S.commit);
  if (e.atkDur - e.atkT <= S.commit) {
    // the step in with the blow
    e.forward(_d);
    e.moveVel.set(_d.x * S.lunge, 0, _d.z * S.lunge);
    if (e.body && !e.body.simulate) e.body.vel.copy(e.moveVel);
  } else b.halt(e, dt);
  meleeTell(b, e, S.reach + PLAYER_R);
  if (e.atkT < e.atkDur) return true;
  e.moveVel.set(0, 0, 0);
  if (meets(b, e, S.reach)) {
    b.hooks.melee(e, S.damage, push(e, S.push, 3));
    e.ons!.landed = true;
    recoverFrom(b, e, S.recover, false);
  } else recoverFrom(b, e, S.whiff, true);
  return true;
}

// --- SUPPRESSOR ------------------------------------------------------------

function suppressor(b: OnsBrain, e: Enemy, dt: number) {
  const P = ONS.suppressor;
  const o = e.ons!;
  o.suppressT -= dt;
  if (suppressUpdate(b, e, dt)) {
    b.halt(e, dt);
    b.face(e, e.aimPt, dt);
    return;
  }
  if (reposition(b, e, dt)) return;
  attend(b, e, dt, target(b, e));
  e.reloadT -= dt;
  if (e.atk !== 'none' || e.lookT > 0 || e.reloadT > 0) return;
  // eyes on you, or fire on your cover while it's fresh (pinned, a stormer down)
  const cover = !e.seesPlayer && o.suppressT > 0 && e.hasLastKnown && b.time - e.contactT < P.coverFire;
  if (!e.seesPlayer && !cover) return;
  const range = e.seesPlayer ? e.seeDist : hdist(e.pos, e.lastKnown);
  if (range > P.range) return;
  if (!b.tryToken(e)) return;
  e.atk = 'aim';
  e.atkKind = 'suppress';
  e.atkT = 0;
  e.atkDur = P.telegraph;
  e.shotsLeft = Math.round(b.between(P.rounds));
  e.shotGap = P.interval;
  e.shotT = 0;
  muzzleOf(e, e.muzzle);
  suppressAim(b, e, e.aimPt);
  if (cover || b.rand() < 0.3) b.bark(e, 'bark.suppress', cover);
}

/** Where his fire wants to be: your chest, or your cover at chest height. */
function suppressAim(b: Brain, e: Enemy, out: V3) {
  const pl = b.ctx.player;
  if (e.seesPlayer) return out.copy(pl.chest);
  return out.set(e.lastKnown.x, e.lastKnown.y + pl.chest.y - pl.pos.y, e.lastKnown.z);
}

function suppressUpdate(b: OnsBrain, e: Enemy, dt: number): boolean {
  if ((e.atk !== 'aim' && e.atk !== 'fire') || e.atkKind !== 'suppress') return false;
  const P = ONS.suppressor;
  muzzleOf(e, e.muzzle);
  // the aim walks onto you: quick through the lock, slow through the burst (keep moving and it trails)
  suppressAim(b, e, _g);
  _c.subVectors(_g, e.aimPt);
  const step = (e.atk === 'aim' ? P.track * 3 : P.track) * dt;
  const len = _c.length();
  if (len > step) e.aimPt.addScaledVector(_c, step / len);
  else e.aimPt.copy(_g);
  if (e.atk === 'aim') {
    e.atkT += dt;
    b.hooks.telegraph(e, 'laser', e.muzzle, e.aimPt, Math.min(1, e.atkT / e.atkDur));
    if (e.atkT < e.atkDur) return true;
    e.atk = 'fire';
    e.atkT = 0;
    e.shotT = 0;
  }
  b.hooks.telegraph(e, 'laser', e.muzzle, e.aimPt, 1);
  e.shotT -= dt;
  while (e.shotT <= 0 && e.shotsLeft > 0) {
    _d.subVectors(e.aimPt, e.muzzle).normalize();
    _d.x += (b.rand() - 0.5) * 2 * P.spread;
    _d.y += (b.rand() - 0.5) * 2 * P.spread;
    _d.z += (b.rand() - 0.5) * 2 * P.spread;
    b.hooks.fireBolt(e, e.muzzle.clone(), _d.normalize().clone());
    e.char.play('shoot');
    e.shotsLeft--;
    e.shotT += e.shotGap;
  }
  if (e.shotsLeft > 0) return true;
  endAttack(b, e);
  e.bursts++;
  e.reloadT = b.between(P.reload);
  if (e.bursts % 2 === 0) e.char.play('reload');
  return true;
}

// --- WARDEN ----------------------------------------------------------------

function warden(b: OnsBrain, e: Enemy, dt: number) {
  const W = ONS.warden;
  const pl = b.ctx.player;
  e.meleeCd -= dt;
  e.chargeCd -= dt;
  if (rushUpdate(b, e, dt) || bashUpdate(b, e, dt)) return;
  const tgt = target(b, e);
  const d = hdist(e.pos, pl.pos);
  const level = sameFloor(b, e);
  const ready = e.seesPlayer && level && e.lookT <= 0 && e.shieldT <= 0;
  // the shield rush: from mid range, on an open line
  if (ready && e.chargeCd <= 0 && d >= W.rushMin && d <= W.rushMax && offAxis(e.yaw, e.pos, pl.pos) < 0.5) {
    const grid = b.gridFor(e);
    if ((!grid || grid.clearLine(e.pos.x, e.pos.z, pl.pos.x, pl.pos.z)) && b.squad.meleeSlot(b, e, b.time + W.windup + d / W.speed)) {
      beginWindup(b, e, 'rush', W.windup, 'push');
      b.bark(e, 'bark.rush');
      return;
    }
  }
  // the close bash
  if (ready && d <= AI.warden.bashRange + 0.2 && e.meleeCd <= 0 && offAxis(e.yaw, e.pos, pl.pos) < 0.6 && b.squad.meleeSlot(b, e, b.time + W.bashWindup)) {
    beginWindup(b, e, 'bash', W.bashWindup, 'push');
    return;
  }
  // he advances shield-first on where he thinks you are
  if (hdist(e.pos, tgt) > 1.8) b.moveTo(e, tgt, e.tune.run, dt, false);
  else b.halt(e, dt);
  attend(b, e, dt, tgt);
}

function bashUpdate(b: OnsBrain, e: Enemy, dt: number): boolean {
  if (e.atkKind !== 'bash' || (e.atk !== 'windup' && e.atk !== 'recover')) return false;
  e.atkT += dt;
  b.halt(e, dt);
  if (e.atk === 'recover') {
    if (e.atkT >= e.atkDur) {
      e.atk = 'none';
      e.atkT = 0;
      e.meleeCd = AI.warden.cooldown;
    }
    return true;
  }
  windupFace(b, e, dt, 0.12);
  meleeTell(b, e, AI.warden.bashReach);
  if (e.atkT < e.atkDur) return true;
  if (meets(b, e, AI.warden.bashReach - PLAYER_R)) {
    b.hooks.melee(e, AI.warden.damage, push(e, AI.warden.push, 2.5));
    recoverFrom(b, e, AI.warden.recover, false);
  } else recoverFrom(b, e, ONS.warden.whiff * 0.6, true);
  return true;
}

function rushUpdate(b: OnsBrain, e: Enemy, dt: number): boolean {
  if (e.atkKind !== 'rush' || (e.atk !== 'windup' && e.atk !== 'run' && e.atk !== 'recover')) return false;
  const W = ONS.warden;
  const o = e.ons!;
  const body = e.body;
  e.atkT += dt;
  if (e.atk === 'recover') {
    b.halt(e, dt);
    if (e.atkT >= e.atkDur) {
      e.atk = 'none';
      e.atkT = 0;
      e.chargeCd = b.between(W.cooldown);
      e.meleeCd = 0.8;
    }
    return true;
  }
  if (e.atk === 'windup') {
    b.halt(e, dt);
    windupFace(b, e, dt, W.commit);
    // the line he'll run, on the floor
    e.forward(o.runDir);
    e.muzzle.set(e.pos.x, e.pos.y + 0.15, e.pos.z);
    e.aimPt.copy(e.muzzle).addScaledVector(o.runDir, W.dist);
    b.hooks.telegraph(e, 'melee', e.muzzle, e.aimPt, Math.min(1, e.atkT / e.atkDur));
    if (e.atkT < e.atkDur) return true;
    e.atk = 'run';
    e.atkT = 0;
    o.runDist = 0;
    o.lowMove = 0;
    o.runLast.copy(e.pos);
    return true;
  }
  // the run
  const moved = hdist(o.runLast, e.pos);
  o.runDist += moved;
  o.runLast.copy(e.pos);
  const pl = b.ctx.player;
  if (e.atkT > 2 * dt && dt > 1e-4) {
    if (moved < W.speed * dt * 0.35) o.lowMove++;
    else o.lowMove = 0;
  }
  if (pl.alive && !pl.safe) {
    const dx = pl.pos.x - e.pos.x, dz = pl.pos.z - e.pos.z;
    const along = dx * o.runDir.x + dz * o.runDir.z;
    const side = Math.abs(dx * o.runDir.z - dz * o.runDir.x);
    if (along > -0.3 && along < e.radius + 1 && side < e.radius + 0.6 && Math.abs(pl.pos.y - e.pos.y) < 1.6) {
      _d.copy(o.runDir).multiplyScalar(W.push);
      _d.y = 3;
      b.hooks.melee(e, W.damage, _d.clone());
      o.landed = true;
      e.moveVel.set(0, 0, 0);
      recoverFrom(b, e, AI.warden.recover, false);
      return true;
    }
  }
  // the end of his run: its length, a wall, a drop ahead (he pulls up short of the edge)
  const w = b.ctx.world;
  const px = e.pos.x + o.runDir.x * 1.2, pz = e.pos.z + o.runDir.z * 1.2;
  const drop = w.groundAt(px, pz, 0.05, e.pos.y + 0.5) < e.pos.y - 0.6;
  if (o.runDist >= W.dist || o.lowMove >= 2 || drop) {
    e.moveVel.set(0, 0, 0);
    if (body && !body.simulate) body.vel.set(0, 0, 0);
    if (o.lowMove >= 2) b.hooks.sound('thud', e.pos);
    recoverFrom(b, e, W.whiff, true);
    return true;
  }
  e.moveVel.set(o.runDir.x * W.speed, 0, o.runDir.z * W.speed);
  if (body && !body.simulate) body.vel.copy(e.moveVel);
  e.muzzle.set(e.pos.x, e.pos.y + 0.15, e.pos.z);
  e.aimPt.copy(e.muzzle).addScaledVector(o.runDir, Math.max(0.5, W.dist - o.runDist));
  b.hooks.telegraph(e, 'melee', e.muzzle, e.aimPt, 1);
  return true;
}

// --- BRUTE -----------------------------------------------------------------

function brute(b: OnsBrain, e: Enemy, dt: number) {
  const B = ONS.brute;
  const pl = b.ctx.player;
  const o = e.ons!;
  e.meleeCd -= dt;
  e.chargeCd -= dt;
  o.slamCd -= dt;
  if (slamUpdate(b, e, dt)) return;
  const d = hdist(e.pos, pl.pos);
  const level = Math.abs(pl.pos.y - e.pos.y) < 1.5;
  // the charge (a DOOR in its path sends him through: MATADOR)
  if (e.seesPlayer && e.lookT <= 0 && e.chargeCd <= 0 && level && d >= AI.brute.minRange && d <= AI.brute.maxRange) {
    if (b.squad.meleeSlot(b, e, b.time + AI.brute.roar + d / AI.brute.speed)) {
      startCharge(b, e);
      return;
    }
  }
  // the slam, close
  if (e.seesPlayer && level && d <= B.range && o.slamCd <= 0 && b.squad.meleeSlot(b, e, b.time + B.windup)) {
    beginWindup(b, e, 'slam', B.windup, 'strike');
    b.hooks.sound('roar', e.pos);
    return;
  }
  const tgt = target(b, e);
  if (hdist(e.pos, tgt) > 2) b.moveTo(e, tgt, e.tune.run, dt, true);
  else b.halt(e, dt);
  if (d < 6) attend(b, e, dt, tgt);
}

function slamUpdate(b: OnsBrain, e: Enemy, dt: number): boolean {
  if (e.atkKind !== 'slam' || (e.atk !== 'windup' && e.atk !== 'recover')) return false;
  const B = ONS.brute;
  e.atkT += dt;
  b.halt(e, dt);
  if (e.atk === 'recover') {
    if (e.atkT >= e.atkDur) {
      e.atk = 'none';
      e.atkT = 0;
      e.ons!.slamCd = b.between(B.cooldown);
      e.chargeCd = Math.max(e.chargeCd, 1);
    }
    return true;
  }
  windupFace(b, e, dt, 0.3);
  // the ring on the ground: where it will reach
  e.muzzle.set(e.pos.x, e.pos.y + 0.06, e.pos.z);
  e.aimPt.set(e.pos.x + B.radius, e.pos.y + 0.06, e.pos.z);
  b.hooks.telegraph(e, 'slam', e.muzzle, e.aimPt, Math.min(1, e.atkT / e.atkDur));
  if (e.atkT < e.atkDur) return true;
  b.hooks.slam?.(e, e.pos, B.radius);
  b.hooks.sound('thud', e.pos);
  const pl = b.ctx.player;
  const d = hdist(e.pos, pl.pos);
  if (pl.alive && !pl.safe && !pl.airborne && d <= B.radius + PLAYER_R && Math.abs(pl.pos.y - e.pos.y) < 1.2) {
    _d.set(pl.pos.x - e.pos.x, 0, pl.pos.z - e.pos.z);
    if (_d.lengthSq() < 1e-4) e.forward(_d);
    _d.normalize().multiplyScalar(B.push);
    _d.y = B.lift;
    b.hooks.melee(e, B.damage, _d.clone());
    e.ons!.landed = true;
  }
  // after a slam he's heavy on his feet: open, hit or miss
  recoverFrom(b, e, B.recover, true);
  return true;
}
