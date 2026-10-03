import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import { REACH } from './reach';

/** REACH's two weapons. */
export type WeaponKind = 'rifle' | 'knife';
/** Who holds (or reaches for) a weapon: you, or an enemy by his id. */
export type Owner = 'player' | number;

export interface Weapon {
  readonly id: number;
  readonly kind: WeaponKind;
  /** Rounds left (a rifle; a knife's is meaningless). */
  ammo: number;
  /** In someone's hand (null: on the floor, or falling). */
  holder: Owner | null;
  /** A hand window is reaching for it: whoever opened theirs first. */
  claim: Owner | null;
  /** On the floor: where it lies (its centre). In a hand: the last hand position the game wrote. */
  readonly pos: THREE.Vector3;
  readonly vel: THREE.Vector3;
  /** On the floor and still. */
  resting: boolean;
  /** Lost for good (into the void, the pool). */
  gone: boolean;
  /** Where the wave put it. */
  readonly spawnPos: THREE.Vector3;
  /** Yaw it lies at (visual). */
  yaw: number;
}

/** A weapon lies this far over the floor (its centre). */
export const LIE_Y = 0.08;
const GRAVITY = 22;

/**
 * Every weapon of the fight and who has it. A weapon is on the floor or in
 * one hand; a hand window CLAIMS it the moment it opens (the first window
 * wins the race; any later one finds it spoken for); it changes hands when the
 * hand gets there. A spent rifle is dropped and nobody can take it again.
 */
export class Armory {
  readonly list: Weapon[] = [];
  private next = 1;

  add(kind: WeaponKind, pos: V3, yaw = 0): Weapon {
    const w: Weapon = {
      id: this.next++,
      kind,
      ammo: kind === 'rifle' ? REACH.rifle.mag : 0,
      holder: null,
      claim: null,
      pos: new THREE.Vector3(pos.x, pos.y + LIE_Y, pos.z),
      vel: new THREE.Vector3(),
      resting: true,
      gone: false,
      spawnPos: new THREE.Vector3(pos.x, pos.y, pos.z),
      yaw,
    };
    this.list.push(w);
    return w;
  }

  get(id: number): Weapon | null {
    for (const w of this.list) if (w.id === id) return w;
    return null;
  }

  clear() {
    this.list.length = 0;
  }

  /** Spent: an empty rifle (nobody takes it). */
  static spent(w: Weapon) {
    return w.kind === 'rifle' && w.ammo <= 0;
  }

  /** Worth reaching for: not lost, not spent. */
  static live(w: Weapon) {
    return !w.gone && !Armory.spent(w);
  }

  /** What `o` holds (null: empty-handed). */
  heldBy(o: Owner): Weapon | null {
    for (const w of this.list) if (w.holder === o && !w.gone) return w;
    return null;
  }

  /** On the floor, worth having, and nobody's hand on its way to it. */
  free(): Weapon[] {
    return this.list.filter((w) => w.holder === null && w.claim === null && Armory.live(w));
  }

  /**
   * `by`'s window opens for `w`: true if it's the first (the race is won the
   * moment the window opens). Already spoken for, already his, or not worth
   * having: false.
   */
  claim(w: Weapon, by: Owner): boolean {
    if (!Armory.live(w) || w.holder === by) return false;
    if (w.claim !== null && w.claim !== by) return false;
    w.claim = by;
    return true;
  }

  /** `by`'s window shut without it (his hand never got there). */
  unclaim(w: Weapon, by: Owner) {
    if (w.claim === by) w.claim = null;
  }

  /**
   * The hand got there: `w` is `to`'s (whoever had it, hasn't). Whatever `to`
   * held is dropped at `dropAt` (one weapon in hand at a time); it's returned.
   */
  give(w: Weapon, to: Owner, dropAt?: V3): Weapon | null {
    if (w.gone) return null;
    let dropped: Weapon | null = null;
    const had = this.heldBy(to);
    if (had && had !== w) {
      this.drop(had, dropAt ?? w.pos);
      dropped = had;
    }
    w.holder = to;
    w.claim = null;
    w.resting = false;
    w.vel.set(0, 0, 0);
    return dropped;
  }

  /** Out of a hand, onto the floor at `at` (it falls from there). */
  drop(w: Weapon, at: V3, vel?: V3) {
    w.holder = null;
    w.claim = null;
    w.pos.copy(at);
    if (vel) w.vel.copy(vel);
    else w.vel.set(0, 1.5, 0);
    w.resting = false;
  }

  /** Everything `o` held goes down where he is (he died, the wave's over). */
  dropAll(o: Owner, at: V3) {
    for (const w of this.list) if (w.holder === o) this.drop(w, at);
    for (const w of this.list) if (w.claim === o) w.claim = null;
  }

  /** A round out of a rifle: false when it's empty (or not a rifle). */
  fire(w: Weapon): boolean {
    if (w.kind !== 'rifle' || w.ammo <= 0) return false;
    w.ammo--;
    return true;
  }

  /**
   * Weapons on the floor fall and settle. `groundAt(x, z, y)`: the floor's top
   * under a point (-Infinity: none); below `killY` (or into water) they're lost.
   */
  update(dt: number, groundAt: (x: number, z: number, y: number) => number, lost: (p: V3) => boolean) {
    for (const w of this.list) {
      if (w.gone || w.holder !== null || w.resting) continue;
      w.vel.y -= GRAVITY * dt;
      w.pos.addScaledVector(w.vel, dt);
      w.yaw += dt * 6 * Math.min(1, w.vel.length() / 4);
      const g = groundAt(w.pos.x, w.pos.z, w.pos.y + 0.6);
      if (g > -Infinity && w.pos.y <= g + LIE_Y && w.vel.y <= 0) {
        w.pos.y = g + LIE_Y;
        w.vel.set(0, 0, 0);
        w.resting = true;
      } else if (lost(w.pos)) w.gone = true;
    }
  }
}
