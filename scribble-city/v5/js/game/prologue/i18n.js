import { lang } from '../../core/lang.js';

// (round 16, the player's word) The story's own words in the language chosen on the start screen
// (core/lang.js): its objectives - written in English in game/prologue/director.js, and kept so as the
// autopilot's key (director objKey) - in Hebrew for a Hebrew game, so that a child understands where to
// go; the names on the map's marker; the thoughts over the picture (written in Hebrew) in English for
// an English game.

const OBJ_HE = {
  'Get to your <b>car</b>': 'הולכים ל<b>מכונית</b> שלכם',
  '<b>Lose them</b> - up through the car park': '<b>ברחו מהם</b> - למעלה, דרך החניון',
  'Meet <b>Lily</b> at the ice cream stand': 'פגשו את <b>לילי</b> ליד דוכן הגלידה',
  'Walk around the <b>city</b> - take a look at it': 'הסתובבו ב<b>עיר</b> ותסתכלו מסביב',
  'Break into a <b>car</b> and take it': 'פרצו ל<b>מכונית</b> וקחו אותה',
  '<b>Drive</b> - get a feel for it': '<b>סעו</b> קצת - להרגיש את המכונית',
  'Open the pen and <b>draw</b> a weapon or a ride': 'פתחו את העט ו<b>ציירו</b> נשק או כלי רכב',
  'Step out, open the pen and <b>draw</b> a weapon or a ride': 'צאו מהמכונית, פתחו את העט ו<b>ציירו</b> נשק או כלי רכב',
  'Walk with <b>Lily</b> to the pier': 'לכו עם <b>לילי</b> אל המזח',
  'Where did he go? <b>Look for him</b> on the pier': 'לאן הוא נעלם? <b>חפשו אותו</b> על המזח',
  'He is <b>gone</b>. Go back to <b>Lily</b>': 'הוא <b>נעלם</b>. חזרו אל <b>לילי</b>',
  '<b>Floor it!</b>': '<b>גז עד הסוף!</b>',
  '<b>Floor it!</b> - up the ramp': '<b>גז עד הסוף!</b> - על הרמפה',
  'Fly to the <b>beach</b> - set down on the sand': 'טוסו אל ה<b>חוף</b> ונחתו על החול',
};

const MARK_HE = { 'Car park': 'חניון', Up: 'למעלה', Lily: 'לילי', Car: 'מכונית', Pier: 'מזח', Edge: 'הקצה', Beach: 'חוף' };

const THOUGHT_EN = {
  'ערב אחד רגיל. רק אני והיא.': 'One ordinary evening. Just me and her.',
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
