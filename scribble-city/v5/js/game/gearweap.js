import { damp, clamp } from '../core/util.js';
import { cops, cars, hold, wreck, onCar } from './gearfx.js';

// (ROADMAP 11.28) What fires (game/itemcat.js weapon) - beyond the machine gun and the cannon, which are
// game/fuse.js barrels: the Tesla coil, the saws at the wheels (and, game/gearweap2.js, the rest). Kits for
// game/gear.js; the fire button fires every weapon on the car.

const TESLA_R = [10, 18, 18];
const TESLA_S = [3, 4, 5];
const SAW_DMG = [45, 70, 95];
const _a = { x: 0, y: 0, z: 0 };

export const WEAP = {
  // ------------------------------------------------------------------ the Tesla coil
  // (fire: an arc of electricity from its ring to the nearest police car in reach - its engine dies for a
  // few seconds, its siren chokes; level 3 the arc jumps on to two more. Nothing in reach: it strikes the
  // road by it. Held: its ring glows, charging)
  tesla: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      s.charge = damp(s.charge || 0, K && K.fireHeld ? 1 : 0, 5, dt);
      s.flameOn = s.charge > 0.35 || g.time - (s.fired || -9) < 0.3;
      if (!K || !K.fire || s.cool > 0) return;
      if (!G.use(p)) return;
      s.fired = g.time;
      const top = p.n && p.n.top ? p.n.top : [0, 2.1, -0.25];
      onCar(v, top[0], top[1], top[2], _a);
      let from = [_a.x, _a.y, _a.z];
      const done = new Set();
      const links = lv >= 3 ? 3 : 1;
      let hit = 0;
      for (let k = 0; k < links; k++) {
        const R = k ? 13 : TESLA_R[lv - 1];
        const near = cops(G, from[0], from[2], R).filter((q) => !done.has(q.c));
        if (!near.length) break;
        const c = near[0].c;
        done.add(c);
        const to = [c.pos.x, (c.pos.y || 0) + 1.1, c.pos.z];
        g.fuse.zaps.push({ a: from, b: to, t0: g.time });
        g.fuse.zaps.push({ a: from, b: [to[0] + 0.4, to[1] - 0.3, to[2] - 0.3], t0: g.time + 0.05 });
        hold(G, c, 'emp', TESLA_S[lv - 1]);
        g.fx.sparks(to[0], to[1], to[2], 16, [0.6, 0.85, 1]);
        from = to;
        hit++;
      }
      // (men on foot after you, near it: knocked down)
      for (const e of g.enemies.list) {
        if (!e.alive || e.isMonster || !(e.hostile || e.faction === 'police')) continue;
        const d = Math.hypot(e.pos.x - _a.x, e.pos.z - _a.z);
        if (d > TESLA_R[lv - 1] * 0.8) continue;
        g.fuse.zaps.push({ a: [_a.x, _a.y, _a.z], b: [e.pos.x, e.pos.y + 1.1, e.pos.z], t0: g.time });
        g.enemies.damage(e, 'torso', 40, e.pos.clone(), e.pos.clone().sub(v.pos).normalize(), 'melee');
        hit++;
      }
      if (!hit) {
        // (nothing in reach: down into the road by it)
        const a = Math.random() * Math.PI * 2;
        g.fuse.zaps.push({ a: [_a.x, _a.y, _a.z], b: [_a.x + Math.cos(a) * 4, 0.05, _a.z + Math.sin(a) * 4], t0: g.time });
      }
      g.audio.play('laser', 0.7);
      g.camRig.addShake(0.12);
      if (hit) g.onCrime('shoot', v.pos.x, v.pos.z);
      s.hits = (s.hits || 0) + hit;
    },
  },

  // ------------------------------------------------------------------ saws at the wheels
  // (fire held: the blades swing out from the hubs and spin up - a police car you drive alongside has its
  // tyres cut: it spins off and is wrecked; a car of the city's is scored)
  saws: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      const want = K && K.fireHeld ? 1 : 0;
      s.out = damp(s.out || 0, want, want ? 9 : 4, dt);
      s.flameOn = false;
      if (s.out < 0.6) {
        if (s.cutting) {
          s.cutting = false;
          if (v.blades && v.blades.saw) v.blades = null;
        }
        return;
      }
      s.cutting = true;
      v.blades = { side: SAW_DMG[lv - 1], rear: false, saw: true };
      const reach = (p.n && p.n.xb ? p.n.xb : 1.1) + (p.n && p.n.R ? p.n.R : 0.4) + 0.5 + 0.15 * lv;
      const hl = v.halfLen || 2.3;
      s.spark = (s.spark || 0) - dt;
      for (const { c } of cars(G, v.pos.x, v.pos.z, hl + reach + 2.5, v)) {
        // (in its frame: alongside it - across within reach, along within its length)
        const dx = c.pos.x - v.pos.x;
        const dz = c.pos.z - v.pos.z;
        const cs = Math.cos(v.yaw);
        const sn = Math.sin(v.yaw);
        const ax = dx * cs - dz * sn;
        const az = dx * sn + dz * cs;
        const half = (c.spec && c.spec.W ? c.spec.W / 2 : 0.95);
        if (Math.abs(az) > hl + 0.6 || Math.abs(ax) > reach + half || Math.abs(ax) < 0.6) continue;
        if (c.sawn && g.time - c.sawn < 1.2) continue;
        c.sawn = g.time;
        const wx = v.pos.x + Math.sign(ax) * reach * 0.8 * cs;
        g.fx.sparks(c.pos.x - (dx > 0 ? 1 : -1) * 0.6, 0.4, c.pos.z, 14, [1, 0.85, 0.4]);
        g.audio.play('slash', 0.7);
        if (c.police && !c.wrecked) {
          hold(G, c, 'spin', 1.1, { w: Math.sign(ax) * 4.5, then: 'wreck' });
          s.cuts = (s.cuts || 0) + 1;
        } else if (g.damage && !g.classic) g.damage.hit(c, wx, 0.5, c.pos.z, 30 + 15 * lv);
      }
      if (s.spark <= 0) {
        s.spark = 0.12;
        for (const side of [1, -1]) {
          onCar(v, side * (p.n && p.n.xb ? p.n.xb : 1.1), 0.12, -(hl * 0.62), _a);
          if (Math.abs(v.speed || 0) > 3) g.fx.sparks(_a.x, 0.1, _a.z, 3, [1, 0.8, 0.35]);
        }
      }
    },
    animate(G, v, o, dt, s) {
      const ud = o.m.userData;
      for (const Gr of Object.values(ud.groups || {})) {
        if (Gr.kind !== 'spin') continue;
        if (Gr.base === undefined) Gr.base = Gr.node.position.x;
        const out = s.out || 0;
        Gr.node.position.x = Gr.base + (o.side || 1) * 0.12 * out;
        Gr.node.rotation.x -= dt * (3 + 45 * out) * Math.sign((v.speed || 0) + 0.01);
        const k = 0.72 + 0.28 * out;
        Gr.node.scale.set(1, k, k);
      }
    },
  },
};

export { clamp };
