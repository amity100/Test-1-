export type Lang = 'en' | 'he';

const STR = {
  en: {
    title: 'THRESHOLD',
    subtitle: 'A RIFT STEALTH OPERATION',
    play: 'START MISSION',
    resume: 'RESUME',
    restart: 'RESTART MISSION',
    retry: 'RETRY FROM CHECKPOINT',
    controls: 'CONTROLS',
    settings: 'SETTINGS',
    back: 'BACK',
    quit: 'MAIN MENU',
    loading: 'Loading',
    clickToPlay: 'CLICK TO DEPLOY',
    tapToPlay: 'TAP TO DEPLOY',
    rift: 'RIFT',
    open: 'OPEN',
    cancel: 'CANCEL',
    distance: 'DIST',
    paused: 'PAUSED',
    missionName: 'OPERATION NIGHT HARBOR',
    briefing: 'Kessler Maritime is moving weapons through Pier 9 under a legal front. Their cargo manifest sits in the warehouse office. Get in, take it, get out on the boat. Nobody needs to know you were there.',
    objManifest: 'Steal the cargo manifest from the warehouse office',
    objExtract: 'Reach the extraction boat at the pier',
    objOptKeycard: 'Optional: take the officer\'s keycard',
    objOptGenerator: 'Optional: sabotage the rift inhibitor',
    quality: 'Graphics quality',
    sensitivity: 'Look sensitivity',
    invertY: 'Invert look',
    focusSlow: 'Slow time while aiming',
    language: 'Language',
    low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra',
    on: 'On', off: 'Off',
    takedown: 'TAKEDOWN',
    snatch: 'SNATCH',
    grab: 'PICK UP BODY',
    throw: 'THROW',
    drop: 'DROP',
    takeKeycard: 'TAKE KEYCARD',
    useKeycard: 'SWIPE KEYCARD',
    locked: 'LOCKED — KEYCARD REQUIRED',
    sabotage: 'SABOTAGE INHIBITOR',
    takeManifest: 'TAKE MANIFEST',
    extract: 'EXTRACT',
    enterRift: 'STEP THROUGH',
    missionComplete: 'MISSION COMPLETE',
    missionFailed: 'MISSION FAILED',
    time: 'Time',
    detections: 'Times spotted',
    kills: 'Takedowns',
    bodiesFound: 'Bodies found',
    riftsUsed: 'Rifts opened',
    rating: 'Rating',
    ghost: 'GHOST',
    shadow: 'SHADOW',
    assassin: 'ASSASSIN',
    blunt: 'LOUD',
    noCharge: 'NO RIFT CHARGE',
    tooClose: 'TOO CLOSE',
    outOfRange: 'OUT OF RANGE',
    noSpace: 'NO ROOM',
    blocked: 'NO LINE OF SIGHT',
    inhibited: 'RIFT INHIBITED',
    anchorSet: 'ANCHOR SET',
    noAnchor: 'NO ANCHOR — HOLD R TO SET ONE',
    noAnchorTouch: 'NO ANCHOR — HOLD ⚓ TO SET ONE',
    snapBehind: 'BEHIND TARGET',
    snapAbove: 'DROP ATTACK',
    snapShadow: 'IN SHADOW',
    seenRed: 'EXPOSED',
    seenYellow: 'RISKY',
    seenGreen: 'UNSEEN',
    radioCheck: '“{name}, radio check. Respond.”',
    bodyFound: '“Man down! We have an intruder!”',
    heardSomething: '“What was that?”',
    alarmBark: '“Contact! Open fire!”',
    searchBark: '“Spread out. Find them.”',
    lostBark: '“Must have been nothing…”',
    manifestTaken: 'Manifest secured. Get to the boat.',
    keycardTaken: 'Keycard acquired.',
    doorOpened: 'Office door unlocked.',
    inhibitorDown: 'Inhibitor disabled — rifts work in the office now.',
    checkpoint: 'Checkpoint',
    anchorHint: 'Tip: an Anchor is your hideout. Bodies you throw through it land there.',
    hintMove: 'Stay in the dark. The fence is see-through — rifts are not blocked by it.',
    hintAimKbm: 'Hold <b>RIGHT MOUSE</b> to aim a rift — time slows down.',
    hintAimPad: 'Hold <b>LT</b> to aim a rift — time slows down.',
    hintAimTouch: 'Tap <b>RIFT</b> to aim — drag to place it.',
    hintOpenKbm: '<b>LEFT CLICK</b> opens it. <b>WHEEL</b> = distance, <b>Q/E</b> = facing. Then walk through.',
    hintOpenPad: '<b>RT</b> opens it. <b>LB/RB</b> = distance, <b>D-pad</b> = facing.',
    hintOpenTouch: 'Tap <b>OPEN</b>. Slide <b>DIST</b> for distance, ⟲⟳ for facing. Then walk through.',
    hintTakedown: 'Aim near an unaware guard — the rift snaps <b>behind him</b>. Step through and press <b>F</b>.',
    hintTakedownTouch: 'Aim near an unaware guard — the rift snaps <b>behind him</b>. Step through and tap the action button.',
    hintSnatch: 'Standing at your side of an open rift with a guard at the other end? <b>SNATCH</b> pulls him through.',
    hintBody: 'Bodies left in sight raise the alarm. Carry them, or throw them through a rift.',
    hintAnchorKbm: 'Hold <b>R</b> to drop an Anchor in a dark corner. Tap <b>R</b> later to open a rift straight to it.',
    hintAnchorTouch: 'Hold <b>⚓</b> to drop an Anchor in a dark corner. Tap it later to open a rift straight to it.',
    controlsHtml: `
      <div class="ctl-grid">
        <div><b>WASD</b><span>Move</span></div>
        <div><b>Mouse</b><span>Look</span></div>
        <div><b>Shift</b><span>Sprint (loud)</span></div>
        <div><b>C</b><span>Crouch (quiet)</span></div>
        <div><b>Space</b><span>Jump / climb</span></div>
        <div><b>F</b><span>Takedown · Snatch · Carry · Throw · Use</span></div>
        <div class="hl"><b>Right mouse (hold)</b><span>Aim rift — time slows</span></div>
        <div class="hl"><b>Left click</b><span>Open rift</span></div>
        <div class="hl"><b>Wheel</b><span>Rift distance</span></div>
        <div class="hl"><b>Q / E</b><span>Rift facing</span></div>
        <div class="hl"><b>Alt (hold)</b><span>Free placement (no snapping)</span></div>
        <div class="hl"><b>R</b><span>Tap: rift to Anchor · Hold: set Anchor</span></div>
        <div><b>X / Middle mouse</b><span>Close all rifts</span></div>
        <div><b>Tab</b><span>Tactical view (vision cones)</span></div>
        <div><b>Esc</b><span>Pause</span></div>
      </div>
      <p class="ctl-note">Gamepad: LT aim · RT open · LB/RB distance · D-pad facing · X action · Y anchor · B crouch · A jump</p>`,
  },
  he: {
    title: 'THRESHOLD',
    subtitle: 'מבצע התגנבות בפורטלים',
    play: 'התחל משימה',
    resume: 'המשך',
    restart: 'התחל משימה מחדש',
    retry: 'נסה שוב מנקודת השמירה',
    controls: 'שליטה',
    settings: 'הגדרות',
    back: 'חזרה',
    quit: 'תפריט ראשי',
    loading: 'טוען',
    clickToPlay: 'לחץ כדי להתחיל',
    tapToPlay: 'גע כדי להתחיל',
    rift: 'פורטל',
    open: 'פתח',
    cancel: 'ביטול',
    distance: 'מרחק',
    paused: 'מושהה',
    missionName: 'מבצע נמל הלילה',
    briefing: 'חברת קסלר ימית מבריחה נשק דרך רציף 9 תחת כיסוי חוקי. מסמך המטען נמצא במשרד של המחסן. תיכנס, תיקח אותו ותצא בסירה. אף אחד לא צריך לדעת שהיית שם.',
    objManifest: 'גנוב את מסמך המטען ממשרד המחסן',
    objExtract: 'הגע לסירת החילוץ ברציף',
    objOptKeycard: 'רשות: קח את כרטיס המפתח מהקצין',
    objOptGenerator: 'רשות: חבל במחולל חוסם הפורטלים',
    quality: 'איכות גרפיקה',
    sensitivity: 'רגישות מבט',
    invertY: 'היפוך מבט',
    focusSlow: 'האטת זמן בזמן כיוון',
    language: 'שפה',
    low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', ultra: 'אולטרה',
    on: 'פעיל', off: 'כבוי',
    takedown: 'חיסול',
    snatch: 'חטיפה',
    grab: 'הרם גופה',
    throw: 'זרוק',
    drop: 'הנח',
    takeKeycard: 'קח כרטיס מפתח',
    useKeycard: 'העבר כרטיס',
    locked: 'נעול — צריך כרטיס מפתח',
    sabotage: 'חבל במחולל',
    takeManifest: 'קח את המסמך',
    extract: 'חילוץ',
    enterRift: 'עבור בפורטל',
    missionComplete: 'המשימה הושלמה',
    missionFailed: 'המשימה נכשלה',
    time: 'זמן',
    detections: 'פעמים שזוהית',
    kills: 'חיסולים',
    bodiesFound: 'גופות שנמצאו',
    riftsUsed: 'פורטלים שנפתחו',
    rating: 'דירוג',
    ghost: 'רוח רפאים',
    shadow: 'צל',
    assassin: 'מתנקש',
    blunt: 'רועש',
    noCharge: 'אין מטען פורטל',
    tooClose: 'קרוב מדי',
    outOfRange: 'מחוץ לטווח',
    noSpace: 'אין מקום',
    blocked: 'אין קו ראייה',
    inhibited: 'פורטלים חסומים כאן',
    anchorSet: 'עוגן הוצב',
    noAnchor: 'אין עוגן — החזק R כדי להציב',
    noAnchorTouch: 'אין עוגן — החזק ⚓ כדי להציב',
    snapBehind: 'מאחורי המטרה',
    snapAbove: 'התקפה מלמעלה',
    snapShadow: 'בצל',
    seenRed: 'חשוף',
    seenYellow: 'מסוכן',
    seenGreen: 'בלתי נראה',
    radioCheck: '״{name}, בדיקת קשר. תענה.״',
    bodyFound: '״איש למטה! יש פולש!״',
    heardSomething: '״מה זה היה?״',
    alarmBark: '״מגע! אש!״',
    searchBark: '״תתפזרו. תמצאו אותו.״',
    lostBark: '״כנראה כלום…״',
    manifestTaken: 'המסמך אצלך. רוץ לסירה.',
    keycardTaken: 'השגת כרטיס מפתח.',
    doorOpened: 'דלת המשרד נפתחה.',
    inhibitorDown: 'המחולל הושבת — אפשר לפתוח פורטלים במשרד.',
    checkpoint: 'נקודת שמירה',
    anchorHint: 'טיפ: העוגן הוא המחבוא שלך. גופות שזורקים דרכו נוחתות שם.',
    hintMove: 'הישאר בחושך. הגדר שקופה — היא לא חוסמת פורטלים.',
    hintAimKbm: 'החזק <b>מקש ימני בעכבר</b> כדי לכוון פורטל — הזמן מאט.',
    hintAimPad: 'החזק <b>LT</b> כדי לכוון פורטל — הזמן מאט.',
    hintAimTouch: 'גע ב<b>פורטל</b> כדי לכוון — גרור כדי למקם.',
    hintOpenKbm: '<b>קליק שמאלי</b> פותח. <b>גלגלת</b> = מרחק, <b>Q/E</b> = כיוון יציאה. ואז פשוט תיכנס.',
    hintOpenPad: '<b>RT</b> פותח. <b>LB/RB</b> = מרחק, <b>חצים</b> = כיוון.',
    hintOpenTouch: 'גע ב<b>פתח</b>. החלק <b>מרחק</b>, ⟲⟳ לכיוון. ואז פשוט תיכנס.',
    hintTakedown: 'כוון ליד שומר שלא מודע — הפורטל נצמד <b>מאחוריו</b>. עבור ולחץ <b>F</b>.',
    hintTakedownTouch: 'כוון ליד שומר שלא מודע — הפורטל נצמד <b>מאחוריו</b>. עבור ולחץ על כפתור הפעולה.',
    hintSnatch: 'עומד מול פורטל פתוח ושומר בצד השני? <b>חטיפה</b> מושכת אותו אליך.',
    hintBody: 'גופה גלויה מפעילה אזעקה. תרים אותה, או תזרוק אותה לתוך פורטל.',
    hintAnchorKbm: 'החזק <b>R</b> כדי להציב עוגן בפינה חשוכה. לחיצה על <b>R</b> פותחת פורטל ישר אליו.',
    hintAnchorTouch: 'החזק <b>⚓</b> כדי להציב עוגן בפינה חשוכה. נגיעה פותחת פורטל ישר אליו.',
    controlsHtml: `
      <div class="ctl-grid">
        <div><b>WASD</b><span>תנועה</span></div>
        <div><b>עכבר</b><span>מבט</span></div>
        <div><b>Shift</b><span>ריצה (רועש)</span></div>
        <div><b>C</b><span>התכופפות (שקט)</span></div>
        <div><b>רווח</b><span>קפיצה / טיפוס</span></div>
        <div><b>F</b><span>חיסול · חטיפה · נשיאה · זריקה · שימוש</span></div>
        <div class="hl"><b>מקש ימני (החזקה)</b><span>כיוון פורטל — הזמן מאט</span></div>
        <div class="hl"><b>קליק שמאלי</b><span>פתיחת פורטל</span></div>
        <div class="hl"><b>גלגלת</b><span>מרחק הפורטל</span></div>
        <div class="hl"><b>Q / E</b><span>כיוון היציאה</span></div>
        <div class="hl"><b>Alt (החזקה)</b><span>מיקום חופשי (בלי הצמדה)</span></div>
        <div class="hl"><b>R</b><span>לחיצה: פורטל לעוגן · החזקה: הצבת עוגן</span></div>
        <div><b>X / גלגלת לחיצה</b><span>סגירת כל הפורטלים</span></div>
        <div><b>Tab</b><span>מבט טקטי (שדות ראייה)</span></div>
        <div><b>Esc</b><span>השהיה</span></div>
      </div>
      <p class="ctl-note">שלט: LT כיוון · RT פתיחה · LB/RB מרחק · חצים כיוון · X פעולה · Y עוגן · B התכופפות · A קפיצה</p>`,
  },
};

export type StrKey = keyof typeof STR.en;

let lang: Lang = (() => {
  try {
    const s = localStorage.getItem('threshold.lang');
    if (s === 'en' || s === 'he') return s;
  } catch {}
  return navigator.language?.startsWith('he') ? 'he' : 'en';
})();

export function getLang() { return lang; }
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('threshold.lang', l); } catch {}
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'he' ? 'rtl' : 'ltr';
}
export function t(k: StrKey, vars: Record<string, string> = {}) {
  let s: string = (STR[lang] as any)[k] ?? STR.en[k] ?? k;
  for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, b);
  return s;
}
setLang(lang);
