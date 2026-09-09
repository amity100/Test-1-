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

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', nameKey: 'wPistol', damage: 26, headshotMult: 2.0, rpm: 380, auto: false, magSize: 12, reserveStart: 72, maxReserve: 120,
    reloadTime: 1.2, spread: 1.2, adsSpread: 0.35, pellets: 1, range: 160, recoil: 1.6, recoilYaw: 0.4, kick: 0.06, adsZoom: 0.85, adsTime: 0.12,
    tracer: true, falloffStart: 25, falloffEnd: 70, falloffMin: 0.6, idealRange: [4, 30], sound: 'pistol',
  },
  smg: {
    id: 'smg', nameKey: 'wSmg', damage: 15, headshotMult: 1.6, rpm: 880, auto: true, magSize: 32, reserveStart: 128, maxReserve: 224,
    reloadTime: 1.7, spread: 2.6, adsSpread: 1.1, pellets: 1, range: 120, recoil: 0.7, recoilYaw: 0.5, kick: 0.04, adsZoom: 0.85, adsTime: 0.12,
    tracer: true, falloffStart: 15, falloffEnd: 45, falloffMin: 0.5, idealRange: [3, 20], sound: 'smg',
  },
  rifle: {
    id: 'rifle', nameKey: 'wRifle', damage: 23, headshotMult: 1.8, rpm: 620, auto: true, magSize: 30, reserveStart: 120, maxReserve: 210,
    reloadTime: 2.0, spread: 1.6, adsSpread: 0.45, pellets: 1, range: 220, recoil: 1.0, recoilYaw: 0.35, kick: 0.05, adsZoom: 0.72, adsTime: 0.16,
    tracer: true, falloffStart: 35, falloffEnd: 90, falloffMin: 0.65, idealRange: [8, 45], sound: 'rifle',
  },
  shotgun: {
    id: 'shotgun', nameKey: 'wShotgun', damage: 11, headshotMult: 1.5, rpm: 75, auto: false, magSize: 6, reserveStart: 30, maxReserve: 48,
    reloadTime: 2.4, spread: 6.5, adsSpread: 4.5, pellets: 9, range: 60, recoil: 4.5, recoilYaw: 1.2, kick: 0.16, adsZoom: 0.9, adsTime: 0.14,
    tracer: false, falloffStart: 6, falloffEnd: 22, falloffMin: 0.25, idealRange: [1, 10], sound: 'shotgun',
  },
  sniper: {
    id: 'sniper', nameKey: 'wSniper', damage: 88, headshotMult: 2.2, rpm: 45, auto: false, magSize: 5, reserveStart: 25, maxReserve: 40,
    reloadTime: 2.8, spread: 3.0, adsSpread: 0.05, pellets: 1, range: 500, recoil: 5.0, recoilYaw: 1.0, kick: 0.22, adsZoom: 0.28, adsTime: 0.28,
    tracer: true, falloffStart: 200, falloffEnd: 400, falloffMin: 0.8, idealRange: [25, 120], sound: 'sniper',
  },
  rocket: {
    id: 'rocket', nameKey: 'wRocket', damage: 30, headshotMult: 1.0, rpm: 40, auto: false, magSize: 1, reserveStart: 4, maxReserve: 8,
    reloadTime: 2.6, spread: 0.3, adsSpread: 0.2, pellets: 1, range: 300, recoil: 3.5, recoilYaw: 0.8, kick: 0.25, adsZoom: 0.8, adsTime: 0.18,
    projectile: { speed: 38, gravity: 3.5, splashRadius: 4.2, splashDamage: 115, lifetime: 6 },
    tracer: false, falloffStart: 1000, falloffEnd: 2000, falloffMin: 1, idealRange: [10, 50], sound: 'rocket',
  },
};

export const WEAPON_IDS: WeaponId[] = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'rocket'];
export const PRIMARY_IDS: WeaponId[] = ['smg', 'rifle', 'shotgun', 'sniper', 'rocket'];

export const GRENADE = {
  fuse: 2.6,
  speed: 17,
  gravity: 22,
  bounce: 0.45,
  splashRadius: 4.6,
  splashDamage: 110,
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
