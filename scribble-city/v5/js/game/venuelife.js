import * as THREE from 'three';
import { civilianLook, shopkeeperLook, bartenderLook, modest } from './looks.js';

// (v5, GTA IV round) The life of the places you sit down in (world/venues2.js lays them out; an
// OpenShop of game/streetlife.js runs each one while you are near, and hands its people to these).
//
// A restaurant, the way a real one goes through its evening: a party comes in at the door and waits
// at the host's stand; the host greets them, takes the menus and walks them to their table, and they
// follow; they sit, open the menus, talk it over; a waiter comes, takes the order (a word from each,
// the pad in his hand), takes it back to the pass and calls it into the kitchen; the cooks cook it -
// the pans on the flames, the chef at the pass - and when it is ready the chef draws the plates there
// in the air, under the warm lamps; the waiter carries them out and sets them down; they eat - the
// fork from the plate to the mouth, the knife in the other hand, a word between bites - and when they
// are done the waiter clears the plates, brings a coffee, the check; one of them pays, and the host
// says goodnight as they go; the waiter lays the table again for the next. The barman behind the
// bar polishes the glasses and mixes what the people on the stools ask for.
//
// A bar and a club: the barman serves the stools, the people at the tall tables stand and talk with
// a glass in hand, the booths and the VIPs sit together; the dancers dance (game/streetlife.js).
//
// A cinema's or a theatre's lobby: the ticket at the box office, a look at the posters, the line at
// the counter for a soda, the usher who takes the ticket at the door to the screens; in the theatre,
// to a seat in the rows.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ------------------------------------------------------------------ what they say (in English: the
// city's own words; the shop's and the place's names are its own)
const HOST_HELLO = ['Good evening! Do you have a reservation?', 'Welcome! A table for two?', 'Bonsoir! Right this way, please.', 'Good evening, welcome to {name}.'];
const GUEST_HELLO = ['Yes, under Lopez.', 'Just us two, please.', 'A table by the window, if you can.', 'We booked for eight.', 'Table for {n}, please.'];
const HOST_SEAT = ['Here you are. Enjoy your evening.', 'Your waiter will be right with you.', 'The menus. Bon appétit!'];
const WAITER_HELLO = ['Good evening! Have you decided?', 'May I take your order?', 'Tonight the chef recommends the duck.', 'Something to start with?'];
const ORDER = ['The filet, medium rare, please.', 'The risotto, please.', 'I\'ll have the sea bass.', 'Soup to start, then the lamb.', 'The tasting menu!', 'What would you recommend?', 'Sparkling water for the table.', 'The pasta, please.'];
const WAITER_OK = ['Excellent choice.', 'Very good.', 'Right away.', 'Of course.', 'Wonderful.'];
const CALL = ['Order in! Table {t}!', 'Table {t}: two mains!', 'Fire table {t}!'];
const CHEF_OK = ['Oui, chef!', 'Heard!', 'Yes, chef!'];
const SERVICE = ['Service! Table {t}!', 'Pick up, table {t}!', 'Hands, please!'];
const SERVE = ['Here we are. Bon appétit!', 'The filet... and the risotto. Enjoy!', 'Careful, the plate is hot.', 'Enjoy your meal.'];
const CLEAR = ['How was everything?', 'May I take these?', 'Did you enjoy it?'];
const CLEAR_ANS = ['Delicious, thank you!', 'Perfect.', 'Compliments to the chef!', 'We loved it.'];
const COFFEE = ['Two espressos.', 'Coffee, anyone?', 'Here are your coffees.'];
const CHECK = ['The check, please!', 'Could we have the bill?', 'Excuse me!'];
const PAID = ['Thank you, have a lovely evening!', 'Merci! Come again soon.', 'Thank you very much.'];
const BYE = ['Good night!', 'Thank you, see you soon!', 'Have a lovely evening!'];
const TOAST = ['Cheers!', 'To us!', 'To your new job!', 'Happy birthday!', 'To many more!', 'Salud!'];
// (a word between bites: one line each, in turn)
const TALK = [
  ['How is yours?', 'Divine. Try some!'],
  ['This sauce is incredible.', 'I want the recipe.'],
  ['So, how was your day?', 'Long. But this helps.', 'Cheers to that.'],
  ['We should come here more often.', 'Every Friday!'],
  ['Did you see the prices?', 'I didn\'t look.', 'Ha ha!'],
  ['The candles are a nice touch.', 'Very romantic.'],
  ['My sister got engaged!', 'No way! Tell me everything.'],
  ['I could eat this every day.', 'You say that every time.'],
  ['Is that the chef?', 'He drew my plate himself!'],
  ['Save room for dessert.', 'Always.'],
];
const BAR_ASK = ['What can I get you?', 'Another one?', 'What\'ll it be?'];
const BAR_ORDER = ['Something with mint, please.', 'A lemonade with ice.', 'Surprise me!', 'The house special.', 'Sparkling water, lime.'];
const BAR_SAY = ['Coming right up.', 'Here you go!', 'Enjoy!', 'On the house.'];
const BAR_TALK = [
  ['Come here often?', 'Every Friday.'],
  ['Great music tonight.', 'The DJ is on fire!'],
  ['I\'m off to the pool table.', 'Loser buys the next round.'],
  ['How\'s work?', 'Don\'t ask.', 'Ha!'],
  ['Did you see the game?', 'Unbelievable ending!'],
];
const USHER = ['Enjoy the show!', 'Screen two, to your left.', 'Tickets, please.', 'Thank you. Enjoy!'];
const SELLER = ['Two for the seven o\'clock?', 'Next, please!', 'Enjoy the film!'];
const MOVIE_TALK = [
  ['Is it any good?', 'Everybody says so.'],
  ['Popcorn or nachos?', 'Both!'],
  ['I heard the ending is sad.', 'Don\'t tell me!'],
  ['Look at that poster!', 'We have to see that one next.'],
];

// ------------------------------------------------------------------ the looks
function waiterLook(fem) {
  const L = civilianLook({ fem, kind: 'smart' });
  L.top = { kind: 'vest', color: [0.12, 0.12, 0.14], sleeves: 'long', under: [0.97, 0.96, 0.93] };
  L.bottom = { kind: 'pants', color: [0.12, 0.12, 0.14] };
  L.apron = [0.14, 0.14, 0.16];
  L.hat = null;
  L.acc = (L.acc || []).filter((a) => a === 'earrings');
  return modest(L);
}

function dinerLook() {
  return civilianLook({ kind: pick(['smart', 'chic', 'trench', 'knit', 'office', 'smart']) });
}

// a sit-down party's colours of drink
const DRINKS = [[0.98, 0.6, 0.2], [0.95, 0.3, 0.45], [0.5, 0.8, 0.95], [0.96, 0.88, 0.5], [0.55, 0.85, 0.4], [0.7, 0.2, 0.3]];

// ------------------------------------------------------------------ a meal at a table
// The hands of somebody eating at a table, wherever it is - the restaurant's white cloth, the
// diner's booth, the noodle bar's counter: a little saw with the knife at the plate's edge, the fork
// up to the mouth, held there a moment, down to the plate again, a rest; the other hand at the
// plate's edge. (v: hand and handL kept on it - no new vectors a frame; forkT the time into the
// round, forkP how long a round takes them)
const ease = (t) => t * t * (3 - 2 * t);

export function forkToMouth(v, sp, floor, dt) {
  const f = v.c.fig;
  v.forkT += dt;
  const T = v.forkP;
  const k = (v.forkT % T) / T;
  const sy = Math.sin(sp.yaw);
  const cy = Math.cos(sp.yaw);
  const px = sp.x + sy * 0.44;
  const pz = sp.z + cy * 0.44;
  // (the diner's right and left)
  const rx = -cy;
  const rz = sy;
  const head = f.j.headC;
  const mx = head.x + sy * 0.12;
  const my = head.y - 0.07;
  const mz = head.z + cy * 0.12;
  const py = floor + 0.84;
  let x;
  let y;
  let z;
  if (k < 0.32) {
    // cutting: a little saw at the plate
    const s = Math.sin(v.forkT * 13) * 0.025;
    x = px + rx * (0.05 + s) - sy * 0.03;
    y = py;
    z = pz + rz * (0.05 + s) - cy * 0.03;
  } else if (k < 0.5) {
    const t = ease((k - 0.32) / 0.18);
    x = px + (mx - px) * t;
    y = py + (my - py) * t;
    z = pz + (mz - pz) * t;
  } else if (k < 0.62) {
    x = mx;
    y = my;
    z = mz;
  } else if (k < 0.8) {
    const t = ease((k - 0.62) / 0.18);
    x = mx + (px - mx) * t;
    y = my + (py - my) * t;
    z = mz + (pz - mz) * t;
  } else {
    x = px + rx * 0.05;
    y = py - 0.01;
    z = pz + rz * 0.05;
  }
  v.hand.set(x + rx * 0.06, y, z + rz * 0.06);
  f.reachR = v.hand;
  v.handL.set(px - rx * 0.12, py - 0.01, pz - rz * 0.12);
  f.reachL = v.handL;
  f.lookAt = null;
}

// what is eaten with a fork (or chopsticks, or the hands) off a plate on the table; the rest of what
// a kitchen draws for a table is drunk (game/streetlife.js serveTables: v.dishShape)
const EATEN = new Set(['slice', 'pizza', 'sushi', 'pita', 'taco', 'empanada', 'burger', 'dessert', 'sandwich', 'hotdog', 'bagel', 'donut', 'fries', 'noodles', 'gourmet', 'steak', 'pasta']);
// (a word across a table between bites, in the city's everyday places)
const EAT_TALK = [
  ['This is so good.', 'Told you!'],
  ['How\'s yours?', 'Amazing. Want a bite?'],
  ['We should come here every week.', 'Deal.'],
  ['I was starving.', 'Me too!'],
  ['Pass the napkins?', 'Here.'],
  ['Did you hear what happened downtown?', 'No! Tell me.'],
  ['Best in the city.', 'Don\'t tell my mom.'],
  ['Too spicy?', 'Just right.'],
];

/**
 * Somebody at a table with a plate before them (game/streetlife.js OpenShop: any shop whose kitchen
 * sends plates out to its tables). They eat what was brought - or drink it, a glass to the lips now
 * and then - and now and then say something to whoever sits nearest them at the table.
 */
export function eatPlate(o, v, dt) {
  const c = v.c;
  const f = c.fig;
  if (!v.hand) {
    v.hand = new THREE.Vector3();
    v.handL = new THREE.Vector3();
    v.forkT = Math.random() * 3;
    v.forkP = 2.4 + Math.random() * 1.4;
  }
  v.ate = true;
  if (c.convo) {
    f.reachR = null;
    f.reachL = null;
  } else if (!v.dishShape || EATEN.has(v.dishShape)) forkToMouth(v, v.spot, o.room.floor, dt);
  else {
    // (a drink: up to the lips and down, a while between)
    f.reachR = null;
    f.reachL = null;
    v.sip = (v.sip === undefined ? 1 + Math.random() * 3 : v.sip) - dt;
    if (v.sip < 0) {
      f.drinkT = Math.min(1, -v.sip / 1.2);
      if (v.sip < -1.2) {
        v.sip = 3 + Math.random() * 4;
        f.drinkT = -1;
      }
    }
  }
  v.talkT = (v.talkT === undefined ? 4 + Math.random() * 8 : v.talkT) - dt;
  if (v.talkT > 0 || o.game.classic) return;
  v.talkT = 10 + Math.random() * 14;
  const p = o.game.player.pos;
  if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 16) return;
  // (the nearest one sitting at the same table)
  let best = null;
  let bd = 1.7;
  for (const w of o.visitors) {
    if (w === v || w.mode !== 'seat' || w.phase !== 'at' || !w.c.alive) continue;
    const d = Math.hypot(w.c.pos.x - c.pos.x, w.c.pos.z - c.pos.z);
    if (d < bd) {
      bd = d;
      best = w;
    }
  }
  if (best && !c.convo && !best.c.convo) o.game.voices.talk([c, best.c], pick(EAT_TALK));
}

// ------------------------------------------------------------------ the restaurant
export class Dining {
  constructor(o) {
    this.o = o;
    this.game = o.game;
    this.R = o.room;
    const R = this.R;
    this.m = R.marks || {};
    // the tables: their seats (by what each seat is at), the middle of each, where the waiter stands
    this.tables = [];
    const byId = new Map();
    for (const s of R.seats) {
      if (!s.what || s.what[0] !== 't') continue;
      let t = byId.get(s.what);
      if (!t) {
        const c = this.m[s.what];
        if (!c) continue;
        const w = this.m[`w${s.what.slice(1)}`] || c;
        t = { id: s.what, n: +s.what.slice(1) + 1, x: c.x, y: c.y, z: c.z, wait: w, seats: [], party: null, dirty: false };
        byId.set(s.what, t);
        this.tables.push(t);
      }
      t.seats.push(s);
    }
    this.bar = new BarLife(o, R.seats.filter((s) => s.what === 'bar'));
    this.parties = [];
    this.waiters = [];
    this.host = null;
    this.cook = null;
    this.newT = 3 + Math.random() * 5;
    this.talkT = 3 + Math.random() * 5;
    this.spawnStaff();
  }

  // ---- the staff: the host at the stand, the waiters at the station, a cook at the stoves (the chef
  // is the shop's own keeper, at the pass)
  spawnStaff() {
    const o = this.o;
    const m = this.m;
    const touch = this.game.touch;
    if (m.host) this.host = { c: this.staff(m.host, shopkeeperLook('jewelry', Math.random() < 0.6), (c, dt) => this.hostLife(c, dt)), t: 0, job: null, pts: null };
    const nW = touch ? 1 : Math.min(4, Math.max(1, Math.round(this.tables.length / 3.5)));
    for (let i = 0; i < nW; i++) {
      const at = m.station || m.pass || o.room.door;
      const w = { i, t: 0, job: null, pts: null, idleT: Math.random() * 3, hand: new THREE.Vector3(), handL: new THREE.Vector3() };
      w.c = this.staff({ x: at.x + i * 0.4, z: at.z, yaw: at.yaw || 0 }, waiterLook(Math.random() < 0.5), (c, dt) => this.waiterLife(w, c, dt));
      this.waiters.push(w);
    }
    if (m.cook && !touch) {
      const k = { t: Math.random() * 5, hand: new THREE.Vector3(), handL: new THREE.Vector3() };
      this.cook = this.staff(m.cook, shopkeeperLook('gourmet', Math.random() < 0.4), (c, dt) => this.cookLife(k, c, dt));
      this.cook.fig.look.hat = { kind: 'cap', color: [0.97, 0.96, 0.93] };
    }
    if (m.barman) this.bar.spawnBarman(m.barman, this);
  }

  staff(at, look, fn) {
    const o = this.o;
    const c = this.game.civilians.spawnScripted(at.x, at.z, look, o);
    c.noCollide = true;
    c.exitRoom = o.room;
    c.exitShop = o.shop;
    if (at.yaw !== undefined) c.yaw = at.yaw;
    c.ctrl = (civ, dt) => (o.alive ? fn(civ, dt) : null);
    o.extras.push(c);
    return c;
  }

  near(d = 26) {
    const p = this.game.player.pos;
    return Math.hypot(this.o.home.x - p.x, this.o.home.z - p.z) < d;
  }

  say(c, text, P = null) {
    if (!text) return;
    if (P) text = text.replace('{t}', P.table.n).replace('{n}', P.members.length);
    this.o.say(c, text.replace('{name}', this.o.shop.name || 'our house'));
  }

  // ---- the people at the tables
  // already at their tables when you come by, each party somewhere in its evening
  populate() {
    const touch = this.game.touch;
    // (fuller at lunch and at dinner)
    const h = this.game.rhythm ? this.game.rhythm.hour : 13;
    const meal = (h > 11.8 && h < 14.5) || (h > 18.5 && h < 22.5);
    const k = touch ? 0.4 : meal ? 0.88 : 0.7;
    for (const t of this.tables) {
      if (Math.random() > k) continue;
      const st = pick(['menus', 'cooking', 'cooking', 'eating', 'eating', 'eating', 'coffee']);
      this.newParty(t, true, st);
    }
    this.bar.populate(touch ? 0.3 : 0.6);
  }

  // a party for table t: 1 to its seats' number (twos mostly, fours at the bigger tables)
  newParty(t, already, state = 'arrive') {
    const o = this.o;
    const R = o.room;
    const civs = this.game.civilians;
    const max = t.seats.length;
    const n = max >= 4 ? (Math.random() < 0.5 ? 2 : Math.random() < 0.6 ? 4 : 3) : Math.random() < 0.85 ? 2 : 1;
    const P = { table: t, members: [], state, t: 0, cookT: 0, eatT: 0, waiter: null, passSk: null, talkT: 2 + Math.random() * 6 };
    t.party = P;
    t.dirty = false;
    // (two face each other: the first two seats of a table are opposite)
    const seats = t.seats.slice(0, Math.min(n, max));
    const s = o.shop;
    const wait = this.m.hostWait || R.door;
    seats.forEach((sp, i) => {
      const at = already ? sp : { x: s.door[0] + s.nx * (1.2 + i * 0.6) + s.rx * (i - 0.5) * 0.7, z: s.door[2] + s.nz * (1.2 + i * 0.6) + s.rz * (i - 0.5) * 0.7 };
      const c = civs.spawnScripted(at.x, at.z, dinerLook(), o);
      c.speed = 1.05 + Math.random() * 0.2;
      const v = o.addVisitor(c, { spot: sp, mode: 'seat', already });
      if (!v) {
        civs.remove(c);
        return;
      }
      v.own = true;
      v.dine = P;
      v.hand = new THREE.Vector3();
      v.handL = new THREE.Vector3();
      v.forkT = Math.random() * 3;
      v.forkP = 2.6 + Math.random() * 1.2;
      if (already) {
        c.noCollide = true;
        c.yaw = sp.yaw;
        v.phase = 'at';
      } else {
        // in at the door and up to the host's stand (side by side), to wait to be seated
        v.toHost = true;
        const off = (i - (seats.length - 1) / 2) * 0.55;
        const hx = wait.x + s.rx * off;
        const hz = wait.z + s.rz * off;
        v.pts = [{ x: s.door[0], z: s.door[2], bell: true }, { x: R.door.x, z: R.door.z, inRoom: true }, ...R.path(R.door.x, R.door.z, hx, hz)];
      }
      P.members.push(v);
    });
    if (!P.members.length) {
      t.party = null;
      return null;
    }
    // (what they are doing when you come by)
    if (already) {
      if (state === 'menus') P.t = Math.random() * 6;
      if (state === 'cooking') P.cookT = 4 + Math.random() * 14;
      if (state === 'eating') {
        P.eatT = 10 + Math.random() * 30;
        for (const v of P.members) this.dishFor(v);
      }
      if (state === 'coffee') {
        P.coffeeT = 5 + Math.random() * 10;
        for (const v of P.members) v.c.fig.carry = 'coffee';
      }
      if (state === 'menus') for (const v of P.members) v.c.fig.carry = 'book';
    }
    this.parties.push(P);
    return P;
  }

  // a passer-by in at the door (game/streetlife.js errands): a party of one, if a table for two is free
  admit(c) {
    const o = this.o;
    const t = this.tables.find((x) => !x.party && !x.dirty && x.seats.length <= 2);
    if (!t || this.parties.some((P) => P.state === 'arrive' || P.state === 'wait')) return false;
    const R = o.room;
    const v = o.addVisitor(c, { spot: t.seats[0], mode: 'seat' });
    if (!v) return false;
    const P = { table: t, members: [v], state: 'arrive', t: 0, cookT: 0, eatT: 0, waiter: null, passSk: null, talkT: 5 };
    t.party = P;
    v.dine = P;
    v.hand = new THREE.Vector3();
    v.handL = new THREE.Vector3();
    v.forkT = 0;
    v.forkP = 3;
    v.toHost = true;
    const wait = this.m.hostWait || R.door;
    v.pts = [{ x: o.shop.door[0], z: o.shop.door[2], bell: true }, { x: R.door.x, z: R.door.z, inRoom: true }, ...R.path(R.door.x, R.door.z, wait.x, wait.z)];
    this.parties.push(P);
    return true;
  }

  // the plate before a diner, drawn (and kept while they eat): only near you, where it is seen
  dishFor(v) {
    if (v.dish || !this.near(30)) return;
    const sp = v.spot;
    const fl = this.o.room.floor;
    const x = sp.x + Math.sin(sp.yaw) * 0.47;
    const z = sp.z + Math.cos(sp.yaw) * 0.47;
    v.dish = this.game.airsketch.draw({ shape: pick(['gourmet', 'steak', 'pasta', 'gourmet']), at: new THREE.Vector3(x, fl + 0.87, z), size: 0.2, keep: true, dur: 0.05 });
  }

  // ---- every frame: the parties along their evening, the new ones at the door
  update(dt) {
    const o = this.o;
    for (let i = this.parties.length - 1; i >= 0; i--) {
      const P = this.parties[i];
      // (somebody ran off, or was rubbed out: the rest of the party carries on; none left, the table
      // is to be laid again)
      for (let k = P.members.length - 1; k >= 0; k--) if (!o.visitors.includes(P.members[k])) P.members.splice(k, 1);
      if (!P.members.length) {
        this.endParty(P);
        this.parties.splice(i, 1);
        continue;
      }
      this.partyStep(P, dt);
    }
    this.bar.update(dt);
    // new parties at the door: one at a time to the host's stand, while there are tables free
    if (!o.open) return;
    this.newT -= dt;
    if (this.newT > 0) return;
    const inside = o.room.inside(this.game.player.pos.x, this.game.player.pos.z, 0.5);
    this.newT = (inside ? 9 : 16) + Math.random() * 12;
    if (this.parties.some((P) => P.state === 'arrive' || P.state === 'wait' || P.state === 'led')) return;
    const free = this.tables.filter((t) => !t.party && !t.dirty);
    if (!free.length) return;
    if (!this.near(40)) {
      // (far off: nobody sees them come in - they are at their table already)
      this.newParty(pick(free), true, 'menus');
      return;
    }
    this.newParty(pick(free), false);
  }

  endParty(P) {
    if (P.passSk) this.game.airsketch.erase(P.passSk);
    P.passSk = null;
    if (P.waiter && P.waiter.job && P.waiter.job.P === P) P.waiter.job = null;
    if (P.table.party === P) {
      P.table.party = null;
      P.table.dirty = true;
    }
  }

  partyStep(P, dt) {
    P.t += dt;
    const M = P.members;
    switch (P.state) {
      case 'arrive':
        if (M.every((v) => v.phase === 'hwait')) {
          P.state = 'wait';
          P.t = 0;
        }
        break;
      case 'led':
        if (M.every((v) => v.phase === 'at')) {
          P.state = 'menus';
          P.t = 0;
          for (const v of M) v.c.fig.carry = 'book';
        }
        break;
      case 'cooking':
        P.cookT -= dt;
        if (P.cookT <= 0) {
          P.state = 'ready';
          P.t = 0;
          this.plate(P);
        }
        break;
      case 'eating':
        P.eatT -= dt;
        // (once in the meal, a toast: the glasses up over the table's middle, a word)
        if (M.length > 1 && !P.toasted && P.t > 6 && P.eatT > 4 && !this.game.classic && Math.random() < dt * 0.08) {
          P.toasted = true;
          P.toastT = 2.4;
          if (this.near(18)) this.say(pick(M).c, pick(TOAST));
        }
        if (P.toastT > 0) {
          P.toastT -= dt;
          if (P.toastT <= 0) for (const v of M) if (v.c.fig.carry === 'soda' && v.toastGlass) {
            v.c.fig.carry = null;
            v.toastGlass = false;
          }
        }
        if (P.eatT <= 0) {
          P.state = 'done';
          P.t = 0;
          for (const v of M) {
            v.c.fig.reachR = null;
            v.c.fig.reachL = null;
          }
        }
        break;
      case 'coffee':
        P.coffeeT -= dt;
        if (P.coffeeT <= 0) {
          P.state = 'check';
          P.t = 0;
          P.payer = pick(M);
          this.say(P.payer.c, pick(CHECK));
        }
        break;
      case 'paid':
        if (P.t > 1.6) {
          // up from the table and out; the host says goodnight
          for (const v of M) {
            if (v.c.fig.carry === 'coffee' || v.c.fig.carry === 'card' || v.c.fig.carry === 'book') v.c.fig.carry = null;
            this.o.leave(v);
          }
          if (this.host && Math.random() < 0.8) this.say(this.host.c, pick(BYE));
          P.state = 'gone';
        }
        break;
      default:
        break;
    }
    // a word between them now and then, while they wait and while they eat
    if ((P.state === 'menus' || P.state === 'cooking' || P.state === 'eating' || P.state === 'coffee' || P.state === 'done' || P.state === 'check') && M.length > 1 && !this.game.classic) {
      P.talkT -= dt;
      if (P.talkT <= 0) {
        P.talkT = 9 + Math.random() * 12;
        if (this.near(18)) {
          const a = M[0].c;
          const b = M[1].c;
          if (!a.convo && !b.convo) this.game.voices.talk([a, b], pick(TALK));
        }
      }
    }
    if (P.state === 'gone' && P.members.every((v) => v.phase === 'out')) {
      // (out of the door: the visitors' list lets them go - game/streetlife.js)
    }
  }

  // the chef draws the party's plates in the air at the pass, and they land there under the lamps
  plate(P) {
    const o = this.o;
    const chef = o.keeper;
    const m = this.m.pass || this.m.pass2;
    if (!m || !chef || !chef.alive || !this.near(32)) return;
    const at = new THREE.Vector3(chef.pos.x + Math.sin(o.homeYaw) * 0.6, o.room.floor + 1.7, chef.pos.z + Math.cos(o.homeYaw) * 0.6);
    const target = new THREE.Vector3(m.x - Math.sin(m.yaw) * 0.5, o.room.floor + 1.12, m.z - Math.cos(m.yaw) * 0.5);
    this.say(chef, pick(SERVICE), P);
    this.game.airsketch.draw({
      shape: pick(['gourmet', 'steak', 'pasta']), at, size: 0.5, author: chef, target, targetScale: 0.6, dur: 1.6, hold: 0.4, width: 3.4,
      onPlop: () => {
        if (!o.alive || P.state !== 'ready' || P.passSk) return;
        P.passSk = this.game.airsketch.draw({ shape: 'gourmet', at: target, size: 0.3, keep: true, dur: 0.05 });
      },
    });
  }

  // ---- the people in the party (OpenShop.visit hands them here while they are not on their way out)
  visit(v, dt) {
    const o = this.o;
    const c = v.c;
    const P = v.dine;
    switch (v.phase) {
      case 'in': {
        const mv = o.follow(v);
        if (mv) return mv;
        v.t = 0;
        if (v.toHost) {
          v.phase = 'hwait';
          v.toHost = false;
        } else {
          v.phase = 'at';
          c.noCollide = true;
        }
        return null;
      }
      case 'hwait': {
        const h = this.host ? this.host.c : null;
        if (h) c.faceYaw = Math.atan2(h.pos.x - c.pos.x, h.pos.z - c.pos.z);
        // (nobody to seat them: to the table by themselves)
        if (!h || !h.alive || h.owner !== o || v.t > 25) this.toSeat(v, 0);
        return null;
      }
      case 'led': {
        if (v.delay > 0) {
          v.delay -= dt;
          return null;
        }
        const mv = o.follow(v);
        if (mv) {
          mv.speed = 1.0;
          return mv;
        }
        v.phase = 'at';
        v.t = 0;
        c.noCollide = true;
        return null;
      }
      default:
        return this.seated(v, P, dt);
    }
  }

  toSeat(v, delay) {
    const c = v.c;
    v.phase = 'led';
    v.delay = delay;
    v.t = 0;
    v.pts = this.o.room.path(c.pos.x, c.pos.z, v.spot.x, v.spot.z);
  }

  // at the table: what the evening has come to
  seated(v, P, dt) {
    const c = v.c;
    const f = c.fig;
    const sp = v.spot;
    c.pos.x = sp.x;
    c.pos.z = sp.z;
    c.faceYaw = sp.yaw;
    f.sit = Math.min(1, f.sit + dt * 3);
    const st = P.state;
    if (st === 'eating') return this.eat(v, dt);
    f.reachL = null;
    if (st === 'order' && P.waiter) {
      // (looking up at the waiter, saying what they want)
      f.lookAt = P.waiter.c.fig.j.headC;
      f.reachR = null;
      return null;
    }
    f.lookAt = null;
    if (st === 'coffee') {
      v.sip = (v.sip === undefined ? 1 + Math.random() * 3 : v.sip) - dt;
      if (v.sip < 0) {
        f.drinkT = Math.min(1, -v.sip / 1.2);
        if (v.sip < -1.2) {
          v.sip = 3 + Math.random() * 4;
          f.drinkT = -1;
        }
      }
      return null;
    }
    if (st === 'check' && P.payer === v && P.t < 1.8) {
      // (a hand up for the waiter)
      v.hand.set(c.pos.x + Math.sin(sp.yaw) * 0.15, c.pos.y + 1.75, c.pos.z + Math.cos(sp.yaw) * 0.15);
      f.reachR = v.hand;
      return null;
    }
    if (st === 'pay' && P.payer === v) {
      f.carry = 'card';
      f.cardColor = f.cardColor || pick([[0.3, 0.45, 0.85], [0.85, 0.7, 0.3], [0.2, 0.2, 0.24]]);
      return null;
    }
    f.reachR = null;
    return null;
  }

  // eating: the fork from the plate up to the mouth and down again, the knife in the other hand at
  // the plate's edge; a pause now and then to talk
  eat(v, dt) {
    const c = v.c;
    const f = c.fig;
    if (f.carry === 'book' || f.carry === 'coffee') f.carry = null;
    const P = v.dine;
    if (P && P.toastT > 0) {
      // the glass raised to the others over the middle of the table
      if (!f.carry) {
        f.carry = 'soda';
        f.sodaColor = pick([[0.85, 0.92, 0.96], [0.98, 0.84, 0.42], [0.95, 0.5, 0.45]]);
        v.toastGlass = true;
      }
      const t = P.table;
      v.hand.set(t.x + (c.pos.x - t.x) * 0.45, this.o.room.floor + 1.18 + Math.sin(P.toastT * 9) * 0.015, t.z + (c.pos.z - t.z) * 0.45);
      f.reachR = v.hand;
      f.reachL = null;
      f.lookAt = v.hand;
      return null;
    }
    f.lookAt = null;
    if (c.convo) {
      // (talking: the fork down, the hands at rest)
      f.reachR = null;
      f.reachL = null;
      return null;
    }
    forkToMouth(v, v.spot, this.o.room.floor, dt);
    return null;
  }

  // ---- the host: at the stand by the door, the book open; greets a party, walks them to their table
  hostLife(c, dt) {
    const H = this.host;
    const m = this.m.host;
    const o = this.o;
    H.t += dt;
    const f = c.fig;
    if (H.pts && H.pts.length) {
      // (the host's own walker, kept: no new object a frame)
      const fv = H.fv || (H.fv = { c, pts: null, t: 0 });
      fv.pts = H.pts;
      fv.t = 0;
      const mv = o.follow(fv);
      if (mv) {
        mv.speed = 1.0;
        return mv;
      }
      H.pts = null;
    }
    const job = H.job;
    if (job) {
      const P = job.P;
      if (!this.parties.includes(P)) {
        H.job = null;
        f.carry = null;
        H.pts = o.room.path(c.pos.x, c.pos.z, m.x, m.z);
        return null;
      }
      if (job.step === 'greet') {
        const g = P.members[0].c;
        c.faceYaw = Math.atan2(g.pos.x - c.pos.x, g.pos.z - c.pos.z);
        f.lookAt = g.fig.j.headC;
        job.t += dt;
        if (!job.said) {
          job.said = true;
          this.say(c, pick(HOST_HELLO), P);
        }
        if (job.t > 1.8 && !job.ans) {
          job.ans = true;
          this.say(g, pick(GUEST_HELLO), P);
        }
        if (job.t > 3.6) {
          // the menus under the arm, and this way
          f.carry = 'book';
          f.lookAt = null;
          job.step = 'lead';
          P.state = 'led';
          const t = P.table;
          H.pts = o.room.path(c.pos.x, c.pos.z, t.wait.x, t.wait.z);
          P.members.forEach((v, i) => this.toSeat(v, 0.6 + i * 0.5));
          if (Math.random() < 0.6) this.say(c, 'Right this way, please.');
        }
        return null;
      }
      if (job.step === 'lead') {
        // at the table: the menus handed round, a word, and back to the stand
        const t = P.table;
        c.faceYaw = Math.atan2(t.x - c.pos.x, t.z - c.pos.z);
        job.t2 = (job.t2 || 0) + dt;
        if (P.state === 'menus' || job.t2 > 9) {
          f.carry = null;
          this.say(c, pick(HOST_SEAT));
          H.job = null;
          H.pts = o.room.path(c.pos.x, c.pos.z, m.x, m.z);
        }
        return null;
      }
    }
    // a party waiting at the stand?
    const P = this.parties.find((x) => x.state === 'wait');
    if (P) {
      H.job = { P, step: 'greet', t: 0 };
      return null;
    }
    // at the stand: the book, a look at the door, at the room
    if (Math.hypot(c.pos.x - m.x, c.pos.z - m.z) > 0.3) return { x: m.x, z: m.z, speed: 1.0 };
    const k = Math.sin(H.t * 0.31);
    if (k > 0.55) {
      // writing in the book
      f.reachR = f.reachR || new THREE.Vector3();
      const fy = m.yaw + Math.PI;
      f.reachR.set(c.pos.x + Math.sin(fy) * 0.45 + Math.sin(H.t * 5) * 0.04, c.pos.y + 1.1, c.pos.z + Math.cos(fy) * 0.45);
      c.faceYaw = fy;
      f.lookAt = f.reachR;
    } else {
      f.reachR = null;
      f.lookAt = null;
      c.faceYaw = m.yaw + Math.sin(H.t * 0.2) * 0.7;
    }
    return null;
  }

  // ---- a waiter: from the station to the tables and the pass and back, a job at a time
  waiterLife(w, c, dt) {
    const o = this.o;
    const f = c.fig;
    w.t += dt;
    if (w.pts && w.pts.length) {
      const mv = o.follow(w);
      if (mv) {
        mv.speed = w.job && w.job.kind === 'serve' ? 0.95 : 1.2;
        f.reachL = null;
        if (f.carry !== 'tray' && f.carry !== 'card' && f.carry !== 'coffee') f.reachR = null;
        return mv;
      }
      w.pts = null;
      w.at = true;
      w.t = 0;
    }
    if (!w.job) {
      w.idleT -= dt;
      if (w.idleT <= 0) {
        w.idleT = 0.6;
        const job = this.nextJob(w);
        if (job) {
          w.job = job;
          if (job.P) job.P.waiter = w;
          this.goJob(w, c);
          return null;
        }
      }
      return this.waiterIdle(w, c, dt);
    }
    return this.doJob(w, c, dt);
  }

  // the most urgent thing to do: plates waiting at the pass, a check asked for, plates to clear, an
  // order to take, a table to lay again
  nextJob(w) {
    const mine = (P) => !P.waiter || P.waiter === w;
    let best = null;
    let bp = 0;
    for (const P of this.parties) {
      if (!mine(P)) continue;
      let p = 0;
      let kind = null;
      if (P.state === 'ready' && (P.passSk || P.t > 4)) [p, kind] = [5, 'pickup'];
      else if (P.state === 'check') [p, kind] = [4, 'check'];
      else if (P.state === 'done' && P.t > 2) [p, kind] = [3, 'clear'];
      else if (P.state === 'menus' && P.t > 5) [p, kind] = [2, 'order'];
      if (p > bp) {
        bp = p;
        best = { kind, P, step: 0, t: 0 };
      }
    }
    if (best) return best;
    const t = this.tables.find((x) => x.dirty && !x.resetBy);
    if (t) {
      t.resetBy = w;
      return { kind: 'reset', T: t, step: 0, t: 0 };
    }
    return null;
  }

  // to where the job is: the table's side, the pass, the station
  goJob(w, c) {
    const j = w.job;
    const R = this.o.room;
    let to = null;
    if (j.kind === 'pickup') to = this.m.pass || this.m.pass2;
    else if (j.kind === 'check' || (j.kind === 'clear' && j.step === 2)) to = this.m.station;
    else to = (j.P ? j.P.table : j.T).wait;
    if (!to) to = this.m.station || R.door;
    w.pts = R.path(c.pos.x, c.pos.z, to.x, to.z);
    w.at = false;
    w.t = 0;
  }

  doJob(w, c, dt) {
    const j = w.job;
    const f = c.fig;
    const P = j.P;
    j.t += dt;
    if (P && !this.parties.includes(P)) {
      this.endJob(w, c);
      return null;
    }
    const table = P ? P.table : j.T;
    const faceTable = () => {
      c.faceYaw = Math.atan2(table.x - c.pos.x, table.z - c.pos.z);
    };
    switch (j.kind) {
      case 'order': {
        faceTable();
        if (j.step === 0) {
          j.step = 1;
          j.t = 0;
          P.state = 'order';
          this.say(c, pick(WAITER_HELLO));
          f.carry = 'card';
          f.cardColor = [0.97, 0.96, 0.92];
        }
        // (writing on the pad as each of them orders)
        w.handL.set(c.pos.x + Math.sin(c.yaw) * 0.4 + Math.sin(j.t * 6) * 0.03, c.pos.y + 1.1, c.pos.z + Math.cos(c.yaw) * 0.4);
        f.reachL = j.t > 1.2 ? w.handL : null;
        const say = Math.floor((j.t - 1.6) / 1.8);
        if (say >= 0 && say < P.members.length && j.said !== say) {
          j.said = say;
          this.say(P.members[say].c, pick(ORDER));
        }
        if (j.t > 1.6 + P.members.length * 1.8 + 0.6) {
          this.say(c, pick(WAITER_OK));
          for (const v of P.members) if (v.c.fig.carry === 'book') v.c.fig.carry = null;
          P.state = 'cooking';
          P.t = 0;
          P.cookT = 12 + Math.random() * 10;
          // (to the pass with the order)
          j.kind = 'ticket';
          j.step = 0;
          w.pts = this.o.room.path(c.pos.x, c.pos.z, (this.m.pass || this.m.station).x, (this.m.pass || this.m.station).z);
          f.reachL = null;
        }
        return null;
      }
      case 'ticket': {
        const m = this.m.pass || this.m.station;
        c.faceYaw = m.yaw;
        if (j.step === 0) {
          j.step = 1;
          j.t = 0;
          this.say(c, pick(CALL), P);
          f.carry = null;
          if (this.o.keeper && Math.random() < 0.8) this.game.inkwell.after(1.1, () => this.o.alive && this.say(this.o.keeper, pick(CHEF_OK)));
        }
        if (j.t > 1.8) this.endJob(w, c);
        return null;
      }
      case 'pickup': {
        const m = this.m.pass || this.m.pass2;
        c.faceYaw = m.yaw;
        if (!P.passSk && P.t < 6) {
          // (the chef is still drawing them)
          return null;
        }
        if (P.passSk) {
          this.game.airsketch.erase(P.passSk);
          P.passSk = null;
        }
        f.carry = 'tray';
        j.kind = 'serve';
        j.step = 0;
        w.pts = this.o.room.path(c.pos.x, c.pos.z, P.table.wait.x, P.table.wait.z);
        return null;
      }
      case 'serve': {
        faceTable();
        if (j.step === 0) {
          j.step = 1;
          j.t = 0;
          this.say(c, pick(SERVE));
          for (const v of P.members) this.dishFor(v);
          P.state = 'eating';
          P.t = 0;
          P.eatT = 26 + Math.random() * 22;
        }
        if (j.t > 1.4) {
          f.carry = null;
          this.endJob(w, c);
        }
        return null;
      }
      case 'clear': {
        if (j.step === 0) {
          faceTable();
          j.step = 1;
          j.t = 0;
          this.say(c, pick(CLEAR));
          this.game.inkwell.after(1.4, () => P.members[0] && P.members[0].c.alive && this.say(P.members[0].c, pick(CLEAR_ANS)));
        } else if (j.step === 1) {
          faceTable();
          if (j.t > 2.4) {
            for (const v of P.members) this.o.clearDish(v);
            f.carry = 'tray';
            j.step = 2;
            this.goJob(w, c);
          }
        } else if (j.step === 2) {
          // (the plates to the station; coffee for some, the check for others)
          f.carry = null;
          if (Math.random() < 0.5) {
            P.state = 'coffee';
            P.coffeeT = 9 + Math.random() * 9;
            for (const v of P.members) v.c.fig.carry = 'coffee';
            if (Math.random() < 0.5) this.say(c, pick(COFFEE));
          } else {
            P.state = 'check';
            P.t = 0;
            P.payer = pick(P.members);
            this.say(P.payer.c, pick(CHECK));
          }
          this.endJob(w, c);
        }
        return null;
      }
      case 'check': {
        if (j.step === 0) {
          // the check from the station, in its folder, to the table
          f.carry = 'card';
          f.cardColor = [0.16, 0.12, 0.1];
          j.step = 1;
          w.pts = this.o.room.path(c.pos.x, c.pos.z, P.table.wait.x, P.table.wait.z);
          return null;
        }
        faceTable();
        if (j.step === 1) {
          j.step = 2;
          j.t = 0;
          P.state = 'pay';
          P.payer = P.payer || P.members[0];
        }
        if (j.t > 2.4 && j.step === 2) {
          j.step = 3;
          f.carry = null;
          if (P.payer && P.payer.c.fig.carry === 'card') P.payer.c.fig.carry = null;
          this.say(c, pick(PAID));
          P.state = 'paid';
          P.t = 0;
          this.endJob(w, c);
        }
        return null;
      }
      case 'reset': {
        // laying the table again: the hands over it, a while
        faceTable();
        w.hand.set(table.x + Math.sin(j.t * 2.3) * 0.25, this.o.room.floor + 0.85, table.z + Math.cos(j.t * 1.7) * 0.25);
        f.reachR = w.hand;
        if (j.t > 3.2) {
          table.dirty = false;
          table.resetBy = null;
          f.reachR = null;
          this.endJob(w, c);
        }
        return null;
      }
      default:
        this.endJob(w, c);
        return null;
    }
  }

  endJob(w, c) {
    const j = w.job;
    if (j && j.P && j.P.waiter === w) j.P.waiter = null;
    if (j && j.T && j.T.resetBy === w) j.T.resetBy = null;
    w.job = null;
    w.idleT = 0.4 + Math.random() * 0.8;
    c.fig.reachL = null;
    if (c.fig.carry !== 'tray') c.fig.reachR = null;
  }

  // waiting for something to do: at the station polishing a glass, folding a napkin; now and then a
  // round of the room
  waiterIdle(w, c, dt) {
    const f = c.fig;
    const m = this.m.station || this.m.pass;
    if (!m) return null;
    if (!w.idle) {
      // (side by side along the station, each in a place of their own where a person can stand: the
      // end of the way there - so a place in the furniture is never walked to again and again)
      const off = (w.i - (this.waiters.length - 1) / 2) * 0.6;
      const way = this.o.room.path(m.x, m.z, m.x - Math.cos(m.yaw) * off, m.z + Math.sin(m.yaw) * off);
      w.idle = way[way.length - 1];
    }
    const tx = w.idle.x;
    const tz = w.idle.z;
    if (Math.hypot(c.pos.x - tx, c.pos.z - tz) > 0.35) {
      // (the way round the tables once; a step or two more is walked straight)
      w.pathCool = (w.pathCool || 0) - dt;
      if (!w.pts && w.pathCool <= 0) {
        w.pathCool = 2;
        w.pts = this.o.room.path(c.pos.x, c.pos.z, tx, tz);
        return null;
      }
      return { x: tx, z: tz, speed: 1.0 };
    }
    c.faceYaw = m.yaw;
    f.carry = null;
    const t = w.t;
    const fy = m.yaw;
    w.hand.set(c.pos.x + Math.sin(fy) * 0.38 + Math.cos(t * 3) * 0.05, c.pos.y + 1.0 + Math.sin(t * 3) * 0.04, c.pos.z + Math.cos(fy) * 0.38 - Math.sin(t * 3) * 0.05);
    w.handL.set(c.pos.x + Math.sin(fy) * 0.36 - Math.cos(fy) * 0.05, c.pos.y + 0.98, c.pos.z + Math.cos(fy) * 0.36 + Math.sin(fy) * 0.05);
    f.reachR = w.hand;
    f.reachL = w.handL;
    f.lookAt = w.hand;
    return null;
  }

  // ---- the cook at the stoves: a pan shaken over the flame, a pot stirred, a look at the pass
  cookLife(k, c, dt) {
    const m = this.m.cook;
    const f = c.fig;
    k.t += dt;
    const step = Math.sin(k.t * 0.17) > 0.5 ? 0.6 : Math.sin(k.t * 0.13) < -0.6 ? -0.5 : 0;
    const rx = Math.cos(m.yaw);
    const rz = -Math.sin(m.yaw);
    const tx = m.x + rx * step;
    const tz = m.z + rz * step;
    if (Math.hypot(c.pos.x - tx, c.pos.z - tz) > 0.2) return { x: tx, z: tz, speed: 0.8 };
    c.faceYaw = m.yaw;
    const fy = m.yaw;
    const fx = Math.sin(fy);
    const fz = Math.cos(fy);
    const toss = Math.max(0, Math.sin(k.t * 7)) * 0.1;
    k.hand.set(c.pos.x + fx * 0.5, c.pos.y + 1.0 + toss, c.pos.z + fz * 0.5);
    k.handL.set(c.pos.x + fx * 0.45 - rx * 0.3, c.pos.y + 0.98 + Math.sin(k.t * 2.5) * 0.03, c.pos.z + fz * 0.45 - rz * 0.3);
    f.reachR = k.hand;
    f.reachL = Math.sin(k.t * 0.5) > 0 ? k.handL : null;
    f.lookAt = k.hand;
    return null;
  }

  // ---- the chef at the pass (the shop's keeper): plating, a look at the tickets, the call for the
  // waiters when plates are waiting
  chef(c, dt) {
    const o = this.o;
    const f = c.fig;
    const busy = this.parties.some((P) => P.state === 'cooking' || P.state === 'ready');
    const fy = o.homeYaw;
    const fx = Math.sin(fy);
    const fz = Math.cos(fy);
    if (!busy) {
      f.reachR = null;
      f.reachL = null;
      c.faceYaw = fy + Math.sin(o.t * 0.3) * 0.6;
      return { x: o.home.x, z: o.home.z, speed: 0.6 };
    }
    // plating: both hands at the pass, a wipe, a sprig, a step along it
    const rx = Math.cos(fy);
    const rz = -Math.sin(fy);
    const s = Math.sin(o.t * 0.4) * 0.5;
    this.chefHand = this.chefHand || new THREE.Vector3();
    this.chefHandL = this.chefHandL || new THREE.Vector3();
    this.chefHand.set(c.pos.x + fx * 0.5 + rx * (0.1 + Math.sin(o.t * 4) * 0.05), c.pos.y + 1.12, c.pos.z + fz * 0.5 + rz * (0.1 + Math.sin(o.t * 4) * 0.05));
    this.chefHandL.set(c.pos.x + fx * 0.48 - rx * 0.12, c.pos.y + 1.1, c.pos.z + fz * 0.48 - rz * 0.12);
    if (!f.carry || f.carry === 'pencil') {
      // (the airsketch moves the right hand while drawing)
      if (f.carry !== 'pencil') f.reachR = this.chefHand;
      f.reachL = this.chefHandL;
    }
    c.faceYaw = fy;
    return { x: o.home.x + rx * s, z: o.home.z + rz * s, speed: 0.5 };
  }

  dispose() {
    for (const P of this.parties) if (P.passSk) this.game.airsketch.erase(P.passSk);
    this.parties = [];
    this.bar.dispose();
  }
}

// ------------------------------------------------------------------ the bar: the barmen and the stools
// (a bar of its own - the beach's, the club's - or the one in the restaurant)
export class BarLife {
  constructor(o, seats) {
    this.o = o;
    this.game = o.game;
    this.seats = seats || [];
    this.barmen = [];
    this.newT = 8 + Math.random() * 10;
  }

  // a barman: the shop's own keeper (o.keeper, driven from game/streetlife.js) or one more of the staff
  tender(home) {
    const b = { home, t: Math.random() * 10, job: null, hand: new THREE.Vector3(), handL: new THREE.Vector3() };
    this.barmen.push(b);
    return b;
  }

  spawnBarman(at) {
    const o = this.o;
    const b = this.tender(at);
    const c = this.game.civilians.spawnScripted(at.x, at.z, bartenderLook(), o);
    c.noCollide = true;
    c.exitRoom = o.room;
    c.exitShop = o.shop;
    c.yaw = at.yaw;
    c.ctrl = (civ, dt) => (o.alive ? this.barman(b, civ, dt) : null);
    o.extras.push(c);
    b.c = c;
    return c;
  }

  // the people on the stools when you come by, a glass each (k: how many of the stools)
  populate(k) {
    for (const sp of this.seats) if (Math.random() < k) this.patron(sp, true);
  }

  // a bar of its own: the stools, the booths and the tall tables in twos and fours, the pool table's
  // players, the darts, the jukebox
  populateRoom() {
    const R = this.o.room;
    const touch = this.game.touch;
    const groups = new Map();
    for (const s of R.seats) {
      if (!s.what) continue;
      const g = s.what === 'bar' || s.what === 'high' ? `${s.what}${Math.random()}` : s.what;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(s);
    }
    // (how many at most: a full room is a lot of figures to draw - the club's dancers come on top)
    let budget = this.budget();
    const kSeat = touch ? 0.25 : 0.55;
    for (const [g, seats] of shuffle([...groups])) {
      if (budget <= 0) break;
      if (Math.random() > kSeat) continue;
      // (a group sits together: two at least, at a booth all of it now and then)
      const booth = g[0] === 'v' || (g[0] === 'b' && !g.startsWith('bar'));
      const n = Math.min(budget, booth ? Math.min(seats.length, 2 + Math.floor(Math.random() * (seats.length - 1))) : seats.length);
      for (let i = 0; i < n; i++) if (this.patron(seats[i], true)) budget--;
    }
    const kStand = touch ? 0.3 : 0.7;
    for (const b of shuffle(R.browse.filter((x) => x.what))) {
      if (budget <= 0) break;
      if (Math.random() > kStand) continue;
      if (this.stander(b, true)) budget--;
    }
  }

  // (the most of its own people a bar keeps: the stools, the booths, the tables, the pool and the
  // darts together)
  budget() {
    return this.game.touch ? 8 : this.o.shop.kind === 'club' ? 16 : 18;
  }

  patron(sp, already) {
    const o = this.o;
    const s = o.shop;
    const c = this.game.civilians.spawnScripted(already ? sp.x : s.door[0] + s.nx * 1.4, already ? sp.z : s.door[2] + s.nz * 1.4, civilianLook({ kind: pick(['smart', 'chic', 'street', 'denim', 'trench', 'bomber']) }), o);
    const v = o.addVisitor(c, { spot: sp, mode: 'seat', already });
    if (!v) {
      this.game.civilians.remove(c);
      return null;
    }
    v.own = true;
    v.drink = true;
    v.stay = 40 + Math.random() * 70;
    if (already) {
      c.noCollide = true;
      c.yaw = sp.yaw;
      if (sp.what !== 'bar' || Math.random() < 0.8) this.glass(c);
    }
    return v;
  }

  // somebody standing: at a tall table with a glass, with a cue at the pool table, at the darts
  stander(sp, already) {
    const o = this.o;
    const s = o.shop;
    const c = this.game.civilians.spawnScripted(already ? sp.x : s.door[0] + s.nx * 1.4, already ? sp.z : s.door[2] + s.nz * 1.4, civilianLook({ kind: pick(['street', 'denim', 'bomber', 'smart', 'chic']) }), o);
    const v = o.addVisitor(c, { spot: sp, mode: 'browse', already });
    if (!v) {
      this.game.civilians.remove(c);
      return null;
    }
    v.own = true;
    v.stand = sp.what;
    v.stay = 30 + Math.random() * 60;
    if (sp.what === 'high' || Math.random() < 0.3) this.glass(c);
    return v;
  }

  glass(c) {
    c.fig.carry = 'soda';
    c.fig.sodaColor = pick(DRINKS);
  }

  // (now and then a new face on a free stool or at a free table)
  update(dt) {
    const o = this.o;
    this.newT -= dt;
    if (this.newT > 0 || !o.open) return;
    this.newT = 12 + Math.random() * 14;
    if (o.visitors.length >= this.budget() + (o.shop.kind === 'club' ? 14 : 4)) return;
    const used = new Set(o.visitors.map((v) => v.spot));
    const free = o.room.seats.filter((s) => s.what && !used.has(s) && (this.seats.includes(s) || o.shop.kind !== 'gourmet'));
    if (free.length > 2) this.patron(pick(free), false);
  }

  // behind the bar: a glass polished, a drink mixed (the shaker up and down by the shoulder), set
  // down before the one who asked; a word with the stools
  barman(b, c, dt) {
    const f = c.fig;
    const o = this.o;
    const home = b.home;
    b.t += dt;
    const fy = home.yaw;
    const fx = Math.sin(fy);
    const fz = Math.cos(fy);
    const rx = Math.cos(fy);
    const rz = -Math.sin(fy);
    // somebody on a stool without a glass: to them
    if (!b.job) {
      const v = o.visitors.find((x) => x.drink && x.phase === 'at' && x.spot.what === 'bar' && x.c.fig.carry !== 'soda' && x.t > 2 && !x.served);
      if (v) {
        v.served = b;
        b.job = { v, t: 0, step: 0 };
      }
    }
    const j = b.job;
    if (j) {
      const v = j.v;
      if (!o.visitors.includes(v) || v.phase !== 'at') {
        b.job = null;
        return null;
      }
      // (along the bar to before them)
      const along = (v.c.pos.x - home.x) * rx + (v.c.pos.z - home.z) * rz;
      const tx = home.x + rx * along;
      const tz = home.z + rz * along;
      if (j.step === 0 && Math.hypot(c.pos.x - tx, c.pos.z - tz) > 0.25) {
        f.reachR = null;
        f.reachL = null;
        return { x: tx, z: tz, speed: 1.0 };
      }
      c.faceYaw = fy;
      j.t += dt;
      if (j.step === 0) {
        j.step = 1;
        j.t = 0;
        f.carry = null;
        o.say(c, pick(BAR_ASK));
        this.game.inkwell.after(1.3, () => v.c.alive && o.say(v.c, pick(BAR_ORDER)));
      } else if (j.t > 2.2) {
        // the shaker
        b.hand.set(c.pos.x + fx * 0.25 + rx * 0.15, c.pos.y + 1.45 + Math.sin(j.t * 16) * 0.12, c.pos.z + fz * 0.25 + rz * 0.15);
        f.reachR = b.hand;
        f.reachL = null;
        f.carry = 'soda';
        f.sodaColor = [0.8, 0.82, 0.86];
        if (j.t > 4.2) {
          f.reachR = null;
          f.carry = null;
          this.glass(v.c);
          o.say(c, pick(BAR_SAY));
          v.served = null;
          b.job = null;
        }
      }
      return null;
    }
    // polishing a glass, a look along the bar
    if (Math.hypot(c.pos.x - home.x, c.pos.z - home.z) > 0.3) {
      f.reachR = null;
      f.reachL = null;
      return { x: home.x, z: home.z, speed: 0.9 };
    }
    c.faceYaw = fy + Math.sin(b.t * 0.3) * 0.5;
    b.hand.set(c.pos.x + fx * 0.35 + Math.cos(b.t * 4) * 0.04, c.pos.y + 1.12 + Math.sin(b.t * 4) * 0.04, c.pos.z + fz * 0.35);
    b.handL.set(c.pos.x + fx * 0.33 - rx * 0.05, c.pos.y + 1.08, c.pos.z + fz * 0.33 - rz * 0.05);
    f.reachR = b.hand;
    f.reachL = b.handL;
    f.carry = 'soda';
    f.sodaColor = [0.85, 0.9, 0.95];
    return null;
  }

  // somebody sitting with a glass: to the lips now and then, a word with the next one
  seated(v, dt) {
    const c = v.c;
    const f = c.fig;
    if (f.carry === 'soda') this.sip(v, f, dt);
    v.talkT = (v.talkT === undefined ? 5 + Math.random() * 10 : v.talkT) - dt;
    if (v.talkT <= 0 && !this.game.classic) {
      v.talkT = 12 + Math.random() * 16;
      const p = this.game.player.pos;
      if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 16) {
        // (the nearest one)
        let best = null;
        let bd = 1.8;
        for (const o of this.o.visitors) {
          if (o === v || (o.phase !== 'at' && o.phase !== 'browse') || !o.c.alive) continue;
          const d = Math.hypot(o.c.pos.x - c.pos.x, o.c.pos.z - c.pos.z);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (best && !c.convo && !best.c.convo) this.game.voices.talk([c, best.c], pick(BAR_TALK));
      }
    }
    return null;
  }

  sip(v, f, dt) {
    v.sip = (v.sip === undefined ? 2 + Math.random() * 5 : v.sip) - dt;
    if (v.sip < 0) {
      f.drinkT = Math.min(1, -v.sip / 1.3);
      if (v.sip < -1.3) {
        v.sip = 4 + Math.random() * 6;
        f.drinkT = -1;
      }
    }
  }

  // somebody standing (OpenShop.atSpot): the glass at the tall table, the shot at the pool table, the
  // darts thrown, a song chosen
  standing(v, dt) {
    const c = v.c;
    const f = c.fig;
    const sp = v.spot;
    c.faceYaw = sp.yaw;
    v.h = v.h || new THREE.Vector3();
    const fx = Math.sin(sp.yaw);
    const fz = Math.cos(sp.yaw);
    const k = v.t;
    switch (v.stand) {
      case 'pool': {
        // bent over the table, the cue drawn back and pushed, then up to watch
        const aim = Math.sin(k * 0.45) > -0.2;
        if (aim) {
          const push = Math.max(0, Math.sin(k * 3)) * 0.15;
          v.h.set(c.pos.x + fx * (0.55 + push), c.pos.y + 0.95, c.pos.z + fz * (0.55 + push));
          f.reachR = v.h;
          v.h2 = v.h2 || new THREE.Vector3();
          v.h2.set(c.pos.x + fx * 0.95, c.pos.y + 0.88, c.pos.z + fz * 0.95);
          f.reachL = v.h2;
          f.crouch = 0.35;
        } else {
          f.reachR = null;
          f.reachL = null;
          f.crouch = 0;
        }
        break;
      }
      case 'darts': {
        // a throw every few seconds: back by the ear, out
        const ph = k % 3.2;
        if (ph < 0.6) v.h.set(c.pos.x + fx * 0.05, c.pos.y + 1.7, c.pos.z + fz * 0.05);
        else if (ph < 0.9) v.h.set(c.pos.x + fx * 0.6, c.pos.y + 1.6, c.pos.z + fz * 0.6);
        else v.h.set(c.pos.x + fx * 0.2, c.pos.y + 1.0, c.pos.z + fz * 0.2);
        f.reachR = ph < 1.6 ? v.h : null;
        break;
      }
      case 'jukebox':
        v.h.set(c.pos.x + fx * 0.5, c.pos.y + 1.1 + Math.sin(k * 2) * 0.05, c.pos.z + fz * 0.5);
        f.reachR = Math.sin(k * 0.8) > 0 ? v.h : null;
        f.dance = Math.sin(k * 0.3) > 0.5 ? 0.4 : 0;
        break;
      default:
        if (f.carry === 'soda') this.sip(v, f, dt);
        break;
    }
    // (a word with somebody near now and then)
    this.seated(v, 0);
    if (v.t > v.stay) {
      f.reachR = null;
      f.reachL = null;
      f.crouch = 0;
      f.dance = 0;
      this.o.leave(v);
    }
    return null;
  }

  dispose() {
    for (const b of this.barmen) b.job = null;
  }
}

// ------------------------------------------------------------------ the lobby of a cinema, a theatre
export class LobbyLife {
  constructor(o) {
    this.o = o;
    this.game = o.game;
    const R = o.room;
    this.m = R.marks || {};
    this.usher = null;
    this.seller = null;
    this.t = 0;
    this.screens = Object.keys(this.m).filter((k) => /^screen\d/.test(k)).map((k) => this.m[k]);
    this.posters = R.browse.filter((b) => b.what === 'poster' || b.what === 'standee');
    this.rows = R.seats.filter((s) => s.what === 'row');
    this.hand = new THREE.Vector3();
    this.spawnStaff();
  }

  spawnStaff() {
    const o = this.o;
    const kind = o.shop.kind;
    const mk = (at, fn) => {
      const c = this.game.civilians.spawnScripted(at.x, at.z, shopkeeperLook(kind === 'cinema' ? 'theatre' : kind, Math.random() < 0.5), o);
      c.noCollide = true;
      c.exitRoom = o.room;
      c.exitShop = o.shop;
      c.yaw = at.yaw;
      c.ctrl = (civ, dt) => (o.alive ? fn(civ, dt, at) : null);
      o.extras.push(c);
      return c;
    };
    if (this.m.usher) this.usher = mk(this.m.usher, (c, dt, at) => this.usherLife(c, dt, at));
    if (this.m.tickets) this.seller = mk(this.m.tickets, (c, dt, at) => this.sellerLife(c, dt, at));
    if (this.m.counter2 && !this.game.touch) mk(this.m.counter2, (c, dt, at) => this.counterLife(c, dt, at));
  }

  // a moviegoer: the box office, maybe a poster, the line for a soda, the usher, in
  plan(v, already) {
    const steps = [];
    if (this.m.ticketWin && Math.random() < 0.6) steps.push('ticket');
    if (this.posters.length && Math.random() < 0.6) steps.push('poster');
    if (this.o.paySpot && Math.random() < 0.7) steps.push('snack');
    steps.push('in');
    v.lobby = steps;
    if (already) steps.shift();
    v.c.fig.carry = null;
  }

  // the next step of their way through the lobby
  next(v) {
    const o = this.o;
    const c = v.c;
    const R = o.room;
    const st = v.lobby.shift() || 'in';
    v.lstep = st;
    v.t = 0;
    v.lt = 0;
    if (st === 'ticket') {
      const m = this.m.ticketWin;
      v.pts = R.path(c.pos.x, c.pos.z, m.x, m.z);
      v.phase = 'lob';
    } else if (st === 'poster') {
      const sp = pick(this.posters);
      v.pspot = sp;
      v.pts = R.path(c.pos.x, c.pos.z, sp.x + (Math.random() - 0.5) * 0.6, sp.z + (Math.random() - 0.5) * 0.6);
      v.phase = 'lob';
    } else if (st === 'snack') {
      v.shop = true;
      v.got = 1;
      o.toQueue(v);
    } else {
      // to the usher, then through the doors (or down the aisle to a seat)
      const u = this.usher && this.usher.alive ? this.usher : null;
      const m = this.m.usher;
      if (m) v.pts = R.path(c.pos.x, c.pos.z, m.x + Math.sin(m.yaw) * 0.85, m.z + Math.cos(m.yaw) * 0.85);
      else v.pts = [];
      v.usher = u;
      v.phase = 'lob';
    }
  }

  // OpenShop.visit hands moviegoers here (not on their way out, not in the line)
  visit(v, dt) {
    const o = this.o;
    const c = v.c;
    if (v.phase === 'in') {
      const mv = o.follow(v);
      if (mv) return mv;
      this.next(v);
      return null;
    }
    if (v.phase === 'seat') return this.inSeat(v, dt);
    if (v.phase !== 'lob') return null;
    const mv = o.follow(v);
    if (mv) return mv;
    v.lt += dt;
    switch (v.lstep) {
      case 'ticket': {
        const s = this.seller;
        if (s) c.faceYaw = Math.atan2(s.pos.x - c.pos.x, s.pos.z - c.pos.z);
        if (v.lt > 0.3 && !v.asked) {
          v.asked = true;
          o.say(c, pick(['Two for the seven o\'clock, please.', 'One ticket, please.', 'Is the late show sold out?']));
          if (s) this.game.inkwell.after(1.2, () => s.alive && o.say(s, pick(SELLER)));
        }
        if (v.lt > 3.0) {
          v.asked = false;
          c.fig.carry = 'card';
          c.fig.cardColor = [0.98, 0.86, 0.4];
          this.next(v);
        }
        return null;
      }
      case 'poster': {
        const sp = v.pspot;
        c.faceYaw = sp.yaw;
        if (v.lt > 1 && !v.pointed && Math.random() < dt * 0.6) {
          v.pointed = true;
          this.hand.set(c.pos.x + Math.sin(sp.yaw) * 0.7, c.pos.y + 1.5, c.pos.z + Math.cos(sp.yaw) * 0.7);
          c.fig.reachR = this.hand.clone();
          if (Math.random() < 0.5) o.say(c, pick(['That one looks good!', 'Ooh, a sequel!', 'We have to see this.', 'Coming soon...']));
        }
        if (v.lt > 2.6) c.fig.reachR = null;
        if (v.lt > 4 + Math.random() * 3) {
          c.fig.reachR = null;
          v.pointed = false;
          this.next(v);
        }
        return null;
      }
      default: {
        // at the usher: the ticket held out, taken, torn; through the doors
        const u = v.usher;
        if (u && u.alive && !v.torn) {
          c.faceYaw = Math.atan2(u.pos.x - c.pos.x, u.pos.z - c.pos.z);
          if (v.lt > 0.2 && !v.held) {
            v.held = true;
            if (c.fig.carry !== 'soda') {
              c.fig.carry = 'card';
              c.fig.cardColor = [0.98, 0.86, 0.4];
            }
            this.usherTake = v;
          }
          if (v.lt < 2.2) return null;
          v.torn = true;
          if (c.fig.carry === 'card') c.fig.carry = null;
          o.say(u, pick(USHER));
        }
        // a seat in the rows (the theatre), or the doors to a screen (the cinema)
        if (this.rows.length) {
          const used = new Set(o.visitors.map((x) => x.spot));
          const free = this.rows.filter((s) => !used.has(s));
          if (free.length) {
            const sp = pick(free.slice(0, Math.min(free.length, 30)));
            v.spot = sp;
            v.mode = 'seat';
            v.phase = 'seat';
            v.seatPts = o.room.path(c.pos.x, c.pos.z, sp.x, sp.z);
            v.pts = v.seatPts;
            v.lt = 0;
            return null;
          }
        }
        const scr = this.screens.length ? pick(this.screens) : null;
        if (scr && !v.toScreen) {
          v.toScreen = true;
          v.pts = o.room.path(c.pos.x, c.pos.z, scr.x, scr.z);
          return null;
        }
        // (through the doors: gone to their film)
        o.vanish(v, true);
        return null;
      }
    }
  }

  // in the rows: down the aisle to the seat, then sit and watch (a sip of the soda now and then)
  inSeat(v, dt) {
    const o = this.o;
    const c = v.c;
    if (v.pts && v.pts.length) {
      const mv = o.follow(v);
      if (mv) return mv;
    }
    c.noCollide = true;
    c.pos.x = v.spot.x;
    c.pos.z = v.spot.z;
    c.faceYaw = v.spot.yaw;
    c.fig.sit = Math.min(1, c.fig.sit + dt * 3);
    v.phase = 'at';
    v.stay = 60 + Math.random() * 80;
    v.t = 0;
    return null;
  }

  // after the counter (OpenShop.paying): on to the usher instead of out
  afterPay(v) {
    if (this.o.payer === v) this.o.payer = null;
    v.shop = false;
    v.phase = 'lob';
    v.lobby = v.lobby || [];
    this.next(v);
  }

  usherLife(c, dt, at) {
    const f = c.fig;
    this.t += dt;
    const v = this.usherTake;
    if (v && this.o.visitors.includes(v) && !v.torn) {
      c.faceYaw = Math.atan2(v.c.pos.x - c.pos.x, v.c.pos.z - c.pos.z);
      this.uh = this.uh || new THREE.Vector3();
      this.uh.copy(v.c.fig.j.handR);
      f.reachR = this.uh;
      f.lookAt = v.c.fig.j.handR;
      return null;
    }
    this.usherTake = null;
    f.reachR = null;
    f.lookAt = null;
    if (Math.hypot(c.pos.x - at.x, c.pos.z - at.z) > 0.3) return { x: at.x, z: at.z, speed: 1.0 };
    c.faceYaw = at.yaw + Math.sin(this.t * 0.25) * 0.5;
    return null;
  }

  sellerLife(c, dt, at) {
    const f = c.fig;
    const t = (this.st = (this.st || Math.random() * 10) + dt);
    if (Math.hypot(c.pos.x - at.x, c.pos.z - at.z) > 0.3) return { x: at.x, z: at.z, speed: 1.0 };
    c.faceYaw = at.yaw;
    if (Math.sin(t * 0.7) > 0.4) {
      this.sh = this.sh || new THREE.Vector3();
      this.sh.set(c.pos.x + Math.sin(at.yaw) * 0.42, c.pos.y + 1.08, c.pos.z + Math.cos(at.yaw) * 0.42 + Math.sin(t * 5) * 0.03);
      f.reachR = this.sh;
    } else f.reachR = null;
    return null;
  }

  // the second at the counter: scooping the popcorn, filling the cups
  counterLife(c, dt, at) {
    const f = c.fig;
    const t = (this.ct = (this.ct || Math.random() * 10) + dt);
    const k = Math.sin(t * 0.21);
    const u = Math.cos(at.yaw);
    const w = -Math.sin(at.yaw);
    const tx = at.x + u * (k > 0.3 ? 1.2 : 0);
    const tz = at.z + w * (k > 0.3 ? 1.2 : 0);
    if (Math.hypot(c.pos.x - tx, c.pos.z - tz) > 0.25) {
      f.reachR = null;
      return { x: tx, z: tz, speed: 0.8 };
    }
    // (turned to the machine against the wall behind)
    const fy = at.yaw + Math.PI;
    c.faceYaw = fy;
    this.chd = this.chd || new THREE.Vector3();
    this.chd.set(c.pos.x + Math.sin(fy) * 0.45, c.pos.y + 1.05 + Math.max(0, Math.sin(t * 3)) * 0.25, c.pos.z + Math.cos(fy) * 0.45);
    f.reachR = this.chd;
    return null;
  }

  // when you come by: some in the line, some at the posters, some at the box office; in the theatre
  // people in the rows already
  populate() {
    const o = this.o;
    const touch = this.game.touch;
    const n = touch ? 3 : 7;
    for (let i = 0; i < n; i++) this.arrive(true);
    if (this.rows.length) {
      const k = touch ? 6 : 16;
      const rows = this.rows.slice();
      for (let i = 0; i < k && rows.length; i++) {
        const sp = rows.splice(Math.floor(Math.random() * rows.length), 1)[0];
        const c = this.game.civilians.spawnScripted(sp.x, sp.z, civilianLook(), o);
        const v = o.addVisitor(c, { spot: sp, mode: 'seat', already: true });
        if (!v) {
          this.game.civilians.remove(c);
          continue;
        }
        v.own = true;
        c.noCollide = true;
        c.yaw = sp.yaw;
        v.stay = 60 + Math.random() * 120;
        if (Math.random() < 0.5) {
          c.fig.carry = 'soda';
          c.fig.sodaColor = pick(DRINKS);
        }
      }
    }
  }

  // a passer-by from the street (game/streetlife.js errands): the lobby's way, and back out of the
  // door if they do not go in to a film
  admit(c) {
    const o = this.o;
    const v = o.addVisitor(c, { spot: o.room.door, mode: 'browse' });
    if (!v) return false;
    v.shop = false;
    v.lobbyMan = true;
    this.plan(v, false);
    return true;
  }

  // somebody new: in at the door (or, already, somewhere in the lobby)
  arrive(already) {
    const o = this.o;
    const s = o.shop;
    const R = o.room;
    const c = this.game.civilians.spawnScripted(s.door[0] + s.nx * 1.4 + s.rx * (Math.random() - 0.5) * 2, s.door[2] + s.nz * 1.4 + s.rz * (Math.random() - 0.5) * 2, civilianLook(), o);
    const v = o.addVisitor(c, { spot: R.door, mode: 'browse' });
    if (!v) {
      this.game.civilians.remove(c);
      return null;
    }
    v.own = true;
    v.shop = false;
    v.lobbyMan = true;
    this.plan(v, false);
    if (already) {
      // (somewhere along their way already: placed at it)
      const st = v.lobby[0];
      let at = null;
      if (st === 'poster' && this.posters.length) at = pick(this.posters);
      else if (st === 'ticket' && this.m.ticketWin) at = this.m.ticketWin;
      if (at) {
        c.pos.x = at.x;
        c.pos.z = at.z;
      } else if (st === 'snack' && o.paySpot) {
        const q = o.queue.length + 1;
        const qd = o.queueDir || [0, 1];
        c.pos.x = o.paySpot.x + qd[0] * 0.8 * q;
        c.pos.z = o.paySpot.z + qd[1] * 0.8 * q;
      }
      c.noCollide = true;
      v.phase = 'in';
      v.pts = [];
    }
    return v;
  }

  // the theatre: now and then the whole hall claps (the end of a scene), somebody calls out; while
  // you are in it
  applause(dt) {
    if (!this.rows.length || this.game.classic) return;
    this.clapT = (this.clapT === undefined ? 20 + Math.random() * 25 : this.clapT) - dt;
    if (this.clapT > 0) return;
    const o = this.o;
    const p = this.game.player.pos;
    if (this.clapT > -2.6 && o.room.inside(p.x, p.z, 0.5)) {
      const k = -this.clapT;
      for (const v of o.visitors) {
        if (v.phase !== 'at' || !v.spot || v.spot.what !== 'row' || !v.c.alive) continue;
        const f = v.c.fig;
        v.clapV = v.clapV || new THREE.Vector3();
        v.clapS = v.clapS === undefined ? Math.random() * 6 : v.clapS;
        f.toWorld(0, 1.02, 0.3 + Math.abs(Math.sin(k * 11 + v.clapS)) * 0.07, v.clapV);
        f.reachR = v.clapV;
        f.reachL = v.clapV;
      }
      if (!this.clapSaid) {
        this.clapSaid = true;
        const seated = o.visitors.filter((v) => v.phase === 'at' && v.spot && v.spot.what === 'row');
        for (let i = 0; i < 2 && seated.length; i++) o.say(pick(seated).c, pick(['Bravo!', 'Encore!', 'Wonderful!', 'Bravo! Bravo!']));
        o.sound('cheer', 0.35, 30);
      }
      return;
    }
    // (over: the hands down, till the next)
    for (const v of o.visitors) {
      if (!v.clapV) continue;
      if (v.c.fig.reachR === v.clapV) v.c.fig.reachR = null;
      if (v.c.fig.reachL === v.clapV) v.c.fig.reachL = null;
    }
    this.clapSaid = false;
    this.clapT = 35 + Math.random() * 40;
  }

  update(dt) {
    const o = this.o;
    this.applause(dt);
    if (!o.open) return;
    this.newT = (this.newT === undefined ? 3 + Math.random() * 4 : this.newT) - dt;
    if (this.newT > 0) return;
    const touch = this.game.touch;
    const lob = o.visitors.filter((v) => v.lobbyMan && v.phase !== 'at' && v.phase !== 'out').length;
    this.newT = lob < (touch ? 3 : 7) ? 3 + Math.random() * 4 : 9 + Math.random() * 8;
    if (lob < (touch ? 4 : 9)) this.arrive(false);
    // (a word between two in the line)
    if (!this.game.classic && o.queue.length > 1 && Math.random() < 0.5) {
      const a = o.queue[0].c;
      const b = o.queue[1].c;
      const p = this.game.player.pos;
      if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 16 && !a.convo && !b.convo) this.game.voices.talk([a, b], pick(MOVIE_TALK));
    }
  }
}
