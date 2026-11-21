import { GRADE } from './weapons.js';

// (ROADMAP 6.6, not with ?classic) Handling the arsenal:
//   - magazines: a gun holds so many shots before it has to be reloaded (R, or by itself once it
//     is empty, a moment with the gun down); the rest wait in your pockets. The HUD shows both.
//   - the weapon wheel (ui/wheel.js)
//   - the stationery shops (Paper Moon, Moonlight Books) refill the ink, lead and rubber of every
//     weapon you drew (game/streetlife.js)

// shots in a magazine (a weapon not here has none: the throwing things, the beam, melee)
export const MAGS = { pen: 8, paint: 30, rifle: 10, bazooka: 1, m4: 30, shotgun: 6, stapler: 40, planes: 3, glue: 10, minigun: 150, tippex: 60, erasermg: 60, paintmg: 60 };
// seconds to reload (1.4 when not here)
const RELOAD_T = { bazooka: 2.2, shotgun: 2.0, minigun: 3.0, planes: 2.4, rifle: 1.6 };

export class Arsenal {
  constructor(game) {
    this.game = game;
    this.reloadT = 0;
    this.slot = null;
    this.told = false;
    this.stats = { reloads: 0, refills: 0 };
  }

  magOf(slot) {
    return MAGS[slot.def.id] || 0;
  }

  // a gun in the hands for the first time: its magazine full
  arm(slot) {
    const m = this.magOf(slot);
    if (m && slot.ammo !== Infinity && slot.mag === undefined) slot.mag = Math.min(m, slot.ammo);
  }

  get reloading() {
    return this.reloadT > 0;
  }

  // can it fire (game/weapons.js)? not while it reloads, not with its magazine empty
  ready(slot) {
    if (slot.mag === undefined) return true;
    return !(this.reloadT > 0 && this.slot === slot) && slot.mag > 0;
  }

  // a shot (game/weapons.js): out of the magazine; the last one - reload
  fired(slot) {
    if (slot.mag === undefined) return;
    slot.mag = Math.max(0, slot.mag - 1);
    if (slot.mag <= 0 && slot.ammo > 0) this.reload(slot);
  }

  reload(slot) {
    const m = this.magOf(slot);
    if (!m || slot.mag === undefined || this.reloadT > 0 || slot.mag >= Math.min(m, slot.ammo)) return false;
    this.slot = slot;
    this.reloadT = RELOAD_T[slot.def.id] || 1.4;
    this.game.audio.play('click', 0.6);
    this.stats.reloads++;
    this.game.hud.updateWeapon();
    if (!this.told && !this.game.touch) {
      this.told = true;
      this.game.hud.toast('טוענים… (R טוען לפני שהמחסנית נגמרת)', 'info', 2.4);
    }
    return true;
  }

  update(dt) {
    const game = this.game;
    const W = game.weapons;
    const slot = W.current;
    this.arm(slot);
    // (never more in the magazine than there is: a save's ammo comes back after the gun, game/save.js)
    if (slot.mag !== undefined && slot.mag > slot.ammo) slot.mag = slot.ammo;
    if (this.reloadT > 0) {
      if (this.slot !== slot) {
        // (put away: the reload is off)
        this.reloadT = 0;
        this.slot = null;
      } else {
        this.reloadT -= dt;
        if (this.reloadT <= 0) {
          this.reloadT = 0;
          this.slot = null;
          slot.mag = Math.min(this.magOf(slot), slot.ammo);
          game.audio.play('switch', 0.5);
          game.hud.updateWeapon();
        }
      }
    }
    if (game.input.wasPressed('KeyR') && game.player.mode === 'foot' && !game.player.inVehicle) this.reload(slot);
  }

  // what the HUD says of a gun's shots (ui/hud.js): the magazine / the rest
  ammoText(slot) {
    if (slot.mag === undefined) return null;
    if (slot.mag > slot.ammo) slot.mag = slot.ammo;
    if (this.reloadT > 0 && this.slot === slot) return 'טוענים…';
    const rest = slot.ammo - slot.mag;
    return `${slot.mag} / ${rest}${slot.mag < this.magOf(slot) && rest > 0 && !this.game.touch ? ' · R לטעון' : ''}`;
  }

  // anything to refill? (the stationery shop asks only then: game/money.js)
  wants() {
    for (const s of this.game.weapons.slots) {
      const d = s.def;
      if (d.ammo && s.ammo !== Infinity && s.ammo < Math.round(d.ammo * GRADE[s.grade].ammo)) return true;
      if (d.uses && s.uses < d.uses) return true;
    }
    return false;
  }

  // the stationery shop's refill (game/streetlife.js): every weapon you carry, full again
  refill() {
    const W = this.game.weapons;
    let n = 0;
    for (const s of W.slots) {
      const d = s.def;
      if (d.ammo && s.ammo !== Infinity) {
        const full = Math.round(d.ammo * GRADE[s.grade].ammo);
        if (s.ammo < full) {
          s.ammo = full;
          n++;
        }
        if (s.mag !== undefined) s.mag = Math.min(this.magOf(s), s.ammo);
      }
      if (d.uses && s.uses < d.uses) {
        s.uses = d.uses;
        n++;
      }
    }
    this.reloadT = 0;
    this.slot = null;
    this.stats.refills++;
    this.game.hud.updateWeapon();
    return n;
  }
}
