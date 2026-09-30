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
  turret: { hp: 120, radius: 0.55, height: 1.5, armored: false, walk: 0, run: 0, sight: 30, turn: Math.PI / 3, keepMin: 0, keepMax: 0, gun: true },
  boss: { hp: 1800, radius: 0.45, height: 1.9, armored: true, walk: 2, run: 4.5, sight: 45, turn: 0, keepMin: 8, keepMax: 14, gun: true },
};

/** Everything that shapes how Kessler fights. */
export const AI = {
  /** A shout reaches the squad, plus anyone in the zone within this radius with a clear line to it. */
  alertRadius: 15,
  /** Other squads closer than this hear the shout even through walls. */
  alertRadiusWalled: 8,
  /** Vision half-angle (±60°). */
  fovHalf: Math.PI / 3,
  /** In combat he looks wider (±90°), not all round: get behind him and he has to turn. */
  combatFov: Math.PI / 2,
  crouchRange: 0.65,
  /** Unaware enemies see this fraction of their sight range (combat: all of it). */
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
  /** Landed off the walkable cells by up to this much (m), he walks back on; further (a crate top, a beam), he's stranded. */
  rejoinReach: 3,
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
  /** Eyes on you again after losing you for at least `reacquireGap` s: a beat before he can fire. */
  reacquire: [0.3, 0.7] as const,
  reacquireGap: 1,
  /** A mate's shout places you give or take this much (m): they come to look, they don't know. */
  reportError: 3,
  /** While he sees you he calls out where you are this often (s). */
  callout: 2.5,
  /** No sight, sound or word of you for this long (s; some men up to loseTrackVary more): he searches. */
  loseTrack: 5,
  loseTrackVary: 1.5,
  /**
   * The search: a careful walk (walk speed x pace) to where you were last known,
   * a look around (look s), then spots near it (near m). After `time` s (plus up
   * to `vary`) he stands down.
   */
  search: { pace: 1.3, look: [1.5, 2.5] as const, near: [2, 7] as const, time: 12, vary: 4 },
  /** After standing down: for `time` s he notices `detect` x faster and sees `sight` of his range. */
  alert: { time: 40, detect: 2, sight: 0.85 },
  /** After a shooter's turn, nobody new opens fire for this long (s): fire comes in waves. */
  volleyGap: [0.5, 1] as const,
  /** ...and one who has just taken his turn holds the next back this long (no two lasers at once). */
  volleyStagger: [0.25, 0.45] as const,
  barkGap: 1.4,
  /**
   * Roles (mission 1, DESIGN §5): every man holds a post. `leash`: how far from
   * it he goes in a fight (m, per role; a spawn may override it). Pushed past it
   * by more than `returnSlack` on his own floor, he walks back. Landed more than
   * `floorGap` (m, height) off his post's floor, stranded, or with no way back,
   * he fights from where he is (it becomes his post). An anchor with a fallback
   * goes to it once, when you come within `fallbackAt` in his sight. A squad is
   * pressed for `coverFor` s when one of its men is grabbed, hurt, falls back or
   * sees you within `pressedAt`: a mate who sees you takes the next turn to fire.
   * A holder calls "He's up here!" when you stand on his floor within `upHere`.
   */
  hold: {
    leash: { holder: 1.2, anchor: 6, pusher: 18 },
    returnSlack: 0.75,
    floorGap: 1.2,
    fallbackAt: 7,
    pressedAt: 6,
    coverFor: 2.5,
    upHere: 10,
    /** A walk that stepped him this recently (s) is under way (a path he stopped following isn't). */
    walking: 0.25,
  },
  /**
   * range: no burst beyond this (m), he closes in instead. After a burst: `shift` odds he moves
   * to a new spot first, `hesitate` odds he waits `pause` s longer, else he holds and re-aims.
   * Aim spread = (spread + perMetre x range + moveBlur x your speed) x a cold-aim factor
   * (coldAim, easing to 1 over `settle` s of clear, unbroken view).
   */
  rifle: {
    telegraph: 0.6,
    shots: 3,
    interval: 0.12,
    reload: [1.2, 2] as const,
    lead: 0.6,
    strafe: [2.5, 4] as const,
    range: 24,
    shift: 0.4,
    shiftTime: 0.8,
    hesitate: 0.25,
    pause: [1, 2.2] as const,
    spread: 0.008,
    perMetre: 0.0006,
    moveBlur: 0.004,
    coldAim: 1.8,
    settle: 3,
  },
  /** Fixed spread of machine and boss bolts. */
  gunSpread: 0.014,
  grenade: { every: 5, telegraph: 0.5, flight: 1, minRange: 5, maxRange: 28 },
  warden: { shieldHalf: Math.PI / 3, bashRange: 2, bashReach: 2.6, damage: 15, windup: 0.45, recover: 0.6, cooldown: 1.2, push: 7 },
  brute: { roar: 1, lockAt: 0.75, speed: 14, dist: 18, damage: 35, push: 10, cooldown: [5, 7] as const, minRange: 4, maxRange: 17, punch: 25, punchWindup: 0.5, wallDamage: 20 },
  sniper: { lockAt: 1, gap: [3, 4] as const },
  turret: { telegraph: 0.6, shots: 6, interval: 0.1, reload: [1.6, 2.2] as const, aimCone: 0.17 },
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
    /** A hidden-blade stab, at any time; then he blinks away at once (or throws you off at `throwOff` m/s). */
    bladeDamage: 150,
    throwOff: 9,
    returnDelay: 0.35,
  },
} as const;

/**
 * ONSLAUGHT (a COMBAT LAB variant, on top of PRECISION; DESIGN §14): the
 * enemy side that attacks. Readable, telegraphed, varied patterns answered
 * with the precision tools. Only men spawned with `SpawnDef.onslaught` read
 * any of this (actors/onslaught.ts); everyone else fights as in DESIGN §5.
 * Colours: RED wind-ups are melee (dodge them), ORANGE lasers are gunfire
 * (parry them).
 */
export const ONS = {
  /** At most this many men telegraphing or firing a gun at once. */
  maxShooters: 3,
  /** At most this many melee wind-ups / rushes committed at once. */
  maxMelee: 2,
  /** No two attacks land closer together than this (s): each is read, and answered, on its own. */
  hitGap: 0.3,
  /** Melee blows (strikes, bashes, rushes, slams, charges) take turns: one lands, the next no sooner than this (s). */
  meleeTurn: 2,
  /** After a shooter's turn the next may start this much sooner than in DESIGN §5 (s). */
  volleyGap: [0.25, 0.5] as const,
  /** A hit that doesn't kill: he reels this long (s; hitHead from above his shoulders, else hitChest). */
  hurtStagger: [0.2, 0.4] as const,
  /** Armour reels less. */
  armoredStagger: 0.2,
  stormer: {
    hp: 55,
    /** The sprint in (m/s), zig-zagging `zigAngle` rad either side of the line to you, a full swing every 2π/zigRate s. */
    sprint: 6.4,
    zigAngle: 0.6,
    zigRate: 4.2,
    /** He strikes from this far (m); the blow reaches this far (m, + your body). */
    strikeRange: 2.4,
    reach: 2.3,
    /** Red flash, then the blow (s); the last `commit` s of it he no longer turns (a dodge beats it). */
    windup: 0.45,
    commit: 0.18,
    /** A short step in with the blow (m/s, during the commit). */
    lunge: 4.5,
    damage: 25,
    push: 8,
    /** After a blow that landed, after a whiff (open: the blade finishes him) (s). */
    recover: 0.5,
    whiff: 0.8,
    /** Between blows (s): he circles you at `stalk` m meanwhile. */
    cooldown: [1.4, 2.4] as const,
    /** Waiting his turn he circles you this far off (m): the dash in to strike is a tell of its own. */
    stalk: 5.5,
    /** After a blow (and its recovery) he springs back out of reach this long (s), until `backTo` m off. */
    backOff: 0.8,
    backTo: 6.5,
    /** The first time he's close: this long circling you before his first blow (s). */
    sizeUp: [1.4, 2.4] as const,
  },
  suppressor: {
    hp: 120,
    /** Orange lock (s), then a long burst: `rounds` at `interval` s. */
    telegraph: 0.7,
    rounds: [8, 10] as const,
    interval: 0.13,
    /** His aim walks toward where you are at this speed (m/s): keep moving and it trails you. */
    track: 3.2,
    spread: 0.022,
    /** Between bursts (s). */
    reload: [2, 3] as const,
    /** He lays fire on your cover (no sight of you) this long after he last knew where you were (s). */
    coverFire: 6,
    range: 32,
    /** His chest plate: fire from within this of his front (rad) does this much of its damage (a PERFECT parry, a flank, a GRAB answer him). */
    plateHalf: (70 * Math.PI) / 180,
    plate: 0.4,
  },
  squad: {
    /** You've been in cover (no gun of theirs sees you, one had you just before) this long (s): pinned; still out of sight after `coverFor` s, you've moved on. */
    pinned: 2,
    coverFor: 8,
    /** Flankers go this far to your side (m), for at most `time` s; the next flank order waits `cooldown` s. */
    flankSide: 7,
    flankTime: 5,
    cooldown: 7,
    /** A stormer down: the suppressors lay fire for this long (s). */
    avenge: 3,
    /** A man who hasn't moved `stuckMove` m in `stuckTime` s (and isn't meant to stand) is unstuck. */
    stuckTime: 4,
    stuckMove: 0.8,
    /** Whoever can't see you is told where you are this often (s): nobody searches or stands down. */
    radio: 2.5,
    /** A gun blind to you this long (s) widens his ground by `widen` m (up to `maxLeash`): he comes out after you. */
    blind: 8,
    widen: 6,
    maxLeash: 40,
  },
  warden: {
    /** The shield rush: from `rushMin`..`rushMax` m, a red wind-up (s), then a run at `speed` m/s for up to `dist` m. */
    rushMin: 3.5,
    rushMax: 10,
    windup: 0.55,
    commit: 0.15,
    speed: 9,
    dist: 9,
    damage: 20,
    push: 10,
    /** Rushed past you / into a wall: open this long (s). */
    whiff: 1,
    cooldown: [2.8, 4] as const,
    /** The close bash (a red wind-up too). */
    bashWindup: 0.45,
  },
  brute: {
    /** The ground slam: within `range` m, a red ring for `windup` s, then everything within `radius` m on the ground. */
    range: 3.8,
    radius: 4.2,
    windup: 0.8,
    damage: 30,
    push: 7,
    lift: 6,
    recover: 1.2,
    cooldown: [3.5, 5] as const,
  },
};
