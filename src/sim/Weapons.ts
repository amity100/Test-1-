export type WeaponId = 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'sniper' | 'rocket';

export interface ProjectileDef {
  speed: number;
  gravity: number;
  splashRadius: number;
  splashDamage: number;
  lifetime: number;
}

export interface WeaponDef {
  id: WeaponId;
  nameKey: string;
  damage: number;
  headshotMult: number;
  rpm: number;
  auto: boolean;
  magSize: number;
  reserveStart: number;
  maxReserve: number;
  reloadTime: number;
  /** Hip-fire spread half-angle in degrees. */
  spread: number;
  adsSpread: number;
  pellets: number;
  range: number;
  /** Camera pitch kick per shot in degrees. */
  recoil: number;
  recoilYaw: number;
  /** Viewmodel kickback distance. */
  kick: number;
  adsZoom: number;
  adsTime: number;
  projectile?: ProjectileDef;
  tracer: boolean;
  /** Damage falloff start/end distances. */
  falloffStart: number;
  falloffEnd: number;
  falloffMin: number;
  /** Bot preference ranges. */
  idealRange: [number, number];
  sound: 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'sniper' | 'rocket';
}

/**
 * The arsenal of a gunpowder-era siege: slow, heavy shots that make walls, cover and traps matter.
 * The ids keep their old names so kits, bots and the loadout screen need no changes.
 */
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  /** Flintlock: a brace of pistols, two hard shots then a slow reload. */
  pistol: {
    id: 'pistol', nameKey: 'wPistol', damage: 42, headshotMult: 2.0, rpm: 55, auto: false, magSize: 2, reserveStart: 20, maxReserve: 36,
    reloadTime: 1.9, spread: 1.4, adsSpread: 0.5, pellets: 1, range: 90, recoil: 3.2, recoilYaw: 0.8, kick: 0.12, adsZoom: 0.85, adsTime: 0.14,
    tracer: false, falloffStart: 14, falloffEnd: 40, falloffMin: 0.5, idealRange: [3, 18], sound: 'pistol',
  },
  /** Repeating crossbow: a magazine of light bolts, fast and forgiving up close. */
  smg: {
    id: 'smg', nameKey: 'wSmg', damage: 17, headshotMult: 1.6, rpm: 300, auto: true, magSize: 10, reserveStart: 60, maxReserve: 100,
    reloadTime: 1.7, spread: 2.4, adsSpread: 1.0, pellets: 1, range: 90, recoil: 0.5, recoilYaw: 0.4, kick: 0.03, adsZoom: 0.88, adsTime: 0.12,
    tracer: true, falloffStart: 12, falloffEnd: 36, falloffMin: 0.5, idealRange: [3, 18], sound: 'smg',
  },
  /** Crossbow: the line weapon, one precise bolt at a time. */
  rifle: {
    id: 'rifle', nameKey: 'wRifle', damage: 50, headshotMult: 2.0, rpm: 70, auto: false, magSize: 4, reserveStart: 28, maxReserve: 48,
    reloadTime: 2.2, spread: 0.8, adsSpread: 0.15, pellets: 1, range: 160, recoil: 1.2, recoilYaw: 0.3, kick: 0.06, adsZoom: 0.72, adsTime: 0.16,
    tracer: true, falloffStart: 30, falloffEnd: 80, falloffMin: 0.6, idealRange: [8, 40], sound: 'rifle',
  },
  /** Hand cannon: a cloud of shot at the doorway. */
  shotgun: {
    id: 'shotgun', nameKey: 'wShotgun', damage: 13, headshotMult: 1.5, rpm: 32, auto: false, magSize: 2, reserveStart: 14, maxReserve: 24,
    reloadTime: 2.8, spread: 7, adsSpread: 5, pellets: 9, range: 45, recoil: 6, recoilYaw: 1.5, kick: 0.2, adsZoom: 0.9, adsTime: 0.14,
    tracer: false, falloffStart: 5, falloffEnd: 20, falloffMin: 0.25, idealRange: [1, 9], sound: 'shotgun',
  },
  /** Arquebus: one ball that drops a man from the far wall, then a long reload. */
  sniper: {
    id: 'sniper', nameKey: 'wSniper', damage: 96, headshotMult: 2.2, rpm: 28, auto: false, magSize: 1, reserveStart: 14, maxReserve: 24,
    reloadTime: 3.0, spread: 2.5, adsSpread: 0.12, pellets: 1, range: 400, recoil: 5.5, recoilYaw: 1.2, kick: 0.24, adsZoom: 0.55, adsTime: 0.26,
    tracer: true, falloffStart: 150, falloffEnd: 320, falloffMin: 0.8, idealRange: [20, 100], sound: 'sniper',
  },
  /** Hand mortar: lobs a bomb in an arc over the wall. */
  rocket: {
    id: 'rocket', nameKey: 'wRocket', damage: 30, headshotMult: 1.0, rpm: 30, auto: false, magSize: 1, reserveStart: 4, maxReserve: 8,
    reloadTime: 3.0, spread: 0.5, adsSpread: 0.3, pellets: 1, range: 200, recoil: 4, recoilYaw: 1, kick: 0.28, adsZoom: 0.8, adsTime: 0.18,
    projectile: { speed: 30, gravity: 9, splashRadius: 4.2, splashDamage: 115, lifetime: 6 },
    tracer: false, falloffStart: 1000, falloffEnd: 2000, falloffMin: 1, idealRange: [12, 45], sound: 'rocket',
  },
};

export const WEAPON_IDS: WeaponId[] = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'rocket'];
export const PRIMARY_IDS: WeaponId[] = ['smg', 'rifle', 'shotgun', 'sniper', 'rocket'];

/** Fire pot: a clay pot of pitch that shatters, burns whoever it splashes and keeps them burning. */
export const GRENADE = {
  fuse: 1.8,
  speed: 16,
  gravity: 20,
  bounce: 0.15,
  splashRadius: 3.8,
  splashDamage: 55,
  /** Seconds the splashed keep burning. */
  burn: 3.5,
  startCount: 2,
  maxCount: 4,
};

export const GRAPPLE = {
  range: 38,
  pullSpeed: 24,
  cooldown: 2.5,
  maxTime: 3.2,
  detachDistance: 1.6,
};

export function damageAtDistance(def: WeaponDef, dist: number): number {
  if (dist <= def.falloffStart) return def.damage;
  if (dist >= def.falloffEnd) return def.damage * def.falloffMin;
  const t = (dist - def.falloffStart) / (def.falloffEnd - def.falloffStart);
  return def.damage * (1 - t * (1 - def.falloffMin));
}
