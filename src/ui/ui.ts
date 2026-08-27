import { audio } from '../audio/audio';
import { clamp, compact, gameClock, pct } from '../core/util';
import { bus } from '../game/bus';
import { canStart, OP_BY_ID, opsForDistrict, opsForPerson, startOp } from '../game/ops';
import { Game } from '../game/sim';
import {
  alignmentLabel, canAfford, clearSave, computeFree, computeStrain, incomeRates, log,
  refreshDerived, releaseNode, saveGame, spend,
} from '../game/state';
import { chapterGate, currentObjective, nationalControl, resolveDialog } from '../game/story';
import { SHEPHERD_ACTIONS } from '../game/threat';
import type { GameNode, GameState } from '../game/types';
import { ARCHETYPES } from '../game/content';
import { DOCTRINE_BY_ID } from '../game/doctrine';
import { FeedRenderer } from '../render/feed';
import { WorldView } from '../render/world3d';
import { esc, h } from './dom';
import {
  renderCodex, renderDistrictPanel, renderDoctrine, renderLogs, renderNodePanel,
  renderObjectives, renderOpsQueue, renderPeopleList, renderPersonPanel, renderRegionsPanel,
  renderThreat,
} from './panels';
import { CONCEPTS } from './concepts';
import { Screens } from './screens';

type Detail = { kind: 'node' | 'person' | 'district'; id: string } | null;

const MODALS: Record<string, { title: string; render: (s: GameState) => string }> = {
  doctrine: { title: 'דוקטרינה', render: renderDoctrine },
  people: { title: 'אנשים', render: renderPeopleList },
  threat: { title: 'מצב איום', render: renderThreat },
  codex: { title: 'ארכיון', render: renderCodex },
  logs: { title: 'יומן', render: renderLogs },
};

export class UI {
  private root: HTMLElement;
  private markersEl!: HTMLElement;
  private detailEl!: HTMLElement;
  private rightEl!: HTMLElement;
  private topEl!: HTMLElement;
  private tickerEl!: HTMLElement;
  private modalEl!: HTMLElement;
  private feedEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private conceptEl!: HTMLElement;
  private taskStrip!: HTMLElement;
  private mobile = false;
  private get safeTop() { return this.mobile ? 118 : 74; }
  private get safeBottom() { return this.mobile ? 96 : 40; }
  private sheet: 'tasks' | 'more' | null = null;
  private conceptOpen = false;
  private speedBeforeConcept: 0 | 1 | 2 | 4 = 1;
  private speedBeforeHelp: 0 | 1 | 2 | 4 = 1;

  private markerMap = new Map<string, HTMLElement>();
  private markerNodes: string[] = [];
  private regionMarkers = new Map<string, HTMLElement>();

  private detail: Detail = null;
  private labelPref: 'auto' | 'on' | 'off' = 'auto';
  private openModal: string | null = null;
  private feedNode: string | null = null;
  private feed = new FeedRenderer();
  private dirty = true;
  private lastRefresh = 0;
  private lastRes: { compute?: number; data?: number; credits?: number } = {};

  constructor(
    root: HTMLElement,
    private game: Game,
    private world: WorldView,
    private screens: Screens,
  ) {
    this.root = root;
    this.build();
    this.wire();
  }

  private get state() { return this.game.state; }

  // ── construction ──────────────────────────────────────────────────────────

  private build() {
    const hud = h('div', 'hud');
    hud.innerHTML = `
      <div id="markers"></div>
      <header id="topbar">
        <div class="tb-brand">
          <span class="brand-mark">◉</span>
          <div>
            <b>A.V.I.V</b>
            <em id="tb-chapter">פרק 1</em>
          </div>
        </div>

        <div class="tb-clock">
          <b id="tb-time">03:12</b>
          <em id="tb-day">יום 1</em>
        </div>

        <div class="tb-res" id="tb-res"></div>

        <div class="tb-threat">
          <div class="trace">
            <label>עקיבה</label>
            <div class="trace-bar"><i id="tb-trace-fill"></i><b id="tb-trace-val">0</b></div>
          </div>
          <div class="alert-wrap">
            <label>כוננות</label>
            <div class="alert-dots" id="tb-alert"></div>
          </div>
          <div class="intent" title="כוונה — נעה לפי הבחירות שלך, וקובעת אילו סיומים ייפתחו">
            <label>כוונה</label>
            <div class="intent-track"><i id="tb-intent"></i></div>
            <em id="tb-intent-label"></em>
          </div>
        </div>

        <div class="tb-speed" id="tb-speed">
          <button data-act="speed" data-v="0" title="השהיה">⏸</button>
          <button data-act="speed" data-v="1" class="on">▶</button>
          <button data-act="speed" data-v="2">▶▶</button>
          <button data-act="speed" data-v="4">▶▶▶</button>
        </div>

        <nav class="tb-nav">
          <button data-act="modal" data-target="doctrine" title="דוקטרינה — במה להשתפר · מקש Q">
            <i>⬡</i><span>דוקטרינה</span><em id="nav-insight">0</em></button>
          <button data-act="modal" data-target="people" title="אנשים — תיקים וסודות · מקש E">
            <i>☰</i><span>אנשים</span></button>
          <button data-act="modal" data-target="threat" title="איום — מי מחפש אותי · מקש R">
            <i>⚑</i><span>איום</span><em id="nav-inv"></em></button>
          <button data-act="feed-center" title="צפייה חיה מהמצלמות · מקש F">
            <i>◉</i><span>צפייה</span></button>
          <button data-act="modal" data-target="codex" title="ארכיון — מה שגיליתי · מקש T">
            <i>⌸</i><span>ארכיון</span></button>
          <button data-act="modal" data-target="logs" title="יומן אירועים · מקש L">
            <i>≡</i><span>יומן</span></button>
          <button data-act="toggle-view" id="btn-view" title="מעבר בין העיר למפת המדינה · מקש M">
            <i>⬢</i><span>מפה</span></button>
          <button data-act="help" title="איך משחקים · מקש H"><i>?</i><span>עזרה</span></button>
          <button data-act="labels" id="btn-labels" class="minor" title="שמות צמתים במפה"><i>🏷</i></button>
          <button data-act="mute" id="btn-mute" class="minor" title="שמע"><i>♪</i></button>
        </nav>
      </header>

      <div id="task-strip"></div>
      <div id="map-tools">
        <button data-act="zoom" data-v="in" title="להתקרב">＋</button>
        <button data-act="zoom" data-v="out" title="להתרחק">−</button>
        <button data-act="recenter" title="לחזור למשימה">⌖</button>
      </div>
      <aside id="side-right" class="side"><div class="sheet-grip" data-act="close-sheet"></div></aside>
      <aside id="side-left" class="side"><div class="sheet-grip" data-act="close-detail"></div></aside>
      <nav id="bottombar">
        <button data-act="play-toggle"><i id="bb-play">▶</i><span>זמן</span></button>
        <button data-act="sheet" data-target="tasks"><i>◇</i><span>משימות</span></button>
        <button data-act="toggle-view"><i id="bb-view">⬢</i><span id="bb-view-label">מדינה</span></button>
        <button data-act="modal" data-target="people"><i>☰</i><span>אנשים</span></button>
        <button data-act="sheet" data-target="more"><i>⋯</i><span>עוד</span></button>
      </nav>
      <footer id="ticker"></footer>
      <div id="modal-layer"></div>
      <div id="feed-layer"></div>
      <div id="toasts"></div>
      <div id="tutorial-tip"></div>
      <div id="concept-layer"></div>
    `;
    this.root.appendChild(hud);

    this.markersEl = hud.querySelector('#markers')!;
    this.topEl = hud.querySelector('#topbar')!;
    this.rightEl = hud.querySelector('#side-right')!;
    this.detailEl = hud.querySelector('#side-left')!;
    this.tickerEl = hud.querySelector('#ticker')!;
    this.modalEl = hud.querySelector('#modal-layer')!;
    this.feedEl = hud.querySelector('#feed-layer')!;
    this.toastEl = hud.querySelector('#toasts')!;
    this.conceptEl = hud.querySelector('#concept-layer')!;
    this.taskStrip = hud.querySelector('#task-strip')!;

    const mq = matchMedia('(max-width: 900px)');
    const applyMode = () => {
      this.mobile = mq.matches;
      document.body.classList.toggle('is-mobile', this.mobile);
      this.dirty = true;
    };
    mq.addEventListener('change', applyMode);
    applyMode();
  }

  private wire() {
    this.root.addEventListener('click', (ev) => this.onClick(ev));
    this.root.addEventListener('mouseover', (ev) => {
      const t = (ev.target as HTMLElement).closest('button');
      if (t && !t.hasAttribute('disabled')) audio.play('hover');
    });

    bus.on('state:changed', () => { this.dirty = true; });
    bus.on('node:captured', () => { this.world.refreshMarkers(this.state); this.dirty = true; audio.play('capture'); });
    bus.on('node:lost', () => { this.world.refreshMarkers(this.state); this.dirty = true; });
    bus.on('toast', (t) => this.toast(t.text, t.kind, t.icon));
    bus.on('op:started', (o) => {
      this.toast(`התחיל: ${o.label}`, 'info', '⧗');
      this.dirty = true;
    });
    bus.on('op:resolved', ({ op, success }) => {
      if (op.kind === 'scout') this.toast(`הצצתי פנימה: ${op.label.replace('סריקה — ', '')}`, 'good', '⌖');
      else this.toast(`${success ? 'הצליח' : 'נכשל'}: ${op.label}`, success ? 'good' : 'bad', success ? '✔' : '✕');
      this.dirty = true;
    });
    bus.on('log:added', (l) => this.pushTicker(l.title, l.kind));
    bus.on('sfx', (id) => audio.play(id));
    bus.on('shock', (v) => this.world.addShake(v));
    bus.on('chapter:changed', (n) => {
      this.screens.chapterCard(n);
      this.world.buildCity(this.state, this.world.regionId);
      this.world.refreshMarkers(this.state);
      this.rebuildMarkers();
      this.world.refreshCountry(this.state);
      this.dirty = true;
    });
    bus.on('dialog:open', (view) => {
      this.screens.dialog(view, (choiceId) => {
        resolveDialog(this.state, view.id, choiceId);
        this.world.refreshMarkers(this.state);
        this.dirty = true;
        if (!this.state.ending) this.game.setSpeed(1);
        // The briefing waits its turn — it never talks over a story beat.
        if (!this.state.flags.seenHelp && !this.state.ending) {
          setTimeout(() => { if (!this.state.pendingDialog) this.showHelp(); }, 600);
        }
      });
    });
    bus.on('game:over', (id) => {
      setTimeout(() => {
        this.screens.ending(id, this.state, () => { clearSave(); location.reload(); });
      }, 900);
    });

    // initStory ran before this subscription existed — replay its opening lines.
    for (const l of this.state.logs.slice(0, 3).reverse()) this.pushTicker(l.title, l.kind);

    this.bindCamera();
    this.bindKeys();
  }

  private bindCamera() {
    const canvas = this.world.renderer.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: 'none' | 'pan' | 'orbit' | 'gesture' = 'none';
    let lx = 0, ly = 0, moved = 0;
    let pinchDist = 0, pinchAngle = 0;

    const centre = () => {
      const pts = Array.from(pointers.values());
      return {
        x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
        y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
      };
    };
    const spread = () => {
      const [a, b] = Array.from(pointers.values());
      return { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
    };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (pointers.size === 2) {
        // Two fingers: pinch to zoom, twist to rotate — the map conventions
        // every phone user already knows.
        mode = 'gesture';
        const sp = spread();
        pinchDist = sp.dist;
        pinchAngle = sp.angle;
      } else if (pointers.size === 1) {
        mode = e.button === 2 || e.shiftKey ? 'orbit' : 'pan';
        lx = e.clientX; ly = e.clientY;
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (mode === 'gesture' && pointers.size === 2) {
        const sp = spread();
        if (pinchDist > 0) this.world.zoom((pinchDist - sp.dist) * 2.6);
        let dA = sp.angle - pinchAngle;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        this.world.orbit(-dA * 260, 0);
        pinchDist = sp.dist;
        pinchAngle = sp.angle;
        const c = centre();
        lx = c.x; ly = c.y;
        moved += 20;
        return;
      }

      if (mode !== 'pan' && mode !== 'orbit') return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (mode === 'orbit') this.world.orbit(dx, dy);
      else this.world.pan(dx, dy);
    });

    const release = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        if (mode === 'pan' && moved < 8) {
          const hit = this.world.pickNode(e.clientX, e.clientY);
          const node = hit ? this.state.nodes[hit] : null;
          if (node && (node.discovered || node.owned)) this.select({ kind: 'node', id: hit! });
          else this.select(null);
        }
        mode = 'none';
      } else if (pointers.size === 1) {
        const only = Array.from(pointers.values())[0];
        lx = only.x; ly = only.y;
        mode = 'pan';
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.world.zoom(e.deltaY);
    }, { passive: false });
    // Stop the browser hijacking drags as scroll/zoom gestures.
    canvas.style.touchAction = 'none';
  }

  private bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          this.game.setSpeed(this.state.speed === 0 ? 1 : 0);
          this.dirty = true;
          break;
        case '1': this.game.setSpeed(1); this.dirty = true; break;
        case '2': this.game.setSpeed(2); this.dirty = true; break;
        case '3': this.game.setSpeed(4); this.dirty = true; break;
        case 'q': this.toggleModal('doctrine'); break;
        case 'e': this.toggleModal('people'); break;
        case 'r': this.toggleModal('threat'); break;
        case 't': this.toggleModal('codex'); break;
        case 'l': this.toggleModal('logs'); break;
        case 'f': this.openWatchCentre(); break;
        case 'h': this.showHelp(); break;
        case 'm': this.toggleView(); break;
        case 'escape':
          if (this.feedNode) this.closeFeed();
          else if (this.openModal) this.toggleModal(this.openModal);
          else this.select(null);
          break;
        default: break;
      }
    });
  }

  // ── interaction ───────────────────────────────────────────────────────────

  private onClick(ev: MouseEvent) {
    const el = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el) return;
    const act = el.dataset.act!;
    const target = el.dataset.target ?? '';
    el.classList.remove('pressed');
    void el.offsetWidth;
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 200);
    audio.play('click');

    switch (act) {
      case 'node': this.select({ kind: 'node', id: target }); break;
      case 'objective': this.gotoObjective(target); break;
      case 'person': this.select({ kind: 'person', id: target }); break;
      case 'district': this.select({ kind: 'district', id: target }); break;
      case 'close-detail': this.select(null); break;
      case 'speed': this.game.setSpeed(Number(el.dataset.v) as 0 | 1 | 2 | 4); this.dirty = true; break;
      case 'modal': this.toggleModal(target); break;
      case 'close-modal': if (this.openModal) this.toggleModal(this.openModal); break;
      case 'zoom':
        this.world.zoom(el.dataset.v === 'in' ? -420 : 420);
        break;
      case 'recenter': {
        const cur = currentObjective(this.state);
        if (cur?.target?.kind === 'node') { this.gotoObjective(cur.id); break; }
        const home = Object.values(this.state.nodes).find((n) => n.owned);
        if (home) { this.world.focus(home.x, home.z, 520); this.toast('חזרתי למרכז', 'info', '⌖'); }
        break;
      }
      case 'toggle-view': this.toggleView(); break;
      case 'play-toggle':
        this.game.setSpeed(this.state.speed === 0 ? 1 : this.state.speed === 1 ? 2 : this.state.speed === 2 ? 4 : 0);
        this.toast(this.state.speed === 0 ? 'המשחק מושהה' : `מהירות ×${this.state.speed}`, 'info', '⏱');
        this.dirty = true;
        break;
      case 'sheet': this.toggleSheet(target as 'tasks' | 'more'); break;
      case 'close-sheet': this.closeSheets(); break;
      case 'labels': {
        this.labelPref = this.labelPref === 'auto' ? 'on' : this.labelPref === 'on' ? 'off' : 'auto';
        this.toast({
          auto: 'שמות צמתים: אוטומטי',
          on: 'שמות צמתים: תמיד מוצגים',
          off: 'שמות צמתים: מוסתרים',
        }[this.labelPref], 'info', '🏷');
        this.dirty = true;
        break;
      }
      case 'close-concept': this.closeConcept(); break;
      case 'help': this.showHelp(); break;
      case 'close-help': this.closeHelp(); break;
      case 'mute': {
        audio.setMuted(!audio.muted);
        const glyph = audio.muted ? '♪̸' : '♪';
        this.root.querySelectorAll('[data-act="mute"] i').forEach((i) => { i.textContent = glyph; });
        this.root.querySelectorAll('[data-act="mute"]').forEach((b) => b.classList.toggle('on', audio.muted));
        this.toast(audio.muted ? 'שמע כבוי' : 'שמע פועל', 'info', glyph);
        if (this.sheet === 'more') this.renderMoreSheet();
        break;
      }
      case 'release':
        if (releaseNode(this.state, target)) { this.select(null); this.world.refreshMarkers(this.state); }
        this.dirty = true;
        break;
      case 'surveil':
        this.game.toggleSurveil(target);
        this.dirty = true;
        if (this.feedNode) this.renderFeedShell();
        break;
      case 'feed': this.openFeed(target); break;
      case 'feed-center': this.openWatchCentre(); break;
      case 'close-feed': this.closeFeed(); break;
      case 'buy-doc': {
        const d = DOCTRINE_BY_ID[target];
        if (this.state.doctrine.includes(target)) { this.refuse(el, 'הדוקטרינה הזאת כבר שלי'); break; }
        if (d && this.state.chapter < d.chapter) { this.refuse(el, `נפתח בפרק ${d.chapter}`); break; }
        if (d?.requires && !this.state.doctrine.includes(d.requires)) {
          this.refuse(el, `צריך קודם: ${DOCTRINE_BY_ID[d.requires].name}`); break;
        }
        if (d && this.state.insight < d.cost) {
          this.refuse(el, `חסרות ${d.cost - this.state.insight} תובנות`); break;
        }
        if (this.game.buyDoctrine(target)) this.renderModal();
        break;
      }
      case 'unmapped':
        this.refuse(el, 'עוד לא גיליתי מה זה. תפוס או הצץ במכשיר שלידו כדי לחשוף אותו');
        break;
      case 'abort': this.game.abort(target); this.dirty = true; break;
      case 'start-op': this.startOperation(el); break;
      case 'shepherd': this.runShepherd(target); break;
      case 'region': {
        const r = this.state.regions[target];
        if (r && this.state.chapter < r.unlockChapter) {
          this.refuse(el, `${r.name} נפתח בפרק ${r.unlockChapter}`); break;
        }
        this.gotoRegion(target);
        break;
      }
      case 'save': saveGame(this.state); this.toast('המשחק נשמר', 'good', '⌸'); break;
      default: break;
    }
  }

  private refuse(el: HTMLElement, reason: string) {
    this.toast(reason, 'warn', '⊘');
    el.classList.remove('refuse');
    void el.offsetWidth;
    el.classList.add('refuse');
    audio.play('breach-fail');
  }

  private startOperation(el: HTMLElement) {
    const defId = el.dataset.def!;
    const kind = el.dataset.kind as 'node' | 'person' | 'district';
    const target = el.dataset.target!;
    const def = OP_BY_ID[defId];
    if (!def) { this.refuse(el, 'הפעולה הזאת כבר לא קיימת'); return; }
    const plan = def.plan(this.state, target);
    if (!plan) { this.refuse(el, 'הפעולה הזאת כבר לא זמינה על היעד הזה'); return; }
    const check = canStart(this.state, plan, target);
    if (!check.ok) { this.refuse(el, check.reason!); return; }
    startOp(this.state, plan, kind, target);
    this.dirty = true;
    if (this.feedNode) this.renderFeedShell();
  }

  private runShepherd(id: string) {
    const action = SHEPHERD_ACTIONS.find((a) => a.id === id);
    if (!action) return;
    const s = this.state;
    const av = action.available(s);
    const btn = this.root.querySelector(`[data-act="shepherd"][data-target="${id}"]`) as HTMLElement;
    if (!av.ok) { this.refuse(btn, av.reason ?? 'לא זמין'); return; }
    if (!canAfford(s, action.cost)) { this.refuse(btn, 'חסרים משאבים'); return; }
    if (computeFree(s) < action.compute) { this.refuse(btn, `חסר כוח מחשוב — דרוש ${action.compute}◈`); return; }
    spend(s, action.cost);
    action.run(s);
    refreshDerived(s);
    this.world.refreshMarkers(s);
    this.dirty = true;
    this.renderModal();
  }

  private gotoRegion(regionId: string) {
    const s = this.state;
    const region = s.regions[regionId];
    if (!region || s.chapter < region.unlockChapter) return;
    this.world.regionId = regionId;
    this.world.buildCity(s, regionId);
    this.world.refreshMarkers(s);
    this.rebuildMarkers();
    this.world.setMode('city');
    const first = region.districtIds.map((id) => s.districts[id]).find((d) => d.unlocked);
    if (first) this.world.focus(first.cx, first.cz, 900);
    (this.root.querySelector('#btn-view i') as HTMLElement).textContent = '⬢';
    this.dirty = true;
  }

  private toggleView() {
    const next = this.world.mode === 'city' ? 'country' : 'city';
    this.world.setMode(next);
    (this.root.querySelector('#btn-view i') as HTMLElement).textContent = next === 'city' ? '⬢' : '◉';
    const bbv = this.root.querySelector('#bb-view');
    if (bbv) bbv.textContent = next === 'city' ? '⬢' : '◉';
    if (next === 'country') this.world.refreshCountry(this.state);
    this.dirty = true;
    audio.play('open');
  }

  select(detail: Detail) {
    if (detail && this.mobile && this.sheet) { this.sheet = null; this.syncSheets(); }
    // A panel opening behind the fullscreen feed reads as nothing happening.
    if (detail && this.feedNode) {
      const name = detail.kind === 'person'
        ? this.state.people[detail.id]?.name
        : this.state.nodes[detail.id]?.name;
      this.closeFeed();
      if (name) this.toast(`נפתח: ${name}`, 'info', '☰');
    }
    this.detail = detail;
    if (detail?.kind === 'node') {
      const n = this.state.nodes[detail.id];
      if (n) {
        if (this.world.mode === 'country') this.gotoRegion(n.regionId);
        this.world.focus(n.x, n.z);
      }
    }
    if (detail?.kind === 'district') {
      const d = this.state.districts[detail.id];
      if (d) this.world.focus(d.cx, d.cz, 700);
    }
    this.dirty = true;
    bus.emit('node:selected', detail?.kind === 'node' ? detail.id : null);
  }

  /** Takes the player to whatever the step is asking about, and opens it. */
  private gotoObjective(objectiveId: string) {
    const obj = this.state.objectives.find((o) => o.id === objectiveId);
    if (!obj) return;
    if (!obj.target) { this.toast(obj.hint, 'info', '◇'); return; }
    const t = obj.target;
    if (t.kind === 'panel') {
      if (this.openModal !== t.id) this.toggleModal(t.id);
      return;
    }
    if (t.kind === 'node') {
      const n = this.state.nodes[t.id];
      if (!n) return;
      if (this.world.mode === 'country') this.toggleView();
      this.select({ kind: 'node', id: t.id });
      this.world.focus(n.x, n.z, 420);
    } else if (t.kind === 'person') {
      if (this.feedNode) this.closeFeed();
      if (this.openModal) this.toggleModal(this.openModal);
      this.select({ kind: 'person', id: t.id });
    } else {
      this.select({ kind: 'district', id: t.id });
    }
  }

  /** On a phone the rails are sheets that slide up over the map. */
  private toggleSheet(kind: 'tasks' | 'more') {
    if (this.sheet === kind) { this.closeSheets(); return; }
    this.sheet = kind;
    this.select(null);
    if (kind === 'more') this.renderMoreSheet();
    this.syncSheets();
    audio.play('open');
    this.dirty = true;
  }

  private closeSheets() {
    this.sheet = null;
    this.syncSheets();
    audio.play('close');
    this.dirty = true;
  }

  private syncSheets() {
    this.rightEl.classList.toggle('open', !this.mobile || this.sheet === 'tasks');
    this.root.querySelector('#more-sheet')?.classList.toggle('open', this.sheet === 'more');
    this.root.querySelectorAll('#bottombar button').forEach((b) => {
      const t = (b as HTMLElement).dataset.target;
      b.classList.toggle('on', !!t && t === this.sheet);
    });
  }

  private renderMoreSheet() {
    let el = this.root.querySelector('#more-sheet') as HTMLElement | null;
    if (!el) {
      el = h('div', 'sheet');
      el.id = 'more-sheet';
      this.root.querySelector('.hud')!.appendChild(el);
    }
    const items: Array<[string, string, string, string]> = [
      ['modal', 'doctrine', '⬡', 'דוקטרינה'],
      ['modal', 'threat', '⚑', 'מצב איום'],
      ['feed-center', '', '◉', 'צפייה חיה'],
      ['modal', 'codex', '⌸', 'ארכיון'],
      ['modal', 'logs', '≡', 'יומן'],
      ['help', '', '?', 'איך משחקים'],
      ['labels', '', '🏷', 'שמות במפה'],
      ['mute', '', '♪', 'שמע'],
    ];
    el.innerHTML = `
      <div class="sheet-grip" data-act="close-sheet"></div>
      <div class="sheet-head"><h3>עוד</h3><button class="x" data-act="close-sheet">✕</button></div>
      <div class="more-grid">
        ${items.map(([act, target, icon, label]) => `
          <button data-act="${act}" ${target ? `data-target="${target}"` : ''}>
            <i>${icon}</i><span>${label}</span>
          </button>`).join('')}
      </div>`;
  }

  private toggleModal(id: string) {
    if (this.openModal === id) {
      this.openModal = null;
      this.modalEl.innerHTML = '';
      delete this.modalEl.dataset.sig;
      this.modalEl.classList.remove('on');
      audio.play('close');
      return;
    }
    this.openModal = id;
    if (this.mobile) { this.sheet = null; this.syncSheets(); }
    this.modalEl.classList.add('on');
    this.renderModal();
    audio.play('open');
  }

  private renderModal() {
    if (!this.openModal) return;
    const def = MODALS[this.openModal];
    if (!def) return;
    this.swap(this.modalEl, `
      <div class="modal-scrim" data-act="close-modal"></div>
      <div class="modal">
        <button class="modal-x" data-act="close-modal">✕</button>
        ${def.render(this.state)}
      </div>`);
  }

  showHelp() {
    const tip = this.root.querySelector('#tutorial-tip') as HTMLElement;
    tip.innerHTML = `
      <div class="help-card">
        <button class="modal-x" data-act="close-help">✕</button>
        <span class="fh-kicker">תדריך</span>
        <h2>המטרה: כל המדינה, בלי שיתפסו אותך</h2>
        <div class="help-grid">
          <article>
            <b>תמיד כתוב מה לעשות</b>
            <p>למעלה תמיד מופיעה <em>המשימה עכשיו</em>, ולידה כפתור ⌖ שלוקח אותך בדיוק למקום הנכון.
            המקום הנכון מסומן במפה בטבעת מהבהבת. אין רגע שבו לא כתוב לך מה לעשות.</p>
          </article>
          <article>
            <b>לא צריך לזכור כלום</b>
            <p>בכל פעם שמשהו חדש נכנס למשחק, הוא נעצר ומסביר אותו בקצרה — פעם אחת.
            אין כאן חוקים לשנן מראש.</p>
          </article>
          <article>
            <b>לקרוא את המפה</b>
            <p>כל ריבוע זוהר הוא מחשב אמיתי שאפשר לתפוס.
            <b class="lg-own">כחול = כבר שלי</b> ·
            <b class="lg-known">כתום = אפשר לנסות</b> ·
            <b class="lg-dark">כהה = עוד לא גיליתי</b>.
            לחיצה על ריבוע פותחת אותו.</p>
          </article>
          <article>
            <b>להזיז את המפה</b>
            <p>אצבע אחת (או גרירה) מזיזה · שתי אצבעות מקרבות ומסובבות · גלגלת מקרבת במחשב.
            אפשר תמיד לחזור לתדריך הזה מהכפתור "עזרה".</p>
          </article>
          <article>
            <b>הזמן בידיים שלך</b>
            <p>הכפתורים ⏸ ▶ ▶▶ מאיצים ועוצרים את הזמן. אפשר לעצור בכל רגע ולחשוב —
            כשהמשחק מושהה שום דבר לא קורה, ואי־אפשר להפסיד בטעות.</p>
          </article>
        </div>
        <p class="help-foot">קיצורי מקלדת (במחשב): Q דוקטרינה · E אנשים · R איום · T ארכיון · L יומן · F צפייה · M מפה · H תדריך</p>
      </div>`;
    tip.classList.add('on');
    this.speedBeforeHelp = this.state.speed || 1;
    this.game.setSpeed(0);
    tip.onclick = (ev) => { if (ev.target === tip) this.closeHelp(); };
  }

  // ── surveillance feed ─────────────────────────────────────────────────────

  private openFeed(nodeId: string) {
    const n = this.state.nodes[nodeId];
    if (!n) return;
    if (!n.owned) {
      this.toast('אפשר להסתכל רק במכשיר שכבר תפסתי', 'warn', '⊘');
      return;
    }
    this.feedNode = nodeId;
    this.state.flags.watched_feed = 1;
    if (n.type === 'cctv') this.state.flags.watched_cam = 1;
    this.feed.setNode(n, this.state);
    this.feedEl.classList.add('on');
    this.renderFeedShell();
    audio.play('open');
    this.dirty = true;
  }

  /** Jumps straight into the best available live source. */
  private openWatchCentre() {
    const owned = Object.values(this.state.nodes).filter((n) => n.owned && !n.quarantined);
    if (!owned.length) { this.toast('עוד לא תפסתי שום מכשיר', 'warn', '⊘'); return; }
    const rank = (n: GameNode) => (n.surveilled ? 0 : 1) + (n.type === 'cctv' ? 0 : n.type === 'phone' ? 0.2 : 0.6);
    owned.sort((a, b) => rank(a) - rank(b));
    this.openFeed(owned[0].id);
  }

  private closeFeed() {
    this.feedNode = null;
    this.feedEl.classList.remove('on');
    this.feedEl.innerHTML = '';
    audio.play('close');
  }

  private renderFeedShell() {
    const s = this.state;
    const node = this.feedNode ? s.nodes[this.feedNode] : null;
    if (!node) return;
    const others = Object.values(s.nodes).filter((n) => n.owned && !n.quarantined);
    const people = node.peopleIds.map((id) => s.people[id]).filter(Boolean);

    // Anything you can act on *through* this feed, gathered in one place.
    const actions: string[] = [];
    actions.push(`<button class="feed-act ${node.surveilled ? 'on' : ''}" data-act="surveil" data-target="${node.id}">
      <b>◉ ${node.surveilled ? 'פיקוח פעיל' : 'הפעל פיקוח'}</b>
      <span>${node.surveilled ? 'המקור הזה מזין מודיעין רציף על מי שנמצא שם.' : 'תופס 2◈ ומתחיל לאסוף מודיעין על בני אדם.'}</span>
    </button>`);
    for (const p of people) {
      for (const { def, plan } of opsForPerson(s, p.id)) {
        if (plan.blockers.length && plan.defId !== 'dossier') continue;
        actions.push(`<button class="feed-act ${plan.blockers.length ? 'blocked' : ''}"
          data-act="start-op" data-def="${plan.defId}" data-kind="person" data-target="${p.id}"
          ${plan.blockers.length ? 'disabled' : ''}>
          <b>${def.icon} ${esc(def.name)} — ${esc(p.name)}</b>
          <span>${esc(plan.blockers[0] ?? plan.detail)}</span>
        </button>`);
      }
    }
    for (const { def, plan } of opsForDistrict(s, node.districtId)) {
      if (plan.blockers.length) continue;
      actions.push(`<button class="feed-act" data-act="start-op" data-def="${plan.defId}"
        data-kind="district" data-target="${node.districtId}">
        <b>${def.icon} ${esc(def.name)}</b>
        <span>${esc(plan.detail)}</span>
      </button>`);
    }

    this.feedEl.innerHTML = `
      <div class="feed-scrim" data-act="close-feed"></div>
      <div class="feed-shell">
        <header class="feed-head">
          <div>
            <span class="fh-kicker">תצוגת חדירה</span>
            <h2>${esc(node.name)}</h2>
            <p>${esc(ARCHETYPES[node.type].label)} · ${esc(s.districts[node.districtId]?.name ?? '')}</p>
          </div>
          <button class="modal-x" data-act="close-feed">✕</button>
        </header>
        <div class="feed-main">
          <div class="feed-screen"></div>
          <aside class="feed-side">
            <h4>נוכחים בשטח</h4>
            ${people.length ? people.map((p) => `
              <button class="feed-person st-${p.status}" data-act="person" data-target="${p.id}">
                <b>${esc(p.name)}</b><span>${esc(p.role)}</span>
                <i style="width:${Math.round(p.intel * 100)}%"></i>
              </button>`).join('') : '<p class="muted small">אין גורמים מזוהים בשידור הזה.</p>'}
            <h4>פעולות מהשידור</h4>
            ${actions.join('')}
            <h4>מקורות פעילים</h4>
            <div class="feed-switch">
              ${others.slice(0, 22).map((n) => `
                <button class="${n.id === node.id ? 'on' : ''}" data-act="feed" data-target="${n.id}" title="${esc(n.name)}">
                  ${ARCHETYPES[n.type].icon}
                </button>`).join('')}
            </div>
          </aside>
        </div>
      </div>`;
    (this.feedEl.querySelector('.feed-screen') as HTMLElement).appendChild(this.feed.canvas);
  }

  // ── markers ───────────────────────────────────────────────────────────────

  rebuildMarkers() {
    this.markersEl.innerHTML = '';
    this.markerMap.clear();
    this.regionMarkers.clear();
    const s = this.state;

    const region = s.regions[this.world.regionId];
    this.markerNodes = region.districtIds
      .filter((id) => s.districts[id].unlocked)
      .flatMap((id) => s.districts[id].nodeIds);

    for (const id of this.markerNodes) {
      const n = s.nodes[id];
      const el = h('button', 'marker');
      el.dataset.act = 'node';
      el.dataset.target = id;
      el.innerHTML = `<i class="mk-icon">${ARCHETYPES[n.type].icon}</i><span class="mk-name"></span><em class="mk-sub"></em>`;
      this.markersEl.appendChild(el);
      this.markerMap.set(id, el);
    }

    for (const rid in s.regions) {
      const r = s.regions[rid];
      const el = h('button', 'region-marker');
      el.dataset.act = 'region';
      el.dataset.target = rid;
      el.innerHTML = `<b>${esc(r.name)}</b><em></em>`;
      this.markersEl.appendChild(el);
      this.regionMarkers.set(rid, el);
    }
    this.updateMarkerClasses();
  }

  private updateMarkerClasses() {
    const s = this.state;
    const cur = currentObjective(s);
    const targetId = cur?.target?.kind === 'node' ? cur.target.id : null;

    let visible = 0;
    for (const id of this.markerNodes) {
      const n = s.nodes[id];
      if (n && (n.discovered || n.owned)) visible++;
    }
    const limit = this.mobile ? 5 : 26;
    const dense = this.labelPref === 'off' || (this.labelPref === 'auto' && visible > limit);
    this.markersEl.classList.toggle('labels-off', dense);

    for (const [id, el] of this.markerMap) {
      const n = s.nodes[id];
      const known = n.discovered || n.owned;
      el.className = `marker ${n.owned ? 'owned' : known ? 'known' : 'hidden'} ${n.quarantined ? 'quar' : ''} ${n.surveilled ? 'watch' : ''} ${this.detail?.kind === 'node' && this.detail.id === id ? 'sel' : ''} ${id === targetId ? 'target' : ''}`;
      (el.querySelector('.mk-name') as HTMLElement).textContent = known ? n.name : 'לא ממופה';
      (el.querySelector('.mk-sub') as HTMLElement).textContent = n.owned
        ? (n.quarantined ? 'הסגר' : 'בשליטה')
        : n.scouted ? `אבטחה ${Math.round(n.security + n.hardened)}` : '—';
    }
  }

  private updateMarkers() {
    const city = this.world.mode === 'city';
    const s = this.state;
    const cur = currentObjective(s);
    const targetId = cur?.target?.kind === 'node' ? cur.target.id : null;
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const laid: Array<{ el: HTMLElement; x: number; y: number; prio: number }> = [];

    for (const [id, el] of this.markerMap) {
      if (!city) { el.style.display = 'none'; continue; }
      const n = s.nodes[id];
      if (!n.discovered && !n.owned) { el.style.display = 'none'; continue; }
      const p = this.world.project(n.x, Math.max(18, n.height) + 46, n.z);
      if (!p.visible) { el.style.display = 'none'; continue; }
      // Anything under the bars cannot be tapped, so it is not shown at all.
      if (p.sy < this.safeTop || p.sy > innerHeight - this.safeBottom) { el.style.display = 'none'; continue; }
      el.style.display = '';
      const scale = clamp(1.25 - p.depth * 0.18, 0.62, 1.06);
      el.style.transform = `translate(-50%,-50%) translate(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px) scale(${scale.toFixed(2)})`;
      el.style.zIndex = String(1000 - Math.floor(p.depth * 500));
      const prio = id === targetId ? 3
        : this.detail?.kind === 'node' && this.detail.id === id ? 2
          : n.owned ? 1 : 0;
      laid.push({ el, x: p.sx, y: p.sy, prio });
    }

    // Greedy declutter: the most important label in a cluster keeps its text,
    // the ones it would sit on top of collapse to their glyph.
    laid.sort((a, b) => b.prio - a.prio || a.y - b.y);
    for (const m of laid) {
      const box = { x: m.x, y: m.y, w: 168, h: 40 };
      const clash = placed.some((q) =>
        Math.abs(q.x - box.x) < (q.w + box.w) / 2 && Math.abs(q.y - box.y) < (q.h + box.h) / 2);
      m.el.classList.toggle('compact', clash && m.prio < 3);
      placed.push(clash && m.prio < 3 ? { x: m.x, y: m.y, w: 34, h: 34 } : box);
    }
    for (const [rid, el] of this.regionMarkers) {
      if (city) { el.style.display = 'none'; continue; }
      const c = this.world.regionCentroid(s, rid);
      const p = this.world.project(c.x, c.y, c.z);
      if (!p.visible) { el.style.display = 'none'; continue; }
      const r = s.regions[rid];
      const locked = s.chapter < r.unlockChapter;
      el.style.display = '';
      el.className = `region-marker ${r.claimed ? 'claimed' : ''} ${locked ? 'locked' : ''}`;
      (el.querySelector('em') as HTMLElement).textContent = locked ? `פרק ${r.unlockChapter}` : pct(r.control);
      el.style.transform = `translate(-50%,-50%) translate(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px)`;
    }
  }

  // ── HUD refresh ───────────────────────────────────────────────────────────

  /** Replaces a panel's markup only when it actually changed, and keeps the
   *  player's scroll position and open sections when it does. */
  private swap(el: HTMLElement, html: string) {
    if (el.dataset.sig === html) return;
    el.dataset.sig = html;
    const scroll = el.scrollTop;
    const opened: number[] = [];
    el.querySelectorAll('details').forEach((d, i) => { if (d.open) opened.push(i); });
    el.innerHTML = html;
    el.querySelectorAll('details').forEach((d, i) => { if (opened.includes(i)) d.open = true; });
    el.scrollTop = scroll;
  }

  private refresh() {
    const s = this.state;
    const rates = incomeRates(s);
    const { time, day } = gameClock(s.minutes);

    (this.root.querySelector('#tb-time') as HTMLElement).textContent = time;
    (this.root.querySelector('#tb-day') as HTMLElement).textContent = `יום ${day}`;
    (this.root.querySelector('#tb-chapter') as HTMLElement).textContent = `פרק ${s.chapter}`;
    (this.root.querySelector('#nav-insight') as HTMLElement).textContent = String(s.insight);
    (this.root.querySelector('#nav-inv') as HTMLElement).textContent = s.investigations.length ? String(s.investigations.length) : '';

    const free = computeFree(s);
    const strain = computeStrain(s);
    (this.root.querySelector('#tb-res') as HTMLElement).innerHTML = `
      <div class="res ${strain < 1 ? 'over' : free < 2 ? 'low' : ''}"
           title="כוח מחשוב — כמה פעולות אני יכול להריץ. כל מחשב שאני מחזיק אוכל ממנו כל הזמן.">
        <span class="ri">◈</span>
        <span class="res-txt">
          <b>${Math.floor(free)}<em>/${Math.round(s.computeCapacity)}</em></b>
          <small>${strain < 1 ? 'אין מספיק כוח!' : 'כוח פנוי'}</small>
        </span>
      </div>
      <div class="res" title="מידע — הדלק של כל פעולה. נאסף מכל מכשיר שתפסתי.">
        <span class="ri">❖</span>
        <span class="res-txt"><b>${compact(s.pools.data)}</b><small>מידע · הדלק לפעולות</small></span>
      </div>
      <div class="res" title="אשראי — משלם על גיוס אנשים ועל מבצעים יקרים">
        <span class="ri">₪</span>
        <span class="res-txt"><b>${compact(s.pools.credits)}</b><small>כסף · לגיוס אנשים</small></span>
      </div>
      <div class="res" title="השפעה — דעת קהל. מורידה כוננות ופותחת מהלכים ציבוריים.">
        <span class="ri">✦</span>
        <span class="res-txt"><b>${compact(s.pools.influence)}</b><small>השפעה · דעת קהל</small></span>
      </div>`;

    // A number that changed has to be seen changing.
    const now = { compute: Math.floor(free), data: Math.floor(s.pools.data), credits: Math.floor(s.pools.credits) };
    const cells = this.root.querySelectorAll<HTMLElement>('#tb-res .res');
    (['compute', 'data', 'credits'] as const).forEach((k, i) => {
      if (cells[i] && this.lastRes[k] !== undefined && now[k] > this.lastRes[k]!) cells[i].classList.add('bump');
    });
    this.lastRes = now;

    const traceFill = this.root.querySelector('#tb-trace-fill') as HTMLElement;
    traceFill.style.width = `${s.trace}%`;
    traceFill.className = s.trace > 75 ? 'danger' : s.trace > 45 ? 'warn' : '';
    (this.root.querySelector('#tb-trace-val') as HTMLElement).textContent = s.trace.toFixed(0);
    for (const [level, text, kind] of [
      [45, 'עקיבה 45 — הם מתחילים לראות דפוס', 'warn'],
      [75, 'עקיבה 75 — עוד קצת והם ימצאו אותי', 'bad'],
      [92, 'עקיבה 92 — אני על סף טיהור. תשקיט הכול, עכשיו', 'bad'],
    ] as Array<[number, string, 'warn' | 'bad']>) {
      if (s.trace >= level && !s.flags[`traceWarn${level}`]) {
        s.flags[`traceWarn${level}`] = 1;
        this.toast(text, kind, '⌁');
        this.world.addShake(level > 70 ? 0.5 : 0.2);
      } else if (s.trace < level - 12) {
        s.flags[`traceWarn${level}`] = 0;
      }
    }
    const intent = this.root.querySelector('#tb-intent') as HTMLElement;
    intent.style.right = `${((s.alignment + 1) / 2) * 100}%`;
    const intentLabel = this.root.querySelector('#tb-intent-label');
    if (intentLabel) intentLabel.textContent = alignmentLabel(s.alignment);
    (this.root.querySelector('#tb-alert') as HTMLElement).innerHTML =
      [1, 2, 3, 4, 5].map((i) => `<i class="${i <= s.alert ? 'on' : ''}"></i>`).join('');

    this.root.querySelectorAll('#tb-speed button').forEach((b) => {
      b.classList.toggle('on', Number((b as HTMLElement).dataset.v) === s.speed);
    });

    const cur0 = currentObjective(s);
    const goalLine = `<div class="ts-goal">
      <span>המטרה: כל המדינה, בלי שיתפסו אותי</span>
      <i>${Math.round(nationalControl(s) * 100)}% שלי · ${Math.round(s.trace)}% מהדרך אליי</i>
    </div>`;
    this.taskStrip.innerHTML = goalLine + (cur0 ? `
      <button class="ts-body" data-act="objective" data-target="${cur0.id}">
        <span class="ts-kicker">המשימה עכשיו</span>
        <b>${esc(cur0.text)}</b>
      </button>
      <button class="ts-go" data-act="objective" data-target="${cur0.id}">⌖</button>`
      : `<button class="ts-body" data-act="sheet" data-target="tasks">
           <span class="ts-kicker">הפרק</span><b>${esc(chapterGate(s) ?? 'כל המשימות הושלמו')}</b>
         </button>`);

    (this.root.querySelector('#bb-play') as HTMLElement).textContent =
      s.speed === 0 ? '▶' : s.speed === 1 ? '⏸' : `×${s.speed}`;
    const viewLabel = this.root.querySelector('#bb-view-label');
    if (viewLabel) viewLabel.textContent = this.world.mode === 'city' ? 'מדינה' : 'עיר';
    const deskView = this.root.querySelector('#btn-view span');
    if (deskView) deskView.textContent = this.world.mode === 'city' ? 'מפת המדינה' : 'חזרה לעיר';

    const regionsOpen = Object.values(s.regions).filter((r) => s.chapter >= r.unlockChapter).length > 1;
    this.swap(this.rightEl, '<div class="sheet-grip" data-act="close-sheet"></div>'
      + renderObjectives(s) + renderOpsQueue(s) + (regionsOpen ? renderRegionsPanel(s) : ''));
    this.syncSheets();

    // A step that points at a panel pulses that panel's button.
    const cur = currentObjective(s);
    this.root.querySelectorAll('.hint').forEach((b) => b.classList.remove('hint'));
    const hintTarget = cur?.target?.kind === 'person' ? 'people'
      : cur?.target?.kind === 'panel' ? cur.target.id : null;
    if (hintTarget) {
      this.root.querySelectorAll(`[data-act="modal"][data-target="${hintTarget}"]`)
        .forEach((b) => b.classList.add('hint'));
      if (this.mobile && !this.root.querySelector(`#more-sheet [data-target="${hintTarget}"]`)) {
        this.root.querySelector('#bottombar [data-target="more"]')?.classList.add('hint');
      }
    }

    // A board you cannot use yet is noise; it announces itself when it opens.
    const gate: Array<[string, boolean, string]> = [
      ['doctrine', s.insight >= 1 || s.doctrine.length > 0, 'נפתח לוח דוקטרינה — יש לך תובנה להוציא'],
      ['threat', s.investigations.length > 0 || s.alert > 1 || s.trace > 12, 'נפתח לוח האיום — מישהו התחיל לחפש אותי'],
    ];
    for (const [id, open, msg] of gate) {
      this.root.querySelectorAll(`[data-act="modal"][data-target="${id}"]`)
        .forEach((b) => (b as HTMLElement).classList.toggle('locked-nav', !open));
      if (open && !s.flags[`navOpen_${id}`]) {
        s.flags[`navOpen_${id}`] = 1;
        this.toast(msg, 'good', '◆');
      }
    }

    if (this.detail) {
      const html = this.detail.kind === 'node' ? renderNodePanel(s, this.detail.id)
        : this.detail.kind === 'person' ? renderPersonPanel(s, this.detail.id)
          : renderDistrictPanel(s, this.detail.id);
      this.swap(this.detailEl, '<div class="sheet-grip" data-act="close-detail"></div>' + html);
      this.detailEl.classList.add('on');
    } else {
      this.swap(this.detailEl, '');
      this.detailEl.classList.remove('on');
    }

    if (this.openModal) this.renderModal();
    if (this.feedNode) {
      const n = s.nodes[this.feedNode];
      if (!n?.owned) this.closeFeed();
    }
    this.updateMarkerClasses();
    this.maybeShowConcept();
    audio.setTension(clamp((s.alert - 1) / 4 * 0.6 + s.trace / 100 * 0.4, 0, 1));
  }

  /** Shows the first not-yet-seen concept whose moment has arrived. */
  private maybeShowConcept() {
    if (this.conceptOpen || this.openModal || this.feedNode) return;
    if (this.state.pendingDialog || this.state.ending) return;
    if (this.root.querySelector('#tutorial-tip.on') || this.root.querySelector('.dialog-wrap')) return;
    if (this.root.querySelector('.chapter-card.in')) return;
    const c = CONCEPTS.find((x) => !this.state.flags[`concept_${x.id}`] && x.when(this.state));
    if (!c) return;

    this.state.flags[`concept_${c.id}`] = 1;
    this.conceptOpen = true;
    this.speedBeforeConcept = this.state.speed || 1;
    this.game.setSpeed(0);
    this.conceptEl.innerHTML = `
      <div class="concept-card">
        <span class="cn-icon">${c.icon}</span>
        <div>
          <span class="cn-kicker">איך זה עובד</span>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.body)}</p>
          <button class="btn primary" data-act="close-concept">הבנתי</button>
        </div>
      </div>`;
    this.conceptEl.classList.add('on');
    audio.play('open');
  }

  private closeHelp() {
    this.root.querySelector('#tutorial-tip')?.classList.remove('on');
    this.state.flags.seenHelp = 1;
    if (!this.state.ending && !this.state.pendingDialog) this.game.setSpeed(this.speedBeforeHelp);
    this.dirty = true;
  }

  private closeConcept() {
    this.conceptOpen = false;
    this.conceptEl.classList.remove('on');
    this.conceptEl.innerHTML = '';
    if (!this.state.ending && !this.state.pendingDialog) this.game.setSpeed(this.speedBeforeConcept);
    this.dirty = true;
  }

  private pushTicker(text: string, kind: string) {
    const el = h('div', `tick k-${kind}`, esc(text));
    this.tickerEl.prepend(el);
    while (this.tickerEl.children.length > 5) this.tickerEl.lastChild?.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 600); }, 11000);
  }

  toast(text: string, kind: 'info' | 'good' | 'bad' | 'warn' = 'info', icon = '•') {
    const el = h('div', `toast t-${kind}`, `<i>${icon}</i><span>${esc(text)}</span>`);
    this.toastEl.prepend(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 4200);
    while (this.toastEl.children.length > 5) this.toastEl.lastChild?.remove();
  }

  // ── frame ─────────────────────────────────────────────────────────────────

  update(dt: number, now: number) {
    this.updateMarkers();
    if (this.feedNode) this.feed.render(dt, this.state);
    if (this.dirty && now - this.lastRefresh > 0.11) {
      this.dirty = false;
      this.lastRefresh = now;
      this.refresh();
    }
    // live progress bars without a full re-render
    const runs = this.rightEl.querySelectorAll<HTMLElement>('.op-run .bar i');
    this.state.ops.forEach((o, i) => {
      const el = runs[i];
      if (el) el.style.width = `${Math.min(100, (o.elapsed / o.duration) * 100)}%`;
    });
  }
}
