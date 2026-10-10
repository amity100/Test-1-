import { angleDiff } from '../core/util.js';

// (ROADMAP 6.4, not with ?classic) Getting away. The police see what is in front of them and in
// their line of sight (game/enemies.js; their cars too, now: in front of them, and all round up
// close). And what they look for while they search is what they saw last:
//   - in a car: that car, in its colour; on foot: what you wear
//   - in another car (or out of it, or the same car in a new colour), or in other clothes (the
//     boutique, the barber), they only know you from close by (10 m), and give up sooner
//   - a new colour at the body shop while they search: they lose you altogether
// The minimap shows where they are looking: each officer's eyes, each police car's, the
// helicopter's light (ui/hud.js).

const NEAR = 10; // in a disguise they only know you from this close (metres)
const FASTER = 1.6; // and give up the search this much sooner
const CAR_EYES = 1.3; // a police car sees in front of it (radians either side), and all round up close
const CAR_RANGE = 45; // (game/police.js)

const TOLD = {
  car: 'רכב אחר: הם מחפשים את הרכב הקודם, וקשה להם לזהות אתכם',
  paint: 'צבע חדש: הם לא מזהים את הרכב',
  foot: 'ברגל: הם מחפשים רכב, וקשה להם לזהות אתכם',
  look: 'בגדים אחרים: קשה להם לזהות אתכם',
};

function paintKey(v) {
  const c = v.color || (v.stock && v.stock.color);
  return c ? c.map((x) => x.toFixed(2)).join(',') : '';
}

function lookKey(L) {
  const top = L.wornTop || L.top;
  const hat = L.hat;
  const hair = L.hair;
  return JSON.stringify([top && top.kind, top && top.color, L.bottom && L.bottom.kind, L.bottom && L.bottom.color, L.shoes, hat && hat.kind, hat && hat.color, hair && hair.style, hair && hair.color, L.acc]);
}

export class Lose {
  constructor(game) {
    this.game = game;
    this.known = { car: null, paint: '', look: '' };
    this.disguised = false;
    this.why = null;
    this.told = null;
    this.seenAt = -1;
    this.recT = 0;
    this.checkT = 0;
    this.stats = { disguises: 0, sprayed: 0 };
  }

  // what they saw: the car, its colour, the clothes
  record() {
    const p = this.game.player;
    const v = p.inVehicle;
    const K = this.known;
    K.car = v || null;
    K.paint = v ? paintKey(v) : '';
    K.look = lookKey(p.fig.look);
  }

  update(dt) {
    const P = this.game.police;
    if (!P.hostile) {
      this.disguised = false;
      this.why = null;
      this.told = null;
      return;
    }
    // a sighting (an officer, a police car, the helicopter, a witness: game/police.js seenT) - what
    // they saw is what they will look for
    this.recT -= dt;
    if (P.seenT !== this.seenAt && (this.recT <= 0 || this.disguised)) {
      this.seenAt = P.seenT;
      this.recT = 0.5;
      this.record();
      this.disguised = false;
      this.why = null;
      this.told = null;
    }
    // while they search: are you still what they look for?
    if (!P.searching) {
      this.disguised = false;
      this.why = null;
      return;
    }
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 0.25;
    const p = this.game.player;
    const v = p.inVehicle;
    const K = this.known;
    let why = null;
    if (v) {
      if (v !== K.car) why = 'car';
      else if (paintKey(v) !== K.paint) why = 'paint';
    } else if (K.car) why = 'foot';
    else if (lookKey(p.fig.look) !== K.look) why = 'look';
    this.disguised = !!why;
    this.why = why;
    if (why && why !== this.told) {
      this.told = why;
      this.stats.disguises++;
      this.game.hud.toast(TOLD[why], 'good', 2.6);
    }
  }

  get near() {
    return NEAR;
  }

  // the search runs out sooner in a disguise (game/police.js)
  get searchMul() {
    return this.disguised ? FASTER : 1;
  }

  // a police car's eyes (game/police.js)
  carSees(c, pp, d) {
    if (this.disguised && d > NEAR) return false;
    if (d < 8) return true;
    return Math.abs(angleDiff(c.yaw, Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z))) < CAR_EYES;
  }

  // a new colour at the body shop (game/garage.js): while they search, they lose you
  repainted() {
    const game = this.game;
    const P = game.police;
    if (!P.hostile || !P.searching) return false;
    P.clear();
    this.stats.sprayed++;
    game.hud.toast('צבע חדש, והמשטרה איבדה את העקבות', 'good', 2.8);
    return true;
  }
}

// the minimap (ui/hud.js), while they search: where they are looking - each officer's eyes, each
// police car's (only up close while you are in a disguise), the helicopter's light
export function drawSight(game, g, p) {
  const P = game.police;
  if (!P || !P.hostile) return;
  const L = game.lose;
  const near = L && L.disguised ? NEAR : 0;
  g.save();
  if (P.searching) {
    g.fillStyle = 'rgba(60, 120, 255, 0.32)';
    for (const e of game.enemies.list) {
      if (e.faction !== 'police' || !e.alive || e.headless) continue;
      const dx = e.pos.x - p.x;
      const dz = e.pos.z - p.z;
      if (dx * dx + dz * dz > 90 * 90) continue;
      const half = e.state === 'combat' ? 2.4 : e.state === 'patrol' || e.state === 'return' ? 1.2 : 1.6;
      wedge(g, dx, dz, e.yaw, half, near || Math.min(e.cfg.sight || 30, 32));
    }
    for (const c of game.traffic.list) {
      if (!c.police || c.mode !== 'pursuit') continue;
      const dx = c.pos.x - p.x;
      const dz = c.pos.z - p.z;
      if (dx * dx + dz * dz > 120 * 120) continue;
      wedge(g, dx, dz, c.yaw, CAR_EYES, near || CAR_RANGE);
    }
  }
  const H = game.heli;
  if (H && H.on) {
    g.fillStyle = 'rgba(255, 226, 110, 0.45)';
    g.beginPath();
    g.arc(H.spot.x - p.x, H.spot.z - p.z, 6.5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function wedge(g, x, z, yaw, half, r) {
  const a = Math.PI / 2 - yaw;
  g.beginPath();
  g.moveTo(x, z);
  g.arc(x, z, r, a - half, a + half);
  g.closePath();
  g.fill();
}
