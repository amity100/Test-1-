// Bundles the Vite build output into a single self-contained index.html
// so the game can be opened from the filesystem or hosted anywhere.
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const assets = join(dist, 'assets');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

for (const file of readdirSync(assets)) {
  const body = readFileSync(join(assets, file), 'utf8');
  if (file.endsWith('.js')) {
    html = html.replace(
      new RegExp(`<script[^>]*src="[^"]*${file}"[^>]*></script>`),
      () => `<script type="module">\n${body}\n</script>`
    );
  } else if (file.endsWith('.css')) {
    html = html.replace(
      new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`),
      () => `<style>\n${body}\n</style>`
    );
  }
}

writeFileSync(join(dist, 'aviv-protocol.html'), html);
writeFileSync(join(dist, 'index.html'), html);
rmSync(assets, { recursive: true, force: true });
console.log(`inlined -> dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
