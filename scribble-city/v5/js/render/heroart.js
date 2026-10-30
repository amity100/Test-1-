import { canvasTexture } from './materials.js';
import { PAINTERS, FACE } from './heroink.js';

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

// ------------------------------------------------------------------ the drawings, and their turning
/**
 * The hero's pictures, each drawn a few times (the first ones now, the rest a little each frame);
 * frame(t) says which of each is on the page now, a dozen times a second, now and then a blink.
 */
export class HeroArt {
  constructor(touch = false) {
    const q = touch ? 0.5 : 1;
    this.sets = {
      // (the face's picture as tall as FACE has it, the head and the neck: render/heroink.js)
      face: { w: 640 * q, h: Math.round((640 * q * FACE.H) / FACE.W), n: touch ? 4 : 6, list: [] },
      hair: { w: 512 * q, h: 512 * q, n: touch ? 3 : 4, list: [] },
      jacket: { w: 1024 * q, h: 1024 * q, n: touch ? 2 : 3, list: [] },
      pants: { w: 1024 * q, h: 1024 * q, n: touch ? 2 : 3, list: [] },
      boots: { w: 512 * q, h: 256 * q, n: 2, list: [] },
    };
    for (const [name, S] of Object.entries(this.sets)) S.list.push(this.make(name, S, 0));
    this.blinkTex = null;
    this.todo = Object.entries(this.sets).flatMap(([name, S]) => Array.from({ length: S.n - 1 }, (_, i) => [name, i + 1]));
    this.todo.unshift(['face', 'blink']);
    this.wait = 0;
    // (the helper: the rest drawn off the game's thread, sent back as pictures)
    this.worker = null;
    try {
      if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
        this.worker = new Worker(new URL('./heroworker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this.arrive(e.data);
        this.worker.onerror = () => (this.worker = null);
        for (const [name, i] of this.todo) {
          const S = this.sets[name];
          this.worker.postMessage({ name, i, w: Math.round(S.w), h: Math.round(S.h), seed: this.seedOf(name, i === 'blink' ? 0 : i), blink: i === 'blink' });
        }
        this.todo = [];
      }
    } catch (e) {
      this.worker = null;
    }
    this.tick = -1;
    this.cur = { face: 0, hair: 0, jacket: 0, pants: 0, boots: 0 };
    this.nextBlink = 3;
    this.blinking = 0;
  }

  seedOf(name, i) {
    return 1009 + i * 7919 + name.length * 31;
  }

  make(name, S, i, blink = false) {
    const c = canvas(Math.round(S.w), Math.round(S.h));
    PAINTERS[name](c, { seed: this.seedOf(name, i), blink });
    return canvasTexture(c, { mips: true });
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
    else S.list.push(t);
  }

  // the first drawing of each: the pens' own pictures (render/people.js)
  first(name) {
    return this.sets[name].list[0];
  }

  // (no helper: a drawing now and then between the frames, until all of it is drawn)
  step() {
    if (!this.todo.length || --this.wait > 0) return;
    this.wait = 45;
    const [name, i] = this.todo.shift();
    const S = this.sets[name];
    if (i === 'blink') this.blinkTex = this.make(name, S, 0, true);
    else S.list.push(this.make(name, S, i));
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
