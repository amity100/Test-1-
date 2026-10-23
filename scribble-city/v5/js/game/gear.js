import { ITEMS, HOW } from './itemcat.js';
import { GearPlay } from './gearplay.js';
import { GearPages } from './gearpages.js';
import { KIT } from './gearkit.js';
import { wreck } from './gearfx.js';
import { decoyOf, shields } from './gearguard2.js';
import { clamp, damp } from '../core/util.js';

// (ROADMAP 11.28) What the things of the pen do on your car, beyond what game/fuse.js already makes of
// a part (its lift, its glide, its gun): each thing's own behaviour (game/gearkit.js and the kits it
// gathers: what moves - game/gearmove.js, what fires - game/gearweap.js, what keeps it whole -
// game/gearguard.js), the buttons they are used with, what a use costs and how long till the next, and
// the moving parts of their models (a rotor's blades, a flame that shows only while it burns).
//
// Used: the weapons with the fire button; the turbo with Shift (on a phone its button); a jump, a lift,
// a take-off with Space (▲); the rewind with Z (⟲); protection with B (🛡) - held, the ejector seat.

export class Gear {
  constructor(game) {
    this.game = game;
    this.play = new GearPlay(game);
    // (the blueprint pages hidden about the city: game/gearpages.js)
    this.pages = new GearPages(this);
    // (per part: its state - cooldown, charge, what it holds)
    this.st = new WeakMap();
    // what is out in the world: { kind, ... } (missiles, mines, nets, slicks, the decoy...), stepped and
    // drawn here by their kits
    this.live = [];
    // the slow-down / freeze a thing asks for (the rewind: frozen as it runs back; slow after)
    this.tk = 1;
    this.freeze = 0;
    this.slowUntil = 0;
    this.stats = { uses: {}, rewinds: 0, jumps: 0, boosts: 0, booms: 0 };
    // (the jammer on your car, its level: game/police.js asks)
    this.jam = 0;
    // (the phone's buttons for what has one: the rewind, protection)
    this.btn = { rewind: false, guard: false, guardTap: false };
    this.ui();
  }

  // ------------------------------------------------------------------ levels, what is open
  level(id) {
    return this.play.level(id);
  }

  // the state a part keeps between frames
  of(p) {
    let s = this.st.get(p);
    if (!s) {
      s = { cool: 0, t0: this.game.time };
      this.st.set(p, s);
    }
    return s;
  }

  // ------------------------------------------------------------------ on the car (game/fuse.js applyVeh)
  // what a part of the pen's makes of the car it is on: H its handling, fz its numbers
  apply(v, p, H, fz) {
    const K = KIT[p.item];
    if (!K || !K.apply) return;
    K.apply(this, v, p, H, fz, p.lv || this.level(p.item));
  }

  // (after all its parts: what they make of each other)
  finish(v, parts, H, fz) {
    for (const p of parts) {
      const K = KIT[p.item];
      if (K && K.finish) K.finish(this, v, p, parts, H, fz, p.lv || this.level(p.item));
    }
  }

  // ------------------------------------------------------------------ used
  // ready to use (its cooldown run out, the ink there for it) - and if so, used: true
  use(p, v, quiet = false) {
    const it = ITEMS[p.item];
    const s = this.of(p);
    if (s.cool > 0) return false;
    const ink = this.game.ink;
    const cost = this.play.costs() ? it.ink || 0 : 0;
    if (cost && ink && ink.level < cost) {
      if (!quiet) this.game.hud.toast('אין מספיק דיו', 'bad', 1.4);
      return false;
    }
    if (cost && ink) ink.spend(cost);
    s.cool = it.cool || 0;
    s.used = this.game.time;
    this.stats.uses[p.item] = (this.stats.uses[p.item] || 0) + 1;
    return true;
  }

  // the buttons this frame: fire held, protection pressed / held, the rewind pressed
  keys() {
    const inp = this.game.input;
    const k = inp ? inp.keys : new Set();
    // (a tap quicker than a frame still counts: latched till read)
    const guardDown = k.has('KeyB') || this.btn.guard || this.btn.guardTap;
    this.btn.guardTap = false;
    const was = this.guardWas;
    this.guardWas = guardDown;
    if (guardDown) this.guardHeld = (this.guardHeld || 0) + (this.game.realDt || 1 / 60);
    const out = {
      fire: !!(inp && (inp.fire || inp.firePressed)),
      fireHeld: !!(inp && inp.fire),
      firePressed: !!(inp && inp.firePressed),
      guard: guardDown && !was,
      guardUp: !guardDown && was,
      guardHeld: guardDown ? this.guardHeld : 0,
      rewind: !!(inp && inp.wasPressed('KeyZ')) || this.btn.rewind,
      jump: !!(inp && (inp.wasPressed('Space') || (inp.flyUp && !this.upWas))),
      up: !!(inp && (inp.keys.has('Space') || inp.flyUp)),
    };
    if (!guardDown) this.guardHeld = 0;
    this.upWas = !!(inp && inp.flyUp);
    this.btn.rewind = false;
    return out;
  }

  // ------------------------------------------------------------------ each frame (game/game.js)
  // the pace the city goes at (1: as ever): frozen while the rewind runs back, slow after it
  timeK(rdt) {
    const want = this.freeze > 0 ? 0.0001 : this.game.time < this.slowUntil || performance.now() < this.slowReal ? 0.35 : 1;
    this.tk = want < this.tk ? want : damp(this.tk, want, 4, rdt);
    if (this.tk > 0.995) this.tk = 1;
    return this.tk;
  }

  update(dt) {
    const g = this.game;
    const rdt = g.realDt || dt;
    const v = g.player.inVehicle;
    const parts = v && !v.dead && v.fuse ? v.fuse.parts.filter((p) => p.item && KIT[p.item]) : [];
    const K = v && g.state === 'play' && !(g.freedraw && g.freedraw.isOpen) ? this.keys() : null;
    this.jam = 0;
    for (const p of parts) {
      const s = this.of(p);
      s.cool = Math.max(0, s.cool - dt);
      const kit = KIT[p.item];
      if (kit.update) kit.update(this, v, p, dt, s, K, p.lv || this.level(p.item));
    }
    // what is out in the world
    for (let i = this.live.length - 1; i >= 0; i--) {
      const o = this.live[i];
      const kit = KIT[o.kit];
      const done = !kit || !kit.step || kit.step(this, o, dt, rdt);
      if (done) {
        if (kit && kit.gone) kit.gone(this, o);
        this.live.splice(i, 1);
      }
    }
    // (the rewind keeps its tape - and runs it back - in game/gearmove.js)
    if (KIT.rewind && KIT.rewind.tape) KIT.rewind.tape(this, v, dt, rdt);
    this.play.update(dt);
    this.pages.update(dt);
    this.showUI(v, parts);
  }

  // ------------------------------------------------------------------ the models' moving parts (game/fuse.js draw)
  animate(v, o, dt, fr) {
    const ud = o.m.userData;
    const kit = KIT[o.p.item];
    const s = this.of(o.p);
    if (kit && kit.animate) kit.animate(this, v, o, dt, s, fr);
    // (a flame of a thing still taking shape: out, the ink lands on it)
    const shaping = o.p.shaping && performance.now() < o.p.shaping + 900;
    for (const [name, G] of Object.entries(ud.groups || {})) {
      if (G.kind === 'flame') {
        const on = shaping || !!(s.flame && s.flame[name] !== undefined ? s.flame[name] : s.flameOn);
        const k = on ? 1 + Math.sin(this.game.time * 41 + name.length) * 0.12 : 0.001;
        G.node.scale.setScalar(damp(G.node.scale.x, k, on ? 22 : 12, dt));
        G.node.visible = G.node.scale.x > 0.02;
      } else if (G.kind === 'blink') {
        G.node.visible = Math.sin(this.game.time * 7 + (o.side || 1)) > 0.55;
      }
    }
  }

  // the effects in ink of what is out (ropes, arcs, nets, the dome...)
  draw(fr) {
    this.pages.draw(fr);
    for (const o of this.live) {
      const kit = KIT[o.kit];
      if (kit && kit.draw) kit.draw(this, o, fr);
    }
    const v = this.game.player.inVehicle;
    if (v && v.fuse) {
      for (const p of v.fuse.parts) {
        const kit = p.item && KIT[p.item];
        if (kit && kit.drawOn) kit.drawOn(this, v, p, this.of(p), fr);
      }
    }
  }

  // ------------------------------------------------------------------ what the world asks of them
  // (game/vehicles.js drive, via game/fuse.js floor) what a car stands on that they laid: a bridge
  floorAt(x, z, y) {
    let best = -Infinity;
    for (const o of this.live) {
      const kit = KIT[o.kit];
      if (kit && kit.floorAt) best = Math.max(best, kit.floorAt(this, o, x, z, y));
    }
    return best;
  }

  // (game/chase.js drive, game/traffic.js) a police car held by them - stopped by a bolt, under a net,
  // spinning on oil, on a harpoon: moved here, true
  holdCar(c, dt) {
    if (!c.gear) return false;
    const t = this.game.time;
    const H = c.gear;
    if (H.until && t > H.until) {
      c.gear = null;
      // (spun off by the saws: wrecked where it stopped)
      if (H.then === 'wreck') wreck(this, c, 26);
      return false;
    }
    for (const kit of Object.values(KIT)) if (kit.hold && kit.hold(this, c, H, dt)) return true;
    return false;
  }

  // (game/chase.js quarry, game/police.js target) what the police chase instead of your car: the drawn
  // double (game/gearguard2.js)
  decoy() {
    return decoyOf(this);
  }

  // (game/weapons.js, game/player.js hurt) a shot at your car from (x, z) stopped by the rear shield, the dome
  shields(v, x, z) {
    return shields(this, v, x, z);
  }

  // ------------------------------------------------------------------ the page's own bits
  ui() {
    if (typeof document === 'undefined' || !document.body) return;
    const touch = document.getElementById('touch');
    const mk = (id, label, svg) => {
      const b = document.createElement('button');
      b.id = id;
      b.className = 'pedal pill gear-btn hidden';
      b.setAttribute('aria-label', label);
      b.innerHTML = `<svg class="ico" viewBox="0 0 24 24">${svg}</svg><span>${label}</span><i class="cd"></i>`;
      (touch || document.body).appendChild(b);
      return b;
    };
    this.rewindBtn = mk('btn-rewind', 'אחורה', '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4h-3.5M3.6 8.6A9.2 9.2 0 0 1 9 3.9M3.6 8.6 3 5.2M3.6 8.6 7 8.2"/>');
    this.guardBtn = mk('btn-gear', 'הגנה', '<path d="M12 2.8l7.5 3v5.4c0 4.9-3.2 8.4-7.5 10-4.3-1.6-7.5-5.1-7.5-10V5.8z"/>');
    const hold = (el, set) => {
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        el.classList.add('on');
        set(true);
      }, { passive: false });
      const up = () => {
        el.classList.remove('on');
        set(false);
      };
      el.addEventListener('touchend', up);
      el.addEventListener('touchcancel', up);
    };
    hold(this.rewindBtn, (on) => {
      if (on) this.btn.rewind = true;
    });
    hold(this.guardBtn, (on) => {
      this.btn.guard = on;
      if (on) this.btn.guardTap = true;
    });
    // (a computer: what is on the car and what each is used with - beside the slots)
    const bar = document.createElement('div');
    bar.id = 'gear-bar';
    bar.className = 'gear-bar';
    document.body.appendChild(bar);
    this.barEl = bar;
    this.barSig = '';
  }

  // the phone's buttons and the bar of meters (the nitro, what is cooling down)
  showUI(v, parts) {
    const g = this.game;
    const show = !!v && g.state === 'play' && !(g.freedraw && g.freedraw.isOpen);
    const has = (u) => show && parts.some((p) => ITEMS[p.item].use === u);
    if (this.rewindBtn) this.rewindBtn.classList.toggle('hidden', !(g.touch && has('rewind')));
    if (this.guardBtn) this.guardBtn.classList.toggle('hidden', !(g.touch && (has('guard') || has('eject'))));
    if (!this.barEl) return;
    const meters = [];
    if (show) {
      for (const p of parts) {
        const it = ITEMS[p.item];
        const s = this.of(p);
        const kit = KIT[p.item];
        const fill = kit && kit.meter ? kit.meter(this, v, p, s) : it.cool ? 1 - s.cool / it.cool : null;
        if (fill === null || fill === undefined) continue;
        const how = HOW[it.use] ? HOW[it.use][g.touch ? 1 : 0] : '';
        meters.push({ id: p.item, name: it.name, fill: clamp(fill, 0, 1), how });
      }
    }
    const sig = meters.map((m) => `${m.id}:${Math.round(m.fill * 40)}`).join('|');
    if (sig === this.barSig) return;
    this.barSig = sig;
    this.barEl.classList.toggle('on', meters.length > 0);
    this.barEl.innerHTML = meters.map((m) => `<div class="gm${m.fill >= 1 ? ' full' : ''}"><b>${m.name}</b><span><i style="width:${Math.round(m.fill * 100)}%"></i></span>${m.how ? `<kbd>${m.how}</kbd>` : ''}</div>`).join('');
    for (const [b, id] of [[this.rewindBtn, 'rewind'], [this.guardBtn, null]]) {
      if (!b) continue;
      const m = meters.find((x) => (id ? x.id === id : ITEMS[x.id].use === 'guard' || ITEMS[x.id].use === 'eject'));
      const cd = b.querySelector('.cd');
      if (cd) cd.style.transform = `scaleX(${m ? m.fill.toFixed(2) : 1})`;
    }
  }
}
