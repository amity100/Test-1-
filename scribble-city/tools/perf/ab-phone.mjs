// (ROADMAP 19, PHONE_SPEED_PLAN.md) Before and after, as the player's phone draws them: the same
// moments of the city photographed with a change off and on, compared, and laid out one over the
// other for the player to look at. tools/ab.mjs's way (seeded, so two builds see the same moment),
// at the phone's own screen (lib.mjs) and with the mainland's places too.
//
//   node tools/perf/ab-phone.mjs shoot <outDir>              photographs the spots -> <outDir>/<spot>.png, stats.json
//   node tools/perf/ab-phone.mjs diff <dirA> <dirB>          how many pixels differ, spot by spot
//   node tools/perf/ab-phone.mjs sheet <dirA> <dirB> <outDir> [titleA] [titleB]
//                                                            a sheet a spot for the player: A over B whole,
//                                                            then the same two places of each enlarged 3x
//                                                            (the middle, and where they differ most)
//
// AB_SPOTS=blvd,mall_in picks spots; AB_QUERY="newgfx=1" adds to the address (so: once without it - the
// game as it is published - and once with it: PHONE_SPEED_PLAN.md, Stage 0.2).
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from '../shot.mjs';

const SEED = 7;

// where the camera stands: [name, player x, z, yaw, camera position, where it looks, fill]
// (fill: the mainland's blocks and their shops built round the player first. The mall's three were
// set from the map - world/mainland/plan.js: Bayview Mall's dome at -835,-37 - and have not been
// looked at yet: look at their first pictures, and move them if they show a wall)
export const SPOTS = [
  ['blvd', -6, 2, Math.PI, [2, 2.2, 14], [3, 3, -40]],
  ['blvd_south', 0, 60, 0, [-2, 2.4, 40], [6, 2, 110]],
  ['avenue_wet', -66, -60, 0, [-62, 1.8, -40], [-66, 3, -110]],
  ['downtown', -100, -250, 0, [-95, 2.0, -238], [-100, 14, -300]],
  ['park', -100, 60, 0, [-93, 2.4, 75], [-100, 3, 0]],
  ['shopfront', -9, -40, 0, [-3, 1.7, -40], [-14, 1.6, -40]],
  ['pier', 18, 225, 0, [16, 3, 215], [60, 6, 245]],
  ['ocean_cars', 5, 120, 0, [5, 1.7, 100], [5, 1.5, 200]],
  ['mall_east', -700, -37, -1.57, [-694, 2.2, -32], [-760, 6, -40], 1],
  ['mall_in', -835, -37, -1.57, [-828, 2.0, -37], [-880, 2.4, -37], 1],
  ['inkwell', -835, 60, 0, [-835, 2.0, 40], [-835, 3, 110], 1],
];

async function shoot(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startServer();
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 882, height: 411 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
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
  // (three.js draws on the same dice for the id of every new object: its ids get dice of their own,
  // so a build that makes one more object does not shift every roll after it - tools/ab.mjs)
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
  await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?test=1&autostart=1&prologue=0${extra}`);
  await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
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
    for (const [n, l] of [['renderShadows', 'shadow'], ['renderReflection', 'reflection'], ['drawMain', 'main'], ['render', 'all']]) if (g.pipe[n]) wrap(n, l);
    g.enemies.spawnT = 1e9;
    if (g.pipe.trackCamera) {
      const track = g.pipe.trackCamera.bind(g.pipe);
      g.pipe.trackCamera = () => {
        g.pipe.lastT = 0;
        track();
      };
    }
    g.audio.schedule = () => {};
    g.pause = () => {};
  });
  await pg.evaluate('window.__frame(20, 1 / 30)');
  const stats = {};
  const only = process.env.AB_SPOTS ? process.env.AB_SPOTS.split(',') : null;
  for (const [name, px, pz, yaw, pos, look, fill] of SPOTS) {
    // (a spot left out is not gone to at all here - unlike tools/ab.mjs: two runs to compare must
    // be made with the same AB_SPOTS)
    if (only && !only.includes(name)) continue;
    await pg.evaluate(([px, pz, yaw, pos, look, fill]) => {
      const g = window.__game;
      if (fill && g.world.mainland) {
        g.world.mainland.fill({ x: px, z: pz });
        if (g.world.interiors && g.world.interiors.fill) g.world.interiors.fill(px, pz, 20000, 0);
      }
      g.player.spawn(px, pz, yaw);
      g.camRig.yaw = yaw;
      window.__camOverride = { pos, look };
      window.__frame(30, 1 / 30);
    }, [px, pz, yaw, pos, look, fill]);
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
      out.t = +g.time.toFixed(4);
      return out;
    });
    stats[name] = st;
    await pg.evaluate(() => {
      for (const id of ['hud', 'touch']) {
        const el = document.getElementById(id);
        if (el) el.style.visibility = 'hidden';
      }
    });
    await pg.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 180000 });
    process.stdout.write(`${name}: ${JSON.stringify(st)}\n`);
  }
  fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(stats, null, 1));
  if (errors.length) console.log('page errors:', errors.slice(0, 5));
  await browser.close();
  server.close();
  return errors.length ? 1 : 0;
}

const dataUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

// in the page: two pictures' pixels, how they differ, and the 96-pixel square where they differ most
const COMPARE = async ([da, db]) => {
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
  const B = 96;
  const bw = Math.ceil(c.width / B);
  const bh = Math.ceil(c.height / B);
  const blocks = new Float64Array(bw * bh);
  let sum = 0;
  let off = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
      sum += d;
      if (d > 24) off++;
      blocks[Math.floor(y / B) * bw + Math.floor(x / B)] += d;
    }
  }
  let best = 0;
  for (let i = 1; i < blocks.length; i++) if (blocks[i] > blocks[best]) best = i;
  const n = c.width * c.height;
  return { mean: sum / n, pct: (off / n) * 100, w: c.width, h: c.height, hot: [(best % bw) * B + B / 2, Math.floor(best / bw) * B + B / 2], hotSum: blocks[best] };
};

async function diff(dirA, dirB) {
  const browser = await launch();
  const pg = await browser.newPage();
  let worst = 0;
  const rows = [];
  for (const [name] of SPOTS) {
    const a = path.join(dirA, `${name}.png`);
    const b = path.join(dirB, `${name}.png`);
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    const r = await pg.evaluate(COMPARE, [dataUrl(a), dataUrl(b)]);
    worst = Math.max(worst, r.pct);
    rows.push(`${name}: ${r.pct.toFixed(2)}% of pixels differ by more than 24 of 255 (mean ${r.mean.toFixed(2)})`);
  }
  await browser.close();
  console.log(rows.join('\n'));
  console.log(`worst ${worst.toFixed(2)}%`);
  return 0;
}

// A sheet a spot, 1764 wide: A whole, B whole, then two places of each side by side at 3x
async function sheet(dirA, dirB, outDir, titleA = 'לפני', titleB = 'אחרי') {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const pg = await browser.newPage({ viewport: { width: 1764, height: 900 }, deviceScaleFactor: 1 });
  for (const [name] of SPOTS) {
    const a = path.join(dirA, `${name}.png`);
    const b = path.join(dirB, `${name}.png`);
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    const da = dataUrl(a);
    const db = dataUrl(b);
    await pg.setContent('<html><body style="margin:0;background:#16161c"></body></html>');
    const r = await pg.evaluate(COMPARE, [da, db]);
    await pg.evaluate(async ([da, db, r, name, titleA, titleB]) => {
      const load = (src) => new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.src = src;
      });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      const W = 1764;
      const k = W / r.w;
      const H = Math.round(r.h * k);
      const Z = 3;
      const cw = W / 2 - 6;
      const ch = 330;
      const head = 54;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = (H + head) * 2 + (ch + head) * 2 + 20;
      c.id = 'sheet';
      const g = c.getContext('2d');
      g.fillStyle = '#16161c';
      g.fillRect(0, 0, c.width, c.height);
      g.textBaseline = 'middle';
      const label = (text, x, y, align = 'left') => {
        g.font = 'bold 30px sans-serif';
        g.textAlign = align;
        g.fillStyle = '#fff';
        g.fillText(text, x, y);
      };
      let y = 0;
      label(`${titleA} — ${name}`, 16, y + head / 2);
      g.drawImage(ia, 0, y + head, W, H);
      y += head + H;
      label(`${titleB} — ${name}   (${r.pct.toFixed(2)}% of the pixels differ)`, 16, y + head / 2);
      g.drawImage(ib, 0, y + head, W, H);
      y += head + H + 10;
      g.imageSmoothingEnabled = false;
      const crops = [['the middle, 3x', r.w / 2, r.h / 2], ['where they differ most, 3x', r.hot[0], r.hot[1]]];
      for (const [what, cx, cy] of crops) {
        const sw = cw / Z;
        const sh = ch / Z;
        const sx = Math.max(0, Math.min(r.w - sw, cx - sw / 2));
        const sy = Math.max(0, Math.min(r.h - sh, cy - sh / 2));
        label(`${titleA}: ${what}`, 16, y + head / 2);
        label(`${titleB}: ${what}`, W / 2 + 22, y + head / 2);
        g.drawImage(ia, sx, sy, sw, sh, 0, y + head, cw, ch);
        g.drawImage(ib, sx, sy, sw, sh, W / 2 + 6, y + head, cw, ch);
        y += head + ch + 5;
      }
      document.body.appendChild(c);
    }, [da, db, r, name, titleA, titleB]);
    await pg.locator('#sheet').screenshot({ path: path.join(outDir, `${name}.png`) });
    console.log(`${name}: ${r.pct.toFixed(2)}% differ -> ${path.join(outDir, `${name}.png`)}`);
  }
  await browser.close();
  return 0;
}

const [, , cmd, a, b, c, d, e] = process.argv;
if (cmd === 'shoot') process.exitCode = await shoot(a);
else if (cmd === 'diff') process.exitCode = await diff(a, b);
else if (cmd === 'sheet') process.exitCode = await sheet(a, b, c, d, e);
else console.log('usage: node tools/perf/ab-phone.mjs shoot <outDir> | diff <dirA> <dirB> | sheet <dirA> <dirB> <outDir> [titleA] [titleB]');
