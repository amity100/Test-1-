import { el, btn, esc } from '../ui/dom';
import { t } from '../core/i18n';
import type { BuildMode, Tool } from './BuildMode';
import { STYLES } from '../world/Styles';
import { PALETTE, MATERIALS, type Mat } from '../world/Voxel';
import { PREFAB_IDS, PREFABS } from '../world/Prefabs';
import { ARCHETYPES, type Archetype } from '../world/FortressGen';
import { formatTime } from '../core/MathUtil';

const TOOL_ICONS: Record<Tool, string> = { block: '■', box: '▣', prefab: '⌂', paint: '🖌', erase: '✖', flag: '⚑', spawn: '◎' };
const TOOL_KEYS: Record<Tool, string> = { block: 'toolBlock', box: 'toolBox', prefab: 'toolPrefab', paint: 'toolPaint', erase: 'toolErase', flag: 'toolFlag', spawn: 'toolSpawn' };
const ARCH_KEYS: Record<Archetype, string> = { castle: 'aCastle', palace: 'aPalace', villa: 'aVilla', bunker: 'aBunker', tower: 'aTower', temple: 'aTemple' };
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
  autoBuild(archetype?: Archetype): void;
}

type SheetTab = 'tools' | 'materials' | 'prefabs' | 'templates';

/** Build-phase panels: top bar, tool rail, palette, prefab drawer, and a bottom sheet for compact screens. */
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
  private sheet: HTMLElement;
  private sheetTab: SheetTab = 'tools';
  private hint: HTMLElement;
  private toast: HTMLElement;
  private toastTimer = 0;
  private unsub: (() => void) | null = null;

  constructor(parent: HTMLElement, private build: BuildMode, private cb: BuildUICallbacks, readonly compact: boolean) {
    this.root = el('div', `buildui ${compact ? 'compact' : ''}`);
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
    this.sheet = el('div', 'b-sheet');
    this.sheet.hidden = true;
    this.hint = el('div', 'b-hint');
    this.toast = el('div', 'b-toast');
    this.toast.hidden = true;
    this.root.append(this.topbar, this.rail, this.palette, this.drawer, this.sheet, this.toast);
    for (const panel of [this.topbar, this.rail, this.palette, this.drawer, this.sheet]) {
      panel.setAttribute('data-ui', '1');
      panel.addEventListener('mouseenter', () => (this.build.uiHover = true));
      panel.addEventListener('mouseleave', () => (this.build.uiHover = false));
      panel.addEventListener('pointerdown', () => (this.build.uiHover = true));
      panel.addEventListener('pointerup', () => window.setTimeout(() => (this.build.uiHover = false), 50));
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

  toggleSheet(tab?: SheetTab): void {
    if (tab && (this.sheet.hidden || tab !== this.sheetTab)) {
      this.sheetTab = tab;
      this.sheet.hidden = false;
    } else this.sheet.hidden = !this.sheet.hidden;
    if (!this.sheet.hidden) this.renderSheet();
    this.build.uiHover = !this.sheet.hidden && this.compact ? false : this.build.uiHover;
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
    if (this.compact) {
      actions.append(btn('☰', 'small', () => this.toggleSheet()), btn(t('ready'), 'primary', () => this.cb.ready()));
    } else {
      actions.append(
        btn(t('templates'), 'small', () => this.toggleSheet('templates')),
        btn(t('autoBuild'), 'small', () => this.cb.autoBuild()),
        btn(t('ready'), 'primary', () => this.cb.ready()),
      );
    }
    if (this.compact) this.topbar.append(this.timerEl, budgetWrap, this.statusEl, actions);
    else this.topbar.append(title, this.timerEl, budgetWrap, this.statusEl, actions);
    // Rail
    this.rail.innerHTML = '';
    this.renderToolButtons(this.rail, true);
    // Palette
    this.renderPalette();
    this.renderDrawer();
    this.hint.textContent = st.tool === 'prefab' ? t('buildHint') : `${t('buildHint')} · ${t('buildCamHint')}`;
    if (!this.sheet.hidden) this.renderSheet();
    this.refresh();
  }

  private renderToolButtons(parent: HTMLElement, vertical: boolean): void {
    const st = this.build.state;
    const wrap = vertical ? parent : el('div', 'tool-grid');
    for (const tool of ['block', 'box', 'prefab', 'paint', 'erase', 'flag', 'spawn'] as Tool[]) {
      const b = btn(`<span class="ico">${TOOL_ICONS[tool]}</span><span class="tl">${esc(t(TOOL_KEYS[tool]))}</span>`, `tool ${st.tool === tool ? 'active' : ''}`, () => {
        this.build.setTool(tool);
        if (tool === 'prefab' && this.compact) this.toggleSheet('prefabs');
        else if (this.compact) this.sheet.hidden = true;
      });
      b.dataset.tool = tool;
      wrap.appendChild(b);
    }
    if (vertical) wrap.appendChild(el('div', 'sep'));
    else parent.appendChild(wrap);
    const extra = vertical ? parent : el('div', 'tool-grid');
    extra.appendChild(btn(`↶ ${esc(t('undo'))}`, 'tool small-tool', () => this.build.undo()));
    extra.appendChild(btn(`↷ ${esc(t('redo'))}`, 'tool small-tool', () => this.build.redo()));
    extra.appendChild(btn(`⇋ ${esc(t('mirror'))}`, `tool small-tool ${st.mirror ? 'active' : ''}`, () => this.build.toggleMirror()));
    extra.appendChild(btn(`◻ ${esc(t('hollow'))}`, `tool small-tool ${st.hollow ? 'active' : ''}`, () => this.build.toggleHollow()));
    extra.appendChild(btn(`🗑 ${esc(t('clearAll'))}`, 'tool small-tool danger', () => this.build.clearAll()));
    if (!vertical) parent.appendChild(extra);
    if (!vertical) parent.appendChild(el('div', 'muted small-note', t('spawnHint')));
  }

  private renderPaletteInto(parent: HTMLElement): void {
    const st = this.build.state;
    const style = STYLES[st.style];
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
    parent.append(mats, cols);
  }

  private renderPalette(): void {
    this.palette.innerHTML = '';
    this.renderPaletteInto(this.palette);
    this.palette.appendChild(this.hint);
  }

  private renderPrefabsInto(parent: HTMLElement): void {
    const st = this.build.state;
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
    parent.appendChild(head);
    const grid = el('div', 'd-grid');
    for (const id of PREFAB_IDS) {
      const b = el('button', `pf ${st.prefab === id ? 'active' : ''}`, esc(t(PREFABS[id].nameKey)));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setPrefab(id);
      });
      grid.appendChild(b);
    }
    parent.appendChild(grid);
  }

  private renderDrawer(): void {
    const st = this.build.state;
    this.drawer.innerHTML = '';
    this.drawer.hidden = st.tool !== 'prefab' || this.compact;
    if (this.drawer.hidden) return;
    this.renderPrefabsInto(this.drawer);
  }

  private renderTemplatesInto(parent: HTMLElement): void {
    parent.appendChild(el('div', 'd-head', `<b>${esc(t('templates'))}</b>`));
    const grid = el('div', 'd-grid');
    for (const a of ARCHETYPES) grid.appendChild(btn(t(ARCH_KEYS[a]), 'pf', () => this.cb.autoBuild(a)));
    grid.appendChild(btn(t('aRandom'), 'pf', () => this.cb.autoBuild()));
    parent.appendChild(grid);
    parent.appendChild(el('div', 'd-head', `<b>${esc(t('blueprints'))}</b>`));
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
        this.renderSheet();
      }),
    );
    parent.appendChild(row);
    const list = el('div', 'bp-list');
    for (const bp of this.build.listBlueprints()) {
      const item = el('div', 'bp-item');
      item.append(
        el('span', 'bp-name', `${esc(bp.name)} <span class="muted">${esc(t(STYLES[bp.style]?.nameKey ?? ''))}</span>`),
        btn(t('loadBlueprint'), 'small', () => {
          this.build.loadBlueprint(bp.name);
          this.sheet.hidden = true;
        }),
        btn('✖', 'small danger', () => {
          this.build.deleteBlueprint(bp.name);
          this.renderSheet();
        }),
      );
      list.appendChild(item);
    }
    parent.appendChild(list);
  }

  private renderSheet(): void {
    this.sheet.innerHTML = '';
    const tabs = el('div', 'sheet-tabs');
    const names: [SheetTab, string][] = [
      ['tools', t('tTools')],
      ['materials', t('tMaterials')],
      ['prefabs', t('tPrefabs')],
      ['templates', t('tTemplates')],
    ];
    for (const [id, label] of names) {
      const b = el('button', `stab ${this.sheetTab === id ? 'active' : ''}`, label);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sheetTab = id;
        this.renderSheet();
      });
      tabs.appendChild(b);
    }
    const close = el('button', 'stab close', '✕');
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sheet.hidden = true;
    });
    tabs.appendChild(close);
    this.sheet.appendChild(tabs);
    const body = el('div', 'sheet-body');
    switch (this.sheetTab) {
      case 'tools':
        this.renderToolButtons(body, false);
        break;
      case 'materials':
        this.renderPaletteInto(body);
        break;
      case 'prefabs':
        this.renderPrefabsInto(body);
        break;
      case 'templates':
        this.renderTemplatesInto(body);
        break;
    }
    this.sheet.appendChild(body);
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
    this.statusEl.textContent = this.compact ? (st.reach.ok ? '⚑ ✓' : `⚑ ${t(statusKey)}`) : t(statusKey);
    this.statusEl.className = `b-status ${st.reach.ok ? 'ok' : 'bad'}`;
    for (const b of Array.from(this.root.querySelectorAll('button.tool[data-tool]'))) b.classList.toggle('active', (b as HTMLElement).dataset.tool === st.tool);
    // Palette active states (rail palette + sheet)
    for (const container of [this.palette, this.sheet]) {
      const mats = Array.from(container.querySelectorAll('button.mat'));
      STYLES[st.style].materials.forEach((m, i) => {
        const b = mats[i] as HTMLElement | undefined;
        if (!b) return;
        b.classList.toggle('active', st.mat === m);
        (b.querySelector('.chip') as HTMLElement).style.background = PALETTE[st.color];
      });
      const cols = Array.from(container.querySelectorAll('button.col'));
      STYLES[st.style].colors.forEach((c, i) => cols[i]?.classList.toggle('active', st.color === c));
      for (const b of Array.from(container.querySelectorAll('.pf'))) b.classList.toggle('active', b.textContent === t(PREFABS[st.prefab].nameKey));
    }
    const drawerHidden = st.tool !== 'prefab' || this.compact;
    if (this.drawer.hidden !== drawerHidden) this.renderDrawer();
    if (!drawerHidden) this.renderDrawerHead(this.drawer);
    if (!this.sheet.hidden && this.sheetTab === 'prefabs') this.renderDrawerHead(this.sheet);
    const smalls = this.rail.querySelectorAll('.small-tool');
    smalls[2]?.classList.toggle('active', st.mirror);
    smalls[3]?.classList.toggle('active', st.hollow);
  }

  private renderDrawerHead(container: HTMLElement): void {
    const st = this.build.state;
    const seg = container.querySelector('.d-head .seg');
    if (!seg) return;
    const def = PREFABS[st.prefab];
    if (seg.children.length !== def.sizes) {
      if (container === this.drawer) this.renderDrawer();
      else this.renderSheet();
      return;
    }
    Array.from(seg.children).forEach((c, i) => c.classList.toggle('active', i === st.prefabSize));
  }
}
