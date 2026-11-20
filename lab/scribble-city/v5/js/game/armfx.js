// (ROADMAP 28.19) What a real weapon does when it fires, beyond the shot itself: it kicks back in the hands, its
// action throws out a case and a link, fire and gas come out of the slots of its flash hider, its barrel heats and
// smokes, its belt runs through it; it is steadier off its bipod and wilder on the move; a new belt is laid in under
// its feed cover and the bolt is racked. game/weapons.js asks here at each shot and each frame; a gun with nothing
// of its own here still kicks in the hands.
//
// The frame of a held thing: +z to the muzzle, +y up, +x to the shooter's LEFT (game/arms.js).
import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _e = new THREE.Euler();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion();
const _s0 = new THREE.Vector3();
const _pole = new THREE.Vector3();

const FIRE = [2.6, 1.7, 0.6]; // (brighter than the page: it glows, render/LineBatch)
const FIRE2 = [2.4, 1.0, 0.3];
const TRACER = [2.9, 0.8, 0.2];
const TRACER_CORE = [3.2, 2.4, 1.3];
const LACQUER = [0.96, 0.74, 0.14];
const BRASS = [0.8, 0.62, 0.26];
const LINK = [0.16, 0.16, 0.2];
const GRAPHITE = [0.22, 0.22, 0.26];
const DUST = [0.86, 0.84, 0.78];
const STEEL = [0.78, 0.8, 0.86];
const INKDARK = [0.07, 0.07, 0.1];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => t * t * (3 - 2 * t);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// how far back a gun comes in the hands at a shot (m), by what it fires
function recoilOf(def) {
  if (def.recoil !== undefined) return def.recoil;
  if (def.projectile === 'eraser') return 0.07;
  if (def.pellets) return 0.055;
  if (def.projectile === 'pencil') return 0.03;
  if (def.projectile === 'plane' || def.projectile === 'glue') return 0.02;
  return 0.011;
}

// ---------------------------------------------------------------------------------------------- the MAG
const MAG = {
  reach: 0.46, // the right hand nearer the shoulder: the butt in it
  side: 0.12,
  recoil: 0.02,

  init(st) {
    st.heat = 0;
    st.bip = 0;
    st.belt = 0;
    st.climb = 0;
    st.n = 0;
    st.burst = 0;
    st.smokeT = 0;
    st.rl = -1;
    st.cover = 0;
    st.cock = 0;
    st.heatShown = -1;
  },

  // off its legs (kneeling, still) it holds its line; on the move it walks about; hot, wider still
  spread(A, slot, st) {
    return (1.3 - 1.0 * st.bip) * (1 + st.climb * 1.5) * (st.heat > 0.85 ? 1.3 : 1);
  },

  kick(A, slot, st) {
    return 1 - 0.6 * st.bip;
  },

  fired(A, slot, st, m, d) {
    const game = A.game;
    const fx = game.fx;
    const model = slot.model;
    st.heat = Math.min(1.15, st.heat + 1 / 80);
    st.climb = Math.min(1, st.climb + 0.1 * (1 - st.bip * 0.8));
    st.belt = 1;
    st.burst++;
    st.n++;
    // (the gun's own axes in the world)
    const g = model.group;
    _x.setFromMatrixColumn(g.matrixWorld, 0).normalize();
    _y.setFromMatrixColumn(g.matrixWorld, 1).normalize();
    // the flash: a bright heart, a tongue of fire ahead, fire out of the slots of the hider all round
    fx.sprite('flash', m.x + d.x * 0.06, m.y + d.y * 0.06, m.z + d.z * 0.06, { size: 0.42 + Math.random() * 0.3, grow: 0.35, life: 0.055, tint: [2.2, 1.9, 1.45] });
    fx.spray(m.x, m.y, m.z, d.x, d.y, d.z, 4, 34, FIRE, { cone: 0.07, wide: 3.6, len: 0.75, life: 0.055, grav: false });
    const ph = Math.random() * Math.PI;
    for (let i = 0; i < 6; i++) {
      const a = ph + (i / 6) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      fx.spray(m.x - d.x * 0.03, m.y - d.y * 0.03, m.z - d.z * 0.03, _x.x * c + _y.x * s + d.x * 0.55, _x.y * c + _y.y * s + d.y * 0.55, _x.z * c + _y.z * s + d.z * 0.55, 1, 15, FIRE2, { cone: 0.05, wide: 2.8, len: 0.34, life: 0.05, grav: false });
    }
    // (the grey of it, drifting off: now and then, more as it heats)
    if (st.n % 3 === 0) fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', m.x + d.x * 0.3, m.y + d.y * 0.3 + 0.05, m.z + d.z * 0.3, { size: 0.2 + st.heat * 0.14, grow: 1.8, life: 0.5 + st.heat * 0.4, vx: d.x * 2.6, vy: 0.6, vz: d.z * 2.6, alpha: 0.26 });
    // the spent case drops out from under it, the link out of its right side
    if (model.eject) {
      _a.copy(model.eject).applyMatrix4(g.matrixWorld);
      fx.spray(_a.x, _a.y, _a.z, -_x.x * 0.9 + _y.x * 0.5 - d.x * 0.15, -_x.y * 0.9 + _y.y * 0.5 + 0.2, -_x.z * 0.9 + _y.z * 0.5 - d.z * 0.15, 1, 3.4, LINK, { cone: 0.25, bits: true, len: 0.016, life: 1.3 });
      _a.set(0, 0.022, model.eject.z).applyMatrix4(g.matrixWorld);
      fx.spray(_a.x, _a.y, _a.z, -_x.x * 0.45 - _y.x * 0.8 + d.x * 0.1, -_x.y * 0.45 - _y.y * 0.8, -_x.z * 0.45 - _y.z * 0.8 + d.z * 0.1, 1, 3.2, Math.random() < 0.7 ? LACQUER : BRASS, { cone: 0.22, bits: true, len: 0.03, life: 2.2 });
    }
  },

  // each frame it is in the hands: its legs, its belt, its cover and bolt in a reload, the heat of its barrel
  held(A, slot, st, dt, m) {
    const game = A.game;
    const p = game.player;
    const model = slot.model;
    const P = model.parts;
    if (!P) return;
    const firing = game.time - (slot.fxShot || -9) < 0.2;
    // (down on a knee, still: the legs come down and it sits on them)
    const sp = Math.hypot(p.vel.x, p.vel.z);
    const braced = p.crouched && p.onGround && sp < 1.2 && p.mode === 'foot';
    st.bip = damp(st.bip, braced ? 1 : 0, 9, dt);
    if (P.bipod) P.bipod.group.rotation.x = P.bipod.fold * (1 - ease(clamp01(st.bip)));
    st.climb = Math.max(0, st.climb - dt * 2.4);
    // the belt: a round across at each shot
    st.belt = Math.max(0, st.belt - dt / 0.06);
    const ar = game.arsenal;
    const reloading = !!(ar && ar.reloadT > 0 && ar.slot === slot);
    let u = -1;
    if (reloading) u = 1 - ar.reloadT / (ar.reloadFull || 3.6);
    if (P.belt) {
      P.belt.group.position.x = (model.beltPitch || 0.015) * st.belt;
      P.belt.group.position.y = Math.sin(st.belt * Math.PI) * 0.0025;
      P.belt.group.visible = reloading ? u > 0.44 : slot.mag === undefined || slot.mag > 0;
    }
    // a new belt: the cover up, the belt laid in, the cover slapped shut, the bolt racked
    if (reloading) {
      const stage = u < 0.08 ? 0 : u < 0.4 ? 1 : u < 0.62 ? 2 : u < 0.78 ? 3 : 4;
      if (stage !== st.rl) {
        st.rl = stage;
        if (stage === 1) game.audio.play('magOpen', 0.8);
        else if (stage === 2) game.audio.play('magBelt', 0.8);
        else if (stage === 3) game.audio.play('magShut', 0.9);
        else if (stage === 4) game.audio.play('magRack', 0.9);
      }
      st.cover = damp(st.cover, u > 0.08 && u < 0.62 ? 1 : 0, u < 0.62 ? 11 : 30, dt);
      const k = u < 0.78 ? 0 : u < 0.87 ? (u - 0.78) / 0.09 : u < 0.9 ? 1 : Math.max(0, 1 - (u - 0.9) / 0.03);
      st.cock = k;
    } else {
      st.rl = -1;
      st.cover = damp(st.cover, 0, 26, dt);
      // (at each shot the handle stays where it is: on this gun it does not go with the bolt)
      st.cock = 0;
    }
    if (P.cover) P.cover.group.rotation.x = st.cover * 1.25;
    if (P.cock) P.cock.group.position.z = -0.14 * ease(clamp01(st.cock));
    // the heat of the barrel: cools slowly; hot, it glows through, and smokes when the firing stops
    st.heat = Math.max(0, st.heat - dt * (firing ? 0.045 : 0.055));
    if (!firing) st.burst = 0;
    if (P.heat) {
      const k = clamp01((st.heat - 0.45) / 0.55);
      const hg = P.heat.group;
      hg.visible = k > 0.01;
      if (hg.visible && Math.abs(k - st.heatShown) > 0.02) {
        st.heatShown = k;
        const r = 0.12 + 0.95 * k;
        const gg = 0.015 + 0.24 * k * k;
        const bb = 0.01 + 0.04 * k * k;
        for (const mesh of hg.children) {
          const col = mesh.geometry.attributes.color;
          const arr = col.array;
          for (let i = 0; i < arr.length; i += 3) {
            arr[i] = r;
            arr[i + 1] = gg;
            arr[i + 2] = bb;
          }
          col.needsUpdate = true;
        }
      }
    }
    if (st.heat > 0.4 && model.barrelAt && g_visible(model.group)) {
      st.smokeT -= dt;
      if (st.smokeT <= 0) {
        st.smokeT = firing ? 0.3 : 0.16 + (1 - st.heat) * 0.2;
        const B = model.barrelAt;
        _a.set(0, B[2] + B[3], B[0] + (B[1] - B[0]) * Math.random()).applyMatrix4(model.group.matrixWorld);
        // (thin wisps off the steel, climbing)
        game.fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', _a.x, _a.y, _a.z, { size: 0.05 + st.heat * 0.05, grow: 2.2, life: 0.7 + Math.random() * 0.5, vy: 0.5 + Math.random() * 0.35, vx: (Math.random() - 0.5) * 0.2, vz: (Math.random() - 0.5) * 0.2, alpha: 0.1 + st.heat * 0.12, aspect: 0.7 });
      }
    }
  },

  // a new belt, with the hands: the gun brought down across the body; the left hand lifts the cover, fetches the
  // belt out of the tin and lays it on the tray, slaps the cover shut and takes the gun's weight - and the right
  // hauls the cocking handle back and lets it go. (u: how far through; gun-space points, +x his left)
  reloadHold: { pos: [0.17, -0.37, 0.27], dir: [-0.4, -0.26, 0.88], up: [0.26, 1, 0] },
  reloadLeft: [
    [0.0, 0.0, 0.016, 0.2],
    [0.07, 0.0, 0.156, 0.05],
    [0.16, 0.0, 0.27, 0.15],
    [0.25, 0.09, 0.05, 0.15],
    [0.34, 0.09, 0.05, 0.15],
    [0.44, 0.03, 0.136, 0.14],
    [0.5, 0.02, 0.13, 0.14],
    [0.57, 0.0, 0.3, 0.2],
    [0.63, 0.0, 0.158, 0.12],
    [0.7, 0.0, 0.016, 0.2],
    [1.0, 0.0, 0.016, 0.2],
  ],
  // (the right hand: on the grip; off to the handle on the gun's right for the rack)
  reloadRight(st, u, out) {
    if (u < 0.72 || u > 0.97) return out.set(0, 0, 0);
    const k = u < 0.78 ? ease((u - 0.72) / 0.06) : u < 0.92 ? 1 : 1 - ease((u - 0.92) / 0.05);
    return out.set(-0.066 * k, 0.08 * k, (0.163 - 0.14 * ease(clamp01(st.cock))) * k);
  },

  // the trigger let go after a burst: the street answers it
  released(A, slot, st) {
    if (st.burst >= 3) A.game.audio.play('magTail', Math.min(1, 0.5 + st.burst * 0.04));
  },
};

const g_visible = (g) => !!g && g.visible !== false;

const FX = { mag: MAG };

export class ArmFx {
  constructor(game) {
    this.game = game;
    this.lastT = 0;
    this.heldSlot = null;
    this.wasFiring = false;
  }

  of(slot) {
    return slot && slot.def ? FX[slot.def.id] || null : null;
  }

  st(slot, F) {
    if (!slot.fx) {
      slot.fx = { rec: 0, jx: 0 };
      if (F && F.init) F.init(slot.fx);
    }
    return slot.fx;
  }

  // how wide it throws now, how hard it shakes the eye (game/weapons.js fireGun multiplies by these)
  spreadK(slot) {
    const F = this.of(slot);
    return F && F.spread ? F.spread(this, slot, this.st(slot, F)) : 1;
  }

  kickK(slot) {
    const F = this.of(slot);
    return F && F.kick ? F.kick(this, slot, this.st(slot, F)) : 1;
  }

  // a shot of it leaves (pr: what flies)
  shot(slot, pr) {
    const F = this.of(slot);
    if (F && F.shot) F.shot(this, slot, this.st(slot, F), pr);
  }

  // it has fired: m its muzzle, d the way it fired (true: its flash and sound are its own here)
  fired(slot, m, d) {
    const F = this.of(slot);
    const st = this.st(slot, F);
    st.rec = 1;
    st.jx = (Math.random() - 0.5) * 2;
    slot.fxShot = this.game.time;
    if (F && F.fired) {
      F.fired(this, slot, st, m, d);
      return true;
    }
    return false;
  }

  // the gun in the hands this frame: m its matrix (pushed back by its kick here), then what moves on it
  pose(slot, m) {
    const game = this.game;
    const dt = Math.min(0.1, Math.max(0, game.time - this.lastT));
    this.lastT = game.time;
    const def = slot.def;
    if (!def || (def.kind !== 'gun' && def.kind !== 'beam')) return;
    const F = this.of(slot);
    const st = this.st(slot, F);
    if (st.rec > 0.001) {
      const r = (F && F.recoil !== undefined ? F.recoil : recoilOf(def)) * st.rec;
      _e.set(-r * 0.55, st.jx * r * 0.2, 0);
      m.multiply(_m.makeRotationFromEuler(_e));
      m.multiply(_m.makeTranslation(0, 0, -r));
      st.rec *= Math.exp(-dt * 24);
    } else st.rec = 0;
    const fig = game.player.fig;
    const ar = game.arsenal;
    const reloading = !!(ar && ar.reloadT > 0 && ar.slot === slot);
    // (a reload done with the hands: the gun brought to where they work on it)
    if (F && F.reloadHold) {
      st.rk = damp(st.rk || 0, reloading && game.player.mode === 'foot' ? 1 : 0, reloading ? 9 : 12, dt);
      if (st.rk > 0.004) {
        const H = F.reloadHold;
        const n = fig.j.neck;
        const f = fig.forward;
        const r = fig.right;
        _z.set(f.x * H.dir[2] + r.x * H.dir[0], H.dir[1], f.z * H.dir[2] + r.z * H.dir[0]).normalize();
        _y.set(f.x * H.up[2] + r.x * H.up[0], H.up[1], f.z * H.up[2] + r.z * H.up[0]);
        _x.crossVectors(_y, _z).normalize();
        _y.crossVectors(_z, _x).normalize();
        _m2.makeBasis(_x, _y, _z);
        _m2.setPosition(n.x + f.x * H.pos[2] + r.x * H.pos[0], n.y + H.pos[1], n.z + f.z * H.pos[2] + r.z * H.pos[0]);
        const k = ease(clamp01(st.rk));
        m.decompose(_p0, _q0, _s0);
        _m2.decompose(_p1, _q1, _s0);
        _p0.lerp(_p1, k);
        _q0.slerp(_q1, k);
        m.compose(_p0, _q0, _s0.set(1, 1, 1));
      }
    }
    if (F && F.held) F.held(this, slot, st, dt, m);
    // the hands on it, where it is this frame (game/doodle.js placeHand)
    if (slot.model && slot.model.hold && fig.placeHand && game.player.mode === 'foot') {
      const hold = slot.model.hold;
      if (F && st.rk > 0.5 && F.reloadLeft) {
        const u = reloading ? 1 - ar.reloadT / (ar.reloadFull || 3.6) : 1;
        const K = F.reloadLeft;
        let i = 0;
        while (i < K.length - 2 && u > K[i + 1][0]) i++;
        const a = K[i];
        const b = K[i + 1];
        const t = ease(clamp01((u - a[0]) / Math.max(1e-4, b[0] - a[0])));
        _a.set(a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t).applyMatrix4(m);
        // (the elbow out to his left and down: the arm comes over the gun, not through it)
        fig.placeHand(-1, _a, _pole.set(-fig.right.x * 0.9, -0.6, -fig.right.z * 0.9));
        F.reloadRight(st, u, _b).applyMatrix4(m);
        fig.placeHand(1, _b);
      } else if (fig.aim === 2) {
        // (aimed: the left hand under it, as far along its hold as the arm reaches - never off the gun)
        const sh = fig.j.shoulderL;
        const L = 0.6 * (fig.look.build.arms || 1) * fig.scale * 0.96;
        _a.set(hold.x, hold.y, 0.045).applyMatrix4(m);
        _b.copy(hold).applyMatrix4(m);
        let lo = 0;
        if (_b.distanceTo(sh) <= L) lo = 1;
        else if (_a.distanceTo(sh) < L) {
          let hi = 1;
          for (let i = 0; i < 7; i++) {
            const mid = (lo + hi) / 2;
            if (_p0.copy(_a).lerp(_b, mid).distanceTo(sh) <= L) lo = mid;
            else hi = mid;
          }
        }
        fig.placeHand(-1, _p0.copy(_a).lerp(_b, lo));
        // (and the right hand stays on its grip as the gun kicks)
        fig.placeHand(1, _p1.setFromMatrixPosition(m));
      }
    }
    // (the trigger let go)
    const firing = game.time - (slot.fxShot || -9) < 0.16;
    if (this.heldSlot === slot && this.wasFiring && !firing && F && F.released) F.released(this, slot, st);
    this.heldSlot = slot;
    this.wasFiring = firing;
  }

  // how the right hand holds it aimed (game/doodle.js): a long heavy gun nearer, its butt in the shoulder
  hands(slot, fig, aiming) {
    const F = this.of(slot);
    const m = slot.model;
    let reach = 0;
    let side = 0;
    if (aiming && m && m.hold && m.muzzle && m.length) {
      // (the butt in the shoulder: the hand as far ahead of it as the butt is long - less the little it is pressed in)
      reach = (F && F.reach) || m.reach || Math.min(0.55, Math.max(0.34, m.length - m.muzzle.z - 0.05));
      side = (F && F.side) || m.side || 0.12;
    }
    fig.aimReach = reach;
    fig.aimSide = side;
  }
}

// a heavy graphite slug in the air: a dark point and the line of the air it cuts; a tracer burns red all its way
export function drawSlug(fr, pr, ux, uy, uz) {
  const sp = Math.hypot(pr.vx, pr.vy, pr.vz);
  const far = Math.max(0.2, pr.t * sp);
  if (pr.tracer) {
    const L = Math.min(4.2, far);
    fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * L, pr.y - uy * L, pr.z - uz * L, TRACER, 3.2, pr.seed, 0.9, 0.005, 0);
    const c = Math.min(0.9, far);
    fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * c, pr.y - uy * c, pr.z - uz * c, TRACER_CORE, 5.2, pr.seed + 1, 1, 0.003, 0);
  } else {
    const L = Math.min(1.7, far);
    fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.2, pr.y - uy * 0.2, pr.z - uz * 0.2, GRAPHITE, 4.6, pr.seed, 1, 0.004, 0);
    fr.lineXYZ(pr.x - ux * 0.18, pr.y - uy * 0.18, pr.z - uz * 0.18, pr.x - ux * L, pr.y - uy * L, pr.z - uz * L, DUST, 1.3, pr.seed + 1, 0.4, 0.015, 0);
  }
}

// a slug lands on something of the world: it bites a hole, graphite and paper dust fly back off it, sparks off metal
export function slugWall(game, pr, hit, nx, ny, nz) {
  const fx = game.fx;
  fx.impact(hit.x, hit.y, hit.z, 0.55);
  fx.spray(hit.x, hit.y, hit.z, nx, ny + 0.2, nz, 5, 4.2, GRAPHITE, { cone: 0.8, bits: true, len: 0.035, life: 0.7 });
  fx.spray(hit.x, hit.y, hit.z, nx, ny + 0.3, nz, 3, 3, DUST, { cone: 0.9, bits: true, len: 0.03, life: 0.8 });
  fx.spray(hit.x, hit.y, hit.z, nx, ny, nz, 2, 9, pr.tracer ? FIRE2 : STEEL, { cone: 0.5, wide: 1.8, len: 0.22, life: 0.12, grav: false });
  if (Math.random() < 0.5) fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', hit.x + nx * 0.15, hit.y + ny * 0.15, hit.z + nz * 0.15, { size: 0.32, grow: 1.5, life: 0.55, vx: nx * 0.8, vy: 0.5 + ny * 0.6, vz: nz * 0.8, alpha: 0.4, tint: [0.92, 0.9, 0.86] });
  fx.splatAt(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 0.2 + Math.random() * 0.14, INKDARK);
}

// ... on somebody: graphite and ink off them
export function slugBody(game, pr, hit, ux, uy, uz) {
  const fx = game.fx;
  fx.spray(hit.x, hit.y, hit.z, -ux, -uy + 0.4, -uz, 4, 3.4, GRAPHITE, { cone: 0.8, bits: true, len: 0.035, life: 0.6 });
  fx.spray(hit.x, hit.y, hit.z, ux * 0.6, uy * 0.6 + 0.3, uz * 0.6, 3, 4.5, INKDARK, { cone: 0.5, wide: 3.2, len: 0.12, life: 0.35 });
}

// ... on a car: sparks, and a tracer's fire
export function slugCar(game, pr, hit) {
  game.fx.sparks(hit.x, hit.y, hit.z, 5, pr.tracer ? FIRE2 : STEEL);
}
