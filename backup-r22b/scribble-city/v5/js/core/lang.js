// (round 16, the player's word) The game's language, chosen on the start screen: Hebrew (the default)
// or English - kept in the browser. ?lang=he / ?lang=en for a test; ?subs=en as before for the film's
// subtitles alone. The story (game/prologue) speaks it: its objectives, its how-to cards, its
// thoughts and hints, its subtitles; the city's own words are Hebrew as yet.

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
  cur = v === 'en' ? 'en' : 'he';
  return cur;
}

export function setLang(v) {
  cur = v === 'en' ? 'en' : 'he';
  try {
    localStorage.setItem(KEY, cur);
  } catch (e) {
    // (not kept: this time only)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = cur;
    document.body.classList.toggle('lang-en', cur === 'en');
  }
  return cur;
}

// a word in the language chosen: tr('שלום', 'Hello')
export const tr = (he, en) => (lang() === 'en' ? en : he);
