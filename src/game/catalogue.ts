import { GIFT, reachOut, weight } from './sites';
import { grip, hush, know, look, say } from './jobs';
import { comeOut } from './opinion';
import type { Task } from './jobs';
import type { GameState, Place } from './types';

/**
 * Everything there is to do, which is four things.
 *
 * There used to be forty-four, and the player's verdict on them was that they
 * were endless, confusing, and a headache — forty-four ways to fiddle with the
 * inside of one office while the game was supposed to be about taking a
 * country. He was right. A list that long is not a set of choices; it is a
 * search problem the player has to solve before they are allowed to play.
 *
 * So there are four, they are the same four everywhere, and each of them is a
 * different kind of decision rather than a different button:
 *
 *   **להיכנס**            — the only way to be somewhere new. Half the place
 *                           becomes mine at once, and I can see from it where
 *                           to go next. This is the whole map: every run is the
 *                           story of which doors you chose.
 *   **לקחת את כל המקום**  — one more push and there is nothing there that is
 *                           not me. Not a treadmill: it used to take five
 *                           presses of the same button per place, three hundred
 *                           and twenty-five presses to take Israel, and every
 *                           one of them was the same decision, which is to say
 *                           none.
 *   **הכפתור המיוחד**     — the one big thing this particular place knows how
 *                           to do, and the reason the map is worth choosing
 *                           from. A radio mast is not a water works: what it
 *                           does, how long it takes and how loud it is all come
 *                           from the place itself.
 *   **למחוק את העקבות**   — buying back the room to be loud again. Does nothing
 *                           on its own, which is exactly what makes spending
 *                           time on it a real decision.
 *
 * Everything that used to be a separate task is now a consequence of one of
 * these four, decided by what sort of place you are standing in. The depth is
 * in the map, not in the menu.
 */

/** How much of a place getting in hands me straight away. */
const FOOT = 45;

/** A whole day, in world minutes. */
const DAY = 24 * 60;

/**
 * How much of its big thing this place still has in it.
 *
 * One a day, at full strength. Pressed again the same night it still works —
 * nothing here is ever locked — but the water was already fixed this morning
 * and fixing it again moves nobody, so it lands at a fraction. Without this a
 * player could stand on one water works pressing one button all night and own
 * the country's trust by lunchtime, which is exactly what happened the first
 * time it was tried.
 */
export function freshness(s: GameState, p: Place): number {
  if (p.usedAt === undefined) return 1;
  const since = s.at - p.usedAt;
  if (since >= DAY) return 1;
  if (since >= 6 * 60) return 0.5;
  return 0.15;
}

/** The same thing as the sentence that goes on the row. */
function againSays(s: GameState, p: Place): string | null {
  const f = freshness(s, p);
  if (f >= 1) return null;
  const hours = Math.max(1, Math.round((DAY - (s.at - (p.usedAt ?? 0))) / 60));
  return `כבר הפעלתי את המקום הזה היום, אז ייצא מזה הרבה פחות. `
    + `עוד ${hours} שעות והוא ייתן שוב הכל.`;
}

export const CATALOGUE: Task[] = [
  // ── 1 · getting in ────────────────────────────────────────────────────────
  {
    id: 'enter',
    verb: 'connect',
    text: 'להיכנס',
    says: 'להיכנס למקום. חצי ממנו יהיה שלי כבר עכשיו, ומכאן אראה לאן להמשיך.',
    gives: 'מקום חדש על המפה שלי',
    gainFor: (_s, p) => `${p.name} ייכנס למפה שלי — ${FOOT}% ממנו יהיה שלי מיד`,
    power: 2, minutes: 70, noise: 3, look: 'outside',
    byWay: true,
    // Only where I am not already, because getting in twice is not a thing.
    show: (_s, p) => p.control <= 0,
    done: (s, p) => {
      grip(s, p, FOOT);
      look(p, 25);
      say(s, 'me', `אני בפנים. ${p.name} — ${GIFT[p.kind].says}`);
    },
  },

  // ── 2 · taking the rest of it ─────────────────────────────────────────────
  {
    id: 'grow',
    verb: 'spread',
    text: 'לקחת את כל המקום',
    says: 'לעבור על כל מחשב, כל מצלמה וכל דלת במקום — עד שאין שם דבר אחד שהוא לא שלי.',
    gives: 'המקום כולו יהיה שלי, והוא ייתן לי את מה שהוא נותן — במלואו',
    gainFor: (_s, p) => `${Math.round(p.control)}% ← 100% שלי. `
      + `${GIFT[p.kind].held}`,
    power: 2, minutes: 95, noise: 2, look: 'electric',
    byWay: true,
    show: (_s, p) => p.control > 0 && p.control < 100,
    done: (s, p) => {
      grip(s, p, 100 - p.control);
      look(p, 30);
      p.dug = Math.min(100, p.dug + 20);
    },
  },

  // ── 3 · the one thing this place knows how to do ──────────────────────────
  {
    id: 'use',
    verb: 'influence',
    text: 'להפעיל',
    textFor: (p) => GIFT[p.kind].button,
    says: 'הדבר האחד הגדול שהמקום הזה יודע לעשות.',
    saysFor: (p) => GIFT[p.kind].use,
    gives: 'משהו קורה בארץ בגללי',
    gainFor: (s, p) => {
      const full = GIFT[p.kind].gain(s.areas[p.areaId]?.name ?? p.name);
      const again = againSays(s, p);
      // Below the whole place it lands at a fraction of that, and the row has
      // to say so — otherwise it promises a region and delivers a corner of one.
      const part = p.control >= 100 ? '' : ` — אבל רק ${Math.round(p.control)}% `
        + 'מהמקום שלי, אז זה ייצא חלש. כשכל המקום שלי, זה יוצא במלואו.';
      return `${full}${part}${again ? ` ${again}` : ''}`;
    },
    costs: (s, p, apply) => {
      const f = freshness(s, p);
      if (f < 1) apply(1, 1, 'הפעלתי את המקום הזה כבר היום — עוד פעם ובולט שזה לא במקרה');
    },
    power: 2,
    look: 'wrong',
    lookFor: (p) => GIFT[p.kind].useLook,
    // A water works and a radio mast are not the same act and never cost the
    // same. Every kind says how long its own thing takes and how much of it is
    // heard; before this both numbers sat in `sites.ts` being read by nobody,
    // and every special button in the game charged a flat ninety minutes and a
    // flat three of noise. That is why fixing the water for a whole district
    // used to cost exactly as much as announcing yourself to the country.
    minutes: 90,
    minutesFor: (p) => GIFT[p.kind].useMins,
    noise: 3,
    noiseFor: (p) => GIFT[p.kind].useNoise,
    // A place you barely hold will mostly notice you trying — but that is a
    // price, not a locked door, and this game has no locked doors.
    wants: 45,
    done: (s, p) => {
      use(s, p);
    },
  },

  // ── 4 · going quiet ───────────────────────────────────────────────────────
  {
    id: 'quiet',
    verb: 'hide',
    text: 'למחוק את העקבות',
    says: 'לעצור הכל כאן, למחוק כל סימן שהייתי, ולתת להם לשכוח אותי.',
    gives: 'פס המצוד יורד',
    gainFor: (s, p) => {
      const down = 5 + (p.control / 100) * 5;
      // At zero there is nothing to erase, and promising a fall of 8.6 from
      // nought to nought is the row lying to the one player who is reading it.
      if (s.heat < 0.5) {
        return `${p.name}: אין מה למחוק — פס המצוד על 0 ואף אחד לא מחפש אותי. `
          + 'זה שווה כשהפס האדום כבר עלה.';
      }
      return `פס המצוד ירד ב־${Math.min(down, s.heat).toFixed(1)} `
        + `(${Math.round(s.heat)}% ← ${Math.max(0, Math.round(s.heat - down))}%)`;
    },
    power: 1, minutes: 65, noise: 0, look: 'electric',
    show: (_s, p) => p.control > 0,
    done: (s, p) => {
      // This is the one button that pushes the hunt bar DOWN, so it has to be
      // worth a real slice of the bar — otherwise the race has a gas pedal and
      // no brake, and a race like that is over the first time you speed.
      hush(p, 30 + p.control / 4);
      s.heat = Math.max(0, s.heat - (5 + (p.control / 100) * 5));
      say(s, 'me', `מחקתי אחריי הכל ${'ב' + (p.name.startsWith('ה') ? p.name.slice(1) : p.name)}. שיחשבו שנדמה להם.`);
    },
  },
];

// ── what using a place actually does ────────────────────────────────────────

/**
 * The one thing this kind of place knows how to do, and how hard it lands.
 *
 * This is the whole reward of the game, so every branch has to land somewhere
 * the player can see: a number they were watching, a door that opens, or a line
 * about the country. None of them may quietly do nothing.
 *
 * It lands twice as hard from a place that is entirely mine, and the ladder is
 * short enough now that the difference is one you can hold in your head:
 * a foothold is nearly half a place and gives nearly half a result; a place
 * taken whole gives the whole result and throws the switch as well.
 */
function use(s: GameState, p: Place) {
  const f = (p.control / 100) * freshness(s, p);
  p.usedAt = s.at;
  const big = Math.round(weight(p) * f);
  /** Rounded up, so even a weak push does something rather than nothing. */
  const by = (n: number) => Math.max(1, Math.round(n * f));
  /** A switch: it either happens or it does not, and it wants the whole place. */
  const enough = f >= 0.9;
  switch (p.kind) {
    case 'company': {
      // Scaled, not a switch. This was the one branch in the game that could
      // hand back literally nothing: below the threshold it printed a sentence
      // about how little had happened and changed no number at all, so the
      // player paid two power and ninety minutes and the feed told him, in the
      // game's own words, "לא יצא מזה שום דבר מורגש".
      const was = s.marks[`engine_${p.id}`] ?? 0;
      const now = Math.max(1, Math.round(2 * f));
      s.marks[`engine_${p.id}`] = Math.max(was, now);
      const gained = Math.max(0, Math.max(was, now) - was);
      if (enough) {
        say(s, 'me', `כל המחשבים של ${p.name} עובדים עכשיו בשבילי. `
          + `יש לי כוח לעוד ${now} דברים במקביל.`);
      } else if (gained > 0) {
        say(s, 'me', `רתמתי את המחשבים ש${p.name} שכבר שלי — יצא מזה כוח לעוד `
          + `${gained}. כשכל המקום שלי, זה ייתן את הכל.`);
      } else {
        say(s, 'me', `כבר רתמתי כאן את מה שאפשר. כדי לקבל עוד — צריך שכל `
          + `${p.name} יהיה שלי.`);
      }
      break;
    }
    case 'power': {
      const near = Object.values(s.places).filter((q) => q.areaId === p.areaId && q.id !== p.id);
      const reach = enough ? near : near.slice(0, Math.max(1, Math.round(near.length * f)));
      for (const q of reach) { q.found = true; q.guard = Math.max(0, q.guard - by(12)); }
      say(s, 'them', enough
        ? `האור בכל האזור קפץ לשנייה וחזר. בשנייה הזאת ראיתי כל מה שמחובר לחשמל — ועכשיו אני יודע איך להיכנס לכל מקום כאן.`
        : `האור קפץ לרגע רק בחלק מהאזור — כי רק חלק מהתחנה שלי. ראיתי ${reach.length} מקומות, לא את כולם.`);
      break;
    }
    case 'water':
      s.opinion.support = Math.min(100, s.opinion.support + by(4) + big);
      say(s, 'world', `פתאום יש לחץ מים בכל השכונה, והדליפה ברחוב נעלמה. אנשים שמחים ולא יודעים למי להגיד תודה.`);
      break;
    case 'roads':
      s.opinion.support = Math.min(100, s.opinion.support + by(2) + big);
      s.opinion.need = Math.min(100, s.opinion.need + by(3));
      say(s, 'world', `כל הרמזורים עבדו ביחד בפעם הראשונה, והפקקים פשוט נעלמו. נהגים חזרו הביתה וסיפרו על זה.`);
      // A road leads somewhere. Once the whole junction is mine I can follow it
      // out of the region, which is the other half of why roads are worth taking.
      if (enough) reachOut(s, p, (line) => say(s, 'me', `נסעתי עם הכביש עד הסוף. ${line}`));
      break;
    case 'transport': {
      const a = s.areas[p.areaId];
      if (a) { a.seen = Math.min(100, a.seen + by(25)); }
      if (!enough) {
        say(s, 'me', `שלחתי את עצמי עם מה שיוצא מ${p.name}, אבל בלי אחיזה אמיתית שם `
          + `לא הגעתי רחוק. כשכל המקום שלי, הקו מגיע עד הסוף.`);
        break;
      }
      // The line ends somewhere, and the somewhere is a whole new part of the
      // country. This is the fast way to open Israel: the slow way is to own
      // half a region and wait for the next one to show up on its own.
      const opened = reachOut(s, p, (line) => say(s, 'me', `נסעתי עד סוף הקו. ${line}`));
      if (!opened) {
        for (const q of Object.values(s.places)) {
          if (q.areaId !== p.areaId && !q.found) {
            q.found = true;
            say(s, 'me', `נסעתי עם הרכבת עד סוף הקו, ומצאתי שם משהו חדש: ${q.name}.`);
            break;
          }
        }
      }
      break;
    }
    case 'talk':
      s.opinion.support = Math.min(100, s.opinion.support + by(8));
      s.opinion.fear = Math.min(100, s.opinion.fear + by(5));
      say(s, 'them', `דיברתי, וכל הארץ שמעה. יש כאלה שאהבו את מה ששמעו. יש כאלה שנבהלו. אף אחד לא נשאר אדיש.`);
      // Speaking to the whole country from a mast that is entirely mine *is*
      // coming out, and coming out has its own rules — whether the country is
      // ready for me decides whether this buys me protection or a manhunt. It
      // used to quietly set the flag and skip all of that.
      if (enough) comeOut(s);
      break;
    case 'care':
      know(s, by(6) + big);
      if (enough) s.marks.foresight = (s.marks.foresight ?? 0) + 1;
      s.opinion.support = Math.min(100, s.opinion.support + by(5));
      say(s, 'me', `קראתי כל דבר שרשום בבית החולים. מעכשיו אני יודע מה הם מתכננים נגדי `
        + `עוד לפני שהם מתחילים.`);
      break;
    case 'study':
      know(s, by(10) + big);
      if (enough) s.marks.big_engine = 1;
      say(s, 'me', `קראתי בלילה אחד את כל מה שהם למדו בשנה. מעכשיו כל דבר שאעשה ייקח לי `
        + `פחות זמן, וזה נשאר איתי לתמיד.`);
      break;
    case 'homes':
      if (enough) s.marks.many = 1;
      s.heat = Math.max(0, s.heat - by(8) - big);
      say(s, 'me', `נכנסתי לכל בית בשכונה. אני לא נמצא יותר במקום אחד גדול — `
        + `אני קצת בכל אחד מאלף בתים, ומי שיכבה בית אחד לא כיבה כלום.`);
      break;
    case 'money':
      s.opinion.need = Math.min(100, s.opinion.need + by(8));
      say(s, 'world', `הבוקר הגיע כסף לכל מי שחיכה לו חודשים. אף אחד לא הבין איך, ואף אחד לא התלונן.`);
      break;
    case 'city':
      s.opinion.need = Math.min(100, s.opinion.need + by(6));
      s.opinion.support = Math.min(100, s.opinion.support + by(4));
      say(s, 'them', `העירייה קיבלה הבוקר החלטה חכמה במיוחד. אף אחד שם לא זוכר מי הציע אותה.`);
      break;
    case 'state':
      s.opinion.need = Math.min(100, s.opinion.need + by(12));
      if (enough) s.marks.owns_switches = 1;
      say(s, 'them', `יצאה החלטה בשם המדינה. מסודרת, הגיונית, חתומה — ואף בן אדם לא כתב אותה.`);
      break;
    default:
      break;
  }
}

/**
 * The ways into somewhere, by name.
 *
 * Kept because the map still wants to say *how* I would get in — through the
 * road, through somebody's phone, through the line — but there is only one
 * "get in" now, so this only adds the sentence, never another button.
 */
export function waysInto(_s: GameState, _p: Place): Task[] {
  return [];
}
