import { audio } from './audio/audio';
import { bus } from './game/bus';
import { clearSave, load, newGame, save } from './game/game';
import { UI } from './ui/ui';
import { Screens } from './ui/screens';
import './style.css';

const app = document.getElementById('app')!;

// The splash in index.html is there for the second before this file runs. Nothing
// used to take it away, so it sat at the top of every screen that followed —
// and on a short phone it pushed the button you needed off the bottom.
document.getElementById('boot-screen')?.remove();

function boot(fresh: boolean) {
  const state = fresh ? newGame(String(Date.now())) : (load() ?? newGame());
  app.innerHTML = '';
  const ui = new UI(app, state);
  void ui;
  save(state);
  bus.on('over', () => clearSave());
}

const screens = new Screens(app);
const saved = load();

screens.title(!!saved, () => {
  clearSave();
  screens.intro(() => screens.goalCard(() => boot(true)));
}, () => boot(false));

window.addEventListener('pointerdown', () => audio.resume(), { once: true });
