import { el, btn, esc } from '../ui/dom';
import { t } from '../core/i18n';
import { HOTBAR_SIZE, TWO_POINT_TOOLS, type BuildMode, type Tool } from './BuildMode';
import { STYLES, type StyleId } from '../world/Styles';
import { PALETTE, MATERIALS, SHAPE_KINDS, makeShape, type Mat, type ShapeKind } from '../world/Voxel';
import { PREFAB_IDS, PREFABS, type PrefabId } from '../world/Prefabs';
import { ARCHETYPES, type Archetype } from '../world/FortressGen';
import { formatTime } from '../core/MathUtil';

const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const TOOL_ICONS: Record<Tool, string> = {
  block: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  box: svg('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9h16M9 4v16" stroke-dasharray="2 2"/>'),
  line: svg('<path d="M4 20L20 4"/><rect x="2.5" y="17.5" width="4" height="4"/><rect x="17.5" y="2.5" width="4" height="4"/>'),
  wall: svg('<path d="M3 7h18M3 12h18M3 17h18M3 7v10M21 7v10M9 7v5M15 12v5M12 7v0"/><rect x="3" y="7" width="18" height="10"/>'),
  stairs: svg('<path d="M3 21h4v-4h4v-4h4V9h4V5h2"/>'),
  prefab: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  paint: svg('<path d="M14 3l7 7-9 9H5v-7l9-9z"/><path d="M5 19l-2 2"/>'),
  erase: svg('<path d="M6 18L18 6M6 6l12 12"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  spawn: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>'),
};
const TOOL_KEYS: Record<Tool, string> = { block: 'toolBlock', box: 'toolBox', line: 'toolLine', wall: 'toolWall', stairs: 'toolStairs', prefab: 'toolPrefab', paint: 'toolPaint', erase: 'toolErase', flag: 'toolFlag', spawn: 'toolSpawn' };
const TOOL_HOTKEY: Record<Tool, string> = { block: 'B', box: 'V', line: 'L', wall: 'N', stairs: 'K', prefab: 'P', paint: 'C', erase: 'X', flag: 'F', spawn: 'G' };
const TOOLS: Tool[] = ['block', 'box', 'line', 'wall', 'stairs', 'prefab', 'paint', 'erase', 'flag', 'spawn'];
const SHAPE_KEYS: Record<ShapeKind, string> = { cube: 'shCube', slab: 'shSlab', slabTop: 'shSlabTop', stairs: 'shStairs', slope: 'shSlope', pillar: 'shPillar', fence: 'shFence' };
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
  /** Rendered icon (data URL) of a block kind (shape id optional). */
  thumb(mat: Mat, color: number, shape?: number): string;
  /** Rendered icon (data URL) of a prefab. */
  prefabThumb(id: PrefabId, size: number, style: StyleId): string;
}

type SheetTab = 'materials' | 'prefabs' | 'templates';

/**
 * Build-phase interface: a hotbar of quick slots with rendered block icons, a tool rail (or a
 * compact icon strip on phones), a context strip for the active tool, and a browser sheet for
 * materials, prefabs, templates and blueprints.
 */
export class BuildUI {
  readonly root: HTMLElement;
  private topbar: HTMLElement;
  private timerEl: HTMLElement;
  private budgetEl: HTMLElement;
  private budgetFill: HTMLElement;
  private statusEl: HTMLElement;
  private rail: HTMLElement;
  private strip: HTMLElement;
  private hotbar: HTMLElement;
  private context: HTMLElement;
  private sheet: HTMLElement;
  private sheetTab: SheetTab = 'materials';
  private hint: HTMLElement;
  private toast: HTMLElement;
  private toastTimer = 0;
  private unsub: (() => void) | null = null;
  private hotbarKey = '';
  private contextKey = '';

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
    this.strip = el('div', 'b-strip');
    this.hotbar = el('div', 'b-hotbar');
    this.context = el('div', 'b-context');
    this.sheet = el('div', 'b-sheet');
    this.sheet.hidden = true;
    this.hint = el('div', 'b-hint');
    this.toast = el('div', 'b-toast');
    this.toast.hidden = true;
    this.root.append(this.topbar, this.rail, this.strip, this.context, this.hotbar, this.hint, this.sheet, this.toast);
    for (const panel of [this.topbar, this.rail, this.strip, this.hotbar, this.context, this.sheet]) {
      panel.setAttribute('data-ui', '1');
      panel.addEventListener('mouseenter', () => (this.build.uiHover = true));
      panel.addEventListener('mouseleave', () => (this.build.uiHover = false));
      panel.addEventListener('pointerdown', () => (this.build.uiHover = true));
      panel.addEventListener('pointerup', () => window.setTimeout(() => (this.build.uiHover = false), 50));
    }
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      if (e.code === 'Tab' || e.code === 'KeyI') {
        e.preventDefault();
        this.toggleSheet(this.build.state.tool === 'prefab' ? 'prefabs' : 'materials');
      }
      if (e.code === 'Escape' && !this.sheet.hidden) this.sheet.hidden = true;
    });
    this.render();
  }

  show(): void {
    this.root.hidden = false;
    this.render();
    this.unsub?.();
    const offChange = this.build.events.on('change', () => this.refresh());
    const offInvalid = this.build.events.on('invalid', ({ key }) => this.showToast(t(key)));
    this.unsub = () => {
      offChange();
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
    this.build.uiHover = false;
  }

  render(): void {
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
      actions.append(btn(t('templates'), 'small', () => this.toggleSheet('templates')), btn(t('ready'), 'primary', () => this.cb.ready()));
      this.topbar.append(this.timerEl, budgetWrap, this.statusEl, actions);
    } else {
      actions.append(
        btn(t('templates'), 'small', () => this.toggleSheet('templates')),
        btn(t('autoBuild'), 'small', () => this.cb.autoBuild()),
        btn(t('ready'), 'primary', () => this.cb.ready()),
      );
      this.topbar.append(title, this.timerEl, budgetWrap, this.statusEl, actions);
    }
    // Tools
    this.rail.innerHTML = '';
    this.strip.innerHTML = '';
    this.rail.hidden = this.compact;
    this.strip.hidden = !this.compact;
    if (this.compact) this.renderStrip();
    else this.renderRail();
    this.hint.textContent = this.compact ? '' : t('buildHint');
    this.hint.hidden = this.compact;
    this.hotbarKey = '';
    this.contextKey = '';
    if (!this.sheet.hidden) this.renderSheet();
    this.refresh();
  }

  private toolButton(tool: Tool, withLabel: boolean): HTMLButtonElement {
    const st = this.build.state;
    const label = withLabel ? `<span class="tl">${esc(t(TOOL_KEYS[tool]))}</span><span class="hk">${TOOL_HOTKEY[tool]}</span>` : '';
    const b = btn(`<span class="ico">${TOOL_ICONS[tool]}</span>${label}`, `tool ${st.tool === tool ? 'active' : ''}`, () => {
      this.build.setTool(tool);
      if (tool === 'prefab' && this.compact) this.toggleSheet('prefabs');
      else if (this.compact) this.sheet.hidden = true;
    });
    b.dataset.tool = tool;
    b.title = t(TOOL_KEYS[tool]);
    return b;
  }

  private renderRail(): void {
    const st = this.build.state;
    for (const tool of TOOLS) this.rail.appendChild(this.toolButton(tool, true));
    this.rail.appendChild(el('div', 'sep'));
    this.rail.appendChild(btn(`↶ ${esc(t('undo'))}`, 'tool small-tool', () => this.build.undo()));
    this.rail.appendChild(btn(`↷ ${esc(t('redo'))}`, 'tool small-tool', () => this.build.redo()));
    this.rail.appendChild(btn(`⇋ ${esc(t('mirror'))} <span class="hk">M</span>`, `tool small-tool ${st.mirror ? 'active' : ''}`, () => this.build.toggleMirror()));
    this.rail.appendChild(btn(`◻ ${esc(t('hollow'))}`, `tool small-tool ${st.hollow ? 'active' : ''}`, () => this.build.toggleHollow()));
    this.rail.appendChild(btn(`▤ ${esc(t('layerLock'))} <span class="hk">T</span>`, `tool small-tool ${st.layerLock ? 'active' : ''}`, () => this.build.toggleLayerLock()));
    this.rail.appendChild(btn(`🗑 ${esc(t('clearAll'))}`, 'tool small-tool danger', () => this.build.clearAll()));
  }

  private renderStrip(): void {
    for (const tool of TOOLS) this.strip.appendChild(this.toolButton(tool, false));
  }

  // ---------- hotbar ----------
  private renderHotbar(): void {
    const st = this.build.state;
    const key = st.hotbar.map((s) => (s ? (s.kind === 'block' ? `b${s.mat}:${s.color}:${s.shape ?? 'cube'}` : `p${s.id}:${st.prefabSize}`) : '-')).join('|') + `#${st.hotIndex}#${st.style}`;
    if (key === this.hotbarKey) return;
    this.hotbarKey = key;
    this.hotbar.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = st.hotbar[i];
      const b = el('button', `hs ${i === st.hotIndex ? 'active' : ''} ${slot ? (slot.kind === 'prefab' ? 'pf' : '') : 'empty'}`);
      if (slot) {
        const img = el('img');
        img.draggable = false;
        img.src = slot.kind === 'block' ? this.cb.thumb(slot.mat, slot.color, makeShape(slot.shape ?? 'cube', 0)) : this.cb.prefabThumb(slot.id, Math.min(st.prefabSize, PREFABS[slot.id].sizes - 1), st.style);
        img.alt = slot.kind === 'block' ? this.matName(slot.mat) : t(PREFABS[slot.id].nameKey);
        b.appendChild(img);
        b.title = img.alt;
      } else b.appendChild(el('span', 'plus', '+'));
      b.appendChild(el('span', 'k', String(i + 1)));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (i === st.hotIndex || !slot) {
          this.build.selectHotbar(i);
          this.toggleSheet(slot && slot.kind === 'prefab' ? 'prefabs' : 'materials');
        } else this.build.selectHotbar(i);
      });
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.build.selectHotbar(i);
        this.toggleSheet('materials');
      });
      this.hotbar.appendChild(b);
    }
    const open = el('button', 'hs more', svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'));
    open.title = t('materials');
    open.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSheet(st.tool === 'prefab' ? 'prefabs' : 'materials');
    });
    this.hotbar.appendChild(open);
  }

  // ---------- context strip ----------
  private renderContext(): void {
    const st = this.build.state;
    const key = `${st.tool}|${st.mat}|${st.color}|${st.prefab}|${st.prefabSize}|${st.rot}|${st.wallHeight}|${st.layerLock}|${st.layerY}|${st.boxStart ? 1 : 0}|${st.hollow}|${st.mirror}|${st.shapeKind}`;
    if (key === this.contextKey) return;
    this.contextKey = key;
    const c = this.context;
    c.innerHTML = '';
    const chip = (label: string, cls = ''): HTMLElement => el('span', `cchip ${cls}`, label);
    const seg = (options: { label: string; active: boolean; onClick: () => void }[]): HTMLElement => {
      const wrap = el('div', 'seg');
      for (const o of options) {
        const b = el('button', o.active ? 'active' : '', o.label);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          o.onClick();
        });
        wrap.appendChild(b);
      }
      return wrap;
    };
    const twoPoint = TWO_POINT_TOOLS.includes(st.tool);
    if (st.tool === 'block' || st.tool === 'paint' || twoPoint) {
      const sw = el('span', 'csw');
      sw.style.background = PALETTE[st.color];
      c.append(sw, chip(this.matName(st.mat)));
    }
    if (st.tool === 'block' || (twoPoint && st.tool !== 'box')) {
      // Shape picker with rendered icons; R rotates stairs and slopes.
      const shapes = el('div', 'shapes');
      for (const k of SHAPE_KINDS) {
        const b = el('button', `shape ${st.shapeKind === k ? 'active' : ''}`);
        const img = el('img');
        img.draggable = false;
        img.src = this.cb.thumb(st.mat, st.color, makeShape(k, st.rot));
        b.appendChild(img);
        b.title = t(SHAPE_KEYS[k]);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.build.setShapeKind(k);
        });
        shapes.appendChild(b);
      }
      c.append(shapes);
      if (st.shapeKind === 'stairs' || st.shapeKind === 'slope') c.append(btn('↻', 'small', () => this.build.rotate()));
    }
    if (st.tool === 'prefab') {
      const def = PREFABS[st.prefab];
      c.append(chip(t(def.nameKey), 'strong'));
      if (def.sizes > 1) c.append(seg(Array.from({ length: def.sizes }, (_, i) => ({ label: ['S', 'M', 'L'][i], active: st.prefabSize === i, onClick: () => this.build.setPrefabSize(i) }))));
      c.append(btn(`↻`, 'small', () => this.build.rotate()));
    }
    if (st.tool === 'wall') {
      c.append(chip(t('toolWall'), 'strong'));
      c.append(btn('−', 'small', () => this.build.setWallHeight(st.wallHeight - 1)), chip(`${st.wallHeight}`), btn('+', 'small', () => this.build.setWallHeight(st.wallHeight + 1)));
    }
    if (st.tool === 'box') c.append(btn(`◻ ${esc(t('hollow'))}`, `small ${st.hollow ? 'active' : ''}`, () => this.build.toggleHollow()));
    if (twoPoint) c.append(chip(st.boxStart ? '● → ○' : '○ → ○', 'muted'));
    if (st.mirror) c.append(chip(`⇋ ${esc(t('mirror'))}`, 'muted'));
    if (st.layerLock) {
      c.append(btn('▼', 'small', () => this.build.nudge(-1)), chip(`${t('layerLock')} ${st.layerY - 12 + 1}`, 'strong'), btn('▲', 'small', () => this.build.nudge(1)));
      c.append(btn('✕', 'small', () => this.build.toggleLayerLock()));
    }
    c.hidden = c.children.length === 0;
  }

  // ---------- sheet ----------
  private renderMaterialsInto(parent: HTMLElement): void {
    const st = this.build.state;
    const style = STYLES[st.style];
    const grid = el('div', 'mat-grid');
    for (const m of style.materials) {
      const tile = el('button', `mat-tile ${st.mat === m && st.tool !== 'prefab' ? 'active' : ''}`);
      const img = el('img');
      img.draggable = false;
      img.src = this.cb.thumb(m, st.color);
      tile.append(img, el('span', 'mname', this.matName(m)));
      tile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setMaterial(m);
        if (this.compact) this.sheet.hidden = true;
      });
      grid.appendChild(tile);
    }
    const cols = el('div', 'cols');
    for (const col of style.colors) {
      const b = el('button', `col ${st.color === col ? 'active' : ''}`);
      b.style.background = PALETTE[col];
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setColor(col);
        this.renderSheet();
      });
      cols.appendChild(b);
    }
    parent.append(el('div', 'd-head', `<b>${esc(t('colors'))}</b>`), cols, el('div', 'd-head', `<b>${esc(t('materials'))}</b>`), grid);
  }

  private renderPrefabsInto(parent: HTMLElement): void {
    const st = this.build.state;
    const head = el('div', 'd-head', `<b>${esc(t('prefabs'))}</b>`);
    const sizes = el('div', 'seg');
    for (let i = 0; i < 3; i++) {
      const b = el('button', st.prefabSize === i ? 'active' : '', ['S', 'M', 'L'][i]);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setPrefabSize(i);
        this.renderSheet();
      });
      sizes.appendChild(b);
    }
    head.append(sizes, btn(`↻ R`, 'small', () => this.build.rotate()));
    parent.appendChild(head);
    const grid = el('div', 'pf-grid');
    for (const id of PREFAB_IDS) {
      const def = PREFABS[id];
      const tile = el('button', `mat-tile pf-tile ${st.prefab === id && st.tool === 'prefab' ? 'active' : ''}`);
      const img = el('img');
      img.draggable = false;
      img.src = this.cb.prefabThumb(id, Math.min(st.prefabSize, def.sizes - 1), st.style);
      tile.append(img, el('span', 'mname', t(def.nameKey)));
      tile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.build.setPrefab(id);
        if (this.compact) this.sheet.hidden = true;
      });
      grid.appendChild(tile);
    }
    parent.appendChild(grid);
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
      case 'materials':
        this.renderMaterialsInto(body);
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

  /** Cheap refresh of dynamic bits (active states, budget, status, hotbar, context). */
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
    const smalls = this.rail.querySelectorAll('.small-tool');
    smalls[2]?.classList.toggle('active', st.mirror);
    smalls[3]?.classList.toggle('active', st.hollow);
    smalls[4]?.classList.toggle('active', st.layerLock);
    this.renderHotbar();
    this.renderContext();
    if (!this.sheet.hidden) {
      // Keep active tiles in sync without rebuilding the whole sheet.
      for (const tile of Array.from(this.sheet.querySelectorAll('.mat-tile'))) tile.classList.remove('active');
      const mats = Array.from(this.sheet.querySelectorAll('.mat-grid .mat-tile'));
      STYLES[st.style].materials.forEach((m, i) => mats[i]?.classList.toggle('active', st.mat === m && st.tool !== 'prefab'));
      const pfs = Array.from(this.sheet.querySelectorAll('.pf-grid .mat-tile'));
      PREFAB_IDS.forEach((id, i) => pfs[i]?.classList.toggle('active', st.prefab === id && st.tool === 'prefab'));
      const cols = Array.from(this.sheet.querySelectorAll('button.col'));
      STYLES[st.style].colors.forEach((c, i) => cols[i]?.classList.toggle('active', st.color === c));
    }
  }
}
