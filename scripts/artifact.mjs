/**
 * Turn the built game into a page that can be published and played from a link.
 *
 * `npm run build` already produces one self-contained file with everything
 * inside it — every shape, every sound, every line of Hebrew — because the game
 * ships no assets at all. What it cannot produce is the exact shape a hosted
 * page wants: the host supplies its own <html>, <head> and <body>, so a whole
 * document handed to it would be a document inside a document.
 *
 * So this takes dist/index.html apart at its seams and hands back only the
 * inside: the title, the two type families, the stylesheet, the markup, and the
 * bundle. Two things have to be said again on the way out, because they lived on
 * tags we no longer own:
 *
 *   · the page is Hebrew and reads right to left, which was `<html dir="rtl">`
 *     and is now one line of CSS;
 *   · the ground is the colour of a city at three in the morning, which the
 *     stylesheet already paints on `body` — so nothing borrows the host's
 *     white.
 *
 *   node scripts/artifact.mjs [out.html]
 */
import fs from 'node:fs';

const SRC = 'dist/index.html';
const out = process.argv[2] ?? 'artifact.html';

if (!fs.existsSync(SRC)) {
  console.error(`אין ${SRC}. צריך להריץ קודם: npm run build`);
  process.exit(1);
}

const s = fs.readFileSync(SRC, 'utf8');

/** One whole element, from its opening tag to its closing one. */
function element(open, close) {
  const i = s.indexOf(open);
  if (i < 0) throw new Error(`לא מצאתי ${open} ב-${SRC}`);
  const j = s.indexOf(close, i);
  if (j < 0) throw new Error(`לא מצאתי ${close} ב-${SRC}`);
  return s.slice(i, j + close.length);
}

const style = element('<style>', '</style>');
const script = element('<script type="module">', '</script>');

const bodyStart = s.indexOf('<div id="app">');
const bodyEnd = s.indexOf('</body>', bodyStart);
if (bodyStart < 0 || bodyEnd < 0) throw new Error(`לא מצאתי את גוף הדף ב-${SRC}`);
const markup = s.slice(bodyStart, bodyEnd).trim();

const page = [
  '<title>ההתפשטות</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
    + 'family=Heebo:wght@200;300;400;500;700;900&'
    + 'family=JetBrains+Mono:wght@300;400;700&display=swap">',
  // The one thing that lived on <html> and has nowhere else to go.
  '<style>\nhtml { direction: rtl; }\n</style>',
  style,
  markup,
  script,
  '',
].join('\n');

fs.writeFileSync(out, page);

const kb = Math.round(page.length / 1024);
for (const bad of ['<!doctype', '<html', '<body']) {
  if (page.toLowerCase().includes(bad)) {
    console.error(`✗ נשאר ${bad} בפנים — הדף המארח כבר נותן אותו`);
    process.exit(1);
  }
}
console.log(`✓ ${out} — ${kb} KB, מוכן לפרסום`);
