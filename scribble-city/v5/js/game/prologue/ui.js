// (v5, ROADMAP 18) What the prologue puts over the picture: the black bars of a film scene, the
// subtitles (the voices are English; the words under them in the player's language - Hebrew, or
// English), the objective in the corner (English, the way the game's world speaks), the title card in
// the air over the jump, the phone ringing in the corner, Lily's drawing held up to the camera, the
// fade to black, and the sheet the first drawing is drawn on.

const CSS = `
#pl-root { position: fixed; inset: 0; pointer-events: none; z-index: 40; font-family: "Rubik", "Heebo", "Segoe UI", sans-serif; }
#pl-root .bar { position: absolute; left: 0; right: 0; height: 0; background: #08070c; transition: height 0.9s cubic-bezier(.4,0,.2,1); }
#pl-root .bar.top { top: 0; }
#pl-root .bar.bot { bottom: 0; }
#pl-root.film .bar { height: 11.5vh; }
#pl-subs { position: absolute; left: 50%; bottom: 13.5vh; transform: translateX(-50%); width: min(86vw, 980px); text-align: center; opacity: 0; transition: opacity 0.25s; }
#pl-subs.on { opacity: 1; }
#pl-subs .who { display: inline-block; font-weight: 800; letter-spacing: 0.04em; margin-inline-end: 0.45em; }
#pl-subs .txt { display: inline; color: #fff; font-size: clamp(16px, 2.3vw, 27px); font-weight: 600; line-height: 1.45; text-shadow: 0 2px 3px #000, 0 0 10px rgba(0,0,0,0.85); }
#pl-subs .who { font-size: clamp(14px, 2vw, 23px); text-shadow: 0 2px 3px #000; }
#pl-root:not(.film) #pl-subs { bottom: 18vh; }
#pl-obj { position: absolute; left: 50%; bottom: 7vh; transform: translateX(-50%) translateY(10px); opacity: 0; transition: opacity 0.6s, transform 0.6s; text-align: center; direction: ltr; }
#pl-obj.on { opacity: 1; transform: translateX(-50%) translateY(0); }
#pl-obj .t { color: #fff; font-size: clamp(17px, 2.2vw, 26px); font-weight: 700; letter-spacing: 0.02em; text-shadow: 0 2px 4px #000, 0 0 12px rgba(0,0,0,0.8); }
#pl-obj .t b { color: #ffd23f; font-weight: 800; }
#pl-obj .u { margin: 6px auto 0; height: 3px; width: 0; background: linear-gradient(90deg, transparent, #ffd23f, transparent); transition: width 0.9s 0.15s; }
#pl-obj.on .u { width: 100%; }
#pl-title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 15vh; opacity: 0; transition: opacity 0.5s; direction: ltr; }
#pl-title.on { opacity: 1; }
#pl-title .name { font-family: "Permanent Marker", "Rubik", sans-serif; font-size: clamp(46px, 10.5vw, 150px); color: #fff4e0; letter-spacing: 0.04em; line-height: 1; transform: rotate(-3deg) scale(1.25); transition: transform 1.1s cubic-bezier(.16,1,.3,1), letter-spacing 2.4s ease-out;
  text-shadow: 0 0 2px #1c1030, 4px 4px 0 #ff4f9a, 8px 8px 0 #2a1650, 0 0 40px rgba(255,120,80,0.65); -webkit-text-stroke: 2px #1c1030; }
#pl-title.on .name { transform: rotate(-3deg) scale(1); letter-spacing: 0.09em; }
#pl-title .by { margin-top: 2.4vh; font-size: clamp(12px, 1.6vw, 20px); font-weight: 600; letter-spacing: 0.55em; color: #fff; opacity: 0; transition: opacity 1.2s 0.7s, letter-spacing 2.6s 0.7s; text-shadow: 0 2px 6px #000; padding-left: 0.55em; }
#pl-title.on .by { opacity: 0.92; letter-spacing: 0.75em; }
#pl-title .by[dir=rtl] { padding-left: 0; padding-right: 0.55em; letter-spacing: 0.3em; font-size: clamp(14px, 2vw, 26px); }
#pl-title.on .by[dir=rtl] { letter-spacing: 0.42em; }
#pl-title .rule { width: 0; height: 2px; margin-top: 1.6vh; background: linear-gradient(90deg, transparent, #ffd23f, #ff4f9a, transparent); transition: width 1.4s 0.5s; }
#pl-title.on .rule { width: min(46vw, 560px); }
#pl-call { position: absolute; right: 3vw; bottom: 16vh; width: 230px; background: rgba(18,16,26,0.92); border: 2px solid #3d3557; border-radius: 22px; padding: 14px 16px; color: #fff; direction: ltr; transform: translateX(130%); transition: transform 0.45s cubic-bezier(.2,.9,.3,1.2); box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
#pl-call.on { transform: translateX(0); }
#pl-call .k { font-size: 12px; color: #9a92b8; letter-spacing: 0.12em; }
#pl-call .n { font-size: 22px; font-weight: 800; margin: 4px 0 10px; }
#pl-call .row { display: flex; gap: 12px; }
#pl-call .b { flex: 1; text-align: center; border-radius: 14px; padding: 7px 0; font-weight: 700; font-size: 13px; }
#pl-call .b.no { background: #c8283c; }
#pl-call .b.yes { background: #2bb673; }
#pl-call.live .b.yes { display: none; }
#pl-call.ring .ic { animation: plring 0.5s infinite; }
#pl-call .ic { display: inline-block; }
@keyframes plring { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } }
#pl-sketch { position: absolute; left: 50%; top: 44%; width: min(52vw, 70vh); transform: translate(-50%, -46%) rotate(-2.5deg) scale(0.92); opacity: 0; transition: opacity 0.45s, transform 0.6s cubic-bezier(.2,.9,.3,1); }
#pl-sketch.on { opacity: 1; transform: translate(-50%, -50%) rotate(-1.5deg) scale(1); }
#pl-sketch canvas { width: 100%; height: auto; display: block; border-radius: 6px; box-shadow: 0 16px 50px rgba(0,0,0,0.55); }
#pl-fade { position: absolute; inset: 0; background: #000; opacity: 0; transition: opacity 0.8s; }
#pl-fade.on { opacity: 1; }
#pl-skip { position: absolute; right: 2.4vw; top: 13vh; color: rgba(255,255,255,0.75); font-size: 13px; opacity: 0; transition: opacity 0.4s; text-shadow: 0 1px 3px #000; }
#pl-skip.on { opacity: 1; }
#pl-skip .ring { display: inline-block; width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.35); vertical-align: -2px; margin-inline-start: 6px; background: conic-gradient(#ffd23f var(--k, 0%), transparent 0); }
#pl-draw { position: absolute; inset: 0; pointer-events: auto; cursor: crosshair; display: none; touch-action: none; }
#pl-draw.on { display: block; }
#pl-draw.settle { display: block; pointer-events: none; cursor: default; }
#pl-vig { position: absolute; inset: 0; opacity: 0; transition: opacity 0.9s; background: radial-gradient(ellipse 82% 78% at 50% 50%, rgba(10,7,22,0) 50%, rgba(10,7,22,0.42) 80%, rgba(10,7,22,0.74) 100%); }
#pl-vig.on { opacity: 1; }
#pl-draw canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
#pl-hint { position: absolute; left: 50%; top: 15vh; transform: translateX(-50%) translateY(-8px); color: #fff; direction: ltr; text-align: center; font-size: clamp(18px, 2.6vw, 32px); font-weight: 800; text-shadow: 0 2px 6px #000, 0 0 18px rgba(0,0,0,0.8); opacity: 0; transition: opacity 0.4s, transform 0.4s; letter-spacing: 0.02em; }
#pl-hint.on { opacity: 1; transform: translateX(-50%) translateY(0); }
#pl-hint small { display: block; font-size: 0.55em; font-weight: 600; opacity: 0.85; margin-top: 6px; direction: rtl; }
/* (ROADMAP 18.9: the game showing the player round - a card: what to do, and how, its keys as keys) */
#pl-hint.card { background: linear-gradient(180deg, rgba(24,16,40,0.86), rgba(14,10,26,0.86)); border: 2px solid rgba(255,210,63,0.75); border-radius: 16px; padding: 14px 22px 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.45); text-shadow: none; font-size: clamp(17px, 2.2vw, 26px); min-width: min(78vw, 420px); }
#pl-hint.card .tag { display: block; font-size: 0.48em; font-weight: 800; letter-spacing: 0.18em; color: #ffd23f; margin-bottom: 4px; }
#pl-hint.card small { font-size: 0.62em; line-height: 1.7; opacity: 0.95; margin-top: 8px; }
#pl-hint.card.how { direction: rtl; text-align: right; min-width: min(86vw, 470px); max-width: min(92vw, 560px); padding: 14px 22px 16px; }
#pl-hint.card.how .tag { text-align: right; letter-spacing: 0.04em; font-size: 0.5em; }
#pl-hint.card.how .t { display: block; font-size: 1.12em; color: #fff; margin-bottom: 4px; }
#pl-hint.card.how .say { font-size: 0.66em; font-weight: 600; line-height: 1.5; color: #f2eadf; margin-bottom: 8px; }
#pl-hint.card.how ul { list-style: none; margin: 0; padding: 0; }
#pl-hint.card.how li { display: flex; align-items: center; gap: 10px; font-size: 0.62em; font-weight: 600; line-height: 1.35; margin: 5px 0; color: #fff; }
#pl-hint.card.how li .k { flex: 0 0 auto; min-width: 7.2em; text-align: center; direction: ltr; }
#pl-hint.card.how .tip { margin-top: 9px; font-size: 0.56em; font-weight: 600; color: #ffd23f; line-height: 1.45; }
#pl-hint.card.how .tip::before { content: "💡 "; }
/* (round 9) docked: small, at the side - on a computer the right, under nothing (the goals are away
   in the prologue); on a phone at the top, between the map and the buttons */
#pl-hint.card.how.dock { left: auto; right: 16px; top: 26vh; transform: none; min-width: 0; width: min(300px, 28vw); padding: 10px 14px 11px; font-size: 18px; animation: plDock 0.35s ease-out; }
#pl-hint.card.how.dock .say, #pl-hint.card.how.dock .tip { display: none; }
#pl-hint.card.how.dock .t { font-size: 1em; }
#pl-hint.card.how.dock li { font-size: 0.66em; margin: 3px 0; }
#pl-hint.card.how.dock li .k { min-width: 5.4em; }
@keyframes plDock { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
body.touch #pl-hint.card.how { font-size: 15px; top: 8vh; padding: 10px 16px; max-width: min(70vw, 460px); }
body.touch #pl-hint.card.how.dock { right: auto; left: 50%; top: 4px; transform: translateX(-50%); width: auto; max-width: 44vw; padding: 5px 10px 6px; font-size: 12px; animation: none; }
body.touch #pl-hint.card.how.dock .tag { display: none; }
body.touch #pl-hint.card.how.dock li { margin: 1px 0; }
#pl-hint kbd { display: inline-block; min-width: 1.6em; padding: 1px 7px; margin: 0 2px; border-radius: 6px; background: #fff4e0; color: #1a1426; font: 800 0.95em "Rubik", sans-serif; box-shadow: 0 3px 0 #b8a98e; direction: ltr; }
body.prologue #goals, body.prologue .goals, body.prologue #toasts.hide-pl, body.prologue #crosshair, body.prologue #weapon, body.prologue-film #prompt, body.prologue #subs, body.prologue #btn-swap, body.prologue-film #btn-draw, body.prologue #btn-photo, body.prologue #radio { display: none !important; }
body.prologue-film #hud { opacity: 0 !important; transition: opacity 0.6s; }
body.prologue-film #gear-bar, body.prologue-film #gear-rw, body.prologue-film #gear-sea, body.prologue-film #pp-slots, body.prologue-film #pp-tip { display: none !important; }
/* (and a phone's buttons: nothing to press while the film is shown) */
body.prologue-film #touch { visibility: hidden !important; }
/* (ROADMAP 18.9: while the prologue is told, the HUD only the map and the task - no money, no clock,
   no bars: one film, the player's part of it too) */
body.prologue #topbar, body.prologue #money, body.prologue #clock, body.prologue #district, body.prologue #ink, body.prologue #wanted { display: none !important; }
`;

// the speakers' names and colours over their words
export const WHO = {
  D: { he: 'דני', en: 'DANNY', col: '#ffb24a' },
  L: { he: 'לילי', en: 'LILY', col: '#d79bff' },
  P: { he: 'בני (בטלפון)', en: 'BENNY (PHONE)', col: '#8fd0ff' },
  T: { he: 'גבר', en: 'MAN', col: '#ff7a7a' },
  T2: { he: 'גבר שני', en: 'SECOND MAN', col: '#ff9a7a' },
  G: { he: 'בחור', en: 'GUY', col: '#9ef0b0' },
  M: { he: 'איש', en: 'MAN', col: '#c8e0a0' },
  KB: { he: 'ילד בגלגל', en: 'BOY ON THE WHEEL', col: '#ffe08a' },
  KG: { he: 'ילדה בגלגל', en: 'GIRL ON THE WHEEL', col: '#ffe08a' },
};

export class PrologueUI {
  constructor(lang = 'he') {
    this.lang = lang;
    if (!document.getElementById('pl-css')) {
      const st = document.createElement('style');
      st.id = 'pl-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const r = document.createElement('div');
    r.id = 'pl-root';
    r.innerHTML = `<div id="pl-vig"></div><div class="bar top"></div><div class="bar bot"></div>
      <div id="pl-subs"><span class="who"></span><span class="txt"></span></div>
      <div id="pl-obj"><div class="t"></div><div class="u"></div></div>
      <div id="pl-title"><div class="name"></div><div class="rule"></div><div class="by"></div></div>
      <div id="pl-call"><div class="k">INCOMING CALL <span class="ic">📞</span></div><div class="n"></div><div class="row"><div class="b no">✕</div><div class="b yes">✓</div></div></div>
      <div id="pl-sketch"></div>
      <div id="pl-hint"></div>
      <div id="pl-draw"><canvas></canvas></div>
      <div id="pl-skip"></div>
      <div id="pl-fade"></div>`;
    document.body.appendChild(r);
    this.root = r;
    this.subsEl = r.querySelector('#pl-subs');
    this.objEl = r.querySelector('#pl-obj');
    this.titleEl = r.querySelector('#pl-title');
    this.callEl = r.querySelector('#pl-call');
    this.sketchEl = r.querySelector('#pl-sketch');
    this.fadeEl = r.querySelector('#pl-fade');
    this.skipEl = r.querySelector('#pl-skip');
    this.hintEl = r.querySelector('#pl-hint');
    this.drawEl = r.querySelector('#pl-draw');
    this.vigEl = r.querySelector('#pl-vig');
    this.subT = 0;
  }

  // time all but stopped: the edges of the picture dark, the eye to its middle
  vignette(on) {
    this.vigEl.classList.toggle('on', !!on);
  }

  film(on) {
    this.root.classList.toggle('film', on);
    document.body.classList.toggle('prologue-film', on);
  }

  // a line said: the speaker's name in their colour, the words in the player's language
  sub(who, en, he, t) {
    const W = WHO[who] || { he: '', en: '', col: '#fff' };
    const w = this.subsEl.querySelector('.who');
    const x = this.subsEl.querySelector('.txt');
    const heb = this.lang === 'he';
    this.subsEl.style.direction = heb ? 'rtl' : 'ltr';
    w.textContent = `${heb ? W.he : W.en}:`;
    w.style.color = W.col;
    x.textContent = heb ? he : en;
    this.subsEl.classList.add('on');
    this.subT = t;
  }

  clearSub() {
    this.subsEl.classList.remove('on');
    this.subT = 0;
  }

  // the objective, as the game's world says it (English), the key word lit
  objective(text) {
    const el = this.objEl;
    if (!text) {
      el.classList.remove('on');
      return;
    }
    el.querySelector('.t').innerHTML = text;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  title(on, name = '', by = '') {
    if (on) {
      this.titleEl.querySelector('.name').textContent = name;
      const b = this.titleEl.querySelector('.by');
      b.textContent = by;
      // (a credit in Hebrew reads right to left)
      b.dir = /[\u0590-\u05FF]/.test(by) ? 'rtl' : 'ltr';
    }
    this.titleEl.classList.toggle('on', on);
  }

  call(state, name = '') {
    const el = this.callEl;
    if (name) el.querySelector('.n').textContent = name;
    el.classList.toggle('on', state !== 'off');
    el.classList.toggle('ring', state === 'ring');
    el.classList.toggle('live', state === 'live');
  }

  sketch(canvas) {
    const el = this.sketchEl;
    if (canvas) {
      el.innerHTML = '';
      el.appendChild(canvas);
      void el.offsetWidth;
      el.classList.add('on');
    } else el.classList.remove('on');
  }

  // to black, or back from it (secs: how long it takes; the usual 0.8 s if not said)
  fade(on, secs = 0) {
    this.fadeEl.style.transition = secs ? `opacity ${secs}s` : '';
    this.fadeEl.classList.toggle('on', on);
    this.blackOn = on;
  }

  // black at once, no fading to it: the film's first moments, while the game settles in behind it
  black() {
    const el = this.fadeEl;
    el.style.transition = 'none';
    el.classList.add('on');
    void el.offsetWidth;
    el.style.transition = '';
    this.blackOn = true;
  }

  skip(k) {
    if (k <= 0) {
      this.skipEl.classList.remove('on');
      return;
    }
    if (!this.skipEl.innerHTML) this.skipEl.innerHTML = 'החזיקו Enter לדילוג <span class="ring"></span>';
    this.skipEl.classList.add('on');
    this.skipEl.querySelector('.ring').style.setProperty('--k', `${Math.round(k * 100)}%`);
  }

  // (ROADMAP 18.9) a card of the game's own advice: what to do (in English, as the objectives),
  // and how (Hebrew, its keys as keys); null: away
  // (ROADMAP 18.9) a card of how to play: card(null) away; card(title, how) as it was; card({ step, of,
  // title, say, lines: [[keys, what], ...], tip }) - which step of how many, what to do in a friendly
  // word, how (each way its keys, as keys), and a tip
  card(title, how) {
    if (title && typeof title === 'object') {
      const o = title;
      const keys = (k) => String(k).split(' ').map((x) => (/^[A-Za-z0-9]{1,6}$|^(Shift|Space|Esc|Tab)$/.test(x) ? `<kbd>${x}</kbd>` : x)).join(' ');
      const tag = o.step ? `איך משחקים · שלב ${o.step} מתוך ${o.of}` : o.tag || 'מה עושים עכשיו';
      const lines = (o.lines || []).map(([k, w]) => `<li><span class="k">${keys(k)}</span><span>${w}</span></li>`).join('');
      this.hintEl.classList.add('card', 'how');
      this.hint(`<span class="tag">${tag}</span><b class="t">${o.title}</b>${o.say ? `<div class="say">${o.say}</div>` : ''}${lines ? `<ul>${lines}</ul>` : ''}${o.tip ? `<div class="tip">${o.tip}</div>` : ''}`);
      // (round 9, the player's word: it covered the screen - big for a moment, then off to the side;
      // round 15, the player's word again: big at all it was too much - at the side, small, from the
      // start, its keys there, the game playable round it)
      clearTimeout(this.dockT);
      this.dock(true);
      return;
    }
    clearTimeout(this.dockT);
    this.dock(false);
    this.hintEl.classList.remove('how');
    this.hintEl.classList.toggle('card', !!title);
    this.hint(title ? `<span class="tag">HOW TO PLAY</span>${title}<small>${how}</small>` : null);
  }

  // the card off to the side (or back in the middle)
  dock(on) {
    this.hintEl.classList.toggle('dock', !!on);
  }

  hint(html) {
    if (!html) {
      clearTimeout(this.dockT);
      this.hintEl.classList.remove('on');
    }
    else {
      this.hintEl.innerHTML = html;
      this.hintEl.classList.add('on');
    }
  }

  update(dt) {
    if (this.subT > 0) {
      this.subT -= dt;
      if (this.subT <= 0) this.clearSub();
    }
  }

  dispose() {
    this.root.remove();
    document.body.classList.remove('prologue', 'prologue-film');
  }
}

// Lily's drawing in her sketchbook: the wheel, its gondolas with the kids in them waving, the sun,
// the sea - in crayon and felt pen, the way a nine-year-old who draws a lot draws (ruled paper, her
// name in the corner)
// (ROADMAP 18.9) and drawn a little at a time: k of it (0 the page alone .. 1 all of it), into
// canvas (a new one if none) - the same strokes in the same order, so that a page drawn at k and
// then at more is the same page with more on it
// (round 15, the player's word: her drawing seen being made, its colours seen going on - not a
// drawing that is there all at once) Her page in two goes: first the shapes in pencil, while Danny is
// away (the wheel, its spokes and gondolas, the sun, the pier and the sea's line); then, when he is
// back, the colouring - big parts of it, each filled with a crayon's dense scribble that spreads over
// the white under her pencil of that colour: the sky in three bands (purple, pink, orange), the sun
// yellow, the sea in two blues, the gondolas each its own colour, the wheel's rim pink, and her name.
// k: how far (0..1); tip (if given): where her pencil is now (u across, v down), its colour, done
const LW = 1100;
const LH = 820;
const CHAR = '#3a3448';
let LSTEPS = null;
// a seeded random of its own for each stroke, so that it is drawn the same every time
const rndOf = (seed) => {
  let s = (seed * 7919 + 13) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s % 10000) / 10000;
  };
};
const plen = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};
// the first f of a line of points (and where it ends)
const partOf = (pts, f) => {
  if (f >= 1) return { pts, end: pts[pts.length - 1] };
  const L = plen(pts) * f;
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= L) {
      const u = d ? (L - acc) / d : 0;
      const e = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
      out.push(e);
      return { pts: out, end: e };
    }
    acc += d;
    out.push(pts[i]);
  }
  return { pts: out, end: pts[pts.length - 1] };
};
const stroke = (g, pts, col, w, alpha, rnd, passes = 2) => {
  if (pts.length < 2) return;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    g.strokeStyle = col;
    g.globalAlpha = p ? alpha * 0.55 : alpha;
    g.lineWidth = w * (p ? 0.7 : 1);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (rnd() - 0.5) * 3;
      const jy = y + (rnd() - 0.5) * 3;
      if (i) g.lineTo(jx, jy);
      else g.moveTo(jx, jy);
    });
    g.stroke();
  }
  g.globalAlpha = 1;
};
const ring = (cx, cy, r, n = 40) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
// a crayon's scribble over a part of the page: back and forth, a little slanted, row under row
const zig = (x0, x1, y0, y1, step, slant, rnd) => {
  const pts = [];
  let left = true;
  for (let y = y0; y <= y1 + 0.1; y += step) {
    const yy = Math.min(y1, y);
    if (left) pts.push([x0 + rnd() * 10, yy + rnd() * 4], [x1 - rnd() * 10, yy + slant + rnd() * 4]);
    else pts.push([x1 - rnd() * 10, yy + slant + rnd() * 4], [x0 + rnd() * 10, yy + rnd() * 4]);
    left = !left;
  }
  return pts;
};
function lilySteps() {
  if (LSTEPS) return LSTEPS;
  const S = [];
  const cx = 480;
  const cy = 360;
  const R = 220;
  // ---- the pencil: the shapes
  const line = (name, pts, w = 4.5) => {
    const seed = S.length + 1;
    S.push({ name, kind: 'line', col: CHAR, w: plen(pts) * 0.6, pts, draw: (g, f) => {
      const q = partOf(pts, f);
      stroke(g, q.pts, CHAR, w, 0.9, rndOf(seed), 1);
      return q.end;
    } });
  };
  line('rim', ring(cx, cy, R));
  line('rim2', ring(cx, cy, R - 18), 3.5);
  for (let q = 0; q < 12; q++) {
    const a = (q / 12) * Math.PI * 2;
    line('spoke', [[cx, cy], [cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16)]], 3);
  }
  line('leg', [[cx - 10, cy], [cx - 150, 600]], 5);
  line('leg', [[cx + 10, cy], [cx + 150, 600]], 5);
  line('hub', ring(cx, cy, 26, 18), 4);
  const GB = [];
  for (let q = 0; q < 12; q++) {
    const a = (q / 12) * Math.PI * 2 + 0.15;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R + 26;
    GB.push([x, y]);
    line('gondola', [[x, y - 16], [x, y - 28], [x, y - 16], [x - 28, y - 16], [x + 28, y - 16], [x + 28, y + 18], [x - 28, y + 18], [x - 28, y - 16]], 3.5);
  }
  line('sun', ring(860, 300, 70, 30), 4);
  line('pier', [[100, 600], [1080, 600]], 5);
  for (let x = 140; x < 1080; x += 70) line('post', [[x, 600], [x + 4, 690]], 3.5);
  const OUT = S.length;
  // ---- the colours: each part scribbled over with its crayon, the white going under it
  const fill = (name, col, clip, pts, w, alpha = 0.82) => {
    const seed = S.length + 101;
    S.push({ name, kind: 'fill', col, w: plen(pts), pts, draw: (g, f) => {
      const q = partOf(pts, f);
      g.save();
      clip(g);
      stroke(g, q.pts, col, w, alpha, rndOf(seed), 2);
      g.restore();
      return q.end;
    } });
  };
  const skyClip = (y0, y1) => (g) => {
    g.beginPath();
    g.rect(96, y0, 988, y1 - y0);
    g.clip();
    // (round the wheel and the sun, as a child colours round what is drawn)
    g.beginPath();
    g.rect(0, 0, LW, LH);
    g.moveTo(cx + R + 4, cy);
    g.arc(cx, cy, R + 4, 0, Math.PI * 2, true);
    g.moveTo(860 + 72, 300);
    g.arc(860, 300, 72, 0, Math.PI * 2, true);
    g.clip('evenodd');
  };
  const SKY = [['#9b7be0', 110, 268], ['#f45d9c', 268, 428], ['#ffb24a', 428, 596]];
  SKY.forEach(([col, y0, y1], i) => fill('sky', col, skyClip(y0, y1), zig(100, 1080, y0 + 4, y1 - 4, 15, 9, rndOf(200 + i)), 15));
  fill('sun', '#ffd23f', (g) => {
    g.beginPath();
    g.arc(860, 300, 68, 0, Math.PI * 2);
    g.clip();
  }, zig(790, 930, 232, 368, 11, 6, rndOf(300)), 13, 0.9);
  fill('sea', '#3fa7d6', (g) => {
    g.beginPath();
    g.rect(96, 604, 988, 90);
    g.clip();
  }, zig(100, 1080, 608, 690, 14, 8, rndOf(310)), 14);
  fill('sea', '#2a7fc0', (g) => {
    g.beginPath();
    g.rect(96, 694, 988, 100);
    g.clip();
  }, zig(100, 1080, 698, 790, 14, 8, rndOf(311)), 14);
  const GC = ['#ff5a7a', '#3fc6c0', '#ffc53a', '#9b6ae0', '#5cc45a', '#ff8a3a'];
  GB.forEach(([x, y], q) => fill('gondolas', GC[q % GC.length], (g) => {
    g.beginPath();
    g.rect(x - 27, y - 15, 54, 32);
    g.clip();
  }, zig(x - 30, x + 30, y - 14, y + 16, 7, 3, rndOf(400 + q)), 8, 0.9));
  // the wheel's rim gone over in pink, thick
  {
    const pts = ring(cx, cy, R - 9, 48);
    const seed = 500;
    S.push({ name: 'rim', kind: 'fill', col: '#e8457c', w: plen(pts) * 0.5, pts, draw: (g, f) => {
      const q = partOf(pts, f);
      stroke(g, q.pts, '#e8457c', 12, 0.85, rndOf(seed), 2);
      return q.end;
    } });
  }
  // her name, and the words over it - as her pencil goes along them
  const words = (name, text, font, col, x, y, wpx) => {
    S.push({ name, kind: 'name', col, w: wpx * 1.4, pts: [[x, y], [x + wpx, y]], draw: (g, f) => {
      g.save();
      g.beginPath();
      g.rect(x - 4, y - 70, wpx * f + 4, 100);
      g.clip();
      g.fillStyle = col;
      g.font = font;
      g.fillText(text, x, y);
      g.restore();
      return [x + wpx * f, y - 14];
    } });
  };
  words('name', 'Lily ♥', '700 46px "Caveat", "Permanent Marker", cursive', '#7a4ad0', 870, 770, 150);
  words('name', 'the big wheel!!', '600 30px "Caveat", cursive', '#c0406a', 130, 95, 190);
  let tot = 0;
  for (const st of S) tot += st.w;
  let acc = 0;
  for (const st of S) {
    st.k0 = acc / tot;
    acc += st.w;
    st.k1 = acc / tot;
  }
  S.OUT = S[OUT].k0;
  LSTEPS = S;
  return S;
}

// (round 15) where the parts of it begin and end on its k: the shapes (outline) and each colour
export function lilyParts() {
  const S = lilySteps();
  const at = (name) => {
    const q = S.filter((s) => s.name === name && s.kind !== 'line');
    return q.length ? [q[0].k0, q[q.length - 1].k1] : [1, 1];
  };
  return { outline: S.OUT, sky: at('sky'), sun: at('sun'), sea: at('sea'), gondolas: at('gondolas'), rim: at('rim'), name: at('name') };
}

const LCACHE = new WeakMap();
export function lilyDrawing(k = 1, canvas = null, tip = null) {
  const W = LW;
  const H = LH;
  const c = canvas || document.createElement('canvas');
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  const S = lilySteps();
  k = Math.max(0, Math.min(1, k));
  // (what is finished kept on a sheet of its own: only what is going on now drawn anew)
  let C = LCACHE.get(c);
  const n = S.filter((s) => s.k1 <= k + 1e-9).length;
  if (!C || C.n > n) {
    const done = document.createElement('canvas');
    done.width = W;
    done.height = H;
    const g = done.getContext('2d');
    // the page: cream, ruled lines, the spiral's holes at the top
    g.fillStyle = '#fbf6e8';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,130,200,0.22)';
    g.lineWidth = 2;
    for (let y = 120; y < H; y += 42) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(220,80,90,0.3)';
    g.beginPath();
    g.moveTo(90, 0);
    g.lineTo(90, H);
    g.stroke();
    for (let x = 40; x < W; x += 60) {
      g.fillStyle = '#d8d0bc';
      g.beginPath();
      g.arc(x, 22, 9, 0, Math.PI * 2);
      g.fill();
    }
    C = { done, n: 0 };
    LCACHE.set(c, C);
  }
  const gd = C.done.getContext('2d');
  // (the colours under the pencil's shapes: drawn over them, the pencil gone over again at the end -
  // as on paper, the crayon over the lines and the lines still seen through it)
  while (C.n < n) {
    S[C.n].draw(gd, 1);
    C.n++;
    if (C.n === S.length) for (const st of S) if (st.kind === 'line') st.draw(gd, 1);
  }
  const g = c.getContext('2d');
  g.globalAlpha = 1;
  g.drawImage(C.done, 0, 0);
  let end = null;
  let col = S[Math.min(S.length - 1, n)].col;
  if (n < S.length) {
    const st = S[n];
    const f = (k - st.k0) / Math.max(1e-9, st.k1 - st.k0);
    if (f > 0) end = st.draw(g, Math.min(1, f));
    else end = st.pts[0];
    col = st.col;
  }
  if (tip) {
    if (end) {
      tip.u = end[0] / W;
      tip.v = end[1] / H;
    }
    tip.col = col;
    tip.done = k >= 1;
  }
  return c;
}
