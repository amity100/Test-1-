import * as THREE from 'three';
import { makeSlingPouch, slingCordMaterial } from '../../characters/wardrobe/props';
import { clothMaterial, solidMaterial, texPair, type TexPair, type Tier } from '../../characters/wardrobe/materials';
import clayAUrl from '../../assets/palace/clay_a.webp?url';
import clayNUrl from '../../assets/palace/clay_n.webp?url';

/*
 * Hand props of the court that the wardrobe does not make (all procedural, Iron Age I-IIA highlands):
 *   - pottery for the servants: a one-handled jug and a carinated bowl (red-slipped, hand-burnished clay)
 *   - a simple self bow (strung) and a leather quiver with reed arrows for the Benjaminite archers (1 Chr 12:2)
 *   - a slinger's sling (braided cords + leather cradle, the wardrobe's pouch) hanging from the hand (Judg 20:16)
 *   - the torn corner of a prophet's robe (me'il) with its tzitzit and a tekhelet thread — the memory of Gilgal
 *     (1 Sam 15:27: by the plain sense — Rashi, Radak, Metzudat David — Saul took hold of the corner of SAMUEL's
 *     robe and it tore); undyed dark wool, one finished hem, one torn and frayed edge.
 * Every prop: origin at its grip / hold point, +Y "up" along the prop (like the wardrobe's Prop frames).
 */

export interface CastPropKit {
  tier: Tier;
  leather: TexPair;
  wood: TexPair;
  rope: TexPair;
  braid: TexPair;
  weave: TexPair;
  clay: { a: THREE.Texture; n: THREE.Texture };
  disposables: Set<{ dispose(): void }>;
}

const TAU = Math.PI * 2;

function loadTex(url: string, srgb: boolean, tier: Tier) {
  return new Promise<THREE.Texture>((res) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = tier === 'low' ? 2 : 4;
      res(t);
    }, undefined, () => res(new THREE.Texture()));
  });
}

export async function loadPropKit(tier: Tier): Promise<CastPropKit> {
  const [leather, wood, rope, braid, weave, ca, cn] = await Promise.all([
    texPair('leather', tier), texPair('wood', tier), texPair('rope', tier), texPair('braid', tier), texPair('weave_medium', tier),
    loadTex(clayAUrl, true, tier), loadTex(clayNUrl, false, tier),
  ]);
  const kit: CastPropKit = { tier, leather, wood, rope, braid, weave, clay: { a: ca, n: cn }, disposables: new Set() };
  kit.disposables.add(ca);
  kit.disposables.add(cn);
  return kit;
}

function track<T extends { dispose(): void }>(kit: CastPropKit, o: T): T {
  kit.disposables.add(o);
  return o;
}

function mesh(kit: CastPropKit, g: THREE.BufferGeometry, m: THREE.Material, shadow = true) {
  track(kit, g);
  track(kit, m);
  const o = new THREE.Mesh(g, m);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}

/** Red-slipped, burnished clay (Iron Age table ware): the palace clay maps, tinted. */
function clayMaterial(kit: CastPropKit, color: number, rough = 0.55) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, map: kit.clay.a, normalMap: kit.clay.n });
  m.normalScale.set(0.6, 0.6);
  return m;
}

/** Lathe around +Y from a list of [radius, y] points (outer wall; the rim folds inside for thickness). */
function potLathe(pts: [number, number][], seg: number) {
  const v = pts.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(v, seg);
  g.computeVertexNormals();
  return g;
}

/** One-handled jug (servant pours wine / water). Origin at the handle grip; +Y up. */
export function makeJug(kit: CastPropKit, seed = 1): THREE.Group {
  const seg = kit.tier === 'low' ? 14 : 28;
  const s = 1 + ((seed * 37) % 7) * 0.02;
  const prof: [number, number][] = [
    [0.0, 0.0], [0.035, 0.002], [0.05, 0.012], [0.072, 0.05], [0.083, 0.09], [0.08, 0.13], [0.066, 0.165], [0.042, 0.19],
    [0.028, 0.21], [0.026, 0.235], [0.031, 0.252], [0.034, 0.258], [0.03, 0.26], [0.024, 0.25], [0.022, 0.23],
  ];
  const g = new THREE.Group();
  g.name = 'jug';
  const body = mesh(kit, potLathe(prof.map(([r, y]) => [r * s, y * s]), seg), clayMaterial(kit, 0xb0654a));
  (body.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  g.add(body);
  // strap handle from the rim to the shoulder
  const hc = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.026, 0.235, 0), new THREE.Vector3(0.07, 0.25, 0), new THREE.Vector3(0.105, 0.2, 0), new THREE.Vector3(0.095, 0.14, 0), new THREE.Vector3(0.075, 0.115, 0),
  ].map((p) => p.multiplyScalar(s)));
  const hg = new THREE.TubeGeometry(hc, 20, 0.009 * s, 6, false);
  hg.scale(1, 1, 1.6);
  g.add(mesh(kit, hg, body.material as THREE.Material));
  // grip = on the handle; move the jug so the handle is at the origin
  const grip = new THREE.Vector3(0.1, 0.17, 0).multiplyScalar(s);
  for (const c of g.children) c.position.sub(grip);
  return g;
}

/** Carinated bowl (with figs / olives or water), held in both hands. Origin at the base centre. */
export function makeBowl(kit: CastPropKit, fill: 'figs' | 'water' = 'figs'): THREE.Group {
  const seg = kit.tier === 'low' ? 16 : 32;
  const prof: [number, number][] = [[0, 0], [0.03, 0.001], [0.05, 0.012], [0.1, 0.045], [0.118, 0.058], [0.12, 0.065], [0.114, 0.068], [0.108, 0.062], [0.09, 0.05], [0.05, 0.024], [0.0, 0.018]];
  const g = new THREE.Group();
  g.name = 'bowl';
  const mat = clayMaterial(kit, 0xa9573c, 0.45);
  mat.side = THREE.DoubleSide;
  g.add(mesh(kit, potLathe(prof, seg), mat));
  if (fill === 'figs') {
    // dried figs / dates heaped in the bowl (1 Sam 25:18 d'velim)
    const fg = new THREE.SphereGeometry(0.017, kit.tier === 'low' ? 6 : 9, kit.tier === 'low' ? 5 : 7);
    fg.scale(1, 0.72, 1);
    const fm = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.7 });
    const n = kit.tier === 'low' ? 9 : 18;
    const im = new THREE.InstancedMesh(track(kit, fg), track(kit, fm), n);
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    let r = 1234567;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, rr = Math.sqrt(rnd()) * 0.075;
      p.set(Math.cos(a) * rr, 0.05 + 0.02 * (1 - rr / 0.075) + rnd() * 0.008, Math.sin(a) * rr);
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
      sc.setScalar(0.85 + rnd() * 0.3);
      im.setMatrixAt(i, new THREE.Matrix4().compose(p, q, sc));
    }
    im.castShadow = true;
    g.add(im);
  } else {
    const wg = new THREE.CircleGeometry(0.1, seg);
    wg.rotateX(-Math.PI / 2);
    wg.translate(0, 0.05, 0);
    g.add(mesh(kit, wg, new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.05, metalness: 0 }), false));
  }
  return g;
}

/** Strung self bow (~1.3 m). Origin at the grip, +Y toward the upper limb, the string on -Z (toward the archer). */
export function makeBow(kit: CastPropKit): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bow';
  const L = 0.66, brace = 0.14;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16 * 2 - 1; // -1..1 lower..upper
    const y = t * L;
    // gentle deflex-reflex: limbs curve away from the string, tips recurve slightly
    const z = -brace + brace * (1 - t * t) * 1.0 + 0.02 * Math.pow(Math.abs(t), 6);
    pts.push(new THREE.Vector3(0, y, z + brace * 0.0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const limbs = new THREE.TubeGeometry(curve, kit.tier === 'low' ? 20 : 40, 0.011, kit.tier === 'low' ? 5 : 8, false);
  // taper toward the tips (scale radius by distance from the grip)
  const pa = limbs.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const y = pa.getY(i);
    const c = curve.getPointAt(THREE.MathUtils.clamp(y / L * 0.5 + 0.5, 0, 1));
    const k = 1 - 0.55 * Math.min(1, Math.abs(y) / L);
    pa.setXYZ(i, c.x + (pa.getX(i) - c.x) * k, y, c.z + (pa.getZ(i) - c.z) * k);
  }
  limbs.computeVertexNormals();
  const woodMat = solidMaterial({ tier: kit.tier, tex: kit.wood, color: 0x6a4a2e, roughness: 0.5, repeat: [1, 4] });
  g.add(mesh(kit, limbs, woodMat));
  // grip wrap
  const wrap = new THREE.CylinderGeometry(0.0135, 0.0135, 0.1, 8);
  wrap.translate(0, 0, pts[8].z);
  g.add(mesh(kit, wrap, solidMaterial({ tier: kit.tier, tex: kit.leather, color: 0x3e2a1c, roughness: 0.7, repeat: [1, 3] })));
  // string (sinew)
  const sg = new THREE.CylinderGeometry(0.0012, 0.0012, 2 * L * 0.985, 4);
  sg.translate(0, 0, pts[0].z + 0.002);
  g.add(mesh(kit, sg, new THREE.MeshStandardMaterial({ color: 0xcbb690, roughness: 0.8 }), false));
  // origin at the grip: shift so the grip centre is at the origin
  for (const c of g.children) c.position.z -= pts[8].z;
  return g;
}

/** Leather quiver with reed arrows (fletching up). Origin at the top of the quiver mouth; +Y along the quiver. */
export function makeQuiver(kit: CastPropKit): THREE.Group {
  const g = new THREE.Group();
  g.name = 'quiver';
  const Lq = 0.62;
  const body = new THREE.CylinderGeometry(0.045, 0.036, Lq, kit.tier === 'low' ? 8 : 14, 1, true);
  body.translate(0, -Lq / 2, 0);
  const lm = solidMaterial({ tier: kit.tier, tex: kit.leather, color: 0x6a4428, roughness: 0.62, repeat: [1, 3], normal: 1.2 });
  lm.side = THREE.DoubleSide;
  g.add(mesh(kit, body, lm));
  const bottom = new THREE.CircleGeometry(0.036, kit.tier === 'low' ? 8 : 14);
  bottom.rotateX(Math.PI / 2);
  bottom.translate(0, -Lq, 0);
  g.add(mesh(kit, bottom, lm));
  // arrow shafts + fletchings
  const n = kit.tier === 'low' ? 5 : 9;
  const shaft = new THREE.CylinderGeometry(0.0035, 0.0035, 0.22, 4);
  shaft.translate(0, 0.02, 0);
  const fl = new THREE.PlaneGeometry(0.012, 0.07);
  fl.translate(0.007, 0.08, 0);
  const sm = new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 0.7 });
  const fm = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9, side: THREE.DoubleSide });
  const shafts = new THREE.InstancedMesh(track(kit, shaft), track(kit, sm), n);
  const fls = new THREE.InstancedMesh(track(kit, fl), track(kit, fm), n * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU * 1.7, r = 0.022 * Math.sqrt((i + 0.5) / n);
    p.set(Math.cos(a) * r, (i % 3) * 0.012, Math.sin(a) * r);
    q.setFromEuler(new THREE.Euler(Math.sin(i) * 0.08, 0, Math.cos(i * 1.3) * 0.08));
    shafts.setMatrixAt(i, m4.compose(p, q, one));
    for (let k = 0; k < 3; k++) {
      const qk = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (k / 3) * TAU + i));
      fls.setMatrixAt(i * 3 + k, m4.compose(p, qk, one));
    }
  }
  shafts.castShadow = fls.castShadow = true;
  g.add(shafts, fls);
  return g;
}

/** A slinger's sling hanging from the hand: two braided cords and the leather cradle with a stone. Origin = hand. */
export function makeHangingSling(kit: CastPropKit, length = 0.5): THREE.Group {
  const g = new THREE.Group();
  g.name = 'sling';
  const pouch = makeSlingPouch(kit.tier, kit.leather);
  pouch.position.set(0, -length, 0.012);
  pouch.rotation.set(0, 0, Math.PI / 2);
  g.add(pouch);
  pouch.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      track(kit, m.geometry);
      track(kit, m.material as THREE.Material);
    }
  });
  const cordMat = track(kit, slingCordMaterial(kit.tier, kit.braid));
  for (const dz of [-0.03, 0.03]) {
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.004, -length * 0.5, dz * 0.4), new THREE.Vector3(0, -length + 0.045, dz * 0.15 + 0.012)];
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), kit.tier === 'low' ? 12 : 30, 0.0028, kit.tier === 'low' ? 4 : 6, false);
    g.add(mesh(kit, tg, cordMat));
  }
  const stone = new THREE.IcosahedronGeometry(0.022, kit.tier === 'low' ? 1 : 2);
  stone.scale(1, 0.8, 0.9);
  const st = mesh(kit, stone, new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.6 }));
  st.position.set(0, -length - 0.01, 0.012);
  g.add(st);
  return g;
}

/**
 * The torn corner of a robe — a prophet's me'il of undyed dark wool (1 Sam 15:27) with its tzitzit and a tekhelet
 * thread (Num 15:38), about 0.36 m long, held pinched in the hand and hanging down in soft folds: the left edge and
 * the bottom edge are the woven hems meeting at the corner (the tzitzit hang from it), the right edge is the tear,
 * frayed. Origin = the pinch point in the fingers; the cloth hangs along -Y (keep the group upright in world space).
 */
export function makeRobeCorner(kit: CastPropKit): { group: THREE.Group; corner: THREE.Object3D } {
  const g = new THREE.Group();
  g.name = 'robeCorner';
  const ns = kit.tier === 'low' ? 14 : 30, na = kit.tier === 'low' ? 12 : 26;
  const Lc = 0.27;
  const pos: number[] = [], uv: number[] = [], gd: number[] = [], idx: number[] = [];
  let r = 91;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  // jagged tear along the right edge
  const jag: number[] = [];
  for (let i = 0; i <= ns; i++) jag.push((rnd() - 0.5) * 0.05 + Math.sin(i * 1.9) * 0.03);
  const width = (sN: number) => 0.018 + 0.15 * Math.pow(sN, 0.75);
  const keep: boolean[] = [];
  for (let i = 0; i <= ns; i++) {
    const sN = i / ns;
    const w = width(sN);
    for (let j = 0; j <= na; j++) {
      const a = (j / na) * 2 - 1; // -1 = left hem .. +1 = torn edge
      const tear = a - (0.82 + jag[i] * (0.4 + sN));
      keep.push(tear < 0.04);
      // folds radiating from the pinch; the weight pulls the lower part straight down
      // deep folds radiating from the pinch (the cloth gathers where the fingers hold it)
      const fold = Math.sin(a * Math.PI * 2.2 + sN * 1.3) * 0.042 * Math.pow(sN, 0.6) + Math.sin(a * 6.3 + 1.3) * 0.01 * sN + 0.02 * Math.sin(sN * 5 + a * 2) * sN;
      const x = a * w * 0.7 + Math.sin(sN * 3.1) * 0.01;
      const y = -sN * Lc * (1 - 0.06 * a * a) - 0.012 * Math.max(0, -a) * sN;
      const z = fold + 0.03 * sN * sN;
      pos.push(x, y, z);
      // cloth-space uv in metres (hem along the left edge and the bottom)
      const u = (a + 1) * 0.5 * w * 2, v = (1 - sN) * Lc;
      uv.push(u, v);
      const tornDist = Math.max(0, -tear) * w;
      gd.push(tornDist, Math.min(u, v), 0.12, 0);
    }
  }
  const row = na + 1;
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < na; j++) {
      const a0 = i * row + j, b0 = a0 + 1, c0 = a0 + row, d0 = c0 + 1;
      if (keep[a0] && keep[b0] && keep[c0]) idx.push(a0, c0, b0);
      if (keep[b0] && keep[d0] && keep[c0]) idx.push(b0, c0, d0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('gdata', new THREE.Float32BufferAttribute(gd, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // undyed dark wool (natural brown-black fleece), a narrow woven band along the hems, fraying at the torn edge
  const cloth = clothMaterial({
    tier: kit.tier, tex: kit.weave, tile: 0.09, dye: 0x6a5846, roughness: 0.92, sheen: 0.6, transmit: 0.3,
    hem: [0.2, 0.04, 0.02, 0.95], edgeMask: [1, 0], palette: [0x4a3c30, 0xb49a78, 0x2b3f8c, 0xd8c08a],
    bands: [{ from: 0.0, to: 0.006, motif: 0, pal: 0, edge: 'upper' }],
  });
  g.add(mesh(kit, geo, cloth));
  // frayed torn edge: loose threads hanging from the tear
  const threads: number[] = [];
  for (let i = 1; i <= ns; i++) {
    for (let k = 0; k < (kit.tier === 'low' ? 1 : 3); k++) {
      const sN = i / ns;
      const a = 0.82 + jag[i] * (0.4 + sN) - 0.02;
      const w = width(sN);
      const x = a * w * 0.7 + Math.sin(sN * 3.1) * 0.01, y = -sN * Lc * (1 - 0.06 * a * a), z = Math.sin(a * Math.PI * 2.2 + sN * 1.3) * 0.03 * Math.pow(sN, 0.6) + 0.03 * sN * sN;
      const len = 0.006 + rnd() * 0.022;
      threads.push(x, y - rnd() * 0.01, z, x + len * (0.3 + rnd() * 0.5), y - len * (0.4 + rnd()), z + (rnd() - 0.5) * len);
    }
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(threads, 3));
  g.add(new THREE.LineSegments(track(kit, tg), track(kit, new THREE.LineBasicMaterial({ color: 0x5a4a3a }))));
  // the corner: bottom-left (a = -1, s = 1)
  const cI = ns * row + 0;
  const corner = new THREE.Object3D();
  corner.name = 'robeCornerTip';
  corner.position.set(pos[cI * 3], pos[cI * 3 + 1] + 0.01, pos[cI * 3 + 2]);
  g.add(corner);
  const white = solidMaterial({ tier: kit.tier, tex: kit.rope, color: 0xe8e0d0, roughness: 0.9, repeat: [1, 80] });
  const blue = solidMaterial({ tier: kit.tier, tex: kit.rope, color: 0x2b3f8c, roughness: 0.85, repeat: [1, 80] });
  const gedil = new THREE.CylinderGeometry(0.0042, 0.0036, 0.04, 8, 8);
  const gp = gedil.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < gp.count; i++) {
    const y = gp.getY(i);
    const k = 1 + 0.2 * Math.abs(Math.sin(y * 480)); // wound ridges
    gp.setXYZ(i, gp.getX(i) * k, y, gp.getZ(i) * k);
  }
  gedil.computeVertexNormals();
  gedil.translate(0, -0.022, 0);
  corner.add(mesh(kit, gedil, white));
  const blueWrap = mesh(kit, new THREE.TorusGeometry(0.0036, 0.001, 4, 10), blue);
  blueWrap.rotation.x = Math.PI / 2;
  blueWrap.position.y = -0.008;
  corner.add(blueWrap);
  // 8 threads (4 cords folded), one of tekhelet, splaying a little and curling as they fall
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.3;
    const len = 0.11 + ((k * 7) % 5) * 0.008;
    const sp = 0.007 + ((k * 3) % 4) * 0.003;
    const pts = [
      new THREE.Vector3(Math.cos(a) * 0.002, -0.04, Math.sin(a) * 0.002),
      new THREE.Vector3(Math.cos(a) * sp * 0.6 + 0.002, -0.04 - len * 0.35, Math.sin(a) * sp * 0.6),
      new THREE.Vector3(Math.cos(a) * sp + 0.005 * Math.sin(k), -0.04 - len * 0.7, Math.sin(a) * sp + 0.003),
      new THREE.Vector3(Math.cos(a) * sp * 1.3 + 0.008 * Math.sin(k * 2.1), -0.04 - len, Math.sin(a) * sp * 1.2 + 0.005),
    ];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0014, 5, false);
    corner.add(mesh(kit, tube, k === 3 ? blue : white));
  }
  track(kit, white);
  track(kit, blue);
  return { group: g, corner };
}
