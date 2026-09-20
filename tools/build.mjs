// Builds dist/VANTAGE.html: a single self-contained file (engine, game code, model, textures, HDR)
// that runs from a double-click (file://) with no server and no network.
import * as esbuild from 'esbuild';
import fs from 'fs'; import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = (p) => fs.readFileSync(path.join(root, p));
const b64 = (p) => rd(p).toString('base64');
const mime = { '.jpg': 'image/jpeg', '.png': 'image/png' };

// 1) bundle JS (three.js resolved from the vendored copy so dev and dist use the same build)
const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
  plugins: [{
    name: 'vendor-three',
    setup(build) {
      build.onResolve({ filter: /^three$/ }, () => ({ path: path.join(root, 'vendor/three/three.module.js') }));
      build.onResolve({ filter: /^three\/addons\// }, (args) => ({ path: path.join(root, 'vendor/three/addons', args.path.slice('three/addons/'.length)) }));
    },
  }],
});
const js = result.outputFiles[0].text;

// 2) assets
const textures = {};
for (const f of fs.readdirSync(path.join(root, 'assets/textures'))) { const ext = path.extname(f); if (mime[ext]) textures[f] = `data:${mime[ext]};base64,${b64('assets/textures/' + f)}`; }
const soldier = b64('assets/models/soldier.glb');
const hdr = b64('assets/hdr/moonless_golf_1k.hdr');
const css = rd('src/style.css').toString();

const embed = `
<script>
(function(){
  function toBuf(s){ var bin = atob(s); var len = bin.length; var u8 = new Uint8Array(len); for (var i = 0; i < len; i++) u8[i] = bin.charCodeAt(i); return u8.buffer; }
  window.__VANTAGE_EMBED = { textures: ${JSON.stringify(textures)}, soldier: toBuf(${JSON.stringify(soldier)}), hdr: toBuf(${JSON.stringify(hdr)}) };
})();
</script>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>VANTAGE</title>
<meta name="description" content="A single-player tactical shooter: fight on the ground with your squad and rebuild the battlefield from above." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Heebo:wght@400;600;800&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div id="app"></div>
${embed}
<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>
</body>
</html>`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/VANTAGE.html'), html);
console.log('dist/VANTAGE.html', (html.length / 1024 / 1024).toFixed(2) + ' MB', '(js ' + (js.length / 1024).toFixed(0) + ' KB)');

// Artifact variant: the hosting page supplies the document skeleton, so only head content + body content.
const artifact = `<title>VANTAGE</title>
<meta name="description" content="A single-player tactical shooter: fight on the ground with your squad and rebuild the battlefield from above." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Heebo:wght@400;600;800&display=swap" rel="stylesheet">
<style>${css}
html, body { height: 100%; }</style>
<div id="app"></div>
${embed}
<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>
`;
fs.writeFileSync(path.join(root, 'dist/artifact.html'), artifact);
console.log('dist/artifact.html', (artifact.length / 1024 / 1024).toFixed(2) + ' MB');
