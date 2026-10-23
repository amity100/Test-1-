import { clamp, damp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { cops, hold, wreck, ring, onCar } from './gearfx.js';

// (ROADMAP 11.28) What moves your car (game/itemcat.js func): the turbo, the jump, the rewind, aeroplane
// wings and a helicopter's rotor - each a kit for game/gear.js: apply (what it makes of the car, as
// game/fuse.js applyVeh reads a part), finish (with the others), update (each frame, its buttons),
// animate (its model's moving parts), meter (its bar), step / draw (what it leaves in the world).

const REWIND_S = [3, 5, 8];
const NITRO_S = [3, 5, 7];
const NITRO_FILL = [0.35, 0.55, 0.8];
const JUMP_V = [8, 12.5, 16];
const _p = { x: 0, y: 0, z: 0 };

export const MOVE = {
  // ------------------------------------------------------------------ the turbo
  // (Shift, or the turbo button: the nitro - faster, harder; the bottles empty and fill again. Level 3 a
  // jet engine: at the top of its speed the air breaks with a boom)
  turbo: {
    apply(G, v, p, H, fz, lv) {
      v.jets = Math.max(1, v.jets || 0);
      fz.jetK = [1, 1.25, 1.6][lv - 1];
      fz.thrust = Math.max(fz.thrust || 0, [9, 12, 18][lv - 1]);
      fz.nitro = { cap: NITRO_S[lv - 1], fill: NITRO_FILL[lv - 1] };
    },
    // (with wings: an aeroplane - Shift keeps it up, game/fuse.js air)
    finish(G, v, p, parts, H, fz) {
      if (parts.some((q) => q.type === 'wing')) {
        fz.plane = true;
        if (!fz.combos.includes('plane')) fz.combos.push('plane');
      }
    },
    update(G, v, p, dt, s, K, lv) {
      const N = v.fz && v.fz.nitro;
      if (!N) return;
      const g = G.game;
      if (s.n === undefined) s.n = N.cap;
      const inp = g.input;
      const held = !!(inp && (inp.keys.has('ShiftLeft') || inp.keys.has('ShiftRight') || inp.boost || (inp.pad && inp.pad.sprint)));
      const on = !s.empty && s.n > 0 && (v.boosting || (v.air && held));
      if (on) {
        s.n = Math.max(0, s.n - dt);
        if (!s.flameOn) {
          g.audio.play('whoosh', 0.55);
          G.stats.boosts++;
        }
        s.burn = (s.burn || 0) + dt;
      } else {
        s.n = Math.min(N.cap, s.n + dt * N.fill);
        s.burn = 0;
      }
      s.flameOn = on;
      if (s.n <= 0.01) s.empty = true;
      if (s.empty && s.n >= N.cap * 0.3) s.empty = false;
      // (empty: no turbo till it has filled a third)
      v.jets = s.empty ? 0 : Math.max(1, v.jets || 0);
      // the picture goes wide, the camera falls back a little; streaks go by
      G.fovK = damp(G.fovK || 1, on ? 1.13 + 0.05 * (lv - 1) : 1, 4, g.realDt || dt);
      G.camPull = damp(G.camPull || 0, on ? 1.3 : 0, 4, g.realDt || dt);
      // (level 3, a jet: past its top speed with the jet on, the air breaks - once a burn)
      const top = (v.handling && v.handling.top) || 28;
      if (lv >= 3 && on && Math.abs(v.speed || 0) > top * 1.22 && !s.boomed) {
        s.boomed = true;
        G.stats.booms++;
        const sg = Math.sign(v.speed) || 1;
        G.live.push({ kit: 'sonic', x: v.pos.x, y: (v.pos.y || 0) + 0.9, z: v.pos.z, yaw: v.yaw + (sg < 0 ? Math.PI : 0), t0: g.time, v });
        g.audio.play('boom', 0.85);
        g.camRig.addShake(0.45);
        g.hud.toast('בום על־קולי!', 'good', 1.6);
      }
      if (!on || Math.abs(v.speed || 0) < top * 0.9) s.boomed = s.boomed && on;
    },
    animate() {},
    drawOn(G, v, p, s, fr) {
      if (!s.flameOn) return;
      // (streaks of air past it as it boosts)
      const g = G.game;
      const sp = Math.abs(v.speed || 0);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const k = ((g.time * 3.1 + i * 0.37) % 1);
        const a = (i / n) * Math.PI * 2 + i;
        const x = Math.cos(a) * 1.6;
        const y = 0.6 + Math.sin(a) * 0.9 + 0.5;
        const z0 = 3.5 - k * 9;
        onCar(v, x, y, z0, _p);
        const ax = _p.x;
        const ay = _p.y;
        const az = _p.z;
        onCar(v, x, y, z0 - 1.2 - sp * 0.04, _p);
        fr.lineXYZ(ax, ay, az, _p.x, _p.y, _p.z, [0.95, 0.97, 1], 1.6, 7700 + i, 0.55 * (1 - Math.abs(k - 0.5) * 2), 0.004, 0);
      }
    },
    meter(G, v, p, s) {
      const N = v.fz && v.fz.nitro;
      return N && s.n !== undefined ? s.n / N.cap : 1;
    },
  },
  // (a sonic boom: a white ring out round where it broke, and a cone of vapour behind)
  sonic: {
    step(G, o) {
      const t = G.game.time - o.t0;
      if (t < 0.05 && !o.puffed) {
        o.puffed = true;
        for (let i = 0; i < 6; i++) G.game.fx.smoke(o.x - Math.sin(o.yaw) * (1 + i * 0.6), o.y, o.z - Math.cos(o.yaw) * (1 + i * 0.6), 1.2 + i * 0.3);
      }
      return t > 0.9;
    },
    draw(G, o, fr) {
      const t = G.game.time - o.t0;
      const k = clamp(t / 0.9, 0, 1);
      const r = 1.5 + k * 14;
      // (upright, square to the way it went)
      const fx = Math.sin(o.yaw);
      const fz = Math.cos(o.yaw);
      let px = 0;
      let py = 0;
      let pz = 0;
      for (let i = 0; i <= 30; i++) {
        const a = (i / 30) * Math.PI * 2;
        const u = Math.cos(a) * r;
        const w = Math.sin(a) * r * 0.6;
        const x = o.x + fz * u - fx * k * 2;
        const y = o.y + w + r * 0.1;
        const z = o.z - fx * u - fz * k * 2;
        if (i) fr.lineXYZ(px, py, pz, x, y, z, [1, 1, 1], 4 * (1 - k) + 1, 7720 + i, 0.9 * (1 - k), 0.004, 0);
        px = x;
        py = y;
        pz = z;
      }
    },
  },

  // ------------------------------------------------------------------ the jump
  // (Space / ▲ on the ground: up it goes - level 1 on its hydraulics, a hop; level 2 its jump jets fire, high;
  // level 3 the jets break the air: a shock round where it left, police cars thrown, and a second jump in
  // the air)
  jump: {
    apply(G, v, p, H, fz, lv) {
      fz.jump = JUMP_V[lv - 1];
    },
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      // (the jump itself is game/fuse.js preDrive's; out of ink, none)
      if (v.fz) v.fz.jump = G.play.costs() && g.ink && g.ink.level < 3 ? 0 : JUMP_V[lv - 1];
      if (v.fzSpringT && v.fzSpringT !== s.lastT) {
        s.lastT = v.fzSpringT;
        s.double = false;
        G.stats.jumps++;
        if (G.play.costs() && g.ink) g.ink.spend(3);
        this.kick(G, v, s, lv, false);
      }
      // level 3: once more in the air
      if (lv >= 3 && v.air && K && K.jump && !s.double && g.time - (s.lastT || 0) > 0.25) {
        s.double = true;
        v.vy = Math.max(v.vy || 0, JUMP_V[2] * 0.85);
        s.lastT2 = g.time;
        this.kick(G, v, s, lv, true);
      }
      if (!v.air) s.double = false;
      const t = g.time - Math.max(s.lastT || -9, s.lastT2 || -9);
      const fire = lv >= 2 && t < (lv >= 3 ? 0.5 : 0.4);
      s.flame = { jet0: fire, jet1: fire };
    },
    kick(G, v, s, lv, air) {
      const g = G.game;
      const x = v.pos.x;
      const y = v.pos.y || 0;
      const z = v.pos.z;
      if (lv === 1) {
        g.audio.play('swish', 0.7);
        return;
      }
      g.audio.play(lv >= 3 ? 'boom' : 'whoosh', lv >= 3 ? 0.7 : 0.6);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.fx.smoke(x + Math.cos(a) * 1.8, y + 0.2, z + Math.sin(a) * 1.8, 1.1);
      }
      if (lv < 3) return;
      // (the shock: a ring out along the ground, police cars near thrown off - those right by it wrecked)
      G.live.push({ kit: 'shock', x, y: air ? y : groundHeight(x, z) * 0.5, z, t0: g.time });
      g.camRig.addShake(0.5);
      for (const { c, d } of cops(G, x, z, 13)) {
        if (d < 6) wreck(G, c, 32);
        else hold(G, c, 'spin', 1.3, { w: (c.pos.x - x) * (c.pos.z - z) > 0 ? 5 : -5 });
      }
      if (g.knock) g.knock.blast(x, y, z, 7);
      g.enemies.explosion(x, y + 0.5, z, 7, 20);
      g.civilians.explosion(x, y + 0.5, z, 5);
    },
    animate(G, v, o, dt, s) {
      const g = G.game;
      const t = g.time - Math.max(s.lastT || -9, s.lastT2 || -9);
      // (the coilovers pump: squeezed, flung out, back)
      const k = t < 0.45 ? Math.sin((t / 0.45) * Math.PI) : 0;
      for (const [name, Gr] of Object.entries(o.m.userData.groups || {})) {
        if (Gr.kind !== 'spring') continue;
        Gr.node.scale.y = damp(Gr.node.scale.y, 1 + 0.45 * k - (t < 0.06 ? 0.25 : 0), 30, dt);
      }
    },
  },
  // (level 3's shock: a white ring out along the ground)
  shock: {
    step(G, o) {
      return G.game.time - o.t0 > 0.7;
    },
    draw(G, o, fr) {
      const k = clamp((G.game.time - o.t0) / 0.7, 0, 1);
      ring(fr, o.x, o.y + 0.15, o.z, 1 + k * 13, [1, 1, 1], 5 * (1 - k) + 1, 7760, 0.85 * (1 - k), 36);
      ring(fr, o.x, o.y + 0.3, o.z, 0.5 + k * 9, [0.8, 0.9, 1], 3 * (1 - k) + 1, 7800, 0.6 * (1 - k), 30);
    },
  },

  // ------------------------------------------------------------------ the rewind
  // (Z / ⟲: the last seconds run back - your car, the police cars, the police's alarm - fast, in pencil
  // greys; then on from there. Level 3: and slow for a moment after)
  rewind: {
    apply(G, v, p, H, fz, lv) {
      fz.rewind = lv;
    },
    update(G, v, p, dt, s, K, lv) {
      if (!K || !K.rewind || G.rw) return;
      const T = G.tape || [];
      if (T.length < 8) {
        G.game.hud.toast('עוד אין מה להחזיר', 'info', 1.4);
        return;
      }
      if (!G.use(p)) return;
      const secs = REWIND_S[lv - 1];
      const t1 = T[T.length - 1].t;
      const back = Math.min(secs, t1 - T[0].t);
      G.rw = { v, t: 0, dur: 0.9 + back * 0.1, t1, t0: t1 - back, lv };
      G.freeze = 1;
      G.stats.rewinds++;
      G.game.audio.play('sweep', 0.8);
      this.look(G, true);
    },
    // the tape: each tenth of a second, while a car with the rewind is driven - and run back
    tape(G, v, dt, rdt) {
      if (G.rw) {
        this.scrub(G, rdt);
        return;
      }
      const on = v && !v.dead && v.fuse && v.fuse.parts.some((p) => p.item === 'rewind');
      if (!on) {
        if (G.tape && G.tape.length) G.tape = [];
        return;
      }
      G.tape = G.tape || [];
      G.tapeT = (G.tapeT || 0) + dt;
      if (G.tapeT < 0.1) return;
      G.tapeT = 0;
      const g = G.game;
      const P = g.police;
      const cc = [];
      for (const c of g.traffic.list) {
        if (!c.police || c.gone || c.poofT !== undefined) continue;
        if (Math.hypot(c.pos.x - v.pos.x, c.pos.z - v.pos.z) > 160) continue;
        cc.push([c, c.pos.x, c.pos.y || 0, c.pos.z, c.yaw, c.speed || 0, c.wrecked ? 1 : 0, c.crashed ? 1 : 0]);
      }
      G.tape.push({ t: g.time, v, car: [v.pos.x, v.pos.y || 0, v.pos.z, v.yaw, v.speed || 0, v.vx || 0, v.vz || 0, v.vy || 0, v.air ? 1 : 0, v.hp], cops: cc, lv: P ? P.level : 0, heat: P ? P.heat : 0 });
      while (G.tape.length && G.tape[0].t < g.time - 8.6) G.tape.shift();
    },
    scrub(G, rdt) {
      const R = G.rw;
      const T = G.tape;
      R.t += rdt;
      const k = clamp(R.t / R.dur, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const tt = R.t1 - (R.t1 - R.t0) * e;
      let i = T.length - 1;
      while (i > 0 && T[i - 1].t > tt) i--;
      const a = T[Math.max(0, i - 1)];
      const b = T[i];
      const f = b.t > a.t ? clamp((tt - a.t) / (b.t - a.t), 0, 1) : 0;
      const v = R.v;
      const L = (q, r) => q + (r - q) * f;
      if (!v.dead) {
        v.pos.x = L(a.car[0], b.car[0]);
        v.pos.y = L(a.car[1], b.car[1]);
        v.pos.z = L(a.car[2], b.car[2]);
        v.yaw = a.car[3] + angle(a.car[3], b.car[3]) * f;
      }
      const at = new Map(b.cops.map((q) => [q[0], q]));
      for (const q of a.cops) {
        const c = q[0];
        const r = at.get(c) || q;
        c.pos.x = L(q[1], r[1]);
        c.pos.z = L(q[3], r[3]);
        c.yaw = q[4] + angle(q[4], r[4]) * f;
      }
      G.rwK = k;
      if (k < 1) return;
      // there: as it was then - going as it went
      const S = f > 0.5 ? b : a;
      if (!v.dead) {
        const C = S.car;
        v.pos.set(C[0], C[1], C[2]);
        v.yaw = C[3];
        v.speed = C[4];
        v.vx = C[5];
        v.vz = C[6];
        v.vy = C[7];
        v.air = !!C[8];
        if (C[9] !== undefined && v.hp !== undefined) v.hp = Math.max(v.hp, C[9]);
        v.physT = G.game.time;
      }
      for (const q of S.cops) {
        const c = q[0];
        if (c.gone || c.poofT !== undefined) continue;
        c.pos.set(q[1], q[2], q[3]);
        c.yaw = q[4];
        c.speed = q[5];
        if (!q[6]) c.wrecked = false;
        if (!q[7]) {
          c.crashed = false;
          c.stopped = false;
        }
        c.gear = null;
      }
      const P = G.game.police;
      if (P && S.lv !== undefined && S.lv < P.level) {
        P.level = S.lv;
        if (S.heat !== undefined) P.heat = S.heat;
        if (G.game.hud) G.game.hud.setWanted(P.level, false);
      }
      // (what was flying: gone with the time it flew in)
      const W = G.game.weapons;
      if (W && W.projectiles) W.projectiles.length = 0;
      G.tape = T.slice(0, T.indexOf(S) + 1);
      G.rw = null;
      G.freeze = 0;
      G.rwK = 0;
      if (R.lv >= 3) G.slowReal = performance.now() + 3000;
      this.look(G, false);
      G.game.audio.play('magic', 0.6);
    },
    // the picture in pencil greys while it runs back, its seconds counting down
    look(G, on) {
      if (typeof document === 'undefined') return;
      const cv = G.game.renderer && G.game.renderer.domElement;
      if (cv) cv.style.filter = on ? 'grayscale(0.92) sepia(0.32) contrast(1.18) brightness(1.04)' : '';
      let el = document.getElementById('gear-rw');
      if (!el) {
        el = document.createElement('div');
        el.id = 'gear-rw';
        el.className = 'gear-rw';
        el.innerHTML = '<b>◀◀</b><span></span>';
        document.body.appendChild(el);
      }
      el.classList.toggle('on', on);
      if (on) el.querySelector('span').textContent = `${Math.round((G.rw.t1 - G.rw.t0) * 10) / 10} שניות אחורה`;
    },
    animate(G, v, o, dt) {
      // (its hands: back as it rewinds, and on, a second a tick, as it records)
      const Gr = o.m.userData.groups && o.m.userData.groups.hands;
      if (!Gr) return;
      if (G.rw) Gr.node.rotation.y += dt * 30;
      else Gr.node.rotation.y = -Math.floor(G.game.time) * ((Math.PI * 2) / 60);
    },
  },

  // ------------------------------------------------------------------ aeroplane wings
  // (level 1 they glide - off a ramp, off a roof; level 2 fast enough they lift it off; level 3 their
  // engines push it on through the air)
  wing: {
    finish(G, v, p, parts, H, fz, lv) {
      if (lv <= 1) fz.wingFly = false;
      if (lv >= 3) {
        fz.thrust = Math.max(fz.thrust || 0, 14);
        fz.wingJet = true;
      }
    },
    update(G, v, p, dt, s, K, lv) {
      const inp = G.game.input;
      const held = !!(inp && (inp.keys.has('ShiftLeft') || inp.keys.has('ShiftRight') || inp.boost));
      s.flameOn = lv >= 3 && v.air && (held || !!v.fzWinged);
    },
  },

  // ------------------------------------------------------------------ a helicopter's rotor
  // (level 1 up a little and about - a hover; level 2 it flies; level 3 it flies fast)
  rotor: {
    apply(G, v, p, H, fz, lv) {
      fz.ceil = [7, 60, 80][lv - 1];
      fz.rotorK = [0.8, 1, 1.45][lv - 1];
    },
    update(G, v, p, dt, s) {
      // (its downwash: dust and leaves blown out under it, near the ground)
      const g = G.game;
      if (!v.fzLifting) return;
      const gy = groundHeight(v.pos.x, v.pos.z) * 0.5;
      const alt = (v.pos.y || 0) - gy;
      if (alt > 9) return;
      s.dust = (s.dust || 0) - dt;
      if (s.dust > 0) return;
      s.dust = 0.07;
      const a = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 2.5;
      g.fx.smoke(v.pos.x + Math.cos(a) * r, gy + 0.2, v.pos.z + Math.sin(a) * r, 0.7 + (1 - alt / 9) * 0.8);
    },
    animate(G, v, o, dt) {
      const gr = o.m.userData.groups || {};
      const fast = v.fzLifting || (v.air && v.fz && v.fz.rotor);
      const w = fast ? 24 : v.driver ? 7 : 1.2;
      o.m.userData.rw = damp(o.m.userData.rw || 0, w, fast ? 3 : 1.2, dt);
      if (gr.main) gr.main.node.rotation.y += dt * o.m.userData.rw;
      if (gr.tail) gr.tail.node.rotation.x += dt * o.m.userData.rw * 1.7;
    },
  },
};

// the turn from a to b, the short way
function angle(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
