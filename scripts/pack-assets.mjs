// Packs binary assets as base64 JSON for hosts that only serve web types
// (e.g. Claude artifacts). The game falls back to these automatically.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const dir = 'dist/assets';
for (const f of readdirSync(dir)) {
  if (!/\.(glb|hdr)$/.test(f)) continue;
  const data = readFileSync(`${dir}/${f}`).toString('base64');
  writeFileSync(`${dir}/${f}.json`, JSON.stringify({ name: f, data }));
  console.log('packed', f);
}

// Artifact page body (the host wraps it in its own html/head skeleton).
writeFileSync(
  'dist/play.html',
  `<title>Threshold</title>
<meta name="theme-color" content="#030507">
<link rel="stylesheet" href="assets/index.css">
<div id="app"><div class="boot">THRESHOLD</div></div>
<script type="module" src="assets/game.js"></script>
`,
);
console.log('wrote dist/play.html');
