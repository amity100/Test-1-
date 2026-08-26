import './style.css';
import { audio } from './audio/audio';
import { bus } from './game/bus';
import { clearSave, createGame, loadGame, saveGame } from './game/state';
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

const loaded = loadGame();
if (!loaded) clearSave();
let state: GameState = loaded ?? createGame();
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
    !!loaded,
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
    // A save that failed to carry its story is re-seeded rather than left empty.
    const needsStory = fresh || state.objectives.length === 0;
    game = new Game(state, needsStory);
    ui = new UI(app, game, world, screens);
    mountWorld(state, 'tlv');
    ui.rebuildMarkers();
    // Open tight on the tower you woke up in, then ease out to working distance —
    // the first thing the player should understand is where they are.
    const core = state.nodes.nd_helios_core;
    world.focus(core.x, core.z, 230);
    setTimeout(() => world.focus(core.x, core.z, 420), 1400);
    game.setSpeed(1);
    bus.emit('state:changed', undefined);
    if (!fresh && !state.flags.seenHelp) setTimeout(() => ui?.showHelp(), 500);
    if (needsStory) {
      setTimeout(() => openDialog(state, 'awakening'), 900);
    } else if (state.pendingDialog) {
      // Resume a beat the player was mid-way through when they last closed the tab.
      const pending = state.pendingDialog;
      setTimeout(() => openDialog(state, pending), 400);
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
window.addEventListener('beforeunload', () => {
  if (game && !state.ending && !state.pendingDialog) saveGame(state);
});

showTitle();
