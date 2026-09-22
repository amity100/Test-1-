import './ui/style.css';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { defaultQuality, IS_TOUCH, QualityName } from './config';
import { Game, Settings } from './game/game';
import { loadCharacterAsset } from './game/characters';
import { Menu } from './ui/menu';

function loadSettings(): Settings {
  const d: Settings = { quality: defaultQuality(), sensitivity: 1, invertY: false, slowmo: true };
  try {
    const s = JSON.parse(localStorage.getItem('threshold.settings') || '{}');
    return { ...d, ...s };
  } catch {
    return d;
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem('threshold.settings', JSON.stringify(s));
  } catch {}
}

/**
 * Resolves a binary asset to a loadable URL. Prefers the raw file; when the
 * host can't serve that type, falls back to a base64 JSON pack of it.
 */
async function assetUrl(dir: string, name: string, magic: string, onProgress?: (p: number) => void): Promise<string> {
  try {
    const r = await fetch(dir + name);
    if (r.ok) {
      const buf = await r.arrayBuffer();
      const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(4, buf.byteLength)));
      if (head.startsWith(magic)) {
        onProgress?.(1);
        return URL.createObjectURL(new Blob([buf]));
      }
    }
  } catch {}
  const r = await fetch(dir + name + '.json');
  if (!r.ok) throw new Error(`Missing asset ${name}`);
  const j = await r.json();
  const bin = atob(j.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  onProgress?.(1);
  return URL.createObjectURL(new Blob([bytes]));
}

async function boot() {
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'view';
  app.appendChild(canvas);
  const ui = document.createElement('div');
  ui.className = 'ui';
  app.appendChild(ui);
  if (IS_TOUCH) document.body.classList.add('is-touch');

  const settings = loadSettings();
  const menu = new Menu(ui, settings);
  menu.showLoading(0);

  let game: Game;
  try {
    game = new Game(canvas, ui, settings);
  } catch (e) {
    menu.fatal('WebGL is not available on this device/browser.');
    throw e;
  }

  const base = import.meta.env.BASE_URL || './';
  const [soldierUrl, hdrUrl] = await Promise.all([
    assetUrl(`${base}assets/`, 'Soldier.glb', 'glTF', (p) => menu.showLoading(p * 0.7)),
    assetUrl(`${base}assets/`, 'moonless_golf_1k.hdr', '#?').catch(() => null),
  ]);
  const [asset, env] = await Promise.all([
    loadCharacterAsset(soldierUrl, (p) => menu.showLoading(0.7 + p * 0.1)),
    hdrUrl ? new HDRLoader().loadAsync(hdrUrl).catch(() => null) : Promise.resolve(null),
  ]);
  menu.showLoading(0.85);
  let envMap: THREE.Texture | null = null;
  if (env) {
    const pm = new THREE.PMREMGenerator(game.renderer.renderer);
    envMap = pm.fromEquirectangular(env).texture;
    env.dispose();
    pm.dispose();
  }
  await new Promise((r) => setTimeout(r, 30));
  await game.load(asset, envMap);
  menu.showLoading(1);

  menu.onStart = () => {
    game.resetMission();
    game.start();
  };
  menu.onResume = () => game.resume();
  menu.onRestart = () => {
    game.resetMission();
    game.start();
  };
  menu.onRetry = () => game.retryFromCheckpoint();
  menu.onQuit = () => game.quitToMenu();
  menu.onSettings = (s) => {
    game.applySettings(s);
    saveSettings(s);
  };
  menu.onLanguage = () => game.refreshObjectives();
  game.onPause = () => menu.showPause();
  game.onEnd = (win, stats, rating) => menu.showEnd(win, stats, rating);

  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && game.mode === 'playing' && game.input.lastDevice === 'kbm') game.pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'playing') game.pause();
  });
  // clicking the view while playing re-captures the mouse
  canvas.addEventListener('click', () => {
    if (game.mode === 'playing' && !game.input.pointerLocked) game.input.requestLock();
  });

  menu.showMain();
  (window as any).__game = game;

  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      game.frame(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  console.error(e);
  const el = document.querySelector('.load-status');
  if (el) el.textContent = `Failed to start: ${e?.message ?? e}`;
});

export type { QualityName };
