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
#pl-hint kbd { display: inline-block; min-width: 1.6em; padding: 1px 7px; margin: 0 2px; border-radius: 6px; background: #fff4e0; color: #1a1426; font: 800 0.95em "Rubik", sans-serif; box-shadow: 0 3px 0 #b8a98e; direction: ltr; }
body.prologue #goals, body.prologue .goals, body.prologue #toasts.hide-pl, body.prologue #crosshair, body.prologue #weapon, body.prologue #prompt, body.prologue #subs, body.prologue #btn-swap, body.prologue #btn-draw, body.prologue #btn-photo, body.prologue #radio { display: none !important; }
body.prologue-film #hud { opacity: 0 !important; transition: opacity 0.6s; }
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
  card(title, how) {
    this.hintEl.classList.toggle('card', !!title);
    this.hint(title ? `<span class="tag">HOW TO PLAY</span>${title}<small>${how}</small>` : null);
  }

  hint(html) {
    if (!html) this.hintEl.classList.remove('on');
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
export function lilyDrawing(k = 1, canvas = null) {
  const W = 1100;
  const H = 820;
  const c = canvas || document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  let seed = 5;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed % 10000) / 10000;
  };
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
  // (each stroke of hers a step; only the first k of them drawn)
  const steps = [];
  const crayonNow = (pts, col, w = 7, passes = 3) => {
    for (let p = 0; p < passes; p++) {
      g.strokeStyle = col;
      g.globalAlpha = p ? 0.45 : 0.85;
      g.lineWidth = w * (p ? 0.7 : 1);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = x + (rnd() - 0.5) * 3.5;
        const jy = y + (rnd() - 0.5) * 3.5;
        if (i) g.lineTo(jx, jy);
        else g.moveTo(jx, jy);
      });
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  // a crayon stroke: wobbly, waxy, a few passes
  const crayon = (pts, col, w = 7, passes = 3) => steps.push(() => crayonNow(pts, col, w, passes));
  const scribbleFill = (cx, cy, r, col, w = 5) =>
    steps.push(() => {
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      g.strokeStyle = col;
      g.globalAlpha = 0.6;
      g.lineWidth = w;
      for (let i = -r * 2; i < r * 2; i += w * 1.3) {
        g.beginPath();
        g.moveTo(cx - r, cy + i);
        g.lineTo(cx + r, cy + i - r);
        g.stroke();
      }
      g.restore();
      g.globalAlpha = 1;
    });
  // the wheel first (what she looks at), then its gondolas and who is in them, then the sky, the
  // sea and the pier round it, and last her name
  const cx = 480;
  const cy = 360;
  const R = 220;
  crayon(Array.from({ length: 41 }, (_, i) => [cx + Math.cos((i / 40) * Math.PI * 2) * R, cy + Math.sin((i / 40) * Math.PI * 2) * R]), '#e8457c', 9);
  crayon(Array.from({ length: 41 }, (_, i) => [cx + Math.cos((i / 40) * Math.PI * 2) * (R - 18), cy + Math.sin((i / 40) * Math.PI * 2) * (R - 18)]), '#7a6ad8', 5, 2);
  for (let q = 0; q < 12; q++) {
    const a = (q / 12) * Math.PI * 2;
    crayon([[cx, cy], [cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16)]], '#5c6ad0', 4, 2);
  }
  crayon([[cx - 10, cy], [cx - 150, 600]], '#6a6a7a', 10);
  crayon([[cx + 10, cy], [cx + 150, 600]], '#6a6a7a', 10);
  scribbleFill(cx, cy, 26, '#ffd23f', 6);
  // the gondolas, each with somebody waving in it
  const GC = ['#ff5a7a', '#3fc6c0', '#ffc53a', '#9b6ae0', '#5cc45a', '#ff8a3a'];
  for (let q = 0; q < 12; q++) {
    const a = (q / 12) * Math.PI * 2 + 0.15;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R + 26;
    const col = GC[q % GC.length];
    steps.push(() => {
      g.fillStyle = col;
      g.globalAlpha = 0.8;
      g.fillRect(x - 26, y - 14, 52, 32);
      g.globalAlpha = 1;
      crayonNow([[x - 28, y - 16], [x + 28, y - 16], [x + 28, y + 18], [x - 28, y + 18], [x - 28, y - 16]], '#2a2440', 3.5, 1);
      crayonNow([[x, y - 16], [x, y - 28]], '#2a2440', 3, 1);
      // a little head, an arm up
      g.fillStyle = '#f2c79a';
      g.beginPath();
      g.arc(x - 6, y - 4, 8, 0, Math.PI * 2);
      g.fill();
      crayonNow([[x - 6, y - 4], [x + 8, y - 18]], '#f2c79a', 3.5, 1);
      if (q % 3 === 0) {
        g.beginPath();
        g.arc(x + 12, y - 2, 6, 0, Math.PI * 2);
        g.fill();
      }
    });
  }
  // the sky: orange and pink bands, the sun going down
  for (let i = 0; i < 6; i++) {
    const y = 140 + i * 38;
    crayon([[110, y], [400, y + 6], [700, y - 4], [1060, y + 3]], ['#ffb24a', '#ff8a5c', '#ff6f91', '#f45d9c', '#c86fd6', '#9b7be0'][i], 26, 2);
  }
  scribbleFill(860, 300, 70, '#ffd23f', 8);
  crayon(Array.from({ length: 26 }, (_, i) => [860 + Math.cos((i / 25) * Math.PI * 2) * 70, 300 + Math.sin((i / 25) * Math.PI * 2) * 70]), '#f4a21c', 6);
  // the sea
  for (let i = 0; i < 5; i++) {
    const y = 600 + i * 34;
    crayon([[100, y], [300, y + 8], [500, y - 6], [760, y + 6], [1080, y]], i % 2 ? '#3fa7d6' : '#2a7fc0', 18, 2);
  }
  // the pier
  crayon([[100, 600], [1080, 600]], '#8a5a3c', 14);
  for (let x = 140; x < 1080; x += 70) crayon([[x, 600], [x + 4, 690]], '#7a4a2c', 7);
  // her name, and a heart
  steps.push(() => {
    g.fillStyle = '#7a4ad0';
    g.font = '700 46px "Caveat", "Permanent Marker", cursive';
    g.fillText('Lily ♥', 870, 770);
    g.font = '600 30px "Caveat", cursive';
    g.fillStyle = '#c0406a';
    g.fillText('the big wheel!!', 130, 95);
  });
  const n = Math.round(Math.max(0, Math.min(1, k)) * steps.length);
  for (let i = 0; i < n; i++) steps[i]();
  return c;
}
