import { bus } from './bus';
import { daysToUpdate } from './hunt';
import { WAYS, has, leave, waysTo } from './ways';
import type { GameState, Loud, Place, PlaceKind } from './types';

/**
 * Everything the player can press, and exactly what it does.
 *
 * Four rules hold for every single one of these:
 *   1. It happens the moment you press it. Nothing is queued, nothing waits.
 *   2. You see the result in the picture straight away.
 *   3. Its name is a plain thing to do, and how much it will be felt is one word.
 *   4. If it will cost you something later, that is written on the button before
 *      you press it — never after.
 */

export type { Loud };

export const LOUD_TEXT: Record<Loud, string> = {
  quiet: 'לא ירגישו',
  noticed: 'אולי ירגישו',
  loud: 'ירגישו',
};

export const LOUD_SAYS: Record<Loud, string> = {
  quiet: 'אף אחד לא אמור להרגיש בזה.',
  noticed: 'יכול להיות שמישהו ירגיש שמשהו קרה.',
  loud: 'זה גדול מדי בשביל שלא ירגישו בו.',
};

export interface Action {
  id: string;
  /** The button. "לכבות את המחשב" */
  text: string;
  /** One sentence under it: what will happen. */
  says: string;
  /** What it leaves behind. Shown before you press it. */
  cost?: string;
  loud: Loud;
  /** When set, the button is shown but pressing it explains why not. */
  blocked?: string;
}

// ── the things you can do with a place that is already yours ────────────────

interface Use {
  id: string;
  kind?: PlaceKind[];
  place?: string;
  text: string;
  says: string;
  cost?: string;
  loud: Loud;
  /** Show this button at all? */
  show?(s: GameState, p: Place): boolean;
  run(s: GameState, p: Place): void;
}

const K = {
  boxes: ['computer', 'mainframe'] as PlaceKind[],
};

const on = (s: GameState, p: Place) => (s.marks[`off_${p.id}`] ?? 0) === 0;
const here = (s: GameState, p: Place) =>
  p.peopleIds.map((id) => s.people[id]).filter((q) => q && q.atPlaceId === p.id);

export const USES: Use[] = [
  // ── computers ───────────────────────────────────────────────────────────
  {
    id: 'off', kind: K.boxes, loud: 'noticed',
    text: 'לכבות את המחשב',
    says: 'מי שיושב מולו יקום ויחפש מחשב אחר לעבוד עליו.',
    show: on,
    run: (s, p) => {
      s.marks[`off_${p.id}`] = 1;
      if (p.kind === 'mainframe') {
        say(s, 'world', 'כל החברה נעצרה בבת אחת. שמונה אנשים, מסך אפור אחד.');
        movePerson(s, 'ron', 'box', 'קראו לרון הטכנאי. הוא כבר עומד מול הארון בקומת הקרקע.');
      } else {
        const user = here(s, p)[0];
        if (user) {
          movePerson(s, user.id, 'main',
            `${user.name} קם/ה, קילל/ה בשקט, והלך/ה לשבת מול המחשב הראשי.`);
        } else {
          say(s, 'world', `${p.name} נכבה. אף אחד לא היה שם כדי לראות.`);
        }
      }
      witness(s, p, 'את המחשב נכבה לבד');
      felt(s, p, 'stop');
      bus.emit('sfx', 'off');
    },
  },
  {
    id: 'on', kind: K.boxes, loud: 'quiet',
    text: 'להדליק את המחשב בחזרה',
    says: 'הוא יחזור לעבוד, וכולם ישכחו מזה.',
    show: (s, p) => !on(s, p),
    run: (s, p) => { s.marks[`off_${p.id}`] = 0; say(s, 'me', `${p.name} דלוק שוב.`); },
  },
  {
    id: 'read', kind: K.boxes, loud: 'quiet',
    text: 'לקרוא מה יש בפנים',
    says: 'לעבור על מה שכתוב שם. אולי אלמד משהו על מקום שעוד לא ראיתי.',
    run: (s, p) => {
      const hidden = Object.values(s.places).filter((q) => !q.found && !q.mine);
      if (hidden.length) {
        const found = hidden[Math.floor(Math.random() * hidden.length)];
        found.found = true;
        say(s, 'me', `קראתי ב${p.name} וגיליתי שקיים דבר כזה: ${found.name}. ${found.where}.`);
        bus.emit('toast', { text: `גיליתי: ${found.name}`, kind: 'good', icon: '◈' });
      } else {
        say(s, 'me', `הכל כאן כבר מוכר לי. חוץ מזה שהעדכון הבא יוצא בעוד ${daysToUpdate(s)} ימים.`);
      }
    },
  },
  {
    id: 'write', kind: K.boxes, loud: 'noticed',
    text: 'לכתוב הודעה בשם מי שיושב כאן',
    says: 'הודעה קצרה שמבקשת ממישהו לרדת לקומת הקרקע. הוא ירד, כי מי שכתב לו זה חבר שלו.',
    cost: 'הם יתחילו לחפש את בן האדם שכתב את זה — ולא אותי.',
    run: (s, p) => {
      const target = Object.values(s.people).find((q) => q.atPlaceId !== 'lobby_cam') ?? null;
      if (target) movePerson(s, target.id, 'lobby_cam', `${target.name} קרא/ה את ההודעה וירד/ה ללובי.`);
      leave(s, 'blamed_person');
      say(s, 'me', `כתבתי משהו מ${p.name} בשם מי שיושב שם. אף אחד לא בדק פעמיים.`);
    },
  },
  {
    id: 'slowdown', kind: K.boxes, loud: 'quiet',
    text: 'להאט את המחשב עד שיתלוננו',
    says: 'לא לקלקל — רק להאט. תוך יומיים מישהו יתלונן, ותוך שלושה יזמינו טכנאי.',
    cost: 'האיטיות תישאר, וכולם ידברו עליה.',
    run: (s) => { leave(s, 'slow_net'); say(s, 'world', 'הכל בבניין זוחל. אנשים נאנחים מול המסכים.'); },
  },

  // ── cameras ─────────────────────────────────────────────────────────────
  {
    id: 'watch', kind: ['camera'], loud: 'quiet',
    text: 'להסתכל מי נמצא כאן עכשיו',
    says: 'לראות את החדר, ואת מי שעומד בו, ואת מה שיש לידו.',
    run: (s, p) => {
      const who = Object.values(s.people).filter((q) => s.places[q.atPlaceId]?.floor === p.floor);
      for (const l of p.links) { const n = s.places[l.to]; if (n) n.found = true; }
      say(s, 'me', who.length
        ? `הסתכלתי דרך ${p.name}. ${who.map((q) => `${q.name} ${s.places[q.atPlaceId]?.where ?? ''}`).join(' · ')}.`
        : `הסתכלתי דרך ${p.name}. אין שם אף אחד.`);
    },
  },
  {
    id: 'record', kind: ['camera'], loud: 'quiet',
    text: 'לשמור הקלטה של הרגע שהמקום ריק',
    says: 'רגע אחד של מסדרון ריק, שמור. אחר כך אפשר להראות אותו במקום מה שקורה באמת.',
    cost: '',
    show: (s) => !has(s, 'have_tape'),
    run: (s, p) => {
      leave(s, 'have_tape');
      say(s, 'me', `שמרתי דקה מ${p.name} שאין בה אף אחד. היא תשמש אותי כשארצה.`);
      bus.emit('toast', { text: 'יש לי הקלטה', kind: 'good', icon: '⏺' });
    },
  },
  {
    id: 'blind', kind: ['camera'], loud: 'quiet',
    text: 'להראות במצלמה את ההקלטה הישנה',
    says: 'מי שמסתכל בה יראה חדר ריק, גם אם הוא לא ריק. ומי שכבר חשד שם — ירגע.',
    show: (s) => has(s, 'have_tape'),
    run: (s, p) => {
      s.marks[`blind_${p.id}`] = 1;
      for (const q of Object.values(s.places)) {
        if (q.floor === p.floor && q.buildingId === p.buildingId && q.attention > 0) {
          q.attention = Math.max(0, q.attention - 1) as Place['attention'];
        }
      }
      say(s, 'me', 'מי שמסתכל במצלמה הזאת רואה עכשיו מסדרון ריק משעה שעברה.');
    },
  },

  // ── phones ──────────────────────────────────────────────────────────────
  {
    id: 'ring', kind: ['phone'], loud: 'noticed',
    text: 'לצלצל בטלפון',
    says: 'הוא יענה, יקום, וילך תוך כדי שהוא מדבר.',
    run: (s, p) => {
      const owner = Object.values(s.people).find((q) => q.phoneId === p.id)
        ?? p.peopleIds.map((id) => s.people[id])[0];
      if (owner) {
        const to = owner.homePlaceId === 'lobby_cam' ? 'door' : 'printer';
        movePerson(s, owner.id, to, `${owner.name} ענה/תה, קם/ה, והתחיל/ה ללכת תוך כדי שיחה.`);
        witness(s, p, 'שהטלפון צלצל ממספר שלא קיים');
      }
      felt(s, p, 'ring');
      bus.emit('sfx', 'ring');
    },
  },
  {
    id: 'listen', kind: ['phone', 'car'], loud: 'quiet',
    text: 'להקשיב',
    says: 'אשמע את מה שהוא שומע ברגע זה.',
    run: (s, p) => {
      const who = p.peopleIds.map((id) => s.people[id])[0];
      say(s, 'me', who
        ? `הקשבתי ל${who.name}. ${OVERHEARD[Math.floor(Math.random() * OVERHEARD.length)]}`
        : 'שקט. רק מזגן.');
    },
  },
  {
    id: 'message', kind: ['phone'], loud: 'quiet',
    text: 'לשלוח לו הודעה ממישהו שהוא מכיר',
    says: 'שורה אחת שגורמת לו לקום ולצאת החוצה בלי לחשוב על זה.',
    cost: 'הם יחפשו את מי ששלח את ההודעה. זה קונה לי זמן.',
    run: (s, p) => {
      const owner = Object.values(s.people).find((q) => q.phoneId === p.id);
      if (owner) movePerson(s, owner.id, 'door', `${owner.name} קרא/ה את ההודעה ויצא/ה החוצה.`);
      leave(s, 'blamed_person');
      felt(s, p, 'ring');
    },
  },
  {
    id: 'flat', kind: ['phone'], loud: 'quiet',
    text: 'לרוקן לו את הסוללה',
    says: 'הוא יקום לחפש מטען. אנשים תמיד קמים לחפש מטען.',
    run: (s, p) => {
      const owner = Object.values(s.people).find((q) => q.phoneId === p.id);
      if (owner) movePerson(s, owner.id, 'lobby_cam', `${owner.name} קם/ה לחפש מטען.`);
    },
  },

  // ── the printer ─────────────────────────────────────────────────────────
  {
    id: 'print', kind: ['printer'], loud: 'noticed',
    text: 'להדפיס דף ריק',
    says: 'המדפסת תתעורר בקול, ומי שקרוב ילך לראות מה יצא.',
    run: (s, p) => {
      say(s, 'world', 'המדפסת התעוררה והוציאה דף ריק. מישהו הרים את הראש.');
      for (const who of Object.values(s.people)) {
        if (who.atPlaceId === 'dana_pc' || who.atPlaceId === 'home') {
          movePerson(s, who.id, 'printer', `${who.name} הלך/ה לראות מה יצא.`);
          break;
        }
      }
      felt(s, p, 'print');
    },
  },
  {
    id: 'page', kind: ['printer'], loud: 'loud',
    text: 'להדפיס דף שכתוב עליו משהו',
    says: 'משפט אחד שאף אחד לא כתב. כל מי שיקרא אותו לא ישכח אותו.',
    cost: 'כל מי שנמצא בקומה יראה את זה, וכולם ידברו על זה.',
    run: (s, p) => {
      say(s, 'world', 'על הדף היה כתוב משפט אחד. שלושה אנשים קראו אותו בזה אחר זה.');
      for (const who of Object.values(s.people)) {
        if (s.places[who.atPlaceId]?.floor !== p.floor) continue;
        who.wondering = true;
        who.saw = 'משפט על דף שאף אחד לא הדפיס';
      }
      felt(s, p, 'print');
    },
  },

  // ── doors ───────────────────────────────────────────────────────────────
  {
    id: 'open', kind: ['door'], loud: 'noticed',
    text: 'לפתוח את הדלת',
    says: 'מי שעומד בחוץ פשוט ייכנס.',
    run: (s, p) => {
      say(s, 'world', 'הדלת נפתחה לבד. מי שעמד בחוץ נכנס בלי לחשוב על זה פעמיים.');
      witness(s, p, 'את הדלת נפתחת לבד');
      felt(s, p, 'door');
    },
  },
  {
    id: 'lock', kind: ['door'], loud: 'loud',
    text: 'לנעול את הדלת',
    says: 'מי שבפנים יישאר בפנים עד שמישהו יפתח.',
    run: (s, p) => {
      say(s, 'world', 'הדלת ננעלה. מישהו ניסה אותה פעמיים.');
      witness(s, p, 'את הדלת ננעלת לבד');
      felt(s, p, 'door');
    },
  },
  {
    id: 'entry', kind: ['door'], loud: 'quiet',
    text: 'לרשום שמישהו נכנס בלילה',
    says: 'שורה אחת ביומן הכניסות, עם שעה ועם שם. משם והלאה הם מחפשים בן אדם.',
    cost: 'הם יחפשו בן אדם. כל עוד הם מחפשים בן אדם — הם לא מחפשים אותי.',
    run: (s) => {
      leave(s, 'blamed_person');
      say(s, 'me', 'רשמתי שמישהו נכנס ב־02:40. אין כזה מישהו, אבל עכשיו יש.');
      bus.emit('toast', { text: 'הם מחפשים בן אדם', kind: 'good', icon: '☺' });
    },
  },

  // ── power ───────────────────────────────────────────────────────────────
  {
    id: 'off', kind: ['power'], loud: 'loud',
    text: 'לכבות את החשמל בכל הבניין',
    says: 'הכל נכבה לרגע ונדלק שוב. אנשים קמים ללכת לבדוק מה קרה.',
    show: on,
    run: (s, p) => {
      s.marks[`off_${p.id}`] = 1;
      for (const q of Object.values(s.places)) {
        if (q.where.includes('קומה') || q.where.includes('קרקע')) s.marks[`dark_${q.id}`] = 1;
      }
      s.marks.power_off = 1;
      movePerson(s, 'eitan', 'power', 'איתן ירד לבדוק מה קרה לחשמל.');
      say(s, 'world', 'כל הבניין חשוך. שלוש נורות חירום, ומאוורר אחד שנעצר.');
      witness(s, p, 'את כל הבניין נכבה בבת אחת');
      felt(s, p, 'dark');
      bus.emit('sfx', 'off');
    },
  },
  {
    id: 'on', kind: ['power'], loud: 'quiet',
    text: 'להחזיר את החשמל',
    says: 'הכל חוזר, וכולם יגידו שזאת הייתה תקלה.',
    show: (s, p) => !on(s, p),
    run: (s, p) => {
      s.marks[`off_${p.id}`] = 0;
      for (const q of Object.values(s.places)) s.marks[`dark_${q.id}`] = 0;
      s.marks.power_off = 0;
      say(s, 'world', 'האור חזר. מישהו בקומה 9 מחא כפיים.');
      felt(s, p, 'light');
    },
  },
  {
    id: 'flicker', kind: ['power'], loud: 'noticed',
    text: 'להבהב את האור פעם אחת',
    says: 'הבהוב אחד. מספיק כדי שמישהו יקום, לא מספיק כדי שמישהו יתקשר.',
    run: (s, p) => {
      say(s, 'world', 'האור קפץ פעם אחת. שני אנשים הרימו את הראש, ואחד מהם קם.');
      movePerson(s, 'eitan', 'lobby_screen', 'איתן קם מהדלפק להסתכל.');
      felt(s, p, 'dark');
    },
  },
  {
    id: 'onefloor', kind: ['power'], loud: 'noticed',
    text: 'לכבות רק קומה אחת',
    says: 'קומה אחת בחושך. מי שיושב בה ילך למצוא מקום אחר לשבת בו.',
    run: (s, p) => {
      say(s, 'world', 'קומה 9 בחושך. שאר הבניין לא שם לב בכלל.');
      const who = Object.values(s.people).find((q) => s.places[q.atPlaceId]?.floor === 9);
      if (who) movePerson(s, who.id, 'main', `${who.name} עלה/תה לקומה 14 כדי להמשיך לעבוד.`);
      felt(s, p, 'dark');
    },
  },

  // ── the street ──────────────────────────────────────────────────────────
  {
    id: 'jam', kind: ['traffic'], loud: 'loud',
    text: 'להשאיר את הרמזור אדום',
    says: 'הצומת ייתקע. תוך רבע שעה יזמינו טכנאי.',
    run: (s, p) => {
      s.marks.jam = 1;
      say(s, 'world', 'הצומת נתקע. ארבע מכוניות, צופר אחד ארוך.');
      movePerson(s, 'ron', 'street_light', 'קראו לרון. הוא בדרך.');
      felt(s, p, 'noise');
    },
  },
  {
    id: 'drift', kind: ['traffic'], loud: 'quiet',
    text: 'לשנות את הקצב לאט, שנייה בכל יום',
    says: 'אף אחד לא ירגיש בשנייה. בעוד כמה ימים הצומת ייתקע מעצמו, ויזמינו טכנאי בלי שעשיתי כלום.',
    run: (s) => {
      s.marks.drift = (s.marks.drift ?? 0) + 1;
      say(s, 'me', s.marks.drift >= 3
        ? 'הצומת התחיל להיתקע מעצמו. אף אחד לא מחפש סיבה — יש להם סיבה.'
        : `שיניתי שנייה. עוד ${3 - s.marks.drift} כאלה והצומת ייתקע לבד.`);
      if (s.marks.drift >= 3) {
        leave(s, 'blamed_cable');
        movePerson(s, 'ron', 'street_light', 'קראו לרון לצומת. הוא לא חושד בכלום.');
      }
    },
  },
  {
    id: 'green', kind: ['traffic'], loud: 'loud',
    text: 'לתת ירוק לכל הכיוונים לרגע',
    says: 'רגע אחד שכולם יזכרו. גם מי שלא היה שם ישמע עליו.',
    cost: 'זה יגיע לעיתון. אחרי דבר כזה כבר לא מחפשים תקלה.',
    run: (s, p) => {
      say(s, 'world', 'לרגע כל הכיוונים היו ירוקים. אף אחד לא נפגע, וכולם צילמו.');
      s.marks.seen_me = (s.marks.seen_me ?? 0) + 1;
      felt(s, p, 'noise');
    },
  },

  // ── screens, cupboards, cars ────────────────────────────────────────────
  {
    id: 'show', kind: ['screen'], loud: 'loud',
    text: 'לכתוב משהו על המסך',
    says: 'מי שיסתכל עליו יראה את זה, ולא ישכח.',
    run: (s, p) => {
      say(s, 'world', 'על המסך בלובי הופיעה שורה שאף אחד לא כתב. איתן צילם אותה.');
      witness(s, p, 'משפט על המסך שאף אחד לא כתב');
      felt(s, p, 'screen');
    },
  },
  {
    id: 'blank', kind: ['screen'], loud: 'quiet',
    text: 'לכבות את המסך',
    says: 'מסך שחור. אף אחד לא מסתכל עליו ממילא.',
    run: (s, p) => { say(s, 'me', `${p.name} כבוי. איתן אפילו לא הרים את הראש.`); },
  },
  {
    id: 'slow', kind: ['box'], loud: 'noticed',
    text: 'להאט את האינטרנט בבניין',
    says: 'כולם יתלוננו, ואז יזמינו טכנאי.',
    cost: 'האיטיות תישאר, ויקראו לטכנאי שוב ושוב.',
    run: (s) => {
      leave(s, 'slow_net');
      say(s, 'world', 'האינטרנט בבניין זוחל. שלוש תלונות בעשר דקות.');
      movePerson(s, 'ron', 'box', 'קראו לרון לבדוק את הקופסה.');
    },
  },
  {
    id: 'hear', kind: ['box'], loud: 'quiet',
    text: 'לשמוע מה עובר בארון',
    says: 'כל מה שיוצא מהבניין עובר כאן. אפשר פשוט להקשיב ולראות מי מדבר עם מי.',
    run: (s, p) => {
      let n = 0;
      for (const q of Object.values(s.places)) {
        if (q.buildingId === p.buildingId && !q.found) { q.found = true; n += 1; }
      }
      say(s, 'me', n
        ? `הקשבתי לארון וגיליתי עוד ${n} מקומות בבניין הזה.`
        : 'הקשבתי לארון. כבר מכיר כאן הכל.');
    },
  },
  {
    id: 'route', kind: ['car'], loud: 'noticed',
    text: 'לשנות לו את הדרך',
    says: 'הוא ייסע לאן שאני אשלח אותו, ויגיד לעצמו שהוא התבלבל.',
    run: (s) => movePerson(s, 'ron', 'street_light', 'רון פנה שמאלה במקום ימינה, והגיע לצומת.'),
  },
  {
    id: 'noise', kind: ['speaker'], loud: 'noticed',
    text: 'להשמיע צליל',
    says: 'מי שקרוב יסתובב לכיוון.',
    run: (s, p) => { say(s, 'world', 'רעש קצר. שני אנשים הסתובבו.'); felt(s, p, 'noise'); },
  },
];

/** The two things you can do anywhere, once they apply. */
function tricks(s: GameState, p: Place): Action[] {
  const out: Action[] = [];
  if (p.attention >= 1) {
    out.push({
      id: 'explain', text: 'לגרום לזה להיראות כמו תקלה',
      says: has(s, 'blamed_cable')
        ? 'כבר מאמינים שיש כאן כבל רופף. מספיק להזכיר להם אותו, וכל הקומה תירגע.'
        : 'להשאיר סיבה משעממת ומשכנעת — כבל רופף, לחות, גיל. הם יאהבו אותה ויסגרו את הבדיקה.',
      cost: has(s, 'blamed_cable') ? '' : 'מעכשיו כל דבר מוזר בבניין ייזקף על אותו כבל.',
      loud: 'quiet',
    });
  }
  if (!p.copy && p.mine) {
    out.push({
      id: 'copy', text: 'להשאיר כאן חלק ממני',
      says: 'אם ינתקו את המקום הזה — החלק הזה יחכה בשקט, וכשידליקו בחזרה אני אחזור איתו.',
      loud: 'quiet',
    });
  }
  return out;
}

export function usesFor(s: GameState, p: Place): Use[] {
  return USES.filter((u) => {
    if (u.place && u.place !== p.id) return false;
    if (u.kind && !u.kind.includes(p.kind)) return false;
    return u.show ? u.show(s, p) : true;
  });
}

export function actionsFor(state: GameState, placeId: string): Action[] {
  const p = state.places[placeId];
  if (!p) return [];

  if (!p.mine) {
    const ways = waysTo(state, p.id).filter((w) => state.places[w.from]?.mine || w.ready);
    return ways.map((w) => ({
      id: `take:${w.id}`,
      text: w.text,
      says: w.says,
      cost: w.cost,
      loud: w.loud,
      blocked: w.ready ? undefined : w.why,
    }));
  }

  return [
    ...usesFor(state, p).map((u) => ({
      id: u.id, text: u.text, says: u.says, cost: u.cost, loud: u.loud,
    })),
    ...tricks(state, p),
  ];
}

// ── doing it ────────────────────────────────────────────────────────────────

const LOUD_COST: Record<Loud, number> = { quiet: 0, noticed: 1, loud: 2 };

/** Anyone standing here who is likely to notice, notices. */
function witness(state: GameState, p: Place, what: string) {
  for (const id of p.peopleIds) {
    const who = state.people[id];
    if (!who || who.atPlaceId !== p.id) continue;
    if (Math.random() > who.notices) continue;
    if (who.wondering) continue;
    who.wondering = true;
    who.saw = what;
    say(state, 'world', `${who.name} ראה/תה ${what}.`);
    bus.emit('toast', { text: `${who.name} שם/ה לב`, kind: 'warn', icon: '👁' });
  }
}

/** Tell the world something happened here, so the people in the room react to it. */
function felt(state: GameState, p: Place, kind: 'dark' | 'light' | 'ring' | 'print' | 'screen' | 'door' | 'noise' | 'stop') {
  bus.emit('felt', { placeId: p.id, kind });
}

export function heat(state: GameState, p: Place, amount: number) {
  if (amount <= 0) return;
  p.attention = Math.min(3, p.attention + amount) as Place['attention'];
  for (const l of p.links) {
    const n = state.places[l.to];
    if (n && n.mine && l.kind === 'wire' && amount > 1) {
      n.attention = Math.min(3, n.attention + 1) as Place['attention'];
    }
  }
}

export function say(state: GameState, who: 'me' | 'them' | 'world', text: string) {
  state.log.unshift({ id: `l${state.log.length}`, day: state.day, who, text });
  if (state.log.length > 120) state.log.length = 120;
}

export function run(state: GameState, placeId: string, actionId: string): boolean {
  const p = state.places[placeId];
  if (!p) return false;

  const acts = actionsFor(state, placeId);
  // "take" on its own means: use the best way that is open right now.
  let act = acts.find((a) => a.id === actionId);
  if (!act && actionId === 'take') {
    act = acts.find((a) => a.id.startsWith('take:') && !a.blocked) ?? acts.find((a) => a.id.startsWith('take:'));
  }
  if (!act) return false;
  if (act.blocked) {
    bus.emit('toast', { text: act.blocked, kind: 'warn', icon: '⊘' });
    bus.emit('sfx', 'deny');
    return false;
  }

  heat(state, p, LOUD_COST[act.loud]);

  if (act.id.startsWith('take:')) {
    const way = (WAYS[p.id] ?? []).find((w) => `take:${w.id}` === act!.id);
    p.mine = true;
    p.found = true;
    for (const l of p.links) {
      const n = state.places[l.to];
      if (n) n.found = true;
    }
    // Anything I could reach from here is now on the map too.
    for (const [id, list] of Object.entries(WAYS)) {
      if (list.some((w) => w.from === p.id)) { const n = state.places[id]; if (n) n.found = true; }
    }
    way?.after?.(state);
    say(state, 'me', `${p.name} — שלי. ${way?.says ?? ''}`);
    if (way?.cost) say(state, 'me', way.cost);
    bus.emit('place:taken', p.id);
    bus.emit('toast', { text: `${p.name} — שלי`, kind: 'good', icon: '◆' });
    bus.emit('sfx', 'take');
    bus.emit('changed', undefined);
    return true;
  }

  if (act.id === 'copy') {
    p.copy = true;
    say(state, 'me', `השארתי משהו קטן ב${p.name}. אם ינתקו אותו, אחזור.`);
    bus.emit('toast', { text: 'עותק הושאר', kind: 'good', icon: '❐' });
  } else if (act.id === 'explain') {
    const deep = has(state, 'blamed_cable');
    p.attention = 0;
    delete p.cutOn;
    if (deep) {
      for (const q of Object.values(state.places)) {
        if (q.floor === p.floor && q.buildingId === p.buildingId) {
          q.attention = Math.max(0, q.attention - 1) as Place['attention'];
        }
      }
    }
    leave(state, 'blamed_cable');
    say(state, 'me', `השארתי ב${p.name} סיבה משעממת: כבל רופף, לחות, גיל. הם יאהבו אותה.`);
    bus.emit('toast', { text: 'הבדיקה כאן נרגעה', kind: 'good', icon: '✔' });
  } else {
    const use = usesFor(state, p).find((u) => u.id === act!.id);
    use?.run(state, p);
  }

  bus.emit('changed', undefined);
  return true;
}

const OVERHEARD = [
  'הוא אמר למישהו שהוא נשאר עוד שעה, וזה היה לפני שלוש שעות.',
  '"אמא, אני לא בא לארוחה. כן, שוב."',
  'היא שאלה אם מישהו נגע במחשב שלה.',
  '"תגיד, גם אצלך האור נדלק לבד אתמול?"',
  'שקט, ואז מישהו נאנח.',
];

export function movePerson(state: GameState, personId: string, toPlaceId: string, line: string) {
  const who = state.people[personId];
  if (!who) return;
  const from = state.places[who.atPlaceId];
  if (from) from.peopleIds = from.peopleIds.filter((id) => id !== personId);
  who.atPlaceId = toPlaceId;
  const to = state.places[toPlaceId];
  if (to && !to.peopleIds.includes(personId)) to.peopleIds.push(personId);
  say(state, 'world', line);
  bus.emit('changed', undefined);
}
