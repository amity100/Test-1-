import * as THREE from 'three';
import { mulberry32 } from '../core/noise';
import { GeoBuilder, hewnBeam, pole, roomAO, type Rect } from './palaceGeometry';
import { FORT, GATE, HALL, TAMARISK } from './palaceLayout';
import { gibeahHeight, SUMMIT } from './palaceTerrain';
import type { PalaceMaterials, PalaceTier } from './palaceMaterials';

export interface WindowOpening {
  /** centre of the opening on the inner wall face */
  center: THREE.Vector3;
  w: number;
  h: number;
  /** inward normal (into the hall) */
  inward: THREE.Vector3;
  /** unit vector along the wall (horizontal) */
  along: THREE.Vector3;
}

export interface Architecture {
  group: THREE.Group;
  windows: WindowOpening[];
  /** lamp spots in wall niches: position of the lamp base and the niche's outward normal */
  niches: { pos: THREE.Vector3; normal: THREE.Vector3 }[];
  doorCenter: THREE.Vector3;
  /** meshes that make up the hall (for the interior light probe / shadow tuning) */
  hallMeshes: THREE.Mesh[];
  stats: { houses: number };
  /** village house footprints [x, z, radius] (vegetation keeps clear of them) */
  houseSpots: [number, number, number][];
}

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function mesh(g: THREE.BufferGeometry, m: THREE.Material, cast = true, receive = true, name = '') {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = receive;
  o.name = name;
  return o;
}

/** Parapet with rectangular crenellations along one edge (outer face flush with the wall face). */
function parapet(b: GeoBuilder, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, spacing: number, alongX: boolean) {
  const low = y0 + 0.62;
  const len = alongX ? x1 - x0 : z1 - z0;
  b.block(V3((x0 + x1) / 2, (y0 + low) / 2, (z0 + z1) / 2), V3(x1 - x0, low - y0, z1 - z0), spacing, 0.3, { faces: 'px nx pz nz py', dispEdge: 0.2 });
  const merlon = 1.45, gap = 0.85;
  const n = Math.max(1, Math.floor((len + gap) / (merlon + gap)));
  const used = n * merlon + (n - 1) * gap;
  let s = (len - used) / 2;
  for (let i = 0; i < n; i++) {
    const a = s, c = s + merlon;
    if (alongX) b.block(V3(x0 + (a + c) / 2, (low + y1) / 2, (z0 + z1) / 2), V3(merlon, y1 - low, z1 - z0), spacing, 0.3, { faces: 'px nx pz nz py', dispEdge: 0.2 });
    else b.block(V3((x0 + x1) / 2, (low + y1) / 2, z0 + (a + c) / 2), V3(x1 - x0, y1 - low, merlon), spacing, 0.3, { faces: 'px nx pz nz py', dispEdge: 0.2 });
    s += merlon + gap;
  }
}


/**
 * Battered base (sloping stone skirt / glacis) around a rectangular footprint [x0,x1] x [z0,z1]: the face leans from
 * the wall at `yTop` out by `d` at `yBot` (below ground). `sides` picks the faces ('n' = -Z, 's' = +Z, 'w' = -X,
 * 'e' = +X); adjacent battered faces are mitred at the corners. Tessellated like the walls (aDisp 0 on the borders).
 */
function batter(b: GeoBuilder, x0: number, x1: number, z0: number, z1: number, yTop: number, yBot: number, d: number, sides: string, spacing: number) {
  const has = (c: string) => sides.includes(c);
  // corners of the top (wall face) and bottom (expanded) rectangles
  const faces: { t0: THREE.Vector3; t1: THREE.Vector3; b0: THREE.Vector3; b1: THREE.Vector3 }[] = [];
  const ex = (c: string) => (has(c) ? d : 0);
  if (has('n')) faces.push({ t0: V3(x1, yTop, z0), t1: V3(x0, yTop, z0), b0: V3(x1 + ex('e'), yBot, z0 - d), b1: V3(x0 - ex('w'), yBot, z0 - d) });
  if (has('s')) faces.push({ t0: V3(x0, yTop, z1), t1: V3(x1, yTop, z1), b0: V3(x0 - ex('w'), yBot, z1 + d), b1: V3(x1 + ex('e'), yBot, z1 + d) });
  if (has('w')) faces.push({ t0: V3(x0, yTop, z0), t1: V3(x0, yTop, z1), b0: V3(x0 - d, yBot, z0 - ex('n')), b1: V3(x0 - d, yBot, z1 + ex('s')) });
  if (has('e')) faces.push({ t0: V3(x1, yTop, z1), t1: V3(x1, yTop, z0), b0: V3(x1 + d, yBot, z1 + ex('s')), b1: V3(x1 + d, yBot, z0 - ex('n')) });
  const p = new THREE.Vector3(), q0 = new THREE.Vector3(), q1 = new THREE.Vector3();
  for (const f of faces) {
    const len = f.b0.distanceTo(f.b1);
    const nu = Math.max(1, Math.round(len / spacing));
    const nv = Math.max(1, Math.round(f.t0.distanceTo(f.b0) / spacing));
    const n = new THREE.Vector3().subVectors(f.b1, f.b0).cross(new THREE.Vector3().subVectors(f.t0, f.b0)).normalize();
    const ids: number[][] = [];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      ids.push([]);
      q0.lerpVectors(f.b0, f.t0, v);
      q1.lerpVectors(f.b1, f.t1, v);
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        p.lerpVectors(q0, q1, u);
        const m = Math.min(u * len, (1 - u) * len, v * 2.5, (1 - v) * 2.5);
        ids[j].push(b.vertex(p, n, p.x * 0.3, p.y * 0.3, 1, THREE.MathUtils.smoothstep(m, 0, 0.35)));
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = ids[j][i], bb = ids[j][i + 1], c = ids[j + 1][i], dd = ids[j + 1][i + 1];
      b.tri(a, bb, dd);
      b.tri(a, dd, c);
    }
  }
}

export function buildArchitecture(mats: PalaceMaterials, tier: PalaceTier): Architecture {
  const group = new THREE.Group();
  group.name = 'palace:architecture';
  const sp = tier === 'high' ? 0.22 : tier === 'medium' ? 0.36 : 3.0;
  const F = FORT;
  const fort = new GeoBuilder();
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, faces = 'px nx pz nz py') =>
    fort.block(V3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), V3(x1 - x0, y1 - y0, z1 - z0), sp, 0.3, { faces, dispEdge: 0.3 });

  // ------------------------------------------------------------------ curtain walls
  box(F.x0 + 7, F.x1 - 7, F.base, F.walk, F.z0, F.z0 + F.wall); // north
  box(F.x0 + 7, F.x1 - 7, F.base, F.walk, F.z1 - F.wall, F.z1); // south
  box(F.x0, F.x0 + F.wall, F.base, F.walk, F.z0 + 7, F.z1 - 7); // west
  box(F.x1 - F.wall, F.x1, F.base, F.walk, F.z0 + 7, GATE.z0 - GATE.towerW); // east, north of the gate
  box(F.x1 - F.wall, F.x1, F.base, F.walk, GATE.z1 + GATE.towerW, F.z1 - 7); // east, south of the gate
  // parapets on the outer edge
  const pt = 0.7;
  parapet(fort, F.x0 + 7, F.x1 - 7, F.z0, F.z0 + pt, F.walk, F.top, sp, true);
  parapet(fort, F.x0 + 7, F.x1 - 7, F.z1 - pt, F.z1, F.walk, F.top, sp, true);
  parapet(fort, F.x0, F.x0 + pt, F.z0 + 7, F.z1 - 7, F.walk, F.top, sp, false);
  parapet(fort, F.x1 - pt, F.x1, F.z0 + 7, GATE.z0 - GATE.towerW, F.walk, F.top, sp, false);
  parapet(fort, F.x1 - pt, F.x1, GATE.z1 + GATE.towerW, F.z1 - 7, F.walk, F.top, sp, false);
  // ------------------------------------------------------------------ corner towers (protrude 3 m)
  const towers: [number, number][] = [[F.x0 - 3, F.z0 - 3], [F.x1 - 7, F.z0 - 3], [F.x0 - 3, F.z1 - 7], [F.x1 - 7, F.z1 - 7]];
  for (const [tx, tz] of towers) {
    box(tx, tx + F.tower, F.base, F.towerWalk, tz, tz + F.tower);
    parapet(fort, tx, tx + F.tower, tz, tz + pt, F.towerWalk, F.towerTop, sp, true);
    parapet(fort, tx, tx + F.tower, tz + F.tower - pt, tz + F.tower, F.towerWalk, F.towerTop, sp, true);
    parapet(fort, tx, tx + pt, tz + pt, tz + F.tower - pt, F.towerWalk, F.towerTop, sp, false);
    parapet(fort, tx + F.tower - pt, tx + F.tower, tz + pt, tz + F.tower - pt, F.towerWalk, F.towerTop, sp, false);
  }
  // ------------------------------------------------------------------ gate towers + masonry over the passage
  const G = GATE;
  const gw = G.towerTop - 1.2;
  box(G.towerX0, G.towerX1, F.base, gw, G.z0 - G.towerW, G.z0);
  box(G.towerX0, G.towerX1, F.base, gw, G.z1, G.z1 + G.towerW);
  box(G.towerX0, G.towerX1, G.h + 0.36, gw, G.z0, G.z1, 'px nx py ny');
  parapet(fort, G.towerX1 - pt, G.towerX1, G.z0 - G.towerW, G.z1 + G.towerW, gw, G.towerTop, sp, false);
  parapet(fort, G.towerX0, G.towerX1 - pt, G.z0 - G.towerW, G.z0 - G.towerW + pt, gw, G.towerTop, sp, true);
  parapet(fort, G.towerX0, G.towerX1 - pt, G.z1 + G.towerW - pt, G.z1 + G.towerW, gw, G.towerTop, sp, true);
  // battered bases: the lower courses of towers and curtain walls lean outward (sloping stone skirt against sapping)
  const bT = 1.5, bB = -0.9, bD = 0.85, bsp = tier === 'low' ? 3.0 : Math.max(sp, 0.3);
  batter(fort, F.x0 + 7, F.x1 - 7, F.z0, F.z0 + F.wall, bT, bB, bD, 'n', bsp);
  batter(fort, F.x0 + 7, F.x1 - 7, F.z1 - F.wall, F.z1, bT, bB, bD, 's', bsp);
  batter(fort, F.x0, F.x0 + F.wall, F.z0 + 7, F.z1 - 7, bT, bB, bD, 'w', bsp);
  batter(fort, F.x1 - F.wall, F.x1, F.z0 + 7, GATE.z0 - GATE.towerW, bT, bB, bD, 'e', bsp);
  batter(fort, F.x1 - F.wall, F.x1, GATE.z1 + GATE.towerW, F.z1 - 7, bT, bB, bD, 'e', bsp);
  for (const [tx, tz] of towers) batter(fort, tx, tx + F.tower, tz, tz + F.tower, bT + 0.4, bB, bD + 0.25, 'nswe', bsp);
  batter(fort, G.towerX0, G.towerX1, G.z0 - G.towerW, G.z0, bT + 0.3, bB, bD + 0.15, 'ne', bsp);
  batter(fort, G.towerX0, G.towerX1, G.z1, G.z1 + G.towerW, bT + 0.3, bB, bD + 0.15, 'se', bsp);
  const fortGeo = fort.build({ ao: false, disp: true });
  const fortMesh = mesh(fortGeo, tier === 'low' ? mats.masonryFlat : mats.masonry, true, true, 'palace:fortress');
  group.add(fortMesh);

  // gate lintel beams + open door leaves (timber, bronze-nailed look comes from the wood texture)
  const timber = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const g = hewnBeam(G.z1 - G.z0 + 1.2, 0.34, 0.3, 700 + i);
    const m = mesh(g, mats.beamExt, true, true);
    m.rotation.y = -Math.PI / 2;
    m.position.set(G.towerX0 + 0.35 + i * ((G.towerX1 - G.towerX0 - 0.7) / 4), G.h + 0.17, G.z0 - 0.6);
    timber.add(m);
  }
  const leafW = (G.z1 - G.z0) / 2;
  for (const side of [0, 1]) {
    const lb = new GeoBuilder();
    // planks
    for (let k = 0; k < 5; k++) {
      const pw = leafW / 5;
      lb.block(V3(0.06, G.h / 2 - 0.1, -leafW / 2 + pw * (k + 0.5)), V3(0.12 + (k % 2) * 0.015, G.h - 0.25, pw - 0.012), 5, 1);
    }
    // cross battens
    for (const y of [0.5, 2.0, 3.4]) lb.block(V3(-0.04, y, 0), V3(0.08, 0.22, leafW - 0.1), 5, 1);
    const g = lb.build({ ao: false });
    // wood UV: planks run vertically -> use metric UV from positions
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getZ(i) * 1.6 + pos.getX(i) * 1.6, pos.getY(i) * 0.8);
    const m = mesh(g, mats.beamExt, true, true, 'palace:gateLeaf');
    // hinged at the outer end of the passage, swung inward to lie along the passage walls (open by day)
    const hingeZ = side === 0 ? G.z0 + 0.1 : G.z1 - 0.1;
    m.position.set(G.towerX1 - 0.45, 0.02, hingeZ);
    m.rotation.y = side === 0 ? -Math.PI / 2 + 0.1 : Math.PI / 2 - 0.1;
    m.translateZ(side === 0 ? leafW / 2 : -leafW / 2);
    timber.add(m);
  }
  group.add(timber);

  // ------------------------------------------------------------------ the king's hall
  const H = HALL;
  const T = H.wall;
  const y0 = H.y0;
  const hallTop = H.roofTop;
  const room = { x0: H.x0, x1: H.x1, y0, y1: H.ceil, z0: H.z0, z1: H.z1 };
  const pillarAO = (p: THREE.Vector3) => {
    let a = 1;
    for (const px of H.pillarX) for (const pz of H.pillarZ) {
      const d = Math.hypot(p.x - px, p.z - pz) - 0.3;
      a *= 1 - 0.45 * Math.exp(-Math.max(0, d) / 0.35) * Math.exp(-(p.y - y0) / 0.6);
    }
    // under the dais edge
    return a;
  };
  const ao = (p: THREE.Vector3, n: THREE.Vector3) => roomAO(p, n, room, pillarAO);
  const inner = new GeoBuilder();
  const isp = tier === 'low' ? 0.5 : 0.28;
  const jitter = (p: THREE.Vector3) => (Math.sin(p.x * 2.1 + p.y * 1.3) * Math.sin(p.z * 1.7 - p.y * 2.3) + Math.sin(p.x * 5.3 + p.z * 4.1 + p.y * 3.7) * 0.3) * 0.012;
  const hh = H.ceil - y0;
  const win = (c: number): Rect => ({ u0: c - H.winW / 2, u1: c + H.winW / 2, v0: H.winSill, v1: H.winHead });
  // niches (blind): 0.42 x 0.46, 0.34 deep, sill 1.45 m
  const nicheW = 0.44, nicheH = 0.46, nicheD = 0.34, nicheSill = 1.5;
  const nicheRect = (c: number): Rect => ({ u0: c - nicheW / 2, u1: c + nicheW / 2, v0: nicheSill, v1: nicheSill + nicheH });
  const niches: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  // north wall (normal +Z), niches flanking the seat
  const northNiches = [H.cx - 2.35, H.cx + 2.35].map((x) => x - H.x0);
  inner.grid(V3(H.x0, y0, H.z0), V3(1, 0, 0), V3(0, 1, 0), { u0: 0, u1: H.x1 - H.x0, v0: 0, v1: hh }, isp, 1 / 1.8, { holes: northNiches.map(nicheRect), ao, jitter });
  for (const u of northNiches) niches.push({ pos: V3(H.x0 + u, y0 + nicheSill, H.z0 - nicheD / 2), normal: V3(0, 0, 1) });
  // south wall (normal -Z), door
  const doorU = H.x1 - H.cx;
  const doorRect: Rect = { u0: doorU - H.door.w / 2, u1: doorU + H.door.w / 2, v0: 0, v1: H.door.h };
  inner.grid(V3(H.x1, y0, H.z1), V3(-1, 0, 0), V3(0, 1, 0), { u0: 0, u1: H.x1 - H.x0, v0: 0, v1: hh }, isp, 1 / 1.8, { holes: [doorRect], ao, jitter });
  // east wall (normal -X): u along +Z from z0
  const eastNiches = [-5.6, -10.0].map((z) => z - H.z0);
  const eWins = H.windowsE.map((z) => z - H.z0);
  inner.grid(V3(H.x1, y0, H.z0), V3(0, 0, 1), V3(0, 1, 0), { u0: 0, u1: H.z1 - H.z0, v0: 0, v1: hh }, isp, 1 / 1.8, { holes: [...eWins.map(win), ...eastNiches.map(nicheRect)], ao, jitter });
  for (const u of eastNiches) niches.push({ pos: V3(H.x1 + nicheD / 2, y0 + nicheSill, H.z0 + u), normal: V3(-1, 0, 0) });
  // west wall (normal +X): u along -Z from z1
  const westNiches = [-5.6, -10.0].map((z) => H.z1 - z);
  const wWins = H.windowsW.map((z) => H.z1 - z);
  inner.grid(V3(H.x0, y0, H.z1), V3(0, 0, -1), V3(0, 1, 0), { u0: 0, u1: H.z1 - H.z0, v0: 0, v1: hh }, isp, 1 / 1.8, { holes: [...wWins.map(win), ...westNiches.map(nicheRect)], ao, jitter });
  for (const u of westNiches) niches.push({ pos: V3(H.x0 - nicheD / 2, y0 + nicheSill, H.z1 - u), normal: V3(1, 0, 0) });
  // reveals of windows / door (through the wall) and niches (blind)
  const reveal = (o: THREE.Vector3, U: THREE.Vector3, V: THREE.Vector3, N: THREE.Vector3, r: Rect, depth: number, blind: boolean) => {
    // o: wall-face origin, U along wall, V up, N into the wall (away from the room)
    const c00 = o.clone().addScaledVector(U, r.u0).addScaledVector(V, r.v0);
    const w = r.u1 - r.u0, h = r.v1 - r.v0;
    const s = 0.12;
    // bottom (sill), facing up
    inner.grid(c00, U, N, { u0: 0, u1: w, v0: 0, v1: depth }, s * 2, 1 / 1.8, { ao });
    // top (head), facing down
    inner.grid(c00.clone().addScaledVector(V, h).addScaledVector(N, depth), U, N.clone().negate(), { u0: 0, u1: w, v0: 0, v1: depth }, s * 2, 1 / 1.8, { ao });
    // left side (at u0), facing +U
    inner.grid(c00, N, V, { u0: 0, u1: depth, v0: 0, v1: h }, s * 2, 1 / 1.8, { ao });
    // right side (at u1), facing -U
    inner.grid(c00.clone().addScaledVector(U, w).addScaledVector(N, depth), N.clone().negate(), V, { u0: 0, u1: depth, v0: 0, v1: h }, s * 2, 1 / 1.8, { ao });
    if (blind) inner.grid(c00.clone().addScaledVector(N, depth), U, V, { u0: 0, u1: w, v0: 0, v1: h }, s * 2, 1 / 1.8, { ao: (p, n) => ao(p, n) * 0.55 });
  };
  const X = V3(1, 0, 0), Y = V3(0, 1, 0), Z = V3(0, 0, 1);
  for (const u of northNiches) reveal(V3(H.x0, y0, H.z0), X, Y, Z.clone().negate(), nicheRect(u), nicheD, true);
  for (const u of eastNiches) reveal(V3(H.x1, y0, H.z0), Z, Y, X, nicheRect(u), nicheD, true);
  for (const u of westNiches) reveal(V3(H.x0, y0, H.z1), Z.clone().negate(), Y, X.clone().negate(), nicheRect(u), nicheD, true);
  for (const u of eWins) reveal(V3(H.x1, y0, H.z0), Z, Y, X, win(u), T, false);
  for (const u of wWins) reveal(V3(H.x0, y0, H.z1), Z.clone().negate(), Y, X.clone().negate(), win(u), T, false);
  reveal(V3(H.x1, y0, H.z1), X.clone().negate(), Y, Z, doorRect, T, false);
  // floor and ceiling (reed + clay between the joists)
  const floorStart = inner.idx.length;
  inner.grid(V3(H.x0, y0, H.z1), X, Z.clone().negate(), { u0: 0, u1: H.x1 - H.x0, v0: 0, v1: H.z1 - H.z0 }, isp, 1 / 2.2, { ao });
  const innerGeo = inner.build({ ao: true });
  // one geometry, two materials: the floor is the last grid -> split by group
  innerGeo.addGroup(0, floorStart, 0);
  innerGeo.addGroup(floorStart, innerGeo.index!.count - floorStart, 1);
  const hallInner = new THREE.Mesh(innerGeo, [mats.plaster, mats.floor]);
  hallInner.castShadow = true;
  hallInner.receiveShadow = true;
  hallInner.name = 'palace:hallInner';
  group.add(hallInner);
  const ceil = new GeoBuilder();
  ceil.grid(V3(H.x0, H.ceil, H.z0), X, Z, { u0: 0, u1: H.x1 - H.x0, v0: 0, v1: H.z1 - H.z0 }, 1.0, 1 / 1.6, {});
  const ceilMesh = mesh(ceil.build({ ao: false }), mats.reed, true, true, 'palace:ceiling');
  group.add(ceilMesh);

  // exterior shell of the hall (masonry with mud-plaster remains), roof slab and parapet
  const ext = new GeoBuilder();
  const ex0 = H.x0 - T, ex1 = H.x1 + T, ez0 = H.z0 - T, ez1 = H.z1 + T;
  const eh = hallTop - y0 + 0.6;
  const extY0 = y0 - 0.6;
  // east face (normal +X): U = -Z from ez1 (origin at z = ez1)
  const eWinsExt = H.windowsE.map((z) => ez1 - z);
  ext.grid(V3(ex1, extY0, ez1), Z.clone().negate(), Y, { u0: 0, u1: ez1 - ez0, v0: 0, v1: eh }, sp, 0.3, { holes: eWinsExt.map((c) => ({ u0: c - H.winW / 2, u1: c + H.winW / 2, v0: H.winSill + 0.6, v1: H.winHead + 0.6 })), dispEdge: 0.3 });
  // west face (normal -X): U = +Z from ez0
  const wWinsExt = H.windowsW.map((z) => z - ez0);
  ext.grid(V3(ex0, extY0, ez0), Z, Y, { u0: 0, u1: ez1 - ez0, v0: 0, v1: eh }, sp, 0.3, { holes: wWinsExt.map((c) => ({ u0: c - H.winW / 2, u1: c + H.winW / 2, v0: H.winSill + 0.6, v1: H.winHead + 0.6 })), dispEdge: 0.3 });
  // south face (normal +Z): U = +X from ex0
  const dU = H.cx - ex0;
  ext.grid(V3(ex0, extY0, ez1), X, Y, { u0: 0, u1: ex1 - ex0, v0: 0, v1: eh }, sp, 0.3, { holes: [{ u0: dU - H.door.w / 2, u1: dU + H.door.w / 2, v0: 0.6, v1: H.door.h + 0.6 }], dispEdge: 0.3 });
  // roof parapet (the "ma'akeh" of Deut 22:8): 0.45 thick, 0.55 high, on the roof edge
  const pz0 = ez0, pz1 = ez1, px0 = ex0, px1 = ex1, py0 = hallTop, py1 = H.parapet;
  ext.block(V3((px0 + px1) / 2, (py0 + py1) / 2, pz1 - 0.225), V3(px1 - px0, py1 - py0, 0.45), sp, 0.3, { faces: 'px nx pz nz py', dispEdge: 0.15 });
  ext.block(V3((px0 + px1) / 2, (py0 + py1) / 2, pz0 + 0.225), V3(px1 - px0, py1 - py0, 0.45), sp, 0.3, { faces: 'px nx pz nz py', dispEdge: 0.15 });
  ext.block(V3(px0 + 0.225, (py0 + py1) / 2, (pz0 + pz1) / 2), V3(0.45, py1 - py0, pz1 - pz0 - 0.9), sp, 0.3, { faces: 'px nx py', dispEdge: 0.15 });
  ext.block(V3(px1 - 0.225, (py0 + py1) / 2, (pz0 + pz1) / 2), V3(0.45, py1 - py0, pz1 - pz0 - 0.9), sp, 0.3, { faces: 'px nx py', dispEdge: 0.15 });
  // wall tops between the interior ceiling and the roof slab are hidden: the roof slab closes the volume
  const extGeo = ext.build({ ao: false, disp: true });
  group.add(mesh(extGeo, mats.hallShell, true, true, 'palace:hallShell'));
  // wall body between inner and outer faces at the top (visible from the aerial shot): the roof slab
  const roofB = new GeoBuilder();
  roofB.block(V3((ex0 + ex1) / 2, (H.ceil + hallTop) / 2, (ez0 + ez1) / 2), V3(ex1 - ex0, hallTop - H.ceil, ez1 - ez0), 2, 0.3, { faces: 'py px nx pz nz' });
  const roofMesh = mesh(roofB.build({ ao: false }), mats.roof, true, true, 'palace:hallRoof');
  group.add(roofMesh);

  // ------------------------------------------------------------------ hall timberwork
  const beams = new THREE.Group();
  beams.name = 'palace:beams';
  // architraves over the pillar rows (N-S), in two lengths with a joint over the middle pillar
  for (const [i, px] of H.pillarX.entries()) {
    const zA = H.z0 - 0.3, zB = H.z1 + 0.3;
    const mid = H.pillarZ[1];
    for (const [a, b, sd] of [[zA, mid + 0.25, 11 + i * 2], [mid - 0.25, zB, 12 + i * 2]] as [number, number, number][]) {
      const g = hewnBeam(b - a, 0.34, 0.36, sd, 0, 0.03);
      const m = mesh(g, mats.beam);
      m.rotation.y = -Math.PI / 2; // +X -> +Z
      m.position.set(px, H.beam + 0.18, a);
      beams.add(m);
    }
  }
  // joists (round poles) across the hall resting on the architraves, 0.55 m apart
  const joistGeo: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) joistGeo.push(pole(H.x1 - H.x0 + 0.6, 0.1, 0.085, 300 + k, tier === 'low' ? 6 : 9, 0.012));
  const nJ = Math.floor((H.z1 - H.z0 - 0.3) / 0.55);
  const jb = new GeoBuilder();
  const mtx = new THREE.Matrix4();
  for (let j = 0; j <= nJ; j++) {
    const z = H.z0 + 0.2 + j * ((H.z1 - H.z0 - 0.4) / nJ);
    mtx.makeRotationY(((j * 37) % 7) * 0.004 - 0.012).setPosition(H.x0 - 0.3, H.ceil - 0.1, z);
    jb.merge(joistGeo[j % 4], mtx);
  }
  beams.add(mesh(jb.build({ ao: false }), mats.beam, true, true, 'palace:joists'));
  // pillar capitals (wooden bolsters under the architraves)
  for (const px of H.pillarX) for (const pz of H.pillarZ) {
    const g = hewnBeam(0.9, 0.3, 0.22, Math.round(px * 10 + pz), 3);
    const m = mesh(g, mats.beam);
    m.rotation.y = -Math.PI / 2;
    m.position.set(px, H.beam - 0.11, pz - 0.45);
    beams.add(m);
  }
  // door lintel (inside and outside faces)
  for (const [zz, sd] of [[H.z1 + 0.18, 91], [H.z1 + T - 0.18, 92]] as [number, number][]) {
    const g = hewnBeam(H.door.w + 0.9, 0.3, 0.28, sd);
    const m = mesh(g, mats.beamExt);
    m.position.set(H.cx - H.door.w / 2 - 0.45, y0 + H.door.h + 0.14, zz);
    beams.add(m);
  }
  // outer doorway: a proud timber lintel over dressed stone jambs and a worn threshold slab with a door-socket stone
  {
    const g = hewnBeam(H.door.w + 1.1, 0.34, 0.3, 93);
    const m = mesh(g, mats.beamExt);
    m.position.set(H.cx - H.door.w / 2 - 0.55, y0 + H.door.h + 0.17, H.z1 + T + 0.08);
    beams.add(m);
    const jb = new GeoBuilder();
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const hk = H.door.h / 3;
        jb.block(V3(H.cx + sgn * (H.door.w / 2 + 0.2), y0 + hk * (k + 0.5), H.z1 + T - 0.1), V3(0.42 + (k % 2) * 0.06, hk - 0.025, 0.32), 0.5, 0.3, { faces: 'px nx pz py ny' });
      }
    }
    jb.block(V3(H.cx, y0 - 0.03, H.z1 + T * 0.5 + 0.1), V3(H.door.w + 0.5, 0.12, T + 0.25), 0.5, 0.3, { faces: 'px nx pz nz py' });
    group.add(mesh(jb.build({ ao: false }), mats.dressed, true, true, 'palace:doorJambs'));
  }
  group.add(beams);

  // ------------------------------------------------------------------ courtyard buildings (storerooms / quarters along the south wall)
  const yard = new GeoBuilder();
  const roofs = new GeoBuilder();
  const dark = new GeoBuilder();
  const rooms = [[-20.5, -9.5], [-8.5, 2.5], [3.5, 15.5]];
  for (const [ra, rb] of rooms) {
    const rz0 = F.z1 - F.wall - 5.2, rz1 = F.z1 - F.wall;
    const rh = 3.3;
    yard.block(V3((ra + rb) / 2, (rh - 0.6) / 2, (rz0 + rz1) / 2), V3(rb - ra, rh + 0.6, rz1 - rz0), sp, 0.3, { faces: 'px nx nz', dispEdge: 0.3 });
    roofs.block(V3((ra + rb) / 2, rh + 0.13, (rz0 + rz1) / 2 - 0.1), V3(rb - ra + 0.3, 0.26, rz1 - rz0 + 0.2), 3, 0.3, { faces: 'py px nx nz' });
    // doorway (dark void behind a timber lintel)
    const dx = (ra + rb) / 2 + 1.5;
    dark.grid(V3(dx + 0.55, 0.0, rz0 - 0.03), V3(-1, 0, 0), V3(0, 1, 0), { u0: 0, u1: 1.1, v0: 0, v1: 2.05 }, 3, 1, {});
    const lg = hewnBeam(1.7, 0.22, 0.2, Math.round(ra));
    const lm = mesh(lg, mats.beamExt);
    lm.position.set(dx - 0.85, 2.15, rz0 - 0.08);
    group.add(lm);
  }
  group.add(mesh(yard.build({ ao: false, disp: true }), tier === 'low' ? mats.masonryFlat : mats.masonry, true, true, 'palace:storerooms'));

  // ------------------------------------------------------------------ village of Gibeah on the slopes below
  const rnd = mulberry32(1020);
  const houses = new GeoBuilder();
  const nHouses = tier === 'high' ? 46 : tier === 'medium' ? 32 : 18;
  const placed: [number, number, number][] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  let tries = 0;
  while (placed.length < nHouses && tries++ < 4000) {
    // mostly on the southern and eastern slopes, clustered along a lane
    const a = (rnd() < 0.7 ? THREE.MathUtils.lerp(-0.35, 1.9, rnd()) : THREE.MathUtils.lerp(1.9, 3.6, rnd())) ;
    const r = THREE.MathUtils.lerp(58, 200, Math.pow(rnd(), 0.9));
    const x = SUMMIT.x + Math.cos(a) * r, z = SUMMIT.z + Math.sin(a) * r / 0.82;
    if (Math.hypot(x - TAMARISK.x, z - TAMARISK.z) < 26) continue;
    const w = 6 + rnd() * 4.5, d = 7 + rnd() * 4, rad = Math.hypot(w, d) * 0.5 + 3.5;
    if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + rad)) continue;
    // not too steep
    const hs = [gibeahHeight(x - w / 2, z - d / 2), gibeahHeight(x + w / 2, z - d / 2), gibeahHeight(x - w / 2, z + d / 2), gibeahHeight(x + w / 2, z + d / 2)];
    const lo = Math.min(...hs), hi = Math.max(...hs);
    if (hi - lo > 4.5) continue;
    placed.push([x, z, rad]);
    const hgt = 2.7 + rnd() * 0.8 + (rnd() < 0.2 ? 2.2 : 0);
    const yaw = -a + Math.PI / 2 + (rnd() - 0.5) * 0.5;
    const hb = new GeoBuilder();
    const base = lo - 0.8;
    const top = hi + hgt;
    hb.block(V3(0, (base + top) / 2, 0), V3(w, top - base, d), 20, 0.3, { faces: 'px nx pz nz' });
    // courtyard wall on the downhill side
    const cy0 = base, cy1 = hi + 1.3;
    hb.block(V3(0, (cy0 + cy1) / 2, d / 2 + 4.6), V3(w, cy1 - cy0, 0.5), 20, 0.3, { faces: 'px nx pz nz py' });
    hb.block(V3(-w / 2 + 0.25, (cy0 + cy1) / 2, d / 2 + 2.3), V3(0.5, cy1 - cy0, 4.6), 20, 0.3, { faces: 'px nx pz nz py' });
    hb.block(V3(w / 2 - 0.25, (cy0 + cy1) / 2, d / 2 + 1.2), V3(0.5, cy1 - cy0, 2.4), 20, 0.3, { faces: 'px nx pz nz py' });
    q.setFromAxisAngle(V3(0, 1, 0), yaw);
    m4.compose(V3(x, 0, z), q, sc);
    houses.merge(hb.build({ ao: false }), m4);
    const rb = new GeoBuilder();
    rb.block(V3(0, top + 0.12, 0), V3(w + 0.25, 0.24, d + 0.25), 20, 0.3, { faces: 'px nx pz nz py' });
    roofs.merge(rb.build({ ao: false }), m4);
    // roof parapet (Deut 22:8) and, on some houses, an upper room (aliyah) on the roof
    const pb = new GeoBuilder();
    const pt2 = 0.3, ph2 = 0.45;
    pb.block(V3(0, top + 0.24 + ph2 / 2, -d / 2 + pt2 / 2), V3(w, ph2, pt2), 20, 0.3, { faces: 'px nx pz nz py' });
    pb.block(V3(0, top + 0.24 + ph2 / 2, d / 2 - pt2 / 2), V3(w, ph2, pt2), 20, 0.3, { faces: 'px nx pz nz py' });
    pb.block(V3(-w / 2 + pt2 / 2, top + 0.24 + ph2 / 2, 0), V3(pt2, ph2, d - 2 * pt2), 20, 0.3, { faces: 'px nx py' });
    pb.block(V3(w / 2 - pt2 / 2, top + 0.24 + ph2 / 2, 0), V3(pt2, ph2, d - 2 * pt2), 20, 0.3, { faces: 'px nx py' });
    if (rnd() < 0.35) {
      const uw = Math.min(3.6, w * 0.45), ud = Math.min(3.4, d * 0.45), uh = 2.3;
      const ux = (rnd() - 0.5) * (w - uw - 0.8), uz = -d / 2 + ud / 2 + 0.3;
      pb.block(V3(ux, top + 0.24 + uh / 2, uz), V3(uw, uh, ud), 20, 0.3, { faces: 'px nx pz nz' });
      const ur = new GeoBuilder();
      ur.block(V3(ux, top + 0.24 + uh + 0.1, uz), V3(uw + 0.2, 0.2, ud + 0.2), 20, 0.3, { faces: 'px nx pz nz py' });
      roofs.merge(ur.build({ ao: false }), m4);
      const ud2 = new GeoBuilder();
      ud2.grid(V3(ux - 0.4, top + 0.26, uz + ud / 2 + 0.02), V3(1, 0, 0), V3(0, 1, 0), { u0: 0, u1: 0.8, v0: 0, v1: 1.6 }, 3, 1, {});
      dark.merge(ud2.build({ ao: false }), m4);
    }
    houses.merge(pb.build({ ao: false }), m4);
    // small window slits
    const wb = new GeoBuilder();
    for (const sx2 of [-w / 4, w / 4]) wb.grid(V3(sx2 - 0.15, top - 1.2, d / 2 + 0.02), V3(1, 0, 0), V3(0, 1, 0), { u0: 0, u1: 0.3, v0: 0, v1: 0.45 }, 3, 1, {});
    dark.merge(wb.build({ ao: false }), m4);
    // doorway into the courtyard house
    const db = new GeoBuilder();
    db.grid(V3(-0.5, hi - 0.05, d / 2 + 0.02), V3(1, 0, 0), V3(0, 1, 0), { u0: 0, u1: 1.0, v0: 0, v1: 1.9 }, 3, 1, {});
    dark.merge(db.build({ ao: false }), m4);
  }
  // neighbouring villages of Benjamin on the surrounding hilltops (Ramah to the north, Geba to the north-east,
  // Anathoth to the south-east, a hamlet to the west): clusters of flat-roofed courtyard houses seen from afar
  const nFar = tier === 'high' ? 30 : tier === 'medium' ? 20 : 10;
  for (const [vx, vz, vs] of [[250, -2300, 11], [2300, -2150, 12], [1900, 950, 13], [-1850, -650, 14]] as [number, number, number][]) {
    // settle on the local summit
    let bx = vx, bz = vz, bh = gibeahHeight(vx, vz);
    for (let k = 0; k < 40; k++) {
      const x = vx + (rnd() - 0.5) * 600, z = vz + (rnd() - 0.5) * 600;
      const hh = gibeahHeight(x, z);
      if (hh > bh) { bh = hh; bx = x; bz = z; }
    }
    const vr = mulberry32(vs);
    for (let i = 0; i < nFar; i++) {
      const a = vr() * Math.PI * 2, r = Math.sqrt(vr()) * 85;
      const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
      const w = 7 + vr() * 5, d = 7 + vr() * 5;
      const lo = Math.min(gibeahHeight(x - w / 2, z - d / 2), gibeahHeight(x + w / 2, z + d / 2), gibeahHeight(x - w / 2, z + d / 2), gibeahHeight(x + w / 2, z - d / 2));
      const top = lo + 3.2 + vr() * 1.8 + (vr() < 0.15 ? 2.5 : 0);
      const hb = new GeoBuilder();
      hb.block(V3(0, (lo - 2 + top) / 2, 0), V3(w, top - lo + 2, d), 40, 0.3, { faces: 'px nx pz nz' });
      q.setFromAxisAngle(V3(0, 1, 0), vr() * 0.6 - 0.3 + (vs % 2) * 0.4);
      m4.compose(V3(x, 0, z), q, sc);
      houses.merge(hb.build({ ao: false }), m4);
      const rb = new GeoBuilder();
      rb.block(V3(0, top + 0.12, 0), V3(w + 0.3, 0.24, d + 0.3), 40, 0.3, { faces: 'px nx pz nz py' });
      roofs.merge(rb.build({ ao: false }), m4);
    }
  }
  group.add(mesh(houses.build({ ao: false }), mats.houses, true, true, 'palace:village'));
  group.add(mesh(roofs.build({ ao: false }), mats.roof, true, true, 'palace:roofs'));
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0a08, roughness: 1, metalness: 0 });
  group.add(mesh(dark.build({ ao: false }), darkMat, false, false, 'palace:doorways'));

  const doorCenter = V3(H.cx, y0 + H.door.h * 0.5, H.z1 + T * 0.5);
  const windows: WindowOpening[] = [
    ...H.windowsE.map((z) => ({ center: V3(H.x1, y0 + (H.winSill + H.winHead) / 2, z), w: H.winW, h: H.winHead - H.winSill, inward: V3(-1, 0, 0), along: V3(0, 0, 1) })),
    ...H.windowsW.map((z) => ({ center: V3(H.x0, y0 + (H.winSill + H.winHead) / 2, z), w: H.winW, h: H.winHead - H.winSill, inward: V3(1, 0, 0), along: V3(0, 0, -1) })),
  ];
  return { group, windows, niches, doorCenter, hallMeshes: [hallInner, ceilMesh], stats: { houses: placed.length }, houseSpots: placed };
}
