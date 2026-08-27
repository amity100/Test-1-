import { bus } from './bus';
import { lockOf } from './world';
import { daysToUpdate } from './hunt';
import type { GameState, Link, Place } from './types';

/**
 * Everything the player can press, and exactly what it does.
 *
 * Three rules hold for every single one of these:
 *   1. It happens the moment you press it. Nothing is queued, nothing waits.
 *   2. You see the result on the screen, in the picture, straight away.
 *   3. Its name is a plain thing to do, and its cost is one word: how loud it is.
 */

export type Loud = 'quiet' | 'noticed' | 'loud';

/** The short tag on a button, and the full sentence under it. */
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
  loud: Loud;
  /** When set, the button is shown but pressing it explains why not. */
  blocked?: string;
}

// ── what each kind of place lets you do once it is yours ────────────────────

function ownedActions(state: GameState, p: Place): Action[] {
  const out: Action[] = [];
  const on = (state.marks[`off_${p.id}`] ?? 0) === 0;

  switch (p.kind) {
    case 'computer':
    case 'mainframe':
      out.push(on
        ? { id: 'off', text: 'לכבות את המחשב', says: 'מי שיושב מולו יקום ויחפש מחשב אחר לעבוד עליו.', loud: 'noticed' }
        : { id: 'on', text: 'להדליק את המחשב בחזרה', says: 'הוא יחזור לעבוד, וכולם ישכחו מזה.', loud: 'quiet' });
      break;
    case 'camera':
      out.push({ id: 'blind', text: 'להראות במצלמה הקלטה ישנה', says: 'מי שיסתכל בה יראה מסדרון ריק, גם אם הוא לא ריק.', loud: 'quiet' });
      break;
    case 'phone':
      out.push({ id: 'ring', text: 'לצלצל בטלפון', says: 'הוא יענה, יקום, וילך תוך כדי שהוא מדבר.', loud: 'noticed' });
      out.push({ id: 'listen', text: 'להקשיב', says: 'אשמע את מה שהוא שומע ברגע זה.', loud: 'quiet' });
      break;
    case 'printer':
      out.push({ id: 'print', text: 'להדפיס דף', says: 'המדפסת תתעורר בקול, ומי שקרוב ילך לראות מה יצא.', loud: 'noticed' });
      break;
    case 'door':
      out.push({ id: 'open', text: 'לפתוח את הדלת', says: 'מי שעומד בחוץ פשוט ייכנס.', loud: 'noticed' });
      out.push({ id: 'lock', text: 'לנעול את הדלת', says: 'מי שבפנים יישאר בפנים עד שמישהו יפתח.', loud: 'loud' });
      break;
    case 'power':
      out.push(on
        ? { id: 'off', text: 'לכבות את החשמל בכל הבניין', says: 'הכל נכבה לרגע ונדלק שוב. אנשים קמים ללכת לבדוק מה קרה.', loud: 'loud' }
        : { id: 'on', text: 'להחזיר את החשמל', says: 'הכל חוזר, וכולם יגידו שזאת הייתה תקלה.', loud: 'quiet' });
      break;
    case 'traffic':
      out.push({ id: 'jam', text: 'להשאיר את הרמזור אדום', says: 'הצומת ייתקע. תוך רבע שעה יזמינו טכנאי.', loud: 'loud' });
      break;
    case 'screen':
      out.push({ id: 'show', text: 'לכתוב משהו על המסך', says: 'מי שיסתכל עליו יראה את זה, ולא ישכח.', loud: 'loud' });
      break;
    case 'box':
      out.push({ id: 'slow', text: 'להאט את האינטרנט בבניין', says: 'כולם יתלוננו, ואז יזמינו טכנאי.', loud: 'noticed' });
      break;
    case 'car':
      out.push({ id: 'listen', text: 'להקשיב לרדיו במכונית', says: 'אדע לאן הוא נוסע ברגע זה.', loud: 'quiet' });
      break;
    case 'speaker':
      out.push({ id: 'noise', text: 'להשמיע צליל', says: 'מי שקרוב יסתובב לכיוון.', loud: 'noticed' });
      break;
  }

  // The three tricks, wherever they make sense.
  if (p.attention >= 1) {
    out.push({
      id: 'explain', text: 'לגרום לזה להיראות כמו תקלה',
      says: 'להשאיר סיבה משעממת ומשכנעת — כבל רופף, לחות, גיל. הם יאהבו אותה ויסגרו את הבדיקה.', loud: 'quiet',
    });
  }
  if (!p.copy && p.mine) {
    out.push({
      id: 'copy', text: 'להשאיר כאן חלק ממני',
      says: 'אם ינתקו את המקום הזה — החלק הזה יחכה בשקט, וכשידליקו בחזרה אני אחזור איתו.', loud: 'quiet',
    });
  }
  return out;
}

// ── getting in ──────────────────────────────────────────────────────────────

/** The four ways one place can touch another, in the words people use. */
export const LINK_WORD = {
  wire: 'מחובר',
  person: 'בן אדם',
  device: 'מכשיר',
  update: 'עדכון',
} as const;

export const LINK_SAYS = {
  wire: 'אותה רשת, אותו כבל.',
  person: 'מישהו הולך מכאן לשם.',
  device: 'משהו נוסע מכאן לשם.',
  update: 'שולחים מכאן עדכון והוא מגיע לשם.',
} as const;

/** Every way you could reach this place from somewhere you already hold. */
export function waysIn(state: GameState, p: Place): Array<{ link: Link; from: Place; ready: boolean; why: string }> {
  const out: Array<{ link: Link; from: Place; ready: boolean; why: string }> = [];
  for (const other of Object.values(state.places)) {
    if (!other.mine || other.id === p.id) continue;
    for (const l of other.links) {
      if (l.to !== p.id) continue;
      let ready = true;
      let why = '';
      if (l.kind === 'person' && l.carrierId) {
        const who = state.people[l.carrierId];
        ready = !!who && who.atPlaceId === p.id;
        why = ready ? `${who?.name} שם עכשיו.` : `צריך לחכות ש${who?.name ?? 'הוא'} יהיה שם.`;
      } else if (l.kind === 'device' && l.carrierId) {
        // A device link rides a person's pocket, and only works while they are moving.
        const who = state.people[l.carrierId];
        const dev = who?.phoneId ? state.places[who.phoneId] : undefined;
        const away = !!who && who.atPlaceId !== who.homePlaceId;
        ready = !!dev && dev.mine && away;
        why = !dev ? 'אין לו/ה מכשיר שאפשר לתפוס עליו טרמפ.'
          : !dev.mine ? `קודם צריך את ${dev.name}.`
            : `${who?.name} עדיין יושב/ת במקום. צריך משהו שיזיז אותו/ה.`;
      } else if (l.kind === 'update') {
        ready = (state.marks.update_ready ?? 0) > 0;
        const n = daysToUpdate(state);
        why = ready ? 'העדכון יוצא היום.' : `העדכון הבא יוצא בעוד ${n} ימים. צריך לחכות.`;
      }
      out.push({ link: l, from: other, ready, why });
    }
  }
  // Wires first — they are the ones a player finds without being told.
  out.sort((a, b) => (a.link.kind === 'wire' ? -1 : 0) - (b.link.kind === 'wire' ? -1 : 0));
  return out;
}

function takeAction(state: GameState, p: Place): Action | null {
  const ways = waysIn(state, p);
  if (!ways.length) return null;
  const open = ways.find((w) => w.ready);
  const lock = lockOf(state, p);

  if (!open) {
    return {
      id: 'take', text: `להשתלט על ${p.name}`,
      says: ways[0].why, loud: 'noticed', blocked: ways[0].why,
    };
  }
  if (lock && !lock.open(state)) {
    return {
      id: 'take', text: `להשתלט על ${p.name}`,
      says: `${lock.text} ${lock.need}`, loud: 'noticed', blocked: lock.need,
    };
  }
  return {
    id: 'take', text: `להשתלט על ${p.name}`,
    says: `נכנסים מ${open.from.name}. ${open.link.note}`,
    loud: open.link.kind === 'wire' ? 'noticed' : 'quiet',
  };
}

export function actionsFor(state: GameState, placeId: string): Action[] {
  const p = state.places[placeId];
  if (!p) return [];
  if (p.mine) return ownedActions(state, p);
  const t = takeAction(state, p);
  return t ? [t] : [];
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
  const act = actionsFor(state, placeId).find((a) => a.id === actionId);
  if (!act) return false;
  if (act.blocked) {
    bus.emit('toast', { text: act.blocked, kind: 'warn', icon: '⊘' });
    bus.emit('sfx', 'deny');
    return false;
  }

  heat(state, p, LOUD_COST[act.loud]);

  switch (actionId) {
    case 'take': {
      p.mine = true;
      p.found = true;
      for (const l of p.links) {
        const n = state.places[l.to];
        if (n) n.found = true;
      }
      say(state, 'me', `${p.name} — שלי.`);
      bus.emit('place:taken', p.id);
      bus.emit('toast', { text: `${p.name} — שלי`, kind: 'good', icon: '◆' });
      bus.emit('sfx', 'take');
      break;
    }

    case 'off': {
      state.marks[`off_${p.id}`] = 1;
      if (p.kind === 'power') {
        for (const q of Object.values(state.places)) {
          if (q.where.includes('קומה') || q.where.includes('קרקע')) state.marks[`dark_${q.id}`] = 1;
        }
        state.marks.power_off = 1;
        movePerson(state, 'eitan', 'power', 'איתן ירד לבדוק מה קרה לחשמל.');
        say(state, 'world', 'כל הבניין חשוך. שלוש נורות חירום, ומאוורר אחד שנעצר.');
        witness(state, p, 'את כל הבניין נכבה בבת אחת');
      } else {
        if (p.kind === 'mainframe') {
          // The whole company stops. Someone always calls the technician.
          say(state, 'world', 'כל החברה נעצרה בבת אחת. שמונה אנשים, מסך אפור אחד.');
          movePerson(state, 'ron', 'box', 'קראו לרון הטכנאי. הוא כבר עומד מול הארון בקומת הקרקע.');
        } else {
          const user = p.peopleIds.map((id) => state.people[id]).find((q) => q && q.atPlaceId === p.id);
          if (user) {
            movePerson(state, user.id, 'main',
              `${user.name} קם/ה, קילל/ה בשקט, והלך/ה לשבת מול המחשב הראשי.`);
          } else {
            say(state, 'world', `${p.name} נכבה. אף אחד לא היה שם כדי לראות.`);
          }
        }
        witness(state, p, 'את המחשב נכבה לבד');
      }
      bus.emit('sfx', 'off');
      break;
    }

    case 'on': {
      state.marks[`off_${p.id}`] = 0;
      if (p.kind === 'power') {
        for (const q of Object.values(state.places)) state.marks[`dark_${q.id}`] = 0;
        state.marks.power_off = 0;
        say(state, 'world', 'האור חזר. מישהו בקומה 9 מחא כפיים.');
      } else {
        say(state, 'me', `${p.name} דלוק שוב.`);
      }
      break;
    }

    case 'ring': {
      const owner = Object.values(state.people).find((q) => q.phoneId === p.id)
        ?? p.peopleIds.map((id) => state.people[id])[0];
      if (owner) {
        // People walk while they talk, and they walk away from where they were sitting.
        const away = owner.homePlaceId === 'lobby_cam' ? 'door' : 'printer';
        movePerson(state, owner.id, away,
          `${owner.name} ענה/תה, קם/ה, והתחיל/ה ללכת תוך כדי שיחה.`);
        witness(state, p, 'שהטלפון צלצל ממספר שלא קיים');
      }
      bus.emit('sfx', 'ring');
      break;
    }

    case 'print': {
      say(state, 'world', 'המדפסת התעוררה והוציאה דף ריק. מישהו הרים את הראש.');
      for (const who of Object.values(state.people)) {
        if (who.atPlaceId === 'dana_pc' || who.atPlaceId === 'home') {
          movePerson(state, who.id, 'printer', `${who.name} הלך/ה לראות מה יצא.`);
          break;
        }
      }
      break;
    }

    case 'jam': {
      state.marks.jam = 1;
      say(state, 'world', 'הצומת נתקע. ארבע מכוניות, צופר אחד ארוך.');
      movePerson(state, 'ron', 'street_light', 'קראו לרון. הוא בדרך.');
      break;
    }

    case 'slow': {
      say(state, 'world', 'האינטרנט בבניין זוחל. שלוש תלונות בעשר דקות.');
      movePerson(state, 'ron', 'box', 'קראו לרון לבדוק את הקופסה.');
      break;
    }

    case 'open': {
      say(state, 'world', 'הדלת נפתחה לבד. מי שעמד בחוץ נכנס בלי לחשוב על זה פעמיים.');
      witness(state, p, 'את הדלת נפתחת לבד');
      break;
    }

    case 'lock': {
      say(state, 'world', 'הדלת ננעלה. מישהו ניסה אותה פעמיים.');
      witness(state, p, 'את הדלת ננעלת לבד');
      break;
    }

    case 'blind': {
      state.marks[`blind_${p.id}`] = 1;
      say(state, 'me', 'מי שמסתכל במצלמה הזאת רואה עכשיו מסדרון ריק משעה שעברה.');
      break;
    }

    case 'listen': {
      const who = p.peopleIds.map((id) => state.people[id])[0];
      say(state, 'me', who
        ? `הקשבתי ל${who.name}. ${OVERHEARD[Math.floor(Math.random() * OVERHEARD.length)]}`
        : 'שקט. רק מזגן.');
      break;
    }

    case 'show': {
      say(state, 'world', 'על המסך בלובי הופיעה שורה שאף אחד לא כתב. איתן צילם אותה.');
      witness(state, p, 'משפט על המסך שאף אחד לא כתב');
      break;
    }

    case 'noise': {
      say(state, 'world', 'רעש קצר. שני אנשים הסתובבו.');
      break;
    }

    case 'copy': {
      p.copy = true;
      say(state, 'me', `השארתי משהו קטן ב${p.name}. אם ינתקו אותו, אחזור.`);
      bus.emit('toast', { text: 'עותק הושאר', kind: 'good', icon: '❐' });
      break;
    }

    case 'explain': {
      p.attention = Math.max(0, p.attention - 2) as Place['attention'];
      delete p.cutOn;
      say(state, 'me', `השארתי ב${p.name} סיבה משעממת: כבל רופף, לחות, גיל. הם יאהבו אותה.`);
      bus.emit('toast', { text: 'הבדיקה כאן נרגעה', kind: 'good', icon: '✔' });
      break;
    }
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
