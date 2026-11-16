// (round 16, the player's word) The game's language, chosen on the start screen - kept in the browser. ?lang=he / ?lang=en for
// a test; ?subs=en as before for the film's subtitles alone.
// (ROADMAP 24, the owner's word: the game is to be sold abroad - "everything, and I mean everything, in English from the start
// screen on; Hebrew for whoever wants it".) English is the default now; Hebrew is the choice. Every word the player reads is
// written tr('עברית', 'English') where it is used (the Hebrew first: it was there first). The page's own direction goes with
// it: left to right in English, right to left in Hebrew (index.html sets it before anything is drawn; setLang after a choice).
// Changing the language on the start screen loads the page again (ui/startlang.js): a module's words are read once, as it loads.

const KEY = 'scribble-city-v5-lang';
let cur = null;

export function lang() {
  if (cur) return cur;
  let v = null;
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
    if (q === 'he' || q === 'en') v = q;
    else v = localStorage.getItem(KEY);
  } catch (e) {
    // (no storage: the default)
  }
  cur = v === 'he' ? 'he' : 'en';
  return cur;
}

export function setLang(v) {
  cur = v === 'he' ? 'he' : 'en';
  try {
    localStorage.setItem(KEY, cur);
  } catch (e) {
    // (not kept: this time only)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = cur;
    document.documentElement.dir = cur === 'he' ? 'rtl' : 'ltr';
    document.body.classList.toggle('lang-en', cur === 'en');
    document.body.classList.toggle('lang-he', cur === 'he');
  }
  return cur;
}

// a word in the language chosen: tr('שלום', 'Hello')
export const tr = (he, en) => (lang() === 'en' ? en : he);

// (ROADMAP 24) the page's own words (index.html): written in English; an element's Hebrew is in its data-he (its text),
// data-he-html (its markup), data-he-title / data-he-placeholder / data-he-aria (those attributes). Put in when Hebrew is the
// language - once, as the page starts
export function applyStaticLang(root = typeof document !== 'undefined' ? document : null) {
  if (!root || lang() !== 'he') return;
  for (const el of root.querySelectorAll('[data-he]')) el.textContent = el.dataset.he;
  for (const el of root.querySelectorAll('[data-he-html]')) el.innerHTML = el.dataset.heHtml;
  for (const el of root.querySelectorAll('[data-he-title]')) el.title = el.dataset.heTitle;
  for (const el of root.querySelectorAll('[data-he-placeholder]')) el.placeholder = el.dataset.hePlaceholder;
  for (const el of root.querySelectorAll('[data-he-aria]')) el.setAttribute('aria-label', el.dataset.heAria);
}
