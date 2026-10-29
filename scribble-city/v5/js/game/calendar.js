// (v5, ROADMAP 12.3) The city's week: what is on tonight, where, and when the next one is. The
// clock's own days (game/daynight.js weekday); each event has its nights and its hours (past 24:
// on into the next morning). The phone lists them (ui/phone.js, the events app) and sets the GPS;
// when one begins, the city says so.

export const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export const EVENTS = [
  {
    id: 'inkfest', name: 'INK FEST', he: 'אינק פסט', nights: [4, 5, 6, 0], from: 20, to: 26, x: 92, z: 274,
    what: 'פסטיבל על במה צפה מול החוף: די ג׳יי, אלפי רוקדים, משאיות אוכל, ריקוד בקהל וזיקוקים בחצות',
    where: 'החוף של האי, ליד המזח',
  },
  {
    id: 'artnight', name: 'ART NIGHT', he: 'ערב אמנות', nights: [2, 5], from: 19, to: 24, x: -835, z: -857,
    what: 'עשרה קירות ציורי ענק, ציירים שמציירים מול העיניים, ג׳אז, הדפסים וקפה קובני, וקרב ציור על הבמה: 3 סיבובים, 25 שניות, והשופטים הם רשת שמזהה ציורים',
    where: 'חצר הקירות, פיינטווד',
  },
];

const hh = (h) => {
  const m = Math.round((((h % 24) + 24) % 24) * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export class Calendar {
  constructor(game) {
    this.game = game;
    this.was = new Map();
    this.t = 0;
    // (?event=inkfest: on, whatever the hour - for the tests)
    const f = game.params.get('event');
    this.forced = f ? new Set(f.split(',')) : null;
  }

  now() {
    const D = this.game.daynight;
    return { day: D ? D.weekday : 4, hour: D ? D.hour : 21 };
  }

  isOn(ev, day = null, hour = null) {
    if (this.forced) return this.forced.has(ev.id);
    const n = this.now();
    const d = day === null ? n.day : day;
    const h = hour === null ? n.hour : hour;
    for (const night of ev.nights) {
      if (d === night && h >= ev.from && h < Math.min(24, ev.to)) return true;
      if (ev.to > 24 && d === (night + 1) % 7 && h < ev.to - 24) return true;
    }
    return false;
  }

  events() {
    return EVENTS;
  }

  active(id) {
    const ev = EVENTS.find((e) => e.id === id);
    return !!ev && this.isOn(ev);
  }

  // when it starts next: { day, hour, inH } (inH: the clock's hours from now)
  next(ev) {
    const n = this.now();
    for (let k = 0; k < 8; k++) {
      const day = (n.day + k) % 7;
      if (!ev.nights.includes(day)) continue;
      const inH = k * 24 + ev.from - n.hour;
      if (inH > 0) return { day, hour: ev.from, inH };
    }
    return null;
  }

  // the clock's hours as the real minutes they take
  realMin(h) {
    const D = this.game.daynight;
    const dayMin = D && D.dayMin > 0 ? D.dayMin : 48;
    return Math.max(1, Math.round((h * dayMin) / 24));
  }

  // what the phone shows of each: on now (and till when), or when next
  status(ev) {
    if (this.isOn(ev)) return { on: true, text: `עכשיו! עד ${hh(ev.to)}` };
    const nx = this.next(ev);
    if (!nx) return { on: false, text: '' };
    const today = nx.inH < 24 && nx.day === this.now().day;
    return { on: false, text: `${today ? 'הערב' : `יום ${DAYS[nx.day]}`} ב־${hh(nx.hour)} · בעוד ${this.realMin(nx.inH)} דקות משחק` };
  }

  // the GPS to it
  go(ev) {
    const g = this.game;
    if (g.gps) g.gps.set(ev.x, ev.z, ev.he);
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1;
    const g = this.game;
    for (const ev of EVENTS) {
      const on = this.isOn(ev);
      const was = this.was.get(ev.id);
      this.was.set(ev.id, on);
      // (the moment it begins, not when the game is opened in the middle of it)
      if (on && was === false && g.state === 'play') g.hud.toast(`${ev.he} מתחיל עכשיו: ${ev.where}! (טלפון ← אירועים, לניווט)`, 'info', 6);
    }
  }
}
