import * as THREE from 'three';
import { damp, dampAngle } from '../core/util.js';
import { PIER_M } from '../world/mainland/plan.js';
import { WHEEL } from '../world/mainland/landmarks.js';
import { CAROUSEL } from '../world/mainland/pier.js';

// (v5, ROADMAP 11.17) The rides on Palisade Pier, to ride: up on the big wheel in a gondola (round
// once, the whole city under you, the bay and the island across it), the West Coaster from its
// front car (up the lift hill, the drop, the loop - seen as from the seat), a horse on the
// carousel. A ticket at the booth (or at the carousel's edge), E to get on; you get off where you
// got on when it has gone round (or with E, when the gondola is down at the platform).

const RIDES = {
  wheel: { at: [-1436, 721], r: 3.2, price: 5, heb: 'הגלגל הענק' },
  coaster: { at: [-1431.4, 651.8], r: 3.2, price: 8, heb: 'רכבת ההרים' },
  carousel: { at: [CAROUSEL.x, CAROUSEL.z], r: CAROUSEL.r + 4, price: 3, heb: 'הקרוסלה' },
};

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

export class Fairground {
  constructor(game) {
    this.game = game;
    this.ride = null;
    this.stats = { rides: 0 };
  }

  get L() {
    return this.game.world.landmarks;
  }

  // the ride whose ticket is here (or the one you are on)
  near() {
    const p = this.game.player.pos;
    if (Math.abs(p.z - 680) > 140 || Math.abs(p.x - PIER_M.x) > 80) return null;
    for (const [k, R] of Object.entries(RIDES)) {
      if (k === 'carousel' && !this.game.world.carousel) continue;
      if (Math.hypot(p.x - R.at[0], p.z - R.at[1]) < R.r) return k;
    }
    return null;
  }

  target() {
    if (this.ride) {
      if (this.ride.kind === 'wheel') return { label: this.ride.low ? 'E — לרדת מהגלגל' : 'למעלה בגלגל... (יורדים כשהתא למטה)' };
      return { label: `E — לרדת מ${RIDES[this.ride.kind].heb}` };
    }
    if (!this.L) return null;
    const k = this.near();
    if (!k) return null;
    const R = RIDES[k];
    return { label: `E — לעלות על ${R.heb} ($${R.price})`, kind: k };
  }

  interact() {
    const game = this.game;
    if (this.ride) {
      if (this.ride.kind === 'wheel' && !this.ride.low) {
        game.hud.toast('מחכים שהתא יגיע למטה...', 'info', 1.6);
        return true;
      }
      this.off();
      return true;
    }
    const t = this.target();
    if (!t || !t.kind) return false;
    const R = RIDES[t.kind];
    if (game.money && !game.money.pay(R.price, R.heb)) {
      game.hud.toast(game.money.why(R.price), 'bad', 2.4);
      return true;
    }
    this.on(t.kind);
    return true;
  }

  on(kind) {
    const game = this.game;
    const p = game.player;
    const L = this.L;
    const r = { kind, t: 0, from: p.pos.clone(), yaw: p.yaw, low: false, turned: 0 };
    if (kind === 'wheel') {
      // the gondola nearest the bottom
      const W = L.wheel;
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < W.N; k++) {
        const a = (k / W.N) * Math.PI * 2 + W.angle;
        const d = Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI)));
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      r.k = best;
      r.a0 = W.angle;
      W.fast = true;
      game.hud.toast('על הגלגל הענק: סיבוב אחד, כל העיר מתחת', 'good', 2.6);
    } else if (kind === 'coaster') {
      // into the front car: wait in the station for it if it is out on the track
      r.boarded = L.ride.state === 'wait';
      r.lap = false;
      // (in your seat: off in a moment)
      if (r.boarded) L.ride.wait = Math.min(L.ride.wait, 2.5);
      game.hud.toast(r.boarded ? 'בקרון הראשון! מחזיקים חזק' : 'הרכבת בדרך. מחכים בתחנה...', 'good', 2.4);
    } else {
      const C = game.world.carousel;
      // the horse nearest you on the outer ring
      let best = 0;
      let bd = Infinity;
      C.horses.forEach((h, i) => {
        const w = this.horseAt(C, i, _p);
        const d = Math.hypot(w.x - p.pos.x, w.z - p.pos.z) + (Math.hypot(h.x, h.z) < 5 ? 2 : 0);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      r.k = best;
      r.a0 = C.a;
      game.hud.toast('על סוס בקרוסלה!', 'good', 2.0);
    }
    this.ride = r;
    this.stats.rides++;
    game.audio.play('cheer', 0.4);
  }

  off() {
    const game = this.game;
    const p = game.player;
    const r = this.ride;
    if (!r) return;
    if (r.kind === 'wheel') this.L.wheel.fast = false;
    p.seat = null;
    p.fig.sit = 0;
    p.rideHidden = false;
    // back where you got on
    p.pos.copy(r.from);
    p.vel.set(0, 0, 0);
    this.ride = null;
    game.hud.toast(r.kind === 'coaster' ? 'וואו! עוד סיבוב?' : 'היה כיף!', 'good', 1.8);
  }

  // where horse i of the carousel is now, in the world
  horseAt(C, i, out) {
    const h = C.horses[i];
    const a = C.turn.rotation.y;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.set(CAROUSEL.x + h.x * c + h.z * s, PIER_M.deck + 1.95 + Math.sin(C.t * 2.4 + h.ph) * 0.32, CAROUSEL.z - h.x * s + h.z * c);
    return out;
  }

  // the train waits in the station a little longer while you are at its gate (half a minute at
  // most: then it goes, and the next one is yours)
  holdTrain(dt) {
    const L = this.L;
    if (!L) return;
    const C = L.ride;
    const p = this.game.player.pos;
    const R = RIDES.coaster;
    const near = !this.ride && Math.hypot(p.x - R.at[0], p.z - R.at[1]) < 9 && p.y > PIER_M.deck - 1;
    if (C.state !== 'wait') C.holdT = 0;
    else if (near) C.holdT = (C.holdT || 0) + dt;
    C.hold = near && C.state === 'wait' && C.holdT < 30;
  }

  // the coaster heard from round about: the chain on the lift, the riders on the drop
  sounds(dt) {
    const L = this.L;
    if (!L) return;
    const C = L.ride;
    const cam = this.game.camera.position;
    C.G.mats[0].decompose(_p, _q, _s);
    const d = Math.hypot(cam.x - _p.x, cam.y - _p.y, cam.z - _p.z);
    if (d > 160) return;
    const k = Math.max(0, 1 - d / 160);
    const audio = this.game.audio;
    if (C.state === 'lift') {
      this.clankT = (this.clankT || 0) - dt;
      if (this.clankT <= 0) {
        this.clankT = 0.32;
        audio.play('clank', 0.9 * k);
      }
    }
    // (the first time it goes fast after the lift, every lap)
    if (C.state === 'run' && C.v > 9 && !this.screamed) {
      this.screamed = true;
      audio.play('scream', 1.1 * k);
    }
    if (C.state !== 'run') this.screamed = false;
  }

  update(dt) {
    this.sounds(dt);
    this.holdTrain(dt);
    const r = this.ride;
    if (!r) return;
    const game = this.game;
    const p = game.player;
    const L = this.L;
    r.t += dt;
    if (!L || p.mode === 'dead' || p.inVehicle) {
      this.ride = null;
      p.seat = null;
      return;
    }
    if (r.kind === 'wheel') {
      const W = L.wheel;
      const a = (r.k / W.N) * Math.PI * 2 + W.angle;
      const x = W.x - Math.sin(a) * W.R;
      const y = W.y + Math.cos(a) * W.R - 2.75;
      r.low = Math.cos(a) < -0.96 && W.angle - r.a0 > 0.6;
      p.seat = { x, y, z: W.z, yaw: Math.PI, lock: true, ride: true };
      // (once round: off at the platform)
      if (W.angle - r.a0 > Math.PI * 2 - 0.05 && r.low) this.off();
    } else if (r.kind === 'coaster') {
      const C = L.ride;
      if (!r.boarded) {
        // waiting on the platform for the train to come in
        p.seat = { x: -1435.2, y: PIER_M.deck + 0.9, z: 660, yaw: -Math.PI / 2, lock: true, ride: true, stand: true };
        if (C.state === 'wait') {
          r.boarded = true;
          C.wait = Math.min(C.wait, 2.5);
          game.hud.toast('בקרון הראשון! מחזיקים חזק', 'good', 2.0);
        }
        return;
      }
      // in the front car, as it goes
      C.G.mats[0].decompose(_p, _q, _s);
      const up = _s.set(0, 1, 0).applyQuaternion(_q);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(_q);
      p.seat = { x: _p.x + up.x * 0.4, y: _p.y + up.y * 0.4 - 0.3, z: _p.z + up.z * 0.4, yaw: Math.atan2(fwd.x, fwd.z), lock: true, ride: true };
      p.rideHidden = true;
      if (C.state !== 'wait') r.lap = true;
      if (r.lap && C.state === 'wait') this.off();
    } else {
      const C = game.world.carousel;
      if (!C) {
        this.off();
        return;
      }
      const w = this.horseAt(C, r.k, _p);
      const h = C.horses[r.k];
      const a = Math.atan2(h.z, h.x) - C.turn.rotation.y;
      p.seat = { x: w.x, y: w.y - 0.55, z: w.z, yaw: Math.PI - a, lock: true, ride: true };
      if (C.a - r.a0 > Math.PI * 4) this.off();
    }
  }

  // the camera's distance on the wheel and the carousel (null: as on foot)
  camOpts() {
    const r = this.ride;
    if (!r || r.kind === 'coaster') return null;
    return r.kind === 'wheel' ? { dist: 9, height: 1.4, shoulder: 0 } : { dist: 5.5, height: 1.6, shoulder: 0 };
  }

  // the camera while on a ride: on the coaster it is your eyes in the front car (the track's own
  // way up, over in the loop); true when it has set the camera
  cam(dt) {
    const r = this.ride;
    if (!r || r.kind !== 'coaster' || !r.boarded) return false;
    const C = this.L.ride;
    const cam = this.game.camera;
    C.G.mats[0].decompose(_p, _q, _s);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(_q);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(_q);
    // (in the front row, between the two who sit there, eyes over the car's nose)
    cam.position.set(_p.x + up.x * 1.5 + fwd.x * 0.5, _p.y + up.y * 1.5 + fwd.y * 0.5, _p.z + up.z * 1.5 + fwd.z * 0.5);
    // (looking along the track, a little down the way it goes: a camera looks along its -z)
    _m.lookAt(new THREE.Vector3(0, 0, 0), fwd.clone().addScaledVector(up, -0.16), up);
    _q.setFromRotationMatrix(_m);
    cam.quaternion.slerp(_q, 1 - Math.exp(-12 * dt));
    // (the mouse still looks round, as on foot: kept for when you are off again)
    _e.setFromQuaternion(cam.quaternion, 'YXZ');
    this.game.camRig.yaw = _e.y - Math.PI;
    this.game.camRig.pitch = damp(this.game.camRig.pitch, 0, 4, dt);
    void dampAngle;
    return true;
  }
}
