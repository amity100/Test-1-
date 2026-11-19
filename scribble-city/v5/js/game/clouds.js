import { clamp } from '../core/util.js';
// (ROADMAP 28) Clouds nobody sees through, in the game itself: a can of graphite smoke thrown (game/weapons.js
// smokeBurst), the smoke screen out of a car's tail (game/gearguard.js). The lab has had them in its signs
// (game/signs.js puff, blocks); this is the same cloud without the rest of the lab - the police and the gangs lose sight
// of whoever a cloud stands between them and (game/enemies.js, game/police.js), and inside one you are hidden
// (world.hideSpots, as behind a bush).

const CLOUD_R = 5;
const INK = [0.3, 0.3, 0.34];

export class Clouds {
  constructor(game) {
    this.game = game;
    this.clouds = [];
  }

  puff(x, z, r = CLOUD_R, T = 9) {
    const game = this.game;
    const fx = game.fx;
    const p = game.player;
    const hs = game.world.hideSpots;
    // (not too many at once: the oldest goes first)
    if (this.clouds.length >= 8) this.drop(this.clouds[0]);
    const spot = { x, z, r, kind: 'ink', until: game.time + T };
    if (hs) hs.push(spot);
    this.clouds.push(spot);
    const n = Math.round(clamp(18 * (r / CLOUD_R) * (r / CLOUD_R), 6, 18));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r * 0.85;
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + Math.cos(a) * d, 0.6 + Math.random() * (0.6 + r * 0.4), z + Math.sin(a) * d, {
        size: (2.6 + Math.random() * 1.6) * Math.min(1, 0.4 + r / CLOUD_R), grow: 0.25, life: T - 0.5 + Math.random(), vy: 0.04, alpha: 0.93, tint: INK, fadeIn: 0.15,
      });
    }
    // (those who had you in their sights lose you)
    for (const e of game.enemies.list) {
      if (e.alive && this.blocks(e.pos.x, e.pos.z, p.pos.x, p.pos.z)) {
        e.sees = false;
        e.aimT = 0;
      }
    }
    return spot;
  }

  drop(c) {
    const i = this.clouds.indexOf(c);
    if (i >= 0) this.clouds.splice(i, 1);
    const hs = this.game.world.hideSpots;
    const k = hs ? hs.indexOf(c) : -1;
    if (k >= 0) hs.splice(k, 1);
  }

  // does a cloud stand between a and b (on the ground's plane)
  blocks(ax, az, bx, bz) {
    for (const c of this.clouds) {
      const dx = bx - ax;
      const dz = bz - az;
      const L2 = dx * dx + dz * dz || 1e-9;
      const t = clamp(((c.x - ax) * dx + (c.z - az) * dz) / L2, 0, 1);
      if (Math.hypot(ax + dx * t - c.x, az + dz * t - c.z) < c.r * 0.9) return true;
    }
    return false;
  }

  // gone when their time is up
  update() {
    const t = this.game.time;
    for (let i = this.clouds.length - 1; i >= 0; i--) if (t >= this.clouds[i].until) this.drop(this.clouds[i]);
  }
}
