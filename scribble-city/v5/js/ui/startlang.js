import { lang, setLang } from '../core/lang.js';

// (round 16, the player's word) The start screen's choice of language: עברית / English - its own
// words switched at once, and the story told in it (core/lang.js).

const $ = (id) => document.getElementById(id);

const WORDS = {
  he: {
    kicker: 'חוף מיאמי · שקיעה',
    title: 'עיר השרבוטים',
    sub: 'מה שמציירים — אמיתי',
    tip: 'טיפ',
    start: 'יוצאים לעיר',
    loading: 'טוען את העטים…',
    cont: 'המשך מאיפה שהפסקתם',
    tips: [
      'מה שמציירים נהיה אמיתי: ציירו באוויר רובה, חרב או אפילו מסוק — והם בידיים שלכם.',
      'כל מכונית שחונה ברחוב יכולה להיות שלכם. רק שהמשטרה לא תראה.',
      'טורבו על המכונית — והיא טסה קדימה.',
      'ציור שציירתם פעם אחת נשמר אצלכם — ומאז הוא מוכן בלחיצה.',
      'מצלמים שלטי שרטוטים ברחבי העיר ומציירים אותם. ככל שהציור טוב יותר — הנשק חזק יותר.',
      'נכנסים לכל חנות שהדלת שלה פתוחה: לקנות, לאכול, או סתם להסתכל.',
    ],
  },
  en: {
    kicker: 'Miami Beach · Sunset',
    title: 'Scribble City',
    sub: 'What you draw is real',
    tip: 'Tip',
    start: 'Into the city',
    loading: 'Sharpening the pens…',
    cont: 'Continue where you left off',
    tips: [
      'What you draw comes to life: draw a rifle, a sword or even a helicopter in the air - and it is in your hands.',
      'Any car parked in the street can be yours. Just do not let the police see.',
      'A turbo on the car - and it shoots forward.',
      'Anything you have drawn once is kept - from then on it is ready at a touch.',
      'Photograph the blueprint signs around the city and draw them. The better the drawing, the stronger the weapon.',
      'Walk into any shop with its door open: to buy, to eat, or just to look.',
    ],
  },
};

// the start screen's words in the language chosen
export function applyStartLang() {
  const L = lang();
  const W = WORDS[L];
  document.documentElement.lang = L;
  document.body.classList.toggle('lang-en', L === 'en');
  const logo = document.querySelector('.ld-logo');
  if (logo) {
    const k = logo.querySelector('.ld-kicker');
    const h = logo.querySelector('h1');
    const s = logo.querySelector('.ld-sub');
    if (k) k.textContent = W.kicker;
    if (h) h.textContent = W.title;
    if (s) s.textContent = W.sub;
  }
  const tips = document.querySelector('.ld-tips');
  if (tips) {
    const th = tips.querySelector('.ld-tip-h');
    if (th) th.textContent = W.tip;
    tips.querySelectorAll('p').forEach((p, i) => {
      if (W.tips[i]) p.textContent = W.tips[i];
    });
    tips.dir = L === 'en' ? 'ltr' : 'rtl';
  }
  const sb = $('start-btn');
  if (sb) sb.textContent = sb.disabled ? W.loading : W.start;
  const cb = $('continue-btn');
  if (cb && cb.firstChild && cb.firstChild.nodeType === 3) cb.firstChild.textContent = W.cont;
  const pick = $('lang-pick');
  if (pick) pick.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.l === L));
}

export function setupStartLang() {
  const pick = $('lang-pick');
  if (pick) {
    pick.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-l]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      setLang(b.dataset.l);
      applyStartLang();
    });
  }
  applyStartLang();
}
