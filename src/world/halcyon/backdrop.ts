import * as THREE from 'three';
import { Builder, V, rng } from '../tower/kit';
import { CITY } from './kit';
import { CRESCENT, MERIDIAN } from './layout';

/**
 * Far scenery so no view ends in the void (drawn in `far`: no shadows): the
 * river's far banks and their quays, the Pont d'Or on its five arches, a
 * second stone bridge, the Dome of Tomorrow, the rail viaducts. (The blocks
 * on the far banks and the Kessler Spire are createNearBackdrop's, one
 * procedural draw.)
 */
export function buildBackdrop(far: Builder, mobile: boolean) {
  const r = rng(7);
  // banks: across the north arm, across the side arm, behind the terminals, to the right
  far.box('paving', -600, -2.6, 190, 600, 2, 280, 0xd8c8aa, 4, { ao: 0 });
  far.box('paving', 160, -2.6, -300, 400, 2, 190, 0xd8c8aa, 4, { ao: 0 });
  far.box('paving', -600, -8, -300, 58, 0, -90, 0xd8c8aa, 4, { ao: 0 });
  // (to the station's far end: the street behind it, under the tunnel end, has a floor)
  far.box('paving', -600, -2.6, -90, -56, 0, 72, 0xd8c8aa, 4, { ao: 0 });
  // quay walls on the far banks
  far.box('stone', -600, -2.6, 189.6, 600, 2.2, 190.2, 0xa89a82, 3.6, { ao: 0 });
  far.box('stone', 159.8, -2.6, -300, 160.4, 2.2, 190, 0xa89a82, 3.6, { ao: 0 });
  // trees along the far quay
  for (let x = -280; x < 280; x += mobile ? 24 : 12) {
    const tx = x + r() * 4;
    const g = new THREE.IcosahedronGeometry(2.2, 0).scale(1, 1.1, 1).translate(tx, 5.2, 193);
    far.geo('leaves', g, r() < 0.5 ? 0x8e1c18 : 0x3f6b2a);
    g.dispose();
    // (on a trunk: the crown's underside is a metre above the quay)
    far.box('trim', tx - 0.18, 2, 192.82, tx + 0.18, 3.6, 193.18, 0x4a3a2e, 1, { ao: 0 });
  }
  pontDor(far, mobile);
  // a second stone bridge over the side arm
  far.box('trim', 150, 5, -60, 170, 6.4, -48, CITY.trim, 3, { ao: 0 });
  for (let x = 58; x < 160; x += 20) far.box('stone', x + 8, -2, -58, x + 12, 5, -50, CITY.stone, 3, { ao: 0 });
  far.box('trim', 58, 5, -58, 160, 6.4, -50, CITY.trim, 3, { ao: 0 });
  domeOfTomorrow(far, mobile);
  // the rail viaducts: the Meridian across the arms' meeting, the two-tier Crescent behind the far bank
  viaduct(far, MERIDIAN.pts, MERIDIAN.deck, 1, mobile);
  viaduct(far, CRESCENT.pts, CRESCENT.deck, 2, mobile);
  // (their trains run into a terminus block at each end)
  for (const [x, z] of [MERIDIAN.pts[0], MERIDIAN.pts[MERIDIAN.pts.length - 1], CRESCENT.pts[0], CRESCENT.pts[CRESCENT.pts.length - 1]]) {
    far.box('stone', x - 18, -2.6, z - 18, x + 18, 52, z + 18, CITY.stone, 3.6, { ao: 0.3 });
    far.box('trim', x - 18.6, 52, z - 18.6, x + 18.6, 53.2, z + 18.6, CITY.trim, 2, { ao: 0 });
  }
}

const _vm = new THREE.Matrix4();
/** The rails' blue-white glow (never a rift's blue). */
const RAIL_GLOW = new THREE.Color(0.8, 1.7, 2.3);

/**
 * A stone rail viaduct along `pts` (its deck's centre line): piers every
 * 20 m, round arches between them (two tiers for a high one), the deck with
 * its cornice and parapets, and the rails' blue-white glow along its edges.
 */
function viaduct(far: Builder, pts: [number, number][], deck: number, tiers: number, mobile: boolean) {
  const span = 20, hw = 5, pierW = 3.2, seg = mobile ? 3 : 8;
  // piers at every `span` metres along the line
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (d: number) => {
    let i = 1;
    while (i < pts.length - 1 && lens[i] < d) i++;
    const t = (d - lens[i - 1]) / (lens[i] - lens[i - 1]);
    return V(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, 0, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t);
  };
  const total = lens[lens.length - 1];
  const P: THREE.Vector3[] = [];
  for (let d = 0; d <= total + 0.01; d += total / Math.round(total / span)) P.push(at(Math.min(d, total)));
  const up = V(0, 1, 0);
  const box = (key: string, c: THREE.Vector3, u: THREE.Vector3, s: THREE.Vector3, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation) => {
    _vm.makeBasis(u, up, s).setPosition(c);
    far.obox(key, _vm, sx, sy, sz, color, 3);
  };
  // the tiers: [springing, crown height under the band above]
  const bands: [number, number][] = tiers === 2 ? [[1.5, 18], [20.5, deck - 1.8]] : [[3, deck - 1.8]];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], e = P[i + 1];
    const u = e.clone().sub(a).normalize(), sd = V(-u.z, 0, u.x);
    const len = a.distanceTo(e);
    const mid = a.clone().add(e).multiplyScalar(0.5);
    const half = (len - pierW) / 2;
    for (const [ys0, yb] of bands) {
      // (round arches springing as high as they can under their band: tall slender openings, not a wall with holes)
      const ys = Math.max(ys0, yb - 0.9 - half);
      const rise = Math.min(yb - ys - 0.9, half);
      const A = (t: number) => mid.clone().addScaledVector(u, -Math.cos(t) * half).setY(ys + Math.sin(t) * rise);
      for (let k = 0; k < seg; k++) {
        const t0 = (Math.PI * k) / seg, t1 = (Math.PI * (k + 1)) / seg;
        const p0 = A(t0), p1 = A(t1);
        for (const side of [1, -1]) {
          const o = sd.clone().multiplyScalar(side * hw);
          const q = [p0.clone().add(o), p1.clone().add(o), p1.clone().add(o).setY(yb), p0.clone().add(o).setY(yb)];
          if (side > 0) far.quad('trim', q[0], q[1], q[2], q[3], 0xe0cfb0);
          else far.quad('trim', q[1], q[0], q[3], q[2], 0xe0cfb0);
        }
        const o = sd.clone().multiplyScalar(hw);
        far.quad('trim', p0.clone().sub(o), p1.clone().sub(o), p1.clone().add(o), p0.clone().add(o), 0xb09c7c);
      }
      // the band (a string course) over this tier
      box('trim', mid.clone().setY(yb + 0.35), u, sd, len, 0.7, hw * 2 + 0.7, 0xece0c6);
    }
    // the deck, its parapets (not on phones), a glowing line along each side of its fascia
    box('trim', mid.clone().setY(deck - 0.6), u, sd, len, 1.2, hw * 2 + 1.0, 0xece0c6);
    for (const side of [1, -1]) {
      if (!mobile) box('trim', mid.clone().addScaledVector(sd, side * (hw + 0.2)).setY(deck + 0.5), u, sd, len, 1.0, 0.3, 0xe6d8bc);
      const o = sd.clone().multiplyScalar(side * (hw + 0.52));
      const g0 = a.clone().add(o), g1 = e.clone().add(o);
      const q = [g0.clone().setY(deck - 0.42), g1.clone().setY(deck - 0.42), g1.clone().setY(deck - 0.22), g0.clone().setY(deck - 0.22)];
      if (side > 0) far.quad('emissive', q[0], q[1], q[2], q[3], RAIL_GLOW);
      else far.quad('emissive', q[1], q[0], q[3], q[2], RAIL_GLOW);
    }
  }
  // piers (a wider cutwater at the foot), pilasters rising to the deck
  for (const p of P) {
    const i = Math.min(P.length - 2, Math.max(0, P.indexOf(p)));
    const u = P[i + 1].clone().sub(P[i]).normalize(), sd = V(-u.z, 0, u.x);
    box('stone', p.clone().setY((deck - 1.2 - 2.6) / 2), u, sd, pierW, deck - 1.2 + 2.6, hw * 2 + 0.4, 0xd6c29e);
    if (mobile) continue;
    box('stone', p.clone().setY(-0.8), u, sd, pierW + 1.4, 3.6, hw * 2 + 1.6, 0xb8a888);
    for (const side of [1, -1]) box('trim', p.clone().addScaledVector(sd, side * (hw + 0.3)).setY(deck / 2), u, sd, pierW * 0.6, deck, 0.5, 0xece0c6);
  }
}

/** The Pont d'Or: a stone deck at +6 on five elliptical arches, balustrades, lamps every 12 m. */
function pontDor(far: Builder, mobile: boolean) {
  const x0 = -63, x1 = -51;
  far.box('trim', x0, 4.8, 80, x1, 6.2, 190, CITY.trim, 3, { ao: 0 });
  far.box('paving', x0 + 0.6, 6.2, 80, x1 - 0.6, 6.25, 190, CITY.paving, 2.4, { ao: 0 });
  const seg = mobile ? 6 : 12;
  for (let k = 0; k < 5; k++) {
    const za = 80 + k * 22, zb = za + 18;
    // piers with cutwaters
    far.box('stone', x0, -2.6, zb, x1, 4.8, zb + 4, 0xd6c4a3, 3, { ao: 0 });
    far.box('stone', x0 - 1.2, -2.6, zb + 0.6, x1 + 1.2, 1.4, zb + 3.4, 0xc8b898, 3, { ao: 0 });
    // the arch: an intrados and the spandrel walls on both faces
    const cz = (za + zb) / 2, hw = 9, rise = 5.8, base = -1;
    for (let i = 0; i < seg; i++) {
      const t0 = Math.PI * (i / seg), t1 = Math.PI * ((i + 1) / seg);
      const z0 = cz - Math.cos(t0) * hw, y0 = base + Math.sin(t0) * rise;
      const z1 = cz - Math.cos(t1) * hw, y1 = base + Math.sin(t1) * rise;
      far.quad('stone', V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z1), V(x0, y1, z1), 0xb8a888);
      // spandrel walls: A B on the arch, C D under the deck (A-B-C-D faces -X); at the crown one side closes to a point
      const A = [z0, y0], B = [z1, y1], top = 4.8;
      for (const [x, face] of [[x0, -1], [x1, 1]] as [number, number][]) {
        const P = (q: number[]) => V(x, q[1], q[0]);
        let quad = [P(A), P(B), V(x, top, z1), V(x, top, z0)];
        if (top - y0 < 1e-3) quad = [P(A), P(B), V(x, top, z1), V(x, top, z1)];
        else if (top - y1 < 1e-3) quad = [P(A), P(B), V(x, top, z0), V(x, top, z0)];
        if (face > 0) quad = [quad[0], quad[3], quad[2], quad[1]];
        if (top - y0 < 1e-3 && top - y1 < 1e-3) continue;
        far.quad('stone', quad[0], quad[1], quad[2], quad[3], 0xe0d0b4);
      }
    }
  }
  // balustrades and lamps
  for (const x of [x0 + 0.3, x1 - 0.3]) {
    far.box('trim', x - 0.3, 6.2, 80, x + 0.3, 6.4, 190, CITY.trim, 2, { ao: 0 });
    far.box('trim', x - 0.32, 7.1, 80, x + 0.32, 7.3, 190, 0xeadcc2, 2, { ao: 0 });
    far.quad('lattice', V(x, 6.4, 80), V(x, 6.4, 190), V(x, 7.1, 190), V(x, 7.1, 80), 0xffffff, [
      [0, 0],
      [55, 0],
      [55, 0.5],
      [0, 0.5],
    ]);
    for (let z = 86; z < 190; z += 12) {
      far.cylinder('metal', V(x, 6.2, z), V(x, 10.4, z), 0.09, CITY.iron, 6, 1, true);
      far.box('emissive', x - 0.2, 10.1, z - 0.2, x + 0.2, 10.7, z + 0.2, new THREE.Color(3.2, 2.05, 1.0), 1, { ao: 0 });
    }
  }
}

/** The Dome of Tomorrow beyond the river: a colonnaded drum, a glass lattice dome, a lantern. */
function domeOfTomorrow(far: Builder, mobile: boolean) {
  const cx = -108, cz = 287, R = 30;
  const seg = mobile ? 16 : 32;
  far.cylinder('stone', V(cx, 0, cz), V(cx, 26, cz), R, CITY.stone, seg, 4, false);
  far.cylinder('trim', V(cx, 25, cz), V(cx, 27, cz), R + 0.8, CITY.trim, seg, 2, true);
  for (let k = 0; k < (mobile ? 12 : 24); k++) {
    const a = (k / (mobile ? 12 : 24)) * Math.PI * 2;
    far.cylinder('trim', V(cx + Math.cos(a) * (R + 0.5), 2, cz + Math.sin(a) * (R + 0.5)), V(cx + Math.cos(a) * (R + 0.5), 25, cz + Math.sin(a) * (R + 0.5)), 0.7, CITY.trim, 6, 2, false);
  }
  const dome = new THREE.SphereGeometry(R, seg, mobile ? 6 : 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 34 / R, 1).translate(cx, 27, cz);
  far.geo('glass', dome, 0xffffff);
  dome.dispose();
  const inner = new THREE.SphereGeometry(R - 1.5, seg, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 31 / (R - 1.5), 1).translate(cx, 27, cz);
  far.geo('emissive', inner, new THREE.Color(0.9, 0.62, 0.34), 1, (p) => 0.5 + 0.5 * THREE.MathUtils.clamp((p.y - 27) / 31, 0, 1));
  inner.dispose();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    let prev = V(cx + Math.cos(a) * R, 27, cz + Math.sin(a) * R);
    for (let i = 1; i <= 6; i++) {
      const t = (i / 6) * (Math.PI / 2) * 0.97;
      const p = V(cx + Math.cos(a) * Math.cos(t) * R, 27 + Math.sin(t) * 34, cz + Math.sin(a) * Math.cos(t) * R);
      far.beam('metal', prev, p, 0.5, 0.5, CITY.gilt, 2);
      prev = p;
    }
  }
  far.cylinder('trim', V(cx, 60, cz), V(cx, 68, cz), 3, CITY.trim, 12, 2, true);
  far.cylinder('metal', V(cx, 68, cz), V(cx, 72, cz), 3.4, CITY.gilt, 12, 2, true, 0.3);
}

