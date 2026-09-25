import * as THREE from 'three';
import { Builder, V, col } from '../tower/kit';
import { CITY, type CityCtx } from './kit';
import { AIRSHIP } from './layout';

/** Radius of the hull (length L, max radius r) at t along it (0 tail .. 1 nose): a fine tail, a blunt nose. */
const hullR = (t: number, r: number) => r * (t < 0.3 ? Math.sin((t / 0.3) * (Math.PI / 2)) ** 0.8 : t > 0.8 ? Math.cos(((t - 0.8) / 0.2) * (Math.PI / 2)) ** 0.55 : 1);

/**
 * An airship along X (nose toward +X) into `b`: a cream envelope in gores
 * with brass stringers and rings, a brass nose cap, cruciform fins, a
 * gondola with a lit window band. Returns nothing: rotors are the caller's.
 */
function envelope(b: Builder, c: THREE.Vector3, L: number, r: number, o: { seg: number; stringers: number; key: { skin: string; metal: string; glow: string } }) {
  const { skin, metal, glow } = o.key;
  // hull: a lathe along X, its gores alternating a shade (the concept's panelled canvas)
  const n = 24;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    prof.push(new THREE.Vector2(Math.max(0.05, hullR(t, r)), -L / 2 + t * L));
  }
  const hull = new THREE.LatheGeometry(prof, o.seg).rotateZ(-Math.PI / 2).translate(c.x, c.y, c.z);
  // (a warm canvas, not white: in the low sun a pale one blows out to a blank capsule)
  b.geo(skin, hull, 0xe6d9bd, 1, (p) => {
    const a = Math.atan2(p.z - c.z, p.y - c.y);
    const gore = Math.floor(((a + Math.PI) / (Math.PI * 2)) * o.seg * 0.5) % 2;
    // (lit from above: a darker belly)
    return (gore ? 0.86 : 1.0) * (0.7 + 0.3 * THREE.MathUtils.clamp((p.y - c.y) / r + 0.5, 0, 1));
  });
  hull.dispose();
  // brass stringers along the envelope, rings round it
  for (let k = 0; k < o.stringers; k++) {
    const a = (k / o.stringers) * Math.PI * 2 + Math.PI / o.stringers;
    let prev: THREE.Vector3 | null = null;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const rr = hullR(t, r) + 0.04;
      const p = V(c.x - L / 2 + t * L, c.y + Math.cos(a) * rr, c.z + Math.sin(a) * rr);
      // (wide enough to read from the square, 90 m below)
      if (prev) b.beam(metal, prev, p, 0.5, 0.25, CITY.brass, 1);
      prev = p;
    }
  }
  for (const t of [0.14, 0.3, 0.5, 0.7, 0.84]) {
    const x = c.x - L / 2 + t * L;
    b.cylinder(metal, V(x - 0.3, c.y, c.z), V(x + 0.3, c.y, c.z), hullR(t, r) + 0.22, CITY.brass, o.seg, 1, false);
  }
  // a navy band with a gilt edge round the middle
  b.cylinder(skin, V(c.x - 1.6, c.y, c.z), V(c.x + 1.6, c.y, c.z), r + 0.05, CITY.navy, o.seg, 1, false);
  for (const s of [-1, 1]) b.cylinder(metal, V(c.x + s * 1.6 - 0.1, c.y, c.z), V(c.x + s * 1.6 + 0.1, c.y, c.z), r + 0.09, CITY.gilt, o.seg, 1, false);
  // the brass nose cap
  const cap = new THREE.SphereGeometry(r * 0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).translate(c.x + L / 2 - r * 0.1, c.y, c.z);
  b.geo(metal, cap, CITY.brass);
  cap.dispose();
  // cruciform fins at the tail: cream with a navy edge (two-sided)
  for (const [dy, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x0 = c.x - L / 2 + L * 0.02;
    const q = (a: number, e: number) => V(x0 + a, c.y + dy * e, c.z + dz * e);
    const P = [q(0, r * 0.35), q(L * 0.17, r * 0.78), q(L * 0.12, r + r * 0.5), q(-L * 0.015, r + r * 0.55)];
    b.quad(skin, P[0], P[1], P[2], P[3], 0xe0d6c0);
    b.quad(skin, P[3], P[2], P[1], P[0], 0xe0d6c0);
    b.beam(metal, P[2], P[3], 0.18, 0.18, CITY.navy, 1);
  }
  void glow;
}

/**
 * The airship AURORA hovering over the square (nose toward +X): a cream
 * envelope in gores with brass stringers and rings, a brass-and-glass gondola
 * with lit windows, the big four-bladed top rotor, side propellers, and the
 * lattice cargo boom whose pulley holds the arena's cargo pod. The hull holds
 * still (the pod's cable hangs from it); the rotors turn. It can't be
 * reached: its colliders only refuse rifts. Draws in `far` (no shadows).
 * A second, smaller airship cruises round the city far off.
 */
export function buildAirship(ctx: CityCtx) {
  const far = ctx.far;
  const m = ctx.mobile;
  const { c, length: L, r } = AIRSHIP;
  col(ctx, c.x - L / 2, c.y - r, c.z - r, c.x + L / 2, c.y + r, c.z + r, { tag: 'airship', noPortal: true });
  col(ctx, 18, 36, 46, 30, 39.5, 50, { tag: 'gondola', noPortal: true });
  col(ctx, 6, 36.6, 47.6, 18, 37.4, 48.4, { tag: 'boom', noPortal: true });
  envelope(far, c, L, r, { seg: m ? 16 : 28, stringers: m ? 6 : 8, key: { skin: 'paint', metal: 'metal', glow: 'emissive' } });

  // gondola: a bronze keel, a brass window band of arched panes glowing warm, a cream roof, rounded navy ends
  far.box('metal', 18.4, 36, 46.2, 29.6, 37.3, 49.8, 0x6e5034, 1, { ao: 0 });
  far.box('metal', 18.2, 37.2, 46.0, 29.8, 37.35, 50.0, CITY.brass, 1, { ao: 0 });
  far.box('metal', 18.4, 37.35, 46.06, 29.6, 38.55, 49.94, CITY.brass, 1, { ao: 0 });
  const pane = new THREE.Shape();
  pane.moveTo(-0.45, 0);
  pane.lineTo(0.45, 0);
  pane.lineTo(0.45, 0.66);
  pane.absarc(0, 0.66, 0.45, 0, Math.PI, false);
  pane.lineTo(-0.45, 0);
  const paneG = new THREE.ShapeGeometry(pane, m ? 3 : 6);
  const lit = new THREE.Color(1.9, 1.25, 0.66);
  for (let x = 18.95; x < 29.2; x += 1.1)
    for (const s of [-1, 1]) {
      const g = paneG.clone();
      if (s < 0) g.rotateY(Math.PI);
      g.translate(x + 0.45, 37.43, 48 + s * 1.97);
      far.geo('emissive', g, lit);
      g.dispose();
    }
  paneG.dispose();
  far.box('metal', 18.2, 38.55, 46.0, 29.8, 38.7, 50.0, CITY.brass, 1, { ao: 0 });
  far.box('paint', 18.4, 38.7, 46.3, 29.6, 39.5, 49.7, 0xe0d6c0, 1, { ao: 0 });
  for (const [x, s] of [[29.6, 1], [18.4, -1]] as [number, number][]) {
    const end = new THREE.CylinderGeometry(1.8, 1.8, 3.5, 12, 1, false, s > 0 ? 0 : Math.PI, Math.PI).translate(x, 37.75, 48);
    far.geo('paint', end, CITY.navy);
    end.dispose();
    const glass = new THREE.CylinderGeometry(1.82, 1.82, 1.2, 12, 1, true, s > 0 ? 0 : Math.PI, Math.PI).translate(x, 37.95, 48);
    far.geo('emissive', glass, new THREE.Color(1.7, 1.1, 0.6));
    glass.dispose();
  }
  // struts up to the hull, a little observation deck rail
  for (const x of [20, 24, 28]) for (const z of [46.6, 49.4]) far.beam('metal', V(x, 39.5, z), V(x, c.y - r * 0.82, 48 + (z - 48) * 0.6), 0.14, 0.14, CITY.brass, 1);
  // the cargo boom (a lattice arm) to the pulley over the warden
  far.box('metal', 6, 36.6, 47.6, 18, 36.72, 48.4, CITY.brass, 1, { ao: 0 });
  far.box('metal', 6, 37.28, 47.6, 18, 37.4, 48.4, CITY.brass, 1, { ao: 0 });
  for (let x = 6; x < 18; x += 1) far.beam('metal', V(x, 36.7, 48), V(x + 1, 37.3, 48), 0.06, 0.06, CITY.brass, 1);
  far.cylinder('metal', V(6, 36.2, 47.5), V(6, 36.2, 48.5), 0.45, CITY.iron, 10, 1, true);
  // side propellers on outriggers (their blades turn)
  const props: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    far.beam('metal', V(24, 38.5, 48 + s * 2), V(24, 40, 48 + s * 7.5), 0.2, 0.2, CITY.iron, 1);
    far.cylinder('metal', V(23, 40, 48 + s * 7.5), V(25.5, 40, 48 + s * 7.5), 0.45, CITY.brass, 8, 1, true, 0.3);
    const pb = new Builder();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      pb.beam('metal', V(0, 0, 0), V(0, Math.cos(a) * 1.7, Math.sin(a) * 1.7), 0.08, 0.32, CITY.iron, 1, V(1, 0, 0));
    }
    const g = pb.build(ctx.materials, { name: 'airship:prop', castShadow: false });
    g.position.set(22.8, 40, 48 + s * 7.5);
    ctx.zoneRoot.add(g);
    props.push(g);
  }
  // the big top rotor on its mast
  far.cylinder('metal', V(c.x, c.y + r - 0.3, c.z), V(c.x, c.y + r + 3, c.z), 0.35, CITY.iron, 8, 1, true, 0.25);
  far.cylinder('metal', V(c.x, c.y + r + 1.2, c.z), V(c.x, c.y + r + 1.5, c.z), 0.7, CITY.brass, 10, 1, true);
  const rotor = new THREE.Group();
  rotor.name = 'airship:rotor';
  const blades = new Builder();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const tip = V(Math.cos(a) * 13, 0.2, Math.sin(a) * 13);
    blades.beam('metal', V(0, 0, 0), tip, 0.9, 0.08, CITY.iron, 1);
    blades.beam('metal', tip.clone().multiplyScalar(0.94), tip, 0.95, 0.1, CITY.brass, 1);
  }
  blades.cylinder('metal', V(0, -0.2, 0), V(0, 0.5, 0), 0.6, CITY.brass, 10, 1, true, 0.3);
  rotor.add(blades.build(ctx.materials, { name: 'rotor', castShadow: false }));
  rotor.position.set(c.x, c.y + r + 3, c.z);
  ctx.zoneRoot.add(rotor);
  // two small rotors fore and aft on short masts (the concept's four), under the big one's disc
  const small: THREE.Object3D[] = [];
  if (!m)
    for (const dx of [13, -13]) {
      const x = c.x + dx, top = c.y + hullR((x - (c.x - L / 2)) / L, r);
      far.cylinder('metal', V(x, top - 0.4, c.z), V(x, top + 1.4, c.z), 0.2, CITY.iron, 6, 1, true, 0.14);
      const sb = new Builder();
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        sb.beam('metal', V(0, 0, 0), V(Math.cos(a) * 3.4, 0.1, Math.sin(a) * 3.4), 0.42, 0.06, CITY.iron, 1);
      }
      sb.cylinder('metal', V(0, -0.15, 0), V(0, 0.3, 0), 0.3, CITY.brass, 8, 1, true, 0.18);
      const g = sb.build(ctx.materials, { name: 'airship:rotor2', castShadow: false });
      g.position.set(x, top + 1.4, c.z);
      ctx.zoneRoot.add(g);
      small.push(g);
    }
  // running lights: red, green, white
  for (const [x, y, z, col3] of [[c.x + 2, c.y, c.z - r - 0.1, [3, 0.3, 0.2]], [c.x + 2, c.y, c.z + r + 0.1, [0.3, 3, 0.5]], [c.x - L / 2 + 0.2, c.y, c.z, [3, 3, 3]]] as [number, number, number, number[]][]) {
    const g = new THREE.SphereGeometry(0.28, 8, 6).translate(x, y, z);
    far.geo('emissive', g, new THREE.Color(col3[0], col3[1], col3[2]));
    g.dispose();
  }

  // a second airship cruising round the city far off (one mesh; its rotor is too far to see turn)
  const cruiser = new THREE.Group();
  cruiser.name = 'airship:cruiser';
  const cb = new Builder();
  const cc = V(0, 0, 0);
  envelope(cb, cc, 22, 3.2, { seg: m ? 10 : 16, stringers: m ? 0 : 6, key: { skin: 'paint', metal: 'paint', glow: 'emissive' } });
  cb.box('paint', -3.5, -4.6, -1.2, 3.5, -3.4, 1.2, CITY.navy, 1, { ao: 0 });
  cb.box('emissive', -3.3, -4.2, -1.22, 3.3, -3.6, 1.22, new THREE.Color(1.6, 1.05, 0.55), 1, { ao: 0 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    cb.beam('paint', V(0, 3.9, 0), V(Math.cos(a) * 8, 4.0, Math.sin(a) * 8), 0.5, 0.06, CITY.iron, 1);
  }
  cruiser.add(cb.build(ctx.materials, { name: 'cruiser', castShadow: false }));
  ctx.zoneRoot.add(cruiser);
  const R = 300, H = 105, O = V(-20, 0, 170);
  ctx.animated.push((t) => {
    rotor.rotation.y = t * Math.PI * 2 * 0.5;
    small.forEach((g, i) => (g.rotation.y = (i ? -1 : 1) * t * Math.PI * 2 * 1.2));
    for (const p of props) p.rotation.x = t * Math.PI * 2 * 3;
    // (about 3 m/s: a lap every ten minutes, nose along its path)
    const a = t * 0.01 + 1.9;
    cruiser.position.set(O.x + Math.cos(a) * R, H + Math.sin(t * 0.21) * 1.5, O.z + Math.sin(a) * R);
    cruiser.rotation.y = -a - Math.PI / 2;
  });
}
