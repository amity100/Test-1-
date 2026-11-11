import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { Kit, itemMats, linC } from './items.js';
import { cops, cars, hold, wreck, blast, ring, onCar } from './gearfx.js';

// (ROADMAP 11.28) More of what fires (game/gearweap.js has the Tesla coil and the saws): the machine gun's
// and the cannon's levels, the missiles, the flamethrower, the mines, the harpoon, the net, the wrecking
// ball, the drone - kits for game/gear.js. What fires, fires paint or Tipp-Ex.

const _a = { x: 0, y: 0, z: 0 };
const _b = { x: 0, y: 0, z: 0 };
const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

// the police car ahead to aim at: in a cone round where the car points (cos: its half-width), within r
function ahead(G, v, r, cos = 0.7, skip = null) {
  const fx = Math.sin(v.yaw) * (Math.sign(v.speed || 1) || 1);
  const fz = Math.cos(v.yaw) * (Math.sign(v.speed || 1) || 1);
  let best = null;
  let bs = -Infinity;
  for (const { c, d } of cops(G, v.pos.x, v.pos.z, r)) {
    if (skip && skip.has(c)) continue;
    const k = ((c.pos.x - v.pos.x) * fx + (c.pos.z - v.pos.z) * fz) / (d || 1);
    if (k < cos) continue;
    const s = k * 2 - d / r;
    if (s > bs) {
      bs = s;
      best = c;
    }
  }
  // (none ahead: the nearest at all, close)
  if (!best) {
    const n = cops(G, v.pos.x, v.pos.z, Math.min(r, 25)).filter((q) => !skip || !skip.has(q.c));
    if (n.length) best = n[0].c;
  }
  return best;
}

// a small model of what is laid or flies (a mine on the road): a kit's mesh in the scene
function meshOf(G, build) {
  const Kt = new Kit();
  build(Kt, itemMats(), linC);
  const m = Kt.build({ seed: 0.3 });
  const root = new THREE.Group();
  root.add(m);
  G.game.scene.add(root);
  return root;
}

export const WEAP2 = {
  // ------------------------------------------------------------------ the machine gun's levels
  // (level 2 two barrels: twice the rate; level 3 drawn with three barrels or more a minigun - game/
  // itemdesign.js - and the rest a pair)
  mg: {
    apply(G, v, p, H, fz, lv) {
      if (p.gun && p.n && p.n.twin) p.gun = { ...p.gun, reload: p.gun.reload * 0.55 };
      if (p.gun) p.gun = { ...p.gun, dmg: Math.round(p.gun.dmg * [1, 1.15, 1.3][lv - 1]) };
    },
  },
  // (level 2 its Tipp-Ex wipes a wider round; level 3 it loads faster too)
  cannon: {
    apply(G, v, p, H, fz, lv) {
      if (!p.gun) return;
      p.gun = { ...p.gun, blast: (p.gun.blast || 4) * (lv >= 2 ? 1.45 : 1), reload: p.gun.reload * (lv >= 3 ? 0.6 : 1) };
    },
  },

  // ------------------------------------------------------------------ the missiles
  // (a police car ahead in reach is locked on - its mark; fire: a missile off the rails after it, a trail
  // of smoke, a burst of paint where it gets it. Level 2 three at once; level 3 four, each splitting in
  // three on its way)
  missiles: {
    update(G, v, p, dt, s, K, lv) {
      s.lockT = (s.lockT || 0) - dt;
      if (s.lockT <= 0) {
        s.lockT = 0.2;
        s.target = ahead(G, v, 80, 0.55);
      }
      if (!K || !K.fire || !G.use(p)) return;
      const g = G.game;
      const n = [1, 3, 4][lv - 1];
      const used = new Set();
      for (let i = 0; i < n; i++) {
        const tg = i === 0 ? s.target : ahead(G, v, 80, 0.4, used) || s.target;
        if (tg) used.add(tg);
        const side = i % 2 ? -1 : 1;
        onCar(v, side * (0.11 + (i >> 1) * 0.17), (p.n && p.n.top ? p.n.top[1] : 2) - 0.1, 0.4, _a);
        G.live.push({ kit: 'missile', x: _a.x, y: _a.y, z: _a.z, vx: Math.sin(v.yaw) * (14 + (v.speed || 0)), vy: 4, vz: Math.cos(v.yaw) * (14 + (v.speed || 0)), t0: g.time + i * 0.14, target: tg, lv, split: lv >= 3 });
      }
      g.audio.play('bazooka', 0.75);
      g.onCrime('shoot', v.pos.x, v.pos.z);
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (gr && gr.ammo) gr.ammo.node.visible = (s.cool || 0) <= 0.15;
    },
    drawOn(G, v, p, s, fr) {
      const c = s.target;
      if (!c || c.wrecked || c.gone) return;
      const t = G.game.time;
      const r = 2.4 + Math.sin(t * 8) * 0.2;
      ring(fr, c.pos.x, (c.pos.y || 0) + 0.15, c.pos.z, r, [1, 0.2, 0.2], 3, 8400, 0.9, 24);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + t * 1.5;
        fr.lineXYZ(c.pos.x + Math.cos(a) * r, (c.pos.y || 0) + 0.15, c.pos.z + Math.sin(a) * r, c.pos.x + Math.cos(a) * (r + 0.8), (c.pos.y || 0) + 0.15, c.pos.z + Math.sin(a) * (r + 0.8), [1, 0.2, 0.2], 3, 8430 + k, 0.9, 0.004, 0);
      }
    },
  },
  missile: {
    step(G, o, dt) {
      const g = G.game;
      if (g.time < o.t0) return false;
      const t = g.time - o.t0;
      const sp = Math.hypot(o.vx, o.vy, o.vz) || 1;
      const want = Math.min(42, sp + 40 * dt);
      // (after its target: turned toward it, so far a second)
      const tg = o.target;
      if (tg && !tg.gone && t > 0.15) {
        _d.set(tg.pos.x - o.x, (tg.pos.y || 0) + 0.8 - o.y, tg.pos.z - o.z);
        const dist = _d.length();
        _d.normalize();
        _v.set(o.vx, o.vy, o.vz).normalize();
        const k = Math.min(1, (o.split === false ? 4 : 2.8) * dt);
        _v.lerp(_d, k).normalize();
        o.vx = _v.x * want;
        o.vy = _v.y * want;
        o.vz = _v.z * want;
        if (dist < 2.2) return this.hit(G, o);
        // (level 3: half way, in three)
        if (o.split && t > 0.45 && dist > 10) {
          o.split = false;
          const used = new Set([tg]);
          for (let i = 0; i < 2; i++) {
            const c2 = cops(G, tg.pos.x, tg.pos.z, 30).find((q) => !used.has(q.c));
            const nt = c2 ? c2.c : tg;
            used.add(nt);
            G.live.push({ kit: 'missile', x: o.x, y: o.y, z: o.z, vx: o.vx + (i ? 6 : -6), vy: o.vy + 2, vz: o.vz, t0: g.time, target: nt, lv: o.lv, split: false });
          }
          g.audio.play('pop', 0.5);
        }
      } else {
        o.vx *= 1 + dt * 0.5;
        o.vz *= 1 + dt * 0.5;
        o.vy -= 4 * dt;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.z += o.vz * dt;
      o.puff = (o.puff || 0) - dt;
      if (o.puff <= 0) {
        o.puff = 0.035;
        g.fx.smoke(o.x - o.vx * 0.02, o.y, o.z - o.vz * 0.02, 0.45);
      }
      const gy = groundHeight(o.x, o.z) * 0.5;
      if (o.y < gy + 0.2 || t > 4.5 || g.world.collision.pointInside(o.x, o.y, o.z, 0.2)) return this.hit(G, o);
      return false;
    },
    hit(G, o) {
      blast(G, o.x, o.y, o.z, o.lv >= 2 ? 5.5 : 4.5, 70, { color: [0.95, 0.3, 0.35] });
      return true;
    },
    draw(G, o, fr) {
      if (G.game.time < o.t0) return;
      const sp = Math.hypot(o.vx, o.vy, o.vz) || 1;
      const ux = o.vx / sp;
      const uy = o.vy / sp;
      const uz = o.vz / sp;
      fr.lineXYZ(o.x, o.y, o.z, o.x - ux * 0.7, o.y - uy * 0.7, o.z - uz * 0.7, [0.92, 0.92, 0.9], 6, 8500, 1, 0.004, 0);
      fr.lineXYZ(o.x, o.y, o.z, o.x + ux * 0.18, o.y + uy * 0.18, o.z + uz * 0.18, [0.9, 0.15, 0.15], 6, 8501, 1, 0.004, 0);
      fr.lineXYZ(o.x - ux * 0.7, o.y - uy * 0.7, o.z - uz * 0.7, o.x - ux * 1.2, o.y - uy * 1.2, o.z - uz * 1.2, [1, 0.6, 0.15], 4, 8502, 0.9, 0.004, 0);
    },
  },

  // ------------------------------------------------------------------ the flamethrower
  // (fire held: a jet of fire out of the nozzle - game/fuse.js flame - level 2 longer, level 3 wider)
  flamer: {
    apply(G, v, p, H, fz, lv) {
      fz.flame = { range: [8, 12, 16][lv - 1], cool: 0, wide: lv >= 3 };
    },
    update(G, v, p, dt, s, K) {
      s.flameOn = !!(K && K.fireHeld);
    },
  },

  // ------------------------------------------------------------------ the mines
  // (fire: a mine out of the hatch onto the road behind - armed a moment after; a police car over it: a
  // burst of Tipp-Ex under it. Level 2 bigger; level 3 three in a fan)
  mines: {
    update(G, v, p, dt, s, K, lv) {
      if (!K || !K.fire || !G.use(p)) return;
      const g = G.game;
      const n = lv >= 3 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const side = (i - (n - 1) / 2) * 1.4;
        onCar(v, side, 0.2, -(v.halfLen || 2.3) - 0.6, _a);
        G.live.push({ kit: 'mine', x: _a.x, y: groundHeight(_a.x, _a.z) * 0.5 + 0.05, z: _a.z, t0: g.time, lv, r: lv >= 2 ? 7 : 5 });
      }
      g.audio.play('clank', 0.6);
    },
  },
  mine: {
    step(G, o) {
      const g = G.game;
      if (!o.model) {
        o.model = meshOf(G, (Kt, M, C) => {
          Kt.cyl(M.paint, 0.3, 0.27, 0, 0.09, C(0.34, 0.38, 0.27), { axis: 'y' });
          Kt.cyl(M.metal, 0.12, 0.09, 0.09, 0.14, C(0.25, 0.26, 0.28), { axis: 'y' });
        });
        o.model.position.set(o.x, o.y, o.z);
      }
      const t = g.time - o.t0;
      if (t > 0.7) {
        for (const { c } of cops(G, o.x, o.z, 2.6)) {
          blast(G, o.x, o.y, o.z, o.r, 80, { color: [1, 1, 0.98] });
          void c;
          return true;
        }
      }
      return t > 60;
    },
    gone(G, o) {
      if (o.model && o.model.parent) o.model.parent.remove(o.model);
    },
    draw(G, o, fr) {
      // (its light: blinking red once armed)
      const t = G.game.time - o.t0;
      if (t > 0.7 && Math.sin(t * 9) > 0.3) fr.lineXYZ(o.x, o.y + 0.16, o.z, o.x, o.y + 0.24, o.z, [1, 0.15, 0.1], 7, 8550, 1, 0.004, 0);
    },
  },

  // ------------------------------------------------------------------ the harpoon
  // (fire: the harpoon flies at the police car ahead on its cable and bites - level 1 it is towed along
  // behind you; level 2 a hard turn whips it round into whatever is there; level 3 two of them at once.
  // Fire again, or a few seconds: the cable lets go)
  harpoon: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      if (!K || !K.fire) return;
      if (s.lines && s.lines.length && g.time - s.shot > 0.4) {
        for (const L of s.lines) L.done = true;
        s.lines = [];
        g.audio.play('rubber', 0.5);
        return;
      }
      if (!G.use(p)) return;
      s.shot = g.time;
      const n = lv >= 3 ? 2 : 1;
      const used = new Set();
      s.lines = [];
      for (let i = 0; i < n; i++) {
        const c = ahead(G, v, 40, 0.75, used);
        if (c) used.add(c);
        const L = { kit: 'tether', v, c, side: i ? -1 : 1, t0: g.time, lv, from: p.n && p.n.muzzle ? p.n.muzzle : [0, 1.4, 2.4] };
        s.lines.push(L);
        G.live.push(L);
      }
      g.audio.play('swish', 0.8);
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (gr && gr.spear) gr.spear.node.visible = !(s.lines && s.lines.length);
    },
  },
  tether: {
    step(G, o, dt) {
      const g = G.game;
      const v = o.v;
      const c = o.c;
      const t = g.time - o.t0;
      if (o.done || v.dead || t > 7) return true;
      onCar(v, o.from[0] * o.side, o.from[1], o.from[2], _a);
      if (!c || c.gone) {
        o.miss = true;
        return t > 0.6;
      }
      const d = Math.hypot(c.pos.x - _a.x, c.pos.z - _a.z);
      if (!o.bit) {
        // (in flight: does it reach it)
        o.k = Math.min(1, t / Math.max(0.15, d / 60));
        if (o.k >= 1) {
          if (d > 45) return true;
          o.bit = true;
          o.len = clamp(d, 6, 14);
          g.fx.sparks(c.pos.x, (c.pos.y || 0) + 0.8, c.pos.z, 10, [1, 0.85, 0.4]);
          g.audio.play('clank', 0.8);
          hold(G, c, 'tow', 7, { v, len: o.len, lv: o.lv });
        }
        return false;
      }
      return !(c.gear && c.gear.kind === 'tow');
    },
    draw(G, o, fr) {
      const v = o.v;
      const c = o.c;
      onCar(v, o.from[0] * o.side, o.from[1], o.from[2], _a);
      let x = _a.x;
      let y = _a.y;
      let z = _a.z;
      if (c) {
        const k = o.bit ? 1 : o.k || 0;
        x = _a.x + (c.pos.x - _a.x) * k;
        y = _a.y + ((c.pos.y || 0) + 0.8 - _a.y) * k;
        z = _a.z + (c.pos.z - _a.z) * k;
      } else {
        const t = G.game.time - o.t0;
        x += Math.sin(v.yaw) * t * 50;
        z += Math.cos(v.yaw) * t * 50;
      }
      // (a little sag, the cable's)
      const mx = (_a.x + x) / 2;
      const mz = (_a.z + z) / 2;
      const my = (_a.y + y) / 2 - (o.bit ? 0.4 : 0);
      fr.lineXYZ(_a.x, _a.y, _a.z, mx, my, mz, [0.4, 0.41, 0.45], 3, 8600, 1, 0.004, 0);
      fr.lineXYZ(mx, my, mz, x, y, z, [0.4, 0.41, 0.45], 3, 8601, 1, 0.004, 0);
    },
  },

  // ------------------------------------------------------------------ the net
  // (fire: the net flies at the police car ahead and falls over it - it stops where it is, for 3 seconds,
  // level 2 five, level 3 eight - and a big net: the cars round it too)
  net: {
    update(G, v, p, dt, s, K, lv) {
      if (!K || !K.fire || !G.use(p)) return;
      const g = G.game;
      const c = ahead(G, v, 34, 0.6);
      onCar(v, 0, 2, -0.15, _a);
      G.live.push({ kit: 'netshot', x0: _a.x, y0: _a.y, z0: _a.z, c, t0: g.time, lv, yaw: v.yaw });
      g.audio.play('whoosh', 0.8);
      g.audio.play('pop', 0.5);
    },
  },
  netshot: {
    step(G, o) {
      const g = G.game;
      const t = g.time - o.t0;
      const c = o.c;
      const tx = c ? c.pos.x : o.x0 + Math.sin(o.yaw) * 25;
      const tz = c ? c.pos.z : o.z0 + Math.cos(o.yaw) * 25;
      const d = Math.hypot(tx - o.x0, tz - o.z0);
      const T = clamp(d / 30, 0.3, 1.1);
      o.k = Math.min(1, t / T);
      o.x = o.x0 + (tx - o.x0) * o.k;
      o.z = o.z0 + (tz - o.z0) * o.k;
      o.y = o.y0 + Math.sin(o.k * Math.PI) * d * 0.18 + ((c ? 1.6 : 0) - o.y0) * o.k;
      if (o.k < 1) return false;
      if (c && !o.caught) {
        o.caught = true;
        const secs = [3, 5, 8][o.lv - 1];
        const hit = o.lv >= 3 ? cops(G, c.pos.x, c.pos.z, 7).map((q) => q.c) : [c];
        for (const q of hit) {
          hold(G, q, 'net', secs);
          G.live.push({ kit: 'netted', c: q, t0: g.time, until: g.time + secs });
        }
        g.audio.play('rubber', 0.7);
      }
      return true;
    },
    draw(G, o, fr) {
      if (o.k === undefined) return;
      const r = 0.6 + o.k * 1.4;
      ring(fr, o.x, o.y, o.z, r, [0.85, 0.82, 0.7], 2.4, 8650, 1, 12);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI;
        fr.lineXYZ(o.x + Math.cos(a) * r, o.y, o.z + Math.sin(a) * r, o.x - Math.cos(a) * r, o.y, o.z - Math.sin(a) * r, [0.85, 0.82, 0.7], 2, 8670 + k, 1, 0.004, 0);
      }
    },
  },
  netted: {
    step(G, o) {
      return G.game.time > o.until || !o.c || o.c.gone;
    },
    draw(G, o, fr) {
      // (the net over the car: its cords along and across its roof and down its sides)
      const c = o.c;
      const L = (c.spec && c.spec.L ? c.spec.L / 2 : 2.3) + 0.3;
      const W = (c.spec && c.spec.W ? c.spec.W / 2 : 0.95) + 0.25;
      const H = 1.6;
      const cs = Math.cos(c.yaw);
      const sn = Math.sin(c.yaw);
      const P = (x, y, z) => [c.pos.x + x * cs + z * sn, (c.pos.y || 0) + y, c.pos.z - x * sn + z * cs];
      const col = [0.85, 0.82, 0.7];
      for (let i = 0; i <= 6; i++) {
        const z = -L + (2 * L * i) / 6;
        const a = P(-W, 0.15, z);
        const b = P(-W * 0.8, H, z);
        const e = P(W * 0.8, H, z);
        const f = P(W, 0.15, z);
        fr.lineXYZ(...a, ...b, col, 2, 8700 + i * 3, 1, 0.004, 0);
        fr.lineXYZ(...b, ...e, col, 2, 8701 + i * 3, 1, 0.004, 0);
        fr.lineXYZ(...e, ...f, col, 2, 8702 + i * 3, 1, 0.004, 0);
      }
      for (const x of [-W * 0.8, 0, W * 0.8]) {
        const a = P(x, x ? H * 0.9 : H, -L);
        const b = P(x, x ? H * 0.9 : H, L);
        fr.lineXYZ(...a, ...b, col, 2, 8740 + x, 1, 0.004, 0);
      }
    },
  },

  // ------------------------------------------------------------------ the wrecking ball
  // (fire: the crane swings its ball out to the side - the side the nearest car is on - and round; what it
  // meets is thrown: a police car wrecked. Level 2 a heavier ball; level 3 a jib each way, both swing)
  wreck: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      if (K && K.fire && !(s.swing > g.time - 0.9) && G.use(p)) {
        s.swing = g.time;
        // (to the side the nearest car is on)
        const near = cars(G, v.pos.x, v.pos.z, 12, v)[0];
        let side = 1;
        if (near) {
          const dx = near.c.pos.x - v.pos.x;
          const dz = near.c.pos.z - v.pos.z;
          side = dx * Math.cos(v.yaw) - dz * Math.sin(v.yaw) > 0 ? 1 : -1;
        }
        s.side = lv >= 3 ? 0 : side;
        s.hit = new Set();
        g.audio.play('swing', 0.9);
      }
      const t = g.time - (s.swing || -9);
      s.a = t < 0.9 ? Math.sin((t / 0.9) * Math.PI) * 1.45 : 0;
      if (t >= 0.9) return;
      // where the ball is: out from the jib's tip on its chain, swung up and out
      const tip = p.n && p.n.tip ? p.n.tip : [1.5, 2.6, -0.25];
      const len = tip[1] - 1.0;
      const R = (p.n && p.n.R) || 0.4;
      for (const sd of s.side === 0 ? [1, -1] : [s.side]) {
        const x = sd * (tip[0] + Math.sin(s.a) * len);
        const y = tip[1] - Math.cos(s.a) * len;
        onCar(v, x, y, tip[2], _a);
        for (const { c } of cars(G, _a.x, _a.z, R + 1.9, v)) {
          if (s.hit.has(c)) continue;
          s.hit.add(c);
          g.fx.sparks(_a.x, _a.y, _a.z, 14, [1, 0.85, 0.4]);
          g.audio.play('crash', 0.9);
          g.camRig.addShake(0.3);
          if (c.police) wreck(G, c, 36);
          else if (g.damage && !g.classic) g.damage.hit(c, _a.x, 0.8, _a.z, 60);
          c.speed = 0;
        }
        if (g.knock) g.knock.blast(_a.x, _a.y, _a.z, R + 0.8);
      }
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (!gr || !gr.ball) return;
      const sd = s.side === 0 ? 1 : s.side || 1;
      gr.ball.node.rotation.z = (s.a || 0) * sd * (o.side || 1) * -1 + Math.sin(G.game.time * 2) * 0.04;
    },
  },

  // ------------------------------------------------------------------ the drone
  // (fire: it takes off from its pad, goes after the nearest police car and hangs over it, firing paint at it
  // till it is wrecked or its time is up - then home to its pad. Level 2 longer; level 3 two)
  drone: {
    update(G, v, p, dt, s, K, lv) {
      if (!K || !K.fire || (s.out && s.out.some((d) => !d.done)) || !G.use(p)) return;
      const g = G.game;
      s.out = [];
      for (let i = 0; i < (lv >= 3 ? 2 : 1); i++) {
        onCar(v, 0, 2, -0.2, _a);
        const d = { kit: 'droneout', v, x: _a.x, y: _a.y, z: _a.z, t0: g.time, life: [10, 20, 20][lv - 1], side: i ? -1 : 1, lv };
        s.out.push(d);
        G.live.push(d);
      }
      g.audio.play('whoosh', 0.6);
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (gr && gr.drone) gr.drone.node.visible = !(s.out && s.out.some((d) => !d.done));
    },
  },
  droneout: {
    step(G, o, dt) {
      const g = G.game;
      const t = g.time - o.t0;
      const v = o.v;
      let tx;
      let ty;
      let tz;
      const home = t > o.life || v.dead;
      if (!home) {
        o.look = (o.look || 0) - dt;
        if (o.look <= 0 || !o.c || o.c.wrecked || o.c.gone) {
          o.look = 0.5;
          const n = cops(G, o.x, o.z, 70);
          o.c = n.length ? n[Math.min(n.length - 1, o.side > 0 ? 0 : 1)].c : null;
        }
      }
      if (!home && o.c) {
        const c = o.c;
        tx = c.pos.x - Math.sin(c.yaw) * 3 + o.side * 1.5;
        ty = (c.pos.y || 0) + 5;
        tz = c.pos.z - Math.cos(c.yaw) * 3;
        // (over it: paint at it)
        o.cool = (o.cool || 0) - dt;
        if (o.cool <= 0 && Math.hypot(tx - o.x, tz - o.z) < 6) {
          o.cool = 0.22;
          _d.set(c.pos.x - o.x, (c.pos.y || 0) + 0.8 - o.y, c.pos.z - o.z).normalize();
          g.weapons.projectiles.push({ kind: 'paintmg', owner: 'player', x: o.x, y: o.y - 0.2, z: o.z, vx: _d.x * 60, vy: _d.y * 60, vz: _d.z * 60, gravity: 2, damage: 14, radius: 0, life: 1.2, t: 0, seed: Math.random() * 100, wobble: 0, color: [0.2, 0.6, 1], ignoreCar: v });
          c.droneHits = (c.droneHits || 0) + 1;
          if (c.droneHits > 14 && !c.wrecked) wreck(G, c, 30);
          if (Math.random() < 0.3) g.audio.play('paint', 0.25);
        }
      } else if (!home) {
        onCar(v, o.side * 2, 6, -2, _a);
        tx = _a.x;
        ty = _a.y;
        tz = _a.z;
      } else {
        onCar(v, 0, 2, -0.2, _a);
        tx = _a.x;
        ty = _a.y;
        tz = _a.z;
        if (Math.hypot(tx - o.x, ty - o.y, tz - o.z) < 0.8 || v.dead) {
          o.done = true;
          return true;
        }
      }
      // (up first, then on to where it goes)
      if (t < 0.6) ty = Math.max(ty, o.y + 3);
      const k = 1 - Math.exp(-2.4 * dt);
      o.x += (tx - o.x) * k;
      o.y += (ty - o.y) * k;
      o.z += (tz - o.z) * k;
      return t > o.life + 8;
    },
    draw(G, o, fr) {
      // (the drone in ink: its frame, four rotors spinning)
      const t = G.game.time;
      const col = [0.92, 0.92, 0.9];
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ex = o.x + sx * 0.32;
        const ez = o.z + sz * 0.32;
        fr.lineXYZ(o.x, o.y, o.z, ex, o.y + 0.03, ez, [0.2, 0.2, 0.22], 4, 8800 + sx + sz * 3, 1, 0.004, 0);
        const a = t * 40 + sx;
        fr.lineXYZ(ex - Math.cos(a) * 0.16, o.y + 0.08, ez - Math.sin(a) * 0.16, ex + Math.cos(a) * 0.16, o.y + 0.08, ez + Math.sin(a) * 0.16, [0.4, 0.42, 0.46], 2.5, 8810 + sx + sz * 3, 0.9, 0.004, 0);
        ring(fr, ex, o.y + 0.08, ez, 0.17, [0.25, 0.25, 0.28], 1.4, 8820 + (sx + 2) * 10 + sz * 3, 0.7, 10);
      }
      fr.lineXYZ(o.x - 0.12, o.y, o.z, o.x + 0.12, o.y, o.z, col, 9, 8850, 1, 0.004, 0);
      if (Math.sin(t * 8) > 0) fr.lineXYZ(o.x, o.y + 0.06, o.z, o.x, o.y + 0.1, o.z, [0.2, 1, 0.4], 5, 8851, 1, 0.004, 0);
    },
  },
};
