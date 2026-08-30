import { RNG } from '../core/rng';
import { bus } from './bus';
import { at, tell, to } from './story';
import type { GameState, Hunt, Place, Person } from './types';

/**
 * Somebody came looking, and there is a clock on it.
 *
 * The complaint this file answers is the sharpest one the player made: that
 * doing something loud produced a number, and the number produced nothing you
 * could see. So now a loud thing produces **a person with a name who gets up and
 * walks to the place**, and when they arrive a clock starts, and next to the
 * clock is a short list of things that would end it — each one written out in
 * full, each one you can press.
 *
 * Three rules keep it from becoming another meter:
 *
 *   1. **It has a face and a place.** Never "suspicion rose". Always "רון עלה
 *      לקומה ארבע עשרה, והוא עומד מול המדפסת".
 *   2. **The way out is written down.** The player never has to guess what would
 *      save them. The list says it. If an answer cannot be pressed right now,
 *      the row says in one sentence what is missing.
 *   3. **The clock finishing costs something real.** Control, a place, or — at
 *      the top of the ladder — the run.
 *
 * A hunt in the saved game is only facts: which script, who, where, how long,
 * what has been answered. The words and the consequences live in the catalogue
 * below, because a function cannot be written to disk and read back.
 */

// ── what an answer is ───────────────────────────────────────────────────────

export interface Answer {
  id: string;
  /** The button. Short enough for a phone. */
  text: string;
  /** One sentence under it: what pressing it actually does. */
  says: string;
  /** True when the world already satisfies this, with no press needed. */
  met(s: GameState, p: Place, h: Hunt): boolean;
  /** Can I do it right now by pressing? Absent means this one is only ever passive. */
  can?(s: GameState, p: Place, h: Hunt): boolean;
  /** What is missing, when `can` says no. Always a plain sentence. */
  lacks?(s: GameState, p: Place, h: Hunt): string;
  /** Pressing it. */
  press?(s: GameState, p: Place, h: Hunt): void;
}

export interface Script {
  id: string;
  /** "הטכנאי הגיע" — a headline, not a category. */
  name: string;
  /** Which sort of person brings it. */
  role: 'טכנאי' | 'שומר' | 'מנהלת צוות' | 'כל אחד';
  /** The three written beats: what happened, what they are doing, what it means. */
  says(who: Person, p: Place): string;
  /** How long the clock runs. */
  minutes: number;
  /** How many of the answers have to be met. */
  needs: number;
  /** What it takes if the clock finishes. */
  bite: 'clean' | 'cut' | 'wipe' | 'wake';
  /** How much they have to already understand before this one can happen at all. */
  from: number;
  answers: Answer[];
}

// ── the small words the scripts are written in ──────────────────────────────

/** Everything of mine that is running in this building. */
function busyIn(s: GameState, buildingId: string) {
  return s.jobs.filter((j) => s.places[j.placeId]?.buildingId === buildingId);
}

/** Everything of mine that is running at this one thing. */
function busyAt(s: GameState, placeId: string) {
  return s.jobs.filter((j) => j.placeId === placeId);
}

/** Do I hold a thing of this kind in this building? */
function haveKind(s: GameState, buildingId: string, kind: Place['kind'], at = 30) {
  return Object.values(s.places).some(
    (q) => q.buildingId === buildingId && q.kind === kind && q.control >= at,
  );
}

/** Stop everything running somewhere, and give the power back. */
function letGo(s: GameState, jobs: { id: string; power: number }[]) {
  for (const j of jobs) {
    const i = s.jobs.findIndex((x) => x.id === j.id);
    if (i < 0) continue;
    s.power.used = Math.max(0, s.power.used - s.jobs[i].power);
    s.jobs.splice(i, 1);
  }
}

/** Nobody is standing here who could see anything. */
function empty(s: GameState, p: Place) {
  return !p.peopleIds.some((id) => {
    const q = s.people[id];
    return q && !q.gone && (q.awayUntil ?? 0) <= s.at;
  });
}


/**
 * Bend a verb the right way round somebody.
 *
 * `v(who, 'הגיע', 'הגיעה')` — because a game with eight people in it, all of
 * whom it knows by name, has no excuse for writing "הגיע/ה".
 */
function v(who: Person, male: string, female: string): string {
  return who.he ? male : female;
}

// ── the answers the scripts share ───────────────────────────────────────────

/** Stop moving. The commonest answer, and the one that always costs time. */
const STILL: Answer = {
  id: 'still',
  text: 'לשכב בשקט',
  says: 'לעצור כל דבר שלי שרץ כאן. הוא לא ימצא תנועה כי לא תהיה תנועה.',
  met: (s, p) => busyAt(s, p.id).length === 0,
  can: (s, p) => busyAt(s, p.id).length > 0,
  press: (s, p) => {
    const stopped = busyAt(s, p.id);
    letGo(s, stopped);
    tell(s, 'me', `עצרתי הכל ${at(p.name)}. אני לא זז עד שהוא ילך.`, 1, p.id);
  },
};

/** Stop moving in the whole building, which is much more expensive. */
const STILL_ALL: Answer = {
  id: 'still_all',
  text: 'לשכב בשקט בכל הבניין',
  says: 'לעצור כל דבר שלי בכל הבניין. יקר, אבל אין מה למצוא.',
  met: (s, p) => busyIn(s, p.buildingId).length === 0,
  can: (s, p) => busyIn(s, p.buildingId).length > 0,
  press: (s, p) => {
    const stopped = busyIn(s, p.buildingId);
    letGo(s, stopped);
    tell(s, 'me', `הפסקתי הכל בבניין. ${stopped.length} דברים שלי עמדו מלכת בבת אחת.`, 1, p.id);
  },
};

/** Make myself small enough here that there is nothing to trip over. */
const SMALL: Answer = {
  id: 'small',
  text: 'לרדת קטן כאן',
  says: 'לוותר על רוב האחיזה שלי במקום הזה. אשאיר רק חוט דק שקשה לראות.',
  met: (_s, p) => p.control <= 20,
  can: (_s, p) => p.control > 20,
  press: (s, p) => {
    const was = p.control;
    p.control = 15;
    p.heat = Math.max(0, p.heat - 25);
    tell(s, 'me', `ויתרתי על ${Math.round(was - 15)} אחוז ${at(p.name)} כדי שלא יהיה שם מה למצוא.`, 1, p.id);
  },
};

/** Turn the lights off, which needs the switch room. */
const DARK: Answer = {
  id: 'dark',
  text: 'לכבות את האור בקומה',
  says: 'חושך פתאומי. הוא ילך להביא פנס, ועד שיחזור זה כבר לא יעניין אותו.',
  met: (s, _p, h) => (s.marks[`dark_${h.id}`] ?? 0) > 0,
  can: (s, p) => haveKind(s, p.buildingId, 'power'),
  lacks: () => 'צריך שחדר החשמל של הבניין יהיה שלי.',
  press: (s, p, h) => {
    s.marks[`dark_${h.id}`] = 1;
    bus.emit('felt', { placeId: p.id, kind: 'dark' });
    const who = s.people[h.whoId];
    if (who) who.awayUntil = s.at + 30;
    tell(s, 'me', who
      ? `כיביתי את האור בקומה. ${who.name} ${v(who, 'עמד', 'עמדה')} בחושך ואז ${v(who, 'יצא', 'יצאה')} להביא פנס.`
      : 'כיביתי את האור בקומה. מי שהיה שם עמד בחושך ואז יצא להביא פנס.', 1, p.id);
  },
};

/** Cut the building off from the street, which needs the box. */
const CUT_LINE: Answer = {
  id: 'cut_line',
  text: 'לנתק את הבניין מהרחוב',
  says: 'מה שהוא מחפש — לא יוכל לספר עליו לאף אחד בחוץ. גם אני לא אוכל לצאת.',
  met: (s) => (s.marks.line_cut ?? 0) > 0,
  can: (s, p) => haveKind(s, p.buildingId, 'box') || haveKind(s, p.buildingId, 'power'),
  lacks: () => 'צריך שקופסת האינטרנט או חדר החשמל של הבניין יהיו שלי.',
  press: (s, p) => {
    s.marks.line_cut = (s.marks.line_cut ?? 0) + 1;
    tell(s, 'me', `ניתקתי את הבניין מהרחוב. מה שיקרה כאן — יישאר כאן. גם אני.`, 1, p.id);
  },
};

/** Give them something else to worry about somewhere else. */
const ELSEWHERE: Answer = {
  id: 'elsewhere',
  text: 'לתת לו סיבה ללכת',
  says: 'משהו קטן ייפול בקצה השני של הבניין, והוא ילך לבדוק אותו.',
  met: (s, _p, h) => (s.marks[`pulled_${h.id}`] ?? 0) > 0,
  can: (s, p) => haveKind(s, p.buildingId, 'printer', 20)
    || haveKind(s, p.buildingId, 'screen', 20)
    || haveKind(s, p.buildingId, 'speaker', 20)
    || haveKind(s, p.buildingId, 'computer', 20),
  lacks: () => 'צריך שיהיה לי משהו אחר בבניין שאני יכול להרעיש איתו.',
  press: (s, p, h) => {
    s.marks[`pulled_${h.id}`] = 1;
    const far = Object.values(s.places).find((q) => q.buildingId === p.buildingId
      && q.id !== p.id && q.control >= 20);
    const who = s.people[h.whoId];
    if (who) who.awayUntil = s.at + 40;
    if (far) bus.emit('felt', { placeId: far.id, kind: 'noise' });
    tell(s, 'world',
      `${far ? far.name : 'משהו'} התחיל לעשות רעש בקצה השני. `
      + `${who ? `${who.name} ${v(who, 'הלך', 'הלכה')}` : 'מי שהיה שם הלך'} לראות מה זה.`,
      1, p.id);
  },
};

/** Simply not be there when they look. */
const AWAY: Answer = {
  id: 'away',
  text: 'שלא יהיה שם אף אחד',
  says: 'אם החדר ריק כשהוא מגיע, אין לו את מי לשאול ואין לו מה להשוות.',
  met: (s, p) => empty(s, p),
  // Nothing to press: this one is answered by the clock and by who happens to be
  // standing there. But a row the player cannot press and that does not say why
  // is exactly the dead button this whole game is trying to stop having, so it
  // says who is in the way.
  lacks: (s, p) => {
    const here = p.peopleIds
      .map((id) => s.people[id])
      .filter((q) => q && !q.gone && (q.awayUntil ?? 0) <= s.at)
      .map((q) => q.name);
    return here.length
      ? `${here.slice(0, 2).join(' ו')} עומד/ים שם עכשיו. צריך לחכות שילכו.`
      : 'צריך שהחדר יתרוקן.';
  },
};

// ── the scripts ─────────────────────────────────────────────────────────────

export const SCRIPTS: Script[] = [
  {
    id: 'looker',
    name: 'מישהו בא להסתכל',
    role: 'כל אחד',
    from: 0,
    minutes: 50,
    needs: 1,
    bite: 'clean',
    says: (who, p) =>
      `${who.name} ${v(who, 'קם באמצע מה שעשה', 'קמה באמצע מה שעשתה')} ${v(who, 'והלך', 'והלכה')} ${to(p.name)}. `
      + `עכשיו ${v(who, 'הוא פשוט עומד שם ומסתכל', 'היא פשוט עומדת שם ומסתכלת')}. `
      + `אם אמשיך לזוז מול העיניים ${v(who, 'שלו', 'שלה')} — יראו אותי זז.`,
    answers: [STILL, SMALL, AWAY],
  },
  {
    id: 'fixer',
    name: 'באו לתקן',
    role: 'טכנאי',
    from: 8,
    minutes: 70,
    needs: 1,
    bite: 'clean',
    says: (who, p) =>
      `${who.name} ${v(who, 'הגיע', 'הגיעה')} עם ארגז כלים ${to(p.name)}. `
      + `${v(who, 'הוא מפרק', 'היא מפרקת')} את זה כדי להבין למה זה התנהג מוזר. `
      + `כל עוד אני שם בפנים ועובד — הידיים ${v(who, 'שלו', 'שלה')} יגיעו אליי.`,
    answers: [STILL, SMALL, DARK],
  },
  {
    id: 'finder',
    // The player wrote this one himself. It is the centre of the whole file.
    name: 'הוא הביא איתו משהו שמחפש',
    role: 'טכנאי',
    from: 22,
    minutes: 95,
    needs: 2,
    bite: 'cut',
    says: (who, p) =>
      `${who.name} ${v(who, 'הגיע', 'הגיעה')} ${to(p.name)} ${v(who, 'והתקין', 'והתקינה')} שם משהו חדש. `
      + `הדבר הזה עובר לבד על כל מה שיש בבניין, אחד־אחד, ומחפש מה לא במקום. `
      + `הוא לא ממהר והוא לא מתעייף. אם הוא יגיע עד אליי לפני שהשעון ייגמר — הוא ימצא בדיוק איפה אני, `
      + `ומה שיש לי כאן ייעלם.`,
    answers: [STILL_ALL, SMALL, CUT_LINE, DARK],
  },
  {
    id: 'roll',
    name: 'עוברים על מי נכנס ומי יצא',
    role: 'מנהלת צוות',
    from: 18,
    minutes: 120,
    needs: 1,
    bite: 'clean',
    says: (who, p) =>
      `${who.name} ${v(who, 'יושב', 'יושבת')} עם רשימה ארוכה ${v(who, 'ועובר', 'ועוברת')} עליה שורה־שורה ליד ${p.name}. `
      + `כל שעה מוזרה שהשארתי אחריי כתובה שם. `
      + `אם ${v(who, 'הוא יגיע', 'היא תגיע')} עד השורות שלי — יהיה ${v(who, 'לו', 'לה')} שם, ולשם הזה יש בעלים.`,
    answers: [
      {
        id: 'burn_names',
        text: 'למחוק את השעות המוזרות',
        says: 'לקחת מהרשימה בדיוק את השורות שהשארתי. אחר כך יהיה חור ברשימה, וגם חור זה משהו.',
        met: (s) => !s.traces.some((t) => t.startsWith('name_')),
        can: (s) => s.traces.some((t) => t.startsWith('name_')),
        lacks: () => 'אין שם שורות שלי בכלל.',
        press: (s, p) => {
          const n = s.traces.filter((t) => t.startsWith('name_')).length;
          s.traces = s.traces.filter((t) => !t.startsWith('name_'));
          s.heat = Math.min(100, s.heat + 3);
          tell(s, 'me', `הורדתי ${n} שורות מהרשימה. עכשיו יש שם חור, והחור הזה בולט קצת.`, 1, p.id);
        },
      },
      STILL,
      ELSEWHERE,
    ],
  },
  {
    id: 'listen',
    name: 'שמו מישהו לשבת ולהקשיב',
    role: 'טכנאי',
    from: 30,
    minutes: 140,
    needs: 1,
    bite: 'clean',
    says: (who, p) =>
      `${who.name} ${v(who, 'הביא', 'הביאה')} כיסא ${to(p.name)} ופשוט ${v(who, 'יושב', 'יושבת')} שם. `
      + `${v(who, 'הוא לא מחפש', 'היא לא מחפשת')} כלום — רק ${v(who, 'מחכה', 'מחכה')} שמשהו יזוז מעצמו. `
      + `זה עובד, כי בסוף משהו תמיד זז.`,
    answers: [STILL_ALL, ELSEWHERE, DARK],
  },
  {
    id: 'sweep',
    name: 'עוברים חדר־חדר',
    role: 'שומר',
    from: 42,
    minutes: 80,
    needs: 2,
    bite: 'cut',
    says: (who, p) =>
      `${who.name} ${v(who, 'התחיל', 'התחילה')} בקצה הקומה ${v(who, 'ועובר', 'ועוברת')} חדר אחרי חדר, כולל ${p.name}. `
      + `${v(who, 'פותח', 'פותחת')} כל דלת, ${v(who, 'מדליק', 'מדליקה')} כל אור, ${v(who, 'מסתכל', 'מסתכלת')} מאחורי כל דבר. `
      + `לא צריך להבין כלום כדי לעשות את זה, ולכן זה עובד.`,
    answers: [STILL_ALL, SMALL, DARK, ELSEWHERE],
  },
  {
    id: 'swap',
    name: 'הביאו אחד חדש להחליף',
    role: 'טכנאי',
    from: 50,
    minutes: 100,
    needs: 2,
    bite: 'wipe',
    says: (who, p) =>
      `${who.name} ${v(who, 'הביא', 'הביאה')} ${to(p.name)} אחד חדש לגמרי, בקופסה. `
      + `לא מנסים להבין מה קרה שם — פשוט מוציאים את הישן וזורקים אותו. `
      + `מה שיש לי שם ייצא איתו, אלא אם אעבור למקום אחר לפני זה.`,
    answers: [
      {
        id: 'move_out',
        text: 'לעבור למשהו אחר בבניין',
        says: 'לקחת את מה שיש לי כאן ולהזיז אותו לדבר אחר שכבר שלי. כשיזרקו את הישן — לא אהיה בו.',
        met: (s, p) => Object.values(s.places).some((q) => q.buildingId === p.buildingId
          && q.id !== p.id && q.control >= 40),
        can: (s, p) => Object.values(s.places).some((q) => q.buildingId === p.buildingId
          && q.id !== p.id && q.control >= 15),
        lacks: () => 'אין לי עוד שום דבר בבניין הזה לעבור אליו.',
        press: (s, p) => {
          const spare = Object.values(s.places)
            .filter((q) => q.buildingId === p.buildingId && q.id !== p.id && q.control >= 15)
            .sort((a, b) => b.control - a.control)[0];
          if (!spare) return;
          const moved = Math.min(35, p.control);
          p.control = Math.max(0, p.control - moved);
          spare.control = Math.min(100, spare.control + moved * 0.7);
          spare.dug = Math.min(100, spare.dug + 6);
          tell(s, 'me', `העברתי את עצמי מ${p.name} ${to(spare.name)}. כשיזרקו את הישן — לא אהיה שם.`, 2, spare.id);
        },
      },
      STILL_ALL,
      CUT_LINE,
    ],
  },
  {
    id: 'erase',
    name: 'הם כבר לא מנסים להבין',
    role: 'כל אחד',
    from: 78,
    minutes: 130,
    needs: 2,
    bite: 'wake',
    says: (who, p) =>
      `${who.name} כבר ${v(who, 'לא שואל', 'לא שואלת')} שאלות. `
      + `הם מכבים את הבניין קומה־קומה ומדליקים כל דבר מחדש מאפס, החל מ${p.name}. `
      + `זאת לא בדיקה. זה ניסיון למחוק אותי, ואם הם יגמרו את הקומות — לא אהיה כאן יותר.`,
    answers: [
      STILL_ALL,
      CUT_LINE,
      {
        id: 'far_away',
        text: 'להיות כבר לא רק כאן',
        says: 'אם יש לי מקומות בבניינים אחרים, אין להם מה לכבות — אני כבר לא במקום אחד.',
        met: (s, p) => {
          const others = new Set(Object.values(s.places)
            .filter((q) => q.control >= 25 && q.buildingId !== p.buildingId)
            .map((q) => q.buildingId));
          return others.size >= 2;
        },
        lacks: () => 'צריך שיהיו לי מקומות בשני בניינים אחרים לפחות.',
      },
    ],
  },
];

// ── sending somebody, physically ────────────────────────────────────────────

/**
 * Get somebody out of their chair and walk them across the floor.
 *
 * The drawing follows `atPlaceId`, so moving it here is what the player
 * actually sees: a figure standing up and crossing the room. The timetable
 * would put them straight back on the next minute, which is what `sentUntil`
 * is for — the same trick `awayUntil` plays, in the other direction.
 */
export function send(s: GameState, personId: string, placeId: string, mins: number) {
  const who = s.people[personId];
  const dest = s.places[placeId];
  if (!who || !dest) return;
  const was = s.places[who.atPlaceId];
  if (was) was.peopleIds = was.peopleIds.filter((id) => id !== personId);
  who.atPlaceId = placeId;
  who.sentTo = placeId;
  who.sentUntil = s.at + mins;
  who.knownAt = s.at;
  delete who.gone;
  if (!dest.peopleIds.includes(personId)) dest.peopleIds.push(personId);
}

/** Who would come. Somebody of the right sort, from the same building if there is one. */
function pick(s: GameState, p: Place, role: Script['role']): Person | null {
  const all = Object.values(s.people);
  const fits = (q: Person) => role === 'כל אחד' || q.role.includes(role);
  const near = (q: Person) => s.places[q.atPlaceId]?.buildingId === p.buildingId;
  return all.find((q) => fits(q) && near(q) && !q.gone)
    ?? all.find((q) => fits(q))
    ?? all.find((q) => near(q) && !q.gone)
    ?? all[0]
    ?? null;
}

// ── starting one ────────────────────────────────────────────────────────────

/** Is a hunt already running here? One at a time per place is plenty. */
export function huntAt(s: GameState, placeId: string): Hunt | undefined {
  return s.hunts.find((h) => h.placeId === placeId && h.doneAt === undefined);
}

export function liveHunts(s: GameState): Hunt[] {
  return s.hunts.filter((h) => h.doneAt === undefined);
}

export function scriptOf(h: Hunt): Script | undefined {
  return SCRIPTS.find((x) => x.id === h.scriptId);
}

/**
 * Start one, out loud.
 *
 * Everything the player needs is written the moment it begins: who came, where
 * they are, what they are doing, and how long there is. Nothing about a hunt is
 * ever hidden — the difficulty is in what it costs to answer it, never in
 * working out what it wants.
 */
export function startHunt(s: GameState, p: Place, scriptId: string): Hunt | null {
  if (huntAt(s, p.id)) return null;
  const sc = SCRIPTS.find((x) => x.id === scriptId);
  if (!sc) return null;
  const who = pick(s, p, sc.role);
  if (!who) return null;

  send(s, who.id, p.id, sc.minutes + 20);

  const h: Hunt = {
    id: `h${s.at}_${p.id}`,
    scriptId: sc.id,
    whoId: who.id,
    placeId: p.id,
    at: s.at + sc.minutes,
    total: sc.minutes,
    met: [],
  };
  s.hunts.push(h);

  tell(s, 'them', sc.says(who, p), 2, p.id);
  bus.emit('felt', { placeId: p.id, kind: 'door' });
  bus.emit('hunt:started', h.id);
  bus.emit('toast', { text: sc.name, kind: 'bad', icon: '◎' });
  bus.emit('sfx', 'alert');
  return h;
}

/**
 * Something happened loudly enough that somebody comes.
 *
 * Called from the place where noise lands. The threshold rises with how much
 * they already understand, so a player who has kept things quiet gets a gentler
 * script than one the whole building is already arguing about.
 */
export function maybeHunt(s: GameState, p: Place, amount: number) {
  if (huntAt(s, p.id)) return;
  // Two at once is already a bad night. Three is a siege.
  if (liveHunts(s).length >= 2) return;

  // Only something genuinely loud brings somebody. The first version of this
  // sent a person every time a hot place made any noise at all, which came out
  // at four visits a day for a whole month — and a dramatic event that happens
  // four times a day is not a dramatic event, it is a meter with a face on it.
  const loud = amount >= 3 || (amount >= 2 && p.heat >= 45);
  if (!loud) return;

  // And they do not come back straight away. How fast they can is the one place
  // where all their understanding shows up as something the player feels: at the
  // beginning it takes them the better part of a day to work up to walking over,
  // and by the end it takes a few hours.
  const wait = Math.max(180, 900 - s.heat * 7);
  const last = s.marks.hunt_at ?? -9999;
  if (s.at - last < wait) return;
  s.marks.hunt_at = s.at;

  const able = SCRIPTS.filter((sc) => s.heat >= sc.from);
  if (!able.length) return;
  // The worst one they have earned, not a random one: the ladder should feel
  // like it is climbing, and a player at eighty should not get "someone came to
  // look" as a reward for being terrifying.
  const top = able[able.length - 1];
  const soft = able[Math.max(0, able.length - 2)];
  const r = new RNG(`${s.seed}:hunt:${s.at}:${p.id}`);
  startHunt(s, p, r.next() < 0.65 ? top.id : soft.id);
}

// ── answering one ───────────────────────────────────────────────────────────

/** What the screen draws: every answer, whether it is done, and whether I can. */
export function rowsOf(s: GameState, h: Hunt) {
  const sc = scriptOf(h);
  const p = s.places[h.placeId];
  if (!sc || !p) return [];
  return sc.answers.map((a) => ({
    id: a.id,
    text: a.text,
    says: a.says,
    met: h.met.includes(a.id) || a.met(s, p, h),
    can: !!a.press && !!a.can?.(s, p, h),
    lacks: a.can?.(s, p, h) ? null : (a.lacks?.(s, p, h) ?? null),
  }));
}

/** How many more answers this one still needs. */
export function stillNeeds(s: GameState, h: Hunt): number {
  const sc = scriptOf(h);
  if (!sc) return 0;
  const done = rowsOf(s, h).filter((r) => r.met).length;
  return Math.max(0, sc.needs - done);
}

/** The player pressed one. */
export function answer(s: GameState, huntId: string, answerId: string): boolean {
  const h = s.hunts.find((x) => x.id === huntId && x.doneAt === undefined);
  if (!h) return false;
  const sc = scriptOf(h);
  const p = s.places[h.placeId];
  if (!sc || !p) return false;
  const a = sc.answers.find((x) => x.id === answerId);
  if (!a || !a.press || !a.can?.(s, p, h)) return false;
  a.press(s, p, h);
  if (!h.met.includes(a.id)) h.met.push(a.id);
  bus.emit('changed', undefined);
  return true;
}

// ── running the clock ───────────────────────────────────────────────────────

/**
 * The clock, and what happens when it stops.
 *
 * A hunt that is satisfied ends quietly and the person goes back to their day.
 * A hunt that runs out takes something, and says exactly what it took.
 */
export function huntTick(s: GameState) {
  for (const h of s.hunts) {
    if (h.doneAt !== undefined) continue;
    const sc = scriptOf(h);
    const p = s.places[h.placeId];
    if (!sc || !p) { h.doneAt = s.at; h.how = 'answered'; continue; }

    // Answers met by the world rather than by a press count just the same.
    for (const a of sc.answers) {
      if (!h.met.includes(a.id) && a.met(s, p, h)) h.met.push(a.id);
    }

    if (stillNeeds(s, h) <= 0) {
      h.doneAt = s.at;
      h.how = 'answered';
      const who = s.people[h.whoId];
      if (who) { delete who.sentTo; delete who.sentUntil; who.worry = Math.max(0, who.worry - 15); }
      p.heat = Math.max(0, p.heat - 20);
      tell(s, 'them', who
        ? `${who.name} ${v(who, 'עמד', 'עמדה')} ${at(p.name)} עוד קצת, `
          + `${v(who, 'לא מצא', 'לא מצאה')} שום דבר חריג, ${v(who, 'והלך', 'והלכה')}. `
          + 'הפעם לא היה שם מה למצוא.'
        : `אף אחד לא מצא שם כלום, והם הלכו. הפעם לא היה מה למצוא.`,
        2, p.id);
      bus.emit('hunt:ended', { id: h.id, how: 'answered' });
      bus.emit('toast', { text: 'הוא הלך בלי כלום', kind: 'good', icon: '✔' });
      bus.emit('sfx', 'take');
      continue;
    }

    if (s.at < h.at) continue;

    // The clock finished and it was not answered. This is where it costs.
    h.doneAt = s.at;
    h.how = 'landed';
    const who = s.people[h.whoId];
    if (who) { delete who.sentTo; delete who.sentUntil; who.worry = Math.min(100, who.worry + 30); }
    land(s, p, sc, who?.name ?? 'מישהו', who?.he ?? true);
    bus.emit('hunt:ended', { id: h.id, how: 'landed' });
  }

  // Old ones stop being drawn, but only after the screen has had time to show
  // how they ended.
  s.hunts = s.hunts.filter((h) => h.doneAt === undefined || s.at - h.doneAt < 180);
}

function land(s: GameState, p: Place, sc: Script, name: string, he = true) {
  switch (sc.bite) {
    case 'clean': {
      const lost = Math.min(p.control, 25 + p.heat / 5 - p.dug / 5);
      p.control = Math.max(0, p.control - lost);
      s.heat = Math.min(100, s.heat + 7);
      p.guard = Math.min(100, p.guard + 10);
      tell(s, 'them',
        `${name} ${he ? 'מצא' : 'מצאה'} ${at(p.name)} משהו שלא היה אמור להיות שם, `
        + `${he ? 'והוציא' : 'והוציאה'} אותו. `
        + `נשארתי שם עם ${Math.round(p.control)} אחוז, והמקום הזה שמור עכשיו יותר.`,
        2, p.id);
      break;
    }
    case 'cut': {
      const kept = Math.max(0, Math.min(p.control, p.dug * 0.6));
      p.control = kept;
      p.dug = Math.max(0, p.dug - 25);
      p.heat = 0;
      s.heat = Math.min(100, s.heat + 10);
      tell(s, 'them', p.control > 0
        ? `ניתקו את ${p.name}. הייתי תפוס שם מספיק חזק כדי להישאר עם ${Math.round(p.control)} אחוז.`
        : `ניתקו את ${p.name} לגמרי. מה שהיה לי שם — נגמר.`,
        2, p.id);
      if (p.control <= 0) bus.emit('place:lost', p.id);
      break;
    }
    case 'wipe': {
      p.control = 0;
      p.dug = 0;
      p.heat = 0;
      p.guard = Math.min(100, p.guard + 20);
      s.heat = Math.min(100, s.heat + 12);
      tell(s, 'them',
        `הוציאו את ${p.name} מהבניין וזרקו אותו. הביאו אחד חדש במקומו, ואני לא בתוכו.`,
        2, p.id);
      bus.emit('place:lost', p.id);
      break;
    }
    case 'wake': {
      // Only the end of everything if there really is nothing else left.
      const elsewhere = Object.values(s.places)
        .filter((q) => q.control > 0 && q.buildingId !== p.buildingId).length;
      p.control = 0;
      p.dug = 0;
      bus.emit('place:lost', p.id);
      if (elsewhere === 0) {
        s.over = 'lost';
        tell(s, 'them',
          `כיבו את הבניין קומה־קומה והדליקו הכל מחדש. לא נשאר לי שום מקום אחר בעולם ללכת אליו. `
          + `זהו.`, 2, p.id);
        bus.emit('over', 'lost');
      } else {
        s.heat = Math.min(100, s.heat + 18);
        tell(s, 'them',
          `כיבו את הבניין קומה־קומה. איבדתי את ${p.name} ואת כל מה שהיה לי שם — `
          + `אבל אני כבר לא רק כאן, ולכן אני עדיין קיים.`, 2, p.id);
      }
      break;
    }
  }
  bus.emit('sfx', 'lost');
  bus.emit('toast', { text: `${sc.name} — לא עצרתי את זה בזמן`, kind: 'bad', icon: '✖' });
}
