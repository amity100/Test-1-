import * as THREE from 'three';
import { shopkeeperLook, civilianLook, friendLook } from './looks.js';
import { HAIR_SKETCH } from './airsketch.js';
import { BLUEPRINTS, BLUEPRINT_MORE } from './blueprints.js';
import { dampAngle } from '../core/util.js';
import { DISTRICT_NAMES, blockAt } from '../world/layout.js';
import { TOPS, BOTTOMS, SHOES, HATS, ACCS, TATTOOS, wear, armorUp, outfitOf, putOn } from './wardrobe.js';
import { PRICES, SHELF_PRICES, CASH_ONLY, fmt } from './money.js';
import { BOSS } from './properties.js';

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
  tacos: 'bag', diner: 'bag', juice: 'coffee', surf: null, boutique: 'bag', arcade: null, bar: null, cinema: 'coffee',
};
// what the shopkeeper holds while working
const TOOL = {
  pizza: 'dough', cafe: 'tray', grocery: 'apple', deli: null, bagel: 'tray', flowers: 'bouquet', books: 'book',
  icecream: 'icecream', hardware: 'broom', laundry: 'laundry', sushi: null, falafel: null, shop: 'broom', pharmacy: null,
  phones: 'phone', optics: null, gym: 'dumbbell', music: 'guitar', barber: 'scissors', lobby: null,
  friends: 'magicPencil', tacos: 'tray', diner: 'tray', juice: 'tray', surf: null, boutique: null, arcade: null, bar: 'tray', cinema: null,
};
const CALLS = {
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
};

// the hero's own look (hair, glasses, muscles) survives a reload
const HERO_KEY = 'scribble-city-hero-v1';

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
        const d = Math.hypot(s.door[0] - p.x, s.door[2] - p.z);
        if (d < 62) near.push([d - (s.stand ? 25 : 0), s]);
      }
      near.sort((a, b) => a[0] - b[0]);
      const want = new Set(near.slice(0, this.budget).map((n) => n[1]));
      for (const [id, a] of this.active) {
        const d = Math.hypot(a.shop.door[0] - p.x, a.shop.door[2] - p.z);
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
  }

  // people from the street pop into the shops
  updateErrands(dt) {
    const game = this.game;
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
    for (const a of this.active.values()) {
      const s = a.shop;
      // a shop with a room: you walk in and talk to the keeper at his counter
      const dd = a.room ? 99 : Math.hypot(s.door[0] - p.pos.x, s.door[2] - p.pos.z);
      const kp = a.keeper && a.keeper.alive && (a.open || !a.room) ? a.keeper.pos : a.home;
      const dk = Math.hypot(kp.x - p.pos.x, kp.z - p.pos.z);
      if (a.room && !a.room.inside(p.pos.x, p.pos.z, 0.2)) continue;
      const d = Math.min(dd, dk + 0.4);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (!best) return null;
    const info = svc(this.game, best.shop.kind);
    return { shop: best, label: best.open ? `E — ${best.room ? info.ask || info.verb : info.verb}` : 'החנות סגורה — המוכר ברח' };
  }

  interact() {
    const t = this.target();
    if (!t || !t.shop.open) return false;
    t.shop.talk();
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

  // the friend you drew at a stand: she walks with you
  newCompanion(x, z) {
    if (this.companion) this.companion.dispose();
    this.companion = new Companion(this, x, z);
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
SERVICES_NC.barber = { ...SERVICES.barber, offers: [...SERVICES.barber.offers, ['קעקוע מצויר', 'menu', (game, a) => a.shelf('איזה קעקוע לצייר לך על היד?', 'tattoo', TATTOOS, (it) => TATTOO_SKETCH[it.tattoo])]] };
// (ROADMAP 6.6) the stationery shops: ink, lead and rubber for every weapon you drew
SERVICES_NC.books = { ...SERVICES.books, greet: 'דיו, עופרת, מחקים ושרטוטים. מה צריך?', offers: [...SERVICES.books.offers, ['מילוי דיו, עופרת ומחקים לכל הנשק', 'book', (game) => {
  const n = game.arsenal ? game.arsenal.refill() : 0;
  game.hud.toast(n ? 'כל הנשק שציירתם מלא שוב!' : 'הכול כבר מלא. בואו כשייגמר', n ? 'good' : 'info', 2.6);
}]] };
SERVICES_NC.hardware = { ...SERVICES.hardware, offers: [...SERVICES.hardware.offers, ['אפוד מגן מכריכות של מחברות', 'vest', (game) => {
  armorUp(game);
  game.hud.toast('אפוד מגן! הוא סופג את רוב המכות והיריות עד שהוא נקרע', 'good', 3.2);
}]] };

SERVICES.arcade = { verb: 'להיכנס לארקייד', ask: 'לשחק במכונה', who: 'המכונה', greet: 'INSERT COIN — מכה אחת במכונה וקורה משהו...', offers: [['לשחק (אולי זוכים בשרטוט)', 'note', (game) => {
  const left = Object.keys(BLUEPRINTS).filter((id) => !game.album.has(id) && id !== 'tank' && id !== 'copter' && id !== 'minigun' && (!game.classic || !BLUEPRINT_MORE.includes(id)));
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
SERVICES_NC.shop = { ...SERVICES.shop, offers: [...SERVICES.shop.offers, ATM] };
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
    game.hud.toast(`ה${bp.name} כבר באלבום — לחצו ${game.touch ? 'על העיפרון ✏' : 'Q'} כדי לצייר`, 'info', 2.6);
    return;
  }
  game.album.add(id);
  game.hud.toast(`שרטוט חדש באלבום: ${bp.name}! ${game.touch ? 'העיפרון ✏' : 'Q'} — לצייר אותו באוויר`, 'good', 3.4);
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

// ------------------------------------------------------------------ one open shop
// how many people sit at the tables (or wait on the bench) when you come by
const SEATED = { cafe: 3, sushi: 2, pizza: 1, icecream: 1, barber: 1, books: 1, lobby: 1, diner: 3, bar: 3, juice: 1, tacos: 1, cinema: 2 };
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
    this.keeper = civs.spawnScripted(kx, kz, shopkeeperLook(s.kind), this);
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
    }
    // a couple of people at the cafe tables out on the sidewalk
    if (s.spots.tables) {
      const n = this.game.touch ? 1 : s.spots.tables.length;
      for (let i = 0; i < n; i++) this.seat(s.spots.tables[i]);
    }
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
    if (kind === 'barber' && R.chairs.length) this.addVisitor(null, { mode: 'chair', spot: R.chairs[0], already: true });
    const seats = shuffled(R.seats);
    const nSeat = Math.min(seats.length, touch ? Math.min(1, SEATED[kind] || 0) : SEATED[kind] || 0);
    for (let i = 0; i < nSeat; i++) this.addVisitor(null, { mode: 'seat', spot: seats[i], already: true });
    const browse = shuffled(R.browse);
    const nb = Math.min(browse.length, touch ? 1 : 2);
    for (let i = 0; i < nb; i++) this.addVisitor(null, { mode: browse[i].lift ? 'lift' : 'browse', spot: browse[i], already: true });
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
      const look = civilianLook();
      c = this.game.civilians.spawnScripted(at.x, at.z, look, this);
      c.yaw = o.already ? spot.yaw : s.face + Math.PI;
      if (o.already) c.noCollide = true;
    }
    const v = { c, spot, mode, own, phase: o.already ? 'at' : 'in', t: 0, pts: null, reachT: 1 + Math.random() * 3 };
    v.stay = mode === 'seat' ? 25 + Math.random() * 40 : mode === 'lift' ? 6 + Math.random() * 8 : 7 + Math.random() * 9;
    if (o.already) {
      v.t = Math.random() * v.stay * 0.6;
      if (mode === 'seat' || mode === 'chair') c.fig.sit = 1;
    } else {
      v.pts = [{ x: s.door[0], z: s.door[2], bell: true }, { x: R.door.x, z: R.door.z, inRoom: true }, ...R.path(R.door.x, R.door.z, spot.x, spot.z)];
    }
    if (mode === 'seat' && s.kind === 'cafe') c.fig.carry = 'coffee';
    if (mode === 'seat' && s.kind === 'books') c.fig.carry = 'book';
    if (mode === 'seat' && s.kind === 'lobby') c.fig.carry = 'newspaper';
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
      default:
        return this.atSpot(v, dt);
    }
  }

  atSpot(v, dt) {
    const c = v.c;
    const sp = v.spot;
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
      // the barber decides when the one in his chair is done
      if (v.mode === 'chair') return null;
      if (v.t > v.stay) this.leave(v);
      return null;
    }
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

  paying(v) {
    const c = v.c;
    c.faceYaw = this.paySpot.yaw;
    this.payer = v;
    if (v.t > 1.8 && !v.paid) {
      v.paid = true;
      const s = this.shop;
      const item = ITEM[s.kind];
      if (item) {
        if (item === 'bag' || item === 'bouquet') c.fig.carryL = item;
        else c.fig.carry = item;
        c.fig.bagBread = s.kind === 'bagel' || s.kind === 'deli' || s.kind === 'grocery';
        c.carryUntil = this.game.time + 50;
      }
      if (Math.random() < 0.6) this.say(this.keeper, pick(['Thank you!', 'Have a nice day!', 'Come again!', 'Enjoy!', 'Next, please!']));
    }
    if (v.t > 2.6) {
      if (this.payer === v) this.payer = null;
      if (Math.random() < 0.3) this.say(c, pick(['Thanks!', 'See ya!', 'Mmm!', 'Bye!']));
      this.leave(v);
    }
    return null;
  }

  // up from the seat, round the furniture, out of the door and back onto the sidewalk
  leave(v) {
    const c = v.c;
    const R = this.room;
    const s = this.shop;
    c.fig.reachR = null;
    c.fig.drinkT = -1;
    v.phase = 'out';
    v.t = 0;
    const side = (Math.random() - 0.5) * 2.4;
    v.pts = [...R.path(c.pos.x, c.pos.z, R.door.x, R.door.z), { x: s.door[0], z: s.door[2], bell: true, inRoom: false }, { x: s.door[0] + s.nx * 1.7 + s.rx * side, z: s.door[2] + s.nz * 1.7 + s.rz * side }];
    if (this.payer === v) this.payer = null;
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
      civ.baseY = 0.0;
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
    if (s.kind === 'cafe' && this.room.seats.length >= 2) return this.waiterInside(c, dt);
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
        const c = life.newCompanion(at.x, at.z).c;
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
    game.dialog.show(info.who, own ? 'הבוס הגיע! הכול על חשבון הבית. מה תרצו?' : info.greet, choices);
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
    // now and then somebody new at the door
    if (this.room && this.open && !this.game.touch) {
      this.newT = (this.newT === undefined ? 8 + Math.random() * 10 : this.newT) - dt;
      if (this.newT <= 0) {
        this.newT = 14 + Math.random() * 16;
        if (this.visitors.length < 4) this.addVisitor(null);
      }
    }
    if (this.lifts && this.lifts.length) this.liftLife(dt);
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
    const civs = this.game.civilians;
    const drop = (c) => {
      if (!c) return;
      if (c.owner === this) civs.remove(c);
    };
    drop(this.keeper);
    for (const c of this.extras) drop(c);
    drop(this.chairGuy);
    for (const v of this.visitors) {
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
  constructor(life, x, z) {
    this.life = life;
    this.game = life.game;
    this.c = this.game.civilians.spawnScripted(x, z, friendLook(), this);
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
