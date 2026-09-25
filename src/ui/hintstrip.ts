/**
 * The lesson hint on phones. A long hint over the view
 * hides the fight, so there it is a two-line strip at the top for a few
 * seconds, then only a small "?" tab; a tap on either shows the whole text for
 * a while, another tap folds it back. Pure state: the HUD draws it.
 */

/** off: nothing; strip: two lines; tab: the "?" alone; open: the whole text. */
export type TipView = 'off' | 'strip' | 'tab' | 'open';

export const TIP = {
  /** The strip's time before it folds into the tab (s; shorter if the hint's own is). */
  strip: 5,
  /** How long the tab stays to be tapped (s). */
  tab: 25,
  /** The whole text: time to read it, within these bounds (s). */
  openMin: 5,
  openMax: 14,
};

/** Seconds to read a hint (tags stripped, a line break parts words; ~3.5 words a second plus a beat). */
export function readTime(html: string): number {
  const words = html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.min(TIP.openMax, Math.max(TIP.openMin, 2 + words / 3.5));
}

/**
 * Phones (touch) only: the strip needs a tap to show its whole text. With
 * mouse and keyboard the pointer is locked in play (every click goes to the
 * game) and a pad can't tap, so a small window keeps the full, timed hint box.
 */
export function isCompact(touch: boolean): boolean {
  return touch;
}

export class TipState {
  view: TipView = 'off';
  /** Time left in this view (s). */
  private t = 0;
  private read = TIP.openMin;

  /** A new hint: the strip first. */
  show(html: string, dur: number) {
    this.view = 'strip';
    this.t = Math.max(0.5, Math.min(dur, TIP.strip));
    this.read = readTime(html);
  }

  /** A tap on the strip or the tab opens the whole text; a tap on the open text folds it. */
  tap() {
    if (this.view === 'off') return;
    if (this.view === 'open') this.fold();
    else {
      this.view = 'open';
      this.t = this.read;
    }
  }

  /** Returns true when the view changed. */
  update(dt: number): boolean {
    if (this.view === 'off' || (this.t -= dt) > 0) return false;
    if (this.view === 'tab') this.clear();
    else this.fold();
    return true;
  }

  clear() {
    this.view = 'off';
    this.t = 0;
  }

  private fold() {
    this.view = 'tab';
    this.t = TIP.tab;
  }
}
