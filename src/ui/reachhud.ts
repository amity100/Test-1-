import { getLang, onLangChange, t } from './i18n';

/** What the hand would do on a press (the chip by the crosshair). */
export type ReachVerb = 'snatch' | 'pull' | 'portal' | 'late';

export interface ReachHudState {
  device: 'kbm' | 'pad' | 'touch';
  /** What the HAND takes now (null: nothing in reach). */
  aim: { verb: ReachVerb; what: 'rifle' | 'knife' | null } | null;
  /** A knife in hand and a man it would get (up close, or through a window). */
  stab: 'melee' | 'window' | null;
  /** Their portal in your hand: where its exit is now. */
  held: 'floor' | 'void' | 'water' | null;
  weapon: { kind: 'rifle' | 'knife'; ammo: number } | null;
  /** A red window by your hand (MOVE). */
  warn: boolean;
  /** A red portal opening near you. */
  incoming: boolean;
  /** The fight is on (after GO). */
  go: boolean;
}

const SVG = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
/** Small, single-colour icons (currentColor). */
export const REACH_ICON = {
  snatch: SVG('<path d="M6 13V7.5a1.3 1.3 0 012.6 0V12M8.6 11V5.5a1.3 1.3 0 012.6 0V11M11.2 11V6.2a1.3 1.3 0 012.6 0V11.5M13.8 11.5V8a1.3 1.3 0 012.6 0v6c0 3.6-2.4 6-5.6 6-2.6 0-4-1.4-5.4-3.6L3.6 13a1.3 1.3 0 012.2-1.3L6 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  pull: SVG('<path d="M20 12H7M11 7.5L6.5 12l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="6.5" r="2.2" fill="currentColor"/><path d="M20 9.5v6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  portal: SVG('<ellipse cx="12" cy="12" rx="5.6" ry="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  late: SVG('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="2.2"/>'),
  rifle: SVG('<path d="M2 11.5h14.5l1.5-1.5h4v3h-3.5l-1 1H11l-1.5 4.5H6.5l1-4.5H2z" fill="currentColor"/>'),
  knife: SVG('<path d="M3 15.5l12.5-9.5c2-1.4 4.6-1.2 6 .3L9.5 17.2z" fill="currentColor"/><path d="M8.2 16.5l-3.6 3.3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  hand: SVG('<path d="M6.5 12.5V8a1.2 1.2 0 012.4 0v3.5M8.9 11V6a1.2 1.2 0 012.4 0v5M11.3 11V6.6a1.2 1.2 0 012.4 0v5M13.7 11.6V8.6a1.2 1.2 0 012.4 0v5.6c0 3.4-2.3 5.8-5.3 5.8-2.5 0-3.8-1.3-5.1-3.4L4.4 13.4a1.2 1.2 0 012-1.3l.1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  travel: SVG('<ellipse cx="8" cy="12" rx="3.6" ry="7.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12.5 12h8M17.5 8.5L21 12l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  void: SVG('<path d="M12 3a7 7 0 00-4 12.7V19h8v-3.3A7 7 0 0012 3z" fill="currentColor"/><circle cx="9.3" cy="10.5" r="1.7" fill="#000"/><circle cx="14.7" cy="10.5" r="1.7" fill="#000"/><path d="M10 19v2M14 19v2" stroke="currentColor" stroke-width="1.8"/>'),
};

const HAND_KEY = { kbm: 'RMB', pad: 'LT', touch: '' };
const WEAPON_KEY = { kbm: 'LMB', pad: 'RT', touch: '' };

/**
 * REACH's HUD: one small chip by the crosshair saying what the HAND does on
 * a press (SNATCH a rifle, PULL him, TAKE their portal; TAKEN when someone's
 * hand beat you to it), a second for a knife's stab, where a held portal's exit
 * is (THE VOID, THE WATER), the weapon in hand (bottom right), a short red
 * MOVE when their hand comes for yours, and one-word callouts that fade on
 * their own. Nothing big, nothing that stays.
 */
export class ReachHud {
  readonly el: HTMLDivElement;
  private chip: HTMLDivElement;
  private stabEl: HTMLDivElement;
  private weapEl: HTMLDivElement;
  private warnEl: HTMLDivElement;
  private callEl: HTMLDivElement;
  private cache = new Map<string, string>();
  private callT = 0;
  private unsub: () => void;
  private last: ReachHudState | null = null;

  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'reach-hud';
    el.innerHTML = `
      <div class="rh-chip"><i></i><b></b><kbd></kbd></div>
      <div class="rh-stab"><i>${REACH_ICON.knife}</i><b></b><kbd></kbd></div>
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
    // (Hebrew reads right to left, its key names inside it too)
    el.dir = getLang() === 'he' ? 'rtl' : 'ltr';
    el.textContent = text;
    el.className = 'rh-tip';
    void el.offsetWidth;
    el.className = 'rh-tip go';
  }

  /** A one-word callout under the crosshair (it fades by itself). */
  callout(key: string, kind: 'good' | 'warn' | 'info') {
    const now = performance.now();
    // (the same one again within a beat: left as it is)
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
    // the hand's chip (a held portal: where its exit is instead)
    const chipKey = s.held ? `held|${s.held}` : s.aim ? `${s.aim.verb}|${s.aim.what}|${s.device}` : 'off';
    this.put('chip', chipKey, () => {
      const on = !!s.held || !!s.aim;
      this.chip.className = `rh-chip${on ? ' on' : ''} ${s.held ? `exit-${s.held}` : s.aim ? `v-${s.aim.verb}` : ''}`;
      if (!on) return;
      const icon = s.held ? (s.held === 'floor' ? REACH_ICON.portal : REACH_ICON.void) : REACH_ICON[s.aim!.verb];
      (this.chip.querySelector('i') as HTMLElement).innerHTML = icon;
      const word = s.held ? t(`reach.exit.${s.held}`) : s.aim!.verb === 'snatch' && s.aim!.what ? t(`reach.verb.snatch.${s.aim!.what}`) : t(`reach.verb.${s.aim!.verb}`);
      (this.chip.querySelector('b') as HTMLElement).textContent = word;
      (this.chip.querySelector('kbd') as HTMLElement).textContent = s.held ? '' : HAND_KEY[s.device];
    });
    this.put('stab', `${s.stab}|${s.device}`, () => {
      this.stabEl.className = `rh-stab${s.stab ? ` on ${s.stab}` : ''}`;
      (this.stabEl.querySelector('b') as HTMLElement).textContent = s.stab ? t(s.stab === 'window' ? 'reach.verb.stabFar' : 'reach.verb.stab') : '';
      (this.stabEl.querySelector('kbd') as HTMLElement).textContent = WEAPON_KEY[s.device];
    });
    const wk = s.weapon ? `${s.weapon.kind}|${s.weapon.kind === 'rifle' ? s.weapon.ammo : ''}` : s.go ? 'none' : 'wait';
    this.put('weap', wk, () => {
      const w = s.weapon;
      this.weapEl.className = `rh-weap on ${w ? w.kind : 'none'}${w && w.kind === 'rifle' && w.ammo <= 3 ? ' low' : ''}`;
      (this.weapEl.querySelector('i') as HTMLElement).innerHTML = w ? REACH_ICON[w.kind] : REACH_ICON.hand;
      (this.weapEl.querySelector('b') as HTMLElement).textContent = w ? t(`reach.w.${w.kind}`) : t('reach.w.none');
      const n = this.weapEl.querySelector('span') as HTMLElement;
      n.textContent = w && w.kind === 'rifle' ? String(w.ammo) : '';
    });
    this.put('warn', `${s.warn}|${s.incoming}`, () => {
      this.warnEl.className = `rh-warn${s.warn ? ' on steal' : s.incoming ? ' on portal' : ''}`;
      this.warnEl.textContent = s.warn ? t('reach.warn') : s.incoming ? t('reach.incoming') : '';
    });
  }

  dispose() {
    this.unsub();
    this.el.remove();
  }
}
