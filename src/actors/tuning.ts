import type { EnemyKind } from '../core/contracts';

/** Per-kind body and movement numbers (DESIGN §5). */
export interface KindTune {
  hp: number;
  radius: number;
  height: number;
  armored: boolean;
  /** Patrol / investigate speed (m/s). */
  walk: number;
  /** Combat move speed (m/s). */
  run: number;
  /** Vision range (m). */
  sight: number;
  /** Max turn rate (rad/s); 0 = smooth damped turning. */
  turn: number;
  /** Preferred distance band to the player in combat. */
  keepMin: number;
  keepMax: number;
  /** Carries a gun (weaponUp pose in combat). */
  gun: boolean;
}

export const KIND: Record<EnemyKind, KindTune> = {
  rifleman: { hp: 40, radius: 0.42, height: 1.8, armored: false, walk: 1.5, run: 3.4, sight: 32, turn: 0, keepMin: 10, keepMax: 20, gun: true },
  grenadier: { hp: 40, radius: 0.42, height: 1.8, armored: false, walk: 1.5, run: 3.2, sight: 32, turn: 0, keepMin: 12, keepMax: 22, gun: true },
  warden: { hp: 70, radius: 0.42, height: 1.8, armored: false, walk: 1.4, run: 2.6, sight: 32, turn: 2.2, keepMin: 0, keepMax: 2, gun: false },
  brute: { hp: 250, radius: 0.6, height: 2.2, armored: true, walk: 1.4, run: 3.2, sight: 32, turn: 0, keepMin: 0, keepMax: 2.2, gun: false },
  sniper: { hp: 40, radius: 0.42, height: 1.8, armored: false, walk: 0, run: 0, sight: 70, turn: 0, keepMin: 0, keepMax: 0, gun: true },
  jammer: { hp: 40, radius: 0.42, height: 1.8, armored: false, walk: 1.5, run: 4.2, sight: 32, turn: 0, keepMin: 10, keepMax: 18, gun: false },
  turret: { hp: 120, radius: 0.55, height: 1.5, armored: false, walk: 0, run: 0, sight: 30, turn: Math.PI / 3, keepMin: 0, keepMax: 0, gun: true },
  boss: { hp: 600, radius: 0.45, height: 1.9, armored: true, walk: 2, run: 4.5, sight: 45, turn: 0, keepMin: 8, keepMax: 14, gun: true },
};

/** Everything that shapes how Kessler fights. */
export const AI = {
  /** A shout reaches the squad, plus anyone in the zone within this radius with a clear line to it. */
  alertRadius: 15,
  /** Other squads closer than this hear the shout even through walls. */
  alertRadiusWalled: 8,
  /** Vision half-angle (±60°). */
  fovHalf: Math.PI / 3,
  crouchRange: 0.65,
  /** Unaware enemies see this fraction of their sight range (combat: 1.25x). */
  calmSight: 0.7,
  /** Always noticed this close, any direction. */
  nearSense: 2.5,
  /** LOS checks per enemy per second ≈ 1 / senseInterval. */
  senseInterval: 0.2,
  /** Detection meter per second at close / far range. */
  detectNear: 3,
  detectFar: 0.6,
  suspiciousAt: 0.3,
  maxThinking: 12,
  maxPathsPerFrame: 2,
  maxTokens: 2,
  edgeMargin: 1.5,
  witnessRange: 25,
  lookTime: 3,
  /** Nearby allies look at the exit a hit came out of. */
  lookRadius: 20,
  downedTime: 2.5,
  stunTime: 2.5,
  landStagger: 1,
  hurtStagger: 0.5,
  /** First shot delay after a zone goes hot (reaction time). */
  engageDelay: [0.7, 1.3] as const,
  barkGap: 1.4,
  rifle: { telegraph: 0.6, shots: 3, interval: 0.12, reload: [1.2, 2] as const, spread: 0.014, lead: 0.6, strafe: [2.5, 4] as const, warnOver: 0.85 },
  grenade: { every: 5, telegraph: 0.5, flight: 1, minRange: 5, maxRange: 28 },
  warden: { shieldHalf: Math.PI / 3, bashRange: 2, bashReach: 2.6, damage: 15, windup: 0.45, recover: 0.6, cooldown: 1.2, push: 7 },
  brute: { roar: 1, lockAt: 0.75, speed: 14, dist: 18, damage: 35, push: 10, cooldown: [5, 7] as const, minRange: 4, maxRange: 17, punch: 25, punchWindup: 0.5, wallDamage: 20 },
  sniper: { lockAt: 1, gap: [3, 4] as const },
  turret: { telegraph: 0.6, shots: 6, interval: 0.1, reload: [1.6, 2.2] as const, aimCone: 0.17 },
  jammer: { radius: 7, keep: 10 },
  boss: {
    shieldHalf: (70 * Math.PI) / 180,
    fan: 5,
    fanStep: 0.12,
    telegraph: 0.6,
    reload: [1.8, 2.4] as const,
    blinkEvery: 4,
    blinkWarn: 0.6,
    blinkPass: 0.4,
    summonEvery: 15,
    lobEvery: 5,
    shearDamage: 150,
    /** Most one impact / fall can take off him (crush: the roof load). */
    impactCap: 200,
    crushCap: 300,
    bladeDamage: 150,
    returnDelay: 0.35,
  },
} as const;
