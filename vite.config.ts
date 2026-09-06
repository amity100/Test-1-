import { defineConfig, type Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// One stamp per build: baked into the bundle and written next to it so a stale tab can notice a newer deploy.
const buildId = new Date().toISOString();

function versionJson(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  return {
    name: 'flagkeep-version-json',
    configResolved(c) {
      root = c.root;
      outDir = c.build.outDir;
    },
    closeBundle() {
      writeFileSync(join(root, outDir, 'version.json'), JSON.stringify({ buildId }));
    },
  };
}

export default defineConfig({
  base: './',
  resolve: { dedupe: ['three'] },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [versionJson()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
});
