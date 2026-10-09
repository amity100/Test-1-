import { civilianLook, bouncerLook } from './looks.js';

// The queues of the evening: people lined up along the wall for the cinema's next show and for the
// club, chatting, on their phones; the bouncer at the rope lets one in now and then and the line
// shuffles up; somebody new walks up to the end. (Only when you are near: they are scripted people
// and go home when you leave.)

const CHAT = ['Is it any good?', 'I heard it\'s scary!', 'Two tickets, please.', 'This line, ugh.', 'Love this song!', 'Are we on the list?', 'Ha ha ha!', 'Nice jacket!'];
const BOUNCER = ['Next.', 'You. Come on in.', 'Not tonight.', 'Easy, folks.', 'One at a time.'];

export class Nightlife {
  constructor(game) {
    this.game = game;
    this.spots = (game.world.queues || []).map((q) => ({ ...q, people: [], bouncer: null, t: 0, active: false }));
  }

  update(dt) {
    const game = this.game;
    const p = game.anchorPos();
    for (const q of this.spots) {
      const d = Math.hypot(q.door[0] - p.x, q.door[1] - p.z);
      if (!q.active && d < 70) this.open(q);
      else if (q.active && d > 95) this.close(q);
      if (q.active) this.tick(q, dt);
    }
  }

  // the place in line of the k-th person (0: first, by the door)
  spot(q, k) {
    const s = q.kind === 'club' ? 1.6 : 1.2;
    const along = s + k * 0.85;
    const out = q.kind === 'club' ? 1.25 : 1.1;
    return [q.door[0] + q.ux * along + q.nx * (out - 1.1), q.door[1] + q.uz * along + q.nz * (out - 1.1)];
  }

  person(q, x, z) {
    const look = civilianLook({ kind: ['chic', 'street', 'denim', 'trench', 'smart', 'bomber', 'puffer'][Math.floor(Math.random() * 7)] });
    const c = this.game.civilians.spawnScripted(x, z, look, this);
    c.speed = 1.2;
    if (Math.random() < 0.3) c.fig.carry = 'phone';
    return c;
  }

  open(q) {
    q.active = true;
    q.t = 4 + Math.random() * 4;
    for (let k = 0; k < q.n; k++) {
      const [x, z] = this.spot(q, k);
      const c = this.person(q, x, z);
      c.qIndex = k;
      c.ctrl = (me) => this.inLine(q, me);
      q.people.push(c);
    }
    if (q.kind === 'club') {
      // the bouncer: big, in black, by the rope
      const L = bouncerLook();
      const bx = q.door[0] + q.ux * 0.9 + q.nx * 0.5;
      const bz = q.door[1] + q.uz * 0.9 + q.nz * 0.5;
      const b = this.game.civilians.spawnScripted(bx, bz, L, this);
      b.brave = true;
      b.ctrl = (me) => {
        me.faceYaw = Math.atan2(q.ux, q.uz);
        return Math.hypot(me.pos.x - bx, me.pos.z - bz) > 0.3 ? { x: bx, z: bz, speed: 1.2 } : null;
      };
      q.bouncer = b;
    }
  }

  close(q) {
    const civs = this.game.civilians;
    for (const c of q.people) if (!c.gone && civs.list.includes(c)) civs.remove(c);
    if (q.bouncer && civs.list.includes(q.bouncer)) civs.remove(q.bouncer);
    q.people = [];
    q.bouncer = null;
    q.active = false;
  }

  // standing in line: on their spot, facing the door; now and then turned to a friend behind
  inLine(q, me) {
    if (me.going) {
      // the one let in: up to the door and inside
      const dx = q.door[0] - me.pos.x;
      const dz = q.door[1] - me.pos.z;
      if (Math.hypot(dx, dz) < 0.5) {
        me.entered = true;
        return null;
      }
      return { x: q.door[0] - q.nx * 0.6, z: q.door[1] - q.nz * 0.6, speed: 1.3 };
    }
    const [x, z] = this.spot(q, me.qIndex);
    const d = Math.hypot(x - me.pos.x, z - me.pos.z);
    if (d > 0.25) return { x, z, speed: d > 4 ? 1.4 : 0.9 };
    me.faceYaw = me.talkT > 0 ? Math.atan2(q.ux, q.uz) : Math.atan2(-q.ux, -q.uz);
    return null;
  }

  tick(q, dt) {
    const game = this.game;
    const civs = game.civilians;
    // people who got in (or ran off, or were rubbed out) leave the line
    const keep = [];
    for (const c of q.people) {
      if (c.entered || !c.alive || c.panicT > 0 || c.gone) {
        if (c.entered) civs.remove(c);
        else if (!c.gone) civs.release(c);
        continue;
      }
      if (c.talkT > 0) c.talkT -= dt;
      keep.push(c);
    }
    q.people = keep;
    q.people.forEach((c, k) => {
      if (!c.going) c.qIndex = k - q.people.filter((o, j) => j < k && o.going).length;
    });
    // chatter
    if (Math.random() < dt * 0.25 && q.people.length) {
      const c = q.people[Math.floor(Math.random() * q.people.length)];
      c.talkT = 3;
      const p = game.player.pos;
      if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 16) game.bubbles.say(c, CHAT[Math.floor(Math.random() * CHAT.length)]);
    }
    // the next one goes in
    q.t -= dt;
    if (q.t <= 0) {
      q.t = 7 + Math.random() * 7;
      const first = q.people.find((c) => !c.going);
      if (first) {
        first.going = true;
        if (q.bouncer) {
          const p = game.player.pos;
          if (Math.hypot(q.bouncer.pos.x - p.x, q.bouncer.pos.z - p.z) < 16) game.bubbles.say(q.bouncer, BOUNCER[Math.floor(Math.random() * BOUNCER.length)]);
        }
      }
      // and somebody new walks up to the end of the line
      if (q.people.length < q.n + 1) {
        const k = q.people.length;
        const [x, z] = this.spot(q, k + 14);
        const c = this.person(q, x, z);
        c.qIndex = k;
        c.ctrl = (me) => this.inLine(q, me);
        q.people.push(c);
      }
    }
  }
}
