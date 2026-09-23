import type {
  AimInfo,
  ExitOrientation,
  GateHint,
  HudAPI,
  ScreenMarker,
  StyleRank,
  StyleState,
  TrickAward,
} from '../core/contracts';
import { formatNumber, getDevice, onLangChange, t, type Device } from './i18n';

/**
 * The action HUD. DOM only; every setter compares against the last value and
 * writes to the DOM only when something visible changed, so the game can call
 * them every frame. Animations are CSS (transform / opacity).
 *
 * Layout (the HUD pins `direction: ltr`; localized text blocks use dir=auto):
 * - top-left: objective; bottom-left: health + rift pips (top-left on touch)
 * - right: STYLE panel + trick feed; centre: crosshair, aim info, gate hint
 * - top-centre: hint box, toasts, zone title card, combo bank
 *
 * Markers: `x`/`y` are CSS pixels in the viewport. Off-screen markers are
 * placed along `angle` (radians, screen space: 0 = right, +PI/2 = down,
 * measured from the screen centre) and their x/y are ignored: threats on an
 * inset ellipse around the crosshair, others at the screen edge; on touch
 * (body.is-touch) all of them on a ring around the crosshair.
 */

const RANKS: StyleRank[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const FEED_MAX = 4;
const FEED_LIFE = 2.8;
const TOAST_LIFE = 2.6;
const TOAST_MAX = 3;
const AIRTIME_GOAL = 3;

const ICONS: Record<AimInfo['outcome'], string> = {
  splash:
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.4C9 6.6 6.4 9.8 6.4 13.2a5.6 5.6 0 0011.2 0c0-3.4-2.6-6.6-5.6-10.8z"/><path d="M2.5 21.2c1.6 0 1.6-1.1 3.2-1.1s1.6 1.1 3.2 1.1 1.6-1.1 3.1-1.1 1.6 1.1 3.2 1.1 1.6-1.1 3.2-1.1 1.6 1.1 3.1 1.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  void: '<svg viewBox="0 0 24 24"><path d="M1.5 6.5h7.2M15.3 6.5h7.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 3.5v15.5M6.8 13.8L12 19l5.2-5.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  skull:
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.2c-4.6 0-8.2 3.4-8.2 7.9 0 2.6 1.2 4.6 3 5.8v2.7c0 .8.6 1.4 1.4 1.4h7.6c.8 0 1.4-.6 1.4-1.4v-2.7c1.8-1.2 3-3.2 3-5.8 0-4.5-3.6-7.9-8.2-7.9z"/><circle cx="8.7" cy="10.9" r="2.2" fill="#0b0e14"/><circle cx="15.3" cy="10.9" r="2.2" fill="#0b0e14"/><path d="M10.2 20v-2.4M13.8 20v-2.4" stroke="#0b0e14" stroke-width="1.3"/></svg>',
  stars:
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 4.2l1.8 4.3 4.6.4-3.5 3 1.1 4.5-4-2.4-4 2.4 1.1-4.5-3.5-3 4.6-.4z"/><path fill="currentColor" d="M19 12.5l.8 1.9 2 .2-1.5 1.3.5 2-1.8-1.1-1.8 1.1.5-2-1.5-1.3 2-.2zM18.5 2.5l.6 1.4 1.5.1-1.1 1 .3 1.5-1.3-.8-1.3.8.3-1.5-1.1-1 1.5-.1z"/></svg>',
  safe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7.4 12.4l3.1 3.1 6.1-6.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const CLAPPER =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 10h18v9.5c0 .8-.7 1.5-1.5 1.5h-15c-.8 0-1.5-.7-1.5-1.5z"/><path fill="currentColor" d="M2.6 8.6l-.5-2.3c-.2-.8.3-1.6 1.1-1.8l14.6-3.1c.8-.2 1.6.3 1.8 1.1l.5 2.3z"/><path d="M6.3 3.8l2.4 3.4M10.8 2.9l2.4 3.4M15.3 1.9l2.4 3.4" stroke="#0b0e14" stroke-width="1.6"/></svg>';

type MarkEl = { el: HTMLDivElement; lbl: HTMLSpanElement; key: string };
type FeedItem = { el: HTMLDivElement; age: number; out: boolean };
type ToastItem = { el: HTMLDivElement; age: number; out: boolean };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Restart a CSS animation class. */
function replay(el: Element, cls: string) {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

export class HUD implements HudAPI {
  readonly el: HTMLElement;
  /** Clip button clicked (desktop; on touch TouchControls has its own 🎬 button). */
  onClip: () => void = () => {};

  // layers / widgets
  private dmgEl: HTMLDivElement;
  private marksEl: HTMLDivElement;
  private objEl: HTMLDivElement;
  private objText: HTMLElement;
  private objSub: HTMLElement;
  private zoneEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private toastsEl: HTMLDivElement;
  private crossEl: HTMLDivElement;
  private aimEl: HTMLDivElement;
  private aimIco: HTMLElement;
  private aimOc: HTMLElement;
  private aimDist: HTMLElement;
  private aimDrop: HTMLElement;
  private aimDropV: HTMLElement;
  private aimChip: HTMLElement;
  private aimWhy: HTMLElement;
  private gateEl: HTMLDivElement;
  private airEl: HTMLDivElement;
  private airVal: HTMLElement;
  private airBar: HTMLElement;
  private styleEl: HTMLDivElement;
  private rankEl: HTMLElement;
  private ringEl: SVGCircleElement;
  private meterEl: HTMLElement;
  private chainEl: HTMLElement;
  private chainPts: HTMLElement;
  private chainMul: HTMLElement;
  private totalEl: HTMLElement;
  private feedEl: HTMLDivElement;
  private bankEl: HTMLDivElement;
  private hpEl: HTMLDivElement;
  private hpFill: HTMLElement;
  private hpTrail: HTMLElement;
  private hpNum: HTMLElement;
  private embers: HTMLElement[] = [];
  private pipExit: HTMLElement;
  private pipEntr: HTMLElement;
  private promptEl: HTMLDivElement;
  private promptGlyph: HTMLElement;
  private promptLbl: HTMLElement;
  private clipEl: HTMLButtonElement;

  // cached state
  private shown = true;
  private hp = -1;
  private hpMax = 100;
  private lastEmberT = 0;
  private emberIdx = 0;
  private clock = 0;
  private rank: StyleRank | '' = '';
  private meterQ = -1;
  private ringQ = -1;
  private chainMax = 4;
  private lastChainT = 0;
  private chainPtsV = -1;
  private varietyV = -1;
  private totalV = -1;
  private idleStyle: boolean | null = null;
  private aimKey = '';
  private aimOn = false;
  private gateKey = '';
  private crossState = '';
  private riftKey = '';
  private promptLabel: string | null = null;
  private device: Device = getDevice();
  private feed: FeedItem[] = [];
  private toasts: ToastItem[] = [];
  private hintKey = '';
  private hintHtml = '';
  private hintT = 0;
  private dmg = 0;
  private dmgQ = -1;
  private airQ = -2;
  private marks: MarkEl[] = [];
  private markCount = 0;
  private vw = 1280;
  private vh = 720;
  private touch = false;
  private objKey = '';

  constructor(root: HTMLElement) {
    const el = h('div', 'hud');
    this.el = el;
    el.dataset.device = this.device;
    el.innerHTML = `
      <div class="h-fx h-charged"></div>
      <div class="h-fx h-vision"><i></i></div>
      <div class="h-fx h-dmg"></div>
      <div class="h-marks"></div>
      <div class="h-obj"><i class="dia"></i><div class="o-body"><small class="o-lbl"></small><b class="o-txt" dir="auto"></b><span class="o-sub" dir="auto"></span></div></div>
      <div class="h-zone"><i class="z-ln"></i><h2 dir="auto"></h2><p dir="auto"></p><i class="z-ln"></i></div>
      <div class="h-hint" dir="auto"></div>
      <div class="h-toasts"></div>
      <div class="h-bank"><small class="b-lbl"></small><div class="b-row"><b class="b-pts"></b><span class="b-rank"></span></div></div>
      <div class="h-center">
        <div class="h-air"><small class="air-lbl"></small><b class="air-val"><span></span><small>s</small></b><i class="air-bar"><u></u></i></div>
        <div class="h-cross idle">
          <span class="c-ring"></span>
          <span class="c-brk"><u></u><u></u><u></u><u></u></span>
          <i class="tk n"></i><i class="tk s"></i><i class="tk e"></i><i class="tk w"></i>
          <b class="dot"></b>
        </div>
        <div class="h-aim">
          <div class="a-top"><span class="a-ico"></span><span class="a-oc" dir="auto"></span></div>
          <div class="a-mid"><b class="a-dist"><span></span><small>m</small></b><span class="a-drop"><i>↓</i><span></span><small>m</small></span><span class="a-chip"></span></div>
          <div class="a-why" dir="auto"></div>
        </div>
        <div class="h-gate" dir="auto"></div>
      </div>
      <div class="h-style idle">
        <div class="s-info">
          <div class="s-lbl"></div>
          <div class="s-meter"><i></i></div>
          <div class="s-chain"><b class="s-pts"></b><em class="s-mul"></em></div>
          <div class="s-total"><span class="s-tl"></span><b></b></div>
        </div>
        <div class="s-rank">
          <svg class="s-ring" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="45"/><circle class="fg" cx="50" cy="50" r="45" pathLength="100"/></svg>
          <b class="s-letter">D</b>
        </div>
      </div>
      <div class="h-feed"></div>
      <div class="h-status">
        <div class="h-pips"><span class="pip ex"><i></i><em></em></span><span class="pip en"><i></i><em></em></span></div>
        <div class="h-hp"><b class="hp-num">100</b><div class="hp-bar"><i class="hp-trail"></i><i class="hp-fill"></i><i class="hp-segs"></i><span class="hp-embers"></span></div></div>
      </div>
      <div class="h-prompt"><span class="p-glyph"></span><span class="p-lbl" dir="auto"></span></div>
      <button class="h-clip" type="button">${CLAPPER}<span class="c-lbl"></span><kbd>R</kbd><i class="c-timer"></i></button>`;
    root.appendChild(el);
    const q = <T extends Element = HTMLElement>(s: string) => el.querySelector(s) as unknown as T;
    this.dmgEl = q('.h-dmg');
    this.marksEl = q('.h-marks');
    this.objEl = q('.h-obj');
    this.objText = q('.o-txt');
    this.objSub = q('.o-sub');
    this.zoneEl = q('.h-zone');
    this.hintEl = q('.h-hint');
    this.toastsEl = q('.h-toasts');
    this.crossEl = q('.h-cross');
    this.aimEl = q('.h-aim');
    this.aimIco = q('.a-ico');
    this.aimOc = q('.a-oc');
    this.aimDist = q('.a-dist span');
    this.aimDrop = q('.a-drop');
    this.aimDropV = q('.a-drop span');
    this.aimChip = q('.a-chip');
    this.aimWhy = q('.a-why');
    this.gateEl = q('.h-gate');
    this.airEl = q('.h-air');
    this.airVal = q('.air-val span');
    this.airBar = q('.air-bar u');
    this.styleEl = q('.h-style');
    this.rankEl = q('.s-letter');
    this.ringEl = q<SVGCircleElement>('.s-ring .fg');
    this.meterEl = q('.s-meter i');
    this.chainEl = q('.s-chain');
    this.chainPts = q('.s-pts');
    this.chainMul = q('.s-mul');
    this.totalEl = q('.s-total b');
    this.feedEl = q('.h-feed');
    this.bankEl = q('.h-bank');
    this.hpEl = q('.h-hp');
    this.hpFill = q('.hp-fill');
    this.hpTrail = q('.hp-trail');
    this.hpNum = q('.hp-num');
    this.pipExit = q('.pip.ex');
    this.pipEntr = q('.pip.en');
    this.promptEl = q('.h-prompt');
    this.promptGlyph = q('.p-glyph');
    this.promptLbl = q('.p-lbl');
    this.clipEl = q('.h-clip');

    const emb = q('.hp-embers');
    for (let i = 0; i < 8; i++) this.embers.push(emb.appendChild(h('i', 'ember')));

    this.clipEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onClip();
    });
    this.clipEl.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

    this.labels();
    onLangChange(() => this.labels());
    this.measure();
    window.addEventListener('resize', () => this.measure());
    this.setStyle({ rank: 'D', meter: 0, chainPoints: 0, variety: 0, chain: [], chainT: 0, total: 0, bestCombo: 0, lastCombo: 0 });
    this.setHealth(100, 100);
    this.setRiftState({ exit: false, entrance: false, aiming: false, orientation: 'auto' });
  }

  /** Static labels (called again on language change). */
  private labels() {
    const set = (s: string, v: string) => ((this.el.querySelector(s) as HTMLElement).textContent = v);
    set('.o-lbl', t('hud.objective'));
    set('.s-lbl', t('hud.style'));
    set('.s-tl', t('hud.total'));
    set('.pip.ex em', t('hud.exit'));
    set('.pip.en em', t('hud.entrance'));
    set('.air-lbl', t('hud.airtime'));
    set('.b-lbl', t('hud.combo'));
    set('.c-lbl', t('clip.offer'));
    this.aimKey = '';
    this.gateKey = '';
  }

  private measure() {
    this.vw = window.innerWidth || 1280;
    this.vh = window.innerHeight || 720;
    this.touch = document.body.classList.contains('is-touch');
  }

  show(v: boolean) {
    if (v === this.shown) return;
    this.shown = v;
    this.el.style.display = v ? '' : 'none';
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  setHealth(hp: number, max: number) {
    const v = Math.max(0, Math.round(hp));
    if (v === this.hp && max === this.hpMax) return;
    const prev = this.hp;
    this.hp = v;
    this.hpMax = max;
    const f = Math.max(0, Math.min(1, v / Math.max(1, max)));
    this.hpFill.style.transform = `scaleX(${f.toFixed(3)})`;
    this.hpNum.textContent = String(v);
    this.hpEl.classList.toggle('low', f < 0.3);
    if (prev >= 0 && v < prev) {
      // the trail lags behind (delayed CSS transition), the bar flashes
      this.hpTrail.classList.remove('snap');
      this.hpTrail.style.transform = `scaleX(${f.toFixed(3)})`;
      replay(this.hpEl, 'hit');
    } else {
      this.hpTrail.classList.add('snap');
      this.hpTrail.style.transform = `scaleX(${f.toFixed(3)})`;
      if (prev >= 0 && v > prev) this.ember(f, v - prev >= 5);
    }
  }

  /** Heal sparkle at the bar tip (throttled). */
  private ember(f: number, big: boolean) {
    if (!big && this.clock - this.lastEmberT < 0.22) return;
    this.lastEmberT = this.clock;
    const n = big ? 5 : 1;
    for (let i = 0; i < n; i++) {
      const e = this.embers[this.emberIdx++ % this.embers.length];
      e.style.left = `${(f * 100 - Math.random() * (big ? 14 : 3)).toFixed(1)}%`;
      e.style.setProperty('--dx', `${(Math.random() * 16 - 8).toFixed(0)}px`);
      e.style.animationDelay = `${(i * 0.05).toFixed(2)}s`;
      replay(e, 'go');
    }
    if (big) replay(this.hpEl, 'heal');
  }

  damageFlash(amount: number) {
    this.dmg = Math.min(1, this.dmg + Math.max(0.35, amount / 40));
  }

  setPlayerCharged(on: boolean) {
    this.el.classList.toggle('charged', on);
  }

  setVision(on: boolean) {
    this.el.classList.toggle('vision', on);
  }

  // -------------------------------------------------------------------------
  // Style
  // -------------------------------------------------------------------------

  setStyle(s: StyleState) {
    if (s.rank !== this.rank) {
      const up = this.rank === '' ? false : RANKS.indexOf(s.rank) > RANKS.indexOf(this.rank);
      const had = this.rank !== '';
      this.styleEl.classList.remove(`r-${this.rank}`);
      this.styleEl.classList.add(`r-${s.rank}`);
      this.rankEl.textContent = s.rank;
      this.rank = s.rank;
      if (had) {
        this.styleEl.classList.remove('rank-up', 'rank-down');
        void this.styleEl.offsetWidth;
        this.styleEl.classList.add(up ? 'rank-up' : 'rank-down');
      }
    }
    const mq = Math.round(Math.max(0, Math.min(1, s.meter)) * 200);
    if (mq !== this.meterQ) {
      this.meterQ = mq;
      this.meterEl.style.transform = `scaleX(${(mq / 200).toFixed(3)})`;
    }
    // chain timer ring: the window is whatever chainT was right after it last rose
    if (s.chainT > this.lastChainT + 0.05) this.chainMax = Math.max(0.5, s.chainT);
    this.lastChainT = s.chainT;
    const live = s.chainPoints > 0 && s.chainT > 0;
    const rq = live ? Math.round(Math.max(0, Math.min(1, s.chainT / this.chainMax)) * 100) : 0;
    if (rq !== this.ringQ) {
      this.ringQ = rq;
      this.ringEl.style.strokeDasharray = `${rq} 100`;
      // a zero-length dash with round caps still draws a dot
      this.ringEl.style.opacity = rq ? '' : '0';
    }
    if (s.chainPoints !== this.chainPtsV) {
      this.chainPtsV = s.chainPoints;
      this.chainPts.textContent = formatNumber(s.chainPoints);
    }
    if (s.variety !== this.varietyV) {
      this.varietyV = s.variety;
      this.chainMul.textContent = `×${Math.max(1, s.variety)}`;
      if (s.variety > 1) replay(this.chainMul, 'pop');
    }
    this.chainEl.classList.toggle('on', live);
    if (s.total !== this.totalV) {
      this.totalV = s.total;
      this.totalEl.textContent = formatNumber(s.total);
    }
    const idle = !live && s.rank === 'D' && s.meter < 0.02;
    if (idle !== this.idleStyle) {
      this.idleStyle = idle;
      this.styleEl.classList.toggle('idle', idle);
    }
  }

  popTrick(a: TrickAward) {
    let name = t(a.key);
    if (name === a.key) name = a.id.replace(/([A-Z])/g, ' $1').toUpperCase();
    const el = h('div', `trk${a.halved ? ' halved' : ''}`);
    const nm = h('span', 'nm');
    nm.dir = 'auto';
    nm.textContent = name;
    el.appendChild(nm);
    if (a.suffix) el.appendChild(h('em', 'sx')).textContent = a.suffix;
    el.appendChild(h('b', 'pt')).textContent = `+${formatNumber(a.points)}`;
    this.feedEl.insertBefore(el, this.feedEl.firstChild);
    this.feed.unshift({ el, age: 0, out: false });
    // over the cap: the oldest leaves now
    let live = 0;
    for (const f of this.feed) {
      if (f.out) continue;
      if (++live > FEED_MAX) this.retire(f);
    }
  }

  private retire(f: FeedItem | ToastItem) {
    if (f.out) return;
    f.out = true;
    f.age = Math.max(f.age, 100);
    f.el.classList.add('out');
  }

  comboBanked(points: number, rank: StyleRank) {
    (this.bankEl.querySelector('.b-pts') as HTMLElement).textContent = `+${formatNumber(points)}`;
    (this.bankEl.querySelector('.b-rank') as HTMLElement).textContent = rank;
    for (const r of RANKS) this.bankEl.classList.remove(`r-${r}`);
    this.bankEl.classList.add(`r-${rank}`);
    replay(this.bankEl, 'go');
  }

  // -------------------------------------------------------------------------
  // Aim / gate / crosshair
  // -------------------------------------------------------------------------

  setAim(info: AimInfo | null) {
    const on = !!info;
    if (on !== this.aimOn) {
      this.aimOn = on;
      this.aimEl.classList.toggle('on', on);
      this.el.classList.toggle('aiming', on);
    }
    if (!info) {
      this.aimKey = '';
      this.updateCross();
      return;
    }
    const dist = info.distance.toFixed(1);
    const drop = Number.isFinite(info.dropBelow) ? Math.round(info.dropBelow) : -1;
    const key = `${info.valid}|${info.reason}|${info.kind}|${dist}|${info.outcome}|${drop}|${info.orientation}`;
    if (key === this.aimKey) return;
    const prev = this.aimKey.split('|');
    this.aimKey = key;
    if (prev[4] !== info.outcome || prev[0] !== String(info.valid)) {
      this.aimIco.innerHTML = ICONS[info.outcome] ?? '';
      this.aimOc.textContent = t(`outcome.${info.outcome}`);
      this.aimEl.className = `h-aim on oc-${info.outcome}${info.valid ? '' : ' bad'}`;
    }
    if (prev[3] !== dist) this.aimDist.textContent = dist;
    if (prev[5] !== String(drop)) {
      this.aimDrop.className = `a-drop${drop < 0 ? ' inf' : drop >= 1 ? '' : ' none'}`;
      this.aimDropV.textContent = drop < 0 ? '∞' : String(drop);
    }
    this.aimChip.textContent = info.kind === 'air' ? t(`orient.${info.orientation}`) : t(`kind.${info.kind}`);
    this.aimChip.classList.toggle('air', info.kind === 'air');
    this.aimWhy.textContent = !info.valid && info.reason ? t(info.reason) : '';
    this.updateCross();
  }

  setGateHint(hint: GateHint | null) {
    const key = hint ? `${hint.mode}|${hint.reason}` : '';
    if (key === this.gateKey) return;
    this.gateKey = key;
    if (!hint || (!hint.mode && !hint.reason)) {
      this.gateEl.className = 'h-gate';
    } else if (hint.reason) {
      // refused (a mode with a reason is a refusal of that mode, e.g. STEADY)
      this.gateEl.textContent = t(hint.reason);
      this.gateEl.className = `h-gate on refuse${hint.mode ? ` m-${hint.mode}` : ''}`;
    } else {
      this.gateEl.textContent = t(`gate.${hint.mode}`);
      this.gateEl.className = `h-gate on mode m-${hint.mode}`;
    }
    this.updateCross();
  }

  private updateCross() {
    let s = 'idle';
    if (this.aimOn) s = this.aimKey.startsWith('true') ? 'valid' : 'invalid';
    else if (this.gateKey && this.gateEl.classList.contains('mode')) s = 'gate';
    if (s === this.crossState) return;
    this.crossState = s;
    this.crossEl.className = `h-cross ${s}`;
  }

  setRiftState(s: { exit: boolean; entrance: boolean; aiming: boolean; orientation: ExitOrientation }) {
    const key = `${s.exit}|${s.entrance}|${s.aiming}|${s.orientation}`;
    if (key === this.riftKey) return;
    const prev = this.riftKey.split('|');
    this.riftKey = key;
    this.pipExit.classList.toggle('on', s.exit);
    this.pipEntr.classList.toggle('on', s.entrance);
    this.pipExit.classList.toggle('aim', s.aiming);
    if (prev[0] === 'false' && s.exit) replay(this.pipExit, 'pop');
    if (prev[1] === 'false' && s.entrance) replay(this.pipEntr, 'pop');
  }

  setAirtime(seconds: number | null) {
    const q = seconds === null ? -1 : Math.floor(seconds * 10);
    if (q === this.airQ) return;
    const was = this.airQ;
    this.airQ = q;
    if (q < 0) {
      this.airEl.classList.remove('on', 'hot');
      return;
    }
    if (was < 0) this.airEl.classList.add('on');
    this.airVal.textContent = (q / 10).toFixed(1);
    this.airBar.style.transform = `scaleX(${Math.min(1, q / 10 / AIRTIME_GOAL).toFixed(3)})`;
    this.airEl.classList.toggle('hot', q >= AIRTIME_GOAL * 10);
  }

  // -------------------------------------------------------------------------
  // Prompt / clip
  // -------------------------------------------------------------------------

  setPrompt(label: string | null) {
    if (label === this.promptLabel) return;
    this.promptLabel = label;
    this.promptEl.classList.toggle('on', !!label);
    if (label) {
      this.promptLbl.textContent = label;
      this.renderGlyph();
      replay(this.promptEl, 'pop');
    }
  }

  private renderGlyph() {
    const d = this.device;
    this.promptGlyph.className = `p-glyph g-${d}`;
    this.promptGlyph.innerHTML = d === 'kbm' ? '<kbd>F</kbd>' : d === 'pad' ? '<i>X</i>' : '<i></i>';
  }

  offerClip(v: boolean) {
    const was = this.clipEl.classList.contains('on');
    if (v === was) return;
    this.clipEl.classList.toggle('on', v);
    if (v) replay(this.clipEl, 'go');
  }

  // -------------------------------------------------------------------------
  // Markers
  // -------------------------------------------------------------------------

  setMarkers(list: ScreenMarker[]) {
    const w = this.vw,
      hgt = this.vh,
      cx = w / 2,
      cy = hgt / 2;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      let me = this.marks[i];
      if (!me) {
        const el = h('div', 'mk');
        el.innerHTML = '<i class="mk-ico"></i><span class="mk-lbl"></span>';
        this.marksEl.appendChild(el);
        me = { el, lbl: el.querySelector('.mk-lbl') as HTMLSpanElement, key: '' };
        this.marks.push(me);
      }
      let x = m.x,
        y = m.y;
      if (!m.onScreen) {
        const c = Math.cos(m.angle),
          s = Math.sin(m.angle);
        if (this.touch) {
          // phones: a ring around the crosshair (the screen edges belong to the thumbs)
          x = cx + c * Math.min(170, cx * 0.42);
          y = cy + s * Math.min(110, cy * 0.55);
        } else if (m.kind === 'threat') {
          // threats sit on an inset ellipse around the crosshair (clear of the corner HUD blocks)
          x = cx + c * Math.max(60, cx - 104);
          y = cy + s * Math.max(60, cy - 66);
        } else {
          const margin = 40;
          const tx = Math.abs(c) > 1e-4 ? (cx - margin) / Math.abs(c) : Infinity;
          const ty = Math.abs(s) > 1e-4 ? (cy - margin) / Math.abs(s) : Infinity;
          const k = Math.min(tx, ty);
          x = cx + c * k;
          y = cy + s * k;
        }
      }
      const rx = Math.round(x),
        ry = Math.round(y),
        ra = Math.round(m.angle * 50) / 50;
      const cls = `mk k-${m.kind} ${m.onScreen ? 'in' : 'off'}`;
      const key = `${cls}|${rx}|${ry}|${m.onScreen ? 0 : ra}|${m.label ?? ''}`;
      if (key === me.key) continue;
      const prev = me.key;
      me.key = key;
      if (!prev.startsWith(cls + '|')) me.el.className = cls;
      if (me.el.style.display) me.el.style.display = '';
      me.el.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      me.el.style.setProperty('--a', `${ra}rad`);
      const lbl = m.label ?? '';
      if (me.lbl.textContent !== lbl) me.lbl.textContent = lbl;
    }
    for (let i = list.length; i < this.markCount; i++) {
      const me = this.marks[i];
      me.el.style.display = 'none';
      me.key = '';
    }
    this.markCount = list.length;
  }

  // -------------------------------------------------------------------------
  // Text: objective, zone title, toasts, hints
  // -------------------------------------------------------------------------

  setObjective(text: string, sub?: string) {
    const key = `${text}|${sub ?? ''}`;
    if (key === this.objKey) return;
    this.objKey = key;
    this.objText.textContent = text;
    this.objSub.textContent = sub ?? '';
    this.objEl.classList.toggle('on', !!text);
    this.objEl.classList.toggle('has-sub', !!sub);
    if (text) replay(this.objEl, 'new');
  }

  zoneTitle(name: string, sub: string) {
    (this.zoneEl.querySelector('h2') as HTMLElement).textContent = name;
    (this.zoneEl.querySelector('p') as HTMLElement).textContent = sub;
    replay(this.zoneEl, 'go');
  }

  toast(text: string, kind: 'info' | 'warn' | 'good' = 'info') {
    const el = h('div', `tst ${kind}`);
    el.dir = 'auto';
    el.textContent = text;
    this.toastsEl.appendChild(el);
    this.toasts.push({ el, age: 0, out: false });
    let live = 0;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const f = this.toasts[i];
      if (!f.out && ++live > TOAST_MAX) this.retire(f);
    }
  }

  hint(key: string, html: string, dur = 9) {
    if (key === this.hintKey && this.hintT > 0) {
      this.hintT = Math.max(this.hintT, dur);
      // same hint, new device wording: swap the text without replaying the entrance
      if (html !== this.hintHtml) this.hintEl.innerHTML = this.hintHtml = html;
      return;
    }
    this.hintKey = key;
    this.hintT = dur;
    this.hintEl.innerHTML = this.hintHtml = html;
    this.hintEl.classList.remove('on');
    void this.hintEl.offsetWidth;
    this.hintEl.classList.add('on');
  }

  clearHint() {
    this.hintT = 0;
    this.hintKey = '';
    this.hintEl.classList.remove('on');
  }

  /** Clear transient state (restart / respawn). */
  reset() {
    for (const f of this.feed) f.el.remove();
    for (const f of this.toasts) f.el.remove();
    this.feed = [];
    this.toasts = [];
    this.dmg = 0;
    this.clearHint();
    this.setMarkers([]);
    this.setAim(null);
    this.setGateHint(null);
    this.setAirtime(null);
    this.setPrompt(null);
    this.offerClip(false);
    this.setPlayerCharged(false);
    this.setVision(false);
    this.bankEl.classList.remove('go');
    this.zoneEl.classList.remove('go');
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  update(dt: number) {
    this.clock += dt;
    const d = getDevice();
    if (d !== this.device) {
      this.device = d;
      this.el.dataset.device = d;
      if (this.promptLabel) this.renderGlyph();
    }
    if (this.hintT > 0 && (this.hintT -= dt) <= 0) this.clearHint();
    if (this.dmg > 0 || this.dmgQ !== 0) {
      this.dmg = Math.max(0, this.dmg - dt * 1.8);
      const q = Math.round(this.dmg * 50);
      if (q !== this.dmgQ) {
        this.dmgQ = q;
        this.dmgEl.style.opacity = (q / 50).toFixed(2);
      }
    }
    this.age(this.feed, dt, FEED_LIFE);
    this.age(this.toasts, dt, TOAST_LIFE);
  }

  private age(list: (FeedItem | ToastItem)[], dt: number, life: number) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      f.age += dt;
      if (!f.out && f.age >= life) this.retire(f);
      else if (f.out && f.age >= 100.4) {
        f.el.remove();
        list.splice(i, 1);
      }
    }
  }
}
