/**
 * COMBAT VARIANTS: the core combat in a few serious versions, played side by
 * side in the COMBAT LAB so the owner can choose one.
 *
 * - current:   the game exactly as it plays today (the baseline).
 * - precision: manual aim, a PARRY, a DODGE, a blade that finishes the
 *              exposed (precision.ts; systems ask `precisionOn()`).
 * - onslaught: builds on PRECISION (its own mechanics come in the next step).
 *
 * Systems read `activeVariant()`: the chosen preset while the lab is loaded,
 * CURRENT everywhere else (the missions keep playing as they do today).
 * The choice itself is a setting (`Settings.combatVariant`), kept across
 * world switches and reloads.
 */
export type CombatVariant = 'current' | 'precision' | 'onslaught';

export const VARIANTS: readonly CombatVariant[] = ['current', 'precision', 'onslaught'];
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

/** F1 / F2 / F3 → a variant (null for any other key code). */
export function variantForKey(code: string): CombatVariant | null {
  const i = ['F1', 'F2', 'F3'].indexOf(code);
  return i >= 0 ? VARIANTS[i] : null;
}

function emit() {
  const v = activeVariant();
  for (const f of listeners) f(v);
}
