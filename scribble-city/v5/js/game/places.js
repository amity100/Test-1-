import { Kit, itemMats } from './items.js';
import { addLight, flashLight } from '../render/materials.js';
import { groundHeight } from '../world/layout.js';
import { Route } from '../world/roofs.js';
import { buildGarage, GAR } from './placegarage.js';
import { buildParkRoof, PARK_ROOF, buildHelipad, PAD, buildSurfRoof, SURF } from './placeroofs.js';
import { VanDriver } from './placedrive.js';
import { Gym } from './placegym.js';

// (ROADMAP 29.5) The places of the first five drawings found in the city (game/finds.js), built on the island at run time
// with the Kit the prologue's car park is built with (game/items.js, game/prologue/carpark.js):
//   rocket     NITRO WORKS, the racing garage across 5th Street from 5th Street Garage: its planning board (placegarage.js)
//   wings      5th Street Garage's roof, by the edge the car flew from: the motor room's wall to the roof run (placeroofs.js)
//   inkhawk    the helipad on the low roof between downtown's second tower and 13th Street: the board on its stair's house
//   dualrotor  The Calypso's surf club on its roof, across Ocean Drive from the pier: the back of its sign
//   hoverbike  SALT & SPANNER, the surfers' mechanic going round Hotel Row and the beach front: the board inside its side
//              that lifts, while it stands at a stop (placedrive.js, placevan.js)
//   ironfists  9TH STREET GYM, the boxing gym on the corner of Meridian and 9th Street (the two buildings there taken out at run
//              time): the office's wall to the room; its ring, its bags, its coach (placegym.js, game/boxing.js)
// A spot: { x, y, z, nx, ny, nz, ux, uy, uz, w } - the middle of the drawing, its surface's way out, its up along the
// surface, its width; the van's also parked (true while its side is up) and moves, the same object kept up to date.
//
// Built once the opening story is over (not while it is told: the garage stands under the car's flight off the roof, the
// motor room in the edge's shots) - all at once by build(), or by update() itself a place a frame from the first frame it
// may be (each 15-50 ms on a computer, the garage the most).

// past this far from the camera a place is not drawn (each its own: the helipad is seen from the towers round it)
const FAR = { garage: 280, parkroof: 320, helipad: 360, surf: 300, van: 220 };

export class Places {
  constructor(game) {
    this.game = game;
    this.built = false;
    this.list = [];
    this.cols = [];
    this.routes = [];
    this.lights = [];
    this.van = null;
    this.spots = { rocket: null, wings: null, inkhawk: null, dualrotor: null, hoverbike: null, ironfists: null };
    this.gym = null;
    // (per place: its draws - one a pen - and its triangles)
    this.stats = {};
  }

  // the world is there, and the opening story neither being told nor about to be
  ready() {
    const g = this.game;
    if (!g.world || !g.scene || g.classic || g.lab) return false;
    const P = g.prologue;
    if (P && (P.active || (!P.done && P.wants && P.wants()))) return false;
    return true;
  }

  spot(id) {
    return this.spots[id] || null;
  }

  // ------------------------------------------------------------------ all of them
  // (at once: build(); a place a frame, so that none of them stops a frame for long: update() does it by itself)
  build() {
    if (!this.ready()) return false;
    while (!this.built) this.step();
    return true;
  }

  // the next place not built yet
  step() {
    const g = this.game;
    const w = g.world;
    const M = itemMats();
    const col = w.collision;
    const wall = this.wall || (this.wall = (x0, z0, x1, z1, y0, y1, tag = 'wall') => this.cols.push(col.addBox(x0, z0, x1, z1, y0, y1, tag)));
    const k = (this.stepN = (this.stepN || 0) + 1);
    if (k === 1) {
      // ---- NITRO WORKS
      const Y0 = groundHeight((GAR.x0 + GAR.x1) / 2, (GAR.z0 + GAR.z1) / 2);
      const KG = new Kit();
      buildGarage(KG, KG, M, Y0, wall);
      this.add('garage', KG, 0.31, (GAR.x0 + GAR.x1) / 2, (GAR.z0 + GAR.z1) / 2);
      const B = GAR.board;
      this.spots.rocket = { x: B.x, y: Y0 + B.y, z: GAR.z1 - GAR.wall - 0.072, nx: 0, ny: 0, nz: -1, ux: 0, uy: 1, uz: 0, w: 3.0 };
      // (the curb before its door clear of a parked car; the people's ways round it worked out again)
      this.clearCurb([[GAR.door[0] - 3.5, 303, GAR.door[1] + 1, 309.5]]);
      if (w.nav && w.nav.queueRefresh) w.nav.queueRefresh(GAR.x0 - 3, 306, GAR.x1 + 3, GAR.z1 + 3);
      this.lights.push(addLight(-171, Y0 + 5.2, 329, 15, [0.85, 0.92, 1.0], 1.5));
      this.lights.push(addLight(-169, Y0 + 4.6, 321, 10, [1.0, 0.94, 0.84], 1.0));
      this.lights.push(addLight(-168, Y0 + 5.0, 315.5, 9, [1.0, 0.45, 0.8], 0.9));
      this.lights.push(addLight(-181.2, Y0 + 3.4, 315.6, 8, [1.0, 0.86, 0.66], 0.8));
      this.lights.push(addLight(-160.6, Y0 + 3.4, 315.6, 8, [1.0, 0.86, 0.66], 0.8));
    } else if (k === 2) {
      // ---- the car park's roof by the edge
      const KP = new Kit();
      buildParkRoof(KP, M, wall);
      const R = PARK_ROOF.room;
      this.add('parkroof', KP, 0.37, (R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2);
      this.spots.wings = { x: (R.x0 + R.x1) / 2, y: PARK_ROOF.y + 1.5, z: R.z0 - 0.012, nx: 0, ny: 0, nz: -1, ux: 0, uy: 1, uz: 0, w: 3.0 };
      this.lights.push(addLight((R.x0 + R.x1) / 2, PARK_ROOF.y + 4.2, R.z0 - 3, 7, [1.0, 0.9, 0.75], 0.8));
    } else if (k === 3) {
      // ---- the helipad (on its roof, however high it was built)
      const padY = this.roofAt(PAD.x, PAD.z, 18.95);
      const KH = new Kit();
      buildHelipad(KH, M, wall, padY);
      this.add('helipad', KH, 0.43, PAD.x - 2, PAD.z);
      const H = PAD.hut;
      this.spots.inkhawk = { x: H.x1 + 0.112, y: padY + PAD.board.y, z: PAD.board.z, nx: 1, ny: 0, nz: 0, ux: 0, uy: 1, uz: 0, w: 3.0 };
      this.lights.push(addLight(PAD.x, padY + 3.2, PAD.z, 10, [0.9, 0.95, 1.0], 0.8));
      this.lights.push(addLight(H.x1 + 1.4, padY + 3.0, PAD.board.z, 5, [1.0, 0.9, 0.72], 0.8));
    } else if (k === 4) {
      // ---- The Calypso's surf club, its ladder from the alley
      const surfY = this.roofAt((SURF.x0 + SURF.x1) / 2, (SURF.z0 + SURF.z1) / 2, 11.75);
      const KS = new Kit();
      buildSurfRoof(KS, M, wall, surfY);
      this.add('surf', KS, 0.53, (SURF.x0 + SURF.x1) / 2, (SURF.z0 + SURF.z1) / 2);
      const SG = SURF.sign;
      // (the lower half of the sign's back, the height of a face: its upper half over the parapet is the street's)
      this.spots.dualrotor = { x: SG.x - 0.012, y: surfY + SG.y0 + 1.5, z: (SG.z0 + SG.z1) / 2, nx: -1, ny: 0, nz: 0, ux: 0, uy: 1, uz: 0, w: 3.0 };
      this.lights.push(addLight(SG.x - 2.4, surfY + 3.4, (SG.z0 + SG.z1) / 2, 8, [1.0, 0.85, 0.62], 0.9));
      this.ladder(SURF.x0, SURF.ladderZ, 0.15, surfY);
    } else if (k === 5 || k === 6) {
      // ---- 9TH STREET GYM: the corner's lot cleared (a frame), the gym put up on it (the next). Whatever goes wrong in it, the
      // rest of the places are built all the same
      try {
        if (k === 5) {
          this.gym = new Gym(this);
          this.gym.clear();
        } else if (this.gym) this.gym.build();
      } catch (e) {
        console.error('[places] the gym', e);
      }
    } else {
      // ---- SALT & SPANNER
      const D = (this.van = new VanDriver(g, M));
      D.group.traverse((m) => {
        if (!m.isMesh) return;
        m.frustumCulled = true;
        // (its body's paint casts the van's shadow; its wheels, its lamps, its side do not)
        m.userData.noShadow = !(m.parent === D.group && m.material === M.paint);
      });
      g.scene.add(D.group);
      this.list.push({ name: 'van', group: D.group, cx: 0, cz: 0, far: FAR.van, moves: true });
      D.attach();
      this.spots.hoverbike = D.spot;
      this.stats.van = { draws: countMeshes(D.group), tris: Math.round(D.tris) };
      // (the curb by the hotel it stops at clear of parked cars)
      this.clearCurb([[-3, 203, 0, 225]]);
      this.built = true;
    }
  }

  // a place's Kit merged, a mesh a pen, into the scene: what is matte or steel casts its shadow, the rest does not
  add(name, K, seed, cx, cz) {
    const grp = K.build({ seed });
    grp.name = `place-${name}`;
    let tris = 0;
    for (const m of grp.children) {
      this.prep(m, true);
      tris += m.geometry.attributes.position.count / 3;
    }
    grp.updateMatrix();
    this.game.scene.add(grp);
    this.list.push({ name, group: grp, cx, cz, far: FAR[name] || 500 });
    this.stats[name] = { draws: grp.children.length, tris: Math.round(tris) };
    return grp;
  }

  prep(m, shade) {
    if (!m.isMesh) return;
    // (each drawn only when it is in the picture: the Kit's meshes are drawn wherever they are)
    m.frustumCulled = true;
    if (shade) {
      const M = itemMats();
      m.userData.noShadow = !(m.material === M.matte || m.material === M.metal);
    }
  }

  // the top of the building under (x, z) no higher than a tower's podium (world footprints), else what it was built for
  roofAt(x, z, fallback) {
    const F = this.game.world.footprints || [];
    let best = null;
    for (const f of F) {
      if (!(f.top > 2 && f.top < 60)) continue;
      if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
      if (!best || f.top > best.top) best = f;
    }
    return best ? best.top : fallback;
  }

  // a ladder up a back wall at x0 (the wall looks west, -x) from the alley at z: a way up for game/climb.js
  ladder(x0, z, gy, top) {
    const w = this.game.world;
    if (!w.roofs || !w.roofs.routes) return;
    const nx = -1;
    const nz = 0;
    const f = { nx, nz, p: (u, v, d) => [x0 + nz * u + nx * d, v, z - nx * u + nz * d] };
    const P = (d, y) => {
      const p = f.p(0, y, d);
      return { x: p[0], y, z: p[2] };
    };
    const r = new Route('ladder');
    r.start(P(0.43, gy));
    r.ladder(P(0.43, top + 0.15), Math.atan2(-nx, -nz), f, 0, 0.15);
    r.walk(P(-0.15, top + 0.3));
    r.walk(P(-0.9, top));
    r.f = f;
    r.bottom = true;
    w.roofs.routes.push(r);
    this.routes.push(r);
  }

  // parked cars out of the way (as the car park takes them out of its ways: their places, their solids)
  clearCurb(rects) {
    const g = this.game;
    const w = g.world;
    const gone = (c) => rects.some((r) => c.x + 1 > r[0] && c.x - 1 < r[2] && c.z + 2.3 > r[1] && c.z - 2.3 < r[3]);
    const T = g.traffic;
    if (T && T.parked) {
      for (let i = T.parked.length - 1; i >= 0; i--) {
        const c = T.parked[i];
        if (!gone(c)) continue;
        if (c.box !== undefined) w.collision.remove(c.box);
        T.parked.splice(i, 1);
      }
    }
    if (w.parked) for (let i = w.parked.length - 1; i >= 0; i--) if (gone(w.parked[i])) w.parked.splice(i, 1);
  }

  // ------------------------------------------------------------------ each frame
  update(dt) {
    if (!this.built) {
      if (!this.ready()) return;
      this.step();
    }
    if (this.van) this.van.update(dt);
    if (this.gym && this.gym.built) this.gym.update(dt);
    // (far off: not drawn)
    const c = this.game.camera.position;
    for (const p of this.list) {
      const x = p.moves ? this.van.pos.x : p.cx;
      const z = p.moves ? this.van.pos.z : p.cz;
      p.group.visible = Math.abs(c.x - x) < p.far && Math.abs(c.z - z) < p.far;
    }
  }

  // (the gym's: what E does there and what the prompt says, game/game.js; the room you are in, for player.indoor)
  target() {
    return this.gym ? this.gym.target() : null;
  }

  interact() {
    return this.gym ? this.gym.interact() : false;
  }

  roomAt(x, z, y = null) {
    return this.gym ? this.gym.roomAt(x, z, y) : null;
  }

  // the van's lights on the street after dark: its headlamps on the road ahead, the light in its open side
  draw() {
    const D = this.van;
    if (!D) return;
    const g = this.game;
    const night = g.daynight ? g.daynight.night : 0;
    if (night < 0.25) return;
    const c = g.camera.position;
    if (Math.abs(c.x - D.pos.x) > 90 || Math.abs(c.z - D.pos.z) > 90) return;
    const fx = Math.sin(D.yawNow);
    const fz = Math.cos(D.yawNow);
    if (D.stop) {
      const s = D.spot;
      if (D.hatchA > 0.4) flashLight(s.x + s.nx * 1.6, s.y + 0.9, s.z + s.nz * 1.6, 6, OPEN_LIGHT, 1.2 * night);
    } else flashLight(D.pos.x + fx * 8, D.pos.y + 0.9, D.pos.z + fz * 8, 11, HEAD_LIGHT, 1.4 * night);
  }

  dispose() {
    const g = this.game;
    for (const p of this.list) {
      g.scene.remove(p.group);
      p.group.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
    }
    this.list = [];
    for (const id of this.cols) g.world.collision.remove(id);
    this.cols = [];
    const R = g.world.roofs;
    if (R) for (const r of this.routes) {
      const k = R.routes.indexOf(r);
      if (k >= 0) R.routes.splice(k, 1);
    }
    this.routes = [];
    if (this.van) this.van.detach();
    this.van = null;
    if (this.gym) this.gym.dispose();
    this.gym = null;
    this.built = false;
    this.stepN = 0;
    this.spots = { rocket: null, wings: null, inkhawk: null, dualrotor: null, hoverbike: null, ironfists: null };
  }
}

const HEAD_LIGHT = [1.0, 0.94, 0.8];
const OPEN_LIGHT = [1.0, 0.88, 0.66];

function countMeshes(o) {
  let n = 0;
  o.traverse((m) => {
    if (m.isMesh) n++;
  });
  return n;
}

