// (ROADMAP 28.15) The big links: a ride held by another - on a cable behind it (a tow), clamped to its side or its tail
// (the dual chassis link: two rides, one thing, both engines), on its roof (the cargo mount - and off it again, launched).
// One button for all of it: near another ride it says what it would do - TOW, LINK, LOAD - and with something held it
// says SPLIT or LAUNCH. A held ride does not drive itself: Vehicle.update hands it to hold() here, which puts it where its
// holder takes it. Not kept in a save: the rides are, each where it stood.
import * as THREE from 'three';
import { tr } from '../core/lang.js';
import { clamp, damp, dampAngle } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { KINDS } from '../render/cars.js';
import { trayIdsOn } from './traycat.js';

// how near the other ride must be (between their bodies), and a cable's length
const REACH = 4.5;
const CABLE_MIN = 2.2;
const CABLE_MAX = 6;
// the bodies with a back to carry a car on; a car carries a motorbike
const BIG = new Set(['truck', 'van', 'monster', 'armored', 'firetruck', 'limo', 'garbage', 'ambulance', 'classic']);
const HELD = new Set(['car', 'bike', 'boat']);
const LEADS = new Set(['car', 'bike', 'boat']);

// where b is in a's frame: f ahead of its middle, r to its right
function local(a, x, z) {
  const dx = x - a.pos.x;
  const dz = z - a.pos.z;
  const s = Math.sin(a.yaw);
  const c = Math.cos(a.yaw);
  return { f: dx * s + dz * c, r: dx * c - dz * s };
}

// the top of a ride to stand another on: a lorry's or a van's box, or a car's roof - how high, how far along, how long
export function carrySpot(v) {
  const K = v.kind === 'car' ? KINDS[v.carKind] : null;
  if (!K) return { y: v.heightM || 1.3, z: 0, room: (v.halfLen || 2) * 1.2 };
  let top = 0;
  for (const [, h] of K.belt) top = Math.max(top, h);
  if (top > (K.roofY || 0) + 0.2) {
    let t0 = 1;
    let t1 = 0;
    for (const [t, h] of K.belt) {
      if (h > top - 0.15) {
        t0 = Math.min(t0, t);
        t1 = Math.max(t1, t);
      }
    }
    return { y: top, z: ((t0 + t1) / 2 - 0.5) * K.len, room: (t1 - t0) * K.len };
  }
  return { y: K.roofY || 1.45, z: -0.15, room: K.len * 0.5 };
}

const canCarry = (a, b) => a.kind === 'car' && (b.kind === 'bike' || (b.kind === 'car' && BIG.has(a.carKind) && !BIG.has(b.carKind)));

export class Links {
  constructor(game) {
    this.game = game;
    this.pairs = [];
    this.now = null;
    this.sig = '';
    const b = document.createElement('button');
    b.id = 'ln-btn';
    b.className = 'bt-mode ln-btn';
    b.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 12 H15 M8 8 H6 a4 4 0 0 0 0 8 H8 M16 8 H18 a4 4 0 0 1 0 8 H16"/></svg><b></b>${game.touch ? '' : '<kbd>L</kbd>'}`;
    for (const ev of ['mousedown', 'click', 'touchstart', 'touchmove', 'touchend', 'contextmenu', 'wheel']) b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.press();
    });
    document.body.appendChild(b);
    this.btn = b;
    this.label = b.querySelector('b');
    if (!game.touch) {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyL' && !e.repeat && game.state === 'play' && !(game.tray && game.tray.isOpen)) this.press();
      });
    }
    this.cableGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
    this.cableMat = new THREE.MeshBasicMaterial({ color: 0xf0b429 });
  }

  // what holds v, and what v holds
  pairOf(v) {
    return v ? this.pairs.find((p) => p.b === v) || null : null;
  }

  heldBy(v) {
    return v ? this.pairs.filter((p) => p.a === v) : [];
  }

  // v and all that goes with it: what it holds, and what those hold
  groupOf(v) {
    const out = [v];
    for (let i = 0; i < out.length; i++) for (const p of this.pairs) if (p.a === out[i] && !out.includes(p.b)) out.push(p.b);
    return out;
  }

  free(v, me) {
    const p = this.game.player;
    return !!v && v !== me && !v.dead && !v.materializing && !v.driver && !v.police && !v.ai && !v.held && !v.script && v !== p.inVehicle && HELD.has(v.kind) && !v.hybrid;
  }

  // what the button would do now: { act, other, label, pair } - or null
  offer() {
    const g = this.game;
    const p = g.player;
    const v = p.inVehicle;
    if (!v || v.dead || g.state !== 'play' || (g.prologue && g.prologue.active) || (g.tray && g.tray.isOpen)) return null;
    // with something held: it lets go (the one on the roof first - it is launched)
    const mine = this.heldBy(v);
    const cargo = mine.find((q) => q.kind === 'cargo');
    if (cargo) return { act: 'launch', pair: cargo, label: tr('שגר', 'Launch') };
    if (mine.length) return { act: 'split', pair: mine[mine.length - 1], label: tr('נתק', 'Split') };
    if (!LEADS.has(v.kind) || v.hybrid || v.air || v.held || g.time < (this.quietT || 0)) return null;
    // the nearest ride standing free
    let best = null;
    for (const o of g.vehicles.list) {
      if (!this.free(o, v)) continue;
      const L = local(v, o.pos.x, o.pos.z);
      const gapF = Math.abs(L.f) - v.halfLen - o.halfLen;
      const gapR = Math.abs(L.r) - v.halfWid - o.halfWid;
      const gap = Math.max(gapF, gapR, 0);
      if (gap > REACH || Math.abs((o.pos.y || 0) - (v.pos.y || 0)) > 2.5) continue;
      if (!best || gap < best.gap) best = { o, L, gap, gapF, gapR };
    }
    if (!best) return null;
    const o = best.o;
    const water = v.kind === 'boat' || o.kind === 'boat';
    // you in the small one, by one that carries: up onto it; you in the one that carries, a small one by it: it comes up
    if (!water && canCarry(o, v) && this.hasMount(o) && !this.heldBy(o).length) return { act: 'load', a: o, b: v, label: tr('העמס', 'Load') };
    if (!water && canCarry(v, o) && (this.hasMount(v) || this.canFit(v, 'cargo'))) return { act: 'load', a: v, b: o, label: tr('העמס', 'Load') };
    // beside you: clamped side to side; before or behind you, close: tail to nose; further behind: on a cable
    const side = best.gapR > -0.3 && best.gapF < 0;
    if (!water && side && best.gapR < 2.2 && v.kind === 'car' && o.kind === 'car') return { act: 'dual', a: v, b: o, side: Math.sign(best.L.r) || 1, label: tr('חבר', 'Link') };
    if (best.L.f < 0 || water) return { act: 'tow', a: v, b: o, label: tr('גרור', 'Tow') };
    if (!water && v.kind === 'car' && o.kind === 'car') return { act: 'dual', a: v, b: o, side: 0, front: true, label: tr('חבר', 'Link') };
    return null;
  }

  hasMount(v) {
    return v.carBp === 'cargobrute' || trayIdsOn(v).has('cargo');
  }

  canFit(v, id) {
    const T = this.game.tray;
    return !!T && !T.cannot(id, v);
  }

  // the part a link wants on your ride: on already, or put on now (the first time, drawn over its guide: the button
  // again after it)
  need(v, id) {
    if (trayIdsOn(v).has(id)) return true;
    const T = this.game.tray;
    if (!T || this.game.player.inVehicle !== v) return false;
    return !!T.attach(id, { quiet: true });
  }

  press() {
    const g = this.game;
    const o = this.offer();
    if (!o) return false;
    if (o.act === 'launch') return this.launch(o.pair);
    if (o.act === 'split') return this.split(o.pair, true);
    if (o.act === 'tow') return this.join('tow', o.a, o.b, o);
    if (o.act === 'dual') {
      if (!this.need(o.a, 'duallink')) return false;
      return this.join('dual', o.a, o.b, o);
    }
    if (o.act === 'load') {
      if (!this.hasMount(o.a) && !this.need(o.a, 'cargo')) return false;
      const me = g.player.inVehicle;
      const ok = this.join('cargo', o.a, o.b, o);
      // (you were in the one that went up: now at the wheel of the one under it)
      if (ok && me === o.b) {
        g.exitVehicle(true);
        g.enterVehicle(o.a);
      }
      return ok;
    }
    return false;
  }

  join(kind, a, b, o = {}) {
    const g = this.game;
    if (!a || !b || a === b || b.held || this.groupOf(b).includes(a)) return false;
    const pair = { kind, a, b, k: 0, from: { x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: b.yaw } };
    if (kind === 'tow') {
      const hx = a.pos.x - Math.sin(a.yaw) * (a.halfLen + 0.2);
      const hz = a.pos.z - Math.cos(a.yaw) * (a.halfLen + 0.2);
      // (its nose to you, whichever end was nearer)
      const L = local(b, hx, hz);
      if (L.f < 0) b.yaw += Math.PI;
      const nx = b.pos.x + Math.sin(b.yaw) * b.halfLen;
      const nz = b.pos.z + Math.cos(b.yaw) * b.halfLen;
      pair.len = clamp(Math.hypot(hx - nx, hz - nz), CABLE_MIN, CABLE_MAX);
      pair.cable = new THREE.Mesh(this.cableGeo, this.cableMat);
      pair.cable.frustumCulled = false;
      g.scene.add(pair.cable);
    } else if (kind === 'dual') {
      pair.off = o.side ? { r: o.side * (a.halfWid + b.halfWid + 0.12), f: 0 } : { r: 0, f: (o.front ? 1 : -1) * (a.halfLen + b.halfLen + 0.25) };
    } else {
      const s = carrySpot(a);
      pair.off = { r: 0, f: s.z, y: s.y + (b.kind === 'bike' ? 0.02 : 0.04) };
    }
    b.held = pair;
    b.speed = 0;
    b.vx = 0;
    b.vz = 0;
    b.air = false;
    b.vy = 0;
    this.pairs.push(pair);
    this.weigh(a);
    g.audio.play('clank', 0.6);
    g.fx.sparks(b.pos.x, (b.pos.y || 0) + 0.6, b.pos.z, 8, [1, 0.85, 0.4]);
    const name = b.bp ? b.bp.name : tr('הרכב', 'the ride');
    g.hud.toast(kind === 'tow' ? tr(`${name} על הכבל — גוררים`, `${name} is on the cable — towing`) : kind === 'dual' ? tr(`${name} מחובר: שני מנועים, רכב אחד`, `${name} linked: two engines, one ride`) : tr(`${name} על הגג — "שגר" משחרר אותו`, `${name} is on the roof — "Launch" lets it go`), 'good', 2.6);
    this.sig = null;
    return true;
  }

  // what its load does to the one that pulls: a tow slows it, a second engine makes it stronger, a load on the roof
  // makes it heavy
  weigh(a) {
    let top = 1;
    let power = 1;
    for (const p of this.heldBy(a)) {
      if (p.kind === 'tow') {
        top *= 0.86;
        power *= 0.8;
      } else if (p.kind === 'dual') {
        top *= 1.12;
        power *= 1.55;
      } else {
        top *= 0.94;
        power *= 0.85;
      }
    }
    a.linkK = top === 1 && power === 1 ? null : { top, power };
  }

  split(pair, say = false) {
    const g = this.game;
    const i = this.pairs.indexOf(pair);
    if (i < 0) return false;
    this.pairs.splice(i, 1);
    const { a, b } = pair;
    if (pair.cable) g.scene.remove(pair.cable);
    b.held = null;
    if (!b.dead) {
      // (off a roof: down beside it, on its wheels)
      if (pair.kind === 'cargo') {
        b.air = true;
        b.vy = 0;
      }
      b.speed = (a.speed || 0) * (pair.kind === 'tow' ? 0.5 : 1);
    }
    this.weigh(a);
    if (say) {
      g.audio.play('clank', 0.5);
      g.hud.toast(tr('נותק', 'Split'), 'info', 1.4);
    }
    this.sig = null;
    return true;
  }

  // off the roof at a run: you in it, out over the nose of what carried it
  launch(pair) {
    const g = this.game;
    const { a, b } = pair;
    const p = g.player;
    this.split(pair);
    if (b.dead) return false;
    if (p.inVehicle === a) {
      g.exitVehicle(true);
      g.enterVehicle(b);
    }
    b.yaw = a.yaw;
    b.speed = Math.max(0, a.speed || 0) + 15;
    b.vx = Math.sin(b.yaw) * b.speed;
    b.vz = Math.cos(b.yaw) * b.speed;
    b.air = true;
    b.vy = 6.5;
    b.climb = 6.5;
    // (its flight is its own from here: Vehicle.drive starts one that stood a second from standing still)
    b.physT = g.time;
    b.yawRate = 0;
    // (a moment before the button offers to put it back up)
    this.quietT = g.time + 1.5;
    g.audio.play('whoosh', 0.9);
    g.camRig.addShake(0.3);
    g.fx.sparks(b.pos.x, b.pos.y, b.pos.z, 12, [1, 0.9, 0.5]);
    g.hud.toast(tr('שוגר!', 'Launched!'), 'good', 1.6);
    return true;
  }

  // (Vehicle.update, for one that is held) where its holder takes it this frame
  hold(v, dt) {
    const pair = v.held;
    const a = pair.a;
    const ox = v.pos.x;
    const oz = v.pos.z;
    pair.k = Math.min(1, pair.k + dt / 0.45);
    const e = pair.k * pair.k * (3 - 2 * pair.k);
    const s = Math.sin(a.yaw);
    const c = Math.cos(a.yaw);
    if (pair.kind === 'tow') {
      const hx = a.pos.x - s * (a.halfLen + 0.2);
      const hz = a.pos.z - c * (a.halfLen + 0.2);
      const nx = v.pos.x + Math.sin(v.yaw) * v.halfLen;
      const nz = v.pos.z + Math.cos(v.yaw) * v.halfLen;
      const dx = hx - nx;
      const dz = hz - nz;
      const d = Math.hypot(dx, dz) || 1e-3;
      if (d > pair.len) {
        v.pos.x += (dx / d) * (d - pair.len);
        v.pos.z += (dz / d) * (d - pair.len);
      }
      // (its nose after the hitch, as a trailer's)
      const moved = Math.hypot(v.pos.x - ox, v.pos.z - oz);
      if (moved > 1e-4) v.yaw = dampAngle(v.yaw, Math.atan2(hx - v.pos.x, hz - v.pos.z), 7, dt);
      this.wall(v, a);
      const gy = v.kind === 'boat' && this.wet(v) ? -0.8 : groundHeight(v.pos.x, v.pos.z) * (v.kind === 'car' ? 1 : 0.5);
      v.pos.y = damp(v.pos.y, gy, 12, dt);
      v.speed = Math.hypot(v.pos.x - ox, v.pos.z - oz) / Math.max(dt, 1e-3);
      this.cableTo(pair, hx, (a.pos.y || 0) + 0.55, hz, v.pos.x + Math.sin(v.yaw) * v.halfLen, (v.pos.y || 0) + (v.kind === 'boat' ? 1.2 : 0.55), v.pos.z + Math.cos(v.yaw) * v.halfLen);
    } else {
      const O = pair.off;
      const tx = a.pos.x + s * O.f + c * O.r;
      const tz = a.pos.z + c * O.f - s * O.r;
      const ty = (a.pos.y || 0) + (O.y || 0);
      const F = pair.from;
      v.pos.x = F.x + (tx - F.x) * e;
      v.pos.z = F.z + (tz - F.z) * e;
      // (up onto a roof: over an arc)
      v.pos.y = F.y + (ty - F.y) * e + (pair.kind === 'cargo' ? Math.sin(e * Math.PI) * 1.2 : 0);
      v.yaw = pair.k < 1 ? dampAngle(v.yaw, a.yaw, 10, dt) : a.yaw;
      if (pair.kind === 'dual' && pair.k >= 1) this.wall(v, a);
      v.speed = a.speed || 0;
      v.bodyPitch = a.bodyPitch || 0;
    }
    v.speedAbs = Math.abs(v.speed);
    v.vx = (v.pos.x - ox) / Math.max(dt, 1e-3);
    v.vz = (v.pos.z - oz) / Math.max(dt, 1e-3);
  }

  wet(v) {
    return groundHeight(v.pos.x, v.pos.z) < -0.3;
  }

  // a held one against a wall: it does not go through it - and what holds it is held back by as much
  wall(v, a) {
    const col = this.game.world.collision;
    _p.set(v.pos.x, (v.pos.y || 0) + 0.3, v.pos.z);
    const x0 = _p.x;
    const z0 = _p.z;
    const res = col.resolveCylinder(_p, Math.max(0.6, v.halfWid), 1.3, 0.5);
    if (!res.hitWall) return;
    const dx = _p.x - x0;
    const dz = _p.z - z0;
    v.pos.x = _p.x;
    v.pos.z = _p.z;
    if (v.held.kind === 'dual') {
      a.pos.x += dx;
      a.pos.z += dz;
      a.speed *= 0.97;
    }
  }

  cableTo(pair, x0, y0, z0, x1, y1, z1) {
    const m = pair.cable;
    if (!m) return;
    _a.set(x0, y0, z0);
    _b.set(x1, y1, z1);
    const len = _a.distanceTo(_b);
    m.position.copy(_a).add(_b).multiplyScalar(0.5);
    m.scale.set(1, Math.max(0.01, len), 1);
    m.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize());
  }

  update() {
    const g = this.game;
    const list = g.vehicles.list;
    // what is gone lets go, and is let go of
    for (const p of this.pairs.slice()) {
      if (p.a.dead || p.b.dead || !list.includes(p.a) || !list.includes(p.b)) this.split(p);
    }
    const o = this.offer();
    this.now = o;
    const sig = o ? `${o.act}|${o.label}` : '';
    if (sig !== this.sig) {
      this.sig = sig;
      this.btn.classList.toggle('on', !!o);
      this.btn.dataset.act = o ? o.act : '';
      if (o) this.label.textContent = o.label;
    }
  }

  // (a save put back, a new game: nothing is held)
  clear() {
    for (const p of this.pairs.slice()) this.split(p);
  }
}

const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
