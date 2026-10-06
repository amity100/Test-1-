import { getLang, onLangChange, t } from './i18n';
import { COMPASS, compassAngle, type Side } from '../game/aimportal';
import type { ThreatArrow } from './reachhud';
import { REACH_ICON } from './reachhud';

/** What a stab would do now (a chip by the crosshair). */
export type AimStab = 'melee' | 'kill' | 'blocked' | null;

export interface AimHudState {
  device: 'kbm' | 'pad' | 'touch';
  /** A word by the crosshair: a sealed panel under it, a surface too close, the side SNAP will pick. */
  ret: { kind: 'sealed' | 'close' | 'snap'; side?: Side; ok?: boolean } | null;
  /** The SNAP compass round the man under the crosshair (screen position in 0..1; null: none). */
  compass: { x: number; y: number; side: Side; ok: boolean } | null;
  /** The man the crosshair is on (PORTAL opens next to him): a bracket round him, his middle and height in screen 0..1 (null: none). */
  mark?: { x: number; y: number; h: number } | null;
  /** The pair's life left (1 → 0; null: none open). */
  pair: number | null;
  /** CHAIN: links standing, the most, and whether the next PORTAL adds one (null: no chain). */
  chain?: { links: number; max: number; placing: boolean } | null;
  ammo: number;
  /** Reloading: 0..1 progress (null: not). */
  reload: number | null;
  /** A man in your hands: his time left to throw (0..1; null: none). */
  hold: number | null;
  stab: AimStab;
  go: boolean;
  arrows: readonly ThreatArrow[];
}

const KEYS = {
  chain: { kbm: 'R', pad: 'Y', touch: '' },
  fire: { kbm: 'LMB', pad: 'RT', touch: '' },
  stab: { kbm: 'F', pad: 'X', touch: '' },
  pull: { kbm: 'E', pad: 'RB', touch: '' },
};
const ARROWS = 8;
const ARROW_ICON = { gun: 'gun', knife: 'knife', thief: 'hand', window: 'window', portal: 'portal' } as const;

/**
 * AIM PORTAL's HUD, all small and by the crosshair: a word when the aim is on
 * a sealed panel or SNAP has a side, the compass round the man SNAP is on, the
 * pair's life, the rifle's rounds (bottom right), a THROW prompt while a man is
 * in your hands, red edge arrows toward guns and knives you can't see,
 * one-word callouts and one short tip.
 */
export class AimHud {
  readonly el: HTMLDivElement;
  private ret: HTMLDivElement;
  private stabEl: HTMLDivElement;
  private holdEl: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private chainEl: HTMLDivElement;
  private callEl: HTMLDivElement;
  private ammoEl: HTMLDivElement;
  private compEl: HTMLDivElement;
  private markEl: HTMLDivElement;
  private pips: HTMLElement[] = [];
  private arrowEls: HTMLElement[] = [];
  private cache = new Map<string, string>();
  private callT = 0;
  private unsub: () => void;
  private last: AimHudState | null = null;

  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'aim-hud';
    const pips = [...new Set(COMPASS)].map((s) => `<i data-s="${s}"><b></b></i>`).join('');
    el.innerHTML = `
      <div class="rh-arrows">${'<i><b></b></i>'.repeat(ARROWS)}</div>
      <div class="ah-mark"><i></i><i></i><i></i><i></i></div>
      <div class="ah-comp">${pips}<u></u></div>
      <div class="ah-ret"><b></b></div>
      <div class="ah-stab"><i>${REACH_ICON.knife}</i><b></b><kbd></kbd></div>
      <div class="ah-hold"><b></b><kbd></kbd><u></u></div>
      <div class="ah-time"><u></u></div>
      <div class="ah-chain"><b></b><span><i></i><i></i><i></i><i></i></span><kbd></kbd></div>
      <div class="rh-call"></div>
      <div class="ah-ammo"><i>${REACH_ICON.rifle}</i><span></span><u></u></div>
      <div class="rh-tip"></div>`;
    root.appendChild(el);
    this.el = el;
    this.ret = el.querySelector('.ah-ret') as HTMLDivElement;
    this.stabEl = el.querySelector('.ah-stab') as HTMLDivElement;
    this.holdEl = el.querySelector('.ah-hold') as HTMLDivElement;
    this.timeEl = el.querySelector('.ah-time') as HTMLDivElement;
    this.chainEl = el.querySelector('.ah-chain') as HTMLDivElement;
    this.callEl = el.querySelector('.rh-call') as HTMLDivElement;
    this.ammoEl = el.querySelector('.ah-ammo') as HTMLDivElement;
    this.compEl = el.querySelector('.ah-comp') as HTMLDivElement;
    this.markEl = el.querySelector('.ah-mark') as HTMLDivElement;
    this.pips = Array.from(el.querySelectorAll('.ah-comp > i')) as HTMLElement[];
    this.arrowEls = Array.from(el.querySelectorAll('.rh-arrows > i')) as HTMLElement[];
    // (the pips sit on a ring: ABOVE on top, RIGHT, BELOW, LEFT, FRONT low right; BEHIND, the default, in the middle)
    for (const p of this.pips) {
      const a = compassAngle(p.dataset.s as Side);
      p.style.left = `${a === null ? 50 : 50 + Math.sin(a) * 50}%`;
      p.style.top = `${a === null ? 50 : 50 - Math.cos(a) * 50}%`;
    }
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

  /** One short line on the controls (gone in a few seconds by itself). */
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

  update(s: AimHudState) {
    this.last = s;
    const rk = s.ret ? `${s.ret.kind}|${s.ret.side ?? ''}|${s.ret.ok ?? ''}` : 'off';
    this.put('ret', rk, () => {
      const r = s.ret;
      this.ret.className = `ah-ret${r ? ` on ${r.kind}${r.ok === false ? ' bad' : ''}` : ''}`;
      (this.ret.querySelector('b') as HTMLElement).textContent = r ? (r.kind === 'snap' ? t(`aim.side.${r.side}`) : t(`aim.${r.kind}`)) : '';
    });
    // the compass: placed round the man (CSS %), the picked pip lit
    const c = s.compass;
    const ck = c ? `${Math.round(c.x * 400)}|${Math.round(c.y * 400)}|${c.side}|${c.ok}` : 'off';
    this.put('comp', ck, () => {
      this.compEl.classList.toggle('on', !!c);
      if (!c) return;
      this.compEl.style.left = `${(c.x * 100).toFixed(2)}%`;
      this.compEl.style.top = `${(c.y * 100).toFixed(2)}%`;
      this.compEl.classList.toggle('bad', !c.ok);
      for (const p of this.pips) {
        const on = p.dataset.s === c.side;
        p.classList.toggle('on', on);
        (p.querySelector('b') as HTMLElement).textContent = on ? t(`aim.side.${c.side}`) : '';
      }
    });
    // the bracket round the man the crosshair is on (at least a thumb's size: a far man is a few px tall)
    const m = s.mark ?? null;
    const mk = m ? `${Math.round(m.x * 500)}|${Math.round(m.y * 500)}|${Math.round(m.h * 500)}` : 'off';
    this.put('mark', mk, () => {
      this.markEl.classList.toggle('on', !!m);
      if (!m) return;
      const H = this.el.clientHeight || 720;
      const hp = Math.max(46, m.h * H * 1.15);
      this.markEl.style.left = `${(m.x * 100).toFixed(2)}%`;
      this.markEl.style.top = `${(m.y * 100).toFixed(2)}%`;
      this.markEl.style.height = `${hp.toFixed(0)}px`;
      this.markEl.style.width = `${Math.max(30, hp * 0.55).toFixed(0)}px`;
    });
    this.put('stab', `${s.stab}|${s.device}`, () => {
      this.stabEl.className = `ah-stab${s.stab ? ` on ${s.stab}` : ''}`;
      (this.stabEl.querySelector('b') as HTMLElement).textContent = s.stab ? t(`aim.stab.${s.stab}`) : '';
      (this.stabEl.querySelector('kbd') as HTMLElement).textContent = KEYS.stab[s.device];
    });
    this.put('hold', `${s.hold !== null}|${s.device}`, () => {
      this.holdEl.classList.toggle('on', s.hold !== null);
      (this.holdEl.querySelector('b') as HTMLElement).textContent = t('aim.throw');
      (this.holdEl.querySelector('kbd') as HTMLElement).textContent = s.device === 'kbm' ? 'E' : s.device === 'pad' ? 'RB' : '';
    });
    if (s.hold !== null) (this.holdEl.querySelector('u') as HTMLElement).style.transform = `scaleX(${Math.max(0, Math.min(1, s.hold))})`;
    const tk = s.pair === null ? 'off' : String(Math.round(s.pair * 40));
    this.put('time', tk, () => {
      this.timeEl.classList.toggle('on', s.pair !== null);
      (this.timeEl.querySelector('u') as HTMLElement).style.transform = `scaleX(${s.pair ?? 0})`;
    });
    // the chain: its links as pips (placed ones lit), PORTAL adds the next while it is being placed
    const cn = s.chain ?? null;
    this.put('chain', cn ? `${cn.links}|${cn.max}|${cn.placing}|${s.device}` : 'off', () => {
      this.chainEl.classList.toggle('on', !!cn);
      this.chainEl.classList.toggle('placing', !!cn?.placing);
      if (!cn) return;
      (this.chainEl.querySelector('b') as HTMLElement).textContent = `${t('aim.chain')} ${cn.links}/${cn.max}`;
      (this.chainEl.querySelector('kbd') as HTMLElement).textContent = KEYS.chain[s.device];
      Array.from(this.chainEl.querySelectorAll('span > i')).forEach((p, i) => p.classList.toggle('on', i < cn.links));
    });
    this.put('ammo', `${s.ammo}|${s.reload === null ? '' : Math.round(s.reload * 20)}`, () => {
      this.ammoEl.className = `ah-ammo on${s.ammo <= 5 ? ' low' : ''}${s.reload !== null ? ' reload' : ''}`;
      (this.ammoEl.querySelector('span') as HTMLElement).textContent = s.reload !== null ? t('aim.reload') : String(s.ammo);
      (this.ammoEl.querySelector('u') as HTMLElement).style.transform = `scaleX(${s.reload ?? 0})`;
    });
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

export { KEYS as AIM_HUD_KEYS };
