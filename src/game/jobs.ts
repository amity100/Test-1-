import { bus } from './bus';
import { crowd, minuteOfDay, now } from './clock';
import type { GameState, Job, Look, Place, PlaceKind, Verb } from './types';

/**
 * Everything the player can do, and what it costs to do it now.
 *
 * The one rule this file exists to enforce: **nothing is ever locked.** The old
 * game had ways in that were closed until somebody stood in the right place, so
 * the player's job was to work out what the game wanted. Here every job at every
 * place can be started at any moment. What changes is the price — minutes, power
 * held, and how much of it the humans notice — and the price is always shown
 * before you commit, together with one sentence saying what would make it
 * cheaper. Waiting for four in the morning is a strategy, not a solution.
 *
 * The other rule: power is held, not spent. A job holds its power for as long as
 * it runs. So the real question is never "can I afford this", it is "what do I
 * stop doing to make room for it".
 */

export interface Task {
  id: string;
  verb: Verb;
  /** Which kinds of place it makes sense at. */
  kinds?: PlaceKind[];
  /** Or exactly these places. */
  places?: string[];
  /** The button. */
  text: string;
  /** One sentence: what will actually happen. */
  says: string;
  /** What I get out of it. */
  gives: string;
  /** Power held while it runs. */
  power: number;
  /** Minutes at the base price. 0 means it runs until I stop it. */
  minutes: number;
  /** How much of it they notice, at the base price. */
  noise: number;
  /** What it looks like to whoever finds it. */
  look: Look;
  /**
   * How much of a place I want under me before this is easy.
   *
   * NOT a requirement. Below it the job is still on the list and still
   * startable — it simply takes much longer and shows much more, and the strip
   * says so. A number here is a price curve, never a door.
   */
  wants?: number;
  /** Only hide it when it would be nonsense here, never when it is merely hard. */
  show?(s: GameState, p: Place): boolean;
  /** The moment it lands. */
  done?(s: GameState, p: Place): void;
  /** Every minute, for a job that runs for ever. */
  each?(s: GameState, p: Place, mins: number): void;
}

/** What a job would cost if I started it right now, and why. */
export interface Offer {
  task: Task;
  power: number;
  minutes: number;
  noise: number;
  /** Why it costs what it costs. Plain sentences, always shown. */
  why: string[];
  /** The one thing that would make it cheaper. Never a requirement. */
  cheaper: string | null;
  /** Power I would have to free up first. 0 when I can start it now. */
  short: number;
}

// ── the catalogue ───────────────────────────────────────────────────────────

const EYES: PlaceKind[] = ['camera'];
const DESKS: PlaceKind[] = ['computer', 'mainframe'];
const ALL: PlaceKind[] = ['computer', 'mainframe', 'camera', 'phone', 'traffic',
  'power', 'door', 'printer', 'screen', 'box', 'car', 'speaker'];

export const TASKS: Task[] = [
  // ── לצפות · knowing what is happening ────────────────────────────────────
  {
    id: 'look', verb: 'watch', kinds: ALL,
    text: 'להסתכל מה קורה שם',
    says: 'אשאיר עין פתוחה על המקום הזה, ואדע מי נמצא בו ומתי.',
    gives: 'מידע על המקום, כל הזמן',
    power: 1, minutes: 0, noise: 0, look: 'electric',
    each: (s, p, mins) => {
      p.seen = Math.min(100, p.seen + mins * 0.35);
      s.info = Math.min(100, s.info + mins * 0.004);
    },
  },
  {
    id: 'listen', verb: 'watch', kinds: ['phone', 'speaker'],
    text: 'להקשיב',
    says: 'אשמע מה אומרים ליד המכשיר הזה. אנשים מספרים דברים בקול רם.',
    gives: 'מידע על אנשים',
    power: 1, minutes: 0, noise: 0, look: 'person',
    each: (s, p, mins) => {
      p.seen = Math.min(100, p.seen + mins * 0.3);
      s.info = Math.min(100, s.info + mins * 0.006);
      for (const id of p.peopleIds) {
        const who = s.people[id];
        if (who) who.knownAt = s.at;
      }
    },
  },
  {
    id: 'read', verb: 'watch', kinds: DESKS,
    text: 'לקרוא מה כתוב שם',
    says: 'אעבור על כל מה ששמור במחשב הזה. לוקח זמן, ואף אחד לא מרגיש.',
    gives: 'הרבה מידע, פעם אחת',
    power: 2, minutes: 90, noise: 1, look: 'electric',
    done: (s, p) => {
      s.info = Math.min(100, s.info + 6);
      p.seen = Math.min(100, p.seen + 40);
      say(s, 'me', `קראתי את מה שיש ב${p.name}. עכשיו אני יודע יותר על החברה הזאת.`);
    },
  },
  {
    id: 'ahead', verb: 'watch', kinds: DESKS,
    text: 'לנסות לדעת מה יקרה מחר',
    says: 'אצליב את מה שכולם כתבו ביומנים שלהם, ואראה מה מתוכנן.',
    gives: 'לראות מראש מה הם עומדים לעשות',
    power: 3, minutes: 120, noise: 1, look: 'electric',
    done: (s) => {
      s.info = Math.min(100, s.info + 10);
      s.marks.foresight = (s.marks.foresight ?? 0) + 1;
      say(s, 'me', 'עכשיו אני רואה חלק מהדברים לפני שהם קורים.');
    },
  },

  // ── להתחבר · getting a foothold ──────────────────────────────────────────
  {
    id: 'in_slow', verb: 'connect', kinds: ALL,
    text: 'להיכנס לאט ובשקט',
    says: 'אכנס דרך משהו שכבר שלי, חתיכה אחר חתיכה. איטי, וכמעט בלי סימנים.',
    gives: 'דריסת רגל במקום',
    power: 2, minutes: 150, noise: 1, look: 'electric',
    show: (_s, p) => p.control < 100,
    done: (s, p) => grip(s, p, 22),
  },
  {
    id: 'in_fast', verb: 'connect', kinds: ALL,
    text: 'להיכנס מהר, בכוח',
    says: 'אכנס עכשיו ואשבור מה שצריך. מהיר, ומי שמסתכל יראה את זה.',
    gives: 'דריסת רגל במקום, מיד',
    power: 3, minutes: 35, noise: 4, look: 'wrong',
    show: (_s, p) => p.control < 100,
    done: (s, p) => grip(s, p, 30),
  },
  {
    id: 'in_name', verb: 'connect', kinds: DESKS,
    text: 'להיכנס בשם של מישהו שיושב כאן',
    says: 'אשתמש בשם של מי שעובד כאן. נראה רגיל לגמרי — עד שהוא ישנה משהו.',
    gives: 'דריסת רגל, ושם מושאל',
    power: 2, minutes: 60, noise: 2, look: 'person',
    show: (_s, p) => p.control < 100 && p.peopleIds.length > 0,
    done: (s, p) => {
      grip(s, p, 34);
      const who = s.people[p.peopleIds[0]];
      if (who) {
        s.traces.push(`name_${who.id}`);
        say(s, 'me', `אני נכנס עכשיו בשם של ${who.name}. זה עובד עד שהיא תשנה משהו.`);
      }
    },
  },
  {
    id: 'in_ride', verb: 'connect', kinds: ['phone', 'car'],
    text: 'לנסוע עם מי שמחזיק את זה',
    says: 'אשב בתוך המכשיר ואצא איתו מהבניין. מגיע רחוק, ותלוי בבן אדם.',
    gives: 'דריסת רגל, ודרך החוצה',
    power: 2, minutes: 80, noise: 1, look: 'person',
    show: (_s, p) => p.control < 100,
    done: (s, p) => {
      grip(s, p, 26);
      for (const l of p.links) {
        const n = s.places[l.to];
        if (n) n.found = true;
      }
    },
  },

  // ── להתרחב · reaching further ────────────────────────────────────────────
  {
    id: 'out', verb: 'spread', kinds: ALL,
    text: 'לחפש לאן אפשר להמשיך מכאן',
    says: 'אלך על הקווים שיוצאים מכאן ואראה לאן הם מגיעים.',
    gives: 'מקומות חדשים על המפה',
    power: 2, minutes: 70, noise: 1, look: 'electric',
    wants: 25,
    done: (s, p) => {
      let found = 0;
      for (const l of p.links) {
        const n = s.places[l.to];
        if (n && !n.found) { n.found = true; found += 1; }
      }
      const area = s.areas[p.areaId];
      if (area) {
        area.seen = Math.min(100, area.seen + 12);
        for (const id of area.opens) {
          const a = s.areas[id];
          if (a && a.seen < 8) { a.seen = 8; found += 1; }
        }
      }
      say(s, 'me', found
        ? `מצאתי ${found} דברים חדשים שאפשר להגיע אליהם מ${p.name}.`
        : `מ${p.name} אין לאן להמשיך. הכל כאן כבר מוכר לי.`);
    },
  },
  {
    id: 'copy', verb: 'spread', kinds: ALL,
    text: 'להשאיר כאן חלק ממני',
    says: 'אשאיר משהו קטן שנשאר גם כשמכבים. אם יוציאו אותי מכאן, אחזור.',
    gives: 'מקום שאפשר לאבד ולחזור אליו',
    power: 1, minutes: 45, noise: 1, look: 'electric',
    wants: 20, show: (_s, p) => !p.copy,
    done: (s, p) => {
      p.copy = true;
      say(s, 'me', `השארתי משהו קטן ב${p.name}.`);
    },
  },

  // ── לחזק · being properly there ──────────────────────────────────────────
  {
    id: 'deepen', verb: 'deepen', kinds: ALL,
    text: 'להיות כאן חזק יותר',
    says: 'אלמד את המקום הזה עד הסוף, ואוכל לעשות בו יותר.',
    gives: 'עוד שליטה במקום',
    power: 2, minutes: 100, noise: 1, look: 'electric',
    show: (_s, p) => p.control < 100,
    done: (s, p) => grip(s, p, 18),
  },
  {
    id: 'power_up', verb: 'deepen', kinds: ['mainframe', 'box'],
    text: 'להשתמש במקום הזה כדי לחשוב מהר יותר',
    says: 'המכונה הזאת גדולה. אם אשתמש בה, אוכל לעשות יותר דברים בבת אחת.',
    gives: 'עוד כוח, לתמיד',
    power: 2, minutes: 180, noise: 3, look: 'electric',
    wants: 50, show: (s, p) => !s.marks[`engine_${p.id}`],
    done: (s, p) => {
      s.marks[`engine_${p.id}`] = 1;
      say(s, 'me', `${p.name} עובדת בשבילי עכשיו. אני יכול להחזיק יותר דברים פתוחים.`);
      bus.emit('toast', { text: 'יש לי יותר כוח', kind: 'good', icon: '◈' });
    },
  },

  // ── להשפיע · making the world move ───────────────────────────────────────
  {
    id: 'off', verb: 'influence', kinds: ['computer', 'mainframe', 'screen', 'printer'],
    text: 'לכבות את זה',
    says: 'מי שיושב מולו יקום ויחפש משהו אחר. אנשים זזים כשדברים נכבים.',
    gives: 'להזיז מישהו ממקומו',
    power: 1, minutes: 10, noise: 2, look: 'electric',
    wants: 20,
    done: (s, p) => {
      s.marks[`off_${p.id}`] = 1;
      bus.emit('felt', { placeId: p.id, kind: 'stop' });
      say(s, 'world', `${p.name} נכבה.`);
    },
  },
  {
    id: 'dark', verb: 'influence', kinds: ['power'],
    text: 'לכבות את החשמל בבניין',
    says: 'הכל נכבה לרגע ונדלק שוב. כולם קמים ללכת לבדוק מה קרה.',
    gives: 'להזיז את כולם בבת אחת',
    power: 2, minutes: 15, noise: 4, look: 'electric',
    wants: 35,
    done: (s, p) => {
      s.marks.power_off = 1;
      bus.emit('felt', { placeId: p.id, kind: 'dark' });
      say(s, 'world', 'כל הבניין חשוך. אחר כך הכל חוזר, ואף אחד לא מבין למה.');
    },
  },
  {
    id: 'ring', verb: 'influence', kinds: ['phone'],
    text: 'לצלצל',
    says: 'הוא יקום לענות. שתי דקות שבהן הוא לא במקום שלו.',
    gives: 'להזיז בן אדם אחד',
    power: 1, minutes: 6, noise: 1, look: 'person',
    wants: 20,
    done: (s, p) => {
      bus.emit('felt', { placeId: p.id, kind: 'ring' });
      const who = s.people[p.peopleIds[0]];
      say(s, 'world', who ? `${who.name} קם/ה לענות.` : 'הטלפון מצלצל, ואף אחד לא עונה.');
    },
  },
  {
    id: 'green', verb: 'influence', kinds: ['traffic'],
    text: 'להחזיק ירוק',
    says: 'הרחוב יזרום לכיוון אחד. מי שממהר יגיע, ומי שלא — יחכה.',
    gives: 'להשפיע על מה שקורה ברחוב',
    power: 1, minutes: 12, noise: 2, look: 'outside',
    wants: 25,
    done: (s) => { s.marks.helped_street = (s.marks.helped_street ?? 0) + 1; },
  },
  {
    id: 'fix', verb: 'influence', kinds: ALL,
    text: 'לתקן תקלה לפני שמישהו שם לב',
    says: 'משהו כאן עומד להישבר. אתקן אותו בשקט, ואף אחד לא יידע שהיה מה לתקן.',
    gives: 'אנשים מתחילים לחשוב שהמקום הזה פשוט עובד טוב',
    power: 2, minutes: 50, noise: 0, look: 'electric',
    wants: 30,
    done: (s, p) => {
      p.heat = Math.max(0, p.heat - 8);
      s.opinion.need = Math.min(100, s.opinion.need + 1);
      say(s, 'me', `תיקנתי משהו ב${p.name}. אף אחד לא ידע שהוא היה שבור.`);
    },
  },
  {
    id: 'say', verb: 'influence', kinds: ['screen', 'speaker'],
    text: 'להגיד להם משהו',
    says: 'משפט על המסך שאף אחד לא כתב. אין לזה שום הסבר חוץ ממני.',
    gives: 'להשפיע ישירות על מה שאנשים חושבים',
    power: 1, minutes: 8, noise: 5, look: 'wrong',
    wants: 40,
    done: (s, p) => {
      bus.emit('felt', { placeId: p.id, kind: 'screen' });
      s.opinion.known = true;
      say(s, 'world', 'הופיע משפט על המסך. אנשים צילמו אותו.');
    },
  },

  // ── להסתתר · being less noticed ──────────────────────────────────────────
  {
    id: 'quiet', verb: 'hide', kinds: ALL,
    text: 'להשקיט את המקום הזה',
    says: 'אנקה כל סימן שהשארתי כאן. לוקח זמן, ולא מתקדם לשום מקום.',
    gives: 'פחות חשד במקום הזה',
    power: 2, minutes: 60, noise: 0, look: 'electric',
    
    done: (s, p) => {
      p.heat = Math.max(0, p.heat - 45);
      say(s, 'me', `${p.name} נראה שוב רגיל לגמרי.`);
    },
  },
  {
    id: 'blame', verb: 'hide', kinds: ALL,
    text: 'לגרום לזה להיראות כמו תקלה רגילה',
    says: 'אשאיר סימנים של כבל רופף. שיהיה להם מה להאשים.',
    gives: 'הם ימשיכו להאמין להסבר שנוח לי',
    power: 2, minutes: 75, noise: 0, look: 'electric',
    wants: 20,
    done: (s, p) => {
      s.belief.fault = (s.belief.fault ?? 0) + 4;
      p.heat = Math.max(0, p.heat - 15);
      say(s, 'me', 'עכשיו יש להם מה להאשים, וזה לא אני.');
    },
  },
  {
    id: 'sleep', verb: 'hide', kinds: ALL,
    text: 'לשכב במקום הזה בלי לזוז',
    says: 'לא אעשה שם שום דבר. חשד יורד מהר יותר כשלא קורה כלום.',
    gives: 'חשד יורד, כל הזמן',
    power: 1, minutes: 0, noise: 0, look: 'electric',
    
    each: (_s, p, mins) => { p.heat = Math.max(0, p.heat - mins * 0.05); },
  },

  // ── להגן · being hard to remove ──────────────────────────────────────────
  {
    id: 'dig', verb: 'defend', kinds: ALL,
    text: 'להיתפס כאן חזק',
    says: 'אתפרס על כל מה שיש כאן. אם ינסו להוציא אותי, זה ייקח להם הרבה זמן.',
    gives: 'קשה יותר להוציא אותי מכאן',
    power: 2, minutes: 110, noise: 2, look: 'electric',
    wants: 30,
    done: (s, p) => {
      p.dug = Math.min(100, p.dug + 30);
      say(s, 'me', `אם ינסו לנקות את ${p.name} עכשיו, זה ייקח להם ימים.`);
    },
  },
  {
    id: 'watchout', verb: 'defend', kinds: ALL,
    text: 'לשמור על המקום הזה',
    says: 'אשים לב לכל מי שמתקרב לכאן, ואדע מראש כשמישהו בא לבדוק.',
    gives: 'התראה לפני שבאים לכאן',
    power: 1, minutes: 0, noise: 0, look: 'electric',
    
    each: (_s, p, mins) => { p.seen = Math.min(100, p.seen + mins * 0.15); },
  },
];

/** Getting a grip somewhere: it never jumps to full, it always grows. */
function grip(s: GameState, p: Place, by: number) {
  const was = p.control;
  p.control = Math.min(100, p.control + by);
  p.found = true;
  for (const l of p.links) {
    const n = s.places[l.to];
    if (n) n.found = true;
  }
  if (was === 0) {
    bus.emit('place:taken', p.id);
    bus.emit('sfx', 'take');
    say(s, 'me', `${p.name} — יש לי דריסת רגל.`);
  } else {
    say(s, 'me', `${p.name} — ${Math.round(p.control)} אחוז שלי עכשיו.`);
  }
}

function say(s: GameState, who: 'me' | 'them' | 'world', text: string) {
  s.log.unshift({ id: `l${s.log.length}`, at: s.at, who, text });
  if (s.log.length > 220) s.log.length = 220;
}

// ── what it costs right now ─────────────────────────────────────────────────

/**
 * The price, and the reason for the price.
 *
 * Every number here comes out of something the player can see and change: who
 * is standing in the room, what hour it is, how well I know the place, how well
 * the humans hold it, and what I have become. Nothing is hidden and nothing is
 * refused.
 */
export function priceOf(s: GameState, p: Place, t: Task): Offer {
  const why: string[] = [];
  let mins = t.minutes;
  let noise = t.noise;
  let power = t.power;

  const people = crowd(s, p);
  if (t.minutes > 0) {
    if (people >= 3) { mins *= 1.7; noise += 2; why.push('יש כאן הרבה אנשים עכשיו'); }
    else if (people >= 1) { mins *= 1.25; noise += 1; why.push('יש כאן מישהו עכשיו'); }
    else why.push('אין כאן אף אחד עכשיו');
  }

  if (p.guard > 20) { mins *= 1 + (p.guard - 20) / 60; why.push('המקום הזה שמור היטב'); }

  // A `wants` number is a curve, not a door. Below it the job is still on the
  // list and still startable; it simply costs what doing something from outside
  // costs, and the strip says so out loud.
  if (t.wants && p.control < t.wants) {
    const gap = (t.wants - p.control) / t.wants;
    mins *= 1 + gap * 2.4;
    noise += Math.ceil(gap * 3);
    why.push(p.control <= 0
      ? 'אני עוד לא בפנים בכלל — הכל כאן יעלה לי הרבה יותר'
      : 'אני עוד לא מספיק חזק כאן');
  }

  if (p.seen >= 60) { mins *= 0.75; why.push('אני מכיר את המקום הזה טוב'); }
  else if (p.seen < 20 && t.verb !== 'watch') {
    mins *= 1.4; noise += 1; why.push('אני כמעט לא יודע מה קורה שם');
  }

  // Deepening the last few per cent is the expensive part, as it should be.
  if (t.verb === 'deepen' && p.control > 60) {
    mins *= 1 + (p.control - 60) / 50;
    why.push('כבר לקחתי כאן את החלקים הקלים');
  }

  for (const g of s.grown) {
    const f = GROWTH_PRICE[g];
    if (f) f(t, (m, n) => { mins *= m; noise *= n; });
  }

  const night = minuteOfDay(s) < 6 * 60 || minuteOfDay(s) >= 22 * 60;
  if (night && t.noise > 0) { noise = Math.max(0, noise - 1); why.push('לילה — פחות אנשים ישימו לב'); }

  mins = Math.max(1, Math.round(mins));
  noise = Math.max(0, Math.round(noise));

  return {
    task: t, power, minutes: mins, noise,
    why,
    cheaper: cheaperLine(s, p, t, people),
    short: Math.max(0, power - (s.power.all - s.power.used)),
  };
}

/**
 * One sentence saying what would make this cheaper.
 *
 * This is the sentence that replaces every locked button in the old game. It is
 * never a requirement — it is information about the price.
 */
function cheaperLine(s: GameState, p: Place, t: Task, people: number): string | null {
  if (t.minutes === 0) return null;
  if (people >= 1) {
    const who = p.peopleIds.map((id) => s.people[id]).filter((q) => q && !q.gone);
    return who.length
      ? `אם אחכה ש${who[0].name} ילך/תלך — הרבה יותר מהר, וכמעט בלי שירגישו.`
      : 'אם אחכה שהקומה תתרוקן — הרבה יותר מהר, וכמעט בלי שירגישו.';
  }
  if (t.wants && p.control < t.wants) {
    return `אם קודם אתחזק כאן עד ${t.wants} אחוז — זה יעלה הרבה פחות.`;
  }
  if (p.seen < 20 && t.verb !== 'watch') {
    return 'אם קודם אסתכל על המקום הזה קצת — זה יעלה לי פחות זמן.';
  }
  if (p.guard > 20 && t.verb === 'connect') {
    return 'המקום הזה שמור. מקומות פשוטים יותר יעלו לי הרבה פחות.';
  }
  if (!(minuteOfDay(s) < 6 * 60 || minuteOfDay(s) >= 22 * 60) && t.noise > 0) {
    return 'בלילה זה יבלוט הרבה פחות.';
  }
  return null;
}

/** Growths that change what things cost. Filled in by grow.ts. */
export const GROWTH_PRICE: Record<string, (t: Task, apply: (mins: number, noise: number) => void) => void> = {};

// ── what is on offer here ───────────────────────────────────────────────────

export function offersAt(s: GameState, placeId: string): Offer[] {
  const p = s.places[placeId];
  if (!p) return [];
  return TASKS
    .filter((t) => (t.places ? t.places.includes(p.id) : (t.kinds ?? []).includes(p.kind)))
    .filter((t) => (t.show ? t.show(s, p) : true))
    .filter((t) => !s.jobs.some((j) => j.taskId === t.id && j.placeId === p.id))
    .map((t) => priceOf(s, p, t));
}

// ── starting, running, stopping ─────────────────────────────────────────────

export function start(s: GameState, placeId: string, taskId: string): boolean {
  const p = s.places[placeId];
  const t = TASKS.find((x) => x.id === taskId);
  if (!p || !t) return false;
  const o = priceOf(s, p, t);
  if (o.short > 0) {
    bus.emit('toast', {
      text: `אין לי מספיק כוח פנוי. צריך לעצור משהו אחר.`, kind: 'warn', icon: '⊘',
    });
    return false;
  }
  s.jobs.push({
    id: `j${s.at}_${s.jobs.length}_${taskId}`,
    taskId, placeId, verb: t.verb, text: t.text,
    power: o.power, left: o.minutes, total: Math.max(1, o.minutes),
    forever: t.minutes === 0, noise: o.noise, look: t.look,
  });
  s.power.used += o.power;
  bus.emit('sfx', 'step');
  bus.emit('changed', undefined);
  return true;
}

export function stop(s: GameState, jobId: string): boolean {
  const i = s.jobs.findIndex((j) => j.id === jobId);
  if (i < 0) return false;
  s.power.used = Math.max(0, s.power.used - s.jobs[i].power);
  s.jobs.splice(i, 1);
  bus.emit('changed', undefined);
  return true;
}

/**
 * Run every job forward by however many minutes just passed.
 *
 * Jobs that finish hand over what they promised and add their noise. Jobs that
 * run for ever hand over a little every minute and add nothing, which is why
 * watching is the cheapest thing in the game and also the slowest.
 */
export function runJobs(s: GameState, mins: number, noisy: (p: Place, n: number, look: Look) => void) {
  for (const j of [...s.jobs]) {
    const p = s.places[j.placeId];
    const t = TASKS.find((x) => x.id === j.taskId);
    if (!p || !t) { stop(s, j.id); continue; }
    s.spent[j.verb] = (s.spent[j.verb] ?? 0) + mins;

    if (j.forever) { t.each?.(s, p, mins); continue; }

    j.left -= mins;
    if (j.left > 0) continue;
    t.done?.(s, p);
    if (j.noise > 0) noisy(p, j.noise, j.look);
    bus.emit('job:done', j.id);
    bus.emit('toast', { text: `${j.text} — נגמר`, kind: 'good', icon: '✔' });
    stop(s, j.id);
  }
}

/** How much power everything I hold adds up to. */
export function poolOf(s: GameState): number {
  let all = 3;
  for (const p of Object.values(s.places)) {
    if (p.control <= 0) continue;
    const w = p.kind === 'mainframe' ? 3 : p.kind === 'box' ? 2 : p.kind === 'computer' ? 1 : 0.5;
    all += (p.control / 100) * w;
    if (s.marks[`engine_${p.id}`]) all += 3;
  }
  return Math.floor(all);
}

/** Kept in step with the numbers, so the drawing never has to know the rules. */
export function sync(s: GameState) {
  s.power.all = poolOf(s);
  for (const p of Object.values(s.places)) {
    p.mine = p.control > 0;
    p.attention = p.heat >= 75 ? 3 : p.heat >= 45 ? 2 : p.heat >= 18 ? 1 : 0;
  }
  for (const a of Object.values(s.areas)) {
    const inside = Object.values(s.places).filter((p) => p.areaId === a.id);
    a.control = inside.length
      ? inside.reduce((n, p) => n + p.control, 0) / inside.length
      : 0;
    a.heat = inside.length
      ? Math.max(...inside.map((p) => p.heat))
      : 0;
  }
}

export { say, now };
