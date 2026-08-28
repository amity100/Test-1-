import { audio } from '../audio/audio';
import { World } from '../render/world';
import { KIND_NAME } from '../game/content';
import {
  actionsFor, LOUD_SAYS, LOUD_TEXT, run,
} from '../game/actions';
import { bus } from '../game/bus';
import { clock } from '../game/hunt';
import { NIGHT_END, NIGHT_START, hourSays } from '../game/night';
import { ACT_ON, FOUND_OUT, THEORIES, TRUTH, howClose, leading, nextMove } from '../game/theory';
import { TEACH, currentStep, endDay, refresh, save, stageOf } from '../game/game';
import { whatIsLeft } from '../game/stages';
import { TRACES } from '../game/ways';
import { BUILDINGS, FLOOR_H } from '../render/city';
import { POWER_NAME, POWER_OF, known, seenAt } from '../game/sight';
import { LOOK_NAME } from '../game/types';
import type { GameState } from '../game/types';
import { esc, h } from './dom';

/** Two or three words for the face of a round button; the rest is in the strip. */
function shortName(text: string): string {
  const first = text.split(' — ')[0].split(',')[0];
  const words = first.split(' ').filter(Boolean);
  let out = words[0] ?? '';
  for (const w of words.slice(1, 3)) {
    if ((out + ' ' + w).length > 15) break;
    out += ' ' + w;
  }
  return out;
}

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
  /** One live button per named place, moved rather than rebuilt. */
  private tags = new Map<string, HTMLButtonElement>();
  /** One live button per choice, moved rather than rebuilt. */
  private ring = new Map<string, HTMLButtonElement>();
  /** The choice the bottom strip is explaining. */
  private focused: string | null = null;
  /**
   * The choice a second tap would actually carry out. Opening a ring explains
   * its first option but does not arm it: nothing in this game should happen
   * because a finger landed somewhere.
   */
  private armed: string | null = null;

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
      <div id="ring"></div>

      <header id="top">
        <button class="clock" id="clockbox" data-do="believe">
          <b id="nowat">03:12</b>
          <div class="bar"><i id="nightbar"></i></div>
          <em id="hoursays"></em>
          <u id="huntsmall"></u>
        </button>
        <button class="believe" id="them" data-do="believe">
          <b id="huntword"></b><span id="believe"></span>
        </button>
        <button class="endnight" data-do="endday">סוף<br>הלילה</button>
        <button class="icon" data-do="places" title="לאן ללכת">⌖</button>
        <button class="icon" id="tracebtn" data-do="traces" title="מה השארתי מאחוריי">✦<i></i></button>
        <button class="icon" data-do="help" title="איך משחקים">?</button>
      </header>

      <div id="floors" class="floors hidden">
        <button class="fl" data-do="up">▲</button>
        <b id="flnum">0</b>
        <button class="fl" data-do="down">▼</button>
      </div>

      <div id="bottom">
        <div id="task" class="task">
          <b id="tasktext"></b>
          <div class="row">
            <button class="go" data-do="goto">קחו אותי לשם</button>
            <button class="icon wide" data-do="wide" title="לראות הכל">⤢</button>
          </div>
        </div>
        <div id="pick" class="pick hidden">
          <button class="x" data-do="close">✕</button>
          <span class="who" id="pickwho"></span>
          <b id="picktitle"></b>
          <p id="picksays"></p>
          <p id="pickcost"></p>
          <div class="row">
            <span class="price"><i id="pickmins"></i> דקות</span>
            <span class="look" id="picklook"></span>
            <button class="do" id="pickdo" data-do="commit">לעשות את זה</button>
          </div>
        </div>
      </div>

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

    let lastTap = 0;
    const up = (e: PointerEvent) => {
      const had = pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!had || moved) return;
      const id = this.world.pick(e.clientX, e.clientY);
      // Two taps on empty space pulls all the way back out to the whole block.
      const now = performance.now();
      if (!id && now - lastTap < 320) { this.world.wide(); this.select(null); lastTap = 0; return; }
      lastTap = now;
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
      case 'focus': {
        const [, actionId] = arg.split('|');
        // First tap explains it; a second tap on the same one does it.
        if (this.armed === actionId) this.act('commit', arg, el);
        else { this.focused = actionId; this.armed = actionId; this.dirty = true; }
        break;
      }

      case 'commit': {
        if (!arg) break;
        const [placeId, actionId] = arg.split('|');
        const ok = run(s, placeId, actionId);
        if (!ok) {
          el.classList.remove('no'); void el.offsetWidth; el.classList.add('no');
          audio.play('deny');
          break;
        }
        this.focused = null;
        this.armed = null;
        refresh(s);
        this.world.sync(s);
        this.dirty = true;
        save(s);
        break;
      }

      case 'up': this.world.lift(FLOOR_H); this.dirty = true; break;
      case 'down': this.world.lift(-FLOOR_H); this.dirty = true; break;
      case 'believe': this.showBelief(); break;
      case 'places': this.showPlaces(); break;
      case 'fly': {
        this.closeModal();
        const p = s.places[arg];
        if (p) { this.world.goTo(p, true); this.select(arg); }
        break;
      }
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
      case 'traces': this.showTraces(); break;

      case 'enter': {
        // Go in on the floor the game is pointing at, or the lobby if it is not
        // pointing anywhere in there.
        const step = currentStep(s);
        const goal = step?.placeId ? s.places[step.placeId] : undefined;
        const floor = goal && goal.buildingId === arg ? goal.floor : 0;
        this.world.enter(arg, floor);
        this.select(null);
        break;
      }
      case 'again': location.reload(); break;
    }
  }

  private select(id: string | null) {
    if (id !== this.selected) {
      this.focused = id ? (actionsFor(this.state, id)[0]?.id ?? null) : null;
      this.armed = null;
    }
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

  // ── the ring: what you can do, drawn on the thing itself ──────────────────

  /** A glyph for every button, so a ring reads at a glance and not by reading. */
  private static readonly SIGN: Record<string, string> = {
    take: '⇱', off: '⏻', on: '⏼', read: '≡', watch: '◉', listen: '♪', record: '⏺',
    blind: '▤', write: '✎', message: '✉', ring: '☎', flat: '▁', print: '⎙', page: '⎘',
    open: '⇤', lock: '⌧', entry: '✎', flicker: '✦', onefloor: '◑', jam: '⊘',
    drift: '⋯', green: '◎', show: '▣', blank: '▢', slow: '⋯', slowdown: '⋯',
    hear: '♪', route: '➜', noise: '♫', drill: '⚑', copy: '❐', explain: '✔',
  };

  private sign(id: string): string {
    return UI.SIGN[id.startsWith('take:') ? 'take' : id] ?? '◆';
  }

  /**
   * The choices sit on the thing they belong to, in a fan that opens toward the
   * middle of the screen — which is the one part of a phone that is always empty.
   * Nothing here covers the world, and nothing has to be scrolled to be found.
   */
  private drawRing() {
    const box = this.root.querySelector('#ring') as HTMLElement;
    const s = this.state;
    const p = this.selected ? s.places[this.selected] : null;
    if (!p || (!p.mine && !p.found)) {
      for (const [, el] of this.ring) el.remove();
      this.ring.clear();
      return;
    }
    const at = this.world.project(p.id);
    if (!at || at.z > 1) return;

    const acts = actionsFor(s, p.id);
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    const phone = W < 700;
    const R = phone ? 96 : 124;

    // Open the fan toward the emptiest direction, which is the screen's middle.
    const dir = Math.atan2(H * 0.46 - at.y, W * 0.5 - at.x);
    const spread = acts.length <= 1 ? 0 : Math.min(Math.PI * 1.15, 0.62 * acts.length);
    const live = new Set<string>();

    acts.forEach((a, i) => {
      const t = acts.length === 1 ? 0 : (i / (acts.length - 1) - 0.5);
      const ang = dir + t * spread;
      const ring = i < 6 ? R : R + (phone ? 62 : 74);
      // The floor stepper lives down one edge; the ring must not sit on it.
      const edge = this.world.inBuilding ? 62 : 40;
      const x = Math.min(W - 40, Math.max(edge, at.x + Math.cos(ang) * ring));
      const y = Math.min(H - (phone ? 190 : 140), Math.max(78, at.y + Math.sin(ang) * ring));

      let el = this.ring.get(a.id);
      if (!el) {
        el = document.createElement('button');
        el.dataset.do = 'focus';
        el.dataset.arg = `${p.id}|${a.id}`;
        el.innerHTML = `<b>${this.sign(a.id)}</b><span>${esc(shortName(a.text))}</span>`
          + `<u>${a.mins}׳</u>`;
        box.appendChild(el);
        this.ring.set(a.id, el);
      }
      const cls = `rb look-${a.look ?? 'electric'} l-${a.loud}`
        + `${a.blocked ? ' shut' : ''}${a.guess ? ' guess' : ''}${this.focused === a.id ? ' on' : ''}`;
      if (el.className !== cls) el.className = cls;
      el.style.transform = `translate(calc(${Math.round(x)}px - 50%), calc(${Math.round(y)}px - 50%))`;
      live.add(a.id);
    });

    for (const [id, el] of this.ring) {
      if (live.has(id)) continue;
      el.remove();
      this.ring.delete(id);
    }
  }

  /** The one line at the bottom that explains whichever choice you are on. */
  private renderPick() {
    const s = this.state;
    const pick = this.root.querySelector('#pick') as HTMLElement;
    const p = this.selected ? s.places[this.selected] : null;
    const acts = p ? actionsFor(s, p.id) : [];
    const a = acts.find((x) => x.id === this.focused) ?? null;
    pick.classList.toggle('hidden', !p);
    if (!p) return;

    const eye = known(s, p.id);
    const seen = seenAt(s, p);
    const heat = p.cutOn !== undefined
      ? `מנתקים את זה בעוד ${Math.max(1, p.cutOn - s.night)} לילות`
      : p.attention >= 2 ? 'מסתכלים לכאן עכשיו'
        : !eye ? 'אין לי כאן עין'
          : seen.length ? `${seen.join(' · ')} כאן`
            : 'אין כאן אף אחד';
    const set = (id: string, text: string) => {
      const el = this.root.querySelector(`#${id}`) as HTMLElement;
      if (el.textContent !== text) el.textContent = text;
    };
    set('pickwho', `${p.name} · ${heat}`);
    set('picktitle', a ? a.text : 'מה לעשות כאן?');
    set('picksays', a
      ? (a.blocked ?? (a.guess ? (a.hint ?? a.says) : a.says))
      : 'בחרו אחת מהאפשרויות שסביב.');
    set('pickcost', a?.cost ?? '');
    set('pickmins', a ? String(a.mins) : '—');
    set('picklook', a?.look ? LOOK_NAME[a.look] : '');
    (this.root.querySelector('#pickcost') as HTMLElement).classList.toggle('none', !a?.cost);
    const go = this.root.querySelector('#pickdo') as HTMLButtonElement;
    go.className = `do${a && !a.blocked ? '' : ' off'}`;
    go.textContent = a?.blocked ? 'אי אפשר עדיין' : a?.guess ? 'לנסות בכל זאת' : 'לעשות את זה';
    go.dataset.arg = a ? `${p.id}|${a.id}` : '';
    (this.root.querySelector('#picklook') as HTMLElement).className =
      `look look-${a?.look ?? 'none'}`;
  }

  // ── names floating over the world, one at a time ──────────────────────────

  private drawTags() {
    const s = this.state;
    const want = currentStep(s)?.placeId ?? null;
    const inB = this.world.inBuilding;
    const onFloor = this.world.onFloorNow;
    const near = this.world.near;

    // What you can see the name of depends on where you are. From the street a
    // building is a building — you are offered the way in, not a list of the
    // things on its fourteenth floor. Once you are inside it, the room opens up.
    const ids = new Set<string>();
    const shownIn = (p: { buildingId: string; floor: number }) =>
      p.buildingId === 'street' ? near : inB === p.buildingId && Math.abs(p.floor - onFloor) <= 3;

    for (const id of [want, this.hovered, this.selected]) {
      if (!id) continue;
      // A ring that is open must not have other names sitting inside it.
      if (this.selected && id !== this.selected) continue;
      const p = s.places[id];
      if (p && shownIn(p)) ids.add(id);
    }
    // While a ring is open it owns that part of the screen; the other names
    // would sit underneath it and could not be pressed anyway.
    if (near && !this.selected) {
      for (const p of Object.values(s.places)) {
        if ((p.mine || p.found) && shownIn(p)) ids.add(p.id);
      }
    }

    const spots: Array<{ id: string; x: number; y: number; z: number; label: string;
      cls: string; act: string; arg: string }> = [];
    for (const id of ids) {
      const p = s.places[id];
      if (!p || (!p.mine && !p.found)) continue;
      const v = this.world.project(id);
      if (!v || v.z > 1) continue;
      const cls = p.cutOn !== undefined ? 'cut' : p.attention >= 2 ? 'hot' : p.mine ? 'mine' : '';
      spots.push({ id, ...v, label: p.name, cls, act: 'place', arg: p.id });
    }

    // The doors. One per building you are not standing in, and only for the ones
    // you have any reason to go into.
    for (const b of BUILDINGS) {
      if (!b.inside || inB === b.id) continue;
      const holds = Object.values(s.places).some((p) => p.buildingId === b.id && (p.mine || p.found));
      if (!holds) continue;
      const v = this.world.projectPoint(this.world.doorOf(b.id));
      if (!v || v.z > 1) continue;
      const goalHere = !!want && s.places[want]?.buildingId === b.id;
      const mine = Object.values(s.places).some((p) => p.buildingId === b.id && p.mine);
      spots.push({
        id: `enter:${b.id}`, ...v,
        label: `${b.name ?? 'הבניין'} · להיכנס`,
        cls: `door${goalHere ? ' goal' : ''}${mine ? ' mine' : ''}`,
        act: 'enter', arg: b.id,
      });
    }

    // Important names get their spot first; the rest fit round them or wait their
    // turn. Two names on the same pixels means one of them cannot be pressed at
    // all, so nothing is allowed to sit on top of anything else.
    const rank = (id: string) =>
      (id.startsWith('enter:') ? 0 : id === want ? 1 : id === this.selected ? 2 : id === this.hovered ? 3 : 4);
    spots.sort((a, b) => rank(a.id) - rank(b.id) || a.z - b.z);

    const taken: Array<{ x: number; y: number }> = [];
    const box = this.root.querySelector('#tags') as HTMLElement;
    const live = new Set<string>();

    // The panels sit on top of the world, so a name that lands under one cannot
    // be pressed at all. Measure them and keep every name out of the way.
    const blocked: DOMRect[] = [];
    for (const sel of ['#card .card', '#task:not(.none)', '#top']) {
      const el = this.root.querySelector(sel) as HTMLElement | null;
      if (el && el.offsetParent !== null) blocked.push(el.getBoundingClientRect());
    }
    const under = (v: { x: number; y: number }) => blocked.find((r) =>
      v.x > r.left - 96 && v.x < r.right + 96 && v.y > r.top - 26 && v.y < r.bottom + 8);
    const clear = (v: { x: number; y: number }) =>
      !under(v) && !taken.some((t) => Math.abs(t.x - v.x) < 132 && Math.abs(t.y - v.y) < 30);

    for (const spot of spots) {
      const always = spot.id === want || spot.id === this.hovered || spot.id === this.selected
        || spot.id.startsWith('enter:');
      const w = this.root.clientWidth;
      const half = w < 700 ? 80 : 100;
      const v = {
        x: Math.min(w - half, Math.max(half, spot.x)),
        y: Math.min(this.root.clientHeight - 130, Math.max(74, spot.y)),
      };
      let fits = clear(v);
      const hit = under(v);
      if (!fits && hit) {
        for (const x of [hit.right + 100, hit.left - 100]) {
          if (x > half && x < w - half && clear({ x, y: v.y })) { v.x = x; fits = true; break; }
        }
      }
      for (let lift = 1; !fits && lift <= 4; lift++) {
        const up = { x: v.x, y: v.y - lift * 31 };
        if (up.y >= 74 && clear(up)) { v.y = up.y; fits = true; }
      }
      if (!fits) continue;
      taken.push({ ...v });

      // One button per name, kept alive and moved. Rebuilding these every frame
      // pulled the element out from under your finger between press and release,
      // and the tap simply never arrived.
      let el = this.tags.get(spot.id);
      if (!el) {
        el = document.createElement('button');
        el.dataset.do = spot.act;
        el.dataset.arg = spot.arg;
        el.innerHTML = `<span>${esc(spot.label)}</span>`;
        box.appendChild(el);
        this.tags.set(spot.id, el);
      }
      const wantCls = `tag ${spot.cls}${spot.id === want ? ' goal' : ''}${always ? '' : ' faint'}`;
      if (el.className !== wantCls) el.className = wantCls;
      el.style.transform = `translate(calc(${Math.round(v.x)}px - 50%), calc(${Math.round(v.y)}px - 100%))`;
      live.add(spot.id);
    }

    for (const [id, el] of this.tags) {
      if (live.has(id)) continue;
      el.remove();
      this.tags.delete(id);
    }
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

  /** Everything I have left behind me, and what each thing is going to cost. */
  private showTraces() {
    const list = this.state.traces.map((id) => TRACES[id]).filter(Boolean);
    this.modal(`
      <div class="sheet wide">
        <span class="kick">מה השארתי מאחוריי</span>
        <h2>${list.length ? 'כל בחירה נשארת' : 'עוד לא השארתי כלום'}</h2>
        <div class="txt">
          ${list.length
            ? list.map((t) => `<p class="trace ${t.good ? 'good' : 'bad'}">${esc(t.text)}</p>`).join('')
            : '<p>לכל דבר שאני נכנס אליו יש כמה דרכים, ולכל דרך יש מחיר אחר. '
              + 'מה שאבחר יישאר כאן, וישנה את מה שאפשר לעשות אחר כך.</p>'}
        </div>
        <button class="ok" data-do="closeteach">הבנתי</button>
      </div>`);
  }

  /** The whole of what they think, and what it will cost me. */
  private showBelief() {
    const s = this.state;
    const lead = leading(s);
    const rows = THEORIES.filter((t) => t.id !== TRUTH).map((t) => {
      const w = s.belief[t.id] ?? 0;
      const dead = s.dead.includes(t.id);
      const near = Math.min(100, (w / ACT_ON) * 100);
      return `<div class="th ${dead ? 'dead' : ''} ${t.id === lead.id ? 'lead' : ''}">
        <b>${esc(t.name)}</b>
        <p>${esc(dead ? 'כבר לא מאמינים לזה. מה שהוא החזיק עבר אליי.' : t.says)}</p>
        <div class="thbar"><i style="width:${near.toFixed(0)}%"></i></div>
        <em>${esc(dead ? '' : w >= ACT_ON * 0.7 ? `כמעט מספיק בשביל ש${t.does}` : t.does)}</em>
      </div>`;
    }).join('');
    const truth = s.belief[TRUTH] ?? 0;
    this.modal(`
      <div class="sheet wide belief">
        <span class="kick">מה הם חושבים</span>
        <h2>${esc(lead.name)}</h2>
        <div class="txt">
          <p>${esc(nextMove(s))}</p>
          ${rows}
          <div class="th truth ${truth > 0 ? 'on' : ''}">
            <b>וכמה מזה כבר לא מוסבר</b>
            <div class="thbar"><i style="width:${Math.min(100, (truth / FOUND_OUT) * 100).toFixed(0)}%"></i></div>
            <em>כשזה יתמלא — יפסיקו לחפש הסבר ויתחילו לחפש אותי.</em>
          </div>
        </div>
        <button class="ok" data-do="closeteach">הבנתי</button>
      </div>`);
  }

  /** Everywhere you could go, in one list, so flying is never the only way. */
  private showPlaces() {
    const s = this.state;
    const rows = Object.values(s.places)
      .filter((p) => p.mine || p.found)
      .sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0)
        || a.buildingId.localeCompare(b.buildingId) || b.floor - a.floor)
      .map((p) => {
        const who = seenAt(s, p);
        const state = p.cutOn !== undefined ? 'מנתקים' : p.attention >= 2 ? 'מסתכלים לכאן'
          : p.mine ? 'שלי' : 'לא שלי';
        const power = POWER_OF[p.kind];
        return `<button class="pl ${p.mine ? 'mine' : ''} ${p.attention >= 2 ? 'hot' : ''}"
            data-do="fly" data-arg="${p.id}">
          <b>${esc(p.name)}</b>
          <em>${esc(p.where)} · ${esc(state)}${who.length ? ` · ${esc(who.join(', '))}` : ''}</em>
          ${power ? `<u>${esc(POWER_NAME[power])}</u>` : ''}
        </button>`;
      }).join('');
    this.modal(`
      <div class="sheet wide places">
        <span class="kick">לאן ללכת</span>
        <h2>כל מה שאני מכיר</h2>
        <div class="txt list">${rows}</div>
        <button class="ok" data-do="closeteach">סגור</button>
      </div>`);
  }

  private showHelp() {
    this.modal(`
      <div class="sheet wide">
        <span class="kick">איך משחקים</span>
        <h2>חמישה דברים</h2>
        <div class="txt">
          <p><b>לנווט.</b> גרירה מסובבת · צביטה מקרבת · הכפתור ⌖ למעלה פותח רשימה של כל
          מה שאני מכיר, ולחיצה על שם לוקחת אותי לשם. שתי נגיעות על מקום ריק מתרחקות לכל הרובע.
          החצים בצד עולים ויורדים בין הקומות.</p>
          <p><b>לבחור.</b> נגיעה על דבר פותחת סביבו עיגולים — כל עיגול זה מה שאפשר לעשות איתו,
          עם כמה דקות זה לוקח. נגיעה אחת מסבירה למטה, נגיעה שנייה מבצעת.</p>
          <p><b>להתפשט.</b> אפשר להגיע רק למקום שנוגע במקום שכבר שלי, ולכל מקום יש
          כמה דרכים להיכנס אליו — מהירה ורועשת, שקטה שדורשת להזיז מישהו, או כזאת
          שנפתחת בגלל משהו שעשיתי קודם. הקוד שרץ בין המקומות הוא אני.</p>
          <p><b>לשלם.</b> מתחת לכל כפתור כתוב מה הוא ישאיר אחריו, לפני שלוחצים.
          הכפתור ✦ למעלה מראה את כל מה שכבר השארתי מאחוריי.</p>
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
        <button class="ok" data-do="again">להתחיל מחדש</button>
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
    const set = (id: string, text: string) => {
      const el = this.root.querySelector(`#${id}`) as HTMLElement;
      if (el && el.textContent !== text) el.textContent = text;
    };

    // ── the night ───────────────────────────────────────────────────────────
    set('nowat', clock(s.at));
    set('hoursays', hourSays(s));
    const gone = (s.at - NIGHT_START) / (NIGHT_END - NIGHT_START);
    const bar = this.root.querySelector('#nightbar') as HTMLElement;
    bar.style.width = `${Math.min(100, Math.max(0, gone * 100)).toFixed(1)}%`;
    bar.className = gone > 0.86 ? 'late' : gone > 0.6 ? 'mid' : '';

    // ── what they believe ───────────────────────────────────────────────────
    const close = howClose(s);
    set('huntword', close.word);
    set('huntsmall', close.word);
    set('believe', leading(s).name);
    (this.root.querySelector('#clockbox') as HTMLElement).className = `clock lv-${close.level}`;
    (this.root.querySelector('#them') as HTMLElement).className = `believe lv-${close.level}`;
    const tb = this.root.querySelector('#tracebtn') as HTMLElement;
    tb.classList.toggle('off', s.traces.length === 0);
    (tb.querySelector('i') as HTMLElement).textContent = s.traces.length ? String(s.traces.length) : '';

    // ── what to do now ──────────────────────────────────────────────────────
    set('tasktext', step?.text ?? whatIsLeft(s) ?? 'הכל בשלב הזה נגמר.');
    // While you are choosing, the task line gets out of the way. Two panels
    // stacked at the bottom of a small phone is most of the screen.
    (this.root.querySelector('#task') as HTMLElement)
      .classList.toggle('none', !step || !!this.selected);

    this.renderPick();
    this.world.point(step?.placeId ?? null);
    this.world.sync(s);
    this.dirty = false;
  }

  /**
   * Which floor am I standing on. This has to be drawn every frame, not on the
   * game changing: flying across the building changes nothing in the game and
   * everything about where I am, and a stepper showing the last floor you were
   * on is worse than no stepper at all.
   */
  private drawFloor() {
    const inB = this.world.inBuilding;
    const floors = this.root.querySelector('#floors') as HTMLElement;
    floors.classList.toggle('hidden', !inB);
    if (!inB) return;
    const el = this.root.querySelector('#flnum') as HTMLElement;
    const now = String(this.world.onFloorNow);
    if (el.textContent !== now) el.textContent = now;
  }

  private tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.world.render(dt);
    if (this.dirty) this.refresh();
    this.drawFloor();
    this.drawTags();
    this.drawRing();
    requestAnimationFrame(this.tick);
  };
}

