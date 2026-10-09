import { BLUEPRINTS, BLUEPRINT_ORDER, drawBlueprint } from '../game/blueprints.js';
import { GRADE } from '../game/weapons.js';

const KEY = 'scribble-city-album-v1';

// For now every blueprint is open to draw from the start (to try them all); how the player
// finds them in the city comes later. Off: only what you photographed (or were given).
export const ALL_OPEN = true;

// the library's shelves
const SHELVES = [
  ['כלי רכב', (bp) => bp.kind === 'vehicle'],
  ['נשק', (bp) => bp.kind === 'weapon'],
  ['ציוד ועזרה ראשונה', (bp) => bp.kind === 'gear' || bp.kind === 'heal'],
];

/**
 * Photos of blueprints the player collected. Persisted per browser (best effort).
 */
export class Album {
  constructor(game) {
    this.game = game;
    this.items = new Map(); // id -> { best }
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
    return ALL_OPEN ? !!BLUEPRINTS[id] : this.items.has(id);
  }

  add(id) {
    if (this.has(id)) return false;
    this.items.set(id, { best: null });
    this.save();
    if (this.onAdd) this.onAdd(id);
    return true;
  }

  recordGrade(id, score) {
    let it = this.items.get(id);
    if (!it) {
      if (!ALL_OPEN) return;
      it = { best: null };
      this.items.set(id, it);
    }
    if (it.best === null || score > it.best) it.best = score;
    this.save();
  }

  get size() {
    return ALL_OPEN ? BLUEPRINT_ORDER.length : this.items.size;
  }

  // in the order of the shelves (the arrows in the drawing go through them like this)
  ids() {
    const out = [];
    for (const [, fits] of SHELVES) for (const id of BLUEPRINT_ORDER) if (fits(BLUEPRINTS[id]) && this.has(id)) out.push(id);
    return out;
  }

  // onPick(id): a photo was picked; onClose(): closed without picking one
  show(onPick, onClose = null) {
    this.onPick = onPick;
    this.onClose = onClose;
    this.list.innerHTML = '';
    const last = this.game.drawPick;
    for (const [title, fits] of SHELVES) {
      const head = document.createElement('div');
      head.className = 'album-shelf';
      head.textContent = title;
      this.list.appendChild(head);
      for (const id of BLUEPRINT_ORDER) if (fits(BLUEPRINTS[id])) this.addItem(id, id === last);
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
    const meta = document.createElement('div');
    meta.className = 'meta';
    const rec = this.items.get(id);
    const best = got && rec && rec.best !== null ? ` · שיא: ${rec.best}` : '';
    meta.innerHTML = `<span class="stars">${'●'.repeat(bp.difficulty)}${'○'.repeat(5 - bp.difficulty)}</span> ${got ? (bp.kind === 'vehicle' ? 'כלי רכב' : bp.kind === 'gear' ? 'ציוד' : bp.kind === 'heal' ? 'עזרה ראשונה' : 'נשק') : ''}${best}`;
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
