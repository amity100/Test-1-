import * as THREE from 'three';
import { civilianLook, cityLook, elderLook, kidLook, modest } from './looks.js';
import { sidewalkLoop } from './civilians.js';
import { BLOCK_TYPES } from '../world/layout.js';
import { dampAngle } from '../core/util.js';
import { StreetSocial } from './streetsocial.js';

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
// (GTA IV pass) a picture of the friend, a selfie, a picture of the musician or of a shop's sign
const POSE_LINES = [['Say cheese!', 'Cheese!'], ['Stand over there!', 'Like this?', 'Perfect!'], ['Smile!', 'Hurry up!'], ['One more!', 'My face hurts!']];
const SELFIE_LINES = ['Selfie!', 'Hashtag vacation!', 'Wait, my hair...', 'Got it!'];
const SIGN_LINES = ['Love this sign!', 'So retro!', 'For the album.', 'Look at that!'];
const _fwd = new THREE.Vector3();

function office() {
  const L = cityLook({ kind: 'office' });
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
  const L = cityLook({ kind: pick(['street', 'denim', 'smart', 'knit']) });
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
  const L = cityLook();
  L.role = 'shopper';
  return L;
}

export class Crowds {
  constructor(game) {
    this.game = game;
    this.hangouts = null;
    this.hangT = 0;
    // (counted for the tests)
    this.stats = { photos: 0, families: 0, elders: 0, tourists: 0, office: 0, youths: 0, shoppers: 0, poses: 0, selfies: 0 };
    // (GTA IV pass) the groups standing and talking, people who know each other meeting, the calls,
    // the street musician, home with the shopping: game/streetsocial.js (dressed as these are)
    this.social = new StreetSocial(game, { office, tourist, elder, youth, shopper });
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
  // camera, the grandpa's cane, the child by the parent's hand, the shopping. (company false: one
  // of the far crowd come near - game/farcrowd.js - nobody new appearing beside them)
  dress(c, company = true) {
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
      // (GTA IV pass: most tourists are two - the other to stand in the pictures)
      if (company && !c.dog && chance(0.45)) {
        const b = this.game.civilians.addBuddy(c, { look: tourist(), couple: chance(0.45) });
        if (b) {
          const r = Math.random();
          b.fig.carry = r < 0.3 ? 'icecream' : r < 0.5 ? 'soda' : r < 0.65 ? 'phone' : null;
        }
      }
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
        // (and the parent answers: game/voices.js)
        if (Math.hypot(me.pos.x - p.x, me.pos.z - p.z) < 16 && !(this.game.voices && this.game.voices.chat([me, P], 'kid'))) this.game.bubbles.say(me, pick(lines));
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
    this.social.update(dt);
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
      c.stopT = Math.max(c.stopT, 0.2);
      c.yaw = dampAngle(c.yaw, ph.yaw, 3, dt);
      // (the friend in the picture first walks to the place and turns round: addBuddy's pose)
      const B = ph.model;
      if (B && !(B.pose && B.pose.at)) {
        ph.wait += dt;
        if (ph.wait > 6 || !B.alive || B.buddyOf !== c) this.endPhoto(c);
        return;
      }
      ph.t += dt;
      if (ph.look && (!f.lookAt || f.lookAt === ph.look)) f.lookAt = ph.look;
      if (ph.t > 0.7 && ph.t < 2.6) {
        if (ph.selfie) {
          // the camera held out at arm's length, up and turned back: the head turned to it
          f.toWorld(0.24, 1.7, 0.5, ph.r);
          f.reachR = ph.r;
          f.lookAt = ph.r;
          ph.look = ph.r;
        } else {
          // both hands to the camera in front of the eyes
          f.toWorld(0.06, 1.5, 0.2, ph.r);
          f.toWorld(-0.06, 1.48, 0.2, ph.l);
          f.reachR = ph.r;
          f.reachL = ph.l;
        }
        if (!ph.shot && ph.t > 1.7) {
          ph.shot = true;
          this.stats.photos++;
          const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
          if (d < 14) this.game.audio.play('shutter', 0.5 * (1 - d / 14));
          if (d < 30 && Math.random() < 0.3 && !B) this.game.bubbles.say(c, pick(ph.selfie ? SELFIE_LINES : ph.sign ? SIGN_LINES : PHOTO_LINES));
        }
      } else {
        if (f.reachR === ph.r) f.reachR = null;
        if (f.reachL === ph.l) f.reachL = null;
      }
      if (ph.t > 3) this.endPhoto(c);
      return;
    }
    // (only where somebody could see it)
    if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 45 || c.crossing) return;
    c.photoT -= dt;
    if (c.photoT > 0) return;
    c.photoT = 12 + Math.random() * 20;
    this.startPhoto(c, p);
  }

  // (GTA IV pass) what a tourist takes a picture of: the musician playing nearby, the friend posing
  // on the sidewalk, a selfie, the sign over a shop's door; on the promenade the bay; anywhere else
  // across the street or along it
  startPhoto(c, p) {
    const ph = { t: 0, wait: 0, yaw: 0, shot: false, r: new THREE.Vector3(), l: new THREE.Vector3(), look: null, model: null, selfie: false, sign: false };
    const S = this.social && this.social.busker;
    const B = c.buddy && c.buddy.alive && c.buddy.buddyOf === c && !c.buddy.convo ? c.buddy : null;
    const r = Math.random();
    const q = B && r < 0.55 ? this.poseSpot(c) : null;
    if (S && Math.hypot(S.x - c.pos.x, S.z - c.pos.z) < 16) {
      ph.yaw = Math.atan2(S.x - c.pos.x, S.z - c.pos.z);
      ph.look = S.c.fig.j.headC;
    } else if (q) {
      // the friend: a few steps along the walk, turned round, posing
      ph.yaw = q.yaw;
      ph.model = B;
      B.pose = { x: q.x, z: q.z, at: false, kind: pick(['peace', 'wave', 'arms', 'hip']), hand: new THREE.Vector3(), hand2: new THREE.Vector3(), face: c };
      this.stats.poses++;
      if (this.game.voices && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 26) ph.talk = pick(POSE_LINES);
    } else if (r < 0.75) {
      ph.selfie = true;
      ph.yaw = c.yaw;
      this.stats.selfies++;
    } else {
      const sh = this.signNear(c);
      if (sh) {
        ph.sign = true;
        ph.look = new THREE.Vector3(sh.door[0], (sh.door[1] || 0) + 3.1, sh.door[2]);
        ph.yaw = Math.atan2(sh.door[0] - c.pos.x, sh.door[2] - c.pos.z);
      } else ph.yaw = c.prom ? Math.PI / 2 + (Math.random() - 0.5) * 1.2 : c.yaw + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 1.2);
    }
    c.photo = ph;
    c.stopT = ph.model ? 9 : 3.1;
    if (ph.talk) this.game.voices.talk([c, ph.model], ph.talk);
  }

  // where the friend stands for the picture: a few steps on along the walk (back along it near the
  // corner - not out in the road beyond it), and only where somebody can stand - not in a bench, a
  // planter, a pole (null: nowhere, a selfie then)
  poseSpot(c) {
    let ux = Math.sin(c.yaw);
    let uz = Math.cos(c.yaw);
    const T = c.loop && c.loop[c.target];
    if (T) {
      const dx = T[0] - c.pos.x;
      const dz = T[1] - c.pos.z;
      const l = Math.hypot(dx, dz);
      if (l > 0.5) {
        const k = l < 3.6 ? -1 : 1;
        ux = (dx / l) * k;
        uz = (dz / l) * k;
      }
    }
    const x = c.pos.x + ux * 2.6;
    const z = c.pos.z + uz * 2.6;
    const hit = this.game.world.collision.pointInside(x, 1.0, z, 0.35);
    if (hit && hit.alive !== false) return null;
    return { x, z, yaw: Math.atan2(ux, uz) };
  }

  // a shop's sign near a tourist, on the side of the walk where the shops are
  signNear(c) {
    let best = null;
    let bd = 13;
    for (const s of this.game.world.shops || []) {
      if (!s.door || s.home || s.stand || s.nx === undefined) continue;
      const dx = s.door[0] - c.pos.x;
      const dz = s.door[2] - c.pos.z;
      if (Math.abs(dx) > bd || Math.abs(dz) > bd) continue;
      const d = Math.hypot(dx, dz);
      // (looking at its front, from the sidewalk)
      if (d < bd && d > 3 && dx * s.nx + dz * s.nz < -1) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  endPhoto(c) {
    const ph = c.photo;
    c.photo = null;
    const f = c.fig;
    if (ph) {
      if (f.reachR === ph.r) f.reachR = null;
      if (f.reachL === ph.l) f.reachL = null;
      if (f.lookAt === ph.look || f.lookAt === ph.r) f.lookAt = null;
      if (ph.model) this.game.civilians.endPose(ph.model);
    }
    c.stopT = Math.min(c.stopT, 0.3);
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
    if (!c || Math.hypot(c.pos.x - p.x, c.pos.z - p.z) >= 20 || !this.game.bubbles) return;
    // (the others answer: game/voices.js)
    const rest = s.who.filter((o) => o !== c && o.alive);
    if (rest.length && this.game.voices && this.game.voices.chat([c, ...rest], 'youth')) s.talkT += 8;
    else this.game.bubbles.say(c, pick(YOUTH_LINES));
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
