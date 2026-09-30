import * as THREE from 'three';
import { makeSkinned } from './body';
import { C } from './body';
import { blendWeights } from './body';
import { partWeights, skirtWeights, tubeSurface, type Fit } from './garments';
import { rng, TAU, type Tube } from './loft';
import { solidMaterial, type TexPair, type Tier } from './materials';
import type { Prop } from './Outfit';
import { mergeStatic } from './props';
import type { TunicResult } from './common';

/*
 * Props and armour of the opening film (docs/visual-bible.md 2, 3.2, 3.4, 3.9). All procedural, no assets.
 *
 *   scaleArmour(fit, coat, o)   שִׁרְיוֹן קַשְׂקַשִּׂים (1 Sam 17:5, 17:38): real geometry — bronze scales ≈6 × 3 cm with a
 *                               rounded lower end and a raised central rib, laced in horizontal rows on the coat backing,
 *                               each row overlapping the one below (pointing down, like roof tiles), rows staggered;
 *                               skinned to the body. [ARCH] Nuzi / Megiddo / Lachish scales, Egyptian depictions.
 *   makeHelmet(tier, metal, leather, o)   קוֹבַע נְחֹשֶׁת: a plain hammered bronze skull-cap, rounded / slightly conical
 *                               with a small knob, rolled rim, rivets for the leather lining. No crest, plume, horns,
 *                               nasal bar (bible 3.2 MUST-NOT). Philistine variant: a low transverse ridge (3.9).
 *   makeBow / makeQuiver        Benjaminite archers (1 Chr 12:2): a simple / composite bow, a leather quiver of reed arrows.
 *   makeAxe                     farm iron in use (13:20-21).
 *   makeRamHorn                 the shofar (13:3): a plain natural ram's horn, short, curved, amber-brown (never kudu).
 *   makeFeatherCrown            Philistine rank and file: the "reed / feather" headdress of Medinet Habu (3.9).
 *   makeGreaves                 מִצְחַת נְחֹשֶׁת (17:6) — Philistine elite only, never Saul.
 *   makeBedroll                 a mantle rolled and tied across the back (3.4).
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function frameAt(parent: THREE.Object3D, name: string, pos: THREE.Vector3, up: THREE.Vector3) {
  const f = new THREE.Object3D();
  f.name = name;
  f.position.copy(pos);
  f.quaternion.setFromUnitVectors(V(0, 1, 0), up.clone().normalize());
  parent.add(f);
  return f;
}

/** a tapered tube along a polyline (radius per point) */
function tube(pts: THREE.Vector3[], radius: (t: number) => number, radial: number, closeEnds = true) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = Math.max(4, pts.length * 3);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = radius(t);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      pos.push(c.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), c.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), c.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z));
      uv.push(j / radial, t);
      if (i < segs && j < radial) {
        const k = i * (radial + 1) + j;
        idx.push(k, k + radial + 1, k + 1, k + 1, k + radial + 1, k + radial + 2);
      }
    }
  }
  if (closeEnds) {
    for (const [i, flip] of [[0, true], [segs, false]] as const) {
      const c = curve.getPointAt(i / segs);
      const ci = pos.length / 3;
      pos.push(c.x, c.y, c.z);
      uv.push(0.5, i / segs);
      for (let j = 0; j < radial; j++) {
        const k = i * (radial + 1) + j;
        if (flip) idx.push(ci, k + 1, k);
        else idx.push(ci, k, k + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ================================================================================================ SCALE ARMOUR
export interface ScaleArmourOptions {
  metal: TexPair;
  /** scale size (m) before the body-height scale */
  width?: number;
  length?: number;
  /** vertical distance between rows (m): < length = overlap */
  row?: number;
  /** horizontal spacing of the scales in a row as a fraction of their width (< 1 = they overlap sideways; default 0.97) */
  side?: number;
  /** polished royal bronze (Saul) or dull field bronze (Philistines) */
  polish?: 'royal' | 'field';
  seed?: number;
  /** skip scales below this height on the coat skirt (m, rest) */
  hemY?: number;
}

/**
 * Bronze scales on the coat `coat` (fittedTunic result used as the leather backing). Returns the skinned mesh
 * (one draw call).
 *
 * models pass (CUT v2) — the coat read as cardboard / feathers (big flat scales, a dark band at the top of every
 * scale, rows splaying off the body, dark gaps in the skirt). Now, for Saul: many small scales (≈2.5 × 4.8 cm at his
 * height) laced in rows that overlap by half their length and sideways by a third, each lying almost flat on the
 * backing (lower end lifted 3 mm, one edge 1 mm — consistent roof-tile layering, so no backing shows and nothing
 * z-fights), the visible part carrying the rib, the rolled lower edge and the hammer marks (shared detail maps), a
 * thin contact shadow under the edge of the row above instead of a dark band, and per-scale facets so the coat
 * sparkles like beaten metal. Cost for Saul: high ≈ 2,300 scales × 24 tris ≈ 55 k tris, medium × 12, low (bigger
 * scales) × 4.
 */
export function scaleArmour(fit: Fit, coat: TunicResult, o: ScaleArmourOptions & { skirtStiff?: number }): THREE.SkinnedMesh {
  const { lm, tier, human } = fit;
  const low = tier === 'low';
  const med = tier === 'medium';
  const S = lm.height / 1.75;
  const W = (o.width ?? 0.03) * S, L = (o.length ?? 0.058) * S, ROW = (o.row ?? 0.036) * S;
  const SIDE = o.side ?? 0.97;
  const R = rng(o.seed ?? 17);
  // grid per scale: columns across (nu) and the rows' v stations (the upper part is hidden under the row above, so the
  // vertices go where the scale shows: its lower part, the rolled end)
  const nu = low ? 1 : med ? 2 : 3;
  const vs = low ? [0, 0.5, 1] : med ? [0, 0.5, 0.78, 1] : [0, 0.42, 0.62, 0.8, 0.93, 1];
  const nv = vs.length - 1;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const zone: number[] = []; // 0 upper (torso / shoulder), 1 skirt
  const royal = (o.polish ?? 'royal') === 'royal';
  const base = new THREE.Color(1, 1, 1);
  // verdigris in the crevices, relative to the bronze F0 (the vertex colour multiplies the material colour)
  const bronzeHex = royal ? 0xb8773c : 0x8c5e33;
  const bc = new THREE.Color(bronzeHex);
  const patina = new THREE.Color(0x56745b).multiply(new THREE.Color(1 / bc.r, 1 / bc.g, 1 / bc.b)).multiplyScalar(0.8);
  // (metal: the vertex colour scales F0, so road dust must darken and desaturate it, never brighten it)
  const dust = new THREE.Color(0.55, 0.42, 0.3);
  const c = new THREE.Color();
  const tmpT = new THREE.Vector3(), tmpD = new THREE.Vector3(), q = new THREE.Vector3(), nn = new THREE.Vector3();
  const overlap = Math.max(0, 1 - ROW / L); // hidden fraction of each scale (under the row above)
  const tilt = (royal ? 0.003 : 0.0035) * S; // the lower end sits on the row below
  const edge = 0.001 * S; // sideways layering: each scale's left edge rests on its right-hand neighbour
  const place = (t: Tube, zoneId: number, dStart: number, maxLen: (th: number) => number, rowOffset: number) => {
    // column length per th (distance from the top edge of the tube to its lower edge)
    const gd = t.geometry.getAttribute('gdata') as THREE.BufferAttribute;
    const Wc = t.cols + 1;
    const colLenRaw = (th: number) => {
      const th0 = t.th[0];
      const f = ((((th - th0) / TAU) % 1) + 1) % 1 * t.cols;
      const c0 = Math.floor(f) % t.cols;
      // row 0 is the lower edge (largest distance from the top edge)
      return Math.min(Math.max(gd.getY(c0), gd.getY((t.rows - 1) * Wc + c0)), Math.max(gd.getY(c0 + 1), gd.getY((t.rows - 1) * Wc + c0 + 1)), maxLen(th));
    };
    // the skirt of the coat hangs level from the belt: rows all the way round
    let skirtLen = 0;
    if (zoneId === 1) for (let k = 0; k < 96; k++) skirtLen = Math.max(skirtLen, colLenRaw((k / 96) * TAU));
    const colLen = (th: number) => (zoneId === 1 ? Math.min(skirtLen, maxLen(th)) : colLenRaw(th));
    let rowI = 0;
    for (let d = dStart; ; d += ROW, rowI++) {
      // circumference at this row
      let circ = 0;
      let prev: THREE.Vector3 | null = null;
      let any = false;
      for (let k = 0; k <= 64; k++) {
        const th = (k / 64) * TAU;
        if (colLen(th) < d + 0.01) {
          prev = null;
          continue;
        }
        any = true;
        const p = tubeSurface(t, th, d).p;
        if (prev) circ += p.distanceTo(prev);
        prev = p;
      }
      if (!any) break;
      const n = Math.max(8, Math.round(circ / (W * SIDE)));
      const stagger = ((rowI + rowOffset) % 2) * 0.5;
      // the last rows of the skirt catch more dust; the top rows near the neck edging a little less
      for (let k = 0; k < n; k++) {
        const th = ((k + stagger + (R() - 0.5) * 0.06) / n) * TAU;
        if (colLen(th) < d + L * 0.55) continue; // no scale hanging below the backing / into the armhole
        const s0 = tubeSurface(t, th, d);
        const s1 = tubeSurface(t, th + 0.01, d);
        const s2 = tubeSurface(t, th, d + 0.01);
        tmpT.copy(s1.p).sub(s0.p).normalize(); // across (around the body)
        tmpD.copy(s2.p).sub(s0.p).normalize(); // down the body
        const nrm = s0.n.clone();
        // hand-made scales: each sits a little differently on its lacing — a small twist, a facet, a dent, a darker
        // replaced scale here and there; the variation is what makes rows of scales sparkle like beaten metal
        const tone = (0.82 + 0.3 * R()) * (R() < 0.06 ? 0.7 : 1);
        const pat = Math.pow(R(), 4) * (royal ? 0.35 : 0.7);
        const tl = tilt * (0.8 + 0.4 * R());
        const rot = (R() - 0.5) * 0.08;
        const dnT = (R() - 0.5) * 0.36, dnD = (R() - 0.5) * 0.28; // facet: the whole scale catches light differently
        const ca = Math.cos(rot), sa = Math.sin(rot);
        const vi0 = pos.length / 3;
        for (let j = 0; j <= nv; j++) {
          const v = vs[j]; // 0 = top (laced, hidden), 1 = rounded lower end
          // a long rounded-end rectangle like the Iron Age scales from Lachish / Nuzi, not a pointed leaf
          const halfW = v < 0.74 ? 0.5 : 0.5 * (0.42 + 0.58 * Math.sqrt(Math.max(0, 1 - ((v - 0.74) / 0.26) ** 2)));
          for (let i = 0; i <= nu; i++) {
            const u = (i / nu - 0.5) * 2; // -1..1
            const x = u * halfW * W;
            const y = v * L;
            const xr = x * ca - y * sa * 0.2, yr = y + x * sa * 0.2;
            // lies almost flat: the lower end lifted onto the row below, the left edge (u = -1) resting on the
            // neighbour, a slight cup across and the repoussé rib (the rest of the relief is in the normal map)
            const cup = 0.0006 * S * (1 - u * u);
            const lift = tl * v + edge * (0.5 - 0.5 * u) + cup + 0.0006 * S * Math.max(0, 1 - Math.abs(u) * 2.4) * Math.sin(Math.PI * v);
            q.copy(s0.p).addScaledVector(tmpT, xr).addScaledVector(tmpD, yr).addScaledVector(nrm, lift + 0.0016 + (zoneId === 1 ? 0.0025 : 0));
            pos.push(q.x, q.y, q.z);
            // normal: the base normal tilted by the lift slope (down), the cup (across) and the scale's facet
            const nx = -u * 0.12 + dnT - edge / W;
            const ny = -tl / L + dnD;
            nn.copy(nrm).addScaledVector(tmpT, nx).addScaledVector(tmpD, ny).normalize();
            nor.push(nn.x, nn.y, nn.z);
            uv.push(0.5 + u * halfW, v);
            // colour: a thin contact shadow just below the edge of the row above (not a dark band), dust packed along
            // that line, verdigris only deep in the crevices, a burnished lower edge
            const below = v - overlap; // 0 at the overlap line
            const ao = below < 0 ? 0.55 : 0.62 + 0.38 * Math.min(1, below / 0.18);
            c.copy(base).lerp(patina, pat * (below < 0.12 ? 1 : 0.25)).multiplyScalar(tone * ao);
            c.lerp(dust, (royal ? 0.3 : 0.4) * Math.max(0, 1 - Math.abs(below - 0.04) / 0.12) + (zoneId === 1 ? 0.06 : 0.02));
            col.push(c.r, c.g, c.b);
            zone.push(zoneId);
          }
        }
        for (let j = 0; j < nv; j++) {
          for (let i = 0; i < nu; i++) {
            const a = vi0 + j * (nu + 1) + i;
            idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
          }
        }
      }
    }
  };
  const upperT = coat.upper.tube, skirtT = coat.skirt.tube;
  // upper: from just under the neck edge to the belt; skirt: from the belt to the hem
  place(upperT, 0, 0.012 * S, () => 9, 0);
  place(skirtT, 1, 0.02 * S, () => 9, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  // full metal driven by the per-scale detail map (every scale has uv 0..1): hammered dimples, the raised rib and
  // the rolled edge in the normal map; roughness / metalness maps put packed road dust (rough, non-metal) along the
  // overlap line and keep the rib and the lower edge burnished (sharp highlights)
  const maps = scaleDetailMaps();
  const mat = new THREE.MeshStandardMaterial({
    color: royal ? 0xc08448 : 0x9a6a40, roughness: royal ? 1.0 : 1.15, metalness: 1, envMapIntensity: 0.85,
    normalMap: maps.normal, normalScale: new THREE.Vector2(1, 1), roughnessMap: maps.orm, metalnessMap: maps.orm,
  });
  mat.name = 'wardrobe:scaleBronze';
  // the environment the coat reflects is mostly pale sky: through the facets (grazing Fresnel) it turned scales
  // silver-lilac. Warm the reflected environment (dust-laden air, the sunlit plain the lower facets see) so the coat
  // stays bronze in every shot; the direct sun highlight is untouched.
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.indirectSpecular *= vec3(1.0, 0.7, 0.42);',
    );
  };
  mat.customProgramCacheKey = () => 'scaleBronze2';
  mat.vertexColors = true;
  mat.side = THREE.DoubleSide;
  // weights: upper zone follows the torso, and near the shoulders blends into the upper arm (like the armhole cap)
  const tw = partWeights(fit, C.TORSO | C.NECK, 8);
  const aw = partWeights(fit, C.TORSO | C.NECK | C.UPARM_L | C.UPARM_R, 8);
  const sw = skirtWeights(fit, o.skirtStiff ?? 0);
  const w = (i: number, p: THREE.Vector3) => {
    if (zone[i] === 1) return sw(i, p);
    const side = Math.abs(p.x) / Math.max(1e-6, Math.hypot(p.x, p.z));
    const t = THREE.MathUtils.smoothstep(p.y, lm.yArmpit - 0.02, lm.yArmpit + 0.08) * THREE.MathUtils.smoothstep(side, 0.55, 0.9) * 0.85;
    return t > 0.01 ? blendWeights(tw(i, p), aw(i, p), t) : tw(i, p);
  };
  const m = makeSkinned(human, g, mat, w, { name: 'scaleArmour' });
  // makeSkinned rebuilds the geometry without vertex colours: carry them over (same vertex order)
  m.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  m.userData.scales = idx.length / (nu * nv * 6);
  fit.outfit.add(m);
  return m;
}

let _scaleMaps: { normal: THREE.DataTexture; orm: THREE.DataTexture } | null = null;
/**
 * Shared 64² detail maps for one bronze scale (uv u across, v down from the lacing). CPU DataTextures: they survive
 * a context loss (three re-uploads them), cost 32 KB, and are shared by every scale coat (Saul, Philistine elites).
 * orm: g = roughness factor, b = metalness factor (three's channels).
 * models pass: the visible lower half carries the relief (raised rib, rolled rounded end, hammer marks); the dust sits
 * in a narrow band at the overlap line (v ≈ 0.5), the exposed metal is polished (roughness ≈ 0.28-0.42).
 */
export function scaleDetailMaps(): { normal: THREE.DataTexture; orm: THREE.DataTexture } {
  if (_scaleMaps) return _scaleMaps;
  const N = 64;
  const R = rng(911);
  const h = new Float32Array(N * N);
  const dimples: [number, number, number, number][] = [];
  for (let k = 0; k < 30; k++) dimples.push([0.08 + 0.84 * R(), 0.35 + 0.62 * R(), 0.05 + 0.07 * R(), 0.2 + 0.3 * R()]);
  const halfW = (v: number) => (v < 0.74 ? 0.5 : 0.5 * (0.42 + 0.58 * Math.sqrt(Math.max(0, 1 - ((v - 0.74) / 0.26) ** 2))));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N, v = (y + 0.5) / N;
      // distance from the outline (the uv follows the rounded outline: u in [0.5 - halfW, 0.5 + halfW])
      const hw = halfW(v);
      const ax = Math.min(1, Math.abs(u - 0.5) / Math.max(0.05, hw));
      // raised rib down the middle (repoussé), fading at the lacing and before the tip
      let z = 0.8 * Math.exp(-(((u - 0.5) / (0.07 * hw * 2)) ** 2)) * THREE.MathUtils.smoothstep(v, 0.2, 0.45) * (1 - THREE.MathUtils.smoothstep(v, 0.86, 0.97));
      // gently domed across, rolled / bevelled edges bending back toward the backing (catch a bright rim)
      z += 0.25 * (1 - ax * ax);
      z -= 0.9 * THREE.MathUtils.smoothstep(ax, 0.78, 1.0) + 0.7 * THREE.MathUtils.smoothstep(v, 0.9, 1.0);
      // hammer marks
      for (const [cx, cy, r, d] of dimples) {
        const qq = ((u - cx) ** 2 + (v - cy) ** 2) / (r * r);
        if (qq < 1) z -= d * (1 - qq) * (1 - qq);
      }
      // lacing holes near the top (hidden under the row above)
      for (const cx of [0.32, 0.68]) {
        const qq = ((u - cx) ** 2 + (v - 0.1) ** 2) / 0.0016;
        if (qq < 1) z -= 1.2 * (1 - qq);
      }
      h[y * N + x] = z;
    }
  }
  const nrm = new Uint8Array(new ArrayBuffer(N * N * 4)), orm = new Uint8Array(new ArrayBuffer(N * N * 4));
  const H = (x: number, y: number) => h[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const dx = (H(x + 1, y) - H(x - 1, y)) * N * 0.02, dy = (H(x, y + 1) - H(x, y - 1)) * N * 0.02;
      const l = Math.hypot(dx, dy, 1);
      nrm[i] = Math.round((-dx / l) * 127.5 + 127.5);
      nrm[i + 1] = Math.round((-dy / l) * 127.5 + 127.5);
      nrm[i + 2] = Math.round((1 / l) * 127.5 + 127.5);
      nrm[i + 3] = 255;
      const u = (x + 0.5) / N, v = (y + 0.5) / N;
      // dust packed along the overlap line (v ≈ 0.45-0.58) and in the hammer marks; burnished rib and lower edge
      const dustBand = Math.exp(-(((v - 0.5) / 0.07) ** 2)) + (1 - THREE.MathUtils.smoothstep(v, 0.3, 0.45)) * 0.8;
      const pit = Math.max(0, -H(x, y) - 0.1) * 0.35;
      const rib = Math.exp(-(((u - 0.5) / 0.08) ** 2)) * THREE.MathUtils.smoothstep(v, 0.45, 0.65);
      const rim = THREE.MathUtils.smoothstep(v, 0.9, 0.98);
      const rough = THREE.MathUtils.clamp(0.3 + 0.45 * dustBand + 0.2 * pit - 0.1 * rib - 0.08 * rim + 0.08 * (R() - 0.5), 0.18, 0.95);
      const metal = THREE.MathUtils.clamp(1 - 0.6 * dustBand - 0.25 * pit, 0.3, 1);
      orm[i] = 255;
      orm[i + 1] = Math.round(rough * 255);
      orm[i + 2] = Math.round(metal * 255);
      orm[i + 3] = 255;
    }
  }
  const mk = (d: Uint8Array<ArrayBuffer>, name: string) => {
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
    t.name = name;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  _scaleMaps = { normal: mk(nrm, 'scaleNormal'), orm: mk(orm, 'scaleORM') };
  return _scaleMaps;
}

// ================================================================================================ HELMET
/**
 * Bronze skull-cap (+Y up, origin at the centre of the rim, opening toward −Y). `ridge` adds the low transverse
 * ridge of the Philistine type. `radius` = [x, z] inner half-axes at the rim.
 */
export function makeHelmet(tier: Tier, metal: TexPair, leather: TexPair, o: { radius?: [number, number]; height?: number; ridge?: boolean; polish?: 'royal' | 'field'; seed?: number } = {}): THREE.Group {
  const [rx, rz] = o.radius ?? [0.098, 0.112];
  const H = o.height ?? 0.135;
  const low = tier === 'low';
  const royal = (o.polish ?? 'royal') === 'royal';
  const g = new THREE.Group();
  g.name = 'helmet';
  const R = rng(o.seed ?? 5);
  // profile: rounded to slightly conical, a small knob at the crown
  const rows = low ? 10 : 24, seg = low ? 20 : 48;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const dent: [number, number, number][] = [];
  for (let k = 0; k < 7; k++) dent.push([R() * TAU, 0.2 + 0.6 * R(), 0.001 + 0.002 * R()]);
  for (let i = 0; i <= rows; i++) {
    const t = i / rows; // 0 rim .. 1 crown
    const phi = t * Math.PI / 2;
    // superellipse-ish dome, a touch pointed at the top
    const rr = Math.cos(phi) ** 0.85;
    const y = H * (Math.sin(phi) ** 1.1) * (0.92 + 0.08 * t);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      let d = 0;
      for (const [da, dt, dd] of dent) d -= dd * Math.exp(-((Math.atan2(Math.sin(a - da), Math.cos(a - da)) / 0.25) ** 2) - ((t - dt) / 0.12) ** 2);
      const sx = (rx + 0.004 + d) * rr, sz = (rz + 0.004 + d) * rr;
      pos.push(Math.sin(a) * sx, y, Math.cos(a) * sz);
      uv.push(j / seg * 3, t * 1.5);
      if (i < rows && j < seg) {
        const k = i * (seg + 1) + j;
        idx.push(k, k + 1, k + seg + 1, k + 1, k + seg + 2, k + seg + 1);
      }
    }
  }
  const dome = new THREE.BufferGeometry();
  dome.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  dome.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  dome.setIndex(idx);
  dome.computeVertexNormals();
  const bronze = solidMaterial({
    // dusty, hammered dark bronze after a campaign (a smooth bright dome read as a glowing ball in the backlight)
    tier, tex: metal, color: royal ? 0x523420 : 0x6e4a2c, roughness: royal ? 0.74 : 0.7, metalness: 0.85, repeat: [2, 2], normal: 1.8,
    metalWear: { patina: 0x56745b, amount: royal ? 0.2 : 0.5, edgeBright: 0.3 },
  });
  bronze.side = THREE.DoubleSide;
  const dm = new THREE.Mesh(dome, bronze);
  g.add(dm);
  // knob at the crown
  const knob = new THREE.SphereGeometry(0.011, low ? 8 : 14, low ? 5 : 8);
  knob.scale(1, 0.8, 1);
  knob.translate(0, H + 0.004, 0);
  g.add(new THREE.Mesh(knob, bronze));
  // rolled rim band
  const rimPts: THREE.Vector3[] = [];
  for (let j = 0; j < seg; j++) {
    const a = (j / seg) * TAU;
    rimPts.push(V(Math.sin(a) * (rx + 0.0055), 0.002, Math.cos(a) * (rz + 0.0055)));
  }
  const rim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), seg, 0.0045, low ? 5 : 8, true);
  g.add(new THREE.Mesh(rim, bronze));
  // rivets for the lining (a ring 2 cm above the rim)
  if (!low) {
    const rv: THREE.BufferGeometry[] = [];
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * TAU;
      const t = 0.17;
      const rr = Math.cos(t * Math.PI / 2) ** 0.85;
      const s = new THREE.SphereGeometry(0.0032, 6, 4, 0, TAU, 0, Math.PI / 2);
      s.rotateX(Math.PI / 2);
      const n = V(Math.sin(a) / (rx * rx), 0, Math.cos(a) / (rz * rz)).normalize();
      s.lookAt(n);
      s.translate(Math.sin(a) * (rx + 0.004) * rr, H * Math.sin(t * Math.PI / 2) ** 1.1, Math.cos(a) * (rz + 0.004) * rr);
      rv.push(s);
    }
    const merged = rv.length ? rv.reduce((acc, cur) => {
      return acc ? mergeTwo(acc, cur) : cur;
    }) : null;
    if (merged) g.add(new THREE.Mesh(merged, bronze));
  }
  if (o.ridge) {
    // a low transverse ridge over the crown, ear to ear (Philistine elite)
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = -Math.PI / 2 + (k / 16) * Math.PI;
      const phi = Math.abs(a);
      pts.push(V(Math.sin(a) * rx * 0.98, H * Math.cos(phi) ** 0.9 + 0.006, 0));
    }
    g.add(new THREE.Mesh(tube(pts, () => 0.006, low ? 5 : 8), bronze));
  }
  // leather lining inside
  const lin = solidMaterial({ tier, tex: leather, color: 0x3a2618, roughness: 0.7, repeat: [2, 2] });
  const inner = dome.clone();
  inner.scale(0.95, 0.95, 0.95);
  const lm = new THREE.Mesh(inner, lin);
  lin.side = THREE.BackSide;
  g.add(lm);
  g.traverse((ch) => ((ch as THREE.Mesh).isMesh ? ((ch as THREE.Mesh).castShadow = true) : null));
  mergeStatic(g);
  return g;
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const na = a.getAttribute('position').count;
  const pos = new Float32Array([...(a.getAttribute('position').array as Float32Array), ...(b.getAttribute('position').array as Float32Array)]);
  const nor = new Float32Array([...(a.getAttribute('normal').array as Float32Array), ...(b.getAttribute('normal').array as Float32Array)]);
  const uv = new Float32Array([...(a.getAttribute('uv').array as Float32Array), ...(b.getAttribute('uv').array as Float32Array)]);
  const ia = a.getIndex()!.array, ib = b.getIndex()!.array;
  const idx = new Uint32Array(ia.length + ib.length);
  idx.set(ia);
  for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + na;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ================================================================================================ BOW, QUIVER, AXE, HORN
/** Simple composite bow, +Y along the bow (grip at the origin), the string on −Z. Prop for handGripL. */
export function makeBow(tier: Tier, wood: TexPair, o: { length?: number; seed?: number } = {}): Prop {
  const L = o.length ?? 1.25;
  const g = new THREE.Group();
  g.name = 'bow';
  const low = tier === 'low';
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12 - 0.5;
    // gentle reflex with recurved tips
    const z = 0.07 * (1 - (2 * t) ** 2) - 0.03 * Math.max(0, Math.abs(2 * t) - 0.8) * 5;
    pts.push(V(0, t * L, z));
  }
  const limb = tube(pts, (t) => 0.011 * (1 - 0.55 * Math.abs(2 * t - 1)) + 0.004, low ? 5 : 8);
  const woodMat = solidMaterial({ tier, tex: wood, color: 0x6a4a2c, roughness: 0.5, repeat: [1, 6] });
  g.add(new THREE.Mesh(limb, woodMat));
  const str = tube([pts[0].clone().add(V(0, 0.01, 0)), V(0, 0, -0.01), pts[12].clone().add(V(0, -0.01, 0))], () => 0.0012, 3, false);
  const cord = solidMaterial({ tier, color: 0xcdbf9f, roughness: 0.8 });
  g.add(new THREE.Mesh(str, cord));
  g.traverse((ch) => ((ch as THREE.Mesh).isMesh ? ((ch as THREE.Mesh).castShadow = true) : null));
  mergeStatic(g);
  const grip = frameAt(g, 'grip', V(0, 0, 0.07), V(0, 1, 0));
  const tip = frameAt(g, 'tip', V(0, L / 2, 0), V(0, 1, 0));
  const butt = frameAt(g, 'butt', V(0, -L / 2, 0), V(0, -1, 0));
  g.userData.radiusAtGrip = 0.016;
  return { object: g, grip, tip, butt };
}

/** Leather quiver with reed arrows (+Y toward the opening). Hang it on the back (see dressSoldier). */
export function makeQuiver(tier: Tier, leather: TexPair, wood: TexPair, o: { arrows?: number; seed?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'quiver';
  const low = tier === 'low';
  const R = rng(o.seed ?? 9);
  const body = new THREE.CylinderGeometry(0.045, 0.036, 0.62, low ? 8 : 14, 1, true);
  body.translate(0, 0.31, 0);
  const lm = solidMaterial({ tier, tex: leather, color: 0x5a3a22, roughness: 0.55, repeat: [1, 3] });
  lm.side = THREE.DoubleSide;
  g.add(new THREE.Mesh(body, lm));
  const bottom = new THREE.CircleGeometry(0.036, low ? 8 : 14);
  bottom.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(bottom, lm));
  const reed = solidMaterial({ tier, tex: wood, color: 0xc2a878, roughness: 0.6, repeat: [1, 4] });
  const fl = solidMaterial({ tier, color: 0x5c554c, roughness: 0.9 });
  fl.side = THREE.DoubleSide;
  const n = o.arrows ?? (low ? 5 : 11);
  for (let k = 0; k < n; k++) {
    const a = R() * TAU, r = R() * 0.028;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const top = 0.66 + R() * 0.06;
    const sh = new THREE.CylinderGeometry(0.0035, 0.0035, top - 0.1, 4, 1);
    sh.translate(x, 0.1 + (top - 0.1) / 2, z);
    g.add(new THREE.Mesh(sh, reed));
    if (!low) {
      for (let f = 0; f < 3; f++) {
        const fa = (f / 3) * TAU + R();
        const p = new THREE.PlaneGeometry(0.012, 0.08);
        p.translate(0.008, 0, 0);
        p.rotateY(fa);
        p.translate(x, top - 0.05, z);
        g.add(new THREE.Mesh(p, fl));
      }
    }
  }
  g.traverse((ch) => ((ch as THREE.Mesh).isMesh ? ((ch as THREE.Mesh).castShadow = true) : null));
  mergeStatic(g);
  return g;
}

/** A work axe / war axe: wooden haft, socketed iron head. Prop (+Y along the haft toward the head). */
export function makeAxe(tier: Tier, wood: TexPair, metal: TexPair): Prop {
  const g = new THREE.Group();
  g.name = 'axe';
  const low = tier === 'low';
  const haft = new THREE.CylinderGeometry(0.014, 0.016, 0.7, low ? 6 : 10);
  haft.translate(0, 0.35, 0);
  const wm = solidMaterial({ tier, tex: wood, color: 0x8a6a4a, roughness: 0.6, repeat: [1, 3] });
  g.add(new THREE.Mesh(haft, wm));
  const iron = solidMaterial({ tier, tex: metal, color: 0x4b4a48, roughness: 0.55, metalness: 1, repeat: [1, 1], metalWear: { patina: 0x6b3f25, amount: 0.5, edgeBright: 0.8 } });
  const shape = new THREE.Shape();
  shape.moveTo(-0.02, -0.025);
  shape.lineTo(0.02, -0.025);
  shape.quadraticCurveTo(0.09, -0.04, 0.13, -0.06);
  shape.lineTo(0.13, 0.05);
  shape.quadraticCurveTo(0.09, 0.03, 0.02, 0.025);
  shape.lineTo(-0.02, 0.025);
  shape.lineTo(-0.02, -0.025);
  const head = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: low ? 3 : 6 });
  head.translate(0, 0, -0.006);
  head.translate(0, 0.64, 0);
  g.add(new THREE.Mesh(head, iron));
  g.traverse((ch) => ((ch as THREE.Mesh).isMesh ? ((ch as THREE.Mesh).castShadow = true) : null));
  mergeStatic(g);
  const grip = frameAt(g, 'grip', V(0, 0.18, 0), V(0, 1, 0));
  const tip = frameAt(g, 'tip', V(0, 0.7, 0), V(0, 1, 0));
  const butt = frameAt(g, 'butt', V(0, 0, 0), V(0, -1, 0));
  g.userData.radiusAtGrip = 0.015;
  return { object: g, grip, tip, butt };
}

/** A plain natural ram's horn (shofar, 1 Sam 13:3): ≈40 cm, curved, amber-brown. Prop: +Y toward the bell. */
export function makeRamHorn(tier: Tier): Prop {
  const g = new THREE.Group();
  g.name = 'shofar';
  const low = tier === 'low';
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    const a = t * 1.9;
    pts.push(V(0.16 * (1 - Math.cos(a)) * 0.9, 0.16 * Math.sin(a) + t * 0.08, 0.03 * Math.sin(t * Math.PI)));
  }
  const geo = tube(pts, (t) => 0.007 + 0.03 * t ** 1.6, low ? 7 : 14, false);
  const horn = new THREE.MeshStandardMaterial({ color: 0x9a6a38, roughness: 0.38, metalness: 0 });
  horn.side = THREE.DoubleSide;
  // amber-brown with darker growth rings
  const cols: number[] = [];
  const p = geo.getAttribute('position');
  const uvA = geo.getAttribute('uv');
  const c0 = new THREE.Color(0x7a4f28), c1 = new THREE.Color(0xc79a5c), cc = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = uvA.getY(i);
    cc.copy(c0).lerp(c1, 0.3 + 0.5 * t).multiplyScalar(0.85 + 0.15 * Math.sin(t * 90));
    cols.push(cc.r, cc.g, cc.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  horn.vertexColors = true;
  horn.color.set(0xffffff);
  g.add(new THREE.Mesh(geo, horn));
  g.traverse((ch) => ((ch as THREE.Mesh).isMesh ? ((ch as THREE.Mesh).castShadow = true) : null));
  const grip = frameAt(g, 'grip', pts[3].clone(), pts[4].clone().sub(pts[2]));
  const tip = frameAt(g, 'tip', pts[10].clone(), pts[10].clone().sub(pts[9]));
  const butt = frameAt(g, 'butt', pts[0].clone(), pts[0].clone().sub(pts[1]));
  return { object: g, grip, tip, butt };
}

/**
 * Philistine reed / feather crown (Medinet Habu): a band with a ring of upright strips; rigid on crownAnchor.
 * `rx`, `rz` = band radii (human.metrics.crownRadius + clearance).
 */
export function makeFeatherCrown(tier: Tier, rx: number, rz: number, o: { seed?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'featherCrown';
  const low = tier === 'low';
  const R = rng(o.seed ?? 3);
  const n = low ? 28 : 56;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + R() * 0.02;
    const cx = Math.sin(a) * rx, cz = Math.cos(a) * rz;
    const out = V(Math.sin(a) / rx, 0, Math.cos(a) / rz).normalize();
    const side = V(out.z, 0, -out.x);
    const h = 0.13 + 0.03 * R();
    const w = 0.011;
    const flare = 0.25 + 0.1 * R();
    const b = pos.length / 3;
    for (let j = 0; j <= 3; j++) {
      const t = j / 3;
      const cxx = cx + out.x * flare * h * t * t, czz = cz + out.z * flare * h * t * t;
      const ww = w * (1 - 0.35 * t);
      pos.push(cxx - side.x * ww, t * h, czz - side.z * ww, cxx + side.x * ww, t * h, czz + side.z * ww);
      nor.push(out.x, 0.1, out.z, out.x, 0.1, out.z);
      uv.push(0, t, 1, t);
      if (j < 3) idx.push(b + j * 2, b + j * 2 + 1, b + j * 2 + 2, b + j * 2 + 1, b + j * 2 + 3, b + j * 2 + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const reed = new THREE.MeshStandardMaterial({ color: 0xd9c89a, roughness: 0.85, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, reed);
  m.castShadow = true;
  g.add(m);
  // the band: a dark leather strip with a zig-zag of bronze studs
  const band = new THREE.CylinderGeometry(1, 1, 0.028, low ? 24 : 48, 1, true);
  band.scale(rx + 0.002, 1, rz + 0.002);
  band.translate(0, 0.004, 0);
  const bm = new THREE.MeshStandardMaterial({ color: 0x6b4526, roughness: 0.6, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(band, bm));
  return g;
}

/** Bronze greaves for one shin (rigid shell, +Y up the shin, +Z = front); radius ≈ shin half-width + clearance. */
export function makeGreave(tier: Tier, metal: TexPair, o: { length?: number; radius?: number } = {}): THREE.Mesh {
  const L = o.length ?? 0.3, r = o.radius ?? 0.055;
  const low = tier === 'low';
  const geo = new THREE.CylinderGeometry(r, r * 0.8, L, low ? 10 : 20, low ? 3 : 8, true, -Math.PI * 0.62, Math.PI * 1.24);
  // bulge at the calf
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / L + 0.5;
    const s = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, y * 1.3));
    p.setX(i, p.getX(i) * s);
    p.setZ(i, p.getZ(i) * s);
  }
  geo.computeVertexNormals();
  const mat = solidMaterial({ tier, tex: metal, color: 0x8c5e33, roughness: 0.42, metalness: 1, repeat: [1, 2], metalWear: { patina: 0x56745b, amount: 0.5, edgeBright: 0.8 } });
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.name = 'greave';
  return m;
}

/** A mantle rolled and tied (bedroll), lying diagonally across the back. Local +X along the roll. */
export function makeBedroll(tier: Tier, tex: TexPair, dye: THREE.ColorRepresentation): THREE.Mesh {
  const low = tier === 'low';
  const pts = [V(-0.3, 0, 0), V(0, 0.01, 0.015), V(0.3, 0, 0)];
  const geo = tube(pts, (t) => 0.05 * (0.85 + 0.15 * Math.sin(t * Math.PI)), low ? 8 : 14);
  const mat = solidMaterial({ tier, tex, color: dye, roughness: 0.95, repeat: [4, 2] });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.name = 'bedroll';
  return m;
}
