import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`          -> regular static build in dist/ (base './': every asset URL is relative)
// `npm run build:artifact` -> dist/ + tools/package_artifact.py -> dist-artifact/ (claude.ai multi-file Artifact page)
// `npm run build:single`   -> one self-contained HTML file in dist-single/ (assets inlined as data URIs)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020', // iOS Safari 14+ / Chrome Android: WebGL2 is required anyway
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
}));
