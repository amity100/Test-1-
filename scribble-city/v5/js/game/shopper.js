import * as THREE from 'three';
import { fmt } from './money.js';
import { wear } from './wardrobe.js';

// (v5, ROADMAP 16.2) You in a shop of the new kind (game/shoplife.js), as its customers are.
//
// A thing taken off the shelf and looked at - its maker, its price - put back, or kept: into a basket
// off the stack by the door (in a clothes shop over your arm; at an electronics shop a boxed one from
// the back instead of the one on the table; at a jeweller's it waits for you on the counter). Then the
// till: behind whoever is being served, the things out of the basket onto the counter one by one, the
// cashier passes each over the scanner, says the total; your card to the reader; the bag handed over
// the counter, the basket back on its stack. What was bought does what it does (USE): a bite to eat,
// a coffee to be quicker, the medicine; clothes are put on.
//
// Out of the door with something not paid for: the alarm at the door, the cashier's shout, the police.
// A gun on the cashier: hands up, the till emptied into a bag a handful at a time - while the gun is
// on them - and the bag pushed across the counter; the customers run (game/brain.js), the alarm, the
// police. The till is empty for a while after.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _f = new THREE.Vector3();
const _v = new THREE.Vector3();

// what a thing bought does, by its kind on the shelf (each kind of shop adds its own as it is built:
// ROADMAP 16.3-16.9)
const USE = {
  soda: { hp: 6 },
  water: { hp: 5 },
  cans: { hp: 5 },
  juice: { hp: 8 },
  cartons: { hp: 6 },
  yogurt: { hp: 6 },
  chips: { hp: 6 },
  bread: { hp: 10 },
  candy: { hp: 5 },
  fruit: { hp: 6 },
  coffee: { coffee: 60 },
  meds: { hp: 25 },
  // (ROADMAP 16.4) the corner shop's and the pharmacy's: a sprint that does not run out, a blow that
  // hurts less, a kit in the pocket for the worst moment; a hot dog, a slush
  energy: { hp: 4, energy: 60 },
  pain: { pain: 60 },
  kit: { kit: 1 },
  hotdog: { hp: 18 },
  slush: { hp: 6 },
  // (the deli's: made and sliced at its counter - game/counterlife.js)
  sandwich: { hp: 40 },
  club: { hp: 35 },
  cheese: { hp: 15 },
  salami: { hp: 18 },
};
// a garment off the rail, as the hero wears it (game/wardrobe.js)
const INNER = [0.96, 0.95, 0.92];
const WEAR = {
  shirt: (c) => ['top', { top: { kind: 'overshirt', color: c, sleeves: 'long', inner: INNER } }],
  shirtPrint: (c) => ['top', { top: { kind: 'overshirt', color: c, sleeves: 'long', inner: INNER } }],
  tee: (c) => ['top', { top: { kind: 'tee', color: c, sleeves: 'short' } }],
  coat: (c) => ['top', { top: { kind: 'trench', color: c, sleeves: 'long', inner: INNER } }],
  folded: (c) => ['top', { top: { kind: 'sweater', color: c, sleeves: 'long' } }],
  trousers: (c) => ['bottom', { bottom: { kind: 'pants', color: c } }],
  shoe: (c) => ['shoes', { shoes: c }],
};
// what is in the till (a hold-up), by the kind of shop
const TILL = { grocery: [140, 420], fashion: [300, 800], tech: [600, 1500], jewel: [2200, 4800] };
const LINES = {
  hands: ['Whoa, whoa! Easy!', 'Okay! Okay! Don\'t shoot!', 'Please! I\'ve got kids!', 'Easy, man... easy...'],
  fill: ['It\'s all there, I swear!', 'Okay, okay, okay...', 'Here - take it!', 'I\'m going as fast as I can!'],
  give: ['That\'s everything! Just go!', 'Take it! Please, just go!', 'There! Now get out!'],
  wait: ['What... what do you want?!', 'Is that it? Can I stop?'],
  empty: ['The till\'s empty! You already took it all!', 'There\'s nothing left! Look!'],
  thief: ['Hey! You didn\'t pay for that!', 'Stop! Thief!', 'Come back here! You have to pay for that!'],
  after: ['Call the police! Somebody call the police!', 'I\'ve been robbed!', 'Help! Police!'],
  gun: ['Whoa! Put that away!', 'Hey - no guns in here!', 'Easy! Easy with that thing!'],
  wait2: ['Be right with you!', 'One moment, please!', 'You\'re next!'],
  back: ['No problem.', 'Okay, I\'ll put them back.', 'Sure - maybe next time.'],
};
const BAG = { line: 'bag', model: 'paperBag', cell: 'bag.thanks', tint: [0.79, 0.64, 0.45] };
const BASKET = { line: 'basket', model: 'basket', cell: 'tex.basket', tint: [0.82, 0.16, 0.18] };

export class Shopper {
  constructor(life) {
    this.life = life;
    this.game = life.game;
    // taken and not paid for: { it (in motion), s (its place on the shelf), what, price, heb, look }
    this.items = [];
    this.basket = null;
    this.basketSlot = null;
    // at the till: you, as the cashier sees a customer (game/shoplife.js serve)
    this.pv = null;
    this.rob = null;
    this.aimT = 0;
    this.gunT = 0;
    this.gunSaid = -99;
    const P = this.game.player;
    this.me = {
      player: true,
      get pos() { return P.pos; },
      get fig() { return P.fig; },
      get yaw() { return P.yaw; },
      get alive() { return P.hp > 0; },
    };
  }

  // how many at once: a basket's worth, an armful, two boxes
  get max() {
    const f = this.life.prof.flow;
    return this.life.prof.baskets ? 8 : f === 'fashion' ? 3 : 2;
  }

  total() {
    let n = 0;
    for (const r of this.items) n += r.price;
    return n;
  }

  // ---------------------------------------------------------------- taking things
  // the shelf's dialog (game/shoplife.js inspect): its choice to keep it, or null when your hands are full
  takeLabel(price) {
    if (this.pv || this.items.length >= this.max) return null;
    const f = this.life.prof.flow;
    if (f === 'tech') return `לקחת אחד באריזה לקופה · ${fmt(price)}`;
    if (f === 'jewel') return `לשמור לי בקופה · ${fmt(price)}`;
    if (f === 'fashion') return `לקחת לקופה · ${fmt(price)}`;
    return `לשים בסל · ${fmt(price)}`;
  }

  // the line under the product in its dialog: what you have already
  have() {
    if (!this.items.length) return '';
    const f = this.life.prof.flow;
    const where = this.life.prof.baskets ? 'בסל' : f === 'jewel' ? 'שמור בקופה' : 'בידיים';
    return ` · ${where}: ${this.items.length} (${fmt(this.total())})`;
  }

  take(it, s, price) {
    const L = this.life;
    const rec = { it, s, what: s.what, price, heb: L.prof.heb[s.what] || 'מוצר', look: s.look };
    it.price = price;
    if (L.prof.flow === 'tech' && L.prof.boxed) {
      // (the one on the table is the shop's, to try: a boxed one from the back for you)
      L.giveBack(it);
      rec.it = L.movers.add(L.prof.boxed, true);
      rec.it.price = price;
      rec.s = null;
    }
    this.items.push(rec);
    this.arrange();
    this.game.audio.play('click', 0.25);
  }

  // where your things are: in the basket on your arm, over your arm, on the counter
  arrange() {
    const L = this.life;
    const P = this.game.player;
    if (!this.items.length) {
      this.dropBasket();
      if (P.fig.carryL === 'basketHeld' || P.fig.carryL === 'held') P.fig.carryL = null;
      return;
    }
    if (L.prof.baskets) {
      if (!this.basket) {
        const bs = L.takeTopBasket();
        this.basketSlot = bs;
        this.basket = L.movers.add(bs ? bs.look : BASKET, true);
      }
      this.basket.at = { c: this.me, how: 'basket' };
      P.fig.carryL = 'basketHeld';
      this.items.forEach((r, k) => {
        r.it.at = { basket: this.basket, k };
      });
      return;
    }
    if (L.prof.flow === 'jewel') {
      // (on its tray on the counter, until you pay)
      const a = L.marks.belt;
      const b = L.marks.belt2 || a;
      this.items.forEach((r, k) => {
        r.it.at = a ? { x: a.x + (b.x - a.x) * Math.min(1, k * 0.35), y: a.y, z: a.z + (b.z - a.z) * Math.min(1, k * 0.35), yaw: L.open.homeYaw } : { c: this.me, how: 'armful', k };
      });
      return;
    }
    P.fig.carryL = 'held';
    this.items.forEach((r, k) => {
      r.it.at = { c: this.me, how: 'armful', k };
    });
  }

  // the basket back on its stack by the door
  dropBasket() {
    const L = this.life;
    if (!this.basket) return;
    L.movers.remove(this.basket);
    const free = L.freeBasket();
    if (free) L.setSlot(free, 'shelf');
    this.basket = null;
    this.basketSlot = null;
    if (this.pv) this.pv.L.basket = null;
  }

  // ---------------------------------------------------------------- the till
  checkout() {
    const L = this.life;
    const g = this.game;
    if (this.pv || !this.items.length) return;
    const k = L.open.keeper;
    if (!k || !k.alive || k.owner !== L.open || !L.open.open) {
      g.hud.toast('אין אף אחד בקופה', 'info', 2);
      return;
    }
    const pv = (this.pv = { c: this.me, me: true, L: { st: 'unload', t: 0, k: 0, n: 0, got: [], reach: new THREE.Vector3(), reachL: new THREE.Vector3(), basket: this.basket } });
    if (L.payer && L.payer !== pv && L.payer.c.alive) {
      // (behind whoever is being served: you are next)
      pv.L.st = 'queue';
      L.queue.unshift(pv);
      g.hud.toast('אתם הבאים בתור', 'info', 1.8);
      L.say(k, pick(LINES.wait2), 0.9);
    } else L.payer = pv;
  }

  till(dt, pv) {
    const L = this.life;
    const g = this.game;
    const P = g.player;
    const T = pv.L;
    T.t += dt;
    const ps = L.room.pay;
    // (walked off from the till: what you had is the shop's again)
    if (!L.open.open || (ps && Math.hypot(P.pos.x - ps.x, P.pos.z - ps.z) > (T.st === 'queue' ? 4.5 : 2.6))) {
      this.leaveTill(true);
      return;
    }
    switch (T.st) {
      case 'queue':
        if (L.queue[0] === pv && (!L.payer || L.payer === pv || !L.payer.c.alive)) {
          L.queue.shift();
          L.payer = pv;
          T.st = 'unload';
          T.t = 0;
        }
        break;
      case 'unload': {
        // onto the counter, one after another
        const a = L.marks.belt;
        const b = L.marks.belt2 || a;
        if (T.t < 0.42) break;
        if (T.k >= this.items.length || !a) {
          T.st = 'waitScan';
          T.t = 0;
          P.fig.reachR = null;
          this.dropBasket();
          if (P.fig.carryL === 'basketHeld' || P.fig.carryL === 'held') P.fig.carryL = null;
          break;
        }
        const it = this.items[T.k].it;
        const n = L.belt.length;
        const tx = a.x + (b.x - a.x) * Math.min(1, n * 0.34);
        const tz = a.z + (b.z - a.z) * Math.min(1, n * 0.34);
        it.at = { x: tx, y: a.y, z: tz, yaw: Math.atan2(P.pos.x - tx, P.pos.z - tz) + (Math.random() - 0.5) * 0.6, tilt: it.t.hang ? -Math.PI / 2 : 0, flat: !!it.t.hang };
        L.belt.push({ it, v: pv });
        P.fig.reachR = T.reach.set(tx, a.y + 0.06, tz);
        T.k++;
        T.n++;
        T.t = 0;
        break;
      }
      case 'waitScan':
        // (the cashier at it: game/shoplife.js serve)
        if (T.t > 0.3) P.fig.reachR = null;
        break;
      case 'pay':
        if (!T.asked) {
          T.asked = true;
          T.t = 0;
          this.payDialog(pv);
        } else if (!g.dialog.open && T.t > 0.5) this.leaveTill(true);
        break;
      case 'card': {
        // the card held to the reader: a beep
        const r = L.marks.reader;
        if (r) P.fig.reachR = T.reach.set(r.x, r.y + 0.03, r.z);
        if (T.t > 0.8 && !T.beeped) {
          T.beeped = true;
          L.open.sound('beep', 0.7, 12);
        }
        if (T.t > 1.2) {
          P.fig.reachR = null;
          T.st = 'waitBag';
          T.t = 0;
        }
        break;
      }
      case 'waitBag':
        // (the bag handed over: yours, and what was in it)
        if (T.bag) this.paid(pv);
        else if (T.t > 8) this.paid(pv);
        break;
      default:
        break;
    }
  }

  payDialog(pv) {
    const L = this.life;
    const g = this.game;
    const total = this.total();
    const n = this.items.length;
    const name = L.shop.name || 'קופה';
    const what = summary(this.items.map((r) => r.heb));
    g.dialog.show(name, `${what}. לתשלום: ${fmt(total)}`, [
      {
        label: `לשלם בכרטיס · ${fmt(total)}`,
        fn: () => {
          const M = g.money;
          if (M && !M.pay(total, name)) {
            M.refuse(name, total, false, () => {});
            this.leaveTill(false);
            return;
          }
          pv.L.st = 'card';
          pv.L.t = 0;
          L.stats.bought += n;
        },
      },
      { label: 'לוותר', fn: () => this.leaveTill(true) },
    ]);
  }

  // paid and the bag in your hand: what was bought does what it does
  paid(pv) {
    const L = this.life;
    const list = this.items;
    this.items = [];
    for (const r of list) {
      if (r.s && r.s.state !== 'shelf') L.setSlot(r.s, 'gone');
      L.movers.remove(r.it);
    }
    if (L.payer === pv) L.payer = null;
    this.pv = null;
    this.use(list, false);
  }

  // away from the till without paying (or not able to): what was on the counter and in your basket is
  // the shop's again; what the cashier had already rung up stays behind the counter
  leaveTill(said) {
    const L = this.life;
    const pv = this.pv;
    const P = this.game.player;
    if (pv) {
      const qi = L.queue.indexOf(pv);
      if (qi >= 0) L.queue.splice(qi, 1);
      if (L.payer === pv) L.payer = null;
      for (const b of L.belt.filter((q) => q.v === pv)) L.belt.splice(L.belt.indexOf(b), 1);
    }
    for (const r of this.items) {
      if (L.movers.items.includes(r.it)) {
        if (r.s) L.giveBack(r.it);
        else L.movers.remove(r.it);
      } else if (r.s && r.s.state === 'held') L.setSlot(r.s, 'gone');
    }
    this.items = [];
    this.pv = null;
    this.dropBasket();
    if (P.fig.carryL === 'basketHeld' || P.fig.carryL === 'held') P.fig.carryL = null;
    P.fig.reachR = null;
    const k = L.open.keeper;
    if (said && k && k.alive) L.say(k, pick(LINES.back), 0.8);
  }

  // what you came out with, bought or not
  use(list, stolen) {
    const g = this.game;
    const P = g.player;
    let hp = 0;
    let coffee = 0;
    let energy = 0;
    let pain = 0;
    let kits = 0;
    let worn = null;
    for (const r of list) {
      const u = USE[r.what];
      if (u) {
        hp += u.hp || 0;
        coffee = Math.max(coffee, u.coffee || 0);
        energy = Math.max(energy, u.energy || 0);
        pain = Math.max(pain, u.pain || 0);
        kits += u.kit || 0;
      }
      // (clothes: put on - the last of each kind)
      const model = r.look && r.look.model;
      const w = WEAR[model] || (r.what === 'shoe' ? WEAR.shoe : null);
      if (w && r.look.tint) {
        const [part, item] = w(r.look.tint.slice());
        try {
          wear(g, part, item);
          worn = r.heb;
        } catch (e) {
          void e;
        }
      }
    }
    if (hp) P.hp = Math.min(P.maxHp, P.hp + hp);
    if (coffee) P.coffeeT = Math.max(P.coffeeT || 0, coffee);
    if (energy) P.energyT = Math.max(P.energyT || 0, energy);
    if (pain) P.painT = Math.max(P.painT || 0, pain);
    if (kits) P.kits = (P.kits || 0) + kits;
    const fx = [
      hp ? `+${hp} חיים` : null,
      coffee ? `מהירות ל־${coffee} שניות` : null,
      energy ? `ריצה בלי להתעייף ל־${energy} שניות` : null,
      pain ? `פחות נזק ל־${pain} שניות` : null,
      kits ? `ערכת עזרה ראשונה בכיס (${P.kits})` : null,
      worn ? 'לבשתם את זה' : null,
    ].filter(Boolean).join(', ');
    g.hud.toast(`${stolen ? 'גנבתם' : 'קניתם'}: ${summary(list.map((r) => r.heb))}${fx ? ` (${fx})` : ''}`, stolen ? 'bad' : 'good', 3);
  }

  // ---------------------------------------------------------------- out of the door without paying
  shoplift() {
    const L = this.life;
    const g = this.game;
    const P = g.player;
    const list = this.items.filter((r) => !L.belt.some((b) => b.it === r.it));
    if (this.pv) this.leaveTill(false);
    this.items = [];
    let value = 0;
    for (const r of list) {
      value += r.price;
      L.movers.remove(r.it);
      if (r.s) L.setSlot(r.s, 'gone');
    }
    // (the basket goes out with you, and the things in it)
    if (this.basket) {
      L.movers.remove(this.basket);
      this.basket = null;
      this.basketSlot = null;
    }
    if (!list.length) return;
    P.fig.carryL = L.prof.baskets ? 'basket' : 'bag';
    P.bagUntil = g.time + 40;
    // the alarm at the door, the shout, the police
    const d = L.room.door || P.pos;
    L.open.sound('buzzer', 0.9, 30);
    L.open.sound('alarm', 0.7, 40);
    const k = L.open.keeper;
    if (k && k.alive && k.owner === L.open) L.say(k, pick(LINES.thief), 1);
    if (g.police) g.police.crime('alarm', d.x, d.z);
    L.stats.stolen = (L.stats.stolen || 0) + list.length;
    this.use(list, true);
    g.hud.toast(`יצאתם בלי לשלם (${fmt(value)}) — האזעקה בדלת צפצפה`, 'bad', 3.2);
  }

  // ---------------------------------------------------------------- a gun in the shop
  // the gun on the keeper: the camera's line passes close by them
  gunOn(c) {
    const g = this.game;
    const w = g.weapons;
    if (!w || !w.isAiming() || w.current.def.kind !== 'gun' || !c || !c.alive) return false;
    const o = g.camera.position;
    const f = g.camera.getWorldDirection(_f);
    const dx = c.pos.x - o.x;
    const dy = c.pos.y + 1.2 - o.y;
    const dz = c.pos.z - o.z;
    const t = dx * f.x + dy * f.y + dz * f.z;
    if (t < 0.5 || t > 14) return false;
    return Math.hypot(dx - f.x * t, dy - f.y * t, dz - f.z * t) < 0.9;
  }

  armed() {
    const w = this.game.weapons;
    return !!w && w.isAiming() && w.current.def.kind === 'gun';
  }

  robCheck(dt, inside) {
    const L = this.life;
    const g = this.game;
    const P = g.player;
    if (this.rob) return;
    const k = L.open.keeper;
    if (!inside || !L.open.open || !k || !k.alive || k.owner !== L.open) {
      this.aimT = 0;
      this.gunT = 0;
      return;
    }
    if (!this.armed()) {
      this.aimT = 0;
      this.gunT = 0;
      return;
    }
    // (a gun out in here: a word from the counter, and the customers do not stay to see)
    this.gunT += dt;
    if (this.gunT > 0.6 && g.time - this.gunSaid > 7) {
      this.gunSaid = g.time;
      g.civilians.panic(_v.set(P.pos.x, P.pos.y, P.pos.z), 14, 'assault', { by: 'player' });
      if (!this.gunOn(k)) L.say(k, pick(LINES.gun), 1);
    }
    if (this.gunOn(k)) {
      this.aimT += dt;
      if (this.aimT > 0.3) this.startRob(k);
    } else this.aimT = 0;
  }

  startRob(k) {
    const L = this.life;
    const g = this.game;
    const P = g.player;
    if (this.pv) this.leaveTill(false);
    const shop = L.shop;
    const empty = shop.robbedT !== undefined && g.time - shop.robbedT < 900;
    const [a, b] = TILL[L.prof.flow || 'grocery'] || TILL.grocery;
    this.rob = { k, st: 'hands', t: 0, n: 0, lost: 0, out: 0, cash: empty ? 0 : Math.round(a + Math.random() * (b - a)), bag: null, ready: false, taken: false, reported: false, brave: k.brave, reach: new THREE.Vector3() };
    // (the keeper stays - behind the counter, hands up - however frightened: game/brain.js)
    k.brave = true;
    k.fig.armsUp = 1;
    L.say(k, pick(LINES.hands), 1);
    if (g.time - this.gunSaid > 3) {
      this.gunSaid = g.time;
      g.civilians.panic(_v.set(P.pos.x, P.pos.y, P.pos.z), 14, 'assault', { by: 'player' });
    }
    L.stats.robbed = (L.stats.robbed || 0) + 1;
  }

  // the keeper, held up (game/shoplife.js keeper hands over to this): where they go, what they do
  robKeeper(c, dt) {
    const L = this.life;
    const g = this.game;
    const P = g.player;
    const R = this.rob;
    const f = c.fig;
    const home = L.open.home;
    R.t += dt;
    if (this.gunOn(c)) R.lost = 0;
    else R.lost += dt;
    f.lookAt = P.fig.j.headC;
    c.faceYaw = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z);
    switch (R.st) {
      case 'hands':
        f.armsUp = 1;
        f.reachR = null;
        f.carry = null;
        if (R.t > 1.6) {
          R.t = 0;
          if (!R.cash) {
            L.say(c, pick(LINES.empty), 1);
            R.st = 'cower';
            break;
          }
          // the drawer open, a bag on the counter
          R.st = 'till';
          L.open.sound('till', 0.6, 14);
          const bm = L.marks.bag;
          R.bag = L.movers.add(BAG, true);
          if (bm) R.bag.at = { x: bm.x, y: bm.y - 0.01, z: bm.z, yaw: L.open.homeYaw + Math.PI / 2 };
          else R.bag.at = { c, how: 'bag' };
          L.say(c, pick(LINES.fill), 0.7);
        }
        break;
      case 'till': {
        // a handful out of the drawer, into the bag; again - looking up at you between
        f.armsUp = 0;
        if (R.lost > 2.5) {
          R.st = 'wait';
          R.t = 0;
          L.say(c, pick(LINES.wait), 0.8);
          break;
        }
        const m = L.marks.drawer || L.marks.keys;
        const bm = L.marks.bag;
        const ph = R.t % 1.0;
        const at = ph < 0.5 ? m : bm;
        if (at) {
          f.reachR = R.reach.set(at.x, at.y + 0.06, at.z);
          c.faceYaw = Math.atan2(at.x - c.pos.x, at.z - c.pos.z);
          f.lookAt = R.t % 2 < 1.2 ? f.reachR : P.fig.j.headC;
        }
        f.carry = ph < 0.5 ? null : 'cash';
        if (R.t > (R.n + 1) * 1.0) {
          R.n++;
          L.open.sound('pageflip', 0.45, 10);
        }
        if (R.n >= 4) {
          R.st = 'give';
          R.t = 0;
          f.carry = null;
          L.say(c, pick(LINES.give), 1);
        }
        break;
      }
      case 'wait':
        // (the gun off them: frozen, hands up - on again, on with it)
        f.armsUp = 1;
        f.reachR = null;
        f.carry = null;
        if (R.lost === 0) {
          R.st = 'till';
          R.t = R.n * 1.0;
        }
        break;
      case 'give': {
        // the bag pushed over the counter to you
        const bm = L.marks.bag;
        const ps = L.room.pay;
        f.armsUp = 0;
        if (R.bag && bm && ps) {
          const k = Math.min(1, R.t / 0.8) * 0.5;
          R.bag.at = { x: bm.x + (ps.x - bm.x) * k, y: bm.y - 0.01, z: bm.z + (ps.z - bm.z) * k, yaw: L.open.homeYaw + Math.PI / 2 };
          f.reachR = R.reach.set(R.bag.pos.x, bm.y + 0.15, R.bag.pos.z);
        }
        if (R.t > 1.0) {
          f.reachR = null;
          R.ready = true;
          R.st = 'cower';
          R.t = 0;
          g.hud.toast('השקית על הדלפק — קחו אותה', 'info', 2.5);
        }
        break;
      }
      default:
        // cowering behind the counter, hands up
        f.armsUp = 1;
        f.reachR = null;
        f.carry = null;
        break;
    }
    return { x: home.x, z: home.z, speed: 0.6 };
  }

  robUpdate(dt, inside) {
    const L = this.life;
    const g = this.game;
    const P = g.player;
    const R = this.rob;
    const k = R.k;
    if (!k.alive || k.owner !== L.open) {
      this.endRob();
      return;
    }
    // (the bag: yours when you are at it)
    if (R.ready && !R.taken && R.bag && Math.hypot(R.bag.pos.x - P.pos.x, R.bag.pos.z - P.pos.z) < 1.9) {
      R.taken = true;
      R.bag.at = { c: this.me, how: 'carried' };
      P.fig.carryL = 'bagHeld';
      L.shop.robbedT = g.time;
      if (g.money) g.money.earn(R.cash, `שוד: ${L.shop.name || 'חנות'}`);
      g.hud.toast(`לקחתם ${fmt(R.cash)} מהקופה — המשטרה בדרך`, 'bad', 3);
      this.report();
    }
    if (!inside) {
      R.out += dt;
      if (!R.reported) this.report();
      if (R.out > 3) this.endRob();
      return;
    }
    if (R.st === 'cower' && R.t > (R.taken ? 30 : 45)) this.endRob();
  }

  // the alarm under the counter: the police on the way
  report() {
    const R = this.rob;
    const L = this.life;
    const g = this.game;
    if (!R || R.reported) return;
    R.reported = true;
    const d = L.room.door || g.player.pos;
    L.open.sound('alarm', 0.8, 40);
    if (g.police) {
      // (a hold-up is more than a thing walked out with: two stars - a jeweller's, three)
      g.police.crime('alarm', d.x, d.z);
      g.police.addHeat(L.prof.flow === 'jewel' ? 2.7 : 0.95, d.x, d.z, false);
    }
    if (R.k.alive) L.say(R.k, pick(LINES.after), 1);
  }

  endRob() {
    const R = this.rob;
    if (!R) return;
    const k = R.k;
    if (R.bag && !R.taken) this.life.movers.remove(R.bag);
    if (k) {
      k.brave = R.brave;
      if (k.alive) {
        k.fig.armsUp = 0;
        k.fig.reachR = null;
        k.fig.carry = null;
      }
    }
    this.rob = null;
  }

  // ---------------------------------------------------------------- every frame (game/shoplife.js update)
  update(dt) {
    const L = this.life;
    const g = this.game;
    const P = g.player;
    const R = L.room;
    // (on foot or drawing in the air, it is all the same: in a car you are not in a shop)
    const inside = !P.inVehicle && R.inside(P.pos.x, P.pos.z, 0.3, P.pos.y);
    this.robCheck(dt, inside && P.mode === 'foot');
    if (this.rob) this.robUpdate(dt, inside);
    if (this.pv) this.till(dt, this.pv);
    if (this.items.length && !inside) {
      // out of the door with them (not carried off some other way: erased, in a car, far away)
      const d = R.door;
      const near = d && Math.hypot(P.pos.x - d.x, P.pos.z - d.z) < 7;
      if (near && P.hp > 0 && !P.inVehicle) this.shoplift();
      else this.leaveTill(false);
    }
  }

  dispose() {
    if (this.items.length || this.pv) this.leaveTill(false);
    this.endRob();
  }
}

// "a loaf, 2 x a bottle of water"
function summary(names) {
  const m = new Map();
  for (const n of names) m.set(n, (m.get(n) || 0) + 1);
  return [...m].map(([n, k]) => (k > 1 ? `${k}× ${n}` : n)).join(', ');
}
