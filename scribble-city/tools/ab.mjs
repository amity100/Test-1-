// The "same picture" check and the draw-call count, for changes that must not change the look.
//
//   node tools/ab.mjs shoot <outDir> [page]   photographs fixed spots of the city (seeded, so two
//                                             builds see the same moment) and counts each pass's
//                                             draw calls and triangles -> <outDir>/stats.json
//   node tools/ab.mjs diff <dirA> <dirB>      compares the photographs of two runs, spot by spot
//   node tools/ab.mjs heat <a.png> <b.png> <out.png>   shows where two photographs differ
//
// AB_SPOTS=blvd,park picks spots, AB_MOBILE=1 shoots as a phone, AB_QUERY=low adds to the address.
//
// A build passes when every spot differs by less than 1% of its pixels (see ROADMAP.md).
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from './shot.mjs';

const SEED = 7;
const W = 1280;
const H = 720;

// where the camera stands: [name, player x, z, yaw, camera position, where it looks]
export const SPOTS = [
  ['blvd', -6, 2, Math.PI, [2, 2.2, 14], [3, 3, -40]],
  ['blvd_south', 0, 60, 0, [-2, 2.4, 40], [6, 2, 110]],
  ['avenue_wet', -66, -60, 0, [-62, 1.8, -40], [-66, 3, -110]],
  ['downtown', -100, -250, 0, [-95, 2.0, -238], [-100, 14, -300]],
  ['park', -100, 60, 0, [-93, 2.4, 75], [-100, 3, 0]],
  ['market', -100, 293, 0, [-95, 2.2, 308], [-100, 3, 240]],
  ['shopfront', -9, -40, 0, [-3, 1.7, -40], [-14, 1.6, -40]],
  ['pier', 18, 225, 0, [16, 3, 215], [60, 6, 245]],
  ['aerial', -100, 0, 0, [60, 260, 420], [-110, 0, -40]],
];

async function shoot(outDir, page = 'v4/index.html') {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startServer();
  const browser = await launch();
  // AB_MOBILE=1: a phone held sideways (the phone's own settings: touch, a smaller drawing)
  const pg = await browser.newPage(process.env.AB_MOBILE === '1' ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: W, height: H } });
  await pg.addInitScript((seed) => {
    let a = seed >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, SEED);
  // three.js draws on the same dice for the id of every new object: a build that makes one more
  // object would shift every roll after it. Its ids get dice of their own.
  await pg.addInitScript(() => {
    let u = 99991;
    globalThis.__uuidRand = () => {
      u = (u * 16807) % 2147483647;
      return u / 2147483647;
    };
  });
  await pg.route('**/three.module.min.js', async (route) => {
    const resp = await route.fetch();
    const body = (await resp.text()).replaceAll('4294967295*Math.random()', '4294967295*(globalThis.__uuidRand||Math.random)()');
    await route.fulfill({ response: resp, body });
  });
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));
  const extra = process.env.AB_QUERY ? `&${process.env.AB_QUERY}` : '';
  await pg.goto(`http://127.0.0.1:${server.address().port}/${page}?test=1&autostart=1${extra}`);
  await pg.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  // count each pass's draw calls and triangles
  await pg.evaluate(() => {
    const g = window.__game;
    const r = g.renderer;
    r.info.autoReset = false;
    const S = (window.__ab = { pass: {} });
    const wrap = (name, label) => {
      const f = g.pipe[name].bind(g.pipe);
      g.pipe[name] = (...a) => {
        const c0 = r.info.render.calls;
        const t0 = r.info.render.triangles;
        const res = f(...a);
        const s = (S.pass[label] = S.pass[label] || { calls: 0, tris: 0, n: 0 });
        s.calls += r.info.render.calls - c0;
        s.tris += r.info.render.triangles - t0;
        s.n++;
        return res;
      };
    };
    for (const [n, l] of [['renderShadows', 'shadow'], ['renderReflection', 'reflection'], ['render', 'all']]) if (g.pipe[n]) wrap(n, l);
    g.enemies.spawnT = 1e9;
    // the music runs on the wall clock and draws on the same (seeded) dice as the city: silenced,
    // so a faster build sees exactly the same moment as a slower one
    g.audio.schedule = () => {};
    // (and the mouse lock, refused or granted whenever the browser gets to it, never pauses it)
    g.pause = () => {};
  });
  await pg.evaluate('window.__frame(20, 1 / 30)');
  const stats = {};
  const only = process.env.AB_SPOTS ? process.env.AB_SPOTS.split(',') : null;
  for (const [name, px, pz, yaw, pos, look] of SPOTS) {
    if (only && !only.includes(name)) continue;
    await pg.evaluate(([px, pz, yaw, pos, look]) => {
      const g = window.__game;
      g.player.spawn(px, pz, yaw);
      g.camRig.yaw = yaw;
      window.__camOverride = { pos, look };
      window.__frame(30, 1 / 30);
    }, [px, pz, yaw, pos, look]);
    const st = await pg.evaluate(() => {
      const g = window.__game;
      const S = window.__ab;
      S.pass = {};
      for (let i = 0; i < 2; i++) {
        g.renderer.info.reset();
        window.__frame(1, 1 / 30);
      }
      const out = {};
      for (const [k, v] of Object.entries(S.pass)) out[k] = { calls: Math.round(v.calls / v.n), ktris: Math.round(v.tris / v.n / 1000) };
      // (the moment it is in the game: two builds must agree on it)
      out.t = +g.time.toFixed(4);
      return out;
    });
    stats[name] = st;
    await pg.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 180000 });
    process.stdout.write(`${name}: ${JSON.stringify(st)}\n`);
  }
  fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(stats, null, 1));
  if (errors.length) console.log('page errors:', errors.slice(0, 5));
  await browser.close();
  server.close();
  return errors.length ? 1 : 0;
}

async function diff(dirA, dirB) {
  const browser = await launch();
  const pg = await browser.newPage();
  let worst = 0;
  const rows = [];
  for (const [name] of SPOTS) {
    const a = path.join(dirA, `${name}.png`);
    const b = path.join(dirB, `${name}.png`);
    if (!fs.existsSync(a) || !fs.existsSync(b)) {
      rows.push(`${name}: missing`);
      continue;
    }
    const r = await pg.evaluate(async ([da, db]) => {
      const load = (src) => new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = src;
      });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      const c = document.createElement('canvas');
      c.width = ia.width;
      c.height = ia.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(ia, 0, 0);
      const pa = g.getImageData(0, 0, c.width, c.height).data;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(ib, 0, 0);
      const pb = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      let off = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
        sum += d;
        if (d > 24) off++;
      }
      const n = pa.length / 4;
      return { mean: sum / n, pct: (off / n) * 100 };
    }, ['data:image/png;base64,' + fs.readFileSync(a).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(b).toString('base64')]);
    worst = Math.max(worst, r.pct);
    rows.push(`${name}: ${r.pct.toFixed(2)}% of pixels differ (mean ${r.mean.toFixed(2)})`);
  }
  await browser.close();
  console.log(rows.join('\n'));
  console.log(worst < 1 ? `PASS (worst ${worst.toFixed(2)}%)` : `FAIL (worst ${worst.toFixed(2)}%)`);
  return worst < 1 ? 0 : 1;
}

// where two photographs differ: the first one dimmed, the differing pixels in red
async function heat(a, b, out) {
  const browser = await launch();
  const pg = await browser.newPage();
  const url = await pg.evaluate(async ([da, db]) => {
    const load = (src) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
    const [ia, ib] = await Promise.all([load(da), load(db)]);
    const c = document.createElement('canvas');
    c.width = ia.width;
    c.height = ia.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(ib, 0, 0);
    const pb = g.getImageData(0, 0, c.width, c.height).data;
    g.drawImage(ia, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height);
    const pa = img.data;
    for (let i = 0; i < pa.length; i += 4) {
      const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
      if (d > 24) {
        pa[i] = 255;
        pa[i + 1] = 0;
        pa[i + 2] = 0;
      } else {
        pa[i] *= 0.35;
        pa[i + 1] *= 0.35;
        pa[i + 2] *= 0.35;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }, ['data:image/png;base64,' + fs.readFileSync(a).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(b).toString('base64')]);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  await browser.close();
  return 0;
}

const [, , cmd, a, b, c] = process.argv;
if (cmd === 'shoot') process.exitCode = await shoot(a, b);
else if (cmd === 'diff') process.exitCode = await diff(a, b);
else if (cmd === 'heat') process.exitCode = await heat(a, b, c);
else console.log('usage: node tools/ab.mjs shoot <outDir> [page] | diff <dirA> <dirB> | heat <a.png> <b.png> <out.png>');
