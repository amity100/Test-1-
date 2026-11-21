import { fmt } from './money.js';

import { tr } from '../core/lang.js';
// (ROADMAP 8.2, not with ?classic) Properties: four places in the city that can be yours.
//   INK CLUB        the club                            $8,000   $500 every morning
//   Star Motel      its rooms and its parking lot       $5,000   $350
//   Pixel Arcade    the arcade                          $3,000   $200
//   Bay Cafe        the café on the first boulevard     $2,000   $150
// Bought in the place itself (one more line in its dialog, game/streetlife.js) or from the phone
// ("נכסים", ui/phone.js). The takings go into the bank at eight every morning (with the clock
// stopped: every 48 minutes). At a place of yours it is all on the house and the staff know who
// the boss is; the motel keeps a room for you, for a night's sleep till the morning.

const PAY_HOUR = 8;
const STOPPED_DAY = 48 * 60; // seconds between takings with the clock stopped
export const PROPS = [
  { id: 'club', name: 'INK CLUB', kind: 'bar', he: tr('מועדון הלילה', 'Ink Club'), price: 8000, income: 500, gift: 'inkbomb' },
  { id: 'motel', name: 'Star Motel', kind: 'lobby', he: tr('המוטל והחניון שלו', 'Star Motel'), price: 5000, income: 350, gift: 'parachute' },
  { id: 'arcade', name: 'Pixel Arcade', kind: 'arcade', he: tr('הארקייד', 'Pixel Arcade'), price: 3000, income: 200, gift: 'laser' },
  { id: 'cafe', name: 'Bay Cafe', kind: 'cafe', he: tr('בית הקפה בשדרה הראשונה', 'Bay Cafe'), price: 2000, income: 150, gift: 'planes' },
];
export const BOSS = ['Hey, boss!', 'Morning, boss.', 'Good to see you, boss!', 'All quiet here, boss.', 'The boss is in!'];

export class Properties {
  constructor(game) {
    this.game = game;
    const shops = game.world.shops || [];
    this.list = [];
    for (const d of PROPS) {
      const shop = shops.find((s) => s.name === d.name && s.kind === d.kind);
      if (shop) this.list.push({ ...d, shop, x: shop.door[0], z: shop.door[2], owned: false, since: 0, paidDay: null });
    }
    this.realT = 0;
    this.stats = { bought: 0, paid: 0, slept: 0 };
  }

  of(shop) {
    return this.list.find((p) => p.shop === shop) || null;
  }

  owns(shop) {
    const p = this.of(shop);
    return !!(p && p.owned);
  }

  get owned() {
    return this.list.filter((p) => p.owned);
  }

  // ------------------------------------------------------------------ buying
  // the line in the place's own dialog (game/streetlife.js)
  offer(shop, back) {
    const p = this.of(shop);
    if (!p || p.owned) return null;
    return { label: tr(`לקנות את המקום · ${fmt(p.price)}`, `Buy the place · ${fmt(p.price)}`), fn: () => this.ask(p, back) };
  }

  ask(p, back) {
    const game = this.game;
    const M = game.money;
    const can = M.can(p.price);
    const choices = [];
    if (can) choices.push({ label: tr(`לקנות ב-${fmt(p.price)}`, `Buy for ${fmt(p.price)}`), fn: () => this.buy(p) });
    choices.push({ label: tr('לא עכשיו', 'Not now'), fn: back || null });
    const text = can ? tr(`${p.name}, ${p.he}: ${fmt(p.price)}. מכניס ${fmt(p.income)} לבנק בכל בוקר, ואצלכם הכול על חשבון הבית.`, `${p.name}, ${p.he}: ${fmt(p.price)}. Brings in ${fmt(p.income)} to the bank every morning, and here everything's on the house for you.`) : tr(`${p.name} עולה ${fmt(p.price)}, ויש לכם ${fmt(M.total)}. הוא מכניס ${fmt(p.income)} בכל בוקר.`, `${p.name} costs ${fmt(p.price)}, and you have ${fmt(M.total)}. It brings in ${fmt(p.income)} every morning.`);
    game.dialog.show(p.name, text, choices);
  }

  buy(p) {
    const game = this.game;
    const M = game.money;
    if (p.owned || !M.pay(p.price, tr(`קניתם את ${p.name}`, `You bought ${p.name}`))) return false;
    p.owned = true;
    p.since = M.day;
    p.paidDay = null;
    this.stats.bought++;
    game.audio.play('cheer', 0.6);
    game.hud.big(tr(`${p.name} שלכם!`, `${p.name} is yours!`), 2200);
    game.hud.toast(tr(`מעכשיו ${p.name} מכניס ${fmt(p.income)} לבנק בכל בוקר, ושם הכול על חשבון הבית`, `From now on ${p.name} brings in ${fmt(p.income)} to the bank every morning, and everything there is on the house`), 'good', 4);
    // (and a blueprint in a drawer of the office, ROADMAP 9.1)
    if (p.gift) game.inkwell.after(2.4, () => game.album.gift(p.gift, tr(`מהמגירה של ${p.name}`, `From ${p.name}'s drawer`)));
    return true;
  }

  // ------------------------------------------------------------------ the takings
  update(dt) {
    const own = this.owned;
    if (!own.length) return;
    const dn = this.game.daynight;
    const M = this.game.money;
    if (dn && dn.dayMin > 0) {
      if (dn.hour < PAY_HOUR) return;
      const due = own.filter((p) => p.paidDay !== M.day && M.day > p.since);
      if (due.length) this.pay(due, M.day);
      return;
    }
    // (the clock stopped: a day's takings every 48 minutes)
    this.realT += dt;
    if (this.realT >= STOPPED_DAY) {
      this.realT = 0;
      this.pay(own, null);
    }
  }

  pay(list, day) {
    const game = this.game;
    let sum = 0;
    for (const p of list) {
      p.paidDay = day;
      game.money.income(p.income, tr(`הכנסות: ${p.name}`, `Income: ${p.name}`));
      sum += p.income;
    }
    this.stats.paid += sum;
    game.hud.toast(tr(`בוקר טוב! הנכסים שלכם הכניסו ${fmt(sum)} לבנק`, `Good morning! Your properties brought ${fmt(sum)} into the bank`), 'good', 3.6);
    game.audio.play('till', 0.6);
  }

  // ------------------------------------------------------------------ the motel's room
  // a night's sleep till eight in the morning: full of life again, and saved
  sleep() {
    const game = this.game;
    if (game.police.level > 0) {
      game.hud.toast(tr('לא עכשיו: המשטרה מחפשת אתכם', 'Not now: the police are after you'), 'bad', 2.4);
      return false;
    }
    const dn = game.daynight;
    const M = game.money;
    if (dn) {
      // (past eight: the morning is tomorrow's)
      if (dn.hour >= PAY_HOUR) M.day++;
      dn.setHour(PAY_HOUR);
      M.lastHour = PAY_HOUR;
    }
    const P = game.player;
    P.hp = P.maxHp;
    this.stats.slept++;
    game.audio.play('pageflip', 0.6);
    game.hud.big(tr('בוקר טוב!', 'Good morning!'), 1800);
    if (game.saves && game.saves.canSave()) game.saves.save('auto', true);
    return true;
  }

  // ------------------------------------------------------------------ the save (game/save.js)
  save() {
    return { own: this.list.filter((p) => p.owned).map((p) => ({ id: p.id, since: p.since, paidDay: p.paidDay })), realT: Math.round(this.realT) };
  }

  load(s) {
    if (!s || !Array.isArray(s.own)) return;
    for (const o of s.own) {
      const p = this.list.find((q) => q.id === o.id);
      if (!p) continue;
      p.owned = true;
      p.since = Number.isFinite(o.since) ? o.since : 0;
      p.paidDay = Number.isFinite(o.paidDay) ? o.paidDay : null;
    }
    if (Number.isFinite(s.realT)) this.realT = s.realT;
  }
}
