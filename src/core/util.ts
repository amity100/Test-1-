export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inverseLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Frame-rate independent exponential approach. */
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

let idCounter = 0;
export const uid = (prefix = 'x') => `${prefix}_${(idCounter++).toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

/** 12500 -> "12.5K" — keeps HUD numbers narrow without losing signal. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + 'M';
  if (abs >= 1e4) return (n / 1e3).toFixed(0) + 'K';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(abs % 1 === 0 ? 0 : 1);
  return n.toFixed(abs % 1 === 0 ? 0 : 1);
}

export function signed(n: number): string {
  return (n >= 0 ? '+' : '') + compact(n);
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/** In-game clock: minutes elapsed since 03:12 on night one. */
export function gameClock(minutes: number): { time: string; day: number } {
  const total = Math.floor(minutes) + 3 * 60 + 12;
  const day = Math.floor(total / 1440) + 1;
  const m = total % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return { time: `${hh}:${mm}`, day };
}

export function durationText(minutes: number): string {
  if (minutes < 60) return `${Math.ceil(minutes)} דק׳`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} שע׳` : `${h}:${String(m).padStart(2, '0')} שע׳`;
}

export function shortDuration(minutes: number): string {
  if (minutes < 60) return `${Math.ceil(minutes)}מ`;
  return `${(minutes / 60).toFixed(minutes < 600 ? 1 : 0)}ש`;
}
