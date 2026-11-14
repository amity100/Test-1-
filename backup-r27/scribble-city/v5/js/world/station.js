import { srgb, hex, addLight } from '../render/materials.js';
import { nextId, Facade } from './kit.js';
import { CURB, blockRect } from './layout.js';
import { decoBuilding, fbox, neonSign } from './deco.js';

// (ROADMAP 6.3; not with ?classic) The police station at the north end of the fountain plaza,
// facing the fountain: POLICE over its door and SCRIBBLE CITY POLICE along its top, a blue lamp
// either side of the door, two police cars parked in front. You come out of its door after a
// night in its cells (game/arrest.js). Built after the rest of the city (city.js, extra), so
// nothing else in it moves.

const WALL = srgb(0.9, 0.92, 0.96);
const TRIM = srgb(0.17, 0.24, 0.48);
const STEEL = srgb(0.36, 0.38, 0.44);
const BLUE = '#4f8cff';
const POLICE_WHITE = [0.95, 0.95, 0.97];

export function buildStation(ctx) {
  const M = ctx.M;
  const B = blockRect(1, 1);
  const L = 22;
  const D = 11;
  // (the plaza starts past its row of shops, 16 m in; its benches line the west edge)
  const x0 = B.x0 + 19;
  const zf = B.z0 + 13;
  const f = new Facade(x0, zf, 1, 0, 0, 1);
  const info = decoBuilding(ctx, { f, L, D, floors: 3, color: WALL, trim: TRIM, signCol: BLUE, sign: 'POLICE', signFont: 'Rubik', awning: TRIM, fin: false, doorU: L / 2, sides: { a: true, b: true }, back: true });
  // the name along the top
  neonSign(ctx, f, 'SCRIBBLE CITY POLICE', L / 2, info.h + 0.32, 0.26, 13, hex('#dfe9ff'), { font: 'Rubik', size: 80 });
  // a blue lamp on a post either side of the door
  const id = nextId();
  for (const s of [-1, 1]) {
    const u = L / 2 + s * 2.6;
    fbox(ctx, f, M.steel, u - 0.07, CURB, 0.9, u + 0.07, CURB + 2.5, 1.04, STEEL, id);
    fbox(ctx, f, M.neon, u - 0.22, CURB + 2.5, 0.75, u + 0.22, CURB + 2.95, 1.19, hex(BLUE));
    const p = f.p(u, CURB + 2.7, 0.97);
    ctx.col.addCircle(p[0], p[2], 0.12, 0, CURB + 2.95, 'pole');
    addLight(p[0], p[1], p[2], 6, hex(BLUE), 1.1);
  }
  // two police cars parked in front, either side of the way in (game/traffic.js draws them)
  if (ctx.parked) {
    for (const s of [-1, 1]) {
      const p = f.p(L / 2 + s * 3.6, CURB, 5.2);
      const box = ctx.col.addBox(p[0] - 1.0, p[2] - 2.3, p[0] + 1.0, p[2] + 2.3, 0, 1.45, 'car', { parked: true });
      ctx.parked.push({ x: p[0], z: p[2], yaw: 0, spec: { kind: 'sedan', color: POLICE_WHITE, police: true }, box });
    }
  }
  const door = f.p(L / 2, CURB, 2.4);
  const mid = f.p(L / 2, CURB, -D / 2);
  ctx.station = { door: { x: door[0], z: door[2], yaw: 0 }, x: mid[0], z: mid[2], building: info };
  return ctx.station;
}
