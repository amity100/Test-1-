import * as THREE from 'three';
import { shopkeeperLook, civilianLook, friendLook, kidLook, elderLook } from './looks.js';
import { HAIR_SKETCH } from './airsketch.js';
import { BLUEPRINTS, BLUEPRINT_MORE, BLUEPRINT_TOOLS } from './blueprints.js';
import { dampAngle } from '../core/util.js';
import { DISTRICT_NAMES, blockAt, CURB } from '../world/layout.js';
import { TOPS, BOTTOMS, SHOES, HATS, ACCS, TATTOOS, FASHION_TOPS, FASHION_BOTTOMS, SHOE_WALL, SPORT_TOPS, JEWELS, wear, armorUp, outfitOf, putOn, ownTattoo } from './wardrobe.js';
import { PRICES, SHELF_PRICES, CASH_ONLY, fmt } from './money.js';
import { BOSS } from './properties.js';
import { TOOLS, BOTTLE } from './ink.js';
import { Dining, BarLife, LobbyLife, eatPlate } from './venuelife.js';

// The shops are open: a shopkeeper out front (tossing dough, sweeping, cutting someone's hair on
// the sidewalk, strumming a guitar), people popping in and coming back out with a pizza box or a
// coffee, and you can walk up to any door: they draw what you ask for, right there in the air.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
// an open lift: the dim car between the doors (hatched), the light in its ceiling, the doors' edges
const LIFT_CAR = [0.3, 0.24, 0.21];
const LIFT_LIGHT = [1, 0.9, 0.62];
const INK = [0.16, 0.15, 0.2];
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

// what a customer comes out with
const ITEM = {
  pizza: 'pizzaBox', cafe: 'coffee', grocery: 'bag', deli: 'bag', bagel: 'bag', flowers: 'bouquet', books: 'book',
  icecream: 'icecream', hardware: 'bag', laundry: 'laundry', sushi: 'bag', falafel: 'bag', shop: 'bag', pharmacy: 'bag',
  phones: 'phone', optics: null, gym: null, music: null, barber: null, lobby: null,
  tacos: 'bag', diner: 'bag', juice: 'coffee', surf: null, boutique: 'bag', arcade: null, bar: null, cinema: 'soda',
  // (v5, ROADMAP 11.17: the mainland's stores - a bag in the store's own colour)
  fashion: 'shopBag', shoes: 'shopBag', electronics: 'shopBag', jewelry: 'shopBag', toys: 'teddy', perfume: 'shopBag', sports: 'shopBag',
  burger: 'burger', noodles: 'noodleBox', gourmet: null, club: null, theatre: 'soda',
  // (v5, ROADMAP 11.18: the carts at the curb)
  hotdog: 'hotdog',
};
// what the shopkeeper holds while working
const TOOL = {
  pizza: 'dough', cafe: 'tray', grocery: 'apple', deli: null, bagel: 'tray', flowers: 'bouquet', books: 'book',
  icecream: 'icecream', hardware: 'broom', laundry: 'laundry', sushi: null, falafel: null, shop: 'broom', pharmacy: null,
  phones: 'phone', optics: null, gym: 'dumbbell', music: 'guitar', barber: 'scissors', lobby: null,
  friends: 'magicPencil', tacos: 'tray', diner: 'tray', juice: 'tray', surf: null, boutique: null, arcade: null, bar: 'tray', cinema: null,
  fashion: null, shoes: null, electronics: 'phone', jewelry: null, toys: null, perfume: null, sports: null, burger: 'tray', noodles: null, gourmet: null, club: null, theatre: null,
  homeFamily: null, homeArtist: null, homeGrandma: null, homeLux: null,
};
const CALLS = {
  hotdog: ['Hot dogs! Get your hot dogs!', 'Best dogs in town!', 'Mustard, ketchup, the works!'],
  pizza: ['Hot slice!', 'Fresh outta the oven!', 'Pizza! Pizza!'],
  cafe: ['Coffee\'s fresh!', 'Double espresso?', 'Table for one?'],
  grocery: ['Fresh peaches!', 'Apples, two for one!'],
  deli: ['Pastrami on rye!', 'Best sandwich in town!'],
  bagel: ['Hot bagels!', 'Still warm!'],
  flowers: ['Flowers for your sweetheart?', 'Roses! Tulips!'],
  books: ['Hmm... chapter twelve.', 'Used books, cheap!'],
  icecream: ['Two scoops!', 'Ice cream!'],
  hardware: ['Need a new eraser?'],
  laundry: ['Clean sheets!'],
  sushi: ['Fresh rolls!'],
  falafel: ['Falafel! Hot falafel!'],
  shop: ['Come on in!'],
  pharmacy: ['Feeling scratchy?'],
  phones: ['Uh-huh... uh-huh...', 'New phones!'],
  optics: ['See better, draw better!'],
  gym: ['One more rep!', 'Feel the burn!'],
  music: ['This one\'s for you!', 'Any requests?'],
  barber: ['Snip snip!', 'Hold still...'],
  lobby: ['Good evening.', 'Mind the floor, it\'s wet.', 'Lift\'s on the way.'],
  friends: ['Draw yourself a friend!', 'Magic pencils! One dollar!', 'Lonely? Draw a friend!', 'Every friend comes out different!'],
  tacos: ['Tacos! Hot tacos!', 'Two for one, tonight!', 'Extra salsa?'],
  diner: ['Burgers! Shakes!', 'Coffee refill?', 'Pie of the day!'],
  juice: ['Fresh mango juice!', 'Smoothies! Ice cold!'],
  surf: ['Surf\'s up!', 'Boards for rent!'],
  boutique: ['New collection!', 'Try it on, darling!'],
  arcade: ['New high score!', 'Insert coin!'],
  bar: ['Happy hour!', 'One more round?', 'Live music tonight!'],
  cinema: ['Tonight: THE ERASER!', 'Popcorn! Fresh popcorn!'],
  fashion: ['New season, new you!', 'Thirty percent off!', 'Try it on, the fitting rooms are free!'],
  shoes: ['Fresh kicks!', 'Second pair half price!', 'What size are you?'],
  electronics: ['Latest models!', 'Free headphones with every phone!', 'Have you seen this screen?'],
  jewelry: ['Something sparkly?', 'Solid gold, darling.', 'For someone special?'],
  toys: ['Toys! Toys! Toys!', 'Look, it talks!', 'Every kid\'s dream!'],
  perfume: ['A little spritz?', 'Smell like a garden!', 'Try the new one!'],
  sports: ['Game day sale!', 'Just move!', 'New sneakers in!'],
  burger: ['Order forty-two!', 'Fries with that?', 'Burgers! Hot off the grill!'],
  noodles: ['Hot noodles!', 'Straight from the wok!', 'Extra spicy?'],
  gourmet: ['Service!', 'Table four, please.', 'Bon appétit.'],
  club: ['Make some noise!', 'Hands up!', 'One more song!'],
  theatre: ['Popcorn! Fresh popcorn!', 'The show starts soon!', 'Tickets, tickets!'],
  homeFamily: ['Dinner\'s ready!', 'Kids, wash your hands!', 'Who left the TV on?', 'Smells good, right?'],
  homeArtist: ['Hmm... more blue.', 'Inspiration!', 'Don\'t touch, it\'s wet!', 'Almost finished...'],
  homeGrandma: ['Who wants cookies?', 'Come in, sweetie!', 'In my day...', 'Domino, anyone?'],
  homeLux: ['Lovely evening.', 'The pool is warm today.', 'A little Chopin?'],
};

// (v5, ROADMAP 11.18) shopping: the shops whose customers take a basket (its colour), the colours
// of what they pick up, and what they say at the shelves
const BASKETS = {
  grocery: [0.86, 0.2, 0.22], deli: [0.7, 0.3, 0.28], shop: [0.3, 0.45, 0.85], pharmacy: [0.32, 0.66, 0.46],
  hardware: [0.86, 0.5, 0.22], toys: [0.98, 0.78, 0.2], sports: [0.24, 0.56, 0.36],
};
const ITEM_COLS = [[0.92, 0.26, 0.3], [0.98, 0.78, 0.2], [0.24, 0.6, 0.92], [0.96, 0.52, 0.2], [0.36, 0.72, 0.38], [0.62, 0.36, 0.82], [0.98, 0.98, 0.95], [0.95, 0.5, 0.66], [0.2, 0.7, 0.72]];
const CLOTH_COLS = [[0.95, 0.45, 0.6], [0.45, 0.6, 0.95], [0.98, 0.9, 0.6], [0.6, 0.85, 0.7], [0.75, 0.5, 0.85], [0.98, 0.98, 0.95], [0.2, 0.22, 0.3], [0.86, 0.36, 0.3], [0.4, 0.7, 0.8]];
const SODA_COLS = [[0.86, 0.14, 0.18], [0.2, 0.62, 0.3], [0.98, 0.74, 0.18], [0.3, 0.55, 0.9], [0.96, 0.5, 0.18]];
const SHOP_SAYS = {
  grocery: ['Where\'s the milk?', 'Two for one? Nice.', 'Hmm, no sugar...', 'We\'re out of eggs again?', 'This one\'s cheaper.'],
  deli: ['Smells amazing.', 'Half a pound, please.', 'Is this fresh?'],
  shop: ['Do they have batteries?', 'Hmm...', 'Where is it...'],
  pharmacy: ['Something for a headache...', 'Sunscreen, sunscreen...', 'Vitamins!'],
  fashion: ['Do you have this in blue?', 'Too small...', 'I love this color!', 'Is this on sale?', 'Does it come in a medium?'],
  boutique: ['So pretty!', 'Is this silk?', 'I\'ll try it on.'],
  surf: ['Nice shorts!', 'This is so summer.'],
  shoes: ['Do you have a size nine?', 'So comfy!', 'Can I try the left one?'],
  electronics: ['Is this the new model?', 'How much storage?', 'The screen is huge!', 'Does it come with a charger?'],
  phones: ['Is this unlocked?', 'Nice camera!'],
  toys: ['My nephew would love this!', 'Ooh, a robot!', 'Is it for ages five and up?'],
  perfume: ['Mmm, lovely.', 'Too sweet...', 'That\'s the one!'],
  books: ['Oh, I read this one!', 'Is there a second part?', 'Hmm, the cover is nice.'],
  sports: ['Light as a feather!', 'Do these come in red?'],
  hardware: ['Which screws do I need...', 'Ah, there it is.'],
  optics: ['Do these suit me?', 'Too round?'],
  jewelry: ['It sparkles!', 'Can I see that one?'],
  default: ['Hmm...', 'Excuse me!', 'I\'ll take it!', 'Is this on sale?', 'Nice.'],
};

// the hero's own look (hair, glasses, muscles) survives a reload
const HERO_KEY = 'scribble-city-v5-hero';

export class StreetLife {
  constructor(game) {
    this.game = game;
    this.shops = game.world.shops || [];
    this.active = new Map();
    this.scanT = 0;
    this.errandT = 3;
    this.callT = 4;
    this.notes = []; // music notes floating up from the busker
    this.loadHero();
  }

  // ------------------------------------------------------------------ the hero's style
  loadHero() {
    try {
      const d = JSON.parse(localStorage.getItem(HERO_KEY) || 'null');
      if (d) this.applyHero(d);
    } catch (e) {
      // storage unavailable
    }
  }

  saveHero() {
    const L = this.game.player.fig.look;
    const d = { hair: L.hair.style !== 'none' ? L.hair : null, bald: L.hair.style === 'none', hat: L.hat || null, glasses: L.face.glasses, bulk: this.game.player.fig.bulk, maxHp: this.game.player.maxHp };
    // (what he wears: ROADMAP 5.7, not with ?classic)
    if (!this.game.classic) d.outfit = outfitOf(L);
    try {
      localStorage.setItem(HERO_KEY, JSON.stringify(d));
    } catch (e) {
      // ignore
    }
  }

  applyHero(d) {
    const p = this.game.player;
    const L = p.fig.look;
    // (the hero's first clothes were a white tee, grey trousers, white sneakers and a black cap, then
    // for a while a dark jacket and jeans: a save that still holds just those gets the new first
    // clothes instead)
    const was = (c, v) => Array.isArray(c) && c.length >= 3 && v.every((x, i) => Math.abs(c[i] - x) < 0.006);
    const o = d.outfit;
    // (the hero's first clothes as they were, top, bottom and shoes)
    const FIRST = [
      [[0.97, 0.96, 0.93], [0.36, 0.36, 0.39], [0.96, 0.96, 0.95]],
      [[0.25, 0.16, 0.12], [0.16, 0.19, 0.27], [0.2, 0.14, 0.11]],
      [[0.4, 0.26, 0.18], [0.26, 0.31, 0.43], [0.32, 0.21, 0.14]],
    ];
    const first = o && o.top && o.bottom && FIRST.find(([t, b]) => was(o.top.color, t) && was(o.bottom.color, b));
    if (first) d = { ...d, outfit: { ...o, top: null, bottom: null, shoes: was(o.shoes, first[2]) ? null : o.shoes, acc: (o.acc || []).filter((a) => a !== 'belt') } };
    if (d.hat && d.hat.kind === 'cap' && was(d.hat.color, [0.09, 0.09, 0.11])) d = { ...d, hat: null };
    if (d.hair) L.hair = { style: d.hair.style, color: d.hair.color };
    else if (d.bald) L.hair = { style: 'none', color: L.skin };
    if (d.hat !== undefined) L.hat = d.hat;
    if (d.glasses !== undefined) L.face.glasses = d.glasses;
    if (d.bulk) p.fig.bulk = d.bulk;
    if (d.outfit && !this.game.classic) putOn(this.game, d.outfit);
    if (d.maxHp) {
      p.maxHp = d.maxHp;
      p.hp = Math.min(p.hp, p.maxHp);
    }
  }

  // ------------------------------------------------------------------ activation
  get budget() {
    return this.game.touch ? 3 : 6;
  }

  update(dt) {
    const game = this.game;
    if (game.inBar) return;
    const p = game.anchorPos();
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.6;
      const near = [];
      const R = game.rhythm;
      for (const s of this.shops) {
        // (a shop that is closed at this hour stays dark: game/rhythm.js, game/shutters.js)
        if (R && !R.open(s.kind)) continue;
        // (the mega mall's floors one over another: the stores on your own floor first)
        const d = Math.hypot(s.door[0] - p.x, s.door[2] - p.z) + Math.abs(s.door[1] - p.y) * 2.5;
        if (d < 62) near.push([d - (s.stand ? 25 : 0), s]);
      }
      near.sort((a, b) => a[0] - b[0]);
      const want = new Set(near.slice(0, this.budget).map((n) => n[1]));
      for (const [id, a] of this.active) {
        const d = Math.hypot(a.shop.door[0] - p.x, a.shop.door[2] - p.z) + Math.abs(a.shop.door[1] - p.y) * 2.5;
        // (closing: let go once the shutter is down and nobody sees them go; a stand packs up when
        // you are not looking)
        const shut = a.shop.shut || ((a.shop.stand || !a.shop.room) && R && !R.open(a.shop.kind) && d > 30);
        if (!want.has(a.shop) && (d > 75 || this.active.size > this.budget + 1 || shut)) {
          a.dispose();
          this.active.delete(id);
        }
      }
      for (const s of want) if (!this.active.has(s.id)) this.active.set(s.id, new OpenShop(this, s));
    }
    for (const a of this.active.values()) a.update(dt);
    if (this.companion && !this.companion.alive) this.companion = null;
    this.updateErrands(dt);
    this.updateCalls(dt);
    this.tidyT = (this.tidyT || 0) - dt;
    if (this.tidyT <= 0) {
      this.tidyT = 2;
      for (const c of game.civilians.list) {
        if (c.carryUntil && game.time > c.carryUntil && !c.ctrl) {
          c.fig.carry = null;
          c.fig.carryL = null;
          c.carryUntil = 0;
        }
      }
    }
    for (const n of this.notes) {
      n.t += dt;
      n.y += dt * 0.6;
      n.x += Math.sin(n.t * 3 + n.s) * dt * 0.2;
    }
    if (this.notes.length) this.notes = this.notes.filter((n) => n.t < 2.6);
    const pp = game.player;
    if (pp.coffeeT > 0) pp.coffeeT -= dt;
    // (v5: the perfume from the mall - heads turn as you pass)
    if (pp.perfumeT > 0) {
      pp.perfumeT -= dt;
      this.sniffT = (this.sniffT || 2) - dt;
      if (this.sniffT <= 0) {
        this.sniffT = 5 + Math.random() * 5;
        let best = null;
        let bd = 5;
        for (const c of game.civilians.list) {
          if (!c.alive || c.panicT > 0 || c.headless) continue;
          const d = Math.hypot(c.pos.x - pp.pos.x, c.pos.z - pp.pos.z);
          if (d < bd && d > 0.8) {
            bd = d;
            best = c;
          }
        }
        if (best) game.bubbles.say(best, pick(['Mmm, nice perfume!', 'Who smells like roses?', 'Wow, what is that scent?', 'Lovely!']));
      }
    }
  }

  // people from the street pop into the shops
  updateErrands(dt) {
    const game = this.game;
    // (v5, ROADMAP 11.18: a cart at the curb has its own: somebody passing stops for a hot dog
    // every few seconds while it is open)
    for (const a of this.active.values()) {
      if (!a.shop.cart || !a.open) continue;
      a.cartT = (a.cartT === undefined ? 1 + Math.random() * 3 : a.cartT) - dt;
      if (a.cartT > 0) continue;
      a.cartT = 5 + Math.random() * 7;
      if (a.customers >= 2) continue;
      const s = a.shop;
      let best = null;
      let bd = 20;
      for (const c of game.civilians.list) {
        if (c.scripted || c.ctrl || !c.alive || c.panicT > 0 || c.headless || c.fig.carry || c.fig.carryL || c.jog || c.dog) continue;
        const d = Math.hypot(c.pos.x - s.door[0], c.pos.z - s.door[2]);
        if (d < bd && d > 1.5) {
          bd = d;
          best = c;
        }
      }
      if (best) this.toCart(best, a);
    }
    this.errandT -= dt;
    if (this.errandT > 0 || !this.active.size) return;
    this.errandT = 1.6 + Math.random() * 2.2;
    const R = game.rhythm;
    const shops = [...this.active.values()].filter((a) => a.open && ITEM[a.shop.kind] !== undefined && (!R || R.open(a.shop.kind)));
    if (!shops.length) return;
    const a = pick(shops);
    const s = a.shop;
    if (a.customers >= 2) return;
    let best = null;
    let bd = 26;
    for (const c of game.civilians.list) {
      if (c.scripted || c.ctrl || !c.alive || c.panicT > 0 || c.headless || c.fig.carry || c.fig.carryL) continue;
      if (c.fig.parts.legL < 0.5 || c.fig.parts.legR < 0.5) continue;
      const d = Math.hypot(c.pos.x - s.door[0], c.pos.z - s.door[2]);
      if (d < bd && d > 2) {
        bd = d;
        best = c;
      }
    }
    if (best) this.sendIn(best, a);
  }

  sendIn(c, a) {
    const game = this.game;
    const s = a.shop;
    if (a.room) {
      a.admit(c);
      return;
    }
    if (s.cart) return this.toCart(c, a);
    a.customers++;
    let phase = 'go';
    let t = 0;
    const stay = 2.5 + Math.random() * 4;
    const done = () => {
      a.customers = Math.max(0, a.customers - 1);
      c.ctrl = null;
      c.faceYaw = null;
    };
    c.ctrl = (civ, dt) => {
      t += dt;
      if (!a.alive) {
        if (civ.inside) {
          civ.inside = false;
          civ.fig.setVisible(true);
        }
        done();
        return null;
      }
      if (phase === 'go') {
        if (t > 30) {
          done();
          return null;
        }
        const d = Math.hypot(civ.pos.x - s.door[0], civ.pos.z - s.door[2]);
        if (d < 0.55) {
          phase = 'in';
          t = 0;
          civ.inside = true;
          civ.fig.setVisible(false);
          a.doorT = 0.7;
          this.ding(s);
          return null;
        }
        return { x: s.door[0], z: s.door[2], speed: civ.speed };
      }
      if (phase === 'in') {
        if (t > stay) {
          phase = 'out';
          t = 0;
          civ.inside = false;
          civ.fig.setVisible(true);
          civ.pos.set(s.door[0], civ.pos.y, s.door[2]);
          civ.vel.set(0, 0, 0);
          civ.yaw = s.face;
          a.doorT = 0.7;
          this.ding(s);
          const item = ITEM[s.kind];
          if (item) {
            if (item === 'bag' || item === 'bouquet') civ.fig.carryL = item;
            else civ.fig.carry = item;
            civ.fig.bagBread = s.kind === 'bagel' || s.kind === 'deli' || s.kind === 'grocery';
            civ.carryUntil = game.time + 50;
          }
          if (s.kind === 'barber') civ.fig.look.hair = { style: pick(['short', 'buzz', 'pompadour', 'spiky', 'slick']), color: civ.fig.look.hair.color };
          if (Math.random() < 0.35) game.bubbles.say(civ, pick(['Thanks!', 'See ya!', 'Mmm!', 'Bye!']));
        }
        return null;
      }
      // out: a couple of steps away from the door, then back to the walk
      const ox = s.door[0] + s.nx * 1.8;
      const oz = s.door[2] + s.nz * 1.8;
      if (Math.hypot(civ.pos.x - ox, civ.pos.z - oz) < 0.6 || t > 4) {
        done();
        return null;
      }
      return { x: ox, z: oz, speed: civ.speed };
    };
  }

  // (v5, ROADMAP 11.18) up to a cart at the curb: in line if somebody is being served, the order
  // said, the one behind the cart making it, paid, a word, and off with it
  toCart(c, a) {
    const game = this.game;
    const s = a.shop;
    a.customers++;
    let phase = 'go';
    let t = 0;
    const done = () => {
      a.customers = Math.max(0, a.customers - 1);
      if (a.serving === c) a.serving = null;
      c.ctrl = null;
      c.faceYaw = null;
      c.fig.lookAt = null;
    };
    c.ctrl = (civ, dt) => {
      t += dt;
      if (!a.alive || !a.open) {
        done();
        return null;
      }
      const sp = s.spots;
      if (phase === 'go') {
        // (the counter if it is free, else the place in line behind it)
        const free = !a.serving || a.serving === civ || !a.serving.alive;
        const to = free ? sp.counter : sp.queue;
        if (t > 30) {
          done();
          return null;
        }
        if (Math.hypot(civ.pos.x - to.x, civ.pos.z - to.z) < 0.35) {
          civ.faceYaw = Math.atan2(s.keeper[0] - civ.pos.x, s.keeper[2] - civ.pos.z);
          if (free) {
            a.serving = civ;
            phase = 'order';
            t = 0;
            if (Math.random() < 0.6) game.bubbles.say(civ, pick(CART_ORDERS));
          }
          return null;
        }
        return { x: to.x, z: to.z, speed: civ.speed };
      }
      if (phase === 'order') {
        civ.faceYaw = Math.atan2(s.keeper[0] - civ.pos.x, s.keeper[2] - civ.pos.z);
        civ.fig.lookAt = a.keeper && a.keeper.alive ? a.keeper.fig.j.headC : null;
        if (t > 4 + Math.random() * 0.02) {
          phase = 'out';
          t = 0;
          civ.fig.lookAt = null;
          civ.fig.carry = ITEM[s.kind] || 'burger';
          civ.carryUntil = game.time + 40;
          if (a.serving === civ) a.serving = null;
          game.audio.play('till', 0.3);
          if (Math.random() < 0.4) game.bubbles.say(civ, pick(['Thanks!', 'Smells great!', 'Keep the change.', 'See you tomorrow!']));
        }
        return null;
      }
      // out: off along the sidewalk with it
      const ox = s.door[0] + s.nx * 1.4 + s.rx * 2.5;
      const oz = s.door[2] + s.nz * 1.4 + s.rz * 2.5;
      if (Math.hypot(civ.pos.x - ox, civ.pos.z - oz) < 0.6 || t > 5) {
        done();
        return null;
      }
      return { x: ox, z: oz, speed: civ.speed };
    };
  }

  ding(s) {
    const p = this.game.player.pos;
    const d = Math.hypot(s.door[0] - p.x, s.door[2] - p.z);
    if (d < 16) this.game.audio.play('bell', 1 - d / 16);
  }

  // a shopkeeper calls out to the street now and then
  updateCalls(dt) {
    const game = this.game;
    this.callT -= dt;
    if (this.callT > 0) return;
    this.callT = 3.5 + Math.random() * 4;
    const p = game.player.pos;
    let best = null;
    let bd = 20;
    for (const a of this.active.values()) {
      if (!a.open) continue;
      const d = Math.hypot(a.keeper.pos.x - p.x, a.keeper.pos.z - p.z);
      if (d < bd && d > 2.5 && Math.random() < 0.7) {
        bd = d;
        best = a;
      }
    }
    if (best && !game.dialog.open) game.bubbles.say(best.keeper, pick(CALLS[best.shop.kind] || ['Hello!']));
  }

  // ------------------------------------------------------------------ walking up to a shop
  target() {
    const game = this.game;
    const p = game.player;
    if (p.mode !== 'foot' || game.inBar) return null;
    let best = null;
    let bd = 2.4;
    let knock = false;
    for (const a of this.active.values()) {
      const s = a.shop;
      // a shop with a room: you walk in and talk to the keeper at his counter
      const dd = a.room ? 99 : Math.hypot(s.door[0] - p.pos.x, s.door[2] - p.pos.z);
      const kp = a.keeper && a.keeper.alive && (a.open || !a.room) ? a.keeper.pos : a.home;
      const dk = Math.hypot(kp.x - p.pos.x, kp.z - p.pos.z);
      if (a.room && !a.room.inside(p.pos.x, p.pos.z, 0.2, p.pos.y)) {
        // (v5: at a house's door, outside: you knock first)
        if (s.home && a.open && (!a.knocked || game.time - a.knocked > 12)) {
          const d = Math.hypot(s.door[0] - p.pos.x, s.door[2] - p.pos.z);
          if (d < 1.6 && d < bd) {
            bd = d;
            best = a;
            knock = true;
          }
        }
        continue;
      }
      const d = Math.min(dd, dk + 0.4);
      if (d < bd) {
        bd = d;
        best = a;
        knock = false;
      }
    }
    if (!best) return null;
    const info = svc(this.game, best.shop.kind);
    if (knock) return { shop: best, knock: true, label: `E — ${info.verb}` };
    return { shop: best, label: best.open ? `E — ${best.room ? best.shop.ask || info.ask || info.verb : info.verb}` : 'החנות סגורה — המוכר ברח' };
  }

  interact() {
    const t = this.target();
    if (!t || !t.shop.open) return false;
    if (t.knock) t.shop.knock();
    else t.shop.talk();
    return true;
  }

  // ------------------------------------------------------------------ drawing
  draw(fr) {
    for (const a of this.active.values()) a.draw(fr);
    for (const n of this.notes) {
      const a = Math.min(1, n.t * 3) * Math.max(0, 1 - (n.t - 1.8) / 0.8);
      const s = 0.12;
      fr.lineXYZ(n.x, n.y, n.z, n.x, n.y + s * 2.2, n.z, [0.1, 0.1, 0.14], 2.4, n.s, a, 0.01, 0);
      fr.lineXYZ(n.x - s * 0.9, n.y - s * 0.1, n.z, n.x + s * 0.1, n.y + s * 0.1, n.z, [0.1, 0.1, 0.14], 7, n.s + 1, a, 0.005, 0);
      fr.lineXYZ(n.x, n.y + s * 2.2, n.z, n.x + s * 1.1, n.y + s * 1.6, n.z, [0.1, 0.1, 0.14], 2.4, n.s + 2, a, 0.01, 0);
    }
  }

  clear() {
    for (const a of this.active.values()) a.dispose();
    this.active.clear();
    if (this.companion) this.companion.dispose();
    this.companion = null;
  }

  // the friend you drew at a stand: she walks with you (look: hers again, when drawn again; quiet:
  // she was already yours - at home, game/friend.js)
  newCompanion(x, z, look = null, quiet = false) {
    if (this.companion) this.companion.dispose();
    this.companion = new Companion(this, x, z, look);
    if (!quiet && this.game.friend) this.game.friend.adopt(this.companion);
    return this.companion;
  }
}

// ------------------------------------------------------------------ the services at the door
// verb: the prompt; who: the name in the dialog; offers: [label, sketch, effect(game, shop)]
const heal = (n, color, text) => (game) => {
  const p = game.player;
  p.hp = Math.min(p.maxHp, p.hp + n);
  p.fig.belly = Math.min(1, p.fig.belly + 0.4);
  p.fig.bellyColor = color;
  game.hud.toast(text || `יאמי! +${n} חיים`, 'good', 2.2);
};

const SERVICES = {
  hotdog: { verb: 'לקנות נקניקייה', ask: 'לקנות נקניקייה', who: 'עגלת הנקניקיות', greet: 'חרדל? קטשופ? עם הכל?', offers: [['נקניקייה בלחמנייה (+25 חיים)', 'hotdog', heal(25, [0.82, 0.42, 0.3], 'יאמי! נקניקייה. +25 חיים')]] },
  pizza: { verb: 'להיכנס לפיצרייה', ask: 'להזמין פרוסה', who: 'השף ג\'ינו', greet: 'בואנה סרה! פרוסה חמה, ישר מהתנור?', offers: [['פרוסת פיצה (+35 חיים)', 'slice', heal(35, [0.95, 0.62, 0.25], 'יאמי! פיצה. +35 חיים')]] },
  cafe: { verb: 'להזמין קפה', ask: 'להזמין קפה', who: 'הבריסטה', greet: 'אספרסו כפול? יעיר אותך עד מחר בבוקר.', offers: [['אספרסו כפול (ריצה מהירה ל-30 שניות)', 'cup', (game) => {
    const p = game.player;
    p.coffeeT = 30;
    p.fig.belly = Math.min(1, p.fig.belly + 0.3);
    p.fig.bellyColor = [0.42, 0.26, 0.14];
    game.hud.toast('קפאין! רצים מהר יותר ל-30 שניות', 'good', 2.6);
  }]] },
  grocery: { verb: 'לקנות במכולת', ask: 'לקנות משהו', who: 'המוכר במכולת', greet: 'הכל טרי, הכל צבעוני. מה תיקח?', offers: [['תפוח אדום (+15 חיים)', 'apple', heal(15, [0.85, 0.2, 0.2])]] },
  deli: { verb: 'להזמין סנדוויץ\'', ask: 'להזמין סנדוויץ\'', who: 'המוכר במעדנייה', greet: 'פסטרמה על לחם שיפון — הכי טוב בעיר.', offers: [['סנדוויץ\' פסטרמה (+40 חיים)', 'sandwich', heal(40, [0.8, 0.45, 0.4])]] },
  bagel: { verb: 'לקנות במאפייה', ask: 'לקנות בייגל', who: 'האופה', greet: 'בייגל חם, יצא עכשיו!', offers: [['בייגל (+20 חיים)', 'bagel', heal(20, [0.86, 0.66, 0.36])]] },
  icecream: { verb: 'לקנות גלידה', ask: 'לקנות גלידה', who: 'מוכרת הגלידה', greet: 'כדור אחד? שניים? שלושה?!', offers: [['גלידת תות (+15 חיים)', 'cone', (game) => {
    heal(15, [0.98, 0.66, 0.74])(game);
    game.inkwell.tipsy = Math.max(game.inkwell.tipsy, 0.25);
    game.hud.toast('מוח קפוא!!', 'info', 1.8);
  }]] },
  sushi: { verb: 'להזמין סושי', ask: 'להזמין סושי', who: 'השף', greet: 'רולים טריים. דג משורבט, אבל טרי.', offers: [['מגש סושי (+30 חיים)', 'sushi', heal(30, [0.95, 0.5, 0.4])]] },
  falafel: { verb: 'להזמין פלאפל', ask: 'להזמין פלאפל', who: 'המוכר', greet: 'פלאפל בפיתה, עם הכל?', offers: [['פלאפל בפיתה (+45 חיים)', 'pita', heal(45, [0.55, 0.38, 0.18])]] },
  shop: { verb: 'להיכנס לחנות', ask: 'לדבר עם המוכר', who: 'המוכר', greet: 'יש לנו הכל. כמעט הכל. מה צריך?', offers: [['מחק חדש לעיפרון', 'eraser', (game) => refillErasers(game)], ['חטיף (+10 חיים)', 'apple', heal(10, [0.6, 0.4, 0.25])], ['שרטוט: פלסטר ענק', 'bandage', (game) => giveBlueprint(game, 'bandage')]] },
  hardware: { verb: 'להיכנס לחנות כלי העבודה', ask: 'לדבר עם המוכר', who: 'המוכר בחנות', greet: 'מחקים, עפרונות, סרגלים, שדכנים, אקדחי דבק. מה חסר לך?', offers: [['מחק חדש (כל המחקים כמו חדשים)', 'eraser', (game) => refillErasers(game)], ['שרטוט: אקדח שדכן', 'stapler', (game) => giveBlueprint(game, 'stapler')], ['שרטוט: אקדח דבק', 'glue', (game) => giveBlueprint(game, 'glue')]] },
  pharmacy: { verb: 'להיכנס לבית המרקחת', ask: 'לדבר עם הרוקחת', who: 'הרוקחת', greet: 'נמחקת קצת? יש לי בדיוק את מה שצריך.', offers: [['תחבושת (כל החיים, וממלאת את החורים)', 'bandage', (game) => {
    const p = game.player;
    p.hp = p.maxHp;
    p.fig.holes.length = 0;
    game.hud.toast('כמו חדש!', 'good', 2);
  }], ['שרטוט: פלסטר ענק (לצייר כשצריך)', 'bandage', (game) => giveBlueprint(game, 'bandage')]] },
  laundry: { verb: 'להיכנס למכבסה', ask: 'לנקות את הבגדים', who: 'המכבסה', greet: 'כתמי צבע? דיו? מחק? הכל יורד.', offers: [['ניקוי מהיר (מוריד כתמים וחורים, +10 חיים)', 'bandage', (game) => {
    const p = game.player;
    p.fig.paintT = 0;
    p.fig.holes.length = 0;
    p.hp = Math.min(p.maxHp, p.hp + 10);
    game.hud.toast('נקי ומגוהץ', 'good', 2);
  }]] },
  phones: { verb: 'להיכנס לחנות הטלפונים', ask: 'לדבר עם המוכר', who: 'המוכר', greet: 'רוצה להתקשר למשטרה ולהגיד שזו הייתה אזעקת שווא? אני לא שאלתי כלום.', offers: [['להתקשר (מוריד כוכב משטרה אחד)', 'phone', (game) => {
    const pol = game.police;
    if (pol.level <= 0) {
      game.hud.toast('אף אחד לא מחפש אותך... בינתיים', 'info', 2.2);
      return;
    }
    pol.heat = Math.max(0, pol.heat * 0.45 - 0.3);
    pol.level = Math.max(0, pol.level - 1);
    if (pol.level === 0) pol.clear();
    else game.hud.setWanted(pol.level, pol.searching);
    game.hud.toast('"זו הייתה אזעקת שווא, שוטר." — כוכב אחד פחות', 'good', 2.6);
  }]] },
  optics: { verb: 'להיכנס לאופטיקה', ask: 'לבחור משקפיים', who: 'האופטיקאית', greet: 'רואים טוב יותר — מציירים טוב יותר. איזה משקפיים?', offers: [
    ['משקפיים עגולים', 'glasses', (game) => heroLook(game, (L) => (L.face.glasses = 'round'), 'משקפיים חדשים!')],
    ['משקפי שמש', 'sunglasses', (game) => heroLook(game, (L) => (L.face.glasses = 'shades'), 'קול.')],
    ['בלי משקפיים', null, (game) => heroLook(game, (L) => (L.face.glasses = null), 'בלי משקפיים')],
  ] },
  gym: { verb: 'להיכנס לחדר הכושר', ask: 'להתאמן', who: 'המאמן', greet: 'עשר חזרות ואתה בנאדם חדש. מוכן?', offers: [['אימון (+10 חיים מקסימליים)', 'dumbbell', (game) => {
    const p = game.player;
    if (p.maxHp >= 150) {
      game.hud.toast('כבר שרירי לגמרי. אין לאן יותר', 'info', 2);
      return;
    }
    p.maxHp += 10;
    p.hp = Math.min(p.maxHp, p.hp + 10);
    p.fig.bulk = Math.min(1.35, p.fig.bulk + 0.07);
    game.streetlife.saveHero();
    game.hud.toast(`שרירים! מקסימום חיים: ${p.maxHp}`, 'good', 2.4);
  }]] },
  music: { verb: 'לבקש שיר מהנגן', ask: 'לבקש שיר מהנגן', who: 'הנגן', greet: 'יש לך בקשה?', offers: [['לבקש שיר ולרקוד', 'note', (game, a) => a.serenade(true)], ['רק להקשיב', 'note', (game, a) => a.serenade(false)]] },
  books: { verb: 'להיכנס לחנות הספרים', ask: 'לדבר עם המוכר', who: 'המוכר בחנות הספרים', greet: 'מחפש משהו? יש לי ספר מפות ישן עם כל השלטים של העיר.', offers: [['לחפש בספר את השרטוט הבא', 'book', (game) => bookHint(game)]] },
  flowers: { verb: 'להיכנס לחנות הפרחים', ask: 'לקנות פרחים', who: 'המוכרת', greet: 'זר בשביל מישהי מיוחדת?', offers: [['זר פרחים (אולי לבר?)', 'bouquet', (game) => {
    game.player.fig.carryL = 'bouquet';
    game.hud.toast('זר ביד. אולי מישהי בבר תשמח לקבל אותו', 'good', 2.8);
  }]] },
  barber: { verb: 'להסתפר', ask: 'להסתפר', who: 'הספר', greet: 'שב, שב. מה עושים היום?', offers: [
    ['מוהוק', 'hair:mohawk', (game) => heroHair(game, 'mohawk')],
    ['אפרו', 'hair:afro', (game) => heroHair(game, 'afro')],
    ['קוצים', 'hair:spiky', (game) => heroHair(game, 'spiky')],
    ['פומפדור', 'hair:pompadour', (game) => heroHair(game, 'pompadour')],
    ['קוקו', 'hair:ponytail', (game) => heroHair(game, 'ponytail')],
    ['לגלח הכל', 'hair:none', (game) => heroHair(game, 'none')],
  ] },
};

// (ROADMAP 5.7, not with ?classic: the wardrobe, game/wardrobe.js) the boutique's shelves, the
// barber's tattoos, the hardware store's vest
const PRAISE = ['מתאים לך!', 'נראה מעולה!', 'וואו, איזה סטייל!', 'כמו מהמגזין!'];
const TATTOO_SKETCH = { anchor: 'tattooAnchor', heart: 'tattooHeart', star: 'tattooStar', pencil: 'tattooPencil' };
const SERVICES_NC = {};
const svc = (game, kind) => (!game.classic && SERVICES_NC[kind]) || SERVICES[kind];

SERVICES.tacos = { verb: 'להזמין טאקו', ask: 'להזמין טאקו', who: 'הטאקרו', greet: 'טאקו פתוח עשרים וארבע שעות! חריף או חריף מאוד?', offers: [['שלושה טאקו (+35 חיים)', 'pita', heal(35, [0.95, 0.7, 0.3], 'טאקו! +35 חיים')]] };
SERVICES.diner = { verb: 'להיכנס לדיינר', ask: 'להזמין המבורגר', who: 'המלצרית', greet: 'שב איפה שבא לך, מותק. המבורגר ומילקשייק?', offers: [['המבורגר (+45 חיים)', 'sandwich', heal(45, [0.7, 0.42, 0.25], 'המבורגר! +45 חיים')], ['מילקשייק תות (+20 חיים)', 'cup', heal(20, [0.98, 0.66, 0.74])]] };
SERVICES.juice = { verb: 'לקנות מיץ', ask: 'לקנות מיץ', who: 'המוכר', greet: 'מנגו, אננס, תות — סחוט עכשיו!', offers: [['מיץ מנגו (+20 חיים, ריצה מהירה קצת)', 'cup', (game) => {
  heal(20, [1.0, 0.7, 0.2], 'מיץ מנגו! +20 חיים')(game);
  game.player.coffeeT = Math.max(game.player.coffeeT || 0, 15);
}]] };
SERVICES.surf = { verb: 'להיכנס לחנות הגלישה', ask: 'לדבר עם המוכר', who: 'הגולש', greet: 'אחי, הגלים היום מושלמים. מה צריך?', offers: [['שרטוט: אופנוע (כמו גלשן, רק על כביש)', 'bike', (game) => giveBlueprint(game, 'bike')], ['שרטוט: בומרנג סרגל', 'boomerang', (game) => giveBlueprint(game, 'boomerang')], ['משקפי שמש', 'sunglasses', (game) => heroLook(game, (L) => (L.face.glasses = 'shades'), 'קול.')]] };
SERVICES.boutique = { verb: 'להיכנס לבוטיק', ask: 'לבחור כובע', who: 'המוכרת', greet: 'הקולקציה החדשה הגיעה! משהו לראש?', offers: [
  ['כובע מצחייה', 'hat', (game) => heroLook(game, (L) => (L.hat = { kind: 'cap', color: pick([[0.95, 0.3, 0.45], [0.2, 0.62, 0.66], [0.98, 0.78, 0.22]]) }), 'כובע חדש!')],
  ['כובע רחב שוליים', 'hat', (game) => heroLook(game, (L) => (L.hat = { kind: 'fedora', color: [0.94, 0.9, 0.82] }), 'אלגנטי!')],
  ['כומתה', 'hat', (game) => heroLook(game, (L) => (L.hat = { kind: 'beret', color: [0.62, 0.42, 0.85] }), 'כמו צייר אמיתי!')],
  ['בלי כובע', null, (game) => heroLook(game, (L) => (L.hat = null), 'בלי כובע')],
] };
SERVICES_NC.boutique = { ...SERVICES.boutique, ask: 'למדוד בגדים', greet: 'הקולקציה החדשה הגיעה! מה מודדים היום?', offers: [
  ['חולצות', 'menu', (game, a) => a.shelf('איזו חולצה?', 'top', TOPS, 'shirt')],
  ['מכנסיים', 'menu', (game, a) => a.shelf('אילו מכנסיים?', 'bottom', BOTTOMS, 'pants')],
  ['נעליים', 'menu', (game, a) => a.shelf('אילו נעליים?', 'shoes', SHOES, 'shoe')],
  ['כובעים', 'menu', (game, a) => a.shelf('איזה כובע?', 'hat', HATS, 'hat')],
  ['אביזרים', 'menu', (game, a) => a.shelf('משהו קטן לסיום?', 'acc', ACCS, 'chain')],
] };
SERVICES_NC.barber = { ...SERVICES.barber, offers: [...SERVICES.barber.offers, ['קעקוע מצויר', 'menu', (game, a) => a.shelf('איזה קעקוע לצייר לך על היד?', 'tattoo', TATTOOS, (it) => TATTOO_SKETCH[it.tattoo])], ['לצייר קעקוע משלכם', 'menu', (game, a) => drawTattoo(game, a)]] };

// (ROADMAP 9.3) a tattoo of your own: you draw it, the barber puts it on your forearm
const TATTOO_PEN = [{ css: '#29407f', c: [0.16, 0.24, 0.5], name: 'דיו של קעקועים', px: 9 }];
function drawTattoo(game, a) {
  game.sketchpad.show({
    title: 'קעקוע משלכם',
    hint: 'מה שמציירים כאן יעלה על האמה הימנית (בשרוולים קצרים רואים אותו)',
    done: 'לקעקע!',
    aspect: 2.8,
    pens: TATTOO_PEN,
    bg: (c, w, h) => {
      c.fillStyle = '#f1d3bd';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(120, 80, 60, 0.25)';
      c.lineWidth = 3;
      c.strokeRect(6, 6, w - 12, h - 12);
    },
  }, (strokes) => {
    if (!strokes) return a.talk();
    const n = game.money ? SHELF_PRICES.tattoo || 0 : 0;
    a.buy(n, 'קעקוע משלכם', () => a.serve(null, (g) => {
      ownTattoo(g, strokes);
      g.hud.toast('קעקוע חדש, משלכם!', 'good', 2.2);
    }));
  });
}
// (ROADMAP 6.6) the stationery shops: ink, lead and rubber for every weapon you drew
SERVICES_NC.books = { ...SERVICES.books, greet: 'דיו, עופרת, מחקים ושרטוטים. מה צריך?', offers: [...SERVICES.books.offers, ['מילוי דיו, עופרת ומחקים לכל הנשק', 'book', (game) => {
  const n = game.arsenal ? game.arsenal.refill() : 0;
  game.hud.toast(n ? 'כל הנשק שציירתם מלא שוב!' : 'הכול כבר מלא. בואו כשייגמר', n ? 'good' : 'info', 2.6);
}], ['דיו לעט, ועפרונות וטושים טובים יותר', 'menu', (game, a) => inkShelf(game, a)]] };

// (ROADMAP 9.4) the ink for drawing: a bottle fills the pen up; a better tool holds more ink and
// makes every drawing better
function inkShelf(game, a) {
  const I = game.ink;
  const info = svc(game, a.shop.kind);
  const choices = [];
  const full = I.level >= I.cap - 0.5;
  choices.push({ label: full ? 'בקבוק דיו (העט מלא)' : `בקבוק דיו: העט מלא שוב · ${fmt(BOTTLE)}`, fn: full ? () => inkShelf(game, a) : () => a.buy(BOTTLE, 'בקבוק דיו', () => I.refill(), () => inkShelf(game, a)) });
  const next = TOOLS[I.tool + 1];
  if (next) choices.push({ label: `${next.name}: עד ${next.cap} דיו, ו־${next.bonus}+ לכל ציור · ${fmt(next.price)}`, fn: () => a.buy(next.price, next.name, () => I.upgrade(I.tool + 1), () => inkShelf(game, a)) });
  choices.push({ label: 'משהו אחר', fn: () => a.talk() });
  game.dialog.show(info.who, `בעט שלכם: ${I.toolName}, ${Math.round(I.level)} מתוך ${I.cap} דיו.`, choices);
}
SERVICES_NC.hardware = { ...SERVICES.hardware, offers: [...SERVICES.hardware.offers, ['אפוד מגן מכריכות של מחברות', 'vest', (game) => {
  armorUp(game);
  game.hud.toast('אפוד מגן! הוא סופג את רוב המכות והיריות עד שהוא נקרע', 'good', 3.2);
}], ['שרטוטים: סולם, רמפה, גשר, מפתח', 'menu', (game, a) => toolShelf(game, a)]] };

// (ROADMAP 9.2) the blueprints of the things that solve problems on the way
const TOOL_PRICES = { ladder: 30, ramp: 40, bridge: 55, key: 70 };
function toolShelf(game, a) {
  const info = svc(game, a.shop.kind);
  const choices = [];
  for (const [id, price] of Object.entries(TOOL_PRICES)) {
    const bp = BLUEPRINTS[id];
    if (game.album.has(id)) choices.push({ label: `${bp.name} (כבר באלבום)`, fn: () => toolShelf(game, a) });
    else choices.push({ label: `שרטוט: ${bp.name} · ${fmt(price)}`, fn: () => a.buy(price, `שרטוט: ${bp.name}`, () => giveBlueprint(game, id)) });
  }
  choices.push({ label: 'משהו אחר', fn: () => a.talk() });
  game.dialog.show(info.who, 'סולם לגג, רמפה לקפיצות, גשר מעל מה שבאמצע, ומפתח שמתאים לכל מנעול.', choices);
}

SERVICES.arcade = { verb: 'להיכנס לארקייד', ask: 'לשחק במכונה', who: 'המכונה', greet: 'INSERT COIN — מכה אחת במכונה וקורה משהו...', offers: [['לשחק (אולי זוכים בשרטוט)', 'note', (game) => {
  const left = Object.keys(BLUEPRINTS).filter((id) => !game.album.has(id) && id !== 'tank' && id !== 'copter' && id !== 'minigun' && (!game.classic || (!BLUEPRINT_MORE.includes(id) && !BLUEPRINT_TOOLS.includes(id))));
  if (left.length && Math.random() < 0.5) giveBlueprint(game, left[Math.floor(Math.random() * left.length)]);
  else {
    heal(10, [0.4, 0.8, 0.95], 'כמעט! לפחות קיבלת סוכרייה. +10 חיים')(game);
  }
}]] };
SERVICES.bar = { verb: 'להיכנס לבר', ask: 'להזמין משקה', who: 'הברמן', greet: 'ערב טוב! משהו זוהר בכוס?', offers: [['קוקטייל ניאון (+20 חיים, הדף קצת מתנדנד)', 'cup', (game) => {
  heal(20, [0.85, 0.35, 0.85], 'קוקטייל ניאון! +20 חיים')(game);
  game.inkwell.tipsy = Math.min(1, game.inkwell.tipsy + 0.45);
}], ['כוס מים (+5 חיים)', 'cup', heal(5, [0.6, 0.8, 0.95], 'מים קרים. +5 חיים')]] };
SERVICES.cinema = { verb: 'להיכנס לקולנוע', ask: 'לקנות פופקורן', who: 'הקופאית', greet: 'הערב: "המחק" — סרט אימה. פופקורן?', offers: [['פופקורן (+15 חיים)', 'cup', heal(15, [0.98, 0.9, 0.6], 'פופקורן! +15 חיים')]] };

SERVICES.friends = { verb: 'לצייר לעצמך חברה', ask: 'לצייר לעצמך חברה', who: 'המוכרת בדוכן', greet: 'ציירו לעצמכם חברה! עיפרון קסם אחד — ומה שמציירים בו קם לחיים. רק לצייר בעדינות, כן?', offers: [['עיפרון קסם — לצייר חברה (היא תלך איתך)', null, (game, a) => a.heroFriend()]] };
SERVICES.lobby = { verb: 'להיכנס ללובי', ask: 'לדבר עם השומר', who: 'השומר בלובי', greet: 'ערב טוב. אתה לא גר פה, נכון? ...טוב, מה צריך?', offers: [['לשאול איפה יש שרטוט בסביבה', null, (game) => bookHint(game)], ['כוס מים (+10 חיים)', 'cup', heal(10, [0.6, 0.8, 0.95], 'מים קרים. +10 חיים')]] };

// (ROADMAP 8.1) the ATMs: in the convenience stores and the hotels' lobbies
const ATM = ['כספומט PAPERTRUST', 'menu', (game, a) => game.money && game.money.atm(() => a.talk())];
SERVICES_NC.shop = { ...SERVICES.shop, offers: [...SERVICES.shop.offers, ATM, ['שרטוט: מטריה (לגשם, ולנפילות)', 'umbrella', (game) => giveBlueprint(game, 'umbrella')]] };
SERVICES_NC.lobby = { ...SERVICES.lobby, offers: [...SERVICES.lobby.offers, ATM] };

const HERO_HAIR_COLORS = [[0.12, 0.1, 0.09], [0.42, 0.28, 0.16], [0.86, 0.72, 0.45], [0.75, 0.2, 0.22], [0.3, 0.45, 0.85], [0.55, 0.3, 0.75]];

function heroHair(game, style, color = null) {
  const L = game.player.fig.look;
  L.hair = { style, color: style === 'none' ? L.skin : color || pick(HERO_HAIR_COLORS) };
  game.streetlife.saveHero();
  game.hud.toast(style === 'none' ? 'קרחת מבריקה' : 'תספורת חדשה!', 'good', 2.2);
}

function heroLook(game, fn, text) {
  fn(game.player.fig.look);
  game.streetlife.saveHero();
  game.hud.toast(text, 'good', 2);
}

// the shopkeeper sketches a blueprint on the back of a receipt: it goes into the album
function giveBlueprint(game, id) {
  const bp = BLUEPRINTS[id];
  if (game.album.has(id)) {
    game.hud.toast(`ה${bp.name} כבר באלבום — לחצו ${game.touch ? `על ${game.drawTap}` : game.drawKey} כדי לצייר`, 'info', 2.6);
    return;
  }
  game.album.add(id);
  game.hud.toast(`שרטוט חדש באלבום: ${bp.name}! ${game.touch ? game.drawTap : game.drawKey} — לצייר אותו באוויר`, 'good', 3.4);
  game.audio.play('pageflip');
}

function refillErasers(game) {
  let n = 0;
  for (const sl of game.weapons.slots) {
    if (sl.def.uses !== undefined) {
      sl.uses = sl.def.uses;
      n++;
    }
  }
  game.hud.updateWeapon();
  game.hud.toast(n ? 'המחקים כמו חדשים' : 'מחק חדש בכיס — לפעם הבאה', 'good', 2.2);
}

function bookHint(game) {
  const p = game.player.pos;
  let best = null;
  let bd = Infinity;
  for (const b of game.world.billboards) {
    if (!b.id || game.album.has(b.id)) continue;
    const d = Math.hypot(b.x - p.x, b.z - p.z);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  if (!best) {
    game.hud.toast('כבר צילמת את כל השרטוטים בעיר!', 'good', 2.6);
    return;
  }
  const dx = best.x - p.x;
  const dz = best.z - p.z;
  const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'מזרחה' : 'מערבה') : dz > 0 ? 'דרומה' : 'צפונה';
  const blk = blockAt(best.x, best.z);
  const where = blk ? DISTRICT_NAMES[blk.type] : 'קצה העיר';
  game.hud.toast(`השרטוט של ה${BLUEPRINTS[best.id].name}: ${where}, בערך ${Math.round(bd / 10) * 10} מטר ${dir}`, 'info', 5);
}

// ------------------------------------------------------------------ the mainland's stores
// (v5, ROADMAP 11.17) the malls' stores, the food court's counters, the gourmet kitchen, the club:
// each with its keeper and what is bought there (drawn in the air and handed over)
const meal = (n, color, text) => (game) => {
  heal(n, color, text)(game);
  game.player.fig.carry = null;
};
SERVICES.fashion = { verb: 'להיכנס לחנות הבגדים', ask: 'לדבר עם המוכרת', who: 'המוכרת בחנות', greet: 'הקולקציה של העונה הגיעה! תמדדו, תא המדידה פנוי.', offers: [
  ['כובע מצחייה', 'hat', (game) => heroLook(game, (L) => (L.hat = { kind: 'cap', color: pick([[0.09, 0.09, 0.11], [0.95, 0.3, 0.45], [0.2, 0.62, 0.66]]) }), 'כובע חדש!')],
  ['כובע רחב שוליים', 'hat', (game) => heroLook(game, (L) => (L.hat = { kind: 'fedora', color: [0.94, 0.9, 0.82] }), 'אלגנטי!')],
  ['בלי כובע', null, (game) => heroLook(game, (L) => (L.hat = null), 'בלי כובע')],
] };
SERVICES_NC.fashion = { ...SERVICES.fashion, ask: 'למדוד בגדים', offers: [
  ['חולצות, מעילים וחליפות', 'menu', (game, a) => a.shelf('מה מודדים? (הכול מתאים, התא פנוי)', 'top', FASHION_TOPS, (it) => (it.top.kind === 'suit' || it.top.kind === 'blazer' || it.top.kind === 'trench' || it.top.kind === 'puffer' || it.top.kind === 'bomber' ? 'jacket' : 'shirt'))],
  ['מכנסיים', 'menu', (game, a) => a.shelf('אילו מכנסיים?', 'bottom', FASHION_BOTTOMS, 'pants')],
  ['כובעים', 'menu', (game, a) => a.shelf('משהו לראש?', 'hat', HATS, 'hat')],
] };
SERVICES.shoes = { verb: 'להיכנס לחנות הנעליים', ask: 'למדוד נעליים', who: 'המוכר בחנות הנעליים', greet: 'איזו מידה? יש לנו הכול, מסניקרס ועד נעלי ערב.', offers: [
  ['סניקרס לבנות', 'shoe', (game) => { wear(game, 'shoes', SHOES[0]); game.hud.toast('נוחות!', 'good', 2); }],
  ['נעלי עור שחורות', 'shoe', (game) => { wear(game, 'shoes', SHOES[2]); game.hud.toast('אלגנטי!', 'good', 2); }],
] };
SERVICES_NC.shoes = { ...SERVICES.shoes, offers: [['כל הקיר: לבחור זוג', 'menu', (game, a) => a.shelf('איזה זוג מודדים?', 'shoes', SHOE_WALL, 'shoe')]] };
SERVICES.electronics = { verb: 'להיכנס לחנות האלקטרוניקה', ask: 'לדבר עם המוכר', who: 'המוכר באלקטרוניקה', greet: 'המסכים הכי חדשים, הטלפונים הכי מהירים. מה מחפשים?', offers: [
  ['אוזניות אלחוטיות', 'headphones', (game) => { wear(game, 'acc', ACCS[2]); game.hud.toast('מוזיקה באוזניים!', 'good', 2.2); }],
  ['אפליקציית מפות: איפה השרטוט הקרוב', 'phone', (game) => bookHint(game)],
  ['טלפון חדש: "אזעקת שווא, שוטר" (כוכב משטרה אחד פחות)', 'phone', (game) => SERVICES.phones.offers[0][2](game)],
] };
SERVICES.jewelry = { verb: 'להיכנס לחנות התכשיטים', ask: 'לראות את התכשיטים', who: 'הצורפת', greet: 'זהב, כסף, ויהלום מצויר אחד שנוצץ באמת. במה אפשר לעזור?', offers: [
  ['שרשרת זהב', 'chain', (game) => { wear(game, 'acc', JEWELS[0]); game.hud.toast('נוצץ!', 'good', 2); }],
  ['משקפי שמש מעוצבים', 'sunglasses', (game) => heroLook(game, (L) => (L.face.glasses = 'shades'), 'קול.')],
  ['טבעת: מתנה לחברה שציירת', 'ring', (game) => {
    const fr = game.streetlife.companion;
    if (fr && fr.alive) {
      game.bubbles.say(fr.c, pick(['For me? I love it!', 'It sparkles!', 'You\'re so sweet!']));
      fr.hearts && fr.hearts(3);
      game.hud.toast('היא שמחה מאוד!', 'good', 2.6);
    } else game.hud.toast('טבעת בכיס. אולי לחברה שתציירו?', 'info', 2.6);
  }],
] };
SERVICES_NC.jewelry = { ...SERVICES.jewelry, offers: [['שרשראות, צעיפים ותיקים', 'menu', (game, a) => a.shelf('משהו קטן ויפה?', 'acc', JEWELS, 'chain')], ...SERVICES.jewelry.offers.slice(1)] };
SERVICES.toys = { verb: 'להיכנס לחנות הצעצועים', ask: 'לדבר עם המוכר', who: 'המוכר בחנות הצעצועים', greet: 'כל מה שחלמתם עליו כשהייתם בני שבע! וגם מה שתחלמו בשבעים.', offers: [
  ['דובי רך', 'teddy', (game) => { game.player.fig.carry = 'teddy'; game.hud.toast('דובי! (יורד מהיד כשמחזיקים נשק)', 'good', 2.4); }],
  ['בלון אדום', 'balloon', (game) => { game.player.fig.carryL = 'balloon'; game.hud.toast('בלון!', 'good', 2); }],
  ['שרטוט: בומרנג סרגל', 'boomerang', (game) => giveBlueprint(game, 'boomerang')],
] };
SERVICES.perfume = { verb: 'להיכנס לחנות הבשמים', ask: 'לנסות בושם', who: 'המוכרת', greet: 'ריח של גן אחרי גשם? של ים? של עיפרון חדש?', offers: [
  ['בושם פרחים (+10 חיים, וכולם מסתובבים)', 'perfume', (game) => {
    heal(10, [0.95, 0.7, 0.85], 'ריח של פרחים... +10 חיים')(game);
    game.player.perfumeT = 90;
  }],
  ['בושם ים (ריצה קלה ל-20 שניות)', 'perfume', (game) => {
    game.player.coffeeT = Math.max(game.player.coffeeT || 0, 20);
    game.player.perfumeT = 90;
    game.hud.toast('רענן כמו בריזה מהים!', 'good', 2.4);
  }],
] };
SERVICES.sports = { verb: 'להיכנס לחנות הספורט', ask: 'לדבר עם המוכר', who: 'המוכר בחנות הספורט', greet: 'מוכנים לזוז? חליפות, נעלי ריצה, ואופניים מצוירים.', offers: [
  ['נעלי ריצה צהובות (ריצה מהירה ל-40 שניות)', 'shoe', (game) => {
    wear(game, 'shoes', SHOE_WALL[SHOES.length + 1]);
    game.player.coffeeT = Math.max(game.player.coffeeT || 0, 40);
    game.hud.toast('קלים כמו נוצה!', 'good', 2.4);
  }],
  ['שרטוט: אופניים', 'bicycle', (game) => giveBlueprint(game, 'bicycle')],
  ['כדורגל (לבעוט ברחוב)', 'ball', (game) => game.hud.toast('כדור ביד! אפשר לצייר אותו גם באוויר', 'good', 2.4)],
] };
SERVICES_NC.sports = { ...SERVICES.sports, offers: [...SERVICES.sports.offers, ['חליפות ספורט וגופיות', 'menu', (game, a) => a.shelf('איזו חליפה?', 'top', SPORT_TOPS, 'shirt')]] };
SERVICES.burger = { verb: 'להזמין המבורגר', ask: 'להזמין המבורגר', who: 'הטבח בדוכן', greet: 'המבורגר על הגריל, צ\'יפס בשמן, שייק בבלנדר. מה בא לכם?', offers: [
  ['המבורגר כפול (+45 חיים)', 'burger', meal(45, [0.7, 0.42, 0.25], 'המבורגר! +45 חיים')],
  ['צ\'יפס (+15 חיים)', 'fries', meal(15, [0.98, 0.82, 0.3], 'צ\'יפס פריך! +15 חיים')],
  ['שייק וניל (+20 חיים)', 'soda', meal(20, [0.98, 0.94, 0.82], 'שייק! +20 חיים')],
] };
SERVICES.noodles = { verb: 'להזמין נודלס', ask: 'להזמין נודלס', who: 'הטבחית בווק', greet: 'נודלס מהווק, חריף או עדין? שתי דקות וזה אצלכם.', offers: [
  ['נודלס מוקפצים (+40 חיים)', 'noodles', meal(40, [0.95, 0.78, 0.4], 'נודלס! +40 חיים')],
  ['באן מאודה (+20 חיים)', 'bagel', meal(20, [0.97, 0.95, 0.9], 'רך וחם. +20 חיים')],
] };
SERVICES.gourmet = { verb: 'להיכנס למסעדה', ask: 'להזמין מהשף', who: 'השף', greet: 'ערב טוב. הערב התפריט שלי: כל מנה מצוירת ביד, ברגע, רק בשבילכם.', offers: [
  ['מנת פתיחה של השף (+30 חיים)', 'gourmet', meal(30, [0.92, 0.72, 0.42], 'מעדן. +30 חיים')],
  ['פילה בקר ברוטב יין (+60 חיים)', 'steak', meal(60, [0.5, 0.3, 0.18], 'נמס בפה. +60 חיים')],
  ['פסטה טרייה (+40 חיים)', 'pasta', meal(40, [0.95, 0.82, 0.4], 'כמו באיטליה. +40 חיים')],
  ['קינוח: עוגת תותים (+25 חיים)', 'dessert', meal(25, [0.95, 0.6, 0.7], 'מתוק! +25 חיים')],
] };
SERVICES.theatre = { verb: 'להיכנס לתיאטרון', ask: 'לקנות כרטיס', who: 'הקופאית', greet: 'ההצגה של הערב: סרט מצויר, כל פריים בעיפרון! כרטיס? פופקורן?', offers: [
  ['כרטיס להצגה (לשבת ולצפות)', null, (game, a) => a.watchShow()],
  ['פופקורן (+15 חיים)', 'cup', heal(15, [0.98, 0.9, 0.6], 'פופקורן! +15 חיים')],
] };
SERVICES.club = { verb: 'להיכנס למועדון', ask: 'לדבר עם הברמן', who: 'הברמן', greet: 'ברוכים הבאים! הדי ג\'יי בוער הלילה. משהו לשתות? (בלי אלכוהול, רק צבעים)', offers: [
  ['מוקטייל ניאון (+15 חיים)', 'mocktail', (game) => heal(15, [0.4, 0.85, 0.9], 'מוקטייל! +15 חיים')(game)],
  ['לימונדה קרה (+10 חיים)', 'lemonade', heal(10, [0.98, 0.9, 0.4], 'לימונדה. +10 חיים')],
  ['לרקוד על הרחבה', null, (game) => {
    const p = game.player;
    p.fig.dance = 1;
    game.inkwell.after(9, () => (p.fig.dance = 0));
    game.hud.toast('רוקדים! כל הרחבה איתכם', 'good', 2.4);
  }],
] };

// ------------------------------------------------------------------ (v5, ROADMAP 11.17) at home
// the houses of the mainland where people live (world/home.js): you knock, they let you in, and
// there is something to do with them - the family's dinner and its television, the painter's
// wall, grandmother's cookies and her dominoes, the villa's piano (who: the household's own name)
SERVICES.homeFamily = { verb: 'לדפוק בדלת', ask: 'לדבר עם המשפחה', who: 'המשפחה', greet: 'שלום שלום! בדיוק מתיישבים לאכול. מצטרפים?', offers: [
  ['ארוחת ערב עם המשפחה (+40 חיים)', null, (game, a) => a.homeMeal(pick(['pasta', 'pizza', 'burger', 'noodles']), 40, [0.95, 0.82, 0.4], 'ארוחה ביתית. +40 חיים')],
  ['לראות טלוויזיה על הספה', null, (game, a) => a.watchTV()],
  ['לשחק עם הילדים', null, (game, a) => a.playKids()],
] };
SERVICES.homeArtist = { verb: 'לדפוק בדלת', ask: 'לדבר עם האמן', who: 'הסטודיו', greet: 'היי! סליחה על הבלגן, יש צבע בכל מקום. רוצים לצייר משהו ביחד?', offers: [
  ['לצייר ביחד על הקיר (העט מתמלא דיו)', null, (game, a) => a.paintTogether()],
  ['ציור במתנה: שרטוט חדש לאלבום', 'flower', (game) => giftBlueprint(game)],
  ['לשים תקליט ולרקוד', null, (game, a) => a.homeDance()],
] };
SERVICES.homeGrandma = { verb: 'לדפוק בדלת', ask: 'לדבר עם סבתא', who: 'סבתא', greet: 'אוי, איזו שמחה, אורחים! שבו, שבו. אכלתם משהו היום?', offers: [
  ['עוגיות של סבתא (+30 חיים)', 'donut', meal(30, [0.86, 0.66, 0.36], 'עוגיות חמות מהתנור. +30 חיים')],
  ['משחק דומינו', null, (game, a) => a.dominoes()],
  ['לשמוע סיפור מפעם', null, (game, a) => a.story()],
] };
SERVICES.homeLux = { verb: 'לצלצל בפעמון', ask: 'לדבר עם בעלי הבית', who: 'הווילה', greet: 'ערב טוב, ברוכים הבאים לווילה. הפסנתר מכוון, המיץ קר.', offers: [
  ['לנגן בפסנתר', null, (game, a) => a.piano()],
  ['מיץ טרי מהבר (+20 חיים)', 'smoothie', meal(20, [1, 0.7, 0.3], 'מיץ טרי. +20 חיים')],
  ['להתארח בחדר האורחים (לישון עד הבוקר)', null, (game) => game.props && game.props.sleep()],
] };
const HOME_KINDS = new Set(['homeFamily', 'homeArtist', 'homeGrandma', 'homeLux']);
// who else is at home (the visitors of a house: game/streetlife.js addVisitor)
const HOME_GUESTS = {
  homeFamily: () => (Math.random() < 0.65 ? kidLook() : civilianLook({ kind: 'casual' })),
  homeGrandma: () => elderLook(Math.random() < 0.4),
  homeArtist: () => civilianLook({ kind: pick(['street', 'knit', 'denim']) }),
  homeLux: () => civilianLook({ kind: pick(['chic', 'smart']) }),
};
// grandmother's stories of the drawn city
const STORIES = [
  'כשהייתי צעירה, כל העיר הייתה דף ריק. ציירנו את הרחובות בעיפרון אחד, ומחקנו כשטעינו. והים? הוא נשפך פעם מבקבוק דיו, ומאז אף אחד לא הצליח לנגב אותו.',
  'הטיילת הייתה פעם קו ישר אחד. ואז ילד אחד צייר דקל, ואחריו עוד אחד, ועוד אחד... עד שהגיע הבוקר, והיו שם מאה דקלים.',
  'סבא צייר לי פרח כל בוקר, חמישים שנה. כל הפרחים על הקיר הזה, תסתכלו. אף אחד מהם לא נמחק.',
  'פעם ירד פה גשם של צבעי מים. כל העיר נהייתה סגולה לשבוע שלם. הכי יפה שהיה.',
  'השלט על הגבעה? שלושה חברים כתבו אותו בטוש, באמצע הלילה. בבוקר כולם כבר חשבו שהוא תמיד היה שם.',
  'פעם המחקים השתלטו על השכונה. מחקו את המכולת, את הספסל, את המדרכה. ואז כל השכנים יצאו עם עפרונות, וציירו הכול מחדש, יפה יותר.',
];
// a blueprint the album does not have yet (the painter's present)
function giftBlueprint(game) {
  const ids = Object.keys(BLUEPRINTS).filter((id) => !game.album.has(id));
  if (!ids.length) {
    game.hud.toast('כבר יש לכם את כל השרטוטים!', 'good', 2.4);
    return;
  }
  giveBlueprint(game, pick(ids));
}

// (v5, ROADMAP 11.17) what each kitchen draws for the people who order there: the dish in the air,
// then into their hands (or onto their table)
const DISH = {
  pizza: ['slice', 'pizza'], cafe: ['cup'], icecream: ['cone'], sushi: ['sushi'], falafel: ['pita'], tacos: ['taco', 'empanada'], diner: ['burger', 'dessert', 'soda'],
  juice: ['smoothie', 'lemonade'], deli: ['sandwich', 'hotdog'], bagel: ['bagel', 'donut'], burger: ['burger', 'fries', 'soda', 'hotdog'], noodles: ['noodles'],
  gourmet: ['gourmet', 'steak', 'pasta', 'dessert'], bar: ['mocktail', 'lemonade'], club: ['mocktail', 'lemonade'], cinema: ['soda'], theatre: ['soda'],
};
const ORDERS = {
  gourmet: ['The chef\'s special, please.', 'I\'ll have the filet.', 'The pasta, please!', 'Something sweet?', 'Surprise me, chef.'],
  burger: ['A double, please!', 'Fries with that!', 'Two burgers!', 'Extra cheese!'],
  noodles: ['Spicy noodles, please!', 'The usual!', 'Extra noodles!'],
  pizza: ['One slice, please!', 'Pepperoni!'],
  tacos: ['Three tacos!', 'Extra salsa!'],
  sushi: ['The salmon roll!', 'Chef\'s choice!'],
  diner: ['Burger and a shake!', 'Pie of the day!'],
  default: ['One, please!', 'That one!', 'Mmm, that looks good!'],
};
const CHEF_SAYS = ['Voilà!', 'Bon appétit!', 'Service!', 'Here you go!', 'Fresh!', 'Enjoy!'];
// (the theatre's film: drawn on its screen a frame at a time, its words under it)
const FILM = [
  ['house', 'פעם, בעיר מצוירת אחת...'],
  ['friend', '...גרה ילדה שציירה לעצמה חברים.'],
  ['dog', 'יום אחד היא ציירה כלב קטן.'],
  ['balloon', 'הכלב רצה לעוף, אז היא ציירה לו בלון.'],
  ['umbrella', 'ירד גשם - והיא ציירה מטריה.'],
  ['heart', 'והם היו חברים לתמיד.'],
  ['flower', 'הסוף.'],
];
const pickDish = (kind) => {
  const d = DISH[kind];
  return d ? d[Math.floor(Math.random() * d.length)] : null;
};
// a store's colour for its bags (its neon's)
function bagColor(css) {
  const c = new THREE.Color(css || '#ff5ad1');
  return [Math.min(1, c.r * 0.85 + 0.1), Math.min(1, c.g * 0.85 + 0.1), Math.min(1, c.b * 0.85 + 0.1)];
}

// ------------------------------------------------------------------ one open shop
// how many people sit at the tables (or wait on the bench) when you come by
const CART_ORDERS = ['One with everything!', 'Two dogs, mustard only.', 'Just ketchup, please.', 'The usual!', 'Extra onions!', 'One hot dog and a soda.'];
const SEATED = { cafe: 3, sushi: 2, pizza: 1, icecream: 1, barber: 1, books: 1, lobby: 1, diner: 3, bar: 3, juice: 1, tacos: 1, cinema: 2, burger: 2, noodles: 2, gourmet: 5, club: 3, theatre: 14, homeFamily: 3, homeGrandma: 1, homeArtist: 1, homeLux: 2 };
// the new hairdos the barber draws
const CUTS_M = ['short', 'buzz', 'pompadour', 'spiky', 'curly', 'short', 'pompadour', 'mohawk'];
const CUTS_F = ['long', 'bun', 'ponytail', 'braids', 'curly', 'beehive', 'long', 'spacebuns'];
const FUN_HAIR = [[0.86, 0.72, 0.45], [0.75, 0.2, 0.22], [0.3, 0.45, 0.85], [0.55, 0.3, 0.75], [0.25, 0.65, 0.4]];
const shuffled = (a) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

class OpenShop {
  constructor(life, shop) {
    this.life = life;
    this.game = life.game;
    this.shop = shop;
    // the room behind the door (interiors.js): the shopkeeper works in there and people come in
    this.room = shop.room && shop.room.door ? shop.room : null;
    // (a store up on a floor of the mega mall: the people it brings stand on that floor -
    // game/civilians.js spawnScripted)
    this.lift = this.room && this.room.floor > 1.5 ? this.room.floor - 0.15 : 0;
    this.alive = true;
    this.customers = 0;
    this.doorT = 0;
    this.extras = [];
    this.visitors = [];
    this.t = Math.random() * 10;
    this.cool = 0;
    const s = shop;
    const R = this.room;
    const civs = this.game.civilians;
    const k = R && R.keeper ? R.keeper : null;
    const kx = k ? k.x : s.keeper[0];
    const kz = k ? k.z : s.keeper[2];
    this.keeper = civs.spawnScripted(kx, kz, shopkeeperLook(s.kind, s.fem), this);
    this.homeYaw = k ? k.yaw : s.face;
    this.keeper.yaw = this.homeYaw;
    this.keeper.fig.carry = TOOL[s.kind] || null;
    this.home = new THREE.Vector3(kx, 0, kz);
    this.keeper.ctrl = (c, dt) => this.work(c, dt);
    if (s.kind === 'friends') {
      // the stand on the promenade: she sells magic pencils, people draw themselves friends
      this.keeper.noCollide = true;
      this.script = this.friendScene();
      this.sWait = 1 + Math.random() * 2;
    }
    if (R) {
      // behind the counter he keeps to his marks; if he runs, it is out of the door
      this.keeper.noCollide = true;
      this.keeper.exitRoom = R;
      this.keeper.exitShop = s;
      // where the customers pay: across the counter from him
      if (ITEM[s.kind]) {
        const px = kx + Math.sin(this.homeYaw) * 1.35;
        const pz = kz + Math.cos(this.homeYaw) * 1.35;
        const way = R.path(R.door.x, R.door.z, px, pz);
        const end = way[way.length - 1];
        this.paySpot = { x: end.x, z: end.z, yaw: Math.atan2(kx - end.x, kz - end.z) };
      }
      // (v5, ROADMAP 11.18: a shop laid out to the small things says where its checkout is, and
      // which way the line runs; the line itself, in the order they came to it)
      if (R.pay) this.paySpot = { x: R.pay.x, z: R.pay.z, yaw: R.pay.yaw };
      this.queueDir = R.queueDir || null;
    }
    this.queue = [];
    // a couple of people at the cafe tables out on the sidewalk
    if (s.spots.tables) {
      const n = this.game.touch ? 1 : s.spots.tables.length;
      for (let i = 0; i < n; i++) this.seat(s.spots.tables[i]);
    }
    // (v5, GTA IV round) the places you sit down in run their evening their own way
    // (game/venuelife.js): the restaurant's host, waiters and cooks and its parties at their tables;
    // the bar's barmen and the people on its stools and at its tables; the cinema's and the
    // theatre's lobby, the box office, the usher. (Not in ?classic.)
    const own = R && !this.game.classic;
    this.dining = own && R.marks && R.marks.host ? new Dining(this) : null;
    this.barLife = own && !this.dining && (s.kind === 'bar' || s.kind === 'club') ? new BarLife(this, R.seats.filter((x) => x.what === 'bar')) : null;
    if (this.barLife) {
      this.barTender = this.barLife.tender(R.keeper || { x: this.home.x, z: this.home.z, yaw: this.homeYaw });
      if (R.marks && R.marks.barman) this.barLife.spawnBarman(R.marks.barman);
      // (the club's coat check, its attendant: whoever comes in hands their coat over first)
      if (R.marks && R.marks.coats && !this.game.touch) this.barLife.spawnCoats(R.marks.coats);
    }
    this.lobby = own && (s.kind === 'cinema' || s.kind === 'theatre') && R.marks && R.marks.usher ? new LobbyLife(this) : null;
    if (R) this.populate();
    else if (s.spots.chair) this.newCustomer(true);
    // a tower's lifts: the doors slide open for whoever goes up, and now and then somebody comes
    // down and out into the street (not in ?classic)
    this.lifts = null;
    if (R && s.kind === 'lobby' && !this.game.classic) {
      // (the lift's doors: on the back wall, 1.15 m behind the place where you wait for it)
      this.lifts = R.browse.filter((b) => b.lift).map((b) => ({ x: b.x - s.nx * 1.15 - s.rx * 0.3, z: b.z - s.nz * 1.15 - s.rz * 0.3, open: 0, hold: 0, down: false }));
      this.liftT = 3 + Math.random() * 8;
    }
  }

  get open() {
    return this.alive && this.keeper && this.keeper.alive && !this.keeper.headless && this.keeper.owner === this && this.keeper.panicT <= 0;
  }

  // ------------------------------------------------------------------ people inside
  // already in the shop when you come by: at the tables, along the shelves, in the barber's chair
  populate() {
    const R = this.room;
    const kind = this.shop.kind;
    const touch = this.game.touch;
    // (v5, GTA IV round: the places with an evening of their own - game/venuelife.js)
    if (this.dining) return this.dining.populate();
    if (this.lobby) return this.lobby.populate();
    if (kind === 'barber' && R.chairs.length) this.addVisitor(null, { mode: 'chair', spot: R.chairs[0], already: true });
    const seats = shuffled(R.seats);
    // (v5, GTA IV round: a place with a kitchen fills at lunch and at dinner - twice as many at its
    // tables then, as many as it has)
    const h = this.game.rhythm ? this.game.rhythm.hour : 13;
    const meal = DISH[kind] && (SEATED[kind] || 0) < 6 && ((h > 11.8 && h < 14.5) || (h > 18.5 && h < 22));
    const nSeat = this.barLife ? 0 : Math.min(seats.length, touch ? Math.min(1, SEATED[kind] || 0) : (SEATED[kind] || 0) * (meal ? 2 : 1));
    for (let i = 0; i < nSeat; i++) {
      const v = this.addVisitor(null, { mode: 'seat', spot: seats[i], already: true });
      // (v5, GTA IV round: here before you came - some halfway through what the kitchen brought)
      if (v && DISH[kind] && kind !== 'cafe' && Math.random() < 0.6) this.plateFor(v);
    }
    if (this.barLife) this.barLife.populateRoom();
    // (a bar's own standing places - the pool table, the darts, the tall tables - are the bar's)
    const browse = shuffled(this.barLife ? R.browse.filter((b) => !b.what) : R.browse);
    // (the club's floor is full: they are dancing; a shop of the new kind is busy - v5, 11.18)
    const nb = Math.min(browse.length, kind === 'club' ? (touch ? 5 : 13) : this.wantVisitors());
    for (let i = 0; i < nb; i++) this.addVisitor(null, { mode: browse[i].lift ? 'lift' : 'browse', spot: browse[i], already: true });
    // (the one who fills the shelves, in the bigger shops)
    if (R.pay && R.staff && R.staff.length && (!touch || R.big)) this.spawnStaff();
    // the DJ at the decks
    if (kind === 'club' && R.chairs.length && !this.dj) {
      const ch = R.chairs[0];
      const L = civilianLook({ kind: 'street' });
      L.acc = (L.acc || []).filter((x) => x !== 'headphones').concat(['headphones']);
      const dj = this.game.civilians.spawnScripted(ch.x, ch.z, L, this);
      dj.noCollide = true;
      dj.yaw = ch.yaw;
      let t = Math.random() * 10;
      dj.ctrl = (civ, dt) => {
        t += dt;
        civ.pos.x = ch.x;
        civ.pos.z = ch.z;
        civ.faceYaw = ch.yaw;
        civ.fig.dance = 1;
        if (Math.sin(t * 0.7) > 0.6 && Math.random() < dt * 0.3) this.say(civ, pick(['Make some noise!', 'Hands up, NEON INK!', 'One more!', 'Are you ready?!']));
        return null;
      };
      this.dj = dj;
      this.extras.push(dj);
    }
  }

  // a free place for somebody coming in
  freeSpot() {
    const R = this.room;
    const kind = this.shop.kind;
    const used = new Set(this.visitors.map((v) => v.spot));
    const free = (list) => list.filter((p) => !used.has(p));
    if (kind === 'barber') {
      const ch = free(R.chairs.slice(0, 1));
      if (ch.length && !this.heroJob) return { spot: ch[0], mode: 'chair' };
      const se = free(R.seats);
      return se.length ? { spot: se[0], mode: 'seat' } : null;
    }
    const seats = free(R.seats);
    const browse = free(R.browse);
    if (seats.length && SEATED[kind] && (Math.random() < 0.5 || !browse.length)) return { spot: pick(seats), mode: 'seat' };
    if (browse.length) {
      const sp = pick(browse);
      return { spot: sp, mode: sp.lift ? 'lift' : 'browse' };
    }
    return null;
  }

  // somebody shopping here: c is a pedestrian walking in from the street, or null for a new
  // person already inside (o.already) or coming to the door
  addVisitor(c, o = {}) {
    const R = this.room;
    const s = this.shop;
    let spot = o.spot || null;
    let mode = o.mode || null;
    if (!spot) {
      const f = this.freeSpot();
      if (!f) return null;
      spot = f.spot;
      mode = f.mode;
    }
    const own = !c;
    if (!c) {
      const at = o.already ? spot : { x: s.door[0] + s.nx * 1.4 + s.rx * (Math.random() - 0.5) * 3, z: s.door[2] + s.nz * 1.4 + s.rz * (Math.random() - 0.5) * 3 };
      const look = HOME_GUESTS[s.kind] ? HOME_GUESTS[s.kind]() : civilianLook();
      c = this.game.civilians.spawnScripted(at.x, at.z, look, this);
      c.yaw = o.already ? spot.yaw : s.face + Math.PI;
      if (o.already) c.noCollide = true;
    }
    const v = { c, spot, mode, own, phase: o.already ? 'at' : 'in', t: 0, pts: null, reachT: 1 + Math.random() * 3 };
    v.stay = mode === 'seat' ? 25 + Math.random() * 40 : mode === 'lift' ? 6 + Math.random() * 8 : 7 + Math.random() * 9;
    // (v5, ROADMAP 11.18) shopping: one, two or three places along the shelves, a basket on the arm
    // where the shop has them, what they pick up looked at and kept or put back, then the line
    if (mode === 'browse' && R.pay) {
      v.shop = true;
      v.stops = 1 + Math.floor(Math.random() * 3);
      v.got = 0;
      v.seed = Math.random() * 10;
      v.st = 'look';
      v.stT = o.already ? Math.random() * 2.5 : 1.2 + Math.random() * 2;
      const bc = BASKETS[s.kind];
      if (bc && !c.fig.carryL && Math.random() < 0.7) {
        c.fig.carryL = 'basket';
        c.fig.basketColor = bc;
        c.fig.basketItems = [];
        if (o.already) for (let i = Math.floor(Math.random() * 3); i > 0; i--) c.fig.basketItems.push(pick(ITEM_COLS));
      }
    }
    if (o.already) {
      v.t = Math.random() * v.stay * 0.6;
      if (mode === 'seat' || mode === 'chair') c.fig.sit = 1;
    } else {
      v.pts = [{ x: s.door[0], z: s.door[2], bell: true }, { x: R.door.x, z: R.door.z, inRoom: true }, ...R.path(R.door.x, R.door.z, spot.x, spot.z)];
    }
    if (mode === 'seat' && s.kind === 'cafe') c.fig.carry = 'coffee';
    if (mode === 'seat' && s.kind === 'books') c.fig.carry = 'book';
    if (mode === 'seat' && s.kind === 'lobby') c.fig.carry = 'newspaper';
    if (mode === 'seat' && s.kind === 'theatre' && Math.random() < 0.5) c.fig.carry = 'soda';
    c.exitRoom = R;
    c.exitShop = s;
    c.ctrl = (civ, dt) => this.visit(v, dt);
    this.visitors.push(v);
    return v;
  }

  // walk a list of waypoints; null once there
  follow(v) {
    const c = v.c;
    const pts = v.pts;
    while (pts && pts.length) {
      const p = pts[0];
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if (d > (pts.length > 1 ? 0.45 : 0.14)) break;
      pts.shift();
      if (p.bell) this.life.ding(this.shop);
      if (p.inRoom !== undefined) c.noCollide = p.inRoom;
    }
    if (!pts || !pts.length) return null;
    // stuck behind something for too long: step through
    if (v.t > 30) {
      const p = pts[pts.length - 1];
      c.pos.x = p.x;
      c.pos.z = p.z;
      pts.length = 0;
      return null;
    }
    return { x: pts[0].x, z: pts[0].z, speed: c.speed };
  }

  visit(v, dt) {
    const c = v.c;
    v.t += dt;
    if (v.phase !== 'at') c.fig.sit = Math.max(0, c.fig.sit - dt * 3);
    // (v5, GTA IV round: a party at the restaurant, a moviegoer in the lobby - game/venuelife.js -
    // until they are on their way out)
    if (v.dine && v.phase !== 'out') return this.dining.visit(v, dt);
    if (v.lobbyMan && (v.phase === 'in' || v.phase === 'lob' || v.phase === 'seat')) return this.lobby.visit(v, dt);
    if (v.coat && this.barLife && v.phase === 'in') return this.barLife.coatCheck(v, dt);
    switch (v.phase) {
      case 'in':
      case 'pay-go':
      case 'out': {
        const m = this.follow(v);
        if (m) return m;
        if (v.phase === 'in') {
          v.phase = 'at';
          v.t = 0;
          if (v.mode === 'seat' || v.mode === 'chair') c.noCollide = true;
        } else if (v.phase === 'pay-go') {
          v.phase = 'pay';
          v.t = 0;
        } else {
          this.done(v);
        }
        return null;
      }
      case 'pay':
        return this.paying(v);
      // (v5, ROADMAP 11.18: on the way to the mirror or the fitting room; in the line)
      case 'in2': {
        const m = this.follow(v);
        if (m) return m;
        v.phase = 'at';
        v.t = 0;
        v.st = v.after;
        v.stT = v.after === 'mirror' ? 2.5 + Math.random() * 2 : 6 + Math.random() * 4;
        return null;
      }
      case 'queue':
        return this.queueing(v, dt);
      default:
        return this.atSpot(v, dt);
    }
  }

  atSpot(v, dt) {
    const c = v.c;
    // (at the mirror, in the fitting room: that is where they face)
    const sp = v.spot2 && (v.st === 'mirror' || v.st === 'fit') ? v.spot2 : v.spot;
    // (v5: at home, up to play with you - round you, dancing - then back to their place)
    if (v.playT > 0) {
      v.playT -= dt;
      c.fig.sit = Math.max(0, c.fig.sit - dt * 3);
      c.noCollide = false;
      if (v.playT <= 0) {
        c.fig.dance = 0;
        v.phase = 'in';
        v.pts = this.room.path(c.pos.x, c.pos.z, sp.x, sp.z);
        return null;
      }
      c.fig.dance = 1;
      const p = this.game.player.pos;
      v.ang = (v.ang === undefined ? Math.random() * 6.28 : v.ang) + dt * 1.1;
      const tx = p.x + Math.cos(v.ang) * 1.5;
      const tz = p.z + Math.sin(v.ang) * 1.5;
      if (!this.room.inside(tx, tz, -0.4)) return null;
      return { x: tx, z: tz, speed: 1.5 };
    }
    c.faceYaw = sp.yaw;
    if (v.mode === 'seat' || v.mode === 'chair') {
      c.pos.x = sp.x;
      c.pos.z = sp.z;
      c.fig.sit = Math.min(1, c.fig.sit + dt * 3);
      if (c.fig.carry === 'coffee') {
        v.sip = (v.sip === undefined ? 2 + Math.random() * 4 : v.sip) - dt;
        if (v.sip < 0) {
          c.fig.drinkT = Math.min(1, -v.sip / 1.2);
          if (v.sip < -1.2) {
            v.sip = 3 + Math.random() * 5;
            c.fig.drinkT = -1;
          }
        }
      }
      // (v5, GTA IV round: at a bar, a glass to the lips, a word with the next one)
      const bl = this.dining ? this.dining.bar : this.barLife;
      if (bl && (v.drink || c.fig.carry === 'soda')) bl.seated(v, dt);
      // (v5, GTA IV round: a plate on the table before them - the diner's, the noodle bar's, the
      // pizzeria's: they eat it, a word across the table between bites - game/venuelife.js)
      else if (v.dish) eatPlate(this, v, dt);
      // the barber decides when the one in his chair is done
      if (v.mode === 'chair') return null;
      if (v.t > v.stay) {
        if (c.fig.carry === 'soda') c.fig.carry = null;
        this.leave(v);
      }
      return null;
    }
    // (a bar's people standing: at the tall tables, the pool table, the darts, the jukebox)
    if (this.barLife && v.stand) return this.barLife.standing(v, dt);
    if (v.mode === 'lift') {
      if (v.t > v.stay && !this.lifts) {
        // ding: the lift is here, up they go
        this.life.ding(this.shop);
        this.vanish(v);
      } else if (v.t > v.stay) {
        // the lift is called; when its doors are open, in they step
        const l = v.lift || (v.lift = this.nearLift(c));
        if (!v.called) {
          v.called = true;
          l.hold = Math.max(l.hold, 3.2);
          this.life.ding(this.shop);
        }
        if (l.open > 0.75) {
          const s = this.shop;
          const tx = l.x + s.nx * 0.2;
          const tz = l.z + s.nz * 0.2;
          if (Math.hypot(c.pos.x - tx, c.pos.z - tz) < 0.3 || v.t > v.stay + 8) {
            this.vanish(v, true);
            return null;
          }
          return { x: tx, z: tz, speed: 1.1 };
        }
      }
      return null;
    }
    // (on the club's floor: they dance, a shout now and then)
    if (this.shop.kind === 'club' && !v.spot.what) {
      c.fig.dance = 1;
      if (v.stay < 25) v.stay = 25 + Math.random() * 40;
      if (Math.random() < dt * 0.02) this.say(c, pick(['Woo!', 'I love this song!', 'Yeah!', 'Dance with me!', 'Best night ever!']));
      if (v.t > v.stay) {
        c.fig.dance = 0;
        this.leave(v);
      }
      return null;
    }
    // (v5, ROADMAP 11.18: shopping, in a shop laid out to the small things)
    if (v.shop) return this.shopping(v, dt);
    // browsing: now and then a hand goes to the shelf
    const f = c.fig;
    v.reachT -= dt;
    if (v.reachT < 0 && !f.reachR) {
      f.reachR = new THREE.Vector3(c.pos.x + Math.sin(sp.yaw) * 0.5 + (Math.random() - 0.5) * 0.3, c.pos.y + 0.8 + Math.random() * 0.8, c.pos.z + Math.cos(sp.yaw) * 0.5 + (Math.random() - 0.5) * 0.3);
    }
    if (v.reachT < -0.9) {
      f.reachR = null;
      v.reachT = 1.5 + Math.random() * 3;
    }
    if (v.t > v.stay) {
      f.reachR = null;
      const busy = this.visitors.some((o) => o !== v && (o.phase === 'pay' || o.phase === 'pay-go'));
      if (this.paySpot && this.open && busy) {
        v.stay += 2;
        return null;
      }
      if (this.paySpot && this.open) {
        v.phase = 'pay-go';
        v.t = 0;
        v.pts = this.room.path(c.pos.x, c.pos.z, this.paySpot.x, this.paySpot.z);
      } else this.leave(v);
    }
    return null;
  }

  // ------------------------------------------------------------------ (v5, ROADMAP 11.18) shopping
  // how many people this shop has in it now: a shop of the new kind is busy (more of them when it is
  // big), the most when you are in it or at its window, fewer down the street; half on a phone
  wantVisitors() {
    const R = this.room;
    if (!R || this.shop.home) return 0;
    const touch = this.game.touch;
    if (!R.pay) return touch ? 1 : 2;
    const p = this.game.player.pos;
    const d = Math.hypot(this.home.x - p.x, this.home.z - p.z);
    const base = R.big ? 10 : 6;
    // (each one a whole person: the most where you can see in, a few through the windows down the
    // street)
    const k = R.inside(p.x, p.z, 0.5, p.y) ? 1 : d < 14 ? 0.8 : d < 30 ? 0.45 : 0.25;
    return Math.max(1, Math.min(R.browse.length, Math.round(base * k * (touch ? 0.5 : 1))));
  }

  // a customer at the shelves: the eyes along them, a hand out to one, the thing held up and looked
  // at, kept (into the basket) or put back; a shirt held up to the mirror, or taken into the fitting
  // room; then the next place along the shelves, or the line at the checkout
  shopping(v, dt) {
    const c = v.c;
    const f = c.fig;
    const sp = v.spot;
    const R = this.room;
    v.stT -= dt;
    const sideX = Math.cos(sp.yaw);
    const sideZ = -Math.sin(sp.yaw);
    const shelfY = (k) => R.floor + (sp.shelf && sp.shelf.length ? sp.shelf[Math.min(sp.shelf.length - 1, k)] : 1.2);
    switch (v.st) {
      case 'look': {
        const k = Math.sin(v.t * 0.8 + v.seed);
        const fx = c.pos.x + Math.sin(sp.yaw) * 0.8;
        const fz = c.pos.z + Math.cos(sp.yaw) * 0.8;
        v.look = v.look || new THREE.Vector3();
        v.look.set(fx + sideX * k * 0.75, R.floor + 1.05 + Math.sin(v.t * 0.55 + v.seed) * 0.45, fz + sideZ * k * 0.75);
        f.lookAt = v.look;
        if (v.stT <= 0) {
          v.st = 'reach';
          v.stT = 0.8;
          v.row = Math.floor(Math.random() * (sp.shelf && sp.shelf.length ? sp.shelf.length : 3));
          v.off = (Math.random() - 0.5) * 0.9;
        }
        return null;
      }
      case 'reach': {
        if (!f.reachR) f.reachR = new THREE.Vector3();
        const y = Math.min(c.pos.y + 1.95, Math.max(c.pos.y + 0.4, shelfY(v.row)));
        f.reachR.set(c.pos.x + Math.sin(sp.yaw) * 0.62 + sideX * v.off, y, c.pos.z + Math.cos(sp.yaw) * 0.62 + sideZ * v.off);
        f.lookAt = f.reachR;
        if (v.stT <= 0) {
          f.reachR = null;
          const what = sp.what || (sp.fridge ? 'soda' : 'item');
          if (what === 'garment') {
            f.carry = 'garment';
            f.itemColor = pick(CLOTH_COLS);
          } else if (what === 'soda') {
            f.carry = 'soda';
            f.sodaColor = pick(SODA_COLS);
          } else if (what === 'book') f.carry = 'book';
          else if (what === 'look' || what === 'phone') f.carry = what === 'phone' ? 'phone' : null;
          else {
            f.carry = 'item';
            f.itemColor = pick(ITEM_COLS);
          }
          v.st = 'hold';
          v.stT = 1.6 + Math.random() * 2.6;
          if (Math.random() < 0.2) this.say(c, pick(SHOP_SAYS[this.shop.kind] || SHOP_SAYS.default));
        }
        return null;
      }
      case 'hold': {
        f.lookAt = f.carry ? f.j.handR : null;
        if (v.stT > 0) return null;
        // a shirt: held up against them in the mirror; maybe tried on
        if (f.carry === 'garment' && !v.tried && R.mirrors && R.mirrors.length && Math.random() < 0.5) {
          v.tried = true;
          return this.goTo(v, R.mirrors[0], 'mirror');
        }
        if (f.carry === 'garment' && !v.fitted && R.fitting && R.fitting.length && Math.random() < 0.35) {
          v.fitted = true;
          return this.goTo(v, pick(R.fitting), 'fit');
        }
        return this.decide(v);
      }
      case 'mirror':
        f.holdUp = 1;
        f.lookAt = null;
        if (v.stT <= 0) {
          f.holdUp = 0;
          return this.decide(v, 0.7);
        }
        return null;
      case 'fit':
        if (!v.hid) {
          v.hid = true;
          c.inside = true;
          c.fig.setVisible(false);
        }
        if (v.stT <= 0) {
          c.inside = false;
          c.fig.setVisible(true);
          v.hid = false;
          return this.decide(v, 0.75);
        }
        return null;
      case 'back': {
        // putting it back where it was
        if (!f.reachR) f.reachR = new THREE.Vector3();
        f.reachR.set(c.pos.x + Math.sin(sp.yaw) * 0.62 + sideX * (v.off || 0), Math.max(c.pos.y + 0.45, shelfY(v.row || 0)), c.pos.z + Math.cos(sp.yaw) * 0.62 + sideZ * (v.off || 0));
        if (v.stT <= 0) {
          f.reachR = null;
          f.carry = null;
          return this.next(v);
        }
        return null;
      }
      default:
        return this.next(v);
    }
  }

  // keep it (into the basket, or carried to the checkout) or put it back; then on
  decide(v, keep = 0.62) {
    const f = v.c.fig;
    f.lookAt = null;
    const item = f.carry;
    if (!item) return this.next(v);
    if (Math.random() < keep) {
      v.got++;
      if (f.carryL === 'basket' && (item === 'item' || item === 'soda')) {
        (f.basketItems = f.basketItems || []).push(item === 'soda' ? f.sodaColor || SODA_COLS[0] : f.itemColor || ITEM_COLS[0]);
        f.carry = null;
      }
      return this.next(v);
    }
    // back on the shelf (if it came from there: the mirror's and the fitting room's go back too)
    if (v.st === 'mirror' || v.st === 'fit') {
      f.carry = null;
      return this.next(v);
    }
    v.st = 'back';
    v.stT = 0.7;
    return null;
  }

  // the next place along the shelves, or the line at the checkout, or out
  next(v) {
    const c = v.c;
    v.stops--;
    c.fig.lookAt = null;
    c.fig.holdUp = 0;
    if (v.stops > 0 && this.open) {
      const fsp = this.freeSpot();
      if (fsp && fsp.mode === 'browse') {
        v.spot = fsp.spot;
        v.spot2 = null;
        v.phase = 'in';
        v.t = 0;
        v.pts = this.room.path(c.pos.x, c.pos.z, fsp.spot.x, fsp.spot.z);
        v.st = 'look';
        v.stT = 1.2 + Math.random() * 2.5;
        return null;
      }
    }
    if (v.got > 0 && this.paySpot && this.open) return this.toQueue(v);
    this.leave(v);
    return null;
  }

  // across the shop to the mirror or the fitting room (st: what they do there)
  goTo(v, spot, st) {
    const c = v.c;
    v.after = st;
    v.spot2 = spot;
    v.phase = 'in2';
    v.t = 0;
    v.pts = this.room.path(c.pos.x, c.pos.z, spot.x, spot.z);
    return null;
  }

  toQueue(v) {
    v.phase = 'queue';
    v.t = 0;
    v.qi = -1;
    v.c.fig.lookAt = null;
    if (!this.queue.includes(v)) this.queue.push(v);
    return null;
  }

  // in the line: a step forward each time the one at the till is done; the first one up when it is
  // free
  queueing(v) {
    const c = v.c;
    const i = this.queue.indexOf(v);
    if (i < 0 || !this.paySpot) {
      this.leave(v);
      return null;
    }
    const ps = this.paySpot;
    if (i === 0 && (!this.payer || this.payer === v || !this.payer.c.alive || this.payer.phase === 'out')) {
      this.queue.shift();
      this.payer = v;
      v.phase = 'pay-go';
      v.t = 0;
      v.pts = this.room.path(c.pos.x, c.pos.z, ps.x, ps.z);
      return null;
    }
    const qd = this.queueDir || [-Math.sin(ps.yaw), -Math.cos(ps.yaw)];
    const gap = 0.8;
    const tx = ps.x + qd[0] * gap * (i + 1);
    const tz = ps.z + qd[1] * gap * (i + 1);
    if (v.qi !== i) {
      v.qi = i;
      v.pts = this.room.path(c.pos.x, c.pos.z, tx, tz);
      v.t = 0;
    }
    const m = this.follow(v);
    if (m) return m;
    // waiting: facing the till, a look at the phone now and then
    c.faceYaw = Math.atan2(ps.x - c.pos.x, ps.z - c.pos.z);
    if (!c.fig.carry && Math.random() < 0.002) c.fig.carry = 'phone';
    return null;
  }

  // the one who fills the shelves: from one place to the next with a box of stock, a while at each
  spawnStaff() {
    const R = this.room;
    const s = this.shop;
    const stops = (R.staff && R.staff.length ? R.staff : R.browse).concat(R.browse.slice(0, 4));
    const first = stops[0];
    const c = this.game.civilians.spawnScripted(first.x, first.z, shopkeeperLook(s.kind, Math.random() < 0.5), this);
    c.noCollide = true;
    c.exitRoom = R;
    c.exitShop = s;
    c.fig.carry = 'box';
    let i = 0;
    let t = 2 + Math.random() * 4;
    let pts = null;
    let row = 0;
    c.ctrl = (civ, dt) => {
      if (!this.alive) return null;
      const sp = stops[i % stops.length];
      if (pts && pts.length) {
        const m = this.follow({ c: civ, pts, t: 0 });
        if (m) return { ...m, speed: 1.0 };
        pts = null;
      }
      t -= dt;
      civ.faceYaw = sp.yaw;
      const fig = civ.fig;
      // a hand to the shelf, now high, now low; the box under the other arm
      if (Math.sin(t * 2.1) > 0.2) {
        fig.carry = null;
        if (!fig.reachR) fig.reachR = new THREE.Vector3();
        const y = R.floor + (sp.shelf && sp.shelf.length ? sp.shelf[row % sp.shelf.length] : 1.2);
        fig.reachR.set(civ.pos.x + Math.sin(sp.yaw) * 0.6 + Math.cos(sp.yaw) * Math.sin(t) * 0.3, Math.min(civ.pos.y + 1.9, Math.max(civ.pos.y + 0.45, y)), civ.pos.z + Math.cos(sp.yaw) * 0.6 - Math.sin(sp.yaw) * Math.sin(t) * 0.3);
      } else {
        fig.reachR = null;
        fig.carry = 'box';
        row++;
      }
      if (t <= 0) {
        fig.reachR = null;
        fig.carry = 'box';
        i++;
        t = 5 + Math.random() * 6;
        const nx = stops[i % stops.length];
        pts = R.path(civ.pos.x, civ.pos.z, nx.x, nx.z);
      }
      return null;
    };
    this.extras.push(c);
    this.staffer = c;
  }

  paying(v) {
    const c = v.c;
    c.faceYaw = this.paySpot.yaw;
    this.payer = v;
    // (v5, ROADMAP 11.18: what they chose onto the counter, the card to the reader, the bag)
    if (v.shop) {
      const f = c.fig;
      if (v.t < 0.5 && (f.carry === 'item' || f.carry === 'garment' || f.carry === 'phone')) f.carry = null;
      if (v.t > 1.0 && v.t < 1.75 && !v.paid) {
        f.carry = 'card';
        f.cardColor = f.cardColor || pick([[0.3, 0.45, 0.85], [0.85, 0.7, 0.3], [0.2, 0.2, 0.24], [0.85, 0.3, 0.35]]);
      } else if (f.carry === 'card') f.carry = null;
      if (v.t > 1.75 && f.carryL === 'basket') {
        f.carryL = null;
        f.basketItems = [];
      }
    }
    const s = this.shop;
    // (v5, ROADMAP 11.17) at a food counter the cook draws what they ordered, there in the air
    // between them, and hands it over; near you, so that you see it
    if (!v.dishAsk && v.t > 0.4 && DISH[s.kind] && this.open && !this.drawing && !this.heroJob) {
      const p = this.game.player.pos;
      v.dishAsk = true;
      if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 26) {
        this.say(c, pick(ORDERS[s.kind] || ORDERS.default));
        v.dishT = 0.9;
      }
    }
    if (v.dishT !== undefined) {
      if (!v.dishDrawn && v.t > 0.4 + v.dishT && this.open && this.keeper && this.keeper.alive) {
        v.dishDrawn = true;
        const k = this.keeper;
        const at = _w.copy(k.pos).lerp(c.pos, 0.5).clone();
        at.y = c.pos.y + 1.45;
        this.game.airsketch.draw({ shape: pickDish(s.kind), at, size: 0.5, author: k, target: c.fig.j.handR.clone(), targetScale: 0.22, dur: 1.2, onPlop: () => (v.dishGot = true) });
        v.t = Math.min(v.t, 0.5);
      }
      if (!v.dishGot && v.t < 6) return null;
    }
    if (v.t > 1.8 && !v.paid) {
      v.paid = true;
      const item = ITEM[s.kind];
      if (item) {
        if (item === 'bag' || item === 'bouquet' || item === 'shopBag') c.fig.carryL = item;
        else c.fig.carry = item;
        if (item === 'shopBag') c.fig.shopBagColor = bagColor(s.signCol);
        c.fig.bagBread = s.kind === 'bagel' || s.kind === 'deli' || s.kind === 'grocery';
        c.carryUntil = this.game.time + 50;
      }
      if (Math.random() < 0.6) this.say(this.keeper, pick(['Thank you!', 'Have a nice day!', 'Come again!', 'Enjoy!', 'Next, please!']));
    }
    if (v.t > 2.6) {
      if (this.payer === v) this.payer = null;
      if (Math.random() < 0.3) this.say(c, pick(['Thanks!', 'See ya!', 'Mmm!', 'Bye!']));
      // (a moviegoer with a soda: on to the usher, not out - game/venuelife.js)
      if (v.lobbyMan && this.lobby) this.lobby.afterPay(v);
      else this.leave(v);
    }
    return null;
  }

  // up from the seat, round the furniture, out of the door and back onto the sidewalk
  leave(v) {
    const c = v.c;
    const R = this.room;
    const s = this.shop;
    this.clearDish(v);
    this.unshop(v);
    c.fig.dance = 0;
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.drinkT = -1;
    v.phase = 'out';
    v.t = 0;
    const side = (Math.random() - 0.5) * 2.4;
    // (v5, ROADMAP 11.2ג: out past the forecourt, if the door stands back from the sidewalk)
    const out = 1.7 + (s.yard || 0);
    v.pts = [...R.path(c.pos.x, c.pos.z, R.door.x, R.door.z), { x: s.door[0], z: s.door[2], bell: true, inRoom: false }, { x: s.door[0] + s.nx * out + s.rx * side, z: s.door[2] + s.nz * out + s.rz * side }];
    if (this.payer === v) this.payer = null;
  }

  // (v5, ROADMAP 11.18) out of the line, out of the fitting room, the basket left by the door
  unshop(v) {
    const c = v.c;
    const qi = this.queue.indexOf(v);
    if (qi >= 0) this.queue.splice(qi, 1);
    if (!v.shop) return;
    if (v.hid) {
      c.inside = false;
      c.fig.setVisible(true);
      v.hid = false;
    }
    const f = c.fig;
    f.holdUp = 0;
    f.lookAt = null;
    f.reachR = null;
    if (f.carry === 'item' || f.carry === 'card' || f.carry === 'garment' || f.carry === 'box') f.carry = null;
    if (f.carryL === 'basket') {
      f.carryL = null;
      f.basketItems = [];
    }
  }

  // out on the sidewalk: an ordinary pedestrian again
  done(v) {
    const c = v.c;
    const i = this.visitors.indexOf(v);
    if (i >= 0) this.visitors.splice(i, 1);
    c.exitRoom = null;
    c.exitShop = null;
    if (v.own) this.game.civilians.release(c);
    else {
      c.ctrl = null;
      c.faceYaw = null;
      c.noCollide = false;
      c.fig.sit = 0;
      this.customers = Math.max(0, this.customers - 1);
    }
    // (down from the lift: one of the street's own from now on, on along this sidewalk)
    if (v.street) {
      c.scripted = false;
      this.game.civilians.rejoin(c);
    }
  }

  // into the lift (or simply away; quiet: through the lift's open doors)
  vanish(v, quiet = false) {
    const i = this.visitors.indexOf(v);
    if (i >= 0) this.visitors.splice(i, 1);
    if (!v.own) this.customers = Math.max(0, this.customers - 1);
    if (!quiet) this.game.fx.crumbs(v.c.pos.x, v.c.pos.y + 1, v.c.pos.z, 4, 0.6);
    this.game.civilians.remove(v.c);
  }

  // a visitor scared off (or rubbed out): let them go (they find their own way out of the door)
  drop(v) {
    const i = this.visitors.indexOf(v);
    if (i >= 0) this.visitors.splice(i, 1);
    this.clearDish(v);
    this.unshop(v);
    if (this.payer === v) this.payer = null;
    const c = v.c;
    if (c.owner === this) this.game.civilians.release(c);
    else if (c.ctrl) {
      c.ctrl = null;
      c.faceYaw = null;
      c.noCollide = false;
      c.fig.sit = 0;
    }
    if (!v.own) this.customers = Math.max(0, this.customers - 1);
    if (this.npcJob && this.npcJob.v === v) this.npcJob = null;
  }

  // a pedestrian popping in from the street
  admit(c) {
    if (!this.room) return false;
    // (v5, GTA IV round: to the host's stand, or into the lobby's way - game/venuelife.js)
    if (this.dining || this.lobby) {
      const ok = this.dining ? this.dining.admit(c) : this.lobby.admit(c);
      if (ok) this.customers++;
      return ok;
    }
    const v = this.addVisitor(c);
    if (!v) return false;
    this.customers++;
    return true;
  }

  say(c, text) {
    if (!c || !c.alive) return;
    const p = this.game.player.pos;
    if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 26) this.game.bubbles.say(c, text);
  }

  sound(name, vol, range = 14) {
    const p = this.game.player.pos;
    const d = Math.hypot(this.home.x - p.x, this.home.z - p.z);
    if (d < range) this.game.audio.play(name, vol * (1 - d / range));
  }

  seat(tb) {
    const s = this.shop;
    const side = Math.random() < 0.5 ? 1 : -1;
    const x = tb.x + s.rx * side * 0.72;
    const z = tb.z + s.rz * side * 0.72;
    const c = this.game.civilians.spawnScripted(x, z, civilianLook(), this);
    c.noCollide = true;
    c.fig.carry = 'coffee';
    const yaw = Math.atan2(-s.rx * side, -s.rz * side);
    c.yaw = yaw;
    let sip = 2 + Math.random() * 4;
    c.ctrl = (civ, dt) => {
      civ.fig.sit = Math.min(1, civ.fig.sit + dt * 3);
      civ.faceYaw = yaw;
      civ.pos.x = x;
      civ.pos.z = z;
      civ.baseY = this.lift || 0;
      sip -= dt;
      if (sip < 0) {
        civ.fig.drinkT = Math.min(1, -sip / 1.2);
        if (sip < -1.2) {
          sip = 3 + Math.random() * 5;
          civ.fig.drinkT = -1;
        }
      }
      return null;
    };
    this.extras.push(c);
  }

  // the barber's next customer walks up and sits down (a barber on the sidewalk)
  newCustomer(already = false) {
    const s = this.shop;
    const ch = s.spots.chair;
    const look = civilianLook();
    let x = ch.x;
    let z = ch.z;
    if (!already) {
      x += s.rx * 9;
      z += s.rz * 9;
    }
    const c = this.game.civilians.spawnScripted(x, z, look, this);
    c.noCollide = true;
    this.chairGuy = c;
    let phase = already ? 'sit' : 'walk';
    c.ctrl = (civ, dt) => {
      if (phase === 'walk') {
        if (Math.hypot(civ.pos.x - ch.x, civ.pos.z - ch.z) < 0.35) phase = 'sit';
        return { x: ch.x, z: ch.z, speed: 1.3 };
      }
      civ.pos.x = ch.x;
      civ.pos.z = ch.z;
      civ.faceYaw = ch.yaw;
      civ.fig.sit = Math.min(1, civ.fig.sit + dt * 3);
      return null;
    };
    this.cutT = 9 + Math.random() * 6;
  }

  // ------------------------------------------------------------------ the shopkeeper's day
  work(c, dt) {
    const s = this.shop;
    const fig = c.fig;
    this.t += dt;
    // cutting the hero's hair comes before anything else
    if (this.heroJob) return this.barberInside(c, dt);
    if (this.talking) {
      c.faceYaw = Math.atan2(this.game.player.pos.x - c.pos.x, this.game.player.pos.z - c.pos.z);
      fig.lookAt = this.game.player.fig.j.headC;
      if (!this.game.dialog.open && !this.drawing) {
        this.talking = false;
        fig.lookAt = null;
      }
      return this.room ? { x: c.pos.x, z: c.pos.z, speed: 0 } : null;
    }
    fig.lookAt = null;
    if (s.kind === 'friends') return this.vendor(c, dt);
    if (s.cart) return this.cartWork(c, dt);
    if (this.room) return this.workInside(c, dt);
    switch (s.kind) {
      case 'barber':
        return this.barber(c, dt);
      case 'cafe':
        return this.waiter(c, dt);
      case 'hardware':
      case 'shop':
        return this.sweep(c, dt);
      case 'music':
        c.faceYaw = s.face;
        this.strum(c, dt);
        return null;
      default:
        // idle about the door: look out at the street, now and then a few steps
        c.faceYaw = s.face + Math.sin(this.t * 0.4) * 0.6;
        if (Math.sin(this.t * 0.23) > 0.85) {
          const k = Math.sin(this.t * 0.9);
          return { x: this.home.x + s.rx * k * 1.2, z: this.home.z + s.rz * k * 1.2, speed: 0.9 };
        }
        return { x: this.home.x, z: this.home.z, speed: 1 };
    }
  }

  strum(c, dt) {
    if (Math.floor(this.t * 1.6) !== Math.floor((this.t - dt) * 1.6)) {
      const j = c.fig.j.handR;
      this.life.notes.push({ x: j.x + (Math.random() - 0.5) * 0.3, y: j.y + 0.3, z: j.z, t: 0, s: Math.random() * 100 });
      const p = this.game.player.pos;
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if (d < 14 && Math.random() < 0.5) this.game.audio.play('strum', 0.8 * (1 - d / 14));
    }
  }

  // inside the shop: behind the counter, at the barber's chair, between the cafe tables
  workInside(c, dt) {
    const s = this.shop;
    const fig = c.fig;
    if (s.kind === 'barber') return this.barberInside(c, dt);
    if (s.home) return this.residentLife(c, dt);
    if (s.kind === 'cafe' && this.room.seats.length >= 2) return this.waiterInside(c, dt);
    // (v5, GTA IV round: the chef at the pass; the barman behind the bar - game/venuelife.js)
    if (this.dining) return this.dining.chef(c, dt);
    if (this.barLife) return this.barLife.barman(this.barTender, c, dt);
    // (v5) a kitchen with tables: now and then a plate drawn for one of them, flown to the table
    if (DISH[s.kind] && this.room.seats.length && s.kind !== 'cafe') {
      const m = this.serveTables(c, dt);
      if (m) return m;
    }
    if (s.kind === 'music') {
      c.faceYaw = this.homeYaw;
      this.strum(c, dt);
      return { x: this.home.x, z: this.home.z, speed: 0.8 };
    }
    // a customer at the till: he turns to them
    const pv = this.payer;
    if (pv && pv.phase === 'pay' && pv.c.alive) {
      fig.reachR = null;
      c.faceYaw = Math.atan2(pv.c.pos.x - c.pos.x, pv.c.pos.z - c.pos.z);
      fig.lookAt = pv.c.fig.j.headC;
      // (v5, ROADMAP 11.18: the things passed over the scanner, a beep each)
      if (this.room.pay && pv.t < 1.6) {
        if (!fig.reachR) fig.reachR = new THREE.Vector3();
        const k = Math.sin(this.t * 7);
        const fy = c.faceYaw;
        fig.reachR.set(c.pos.x + Math.sin(fy) * 0.5 + Math.cos(fy) * k * 0.25, c.pos.y + 1.0, c.pos.z + Math.cos(fy) * 0.5 - Math.sin(fy) * k * 0.25);
        fig.lookAt = fig.reachR;
        if (Math.random() < dt * 2.2) this.sound('beep', 0.6, 12);
      }
      if (pv.t > 1.7 && pv.t < 1.75 + dt) this.sound('till', 0.4, 12);
      return { x: this.home.x, z: this.home.z, speed: 0.8 };
    }
    // tidying the shelf behind, a look round the shop, a step along the counter
    const k = Math.sin(this.t * 0.21 + s.id * 1.3);
    const fx = Math.sin(this.homeYaw);
    const fz = Math.cos(this.homeYaw);
    if (k > 0.72) {
      c.faceYaw = this.homeYaw + Math.PI;
      if (!fig.reachR) fig.reachR = new THREE.Vector3();
      fig.reachR.set(c.pos.x - fx * 0.5 + Math.sin(this.t * 1.7) * 0.15, c.pos.y + 1.15 + Math.sin(this.t * 1.1) * 0.25, c.pos.z - fz * 0.5 + Math.cos(this.t * 1.7) * 0.15);
    } else {
      fig.reachR = null;
      c.faceYaw = this.homeYaw + Math.sin(this.t * 0.37) * 0.45;
    }
    const step = Math.sin(this.t * 0.13 + 1.7) > 0.55 ? Math.sin(this.t * 0.5) * 0.35 : 0;
    return { x: this.home.x - fz * step, z: this.home.z + fx * step, speed: 0.6 };
  }

  // (v5, ROADMAP 11.17) the cook draws a plate for somebody at a table: they ask, the plate is
  // drawn in the air over the counter, it flies to their table and stays there (drawn) while they
  // eat; the gourmet chef does it more often, and with a flourish
  serveTables(c, dt) {
    const s = this.shop;
    const gourmet = s.kind === 'gourmet';
    this.tableT = (this.tableT === undefined ? 3 + Math.random() * 4 : this.tableT) - dt;
    const cur = this.tableJob;
    if (cur) {
      const v = cur.v;
      c.faceYaw = Math.atan2(v.c.pos.x - c.pos.x, v.c.pos.z - c.pos.z);
      c.fig.lookAt = cur.at;
      if (cur.done || this.game.time > cur.until) this.tableJob = null;
      return { x: this.home.x, z: this.home.z, speed: 0.6 };
    }
    if (this.tableT > 0 || this.drawing || this.heroJob || this.payer) return null;
    this.tableT = (gourmet ? 6 : 11) + Math.random() * (gourmet ? 6 : 10);
    const p = this.game.player.pos;
    if (Math.hypot(this.home.x - p.x, this.home.z - p.z) > 30) return null;
    const waiting = this.visitors.filter((v) => v.mode === 'seat' && v.phase === 'at' && !v.dish && v.c.alive);
    if (!waiting.length) return null;
    const v = pick(waiting);
    const sp = v.spot;
    // the table in front of the seat
    const tx = sp.x + Math.sin(sp.yaw) * 0.42;
    const tz = sp.z + Math.cos(sp.yaw) * 0.42;
    const floor = this.room.floor;
    this.say(v.c, pick(ORDERS[s.kind] || ORDERS.default));
    const at = new THREE.Vector3(c.pos.x + Math.sin(this.homeYaw) * 0.7, floor + 1.75, c.pos.z + Math.cos(this.homeYaw) * 0.7);
    const job = { v, at, done: false, until: this.game.time + 9 };
    this.tableJob = job;
    const shape = pickDish(s.kind);
    this.game.inkwell.after(1.0, () => {
      if (!this.alive || !this.open || this.tableJob !== job) return;
      this.game.airsketch.draw({
        shape, at, size: gourmet ? 0.62 : 0.5, author: c, target: new THREE.Vector3(tx, floor + 0.98, tz), targetScale: 0.62, dur: gourmet ? 2.0 : 1.3, hold: gourmet ? 0.6 : 0.35, width: gourmet ? 3.4 : 3.2,
        onPlop: () => {
          job.done = true;
          if (!this.alive || !v.c.alive || v.phase !== 'at') return;
          // (the plate stays on the table, drawn, while they eat)
          v.dish = this.game.airsketch.draw({ shape, at: new THREE.Vector3(tx, floor + 0.98, tz), size: 0.31, keep: true, dur: 0.05 });
          v.dishShape = shape;
          v.stay = Math.max(v.stay, v.t + 14 + Math.random() * 12);
          if (Math.random() < 0.7) this.say(c, pick(CHEF_SAYS));
          if (Math.random() < 0.5) this.game.inkwell.after(1.2, () => this.say(v.c, pick(['Mmm!', 'Delicious!', 'Wow, thank you!', 'Magnifique!'])));
        },
      });
    });
    return { x: this.home.x, z: this.home.z, speed: 0.6 };
  }

  // (v5, GTA IV round) a plate already on the table before somebody who sat down before you came:
  // drawn there, kept while they eat (only near you, where it is seen)
  plateFor(v) {
    const s = this.shop;
    const p = this.game.player.pos;
    if (v.dish || Math.hypot(this.home.x - p.x, this.home.z - p.z) > 30) return;
    const sp = v.spot;
    const shape = pickDish(s.kind);
    v.dish = this.game.airsketch.draw({ shape, at: new THREE.Vector3(sp.x + Math.sin(sp.yaw) * 0.42, this.room.floor + 0.98, sp.z + Math.cos(sp.yaw) * 0.42), size: 0.31, keep: true, dur: 0.05 });
    v.dishShape = shape;
    v.stay = Math.max(v.stay, v.t + 14 + Math.random() * 12);
  }

  clearDish(v) {
    if (v.dish) {
      this.game.airsketch.erase(v.dish);
      v.dish = null;
    }
  }

  // the cafe: from the counter to a table and back
  waiterInside(c, dt) {
    const R = this.room;
    const s = this.shop;
    if (!this.wStops) {
      // in front of each table (the seats come in pairs, either side of it)
      this.wStops = [];
      for (let i = 0; i + 1 < R.seats.length; i += 2) {
        const a = R.seats[i];
        const b = R.seats[i + 1];
        const x = (a.x + b.x) / 2;
        const z = (a.z + b.z) / 2;
        this.wStops.push({ x: x + s.nx * 0.75, z: z + s.nz * 0.75, yaw: Math.atan2(-s.nx, -s.nz) });
      }
      this.wI = -1;
      this.wPts = [];
      this.wT = 3;
    }
    const w = { c, pts: this.wPts, t: 0 };
    const m = this.follow(w);
    if (m) return { ...m, speed: 1.1 };
    this.wT -= dt;
    const stop = this.wI >= 0 ? this.wStops[this.wI] : { x: this.home.x, z: this.home.z, yaw: this.homeYaw };
    c.faceYaw = stop.yaw;
    if (this.wT <= 0 && this.wStops.length) {
      // next: back to the counter, or out to the next table
      if (this.wI >= 0) this.wI = -1;
      else this.wI = Math.floor(Math.random() * this.wStops.length);
      const to = this.wI >= 0 ? this.wStops[this.wI] : { x: this.home.x, z: this.home.z };
      this.wPts = R.path(c.pos.x, c.pos.z, to.x, to.z);
      this.wT = this.wI >= 0 ? 3 : 4 + Math.random() * 4;
      if (this.wI >= 0 && Math.random() < 0.4) this.say(c, pick(['Here you go!', 'Another one?', 'Enjoy!']));
    }
    return null;
  }

  // the barber: rubs out the old hair, then draws the new one
  barberInside(c, dt) {
    const R = this.room;
    const fig = c.fig;
    let job = this.heroJob;
    if (!job) {
      // the next one from the bench takes the chair
      const chair = R.chairs[0];
      if (chair && !this.visitors.some((v) => v.spot === chair)) {
        const w = this.visitors.find((v) => v.mode === 'seat' && v.phase === 'at');
        if (w) {
          w.mode = 'chair';
          w.spot = chair;
          w.phase = 'in';
          w.t = 0;
          w.pts = R.path(w.c.pos.x, w.c.pos.z, chair.x, chair.z);
        }
      }
      const v = this.visitors.find((o) => o.mode === 'chair' && o.phase === 'at' && o.c.fig.sit > 0.8);
      if (!v) {
        this.npcJob = null;
        fig.reachR = null;
        fig.lookAt = null;
        c.faceYaw = this.homeYaw;
        return { x: this.home.x, z: this.home.z, speed: 0.9 };
      }
      if (!this.npcJob || this.npcJob.v !== v) {
        const L = v.c.fig.look;
        const style = pick(L.fem ? CUTS_F : CUTS_M);
        const keep = L.hair && L.hair.style !== 'none' ? L.hair.color : [0.15, 0.12, 0.1];
        this.npcJob = { v, who: v.c, npc: true, chair: v.spot, look: L, phase: 'start', t: 0, side: Math.random() < 0.5 ? 1 : -1, style, color: Math.random() < 0.25 ? pick(FUN_HAIR) : keep, head: () => v.c.fig.j.headC };
      }
      job = this.npcJob;
    }
    const ch = job.chair;
    const fx = Math.sin(ch.yaw);
    const fz = Math.cos(ch.yaw);
    const sx = ch.x + fz * job.side * 0.62 - fx * 0.15;
    const sz = ch.z - fx * job.side * 0.62 - fz * 0.15;
    const head = job.head();
    job.t += dt;
    c.faceYaw = Math.atan2(head.x - c.pos.x, head.z - c.pos.z);
    fig.lookAt = head;
    const there = Math.hypot(c.pos.x - sx, c.pos.z - sz) < 0.3;
    switch (job.phase) {
      case 'start':
        if (job.t > 1.0 && there) {
          job.phase = 'erase';
          job.t = 0;
          fig.carry = 'eraser';
          if (job.npc && Math.random() < 0.6) this.say(job.who, pick(['Something new, please!', 'Surprise me.', 'Not too short!', 'The usual.']));
        }
        break;
      case 'erase': {
        // the old hair rubbed out, crumbs everywhere
        if (!fig.reachR) fig.reachR = new THREE.Vector3();
        fig.reachR.set(head.x + Math.sin(job.t * 9) * 0.1, head.y + 0.16 + Math.sin(job.t * 13) * 0.04, head.z + Math.cos(job.t * 9) * 0.1);
        if (Math.floor(job.t * 6) !== Math.floor((job.t - dt) * 6)) this.game.fx.crumbs(head.x, head.y + 0.2, head.z, 2, 0.9);
        if (Math.floor(job.t * 2.5) !== Math.floor((job.t - dt) * 2.5)) this.sound('erase', 0.35, 12);
        if (job.t > 2.2) {
          job.look.hair = { style: 'none', color: job.look.skin };
          if (job.hatOff) job.look.hat = null;
          this.game.fx.crumbs(head.x, head.y + 0.2, head.z, 10, 1.6);
          fig.reachR = null;
          fig.carry = TOOL.barber;
          job.t = 0;
          if (job.npc && Math.random() < 0.4) this.say(job.who, pick(['Hey! My hair!', 'Uh... is that normal?', 'Feels breezy.']));
          if (job.style === 'none') {
            job.phase = 'admire';
            if (job.onDone) job.onDone();
            break;
          }
          job.phase = 'draw';
          const style = job.style;
          const color = job.color;
          this.game.airsketch.draw({
            shape: HAIR_SKETCH[style](color),
            at: head.clone().setY(head.y + 0.06),
            size: 0.58,
            author: c,
            target: head.clone(),
            targetScale: 0.85,
            dur: 1.5,
            onPlop: () => {
              job.look.hair = { style, color };
              job.phase = 'admire';
              job.t = 0;
              if (job.onDone) job.onDone();
            },
          });
        }
        break;
      }
      case 'draw':
        // the pencil does the work; if the drawing was lost, finish anyway
        if (job.t > 6) {
          job.look.hair = { style: job.style, color: job.color };
          job.phase = 'admire';
          job.t = 0;
          if (job.onDone) job.onDone();
        }
        break;
      default:
        // admire: a look in the mirror
        fig.lookAt = null;
        fig.reachR = null;
        if (job.t > 0.4 && !job.said) {
          job.said = true;
          if (job.npc) this.say(job.who, pick(['Looking sharp!', 'Love it!', 'Ten years younger!', 'Wow!']));
          else this.say(c, pick(['Looking sharp!', 'Next!', 'A masterpiece.']));
          if (job.npc) this.sound('cheer', 0.25, 10);
        }
        if (job.t > 2.2) {
          if (job.npc) {
            this.leave(job.v);
            this.npcJob = null;
          } else {
            this.heroJob = null;
            this.drawing = false;
            this.talking = false;
            const p = this.game.player;
            if (p.seat) p.seat.lock = false;
          }
          fig.lookAt = null;
        }
        break;
    }
    return { x: sx, z: sz, speed: 1.1 };
  }

  sweep(c) {
    const s = this.shop;
    const k = Math.sin(this.t * 0.35);
    c.faceYaw = Math.atan2(s.rx * Math.sign(Math.cos(this.t * 0.35)) + s.nx * 0.5, s.rz * Math.sign(Math.cos(this.t * 0.35)) + s.nz * 0.5);
    return { x: this.home.x + s.rx * k * 1.6, z: this.home.z + s.rz * k * 1.6, speed: 0.6 };
  }

  waiter(c) {
    const s = this.shop;
    const tables = s.spots.tables || [];
    const stops = [{ x: this.home.x, z: this.home.z }, ...tables.map((tb) => ({ x: tb.x + s.nx * 0.75, z: tb.z + s.nz * 0.75 }))];
    const i = Math.floor(this.t / 5) % stops.length;
    const st = stops[i];
    if (Math.hypot(c.pos.x - st.x, c.pos.z - st.z) < 0.3) c.faceYaw = i === 0 ? s.face : Math.atan2(-s.nx, -s.nz);
    return { x: st.x, z: st.z, speed: 1.1 };
  }

  barber(c, dt) {
    const s = this.shop;
    const ch = s.spots.chair;
    const guy = this.chairGuy;
    const fig = c.fig;
    // stand beside the chair, scissors at the customer's head
    const side = Math.sin(this.t * 0.25) > 0 ? 1 : -1;
    const sx = ch.x + s.rx * side * 0.55 - s.nx * 0.15;
    const sz = ch.z + s.rz * side * 0.55 - s.nz * 0.15;
    if (guy && guy.alive && guy.fig.sit > 0.8 && guy.owner === this) {
      c.faceYaw = Math.atan2(ch.x - c.pos.x, ch.z - c.pos.z);
      const h = guy.fig.j.headC;
      _v.set(h.x + Math.sin(this.t * 2) * 0.08, h.y + 0.08 + Math.sin(this.t * 3.1) * 0.05, h.z + Math.cos(this.t * 2.3) * 0.08);
      fig.reachR = fig.reachR || new THREE.Vector3();
      fig.reachR.copy(_v);
      if (Math.floor(this.t * 2.5) !== Math.floor((this.t - dt) * 2.5)) {
        const p = this.game.player.pos;
        const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
        if (d < 10) this.game.audio.play('snip', 0.7 * (1 - d / 10));
        this.game.fx.crumbs(h.x, h.y + 0.1, h.z, 2, 0.6, true);
      }
      this.cutT -= dt;
      if (this.cutT <= 0) {
        // all done: a new style, a look in the window, off he goes
        const L = guy.fig.look;
        L.hair = { style: pick(['pompadour', 'spiky', 'buzz', 'mohawk', 'slick', 'curly']), color: L.hair.style === 'none' ? [0.15, 0.12, 0.1] : L.hair.color };
        this.game.fx.crumbs(h.x, h.y + 0.15, h.z, 10, 1.6);
        this.game.bubbles.say(guy, pick(['Looking sharp!', 'Love it!', 'Ten years younger!']));
        this.game.civilians.release(guy);
        this.chairGuy = null;
        this.nextT = 4 + Math.random() * 4;
        fig.reachR = null;
      }
    } else {
      fig.reachR = null;
      if (this.chairGuy && (!this.chairGuy.alive || this.chairGuy.owner !== this)) this.chairGuy = null;
      if (!this.chairGuy) {
        this.nextT = (this.nextT || 0) - dt;
        if (this.nextT <= 0) this.newCustomer(false);
      }
      c.faceYaw = s.face;
    }
    return { x: sx, z: sz, speed: 1 };
  }

  // ------------------------------------------------------------------ DRAW YOURSELF A FRIEND
  // the girl at the stand: an eye on her customer, a smile for the promenade
  // (v5, ROADMAP 11.18) behind the cart: the tongs into the well, the bun, the mustard, handed
  // over; between customers a look up and down the street, a call to it now and then
  cartWork(c, dt) {
    const s = this.shop;
    const fig = c.fig;
    const cust = this.serving;
    const cx = s.keeper[0] + s.nx * 0.75;
    const cz = s.keeper[2] + s.nz * 0.75;
    if (cust && cust.alive) {
      c.faceYaw = Math.atan2(cust.pos.x - c.pos.x, cust.pos.z - c.pos.z);
      const k = Math.sin(this.t * 3.1);
      fig.reachR = fig.reachR || new THREE.Vector3();
      fig.reachR.set(cx + s.rx * (k * 0.3 - 0.15), c.pos.y + 1.0 + Math.max(0, k) * 0.15, cz + s.rz * (k * 0.3 - 0.15));
      fig.lookAt = k > 0.6 ? cust.fig.j.headC : fig.reachR;
    } else {
      fig.reachR = null;
      fig.lookAt = null;
      c.faceYaw = s.face + Math.sin(this.t * 0.35) * 0.9;
    }
    return { x: this.home.x, z: this.home.z, speed: 0.6 };
  }

  vendor(c) {
    const fig = c.fig;
    const cust = this.fCust;
    if (cust && cust.alive && cust.owner === this && Math.hypot(cust.pos.x - c.pos.x, cust.pos.z - c.pos.z) < 4) {
      c.faceYaw = Math.atan2(cust.pos.x - c.pos.x, cust.pos.z - c.pos.z);
      fig.lookAt = cust.fig.j.headC;
    } else {
      fig.lookAt = null;
      c.faceYaw = this.homeYaw + Math.sin(this.t * 0.4) * 0.5;
    }
    return { x: this.home.x, z: this.home.z, speed: 0.8 };
  }

  // walk a scene actor somewhere (a friend at his side if given); for use with yield*
  *walkTo(a, x, z, speed = 1.2, friend = null) {
    a.goal = { x, z, speed };
    let t = 0;
    while (a.alive && a.owner === this && Math.hypot(a.pos.x - x, a.pos.z - z) > 0.35 && t < 30) {
      if (friend && friend.alive && friend.owner === this) {
        // at his side, half a step behind
        const r = a.fig.right;
        const f = a.fig.forward;
        friend.goal = { x: a.pos.x + r.x * 0.8 - f.x * 0.25, z: a.pos.z + r.z * 0.8 - f.z * 0.25, speed: speed * 1.2 };
      }
      t += 0.1;
      yield 0.1;
    }
    a.goal = null;
    if (friend) friend.goal = null;
  }

  // the scene's people go back to the city (or, if they were never seen, simply go)
  endScene() {
    for (const c of [this.fCust, this.fFriend]) {
      if (c && c.owner === this) {
        c.goal = null;
        this.game.civilians.release(c);
      }
    }
    this.fCust = null;
    this.fFriend = null;
    this.extras = this.extras.filter((c) => c.owner === this);
  }

  hearts(x, y, z, n = 4) {
    for (let i = 0; i < n; i++) {
      this.game.fx.sprite('fx_heart', x + (Math.random() - 0.5) * 0.7, y + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.7, { size: 0.3 + Math.random() * 0.15, grow: 0.25, life: 1.4 + Math.random() * 0.6, vy: 0.55, fadeIn: 0.15 });
    }
  }

  *friendScene() {
    const s = this.shop;
    const sp = s.spots;
    const civs = this.game.civilians;
    for (;;) {
      this.endScene();
      yield 3 + Math.random() * 6;
      if (!this.open) continue;
      // somebody comes along the promenade for a magic pencil
      const from = Math.random() < 0.5 ? 1 : -1;
      const a = civs.spawnScripted(s.door[0] + s.rx * from * 9 + s.nx * 2.2, s.door[2] + s.rz * from * 9 + s.nz * 2.2, civilianLook(), this);
      a.goal = null;
      a.ctrl = (civ) => civ.goal;
      this.extras.push(a);
      this.fCust = a;
      const ok = () => a.alive && a.owner === this && this.open;
      yield* this.walkTo(a, sp.counter.x, sp.counter.z, 1.4);
      if (!ok()) continue;
      a.faceYaw = Math.atan2(this.home.x - a.pos.x, this.home.z - a.pos.z);
      this.say(a, pick(['One magic pencil, please!', 'Is it true? Any friend I draw?', 'I\'d like a friend, please.', 'One friend, please!']));
      yield 2;
      if (!ok()) continue;
      this.say(this.keeper, pick(['Here you go! Draw her with love.', 'Draw carefully!', 'Smile while you draw!', 'She\'ll be lovely.']));
      a.fig.carry = 'magicPencil';
      this.sound('pageflip', 0.6);
      yield 1.4;
      if (!ok()) continue;
      // off to the side, facing the promenade, and draw
      const spot = sp.draw[Math.random() < 0.5 ? 0 : 1];
      yield* this.walkTo(a, spot.x, spot.z, 1.1);
      if (!ok()) continue;
      a.faceYaw = spot.yaw;
      yield 0.9;
      const fx = Math.sin(spot.yaw);
      const fz = Math.cos(spot.yaw);
      const at = new THREE.Vector3(spot.x + fx * 1.35, a.pos.y + 0.88, spot.z + fz * 1.35);
      let plopped = false;
      this.game.airsketch.draw({ shape: 'friend', at, size: 1.75, author: a, pen: 'magicPencil', target: at.clone(), targetScale: 1, dur: 3.2, hold: 0.5, width: 3.6, onPlop: () => (plopped = true) });
      for (let t = 0; !plopped && t < 10 && ok(); t += 0.1) yield 0.1;
      if (!ok() || !plopped) continue;
      // she's real
      const b = civs.spawnScripted(at.x, at.z, friendLook(), this);
      b.goal = null;
      b.ctrl = (civ) => civ.goal;
      b.yaw = spot.yaw + Math.PI;
      b.faceYaw = spot.yaw + Math.PI;
      this.extras.push(b);
      this.fFriend = b;
      this.game.fx.confetti(at.x, at.y + 0.6, at.z, 26, 3);
      this.hearts(at.x, at.y + 1.0, at.z, 5);
      this.sound('cheer', 0.5, 20);
      a.fig.carry = null;
      yield 0.8;
      this.say(b, pick(['Hi!', 'Hello there!', 'Nice to meet you!', 'Oh! Hi!']));
      yield 1.8;
      if (!ok()) continue;
      this.say(a, pick(['Wow...', 'Hi! I\'m Sam.', 'You look wonderful!', 'Want to take a walk?']));
      this.hearts(a.pos.x, a.pos.y + 2.0, a.pos.z, 2);
      yield 1.8;
      if (!ok() || !b.alive || b.owner !== this) continue;
      this.say(b, pick(['Let\'s go!', 'I\'d love to!', 'Where to?', 'Lead the way!']));
      yield 0.6;
      // the two of them walk off along the promenade together
      yield* this.walkTo(a, spot.x + fx * 26, spot.z + fz * 26, 1.15, b);
    }
  }

  // the hero draws one (the stand's service)
  heroFriend() {
    const game = this.game;
    const life = this.life;
    const p = game.player;
    if (life.companion && life.companion.alive) {
      game.hud.toast('כבר יש לך חברה מצוירת — היא כאן לידך', 'info', 2.4);
      return;
    }
    // (v5: the friend you had - drawn again, she remembers you; or a new one: game/friend.js)
    const F = game.friend;
    if (F && F.data && !this.askedAgain) {
      this.askedAgain = true;
      game.dialog.show('צייר לך חברה', `לצייר שוב את ${F.data.heb}? היא זוכרת אתכם${F.data.homeKey ? ', והבית שלה מחכה' : ''}.`, [
        { label: `לצייר את ${F.data.heb}`, fn: () => ((F.redraw = true), this.heroFriend()) },
        { label: 'חברה חדשה', fn: () => ((F.redraw = false), this.heroFriend()) },
      ]);
      return;
    }
    this.askedAgain = false;
    const look = F && F.redraw && F.data && F.data.look ? F.data.look : null;
    // you turn to the promenade and draw her there, out in the open
    const s = this.shop;
    const at = new THREE.Vector3(p.pos.x + s.nx * 1.7, p.pos.y + 0.88, p.pos.z + s.nz * 1.7);
    const yaw = Math.atan2(s.nx, s.nz);
    p.yaw = yaw;
    p.fig.yaw = yaw;
    // a magic pencil in your hand, and you draw her
    const author = { fig: p.fig, alive: true, panicT: 0, owner: null };
    this.drawing = true;
    this.talking = true;
    p.seat = { x: p.pos.x, z: p.pos.z, yaw, lock: true, stand: true };
    game.hud.toast('מציירים... בעדינות!', 'info', 2.2);
    game.airsketch.draw({
      shape: 'friend',
      at,
      size: 1.75,
      author,
      pen: 'magicPencil',
      target: at.clone(),
      targetScale: 1,
      dur: 3.0,
      hold: 0.4,
      width: 3.6,
      onPlop: () => {
        if (p.seat && p.seat.stand) p.seat = null;
        this.drawing = false;
        this.talking = false;
        const c = life.newCompanion(at.x, at.z, look).c;
        c.yaw = p.yaw + Math.PI;
        this.game.fx.confetti(at.x, at.y + 0.6, at.z, 30, 3);
        this.hearts(at.x, at.y + 1.0, at.z, 6);
        this.sound('cheer', 0.7, 20);
        game.hud.toast('ציירת לעצמך חברה! היא תלך איתך, ותצייר לך לב כשקשה', 'good', 3.6);
        this.say(c, pick(['Hi! I\'m yours truly.', 'Hello, artist!', 'Nice drawing. Me, I mean.']));
      },
    });
  }

  // ------------------------------------------------------------------ serving the hero
  talk() {
    const game = this.game;
    const info = svc(game, this.shop.kind);
    if (game.time < this.cool || this.heroJob) {
      game.dialog.show(info.who, 'רגע, רגע — עוד לא סיימתי עם ההזמנה הקודמת. תחזור עוד מעט?', null);
      return;
    }
    this.talking = true;
    // (a shelf of the wardrobe opens its own choices: ROADMAP 5.7; what each costs: ROADMAP 8.1)
    const M = game.money;
    const prices = (M && PRICES[this.shop.kind]) || [];
    // (ROADMAP 8.2: at a place of yours it is all on the house)
    const PR = game.props;
    const own = !!(PR && PR.owns(this.shop));
    const choices = info.offers.map(([label, sketch, fn], i) => {
      if (sketch === 'menu') return { label, fn: () => fn(game, this) };
      const p = M ? M.priceOf(prices[i]) : 0;
      const n = own ? 0 : p;
      return { label: n ? `${label} · ${fmt(n)}` : p ? `${label} · על חשבון הבית` : label, fn: () => this.buy(n, label, () => this.serve(sketch, fn)) };
    });
    // (ROADMAP 8.2) the place itself, for sale; for its owner, the motel's room
    if (PR) {
      const deal = PR.offer(this.shop, () => this.talk());
      if (deal) choices.push(deal);
      if (own && PR.of(this.shop).id === 'motel') choices.push({ label: 'לישון בחדר עד הבוקר', fn: () => PR.sleep() });
      if (own) this.say(this.keeper, BOSS[Math.floor(Math.random() * BOSS.length)]);
    }
    choices.push({ label: 'רק מסתכל, תודה', fn: null });
    game.dialog.show(this.shop.who || info.who, own ? 'הבוס הגיע! הכול על חשבון הבית. מה תרצו?' : info.greet, choices);
  }

  // (ROADMAP 5.7) a shelf: each thing on it drawn in the air for you, and put on
  shelf(text, part, items, sketch) {
    const game = this.game;
    const info = svc(game, this.shop.kind);
    const choices = items.map((it) => {
      const off = it[part] === null || it[part] === undefined;
      // (ROADMAP 8.1: taking something off is free)
      const n = game.money && !off ? SHELF_PRICES[part] || 0 : 0;
      return {
        label: n ? `${it.name} · ${fmt(n)}` : it.name,
        fn: () => this.buy(n, it.name, () => this.serve(off ? null : typeof sketch === 'function' ? sketch(it) : sketch, (g) => {
          wear(g, part, it);
          g.hud.toast(off ? `${it.name}` : PRAISE[Math.floor(Math.random() * PRAISE.length)], 'good', 2);
        }), () => this.shelf(text, part, items, sketch)),
      };
    });
    choices.push({ label: 'משהו אחר', fn: () => this.talk() });
    game.dialog.show(info.who, text, choices);
    this.trying = true;
  }

  // (ROADMAP 8.1) paid first, with cash or the card; or the shop's no, and back to its offers
  buy(n, what, go, back = () => this.talk()) {
    const game = this.game;
    const M = game.money;
    if (!M || n <= 0) return go();
    const cashOnly = CASH_ONLY.has(this.shop.kind);
    if (!M.pay(n, what.replace(/\s*\(.*?\)/g, '').trim(), cashOnly)) {
      M.refuse(svc(game, this.shop.kind).who, n, cashOnly, back);
      return;
    }
    go();
  }

  serve(sketch, fn) {
    const game = this.game;
    const k = this.keeper;
    const p = game.player;
    // (trying things on in the wardrobe: the next one in a moment, ROADMAP 5.7)
    this.cool = game.time + (this.trying ? 2.5 : 12);
    this.trying = false;
    if (!sketch) {
      fn(game, this);
      return;
    }
    // in the barber's shop: into the chair, the old hair rubbed out, the new one drawn on
    if (sketch.startsWith('hair:') && this.room && this.room.chairs.length) {
      this.heroCut(sketch.slice(5));
      return;
    }
    // the shopkeeper draws it in the air between you, and it plops into your hands (or onto your head)
    this.drawing = true;
    this.talking = true;
    let shape = sketch;
    let at;
    let size = 0.55;
    let target;
    let scale = 0.25;
    if (sketch.startsWith('hair:')) {
      const style = sketch.slice(5);
      shape = HAIR_SKETCH[style](style === 'none' ? [0.2, 0.2, 0.24] : [0.2, 0.18, 0.16]);
      const h = p.fig.j.headC;
      at = h.clone();
      at.y += 0.05;
      size = 0.42;
      target = at.clone();
      scale = 0.7;
    } else {
      at = _w.copy(k.pos).lerp(p.pos, 0.5).clone();
      at.y = p.pos.y + 1.55;
      target = p.fig.j.handR.clone();
    }
    game.airsketch.draw({
      shape,
      at,
      size,
      author: k,
      target,
      targetScale: scale,
      dur: 1.3,
      onPlop: () => {
        this.drawing = false;
        fn(game, this);
      },
    });
  }

  // ------------------------------------------------------------------ (v5, ROADMAP 11.17) at home
  // knocking on the door of a house: who lives there comes to it and asks you in
  knock() {
    const game = this.game;
    const s = this.shop;
    game.audio.play('knock', 0.8);
    this.knocked = game.time;
    this.resHold = { name: 'door', until: game.time + 7 };
    this.resPts = null;
    this.say(this.keeper, pick(['Come in, it\'s open!', 'Who is it? Oh, come in!', 'Welcome, come in!', 'Door\'s open, come on in!']));
    game.hud.toast(`${s.who || 'בעלי הבית'}: נכנסים, הדלת פתוחה`, 'info', 2.4);
  }

  // where in the room someone stands, sits or works at a mark: { x, z, yaw, sit } (or null)
  spotOf(name) {
    const R = this.room;
    const m = R.marks || {};
    const F = R.facade;
    const used = new Set(this.visitors.filter((v) => v.mode === 'seat' || v.mode === 'chair').map((v) => v.spot));
    // (not where you sit, nor where the one who lives here already is)
    const ps = this.game.player.seat;
    if (this.heroSeat && ps && Math.hypot(ps.x - this.heroSeat.x, ps.z - this.heroSeat.z) < 0.1) used.add(this.heroSeat);
    if (this.resSpot && this.resSpot.seat) used.add(this.resSpot.seat);
    const nearSeat = (t, max) => {
      let best = null;
      let bd = max;
      for (const st of R.seats) {
        if (used.has(st)) continue;
        const d = Math.hypot(st.x - t.x, st.z - t.z);
        if (d < bd) {
          bd = d;
          best = st;
        }
      }
      return best;
    };
    if (name === 'door') {
      const d = R.door;
      return d ? { x: d.x, z: d.z, yaw: Math.atan2(F.nx, F.nz), sit: false } : null;
    }
    if (name === 'table' || name === 'sofa') {
      const t = name === 'table' ? m.table : m.sofaB || m.sofaA;
      if (!t) return null;
      const st = nearSeat(t, name === 'table' ? 1.6 : 1.2);
      return st ? { x: st.x, z: st.z, yaw: st.yaw, sit: true, seat: st } : null;
    }
    if (name === 'wall') {
      const t = m.wall;
      return t ? { x: t.x + F.nx * 1.5, z: t.z + F.nz * 1.5, yaw: Math.atan2(-F.nx, -F.nz), sit: false } : null;
    }
    const t = m[name];
    if (!t) return null;
    return { x: t.x, z: t.z, yaw: t.yaw, sit: name === 'domino' || name === 'piano' };
  }

  // the one who lives here, through the day: at the stove, a while at the table, on the sofa before
  // the television, a look at the pictures; the painter at the easel, grandmother at her dominoes,
  // the villa's at its piano
  residentLife(c, dt) {
    const game = this.game;
    const h = this.resHold;
    if (h && game.time < h.until) return this.goSpot(c, h.name, dt);
    this.resHold = null;
    this.resT = (this.resT === undefined ? 2 + Math.random() * 5 : this.resT) - dt;
    if (this.resT <= 0 || !this.resAt) {
      const m = this.room.marks || {};
      const pool = ['stove', 'stove', 'table', 'sofa', 'wall'];
      if (m.easel) pool.push('easel', 'easel', 'easel');
      if (m.domino) pool.push('domino', 'domino');
      if (m.piano) pool.push('piano', 'piano');
      const ok = pool.filter((k) => k !== this.resAt && this.spotOf(k));
      this.resAt = ok.length ? pick(ok) : 'stove';
      this.resT = 9 + Math.random() * 13;
      this.resPts = null;
    }
    return this.goSpot(c, this.resAt, dt);
  }

  // walk to a spot of the room (round the furniture) and be there
  goSpot(c, name, dt) {
    const fig = c.fig;
    if (this.resSpotName !== name || !this.resSpot) {
      this.resSpotName = name;
      this.resSpot = this.spotOf(name) || { x: this.home.x, z: this.home.z, yaw: this.homeYaw, sit: false };
      this.resPts = null;
    }
    const t = this.resSpot;
    const d = Math.hypot(c.pos.x - t.x, c.pos.z - t.z);
    if (d > 0.3) {
      fig.sit = Math.max(0, fig.sit - dt * 3);
      fig.reachR = null;
      if (!this.resPts) this.resPts = this.room.path(c.pos.x, c.pos.z, t.x, t.z);
      while (this.resPts.length > 1 && Math.hypot(c.pos.x - this.resPts[0].x, c.pos.z - this.resPts[0].z) < 0.3) this.resPts.shift();
      const q = this.resPts[0] || t;
      // (stuck: a step straight there)
      this.resStuck = (this.resStuck || 0) + dt;
      if (this.resStuck > 14) {
        c.pos.x = t.x;
        c.pos.z = t.z;
        this.resStuck = 0;
      }
      return { x: q.x, z: q.z, speed: 1.0 };
    }
    this.resStuck = 0;
    c.faceYaw = t.yaw;
    fig.sit = t.sit ? Math.min(1, fig.sit + dt * 3) : Math.max(0, fig.sit - dt * 3);
    // what the hands do there: the spoon in the pot, the brush on the canvas, the keys
    if (name === 'stove' || name === 'easel' || name === 'piano') {
      if (!fig.reachR) fig.reachR = new THREE.Vector3();
      const fx = Math.sin(t.yaw);
      const fz = Math.cos(t.yaw);
      const k = this.t;
      const up = name === 'easel' ? 1.25 + Math.sin(k * 1.3) * 0.22 : name === 'piano' ? 0.82 : 1.02;
      fig.reachR.set(c.pos.x + fx * 0.42 + Math.sin(k * 2.1) * 0.12, c.pos.y + up, c.pos.z + fz * 0.42 + Math.cos(k * 1.7) * 0.12);
      if (name === 'piano') this.notesAt(c, dt, 0.8);
    } else fig.reachR = null;
    return { x: t.x, z: t.z, speed: 0.4 };
  }

  // music notes over someone playing (a few a second)
  notesAt(c, dt, rate = 1.2) {
    if (Math.floor(this.t * rate) === Math.floor((this.t - dt) * rate)) return;
    const j = c.fig.j.handR;
    this.life.notes.push({ x: j.x + (Math.random() - 0.5) * 0.4, y: j.y + 0.35, z: j.z + (Math.random() - 0.5) * 0.4, t: 0, s: Math.random() * 100 });
    const p = this.game.player.pos;
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d < 12 && Math.random() < 0.6) this.game.audio.play(c === this.game.player || this.shop.kind === 'homeLux' ? 'piano' : 'strum', 0.7 * (1 - d / 12));
  }

  // dinner with them: you sit at the table, the one who cooked draws your plate onto it
  homeMeal(dish, n, color, text) {
    const game = this.game;
    const p = game.player;
    const R = this.room;
    const sp = this.spotOf('table');
    if (sp) {
      p.seat = { x: sp.x, z: sp.z, yaw: sp.yaw };
      this.heroSeat = sp.seat;
    }
    const m = R.marks.table || { x: this.keeper.pos.x, y: CURB + 0.8, z: this.keeper.pos.z };
    // (the cook to the table too)
    this.resHold = { name: 'table', until: game.time + 14 };
    this.drawing = true;
    this.talking = true;
    this.say(this.keeper, pick(['Dinner is served!', 'Eat, eat!', 'Help yourself!', 'Made it myself!']));
    const at = new THREE.Vector3(m.x, (m.y || CURB + 0.78) + 0.55, m.z);
    game.airsketch.draw({
      shape: dish,
      at,
      size: 0.5,
      author: this.keeper,
      target: new THREE.Vector3(m.x, (m.y || CURB + 0.78) + 0.06, m.z),
      targetScale: 0.55,
      dur: 1.5,
      onPlop: () => {
        this.drawing = false;
        meal(n, color, text)(game);
        this.hearts(p.pos.x, p.pos.y + 1.8, p.pos.z, 3);
        for (const v of this.visitors) if (v.mode === 'seat' && Math.random() < 0.6) this.say(v.c, pick(['Yum!', 'So good!', 'Can I have more?', 'Mmm!']));
      },
    });
  }

  // on the sofa before the television: a cartoon on it, a frame at a time (its words under it)
  watchTV() {
    const game = this.game;
    const p = game.player;
    const sp = this.spotOf('sofa');
    if (sp) {
      p.seat = { x: sp.x, z: sp.z, yaw: sp.yaw };
      this.heroSeat = sp.seat;
    }
    this.tv = { k: -1, t: 0 };
    game.hud.toast('על הספה. בטלוויזיה: סרט מצויר', 'info', 2.4);
    // (the family comes to watch too)
    this.resHold = { name: 'sofa', until: game.time + 30 };
  }

  tvLife(dt) {
    const game = this.game;
    const p = game.player;
    const tv = this.tv;
    const R = this.room;
    const m = R.marks.tv;
    if (!m || !p.seat || !R.inside(p.pos.x, p.pos.z, 0.2, p.pos.y)) {
      if (tv.sk) game.airsketch.erase(tv.sk);
      this.tv = null;
      return;
    }
    tv.t -= dt;
    if (tv.t > 0) return;
    tv.t = 3.4;
    tv.k = (tv.k + 1) % FILM.length;
    if (tv.sk) game.airsketch.erase(tv.sk);
    const F = R.facade;
    const [shape, words] = FILM[tv.k];
    tv.sk = game.airsketch.draw({ shape, at: new THREE.Vector3(m.x + F.nx * 0.03, m.y, m.z + F.nz * 0.03), size: 0.62, keep: true, dur: 1.4, width: 2.2, wall: { rx: F.rx, rz: F.rz, nx: F.nx, nz: F.nz } });
    game.hud.toast(words, 'info', 3);
  }

  // the kids up off the rug and round you, dancing; laughter
  playKids() {
    const game = this.game;
    let n = 0;
    for (const v of this.visitors) {
      if (v.phase !== 'at') continue;
      v.playT = 9 + Math.random() * 3;
      n++;
      this.say(v.c, pick(['Yay!', 'Again! Again!', 'Catch me!', 'Wheee!']));
    }
    game.hud.toast(n ? 'משחקים ביחד! כולם צוחקים' : 'הילדים יצאו לשחק בחצר...', n ? 'good' : 'info', 2.4);
    if (n) {
      const p = game.player;
      p.fig.dance = 1;
      game.inkwell.after(8, () => (p.fig.dance = 0));
      this.hearts(p.pos.x, p.pos.y + 1.9, p.pos.z, 4);
    }
  }

  // the painter draws on the wall, and so do you, side by side; the pen full of ink after
  paintTogether() {
    const game = this.game;
    const p = game.player;
    const R = this.room;
    const m = R.marks.wall;
    if (!m) return;
    const F = R.facade;
    const wall = { rx: F.rx, rz: F.rz, nx: F.nx, nz: F.nz };
    const shapes = shuffled(['flower', 'heart', 'dog', 'balloon', 'house', 'umbrella', 'plant']);
    this.resHold = { name: 'wall', until: game.time + 9 };
    this.drawing = true;
    this.talking = true;
    this.say(this.keeper, pick(['Let\'s make something!', 'You start, I follow.', 'More colour!']));
    const a = new THREE.Vector3(m.x - F.rx * 0.7 + F.nx * 0.04, m.y, m.z - F.rz * 0.7 + F.nz * 0.04);
    const b = new THREE.Vector3(m.x + F.rx * 0.7 + F.nx * 0.04, m.y, m.z + F.rz * 0.7 + F.nz * 0.04);
    const s1 = game.airsketch.draw({ shape: shapes[0], at: a, size: 0.8, author: this.keeper, keep: true, dur: 2.4, width: 3.0, wall });
    const me = { fig: p.fig, alive: true, panicT: 0, owner: null };
    const s2 = game.airsketch.draw({ shape: shapes[1], at: b, size: 0.8, author: me, keep: true, dur: 2.6, width: 3.0, wall, pen: 'magicPencil' });
    game.inkwell.after(3, () => {
      this.drawing = false;
      if (game.ink) game.ink.fill(game.ink.cap, 'מהסטודיו');
      game.hud.toast('ציור משותף על הקיר! העט מלא דיו', 'good', 2.6);
      this.hearts(p.pos.x, p.pos.y + 1.9, p.pos.z, 3);
    });
    game.inkwell.after(40, () => {
      game.airsketch.erase(s1);
      game.airsketch.erase(s2);
    });
  }

  // a record on, and everyone dances
  homeDance() {
    const game = this.game;
    const p = game.player;
    p.fig.dance = 1;
    this.keeper.fig.dance = 1;
    for (const v of this.visitors) if (v.phase === 'at') v.playT = 10;
    for (let i = 0; i < 8; i++) this.life.notes.push({ x: this.keeper.pos.x + (Math.random() - 0.5) * 2, y: this.keeper.pos.y + 1.4 + Math.random() * 0.6, z: this.keeper.pos.z + (Math.random() - 0.5) * 2, t: -i * 0.35, s: Math.random() * 100 });
    for (let i = 0; i < 5; i++) setTimeout(() => game.audio.play('strum', 0.8), i * 420);
    game.hud.toast('התקליט מסתובב, כולם רוקדים!', 'good', 2.4);
    game.inkwell.after(10, () => {
      p.fig.dance = 0;
      if (this.keeper) this.keeper.fig.dance = 0;
    });
  }

  // dominoes with grandmother: you at one side of her little table, she at the other
  dominoes() {
    const game = this.game;
    const p = game.player;
    const sp = this.spotOf('domino2');
    if (!sp) {
      game.hud.toast('השולחן תפוס. אולי אחר כך', 'info', 2);
      return;
    }
    p.seat = { x: sp.x, z: sp.z, yaw: sp.yaw };
    this.resHold = { name: 'domino', until: game.time + 13 };
    this.say(this.keeper, pick(['I warn you, I never lose.', 'Double six! Your turn.', 'Let\'s see what you\'ve got.']));
    game.hud.toast('משחקים דומינו עם סבתא...', 'info', 2.4);
    game.inkwell.after(11, () => {
      if (!p.seat) return;
      if (Math.random() < 0.55) {
        if (game.money) game.money.earn(15, 'ניצחון בדומינו');
        game.hud.toast('ניצחתם את סבתא בדומינו! (+15 בכיס)', 'good', 2.8);
        this.say(this.keeper, pick(['Beginner\'s luck!', 'Again tomorrow!', 'Ay, you\'re good!']));
      } else {
        game.hud.toast('סבתא ניצחה. היא תמיד מנצחת', 'info', 2.8);
        this.say(this.keeper, pick(['Domino!', 'Hah! Another round?', 'Don\'t feel bad, sweetie.']));
      }
      this.hearts(p.pos.x, p.pos.y + 1.6, p.pos.z, 2);
    });
  }

  // a story from the old days
  story() {
    const game = this.game;
    const s = this.shop;
    this.talking = true;
    const k = (this.storyK = ((this.storyK === undefined ? Math.floor(Math.random() * STORIES.length) : this.storyK) + 1) % STORIES.length);
    game.dialog.show(s.who || 'סבתא', STORIES[k], [{ label: 'עוד סיפור', fn: () => this.story() }, { label: 'תודה, סבתא', fn: null }]);
  }

  // the villa's piano: you play, the notes fly up, everyone listens
  piano() {
    const game = this.game;
    const p = game.player;
    const sp = this.spotOf('piano');
    if (!sp) return;
    p.seat = { x: sp.x, z: sp.z, yaw: sp.yaw };
    this.pianoT = 12;
    this.resHold = { name: 'sofa', until: game.time + 14 };
    game.hud.toast('מנגנים... כולם מקשיבים', 'good', 2.4);
  }

  // the hero in the barber's chair
  heroCut(style) {
    const R = this.room;
    const game = this.game;
    const p = game.player;
    const chair = R.chairs[R.chairs.length - 1];
    // whoever sat there gets up for a moment
    for (const v of this.visitors.slice()) if (v.spot === chair && v.phase !== 'out') this.leave(v);
    if (this.npcJob && this.npcJob.chair === chair) this.npcJob = null;
    p.seat = { x: chair.x, z: chair.z, yaw: chair.yaw, lock: true };
    const L = p.fig.look;
    const color = style === 'none' ? L.skin : pick(HERO_HAIR_COLORS);
    this.drawing = true;
    this.talking = true;
    this.heroJob = {
      who: p,
      npc: false,
      chair,
      look: L,
      phase: 'start',
      t: 0,
      side: -1,
      style,
      color,
      hatOff: true,
      head: () => p.fig.j.headC,
      onDone: () => heroHair(game, style, color),
    };
  }

  serenade(dance) {
    const game = this.game;
    const k = this.keeper;
    for (let i = 0; i < 6; i++) this.life.notes.push({ x: k.pos.x + (Math.random() - 0.5), y: k.pos.y + 1.6 + Math.random() * 0.4, z: k.pos.z + (Math.random() - 0.5), t: -i * 0.3, s: Math.random() * 100 });
    for (let i = 0; i < 4; i++) setTimeout(() => game.audio.play('strum', 0.9), i * 450);
    game.bubbles.say(k, pick(['This one\'s called "Eraser Blues"', '♪ La la laaa ♪', 'For the hero with the pencil!']));
    if (dance) {
      const p = game.player;
      p.fig.dance = 1;
      game.inkwell.after(5, () => (p.fig.dance = 0));
      game.hud.toast('רוקדים ברחוב!', 'good', 2);
    }
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    if (this.doorT > 0) this.doorT -= dt;
    const k = this.keeper;
    if (k && (k.owner !== this || !k.alive)) {
      // the shopkeeper ran (or was rubbed out): the chairs empty, the shop is shut
      if (k.alive && k.owner === this) this.game.civilians.release(k);
    }
    for (const c of this.extras) {
      if (c.owner === this && (c.panicT > 0 || !c.alive)) this.game.civilians.release(c);
    }
    for (const v of this.visitors.slice()) {
      const c = v.c;
      if (!c.alive || c.panicT > 0 || c.headless || (v.own && c.owner !== this) || (!v.own && c.ctrl === null)) this.drop(v);
    }
    if (this.chairGuy && this.chairGuy.owner === this && this.chairGuy.panicT > 0) {
      this.game.civilians.release(this.chairGuy);
      this.chairGuy = null;
    }
    if (k && k.owner === this && k.panicT > 0) {
      this.game.civilians.release(k);
      k.fig.reachR = null;
    }
    // the barber ran off in the middle of the hero's haircut: out of the chair
    if (this.heroJob && !this.open) {
      this.heroJob = null;
      this.drawing = false;
      this.talking = false;
      const p = this.game.player;
      if (p.seat) p.seat = null;
    }
    // the stand's little play goes on
    if (this.script) {
      if (this.sWait > 0) this.sWait -= dt;
      else {
        for (let guard = 0; guard < 12; guard++) {
          const r = this.script.next();
          if (r.done) {
            this.script = null;
            break;
          }
          if (r.value > 0) {
            this.sWait = r.value;
            break;
          }
        }
      }
    }
    // (v5, GTA IV round: the restaurant's parties, the lobby's moviegoers, the bar's regulars come and
    // go their own way - game/venuelife.js)
    if (this.dining) this.dining.update(dt);
    else if (this.lobby) this.lobby.update(dt);
    else if (this.barLife) this.barLife.update(dt);
    // now and then somebody new at the door (v5, 11.18: a shop of the new kind is busy - as many as
    // it holds when you are in it or at its window, fewer down the street)
    if (this.room && this.open && !this.shop.home && !this.dining && !this.lobby && (!this.game.touch || this.room.pay)) {
      this.newT = (this.newT === undefined ? 4 + Math.random() * 6 : this.newT) - dt;
      if (this.newT <= 0) {
        const want = this.wantVisitors();
        const n = this.visitors.length;
        this.newT = n < want - 2 ? 1.2 + Math.random() * 1.6 : n < want ? 2.5 + Math.random() * 3.5 : 14 + Math.random() * 16;
        if (n < Math.max(want, this.game.touch ? 0 : 4)) {
          // (nobody pops up in sight: in at the door while you are near, already inside when not)
          const p = this.game.player.pos;
          const far = Math.hypot(this.home.x - p.x, this.home.z - p.z) > 22 && !this.room.inside(p.x, p.z, 0.5, p.y);
          if (far) {
            const f = this.freeSpot();
            if (f) this.addVisitor(null, { ...f, already: true });
          } else {
            const v = this.addVisitor(null);
            // (v5, GTA IV round: in at the club's door - the coat check first)
            if (v && this.barLife && this.barLife.coats) this.barLife.toCoats(v);
          }
        }
      }
    }
    if (this.staffer && this.staffer.owner !== this) this.staffer = null;
    if (this.lifts && this.lifts.length) this.liftLife(dt);
    if (this.shop.screen && this.open) this.film(dt);
    // (at home: the television on, the piano played)
    if (this.tv) this.tvLife(dt);
    if (this.pianoT > 0) {
      this.pianoT -= dt;
      const p = this.game.player;
      if (!p.seat) this.pianoT = 0;
      else {
        p.fig.reachR = p.fig.reachR || new THREE.Vector3();
        p.fig.reachR.set(p.pos.x + Math.sin(p.yaw) * 0.45 + Math.sin(this.t * 6) * 0.15, p.pos.y + 0.85, p.pos.z + Math.cos(p.yaw) * 0.45 + Math.cos(this.t * 5) * 0.15);
        this.notesAt(p, dt, 3);
        if (this.pianoT <= 0) {
          p.fig.reachR = null;
          this.game.hud.toast('מחיאות כפיים!', 'good', 2);
          this.hearts(p.pos.x, p.pos.y + 1.8, p.pos.z, 4);
        }
      }
    }
  }

  // ------------------------------------------------------------------ the theatre's film
  // while you are in the hall its film is drawn on the screen, a frame at a time (rubbed out for
  // the next one); sitting in a seat with a ticket you read its words too
  film(dt) {
    const game = this.game;
    const p = game.player.pos;
    if (!this.room.inside(p.x, p.z, 0.3, p.y)) {
      if (this.filmSk) game.airsketch.erase(this.filmSk);
      this.filmSk = null;
      this.filmI = 0;
      this.filmT = 1;
      return;
    }
    this.filmT = (this.filmT === undefined ? 1 : this.filmT) - dt;
    if (this.filmT > 0) return;
    if (this.filmSk) {
      game.airsketch.erase(this.filmSk);
      this.filmSk = null;
      this.filmT = 0.7;
      return;
    }
    const [shape, line] = FILM[(this.filmI || 0) % FILM.length];
    this.filmI = (this.filmI || 0) + 1;
    const scr = this.shop.screen;
    this.filmSk = game.airsketch.draw({ shape, at: new THREE.Vector3(scr.x, scr.y, scr.z), size: scr.size * 1.7, wall: { rx: scr.rx, rz: scr.rz, nx: scr.nx, nz: scr.nz }, keep: true, dur: 2.2, width: 11 });
    const seat = game.player.seat;
    if (seat && seat.theatre === this) game.hud.toast(line, 'info', 3.6);
    this.filmT = 4.8;
  }

  // a ticket: to a free seat in the middle of the rows, and the film from its start
  watchShow() {
    const game = this.game;
    const R = this.room;
    const used = new Set(this.visitors.map((v) => v.spot));
    const free = R.seats.filter((x) => !used.has(x));
    if (!free.length) {
      game.hud.toast('כל המקומות תפוסים! אולי בהצגה הבאה', 'info', 2.6);
      return;
    }
    const scr = this.shop.screen;
    // (the seat with the best view: in the middle, not too close)
    let best = free[0];
    let bs = Infinity;
    for (const x of free) {
      const dx = x.x - scr.x;
      const dz = x.z - scr.z;
      const along = Math.abs(dx * scr.nx + dz * scr.nz);
      const across = Math.abs(dx * scr.rx + dz * scr.rz);
      const sc = across * 1.5 + Math.abs(along - 9);
      if (sc < bs) {
        bs = sc;
        best = x;
      }
    }
    const p = game.player;
    p.seat = { x: best.x, z: best.z, yaw: best.yaw, lock: false, theatre: this };
    // (the camera behind your head, a little up: the screen over the rows in front)
    game.camRig.yaw = best.yaw;
    game.camRig.pitch = 0.12;
    this.filmI = 0;
    this.filmT = 1.2;
    if (this.filmSk) game.airsketch.erase(this.filmSk);
    this.filmSk = null;
    game.hud.toast('האורות כבים... ההצגה מתחילה! (צעד אחד - וקמים)', 'info', 3.2);
  }

  // ------------------------------------------------------------------ the lifts
  liftLife(dt) {
    for (const l of this.lifts) {
      if (l.hold > 0) {
        l.hold -= dt;
        l.open = Math.min(1, l.open + dt * 1.4);
      } else l.open = Math.max(0, l.open - dt * 1.1);
      if (l.down && l.open > 0.7) {
        l.down = false;
        this.fromLift(l);
      }
    }
    this.liftT -= dt;
    if (this.liftT > 0) return;
    this.liftT = (this.game.touch ? 24 : 12) + Math.random() * 16;
    if (!this.open || this.visitors.length >= 5) return;
    const l = pick(this.lifts);
    if (l.hold > 0) return;
    l.hold = 3.4;
    l.down = true;
    this.life.ding(this.shop);
  }

  // the lift nearest to somebody waiting for it
  nearLift(c) {
    let best = this.lifts[0];
    for (const l of this.lifts) if (Math.hypot(l.x - c.pos.x, l.z - c.pos.z) < Math.hypot(best.x - c.pos.x, best.z - c.pos.z)) best = l;
    return best;
  }

  // somebody down in the lift: across the lobby, out of the door, on along the sidewalk
  fromLift(l) {
    const s = this.shop;
    const c = this.game.civilians.spawnScripted(l.x + s.nx * 0.35, l.z + s.nz * 0.35, civilianLook(), this);
    c.yaw = s.face;
    c.noCollide = true;
    if (Math.random() < 0.3) c.fig.carry = pick(['phone', 'coffee', 'newspaper']);
    const v = { c, spot: null, mode: 'browse', own: true, phase: 'out', t: 0, pts: null, reachT: 9, stay: 0, street: true };
    c.exitRoom = this.room;
    c.exitShop = s;
    c.ctrl = (civ, dt) => this.visit(v, dt);
    this.visitors.push(v);
    this.leave(v);
  }

  // an open lift: the doors slid apart and the lit car between them, hatched in pen
  drawLift(fr, l, k) {
    const s = this.shop;
    const o = l.open * l.open * (3 - 2 * l.open);
    const g = 0.7 * o;
    const y0 = this.room.floor;
    const x = l.x + s.nx * 0.07;
    const z = l.z + s.nz * 0.07;
    // (the strokes close enough together to fill it from where you look)
    const cam = this.game.camera.position;
    const gap = Math.min(0.06, Math.max(0.012, Math.hypot(cam.x - x, cam.z - z) * 0.004));
    const n = Math.max(1, Math.round(g / gap));
    for (let i = -n; i <= n; i++) {
      const u = (i / n) * g;
      fr.lineXYZ(x + s.rx * u, y0 + 0.04, z + s.rz * u, x + s.rx * u, y0 + 2.44, z + s.rz * u, LIFT_CAR, 10, 1300 + k * 50 + (i & 31), 1, 0.003, 0);
    }
    for (const u of [-g, g]) fr.lineXYZ(x + s.rx * u, y0 + 0.02, z + s.rz * u, x + s.rx * u, y0 + 2.48, z + s.rz * u, INK, 2.6, 1290 + k * 50 + (u > 0 ? 1 : 0), 1, 0.004, 0);
    if (g > 0.15) {
      const w = g - 0.12;
      fr.lineXYZ(x - s.rx * w, y0 + 2.3, z - s.rz * w, x + s.rx * w, y0 + 2.3, z + s.rz * w, LIFT_LIGHT, 9, 1292 + k * 50, 1, 0.003, 0);
    }
  }

  draw(fr) {
    const s = this.shop;
    if (this.lifts) {
      for (let k = 0; k < this.lifts.length; k++) if (this.lifts[k].open > 0.01) this.drawLift(fr, this.lifts[k], k);
    }
    // the door swings open: warm light from inside (a shop with a closed door)
    if (this.doorT > 0 && !this.room) {
      const a = Math.min(1, this.doorT * 3);
      const x = s.door[0] - s.nx * 0.5;
      const z = s.door[2] - s.nz * 0.5;
      for (let i = 0; i < 4; i++) {
        const o = (i - 1.5) * 0.22;
        fr.lineXYZ(x + s.rx * o + s.nx * 0.07, s.door[1] + 0.15, z + s.rz * o + s.nz * 0.07, x + s.rx * o + s.nx * 0.07, s.door[1] + 2.25, z + s.rz * o + s.nz * 0.07, [1, 0.8, 0.45], 14, 900 + i, 0.85 * a, 0.004, 0);
      }
    }
    // the barber pole turns
    const pole = s.spots.pole;
    if (pole && this.open) {
      const f = pole.f;
      const p = f.p(pole.u, 0, 0.2);
      const y0 = pole.yBase + 1.35;
      const t = this.game.time * 0.8;
      for (let k = 0; k < 2; k++) {
        const col = k ? [0.25, 0.4, 0.8] : [0.85, 0.2, 0.22];
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let i = 0; i <= 8; i++) {
          const u = i / 8;
          const a = k * Math.PI + u * Math.PI * 2 + t * 3;
          const x = p[0] + Math.cos(a) * 0.112;
          const y = y0 + u * 0.95;
          const z = p[2] + Math.sin(a) * 0.112;
          if (i) fr.lineXYZ(px, py, pz, x, y, z, col, 4.5, 950 + k * 10 + i, 1, 0.003, 0);
          px = x;
          py = y;
          pz = z;
        }
      }
    }
  }

  dispose() {
    this.alive = false;
    if (this.dining) this.dining.dispose();
    if (this.filmSk) this.game.airsketch.erase(this.filmSk);
    this.filmSk = null;
    const civs = this.game.civilians;
    const drop = (c) => {
      if (!c) return;
      if (c.owner === this) civs.remove(c);
    };
    drop(this.keeper);
    for (const c of this.extras) drop(c);
    drop(this.chairGuy);
    for (const v of this.visitors) {
      this.clearDish(v);
      if (v.own) drop(v.c);
      else if (v.c.ctrl) {
        // a passer-by still inside: they find their own way out
        v.c.ctrl = null;
        v.c.faceYaw = null;
        v.c.fig.sit = 0;
      }
    }
    this.visitors = [];
    this.extras = [];
    if (this.heroJob) {
      const p = this.game.player;
      if (p.seat) p.seat = null;
      this.heroJob = null;
    }
  }
}

// ------------------------------------------------------------------ the friend you drew
const COMPANION_LINES = ['I love this city!', 'Where are we going?', 'You draw well, you know.', 'Look, a pigeon!', 'Nice pencil.', 'Careful out there!', 'Wait for me!'];
// riding with you (ROADMAP 4.5)
const RIDE_IN = ['Shotgun!', "Let's go!", 'Where to?', 'Buckle up!'];
const RIDE_LINES = ['Turn up the radio!', 'Nice ride!', 'I love this song!', 'Are we there yet?', 'Look at the sunset...', 'Left here! No, right!', 'You drive like you draw.'];
const RIDE_AIR = ['Wheeee!', 'Whoa!!', 'Again! Again!'];
const RIDE_HIT = ['Ow! Careful!', 'Watch the road!', 'My hair!', 'Easy!'];
const RIDE_OUT = ['Thanks for the ride!', 'Fun!', "Let's walk a bit."];

class Companion {
  constructor(life, x, z, look = null) {
    this.life = life;
    this.game = life.game;
    this.c = this.game.civilians.spawnScripted(x, z, look || friendLook(), this);
    // she stays by you when it gets loud
    this.c.brave = true;
    this.c.speed = 1.6;
    this.c.ctrl = (civ, dt) => this.step(civ, dt);
    this.talkT = 14 + Math.random() * 10;
    this.healT = 6;
    this.waitT = 0;
  }

  get alive() {
    return this.c && this.c.alive && this.c.owner === this;
  }

  say(text) {
    const p = this.game.player.pos;
    if (Math.hypot(this.c.pos.x - p.x, this.c.pos.z - p.z) < 26) this.game.bubbles.say(this.c, text);
  }

  step(c, dt) {
    // (v5: what she does of her own - leading the way, waiting, at home: game/friend.js)
    if (this.over && !this.riding) {
      const r = this.over(c, dt);
      if (r !== undefined) return r;
    }
    const game = this.game;
    const p = game.player;
    const anchor = p.inVehicle ? p.inVehicle.pos : p.pos;
    const d = Math.hypot(anchor.x - c.pos.x, anchor.z - c.pos.z);
    if (d > 75 || game.inBar || p.mode === 'dead') {
      // left behind: back to her own life
      this.say(pick(['Call me!', 'Bye-bye!', 'See you around!']));
      this.dispose(true);
      return null;
    }
    // (ROADMAP 4.5) riding with you in a car, or behind you on a bike
    const v = p.inVehicle;
    const fire = v && v.dmg && v.dmg.burning;
    const canRide = v && !game.classic && (v.kind === 'car' || (v.kind === 'bike' && !v.model)) && !v.dead;
    if (this.riding) {
      if (!canRide || v !== this.ride) return this.getOut(c, p);
      if (fire) {
        // on fire: out as soon as it is slow enough, yelling till then
        if (v.speedAbs < 4) {
          this.say(pick(['FIRE!!', 'Get out! Get out!']));
          this.getOut(c, p, true);
          c.panicT = 3;
          c.fearX = v.pos.x;
          c.fearZ = v.pos.z;
          return null;
        }
        if (!this.fireSaid) {
          this.fireSaid = true;
          this.say('Stop the car! FIRE!');
        }
      }
      return this.sit(c, v, dt);
    }
    this.fireSaid = false;
    if (!(canRide && !fire && d < 16 && !this.drawing)) this.doorT = 0;
    if (canRide && !fire && d < 16 && !this.drawing) {
      // over to the door on the passenger's side (on a bike: behind it), and in
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      const side = v.kind === 'bike' ? 0 : 1;
      const back = v.kind === 'bike' ? -1.2 : v.seatOf().u;
      const half = v.kind === 'bike' ? 0.6 : (v.halfWid || 0.98) + 0.55;
      const tx = v.pos.x + fx * back - fz * half * side;
      const tz = v.pos.z + fz * back + fx * half * side;
      const dd = Math.hypot(tx - c.pos.x, tz - c.pos.z);
      if (v.speedAbs > 3) {
        // (it went without her)
        if (!this.leftT || game.time - this.leftT > 8) {
          this.leftT = game.time;
          this.say(pick(['Wait for me!', 'Hey! Without me?!', 'Rude!']));
        }
        c.faceYaw = Math.atan2(anchor.x - c.pos.x, anchor.z - c.pos.z);
        return null;
      }
      // (the door against a wall, a hydrant in the way: she climbs in over your seat)
      this.doorT = (this.doorT || 0) + dt;
      if (dd < 0.8 || (this.doorT > 6 && d < 5)) {
        this.doorT = 0;
        this.riding = true;
        this.ride = v;
        c.riding = true;
        c.noCollide = true;
        this.say(pick(RIDE_IN));
        this.rideT = 20 + Math.random() * 15;
        game.audio.play('click', 0.4);
        return this.sit(c, v, dt);
      }
      return { x: tx, z: tz, speed: dd > 3 ? 3.6 : 1.8 };
    }
    if (p.inVehicle) {
      // waits on the sidewalk, waving
      c.faceYaw = Math.atan2(anchor.x - c.pos.x, anchor.z - c.pos.z);
      return null;
    }
    // chatter
    this.talkT -= dt;
    if (this.talkT <= 0) {
      this.talkT = 25 + Math.random() * 30;
      this.say(pick(COMPANION_LINES));
    }
    // a heart drawn for you when you are hurt
    this.healT -= dt;
    if (this.healT <= 0 && !this.drawing && p.hp < p.maxHp * 0.55 && d < 4) this.drawHeart();
    // at your left, half a step behind
    const r = p.fig.right;
    const f = p.fig.forward;
    const tx = p.pos.x - r.x * 1.05 - f.x * 0.5;
    const tz = p.pos.z - r.z * 1.05 - f.z * 0.5;
    const dd = Math.hypot(tx - c.pos.x, tz - c.pos.z);
    // stuck behind something while you walk on: she catches up (somewhere you are not looking)
    this.stuckT = (this.stuckT || 0) + dt;
    if (this.stuckT > 2) {
      const moved = this.lastPos ? Math.hypot(c.pos.x - this.lastPos.x, c.pos.z - this.lastPos.z) : 9;
      if (dd > 4 && moved < 0.5 && !game.world.collision.pointInside(tx, p.pos.y + 1, tz, 0.3)) {
        // (a drawn friend: a puff of crumbs and she's beside you again)
        game.fx.crumbs(c.pos.x, c.pos.y + 1, c.pos.z, 8, 1.4);
        c.pos.x = tx;
        c.pos.z = tz;
        game.fx.crumbs(tx, p.pos.y + 1, tz, 10, 1.6);
      }
      this.stuckT = 0;
      this.lastPos = { x: c.pos.x, z: c.pos.z };
    }
    if (this.drawing || dd < 0.45) {
      c.faceYaw = this.drawing ? Math.atan2(p.pos.x - c.pos.x, p.pos.z - c.pos.z) : p.yaw;
      return null;
    }
    return { x: tx, z: tz, speed: dd > 7 ? 5.4 : dd > 2.5 ? 3.4 : 1.6 };
  }

  // in the seat beside yours (or behind you on the bike), holding on; a word now and then
  sit(c, v, dt) {
    const game = this.game;
    const fx = Math.sin(v.yaw);
    const fz = Math.cos(v.yaw);
    const bike = v.kind === 'bike';
    // (the car's seat on the passenger's side: game/traffic.js seat(), side -1)
    const S = bike ? null : v.seatOf();
    const u = bike ? -0.78 : S.u;
    const s = bike ? 0 : S.s;
    c.pos.set(v.pos.x + fx * u - fz * s, (v.pos.y || 0) + (bike ? 0.55 : S.y), v.pos.z + fz * u + fx * s);
    c.vel.set(0, 0, 0);
    c.dodgeV.set(0, 0, 0);
    c.yaw = v.yaw;
    c.faceYaw = v.yaw;
    c.baseY = bike ? 0.55 : S.y;
    c.fig.sit = 1;
    // on the bike: her hands on your waist
    if (bike) {
      const pf = game.player.fig;
      c.fig.reachR = pf.j.hipR || null;
      c.fig.reachL = pf.j.hipL || null;
    }
    this.rideT -= dt;
    if (v.air && !this.airSaid) {
      this.airSaid = true;
      this.say(pick(RIDE_AIR));
    } else if (!v.air) this.airSaid = false;
    if (v.hp !== undefined) {
      if (this.lastHp !== undefined && this.lastHp - v.hp > 4) this.say(pick(RIDE_HIT));
      this.lastHp = v.hp;
    }
    if (this.rideT <= 0) {
      this.rideT = 25 + Math.random() * 20;
      this.say(pick(RIDE_LINES));
    }
    return null;
  }

  // out on her side when you get out (or when the ride is done for)
  getOut(c, p, quiet) {
    const v = this.ride;
    this.riding = false;
    this.ride = null;
    this.lastHp = undefined;
    c.riding = false;
    c.noCollide = false;
    c.baseY = 0;
    c.fig.sit = 0;
    c.fig.reachR = null;
    c.fig.reachL = null;
    if (v) {
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      const half = v.kind === 'bike' ? 0.8 : (v.halfWid || 0.98) + 0.7;
      c.pos.set(v.pos.x - fz * half, v.pos.y || 0, v.pos.z + fx * half);
    }
    if (!quiet && (!v || !v.dead)) this.say(pick(RIDE_OUT));
    return null;
  }

  drawHeart() {
    const game = this.game;
    const c = this.c;
    const p = game.player;
    this.drawing = true;
    this.healT = 24;
    const h = c.fig.j.headC;
    const at = new THREE.Vector3((h.x + p.pos.x) / 2, h.y + 0.15, (h.z + p.pos.z) / 2);
    this.say(pick(['Hold on, I\'ve got you!', 'Here, a little love.', 'Oh no, you\'re hurt!']));
    game.airsketch.draw({
      shape: 'heart',
      at,
      size: 0.5,
      author: c,
      pen: 'magicPencil',
      target: p.fig.center.clone(),
      targetScale: 0.3,
      dur: 1.1,
      onPlop: () => {
        this.drawing = false;
        p.hp = Math.min(p.maxHp, p.hp + 25);
        if (p.fig.holes.length) p.fig.holes.pop();
        game.hud.toast('החברה שלך ציירה לך לב: +25 חיים', 'good', 2.2);
        const at2 = p.fig.center;
        for (let i = 0; i < 3; i++) game.fx.sprite('fx_heart', at2.x + (Math.random() - 0.5) * 0.5, at2.y + 0.6 + Math.random() * 0.3, at2.z + (Math.random() - 0.5) * 0.5, { size: 0.3, grow: 0.25, life: 1.3, vy: 0.6, fadeIn: 0.1 });
      },
    });
  }

  dispose(release = false) {
    const c = this.c;
    if (!c || c.owner !== this) return;
    c.brave = false;
    if (release) this.game.civilians.release(c);
    else this.game.civilians.remove(c);
  }
}

export { SERVICES };
