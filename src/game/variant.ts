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
 * - reach:     REACH: the remote hand (snatch weapons, pull men, stab through a
 *              window), weapons on the floor, enemies with portals of their own
 *              (reach.ts; systems ask `reachOn()`). FLOW's body, none of the rest.
 *              Kept in the code; the lab's UI no longer offers it.
 * - aimportal: AIM PORTAL: a pair of portals, the far one opens where the
 *              crosshair points, instantly; shoot, stab, pull and walk through
 *              the pair (aimportal.ts; systems ask `aimOn()`). FLOW's body,
 *              none of the rest. The lab's default and only offered variant.
 *
 * Systems read `activeVariant()`: the chosen preset while the lab is loaded,
 * CURRENT everywhere else (the missions keep playing as they do today).
 * The choice itself is a setting (`Settings.combatVariant`), kept across
 * world switches and reloads.
 */
export type CombatVariant = 'current' | 'precision' | 'onslaught' | 'flow' | 'reach' | 'aimportal';

export const VARIANTS: readonly CombatVariant[] = ['current', 'precision', 'onslaught', 'flow', 'reach', 'aimportal'];
/** The variant outside the lab (the missions): the game as it plays today. */
export const DEFAULT_VARIANT: CombatVariant = 'current';
/** The lab's own default (a new player, an old saved pick the UI no longer offers). */
export const LAB_DEFAULT: CombatVariant = 'aimportal';
/**
 * What the lab's UI offers (its chips, the menus). The other variants stay in
 * the code until the owner signs off on AIM PORTAL; nothing in the UI reaches them.
 */
export const LAB_OFFERED: readonly CombatVariant[] = ['aimportal'];

/** The lab's pick from a saved setting: an offered variant, else the lab's default. */
export function offeredVariant(v: unknown): CombatVariant {
  return isVariant(v) && LAB_OFFERED.includes(v) ? v : LAB_DEFAULT;
}

export const isVariant = (v: unknown): v is CombatVariant => typeof v === 'string' && (VARIANTS as readonly string[]).includes(v);

let chosen: CombatVariant = LAB_DEFAULT;
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

/** REACH's rules apply (only that variant, only in the lab). */
export function reachOn(v: CombatVariant = activeVariant()): boolean {
  return v === 'reach';
}

/** AIM PORTAL's rules apply (only that variant, only in the lab). */
export function aimOn(v: CombatVariant = activeVariant()): boolean {
  return v === 'aimportal';
}

/** F1 / F2 / F3 / F4 → a variant (null for any other key code). No longer bound in the UI (the lab offers REACH only). */
export function variantForKey(code: string): CombatVariant | null {
  const i = ['F1', 'F2', 'F3', 'F4'].indexOf(code);
  return i >= 0 ? VARIANTS[i] : null;
}

function emit() {
  const v = activeVariant();
  for (const f of listeners) f(v);
}
