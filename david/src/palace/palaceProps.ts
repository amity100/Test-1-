import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from '../core/noise';
import { rockGeometry } from '../world/RockGen';
import { GeoBuilder, hewnBeam, pole, roomAO, vessel } from './palaceGeometry';
import { HALL } from './palaceLayout';
import type { PalaceMaterials, PalaceTier } from './palaceMaterials';

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function mesh(g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], cast = true, receive = true, name = '') {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = receive;
  o.name = name;
  return o;
}

/** Timber member between two points (hewn section w x h), merged into `b`. */
function stick(b: GeoBuilder, a: THREE.Vector3, c: THREE.Vector3, w: number, h: number, seed: number) {
  const d = c.clone().sub(a);
  const len = d.length();
  const g = hewnBeam(len, w, h, seed, Math.max(2, Math.round(len / 0.12)));
  const q = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), d.normalize());
  b.merge(g, new THREE.Matrix4().compose(a, q, V3(1, 1, 1)));
}

/** Open saucer lamp with one pinched spout (Iron Age). Spout points along +X. */
export function saucerLamp(): { geo: THREE.BufferGeometry; wick: THREE.Vector3 } {
  const g = vessel([[0.0, 0.0], [0.03, 0.0], [0.05, 0.006], [0.066, 0.02], [0.072, 0.034], [0.07, 0.038], [0.062, 0.03], [0.045, 0.014], [0.0, 0.01]], 28);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const r = Math.hypot(x, z);
    const phi = Math.atan2(z, x);
    const s = Math.exp(-((phi / 0.42) ** 2)) * THREE.MathUtils.smoothstep(r, 0.03, 0.07);
    const r2 = r * (1 + 0.42 * s);
    const phi2 = phi * (1 - 0.55 * s);
    pos.setXYZ(i, Math.cos(phi2) * r2, y + s * 0.006, Math.sin(phi2) * r2 * (1 - 0.25 * s));
  }
  g.computeVertexNormals();
  return { geo: g, wick: V3(0.088, 0.04, 0) };
}

/** Collared-rim storage jar (Iron Age I hill-country pithos), ~1.1 m. */
export function storageJar(scale = 1) {
  const p: [number, number][] = [[0, 0], [0.07, 0.0], [0.13, 0.05], [0.22, 0.2], [0.29, 0.42], [0.305, 0.6], [0.28, 0.78], [0.2, 0.93], [0.12, 0.99], [0.095, 1.01], [0.13, 1.03], [0.135, 1.05], [0.1, 1.07], [0.095, 1.13], [0.085, 1.13], [0.085, 1.06]];
  return vessel(p.map(([r, y]) => [r * scale, y * scale] as [number, number]), 26);
}

export function jug() {
  return vessel([[0, 0], [0.05, 0], [0.08, 0.03], [0.1, 0.1], [0.095, 0.17], [0.06, 0.22], [0.035, 0.26], [0.04, 0.3], [0.045, 0.31], [0.035, 0.31], [0.03, 0.27]], 20);
}

export function bowl(r = 0.14, h = 0.07) {
  return vessel([[0, 0], [r * 0.4, 0], [r * 0.8, h * 0.35], [r, h], [r * 0.95, h * 1.02], [r * 0.78, h * 0.45], [r * 0.3, h * 0.12], [0, h * 0.1]], 24);
}

/** A spear: ash shaft, socketed iron leaf-shaped head, bronze butt-spike. Origin at the butt, along +Y. */
export function spear(mats: PalaceMaterials, len = 2.55, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const shaft = pole(len - 0.36, 0.019, 0.016, seed, 8, 0.004);
  const sm = mesh(shaft, mats.wood);
  sm.rotation.z = Math.PI / 2;
  sm.position.y = 0.06;
  g.add(sm);
  // head: flattened lathe leaf with a midrib
  const head = vessel([[0.0, 0], [0.017, 0.0], [0.02, 0.08], [0.034, 0.16], [0.03, 0.24], [0.016, 0.31], [0.0, 0.34]], 12);
  const hp = head.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    const flat = y > 0.08 ? 0.22 : 1; // socket stays round
    const x = hp.getX(i), z = hp.getZ(i);
    hp.setXYZ(i, x, y, z * flat + Math.sign(z) * 0.0 + (Math.abs(x) < 0.004 ? 0.003 * Math.sign(z) : 0));
  }
  head.computeVertexNormals();
  const hm = mesh(head, mats.iron);
  hm.position.y = len - 0.34;
  g.add(hm);
  const butt = vessel([[0.0, 0.0], [0.006, 0.0], [0.016, 0.07], [0.019, 0.1], [0.0, 0.1]], 10);
  const bm = mesh(butt, mats.bronze);
  g.add(bm);
  return g;
}

/** Round shield: leather over a wicker / wooden frame, convex, rawhide rim, small bronze boss. Faces +Z. */
export function shield(mats: PalaceMaterials, r = 0.38) {
  const g = new THREE.Group();
  const cap = new THREE.SphereGeometry(r * 2.1, 36, 6, 0, Math.PI * 2, 0, Math.asin(1 / 2.1));
  const cp = cap.getAttribute('position') as THREE.BufferAttribute;
  const top = r * 2.1;
  for (let i = 0; i < cp.count; i++) cp.setY(i, cp.getY(i) - top * Math.cos(Math.asin(1 / 2.1)));
  const uv = cap.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cp.getX(i) * 2.5, cp.getZ(i) * 2.5);
  const face = mesh(cap, mats.leather);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  const rim = mesh(new THREE.TorusGeometry(r, 0.022, 8, 48), mats.leather);
  g.add(rim);
  const boss = mesh(new THREE.SphereGeometry(0.07, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.bronze);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = top * (1 - Math.cos(Math.asin(1 / 2.1))) - 0.004;
  g.add(boss);
  return g;
}

export interface LampSpot {
  /** flame base (wick tip) in world space */
  pos: THREE.Vector3;
  /** 0..1 how large the flame is */
  size: number;
  kind: 'lamp' | 'brazier';
}

export interface InteriorProps {
  group: THREE.Group;
  flames: LampSpot[];
  /** the king's own spear, leaning by the seat (hide it when a character holds it) */
  kingSpear: THREE.Group;
  kingSpearButt: THREE.Vector3;
  kingSpearTip: THREE.Vector3;
  /** seat surface (top of the cushion) centre */
  seatTop: THREE.Vector3;
  /** textile meshes with draft sway (for stats) */
  cloth: THREE.Mesh[];
}

/** Everything inside the king's hall. */
export function buildInteriorProps(mats: PalaceMaterials, tier: PalaceTier): InteriorProps {
  const H = HALL;
  const group = new THREE.Group();
  group.name = 'palace:interiorProps';
  const y0 = H.y0;
  const room = { x0: H.x0, x1: H.x1, y0, y1: H.ceil, z0: H.z0, z1: H.z1 };
  const flames: LampSpot[] = [];
  const cloth: THREE.Mesh[] = [];
  const rnd = mulberry32(2020);

  // ------------------------------------------------------------------ dais and benches (plastered stone)
  const D = H.dais;
  const st = new GeoBuilder();
  const ao = (p: THREE.Vector3, n: THREE.Vector3) => roomAO(p, n, room);
  const dTop = y0 + D.h;
  st.block(V3((D.x0 + D.x1) / 2, y0 + D.h / 2, (D.z0 + D.z1) / 2), V3(D.x1 - D.x0, D.h, D.z1 - D.z0), 0.25, 1 / 1.8, { faces: 'px nx pz py', ao });
  // step in front of the dais
  st.block(V3(H.cx, y0 + 0.06, D.z1 + 0.25), V3(2.2, 0.12, 0.5), 0.25, 1 / 1.8, { faces: 'px nx pz py', ao });
  // low benches along the side walls ("the seat by the wall" is the king's; the court sat on benches)
  const bH = 0.44, bD = 0.5;
  st.block(V3(H.x0 + bD / 2, y0 + bH / 2, -8.0), V3(bD, bH, 9.4), 0.25, 1 / 1.8, { faces: 'px pz nz py', ao });
  st.block(V3(H.x1 - bD / 2, y0 + bH / 2, -8.0), V3(bD, bH, 9.4), 0.25, 1 / 1.8, { faces: 'nx pz nz py', ao });
  group.add(mesh(st.build({ ao: true }), mats.plaster, true, true, 'palace:dais'));

  // ------------------------------------------------------------------ the king's seat
  const seat = new GeoBuilder();
  const sx = H.cx, sz = D.z0 + 0.95; // seat centre
  const sw = 0.74, sd = 0.62, sh = 0.5, backH = 1.32;
  const legs: [number, number][] = [[-sw / 2 + 0.05, -sd / 2 + 0.05], [sw / 2 - 0.05, -sd / 2 + 0.05], [-sw / 2 + 0.05, sd / 2 - 0.05], [sw / 2 - 0.05, sd / 2 - 0.05]];
  let sdx = 0;
  for (const [lx, lz] of legs) {
    const back = lz < 0;
    stick(seat, V3(sx + lx, dTop, sz + lz), V3(sx + lx, dTop + (back ? backH : sh + 0.2), sz + lz + (back ? -0.06 : 0)), 0.075, 0.075, 40 + sdx++);
  }
  // seat rails, stretchers, arm rests, back rails, slats
  for (const [a, b] of [[legs[0], legs[1]], [legs[2], legs[3]], [legs[0], legs[2]], [legs[1], legs[3]]] as [number, number][][]) {
    stick(seat, V3(sx + a[0], dTop + sh - 0.05, sz + a[1]), V3(sx + b[0], dTop + sh - 0.05, sz + b[1]), 0.07, 0.06, 50 + sdx++);
    stick(seat, V3(sx + a[0], dTop + 0.14, sz + a[1]), V3(sx + b[0], dTop + 0.14, sz + b[1]), 0.04, 0.04, 60 + sdx++);
  }
  for (const s of [-1, 1]) stick(seat, V3(sx + s * (sw / 2 - 0.05), dTop + sh + 0.2, sz + sd / 2 - 0.02), V3(sx + s * (sw / 2 - 0.05), dTop + sh + 0.22, sz - sd / 2 + 0.02), 0.07, 0.05, 70 + sdx++);
  for (const y of [dTop + sh + 0.35, dTop + backH - 0.04]) stick(seat, V3(sx - sw / 2 + 0.02, y, sz - sd / 2 + 0.05 - 0.06 * ((y - dTop) / backH)), V3(sx + sw / 2 - 0.02, y, sz - sd / 2 + 0.05 - 0.06 * ((y - dTop) / backH)), 0.08, 0.07, 80 + sdx++);
  for (let k = -2; k <= 2; k++) stick(seat, V3(sx + k * 0.12, dTop + sh, sz - sd / 2 + 0.045), V3(sx + k * 0.12, dTop + backH - 0.05, sz - sd / 2 - 0.01), 0.05, 0.02, 90 + sdx++);
  // seat board
  seat.merge(new RoundedBoxGeometry(sw - 0.02, 0.05, sd - 0.02, 2, 0.015), new THREE.Matrix4().makeTranslation(sx, dTop + sh - 0.01, sz));
  // footstool
  seat.merge(new RoundedBoxGeometry(0.62, 0.14, 0.34, 2, 0.02), new THREE.Matrix4().makeTranslation(sx, dTop + 0.07, sz + 0.62));
  const seatMesh = mesh(seat.build({ ao: false }), mats.wood, true, true, 'palace:seat');
  group.add(seatMesh);
  // cushion (argaman wool) and a sheep fleece over the back
  const cushion = new RoundedBoxGeometry(sw - 0.06, 0.1, sd - 0.04, 4, 0.045);
  const cu = mesh(cushion, mats.textile[2], true, true, 'palace:cushion');
  cu.position.set(sx, dTop + sh + 0.065, sz + 0.01);
  cu.geometry.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(cushion.getAttribute('position').count), 1));
  group.add(cu);
  const seatTop = V3(sx, dTop + sh + 0.115, sz + 0.02);
  // fleece: a lumpy pelt draped over the back rail, down the back and over the seat's rear half
  {
    const nu = 18, nv = 34;
    const path: THREE.Vector3[] = [V3(0, sh + 0.12, 0.02), V3(0, sh + 0.13, -sd / 2 + 0.1), V3(0, sh + 0.2, -sd / 2 + 0.02), V3(0, backH - 0.1, -sd / 2 - 0.02), V3(0, backH + 0.03, -sd / 2 - 0.06), V3(0, backH - 0.05, -sd / 2 - 0.16), V3(0, backH - 0.55, -sd / 2 - 0.2)];
    const curve = new THREE.CatmullRomCurve3(path);
    const pos: number[] = [], uv: number[] = [], idx: number[] = [], sway: number[] = [];
    const L = curve.getLength();
    for (let j = 0; j <= nv; j++) {
      const t = j / nv;
      const p = curve.getPointAt(t);
      const halfW = 0.34 + 0.05 * Math.sin(t * 9.0) + (t > 0.85 ? -0.08 * (t - 0.85) / 0.15 : 0);
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const x = (u - 0.5) * 2 * halfW;
        const bulge = 0.03 * Math.sin(u * Math.PI) + 0.012 * Math.sin(u * 17 + t * 23);
        const n = curve.getTangentAt(t).cross(V3(1, 0, 0)).normalize().multiplyScalar(-1);
        pos.push(sx + x, dTop + p.y + n.y * bulge, sz + p.z + n.z * bulge);
        uv.push(x * 2.2, t * L * 2.2);
        sway.push(0);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fg.setIndex(idx);
    fg.computeVertexNormals();
    const fm = mesh(fg, mats.fleece, true, true, 'palace:fleece');
    (fm.material as THREE.Material).side = THREE.DoubleSide;
    group.add(fm);
  }

  // ------------------------------------------------------------------ textiles
  const clothPlane = (w: number, h: number, folds: number, foldAmp: number, seg: number, cell: number, uvRep: [number, number], name: string) => {
    const nu = Math.max(4, Math.round(w * seg)), nv = Math.max(4, Math.round(h * seg));
    const pos: number[] = [], uv: number[] = [], sway: number[] = [], idx: number[] = [];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const x = (u - 0.5) * w;
        const hang = 1 - v; // 0 at top
        const fold = Math.sin(u * Math.PI * 2 * folds + Math.sin(v * 3.0) * 0.4) * foldAmp * (0.35 + 0.65 * hang) + Math.sin(u * 37.0) * 0.004;
        const sag = -Math.pow(Math.sin(u * Math.PI), 2) * 0.0;
        pos.push(x, -hang * h + sag, fold + 0.03);
        uv.push(u * uvRep[0], v * uvRep[1]);
        sway.push(hang * hang);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = mesh(g, mats.textile[cell], true, true, name);
    cloth.push(m);
    return m;
  };
  const clothSeg = tier === 'low' ? 6 : 14;
  // royal hanging behind the seat (dyed wool: scarlet, argaman, tekhelet on cream)
  const hang = clothPlane(3.3, 2.5, 7, 0.035, clothSeg, 0, [2, 1], 'palace:hanging');
  hang.position.set(sx, y0 + 4.05, H.z0 + 0.02);
  group.add(hang);
  // rod
  const rod = mesh(pole(3.8, 0.035, 0.03, 5, 8, 0.002), mats.beam, true, true);
  rod.position.set(sx - 1.9, y0 + 4.1, H.z0 + 0.09);
  group.add(rod);
  // side hangings near the dais
  for (const [x, rotY, cell] of [[H.x0 + 0.02, Math.PI / 2, 3], [H.x1 - 0.02, -Math.PI / 2, 3]] as [number, number, number][]) {
    const m = clothPlane(1.6, 2.2, 3, 0.03, clothSeg, cell, [1, 1], 'palace:sideHanging');
    m.position.set(x, y0 + 3.3, -13.4);
    m.rotation.y = rotY;
    group.add(m);
  }
  // rugs (kilim) before the dais and along the nave
  const rug = (w: number, l: number, x: number, z: number, rot: number, cell: number, rep: [number, number]) => {
    const g = new THREE.PlaneGeometry(w, l, Math.round(w * 6), Math.round(l * 6));
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const u = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i);
      const edge = Math.min(w / 2 - Math.abs(px), l / 2 - Math.abs(pz));
      p.setY(i, 0.012 + Math.sin(px * 7.1 + pz * 3.3) * 0.004 + (edge < 0.06 ? (0.06 - edge) * 0.08 : 0));
      u.setXY(i, u.getX(i) * rep[0], u.getY(i) * rep[1]);
    }
    g.computeVertexNormals();
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
    const m = mesh(g, mats.textile[cell], false, true, 'palace:rug');
    m.position.set(x, y0, z);
    m.rotation.y = rot;
    group.add(m);
    return m;
  };
  rug(3.0, 2.0, H.cx, D.z1 + 1.3, 0, 1, [1, 1]);
  rug(1.4, 6.0, H.cx, -6.0, 0, 1, [0.5, 3]);
  // folded mantles on the benches
  for (const [x, z] of [[H.x0 + 0.26, -6.2], [H.x1 - 0.26, -9.6], [H.x1 - 0.26, -4.3]] as [number, number][]) {
    const g = new RoundedBoxGeometry(0.48, 0.06, 1.1, 3, 0.025);
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count), 1));
    const m = mesh(g, mats.textile[3], true, true, 'palace:mantle');
    m.position.set(x, y0 + bH + 0.03, z);
    m.rotation.y = (rnd() - 0.5) * 0.1;
    group.add(m);
  }

  // ------------------------------------------------------------------ pottery, table, food
  const pottery = new THREE.Group();
  const jarGeo = storageJar();
  for (const [x, z, s, ry] of [[H.x0 + 0.45, H.z1 - 0.5, 1.0, 0.3], [H.x0 + 1.12, H.z1 - 0.42, 0.93, 1.3], [H.x0 + 0.42, H.z1 - 1.18, 1.04, 2.2], [H.x1 - 0.45, H.z1 - 0.48, 0.96, 0.7], [H.x1 - 0.5, -13.75, 0.9, 1.9]] as [number, number, number, number][]) {
    const m = mesh(jarGeo, mats.clay, true, true, 'palace:jar');
    m.position.set(x, y0, z);
    m.scale.setScalar(s);
    m.rotation.set((rnd() - 0.5) * 0.04, ry, (rnd() - 0.5) * 0.04);
    pottery.add(m);
  }
  // low table beside the dais (the king's table at the new moon)
  const tb = new GeoBuilder();
  const tx = H.cx + 1.75, tz = D.z1 + 0.35, tH = 0.46, tW = 1.2, tD = 0.62;
  for (const [lx, lz] of [[-tW / 2 + 0.07, -tD / 2 + 0.07], [tW / 2 - 0.07, -tD / 2 + 0.07], [-tW / 2 + 0.07, tD / 2 - 0.07], [tW / 2 - 0.07, tD / 2 - 0.07]]) {
    stick(tb, V3(tx + lx, y0, tz + lz), V3(tx + lx, y0 + tH - 0.04, tz + lz), 0.06, 0.06, 130 + Math.round(lx * 100 + lz * 10));
  }
  for (let k = 0; k < 3; k++) {
    const pz = tz - tD / 2 + tD / 6 + (k * tD) / 3;
    stick(tb, V3(tx - tW / 2, y0 + tH - 0.02, pz), V3(tx + tW / 2, y0 + tH - 0.02, pz + (k - 1) * 0.004), tD / 3 - 0.008, 0.04, 140 + k);
  }
  group.add(mesh(tb.build({ ao: false }), mats.wood, true, true, 'palace:table'));
  const tTop = y0 + tH + 0.0;
  // bread: round flat loaves, a jug, bowls with olives and figs
  const loaf = vessel([[0, 0], [0.1, 0.0], [0.125, 0.012], [0.13, 0.022], [0.115, 0.032], [0.0, 0.036]], 22);
  for (const [dx, dz, s] of [[-0.36, -0.08, 1.0], [-0.24, 0.06, 0.92], [-0.42, 0.12, 0.96]] as [number, number, number][]) {
    const m = mesh(loaf, mats.bread, true, true, 'palace:bread');
    m.position.set(tx + dx, tTop + (dz > 0 ? 0.03 : 0), tz + dz);
    m.scale.set(s, s * (0.9 + rnd() * 0.3), s);
    m.rotation.set((rnd() - 0.5) * 0.12, rnd() * 6, (rnd() - 0.5) * 0.12);
    pottery.add(m);
  }
  const jm = mesh(jug(), mats.clay, true, true, 'palace:jug');
  jm.position.set(tx + 0.36, tTop, tz - 0.1);
  pottery.add(jm);
  const jm2 = mesh(jug(), mats.clayDark, true, true, 'palace:jug');
  jm2.position.set(H.cx + 1.05, dTop, D.z0 + 0.35);
  jm2.scale.setScalar(1.3);
  pottery.add(jm2);
  const bowlGeo = bowl();
  const bowls: THREE.Vector3[] = [V3(tx + 0.05, tTop, tz + 0.08), V3(tx + 0.3, tTop, tz + 0.16)];
  for (const b of bowls) {
    const m = mesh(bowlGeo, mats.clay, true, true, 'palace:bowl');
    m.position.copy(b);
    pottery.add(m);
  }
  // olives (dark, glossy) and dried figs
  const olive = new THREE.SphereGeometry(0.011, 8, 6);
  olive.scale(1, 1, 1.35);
  const nOl = 34;
  const ol = new THREE.InstancedMesh(olive, mats.olive, nOl);
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion();
  for (let i = 0; i < nOl; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.09;
    const b = i < 20 ? bowls[0] : bowls[1];
    qq.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
    const s = i < 20 ? 1 : 2.1;
    mm.compose(V3(b.x + Math.cos(a) * r, b.y + 0.035 + (0.09 - r) * 0.2 + rnd() * 0.02, b.z + Math.sin(a) * r), qq, V3(s, s * 0.85, s));
    ol.setMatrixAt(i, mm);
    ol.setColorAt(i, i < 20 ? new THREE.Color(0.8 + rnd() * 0.3, 0.9, 0.7) : new THREE.Color(1.6, 0.9, 1.1));
  }
  ol.castShadow = true;
  ol.receiveShadow = true;
  ol.userData.noChunk = true;
  pottery.add(ol);
  group.add(pottery);

  // ------------------------------------------------------------------ lamps (open saucer lamps with one pinched spout)
  const lamp = saucerLamp();
  const lampSpot = (p: THREE.Vector3, yaw: number, size = 1) => {
    const m = mesh(lamp.geo, mats.clay, true, true, 'palace:lamp');
    m.position.copy(p);
    m.rotation.y = yaw;
    group.add(m);
    const w = lamp.wick.clone().applyAxisAngle(V3(0, 1, 0), yaw).add(p);
    flames.push({ pos: w, size, kind: 'lamp' });
  };
  // in the niches flanking the seat, facing the room; side-wall niches; on the table; on the benches
  lampSpot(V3(H.cx - 2.35, y0 + 1.5, H.z0 - 0.17), -Math.PI / 2 + 0.3, 1.0);
  lampSpot(V3(H.cx + 2.35, y0 + 1.5, H.z0 - 0.17), -Math.PI / 2 - 0.3, 1.0);
  lampSpot(V3(H.x1 + 0.17, y0 + 1.5, -5.6), Math.PI, 0.9);
  lampSpot(V3(H.x1 + 0.17, y0 + 1.5, -10.0), Math.PI, 0.9);
  lampSpot(V3(H.x0 - 0.17, y0 + 1.5, -5.6), 0, 0.9);
  lampSpot(V3(H.x0 - 0.17, y0 + 1.5, -10.0), 0, 0.9);
  lampSpot(V3(tx - 0.05, tTop, tz - 0.16), 0.4, 0.95);
  lampSpot(V3(H.x0 + 0.3, y0 + bH, -12.2), 0.2, 0.9);

  // ------------------------------------------------------------------ brazier: bronze bowl on an iron tripod, glowing charcoal
  const bz = new THREE.Group();
  const bx = H.cx - 1.3, bzz = D.z1 + 1.55;
  const bowlB = vessel([[0, 0], [0.12, 0.0], [0.3, 0.1], [0.36, 0.2], [0.37, 0.215], [0.34, 0.2], [0.28, 0.1], [0.1, 0.02], [0, 0.02]], 32);
  const bb = mesh(bowlB, mats.bronze, true, true, 'palace:brazier');
  bb.position.set(bx, y0 + 0.52, bzz);
  bz.add(bb);
  const tri = new GeoBuilder();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    stick(tri, V3(bx + Math.cos(a) * 0.36, y0, bzz + Math.sin(a) * 0.36), V3(bx + Math.cos(a) * 0.22, y0 + 0.56, bzz + Math.sin(a) * 0.22), 0.028, 0.028, 150 + k);
  }
  bz.add(mesh(tri.build({ ao: false }), mats.iron, true, true));
  const coalG = rockGeometry(77, { kind: 'pebble', detail: 1 });
  const nCoal = tier === 'low' ? 16 : 30;
  const coal = new THREE.InstancedMesh(coalG, mats.coal, nCoal);
  for (let i = 0; i < nCoal; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.25;
    qq.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
    const s = 0.035 + rnd() * 0.03;
    mm.compose(V3(bx + Math.cos(a) * r, y0 + 0.52 + 0.1 + (0.25 - r) * 0.25 + rnd() * 0.02, bzz + Math.sin(a) * r), qq, V3(s, s * 0.8, s));
    coal.setMatrixAt(i, mm);
    const g = 0.4 + rnd() * 0.9;
    coal.setColorAt(i, new THREE.Color(g, g, g));
  }
  coal.userData.noChunk = true;
  bz.add(coal);
  group.add(bz);
  flames.push({ pos: V3(bx, y0 + 0.52 + 0.19, bzz), size: 1, kind: 'brazier' });

  // ------------------------------------------------------------------ arms on the walls: round leather shields, spears on pegs
  const arms = new THREE.Group();
  for (const [z, s] of [[-7.2, 0.4], [-8.9, 0.36]] as [number, number][]) {
    const sh = shield(mats, s);
    sh.position.set(H.x0 + 0.06, y0 + 2.35, z);
    sh.rotation.y = Math.PI / 2;
    sh.rotation.x = 0.06;
    arms.add(sh);
  }
  for (let k = 0; k < 3; k++) {
    const sp = spear(mats, 2.35 + k * 0.1, 11 + k);
    sp.rotation.x = Math.PI / 2; // lie along the wall (+Y -> +Z)
    sp.rotation.z = 0.0;
    sp.position.set(H.x0 + 0.11 + k * 0.035, y0 + 3.05 + k * 0.13, -9.9);
    arms.add(sp);
  }
  // pegs
  const pegG = pole(0.16, 0.022, 0.018, 3, 6, 0);
  for (const [z, y] of [[-9.4, 3.02], [-7.1, 3.02], [-9.4, 3.3], [-7.1, 3.3]] as [number, number][]) {
    const m = mesh(pegG, mats.beam);
    m.position.set(H.x0, y0 + y, z);
    arms.add(m);
  }
  group.add(arms);
  // the king's spear: leaning against the wall at the right hand of the seat (1 Sam 22:6 / 26:7)
  const kingSpear = spear(mats, 2.62, 99);
  const butt = V3(sx - 0.7, dTop + 0.002, sz - 0.1);
  const tip = V3(sx - 0.84, dTop + 2.58, H.z0 + 0.05);
  const dir = tip.clone().sub(butt).normalize();
  kingSpear.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);
  kingSpear.position.copy(butt);
  kingSpear.name = 'palace:kingSpear';
  group.add(kingSpear);
  const kingSpearTip = butt.clone().addScaledVector(dir, 2.62);
  return { group, flames, kingSpear, kingSpearButt: butt, kingSpearTip, seatTop, cloth };
}
