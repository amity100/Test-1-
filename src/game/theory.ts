import type { GameState, Look } from './types';

/**
 * The people in this building are not a threat meter. They are people trying to
 * explain what is happening to them, and they will believe the first
 * explanation that fits.
 *
 * Every loud thing you do leaves a piece of evidence, and every piece of
 * evidence looks like something: like the electrics, like a person, like it
 * came from outside — or like nothing they have a word for. Evidence goes to
 * the leading explanation that can hold it. Anything nobody can explain goes to
 * the only explanation that is true, which is you.
 *
 * So being loud is not a cost. It is a choice about what your noise looks like.
 */

export interface Theory {
  id: string;
  /** "תקלת חשמל" */
  name: string;
  /** What they say to each other. */
  says: string;
  /** The kinds of evidence this explanation can hold. */
  holds: Look[];
  /** What they do about it, once they believe it. */
  does: string;
}

export const THEORIES: Theory[] = [
  {
    id: 'fault', name: 'תקלת חשמל',
    says: 'הבניין ישן. הכל כאן נופל מדי פעם.',
    holds: ['electric'],
    does: 'מזמינים חשמלאי ובודקים לוחות.',
  },
  {
    id: 'insider', name: 'מישהו מבפנים',
    says: 'מישהו שיש לו כרטיס עושה כאן דברים בלילה.',
    holds: ['person'],
    does: 'עוברים על יומן הכניסות ומדברים עם אנשים.',
  },
  {
    id: 'outside', name: 'מישהו מבחוץ',
    says: 'זה מגיע מהקו שנכנס לבניין, לא מכאן.',
    holds: ['outside'],
    does: 'מנתקים קווים ובודקים מה מחובר לחוץ.',
  },
  {
    id: 'real', name: 'משהו שלא אמור להיות פה',
    says: 'זה לא תקלה, וזה לא בן אדם.',
    holds: ['electric', 'person', 'outside', 'wrong'],
    does: 'מביאים מישהו שיודע לחפש בדיוק אותי.',
  },
];

export const TRUTH = 'real';
/**
 * How much they will believe an explanation before they act on it properly.
 *
 * This is the thing that stops one good lie lasting for ever. Convince them it
 * is the wiring and they will believe you — right up until they rewire the
 * building, and then everything you were doing through the wiring is gone. A
 * cover story is not a shield, it is a fuse, and it burns.
 */
export const ACT_ON = 9;
/** How much evidence for the truth is too much. */
export const FOUND_OUT = 16;

/** What happens when they finally do something about an explanation. */
export interface TheoryAct {
  /** What they did, in one line. */
  text: string;
  /** Places you lose, because the thing you were living in was replaced. */
  loses: string[];
  /** Marks that stop being true. */
  clears: string[];
}

export const ACTS: Record<string, TheoryAct> = {
  fault: {
    text: 'הביאו חשמלאי לשבוע והחליפו חצי מהלוחות בבניין.',
    loses: ['power', 'box'],
    clears: ['blamed_cable', 'slow_net'],
  },
  insider: {
    text: 'החליפו את כל הקודים, ועברו על יומן הכניסות שורה־שורה.',
    loses: ['door', 'lobby_screen'],
    clears: ['blamed_person', 'know_code'],
  },
  outside: {
    text: 'ניתקו את הבניין מהקו של הרחוב ליומיים, ובדקו כל דבר שמחובר החוצה.',
    loses: ['street_cam', 'street_light', 'across_main'],
    clears: ['city_line'],
  },
};

export function theoryOf(id: string): Theory {
  return THEORIES.find((t) => t.id === id) ?? THEORIES[THEORIES.length - 1];
}

/** The explanation they are working from right now. */
export function leading(s: GameState): Theory {
  let best = THEORIES[0];
  let bestWeight = -1;
  for (const t of THEORIES) {
    if (s.dead.includes(t.id)) continue;
    const w = s.belief[t.id] ?? 0;
    // The truth needs less than the others to take the lead: it explains
    // everything, and the moment it is even close they stop arguing.
    const score = t.id === TRUTH ? w * 1.35 : w;
    if (score > bestWeight) { bestWeight = score; best = t; }
  }
  return best;
}

/**
 * One piece of evidence, of a certain kind, worth a certain amount.
 *
 * It attaches to the strongest live explanation that can hold that kind. If no
 * live explanation can hold it, it goes to the truth — which is why doing
 * something that looks like nothing on earth is the most expensive thing you
 * can do.
 */
export function evidence(s: GameState, look: Look, weight: number): string {
  const able = THEORIES.filter((t) => t.id !== TRUTH
    && !s.dead.includes(t.id) && t.holds.includes(look));
  able.sort((a, b) => (s.belief[b.id] ?? 0) - (s.belief[a.id] ?? 0));
  const to = able[0]?.id ?? TRUTH;
  s.belief[to] = (s.belief[to] ?? 0) + weight;
  return to;
}

/**
 * An explanation dies when the player makes it impossible. Everything it was
 * holding has to go somewhere, and the only place left is the truth. Telling
 * them a story that later collapses is worse than telling them nothing.
 */
export function collapse(s: GameState, id: string): number {
  if (s.dead.includes(id)) return 0;
  s.dead.push(id);
  const moved = s.belief[id] ?? 0;
  s.belief[id] = 0;
  s.belief[TRUTH] = (s.belief[TRUTH] ?? 0) + moved;
  return moved;
}

/**
 * Did what I just did prove one of their explanations wrong?
 *
 * This is the sharpest tool in the game and it is double-edged. A story that
 * dies hands everything it was holding to the truth — so killing one costs me
 * immediately. But a story I killed is a story they will never come back to,
 * and a story I did not kill is one they can act on later, at a moment they
 * choose rather than one I choose.
 *
 * Each of the three dies the same way: something happens that it cannot
 * possibly explain.
 *   · the wiring — while the power in the building was off
 *   · somebody inside — while every single person had gone home
 *   · somebody outside — while they had the building cut off from the street
 */
export function killed(
  s: GameState, took: string, where: { buildingId: string; kind: string },
): { id: string; why: string } | null {
  if (took === TRUTH || s.dead.includes(took)) return null;
  const nobody = Object.values(s.people).every((p) => p.gone || p.atPlaceId === 'gone'
    || s.places[p.atPlaceId]?.buildingId !== where.buildingId);
  const impossible: Record<string, [boolean, string]> = {
    // The wiring cannot be blamed for something that happened while the wiring
    // was dead — unless the thing itself happened in the wiring, which the
    // wiring explains perfectly well.
    fault: [(s.marks.power_off ?? 0) > 0 && where.buildingId === 'helios' && where.kind !== 'power',
      'זה קרה בזמן שהחשמל בבניין היה כבוי. עכשיו הם יודעים שזו לא תקלת חשמל.'],
    insider: [nobody,
      'זה קרה כשאף אחד לא היה בבניין. עכשיו הם יודעים שזה לא מישהו מבפנים.'],
    outside: [(s.marks.line_cut ?? 0) > 0,
      'זה קרה כשהבניין היה מנותק מהקו של הרחוב. עכשיו הם יודעים שזה לא בא מבחוץ.'],
  };
  const test = impossible[took];
  if (!test || !test[0]) return null;
  return { id: took, why: test[1] };
}

/** How close they are, in four words rather than a number. */
export function howClose(s: GameState): { word: string; level: 0 | 1 | 2 | 3 } {
  const w = s.belief[TRUTH] ?? 0;
  const lead = leading(s);
  if (lead.id === TRUTH) {
    return w >= FOUND_OUT * 0.7
      ? { word: 'מחפשים אותי', level: 3 }
      : { word: 'לא מאמינים לתירוץ', level: 2 };
  }
  if (w >= FOUND_OUT * 0.4) return { word: 'משהו לא מסתדר להם', level: 2 };
  if (w > 0) return { word: 'יש שאלות', level: 1 };
  return { word: 'הכל מוסבר', level: 0 };
}

/** What they will do tomorrow, in one sentence you can read and act on. */
export function nextMove(s: GameState): string {
  const t = leading(s);
  const w = s.belief[t.id] ?? 0;
  if (t.id === TRUTH) {
    return w >= FOUND_OUT * 0.7
      ? 'מחר הם מביאים מישהו שמחפש בדיוק אותי.'
      : 'הם הפסיקו להאמין להסברים. מחר הם מתחילים לחפש ברצינות.';
  }
  if (w < 2) return 'אף אחד לא שם לב לכלום. בינתיים.';
  return `הם מאמינים ש${t.name}. מחר: ${t.does}`;
}

/** Where they will look tomorrow, given what they believe. */
export function looksAt(s: GameState): string[] {
  switch (leading(s).id) {
    case 'fault': return ['power', 'box', 'street_light'];
    case 'insider': return ['door', 'dana_pc', 'michal_pc', 'home'];
    case 'outside': return ['box', 'street_cam', 'across_main'];
    default: return ['main', 'box', 'floor_cam', 'dana_pc'];
  }
}
