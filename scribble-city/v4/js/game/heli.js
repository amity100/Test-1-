import * as THREE from 'three';
import { groundHeight } from '../world/layout.js';

// (ROADMAP 6.2, not with ?classic) The police helicopter (the one the city's sky already has:
// game/ambient.js turns it into the police's at three stars) does its job:
//   - it circles where they think you are, and its searchlight sweeps the ground round that place
//   - in the light, with nothing over you (a roof, a bridge, a shop's ceiling, a hiding place),
//     you are seen: the radio tells every officer where you are, and the marksman in its door
//     shoots
//   - out of the light the search goes on round the last place they saw you, marked on the
//     minimap and on the map (ui/hud.js, ui/citymap.js)
// The light keeps up with somebody running, not with a fast car.

const SPOT_R = 6.5; // the searchlight's circle on the ground (metres)
const SWEEP = 9; // how far it sweeps round the place they look at
const LIGHT = [2.4, 2.25, 1.7]; // brighter than white: it glows
const _a = new THREE.Vector3();

export class Heli {
  constructor(game) {
    this.game = game;
    this.spot = new THREE.Vector3(); // where the light is on the ground
    this.on = false;
    this.fireT = 2;
    this.sweepA = 0;
    this.sees = false;
    this.told = false;
    this.stats = { spotted: 0, shots: 0 };
  }

  // the helicopter of game/ambient.js, while it is the police's
  get body() {
    const h = this.game.ambient && this.game.ambient.heli;
    return h && h.livery === 'police' ? h.group.position : null;
  }

  // you, under something the light can't get through
  covered(at, pp) {
    const game = this.game;
    if (game.player.hidden || game.inBar) return true;
    const S = game.streetlife;
    if (S && S.active) for (const a of S.active.values()) if (a.room && a.room.inside(pp.x, pp.z, 0)) return true;
    return !game.world.collision.lineOfSight(at.x, at.y - 1.5, at.z, pp.x, pp.y + 1.2, pp.z);
  }

  update(dt) {
    const game = this.game;
    const P = game.police;
    const at = this.body;
    if (!at || P.level < 3) {
      this.on = false;
      this.sees = false;
      return;
    }
    const p = game.player;
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    if (!this.on) {
      this.on = true;
      this.spot.set(at.x, 0, at.z);
    }
    // the light goes where they think you are, sweeping round it (and sits on you while it has you)
    this.sweepA += dt * 0.9;
    const T = P.target();
    const r = this.sees ? 0 : SWEEP * (0.6 + 0.4 * Math.sin(this.sweepA * 0.7));
    const tx = this.sees ? pp.x : T.x + Math.cos(this.sweepA) * r;
    const tz = this.sees ? pp.z : T.z + Math.sin(this.sweepA * 1.3) * r;
    const k = 1 - Math.exp(-dt * (this.sees ? 3.2 : 1.1));
    this.spot.x += (tx - this.spot.x) * k;
    this.spot.z += (tz - this.spot.z) * k;
    this.spot.y = groundHeight(this.spot.x, this.spot.z);
    const was = this.sees;
    this.sees = Math.hypot(pp.x - this.spot.x, pp.z - this.spot.z) < SPOT_R && !this.covered(at, pp);
    if (!this.sees) {
      this.fireT = Math.max(this.fireT, 0.8);
      return;
    }
    if (!was) this.stats.spotted++;
    P.spotted();
    if (!this.told) {
      this.told = true;
      game.hud.toast('המסוק רואה אתכם! להיכנס מתחת לגג, או לברוח מהאור', 'bad', 2.8);
    }
    // the marksman in the door
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = 1.5 + Math.random() * 0.8;
      const y0 = at.y - 1.2;
      _a.set(pp.x - at.x + (Math.random() - 0.5) * 1.6, pp.y + (p.inVehicle ? 1.0 : 1.2) - y0, pp.z - at.z + (Math.random() - 0.5) * 1.6).normalize();
      game.weapons.spawnEnemyShot(at.x, y0, at.z, _a.x, _a.y, _a.z, 9, 70, null, 'ink');
      game.audio.play('enemyShot', 0.5);
      this.stats.shots++;
    }
  }

  // the light: pen lines down from the helicopter to its circle on the ground
  draw() {
    if (!this.on) return;
    const at = this.body;
    if (!at) return;
    const fr = this.game.figures;
    const s = this.spot;
    const night = this.game.daynight ? this.game.daynight.night || 0 : 0;
    const a = 0.32 + 0.4 * night;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2;
      const t1 = ((i + 1) / n) * Math.PI * 2;
      const x0 = s.x + Math.cos(t0) * SPOT_R;
      const z0 = s.z + Math.sin(t0) * SPOT_R;
      const x1 = s.x + Math.cos(t1) * SPOT_R;
      const z1 = s.z + Math.sin(t1) * SPOT_R;
      fr.lineXYZ(x0, s.y + 0.06, z0, x1, s.y + 0.06, z1, LIGHT, 4, 900 + i, a + 0.25, 0.01, 0);
      if (i % 2 === 0) fr.lineXYZ(at.x, at.y - 1.4, at.z, x0, s.y + 0.1, z0, LIGHT, 2.2, 920 + i, a * 0.55, 0.004, 0);
    }
    if (this.sees) {
      // got you: a cross over the circle
      fr.lineXYZ(s.x - SPOT_R * 0.5, s.y + 0.08, s.z, s.x + SPOT_R * 0.5, s.y + 0.08, s.z, LIGHT, 3, 950, a, 0.01, 0);
      fr.lineXYZ(s.x, s.y + 0.08, s.z - SPOT_R * 0.5, s.x, s.y + 0.08, s.z + SPOT_R * 0.5, LIGHT, 3, 951, a, 0.01, 0);
    }
  }
}

// where the police are looking for you, out of sight (for the maps): the place and how far round
// it, or null
export function searchArea(game) {
  const P = game.police;
  if (game.classic || !P || P.level <= 0 || !P.searching) return null;
  return { x: P.lastSeen.x, z: P.lastSeen.z, r: 30 + P.level * 8 };
}
