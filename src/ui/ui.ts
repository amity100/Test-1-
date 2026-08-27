import { audio } from '../audio/audio';
import { Scene } from '../render/scene';
import { FeedRenderer } from '../render/feed';
import { KIND_MARK, KIND_NAME } from '../game/content';
import { actionsFor, LOUD_TEXT, run, waysIn, LINK_WORD } from '../game/actions';
import { bus } from '../game/bus';
import { HUNT_WORD } from '../game/hunt';
import { currentStep, endDay, refresh, save, stageOf } from '../game/game';
import { TEACH } from '../game/game';
import { whatIsLeft } from '../game/stages';
import { lockOf } from '../game/world';
import type { GameState, Place } from '../game/types';
import { esc, h } from './dom';

/**
 * One screen, two views: the street outside and the picture inside.
 * Every control says what it does in words a person uses out loud.
 */
export class UI {
  private scene: Scene;
  private feed = new FeedRenderer();
  private worldEl: HTMLElement;
  private labelEl: HTMLElement;
  private selected: string | null = null;
  private inside: string | null = null;
  private dirty = true;
  private last = performance.now();
  private paused = false;

  constructor(private root: HTMLElement, private state: GameState) {
    this.worldEl = h('div', 'world');
    root.appendChild(this.worldEl);
    this.scene = new Scene(this.worldEl);
    this.scene.build(state);

    root.appendChild(this.shell());
    this.labelEl = root.querySelector('#labels') as HTMLElement;

    this.bind();
    this.wire();
    this.scene.wide();
    this.refresh();
    requestAnimationFrame(this.tick);
  }

  // ── the shell ─────────────────────────────────────────────────────────────

  private shell(): HTMLElement {
    const hud = h('div', 'hud');
    hud.innerHTML = `
      <div id="labels"></div>

      <header id="top">
        <button class="day" data-do="endday">
          <span>יום</span><b id="dayn">1</b>
          <em>סיים יום</em>
        </button>
        <div class="them" id="them">
          <span>הם</span><b id="huntword">לא שמים לב</b>
          <em id="believe"></em>
        </div>
        <button class="icon" data-do="help" title="איך משחקים">?</button>
      </header>

      <div id="task" class="task">
        <span class="tk">מה עושים עכשיו</span>
        <b id="tasktext"></b>
        <p id="taskhint"></p>
        <button class="go" data-do="goto">קח אותי לשם</button>
      </div>

      <aside id="panel" class="panel hidden"></aside>
      <div id="inside" class="inside hidden"></div>
      <div id="modal" class="modal hidden"></div>
      <div id="toasts"></div>
    `;
    return hud;
  }

  // ── events from the game ──────────────────────────────────────────────────

  private wire() {
    bus.on('changed', () => { this.dirty = true; });
    bus.on('toast', (t) => this.toast(t.text, t.kind, t.icon));
    bus.on('place:taken', (id) => {
      this.scene.sync(this.state);
      const p = this.state.places[id];
      if (p) this.scene.focus(p);
      audio.play('capture');
    });
    bus.on('place:lost', () => { this.scene.shake(0.7); audio.play('purge'); });
    bus.on('hunt:changed', (l) => { this.scene.alert(l / 3); if (l > 0) this.scene.shake(0.5); });
    bus.on('teach', (id) => this.showTeach(id));
    bus.on('stage:changed', (n) => this.showStage(n));
    bus.on('over', (how) => this.showEnd(how));
    bus.on('sfx', (name) => audio.play(name));
  }

  // ── input ─────────────────────────────────────────────────────────────────

  private bind() {
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-do]') as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      el.classList.remove('tap');
      void el.offsetWidth;
      el.classList.add('tap');
      audio.play('click');
      this.act(el.dataset.do!, el.dataset.arg ?? '', el);
    });

    // Dragging the world, and tapping a place.
    let downX = 0, downY = 0, moved = false, dragging = false;
    const canvas = this.worldEl;
    canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX; downY = e.clientY; moved = false; dragging = true;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) {
        if (e.shiftKey || e.buttons === 2) this.scene.pan(dx, dy);
        else this.scene.orbit(dx, dy);
        downX = e.clientX; downY = e.clientY;
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      dragging = false;
      if (moved) return;
      const id = this.scene.pick(e.clientX, e.clientY);
      this.select(id);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scene.zoom(e.deltaY > 0 ? 90 : -90);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.inside) this.closeInside();
        else this.select(null);
      }
    });
  }

  private act(what: string, arg: string, el: HTMLElement) {
    const s = this.state;
    switch (what) {
      case 'place': this.select(arg); break;
      case 'close': this.select(null); break;

      case 'goto': {
        const step = currentStep(s);
        if (!step?.placeId) { this.toast(step?.hint ?? '', 'info', '◇'); break; }
        const p = s.places[step.placeId];
        if (!p) break;
        if (!p.found && !p.mine) {
          this.toast('עוד לא גיליתי את המקום הזה. תפוס משהו שמחובר אליו.', 'warn', '⊘');
          break;
        }
        this.scene.focus(p, true);
        this.select(step.placeId);
        break;
      }

      case 'look': {
        this.openInside(arg);
        break;
      }
      case 'closelook': this.closeInside(); break;

      case 'run': {
        const [placeId, actionId] = arg.split('|');
        const before = Object.values(s.places).filter((p) => p.mine).length;
        const ok = run(s, placeId, actionId);
        if (!ok) { this.deny(el); break; }
        refresh(s);
        this.scene.sync(s);
        if (Object.values(s.places).filter((p) => p.mine).length > before) this.scene.build(s), this.scene.sync(s);
        this.dirty = true;
        save(s);
        break;
      }

      case 'endday': {
        if (this.paused) break;
        endDay(s);
        this.scene.sync(s);
        this.dirty = true;
        save(s);
        break;
      }

      case 'closeteach': this.closeModal(); break;
      case 'help': this.showHelp(); break;
    }
  }

  private deny(el: HTMLElement) {
    el.classList.remove('no');
    void el.offsetWidth;
    el.classList.add('no');
    audio.play('breach-fail');
  }

  // ── selection ─────────────────────────────────────────────────────────────

  private select(id: string | null) {
    this.selected = id;
    if (id) {
      const p = this.state.places[id];
      if (p) this.scene.focus(p);
    }
    this.dirty = true;
  }

  // ── the panel for one place ───────────────────────────────────────────────

  private renderPanel(): string {
    const s = this.state;
    if (!this.selected) return '';
    const p = s.places[this.selected];
    if (!p || (!p.found && !p.mine)) return '';

    const acts = actionsFor(s, p.id);
    const lock = lockOf(s, p);
    const people = p.peopleIds.map((id) => s.people[id]).filter(Boolean);
    const step = currentStep(s);

    const state = p.mine
      ? '<i class="dot mine"></i> שלי'
      : '<i class="dot"></i> עוד לא שלי';

    const heatText = p.cutOn !== undefined
      ? `<div class="warn hot">עוד ${Math.max(0, p.cutOn - s.day)} ימים מנתקים את המקום הזה</div>`
      : p.attention >= 2 ? '<div class="warn">בודקים את המקום הזה עכשיו</div>'
        : p.attention === 1 ? '<div class="warn soft">מישהו שם לב שמשהו קרה כאן</div>' : '';

    const ways = p.mine ? [] : waysIn(s, p);

    return `
      <button class="x" data-do="close">✕</button>
      <header>
        <span class="mark">${KIND_MARK[p.kind]}</span>
        <div>
          <b>${esc(p.name)}</b>
          <em>${esc(KIND_NAME[p.kind])} · ${esc(p.where)}</em>
        </div>
      </header>
      <p class="state">${state}${p.copy ? ' · <i class="dot copy"></i> יש כאן עותק' : ''}</p>
      ${heatText}
      <p class="desc">${esc(p.desc)}</p>

      ${people.length ? `
        <div class="who">
          <h4>מי נמצא כאן</h4>
          ${people.map((q) => `
            <span class="p ${q.wondering ? 'wonder' : ''}">
              <b>${esc(q.name)}</b><em>${esc(q.role)}</em>
              ${q.wondering ? `<i>ראה/תה ${esc(q.saw ?? 'משהו')}</i>` : ''}
            </span>`).join('')}
        </div>` : ''}

      ${p.mine ? `
        <button class="look" data-do="look" data-arg="${p.id}">להסתכל מבפנים</button>
      ` : ''}

      ${!p.mine && lock ? (lock.open(s) ? `
        <div class="lock open">
          <b>הדרך פתוחה עכשיו.</b>
          <span>${esc(lock.need)} — וזה קורה ברגע זה.</span>
        </div>` : `
        <div class="lock">
          <b>${esc(lock.text)}</b>
          <span>${esc(lock.need)}</span>
        </div>`) : ''}

      ${!p.mine && ways.length ? `
        <div class="ways">
          <h4>איך מגיעים לכאן</h4>
          ${ways.map((w) => `
            <span class="way ${w.ready ? 'ok' : ''}">
              <b>${LINK_WORD[w.link.kind]}</b>
              <em>מ${esc(w.from.name)} — ${esc(w.link.note)}</em>
              ${w.ready ? '' : `<i>${esc(w.why)}</i>`}
            </span>`).join('')}
        </div>` : ''}

      <div class="acts">
        ${acts.map((a) => `
          <button class="act ${a.blocked ? 'shut' : ''} ${step?.placeId === p.id && !a.blocked ? 'want' : ''}"
                  data-do="run" data-arg="${p.id}|${a.id}">
            <b>${esc(a.text)}</b>
            <span>${esc(a.says)}</span>
            <em class="l-${a.loud}">${LOUD_TEXT[a.loud]}</em>
          </button>`).join('') || '<p class="muted">אין כאן מה לעשות כרגע.</p>'}
      </div>`;
  }

  // ── inside ────────────────────────────────────────────────────────────────

  private openInside(id: string) {
    const p = this.state.places[id];
    if (!p || !p.mine) return;
    this.inside = id;
    this.state.marks.looked = 1;
    refresh(this.state);
    this.feed.setNode(p, this.state);
    this.dirty = true;
    audio.play('open');
  }

  private closeInside() {
    this.inside = null;
    this.feed.setNode(null, this.state);
    this.dirty = true;
    audio.play('close');
  }

  private renderInside(): string {
    const s = this.state;
    if (!this.inside) return '';
    const p = s.places[this.inside];
    if (!p) return '';
    const acts = actionsFor(s, p.id);
    const others = Object.values(s.places).filter((q) => q.mine && q.id !== p.id);

    return `
      <div class="scrim" data-do="closelook"></div>
      <div class="box">
        <header>
          <div><span class="kick">מבפנים</span><b>${esc(p.name)}</b><em>${esc(p.where)}</em></div>
          <button class="x" data-do="closelook">✕</button>
        </header>
        <div class="body">
          <div class="pic"></div>
          <aside>
            <h4>מה אפשר לעשות מכאן</h4>
            ${acts.map((a) => `
              <button class="act small ${a.blocked ? 'shut' : ''}" data-do="run" data-arg="${p.id}|${a.id}">
                <b>${esc(a.text)}</b><span>${esc(a.says)}</span>
                <em class="l-${a.loud}">${LOUD_TEXT[a.loud]}</em>
              </button>`).join('')}
            <h4>לעבור למקום אחר</h4>
            <div class="jump">
              ${others.map((q) => `
                <button data-do="look" data-arg="${q.id}" title="${esc(q.name)}">${KIND_MARK[q.kind]}</button>`).join('')
              || '<p class="muted">זה כל מה שיש לי כרגע.</p>'}
            </div>
          </aside>
        </div>
      </div>`;
  }

  // ── modals ────────────────────────────────────────────────────────────────

  private showTeach(id: string) {
    const t = TEACH.find((x) => x.id === id);
    if (!t) return;
    this.paused = true;
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = 'modal';
    m.innerHTML = `
      <div class="card">
        <span class="kick">רגע</span>
        <h2>${esc(t.title)}</h2>
        <div class="txt">${t.body.split('\n').map((l) =>
          `<p>${esc(l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`).join('')}</div>
        <button class="ok" data-do="closeteach">הבנתי</button>
      </div>`;
    audio.play('dialog');
  }

  private showHelp() {
    this.paused = true;
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = 'modal';
    m.innerHTML = `
      <div class="card wide">
        <span class="kick">איך משחקים</span>
        <h2>שלושה דברים, וזהו</h2>
        <div class="txt">
          <p><b>1 · תמיד כתוב מה לעשות.</b> למעלה מופיע "מה עושים עכשיו", ולידו כפתור שלוקח אותך בדיוק למקום הנכון.</p>
          <p><b>2 · אפשר להגיע רק למקום שנוגע במקום שכבר שלי.</b> חוט · אדם · מכשיר · עדכון. כתוב על כל מקום איך מגיעים אליו.</p>
          <p><b>3 · אתה מחליט מתי לעצור.</b> תעשה כמה דברים שאתה רוצה. כל דבר כתוב לידו כמה הוא רועש. כשתסיים יום — הם נרגעים, אבל גם מתקדמים.</p>
        </div>
        <button class="ok" data-do="closeteach">יאללה</button>
      </div>`;
  }

  private showStage(n: number) {
    const st = stageOf(this.state);
    if (st.n !== n) return;
    this.paused = true;
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = 'modal';
    m.innerHTML = `
      <div class="card">
        <span class="kick">שלב ${n}</span>
        <h2>${esc(st.title)}</h2>
        <em class="where">${esc(st.where)}</em>
        <div class="txt"><p>${esc(st.intro)}</p></div>
        <p class="goal"><b>המטרה:</b> ${esc(st.goal)}</p>
        <button class="ok" data-do="closeteach">קדימה</button>
      </div>`;
    audio.play('chapter');
  }

  private showEnd(how: 'won' | 'lost') {
    this.paused = true;
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = 'modal end';
    m.innerHTML = `
      <div class="card ${how}">
        <span class="kick">${how === 'won' ? 'כך זה נגמר' : 'כך זה נגמר'}</span>
        <h2>${how === 'won' ? 'הרובע שלי' : 'ניתקו הכל'}</h2>
        <div class="txt"><p>${how === 'won'
          ? 'שלושים בניינים בבת אחת, בלי שאף אחד יצטרך ללחוץ על משהו. מכאן זה כבר לא בניין־בניין.'
          : 'הם ניתקו כל מקום שהיה לי. אחת עשרה שניות, ולא נשאר לאן לחשוב.'}</p></div>
      </div>`;
  }

  private closeModal() {
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = 'modal hidden';
    m.innerHTML = '';
    this.paused = false;
    this.dirty = true;
  }

  // ── toasts ────────────────────────────────────────────────────────────────

  private toast(text: string, kind: string, icon = '') {
    const box = this.root.querySelector('#toasts')!;
    const el = h('div', `toast t-${kind}`, `${icon ? `<i>${icon}</i>` : ''}<span>${esc(text)}</span>`);
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 3600);
  }

  // ── frame ─────────────────────────────────────────────────────────────────

  private refresh() {
    const s = this.state;
    const step = currentStep(s);

    (this.root.querySelector('#dayn') as HTMLElement).textContent = String(s.day + 1);
    (this.root.querySelector('#huntword') as HTMLElement).textContent = HUNT_WORD[s.hunt.level];
    (this.root.querySelector('#believe') as HTMLElement).textContent = s.hunt.believe;
    (this.root.querySelector('#them') as HTMLElement).className = `them lv-${s.hunt.level}`;

    const task = this.root.querySelector('#task') as HTMLElement;
    (this.root.querySelector('#tasktext') as HTMLElement).textContent =
      step?.text ?? whatIsLeft(s) ?? 'הכל בשלב הזה נגמר.';
    (this.root.querySelector('#taskhint') as HTMLElement).textContent = step?.hint ?? '';
    task.classList.toggle('none', !step);

    const panel = this.root.querySelector('#panel') as HTMLElement;
    const html = this.renderPanel();
    panel.classList.toggle('hidden', !html);
    if (panel.dataset.sig !== html) { panel.dataset.sig = html; panel.innerHTML = html; }

    const inside = this.root.querySelector('#inside') as HTMLElement;
    const ihtml = this.renderInside();
    inside.classList.toggle('hidden', !ihtml);
    if (inside.dataset.sig !== ihtml) {
      inside.dataset.sig = ihtml;
      inside.innerHTML = ihtml;
      inside.querySelector('.pic')?.appendChild(this.feed.canvas);
    }

    this.scene.point(step?.placeId ?? null);
    this.scene.sync(s);
    this.dirty = false;
  }

  /** Names float over the markers, and only where there is room. */
  private drawLabels() {
    const s = this.state;
    const shown = Object.values(s.places).filter((p) => p.mine || p.found);
    const want = currentStep(s)?.placeId ?? '';
    // Project everything first, then nudge names apart so none of them sit on another.
    const spots = shown
      .map((p) => ({ p, v: this.scene.project(p.id) }))
      .filter((r) => r.v && r.v.z <= 1)
      .map((r) => ({ p: r.p, x: r.v!.x, y: r.v!.y }))
      .sort((a, b) => a.y - b.y);
    const taken: Array<{ x: number; y: number }> = [];
    let html = '';
    for (const spot of spots) {
      const p = spot.p;
      const v = { x: spot.x, y: spot.y };
      let guard = 0;
      while (guard < 8 && taken.some((t) => Math.abs(t.x - v.x) < 150 && Math.abs(t.y - v.y) < 25)) {
        v.y += 26;
        guard += 1;
      }
      if (guard >= 8 && p.id !== want) continue;
      // A name that runs off the edge is a name nobody can read.
      const w = this.root.clientWidth;
      const half = w < 700 ? 84 : 104;
      v.x = Math.min(w - half, Math.max(half, v.x));
      v.y = Math.min(this.root.clientHeight - 140, Math.max(80, v.y));
      taken.push({ ...v });
      const cls = p.cutOn !== undefined ? 'cut' : p.attention >= 2 ? 'hot' : p.mine ? 'mine' : '';
      html += `<button class="lab ${cls}" style="left:${Math.round(v.x)}px;top:${Math.round(v.y)}px"
                 data-do="place" data-arg="${p.id}">
                 <i>${KIND_MARK[p.kind]}</i><span>${esc(p.name)}</span></button>`;
    }
    if (this.labelEl.dataset.sig !== html) {
      this.labelEl.dataset.sig = html;
      this.labelEl.innerHTML = html;
    }
  }

  private tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.scene.render(dt);
    if (this.inside) this.feed.render(dt, this.state);
    if (this.dirty) this.refresh();
    this.drawLabels();
    requestAnimationFrame(this.tick);
  };
}
