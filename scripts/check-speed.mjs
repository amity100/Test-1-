/**
 * Does it still run on a phone?
 *
 * The player's words were "כרגע זה מאוד איטי בפלאפון, ויש גם הרבה היבהובים",
 * and the reason was countable: a city hand-built out of little boxes was
 * asking the phone for fifteen hundred separate drawings every frame, where a
 * phone is comfortable with a few hundred.
 *
 * So this counts them, at the driver rather than through three.js — the game
 * draws its frame in several passes and `renderer.info` only ever remembers the
 * last one. It counts from the wide view the game opens on and again from down
 * in the street, because the street is where the shadows come back on.
 *
 * Nothing here is about how fast this machine is: the checking browser draws
 * with the processor and is a hundred times slower than any real phone. What it
 * measures is how much *work* the game asks for, which is the part that is the
 * game's fault.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

/** What a phone draws comfortably in one frame. */
const CALLS = 420;
/** And how many triangles, in the same frame. */
const TRIS = 420000;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
});
page.on('pageerror', (e) => console.log('שגיאה:', e.message));

// Count every drawing the page asks the card for, between one frame and the next.
await page.addInitScript(() => {
  window.__st = { calls: 0, tris: 0, hist: [] };
  const patch = (P) => {
    if (!P) return;
    const de = P.drawElements, da = P.drawArrays, dei = P.drawElementsInstanced;
    if (de) P.drawElements = function (m, c) { window.__st.calls++; window.__st.tris += c / 3; return de.apply(this, arguments); };
    if (da) P.drawArrays = function (m, f, c) { window.__st.calls++; window.__st.tris += c / 3; return da.apply(this, arguments); };
    if (dei) P.drawElementsInstanced = function (m, c, t, o, n) { window.__st.calls++; window.__st.tris += (c / 3) * n; return dei.apply(this, arguments); };
  };
  patch(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  patch(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  const tick = () => {
    window.__st.hist.push({ calls: window.__st.calls, tris: Math.round(window.__st.tris) });
    if (window.__st.hist.length > 200) window.__st.hist.shift();
    window.__st.calls = 0; window.__st.tris = 0;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

await page.goto(`file://${path.resolve('dist/index.html')}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const tap = (sel, text) => page.evaluate(([sel, text]) => {
  const el = Array.from(document.querySelectorAll(sel))
    .find((x) => (!text || x.textContent.includes(text)) && x.offsetParent !== null);
  if (!el) return false; el.click(); return true;
}, [sel, text]);
for (const label of ['משחק חדש', 'דלג', 'יאללה']) {
  if (await tap('.screen-layer button', label)) await page.waitForTimeout(800);
}
await page.waitForTimeout(2600);
while (await tap('#modal .ok:not([data-do="again"])')) await page.waitForTimeout(250);

const read = async () => {
  await page.evaluate(() => { window.__st.hist.length = 0; });
  await page.waitForTimeout(4500);
  return page.evaluate(() => {
    const h = window.__st.hist.filter((x) => x.calls > 0);
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] || 0;
    return { calls: med(h.map((x) => x.calls)), tris: med(h.map((x) => x.tris)), frames: h.length };
  });
};

let bad = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad++; };

const wide = await read();
ok(wide.frames > 0, `נמדדו פריימים מלמעלה (${wide.frames})`);
ok(wide.calls <= CALLS, `מלמעלה, על כל הארץ: ${wide.calls} ציורים בפריים (עד ${CALLS})`);
ok(wide.tris <= TRIS, `ו־${wide.tris} משולשים (עד ${TRIS})`);

await page.evaluate(() => window.__world && window.__world.goToArea(0, 0, 60));
const close = await read();
ok(close.calls <= CALLS, `מלמטה, בתוך הרחוב: ${close.calls} ציורים בפריים (עד ${CALLS})`);
ok(close.tris <= TRIS, `ו־${close.tris} משולשים (עד ${TRIS})`);

// The one thing that made the city shimmer: a window pane a centimetre in front
// of its own wall, with a near plane so close that a centimetre was below what
// the depth buffer could tell apart. The near plane has to move with the view.
const near = await page.evaluate(() => {
  const w = window.__world;
  if (!w) return null;
  const rule = w.constructor.nearFor;
  return {
    room: rule(12), street: rule(90), country: rule(1800),
    live: w.camera.near, dist: Math.round(w.dist),
  };
});
ok(!!near, 'אפשר לבדוק את המצלמה');
if (near) {
  ok(near.country > 1,
    `מגובה של קילומטר המצלמה מתחילה לראות רק מ־${near.country.toFixed(2)} מ׳ — בלי זה הכל מרצד`);
  ok(near.room < 0.3,
    `ובתוך חדר היא עדיין רואה מ־${near.room.toFixed(2)} מ׳, כדי שאפשר יהיה לעמוד ליד שולחן`);
  ok(near.street > near.room && near.country > near.street,
    `וזה עולה עם המרחק: ${near.room.toFixed(2)} → ${near.street.toFixed(2)} → ${near.country.toFixed(2)}`);
}

// And the other half of the complaint: "יש גם הרבה היבהובים".
//
// With the camera standing perfectly still, some of the picture is supposed to
// change — cars on the motorway, the sea, the lights running along the veins.
// What is not supposed to change is everything else, and the grade pass used to
// draw a fresh random value into every pixel on every frame. On a small bright
// screen showing a dark city that is not film grain, it is static, and it was a
// third of the screen changing sixty times a second.
//
// Two checks, because the two things fail differently: the grain must not be
// animated at all, and what is left over must stay small.
const shader = fs.readFileSync(path.resolve('src/render/postfx.ts'), 'utf8');
const grainLine = shader.split('\n').find((l) => l.includes('float g = hash('));
ok(!!grainLine && !grainLine.includes('uTime'),
  `הגרעיניות לא זזה בין פריימים (${(grainLine ?? '').trim()})`);

await page.evaluate(() => window.__world.goToArea(0, 0, 500));
await page.waitForTimeout(5000);
const moving = await page.evaluate(async () => {
  const w = window.__world;
  const cv = w.renderer.domElement;
  const grab = () => {
    const c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    c.getContext('2d').drawImage(cv, 0, 0);
    return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  };
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const runs = [];
  for (let k = 0; k < 3; k++) {
    await frame();
    const a = grab();
    await frame();
    const b = grab();
    let moved = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) moved += 1;
    }
    runs.push((moved / (a.length / 4)) * 100);
  }
  runs.sort((x, y) => x - y);
  return Math.round(runs[1] * 10) / 10;
});
ok(moving < 25, `וכשעומדים במקום רק ${moving}% מהתמונה משתנה מפריים לפריים`);

console.log(bad ? `\n✗ ${bad} דברים כבדים מדי לפלאפון` : '\n✓ המשחק מבקש מהפלאפון מעט מספיק, והתמונה לא מרצדת.');
await browser.close();
process.exit(bad ? 1 : 0);
