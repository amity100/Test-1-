// (ROADMAP 6.6, not with ?classic) The weapon wheel. Hold Tab (on a phone: hold the swap button):
// every weapon you carry round a ring over the picture, and time slows right down; point at one
// (the mouse, or a finger) and let go to take it.

const SLOW = 0.25; // how fast the city goes on while it is open
const R = 150; // the ring's radius (pixels)

export class Wheel {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.el = document.getElementById('wheel');
    this.nameEl = document.getElementById('wheel-name');
    this.ammoEl = document.getElementById('wheel-ammo');
    this.items = [];
    this.px = 0;
    this.py = 0;
    this.pick = -1;
    this.stats = { opened: 0, taken: 0 };
    // (a phone: hold the swap button, slide to one, let go)
    const swap = document.getElementById('btn-swap');
    if (swap && game.touch) {
      let t = null;
      swap.addEventListener('touchstart', () => {
        clearTimeout(t);
        t = setTimeout(() => this.show(), 420);
      });
      const up = (take) => {
        clearTimeout(t);
        if (this.open) this.hide(take);
      };
      swap.addEventListener('touchend', () => up(true));
      swap.addEventListener('touchcancel', () => up(false));
      document.addEventListener('touchmove', (e) => {
        if (!this.open || !e.touches.length) return;
        const r = this.el.getBoundingClientRect();
        this.point(e.touches[0].clientX - (r.left + r.width / 2), e.touches[0].clientY - (r.top + r.height / 2));
      }, { passive: true });
    }
  }

  // the city's time while it is open (game/game.js)
  get slow() {
    return this.open ? SLOW : 1;
  }

  update() {
    const game = this.game;
    if (game.touch) return;
    const want = game.input.keys.has('Tab') && game.state === 'play' && game.player.mode === 'foot' && !game.airdraw.open && !game.dialog.open;
    if (want && !this.open) this.show();
    else if (!want && this.open) this.hide(true);
  }

  // the mouse while it is open (game/game.js gives it what would have turned the camera)
  look(dx, dy) {
    this.point(this.px + dx, this.py + dy);
  }

  point(x, y) {
    const d = Math.hypot(x, y);
    // (no further than the ring)
    const k = d > R ? R / d : 1;
    this.px = x * k;
    this.py = y * k;
    if (d < 28) return;
    const n = this.items.length;
    // (the first at the top, round clockwise)
    const a = (Math.atan2(this.py, this.px) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    this.choose(Math.round((a / (Math.PI * 2)) * n) % n);
  }

  choose(i) {
    if (i === this.pick) return;
    if (this.items[this.pick]) this.items[this.pick].classList.remove('on');
    this.pick = i;
    const it = this.items[i];
    if (!it) return;
    it.classList.add('on');
    const s = this.game.weapons.slots[i];
    this.nameEl.textContent = s.def.name;
    this.ammoEl.textContent = this.ammoOf(s);
    this.game.audio.play('click', 0.25);
  }

  ammoOf(s) {
    const A = this.game.arsenal;
    if (s.ammo === Infinity || s.ammo === undefined) return s.uses !== undefined ? `${s.uses} מחיקות` : '';
    return (A && A.ammoText(s)) || `${Math.ceil(s.ammo)}`;
  }

  show() {
    const game = this.game;
    if (this.open || !this.el) return;
    this.open = true;
    this.stats.opened++;
    const W = game.weapons;
    const n = W.slots.length;
    this.el.querySelectorAll('.wheel-item').forEach((e) => e.remove());
    this.items = W.slots.map((s, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const it = document.createElement('div');
      it.className = 'wheel-item';
      it.style.transform = `translate(${Math.cos(a) * R}px, ${Math.sin(a) * R}px)`;
      const c = document.createElement('canvas');
      c.width = 120;
      c.height = 72;
      game.hud.drawIcon(c.getContext('2d'), s, c.width, c.height);
      it.appendChild(c);
      this.el.appendChild(it);
      return it;
    });
    this.pick = -1;
    this.px = 0;
    this.py = 0;
    this.choose(W.index);
    this.el.classList.remove('hidden');
  }

  hide(take) {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    const W = this.game.weapons;
    if (take && this.pick >= 0 && this.pick < W.slots.length && this.pick !== W.index) {
      W.select(this.pick);
      this.stats.taken++;
    }
  }
}
