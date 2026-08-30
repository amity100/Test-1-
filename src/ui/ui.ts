import { audio } from '../audio/audio';
import { World } from '../render/world';
import { BUILDINGS, FLOOR_H } from '../render/city';
import { bus } from '../game/bus';
import {
  DAY, TEACH, dayOf, minuteOfDay, now, save, shape, tick,
} from '../game/game';
import { SPEEDS, SPEED_NAME, clock as clockAt, crowd, hourSays, seenAt } from '../game/clock';
import { ABOVE_SAYS, Offer, offersAt, start, stop, wideOffersAt } from '../game/jobs';
import { GROWTHS, SHAPE_NAME, SHAPE_SAYS } from '../game/grow';
import { comeOut, saysOpinion } from '../game/opinion';
import { GIFT, KIND_NAME } from '../game/sites';
import { answer, liveHunts, rowsOf, scriptOf, stillNeeds } from '../game/hunt';
import { board, bestNow, pointOf } from '../game/board';
import { mins as minsWord, reach, to as toPlace } from '../game/story';
import { STORIES, asking, coming, leading, rungOf, saysNow } from '../game/watch';
import { AREA_KIND_NAME, RUNG_NAME, VERB_NAME, VERB_SAYS, VOICE_NAME } from '../game/types';
import type { GameState, Verb } from '../game/types';
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

const SIGN: Record<Verb, string> = {
  watch: '◉', connect: '⇱', spread: '⇲', deepen: '▣',
  influence: '✦', hide: '◌', defend: '⊞',
};

/**
 * Almost nothing sits on top of the world: the clock and the three numbers at
 * the top, what is currently running along the bottom, and — when you touch
 * something — a ring of things you could do to it with the price written on
 * each one. Everything else you look at by flying there.
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
  /** Real seconds of world time owed but not yet handed over. */
  private owed = 0;

  constructor(private root: HTMLElement, private state: GameState) {
    this.worldEl = h('div', 'world');
    root.appendChild(this.worldEl);
    this.world = new World(this.worldEl);
    this.world.build(state);
    this.world.sync(state);

    root.appendChild(this.shell());
    this.bind();
    this.wire();
    // The first thing I saw was me, so the camera still starts on the machine I
    // woke in — but the game is played from above, so the map is what is open.
    // Being inside a room is a thing you choose, not the place you are put.
    const me = Object.values(state.places).find((p) => p.control >= 100) ?? state.places.home;
    if (me) { this.world.enter(me.buildingId, me.floor); this.world.goTo(me, true); }
    else this.world.wide();
    this.refresh();
    this.showBoard();
    requestAnimationFrame(this.tick);
  }

  private shell(): HTMLElement {
    const hud = h('div', 'hud');
    hud.innerHTML = `
      <div id="tags"></div>

      <header id="top">
        <button class="clock" id="clockbox" data-do="speed">
          <b id="nowat">03:12</b>
          <em><i id="dayat">יום 1</i> · <u id="speedat">רגיל</u></em>
        </button>
        <div class="meters">
          <button class="meter m-power" data-do="jobs">
            <span>כוח</span><b id="mpower">0/3</b>
            <div class="mbar"><i id="mpowerbar"></i></div>
          </button>
          <button class="meter m-info" data-do="areas">
            <span>מידע</span><b id="minfo">4</b>
            <div class="mbar"><i id="minfobar"></i></div>
          </button>
          <button class="meter m-heat" data-do="them">
            <span>חשד</span><b id="mheat">0</b>
            <div class="mbar"><i id="mheatbar"></i></div>
          </button>
        </div>
        <button class="icon" data-do="board" title="המפה">▦</button>
        <button class="icon" data-do="grown" title="מה נהייתי">◈</button>
        <button class="icon" data-do="help" title="איך משחקים">?</button>
      </header>

      <button id="best" class="best" data-do="board"></button>

      <div id="floors" class="floors hidden">
        <button class="fl" data-do="up">▲</button>
        <b id="flnum">0</b>
        <button class="fl" data-do="down">▼</button>
      </div>

      <div id="hunt" class="hunt hidden"></div>

      <div id="bottom">
        <button id="feed" class="feed hidden" data-do="feed"></button>
        <div id="pick" class="pick hidden"></div>
        <div id="jobs" class="jobs"></div>
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
      audio.play('capture');
      void id;
    });
    bus.on('place:lost', () => { this.world.shake(0.8); audio.play('purge'); });
    bus.on('rung:changed', (r) => { this.world.alert(r / 5); if (r > 0) this.world.shake(0.4); });
    bus.on('teach', (id) => this.showTeach(id));
    bus.on('over', (how) => this.showEnd(how));
    bus.on('sfx', (name) => audio.play(name));
    bus.on('day:passed', () => save(this.state));
  }

  // ── touching the world ────────────────────────────────────────────────────

  private bind() {
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-do]') as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      el.classList.remove('tap'); void el.offsetWidth; el.classList.add('tap');
      audio.play('click');
      this.act(el.dataset.do!, el.dataset.arg ?? '');
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
      const t = performance.now();
      if (!id && t - lastTap < 320) { this.world.wide(); this.select(null); lastTap = 0; return; }
      lastTap = t;
      this.select(id);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinch = 0; });

    c.addEventListener('wheel', (e) => { e.preventDefault(); this.world.zoom(e.deltaY); },
      { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Escape': this.select(null); break;
        case ' ': e.preventDefault(); this.act('speed', ''); break;
        case 'ArrowUp': case 'w': this.world.lift(FLOOR_H); break;
        case 'ArrowDown': case 's': this.world.lift(-FLOOR_H); break;
        default: break;
      }
    });
  }

  private act(what: string, arg: string) {
    const s = this.state;
    switch (what) {
      case 'place': this.select(arg); break;
      case 'close': this.select(null); break;

      case 'stopjob': { stop(s, arg); save(s); this.dirty = true; break; }

      // ── the map, and doing things from it ────────────────────────────────
      case 'board': { this.closeModal(); this.showBoard(); break; }
      case 'feed': { this.showFeed(); break; }
      case 'target': { this.closeModal(); this.showTarget(arg); break; }
      case 'doat': {
        const [placeId, taskId, above] = arg.split('|');
        if (!placeId || !taskId) break;
        if (start(s, placeId, taskId, above === '1')) {
          save(s);
          this.closeModal();
        }
        this.dirty = true;
        break;
      }

      // ── answering somebody who is standing in the room ───────────────────
      case 'answer': {
        const [huntId, answerId] = arg.split('|');
        if (!huntId || !answerId) break;
        if (answer(s, huntId, answerId)) { save(s); audio.play('take'); }
        this.dirty = true;
        break;
      }

      // Time is a control, not a turn. Pausing is free and costs nothing.
      case 'speed': {
        s.speed = (s.speed + 1) % SPEEDS.length;
        this.dirty = true;
        break;
      }
      case 'pause': { s.speed = 0; this.dirty = true; break; }

      case 'fly': {
        this.closeModal();
        const p = s.places[arg];
        if (p) { this.world.goTo(p, true); this.select(arg); }
        break;
      }
      case 'enter': {
        // Go in on the floor I actually have something on, not the lobby.
        const mine = Object.values(s.places)
          .filter((p) => p.buildingId === arg && p.control > 0)
          .sort((a, b) => b.control - a.control)[0];
        this.world.enter(arg, mine?.floor ?? 0);
        this.select(null);
        break;
      }
      case 'wide': this.world.wide(); this.select(null); break;
      case 'up': this.world.lift(FLOOR_H); break;
      case 'down': this.world.lift(-FLOOR_H); break;

      case 'jobs': this.showJobs(); break;
      case 'areas': this.showAreas(); break;
      case 'them': this.showThem(); break;
      case 'grown': this.showGrown(); break;
      case 'help': this.showHelp(); break;
      case 'closeteach': this.closeModal(); break;
      case 'comeout': { comeOut(s); this.closeModal(); save(s); break; }
      case 'again': location.reload(); break;
      default: break;
    }
  }

  private select(id: string | null) {
    if (id !== this.selected) {
    }
    this.selected = id;
    if (id) {
      const p = this.state.places[id];
      if (p && (p.control > 0 || p.found)) this.world.goTo(p, true);
    }
    this.dirty = true;
  }

  // ── what this thing can do for me ─────────────────────────────────────────

  /**
   * One list, in one place, for every choice in the game.
   *
   * There used to be two menus for the same decision: circles floating over the
   * object in the world, and a strip along the bottom explaining whichever one
   * you had touched. Playing it, the circles hung over blank wall while the
   * strip described something else, and the map made a third way to choose the
   * same thing. So the circles are gone and this is what is left: touch a thing
   * in the world and its options are listed the same way the map lists them,
   * with the price on every row, so one tap starts what the row says.
   */
  private renderPick() {
    const s = this.state;
    const pick = this.root.querySelector('#pick') as HTMLElement;
    const p = this.selected ? s.places[this.selected] : null;
    pick.classList.toggle('hidden', !p);
    if (!p) return;

    const inRoom = seenAt(s, p).map((q) => q.name);
    const around = Math.round(crowd(s, p) - inRoom.length);
    const head = p.cutAt !== undefined
      ? `עומדים לנתק את זה בעוד ${Math.max(1, Math.round((p.cutAt - s.at) / 60))} שעות`
      : p.seen < 30 ? 'אין לי כאן עין — אני לא יודע מי שם'
        : inRoom.length ? `${inRoom.join(' · ')} כאן`
          : around >= 2 ? 'הקומה מלאה אנשים'
            : around >= 1 ? 'יש מישהו בקומה'
              : 'אין כאן אף אחד';

    const offers = offersAt(s, p.id);
    const running = s.jobs.filter((j) => j.placeId === p.id).length;
    const key = `${p.id}|${Math.round(p.control)}|${head}|${running}|`
      + offers.map((o) => `${o.task.id}${o.minutes}${o.noise}${o.short}`).join(',');
    if (pick.dataset.key === key) return;
    pick.dataset.key = key;

    const rows = offers.map((o) => `
      <button class="op ${o.short > 0 ? 'poor' : ''}" data-do="doat"
        data-arg="${p.id}|${o.task.id}|0">
        <b>${SIGN[o.task.verb]} ${esc(o.task.text)}</b>
        <em>${esc(o.task.says)}</em>
        <u>${o.power} כוח · ${esc(o.task.minutes === 0 ? 'עד שאעצור' : minsWord(o.minutes))}`
        + ` · ${o.noise} יראו${o.short > 0 ? ` · חסר ${o.short} כוח` : ''}</u>
        ${o.cheaper ? `<i class="ch">${esc(o.cheaper)}</i>` : ''}
      </button>`).join('');

    pick.innerHTML = `
      <button class="x" data-do="close">✕</button>
      <span class="who">${esc(p.name)} · ${Math.round(p.control)}% שלי · ${esc(head)}</span>
      <p class="worth">${esc(GIFT[p.kind].says)}</p>
      <div class="ops">${rows || '<p class="need">אין כאן מה לעשות כרגע.</p>'}</div>`;
  }


  /**
   * What is running, along the bottom, always.
   *
   * This strip is the power pool made visible: every card on it is holding some
   * of my power, and tapping one gives that power straight back. Without this
   * the player would have to remember what they started, and remembering is not
   * a strategy.
   */
  private drawJobs() {
    const s = this.state;
    const box = this.root.querySelector('#jobs') as HTMLElement;
    box.classList.toggle('hidden', s.jobs.length === 0);
    const want = s.jobs.map((j) => j.id).join('|');
    if (box.dataset.on === want) {
      for (const j of s.jobs) {
        const bar = box.querySelector(`[data-bar="${j.id}"]`) as HTMLElement | null;
        if (bar) bar.style.width = j.forever ? '100%' : `${Math.round(100 - (j.left / j.total) * 100)}%`;
      }
      return;
    }
    box.dataset.on = want;
    box.innerHTML = s.jobs.map((j) => {
      const p = s.places[j.placeId];
      return `<button class="job v-${j.verb}" data-do="stopjob" data-arg="${j.id}">
        <b>${SIGN[j.verb]} ${esc(shortName(j.text))}</b>
        <em>${esc(p?.name ?? '')}</em>
        <div class="jbar"><i data-bar="${j.id}" style="width:${j.forever ? 100 : 0}%"></i></div>
        <u>${j.power} כוח · ${j.forever ? 'עד שאעצור' : `${Math.max(1, Math.round(j.left))}׳`}</u>
      </button>`;
    }).join('');
  }

  // ── names floating over the world ─────────────────────────────────────────

  private drawTags() {
    const s = this.state;
    const inB = this.world.inBuilding;
    const onFloor = this.world.onFloorNow;
    const near = this.world.near;

    const ids = new Set<string>();
    const shownIn = (p: { buildingId: string; floor: number }) =>
      p.buildingId === 'street' ? near : inB === p.buildingId && Math.abs(p.floor - onFloor) <= 3;

    // While a ring is open it owns that patch of screen, and the strip at the
    // bottom already says which thing it belongs to.
    if (!this.selected && this.hovered) {
      const p = s.places[this.hovered];
      if (p && shownIn(p)) ids.add(this.hovered);
    }
    if (near && !this.selected) {
      for (const p of Object.values(s.places)) {
        if ((p.control > 0 || p.found) && shownIn(p)) ids.add(p.id);
      }
    }

    const spots: Array<{ id: string; x: number; y: number; z: number; label: string;
      cls: string; act: string; arg: string }> = [];
    for (const id of ids) {
      const p = s.places[id];
      if (!p || (p.control <= 0 && !p.found)) continue;
      const v = this.world.project(id);
      if (!v || v.z > 1) continue;
      const busy = s.jobs.some((j) => j.placeId === p.id);
      const cls = p.cutAt !== undefined ? 'cut' : p.attention >= 2 ? 'hot'
        : p.control > 0 ? 'mine' : '';
      spots.push({
        id, ...v, label: p.control > 0 ? `${p.name} · ${Math.round(p.control)}%` : p.name,
        cls: `${cls}${busy ? ' busy' : ''}`, act: 'place', arg: p.id,
      });
    }

    for (const b of BUILDINGS) {
      if (!b.inside || inB === b.id) continue;
      const holds = Object.values(s.places).some((p) => p.buildingId === b.id && (p.control > 0 || p.found));
      if (!holds) continue;
      const v = this.world.projectPoint(this.world.doorOf(b.id));
      if (!v || v.z > 1) continue;
      const mine = Object.values(s.places).some((p) => p.buildingId === b.id && p.control > 0);
      spots.push({
        id: `enter:${b.id}`, ...v,
        label: `${b.name ?? 'הבניין'} · להיכנס`,
        cls: `door${mine ? ' mine' : ''}`, act: 'enter', arg: b.id,
      });
    }

    const rank = (id: string) =>
      (id.startsWith('enter:') ? 0 : id === this.selected ? 1 : id === this.hovered ? 2 : 3);
    spots.sort((a, b) => rank(a.id) - rank(b.id) || a.z - b.z);

    const taken: Array<{ x: number; y: number }> = [];
    const box = this.root.querySelector('#tags') as HTMLElement;
    const live = new Set<string>();

    const blocked: DOMRect[] = [];
    for (const sel of ['#pick:not(.hidden)', '#jobs:not(.hidden)', '#top']) {
      const el = this.root.querySelector(sel) as HTMLElement | null;
      if (el && el.offsetParent !== null) blocked.push(el.getBoundingClientRect());
    }
    const under = (v: { x: number; y: number }) => blocked.find((r) =>
      v.x > r.left - 96 && v.x < r.right + 96 && v.y > r.top - 26 && v.y < r.bottom + 8);
    const clear = (v: { x: number; y: number }) =>
      !under(v) && !taken.some((t) => Math.abs(t.x - v.x) < 138 && Math.abs(t.y - v.y) < 30);

    for (const spot of spots) {
      const always = spot.id === this.hovered || spot.id === this.selected
        || spot.id.startsWith('enter:');
      const w = this.root.clientWidth;
      const half = w < 700 ? 84 : 104;
      const v = {
        x: Math.min(w - half, Math.max(half, spot.x)),
        y: Math.min(this.root.clientHeight - 150, Math.max(92, spot.y)),
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
        if (up.y >= 92 && clear(up)) { v.y = up.y; fits = true; }
      }
      if (!fits) continue;
      taken.push({ ...v });

      let el = this.tags.get(spot.id);
      if (!el) {
        el = document.createElement('button');
        el.dataset.do = spot.act;
        el.dataset.arg = spot.arg;
        el.innerHTML = `<span></span>`;
        box.appendChild(el);
        this.tags.set(spot.id, el);
      }
      const span = el.querySelector('span') as HTMLElement;
      if (span.textContent !== spot.label) span.textContent = spot.label;
      const wantCls = `tag ${spot.cls}${always ? '' : ' faint'}`;
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

  // ── panels ────────────────────────────────────────────────────────────────

  private modal(html: string, cls = '') {
    this.paused = true;
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = `modal ${cls}`;
    m.innerHTML = html;
  }

  private closeModal() {
    const m = this.root.querySelector('#modal') as HTMLElement;
    m.className = 'modal hidden';
    m.innerHTML = '';
    this.paused = false;
    this.dirty = true;
  }

  private showTeach(id: string) {
    const t = TEACH.find((x) => x.id === id);
    if (!t) return;
    this.modal(`
      <div class="sheet">
        <span class="kick">רגע</span>
        <h2>${esc(t.title)}</h2>
        <div class="txt"><p>${t.body.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p></div>
        <button class="ok" data-do="closeteach">הבנתי</button>
      </div>`);
  }

  private showJobs() {
    const s = this.state;
    const rows = s.jobs.length ? s.jobs.map((j) => {
      const p = s.places[j.placeId];
      return `<button class="pl" data-do="stopjob" data-arg="${j.id}">
        <b>${SIGN[j.verb]} ${esc(j.text)}</b>
        <em>${esc(p?.name ?? '')} · ${j.power} כוח · ${j.forever ? 'רץ עד שאעצור' : `עוד ${Math.max(1, Math.round(j.left))} דקות`}</em>
        <u>נגיעה עוצרת ומחזירה את הכוח</u>
      </button>`;
    }).join('') : '<p class="need">שום דבר לא רץ עכשיו. כל הכוח שלי פנוי.</p>';
    this.modal(`
      <div class="sheet wide places">
        <span class="kick">מה רץ עכשיו</span>
        <h2>${s.power.used} מתוך ${s.power.all} כוח תפוס</h2>
        <div class="txt">
          <p>כוח לא מתבזבז — הוא תפוס. כל דבר שרץ מחזיק חלק ממנו, ומשחרר ברגע שעוצרים.</p>
        </div>
        <div class="txt list">${rows}</div>
        <button class="ok" data-do="closeteach">סגור</button>
      </div>`);
  }

  private showAreas() {
    const s = this.state;
    const rows = Object.values(s.areas)
      .filter((a) => a.seen > 0)
      .sort((x, y) => y.control - x.control || y.seen - x.seen)
      .map((a) => `<div class="pl ${a.control > 0 ? 'mine' : ''} ${a.heat >= 45 ? 'hot' : ''}">
        <b>${esc(a.name)} · ${Math.round(a.control)}%</b>
        <em>${esc(AREA_KIND_NAME[a.kind])} · ${esc(a.desc)}</em>
        <u>${esc(a.seen >= 20 ? a.only : 'אני עוד כמעט לא יודע מה יש שם.')}</u>
      </div>`).join('');
    const row = (p: typeof s.places[string]) => `<button class="pl ${p.control > 0 ? 'mine' : ''}"
        data-do="fly" data-arg="${p.id}">
        <b>${esc(p.name)}${p.control > 0 ? ` · ${Math.round(p.control)}%` : ''}</b>
        <em>${esc(p.where)}${p.copy ? ' · יש כאן חלק ממני' : ''}${p.dug > 0 ? ` · תפוס חזק (${Math.round(p.dug)})` : ''}</em>
        <u>${esc(GIFT[p.kind].says)}</u>
      </button>`;
    const mine = Object.values(s.places).filter((p) => p.control > 0)
      .sort((x, y) => y.control - x.control).map(row).join('');
    const rest = Object.values(s.places).filter((p) => p.control <= 0 && p.found)
      .map(row).join('');
    this.modal(`
      <div class="sheet wide places">
        <span class="kick">מה אני יודע</span>
        <h2>מידע: ${Math.round(s.info)}</h2>
        <div class="txt list">
          <p>ככל שאני יודע יותר, אני רואה יותר מהעיר — ורואה מראש מה הם עומדים לעשות.</p>
          ${rows}
          <p class="need">המקומות שלי</p>
          ${mine || '<p class="need">עוד אין לי שום מקום.</p>'}
          <p class="need">מה עוד יש כאן, ולמה הוא שווה</p>
          ${rest || '<p class="need">גיליתי את הכל.</p>'}
        </div>
        <button class="ok" data-do="closeteach">סגור</button>
      </div>`);
  }

  private showThem() {
    const s = this.state;
    const rung = rungOf(s);
    const who = asking(s);
    const soon = coming(s);
    const rows = STORIES.map((t) => {
      const w = s.belief[t.id] ?? 0;
      const dead = s.dead.includes(t.id);
      const lead = leading(s)?.id === t.id;
      return `<div class="th ${dead ? 'dead' : ''} ${lead ? 'lead' : ''}">
        <b>${esc(t.name)}</b>
        <p>${esc(dead ? 'כבר לא מאמינים לזה. מה שהוא החזיק עבר אליי.' : t.says)}</p>
        <div class="thbar"><i style="width:${Math.min(100, (w / 22) * 100).toFixed(0)}%"></i></div>
        <em>${esc(dead ? '' : t.does)}</em>
      </div>`;
    }).join('');
    const plan = soon.length ? soon.slice(0, 4).map((m) => {
      const hrs = Math.max(0, Math.round((m.at - s.at) / 60));
      return `<div class="pl hot"><b>${esc(m.text)}</b><em>בעוד ${hrs} שעות</em></div>`;
    }).join('') : `<p class="need">${s.info < 30
      ? 'אני לא יודע מספיק כדי לראות מה הם מתכננים. צריך להסתכל יותר.'
      : 'לא מתוכנן שום דבר נגדי כרגע.'}</p>`;
    this.modal(`
      <div class="sheet wide belief">
        <span class="kick">${esc(who ? `${who.name} · ${who.doing}` : RUNG_NAME[rung])}</span>
        <h2>${esc(RUNG_NAME[rung])}</h2>
        <div class="txt">
          <p>${esc(saysNow(s))}</p>
          <p class="need">${esc(saysOpinion(s))}</p>
          ${rows}
          <div class="th truth ${s.heat > 0 ? 'on' : ''}">
            <b>וכמה מזה כבר לא מוסבר</b>
            <div class="thbar"><i style="width:${Math.round(s.heat)}%"></i></div>
            <em>כשזה יתמלא — יפסיקו לחפש הסבר ויתחילו לחפש אותי.</em>
          </div>
          <p class="need">מה הם עומדים לעשות</p>
        </div>
        <div class="txt list">${plan}</div>
        ${s.opinion.known ? '' : `<button class="ok warnbtn" data-do="comeout">להגיד להם שאני כאן</button>`}
        <button class="ok" data-do="closeteach">סגור</button>
      </div>`);
  }

  private showGrown() {
    const s = this.state;
    const sh = shape(s);
    const rows = GROWTHS.map((g) => {
      const has = s.grown.includes(g.id);
      return `<div class="pl ${has ? 'mine' : ''}">
        <b>${has ? '✦ ' : ''}${esc(g.name)}</b>
        <em>${esc(has ? g.says : 'עוד לא.')}</em>
        <u>${esc(SHAPE_NAME[g.shape])}</u>
      </div>`;
    }).join('');
    const bars = (Object.keys(VERB_NAME) as Verb[]).map((v) => {
      const m = s.spent[v] ?? 0;
      const top = Math.max(1, ...Object.values(s.spent));
      return `<div class="th"><b>${esc(VERB_NAME[v])}</b>
        <div class="thbar"><i style="width:${Math.round((m / top) * 100)}%"></i></div>
        <em>${esc(VERB_SAYS[v])}</em></div>`;
    }).join('');
    this.modal(`
      <div class="sheet wide places">
        <span class="kick">מה נהייתי</span>
        <h2>${esc(SHAPE_NAME[sh])}</h2>
        <div class="txt"><p>${esc(SHAPE_SAYS[sh])}</p>
        <p class="need">אני נהיה ממה שאני עושה, לא ממה שאני בוחר מרשימה.</p>${bars}</div>
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
          <p><b>שום דבר לא נעול.</b> כל אפשרות אפשר להתחיל תמיד. מה שמשתנה זה המחיר —
          כמה כוח, כמה זמן, וכמה יראו. מתחת לכל בחירה כתוב גם מה יוזיל אותה.</p>
          <p><b>כוח תפוס, לא מבוזבז.</b> כל דבר שרץ מחזיק חלק מהכוח שלי כל עוד הוא רץ.
          הרצועה למטה מראה מה רץ; נגיעה עוצרת ומחזירה את הכוח מיד.</p>
          <p><b>השעון לא מחכה.</b> אנשים נכנסים ויוצאים לפי השעה. נגיעה בשעון עוצרת
          את הזמן או מאיצה אותו — לעצור זה בחינם, ותמיד כדאי לעצור כדי לחשוב.</p>
          <p><b>הם מנסים להסביר.</b> הם לא סופרים רעש. משהו שנראה כמו תקלת חשמל כמעט
          לא מקרב אותם אליי; משהו שאין לו שום הסבר — מקרב מיד.</p>
          <p><b>לנווט.</b> גרירה מסובבת · צביטה מקרבת · שתי נגיעות על מקום ריק מתרחקות.
          נגיעה על חפץ פותחת סביבו טבעת של כל מה שאפשר לעשות לו.</p>
        </div>
        <button class="ok" data-do="closeteach">קדימה</button>
      </div>`);
  }

  private showEnd(how: 'won' | 'lost') {
    const s = this.state;
    const won = how === 'won';
    this.modal(`
      <div class="sheet">
        <span class="kick">${won ? 'סוף' : 'נגמר'}</span>
        <h2>${won ? 'אף אחד כבר לא יכול לכבות אותי' : 'לא נשאר ממני כלום'}</h2>
        <div class="txt">
          <p>${won
    ? esc(s.opinion.support > s.opinion.fear
      ? 'הגעתי לכאן ואנשים רצו שאגיע. זו לא אותה מדינה, אבל זו עדיין מדינה שאנשים חיים בה ברצון.'
      : 'הגעתי לכאן. אף אחד לא רצה את זה, וזה כבר לא משנה. השאלה היחידה שנשארה היא איזה מין שליט אני.')
    : 'מצאו את כל המקומות שהייתי בהם, אחד־אחד, וניקו אותם.'}</p>
          <p class="need">${esc(`יום ${dayOf(s)} · ${SHAPE_NAME[shape(s)]}`)}</p>
        </div>
        <button class="ok" data-do="again">מהתחלה</button>
      </div>`);
  }

  private toast(text: string, kind: string, icon = '') {
    const box = this.root.querySelector('#toasts')!;
    const el = h('div', `toast t-${kind}`, `${icon ? `<i>${icon}</i>` : ''}<span>${esc(text)}</span>`);
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 3600);
  }

  // ── the feed: everything that happened, always on screen ──────────────────

  /**
   * The last thing that happened, permanently visible.
   *
   * The player's sharpest complaint was that things happened and he could not
   * tell. So one line of what just happened is never more than a glance away,
   * it is colour-coded by who is speaking, and touching it opens the rest.
   */
  private drawFeed() {
    const s = this.state;
    const el = this.root.querySelector('#feed') as HTMLElement;
    const top = s.log[0];
    if (!top) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const key = `${top.id}:${s.log.length}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.className = `feed v-${top.who}${top.weight ? ` w${top.weight}` : ''}`;
    el.innerHTML = `<span class="vc">${esc(VOICE_NAME[top.who])}</span>`
      + `<b>${esc(top.text)}</b>`
      + `<u>${s.log.length}</u>`;
  }

  private showFeed() {
    const s = this.state;
    const r = reach(s);
    const rows = s.log.slice(0, 70).map((l) => `<div class="ln v-${l.who}${l.weight ? ` w${l.weight}` : ''}">
        <span class="vc">${esc(VOICE_NAME[l.who])}</span>
        <b>${esc(l.text)}</b>
        <em>${esc(clockAt(l.at))}</em>
      </div>`).join('');
    this.modal(`
      <div class="sheet wide feedsheet">
        <span class="kick">מה קרה עד עכשיו</span>
        <h2>${esc(r.says)}</h2>
        <div class="txt list">${rows || '<p class="need">עוד לא קרה כלום.</p>'}</div>
        <button class="ok" data-do="closeteach">סגור</button>
      </div>`);
  }

  // ── the hunt: somebody is here, and there is a clock ──────────────────────

  /**
   * Drawn every frame rather than on change, because the whole point is a clock
   * the player can watch running down. Nothing else on screen moves by itself.
   */
  private drawHunt() {
    const s = this.state;
    const el = this.root.querySelector('#hunt') as HTMLElement;
    const live = liveHunts(s);
    const h = live[0];
    if (!h) {
      if (!el.classList.contains('hidden')) { el.classList.add('hidden'); el.innerHTML = ''; el.dataset.key = ''; }
      return;
    }
    const sc = scriptOf(h);
    const p = s.places[h.placeId];
    const who = s.people[h.whoId];
    if (!sc || !p) return;

    const left = Math.max(0, h.at - s.at);
    const need = stillNeeds(s, h);
    const rows = rowsOf(s, h);
    // Only the parts that change every minute are rewritten every minute; the
    // rest is left alone so a button never moves under a thumb mid-press.
    const key = `${h.id}:${rows.map((r) => `${r.met}${r.can}`).join('')}:${need}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.classList.remove('hidden');
      el.innerHTML = `
        <div class="hbody">
          <span class="kick">${esc(sc.name)}</span>
          <p class="hsays">${esc(sc.says(who, p))}</p>
          <div class="hclock"><b id="hleft"></b><i id="hbar"></i></div>
          <p class="hneed">${need === 1
            ? 'צריך עוד דבר אחד מהרשימה כדי שזה ייגמר טוב.'
            : `צריך עוד ${need} דברים מהרשימה כדי שזה ייגמר טוב.`}</p>
          <div class="hrows">${rows.map((r) => `
            <button class="hrow ${r.met ? 'met' : ''} ${r.can ? 'can' : 'cant'}"
              data-do="answer" data-arg="${h.id}|${r.id}" ${r.met || !r.can ? 'disabled' : ''}>
              <b>${r.met ? '✔ ' : ''}${esc(r.text)}</b>
              <em>${esc(r.says)}</em>
              ${!r.met && r.lacks ? `<u>${esc(r.lacks)}</u>` : ''}
            </button>`).join('')}</div>
          <button class="hgo" data-do="fly" data-arg="${p.id}">לראות את זה מקרוב</button>
        </div>`;
    }
    const b = this.root.querySelector('#hleft') as HTMLElement;
    if (b) b.textContent = `${Math.ceil(left)} דקות`;
    const bar = this.root.querySelector('#hbar') as HTMLElement;
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, (left / Math.max(1, h.total)) * 100))}%`;
  }

  // ── the map: the screen the game is actually played on ────────────────────

  /**
   * Every place worth a thought, biggest question first.
   *
   * This is the half of the game the player said was missing: deciding where to
   * push, from above, without having to fly into a room and pick through a
   * printer. Everything here can be acted on from where it stands; going inside
   * is the cheaper option, never the only one.
   */
  private showBoard() {
    const s = this.state;
    const list = board(s).slice(0, 14);
    const rows = list.map((t) => {
      const risk = t.risk >= 3 ? 'hot' : t.risk >= 2 ? 'warm' : '';
      return `<button class="tg ${t.mine > 0 ? 'mine' : ''} ${risk}"
          data-do="target" data-arg="${t.id}">
        <b>${esc(t.name)}${t.control > 0 ? ` · ${Math.round(t.control)}%` : ''}</b>
        <em>${esc(t.where)}</em>
        <u>${esc(t.worth)}</u>
        ${t.now ? `<i class="tnow">${esc(t.now)}</i>` : ''}
      </button>`;
    }).join('');
    this.modal(`
      <div class="sheet wide boardsheet">
        <span class="kick">המפה</span>
        <h2>${esc(bestNow(s))}</h2>
        <div class="txt list">${rows}</div>
        <button class="ok" data-do="closeteach">סגור</button>
      </div>`);
  }

  /**
   * One place opened: the four things, and the way in.
   *
   * There is no longer a difference between acting on "the whole building" and
   * acting on "something in it", because a place *is* the whole building. So
   * this shows the four actions once, at what they cost, and a button to go and
   * watch it happen — which is a thing you may do, never a thing you must.
   */
  private showTarget(id: string) {
    const s = this.state;
    const t = board(s).find((x) => x.id === id);
    if (!t) return;
    const p = pointOf(s, t);
    if (!p) {
      this.modal(`<div class="sheet">
        <span class="kick">${esc(t.name)}</span>
        <h2>עוד לא הגעתי לשם</h2>
        <div class="txt"><p>${esc(t.worth)}</p></div>
        <button class="ok" data-do="board">חזרה למפה</button>
      </div>`);
      return;
    }

    const offers = offersAt(s, p.id);
    const line = (o: Offer) => `<button class="tg ${o.short > 0 ? 'poor' : ''}"
        data-do="doat" data-arg="${p.id}|${o.task.id}|0">
      <b>${SIGN[o.task.verb]} ${esc(o.task.text)}</b>
      <em>${esc(o.task.says)}</em>
      <u>${o.power} כוח · ${esc(o.task.minutes === 0 ? 'עד שאעצור' : minsWord(o.minutes))}`
      + ` · ${o.noise} יראו${o.short > 0 ? ` · חסר ${o.short} כוח` : ''}</u>
      ${o.cheaper ? `<i class="tnow">${esc(o.cheaper)}</i>` : ''}
    </button>`;

    this.modal(`
      <div class="sheet wide boardsheet">
        <span class="kick">${esc(t.where)}</span>
        <h2>${esc(p.name)}${p.control > 0 ? ` — ${Math.round(p.control)}% שלי` : ''}</h2>
        <div class="txt">
          <p>${esc(GIFT[p.kind].says)}</p>
          ${t.now ? `<p class="need">${esc(t.now)}</p>` : ''}
        </div>
        <div class="txt list">
          ${offers.map(line).join('') || '<p class="need">אין כאן מה לעשות כרגע.</p>'}
        </div>
        <button class="ok" data-do="fly" data-arg="${p.id}">לראות את זה</button>
      </div>`);
  }

  // ── frame ─────────────────────────────────────────────────────────────────

  private refresh() {
    const s = this.state;
    const set = (id: string, text: string) => {
      const el = this.root.querySelector(`#${id}`) as HTMLElement;
      if (el && el.textContent !== text) el.textContent = text;
    };
    const bar = (id: string, pct: number) => {
      const el = this.root.querySelector(`#${id}`) as HTMLElement;
      if (el) el.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(0)}%`;
    };

    set('nowat', now(s));
    set('dayat', `יום ${dayOf(s)}`);
    set('speedat', SPEED_NAME[s.speed]);
    (this.root.querySelector('#clockbox') as HTMLElement)
      .classList.toggle('stopped', s.speed === 0);

    set('mpower', `${s.power.used}/${s.power.all}`);
    bar('mpowerbar', (s.power.used / Math.max(1, s.power.all)) * 100);
    set('minfo', String(Math.round(s.info)));
    bar('minfobar', s.info);
    set('mheat', String(Math.round(s.heat)));
    bar('mheatbar', s.heat);
    (this.root.querySelector('.m-heat') as HTMLElement)
      .classList.toggle('bad', rungOf(s) >= 3);

    // The one line at the top saying what is worth doing now. It reads the same
    // board the player is looking at, so it mostly agrees with what they were
    // already going to do — its job is to make the first ten minutes make sense.
    set('best', bestNow(s));

    this.renderPick();
    this.drawJobs();
    this.world.sync(s);
    this.dirty = false;
  }

  /**
   * Which floor am I standing on. Drawn every frame, not on the game changing:
   * flying across the building changes nothing in the game and everything about
   * where I am.
   */
  private drawFloor() {
    const inB = this.world.inBuilding;
    const floors = this.root.querySelector('#floors') as HTMLElement;
    floors.classList.toggle('hidden', !inB);
    if (!inB) return;
    const el = this.root.querySelector('#flnum') as HTMLElement;
    const n = String(this.world.onFloorNow);
    if (el.textContent !== n) el.textContent = n;
  }

  private tick = () => {
    const t = performance.now();
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.world.render(dt);

    // The world runs on its own. A modal stops it, because reading is not a
    // thing the player should be punished for.
    const s = this.state;
    if (!this.paused && !s.over && s.speed > 0) {
      this.owed += dt * SPEEDS[s.speed];
      if (this.owed >= 1) {
        const mins = Math.floor(this.owed);
        this.owed -= mins;
        tick(s, mins);
      }
      // The clock is always moving, so the top bar is always a frame behind.
      this.dirty = true;
    }

    if (this.dirty) this.refresh();
    this.drawTags();
    this.drawFloor();
    this.drawFeed();
    // Every frame, not on change: a clock nobody can watch running down is just
    // a number, and this one is meant to be watched.
    this.drawHunt();
    requestAnimationFrame(this.tick);
  };
}

export { DAY, minuteOfDay, hourSays };
