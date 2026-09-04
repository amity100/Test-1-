import type { Entity } from './Entities';
import { WEAPONS } from './Weapons';
import type { Combat } from './Combat';

/** Shared weapon state machine for players and bots. */
export const WeaponLogic = {
  update(e: Entity, dt: number): void {
    if (e.fireCooldown > 0) e.fireCooldown -= dt;
    if (e.grenadeCooldown > 0) e.grenadeCooldown -= dt;
    if (e.grappleCooldown > 0) e.grappleCooldown -= dt;
    const w = e.weapon;
    if (e.reloading && w) {
      e.reloadTimer -= dt;
      if (e.reloadTimer <= 0) {
        const def = WEAPONS[w.id];
        const need = def.magSize - w.ammo;
        const take = Math.min(need, w.reserve);
        w.ammo += take;
        w.reserve -= take;
        e.reloading = false;
      }
    }
    // ADS blend
    const def = w ? WEAPONS[w.id] : null;
    const adsTarget = e.wantsAds && !e.reloading && w ? 1 : 0;
    const rate = def ? 1 / def.adsTime : 8;
    e.ads += (adsTarget - e.ads) * Math.min(1, dt * rate * 1.2);
    if (Math.abs(e.ads - adsTarget) < 0.01) e.ads = adsTarget;
    // Recoil recovery
    const rec = Math.exp(-8 * dt);
    e.recoilPitch *= rec;
    e.recoilYaw *= rec;
  },

  canFire(e: Entity): boolean {
    const w = e.weapon;
    return !!w && e.alive && !e.reloading && e.fireCooldown <= 0 && w.ammo > 0;
  },

  /** Fires if possible. Returns true when a shot happened. */
  tryFire(e: Entity, combat: Combat, now: number, spreadScale = 1): boolean {
    const w = e.weapon;
    if (!w) return false;
    const def = WEAPONS[w.id];
    if (!def.auto && !e.triggerReleased) return false;
    if (!WeaponLogic.canFire(e)) {
      if (w.ammo <= 0 && !e.reloading && w.reserve > 0) WeaponLogic.startReload(e);
      return false;
    }
    w.ammo--;
    e.fireCooldown = 60 / def.rpm;
    e.triggerReleased = false;
    e.lastShotTime = now;
    combat.fire(e, def, now, spreadScale);
    e.recoilPitch += def.recoil * (1 - e.ads * 0.45);
    e.recoilYaw += (Math.random() - 0.5) * 2 * def.recoilYaw;
    if (w.ammo <= 0 && w.reserve > 0) {
      // Auto reload after the shot cycle.
      e.reloading = true;
      e.reloadTimer = def.reloadTime + 0.15;
    }
    return true;
  },

  startReload(e: Entity): boolean {
    const w = e.weapon;
    if (!w || e.reloading) return false;
    const def = WEAPONS[w.id];
    if (w.ammo >= def.magSize || w.reserve <= 0) return false;
    e.reloading = true;
    e.reloadTimer = def.reloadTime;
    e.wantsAds = false;
    return true;
  },

  switchWeapon(e: Entity, index: number): boolean {
    if (index < 0 || index >= e.weapons.length || index === e.weaponIndex) return false;
    e.weaponIndex = index;
    e.reloading = false;
    e.fireCooldown = Math.max(e.fireCooldown, 0.25);
    return true;
  },

  reloadProgress(e: Entity): number {
    const w = e.weapon;
    if (!w || !e.reloading) return 0;
    const def = WEAPONS[w.id];
    return 1 - e.reloadTimer / def.reloadTime;
  },
};
