import * as THREE from 'three';
import { makeSurface, canvasTexture, srgb } from '../render/materials.js';
import { CURB } from '../world/layout.js';
import { shopCloses } from './rhythm.js';

// The shops' roller shutters (ROADMAP 1.3): at closing time a shutter of ribbed steel rolls down
// over a shop's front, glass and door and all, and at opening time back up into its box under the
// awning (it slides up and is cut off there, so its ribs never stretch). A shut front is a wall:
// nobody walks in. All of them are one draw, and none at all while every shop is open.

const TOP = 3.42;
const H = TOP - CURB;
// out from the front (in front of the window frames), and how thick
const D = 0.2;
const T = 0.05;
// how much of the way it rolls in a second
const ROLL = 1 / 3.5;
// beyond this far from the camera a shutter is just up or down
const FAR = 160;

// ribbed steel, drawn: a slat every few pixels (a groove in shadow, a lip catching the light), a
// heavier bar at the foot with its handle and a padlock
function shutterTexture() {
  const w = 128;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#aab2c0';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h - 34; y += 15) {
    g.fillStyle = 'rgba(40, 44, 62, 0.5)';
    g.fillRect(0, y, w, 2);
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    g.fillRect(0, y + 3, w, 1);
    g.fillStyle = 'rgba(70, 76, 96, 0.12)';
    g.fillRect(0, y + 8, w, 5);
  }
  // the bottom bar
  g.fillStyle = '#6f7688';
  g.fillRect(0, h - 34, w, 34);
  g.fillStyle = 'rgba(20, 22, 32, 0.7)';
  g.fillRect(0, h - 34, w, 3);
  g.fillRect(w / 2 - 10, h - 24, 20, 6);
  // the padlock
  g.fillStyle = '#c9a33a';
  g.fillRect(w / 2 - 5, h - 16, 10, 9);
  g.strokeStyle = '#3a3220';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(w / 2, h - 16, 4, Math.PI, 0);
  g.stroke();
  return canvasTexture(c, { mips: true });
}

const _m = new THREE.Matrix4();

export class Shutters {
  constructor(game) {
    this.game = game;
    const col = game.world.collision;
    const shops = (game.world.shops || []).filter((s) => s.room && !s.stand && s.f && s.building && shopCloses(s.kind));
    this.list = shops.map((s) => {
      const f = s.f;
      const u0 = 1.4;
      const u1 = s.building.L - 1.4;
      // (shut, the front is a wall from the curb up to the box)
      const [mn, mx] = f.box(u0, CURB, D - 0.12, u1, TOP, D + 0.14);
      const box = col.addBox(mn[0], mn[2], mx[0], mx[2], CURB, TOP, 'shutter');
      col.boxes[box].alive = false;
      const c = f.p((u0 + u1) / 2, 0, D);
      // its frame: across the front, up, and out of it (a proper turn, whichever way the front faces)
      const ax = new THREE.Vector3(f.ux, 0, f.uz).multiplyScalar(u1 - u0);
      const ay = new THREE.Vector3(0, H, 0);
      const az = new THREE.Vector3().crossVectors(ax, ay).normalize().multiplyScalar(T);
      return { shop: s, room: s.room, x: c[0], z: c[2], ax, ay, az, box, down: -1 };
    });
    const n = Math.max(1, this.list.length);
    const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    g.setAttribute('aId', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    this.iX = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iClip = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iX', this.iX);
    g.setAttribute('iClip', this.iClip);
    const mat = makeSurface({ kind: 'wall', map: shutterTexture(), color: srgb(1, 1, 1), wash: 0.58, density: 0.85, line: 0.75, lit: 0, noShadow: true });
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.userData.dynamic = true;
    game.scene.add(this.mesh);
  }

  update(dt) {
    const game = this.game;
    const R = game.rhythm;
    const col = game.world.collision;
    const cam = game.camera.position;
    const pl = game.player;
    const M = this.mesh.instanceMatrix.array;
    const X = this.iX.array;
    const C = this.iClip.array;
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      let want = R.open(e.shop.kind) ? 0 : 1;
      // (not while you are in there: they wait for you to go)
      if (want && !pl.inVehicle && e.room.inside(pl.pos.x, pl.pos.z, 0.4)) want = 0;
      const far = Math.abs(e.x - cam.x) > FAR || Math.abs(e.z - cam.z) > FAR;
      if (e.down < 0 || far) e.down = want;
      else if (e.down !== want) e.down = want > e.down ? Math.min(want, e.down + ROLL * dt) : Math.max(want, e.down - ROLL * dt);
      // the shop is shut once its shutter is all the way down (game/streetlife.js lets it go)
      e.shop.shut = e.down >= 1;
      const wall = e.down > 0.5;
      const b = col.boxes[e.box];
      if (b.alive !== wall) b.alive = wall;
      if (e.down <= 0.001 || far) continue;
      // slid down from its box (the part still in the box is cut off at the top)
      const y = TOP + (1 - e.down) * H - H / 2;
      _m.makeBasis(e.ax, e.ay, e.az).setPosition(e.x, y, e.z);
      _m.toArray(M, n * 16);
      X[n * 4] = 0;
      X[n * 4 + 1] = i * 0.37;
      X[n * 4 + 2] = 0;
      X[n * 4 + 3] = 0;
      C[n * 4] = 0;
      C[n * 4 + 1] = 1;
      C[n * 4 + 2] = 0;
      C[n * 4 + 3] = TOP;
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (!n) return;
    const ats = this._ats || (this._ats = [this.mesh.instanceMatrix, this.iX, this.iClip]);
    for (let k = 0; k < 3; k++) {
      const at = ats[k];
      at.clearUpdateRanges();
      at.addUpdateRange(0, n * at.itemSize);
      at.needsUpdate = true;
    }
  }
}
