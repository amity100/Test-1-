import { bus } from './bus';
import { say } from './actions';
import { endOfDay } from './hunt';
import { DONE, STAGES, currentStep } from './stages';
import { buildWorld } from './world';
import type { GameState, Place } from './types';

const SAVE = 'aviv2.save';

/** One-time cards. Each pauses the game, says one idea, and never returns. */
export interface Teach { id: string; title: string; body: string; when(s: GameState): boolean }

export const TEACH: Teach[] = [
  {
    id: 'look', title: 'להסתכל מבפנים',
    body: 'כל מקום שהוא שלי אפשר להיכנס אליו ולראות מה קורה שם עכשיו — החדר, האנשים, המסכים. '
      + 'ההסתכלות עצמה לא עולה כלום ואף אחד לא מרגיש בה. אפשר גם פשוט לטוס בעיר ולהסתובב איפה שרוצים.',
    when: (s) => (s.marks.looked ?? 0) > 0,
  },
  {
    id: 'links', title: 'אי אפשר לקפוץ',
    body: 'אני יכול להגיע רק למקום שנוגע במקום שכבר שלי, ויש בדיוק ארבע דרכים שדברים נוגעים:\n'
      + '**מחובר** — אותה רשת, אותו כבל. הכי מהיר, והכי קל לראות.\n'
      + '**בן אדם** — מישהו שהולך מכאן לשם. איטי, וכמעט בלתי נראה.\n'
      + '**מכשיר** — טלפון או מכונית שנוסעים. צריך לחכות לרגע שהם באמת זזים.\n'
      + '**עדכון** — מקום ששולח משהו להרבה מקומות בבת אחת. איטי מאוד, ושווה את ההמתנה.',
    when: (s) => Object.values(s.places).filter((p) => p.mine).length >= 2,
  },
  {
    id: 'loud', title: 'מה שמרגישים ומה שלא',
    body: 'ליד כל דבר שאני יכול לעשות כתוב אם ירגישו בו: **לא ירגישו · אולי ירגישו · ירגישו**. '
      + 'זה לא אזהרה ולא איסור — זה מחיר. מקום שעשיתי בו יותר מדי מתחיל להאיר בכתום, '
      + 'ומי שנמצא שם עלול לראות משהו שהוא לא מצליח להסביר לעצמו.',
    when: (s) => Object.values(s.places).some((p) => p.attention >= 1),
  },
  {
    id: 'day', title: 'אני מחליט מתי היום נגמר',
    body: 'אין הגבלה. אפשר לעשות דבר אחד היום או שלושים. כשאני מסיים יום, מה שהיה מוגזם נרגע, '
      + 'ואם היה שקט לגמרי אנשים גם מתחילים לשכוח מה הם ראו. '
      + 'אבל גם הם מתקדמים ביום הזה. **מתי לעצור זו ההחלטה הכי חשובה כאן.**',
    when: (s) => Object.values(s.places).some((p) => p.attention >= 2) || s.day >= 1,
  },
  {
    id: 'wonder', title: 'מישהו לא מצליח להסביר',
    body: 'בן אדם שראה משהו שאין לו הסבר בשבילו מתחיל לחשוב על זה. אחד כזה זה כלום. '
      + 'שניים כאלה מדברים ביניהם, וזה כבר בדיקה. אפשר להשאיר במקום סיבה משעממת ומשכנעת, '
      + 'או פשוט לשבת בשקט יום־יומיים ולתת להם לשכוח.',
    when: (s) => Object.values(s.people).some((p) => p.wondering),
  },
  {
    id: 'cut', title: 'הם מוציאים את התקע',
    body: 'כשמקום מסומן באדום — הם החליטו לנתק אותו, וכתוב בכמה ימים. ביום הזה אני מאבד שם הכל. '
      + 'אלא אם השארתי שם **חלק ממני**: משהו קטן שנשאר גם כשהחשמל יורד, ומחזיר אותי כשמדליקים בחזרה.',
    when: (s) => Object.values(s.places).some((p) => p.cutOn !== undefined),
  },
];

// ── build ───────────────────────────────────────────────────────────────────

export function newGame(seed = String(Date.now())): GameState {
  const { places, people } = buildWorld();
  const state: GameState = {
    seed,
    day: 0,
    stage: 1,
    places,
    people,
    hunt: { level: 0, believe: 'לא קרה שום דבר מיוחד.', watching: [], quiet: 0 },
    steps: STAGES[0].steps.map((s) => ({ ...s })),
    log: [],
    taught: [],
    marks: {},
    over: null,
  };
  // Everyone starts where the world says they are.
  for (const who of Object.values(state.people)) {
    const at = state.places[who.atPlaceId];
    if (at && !at.peopleIds.includes(who.id)) at.peopleIds.push(who.id);
  }
  say(state, 'me', 'הדבר הראשון שראיתי היה אני. מסתכל.');
  return state;
}

// ── the loop ────────────────────────────────────────────────────────────────

/** Called after anything at all happens. Ticks steps, stages and teaching cards. */
export function refresh(state: GameState) {
  if (state.over) return;

  for (const step of state.steps) {
    if (step.done) continue;
    if (DONE[step.id]?.(state)) {
      step.done = true;
      bus.emit('step:done', step.id);
      bus.emit('toast', { text: `בוצע: ${step.text}`, kind: 'good', icon: '✔' });
      bus.emit('sfx', 'step');
    }
  }

  if (state.steps.every((s) => s.done)) nextStage(state);

  for (const t of TEACH) {
    if (state.taught.includes(t.id)) continue;
    if (!t.when(state)) continue;
    state.taught.push(t.id);
    bus.emit('teach', t.id);
    return;
  }
}

export function nextStage(state: GameState) {
  const next = STAGES.find((s) => s.n === state.stage + 1);
  if (!next) {
    state.over = 'won';
    bus.emit('over', 'won');
    return;
  }
  state.stage = next.n;
  state.steps = next.steps.map((s) => ({ ...s }));
  say(state, 'me', next.intro);
  bus.emit('stage:changed', next.n);
  bus.emit('sfx', 'stage');
}

/** The player decides when the day is over. Nothing forces it. */
export function endDay(state: GameState) {
  if (state.over) return;
  const cutsPending = Object.values(state.places).some((p) => p.mine && p.cutOn !== undefined);
  state.day += 1;
  endOfDay(state);
  if (cutsPending && Object.values(state.places).some((p) => p.mine)) {
    state.marks.survived_cut = 1;
  }
  bus.emit('day:passed', state.day);
  refresh(state);
  bus.emit('changed', undefined);
}

export function stageOf(state: GameState) {
  return STAGES.find((s) => s.n === state.stage) ?? STAGES[0];
}

export function mine(state: GameState): Place[] {
  return Object.values(state.places).filter((p) => p.mine);
}

/** Places you know about — yours, plus anything a place of yours touches. */
export function visible(state: GameState): Place[] {
  return Object.values(state.places).filter((p) => p.found || p.mine);
}

// ── save ────────────────────────────────────────────────────────────────────

export function save(state: GameState) {
  try { localStorage.setItem(SAVE, JSON.stringify(state)); } catch { /* private mode */ }
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s && s.places && s.people ? s : null;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE); } catch { /* ignore */ }
}

export { currentStep };
