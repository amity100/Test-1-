// Converts the single-file Vite build into a body fragment for the Artifact host.
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('dist-artifact/index.html');
const html = fs.readFileSync(src, 'utf8');
const pick = (re) => Array.from(html.matchAll(re)).map((m) => m[0]);
const title = (html.match(/<title>[\s\S]*?<\/title>/) || ['<title>FLAGKEEP</title>'])[0];
const links = pick(/<link[^>]+rel="stylesheet"[^>]*>/g);
const styles = pick(/<style[\s\S]*?<\/style>/g);
const scripts = pick(/<script[\s\S]*?<\/script>/g);
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
let body = bodyMatch ? bodyMatch[1] : '';
body = body.replace(/<script[\s\S]*?<\/script>/g, '');
const out = [title, ...links, ...styles, body.trim(), ...scripts].join('\n');
fs.mkdirSync('artifact', { recursive: true });
fs.writeFileSync('artifact/flagkeep.html', out);
const kb = Math.round(Buffer.byteLength(out) / 1024);
console.log(`artifact/flagkeep.html written (${kb} KB, ${scripts.length} scripts, ${styles.length} styles)`);
