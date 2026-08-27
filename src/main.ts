import { audio } from './audio/audio';
import { bus } from './game/bus';
import { clearSave, load, newGame, refresh, save } from './game/game';
import { UI } from './ui/ui';
import { Screens } from './ui/screens';
import './style.css';

const app = document.getElementById('app')!;

function boot(fresh: boolean) {
  const state = fresh ? newGame() : (load() ?? newGame());
  app.innerHTML = '';
  refresh(state);
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
