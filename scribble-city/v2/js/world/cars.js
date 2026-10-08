import * as THREE from 'three';
import { makeSurface, srgb } from '../render/materials.js';

// Low sports cars, glossy paint full of the sunset, a bar of red light across the back.

const glassM = () => makeSurface({ kind: 'glass', color: srgb(0.14, 0.13, 0.24), gloss: 0.95, lit: 0, line: 0.8, side: THREE.DoubleSide });
let tyreM = null;
let rimM = null;
let tailM = null;
let headM = null;

function profile() {
  // side view, x from the tail (0) to the nose (4.5), y up
  const s = new THREE.Shape();
  s.moveTo(0.06, 0.3);
  s.lineTo(0.0, 0.62);
  s.quadraticCurveTo(0.04, 0.9, 0.38, 0.96);
  s.lineTo(1.2, 1.0);
  s.quadraticCurveTo(1.62, 1.2, 2.05, 1.23);
  s.lineTo(2.6, 1.21);
  s.quadraticCurveTo(2.98, 1.12, 3.38, 0.9);
  s.lineTo(4.22, 0.72);
  s.quadraticCurveTo(4.5, 0.66, 4.52, 0.46);
  s.lineTo(4.44, 0.3);
  s.lineTo(0.06, 0.3);
  return s;
}

export function carMesh(color) {
  tyreM = tyreM || makeSurface({ kind: 'cyl', color: srgb(0.08, 0.07, 0.1), partR: 0.36, line: 0.9 });
  rimM = rimM || makeSurface({ kind: 'box', color: srgb(0.75, 0.75, 0.8), gloss: 0.5 });
  tailM = tailM || makeSurface({ kind: 'neon', color: srgb(1, 0.15, 0.2), emissive: new THREE.Color(5.0, 0.25, 0.3), line: 0.5 });
  headM = headM || makeSurface({ kind: 'neon', color: srgb(1, 0.95, 0.85), emissive: new THREE.Color(3.2, 3.0, 2.6), line: 0.5 });
  const paint = makeSurface({ kind: 'paint', color, gloss: 0.55, ang: 0.1 });
  const glass = glassM();
  const car = new THREE.Group();
  const body = new THREE.Group();
  body.rotation.y = Math.PI / 2; // the nose (+x) points down -z
  car.add(body);
  const Wd = 1.95;
  const ext = new THREE.ExtrudeGeometry(profile(), { depth: Wd - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.08, bevelSegments: 3, curveSegments: 10 });
  ext.translate(-2.26, 0, -(Wd - 0.3) / 2);
  body.add(new THREE.Mesh(ext, paint));
  // side windows
  const win = new THREE.Shape();
  win.moveTo(1.35, 1.0);
  win.quadraticCurveTo(1.7, 1.15, 2.05, 1.17);
  win.lineTo(2.55, 1.16);
  win.quadraticCurveTo(2.88, 1.08, 3.2, 0.92);
  win.lineTo(1.35, 0.94);
  for (const sd of [-1, 1]) {
    const g = new THREE.ShapeGeometry(win);
    g.translate(-2.26, 0, 0);
    const m = new THREE.Mesh(g, glass);
    m.position.z = sd * (Wd / 2 + 0.01);
    if (sd < 0) m.rotation.y = Math.PI;
    if (sd < 0) m.position.x = 0;
    body.add(m);
  }
  // windscreen and the rear glass: quads laid on the slopes of the roof
  const slopeQuad = (xa, ya, xb, yb, half) => {
    const nx = yb - ya;
    const ny = -(xb - xa);
    const l = Math.hypot(nx, ny);
    const n = [nx / l, ny / l];
    const o = 0.02;
    const A = [xa - 2.26 + n[0] * o, ya + n[1] * o];
    const Bp = [xb - 2.26 + n[0] * o, yb + n[1] * o];
    const pos = [A[0], A[1], -half, Bp[0], Bp[1], -half, Bp[0], Bp[1], half, A[0], A[1], -half, Bp[0], Bp[1], half, A[0], A[1], half];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n[0], n[1], 0]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    return new THREE.Mesh(g, glass);
  };
  const front = slopeQuad(3.36, 0.91, 2.62, 1.215, Wd / 2 - 0.22);
  front.material = glass;
  body.add(front);
  body.add(slopeQuad(2.0, 1.225, 1.24, 1.005, Wd / 2 - 0.3));
  // wheels
  for (const [x, z] of [[0.82, -1], [0.82, 1], [3.62, -1], [3.62, 1]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16).rotateX(Math.PI / 2), tyreM);
    t.position.set(x - 2.26, 0.36, z * (Wd / 2 - 0.12));
    body.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12).rotateX(Math.PI / 2), rimM);
    r.position.set(x - 2.26, 0.36, z * (Wd / 2 + 0.035));
    body.add(r);
  }
  // the bar of red light across the tail, the headlamps
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, Wd - 0.35), tailM);
  tail.position.set(-2.27, 0.78, 0);
  body.add(tail);
  for (const sd of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.38), headM);
    h.position.set(4.46 - 2.26, 0.6, sd * 0.62);
    h.rotation.z = -0.4;
    body.add(h);
  }
  return car;
}

export function buildCars(scene, W) {
  const list = [];
  const add = (color, lane, z, speed, dir) => {
    const m = carMesh(color);
    m.position.set(lane, 0, z);
    if (dir > 0) m.rotation.y = Math.PI;
    scene.add(m);
    list.push({ m, lane, speed, dir, z });
    return m;
  };
  // northbound, away from you (their tail-lights in the wet street)
  add(srgb(0.42, 0.18, 0.6), 7.1, -16, 8.5, -1);
  add(srgb(0.86, 0.12, 0.16), 11.0, -34, 10.5, -1);
  add(srgb(0.95, 0.95, 0.96), 7.2, -80, 9, -1);
  // southbound, towards you
  add(srgb(0.1, 0.55, 0.62), 3.0, -140, 9, 1);
  // parked at the curb
  const p1 = add(srgb(1.0, 0.75, 0.25), -1.55, -30, 0, -1);
  const p2 = add(srgb(0.2, 0.22, 0.3), -1.55, -52, 0, -1);
  for (const p of [p1, p2]) W.colliders.push({ type: 'box', x0: -2.6, x1: -0.5, z0: p.position.z - 2.4, z1: p.position.z + 2.4 });
  return {
    list,
    update(dt) {
      for (const c of list) {
        if (!c.speed) continue;
        c.m.position.z += c.dir * c.speed * dt;
        if (c.dir < 0 && c.m.position.z < -320) c.m.position.z = 70;
        if (c.dir > 0 && c.m.position.z > 80) c.m.position.z = -320;
      }
    },
  };
}
