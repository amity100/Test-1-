import * as THREE from 'three';
import type { EnemyView, RiftQuery, V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';

/**
 * The HIDDEN BLADE (DESIGN §4): ACTION takes down anyone close, in any state,
 * through armour and shields. In reach from any side; a little further if
 * he's ahead of you and on your level. Either way you close in fast (a lunge,
 * or a step for a man in reach) and strike on arrival. What a stab does to
 * him is the enemy system's call (Voss only takes a wound, a man who saw it
 * coming cries out).
 */
export const BLADE = {
  /** In reach: this far past his body (m), any side, at most `reachRise` m above or below. */
  reach: 2,
  reachRise: 1.2,
  /** A lunge: this far past his body (m), within ~50° of where you face or look (cos), about level. */
  lunge: 3.5,
  lungeCone: 0.64,
  lungeRise: 0.6,
  /** Lunge speed (m/s). It arrives this far past his body (m); it gets the run's time plus 0.1 s, `lungeTime` at most. */
  lungeSpeed: 14,
  lungeStop: 0.6,
  lungeTime: 0.35,
  /** From one stab to the next (s). */
  cooldown: 0.8,
  /** The blade shows out of the wrist this long (s). */
  show: 0.55,
} as const;

export interface BladeHost {
  readonly world: CollisionWorld;
  readonly enemies: readonly EnemyView[];
  /** He's in a fight around you (enemies of inactive zones don't count). */
  live(e: EnemyView): boolean;
  /** Open rift ends: you never close in through one (your own door, a hole on the way). */
  readonly rifts?: Pick<RiftQuery, 'findCrossing' | 'holeAt'>;
}

export interface BladeTarget {
  enemy: EnemyView;
  /** Out of reach: taken only because he's ahead of you and level. */
  lunge: boolean;
}

export type LungeStep = 'go' | 'strike' | 'miss';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
/** How far he may get from where he was when you went for him before it's a miss (m). */
const SLIP = 0.6;

export class HiddenBlade {
  /** Until the next stab (s). */
  cd = 0;
  /** The blade is out of the wrist this much longer (s). */
  showT = 0;
  /** Closing in (a lunge, or a step at a man in reach): at whom, how long it may still take (s), how far he was (m). */
  lunging: { enemy: EnemyView; t: number; step: boolean; d0: number } | null = null;

  constructor(private readonly h: BladeHost) {}

  get ready() {
    return this.cd <= 0 && !this.lunging;
  }

  reset() {
    this.cd = 0;
    this.showT = 0;
    this.lunging = null;
  }

  /** Whatever moved you instead (a rift, a strike, dying) ends the lunge: no strike. */
  cancel() {
    this.lunging = null;
  }

  /**
   * Who ACTION would take down from `feet`: anyone in reach first (the nearest,
   * favouring the one ahead), else the best lunge. `facing` and `look` are
   * horizontal unit vectors: where you face and where the camera looks.
   */
  pick(feet: V3, facing: V3, look: V3): BladeTarget | null {
    let best: EnemyView | null = null;
    let bestScore = Infinity;
    let lunge = false;
    for (const e of this.h.enemies) {
      if (!e.alive || !this.h.live(e)) continue;
      const dx = e.pos.x - feet.x, dz = e.pos.z - feet.z;
      const d = Math.hypot(dx, dz);
      if (d > BLADE.lunge + e.radius) continue;
      const rise = Math.abs(e.pos.y - feet.y);
      const ahead = d > 1e-3 ? Math.max(facing.x * dx + facing.z * dz, look.x * dx + look.z * dz) / d : 1;
      const reach = d <= BLADE.reach + e.radius && rise <= BLADE.reachRise;
      // a lunge only at a man ahead of you and about level; a man flying past only right on you (no step after him)
      if (!reach && (ahead < BLADE.lungeCone || rise > BLADE.lungeRise)) continue;
      if (e.state === 'launched' && d - e.radius > BLADE.lungeStop) continue;
      const score = (reach ? 0 : 10) + d - ahead;
      if (score >= bestScore || !this.clear(feet, e, !reach)) continue;
      best = e;
      bestScore = score;
      lunge = !reach;
    }
    return best ? { enemy: best, lunge } : null;
  }

  /**
   * A stab at him begins. True: he's right there and the caller strikes now.
   * Else you lunge in first (`lunging`) and update() says when to strike.
   */
  start(e: EnemyView, feet: V3): boolean {
    this.cd = BLADE.cooldown;
    this.showT = BLADE.show;
    const d = Math.hypot(e.pos.x - feet.x, e.pos.z - feet.z);
    const run = d - e.radius - BLADE.lungeStop;
    if (run <= 0) return true;
    this.lunging = { enemy: e, t: Math.min(BLADE.lungeTime, run / BLADE.lungeSpeed + 0.1), step: d <= BLADE.reach + e.radius, d0: d };
    return false;
  }

  /**
   * Per frame, after the player moved. While closing in: 'go' steers (`dir`,
   * a horizontal unit vector at him), 'strike' when he's reached (or time's
   * up with him still in reach, nothing solid between you), 'miss' when he
   * got away (thrown, launched, through a rift) or died on the way.
   */
  update(dt: number, feet: V3, dir: V3): LungeStep | null {
    this.cd = Math.max(0, this.cd - dt);
    this.showT = Math.max(0, this.showT - dt);
    const L = this.lunging;
    if (!L) return null;
    const e = L.enemy;
    L.t -= dt;
    const dx = e.pos.x - feet.x, dz = e.pos.z - feet.z;
    const d = Math.hypot(dx, dz);
    const rise = Math.abs(e.pos.y - feet.y);
    const away = !e.alive || e.state === 'launched' || d > Math.min(L.d0 + SLIP, BLADE.lunge + e.radius) || rise > (L.step ? BLADE.reachRise : BLADE.lungeRise);
    if (!away && L.t > 0 && d > e.radius + BLADE.lungeStop) {
      dir.set(dx / d, 0, dz / d);
      return 'go';
    }
    this.lunging = null;
    if (away || d > BLADE.reach + e.radius || rise > BLADE.reachRise) return 'miss';
    // walls and fences block the blade at the end of the run as at its start
    return this.blocked(_a.set(feet.x, feet.y + 1.1, feet.z), e.chest(_b)) ? 'miss' : 'strike';
  }

  /** How far the blade is out of the wrist (0..1): it snaps out, holds, slides back. */
  extension() {
    const s = this.showT;
    return s > 0 ? Math.min(1, (BLADE.show - s) / 0.05, s / 0.12) : 0;
  }

  /**
   * Nothing solid between you (fences too), and no open rift end on the way
   * (a step or a lunge would carry you into it); a lunge also needs a clear
   * run and a floor to it.
   */
  private clear(feet: V3, e: EnemyView, lunge: boolean) {
    if (this.blocked(_a.set(feet.x, feet.y + 1.1, feet.z), e.chest(_b))) return false;
    if (this.riftOnRun(feet, e)) return false;
    if (!lunge) return true;
    if (this.blocked(_a.set(feet.x, feet.y + 0.5, feet.z), _b.set(e.pos.x, e.pos.y + 0.5, e.pos.z))) return false;
    return this.h.world.groundAt((feet.x + e.pos.x) / 2, (feet.z + e.pos.z) / 2, 0.2, feet.y + 0.5) >= feet.y - 1;
  }

  /** An end you'd go through on the straight run to him: one standing across it, or a hole in the floor along it. */
  private riftOnRun(feet: V3, e: EnemyView) {
    const r = this.h.rifts;
    if (!r) return false;
    if (r.findCrossing(_a.set(feet.x, feet.y + 1, feet.z), _b.set(e.pos.x, feet.y + 1, e.pos.z), 0, true)) return true;
    // (short of his body: the floor he stands on is his business)
    const d = Math.hypot(e.pos.x - feet.x, e.pos.z - feet.z);
    const n = Math.ceil(d / 0.5);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if ((1 - k) * d < e.radius) break;
      if (r.holeAt(feet.x + (e.pos.x - feet.x) * k, feet.z + (e.pos.z - feet.z) * k, feet.y, 0.2, 0.6, true)) return true;
    }
    return false;
  }

  private blocked(from: THREE.Vector3, to: THREE.Vector3) {
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 0.05) return false;
    return !!this.h.world.raycast(from, _d.divideScalar(len), len - 0.05);
  }
}
