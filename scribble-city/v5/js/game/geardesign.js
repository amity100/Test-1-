import { DESIGNS1 } from './gearlook.js';
import { DESIGNS2 } from './gearlook2.js';
import { DESIGNS3 } from './gearlook3.js';

// (ROADMAP 11.28) Every thing of the pen designed (game/gearlook.js and its other sheets): which, and the
// design of one from its drawing (as game/itemdesign.js designOf) - null if it cannot be.

const DESIGNS = { ...DESIGNS1, ...DESIGNS2, ...DESIGNS3 };
export const GEAR_DESIGNED = new Set(Object.keys(DESIGNS));

export function gearDesign(id, M, ctx, o = {}) {
  const f = DESIGNS[id];
  if (!f) return null;
  const lines = (M || []).filter((L) => L && L.length >= 2);
  if (!lines.length) return null;
  try {
    return f(lines, ctx, o);
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('gear design', id, err);
    return null;
  }
}
