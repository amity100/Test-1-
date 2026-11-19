import * as THREE from 'three';
import { tr } from '../core/lang.js';
import { Kit, itemMats, linC } from './items.js';
// (ROADMAP 28.9) What goes on a gun in the hand: five add-ons, each a thing off a desk.
//
//   scope       - a magnifying glass's tube on top: aimed, the picture comes in and the shots fly truer
//   suppressor  - a fat eraser cap over the muzzle: a soft click, and nobody down the street hears it
//   extmag      - a longer box of leads under it: more shots before it is loaded again
//   bayonet     - a craft knife's blade under the muzzle: someone right in front of you is stabbed, not shot
//   ubgl        - a tube under the barrel with three little bottles of ink: its own button lobs one
//
// Each is drawn once over its guide (game/buildtray.js trace) and is a touch from then on. What is on a gun is kept with
// its kind: the next one of it you make comes with them. The strip opens with the "Mods" button (a phone) or J, with a
// gun that takes any in the hand.

const KEY = 'scribble-city-v5-gunmods';
const C = linC;
const STEEL = C(0.74, 0.76, 0.82);
const DARK = C(0.15, 0.15, 0.19);

export const ATTS = {
  scope: {
    name: tr('כוונת', 'Scope'), does: tr('בכיוון: התמונה מתקרבת והירי מדויק יותר', 'Aimed: the picture comes in and the shots fly truer'),
    icon: '<circle cx="9" cy="10" r="6"/><path d="M13.5 14.5 L21 22 M6 10 H12 M9 7 V13"/>',
  },
  suppressor: {
    name: tr('משתיק', 'Suppressor'), does: tr('ירי שקט: לא נשמע ברחוב, המשטרה לא מוזעקת', 'A quiet shot: not heard down the street, no police called'),
    icon: '<rect x="3" y="8" width="14" height="8" rx="2"/><path d="M17 10 H21 V14 H17 M7 8 V16 M11 8 V16"/>',
  },
  extmag: {
    name: tr('מחסנית מוגדלת', 'Extended Mag'), does: tr('פי 1.6 יריות במחסנית', '1.6 times the shots in a magazine'),
    icon: '<path d="M8 3 H16 V17 L14 21 H8 Z M8 8 H16 M8 13 H16"/>',
  },
  bayonet: {
    name: tr('כידון', 'Bayonet'), does: tr('מי שעומד ממש מולך נדקר במקום להיירות', 'Whoever stands right in front of you is stabbed, not shot'),
    icon: '<path d="M3 15 L18 6 L21 5 L20 8 L6 18 Z M3 15 L6 18 M4 20 L8 16"/>',
  },
  ubgl: {
    name: tr('מטול תת-קני', 'Under-barrel Launcher'), does: tr('כפתור משלו: מטיל בקבוקון דיו שמתפוצץ. שלושה בקנה', 'Its own button: lobs a little bottle of ink that bursts. Three in the tube'),
    icon: '<rect x="2" y="6" width="19" height="5" rx="1"/><rect x="6" y="13" width="12" height="6" rx="3"/><path d="M9 11 V13 M15 11 V13"/>',
  },
};
export const ATT_ORDER = ['scope', 'suppressor', 'extmag', 'bayonet', 'ubgl'];

// which gun takes what
const FITS = {
  paint: ['scope', 'suppressor', 'extmag'],
  magnum: ['scope', 'extmag'],
  paintmg: ['scope', 'suppressor', 'extmag', 'bayonet'],
  rifle: ['scope', 'suppressor', 'extmag', 'bayonet', 'ubgl'],
  ak: ['scope', 'suppressor', 'extmag', 'bayonet', 'ubgl'],
  shotgun: ['extmag', 'bayonet'],
  stapler: ['scope', 'extmag', 'ubgl'],
  glue: ['scope', 'extmag'],
  launcher: ['scope'],
  bazooka: ['scope'],
};
export const fitsOf = (id) => FITS[id] || [];

const svg = (inner) => `<svg viewBox="0 0 24 24">${inner}</svg>`;

export class GunMods {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.store = this.load();
    this.sig = '';
    this.last = null;
    this.stats = { put: 0, off: 0, lobbed: 0 };
    this.ui();
  }

  load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') return o;
    } catch (err) {
      // (none kept)
    }
    return {};
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.store));
    } catch (err) {
      // (not kept: no matter)
    }
  }

  // the gun in the hand, if it takes any: its slot
  slot() {
    const g = this.game;
    const W = g.weapons;
    const s = W && W.current;
    if (!s || !s.model || !s.def || g.player.mode !== 'foot') return null;
    const id = (s.base0 || s.fzBase || s.def).id;
    return fitsOf(id).length ? s : null;
  }

  idOf(slot) {
    return (slot.base0 || slot.fzBase || slot.def).id;
  }

  // ------------------------------------------------------------------ on, off
  toggle(att) {
    const g = this.game;
    const slot = this.slot();
    if (!slot || !ATTS[att]) return false;
    const id = this.idOf(slot);
    if (!fitsOf(id).includes(att)) {
      g.hud.toast(tr(`${ATTS[att].name}: לא מתאים לנשק הזה`, `${ATTS[att].name}: does not fit this gun`), 'bad', 2);
      g.audio.play('rubber', 0.4);
      return false;
    }
    const T = g.tray;
    // (drawn once, over its guide)
    if (T && !T.store.learned[`att:${att}`] && !this.skipFirst()) {
      T.trace(`att:${att}`, { it: ATTS[att], say: tr('מציירים פעם אחת מעל הקווים — ומאז נגיעה אחת מחברת אותו', 'Draw it once over the lines — and from then on one touch puts it on'), then: () => this.toggle(att) });
      return false;
    }
    slot.mods = slot.mods || [];
    const i = slot.mods.indexOf(att);
    if (i >= 0) {
      slot.mods.splice(i, 1);
      this.stats.off++;
      g.audio.play('rubber', 0.4);
    } else {
      slot.mods.push(att);
      this.stats.put++;
      g.audio.play('clank', 0.5);
      g.hud.toast(`${ATTS[att].name}: ${ATTS[att].does}${att === 'ubgl' ? ` · ${g.touch ? tr('כפתור ◉', 'the ◉ button') : 'U'}` : att === 'scope' ? ` · ${g.touch ? tr('כפתור הכיוון', 'the aim button') : tr('קליק ימני', 'right click')}` : ''}`, 'good', 3);
    }
    this.store[id] = slot.mods.slice();
    this.save();
    this.apply(slot);
    this.sig = '';
    return true;
  }

  skipFirst() {
    const P = this.game.params;
    return !!(P && P.get('test') === '1' && P.get('firstdraw') !== '1');
  }

  // what the gun is with what is on it: its numbers from what it was, its add-ons' models on it
  apply(slot) {
    const g = this.game;
    if (!slot.base0) slot.base0 = slot.fzBase || slot.def;
    const B0 = slot.base0;
    const mods = slot.mods || [];
    const def = { ...B0 };
    const mag0 = B0.mag || (g.arsenal ? g.arsenal.magOf({ def: B0 }) : 0);
    if (mods.includes('scope')) {
      def.zoom = Math.max(def.zoom || 1, B0.hands === 2 ? 2.2 : 1.6);
      def.spread = (def.spread || 0.02) * 0.78;
    }
    if (mods.includes('suppressor')) {
      def.quiet = true;
      def.damage = Math.round((def.damage || 10) * 0.9 * 10) / 10;
    }
    if (mods.includes('extmag') && mag0) def.mag = Math.ceil(mag0 * 1.6);
    if (mods.includes('bayonet')) def.bayonet = { damage: 46, range: 2.3 };
    if (mods.includes('ubgl')) def.ubgl = { radius: 4, damage: 80, fuse: 1.4, speed: 26 };
    if (slot.fzBase) {
      // (parts drawn on it by the old pen as well: they are worked out over this - game/fuse.js applyWeapon)
      slot.fzBase = def;
      g.fuse.applyWeapon(slot);
    } else slot.def = def;
    if (def.ubgl && slot.ubgl === undefined) slot.ubgl = 3;
    // (a longer magazine: what is in it stays; a shorter one: no more than it holds)
    if (slot.mag !== undefined) slot.mag = Math.min(slot.mag, g.arsenal ? g.arsenal.magOf(slot) : slot.mag);
    this.build(slot);
    if (g.hud && g.hud.updateWeapon) g.hud.updateWeapon();
  }

  // the add-ons' own models, on the gun (its frame: its grip at the origin, +z its muzzle's way, +y up)
  build(slot) {
    const m = slot.model;
    if (!m || !m.group) return;
    for (const o of slot.modModels || []) {
      m.group.remove(o);
      o.traverse((x) => {
        if (x.geometry && x.geometry.dispose) x.geometry.dispose();
      });
    }
    slot.modModels = [];
    if (!m.muzzle0 && m.muzzle) m.muzzle0 = m.muzzle.clone();
    if (m.muzzle0) m.muzzle.copy(m.muzzle0);
    const mods = slot.mods || [];
    if (!mods.length) return;
    const g = this.game;
    const wb = g.fuse && g.fuse.weaponBox ? g.fuse.weaponBox(slot) : null;
    const B = m.fzBox || (wb && m.fzBox) || new THREE.Box3(new THREE.Vector3(-0.04, -0.1, -0.1), new THREE.Vector3(0.04, 0.1, 0.4));
    const two = (slot.base0 || slot.def).hands === 2;
    const mz = m.muzzle0 || new THREE.Vector3(0, 0.04, B.max.z);
    const M = itemMats();
    const id = this.idOf(slot);
    for (const att of mods) {
      const K = new Kit();
      if (att === 'scope') {
        if (id === 'rifle') continue;
        const L = two ? 0.18 : 0.1;
        const z0 = two ? B.min.z + (B.max.z - B.min.z) * 0.42 : -0.03;
        const y = B.max.y + 0.035;
        K.cyl(M.paint, 0.022, 0.022, z0, z0 + L, DARK, { y, segs: 10 });
        K.cyl(M.paint, 0.028, 0.022, z0 + L, z0 + L + 0.025, DARK, { y, segs: 10 });
        K.cyl(M.glow, 0.02, 0.02, z0 + L + 0.024, z0 + L + 0.028, C(0.4, 0.9, 1.0), { y, segs: 10 });
        K.cyl(M.metal, 0.024, 0.024, z0 + L * 0.4, z0 + L * 0.5, C(0.86, 0.66, 0.3), { y, segs: 10 });
        K.box(M.matte, -0.01, B.max.y - 0.005, z0 + L * 0.2, 0.01, y - 0.015, z0 + L * 0.3, DARK);
        K.box(M.matte, -0.01, B.max.y - 0.005, z0 + L * 0.7, 0.01, y - 0.015, z0 + L * 0.8, DARK);
      } else if (att === 'suppressor') {
        const L = two ? 0.16 : 0.12;
        // (an eraser cap: pink, a blue band)
        K.cyl(M.round, 0.027, 0.027, mz.z - 0.01, mz.z + L, C(0.9, 0.55, 0.62), { x: mz.x, y: mz.y, segs: 10 });
        K.cyl(M.round, 0.0275, 0.0275, mz.z + L * 0.35, mz.z + L * 0.5, C(0.3, 0.45, 0.8), { x: mz.x, y: mz.y, segs: 10 });
        K.cyl(M.matte, 0.012, 0.012, mz.z + L, mz.z + L + 0.004, DARK, { x: mz.x, y: mz.y, segs: 8 });
        m.muzzle.z = mz.z + L + 0.01;
      } else if (att === 'extmag') {
        if (two) {
          const z = Math.min(0.12, B.max.z * 0.3);
          K.box(M.metal, -0.018, B.min.y - 0.11, z - 0.03, 0.018, B.min.y + 0.03, z + 0.03, C(0.3, 0.31, 0.36));
          K.box(M.paint, -0.019, B.min.y - 0.11, z - 0.031, 0.019, B.min.y - 0.09, z + 0.031, C(0.98, 0.8, 0.22));
        } else {
          K.box(M.metal, -0.016, B.min.y - 0.08, -0.085, 0.016, B.min.y + 0.01, -0.04, C(0.3, 0.31, 0.36));
          K.box(M.paint, -0.017, B.min.y - 0.08, -0.086, 0.017, B.min.y - 0.065, -0.039, C(0.98, 0.8, 0.22));
        }
      } else if (att === 'bayonet') {
        // (a craft knife: a yellow handle, a snap-off steel blade)
        K.box(M.paint, -0.008, mz.y - 0.06, mz.z - 0.16, 0.008, mz.y - 0.03, mz.z - 0.02, C(0.98, 0.8, 0.22));
        const bl = new THREE.BoxGeometry(0.004, 0.026, 0.2);
        bl.translate(0, mz.y - 0.045, mz.z + 0.08);
        K.add(M.metal, bl, STEEL);
        const tip = new THREE.ConeGeometry(0.013, 0.05, 3);
        tip.rotateX(Math.PI / 2);
        tip.scale(0.3, 1, 1);
        tip.translate(0, mz.y - 0.045, mz.z + 0.2);
        K.add(M.metal, tip, STEEL);
      } else if (att === 'ubgl') {
        const z0 = B.max.z * 0.3;
        const z1 = Math.min(B.max.z - 0.08, z0 + 0.26);
        const y = mz.y - 0.075;
        K.cyl(M.paint, 0.036, 0.036, z0, z1, C(0.3, 0.36, 0.3), { y, segs: 12 });
        K.cyl(M.metal, 0.039, 0.039, z1 - 0.02, z1, DARK, { y, segs: 12 });
        K.cyl(M.glass, 0.028, 0.028, z1, z1 + 0.03, C(0.12, 0.16, 0.42), { y, segs: 10 });
        K.box(M.matte, -0.008, y + 0.03, z0 + 0.02, 0.008, mz.y - 0.02, z0 + 0.05, DARK);
      }
      if (!K.parts.size) continue;
      const grp = K.build({ seed: 0.37 });
      grp.matrixAutoUpdate = true;
      m.group.add(grp);
      slot.modModels.push(grp);
    }
    // (the gun's box is of the gun alone: what the old pen's parts are placed by)
  }

  // ------------------------------------------------------------------ the launcher under the barrel: its own shot
  lob() {
    const g = this.game;
    const W = g.weapons;
    const slot = W && W.current;
    if (!slot || !slot.def || !slot.def.ubgl || g.player.mode !== 'foot') return false;
    if ((slot.ubgl || 0) <= 0) {
      g.hud.toast(tr('המטול ריק — נטען בחנות כתיבה, או בנשק חדש', 'The launcher is empty — refilled at a stationery shop, or with a new gun'), 'info', 2);
      g.audio.play('click', 0.4);
      return false;
    }
    if (g.time - (this.lobT || -9) < 1.2) return false;
    this.lobT = g.time;
    slot.ubgl--;
    const U = slot.def.ubgl;
    const mz = W.muzzleWorld(slot, new THREE.Vector3());
    mz.y -= 0.07;
    const dir = W.aimPoint.clone().sub(mz).normalize();
    // (up a little: it is lobbed)
    dir.y += 0.16;
    dir.normalize();
    W.launch({ ...slot, def: { ...slot.def, projectile: 'inkbomb', damage: U.damage, radius: U.radius, gravity: 14, colors: null } }, mz.x, mz.y, mz.z, dir.x * U.speed, dir.y * U.speed, dir.z * U.speed, { fuse: U.fuse, life: U.fuse + 0.3, spin: 0, slot });
    g.audio.play('thump', 0.8);
    if (g.camRig && g.camRig.kick) g.camRig.kick(0.03);
    W.recoil = Math.min(1.5, (W.recoil || 0) + 0.9);
    this.stats.lobbed++;
    const at = g.player.pos;
    g.enemies.noise(at, 24);
    g.civilians.panic(at, 30, 'shot', { by: 'player', armed: true });
    g.onCrime('shoot', at.x, at.z);
    this.sig = '';
    return true;
  }

  // ------------------------------------------------------------------ each frame
  update() {
    const g = this.game;
    const W = g.weapons;
    const cur = W && W.current;
    // (a gun newly in the hand: what its kind was given the last time is on it)
    if (cur && cur !== this.last) {
      this.last = cur;
      if (cur.model && cur.def && cur.mods === undefined) {
        const id = cur.def.id;
        const kept = (this.store[id] || []).filter((a) => fitsOf(id).includes(a));
        cur.mods = kept.slice();
        if (kept.length) this.apply(cur);
      }
    }
    const slot = g.state === 'play' ? this.slot() : null;
    if (this.isOpen && (!slot || (g.freedraw && g.freedraw.isOpen) || (g.tray && g.tray.isOpen))) this.close();
    // (the buttons: "Mods" with a gun that takes any; the launcher's with one on the gun)
    const can = !!slot && !this.isOpen && !!g.touch && !(g.freedraw && g.freedraw.isOpen) && !(g.tray && g.tray.isOpen);
    if (can !== this.btnOn) {
      this.btnOn = can;
      this.btnEl.classList.toggle('on', can);
    }
    const lob = !!slot && !!slot.def.ubgl && !!g.touch && !(g.freedraw && g.freedraw.isOpen) && !(g.tray && g.tray.isOpen);
    const lsig = lob ? `1${slot.ubgl}` : '';
    if (lsig !== this.lobSig) {
      this.lobSig = lsig;
      this.lobEl.classList.toggle('on', lob);
      if (lob) this.lobEl.querySelector('b').textContent = String(slot.ubgl || 0);
    }
    this.show(slot);
  }

  open() {
    if (!this.slot()) return false;
    this.isOpen = true;
    this.sig = '';
    this.game.audio.play('pageflip', 0.35);
    return true;
  }

  close() {
    this.isOpen = false;
    this.sig = '';
  }

  ui() {
    if (typeof document === 'undefined' || !document.body) return;
    const g = this.game;
    const stop = (el) => {
      for (const ev of ['mousedown', 'click', 'touchstart', 'touchmove', 'touchend', 'contextmenu']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    };
    const btn = document.createElement('button');
    btn.className = 'ga-btn';
    btn.id = 'ga-btn';
    btn.innerHTML = `${svg('<path d="M4 9 H16 L20 11 V14 H12 L10 19 H6 L7 14 H4 Z M17 4 V8 M15 6 H19"/>')}<b>${tr('תוספות', 'Mods')}</b>`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.isOpen) this.close();
      else this.open();
    });
    stop(btn);
    document.body.appendChild(btn);
    this.btnEl = btn;
    const lob = document.createElement('button');
    lob.className = 'ga-lob';
    lob.id = 'ga-lob';
    lob.innerHTML = `${svg('<circle cx="12" cy="13" r="6"/><path d="M12 7 V4 M9 4 H15"/>')}<b>3</b>`;
    lob.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.lob();
    });
    stop(lob);
    document.body.appendChild(lob);
    this.lobEl = lob;
    const el = document.createElement('div');
    el.className = 'ga';
    el.id = 'ga';
    el.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('[data-att]');
      const x = e.target.closest('[data-x]');
      if (c || x) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (c) this.toggle(c.dataset.att);
      else if (x) this.close();
    });
    stop(el);
    document.body.appendChild(el);
    this.el = el;
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.repeat || g.state !== 'play' || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
        if (e.code === 'KeyJ') {
          if (this.isOpen) this.close();
          else this.open();
        } else if (e.code === 'KeyU') this.lob();
        else if (this.isOpen && /^Digit[1-5]$/.test(e.code)) {
          const slot = this.slot();
          const list = slot ? fitsOf(this.idOf(slot)) : [];
          const att = list[+e.code.slice(5) - 1];
          if (att) {
            g.input.pressed.delete(e.code);
            this.toggle(att);
          }
        }
      });
    }
  }

  show(slot) {
    const el = this.el;
    if (!el) return;
    const on = this.isOpen && !!slot;
    const id = on ? this.idOf(slot) : '';
    const T = this.game.tray;
    const sig = `${on}|${id}|${on ? (slot.mods || []).join() : ''}|${T ? Object.keys(T.store.learned).length : 0}`;
    if (sig === this.sig) return;
    this.sig = sig;
    el.classList.toggle('on', on);
    if (!on) return;
    const has = slot.mods || [];
    const first = (a) => T && !T.store.learned[`att:${a}`] && !this.skipFirst();
    const touch = !!this.game.touch;
    el.innerHTML = `<div class="ga-title"><b>${(slot.base0 || slot.def).name}</b><span>${tr('תוספות לנשק', 'Gun add-ons')}</span><i data-x="1">✕</i></div><div class="ga-row">${fitsOf(id).map((a, i) => `<button class="bt-chip${has.includes(a) ? ' has' : ''}${first(a) ? ' new' : ''}" data-att="${a}" aria-label="${ATTS[a].name}">${svg(ATTS[a].icon)}<b>${ATTS[a].name}</b>${has.includes(a) ? '<i class="bt-on">✓</i>' : first(a) ? `<i class="bt-new">${tr('לצייר', 'Draw')}</i>` : touch ? '' : `<i>${i + 1}</i>`}</button>`).join('')}</div>`;
  }
}
