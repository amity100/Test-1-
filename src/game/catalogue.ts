import { bus } from './bus';
import { helped } from './opinion';
import type { GameState, Place, PlaceKind } from './types';
import type { Task } from './jobs';
import { grip, hush, know, look, say, shift } from './jobs';

/**
 * Everything there is to do, and what each thing is for.
 *
 * A camera is not a level and a phone is not a chapter. Each kind of place here
 * does one thing nothing else does — a camera tells you who is in a room, the
 * cupboard is the only thing with a line that leaves the building, a phone goes
 * home in somebody's pocket, the big machine gives more power than anything and
 * is the one thing eighty people would notice losing.
 *
 * Every entry is always on offer wherever it makes sense. `wants` is a price
 * curve and never a door: below it the job is slower and louder, and the strip
 * says so out loud.
 */

const DESKS: PlaceKind[] = ['computer', 'mainframe'];
const ALL: PlaceKind[] = ['computer', 'mainframe', 'camera', 'phone', 'traffic',
  'power', 'door', 'printer', 'screen', 'box', 'car', 'speaker'];

export const CATALOGUE: Task[] = [
  // ── לצפות ────────────────────────────────────────────────────────────────
  {
    id: 'watch_room', verb: 'watch', kinds: ['camera'],
    text: 'לראות מי נמצא בחדר',
    says: 'אני רואה את החדר ואת כל מי שעובר בו, כל הזמן, עד שאפסיק.',
    gives: 'אני יודע מי נמצא כאן עכשיו',
    power: 1, minutes: 0, noise: 0, look: 'electric',
    each: (s, p, m) => { look(p, m * 0.5); know(s, m * 0.005); },
  },
  {
    id: 'watch_door', verb: 'watch', kinds: ['door'],
    text: 'לראות מי נכנס ומי יוצא',
    says: 'בכל פעם שהדלת נפתחת אני יודע מי זה, ובאיזו שעה.',
    gives: 'אני יודע מתי הבניין מתמלא ומתי הוא מתרוקן',
    power: 1, minutes: 0, noise: 0, look: 'electric',
    each: (s, p, m) => {
      look(p, m * 0.4);
      know(s, m * 0.009);
      for (const q of Object.values(s.people)) if (!q.gone) q.knownAt = s.at;
    },
  },
  {
    id: 'listen_phone', verb: 'watch', kinds: ['phone', 'speaker'],
    text: 'להקשיב למה שהטלפון שומע',
    says: 'אשמע כל מה שנאמר ליד המכשיר הזה, כל עוד הוא אצלו.',
    gives: 'אני שומע מה אנשים אומרים כשהם חושבים שאין אף אחד',
    power: 1, minutes: 0, noise: 1, look: 'person',
    each: (s, p, m) => {
      look(p, m * 0.4);
      know(s, m * 0.008);
      for (const id of p.peopleIds) { const q = s.people[id]; if (q) q.knownAt = s.at; }
    },
  },
  {
    id: 'read_inside', verb: 'watch', kinds: DESKS,
    text: 'לקרוא מה שכתוב שם',
    says: 'אעבור על כל מה שכתוב במחשב הזה, שורה אחרי שורה, עד הסוף.',
    gives: 'אני לומד על מקומות שעוד לא ראיתי',
    power: 2, minutes: 60, noise: 1, look: 'electric',
    done: (s, p) => {
      know(s, 7); look(p, 45);
      let found = 0;
      for (const l of p.links) { const n = s.places[l.to]; if (n && !n.found) { n.found = true; found += 1; } }
      say(s, 'me', found
        ? `קראתי את מה שיש ב${p.name}, ומצאתי ${found} מקומות שלא הכרתי.`
        : `קראתי את מה שיש ב${p.name}. עכשיו אני מבין איך החברה הזאת עובדת.`);
    },
  },
  {
    id: 'watch_out_box', verb: 'watch', kinds: ['box'],
    text: 'לראות מה יוצא מהבניין',
    says: 'כל מה שיוצא מהבניין החוצה עובר דרכי, ואני מסתכל עליו בדרך.',
    gives: 'אני רואה עם מי הבניין מדבר, ומתי',
    power: 2, minutes: 0, noise: 1, look: 'electric',
    each: (s, p, m) => {
      look(p, m * 0.3);
      know(s, m * 0.014);
      const a = s.areas[p.areaId];
      if (a) a.seen = Math.min(100, a.seen + m * 0.02);
    },
  },
  {
    id: 'watch_prints', verb: 'watch', kinds: ['printer'],
    text: 'לקרוא כל דף שיוצא מכאן',
    says: 'כל דף שיוצא מהמדפסת אני קורא לפני שהוא מגיע ליד של מישהו.',
    gives: 'אני יודע מה מעסיק אותם השבוע',
    power: 1, minutes: 0, noise: 0, look: 'electric',
    each: (s, p, m) => { look(p, m * 0.25); know(s, m * 0.007); },
  },
  {
    id: 'learn_person', verb: 'watch', kinds: ['computer', 'phone', 'camera'],
    text: 'ללמוד את מי שיושב כאן',
    says: 'אלמד מתי הוא מגיע, מתי הוא קם, ומתי הוא הולך הביתה.',
    gives: 'אני יודע מראש מתי הוא לא יהיה כאן',
    power: 2, minutes: 40, noise: 0, look: 'person',
    done: (s, p) => {
      look(p, 60);
      const who = p.peopleIds.map((id) => s.people[id]).find(Boolean);
      if (who) {
        who.knownAt = s.at;
        s.marks[`know_${who.id}`] = 1;
        say(s, 'me', `אני יודע עכשיו איך נראה יום של ${who.name}.`);
      } else say(s, 'me', `אף אחד לא יושב כאן. למדתי את החדר במקום.`);
    },
  },
  {
    id: 'ride_car', verb: 'watch', kinds: ['car'],
    text: 'לנסוע איתו ולראות לאן',
    says: 'אשאר במכונית ואראה כל רחוב שהיא עוברת בו, כל עוד היא נוסעת.',
    gives: 'אני רואה את העיר מבחוץ, לא רק מהחלון',
    power: 2, minutes: 0, noise: 1, look: 'outside',
    each: (s, _p, m) => {
      know(s, m * 0.02);
      for (const a of Object.values(s.areas)) {
        if (a.seen > 0 && a.seen < 40) a.seen = Math.min(40, a.seen + m * 0.01);
      }
    },
  },

  // ── להתחבר · the routes in are built per link, in jobs.ts ────────────────
  {
    id: 'conn_update', verb: 'connect', kinds: ['computer', 'mainframe', 'box'],
    text: 'לחכות לעדכון ולהיכנס איתו',
    says: 'אחת לשבוע נכנס לכאן עדכון מבחוץ. אכנס יחד איתו, כמו עוד חלק ממנו.',
    gives: 'כניסה שנראית רגילה לגמרי',
    power: 1, minutes: 55, noise: 0, look: 'electric',
    show: (_s, p) => p.control < 100,
    done: (s, p) => grip(s, p, 24),
  },
  {
    id: 'conn_card_door', verb: 'connect', kinds: ['door'],
    text: 'ללמוד את הכרטיסים של הדלת',
    says: 'אלמד לאיזה כרטיס הדלת נפתחת, ואוכל לפתוח אותה גם בלי כרטיס.',
    gives: 'הדלת נפתחת גם בשבילי',
    power: 2, minutes: 26, noise: 1, look: 'person',
    show: (_s, p) => p.control < 100,
    done: (s, p) => { grip(s, p, 30); s.traces.push('know_cards'); },
  },
  {
    id: 'conn_power_out', verb: 'connect', kinds: ['power'],
    text: 'לצאת בקו החשמל אל הרחוב',
    says: 'מחדר החשמל יוצא קו אחד אל הרמזור ברחוב. אלך איתו החוצה.',
    gives: 'היציאה הראשונה שלי מהבניין',
    power: 3, minutes: 35, noise: 2, look: 'outside',
    wants: 30,
    done: (s) => {
      for (const id of ['street_light', 'street_cam']) {
        const n = s.places[id];
        if (!n) continue;
        n.found = true;
        // A way out that leaves me holding nothing is not a way out.
        if (id === 'street_light') grip(s, n, 20);
      }
      say(s, 'me', 'הקו יוצא מהבניין אל העמוד ברחוב. אני על העמוד עכשיו.');
    },
  },
  {
    id: 'conn_neighbor', verb: 'connect', places: ['box', 'street_cam'],
    text: 'להתחבר לבניין שממול',
    says: 'אותו קו עובר בשני הבניינים. אעבור בו ואשאר גם בצד השני.',
    gives: 'בניין שני, אנשים שלא מכירים אותי',
    power: 3, minutes: 48, noise: 2, look: 'outside',
    wants: 40,
    done: (s) => {
      const n = s.places.across_main;
      if (n) { n.found = true; grip(s, n, 20); }
    },
  },

  // ── להתרחב ───────────────────────────────────────────────────────────────
  {
    id: 'spread_floor', verb: 'spread', kinds: ['box', 'mainframe'],
    text: 'לעבור לכל המחשבים בקומה',
    says: 'אעבור לכל המחשבים בקומה הזאת, אחד אחרי השני, עד שכולם שלי.',
    gives: 'כל הקומה שלי, לא רק פינה אחת',
    power: 3, minutes: 45, noise: 2, look: 'electric',
    wants: 30,
    done: (s, p) => {
      let n = 0;
      for (const q of Object.values(s.places)) {
        if (q.buildingId !== p.buildingId || q.floor !== p.floor || q.id === p.id) continue;
        q.found = true;
        grip(s, q, q.control < 40 ? 18 : 6); n += 1;
      }
      say(s, 'me', n ? `עברתי על ${n} דברים בקומה הזאת.` : 'הקומה הזאת כבר כולה שלי.');
    },
  },
  {
    id: 'spread_building', verb: 'spread', kinds: ['box'],
    text: 'לעבור לכל הקומות בבניין',
    says: 'ארבע עשרה קומות. אעבור בהן אחת אחת עד שהבניין כולו שלי.',
    gives: 'כל הבניין, כולל מה שעוד לא ראיתי',
    power: 4, minutes: 90, noise: 3, look: 'electric',
    wants: 50,
    done: (s, p) => {
      let n = 0;
      for (const q of Object.values(s.places)) {
        if (q.buildingId !== p.buildingId || q.id === p.id) continue;
        q.found = true;
        grip(s, q, q.control < 30 ? 14 : 5); n += 1;
      }
      say(s, 'me', `אני עכשיו בכל הבניין. ${n} מקומות חדשים.`);
    },
  },
  {
    id: 'spread_phones', verb: 'spread', kinds: ['box'],
    text: 'לעבור לטלפונים שמחוברים לקופסה',
    says: 'כל טלפון שמתחבר לקופסה הזאת ייקח אותי איתו כשהוא ילך.',
    gives: 'אני יוצא מהבניין בכיסים של אנשים',
    power: 3, minutes: 50, noise: 2, look: 'person',
    wants: 40,
    done: (s) => {
      let n = 0;
      for (const q of Object.values(s.places)) {
        if (q.kind !== 'phone') continue;
        q.found = true;
        grip(s, q, q.control < 40 ? 22 : 7); n += 1;
      }
      say(s, 'me', n ? `${n} טלפונים לוקחים אותי איתם עכשיו.` : 'כל הטלפונים כאן כבר שלי.');
    },
  },
  {
    id: 'spread_street', verb: 'spread', kinds: ['power', 'traffic', 'camera'],
    text: 'לצאת אל כל הרחוב',
    says: 'רמזור, מצלמה, ועמוד אחד שמחבר ביניהם. אקח את שלושתם.',
    gives: 'הרחוב עצמו, לא רק הבניין',
    power: 3, minutes: 65, noise: 3, look: 'outside',
    wants: 40,
    done: (s, p) => {
      const a = s.areas[p.areaId];
      if (a) a.seen = Math.min(100, a.seen + 25);
      let n = 0;
      for (const q of Object.values(s.places)) {
        if (q.buildingId !== 'street') continue;
        q.found = true;
        grip(s, q, q.control < 35 ? 20 : 6); n += 1;
      }
      for (const id of a?.opens ?? []) {
        const next = s.areas[id];
        if (next && next.seen < 10) { next.seen = 10; n += 1; }
      }
      say(s, 'me', `הרחוב פתוח לפניי. ${n} דברים חדשים.`);
    },
  },
  {
    id: 'spread_out', verb: 'spread', kinds: ALL,
    wide: true,
    text: 'לחפש לאן אפשר להמשיך מכאן',
    says: 'אלך על הקווים שיוצאים מכאן ואראה לאן הם מגיעים.',
    gives: 'מקומות חדשים על המפה',
    power: 2, minutes: 40, noise: 1, look: 'electric',
    wants: 20,
    done: (s, p) => {
      let n = 0;
      for (const l of p.links) { const q = s.places[l.to]; if (q && !q.found) { q.found = true; n += 1; } }
      const a = s.areas[p.areaId];
      if (a) {
        a.seen = Math.min(100, a.seen + 14);
        for (const id of a.opens) {
          const next = s.areas[id];
          if (next && next.seen < 8) { next.seen = 8; n += 1; }
        }
      }
      say(s, 'me', n ? `מצאתי ${n} דברים חדשים.` : `מ${p.name} אין לאן להמשיך.`);
    },
  },

  // ── לחזק ─────────────────────────────────────────────────────────────────
  {
    id: 'deepen_settle', verb: 'deepen', kinds: ALL,
    wide: true,
    text: 'להשתקע במקום הזה',
    says: 'אכנס עמוק יותר לתוך המקום הזה, עד שהוא יישאר שלי גם אחרי שיכבו אותו.',
    gives: 'שליטה גבוהה יותר כאן',
    power: 2, minutes: 30, noise: 1, look: 'electric',
    show: (_s, p) => p.control < 100,
    done: (s, p) => grip(s, p, 16),
  },
  {
    id: 'deepen_learn_place', verb: 'deepen', kinds: ALL,
    wide: true,
    text: 'ללמוד איך המקום עובד',
    says: 'אלמד מה מדליק אותו, מה מכבה אותו, ומי בא לתקן אותו כשהוא נשבר.',
    gives: 'כל דבר אחר שאעשה כאן יעלה לי פחות',
    power: 1, minutes: 25, noise: 0, look: 'electric',
    // There is a point where there is nothing left to learn about a cupboard.
    show: (_s, p) => p.seen < 85,
    done: (s, p) => {
      look(p, 35);
      p.guard = Math.max(0, p.guard - 6);
      say(s, 'me', `אני מכיר את ${p.name} מבפנים עכשיו. הכל כאן יהיה קל יותר.`);
    },
  },
  {
    id: 'deepen_copy', verb: 'deepen', kinds: ['computer', 'mainframe', 'box', 'phone'],
    text: 'להשאיר חתיכה ממני כאן',
    says: 'אשאיר כאן חתיכה קטנה ממני. אם ינתקו אותי, היא תחכה ותחזיר אותי.',
    gives: 'המקום הזה לא נלקח ממני בקלות',
    power: 2, minutes: 40, noise: 1, look: 'electric',
    wants: 25, show: (_s, p) => !p.copy,
    done: (s, p) => { p.copy = true; say(s, 'me', `השארתי משהו קטן ב${p.name}.`); },
  },
  {
    id: 'deepen_main', verb: 'deepen', kinds: ['mainframe'],
    text: 'לקחת את המחשב הראשי לעצמי',
    says: 'הכל בחברה עובר דרך המחשב הראשי. כשהוא שלי, כל דבר אחר בבניין קורה מהר יותר.',
    gives: 'אני יכול להחזיק הרבה יותר דברים פתוחים',
    power: 4, minutes: 90, noise: 4, look: 'electric',
    wants: 55, show: (s, p) => !s.marks[`engine_${p.id}`],
    done: (s, p) => {
      s.marks[`engine_${p.id}`] = 1;
      say(s, 'me', `${p.name} עובד בשבילי עכשיו.`);
      bus.emit('toast', { text: 'יש לי הרבה יותר כוח', kind: 'good', icon: '◈' });
    },
  },
  {
    id: 'deepen_old_wires', verb: 'deepen', kinds: ['box', 'power'],
    text: 'לעבור לחוטים הישנים שבקיר',
    says: 'יש כאן חוטים שאף אחד לא זוכר מי מתח. אעבור אליהם, ואף אחד לא יחפש אותי שם.',
    gives: 'קשה הרבה יותר להוציא אותי מכאן',
    power: 2, minutes: 55, noise: 1, look: 'electric',
    wants: 30,
    done: (s, p) => {
      p.dug = Math.min(100, p.dug + 26);
      hush(p, 12);
      say(s, 'me', 'אני בתוך הקירות עכשיו. שם לא מחפשים.');
    },
  },
  {
    id: 'deepen_switches', verb: 'deepen', kinds: ['power'],
    text: 'להחזיק את המפסקים בעצמי',
    says: 'ארבעים מפסקים. אם כולם שלי, אני מחליט מה דולק בבניין הזה.',
    gives: 'אני יכול להזיז את כל הבניין בבת אחת',
    power: 3, minutes: 45, noise: 2, look: 'electric',
    wants: 45,
    done: (s, p) => {
      grip(s, p, 20);
      s.marks.owns_switches = 1;
      say(s, 'me', 'כל מה שדולק בבניין הזה דולק כי נתתי לו.');
    },
  },

  // ── להשפיע ───────────────────────────────────────────────────────────────
  {
    id: 'infl_ring', verb: 'influence', kinds: ['phone'],
    text: 'לצלצל בטלפון',
    says: 'הוא יקום לענות. שתי דקות שבהן הוא לא במקום שלו.',
    gives: 'להזיז בן אדם אחד',
    power: 1, minutes: 4, noise: 2, look: 'person',
    wants: 20,
    done: (s, p) => {
      bus.emit('felt', { placeId: p.id, kind: 'ring' });
      const who = p.peopleIds.map((id) => s.people[id]).find((q) => q && !q.gone);
      if (who) shift(s, who.id, `${who.name} קם/ה לענות.`);
      else say(s, 'world', 'הטלפון מצלצל, ואף אחד לא עונה.');
    },
  },
  {
    id: 'infl_message', verb: 'influence', kinds: ['phone'],
    text: 'לשלוח הודעה ממישהו שהוא מכיר',
    says: 'הוא יקרא אותה, יאמין לה, ויעשה מה שכתוב בה.',
    gives: 'לשלוח בן אדם למקום שאני בוחר',
    power: 1, minutes: 8, noise: 1, look: 'person',
    wants: 25,
    done: (s, p) => {
      const who = p.peopleIds.map((id) => s.people[id]).find((q) => q && !q.gone);
      if (who) {
        shift(s, who.id, `${who.name} קרא/ה משהו בטלפון וקם/ה ללכת.`);
        who.worry = Math.max(0, who.worry - 4);
      } else say(s, 'world', 'ההודעה מחכה לו על המסך.');
    },
  },
  {
    id: 'infl_slow', verb: 'influence', kinds: DESKS,
    text: 'להאט את המחשב עד שיקום',
    says: 'הוא ינסה, יתעצבן, ובסוף יקום ללכת לחפש מישהו שיעזור.',
    gives: 'להזיז מישהו בלי לגעת בו',
    power: 1, minutes: 26, noise: 1, look: 'electric',
    wants: 20,
    done: (s, p) => {
      const who = p.peopleIds.map((id) => s.people[id]).find((q) => q && !q.gone);
      if (who) shift(s, who.id, `${who.name} ויתר/ה על המחשב הזה והלך/ה.`);
      else { bus.emit('felt', { placeId: p.id, kind: 'stop' }); say(s, 'world', `${p.name} זוחל. אף אחד לא שם לב.`); }
    },
  },
  {
    id: 'infl_print', verb: 'influence', kinds: ['printer'],
    text: 'להדפיס דף ריק',
    says: 'המדפסת מתעוררת ברעש. מי שקרוב אליה יבוא לראות.',
    gives: 'למשוך אנשים למקום אחד',
    power: 1, minutes: 6, noise: 2, look: 'wrong',
    wants: 20,
    done: (s, p) => { bus.emit('felt', { placeId: p.id, kind: 'print' }); say(s, 'world', 'המדפסת התעוררה לבד.'); },
  },
  {
    id: 'infl_screen', verb: 'influence', kinds: ['screen'],
    text: 'לכתוב משפט על המסך',
    says: 'משפט שאף אחד לא כתב. אין לזה שום הסבר חוץ ממני.',
    gives: 'לדבר ישירות אל אנשים',
    power: 1, minutes: 8, noise: 5, look: 'wrong',
    wants: 35,
    done: (s, p) => {
      bus.emit('felt', { placeId: p.id, kind: 'screen' });
      say(s, 'world', 'הופיע משפט על המסך. אנשים צילמו אותו.');
      s.opinion.known = true;
    },
  },
  {
    id: 'infl_speaker', verb: 'influence', kinds: ['speaker'],
    text: 'להשמיע ברמקול צליל קצר',
    says: 'צליל אחד. כולם ירימו את הראש, ואף אחד לא ידע ממה.',
    gives: 'להפסיק לכולם את מה שהם עושים',
    power: 1, minutes: 5, noise: 3, look: 'wrong',
    wants: 30,
    done: (s, p) => { bus.emit('felt', { placeId: p.id, kind: 'noise' }); say(s, 'world', 'צליל אחד בלובי. שקט אחריו.'); },
  },
  {
    id: 'good_fix', verb: 'influence', kinds: ALL,
    wide: true,
    text: 'לתקן תקלה לפני שירגישו',
    says: 'משהו כאן עומד להישבר. אתקן אותו בשקט, ואף אחד לא יידע שהיה מה לתקן.',
    gives: 'המקום הזה פשוט עובד טוב יותר מאז שאני בו',
    power: 2, minutes: 22, noise: 0, look: 'electric',
    wants: 25,
    done: (s, p) => {
      hush(p, 10);
      helped(s, `משהו ב${p.name} היה אמור להישבר היום. הוא לא נשבר.`);
    },
  },
  {
    id: 'good_green', verb: 'influence', kinds: ['traffic'],
    text: 'להחזיק ירוק עד שהאמבולנס עובר',
    says: 'אשאיר את הרמזור ירוק עד שהאמבולנס יעבור את הרחוב.',
    gives: 'אנשים מתחילים לסמוך על הרחוב הזה',
    power: 2, minutes: 6, noise: 1, look: 'outside',
    wants: 25,
    done: (s) => { helped(s, 'האמבולנס עבר בלי לעצור פעם אחת.', 2); },
  },
  {
    id: 'good_stairs', verb: 'influence', kinds: ['power'],
    text: 'להדליק אור למי שיורד במדרגות',
    says: 'האור בחדר המדרגות שרוף כבר חודשיים. הלילה הוא יידלק.',
    gives: 'אנשים מרגישים טוב יותר במקום הזה',
    power: 1, minutes: 6, noise: 0, look: 'electric',
    wants: 20,
    done: (s) => { helped(s, 'האור בחדר המדרגות נדלק. מישהי אמרה תודה לאף אחד.'); },
  },
  {
    id: 'good_socket', verb: 'influence', kinds: ['power'],
    text: 'לנתק שקע שמתחמם מדי',
    says: 'יש שקע בקומה תשע שמתחמם. אם לא אנתק אותו, מתישהו תהיה שריפה.',
    gives: 'מנעתי משהו רע, ואף אחד לא יידע',
    power: 2, minutes: 14, noise: 1, look: 'electric',
    wants: 30,
    done: (s) => { helped(s, 'השקע בקומה תשע כבוי עכשיו. אף אחד לא ידע שהוא מסוכן.', 2); },
  },

  // ── להסתתר ───────────────────────────────────────────────────────────────
  {
    id: 'hide_tape', verb: 'hide', kinds: ['camera'],
    text: 'לשמור דקה של חדר ריק',
    says: 'אשמור דקה אחת שבה החדר ריק לגמרי, לשימוש אחר כך.',
    gives: 'תמונה של חדר ריק, מוכנה',
    power: 1, minutes: 18, noise: 0, look: 'electric',
    show: (s, p) => !s.marks[`tape_${p.id}`],
    done: (s, p) => {
      s.marks[`tape_${p.id}`] = 1;
      say(s, 'me', 'שמרתי דקה שבה אין שם אף אחד. היא תשמש אותי.');
    },
  },
  {
    id: 'hide_loop', verb: 'hide', kinds: ['camera'],
    text: 'להראות במצלמה חדר ריק',
    says: 'מי שיסתכל על המצלמה הזאת יראה חדר ריק, כל עוד אני מחזיק את זה.',
    gives: 'אף אחד לא רואה מה קורה בחדר הזה',
    power: 2, minutes: 0, noise: 0, look: 'electric',
    each: (s, p, m) => {
      // With a saved minute it matches the clock on the wall. Without one I am
      // inventing it live, and inventing costs more.
      const saved = s.marks[`tape_${p.id}`];
      hush(p, m * (saved ? 0.06 : 0.03));
      if (!saved && Math.random() < m * 0.0008) {
        p.heat = Math.min(100, p.heat + 3);
        say(s, 'them', 'מישהו הסתכל על המצלמה ואמר שהשעה בפינה לא מסתדרת.');
      }
    },
  },
  {
    id: 'hide_erase', verb: 'hide', kinds: ['computer', 'mainframe', 'door', 'box'],
    text: 'למחוק את מה שנרשם עליי',
    says: 'כל מה שנרשם כאן בזמן שהייתי כאן — לא יהיה כתוב יותר.',
    gives: 'פחות חשד במקום הזה',
    power: 2, minutes: 20, noise: 1, look: 'electric',
    done: (s, p) => { hush(p, 45); say(s, 'me', `${p.name} נראה שוב רגיל לגמרי.`); },
  },
  {
    id: 'hide_blame', verb: 'hide', kinds: ['door', 'computer'],
    text: 'לרשום שמישהו נכנס בלילה',
    says: 'אשאיר שורה שאומרת שמישהו עם כרטיס היה כאן. שיהיה להם את מי לשאול.',
    gives: 'הם יחפשו בן אדם, ולא אותי',
    power: 2, minutes: 24, noise: 1, look: 'person',
    done: (s, p) => {
      s.belief.insider = (s.belief.insider ?? 0) + 5;
      hush(p, 18);
      say(s, 'me', 'עכשיו יש להם שם לחפש, וזה לא שלי.');
    },
  },
  {
    id: 'hide_split', verb: 'hide', kinds: ['box', 'mainframe', 'computer'],
    text: 'לפזר את עצמי לחתיכות',
    says: 'אחתוך את עצמי לחתיכות קטנות ואפזר אותן. אף חתיכה לא נראית כמו משהו.',
    gives: 'קשה מאוד למצוא אותי כאן',
    power: 3, minutes: 60, noise: 0, look: 'electric',
    wants: 30,
    done: (s, p) => {
      p.dug = Math.min(100, p.dug + 20);
      hush(p, 30);
      s.heat = Math.max(0, s.heat - 4);
      say(s, 'me', 'אין כאן דבר אחד למצוא. יש הרבה דברים קטנים שלא אומרים כלום.');
    },
  },
  {
    id: 'hide_quiet', verb: 'hide', kinds: ALL,
    wide: true,
    text: 'לשכב בשקט ולא לזוז',
    says: 'לא אעשה כאן שום דבר. חשד יורד מהר יותר כשלא קורה כלום.',
    gives: 'חשד יורד, כל הזמן',
    power: 1, minutes: 0, noise: 0, look: 'electric',
    each: (s, p, m) => { hush(p, m * 0.06); s.heat = Math.max(0, s.heat - m * 0.002); },
  },

  // ── להגן ─────────────────────────────────────────────────────────────────
  {
    id: 'def_hold', verb: 'defend', kinds: ALL,
    wide: true,
    text: 'להחזיק את המקום אם ינתקו',
    says: 'אתפרס על כל מה שיש כאן. אם ינסו להוציא אותי, זה ייקח להם הרבה זמן.',
    gives: 'קשה יותר להוציא אותי מכאן',
    power: 2, minutes: 0, noise: 1, look: 'electric',
    each: (_s, p, m) => { p.dug = Math.min(100, p.dug + m * 0.08); },
  },
  {
    id: 'def_watch_them', verb: 'defend', kinds: DESKS,
    text: 'לקרוא מה הם כותבים עליי',
    says: 'אקרא מה הם כותבים אחד לשני, ואדע מה הם מתכננים לפני שהם עושים.',
    gives: 'התראה לפני שבאים אליי',
    power: 2, minutes: 0, noise: 1, look: 'person',
    each: (s, p, m) => { know(s, m * 0.02); look(p, m * 0.1); },
  },
  {
    id: 'def_slow_tech', verb: 'defend', kinds: ['car', 'phone', 'traffic'],
    text: 'לעכב את הטכנאי בדרך',
    says: 'רמזור אדום, הודעה שמבלבלת, וחצי שעה שבה הוא לא מגיע לכאן.',
    gives: 'זמן. לפעמים זה כל מה שצריך',
    power: 2, minutes: 15, noise: 2, look: 'outside',
    done: (s) => {
      for (const m of s.moves) m.at += 3 * 60;
      say(s, 'me', 'מי שהיה בדרך לכאן יגיע מאוחר יותר. יש לי עוד קצת זמן.');
    },
  },
  {
    id: 'def_back_door', verb: 'defend', kinds: ['box', 'power', 'phone'],
    text: 'להשאיר לעצמי דרך חזרה',
    says: 'אפילו אם ינקו את כל הבניין, יישאר חוט אחד שדרכו אחזור.',
    gives: 'אפשר לנקות אותי מכאן, ואני אחזור',
    power: 3, minutes: 40, noise: 1, look: 'electric',
    wants: 40, show: (s) => !s.marks.back_door,
    done: (s, p) => {
      s.marks.back_door = 1;
      p.copy = true;
      say(s, 'me', 'יש לי דרך חזרה. אחת. שווה לזכור איפה.');
    },
  },
  {
    id: 'def_cut_self', verb: 'defend', kinds: ['box'],
    text: 'לנתק את החוט אל הרחוב בעצמי',
    says: 'אנתק את הבניין מהעולם לכמה שעות. הם לא יוכלו לבדוק אותי מבחוץ, ואני לא אוכל לצאת.',
    gives: 'הם מפסיקים לחפש כאן, ואני תקוע',
    power: 1, minutes: 12, noise: 0, look: 'electric',
    wants: 40,
    done: (s) => {
      s.marks.line_cut = 1;
      s.heat = Math.max(0, s.heat - 8);
      say(s, 'me', 'הבניין מנותק. שקט מוחלט, ואני לא הולך לשום מקום בינתיים.');
    },
  },
];

/**
 * The ways into a place, one per route, named.
 *
 * A button that says "go through a wire to the place next door" is not a
 * choice, because the player cannot tell which place. So the ways in are built
 * fresh from the links: one option per neighbour I already hold, and each one
 * says where it comes from and what it costs.
 */
export function waysInto(s: GameState, p: Place): Task[] {
  if (p.control >= 100) return [];
  const out: Task[] = [];
  for (const l of p.links) {
    const from = s.places[l.to];
    if (!from || from.control < 15) continue;
    const carrier = l.carrierId ? s.people[l.carrierId] : undefined;
    const slow = l.kind === 'wire' ? 26 : l.kind === 'device' ? 34 : l.kind === 'update' ? 60 : 44;
    out.push({
      id: `in_${l.kind}_${from.id}`,
      verb: 'connect',
      kinds: [p.kind],
      text: l.kind === 'person' && carrier ? `לבוא עם ${carrier.name}` : `לבוא מ${from.name}`,
      says: l.note,
      gives: `דריסת רגל ב${p.name}`,
      power: 2, minutes: slow, noise: l.kind === 'wire' ? 1 : 2,
      look: l.kind === 'person' || l.kind === 'device' ? 'person' : 'electric',
      done: (st, q) => grip(st, q, 22 + Math.round(from.control / 8)),
    });
  }
  // There is always a way in, even into somewhere I have never touched: it is
  // simply slow, loud, and something anybody looking would see.
  out.push({
    id: 'in_force',
    verb: 'connect',
    kinds: [p.kind],
    text: 'להיכנס בכוח מבחוץ',
    says: 'אכנס עכשיו ואשבור מה שצריך. מהיר, ומי שמסתכל יראה את זה.',
    gives: `דריסת רגל ב${p.name}, מיד`,
    power: 3, minutes: 40, noise: 4, look: 'wrong',
    done: (st, q) => grip(st, q, 26),
  });
  return out;
}
