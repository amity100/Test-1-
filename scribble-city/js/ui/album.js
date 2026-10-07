import { BLUEPRINTS, BLUEPRINT_ORDER, drawBlueprint } from '../game/blueprints.js';
import { GRADE } from '../game/weapons.js';

const KEY = 'scribble-city-album-v1';

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
    return this.items.has(id);
  }

  add(id) {
    if (this.items.has(id)) return false;
    this.items.set(id, { best: null });
    this.save();
    return true;
  }

  recordGrade(id, score) {
    const it = this.items.get(id);
    if (!it) return;
    if (it.best === null || score > it.best) it.best = score;
    this.save();
  }

  get size() {
    return this.items.size;
  }

  ids() {
    return BLUEPRINT_ORDER.filter((id) => this.items.has(id));
  }

  show(onPick) {
    this.onPick = onPick;
    this.list.innerHTML = '';
    for (const id of BLUEPRINT_ORDER) {
      const bp = BLUEPRINTS[id];
      const got = this.items.has(id);
      const item = document.createElement('div');
      item.className = `album-item ${got ? '' : 'locked'}`;
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
      const best = got && this.items.get(id).best !== null ? ` · שיא: ${this.items.get(id).best}` : '';
      meta.innerHTML = `<span class="stars">${'●'.repeat(bp.difficulty)}${'○'.repeat(5 - bp.difficulty)}</span> ${got ? (bp.kind === 'vehicle' ? 'כלי רכב' : 'נשק') : ''}${best}`;
      item.appendChild(meta);
      if (got) {
        item.addEventListener('click', () => {
          this.hide();
          if (this.onPick) this.onPick(id);
        });
      }
      this.list.appendChild(item);
    }
    this.el.classList.remove('hidden');
    this.open = true;
  }

  hide() {
    this.el.classList.add('hidden');
    this.open = false;
  }
}

export { GRADE };
