import { el, btn, esc } from '../ui/dom';
import { t } from '../core/i18n';
import type { BuildMode, Tool } from './BuildMode';
import { STYLES } from '../world/Styles';
import { PALETTE, MATERIALS, type Mat } from '../world/Voxel';
import { PREFAB_IDS, PREFABS } from '../world/Prefabs';
import { formatTime } from '../core/MathUtil';

const TOOL_ICONS: Record<Tool, string> = { block: '■', box: '▣', prefab: '⌂', paint: '🖌', erase: '✖', flag: '⚑', spawn: '◎' };
const TOOL_KEYS: Record<Tool, string> = { block: 'toolBlock', box: 'toolBox', prefab: 'toolPrefab', paint: 'toolPaint', erase: 'toolErase', flag: 'toolFlag', spawn: 'toolSpawn' };
const MAT_KEYS: Record<string, string> = {
  stoneBrick: 'Stone brick', smoothStone: 'Smooth stone', marble: 'Marble', woodPlanks: 'Planks', woodLog: 'Log', metalPanel: 'Metal panel', brushedMetal: 'Brushed metal',
  glass: 'Glass', concrete: 'Concrete', sandstone: 'Sandstone', candy: 'Candy', neon: 'Neon', roofTiles: 'Roof tiles', gold: 'Gold', crystal: 'Crystal', cobble: 'Cobble', lamp: 'Lamp',
};
const MAT_KEYS_HE: Record<string, string> = {
  stoneBrick: 'לבני אבן', smoothStone: 'אבן חלקה', marble: 'שיש', woodPlanks: 'קרשים', woodLog: 'בול עץ', metalPanel: 'פאנל מתכת', brushedMetal: 'מתכת מוברשת',
  glass: 'זכוכית', concrete: 'בטון', sandstone: 'אבן חול', candy: 'ממתק', neon: 'ניאון', roofTiles: 'רעפים', gold: 'זהב', crystal: 'קריסטל', cobble: 'אבני מרצפת', lamp: 'מנורה',
};

export interface BuildUICallbacks {
  ready(): void;
  autoBuild(): void;
}

/** Build-phase panels: top bar, tool rail, material/colour palette, prefab drawer, blueprints. */
export class BuildUI {
  readonly root: HTMLElement;
  private topbar: HTMLElement;
  private timerEl: HTMLElement;
  private budgetEl: HTMLElement;
  private budgetFill: HTMLElement;
  private statusEl: HTMLElement;
  private rail: HTMLElement;
  private palette: HTMLElement;
  private drawer: HTMLElement;
  private bpPanel: HTMLElement;
  private hint: HTMLElement;
  private toast: HTMLElement;
  private toastTimer = 0;
  private unsub: (() => void) | null = null;

  constructor(parent: HTMLElement, private build: BuildMode, private cb: BuildUICallbacks) {
    this.root = el('div', 'buildui');
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.topbar = el('div', 'b-top');
    this.timerEl = el('div', 'b-timer');
    this.budgetEl = el('div', 'b-budget');
    this.budgetFill = el('div', 'fill');
    this.statusEl = el('div', 'b-status');
    this.rail = el('div', 'b-rail');
    this.palette = el('div', 'b-palette');
    this.drawer = el('div', 'b-drawer');
    this.bpPanel = el('div', 'b-blueprints');
    this.bpPanel.hidden = true;
    this.hint = el('div', 'b-hint');
    this.toast = el('div', 'b-toast');
    this.toast.hidden = true;
    this.root.append(this.topbar, this.rail, this.palette, this.drawer, this.bpPanel, this.toast);
    for (const panel of [this.topbar, this.rail, this.palette, this.drawer, this.bpPanel]) {
      panel.addEventListener('mouseenter', () => (this.build.uiHover = true));
      panel.addEventListener('mouseleave', () => (this.build.uiHover = false));
    }
    this.render();
  }

  show(): void {
    this.root.hidden = false;
    this.render();
    this.unsub?.();
    this.unsub = this.build.events.on('change', () => this.refresh());
    const offInvalid = this.build.events.on('invalid', ({ key }) => this.showToast(t(key)));
    const prev = this.unsub;
    this.unsub = () => {
      prev();
      offInvalid();
    };
  }

  hide(): void {
    this.root.hidden = true;
    this.unsub?.();
    this.unsub = null;
    this.build.uiHover = false;
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
    this.toastTimer = 2.2;
  }

  update(dt: number, timeLeft: number | null): void {
    this.timerEl.textContent = timeLeft === null ? '∞' : formatTime(timeLeft);
    this.timerEl.classList.toggle('urgent', timeLeft !== null && timeLeft < 30);
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.hidden = true;
    }
  }

  private matName(m: Mat): string {
    const key = MATERIALS[m].key;
    return document.documentElement.lang === 'he' ? MAT_KEYS_HE[key] ?? key : MAT_KEYS[key] ?? key;
  }

  render(): void {
    const st = this.build.state;
    // Top bar
    this.topbar.innerHTML = '';
    const title = el('div', 'b-title', `<b>${esc(t('buildPhase'))}</b>`);
    const budgetWrap = el('div', 'b-budgetwrap');
    budgetWrap.append(el('span', 'lbl', t('blocks')), this.budgetEl);
    const bar = el('div', 'bbar');
    bar.appendChild(this.budgetFill);
    budgetWrap.appendChild(bar);
    const actions = el('div', 'row');
    actions.append(
      btn(t('autoBuild'), 'small', () => this.cb.autoBuild()),
      btn(t('blueprints'), 'small', () => this.toggleBlueprints()),
      btn(t('ready'), 'primary', () => this.cb.ready()),
    );
    this.topbar.append(title, this.timerEl, budgetWrap, this.statusEl, actions);
    // Rail
    this.rail.innerHTML = '';
    for (const tool of ['block', 'box', 'prefab', 'paint', 'erase', 'flag', 'spawn'] as Tool[]) {
      const b = btn(`<span class="ico">${TOOL_ICONS[tool]}</span><span class="tl">${esc(t(TOOL_KEYS[tool]))}</span>`, `tool ${st.tool === tool ? 'active' : ''}`, () => this.build.setTool(tool));
      b.dataset.tool = tool;
      this.rail.appendChild(b);
    }
    const sep = el('div', 'sep');
    this.rail.appendChild(sep);
    this.rail.appendChild(btn(`↶ ${esc(t('undo'))}`, 'tool small-tool', () => this.build.undo()));
    this.rail.appendChild(btn(`↷ ${esc(t('redo'))}`, 'tool small-tool', () => this.build.redo()));
    this.rail.appendChild(btn(`⇋ ${esc(t('mirror'))}`, `tool small-tool ${st.mirror ? 'active' : ''}`, () => this.build.toggleMirror()));
    this.rail.appendChild(btn(`◻ ${esc(t('hollow'))}`, `tool small-tool ${st.hollow ? 'active' : ''}`, () => this.build.toggleHollow()));
    this.rail.appendChild(btn(`🗑 ${esc(t('clearAll'))}`, 'tool small-tool danger', () => this.build.clearAll()));
    // Palette
    this.renderPalette();
    this.renderDrawer();
    this.hint.textContent = st.tool === 'prefab' ? t('buildHint') : `${t('buildHint')} · ${t('buildCamHint')}`;
    this.refresh();
  }

  private renderPalette(): void {
    const st = this.build.state;
    const style = STYLES[st.style];
    this.palette.innerHTML = '';
    const mats = el('div', 'mats');
    for (const m of style.materials) {
      const b = el('button', `mat ${st.mat === m ? 'active' : ''}`);
      b.title = this.matName(m);
      const chip = el('div', `chip tex-${MATERIALS[m].key}`);
      chip.style.background = PALETTE[st.color];
      b.append(chip, el('span', 'mname', this.matName(m)));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setMaterial(m);
      });
      mats.appendChild(b);
    }
    const cols = el('div', 'cols');
    for (const c of style.colors) {
      const b = el('button', `col ${st.color === c ? 'active' : ''}`);
      b.style.background = PALETTE[c];
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setColor(c);
      });
      cols.appendChild(b);
    }
    this.palette.append(mats, cols, this.hint);
  }

  private renderDrawer(): void {
    const st = this.build.state;
    this.drawer.innerHTML = '';
    this.drawer.hidden = st.tool !== 'prefab';
    if (st.tool !== 'prefab') return;
    const head = el('div', 'd-head', `<b>${esc(t('prefabs'))}</b>`);
    const sizes = el('div', 'seg');
    const def = PREFABS[st.prefab];
    for (let i = 0; i < def.sizes; i++) {
      const b = el('button', st.prefabSize === i ? 'active' : '', ['S', 'M', 'L'][i]);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setPrefabSize(i);
      });
      sizes.appendChild(b);
    }
    head.appendChild(sizes);
    head.appendChild(btn(`↻ R`, 'small', () => this.build.rotate()));
    this.drawer.appendChild(head);
    const grid = el('div', 'd-grid');
    for (const id of PREFAB_IDS) {
      const b = el('button', `pf ${st.prefab === id ? 'active' : ''}`, esc(t(PREFABS[id].nameKey)));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setPrefab(id);
      });
      grid.appendChild(b);
    }
    this.drawer.appendChild(grid);
  }

  private toggleBlueprints(): void {
    this.bpPanel.hidden = !this.bpPanel.hidden;
    if (!this.bpPanel.hidden) this.renderBlueprints();
  }

  private renderBlueprints(): void {
    this.bpPanel.innerHTML = `<b>${esc(t('blueprints'))}</b>`;
    const row = el('div', 'row');
    const input = el('input');
    input.type = 'text';
    input.placeholder = t('blueprintName');
    input.maxLength = 24;
    row.append(
      input,
      btn(t('saveBlueprint'), 'small primary', () => {
        const name = input.value.trim() || `Fortress ${new Date().toLocaleTimeString()}`;
        this.build.saveBlueprint(name);
        this.renderBlueprints();
      }),
    );
    this.bpPanel.appendChild(row);
    const list = el('div', 'bp-list');
    for (const bp of this.build.listBlueprints()) {
      const item = el('div', 'bp-item');
      item.append(
        el('span', 'bp-name', `${esc(bp.name)} <span class="muted">${esc(t(STYLES[bp.style]?.nameKey ?? ''))}</span>`),
        btn(t('loadBlueprint'), 'small', () => {
          this.build.loadBlueprint(bp.name);
          this.bpPanel.hidden = true;
        }),
        btn('✖', 'small danger', () => {
          this.build.deleteBlueprint(bp.name);
          this.renderBlueprints();
        }),
      );
      list.appendChild(item);
    }
    this.bpPanel.appendChild(list);
  }

  /** Cheap refresh of dynamic bits (active states, budget, status). */
  refresh(): void {
    const st = this.build.state;
    this.budgetEl.textContent = `${st.used} / ${st.budget}`;
    this.budgetFill.style.width = `${Math.min(100, (st.used / st.budget) * 100)}%`;
    this.budgetFill.classList.toggle('full', st.used >= st.budget);
    let statusKey = 'flagOk';
    if (st.reach.reason === 'noFlag') statusKey = 'flagMissing';
    else if (st.reach.reason === 'sealed') statusKey = 'flagSealed';
    else if (st.reach.reason === 'flagOutside') statusKey = 'flagOutside';
    else if (st.reach.reason === 'noSpawn') statusKey = 'spawnMissing';
    else if (st.reach.reason === 'spawnUnreachable') statusKey = 'spawnUnreachable';
    this.statusEl.textContent = t(statusKey);
    this.statusEl.className = `b-status ${st.reach.ok ? 'ok' : 'bad'}`;
    for (const b of Array.from(this.rail.querySelectorAll('button.tool[data-tool]'))) b.classList.toggle('active', (b as HTMLElement).dataset.tool === st.tool);
    // Palette active states
    const mats = Array.from(this.palette.querySelectorAll('button.mat'));
    STYLES[st.style].materials.forEach((m, i) => {
      const b = mats[i] as HTMLElement | undefined;
      if (!b) return;
      b.classList.toggle('active', st.mat === m);
      (b.querySelector('.chip') as HTMLElement).style.background = PALETTE[st.color];
    });
    const cols = Array.from(this.palette.querySelectorAll('button.col'));
    STYLES[st.style].colors.forEach((c, i) => cols[i]?.classList.toggle('active', st.color === c));
    const drawerHidden = st.tool !== 'prefab';
    if (this.drawer.hidden !== drawerHidden || (!drawerHidden && !this.drawer.querySelector(`.pf.active`))) this.renderDrawer();
    if (!drawerHidden) {
      for (const b of Array.from(this.drawer.querySelectorAll('.pf'))) b.classList.toggle('active', b.textContent === t(PREFABS[st.prefab].nameKey));
      this.renderDrawerHead();
    }
    const mirrorBtn = this.rail.querySelectorAll('.small-tool')[2];
    mirrorBtn?.classList.toggle('active', st.mirror);
    const hollowBtn = this.rail.querySelectorAll('.small-tool')[3];
    hollowBtn?.classList.toggle('active', st.hollow);
  }

  private renderDrawerHead(): void {
    const st = this.build.state;
    const seg = this.drawer.querySelector('.d-head .seg');
    if (!seg) return;
    const def = PREFABS[st.prefab];
    if (seg.children.length !== def.sizes) {
      this.renderDrawer();
      return;
    }
    Array.from(seg.children).forEach((c, i) => c.classList.toggle('active', i === st.prefabSize));
  }
}
