// (v5, ROADMAP 12.7) CLAW-SOME: the claw machine, played on the machine itself - no screen: the
// claw over the toys in its box moves as you push the stick (game/arcade.js clawRig moves it in the
// world), down it goes on the button, closes, rises; whatever it holds rides it to the chute, if it
// does not slip on the way. Fifteen seconds to choose where.

const SPEED = 0.3;

export class ClawGame {
  constructor(o = {}) {
    this.o = o;
    this.title = 'CLAW-SOME · מכונת המנוף';
    this.help = 'חצים להזיז את המנוף · רווח להוריד אותו · Esc לצאת';
    this.helpTouch = 'החצים להזיז את המנוף · A להוריד אותו';
    this.pad = 'pad';
  }

  start(api) {
    this.api = api;
    const R = (this.rig = this.o.rig);
    this.u = R.chute[0];
    this.d = R.chute[1];
    this.y = R.top;
    this.open = 1;
    this.scene = 'move';
    this.time = 15;
    this.t = 0;
    this.held = null;
    this.prize = null;
    R.set(this.u, this.d, this.y, 1);
    api.status('15');
  }

  result() {
    return { prize: this.prize };
  }

  stop() {
    // (left mid-way: the claw home, anything it held back on the pile)
    const R = this.rig;
    if (this.held) R.drop(this.held, this.u, this.d);
    this.held = null;
    R.set(R.chute[0], R.chute[1], R.top, 1);
  }

  sfx(f0, f1, dur, vol = 0.05, at = 0) {
    const a = this.api.audio;
    if (a && a.ctx && a.ctx.state === 'running') a.tone('square', f0, f1, dur, vol, at);
  }

  update(dt, inp) {
    const R = this.rig;
    const B = R.box;
    this.t += dt;
    if (this.scene === 'move') {
      this.time -= dt;
      const du = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      const dd = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      this.u = Math.max(B.u0, Math.min(B.u1, this.u + du * SPEED * dt));
      this.d = Math.max(B.d0, Math.min(B.d1, this.d + dd * SPEED * dt));
      if ((du || dd) && Math.floor(this.t * 8) !== Math.floor((this.t - dt) * 8)) this.sfx(180, 180, 0.04, 0.03);
      this.api.status(`${Math.max(0, Math.ceil(this.time))}`);
      if (inp.hit.has('a') || inp.hit.has('enter') || inp.taps.length || this.time <= 0) {
        this.scene = 'drop';
        this.k = 0;
        this.sfx(300, 120, 1.0, 0.04);
      }
    } else if (this.scene === 'drop') {
      this.k += dt / 1.1;
      this.y = R.top + (R.floor + 0.22 - R.top) * Math.min(1, this.k);
      if (this.k >= 1) {
        this.scene = 'close';
        this.k = 0;
      }
    } else if (this.scene === 'close') {
      this.k += dt / 0.4;
      this.open = Math.max(0, 1 - this.k);
      if (this.k >= 1) {
        // what is under it: the nearest toy, and how near
        let best = null;
        let bd = 1;
        for (const t of R.toys) {
          const dd = Math.hypot(t.u - this.u, t.d - this.d);
          if (dd < bd) {
            bd = dd;
            best = t;
          }
        }
        const p = bd < 0.04 ? 0.8 : bd < 0.07 ? 0.45 : bd < 0.1 ? 0.15 : 0;
        if (best && Math.random() < p) {
          this.held = best;
          R.grab(best);
          this.sfx(500, 700, 0.15);
        }
        this.scene = 'lift';
        this.k = 0;
        this.slipAt = this.held && Math.random() < 0.15 ? 0.3 + Math.random() * 0.5 : 2;
      }
    } else if (this.scene === 'lift') {
      this.k += dt / 1.1;
      this.y = R.floor + 0.22 + (R.top - R.floor - 0.22) * Math.min(1, this.k);
      if (this.held && this.k > this.slipAt) {
        R.drop(this.held, this.u + (Math.random() - 0.5) * 0.1, this.d + (Math.random() - 0.5) * 0.1);
        this.held = null;
        this.sfx(400, 120, 0.3);
      }
      if (this.k >= 1) {
        this.scene = 'carry';
        this.k = 0;
        this.from = [this.u, this.d];
      }
    } else if (this.scene === 'carry') {
      this.k += dt / 0.9;
      const e = Math.min(1, this.k);
      this.u = this.from[0] + (R.chute[0] - this.from[0]) * e;
      this.d = this.from[1] + (R.chute[1] - this.from[1]) * e;
      if (this.k >= 1) {
        this.scene = 'release';
        this.k = 0;
      }
    } else if (this.scene === 'release') {
      this.k += dt / 0.7;
      this.open = Math.min(1, this.k * 2);
      if (this.held && this.k > 0.3) {
        this.prize = this.held.name || 'בובה';
        R.won(this.held);
        this.held = null;
        for (let i = 0; i < 4; i++) this.sfx([523, 659, 784, 1046][i], [523, 659, 784, 1046][i], 0.12, 0.05, i * 0.11);
      }
      if (this.k >= 1) {
        this.scene = 'done';
        this.k = 0;
      }
    } else if (this.scene === 'done') {
      this.k += dt;
      if (this.k > 0.6) this.api.finish(this.result());
      return;
    }
    R.set(this.u, this.d, this.y, this.open);
  }

  draw() {}
}
