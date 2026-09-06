import { el, esc } from '../ui/dom';
import { t } from '../core/i18n';
import { BRUSHES, TABLE_LEVELS, type Brush, type CommandTable } from './Table';
import type { BuildMode } from './BuildMode';
import { WALL_PRESET_IDS, FLOOR_PRESET_IDS } from './Pieces';

const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON: Record<Brush | 'more' | 'undo' | 'redo' | 'rotate' | 'up' | 'down' | 'view' | 'pause' | 'close', string> = {
  wall: svg('<path d="M3 20V9l3-2 3 2v11"/><path d="M9 20V9l3-2 3 2v11"/><path d="M15 20V9l3-2 3 2v11"/><path d="M2 20h20"/><path d="M4.5 7V4M10.5 7V4M16.5 7V4M19.5 7V4"/>'),
  tower: svg('<path d="M7 21V8h10v13"/><path d="M6 8V4h2v2h2V4h4v2h2V4h2v4"/><path d="M11 21v-5h2v5"/><path d="M10.5 12h3"/>'),
  bunker: svg('<path d="M3 20V10l9-5 9 5v10"/><path d="M3 20h18"/><path d="M10 20v-6h4v6"/><path d="M6 14h2M16 14h2"/>'),
  stairs: svg('<path d="M3 21h4v-4h4v-4h4V9h4V5h2"/>'),
  openings: svg('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M10 20v-7a2 2 0 0 1 4 0v7"/><path d="M7 8h3M14 8h3"/>'),
  cover: svg('<path d="M3 18h18"/><rect x="4" y="12" width="5" height="6" rx="1"/><rect x="9.5" y="12" width="5" height="6" rx="1"/><rect x="15" y="12" width="5" height="6" rx="1"/><path d="M7 12V9M12 12V8M17 12V9"/>'),
  maze: svg('<rect x="3" y="3" width="18" height="18"/><path d="M8 3v8h5M3 13h5v8M13 21v-5h8M16 3v6M16 13h5"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  erase: svg('<path d="M6 18L18 6M6 6l12 12"/>'),
  hand: svg('<path d="M8 13V6a1.5 1.5 0 0 1 3 0v6"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V6a1.5 1.5 0 0 1 3 0v8"/><path d="M8 13l-2.5-2.5a1.5 1.5 0 0 0-2.2 2L7 17.5c1.6 2.5 3.5 3.5 6 3.5 3.5 0 5-2.4 5-5.5V14"/>'),
  more: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 0 12h-3"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9h-9a6 6 0 0 0 0 12h3"/>'),
  rotate: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 3.5V9h5.5"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  view: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};
const BRUSH_KEYS: Record<Brush, string> = { wall: 'tbWall', tower: 'tbTower', bunker: 'tbBunker', stairs: 'tbStairs', openings: 'tbOpenings', cover: 'tbCover', maze: 'tbMaze', flag: 'tbFlag', erase: 'tbErase', hand: 'tbHand' };
const PRESET_KEYS: Record<string, string> = { full: 'prFull', door: 'prDoor', gate: 'prGate', window: 'prWindow', slit: 'prSlit', half: 'prHalf', arch: 'prArch', crenel: 'prCrenel', pillars: 'prPillars', hatch: 'prHatch', hole: 'prHole', ring: 'prRing', bridge: 'prBridge' };
const WALL_PICKS = ['slit', 'window', 'door', 'gate', 'arch', 'crenel', 'full'];
const FLOOR_PICKS = ['hatch', 'hole', 'full'];

export interface TableUICallbacks {
  toggleView(): void;
  more(): void;
  pause(): void;
}

/** Command-table interface: big brush tiles, a storey selector with camera and history buttons, the openings picker and the attack-path readout. */
export class TableUI {
  readonly root: HTMLElement;
  private bar: HTMLElement;
  private side: HTMLElement;
  private picker: HTMLElement;
  private pathChip: HTMLElement;
  private tip: HTMLElement;
  private storeyNum!: HTMLElement;
  private undoBtn!: HTMLElement;
  private redoBtn!: HTMLElement;
  private handBtn!: HTMLElement;
  private brushBtns = new Map<Brush, HTMLElement>();
  private prevBrush: Brush = 'wall';
  private pickKey: string | null = null;
  private unsub: (() => void)[] = [];
  private tipTimer = 0;
  private placements = 0;

  constructor(parent: HTMLElement, private table: CommandTable, private build: BuildMode, private cb: TableUICallbacks, readonly compact: boolean) {
    this.root = el('div', `tableui ${compact ? 'compact' : ''}`);
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.bar = el('div', 'tbl-bar');
    this.side = el('div', 'tbl-side');
    this.picker = el('div', 'tbl-picker');
    this.picker.hidden = true;
    this.pathChip = el('div', 'tbl-path');
    this.tip = el('div', 'tbl-tip');
    this.tip.hidden = true;
    for (const panel of [this.bar, this.side, this.picker, this.pathChip]) panel.setAttribute('data-ui', '1');
    this.root.append(this.bar, this.side, this.picker, this.pathChip, this.tip);
    this.buildBar();
    this.buildSide();
  }

  private button(parent: HTMLElement, cls: string, icon: string, label: string, onTap: () => void): HTMLElement {
    const b = el('button', `tbl-btn ${cls}`);
    b.innerHTML = `<span class="ico">${icon}</span>${label ? `<span class="lb">${esc(label)}</span>` : ''}`;
    b.title = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onTap();
    });
    parent.appendChild(b);
    return b;
  }

  private buildBar(): void {
    for (const b of BRUSHES) {
      const btn = this.button(this.bar, `brush b-${b}`, ICON[b], t(BRUSH_KEYS[b]), () => this.pickBrush(b));
      this.brushBtns.set(b, btn);
    }
    this.button(this.bar, 'brush more', ICON.more, t('tbMore'), () => this.cb.more());
  }

  private buildSide(): void {
    if (this.compact) this.button(this.side, 'pause', ICON.pause, '', () => this.cb.pause());
    const storey = el('div', 'tbl-storey');
    this.button(storey, 'up', ICON.up, '', () => this.table.setLevel(this.table.level + 1));
    this.storeyNum = el('div', 'num', '1');
    storey.appendChild(this.storeyNum);
    this.button(storey, 'down', ICON.down, '', () => this.table.setLevel(this.table.level - 1));
    storey.appendChild(el('div', 'cap', t('tbStorey')));
    this.side.appendChild(storey);
    this.button(this.side, 'rotate', ICON.rotate, '', () => this.table.rotate(1));
    this.undoBtn = this.button(this.side, 'undo', ICON.undo, '', () => this.build.undo());
    this.redoBtn = this.button(this.side, 'redo', ICON.redo, '', () => this.build.redo());
    this.handBtn = this.button(this.side, 'hand', ICON.hand, '', () => this.pickBrush(this.table.brush === 'hand' ? this.prevBrush : 'hand'));
    this.button(this.side, 'view', ICON.view, '3D', () => this.cb.toggleView());
  }

  private pickBrush(b: Brush): void {
    if (b !== 'hand') this.prevBrush = b;
    this.table.setBrush(b);
    this.refresh();
  }

  show(): void {
    this.root.hidden = false;
    this.hideAll();
    this.unsub.push(this.table.events.on('change', () => this.refresh()));
    this.unsub.push(this.table.events.on('picker', (p) => this.showPicker(p)));
    this.unsub.push(this.table.events.on('path', ({ length }) => this.setPath(length)));
    this.unsub.push(this.build.events.on('change', () => this.refresh()));
    this.unsub.push(
      this.build.events.on('placed', () => {
        this.placements++;
        if (this.placements >= 3) this.tip.hidden = true;
      }),
    );
    this.placements = 0;
    this.tipTimer = 14;
    this.tip.textContent = t('tbTip');
    this.tip.hidden = false;
    this.setPath(this.table.attackPathLength);
    this.refresh();
  }

  hide(): void {
    this.root.hidden = true;
    this.hideAll();
  }

  private hideAll(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.picker.hidden = true;
    this.pickKey = null;
  }

  update(dt: number): void {
    if (this.tipTimer > 0 && !this.tip.hidden) {
      this.tipTimer -= dt;
      if (this.tipTimer <= 0) this.tip.hidden = true;
    }
  }

  private setPath(length: number | null): void {
    if (length === null) {
      this.pathChip.innerHTML = `<span class="dot none"></span>${esc(t('tbNoPath'))}`;
      this.pathChip.classList.add('none');
    } else {
      this.pathChip.innerHTML = `<span class="dot"></span>${esc(t('tbPath'))} <b>${Math.round(length)} ${esc(t('metres'))}</b>`;
      this.pathChip.classList.remove('none');
    }
  }

  private showPicker(p: { key: string; type: 'wall' | 'floor'; open: boolean[] } | null): void {
    if (!p) {
      this.picker.hidden = true;
      this.pickKey = null;
      return;
    }
    this.pickKey = p.key;
    this.picker.innerHTML = `<div class="ph">${esc(t(p.type === 'wall' ? 'tbPickWall' : 'tbPickFloor'))}</div>`;
    const row = el('div', 'pr');
    const ids = (p.type === 'wall' ? WALL_PICKS : FLOOR_PICKS).filter((id) => (p.type === 'wall' ? WALL_PRESET_IDS : FLOOR_PRESET_IDS).includes(id));
    for (const id of ids) {
      const b = el('button', 'tbl-pick');
      b.dataset.preset = id;
      b.innerHTML = `<span class="pv">${presetGlyph(p.type, id)}</span><span class="lb">${esc(t(PRESET_KEYS[id]))}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pickKey) this.table.applyPreset(this.pickKey, id);
        this.picker.hidden = true;
      });
      row.appendChild(b);
    }
    const close = el('button', 'tbl-pick close');
    close.innerHTML = `<span class="pv">${ICON.close}</span>`;
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.picker.hidden = true;
      this.pickKey = null;
    });
    row.appendChild(close);
    this.picker.appendChild(row);
    this.picker.hidden = false;
  }

  refresh(): void {
    const st = this.build.state;
    for (const [b, btn] of this.brushBtns) btn.classList.toggle('active', this.table.brush === b);
    this.handBtn.classList.toggle('active', this.table.brush === 'hand');
    this.storeyNum.textContent = String(this.table.level + 1);
    this.storeyNum.parentElement?.classList.toggle('top', this.table.level >= TABLE_LEVELS - 1);
    this.undoBtn.classList.toggle('off', !st.canUndo);
    this.redoBtn.classList.toggle('off', !st.canRedo);
  }
}

/** Tiny preview of a preset as an SVG grid (solid cells dark, open cells bright). */
function presetGlyph(type: 'wall' | 'floor', id: string): string {
  const rows = type === 'wall' ? WALL_ROWS[id] : FLOOR_ROWS[id];
  if (!rows) return '';
  const h = rows.length;
  const w = rows[0].length;
  const cells: string[] = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push(`<rect x="${c * 10 + 1}" y="${r * 10 + 1}" width="8" height="8" rx="1.5" class="${rows[r][c] === '.' ? 'o' : 's'}"/>`);
  return `<svg viewBox="0 0 ${w * 10} ${h * 10}" aria-hidden="true">${cells.join('')}</svg>`;
}
const WALL_ROWS: Record<string, string[]> = {
  full: ['#####', '#####', '#####', '#####'],
  door: ['#####', '##..#', '##..#', '##..#'],
  gate: ['#####', '#...#', '#...#', '#...#'],
  window: ['#####', '#...#', '#...#', '#####'],
  slit: ['#####', '##.##', '##.##', '#####'],
  arch: ['#####', '##.##', '#...#', '#...#'],
  crenel: ['#.#.#', '#####', '#####', '#####'],
};
const FLOOR_ROWS: Record<string, string[]> = {
  full: ['#####', '#####', '#####', '#####', '#####'],
  hatch: ['#####', '#####', '##.##', '#####', '#####'],
  hole: ['#####', '#...#', '#...#', '#...#', '#####'],
};
