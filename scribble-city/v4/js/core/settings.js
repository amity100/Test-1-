// The player's settings (ROADMAP 2.3), kept between visits: the three volumes, the controls, what is
// on the screen and the drawing's options. All under one key with a version number, so a save
// made by an older version still loads (what it does not know keeps its default).

const KEY = 'scribble-city-settings';
const VERSION = 1;

export const DEFAULTS = {
  sound: true,
  // the volumes, 0..1: effects (and the city's own sounds), music in places, the car radio
  fx: 1,
  music: 1,
  radio: 1,
  sens: 1,
  invertY: false,
  // the radio's words on the screen, and what people say (near you, behind you, or aloud)
  subtitles: true,
  // what people say, aloud in the browser's own voice (game/voices.js)
  voices: false,
  perf: false,
  // null: as the device likes it (the lines tremble with a mouse and keep still on a phone, a
  // phone draws with fewer colours a stroke)
  boil: null,
  reflections: null,
  quality: null,
  // (ROADMAP 9.1, not with ?classic) every blueprint open to draw from the start; off, they are
  // found in the city (photographed, bought, won, given: ui/album.js)
  allOpen: true,
};

export class Settings {
  constructor() {
    this.v = { ...DEFAULTS };
    this.load();
  }

  load() {
    let s = null;
    try {
      s = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch (e) {
      s = null;
    }
    if (!s || typeof s !== 'object' || !s.v || !(s.version <= VERSION)) return;
    for (const k of Object.keys(DEFAULTS)) {
      if (!(k in s.v)) continue;
      const d = DEFAULTS[k];
      const x = s.v[k];
      if (d === null ? x === null || typeof x === 'boolean' : typeof x === typeof d) this.v[k] = x;
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, v: this.v }));
    } catch (e) {
      // (no storage: the settings last as long as the page)
    }
  }

  get(k) {
    return this.v[k];
  }

  set(k, x) {
    if (this.v[k] === x) return;
    this.v[k] = x;
    this.save();
  }

  reset() {
    this.v = { ...DEFAULTS };
    this.save();
  }
}
