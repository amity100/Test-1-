// Conversation box (Hebrew UI): who is talking, what they say, numbered answers.
// Pick with the mouse or the number keys.

const $ = (id) => document.getElementById(id);

export class Dialog {
  constructor(game) {
    this.game = game;
    this.el = $('dialog');
    this.whoEl = this.el.querySelector('.who');
    this.textEl = this.el.querySelector('.text');
    this.choicesEl = this.el.querySelector('.choices');
    this.choices = [];
    this.isOpen = false;
  }

  get open() {
    return this.isOpen;
  }

  // choices: [{ label, fn }]; with none, a single "continue" closes it
  show(who, text, choices = null) {
    const game = this.game;
    this.choices = choices && choices.length ? choices : [{ label: 'המשך', fn: null }];
    this.whoEl.textContent = who || '';
    this.textEl.textContent = text;
    this.choicesEl.innerHTML = '';
    this.choices.forEach((c, i) => {
      const b = document.createElement('button');
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = `${i + 1}.`;
      b.appendChild(k);
      b.appendChild(document.createTextNode(` ${c.label}`));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pick(i, true);
      });
      this.choicesEl.appendChild(b);
    });
    this.el.classList.remove('hidden');
    if (!this.isOpen) {
      this.isOpen = true;
      if (!game.touch) game.input.releaseLock();
    }
  }

  pick(i, gesture = false) {
    const c = this.choices[i];
    if (!c) return;
    this.game.audio.play('click');
    if (c.fn) {
      // the handler may open the next line of the conversation
      this.closeQuiet();
      c.fn();
      if (!this.isOpen && !this.game.touch && gesture) this.game.input.requestLock(true);
    } else this.close(gesture);
  }

  closeQuiet() {
    this.el.classList.add('hidden');
    this.isOpen = false;
    this.closedAt = performance.now();
  }

  // a pointer-lock hiccup right after closing is not a reason to pause the game
  get justClosed() {
    return performance.now() - (this.closedAt || -1e9) < 1500;
  }

  close(gesture = false) {
    this.closeQuiet();
    if (!this.game.touch) this.game.input.requestLock(gesture);
  }

  // number keys pick an answer
  update() {
    if (!this.isOpen) return;
    const input = this.game.input;
    for (let k = 1; k <= this.choices.length && k <= 9; k++) {
      if (input.wasPressed(`Digit${k}`) || input.wasPressed(`Numpad${k}`)) {
        this.pick(k - 1, true);
        return;
      }
    }
    if (input.wasPressed('Escape')) this.close(true);
  }
}
