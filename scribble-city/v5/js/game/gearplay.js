import { ITEMS, OPEN_ORDER, CATS, CAT_ORDER } from './itemcat.js';

// (ROADMAP 11.28) Not everything open: the things of the pen come as the game goes on.
//
// At the start: the machine gun, the turbo and the armour, one of each category on the car at a time.
// Each blueprint page found (game/gearpages.js: hidden about the city, and given for a mission done)
// opens the next thing, stage by stage - the rewind last. Levels 2 and 3 of a thing are bought at the
// garage (game/garage.js). The more things open, the more of a category the car carries at once (2 at
// twelve open, 3 at twenty-four). A use costs ink (game/ink.js); each has its time to be ready again.
//
// The lab (?lab=1): everything open at level 3 - or ?lv=1/2 - as it always was; with ?prog=1 the lab
// plays it as a new game does (saved apart). The regular game (ROADMAP 11.30): the same as the lab
// while every blueprint is open (the pause menu's option, ROADMAP 9.1); with it off, as a new game.

const KEY = 'scribble-city-v5-gear';
// (a level's price at the garage: 2 and 3, by the stage it opens at)
const PRICE = { 2: [0, 300, 450, 700, 1000, 1500], 3: [0, 800, 1200, 1800, 2500, 3500] };

export class GearPlay {
  constructor(game) {
    this.game = game;
    const P = game.params;
    this.lab = !!game.lab;
    this.prog = !!(P && P.get('prog') === '1');
    const lv = P ? +P.get('lv') : 0;
    this.labLv = lv >= 1 && lv <= 3 ? lv : 3;
    this.state = this.load();
  }

  // everything open, every level: the lab as it is (and the regular game, every blueprint open)
  all() {
    if (this.prog) return false;
    if (this.lab) return true;
    const A = this.game.album;
    return !!(A && A.allOpen);
  }

  // (the lab's own: nothing kept)
  labAll() {
    return this.lab && !this.prog;
  }

  // (a use costs ink: in a game, not in the lab)
  costs() {
    return !this.all();
  }

  isOpen(id) {
    return this.all() || this.state.open.includes(id);
  }

  level(id) {
    if (this.all()) return this.labLv;
    return this.state.lv[id] || 1;
  }

  // how many of a category the car carries at once (the lab: as many as fit - game/fuse.js, eight)
  slots(cat) {
    if (this.all()) return 8;
    const n = this.state.open.length;
    return n >= 24 ? 3 : n >= 12 ? 2 : 1;
  }

  // the next thing a page opens, and how many pages till a thing opens (0: open)
  next() {
    return OPEN_ORDER.find((id) => !this.isOpen(id)) || null;
  }

  pagesTo(id) {
    if (this.isOpen(id)) return 0;
    const shut = OPEN_ORDER.filter((x) => !this.isOpen(x));
    return shut.indexOf(id) + 1;
  }

  // (a drawing of a thing not open yet) what is said by it: its name and what it takes
  lockSay(id) {
    const n = this.pagesTo(id);
    return n === 1 ? 'עוד דף שרטוט אחד' : `עוד ${n} דפי שרטוט`;
  }

  // a blueprint page found: the next thing opens - its id, or null (all open)
  page(why = null) {
    if (this.all()) return null;
    const id = this.next();
    this.state.pages++;
    if (id) this.state.open.push(id);
    this.save();
    const g = this.game;
    if (g.hud) {
      if (id) g.hud.toast(`דף שרטוט${why ? ` (${why})` : ''} · נפתח: ${ITEMS[id].name}`, 'good', 3.4);
      else g.hud.toast('דף שרטוט · הכול כבר פתוח', 'info', 2.4);
    }
    if (g.audio) g.audio.play('pageflip', 0.7);
    return id;
  }

  // the garage: a level bought - its price, or null
  price(id) {
    const lv = this.level(id);
    if (lv >= 3 || !this.isOpen(id)) return null;
    return PRICE[lv + 1][ITEMS[id].stage] || 1000;
  }

  buy(id) {
    const pr = this.price(id);
    const M = this.game.money;
    if (pr === null || (M && !M.can(pr))) return false;
    // (no money in this game: free, as the rest of the garage is)
    if (M) M.pay(pr, `${ITEMS[id].name} רמה ${this.level(id) + 1}`);
    this.state.lv[id] = this.level(id) + 1;
    this.save();
    return true;
  }

  update() {}

  // ------------------------------------------------------------------ kept
  load() {
    const start = OPEN_ORDER.filter((id) => ITEMS[id].stage === 1);
    const out = { open: start.slice(), lv: {}, pages: 0, found: [] };
    if (this.labAll()) return out;
    try {
      const o = JSON.parse(localStorage.getItem(KEY + (this.lab ? '-lab' : '')) || 'null');
      if (o && Array.isArray(o.open)) {
        out.open = [...new Set([...start, ...o.open.filter((id) => ITEMS[id])])];
        out.lv = o.lv || {};
        out.pages = o.pages || 0;
        out.found = o.found || [];
      }
    } catch (err) {
      // (none kept: a new game's)
    }
    return out;
  }

  save() {
    if (this.labAll()) return;
    try {
      localStorage.setItem(KEY + (this.lab ? '-lab' : ''), JSON.stringify(this.state));
    } catch (err) {
      // (not kept: no matter)
    }
  }
}

export { CATS, CAT_ORDER };
