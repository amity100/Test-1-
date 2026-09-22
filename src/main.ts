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
  const [asset, env] = await Promise.all([
    loadCharacterAsset(`${base}assets/Soldier.glb`, (p) => menu.showLoading(p * 0.8)),
    new HDRLoader().loadAsync(`${base}assets/moonless_golf_1k.hdr`).catch(() => null),
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
