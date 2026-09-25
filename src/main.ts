import './ui/style.css';
import { defaultQuality, IS_TOUCH, QualityName } from './config';
import { Game, Settings } from './game/game';
import { loadAnimLibrary, parseCharacterAsset } from './game/characters';
import { Menu } from './ui/menu';
import { setWorldStrings, t } from './ui/i18n';
import type { ZoneId } from './core/contracts';
import { readWorld, saveWorld, WORLDS, type WorldId } from './world/worlds';

/** A world's own texts (Halcyon's names for the pier's places); the harbour's are the base strings. */
const useWorldStrings = (w: WorldId) => setWorldStrings(w === 'harbour' ? '' : w);

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
 * Loads a binary asset as bytes. Prefers the raw file; when the host can't
 * serve that type, falls back to a base64 JSON pack of it. Bytes are parsed
 * in memory (no blob: URLs, which sandboxed hosts may block).
 */
async function assetBytes(dir: string, name: string, magic: string): Promise<ArrayBuffer> {
  try {
    const r = await fetch(dir + name);
    if (r.ok) {
      const buf = await r.arrayBuffer();
      const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(4, buf.byteLength)));
      if (head.startsWith(magic)) return buf;
    }
  } catch {}
  const r = await fetch(dir + name + '.json');
  if (!r.ok) throw new Error(`Missing asset ${name}`);
  const j = await r.json();
  const bin = atob(j.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
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
  let world = readWorld();
  useWorldStrings(world);
  const menu = new Menu(ui, settings);
  menu.worlds = WORLDS;
  menu.world = world;
  menu.showLoading(0);

  let game: Game;
  try {
    game = new Game(canvas, ui, settings);
  } catch (e) {
    menu.fatal('WebGL is not available on this device/browser.');
    throw e;
  }

  const base = import.meta.env.BASE_URL || './';
  const [soldierBuf, animsJson] = await Promise.all([
    assetBytes(`${base}assets/`, 'Soldier.glb', 'glTF'),
    fetch(`${base}assets/anims.json`).then((r) => {
      if (!r.ok) throw new Error('Missing asset anims.json');
      return r.json();
    }),
  ]);
  menu.showLoading(0.6);
  const asset = await parseCharacterAsset(soldierBuf);
  const anims = loadAnimLibrary(animsJson, asset);
  menu.showLoading(0.8);
  await new Promise((r) => setTimeout(r, 30));
  try {
    await game.load(asset, anims, world);
  } catch (e) {
    if (world === 'harbour') throw e;
    // a world this device can't build falls back to the harbour, and the pick is forgotten
    // (else every reload would fail again before the WORLD toggle could be reached)
    console.error(e);
    world = 'harbour';
    saveWorld(world);
    useWorldStrings(world);
    menu.world = world;
    await game.load(asset, anims, world);
  }
  menu.showLoading(1);

  const m = menu as any;
  const ORDER: ZoneId[] = ['pier', 'yard', 'skeleton', 'lab', 'crown'];
  const refreshProgress = () => {
    // (another world is mission 1 alone: no zones to continue from or pick)
    menu.singleZone = game.world !== 'harbour';
    if (menu.singleZone) {
      menu.setProgress({ continueZone: null, unlocked: ['pier'] });
      return;
    }
    const saved = Game.savedZone();
    const idx = saved ? ORDER.indexOf(saved) : 0;
    menu.setProgress({ continueZone: saved && idx > 0 ? saved : null, unlocked: ORDER.slice(0, Math.max(1, idx + 1)) });
  };
  refreshProgress();
  menu.onStart = () => {
    game.newRun();
    game.start();
  };
  m.onContinue = () => {
    game.startAtZone((Game.savedZone() ?? 'pier') as ZoneId);
    game.start();
  };
  m.onZone = (z: ZoneId) => {
    game.startAtZone(z);
    game.start();
  };
  m.onChallenges = () => {
    const items = [game.challenges.daily(), ...game.challenges.list()].map((c: any) => ({
      id: c.id,
      title: game.challengeText(c.id).title,
      desc: game.challengeText(c.id).desc,
      done: game.challenges.completed().has(c.id),
      progress: (() => {
        const p = game.challenges.progress(c.id) as any;
        return p && !p.done && p.goal > 1 ? `${p.count}/${p.goal}` : undefined;
      })(),
    }));
    m.showChallenges?.(items);
  };
  menu.onResume = () => game.resume();
  menu.onPhoto = () => game.photoFromPause();
  // gamepad Start while paused resumes (the menu itself is pointer / touch driven)
  game.onResumeKey = () => {
    menu.hide();
    game.resume();
  };
  menu.onRestart = () => {
    game.newRun();
    game.start();
  };
  menu.onRetry = () => game.retryFromCheckpoint();
  menu.onQuit = () => {
    game.quitToMenu();
    refreshProgress();
  };
  menu.onSettings = (s: Settings) => {
    game.applySettings(s);
    saveSettings(s);
  };
  menu.onLanguage = () => game.refreshObjectives();
  // WORLD: the level is rebuilt in place (no reload: sandboxed hosts may block navigation and storage)
  menu.onWorld = async (w: WorldId) => {
    const prev = game.world;
    if (w === prev) return;
    useWorldStrings(w);
    menu.world = w;
    menu.showLoading(0.5);
    // (let the loading screen paint before the build blocks the thread)
    await new Promise((r) => setTimeout(r, 40));
    try {
      game.setWorld(w);
      // (saved only once it's built: a pick that can't be built isn't the one a reload tries)
      saveWorld(w);
    } catch (e) {
      console.error(e);
      // back to the world that was working, its texts too
      useWorldStrings(prev);
      menu.world = prev;
      try {
        game.setWorld(prev);
      } catch (e2) {
        console.error(e2);
        menu.fatal(`Failed to build the world: ${(e as Error)?.message ?? e}`);
        return;
      }
    }
    menu.showLoading(1);
    refreshProgress();
    menu.showMain();
  };
  game.onPause = () => menu.showPause();
  game.onEnd = (win, stats, rank) => (menu as any).showEnd(win, stats, rank);
  game.onClip = (blob, share, close) => {
    if (!m.showClip || !blob) {
      close();
      return;
    }
    const url = URL.createObjectURL(blob);
    m.showClip({
      saving: false,
      previewUrl: url,
      onShare: share,
      onDownload: () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `threshold-clip.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
      onClose: () => {
        m.hideClip();
        URL.revokeObjectURL(url);
        close();
      },
    });
  };

  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && game.mode === 'playing' && game.input.lastDevice === 'kbm') game.pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'playing') game.pause();
  });
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
