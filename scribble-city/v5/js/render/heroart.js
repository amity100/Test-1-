import { canvasTexture } from './materials.js';
import { PAINTERS, FACE } from './heroink.js';
import { FOLK_PAINTERS } from './folkink.js';
import { FOLK } from './folkspec.js';

export { FACE, JK, PT, TORSO_Y } from './heroink.js';

// (v5, ROADMAP 13.1) The hero's drawings (render/heroink.js), each drawn several times over and
// turned over a dozen times a second (render/people.js drawHero): the first of each drawn now, the
// rest by a helper off the game's own thread (render/heroworker.js) - or, where there is none, one
// now and then between the frames.

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// a picture of one colour (the city's people's, until their drawings come)
function plainTex(col) {
  const c = canvas(4, 4);
  const g = c.getContext('2d');
  g.fillStyle = col;
  g.fillRect(0, 0, 4, 4);
  return canvasTexture(c, { mips: false });
}
const SKIN_OF = { fair: '#e8c3a6', light: '#d9a888', golden: '#dcae86', olive: '#c49070', tan: '#c8956c', deep: '#76452e' };

// ------------------------------------------------------------------ the drawings, and their turning
/**
 * The hero's pictures, each drawn a few times (the first ones now, the rest a little each frame);
 * frame(t) says which of each is on the page now, a dozen times a second, now and then a blink.
 */
// (one helper for all of them: the hero's drawings first, then the city's people's - ROADMAP 13.6)
let helper;
const arts = [];
function helperOf() {
  if (helper !== undefined) return helper;
  helper = null;
  try {
    if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
      helper = new Worker(new URL('./heroworker.js', import.meta.url), { type: 'module' });
      helper.onmessage = (e) => {
        if (e.data.err) console.warn('[heroart] a picture not drawn:', e.data.folk, e.data.name, e.data.err);
        const a = arts[e.data.art];
        if (a) a.arrive(e.data);
      };
      helper.onerror = (e) => {
        console.warn('[heroart] the helper failed:', e && e.message);
        helper = null;
        // (whatever was left undrawn is drawn between the frames instead)
        for (const a of arts) if (a.sent) a.todo = a.sent;
      };
    }
  } catch (e) {
    helper = null;
  }
  return helper;
}

// ------------------------------------------------------------------ the city's people (ROADMAP 13.7)
const SETS = ['face', 'hair', 'jacket', 'pants', 'boots'];
// (a person's pictures in the order they are drawn: what you see of them first, first)
const ORDER = ['face', 'jacket', 'pants', 'hair', 'boots'];
/**
 * All the city's people's pictures in five atlases - faces, hair, tops, bottoms, shoes - a tile each
 * (n of them, 8 across), so that all of them are drawn in one pen (render/people.js, USE_ATLAS). Each
 * person's are drawn by the helper the first time they are about (want), and written straight into
 * their place on the graphics card; a plain colour until then.
 */
export class FolkAtlas {
  constructor(touch, n) {
    this.n = n;
    this.cols = 8;
    this.rows = Math.ceil(n / this.cols);
    const q = touch ? 0.6 : 1;
    const fw = Math.round(320 * q);
    this.size = {
      face: [fw, Math.round((fw * FACE.H) / FACE.W)],
      hair: [Math.round(192 * q), Math.round(192 * q)],
      jacket: [Math.round(320 * q), Math.round(320 * q)],
      pants: [Math.round(320 * q), Math.round(320 * q)],
      boots: [Math.round(160 * q), Math.round(80 * q)],
    };
    this.canvas = {};
    this.tex = {};
    for (const name of SETS) {
      const [w, h] = this.size[name];
      const c = canvas(w * this.cols, h * this.rows);
      const g = c.getContext('2d');
      for (let k = 0; k < n; k++) {
        const P = FOLK[k];
        g.fillStyle = { face: SKIN_OF[P.skin] || '#c49070', hair: P.hair.base, jacket: P.top.base, pants: P.bottom.base, boots: P.shoes.base }[name];
        g.fillRect((k % this.cols) * w, Math.floor(k / this.cols) * h, w, h);
      }
      this.canvas[name] = c;
      // (its tiles from the top left, as the canvas has them: render/glsl.js penPicture)
      const t = canvasTexture(c, { mips: true });
      t.flipY = false;
      this.tex[name] = t;
    }
    this.asked = new Uint8Array(n);
    // (how many of each one's pictures have come)
    this.got = new Uint8Array(n);
    // (what is to be drawn, how near each of them is this frame, how many the helper has now)
    this.queue = [];
    this.near = new Float32Array(n).fill(Infinity);
    this.busy = 0;
    this.sent = [];
    this.todo = [];
    this.wait = 0;
    this.dirty = new Set();
    this.renderer = null;
    this.id = arts.length;
    arts.push(this);
    this.worker = helperOf();
  }

  // (their pictures asked for the first time they are drawn, and every frame they are, with how far
  // off they are: render/people.js drawFolk) - the nearest one's next picture is drawn first, their
  // face before the rest
  want(k, d = 0) {
    if (d < this.near[k]) this.near[k] = d;
    if (this.asked[k]) return;
    this.asked[k] = 1;
    for (const name of ORDER) this.queue.push({ art: this.id, folk: k, name, i: 0, w: this.size[name][0], h: this.size[name][1], seed: 1009 + name.length * 31, blink: false });
  }

  // (a couple at a time to the helper, so that whoever comes nearer meanwhile is drawn next)
  pump() {
    this.worker = helperOf();
    const max = this.worker ? 2 : 0;
    while (this.busy < max && this.queue.length) {
      let best = 0;
      for (let i = 1; i < this.queue.length; i++) if (this.near[this.queue[i].folk] < this.near[this.queue[best].folk]) best = i;
      const job = this.queue.splice(best, 1)[0];
      this.worker.postMessage(job);
      this.sent.push(job);
      this.busy++;
    }
    this.near.fill(Infinity);
  }

  arrive(d) {
    if (!d) return;
    this.busy = Math.max(0, this.busy - 1);
    // (what is still to come, should the helper fail: drawn here instead)
    this.sent = this.sent.filter((j) => j.folk !== d.folk || j.name !== d.name);
    // (not drawn: its plain colour stays)
    if (d.err) this.got[d.folk]++;
    if (!d.bmp) return;
    this.put(d.folk, d.name, d.bmp);
    d.bmp.close();
  }

  // a picture into its tile: on the canvas, and straight into its place on the graphics card once the
  // atlas is there (the first time, the whole canvas goes)
  put(k, name, src) {
    const [w, h] = this.size[name];
    const x = (k % this.cols) * w;
    const y = Math.floor(k / this.cols) * h;
    this.canvas[name].getContext('2d').drawImage(src, x, y, w, h);
    this.got[k]++;
    const t = this.tex[name];
    const r = this.renderer;
    const p = r && r.properties.get(t);
    if (!p || !p.__webglTexture || p.__version !== t.version) {
      t.needsUpdate = true;
      return;
    }
    const gl = r.getContext();
    r.state.activeTexture(gl.TEXTURE0);
    r.state.bindTexture(gl.TEXTURE_2D, p.__webglTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, src);
    this.dirty.add(t);
  }

  // once a frame: the smaller copies of the atlases that changed; with no helper, a picture now and
  // then between the frames
  update() {
    this.pump();
    // (no helper: the nearest one's next picture now and then, here)
    if (!this.worker && this.queue.length && !this.todo.length) this.todo.push(this.queue.shift());
    if (this.todo.length && --this.wait <= 0) {
      this.wait = 20;
      const j = this.todo.shift();
      const c = canvas(j.w, j.h);
      FOLK_PAINTERS[j.name](c, { seed: j.seed, blink: false, spec: j.folk });
      this.put(j.folk, j.name, c);
    }
    if (!this.dirty.size) return;
    const r = this.renderer;
    const gl = r.getContext();
    for (const t of this.dirty) {
      const p = r.properties.get(t);
      if (!p.__webglTexture) continue;
      r.state.activeTexture(gl.TEXTURE0);
      r.state.bindTexture(gl.TEXTURE_2D, p.__webglTexture);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    this.dirty.clear();
  }
}

export class HeroArt {
  // folk: one of the city's people drawn as he is (render/folkspec.js FOLK's number): smaller pictures,
  // fewer of each, all of them drawn by the helper (a plain colour until theirs come)
  constructor(touch = false, folk = null) {
    this.folk = folk;
    this.painters = folk === null ? PAINTERS : FOLK_PAINTERS;
    const q = folk === null ? (touch ? 0.5 : 1) : touch ? 0.36 : 0.5;
    const n = folk === null ? [touch ? 4 : 6, touch ? 3 : 4, touch ? 2 : 3, touch ? 2 : 3, 2] : [touch ? 3 : 4, 2, 2, 2, 1];
    const qf = folk === null ? q : touch ? 0.5 : 1;
    this.sets = {
      // (the face's picture as tall as FACE has it, the head and the neck: render/heroink.js)
      // (the city's people's faces as fine as his - ROADMAP 13.6: drawn with care, they are the person)
      face: { w: 640 * qf, h: Math.round((640 * qf * FACE.H) / FACE.W), n: n[0], list: [] },
      hair: { w: 512 * q, h: 512 * q, n: n[1], list: [] },
      jacket: { w: 1024 * q, h: 1024 * q, n: n[2], list: [] },
      pants: { w: 1024 * q, h: 1024 * q, n: n[3], list: [] },
      boots: { w: 512 * q, h: 256 * q, n: n[4], list: [] },
    };
    const first = folk === null ? 1 : 0;
    if (folk === null) for (const [name, S] of Object.entries(this.sets)) S.list.push(this.make(name, S, 0));
    else {
      const P = FOLK[folk];
      const plain = { face: SKIN_OF[P.skin] || '#c49070', hair: P.hair.base, jacket: P.top.base, pants: P.bottom.base, boots: P.shoes.base };
      for (const [name, S] of Object.entries(this.sets)) {
        S.list.push(plainTex(plain[name]));
        S.plain = true;
      }
    }
    this.blinkTex = null;
    this.todo = Object.entries(this.sets).flatMap(([name, S]) => Array.from({ length: S.n - first }, (_, i) => [name, i + first]));
    this.todo.unshift(['face', 'blink']);
    this.wait = 0;
    // (the helper: the rest drawn off the game's thread, sent back as pictures - the city's people's
    // only once they are first about: want)
    this.id = arts.length;
    arts.push(this);
    this.worker = helperOf();
    this.tick = -1;
    this.cur = { face: 0, hair: 0, jacket: 0, pants: 0, boots: 0 };
    this.nextBlink = 3;
    this.blinking = 0;
    this.asked = false;
    if (folk === null) this.want();
  }

  // (their drawings asked for the first time they are drawn: render/people.js drawFolk) - the first
  // of each first, the rest once those have come: whoever is about has their look soon, the boil after
  want() {
    if (this.asked) return;
    this.asked = true;
    this.worker = helperOf();
    if (this.worker) {
      const first = this.todo.filter(([, i]) => i === 0);
      this.later = first.length ? this.todo.filter(([, i]) => i !== 0) : [];
      this.firstLeft = first.length;
      this.post(first.length ? first : this.todo);
      this.sent = this.todo;
      this.todo = [];
    }
  }

  post(list) {
    for (const [name, i] of list) {
      const S = this.sets[name];
      this.worker.postMessage({ art: this.id, folk: this.folk, name, i, w: Math.round(S.w), h: Math.round(S.h), seed: this.seedOf(name, i === 'blink' ? 0 : i), blink: i === 'blink' });
    }
  }

  seedOf(name, i) {
    return 1009 + i * 7919 + name.length * 31;
  }

  make(name, S, i, blink = false) {
    const c = canvas(Math.round(S.w), Math.round(S.h));
    this.painters[name](c, { seed: this.seedOf(name, i), blink, spec: this.folk });
    return canvasTexture(c, { mips: true });
  }

  // (a picture into its set: the first of the city's people's in place of its plain colour)
  put(S, t) {
    if (S.plain) {
      S.plain = false;
      S.list[0].dispose();
      S.list[0] = t;
    } else S.list.push(t);
  }

  // a drawing back from the helper: onto a canvas of its own, into the set
  arrive(d) {
    if (!d || !d.bmp) return;
    const S = this.sets[d.name];
    const c = canvas(d.bmp.width, d.bmp.height);
    c.getContext('2d').drawImage(d.bmp, 0, 0);
    d.bmp.close();
    const t = canvasTexture(c, { mips: true });
    if (d.i === 'blink') this.blinkTex = t;
    else this.put(S, t);
    if (d.i === 0 && this.firstLeft > 0 && --this.firstLeft === 0 && this.later.length && this.worker) {
      this.post(this.later);
      this.later = [];
    }
  }

  // the first drawing of each: the pens' own pictures (render/people.js)
  first(name) {
    return this.sets[name].list[0];
  }

  // (no helper: a drawing now and then between the frames, until all of it is drawn)
  step() {
    if (!this.asked || !this.todo.length || --this.wait > 0) return;
    this.wait = 45;
    const [name, i] = this.todo.shift();
    const S = this.sets[name];
    if (i === 'blink') this.blinkTex = this.make(name, S, 0, true);
    else this.put(S, this.make(name, S, i));
  }

  // which drawing is on the page at time t (seconds): out: { face, hair, jacket, pants, boots }
  frame(t, out) {
    const tick = Math.floor(t * 12);
    if (tick !== this.tick) {
      this.tick = tick;
      const R = Math.random;
      for (const name of Object.keys(this.cur)) {
        const L = this.sets[name].list;
        // (the face redrawn every frame of the twelve; the clothes every other)
        if (L.length < 2 || (name !== 'face' && name !== 'hair' && tick % 2)) continue;
        let k = Math.floor(R() * (L.length - 1));
        if (k >= this.cur[name]) k++;
        this.cur[name] = k;
      }
      if (this.blinking > 0) this.blinking--;
      else if (t > this.nextBlink && this.blinkTex) {
        this.blinking = 2;
        this.nextBlink = t + 2.5 + R() * 4;
      }
    }
    for (const name of Object.keys(this.cur)) out[name] = this.sets[name].list[this.cur[name]];
    if (this.blinking > 0 && this.blinkTex) out.face = this.blinkTex;
    return out;
  }
}
