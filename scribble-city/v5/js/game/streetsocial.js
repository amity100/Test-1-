import * as THREE from 'three';
import { civilianLook } from './looks.js';
import { sidewalkLoop, walksNear, blockType, rightFree } from './civilians.js';
import { groundHeight } from '../world/layout.js';
import { NIGHT_CLOTHES } from './rhythm.js';
import { LINES } from './voices.js';

// (GTA IV pass) The social life of the sidewalk: what makes a street of people walking past each
// other into a street of people.
//   groups       two, three, four of them standing on the sidewalk by the buildings, out of the
//                way of the walk, turned to each other: talking in turns (each line by the next of
//                them, game/voices.js group), with their hands (Civilian.social), the others looking
//                at whoever is talking; a laugh together now and then, a sip of the coffee; after a
//                while goodbyes, a wave, and off each their own way. Who they are goes with where:
//                colleagues in suits downtown with their coffees, friends with their shopping bags
//                on the shopping streets, tourists with cameras by the hotels and the beach, the
//                young on the alleys' corners, neighbours where people live, and in the evening
//                friends dressed to go out
//   meeting      two walking towards each other know each other: a name called from a few steps
//                off and a wave, the stop, a hug or a handshake (a fist bump for the young), a few
//                lines, "Good to see you!", and on, each the way they were going
//   on the phone somebody stops to take a call: pacing up and down by the wall, the phone at the
//                ear, the other hand doing the talking; one side of the conversation; hangs up, on
//   a musician   on a shopping street in the day: a guitar, the case open in front of them with
//                the coins in it, notes floating up, a song, a bow; people passing stop in a half
//                ring to listen, clap at the end of a song, walk up and drop a coin in the case
//   home         somebody with shopping bags on a street of houses turns in at a door: up to it,
//                a hand to it, in
// Only where you are (and never popping up where you are looking). The people of a group and the
// musician are new (counted apart from the walkers, few of them: a phone has fewer); the rest are
// the street's own walkers, borrowed and given back.
// (?classic: none of it - game/crowds.js does not ask)

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const UP = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Vector3();
const _r = new THREE.Vector3();
const _f = new THREE.Vector3();
const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const CASE = [0.12, 0.1, 0.11];
const PLUSH = [0.62, 0.12, 0.2];
const COIN = [0.98, 0.8, 0.28];
const SILVER = [0.82, 0.84, 0.88];
const INK = [0.1, 0.09, 0.12];
const BAG_COLORS = [[0.95, 0.45, 0.6], [0.98, 0.97, 0.94], [0.2, 0.22, 0.26], [0.62, 0.78, 0.92], [0.86, 0.66, 0.26], [0.4, 0.68, 0.5]];
const FOOD = ['burger', 'hotdog', 'noodleBox', 'soda'];
// what can be held up to film the musician with
const FILM_WITH = new Set(['phone', 'camera']);

// (the finished ones out of a list, in place: every frame, and no new array for it)
function sweep(list, key) {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i][key]) list[n++] = list[i];
  list.length = n;
}

export class StreetSocial {
  // looks: the crowds' own (game/crowds.js): office, tourist, elder, youth, shopper
  constructor(game, looks) {
    this.game = game;
    this.looks = looks;
    this.huddles = [];
    this.meets = [];
    this.calls = [];
    this.homes = [];
    this.busker = null;
    this.flying = [];
    this.huddleT = 1;
    this.meetT = 2;
    this.meetCool = 0;
    this.callT = 5;
    this.buskT = 3;
    this.homeT = 4;
    this._cand = [];
    // (counted for the tests)
    this.stats = { huddles: 0, groupTalks: 0, mimes: 0, laughs: 0, partings: 0, meets: 0, hugs: 0, shakes: 0, bumps: 0, calls: 0, callLines: 0, busks: 0, listeners: 0, claps: 0, coins: 0, home: 0 };
  }

  get touch() {
    return !!this.game.touch;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    const now = game.time;
    const rain = game.weather && game.weather.cur ? game.weather.cur.rain || 0 : 0;
    const h = game.daynight ? game.daynight.hour : 12;
    const p = game.anchorPos();
    // new things now and then (each its own clock)
    this.huddleT -= dt;
    if (this.huddleT <= 0) {
      this.huddleT = 1.7;
      if (rain < 0.2) this.newHuddle(p, h);
    }
    this.meetT -= dt;
    if (this.meetT <= 0) {
      this.meetT = 1;
      if (now > this.meetCool && rain < 0.3) this.meetScan(now);
    }
    this.callT -= dt;
    if (this.callT <= 0) {
      this.callT = 2.5;
      this.callScan(now, rain);
    }
    this.buskT -= dt;
    if (this.buskT <= 0) {
      this.buskT = 2.5;
      this.buskScan(p, h, rain);
    }
    this.homeT -= dt;
    if (this.homeT <= 0) {
      this.homeT = 2;
      this.homeScan(now);
    }
    for (let i = 0; i < this.huddles.length; i++) this.tendHuddle(this.huddles[i], dt, p, now);
    sweep(this.huddles, 'done');
    for (let i = 0; i < this.meets.length; i++) this.tendMeet(this.meets[i], dt, p, now);
    sweep(this.meets, 'done');
    for (let i = 0; i < this.calls.length; i++) this.tendCall(this.calls[i], dt, p, now);
    sweep(this.calls, 'done');
    for (let i = 0; i < this.homes.length; i++) this.tendHome(this.homes[i], dt, now);
    sweep(this.homes, 'done');
    if (this.busker) this.tendBusker(this.busker, dt, p, now, rain);
    if (this.flying.length) {
      for (const f of this.flying) {
        f.t += dt;
        if (f.t >= f.dur) f.done = true;
      }
      sweep(this.flying, 'done');
    }
  }

  // ------------------------------------------------------------------ places
  // somewhere on the sidewalk by the buildings near p (between minD and maxD from it), out of the
  // way of the walk (the walk round a block goes 2.5 m out from its lots: this is 1.3 m nearer
  // them), away from the corners, the doors, the bus stops, the others: { x, z, ux, uz (along the
  // walk), wx, wz (towards the buildings), type }
  sideSpot(p, minD, maxD, unseen = true) {
    const game = this.game;
    const ml = game.world.mainland;
    const built = ml && ml.blocks ? new Set(ml.blocks.keys()) : null;
    const near = walksNear(p, maxD, built);
    if (!near.length) return null;
    for (let tries = 0; tries < 14; tries++) {
      const [bc, br] = near[Math.floor(Math.random() * near.length)];
      // (the island's Ocean Drive: its walk is among the cafés' tables)
      if (bc === 2) continue;
      const L = sidewalkLoop(bc, br);
      if (L.length < 4) continue;
      const k = Math.floor(Math.random() * 4);
      const a = L[k];
      const b = L[(k + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 28) continue;
      const ux = (b[0] - a[0]) / len;
      const uz = (b[1] - a[1]) / len;
      // (the walk goes round clockwise: the buildings are to its right)
      const wx = -uz;
      const wz = ux;
      // (somewhere along it at the distance asked for: from the point of it nearest you, on or back)
      const t0 = (p.x - a[0]) * ux + (p.z - a[1]) * uz;
      const t = Math.max(11, Math.min(len - 11, t0 + (Math.random() < 0.5 ? -1 : 1) * (minD + Math.random() * (maxD - minD) * 0.8)));
      const x = a[0] + ux * t + wx * 1.3;
      const z = a[1] + uz * t + wz * 1.3;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < minD || d > maxD) continue;
      if (unseen && !this.unseen(x, z)) continue;
      if (this.crowded(x, z, 10)) continue;
      if (this.byDoor(x, z, 2.4)) continue;
      return { x, z, ux, uz, wx, wz, type: blockType(bc, br), col: bc, row: br };
    }
    return null;
  }

  // nobody can see (x, z) from the camera: behind it, or far
  unseen(x, z, far = 48) {
    const cam = this.game.camera;
    const fwd = cam.getWorldDirection(_fwd);
    const dx = x - cam.position.x;
    const dz = z - cam.position.z;
    const d = Math.hypot(dx, dz) || 1;
    return d > far || (dx * fwd.x + dz * fwd.z) / d < 0.05;
  }

  // somebody of ours already there (a group, the musician, a call)
  crowded(x, z, r) {
    for (const h of this.huddles) if (Math.abs(h.x - x) < r && Math.abs(h.z - z) < r) return true;
    const b = this.busker;
    if (b && Math.abs(b.x - x) < r + 4 && Math.abs(b.z - z) < r + 4) return true;
    return false;
  }

  // in front of a shop's door (or a bus stop's bench)
  byDoor(x, z, r) {
    const w = this.game.world;
    for (const s of w.shops || []) {
      const d = s.door;
      if (!d || Math.abs(d[0] - x) > r + 2 || Math.abs(d[2] - z) > r + 2) continue;
      if (Math.hypot(d[0] - x, d[2] - z) < r) return true;
    }
    return false;
  }

  // a spot standing free (nothing there: a bin, a bench, a planter, a stoop)
  roomAt(x, z, r = 0.28) {
    const hit = this.game.world.collision.pointInside(x, 1.0, z, r);
    return !(hit && hit.alive !== false);
  }

  // ------------------------------------------------------------------ groups
  get maxHuddles() {
    const h = this.game.daynight ? this.game.daynight.hour : 12;
    const R = this.game.rhythm;
    const busy = R ? R.people : 1;
    if (this.touch) return busy > 0.6 ? 1 : 0;
    return Math.round((h > 18.5 && h < 24 ? 4 : 3) * Math.min(1, busy + 0.2));
  }

  // who stands together where (and when)
  kindFor(type, h) {
    if ((h > 19.5 || h < 2) && chance(0.7)) return 'night';
    switch (type) {
      case 'towers':
        return chance(0.75) ? 'office' : 'friends';
      case 'prom':
      case 'hotels':
      case 'plaza':
        return chance(0.5) ? 'tourists' : 'friends';
      case 'gang':
        return 'youth';
      case 'park':
      case 'west':
        return chance(0.65) ? 'neighbours' : 'friends';
      case 'market':
      case 'shops':
        return chance(0.45) ? 'shoppers' : 'friends';
      default:
        return 'friends';
    }
  }

  lookFor(kind) {
    const L = this.looks;
    switch (kind) {
      case 'office':
        return L.office();
      case 'tourists':
        return L.tourist();
      case 'youth':
        return L.youth();
      case 'neighbours':
        return chance(0.55) ? L.elder() : civilianLook({ kind: pick(['knit', 'denim', 'street', 'smart']) });
      case 'shoppers':
        return L.shopper();
      case 'night':
        return civilianLook({ kind: pick(NIGHT_CLOTHES) });
      default:
        return civilianLook();
    }
  }

  // a group out of sight near you
  newHuddle(p, h) {
    const game = this.game;
    if (game.player.inVehicle && Math.abs(game.player.inVehicle.speed || 0) > 6) return;
    if (this.huddles.length >= this.maxHuddles || (h > 1.5 && h < 7)) return;
    const s = this.sideSpot(p, 18, 52);
    if (!s) return;
    this.makeHuddle(s, this.kindFor(s.type, h));
  }

  // a group at s (a sideSpot) of this kind, n of them (2..4; a few fewer if there are many already)
  makeHuddle(s, kind, n = 0) {
    const game = this.game;
    if (!n) n = 2 + (chance(0.55) ? 1 : 0) + (chance(0.3) ? 1 : 0);
    if (this.touch) n = Math.min(n, 3);
    // (all the groups together: a dozen people at most, half that on a phone - each costs a body to
    // draw)
    let had = 0;
    for (const o of this.huddles) had += o.members.length;
    n = Math.min(n, (this.touch ? 5 : 12) - had);
    if (n < 2) return null;
    const R = n === 2 ? 0.5 : n === 3 ? 0.62 : 0.7;
    // (two face each other along the walk; three or four round a little circle)
    const a0 = Math.atan2(s.ux, s.uz) + (Math.random() - 0.5) * 0.6;
    const ang = [];
    for (let i = 0; i < n; i++) ang.push({ a: a0 + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.35, r: R * (0.9 + Math.random() * 0.2) });
    // (as near the buildings as they can stand: a wall, a stoop, a planter there - a little further
    // out on the sidewalk)
    let slots = null;
    let cx = s.x;
    let cz = s.z;
    for (const out of [0, 0.35, 0.7]) {
      cx = s.x - s.wx * out;
      cz = s.z - s.wz * out;
      slots = [];
      for (const q of ang) {
        const x = cx + Math.sin(q.a) * q.r;
        const z = cz + Math.cos(q.a) * q.r;
        if (!this.roomAt(x, z, 0.22)) {
          slots = null;
          break;
        }
        slots.push({ x, z });
      }
      if (slots) break;
    }
    if (!slots) return null;
    const civs = game.civilians;
    const H = { kind, x: cx, z: cz, s, members: [], t: 0, life: 45 + Math.random() * 80, talkT: 1 + Math.random() * 3, ex: null, phase: 'talk', partT: 0, done: false };
    for (let i = 0; i < n; i++) {
      const sl = slots[i];
      const c = civs.spawnScripted(sl.x, sl.z, this.lookFor(kind), this);
      if (c.fig.look.role) c.role = c.fig.look.role;
      if (c.role === 'elder') c.fig.hunch = 0.15 + Math.random() * 0.25;
      this.dressFor(c, kind);
      c.huddle = H;
      c.still = true;
      c.noCollide = true;
      c.hslot = sl;
      c.sway = (Math.random() - 0.5) * 0.5;
      c.sipT = 2 + Math.random() * 8;
      c.yaw = Math.atan2(s.x - sl.x, s.z - sl.z);
      c.fig.yaw = c.yaw;
      c.ctrl = (me, dt) => this.memberStep(me, H, dt);
      H.members.push(c);
    }
    this.huddles.push(H);
    this.stats.huddles++;
    return H;
  }

  // what they have in hand, standing there
  dressFor(c, kind) {
    const f = c.fig;
    const h = this.game.daynight ? this.game.daynight.hour : 12;
    const r = Math.random();
    if (kind === 'office') {
      if (h > 11.5 && h < 14.5 && r < 0.45) f.carry = pick(FOOD);
      else if (r < 0.6) f.carry = 'coffee';
      else if (r < 0.75) f.carry = 'phone';
    } else if (kind === 'tourists') {
      if (r < 0.6) f.carry = 'camera';
      else if (r < 0.75) f.carry = 'icecream';
    } else if (kind === 'shoppers') {
      f.carryL = 'shopBag';
      f.shopBagColor = pick(BAG_COLORS);
      if (r < 0.35) f.carry = 'coffee';
    } else if (kind === 'night') {
      if (r < 0.25) f.carry = 'phone';
    } else if (kind === 'youth') {
      if (r < 0.35) f.carry = 'phone';
      else if (r < 0.5) f.carry = 'soda';
    } else if (kind === 'neighbours') {
      if (r < 0.25) f.carryL = 'shopBag';
      if (f.carryL) f.shopBagColor = pick(BAG_COLORS);
    } else if (r < 0.3) f.carry = 'coffee';
  }

  // one of a group: to their place in the ring, then turned to the middle - to whoever is talking
  // - with a little weight shifted now and then, a sip of the coffee
  memberStep(me, H, dt) {
    const s = me.hslot;
    const d = Math.hypot(s.x - me.pos.x, s.z - me.pos.z);
    if (d > 0.3) return { x: s.x, z: s.z, speed: 1.1 };
    const now = this.game.time;
    const L = me.listenTo && me.listenUntil > now && me.listenTo.alive ? me.listenTo : null;
    const tx = L ? L.pos.x : H.x;
    const tz = L ? L.pos.z : H.z;
    me.faceYaw = Math.atan2(tx - me.pos.x, tz - me.pos.z) + me.sway * Math.sin(now * 0.27 + me.fig.seed);
    const f = me.fig;
    if (f.carry === 'coffee' || f.carry === 'soda' || FOOD.includes(f.carry) || f.carry === 'icecream') {
      me.sipT -= dt;
      if (me.sipT < 0 && !(me.talkUntil > now)) {
        f.drinkT = Math.min(1, -me.sipT / 1.1);
        if (me.sipT < -1.1) {
          me.sipT = 5 + Math.random() * 9;
          f.drinkT = -1;
        }
      }
    }
    return null;
  }

  tendHuddle(H, dt, p, now) {
    if (H.done) return;
    H.t += dt;
    const civs = this.game.civilians;
    const voices = this.game.voices;
    // broken up: somebody hurt, frightened, taken by something else
    for (const m of H.members) {
      if (!m.alive || m.gone || m.panicT > 0 || m.headless || m.owner !== this) {
        this.dissolve(H);
        return;
      }
    }
    const d = Math.hypot(H.x - p.x, H.z - p.z);
    if (d > 95) {
      this.dropHuddle(H);
      return;
    }
    if (H.phase === 'talk') {
      // (the rain: the goodbyes now, quickly)
      const rain = this.game.weather && this.game.weather.cur ? this.game.weather.cur.rain || 0 : 0;
      if (rain > 0.3 && H.t < H.life) {
        H.life = H.t;
        if (H.ex) {
          this.game.voices.end(H.ex);
          H.ex = null;
        }
      }
      if (H.ex && H.ex.done) {
        H.ex = null;
        H.talkT = 1.2 + Math.random() * 3.5;
        // (and a laugh, together)
        if (chance(0.35) && d < 26) this.laugh(H);
      }
      if (H.t > H.life && !H.ex) {
        H.phase = 'part';
        H.partT = 0;
        if (d < 26) {
          const order = H.members.slice();
          H.ex = voices.talk(order, pick(LINES.GROUP_BYE));
        }
        this.stats.partings++;
        return;
      }
      // now and then somebody walking past knows them and joins in; now and then one of them
      // has to go before the others
      H.joinT = (H.joinT === undefined ? 4 + Math.random() * 6 : H.joinT) - dt;
      if (H.joinT <= 0 && !H.ex) {
        H.joinT = 5 + Math.random() * 8;
        if (H.members.length < 4 && d < 45 && chance(0.5)) this.joinHuddle(H, d);
        else if (H.members.length > 2 && H.t > 25 && chance(0.18)) this.leaveHuddle(H, d);
      }
      H.talkT -= dt;
      if (!H.ex && H.talkT <= 0) {
        const cam = this.game.camera.position;
        const dc = Math.hypot(H.x - cam.x, H.z - cam.z);
        if (d < 24) {
          // each line by the next of them, starting with any one
          const k = Math.floor(Math.random() * H.members.length);
          const order = H.members.slice(k).concat(H.members.slice(0, k));
          H.ex = voices.group(order, H.kind);
          if (H.ex) this.stats.groupTalks++;
          else H.talkT = 1.5;
        } else if (dc < 46) {
          // too far to hear: still a group talking - the hands, the heads turned to the one speaking
          const m = pick(H.members);
          const life = 2 + Math.random() * 1.8;
          civs.mime(m, pick(['explain', 'beat', 'open', 'hip', 'explain']), life);
          for (const o of H.members) {
            if (o === m) continue;
            o.listenTo = m;
            o.listenUntil = now + life + 0.5;
          }
          H.talkT = life + 0.4 + Math.random() * 1.5;
          this.stats.mimes++;
        } else H.talkT = 2;
      }
      return;
    }
    // the goodbyes said: off, each their own way along the walk
    H.partT += dt;
    if (H.partT > 2.6 && !H.left) {
      H.left = true;
      for (const m of H.members) {
        civs.release(m);
        m.scripted = false;
        m.dir = chance(0.5) ? 1 : -1;
        civs.rejoin(m);
        m.idleT = 6 + Math.random() * 8;
      }
      H.done = true;
    }
  }

  // a walker passing close by stops and joins them: a place in the ring on the side they came
  // from, a hello
  joinHuddle(H, d) {
    const civs = this.game.civilians;
    let best = null;
    let bd = 4;
    for (const c of civs.list) {
      if (!civs.plain(c) || c.jog || c.convo || (c.joinedT || 0) > this.game.time) continue;
      const dd = Math.hypot(c.pos.x - H.x, c.pos.z - H.z);
      if (dd < bd && dd > 1.2) {
        bd = dd;
        best = c;
      }
    }
    if (!best) return;
    best.joinedT = this.game.time + 120;
    const a = Math.atan2(best.pos.x - H.x, best.pos.z - H.z);
    const sx = H.x + Math.sin(a) * 0.7;
    const sz = H.z + Math.cos(a) * 0.7;
    if (!this.roomAt(sx, sz, 0.22)) return;
    // (the others shuffle round a little to make room: nobody in the newcomer's place)
    for (const m of H.members) {
      if (Math.hypot(m.hslot.x - sx, m.hslot.z - sz) < 0.55) return;
    }
    best.scripted = true;
    best.owner = this;
    best.huddle = H;
    best.still = true;
    best.hslot = { x: sx, z: sz };
    best.sway = (Math.random() - 0.5) * 0.5;
    best.sipT = 4 + Math.random() * 8;
    best.ctrl = (me, dt) => this.memberStep(me, H, dt);
    H.members.push(best);
    H.life = Math.max(H.life, H.t + 25);
    this.stats.joins = (this.stats.joins || 0) + 1;
    if (d < 26) {
      best.gestNext = 'wave';
      const o = pick(H.members.filter((m) => m !== best));
      if (o) H.ex = this.game.voices.talk([best, o], pick(LINES.GROUP_JOIN));
    }
  }

  // one of them off before the others: a goodbye, a wave, away along the walk
  leaveHuddle(H, d) {
    const civs = this.game.civilians;
    const m = pick(H.members);
    if (!m || m.convo) return;
    H.members = H.members.filter((o) => o !== m);
    if (d < 26) {
      const o = pick(H.members);
      if (o) this.game.voices.talk([m, o], pick(LINES.GROUP_LEAVE));
    }
    civs.release(m);
    m.scripted = false;
    m.dir = chance(0.5) ? 1 : -1;
    civs.rejoin(m);
    m.idleT = 8;
    this.stats.leaves = (this.stats.leaves || 0) + 1;
  }

  laugh(H) {
    const civs = this.game.civilians;
    const who = pick(H.members);
    this.game.bubbles.say(who, pick(LINES.LAUGHS));
    for (const m of H.members) if (m !== who && chance(0.7)) civs.mime(m, 'laugh', 1.2 + Math.random() * 0.8);
    this.stats.laughs++;
  }

  // something happened to one of them: the rest are just people on the street again
  dissolve(H) {
    const civs = this.game.civilians;
    for (const m of H.members) {
      if (m.owner !== this) continue;
      if (m.alive && !m.gone) {
        civs.release(m);
        m.scripted = false;
        civs.rejoin(m);
      } else m.huddle = null;
    }
    if (H.ex) this.game.voices.end(H.ex);
    H.done = true;
  }

  // far from you: gone with the block
  dropHuddle(H) {
    const civs = this.game.civilians;
    if (H.ex) this.game.voices.end(H.ex);
    for (const m of H.members) if (m.owner === this) civs.remove(m);
    H.done = true;
  }

  // ------------------------------------------------------------------ people who know each other
  meetScan(now) {
    const game = this.game;
    if (this.meets.length >= (this.touch ? 1 : 2)) return;
    const civs = game.civilians;
    const cam = game.camera.position;
    const cand = this._cand;
    cand.length = 0;
    for (const c of civs.list) {
      if (!civs.plain(c) || c.jog || c.convo || c.meet || (c.metT || 0) > now || c.role === 'tourist') continue;
      const dx = c.pos.x - cam.x;
      const dz = c.pos.z - cam.z;
      if (dx * dx + dz * dz > 34 * 34) continue;
      if (Math.hypot(c.vel.x, c.vel.z) < 0.5) continue;
      cand.push(c);
    }
    for (let i = 0; i < cand.length; i++) {
      const a = cand[i];
      for (let j = i + 1; j < cand.length; j++) {
        const b = cand[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 3 || d > 11) continue;
        // coming towards each other, nearly in each other's way (the same sidewalk)
        const closing = -((b.vel.x - a.vel.x) * dx + (b.vel.z - a.vel.z) * dz) / d;
        if (closing < 1.3) continue;
        const av = Math.hypot(a.vel.x, a.vel.z) || 1;
        const lat = Math.abs(a.vel.x * dz - a.vel.z * dx) / av;
        if (lat > 2.2) continue;
        a.metT = now + 25;
        b.metT = now + 25;
        if (!chance(0.45)) continue;
        this.startMeet(a, b, now);
        this.meetCool = now + 8 + Math.random() * 14;
        return;
      }
    }
  }

  startMeet(a, b, now) {
    const voices = this.game.voices;
    const na = pick(LINES.NAMES);
    let nb = pick(LINES.NAMES);
    if (nb === na) nb = pick(LINES.NAMES);
    const young = a.role === 'youth' || b.role === 'youth';
    let greet = young ? 'bump' : pick(['hug', 'hug', 'shake', 'shake', 'wave']);
    // (a hand round a coffee shakes no hand; arms full of shopping hug nobody: a wave then)
    if (greet === 'hug' && (a.fig.carry || a.fig.carryL || b.fig.carry || b.fig.carryL)) greet = 'shake';
    if (greet !== 'wave' && greet !== 'hug' && (a.fig.carry || b.fig.carry)) greet = 'wave';
    const M = { a, b, phase: 'spot', t: 0, greet, ex: null, gt: 0, done: false, va: new THREE.Vector3(), vb: new THREE.Vector3(), mid: new THREE.Vector3() };
    a.meet = M;
    b.meet = M;
    b.gestNext = 'wave';
    // the name called a few steps off, and the answer: with a wave (Civilian.social)
    M.ex = voices.talk([a, b], [`${pick(['Hey', 'Oh hey', 'No way', 'Hey hey'])}, ${nb}!`, `${na}! Hi!`]);
    this.meets.push(M);
    this.stats.meets++;
  }

  // a and b stopped together: each to their place facing the other
  meetStep(me, M) {
    const o = me === M.a ? M.b : M.a;
    const at = me === M.a ? M.pa : M.pb;
    const d = Math.hypot(at.x - me.pos.x, at.z - me.pos.z);
    me.faceYaw = Math.atan2(o.pos.x - me.pos.x, o.pos.z - me.pos.z);
    if (d > 0.12) return { x: at.x, z: at.z, speed: 0.9 };
    return null;
  }

  // where the two stand: gap apart, either side of the middle, along the line between them
  meetPlaces(M, gap) {
    const { a, b } = M;
    const mx = (a.pos.x + b.pos.x) / 2;
    const mz = (a.pos.z + b.pos.z) / 2;
    let dx = b.pos.x - a.pos.x;
    let dz = b.pos.z - a.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    M.mx = mx;
    M.mz = mz;
    M.pa = { x: mx - dx * gap * 0.5, z: mz - dz * gap * 0.5 };
    M.pb = { x: mx + dx * gap * 0.5, z: mz + dz * gap * 0.5 };
  }

  tendMeet(M, dt, p, now) {
    if (M.done) return;
    const { a, b } = M;
    const game = this.game;
    const civs = game.civilians;
    const voices = game.voices;
    M.t += dt;
    const lost = !a.alive || !b.alive || a.gone || b.gone || a.panicT > 0 || b.panicT > 0 || Math.hypot(a.pos.x - p.x, a.pos.z - p.z) > 90;
    const ours = a.owner === this && a.meet === M && b.owner === this && b.meet === M;
    if (lost || (M.phase !== 'spot' && !ours)) {
      this.endMeet(M);
      return;
    }
    if (M.phase === 'spot') {
      // still walking towards each other; close enough: the stop
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (d < 1.9 || M.t > 5) {
        if (d > 3.2 || a.ctrl || b.ctrl || a.scripted || b.scripted) {
          this.endMeet(M);
          return;
        }
        for (const c of [a, b]) {
          c.scripted = true;
          c.owner = this;
          c.ctrl = (me) => this.meetStep(me, M);
        }
        this.meetPlaces(M, M.greet === 'hug' ? 0.5 : 0.95);
        M.phase = 'greet';
        M.t = 0;
      }
      return;
    }
    if (M.phase === 'greet') {
      const fa = a.fig;
      const fb = b.fig;
      const near = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < (M.greet === 'hug' ? 0.75 : 1.2);
      if (near && M.t < 1.9 && M.greet !== 'wave') {
        if (M.greet === 'hug') {
          // arms round each other's shoulders
          fa.reachR = fb.j.shoulderL;
          fa.reachL = fb.j.shoulderR;
          fb.reachR = fa.j.shoulderL;
          fb.reachL = fa.j.shoulderR;
          if (!M.counted) {
            M.counted = true;
            this.stats.hugs++;
          }
        } else {
          // the right hands meeting in the middle: a shake (a fist bump: up at the chest, once)
          const y = (a.pos.y + b.pos.y) / 2 + (M.greet === 'bump' ? 1.22 : 1.0) * fa.scale + (M.greet === 'shake' ? Math.sin(M.t * 17) * 0.035 : 0);
          M.mid.set(M.mx, y, M.mz);
          fa.reachR = M.mid;
          fb.reachR = M.mid;
          if (!M.counted) {
            M.counted = true;
            if (M.greet === 'shake') this.stats.shakes++;
            else this.stats.bumps++;
          }
        }
      }
      if (M.t > 1.9 || (M.greet === 'wave' && M.t > 0.6) || (!near && M.t > 3.5)) {
        this.freeHands(a, M);
        this.freeHands(b, M);
        this.meetPlaces(M, 1.0);
        M.phase = 'chat';
        M.t = 0;
        M.ex = null;
        M.rounds = chance(0.35) ? 2 : 1;
      }
      return;
    }
    if (M.phase === 'chat') {
      if (M.ex && !M.ex.done) return;
      if (M.t < 0.5) return;
      if (M.rounds > 0) {
        M.rounds--;
        const order = chance(0.5) ? [a, b] : [b, a];
        M.ex = voices.talk(order, pick(LINES.MEET));
        if (!M.ex) M.rounds = 0;
        return;
      }
      M.phase = 'bye';
      M.ex = voices.talk([a, b], pick(LINES.MEET_BYE));
      M.t = 0;
      return;
    }
    if (M.phase === 'bye' && ((M.ex && M.ex.done) || !M.ex || M.t > 7)) this.endMeet(M);
  }

  freeHands(c, M) {
    const f = c.fig;
    const o = c === M.a ? M.b : M.a;
    if (f.reachR === M.mid || f.reachR === o.fig.j.shoulderL) f.reachR = null;
    if (f.reachL === o.fig.j.shoulderR) f.reachL = null;
  }

  // on, each the way they were going
  endMeet(M) {
    if (M.done) return;
    M.done = true;
    const civs = this.game.civilians;
    const now = this.game.time;
    for (const c of [M.a, M.b]) {
      this.freeHands(c, M);
      if (c.meet === M) c.meet = null;
      c.metT = now + 120;
      if (c.owner === this) {
        if (c.alive && !c.gone) {
          civs.release(c);
          c.scripted = false;
          civs.rejoin(c);
        }
      }
    }
    if (M.ex && !M.ex.done) this.game.voices.end(M.ex);
  }

  // ------------------------------------------------------------------ on the phone
  callScan(now, rain) {
    const game = this.game;
    if (this.calls.length >= (this.touch ? 1 : 2) || rain > 0.3 || !chance(0.45)) return;
    const civs = game.civilians;
    const cam = game.camera.position;
    let best = null;
    let bs = 0;
    for (const c of civs.list) {
      if (!civs.plain(c) || c.jog || c.convo || c.meet || c.role === 'elder' || (c.calledT || 0) > now) continue;
      const f = c.fig;
      if (f.carry && f.carry !== 'phone' && f.carry !== 'coffee' && f.carry !== 'bag') continue;
      const dx = c.pos.x - cam.x;
      const dz = c.pos.z - cam.z;
      const d = Math.hypot(dx, dz);
      if (d > 30 || d < 5) continue;
      // (the ones with the phone already out, the office people first)
      const s = (f.carry === 'phone' ? 3 : 1) + (c.role === 'office' ? 1.5 : 0) + Math.random() * 2;
      if (s > bs) {
        bs = s;
        best = c;
      }
    }
    if (best) this.startCall(best, now);
  }

  startCall(c, now) {
    const civs = this.game.civilians;
    const leg = this.legOf(c);
    if (!leg) return;
    // the place by the wall to pace along (or where they stand, if that is in the way of something)
    let bx = c.pos.x + leg.wx * 0.9;
    let bz = c.pos.z + leg.wz * 0.9;
    if (!this.roomAt(bx, bz, 0.35)) {
      bx = c.pos.x;
      bz = c.pos.z;
    }
    const half = 1.1 + Math.random() * 0.6;
    const ends = [{ x: bx + leg.ux * half, z: bz + leg.uz * half }, { x: bx - leg.ux * half, z: bz - leg.uz * half }];
    if (!this.roomAt(ends[0].x, ends[0].z) || !this.roomAt(ends[1].x, ends[1].z)) {
      ends[0] = { x: bx, z: bz };
      ends[1] = { x: bx, z: bz };
    }
    const K = { c, ends, end: 0, t: 0, lines: pick(LINES.CALLS), i: 0, lineT: 0.9, pause: 0, prev: c.fig.carry, toL: false, done: false };
    c.calledT = now + 90;
    c.scripted = true;
    c.owner = this;
    c.onCall = true;
    // (the coffee, the bag into the other hand for the call: not gone into thin air)
    if (K.prev && K.prev !== 'phone' && !c.fig.carryL) {
      c.fig.carryL = K.prev;
      K.toL = true;
    }
    c.fig.carry = 'phone';
    c.ctrl = (me, dt) => this.callStep(me, K, dt);
    this.calls.push(K);
    this.stats.calls++;
  }

  // up and down by the wall, a stop now and then, turned half away
  callStep(me, K, dt) {
    K.t += dt;
    if (K.t < 0.8) return null;
    if (K.pause > 0) {
      K.pause -= dt;
      return null;
    }
    const e = K.ends[K.end];
    if (Math.hypot(e.x - me.pos.x, e.z - me.pos.z) < 0.3) {
      K.end = 1 - K.end;
      if (chance(0.45)) {
        K.pause = 1 + Math.random() * 2.5;
        me.faceYaw = me.yaw + (Math.random() - 0.5) * 2;
      }
      return null;
    }
    return { x: e.x, z: e.z, speed: 0.55 + Math.random() * 0.05 + (me.talkUntil > this.game.time ? 0.15 : 0) };
  }

  tendCall(K, dt, p, now) {
    if (K.done) return;
    const c = K.c;
    if (!c.alive || c.gone || c.panicT > 0 || c.owner !== this || !c.onCall) {
      this.endCall(K);
      return;
    }
    K.lineT -= dt;
    if (K.lineT > 0) return;
    if (K.i >= K.lines.length) {
      this.endCall(K);
      return;
    }
    const line = K.lines[K.i++];
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d < 22) {
      const life = this.game.voices.say(c, line, 'plain');
      this.stats.callLines++;
      K.lineT = life + 1.4 + Math.random() * 2.6;
    } else {
      // (out of earshot: the other hand still talking)
      this.game.civilians.mime(c, pick(['explain', 'beat', 'open', 'hip']), 2.2);
      K.lineT = 3 + Math.random() * 2.5;
    }
  }

  endCall(K) {
    if (K.done) return;
    K.done = true;
    const c = K.c;
    const civs = this.game.civilians;
    if (c.owner === this && c.alive && !c.gone) {
      // (the phone away again, unless it was out already; the coffee back in the right hand)
      if (K.toL && c.fig.carryL === K.prev) c.fig.carryL = null;
      civs.release(c);
      c.fig.carry = K.prev || null;
      c.scripted = false;
      civs.rejoin(c);
    }
    c.onCall = false;
  }

  // the side of the block somebody is walking: along it (clockwise) and towards its buildings
  legOf(c) {
    const L = c.loop;
    if (!L || L.length < 4) return null;
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      const b = L[(i + 1) % L.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((c.pos.x - a[0]) * dx + (c.pos.z - a[1]) * dz) / l2));
      const d = Math.hypot(a[0] + dx * t - c.pos.x, a[1] + dz * t - c.pos.z);
      if (d < bd) {
        bd = d;
        const l = Math.sqrt(l2);
        best = { ux: dx / l, uz: dz / l, wx: -dz / l, wz: dx / l, t: t * l, len: l };
      }
    }
    // (not at a corner: there the wall is round it)
    if (!best || bd > 2.2 || best.t < 6 || best.t > best.len - 6) return null;
    return best;
  }

  // ------------------------------------------------------------------ the musician
  buskScan(p, h, rain) {
    const game = this.game;
    const B = this.busker;
    if (B) return;
    if (h < 10 || h > 21.5 || rain > 0.08 || game.player.inVehicle) return;
    const s = this.sideSpot(p, 16, 46);
    if (!s || !['shops', 'market', 'plaza', 'hotels', 'towers', 'prom'].includes(s.type)) return;
    this.startBusker(s);
  }

  // the musician at s (a sideSpot)
  startBusker(s) {
    const game = this.game;
    // facing out, a little along the walk; the case on the ground in front, the half ring of
    // places to stand and listen beyond it (the ones that are free)
    const side = chance(0.5) ? 1 : -1;
    const fx = -s.wx * 0.85 + s.ux * side * 0.5;
    const fz = -s.wz * 0.85 + s.uz * side * 0.5;
    const fl = Math.hypot(fx, fz);
    const yaw = Math.atan2(fx / fl, fz / fl);
    let x = s.x + s.wx * 0.35;
    let z = s.z + s.wz * 0.35;
    if (!this.roomAt(x, z, 0.35)) {
      x = s.x - s.wx * 0.1;
      z = s.z - s.wz * 0.1;
      if (!this.roomAt(x, z, 0.35)) return null;
    }
    const f = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const r = { x: -f.z, z: f.x };
    const caseAt = { x: x + f.x * 0.8 + r.x * 0.25, z: z + f.z * 0.8 + r.z * 0.25 };
    const ring = [];
    for (let i = 0; i < 7; i++) {
      const a = yaw + (i - 3) * 0.38;
      const rr = 2.3 + (i % 2) * 0.55;
      const sx = x + Math.sin(a) * rr;
      const sz = z + Math.cos(a) * rr;
      if (this.roomAt(sx, sz)) ring.push({ x: sx, z: sz, who: null });
    }
    if (ring.length < 3) return null;
    const civs = game.civilians;
    const look = civilianLook({ kind: pick(['street', 'denim', 'knit', 'smart']) });
    look.hat = chance(0.6) ? { kind: pick(['beanie', 'bucket', 'beret', 'cap']), color: pick([[0.12, 0.12, 0.14], [0.75, 0.18, 0.2], [0.36, 0.4, 0.3], [0.86, 0.66, 0.26]]) } : look.hat;
    const c = civs.spawnScripted(x, z, look, this);
    c.fig.carry = 'guitar';
    c.still = true;
    c.noCollide = true;
    c.yaw = yaw;
    c.fig.yaw = yaw;
    const Bk = { c, x, z, yaw, f, r, caseAt, gy: groundHeight(caseAt.x, caseAt.z), ring, coins: Math.floor(Math.random() * 5) + 2, phase: 'play', t: 0, songT: 24 + Math.random() * 14, noteT: 0, strumT: 0, singT: 3, recruitT: 1.5, crowd: [], done: false };
    c.ctrl = (me) => {
      me.faceYaw = Bk.yaw + Math.sin(this.game.time * 0.4) * 0.12;
      return null;
    };
    this.busker = Bk;
    this.stats.busks++;
    return Bk;
  }

  // (for the tests) the spot on the sidewalk by the buildings of the walk round block (col, row) at
  // the point of it nearest (x, z)
  spotAt(col, row, x, z) {
    const L = sidewalkLoop(col, row);
    let best = null;
    let bd = Infinity;
    for (let k = 0; k < L.length; k++) {
      const a = L[k];
      const b = L[(k + 1) % L.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / len;
      const uz = (b[1] - a[1]) / len;
      const t = Math.max(0, Math.min(len, (x - a[0]) * ux + (z - a[1]) * uz));
      const px = a[0] + ux * t;
      const pz = a[1] + uz * t;
      const d = Math.hypot(px - x, pz - z);
      if (d < bd) {
        bd = d;
        best = { x: px - uz * 1.3, z: pz + ux * 1.3, ux, uz, wx: -uz, wz: ux, type: blockType(col, row), col, row };
      }
    }
    return best;
  }

  tendBusker(B, dt, p, now, rain) {
    const game = this.game;
    const civs = game.civilians;
    const c = B.c;
    const d = Math.hypot(B.x - p.x, B.z - p.z);
    if (!c.alive || c.gone || c.owner !== this || c.panicT > 0 || d > 95 || rain > 0.25) {
      this.dropBusker(B, d > 95 || !c.alive || c.gone);
      return;
    }
    B.t += dt;
    const cam = game.camera.position;
    const dc = Math.hypot(B.x - cam.x, B.z - cam.z);
    if (B.phase === 'play') {
      c.fig.hunch = Math.max(0, c.fig.hunch - dt * 2);
      // the notes floating up, the strings (heard near)
      B.noteT -= dt;
      if (B.noteT <= 0 && dc < 45 && game.streetlife && game.streetlife.notes) {
        B.noteT = 0.45 + Math.random() * 0.4;
        const j = c.fig.j.handR;
        game.streetlife.notes.push({ x: j.x + (Math.random() - 0.5) * 0.4, y: j.y + 0.35 + Math.random() * 0.3, z: j.z + (Math.random() - 0.5) * 0.4, t: 0, s: Math.random() * 100 });
      }
      B.strumT -= dt;
      if (B.strumT <= 0) {
        B.strumT = 0.62;
        if (d < 18) game.audio.play('strum', 0.75 * (1 - d / 18));
      }
      B.singT -= dt;
      if (B.singT <= 0) {
        B.singT = 6 + Math.random() * 6;
        if (d < 24) {
          c.gestNext = 'none';
          game.bubbles.say(c, pick(LINES.LYRICS));
        }
      }
      if (B.t > B.songT) {
        // the end of a song: a bow, "Thank you!", the claps, a coin or two
        B.phase = 'bow';
        B.t = 0;
        c.fig.hunch = 0.7;
        if (d < 26) {
          c.gestNext = 'none';
          game.voices.say(c, pick(LINES.BUSK_SAY), 'plain');
        }
        for (const a of B.crowd) {
          if (a.owner !== this || !a.at) continue;
          civs.mime(a, 'clap', 1.4 + Math.random() * 0.8);
          this.stats.claps++;
          // (a coin from a free hand: not with the shopping bag hanging from it)
          if (!a.tipped && chance(0.4) && rightFree(a.fig)) a.tipNow = 0.6 + Math.random() * 1.6;
        }
        if (B.crowd.length && d < 30) game.audio.play('cheer', Math.min(0.5, 0.12 * B.crowd.length) * (1 - d / 30));
      }
    } else if (B.t > 3.2) {
      B.phase = 'play';
      B.t = 0;
      B.songT = 22 + Math.random() * 16;
      c.fig.hunch = 0;
    } else if (B.t > 1.2) c.fig.hunch = Math.max(0, 0.7 - (B.t - 1.2) * 1.2);
    // the people passing who stop to listen
    B.recruitT -= dt;
    if (B.recruitT <= 0) {
      B.recruitT = 1.8 + Math.random() * 2;
      if (B.crowd.length < (this.touch ? 3 : 5) && B.phase === 'play') this.recruit(B, now);
    }
    for (const a of B.crowd) this.tendListener(B, a, dt, now, d);
    sweep(B.crowd, 'listenDone');
  }

  // somebody walking past stops to listen (a place in the half ring)
  recruit(B, now) {
    const civs = this.game.civilians;
    const slot = B.ring.find((s) => !s.who || !s.who.alive || s.who.owner !== this || s.who.listenDone);
    if (!slot) return;
    let best = null;
    let bd = 15;
    for (const c of civs.list) {
      if (!civs.plain(c) || c.jog || c.convo || c.meet || (c.listenedT || 0) > now) continue;
      const dd = Math.hypot(c.pos.x - B.x, c.pos.z - B.z);
      if (dd < bd && dd > 2) {
        bd = dd;
        best = c;
      }
    }
    if (!best) return;
    best.listenedT = now + 120;
    if (!chance(0.6)) return;
    best.scripted = true;
    best.owner = this;
    best.at = false;
    best.tipped = false;
    best.tipNow = 0;
    best.listenDone = false;
    best.stayT = 14 + Math.random() * 26;
    best.bslot = slot;
    slot.who = best;
    // (one films it: with the phone, or the tourist's camera - not with a coffee or a bag held up)
    best.filmT = chance(0.2) && (!best.fig.carry || FILM_WITH.has(best.fig.carry)) ? 3 + Math.random() * 5 : 0;
    best.ctrl = (me) => this.listenStep(me, B);
    B.crowd.push(best);
    this.stats.listeners++;
  }

  listenStep(me, B) {
    const s = me.bslot;
    // dropping a coin in the case: over to it, a bend, a reach down
    if (me.tipping) {
      // (in front of the case, on the far side from the musician)
      const tx = B.caseAt.x + B.f.x * 0.55;
      const tz = B.caseAt.z + B.f.z * 0.55;
      if (!me.tipping.bent && Math.hypot(tx - me.pos.x, tz - me.pos.z) > 0.25) return { x: tx, z: tz, speed: 1.0 };
      me.faceYaw = Math.atan2(B.caseAt.x - me.pos.x, B.caseAt.z - me.pos.z);
      return null;
    }
    if (Math.hypot(s.x - me.pos.x, s.z - me.pos.z) > 0.3) return { x: s.x, z: s.z, speed: me.speed };
    me.at = true;
    me.faceYaw = Math.atan2(B.x - me.pos.x, B.z - me.pos.z);
    return null;
  }

  tendListener(B, a, dt, now, d) {
    if (a.listenDone) return;
    if (!a.alive || a.gone || a.owner !== this || a.panicT > 0) {
      this.letListenerGo(B, a, a.owner === this);
      return;
    }
    const f = a.fig;
    // the head to the music
    if (a.at && !a.tipping) {
      if (!f.lookAt || f.lookAt === B.c.fig.j.headC) f.lookAt = B.c.fig.j.headC;
      a.stayT -= dt;
      // (one films it, the phone held up)
      if (a.filmT > 0) {
        a.filmT -= dt;
        if (!a.film) a.film = new THREE.Vector3();
        if (!f.carry) {
          f.carry = 'phone';
          a.filmPhone = true;
        }
        f.toWorld(0.07, 1.47, 0.34, a.film);
        if (!f.reachR || f.reachR === a.film) f.reachR = a.film;
        if (a.filmT <= 0 && f.reachR === a.film) f.reachR = null;
      }
      if (a.tipNow > 0) {
        a.tipNow -= dt;
        if (a.tipNow <= 0) a.tipping = { t: 0, bent: false };
      } else if (a.stayT <= 0 && B.phase === 'play') {
        this.letListenerGo(B, a, true);
        return;
      } else if (a.sayT === undefined) a.sayT = 4 + Math.random() * 10;
      else if ((a.sayT -= dt) <= 0) {
        a.sayT = 1e9;
        if (d < 20 && chance(0.5)) this.game.bubbles.say(a, pick(LINES.LISTEN_SAY));
      }
    }
    if (a.tipping) {
      const t = a.tipping;
      const tx = B.caseAt.x + B.f.x * 0.55;
      const tz = B.caseAt.z + B.f.z * 0.55;
      if (Math.hypot(tx - a.pos.x, tz - a.pos.z) < 0.3 || t.bent) {
        t.bent = true;
        t.t += dt;
        f.crouch = Math.min(0.55, t.t * 1.6);
        if (!a.hand) a.hand = new THREE.Vector3();
        a.hand.set(B.caseAt.x, B.gy + 0.25, B.caseAt.z);
        if (f.reachR === a.film) f.reachR = null;
        if (!f.reachR || f.reachR === a.hand) f.reachR = a.hand;
        if (t.t > 0.6 && !t.dropped) {
          t.dropped = true;
          const j = f.j.handR;
          this.flying.push({ x0: j.x, y0: j.y, z0: j.z, x1: B.caseAt.x + (Math.random() - 0.5) * 0.3, z1: B.caseAt.z + (Math.random() - 0.5) * 0.1, y1: B.gy + 0.1, t: 0, dur: 0.45, B });
          B.coins++;
          this.stats.coins++;
          const p = this.game.player.pos;
          if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 18) {
            this.game.audio.play('coins', 0.35);
            if (chance(0.6)) this.game.bubbles.say(a, pick(LINES.TIP_SAY));
          }
        }
        if (t.t > 1.3) {
          f.crouch = 0;
          if (f.reachR === a.hand) f.reachR = null;
          a.tipping = null;
          a.tipped = true;
          // (a nod from the musician)
          if (d < 20 && chance(0.5)) {
            B.c.gestNext = 'none';
            this.game.bubbles.say(B.c, pick(['Thank you!', 'Thanks!', 'Bless you!']));
          }
          if (chance(0.5)) {
            this.letListenerGo(B, a, true);
            return;
          }
          a.at = false;
        }
      }
    }
  }

  letListenerGo(B, a, back) {
    a.listenDone = true;
    const f = a.fig;
    if (f.lookAt === B.c.fig.j.headC) f.lookAt = null;
    if (a.film && f.reachR === a.film) f.reachR = null;
    if (a.hand && f.reachR === a.hand) f.reachR = null;
    f.crouch = 0;
    if (a.filmPhone && f.carry === 'phone') f.carry = null;
    a.filmPhone = false;
    a.tipping = null;
    if (a.bslot && a.bslot.who === a) a.bslot.who = null;
    if (back && a.owner === this && a.alive && !a.gone) {
      const civs = this.game.civilians;
      civs.release(a);
      a.scripted = false;
      civs.rejoin(a);
    }
  }

  dropBusker(B, gone) {
    const civs = this.game.civilians;
    for (const a of B.crowd) if (!a.listenDone) this.letListenerGo(B, a, true);
    B.crowd = [];
    const c = B.c;
    if (c.owner === this) {
      if (gone || !c.alive) civs.remove(c);
      else {
        // (frightened off or rained off: the guitar under the arm, away)
        civs.release(c);
        c.scripted = false;
        civs.rejoin(c);
      }
    }
    this.busker = null;
  }

  // ------------------------------------------------------------------ home with the shopping
  homeScan(now) {
    const game = this.game;
    if (this.homes.length >= 2) return;
    const civs = game.civilians;
    const p = game.player.pos;
    const shops = game.world.shops || [];
    for (const c of civs.list) {
      if (!c.shopping || !civs.plain(c) || c.convo) continue;
      if (Math.abs(c.pos.x - p.x) > 45 || Math.abs(c.pos.z - p.z) > 45) continue;
      if (c.col === undefined || c.prom || blockType(c.col, c.row) !== 'west') continue;
      const vx = c.vel.x;
      const vz = c.vel.z;
      for (const s of shops) {
        if (!s.home || !s.door || s.nx === undefined) continue;
        const dx = s.door[0] - c.pos.x;
        const dz = s.door[2] - c.pos.z;
        if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue;
        // a door ahead, on this side of the walk
        if (dx * vx + dz * vz <= 0) continue;
        if (dx * s.nx + dz * s.nz > -0.5) continue;
        if (!chance(0.5)) {
          c.shopping = false;
          break;
        }
        this.goHome(c, s);
        return;
      }
    }
  }

  goHome(c, s) {
    const out = 1.6 + (s.yard || 0);
    const pts = [{ x: s.door[0] + s.nx * out, z: s.door[2] + s.nz * out }, { x: s.door[0] + s.nx * 0.35, z: s.door[2] + s.nz * 0.35 }];
    // (first along the walk to the point of it straight out from the door: in from there, through
    // the gap in the yard's wall where the path is - not at a slant into the wall beside it)
    const leg = this.legOf(c);
    if (leg) {
      const k = (s.door[0] - c.pos.x) * leg.ux + (s.door[2] - c.pos.z) * leg.uz;
      if (Math.abs(k) > 0.6) pts.unshift({ x: c.pos.x + leg.ux * k, z: c.pos.z + leg.uz * k });
    }
    const H = { c, s, pts, t: 0, at: 0, done: false };
    c.scripted = true;
    c.owner = this;
    c.goingHome = true;
    c.ctrl = (me, dt) => {
      const q = H.pts[0];
      if (!q) {
        // at the door: a hand to it, and in
        me.faceYaw = Math.atan2(-s.nx, -s.nz);
        H.at += dt;
        if (!H.hand) H.hand = new THREE.Vector3(s.door[0] + s.nx * 0.05 + (s.rx || -s.nz) * 0.3, me.pos.y + 1.0, s.door[2] + s.nz * 0.05 + (s.rz !== undefined ? s.rz : s.nx) * 0.3);
        if (!me.fig.reachR || me.fig.reachR === H.hand) me.fig.reachR = H.hand;
        return null;
      }
      if (Math.hypot(q.x - me.pos.x, q.z - me.pos.z) < 0.35) {
        H.pts.shift();
        // (in at the gate and up the path, the last steps to the door: through the yard's opening)
        if (H.pts.length <= 1) me.noCollide = true;
      }
      return { x: q.x, z: q.z, speed: me.speed };
    };
    this.homes.push(H);
  }

  tendHome(H, dt, now) {
    const c = H.c;
    H.t += dt;
    if (!c.alive || c.gone || c.panicT > 0 || c.owner !== this || H.t > 30) {
      if (c.owner === this && c.alive && !c.gone) {
        const civs = this.game.civilians;
        civs.release(c);
        c.scripted = false;
        civs.rejoin(c);
      }
      c.goingHome = false;
      H.done = true;
      return;
    }
    if (H.at > 0.9) {
      // in: the door shut behind them
      if (c.fig.reachR === H.hand) c.fig.reachR = null;
      this.game.civilians.remove(c);
      this.stats.home++;
      H.done = true;
    }
  }

  // ------------------------------------------------------------------ drawing
  // the musician's open case (the coins in it), the coins on their way to it
  draw(fr) {
    const B = this.busker;
    const bodies = fr.bodies;
    const cam = this.game.camera.position;
    if (B && Math.hypot(B.caseAt.x - cam.x, B.caseAt.z - cam.z) < 70) {
      const f = _f.set(B.f.x, 0, B.f.z);
      const r = _r.set(-B.f.z, 0, B.f.x);
      const gy = B.gy;
      // the shell, lying across in front of them (its long side across), the lining in it
      _c.set(B.caseAt.x, gy + 0.06, B.caseAt.z);
      bodies.blob(_c, r, UP, f, 0.5, 0.07, 0.19, CASE);
      _c.y = gy + 0.1;
      bodies.blob(_c, r, UP, f, 0.44, 0.025, 0.15, PLUSH);
      // the lid propped open behind it (on the musician's side)
      _c.set(B.caseAt.x - f.x * 0.2, gy + 0.2, B.caseAt.z - f.z * 0.2);
      bodies.blob(_c, r, UP, f, 0.48, 0.16, 0.025, CASE);
      // the coins (and a note or two)
      const n = Math.min(16, B.coins);
      for (let i = 0; i < n; i++) {
        const u = ((i * 0.618) % 1) * 0.7 - 0.35;
        const v = ((i * 0.371) % 1) * 0.18 - 0.09;
        _c.set(B.caseAt.x + r.x * u + f.x * v, gy + 0.13, B.caseAt.z + r.z * u + f.z * v);
        bodies.blob(_c, r, UP, f, 0.04, 0.01, 0.04, i % 3 === 2 ? SILVER : COIN);
      }
      // the pen along its rim
      const e = 0.5;
      const w = 0.19;
      fr.lineXYZ(B.caseAt.x - r.x * e - f.x * w, gy + 0.13, B.caseAt.z - r.z * e - f.z * w, B.caseAt.x + r.x * e - f.x * w, gy + 0.13, B.caseAt.z + r.z * e - f.z * w, INK, 3, 701, 1, 0.004, 0);
      fr.lineXYZ(B.caseAt.x - r.x * e + f.x * w, gy + 0.13, B.caseAt.z - r.z * e + f.z * w, B.caseAt.x + r.x * e + f.x * w, gy + 0.13, B.caseAt.z + r.z * e + f.z * w, INK, 3, 702, 1, 0.004, 0);
    }
    for (const c of this.flying) {
      const k = Math.min(1, c.t / c.dur);
      const x = c.x0 + (c.x1 - c.x0) * k;
      const z = c.z0 + (c.z1 - c.z0) * k;
      const y = c.y0 + (c.y1 - c.y0) * k + Math.sin(k * Math.PI) * 0.35;
      _c.set(x, y, z);
      _v.set(1, 0, 0);
      _f.set(0, 0, 1);
      bodies.blob(_c, _v, UP, _f, 0.03, 0.03, 0.008, COIN);
    }
  }

  // the city's people all gone at once (Civilians.reset): forget them
  reset() {
    this.huddles = [];
    this.meets = [];
    this.calls = [];
    this.homes = [];
    this.busker = null;
    this.flying = [];
  }

  // everything let go (a new game, the bar)
  releaseAll() {
    for (const H of this.huddles) this.dropHuddle(H);
    this.huddles = [];
    for (const M of this.meets) this.endMeet(M);
    this.meets = [];
    for (const K of this.calls) this.endCall(K);
    this.calls = [];
    if (this.busker) this.dropBusker(this.busker, true);
  }
}
