import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the whole game into a single self-contained HTML file (dist-artifact/index.html).
export default defineConfig({
  base: './',
  resolve: { dedupe: ['three'] },
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2022',
    outDir: 'dist-artifact',
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000,
  },
});
