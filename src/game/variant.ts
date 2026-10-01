/**
 * COMBAT VARIANTS: the core combat in a few serious versions, played side by
 * side in the COMBAT LAB so the owner can choose one.
 *
 * - current:   the game exactly as it plays today (the baseline).
 * - precision: manual aim, a PARRY, a DODGE, a blade that finishes the
 *              exposed (precision.ts; systems ask `precisionOn()`).
 * - onslaught: PRECISION, and an enemy side that attacks (actors/onslaught.ts:
 *              stormers, suppressors, heavy patterns, a squad director, its own waves).
 * - flow:      FLOW + POWER: ONSLAUGHT's fight with a body that moves fast
 *              (slide, double jump, wall kicks, rifts keep your speed) and a
 *              POWER moment that stops time (flow.ts; systems ask `flowOn()`).
 *
 * Systems read `activeVariant()`: the chosen preset while the lab is loaded,
 * CURRENT everywhere else (the missions keep playing as they do today).
 * The choice itself is a setting (`Settings.combatVariant`), kept across
 * world switches and reloads.
 */
export type CombatVariant = 'current' | 'precision' | 'onslaught' | 'flow';

export const VARIANTS: readonly CombatVariant[] = ['current', 'precision', 'onslaught', 'flow'];
export const DEFAULT_VARIANT: CombatVariant = 'current';

export const isVariant = (v: unknown): v is CombatVariant => typeof v === 'string' && (VARIANTS as readonly string[]).includes(v);

let chosen: CombatVariant = DEFAULT_VARIANT;
let labOn = false;
const listeners = new Set<(v: CombatVariant) => void>();

/** The variant in force now: the lab's pick inside the lab, CURRENT outside it. */
export function activeVariant(): CombatVariant {
  return labOn ? chosen : DEFAULT_VARIANT;
}

/** The variant picked for the lab (whether or not the lab is loaded). */
export function chosenVariant(): CombatVariant {
  return chosen;
}

/** Pick a variant (unknown values fall back to CURRENT). Listeners hear about a change of the active one. */
export function setVariant(v: CombatVariant | string) {
  const before = activeVariant();
  chosen = isVariant(v) ? v : DEFAULT_VARIANT;
  if (activeVariant() !== before) emit();
}

/** The lab world is loaded (variants apply) or not (CURRENT everywhere). */
export function setLabActive(on: boolean) {
  const before = activeVariant();
  labOn = on;
  if (activeVariant() !== before) emit();
}

export function labActive() {
  return labOn;
}

/** Called with the new active variant whenever it changes; returns an unsubscribe. */
export function onVariantChange(f: (v: CombatVariant) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** ONSLAUGHT's enemy side (its squads, its waves, its rules for the dodge) fights here: ONSLAUGHT and FLOW. */
export function onslaughtOn(v: CombatVariant = activeVariant()): boolean {
  return v === 'onslaught' || v === 'flow';
}

/** F1 / F2 / F3 / F4 → a variant (null for any other key code). */
export function variantForKey(code: string): CombatVariant | null {
  const i = ['F1', 'F2', 'F3', 'F4'].indexOf(code);
  return i >= 0 ? VARIANTS[i] : null;
}

function emit() {
  const v = activeVariant();
  for (const f of listeners) f(v);
}
