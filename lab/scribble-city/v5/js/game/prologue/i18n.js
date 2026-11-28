import { lang } from '../../core/lang.js';

// (round 16, the player's word) The story's own words in the language chosen on the start screen
// (core/lang.js): its objectives - written in English in game/prologue/director.js, and kept so as the
// autopilot's key (director objKey) - in Hebrew for a Hebrew game, so that a child understands where to
// go; the names on the map's marker; the thoughts over the picture (written in Hebrew) in English for
// an English game.

const OBJ_HE = {
  'Get to your <b>car</b>': 'הולכים ל<b>מכונית</b> שלכם',
  'Drive to the <b>car park</b> on 5th Street': 'סעו אל <b>החניון</b> ברחוב החמישי',
  '<b>Lose them</b> - up through the car park': '<b>ברחו מהם</b> - למעלה, דרך החניון',
  'Meet <b>Lily</b> at the ice cream stand': 'פגשו את <b>לילי</b> ליד דוכן הגלידה',
  'Walk around the <b>city</b> - take a look at it': 'הסתובבו ב<b>עיר</b> ותסתכלו מסביב',
  'Break into a <b>car</b> and take it': 'פרצו ל<b>מכונית</b> וקחו אותה',
  '<b>Drive</b> - get a feel for it': '<b>סעו</b> קצת - להרגיש את המכונית',
  'Open the pen and <b>draw</b> a weapon or a ride': 'פתחו את העט ו<b>ציירו</b> נשק או כלי רכב',
  'Open the pen and draw a <b>turbo</b> on the car': 'פתחו את העט וציירו <b>טורבו</b> על המכונית',
  'Open the pen and draw the <b>turbo</b> on the car - once, and it is yours': 'פתחו את העט וציירו את <b>הטורבו</b> על המכונית - פעם אחת, והוא שלכם',
  'Open the pen and tap the <b>turbo</b> - you drew it, it is yours': 'פתחו את העט ולחצו על <b>הטורבו</b> - ציירתם אותו, הוא שלכם',
  'Open the pen and tap <b>wings</b> - they are yours already': 'פתחו את העט ולחצו על <b>כנפיים</b> - הן כבר שלכם',
  'Open the pencil and tap the <b>pencil rifle</b>': 'פתחו את העיפרון ולחצו על <b>רובה העיפרון</b>',
  '<b>Photograph</b> the blueprint - or <b>draw it here</b>': '<b>צלמו</b> את השרטוט - או <b>ציירו אותו כאן</b>',
  'Draw the blueprint over its lines': 'ציירו את השרטוט מעל הקווים',
  'Open the pen and draw <b>wings</b> on the car': 'פתחו את העט וציירו <b>כנפיים</b> על המכונית',
  'Get out of the car - <b>on foot</b> now': 'צאו מהמכונית - עכשיו <b>ברגל</b>',
  'Open the pencil and draw the <b>pencil rifle</b>': 'פתחו את העיפרון וציירו את <b>רובה העיפרון</b>',
  'Aim and <b>fire</b> the rifle': 'כוונו ו<b>ירו</b> ברובה',
  'A blueprint is hidden nearby - <b>find it</b>': 'שרטוט מוסתר קרוב - <b>מצאו אותו</b>',
  '<b>Photograph</b> the blueprint': '<b>צלמו</b> את השרטוט',
  'Get in a <b>car</b>': 'היכנסו ל<b>מכונית</b>',
  'Hit the <b>turbo</b>!': 'לחצו <b>טורבו</b>!',
  'Walk with <b>Lily</b> to the pier': 'לכו עם <b>לילי</b> אל המזח',
  'Look at the <b>giant wheel</b>': 'הסתכלו על <b>הגלגל הענק</b>',
  'Where did he go? <b>Look for him</b> on the pier': 'לאן הוא נעלם? <b>חפשו אותו</b> על המזח',
  'He is <b>gone</b>. Go back to <b>Lily</b>': 'הוא <b>נעלם</b>. חזרו אל <b>לילי</b>',
  '<b>Floor it!</b>': '<b>גז עד הסוף!</b>',
  '<b>Floor it!</b> - up the ramp': '<b>גז עד הסוף!</b> - על הרמפה',
  'Fly to the <b>beach</b> - set down on the sand': 'טוסו אל ה<b>חוף</b> ונחתו על החול',
};

const MARK_HE = { 'Car park': 'חניון', Up: 'למעלה', Lily: 'לילי', Car: 'מכונית', Pier: 'מזח', Edge: 'הקצה', Beach: 'חוף', Blueprint: 'שרטוט' };

const THOUGHT_EN = {
  'ערב אחד רגיל. רק אני והיא.': 'One ordinary evening. Just me and her.',
  'רוטור!': 'A rotor!',
  'זה לא יכול להיות.': 'This cannot be.',
  'אני משתגע?': 'Am I going crazy?',
  'כי זו ההוכחה היחידה שהוא היה.': 'Because it is the only proof it was ever there.',
  'לא עכשיו. לא כשהיא איתי.': 'Not now. Not while she is with me.',
  'תחשוב... מה עף?': 'Think... what flies?',
};

// an objective as it is shown (the English one is the key)
export const objT = (html) => (html && lang() === 'he' ? OBJ_HE[html] || html : html);
// a name on the map's marker
export const markT = (name) => (name && lang() === 'he' ? MARK_HE[name] || name : name);
// a thought over the picture (written in Hebrew)
export const thoughtT = (he) => (lang() === 'en' ? THOUGHT_EN[he] || he : he);
export const isHe = () => lang() === 'he';
