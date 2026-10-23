import { clamp, damp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { NODES } from '../world/roads.js';
import { CAR_COLORS } from '../render/cars.js';
import { cops, cars, hold, blast, ring, onCar, inCar } from './gearfx.js';

// (ROADMAP 11.28) The rest of what keeps the car whole (game/gearguard.js has the smoke screen and the
// dome): the armour's and the bull bar's and the spikes' levels, the oil slick, the rear shield, the
// repair kit, the new paint, the jammer, the ejector seat, the drawn double. Kits for game/gear.js; B (🛡)
// uses them - the ejector seat with B held.

const _a = { x: 0, y: 0, z: 0 };
const SHIELD_S = [6, 6, 8];
const DECOY_S = [8, 14, 10];
const OIL = [0.06, 0.06, 0.07];

// a car's outline in ink: its body's box from sill to roof, a little loose (the drawn double)
function outline(fr, c, col, w, seed, a, wob) {
  const hl = (c.halfLen || 2.3) + 0.05;
  const hw = (c.halfWid || 0.98) + 0.05;
  const cs = Math.cos(c.yaw);
  const sn = Math.sin(c.yaw);
  const y0 = (c.pos.y || 0) + 0.35;
  const P = (x, y, z, i) => {
    const j = Math.sin(seed * 0.37 + i * 2.1) * wob;
    return [c.pos.x + (x + j) * cs + (z - j) * sn, y + j * 0.5, c.pos.z - (x + j) * sn + (z - j) * cs];
  };
  // the sill, the belt, the roof (shorter), and the uprights
  const L = [
    [-hw, y0, -hl, hw, y0, -hl], [hw, y0, -hl, hw, y0, hl], [hw, y0, hl, -hw, y0, hl], [-hw, y0, hl, -hw, y0, -hl],
    [-hw, y0 + 0.55, -hl, -hw, y0 + 0.55, hl], [hw, y0 + 0.55, -hl, hw, y0 + 0.55, hl],
    [-hw * 0.85, y0 + 1.05, -hl * 0.45, -hw * 0.85, y0 + 1.05, hl * 0.3], [hw * 0.85, y0 + 1.05, -hl * 0.45, hw * 0.85, y0 + 1.05, hl * 0.3],
    [-hw * 0.85, y0 + 1.05, hl * 0.3, -hw, y0 + 0.55, hl * 0.62], [hw * 0.85, y0 + 1.05, hl * 0.3, hw, y0 + 0.55, hl * 0.62],
    [-hw * 0.85, y0 + 1.05, -hl * 0.45, -hw, y0 + 0.55, -hl * 0.7], [hw * 0.85, y0 + 1.05, -hl * 0.45, hw, y0 + 0.55, -hl * 0.7],
  ];
  L.forEach((q, i) => {
    const p0 = P(q[0], q[1], q[2], i);
    const p1 = P(q[3], q[4], q[5], i + 7);
    fr.lineXYZ(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], col, w, seed + i, a, 0.004, 0);
  });
}

// the lane of the road a car is on, the way it goes: { A, B, t } (game/traffic.js placeOnEdge) - or the
// other way (back: true)
function laneOf(v, back = false, near = 14) {
  const sg = (Math.sign(v.speed || 1) || 1) * (back ? -1 : 1);
  const fx = Math.sin(v.yaw) * sg;
  const fz = Math.cos(v.yaw) * sg;
  let best = null;
  let bs = near;
  for (const A of NODES) {
    if (Math.abs(A.x - v.pos.x) + Math.abs(A.z - v.pos.z) > 260) continue;
    for (const B of A.nb) {
      const ex = Math.sign(B.x - A.x);
      const ez = Math.sign(B.z - A.z);
      // (the causeways' slant: not here)
      if (ex && ez) continue;
      const len = Math.abs(B.x - A.x) + Math.abs(B.z - A.z);
      const t = (v.pos.x - A.x) * ex + (v.pos.z - A.z) * ez;
      if (t < 12 || t > len - 18) continue;
      if (ex * fx + ez * fz < 0.5) continue;
      const off = Math.abs((v.pos.x - A.x) * ez - (v.pos.z - A.z) * ex);
      if (off < bs) {
        bs = off;
        best = { A, B, t };
      }
    }
  }
  return best;
}

export const GUARD2 = {
  // ------------------------------------------------------------------ the armour's levels
  // (game/fuse.js makes the plates' armour; level 2 the grilles over the glass too; level 3 heavy plate -
  // heavier and slower, and a police car can no longer spin it round: game/chase.js contact)
  armor: {
    apply(G, v, p, H, fz, lv) {
      v.armor = Math.min(0.85, (v.armor || 0) + [0, 0.1, 0.2][lv - 1]);
      if (lv >= 3) {
        H.mass = (H.mass || 1) * 1.12;
        H.top *= 0.96;
        fz.pitProof = true;
      }
    },
  },

  // ------------------------------------------------------------------ the bull bar's levels
  // (a push bar shoves cars out of the way; level 2 a dozer blade - through a roadblock, its cars thrown
  // aside; level 3 a wedge - what it meets goes up and over, wrecked)
  bullbar: {
    apply(G, v, p, H, fz, lv) {
      const r = v.ram || { k: 1.8, shield: true };
      v.ram = { ...r, k: r.k * [1, 1.4, 2.2][lv - 1], shield: true };
    },
    update(G, v, p, dt, s, K, lv) {
      const sp = Math.abs(v.speed || 0);
      if (lv < 2 || sp < 6 || v.speed < 0) return;
      const g = G.game;
      const T = g.traffic;
      const hl = v.halfLen || 2.3;
      for (const c of T.list) {
        if (c.box === undefined || c.box === null || c.poofT !== undefined) continue;
        const q = inCar(v, c.pos.x, 0, c.pos.z);
        if (q.z < 0 || q.z > hl + (c.halfLen || 2.3) + 0.6 + sp * 0.12 || Math.abs(q.x) > (v.halfWid || 1) + (c.halfWid || 1) * 0.8) continue;
        // (a parked car across the road - the roadblock's: off the road, wrecked, spun away)
        T.unpark(c);
        c.wrecked = true;
        c.mode = 'parked';
        const side = q.x > 0 ? 1 : -1;
        c.pos.x += Math.cos(v.yaw) * side * 2.2 + Math.sin(v.yaw) * 1.5;
        c.pos.z -= Math.sin(v.yaw) * side * 2.2 - Math.cos(v.yaw) * 1.5;
        c.yaw += side * (0.8 + Math.random() * 0.6);
        g.fx.sprite('fx_crash', c.pos.x, 1.2, c.pos.z, { size: 2.6, life: 0.45 });
        g.fx.sparks(c.pos.x, 0.8, c.pos.z, 16, [1, 0.85, 0.4]);
        g.audio.play('crash', 0.9);
        g.camRig.addShake(0.3);
        v.speed *= lv >= 3 ? 0.92 : 0.82;
        if (g.onCrime) g.onCrime('copcar', c.pos.x, c.pos.z);
      }
    },
  },

  // ------------------------------------------------------------------ the spikes' levels
  // (game/fuse.js: who shoves it, who rams it from behind, who stands by it - cut; level 2 the spikes on
  // its rims shred the tyres of a police car alongside - off it spins; level 3 longer: it spins off wrecked)
  spikes: {
    apply(G, v, p, H, fz, lv) {
      const k = [1, 1.25, 1.6][lv - 1];
      if (v.blades) v.blades = { ...v.blades, side: Math.round(v.blades.side * k) };
      if (v.spikes) v.spikes = { ...v.spikes, dmg: Math.round(v.spikes.dmg * k) };
    },
    update(G, v, p, dt, s, K, lv) {
      if (lv < 2 || Math.abs(v.speed || 0) < 5) return;
      const g = G.game;
      const reach = lv >= 3 ? 1.5 : 1.1;
      for (const { c } of cops(G, v.pos.x, v.pos.z, 6)) {
        if (c.gear) continue;
        const q = inCar(v, c.pos.x, 0, c.pos.z);
        if (Math.abs(q.z) > (v.halfLen || 2.3) + 0.6 || Math.abs(q.x) > (v.halfWid || 1) + (c.halfWid || 1) + reach) continue;
        hold(G, c, 'spin', 1.6, { w: (q.x > 0 ? 1 : -1) * 6, then: lv >= 3 ? 'wreck' : null });
        g.fx.sparks(c.pos.x, 0.4, c.pos.z, 14, [1, 0.9, 0.6]);
        g.fx.crumbs(c.pos.x, 0.3, c.pos.z, 10, 2);
        g.audio.play('skid', 0.8);
        g.audio.play('slash', 0.6);
      }
    },
  },

  // ------------------------------------------------------------------ the oil slick
  // (B: a jet of oil from the drum onto the road behind; a car that drives into it spins round - a police
  // car going fast spins off wrecked. Level 2 a wider slick; level 3 two, one after the other)
  oil: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      if (s.next && g.time > s.next) {
        s.next = 0;
        this.pour(G, v, lv, 1);
      }
      if (!K || !K.guard || !G.use(p)) return;
      this.pour(G, v, lv, 0);
      if (lv >= 3) s.next = g.time + 0.7;
    },
    pour(G, v, lv, i) {
      const g = G.game;
      onCar(v, 0, 0, -(v.halfLen || 2.3) - 1.6, _a);
      const y = groundHeight(_a.x, _a.z) * 0.5 + 0.03;
      G.live.push({ kit: 'slick', x: _a.x, y, z: _a.z, r: lv >= 2 ? 4.2 : 3, t0: g.time, until: g.time + (lv >= 2 ? 22 : 16), seed: 9000 + i * 40 + Math.floor(Math.random() * 30) * 7, hit: new Set(), yaw: v.yaw });
      g.fx.splash(_a.x, y + 0.4, _a.z, 14, 3, OIL);
      g.audio.play('pour', 0.8);
      g.audio.play('splat', 0.5);
    },
  },
  slick: {
    step(G, o) {
      const g = G.game;
      const t = g.time - o.t0;
      o.k = Math.min(1, t / 0.45);
      const R = o.r * o.k;
      for (const { c, d } of cars(G, o.x, o.z, R + 1.2, g.player.inVehicle)) {
        if (o.hit.has(c) || c.gear || Math.abs(c.speed || 0) < 2.5 || d > R + 0.6) continue;
        o.hit.add(c);
        const fast = Math.abs(c.speed) > 15;
        hold(G, c, 'spin', fast ? 2 : 1.6, { w: (Math.random() < 0.5 ? -1 : 1) * (fast ? 7.5 : 5.5), then: c.police && fast ? 'wreck' : null });
        if (!c.police) c.siren = false;
        g.audio.play('skid', 0.9);
        g.fx.smoke(c.pos.x, 0.3, c.pos.z, 1);
      }
      return g.time > o.until;
    },
    draw(G, o, fr) {
      // (a black puddle, glossy: its wobbly edge, a sheen of colours across it; fading its last seconds)
      const g = G.game;
      const left = o.until - g.time;
      const a = clamp(left / 2.5, 0, 1) * 0.95;
      const R = o.r * (o.k || 0);
      if (R < 0.1 || a <= 0) return;
      const n = 18;
      let px = 0;
      let pz = 0;
      for (let ring2 = 0; ring2 < 3; ring2++) {
        const rr = R * (1 - ring2 * 0.3);
        for (let i = 0; i <= n; i++) {
          const th = (i / n) * Math.PI * 2 + o.yaw;
          const wob = 1 + Math.sin(th * 3 + o.seed) * 0.16 + Math.sin(th * 5 + o.seed * 0.3) * 0.08;
          const x = o.x + Math.cos(th) * rr * wob * 1.15;
          const z = o.z + Math.sin(th) * rr * wob * 0.85;
          if (i) fr.lineXYZ(px, o.y, pz, x, o.y, z, OIL, 7 - ring2 * 1.5, o.seed + ring2 * 23 + i, a, 0.004, 0);
          px = x;
          pz = z;
        }
      }
      // the sheen: short arcs in purple, blue and gold
      const sheen = [[0.5, 0.3, 0.75], [0.25, 0.45, 0.9], [0.85, 0.7, 0.25]];
      for (let k = 0; k < 3; k++) {
        const r0 = R * (0.25 + k * 0.17);
        const a0 = o.seed * 0.1 + k * 1.9;
        for (let i = 0; i < 4; i++) {
          const t0 = a0 + i * 0.22;
          const t1 = t0 + 0.22;
          fr.lineXYZ(o.x + Math.cos(t0) * r0, o.y + 0.01, o.z + Math.sin(t0) * r0 * 0.75, o.x + Math.cos(t1) * r0, o.y + 0.01, o.z + Math.sin(t1) * r0 * 0.75, sheen[k], 2, o.seed + 80 + k * 5 + i, a * 0.8, 0.004, 0);
        }
      }
    },
  },

  // ------------------------------------------------------------------ the rear shield
  // (B: the plate swings up off the boot lid - what is fired at you from behind stops on it, game/gear.js
  // shields; level 2 it drops a barrier across the road behind as it goes up; level 3 longer, and the
  // shots from the sides stop too)
  rearshield: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      if (K && K.guard && !(s.until > g.time) && G.use(p)) {
        s.until = g.time + SHIELD_S[lv - 1];
        g.audio.play('clank', 0.9);
        g.audio.play('block', 0.5);
        if (lv >= 2) {
          onCar(v, 0, 0, -(v.halfLen || 2.3) - 2.2, _a);
          G.live.push({ kit: 'roadbar', x: _a.x, y: groundHeight(_a.x, _a.z) * 0.5, z: _a.z, yaw: v.yaw, w: 3.6, t0: g.time, until: g.time + 14, hit: new Set() });
        }
      }
      const on = s.until > g.time;
      s.up = damp(s.up || 0, on ? 1 : 0, on ? 9 : 4, dt);
      // (game/gear.js shields: as long as it is up - it runs out on its own if the part comes off)
      v.rearGuard = on ? { until: s.until, sides: lv >= 3 } : null;
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (gr && gr.shield) gr.shield.node.rotation.x = -(Math.PI / 2) * (1 - (s.up || 0));
    },
    meter(G, v, p, s) {
      const t = G.game.time;
      if (s.until > t) return (s.until - t) / SHIELD_S[(p.lv || 1) - 1];
      return null;
    },
  },
  // (the barrier: striped boards across the road on two trestles - a police car into it is stopped dead,
  // going fast it is wrecked)
  roadbar: {
    step(G, o) {
      const g = G.game;
      const t = g.time - o.t0;
      o.k = Math.min(1, t / 0.3);
      const fx = Math.sin(o.yaw);
      const fz = Math.cos(o.yaw);
      for (const { c } of cops(G, o.x, o.z, o.w + 3)) {
        if (o.hit.has(c)) continue;
        const dx = c.pos.x - o.x;
        const dz = c.pos.z - o.z;
        const along = dx * fx + dz * fz;
        const across = dx * fz - dz * fx;
        if (Math.abs(along) > (c.halfLen || 2.3) + 0.3 || Math.abs(across) > o.w + 0.6) continue;
        o.hit.add(c);
        o.broke = g.time;
        g.fx.crumbs(o.x, o.y + 0.7, o.z, 22, 4);
        g.fx.sparks(c.pos.x, 0.8, c.pos.z, 12, [1, 0.85, 0.4]);
        g.audio.play('crash', 0.9);
        if (Math.abs(c.speed || 0) > 9) hold(G, c, 'stop', 0.6, { then: 'wreck' });
        else hold(G, c, 'stop', 2.5);
        return true;
      }
      return g.time > o.until;
    },
    draw(G, o, fr) {
      const fx = Math.sin(o.yaw);
      const fz = Math.cos(o.yaw);
      // across the road: (fz, -fx)
      const ax = fz;
      const az = -fx;
      const y = o.y;
      const W = o.w * (o.k || 0);
      const col = [0.12, 0.12, 0.14];
      for (const s of [-1, 1]) {
        const x = o.x + ax * W * s * 0.9;
        const z = o.z + az * W * s * 0.9;
        fr.lineXYZ(x - fx * 0.4, y, z - fz * 0.4, x, y + 1.05, z, col, 4, 9300 + s, 1, 0.004, 0);
        fr.lineXYZ(x + fx * 0.4, y, z + fz * 0.4, x, y + 1.05, z, col, 4, 9302 + s, 1, 0.004, 0);
      }
      // the boards: red and white in turn
      for (const h of [0.95, 0.6]) {
        const n = 8;
        for (let i = 0; i < n; i++) {
          const t0 = (i / n - 0.5) * 2 * W;
          const t1 = ((i + 1) / n - 0.5) * 2 * W;
          fr.lineXYZ(o.x + ax * t0, y + h, o.z + az * t0, o.x + ax * t1, y + h, o.z + az * t1, i % 2 ? [0.96, 0.95, 0.92] : [0.88, 0.14, 0.14], 9, 9310 + h * 10 + i, 1, 0.004, 0);
        }
      }
    },
  },

  // ------------------------------------------------------------------ the repair kit
  // (standing still a moment, it mends the car - level 2 faster; level 3 its arm mends it as it drives.
  // All mended: its dents, its glass and its tyres too, as at the body shop - game/garage.js repair)
  repair: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      const still = Math.abs(v.speed || 0) < 1.2;
      s.stillT = still ? (s.stillT || 0) + dt : 0;
      const hurt = v.hp < v.maxHp - 0.01;
      const rate = !hurt || v.dead ? 0 : lv >= 3 ? (still ? 16 : 7) : s.stillT > 1 ? [5, 11][lv - 1] : 0;
      s.fixing = rate > 0;
      if (!rate) return;
      v.hp = Math.min(v.maxHp, v.hp + rate * dt * (v.maxHp / 100));
      s.spark = (s.spark || 0) - dt;
      if (s.spark <= 0) {
        s.spark = 0.25 + Math.random() * 0.3;
        const side = Math.random() < 0.5 ? -1 : 1;
        onCar(v, side * (v.halfWid || 0.98), 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * (v.halfLen || 2.3) * 1.4, _a);
        g.fx.sparks(_a.x, _a.y, _a.z, 6, [1, 0.85, 0.45]);
        if (Math.random() < 0.4) g.audio.play(Math.random() < 0.5 ? 'drill' : 'clank', 0.3);
      }
      if (v.hp >= v.maxHp - 0.01) {
        const D = v.dmg;
        if (D) Object.assign(D, { hp: D.hp > 100 ? D.hp : 100, d0: null, d1: null, glass: 0, flat: -1, bumper: 0, burning: false, burnT: 0, fuse: 0, burnt: false, puffT: 0 });
        g.audio.play('ding', 0.6);
        g.hud.toast('הרכב תוקן ✓', 'good', 1.6);
      }
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (!gr || !gr.arm) return;
      const t = G.game.time;
      gr.arm.node.rotation.y = damp(gr.arm.node.rotation.y, s.fixing ? Math.sin(t * 3) * 0.9 : 0, 6, dt);
    },
    meter(G, v, p, s) {
      return s.fixing ? v.hp / v.maxHp : null;
    },
  },

  // ------------------------------------------------------------------ the new paint
  // (B: the sprayers paint the car another colour - out of sight of the police, they lose you, as at the
  // body shop; level 2 even in plain sight one star less; level 3 in plain sight they lose you too)
  repaint: {
    update(G, v, p, dt, s, K, lv) {
      if (!K || !K.guard || !G.use(p)) return;
      const g = G.game;
      const old = v.color || [1, 1, 1];
      const far = CAR_COLORS.filter((c) => Math.abs(c[0] - old[0]) + Math.abs(c[1] - old[1]) + Math.abs(c[2] - old[2]) > 0.6);
      const col = (far.length ? far : CAR_COLORS)[Math.floor(Math.random() * (far.length || CAR_COLORS.length))].slice();
      v.color = col;
      if (v.stock) v.stock.color = col;
      v.dirt = 0;
      if (g.vehicles && g.vehicles.dirty) g.vehicles.dirty(v);
      // (the spray, all round it, in the new colour)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.fx.splash(v.pos.x + Math.cos(a) * 1.4, (v.pos.y || 0) + 1, v.pos.z + Math.sin(a) * 2.2, 4, 2, col);
      }
      g.audio.play('pour', 0.7);
      g.audio.play('paint', 0.8);
      s.sprayT = g.time;
      const P = g.police;
      if (!P || !P.hostile) {
        g.hud.toast('צבע חדש! ✓', 'good', 1.6);
        return;
      }
      if (P.searching) {
        if (!(g.lose && g.lose.repainted(v))) P.clear();
      } else if (lv >= 3) {
        P.clear();
        g.hud.toast('צבע חדש מול העיניים שלהם — והמשטרה איבדה אתכם', 'good', 2.6);
      } else if (lv >= 2) {
        P.drop(1);
        g.hud.toast('צבע חדש: כוכב אחד פחות', 'good', 2.2);
      } else g.hud.toast('ראו אתכם נצבעים — זה עובד רק כשלא רואים', 'bad', 2.4);
    },
    drawOn(G, v, p, s, fr) {
      // (the mist of it a moment: rings of the new colour round the car)
      const t = G.game.time - (s.sprayT || -9);
      if (t > 0.8) return;
      const col = v.color || [1, 1, 1];
      for (let k = 0; k < 3; k++) ring(fr, v.pos.x, (v.pos.y || 0) + 0.4 + k * 0.45, v.pos.z, (v.halfLen || 2.3) * (0.7 + t * 0.9) + k * 0.1, col, 3, 9400 + k * 30, (1 - t / 0.8) * 0.8, 22);
    },
  },

  // ------------------------------------------------------------------ the jammer
  // (always on: the police radio is all noise - no more cars sent after you, game/police.js; level 2 they
  // give up the search sooner; level 3 they no longer tell each other where you are, and set up no roadblocks)
  jammer: {
    update(G, v, p, dt, s, K, lv) {
      G.jam = Math.max(G.jam || 0, lv);
    },
    drawOn(G, v, p, s, fr) {
      // (its waves, out from the aerials, while the police are after you)
      const g = G.game;
      if (!g.police || !g.police.hostile) return;
      const t = g.time;
      onCar(v, 0, 2.2, -0.3, _a);
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.9 + k / 3) % 1;
        ring(fr, _a.x, _a.y, _a.z, 0.4 + ph * 3.2, [0.95, 0.3, 0.3], 2, 9500 + k * 30, (1 - ph) * 0.55, 20);
      }
    },
  },

  // ------------------------------------------------------------------ the ejector seat
  // (B held: the hatch blows off the roof and you go up out of the car on your seat, the parachute opening
  // over you - level 2 at the top already, a soft one; level 3 and the car left behind goes off in a burst
  // of ink, the police round it wrecked)
  eject: {
    update(G, v, p, dt, s, K, lv) {
      if (!K) return;
      s.hold = K.guardHeld || 0;
      if (s.hold < 0.45) return;
      if (s.blown && s.blown > G.game.time - 1) return;
      if (!G.use(p)) return;
      s.blown = G.game.time;
      this.go(G, v, p, lv);
    },
    go(G, v, p, lv) {
      const g = G.game;
      const pl = g.player;
      const sp = v.speed || 0;
      const vx = v.vx !== undefined ? v.vx : Math.sin(v.yaw) * sp;
      const vz = v.vz !== undefined ? v.vz : Math.cos(v.yaw) * sp;
      onCar(v, 0, 1.6, 0, _a);
      const hatch = { x: _a.x, y: _a.y, z: _a.z, vx: vx * 0.6 + (Math.random() - 0.5) * 3, vy: 14, vz: vz * 0.6 + (Math.random() - 0.5) * 3, yaw: v.yaw };
      g.exitVehicle(true);
      pl.pos.set(_a.x, _a.y + 0.4, _a.z);
      pl.vel.set(vx * 0.45, lv >= 2 ? 27 : 23, vz * 0.45);
      pl.onGround = false;
      g.fx.boom(_a.x, _a.y, _a.z, 1.4);
      g.fx.smoke(_a.x, _a.y, _a.z, 2);
      g.audio.play('boom', 0.6);
      g.audio.play('whoosh', 0.9);
      g.camRig.addShake(0.4);
      G.live.push({ kit: 'ejected', t0: g.time, lv, hatch, car: v });
      if (lv >= 3) G.live.push({ kit: 'inkbomb', v, at: g.time + 1.3 });
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (!gr || !gr.hatch) return;
      // (the hatch gone off the car it blew out of; held: it rattles, about to go)
      const node = gr.hatch.node;
      if (node.userData.y0 === undefined) node.userData.y0 = node.position.y;
      node.visible = !s.blown;
      node.position.y = node.userData.y0 + clamp((s.hold || 0) / 0.45, 0, 1) * 0.025 * (1 + Math.sin(G.game.time * 50));
    },
    meter(G, v, p, s) {
      return s.hold > 0.02 ? clamp(s.hold / 0.45, 0, 1) : null;
    },
  },
  // (you on your way up: the parachute opens - level 1 once you fall, level 2 at the top; the hatch tumbling
  // away in ink)
  ejected: {
    step(G, o, dt) {
      const g = G.game;
      const pl = g.player;
      const t = g.time - o.t0;
      const H = o.hatch;
      if (H) {
        H.vy -= 22 * dt;
        H.x += H.vx * dt;
        H.y += H.vy * dt;
        H.z += H.vz * dt;
        H.yaw += dt * 7;
        if (H.y < groundHeight(H.x, H.z) * 0.5 + 0.1) {
          g.fx.crumbs(H.x, H.y + 0.1, H.z, 8, 2);
          g.audio.play('clank', 0.5);
          o.hatch = null;
        }
      }
      const chute = g.chute;
      if (pl.mode === 'foot' && chute && !chute.open && !pl.onGround && (o.lv >= 2 ? pl.vel.y < 1.5 : pl.vel.y < -5)) {
        chute.deploy(o.lv >= 2 ? 'perfect' : 'good');
        o.opened = true;
      }
      return (o.opened && !chute.open && !o.hatch) || pl.mode !== 'foot' || t > 25 || (t > 1 && pl.onGround && !o.hatch);
    },
    draw(G, o, fr) {
      const H = o.hatch;
      if (!H) return;
      // (a flat plate, tumbling: its outline)
      const c = Math.cos(H.yaw);
      const s = Math.sin(H.yaw);
      const P = (x, z) => [H.x + x * c, H.y + z * s * 0.6, H.z + z * c - x * s * 0.3];
      const q = [P(-0.42, -0.55), P(0.42, -0.55), P(0.42, 0.55), P(-0.42, 0.55)];
      for (let i = 0; i < 4; i++) {
        const a = q[i];
        const b = q[(i + 1) % 4];
        fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], i % 2 ? [0.95, 0.75, 0.1] : [0.22, 0.23, 0.26], 5, 9600 + i, 1, 0.004, 0);
      }
    },
  },
  inkbomb: {
    step(G, o) {
      const g = G.game;
      if (g.time < o.at) return false;
      const v = o.v;
      if (!v.dead && !v.driver) {
        blast(G, v.pos.x, (v.pos.y || 0) + 0.8, v.pos.z, 10, 140, { color: [0.2, 0.25, 0.75], skip: v });
        g.fx.splash(v.pos.x, (v.pos.y || 0) + 1, v.pos.z, 30, 9, [0.15, 0.2, 0.7]);
        v.destroy();
      }
      return true;
    },
  },

  // ------------------------------------------------------------------ the drawn double
  // (B: the pencil on the roof draws a copy of your car, and off it goes down the road - the police go after
  // it and not you, unless they see you close; its time up, it is rubbed out. Level 2 longer; level 3 two,
  // one each way)
  decoy: {
    update(G, v, p, dt, s, K, lv) {
      if (!K || !K.guard) return;
      const first = laneOf(v) || laneOf(v, false, 40);
      if (!first) {
        G.game.hud.toast('אין כאן כביש לכפיל — רק על כביש', 'bad', 1.8);
        return;
      }
      if (!G.use(p)) return;
      const g = G.game;
      const lanes = [first];
      if (lv >= 3) {
        const back = laneOf(v, true, 40);
        if (back) lanes.push(back);
      }
      for (const L of lanes) {
        const c = this.copy(G, v, L);
        if (c) G.live.push({ kit: 'decoyrun', car: c, t0: g.time, until: g.time + DECOY_S[lv - 1], seed: 9700 + G.live.length * 13 });
      }
      g.audio.play('scribble', 0.9);
      g.audio.play('magic', 0.6);
    },
    copy(G, v, L) {
      const T = G.game.traffic;
      const kind = v.kind === 'car' ? v.carKind || 'sedan' : 'sports';
      const spec = { kind, color: (v.color || [0.9, 0.3, 0.3]).slice(), extra: 'plain' };
      const c = T.newCar(spec, { driver: false, speed: Math.max(14, Math.abs(v.speed || 0)), maxSpeed: 24 });
      T.placeOnEdge(c, L.A, L.B, 0, L.t + 3);
      c.speed = Math.max(14, Math.abs(v.speed || 0));
      c.reckless = true;
      c.decoy = true;
      c.runner = true;
      T.list.push(c);
      return c;
    },
  },
  decoyrun: {
    step(G, o) {
      const g = G.game;
      const c = o.car;
      const T = g.traffic;
      if (T.list.indexOf(c) < 0 || c.gone) {
        o.done = true;
        return true;
      }
      // (held up, run into, or its time up: rubbed out)
      if (g.time > o.until || c.wrecked) {
        o.done = true;
        if (c.poofT === undefined) c.poofT = 0;
        g.fx.crumbs(c.pos.x, 0.8, c.pos.z, 24, 3);
        g.audio.play('erase', 0.7);
        return true;
      }
      return false;
    },
    draw(G, o, fr) {
      const g = G.game;
      const c = o.car;
      if (o.done || c.poofT !== undefined) return;
      const t = g.time - o.t0;
      // (drawn in: its outline first, the colour comes after - then a pencil line or two loose on it)
      const k = clamp(t / 0.6, 0, 1);
      const a = t < 0.6 ? 1 : 0.35 + Math.sin(t * 9) * 0.1;
      outline(fr, c, [0.12, 0.12, 0.16], t < 0.6 ? 4 : 2.2, o.seed, a * (t < 0.6 ? k : 1), 0.06);
      if (t < 0.6) ring(fr, c.pos.x, (c.pos.y || 0) + 0.2, c.pos.z, (c.halfLen || 2.3) * (1.6 - k), [0.12, 0.12, 0.16], 3, o.seed + 50, 1 - k, 20);
    },
  },
};

// (what the police see of your car with the double out: game/police.js, game/chase.js, game/lose.js)
export function decoyOf(G) {
  for (const o of G.live) if (o.kit === 'decoyrun' && !o.done && o.car && o.car.poofT === undefined) return o.car;
  return null;
}

// a shot at your car from (fx, fz): stopped by the rear shield (from behind; level 3 the sides too) or the
// dome (game/weapons.js, game/player.js hurt)
export function shields(G, v, fx, fz) {
  if (!v || fx === undefined || fz === undefined || fx === null) return false;
  // (only while the thing is still on the car)
  const on = (id) => !!(v.fuse && v.fuse.parts.some((p) => p.item === id));
  if (v.domeUntil > G.game.time && on('dome')) return true;
  const R = v.rearGuard;
  if (!R || !(R.until > G.game.time) || !on('rearshield')) return false;
  const q = inCar(v, fx, 0, fz);
  if (q.z < -(v.halfLen || 2.3) * 0.3) return true;
  return R.sides && Math.abs(q.x) > (v.halfWid || 0.98) * 0.8 && q.z < (v.halfLen || 2.3) * 0.5;
}
