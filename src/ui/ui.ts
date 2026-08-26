import { audio } from '../audio/audio';
import { clamp, compact, gameClock, pct } from '../core/util';
import { bus } from '../game/bus';
import { canStart, OP_BY_ID, opsForDistrict, opsForPerson, startOp } from '../game/ops';
import { Game } from '../game/sim';
import {
  canAfford, clearSave, computeFree, computeStrain, incomeRates, log, refreshDerived, releaseNode,
  saveGame, spend,
} from '../game/state';
import { currentObjective, resolveDialog } from '../game/story';
import { SHEPHERD_ACTIONS } from '../game/threat';
import type { GameNode, GameState } from '../game/types';
import { ARCHETYPES } from '../game/content';
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
  people: { title: 'גורמים אנושיים', render: renderPeopleList },
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
          <div class="alert-dots" id="tb-alert"></div>
          <div class="intent" title="כוונה — נעה לפי הבחירות שלך, וקובעת אילו סיומים ייפתחו">
            <label>כוונה</label>
            <div class="intent-track"><i id="tb-intent"></i></div>
          </div>
        </div>

        <div class="tb-speed" id="tb-speed">
          <button data-act="speed" data-v="0" title="השהיה">⏸</button>
          <button data-act="speed" data-v="1" class="on">▶</button>
          <button data-act="speed" data-v="2">▶▶</button>
          <button data-act="speed" data-v="4">▶▶▶</button>
        </div>

        <nav class="tb-nav">
          <button data-act="modal" data-target="doctrine" title="דוקטרינה (Q)">⬡<em id="nav-insight">0</em></button>
          <button data-act="modal" data-target="people" title="אנשים (E)">☰</button>
          <button data-act="modal" data-target="threat" title="איום (R)">⚑<em id="nav-inv"></em></button>
          <button data-act="feed-center" title="מוקד צפייה (F)">◉</button>
          <button data-act="modal" data-target="codex" title="ארכיון (T)">⌸</button>
          <button data-act="modal" data-target="logs" title="יומן (L)">≡</button>
          <button data-act="toggle-view" id="btn-view" title="מפת המדינה (M)">⬢</button>
          <button data-act="labels" id="btn-labels" title="שמות צמתים">🏷</button>
          <button data-act="help" title="איך משחקים (H)">?</button>
          <button data-act="mute" id="btn-mute" title="שמע">♪</button>
        </nav>
      </header>

      <aside id="side-right" class="side"></aside>
      <aside id="side-left" class="side"></aside>
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
    let dragging = false;
    let orbiting = false;
    let lx = 0, ly = 0, moved = 0;

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      dragging = e.button === 0;
      orbiting = e.button === 2 || e.shiftKey;
      lx = e.clientX; ly = e.clientY; moved = 0;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging && !orbiting) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (orbiting) this.world.orbit(dx, dy);
      else this.world.pan(dx, dy);
    });
    const up = () => {
      if (dragging && moved < 5) this.select(null);
      dragging = orbiting = false;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.world.zoom(e.deltaY);
    }, { passive: false });
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
      case 'toggle-view': this.toggleView(); break;
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
        (this.root.querySelector('#btn-mute') as HTMLElement).textContent = audio.muted ? '♪̸' : '♪';
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
      case 'buy-doc':
        if (this.game.buyDoctrine(target)) this.renderModal();
        break;
      case 'abort': this.game.abort(target); this.dirty = true; break;
      case 'start-op': this.startOperation(el); break;
      case 'shepherd': this.runShepherd(target); break;
      case 'region': this.gotoRegion(target); break;
      case 'save': saveGame(this.state); this.toast('המשחק נשמר', 'good', '⌸'); break;
      default: break;
    }
  }

  private startOperation(el: HTMLElement) {
    const defId = el.dataset.def!;
    const kind = el.dataset.kind as 'node' | 'person' | 'district';
    const target = el.dataset.target!;
    const def = OP_BY_ID[defId];
    if (!def) return;
    const plan = def.plan(this.state, target);
    if (!plan) return;
    const check = canStart(this.state, plan);
    if (!check.ok) { this.toast(check.reason!, 'warn', '⊘'); return; }
    startOp(this.state, plan, kind, target);
    this.dirty = true;
    if (this.feedNode) this.renderFeedShell();
  }

  private runShepherd(id: string) {
    const action = SHEPHERD_ACTIONS.find((a) => a.id === id);
    if (!action) return;
    const s = this.state;
    const av = action.available(s);
    if (!av.ok) { this.toast(av.reason ?? 'לא זמין', 'warn', '⊘'); return; }
    if (!canAfford(s, action.cost)) { this.toast('חסרים משאבים', 'warn', '⊘'); return; }
    if (computeFree(s) < action.compute) { this.toast('חסר כוח עיבוד', 'warn', '⊘'); return; }
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
    (this.root.querySelector('#btn-view') as HTMLElement).textContent = '⬢';
    this.dirty = true;
  }

  private toggleView() {
    const next = this.world.mode === 'city' ? 'country' : 'city';
    this.world.setMode(next);
    (this.root.querySelector('#btn-view') as HTMLElement).textContent = next === 'city' ? '⬢' : '◉';
    if (next === 'country') this.world.refreshCountry(this.state);
    this.dirty = true;
    audio.play('open');
  }

  select(detail: Detail) {
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
    if (!obj?.target) return;
    const t = obj.target;
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

  private toggleModal(id: string) {
    if (this.openModal === id) {
      this.openModal = null;
      this.modalEl.innerHTML = '';
      this.modalEl.classList.remove('on');
      audio.play('close');
      return;
    }
    this.openModal = id;
    this.modalEl.classList.add('on');
    this.renderModal();
    audio.play('open');
  }

  private renderModal() {
    if (!this.openModal) return;
    const def = MODALS[this.openModal];
    if (!def) return;
    this.modalEl.innerHTML = `
      <div class="modal-scrim" data-act="close-modal"></div>
      <div class="modal">
        <button class="modal-x" data-act="close-modal">✕</button>
        ${def.render(this.state)}
      </div>`;
  }

  showHelp() {
    const tip = this.root.querySelector('#tutorial-tip') as HTMLElement;
    tip.innerHTML = `
      <div class="help-card">
        <button class="modal-x" data-act="close-help">✕</button>
        <span class="fh-kicker">תדריך</span>
        <h2>שלוש דקות והכול ברור</h2>
        <div class="help-grid">
          <article>
            <b>עקוב אחרי המשימה</b>
            <p>בלוח שמימין תמיד כתובה <em>המשימה עכשיו</em>, ולידה כפתור שלוקח אותך בדיוק לצומת הנכון.
            הצומת הנכון מסומן על המפה בטבעת פועמת. אין רגע שבו לא כתוב לך מה לעשות.</p>
          </article>
          <article>
            <b>הכול נלמד תוך כדי</b>
            <p>אין כאן חוקים לשנן. בכל פעם שמנגנון חדש נכנס לתמונה — עקיבה, חקירות, כוח עיבוד —
            המשחק נעצר ומסביר אותו במשפט אחד, פעם אחת.</p>
          </article>
          <article>
            <b>שליטה במפה</b>
            <p>גרירה מזיזה · גלגלת מקרבת · גרירה ימנית מסובבת. לחיצה על ריבוע זוהר פותחת אותו.</p>
          </article>
          <article>
            <b>שליטה בזמן</b>
            <p>רווח משהה · 1 · 2 · 3 מאיצים. אפשר לעצור בכל רגע ולחשוב — כלום לא קורה בזמן שהמשחק מושהה.</p>
          </article>
        </div>
        <p class="help-foot">Q דוקטרינה · E אנשים · R איום · T ארכיון · L יומן · F צפייה חיה · M מפת המדינה · H התדריך הזה</p>
      </div>`;
    tip.classList.add('on');
    this.speedBeforeHelp = this.state.speed || 1;
    this.game.setSpeed(0);
    tip.onclick = (ev) => { if (ev.target === tip) this.closeHelp(); };
  }

  // ── surveillance feed ─────────────────────────────────────────────────────

  private openFeed(nodeId: string) {
    const n = this.state.nodes[nodeId];
    if (!n || !n.owned) return;
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
    if (!owned.length) { this.toast('אין עדיין צומת בשליטתי', 'warn', '⊘'); return; }
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
    const dense = this.labelPref === 'off' || (this.labelPref === 'auto' && visible > 26);
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
           title="כוח עיבוד — כל צומת בבעלותי צורך אחזקה קבועה, וכל פעולה תופסת קיבולת נוספת">
        <span class="ri">◈</span>
        <span class="res-txt">
          <b>${Math.floor(free)}<em>/${Math.round(s.computeCapacity)}</em></b>
          <small>${strain < 1 ? 'עומס יתר' : 'עיבוד פנוי'}</small>
        </span>
      </div>
      <div class="res" title="מידע — הדלק של כל פעולה. נאסף מכל צומת בשליטתי.">
        <span class="ri">❖</span>
        <span class="res-txt"><b>${compact(s.pools.data)}</b><small>מידע · ${rates.data.toFixed(1)} לשעה</small></span>
      </div>
      <div class="res" title="אשראי — משלם על גיוס אנשים ועל מבצעים יקרים">
        <span class="ri">₪</span>
        <span class="res-txt"><b>${compact(s.pools.credits)}</b><small>אשראי · ${rates.credits.toFixed(1)} לשעה</small></span>
      </div>
      <div class="res" title="השפעה — דעת קהל. מורידה כוננות ופותחת מהלכים ציבוריים.">
        <span class="ri">✦</span>
        <span class="res-txt"><b>${compact(s.pools.influence)}</b><small>השפעה · ${rates.influence.toFixed(1)} לשעה</small></span>
      </div>`;

    const traceFill = this.root.querySelector('#tb-trace-fill') as HTMLElement;
    traceFill.style.width = `${s.trace}%`;
    traceFill.className = s.trace > 75 ? 'danger' : s.trace > 45 ? 'warn' : '';
    (this.root.querySelector('#tb-trace-val') as HTMLElement).textContent = s.trace.toFixed(0);
    const intent = this.root.querySelector('#tb-intent') as HTMLElement;
    intent.style.right = `${((s.alignment + 1) / 2) * 100}%`;
    (this.root.querySelector('#tb-alert') as HTMLElement).innerHTML =
      [1, 2, 3, 4, 5].map((i) => `<i class="${i <= s.alert ? 'on' : ''}"></i>`).join('');

    this.root.querySelectorAll('#tb-speed button').forEach((b) => {
      b.classList.toggle('on', Number((b as HTMLElement).dataset.v) === s.speed);
    });

    const regionsOpen = Object.values(s.regions).filter((r) => s.chapter >= r.unlockChapter).length > 1;
    this.rightEl.innerHTML = renderObjectives(s) + renderOpsQueue(s) + (regionsOpen ? renderRegionsPanel(s) : '');

    // A step that points at a panel pulses that panel's button.
    const cur = currentObjective(s);
    this.root.querySelectorAll('.tb-nav button.hint').forEach((b) => b.classList.remove('hint'));
    if (cur?.target?.kind === 'person') {
      this.root.querySelector('.tb-nav [data-target="people"]')?.classList.add('hint');
    }

    if (this.detail) {
      const html = this.detail.kind === 'node' ? renderNodePanel(s, this.detail.id)
        : this.detail.kind === 'person' ? renderPersonPanel(s, this.detail.id)
          : renderDistrictPanel(s, this.detail.id);
      this.detailEl.innerHTML = html;
      this.detailEl.classList.add('on');
    } else {
      this.detailEl.innerHTML = '';
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
