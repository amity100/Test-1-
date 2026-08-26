import './style.css';
import { audio } from './audio/audio';
import { bus } from './game/bus';
import { createGame, hasSave, loadGame, saveGame } from './game/state';
import { openDialog } from './game/story';
import { Game } from './game/sim';
import type { GameState } from './game/types';
import { WorldView } from './render/world3d';
import { Screens } from './ui/screens';
import { UI } from './ui/ui';

const app = document.getElementById('app')!;
app.innerHTML = '';

const worldHost = document.createElement('div');
worldHost.id = 'world';
app.appendChild(worldHost);

const world = new WorldView(worldHost);
const screens = new Screens(app);

let state: GameState = loadGame() ?? createGame();
let game: Game | null = null;
let ui: UI | null = null;
let cinematic = true;

function mountWorld(s: GameState, regionId = 'tlv') {
  world.regionId = regionId;
  world.buildCity(s, regionId);
  world.buildCountry(s);
  world.refreshMarkers(s);
  world.setMode('city');
  const d = s.districts.ramat_hahayal;
  world.focus(d.cx, d.cz, 980);
}

mountWorld(state);

function showTitle() {
  cinematic = true;
  world.focus(220, -240, 1500);
  screens.title(
    hasSave(),
    () => beginRun(true),
    () => beginRun(false),
  );
}

function beginRun(fresh: boolean) {
  audio.start();
  audio.resume();
  if (fresh) state = createGame();
  screens.clear();

  const boot = () => {
    cinematic = false;
    game = new Game(state, fresh);
    ui = new UI(app, game, world, screens);
    mountWorld(state, 'tlv');
    ui.rebuildMarkers();
    const d = state.districts.ramat_hahayal;
    world.focus(d.cx, d.cz, 620);
    game.setSpeed(1);
    bus.emit('state:changed', undefined);
    if (!fresh && !state.flags.seenHelp) setTimeout(() => ui?.showHelp(), 500);
    if (fresh) {
      setTimeout(() => openDialog(state, 'awakening'), 900);
    }
  };

  if (fresh) screens.intro(boot);
  else boot();
}

// ── main loop ───────────────────────────────────────────────────────────────

let last = performance.now();
let elapsed = 0;

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  if (cinematic) {
    world.orbit(-0.32, 0);
  }

  game?.update(dt);
  world.update(dt, state);
  ui?.update(dt, elapsed);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

window.addEventListener('pointerdown', () => audio.resume(), { once: true });
window.addEventListener('beforeunload', () => { if (game && !state.ending) saveGame(state); });

showTitle();
