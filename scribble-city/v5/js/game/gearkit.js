import { damp } from '../core/util.js';
import { hold } from './gearfx.js';
import { MOVE } from './gearmove.js';
import { MOVE2 } from './gearmove2.js';
import { WEAP } from './gearweap.js';
import { WEAP2 } from './gearweap2.js';
import { GUARD } from './gearguard.js';
import { GUARD2 } from './gearguard2.js';

// (ROADMAP 11.28) Every thing of the pen's kit (game/gear.js): what moves (game/gearmove.js,
// game/gearmove2.js), what fires (game/gearweap.js, game/gearweap2.js), what keeps the car whole
// (game/gearguard.js, game/gearguard2.js) - and how a police car is held by them (game/traffic.js updateCar asks game/gear.js
// holdCar): spun off the road, stopped dead, under a net, towed on a harpoon's cable.

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const HELD = {
  hold(G, c, H, dt) {
    const g = G.game;
    if (H.kind === 'spin') {
      // (round it goes, sliding on the way it went, slowing)
      if (H.dir === undefined) H.dir = c.yaw;
      c.yaw += (H.w || 5) * dt * Math.max(0.2, 1 - (g.time - H.t0) / Math.max(0.3, H.until - H.t0));
      c.speed = damp(c.speed || 0, 0, 2.2, dt);
      c.pos.x += Math.sin(H.dir) * c.speed * dt;
      c.pos.z += Math.cos(H.dir) * c.speed * dt;
      if (Math.random() < dt * 8) g.fx.smoke(c.pos.x, 0.3, c.pos.z, 0.8);
      return true;
    }
    if (H.kind === 'emp' || H.kind === 'net' || H.kind === 'stop') {
      // (its engine dead, or under a net: it rolls to a stop where it is)
      c.speed = damp(c.speed || 0, 0, H.kind === 'net' ? 5 : 3, dt);
      c.pos.x += Math.sin(c.yaw) * c.speed * dt;
      c.pos.z += Math.cos(c.yaw) * c.speed * dt;
      if (H.kind === 'emp') c.siren = Math.random() < 0.05;
      return true;
    }
    if (H.kind === 'tow') {
      // (on the harpoon's cable: dragged along behind your car at the cable's length, its nose to you)
      const v = H.v;
      if (!v || v.dead || !g.player.inVehicle) {
        c.gear = null;
        return false;
      }
      const dx = c.pos.x - v.pos.x;
      const dz = c.pos.z - v.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = Math.abs(v.speed || 0);
      // (level 2: a hard turn at speed whips it round on the cable - off it goes, spinning, wrecked)
      const yr = H.py === undefined ? 0 : Math.abs(wrap(v.yaw - H.py)) / Math.max(dt, 1e-4);
      H.py = v.yaw;
      if (H.lv >= 2 && sp > 9 && yr > 1.1 && g.time - H.t0 > 0.5) {
        const side = Math.sign(wrap(v.yaw - Math.atan2(-dx, -dz))) || 1;
        hold(G, c, 'spin', 1.5, { w: side * 8, dir: Math.atan2(dx, dz) + side * 1.3, then: 'wreck' });
        c.speed = sp * 1.15;
        g.fx.sparks(c.pos.x, (c.pos.y || 0) + 0.6, c.pos.z, 14, [1, 0.85, 0.4]);
        g.audio.play('rubber', 0.8);
        g.camRig.addShake(0.2);
        return true;
      }
      if (d > H.len) {
        c.pos.x = v.pos.x + (dx / d) * H.len;
        c.pos.z = v.pos.z + (dz / d) * H.len;
      }
      c.yaw += wrap(Math.atan2(-dx, -dz) - c.yaw) * Math.min(1, 6 * dt);
      c.speed = d >= H.len - 0.2 ? sp : damp(c.speed || 0, 0, 3, dt);
      if (d < H.len - 0.2) {
        c.pos.x += Math.sin(c.yaw) * c.speed * dt;
        c.pos.z += Math.cos(c.yaw) * c.speed * dt;
      }
      if (sp > 6 && Math.random() < dt * 10) g.fx.smoke(c.pos.x, 0.25, c.pos.z, 0.6);
      return true;
    }
    return false;
  },
};

export const KIT = { ...MOVE, ...MOVE2, ...WEAP, ...WEAP2, ...GUARD, ...GUARD2, held: HELD };

// (the kits that come later in this file's gathering: what fires and what keeps it whole)
export function addKits(more) {
  Object.assign(KIT, more);
}
