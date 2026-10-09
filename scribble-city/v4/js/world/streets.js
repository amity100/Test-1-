import * as THREE from 'three';
import { makeSurface, srgb, hex, addLight } from '../render/materials.js';
import { nextId, quadGeo, seeded } from './kit.js';
import { AVES, STREETS, STREET_X0, STREET_X1, WALK_X0, PROM_X1, WEST_EDGE, CURB, PIER, blockRect, westRect } from './layout.js';
import { NODES, stopDist, parkingSpots } from './roads.js';
import { palm } from './palms.js';
import { bench } from './blocks.js';
import { boardAtlas } from './boards.js';
import { randomCarSpec } from '../render/cars.js';
import { Batch } from './kit.js';

// The furniture of the streets, in the first boulevard's own pens: palms and lamps down every
// avenue, traffic lights at the crossings with the names of the streets, bus stops, phone booths
// (a good place to hide), hydrants, trash cans, newspaper boxes; the cars parked along the curbs;
// the billboards with the blueprints you photograph; DRAW YOURSELF A FRIEND on the promenade;
// the pier with its big wheel.

const POLE = srgb(0.16, 0.14, 0.22);
const STEEL = srgb(0.62, 0.62, 0.68);
const HOUSING = srgb(0.98, 0.8, 0.2);
const WARM = srgb(1, 0.8, 0.55);

// ------------------------------------------------------------------ little helpers
function put(ctx, mat, geo, x, y, z, yaw, color) {
  if (yaw) geo.rotateY(yaw);
  geo.translate(x, y, z);
  ctx.B.add(mat, geo, null, nextId(), color ? { color } : {});
}

function free(ctx, x, z, r) {
  return !ctx.col.pointInside(x, 1.0, z, r);
}

// a quad facing (nx, nz) centred at (x, y, z), w wide and h tall, showing an atlas cell
function faceQuad(ctx, mat, x, y, z, nx, nz, w, h, uv) {
  const rx = nz;
  const rz = -nx;
  const hw = w / 2;
  const hh = h / 2;
  const a = [x - rx * hw, y - hh, z - rz * hw];
  const b = [x + rx * hw, y - hh, z + rz * hw];
  const c = [x + rx * hw, y + hh, z + rz * hw];
  const d = [x - rx * hw, y + hh, z - rz * hw];
  ctx.B.add(mat, quadGeo(a, b, c, d, [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]]), null, nextId());
}

// a lamp like the promenade's: a dark pole, an arm over the road (ax, az), a glowing head
export function streetLamp(ctx, x, z, ax, az, o = {}) {
  const M = ctx.M;
  const y0 = o.y0 !== undefined ? o.y0 : CURB;
  const id = ctx.objects.begin(ctx, 'lamp', x, z);
  const g = new THREE.CylinderGeometry(0.09, 0.13, 6.5, 8);
  g.translate(x, y0 + 3.25, z);
  ctx.B.add(M.pole, g, null, nextId(), { color: POLE });
  const arm = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6).rotateZ(Math.PI / 2).rotateY(Math.atan2(-az, ax));
  arm.translate(x + ax * 0.75, y0 + 6.25, z + az * 0.75);
  ctx.B.add(M.pole, arm, null, nextId(), { color: POLE });
  const head = new THREE.CylinderGeometry(0.28, 0.12, 0.45, 8);
  head.translate(x + ax * 1.5, y0 + 6.15, z + az * 1.5);
  ctx.B.add(M.lampGlass, head, null, nextId());
  ctx.col.addCircle(x, z, 0.25, 0, 6.5, 'pole');
  if (ctx.lamps) ctx.lamps.push({ x, z, hx: x + ax * 1.5, hz: z + az * 1.5 });
  if (o.light) addLight(x + ax * 1.5, y0 + 5.4, z + az * 1.5, 9, WARM, 0.85);
  ctx.objects.end(ctx, id);
}

// ------------------------------------------------------------------ the crossings
// a traffic light for the cars coming along (dx, dz) into n: a pole on the corner to their right,
// an arm over their lanes with a head on it, and a second head low on the pole
function signalPole(ctx, n, dx, dz, blades) {
  const M = ctx.M;
  const alongZ = dz !== 0;
  const half = alongZ ? n.ave.half : n.street.half;
  const rx = -dz;
  const rz = dx;
  const back = stopDist(n, alongZ) - 0.7;
  let px = n.x - dx * back + rx * (half + 0.62);
  let pz = n.z - dz * back + rz * (half + 0.62);
  for (const s of [0, 1.0, -1.0, 2.0, -2.0]) {
    if (free(ctx, px - dx * s, pz - dz * s, 0.3)) {
      px -= dx * s;
      pz -= dz * s;
      break;
    }
  }
  const id = ctx.objects.begin(ctx, 'light', px, pz);
  const H = 5.7;
  const pole = new THREE.CylinderGeometry(0.1, 0.13, H, 8);
  put(ctx, M.pole, pole, px, CURB + H / 2, pz, 0, POLE);
  const L = Math.min(5.8, half * 0.78);
  const arm = new THREE.CylinderGeometry(0.06, 0.06, L, 6).rotateZ(Math.PI / 2).rotateY(Math.atan2(rz, -rx));
  put(ctx, M.pole, arm, px - (rx * L) / 2, CURB + H - 0.25, pz - (rz * L) / 2, 0, POLE);
  const face = Math.atan2(-dx, -dz);
  const heads = [
    [px - rx * (L - 0.25), CURB + H - 1.05, pz - rz * (L - 0.25)],
    // (the low one on the pole's near side, facing the cars: not out over the road)
    [px - dx * 0.3, CURB + 2.9, pz - dz * 0.3],
  ];
  const lamps = [];
  for (const [hx, hy, hz] of heads) lamps.push(signalHead(ctx, hx, hy, hz, face));
  ctx.col.addCircle(px, pz, 0.2, 0, H, 'pole');
  if (blades) nameBlades(ctx, n, px, CURB + 4.2, pz);
  ctx.objects.end(ctx, id);
  ctx.signals.push({ node: n.id, axis: alongZ ? 'ns' : 'ew', lamps, x: px, z: pz, obj: id });
}

const _m4 = new THREE.Matrix4();
function signalHead(ctx, x, y, z, yaw) {
  const M = ctx.M;
  put(ctx, M.prop, new THREE.BoxGeometry(0.44, 1.2, 0.34), x, y, z, yaw, HOUSING);
  put(ctx, M.prop, new THREE.BoxGeometry(0.62, 1.38, 0.03), x - Math.sin(yaw) * 0.18, y, z - Math.cos(yaw) * 0.18, yaw, srgb(0.1, 0.1, 0.12));
  const dark = [srgb(0.3, 0.05, 0.06), srgb(0.32, 0.25, 0.05), srgb(0.05, 0.25, 0.1)];
  const out = [];
  [0.37, 0, -0.37].forEach((dy, k) => {
    const lx = x + Math.sin(yaw) * 0.18;
    const lz = z + Math.cos(yaw) * 0.18;
    const lens = new THREE.CylinderGeometry(0.125, 0.125, 0.05, 12).rotateX(Math.PI / 2);
    put(ctx, M.prop, lens, lx, y + dy, lz, yaw, dark[k]);
    // a little visor over the lens
    const visor = new THREE.BoxGeometry(0.3, 0.03, 0.16);
    put(ctx, M.prop, visor, x + Math.sin(yaw) * 0.26, y + dy + 0.15, z + Math.cos(yaw) * 0.26, yaw, HOUSING);
    out.push(new THREE.Matrix4().makeRotationY(yaw).setPosition(x + Math.sin(yaw) * 0.205, y + dy, z + Math.cos(yaw) * 0.205));
  });
  void _m4;
  return out;
}

// the names of the two roads, on blades at the top of a pole
function nameBlades(ctx, n, x, y, z) {
  const A = ctx.atlas.rects;
  const M = ctx.M;
  const ave = A[`ave_${n.ave.sign}`];
  const st = A[`st_${n.street.sign}`];
  // the avenue's name runs along the avenue, the street's along the street
  const tx = Math.sign(n.x - x) || 1;
  const tz = Math.sign(n.z - z) || 1;
  const bw = 1.55;
  const bh = 0.38;
  // along the avenue (z): faces east and west
  const az = z + tz * (bw / 2 + 0.1);
  put(ctx, M.prop, new THREE.BoxGeometry(0.03, bh, bw), x, y, az, 0, srgb(0.12, 0.48, 0.3));
  faceQuad(ctx, M.board, x + 0.02, y, az, 1, 0, bw, bh, ave);
  faceQuad(ctx, M.board, x - 0.02, y, az, -1, 0, bw, bh, ave);
  // along the street (x): faces north and south
  const sx = x + tx * (bw / 2 + 0.1);
  put(ctx, M.prop, new THREE.BoxGeometry(bw, bh, 0.03), sx, y + 0.42, z, 0, srgb(0.12, 0.48, 0.3));
  faceQuad(ctx, M.board, sx, y + 0.42, z + 0.02, 0, 1, bw, bh, st);
  faceQuad(ctx, M.board, sx, y + 0.42, z - 0.02, 0, -1, bw, bh, st);
}

function crossings(ctx) {
  const M = ctx.M;
  for (const n of NODES) {
    if (n.signal) {
      let first = true;
      for (const m of n.nb) {
        signalPole(ctx, n, Math.sign(n.x - m.x), Math.sign(n.z - m.z), first);
        first = false;
      }
    } else {
      // a corner: just a pole with the names, on the inside of the bend
      let ex = 0;
      let ez = 0;
      for (const m of n.nb) {
        ex += Math.sign(m.x - n.x);
        ez += Math.sign(m.z - n.z);
      }
      const x = n.x + Math.sign(ex) * (n.ave.half + 0.9);
      const z = n.z + Math.sign(ez) * (n.street.half + 0.9);
      const id = ctx.objects.begin(ctx, 'signPole', x, z);
      put(ctx, M.pole, new THREE.CylinderGeometry(0.06, 0.07, 4.9, 6), x, CURB + 2.45, z, 0, POLE);
      nameBlades(ctx, n, x, CURB + 4.2, z);
      ctx.col.addCircle(x, z, 0.12, 0, 4.9, 'pole');
      ctx.objects.end(ctx, id);
    }
  }
}

// ------------------------------------------------------------------ street furniture
function hydrant(ctx, x, z) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'hydrant', x, z);
  const red = srgb(0.86, 0.16, 0.18);
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.17, 0.2, 0.62, 10), x, CURB + 0.31, z, 0, red);
  put(ctx, M.propCyl, new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), x, CURB + 0.62, z, 0, red);
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8).rotateZ(Math.PI / 2), x, CURB + 0.42, z, 0, srgb(0.95, 0.85, 0.3));
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.24, 0.24, 0.06, 10), x, CURB + 0.06, z, 0, red);
  ctx.col.addCircle(x, z, 0.24, 0, 0.8, 'prop');
  ctx.objects.end(ctx, id);
}

function trashCan(ctx, x, z) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'trash', x, z);
  const col = ctx.rng.pick([srgb(0.18, 0.62, 0.6), srgb(0.3, 0.42, 0.7), srgb(0.95, 0.55, 0.3)]);
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.3, 0.26, 0.92, 12), x, CURB + 0.46, z, 0, col);
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.33, 0.33, 0.07, 12), x, CURB + 0.95, z, 0, srgb(0.2, 0.2, 0.24));
  ctx.col.addCircle(x, z, 0.32, 0, 1.0, 'prop');
  ctx.objects.end(ctx, id);
}

function newsBox(ctx, x, z, yaw) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'news', x, z);
  const col = ctx.rng.pick([srgb(0.2, 0.36, 0.78), srgb(0.95, 0.75, 0.2), srgb(0.86, 0.2, 0.25)]);
  put(ctx, M.prop, new THREE.BoxGeometry(0.52, 0.95, 0.46), x, CURB + 0.475, z, yaw, col);
  put(ctx, M.prop, new THREE.BoxGeometry(0.4, 0.3, 0.02), x + Math.sin(yaw) * 0.24, CURB + 0.72, z + Math.cos(yaw) * 0.24, yaw, srgb(0.95, 0.94, 0.9));
  ctx.col.addCircle(x, z, 0.3, 0, 1.0, 'prop');
  ctx.objects.end(ctx, id);
}

function mailbox(ctx, x, z, yaw) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'mailbox', x, z);
  const blue = srgb(0.16, 0.3, 0.68);
  put(ctx, M.prop, new THREE.BoxGeometry(0.5, 0.85, 0.5), x, CURB + 0.6, z, yaw, blue);
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.25, 0.25, 0.5, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), x, CURB + 1.02, z, yaw, blue);
  for (const s of [-1, 1]) put(ctx, M.prop, new THREE.BoxGeometry(0.06, 0.2, 0.06), x + s * 0.2, CURB + 0.1, z, yaw, srgb(0.15, 0.15, 0.18));
  ctx.col.addCircle(x, z, 0.3, 0, 1.2, 'prop');
  ctx.objects.end(ctx, id);
}

// a phone booth: a good place to hide while you draw
function phoneBooth(ctx, x, z, yaw) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'booth', x, z);
  const frame = srgb(0.16, 0.62, 0.66);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const local = (u, w) => [x + fz * u + fx * w, z - fx * u + fz * w];
  // the four posts, the roof, the glass on three sides, the phone inside
  for (const [u, w] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const [px, pz] = local(u, w);
    put(ctx, M.prop, new THREE.BoxGeometry(0.08, 2.3, 0.08), px, CURB + 1.15, pz, yaw, frame);
  }
  put(ctx, M.prop, new THREE.BoxGeometry(1.12, 0.22, 1.12), x, CURB + 2.4, z, yaw, frame);
  put(ctx, M.prop, new THREE.BoxGeometry(1.0, 0.08, 1.0), x, CURB + 0.04, z, yaw, srgb(0.2, 0.2, 0.24));
  for (const [u, w, ry] of [[0, -0.5, 0], [-0.5, 0, Math.PI / 2], [0.5, 0, Math.PI / 2]]) {
    const [px, pz] = local(u, w);
    const g = new THREE.BoxGeometry(0.92, 1.7, 0.02);
    g.rotateY(ry);
    put(ctx, M.winGlass, g, px, CURB + 1.25, pz, yaw);
  }
  const [bx, bz] = local(0, -0.42);
  put(ctx, M.prop, new THREE.BoxGeometry(0.3, 0.45, 0.12), bx, CURB + 1.35, bz, yaw, srgb(0.25, 0.25, 0.3));
  const A = ctx.atlas.rects.phone;
  for (const s of [1, -1]) {
    const [qx, qz] = local(0, 0.57 * s);
    faceQuad(ctx, ctx.M.board, qx, CURB + 2.4, qz, fx * s, fz * s, 0.95, 0.2, A);
  }
  ctx.col.addBox(x - 0.56, z - 0.56, x + 0.56, z + 0.56, 0, 2.5, 'prop');
  // stand behind it (the side away from the road)
  const [hx, hz] = local(0, -1.15);
  ctx.hideSpots.push({ x: hx, z: hz, r: 1.1, kind: 'booth' });
  ctx.objects.end(ctx, id);
}

// a hedge in a planter box (another place to hide)
function hedge(ctx, x, z, alongZ) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'bush', x, z);
  const lx = alongZ ? 1.0 : 2.6;
  const lz = alongZ ? 2.6 : 1.0;
  put(ctx, M.prop, new THREE.BoxGeometry(lx, 0.5, lz), x, CURB + 0.25, z, 0, srgb(0.95, 0.85, 0.72));
  const r = ctx.rng;
  for (let k = 0; k < 5; k++) {
    const t = (k - 2) / 2.2;
    const g = new THREE.IcosahedronGeometry(0.55 + r() * 0.15, 1);
    g.scale(1, 0.8, 1);
    put(ctx, M.leaf, g, x + (alongZ ? r.range(-0.15, 0.15) : t * 1.1), CURB + 0.85 + r() * 0.15, z + (alongZ ? t * 1.1 : r.range(-0.15, 0.15)), 0, r.pick([srgb(0.32, 0.62, 0.36), srgb(0.4, 0.7, 0.4), srgb(0.28, 0.55, 0.42)]));
  }
  ctx.col.addBox(x - lx / 2, z - lz / 2, x + lx / 2, z + lz / 2, 0, 1.3, 'prop');
  ctx.hideSpots.push({ x, z, r: 1.7, kind: 'bush' });
  ctx.objects.end(ctx, id);
}

// a bus stop: a roof, a glass back, a bench (people wait here), an ad at the end
function busStop(ctx, x, z, yaw) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'busStop', x, z);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const local = (u, w) => [x + fz * u + fx * w, z - fx * u + fz * w];
  const frame = srgb(0.95, 0.95, 0.96);
  for (const u of [-1.8, 1.8]) {
    for (const w of [-0.65, 0.55]) {
      const [px, pz] = local(u, w);
      put(ctx, M.prop, new THREE.BoxGeometry(0.08, 2.5, 0.08), px, CURB + 1.25, pz, yaw, frame);
    }
  }
  const roof = ctx.rng.pick([srgb(0.98, 0.45, 0.55), srgb(0.18, 0.72, 0.72), srgb(1.0, 0.75, 0.25)]);
  put(ctx, M.awning, new THREE.BoxGeometry(3.9, 0.14, 1.6), x, CURB + 2.55, z, yaw, roof);
  const [gx, gz] = local(0, -0.65);
  const back = new THREE.BoxGeometry(3.5, 1.9, 0.02);
  put(ctx, M.winGlass, back, gx, CURB + 1.35, gz, yaw);
  const [bx, bz] = local(0.2, -0.32);
  put(ctx, M.prop, new THREE.BoxGeometry(2.4, 0.08, 0.42), bx, CURB + 0.48, bz, yaw, srgb(0.62, 0.4, 0.28));
  put(ctx, M.prop, new THREE.BoxGeometry(2.4, 0.45, 0.06), local(0.2, -0.55)[0], CURB + 0.78, local(0.2, -0.55)[1], yaw, srgb(0.62, 0.4, 0.28));
  // the ad panel at the end, lit from inside
  const ad = ctx.rng.pick(['ad_cola', 'ad_surf', 'ad_coffee', 'ad_gym', 'ad_phone', 'ad_sale']);
  const [ax, az] = local(-1.8, -0.05);
  put(ctx, M.prop, new THREE.BoxGeometry(0.12, 1.5, 1.1), ax, CURB + 1.3, az, yaw, frame);
  const A = ctx.atlas.rects[ad];
  faceQuad(ctx, M.board, ax - fz * 0.07, CURB + 1.3, az + fx * 0.07, -fz, fx, 1.0, 1.0 * 0.5, A);
  faceQuad(ctx, M.board, ax + fz * 0.07, CURB + 1.3, az - fx * 0.07, fz, -fx, 1.0, 1.0 * 0.5, A);
  // the sign on its pole
  const [sx, sz] = local(2.4, 0.5);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.04, 0.05, 2.9, 6), sx, CURB + 1.45, sz, 0, STEEL);
  faceQuad(ctx, M.board, sx + fx * 0.03, CURB + 2.7, sz + fz * 0.03, fx, fz, 0.9, 0.24, ctx.atlas.rects.bus);
  faceQuad(ctx, M.board, sx - fx * 0.03, CURB + 2.7, sz - fz * 0.03, -fx, -fz, 0.9, 0.24, ctx.atlas.rects.bus);
  const [cx0, cz0] = local(-1.9, -0.7);
  const [cx1, cz1] = local(1.9, -0.6);
  ctx.col.addBox(Math.min(cx0, cx1), Math.min(cz0, cz1), Math.max(cx0, cx1), Math.max(cz0, cz1), 0, 2.6, 'prop');
  // where people wait (sitting on the bench, facing the road)
  for (const u of [-0.6, 0.2, 1.0]) {
    const [px, pz] = local(u, -0.3);
    ctx.seats.push({ x: px, z: pz, yaw, bus: true });
  }
  ctx.busStops.push({ x, z, yaw });
  ctx.objects.end(ctx, id);
}

// ------------------------------------------------------------------ along the avenues
function avenues(ctx) {
  const r = ctx.rng;
  for (const a of AVES) {
    if (a.blvd) continue;
    for (const side of [-1, 1]) {
      const xl = a.x + side * (a.half + 0.95);
      // the road is the other way: furniture faces it
      const yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const ax = -side;
      for (let j = 0; j < STREETS.length - 1; j++) {
        const z0 = STREETS[j].z + 13.5;
        const z1 = STREETS[j + 1].z - 13.5;
        const n = Math.floor((z1 - z0) / 5.5);
        // odd slots: one of these, shuffled
        const misc = ['booth', 'hydrant', 'trash', 'trash', 'news', 'bench', 'hedge', 'mailbox', 'bench', 'trash'];
        if ((j + (side > 0 ? 1 : 0) + Math.round(a.x)) % 2 === 0) misc[0] = 'bus';
        for (let i = misc.length - 1; i > 0; i--) {
          const k = Math.floor(r() * (i + 1));
          [misc[i], misc[k]] = [misc[k], misc[i]];
        }
        let mi = 0;
        for (let k = 0; k <= n; k++) {
          const z = z0 + k * 5.5;
          if (z > z1) break;
          if (k % 4 === 0) {
            // (a palm stands back from the curb and leans away from the road)
            const xp = a.x + side * (a.half + 1.4);
            if (free(ctx, xp, z, 0.6)) palm(ctx, r, xp, z + r.range(-0.6, 0.6), r.range(8.5, 12), { away: [side, 0] });
          } else if (k % 4 === 2) {
            if (free(ctx, xl, z, 0.4)) streetLamp(ctx, xl, z, ax, 0, { light: k % 8 === 2 });
          } else {
            const what = misc[mi++ % misc.length];
            if (!free(ctx, xl, z, 1.4)) continue;
            if (what === 'bus') busStop(ctx, xl - side * 0.15, z, yaw);
            else if (what === 'booth') phoneBooth(ctx, xl + side * 0.2, z, yaw);
            else if (what === 'hydrant') hydrant(ctx, xl - side * 0.35, z);
            else if (what === 'trash') trashCan(ctx, xl, z + r.range(-1, 1));
            else if (what === 'news') newsBox(ctx, xl, z, yaw);
            else if (what === 'bench') bench(ctx, xl + side * 0.15, z, yaw);
            else if (what === 'hedge') hedge(ctx, xl + side * 0.2, z, true);
            else if (what === 'mailbox') mailbox(ctx, xl, z, yaw);
          }
        }
      }
    }
  }
}

// ------------------------------------------------------------------ along the cross streets
function streets(ctx) {
  const r = ctx.rng;
  const spans = [];
  for (let i = 0; i < 3; i++) {
    const a = AVES[i];
    const b = AVES[i + 1];
    spans.push([a.x + a.half + a.walk, b.blvd ? WALK_X0 : b.x - b.half - b.walk]);
  }
  spans.push([WEST_EDGE + 1, AVES[0].x - AVES[0].half - AVES[0].walk]);
  for (const s of STREETS) {
    for (const side of [-1, 1]) {
      const zl = s.z + side * (s.half + 0.95);
      const az = -side;
      const yaw = side > 0 ? Math.PI : 0;
      for (const [x0, x1] of spans) {
        const L = x1 - x0;
        if (L < 30) {
          // the short stretch west of Coral Ave
          if (free(ctx, (x0 + x1) / 2, zl, 0.5)) streetLamp(ctx, (x0 + x1) / 2, zl, 0, az, { light: true });
          continue;
        }
        // two lamps per block, clear of the alley in the middle
        for (const u of side > 0 ? [7.5, L - 7.5] : [10.5, L - 10.5]) {
          const x = x0 + u;
          if (free(ctx, x, zl, 0.5)) streetLamp(ctx, x, zl, 0, az, { light: u < L / 2 });
        }
        const things = ['hydrant', 'trash', 'mailbox', 'news', 'bench'];
        const pickA = things[Math.floor(r() * things.length)];
        const pickB = things[Math.floor(r() * things.length)];
        for (const [u, what] of [[3.2, pickA], [L - 3.2, pickB]]) {
          const x = x0 + u;
          if (!free(ctx, x, zl, 1.0)) continue;
          if (what === 'hydrant') hydrant(ctx, x, zl - side * 0.35);
          else if (what === 'trash') trashCan(ctx, x, zl);
          else if (what === 'mailbox') mailbox(ctx, x, zl, yaw);
          else if (what === 'news') newsBox(ctx, x, zl, yaw);
          else if (side < 0 && (s.z > -300 || r() < 0.5)) bench(ctx, x, zl + side * 0.1, yaw);
        }
      }
    }
  }
}

// ------------------------------------------------------------------ parked cars
function parking(ctx) {
  const r = seeded(77);
  const spots = parkingSpots(r);
  // the Star Motel's lot (row 1, col 0): nose in towards the rooms
  {
    const B = blockRect(0, 1);
    const x0 = B.x0 + 16;
    for (let z = B.z0 + 30 + 1.6; z < B.z1 - 4; z += 3.2) if (r() < 0.55) spots.push({ x: x0 + 14.5, z, yaw: -Math.PI / 2, alongX: true, lot: true });
  }
  for (const sp of spots) {
    // the first boulevard keeps only its own two
    if (sp.first === undefined && sp.x > -3 && sp.z > -112 && sp.z < 32) continue;
    const spec = sp.first === 0 ? { kind: 'sports', color: [1.0, 0.75, 0.25] } : sp.first === 1 ? { kind: 'sports', color: [0.2, 0.22, 0.3] } : randomCarSpec(r);
    const hx = sp.alongX ? 2.3 : 1.0;
    const hz = sp.alongX ? 1.0 : 2.3;
    if (!free(ctx, sp.x, sp.z, 1.0)) continue;
    const box = ctx.col.addBox(sp.x - hx, sp.z - hz, sp.x + hx, sp.z + hz, 0, 1.45, 'car', { parked: true });
    ctx.parked.push({ x: sp.x, z: sp.z, yaw: sp.yaw, spec, box });
  }
}

// ------------------------------------------------------------------ billboards
// a board on two legs (freestanding), facing (nx, nz); cell: the atlas cell it shows
function billboard(ctx, x, z, nx, nz, cell, o = {}) {
  const M = ctx.M;
  const w = o.w || 8;
  const h = o.h || w / 2;
  const legH = o.legH !== undefined ? o.legH : 3.4;
  const y0 = o.y0 !== undefined ? o.y0 : CURB;
  const rx = nz;
  const rz = -nx;
  const id = ctx.objects.begin(ctx, 'billboard', x, z);
  for (const s of [-0.32, 0.32]) {
    const lx = x + rx * w * s - nx * 0.35;
    const lz = z + rz * w * s - nz * 0.35;
    put(ctx, M.pole, new THREE.CylinderGeometry(0.12, 0.15, legH + h * 0.7, 8), lx, y0 + (legH + h * 0.7) / 2, lz, 0, STEEL);
    ctx.col.addCircle(lx, lz, 0.2, y0, y0 + legH + h, 'pole');
  }
  // the frame behind the poster, a catwalk under it, two lamps on arms over it
  const cy = y0 + legH + h / 2;
  const yawF = Math.atan2(nx, nz);
  put(ctx, M.steel, new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.25), x - nx * 0.15, cy, z - nz * 0.15, yawF, srgb(0.95, 0.94, 0.92));
  put(ctx, M.steel, new THREE.BoxGeometry(w, 0.08, 0.9), x + nx * 0.4, y0 + legH - 0.12, z + nz * 0.4, yawF, srgb(0.45, 0.44, 0.5));
  for (const s of [-0.3, 0.3]) {
    const lx = x + rx * w * s + nx * 0.9;
    const lz = z + rz * w * s + nz * 0.9;
    put(ctx, M.lampGlass, new THREE.BoxGeometry(0.4, 0.14, 0.24), lx, y0 + legH + h + 0.35, lz, yawF);
  }
  faceQuad(ctx, M.board, x + nx * 0.02, cy, z + nz * 0.02, nx, nz, w, h, ctx.atlas.rects[cell]);
  // the board stops bullets and hides what is behind it
  if (Math.abs(rx) < 0.02 || Math.abs(rz) < 0.02) {
    const a = [x - rx * w * 0.5, z - rz * w * 0.5];
    const b = [x + rx * w * 0.5 - nx * 0.3, z + rz * w * 0.5 - nz * 0.3];
    ctx.col.addBox(Math.min(a[0], b[0]) - 0.1, Math.min(a[1], b[1]) - 0.1, Math.max(a[0], b[0]) + 0.1, Math.max(a[1], b[1]) + 0.1, y0 + legH, y0 + legH + h, 'board');
  }
  if (o.light !== false) addLight(x + nx * 2.5, cy, z + nz * 2.5, 10, srgb(1, 0.9, 0.75), 0.7);
  ctx.objects.end(ctx, id);
  if (cell.startsWith('bb_')) ctx.billboards.push({ id: cell.slice(3), x: x + nx * 0.04, y: cy, z: z + nz * 0.04, nx, nz, w, h, rx, rz });
}

// a board on a wall (the end of a building): (x, z) on the wall, facing (nx, nz)
function wallBoard(ctx, x, y, z, nx, nz, cell, o = {}) {
  const M = ctx.M;
  const w = o.w || 8;
  const h = o.h || w / 2;
  const rx = nz;
  const rz = -nx;
  const yawF = Math.atan2(nx, nz);
  const cx = x + nx * 0.3;
  const cz = z + nz * 0.3;
  put(ctx, M.steel, new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.3), x + nx * 0.15, y, z + nz * 0.15, yawF, srgb(0.95, 0.94, 0.92));
  for (const s of [-0.3, 0.3]) put(ctx, M.lampGlass, new THREE.BoxGeometry(0.4, 0.14, 0.24), cx + rx * w * s + nx * 0.7, y + h / 2 + 0.35, cz + rz * w * s + nz * 0.7, yawF);
  faceQuad(ctx, M.board, cx + nx * 0.01, y, cz + nz * 0.01, nx, nz, w, h, ctx.atlas.rects[cell]);
  if (o.light !== false) addLight(cx + nx * 3, y, cz + nz * 3, 11, srgb(1, 0.9, 0.75), 0.7);
  if (cell.startsWith('bb_')) ctx.billboards.push({ id: cell.slice(3), x: cx + nx * 0.03, y, z: cz + nz * 0.03, nx, nz, w, h, rx, rz });
}

// a free spot for something r wide near (x, z), searching along (sx, sz)
function near(ctx, x, z, sx, sz, r, max = 14) {
  for (let d = 0; d <= max; d += 1) {
    for (const s of d ? [d, -d] : [0]) {
      if (free(ctx, x + sx * s, z + sz * s, r)) return [x + sx * s, z + sz * s];
    }
  }
  return null;
}

function boards(ctx) {
  // the paint gun on the promenade, across the street from where you wake up
  {
    const p = near(ctx, 17.9, -8.5, 0, 1, 1.4, 10);
    if (p) billboard(ctx, p[0], p[1], -1, 0, 'bb_paint', { w: 6, legH: 2.3 });
  }
  // on the ends of the buildings, over the cross streets: (block col, row, which end, row side)
  const ends = [
    [0, 2, 'south', 'west', 'bb_stapler'],
    [1, 3, 'north', 'east', 'bb_glue'],
    [2, 3, 'south', 'west', 'bb_inkbomb'],
    [0, 4, 'north', 'east', 'bb_planes'],
    [2, 0, 'south', 'west', 'bb_katana'],
    [1, 0, 'south', 'east', 'bb_tank', { w: 10, y: 11 }],
    [1, 0, 'north', 'east', 'bb_laser', { w: 10, y: 11 }],
    [2, 1, 'north', 'west', 'ad_cola'],
    [0, 3, 'south', 'east', 'ad_surf'],
    [2, 4, 'north', 'west', 'ad_rent'],
    [1, 2, 'north', 'west', 'ad_sale'],
    [2, 2, 'north', 'west', 'ad_movers'],
    [0, 1, 'north', 'west', 'ad_gym'],
    [1, 4, 'south', 'east', 'ad_coffee'],
    // the machine guns that rub the city out, the parachute, more helicopters and another tank
    [0, 0, 'south', 'east', 'bb_tippex'],
    [1, 3, 'south', 'west', 'bb_erasermg'],
    [0, 2, 'north', 'west', 'bb_paintmg'],
    [2, 0, 'north', 'west', 'bb_parachute'],
    [2, 1, 'south', 'east', 'bb_parachute'],
    [2, 3, 'north', 'east', 'bb_copter'],
    [0, 4, 'south', 'west', 'bb_copter'],
    [2, 4, 'south', 'east', 'bb_tank'],
  ];
  for (const [col, row, end, rowSide, cell, o = {}] of ends) {
    const R = blockRect(col, row);
    // (the towers downtown are deeper than the rest)
    const D = col === 1 && row === 0 ? 18 : 16;
    const x = rowSide === 'west' ? R.x0 + D / 2 : R.x1 - D / 2;
    const z = end === 'north' ? R.z0 : R.z1;
    const nz = end === 'north' ? -1 : 1;
    wallBoard(ctx, x, CURB + (o.y || 6.4), z, 0, nz, cell, { w: o.w || 7.5 });
  }
  // the gangs' alleys: the good stuff where it is dangerous
  {
    const R = blockRect(0, 0);
    const ax = R.x0 + 16 + 6.5;
    const p = near(ctx, ax + 4.6, R.z0 + 30, 0, 1, 1.0);
    if (p) billboard(ctx, p[0], p[1], -1, 0, 'bb_rifle', { w: 6.5, legH: 2.6 });
  }
  {
    const R = blockRect(0, 3);
    const ax = R.x0 + 16 + 6.5;
    let p = near(ctx, ax - 4.6, R.z0 + 34, 0, 1, 1.0);
    if (p) billboard(ctx, p[0], p[1], 1, 0, 'bb_bazooka', { w: 6.5, legH: 2.6 });
    p = near(ctx, ax + 4.6, R.z1 - 26, 0, 1, 1.0);
    if (p) billboard(ctx, p[0], p[1], -1, 0, 'bb_minigun', { w: 6.5, legH: 2.6 });
  }
  // the motel's lot: the car (and the Star Motel's sign over it)
  {
    const R = blockRect(0, 1);
    const p = near(ctx, R.x1 - 3.2, R.z0 + 62, 0, 1, 1.2);
    if (p) billboard(ctx, p[0], p[1], 1, 0, 'bb_car', { w: 8, legH: 3.4 });
  }
  // the plaza: the shield, by the fountain
  {
    const R = blockRect(1, 1);
    const p = near(ctx, R.x1 - 4, R.z1 - 12, 0, -1, 1.2);
    if (p) billboard(ctx, p[0], p[1], 1, 0, 'bb_shield', { w: 7, legH: 2.8 });
  }
  // the park: the big band-aid and the boomerang
  {
    const R = blockRect(1, 2);
    let p = near(ctx, R.x0 + 7, (R.z0 + R.z1) / 2 + 22, 0, 1, 1.2);
    if (p) billboard(ctx, p[0], p[1], -1, 0, 'bb_bandage', { w: 7, legH: 2.8 });
    p = near(ctx, R.x1 - 6, R.z0 + 14, 0, 1, 1.2);
    if (p) billboard(ctx, p[0], p[1], 1, 0, 'bb_boomerang', { w: 7, legH: 2.8 });
  }
  // the market: the shotgun over the north entrance
  {
    const R = blockRect(1, 4);
    const p = near(ctx, (R.x0 + R.x1) / 2 + 9, R.z0 + 1.5, 1, 0, 1.0, 6);
    if (p) billboard(ctx, p[0], p[1], 0, -1, 'bb_shotgun', { w: 7, legH: 3.0 });
  }
  // the bike down by the beach
  {
    const p = near(ctx, 18.4, 218, 0, -1, 1.4, 12);
    if (p) billboard(ctx, p[0], p[1], -1, 0, 'bb_bike', { w: 7, legH: 2.6 });
  }
  // ads along the promenade
  for (const [z, cell] of [[-120, 'ad_surf'], [-300, 'ad_cola'], [110, 'ad_coffee'], [190, 'ad_gym']]) {
    const p = near(ctx, 18.6, z, 0, 1, 1.4, 12);
    if (p) billboard(ctx, p[0], p[1], -1, 0, cell, { w: 7, legH: 2.8, light: false });
  }
}

// ------------------------------------------------------------------ DRAW YOURSELF A FRIEND
const PINK = srgb(0.98, 0.7, 0.8);
const CREAM = srgb(0.98, 0.94, 0.86);
const WOOD = srgb(0.72, 0.52, 0.36);
const RAINBOW = [srgb(0.92, 0.3, 0.32), srgb(0.98, 0.62, 0.22), srgb(0.98, 0.86, 0.3), srgb(0.42, 0.75, 0.4), srgb(0.35, 0.58, 0.92), srgb(0.62, 0.42, 0.85)];

// (x, z): the middle of the booth's front; (nx, nz): the way it faces
function friendStand(ctx, x, z, nx, nz) {
  const M = ctx.M;
  const rx = nz;
  const rz = -nx;
  const BW = 3.4;
  const ox = x - (rx * BW) / 2;
  const oz = z - (rz * BW) / 2;
  const P = (u, v, w) => [ox + rx * u + nx * w, v, oz + rz * u + nz * w];
  const yawF = Math.atan2(nx, nz);
  const y0 = CURB;
  const id = ctx.objects.begin(ctx, 'stand', x, z);
  const box = (u0, ya, w0, u1, yb, w1, color, mat = M.prop, collide = false) => {
    const a = P(u0, ya, w0);
    const b = P(u1, yb, w1);
    const g = new THREE.BoxGeometry(Math.abs(b[0] - a[0]) || 0.01, Math.abs(yb - ya), Math.abs(b[2] - a[2]) || 0.01);
    g.translate((a[0] + b[0]) / 2, (ya + yb) / 2, (a[2] + b[2]) / 2);
    ctx.B.add(mat, g, null, nextId(), { color });
    if (collide) ctx.col.addBox(Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2]), ya, yb, 'prop');
  };
  box(0, y0, -1.6, BW, y0 + 0.08, 0, WOOD);
  box(0, y0, -1.6, BW, y0 + 2.5, -1.45, PINK, M.prop, true);
  box(0, y0, -1.6, 0.1, y0 + 2.5, 0.05, CREAM, M.prop, true);
  box(BW - 0.1, y0, -1.6, BW, y0 + 2.5, 0.05, CREAM, M.prop, true);
  box(0.1, y0, -0.45, BW - 0.1, y0 + 1.02, 0, CREAM, M.prop, true);
  box(0.04, y0 + 1.02, -0.5, BW - 0.04, y0 + 1.08, 0.08, WOOD);
  // hearts along the counter
  for (let i = 0; i < 6; i++) {
    const u = 0.4 + i * ((BW - 0.8) / 5);
    const c = P(u, y0 + 0.62, 0.012);
    const g = new THREE.CircleGeometry(0.1, 10);
    g.scale(1, 0.9, 1);
    g.rotateY(yawF);
    g.translate(c[0] + nx * 0.005, c[1], c[2] + nz * 0.005);
    ctx.B.add(M.prop, g, null, nextId(), { color: srgb(0.95, 0.3, 0.45) });
  }
  // the striped roof, sloping out over the counter
  for (let k = 0; k < 9; k++) {
    const u0 = -0.15 + (k * (BW + 0.3)) / 9;
    const u1 = -0.15 + ((k + 1) * (BW + 0.3)) / 9;
    const g = new THREE.BoxGeometry(u1 - u0, 0.08, 2.5);
    g.rotateX(-0.13);
    g.rotateY(yawF);
    const c = P((u0 + u1) / 2, y0 + 2.6, -0.5);
    g.translate(c[0], c[1], c[2]);
    ctx.B.add(M.awning, g, null, nextId(), { color: k % 2 ? CREAM : PINK });
  }
  // fairy lights along the edge
  for (let i = 0; i < 9; i++) {
    const c = P(-0.05 + (i / 8) * (BW + 0.1), y0 + 2.36, 0.72);
    ctx.B.box(M.bulb, c[0] - 0.045, c[1] - 0.045, c[2] - 0.045, c[0] + 0.045, c[1] + 0.045, c[2] + 0.045, nextId(), { color: RAINBOW[i % RAINBOW.length] });
  }
  // the board on the roof
  box(0.15, y0 + 2.7, -1.05, BW - 0.15, y0 + 4.38, -0.93, CREAM);
  const sc = P(BW / 2, y0 + 3.54, -0.92);
  faceQuad(ctx, M.board, sc[0] + nx * 0.01, sc[1], sc[2] + nz * 0.01, nx, nz, 3.0, 1.5, ctx.atlas.rects.friend_stand);
  // two friends somebody drew, pinned to the back wall
  for (const u of [0.85, BW - 0.85]) {
    const p = P(u, y0 + 1.75, -1.44);
    faceQuad(ctx, M.board, p[0], p[1], p[2], nx, nz, 0.75, 0.75, ctx.atlas.rects.friend_sketch);
  }
  // a jar of magic pencils on the counter, every colour
  const jar = P(BW - 0.75, y0, -0.24);
  put(ctx, M.winGlass, new THREE.CylinderGeometry(0.11, 0.11, 0.18, 10), jar[0], y0 + 1.17, jar[2], 0);
  for (let i = 0; i < 6; i++) {
    const a2 = (i / 6) * Math.PI * 2;
    const px = jar[0] + Math.cos(a2) * 0.055;
    const pz = jar[2] + Math.sin(a2) * 0.055;
    const hgt = 0.42 + (i % 3) * 0.05;
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.022, 0.022, hgt, 6), px, y0 + 1.1 + hgt / 2, pz, 0, RAINBOW[i]);
    put(ctx, M.propCyl, new THREE.ConeGeometry(0.022, 0.07, 6), px, y0 + 1.1 + hgt + 0.035, pz, 0, srgb(0.96, 0.84, 0.66));
  }
  // the easel beside the booth, with a friend drawn on it
  const eu = BW + 0.85;
  const ed = -0.55;
  const top = P(eu, y0 + 2.0, ed);
  for (const [du, dd] of [[-0.42, 0.2], [0.42, 0.2], [0, -0.45]]) {
    const f = P(eu + du, y0, ed + dd);
    const dx = top[0] - f[0];
    const dy = top[1] - f[1];
    const dz = top[2] - f[2];
    const len = Math.hypot(dx, dy, dz);
    const g = new THREE.CylinderGeometry(0.025, 0.025, len, 5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len)));
    g.translate((top[0] + f[0]) / 2, (top[1] + f[1]) / 2, (top[2] + f[2]) / 2);
    ctx.B.add(M.prop, g, null, nextId(), { color: srgb(0.42, 0.27, 0.14) });
  }
  box(eu - 0.52, y0 + 0.88, ed + 0.08, eu + 0.52, y0 + 1.94, ed + 0.12, WOOD);
  const ep = P(eu, y0 + 1.41, ed + 0.13);
  faceQuad(ctx, M.board, ep[0], ep[1], ep[2], nx, nz, 0.98, 0.98, ctx.atlas.rects.friend_sketch);
  const emn = P(eu - 0.5, y0, ed - 0.45);
  const emx = P(eu + 0.5, y0 + 2, ed + 0.25);
  ctx.col.addBox(Math.min(emn[0], emx[0]), Math.min(emn[2], emx[2]), Math.max(emn[0], emx[0]), Math.max(emn[2], emx[2]), y0, y0 + 2, 'prop');
  const lp = P(BW / 2, y0 + 2.2, 0.4);
  addLight(lp[0], lp[1], lp[2], 5, srgb(1, 0.62, 0.78), 0.9);
  ctx.objects.end(ctx, id);
  const at = (u, w) => {
    const p = P(u, y0, w);
    return { x: p[0], z: p[2] };
  };
  const shop = {
    kind: 'friends',
    name: 'Draw Yourself a Friend',
    id: ctx.shops.length,
    nx,
    nz,
    rx,
    rz,
    face: yawF,
    door: P(BW / 2, y0, 0.75),
    inside: P(BW / 2, y0, -0.9),
    keeper: P(BW / 2, y0, -0.95),
    win: P(BW / 2, y0, 0.7),
    stand: true,
    open: true,
    spots: {
      counter: at(BW / 2 - 0.3, 0.62),
      queue: at(BW / 2 + 0.9, 1.5),
      draw: [
        { ...at(-0.9, 1.35), yaw: Math.atan2(-rx, -rz) },
        { ...at(BW + 1.9, 1.35), yaw: Math.atan2(rx, rz) },
      ],
    },
  };
  ctx.shops.push(shop);
  return shop;
}

function friendStands(ctx) {
  // two on the promenade, backed against the railing, facing the boulevard
  for (const z0 of [-28, -158]) {
    let placed = false;
    for (let d = 0; d < 30 && !placed; d += 1.5) {
      for (const z of [z0 + d, z0 - d]) {
        // the whole booth and its easel need room (x 17.3 .. 21, z .. z + 5.3)
        let ok = true;
        for (let zz = z - 1.9; zz <= z + 5.4 && ok; zz += 0.9) for (let xx = 16.9; xx <= 19.9 && ok; xx += 0.75) if (!free(ctx, xx, zz, 0.3)) ok = false;
        if (ok) {
          friendStand(ctx, 18.95 - 0.7, z, -1, 0);
          placed = true;
          break;
        }
      }
    }
  }
}

// ------------------------------------------------------------------ the pier and its wheel
function pier(ctx, world) {
  const M = ctx.M;
  const { z0, z1, x0, x1 } = PIER;
  const top = 0.35;
  const deck = new THREE.BoxGeometry(x1 - x0 + 0.6, 0.3, z1 - z0);
  const uv = deck.attributes.uv;
  const p = deck.attributes.position;
  deck.translate((x0 + x1) / 2 - 0.3, top - 0.15, (z0 + z1) / 2);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i) / 3, p.getX(i) / 3);
  ctx.B.add(M.deck, deck, null, nextId());
  for (let x = x0 + 4; x < x1; x += 8) {
    for (const z of [z0 + 0.6, z1 - 0.6, (z0 + z1) / 2]) put(ctx, M.trunk, new THREE.CylinderGeometry(0.28, 0.32, 3.2, 8), x, top - 1.8, z, 0);
  }
  // railings along both sides
  for (const z of [z0 + 0.15, z1 - 0.15]) {
    for (let x = x0 + 1; x < x1; x += 2.4) put(ctx, M.rail, new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6), x, top + 0.52, z, 0);
    for (const y of [0.62, 1.1]) put(ctx, M.rail, new THREE.CylinderGeometry(0.04, 0.04, x1 - x0, 6).rotateZ(Math.PI / 2), (x0 + x1) / 2, top + y, z, 0);
    ctx.col.addBox(x0 + 0.5, z - 0.12, x1, z + 0.12, -2, top + 1.2, 'bound');
  }
  ctx.col.addBox(x1 - 0.12, z0, x1 + 0.12, z1, -2, top + 1.2, 'bound');
  for (let x = x0 + 4; x < x1 - 4; x += 16) {
    streetLamp(ctx, x, z0 + 0.8, 0, 1, { y0: top, light: x % 32 < 16 });
    streetLamp(ctx, x + 8, z1 - 0.8, 0, -1, { y0: top });
  }
  for (let x = x0 + 10; x < x1 - 30; x += 16) {
    bench(ctx, x, z0 + 1.6, 0, top);
    bench(ctx, x + 8, z1 - 1.6, Math.PI, top);
  }
  // the entrance: an arch with the name
  {
    const ax = x0 + 2.2;
    for (const z of [z0 + 0.7, z1 - 0.7]) put(ctx, M.pole, new THREE.CylinderGeometry(0.16, 0.2, 5.2, 8), ax, top + 2.6, z, 0, srgb(0.98, 0.95, 0.9));
    put(ctx, M.prop, new THREE.BoxGeometry(0.4, 1.1, z1 - z0 - 0.8), ax, top + 5.2, (z0 + z1) / 2, 0, srgb(0.18, 0.72, 0.72));
    faceQuad(ctx, M.board, ax - 0.22, top + 5.2, (z0 + z1) / 2, -1, 0, 3.6, 0.9, ctx.atlas.rects.pier);
    for (let k = 0; k < 11; k++) {
      const z = z0 + 0.9 + (k / 10) * (z1 - z0 - 1.8);
      ctx.B.box(M.bulb, ax - 0.27, top + 5.82, z - 0.06, ax - 0.15, top + 5.94, z + 0.06, nextId(), { color: RAINBOW[k % RAINBOW.length] });
    }
    for (const z of [z0 + 0.7, z1 - 0.7]) ctx.col.addCircle(ax, z, 0.22, 0, 5.2, 'pole');
  }
  // the helipad at the end, and the copter's blueprint
  {
    const hx = x1 - 8;
    const hz = (z0 + z1) / 2;
    const pad = new THREE.CircleGeometry(5.6, 32).rotateX(-Math.PI / 2);
    pad.translate(hx, top + 0.012, hz);
    ctx.B.add(M.court, pad, null, nextId(), { color: srgb(0.3, 0.32, 0.4) });
    const ring = new THREE.RingGeometry(4.8, 5.15, 32).rotateX(-Math.PI / 2);
    ring.translate(hx, top + 0.016, hz);
    ctx.B.add(M.court, ring, null, nextId(), { color: srgb(0.98, 0.85, 0.3) });
    for (const [w, d, ox] of [[0.5, 4, -1.3], [0.5, 4, 1.3], [2.1, 0.5, 0]]) ctx.B.box(M.court, hx + ox - w / 2, top + 0.014, hz - d / 2, hx + ox + w / 2, top + 0.02, hz + d / 2, nextId(), { color: srgb(0.97, 0.97, 0.95) });
    billboard(ctx, x1 - 18, z1 - 1.9, 0, -1, 'bb_copter', { w: 7, legH: 2.6, y0: top });
    // (and the parachute's, for the way down)
    billboard(ctx, x1 - 27, z1 - 1.9, 0, -1, 'bb_parachute', { w: 7, legH: 2.6, y0: top });
    ctx.helipad = { x: hx, z: hz, y: top };
  }
  // the big wheel, turning slowly (its own meshes, outside the city's batches)
  const wx = x0 + 62;
  const wz = (z0 + z1) / 2;
  const R = 15;
  const wy = R + 3.2;
  const B = new Batch();
  const steel = srgb(0.97, 0.96, 0.98);
  for (const s of [-1.2, 1.2]) {
    const ring = new THREE.TorusGeometry(R, 0.18, 6, 48).rotateY(Math.PI / 2);
    ring.translate(s, 0, 0);
    B.add(M.steel, ring, null, nextId(), { color: steel });
    const hub = new THREE.TorusGeometry(R * 0.32, 0.1, 6, 24).rotateY(Math.PI / 2);
    hub.translate(s, 0, 0);
    B.add(M.steel, hub, null, nextId(), { color: srgb(0.98, 0.45, 0.6) });
  }
  const N = 16;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    for (const s of [-1.2, 1.2]) {
      const sp = new THREE.CylinderGeometry(0.06, 0.06, R, 5);
      sp.translate(0, R / 2, 0);
      sp.rotateX(a);
      sp.translate(s, 0, 0);
      B.add(M.steel, sp, null, nextId(), { color: steel });
    }
    const bar = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5).rotateZ(Math.PI / 2);
    bar.translate(0, Math.cos(a) * R, Math.sin(a) * R);
    B.add(M.steel, bar, null, nextId(), { color: steel });
    // bulbs round the rim
    for (let m = 0; m < 3; m++) {
      const b2 = a + (m / 3) * ((Math.PI * 2) / N);
      for (const s of [-1.35, 1.35]) {
        const g = new THREE.BoxGeometry(0.16, 0.16, 0.16);
        g.translate(s, Math.cos(b2) * R, Math.sin(b2) * R);
        B.add(M.bulb, g, null, nextId(), { color: RAINBOW[(k + m) % RAINBOW.length] });
      }
    }
  }
  const axle = new THREE.CylinderGeometry(0.5, 0.5, 3.4, 12).rotateZ(Math.PI / 2);
  B.add(M.steel, axle, null, nextId(), { color: srgb(0.5, 0.48, 0.56) });
  // the wheel turns about x; its rim stands across the pier (z), seen whole from the promenade
  const wheel = new THREE.Group();
  wheel.position.set(wx, top + wy, wz);
  ctx.parent.add(wheel);
  const holder = new THREE.Group();
  wheel.add(holder);
  B.flush(holder, { dynamic: true });
  // the legs (static), the gondolas (they hang level as it turns)
  for (const s of [-1, 1]) {
    for (const dz of [-1, 1]) {
      const fx = wx + s * 1.7;
      const fzz = wz + dz * 6.5;
      const dx = 0;
      const len = Math.hypot(6.5, wy);
      const g = new THREE.CylinderGeometry(0.22, 0.3, len, 8);
      g.rotateX(-dz * Math.atan2(6.5, wy));
      g.translate(fx + dx, top + wy / 2, (fzz + wz) / 2);
      ctx.B.add(M.steel, g, null, nextId(), { color: srgb(0.85, 0.84, 0.9) });
      ctx.col.addCircle(fx, fzz, 0.35, 0, 3, 'pole');
    }
  }
  const gondolas = [];
  const GB = new Batch();
  const gcols = [srgb(0.98, 0.45, 0.55), srgb(0.18, 0.72, 0.72), srgb(1.0, 0.82, 0.3), srgb(0.62, 0.42, 0.85), srgb(0.42, 0.75, 0.4), srgb(0.98, 0.62, 0.22)];
  const gondolaGroup = new THREE.Group();
  ctx.parent.add(gondolaGroup);
  for (let k = 0; k < N; k += 2) {
    const c = gcols[(k / 2) % gcols.length];
    const g1 = new THREE.BoxGeometry(2.0, 1.4, 1.6);
    g1.translate(0, -1.0, 0);
    const holderG = new THREE.Group();
    const B2 = new Batch();
    B2.add(M.prop, g1, null, nextId(), { color: c });
    const roof = new THREE.ConeGeometry(1.25, 0.6, 4).rotateY(Math.PI / 4);
    roof.scale(1.15, 1, 0.92);
    roof.translate(0, 0.0, 0);
    B2.add(M.awning, roof, null, nextId(), { color: srgb(0.98, 0.96, 0.92) });
    const win = new THREE.BoxGeometry(2.04, 0.5, 1.2);
    win.translate(0, -0.85, 0);
    B2.add(M.winGlass, win, null, nextId());
    B2.flush(holderG, { dynamic: true });
    gondolaGroup.add(holderG);
    gondolas.push({ g: holderG, a: (k / N) * Math.PI * 2 });
  }
  void GB;
  ctx.wheel = { group: wheel, holder, gondolas, x: wx, y: top + wy, z: wz, R, angle: 0 };
  void world;
}

// ------------------------------------------------------------------ who hangs out where
// the gangs own the alleys of their blocks; a few toughs loiter behind the first boulevard and
// downtown (somebody to rub out for the first goals)
function gangs(ctx) {
  for (const a of ctx.alleys) {
    const x = (a.x0 + a.x1) / 2;
    const z = (a.z0 + a.z1) / 2;
    if (a.gang) ctx.territories.push({ x, z, r: 42, kinds: ['crim', 'crim', 'brute'], count: 4, name: 'gang' });
    else if (a.type === 'towers' || (a.type === 'shops' && (a.row + a.col) % 2 === 1)) ctx.territories.push({ x, z, r: 30, kinds: ['crim'], count: 2, name: a.type });
  }
  // under the big wheel, at the end of the pier
  ctx.territories.push({ x: PIER.x1 - 30, z: (PIER.z0 + PIER.z1) / 2, r: 10, kinds: ['crim'], count: 2, name: 'pier' });
}

// ------------------------------------------------------------------ all of it
export function buildStreets(ctx) {
  const atlas = boardAtlas();
  ctx.atlas = atlas;
  ctx.M.board = makeSurface({ kind: 'box', map: atlas.texture, emMap: atlas.texture, emissive: new THREE.Color(0.2, 0.2, 0.19), ang: 1.45, wash: 0.86, line: 0.45, gloss: 0.1, objMask: true });
  ctx.signals = ctx.signals || [];
  ctx.parked = ctx.parked || [];
  ctx.busStops = ctx.busStops || [];
  crossings(ctx);
  parking(ctx);
  boards(ctx);
  friendStands(ctx);
  pier(ctx);
  avenues(ctx);
  streets(ctx);
  gangs(ctx);
}

// the wheel turns, the gondolas hang level
export function turnWheel(w, dt) {
  w.angle += dt * 0.06;
  w.holder.rotation.x = 0;
  w.group.rotation.x = w.angle;
  for (const g of w.gondolas) {
    const a = g.a + w.angle;
    g.g.position.set(w.x, w.y + Math.cos(a) * w.R, w.z + Math.sin(a) * w.R);
  }
}

void STREET_X0;
void STREET_X1;
void PROM_X1;
void westRect;
void hex;
