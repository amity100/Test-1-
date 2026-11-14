// One frame's passes, counted at the WebGL calls themselves: each framebuffer drawn to, its size,
// how many pictures it writes at once, how many draws and corners. Two frames one after the other
// (a phone draws the mirror and some shadows every other frame).
//   node tools/perf/passes.mjs            (WHERE, EXTRA, COND: see lib.mjs)
import { open } from './lib.mjs';

const init = () => {
  const P = WebGL2RenderingContext.prototype;
  const C = (window.__glc = { on: false, passes: [], cur: null, ids: new WeakMap(), n: 0, vp: [0, 0] });
  const begin = (fb) => {
    let id = 0;
    if (fb) {
      id = C.ids.get(fb);
      if (!id) {
        id = ++C.n;
        C.ids.set(fb, id);
      }
    }
    C.cur = { fb: id, w: C.vp[0], h: C.vp[1], draws: 0, verts: 0, bufs: fb ? fb.__bufs || 1 : 1 };
    C.passes.push(C.cur);
  };
  const bf = P.bindFramebuffer;
  P.bindFramebuffer = function (t, fb) {
    if (C.on && t !== 0x8ca8) begin(fb);
    C.fbObj = fb;
    return bf.call(this, t, fb);
  };
  const db = P.drawBuffers;
  P.drawBuffers = function (a) {
    const n = a.filter((x) => x !== 0).length;
    if (C.fbObj) C.fbObj.__bufs = n;
    if (C.on && C.cur) C.cur.bufs = n;
    return db.call(this, a);
  };
  const vp = P.viewport;
  P.viewport = function (x, y, w, h) {
    C.vp = [w, h];
    if (C.on && C.cur && !C.cur.draws) {
      C.cur.w = w;
      C.cur.h = h;
    }
    return vp.call(this, x, y, w, h);
  };
  const wrap = (name, countIdx, instIdx) => {
    const f = P[name];
    P[name] = function (...a) {
      if (C.on) {
        if (!C.cur) begin(null);
        C.cur.draws++;
        C.cur.verts += a[countIdx] * (instIdx >= 0 ? a[instIdx] : 1);
      }
      return f.apply(this, a);
    };
  };
  wrap('drawElements', 1, -1);
  wrap('drawArrays', 2, -1);
  wrap('drawElementsInstanced', 1, 4);
  wrap('drawArraysInstanced', 2, 3);
  wrap('drawRangeElements', 3, -1);
};

const { pg, where, close } = await open({ init });
const out = await pg.evaluate(() => {
  const g = window.__game;
  const C = window.__glc;
  const res = [];
  for (let k = 0; k < 2; k++) {
    C.passes = [];
    C.cur = null;
    C.on = true;
    window.__frame(1);
    C.on = false;
    res.push(C.passes.filter((p) => p.draws));
  }
  const p = g.pipe;
  const M = g.world.mainland;
  return { frames: res, canvas: [g.renderer.domElement.width, g.renderer.domElement.height], scale: p.scale, size: [p.size.x, p.size.y], deferred: !!p.deferred, taa: !!p.taa, steady: !!p.steady, low: !!p.low, hdr: !!p.hdr, depthFirst: !!p.depthFirst, mem: g.renderer.info.memory, programs: g.renderer.info.programs.length, mainland: M ? M.info() : null, people: g.civilians && g.civilians.list ? g.civilians.list.length : null };
});
const sum = (f) => ({ passes: f.length, draws: f.reduce((a, p) => a + p.draws, 0), tris: Math.round(f.reduce((a, p) => a + p.verts, 0) / 3) });
console.log(where, JSON.stringify({ canvas: out.canvas, scale: out.scale, size: out.size, deferred: out.deferred, taa: out.taa, steady: out.steady, low: out.low, hdr: out.hdr, depthFirst: out.depthFirst, mem: out.mem, programs: out.programs, people: out.people }));
out.frames.forEach((f, i) => {
  console.log('frame', i, JSON.stringify(sum(f)));
  for (const p of f) console.log(`   fb${p.fb} ${p.w}x${p.h} x${p.bufs}  draws ${p.draws}  tris ${Math.round(p.verts / 3)}`);
});
await close();
