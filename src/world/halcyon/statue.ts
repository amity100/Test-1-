import * as THREE from 'three';
import { Builder, V, col } from '../tower/kit';
import { CITY, type CityCtx } from './kit';
import { PEDESTAL } from './layout';

/** She is modelled at 1:1 on the drum (+10.4) and set up 1.4x about its top: the concept's hero, 41% of the start frame. */
export const STATUE_SCALE = 1.4;
const BASE_Y = 10.4;
/** Where a modelled point stands once she is scaled up. */
const up = (x: number, y: number, z: number) => V(PEDESTAL.x + (x - PEDESTAL.x) * STATUE_SCALE, BASE_Y + (y - BASE_Y) * STATUE_SCALE, PEDESTAL.z + (z - PEDESTAL.z) * STATUE_SCALE);
/** The armillary's centre, in her raised hand (her -X side: the viewer's right from the start). */
const ARM0 = V(-3, 31.4, 30.3);
export const ARMILLARY = up(ARM0.x, ARM0.y, ARM0.z);

const smooth = THREE.MathUtils.smoothstep;

/**
 * The Spirit of Tomorrow on the drum (+10.4): a robed bronze woman facing the
 * start, her cloak sweeping back, one arm raised holding the armillary sphere
 * on its pole, five brass ribbons swirling up round her. The armillary's
 * rings and two orbits of brass planets turn slowly; the orb glows.
 * Colliders: her body only (bullets stop on the bronze, rifts refuse it).
 */
export function buildStatue(ctx: CityCtx) {
  // (modelled at 1:1 into her own builder, then set into the chunk's scaled up)
  const b = new Builder();
  const m = ctx.mobile;
  const { x: cx, z: cz } = PEDESTAL;
  col(ctx, -4.5, BASE_Y, 27.5, 0.5, 30, 32.5, { tag: 'statue', noPortal: true });
  // (a warm mid bronze and a rose-gold brass: both keep their colour against the blue sky they mirror)
  const bronze = 0x7a5e40, brass = 0xc0843f;

  // ---- the robe: an oval lathe (shoulders wider than deep), folds fading toward the waist, a train behind
  const prof = [
    [1.9, 10.4], [1.85, 10.75], [1.6, 11.6], [1.5, 13.3], [1.3, 15.0], [1.14, 16.8], [0.98, 18.6], [0.92, 19.5], [0.72, 20.7], [0.9, 21.8], [0.9, 22.5], [1.02, 23.0], [0.7, 23.45], [0.34, 23.8], [0.28, 24.45], [0.22, 24.6],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.LatheGeometry(prof, m ? 24 : 48);
  const p = robe.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = Math.atan2(z, x);
    // folds (strongest at the hem), the oval section, the train sweeping back (+Z) and out to her left (+X)
    const k = 1 + 0.06 * Math.sin(13 * t + 0.4 * y) * smooth(20.5 - y, 0, 8);
    const back = Math.max(0, Math.sin(t));
    const train = 0.55 * smooth(17 - y, 0, 6.5) * back;
    p.setXYZ(i, x * k + 0.25 * train, y, z * k * (y > 19 ? 0.72 : 0.72 + 0.28 * smooth(19 - y, 0, 7)) + train);
  }
  robe.computeVertexNormals();
  robe.translate(cx, 0, cz);
  b.geo('statue', robe, bronze);
  robe.dispose();

  // ---- the cloak: from her shoulders down her back, billowing out behind and sweeping to her left
  cloak(b, cx, cz, m, bronze);

  // ---- head (tilted up toward the sphere), hair bun, a brass diadem
  const head = new THREE.SphereGeometry(0.5, m ? 10 : 16, m ? 8 : 12).scale(0.86, 1.16, 1.0).rotateZ(0.14).rotateX(-0.1).translate(cx - 0.06, 25.0, cz - 0.02);
  b.geo('statue', head, bronze);
  head.dispose();
  const bun = new THREE.SphereGeometry(0.3, 10, 8).scale(1, 0.85, 1).translate(cx + 0.02, 25.28, cz + 0.42);
  b.geo('statue', bun, bronze);
  bun.dispose();
  const diadem = new THREE.TorusGeometry(0.46, 0.05, 4, 20).rotateX(Math.PI / 2 - 0.25).translate(cx - 0.06, 25.36, cz + 0.02);
  b.geo('statue', diadem, brass);
  diadem.dispose();

  // ---- arms: the raised one (her -X side) up to the armillary's pole, the other down, holding her cloak
  const seg = m ? 7 : 10;
  limb(b, [V(cx - 0.92, 22.95, cz + 0.05), V(cx - 1.28, 25.7, cz + 0.15), V(cx - 1.08, 28.1, cz + 0.28)], [0.27, 0.21, 0.15], bronze, seg);
  limb(b, [V(cx + 0.92, 22.95, cz + 0.05), V(cx + 1.3, 20.8, cz - 0.25), V(cx + 1.55, 19.0, cz - 0.5)], [0.27, 0.21, 0.15], bronze, seg);
  // a draped sleeve hanging from the raised forearm
  const sleeve = new THREE.ConeGeometry(0.42, 1.8, seg, 1, true).translate(0, -0.9, 0).rotateZ(0.25).translate(cx - 1.2, 26.4, cz + 0.2);
  b.geo('statue', sleeve, bronze);
  sleeve.dispose();
  for (const [x, y, z] of [[cx - 1.05, 28.35, cz + 0.3], [cx + 1.6, 18.8, cz - 0.55]]) {
    const hand = new THREE.SphereGeometry(0.2, 8, 6).scale(1, 1.3, 1).translate(x, y, z);
    b.geo('statue', hand, bronze);
    hand.dispose();
  }

  // ---- brass ribbons swirling up round her from the drum
  const ribbons: Ribbon[] = [
    { a0: 0.3, dir: 1, turns: 1.3, y0: 10.5, y1: 27.5, r0: 2.8, bulge: 3.4, r1: 1.4, w: 1.4, twist: Math.PI * 1.1, swoop: 1.4 },
    { a0: 2.4, dir: -1, turns: 1.1, y0: 10.5, y1: 24.5, r0: 2.9, bulge: 3.8, r1: 2.0, w: 1.25, twist: -Math.PI * 0.9, swoop: 1.8 },
    { a0: 4.5, dir: 1, turns: 0.9, y0: 10.6, y1: 21.5, r0: 3.1, bulge: 2.8, r1: 2.8, w: 1.1, twist: Math.PI * 0.7, swoop: 1.1 },
    // (two more: one climbing to the armillary, one wide low sweep: the concept's vortex round her)
    { a0: 1.2, dir: -1, turns: 1.6, y0: 11.0, y1: 29.5, r0: 3.2, bulge: 4.2, r1: 1.9, w: 1.2, twist: -Math.PI * 1.3, swoop: 1.0 },
    { a0: 3.6, dir: 1, turns: 0.7, y0: 10.8, y1: 18.0, r0: 3.4, bulge: 3.0, r1: 3.8, w: 1.5, twist: Math.PI * 0.6, swoop: 2.0 },
  ];
  // (a wider swirl round her, as in the concept; on desktop a glowing rim along each one's outer edge)
  for (const rb of ribbons) ribbon(b, cx, cz, { ...rb, bulge: rb.bulge * 1.2 }, m ? 70 : 140, brass, !m);

  // ---- the armillary: pole, fixed meridian and horizon rings; rings that turn; the orb; two orbits of planets
  const A = ARM0;
  b.cylinder('statue', V(A.x, 28.2, A.z), V(A.x, 34.6, A.z), 0.09, brass, 8, 1, true);
  const fin = new THREE.SphereGeometry(0.2, 8, 6).translate(A.x, 34.75, A.z);
  b.geo('statue', fin, CITY.gilt);
  fin.dispose();
  const tseg = m ? 28 : 48;
  const mer = new THREE.TorusGeometry(2.9, 0.12, 6, tseg).translate(A.x, A.y, A.z);
  b.geo('statue', mer, brass);
  mer.dispose();
  const hor = new THREE.TorusGeometry(3.05, 0.08, 5, tseg).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
  b.geo('statue', hor, CITY.gilt);
  hor.dispose();
  // everything so far goes into the chunk scaled up about the drum's top (the turning parts follow, scaled alike)
  const S = new THREE.Matrix4().makeTranslation(cx, BASE_Y, cz).multiply(new THREE.Matrix4().makeScale(STATUE_SCALE, STATUE_SCALE, STATUE_SCALE)).multiply(new THREE.Matrix4().makeTranslation(-cx, -BASE_Y, -cz));
  for (const key of ['statue', 'emissive']) {
    const g = b.take(key);
    if (!g) continue;
    ctx.mb.geoColored(key, g, S);
    g.dispose();
  }
  const turn = new Builder();
  const colure = new THREE.TorusGeometry(2.62, 0.09, 5, tseg).rotateY(Math.PI / 2);
  turn.geo('statue', colure, brass);
  colure.dispose();
  // (the ecliptic: a flat band, like a zodiac ring)
  const ecl = new THREE.TorusGeometry(2.5, 0.07, 4, tseg).scale(1, 1, 3.2).rotateX(Math.PI / 2).rotateZ(0.41);
  turn.geo('statue', ecl, CITY.gilt);
  ecl.dispose();
  const rings = turn.build(ctx.materials, { name: 'armillary', castShadow: true });
  rings.position.copy(ARMILLARY);
  rings.scale.setScalar(STATUE_SCALE);
  ctx.zoneRoot.add(rings);
  // the orb: its own glow (it breathes)
  const orbMat = (ctx.materials.emissive as THREE.MeshBasicMaterial).clone();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.95, m ? 14 : 22, m ? 10 : 16), orbMat);
  orb.name = 'armillary:orb';
  orb.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(orb.geometry.getAttribute('position').count).fill(0).flatMap(() => [2.2, 1.55, 0.85]), 3));
  orb.position.copy(ARMILLARY);
  orb.scale.setScalar(STATUE_SCALE);
  ctx.zoneRoot.add(orb);
  // orbits: brass arcs carrying planets, each round its own tilted axis
  const orbits = [
    { r: 4.7, arc: 2.6, tilt: 0.28, speed: 0.05, planets: [[0, 0.34], [1.3, 0.26], [2.6, 0.4]] },
    { r: 6.6, arc: 2.1, tilt: -0.42, speed: -0.08, planets: [[0.2, 0.52], [2.1, 0.3]] },
  ];
  const spinners: [THREE.Object3D, number][] = [];
  for (const o of orbits) {
    const ob = new Builder();
    const arc = new THREE.TorusGeometry(o.r, 0.06, 4, m ? 20 : 36, o.arc).rotateX(Math.PI / 2);
    ob.geo('statue', arc, brass);
    arc.dispose();
    for (const [a, pr] of o.planets) {
      const pl = new THREE.SphereGeometry(pr, 12, 8).translate(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
      ob.geo('statue', pl, a === 0.2 ? CITY.copperFresh : CITY.gilt);
      pl.dispose();
      // (the biggest wears a ring)
      if (pr > 0.5) {
        const ring = new THREE.TorusGeometry(pr * 1.7, 0.04, 3, 20).rotateX(Math.PI / 2 - 0.4).translate(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
        ob.geo('statue', ring, brass);
        ring.dispose();
      }
    }
    // a spoke from the sphere to the arc's middle
    ob.beam('statue', V(0, 0, 0), V(Math.cos(o.arc / 2) * o.r, 0, Math.sin(o.arc / 2) * o.r), 0.05, 0.05, brass, 1);
    const tiltG = new THREE.Group();
    tiltG.position.copy(ARMILLARY);
    tiltG.scale.setScalar(STATUE_SCALE);
    tiltG.rotation.set(o.tilt, 0, o.tilt * 0.6);
    const g = ob.build(ctx.materials, { name: 'armillary:orbit', castShadow: false });
    tiltG.add(g);
    ctx.zoneRoot.add(tiltG);
    spinners.push([g, o.speed]);
  }
  ctx.animated.push((t) => {
    rings.rotation.y = t * 0.12;
    for (const [g, s] of spinners) g.rotation.y = t * s;
    orbMat.color.setScalar(1 + 0.15 * Math.sin((t * Math.PI * 2) / 6));
  });
}

/** A tapered limb through `pts` (radii per point), rounded at the joints. */
function limb(b: Builder, pts: THREE.Vector3[], radii: number[], color: number, seg: number) {
  for (let i = 0; i < pts.length - 1; i++) {
    b.cylinder('statue', pts[i], pts[i + 1], radii[i], color, seg, 1, false, radii[i + 1]);
    const j = new THREE.SphereGeometry(radii[i + 1] * 1.02, seg, 6).translate(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    b.geo('statue', j, color);
    j.dispose();
  }
  const s = new THREE.SphereGeometry(radii[0] * 1.08, seg, 6).translate(pts[0].x, pts[0].y, pts[0].z);
  b.geo('statue', s, color);
  s.dispose();
}

/** The cloak: a two-sided sheet from her shoulders, billowing back (+Z) and sweeping out to her left (+X). */
function cloak(b: Builder, cx: number, cz: number, mobile: boolean, color: number) {
  const nu = mobile ? 8 : 14, nv = mobile ? 12 : 22;
  const at = (u: number, v: number) => {
    const w = 1.05 + 1.5 * v;
    const x = cx + (u - 0.5) * 2 * w + 1.1 * v ** 1.6;
    const y = 23.1 - 12.4 * v;
    const z = cz + 0.5 + 1.5 * v ** 1.3 + 0.35 * Math.sin(Math.PI * u) * (0.4 + v) + 0.14 * Math.sin(u * 7 * Math.PI + v * 3) * v;
    return V(x, y, z);
  };
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const q = at(i / nu, j / nv);
    pos.push(q.x, q.y, q.z);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, c = a + nu + 1;
    idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  for (const side of [1, -1]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(side > 0 ? idx : idx.map((_, k) => idx[k - (k % 3) + 2 - (k % 3)]));
    g.computeVertexNormals();
    // (the back sheet sits a hair inside, so the cloth has a thickness)
    if (side < 0) {
      const p = g.getAttribute('position'), n = g.getAttribute('normal');
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * 0.05, p.getY(i) + n.getY(i) * 0.05, p.getZ(i) + n.getZ(i) * 0.05);
    }
    b.geo('statue', g, color);
    g.dispose();
  }
}

interface Ribbon {
  /** Start angle round her, the way it winds, and how far. */
  a0: number;
  dir: 1 | -1;
  turns: number;
  y0: number;
  y1: number;
  /** Radius at the drum, the bulge added mid-way, the radius at the top. */
  r0: number;
  bulge: number;
  r1: number;
  /** Width, the twist along it, a vertical swoop. */
  w: number;
  twist: number;
  swoop: number;
}

const _rim = new THREE.Color().setRGB(1.3, 0.85, 0.45);

/**
 * A brass ribbon: a thin band (front, back, both edges) swept along a rising
 * spiral, twisting as it goes. `glow`: its outer edge is a lit strip instead
 * (the concept's glowing ribbon edges; HDR, so it blooms softly).
 */
function ribbon(b: Builder, cx: number, cz: number, rb: Ribbon, n: number, color: number, glow: boolean) {
  const P: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = rb.a0 + rb.dir * Math.PI * 2 * rb.turns * t;
    const r = rb.r0 + (rb.r1 - rb.r0) * t + rb.bulge * Math.sin(Math.PI * t);
    const y = rb.y0 + (rb.y1 - rb.y0) * t + rb.swoop * Math.sin(Math.PI * 2 * 1.5 * t) * Math.sin(Math.PI * t);
    P.push(V(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
  }
  const pos: number[] = [];
  const up = V(0, 1, 0);
  const T = new THREE.Vector3(), R = new THREE.Vector3(), W = new THREE.Vector3(), N = new THREE.Vector3(), W0 = new THREE.Vector3(), X = new THREE.Vector3();
  const th = 0.05;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    T.subVectors(P[Math.min(n, i + 1)], P[Math.max(0, i - 1)]).normalize();
    R.set(P[i].x - cx, 0, P[i].z - cz).normalize();
    // the band faces outward (its width runs up the spiral), then twists about its own line
    W0.crossVectors(T, R);
    if (W0.lengthSq() < 1e-6) W0.copy(up);
    W0.normalize();
    X.crossVectors(T, W0).normalize();
    const phi = rb.twist * t;
    W.copy(W0).multiplyScalar(Math.cos(phi)).addScaledVector(X, Math.sin(phi)).normalize();
    N.crossVectors(W, T).normalize();
    // (narrow at both ends, as if tucked into the drum and curling away at the top)
    const hw = (rb.w / 2) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)));
    const c = P[i];
    for (const [s, e] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      pos.push(c.x + W.x * hw * s + N.x * th * e, c.y + W.y * hw * s + N.y * th * e, c.z + W.z * hw * s + N.z * th * e);
    }
  }
  // four faces per step: front (+N), back (-N), and the two edges, each with its own flat normal
  const out: number[] = [], on: number[] = [];
  const rimOut: number[] = [], rimN: number[] = [];
  const v = (i: number, k: number) => [pos[(i * 4 + k) * 3], pos[(i * 4 + k) * 3 + 1], pos[(i * 4 + k) * 3 + 2]];
  // (corners given going along the band on the face's far side: wound the other way round, so it faces out)
  const quad = (a: number[], bb: number[], c: number[], d: number[], to = out, tn = on) => {
    const e1 = V(d[0] - a[0], d[1] - a[1], d[2] - a[2]), e2 = V(bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]);
    const nn = e1.cross(e2);
    if (nn.lengthSq() < 1e-12) return;
    nn.normalize();
    for (const q of [a, d, c, a, c, bb]) {
      to.push(q[0], q[1], q[2]);
      tn.push(nn.x, nn.y, nn.z);
    }
  };
  for (let i = 0; i < n; i++) {
    // corners: 0 (+W,+N) 1 (-W,+N) 2 (-W,-N) 3 (+W,-N)
    quad(v(i, 1), v(i + 1, 1), v(i + 1, 0), v(i, 0));
    quad(v(i, 3), v(i + 1, 3), v(i + 1, 2), v(i, 2));
    if (glow) quad(v(i, 0), v(i + 1, 0), v(i + 1, 3), v(i, 3), rimOut, rimN);
    else quad(v(i, 0), v(i + 1, 0), v(i + 1, 3), v(i, 3));
    quad(v(i, 2), v(i + 1, 2), v(i + 1, 1), v(i, 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(on, 3));
  b.geo('statue', g, color);
  g.dispose();
  if (!glow) return;
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(rimOut, 3));
  r.setAttribute('normal', new THREE.Float32BufferAttribute(rimN, 3));
  b.geo('emissive', r, _rim);
  r.dispose();
}
