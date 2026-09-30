import { fmtTime, LAB_TOOLS, type LabRunStats, type LabTool } from '../game/labdirector';
import { VARIANTS, type CombatVariant } from '../game/variant';
import { formatNumber, onLangChange, t } from './i18n';

export interface LabHudState {
  variant: CombatVariant;
  /** 1-based. */
  wave: number;
  waves: number;
  phase: 'idle' | 'breather' | 'fight' | 'done';
  left: number;
  waveT: number;
  stats: LabRunStats;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Short labels for the tool grid. */
export const TOOL_KEY: Record<LabTool, string> = {
  grab: 'lab.tool.grab',
  reflect: 'lab.tool.reflect',
  loop: 'lab.tool.loop',
  swap: 'lab.tool.swap',
  dash: 'lab.tool.dash',
  blade: 'lab.tool.blade',
  other: 'lab.tool.other',
};

/**
 * The COMBAT LAB's HUD: a compact run panel top-left (variant chips F1-F3,
 * which also take a tap; the wave, its clock and who's left; the splits;
 * total time, damage, deaths; kills by tool), and the big WAVE banner.
 * DOM writes only when a value changes.
 */
export class LabHud {
  readonly el: HTMLDivElement;
  private banner: HTMLDivElement;
  onPick: (v: CombatVariant) => void = () => {};
  private cache = new Map<string, string>();
  private shown = false;
  private unsub: () => void;
  private last: LabHudState | null = null;

  constructor(private host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'lab-panel';
    this.banner = document.createElement('div');
    this.banner.className = 'lab-banner';
    host.appendChild(this.el);
    host.appendChild(this.banner);
    this.el.addEventListener('pointerdown', (e) => {
      const b = (e.target as Element).closest('[data-v]') as HTMLElement | null;
      if (!b) return;
      e.stopPropagation();
      e.preventDefault();
      this.onPick(b.dataset.v as CombatVariant);
    });
    this.build();
    this.unsub = onLangChange(() => {
      this.build();
      if (this.last) this.update(this.last);
    });
  }

  private build() {
    this.cache.clear();
    const chips = VARIANTS.map((v, i) => `<button type="button" data-v="${v}"><kbd>F${i + 1}</kbd><span>${esc(t(`lab.v.${v}`))}</span></button>`).join('');
    const tools = LAB_TOOLS.map((k) => `<div class="lt-${k}"><small>${esc(t(TOOL_KEY[k]))}</small><b data-f="k.${k}">0</b></div>`).join('');
    this.el.innerHTML = `
      <div class="lp-head"><span class="lp-tag">${esc(t('lab.title'))}</span><div class="lp-vars">${chips}</div></div>
      <div class="lp-wave"><b data-f="wave"></b><span class="lp-left" data-f="left"></span><span class="lp-wt" data-f="waveT" dir="ltr"></span></div>
      <div class="lp-splits" data-f="splits" dir="ltr"></div>
      <div class="lp-stats">
        <div><small>${esc(t('lab.total'))}</small><b data-f="total" dir="ltr"></b></div>
        <div><small>${esc(t('lab.damage'))}</small><b data-f="dmg"></b></div>
        <div><small>${esc(t('lab.deaths'))}</small><b data-f="deaths"></b></div>
        <div><small>${esc(t('lab.kills'))}</small><b data-f="kills"></b></div>
      </div>
      <div class="lp-tools">${tools}</div>`;
  }

  private set(f: string, v: string, html = false) {
    if (this.cache.get(f) === v) return;
    this.cache.set(f, v);
    const el = this.el.querySelector(`[data-f="${f}"]`) as HTMLElement | null;
    if (!el) return;
    if (html) el.innerHTML = v;
    else el.textContent = v;
  }

  show(on: boolean) {
    this.shown = on;
    this.el.classList.toggle('on', on);
    if (!on) this.banner.className = 'lab-banner';
  }

  update(s: LabHudState) {
    this.last = s;
    if (!this.shown) return;
    const vk = `v:${s.variant}`;
    if (this.cache.get('variant') !== vk) {
      this.cache.set('variant', vk);
      this.el.querySelectorAll<HTMLElement>('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === s.variant));
      this.el.dataset.variant = s.variant;
    }
    this.set('wave', `${t('lab.wave', { n: s.wave })}`);
    this.set('left', s.phase === 'fight' ? t('lab.left', { n: s.left }) : s.phase === 'done' ? t('lab.done') : t('lab.incoming'));
    this.set('waveT', s.phase === 'fight' || s.phase === 'done' ? fmtTime(s.phase === 'done' ? s.stats.waves[s.waves - 1].time : s.waveT) : '');
    const splits = s.stats.waves
      .map((w, i) => {
        const cls = w.cleared ? 'ok' : i + 1 === s.wave && s.phase === 'fight' ? 'now' : '';
        return `<i class="${cls}">W${i + 1} <b>${w.cleared ? fmtTime(w.time) : i + 1 === s.wave && s.phase === 'fight' ? '···' : '—'}</b></i>`;
      })
      .join('');
    this.set('splits', splits, true);
    this.set('total', fmtTime(s.stats.total));
    this.set('dmg', formatNumber(Math.round(s.stats.damage)));
    this.set('deaths', formatNumber(s.stats.deaths));
    let n = 0;
    for (const k of LAB_TOOLS) {
      n += s.stats.kills[k];
      this.set(`k.${k}`, String(s.stats.kills[k]));
    }
    this.set('kills', formatNumber(n));
  }

  /** WAVE n: the banner, with a countdown to the first man through. */
  announce(n: number, waves: number, sub: string, variant: CombatVariant) {
    this.banner.innerHTML = `<small>${esc(t('lab.title'))} · ${esc(t(`lab.v.${variant}`))}</small><h2>${esc(t('lab.wave', { n }))}<em dir="ltr">/${waves}</em></h2><p>${esc(sub)}</p><b class="cd" dir="ltr"></b>`;
    this.banner.className = 'lab-banner';
    void this.banner.offsetWidth;
    this.banner.className = 'lab-banner go';
  }

  countdown(secs: number) {
    const cd = this.banner.querySelector('.cd') as HTMLElement | null;
    if (!cd) return;
    const v = secs > 0 ? String(Math.ceil(secs)) : '';
    if (cd.textContent !== v) cd.textContent = v;
  }

  /** WAVE n CLEAR and its split. */
  cleared(n: number, time: number) {
    this.banner.innerHTML = `<h2 class="clr">${esc(t('lab.clear', { n }))}</h2><p dir="ltr">${fmtTime(time)}</p>`;
    this.banner.className = 'lab-banner';
    void this.banner.offsetWidth;
    this.banner.className = 'lab-banner go short';
  }

  dispose() {
    this.unsub();
    this.el.remove();
    this.banner.remove();
  }

  get parent() {
    return this.host;
  }
}
