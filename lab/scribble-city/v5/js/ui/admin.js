// (v5, ROADMAP 18.9 round 10) the maker's own door on the start screen: a password, then the
// prologue's films to watch - any scene straight away, played by itself between its films if asked
// (game/prologue/autopilot.js). Only the password's hash is kept here; a door for the maker on a page
// anyone can open, not a safe: what it shows is the game's own, which the page carries anyway.
const SALT = 'scribble-admin:';
const HASH = '65ae6586492349a4cea8a76ab1e44a4239896e391fe52ff44eafbaeaace55944';
const KEY = 'sc-admin';
const AUTO_KEY = 'sc-admin-auto';

const SCENES = [
  [1, 'הפתיחה', 'סיור בעיר, חנות, מכונית, ציור — ההדרכה'],
  [2, 'לילי', 'הפגישה ליד דוכן הגלידה'],
  [3, 'המזח והגלגל', 'האיש עם הסמל, הגלגל נמחק'],
  [4, 'איזה גלגל?', 'השאלות, הציור של לילי'],
  [5, 'הבריונים', 'העימות ליד החניון'],
  [6, 'המרדף', 'הבריחה במעלה החניון'],
  [7, 'הרמפה', 'העיפרון הענק מצייר רמפה'],
  [8, 'הקפיצה', 'מהגג אל החניון השני'],
  [9, 'הסוף', 'הירידה, הבריחה והחוף'],
];

const CSS = `
#ld-admin { position: absolute; bottom: max(12px, env(safe-area-inset-bottom)); left: max(12px, env(safe-area-inset-left)); z-index: 6; width: 38px; height: 38px; border-radius: 50%; border: 2px solid rgba(255, 248, 236, 0.35); background: rgba(20, 13, 34, 0.45); color: #fff8ec; font-size: 18px; line-height: 1; display: none; align-items: center; justify-content: center; cursor: pointer; opacity: 0.55; padding: 0; }
#ld-admin:hover, #ld-admin:focus-visible { opacity: 1; }
#loader.done #ld-admin { display: flex; }
#adm { position: absolute; inset: 0; z-index: 8; display: flex; align-items: center; justify-content: center; background: rgba(12, 8, 22, 0.72); backdrop-filter: blur(3px); direction: rtl; font-family: "Rubik", system-ui, sans-serif; }
#adm.hidden { display: none; }
#adm .adm-card { position: relative; width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; background: #fff8ec; color: #1b1430; border: 3px solid #1b1430; border-radius: 14px; box-shadow: 6px 6px 0 #1b1430; padding: 18px 18px 16px; box-sizing: border-box; }
#adm h2 { margin: 0 0 4px; font-size: 22px; }
#adm .adm-sub { margin: 0 0 12px; font-size: 13px; opacity: 0.75; }
#adm .adm-x { position: absolute; top: 8px; left: 8px; width: 32px; height: 32px; border: 0; background: none; font-size: 20px; cursor: pointer; color: #1b1430; }
#adm form { display: flex; gap: 8px; }
#adm input[type=password] { flex: 1; min-width: 0; font: inherit; font-size: 16px; padding: 10px 12px; border: 2px solid #1b1430; border-radius: 10px; background: #fff; color: #1b1430; direction: ltr; text-align: left; }
#adm .adm-go { font: inherit; font-weight: 800; font-size: 16px; padding: 10px 16px; border: 2px solid #1b1430; border-radius: 10px; background: #ffd23f; color: #1b1430; cursor: pointer; }
#adm .adm-err { min-height: 20px; margin-top: 8px; color: #c4204f; font-size: 14px; font-weight: 700; }
#adm .adm-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
#adm .adm-scene { text-align: right; font: inherit; padding: 10px 12px; border: 2px solid #1b1430; border-radius: 10px; background: #fff; color: #1b1430; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
#adm .adm-scene:hover, #adm .adm-scene:focus-visible { background: #ffd23f; }
#adm .adm-scene b { font-size: 15px; }
#adm .adm-scene b span { display: inline-block; min-width: 1.4em; color: #ff4f8b; }
#adm .adm-scene small { font-size: 12px; opacity: 0.75; line-height: 1.3; }
#adm .adm-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; flex-wrap: wrap; font-size: 14px; }
#adm .adm-row label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
#adm .adm-row input { width: 18px; height: 18px; accent-color: #ff4f8b; }
#adm .adm-out { font: inherit; font-size: 13px; background: none; border: 0; text-decoration: underline; color: #1b1430; cursor: pointer; opacity: 0.7; }
#adm .adm-tip { margin: 10px 0 0; font-size: 12px; opacity: 0.7; line-height: 1.4; }
`;

const get = (k) => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const put = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch (e) {
    // (private browsing: asked again next time)
  }
};

async function hashOf(text) {
  const c = window.crypto && window.crypto.subtle;
  if (!c) return null;
  const buf = await c.digest('SHA-256', new TextEncoder().encode(SALT + text.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function setupAdmin(game) {
  const L = document.getElementById('loader');
  const P = game && game.prologue;
  if (!L || !P || L.classList.contains('gone')) return;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  const btn = document.createElement('button');
  btn.id = 'ld-admin';
  btn.type = 'button';
  btn.title = 'מנהל';
  btn.setAttribute('aria-label', 'כניסת מנהל');
  btn.textContent = '🎬';
  const box = document.createElement('div');
  box.id = 'adm';
  box.className = 'hidden';
  box.innerHTML = `<div class="adm-card" role="dialog" aria-modal="true" aria-labelledby="adm-h">
    <button class="adm-x" type="button" aria-label="סגירה">✕</button>
    <div class="adm-lock">
      <h2 id="adm-h">כניסת מנהל</h2>
      <p class="adm-sub">הסיסמה — ותוכלו לצפות בכל סרטי הפתיחה ישר מכאן.</p>
      <form autocomplete="off"><input type="password" name="pw" placeholder="סיסמה" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="סיסמה"><button class="adm-go" type="submit">כניסה</button></form>
      <div class="adm-err" aria-live="polite"></div>
    </div>
    <div class="adm-films hidden">
      <h2>צפייה בסרטים</h2>
      <p class="adm-sub">בוחרים סצנה — והסרט מתחיל ממנה וממשיך עד סוף המשימה הראשונה.</p>
      <div class="adm-list"></div>
      <div class="adm-row">
        <label><input type="checkbox" class="adm-auto"> טייס אוטומטי — המשחק משחק את עצמו בין הסרטים</label>
        <button class="adm-out" type="button">יציאה ממצב מנהל</button>
      </div>
      <p class="adm-tip">במחשב: להחזיק Enter כדי לדלג על קטע. לחזור לתפריט הזה: לרענן את הדף.</p>
    </div>
  </div>`;
  L.appendChild(btn);
  L.appendChild(box);
  const $ = (s) => box.querySelector(s);
  const lock = $('.adm-lock');
  const films = $('.adm-films');
  const input = $('input[type=password]');
  const err = $('.adm-err');
  const auto = $('.adm-auto');
  auto.checked = get(AUTO_KEY) !== '0';
  auto.addEventListener('change', () => put(AUTO_KEY, auto.checked ? '1' : '0'));
  const list = $('.adm-list');
  for (const [n, name, what] of SCENES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'adm-scene';
    b.innerHTML = `<b><span>${n}</span>${name}</b><small>${what}</small>`;
    b.addEventListener('click', () => watch(n));
    list.appendChild(b);
  }
  const show = (open) => {
    const ok = get(KEY) === HASH;
    lock.classList.toggle('hidden', ok);
    films.classList.toggle('hidden', !ok);
    box.classList.toggle('hidden', !open);
    if (open && !ok) {
      err.textContent = '';
      input.value = '';
      setTimeout(() => input.focus(), 30);
    }
  };
  let wrong = 0;
  let busy = false;
  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const h = await hashOf(input.value || '');
    if (h === null) {
      err.textContent = 'הדפדפן הזה לא תומך בבדיקת הסיסמה (צריך https).';
      busy = false;
      return;
    }
    if (h === HASH) {
      put(KEY, HASH);
      wrong = 0;
      busy = false;
      show(true);
      return;
    }
    wrong++;
    err.textContent = 'סיסמה שגויה';
    input.select();
    // (a breath longer after each wrong one)
    setTimeout(() => {
      busy = false;
    }, Math.min(8000, 400 * wrong * wrong));
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    show(true);
  });
  $('.adm-x').addEventListener('click', () => show(false));
  box.addEventListener('click', (e) => {
    if (e.target === box) show(false);
  });
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') show(false);
  });
  $('.adm-out').addEventListener('click', () => {
    put(KEY, null);
    show(true);
  });
  const watch = (n) => {
    if (get(KEY) !== HASH) return show(true);
    const start = document.getElementById('start-btn');
    if (!start || start.disabled) return;
    P.watch(n, auto.checked);
    box.classList.add('hidden');
    // (as the start button itself: the game begins, the start screen goes)
    start.click();
  };
}
