// The game's modules, every one main.js reaches (its imports, theirs, and the ones it loads later by
// name: import('./x.js')), as <link rel="modulepreload"> lines for the page - so the browser asks for
// all of them at once instead of finding them a level at a time, each level a round trip to the
// server (hundreds of files, a dozen levels deep). For when the game is published unbundled
// (tools/publish-pages.sh: no esbuild).
//   node scribble-city/tools/modulepreload.mjs <v5 dir>   -> the lines, on stdout
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'scribble-city/v5');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// (the page's import map: bare names to files)
const map = {};
const im = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
if (im) Object.assign(map, JSON.parse(im[1]).imports || {});
const entry = /<script type="module" src="([^"]+)"/.exec(html);
if (!entry) throw new Error('no module script in index.html');

const seen = new Set();
const order = [];
const RE = [/\bimport\s+(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g, /\bexport\s+(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s+)?from\s+['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g];

function resolve(spec, from) {
  if (map[spec]) return path.resolve(root, map[spec]);
  if (spec.startsWith('.') || spec.startsWith('/')) return path.resolve(path.dirname(from), spec);
  return null;
}

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return;
  }
  // (comments out first: an import named in a comment is not one)
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  for (const re of RE) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code))) {
      const f = resolve(m[1], file);
      if (f && f.endsWith('.js')) walk(f);
    }
  }
  order.push(file);
}

walk(path.resolve(root, entry[1]));
for (const f of order) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  process.stdout.write(`<link rel="modulepreload" href="${rel}">\n`);
}
