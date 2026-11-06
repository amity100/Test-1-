// (v5, ROADMAP 18.9 round 10) the prologue played by itself, for its maker to watch: the admin's
// film viewer (ui/admin.js) asks for it. Where the story hands the keys over - the tour (a walk, a
// shop and something bought in it, a car, a drive, the pen), the pier, the man, the wheel, the
// questions, the car park's climb, the ramp drawn, the jump, the way down, the beach - it plays
// them, a cut here and there where the way is long; where the film holds the keys, it waits.
import { PARK } from './carpark.js';

const LILY_SEAT = { x: 40.2, z: 233.0 };
const VIEW = { x: 63.5, z: 238.9 };
const SITE = { x: 101.5, z: 242.6 };
const LOOKOUT = { x: 60, z: 298 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the climb (round 11's car park): along a lane into the turn at the end of the floor, across it,
// into the other lane, up its ramp - floor after floor - and on the roof round the north end's turn
// into the run, west of its barriers
const RN = PARK.main.zN;
const RS = PARK.main.zS;
const WLC = (PARK.lanes.W[0] + PARK.lanes.W[1]) / 2;
const ELC = (PARK.lanes.E[0] + PARK.lanes.E[1]) / 2;
const MX = PARK.main.xc;
// (each ramp's foot come at straight along its lane: a point well short of it, in the lane, then the
// ramp itself - a third number, how near is near enough, where it must be close)
const UP = [[ELC, 268]];
// (where the way up each floor starts in it: after a reset to a floor, the way on from there)
const UP_AT = [];
for (const r of PARK.ramps) {
  UP_AT[r.k] = UP.length;
  if (r.zLow === RN) UP.push([ELC, RN - 2], [ELC - 6, PARK.turnN], [MX, PARK.turnN - 4], [WLC + 2, PARK.turnN - 2], [WLC, RN - 8, 3], [WLC, RN + 3, 3], [WLC, RS + 5]);
  else UP.push([WLC, RS + 2], [WLC + 6, PARK.turnS], [MX, PARK.turnS + 4], [ELC - 2, PARK.turnS + 2], [ELC, RS + 8, 3], [ELC, RS - 3, 3], [ELC, RN - 5]);
}
UP.push([ELC - 5, PARK.turnN], [MX, PARK.turnN - 3], [PARK.runup.x, PARK.turnN], [PARK.runup.x, RN + 12]);
// and down Bayshore: a ramp a floor, round at the west end, round in the cross aisle
const DOWN = [[-190, 340.6]];
for (let k = 7; k >= 0; k--) {
  if (k % 2 === 1) DOWN.push([-204, 340.6], [-238, 340.6], [-245, 336], [-245, 328]);
  else {
    DOWN.push([-234, 323.4], [-200, 323.4]);
    if (k > 0) DOWN.push([-194, 328], [-194, 336]);
  }
}
DOWN.push([-195.5, 323.4], [-195.5, 310]);

export class Autopilot {
  constructor(P) {
    this.P = P;
    this.g = P.game;
    const inp = this.g.input;
    // (the player's own sticks, given back at the end: kept by lock() while the film has them)
    this.orig = P.saveRead || inp.readMove;
    this.mv = { x: 0, y: 0, sprint: false };
    this.mine = () => this.mv;
    this.phase = '';
    this.wp = 0;
    this.did = {};
    this.stuck = 0;
    this.back = 0;
    this.dt = 0.016;
  }

  // (back at where he came onto floor k - caught, or the car wrecked: the way on from there)
  onReset(k) {
    if (this.phase === 'up') this.wp = UP_AT[k] !== undefined ? UP_AT[k] : 0;
    this.stuck = 0;
    this.back = 0;
  }

  stop() {
    const P = this.P;
    const inp = this.g.input;
    inp.flyUp = false;
    inp.flyDown = false;
    if (P.saveRead === this.mine) P.saveRead = this.orig;
    if (inp.readMove === this.mine) inp.readMove = this.orig;
  }

  set(x, y, sprint = false) {
    this.mv = { x, y, sprint };
  }

  once(k, fn) {
    if (this.did[k] !== undefined) return;
    this.did[k] = this.g.time;
    fn();
  }

  since(k) {
    return this.did[k] !== undefined ? this.g.time - this.did[k] : -1;
  }

  press(k) {
    this.g.input.pressed.add(k);
  }

  walkTo(x, z, run = false, near = 1.2) {
    const g = this.g;
    const p = g.player;
    const want = Math.atan2(x - p.pos.x, z - p.pos.z);
    g.camRig.yaw += wrap(want - g.camRig.yaw) * Math.min(1, this.dt * 12);
    const d = Math.hypot(x - p.pos.x, z - p.pos.z);
    this.set(0, d > near ? 1 : 0, run && d > 4);
    return d;
  }

  driveTo(x, z, top = 0.85) {
    const c = this.g.player.inVehicle;
    if (!c) return 99;
    const da = wrap(Math.atan2(x - c.pos.x, z - c.pos.z) - c.yaw);
    let thr = top;
    if (Math.abs(da) > 0.6 && Math.abs(c.speed) > 8) thr = 0.1;
    if (Math.abs(da) > 1.1 && Math.abs(c.speed) > 5) thr = -0.4;
    // (near the point and well off it: slow, not round and round it)
    const dist = Math.hypot(x - c.pos.x, z - c.pos.z);
    if (dist < 12 && Math.abs(da) > 0.5) thr = Math.min(thr, Math.abs(c.speed) > 6 ? -0.3 : 0.35);
    let steer = Math.max(-1, Math.min(1, da * 2.2));
    // (against something: back off a moment, the wheel the other way, and on)
    if (thr > 0.3 && Math.abs(c.speed) < 1.0) this.stuck += this.dt;
    else this.stuck = Math.max(0, this.stuck - this.dt / 2);
    if (this.stuck > 1.4) {
      this.stuck = 0;
      this.back = 1.0;
    }
    if (this.back > 0) {
      this.back -= this.dt;
      thr = -0.8;
      steer = -steer;
    }
    this.set(-steer, thr);
    return Math.hypot(x - c.pos.x, z - c.pos.z);
  }

  put(c, x, y, z, yaw, sp = 0) {
    c.pos.set(x, y, z);
    c.yaw = yaw;
    c.speed = sp;
    if ('vx' in c) {
      c.vx = Math.sin(yaw) * sp;
      c.vz = Math.cos(yaw) * sp;
    }
  }

  follow(list, near = 5, top = 0.8) {
    const c = this.g.player.inVehicle;
    if (!c) return;
    while (this.wp < list.length && Math.hypot(list[this.wp][0] - c.pos.x, list[this.wp][1] - c.pos.z) < (list[this.wp][2] || near)) this.wp++;
    if (this.wp >= list.length) {
      this.set(0, 0);
      return;
    }
    this.driveTo(list[this.wp][0], list[this.wp][1], top);
  }

  // (the ramp, drawn as a player would: a line along the roof ahead to its edge, bowed up)
  drawRamp(c, D) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const Ln = Math.max(10, (PARK.edge.z - c.pos.z) * Math.abs(fz) + 1.5);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const d = 4 + ((Ln - 4) * i) / 24;
      const x = c.pos.x + fx * d;
      const z = c.pos.z + fz * d;
      const q = D.toScreen(x, D.floorY(x, z) + 0.04, z, [0, 0]);
      if (q) pts.push([q[0], q[1]]);
    }
    if (pts.length > 3) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const cl = Math.hypot(b[0] - a[0], b[1] - a[1]);
      pts.forEach((p, i) => {
        p[1] -= Math.sin((Math.PI * i) / (pts.length - 1)) * cl * 0.14;
      });
    }
    D.pts = pts;
    D.finish();
    this.phase = 'drawn';
  }

  // every frame, before the game reads its keys
  tick(dt) {
    this.dt = Math.min(0.1, dt || 0.016);
    try {
      this.step();
    } catch (e) {
      this.set(0, 0);
    }
  }

  step() {
    const g = this.g;
    const P = this.P;
    const pl = g.player;
    const L = P.cast && P.cast.lily;
    const c = pl.inVehicle;
    const o = P.objKey || '';
    const n = P.sceneN || 0;
    // (the ramp drawn: the screen is the player's while the time all but stands - still locked)
    if (n === 7 && c && P.draw && P.draw.on && this.phase !== 'drawn') {
      this.drawRamp(c, P.draw);
      return;
    }
    // (round 12: the rotor drawn on the car in the air - a line across over its roof, as a hand draws
    // it, on the pen's own page; again if it did not take)
    if (P.drawingRotor && c) {
      const fd = g.freedraw;
      // (a beat first, the teaching pencil seen at its line - as a player would watch it)
      this.once('rotorSeen', () => {});
      const seen = (performance.now() - (this.seenAt || (this.seenAt = performance.now()))) / 1000;
      if (fd && fd.isOpen && seen > 2.2 && (this.since('rotor') < 0 || this.since('rotor') > 3.5)) {
        this.did.rotor = g.time;
        this.drawRotor(c);
      }
      this.set(0, 0);
      return;
    }
    // (the film's own walking while it holds the keys: lock's readMove - not touched then)
    if (P.holdCam || P.locked) {
      this.set(0, 0);
      return;
    }
    g.input.readMove = this.mine;
    // ---- 1. the tour
    if (n === 1) return this.tour(o, pl, c);
    // ---- 2-4. Lily, the pier, the wheel, the questions
    if (n === 2) {
      if (/pier/.test(o)) {
        this.once('topier', () => {
          P.putDanny(VIEW.x + 2, VIEW.z + 1, 0);
          if (L) {
            P.put(L, VIEW.x, VIEW.z);
            L.pl.follow = true;
          }
        });
      }
      this.set(0, 0);
      return;
    }
    if (n === 3) {
      const m = P.cast.mark;
      if (/Follow/.test(o) && m && m.alive) {
        this.walkTo(m.pos.x, m.pos.z, true, 2.5);
        return;
      }
      if (/Go back to/.test(o) && L) {
        this.once('back', () => P.putDanny(L.pos.x + 2.4, L.pos.z + 1.2, Math.atan2(-2.4, -1.2)));
        this.walkTo(L.pos.x, L.pos.z, false, 1.6);
        return;
      }
      if (/wheel/.test(o)) {
        this.walkTo(SITE.x, SITE.z, false, 2);
        return;
      }
      if (L) this.walkTo(L.pos.x, L.pos.z, false, 1.6);
      return;
    }
    if (n === 4 || n === 5) {
      const S = PARK.dannyStop;
      if (/car/.test(o) || n === 5) {
        if (c) return;
        // (a cut to the car park's door, the way there being long)
        if (Math.hypot(pl.pos.x - S.x, pl.pos.z - S.z) > 14) {
          P.putDanny(S.x + 7, S.z + 1, -Math.PI / 2);
          if (L) {
            P.put(L, S.x + 8, S.z + 2, -Math.PI / 2);
            L.pl.follow = true;
          }
        }
        this.walkTo(S.x, S.z, false, 1);
        return;
      }
      if (/wheel/.test(o)) {
        this.walkTo(SITE.x, SITE.z, false, 2);
        return;
      }
      this.set(0, 0);
      return;
    }
    // ---- 6-9. the car park
    if (n === 6) {
      if (this.phase !== 'up') {
        this.phase = 'up';
        this.wp = 0;
      }
      this.follow(UP, 5, 0.85);
      return;
    }
    if (n === 7 && c) {
      const D = P.draw;
      if (!(D && D.on) && this.phase !== 'drawn' && c.pos.z < PARK.edge.z - 62) {
        const z = PARK.edge.z - 60.5;
        const x = PARK.runup.x;
        const y = PARK.floorAt(x, z, PARK.edge.y + 2);
        this.put(c, x, (Number.isFinite(y) ? y : PARK.edge.y) + 0.06, z, 0, 14);
        this.phase = 'run';
      } else this.set(0, 1);
      return;
    }
    if (n === 8 && c && !P.jump) {
      this.set(0, 1);
      this.once('s8', () => {});
      if (this.since('s8') > 5 && P.ramp && P.ramp.P && P.draw && P.draw.F) {
        this.once('lip', () => {
          const prof = P.ramp.P;
          const F = P.draw.F;
          const [cx] = F.toLocal(c.pos.x, c.pos.z);
          const [dx, dz] = F.toWorld(prof.lipX + 0.4 - cx, 0);
          c.pos.set(c.pos.x + dx, P.draw.spec.roofY + prof.h * 0.95, c.pos.z + dz);
          c.speed = 22;
        });
      }
      return;
    }
    if (n === 9 && c) return this.flyHome(c);
    this.set(0, 0);
  }

  tour(o, pl, c) {
    const g = this.g;
    if (/Explore/.test(o)) {
      this.set(0, 1, false);
      return;
    }
    if (/shop/.test(o)) {
      this.once('shop', () => {
        const SL = g.streetlife;
        const shops = SL && SL.active ? [...SL.active.values()].filter((a) => a.open && a.keeper && a.keeper.alive && a.room && /cafe|grocery|tacos|bakery|deli|pizza|diner|juice|ice/.test((a.shop && a.shop.kind) || '')) : [];
        let best = null;
        let bd = 1e9;
        for (const a of shops) {
          const d = Math.hypot(a.keeper.pos.x - pl.pos.x, a.keeper.pos.z - pl.pos.z);
          if (d < bd) {
            bd = d;
            best = a;
          }
        }
        this.shop = best;
        if (best) {
          const k = best.keeper.pos;
          pl.pos.set(k.x + 1.6, k.y || 0, k.z + 0.4);
          g.camRig.yaw = Math.atan2(k.x - pl.pos.x, k.z - pl.pos.z);
        }
      });
      const a = this.shop;
      if (a) {
        const k = a.keeper.pos;
        const d = this.walkTo(k.x, k.z, false, 1.3);
        if (d < 1.6 && this.since('shop') > 1.2) this.once('buy', () => g.streetlife.interact());
        if (this.since('buy') > 1.4 && g.dialog && g.dialog.open) this.once('pick', () => g.dialog.pick(0));
      } else this.set(0, 1);
      return;
    }
    if (/Take a/.test(o)) {
      this.once('car', () => {
        let best = null;
        let bd = 1e9;
        for (const q of (g.traffic && g.traffic.parked) || []) {
          if (!q.parkedCar || q.gone) continue;
          const d = Math.hypot(q.pos.x - pl.pos.x, q.pos.z - pl.pos.z);
          if (d < bd) {
            bd = d;
            best = q;
          }
        }
        this.car = best;
        if (best) {
          const fx = Math.sin(best.yaw);
          const fz = Math.cos(best.yaw);
          pl.pos.set(best.pos.x + fz * 2.2, 0.1, best.pos.z - fx * 2.2);
        }
      });
      if (this.car && !c) {
        const d = this.walkTo(this.car.pos.x, this.car.pos.z, false, 1.8);
        if (d < 2.6 && this.since('car') > 0.8) this.press('KeyE');
      }
      return;
    }
    if (/Drive/.test(o) && c) {
      this.set(0, 0.8);
      return;
    }
    if (/Draw/.test(o)) {
      this.set(0, 0.2);
      this.once('pen', () => {
        if (g.freedraw) g.freedraw.show();
      });
      if (this.since('pen') > 3.2) {
        this.once('penshut', () => {
          if (g.freedraw) g.freedraw.close();
        });
      }
      return;
    }
    if (/Lily/.test(o)) {
      if (c) {
        this.once('tolily', () => this.put(c, 24.5, c.pos.y || 0.2, 214, 0.35, 6));
        if (this.since('tolily') > 2.2) this.press('KeyE');
        else this.set(0, 0.3);
        return;
      }
      this.walkTo(LILY_SEAT.x, LILY_SEAT.z, true, 1);
      return;
    }
    this.set(0, 0);
  }

  // the line over the roof drawn as a pointer would: down, across, up
  drawRotor(c) {
    const cv = typeof document !== 'undefined' ? document.getElementById('fd-air') : null;
    if (!cv || !this.P.rotorLine) return;
    const [[x0, y0], [x1, y1]] = this.P.rotorLine(c);
    const ev = (type, x, y) => {
      try {
        cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 71, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, pointerType: 'mouse' }));
      } catch (e) {
        // (no pointer events here)
      }
    };
    ev('pointerdown', x0, y0);
    for (let i = 1; i <= 16; i++) ev('pointermove', x0 + ((x1 - x0) * i) / 16, y0 + ((y1 - y0) * i) / 16);
    ev('pointerup', x1, y1);
  }

  // (round 12) on its rotor to the beach: high over the hotels, on, and down onto the sand
  flyHome(c) {
    const g = this.g;
    const inp = g.input;
    const flying = !!(c.fz && c.fz.rotor > 0) && c.air;
    const d = Math.hypot(LOOKOUT.x - c.pos.x, LOOKOUT.z - c.pos.z);
    if (!flying) {
      inp.flyUp = false;
      inp.flyDown = false;
      this.set(0, c.speed > 1 ? -0.6 : 0);
      return;
    }
    inp.flyUp = d > 40 && c.pos.y < 52;
    inp.flyDown = d < 24;
    if (d < 24) {
      this.set(0, 0);
      return;
    }
    // (as a helicopter is flown: turned to it first, then on - slower the nearer it is)
    const da = wrap(Math.atan2(LOOKOUT.x - c.pos.x, LOOKOUT.z - c.pos.z) - c.yaw);
    const steer = Math.max(-1, Math.min(1, da * 2.2));
    const on = Math.abs(da) > 0.5 ? 0 : d > 70 ? 1 : d > 35 ? 0.45 : 0.22;
    this.set(-steer, on);
  }

  away(o, c) {
    if (/street/.test(o)) {
      if (this.phase !== 'down') {
        this.phase = 'down';
        this.wp = 0;
        this.once('down', () => {});
      }
      // (the first ramps driven - then, a cut, the last of the way down: the street floor at the gate)
      if (this.since('down') > 9) this.once('gate', () => this.put(c, -195.5, 0.25, 326, Math.PI, 4));
      if (this.did.gate !== undefined) {
        this.driveTo(-195.5, 300, 0.6);
        return;
      }
      this.follow(DOWN, 3.5, 0.6);
      return;
    }
    if (/Lose/.test(o)) {
      this.once('lose', () => {});
      if (this.since('lose') > 4) this.once('beach', () => this.put(c, LOOKOUT.x - 13, 0.5, LOOKOUT.z - 6, 0.7, 8));
      this.driveTo(LOOKOUT.x, LOOKOUT.z, this.did.beach !== undefined ? 0.4 : 0.9);
      return;
    }
    if (/quiet/.test(o)) {
      const d = Math.hypot(LOOKOUT.x - c.pos.x, LOOKOUT.z - c.pos.z);
      if (d < 10) this.set(0, c.speed > 1 ? -0.6 : 0);
      else this.driveTo(LOOKOUT.x, LOOKOUT.z, 0.5);
      return;
    }
    this.set(0, 0);
  }
}
