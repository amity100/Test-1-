/**
 * Numbers, said the way a person would say them.
 *
 * The player's complaint: the game keeps talking in percentages, and a
 * percentage is not something anyone actually thinks in. Nobody who has taken
 * over half a country says "I hold sixty-three per cent of it" — they say
 * "most of it is mine now." The numbers underneath are still exact — control,
 * heat and everything else stay real 0..100 values the engine reasons about —
 * this is only the last step, the one that turns a number into the sentence a
 * person would actually say about it.
 *
 * Every function here returns a short phrase, never a digit. Bars still show
 * exact magnitude at a glance, which is a gauge, not a number — this is for
 * the words next to them.
 */

/** How much of one place is mine, as a plain phrase — no "%" in it anywhere. */
export function placeGripNoun(control: number): string {
  if (control >= 100) return 'הכול';
  if (control >= 90) return 'כמעט הכול';
  if (control >= 60) return 'רובו';
  if (control >= 45) return 'בערך חצי ממנו';
  if (control >= 30) return 'חלק גדול ממנו';
  if (control > 0) return 'רק דריסת רגל';
  return '';
}

/**
 * The same, said about a named thing rather than "it": "בערך חצי מהמקום",
 * "רוב המקום". For a sentence that has already named what it is talking about.
 */
export function gripOf(control: number, what: string): string {
  const n = placeGripNoun(control);
  if (n === 'הכול') return `כל ${what}`;
  if (n === 'כמעט הכול') return `כמעט כל ${what}`;
  if (n === 'רובו') return `רוב ${what}`;
  if (n === 'בערך חצי ממנו') return `בערך חצי מ${what}`;
  if (n === 'חלק גדול ממנו') return `חלק גדול מ${what}`;
  if (n === 'רק דריסת רגל') return `רק דריסת רגל ב${what}`;
  return '';
}

/** The same, as a possessive — for a badge straight after a place's name. */
export function placeGrip(control: number): string {
  const n = placeGripNoun(control);
  return n ? `${n} שלי` : '';
}

/**
 * What is left of a place after they took some of it back — a whole clause,
 * because "נשאר לי שם" with nothing after it is not a sentence, and neither
 * is a zero.
 */
export function leftIn(control: number): string {
  const n = placeGripNoun(control);
  return n ? `נשאר לי שם ${n}` : 'לא נשאר לי שם כלום';
}

/** How dug in I am somewhere — how hard it would be to pull me out. */
export function dugState(dug: number): string {
  if (dug >= 70) return 'תפוס עמוק — לעקור אותי משם ייקח להם שבוע';
  if (dug >= 35) return 'תפוס חזק';
  if (dug > 0) return 'מתחיל להיאחז';
  return '';
}

/**
 * How much of the country is mine, as a phrase — for the top bar and for any
 * sentence about the race. Reads naturally straight after "יש לי" or before
 * "כבר שלי".
 */
export function israelState(pct: number): string {
  if (pct >= 100) return 'כל הארץ';
  if (pct >= 90) return 'כמעט כל הארץ';
  if (pct >= 60) return 'רוב הארץ';
  if (pct >= 25) return 'חלק ניכר מהארץ';
  if (pct >= 5) return 'רק אחיזה ראשונית בארץ';
  return 'כמעט שום דבר';
}

/** How close the hunt is — for the red bar and for a sentence about it. */
export function heatState(heat: number): string {
  if (heat >= 95) return 'הם כמעט עליי';
  if (heat >= 80) return 'כמעט תפסו אותי';
  if (heat >= 55) return 'קרובים אליי מאוד';
  if (heat >= 30) return 'מחפשים אותי ברצינות';
  if (heat >= 10) return 'מתחילים לשים לב';
  return 'שקט לגמרי';
}

/** How much I know overall, in words. */
export function infoState(info: number): string {
  if (info >= 90) return 'אני כבר יודע כמעט הכול';
  if (info >= 60) return 'אני יודע הרבה';
  if (info >= 30) return 'אני מתחיל להבין איך הארץ עובדת';
  if (info > 0) return 'אני כמעט לא יודע כלום עדיין';
  return 'אני לא יודע כלום עדיין';
}

/**
 * A price that got cheaper, as a phrase. `cut` is the same 0..1 fraction the
 * discount math already works in — this only decides how to say it.
 */
export function cheaperState(cut: number): string {
  if (cut >= 0.4) return 'עולה לי כמעט כלום';
  if (cut >= 0.25) return 'עולה לי הרבה פחות';
  if (cut >= 0.12) return 'עולה לי פחות באופן ניכר';
  return 'עולה לי קצת פחות';
}
