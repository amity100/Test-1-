import { damp, clamp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { onCar } from './gearfx.js';

// (ROADMAP 11.28) What keeps the car whole (game/itemcat.js armor) - beyond the armour, the bull bar and the
// spikes, which are game/fuse.js parts: the smoke screen, the shield dome (and, game/gearguard2.js, the
// rest). Kits for game/gear.js; B (🛡) uses them.

const SMOKE_S = [4, 7, 10];
const DOME_S = [4, 6, 9];
const _a = { x: 0, y: 0, z: 0 };

export const GUARD = {
  // ------------------------------------------------------------------ the smoke screen
  // (B: its dischargers pop their canisters out behind, up and over; where they land they pour out thick
  // smoke for seconds, and go - the police cannot see through it, game/signs.js)
  smoke: {
    update(G, v, p, dt, s, K, lv) {
      if (!K || !K.guard || !G.use(p)) return;
      const g = G.game;
      const n = lv >= 3 ? 4 : 3;
      const sp = Math.abs(v.speed || 0);
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < n; i++) {
          onCar(v, side * (0.16 + i * 0.13), 1.2, -(v.halfLen || 2.3) + 0.2, _a);
          const spread = (i - (n - 1) / 2) * 0.35 + side * 0.5;
          const back = 7 + i * 1.6 + (lv - 1) * 2;
          const yaw = v.yaw + Math.PI + spread * 0.32;
          G.live.push({ kit: 'smokecan', x: _a.x, y: _a.y, z: _a.z, vx: Math.sin(yaw) * back + Math.sin(v.yaw) * sp * 0.9, vy: 5.5, vz: Math.cos(yaw) * back + Math.cos(v.yaw) * sp * 0.9, t0: g.time, dur: SMOKE_S[lv - 1], lv });
        }
      }
      g.audio.play('pop', 0.8);
      g.fx.smoke(_a.x, _a.y, _a.z, 0.8);
    },
  },
  // (one canister: up and over, then smoke where it lies)
  smokecan: {
    step(G, o, dt) {
      const g = G.game;
      if (!o.down) {
        o.vy -= 18 * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.z += o.vz * dt;
        const gy = groundHeight(o.x, o.z) * 0.5;
        if (o.y <= gy + 0.1) {
          o.down = g.time;
          o.y = gy + 0.1;
          g.audio.play('whoosh', 0.35);
        }
        return g.time - o.t0 > 6;
      }
      const t = g.time - o.down;
      o.puff = (o.puff || 0) - dt;
      if (o.puff <= 0 && t < o.dur) {
        o.puff = 0.07;
        const r = 0.6 + Math.min(1, t / 1.5) * (1.6 + o.lv * 0.4);
        const a = Math.random() * Math.PI * 2;
        g.fx.smoke(o.x + Math.cos(a) * r * 0.5, o.y + 0.3 + Math.random() * 1.6, o.z + Math.sin(a) * r * 0.5, 1.6 + Math.random() * 1.6 + o.lv * 0.3);
      }
      o.wall = (o.wall || 0) - dt;
      if (o.wall <= 0 && t < o.dur) {
        o.wall = 0.6;
        if (g.signs) g.signs.puff(o.x, o.z, 3 + o.lv * 0.6, 3);
      }
      return t > o.dur + 1.5;
    },
    draw(G, o, fr) {
      if (o.down) return;
      fr.lineXYZ(o.x, o.y, o.z, o.x - o.vx * 0.03, o.y - o.vy * 0.03, o.z - o.vz * 0.03, [0.35, 0.38, 0.3], 4, 7900, 1, 0.004, 0);
    },
  },

  // ------------------------------------------------------------------ the shield dome
  // (B: a dome of light stands round the car for seconds - paint, Tipp-Ex, knocks: nothing gets through;
  // a police car that rams it bounces off. Its last second it flickers)
  dome: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      if (K && K.guard && !(s.until > g.time) && G.use(p)) {
        s.until = g.time + DOME_S[lv - 1];
        s.base = { armor: v.armor, ram: v.ram };
        g.audio.play('magic', 0.8);
        g.camRig.addShake(0.12);
        s.t0 = g.time;
      }
      const on = s.until > g.time;
      // (what it stops: game/gearguard2.js shields - till then, even if the dome comes off the car before;
      // the armour and the ram back as they were then, game/fuse.js applyVeh)
      if (on) {
        v.armor = 0.98;
        v.ram = { k: 2.4, shield: true };
        v.domeUntil = s.until;
      } else if (s.base) {
        v.armor = s.base.armor;
        v.ram = s.base.ram;
        s.base = null;
        v.domeUntil = 0;
        g.audio.play('poof', 0.4);
      }
      s.flameOn = on;
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (!gr || !gr.core) return;
      const t = G.game.time;
      const on = s.until > t;
      gr.core.node.scale.setScalar(on ? 1.2 + Math.sin(t * 9) * 0.15 : 0.85 + Math.sin(t * 2) * 0.08);
    },
    drawOn(G, v, p, s, fr) {
      const t = G.game.time;
      if (!(s.until > t)) return;
      const left = s.until - t;
      const k = clamp((t - (s.t0 || t)) / 0.35, 0, 1);
      if (left < 1.2 && Math.sin(t * 30) < -0.2) return;
      const hl = v.halfLen || 2.3;
      const R = (hl + 1.1) * (0.4 + 0.6 * k);
      const cx = v.pos.x;
      const cz = v.pos.z;
      const cy = (v.pos.y || 0) - 0.1;
      const col = [0.55, 0.9, 1];
      const a = 0.45 + Math.sin(t * 6) * 0.12;
      // (its meridians and its rings, turning slowly - the light of it)
      const spin = t * 0.4;
      for (let m = 0; m < 10; m++) {
        const ph = spin + (m / 10) * Math.PI * 2;
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let i = 0; i <= 8; i++) {
          const th = (i / 8) * (Math.PI / 2);
          const x = cx + Math.cos(ph) * Math.cos(th) * R;
          const y = cy + Math.sin(th) * R * 0.78;
          const z = cz + Math.sin(ph) * Math.cos(th) * R;
          if (i) fr.lineXYZ(px, py, pz, x, y, z, col, 2.2, 7950 + m * 9 + i, a, 0.004, 0);
          px = x;
          py = y;
          pz = z;
        }
      }
      for (let r = 1; r <= 3; r++) {
        const th = (r / 4) * (Math.PI / 2);
        const rr = Math.cos(th) * R;
        const y = cy + Math.sin(th) * R * 0.78;
        let px = 0;
        let pz = 0;
        for (let i = 0; i <= 28; i++) {
          const ph = (i / 28) * Math.PI * 2;
          const x = cx + Math.cos(ph) * rr;
          const z = cz + Math.sin(ph) * rr;
          if (i) fr.lineXYZ(px, y, pz, x, y, z, col, 2, 8050 + r * 31 + i, a * 0.85, 0.004, 0);
          px = x;
          pz = z;
        }
      }
    },
    meter(G, v, p, s) {
      const t = G.game.time;
      if (s.until > t) return (s.until - t) / DOME_S[(p.lv || 1) - 1];
      return null;
    },
  },
};
