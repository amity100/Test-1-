import { getLang, onLangChange, t } from './i18n';
import type { ThreatKind } from '../game/reach';

/** What HAND does at the far window (the chip by the crosshair). */
export type ReachHandVerb = 'rifle' | 'knife' | 'disarm' | 'pull' | 'portal' | 'empty';
/** What a knife press does now: up close, through the window (a kill, a parry), nothing there. */
export type ReachStab = 'melee' | 'kill' | 'blocked' | 'miss' | null;
/** An arrow at the screen's edge toward a threat you can't see (angle: screen space, 0 = right, +π/2 = up). */
export interface ThreatArrow {
  ang: number;
  kind: ThreatKind;
  urgent: boolean;
}

export interface ReachHudState {
  device: 'kbm' | 'pad' | 'touch';
  /** The WINDOW key is held: the ghost can open there; someone would see it. */
  ghost: { ok: boolean; seen: boolean; behind: boolean } | null;
  /** A window is open: what HAND does there; blocked = he sees it coming. */
  hand: { verb: ReachHandVerb; blocked: boolean } | null;
  stab: ReachStab;
  /** Their portal in your hand: where its exit is now. */
  held: 'floor' | 'void' | 'water' | 'high' | 'fall' | 'wall' | null;
  weapon: { kind: 'rifle' | 'knife'; ammo: number } | null;
  /** The window's life left (1 → 0; null: none open). */
  window: number | null;
  /** A red window by your hand (MOVE). */
  warn: boolean;
  /** A red portal opening near you. */
  incoming: boolean;
  /** The fight is on (after GO). */
  go: boolean;
  arrows: readonly ThreatArrow[];
}

const SVG = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
/** Small, single-colour icons (currentColor). */
export const REACH_ICON = {
  hand: SVG('<path d="M6.5 12.5V8a1.2 1.2 0 012.4 0v3.5M8.9 11V6a1.2 1.2 0 012.4 0v5M11.3 11V6.6a1.2 1.2 0 012.4 0v5M13.7 11.6V8.6a1.2 1.2 0 012.4 0v5.6c0 3.4-2.3 5.8-5.3 5.8-2.5 0-3.8-1.3-5.1-3.4L4.4 13.4a1.2 1.2 0 012-1.3l.1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  pull: SVG('<path d="M20 12H7M11 7.5L6.5 12l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="6.5" r="2.2" fill="currentColor"/><path d="M20 9.5v6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  portal: SVG('<ellipse cx="12" cy="12" rx="5.6" ry="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  window: SVG('<rect x="6.5" y="3" width="11" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9.5 8.5l5 3.5-5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  eye: SVG('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
  none: SVG('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="2.2"/>'),
  rifle: SVG('<path d="M2 11.5h14.5l1.5-1.5h4v3h-3.5l-1 1H11l-1.5 4.5H6.5l1-4.5H2z" fill="currentColor"/>'),
  knife: SVG('<path d="M3 15.5l12.5-9.5c2-1.4 4.6-1.2 6 .3L9.5 17.2z" fill="currentColor"/><path d="M8.2 16.5l-3.6 3.3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  void: SVG('<path d="M12 3a7 7 0 00-4 12.7V19h8v-3.3A7 7 0 0012 3z" fill="currentColor"/><circle cx="9.3" cy="10.5" r="1.7" fill="#000"/><circle cx="14.7" cy="10.5" r="1.7" fill="#000"/><path d="M10 19v2M14 19v2" stroke="currentColor" stroke-width="1.8"/>'),
  gun: SVG('<circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2.2"/>'),
};

const HAND_KEY = { kbm: 'E', pad: 'RB', touch: '' };
const WEAPON_KEY = { kbm: 'LMB', pad: 'RT', touch: '' };
const ARROWS = 8;
const ARROW_ICON: Record<ThreatKind, keyof typeof REACH_ICON> = { gun: 'gun', knife: 'knife', thief: 'hand', window: 'window', portal: 'portal' };

/**
 * REACH's HUD: a chip by the crosshair saying what the WINDOW (while you aim
 * it) or the HAND (while one is open) does now, a second for the knife, the
 * window's time left, where a held portal's exit is, the weapon in hand
 * (bottom right), a red MOVE when their hand comes for yours, red arrows at
 * the screen's edge toward every threat you can't see, one-word callouts and
 * one short tip. Nothing big, nothing that stays.
 */
export class ReachHud {
  readonly el: HTMLDivElement;
  private chip: HTMLDivElement;
  private stabEl: HTMLDivElement;
  private weapEl: HTMLDivElement;
  private warnEl: HTMLDivElement;
  private callEl: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private arrowEls: HTMLElement[] = [];
  private cache = new Map<string, string>();
  private callT = 0;
  private unsub: () => void;
  private last: ReachHudState | null = null;

  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'reach-hud';
    el.innerHTML = `
      <div class="rh-arrows">${'<i><b></b></i>'.repeat(ARROWS)}</div>
      <div class="rh-chip"><i></i><b></b><kbd></kbd></div>
      <div class="rh-stab"><i>${REACH_ICON.knife}</i><b></b><kbd></kbd></div>
      <div class="rh-time"><u></u></div>
      <div class="rh-warn"></div>
      <div class="rh-call"></div>
      <div class="rh-weap"><i></i><b></b><span></span></div>
      <div class="rh-tip"></div>`;
    root.appendChild(el);
    this.el = el;
    this.chip = el.querySelector('.rh-chip') as HTMLDivElement;
    this.stabEl = el.querySelector('.rh-stab') as HTMLDivElement;
    this.weapEl = el.querySelector('.rh-weap') as HTMLDivElement;
    this.warnEl = el.querySelector('.rh-warn') as HTMLDivElement;
    this.callEl = el.querySelector('.rh-call') as HTMLDivElement;
    this.timeEl = el.querySelector('.rh-time') as HTMLDivElement;
    this.arrowEls = Array.from(el.querySelectorAll('.rh-arrows > i')) as HTMLElement[];
    this.unsub = onLangChange(() => {
      this.cache.clear();
      if (this.last) this.update(this.last);
    });
  }

  show(on: boolean) {
    this.el.classList.toggle('on', on);
    if (!on) {
      this.callEl.className = 'rh-call';
      this.cache.clear();
    }
  }

  private put(k: string, v: string, apply: () => void) {
    if (this.cache.get(k) === v) return;
    this.cache.set(k, v);
    apply();
  }

  /** One short line on the controls (low on the screen, gone in a few seconds by itself). */
  tip(text: string) {
    const el = this.el.querySelector('.rh-tip') as HTMLElement;
    el.dir = getLang() === 'he' ? 'rtl' : 'ltr';
    el.textContent = text;
    el.className = 'rh-tip';
    void el.offsetWidth;
    el.className = 'rh-tip go';
  }

  /** A one-word callout under the crosshair (it fades by itself). */
  callout(key: string, kind: 'good' | 'warn' | 'info') {
    const now = performance.now();
    if (this.callEl.dataset.k === key && now - this.callT < 600) return;
    this.callT = now;
    this.callEl.dataset.k = key;
    this.callEl.textContent = t(key);
    this.callEl.className = 'rh-call';
    void this.callEl.offsetWidth;
    this.callEl.className = `rh-call go ${kind}`;
  }

  update(s: ReachHudState) {
    this.last = s;
    // the chip: a held portal's exit, else the ghost, else the hand at the window
    let chipKey = 'off';
    if (s.held) chipKey = `held|${s.held}`;
    else if (s.ghost) chipKey = `ghost|${s.ghost.ok}|${s.ghost.seen}|${s.ghost.behind}`;
    else if (s.hand) chipKey = `hand|${s.hand.verb}|${s.hand.blocked}|${s.device}`;
    this.put('chip', chipKey, () => {
      const c = this.chip;
      if (chipKey === 'off') {
        c.className = 'rh-chip';
        return;
      }
      let icon: string, word: string, key = '', cls: string;
      if (s.held) {
        const bad = s.held !== 'floor';
        icon = bad ? REACH_ICON.void : REACH_ICON.portal;
        word = t(`reach.exit.${s.held}`);
        cls = bad ? 'deadly' : 'held';
      } else if (s.ghost) {
        const g = s.ghost;
        icon = g.seen ? REACH_ICON.eye : g.behind ? REACH_ICON.knife : REACH_ICON.window;
        word = t(!g.ok ? 'reach.ghost.near' : g.seen ? 'reach.ghost.seen' : g.behind ? 'reach.ghost.behind' : 'reach.ghost.ok');
        cls = !g.ok ? 'bad' : g.seen ? 'seen' : g.behind ? 'behind' : 'ghost';
      } else {
        const h = s.hand!;
        icon = h.blocked ? REACH_ICON.eye : h.verb === 'pull' ? REACH_ICON.pull : h.verb === 'portal' ? REACH_ICON.portal : h.verb === 'empty' ? REACH_ICON.none : h.verb === 'disarm' ? REACH_ICON.hand : REACH_ICON[h.verb];
        word = t(h.blocked ? 'reach.verb.blocked' : `reach.verb.${h.verb}`);
        key = HAND_KEY[s.device];
        cls = h.blocked ? 'bad' : h.verb === 'empty' ? 'dim' : `v-${h.verb}`;
      }
      c.className = `rh-chip on ${cls}`;
      (c.querySelector('i') as HTMLElement).innerHTML = icon;
      (c.querySelector('b') as HTMLElement).textContent = word;
      (c.querySelector('kbd') as HTMLElement).textContent = key;
    });
    this.put('stab', `${s.stab}|${s.device}`, () => {
      this.stabEl.className = `rh-stab${s.stab ? ` on ${s.stab}` : ''}`;
      (this.stabEl.querySelector('b') as HTMLElement).textContent = s.stab ? t(`reach.stab.${s.stab}`) : '';
      (this.stabEl.querySelector('kbd') as HTMLElement).textContent = WEAPON_KEY[s.device];
    });
    const tk = s.window === null ? 'off' : String(Math.round(s.window * 40));
    this.put('time', tk, () => {
      this.timeEl.classList.toggle('on', s.window !== null);
      (this.timeEl.querySelector('u') as HTMLElement).style.transform = `scaleX(${s.window ?? 0})`;
    });
    const wk = s.weapon ? `${s.weapon.kind}|${s.weapon.kind === 'rifle' ? s.weapon.ammo : ''}` : s.go ? 'none' : 'wait';
    this.put('weap', wk, () => {
      const w = s.weapon;
      this.weapEl.className = `rh-weap on ${w ? w.kind : 'none'}${w && w.kind === 'rifle' && w.ammo <= 3 ? ' low' : ''}`;
      (this.weapEl.querySelector('i') as HTMLElement).innerHTML = w ? REACH_ICON[w.kind] : REACH_ICON.hand;
      (this.weapEl.querySelector('b') as HTMLElement).textContent = w ? t(`reach.w.${w.kind}`) : t('reach.w.none');
      (this.weapEl.querySelector('span') as HTMLElement).textContent = w && w.kind === 'rifle' ? String(w.ammo) : '';
    });
    this.put('warn', `${s.warn}|${s.incoming}`, () => {
      this.warnEl.className = `rh-warn${s.warn ? ' on steal' : s.incoming ? ' on portal' : ''}`;
      this.warnEl.textContent = s.warn ? t('reach.warn') : s.incoming ? t('reach.incoming') : '';
    });
    // the arrows: on an ellipse just inside the screen's edge
    for (let i = 0; i < ARROWS; i++) {
      const a = s.arrows[i];
      const el = this.arrowEls[i];
      const k = a ? `${Math.round(a.ang * 30)}|${a.kind}|${a.urgent}` : '';
      if (el.dataset.k === k) continue;
      el.dataset.k = k;
      if (!a) {
        el.className = '';
        continue;
      }
      const x = 50 + Math.cos(a.ang) * 46;
      const y = 50 - Math.sin(a.ang) * 42;
      el.className = `on ${a.kind}${a.urgent ? ' urgent' : ''}`;
      el.style.left = `${x.toFixed(2)}%`;
      el.style.top = `${y.toFixed(2)}%`;
      el.style.setProperty('--r', `${(-a.ang).toFixed(3)}rad`);
      (el.querySelector('b') as HTMLElement).innerHTML = REACH_ICON[ARROW_ICON[a.kind]];
    }
  }

  dispose() {
    this.unsub();
    this.el.remove();
  }
}
