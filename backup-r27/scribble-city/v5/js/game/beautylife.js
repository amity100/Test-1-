import * as THREE from 'three';

// (v5, ROADMAP 16.7) The perfumery's, the optician's and the barber's people at work (game/shoplife.js,
// the flows 'perfume', 'optics', 'barber'):
//
// - A tester taken at the island: a strip of paper out of its cup, the scent sprayed on it - a puff of
//   mist - the strip waved, held under the nose; a word on it; the tester back on its tray; bought:
//   one in its box from the counter. The one who works there now and then sprays a strip for
//   someone ("Would you like to try our new scent?").
// - A pair of frames off the rail: on the face, to the nearest mirror, the head turned this way and
//   that; back on the rail, or one in its case from the counter. The eyes tested: in the chair, the
//   optician at the machine - "One... or two?" - the chart read out, line by line.
// - The barber's (the cut itself: game/streetlife.js barber - the old hair rubbed out, the new one
//   drawn): the cape round the customer, the hand mirror shown behind the head, the hair on the floor
//   after, swept up by the one who helps there.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const WHITE = [0.97, 0.97, 0.95];
const HAIRS = [[0.15, 0.12, 0.1], [0.32, 0.22, 0.14], [0.08, 0.08, 0.09], [0.55, 0.4, 0.24]];

export class BeautyLife {
  static for(life) {
    const f = life.prof && life.prof.flow;
    if (f === 'perfume' || f === 'optics' || f === 'barber') return new BeautyLife(life, f);
    return null;
  }

  constructor(life, flow) {
    this.life = life;
    this.game = life.game;
    this.flow = flow;
    this.M = life.marks;
    // the scent's puffs in the air a moment; the hair on the floor round the chairs
    this.mists = [];
    this.clips = [];
    // who is in the optician's chair
    this.exam = null;
  }

  say(c, text, chance = 1) {
    if (c && text) this.life.say(c, text, chance);
  }

  has(svc) {
    return svc === 'spray' || svc === 'tryon' || (svc === 'exam' && !!this.M.exam);
  }

  // (into a customer's plan) the eyes tested, now and then
  plan(v, list) {
    if (this.flow === 'optics' && this.M.exam && !this.exam && Math.random() < 0.3) list.splice(Math.min(list.length, 1), 0, { svc: 'exam' });
  }

  // (game/shoplife.js examine) what is in their hand: a tester to try, frames to try on, a bottle off the
  // wall looked at - true when it is seen to here
  decide(v) {
    const L = v.L;
    const it = L.item;
    if (!it) return false;
    const w = it.slot ? it.slot.what : it.look.line;
    if (this.flow === 'perfume' && w === 'tester') return this.start(v, 'spray');
    if (this.flow === 'optics' && (w === 'glasses' || w === 'sunglasses')) return this.start(v, 'tryon');
    if (this.flow === 'perfume' && w === 'perfume') {
      // a bottle off the wall: turned in the hand, back; bought - one in its box from the counter
      if (Math.random() < 0.35) {
        L.buy = it.look;
        this.say(v.c, pick(this.life.prof.say.keep), 0.5);
      }
      L.st = 'putBack';
      L.t = 0;
      return true;
    }
    return false;
  }

  start(v, svc) {
    const L = v.L;
    L.svc = svc;
    L.S = null;
    L.st = 'svc';
    L.t = 0;
    return true;
  }

  // the end of it: the thing back where it came from (walked back to it if it is far), or bought
  done(v, buy) {
    const L = v.L;
    const c = v.c;
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.lookAt = null;
    if (L.S && L.S.strip) this.life.movers.remove(L.S.strip);
    L.S = null;
    if (buy && L.item) L.buy = L.item.look;
    if (L.item) L.item.at = { c, how: 'grip' };
    const s = L.slot;
    if (s && s.zx !== null && Math.hypot(s.zx - c.pos.x, s.zz - c.pos.z) > 0.6) {
      L.st = 'toRail';
      this.life.go(v, s.zx, s.zz);
    } else L.st = 'putBack';
    L.t = 0;
    return null;
  }

  visit(v, dt) {
    const L = v.L;
    const S = L.S || (L.S = { st: 'go', t: 0 });
    S.t += dt;
    if (L.svc === 'spray') return this.spray(v, S, dt);
    if (L.svc === 'tryon') return this.tryOn(v, S, dt);
    if (L.svc === 'exam') return this.examine(v, S, dt);
    L.st = 'next';
    return null;
  }

  // ---------------------------------------------------------------- the perfumery
  // a strip out of the cup into the left hand; the tester (right) sprayed at it; waved; smelled
  spray(v, S) {
    const L = v.L;
    const c = v.c;
    const f = c.fig;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const rx = Math.cos(c.yaw);
    const rz = -Math.sin(c.yaw);
    const sh = f.j.shoulderL || f.j.headC;
    if (!S.strip) {
      S.strip = this.life.movers.add({ line: 'strip', model: 'strip', cell: null, tint: WHITE }, true);
      S.strip.at = { c, how: 'pinchL' };
    }
    const hc = f.j.headC;
    // (the strip held out before them, at the chest)
    const px = c.pos.x + fx * 0.32 + rx * 0.06;
    const py = hc.y - 0.42;
    const pz = c.pos.z + fz * 0.32 + rz * 0.06;
    if (S.t < 1.6) {
      f.reachL = _a.set(px, py, pz);
      // the tester up to it, a short way off - the spray
      f.reachR = _b.set(px - rx * 0.16 + fx * 0.02, py + 0.04, pz - rz * 0.16 + fz * 0.02);
      if (L.item) L.item.at = { c, how: 'grip' };
      f.lookAt = f.reachL;
      if (S.t > 0.7 && !S.sprayed) {
        S.sprayed = true;
        this.mists.push({ x: px - rx * 0.14, y: py + 0.06, z: pz - rz * 0.14, dx: rx, dz: rz, t: 0 });
        this.life.open.sound('poof', 0.25, 8);
      }
      return null;
    }
    if (S.t < 3.0) {
      // waved in the air, to dry
      f.reachR = null;
      f.reachL = _a.set(px + rx * Math.sin(S.t * 14) * 0.08, py + 0.06, pz + rz * Math.sin(S.t * 14) * 0.08);
      f.lookAt = f.reachL;
      return null;
    }
    if (S.t < 4.6) {
      // under the nose
      f.reachL = _a.set(hc.x + fx * 0.1, hc.y - 0.06, hc.z + fz * 0.1);
      f.lookAt = null;
      if (!S.said) {
        S.said = true;
        this.say(c, pick(this.life.prof.say.sniff), 0.9);
      }
      return null;
    }
    void sh;
    return this.done(v, Math.random() < 0.35);
  }

  // the one who works there: a strip sprayed for someone at the island (game/shoplife.js stockerWork)
  job(c, S) {
    if (this.flow === 'perfume') {
      const v = this.life.open.visitors.find((q) => q.L && q.L.svc === 'spray' && q.L.S && q.L.S.t < 0.5);
      if (v && Math.random() < 0.5) {
        S.job = { kind: 'offer', v };
        S.st = 'bOffer';
        S.t = 0;
        const fx = Math.sin(v.c.yaw);
        const fz = Math.cos(v.c.yaw);
        this.life.goS(c, v.c.pos.x - fz * 0.7, v.c.pos.z + fx * 0.7);
        return null;
      }
    }
    if (this.flow === 'optics' && this.exam && !this.exam.examiner) {
      const m = this.M.examiner;
      if (m) {
        this.exam.examiner = c;
        S.job = { kind: 'exam', v: this.exam.v };
        S.st = 'bExam';
        S.t = 0;
        this.life.goS(c, m.x, m.z);
        return null;
      }
    }
    if (this.flow === 'barber' && this.clips.length && !this.clips.some((q) => q.busy)) {
      // the hair round a chair the cut is over at: swept up
      S.job = { kind: 'sweep', clips: this.clips.slice(0, 12) };
      for (const q of S.job.clips) q.busy = true;
      S.st = 'bSweep';
      S.t = 0;
      S.broom = this.life.movers.add({ line: 'broom', model: 'broom', cell: null, tint: [0.62, 0.46, 0.3] }, true);
      S.broom.at = { c, how: 'broom' };
      const q = S.job.clips[0];
      this.life.goS(c, q.it.pos.x, q.it.pos.z, 0.5);
      return null;
    }
    return undefined;
  }

  staff(c, S, dt) {
    const f = c.fig;
    S.t += dt;
    const walk = () => this.life.open.follow(S);
    const J = S.job || {};
    switch (S.st) {
      case 'bOffer': {
        const v = J.v;
        if (!v || !v.c.alive || !v.L || v.L.svc !== 'spray') return this.idle(c, S);
        const mv = walk();
        if (mv) return { ...mv, speed: 1.1 };
        c.faceYaw = Math.atan2(v.c.pos.x - c.pos.x, v.c.pos.z - c.pos.z);
        f.lookAt = v.c.fig.j.headC;
        if (!S.said) {
          S.said = true;
          this.say(c, pick(this.life.prof.say.offer), 1);
        }
        // (a tester of her own, sprayed toward theirs)
        f.reachR = _a.set(c.pos.x + Math.sin(c.faceYaw) * 0.35, v.c.fig.j.headC.y - 0.38, c.pos.z + Math.cos(c.faceYaw) * 0.35);
        if (S.t > 1.4 && !S.puff) {
          S.puff = true;
          this.mists.push({ x: f.reachR.x, y: f.reachR.y + 0.04, z: f.reachR.z, dx: Math.sin(c.faceYaw), dz: Math.cos(c.faceYaw), t: 0 });
          this.life.open.sound('poof', 0.22, 8);
        }
        if (S.t > 3.2) return this.idle(c, S);
        return null;
      }
      case 'bExam': {
        const ex = this.exam;
        if (!ex || ex.examiner !== c) return this.idle(c, S);
        const mv = walk();
        if (mv) return { ...mv, speed: 1.1 };
        const m = this.M.examiner;
        c.faceYaw = m.yaw;
        f.lookAt = ex.v.c.fig.j.headC;
        // (a hand to the machine's wheels, a click with each lens)
        f.reachR = _a.set(m.x + Math.sin(m.yaw) * 0.45, this.life.room.floor + 1.2, m.z + Math.cos(m.yaw) * 0.45);
        ex.ready = true;
        if (S.t > (S.n || 0) * 2.2 + 1) {
          S.n = (S.n || 0) + 1;
          this.life.open.sound('click', 0.3, 8);
          if (S.n % 2) this.say(c, pick(this.life.prof.say.test), 0.9);
        }
        if (ex.over) {
          this.say(c, pick(this.life.prof.say.done), 0.9);
          return this.idle(c, S);
        }
        if (S.t > 30) return this.idle(c, S);
        return null;
      }
      case 'bSweep': {
        const clips = J.clips || [];
        const left = clips.filter((q) => this.clips.includes(q));
        if (!left.length) {
          this.say(c, pick(this.life.prof.say.sweep), 0.5);
          return this.idle(c, S);
        }
        const q = left[0];
        const d = Math.hypot(q.it.pos.x - c.pos.x, q.it.pos.z - c.pos.z);
        if (d > 0.6) {
          const mv = walk();
          if (mv) return { ...mv, speed: 0.9 };
          this.life.goS(c, q.it.pos.x, q.it.pos.z, 0.5);
          return null;
        }
        // the broom pushed to and fro over it; gone
        c.faceYaw = Math.atan2(q.it.pos.x - c.pos.x, q.it.pos.z - c.pos.z);
        S.sw = (S.sw || 0) + dt;
        if (Math.floor(S.sw * 3) !== Math.floor((S.sw - dt) * 3)) this.life.open.sound('sweep', 0.3, 8);
        if (S.sw > 0.9) {
          S.sw = 0;
          for (const o of left) {
            if (Math.hypot(o.it.pos.x - q.it.pos.x, o.it.pos.z - q.it.pos.z) < 0.45) {
              this.life.movers.remove(o.it);
              this.clips = this.clips.filter((x) => x !== o);
            }
          }
        }
        if (S.t > 40) return this.idle(c, S);
        return null;
      }
    }
    return this.idle(c, S);
  }

  idle(c, S) {
    const f = c.fig;
    f.reachR = null;
    f.lookAt = null;
    if (S.broom) {
      this.life.movers.remove(S.broom);
      S.broom = null;
    }
    if (this.exam && this.exam.examiner === c) this.exam.examiner = null;
    S.st = 'idle';
    S.t = 0;
    S.said = false;
    S.puff = false;
    S.n = 0;
    S.job = null;
    return null;
  }

  // (game/shoplife.js update: the one who works there let go of)
  letGo(S) {
    if (S.broom) {
      this.life.movers.remove(S.broom);
      S.broom = null;
    }
    for (const q of this.clips) q.busy = false;
    if (this.exam && this.exam.examiner === S.c) this.exam.examiner = null;
  }

  // ---------------------------------------------------------------- the optician
  // frames on the face; to the nearest mirror; the head turned this way and that; a word
  tryOn(v, S) {
    const L = v.L;
    const c = v.c;
    const f = c.fig;
    if (L.item) L.item.at = { c, how: 'face' };
    if (S.st === 'go') {
      const ms = this.life.room.browse.filter((b) => b.mirror);
      let best = null;
      let bd = 8;
      for (const m of ms) {
        const d = Math.hypot(m.x - c.pos.x, m.z - c.pos.z);
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      S.mirror = best;
      S.st = best ? 'toMirror' : 'look';
      S.t = 0;
      if (best) this.life.go(v, best.x, best.z);
      return null;
    }
    if (S.st === 'toMirror') {
      const mv = this.life.open.follow(v);
      if (mv) return { ...mv, speed: 0.8 };
      S.st = 'look';
      S.t = 0;
      return null;
    }
    // at the mirror: the head this way and that
    const yaw = S.mirror ? S.mirror.yaw : c.yaw;
    c.faceYaw = yaw;
    const hc = f.j.headC;
    const turn = Math.sin(S.t * 1.8) * 0.5;
    f.lookAt = _a.set(hc.x + Math.sin(yaw + turn) * 1.5, hc.y, hc.z + Math.cos(yaw + turn) * 1.5);
    if (S.t > 1.2 && !S.said) {
      S.said = true;
      this.say(c, pick(this.life.prof.say.mirror), 0.8);
    }
    if (S.t < 4.2) return null;
    return this.done(v, Math.random() < 0.4);
  }

  // the eyes tested: to the chair, sat; the chart read out while the optician turns the lenses
  examine(v, S, dt) {
    const L = v.L;
    const c = v.c;
    const m = this.M.exam;
    if (!m || (this.exam && this.exam.v !== v)) {
      L.S = null;
      L.st = 'next';
      return null;
    }
    if (!this.exam) this.exam = { v, examiner: null, ready: false, over: false };
    if (S.st === 'go') {
      S.st = 'toChair';
      this.life.go(v, m.x, m.z);
      return null;
    }
    if (S.st === 'toChair') {
      const mv = this.life.open.follow(v);
      if (mv) return mv;
      S.st = 'sit';
      S.t = 0;
      return null;
    }
    // sat in the chair, the machine before the eyes; the lines read out when the optician is there
    c.pos.x = m.x;
    c.pos.z = m.z;
    c.faceYaw = m.yaw;
    c.fig.sit = Math.min(1, (c.fig.sit || 0) + dt * 3);
    const ch = this.M.chart;
    if (ch) c.fig.lookAt = _a.set(ch.x, ch.y, ch.z);
    const ex = this.exam;
    if (!ex.ready) {
      // (nobody to test them: they give up after a while)
      if (S.t > 40) return this.leaveExam(v);
      return null;
    }
    S.r = (S.r || 0) + dt;
    if (S.r > 2.2) {
      S.r = 0;
      S.k = (S.k || 0) + 1;
      this.say(c, this.life.prof.say.read[Math.min(S.k - 1, this.life.prof.say.read.length - 1)], 0.95);
    }
    if ((S.k || 0) >= 5) {
      ex.over = true;
      if (S.t > 14) return this.leaveExam(v);
    }
    return null;
  }

  leaveExam(v) {
    const c = v.c;
    c.fig.sit = 0;
    c.fig.lookAt = null;
    if (this.exam && this.exam.v === v) this.exam = null;
    v.L.S = null;
    v.L.st = 'next';
    v.L.t = 0;
    return null;
  }

  // ---------------------------------------------------------------- the barber (game/streetlife.js)
  // the cape round the one in the chair
  capeOn(c) {
    if (!c || c.cape) return;
    c.cape = this.life.movers.add({ line: 'cape', model: 'cape', cell: null, tint: pick([[0.12, 0.12, 0.14], [0.2, 0.3, 0.55], [0.86, 0.86, 0.84]]) }, true);
    c.cape.at = { c, how: 'cape' };
  }

  // off; shaken out - the hair on the floor round the chair
  capeOff(c, chair) {
    if (!c || !c.cape) return;
    this.life.movers.remove(c.cape);
    c.cape = null;
    const col = c.fig && c.fig.look && c.fig.look.hair && c.fig.look.hair.style !== 'none' ? c.fig.look.hair.color : pick(HAIRS);
    const x0 = chair ? chair.x : c.pos.x;
    const z0 = chair ? chair.z : c.pos.z;
    for (let k = 0; k < 7 && this.clips.length < 30; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.4;
      const it = this.life.movers.add({ line: 'clip', model: 'clip', cell: null, tint: col }, true);
      it.at = { x: x0 + Math.cos(a) * r, y: this.life.room.floor + 0.002, z: z0 + Math.sin(a) * r, yaw: Math.random() * 6.28 };
      this.clips.push({ it, busy: false });
    }
  }

  // the hand mirror held up behind their head a moment (the barber's left hand)
  mirrorShow(barber, who, on) {
    if (on && !barber.handMirror) {
      barber.handMirror = this.life.movers.add({ line: 'mirror', model: 'handMirror', cell: null, tint: [0.12, 0.12, 0.13] }, true);
      barber.handMirror.at = { c: barber, how: 'gripL' };
    }
    if (!on && barber.handMirror) {
      this.life.movers.remove(barber.handMirror);
      barber.handMirror = null;
      if (barber.fig) barber.fig.reachL = null;
    }
    if (on && who && barber.fig) {
      // (the scissors still in the right hand; the mirror in the left, behind their head)
      const hc = who.fig.j.headC;
      const fx = Math.sin(who.yaw);
      const fz = Math.cos(who.yaw);
      barber.fig.reachL = (barber.fig._mirL || (barber.fig._mirL = new THREE.Vector3())).set(hc.x - fx * 0.3, hc.y + 0.05, hc.z - fz * 0.3);
    }
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    for (const m of this.mists) m.t += dt;
    this.mists = this.mists.filter((m) => m.t < 0.9);
  }

  // the scent's mist: a fan of short fading strokes from the nozzle
  draw(fr) {
    if (!fr || !this.mists.length) return;
    for (const m of this.mists) {
      const a = Math.max(0, 1 - m.t / 0.9);
      const reach = 0.06 + m.t * 0.35;
      for (let k = 0; k < 7; k++) {
        const sp = (k - 3) * 0.13;
        const dx = m.dx * Math.cos(sp) - m.dz * Math.sin(sp);
        const dz = m.dx * Math.sin(sp) + m.dz * Math.cos(sp);
        const r0 = reach * 0.4;
        const up = (k % 3) * 0.012 + m.t * 0.05;
        fr.lineXYZ(m.x + dx * r0, m.y + up, m.z + dz * r0, m.x + dx * reach, m.y + up + 0.01, m.z + dz * reach, [0.98, 0.9, 0.96], 2.4, 7400 + k, 0.7 * a, 0.004, 0);
      }
    }
  }

  // a customer let go of (frightened, gone)
  release(v) {
    if (this.exam && this.exam.v === v) this.exam = null;
    if (v.L && v.L.S && v.L.S.strip) this.life.movers.remove(v.L.S.strip);
    if (v.c && v.c.cape) {
      this.life.movers.remove(v.c.cape);
      v.c.cape = null;
    }
  }

  dispose() {
    for (const q of this.clips) this.life.movers.remove(q.it);
    this.clips = [];
    this.mists = [];
  }
}
