// The city's day (ROADMAP 1.3): how busy it is at each hour. The roads fill up in the morning and
// the evening and empty out at night; fewer people are out late, and different ones: joggers on
// the promenade and people hurrying to work with a coffee in the morning, people dressed to go
// out at night (and no children). Most shops close at night behind a rolled-down shutter
// (game/shutters.js); some never do.
//
// At the evening's hour, when the city was first drawn (18:18, a rush hour), everything is
// exactly as it always was.

// [hour, value] keys, joined by straight lines
function curve(keys) {
  return (h) => {
    for (let i = 1; i < keys.length; i++) {
      if (h <= keys[i][0]) {
        const a = keys[i - 1];
        const b = keys[i];
        return a[1] + (b[1] - a[1]) * ((h - a[0]) / (b[0] - a[0]));
      }
    }
    return keys[keys.length - 1][1];
  };
}

// how many cars of the most there can be (the rush hours: 7:30 to 9:30, 16:30 to 20:00)
const CARS = curve([[0, 0.42], [1.5, 0.3], [5, 0.3], [6.5, 0.65], [7.4, 1], [9.4, 1], [10.6, 0.72], [15.4, 0.72], [16.6, 1], [19.8, 1], [21, 0.62], [23.5, 0.45], [24, 0.42]]);
// how many people of the most there can be
const PEOPLE = curve([[0, 0.5], [2, 0.3], [5, 0.22], [6.5, 0.5], [8, 0.85], [9.5, 1], [22, 1], [23.5, 0.62], [24, 0.5]]);
// the chance that somebody new on the street is out running
const JOG = curve([[0, 0.03], [5, 0.04], [6, 0.32], [8.6, 0.32], [10, 0.07], [20.5, 0.07], [22, 0.03], [24, 0.03]]);
// on the way to work: in a hurry, a coffee or a bag in hand, dressed for the office
const COMMUTE = curve([[0, 0], [6.4, 0], [7.4, 1], [9.2, 1], [10.2, 0], [24, 0]]);
// the night out: the club's line is longer, people are dressed to go out, the families are home
const NIGHT = curve([[0, 1], [3.5, 1], [5, 0], [20.5, 0], [22, 1], [24, 1]]);

// when the shops of each kind are open ([from, until], until past 24 is after midnight; null:
// always), the rest 8:00 to 22:00. At 18:18 every one of them is open.
const SHOP_HOURS = {
  tacos: null, lobby: null, pharmacy: null, diner: null,
  bar: [11, 26], cinema: [11, 24.5], arcade: [10, 25], pizza: [11, 25], falafel: [11, 26], sushi: [11.5, 23], icecream: [10, 23.5],
  cafe: [6.5, 21], grocery: [7, 23], deli: [7, 20], bagel: [6, 19], flowers: [8, 20], books: [9, 21.5], hardware: [7.5, 19],
  laundry: [7, 22], shop: [9, 21], phones: [9, 21], optics: [9, 19], gym: [6, 23], music: [10, 22], barber: [9, 20],
  juice: [7.5, 20], surf: [8, 19.5], boutique: [10, 21], friends: [9, 22.5],
  // (the lines outside: the club's doors open at six, the cinema's last show is at midnight)
  club: [18, 28],
};

// clothes for the morning's way to work and for the night out (looks.js kinds)
export const WORK_CLOTHES = ['smart', 'trench', 'smart', 'denim'];
export const NIGHT_CLOTHES = ['chic', 'street', 'bomber', 'chic', 'puffer'];

export function shopOpen(kind, h) {
  const r = SHOP_HOURS[kind];
  if (r === null) return true;
  const [a, b] = r || [8, 22];
  return (h >= a && h < b) || (b > 24 && h < b - 24);
}

// does a shop of this kind ever close?
export function shopCloses(kind) {
  return SHOP_HOURS[kind] !== null;
}

export class Rhythm {
  constructor(game) {
    this.game = game;
    this.update();
  }

  get hour() {
    return this.game.daynight ? this.game.daynight.hour : 18.3;
  }

  update() {
    const h = this.hour;
    this.cars = CARS(h);
    this.people = PEOPLE(h);
    this.jog = JOG(h);
    this.commute = COMMUTE(h);
    this.night = NIGHT(h);
  }

  open(kind) {
    return shopOpen(kind, this.hour);
  }
}
