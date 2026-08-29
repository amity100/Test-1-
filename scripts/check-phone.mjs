import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('/tmp/phone', { recursive: true });
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
let bad = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad++; };

for (const [W, H] of [[320, 640], [360, 740], [390, 844], [430, 932]]) {
  const p = await b.newPage({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION|404/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  const tap = (sel, text) => p.evaluate(([sel, text]) => {
    const el = Array.from(document.querySelectorAll(sel))
      .find((x) => (!text || x.textContent.includes(text)) && x.offsetParent !== null);
    if (!el) return false; el.click(); return true;
  }, [sel, text]);
  const shut = async () => { while (await tap('#modal .ok')) await p.waitForTimeout(280); };
  await p.waitForTimeout(1100);
  for (const label of ['משחק חדש', 'דלג', 'יאללה']) {
    if (await tap('.screen-layer button', label)) await p.waitForTimeout(800);
  }
  await p.waitForTimeout(3600); await shut();

  // Every button that is on screen must be big enough for a thumb, fully on the
  // screen, and not have anything sitting on top of it.
  const audit = async (what) => {
    const rows = await p.evaluate(() => {
      const out = [];
      // While a window is open it owns the screen on purpose. Only the buttons
      // inside it have to be reachable; the world behind it is meant to be covered.
      const sheet = document.querySelector('#modal .sheet');
      for (const el of document.querySelectorAll('[data-do]')) {
        if (el.offsetParent === null) continue;
        if (sheet && !sheet.contains(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1) continue;
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        const top = document.elementFromPoint(x, y);
        out.push({
          id: el.dataset.do + (el.dataset.arg ? `:${el.dataset.arg.split('|')[1] ?? ''}` : ''),
          big: r.width >= 38 && r.height >= 38,
          onScreen: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1,
          free: !!top && (el === top || el.contains(top)),
        });
      }
      return out;
    });
    for (const r of rows) {
      ok(r.big && r.onScreen && r.free,
        `${W}×${H} ${what} · ${r.id}${r.big ? '' : ' קטן מדי'}${r.onScreen ? '' : ' יוצא מהמסך'}${r.free ? '' : ' מכוסה'}`);
    }
    return rows.length;
  };

  // The game opens looking at the machine it woke in, with its ring already up.
  const n1 = await audit('פתיחה');
  ok(n1 >= 4, `${W}×${H} · יש כפתורים על המסך הראשון (${n1})`);

  const verbs = await p.locator('#ring .rb').count();
  ok(verbs >= 3, `${W}×${H} · הטבעת נפתחה עם ${verbs} דרכים`);
  await audit('טבעת');

  // Open one of the seven and check its own options are reachable too.
  await tap('#ring .rb'); await p.waitForTimeout(900);
  const inner = await p.locator('#ring .rb').count();
  ok(inner >= 2, `${W}×${H} · ובתוכה ${inner} אפשרויות`);
  await audit('אפשרויות');

  // Everything along the top opens something and closes again.
  for (const [what, label] of [['jobs', 'מה רץ'], ['areas', 'מה אני יודע'],
    ['them', 'הם'], ['grown', 'מה נהייתי'], ['help', 'עזרה']]) {
    const opened = await p.evaluate((w) => {
      const el = document.querySelector(`[data-do="${w}"]`);
      if (!el) return false;
      el.click();
      return !!document.querySelector('#modal .sheet');
    }, what);
    ok(opened, `${W}×${H} · "${label}" נפתח`);
    if (opened) { await p.waitForTimeout(260); await audit(`חלון ${label}`); await shut(); }
  }

  // The middle of the screen — where the world is — must stay clear.
  // How much of the screen do the solid panels take? On a phone, the world has
  // to keep most of it, even while you are choosing.
  const covered = await p.evaluate(() => {
    let h = 0;
    for (const sel of ['#top', '#bottom > *:not(.hidden)']) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.offsetParent === null) continue;
        h += el.getBoundingClientRect().height;
      }
    }
    return h / innerHeight;
  });
  ok(covered < 0.5, `${W}×${H} · הפאנלים תופסים ${Math.round(covered * 100)}% מהמסך`);

  await p.screenshot({ path: `/tmp/phone/${W}.png`, timeout: 60000 }).catch(() => {});
  ok(errs.length === 0, `${W}×${H} · בלי שגיאות ${errs.slice(0, 1)}`);
  await p.close();
}
console.log(bad ? `\n✗ ${bad} דברים לא נוחים` : '\n✓ נוח לשחק בפלאפון בכל הרוחבים.');
await b.close();
process.exit(bad ? 1 : 0);
