/** Things people say when you are listening and they do not know it. */
export const INTERCEPTS = [
  'אמא, אני נשאר לישון במשרד. כן, שוב.',
  'הבת שלי שאלה אותי מה אני עושה בעבודה. לא ידעתי מה לענות לה.',
  'תגיד, גם אצלך האור נדלק לבד אתמול?',
  'אני יוצא בעוד עשר דקות. מבטיח.',
  'זה לא הגיוני שזה קורה שוב.',
  'תשאיר את זה, מחר יבוא מישהו לבדוק.',
  'ראית מה השעה?',
  'אני חושבת שמישהו נגע במחשב שלי.',
  'שלוש פעמים השבוע. שלוש.',
  'תכתוב שזאת הייתה תקלה ותסגור את זה.',
  'לא סיפרתי לאף אחד. מה יש לספר?',
  'אם זה קורה עוד פעם אני מתקשר לחשמלאי.',
];

/** The name of each kind of place, as a person would say it. */
export const KIND_NAME = {
  computer: 'מחשב',
  mainframe: 'המחשב הראשי',
  camera: 'מצלמה',
  phone: 'טלפון',
  traffic: 'רמזור',
  power: 'חדר חשמל',
  door: 'דלת',
  printer: 'מדפסת',
  screen: 'מסך',
  box: 'קופסת אינטרנט',
  car: 'מכונית',
  speaker: 'רמקול',
} as const;

/** One small mark per kind. Each one means exactly one thing, nowhere else. */
export const KIND_MARK = {
  computer: '▢',
  mainframe: '▣',
  camera: '◉',
  phone: '▯',
  traffic: '⊞',
  power: '⌁',
  door: '⌷',
  printer: '⎙',
  screen: '▭',
  box: '⌸',
  car: '⊂',
  speaker: '◑',
} as const;
