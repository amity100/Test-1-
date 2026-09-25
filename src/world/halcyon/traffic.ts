import * as THREE from 'three';
import { Builder, V } from '../tower/kit';
import { CITY, type CityCtx } from './kit';
import { CRESCENT, MERIDIAN, PEDESTAL } from './layout';

/** A path along a polyline (x, z) at height y: position and heading at a distance along it (clamped past its ends, straight on). */
function path(pts: [number, number][], y: number) {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1];
  return {
    total,
    at(d: number, out: THREE.Vector3): number {
      let i = 1;
      while (i < pts.length - 1 && lens[i] < d) i++;
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const t = (d - lens[i - 1]) / (lens[i] - lens[i - 1]);
      out.set(ax + (bx - ax) * t, y, az + (bz - az) * t);
      // (the heading: +X of a car turned to run along the line)
      return Math.atan2(-(bz - az), bx - ax);
    },
  };
}

/** Deterministic random numbers. */
function rnd(seed: number) {
  let v = seed;
  return () => {
    v = (v * 16807) % 2147483647;
    return (v - 1) / 2147483646;
  };
}

/** One template geometry per material key (merged from a Builder). */
function template(draw: (b: Builder) => void, keys: string[]) {
  const b = new Builder();
  draw(b);
  return keys.map((k) => b.take(k));
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _m = new THREE.Matrix4();
const _y = new THREE.Vector3(0, 1, 0);

/**
 * Life in the far city: Meridian trains gliding along both viaducts (warm
 * windows, blue-white roof strips), river launches on the north arm, swifts
 * circling high over the square and people in coats strolling the far
 * quays and the Pont d'Or (those two not on phones). Instanced: one draw per
 * template however many move; the matrices are set each frame. No shadows.
 * Each is culled as a whole, by a fixed sphere round everywhere it goes.
 */
export function buildTraffic(ctx: CityCtx) {
  const m = ctx.mobile;
  const mats = ctx.materials;
  const inst = (geo: THREE.BufferGeometry | null, key: string, n: number, name: string) => {
    const im = new THREE.InstancedMesh(geo!, mats[key], n);
    im.name = name;
    im.castShadow = false;
    ctx.zoneRoot.add(im);
    return im;
  };
  /**
   * Culled as one: a fixed sphere round every place its instances can reach (`box`: where their origins go),
   * grown by the template's own reach at its largest scale. Out of the view (or a rift's), no draw.
   */
  const reach = (im: THREE.InstancedMesh, box: THREE.Box3, maxScale = 1) => {
    const g = im.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const gs = g.boundingSphere!;
    box.expandByScalar((gs.center.length() + gs.radius) * maxScale);
    im.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    im.frustumCulled = true;
  };
  /** The box round a polyline (x, z) at height y. */
  const lineBox = (pts: [number, number][], y: number) => {
    const b = new THREE.Box3();
    for (const [x, z] of pts) b.expandByPoint(_p.set(x, y, z));
    return b;
  };

  // ---- trains: 3 cars each, 14 m long, cream over navy
  const [carBody, carGlow] = template((b) => {
    b.box('enamel', -6.8, 0.5, -1.5, 6.8, 1.8, 1.5, CITY.navy, 1, { ao: 0 });
    b.box('enamel', -6.8, 1.8, -1.5, 6.8, 3.4, 1.5, 0xede5d2, 1, { ao: 0 });
    b.box('enamel', -6.4, 3.4, -1.2, 6.4, 3.8, 1.2, 0x5a6270, 1, { ao: 0 });
    b.box('enamel', -6.2, 0, -1.1, 6.2, 0.5, 1.1, 0x2a2a2a, 1, { ao: 0 });
    b.box('emissive', -6.2, 2.2, -1.52, 6.2, 3.0, 1.52, new THREE.Color(1.5, 1.05, 0.55), 1, { ao: 0 });
    b.box('emissive', -6.6, 3.36, -1.26, 6.6, 3.46, 1.26, new THREE.Color(0.8, 1.7, 2.3), 1, { ao: 0 });
  }, ['enamel', 'emissive']);
  const trains = [
    { p: path(MERIDIAN.pts, MERIDIAN.deck + 0.2), speed: 22, offset: 0 },
    { p: path(CRESCENT.pts, CRESCENT.deck + 0.2), speed: -18, offset: 400 },
  ];
  const cars = trains.length * 3;
  const body = inst(carBody, 'enamel', cars, 'traffic:cars');
  const glow = inst(carGlow, 'emissive', cars, 'traffic:carGlow');
  // (both viaducts; past either end a car runs on up to 30 m, into the terminus)
  const rails = lineBox(MERIDIAN.pts, MERIDIAN.deck + 0.2).union(lineBox(CRESCENT.pts, CRESCENT.deck + 0.2)).expandByScalar(30);
  reach(body, rails.clone());
  reach(glow, rails.clone());

  // ---- river launches: varnished hull, cream cabin, a striped canopy, a wake
  const [boatBody] = template((b) => {
    // (origin at the waterline)
    b.box('paint', -3.4, -0.5, -1.2, 3.4, 0.5, 1.2, 0x5a3622, 1, { ao: 0 });
    b.box('paint', -3.5, 0.5, -1.3, 3.5, 0.62, 1.3, 0xc9a070, 1, { ao: 0 });
    b.box('paint', -1.2, 0.62, -0.9, 1.6, 1.6, 0.9, 0xefe3cc, 1, { ao: 0 });
    b.box('paint', -3.0, 2.1, -1.1, -1.2, 2.2, 1.1, CITY.red, 1, { ao: 0 });
    b.box('paint', -2.95, 0.62, -0.05, -2.9, 2.1, 0.05, CITY.brass, 1, { ao: 0 });
    // the wake: a pale fan spreading behind, just on the water
    b.quad('paint', V(-3.4, 0.03, -1.0), V(-3.4, 0.03, 1.0), V(-14, 0.03, 3.4), V(-14, 0.03, -3.4), 0xdfeaee);
  }, ['paint']);
  const boats = [
    { z: 110, speed: 1.5, x0: -60 },
    { z: 152, speed: -1.0, x0: 90 },
  ].slice(0, m ? 1 : 2);
  const boatIm = inst(boatBody, 'paint', boats.length, 'traffic:launches');
  reach(boatIm, new THREE.Box3(V(-420, -2.05, Math.min(...boats.map((b) => b.z))), V(420, -1.95, Math.max(...boats.map((b) => b.z)))));

  // ---- swifts: a dark V, circling high over the square (desktop only)
  const birds = m ? 0 : 20;
  let birdIm: THREE.InstancedMesh | null = null;
  const birdInfo: { r: number; y: number; w: number; a: number; f: number }[] = [];
  if (birds) {
    const [bird] = template((b) => {
      // (two-sided wings: a triangle each way)
      for (const s of [1, -1]) {
        b.quad('paint', V(0.25, 0, 0), V(-0.25, 0, 0), V(-0.1, 0.05, s * 0.55), V(-0.1, 0.05, s * 0.55), 0x1c1e24);
        b.quad('paint', V(-0.25, 0, 0), V(0.25, 0, 0), V(-0.1, 0.05, s * 0.55), V(-0.1, 0.05, s * 0.55), 0x1c1e24);
      }
    }, ['paint']);
    birdIm = inst(bird, 'paint', birds, 'traffic:swifts');
    for (let i = 0; i < birds; i++) birdInfo.push({ r: 30 + ((i * 37) % 21), y: 55 + ((i * 13) % 15), w: (0.18 + ((i * 7) % 5) * 0.03) * (i % 3 ? 1 : -1), a: i * 1.7, f: 6 + (i % 4) });
    // (circles of up to 50 m round the statue, 55-69 m up and bobbing 2 m; wings stretched up to 2.9x)
    const rMax = Math.max(...birdInfo.map((b) => b.r)), y0 = Math.min(...birdInfo.map((b) => b.y)) - 2, y1 = Math.max(...birdInfo.map((b) => b.y)) + 2;
    reach(birdIm, new THREE.Box3(V(PEDESTAL.x - rMax, y0, PEDESTAL.z - rMax), V(PEDESTAL.x + rMax, y1, PEDESTAL.z + rMax)), 2.9);
  }

  // ---- people in coats strolling the far quays and the Pont d'Or (desktop only; distant silhouettes, never in a fight)
  const walkers: { x: number; y: number; z: number; alongX: boolean; lo: number; hi: number; v: number }[] = [];
  let people: THREE.InstancedMesh | null = null;
  if (!m) {
    const [person] = template((b) => {
      b.box('paint', -0.16, 0, -0.1, 0.16, 0.5, 0.1, 0x2a2a30, 1, { ao: 0 });
      b.cylinder('paint', V(0, 0.45, 0), V(0, 1.55, 0), 0.34, 0xffffff, 6, 1, true, 0.24);
      const head = new THREE.SphereGeometry(0.13, 6, 4).translate(0, 1.7, 0);
      b.geo('paint', head, 0xc8a080);
      head.dispose();
      b.cylinder('paint', V(0, 1.78, 0), V(0, 1.9, 0), 0.17, 0x22242a, 6, 1, true, 0.12);
    }, ['paint']);
    const r = rnd(5);
    for (let i = 0; i < 16; i++) walkers.push({ x: -61 + r() * 8, y: 6.25, z: 0, alongX: false, lo: 82, hi: 188, v: (r() < 0.5 ? 1 : -1) * (1 + r() * 0.5) });
    for (let i = 0; i < 30; i++) walkers.push({ x: 0, y: 2, z: 191.2 + r() * 1.5, alongX: true, lo: -160, hi: 160, v: (r() < 0.5 ? 1 : -1) * (1 + r() * 0.5) });
    for (let i = 0; i < 14; i++) walkers.push({ x: 161.2 + r() * 1.5, y: 2, z: 0, alongX: false, lo: -100, hi: 70, v: (r() < 0.5 ? 1 : -1) * (1 + r() * 0.5) });
    // (spread along their lines)
    for (const w of walkers) {
      if (w.alongX) w.x = w.lo + r() * (w.hi - w.lo);
      else w.z = w.lo + r() * (w.hi - w.lo);
    }
    people = inst(person, 'paint', walkers.length, 'traffic:people');
    const walks = new THREE.Box3();
    for (const w of walkers) {
      walks.expandByPoint(_p.set(w.alongX ? w.lo : w.x, w.y, w.alongX ? w.z : w.lo));
      walks.expandByPoint(_p.set(w.alongX ? w.hi : w.x, w.y + 0.04, w.alongX ? w.z : w.hi));
    }
    reach(people, walks);
    const coats = [0x1d2b45, 0x3a2a22, 0x5a1a18, 0x3c4048, 0x6a5a48, 0x22242a];
    walkers.forEach((_, i) => people!.setColorAt(i, new THREE.Color(coats[i % coats.length])));
  }

  ctx.animated.push((t) => {
    if (people) {
      walkers.forEach((w, i) => {
        const span = w.hi - w.lo;
        const s = ((((w.alongX ? w.x : w.z) - w.lo + t * w.v) % span) + span) % span;
        _p.set(w.alongX ? w.lo + s : w.x, w.y + Math.abs(Math.sin(t * 5 + i)) * 0.04, w.alongX ? w.z : w.lo + s);
        const yaw = w.alongX ? (w.v > 0 ? Math.PI / 2 : -Math.PI / 2) : w.v > 0 ? 0 : Math.PI;
        _m.compose(_p, _q.setFromAxisAngle(_y, yaw), _s.set(1, 1, 1));
        people!.setMatrixAt(i, _m);
      });
      people.instanceMatrix.needsUpdate = true;
    }
    let k = 0;
    for (const tr of trains) {
      const loop = tr.p.total + 80;
      const head = ((((t * tr.speed + tr.offset) % loop) + loop) % loop) - 40;
      for (let c = 0; c < 3; c++) {
        // (cars trail the lead by 14.4 m; past either end they are inside the terminus)
        const d = THREE.MathUtils.clamp(head - Math.sign(tr.speed) * c * 14.4, -30, tr.p.total + 30);
        const yaw = tr.p.at(THREE.MathUtils.clamp(d, 0, tr.p.total), _p);
        if (d < 0 || d > tr.p.total) _p.x += Math.cos(yaw) * (d < 0 ? d : d - tr.p.total), _p.z -= Math.sin(yaw) * (d < 0 ? d : d - tr.p.total);
        _m.compose(_p, _q.setFromAxisAngle(_y, yaw), _s.set(1, 1, 1));
        body.setMatrixAt(k, _m);
        glow.setMatrixAt(k, _m);
        k++;
      }
    }
    body.instanceMatrix.needsUpdate = glow.instanceMatrix.needsUpdate = true;
    boats.forEach((bt, i) => {
      const x = ((((bt.x0 + t * bt.speed + 420) % 840) + 840) % 840) - 420;
      _p.set(x, -2 + Math.sin(t * 1.3 + i) * 0.04, bt.z);
      _m.compose(_p, _q.setFromAxisAngle(_y, bt.speed > 0 ? 0 : Math.PI), _s.set(1, 1, 1));
      boatIm.setMatrixAt(i, _m);
    });
    boatIm.instanceMatrix.needsUpdate = true;
    if (birdIm) {
      birdInfo.forEach((bd, i) => {
        const a = bd.a + t * bd.w;
        _p.set(PEDESTAL.x + Math.cos(a) * bd.r, bd.y + Math.sin(t * 0.4 + i) * 2, PEDESTAL.z + Math.sin(a) * bd.r);
        // heading along the circle; wings beat (a squash in y)
        const yaw = -a - (bd.w > 0 ? Math.PI / 2 : -Math.PI / 2);
        // (never a flat scale: a singular matrix would feed NaN normals to the shader)
        _m.compose(_p, _q.setFromAxisAngle(_y, yaw), _s.set(1.3, 1.6 + Math.sin(t * bd.f + i) * 1.3, 1.3));
        birdIm!.setMatrixAt(i, _m);
      });
      birdIm.instanceMatrix.needsUpdate = true;
    }
  });
}
