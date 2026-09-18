import { Game } from './game.js';

const container = document.getElementById('app');
const game = new Game(container);
game.init().catch((e) => {
  console.error(e);
  const d = document.createElement('div'); d.className = 'fatal';
  d.textContent = 'Failed to start: ' + (e && e.message ? e.message : e);
  container.appendChild(d);
});
