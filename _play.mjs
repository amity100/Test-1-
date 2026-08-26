import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  let p = join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[extname(p)] || 'text/plain' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(8904, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 860 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));

const clearInterrupts = () => page.evaluate(() => {
  const c = document.querySelector('[data-act="close-concept"]');
  if (c) { c.click(); return 'concept'; }
  const h = document.querySelector('#tutorial-tip.on [data-act="close-help"]');
  if (h) { h.click(); return 'help'; }
  const d = document.querySelector('.dg-choice:not([disabled])');
  if (d) { d.click(); return 'dialog'; }
  return null;
});

const snap = () => page.evaluate(() => {
  const cur = document.querySelector('.obj-now b')?.textContent ?? null;
  const li = [...document.querySelectorAll('.objectives li')];
  return {
    cur,
    done: li.filter((l) => l.classList.contains('done')).length,
    total: li.length,
    chapter: document.querySelector('#tb-chapter')?.textContent,
    panel: document.querySelector('#side-left h3')?.textContent ?? null,
    ops: [...document.querySelectorAll('.node-panel .op-list > .op-card:not([disabled]), .person-panel .op-list > .op-card:not([disabled])')]
      .map((o) => o.querySelector('.op-title')?.textContent),
    running: document.querySelectorAll('.op-run').length,
    canSurveil: !!document.querySelector('[data-act="surveil"]'),
    canFeed: !!document.querySelector('[data-act="feed"]'),
  };
});

await page.goto('http://localhost:8904/index.html');
await page.waitForTimeout(2500);
await page.click('[data-act="new"]');
await page.waitForTimeout(600);
await page.locator('.skip').click();
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) { await clearInterrupts(); await page.waitForTimeout(700); }
await page.evaluate(() => document.querySelector('[data-act="speed"][data-v="4"]')?.click());

const log = [];
let lastCur = null, stuck = 0;
const t0 = Date.now();

while (Date.now() - t0 < 700000) {
  const kind = await clearInterrupts();
  if (kind) { await page.waitForTimeout(500); continue; }
  const st = await snap();
  if (st.cur !== lastCur) {
    log.push(`[${((Date.now()-t0)/1000).toFixed(0)}s] ${st.chapter} · ${st.done}/${st.total} → ${st.cur}`);
    console.log(log[log.length - 1]);
    lastCur = st.cur; stuck = 0;
  } else stuck++;

  if (st.chapter && !st.chapter.includes('1')) { console.log('CHAPTER 1 COMPLETE'); break; }
  if (st.done >= st.total) { console.log('ALL OBJECTIVES DONE'); break; }

  // take me to the target, then act
  await page.evaluate(() => document.querySelector('.obj-now [data-act="objective"]')?.click());
  await page.waitForTimeout(500);
  const st2 = await snap();

  if (st2.canSurveil && /פיקוח/.test(st.cur ?? '')) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('[data-act="surveil"]')].find((x) => !x.classList.contains('on'));
      b?.click();
    });
  } else if (st2.canFeed && /שידור/.test(st.cur ?? '')) {
    await page.evaluate(() => document.querySelector('[data-act="feed"]')?.click());
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('[data-act="close-feed"]')?.click());
  } else if (st2.ops.length && st2.running < 2) {
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.node-panel .op-list > .op-card:not([disabled]), .person-panel .op-list > .op-card:not([disabled])')];
      const prefer = cards.find((c) => /תנועה צדדית/.test(c.textContent)) || cards[0];
      prefer?.click();
    });
  }
  await page.waitForTimeout(2500);
  if (stuck > 50) {
    const why = await page.evaluate(() => ({
      panel: document.querySelector('#side-left h3')?.textContent,
      locked: [...document.querySelectorAll('#side-left .op-card')].map((o) => ({
        name: o.querySelector('.op-title')?.textContent,
        disabled: o.hasAttribute('disabled'),
        block: o.querySelector('.op-block')?.textContent?.trim(),
      })),
      res: document.querySelector('#tb-res')?.textContent?.replace(/\s+/g, ' ').trim(),
      running: [...document.querySelectorAll('.op-run .or-title')].map((x) => x.textContent),
      threads: document.querySelector('.ops-queue .mini-head em')?.textContent,
    }));
    console.log('STUCK at:', st.cur);
    console.log(JSON.stringify(why, null, 2));
    break;
  }
}

const final = await snap();
console.log('FINAL:', JSON.stringify(final, null, 2));
await page.screenshot({ path: 'p-final.png' });
console.log('ERRORS:', errs.length ? errs.slice(0,5) : 'none');
await browser.close(); server.close();
