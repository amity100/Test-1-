// Turns a level definition into merged static meshes, colliders, lights, props, doors and movable modules.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Collider } from '../core/collision.js';
import { boxGeo, wedgeGeo } from '../render/materials.js';
import { MODULE_TYPES } from '../core/config.js';
import { ExplosiveBarrel } from '../entities/weapons.js';

const _m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _q = new THREE.Quaternion();

// A 20-foot shipping container: corrugated body, corner posts, rails, door end with lock bars.
// `add(geo, matName, lx, ly, lz)` receives parts in container-local space (base at y=0, centred on x/z).
export function containerParts(add, w = 6, h = 2.6, d = 2.45, matName = 'containerBlue') {
  add(boxGeo(w - 0.2, h, d - 0.2), matName, 0, h / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(boxGeo(0.2, h + 0.02, 0.2), 'steelDark', sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1));
  for (const sz of [-1, 1]) { add(boxGeo(w, 0.14, 0.12), 'steelDark', 0, h - 0.07, sz * (d / 2 - 0.06)); add(boxGeo(w, 0.2, 0.12), 'steelDark', 0, 0.1, sz * (d / 2 - 0.06)); }
  for (const sx of [-1, 1]) { add(boxGeo(0.12, 0.14, d), 'steelDark', sx * (w / 2 - 0.06), h - 0.07, 0); add(boxGeo(0.12, 0.2, d), 'steelDark', sx * (w / 2 - 0.06), 0.1, 0); }
  // door end (+x): centre seam, four lock bars with handles, hinges
  add(boxGeo(0.05, h - 0.3, 0.06), 'steelDark', w / 2 - 0.03, h / 2, 0);
  for (const t of [-0.66, -0.3, 0.3, 0.66]) {
    add(new THREE.CylinderGeometry(0.025, 0.025, h - 0.5, 8), 'gunmetal', w / 2 + 0.03, h / 2, t * d / 2);
    add(boxGeo(0.05, 0.05, 0.26), 'gunmetal', w / 2 + 0.05, h * 0.42, t * d / 2 + (t < 0 ? 0.13 : -0.13));
  }
  for (const sz of [-1, 1]) for (const yy of [0.5, h - 0.5]) add(boxGeo(0.06, 0.16, 0.08), 'steelDark', w / 2 - 0.02, yy, sz * (d / 2 - 0.16));
  // vent on the blind end
  add(boxGeo(0.05, 0.22, 0.5), 'steelDark', -w / 2 - 0.01, h - 0.45, d / 4);
}

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
    if (this.pushTarget) {
      const m = new THREE.Mesh(geo, this.mats.get(matName)); m.position.set(x, y, z); m.rotation.set(pitch, yaw, roll, 'YXZ');
      m.castShadow = true; m.receiveShadow = true; this.pushTarget.add(m); return;
    }
    _e.set(pitch, yaw, roll, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z);
    _m4.compose(_p, _q, _s); geo.applyMatrix4(_m4);
    // One merged mesh per material. The static level is about 31k triangles in total, so splitting it into regions
    // to win frustum culling costs far more in draw calls than it saves in vertex work — on a phone a draw call is
    // the expensive thing, not a triangle.
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
  // A roof slab as its own mesh (not batched) so the tactical map can lift it and show the rooms underneath.
  // Returns { mesh: Group, collider }. Anything built inside `deco()` (parapets, AC units) goes into the same group.
  roof(x, y, z, w, h, d, matName, { yaw = 0, material = 'concrete', deco = null } = {}) {
    const group = new THREE.Group(); group.name = 'roof';
    const slab = new THREE.Mesh(boxGeo(w, h, d), this.mats.get(matName));
    slab.position.set(x, y + h / 2, z); slab.rotation.y = yaw; slab.castShadow = true; slab.receiveShadow = true; group.add(slab);
    this.root.add(group);
    const c = new Collider({ x, y: y + h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, yaw, tag: 'roof', material, climbable: false });
    this.world.add(c);
    if (deco) { this.pushTarget = group; try { deco(); } finally { this.pushTarget = null; } }
    return { mesh: group, collider: c };
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
    l.userData.fixture = m; l.userData.kind = kind; this.emissives.push({ mesh: m, light: l });
    return l;
  }

  // ---- props ----
  barrel(x, z, matName = 'containerRed', y = 0) {
    // red barrels are explosive (own mesh so they can vanish); others are batched decoration
    if (matName === 'containerRed') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 14), this.mats.get(matName)); body.position.y = 0.44; body.castShadow = true; body.receiveShadow = true; g.add(body);
      for (const yy of [0.2, 0.68]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.02, 6, 18), this.mats.get('steelDark')); r.rotation.x = Math.PI / 2; r.position.y = yy; g.add(r); }
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 14), this.mats.get('steelDark')); lid.position.y = 0.89; g.add(lid);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.302, 0.302, 0.08, 14, 1, true), this.mats.get('hazard')); stripe.position.y = 0.44; g.add(stripe);
      g.position.set(x, y, z); this.root.add(g);
      const c = new Collider({ x, y: y + 0.44, z, hx: 0.26, hy: 0.44, hz: 0.26, tag: 'static', material: 'metal' }); this.world.add(c);
      const b = new ExplosiveBarrel(this.game, g, c, new THREE.Vector3(x, y + 0.44, z));
      (this.explosives ||= []).push(b);
      return b;
    }
    this.cylinder(x, y, z, 0.3, 0.88, matName, { material: 'metal', segs: 14 });
    for (const yy of [0.2, 0.68]) this._push('steelDark', new THREE.TorusGeometry(0.305, 0.02, 6, 18).rotateX(Math.PI / 2), x, y + yy, z);
    this._push('steelDark', new THREE.CylinderGeometry(0.28, 0.28, 0.02, 14), x, y + 0.89, z);
    return null;
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
  // soft additive cone that suggests light scattering in the rain
  lightCone(from, to, { length = 16, radius = 5.5, color = 0xffe0b0, opacity = 0.2 } = {}) {
    if (!LevelBuilder._coneMat) {
      LevelBuilder._coneMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
        vertexShader: `varying float vT; varying float vR; varying float vF; void main(){ vT = uv.y; vR = uv.x; vec4 mv = modelViewMatrix * vec4(position,1.0); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vT; varying float vR; varying float vF; void main(){ float a = (1.0 - vT) * (1.0 - vT); a *= 0.55 + 0.45 * sin(vR * 6.2831 * 3.0 + vT * 4.0) * 0.2; a *= pow(vF, 1.6); gl_FragColor = vec4(uColor, a * uOpacity); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
    }
    const geo = new THREE.CylinderGeometry(0.25, radius, length, 24, 1, true);
    geo.translate(0, -length / 2, 0);
    const mesh = new THREE.Mesh(geo, LevelBuilder._coneMat.clone());
    mesh.material.uniforms.uColor.value.set(color); mesh.material.uniforms.uOpacity.value = opacity;
    mesh.position.copy(from);
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    mesh.renderOrder = 6; mesh.frustumCulled = true;
    this.root.add(mesh);
    return mesh;
  }
  lightPole(x, z, targetX, targetZ, { height = 7, shadow = false, intensity = 900, color = 0xfff1d6, flood = true } = {}) {
    this.cylinder(x, 0, z, 0.12, height, 'steelDark', { material: 'metal', segs: 10 });
    const yaw = Math.atan2(targetX - x, targetZ - z);
    const hx = x + Math.sin(yaw) * 0.5, hz = z + Math.cos(yaw) * 0.5;
    this._push('lightHousing', new THREE.BoxGeometry(0.5, 0.25, 0.7), hx, height - 0.1, hz, yaw, -0.6);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.55), this.mats.get('emissiveWarm')); face.position.set(hx, height - 0.24, hz); face.rotation.set(-Math.PI / 2 + 0.6, yaw, 0, 'YXZ'); this.root.add(face);
    const l = this.spot(hx, height - 0.2, hz, targetX, 0, targetZ, { intensity, angle: 0.62, penumbra: 0.55, shadow, distance: 55, color, flood });
    l.userData.fixture = face; this.emissives.push({ mesh: face, light: l });
    l.userData.cone = this.lightCone(new THREE.Vector3(hx, height - 0.3, hz), new THREE.Vector3(targetX, 0, targetZ), { length: Math.hypot(targetX - hx, targetZ - hz, height) * 0.95, radius: 6 });
    return l;
  }
  truck(x, z, yaw = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const at = (lx, lz) => [x + lx * cy + lz * sy, z - lx * sy + lz * cy];
    let cx, cz;
    // chassis + cab (hood, cabin, windows, bumper, mirrors)
    [cx, cz] = at(0, 3.55); this.box(cx, 0.55, cz, 2.2, 0.95, 1.5, 'containerGreen', { yaw, material: 'metal' });           // hood
    [cx, cz] = at(0, 2.35); this.box(cx, 0.55, cz, 2.3, 2.05, 1.9, 'containerGreen', { yaw, material: 'metal' });           // cabin
    [cx, cz] = at(0, 4.35); this.box(cx, 0.35, cz, 2.3, 0.35, 0.25, 'steelDark', { yaw, material: 'metal', collide: false }); // bumper
    [cx, cz] = at(0, 3.35); this.box(cx, 1.5, cz, 2.0, 0.08, 0.5, 'steelDark', { yaw, material: 'metal', collide: false });  // hood lip
    for (const sx of [-1, 1]) { [cx, cz] = at(sx * 1.3, 2.9); this._push('steelDark', new THREE.BoxGeometry(0.08, 0.3, 0.2), cx, 1.9, cz, yaw); [cx, cz] = at(sx * 1.2, 2.9); this._push('steelDark', new THREE.BoxGeometry(0.2, 0.04, 0.04), cx, 1.85, cz, yaw); }
    const glassMat = this.mats.get('glass');
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.75), glassMat); [cx, cz] = at(0, 3.31); ws.position.set(cx, 2.05, cz); ws.rotation.set(-0.3, yaw, 0, 'YXZ'); this.root.add(ws);
    for (const sx of [-1, 1]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), glassMat); [cx, cz] = at(sx * 1.16, 2.3); sw.position.set(cx, 2.05, cz); sw.rotation.y = yaw + sx * Math.PI / 2; this.root.add(sw); }
    // flatbed with canvas cover and hoops
    [cx, cz] = at(0, -1.2); this.box(cx, 0.55, cz, 2.4, 0.45, 5.2, 'steelDark', { yaw, material: 'metal' });
    this.box(cx, 1.0, cz, 2.35, 0.5, 5.0, 'containerGreen', { yaw, material: 'metal', collide: false });
    this.box(cx, 1.5, cz, 2.4, 1.5, 4.9, 'cloth', { yaw, material: 'concrete' });
    for (let i = 0; i < 4; i++) { [cx, cz] = at(0, -3.4 + i * 1.5); this._push('steelDark', new THREE.TorusGeometry(1.2, 0.03, 6, 16, Math.PI), cx, 1.55, cz, yaw); }
    // wheels with hubs and arches
    for (const [lx, lz] of [[-1.05, 3.1], [1.05, 3.1], [-1.05, -0.6], [1.05, -0.6], [-1.05, -2.2], [1.05, -2.2]]) {
      const [wx, wz] = at(lx, lz);
      this._push('rubber', new THREE.CylinderGeometry(0.52, 0.52, 0.36, 18).rotateZ(Math.PI / 2), wx, 0.52, wz, yaw);
      this._push('steelDark', new THREE.CylinderGeometry(0.3, 0.3, 0.38, 12).rotateZ(Math.PI / 2), wx, 0.52, wz, yaw);
    }
    // lights
    for (const lx of [-0.8, 0.8]) { const [hx, hz] = at(lx, 4.31); const hl = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), this.mats.get('emissiveWarm')); hl.position.set(hx, 0.95, hz); hl.rotation.y = yaw; this.root.add(hl); }
    for (const lx of [-1.0, 1.0]) { const [hx, hz] = at(lx, -3.82); const tl = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), this.mats.get('emissiveRed')); tl.position.set(hx, 0.8, hz); tl.rotation.y = yaw + Math.PI; this.root.add(tl); }
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

  // ---- larger set pieces ----
  // Static container (bottom of a stack, or simply parked). Colour per material name.
  containerStatic(x, z, yaw = 0, matName = 'containerBlue', y = 0) {
    containerParts((geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, y, z, yaw); }, 6, 2.6, 2.45, matName);
    const c = new Collider({ x, y: y + 1.3, z, hx: 3, hy: 1.3, hz: 1.225, yaw, tag: 'static', material: 'metal' }); this.world.add(c); return c;
  }
  // Industrial staircase: treads, risers, stringers, handrails; walkable wedge collider (low end at local -z).
  staircase(x, z, w, h, d, yaw, { rails = 'both' } = {}) {
    const c = new Collider({ x, y: h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, yaw, wedge: true, tag: 'static', material: 'metal' }); this.world.add(c);
    const n = Math.max(3, Math.round(h / 0.19)), stepD = d / n, stepH = h / n;
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    for (let i = 0; i < n; i++) {
      const lz = -d / 2 + (i + 0.5) * stepD;
      local(boxGeo(w, 0.05, stepD + 0.03), 'steelDark', 0, (i + 1) * stepH - 0.025, lz);
      local(boxGeo(w - 0.1, stepH, 0.04), 'steelDark', 0, (i + 0.5) * stepH, lz + stepD / 2 - 0.02);
    }
    const slopeLen = Math.hypot(h, d), ang = Math.atan2(h, d);
    for (const sx of [-1, 1]) { const g = boxGeo(0.08, 0.3, slopeLen); g.rotateX(-ang); local(g, 'steelDark', sx * (w / 2 + 0.04), h / 2 - 0.12, 0); }
    const sides = rails === 'both' ? [-1, 1] : rails === 'left' ? [-1] : rails === 'right' ? [1] : [];
    for (const sx of sides) {
      const g = boxGeo(0.05, 0.05, slopeLen); g.rotateX(-ang); local(g, 'steelYellow', sx * (w / 2 + 0.05), h / 2 + 1.0, 0);
      for (let k = 0; k <= 3; k++) { const t = k / 3; local(boxGeo(0.05, 1.0, 0.05), 'steelDark', sx * (w / 2 + 0.05), t * h + 0.5, -d / 2 + t * d); }
      const sc = new Collider({ x: x + Math.cos(yaw) * sx * (w / 2 + 0.06), y: h / 2 + 0.5, z: z - Math.sin(yaw) * sx * (w / 2 + 0.06), hx: 0.04, hy: h / 2 + 0.6, hz: d / 2, yaw, tag: 'static', material: 'metal', climbable: false });
      sc.blocksVision = false; sc.blocksBullets = false; this.world.add(sc);
    }
    return c;
  }
  // Warehouse racking: uprights, three shelf levels, boxes on the shelves.
  racking(x, z, yaw, bays = 3, { depth = 1.1, bayW = 2.7, levels = [0.05, 1.5, 3.0] } = {}) {
    const len = bays * bayW;
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    for (let i = 0; i <= bays; i++) for (const sz of [-1, 1]) local(boxGeo(0.08, 4.2, 0.08), 'steelBlue', -len / 2 + i * bayW, 2.1, sz * depth / 2);
    for (const ly of levels) { local(boxGeo(len, 0.06, depth), 'steelDark', 0, ly, 0); for (let i = 0; i < bays; i++) { const lx = -len / 2 + (i + 0.5) * bayW; if (Math.random() < 0.8) local(boxGeo(1.0, 0.9, 0.9), 'wood', lx - 0.55, ly + 0.5, 0); if (Math.random() < 0.7) local(boxGeo(0.9, 0.7, 0.8), 'wood', lx + 0.65, ly + 0.4, 0.05); } }
    const c = new Collider({ x, y: 2.1, z, hx: len / 2, hy: 2.1, hz: depth / 2, yaw, tag: 'static', material: 'metal', climbable: false }); this.world.add(c); return c;
  }
  forklift(x, z, yaw = 0) {
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    local(boxGeo(1.1, 0.7, 1.9), 'steelYellow', 0, 0.55, -0.2);                // body
    local(boxGeo(0.9, 0.5, 0.8), 'steelDark', 0, 1.15, -0.7);                  // counterweight/engine cover
    local(boxGeo(0.6, 0.12, 0.6), 'plastic', 0, 0.95, 0.05);                   // seat
    for (const sx of [-1, 1]) local(boxGeo(0.06, 1.3, 0.06), 'steelDark', sx * 0.5, 1.55, -0.55);   // cab posts rear
    for (const sx of [-1, 1]) local(boxGeo(0.06, 1.3, 0.06), 'steelDark', sx * 0.5, 1.55, 0.45);    // cab posts front
    local(boxGeo(1.15, 0.06, 1.1), 'steelDark', 0, 2.2, -0.05);                // roof
    for (const sx of [-1, 1]) local(boxGeo(0.08, 2.4, 0.1), 'steelDark', sx * 0.35, 1.2, 1.05);     // mast
    local(boxGeo(0.9, 0.08, 0.1), 'steelDark', 0, 2.35, 1.05);
    for (const sx of [-1, 1]) local(boxGeo(0.12, 0.05, 1.1), 'gunmetal', sx * 0.3, 0.08, 1.65);    // forks
    local(boxGeo(0.95, 0.5, 0.06), 'gunmetal', 0, 0.35, 1.12);                                     // carriage
    for (const [lx, lz] of [[-0.55, 0.6], [0.55, 0.6], [-0.5, -0.7], [0.5, -0.7]]) { local(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 14).rotateZ(Math.PI / 2), 'rubber', lx, 0.32, lz); }
    const c = new Collider({ x, y: 1.1, z, hx: 0.65, hy: 1.1, hz: 1.35, yaw, tag: 'static', material: 'metal', climbable: false }); this.world.add(c); return c;
  }
  dumpster(x, z, yaw = 0) {
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    local(boxGeo(2.0, 1.3, 1.2), 'containerGreen', 0, 0.75, 0);
    const lid = boxGeo(2.04, 0.06, 1.26); lid.rotateX(-0.12); local(lid, 'steelDark', 0, 1.45, -0.05);
    for (const sx of [-1, 1]) local(boxGeo(0.08, 0.12, 1.0), 'steelDark', sx * 0.95, 0.7, 0);
    for (const [lx, lz] of [[-0.8, 0.45], [0.8, 0.45], [-0.8, -0.45], [0.8, -0.45]]) local(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10).rotateZ(Math.PI / 2), 'rubber', lx, 0.1, lz);
    const c = new Collider({ x, y: 0.75, z, hx: 1.0, hy: 0.75, hz: 0.6, yaw, tag: 'static', material: 'metal' }); this.world.add(c); return c;
  }
  cableDrum(x, z, r = 0.65, yaw = 0) {
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    for (const sx of [-1, 1]) local(new THREE.CylinderGeometry(r, r, 0.08, 20).rotateZ(Math.PI / 2), 'wood', sx * 0.45, r, 0);
    local(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.85, 16).rotateZ(Math.PI / 2), 'rubber', 0, r, 0);
    const c = new Collider({ x, y: r, z, hx: 0.5, hy: r, hz: r * 0.9, yaw, tag: 'static', material: 'wood' }); this.world.add(c); return c;
  }
  tireStack(x, z, n = 4) {
    for (let i = 0; i < n; i++) this._push('rubber', new THREE.TorusGeometry(0.42, 0.16, 8, 20).rotateX(Math.PI / 2), x + (i % 2) * 0.04, 0.17 + i * 0.32, z);
    const c = new Collider({ x, y: n * 0.16, z, hx: 0.5, hy: n * 0.16, hz: 0.5, tag: 'static', material: 'concrete' }); this.world.add(c); return c;
  }
  gasCage(x, z, yaw = 0) {
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) local(boxGeo(0.05, 2.0, 0.05), 'steelDark', sx * 0.7, 1.0, sz * 0.5);
    for (const ly of [0.05, 1.0, 1.95]) { for (const sz of [-1, 1]) local(boxGeo(1.45, 0.04, 0.04), 'steelDark', 0, ly, sz * 0.5); for (const sx of [-1, 1]) local(boxGeo(0.04, 0.04, 1.05), 'steelDark', sx * 0.7, ly, 0); }
    for (let i = 0; i < 4; i++) local(new THREE.CylinderGeometry(0.13, 0.13, 1.4, 10), i % 2 ? 'steelBlue' : 'steelDark', -0.45 + i * 0.3, 0.7, 0);
    const c = new Collider({ x, y: 1.0, z, hx: 0.75, hy: 1.0, hz: 0.55, yaw, tag: 'static', material: 'metal', climbable: false }); c.blocksVision = false; this.world.add(c); return c;
  }
  bollard(x, z) { this.cylinder(x, 0, z, 0.14, 0.95, 'hazard', { material: 'metal', segs: 10 }); this._push('steelDark', new THREE.CylinderGeometry(0.14, 0.14, 0.12, 10), x, 0.7, z); }
  sign(text, x, y, z, yaw, w = 1.6, h = 0.4, opts = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mats.sign(text, { w: 512, h: Math.round(512 * h / w), ...opts }));
    m.position.set(x, y, z); m.rotation.y = yaw; this.root.add(m); return m;
  }
  roadLine(x1, z1, x2, z2, width = 0.15, matName = 'paintWhite', dash = 0) {
    const len = Math.hypot(x2 - x1, z2 - z1); const yaw = Math.atan2(x2 - x1, z2 - z1);
    if (!dash) { this._push(matName, new THREE.PlaneGeometry(width, len).rotateX(-Math.PI / 2), (x1 + x2) / 2, 0.012, (z1 + z2) / 2, yaw); return; }
    const n = Math.floor(len / (dash * 2));
    for (let i = 0; i < n; i++) { const t = (i * 2 + 0.5) * dash / len; this._push(matName, new THREE.PlaneGeometry(width, dash).rotateX(-Math.PI / 2), x1 + (x2 - x1) * t, 0.012, z1 + (z2 - z1) * t, yaw); }
  }
  drain(x, z) { this._push('grating', new THREE.PlaneGeometry(0.7, 0.7).rotateX(-Math.PI / 2), x, 0.014, z); this._push('steelDark', new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2), x, 0.013, z); }
  stain(x, z, r = 1.2) { this._push('stain', new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2), x, 0.011, z, Math.random() * 3); }
  kerb(x1, z1, x2, z2) { const len = Math.hypot(x2 - x1, z2 - z1); const yaw = Math.atan2(x2 - x1, z2 - z1); this._push('concreteLight', boxGeo(0.25, 0.14, len), (x1 + x2) / 2, 0.07, (z1 + z2) / 2, yaw); }
  blastWall(x1, z1, x2, z2, h = 1.2) { const len = Math.hypot(x2 - x1, z2 - z1); const yaw = Math.atan2(x2 - x1, z2 - z1); return this.box((x1 + x2) / 2, 0, (z1 + z2) / 2, 0.45, h, len, 'concreteDark', { yaw, material: 'concrete' }); }
  apron(x, z, w, d, h = 0.3) { return this.box(x, 0, z, w, h, d, 'concreteLight', { material: 'concrete' }); }
  canopy(x, z, w, d, h, yaw = 0) {
    this.box(x, h, z, w, 0.18, d, 'corrugated', { yaw, material: 'metal', collide: false });
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const lx = sx * (w / 2 - 0.3), lz = sz * (d / 2 - 0.3); this.cylinder(x + lx * cy + lz * sy, 0, z - lx * sy + lz * cy, 0.1, h, 'steelDark', { material: 'metal', segs: 8 }); }
  }
  boomGate(x, z, yaw = 0, len = 6) {
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    local(boxGeo(0.5, 1.1, 0.5), 'steelDark', 0, 0.55, 0);
    const arm = boxGeo(0.1, 0.1, len); arm.rotateX(-1.25); local(arm, 'hazard', 0, 1.0 + Math.sin(1.25) * len / 2, Math.cos(1.25) * len / 2);   // raised
    const c = new Collider({ x, y: 0.55, z, hx: 0.25, hy: 0.55, hz: 0.25, yaw, tag: 'static', material: 'metal' }); this.world.add(c); return c;
  }
  mixer(x, z, yaw = 0) {
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    local(boxGeo(1.4, 0.1, 0.9), 'steelYellow', 0, 0.5, 0);
    for (const sx of [-1, 1]) local(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12).rotateZ(Math.PI / 2), 'rubber', sx * 0.6, 0.3, -0.3);
    const drum = new THREE.SphereGeometry(0.55, 14, 10); drum.scale(1, 1.25, 1); drum.rotateZ(0.5); local(drum, 'orange', 0, 1.15, 0.05);
    const c = new Collider({ x, y: 0.8, z, hx: 0.7, hy: 0.8, hz: 0.55, yaw, tag: 'static', material: 'metal' }); this.world.add(c); return c;
  }
  sandPile(x, z, r = 1.6) { const g = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.45, 1); this._push('dirt', g, x, 0, z); const c = new Collider({ x, y: 0.2, z, hx: r * 0.6, hy: 0.2, hz: r * 0.6, tag: 'static', material: 'concrete' }); this.world.add(c); }
  windsock(x, z) {
    this.cylinder(x, 0, z, 0.06, 5, 'steelDark', { material: 'metal', segs: 8 });
    const cone = new THREE.ConeGeometry(0.22, 1.6, 12, 1, true); cone.rotateZ(Math.PI / 2); cone.rotateY(0.3); this._push('orange', cone, x + 0.9, 4.95, z + 0.25, 0, 0, 0);
  }
  panelRack(x, z, yaw = 0) {
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    for (const sx of [-1.4, 0, 1.4]) { const p = boxGeo(0.1, 2.9, 0.1); p.rotateX(-0.22); local(p, 'steelBlue', sx, 1.4, -0.35); }
    local(boxGeo(3.2, 0.1, 0.1), 'steelBlue', 0, 2.75, -0.65); local(boxGeo(3.2, 0.1, 0.6), 'steelBlue', 0, 0.05, -0.1);
  }
  // Guard booth: small hut with windows on three sides and an open doorway.
  booth(x, z, yaw = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const at = (lx, lz) => [x + lx * cy + lz * sy, z - lx * sy + lz * cy];
    let p;
    p = at(0, -1.1); this.box(p[0], 0, p[1], 2.6, 1.0, 0.15, 'concreteLight', { yaw, material: 'concrete' });   // front sill
    p = at(0, 1.1); this.box(p[0], 0, p[1], 2.6, 2.6, 0.15, 'concreteLight', { yaw, material: 'concrete' });    // back wall
    p = at(-1.25, 0); this.box(p[0], 0, p[1], 0.15, 1.0, 2.2, 'concreteLight', { yaw, material: 'concrete' });  // left sill
    p = at(1.25, 0.55); this.box(p[0], 0, p[1], 0.15, 2.6, 1.1, 'concreteLight', { yaw, material: 'concrete' }); // right wall with doorway at the front
    for (const [lx, lz, w, ry] of [[0, -1.1, 2.6, 0], [-1.25, 0, 2.2, Math.PI / 2]]) { const [gx, gz] = at(lx, lz); const gm = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.5), this.mats.get('glass')); gm.position.set(gx, 1.75, gz); gm.rotation.y = yaw + ry; this.root.add(gm); const c = new Collider({ x: gx, y: 1.75, z: gz, hx: ry ? 0.05 : w / 2, hy: 0.75, hz: ry ? w / 2 : 0.05, yaw, tag: 'static', material: 'metal', climbable: false }); c.blocksVision = false; c.blocksBullets = false; this.world.add(c); }
    for (const sx of [-1.3, 1.3]) for (const sz of [-1.1, 1.1]) { const [px, pz] = at(sx, sz); this._push('steelDark', boxGeo(0.12, 2.7, 0.12), px, 1.35, pz, yaw); }
    p = at(0, 0); this.box(p[0], 2.6, p[1], 3.0, 0.15, 2.7, 'steelDark', { yaw, material: 'metal', collide: false });
    this.desk(...at(0.2, 0.6), yaw + Math.PI);
    const l = this.lamp(p[0], 2.5, p[1], { kind: 'cool', intensity: 10, distance: 7, w: 0.5 });
    return l;
  }
  // Watchtower with a sweeping searchlight (the light is returned; the game animates its target).
  watchtower(x, z, yaw = 0, h = 6) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const lx = sx * 1.3, lz = sz * 1.3; this.cylinder(x + lx, 0, z + lz, 0.12, h, 'steelDark', { material: 'metal', segs: 8 }); }
    for (const yy of [2, 4]) for (const sx of [-1, 1]) { this._push('steelDark', boxGeo(0.06, 0.06, 2.6), x + sx * 1.3, yy, z); this._push('steelDark', boxGeo(2.6, 0.06, 0.06), x, yy, z + sx * 1.3); }
    this.box(x, h, z, 3.4, 0.2, 3.4, 'steelDark', { material: 'metal', climbable: false });
    for (const sx of [-1, 1]) { this.railing(x - 1.7, z + sx * 1.7, x + 1.7, z + sx * 1.7, h + 0.2, 1.0); this.railing(x + sx * 1.7, z - 1.7, x + sx * 1.7, z + 1.7, h + 0.2, 1.0); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.cylinder(x + sx * 1.5, h + 0.2, z + sz * 1.5, 0.05, 2.4, 'steelDark', { material: 'metal', segs: 6, collide: false });
    this.box(x, h + 2.6, z, 3.8, 0.12, 3.8, 'corrugated', { material: 'metal', collide: false });
    // ladder (visual)
    for (let i = 0; i < Math.floor(h / 0.3); i++) this._push('steelDark', boxGeo(0.5, 0.03, 0.03), x, 0.3 + i * 0.3, z - 1.55);
    // searchlight head
    const hx = x, hz = z + 1.4;
    this._push('lightHousing', new THREE.CylinderGeometry(0.32, 0.36, 0.5, 14).rotateX(Math.PI / 2), hx, h + 1.3, hz);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), this.mats.get('emissiveWarm')); face.position.set(hx, h + 1.3, hz + 0.26); this.root.add(face);
    const l = this.spot(hx, h + 1.3, hz, hx, 0, hz + 20, { intensity: 1600, angle: 0.22, penumbra: 0.4, shadow: false, distance: 70, color: 0xfff6dc, flood: true, decay: 1.4 });
    l.userData.fixture = face; l.userData.baseIntensity = 1600;
    l.userData.cone = this.lightCone(new THREE.Vector3(hx, h + 1.2, hz), new THREE.Vector3(hx, 0, hz + 20), { length: 30, radius: 3.5, opacity: 0.25 });
    l.userData.head = face;
    return l;
  }
  gateLeaf(x, z, yaw, w = 4, h = 2.6) {
    const local = (geo, mat, lx, ly, lz) => { geo.translate(lx, ly, lz); this._push(mat, geo, x, 0, z, yaw); };
    local(boxGeo(w, 0.08, 0.08), 'steelDark', 0, h - 0.04, 0); local(boxGeo(w, 0.08, 0.08), 'steelDark', 0, 0.3, 0);
    for (let i = 0; i <= Math.round(w / 0.16); i++) local(boxGeo(0.03, h - 0.3, 0.03), 'steelDark', -w / 2 + i * 0.16, h / 2 + 0.1, 0);
    const c = new Collider({ x, y: h / 2, z, hx: w / 2, hy: h / 2, hz: 0.06, yaw, tag: 'static', material: 'metal', climbable: false }); c.blocksVision = false; c.blocksBullets = false; this.world.add(c); return c;
  }

  // ---- doors ----
  door(x, z, yaw, { width = 1.3, height = 2.3, locked = false, auto = true, id = null, mat = 'steel', double = false, y = 0 } = {}) {
    const d = new Door(this, x, z, yaw, { width, height, locked, auto, id, mat, double, y });
    this.doors.push(d); return d;
  }

  // ---- movable modules ----
  module(type, x, z, yaw = 0, id = null, y = null, color = null) {
    const m = new Module(this, type, x, z, yaw, id, y, color); this.modules.push(m); return m;
  }

  // ---- zones (triggers) ----
  zone(id, x, z, w, d) { this.zones[id] = { id, x, z, w, d, contains: (p) => Math.abs(p.x - x) <= w / 2 && Math.abs(p.z - z) <= d / 2 }; return this.zones[id]; }

  // ---- finalize: merge batches into meshes ----
  finalize() {
    for (const [key, geos] of this.batches) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const matName = key;
      const mat = this.mats.get(matName);
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'batch_' + key;
      this.root.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.batches.clear();
  }
}

// ---------------- Door ----------------
export class Door {
  constructor(b, x, z, yaw, o) {
    this.b = b; this.x = x; this.y = o.y || 0; this.z = z; this.yaw = yaw; this.width = o.width; this.height = o.height; this.locked = o.locked; this.auto = o.auto; this.id = o.id; this.double = o.double;
    const y = this.y;
    this.open = 0; this.target = 0; this.state = 'closed';
    const mats = b.mats;
    // frame
    const fw = 0.12;
    b.box(x + Math.cos(yaw) * (o.width / 2 + fw / 2), y, z - Math.sin(yaw) * (o.width / 2 + fw / 2), fw, o.height + 0.1, 0.3, 'steelDark', { yaw, material: 'metal' });
    b.box(x - Math.cos(yaw) * (o.width / 2 + fw / 2), y, z + Math.sin(yaw) * (o.width / 2 + fw / 2), fw, o.height + 0.1, 0.3, 'steelDark', { yaw, material: 'metal' });
    b.box(x, y + o.height, z, o.width + fw * 2, 0.12, 0.3, 'steelDark', { yaw, material: 'metal' });
    // leaf (pivot at hinge side)
    this.pivot = new THREE.Group(); this.pivot.position.set(x + Math.cos(yaw) * (o.width / 2), y, z - Math.sin(yaw) * (o.width / 2)); this.pivot.rotation.y = yaw;
    const leaf = new THREE.Mesh(boxGeo(o.width, o.height, 0.08), mats.get(o.mat)); leaf.position.set(-o.width / 2, o.height / 2, 0); leaf.castShadow = true; leaf.receiveShadow = true; this.pivot.add(leaf);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.2), mats.get('gunmetal')); handle.position.set(-o.width + 0.2, 1.05, 0.08); this.pivot.add(handle);
    this.lockLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mats.get(o.locked ? 'emissiveRed' : 'emissiveGreen')); this.lockLight.position.set(-o.width + 0.2, 1.4, 0.06); this.pivot.add(this.lockLight);
    b.root.add(this.pivot);
    this.leaf = leaf;
    this.collider = new Collider({ x, y: y + o.height / 2, z, hx: o.width / 2, hy: o.height / 2, hz: 0.05, yaw, tag: 'door', material: 'metal', owner: this, climbable: false });
    b.world.add(this.collider);
    this.navDirty = true;
  }
  setLocked(v) { if (this.locked !== v) this.navDirty = true; this.locked = v; this.lockLight.material = this.b.mats.get(v ? 'emissiveRed' : 'emissiveGreen'); }
  // called by game each frame with nearby characters
  update(dt, characters) {
    let want = false;
    if (!this.locked) {
      for (const c of characters) {
        if (!c.alive) continue;
        const dx = c.pos.x - this.x, dz = c.pos.z - this.z;
        if (dx * dx + dz * dz < 2.2 * 2.2 && Math.abs(c.pos.y - this.y) < 1.5) { want = true; break; }
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
  constructor(b, type, x, z, yaw, id, y, color = null) {
    this.b = b; this.game = b.game; this.type = type; this.cfg = MODULE_TYPES[type]; this.id = id || (type + '_' + Module._n++); this.color = color;
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
    this.outline = new THREE.Group(); this.outline.visible = false; this.group.add(this.outline);
    for (const [matName, geos] of byMat) {
      const mat = this.b.mats.get(matName).clone(); this.materials.push(mat);
      const merged = mergeGeometries(geos, false);
      const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true; m.userData.module = this; this.group.add(m);
      // halo for the Architect view: same shape, back faces, slightly inflated
      const o = new THREE.Mesh(merged, Module.outlineMat()); o.scale.setScalar(1.03); o.position.y = -0.01; o.renderOrder = 4; this.outline.add(o);
      this.outlineMeshes = (this.outlineMeshes || []).concat(o);
    }
    this._parts = null;
  }
  static outlineMat() { return new THREE.MeshBasicMaterial({ color: 0x4fd6ff, side: THREE.BackSide, transparent: true, opacity: 0.55, depthWrite: false }); }
  // 'reach' (cyan) | 'locked' (dim) | 'target' (white, pulsing) | null (hidden)
  setOutline(mode, pulse = 0) {
    if (!this.outline) return;
    this.outline.visible = !!mode;
    if (!mode) return;
    for (const o of this.outlineMeshes) {
      const m = o.material;
      if (mode === 'target') { m.color.setHex(0xffffff); m.opacity = 0.55 + 0.35 * pulse; o.scale.setScalar(1.03 + 0.04 * pulse); }
      else if (mode === 'locked') { m.color.setHex(0x8a949c); m.opacity = 0.22; o.scale.setScalar(1.025); }
      else { m.color.setHex(0x4fd6ff); m.opacity = 0.5; o.scale.setScalar(1.03); }
    }
  }
  // world-space centre (for labels)
  get center() { return new THREE.Vector3(this.x, this.y + this.cfg.h / 2, this.z); }
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
        const col = this.color || cols[Module._n % cols.length];
        containerParts((geo, mat, lx, ly, lz) => this._mesh(geo, mat, lx, ly, lz), w, h, d, col);
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
