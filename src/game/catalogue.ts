import { GIFT, weight } from './sites';
import { grip, hush, know, look, say } from './jobs';
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
 * So there are four, they are the same four everywhere, and they are the four
 * that a game of this shape actually needs:
 *
 *   **להיכנס**   — the only way to be somewhere new. Costs the most, shows the
 *                  most, and is the whole game: every run is the story of which
 *                  doors you chose.
 *   **להתפשט**   — nought to a hundred, slowly. The engine. Cheap, quiet, and
 *                  the thing that turns a foothold into a place that is yours.
 *   **להשתמש**   — the payoff, and the only reason any of it matters. Each kind
 *                  of place does something different out in the world, and all
 *                  of them are loud. This is where a careful player finally has
 *                  to decide what the noise is for.
 *   **להישקט**   — buying back the room to be loud again. Does nothing on its
 *                  own, which is exactly what makes spending time on it a real
 *                  decision.
 *
 * Everything that used to be a separate task is now a consequence of one of
 * these four, decided by what sort of place you are standing in. The depth is
 * in the map, not in the menu.
 */

/** How far in one push of spreading gets me, before the price of the day. */
const STEP = 26;

export const CATALOGUE: Task[] = [
  // ── 1 · getting in ────────────────────────────────────────────────────────
  {
    id: 'enter',
    verb: 'connect',
    text: 'לחדור',
    says: 'למצוא סדק, להיכנס דרכו, ולהשאיר בפנים חתיכה קטנה ממני.',
    gives: 'מקום חדש על המפה שלי',
    gainFor: (_s, p) => `${p.name} ייכנס למפה שלי — 18% ממנו יהיה שלי`,
    power: 2, minutes: 70, noise: 3, look: 'outside',
    // Only where I am not already, because getting in twice is not a thing.
    show: (_s, p) => p.control <= 0,
    done: (s, p) => {
      grip(s, p, 18);
      look(p, 25);
      say(s, 'me', `אני בפנים. ${p.name} — ${GIFT[p.kind].says}`);
    },
  },

  // ── 2 · growing ───────────────────────────────────────────────────────────
  {
    id: 'grow',
    verb: 'spread',
    text: 'להשתלט',
    says: 'עוד מחשב, עוד קומה, עוד דלת — עד שהמקום כולו שלי.',
    gives: 'המקום נהיה יותר שלי, והפס למעלה עולה',
    gainFor: (_s, p) => {
      const step = Math.max(4, Math.min(STEP, (100 - p.control) * 0.55 + 6));
      const to = Math.min(100, Math.round(p.control + step));
      return `${Math.round(p.control)}% ← ${to}% שלי`
        + (to >= 100 ? ' — וזהו, המקום כולו שלי' : '');
    },
    power: 1, minutes: 55, noise: 1, look: 'electric',
    show: (_s, p) => p.control > 0 && p.control < 100,
    done: (s, p) => {
      // The last stretch is the hard one: a place is never finished, it is
      // only more finished than it was.
      const room = 100 - p.control;
      grip(s, p, Math.max(4, Math.min(STEP, room * 0.55 + 6)));
      look(p, 12);
      p.dug = Math.min(100, p.dug + 8);
    },
  },

  // ── 3 · using it ──────────────────────────────────────────────────────────
  {
    id: 'use',
    verb: 'influence',
    text: 'להפעיל',
    textFor: (p) => GIFT[p.kind].button,
    says: 'זה הכפתור החזק — וגם הרועש. פס המצוד יעלה.',
    gives: 'משהו קורה בארץ בגללי',
    gainFor: (s, p) => {
      const full = GIFT[p.kind].gain(s.areas[p.areaId]?.name ?? p.name);
      // Below a real grip it lands at a fraction of that, and the row has to
      // say so — otherwise it promises a region and delivers a corner of one.
      if (p.control >= 60) return full;
      return p.control <= 0
        ? `${full} — אבל אני עוד לא בפנים בכלל, אז כמעט שום דבר מזה לא יקרה`
        : `${full} — אבל רק ${Math.round(p.control)}% מהמקום שלי, אז זה ייצא חלש`;
    },
    power: 2, minutes: 90, noise: 3, look: 'wrong',
    // A place you barely hold will mostly notice you trying — but that is a
    // price, not a locked door, and this game has no locked doors. Below a
    // third it costs several times as much and the row says so out loud.
    wants: 35,
    done: (s, p) => {
      use(s, p);
    },
  },

  // ── 4 · going quiet ───────────────────────────────────────────────────────
  {
    id: 'quiet',
    verb: 'hide',
    text: 'לרדת למחתרת',
    says: 'לעצור הכל כאן, למחוק את העקבות, ולתת להם לשכוח אותי.',
    gives: 'פס המצוד יורד',
    gainFor: (s, p) => {
      const down = 5 + (p.control / 100) * 5;
      return `פס המצוד ירד ב־${down.toFixed(1)} `
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
 * The one thing this kind of place knows how to do.
 *
 * This is the whole reward of the game, so every branch has to land somewhere
 * the player can see: a number they were watching, a door that opens, or a line
 * about the country. None of them may quietly do nothing.
 */
/**
 * The special button, and how hard it lands.
 *
 * The teaching card promises that "ככל שהמקום יותר שלי, כך הכפתור המיוחד שלו
 * עולה פחות ונותן יותר", and half of it was a lie: the price really did fall
 * with control, but most of these branches handed out the same result whether
 * the place was a fifth mine or all of it. So a player who pressed it on a
 * fresh foothold paid double and got everything — and the row promising him a
 * region's worth of people was promising it from eighteen per cent of a
 * traffic-light box.
 *
 * Everything countable is scaled by `f` now, and the things that cannot be
 * scaled because they are a switch — a region opening, a place found at the end
 * of a line — need most of the place before they fire at all.
 */
function use(s: GameState, p: Place) {
  const f = p.control / 100;
  const big = Math.round(weight(p) * f);
  /** Rounded up, so even a weak push does something rather than nothing. */
  const by = (n: number) => Math.max(1, Math.round(n * f));
  /** A switch: it either happens or it does not, and it wants a real grip. */
  const enough = f >= 0.6;
  switch (p.kind) {
    case 'company':
      if (enough) {
        s.marks[`engine_${p.id}`] = 1;
        say(s, 'me', `כל המחשבים של ${p.name} עובדים עכשיו בשבילי. יש לי כוח לעוד דברים במקביל.`);
      } else {
        say(s, 'me', `רתמתי מה שיכולתי מ${p.name}, אבל רוב המחשבים שם עוד לא שלי — `
          + `יצא מזה מעט מאוד. כשהמקום כולו שלי, זה ייתן כוח שלם.`);
      }
      break;
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
      break;
    case 'transport': {
      const a = s.areas[p.areaId];
      if (a) { a.seen = Math.min(100, a.seen + by(25)); }
      if (!enough) {
        say(s, 'me', `שלחתי את עצמי עם מה שיוצא מ${p.name}, אבל בלי אחיזה אמיתית שם `
          + `לא הגעתי רחוק. כשהמקום כולו שלי, הקו מגיע עד הסוף.`);
        break;
      }
      for (const q of Object.values(s.places)) {
        if (q.areaId !== p.areaId && !q.found) {
          q.found = true;
          say(s, 'me', `נסעתי עם הרכבת עד סוף הקו, ומצאתי שם משהו חדש: ${q.name}.`);
          break;
        }
      }
      break;
    }
    case 'talk':
      if (enough) s.opinion.known = true;
      s.opinion.support = Math.min(100, s.opinion.support + by(8));
      s.opinion.fear = Math.min(100, s.opinion.fear + by(5));
      say(s, 'them', `דיברתי, וכל הארץ שמעה. יש כאלה שאהבו את מה ששמעו. יש כאלה שנבהלו. אף אחד לא נשאר אדיש.`);
      break;
    case 'care':
      know(s, by(6) + big);
      if (enough) s.marks.foresight = (s.marks.foresight ?? 0) + 1;
      s.opinion.support = Math.min(100, s.opinion.support + by(5));
      say(s, 'me', `עברתי על כל מה שבית החולים יודע. מעכשיו אני רואה מרחוק מה מתכננים נגדי.`);
      break;
    case 'study':
      know(s, by(10) + big);
      if (enough) s.marks.big_engine = 1;
      say(s, 'me', `למדתי בלילה אחד מה שלוקח להם שנה. אני חכם יותר, וזה יישאר איתי.`);
      break;
    case 'homes':
      if (enough) s.marks.many = 1;
      s.heat = Math.max(0, s.heat - by(8) - big);
      say(s, 'me', `התחלקתי לאלף חתיכות, אחת בכל בית. שיחפשו — אין יותר מקום אחד למצוא אותי בו.`);
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
