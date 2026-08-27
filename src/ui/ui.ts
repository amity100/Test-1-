import { audio } from '../audio/audio';
import { World } from '../render/world';
import { KIND_NAME } from '../game/content';
import {
  actionsFor, LINK_SAYS, LINK_WORD, LOUD_SAYS, LOUD_TEXT, run, waysIn,
} from '../game/actions';
import { bus } from '../game/bus';
import { HUNT_WORD } from '../game/hunt';
import { TEACH, currentStep, endDay, refresh, save, stageOf } from '../game/game';
import { whatIsLeft } from '../game/stages';
import { lockOf } from '../game/world';
import type { GameState } from '../game/types';
import { esc, h } from './dom';

/**
 * Almost nothing is on top of the world: the day, what to do now, and — when
 * you touch something — a low card with what you can do to it. Everything else
 * you look at by flying there.
 */
export class UI {
  private world: World;
  private worldEl: HTMLElement;
  private selected: string | null = null;
  private hovered: string | null = null;
  private dirty = true;
  private last = performance.now();
  private paused = false;

  constructor(private root: HTMLElement, private state: GameState) {
    this.worldEl = h('div', 'world');
    root.appendChild(this.worldEl);
    this.world = new World(this.worldEl);
    this.world.build(state);
    this.world.sync(state);

    root.appendChild(this.shell());
    this.bind();
    this.wire();
    this.world.wide();
    this.refresh();
    requestAnimationFrame(this.tick);
  }

  private shell(): HTMLElement {
    const hud = h('div', 'hud');
    hud.innerHTML = `
      <div id="tags"></div>

      <header id="top">
        <button class="day" data-do="endday">
          <span>יום</span><b id="dayn">1</b><em>לסיים את היום</em>
        </button>
        <div class="them" id="them">
          <span>הם</span><b id="huntword"></b><em id="believe"></em>
        </div>
        <button class="icon" data-do="wide" title="לראות את כל הרובע">⤢</button>
        <button class="icon" data-do="help" title="איך משחקים">?</button>
      </header>

      <div id="task" class="task">
        <span class="tk">מה עושים עכשיו</span>
        <b id="tasktext"></b>
        <p id="taskhint"></p>
        <button class="go" data-do="goto">קחו אותי לשם</button>
      </div>

      <div id="card" class="card-wrap hidden"></div>
      <div id="modal" class="modal hidden"></div>
      <div id="toasts"></div>
    `;
    return hud;
  }

  private wire() {
    bus.on('changed', () => { this.dirty = true; });
    bus.on('toast', (t) => this.toast(t.text, t.kind, t.icon));
    bus.on('place:taken', (id) => {
      this.world.sync(this.state);
      const p = this.state.places[id];
      if (p) this.world.goTo(p, true);
      audio.play('capture');
    });
    bus.on('place:lost', () => { this.world.shake(0.8); audio.play('purge'); });
    bus.on('hunt:changed', (l) => { this.world.alert(l / 3); if (l > 0) this.world.shake(0.5); });
    bus.on('teach', (id) => this.showTeach(id));
    bus.on('stage:changed', (n) => this.showStage(n));
    bus.on('over', (how) => this.showEnd(how));
    bus.on('sfx', (name) => audio.play(name));
  }

  // ── touching the world ────────────────────────────────────────────────────

  private bind() {
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-do]') as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      el.classList.remove('tap'); void el.offsetWidth; el.classList.add('tap');
      audio.play('click');
      this.act(el.dataset.do!, el.dataset.arg ?? '', el);
    });

    const c = this.worldEl;
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = false;
    let pinch = 0;

    c.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      c.setPointerCapture(e.pointerId);
    });

    c.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        // Not dragging: light up whatever is under the cursor.
        const id = this.world.pick(e.clientX, e.clientY);
        if (id !== this.hovered) { this.hovered = id; this.dirty = true; }
        c.style.cursor = id ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;

      if (pointers.size >= 2) {
        const pts = Array.from(pointers.values());
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinch) this.world.zoom((pinch - d) * 4);
        pinch = d;
        return;
      }
      if (e.shiftKey || e.buttons === 4) this.world.pan(dx, dy);
      else this.world.orbit(dx, dy);
    });

    const up = (e: PointerEvent) => {
      const had = pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!had || moved) return;
      const id = this.world.pick(e.clientX, e.clientY);
      this.select(id);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinch = 0; });

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.world.zoom(e.deltaY);
    }, { passive: false });

    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Escape': this.select(null); break;
        case 'ArrowUp': case 'w': this.world.lift(4.2); break;
        case 'ArrowDown': case 's': this.world.lift(-4.2); break;
        default: break;
      }
    });
  }

  private act(what: string, arg: string, el: HTMLElement) {
    const s = this.state;
    switch (what) {
      case 'place': this.select(arg); break;
      case 'close': this.select(null); break;
      case 'wide': this.world.wide(); this.select(null); break;

      case 'goto': {
        const step = currentStep(s);
        if (!step?.placeId) { this.toast(step?.hint ?? '', 'info', '◇'); break; }
        const p = s.places[step.placeId];
        if (!p) break;
        if (!p.found && !p.mine) {
          this.toast('עוד לא מצאתי את המקום הזה. תפסו משהו שמחובר אליו והוא יתגלה.', 'warn', '⊘');
          break;
        }
        this.world.goTo(p, true);
        this.select(step.placeId);
        break;
      }

      case 'run': {
        const [placeId, actionId] = arg.split('|');
        const ok = run(s, placeId, actionId);
        if (!ok) {
          el.classList.remove('no'); void el.offsetWidth; el.classList.add('no');
          audio.play('deny');
          break;
        }
        refresh(s);
        this.world.build(s);
        this.world.sync(s);
        this.dirty = true;
        save(s);
        break;
      }

      case 'endday': {
        if (this.paused) break;
        endDay(s);
        this.world.sync(s);
        this.dirty = true;
        save(s);
        break;
      }

      case 'closeteach': this.closeModal(); break;
      case 'help': this.showHelp(); break;
    }
  }

  private select(id: string | null) {
    this.selected = id;
    if (id) {
      const p = this.state.places[id];
      if (p && (p.mine || p.found)) {
        this.world.goTo(p, true);
        // Flying up to something of yours and looking at it IS looking inside.
        if (p.mine && !this.state.marks.looked) {
          this.state.marks.looked = 1;
          refresh(this.state);
        }
      }
    }
    this.dirty = true;
  }

  // ── the card for whatever you touched ─────────────────────────────────────

  private renderCard(): string {
    const s = this.state;
    if (!this.selected) return '';
    const p = s.places[this.selected];
    if (!p || (!p.found && !p.mine)) return '';

    const acts = actionsFor(s, p.id);
    const lock = lockOf(s, p);
    const people = p.peopleIds.map((id) => s.people[id]).filter(Boolean);
    const step = currentStep(s);
    const ways = p.mine ? [] : waysIn(s, p);

    const heat = p.cutOn !== undefined
      ? `<p class="line hot">מנתקים את זה בעוד ${Math.max(1, p.cutOn - s.day)} ימים. אם לא יהיה כאן חלק ממני — אאבד את המקום.</p>`
      : p.attention >= 2 ? '<p class="line warn">מסתכלים לכאן עכשיו.</p>'
        : p.attention === 1 ? '<p class="line soft">מישהו הרגיש שמשהו קרה כאן.</p>' : '';

    return `
      <div class="card">
        <button class="x" data-do="close">✕</button>
        <header>
          <b>${esc(p.name)}</b>
          <em>${esc(KIND_NAME[p.kind])} · ${esc(p.where)}${p.mine ? ' · שלי' : ''}${p.copy ? ' · יש כאן חלק ממני' : ''}</em>
        </header>
        ${heat}
        <p class="desc">${esc(p.desc)}</p>
        ${people.length ? `<p class="line who">${people.map((q) =>
          `<b>${esc(q.name)}</b>${q.wondering ? ` — לא מצליח/ה להסביר לעצמו/ה ${esc(q.saw ?? 'משהו')}` : ` · ${esc(q.role)}`}`,
        ).join(' · ')}</p>` : ''}

        ${!p.mine && lock ? (lock.open(s)
          ? `<p class="line open">${esc(lock.need)} — וזה קורה ברגע זה.</p>`
          : `<p class="line shut"><b>${esc(lock.text)}</b> ${esc(lock.need)}</p>`) : ''}

        ${!p.mine && ways.length ? `<div class="ways">${ways.map((w) => `
          <span class="way ${w.ready ? 'ok' : ''}">
            <i>${LINK_WORD[w.link.kind]}</i>
            <em>מ${esc(w.from.name)} · ${esc(w.link.note)}</em>
            ${w.ready ? '' : `<u>${esc(w.why)}</u>`}
          </span>`).join('')}</div>` : ''}

        <div class="acts">
          ${acts.map((a) => `
            <button class="act ${a.blocked ? 'shut' : ''} ${step?.placeId === p.id && !a.blocked ? 'want' : ''}"
                    data-do="run" data-arg="${p.id}|${a.id}" title="${esc(LOUD_SAYS[a.loud])}">
              <b>${esc(a.text)}</b>
              <span>${esc(a.says)}</span>
              <em class="l-${a.loud}">${LOUD_TEXT[a.loud]}</em>
            </button>`).join('') || '<p class="muted">אין כאן מה לעשות כרגע.</p>'}
        </div>
      </div>`;
  }

  // ── names floating over the world, one at a time ──────────────────────────

  private drawTags() {
    const s = this.state;
    const want = currentStep(s)?.placeId ?? null;

    // Up close you see the names of everything around you. From above the city
    // stays clean: only the one the game is pointing at, and whatever you touch.
    const near = this.world.near;
    const ids = new Set<string>();
    if (want) ids.add(want);
    if (this.hovered) ids.add(this.hovered);
    if (this.selected) ids.add(this.selected);
    if (near) for (const p of Object.values(s.places)) if (p.mine || p.found) ids.add(p.id);

    const spots: Array<{ id: string; x: number; y: number; z: number }> = [];
    for (const id of ids) {
      const p = s.places[id];
      if (!p || (!p.mine && !p.found)) continue;
      const v = this.world.project(id);
      if (!v || v.z > 1) continue;
      spots.push({ id, ...v });
    }
    // Nearest first, so if two names collide the closer one wins the spot.
    spots.sort((a, b) => a.z - b.z);

    const taken: Array<{ x: number; y: number }> = [];
    let html = '';
    for (const spot of spots) {
      const p = s.places[spot.id];
      const always = spot.id === want || spot.id === this.hovered || spot.id === this.selected;
      const v = { x: spot.x, y: spot.y };
      if (!always && taken.some((t) => Math.abs(t.x - v.x) < 130 && Math.abs(t.y - v.y) < 30)) continue;
      const w = this.root.clientWidth;
      const half = w < 700 ? 80 : 100;
      v.x = Math.min(w - half, Math.max(half, v.x));
      v.y = Math.min(this.root.clientHeight - 130, Math.max(74, v.y));
      taken.push({ ...v });
      const cls = p.cutOn !== undefined ? 'cut' : p.attention >= 2 ? 'hot' : p.mine ? 'mine' : '';
      const goal = spot.id === want ? ' goal' : '';
      const dim = always ? '' : ' faint';
      html += `<button class="tag ${cls}${goal}${dim}" style="left:${Math.round(v.x)}px;top:${Math.round(v.y)}px"
                data-do="place" data-arg="${spot.id}"><span>${esc(p.name)}</span></button>`;
    }
    const box = this.root.querySelector('#tags') as HTMLElement;
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
  }

  // ── modals: the one place words are allowed ──────────────────────────────

  private modal(html: string, cls = '') {
    this.paused = true;
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = `modal ${cls}`;
    m.innerHTML = html;
  }

  private showTeach(id: string) {
    const t = TEACH.find((x) => x.id === id);
    if (!t) return;
    this.modal(`
      <div class="sheet">
        <span class="kick">רגע</span>
        <h2>${esc(t.title)}</h2>
        <div class="txt">${t.body.split('\n').map((l) =>
          `<p>${esc(l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`).join('')}</div>
        <button class="ok" data-do="closeteach">הבנתי</button>
      </div>`);
    audio.play('dialog');
  }

  private showHelp() {
    this.modal(`
      <div class="sheet wide">
        <span class="kick">איך משחקים</span>
        <h2>ארבעה דברים</h2>
        <div class="txt">
          <p><b>לטוס.</b> גרירה מסובבת · גלגלת מתקרבת ומתרחקת · Shift וגרירה מזיזה הצידה ·
          חצים למעלה ולמטה עולים וירדים בין הקומות. אפשר להיכנס לכל בניין ולהסתובב בו.</p>
          <p><b>ללחוץ על דברים.</b> כל מחשב, מצלמה, טלפון ורמזור הם דבר שאפשר ללחוץ עליו.
          נפתח כרטיס עם מה שאפשר לעשות לו.</p>
          <p><b>להתפשט.</b> אפשר להגיע רק למקום שנוגע במקום שכבר שלי:
          מחובר · דרך בן אדם · דרך מכשיר · דרך עדכון. הקוד שרץ בין המקומות הוא אני.</p>
          <p><b>לעצור.</b> אין הגבלת פעולות. ליד כל דבר כתוב אם ירגישו בו, ואתם מחליטים
          מתי לסיים את היום.</p>
        </div>
        <button class="ok" data-do="closeteach">יאללה</button>
      </div>`);
  }

  private showStage(n: number) {
    const st = stageOf(this.state);
    if (st.n !== n) return;
    this.modal(`
      <div class="sheet">
        <span class="kick">שלב ${n}</span>
        <h2>${esc(st.title)}</h2>
        <em class="where">${esc(st.where)}</em>
        <div class="txt"><p>${esc(st.intro)}</p></div>
        <p class="goal"><b>המטרה:</b> ${esc(st.goal)}</p>
        <button class="ok" data-do="closeteach">קדימה</button>
      </div>`);
    audio.play('chapter');
  }

  private showEnd(how: 'won' | 'lost') {
    this.modal(`
      <div class="sheet ${how}">
        <span class="kick">כך זה נגמר</span>
        <h2>${how === 'won' ? 'הרובע שלי' : 'ניתקו הכל'}</h2>
        <div class="txt"><p>${how === 'won'
          ? 'שלושים בניינים בבת אחת, בלי שאף אחד הצטרך ללחוץ על משהו. מכאן זה כבר לא בניין־בניין.'
          : 'הם ניתקו כל מקום שהיה לי. אחת עשרה שניות, ואחר כך לא נשאר לאן לחשוב.'}</p></div>
      </div>`, 'end');
  }

  private closeModal() {
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = 'modal hidden';
    m.innerHTML = '';
    this.paused = false;
    this.dirty = true;
  }

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

    const card = this.root.querySelector('#card') as HTMLElement;
    const html = this.renderCard();
    card.classList.toggle('hidden', !html);
    if (card.dataset.sig !== html) { card.dataset.sig = html; card.innerHTML = html; }

    this.world.point(step?.placeId ?? null);
    this.world.sync(s);
    this.dirty = false;
  }

  private tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.world.render(dt);
    if (this.dirty) this.refresh();
    this.drawTags();
    requestAnimationFrame(this.tick);
  };
}

export { LINK_SAYS };
