import * as THREE from 'three';
import { shopkeeperLook, civilianLook } from './looks.js';
import { HAIR_SKETCH } from './airsketch.js';
import { BLUEPRINTS } from './blueprints.js';
import { dampAngle } from '../core/util.js';
import { DISTRICT_NAMES, blockAt } from '../world/layout.js';

// The shops are open: a shopkeeper out front (tossing dough, sweeping, cutting someone's hair on
// the sidewalk, strumming a guitar), people popping in and coming back out with a pizza box or a
// coffee, and you can walk up to any door: they draw what you ask for, right there in the air.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

// what a customer comes out with
const ITEM = {
  pizza: 'pizzaBox', cafe: 'coffee', grocery: 'bag', deli: 'bag', bagel: 'bag', flowers: 'bouquet', books: 'book',
  icecream: 'icecream', hardware: 'bag', laundry: 'laundry', sushi: 'bag', falafel: 'bag', shop: 'bag', pharmacy: 'bag',
  phones: 'phone', optics: null, gym: null, music: null, barber: null,
};
// what the shopkeeper holds while working
const TOOL = {
  pizza: 'dough', cafe: 'tray', grocery: 'apple', deli: null, bagel: 'tray', flowers: 'bouquet', books: 'book',
  icecream: 'icecream', hardware: 'broom', laundry: 'laundry', sushi: null, falafel: null, shop: 'broom', pharmacy: null,
  phones: 'phone', optics: null, gym: 'dumbbell', music: 'guitar', barber: 'scissors',
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
    const d = { hair: L.hair.style !== 'none' ? L.hair : null, glasses: L.face.glasses, bulk: this.game.player.fig.bulk, maxHp: this.game.player.maxHp };
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
    if (d.glasses !== undefined) L.face.glasses = d.glasses;
    if (d.bulk) p.fig.bulk = d.bulk;
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
      for (const s of this.shops) {
        const d = Math.hypot(s.door[0] - p.x, s.door[2] - p.z);
        if (d < 62) near.push([d, s]);
      }
      near.sort((a, b) => a[0] - b[0]);
      const want = new Set(near.slice(0, this.budget).map((n) => n[1]));
      for (const [id, a] of this.active) {
        const d = Math.hypot(a.shop.door[0] - p.x, a.shop.door[2] - p.z);
        if (!want.has(a.shop) && (d > 75 || this.active.size > this.budget + 1)) {
          a.dispose();
          this.active.delete(id);
        }
      }
      for (const s of want) if (!this.active.has(s.id)) this.active.set(s.id, new OpenShop(this, s));
    }
    for (const a of this.active.values()) a.update(dt);
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
    const shops = [...this.active.values()].filter((a) => a.open && ITEM[a.shop.kind] !== undefined);
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
      const dd = Math.hypot(s.door[0] - p.pos.x, s.door[2] - p.pos.z);
      const dk = a.keeper && a.keeper.alive ? Math.hypot(a.keeper.pos.x - p.pos.x, a.keeper.pos.z - p.pos.z) : 99;
      const d = Math.min(dd, dk + 0.4);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (!best) return null;
    const info = SERVICES[best.shop.kind];
    return { shop: best, label: best.open ? `E — ${info.verb}` : 'החנות סגורה — המוכר ברח' };
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
  pizza: { verb: 'להיכנס לפיצרייה', who: 'השף ג\'ינו', greet: 'בואנה סרה! פרוסה חמה, ישר מהתנור?', offers: [['פרוסת פיצה (+35 חיים)', 'slice', heal(35, [0.95, 0.62, 0.25], 'יאמי! פיצה. +35 חיים')]] },
  cafe: { verb: 'להזמין קפה', who: 'הבריסטה', greet: 'אספרסו כפול? יעיר אותך עד מחר בבוקר.', offers: [['אספרסו כפול (ריצה מהירה ל-30 שניות)', 'cup', (game) => {
    const p = game.player;
    p.coffeeT = 30;
    p.fig.belly = Math.min(1, p.fig.belly + 0.3);
    p.fig.bellyColor = [0.42, 0.26, 0.14];
    game.hud.toast('קפאין! רצים מהר יותר ל-30 שניות', 'good', 2.6);
  }]] },
  grocery: { verb: 'לקנות במכולת', who: 'המוכר במכולת', greet: 'הכל טרי, הכל צבעוני. מה תיקח?', offers: [['תפוח אדום (+15 חיים)', 'apple', heal(15, [0.85, 0.2, 0.2])]] },
  deli: { verb: 'להזמין סנדוויץ\'', who: 'המוכר במעדנייה', greet: 'פסטרמה על לחם שיפון — הכי טוב בעיר.', offers: [['סנדוויץ\' פסטרמה (+40 חיים)', 'sandwich', heal(40, [0.8, 0.45, 0.4])]] },
  bagel: { verb: 'לקנות במאפייה', who: 'האופה', greet: 'בייגל חם, יצא עכשיו!', offers: [['בייגל (+20 חיים)', 'bagel', heal(20, [0.86, 0.66, 0.36])]] },
  icecream: { verb: 'לקנות גלידה', who: 'מוכרת הגלידה', greet: 'כדור אחד? שניים? שלושה?!', offers: [['גלידת תות (+15 חיים)', 'cone', (game) => {
    heal(15, [0.98, 0.66, 0.74])(game);
    game.inkwell.tipsy = Math.max(game.inkwell.tipsy, 0.25);
    game.hud.toast('מוח קפוא!!', 'info', 1.8);
  }]] },
  sushi: { verb: 'להזמין סושי', who: 'השף', greet: 'רולים טריים. דג משורבט, אבל טרי.', offers: [['מגש סושי (+30 חיים)', 'sushi', heal(30, [0.95, 0.5, 0.4])]] },
  falafel: { verb: 'להזמין פלאפל', who: 'המוכר', greet: 'פלאפל בפיתה, עם הכל?', offers: [['פלאפל בפיתה (+45 חיים)', 'pita', heal(45, [0.55, 0.38, 0.18])]] },
  shop: { verb: 'להיכנס לחנות', who: 'המוכר', greet: 'יש לנו הכל. כמעט הכל. מה צריך?', offers: [['מחק חדש לעיפרון', 'eraser', (game) => refillErasers(game)], ['חטיף (+10 חיים)', 'apple', heal(10, [0.6, 0.4, 0.25])]] },
  hardware: { verb: 'להיכנס לחנות כלי העבודה', who: 'המוכר בחנות', greet: 'מחקים, עפרונות, סרגלים. מה חסר לך?', offers: [['מחק חדש (כל המחקים כמו חדשים)', 'eraser', (game) => refillErasers(game)]] },
  pharmacy: { verb: 'להיכנס לבית המרקחת', who: 'הרוקחת', greet: 'נמחקת קצת? יש לי בדיוק את מה שצריך.', offers: [['תחבושת (כל החיים, וממלאת את החורים)', 'bandage', (game) => {
    const p = game.player;
    p.hp = p.maxHp;
    p.fig.holes.length = 0;
    game.hud.toast('כמו חדש!', 'good', 2);
  }]] },
  laundry: { verb: 'להיכנס למכבסה', who: 'המכבסה', greet: 'כתמי צבע? דיו? מחק? הכל יורד.', offers: [['ניקוי מהיר (מוריד כתמים וחורים, +10 חיים)', 'bandage', (game) => {
    const p = game.player;
    p.fig.paintT = 0;
    p.fig.holes.length = 0;
    p.hp = Math.min(p.maxHp, p.hp + 10);
    game.hud.toast('נקי ומגוהץ', 'good', 2);
  }]] },
  phones: { verb: 'להיכנס לחנות הטלפונים', who: 'המוכר', greet: 'רוצה להתקשר למשטרה ולהגיד שזו הייתה אזעקת שווא? אני לא שאלתי כלום.', offers: [['להתקשר (מוריד כוכב משטרה אחד)', 'phone', (game) => {
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
  optics: { verb: 'להיכנס לאופטיקה', who: 'האופטיקאית', greet: 'רואים טוב יותר — מציירים טוב יותר. איזה משקפיים?', offers: [
    ['משקפיים עגולים', 'glasses', (game) => heroLook(game, (L) => (L.face.glasses = 'round'), 'משקפיים חדשים!')],
    ['משקפי שמש', 'sunglasses', (game) => heroLook(game, (L) => (L.face.glasses = 'shades'), 'קול.')],
    ['בלי משקפיים', null, (game) => heroLook(game, (L) => (L.face.glasses = null), 'בלי משקפיים')],
  ] },
  gym: { verb: 'להיכנס לחדר הכושר', who: 'המאמן', greet: 'עשר חזרות ואתה בנאדם חדש. מוכן?', offers: [['אימון (+10 חיים מקסימליים)', 'dumbbell', (game) => {
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
  music: { verb: 'לבקש שיר מהנגן', who: 'הנגן', greet: 'יש לך בקשה?', offers: [['לבקש שיר ולרקוד', 'note', (game, a) => a.serenade(true)], ['רק להקשיב', 'note', (game, a) => a.serenade(false)]] },
  books: { verb: 'להיכנס לחנות הספרים', who: 'המוכר בחנות הספרים', greet: 'מחפש משהו? יש לי ספר מפות ישן עם כל השלטים של העיר.', offers: [['לחפש בספר את השרטוט הבא', 'book', (game) => bookHint(game)]] },
  flowers: { verb: 'להיכנס לחנות הפרחים', who: 'המוכרת', greet: 'זר בשביל מישהי מיוחדת?', offers: [['זר פרחים (אולי לבר?)', 'bouquet', (game) => {
    game.player.fig.carryL = 'bouquet';
    game.hud.toast('זר ביד. אולי מישהי בבר תשמח לקבל אותו', 'good', 2.8);
  }]] },
  barber: { verb: 'להסתפר', who: 'הספר', greet: 'שב, שב. מה עושים היום?', offers: [
    ['מוהוק', 'hair:mohawk', (game) => heroHair(game, 'mohawk')],
    ['אפרו', 'hair:afro', (game) => heroHair(game, 'afro')],
    ['קוצים', 'hair:spiky', (game) => heroHair(game, 'spiky')],
    ['פומפדור', 'hair:pompadour', (game) => heroHair(game, 'pompadour')],
    ['קוקו', 'hair:ponytail', (game) => heroHair(game, 'ponytail')],
    ['לגלח הכל', 'hair:none', (game) => heroHair(game, 'none')],
  ] },
};

const HERO_HAIR_COLORS = [[0.12, 0.1, 0.09], [0.42, 0.28, 0.16], [0.86, 0.72, 0.45], [0.75, 0.2, 0.22], [0.3, 0.45, 0.85], [0.55, 0.3, 0.75]];

function heroHair(game, style) {
  const L = game.player.fig.look;
  L.hair = { style, color: style === 'none' ? L.skin : pick(HERO_HAIR_COLORS) };
  game.streetlife.saveHero();
  game.hud.toast(style === 'none' ? 'קרחת מבריקה' : 'תספורת חדשה!', 'good', 2.2);
}

function heroLook(game, fn, text) {
  fn(game.player.fig.look);
  game.streetlife.saveHero();
  game.hud.toast(text, 'good', 2);
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
class OpenShop {
  constructor(life, shop) {
    this.life = life;
    this.game = life.game;
    this.shop = shop;
    this.alive = true;
    this.customers = 0;
    this.doorT = 0;
    this.extras = [];
    this.t = Math.random() * 10;
    this.cool = 0;
    const s = shop;
    const civs = this.game.civilians;
    this.keeper = civs.spawnScripted(s.keeper[0], s.keeper[2], shopkeeperLook(s.kind), this);
    this.keeper.yaw = s.face;
    this.keeper.fig.carry = TOOL[s.kind] || null;
    this.home = new THREE.Vector3(s.keeper[0], 0, s.keeper[2]);
    this.keeper.ctrl = (c, dt) => this.work(c, dt);
    // a couple of people at the cafe tables, someone in the barber's chair
    if (s.spots.tables) {
      const n = this.game.touch ? 1 : s.spots.tables.length;
      for (let i = 0; i < n; i++) this.seat(s.spots.tables[i]);
    }
    if (s.spots.chair) this.newCustomer(true);
  }

  get open() {
    return this.alive && this.keeper && this.keeper.alive && !this.keeper.headless && this.keeper.owner === this && this.keeper.panicT <= 0;
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

  // the barber's next customer walks up and sits down
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
    if (this.talking) {
      c.faceYaw = Math.atan2(this.game.player.pos.x - c.pos.x, this.game.player.pos.z - c.pos.z);
      fig.lookAt = this.game.player.fig.j.headC;
      if (!this.game.dialog.open && !this.drawing) {
        this.talking = false;
        fig.lookAt = null;
      }
      return null;
    }
    fig.lookAt = null;
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
        if (Math.floor(this.t * 1.6) !== Math.floor((this.t - dt) * 1.6)) {
          const j = fig.j.handR;
          this.life.notes.push({ x: j.x + (Math.random() - 0.5) * 0.3, y: j.y + 0.3, z: j.z, t: 0, s: Math.random() * 100 });
          const p = this.game.player.pos;
          const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
          if (d < 14 && Math.random() < 0.5) this.game.audio.play('strum', 0.8 * (1 - d / 14));
        }
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

  // ------------------------------------------------------------------ serving the hero
  talk() {
    const game = this.game;
    const info = SERVICES[this.shop.kind];
    if (game.time < this.cool) {
      game.dialog.show(info.who, 'רגע, רגע — עוד לא סיימתי עם ההזמנה הקודמת. תחזור עוד מעט?', null);
      return;
    }
    this.talking = true;
    const choices = info.offers.map(([label, sketch, fn]) => ({ label, fn: () => this.serve(sketch, fn) }));
    choices.push({ label: 'רק מסתכל, תודה', fn: null });
    game.dialog.show(info.who, info.greet, choices);
  }

  serve(sketch, fn) {
    const game = this.game;
    const k = this.keeper;
    const p = game.player;
    this.cool = game.time + 12;
    if (!sketch) {
      fn(game, this);
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
    if (this.chairGuy && this.chairGuy.owner === this && this.chairGuy.panicT > 0) {
      this.game.civilians.release(this.chairGuy);
      this.chairGuy = null;
    }
    if (k && k.owner === this && k.panicT > 0) {
      this.game.civilians.release(k);
      k.fig.reachR = null;
    }
  }

  draw(fr) {
    const s = this.shop;
    // the door swings open: warm light from inside
    if (this.doorT > 0) {
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
    this.extras = [];
  }
}

export { SERVICES };
