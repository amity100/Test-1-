import type { Action } from '../core/contracts';
import { Input, LOOK } from './input';
import { onLangChange, t } from '../ui/i18n';

/**
 * Phone / tablet controls (landscape). Every finger is tracked by its touch
 * identifier, so the stick, a look drag and a button all work at once.
 *
 * - Left side: floating stick (appears under the thumb; a full push sprints).
 * - Right side: drag to look.
 * - PORTAL: touch = the entrance ('portal' down); moving that finger aims the
 *   exit (look); lift = the exit ('portal' up). A quick tap lets the game
 *   place the exit. Slide onto the CANCEL zone to let go without an exit.
 *   Its caption says what a press does now (GRAB, LOAD, ...).
 * - JUMP / SHOVE / ✕ / ACTION / CROUCH: held while touched (the game reads
 *   wasPressed / isHeld). Dragging off a button also looks.
 * - ⇄ FLIP (only while aiming, left thumb), 🎬 (when offered), pause: taps.
 * - The lab's REACH: WINDOW (hold; dragging aims the window; lift opens it),
 *   HAND, WEAPON, JUMP and a small SLIDE.
 * - The lab's FLOW: SLIDE (over JUMP, in CROUCH's place; it's the crouch key:
 *   at a run it slides) and POWER (its ring fills with the meter, it pulses
 *   when full; hold it). While POWER is held, a tap anywhere off the buttons
 *   marks the man under it (the game picks him; see FLOW.power.tapRadius).
 * - The STRIKES are their own bar (ui/strikebar).
 */

type Finger =
  | { kind: 'stick'; ox: number; oy: number; sprint: boolean; t0: number; sx: number; sy: number; moved: number }
  | { kind: 'look'; x: number; y: number; t0: number; sx: number; sy: number; moved: number }
  | { kind: 'aimp'; el: HTMLElement; sx: number; sy: number; y: number; moved: number }
  | { kind: 'portal'; x: number; y: number; t0: number; cancel: boolean }
  | { kind: 'btn'; el: HTMLElement; action: Action | null; x: number; y: number; sx: number; sy: number; drag: boolean };

const STICK_R = 58;
const AIM_LOOK = 0.55;

const SVG = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  rift: SVG(
    '<ellipse cx="12" cy="12" rx="6.3" ry="9.6" fill="none" stroke="currentColor" stroke-width="2.4"/><ellipse cx="12" cy="12" rx="2.8" ry="5.4" fill="currentColor" opacity=".45"/>',
  ),
  jump: SVG('<path d="M5.5 12.5L12 6l6.5 6.5M5.5 19L12 12.5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  shove: SVG(
    '<path d="M9.5 12h11M16.2 7.6L20.6 12l-4.4 4.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 7.5h4.5M2 12h4.5M3.5 16.5h4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ),
  close: SVG('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>'),
  flip: SVG(
    '<path d="M4 8.5h15M15.5 5l3.5 3.5-3.5 3.5M20 15.5H5M8.5 12L5 15.5 8.5 19" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  crouch: SVG('<path d="M6 8.5l6 6 6-6M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  pause: SVG('<path d="M8.5 5.5v13M15.5 5.5v13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  clip: SVG(
    '<path fill="currentColor" d="M3 10h18v9.5c0 .8-.7 1.5-1.5 1.5h-15c-.8 0-1.5-.7-1.5-1.5z"/><path fill="currentColor" d="M2.6 8.6l-.5-2.3c-.2-.8.3-1.6 1.1-1.8l14.6-3.1c.8-.2 1.6.3 1.8 1.1l.5 2.3z"/>',
  ),
  action: SVG('<path d="M12 3.5l2.2 6.3 6.3 2.2-6.3 2.2L12 20.5l-2.2-6.3L3.5 12l6.3-2.2z" fill="currentColor"/>'),
  slide: SVG(
    '<path d="M7 4.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/><path d="M3 17.5h15M15 14l3.5 3.5L15 21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  power: SVG('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 6.5v5.5l3.6 2.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  hand: SVG('<path d="M6.5 12.5V8a1.2 1.2 0 012.4 0v3.5M8.9 11V6a1.2 1.2 0 012.4 0v5M11.3 11V6.6a1.2 1.2 0 012.4 0v5M13.7 11.6V8.6a1.2 1.2 0 012.4 0v5.6c0 3.4-2.3 5.8-5.3 5.8-2.5 0-3.8-1.3-5.1-3.4L4.4 13.4a1.2 1.2 0 012-1.3l.1.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
  weapon: SVG('<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  window: SVG('<rect x="6.5" y="3" width="11" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2.3"/><path d="M9.5 8.5l5 3.5-5 3.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'),
  go: SVG('<ellipse cx="15.5" cy="12" rx="4.2" ry="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M2.5 12h10.5M9.5 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
};

/** REACH's buttons and the actions they hold down (the game reads them as WEAPON, HAND, WINDOW). */
const REACH_BTN: Record<string, Action> = { 'r-weapon': 'portal', 'r-hand': 'strike3', 'r-window': 'strike1' };

/** AIM PORTAL's buttons and the actions they hold down (the game reads them as FIRE, STAB, PULL, GO). */
const AIM_BTN: Record<string, Action> = { 'a-fire': 'portal', 'a-stab': 'action', 'a-pull': 'strike3', 'a-go': 'go' };

/** What AIM PORTAL shows on its buttons. */
export interface TouchAimState {
  /** FIRE's caption: the rounds left (or RELOAD). */
  ammo: string;
  /** A pair is open (PORTAL lit; PULL live). */
  pair: boolean;
  /** A man is in your hands (PULL says THROW). */
  hold: boolean;
  /** His side is being picked (the drag from PORTAL). */
  snap: boolean;
  /** GO is live (a pair is open and you are not already on the way). */
  go?: boolean;
  /** The crosshair is on a man: PORTAL opens next to him. */
  target?: boolean;
}

/** A tap is quick and short: it opens the exit where the finger touched (a quick look nudge moves further than this). */
const TAP_MS = 220;
const TAP_PX = 8;
/** A drag from PORTAL: this far (px) and it is SNAP's side choice; this much vertical drag is one wheel step; this far is a full push. */
const SNAP_PX = 22;
const WHEEL_PX = 20;
const SNAP_FULL = 64;

/** What REACH shows on its buttons. */
export interface TouchReachState {
  /** What HAND does now (its caption; null: nothing in reach). `kind` styles it. */
  hand: string | null;
  handKind: string | null;
  /** WEAPON's caption (the rounds left, KNIFE) and whether a stab through the window is on. */
  weapon: string | null;
  far: boolean;
  /** A window is open (WINDOW lit; HAND live). */
  window: boolean;
}

/** Buttons whose finger may keep dragging to look. */
const DRAG_LOOK = new Set<string>(['jump', 'shove', 'close', 'action', 'crouch', 'power', 'portal', 'strike1', 'strike2', 'strike3']);

/** What the lab's FLOW shows on the touch buttons. */
export interface TouchFlowState {
  /** POWER meter 0..1 (the ring round the button). */
  fill: number;
  ready: boolean;
  /** POWER is held (time stopped): taps mark. */
  held: boolean;
  /** Fast enough that SLIDE slides. */
  slide: boolean;
}

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

export class TouchControls {
  readonly el: HTMLDivElement;
  /** The game says we are aiming (visual sync). */
  aiming = false;
  /** The game says the PORTAL is in hand (a press it took and hasn't finished). */
  private portalHolding = false;
  private fingers = new Map<number, Finger>();
  private stickEl: HTMLDivElement;
  private knobEl: HTMLDivElement;
  private cancelEl: HTMLDivElement;
  private actionBtn: HTMLButtonElement;
  private actionLbl: HTMLElement;
  private portalCap: HTMLElement;
  private portalBtn: HTMLButtonElement;
  private crouchBtn: HTMLButtonElement;
  private slideBtn: HTMLButtonElement;
  private powerBtn: HTMLButtonElement;
  /** FLOW's POWER is held: a touch off the buttons is a tap that marks (and a look, never the stick). */
  private powerHeld = false;
  private flowKey = '';
  private reachKey = '';
  private aimKey = '';
  /** AIM PORTAL is on: a quick tap on the world opens the exit there. */
  private aimOn = false;
  private clipBtn: HTMLButtonElement;
  private shown = true;
  private actionLabel: string | null = null;
  private portalLabel: string | null = null;
  private cancelRect: DOMRect | null = null;

  constructor(private input: Input, root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'touch';
    this.el = el;
    el.innerHTML = `
      <div class="t-zone t-left" data-t="left"></div>
      <div class="t-zone t-right" data-t="right"></div>
      <div class="t-stick"><i class="t-ring"></i><div class="t-knob"></div></div>
      <button class="t-btn t-pause" data-t="pause" type="button">${ICON.pause}</button>
      <button class="t-btn t-flip" data-t="flip" type="button">${ICON.flip}<span class="t-lbl" data-k="touch.flip"></span></button>
      <div class="t-cancel"><span>${ICON.close}</span><b data-k="touch.cancel"></b></div>
      <div class="t-cluster">
        <button class="t-btn t-action hidden" data-t="action" type="button">${ICON.action}<span class="t-lbl t-act-lbl"></span></button>
        <button class="t-btn t-rift" data-t="portal" type="button">${ICON.rift}<span class="t-lbl" data-k="touch.portal"></span><span class="t-cap"></span></button>
        <button class="t-btn t-jump" data-t="jump" type="button">${ICON.jump}<span class="t-lbl" data-k="touch.jump"></span></button>
        <button class="t-btn t-crouch" data-t="crouch" type="button">${ICON.crouch}</button>
        <button class="t-btn t-slide" data-t="crouch" type="button">${ICON.slide}<span class="t-lbl" data-k="touch.slide"></span></button>
        <button class="t-btn t-shove" data-t="shove" type="button">${ICON.shove}<span class="t-lbl" data-k="touch.shove"></span></button>
        <button class="t-btn t-close" data-t="close" type="button">${ICON.close}</button>
        <button class="t-btn t-power" data-t="power" type="button"><i class="t-fill"></i>${ICON.power}<span class="t-lbl" data-k="touch.power"></span></button>
        <button class="t-btn t-clip hidden" data-t="clip" type="button">${ICON.clip}</button>
        <button class="t-btn t-weapon" data-t="r-weapon" type="button">${ICON.weapon}<span class="t-lbl" data-k="touch.weapon"></span><span class="t-cap"></span></button>
        <button class="t-btn t-hand" data-t="r-hand" type="button">${ICON.hand}<span class="t-lbl" data-k="touch.hand"></span><span class="t-cap"></span></button>
        <button class="t-btn t-window" data-t="r-window" type="button">${ICON.window}<span class="t-lbl" data-k="touch.window"></span></button>
        <button class="t-btn t-aportal" data-t="a-portal" type="button">${ICON.window}<span class="t-lbl" data-k="touch.aimportal"></span></button>
        <button class="t-btn t-afire" data-t="a-fire" type="button">${ICON.weapon}<span class="t-lbl" data-k="touch.fire"></span><span class="t-cap"></span></button>
        <button class="t-btn t-astab" data-t="a-stab" type="button">${ICON.action}<span class="t-lbl" data-k="touch.stab"></span></button>
        <button class="t-btn t-apull" data-t="a-pull" type="button">${ICON.hand}<span class="t-lbl" data-k="touch.pull"></span></button>
        <button class="t-btn t-ago" data-t="a-go" type="button">${ICON.go}<span class="t-lbl" data-k="touch.go"></span></button>
      </div>`;
    root.appendChild(el);
    const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
    this.stickEl = q('.t-stick');
    this.knobEl = q('.t-knob');
    this.cancelEl = q('.t-cancel');
    this.actionBtn = q('.t-action');
    this.actionLbl = q('.t-act-lbl');
    this.portalCap = q('.t-cap');
    this.portalBtn = q('.t-rift');
    this.crouchBtn = q('.t-crouch');
    this.slideBtn = q('.t-slide');
    this.powerBtn = q('.t-power');
    this.clipBtn = q('.t-clip');
    this.labels();
    onLangChange(() => this.labels());

    el.addEventListener('touchstart', (e) => this.onStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.onEnd(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this.onEnd(e), { passive: false });
    // keep the page from treating touches on the controls as clicks / scrolls
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private labels() {
    this.el.querySelectorAll<HTMLElement>('[data-k]').forEach((n) => (n.textContent = t(n.dataset.k!)));
    this.portalBtn.classList.toggle('has-cap', !!this.portalLabel);
  }

  // -------------------------------------------------------------------------
  // Public
  // -------------------------------------------------------------------------

  /** PRECISION: the SHOVE button is a DODGE. */
  setDodge(on: boolean) {
    const n = this.el.querySelector('.t-shove .t-lbl') as HTMLElement | null;
    const k = on ? 'touch.dodge' : 'touch.shove';
    if (!n || n.dataset.k === k) return;
    n.dataset.k = k;
    n.textContent = t(k);
  }

  /**
   * The lab's FLOW (null: off): SLIDE takes CROUCH's place (lit when you're
   * fast enough), POWER shows its meter as a ring and pulses when full.
   * While POWER is held, taps off the buttons mark men.
   */
  setFlow(s: TouchFlowState | null) {
    const fill = s ? Math.round(Math.min(1, Math.max(0, s.fill)) * 50) / 50 : 0;
    const key = s ? `${fill}|${s.ready}|${s.held}|${s.slide}` : 'off';
    if (key === this.flowKey) return;
    this.flowKey = key;
    this.el.classList.toggle('flow', !!s);
    this.el.classList.toggle('power-held', !!s && s.held);
    this.powerBtn.style.setProperty('--fill', String(fill));
    this.powerBtn.classList.toggle('ready', !!s && s.ready && !s.held);
    this.powerBtn.classList.toggle('held', !!s && s.held);
    this.slideBtn.classList.toggle('armed', !!s && s.slide);
    if (!!s && s.held) {
      if (!this.powerHeld) vibrate(18);
    }
    this.powerHeld = !!s && s.held;
  }

  /** REACH (null: off): WINDOW, HAND and WEAPON take the PORTAL's and the strikes' places; SLIDE and JUMP stay. */
  setReach(s: TouchReachState | null) {
    const key = s ? `${s.hand}|${s.handKind}|${s.weapon}|${s.far}|${s.window}` : 'off';
    if (key === this.reachKey) return;
    this.reachKey = key;
    this.el.classList.toggle('reach', !!s);
    const hand = this.el.querySelector('.t-hand') as HTMLElement;
    const weap = this.el.querySelector('.t-weapon') as HTMLElement;
    const hc = hand.querySelector('.t-cap') as HTMLElement;
    const wc = weap.querySelector('.t-cap') as HTMLElement;
    hc.textContent = s?.hand ?? '';
    hand.classList.toggle('has-cap', !!s?.hand);
    hand.dataset.kind = s?.handKind ?? '';
    wc.textContent = s?.weapon ?? '';
    weap.classList.toggle('has-cap', !!s?.weapon);
    weap.classList.toggle('far', !!s?.far);
    hand.classList.toggle('live', !!s?.window);
    (this.el.querySelector('.t-window') as HTMLElement).classList.toggle('open', !!s?.window);
  }

  /** AIM PORTAL (null: off): PORTAL, FIRE, STAB and PULL take the places; SLIDE and JUMP stay. A quick tap on the world opens the exit there. */
  setAim(s: TouchAimState | null) {
    const key = s ? `${s.ammo}|${s.pair}|${s.hold}|${s.snap}|${s.go}|${s.target}` : 'off';
    if (key === this.aimKey) return;
    this.aimKey = key;
    this.aimOn = !!s;
    this.el.classList.toggle('aimp', !!s);
    const fire = this.el.querySelector('.t-afire') as HTMLElement;
    const fc = fire.querySelector('.t-cap') as HTMLElement;
    fc.textContent = s?.ammo ?? '';
    fire.classList.toggle('has-cap', !!s?.ammo);
    (this.el.querySelector('.t-aportal') as HTMLElement).classList.toggle('open', !!s?.pair);
    (this.el.querySelector('.t-aportal') as HTMLElement).classList.toggle('snap', !!s?.snap);
    (this.el.querySelector('.t-aportal') as HTMLElement).classList.toggle('target', !!s?.target && !s?.snap);
    (this.el.querySelector('.t-ago') as HTMLElement).classList.toggle('live', !!s?.go);
    const pull = this.el.querySelector('.t-apull') as HTMLElement;
    pull.classList.toggle('live', !!s?.pair || !!s?.hold);
    pull.classList.toggle('hold', !!s?.hold);
    const lbl = pull.querySelector('.t-lbl') as HTMLElement;
    const k = s?.hold ? 'touch.throw' : 'touch.pull';
    if (lbl.dataset.k !== k) {
      lbl.dataset.k = k;
      lbl.textContent = t(k);
    }
  }

  show(v: boolean) {
    if (v === this.shown) return;
    this.shown = v;
    this.el.style.display = v ? '' : 'none';
    if (!v) this.releaseAll();
  }

  /** Sync from the game. If the game isn't aiming while PORTAL is still held (refused, done), that finger just looks. */
  setAiming(on: boolean) {
    if (on !== this.aiming) {
      this.aiming = on;
      this.syncAimClass();
    }
    if (!on && !this.portalHolding) {
      const now = performance.now();
      for (const [id, f] of this.fingers) {
        if (f.kind === 'portal' && now - f.t0 > 400) {
          this.fingers.set(id, { kind: 'look', x: f.x, y: f.y, t0: 0, sx: f.x, sy: f.y, moved: 999 });
          this.input.up('portal');
          this.portalBtn.classList.remove('down');
          this.el.classList.remove('rift-held');
          this.cancelEl.classList.remove('hot');
          this.syncAimClass();
        }
      }
    }
  }

  /** Sync from the game: the PORTAL press is still in hand (the finger keeps it until it lifts). */
  setPortalHeld(on: boolean) {
    this.portalHolding = on;
  }

  /** ⇄ FLIP shows while an exit you'll walk out of is being aimed (a door, a fall, a hole). */
  setFlip(on: boolean) {
    this.el.classList.toggle('flip-on', on);
  }

  /** @deprecated old name */
  syncAim(aiming: boolean) {
    this.setAiming(aiming);
  }

  setAction(label: string | null) {
    if (label === this.actionLabel) return;
    this.actionLabel = label;
    this.actionBtn.classList.toggle('hidden', !label);
    if (label) {
      this.actionLbl.textContent = label;
      this.actionBtn.classList.toggle('long', label.length > 7);
      this.actionBtn.classList.remove('pop');
      void this.actionBtn.offsetWidth;
      this.actionBtn.classList.add('pop');
    } else {
      // a finger still on it releases the action
      for (const [id, f] of this.fingers) if (f.kind === 'btn' && f.el === this.actionBtn) this.endFinger(id, f);
    }
  }

  /** Small caption on PORTAL: what a press does now (GRAB / LOAD / DOOR / ...). `mode` only styles it (AIR pulses). */
  setPortalLabel(label: string | null, mode?: string | null) {
    const key = label ? `${label}|${mode ?? ''}` : null;
    if (key === this.portalLabel) return;
    this.portalLabel = key;
    this.portalCap.textContent = label ?? '';
    this.portalBtn.classList.toggle('has-cap', !!label);
    this.portalBtn.classList.toggle('urgent', mode === 'air');
    this.portalBtn.classList.toggle('grab', mode === 'grab' || mode === 'load' || mode === 'hijack');
  }

  offerClip(v: boolean) {
    const was = !this.clipBtn.classList.contains('hidden');
    if (v === was) return;
    this.clipBtn.classList.toggle('hidden', !v);
    if (v) vibrate(12);
  }

  setCrouched(v: boolean) {
    this.crouchBtn.classList.toggle('on', v);
    this.slideBtn.classList.toggle('on', v);
  }

  /** Let go of everything (pause, menus, respawn). */
  releaseAll() {
    for (const [id, f] of [...this.fingers]) this.endFinger(id, f, true);
    this.fingers.clear();
    this.input.touchMove.x = this.input.touchMove.y = 0;
    this.input.up('sprint');
    this.stickEl.classList.remove('on', 'sprint');
  }

  // -------------------------------------------------------------------------
  // Touch handling
  // -------------------------------------------------------------------------

  private syncAimClass() {
    let riftDown = false;
    for (const f of this.fingers.values()) if (f.kind === 'portal') riftDown = true;
    this.el.classList.toggle('aiming', this.aiming || riftDown);
  }

  private onStart(e: TouchEvent) {
    let handled = false;
    for (const tt of Array.from(e.changedTouches)) {
      const target = tt.target as Element | null;
      const hit = target && typeof target.closest === 'function' ? (target.closest('[data-t]') as HTMLElement | null) : null;
      if (!hit || !this.el.contains(hit)) continue;
      handled = true;
      this.input.lastDevice = 'touch';
      const role = hit.dataset.t!;
      const x = tt.clientX,
        y = tt.clientY;
      // FLOW's POWER held: a touch off the buttons marks the man under it (it may still drag to look)
      if (this.powerHeld && (role === 'left' || role === 'right')) {
        this.input.taps.push({ x, y });
        this.fingers.set(tt.identifier, { kind: 'look', x, y, t0: performance.now(), sx: x, sy: y, moved: 0 });
        continue;
      }
      switch (role) {
        case 'left': {
          if ([...this.fingers.values()].some((f) => f.kind === 'stick')) {
            this.fingers.set(tt.identifier, { kind: 'look', x, y, t0: performance.now(), sx: x, sy: y, moved: 0 });
            break;
          }
          const ox = Math.max(STICK_R + 10, x),
            oy = Math.min(window.innerHeight - STICK_R - 10, Math.max(STICK_R + 10, y));
          this.fingers.set(tt.identifier, { kind: 'stick', ox, oy, sprint: false, t0: performance.now(), sx: x, sy: y, moved: 0 });
          this.stickEl.style.transform = `translate3d(${ox}px,${oy}px,0)`;
          this.knobEl.style.transform = 'translate3d(0,0,0)';
          this.stickEl.classList.add('on');
          this.moveStick(this.fingers.get(tt.identifier) as Extract<Finger, { kind: 'stick' }>, x, y);
          break;
        }
        case 'right':
          this.fingers.set(tt.identifier, { kind: 'look', x, y, t0: performance.now(), sx: x, sy: y, moved: 0 });
          break;
        case 'a-portal': {
          // PORTAL: the press opens the pair; a drag from it picks SNAP's side (or, with nobody under the crosshair, sets the mid-air distance)
          if ([...this.fingers.values()].some((f) => f.kind === 'aimp')) break;
          this.fingers.set(tt.identifier, { kind: 'aimp', el: hit, sx: x, sy: y, y, moved: 0 });
          this.input.down('strike1');
          hit.classList.add('down');
          vibrate(10);
          break;
        }
        case 'portal': {
          if ([...this.fingers.values()].some((f) => f.kind === 'portal')) break;
          this.fingers.set(tt.identifier, { kind: 'portal', x, y, t0: performance.now(), cancel: false });
          this.input.down('portal');
          hit.classList.add('down');
          this.el.classList.add('rift-held');
          this.cancelRect = null;
          this.syncAimClass();
          vibrate(10);
          break;
        }
        case 'pause':
          this.input.tap('pause');
          this.flash(hit);
          vibrate(8);
          break;
        case 'flip':
          this.input.tap('flip');
          this.flash(hit);
          vibrate(8);
          break;
        case 'clip':
          this.input.tap('clip');
          this.flash(hit);
          vibrate(12);
          break;
        default: {
          const action = AIM_BTN[role] ?? REACH_BTN[role] ?? (role as Action);
          this.fingers.set(tt.identifier, { kind: 'btn', el: hit, action, x, y, sx: x, sy: y, drag: false });
          this.input.down(action);
          hit.classList.add('down');
          vibrate(8);
        }
      }
    }
    if (handled && e.cancelable) e.preventDefault();
  }

  private flash(el: HTMLElement) {
    el.classList.add('down');
    setTimeout(() => el.classList.remove('down'), 110);
  }

  private look(dx: number, dy: number, scale: number) {
    const s = LOOK.touch * this.input.sensitivity * scale;
    this.input.lookX += dx * s;
    this.input.lookY += dy * s * (this.input.invertY ? -1 : 1);
  }

  private moveStick(f: Extract<Finger, { kind: 'stick' }>, x: number, y: number) {
    let dx = x - f.ox,
      dy = y - f.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      dx = (dx / d) * STICK_R;
      dy = (dy / d) * STICK_R;
    }
    this.knobEl.style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0)`;
    this.input.touchMove.x = dx / STICK_R;
    this.input.touchMove.y = -dy / STICK_R;
    // full push (to the rim and a bit beyond) sprints; hysteresis on release
    const sprint = f.sprint ? d > STICK_R * 0.85 : d > STICK_R * 1.08;
    if (sprint !== f.sprint) {
      f.sprint = sprint;
      if (sprint) {
        this.input.down('sprint');
        vibrate(6);
      } else this.input.up('sprint');
      this.stickEl.classList.toggle('sprint', sprint);
    }
  }

  private onMove(e: TouchEvent) {
    let handled = false;
    for (const tt of Array.from(e.changedTouches)) {
      const f = this.fingers.get(tt.identifier);
      if (!f) continue;
      handled = true;
      const x = tt.clientX,
        y = tt.clientY;
      switch (f.kind) {
        case 'stick':
          this.moveStick(f, x, y);
          f.moved = Math.max(f.moved, Math.hypot(x - f.sx, y - f.sy));
          break;
        case 'look':
          this.look(x - f.x, y - f.y, this.aiming ? AIM_LOOK : 1);
          f.moved = Math.max(f.moved, Math.hypot(x - f.sx, y - f.sy));
          f.x = x;
          f.y = y;
          break;
        case 'aimp': {
          const dx = x - f.sx, dy = y - f.sy;
          f.moved = Math.max(f.moved, Math.hypot(dx, dy));
          if (Math.hypot(dx, dy) > SNAP_PX) {
            // a push toward a side (x right, y up); held, it is SNAP (the game uses it when a man is under the crosshair)
            const m = Math.min(1, Math.hypot(dx, dy) / SNAP_FULL);
            const l = Math.hypot(dx, dy);
            this.input.snapX = (dx / l) * m;
            this.input.snapY = (-dy / l) * m;
            if (!this.input.isHeld('snap')) {
              this.input.down('snap');
              vibrate(12);
            }
          }
          // vertical drag: the mid-air distance, a step every WHEEL_PX (up: further)
          while (f.y - y >= WHEEL_PX) {
            this.input.wheel += 1;
            f.y -= WHEEL_PX;
          }
          while (y - f.y >= WHEEL_PX) {
            this.input.wheel -= 1;
            f.y += WHEEL_PX;
          }
          break;
        }
        case 'portal': {
          if (!this.cancelRect) this.cancelRect = this.cancelEl.getBoundingClientRect();
          const r = this.cancelRect,
            pad = 14;
          const over = r.width > 0 && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
          if (over !== f.cancel) {
            f.cancel = over;
            this.cancelEl.classList.toggle('hot', over);
            if (over) vibrate(14);
          }
          if (!over) this.look(x - f.x, y - f.y, AIM_LOOK);
          f.x = x;
          f.y = y;
          break;
        }
        case 'btn': {
          if (!f.drag && Math.hypot(x - f.sx, y - f.sy) > 12) f.drag = DRAG_LOOK.has(f.action ?? '');
          if (f.drag) this.look(x - f.x, y - f.y, this.aiming ? AIM_LOOK : 1);
          f.x = x;
          f.y = y;
          break;
        }
      }
    }
    if (handled && e.cancelable) e.preventDefault();
  }

  private onEnd(e: TouchEvent) {
    for (const tt of Array.from(e.changedTouches)) {
      const f = this.fingers.get(tt.identifier);
      if (!f) continue;
      this.endFinger(tt.identifier, f);
      if (e.cancelable) e.preventDefault();
    }
  }

  /** A quick, short touch on the world: AIM PORTAL opens the exit right there. */
  private worldTap(f: { t0: number; sx: number; sy: number; moved: number }) {
    if (!this.aimOn) return;
    if (performance.now() - f.t0 > TAP_MS || f.moved > TAP_PX) return;
    this.input.worldTaps.push({ x: f.sx, y: f.sy });
  }

  private endFinger(id: number, f: Finger, silent = false) {
    this.fingers.delete(id);
    switch (f.kind) {
      case 'aimp':
        f.el.classList.remove('down');
        this.input.up('strike1');
        this.input.up('snap');
        this.input.resetSnap();
        break;
      case 'look':
        if (!silent) this.worldTap(f);
        break;
      case 'stick':
        if (!silent && !f.sprint) this.worldTap(f);
        this.input.touchMove.x = this.input.touchMove.y = 0;
        if (f.sprint) this.input.up('sprint');
        this.stickEl.classList.remove('on', 'sprint');
        break;
      case 'portal':
        // slid onto CANCEL: let go without an exit ('close' is read before the release)
        if (f.cancel) {
          this.input.tap('close');
          vibrate(20);
        }
        this.input.up('portal');
        this.portalBtn.classList.remove('down');
        this.el.classList.remove('rift-held');
        this.cancelEl.classList.remove('hot');
        this.syncAimClass();
        break;
      case 'btn':
        f.el.classList.remove('down');
        if (f.action) this.input.up(f.action);
        break;
    }
  }
}
