import * as THREE from 'three';
import { Builder, V, col, rng, solid } from '../tower/kit';
import { CITY, bench, cornice, face, fbox, fquad, windowBay, type City, type CityCtx } from './kit';
import { DECAL } from './textures';
import { PLATFORM_Y, SQUARE_Y, SUN_DIR, TRACK_Y } from './layout';

/**
 * Tomorrow Central: the rail cut (tracks, the cyan third rails that mean
 * danger), the platforms, the station's inner walls, the glass barrel vault on
 * iron ribs with its fan-light screen, the tunnel portals and the departure
 * board. The Meridian Express itself is train.ts.
 */
export function buildStation(city: City) {
  const { C, R } = city;
  tracks(R, C);
  platforms(R);
  vault(R);
  tunnels(city);
  shafts(R);
}

/**
 * Sunlight slanting through the vault's glass: four soft beams along the
 * sun's direction down to the platform (additive, fading as they fall and
 * breathing slowly), and dust motes drifting in them (not on phones).
 */
function shafts(R: CityCtx) {
  const down = SUN_DIR.clone().negate();
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i < 4; i++) {
    // (from the glass on the sunward slope, 11 m up, down past the platform)
    const o = V(-44 + i * 9.5, 10.6, -19.5 - (i % 2) * 2);
    const len = (o.y - PLATFORM_Y + 1) / -down.y;
    const e = o.clone().addScaledVector(down, len);
    // two crossed quads per beam, 2.2 m wide
    for (const side of [V(0, 0, 1), V(1, 0, 0).cross(down).normalize()]) {
      const w = side.clone().multiplyScalar(1.1 + (i % 2) * 0.4);
      const base = pos.length / 3;
      for (const q of [o.clone().sub(w), o.clone().add(w), e.clone().add(w), e.clone().sub(w)]) pos.push(q.x, q.y, q.z);
      uv.push(0, 1, 1, 1, 1, 0, 0, 0);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vW;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
        float a = across * across * vUv.y * (0.55 + 0.45 * sin(uTime * 0.3 + vW.x * 0.2)) * 0.07;
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.52) * a, a);
      }`,
  });
  const beams = new THREE.Mesh(g, mat);
  beams.name = 'station:shafts';
  beams.renderOrder = 5;
  R.zoneRoot.add(beams);
  let dust: THREE.Points | null = null;
  if (!R.mobile) {
    const r = rng(41);
    const dp: number[] = [];
    for (let i = 0; i < 200; i++) dp.push(-54 + r() * 44, PLATFORM_Y + 0.5 + r() * 10, -31 + r() * 12);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.25, 0.8), size: 0.05, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    dust.name = 'station:dust';
    R.zoneRoot.add(dust);
  }
  R.animated.push((t) => {
    mat.uniforms.uTime.value = t;
    if (dust) dust.position.set(Math.sin(t * 0.05) * 0.6, Math.sin(t * 0.08) * 0.4, Math.cos(t * 0.04) * 0.5);
  });
}

/** The vault's section: z and y at t in 0..pi (springs at +7 on z -34 and -14, crown +12 at z -24). */
const arch = (t: number) => ({ z: -24 - Math.cos(t) * 10, y: 7 + Math.sin(t) * 5 });
const VX0 = -56, VX1 = -8;

function tracks(R: CityCtx, C: CityCtx) {
  for (const [ctx, x0, x1] of [[R, -56, -12], [C, -12, 50]] as [CityCtx, number, number][]) {
    const b = ctx.mb;
    const step = ctx.mobile ? 1.3 : 0.65;
    for (const zc of [-23.75, -28]) {
      b.box('paint', x0, TRACK_Y, zc - 1.5, x1, TRACK_Y + 0.12, zc + 1.5, 0x6a6258, 2, { ao: 0, skipBottom: true });
      for (let x = x0 + 0.3; x < x1; x += step) b.box('relief', x - 0.13, TRACK_Y + 0.12, zc - 1.25, x + 0.13, TRACK_Y + 0.24, zc + 1.25, 0x4a3a2e, 1, { ao: 0, skipBottom: true });
      for (const s of [-0.72, 0.72]) b.box('metal', x0, TRACK_Y + 0.24, zc + s - 0.04, x1, TRACK_Y + 0.4, zc + s + 0.04, 0x8c9196, 1, { ao: 0, skipBottom: true });
    }
    // the third rails glow cyan: danger
    for (const z of [-25.55, -30.05]) b.box('emissive', x0, TRACK_Y + 0.12, z - 0.06, x1, TRACK_Y + 0.3, z + 0.06, new THREE.Color(0.35, 1.7, 2.3), 1, { ao: 0 });
  }
}

function platforms(R: CityCtx) {
  const b = R.mb;
  const m = R.mobile;
  // edge bands: a cream safety line and a gilt strip
  for (const [z0, z1] of [[-22.1, -21.7], [-30.7, -30.3]]) b.box('paint', -56, PLATFORM_Y, z0, -2, PLATFORM_Y + 0.01, z1, 0xe8dcc0, 1, { ao: 0 });
  for (const z of [-21.62, -30.78]) b.box('metal', -56, PLATFORM_Y, z - 0.04, -2, PLATFORM_Y + 0.012, z + 0.04, CITY.gilt, 1, { ao: 0 });
  // the north wall at platform level (under the arcade): shops and a café behind arched glass
  const nf = face('z', -18, -1);
  fbox(b, 'stone', nf, -56, -20, PLATFORM_Y, SQUARE_Y - 0.4, 0, 0.12, CITY.rustic, 3.6, { ao: 0.6 });
  for (let x = -52.5; x < -24; x += 5.5) windowBay(b, nf, 'shop', x, PLATFORM_Y + 0.25, { lit: true, glow: 1.4, mobile: m, w0: 0.12 });
  cornice(b, nf, -56, -20, SQUARE_Y, 0.5);
  // benches along it
  for (const x of [-49.75, -38.75, -27.75]) bench(R, x, -18.75, PLATFORM_Y, Math.PI);
  // the departure board: "MERIDIAN EXPRESS . THE TOWER . 18:40", hung from the vault
  const bx0 = -21.4, bx1 = -15, by0 = -3.75, by1 = -3.35, bz = -19.8;
  b.box('paint', bx0 - 0.1, by0 - 0.1, bz - 0.08, bx1 + 0.1, by1 + 0.1, bz + 0.08, CITY.navy, 1, { ao: 0 });
  fquad(b, 'decal', face('z', bz - 0.08, -1), bx0, bx1, by0, by1, 0.005, 0xffffff, DECAL.sign(3));
  fquad(b, 'decal', face('z', bz + 0.08, 1), bx0, bx1, by0, by1, 0.005, 0xffffff, DECAL.sign(3));
  for (const x of [bx0 + 0.4, bx1 - 0.4]) b.box('metal', x - 0.02, by1 + 0.1, bz - 0.02, x + 0.02, 11.5, bz + 0.02, CITY.iron, 1, { ao: 0 });
}

function vault(R: CityCtx) {
  const b = R.mb;
  const m = R.mobile;
  const n = 16;
  // glass: one strip per arc segment, the whole length
  for (let k = 0; k < n; k++) {
    const p = arch((Math.PI * k) / n), q = arch((Math.PI * (k + 1)) / n);
    b.quad('glass', V(VX0, p.y, p.z), V(VX1, p.y, p.z), V(VX1, q.y, q.z), V(VX0, q.y, q.z), 0xffffff);
  }
  // ribs (every 3 m; 6 on phones), an inner lattice arch with zigzag bracing on desktop
  const ribStep = m ? 6 : 3;
  const iron = 0x1f2a36;
  for (let x = VX0; x <= VX1 + 0.01; x += ribStep) {
    for (let k = 0; k < n; k++) {
      const p = arch((Math.PI * k) / n), q = arch((Math.PI * (k + 1)) / n);
      b.beam('iron', V(x, p.y - 0.05, p.z), V(x, q.y - 0.05, q.z), 0.2, 0.34, iron, 1);
      if (m) continue;
      const pi = inner((Math.PI * k) / n), qi = inner((Math.PI * (k + 1)) / n);
      b.beam('iron', V(x, pi.y, pi.z), V(x, qi.y, qi.z), 0.12, 0.14, iron, 1);
      b.beam('metal', V(x, p.y - 0.1, p.z), V(x, qi.y, qi.z), 0.06, 0.06, CITY.gilt, 1);
    }
    // a tie rod across at the springs, hangers to the crown
    if (!m) {
      b.box('iron', x - 0.04, 6.9, -34, x + 0.04, 7.0, -14, iron, 1, { ao: 0 });
      b.box('iron', x - 0.03, 7.0, -24.03, x + 0.03, 11.4, -23.97, iron, 1, { ao: 0 });
    }
  }
  // purlins along the vault, a ridge with gilt cresting
  for (let k = 1; k < n; k += 2) {
    const p = arch((Math.PI * k) / n);
    b.box('iron', VX0, p.y - 0.12, p.z - 0.06, VX1, p.y, p.z + 0.06, iron, 1, { ao: 0 });
  }
  b.box('iron', VX0, 11.95, -24.25, VX1, 12.3, -23.75, iron, 1, { ao: 0 });
  if (!m) for (let x = VX0 + 1.5; x < VX1; x += 3) b.cylinder('metal', V(x, 12.3, -24), V(x, 12.9, -24), 0.07, CITY.gilt, 6, 1, true, 0.01);
  // the spring line over the station stair (no arcade under it there): a girder
  b.box('iron', -23, 6.4, -14.4, VX1, 7.2, -13.8, iron, 1, { ao: 0 });
  // the fan-light screen at the open end (x -8): glazed lunette, radiating bars, the emblem; glazed down to +1 over the tracks
  fanScreen(b, VX1, 1, m);
  fanScreen(b, VX0, -1, m);
  const f = face('x', VX1, 1);
  fquad(b, 'glass', f, -34, -18, 1, 7, 0, 0xffffff, 2);
  for (let z = -34; z <= -18; z += 2) fbox(b, 'iron', f, z - 0.05, z + 0.05, 1, 7, 0, 0.1, iron, 1);
  fbox(b, 'iron', f, -34, -14, 6.7, 7.2, -0.15, 0.2, iron, 1);
  fbox(b, 'iron', f, -34, -18, 0.8, 1.1, -0.1, 0.15, iron, 1);
  fbox(b, 'iron', f, -34, -18, 3.9, 4.0, 0, 0.1, iron, 1);
}

/** The inner lattice arch, 0.6 m inside the ribs. */
const inner = (t: number) => ({ z: -24 - Math.cos(t) * 9.4, y: 7 + Math.sin(t) * 4.4 });

/** A glazed half-ellipse screen closing the vault at x, with radiating bars, rings and a gilt emblem. */
function fanScreen(b: Builder, x: number, n: 1 | -1, mobile: boolean) {
  const seg = 16;
  const c = V(x, 7, -24);
  const iron = 0x1f2a36;
  for (let k = 0; k < seg; k++) {
    const p = arch((Math.PI * k) / seg), q = arch((Math.PI * (k + 1)) / seg);
    b.quad('glass', c, V(x, p.y, p.z), V(x, q.y, q.z), V(x, q.y, q.z), 0xffffff);
  }
  const o = n * 0.06;
  for (const s of mobile ? [1] : [0.3, 0.62, 1]) {
    for (let k = 0; k < seg; k++) {
      const a = (Math.PI * k) / seg, e = (Math.PI * (k + 1)) / seg;
      b.beam(s === 1 ? 'iron' : 'metal', V(x + o, 7 + Math.sin(a) * 5 * s, -24 - Math.cos(a) * 10 * s), V(x + o, 7 + Math.sin(e) * 5 * s, -24 - Math.cos(e) * 10 * s), 0.14, 0.16, s === 1 ? iron : CITY.gilt, 1);
    }
  }
  for (let k = 1; k < 12; k++) {
    const a = (Math.PI * k) / 12;
    b.beam('iron', V(x + o, 7 + Math.sin(a) * 1.5, -24 - Math.cos(a) * 3), V(x + o, 7 + Math.sin(a) * 5, -24 - Math.cos(a) * 10), 0.1, 0.1, iron, 1);
  }
  // the emblem: a gilt ring crossed by a bar
  const ring = new THREE.TorusGeometry(1.3, 0.13, 5, 24).rotateY(Math.PI / 2).translate(x + o * 2, 8.6, -24);
  b.geo('metal', ring, CITY.gilt);
  ring.dispose();
  b.box('iron', x + o * 2 - 0.08, 6.9, -24.12, x + o * 2 + 0.08, 10.4, -23.88, CITY.gilt, 1, { ao: 0 });
}

function tunnels(city: City) {
  const { L, R } = city;
  // under the Bastion: tunnel walls, its ceiling, a portal on the cut, darkness inside
  solid(L, 'stone', 50, -10, -34, 58, -2, -30.3, CITY.rustic, 2.4, { tag: 'tunnelWall' }, { ao: 0.3 });
  solid(L, 'stone', 50, -10, -21.7, 58, -2, -18, CITY.rustic, 2.4, { tag: 'tunnelWall' }, { ao: 0.3 });
  const lb = L.mb;
  lb.quad('stone', V(50, -2.01, -30.3), V(58, -2.01, -30.3), V(58, -2.01, -21.7), V(50, -2.01, -21.7), 0x5a5046, [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ]);
  lb.quad('paint', V(57.9, TRACK_Y, -30.3), V(57.9, TRACK_Y, -21.7), V(57.9, -2, -21.7), V(57.9, -2, -30.3), 0x0b0b0d);
  const pf = face('x', 50, -1);
  fbox(lb, 'stone', pf, -34, -18, -2, 5.4, 0, 0.12, CITY.rustic, 3.6, { ao: 0 });
  fbox(lb, 'trim', pf, -31, -21, -2.1, -1.2, 0, 0.3, CITY.trim);
  fbox(lb, 'trim', pf, -26.6, -25.4, -2.1, 0.2, 0, 0.36, 0xeadcc2);
  for (const z of [-31, -21]) fbox(lb, 'trim', pf, z - 0.35, z + 0.35, TRACK_Y, -1.2, 0, 0.3, CITY.trim);
  cornice(lb, pf, -34, -18, 6, 0.55);
  // the cut's far end (the train's tail runs in): a portal round the opening, darkness beyond
  col(R, -60, -10, -34, -56, 8, -18, { tag: 'tunnelEnd' });
  const rb = R.mb;
  const ef = face('x', -56, 1);
  for (const [a0, a1, y0, y1] of [[-34, -26, TRACK_Y, 7], [-21.5, -18, TRACK_Y, 7], [-26, -21.5, -2.5, 7]]) fbox(rb, 'stone', ef, a0, a1, y0, y1, -4, 0, CITY.rustic, 3.6, { ao: 0 });
  rb.quad('paint', V(-59.9, TRACK_Y, -21.5), V(-59.9, TRACK_Y, -26), V(-59.9, -2.5, -26), V(-59.9, -2.5, -21.5), 0x0b0b0d);
  fbox(rb, 'trim', ef, -26.5, -21, -2.5, -1.9, 0, 0.3, CITY.trim);
  fbox(rb, 'trim', ef, -24.3, -23.2, -2.5, -1.3, 0, 0.36, 0xeadcc2);
  for (const z of [-26.5, -21]) fbox(rb, 'trim', ef, z - 0.3, z + 0.3, TRACK_Y, -2.5, 0, 0.25, CITY.trim);
  cornice(rb, ef, -34, -18, 7, 0.5);
}
