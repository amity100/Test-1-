import './style.css';
import { App } from './core/App';
import { BUILD_ID } from './core/Version';

declare global {
  interface Window {
    __fk: { app: App; ready: boolean; buildId: string; debugView: (name: string) => void; error?: string; game: () => import('./core/Game').Game };
  }
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(canvas);
window.__fk = { app, ready: false, buildId: BUILD_ID, debugView: (n) => app.debugView(n), game: () => app.game };
app
  .init()
  .then(() => {
    window.__fk.ready = true;
  })
  .catch((err: unknown) => {
    console.error(err);
    window.__fk.error = String(err instanceof Error ? err.stack ?? err.message : err);
    const st = document.getElementById('loading-status');
    if (st) st.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  });
