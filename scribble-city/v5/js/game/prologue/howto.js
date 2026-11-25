// (v5, ROADMAP 18.9) How to play, as the prologue goes: each thing the player is to do said plainly and
// kindly - what, in a word; how, each way with its keys as keys (a computer's, or a phone's buttons);
// and a tip where one helps. The cards of game/prologue/ui.js card({ step, of, title, say, lines, tip }).
// The first six are the game showing the player round (the director's tutorial: step n of 6); the
// rest come up as the story asks something of the player.

import { lang } from '../../core/lang.js';

const OF = 9;

// (round 22: at the wheel of a phone, the buttons of the big phone games - ◀ ▶ under the left thumb, the
// pedals under the right - and not the stick, unless it was chosen: game/game.js drive-btns)
let BTN = null;
const btns = () => (BTN !== null ? BTN : typeof document !== 'undefined' && document.body.classList.contains('drive-btns'));

// (round 16: in the language chosen on the start screen - core/lang.js)
export function howto(key, touch, drivePads = null) {
  BTN = drivePads;
  return lang() === 'en' ? howtoEn(key, touch) : howtoHe(key, touch);
}

function howtoHe(key, touch) {
  const T = !!touch;
  switch (key) {
    case 'explore':
      return {
        step: 1, of: OF, title: 'מסתובבים בעיר',
        say: 'זה דני, ואתם שולטים בו. קחו כמה שניות להכיר את העיר.',
        lines: T
          ? [['ג׳ויסטיק', 'ללכת (רחוק יותר מהמרכז: לרוץ)'], ['גרירה', 'על המסך: להסתכל מסביב']]
          : [['W A S D', 'ללכת'], ['Shift', 'מחזיקים: לרוץ'], ['העכבר', 'להסתכל מסביב']],
        tip: 'המפה הקטנה למעלה משמאל: החץ הוא אתם.',
      };
    case 'shop':
      return {
        step: 2, of: OF, title: 'נכנסים לחנות',
        say: 'לכל חנות שהדלת שלה פתוחה אפשר להיכנס: לקנות, לאכול, או סתם להסתכל.',
        lines: T ? [['הולכים', 'אל דלת פתוחה, ונכנסים פנימה']] : [['W', 'הולכים אל דלת פתוחה, ונכנסים פנימה']],
        tip: 'לא חובה. אם לא תיכנסו, נמשיך לבד לשלב הבא בעוד רגע.',
      };
    case 'inside':
      return {
        step: 2, of: OF, title: 'אתם בפנים!',
        say: 'ניגשים לדלפק או למדף - ושם קונים.',
        lines: T ? [['כפתור', 'שמופיע ליד הדלפק: לקנות']] : [['E', 'ליד הדלפק או המדף: לקנות']],
      };
    case 'car':
      return {
        step: 3, of: OF, title: 'לוקחים מכונית',
        say: 'המכונית החונה הכי קרובה מסומנת לכם במפה. ניגשים אל הדלת שלה.',
        lines: T ? [['כפתור הרכב', 'ליד הדלת: נכנסים - והיא שלכם']] : [['E', 'ליד הדלת: נכנסים - והיא שלכם']],
        tip: 'כל מכונית שחונה ברחוב יכולה להיות שלכם.',
      };
    case 'drive':
      return {
        step: 4, of: OF, title: 'נוהגים',
        say: 'סעו קצת ברחובות, להרגיש את המכונית.',
        lines: T
          ? btns()
            ? [['◀ ▶', 'הגה'], ['גז, בלם', 'הדוושות מימין'], ['כפתור הרכב', 'לצאת מהמכונית']]
            : [['ג׳ויסטיק', 'גז, ברקס והגה'], ['כפתור הרכב', 'לצאת מהמכונית']]
          : [['W', 'גז'], ['S', 'ברקס, ורוורס'], ['A D', 'הגה'], ['Space', 'בלם יד (להחלקות)'], ['E', 'לצאת מהמכונית']],
      };
    // (R27, the owner's word: a full guide to the start - the pen's things first, each shown by the pencil on the screen;
    // then led to the first blueprint hidden in the city, photographed and drawn: a turbo)
    case 'wings':
      return {
        step: 5, of: OF, title: 'מציירים - וזה נהיה אמיתי!',
        say: 'מה שמציירים קם לחיים. ציירו כנפיים על המכונית - העיפרון על המסך מראה איך, ואתם אחריו.',
        lines: T
          ? [['כפתור העיפרון', 'פותח את העט'], ['ציור כנפיים מעל המכונית', 'כמו שהעיפרון מצייר - בערך, לא צריך מדויק'], ['מרימים את האצבע', 'והכנפיים עליה']]
          : [['Q', 'פותח את העט'], ['ציור כנפיים מעל המכונית', 'כמו שהעיפרון מצייר - בערך, לא צריך מדויק'], ['משחררים את העכבר', 'והכנפיים עליה']],
        tip: 'כל דבר מציירים פעם אחת - ומאז הוא שלכם, בנגיעה. במהירות ובקפיצה המכונית דואה.',
      };
    case 'getout':
      return {
        step: 6, of: OF, title: 'יוצאים מהמכונית',
        say: 'את הנשקים מהספרייה מציירים ברגל.',
        lines: T ? [['כפתור הרכב', 'לצאת מהמכונית']] : [['E', 'לצאת מהמכונית']],
      };
    case 'weapon':
      return {
        step: 6, of: OF, title: 'נשק מהספרייה',
        say: 'בעיפרון יש ספרייה של נשקים ורכבים. ציירו את רובה העיפרון: העיפרון על המסך מצייר אותו קודם - ואתם אחריו, מעל הקווים.',
        lines: T
          ? [['כפתור העיפרון', 'פותח את הספרייה'], ['מציירים מעל הקווים', 'בערך כמו בתמונה'], ['✓', 'והרובה ביד']]
          : [['Q', 'פותח את הספרייה'], ['מציירים מעל הקווים', 'בערך כמו בתמונה'], ['Q', 'שוב: והרובה ביד']],
        tip: 'כל דבר בספרייה מציירים פעם אחת. מאז הוא מוכן בנגיעה.',
      };
    case 'fire':
      return {
        step: 6, of: OF, title: 'יורים',
        say: 'נסו את הרובה: מכוונים ויורים.',
        lines: T ? [['כפתור הכוונת', 'מחזיקים: מכוונים'], ['כפתור הירי', 'יורים']] : [['קליק ימני', 'מחזיקים: מכוונים'], ['קליק', 'יורים']],
      };
    case 'find':
      return {
        step: 7, of: OF, title: 'שרטוט מוסתר בעיר',
        say: 'בכל העיר מוסתרים שרטוטים - נשקים, רכבים, חלקים. אחד מהם קרוב, והמפה מסמנת אותו.',
        lines: [['המפה', 'הנקודה היא השרטוט, והחץ מראה את הדרך'], ['דף לבן עם קווים בזהב', 'על קיר בסמטה'], ['מתקרבים', 'ושומעים עיפרון משרבט']],
        tip: 'רוב השרטוטים לא מסומנים במפה - אותם מחפשים בסמטאות ועל הגגות.',
      };
    case 'photo':
      return {
        step: 7, of: OF, title: 'מצלמים את השרטוט',
        say: 'עמדו מול הדף ליד הקיר וצלמו אותו - והשרטוט שלכם.',
        lines: T ? [['כפתור המצלמה 📷', 'ליד הדף: מצלמים']] : [['F', 'ליד הדף: מצלמים']],
        tip: 'מצלמים ברגל: במכונית? צאו ממנה ליד הדף.',
      };
    case 'getin':
      return {
        title: 'חוזרים למכונית',
        say: 'את מה שמציירים על מכונית - מציירים כשיושבים בה. המכונית מסומנת במפה.',
        lines: T ? [['כפתור הרכב', 'ליד הדלת: נכנסים']] : [['E', 'ליד הדלת: נכנסים']],
      };
    // (round 17, the player's word: in the car - the pen draws on it, the turbo first, the game showing
    // how it is drawn; on foot, the short list as before: 'drawFoot')
    // (R27: the turbo is the blueprint just photographed)
    case 'draw':
      return {
        step: 8, of: OF, title: 'מציירים את הטורבו',
        say: 'זה הטורבו שצילמתם. ציירו אותו על המכונית - להבה שיוצאת מאחוריה - והיא תזנק קדימה.',
        lines: T
          ? [['כפתור העיפרון', 'פותח את העט'], ['להבה מאחורי המכונית', 'זה טורבו - העיפרון על המסך מראה איך'], ['מרימים את האצבע', 'והטורבו עליה']]
          : [['Q', 'פותח את העט'], ['להבה מאחורי המכונית', 'זה טורבו - העיפרון על המסך מראה איך'], ['משחררים את העכבר', 'והטורבו עליה']],
        tip: 'מכאן והלאה: כל שרטוט שמוצאים בעיר מציירים פעם אחת, והוא שלכם. אלה שבהמשך משוגעים יותר.',
      };
    case 'boost':
      return {
        step: 8, of: OF, title: 'טורבו!',
        say: 'צברו קצת מהירות ולחצו טורבו.',
        lines: T ? [['כפתור הטורבו', 'מזנקים קדימה']] : [['Shift', 'מזנקים קדימה']],
      };
    case 'drawFoot':
      return {
        step: 6, of: OF, title: 'מציירים - וזה נהיה אמיתי!',
        say: 'מה שמציירים קם לחיים. בעיפרון יש לכם כמה נשקים ורכבים - כל אחד מציירים פעם אחת, ומאז הוא שלכם. את השאר מוצאים בעיר.',
        lines: T
          ? [['כפתור העיפרון', 'פותח את הרשימה'], ['נגיעה בציור', 'ומציירים אותו באוויר, כמו בתמונה'], ['✓', 'והוא נוצר - ונשמר אצלכם לפעם הבאה']]
          : [['Q', 'פותח את הרשימה'], ['לחיצה על ציור', 'ומציירים אותו באוויר, כמו בתמונה'], ['Q', 'שוב: והוא נוצר - ונשמר אצלכם לפעם הבאה']],
        tip: 'וגם במכונית: טורבו, מקלע, שריון, כנפיים - מציירים כל אחד פעם אחת.',
      };
    case 'lily':
      return {
        step: 9, of: OF, title: 'הולכים לפגוש את לילי',
        say: 'הבת של דני מחכה לו ליד דוכן הגלידה בטיילת.',
        lines: T
          ? [['המפה', 'הנקודה הצהובה היא היעד, והחץ מראה את הדרך'], ['כפתור הרכב', 'אם אתם במכונית: יוצאים ממנה ליד הדוכן']]
          : [['המפה', 'הנקודה הצהובה היא היעד, והחץ מראה את הדרך'], ['E', 'אם אתם במכונית: יוצאים ממנה ליד הדוכן']],
      };
    case 'pier':
      return {
        title: 'הולכים עם לילי למזח',
        say: 'לילי רוצה לראות את הגלגל הענק. היא הולכת איתכם.',
        lines: [['המפה', 'הנקודה מראה לאן']],
      };
    case 'follow':
      return {
        title: 'הולכים אחריו!',
        say: 'מי זה האיש עם הסמל המוזר? לכו אחריו לפני שהוא נעלם.',
        lines: T ? [['ג׳ויסטיק', 'ללכת אחריו']] : [['W', 'ללכת'], ['Shift', 'לרוץ']],
        tip: 'הוא מסומן במפה.',
      };
    case 'back':
      return {
        title: 'חוזרים ללילי',
        say: 'הוא נעלם בקהל. לילי מחכה ליד המעקה - והיא רוצה להראות לכם משהו.',
        lines: [['המפה', 'הנקודה היא לילי']],
      };
    case 'site':
      return {
        title: 'מה קרה לגלגל?!',
        say: 'לכו לקצה המזח, למקום שבו הוא עמד, ותשאלו מישהו. לילי באה איתכם.',
        lines: [['המפה', 'הנקודה היא המקום']],
      };
    case 'tocar':
      return {
        title: 'הולכים למכונית',
        say: 'המכונית של דני חונה כאן קרוב, בצד הכביש - החץ הצהוב מעליה. לילי באה איתכם.',
        lines: [['המפה', 'הנקודה היא המכונית']],
      };
    case 'climb':
      return {
        title: 'בורחים!',
        say: 'הם רודפים אחריכם ויורים צבע. עלו ברמפות, קומה אחרי קומה, עד הגג. מכוניות שלהם מחכות בחושך.',
        lines: T ? (btns() ? [['◀ ▶', 'הגה'], ['גז', 'הדוושה מימין'], ['בלם יד', 'בפניות']] : [['ג׳ויסטיק', 'גז והגה']]) : [['W', 'גז'], ['A D', 'הגה'], ['Space', 'בלם יד בפניות']],
        tip: 'סעו מהר וזגזגו: לאט מדי, והצבע פוגע. הפס הצבעוני למטה הוא כוח המכונית.',
      };
    // (ROADMAP 23.19: the chase's gun)
    case 'gun':
      return {
        title: 'יורים בחזרה!',
        say: 'ציירו על המכונית מקלע. הוא עולה על הגג ומכוון לבד אל מי שרודף אחריכם.',
        lines: T
          ? [['כפתור העיפרון', 'פותח את העט - העיר מאטה בזמן הציור'], ['מקלע', 'מציירים כמו בציור שבעט'], ['כפתור האש', 'מחזיקים: יורה על הרודפים']]
          : [['Q', 'פותח את העט - העיר מאטה בזמן הציור'], ['מקלע', 'מציירים כמו בציור שבעט'], ['לחצן העכבר', 'מחזיקים: יורה על הרודפים']],
        tip: 'מכונית שנפגעת מעשנת, נדלקת - ומתפוצצת. הקנה מתחמם: יורים בצרורות.',
      };
    case 'floor':
      return {
        title: 'גז עד הסוף!',
        say: 'סעו ישר לקצה הגג, ואל תעצרו.',
        lines: T ? (btns() ? [['גז', 'לוחצים ולא עוזבים']] : [['ג׳ויסטיק', 'קדימה עד הסוף']]) : [['W', 'גז עד הסוף']],
      };
    case 'ramp':
      return {
        title: 'עולים על הרמפה!',
        say: 'הרמפה שציירתם מחכה. סעו עליה במלוא המהירות.',
        lines: T ? (btns() ? [['גז', 'לוחצים ולא עוזבים']] : [['ג׳ויסטיק', 'קדימה עד הסוף']]) : [['W', 'גז עד הסוף']],
      };
    // (round 12) the second drawing: a rotor, in the air
    case 'rotor':
      return {
        title: 'ציירו רוטור - מהר!',
        say: 'המכונית נופלת! ציירו X גדול מעל הגג שלה - מדחף של מסוק - לפני שהזמן למעלה נגמר.',
        lines: T ? [['אצבע', 'קו אחד באלכסון, ואז קו שני שחוצה אותו']] : [['עכבר', 'קו אחד באלכסון, ואז קו שני שחוצה אותו']],
        tip: 'העיפרון מראה איפה ואיך.',
      };
    case 'fly':
      return {
        title: 'טסים!',
        say: 'הרוטור מחזיק אתכם באוויר. טוסו לחוף ונחתו על החול.',
        lines: T ? (btns() ? [['◀ ▶', 'הגה'], ['גז', 'קדימה'], ['▲ ▼', 'למעלה ולמטה']] : [['ג׳ויסטיק', 'קדימה והגה'], ['▲ ▼', 'למעלה ולמטה']]) : [['W A D', 'קדימה והגה'], ['Space', 'למעלה'], ['C', 'למטה']],
        tip: 'החץ במפה מראה את החוף.',
      };
    case 'down':
      return {
        title: 'יורדים לרחוב',
        say: 'נחתתם! עכשיו רדו ברמפות של החניון הזה אל הרחוב.',
        lines: [['המפה', 'החץ מראה את הדרך למטה']],
      };
    case 'lose':
      return {
        title: 'מתחמקים מהם',
        say: 'הם עדיין אחריכם. התרחקו מהם - או סעו אל החוף. לשם הם לא ייכנסו.',
        lines: T ? (btns() ? [['◀ ▶', 'הגה'], ['גז', 'הדוושה מימין']] : [['ג׳ויסטיק', 'גז והגה']]) : [['W', 'גז'], ['A D', 'הגה']],
      };
    case 'quiet':
      return {
        title: 'מוצאים מקום שקט',
        say: 'סעו אל החוף, ועצרו שם.',
        lines: [['המפה', 'הנקודה היא המקום']],
      };
    default:
      return null;
  }
}

// (round 16) the same cards in English
function howtoEn(key, touch) {
  const T = !!touch;
  switch (key) {
    case 'explore':
      return {
        step: 1, of: OF, title: 'Walk around the city',
        say: 'This is Danny, and you control him. Take a few seconds to get to know the city.',
        lines: T ? [['Stick', 'walk (further from the middle: run)'], ['Drag', 'on the screen: look around']] : [['W A S D', 'walk'], ['Shift', 'hold: run'], ['Mouse', 'look around']],
        tip: 'The small map, top left: the arrow is you.',
      };
    case 'shop':
      return {
        step: 2, of: OF, title: 'Go into a shop',
        say: 'Any shop with its door open can be walked into: to buy, to eat, or just to look.',
        lines: T ? [['Walk', 'to an open door, and in']] : [['W', 'walk to an open door, and in']],
        tip: 'Not a must. If you do not go in, the next step comes on its own in a moment.',
      };
    case 'inside':
      return {
        step: 2, of: OF, title: 'You are in!',
        say: 'Go up to the counter or a shelf - and buy there.',
        lines: T ? [['Button', 'by the counter: buy']] : [['E', 'by the counter or the shelf: buy']],
      };
    case 'car':
      return {
        step: 3, of: OF, title: 'Take a car',
        say: 'The nearest parked car is marked on your map. Walk up to its door.',
        lines: T ? [['Car button', 'by the door: in - and it is yours']] : [['E', 'by the door: in - and it is yours']],
        tip: 'Any car parked in the street can be yours.',
      };
    case 'drive':
      return {
        step: 4, of: OF, title: 'Drive',
        say: 'Drive a little through the streets, to get the feel of the car.',
        lines: T ? (btns() ? [['◀ ▶', 'steer'], ['Gas, brake', 'the pedals on the right'], ['Car button', 'get out of the car']] : [['Stick', 'gas, brake and steering'], ['Car button', 'get out of the car']]) : [['W', 'gas'], ['S', 'brake, and reverse'], ['A D', 'steer'], ['Space', 'handbrake (for drifts)'], ['E', 'get out of the car']],
      };
    case 'wings':
      return {
        step: 5, of: OF, title: 'Draw - and it comes to life!',
        say: 'What you draw becomes real. Draw wings on the car - the pencil on the screen shows how, then you.',
        lines: T
          ? [['Pencil button', 'opens the pen'], ['Wings over the car', 'as the pencil draws them - roughly, it need not be exact'], ['Lift your finger', 'and the wings are on']]
          : [['Q', 'opens the pen'], ['Wings over the car', 'as the pencil draws them - roughly, it need not be exact'], ['Let go of the mouse', 'and the wings are on']],
        tip: 'Each thing is drawn once - from then on it\'s yours, at a tap. At speed and in a jump the car glides.',
      };
    case 'getout':
      return {
        step: 6, of: OF, title: 'Out of the car',
        say: 'The library\'s weapons are drawn on foot.',
        lines: T ? [['Car button', 'get out of the car']] : [['E', 'get out of the car']],
      };
    case 'weapon':
      return {
        step: 6, of: OF, title: 'A weapon from the library',
        say: 'The pencil holds a library of weapons and rides. Draw the pencil rifle: the pencil on the screen draws it first - then you, over its lines.',
        lines: T
          ? [['Pencil button', 'opens the library'], ['Draw over the lines', 'roughly like the picture'], ['✓', 'and the rifle is in your hands']]
          : [['Q', 'opens the library'], ['Draw over the lines', 'roughly like the picture'], ['Q', 'again: and the rifle is in your hands']],
        tip: 'Everything in the library is drawn once. From then on it\'s ready at a tap.',
      };
    case 'fire':
      return {
        step: 6, of: OF, title: 'Fire it',
        say: 'Try the rifle: aim and fire.',
        lines: T ? [['Aim button', 'hold: aim'], ['Fire button', 'fire']] : [['Right click', 'hold: aim'], ['Click', 'fire']],
      };
    case 'find':
      return {
        step: 7, of: OF, title: 'A blueprint hidden in the city',
        say: 'Blueprints are hidden all over the city - weapons, rides, parts. One is close, and the map marks it.',
        lines: [['Map', 'the dot is the blueprint, the arrow shows the way'], ['A white page, gold lines', 'on a wall in an alley'], ['Come close', 'and you hear a pencil scratching']],
        tip: 'Most blueprints are not on the map - those you hunt for in alleys and up on roofs.',
      };
    case 'photo':
      return {
        step: 7, of: OF, title: 'Photograph the blueprint',
        say: 'Stand in front of the page by the wall and photograph it - and the blueprint is yours.',
        lines: T ? [['Camera button 📷', 'by the page: take the photo']] : [['F', 'by the page: take the photo']],
        tip: 'Photos are taken on foot: in a car? Get out by the page.',
      };
    case 'getin':
      return {
        title: 'Back in the car',
        say: 'What is drawn on a car is drawn sitting in it. The car is marked on the map.',
        lines: T ? [['Car button', 'by the door: get in']] : [['E', 'by the door: get in']],
      };
    case 'draw':
      return {
        step: 8, of: OF, title: 'Draw the turbo',
        say: 'This is the turbo you photographed. Draw it on the car - a flame out of its back - and it leaps forward.',
        lines: T
          ? [['Pencil button', 'opens the pen'], ['A flame behind the car', 'is a turbo - the pencil on the screen shows how'], ['Lift your finger', 'and the turbo is on']]
          : [['Q', 'opens the pen'], ['A flame behind the car', 'is a turbo - the pencil on the screen shows how'], ['Let go of the mouse', 'and the turbo is on']],
        tip: 'From here on: every blueprint found in the city is drawn once, and it is yours. The later ones are crazier.',
      };
    case 'boost':
      return {
        step: 8, of: OF, title: 'Turbo!',
        say: 'Pick up a little speed and hit the turbo.',
        lines: T ? [['Turbo button', 'leap forward']] : [['Shift', 'leap forward']],
      };
    case 'drawFoot':
      return {
        step: 6, of: OF, title: 'Draw - and it comes to life!',
        say: 'What you draw becomes real. The pencil holds a few weapons and rides - draw each one once and it\'s yours. The rest are found in the city.',
        lines: T
          ? [['Pencil button', 'opens the list'], ['Touch a drawing', 'and draw it in the air, like the picture'], ['✓', 'and it is made - and kept for next time']]
          : [['Q', 'opens the list'], ['Click a drawing', 'and draw it in the air, like the picture'], ['Q', 'again: it is made - and kept for next time']],
        tip: 'In a car too: a turbo, a machine gun, armor, wings - draw each one once.',
      };
    case 'lily':
      return {
        step: 9, of: OF, title: 'Go and meet Lily',
        say: 'Danny\'s daughter is waiting for him by the ice cream stand on the promenade.',
        lines: T ? [['Map', 'the yellow dot is where to go, the arrow shows the way'], ['Car button', 'in a car: get out by the stand']] : [['Map', 'the yellow dot is where to go, the arrow shows the way'], ['E', 'in a car: get out by the stand']],
      };
    case 'pier':
      return { title: 'Walk with Lily to the pier', say: 'Lily wants to see the giant wheel. She walks with you.', lines: [['Map', 'the dot shows where']] };
    case 'follow':
      return {
        title: 'Follow him!',
        say: 'Who is the man with the strange mark? Follow him before he is gone.',
        lines: T ? [['Stick', 'follow him']] : [['W', 'walk'], ['Shift', 'run']],
        tip: 'He is marked on the map.',
      };
    case 'back':
      return { title: 'Back to Lily', say: 'He is lost in the crowd. Lily is waiting by the railing - and she wants to show you something.', lines: [['Map', 'the dot is Lily']] };
    case 'site':
      return { title: 'What happened to the wheel?!', say: 'Go to the end of the pier, where it stood, and ask someone. Lily comes with you.', lines: [['Map', 'the dot is the place']] };
    case 'tocar':
      return { title: 'To the car', say: 'Danny\'s car is parked close by, at the side of the road - the yellow arrow is over it. Lily comes with you.', lines: [['Map', 'the dot is the car']] };
    case 'climb':
      return {
        title: 'Get away!',
        say: 'They are after you, shooting paint. Up the ramps, floor after floor, to the roof. Their cars wait in the dark.',
        lines: T ? (btns() ? [['◀ ▶', 'steer'], ['Gas', 'the pedal on the right'], ['Handbrake', 'in the turns']] : [['Stick', 'gas and steering']]) : [['W', 'gas'], ['A D', 'steer'], ['Space', 'handbrake in the turns']],
        tip: 'Drive fast and zigzag: too slow, and the paint hits. The coloured bar below is the car\'s strength.',
      };
    case 'gun':
      return {
        title: 'Shoot back!',
        say: 'Draw a machine gun on the car. It goes on the roof and aims by itself at whoever is after you.',
        lines: T
          ? [['Pencil button', 'opens the pen - the city slows while you draw'], ['Machine gun', 'draw it like the picture in the pen'], ['Fire button', 'hold: it fires at them']]
          : [['Q', 'opens the pen - the city slows while you draw'], ['Machine gun', 'draw it like the picture in the pen'], ['Mouse button', 'hold: it fires at them']],
        tip: 'A car that is hit smokes, burns - and blows up. The barrel runs hot: fire in bursts.',
      };
    case 'floor':
      return { title: 'Floor it!', say: 'Drive straight to the edge of the roof, and do not stop.', lines: T ? (btns() ? [['Gas', 'hold it down, do not let go']] : [['Stick', 'forward, all the way']]) : [['W', 'gas, all the way']] };
    case 'ramp':
      return { title: 'Up the ramp!', say: 'The ramp you drew is waiting. Drive onto it at full speed.', lines: T ? (btns() ? [['Gas', 'hold it down, do not let go']] : [['Stick', 'forward, all the way']]) : [['W', 'gas, all the way']] };
    case 'rotor':
      return {
        title: 'Draw a rotor - fast!',
        say: 'The car is falling! Draw a big X over its roof - a helicopter\'s rotor - before the time at the top runs out.',
        lines: T ? [['Finger', 'one line corner to corner, then one across it']] : [['Mouse', 'one line corner to corner, then one across it']],
        tip: 'The pencil shows where and how.',
      };
    case 'fly':
      return {
        title: 'Flying!',
        say: 'The rotor holds you up. Fly to the beach and land on the sand.',
        lines: T ? (btns() ? [['◀ ▶', 'steer'], ['Gas', 'forward'], ['▲ ▼', 'up and down']] : [['Stick', 'forward and steer'], ['▲ ▼', 'up and down']]) : [['W A D', 'forward and steer'], ['Space', 'up'], ['C', 'down']],
        tip: 'The arrow on the map shows the beach.',
      };
    case 'down':
      return { title: 'Down to the street', say: 'You landed! Now take this car park\'s ramps down to the street.', lines: [['Map', 'the arrow shows the way down']] };
    case 'lose':
      return { title: 'Shake them off', say: 'They are still after you. Get away from them - or drive to the beach. They will not go there.', lines: T ? (btns() ? [['◀ ▶', 'steer'], ['Gas', 'the pedal on the right']] : [['Stick', 'gas and steering']]) : [['W', 'gas'], ['A D', 'steer']] };
    case 'quiet':
      return { title: 'Find a quiet place', say: 'Drive to the beach, and stop there.', lines: [['Map', 'the dot is the place']] };
    default:
      return null;
  }
}
