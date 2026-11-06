import * as THREE from 'three';
import { srgb, hex, addLight } from '../../render/materials.js';
import { nextId, Facade } from '../kit.js';
import { CURB } from './plan.js';
import { ARENA, arenaDoor, Movers } from './landmarks.js';
import { palm } from '../palms.js';
import { streetLamp, trashCan, friendStandIn } from '../streets.js';
import { bench } from '../blocks.js';
import { neonSign } from '../deco.js';

// (v5, ROADMAP 11.17) The Bayfront Arena's plaza, near you (the arena itself, its glass and its
// lit band and its roof, is always there: world/mainland/landmarks.js): the stone of the plaza
// round it, the glass canopy over its doors on the boulevard with BAYFRONT ARENA in neon over it,
// the big screen in the north plaza with tonight's game, the giant pencil writing on the south
// plaza, the ticket windows, the flags, palms in their planters, benches, lamps; a friend stand.

const WHITE = srgb(0.97, 0.97, 0.98);

export function* buildArena(bctx, b) {
  const M = bctx.M;
  const r = bctx.rng;
  const R = b.rect;
  const { x: cx, z: cz, a, b: bb } = ARENA;
  // the plaza's stone over all of the block
  {
    const g = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0).rotateX(-Math.PI / 2);
    g.translate((R.x0 + R.x1) / 2, CURB + 0.012, (R.z0 + R.z1) / 2);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 6, -p.getZ(i) / 6);
    bctx.B.add(M.plaza, g, null, nextId());
  }
  // the doors on the boulevard: a glass canopy on white columns, the name over it
  const ex = cx + a;
  {
    const z0 = cz - 11;
    const z1 = cz + 11;
    const top = CURB + 6.2;
    bctx.B.box(M.wall, ex - 1, top, z0, R.x1 - 0.8, top + 0.35, z1, nextId(), { color: WHITE });
    bctx.B.box(M.winGlass, ex - 1, top + 0.35, z0 + 0.3, R.x1 - 1.1, top + 0.45, z1 - 0.3, nextId());
    for (let z = z0 + 1; z <= z1 - 0.9; z += 5) {
      const g = new THREE.CylinderGeometry(0.28, 0.32, top - CURB, 10);
      g.translate(R.x1 - 1.6, CURB + (top - CURB) / 2, z);
      bctx.B.add(M.wall, g, null, nextId(), { color: WHITE });
      bctx.col.addCircle(R.x1 - 1.6, z, 0.35, 0, top, 'pole');
    }
    // the doors (glass, lit from inside)
    for (let z = z0 + 2; z < z1 - 1.5; z += 3) bctx.B.box(M.winGlass, ex + 0.4, CURB, z, ex + 0.5, CURB + 3.2, z + 2.4, nextId());
    // the name, on a band standing on the canopy, facing the boulevard (and the bay)
    bctx.B.box(M.wall, R.x1 - 2.2, top + 0.35, z0 + 1, R.x1 - 1.7, top + 3.2, z1 - 1, nextId(), { color: hex('#16141c') });
    const f = new Facade(R.x1 - 1.68, z1 - 1, 0, -1, 1, 0);
    neonSign(bctx, f, 'BAYFRONT ARENA', (z1 - z0 - 2) / 2, top + 1.8, 0.02, z1 - z0 - 4, hex('#3fe8ff'), { font: 'Rubik', size: 96 });
    addLight(R.x1 + 2, top - 1, cz, 18, srgb(0.6, 0.85, 1), 1.2);
    addLight(R.x1 - 4, CURB + 3, cz, 12, srgb(1, 0.9, 0.75), 1.0);
  }
  yield;
  // the big screen in the north plaza: two legs, a frame, tonight's game on it
  {
    const z = R.z0 + 6;
    const x0 = cx - 8;
    const x1 = cx + 8;
    for (const x of [x0 + 1.5, x1 - 1.5]) {
      bctx.B.box(M.steel, x - 0.35, CURB, z - 0.35, x + 0.35, CURB + 6.5, z + 0.35, nextId(), { color: srgb(0.3, 0.3, 0.34) });
      bctx.col.addBox(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0, CURB + 6.5, 'pole');
    }
    bctx.B.box(M.wall, x0, CURB + 6.5, z - 0.5, x1, CURB + 13, z + 0.5, nextId(), { color: hex('#16141c') });
    const f = new Facade(x1 - 0.4, z - 0.52, -1, 0, 0, -1);
    const w = x1 - x0 - 0.8;
    neonSign(bctx, f, 'TONIGHT', w / 2, CURB + 12.0, 0.01, w * 0.5, hex('#ffe14f'), { font: 'Rubik', size: 90 });
    neonSign(bctx, f, 'WAVE  vs  PENS', w / 2, CURB + 10.0, 0.01, w * 0.95, hex('#ffffff'), { font: 'Permanent Marker', size: 96 });
    neonSign(bctx, f, '8:00 PM  ·  BAYFRONT ARENA', w / 2, CURB + 7.8, 0.01, w * 0.9, hex('#3fe8ff'), { font: 'Rubik', size: 70 });
    // (and the back of it: the arena's own name)
    const fb = new Facade(x0 + 0.4, z + 0.52, 1, 0, 0, 1);
    neonSign(bctx, fb, 'GO WAVE!', w / 2, CURB + 9.8, 0.01, w * 0.8, hex('#ff5ad1'), { font: 'Permanent Marker', size: 96 });
    addLight(cx, CURB + 9, z - 6, 18, srgb(0.7, 0.8, 1), 0.9);
  }
  // the giant pencil writing on the south plaza: leaning, its point down on the stone where a line
  // of its graphite goes curling away
  {
    const px = cx + 6;
    const pz = R.z1 - 9;
    const len = 12;
    const tilt = 0.42;
    const id = bctx.objects.begin(bctx, 'sculpture', px, pz);
    const grp = [];
    const body = new THREE.CylinderGeometry(0.9, 0.9, len, 6);
    body.translate(0, len / 2 + 1.6, 0);
    grp.push([M.prop, body, hex('#ffcf3a')]);
    const band = new THREE.CylinderGeometry(0.93, 0.93, 0.9, 6);
    band.translate(0, len + 1.6 + 0.45, 0);
    grp.push([M.steel, band, srgb(0.78, 0.8, 0.84)]);
    const eraser = new THREE.CylinderGeometry(0.88, 0.9, 1.4, 12);
    eraser.translate(0, len + 1.6 + 0.9 + 0.7, 0);
    grp.push([M.prop, eraser, hex('#ff7e9a')]);
    const wood = new THREE.ConeGeometry(0.9, 1.3, 6);
    wood.rotateX(Math.PI);
    wood.translate(0, 0.95 + 0.3, 0);
    grp.push([M.prop, wood, hex('#f2d2a6')]);
    const lead = new THREE.ConeGeometry(0.3, 0.45, 6);
    lead.rotateX(Math.PI);
    lead.translate(0, 0.22 + 0.08, 0);
    grp.push([M.prop, lead, srgb(0.2, 0.2, 0.24)]);
    const m = new THREE.Matrix4().makeRotationZ(-tilt).setPosition(px, CURB, pz);
    for (const [mat, g, c] of grp) {
      g.applyMatrix4(m);
      bctx.B.add(mat, g, null, nextId(), { color: c });
    }
    // the line it is writing
    const pts = [];
    for (let t = 0; t <= 1; t += 0.02) pts.push([px - t * 14 + Math.sin(t * 14) * 1.4, pz - Math.sin(t * 9) * 2.2 - t * 1.5]);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(L + 0.05, 0.02, 0.32);
      g.rotateY(-Math.atan2(bz - az, bx - ax));
      g.translate((ax + bx) / 2, CURB + 0.03, (az + bz) / 2);
      bctx.B.add(M.court, g, null, nextId(), { color: srgb(0.22, 0.22, 0.26) });
    }
    bctx.col.addCircle(px + Math.sin(tilt) * 5, pz, 1.4, 0, 12, 'prop');
    addLight(px + 3, CURB + 1, pz + 3, 10, srgb(1, 0.9, 0.7), 0.9);
    bctx.objects.end(bctx, id);
  }
  yield;
  // the ticket windows either side of the doors, the flags, the bollards along the boulevard
  for (const z of [cz - 18, cz + 18]) {
    const x = R.x1 - 5;
    bctx.B.box(M.wall, x - 1.6, CURB, z - 2.4, x + 1.6, CURB + 3.0, z + 2.4, nextId(), { color: WHITE });
    bctx.B.box(M.winGlass, x + 1.6, CURB + 1.1, z - 2.0, x + 1.65, CURB + 2.3, z + 2.0, nextId());
    bctx.B.box(M.wall, x - 1.8, CURB + 3.0, z - 2.7, x + 2.4, CURB + 3.25, z + 2.7, nextId(), { color: hex('#2eb8b8') });
    neonSign(bctx, new Facade(x + 2.42, z + 2.4, 0, -1, 1, 0), 'TICKETS', 2.4, CURB + 2.65, 0.02, 3.6, hex('#ffe14f'), { font: 'Rubik', size: 80 });
    bctx.col.addBox(x - 1.6, z - 2.4, x + 1.6, z + 2.4, 0, CURB + 3.2, 'wall');
  }
  const flagC = ['#2457c8', '#e8384f', '#ffcf3a'].map(hex);
  [cz - 26, cz + 26, R.z0 + 3].forEach((z, i) => {
    const x = i < 2 ? R.x1 - 3 : cx + 14;
    const g = new THREE.CylinderGeometry(0.07, 0.09, 12, 8);
    g.translate(x, CURB + 6, z);
    bctx.B.add(M.pole, g, null, nextId(), { color: WHITE });
    bctx.B.box(M.awning, x + 0.08, CURB + 9.6, z - 0.03, x + 2.6, CURB + 11.4, z + 0.03, nextId(), { color: flagC[i] });
    bctx.col.addCircle(x, z, 0.12, 0, 12, 'pole');
  });
  for (let z = R.z0 + 2; z < R.z1 - 1; z += 3.2) {
    if (Math.abs(z - cz) < 12) continue;
    const g = new THREE.CylinderGeometry(0.16, 0.18, 0.9, 8);
    g.translate(R.x1 - 0.6, CURB + 0.45, z);
    bctx.B.add(M.propCyl, g, null, nextId(), { color: srgb(0.85, 0.85, 0.88) });
    bctx.col.addCircle(R.x1 - 0.6, z, 0.2, 0, 1, 'prop');
  }
  // palms in round planters round the plazas, benches by them, lamps
  const planter = (x, z) => {
    const g = new THREE.CylinderGeometry(1.3, 1.4, 0.6, 14);
    g.translate(x, CURB + 0.3, z);
    bctx.B.add(M.wall, g, null, nextId(), { color: srgb(0.9, 0.88, 0.85) });
    palm(bctx, r, x, z, 9 + r() * 3, { y0: CURB + 0.6 });
    bctx.col.addCircle(x, z, 1.4, 0, 0.6, 'prop');
  };
  for (const z of [R.z0 + 4, R.z1 - 4]) for (let x = R.x0 + 4; x < R.x1 - 3; x += 12) if (Math.abs(x - (cx + 6)) > 6 || z < cz) planter(x, z);
  for (let z = R.z0 + 16; z < R.z1 - 14; z += 14) planter(R.x0 + 3.2, z);
  let k = 0;
  for (let x = R.x0 + 10; x < R.x1 - 6; x += 16, k++) {
    bench(bctx, x, R.z1 - 15, Math.PI, CURB);
    bench(bctx, x + 6, R.z0 + 15, 0, CURB);
    streetLamp(bctx, x + 3, R.z1 - 2, 0, -1, { light: k % 2 === 0 });
    streetLamp(bctx, x + 3, R.z0 + 2, 0, 1, { light: k % 2 === 1 });
  }
  trashCan(bctx, R.x1 - 7, cz - 13);
  trashCan(bctx, R.x1 - 7, cz + 13);
  yield;
  yield* arenaInside(bctx);
  // (DRAW YOURSELF A FRIEND, in the south plaza)
  friendStandIn(bctx, { x0: R.x0 + 2, x1: cx - 2, z0: cz + bb + 2, z1: R.z1 - 2 }, { from: 2, step: 1.5 });
  bctx.walks = [
    { a: [R.x0 + 2, R.z0 + 10], b: [R.x1 - 4, R.z0 + 10] },
    { a: [R.x0 + 2, R.z1 - 11], b: [R.x1 - 4, R.z1 - 11] },
    { a: [R.x1 - 9, R.z0 + 3], b: [R.x1 - 9, R.z1 - 3] },
    { a: [R.x0 + 1.5, R.z0 + 3], b: [R.x0 + 1.5, R.z1 - 3] },
  ];
}

// ------------------------------------------------------------------ inside
// Through the doors on the boulevard: the bowl of seats rising all round the court in tiers (each
// side its team's colour), the court of maple with its lines, the hoops, the benches and the
// scorers' table; the big screen hanging over the middle with tonight's score, the banners up
// under the roof; lit bright. The game itself, the players and the crowd: game/arenagame.js
export const COURT = { w: 15, l: 28 };
const BOWL = { a1: 11, b1: 18.5, a2: 22.4, b2: 35.4, K: 12, dh: 0.78 };
export function bowlAt(k) {
  // (tier k's inner ellipse and the height of its top)
  const t = k / BOWL.K;
  return { a: BOWL.a1 + (BOWL.a2 - BOWL.a1) * t, b: BOWL.b1 + (BOWL.b2 - BOWL.b1) * t, y: CURB + 0.45 + k * BOWL.dh };
}
export { BOWL };

function* arenaInside(bctx) {
  const M = bctx.M;
  const { x: cx, z: cz } = ARENA;
  const N = 64;
  const P = (t, a, b) => [cx + Math.cos(t) * a, cz + Math.sin(t) * b];
  // the floor inside
  {
    const g = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
    g.scale(ARENA.a - 0.5, 1, ARENA.b - 0.5);
    g.translate(cx, CURB + 0.02, cz);
    bctx.B.add(M.court, g, null, nextId(), { color: srgb(0.32, 0.3, 0.36) });
  }
  // the bowl: tier on tier, a riser and a tread each, the seats' backs along it
  const teamA = [srgb(0.86, 0.2, 0.28), srgb(0.7, 0.14, 0.22)];
  const teamB = [srgb(0.18, 0.42, 0.86), srgb(0.12, 0.3, 0.68)];
  // (a part's colour is the part's own, not its corners': one shape for each colour of seats)
  const byCol = new Map();
  const quad = (a, b, c, d, cc, both = false) => {
    const key = cc.getHexString();
    if (!byCol.has(key)) byCol.set(key, { c: cc, pos: [] });
    const pos = byCol.get(key).pos;
    // (the corners go round the way the face is seen from: the court, from above)
    pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    if (both) pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  for (let k = 0; k < BOWL.K; k++) {
    const A = bowlAt(k);
    const B2 = bowlAt(k + 1);
    const yPrev = k ? bowlAt(k - 1).y : CURB;
    for (let j = 0; j < N; j++) {
      const t0 = (j / N) * Math.PI * 2;
      const t1 = ((j + 1) / N) * Math.PI * 2;
      if (arenaDoor((t0 + t1) / 2) || Math.abs(Math.atan2(Math.sin((t0 + t1) / 2), Math.cos((t0 + t1) / 2))) < 0.24) continue;
      const side = Math.cos((t0 + t1) / 2) < 0 ? teamA : teamB;
      const c = side[(j >> 2) % 2].clone().multiplyScalar(k % 2 ? 1 : 0.88);
      const [x0, z0] = P(t0, A.a, A.b);
      const [x1, z1] = P(t1, A.a, A.b);
      const [x2, z2] = P(t1, B2.a, B2.b);
      const [x3, z3] = P(t0, B2.a, B2.b);
      // the riser (facing the court), the tread
      quad([x0, yPrev, z0], [x0, A.y, z0], [x1, A.y, z1], [x1, yPrev, z1], c.clone().multiplyScalar(0.62));
      quad([x0, A.y, z0], [x3, A.y, z3], [x2, A.y, z2], [x1, A.y, z1], c);
      // the seats' backs, two thirds back on the tread (seen from in front and from the row behind)
      const m = 0.68;
      const sx0 = x0 + (x3 - x0) * m;
      const sz0 = z0 + (z3 - z0) * m;
      const sx1 = x1 + (x2 - x1) * m;
      const sz1 = z1 + (z2 - z1) * m;
      quad([sx0, A.y, sz0], [sx0, A.y + 0.42, sz0], [sx1, A.y + 0.42, sz1], [sx1, A.y, sz1], c.clone().multiplyScalar(0.75), true);
    }
  }
  for (const { c, pos } of byCol.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    bctx.B.add(M.court, g, null, nextId(), { color: c });
  }
  // the band of suites over the bowl, its glass, a ring of light
  {
    const top = bowlAt(BOWL.K).y;
    for (let j = 0; j < N; j++) {
      const t0 = (j / N) * Math.PI * 2;
      const t1 = ((j + 1) / N) * Math.PI * 2;
      if (arenaDoor((t0 + t1) / 2)) continue;
      const [x0, z0] = P(t0, BOWL.a2 + 0.4, BOWL.b2 + 0.4);
      const [x1, z1] = P(t1, BOWL.a2 + 0.4, BOWL.b2 + 0.4);
      const L = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.BoxGeometry(L + 0.05, 2.2, 0.3);
      g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      g.translate((x0 + x1) / 2, top + 1.6, (z0 + z1) / 2);
      bctx.B.add(M.winGlass, g, null, nextId());
      const g2 = new THREE.BoxGeometry(L + 0.05, 0.16, 0.36);
      g2.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      g2.translate((x0 + x1) / 2, top + 0.4, (z0 + z1) / 2);
      bctx.B.add(M.neonSoft, g2, null, nextId(), { color: j % 2 ? hex('#3fe8ff') : hex('#ff5ad1') });
    }
  }
  yield;
  // the court: maple, its lines, the keys painted, the centre circle
  const hw = COURT.w / 2;
  const hl = COURT.l / 2;
  bctx.B.box(M.court, cx - hw - 2, CURB + 0.02, cz - hl - 2, cx + hw + 2, CURB + 0.05, cz + hl + 2, nextId(), { color: srgb(0.36, 0.2, 0.18) });
  bctx.B.box(M.court, cx - hw, CURB + 0.05, cz - hl, cx + hw, CURB + 0.07, cz + hl, nextId(), { color: srgb(0.88, 0.7, 0.48) });
  const line = (x0, z0, x1, z1, c = srgb(0.98, 0.97, 0.95)) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(L + 0.06, 0.012, 0.06);
    g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
    g.translate((x0 + x1) / 2, CURB + 0.075, (z0 + z1) / 2);
    bctx.B.add(M.court, g, null, nextId(), { color: c });
  };
  line(cx - hw, cz - hl, cx + hw, cz - hl);
  line(cx - hw, cz + hl, cx + hw, cz + hl);
  line(cx - hw, cz - hl, cx - hw, cz + hl);
  line(cx + hw, cz - hl, cx + hw, cz + hl);
  line(cx - hw, cz, cx + hw, cz);
  const arc = (x, z, r, a0, a1, n = 24) => {
    for (let i = 0; i < n; i++) {
      const p0 = a0 + ((a1 - a0) * i) / n;
      const p1 = a0 + ((a1 - a0) * (i + 1)) / n;
      line(x + Math.cos(p0) * r, z + Math.sin(p0) * r, x + Math.cos(p1) * r, z + Math.sin(p1) * r);
    }
  };
  arc(cx, cz, 1.8, 0, Math.PI * 2, 28);
  for (const s of [-1, 1]) {
    const hz = cz + s * (hl - 1.6);
    // the key, painted, its free throw circle; the three-point arc
    bctx.B.box(M.court, cx - 2.45, CURB + 0.072, Math.min(hz, hz - s * 4.2), cx + 2.45, CURB + 0.074, Math.max(hz + s * 1.6, hz - s * 4.2), nextId(), { color: s < 0 ? srgb(0.8, 0.2, 0.28) : srgb(0.2, 0.4, 0.84) });
    arc(cx, hz - s * 4.2, 1.8, 0, Math.PI * 2, 20);
    arc(cx, hz, 6.75, s > 0 ? Math.PI * 1.08 : 0.06, s > 0 ? Math.PI * 1.92 : Math.PI * 0.94, 32);
    // the hoop: its stanchion behind the baseline, the arm, the board, the rim, the net
    const bz = cz + s * (hl + 1.4);
    bctx.B.box(M.prop, cx - 0.7, CURB, bz - 0.6, cx + 0.7, CURB + 1.1, bz + 0.6, nextId(), { color: srgb(0.16, 0.16, 0.2) });
    bctx.B.box(M.steel, cx - 0.12, CURB + 1.1, bz - 0.12, cx + 0.12, CURB + 3.6, bz + 0.12, nextId(), { color: srgb(0.2, 0.2, 0.24) });
    bctx.B.box(M.steel, cx - 0.1, CURB + 3.45, Math.min(bz, hz + s * 0.2), cx + 0.1, CURB + 3.6, Math.max(bz, hz + s * 0.2), nextId(), { color: srgb(0.2, 0.2, 0.24) });
    bctx.B.box(M.winGlass, cx - 0.9, CURB + 2.9, hz + s * 0.2 - 0.03, cx + 0.9, CURB + 3.95, hz + s * 0.2 + 0.03, nextId());
    for (const [x0, y0, x1, y1] of [[-0.3, 3.05, 0.3, 3.09], [-0.3, 3.5, 0.3, 3.54], [-0.3, 3.05, -0.26, 3.54], [0.26, 3.05, 0.3, 3.54]]) bctx.B.box(M.prop, cx + x0, CURB + y0, hz + s * 0.17 - 0.01, cx + x1, CURB + y1, hz + s * 0.17 + 0.01, nextId(), { color: srgb(0.95, 0.35, 0.15) });
    const rim = new THREE.TorusGeometry(0.23, 0.02, 4, 16).rotateX(Math.PI / 2);
    rim.translate(cx, CURB + 3.05, hz - s * 0.1);
    bctx.B.add(M.steel, rim, null, nextId(), { color: srgb(0.95, 0.35, 0.15) });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tx = cx + Math.cos(a) * 0.23;
      const tz = hz - s * 0.1 + Math.sin(a) * 0.23;
      const bx = cx + Math.cos(a) * 0.13;
      const bz2 = hz - s * 0.1 + Math.sin(a) * 0.13;
      const L = Math.hypot(tx - bx, 0.4, tz - bz2);
      const g = new THREE.BoxGeometry(0.012, L, 0.012);
      g.translate(0, -L / 2, 0);
      g.rotateZ((tx - bx) * 0.9);
      g.rotateX(-(tz - bz2) * 0.9);
      g.translate(tx, CURB + 3.05, tz);
      bctx.B.add(M.prop, g, null, nextId(), { color: srgb(0.97, 0.97, 0.97) });
    }
    bctx.col.addBox(cx - 0.7, bz - 0.6, cx + 0.7, bz + 0.6, 0, CURB + 3.6, 'prop');
  }
  // the benches along the west side (a team's each), the scorers' table between them
  const benches = [];
  for (const s of [-1, 1]) {
    const z0 = Math.min(cz + s * 3.4, cz + s * 9);
    const z1 = Math.max(cz + s * 3.4, cz + s * 9);
    const tc = s < 0 ? srgb(0.7, 0.16, 0.22) : srgb(0.14, 0.32, 0.7);
    bctx.B.box(M.prop, cx - hw - 1.55, CURB, z0, cx - hw - 0.85, CURB + 0.46, z1, nextId(), { color: tc });
    bctx.B.box(M.prop, cx - hw - 1.68, CURB, z0, cx - hw - 1.52, CURB + 1.1, z1, nextId(), { color: tc });
    bctx.col.addBox(cx - hw - 1.7, z0, cx - hw - 0.85, z1, 0, CURB + 1.1, 'prop');
    for (let z = z0 + 0.6; z < z1 - 0.3; z += 0.9) benches.push({ x: cx - hw - 1.2, z, yaw: Math.PI / 2, team: s < 0 ? 0 : 1 });
  }
  bctx.B.box(M.prop, cx - hw - 1.9, CURB, cz - 2.4, cx - hw - 1.0, CURB + 0.95, cz + 2.4, nextId(), { color: srgb(0.12, 0.12, 0.16) });
  bctx.B.box(M.neonSoft, cx - hw - 1.01, CURB + 0.3, cz - 2.2, cx - hw - 0.98, CURB + 0.75, cz + 2.2, nextId(), { color: hex('#3fe8ff') });
  bctx.col.addBox(cx - hw - 1.9, cz - 2.4, cx - hw - 1.0, cz + 2.4, 0, CURB + 0.95, 'prop');
  // the seats at the edge of the court on the east side, either side of the way in (the best in
  // the house: game/arenagame.js sells you one)
  const courtside = [];
  for (const s of [-1, 1]) {
    for (const d of [4.9, 6.1, 7.3]) {
      const z = cz + s * d;
      const x = cx + hw + 1.5;
      bctx.B.box(M.prop, x - 0.25, CURB + 0.38, z - 0.26, x + 0.25, CURB + 0.48, z + 0.26, nextId(), { color: srgb(0.1, 0.1, 0.12) });
      bctx.B.box(M.prop, x + 0.2, CURB + 0.48, z - 0.26, x + 0.27, CURB + 1.0, z + 0.26, nextId(), { color: s < 0 ? srgb(0.7, 0.16, 0.22) : srgb(0.14, 0.32, 0.7) });
      for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) bctx.B.box(M.steel, x + lx - 0.02, CURB, z + lz - 0.02, x + lx + 0.02, CURB + 0.38, z + lz + 0.02, nextId(), { color: srgb(0.7, 0.72, 0.76) });
      courtside.push({ x: x - 0.02, z, yaw: -Math.PI / 2 });
    }
  }
  yield;
  // the big screen over the middle: four faces, the score on them, the cables up to the roof
  {
    const y0 = CURB + 13;
    const y1 = CURB + 16.6;
    const sx = 2.8;
    const sz = 3.8;
    bctx.B.box(M.wall, cx - sx, y0, cz - sz, cx + sx, y1, cz + sz, nextId(), { color: srgb(0.1, 0.1, 0.13) });
    bctx.B.box(M.neonSoft, cx - sx - 0.05, y1 - 0.25, cz - sz - 0.05, cx + sx + 0.05, y1 - 0.1, cz + sz + 0.05, nextId(), { color: hex('#ff5ad1') });
    bctx.B.box(M.neonSoft, cx - sx - 0.05, y0 + 0.1, cz - sz - 0.05, cx + sx + 0.05, y0 + 0.25, cz + sz + 0.05, nextId(), { color: hex('#3fe8ff') });
    const faces = [
      [new Facade(cx + sx, cz - sz - 0.02, -1, 0, 0, -1), sx * 2],
      [new Facade(cx - sx, cz + sz + 0.02, 1, 0, 0, 1), sx * 2],
      [new Facade(cx - sx - 0.02, cz - sz, 0, 1, -1, 0), sz * 2],
      [new Facade(cx + sx + 0.02, cz + sz, 0, -1, 1, 0), sz * 2],
    ];
    for (const [f, L] of faces) {
      neonSign(bctx, f, 'WAVE', L * 0.3, y0 + 2.6, 0.01, L * 0.46, hex('#ff6a7a'), { font: 'Rubik', size: 96 });
      neonSign(bctx, f, 'PENS', L * 0.3, y0 + 1.1, 0.01, L * 0.46, hex('#6ab4ff'), { font: 'Rubik', size: 96 });
    }
    bctx.scoreBoard = scoreBoard(bctx, faces, y0);
    for (const [dx, dz] of [[-sx, -sz], [sx, -sz], [-sx, sz], [sx, sz]]) {
      const g = new THREE.CylinderGeometry(0.04, 0.04, 6, 4);
      g.translate(cx + dx * 0.8, y1 + 3, cz + dz * 0.8);
      bctx.B.add(M.steel, g, null, nextId(), { color: srgb(0.3, 0.3, 0.34) });
    }
    addLight(cx, y0 - 1, cz, 34, srgb(1, 0.97, 0.9), 1.6);
    for (const s of [-1, 1]) addLight(cx, CURB + 11, cz + s * 10, 20, srgb(1, 0.96, 0.88), 1.0);
  }
  // the banners up under the roof at the north end, and the teams' flags
  {
    const bc = [hex('#e8384f'), hex('#2457c8'), hex('#ffcf3a'), hex('#e8384f'), hex('#2457c8')];
    for (let i = 0; i < 5; i++) {
      const x = cx - 8 + i * 4;
      const z = cz - BOWL.b2 + 3.5;
      bctx.B.box(M.awning, x - 1.1, CURB + 13, z - 0.02, x + 1.1, CURB + 17, z + 0.02, nextId(), { color: bc[i] });
      bctx.B.box(M.awning, x - 1.1, CURB + 13.6, z - 0.03, x + 1.1, CURB + 13.9, z + 0.03, nextId(), { color: srgb(0.98, 0.97, 0.94) });
    }
  }
  // you stay on the floor: a low wall along the front of the bowl (the way in left open), the
  // lit ribbon along its top all the way round
  const ribbon = ['#3fe8ff', '#ff5ad1', '#ffe14f'].map(hex);
  for (let j = 0; j < N; j++) {
    const tm = ((j + 0.5) / N) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(tm), Math.cos(tm))) < 0.24) continue;
    const [x0, z0] = P((j / N) * Math.PI * 2, BOWL.a1, BOWL.b1);
    const [x1, z1] = P(((j + 1) / N) * Math.PI * 2, BOWL.a1, BOWL.b1);
    bctx.B.box(M.prop, Math.min(x0, x1) - 0.06, CURB, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, CURB + 0.74, Math.max(z0, z1) + 0.06, nextId(), { color: srgb(0.1, 0.11, 0.2) });
    bctx.B.box(M.neonSoft, Math.min(x0, x1) - 0.05, CURB + 0.74, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, CURB + 1.05, Math.max(z0, z1) + 0.05, nextId(), { color: ribbon[(j >> 2) % 3] });
    bctx.col.addBox(Math.min(x0, x1) - 0.3, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, Math.max(z0, z1) + 0.3, 0, CURB + 6, 'wall');
  }
  // (the walls of the way in, from the doors to the floor)
  for (const s of [-1, 1]) {
    const t = s * 0.24;
    const [x0, z0] = P(t, BOWL.a1, BOWL.b1);
    const [x1, z1] = P(t, ARENA.a, ARENA.b);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const xa = x0 + ((x1 - x0) * i) / n;
      const za = z0 + ((z1 - z0) * i) / n;
      bctx.col.addBox(xa - 0.9, za - 0.9, xa + 0.9, za + 0.9, 0, CURB + 6, 'wall');
    }
  }
  // the game in here, its crowd: game/arenagame.js
  const seats = [];
  for (let k = 0; k < BOWL.K; k++) {
    const A = bowlAt(k);
    const B2 = bowlAt(k + 1);
    const n = Math.round(30 + k * 3.2);
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5 * (k % 2)) / n) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(t), Math.cos(t))) < 0.3) continue;
      const a = (A.a + B2.a) / 2 - 0.15;
      const b = (A.b + B2.b) / 2 - 0.15;
      const x = cx + Math.cos(t) * a;
      const z = cz + Math.sin(t) * b;
      seats.push({ x, y: A.y, z, yaw: Math.atan2(cx - x, cz - z), team: Math.cos(t) < 0 ? 0 : 1 });
    }
  }
  bctx.arena = { x: cx, z: cz, court: { x0: cx - hw, x1: cx + hw, z0: cz - hl, z1: cz + hl }, seats, benches, courtside, board: bctx.scoreBoard, hall: { x0: cx - ARENA.a, x1: cx + ARENA.a, z0: cz - ARENA.b, z1: cz + ARENA.b, y: CURB, top: ARENA.h + 6 } };
}

// The score on the big screen, beside each team's name on every face of it: three figures of lit
// bars, seven bars a figure, each bar shown or not (Movers: a bar not shown is folded away to
// nothing). board.set(team, points) - game/arenagame.js, as the game goes.
const BARS = [
  [0.12, 1.84, 0.88, 2.0],
  [0.84, 1.06, 1.0, 1.9],
  [0.84, 0.1, 1.0, 0.94],
  [0.12, 0.0, 0.88, 0.16],
  [0.0, 0.1, 0.16, 0.94],
  [0.0, 1.06, 0.16, 1.9],
  [0.12, 0.92, 0.88, 1.08],
];
const FIGURES = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
function scoreBoard(bctx, faces, y0) {
  const M = bctx.M;
  const { x: cx, z: cz } = ARENA;
  const H = new Movers(2 * 3 * 7);
  const cols = [hex('#ff6a7a'), hex('#6ab4ff')];
  for (const [f, L] of faces) {
    const cw = L * 0.115;
    const dw = cw * 0.7;
    const dh = Math.min(1.15, dw * 1.9);
    for (let team = 0; team < 2; team++) {
      const vy = (team ? y0 + 1.1 : y0 + 2.6) - dh / 2;
      for (let d = 0; d < 3; d++) {
        const u0 = L * 0.58 + d * cw;
        for (let q = 0; q < 7; q++) {
          const [a0, b0, a1, b1] = BARS[q];
          const [lo, hi] = f.box(u0 + a0 * dw, vy + (b0 * dh) / 2, 0.01, u0 + a1 * dw, vy + (b1 * dh) / 2, 0.05);
          const g = new THREE.BoxGeometry(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
          g.translate((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
          H.add((team * 3 + d) * 7 + q, M.neonSoft, g, cols[team]);
        }
      }
    }
  }
  H.flush(bctx.parent, [cx, y0 + 2, cz], 7);
  const board = {
    val: [-1, -1],
    set(team, v) {
      v = Math.max(0, Math.min(999, Math.round(v)));
      if (this.val[team] === v) return;
      this.val[team] = v;
      const s = String(v).padStart(3, ' ');
      for (let d = 0; d < 3; d++) {
        const on = s[d] === ' ' ? '' : FIGURES[+s[d]];
        for (let q = 0; q < 7; q++) {
          const m = H.mats[(team * 3 + d) * 7 + q];
          if (on.includes('abcdefg'[q])) m.identity();
          else m.makeScale(0, 0, 0);
        }
      }
      H.commit();
    },
  };
  board.set(0, 0);
  board.set(1, 0);
  return board;
}
