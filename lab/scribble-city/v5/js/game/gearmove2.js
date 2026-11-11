import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { isWater } from './rides.js';
import { Kit, itemMats, linC } from './items.js';
import { onCar } from './gearfx.js';

// (ROADMAP 11.28) More of what moves your car (game/gearmove.js has the turbo, the jump, the rewind, the
// wings and the rotor): the grappling hook, monster wheels, tank tracks, the water kit, the parachute, the
// balloon's levels, the folding bridge - kits for game/gear.js.

const HOOK_R = [22, 26, 30];
const BRIDGE_L = [10, 18, 30];
const _a = { x: 0, y: 0, z: 0 };
const _b = { x: 0, y: 0, z: 0 };

// the floor ahead of a car (what it would stand on there - a roof, the bridge's deck, the ground)
function floorAhead(G, x, z, y) {
  const g = G.game;
  let f = groundHeight(x, z) * 0.5;
  if (g.mission) f = Math.max(f, g.mission.floorAt(x, z, y));
  if (g.gadgets) f = Math.max(f, g.gadgets.floorAt(x, z, y));
  f = Math.max(f, G.floorAt(x, z, y));
  return f;
}

export const MOVE2 = {
  // ------------------------------------------------------------------ the grappling hook
  // (Space, a building's edge ahead in reach - its mark there: level 1 the hook flies, bites and yanks the
  // car on toward it; level 2 it winches it up the wall onto the roof; level 3 also in the air: it swings
  // on its cable round the anchor till Space again)
  grapple: {
    apply(G, v, p, H, fz, lv) {
      fz.roofs = true;
      fz.airCtl = Math.max(fz.airCtl || 0, 0.3);
    },
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      // the anchor in reach ahead: the top edge of what stands in front of it, higher than the car
      s.find = (s.find || 0) - dt;
      if (s.find <= 0 && !s.line) {
        s.find = 0.12;
        s.anchor = this.look(G, v, lv);
      }
      // (a target ahead: Space is the hook's - not a jump)
      if (s.anchor && !s.line && v.fz && v.fz.jump) {
        s.jumpWas = s.jumpWas || v.fz.jump;
        v.fz.jump = 0;
      } else if (!s.anchor && s.jumpWas && v.fz) {
        v.fz.jump = s.jumpWas;
        s.jumpWas = 0;
      }
      if (K && K.jump && !s.line && s.anchor && (lv >= 3 || !v.air) && G.use(p)) {
        s.line = { t0: g.time, at: s.anchor, state: 'fly', len: 0 };
        g.audio.play('swish', 0.8);
        g.audio.play('clank', 0.4);
      } else if (K && K.jump && s.line && s.line.state === 'swing') {
        s.line = null;
        g.audio.play('rubber', 0.4);
      }
      const L = s.line;
      if (!L) return;
      const A = L.at;
      const t = g.time - L.t0;
      onCar(v, 0, 1, (v.halfLen || 2.3) + 0.1, _a);
      const dx = A.x - _a.x;
      const dy = A.y - _a.y;
      const dz = A.z - _a.z;
      const d = Math.hypot(dx, dy, dz);
      if (L.state === 'fly') {
        if (t > clamp(d / 45, 0.12, 0.4)) {
          L.state = v.air && lv >= 3 ? 'swing' : lv >= 2 ? 'climb' : 'pull';
          L.len = d;
          L.t1 = g.time;
          g.audio.play('clank', 0.7);
          g.fx.sparks(A.x, A.y, A.z, 10, [1, 0.85, 0.4]);
        }
        return;
      }
      const ux = dx / (d || 1);
      const uy = dy / (d || 1);
      const uz = dz / (d || 1);
      if (L.state === 'pull') {
        // (yanked on toward it, along the ground)
        const hd = Math.hypot(dx, dz) || 1;
        v.vx += (dx / hd) * 30 * dt;
        v.vz += (dz / hd) * 30 * dt;
        if (hd < 5 || g.time - L.t1 > 1.4) s.line = null;
      } else if (L.state === 'climb') {
        // (wound in: up the wall, and over its edge onto the roof)
        v.air = true;
        const top = A.y;
        const hd = Math.hypot(dx, dz) || 1;
        const up = v.pos.y < top + 0.4;
        v.vy = up ? Math.max(v.vy || 0, 9) : v.vy;
        const k = up && hd < 3 ? 0.4 : 1;
        v.vx = damp(v.vx || 0, (dx / hd) * 8 * k, 4, dt);
        v.vz = damp(v.vz || 0, (dz / hd) * 8 * k, 4, dt);
        if (!up && hd < 2.2) {
          // (over the edge: on the roof)
          v.vx += ux * 3;
          v.vz += uz * 3;
          s.line = null;
          g.hud.toast('על הגג', 'good', 1.4);
        }
        if (g.time - L.t1 > 4) s.line = null;
      } else if (L.state === 'swing') {
        // (on its cable: no farther from the anchor than it is long - round it, the way it was going)
        if (d > L.len) {
          const vr = (v.vx || 0) * ux + (v.vy || 0) * uy + (v.vz || 0) * uz;
          if (vr < 0) {
            v.vx -= vr * ux;
            v.vy -= vr * uy;
            v.vz -= vr * uz;
          }
          L.len = damp(L.len, Math.max(4, L.len - 0.5), 1, dt);
        }
        if (!v.air || g.time - L.t1 > 3.5) s.line = null;
      }
    },
    // the top edge of what stands ahead in reach: { x, y, z } or null
    look(G, v, lv) {
      const y0 = v.pos.y || 0;
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      for (let d = 4; d <= HOOK_R[lv - 1]; d += 0.8) {
        const x = v.pos.x + fx * d;
        const z = v.pos.z + fz * d;
        const top = G.game.gadgets ? G.game.gadgets.floorAt(x, z, 400) : -Infinity;
        if (top > y0 + 2.6 && top < y0 + 34) return { x: x + fx * 0.4, y: top, z: z + fz * 0.4, d };
      }
      return null;
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (gr && gr.hook) gr.hook.node.visible = !s.line;
    },
    drawOn(G, v, p, s, fr) {
      const g = G.game;
      // the cable, out to the hook; the mark where it would bite
      const L = s.line;
      onCar(v, 0, 0.55, (v.halfLen || 2.3) + 0.1, _a);
      if (L) {
        const t = g.time - L.t0;
        const k = L.state === 'fly' ? clamp(t / clamp(Math.hypot(L.at.x - _a.x, L.at.z - _a.z) / 45, 0.12, 0.4), 0, 1) : 1;
        const x = _a.x + (L.at.x - _a.x) * k;
        const y = _a.y + (L.at.y - _a.y) * k;
        const z = _a.z + (L.at.z - _a.z) * k;
        fr.lineXYZ(_a.x, _a.y, _a.z, x, y, z, [0.35, 0.36, 0.4], 3, 8200, 1, 0.004, 0);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          fr.lineXYZ(x, y, z, x + Math.cos(a) * 0.35, y - 0.25, z + Math.sin(a) * 0.35, [0.82, 0.84, 0.88], 3.2, 8210 + i, 1, 0.004, 0);
        }
      } else if (s.anchor) {
        const A = s.anchor;
        const r = 0.5 + Math.sin(g.time * 6) * 0.08;
        for (let i = 0; i < 16; i++) {
          const a0 = (i / 16) * Math.PI * 2;
          const a1 = ((i + 1) / 16) * Math.PI * 2;
          fr.lineXYZ(A.x + Math.cos(a0) * r, A.y + 0.12, A.z + Math.sin(a0) * r, A.x + Math.cos(a1) * r, A.y + 0.12, A.z + Math.sin(a1) * r, [1, 0.6, 0.1], 3, 8230 + i, 0.9, 0.004, 0);
        }
      }
    },
  },

  // ------------------------------------------------------------------ monster wheels
  // (game/fuse.js makes them wheels: the car up on them, over what is in the way. Level 3: down from a jump
  // on them, a stomp. Here: they roll, the front ones steer)
  monster: {
    apply(G, v, p, H, fz, lv) {
      if (lv >= 3) v.stomp = { r: 8, dmg: 60 };
      fz.step = Math.max(fz.step || 0, [1.0, 1.25, 1.4][lv - 1]);
      fz.roofs = true;
    },
    animate(G, v, o, dt) {
      const r0 = 0.34;
      const R = (o.p.n && o.p.n.r) || 0.8;
      for (const Gr of Object.values(o.m.userData.groups || {})) {
        if (Gr.kind !== 'roll' && Gr.kind !== 'steer') continue;
        Gr.node.rotation.order = 'YXZ';
        Gr.node.rotation.x = (v.wheelSpin || 0) * (r0 / R);
        Gr.node.rotation.y = Gr.kind === 'steer' ? clamp((v.turn || 0) * 0.35, -0.45, 0.45) : 0;
      }
    },
  },

  // ------------------------------------------------------------------ tank tracks
  // (it turns on the spot, grips, goes up kerbs and stairs; slower - level 2 less so; level 3 heavy, it
  // shoves cars out of its way)
  tracks: {
    apply(G, v, p, H, fz, lv) {
      H.pivot = true;
      H.grip += 2.2;
      H.top *= [0.72, 0.86, 0.8][lv - 1];
      H.power *= [1, 1.15, 1.45][lv - 1];
      fz.step = Math.max(fz.step || 0, 0.95);
      fz.hideWheels = true;
      fz.roofs = true;
      if (lv >= 3) {
        H.mass = (H.mass || 1) * 1.6;
        v.ram = { k: 2.2, shield: true };
        v.crush = true;
      }
    },
    animate(G, v, o, dt) {
      for (const Gr of Object.values(o.m.userData.groups || {})) if (Gr.kind === 'roll') Gr.node.rotation.x += ((v.speed || 0) * dt) / 0.25;
    },
  },

  // ------------------------------------------------------------------ the water kit
  // (level 1 a boat: it floats and drives on the water; level 2 a hovercraft - on water and land alike,
  // fast, sliding; level 3 a submarine - ▼ (C) on the water and down it goes, out of sight)
  water: {
    apply(G, v, p, H, fz, lv) {
      const D = (v.halfLen || 2.3) * 2;
      fz.float = { len: clamp(D * 0.86, 2, 6), k: 1.25, cap: [14, 24, 16][lv - 1] };
      if (lv === 2) {
        H.grip *= 0.45;
        H.top *= 1.08;
        fz.lift = Math.max(fz.lift || 0, 0.12);
      }
    },
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      const fl = v.fz && v.fz.float;
      if (!fl) return;
      // (on the water: as fast as its kind goes there)
      if (v.fzWet && Math.abs(v.speed || 0) > fl.cap) {
        const k = fl.cap / Math.abs(v.speed);
        v.vx *= k;
        v.vz *= k;
      }
      if (lv < 3) return;
      // the submarine: down while ▼ (C) is held on the water, up again without
      const inp = g.input;
      const down = !!(inp && (inp.keys.has('KeyC') || inp.flyDown));
      s.depth = damp(s.depth || 0, v.fzWet && down ? -3.2 : 0, 1.4, dt);
      fl.dive = s.depth;
      const under = s.depth < -1.2;
      v.unseen = under;
      if (under !== s.under) {
        s.under = under;
        g.audio.play(under ? 'pour' : 'splat', 0.6);
        this.tint(under);
        if (under) g.hud.toast('מתחת למים — המשטרה לא רואה אתכם', 'good', 2.2);
      }
    },
    tint(on) {
      if (typeof document === 'undefined') return;
      let el = document.getElementById('gear-sea');
      if (!el) {
        el = document.createElement('div');
        el.id = 'gear-sea';
        el.className = 'gear-sea';
        document.body.appendChild(el);
      }
      el.classList.toggle('on', on);
    },
    animate(G, v, o, dt) {
      const gr = o.m.userData.groups || {};
      const w = v.fzWet ? 6 + Math.abs(v.speed || 0) * 1.8 : v.driver ? 3 : 0.5;
      if (gr.prop) gr.prop.node.rotation.z += dt * w;
      if (gr.fan) gr.fan.node.rotation.z += dt * (v.driver ? 14 + Math.abs(v.speed || 0) : 2);
    },
  },

  // ------------------------------------------------------------------ the parachute
  // (falling, it opens: down slowly - level 2 slower, level 3 steered; on the ground at speed, Space: a brake
  // chute out behind - stopped in a few metres)
  chute: {
    apply(G, v, p, H, fz, lv) {
      fz.chuteVy = [-2.4, -1.6, -1.6][lv - 1];
      if (lv >= 3) fz.airCtl = Math.max(fz.airCtl || 0, 0.9);
    },
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      const sp = Math.abs(v.speed || 0);
      if (K && K.jump && !v.air && sp > 12 && !(s.brake > g.time) && !(v.fz && v.fz.jump)) {
        s.brake = g.time + 1.6;
        g.audio.play('chute', 0.8);
      }
      if (s.brake > g.time && !v.air) {
        const k = Math.exp(-2.6 * dt);
        v.vx *= k;
        v.vz *= k;
      }
      s.open = !!v.fzChute || s.brake > g.time;
    },
    animate(G, v, o, dt, s) {
      const gr = o.m.userData.groups;
      if (!gr || !gr.canopy) return;
      const n = gr.canopy.node;
      const k = damp(n.scale.x, s.open ? 1 : 0.001, s.open ? 6 : 4, dt);
      n.scale.setScalar(k);
      n.visible = k > 0.02;
    },
    drawOn(G, v, p, s, fr) {
      if (!s.open) return;
      const sh = p.shape;
      if (!sh || !sh.canopyAt) return;
      const [cx, cy, cz] = sh.canopyAt;
      const R = sh.canopyR || 2;
      onCar(v, 0, cy - 1.1, -(v.halfLen || 2.3) + 0.05, _a);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        onCar(v, cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz, _b);
        fr.lineXYZ(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, [0.3, 0.3, 0.34], 1.6, 8300 + i, 0.9, 0.004, 0);
      }
    },
  },

  // ------------------------------------------------------------------ the balloon's levels
  balloon: {
    // (level 1 as drawn - a small one only slows a fall; level 2 bigger; level 3 its burner lifts the car
    // however small it was drawn)
    apply(G, v, p, H, fz, lv) {
      if (fz.balloon) fz.balloon = Math.max(fz.balloon * [1, 1.3, 1.6][lv - 1], [0, 0.8, 1.3][lv - 1]);
    },
  },

  // ------------------------------------------------------------------ the folding bridge
  // (driving at a gap or the water's edge with the other side in reach, the ruler unfolds forward and lies
  // across it - drive over; it folds away after)
  bridge: {
    update(G, v, p, dt, s, K, lv) {
      const g = G.game;
      if (v.air || s.cool > 0 || (s.bridge && !s.bridge.done)) return;
      const sp = v.speed || 0;
      if (sp < 2.5) return;
      const y0 = v.pos.y || 0;
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      const hl = v.halfLen || 2.3;
      // a gap: the floor 3-5 m ahead well under the car, or the sea
      const ax = v.pos.x + fx * (hl + 3);
      const az = v.pos.z + fz * (hl + 3);
      const fa = floorAhead(G, ax, az, y0 + 0.5);
      const wet = isWater(ax, az) && fa < y0 - 0.5;
      if (!wet && fa > y0 - 1.6) return;
      // the other side: a floor about as high (up to two metres lower: the deck slopes down to it), within
      // the bridge's reach
      const Lmax = BRIDGE_L[lv - 1];
      let far = null;
      let farY = y0;
      for (let d = hl + 4; d <= hl + Lmax; d += 0.5) {
        const x = v.pos.x + fx * d;
        const z = v.pos.z + fz * d;
        const f = floorAhead(G, x, z, y0 + 1.2);
        // (not the water itself - a deck over it, lower, is a far side)
        if (f > y0 - 2.2 && !(isWater(x, z) && f < 0)) {
          far = d;
          farY = Math.min(y0, f);
          break;
        }
      }
      if (far === null) {
        if (!s.told || g.time - s.told > 4) {
          s.told = g.time;
          g.hud.toast(`הצד השני רחוק מ־${Lmax} מטר`, 'bad', 1.8);
        }
        return;
      }
      if (!G.use(p)) return;
      const len = far - hl + 2.5;
      const x0 = v.pos.x + fx * (hl - 0.6);
      const z0 = v.pos.z + fz * (hl - 0.6);
      s.bridge = { kit: 'deck', x0, z0, y: y0, y1: farY, fx, fz, len, w: Math.max(2.4, ((p.n && p.n.width) || 1.8) + 0.6), t0: g.time, life: 30, v };
      G.live.push(s.bridge);
      // (game/mission.js: over the broken bridge on it)
      v.fzBridgeT = g.time;
      g.audio.play('clank', 0.8);
      g.audio.play('pageflip', 0.6);
    },
  },
  // (the deck laid: its floor, its model - a ruler unfolding)
  deck: {
    step(G, o, dt) {
      const g = G.game;
      const t = g.time - o.t0;
      if (!o.model) this.build(G, o);
      const k = clamp(t / 0.8, 0, 1);
      o.k = 1 - (1 - k) ** 3;
      const fold = t > o.life - 1 ? clamp(o.life - t, 0, 1) : 1;
      o.k *= fold;
      if (o.model) {
        o.model.scale.z = Math.max(0.01, o.k);
        o.model.updateMatrix();
      }
      // (gone once the car is well past it, or its time is up)
      const v = o.v;
      const far = v && Math.hypot(v.pos.x - (o.x0 + o.fx * o.len), v.pos.z - (o.z0 + o.fz * o.len)) > 40 && Math.hypot(v.pos.x - o.x0, v.pos.z - o.z0) > 40;
      if (far && t > 3 && o.life - t > 1) o.life = t + 1;
      return t > o.life;
    },
    gone(G, o) {
      o.done = true;
      if (o.model && o.model.parent) o.model.parent.remove(o.model);
    },
    floorAt(G, o, x, z, y) {
      if (!o.k || o.k < 0.6) return -Infinity;
      const dx = x - o.x0;
      const dz = z - o.z0;
      const along = dx * o.fx + dz * o.fz;
      const across = Math.abs(-dx * o.fz + dz * o.fx);
      if (along < -0.5 || along > o.len * o.k || across > o.w / 2) return -Infinity;
      // (sloping down to the far side, if that is lower)
      const h = o.y + ((o.y1 === undefined ? o.y : o.y1) - o.y) * clamp(along / o.len, 0, 1);
      if (y < h - 2.5) return -Infinity;
      return h + 0.08;
    },
    build(G, o) {
      // a giant ruler: its body, its centimetre marks, a metre's long, its numbers' blocks, side rails
      const Kt = new Kit();
      const M = itemMats();
      const yel = linC(0.98, 0.84, 0.32);
      const dark = linC(0.12, 0.12, 0.14);
      const dy = (o.y1 === undefined ? o.y : o.y1) - o.y;
      const L = Math.hypot(o.len, dy);
      const W = o.w;
      Kt.box(M.paint, -W / 2, -0.12, 0, W / 2, 0.08, L, yel);
      for (let i = 0; i <= Math.floor(L * 10); i++) {
        const z = i * 0.1;
        const long = i % 10 === 0;
        const mid = i % 5 === 0;
        Kt.box(M.matte, W / 2 - (long ? 0.6 : mid ? 0.4 : 0.22), 0.08, z - 0.012, W / 2 - 0.02, 0.095, z + 0.012, dark);
        if (long) Kt.box(M.matte, W / 2 - 0.95, 0.08, z + 0.05, W / 2 - 0.75, 0.095, z + 0.25, dark);
      }
      for (const s of [1, -1]) Kt.box(M.metal, s * (W / 2 + 0.02) - 0.04, 0.0, 0, s * (W / 2 + 0.02) + 0.04, 0.35, L, linC(0.3, 0.3, 0.33));
      const m = Kt.build({ seed: 0.4 });
      const root = new THREE.Group();
      root.add(m);
      root.position.set(o.x0, o.y, o.z0);
      root.rotation.set(Math.atan2(-dy, o.len), Math.atan2(o.fx, o.fz), 0, 'YXZ');
      root.matrixAutoUpdate = false;
      root.updateMatrix();
      G.game.scene.add(root);
      o.model = root;
    },
  },
};
