import * as THREE from 'three';

// (critic round) Waiting as people wait - in the line at the till, at the till while the things are
// scanned, a moment at the corner of the street: not a statue facing the front until it is their turn
// ("standing and staring"). A beat at a time, a few seconds each and each person their own: the phone
// out and a look at it (a thumb on it), a look at the one ahead or at the cashier at work, along the
// shelves beside the line, down into the basket, a look round, at the watch; a word when the line is
// slow. waitBeat is called every frame while they wait (W: their own state, kept by the caller; o:
// who is ahead, the cashier, how long the line is - or o.till, o.street); stopWait puts it all away
// again - the phone back in the pocket, the hand and the eyes free for whatever comes next.
//
// Only what is theirs is touched: a hand already busy (a coffee, a bag in the right hand) is left as
// it is and the beat is a look instead.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SLOW = ['Come on...', 'Busy today.', 'Of course I picked the slow line.', 'Any day now...', 'Is there only one till open?', 'Every time.'];
// (how long each beat lasts, s: [shortest, longest])
const LONG = { phone: [3.5, 8], ahead: [1.2, 2.6], face: [0.8, 1.6], shelf: [1.4, 3], basket: [1, 2], round: [1.2, 2.4], watch: [1, 1.6], rest: [0.8, 2] };

export function waitBeat(game, c, W, dt, o = {}) {
  const f = c.fig;
  if (!f || c.panicT > 0 || !c.alive) return;
  const now = game.time;
  W.t = (W.t || 0) + dt;
  W.left = (W.left === undefined ? (o.street || o.till ? 0.1 + Math.random() * 0.3 : 0.4 + Math.random() * 1.6) : W.left) - dt;
  if (W.left <= 0) {
    endBeat(c, W);
    const kind = choose(c, W, o);
    const [a, b] = LONG[kind];
    W.kind = kind;
    W.left = a + Math.random() * (b - a);
    W.k = 0;
    startBeat(game, c, W, o);
    // (slow: a word about it, now and then - to nobody, or to the one behind)
    if (W.t > 14 && (o.n || 1) >= 2 && now > (W.sayT || 0) && Math.random() < 0.18) {
      W.sayT = now + 25 + Math.random() * 20;
      if (game.voices) game.voices.say(c, pick(SLOW), 'plain');
      else if (game.bubbles) game.bubbles.say(c, pick(SLOW));
    }
  }
  W.k += dt;
  const fw = f.forward;
  const rt = f.right;
  switch (W.kind) {
    case 'phone': {
      // held low in front, the head bent to it; a thumb going (the hand a little up and down)
      const h = W.hand;
      const bob = Math.sin(W.k * 7 + W.seed) * 0.006;
      h.set(c.pos.x + fw.x * 0.27 + rt.x * 0.05, c.pos.y + 1.12 + bob, c.pos.z + fw.z * 0.27 + rt.z * 0.05);
      if (f.reachR == null || f.reachR === h) f.reachR = h;
      W.look.copy(h);
      break;
    }
    case 'watch': {
      // the left wrist up before the eyes
      const h = W.hand;
      h.set(c.pos.x + fw.x * 0.3 - rt.x * 0.05, c.pos.y + 1.28, c.pos.z + fw.z * 0.3 - rt.z * 0.05);
      if (f.reachL == null || f.reachL === h) f.reachL = h;
      W.look.copy(h);
      break;
    }
    case 'face':
    case 'ahead': {
      // the one ahead (their back, their basket) or the cashier at work - following them
      const p = W.who && W.who.alive && W.who.fig && W.who.fig.j ? (W.whoHand ? W.who.fig.j.handR : W.who.fig.j.headC) : null;
      if (p) W.look.copy(p);
      break;
    }
    case 'shelf':
      // along the shelf beside the line, slowly
      W.look.set(W.ax + W.ux * Math.sin(W.k * 0.6 + W.seed) * 0.6, W.ay, W.az + W.uz * Math.sin(W.k * 0.6 + W.seed) * 0.6);
      break;
    default:
      break;
  }
  // (nothing yet before the first beat; a look nobody else has taken - null or never set - is theirs)
  if (W.kind && W.kind !== 'rest' && W.look && (f.lookAt == null || f.lookAt === W.look)) f.lookAt = W.look;
}

// the beat over: whatever it took out, back
function endBeat(c, W) {
  const f = c.fig;
  if (!f) return;
  if (W.hand && f.reachR === W.hand) f.reachR = null;
  if (W.hand && f.reachL === W.hand) f.reachL = null;
  if (W.look && f.lookAt === W.look) f.lookAt = null;
  if (W.phone && f.carry === 'phone') f.carry = W.prev || null;
  W.phone = false;
  W.who = null;
}

function startBeat(game, c, W, o) {
  const f = c.fig;
  W.hand = W.hand || new THREE.Vector3();
  W.look = W.look || new THREE.Vector3();
  W.seed = W.seed === undefined ? Math.random() * 6 : W.seed;
  if (W.kind === 'phone') {
    W.prev = f.carry;
    W.phone = true;
    f.carry = 'phone';
  } else if (W.kind === 'ahead') {
    // the one ahead in the line, else the cashier - at the hands, at work
    W.who = o.ahead || o.cashier || null;
    W.whoHand = !o.ahead && !!o.cashier;
  } else if (W.kind === 'face') {
    // (at the till: a look up at the cashier, a word's worth)
    W.who = o.cashier || null;
    W.whoHand = false;
  } else if (W.kind === 'shelf' || W.kind === 'round') {
    // a shelf beside the line (to one side, at the eyes' height or below), or a look across the shop
    const s = Math.random() < 0.5 ? -1 : 1;
    const fw = f.forward;
    const rt = f.right;
    const far = W.kind === 'round' ? 4 + Math.random() * 3 : 1.3;
    const fwd = W.kind === 'round' ? -0.5 + Math.random() : 0.2;
    W.ax = c.pos.x + rt.x * s * far + fw.x * fwd;
    W.az = c.pos.z + rt.z * s * far + fw.z * fwd;
    W.ay = c.pos.y + (W.kind === 'round' ? 1.5 : 1.0 + Math.random() * 0.4);
    W.ux = fw.x;
    W.uz = fw.z;
    W.look.set(W.ax, W.ay, W.az);
  } else if (W.kind === 'basket') {
    const h = f.j && (f.carryL ? f.j.handL : f.j.handR);
    if (h) W.look.set(h.x, h.y - 0.1, h.z);
  }
}

// what this beat is: the phone the likeliest (a hand free for it), then a look at the one ahead, the
// shelves; the basket and the watch now and then - never the same twice running
function choose(c, W, o) {
  const f = c.fig;
  const rightFree = !f.carry && !f.reachR;
  const leftFree = !f.carryL && !f.reachL;
  const opts = [];
  const add = (k, w) => {
    if (k !== W.kind) opts.push([k, w]);
  };
  // (some people are on the phone the whole time; some never take it out)
  const phoney = W.phoney === undefined ? (W.phoney = Math.random()) : W.phoney;
  if (o.till) {
    // (at the till, the things being scanned: the cashier's hands mostly, a look up at them, the
    // phone now and then)
    if (o.cashier) {
      add('ahead', 2);
      add('face', 0.6);
    }
    if (rightFree) add('phone', 0.3 * phoney + 0.05);
    add('rest', 0.35);
  } else if (o.street) {
    // (a moment at the corner of the street: the phone - the map, a message - or a look down the
    // street one way and the other, at the watch)
    if (rightFree) add('phone', 1.2 * phoney + 0.4);
    add('round', 0.9);
    if (leftFree) add('watch', 0.3);
    add('rest', 0.3);
  } else {
    if (rightFree) add('phone', 1.6 * phoney + 0.2);
    if (o.ahead || o.cashier) add('ahead', 1);
    add('shelf', 0.9);
    add('round', 0.6);
    if (f.carryL === 'basketHeld' || o.basket) add('basket', 0.5);
    if (leftFree) add('watch', 0.25);
    add('rest', 0.5);
  }
  let sum = 0;
  for (const [, w] of opts) sum += w;
  let r = Math.random() * sum;
  for (const [k, w] of opts) {
    r -= w;
    if (r <= 0) return k;
  }
  return 'rest';
}

// out of the line (their turn, a fright, gone): everything put away
export function stopWait(c, W) {
  if (!W) return;
  endBeat(c, W);
  W.kind = null;
  W.left = undefined;
  W.t = 0;
}
