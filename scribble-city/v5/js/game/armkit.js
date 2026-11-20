// (ROADMAP 28.19) What a real weapon is made of, for the modelling kit of game/items.js (Kit.add takes any of these):
// steel plates cut to a side profile and pressed out, their edges broken; turned barrels and their bores; bent rod
// and wire; rails, cooling slots, screws, knurling. Everything in the held thing's own frame: +z to the muzzle, +y
// up, +x to its right; a side profile is [[z, y], ...] as the thing is seen from its right side... drawn muzzle to
// the right.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

// a corner of a profile rounded: r its radius, n the points round it
export function rounded(pts, r, n = 3) {
  const out = [];
  const N = pts.length;
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    const a = pts[(i + N - 1) % N];
    const b = pts[(i + 1) % N];
    const rr = p[2] !== undefined ? p[2] : r;
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const d = Math.min(rr, la * 0.45, lb * 0.45);
    if (!(d > 1e-5)) {
      out.push([p[0], p[1]]);
      continue;
    }
    const ax = p[0] + ((a[0] - p[0]) / la) * d;
    const ay = p[1] + ((a[1] - p[1]) / la) * d;
    const bx = p[0] + ((b[0] - p[0]) / lb) * d;
    const by = p[1] + ((b[1] - p[1]) / lb) * d;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      out.push([u * u * ax + 2 * u * t * p[0] + t * t * bx, u * u * ay + 2 * u * t * p[1] + t * t * by]);
    }
  }
  return out;
}

function shapeOf(pts, holes) {
  const sh = new THREE.Shape();
  pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
  sh.closePath();
  for (const h of holes || []) {
    const p = new THREE.Path();
    h.forEach(([z, y], i) => (i ? p.lineTo(z, y) : p.moveTo(z, y)));
    p.closePath();
    sh.holes.push(p);
  }
  return sh;
}

// a plate: the side profile pts pressed out across x from x0 to x1, its edges broken by bevel (o.bevel, metres);
// o.holes: profiles cut right through it; o.r: its corners rounded first
export function plate(pts, x0, x1, o = {}) {
  const P = o.r ? rounded(pts, o.r, o.rn || 3) : pts;
  const w = Math.abs(x1 - x0);
  const b = Math.max(0, Math.min(o.bevel === undefined ? 0.003 : o.bevel, w * 0.45));
  const g = new THREE.ExtrudeGeometry(shapeOf(P, o.holes), { depth: Math.max(1e-4, w - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: o.bs || 1, curveSegments: 4, steps: 1 });
  // (the shape's X to +z, its Y to +y, the pressing to -x)
  g.rotateY(-Math.PI / 2);
  g.computeBoundingBox();
  g.translate(Math.min(x0, x1) - g.boundingBox.min.x, 0, 0);
  return g;
}

// a box with all its edges broken (c: how much)
export function cbox(x0, y0, z0, x1, y1, z1, c = 0.004) {
  const k = Math.min(c, Math.abs(y1 - y0) * 0.3, Math.abs(z1 - z0) * 0.3);
  const a = Math.min(z0, z1);
  const b = Math.max(z0, z1);
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  return plate([[a + k, lo], [b - k, lo], [b, lo + k], [b, hi - k], [b - k, hi], [a + k, hi], [a, hi - k], [a, lo + k]], x0, x1, { bevel: c });
}

// a turned part about the z axis (at x, y): prof = [[z, r], ...], run muzzle-wards along its outside - and back along
// its inside for a bore. A sharp step in the profile is a sharp edge on the part; round it is smooth
export function lathe(prof, o = {}) {
  const segs = o.segs || 16;
  const P = prof.map(([z, r]) => [z, Math.max(r, 0)]);
  const n = P.length;
  // each stretch's own normal in the (z, r) plane
  const sn = [];
  for (let i = 0; i < n - 1; i++) {
    const dz = P[i + 1][0] - P[i][0];
    const dr = P[i + 1][1] - P[i][1];
    const l = Math.hypot(dz, dr) || 1;
    sn.push([-dr / l, dz / l]);
  }
  const soft = o.soft === undefined ? 0.82 : o.soft;
  const at = (i, j) => {
    // the normal of stretch i at its end j (0: its start, 1: its end): shared with its neighbour across a gentle bend
    const k = j ? i + 1 : i - 1;
    if (k < 0 || k >= n - 1) return sn[i];
    const d = sn[i][0] * sn[k][0] + sn[i][1] * sn[k][1];
    if (d < soft) return sn[i];
    const x = sn[i][0] + sn[k][0];
    const y = sn[i][1] + sn[k][1];
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const pos = [];
  const nor = [];
  const uv = [];
  const put = (z, r, nz, nr, c, s, u, v) => {
    pos.push(r * c, r * s, z);
    nor.push(nr * c, nr * s, nz);
    uv.push(u, v);
  };
  for (let i = 0; i < n - 1; i++) {
    const [za, ra] = P[i];
    const [zb, rb] = P[i + 1];
    if (Math.hypot(zb - za, rb - ra) < 1e-6) continue;
    const [naz, nar] = at(i, 0);
    const [nbz, nbr] = at(i, 1);
    for (let k = 0; k < segs; k++) {
      const t0 = (k / segs) * Math.PI * 2;
      const t1 = ((k + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(t0);
      const s0 = Math.sin(t0);
      const c1 = Math.cos(t1);
      const s1 = Math.sin(t1);
      const u0 = k / segs;
      const u1 = (k + 1) / segs;
      const v0 = i / (n - 1);
      const v1 = (i + 1) / (n - 1);
      if (ra > 1e-6) {
        put(za, ra, naz, nar, c0, s0, u0, v0);
        put(za, ra, naz, nar, c1, s1, u1, v0);
        put(zb, rb, nbz, nbr, c0, s0, u0, v1);
      }
      if (rb > 1e-6) {
        put(za, ra, naz, nar, c1, s1, u1, v0);
        put(zb, rb, nbz, nbr, c1, s1, u1, v1);
        put(zb, rb, nbz, nbr, c0, s0, u0, v1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (o.axis === 'y') {
    g.rotateX(-Math.PI / 2);
    g.translate(o.x || 0, 0, o.z || 0);
  } else if (o.axis === 'x') {
    g.rotateY(Math.PI / 2);
    g.translate(0, o.y || 0, o.z || 0);
  } else g.translate(o.x || 0, o.y || 0, 0);
  return g;
}

// a rod from p0 to p1 ([x, y, z] each), r0 thick at p0 and r1 at p1
export function rod(p0, p1, r0, r1 = r0, segs = 8) {
  _a.set(p0[0], p0[1], p0[2]);
  _b.set(p1[0], p1[1], p1[2]);
  const len = _a.distanceTo(_b);
  const g = new THREE.CylinderGeometry(r1, r0, len, segs, 1, false);
  _q.setFromUnitVectors(_Y, _b.clone().sub(_a).normalize());
  _m.compose(_a.clone().add(_b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}

// a bar of n flat sides along z (a pencil's body: six), r0 thick at z0 and r1 at z1 - a sharpened cone, if r1 is less.
// Flat faces, sharp edges (a lathe's are rounded). o: { x, y, sides, turn }
export function hexbar(z0, z1, r0, r1 = r0, o = {}) {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(z1 - z0), o.sides || 6, 1, false).toNonIndexed();
  g.computeVertexNormals();
  g.rotateX(Math.PI / 2);
  if (o.turn) g.rotateZ(o.turn);
  g.translate(o.x || 0, o.y || 0, (z0 + z1) / 2);
  return g;
}

// bent rod or wire through the points ([x, y, z] each)
export function pipe(points, r, o = {}) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, 'catmullrom', o.tension === undefined ? 0.35 : o.tension);
  return new THREE.TubeGeometry(c, o.steps || points.length * 5, r, o.segs || 6, !!o.closed);
}

// a box turned about x by a (radians) round the point (y, z) - a grip raked back, a sight leaf up
export function tilted(g, a, y = 0, z = 0) {
  g.translate(0, -y, -z);
  g.rotateX(a);
  g.translate(0, y, z);
  return g;
}

// the same part on the other side
export function mirrored(g) {
  const m = g.clone();
  m.scale(-1, 1, 1);
  // (mirrored: its faces turned back out)
  if (m.index) {
    const ix = m.index.array;
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix[i + 1];
      ix[i + 1] = ix[i + 2];
      ix[i + 2] = t;
    }
  } else {
    for (const name of ['position', 'normal', 'uv']) {
      const at = m.attributes[name];
      if (!at) continue;
      const n = at.itemSize;
      const A = at.array;
      for (let i = 0; i < A.length; i += n * 3) {
        for (let k = 0; k < n; k++) {
          const t = A[i + n + k];
          A[i + n + k] = A[i + 2 * n + k];
          A[i + 2 * n + k] = t;
        }
      }
    }
  }
  return m;
}

// ------------------------------------------------------------------ on a Kit (game/items.js): K, the pen (mat), a colour
// a rail of teeth along z on top of y (a sight rail), w wide
export function rail(K, mat, z0, z1, y, col, o = {}) {
  const w = o.w || 0.021;
  const x = o.x || 0;
  K.add(mat, cbox(x - w * 0.36, y, z0, x + w * 0.36, y + 0.004, z1, 0.001), col);
  const pitch = o.pitch || 0.0105;
  for (let z = z0 + 0.002; z + pitch * 0.5 <= z1; z += pitch) K.add(mat, plate([[z, y + 0.004], [z + pitch * 0.5, y + 0.004], [z + pitch * 0.5, y + 0.0095], [z, y + 0.0095]], x - w / 2, x + w / 2, { bevel: 0.0012 }), col);
}

// cooling slots: n dark slots along z between z0 and z1 on a side face at x (and its mirror), y0..y1 high
export function slots(K, mat, n, z0, z1, y0, y1, x, col, o = {}) {
  const step = (z1 - z0) / n;
  const len = step * (o.fill || 0.62);
  const lean = o.lean || 0;
  for (let i = 0; i < n; i++) {
    const z = z0 + step * i + (step - len) / 2;
    const P = [[z + lean, y0], [z + len + lean, y0], [z + len, y1], [z, y1]];
    for (const s of o.one ? [1] : [1, -1]) K.add(mat, plate(P, s * x - 0.0012, s * x + 0.0012, { bevel: 0.0006, r: Math.min(len, y1 - y0) * 0.3 }), col);
  }
}

// a screw head (or a pin, a rivet) on a side face: at (x, y, z), its axis along x, standing h proud; o.both: and its
// twin on the other side
export function screw(K, mat, x, y, z, r, col, o = {}) {
  const ax = Math.abs(x);
  const h = o.h || r * 0.45;
  const g = lathe([[ax, 0], [ax, r * 0.86], [ax + h * 0.55, r], [ax + h, r * 0.7], [ax + h, 0]], { axis: 'x', y, z, segs: o.segs || 8 });
  if (x >= 0 || o.both) K.add(mat, g, col);
  if (x < 0 || o.both) K.add(mat, mirrored(g), col);
}

// ridges cut across a grip or a slide: n of them along z, each a thin raised bar on both sides (o.one: 1 or -1, one side)
export function ridges(K, mat, n, z0, z1, y0, y1, x, col, o = {}) {
  const step = (z1 - z0) / n;
  const lean = o.lean || 0;
  const h = o.h || 0.0016;
  for (let i = 0; i < n; i++) {
    const z = z0 + step * (i + 0.25);
    const P = [[z + lean, y0], [z + step * 0.5 + lean, y0], [z + step * 0.5, y1], [z, y1]];
    for (const sd of o.one ? [o.one] : [1, -1]) K.add(mat, plate(P, sd * x, sd * (x + h), { bevel: 0.0005 }), col);
  }
}

// how many triangles a built thing is
export function trisOf(group) {
  let n = 0;
  group.traverse((x) => {
    if (x.isMesh) n += (x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3;
  });
  return Math.round(n);
}
