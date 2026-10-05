import { fmtTime, labTools, type LabRunStats, type LabTool } from '../game/labdirector';
import { FLOW } from '../game/flow';
import { LAB_OFFERED, type CombatVariant } from '../game/variant';
import { formatNumber, getDevice, onLangChange, t } from './i18n';

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

/** PRECISION's rules card: one line per key (the key's label follows the device). */
export const PREC_RULES = ['aim', 'grab', 'parry', 'dodge', 'blade', 'hp'] as const;

/** The key each rule is on, per device (touch: the button's own label). */
const PREC_KEYS: Record<string, { kbm: string; pad: string; touch: string }> = {
  grab: { kbm: 'LMB', pad: 'RT', touch: 'touch.portal' },
  parry: { kbm: 'RMB', pad: 'LT', touch: 'strike.parry' },
  dodge: { kbm: 'V', pad: 'RB', touch: 'touch.dodge' },
  blade: { kbm: 'F', pad: 'X', touch: 'touch.action' },
};

function precKey(k: string): string {
  const m = PREC_KEYS[k];
  if (!m) return t(k === 'aim' ? 'prec.k.aim' : 'prec.k.hp');
  const dev = getDevice();
  return dev === 'touch' ? t(m.touch) : dev === 'pad' ? m.pad : m.kbm;
}

export function precisionRules(): string {
  const rows = PREC_RULES.map((k) => `<div class="pr-${k}"><kbd>${esc(precKey(k))}</kbd><span>${esc(t(`prec.${k}`))}</span></div>`).join('');
  return `<small class="pr-title">${esc(t('prec.title'))}</small>${rows}`;
}

/** FLOW's own rules (on top of PRECISION's). */
export const FLOW_RULES = ['slide', 'jump', 'power'] as const;

/** The key each FLOW rule is on, per device (touch: the button's own label). */
const FLOW_KEYS: Record<(typeof FLOW_RULES)[number], { kbm: string; pad: string; touch: string }> = {
  slide: { kbm: 'C', pad: 'B', touch: 'touch.slide' },
  jump: { kbm: 'SPACE', pad: 'A', touch: 'touch.jump' },
  power: { kbm: 'Z', pad: 'R3', touch: 'touch.power' },
};

/** The POWER key's label on this device. */
export function powerKey(): string {
  const m = FLOW_KEYS.power;
  const dev = getDevice();
  return dev === 'touch' ? t(m.touch) : dev === 'pad' ? m.pad : m.kbm;
}

export function flowRules(): string {
  const dev = getDevice();
  const rows = FLOW_RULES.map((k) => {
    const m = FLOW_KEYS[k];
    const key = dev === 'touch' ? t(m.touch) : dev === 'pad' ? m.pad : m.kbm;
    return `<div class="fr-${k}"><kbd>${esc(key)}</kbd><span>${esc(t(`flow.${k}`))}</span></div>`;
  }).join('');
  return `<small class="pr-title fr-title">${esc(t('flow.title'))}</small>${rows}`;
}

/** REACH's rules card: the one rule, then three lines, the key per device (touch: the button's own label). */
export const REACH_RULES = ['window', 'hand', 'weapon'] as const;
const REACH_KEYS: Record<(typeof REACH_RULES)[number], { kbm: string; pad: string; touch: string }> = {
  window: { kbm: 'RMB', pad: 'LT', touch: 'touch.window' },
  hand: { kbm: 'E', pad: 'RB', touch: 'touch.hand' },
  weapon: { kbm: 'LMB', pad: 'RT', touch: 'touch.weapon' },
};

/** A REACH key's label on this device. */
export function reachKey(k: (typeof REACH_RULES)[number]): string {
  const m = REACH_KEYS[k];
  const dev = getDevice();
  return dev === 'touch' ? t(m.touch) : dev === 'pad' ? m.pad : m.kbm;
}

export function reachRules(): string {
  const rows = REACH_RULES.map((k) => `<div class="rr-${k}"><kbd>${esc(reachKey(k))}</kbd><span>${esc(t(`reach.rule.${k}`))}</span></div>`).join('');
  return `<small class="pr-title rr-title">${esc(t('reach.rule.title'))}</small>${rows}`;
}

/** AIM PORTAL's rules card: the one rule, then the five verbs, the key per device (touch: the button's own label). */
export const AIM_RULES = ['portal', 'fire', 'stab', 'pull', 'snap'] as const;
const AIM_KEYS: Record<(typeof AIM_RULES)[number], { kbm: string; pad: string; touch: string }> = {
  portal: { kbm: 'RMB', pad: 'LT', touch: 'touch.aimportal' },
  fire: { kbm: 'LMB', pad: 'RT', touch: 'touch.fire' },
  stab: { kbm: 'F', pad: 'X', touch: 'touch.stab' },
  pull: { kbm: 'E', pad: 'RB', touch: 'touch.pull' },
  snap: { kbm: 'CTRL', pad: 'LT + R-STICK', touch: 'touch.aimportal' },
};

/** An AIM PORTAL key's label on this device. */
export function aimKey(k: (typeof AIM_RULES)[number]): string {
  const m = AIM_KEYS[k];
  const dev = getDevice();
  return dev === 'touch' ? t(m.touch) : dev === 'pad' ? m.pad : m.kbm;
}

export function aimRules(): string {
  const rows = AIM_RULES.map((k) => `<div class="ar-${k}"><kbd>${esc(aimKey(k))}</kbd><span>${esc(t(`aim.rule.${k}`))}</span></div>`).join('');
  return `<small class="pr-title rr-title">${esc(t('aim.rule.title'))}</small>${rows}`;
}

/** What FLOW's HUD shows: the POWER meter and its state, speed (for the lines). */
export interface FlowHudState {
  /** 0..1. */
  meter: number;
  phase: 'idle' | 'held' | 'chain';
  marks: number;
  /** 0..1: how hard the speed lines show. */
  speed: number;
}

/** Short labels for the tool grid. */
export const TOOL_KEY: Record<LabTool, string> = {
  grab: 'lab.tool.grab',
  reflect: 'lab.tool.reflect',
  loop: 'lab.tool.loop',
  swap: 'lab.tool.swap',
  dash: 'lab.tool.dash',
  blade: 'lab.tool.blade',
  rifle: 'lab.tool.rifle',
  knife: 'lab.tool.knife',
  throw: 'lab.tool.throw',
  redirect: 'lab.tool.redirect',
  other: 'lab.tool.other',
};

/**
 * The COMBAT LAB's HUD: a compact run panel top-left (variant chips F1-F4,
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
  /** FLOW: the POWER bar (bottom centre), the speed lines and the stopped-time veil (full screen). */
  private flowEl: HTMLDivElement;
  private flowFill: HTMLElement;
  private flowLbl: HTMLElement;
  private linesEl: HTMLDivElement;
  private stopEl: HTMLDivElement;
  private flowKey = '';
  /** FLOW on a phone: one short line on the moves when it comes on (it fades by itself). */
  private tipEl: HTMLDivElement;
  private flowWasOn = false;
  private rulesTimer = 0;

  constructor(private host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'lab-panel';
    this.banner = document.createElement('div');
    this.banner.className = 'lab-banner';
    this.linesEl = document.createElement('div');
    this.linesEl.className = 'flow-lines';
    this.stopEl = document.createElement('div');
    this.stopEl.className = 'flow-stop';
    this.flowEl = document.createElement('div');
    this.flowEl.className = 'flow-meter';
    this.flowEl.innerHTML = '<div class="fm-head"><small></small><b></b></div><div class="fm-bar"><i></i></div>';
    this.flowFill = this.flowEl.querySelector('.fm-bar i') as HTMLElement;
    this.flowLbl = this.flowEl.querySelector('.fm-head b') as HTMLElement;
    host.appendChild(this.linesEl);
    host.appendChild(this.stopEl);
    host.appendChild(this.el);
    host.appendChild(this.banner);
    host.appendChild(this.flowEl);
    this.tipEl = document.createElement('div');
    this.tipEl.className = 'flow-tip';
    host.appendChild(this.tipEl);
    this.el.addEventListener('pointerdown', (e) => {
      // (phones: the rules card is folded away; RULES opens it a while)
      if ((e.target as Element).closest('[data-more]')) {
        e.stopPropagation();
        e.preventDefault();
        const open = !this.el.classList.contains('rules-open');
        this.el.classList.toggle('rules-open', open);
        clearTimeout(this.rulesTimer);
        if (open) this.rulesTimer = window.setTimeout(() => this.el.classList.remove('rules-open'), 9000);
        return;
      }
      const b = (e.target as Element).closest('[data-v]') as HTMLElement | null;
      if (!b) return;
      e.stopPropagation();
      e.preventDefault();
      this.onPick(b.dataset.v as CombatVariant);
    });
    this.build();
    this.unsub = onLangChange(() => {
      this.build();
      this.flowKey = '';
      if (this.last) this.update(this.last);
    });
  }

  /** FLOW's meter and overlays (null: not FLOW, all hidden). DOM writes only on a change. */
  setFlow(s: FlowHudState | null) {
    const on = !!s && this.shown;
    const pct = s ? Math.round(Math.min(1, Math.max(0, s.meter)) * 100) : 0;
    const ready = !!s && s.meter >= 1;
    const lines = s ? Math.round(s.speed * 20) / 20 : 0;
    const key = on && s ? `${pct}|${s.phase}|${s.marks}|${ready}|${lines}|${getDevice()}` : 'off';
    if (key === this.flowKey) return;
    this.flowKey = key;
    this.flowEl.classList.toggle('on', on);
    if (on !== this.flowWasOn) {
      this.flowWasOn = on;
      this.tipEl.className = 'flow-tip';
      if (on && getDevice() === 'touch') {
        this.tipEl.textContent = t('flow.tip');
        void this.tipEl.offsetWidth;
        this.tipEl.className = 'flow-tip go';
      }
    }
    this.linesEl.style.opacity = on ? String(lines) : '0';
    this.stopEl.classList.toggle('on', on && !!s && s.phase !== 'idle');
    if (!on || !s) return;
    (this.flowEl.querySelector('.fm-head small') as HTMLElement).textContent = t('flow.meter');
    this.flowFill.style.width = `${pct}%`;
    this.flowEl.classList.toggle('ready', ready && s.phase === 'idle');
    this.flowEl.classList.toggle('held', s.phase !== 'idle');
    this.flowLbl.textContent =
      s.phase === 'held'
        ? t(getDevice() === 'touch' ? 'flow.heldTouch' : 'flow.held', { n: s.marks, max: FLOW.power.maxMarks })
        : s.phase === 'chain'
          ? t('flow.chain')
          : ready
            ? t('flow.ready', { key: powerKey() })
            : `${pct}%`;
  }

  private build() {
    this.cache.clear();
    // (only what the lab offers: AIM PORTAL, for now; no F-keys)
    const chips = LAB_OFFERED.map((v) => `<button type="button" data-v="${v}"><span>${esc(t(`lab.v.${v}`))}</span></button>`).join('');
    const tools = labTools(this.toolsFor).map((k) => `<div class="lt-${k}"><small>${esc(t(TOOL_KEY[k]))}</small><b data-f="k.${k}">0</b></div>`).join('');
    this.el.innerHTML = `
      <div class="lp-head"><span class="lp-tag">${esc(t('lab.title'))}</span><div class="lp-vars">${chips}</div></div>
      <div class="lp-wave"><b data-f="wave"></b><span class="lp-left" data-f="left"></span><span class="lp-wt" data-f="waveT" dir="ltr"></span><button type="button" class="lp-more" data-more>${esc(t('lab.rules'))}</button></div>
      <div class="lp-splits" data-f="splits" dir="ltr"></div>
      <div class="lp-stats">
        <div><small>${esc(t('lab.total'))}</small><b data-f="total" dir="ltr"></b></div>
        <div><small>${esc(t('lab.damage'))}</small><b data-f="dmg"></b></div>
        <div><small>${esc(t('lab.deaths'))}</small><b data-f="deaths"></b></div>
        <div><small>${esc(t('lab.kills'))}</small><b data-f="kills"></b></div>
      </div>
      <div class="lp-tools">${tools}</div>
      <div class="lp-rules" data-f="rules"></div>`;
    this.rulesDev = '';
  }

  private rulesDev = '';
  /** The variant the tool grid was built for. */
  private toolsFor: CombatVariant = 'aimportal';
  private countEl: HTMLDivElement | null = null;
  private countKey = '';

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
    if (!on) this.setFlow(null);
    if (!on) this.banner.className = 'lab-banner';
  }

  update(s: LabHudState) {
    this.last = s;
    if (!this.shown) return;
    if (s.variant !== this.toolsFor) {
      this.toolsFor = s.variant;
      this.build();
    }
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
    for (const k of labTools(s.variant)) {
      n += s.stats.kills[k];
      this.set(`k.${k}`, String(s.stats.kills[k]));
    }
    this.set('kills', formatNumber(n));
    // PRECISION / ONSLAUGHT / FLOW: the rules card (CSS hides it under CURRENT); FLOW adds its own lines
    const dev = `${getDevice()}|${s.variant}`;
    if (dev !== this.rulesDev) {
      this.rulesDev = dev;
      this.set('rules', s.variant === 'aimportal' ? aimRules() : s.variant === 'reach' ? reachRules() : s.variant === 'flow' ? flowRules() + precisionRules() : precisionRules(), true);
    }
  }

  /** WAVE n: the banner, with a countdown to the first man through. */
  announce(n: number, waves: number, sub: string, variant: CombatVariant) {
    // (REACH: the rules card shows itself through W1's start, then folds behind RULES)
    if (n === 1 && (variant === 'reach' || variant === 'aimportal') && getDevice() !== 'touch') {
      this.el.classList.add('rules-open');
      clearTimeout(this.rulesTimer);
      this.rulesTimer = window.setTimeout(() => this.el.classList.remove('rules-open'), 11000);
    }
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

  /**
   * REACH's countdown: a big 3 · 2 · 1, then GO (null: off). Only the number
   * changes the DOM.
   */
  count(secs: number | null) {
    if (!this.countEl) {
      this.countEl = document.createElement('div');
      this.countEl.className = 'lab-count';
      this.host.appendChild(this.countEl);
    }
    const el = this.countEl;
    const k = secs === null ? '' : secs > 3 ? '' : secs > 0 ? String(Math.ceil(secs)) : 'GO';
    if (k === this.countKey) return;
    this.countKey = k;
    if (!k) {
      el.className = 'lab-count';
      return;
    }
    el.textContent = k === 'GO' ? t('reach.go') : k;
    el.className = 'lab-count';
    void el.offsetWidth;
    el.className = `lab-count on${k === 'GO' ? ' go' : ''}`;
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
    this.flowEl.remove();
    this.tipEl.remove();
    this.countEl?.remove();
    clearTimeout(this.rulesTimer);
    this.linesEl.remove();
    this.stopEl.remove();
  }

  get parent() {
    return this.host;
  }
}
