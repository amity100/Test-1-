import { BLUEPRINTS, BLUEPRINT_ORDER, BLUEPRINT_MORE, BLUEPRINT_TOOLS, drawBlueprint } from '../game/blueprints.js';
import { GRADE } from '../game/weapons.js';
import { AVES, STREETS, nearestRoadInfo, districtName } from '../world/layout.js';

const KEY = 'scribble-city-album-v1';

// For now every blueprint is open to draw from the start (to try them all). Off (ROADMAP 9.1: the
// settings' "every blueprint open", not with ?classic): only what was found in the city -
// photographed on a board in the street or up on a roof, bought in a shop, won at the arcade,
// given for a good deed or with a place you bought. The album says where the missing ones are.
export const ALL_OPEN = true;

// (ROADMAP 9.1) where the ones not on a board of their own are to be had, besides the boards
const FOUND_IN = {
  bandage: 'במכולות שבשדרות',
  stapler: 'בחנות כלי העבודה',
  glue: 'בחנות כלי העבודה',
  bike: 'בחנות הגלישה',
  boomerang: 'בחנות הגלישה',
  inkbomb: 'מתנה למי שקונה את INK CLUB',
  parachute: 'מתנה למי שקונה את Star Motel',
  laser: 'מתנה למי שקונה את Pixel Arcade',
  planes: 'מתנה למי שקונה את Bay Cafe',
  // (ROADMAP 9.2)
  ladder: 'בחנות כלי העבודה',
  ramp: 'בחנות כלי העבודה',
  bridge: 'בחנות כלי העבודה',
  key: 'בחנות כלי העבודה',
  umbrella: 'במכולות שבשדרות',
};

// the library's shelves
const SHELVES = [
  ['כלי רכב', (bp) => bp.kind === 'vehicle'],
  ['נשק', (bp) => bp.kind === 'weapon'],
  ['ציוד ועזרה ראשונה', (bp) => bp.kind === 'gear' || bp.kind === 'heal'],
  // (ROADMAP 9.2, not with ?classic)
  ['כלים לבעיות בדרך', (bp) => bp.kind === 'tool'],
];

/**
 * Photos of blueprints the player collected. Persisted per browser (best effort).
 */
export class Album {
  constructor(game) {
    this.game = game;
    this.items = new Map(); // id -> { best }
    // (the settings' "every blueprint open", ROADMAP 9.1: game/game.js)
    this.allOpen = ALL_OPEN;
    this.el = document.getElementById('album');
    this.list = document.getElementById('album-list');
    document.getElementById('album-close').addEventListener('click', () => this.hide());
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [id, v] of Object.entries(data)) if (BLUEPRINTS[id]) this.items.set(id, v);
    } catch (e) {
      // storage unavailable: start empty
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(this.items)));
    } catch (e) {
      // ignore
    }
  }

  has(id) {
    return this.allOpen ? !!BLUEPRINTS[id] : this.items.has(id);
  }

  // (ROADMAP 9.1, not with ?classic: all open, or found one by one)
  setOpen(on) {
    if (!this.game.classic) this.allOpen = on;
  }

  add(id) {
    if (this.items.has(id) || (this.game.classic && this.has(id))) return false;
    this.items.set(id, { best: null });
    this.save();
    // (everything open anyway: it is kept for the day it is not - ROADMAP 9.1)
    if (this.allOpen) return false;
    if (this.onAdd) this.onAdd(id);
    return true;
  }

  // a blueprint given (ROADMAP 9.1: with a place you bought, for a robber caught...): into the
  // album, and you are told; false if it was there already
  gift(id, from) {
    const bp = BLUEPRINTS[id];
    if (!bp || !this.add(id)) return false;
    const g = this.game;
    g.hud.toast(`שרטוט חדש באלבום: ${bp.name}, ${from}! ${g.touch ? 'העיפרון ✏' : 'Q'} — לצייר אותו`, 'good', 3.6);
    g.audio.play('pageflip');
    return true;
  }

  // one of the light ones still missing (not the tank, the copter, the minigun, the plane)
  giftAny(from) {
    if (this.allOpen) return false;
    const left = this.order.filter((id) => !this.items.has(id) && BLUEPRINTS[id].difficulty <= 3);
    if (!left.length) return false;
    return this.gift(left[Math.floor(Math.random() * left.length)], from);
  }

  // where one not yet in the album is to be found: its nearest board (in the street, or up on a
  // roof) and the shops or deeds that give it
  where(id) {
    const g = this.game;
    const p = g.player.pos;
    let best = null;
    let bd = Infinity;
    for (const b of g.world.billboards || []) {
      if (b.id !== id) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    const out = [];
    if (best) {
      const r = nearestRoadInfo(best.x, best.z);
      const road = r.aveDist < r.streetDist ? AVES[r.ave].name : STREETS[r.street].name;
      const area = districtName(best.x, best.z);
      out.push(`${best.roof ? 'על גג' : 'על שלט'} ליד ${road}${area && area !== road ? `, ${area}` : ''}`);
    }
    if (FOUND_IN[id]) out.push(FOUND_IN[id]);
    if (!out.length) out.push('אולי במכונה בארקייד, עם קצת מזל');
    return out.join(' · ');
  }

  recordGrade(id, score) {
    let it = this.items.get(id);
    if (!it) {
      if (!this.allOpen) return;
      it = { best: null };
      this.items.set(id, it);
    }
    if (it.best === null || score > it.best) it.best = score;
    this.save();
  }

  // (the new ones, ROADMAP 4.8: not with ?classic)
  get order() {
    return this.game.classic ? BLUEPRINT_ORDER : this._order || (this._order = [...BLUEPRINT_ORDER, ...BLUEPRINT_MORE, ...BLUEPRINT_TOOLS]);
  }

  get size() {
    return this.allOpen ? this.order.length : this.items.size;
  }

  // in the order of the shelves (the arrows in the drawing go through them like this)
  ids() {
    const out = [];
    for (const [, fits] of SHELVES) for (const id of this.order) if (fits(BLUEPRINTS[id]) && this.has(id)) out.push(id);
    return out;
  }

  // onPick(id): a photo was picked; onClose(): closed without picking one
  show(onPick, onClose = null) {
    this.onPick = onPick;
    this.onClose = onClose;
    this.list.innerHTML = '';
    const last = this.game.drawPick;
    for (const [title, fits] of SHELVES) {
      // (a shelf with nothing on it in this edition: not shown - the tools are not with ?classic)
      if (!this.order.some((id) => fits(BLUEPRINTS[id]))) continue;
      const head = document.createElement('div');
      head.className = 'album-shelf';
      head.textContent = title;
      this.list.appendChild(head);
      for (const id of this.order) if (fits(BLUEPRINTS[id])) this.addItem(id, id === last);
    }
    this.el.classList.remove('hidden');
    this.open = true;
  }

  addItem(id, last) {
    const bp = BLUEPRINTS[id];
    const got = this.has(id);
    const item = document.createElement('div');
    item.className = `album-item ${got ? '' : 'locked'} ${last ? 'last' : ''}`;
    const pol = document.createElement('div');
    pol.className = 'polaroid';
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#f7f4ec';
    g.fillRect(0, 0, c.width, c.height);
    if (got) drawBlueprint(g, bp, 0, 0, c.width, c.height, { pad: 0.1, width: 2.5 });
    else {
      g.fillStyle = '#c9c4b6';
      g.font = 'bold 80px Rubik, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', 150, 100);
    }
    pol.appendChild(c);
    const cap = document.createElement('div');
    cap.className = 'caption';
    cap.textContent = got ? bp.name : 'עוד לא צולם';
    pol.appendChild(cap);
    item.appendChild(pol);
    // (not found yet: where it is - ROADMAP 9.1)
    if (!got && !this.game.classic) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = this.where(id);
      item.appendChild(hint);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const rec = this.items.get(id);
    const best = got && rec && rec.best !== null ? ` · שיא: ${rec.best}` : '';
    meta.innerHTML = `<span class="stars">${'●'.repeat(bp.difficulty)}${'○'.repeat(5 - bp.difficulty)}</span> ${got ? (bp.kind === 'vehicle' ? 'כלי רכב' : bp.kind === 'gear' ? 'ציוד' : bp.kind === 'heal' ? 'עזרה ראשונה' : bp.kind === 'tool' ? 'כלי' : 'נשק') : ''}${best}`;
    item.appendChild(meta);
    if (got) {
      const go = document.createElement('div');
      go.className = 'go';
      go.textContent = '✏ לצייר באוויר';
      item.appendChild(go);
    }
    if (got) {
      item.addEventListener('click', () => {
        this.hide(true);
        if (this.onPick) this.onPick(id);
      });
    }
    this.list.appendChild(item);
  }

  hide(picked = false) {
    if (!this.open) return;
    this.el.classList.add('hidden');
    this.open = false;
    const close = this.onClose;
    this.onClose = null;
    if (!picked && close) close();
  }
}

export { GRADE };
