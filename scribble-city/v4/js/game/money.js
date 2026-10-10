import { groundHeight } from '../world/layout.js';

// (ROADMAP 8.1, not with ?classic) Money.
//   - the wallet and the bank: the cash in your pockets is on the HUD, the bank (PAPERTRUST, "your
//     savings - never erased") in the phone. You pay with cash, and with the card for what the
//     cash does not cover; the arcade's machine, a tip for the musician and the friends' stand
//     take cash only.
//   - the ATMs: in the convenience stores and the hotels' lobbies (game/streetlife.js); the city's
//     map says where (ui/citymap.js)
//   - the prices: every shop's offers (PRICES here, game/streetlife.js), the service station
//     (game/garage.js)
//   - what comes in: the cash a fallen gang member drops (walk over it), a shop's thanks for a
//     robber stopped (game/events.js), a car sold to the body shop (one a day, game/garage.js)
//   - what goes out: half the cash in your pockets when you are erased (what is in the bank is
//     kept), a fine when you are busted (game/arrest.js)

const START = { cash: 120, bank: 500 };
const LOG = 12; // the phone's list of what came in and went out
const DROPS = 16;
const TAKE_R = 1.25;
const BILL = [0.42, 0.72, 0.42];
const BILL_EDGE = [0.12, 0.36, 0.18];
const RING = [0.95, 0.75, 0.2];

// what the shops ask (their offers in order, game/streetlife.js); a function asks only when there
// is something to pay for. 0: free.
export const PRICES = {
  pizza: [4],
  cafe: [3],
  grocery: [1],
  deli: [9],
  bagel: [2],
  icecream: [4],
  sushi: [14],
  falafel: [7],
  tacos: [8],
  diner: [11, 6],
  juice: [5],
  shop: [3, 2, 25],
  hardware: [4, 60, 45, 90],
  pharmacy: [20, 25],
  laundry: [6],
  phones: [(g) => (g.police.level > 0 ? 50 * g.police.level : 0)],
  optics: [30, 25, 0],
  gym: [(g) => (g.player.maxHp >= 150 ? 0 : 15)],
  music: [5, 0],
  books: [3, (g) => (g.arsenal && g.arsenal.wants() ? 20 : 0)],
  flowers: [12],
  barber: [15, 15, 15, 15, 15, 8],
  surf: [120, 35, 25],
  arcade: [1],
  bar: [9, 0],
  cinema: [5],
  friends: [(g) => (g.streetlife.companion && g.streetlife.companion.alive ? 0 : 15)],
  lobby: [0, 0],
};
// a shelf's things (the wardrobe, ROADMAP 5.7); taking something off is free
export const SHELF_PRICES = { top: 30, bottom: 35, shoes: 45, hat: 20, acc: 25, tattoo: 45 };
// cash only
export const CASH_ONLY = new Set(['arcade', 'music', 'friends']);
// where there is an ATM
export const ATM_KINDS = new Set(['shop', 'lobby']);

export const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

export class Money {
  constructor(game) {
    this.game = game;
    this.cash = START.cash;
    this.bank = START.bank;
    this.log = [];
    this.drops = [];
    this.stats = { spent: 0, earned: 0, found: 0, lost: 0, withdrawn: 0, deposited: 0, refused: 0 };
    // (the days gone by, for the body shop's one car a day: game/garage.js)
    this.day = 0;
    this.lastHour = undefined;
    this.soldDay = null;
    this.soldT = -Infinity;
    this.el = document.getElementById('money');
    this.cashEl = document.getElementById('money-cash');
    if (this.el) this.el.classList.remove('hidden');
    this.render();
  }

  get total() {
    return this.cash + this.bank;
  }

  // ------------------------------------------------------------------ paying
  // what an offer costs (a number, or a function of the game: see PRICES)
  priceOf(p) {
    const n = typeof p === 'function' ? p(this.game) : p;
    return Math.max(0, Math.round(n || 0));
  }

  can(n, cashOnly = false) {
    return n <= 0 || this.cash + (cashOnly ? 0 : this.bank) >= n;
  }

  // the cash first, the card for the rest; false (and nothing paid) when there is not enough
  pay(n, what, cashOnly = false) {
    n = Math.round(n);
    if (n <= 0) return true;
    if (!this.can(n, cashOnly)) {
      this.stats.refused++;
      return false;
    }
    const c = Math.min(this.cash, n);
    this.cash -= c;
    const card = n - c;
    this.bank -= card;
    this.stats.spent += n;
    this.note(what, -n, card > 0 ? 'כרטיס' : 'מזומן');
    this.float(-n);
    this.game.audio.play('till', 0.55);
    return true;
  }

  // why it could not be paid, and what to do (the shop's dialog)
  why(n, cashOnly = false) {
    if (cashOnly && this.cash < n && this.cash + this.bank >= n) return `רק מזומן! יש לכם ${fmt(this.cash)} בכיס. בכספומט אפשר למשוך מהבנק.`;
    return `אין לכם מספיק כסף: זה עולה ${fmt(n)}, ויש לכם ${fmt(this.total)}.`;
  }

  // the shop's answer when it cannot be paid: and a way to the nearest ATM
  refuse(who, n, cashOnly, back) {
    const game = this.game;
    const choices = [];
    const atm = this.nearestATM();
    if (atm && cashOnly && this.cash + this.bank >= n && game.gps) {
      choices.push({
        label: `לסמן במפה את הכספומט הקרוב (${atm.name}, ${Math.round(atm.d)} מ')`,
        fn: () => {
          game.gps.set(atm.x, atm.z, `כספומט · ${atm.name}`);
          game.hud.toast('הכספומט מסומן במפה', 'info', 2);
        },
      });
    }
    choices.push({ label: back ? 'משהו אחר' : 'בסדר', fn: back || null });
    game.dialog.show(who, this.why(n, cashOnly), choices);
  }

  // ------------------------------------------------------------------ what comes in, what goes out
  earn(n, what) {
    n = Math.round(n);
    if (n <= 0) return;
    this.cash += n;
    this.stats.earned += n;
    this.note(what, n, 'מזומן');
    this.float(n);
  }

  // taken from you: the cash first, then the bank (a fine), as much as there is
  take(n, what, cashOnly = false) {
    n = Math.round(Math.min(n, this.cash + (cashOnly ? 0 : this.bank)));
    if (n <= 0) return 0;
    const c = Math.min(this.cash, n);
    this.cash -= c;
    this.bank -= n - c;
    this.stats.lost += n;
    this.note(what, -n, n - c > 0 ? 'בנק' : 'מזומן');
    this.float(-n);
    return n;
  }

  // erased: half the cash in your pockets with you; the bank keeps the rest
  onDeath() {
    return this.take(Math.floor(this.cash / 2), 'נמחק איתכם', true);
  }

  withdraw(n) {
    n = Math.round(Math.min(n, this.bank));
    if (n <= 0) return 0;
    this.bank -= n;
    this.cash += n;
    this.stats.withdrawn += n;
    this.note('משיכה בכספומט', n, 'בנק → מזומן', true);
    this.float(n);
    this.game.audio.play('till', 0.4);
    return n;
  }

  deposit(n) {
    n = Math.round(Math.min(n, this.cash));
    if (n <= 0) return 0;
    this.cash -= n;
    this.bank += n;
    this.stats.deposited += n;
    this.note('הפקדה בכספומט', n, 'מזומן → בנק', true);
    this.float(-n);
    this.game.audio.play('till', 0.4);
    return n;
  }

  note(what, n, via, move = false) {
    const g = this.game;
    this.log.unshift({ what, n, via, move, at: g.daynight ? g.daynight.clock : '' });
    if (this.log.length > LOG) this.log.length = LOG;
    this.render();
  }

  // ------------------------------------------------------------------ the ATM
  atm(back = null) {
    const game = this.game;
    const choices = [];
    for (const n of [20, 50, 100, 200]) {
      if (this.bank >= n) {
        choices.push({
          label: `למשוך ${fmt(n)}`,
          fn: () => {
            this.withdraw(n);
            this.atm(back);
          },
        });
      }
    }
    if (this.cash > 0) {
      choices.push({
        label: `להפקיד את כל המזומן (${fmt(this.cash)})`,
        fn: () => {
          this.deposit(this.cash);
          this.atm(back);
        },
      });
    }
    choices.push({ label: back ? 'חזרה' : 'סיום', fn: back });
    game.dialog.show('כספומט PAPERTRUST', `בבנק: ${fmt(this.bank)} · בכיס: ${fmt(this.cash)}`, choices);
  }

  nearestATM() {
    const game = this.game;
    const p = game.player.pos;
    let best = null;
    for (const s of game.world.shops || []) {
      if (!ATM_KINDS.has(s.kind) || s.name === 'tower') continue;
      const d = Math.hypot(s.door[0] - p.x, s.door[2] - p.z);
      if (!best || d < best.d) best = { x: s.door[0], z: s.door[2], name: s.name, d };
    }
    return best;
  }

  // ------------------------------------------------------------------ cash on the ground
  // a fallen gang member's cash (game/game.js onEnemyKilled, game/gangs.js fall)
  fromEnemy(e) {
    if (!e || e.faction !== 'gang' || e.cashDropped) return;
    e.cashDropped = true;
    const n = Math.round((e.type === 'brute' ? 14 : 5) + Math.random() * 26);
    this.drop(e.pos.x, e.pos.y + 1.0, e.pos.z, n, e.pos.y);
  }

  drop(x, y, z, n, floor = -Infinity) {
    const a = Math.random() * Math.PI * 2;
    this.drops.push({ x, y, z, vx: Math.cos(a) * 1.3, vy: 2.8, vz: Math.sin(a) * 1.3, n, t: 0, landed: false, floor, seed: Math.random() * 1000 });
    while (this.drops.length > DROPS) this.drops.shift();
  }

  // the body shop buys one car a day (or one every quarter of an hour with the clock stopped)
  canSell() {
    return this.soldDay !== this.day || this.game.time - this.soldT > 900;
  }

  sold(n, what) {
    this.soldDay = this.day;
    this.soldT = this.game.time;
    this.earn(n, what);
    this.game.audio.play('till', 0.6);
  }

  update(dt) {
    const p = this.game.player;
    const dn = this.game.daynight;
    if (dn) {
      if (this.lastHour !== undefined && dn.hour < this.lastHour - 12) this.day++;
      this.lastHour = dn.hour;
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (!d.landed) {
        const g = Math.max(groundHeight(d.x, d.z), d.floor) + 0.04;
        d.vy -= 14 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        if (d.y <= g) {
          d.y = g;
          d.landed = true;
        }
        continue;
      }
      // walk over it to take it
      if (p.mode === 'foot' && Math.abs(p.pos.y - d.y) < 1.6 && Math.hypot(p.pos.x - d.x, p.pos.z - d.z) < TAKE_R) {
        this.drops.splice(i, 1);
        this.cash += d.n;
        this.stats.found += d.n;
        this.note('מצאתם על הרצפה', d.n, 'מזומן');
        this.float(d.n);
        this.game.audio.play('coins', 0.6);
        continue;
      }
      if (d.t > 120) this.drops.splice(i, 1);
    }
  }

  // a little pile of green bills, turning slowly, a scribbled ring round it
  draw(fr) {
    const t0 = this.game.time;
    for (const d of this.drops) {
      const y = d.y + (d.landed ? 0.04 + Math.sin(d.t * 3 + d.seed) * 0.03 : 0);
      const yaw = d.seed + (d.landed ? t0 * 0.9 : d.t * 7);
      for (let i = 0; i < 3; i++) {
        const a = yaw + (i - 1) * 0.42;
        const yy = y + i * 0.03;
        const ux = Math.cos(a) * 0.21;
        const uz = Math.sin(a) * 0.21;
        const vx = -Math.sin(a) * 0.105;
        const vz = Math.cos(a) * 0.105;
        const s = d.seed + i * 13;
        for (let k = -2; k <= 2; k++) {
          const f = k / 2.6;
          fr.lineXYZ(d.x - ux + vx * f, yy, d.z - uz + vz * f, d.x + ux + vx * f, yy, d.z + uz + vz * f, BILL, 5.2, s + k, 1, 0.004, 0);
        }
        fr.lineXYZ(d.x - ux - vx, yy, d.z - uz - vz, d.x + ux - vx, yy, d.z + uz - vz, BILL_EDGE, 1.8, s + 5, 1, 0.004, 0.01);
        fr.lineXYZ(d.x - ux + vx, yy, d.z - uz + vz, d.x + ux + vx, yy, d.z + uz + vz, BILL_EDGE, 1.8, s + 6, 1, 0.004, 0.01);
        fr.lineXYZ(d.x - ux - vx, yy, d.z - uz - vz, d.x - ux + vx, yy, d.z - uz + vz, BILL_EDGE, 1.8, s + 7, 1, 0.004, 0.01);
        fr.lineXYZ(d.x + ux - vx, yy, d.z + uz - vz, d.x + ux + vx, yy, d.z + uz + vz, BILL_EDGE, 1.8, s + 8, 1, 0.004, 0.01);
        // (the middle of the bill: its oval)
        fr.lineXYZ(d.x - ux * 0.25, yy + 0.002, d.z - uz * 0.25, d.x + ux * 0.25, yy + 0.002, d.z + uz * 0.25, BILL_EDGE, 2.2, s + 9, 0.8, 0.004, 0);
      }
      if (!d.landed) continue;
      const gy = d.y - 0.02;
      const r = 0.56 + Math.sin(d.t * 3) * 0.04;
      let px = d.x + r;
      let pz = d.z;
      for (let k = 1; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 2 + d.t * 0.5;
        const nx = d.x + Math.cos(a) * r;
        const nz = d.z + Math.sin(a) * r;
        fr.lineXYZ(px, gy, pz, nx, gy, nz, RING, 2.2, k + d.seed, 0.75, 0.03, 0);
        px = nx;
        pz = nz;
      }
    }
  }

  // ------------------------------------------------------------------ the HUD
  render() {
    if (this.cashEl) this.cashEl.textContent = fmt(this.cash);
  }

  // what came in or went out, floating up from the wallet
  float(n) {
    if (!this.el || !n) return;
    const f = document.createElement('span');
    f.className = `money-float ${n > 0 ? 'in' : 'out'}`;
    f.textContent = `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
    this.el.appendChild(f);
    setTimeout(() => f.remove(), 1700);
    this.el.classList.remove('bump');
    void this.el.offsetWidth;
    this.el.classList.add('bump');
  }

  // ------------------------------------------------------------------ the save (game/save.js)
  save() {
    return { cash: this.cash, bank: this.bank, log: this.log.slice(0, LOG), day: this.day, soldDay: this.soldDay };
  }

  load(s) {
    if (!s) return;
    if (Number.isFinite(s.cash)) this.cash = Math.max(0, Math.round(s.cash));
    if (Number.isFinite(s.bank)) this.bank = Math.max(0, Math.round(s.bank));
    if (Array.isArray(s.log)) this.log = s.log.slice(0, LOG);
    if (Number.isFinite(s.day)) this.day = s.day;
    this.soldDay = Number.isFinite(s.soldDay) ? s.soldDay : null;
    this.render();
  }
}
