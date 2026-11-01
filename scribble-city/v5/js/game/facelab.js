import { AU, EXPRESSIONS } from '../render/portrait.js';

// (v5, ROADMAP 14.1) The face lab: a look at the portraits (render/portrait.js) up close.
//
// A visit, as the game starts: Sal, sixty-three, the first of the city's people drawn as a portrait,
// comes over to you, says hello, and waits. E by him: his face close up, the camera a portrait
// painter's, and beside it a panel - how his face is made, its layers one by one (the picture, the
// light, the pencil, the lines it makes, the pencil's directions in colour), his expressions and how
// strong, the angles, the light round him, close or at the distance of play, the old way to compare,
// and his face's thirty muscles one by one. E again, or the panel's button: back to the game.
// (?nosal: no visit; ?sal: a visit in a test too)
//
// ?facelab: the same as a test bench - he stands on the street before the camera from the start.
// (window.__facelab: the same from a test script)

const NAMES = {
  neutral: 'ניטרלי', angry: 'כעס', shout: 'צעקה', fear: 'פחד', distress: 'מצוקה', joy: 'שמחה', laugh: 'צחוק', sad: 'עצב', surprise: 'הפתעה', disgust: 'גועל',
};
// (the one drawn as a portrait for now: render/people.js PORTRAIT_KINDS)
export const SUBJECT = 2;
const VIEWS = { front: 0, quarter: 0.7, profile: 1.45 };
const VIEW_NAMES = { front: 'מלפנים', quarter: 'שלושה רבעים', profile: 'פרופיל' };
// (close: a portrait's lens - long, the face filling the picture as a portrait painter sees it from a
// metre away; game: the game's own camera at the distance it is in play)
const DIST = { close: { dist: 1.05, height: 1.6, pitch: -0.01, fov: 21 }, game: { dist: 4.2, height: 1.45, pitch: -0.06, fov: null } };
// (the old way's nearest feeling, for comparing)
const OLD = { angry: 'angry', shout: 'angry', fear: 'scared', distress: 'hurt', joy: 'joy', laugh: 'joy', sad: 'sad', surprise: 'surprised', disgust: 'angry' };
// how the old way's eight moves go for each (render/people.js faceOf's feelings, with the jaw of a shout)
const OLD_EW = { shout: [0.82, 0, 0.35, 0, 1, 0.1, 0.1, 0.2], laugh: [0.55, 1, 0, 0.35, 0, 0.2, 0.2, 0] };
// (the show, one expression after another)
const DEMO = ['neutral', 'joy', 'surprise', 'angry', 'fear', 'shout', 'sad', 'disgust', 'laugh', 'distress'];
const HOW = [
  ['ראש אנטומי', 'הראש של סאל עצמו, עם שיניים, לשון ועיניים שמסתובבות בתוך הארובות.'],
  ['30 שרירים', 'כל הבעה היא תערובת של שרירי פנים, כמו בסרטים ובמשחקים הגדולים. כל שריר זז בקצב שלו, וצד אחד קצת יותר מהשני.'],
  ['עיפרון לפי הצורה', 'משיכות דקות לאורך המישורים של הפנים: לרוחב המצח, סביב העיניים, לאורך האף, על עצמות הלחיים. הן מופיעות רק איפה שהאור נחלש.'],
  ['קמטים', 'מופיעים עם ההבעה: במצח, בין הגבות, ליד העיניים ומהאף לפה.'],
  ['בכרטיס הגרפי', '30 מספרים בכל פריים מזיזים את כל הפנים, בלי לבנות שום דבר מחדש.'],
];

export class FaceLab {
  constructor(game) {
    this.game = game;
    const P = game.params;
    this.on = !!(P && P.has('facelab'));
    this.visit = !this.on && !!P && (P.has('sal') || !(P.has('test') || P.has('nosal')));
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
    this.viewing = false;
    this.layers = { light: 1, pencil: 1, wrinkles: 1, field: 0 };
    this.demo = false;
    this.demoT = 0;
    this.t = 0;
    // (?facelab=manual: not until asked - go() - so that a test can first take the camera elsewhere)
    this.auto = !(P && P.get('facelab') === 'manual');
    if (this.on || this.visit) window.__facelab = this;
  }

  update(dt = 1 / 60) {
    const g = this.game;
    if (this.on) {
      if (!this.c) {
        if (this.auto && !this.starting && g.state === 'play' && g.player && g.civilians && !g.classic) this.start();
        return;
      }
      if (this.c.alive) this.frame(dt);
      return;
    }
    if (!this.visit || g.state !== 'play' || !g.player || !g.civilians || g.classic) return;
    this.t += dt;
    if (!this.c) {
      if (!this.starting && this.t > 1.5) this.comeOver();
      return;
    }
    const c = this.c;
    if (!c.alive || c.gone) {
      this.done();
      return;
    }
    if (this.viewing) {
      this.frame(dt);
      return;
    }
    if (!this.seen) this.keepComing(c, dt);
    // (looked at, or never: after a while he goes on his way into the city)
    if (this.t > (this.seen ? this.seenAt + 30 : 150)) this.done();
  }

  // ---------------------------------------------------------------- the visit
  // he comes from up the street ahead of you, a dozen metres off, and walks over to you
  comeOver() {
    this.starting = true;
    const g = this.game;
    const p = g.player.pos;
    const yaw = g.camRig.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const x = p.x + fx * 11 + fz * 1.2;
    const z = p.z + fz * 11 - fx * 1.2;
    import('./looks.js').then((m) => {
      const c = g.civilians.spawnScripted(x, z, m.folkLook(SUBJECT), null);
      c.brave = true;
      this.walkFn = (me, dt) => this.walk(me, dt);
      c.ctrl = this.walkFn;
      this.c = c;
      this.bestD = Infinity;
      this.stuckT = 0;
      this.said = false;
      if (g.hud) g.hud.toast('סאל, הדמות עם הפנים החדשות, בא אליכם. כשהוא לידכם: E כדי לראות מקרוב איך הפנים שלו נוצרו', 'info', 6);
    });
  }

  // (nothing in the city holds him up on his way to you - a noise to turn to, something to take in,
  // a fright: his walk his own; and held up all the same - a wall, a corner, a car - he is brought
  // round to you)
  keepComing(c, dt) {
    const g = this.game;
    c.noticeT = 0;
    c.cowerT = 0;
    c.coverT = 0;
    c.callT = 0;
    c.confrontT = 0;
    c.avoidT = 0;
    c.panicT = 0;
    if (c.ctrl !== this.walkFn) c.ctrl = this.walkFn;
    const p = g.player.pos;
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d < this.bestD - 0.05) {
      this.bestD = d;
      this.stuckT = 0;
    } else if (d > 2.4) this.stuckT += dt;
    if (this.stuckT > 4) {
      const yaw = g.camRig.yaw;
      c.pos.x = p.x + Math.sin(yaw) * 2.4;
      c.pos.z = p.z + Math.cos(yaw) * 2.4;
      this.stuckT = 0;
      this.bestD = Infinity;
    }
  }

  // (his walk: to before you and a little to the side, where the camera sees him whole - not behind
  // you; the place kept once he is there, until you move off; then he stands and looks at you)
  walk(me, dt) {
    const g = this.game;
    if (this.viewing) return null;
    const p = g.player.pos;
    const dx = me.pos.x - p.x;
    const dz = me.pos.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    if (!this.spot || Math.hypot(this.spot.px - p.x, this.spot.pz - p.z) > 2.5) {
      const yaw = g.camRig.yaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      this.spot = { x: p.x + fx * 1.9 - fz * 1.1, z: p.z + fz * 1.9 + fx * 1.1, px: p.x, pz: p.z };
    }
    const tx = this.spot.x;
    const tz = this.spot.z;
    void dt;
    me.fig.lookAt = d < 10 ? g.camera.position : null;
    if (Math.hypot(tx - me.pos.x, tz - me.pos.z) < 0.3) {
      me.faceYaw = Math.atan2(p.x - me.pos.x, p.z - me.pos.z);
      if (!this.said) {
        this.said = true;
        if (g.voices) g.voices.sayToYou(me, "[joy] Hi there! I'm Sal. They drew my face a whole new way - come, take a close look.");
      }
      return null;
    }
    me.faceYaw = null;
    return { x: tx, z: tz, speed: d > 6 ? 1.4 : 1.0 };
  }

  // (game/game.js: what E does here, and what it says)
  target() {
    if (!this.visit || this.viewing || !this.c || !this.c.alive) return null;
    const p = this.game.player;
    if (p.mode !== 'foot') return null;
    const d = Math.hypot(this.c.pos.x - p.pos.x, this.c.pos.z - p.pos.z);
    return d < 3.2 ? { label: 'E — להסתכל מקרוב על סאל: איך הפנים שלו נוצרו' } : null;
  }

  interact() {
    if (this.viewing) {
      this.leave();
      return true;
    }
    if (!this.target()) return false;
    this.enter();
    return true;
  }

  // his face close up, the panel beside it
  enter() {
    const g = this.game;
    const r = g.camRig;
    this.saved = { shoulder: r.shoulder, yaw: r.yaw, pitch: r.pitch, fov: r.baseFov };
    this.at = { x: this.c.pos.x, z: this.c.pos.z };
    // (turned to face you as he was: the camera before him)
    this.turn = this.c.yaw;
    this.viewing = true;
    this.seen = true;
    this.expr = 'neutral';
    this.k = 1;
    if (g.input && g.input.releaseLock) g.input.releaseLock();
    // (you out of the picture while you look: from further off you would stand in it; and the sight
    // off his face)
    if (g.player.fig && g.player.fig.setVisible) g.player.fig.setVisible(false);
    this.sight(false);
    this.panel();
  }

  leave() {
    const g = this.game;
    const r = g.camRig;
    this.viewing = false;
    this.seenAt = this.t;
    this.demo = false;
    r.focus = null;
    r.over = null;
    if (this.saved) {
      r.shoulder = this.saved.shoulder;
      r.yaw = this.saved.yaw;
      r.pitch = this.saved.pitch;
      r.baseFov = this.saved.fov;
    }
    const f = this.c && this.c.fig;
    if (f) {
      f.__portrait = null;
      f.__noPortrait = false;
      f.__ew = null;
      f.feel = null;
      f.lookAt = g.camera.position;
    }
    this.layersTo(1, 1, 1, 0);
    if (g.player.mode === 'foot' && g.player.fig && g.player.fig.setVisible) g.player.fig.setVisible(true);
    this.sight(true);
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  // he goes on into the city
  done() {
    if (this.viewing) this.leave();
    if (this.c && this.c.alive && this.game.civilians.release) this.game.civilians.release(this.c);
    this.c = null;
    this.visit = false;
  }

  // ---------------------------------------------------------------- the face before the camera
  frame(dt) {
    const g = this.game;
    const c = this.c;
    // (he stays where he is, turned the way asked; the camera before him)
    c.pos.x = this.at.x;
    c.pos.z = this.at.z;
    c.yaw = this.turn + VIEWS[this.view];
    c.faceYaw = c.yaw;
    const f = c.fig;
    const D = DIST[this.dist];
    const r = g.camRig;
    r.focus = { x: this.at.x, y: c.pos.y, z: this.at.z };
    r.shoulder = 0;
    r.over = { dist: D.dist, height: D.height };
    r.curDist = D.dist;
    r.yaw = Math.PI + this.turn;
    r.pitch = D.pitch;
    if (this.fov0 === undefined) this.fov0 = this.saved ? this.saved.fov : r.baseFov;
    r.baseFov = D.fov || this.fov0;
    // (the show: one expression after another)
    if (this.demo) {
      this.demoT += dt;
      if (this.demoT > 1.7) {
        this.demoT = 0;
        this.expr = DEMO[(DEMO.indexOf(this.expr) + 1) % DEMO.length];
        this.mark();
      }
    }
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
    const L = this.layers;
    this.layersTo(L.light, L.pencil, L.wrinkles, L.field);
  }

  // (the gun's sight over the picture, ui/hud.js: its display is the HUD's every frame - its
  // visibility ours)
  sight(on) {
    const el = typeof document !== 'undefined' && document.getElementById('crosshair');
    if (el) el.style.visibility = on ? '' : 'hidden';
  }

  // the portrait's layers (render/glsl.js PORTRAIT uPLayers)
  layersTo(a, b, c, d) {
    const bodies = this.game.figures && this.game.figures.bodies;
    const P = bodies && bodies.portraits && bodies.portraits.get(SUBJECT);
    if (P && P.mat && P.mat.uniforms.uPLayers) P.mat.uniforms.uPLayers.value.set(a, b, c, d);
  }

  // ---------------------------------------------------------------- the test bench (?facelab)
  start() {
    this.starting = true;
    const g = this.game;
    const p = g.player.pos;
    this.at = { x: p.x - 3.6, z: p.z };
    import('./looks.js').then((m) => {
      const c = g.civilians.spawnScripted(this.at.x, this.at.z, m.folkLook(SUBJECT), null);
      c.noCollide = true;
      c.ctrl = () => null;
      c.yaw = 0;
      c.faceYaw = 0;
      c.brave = true;
      this.c = c;
      this.viewing = true;
      this.panel();
    });
  }

  // ---------------------------------------------------------------- the panel
  panel() {
    if (typeof document === 'undefined' || this.el) return;
    const el = (this.el = document.createElement('div'));
    el.dir = 'rtl';
    el.style.cssText = 'position:fixed;top:12px;left:12px;z-index:50;width:262px;max-height:calc(100vh - 24px);overflow:auto;background:rgba(250,246,236,0.95);border:2px solid #2a2018;border-radius:10px;padding:10px;font:13px system-ui,sans-serif;color:#2a2018;box-shadow:3px 4px 0 rgba(0,0,0,0.25)';
    let host = el;
    const h = (t) => {
      const d = document.createElement('div');
      d.textContent = t;
      d.style.cssText = 'font-weight:700;margin:8px 0 4px';
      host.appendChild(d);
    };
    const btn = (label, on, onclick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `padding:3px 7px;border:1.5px solid #2a2018;border-radius:6px;background:${on ? '#f2d16b' : '#fff'};cursor:pointer;font:inherit`;
      b.onclick = onclick;
      return b;
    };
    const row = () => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
      host.appendChild(r);
      return r;
    };
    // a row of choices, one of them chosen
    const btns = (list, cur, set) => {
      const r = row();
      const all = [];
      for (const [key, label] of list) {
        const b = btn(label, key === cur, () => {
          set(key);
          for (const x of all) x.style.background = x === b ? '#f2d16b' : '#fff';
        });
        all.push(b);
        r.appendChild(b);
      }
      return all;
    };
    const slider = (label, v, set) => {
      const r = document.createElement('label');
      r.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0';
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
      r.appendChild(t);
      r.appendChild(s);
      host.appendChild(r);
      return s;
    };
    const title = document.createElement('div');
    title.textContent = 'סאל: איך הפנים שלו נוצרו';
    title.style.cssText = 'font-weight:800;font-size:15px';
    el.appendChild(title);
    if (this.visit) {
      const back = btn('חזרה למשחק (E)', false, () => this.leave());
      back.style.cssText += ';margin-top:6px;width:100%';
      el.appendChild(back);
    }
    // how it is made (open at first)
    const how = document.createElement('details');
    how.open = true;
    const hs = document.createElement('summary');
    hs.textContent = 'איך זה בנוי';
    hs.style.cssText = 'font-weight:700;margin-top:8px;cursor:pointer';
    how.appendChild(hs);
    for (const [a, b] of HOW) {
      const p = document.createElement('div');
      p.style.cssText = 'margin:4px 0;font-size:12px;line-height:1.35';
      const s = document.createElement('b');
      s.textContent = `${a}: `;
      p.appendChild(s);
      p.appendChild(document.createTextNode(b));
      how.appendChild(p);
    }
    el.appendChild(how);
    // the layers, each on and off: the drawing built up before your eyes
    h('השכבות (לחיצה מדליקה ומכבה)');
    {
      const r = row();
      for (const [key, label] of [['light', 'אור וצל'], ['pencil', 'עיפרון'], ['wrinkles', 'קמטים'], ['field', 'כיווני העיפרון']]) {
        const b = btn(label, !!this.layers[key], () => {
          this.layers[key] = this.layers[key] ? 0 : 1;
          b.style.background = this.layers[key] ? '#f2d16b' : '#fff';
        });
        r.appendChild(b);
      }
    }
    h('הבעה');
    this.exprBtns = btns(Object.keys(EXPRESSIONS).map((k) => [k, NAMES[k] || k]), this.expr, (k) => {
      this.expr = k;
      this.demo = false;
      if (this.demoBtn) this.demoBtn.style.background = '#fff';
    });
    slider('עוצמה', this.k, (v) => (this.k = v));
    {
      const r = row();
      this.demoBtn = btn('הצגה: הבעה אחרי הבעה', this.demo, () => {
        this.demo = !this.demo;
        this.demoT = 0;
        this.demoBtn.style.background = this.demo ? '#f2d16b' : '#fff';
      });
      r.appendChild(this.demoBtn);
    }
    h('זווית');
    btns(Object.keys(VIEWS).map((k) => [k, VIEW_NAMES[k]]), this.view, (k) => (this.view = k));
    const t0 = this.turn;
    slider('סיבוב האור', 0.5, (v) => (this.turn = t0 + (v - 0.5) * Math.PI * 1.6));
    h('מרחק');
    btns([['close', 'תקריב'], ['game', 'מרחק משחק']], this.dist, (k) => (this.dist = k));
    h('השוואה');
    btns([['new', 'המערכת החדשה'], ['old', 'המערכת הישנה']], 'new', (k) => (this.old = k === 'old'));
    // the muscles one by one (under a fold, the panel short)
    const det = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'שרירי הפנים אחד־אחד';
    sum.style.cssText = 'font-weight:700;margin-top:8px;cursor:pointer';
    det.appendChild(sum);
    el.appendChild(det);
    host = det;
    for (const n of AU) slider(n, 0, (v) => (this.au[n] = v));
    host = el;
    document.body.appendChild(el);
  }

  // (the chosen expression's button lit, as the show goes on)
  mark() {
    if (!this.exprBtns) return;
    const keys = Object.keys(EXPRESSIONS);
    this.exprBtns.forEach((b, i) => (b.style.background = keys[i] === this.expr ? '#f2d16b' : '#fff'));
  }

  // (from a test script) begin here and now
  go() {
    if (this.on && !this.starting) this.start();
    else if (this.visit && !this.starting) {
      this.t = 2;
      this.comeOver();
    }
  }

  // (from a test script)
  set(expr, k = 1) {
    this.expr = expr;
    this.k = k;
  }
}
