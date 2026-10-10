import * as THREE from 'three';
import { civilianLook, elderLook, kidLook, modest } from './looks.js';
import { sidewalkLoop } from './civilians.js';
import { BLOCK_TYPES } from '../world/layout.js';
import { dampAngle } from '../core/util.js';

// Who you meet depends on where you are (ROADMAP 3.3):
//   downtown        suits and blazers, a briefcase or a handbag, a coffee, on the phone
//   the promenade   tourists: summer clothes, a hat, sunglasses, a camera on a strap; now and then
//                   they stop and take a picture of the bay (or of whatever caught their eye)
//   the hotels      tourists too, fewer
//   the park        grandmas and grandpas (slower, bent a little, some with a cane), and a parent
//                   with a child by the hand; the park's benches are more often theirs
//   the alleys      young people hanging out in threes on the corners, talking
//   the market      people coming and going with their shopping
// Each walk round a block gets its own people (Civilians.update asks lookFor); they keep to it
// as long as they walk it, and mix at the crossings like everybody else.
// (?classic: everybody as before)

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const BRIGHT = [[0.95, 0.4, 0.35], [0.98, 0.78, 0.25], [0.35, 0.65, 0.92], [0.45, 0.78, 0.5], [0.92, 0.55, 0.75], [0.98, 0.95, 0.9]];
const YOUTH_LINES = ['Yo!', 'No way, bro.', 'Ha! Classic.', 'Check this out.', 'For real?', 'Who\'s got the ball?', 'Same time tomorrow.', 'Nah, nah, nah.'];
const PHOTO_LINES = ['Smile!', 'One more!', 'Look at that view!', 'Got it!'];
const _fwd = new THREE.Vector3();

function office() {
  const L = civilianLook({ kind: 'office' });
  L.role = 'office';
  return L;
}

function tourist() {
  const L = civilianLook({ kind: chance(0.5) ? 'summer' : 'street' });
  L.top = { kind: pick(['tee', 'polo', 'shirt']), color: pick(BRIGHT), sleeves: 'short' };
  L.hat = { kind: pick(['bucket', 'cap', 'bucket']), color: pick([[0.95, 0.94, 0.88], [0.86, 0.76, 0.56], ...BRIGHT]) };
  L.face.glasses = chance(0.6) ? 'shades' : L.face.glasses;
  L.role = 'tourist';
  return modest(L);
}

function elder() {
  const L = elderLook(chance(0.5));
  L.role = 'elder';
  return L;
}

function parent() {
  const L = civilianLook({ kind: pick(['street', 'denim', 'smart', 'knit']) });
  L.role = 'parent';
  return L;
}

function youth() {
  const L = civilianLook({ kind: 'street', fem: chance(0.35) });
  if (!L.fem && chance(0.6)) L.hat = { kind: pick(['capBack', 'beanie', 'cap']), color: pick([[0.12, 0.12, 0.14], [0.8, 0.2, 0.25], [0.95, 0.95, 0.94], [0.2, 0.3, 0.6]]) };
  L.role = 'youth';
  return modest(L);
}

function shopper() {
  const L = civilianLook();
  L.role = 'shopper';
  return L;
}

export class Crowds {
  constructor(game) {
    this.game = game;
    this.hangouts = null;
    this.hangT = 0;
    // (counted for the tests)
    this.stats = { photos: 0, families: 0, elders: 0, tourists: 0, office: 0, youths: 0, shoppers: 0 };
  }

  // a look for somebody new on the walk round a block of this type ('prom': the promenade), or
  // null for anybody at all
  lookFor(type) {
    const r = Math.random();
    switch (type) {
      case 'towers':
        return r < 0.6 ? office() : null;
      case 'prom':
        return r < 0.5 ? tourist() : null;
      case 'hotels':
        return r < 0.3 ? tourist() : null;
      case 'park':
        return r < 0.3 ? elder() : r < 0.45 ? parent() : null;
      case 'gang':
        return r < 0.45 ? youth() : null;
      case 'market':
        return r < 0.35 ? shopper() : null;
      default:
        return null;
    }
  }

  // what goes with who they are, once they are out (after Civilians.dressUp): the tourist's
  // camera, the grandpa's cane, the child by the parent's hand, the shopping
  dress(c) {
    const role = c.fig.look.role;
    if (!role) return;
    c.role = role;
    const f = c.fig;
    if (role === 'tourist') {
      if (!c.dog) {
        f.carry = 'camera';
        c.chatty = false;
      }
      c.photoT = 6 + Math.random() * 20;
      c.speed = Math.min(c.speed, 1.1 + Math.random() * 0.2);
      this.stats.tourists++;
    } else if (role === 'elder') {
      c.speed = 0.7 + Math.random() * 0.25;
      f.hunch = 0.15 + Math.random() * 0.35;
      if (!c.dog && chance(0.5)) f.carry = 'cane';
      this.stats.elders++;
    } else if (role === 'office') {
      c.speed *= 1.1;
      this.stats.office++;
    } else if (role === 'parent') {
      if (!c.dog && this.addChild(c)) this.stats.families++;
    } else if (role === 'shopper') {
      if (!c.dog) {
        f.carryL = 'bag';
        f.bagBread = chance(0.5);
        c.carryUntil = this.game.time + 600;
      }
      this.stats.shoppers++;
    }
  }

  // a child walking at the parent's left, holding the hand
  addChild(c) {
    const civs = this.game.civilians;
    if (c.prom || c.loop.length < 4) return null;
    // (drawn at the size of the vignettes' children)
    const kid = civs.spawnScripted(c.pos.x - c.fig.right.x * 0.6, c.pos.z - c.fig.right.z * 0.6, kidLook(), null, { scale: 0.62 });
    kid.scripted = false;
    kid.buddyOf = c;
    c.buddy = kid;
    c.speed = Math.min(c.speed, 1.05);
    c.fig.carry = c.fig.carry === 'phone' ? null : c.fig.carry;
    const lines = ['Are we there yet?', 'Can I have an ice cream?', 'Look, a pigeon!', 'Carry me!', 'Why?'];
    let talkT = 4 + Math.random() * 8;
    kid.ctrl = (me, dt) => {
      const P = me.buddyOf;
      if (!P || !P.alive || P.gone || P.panicT > 0) {
        me.ctrl = null;
        me.buddyOf = null;
        me.fig.reachR = null;
        return null;
      }
      const f = P.fig.forward;
      const side = P.fig.right;
      const tx = P.pos.x - side.x * 0.55 + f.x * 0.05;
      const tz = P.pos.z - side.z * 0.55 + f.z * 0.05;
      const d = Math.hypot(tx - me.pos.x, tz - me.pos.z);
      const psp = Math.hypot(P.vel.x, P.vel.z);
      // the hand up in the parent's
      me.fig.reachR = d < 1.2 ? P.fig.j.handL : null;
      talkT -= dt;
      if (talkT < 0) {
        talkT = 6 + Math.random() * 10;
        const p = this.game.player.pos;
        if (Math.hypot(me.pos.x - p.x, me.pos.z - p.z) < 16) this.game.bubbles.say(me, pick(lines));
      }
      if (psp < 0.2 && d < 0.8) {
        me.faceYaw = P.yaw;
        return null;
      }
      return { x: tx, z: tz, speed: Math.min(3.5, psp + d * 1.5) };
    };
    return kid;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar) return;
    if (!this.hangouts) this.setup();
    const p = game.player.pos;
    for (const c of game.civilians.list) {
      if (c.role === 'tourist') this.tourist(c, dt, p);
    }
    this.hangT -= dt;
    if (this.hangT <= 0) {
      this.hangT = 1;
      this.hang(p);
    }
    for (const h of this.hangouts) if (h.who) this.chat(h, dt);
  }

  // the corners of the alleys' blocks where the young people hang out
  setup() {
    this.hangouts = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (BLOCK_TYPES[row][col] !== 'gang') continue;
        const L = sidewalkLoop(col, row);
        for (let k = 0; k < L.length; k++) {
          // a few metres along from the corner, against the wall
          const a = L[k];
          const b = L[(k + 1) % L.length];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const ux = (b[0] - a[0]) / len;
          const uz = (b[1] - a[1]) / len;
          // (the walk goes clockwise round the block: the wall is to its right, (-uz, ux))
          this.hangouts.push({ x: a[0] + ux * 7 - uz * 1.2, z: a[1] + uz * 7 + ux * 1.2, who: null, talkT: 2 });
        }
      }
    }
  }

  // stopping for a picture: turned to the view, the camera up to the eye, a click
  tourist(c, dt, p) {
    if (c.ctrl || c.scripted || !c.alive || c.panicT > 0 || c.headless || c.dog || c.fig.carry !== 'camera') {
      if (c.photo) this.endPhoto(c);
      return;
    }
    const f = c.fig;
    if (c.photo) {
      const ph = c.photo;
      ph.t += dt;
      c.stopT = Math.max(c.stopT, 0.2);
      c.yaw = dampAngle(c.yaw, ph.yaw, 3, dt);
      if (ph.t > 0.7 && ph.t < 2.6) {
        // both hands to the camera in front of the eyes
        f.toWorld(0.06, 1.5, 0.2, ph.r);
        f.toWorld(-0.06, 1.48, 0.2, ph.l);
        f.reachR = ph.r;
        f.reachL = ph.l;
        if (!ph.shot && ph.t > 1.7) {
          ph.shot = true;
          this.stats.photos++;
          const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
          if (d < 14) this.game.audio.play('shutter', 0.5 * (1 - d / 14));
          if (d < 30 && Math.random() < 0.25) this.game.bubbles.say(c, pick(PHOTO_LINES));
        }
      } else {
        f.reachR = null;
        f.reachL = null;
      }
      if (ph.t > 3) this.endPhoto(c);
      return;
    }
    // (only where somebody could see it)
    if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 45 || c.crossing) return;
    c.photoT -= dt;
    if (c.photoT > 0) return;
    c.photoT = 14 + Math.random() * 22;
    // on the promenade the bay; anywhere else, across the street or along it
    const yaw = c.prom ? Math.PI / 2 + (Math.random() - 0.5) * 1.2 : c.yaw + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 1.2);
    c.photo = { t: 0, yaw, shot: false, r: new THREE.Vector3(), l: new THREE.Vector3() };
    c.stopT = 3.1;
  }

  endPhoto(c) {
    c.photo = null;
    c.fig.reachR = null;
    c.fig.reachL = null;
  }

  // the young people on the corners near you (three at a corner), from noon to one at night
  hang(p) {
    const game = this.game;
    const h = game.daynight ? game.daynight.hour : 12;
    const out = h > 12 || h < 1;
    const civs = game.civilians;
    for (const s of this.hangouts) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (s.who) {
        const lost = s.who.some((c) => !c.alive || c.panicT > 0 || c.headless || c.owner !== this || civs.list.indexOf(c) < 0);
        if (lost || d > 85 || (!out && this.unseen(s.x, s.z))) this.leave(s, lost);
      } else if (out && d < 60 && d > 16 && this.unseen(s.x, s.z)) {
        // somewhere you are not looking: three of them already there
        s.who = [];
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
          const c = civs.spawnScripted(s.x + Math.cos(a) * 0.75, s.z + Math.sin(a) * 0.75, youth(), this);
          c.role = 'youth';
          c.still = true;
          c.yaw = Math.atan2(s.x - c.pos.x, s.z - c.pos.z);
          if (i === 1 && chance(0.5)) c.fig.carry = 'phone';
          c.ctrl = (civ) => {
            civ.faceYaw = Math.atan2(s.x - civ.pos.x, s.z - civ.pos.z);
            return null;
          };
          s.who.push(c);
          this.stats.youths++;
        }
      }
    }
  }

  // talking among themselves, now and then a laugh
  chat(s, dt) {
    s.talkT -= dt;
    if (s.talkT > 0) return;
    s.talkT = 3 + Math.random() * 6;
    const c = pick(s.who);
    const p = this.game.player.pos;
    if (c && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 20 && this.game.bubbles) this.game.bubbles.say(c, pick(YOUTH_LINES));
  }

  leave(s, lost) {
    const civs = this.game.civilians;
    for (const c of s.who) {
      if (c.owner !== this) continue;
      if (lost && c.alive) {
        civs.release(c);
        c.scripted = false;
        c.still = false;
        civs.rejoin(c);
      } else civs.remove(c);
    }
    s.who = null;
  }

  unseen(x, z, far = 45) {
    const cam = this.game.camera;
    const fwd = cam.getWorldDirection(_fwd);
    const dx = x - cam.position.x;
    const dz = z - cam.position.z;
    const d = Math.hypot(dx, dz) || 1;
    return d > far || (dx * fwd.x + dz * fwd.z) / d < 0.1;
  }
}
