// Turns a level definition into merged static meshes, colliders, lights, props, doors and movable modules.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Collider } from '../core/collision.js';
import { boxGeo, wedgeGeo } from '../render/materials.js';
import { MODULE_TYPES } from '../core/config.js';

const _m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _q = new THREE.Quaternion();

export class LevelBuilder {
  constructor(game) {
    this.game = game; this.scene = game.scene; this.world = game.world; this.mats = game.mats;
    this.batches = new Map();   // material name → geometries
    this.modules = []; this.doors = []; this.lights = { spots: [], points: [], flood: [] };
    this.interactables = []; this.zones = {}; this.emissives = [];
    this.root = new THREE.Group(); this.root.name = 'level'; this.scene.add(this.root);
  }

  // ---- primitives ----
  _push(matName, geo, x, y, z, yaw = 0, pitch = 0, roll = 0) {
    _e.set(pitch, yaw, roll, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z);
    _m4.compose(_p, _q, _s); geo.applyMatrix4(_m4);
    if (!this.batches.has(matName)) this.batches.set(matName, []);
    this.batches.get(matName).push(geo);
  }
  box(x, y, z, w, h, d, matName, { yaw = 0, collide = true, tag = 'static', material = 'concrete', vision = true, bullets = true, climbable = true, movement = true } = {}) {
    this._push(matName, boxGeo(w, h, d), x, y + h / 2, z, yaw);
    if (collide) {
      const c = new Collider({ x, y: y + h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, yaw, tag, material, climbable });
      c.blocksVision = vision; c.blocksBullets = bullets; c.blocksMovement = movement;
      this.world.add(c); return c;
    }
    return null;
  }
  wedge(x, y, z, w, h, d, matName, { yaw = 0, material = 'metal', collide = true } = {}) {
    const g = wedgeGeo(w, h, d); this._push(matName, g, x, y, z, yaw);
    if (collide) { const c = new Collider({ x, y: y + h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, yaw, wedge: true, tag: 'static', material }); this.world.add(c); return c; }
    return null;
  }
  cylinder(x, y, z, r, h, matName, { collide = true, material = 'metal', segs = 16, rTop = null } = {}) {
    const g = new THREE.CylinderGeometry(rTop ?? r, r, h, segs); this._push(matName, g, x, y + h / 2, z);
    if (collide) { const c = new Collider({ x, y: y + h / 2, z, hx: r * 0.85, hy: h / 2, hz: r * 0.85, tag: 'static', material }); this.world.add(c); return c; }
    return null;
  }
  // wall from (x1,z1) to (x2,z2)
  wall(x1, z1, x2, z2, h, thick, matName, opts = {}) {
    const len = Math.hypot(x2 - x1, z2 - z1); const yaw = Math.atan2(x2 - x1, z2 - z1);
    return this.box((x1 + x2) / 2, opts.y ?? 0, (z1 + z2) / 2, thick, h, len, matName, { yaw, ...opts });
  }
  // wall with openings: openings = [{at, w, h, sill}] measured along the wall from (x1,z1)
  wallWithOpenings(x1, z1, x2, z2, h, thick, matName, openings = [], opts = {}) {
    const len = Math.hypot(x2 - x1, z2 - z1); const yaw = Math.atan2(x2 - x1, z2 - z1);
    const dx = (x2 - x1) / len, dz = (z2 - z1) / len;
    const segs = [];
    let cursor = 0;
    const sorted = [...openings].sort((a, b) => a.at - b.at);
    for (const o of sorted) {
      const start = o.at - o.w / 2, end = o.at + o.w / 2;
      if (start > cursor + 0.01) segs.push([cursor, start, 0, h]);
      const sill = o.sill || 0; const top = sill + o.h;
      if (sill > 0.01) segs.push([start, end, 0, sill]);
      if (top < h - 0.01) segs.push([start, end, top, h]);
      cursor = end;
    }
    if (cursor < len - 0.01) segs.push([cursor, len, 0, h]);
    const out = [];
    for (const [a, b, y0, y1] of segs) {
      const mid = (a + b) / 2;
      out.push(this.box(x1 + dx * mid, y0, z1 + dz * mid, thick, y1 - y0, b - a, matName, { yaw, ...opts }));
    }
    return out;
  }
  floor(x, z, w, d, matName, { y = 0, thick = 0.2, collide = true } = {}) {
    // slab whose top is at y
    this._push(matName, boxGeo(w, thick, d), x, y - thick / 2, z);
    if (collide && y > 0.01) { const c = new Collider({ x, y: y - thick / 2, z, hx: w / 2, hy: thick / 2, hz: d / 2, tag: 'static', material: matName.includes('steel') || matName.includes('grating') ? 'metal' : 'concrete' }); this.world.add(c); return c; }
    return null;
  }
  plane(x, y, z, w, d, matName) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d); this._push(matName, g, x, y, z); }

  // ---- lights ----
  spot(x, y, z, tx, ty, tz, { color = 0xffe6c0, intensity = 400, angle = 0.55, penumbra = 0.5, shadow = false, distance = 60, flood = false, decay = 1.6 } = {}) {
    const l = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
    l.position.set(x, y, z); l.target.position.set(tx, ty, tz); this.root.add(l); this.root.add(l.target);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0006; l.shadow.normalBias = 0.02; l.shadow.camera.near = 1; l.shadow.camera.far = distance; }
    l.userData.baseIntensity = intensity;
    (flood ? this.lights.flood : this.lights.spots).push(l);
    return l;
  }
  point(x, y, z, { color = 0xffd9a8, intensity = 30, distance = 14, decay = 2 } = {}) {
    const l = new THREE.PointLight(color, intensity, distance, decay); l.position.set(x, y, z); this.root.add(l); l.userData.baseIntensity = intensity; this.lights.points.push(l); return l;
  }
  // lamp fixture: emissive box + light
  lamp(x, y, z, { color = 0xffd9a8, intensity = 26, distance = 14, w = 0.9, kind = 'warm' } = {}) {
    const mat = kind === 'cool' ? 'emissiveCool' : kind === 'red' ? 'emissiveRed' : 'emissiveWarm';
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.14), this.mats.get(mat)); m.position.set(x, y, z); this.root.add(m);
    this._push('lightHousing', new THREE.BoxGeometry(w + 0.08, 0.05, 0.2), x, y + 0.05, z);
    const l = this.point(x, y - 0.15, z, { color, intensity, distance });
    l.userData.fixture = m; this.emissives.push({ mesh: m, light: l });
    return l;
  }

  // ---- props ----
  barrel(x, z, matName = 'containerRed', y = 0) {
    this.cylinder(x, y, z, 0.3, 0.88, matName, { material: 'metal', segs: 14 });
    for (const yy of [0.2, 0.68]) this._push('steelDark', new THREE.TorusGeometry(0.305, 0.02, 6, 18).rotateX(Math.PI / 2), x, y + yy, z);
    this._push('steelDark', new THREE.CylinderGeometry(0.28, 0.28, 0.02, 14), x, y + 0.89, z);
  }
  pallet(x, z, yaw = 0, y = 0) { this._push('wood', boxGeo(1.2, 0.14, 1.0), x, y + 0.07, z, yaw); }
  sandbags(x, z, yaw = 0, len = 2.4) {
    const rows = [[0, 0.16], [0.08, 0.48], [0.16, 0.78]];
    let idx = 0;
    for (const [inset, y] of rows) {
      const n = Math.max(1, Math.round((len - inset) / 0.55));
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; const lx = t * (len - inset); const g = new THREE.BoxGeometry(0.52, 0.3, 0.42, 1, 1, 1); this._push('cloth', g, x + Math.cos(yaw) * lx, y, z - Math.sin(yaw) * lx, yaw + (idx++ % 2 ? 0.06 : -0.06)); }
    }
    const c = new Collider({ x, y: 0.45, z, hx: len / 2, hy: 0.45, hz: 0.3, yaw, tag: 'static', material: 'concrete' }); this.world.add(c); return c;
  }
  crateStack(x, z, yaw = 0, n = 2) { for (let i = 0; i < n; i++) this.box(x + (i % 2) * 0.05, i * 1.0, z, 1.0, 1.0, 1.0, 'wood', { yaw: yaw + i * 0.15, material: 'wood' }); }
  generator(x, z, yaw = 0) {
    this.box(x, 0, z, 2.2, 1.3, 1.1, 'steelYellow', { yaw, material: 'metal' });
    this.cylinder(x + Math.cos(yaw) * 0.7, 1.3, z - Math.sin(yaw) * 0.7, 0.08, 0.5, 'steelDark', { collide: false });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), this.mats.get('emissiveGreen')); led.position.set(x, 1.1, z + 0.56); this.root.add(led);
  }
  lightPole(x, z, targetX, targetZ, { height = 7, shadow = false, intensity = 900, color = 0xfff1d6, flood = true } = {}) {
    this.cylinder(x, 0, z, 0.12, height, 'steelDark', { material: 'metal', segs: 10 });
    const yaw = Math.atan2(targetX - x, targetZ - z);
    const hx = x + Math.sin(yaw) * 0.5, hz = z + Math.cos(yaw) * 0.5;
    this._push('lightHousing', new THREE.BoxGeometry(0.5, 0.25, 0.7), hx, height - 0.1, hz, yaw, -0.6);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.55), this.mats.get('emissiveWarm')); face.position.set(hx, height - 0.24, hz); face.rotation.set(-Math.PI / 2 + 0.6, yaw, 0, 'YXZ'); this.root.add(face);
    const l = this.spot(hx, height - 0.2, hz, targetX, 0, targetZ, { intensity, angle: 0.62, penumbra: 0.55, shadow, distance: 55, color, flood });
    l.userData.fixture = face; this.emissives.push({ mesh: face, light: l });
    return l;
  }
  truck(x, z, yaw = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const at = (lx, lz) => [x + lx * cy + lz * sy, z - lx * sy + lz * cy];
    // cab
    let [cx, cz] = at(0, 2.6); this.box(cx, 0.5, cz, 2.3, 2.0, 2.2, 'containerGreen', { yaw, material: 'metal' });
    [cx, cz] = at(0, 3.9); this.box(cx, 0.5, cz, 2.3, 1.1, 0.6, 'containerGreen', { yaw, material: 'metal', collide: false });
    // windshield
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.8), this.mats.get('glass')); [cx, cz] = at(0, 3.62); ws.position.set(cx, 1.95, cz); ws.rotation.set(-0.35, yaw, 0, 'YXZ'); this.root.add(ws);
    // bed with canvas
    [cx, cz] = at(0, -1.2); this.box(cx, 0.5, cz, 2.4, 0.5, 5.2, 'steelDark', { yaw, material: 'metal' });
    this.box(cx, 1.0, cz, 2.4, 1.9, 5.0, 'cloth', { yaw, material: 'concrete' });
    // wheels
    for (const [lx, lz] of [[-1.05, 2.4], [1.05, 2.4], [-1.05, -0.4], [1.05, -0.4], [-1.05, -2.2], [1.05, -2.2]]) { const [wx, wz] = at(lx, lz); this._push('rubber', new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16).rotateZ(Math.PI / 2), wx, 0.5, wz, yaw); }
    // headlights
    for (const lx of [-0.8, 0.8]) { const [hx, hz] = at(lx, 4.2); const hl = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), this.mats.get('emissiveWarm')); hl.position.set(hx, 1.0, hz); hl.rotation.y = yaw; this.root.add(hl); }
  }
  desk(x, z, yaw = 0) { this.box(x, 0.68, z, 1.6, 0.06, 0.8, 'steelDark', { yaw, material: 'metal', collide: false }); this.box(x, 0, z, 1.5, 0.7, 0.7, 'plastic', { yaw, material: 'metal' }); }
  locker(x, z, yaw = 0) { this.box(x, 0, z, 0.9, 2.0, 0.5, 'steelDark', { yaw, material: 'metal' }); }
  table(x, z, yaw = 0) { this.box(x, 0, z, 1.8, 0.78, 0.8, 'wood', { yaw, material: 'wood' }); }
  cage(x, z, w, d, h = 2.4, { yaw = 0, gap = 0.22 } = {}) {
    // vertical bars around a rectangle (blocks movement + bullets partially, not vision)
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const edges = [[-w / 2, -d / 2, w / 2, -d / 2], [w / 2, -d / 2, w / 2, d / 2], [w / 2, d / 2, -w / 2, d / 2], [-w / 2, d / 2, -w / 2, -d / 2]];
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.floor(len / gap));
      for (let i = 0; i <= n; i++) { const t = i / n; const lx = ax + (bx - ax) * t, lz = az + (bz - az) * t; this._push('steelDark', new THREE.CylinderGeometry(0.02, 0.02, h, 6), x + lx * cy + lz * sy, h / 2, z - lx * sy + lz * cy); }
      const mx = (ax + bx) / 2, mz = (az + bz) / 2; const eyaw = Math.atan2(bx - ax, bz - az) + yaw;
      for (const yy of [0.05, h - 0.05]) this._push('steelDark', boxGeo(0.05, 0.05, len), x + mx * cy + mz * sy, yy, z - mx * sy + mz * cy, eyaw);
      const c = new Collider({ x: x + mx * cy + mz * sy, y: h / 2, z: z - mx * sy + mz * cy, hx: 0.04, hy: h / 2, hz: len / 2, yaw: eyaw, tag: 'static', material: 'metal' });
      c.blocksVision = false; c.blocksBullets = false; this.world.add(c);
    }
  }
  fence(x1, z1, x2, z2, h = 3, { posts = true, razor = true } = {}) {
    const len = Math.hypot(x2 - x1, z2 - z1); const yaw = Math.atan2(x2 - x1, z2 - z1);
    const g = new THREE.PlaneGeometry(len, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * h);
    this._push('chainlink', g, (x1 + x2) / 2, h / 2, (z1 + z2) / 2, yaw + Math.PI / 2);
    const c = new Collider({ x: (x1 + x2) / 2, y: h / 2, z: (z1 + z2) / 2, hx: 0.04, hy: h / 2, hz: len / 2, yaw, tag: 'static', material: 'metal', climbable: false });
    c.blocksVision = false; c.blocksBullets = false; this.world.add(c);
    if (posts) { const n = Math.max(1, Math.round(len / 3)); for (let i = 0; i <= n; i++) { const t = i / n; this._push('steelDark', new THREE.CylinderGeometry(0.04, 0.04, h + 0.3, 8), x1 + (x2 - x1) * t, (h + 0.3) / 2, z1 + (z2 - z1) * t); } }
    if (razor) this._push('steelDark', new THREE.CylinderGeometry(0.18, 0.18, len, 6, 1, true).rotateX(Math.PI / 2), (x1 + x2) / 2, h + 0.15, (z1 + z2) / 2, yaw);
    return c;
  }
  railing(x1, z1, x2, z2, y = 0, h = 1.05) {
    const len = Math.hypot(x2 - x1, z2 - z1); const yaw = Math.atan2(x2 - x1, z2 - z1);
    for (const yy of [h, h * 0.55]) this._push('steelYellow', boxGeo(0.05, 0.05, len), (x1 + x2) / 2, y + yy, (z1 + z2) / 2, yaw);
    const n = Math.max(1, Math.round(len / 1.5)); for (let i = 0; i <= n; i++) { const t = i / n; this._push('steelDark', boxGeo(0.05, h, 0.05), x1 + (x2 - x1) * t, y + h / 2, z1 + (z2 - z1) * t); }
    const c = new Collider({ x: (x1 + x2) / 2, y: y + h / 2, z: (z1 + z2) / 2, hx: 0.04, hy: h / 2, hz: len / 2, yaw, tag: 'static', material: 'metal', climbable: false });
    c.blocksVision = false; c.blocksBullets = false; this.world.add(c); return c;
  }
  stairs(x, z, w, h, d, yaw, matName = 'steelDark') {
    // wedge collider + visible steps; low end at local -z
    const c = new Collider({ x, y: h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, yaw, wedge: true, tag: 'static', material: 'metal' }); this.world.add(c);
    const n = Math.round(h / 0.2);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const lz = -d / 2 + t * d; const sh = (i + 1) / n * h; this._push(matName, boxGeo(w, sh, d / n), x - Math.sin(yaw) * lz * -1 + 0, sh / 2, z + Math.cos(yaw) * lz); }
    return c;
  }
  helipad(x, z, r = 6, y = 0.02) {
    const ring = new THREE.RingGeometry(r - 0.35, r, 48).rotateX(-Math.PI / 2); this._push('hazard', ring, x, y, z);
    const hg = new THREE.BufferGeometry(); const hw = r * 0.25, hh = r * 0.55, t = 0.3;
    const parts = [boxGeo(t, 0.01, hh * 2).translate(-hw, 0, 0), boxGeo(t, 0.01, hh * 2).translate(hw, 0, 0), boxGeo(hw * 2, 0.01, t)];
    for (const p of parts) this._push('hazard', p, x, y, z);
    hg.dispose();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), this.mats.get('emissiveGreen')); l.position.set(x + Math.cos(a) * (r + 0.6), y + 0.1, z + Math.sin(a) * (r + 0.6)); this.root.add(l); }
  }
  hazardStripe(x, z, w, d, yaw = 0, y = 0.01) { const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2); this._push('hazard', g, x, y, z, yaw); }
  acUnit(x, y, z) { this.box(x, y, z, 1.4, 0.9, 1.4, 'steelDark', { material: 'metal', collide: false }); this._push('lightHousing', new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20), x, y + 0.93, z); }
  pipe(x1, y1, z1, x2, y2, z2, r = 0.08) { const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1); const g = new THREE.CylinderGeometry(r, r, len, 8); const dir = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.applyQuaternion(q); this._push('steelDark', g, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); }

  // ---- doors ----
  door(x, z, yaw, { width = 1.3, height = 2.3, locked = false, auto = true, id = null, mat = 'steel', double = false } = {}) {
    const d = new Door(this, x, z, yaw, { width, height, locked, auto, id, mat, double });
    this.doors.push(d); return d;
  }

  // ---- movable modules ----
  module(type, x, z, yaw = 0, id = null, y = null) {
    const m = new Module(this, type, x, z, yaw, id, y); this.modules.push(m); return m;
  }

  // ---- zones (triggers) ----
  zone(id, x, z, w, d) { this.zones[id] = { id, x, z, w, d, contains: (p) => Math.abs(p.x - x) <= w / 2 && Math.abs(p.z - z) <= d / 2 }; return this.zones[id]; }

  // ---- finalize: merge batches into meshes ----
  finalize() {
    for (const [matName, geos] of this.batches) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mat = this.mats.get(matName);
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'batch_' + matName;
      this.root.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.batches.clear();
  }
}

// ---------------- Door ----------------
export class Door {
  constructor(b, x, z, yaw, o) {
    this.b = b; this.x = x; this.z = z; this.yaw = yaw; this.width = o.width; this.height = o.height; this.locked = o.locked; this.auto = o.auto; this.id = o.id; this.double = o.double;
    this.open = 0; this.target = 0; this.state = 'closed';
    const mats = b.mats;
    // frame
    const fw = 0.12;
    b.box(x + Math.cos(yaw) * (o.width / 2 + fw / 2), 0, z - Math.sin(yaw) * (o.width / 2 + fw / 2), fw, o.height + 0.1, 0.3, 'steelDark', { yaw, material: 'metal' });
    b.box(x - Math.cos(yaw) * (o.width / 2 + fw / 2), 0, z + Math.sin(yaw) * (o.width / 2 + fw / 2), fw, o.height + 0.1, 0.3, 'steelDark', { yaw, material: 'metal' });
    b.box(x, o.height, z, o.width + fw * 2, 0.12, 0.3, 'steelDark', { yaw, material: 'metal' });
    // leaf (pivot at hinge side)
    this.pivot = new THREE.Group(); this.pivot.position.set(x + Math.cos(yaw) * (o.width / 2), 0, z - Math.sin(yaw) * (o.width / 2)); this.pivot.rotation.y = yaw;
    const leaf = new THREE.Mesh(boxGeo(o.width, o.height, 0.08), mats.get(o.mat)); leaf.position.set(-o.width / 2, o.height / 2, 0); leaf.castShadow = true; leaf.receiveShadow = true; this.pivot.add(leaf);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.2), mats.get('gunmetal')); handle.position.set(-o.width + 0.2, 1.05, 0.08); this.pivot.add(handle);
    this.lockLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mats.get(o.locked ? 'emissiveRed' : 'emissiveGreen')); this.lockLight.position.set(-o.width + 0.2, 1.4, 0.06); this.pivot.add(this.lockLight);
    b.root.add(this.pivot);
    this.leaf = leaf;
    this.collider = new Collider({ x, y: o.height / 2, z, hx: o.width / 2, hy: o.height / 2, hz: 0.05, yaw, tag: 'door', material: 'metal', owner: this, climbable: false });
    b.world.add(this.collider);
    this.navDirty = true;
  }
  setLocked(v) { this.locked = v; this.lockLight.material = this.b.mats.get(v ? 'emissiveRed' : 'emissiveGreen'); }
  // called by game each frame with nearby characters
  update(dt, characters) {
    let want = false;
    if (!this.locked) {
      for (const c of characters) {
        if (!c.alive) continue;
        const dx = c.pos.x - this.x, dz = c.pos.z - this.z;
        if (dx * dx + dz * dz < 2.2 * 2.2 && Math.abs(c.pos.y - 0) < 1.5) { want = true; break; }
      }
    }
    this.target = want ? 1 : 0;
    const prev = this.open;
    this.open += (this.target - this.open) * Math.min(1, dt * 4);
    if (Math.abs(this.open - prev) > 1e-4) {
      this.pivot.rotation.y = this.yaw + this.open * 1.75;
      const wasBlocking = this.collider.blocksMovement;
      const blocking = this.open < 0.5;
      this.collider.blocksMovement = blocking; this.collider.blocksVision = this.open < 0.25; this.collider.blocksBullets = this.open < 0.25;
      if (wasBlocking !== blocking) this.navDirty = true;
    }
  }
}

// ---------------- Module (movable structure) ----------------
export class Module {
  constructor(b, type, x, z, yaw, id, y) {
    this.b = b; this.game = b.game; this.type = type; this.cfg = MODULE_TYPES[type]; this.id = id || (type + '_' + Module._n++);
    this.x = x; this.z = z; this.yaw = yaw; this.y = y ?? 0;
    this.group = new THREE.Group(); this.group.name = 'module_' + this.id;
    this.colliders = []; this.materials = [];
    this.moves = 0;
    this._build();
    this._finishParts();
    b.root.add(this.group);
    this.setTransform(x, this.y, z, yaw, true);
  }
  // parts are collected per material and merged into one mesh per material in _finishParts()
  _mesh(geo, matName, x, y, z, ry = 0) {
    const holder = { geo, matName, pos: new THREE.Vector3(x, y, z), rot: new THREE.Euler(0, ry, 0) };
    (this._parts ||= []).push(holder);
    return holder; // callers may set .rotation.x etc. via the returned holder's rot
  }
  _finishParts() {
    const byMat = new Map();
    for (const h of this._parts || []) {
      const m = new THREE.Matrix4().compose(h.pos, new THREE.Quaternion().setFromEuler(h.rot), new THREE.Vector3(1, 1, 1));
      h.geo.applyMatrix4(m);
      if (!byMat.has(h.matName)) byMat.set(h.matName, []);
      byMat.get(h.matName).push(h.geo);
    }
    for (const [matName, geos] of byMat) {
      const mat = this.b.mats.get(matName).clone(); this.materials.push(mat);
      const merged = mergeGeometries(geos, false);
      const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true; m.userData.module = this; this.group.add(m);
    }
    this._parts = null;
  }
  _collider(hx, hy, hz, ox = 0, oy = 0, oz = 0, extra = {}) {
    const c = new Collider({ x: 0, y: 0, z: 0, hx, hy, hz, tag: 'module', owner: this, material: this.cfg.wedge || this.type === 'catwalk' || this.type === 'panel' || this.type === 'container' ? 'metal' : 'concrete', ...extra });
    c.offset = new THREE.Vector3(ox, oy, oz); this.colliders.push(c); this.b.world.add(c); return c;
  }
  _build() {
    const { w, h, d } = this.cfg;
    switch (this.type) {
      case 'barrier': {
        // jersey barrier profile extruded along z
        const shape = new THREE.Shape(); shape.moveTo(-0.3, 0); shape.lineTo(0.3, 0); shape.lineTo(0.3, 0.1); shape.lineTo(0.14, 0.45); shape.lineTo(0.1, h); shape.lineTo(-0.1, h); shape.lineTo(-0.14, 0.45); shape.lineTo(-0.3, 0.1); shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2);
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9, uv.getY(i) * 0.9);
        const m = this._mesh(geo, 'concrete', 0, 0, 0); m.rot.y = Math.PI / 2;
        this._collider(w / 2, h / 2, 0.3, 0, h / 2, 0);
        break;
      }
      case 'panel': {
        this._mesh(boxGeo(w, h, 0.08), 'steel', 0, h / 2, 0);
        for (const sx of [-1, 1]) { this._mesh(boxGeo(0.1, h, 0.18), 'steelDark', sx * (w / 2 - 0.05), h / 2, 0); this._mesh(boxGeo(0.7, 0.08, 0.7), 'steelDark', sx * (w / 2 - 0.35), 0.04, 0); }
        this._mesh(boxGeo(w, 0.1, 0.18), 'steelDark', 0, h - 0.05, 0);
        this._collider(w / 2, h / 2, 0.16, 0, h / 2, 0); // feet are inside the tolerance
        break;
      }
      case 'container': {
        const cols = ['containerRed', 'containerBlue', 'containerGreen', 'containerGray'];
        const col = cols[Module._n % cols.length];
        this._mesh(boxGeo(w, h, d), col, 0, h / 2, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this._mesh(boxGeo(0.16, h + 0.02, 0.16), 'steelDark', sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08));
        for (const sx of [-1, 1]) { this._mesh(boxGeo(0.06, h - 0.3, 0.06), 'steelDark', sx * (w / 2 + 0.02), h / 2, d / 4); this._mesh(boxGeo(0.06, h - 0.3, 0.06), 'steelDark', sx * (w / 2 + 0.02), h / 2, -d / 4); }
        this._collider(w / 2, h / 2, d / 2, 0, h / 2, 0);
        break;
      }
      case 'crate': {
        this._mesh(boxGeo(w, h, d), 'wood', 0, h / 2, 0);
        for (const sy of [0.06, h - 0.06]) for (const sz of [-1, 1]) this._mesh(boxGeo(w + 0.02, 0.06, 0.06), 'steelDark', 0, sy, sz * (d / 2));
        this._collider(w / 2, h / 2, d / 2, 0, h / 2, 0);
        break;
      }
      case 'ramp': {
        this._mesh(wedgeGeo(w, h, d), 'steelDark', 0, 0, 0);
        const slope = Math.atan2(h, d);
        for (const sx of [-1, 1]) { const rail = this._mesh(boxGeo(0.05, 0.05, Math.hypot(h, d)), 'steelYellow', sx * (w / 2 - 0.03), h / 2 + 0.95, 0); rail.rot.x = -slope; }
        this._collider(w / 2, h / 2, d / 2, 0, h / 2, 0, { wedge: true });
        break;
      }
      case 'stairs': {
        const n = Math.round(h / 0.2);
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const sh = ((i + 1) / n) * h; this._mesh(boxGeo(w, sh, d / n), 'steelDark', 0, sh / 2, -d / 2 + t * d); }
        for (const sx of [-1, 1]) { const rail = this._mesh(boxGeo(0.05, 0.05, Math.hypot(h, d)), 'steelYellow', sx * (w / 2 - 0.03), h / 2 + 0.95, 0); rail.rot.x = -Math.atan2(h, d); }
        this._collider(w / 2, h / 2, d / 2, 0, h / 2, 0, { wedge: true });
        break;
      }
      case 'catwalk': {
        this._mesh(boxGeo(w, 0.08, d), 'grating', 0, h - 0.04, 0);
        this._mesh(boxGeo(w, 0.15, 0.08), 'steelDark', 0, h - 0.12, d / 2 - 0.04); this._mesh(boxGeo(w, 0.15, 0.08), 'steelDark', 0, h - 0.12, -d / 2 + 0.04);
        this._mesh(boxGeo(0.08, 0.15, d), 'steelDark', w / 2 - 0.04, h - 0.12, 0); this._mesh(boxGeo(0.08, 0.15, d), 'steelDark', -w / 2 + 0.04, h - 0.12, 0);
        for (const sx of [-1, 1]) { for (const yy of [0.55, 1.05]) this._mesh(boxGeo(0.04, 0.04, d), 'steelYellow', sx * (w / 2 - 0.02), h + yy, 0); for (const zz of [-d / 2 + 0.05, 0, d / 2 - 0.05]) this._mesh(boxGeo(0.04, 1.05, 0.04), 'steelDark', sx * (w / 2 - 0.02), h + 0.52, zz); }
        this._collider(w / 2, h / 2, d / 2, 0, h / 2, 0);
        for (const sx of [-1, 1]) { const r = this._collider(0.03, 0.55, d / 2, sx * (w / 2 - 0.02), h + 0.55, 0, { climbable: false }); r.blocksVision = false; r.blocksBullets = false; }
        break;
      }
    }
  }
  get bounds() { const c = this.colliders[0]; return { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, minY: c.minY, maxY: c.maxY }; }
  get mainCollider() { return this.colliders[0]; }
  get footprint() { return { hx: this.cfg.w / 2, hz: this.cfg.d / 2, h: this.cfg.h }; }
  setTransform(x, y, z, yaw, initial = false) {
    const old = initial ? null : this.bounds;
    this.x = x; this.y = y; this.z = z; this.yaw = yaw;
    this.group.position.set(x, y, z); this.group.rotation.y = yaw;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (const c of this.colliders) {
      const o = c.offset;
      const wx = x + o.x * cy + o.z * sy, wz = z - o.x * sy + o.z * cy;
      this.b.world.move(c, wx, y + o.y, wz, yaw);
    }
    if (!initial) {
      this.moves++;
      const nb = this.bounds;
      const nav = this.game.nav;
      if (nav) { if (old) nav.rebuildRegion(old.minX, old.minZ, old.maxX, old.maxZ); nav.rebuildRegion(nb.minX, nb.minZ, nb.maxX, nb.maxZ); }
    }
  }
  setHighlight(mode) { // null | 'hover' | 'selected' | 'invalid'
    const col = mode === 'invalid' ? 0xff3020 : mode === 'selected' ? 0x2ad0ff : mode === 'hover' ? 0x1a90c0 : 0x000000;
    const i = mode === 'invalid' ? 0.55 : mode === 'selected' ? 0.3 : mode === 'hover' ? 0.18 : 0;
    for (const m of this.materials) { if (!m.emissive) continue; m.emissive.setHex(col); m.emissiveIntensity = i; }
  }
  setGhost(on) { for (const m of this.materials) { m.transparent = on; m.opacity = on ? 0.45 : 1; m.depthWrite = !on; m.needsUpdate = true; } }
}
Module._n = 0;
