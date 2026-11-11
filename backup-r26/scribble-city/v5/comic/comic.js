// The prologue's story told as a comic that moves (prototype): pages of panels rendered from the game
// itself, each panel opening up from its place on the page to the whole frame - slowly drifting -
// with its balloons popping in as the lines are said (the voices of game/prologue/voice.js), its
// sound words, and the page closing again before the next. Timed from the lines' own lengths.
//   comic/index.html            press play; ?rec=1 plays at once, silent (for recording a video:
//                               window.__timeline lists when each sound is heard)
import { LINES } from '../js/game/prologue/lines.js';

const W = 1600;
const H = 900;
const WHO = { L: 'לילי', D: 'דני', K: 'ילדים בגלגל' };
const rec = new URLSearchParams(location.search).has('rec');
const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const focus = $('#focus');
const pic = focus.querySelector('.pic');
const layer = focus.querySelector('.layer');

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(${-W * s * 0.5}px, ${-H * s * 0.5}px) scale(${s})`;
}
addEventListener('resize', fit);
fit();

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const bbox = (q) => {
  const xs = [q[0], q[2], q[4], q[6]];
  const ys = [q[1], q[3], q[5], q[7]];
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

// ------------------------------------------------------------------ the pages
function buildPage(p, pi) {
  const el = document.createElement('div');
  el.className = 'page';
  el.style.opacity = pi === 0 ? '1' : '0';
  el.innerHTML = '<div class="sheet"></div>';
  p.cells = p.panels.map((pn, i) => {
    const q = p.layout[i];
    const b = bbox(q);
    const c = document.createElement('div');
    c.className = 'cell';
    Object.assign(c.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    const poly = [0, 2, 4, 6].map((k) => `${q[k] - b.x}px ${q[k + 1] - b.y}px`).join(',');
    c.style.clipPath = `polygon(${poly})`;
    c.innerHTML = `<img src="panels/${pn.img}.jpg"><svg class="edge" viewBox="0 0 ${b.w} ${b.h}"><polygon points="${[0, 2, 4, 6].map((k) => `${q[k] - b.x},${q[k + 1] - b.y}`).join(' ')}" fill="none" stroke="#160c22" stroke-width="14"/></svg>`;
    el.appendChild(c);
    pn.cell = c;
    pn.box = b;
    return c;
  });
  $('#pages').appendChild(el);
  p.el = el;
}

// a balloon: an oval with its tail to whoever says it (box and tail in % of the frame)
function balloon(s) {
  const [x0, y0, x1, y1] = s.box.map((v, i) => (i % 2 ? (v * H) / 100 : (v * W) / 100));
  const w = x1 - x0;
  const h = y1 - y0;
  const tx = (s.tail[0] * W) / 100 - x0;
  const ty = (s.tail[1] * H) / 100 - y0;
  const el = document.createElement('div');
  el.className = 'bal' + (s.shaky ? ' shaky' : '');
  Object.assign(el.style, { left: `${x0}px`, top: `${y0}px`, width: `${w}px`, height: `${h}px` });
  el.style.setProperty('--ox', `${tx}px`);
  el.style.setProperty('--oy', `${ty}px`);
  // the tail: from two points on the oval's rim near the side facing the speaker
  const cx = w / 2;
  const cy = h / 2;
  const a = Math.atan2(ty - cy, tx - cx);
  const rim = (da) => [cx + Math.cos(a + da) * w * 0.38, cy + Math.sin(a + da) * h * 0.36];
  const [ax, ay] = rim(0.22);
  const [bx, by] = rim(-0.22);
  const len = Math.hypot(tx - cx, ty - cy);
  const k = Math.min(1, (Math.max(w, h) * 0.75) / len);
  const px = cx + (tx - cx) * k;
  const py = cy + (ty - cy) * k;
  const wob = s.shaky ? ' stroke-dasharray="1 0"' : '';
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <path d="M${ax},${ay} Q${(ax + px) / 2 + 6},${(ay + py) / 2} ${px},${py} Q${(bx + px) / 2 - 6},${(by + py) / 2} ${bx},${by} Z" fill="#fff" stroke="#160c22" stroke-width="5" stroke-linejoin="round"${wob}/>
    <ellipse cx="${cx}" cy="${cy}" rx="${w / 2 - 4}" ry="${h / 2 - 4}" fill="#fff" stroke="#160c22" stroke-width="5"/>
    <path d="M${ax},${ay} Q${(ax + px) / 2 + 6},${(ay + py) / 2} ${px},${py} Q${(bx + px) / 2 - 6},${(by + py) / 2} ${bx},${by}" fill="#fff" stroke="none"/>
  </svg><div class="txt"></div>`;
  const L = LINES[s.id];
  const text = L ? L.he : '';
  const t = el.querySelector('.txt');
  t.textContent = text;
  const fs = Math.max(26, Math.min(50, Math.sqrt((w * 0.74 * h * 0.58) / (text.length * 0.6))));
  t.style.fontSize = `${fs}px`;
  if (s.who && WHO[s.who]) {
    const tag = document.createElement('div');
    tag.className = 'who';
    tag.textContent = WHO[s.who];
    tag.style.fontSize = `${Math.max(28, fs * 0.9)}px`;
    el.appendChild(tag);
  }
  layer.appendChild(el);
  return el;
}

function sfx(f) {
  const el = document.createElement('div');
  el.className = 'sfx' + (f.faint ? ' faint' : '');
  el.textContent = f.t;
  Object.assign(el.style, { left: `${f.x}%`, top: `${f.y}%`, fontSize: `${f.size * 9}px` });
  el.style.setProperty('--r', `${f.rot || 0}deg`);
  el.style.setProperty('--c', f.col || '#fff');
  layer.appendChild(el);
  return el;
}

// ------------------------------------------------------------------ the timeline
const T = [];
const sounds = [];
const at = (t, fn) => T.push({ t, fn });
const sound = (t, file, vol = 1, o = {}) => sounds.push({ t, file, vol, ...o });

function build(data) {
  let t = 0.2;
  at(t, () => ($('#black').style.opacity = '0'));
  data.pages.forEach((p, pi) => {
    buildPage(p, pi);
    if (pi > 0) {
      // the page before slides away, this one in
      const prev = data.pages[pi - 1].el;
      at(t, () => {
        prev.style.transition = 'transform .8s cubic-bezier(.6,0,.4,1), opacity .8s';
        prev.style.transform = 'translateX(-110%) rotate(-4deg)';
        p.el.style.transition = 'none';
        p.el.style.transform = 'translateX(110%) rotate(4deg)';
        p.el.style.opacity = '1';
        requestAnimationFrame(() => {
          p.el.style.transition = 'transform .8s cubic-bezier(.6,0,.4,1)';
          p.el.style.transform = 'none';
        });
      });
      t += 0.9;
    }
    // its panels drawn onto it, one after another
    p.cells.forEach((c, i) => at(t + 0.12 * i, () => c.classList.add('on')));
    t += 0.12 * p.cells.length + 0.6;
    p.panels.forEach((pn, i) => {
      const first = i === 0;
      const t0 = t;
      at(t0, () => openPanel(pn, first));
      t += first ? 0.6 : 0.45;
      let u = t + 0.35;
      for (const f of pn.sfx || []) {
        at(t + (f.at || 0), () => {
          const e = sfx(f);
          requestAnimationFrame(() => e.classList.add('on'));
        });
      }
      for (const s of pn.say || []) {
        const L = LINES[s.id];
        const d = L ? L.dur : 1.5;
        sound(u, `../audio/prologue/${s.id}.mp3`, 1);
        if (s.sfx) {
          const f = s.sfx;
          at(u, () => {
            const e = sfx(f);
            requestAnimationFrame(() => e.classList.add('on'));
          });
        } else if (!s.silent) {
          at(u, () => {
            const e = balloon(s);
            requestAnimationFrame(() => e.classList.add('on'));
          });
        }
        u += d + 0.3;
      }
      if (pn.bed === 'on') sound(t, '../audio/prologue/kids_bed.mp3', 0.35, { bed: 'on' });
      if (pn.bed === 'fade') sound(t, '', 0, { bed: 'fade' });
      if (pn.bed === 'off') sound(t, '', 0, { bed: 'off' });
      const end = Math.max(u - 0.3, t + (pn.hold || 0)) + (pn.tailHold !== undefined ? pn.tailHold : pn.say ? 0.9 : 0);
      pn.t0 = t0;
      pn.t1 = end;
      t = end;
    });
    // the page whole again for a moment
    const last = p.panels[p.panels.length - 1];
    at(t, () => closePanel(last));
    t += 1.6;
  });
  at(t, () => {
    $('#black').style.opacity = '1';
  });
  t += 1.0;
  at(t, () => {
    $('#title').style.opacity = '1';
    $('#black').style.opacity = '0.7';
  });
  t += 3.2;
  at(t, () => {
    $('#title').style.opacity = '0';
    $('#black').style.opacity = '1';
  });
  t += 1.0;
  at(t, () => (window.__done = true));
  T.sort((a, b) => a.t - b.t);
  window.__timeline = { sounds, length: t };
  return data;
}

// ------------------------------------------------------------------ a panel in play
let cur = null;
function openPanel(pn, fromCell) {
  const prev = cur;
  cur = pn;
  layer.innerHTML = '';
  pic.style.backgroundImage = `url(panels/${pn.img}.jpg)`;
  const b = pn.box;
  focus.style.transition = 'none';
  if (fromCell || !prev) {
    // up from its place on the page
    focus.style.clipPath = `inset(${b.y}px ${W - b.x - b.w}px ${H - b.y - b.h}px ${b.x}px)`;
    focus.style.opacity = '1';
    requestAnimationFrame(() => {
      focus.style.transition = 'clip-path .6s cubic-bezier(.7,0,.2,1)';
      focus.style.clipPath = 'inset(0px 0px 0px 0px)';
    });
  } else {
    // a wipe across from the panel before: a slanted edge sweeping over
    focus.style.clipPath = 'polygon(100% 0, 130% 0, 120% 100%, 100% 100%)';
    requestAnimationFrame(() => {
      focus.style.transition = 'clip-path .45s cubic-bezier(.7,0,.25,1)';
      focus.style.clipPath = 'polygon(-30% 0, 130% 0, 120% 100%, -40% 100%)';
    });
  }
  if (prev && prev.cell) prev.cell.classList.add('seen');
  pn.kbAt = now();
}

function closePanel(pn) {
  const b = pn.box;
  layer.innerHTML = '';
  focus.style.transition = 'clip-path .6s cubic-bezier(.7,0,.2,1)';
  focus.style.clipPath = `inset(${b.y}px ${W - b.x - b.w}px ${H - b.y - b.h}px ${b.x}px)`;
  setTimeout(() => (focus.style.opacity = '0'), rec ? 600 : 600);
  if (pn.cell) pn.cell.classList.add('seen');
  cur = null;
}

// ------------------------------------------------------------------ playing
let t0 = 0;
let started = false;
const now = () => (started ? (performance.now() - t0) / 1000 : 0);
let next = 0;
let bed = null;
const audioOn = !rec;
function frame() {
  const t = now();
  while (next < T.length && T[next].t <= t) T[next++].fn();
  // the slow drift of the panel in play
  if (cur && cur.kb) {
    const [s0, s1, dx, dy] = cur.kb;
    const k = ease(Math.min(1, (t - cur.t0) / Math.max(0.5, cur.t1 - cur.t0 + 0.6)));
    const s = s0 + (s1 - s0) * k;
    pic.style.transform = `translate(${dx * 1.6 * k}%, ${dy * 1.6 * k}%) scale(${s})`;
  }
  if (!window.__done) requestAnimationFrame(frame);
}
function playSounds() {
  if (!audioOn) return;
  for (const s of sounds) {
    setTimeout(() => {
      if (s.bed === 'on') {
        bed = new Audio(s.file);
        bed.loop = true;
        bed.volume = s.vol;
        bed.play().catch(() => {});
      } else if (s.bed === 'fade' && bed) {
        const b = bed;
        const k0 = b.volume;
        let i = 0;
        const iv = setInterval(() => {
          b.volume = Math.max(0, k0 * (1 - ++i / 20));
          if (i >= 20) clearInterval(iv);
        }, 60);
      } else if (s.bed === 'off' && bed) {
        bed.pause();
      } else if (s.file) {
        const a = new Audio(s.file);
        a.volume = s.vol;
        a.play().catch(() => {});
      }
    }, s.t * 1000);
  }
}
function start() {
  $('#play').remove();
  started = true;
  t0 = performance.now();
  playSounds();
  requestAnimationFrame(frame);
}

const data = await (await fetch('comic.json')).json();
build(data);
// (every picture loaded before the first frame)
await Promise.all(data.pages.flatMap((p) => p.panels.map((pn) => new Promise((r) => {
  const im = new Image();
  im.onload = im.onerror = r;
  im.src = `panels/${pn.img}.jpg`;
}))));
await document.fonts.ready;
window.__ready = true;
if (rec) start();
else $('#play').addEventListener('click', start);
