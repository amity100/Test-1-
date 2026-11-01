import * as THREE from 'three';
import { AU, EXPRESSIONS } from '../render/portrait.js';

// (v5, ROADMAP 14.1) The face lab: a test bench in the game for the portraits (render/portrait.js).
// Opened with ?facelab in the address: Bruno, the first of the city's people, stands on the street
// before the camera; a panel switches his expressions and how strong they are, works his face's
// muscles one by one, turns him to the front, three quarters and profile, brings the camera close or
// to where it is in play, turns the light round him - and shows him the old way, to compare.
// (window.__facelab: the same from a test script)

const NAMES = {
  neutral: 'ניטרלי', angry: 'כעס', shout: 'צעקה', fear: 'פחד', distress: 'מצוקה', joy: 'שמחה', laugh: 'צחוק', sad: 'עצב', surprise: 'הפתעה', disgust: 'גועל',
};
const VIEWS = { front: 0, quarter: 0.7, profile: 1.45 };
const VIEW_NAMES = { front: 'מלפנים', quarter: 'שלושה רבעים', profile: 'פרופיל' };
const DIST = { close: { dist: 0.9, height: 1.6, pitch: -0.02 }, game: { dist: 4.2, height: 1.45, pitch: -0.06 } };
// (the old way's nearest feeling, for comparing)
const OLD = { angry: 'angry', shout: 'angry', fear: 'scared', distress: 'hurt', joy: 'joy', laugh: 'joy', sad: 'sad', surprise: 'surprised', disgust: 'angry' };
// how the old way's eight moves go for each (render/people.js faceOf's feelings, with the jaw of a shout)
const OLD_EW = { shout: [0.82, 0, 0.35, 0, 1, 0.1, 0.1, 0.2], laugh: [0.55, 1, 0, 0.35, 0, 0.2, 0.2, 0] };

export class FaceLab {
  constructor(game) {
    this.game = game;
    this.on = !!(game.params && game.params.has('facelab'));
    this.c = null;
    this.expr = 'neutral';
    this.k = 1;
    this.au = {};
    this.view = 'front';
    this.dist = 'close';
    this.old = false;
    this.turn = 0;
    this.lookCam = true;
    this.at = null;
    // (?facelab=manual: not until asked - go() - so that a test can first take the camera elsewhere)
    this.auto = !(game.params && game.params.get('facelab') === 'manual');
    if (this.on) window.__facelab = this;
  }

  update() {
    if (!this.on) return;
    const g = this.game;
    if (!this.c) {
      if (this.auto && !this.starting && g.state === 'play' && g.player && g.civilians && !g.classic) this.start();
      return;
    }
    const c = this.c;
    if (!c.alive) return;
    // (he stays where he is, turned the way asked; the camera before him)
    c.pos.x = this.at.x;
    c.pos.z = this.at.z;
    c.yaw = this.turn + VIEWS[this.view];
    c.faceYaw = c.yaw;
    const f = c.fig;
    const D = DIST[this.dist];
    g.player.pos.x = this.at.x + 3.6;
    g.player.pos.z = this.at.z;
    g.camRig.shoulder = -3.6;
    g.camRig.over = { dist: D.dist, height: D.height };
    g.camRig.curDist = D.dist;
    g.camRig.yaw = Math.PI + this.turn;
    g.camRig.pitch = D.pitch;
    // (his eyes on you from the front; ahead of him turned away)
    f.lookAt = this.lookCam && this.view === 'front' ? g.camera.position : null;
    if (this.old) {
      f.__noPortrait = true;
      f.__portrait = null;
      const ew = OLD_EW[this.expr];
      f.__ew = ew ? ew.map((v) => v * this.k) : null;
      f.feel = OLD[this.expr] ? { mood: OLD[this.expr], until: g.time + 1 } : null;
    } else {
      f.__noPortrait = false;
      f.__ew = null;
      f.feel = null;
      f.__portrait = { expr: this.expr, k: this.k, au: this.au };
    }
  }

  start() {
    this.starting = true;
    const g = this.game;
    const p = g.player.pos;
    this.at = { x: p.x - 3.6, z: p.z };
    import('./looks.js').then((m) => {
      const c = g.civilians.spawnScripted(this.at.x, this.at.z, m.folkLook(0), null);
      c.noCollide = true;
      c.ctrl = () => null;
      c.yaw = 0;
      c.faceYaw = 0;
      c.brave = true;
      this.c = c;
      this.panel();
    });
  }

  // ---------------------------------------------------------------- the panel
  panel() {
    if (typeof document === 'undefined' || this.el) return;
    const el = (this.el = document.createElement('div'));
    el.dir = 'rtl';
    el.style.cssText = 'position:fixed;top:12px;left:12px;z-index:50;width:250px;max-height:calc(100vh - 24px);overflow:auto;background:rgba(250,246,236,0.94);border:2px solid #2a2018;border-radius:10px;padding:10px;font:13px system-ui,sans-serif;color:#2a2018;box-shadow:3px 4px 0 rgba(0,0,0,0.25)';
    const h = (t) => {
      const d = document.createElement('div');
      d.textContent = t;
      d.style.cssText = 'font-weight:700;margin:8px 0 4px';
      el.appendChild(d);
    };
    const btns = (list, cur, set) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
      const all = [];
      for (const [key, label] of list) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'padding:3px 7px;border:1.5px solid #2a2018;border-radius:6px;background:#fff;cursor:pointer;font:inherit';
        b.onclick = () => {
          set(key);
          for (const x of all) x.style.background = x === b ? '#f2d16b' : '#fff';
        };
        if (key === cur) b.style.background = '#f2d16b';
        all.push(b);
        row.appendChild(b);
      }
      el.appendChild(row);
    };
    const slider = (label, v, set) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0';
      const s = document.createElement('input');
      s.type = 'range';
      s.min = '0';
      s.max = '100';
      s.value = String(Math.round(v * 100));
      s.style.flex = '1';
      s.oninput = () => set(+s.value / 100);
      const t = document.createElement('span');
      t.textContent = label;
      t.style.cssText = 'width:76px;font-size:12px';
      row.appendChild(t);
      row.appendChild(s);
      el.appendChild(row);
      return s;
    };
    const title = document.createElement('div');
    title.textContent = 'מעבדת פנים – ברונו';
    title.style.cssText = 'font-weight:800;font-size:15px';
    el.appendChild(title);
    h('הבעה');
    btns(Object.keys(EXPRESSIONS).map((k) => [k, NAMES[k] || k]), this.expr, (k) => (this.expr = k));
    slider('עוצמה', this.k, (v) => (this.k = v));
    h('זווית');
    btns(Object.keys(VIEWS).map((k) => [k, VIEW_NAMES[k]]), this.view, (k) => (this.view = k));
    slider('סיבוב האור', 0.5, (v) => (this.turn = (v - 0.5) * Math.PI * 1.6));
    h('מרחק');
    btns([['close', 'תקריב'], ['game', 'מרחק משחק']], this.dist, (k) => (this.dist = k));
    h('השוואה');
    btns([['new', 'המערכת החדשה'], ['old', 'המערכת הישנה']], 'new', (k) => (this.old = k === 'old'));
    // the muscles one by one (under a fold, the panel short)
    const det = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'שרירי הפנים אחד-אחד';
    sum.style.cssText = 'font-weight:700;margin-top:8px;cursor:pointer';
    det.appendChild(sum);
    el.appendChild(det);
    const keep = el;
    this.el = det;
    for (const n of AU) slider(n, 0, (v) => (this.au[n] = v));
    this.el = keep;
    document.body.appendChild(el);
  }

  // (from a test script) begin here and now
  go() {
    if (!this.starting) this.start();
  }

  // (from a test script)
  set(expr, k = 1) {
    this.expr = expr;
    this.k = k;
  }
}

// (for three's sake: the camera's place is the game's own - nothing to make here)
void THREE;
