// (v5, ROADMAP 12.1) A game inside the game: the cabinet in the arcade, the table in the casino,
// the dance floor at the festival. It is played on a sheet of its own over the city, which stands
// still behind it and is not drawn while the sheet covers it (the graphics card rests; a phone the
// most).
//
// A game is an object (game/minigames/*.js):
//   { title, help, pad: 'pad' | 'tap' | 'cards', start(api), update(dt, inp), draw(g, W, H) }
// It draws in its own measure, W = 1000 across and H = 600 down: the canvas is scaled to fit the
// screen, its shape kept. Each frame it is told:
//   inp: { left, right, up, down, a, b (held), hit: Set of 'left' 'right' 'up' 'down' 'a' 'b'
//          'enter' (pressed this frame), at: Map of those to when (performance.now(): a rhythm
//          game judges the moment, not the frame), taps: [[x, y, when]] (this frame, in its measure),
//          drag: { x, y, x0, y0, down } | null (a finger or the mouse held on the canvas),
//          codes: Map of the keyboard's own codes pressed this frame to when, down: Set of those held
//          (a game with keys of its own: the dance floor's D F J K) }
//   api: { finish(res), game, audio, money, rng, toast(text), status(text) }
// finish(res): the sheet closes and whoever opened it hears res ({ score, won, cash, ... }).
//
// (ROADMAP 12.6) Or in the world: play(mod, cb, { world }) puts the game on a screen where it stands -
// the arcade cabinet's, the screen over the Draw-Off's stage, the LED wall behind the DJ - and the
// city goes on round it: the camera held behind your shoulder (world.cam), you at the controls
// (world.stand, world.hands), the game drawn into a texture on a quad in front of that screen
// (world.screen: { at: [x, y, z], n: [nx, nz], w, h }). A finger or the mouse on that screen is a
// tap or a drag on the game, as on the sheet; the keys and the touch pad as before.

import * as THREE from 'three';
import { makeSurface, canvasTexture } from '../render/materials.js';

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down', Space: 'a', KeyJ: 'a', KeyK: 'b', ShiftLeft: 'b', ShiftRight: 'b',
  Enter: 'enter', NumpadEnter: 'enter',
};

export const MG_W = 1000;
export const MG_H = 600;

// (ROADMAP 12.6) where a game is played in the world: a screen (its middle `at`, the way it faces
// `n`, its width - its height follows the game's shape), you standing `stand` metres before it
// (`side` to its right), on the floor at `y0`; the camera `back` behind you and `up` over the floor,
// looking at the screen. hands: where they rest (else before your chest); pen: the drawing hand
// follows the line; exit: where you are let go
export function worldAt(o) {
  const [nx, nz] = o.n;
  const rx = nz;
  const rz = -nx;
  const w = o.w;
  const h = o.h || (w * MG_H) / MG_W;
  const side = o.side || 0;
  const sx = o.at[0] + nx * o.stand + rx * side;
  const sz = o.at[2] + nz * o.stand + rz * side;
  const y0 = o.y0 || 0;
  const back = o.back || 3;
  const fx = -nx;
  const fz = -nz;
  return {
    screen: { at: o.at, n: o.n, w, h, glow: o.glow },
    stand: [sx, sz, Math.atan2(fx, fz), y0],
    cam: {
      pos: [sx - fx * back + rx * (o.camSide !== undefined ? o.camSide : 0.45), y0 + (o.up || 2.2), sz - fz * back + rz * (o.camSide !== undefined ? o.camSide : 0.45)],
      look: [o.at[0], o.at[1] - (o.lookDown || 0), o.at[2]],
    },
    hands: o.hands || [
      [sx + fx * 0.32 - rx * 0.17, y0 + 1.12, sz + fz * 0.32 - rz * 0.17],
      [sx + fx * 0.32 + rx * 0.17, y0 + 1.12, sz + fz * 0.32 + rz * 0.17],
    ],
    pen: !!o.pen,
    exit: o.exit,
  };
}

export class MiniGames {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.mod = null;
    const el = (this.el = document.createElement('div'));
    el.id = 'minigame';
    el.className = 'hidden';
    el.innerHTML = `<div class="mg-touch"></div>
    <div class="mg-sheet paper-card">
      <div class="mg-head"><span class="mg-title"></span><span class="mg-status"></span><span class="mg-gap"></span><button class="ps-btn mg-quit">יציאה</button></div>
      <div class="mg-stage"><canvas></canvas></div>
      <div class="mg-help"></div>
    </div>
    <div class="mg-bar"><span class="mg-title"></span><span class="mg-status"></span><button class="ps-btn mg-quit">יציאה</button></div>
    <div class="mg-pad mg-left"><button data-k="up">▲</button><button data-k="left">◀</button><button data-k="right">▶</button><button data-k="down">▼</button></div>
    <div class="mg-pad mg-right"><button data-k="b">B</button><button data-k="a">A</button></div>`;
    document.body.appendChild(el);
    this.cv = el.querySelector('canvas');
    this.g = this.cv.getContext('2d');
    this.titleEls = el.querySelectorAll('.mg-title');
    this.statusEls = el.querySelectorAll('.mg-status');
    this.helpEl = el.querySelector('.mg-help');
    this.held = new Set();
    this.hit = new Set();
    this.hitAt = new Map();
    this.codes = new Map();
    this.down = new Set();
    this.taps = [];
    this.drag = null;
    for (const q of el.querySelectorAll('.mg-quit')) {
      q.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close({ quit: true });
      });
    }
    // (the touch pad: held while a finger is on it)
    for (const b of el.querySelectorAll('.mg-pad button')) {
      const k = b.dataset.k;
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.held.has(k)) {
          this.hit.add(k);
          this.hitAt.set(k, performance.now());
        }
        this.held.add(k);
        b.classList.add('on');
      };
      const up = (e) => {
        e.preventDefault();
        this.held.delete(k);
        b.classList.remove('on');
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    }
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cv.setPointerCapture(e.pointerId);
      const [x, y] = this.at(e);
      this.taps.push([x, y, performance.now()]);
      this.drag = { x, y, x0: x, y0: y, down: true, t0: performance.now() };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      e.preventDefault();
      const [x, y] = this.at(e);
      this.drag.x = x;
      this.drag.y = y;
    });
    const up = (e) => {
      if (!this.drag) return;
      e.preventDefault();
      // (let go: the game sees the drag once more, no longer down, then it is gone)
      this.drag.down = false;
      this.dragEnded = true;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    // (in the world: a finger or the mouse over the screen where the game is, on the game)
    const tl = el.querySelector('.mg-touch');
    tl.addEventListener('pointerdown', (e) => {
      if (!this.worldMode) return;
      e.preventDefault();
      e.stopPropagation();
      tl.setPointerCapture(e.pointerId);
      const [x, y] = this.atWorld(e);
      this.taps.push([x, y, performance.now()]);
      this.drag = { x, y, x0: x, y0: y, down: true, t0: performance.now() };
    });
    tl.addEventListener('pointermove', (e) => {
      if (!this.worldMode || !this.drag) return;
      e.preventDefault();
      const [x, y] = this.atWorld(e);
      this.drag.x = x;
      this.drag.y = y;
    });
    const tup = (e) => {
      if (!this.worldMode || !this.drag) return;
      e.preventDefault();
      this.drag.down = false;
      this.dragEnded = true;
    };
    tl.addEventListener('pointerup', tup);
    tl.addEventListener('pointercancel', tup);
    // (nothing on the sheet reaches the city under it)
    for (const ev of ['mousedown', 'mouseup', 'click', 'contextmenu', 'touchstart', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') {
        this.close({ quit: true });
        return;
      }
      if (!e.repeat) this.codes.set(e.code, performance.now());
      this.down.add(e.code);
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      if (!e.repeat) {
        this.hit.add(k);
        this.hitAt.set(k, performance.now());
      }
      this.held.add(k);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      const k = KEYS[e.code];
      if (k) this.held.delete(k);
    });
    this.loop = (ts) => this.frame(ts);
  }

  get open() {
    return this.isOpen;
  }

  // while it is open on its sheet the city is not drawn, nor does it go on (game/game.js); in the
  // world it goes on round you
  get covering() {
    return this.isOpen && !this.worldMode;
  }

  // the camera's place while a game is played in the world (game/game.js: camRig.holdAt)
  get camHold() {
    return this.isOpen && this.worldMode ? this.world.cam : null;
  }

  // a game in, played until it finishes (or is left): cb(res)
  play(mod, cb, o = {}) {
    if (this.isOpen) return false;
    const game = this.game;
    this.mod = mod;
    this.cb = cb;
    for (const t of this.titleEls) t.textContent = mod.title || '';
    for (const t of this.statusEls) t.textContent = '';
    this.helpEl.textContent = (game.touch ? mod.helpTouch : mod.help) || mod.help || '';
    this.el.dataset.pad = mod.pad || 'pad';
    this.el.classList.toggle('touch', !!game.touch);
    this.worldMode = !!o.world;
    this.world = o.world || null;
    this.el.classList.toggle('world', this.worldMode);
    // (a game that takes the screen's whole face as its own: drawing, taps - the layer over the
    // city takes the pointer; one played on keys and the pad leaves it alone)
    this.el.dataset.point = mod.pointer ? 'on' : 'off';
    this.held.clear();
    this.hit.clear();
    this.hitAt.clear();
    this.codes.clear();
    this.down.clear();
    this.taps.length = 0;
    this.drag = null;
    this.isOpen = true;
    this.el.classList.remove('hidden');
    if (!game.touch) game.input.releaseLock();
    game.input.keys.clear();
    if (this.worldMode) this.enterWorld(this.world);
    else this.fit();
    let seed = (o.seed || Date.now()) >>> 0;
    const rng = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.api = {
      game,
      audio: game.audio,
      money: game.money,
      rng,
      finish: (res) => this.close(res || {}),
      toast: (text, kind = 'info', s = 2) => game.hud.toast(text, kind, s),
      status: (text) => {
        for (const t of this.statusEls) t.textContent = text;
      },
      world: this.world,
    };
    mod.start(this.api, o);
    this.last = 0;
    this.raf = requestAnimationFrame(this.loop);
    return true;
  }

  close(res) {
    if (!this.isOpen) return;
    this.isOpen = false;
    cancelAnimationFrame(this.raf);
    this.el.classList.add('hidden');
    const mod = this.mod;
    const cb = this.cb;
    this.mod = null;
    this.cb = null;
    // (left with Esc or the button: whatever the game had finished still counts)
    if (res && res.quit && mod && mod.result) res = { ...(mod.result() || {}), quit: true };
    if (mod && mod.stop) mod.stop();
    this.game.input.keys.clear();
    // (the Esc that left the game is not also the city's: no pause menu after it)
    if (this.game.input.pressed) this.game.input.pressed.clear();
    if (this.worldMode) this.leaveWorld();
    if (cb) cb(res || {});
  }

  // ------------------------------------------------------------------ in the world
  enterWorld(w) {
    const game = this.game;
    // the canvas at a size of its own (not on the page): drawn into, shown on the quad
    const cw = game.touch ? 640 : 960;
    this.cv.width = cw;
    this.cv.height = Math.round(cw * (MG_H / MG_W));
    this.scale = cw / MG_W;
    const S = w.screen;
    const [nx, nz] = S.n;
    this.tex = canvasTexture(this.cv, { mips: false });
    this.mat = makeSurface({ kind: 'uv', map: this.tex, uvScale: 2, ang: 0.4, wash: 1, line: 0.2, emissive: new THREE.Color(S.glow || 1, S.glow || 1, S.glow || 1), emMap: this.tex });
    const geo = new THREE.PlaneGeometry(S.w, S.h);
    geo.rotateY(Math.atan2(nx, nz));
    geo.translate(S.at[0] + nx * 0.015, S.at[1], S.at[2] + nz * 0.015);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    game.scene.add(this.mesh);
    // the screen's frame for the pointer: its middle, its face, its right and up
    this.plane = { c: new THREE.Vector3(S.at[0], S.at[1], S.at[2]), n: new THREE.Vector3(nx, 0, nz), r: new THREE.Vector3(nz, 0, -nx), w: S.w, h: S.h };
    // you at it: in your place, facing it, your hands on its controls
    // (held there as on a seat, standing - game/player.js: on a stage too, whatever is under it)
    const p = game.player;
    if (w.stand) {
      const [x, z, yaw, y] = w.stand;
      p.pos.x = x;
      p.pos.z = z;
      if (y !== undefined) p.pos.y = y;
      p.yaw = yaw;
      p.seat = { x, z, yaw, y, lock: true, stand: true, mg: true };
    }
    const f = p.fig;
    if (w.hands) {
      f.reachL = new THREE.Vector3(...w.hands[0]);
      f.reachR = new THREE.Vector3(...w.hands[1]);
    }
    f.lookAt = new THREE.Vector3(S.at[0], S.at[1], S.at[2]);
    this.handsAt = w.hands ? w.hands.map((h) => h.slice()) : null;
    game.camRig.holdT = 0;
    document.body.classList.add('mg-world');
  }

  leaveWorld() {
    const game = this.game;
    if (this.mesh) {
      game.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    if (this.tex) this.tex.dispose();
    if (this.mat) this.mat.dispose();
    this.mesh = null;
    this.tex = null;
    this.mat = null;
    const p = game.player;
    const f = p.fig;
    f.reachL = null;
    f.reachR = null;
    f.lookAt = null;
    if (p.seat && p.seat.mg) p.seat = null;
    // (off a stage: down its steps, where you came from)
    const ex = this.world && this.world.exit;
    if (ex) p.spawn(ex[0], ex[1], ex[2] !== undefined ? ex[2] : p.yaw);
    // (the camera back behind you, from where it was: its yaw and pitch kept)
    this.worldMode = false;
    this.world = null;
    this.el.classList.remove('world');
    document.body.classList.remove('mg-world');
  }

  // the hands on the controls: the stick hand leans with the stick, the button hand presses; on a
  // game drawn with a pen (world.pen), the drawing hand where the line is on the screen
  handsMove(inp) {
    const f = this.game.player.fig;
    const [L, R] = this.handsAt;
    const P = this.plane;
    const k = 0.035;
    const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const dy = (inp.up ? 1 : 0) - (inp.down ? 1 : 0);
    if (f.reachL) f.reachL.set(L[0] + P.r.x * dx * k - P.n.x * dy * k, L[1], L[2] + P.r.z * dx * k - P.n.z * dy * k);
    if (!f.reachR) return;
    const d = inp.drag;
    if (this.world.pen && d) {
      const u = d.x / MG_W - 0.5;
      const v = 0.5 - d.y / MG_H;
      f.reachR.set(P.c.x + P.r.x * u * P.w + P.n.x * 0.05, P.c.y + v * P.h, P.c.z + P.r.z * u * P.w + P.n.z * 0.05);
    } else f.reachR.set(R[0], R[1] - (inp.a || inp.b ? 0.025 : 0), R[2]);
  }

  // a pointer over the city, on the screen in the world: the ray from the camera through it, met
  // with the screen's plane (off its edge too, so a drag that wanders off goes on)
  atWorld(e) {
    const game = this.game;
    const cam = game.camera;
    const r = game.renderer.domElement.getBoundingClientRect();
    const v = _p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(cam);
    const d = v.sub(cam.position).normalize();
    const P = this.plane;
    const den = d.dot(P.n);
    if (Math.abs(den) < 1e-4) return [-1, -1];
    const t = _q.copy(P.c).sub(cam.position).dot(P.n) / den;
    const hit = _q.copy(cam.position).addScaledVector(d, t).sub(P.c);
    const u = hit.dot(P.r) / P.w + 0.5;
    const w = 0.5 - hit.y / P.h;
    return [u * MG_W, w * MG_H];
  }

  // the canvas at the screen's size, in pixels (its drawing scaled to the game's measure)
  fit() {
    if (this.worldMode) return;
    const stage = this.el.querySelector('.mg-stage');
    const r = stage.getBoundingClientRect();
    const k = Math.min(r.width / MG_W, r.height / MG_H) || 1;
    const css = [Math.round(MG_W * k), Math.round(MG_H * k)];
    const dpr = Math.min(window.devicePixelRatio || 1, this.game.touch ? 1.5 : 2);
    this.cv.style.width = css[0] + 'px';
    this.cv.style.height = css[1] + 'px';
    const w = Math.max(1, Math.round(css[0] * dpr));
    const h = Math.max(1, Math.round(css[1] * dpr));
    if (this.cv.width !== w || this.cv.height !== h) {
      this.cv.width = w;
      this.cv.height = h;
    }
    this.scale = w / MG_W;
  }

  // a pointer on the canvas, in the game's measure
  at(e) {
    const r = this.cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * MG_W, ((e.clientY - r.top) / r.height) * MG_H];
  }

  frame(ts) {
    if (!this.isOpen) return;
    const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 1 / 60;
    this.last = ts;
    this.fit();
    const inp = {
      left: this.held.has('left'),
      right: this.held.has('right'),
      up: this.held.has('up'),
      down: this.held.has('down'),
      a: this.held.has('a'),
      b: this.held.has('b'),
      hit: this.hit,
      at: this.hitAt,
      codes: this.codes,
      down: this.down,
      taps: this.taps,
      drag: this.drag,
    };
    const mod = this.mod;
    try {
      mod.update(dt, inp);
      if (!this.isOpen) return;
      this.n = (this.n || 0) + 1;
      if (!this.worldMode || !this.game.touch || this.n % 2 === 0) {
        const g = this.g;
        g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
        mod.draw(g, MG_W, MG_H);
        if (this.tex) this.tex.needsUpdate = true;
      }
      // (in the world, the hands on the controls move with what is pressed)
      if (this.worldMode && this.handsAt) this.handsMove(inp);
    } catch (e) {
      console.error('[minigame]', mod && mod.title, e);
      this.close({ error: true });
      return;
    }
    this.hit.clear();
    this.hitAt.clear();
    this.codes.clear();
    this.taps.length = 0;
    if (this.dragEnded) {
      this.drag = null;
      this.dragEnded = false;
    }
    this.raf = requestAnimationFrame(this.loop);
  }
}

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
