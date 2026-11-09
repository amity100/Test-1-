// (v5, ROADMAP 11.17) Talking with the friend you drew (game/friend.js): a page of the notebook
// with what she says and what you say - typed, or one of the little cards under it - and her
// hearts at the top. The game goes on round it (she stands with you); its keys wait while you type.

export class ChatPanel {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.onSend = null;
    this.onClose = null;
    const el = document.createElement('div');
    el.id = 'chat';
    el.className = 'paper-card hidden';
    el.dir = 'rtl';
    el.innerHTML =
      '<div class="chat-head"><span class="chat-name"></span><span class="chat-love"></span><button class="chat-x" type="button" aria-label="סגירה">✕</button></div>' +
      '<div class="chat-log"></div>' +
      '<div class="chat-chips"></div>' +
      '<form class="chat-form" autocomplete="off"><input class="chat-in" type="text" maxlength="240" enterkeyhint="send" placeholder="לכתוב לה משהו..."><button class="chat-send" type="submit">שליחה</button></form>';
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    this.nameEl = el.querySelector('.chat-name');
    this.loveEl = el.querySelector('.chat-love');
    this.logEl = el.querySelector('.chat-log');
    this.chipsEl = el.querySelector('.chat-chips');
    this.inEl = el.querySelector('.chat-in');
    el.querySelector('.chat-x').addEventListener('click', (e) => {
      e.stopPropagation();
      this.close(true);
    });
    el.querySelector('.chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = this.inEl.value.trim();
      if (!t || this.busy) return;
      this.inEl.value = '';
      if (this.onSend) this.onSend(t);
    });
    // (the game's keys are not the conversation's: Escape closes, the rest is typing)
    this.inEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.close(true);
    });
    for (const ev of ['mousedown', 'touchstart', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  get open() {
    return this.isOpen;
  }

  show(name, love) {
    this.nameEl.textContent = name;
    this.setLove(love);
    this.el.classList.remove('hidden');
    document.body.classList.add('chatting');
    if (!this.isOpen) {
      this.isOpen = true;
      const g = this.game;
      if (!g.touch) g.input.releaseLock();
      // (on a computer the cursor is in the box at once; on a phone the keyboard waits for a tap)
      if (!g.touch) setTimeout(() => this.isOpen && this.inEl.focus(), 60);
    }
  }

  setLove(love) {
    const n = Math.max(0, Math.min(5, Math.round((love || 0) / 20)));
    this.loveEl.textContent = '♥'.repeat(n) + '♡'.repeat(5 - n);
  }

  close(gesture = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('chatting');
    this.inEl.blur();
    this.chips([]);
    const g = this.game;
    if (!g.touch) g.input.requestLock(gesture);
    if (this.onClose) this.onClose();
  }

  clear() {
    this.logEl.innerHTML = '';
  }

  // a line of the conversation: who is 'me', 'her' or 'note'; returns its element (to write into
  // while her answer comes)
  add(who, text) {
    const d = document.createElement('div');
    d.className = `chat-line chat-${who}`;
    d.textContent = text;
    this.logEl.appendChild(d);
    while (this.logEl.children.length > 40) this.logEl.removeChild(this.logEl.firstChild);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    return d;
  }

  write(line, text) {
    line.textContent = text;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  // the little cards under the conversation: [{ label, fn }]
  chips(list) {
    this.chipsEl.innerHTML = '';
    for (const c of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-chip';
      b.textContent = c.label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.busy && !c.always) return;
        this.game.audio.play('click', 0.5);
        c.fn();
      });
      this.chipsEl.appendChild(b);
    }
  }

  // while she is answering: the box waits
  setBusy(on) {
    this.busy = on;
    this.el.classList.toggle('busy', on);
  }

  // (game.js: the keys while it is open - Escape closes it when the box is not being typed in)
  update() {
    const input = this.game.input;
    if (document.activeElement !== this.inEl && input.wasPressed('Escape')) this.close(true);
  }
}
