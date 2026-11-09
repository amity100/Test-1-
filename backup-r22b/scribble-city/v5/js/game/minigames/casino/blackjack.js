// (v5, ROADMAP 12.8) BLACKJACK, on the table itself (a flat screen in the world, the dealer across
// it, you at its near edge, two more players beside you playing their own hands). The bet first;
// two cards each, the dealer's second face down; you take cards (hit), stop (stand) or double the bet
// for one card more; over twenty-one is lost. The dealer draws to seventeen. Blackjack pays three to
// two. The money is your own.

import { felt, text, chip, stack, card, button, inBox, shoe, sfx, GOLD } from './felt.js';

const value = (hand) => {
  let v = 0;
  let aces = 0;
  for (const c of hand) {
    const r = c.r + 1;
    if (r === 1) {
      aces++;
      v += 11;
    } else v += Math.min(10, r);
  }
  while (v > 21 && aces) {
    v -= 10;
    aces--;
  }
  return v;
};
const soft = (hand) => {
  let v = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.r === 0) aces++;
    v += Math.min(10, c.r + 1);
  }
  return aces > 0 && v + 10 <= 21;
};
const natural = (hand) => hand.length === 2 && value(hand) === 21;

export class Blackjack {
  constructor(o = {}) {
    this.o = o;
    this.title = `${o.name || 'BLACKJACK'} · בלאק ג׳ק`;
    this.help = 'רווח: לחלק / קלף · B: לעמוד · למעלה: להכפיל · בהימור: חצים לשנות · Esc לצאת';
    this.helpTouch = 'נוגעים בכפתורים שעל השולחן';
    this.pad = 'pad';
    this.pointer = true;
    this.bets = o.vip ? [100, 250, 500, 1000] : [5, 10, 25, 50, 100];
  }

  start(api) {
    this.api = api;
    this.shoe = shoe(api.rng);
    this.bi = 1;
    this.state = 'bet';
    this.t = 0;
    this.net = 0;
    this.hands = 0;
    this.msg = 'PLACE YOUR BET';
    this.me = [];
    this.dealer = [];
    this.npc = [[], []];
    this.queue = [];
  }

  result() {
    return { net: this.net, hands: this.hands };
  }

  draw1() {
    if (this.shoe.length < 30) this.shoe = shoe(this.api.rng);
    return this.shoe.pop();
  }

  deal() {
    const m = this.api.money;
    this.bet = this.bets[this.bi];
    if (m && !m.pay(this.bet, this.o.name || 'BLACKJACK')) {
      this.msg = 'NOT ENOUGH CASH';
      sfx(this.api.audio, 'lose', 0.6);
      return;
    }
    this.net -= this.bet;
    this.hands++;
    this.me = [];
    this.dealer = [];
    this.npc = [[], []];
    this.doubled = false;
    this.outcome = null;
    // the cards go round: the players, the dealer, again (the dealer's second face down)
    const q = [];
    for (let k = 0; k < 2; k++) {
      q.push(['npc0'], ['me'], ['npc1'], ['dealer']);
    }
    this.queue = q;
    this.dealT = 0;
    this.state = 'deal';
    sfx(this.api.audio, 'chip');
  }

  step() {
    // the next card off the shoe to whoever is next
    const [who] = this.queue.shift();
    const c = this.draw1();
    if (who === 'me') this.me.push(c);
    else if (who === 'dealer') this.dealer.push(c);
    else this.npc[who === 'npc0' ? 0 : 1].push(c);
    sfx(this.api.audio, 'card');
  }

  update(dt, inp) {
    this.t += dt;
    const tap = (b) => inp.taps.some(([x, y]) => inBox(b, x, y));
    if (this.state === 'bet') {
      if (inp.hit.has('up') || tap(this.bUp)) this.bi = Math.min(this.bets.length - 1, this.bi + 1);
      if (inp.hit.has('down') || tap(this.bDown)) this.bi = Math.max(0, this.bi - 1);
      if (inp.hit.has('a') || inp.hit.has('enter') || tap(this.bDeal)) this.deal();
      else if (inp.hit.has('b') || tap(this.bLeave)) this.api.finish(this.result());
      return;
    }
    if (this.state === 'deal' || this.state === 'npc' || this.state === 'dealer') {
      this.dealT -= dt;
      if (this.dealT > 0) return;
      this.dealT = 0.42;
      if (this.state === 'deal') {
        if (this.queue.length) return this.step();
        if (natural(this.me) || natural(this.dealer)) return this.reveal();
        this.state = 'player';
        this.msg = 'HIT OR STAND?';
        return;
      }
      if (this.state === 'npc') {
        // the others play theirs: to seventeen, as the house does
        for (const h of this.npc) {
          if (value(h) < 17) {
            h.push(this.draw1());
            sfx(this.api.audio, 'card');
            return;
          }
        }
        return this.reveal();
      }
      // the dealer draws to seventeen (stands on a soft one)
      const v = value(this.dealer);
      if (v < 17 && value(this.me) <= 21 && !natural(this.me)) {
        this.dealer.push(this.draw1());
        sfx(this.api.audio, 'card');
        return;
      }
      return this.settle();
    }
    if (this.state === 'player') {
      const canDouble = this.me.length === 2 && !this.doubled;
      if (inp.hit.has('a') || inp.hit.has('enter') || tap(this.bHit)) this.hit();
      else if (inp.hit.has('b') || tap(this.bStand)) this.stand();
      else if (canDouble && (inp.hit.has('up') || tap(this.bDouble))) this.double();
      return;
    }
    if (this.state === 'done') {
      this.doneT += dt;
      if (this.doneT > 0.8 && (inp.hit.has('a') || inp.hit.has('enter') || inp.taps.length)) {
        this.state = 'bet';
        this.msg = 'PLACE YOUR BET';
      } else if (inp.hit.has('b')) this.api.finish(this.result());
    }
  }

  hit() {
    this.me.push(this.draw1());
    sfx(this.api.audio, 'card');
    if (value(this.me) > 21) {
      this.msg = 'BUST!';
      this.stand();
    } else if (value(this.me) === 21) this.stand();
  }

  stand() {
    this.state = 'npc';
    this.dealT = 0.5;
  }

  double() {
    const m = this.api.money;
    if (m && !m.pay(this.bet, this.o.name || 'BLACKJACK')) {
      this.msg = 'NOT ENOUGH CASH TO DOUBLE';
      return;
    }
    this.net -= this.bet;
    this.bet *= 2;
    this.doubled = true;
    sfx(this.api.audio, 'chip');
    this.me.push(this.draw1());
    sfx(this.api.audio, 'card');
    this.stand();
  }

  reveal() {
    this.state = 'dealer';
    this.shown = true;
    this.dealT = 0.6;
  }

  settle() {
    const me = value(this.me);
    const de = value(this.dealer);
    let pay = 0;
    let out;
    if (me > 21) out = 'lose';
    else if (natural(this.me) && !natural(this.dealer)) {
      out = 'bj';
      pay = this.bet * 2.5;
    } else if (natural(this.dealer) && !natural(this.me)) out = 'lose';
    else if (de > 21 || me > de) {
      out = 'win';
      pay = this.bet * 2;
    } else if (me === de) {
      out = 'push';
      pay = this.bet;
    } else out = 'lose';
    if (pay) {
      pay = Math.round(pay);
      this.net += pay;
      if (this.api.money) this.api.money.earn(pay, this.o.name || 'BLACKJACK');
    }
    this.outcome = out;
    this.msg = out === 'bj' ? `BLACKJACK! +$${pay}` : out === 'win' ? `YOU WIN $${pay}` : out === 'push' ? 'PUSH - BET BACK' : de > 21 ? 'DEALER BUSTS' : 'DEALER WINS';
    if (out === 'lose' && de > 21) this.msg = 'BUST - DEALER WINS';
    sfx(this.api.audio, out === 'lose' ? 'lose' : 'win');
    this.state = 'done';
    this.doneT = 0;
    this.shown = true;
  }

  draw(g, W, H) {
    felt(g, W, H);
    // the table's printing: the arc, its words
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(W / 2, -260, 700, 0.18 * Math.PI, 0.82 * Math.PI);
    g.stroke();
    text(g, 'BLACKJACK PAYS 3 TO 2', W / 2, 300, 26, GOLD);
    text(g, 'DEALER MUST STAND ON 17', W / 2, 332, 18, 'rgba(242,193,78,0.8)');
    // the dealer's cards, across the table (the second face down until the turn is over)
    const show = this.state === 'dealer' || this.state === 'done';
    this.dealer.forEach((c, i) => card(g, W / 2 - (this.dealer.length - 1) * 48 + i * 96, 120, c, { down: i === 1 && !show, tilt: (i - 0.5) * 0.04 }));
    if (this.dealer.length && show) text(g, `${value(this.dealer)}`, W / 2, 210, 30, '#fbf8f0');
    // the two at your sides, their hands
    this.npc.forEach((h, k) => {
      const x = k === 0 ? 150 : W - 150;
      h.forEach((c, i) => card(g, x - 20 + i * 30, 430 - i * 4, c, { w: 70, h: 100, tilt: (k === 0 ? 0.2 : -0.2) + i * 0.05 }));
      if (h.length) text(g, `${value(h)}`, x, 360, 22, '#fbf8f0');
      stack(g, x, 530, k === 0 ? 25 : 10, 16);
    });
    // yours, before you
    this.me.forEach((c, i) => card(g, W / 2 - (this.me.length - 1) * 30 + i * 60, 440 - i * 6, c, { tilt: (i - 1) * 0.06 }));
    if (this.me.length) text(g, `${value(this.me)}${soft(this.me) && value(this.me) < 21 ? ' (soft)' : ''}`, W / 2 + 150, 410, 30, value(this.me) > 21 ? '#ff6b6b' : '#ffe14a');
    // your bet in its circle
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(W / 2 - 160, 470, 44, 0, Math.PI * 2);
    g.stroke();
    const showBet = this.state === 'bet' ? this.bets[this.bi] : this.bet || 0;
    if (showBet) stack(g, W / 2 - 160, 474, showBet, 22);
    text(g, `$${showBet}`, W / 2 - 160, 532, 22, '#fbf8f0');
    // the buttons painted on the felt
    this.bUp = this.bDown = this.bDeal = this.bHit = this.bStand = this.bDouble = this.bLeave = null;
    if (this.state === 'bet') {
      this.bDown = button(g, 300, 552, 56, 40, '−', this.bi > 0);
      this.bUp = button(g, 364, 552, 56, 40, '+', this.bi < this.bets.length - 1);
      this.bDeal = button(g, 440, 552, 150, 40, 'DEAL', true, true);
      this.bLeave = button(g, 610, 552, 120, 40, 'LEAVE', true);
    } else if (this.state === 'player') {
      this.bHit = button(g, 300, 552, 130, 40, 'HIT', true, true);
      this.bStand = button(g, 440, 552, 130, 40, 'STAND', true);
      this.bDouble = button(g, 580, 552, 150, 40, 'DOUBLE', this.me.length === 2 && !this.doubled);
    } else if (this.state === 'done') {
      text(g, this.api.game.touch ? 'TAP: NEXT HAND · B: LEAVE' : 'SPACE: NEXT HAND · B: LEAVE', W / 2, 572, 20, 'rgba(251,248,240,0.8)');
    }
    // the word of the moment
    const hot = this.outcome === 'win' || this.outcome === 'bj';
    text(g, this.msg, W / 2, 258, hot ? 40 : 30, hot ? '#ffe14a' : '#fbf8f0');
    const cash = this.api.money ? Math.floor(this.api.money.cash) : 0;
    text(g, `CASH $${cash}`, 90, 24, 20, GOLD);
    void chip;
  }
}

// the tables' faces when nobody of yours plays: a hand dealt, the chips out (for the hall)
export function paintBlackjackIdle(g, w, h, t) {
  g.save();
  g.scale(w / 1000, h / 600);
  felt(g, 1000, 600);
  g.strokeStyle = GOLD;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(500, -260, 700, 0.18 * Math.PI, 0.82 * Math.PI);
  g.stroke();
  text(g, 'BLACKJACK PAYS 3 TO 2', 500, 300, 26, GOLD);
  const k = Math.floor(t / 4) % 3;
  const hands = [[{ r: 0, s: 0 }, { r: 12, s: 1 }], [{ r: 9, s: 2 }, { r: 6, s: 3 }], [{ r: 4, s: 1 }, { r: 10, s: 0 }]];
  card(g, 452, 120, hands[(k + 1) % 3][0]);
  card(g, 548, 120, null, { down: true });
  [180, 500, 820].forEach((x, i) => {
    const hd = hands[(i + k) % 3];
    hd.forEach((c, j) => card(g, x - 20 + j * 34, 440 - j * 4, c, { w: 74, h: 104, tilt: (j - 0.5) * 0.1 }));
    stack(g, x - 90, 470, [25, 50, 10][i], 18);
  });
  g.restore();
}
