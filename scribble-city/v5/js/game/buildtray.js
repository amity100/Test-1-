import * as THREE from 'three';
import { tr } from '../core/lang.js';
import { clamp, damp } from '../core/util.js';
import { ITEMS } from './itemcat.js';
import { nOf } from './partpen.js';
import { TABS, TAB_NAME, TAB_ICON, TRAY, TRAY_IDS, SIZE, SIZED, info, fits, buildsOn, trayIdOf, trayIdsOn, fusionsOf, fusionOf, FUSIONS, metersOf, hintOf } from './traycat.js';
// (ROADMAP 28.8, 28.9) The parts tray: the way things are put on a ride.
//
// A part is drawn once - over a big guide of it, on a card - and from then on it is in the tray. In a ride, or beside
// one, the tray opens with one button: the ride turns in the middle of the picture, the parts in a row under it. A
// touch on a part and it is on the ride, at the place that is naturally its own; a touch on it again and it is off.
// Drawn from the tray onto the ride - a pencil line from the one to the other - it goes where the line ends: the
// places it can go light up, and before the finger lifts it is there as a dashed ghost, green if it will work and red
// with a few words if not. On the ride, a touch on a part chooses it: its size on a handle, and off. One button
// takes back the last thing done; one makes pairs (two turrets, two engines). Four meters - weight, power, lift,
// float - move as it is built, with a word on what it lacks. What it is now is kept as a build, and the last five
// keep themselves: a touch on one and its parts are on the ride you are in, one after another. Two parts that make
// something of each other get a card and a name the first time, and a page in the fusion book.
//
// The button held, anywhere: the quick wheel - the parts used most round the finger, the city slowed - to put one on
// in the middle of a chase.
//
// The pen that draws straight on the car (game/partpen.js) is still there, from the tray's own pencil.

const KEY = 'scribble-city-v5-tray';
const MAX_PARTS = 8;
const NS = 'http://www.w3.org/2000/svg';
const FAV0 = ['turbo', 'mg', 'armor', 'wing', 'rotor', 'jump', 'smoke', 'jet'];
const _p = new THREE.Vector3();
const _w = new THREE.Vector3();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const UPY = new THREE.Vector3(0, 1, 0);
const rnd = () => Math.random().toString(36).slice(2, 8);
const r2 = (x) => Math.round(x * 100) / 100;

// an icon's lines (the inside of an svg, in a 24 x 24 box) as lists of points: what the guide is drawn of, and what
// the tracing is held against
const LINES = new Map();
export function iconLines(inner) {
  if (LINES.has(inner)) return LINES.get(inner);
  const out = [];
  if (typeof document !== 'undefined' && document.body) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.cssText = 'position:absolute;left:-99px;top:-99px;width:24px;height:24px;visibility:hidden;pointer-events:none';
    svg.innerHTML = inner;
    document.body.appendChild(svg);
    for (const el of svg.querySelectorAll('path,circle,rect,line,ellipse,polyline,polygon')) {
      let len = 0;
      try {
        len = el.getTotalLength();
      } catch (err) {
        len = 0;
      }
      if (!(len > 0.5)) continue;
      const step = 0.45;
      const n = Math.max(2, Math.ceil(len / step));
      let cur = [];
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const q = el.getPointAtLength((len * i) / n);
        if (prev && Math.hypot(q.x - prev.x, q.y - prev.y) > step * 2.6) {
          if (cur.length > 1) out.push(cur);
          cur = [];
        }
        cur.push([q.x, q.y]);
        prev = q;
      }
      if (cur.length > 1) out.push(cur);
    }
    svg.remove();
  }
  LINES.set(inner, out);
  return out;
}

function boxOf(lines) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of lines) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1, w: Math.max(1e-3, x1 - x0), h: Math.max(1e-3, y1 - y0), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

const svgIcon = (inner, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24">${inner}</svg>`;

export class BuildTray {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.v = null;
    this.tab = 'func';
    this.mirror = false;
    this.sel = null;
    this.undoStack = [];
    this.openT = 0;
    // (the camera: how far in it is blended, round the ride, how high)
    this.ck = 0;
    this.camYaw = Math.PI + 0.75;
    this.camPitch = 0.36;
    this.camZoom = 1;
    this.drag = null;
    this.tracing = null;
    this.wheel = null;
    this.panel = null;
    this.sig = '';
    this.stats = { opened: 0, put: 0, off: 0, undone: 0, traced: 0, fusions: 0, wheel: 0, builds: 0 };
    this.store = this.load();
    if (TABS.includes(this.store.tab)) this.tab = this.store.tab;
    this.ui();
  }

  // ------------------------------------------------------------------ kept
  load() {
    const out = { learned: {}, fav: {}, builds: [], recent: [], book: [], tab: 'func', size: {}, vers: {} };
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        for (const k of Object.keys(out)) if (o[k] && typeof o[k] === typeof out[k]) out[k] = o[k];
      }
    } catch (err) {
      // (none kept)
    }
    return out;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.store));
    } catch (err) {
      // (not kept: no matter)
    }
  }

  // ------------------------------------------------------------------ whose
  // the ride to build on: the one you are in, or the nearest one standing by you with no one in it
  target() {
    const g = this.game;
    const p = g.player;
    if (p.inVehicle) return p.inVehicle.dead || !buildsOn(p.inVehicle) ? null : p.inVehicle;
    if (p.mode !== 'foot') return null;
    let best = null;
    let bd = 6.5;
    for (const v of g.vehicles.list) {
      if (v.dead || v.materializing || (v.driver && v.driver !== p) || v.police || v.ai || !buildsOn(v)) continue;
      const d = Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) - (v.halfLen || 2);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  // (the tray is the pencil's in a ride - but the story's own drawing lessons keep the pen they were written for)
  wanted() {
    const g = this.game;
    if (g.classic || g.state !== 'play') return false;
    if (g.params && (g.params.get('tray') === '0' || g.params.get('draw') === 'old')) return false;
    const P = g.prologue;
    if (P && P.active && !g.lab) return false;
    return true;
  }

  can() {
    return this.wanted() && !!this.target();
  }

  // ------------------------------------------------------------------ open, shut
  open() {
    if (this.isOpen) return true;
    const g = this.game;
    const v = this.target();
    if (!v || !this.wanted()) return false;
    if (g.freedraw && g.freedraw.isOpen) g.freedraw.close();
    this.v = v;
    this.isOpen = true;
    this.openT = 0;
    this.sel = null;
    this.undoStack = [];
    this.before = this.snapshot(v);
    this.stats.opened++;
    // (from behind and to the side the camera was already on)
    const cam = g.camera;
    const dx = cam.position.x - v.pos.x;
    const dz = cam.position.z - v.pos.z;
    const side = dx * Math.cos(v.yaw) - dz * Math.sin(v.yaw) >= 0 ? 1 : -1;
    this.camYaw = Math.PI + side * 0.75;
    this.camPitch = 0.36;
    this.camZoom = 1;
    document.body.classList.add('bt-open');
    if (g.input && g.input.holdTouch) g.input.holdTouch(true);
    g.audio.play('pageflip', 0.4);
    this.sig = '';
    this.show();
    return true;
  }

  close(quiet = false) {
    if (!this.isOpen) return;
    const g = this.game;
    this.cancelTrace();
    this.endDrag(false);
    this.isOpen = false;
    this.sel = null;
    this.panel = null;
    document.body.classList.remove('bt-open');
    if (g.input && g.input.holdTouch) g.input.holdTouch(false);
    // (what it is now, if it was changed: kept by itself - the last five)
    const v = this.v;
    if (v && !v.dead && v.fuse && v.fuse.parts.length && this.snapshot(v) !== this.before) this.keepRecent(v);
    if (!quiet) g.audio.play('click', 0.35);
    this.show();
  }

  toggle() {
    if (this.isOpen) this.close();
    else if (!this.open()) this.game.hud.toast(tr('המגש נפתח ברכב, או לידו', 'The tray opens in a ride, or beside one'), 'info', 2);
  }

  snapshot(v) {
    return v && v.fuse ? v.fuse.parts.map((p) => `${trayIdOf(p) || p.type}:${p.traySize || 1}:${p.trayMount || ''}`).join('|') : '';
  }

  // ------------------------------------------------------------------ what is on it
  partsOn(id) {
    const v = this.v;
    return v && v.fuse ? v.fuse.parts.filter((p) => trayIdOf(p) === id) : [];
  }

  count() {
    const v = this.v;
    return v && v.fuse ? v.fuse.parts.length : 0;
  }

  // why this part cannot go on this ride now - or null
  cannot(id, v = this.v) {
    const why = fits(id, v);
    if (why) return why;
    const g = this.game;
    const play = g.gear && g.gear.play;
    if (ITEMS[id] && play && !play.isOpen(id)) return tr('עוד נעול', 'Still locked');
    // (the gun mount: a gun in the hand to put on it - or one on it already)
    if (id === 'handgun' && !g.weapons.mountable(g.weapons.current) && !(v && v.fuse && v.fuse.parts.some((p) => p.hand))) return tr('צריך נשק ביד', 'Needs a gun in your hand');
    return null;
  }

  // ------------------------------------------------------------------ a part put on
  // o: { size (0.6-1.7), mount (one of mountsOf), x (to its side: a pair's), quiet, noUndo } - the part, or null
  attach(id, o = {}) {
    const g = this.game;
    const fz = g.fuse;
    const v = this.v || this.target();
    if (!v || !fz) return null;
    const it = info(id);
    const why = this.cannot(id, v);
    if (why) {
      g.hud.toast(it && it.soon ? `${it.name}: ${it.does}` : `${it ? it.name : id}: ${why}`, it && it.soon ? 'info' : 'bad', 3);
      g.audio.play('rubber', 0.4);
      return null;
    }
    // (drawn once: over its guide)
    if (!this.store.learned[id] && !o.force) {
      this.trace(id, o);
      return null;
    }
    const on = this.partsOn(id);
    const pair = this.mirror && PAIRS.has(id) && !o.single;
    // (one of each - a pair of the ones that come in pairs - and no more than the ride carries)
    const room = MAX_PARTS - (v.fuse ? v.fuse.parts.length : 0) + on.length;
    if (room < (pair ? 2 : 1)) {
      g.hud.toast(tr(`מלא: ${MAX_PARTS} רכיבים. הורידו אחד`, `Full: ${MAX_PARTS} parts. Take one off`), 'bad', 2.2);
      g.audio.play('rubber', 0.4);
      return null;
    }
    for (const q of on) {
      // (another gun onto the mount: the one that was on it back in your hand, after the new one is out of it)
      if (q.hand) setTimeout(() => g.weapons.rehand(q.hand), 0);
      fz.removeVeh(v, q, true);
    }
    const size = clamp(o.size || this.store.size[id] || 1, 0.6, 1.7);
    const inkI = (g.freedraw && g.freedraw.ink) || 0;
    const made = [];
    const xs = pair ? [1, -1] : [o.x || 0];
    for (const sx of xs) {
      const part = this.make(v, id, size, o.mount || null, sx, inkI, made.length * 140);
      if (part) made.push(part);
    }
    if (!made.length) {
      for (const q of on) fz.onVehicle(v, q);
      return null;
    }
    this.store.fav[id] = (this.store.fav[id] || 0) + 1;
    this.save();
    this.stats.put++;
    if (!o.noUndo) this.undoStack.push({ op: 'add', id, parts: made, was: on, group: o.group || null });
    if (fz.pen) fz.pen.landed(v, made[0]);
    if (!o.quiet) {
      g.audio.play('magic', 0.35);
      this.say(id, v);
    }
    this.fusionCheck(v);
    this.sig = '';
    return made[0];
  }

  // the part itself, on the ride: the pen's own thing made of your drawing of it, a drawn jet or propeller where it
  // naturally goes, a link
  make(v, id, size, mount, sx, inkI, pop) {
    const g = this.game;
    const fz = g.fuse;
    const it = info(id);
    // (ROADMAP 29.5: on a ride that is not a car, in the frame of where it goes there - and off: where that is on it)
    const ctx = fz.drawCtx(v, id);
    const D = ctx.D;
    const K = ctx.K;
    const off = ctx.off || [0, 0, 0];
    const on = (q) => [q[0] + off[0], q[1] + off[1], q[2] + off[2]];
    const [L0, S0] = SIZE[id] || [1.2, 0.9];
    const L = L0 * size;
    const S = S0 * size;
    let part = null;
    if (ITEMS[id]) {
      const lr = this.store.learned[id];
      const M = lr && lr.M && lr.M.length ? lr.M.map((ln) => ln.map(([x, y]) => [x * L, y * L])) : null;
      const d = M ? { M, side: 1, flip: 0 } : null;
      fz.pen.lvCap = LV_CAP[id] || 0;
      const got = fz.pen.putOn(v, id, nOf(id, { L, S, w: L, h: S }), d, inkI, 120 + pop);
      fz.pen.lvCap = 0;
      if (!got) return null;
      part = got.part;
      // (a turret: where on the ride - the hood, the roof, over the boot; a pair side by side)
      if (id === 'mg') {
        const m = mount || 'hood';
        part.v = m === 'roof' ? 'turret' : m === 'tail' ? 'rear' : 'front';
        part.at[0] = sx * Math.min(0.5, D.hw * 0.45);
        if (m === 'roof') part.at[2] = sx ? 0 : part.at[2];
        fz.applyVeh(v);
        fz.justAdded = part;
        fz.popDelay = 120 + pop;
        fz.buildVeh(v);
        fz.justAdded = null;
        fz.popDelay = 0;
      }
    } else if (it.par) {
      const low = K ? Math.max(0.45, K.clear + 0.3) : D.h * 0.35;
      const roof = K ? K.roofY : D.h;
      const m = mount || 'tail';
      let at;
      let dir;
      if (m === 'under') {
        at = [sx * D.hw * 0.5, 0.3, -D.hl * 0.2];
        dir = [0, -1, 0];
      } else if (m === 'roof') {
        at = [sx * Math.min(0.55, D.hw * 0.5), roof + 0.16, -D.hl * 0.35];
        dir = [0, 0, -1];
      } else {
        // (one alone at the middle of the tail - or beside what is there, a speedboat's outboard: ctx.tailX)
        at = [sx ? sx * Math.min(0.55, D.hw * 0.55) : ctx.tailX || 0, it.par === 'prop' ? low + 0.35 : low + 0.05, -D.hl - 0.05];
        dir = [0, 0, -1];
      }
      const len = it.par === 'jet' ? clamp(L / 1.2, 0.5, 3) : clamp(L, 0.4, 3);
      part = { par: true, ink: inkI, t0: g.time, cost: 0, id: rnd(), type: it.par, v: m === 'under' ? 'under' : 'back', n: { len: r2(len), size: r2(len) }, at: on(at).map(r2), dir };
      fz.justAdded = part;
      fz.popDelay = 120 + pop;
      const res = fz.onVehicle(v, part);
      fz.justAdded = null;
      fz.popDelay = 0;
      if (!res) return null;
    } else if (it.hand) {
      // (ROADMAP 28.15: the gun out of your hand, on a swivel on the roof - what it is, kept with the part)
      const slot = g.weapons.current;
      if (!g.weapons.mountable(slot)) return null;
      const roof = K ? K.roofY : D.h;
      part = { type: 'barrel', v: 'turret', n: { len: 1, r: 0.05 }, at: on([0, roof, -D.hl * 0.05]).map(r2), ink: inkI, t0: g.time, cost: 0, id: rnd(), hand: { id: slot.def.id, grade: slot.grade, score: slot.score === undefined ? 0.8 : slot.score, mods: slot.mods ? [...slot.mods] : null, ammo: Number.isFinite(slot.ammo) ? slot.ammo : -1 } };
      fz.justAdded = part;
      fz.popDelay = 120 + pop;
      const res = fz.onVehicle(v, part);
      fz.justAdded = null;
      fz.popDelay = 0;
      if (!res) return null;
      g.weapons.unhand(slot);
    } else if (it.link) {
      part = { type: 'link', v: it.link, n: { size: 1 }, at: on(linkAt(it.link, D, K)).map(r2), ink: inkI, t0: g.time, cost: 0, id: rnd() };
      fz.justAdded = part;
      fz.popDelay = 120 + pop;
      const res = fz.onVehicle(v, part);
      fz.justAdded = null;
      fz.popDelay = 0;
      if (!res) return null;
    }
    if (!part) return null;
    part.tray = id;
    part.traySize = r2(size);
    part.trayMount = mount || '';
    return part;
  }

  // (what it does and how it is used, said once each time the tray is out)
  say(id, v) {
    const g = this.game;
    const it = info(id);
    const how = it.use && it.use !== 'always' && HOW_SAY[it.use] ? ` · ${g.touch ? HOW_SAY[it.use][1] : HOW_SAY[it.use][0]}` : '';
    g.hud.toast(`${it.name}: ${it.does}${how}`, 'good', 3);
  }

  // ------------------------------------------------------------------ off, back
  remove(id, o = {}) {
    const g = this.game;
    const fz = g.fuse;
    const v = this.v;
    const on = this.partsOn(id);
    if (!v || !on.length) return false;
    for (const q of on) {
      // (the gun off its mount: back in your hand)
      if (q.hand) g.weapons.rehand(q.hand);
      const [ax, ay, az] = q.at || [0, 1, 0];
      const c = Math.cos(v.yaw);
      const s = Math.sin(v.yaw);
      g.fx.crumbs(v.pos.x + ax * c + az * s, (v.pos.y || 0) + ay, v.pos.z - ax * s + az * c, 8, 1.6);
      fz.removeVeh(v, q, true);
    }
    if (fz.last && on.includes(fz.last.part)) fz.last = null;
    if (!o.noUndo) this.undoStack.push({ op: 'rem', id, parts: [...on] });
    if (this.sel && on.includes(this.sel)) this.sel = null;
    g.audio.play('rubber', 0.45);
    this.stats.off++;
    this.sig = '';
    return true;
  }

  // a touch on a part in the tray: on - or off, if it is on
  tap(id) {
    if (this.partsOn(id).length) return this.remove(id);
    return !!this.attach(id);
  }

  undo() {
    const g = this.game;
    const fz = g.fuse;
    const v = this.v;
    const u = this.undoStack.pop();
    if (!u || !v) {
      g.audio.play('click', 0.25);
      return false;
    }
    if (u.op === 'add') {
      for (const q of u.parts) fz.removeVeh(v, q, true);
      for (const q of u.was || []) fz.onVehicle(v, q);
    } else if (u.op === 'rem') {
      for (const q of u.parts) fz.onVehicle(v, q);
    }
    // (a whole build put on: all of it back off in one)
    while (u.group && this.undoStack.length && this.undoStack[this.undoStack.length - 1].group === u.group) {
      const w = this.undoStack.pop();
      for (const q of w.parts) fz.removeVeh(v, q, true);
      for (const q of w.was || []) fz.onVehicle(v, q);
    }
    this.sel = null;
    this.stats.undone++;
    g.audio.play('rubber', 0.4);
    this.sig = '';
    return true;
  }

  // its size on the handle: the part made again that big, where it was
  resize(part, size) {
    const id = trayIdOf(part);
    if (!id || !SIZED.has(id)) return null;
    size = clamp(size, 0.6, 1.7);
    this.store.size[id] = r2(size);
    const fz = this.game.fuse;
    const v = this.v;
    const on = this.partsOn(id);
    const mount = part.trayMount || null;
    for (const q of on) fz.removeVeh(v, q, true);
    const made = [];
    const xs = on.length > 1 ? [1, -1] : [0];
    for (const sx of xs) {
      const p = this.make(v, id, size, mount, sx, part.ink || 0, 0);
      if (p) made.push(p);
    }
    // (the handle moved again and again is one thing to take back)
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && last.op === 'add' && last.id === id) last.parts = made;
    this.sel = made[0] || null;
    this.save();
    this.sig = '';
    return this.sel;
  }

  // ------------------------------------------------------------------ fusions
  fusionCheck(v) {
    const g = this.game;
    const F = fusionsOf(trayIdsOn(v));
    for (const f of F) {
      if (this.store.book.includes(f.id)) continue;
      this.store.book.push(f.id);
      this.save();
      this.stats.fusions++;
      this.card(f);
      g.audio.play('cheer', 0.5);
    }
  }

  card(f) {
    const el = this.cardEl;
    if (!el) return;
    el.innerHTML = `<i>${tr('הכלאה חדשה', 'New fusion')}</i><b>${f.name}</b><span>${f.gives}</span><em>${this.store.book.length} / ${FUSIONS.length}</em>`;
    el.classList.add('on');
    clearTimeout(this.cardT);
    this.cardT = setTimeout(() => el.classList.remove('on'), 3600);
  }

  // ------------------------------------------------------------------ builds
  capture(v) {
    const fz = this.game.fuse;
    const saved = fz.saveVeh(v);
    // (a gun of the hand on its mount is not part of a build: it is that one gun)
    const parts = (Array.isArray(saved) ? saved : saved && saved.parts ? saved.parts : []).filter((q) => !q.hand);
    return { base: { bp: v.bp ? v.bp.id : v.kind === 'car' ? 'car' : v.kind, kind: v.kind, carKind: v.carKind || null }, parts: JSON.parse(JSON.stringify(parts)), ids: [...trayIdsOn(v)] };
  }

  keepRecent(v) {
    const c = this.capture(v);
    if (!c.parts.length) return;
    const sig = c.ids.slice().sort().join('+');
    this.store.recent = this.store.recent.filter((b) => b.sig !== sig);
    this.store.recent.unshift({ id: rnd(), sig, t: Date.now(), ...c });
    this.store.recent.length = Math.min(5, this.store.recent.length);
    this.save();
  }

  saveBuild(name = null) {
    const g = this.game;
    const v = this.v;
    if (!v || !v.fuse || !v.fuse.parts.length) {
      g.hud.toast(tr('עוד אין עליה רכיבים', 'There are no parts on it yet'), 'info', 2);
      return null;
    }
    const c = this.capture(v);
    const F = fusionsOf(new Set(c.ids));
    const n = name || (F.length ? F[0].name : tr('בנייה', 'Build')) + ' ' + (this.store.builds.length + 1);
    const b = { id: rnd(), name: String(n).slice(0, 26), t: Date.now(), sig: c.ids.slice().sort().join('+'), ...c };
    this.store.builds.unshift(b);
    this.store.builds.length = Math.min(12, this.store.builds.length);
    this.save();
    this.stats.builds++;
    // (and on the pen's "inventions" shelf: from there it comes whole, ride and all, when there is none by you)
    if (g.inventions && g.inventions.storeFull) g.inventions.storeFull(b.name, { bp: b.base.bp && b.base.bp !== 'bike' ? b.base.bp : b.base.kind === 'bike' ? 'bike' : 'car' }, JSON.parse(JSON.stringify(b.parts)));
    g.audio.play('cheer', 0.45);
    g.hud.toast(tr(`✦ נשמרה: ${b.name} — נגיעה בה ב"בניות" מחזירה אותה`, `✦ Saved: ${b.name} — a touch on it under "Builds" brings it back`), 'good', 3);
    this.sig = '';
    return b;
  }

  findBuild(id) {
    if (typeof id === 'string' && id.startsWith('ver:')) {
      const [, key, i] = id.split(':');
      const L = this.store.vers[key];
      return (L && L[+i]) || null;
    }
    return this.store.builds.find((b) => b.id === id) || this.store.recent.find((b) => b.id === id) || null;
  }

  // (ROADMAP 28.15, the garage) three versions of each ride - a racer, a fighter, a flyer - each kept with all its parts:
  // a touch on an empty one keeps what is on the ride now; on a kept one, puts it on
  verKey(v = this.v) {
    return v ? (v.bp ? v.bp.id : v.kind === 'car' ? 'car' : v.kind) : '';
  }

  version(i) {
    const g = this.game;
    const v = this.v;
    if (!v) return false;
    const key = this.verKey(v);
    const L = this.store.vers[key] || (this.store.vers[key] = [null, null, null]);
    if (L[i]) return this.applyBuild(`ver:${key}:${i}`);
    const c = this.capture(v);
    if (!c.parts.length) {
      g.hud.toast(tr('אין מה לשמור — קודם שמים רכיבים', 'Nothing to keep — put some parts on first'), 'info', 2);
      return false;
    }
    L[i] = { id: `ver:${key}:${i}`, name: VER_NAME[i], t: Date.now(), ...c };
    this.save();
    g.audio.play('cheer', 0.4);
    g.hud.toast(tr(`נשמר כגרסת ${VER_NAME[i]}`, `Kept as the ${VER_NAME[i]} version`), 'good', 2);
    this.sig = '';
    return true;
  }

  dropVersion(i) {
    const L = this.store.vers[this.verKey()];
    if (!L || !L[i]) return false;
    L[i] = null;
    this.save();
    this.game.audio.play('rubber', 0.4);
    this.sig = '';
    return true;
  }

  // (the garage's fine hand) the chosen part a little along the ride or across it - the ones that sit where they are put
  nudgable(p) {
    return !!p && (!!p.par || (p.type === 'barrel' && p.v === 'turret')) && Array.isArray(p.at);
  }

  nudge(dir) {
    const g = this.game;
    const v = this.v;
    const p = this.sel;
    if (!v || !this.nudgable(p)) return false;
    const C = g.fuse.drawCtx(v);
    const D = C.size || C.D;
    const d = dir === 'f' ? [0, 0.15] : dir === 'b' ? [0, -0.15] : dir === 'l' ? [-0.1, 0] : [0.1, 0];
    p.at[0] = r2(clamp(p.at[0] + d[0], -D.hw * 0.7, D.hw * 0.7));
    p.at[2] = r2(clamp(p.at[2] + d[1], -D.hl - 0.1, D.hl * 0.7));
    g.fuse.applyVeh(v);
    g.fuse.buildVeh(v);
    g.audio.play('click', 0.25);
    return true;
  }

  dropBuild(id) {
    this.store.builds = this.store.builds.filter((b) => b.id !== id);
    this.store.recent = this.store.recent.filter((b) => b.id !== id);
    this.save();
    this.sig = '';
  }

  // a kept build on the ride you are at: what is on it off, the build's parts on one after another (one thing to
  // take back)
  applyBuild(id) {
    const g = this.game;
    const fz = g.fuse;
    const v = this.v;
    const b = this.findBuild(id);
    if (!b || !v) return false;
    const group = rnd();
    const was = v.fuse ? v.fuse.parts.slice() : [];
    for (const q of was) fz.removeVeh(v, q, true);
    if (was.length) this.undoStack.push({ op: 'rem', id: null, parts: was, group });
    let n = 0;
    const made = [];
    for (const sp of b.parts) {
      const id2 = sp.tray || sp.item || (sp.par ? sp.type : null);
      if (id2 && this.cannot(id2, v)) continue;
      const part = { ...JSON.parse(JSON.stringify(sp)), t0: g.time, id: rnd() };
      fz.justAdded = part;
      fz.popDelay = 120 + n * 170;
      const res = fz.onVehicle(v, part);
      fz.justAdded = null;
      fz.popDelay = 0;
      if (res) {
        made.push(part);
        n++;
      }
    }
    if (made.length) this.undoStack.push({ op: 'add', id: null, parts: made, was: [], group });
    g.audio.play('magic', 0.45);
    g.hud.toast(tr(`✦ ${b.name || 'בנייה'} — ${n} רכיבים`, `✦ ${b.name || 'Build'} — ${n} parts`), 'good', 2.4);
    this.fusionCheck(v);
    this.panel = null;
    this.sig = '';
    return n > 0;
  }

  // ------------------------------------------------------------------ the first time: drawn over its guide
  // (o.it: something that is not a part of the tray - its name, its picture or its lines (o.guide), its word (o.say);
  // o.then: what is done once it is drawn, instead of putting it on a ride)
  trace(id, o = {}) {
    const it = o.it || info(id);
    const el = this.traceEl;
    if (!el || !it) return;
    this.endDrag(false);
    const guide = o.guide || iconLines(it.icon);
    if (!guide.length) {
      if (o.then) o.then();
      return;
    }
    this.tracing = { id, o, guide, B: boxOf(guide), strokes: [], cur: null, hit: new Set(), t0: performance.now(), done: false };
    el.querySelector('b').textContent = it.name;
    el.querySelector('span').textContent = o.say || tr('מציירים פעם אחת מעל הקווים — ומאז הוא במגש', 'Draw it once over the lines — and from then on it is in the tray');
    el.classList.add('on');
    this.traceLayout();
    this.traceDraw();
    this.game.audio.play('pageflip', 0.35);
  }

  cancelTrace() {
    if (!this.tracing) return;
    this.tracing = null;
    if (this.traceEl) this.traceEl.classList.remove('on');
  }

  traceLayout() {
    const cv = this.traceCv;
    const T = this.tracing;
    if (!cv || !T) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(2, Math.round(r.width * dpr));
    cv.height = Math.max(2, Math.round(r.height * dpr));
    T.dpr = dpr;
    T.w = r.width;
    T.h = r.height;
    // (the guide as big as the card lets it be, a margin round it)
    const k = Math.min((r.width * 0.78) / T.B.w, (r.height * 0.78) / T.B.h);
    T.k = k;
    T.ox = r.width / 2 - T.B.cx * k;
    T.oy = r.height / 2 - T.B.cy * k;
    T.tol = Math.max(16, Math.max(T.B.w, T.B.h) * k * 0.085);
    // (the guide's own points on the card, about half a finger's width apart all along its lines - a long straight
    // line of two corners as much as a curve of many: what is ticked off as it is drawn over)
    T.pts = [];
    const step = T.tol * 0.5;
    for (const L of T.guide) {
      let left = 0;
      for (let i = 0; i < L.length; i++) {
        const x = T.ox + L[i][0] * k;
        const y = T.oy + L[i][1] * k;
        if (!i) {
          T.pts.push([x, y]);
          left = step;
          continue;
        }
        const px = T.ox + L[i - 1][0] * k;
        const py = T.oy + L[i - 1][1] * k;
        const d = Math.hypot(x - px, y - py);
        let at = left;
        while (at <= d) {
          T.pts.push([px + ((x - px) * at) / d, py + ((y - py) * at) / d]);
          at += step;
        }
        left = at - d;
      }
    }
  }

  tracePoint(x, y) {
    const T = this.tracing;
    if (!T || !T.cur) return;
    const last = T.cur[T.cur.length - 1];
    if (last && Math.hypot(x - last[0], y - last[1]) < 2.5) return;
    T.cur.push([x, y]);
    const r2t = T.tol * T.tol;
    for (let i = 0; i < T.pts.length; i++) {
      if (T.hit.has(i)) continue;
      const dx = T.pts[i][0] - x;
      const dy = T.pts[i][1] - y;
      if (dx * dx + dy * dy <= r2t) T.hit.add(i);
    }
    this.traceDraw();
  }

  traceCover() {
    const T = this.tracing;
    return T && T.pts.length ? T.hit.size / T.pts.length : 0;
  }

  traceDraw() {
    const T = this.tracing;
    const cv = this.traceCv;
    if (!T || !cv) return;
    const c = cv.getContext('2d');
    c.setTransform(T.dpr, 0, 0, T.dpr, 0, 0);
    c.clearRect(0, 0, T.w, T.h);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // the guide: dashed, pale
    c.setLineDash([9, 8]);
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(60, 90, 160, 0.42)';
    for (const L of T.guide) {
      c.beginPath();
      L.forEach(([x, y], i) => (i ? c.lineTo(T.ox + x * T.k, T.oy + y * T.k) : c.moveTo(T.ox + x * T.k, T.oy + y * T.k)));
      c.stroke();
    }
    c.setLineDash([]);
    // what of it is drawn over: lit
    c.fillStyle = 'rgba(46, 170, 90, 0.5)';
    for (const i of T.hit) {
      c.beginPath();
      c.arc(T.pts[i][0], T.pts[i][1], 5, 0, Math.PI * 2);
      c.fill();
    }
    // your own lines
    c.lineWidth = 5.5;
    c.strokeStyle = '#1f1d2b';
    for (const S of [...T.strokes, ...(T.cur ? [T.cur] : [])]) {
      if (S.length < 2) continue;
      c.beginPath();
      S.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
    const k = clamp(this.traceCover() / TRACE_OK, 0, 1);
    if (this.traceBar) this.traceBar.style.width = `${Math.round(k * 100)}%`;
  }

  // the pen up: enough of the guide drawn over, and it is learned - kept as you drew it - and goes on the ride
  traceUp() {
    const T = this.tracing;
    if (!T || T.done) return;
    if (T.cur && T.cur.length > 1) T.strokes.push(T.cur);
    T.cur = null;
    if (this.traceCover() < TRACE_OK) {
      this.traceDraw();
      return;
    }
    T.done = true;
    this.learn(T.id, T.strokes, T);
    this.stats.traced++;
    this.game.audio.play('ding', 0.5);
    const { id, o } = T;
    setTimeout(() => {
      this.cancelTrace();
      if (o.then) {
        o.then();
        return;
      }
      if (this.isOpen) this.attach(id, o);
      else if (o.wheel && this.target()) {
        this.v = this.target();
        this.attach(id, o);
      }
      this.sig = '';
    }, 260);
  }

  // your drawing of it, kept: about its middle, the guide's long side one long (the tray makes it as big as the
  // part is), y up, forty points a line at most
  learn(id, strokes, T) {
    const B = T ? { cx: T.ox + T.B.cx * T.k, cy: T.oy + T.B.cy * T.k, s: Math.max(T.B.w, T.B.h) * T.k } : (() => {
      const b = boxOf(strokes);
      return { cx: b.cx, cy: b.cy, s: Math.max(b.w, b.h) };
    })();
    const M = strokes.filter((S) => S.length > 1).map((S) => {
      const step = Math.max(1, Math.ceil(S.length / 40));
      const out = [];
      for (let i = 0; i < S.length; i += step) out.push([Math.round(((S[i][0] - B.cx) / B.s) * 1000) / 1000, Math.round((-(S[i][1] - B.cy) / B.s) * 1000) / 1000]);
      const e = S[S.length - 1];
      out.push([Math.round(((e[0] - B.cx) / B.s) * 1000) / 1000, Math.round((-(e[1] - B.cy) / B.s) * 1000) / 1000]);
      return out;
    });
    this.store.learned[id] = { M };
    this.save();
  }

  // (ROADMAP 28.8, the owner's word: "to get a thing at first you have to draw it") a thing of the pen's shelf - a gun, a
  // ride, a tool - the first time: drawn over its own blueprint, big, on the card; from then on a touch makes it
  // (ui/freedraw.js quick). Not in the story's opening (its own drawing lessons), not in a test unless it asks
  firstWanted(id) {
    const g = this.game;
    if (this.store.learned[`bp:${id}`] || g.classic) return false;
    const P = g.params;
    if (P && P.get('test') === '1' && P.get('firstdraw') !== '1') return false;
    if (P && P.get('firstdraw') === '0') return false;
    if (g.prologue && g.prologue.active && !g.lab) return false;
    return true;
  }

  firstDraw(bp, then) {
    const guide = (bp.strokes || []).map((s) => s.pts.map((q) => [q[0], q[1]])).filter((L) => L.length > 1);
    this.trace(`bp:${bp.id}`, { it: { name: bp.name }, guide, say: tr('מציירים פעם אחת מעל הקווים — ומאז נגיעה אחת יוצרת אותו', 'Draw it once over the lines — and from then on one touch makes it'), then });
  }

  // (the tests, and a build made again that has a part not drawn yet: learned as its guide is)
  learnAll(ids = TRAY_IDS) {
    for (const id of ids) {
      if (this.store.learned[id]) continue;
      const it = info(id);
      const G = it ? iconLines(it.icon) : [];
      if (!G.length) continue;
      const b = boxOf(G);
      const s = Math.max(b.w, b.h);
      this.store.learned[id] = { M: G.map((L) => L.filter((q, i) => i % 2 === 0 || i === L.length - 1).map(([x, y]) => [Math.round(((x - b.cx) / s) * 1000) / 1000, Math.round((-(y - b.cy) / s) * 1000) / 1000])) };
    }
    this.save();
    this.sig = '';
  }

  // ------------------------------------------------------------------ where on the ride
  // a point of the ride's frame (x to its left, z to its nose) on the screen: { x, y, front }
  proj(v, x, y, z) {
    const c = Math.cos(v.yaw);
    const s = Math.sin(v.yaw);
    const y0 = (v.pos.y || 0) + ((v.fz && v.fz.lift) || 0);
    return this.game.fuse.screen(v.pos.x + x * c + z * s, y0 + y, v.pos.z - x * s + z * c);
  }

  // where a part can go: [{ key, at, name }] - the first its natural place
  mountsOf(id, v = this.v) {
    const fz = this.game.fuse;
    if (!v || !fz) return [];
    // (ROADMAP 29.5: on a ride that is not a car, its frame for that part - each place set where it is on the ride)
    const ctx = fz.drawCtx(v, id);
    const off = ctx.off;
    return this.mountsIn(id, v, ctx).map((m) => (off ? { ...m, at: [m.at[0] + off[0], m.at[1] + off[1], m.at[2] + off[2]] } : m));
  }

  mountsIn(id, v, ctx) {
    const D = ctx.D;
    const K = ctx.K;
    const roof = K ? K.roofY : D.h;
    const low = K ? Math.max(0.45, K.clear + 0.3) : D.h * 0.35;
    const hood = [0, K && K.hood ? K.hood.y : D.h * 0.55, K && K.hood ? K.hood.z : D.hl * 0.6];
    if (id === 'mg') return [{ key: 'hood', at: hood, name: tr('מכסה המנוע', 'Hood') }, { key: 'roof', at: [0, roof, 0], name: tr('גג — מסתובב לכל כיוון', 'Roof — turns all the way round') }, { key: 'tail', at: [0, roof * 0.8, -D.hl * 0.82], name: tr('מאחור', 'Rear') }];
    if (id === 'jet') return [{ key: 'tail', at: [0, low, -D.hl], name: tr('זנב — דחיפה קדימה', 'Tail — pushes forward') }, { key: 'roof', at: [0, roof + 0.16, -D.hl * 0.35], name: tr('גג — דחיפה קדימה', 'Roof — pushes forward') }, { key: 'under', at: [0, 0.3, -D.hl * 0.2], name: tr('תחתית — קפיצה וריחוף קצר', 'Underneath — a hop and a short hover') }];
    if (id === 'prop') return [{ key: 'tail', at: [0, low + 0.35, -D.hl], name: tr('זנב — דחיפה קדימה', 'Tail — pushes forward') }, { key: 'under', at: [0, 0.3, -D.hl * 0.2], name: tr('תחתית — מאט נפילה', 'Underneath — slows a fall') }];
    const on = this.partsOn(id)[0];
    if (on && on.at) return [{ key: '', at: ctx.off ? [on.at[0] - ctx.off[0], on.at[1] - ctx.off[1], on.at[2] - ctx.off[2]] : on.at, name: '' }];
    const it = info(id);
    if (it && it.link) return [{ key: '', at: linkAt(it.link, D, K), name: '' }];
    const NAT = { roof: [0, roof, 0], above: [0, roof + 1.5, 0], hood, nose: [0, low, D.hl], tail: [0, low, -D.hl], under: [0, 0.2, 0], body: [D.hw, roof * 0.55, 0], sides: [D.hw, roof * 0.55, 0], wheels: [D.hw, 0.35, D.hl * 0.6], dash: [0, hood[1] + 0.2, hood[2] - 0.7], trunk: [0, roof * 0.7, -D.hl + 0.25], rack: [0, roof + 0.12, -0.3] };
    return [{ key: '', at: NAT[(ITEMS[id] && ITEMS[id].at) || 'roof'] || [0, roof, 0], name: '' }];
  }

  // ------------------------------------------------------------------ the line from the tray to the ride
  startDrag(id, x, y, from) {
    this.drag = { id, x0: x, y0: y, x, y, from, live: false, snap: null, why: null, pts: [[x, y]] };
  }

  moveDrag(x, y) {
    const d = this.drag;
    if (!d) return;
    d.x = x;
    d.y = y;
    if (!d.live && Math.hypot(x - d.x0, y - d.y0) > 16 && y < d.y0 - 10) {
      d.live = true;
      this.game.audio.play('click', 0.25);
    }
    if (!d.live) return;
    const last = d.pts[d.pts.length - 1];
    if (Math.hypot(x - last[0], y - last[1]) > 6) d.pts.push([x, y]);
    // (the nearest place it can go, if the line has come to the ride)
    const v = this.v;
    d.why = this.cannot(d.id, v);
    d.snap = null;
    let bd = Math.max(90, window.innerHeight * 0.3);
    for (const m of this.mountsOf(d.id, v)) {
      const q = this.proj(v, m.at[0], m.at[1], m.at[2]);
      if (!q || !q.front) continue;
      const dd = Math.hypot(q.x - x, q.y - y);
      if (dd < bd) {
        bd = dd;
        d.snap = { ...m, sx: q.x, sy: q.y };
      }
    }
  }

  endDrag(put) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.live) {
      if (put) this.tap(d.id);
      return;
    }
    if (!put || !d.snap) {
      this.game.audio.play('rubber', 0.3);
      return;
    }
    if (this.partsOn(d.id).length) this.remove(d.id, { noUndo: true });
    this.attach(d.id, { mount: d.snap.key || null });
  }

  // (a short line across a part on the ride: cut off)
  cut(a, b) {
    const v = this.v;
    if (!v || !v.fuse) return false;
    for (const p of v.fuse.parts.slice().reverse()) {
      const q = this.proj(v, p.at[0], p.at[1], p.at[2]);
      if (!q || !q.front) continue;
      // (the part's place within a finger of the line's middle stretch)
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy;
      const t = clamp(((q.x - a[0]) * dx + (q.y - a[1]) * dy) / Math.max(1, L2), 0.15, 0.85);
      if (Math.hypot(a[0] + dx * t - q.x, a[1] + dy * t - q.y) < 34) {
        const id = trayIdOf(p);
        if (id) return this.remove(id);
        this.game.fuse.removeVeh(v, p);
        this.sig = '';
        return true;
      }
    }
    return false;
  }

  // the part on the ride nearest a touch (within a finger of it)
  pickAt(x, y) {
    const v = this.v;
    if (!v || !v.fuse) return null;
    let best = null;
    let bd = 46;
    for (const p of v.fuse.parts) {
      if (!p.at) continue;
      const q = this.proj(v, p.at[0], p.at[1], p.at[2]);
      if (!q || !q.front) continue;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ the quick wheel
  favs() {
    const v = this.target();
    const all = TRAY_IDS.filter((id) => !this.cannot(id, v));
    const f = this.store.fav;
    const used = all.filter((id) => f[id]).sort((a, b) => f[b] - f[a]);
    const out = [...used];
    for (const id of FAV0) if (out.length < 8 && all.includes(id) && !out.includes(id)) out.push(id);
    for (const id of all) if (out.length < 8 && !out.includes(id)) out.push(id);
    return out.slice(0, 8);
  }

  wheelOpen(cx, cy) {
    const v = this.target();
    if (!v || !this.wanted() || this.isOpen) return false;
    const ids = this.favs();
    if (!ids.length) return false;
    this.v = v;
    const W = Math.min(window.innerWidth, window.innerHeight);
    const R = clamp(W * 0.3, 96, 150);
    cx = clamp(cx, R + 50, window.innerWidth - R - 50);
    cy = clamp(cy, R + 40, window.innerHeight - R - 40);
    this.wheel = { ids, cx, cy, R, pick: -1, t0: performance.now() };
    this.stats.wheel++;
    const el = this.wheelEl;
    const has = trayIdsOn(v);
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.innerHTML = `<div class="bt-wmid"><b></b><span></span></div>${ids.map((id, i) => {
      const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
      return `<div class="bt-wit${has.has(id) ? ' has' : ''}" data-i="${i}" style="transform:translate(${Math.round(Math.cos(a) * R)}px,${Math.round(Math.sin(a) * R)}px)">${svgIcon(info(id).icon)}</div>`;
    }).join('')}`;
    el.classList.add('on');
    document.body.classList.add('bt-wheeling');
    this.wheelPoint(cx, cy);
    this.game.audio.play('whoosh', 0.3);
    return true;
  }

  wheelPoint(x, y) {
    const Wh = this.wheel;
    if (!Wh) return;
    const dx = x - Wh.cx;
    const dy = y - Wh.cy;
    let pick = -1;
    if (Math.hypot(dx, dy) > Wh.R * 0.38) {
      const a = Math.atan2(dy, dx) + Math.PI / 2;
      const n = Wh.ids.length;
      pick = ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n;
    }
    if (pick === Wh.pick) return;
    Wh.pick = pick;
    const el = this.wheelEl;
    for (const c of el.querySelectorAll('.bt-wit')) c.classList.toggle('on', +c.dataset.i === pick);
    const it = pick >= 0 ? info(Wh.ids[pick]) : null;
    el.querySelector('.bt-wmid b').textContent = it ? it.name : tr('רכיבים', 'Parts');
    el.querySelector('.bt-wmid span').textContent = it ? (this.partsOn(Wh.ids[pick]).length ? tr('להוריד', 'Take off') : it.does) : tr('להחליק אל רכיב ולשחרר', 'Slide to a part and let go');
    if (pick >= 0) this.game.audio.play('click', 0.2);
  }

  wheelClose(take) {
    const Wh = this.wheel;
    this.wheel = null;
    if (this.wheelEl) this.wheelEl.classList.remove('on');
    document.body.classList.remove('bt-wheeling');
    if (!Wh) return;
    if (take && Wh.pick >= 0) {
      const id = Wh.ids[Wh.pick];
      if (this.partsOn(id).length) this.remove(id);
      else if (!this.store.learned[id]) {
        // (not drawn yet: its guide - the tray out for it)
        this.open();
        this.attach(id, { wheel: true });
      } else this.attach(id, { wheel: true });
    }
    if (!this.isOpen) this.v = null;
  }

  // ------------------------------------------------------------------ each frame
  // (game/game.js) the city slowed while it is built on - with the police after you, twelve seconds of it
  slow() {
    if (this.wheel || this.tracing) return true;
    if (!this.isOpen) return false;
    const pol = this.game.police;
    return !(pol && pol.level > 0) || this.openT < 12;
  }

  update(rdt) {
    const g = this.game;
    if (this.isOpen) {
      this.openT += rdt;
      const v = this.v;
      const p = g.player;
      const gone = !v || v.dead || g.state !== 'play' || (p.inVehicle && p.inVehicle !== v) || (!p.inVehicle && Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) > 14) || (g.dialog && g.dialog.open) || !this.wanted();
      if (gone) this.close(true);
    }
    // (the button: there while there is a ride to build on)
    // (on a phone, on foot beside one; in a ride the pencil button is the tray's - game/game.js)
    const can = !this.isOpen && !!g.touch && !g.player.inVehicle && this.can() && !(g.freedraw && g.freedraw.isOpen);
    if (can !== this.btnOn) {
      this.btnOn = can;
      if (this.btnEl) this.btnEl.classList.toggle('on', can);
    }
    // (the mode shift on the ride you are in: its button)
    const iv = g.player.inVehicle;
    const modes = !this.isOpen && g.state === 'play' && !!iv && !iv.dead && !!iv.fz && !!iv.fz.modes && !(g.freedraw && g.freedraw.isOpen);
    const msig = modes ? (iv.fzFold ? 'road' : 'air') : '';
    if (msig !== this.modeSig) {
      this.modeSig = msig;
      const el = this.modeEl;
      if (el) {
        el.classList.toggle('on', modes);
        el.classList.toggle('road', msig === 'road');
        el.querySelector('b').textContent = msig === 'road' ? tr('כביש', 'Road') : tr('אוויר', 'Air');
      }
    }
    this.show();
    this.fx();
  }

  // (ROADMAP 28.9, the mode button) the mode shift on the ride you are in: what flies folded away for the road - no
  // wide wings to catch a wall, no drag, no weight of theirs in the handling - and out again for the air
  shift() {
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v || v.dead || !v.fz || !v.fz.modes || !g.fuse) return false;
    if (v.air && !v.fzFold) {
      g.hud.toast(tr('באוויר לא מקפלים — קודם לנחות', 'No folding in the air — land first'), 'bad', 2);
      g.audio.play('rubber', 0.4);
      return false;
    }
    v.fzFold = !v.fzFold;
    g.fuse.applyVeh(v);
    g.fuse.buildVeh(v);
    g.audio.play('clank', 0.5);
    g.hud.toast(v.fzFold ? tr('מצב כביש: הכנפיים, הרוטור והכדור מקופלים', 'Road mode: the wings, the rotor and the balloon folded away') : tr('מצב אוויר: הכול פרוש', 'Air mode: everything out'), 'good', 2.2);
    this.modeSig = null;
    return true;
  }

  // (a phone, in a ride: the pencil button is the tray's - a touch the tray, held the quick wheel)
  pencilMine() {
    const g = this.game;
    return !!g.touch && !!g.player.inVehicle && this.can() && !(g.freedraw && g.freedraw.isOpen);
  }

  // (game/game.js: the pencil's key came from the phone's pencil button, and that touch is the tray's own)
  pencilTaken() {
    const t = !!this.pencilQ;
    this.pencilQ = false;
    return t;
  }

  // the camera: round the ride, all of it and what is on it in the upper part of the picture, over the tray
  cam(rdt) {
    const g = this.game;
    const v = this.v;
    const on = this.isOpen && !!v && g.state === 'play';
    this.ck = damp(this.ck, on ? 1 : 0, on ? 6 : 5, rdt);
    if (this.ck < 0.004 || !v) {
      this.ck = 0;
      return;
    }
    const cam = g.camera;
    // (ROADMAP 29.5: all of a ride that is not a car - its boom, its wings)
    const C = g.fuse.drawCtx(v);
    const D = C.size || C.D;
    const fz = v.fz || {};
    const lift = fz.lift || 0;
    // (how far out and how high it reaches with its parts)
    let rad = Math.hypot(D.hl, D.hw) + 0.4;
    let top = D.h + 0.3;
    for (const p of v.fuse ? v.fuse.parts : []) {
      if (p.type === 'wing') rad = Math.max(rad, D.hw + (p.n.span || 1.5) + 0.3);
      else if (p.type === 'rotor') rad = Math.max(rad, (p.n.span || 3) * 0.55);
      else if (p.type === 'balloon') top = Math.max(top, D.h + 1.6 + (p.n.d || 2) * 1.25);
      else if (p.type === 'chute') top = Math.max(top, D.h + 0.6);
      // (ROADMAP 29.5: on a ride that is not a car, as high as its parts go - a rotor up on its mast over a jet ski)
      if (C.size && p.at) top = Math.max(top, p.at[1] + 0.4);
    }
    const tanY = Math.tan(((cam.fov || 50) * Math.PI) / 360);
    const tanX = tanY * (cam.aspect || 1.6);
    // (the tray takes the bottom third: the ride fitted into what is left over it)
    // (how much of the picture's height it takes seen from this high: its own height, and its length and breadth laid
    // back by the angle)
    // (the garage's stage: the ride turning slowly under the eye)
    if (this.stage && on && !this.tracing && !this.drag) this.camYaw += rdt * 0.4;
    const yw = v.yaw + this.camYaw;
    const cp = Math.cos(this.camPitch);
    const sp = Math.sin(this.camPitch);
    const dist = clamp(Math.max((rad * 1.08) / tanX, (top * 0.5 * cp + rad * sp) / (tanY * 0.6)) * this.camZoom, 3.6, 30);
    const by = (v.pos.y || 0) + lift;
    const mid = by + top * 0.46;
    _w.set(v.pos.x, mid - dist * tanY * 0.34, v.pos.z);
    _p.set(v.pos.x + Math.sin(yw) * cp * dist, mid + sp * dist, v.pos.z + Math.cos(yw) * cp * dist);
    // (pulled in before a wall)
    const coll = g.world && g.world.collision;
    if (coll && coll.raycast) {
      _o.set(v.pos.x, by + D.h + 0.3, v.pos.z);
      _d.subVectors(_p, _o);
      const L = _d.length();
      _d.multiplyScalar(1 / L);
      const hit = coll.raycast(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, L + 0.3);
      if (hit && hit.t < L) _p.copy(_o).addScaledVector(_d, Math.max(2.2, hit.t - 0.35));
    }
    const e = this.ck * this.ck * (3 - 2 * this.ck);
    _m.lookAt(_p, _w, UPY);
    _q.setFromRotationMatrix(_m);
    cam.position.lerp(_p, e);
    cam.quaternion.slerp(_q, e);
    cam.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ the page
  ui() {
    if (typeof document === 'undefined' || !document.body) return;
    const g = this.game;
    const mk = (tag, cls, id) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (id) el.id = id;
      document.body.appendChild(el);
      return el;
    };
    const stop = (el) => {
      for (const ev of ['mousedown', 'click', 'touchstart', 'touchmove', 'touchend', 'contextmenu', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    };
    // the button: a touch opens the tray; held - the quick wheel
    const btn = mk('button', 'bt-btn', 'bt-btn');
    btn.setAttribute('aria-label', tr('רכיבים', 'Parts'));
    btn.innerHTML = `${svgIcon('<path d="M5.5 18.5 L13 11 M13 11 C11.5 8 13.5 4 17.5 4.2 L15.2 6.6 L17.4 8.8 L19.8 6.5 C20 10.4 16 12.5 13 11 M5.5 18.5 C4.6 19.4 4.6 20.4 5.5 21 C6.3 21.6 7.3 21.4 8 20.6 L13 11"/>')}<b>${tr('רכיבים', 'Parts')}</b>${g.touch ? '' : '<kbd>N</kbd>'}`;
    let holdT = null;
    let held = false;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      held = false;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (err) {
        // (no capture: the wheel still follows the finger over the button)
      }
      clearTimeout(holdT);
      const { clientX: x, clientY: y } = e;
      holdT = setTimeout(() => {
        held = this.wheelOpen(x, y);
      }, 380);
    });
    btn.addEventListener('pointermove', (e) => {
      if (this.wheel) this.wheelPoint(e.clientX, e.clientY);
    });
    const up = (take) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(holdT);
      if (this.wheel) this.wheelClose(take);
      else if (take && !held) this.toggle();
    };
    btn.addEventListener('pointerup', up(true));
    btn.addEventListener('pointercancel', up(false));
    stop(btn);
    this.btnEl = btn;

    // the stage: over the picture while the tray is out - round the ride with a finger, a touch on a part of it
    const stage = mk('div', 'bt-stage', 'bt-stage');
    let st = null;
    stage.addEventListener('pointerdown', (e) => {
      if (!this.isOpen) return;
      e.preventDefault();
      try {
        stage.setPointerCapture(e.pointerId);
      } catch (err) {
        // (no matter)
      }
      st = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, yaw: this.camYaw, pitch: this.camPitch, part: this.pickAt(e.clientX, e.clientY), t: performance.now() };
    });
    stage.addEventListener('pointermove', (e) => {
      if (!st) return;
      st.moved = Math.max(st.moved, Math.hypot(e.clientX - st.x0, e.clientY - st.y0));
      st.x = e.clientX;
      st.y = e.clientY;
      // (begun on a part: a line across it - not the camera)
      if (st.part) return;
      this.camYaw = st.yaw - (e.clientX - st.x0) * 0.0085;
      this.camPitch = clamp(st.pitch + (e.clientY - st.y0) * 0.006, 0.08, 1.15);
    });
    const stUp = (e) => {
      const s = st;
      st = null;
      if (!s || !this.isOpen) return;
      if (s.moved < 10) {
        // a touch: a part of the ride chosen (or none: let go of)
        this.sel = s.part && s.part !== this.sel ? s.part : null;
        this.panel = null;
        this.sig = '';
        g.audio.play('click', 0.25);
      } else if (s.part && s.moved > 28) this.cut([s.x0, s.y0], [e.clientX, e.clientY]);
    };
    stage.addEventListener('pointerup', stUp);
    stage.addEventListener('pointercancel', () => (st = null));
    stage.addEventListener('wheel', (e) => {
      if (!this.isOpen) return;
      this.camZoom = clamp(this.camZoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.6, 1.8);
    }, { passive: true });
    stop(stage);
    this.stageEl = stage;

    // what is drawn over the picture: the line from the tray, the ghost, the places, the chosen one's ring
    const fx = mk('canvas', 'bt-fx', 'bt-fx');
    this.fxCv = fx;

    // the tray
    const tray = mk('div', 'bt', 'bt');
    tray.innerHTML = `<div class="bt-top"><div class="bt-meters"></div><div class="bt-hint"></div></div><div class="bt-selbar"></div><div class="bt-side"></div><div class="bt-row"><div class="bt-tabs"></div><div class="bt-chips"></div></div><div class="bt-panel"></div>`;
    stop(tray);
    this.el = tray;
    this.metersEl = tray.querySelector('.bt-meters');
    this.hintEl = tray.querySelector('.bt-hint');
    this.selEl = tray.querySelector('.bt-selbar');
    this.sideEl = tray.querySelector('.bt-side');
    this.tabsEl = tray.querySelector('.bt-tabs');
    this.chipsEl = tray.querySelector('.bt-chips');
    this.panelEl = tray.querySelector('.bt-panel');
    this.metersEl.innerHTML = METERS.map((m) => `<div class="bt-m" data-m="${m.k}">${svgIcon(m.icon)}<b>${m.name}</b><i><u></u><s></s></i></div>`).join('');
    this.sideEl.innerHTML = `<button data-a="undo" aria-label="${tr('ביטול', 'Undo')}">${svgIcon('<path d="M9 7 L4 12 L9 17 M4 12 H14 A4.5 4.5 0 0 1 14 21 H10"/>')}<b>${tr('ביטול', 'Undo')}</b></button><button data-a="mirror" aria-label="${tr('זוגות', 'Pairs')}">${svgIcon('<path d="M12 3 V21 M9 7 L4 12 L9 17 Z M15 7 L20 12 L15 17 Z"/>')}<b>${tr('זוגות', 'Pairs')}</b></button><button data-a="builds" aria-label="${tr('בניות', 'Builds')}">${svgIcon('<path d="M5 4 H16 L19 7 V20 H5 Z M8 4 V9 H15 V4 M8 20 V14 H16 V20"/>')}<b>${tr('בניות', 'Builds')}</b></button><button data-a="book" aria-label="${tr('הכלאות', 'Fusions')}">${svgIcon('<path d="M4 5 C7 3.5 10 3.5 12 5 C14 3.5 17 3.5 20 5 V19 C17 17.5 14 17.5 12 19 C10 17.5 7 17.5 4 19 Z M12 5 V19"/>')}<b>${tr('הכלאות', 'Fusions')}</b></button><button data-a="stage" aria-label="${tr('במה', 'Stage')}">${svgIcon('<path d="M4 15 C4 12 20 12 20 15 C20 18 4 18 4 15 Z M17 7 A6 4 0 0 0 7 7 M7 7 L7 4 M7 7 L10 7"/>')}<b>${tr('במה', 'Stage')}</b></button><button data-a="pen" aria-label="${tr('ציור חופשי', 'Free draw')}">${svgIcon('<path d="M4 20l1.2-4.6L16.6 4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/>')}<b>${tr('ציור', 'Draw')}</b></button><button data-a="done" class="bt-done" aria-label="${tr('סיום', 'Done')}">${svgIcon('<path d="M7 5 L19 12 L7 19 Z"/>')}<b>${tr('סיום', 'Done')}</b></button>`;
    this.tabsEl.innerHTML = TABS.map((t) => `<button data-t="${t}" aria-label="${TAB_NAME[t]}">${svgIcon(TAB_ICON[t])}<b>${TAB_NAME[t]}</b></button>`).join('');

    tray.addEventListener('pointerdown', (e) => {
      const a = e.target.closest('[data-a]');
      const t = e.target.closest('[data-t]');
      const chip = e.target.closest('.bt-chip');
      const b = e.target.closest('[data-b]');
      const x = e.target.closest('[data-x]');
      const mt = e.target.closest('[data-mount]');
      if (a || t || chip || b || x || mt) e.preventDefault();
      if (a) return this.act(a.dataset.a);
      if (t) {
        this.tab = t.dataset.t;
        this.store.tab = this.tab;
        this.save();
        this.panel = null;
        this.sig = '';
        g.audio.play('click', 0.3);
        return null;
      }
      if (x) return this.dropBuild(x.dataset.x);
      if (b) return this.applyBuild(b.dataset.b);
      if (mt && this.sel) {
        const id = trayIdOf(this.sel);
        this.remove(id, { noUndo: true });
        this.sel = this.attach(id, { mount: mt.dataset.mount || null, quiet: true });
        return null;
      }
      if (chip) {
        try {
          tray.setPointerCapture(e.pointerId);
        } catch (err) {
          // (no matter)
        }
        this.startDrag(chip.dataset.i, e.clientX, e.clientY, chip.getBoundingClientRect());
      }
      return null;
    });
    tray.addEventListener('pointermove', (e) => {
      if (this.drag) this.moveDrag(e.clientX, e.clientY);
    });
    tray.addEventListener('pointerup', () => this.endDrag(true));
    tray.addEventListener('pointercancel', () => this.endDrag(false));
    // (the size handle)
    tray.addEventListener('input', (e) => {
      const r = e.target.closest('input[data-size]');
      if (!r || !this.sel) return;
      clearTimeout(this.sizeT);
      const val = +r.value / 100;
      this.sizeT = setTimeout(() => this.resize(this.sel, val), 60);
    });

    // the card a part is drawn on the first time
    const tr0 = mk('div', 'bt-trace', 'bt-trace');
    tr0.innerHTML = `<div class="bt-tcard"><b></b><span></span><canvas></canvas><div class="bt-tbar"><u></u></div><button data-tx="1">${tr('לא עכשיו', 'Not now')}</button><button data-tc="1">${tr('לנקות', 'Clear')}</button></div>`;
    stop(tr0);
    this.traceEl = tr0;
    this.traceCv = tr0.querySelector('canvas');
    this.traceBar = tr0.querySelector('.bt-tbar u');
    const cv = this.traceCv;
    const at = (e) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    cv.addEventListener('pointerdown', (e) => {
      const T = this.tracing;
      if (!T || T.done) return;
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
        // (no matter)
      }
      T.cur = [];
      const [x, y] = at(e);
      this.tracePoint(x, y);
    });
    cv.addEventListener('pointermove', (e) => {
      const T = this.tracing;
      if (!T || !T.cur) return;
      const [x, y] = at(e);
      this.tracePoint(x, y);
    });
    cv.addEventListener('pointerup', () => this.traceUp());
    cv.addEventListener('pointercancel', () => this.traceUp());
    tr0.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-tx]')) {
        e.preventDefault();
        this.cancelTrace();
      } else if (e.target.closest('[data-tc]') && this.tracing) {
        e.preventDefault();
        this.tracing.strokes = [];
        this.tracing.hit.clear();
        this.traceDraw();
      }
    });

    this.cardEl = mk('div', 'bt-card', 'bt-card');
    this.wheelEl = mk('div', 'bt-wheel', 'bt-wheel');
    // the mode button
    const mode = mk('button', 'bt-mode', 'bt-mode');
    mode.innerHTML = `${svgIcon('<path d="M4 8 H17 M14 5 L17 8 L14 11 M20 16 H7 M10 13 L7 16 L10 19"/>')}<b></b>${g.touch ? '' : '<kbd>Y</kbd>'}`;
    mode.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.shift();
    });
    stop(mode);
    this.modeEl = mode;
    // (a phone, in a ride: the game's pencil button - a touch the tray, held the wheel round the finger)
    const pencil = document.getElementById('btn-draw');
    if (pencil && g.touch) {
      let pt = null;
      let mine = false;
      pencil.addEventListener('touchstart', (e) => {
        clearTimeout(pt);
        mine = this.pencilMine();
        this.pencilQ = mine;
        if (!mine || !e.touches.length) return;
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        pt = setTimeout(() => this.wheelOpen(x, y), 380);
      }, { passive: true });
      const pup = (take) => () => {
        clearTimeout(pt);
        if (!mine) return;
        mine = false;
        if (this.wheel) this.wheelClose(take);
        else if (take) this.toggle();
      };
      pencil.addEventListener('touchend', pup(true));
      pencil.addEventListener('touchcancel', pup(false));
      document.addEventListener('touchmove', (e) => {
        if (this.wheel && e.touches.length) this.wheelPoint(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        if (this.tracing) {
          this.traceLayout();
          this.traceDraw();
        }
      });
      // (a computer: N the tray; held - the wheel round the pointer; Ctrl+Z back)
      let nT = null;
      let nHeld = false;
      let mx = window.innerWidth / 2;
      let my = window.innerHeight / 2;
      window.addEventListener('mousemove', (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (this.wheel && !g.touch) this.wheelPoint(mx, my);
      });
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyN' && !e.repeat && g.state === 'play' && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) {
          nHeld = false;
          clearTimeout(nT);
          nT = setTimeout(() => {
            nHeld = this.wheelOpen(window.innerWidth / 2, window.innerHeight / 2);
          }, 380);
        } else if (e.code === 'KeyY' && !e.repeat && g.state === 'play' && !this.isOpen) {
          this.shift();
        } else if (this.isOpen && e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.undo();
        } else if (this.isOpen && e.code === 'Escape' && this.tracing) this.cancelTrace();
      });
      window.addEventListener('keyup', (e) => {
        if (e.code !== 'KeyN') return;
        clearTimeout(nT);
        if (this.wheel) this.wheelClose(true);
        else if (!nHeld && g.state === 'play') this.toggle();
      });
    }
  }

  act(a) {
    const g = this.game;
    if (a === 'undo') return this.undo();
    if (a === 'mirror') {
      this.mirror = !this.mirror;
      g.audio.play('click', 0.3);
      g.hud.toast(this.mirror ? tr('זוגות: צריחים, מנועים ומדחפים עולים בשניים', 'Pairs: turrets, engines and propellers go on in twos') : tr('זוגות: כבוי', 'Pairs: off'), 'info', 1.8);
      this.sig = '';
      return true;
    }
    if (a === 'builds' || a === 'book') {
      this.panel = this.panel === a ? null : a;
      this.sel = null;
      g.audio.play('click', 0.3);
      this.sig = '';
      return true;
    }
    if (a === 'save') return this.saveBuild();
    // (ROADMAP 28.15, the garage: the stage, the three versions, the fine hand)
    if (a === 'stage') {
      this.stage = !this.stage;
      g.audio.play('click', 0.3);
      g.hud.toast(this.stage ? tr('במה: הרכב מסתובב לאט מול העין', 'Stage: the ride turns slowly in front of you') : tr('הבמה נעצרה', 'The stage stopped'), 'info', 1.6);
      this.sig = '';
      return true;
    }
    if (a.startsWith('verx')) return this.dropVersion(+a.slice(4));
    if (a.startsWith('ver')) return this.version(+a.slice(3));
    if (a.startsWith('nudge-')) return this.nudge(a.slice(6));
    if (a === 'off' && this.sel) {
      const id = trayIdOf(this.sel);
      if (id) return this.remove(id);
      g.fuse.removeVeh(this.v, this.sel);
      this.sel = null;
      this.sig = '';
      return true;
    }
    if (a === 'pen') {
      // (the pen that draws straight on the car: game/partpen.js)
      this.close(true);
      if (g.player.inVehicle && g.freedraw) g.freedraw.show();
      else g.hud.toast(tr('ציור ישיר על הרכב — מתוך הרכב', 'Drawing straight on the ride — from inside it'), 'info', 2);
      return true;
    }
    if (a === 'done') return this.close();
    return false;
  }

  show() {
    const el = this.el;
    if (!el) return;
    const v = this.v;
    const on = this.isOpen && !!v;
    const has = on ? trayIdsOn(v) : new Set();
    const M = on ? metersOf(v) : null;
    const play = this.game.gear && this.game.gear.play;
    const sel = on && this.sel && v.fuse && v.fuse.parts.includes(this.sel) ? this.sel : null;
    if (!sel) this.sel = null;
    const sig = `${on}|${this.tab}|${[...has].join()}|${this.count()}|${this.mirror}|${this.panel}|${sel ? sel.id : ''}|${this.undoStack.length}|${Object.keys(this.store.learned).length}|${M ? `${M.weight.toFixed(2)},${M.power.toFixed(2)},${M.lift.toFixed(2)},${M.float.toFixed(2)}` : ''}|${play && v ? TRAY[this.tab].map((id) => (this.cannot(id, v) ? 0 : 1)).join('') : ''}|${this.store.builds.length},${this.store.recent.length},${this.store.book.length}`;
    if (sig === this.sig) return;
    this.sig = sig;
    el.classList.toggle('on', on);
    if (this.stageEl) this.stageEl.classList.toggle('on', on);
    if (!on) return;
    for (const b of this.tabsEl.children) b.classList.toggle('on', b.dataset.t === this.tab);
    this.chipsEl.innerHTML = TRAY[this.tab].map((id) => {
      const it = info(id);
      const why = this.cannot(id, v);
      const cls = ['bt-chip', has.has(id) ? 'has' : '', why ? 'no' : '', this.store.learned[id] ? '' : 'new'].filter(Boolean).join(' ');
      return `<button class="${cls}" data-i="${id}" aria-label="${it.name}">${svgIcon(it.icon)}<b>${it.name}</b>${has.has(id) ? '<i class="bt-on">✓</i>' : why ? `<i class="bt-why">${why}</i>` : this.store.learned[id] ? '' : `<i class="bt-new">${tr('לצייר', 'Draw')}</i>`}</button>`;
    }).join('');
    // the meters
    const val = { weight: clamp(M.weight / 2, 0, 1), power: clamp(M.power / 2, 0, 1), lift: clamp(M.lift, 0, 1), float: clamp(M.float, 0, 1) };
    for (const m of this.metersEl.children) {
      const k = m.dataset.m;
      m.querySelector('u').style.width = `${Math.round(val[k] * 100)}%`;
      m.classList.toggle('full', (k === 'lift' || k === 'float') && val[k] >= 1);
      m.classList.toggle('warn', k === 'weight' && M.weight > 1.45);
    }
    const F = fusionsOf(has);
    this.hintEl.innerHTML = `${F.length ? `<b>${F.map((f) => f.name).join(' · ')}</b>` : ''}<span>${hintOf(v, M, has)}</span><em>${this.count()} / ${MAX_PARTS}</em>`;
    // the side
    for (const b of this.sideEl.children) {
      const a = b.dataset.a;
      b.classList.toggle('on', (a === 'mirror' && this.mirror) || (a === this.panel && !!this.panel));
      b.classList.toggle('dim', a === 'undo' && !this.undoStack.length);
      if (a === 'pen') b.classList.toggle('hidden', !this.game.player.inVehicle);
    }
    // the chosen part of the ride: its size on a handle, where else it goes, and off
    if (sel) {
      const id = trayIdOf(sel);
      const it = id ? info(id) : null;
      const mounts = id ? this.mountsOf(id, v).filter((m) => m.key) : [];
      const size = Math.round((sel.traySize || 1) * 100);
      this.selEl.innerHTML = `<b>${it ? it.name : tr('רכיב', 'Part')}</b>${id && SIZED.has(id) ? `<label>${tr('גודל', 'Size')}<input type="range" data-size="1" min="60" max="170" step="5" value="${size}"></label>` : ''}${mounts.length > 1 ? mounts.map((m) => `<button data-mount="${m.key}" class="${(sel.trayMount || mounts[0].key) === m.key ? 'on' : ''}">${m.name}</button>`).join('') : ''}${this.nudgable(sel) ? `<span class="bt-nudge"><button data-a="nudge-l" aria-label="${tr('שמאלה', 'Left')}">◀</button><button data-a="nudge-f" aria-label="${tr('קדימה', 'Forward')}">▲</button><button data-a="nudge-b" aria-label="${tr('אחורה', 'Back')}">▼</button><button data-a="nudge-r" aria-label="${tr('ימינה', 'Right')}">▶</button></span>` : ''}<button data-a="off" class="bt-off">${tr('להוריד', 'Take off')}</button>`;
      this.selEl.classList.add('on');
    } else {
      this.selEl.classList.remove('on');
      this.selEl.innerHTML = '';
    }
    // the builds kept, the fusion book
    if (this.panel === 'builds') {
      const row = (b, rec) => `<div class="bt-build" data-b="${b.id}"><b>${rec ? tr('אחרונה', 'Recent') : b.name}</b><span>${b.ids.map((id) => (info(id) ? svgIcon(info(id).icon) : '')).join('')}</span><i data-x="${b.id}" aria-label="${tr('למחוק', 'Delete')}">✕</i></div>`;
      const B = this.store.builds;
      const R = this.store.recent;
      const VL = (v && this.store.vers[this.verKey(v)]) || [null, null, null];
      const vers = `<div class="bt-vers">${[0, 1, 2].map((i) => `<button data-a="ver${i}" class="${VL[i] ? 'got' : ''}"><b>${VER_NAME[i]}</b><span>${VL[i] ? VL[i].ids.slice(0, 5).map((id) => (info(id) ? svgIcon(info(id).icon) : '')).join('') : tr('+ לשמור כאן', '+ keep here')}</span>${VL[i] ? `<i data-a="verx${i}" aria-label="${tr('למחוק', 'Delete')}">✕</i>` : ''}</button>`).join('')}</div>`;
      this.panelEl.innerHTML = `<div class="bt-ptitle"><b>${tr('בניות', 'Builds')}</b><button data-a="save">${tr('✦ לשמור את מה שעל הרכב', '✦ Save what is on the ride')}</button></div>${vers}<div class="bt-plist">${B.map((b) => row(b, false)).join('')}${R.map((b) => row(b, true)).join('')}${B.length + R.length ? '' : `<p>${tr('עוד אין בניות. מה שתבנו נשמר לבד — חמש האחרונות', 'No builds yet. What you build keeps itself — the last five')}</p>`}</div>`;
      this.panelEl.classList.add('on');
    } else if (this.panel === 'book') {
      const book = this.store.book;
      this.panelEl.innerHTML = `<div class="bt-ptitle"><b>${tr('ספר ההכלאות', 'The fusion book')}</b><em>${book.length} / ${FUSIONS.length}</em></div><div class="bt-plist bt-book">${FUSIONS.map((f) => {
        const got = book.includes(f.id);
        const now = F.includes(f);
        return `<div class="bt-fus${got ? ' got' : ''}${now ? ' now' : ''}"><b>${got ? f.name : '? ? ?'}</b><span>${got ? f.gives : f.hint}</span></div>`;
      }).join('')}</div>`;
      this.panelEl.classList.add('on');
    } else {
      this.panelEl.classList.remove('on');
      this.panelEl.innerHTML = '';
    }
  }

  // over the picture: the pencil line from the tray, the places a part can go, its ghost, the chosen one's ring
  fx() {
    const cv = this.fxCv;
    if (!cv) return;
    const d = this.drag && this.drag.live ? this.drag : null;
    const sel = this.isOpen ? this.sel : null;
    const want = !!(d || sel);
    if (!want) {
      if (this.fxOn) {
        this.fxOn = false;
        cv.classList.remove('on');
        const c0 = cv.getContext('2d');
        c0.setTransform(1, 0, 0, 1, 0, 0);
        c0.clearRect(0, 0, cv.width, cv.height);
      }
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    if (!this.fxOn) {
      this.fxOn = true;
      cv.classList.add('on');
    }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const v = this.v;
    if (sel && sel.at && v) {
      const q = this.proj(v, sel.at[0], sel.at[1], sel.at[2]);
      if (q && q.front) {
        const r = 26 + Math.sin(performance.now() / 180) * 3;
        c.strokeStyle = 'rgba(255, 200, 40, 0.95)';
        c.lineWidth = 4;
        c.setLineDash([8, 7]);
        c.beginPath();
        c.arc(q.x, q.y, r, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }
    }
    if (!d) return;
    const ok = !d.why && !!d.snap;
    const col = d.why ? '#d83a3a' : d.snap ? '#2a9d55' : '#1f1d2b';
    // the places it can go
    for (const m of this.mountsOf(d.id, v)) {
      const q = this.proj(v, m.at[0], m.at[1], m.at[2]);
      if (!q || !q.front) continue;
      const on = d.snap && d.snap.key === m.key;
      c.fillStyle = on ? 'rgba(42, 157, 85, 0.35)' : 'rgba(255, 210, 60, 0.28)';
      c.strokeStyle = on ? '#2a9d55' : 'rgba(255, 190, 30, 0.95)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(q.x, q.y, on ? 20 : 13, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    // the pencil line, from the part in the tray to the finger (to the place, once it holds)
    const ex = d.snap ? d.snap.sx : d.x;
    const ey = d.snap ? d.snap.sy : d.y;
    c.strokeStyle = col;
    c.lineWidth = 4;
    c.beginPath();
    d.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.lineTo(ex, ey);
    c.stroke();
    // its ghost at the place: its picture, dashed
    const it = info(d.id);
    const G = iconLines(it.icon);
    const s = clamp(h * 0.0052, 1.8, 4.2);
    c.setLineDash([6, 6]);
    c.lineWidth = 3;
    c.strokeStyle = col;
    for (const L of G) {
      c.beginPath();
      L.forEach(([x, y], i) => (i ? c.lineTo(ex + (x - 12) * s, ey + (y - 12) * s) : c.moveTo(ex + (x - 12) * s, ey + (y - 12) * s)));
      c.stroke();
    }
    c.setLineDash([]);
    const text = d.why || (d.snap ? d.snap.name || tr('כאן — לשחרר', 'Here — let go') : tr('אל הרכב', 'Onto the ride'));
    c.font = '700 15px Rubik, sans-serif';
    c.textAlign = 'center';
    const tw = c.measureText(text).width + 18;
    c.fillStyle = 'rgba(255, 253, 246, 0.94)';
    c.strokeStyle = col;
    c.lineWidth = 2.5;
    const ty = ey - 12 * s - 30;
    c.beginPath();
    c.roundRect(ex - tw / 2, ty, tw, 24, 8);
    c.fill();
    c.stroke();
    c.fillStyle = ok ? '#1c6e3b' : d.why ? '#a52626' : '#1f1d2b';
    c.fillText(text, ex, ty + 17);
  }
}

const TRACE_OK = 0.6;
// (the nitro at its second level: the bottle and the chrome exhausts - its third was the jet engine, a part of its own now)
const LV_CAP = { turbo: 2 };
// (what goes on in twos with "pairs" on)
const PAIRS = new Set(['mg', 'jet', 'prop']);
const HOW_SAY = {
  fire: [tr('קליק שמאלי', 'Left click'), tr('כפתור הירי', 'The fire button')],
  jump: [tr('רווח', 'Space'), '▲'],
  turbo: ['Shift', tr('כפתור הטורבו', 'The turbo button')],
  rewind: ['Z', '⟲'],
  guard: ['B', '🛡'],
  mode: ['Y', tr('כפתור המצבים', 'The mode button')],
};
const METERS = [
  { k: 'weight', name: tr('משקל', 'Weight'), icon: '<path d="M6 8 H18 L21 20 H3 Z M9 8 A3 3 0 0 1 15 8"/>' },
  { k: 'power', name: tr('כוח', 'Power'), icon: '<path d="M14 2 L6 13 H11 L9 22 L18 10 H13 Z"/>' },
  { k: 'lift', name: tr('עילוי', 'Lift'), icon: '<path d="M12 21 V4 M6 10 L12 4 L18 10"/>' },
  { k: 'float', name: tr('ציפה', 'Float'), icon: '<path d="M2 14 C5 11 7 17 10 14 C13 11 15 17 18 14 C20 12.5 21 13 22 14 M2 19 C5 16 7 22 10 19 C13 16 15 22 18 19 C20 17.5 21 18 22 19"/>' },
];

const VER_NAME = [tr('מרוץ', 'Race'), tr('קרב', 'Combat'), tr('תעופה', 'Flight')];

// where a link holds on the ride (its frame: x to its left, z to its nose)
function linkAt(kind, D, K) {
  const roof = K ? K.roofY : D.h;
  const low = K ? Math.max(0.4, K.clear + 0.22) : D.h * 0.3;
  if (kind === 'coupler') return [0, r2(low), r2(-D.hl - 0.12)];
  if (kind === 'mode') return [r2(-D.hw * 0.45), r2(roof + 0.02), r2(D.hl * 0.05)];
  if (kind === 'dual') return [r2(D.hw + 0.05), r2(low + 0.15), 0];
  return [0, r2(roof + 0.05), r2(-D.hl * 0.15)];
}
