// (v5, ROADMAP 18.9) How to play, as the prologue goes: each thing the player is to do said plainly and
// kindly - what, in a word; how, each way with its keys as keys (a computer's, or a phone's buttons);
// and a tip where one helps. The cards of game/prologue/ui.js card({ step, of, title, say, lines, tip }).
// The first six are the game showing the player round (the director's tutorial: step n of 6); the
// rest come up as the story asks something of the player.

import { lang } from '../../core/lang.js';

const OF = 6;

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
    // (round 17, the player's word: in the car - the pen draws on it, the turbo first, the game showing
    // how it is drawn; on foot, the short list as before: 'drawFoot')
    case 'draw':
      return {
        step: 5, of: OF, title: 'מציירים - וזה נהיה אמיתי!',
        say: 'מה שמציירים קם לחיים. ציירו על המכונית טורבו - להבה שיוצאת מאחוריה - והיא תזנק קדימה.',
        lines: T
          ? [['כפתור העיפרון', 'פותח את העט'], ['להבה מאחורי המכונית', 'זה טורבו - העיפרון על המסך מראה איך'], ['כפתור הטורבו', 'וטסים קדימה']]
          : [['Q', 'פותח את העט'], ['להבה מאחורי המכונית', 'זה טורבו - העיפרון על המסך מראה איך'], ['Shift', 'וטסים קדימה']],
        tip: 'במכונית אפשר לצייר גם מקלע ושריון. עוד ציורים ייפתחו בהמשך.',
      };
    case 'drawFoot':
      return {
        step: 5, of: OF, title: 'מציירים - וזה נהיה אמיתי!',
        say: 'מה שמציירים קם לחיים. בינתיים יש לכם כמה נשקים וכמה רכבים - בוחרים אחד ומציירים אותו.',
        lines: T
          ? [['כפתור העיפרון', 'פותח את הרשימה'], ['נגיעה בציור', 'ומציירים אותו באוויר, כמו בתמונה'], ['✓', 'והוא נוצר - ונשמר אצלכם לפעם הבאה']]
          : [['Q', 'פותח את הרשימה'], ['לחיצה על ציור', 'ומציירים אותו באוויר, כמו בתמונה'], ['Q', 'שוב: והוא נוצר - ונשמר אצלכם לפעם הבאה']],
        tip: 'במכונית: טורבו, מקלע ושריון. עוד ציורים ייפתחו בהמשך.',
      };
    case 'lily':
      return {
        step: 6, of: OF, title: 'הולכים לפגוש את לילי',
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
    case 'draw':
      return {
        step: 5, of: OF, title: 'Draw - and it comes to life!',
        say: 'What you draw becomes real. Draw a turbo on the car - a flame out of its back - and it leaps forward.',
        lines: T
          ? [['Pencil button', 'opens the pen'], ['A flame behind the car', 'is a turbo - the pencil on the screen shows how'], ['Turbo button', 'and off you shoot']]
          : [['Q', 'opens the pen'], ['A flame behind the car', 'is a turbo - the pencil on the screen shows how'], ['Shift', 'and off you shoot']],
        tip: 'In a car you can also draw a machine gun and armour. More drawings open up later.',
      };
    case 'drawFoot':
      return {
        step: 5, of: OF, title: 'Draw - and it comes to life!',
        say: 'What you draw becomes real. For now you have a few weapons and a few rides - pick one and draw it.',
        lines: T
          ? [['Pencil button', 'opens the list'], ['Touch a drawing', 'and draw it in the air, like the picture'], ['✓', 'and it is made - and kept for next time']]
          : [['Q', 'opens the list'], ['Click a drawing', 'and draw it in the air, like the picture'], ['Q', 'again: it is made - and kept for next time']],
        tip: 'In a car: turbo, machine gun and armour. More drawings open up later.',
      };
    case 'lily':
      return {
        step: 6, of: OF, title: 'Go and meet Lily',
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
