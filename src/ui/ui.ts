import { audio } from '../audio/audio';
import { World } from '../render/world';
import { BUILDINGS, FLOOR_H } from '../render/city';
import { bus } from '../game/bus';
import {
  DAY, TEACH, dayOf, minuteOfDay, now, save, shape, tick,
} from '../game/game';
import { SPEEDS, SPEED_NAME, crowd, hourSays, seenAt } from '../game/clock';
import { Offer, offersAt, start, stop } from '../game/jobs';
import { GROWTHS, SHAPE_NAME, SHAPE_SAYS } from '../game/grow';
import { comeOut, saysOpinion } from '../game/opinion';
import { STORIES, asking, coming, leading, rungOf, saysNow } from '../game/watch';
import { AREA_KIND_NAME, RUNG_NAME, VERB_NAME, VERB_SAYS } from '../game/types';
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
  /** One live button per choice, moved rather than rebuilt. */
  private ring = new Map<string, HTMLButtonElement>();
  /** The choice the bottom strip is explaining. */
  private focused: string | null = null;
  /** The choice a second tap would actually start. Opening a ring never arms one. */
  private armed: string | null = null;
  /** Real seconds of world time owed but not yet handed over. */
  private owed = 0;
  /**
   * Which of the seven the ring is showing.
   *
   * Every option at a place is always on offer, but twenty circles on a phone
   * is a wall and not a choice. So the ring asks the useful question first —
   * what kind of thing am I doing — and then shows every option of that kind.
   */
  private verb: Verb | null = null;

  constructor(private root: HTMLElement, private state: GameState) {
    this.worldEl = h('div', 'world');
    root.appendChild(this.worldEl);
    this.world = new World(this.worldEl);
    this.world.build(state);
    this.world.sync(state);

    root.appendChild(this.shell());
    this.bind();
    this.wire();
    // The first thing I saw was me. Start looking at the machine I woke in,
    // not at a city I have never heard of.
    const me = Object.values(state.places).find((p) => p.control >= 100) ?? state.places.home;
    if (me) { this.world.enter(me.buildingId, me.floor); this.world.goTo(me, true); this.select(me.id); }
    else this.world.wide();
    this.refresh();
    requestAnimationFrame(this.tick);
  }

  private shell(): HTMLElement {
    const hud = h('div', 'hud');
    hud.innerHTML = `
      <div id="tags"></div>
      <div id="ring"></div>

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
        <button class="icon" data-do="grown" title="מה נהייתי">◈</button>
        <button class="icon" data-do="help" title="איך משחקים">?</button>
      </header>

      <div id="floors" class="floors hidden">
        <button class="fl" data-do="up">▲</button>
        <b id="flnum">0</b>
        <button class="fl" data-do="down">▼</button>
      </div>

      <div id="bottom">
        <div id="pick" class="pick hidden">
          <button class="x" data-do="close">✕</button>
          <span class="who" id="pickwho"></span>
          <b id="picktitle"></b>
          <p id="picksays"></p>
          <p id="pickwhy" class="why"></p>
          <p id="pickcheap" class="cheap"></p>
          <div class="row">
            <span class="price"><i id="pickpower"></i> כוח</span>
            <span class="price"><i id="pickmins"></i> דקות</span>
            <span class="price noise"><i id="picknoise"></i> יראו</span>
            <button class="do" id="pickdo" data-do="commit">להתחיל</button>
          </div>
        </div>
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

      case 'verb': {
        const [, v] = arg.split('|');
        this.verb = (v || null) as Verb | null;
        this.focused = v ? `v:${v}` : null;
        this.armed = null;
        this.dirty = true;
        break;
      }
      case 'focus': {
        const [, taskId] = arg.split('|');
        // First tap explains it; a second tap on the same one starts it.
        if (this.armed === taskId) this.act('commit', arg);
        else { this.focused = taskId; this.armed = taskId; this.dirty = true; }
        break;
      }
      case 'commit': {
        const [placeId, taskId] = arg.split('|');
        if (!placeId || !taskId) break;
        if (start(s, placeId, taskId)) { this.armed = null; save(s); }
        this.dirty = true;
        break;
      }
      case 'stopjob': { stop(s, arg); save(s); this.dirty = true; break; }

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
      this.focused = null;
      this.armed = null;
      this.verb = null;
    }
    this.selected = id;
    if (id) {
      const p = this.state.places[id];
      if (p && (p.control > 0 || p.found)) this.world.goTo(p, true);
    }
    this.dirty = true;
  }

  // ── the ring: what you can do, drawn on the thing itself ──────────────────

  private drawRing() {
    const box = this.root.querySelector('#ring') as HTMLElement;
    const s = this.state;
    const p = this.selected ? s.places[this.selected] : null;
    if (!p || (p.control <= 0 && !p.found)) {
      for (const [, el] of this.ring) el.remove();
      this.ring.clear();
      return;
    }
    const at = this.world.project(p.id);
    if (!at || at.z > 1) return;

    const offers = offersAt(s, p.id);
    type Node = { key: string; sign: string; name: string; foot: string; cls: string; act: string; arg: string };
    let nodes: Node[];
    if (this.verb === null) {
      const byVerb = new Map<Verb, Offer[]>();
      for (const o of offers) {
        const list = byVerb.get(o.task.verb) ?? [];
        list.push(o);
        byVerb.set(o.task.verb, list);
      }
      nodes = [...byVerb].map(([v, list]) => ({
        key: `v:${v}`, sign: SIGN[v], name: VERB_NAME[v], foot: `${list.length}`,
        cls: `rb v-${v}${this.focused === `v:${v}` ? ' on' : ''}`,
        act: 'verb', arg: `${p.id}|${v}`,
      }));
    } else {
      const mine = offers.filter((o) => o.task.verb === this.verb);
      nodes = [
        { key: 'back', sign: '↺', name: 'הכל', foot: '', cls: 'rb back', act: 'verb', arg: `${p.id}|` },
        ...mine.map((o) => ({
          key: o.task.id, sign: SIGN[o.task.verb], name: shortName(o.task.text),
          foot: o.task.minutes === 0 ? `${o.power} כוח` : `${o.minutes}׳`,
          cls: `rb v-${o.task.verb} n-${Math.min(3, o.noise)}`
            + `${o.short > 0 ? ' short' : ''}${this.focused === o.task.id ? ' on' : ''}`,
          act: 'focus', arg: `${p.id}|${o.task.id}`,
        })),
      ];
    }

    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    const phone = W < 700;
    const R = phone ? 112 : 138;

    const dir = Math.atan2(H * 0.42 - at.y, W * 0.5 - at.x);
    const step = Math.min(0.82, (Math.PI * 1.5) / Math.max(1, nodes.length - 1));
    const live = new Set<string>();

    // Where each one would like to sit.
    const want = nodes.map((_, i) => {
      const t = nodes.length === 1 ? 0 : (i / (nodes.length - 1) - 0.5);
      const ang = dir + t * step * (nodes.length - 1);
      const ring = i < 7 ? R : R + (phone ? 66 : 78);
      return { x: at.x + Math.cos(ang) * ring, y: at.y + Math.sin(ang) * ring };
    });

    // The floor stepper lives down the inline-start edge, which is the right in
    // Hebrew, and the strip owns the bottom. Clamping alone used to pile two
    // circles into the same spot when the fan ran off an edge, so afterwards
    // they push each other apart until nothing is sitting on anything.
    const right = this.world.inBuilding ? W - 86 : W - 46;
    const low = H - (phone ? 216 : 168);
    const fit = (v: { x: number; y: number }) => {
      v.x = Math.min(right, Math.max(46, v.x));
      v.y = Math.min(low, Math.max(100, v.y));
    };
    const GAP = phone ? 84 : 92;
    want.forEach(fit);
    for (let pass = 0; pass < 12; pass++) {
      let moved = false;
      for (let i = 0; i < want.length; i++) {
        for (let j = i + 1; j < want.length; j++) {
          const dx = want[j].x - want[i].x;
          const dy = want[j].y - want[i].y;
          const d = Math.hypot(dx, dy);
          if (d >= GAP) continue;
          const push = (GAP - d) / 2 + 0.5;
          const ux = d < 0.01 ? 1 : dx / d;
          const uy = d < 0.01 ? 0 : dy / d;
          want[i].x -= ux * push; want[i].y -= uy * push;
          want[j].x += ux * push; want[j].y += uy * push;
          fit(want[i]); fit(want[j]);
          moved = true;
        }
      }
      if (!moved) break;
    }

    nodes.forEach((n, i) => {
      const { x, y } = want[i];
      let el = this.ring.get(n.key);
      if (!el) {
        el = document.createElement('button');
        el.innerHTML = '<b></b><span></span><u></u>';
        box.appendChild(el);
        this.ring.set(n.key, el);
      }
      el.dataset.do = n.act;
      el.dataset.arg = n.arg;
      const set = (sel: string, text: string) => {
        const t2 = el!.querySelector(sel) as HTMLElement;
        if (t2.textContent !== text) t2.textContent = text;
      };
      set('b', n.sign); set('span', n.name); set('u', n.foot);
      if (el.className !== n.cls) el.className = n.cls;
      el.style.transform = `translate(calc(${Math.round(x)}px - 50%), calc(${Math.round(y)}px - 50%))`;
      live.add(n.key);
    });

    for (const [id, el] of this.ring) {
      if (live.has(id)) continue;
      el.remove();
      this.ring.delete(id);
    }
  }

  /**
   * The strip that explains whichever choice you are on.
   *
   * This is where the promise of the whole game is kept: the price, the reason
   * for the price, and the one thing that would make it cheaper. Never a lock.
   */
  private renderPick() {
    const s = this.state;
    const pick = this.root.querySelector('#pick') as HTMLElement;
    const p = this.selected ? s.places[this.selected] : null;
    const offers = p ? offersAt(s, p.id) : [];
    const o = offers.find((x) => x.task.id === this.focused) ?? null;
    const verb = this.focused?.startsWith('v:') ? this.focused.slice(2) as Verb : null;
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

    const set = (id: string, text: string) => {
      const el = this.root.querySelector(`#${id}`) as HTMLElement;
      if (el.textContent !== text) el.textContent = text;
    };
    set('pickwho', `${p.name} · ${Math.round(p.control)}% שלי · ${head}`);
    set('picktitle', o ? o.task.text : verb ? VERB_NAME[verb] : 'מה לעשות כאן?');
    set('picksays', o ? o.task.says
      : verb ? `${VERB_SAYS[verb]}. בחרו איך.`
        : `${offers.length} דברים אפשר לעשות כאן. אף אחד מהם לא נעול — הם רק עולים אחרת.`);
    set('pickwhy', o ? o.why.join(' · ') : '');
    set('pickcheap', o?.cheaper ?? '');
    set('pickpower', o ? String(o.power) : '—');
    set('pickmins', o ? (o.task.minutes === 0 ? '∞' : String(o.minutes)) : '—');
    set('picknoise', o ? String(o.noise) : '—');
    (this.root.querySelector('#pickcheap') as HTMLElement).classList.toggle('none', !o?.cheaper);

    const go = this.root.querySelector('#pickdo') as HTMLButtonElement;
    const short = (o?.short ?? 0) > 0;
    go.className = `do${o ? (short ? ' warn' : '') : ' off'}`;
    go.textContent = !o ? 'להתחיל' : short ? `צריך לפנות ${o.short} כוח` : 'להתחיל';
    go.dataset.arg = o ? `${p.id}|${o.task.id}` : '';
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
    const mine = Object.values(s.places).filter((p) => p.control > 0)
      .sort((x, y) => y.control - x.control)
      .map((p) => `<button class="pl mine" data-do="fly" data-arg="${p.id}">
        <b>${esc(p.name)} · ${Math.round(p.control)}%</b>
        <em>${esc(p.where)}${p.copy ? ' · יש כאן חלק ממני' : ''}${p.dug > 0 ? ` · תפוס חזק (${Math.round(p.dug)})` : ''}</em>
      </button>`).join('');
    this.modal(`
      <div class="sheet wide places">
        <span class="kick">מה אני יודע</span>
        <h2>מידע: ${Math.round(s.info)}</h2>
        <div class="txt"><p>ככל שאני יודע יותר, אני רואה יותר מהעיר — ורואה מראש מה הם עומדים לעשות.</p></div>
        <div class="txt list">${rows}</div>
        <div class="txt"><p class="need">המקומות שלי</p></div>
        <div class="txt list">${mine || '<p class="need">עוד אין לי שום מקום.</p>'}</div>
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
    this.drawRing();
    this.drawFloor();
    requestAnimationFrame(this.tick);
  };
}

export { DAY, minuteOfDay, hourSays };
