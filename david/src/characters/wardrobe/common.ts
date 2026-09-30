import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { BodyIndex, C, blendWeights, hull2, makeSkinned, rayPoly } from './body';
import {
  armWeights, bodyTube, fringeStrip, landmarks, legCapsules, merge, partWeights, ribbon, skirtWeights, sleeveTube,
  torsoWeights, tubeAlong, type Fit,
} from './garments';
import { HullField, TAU, makeFrame, noise1, smoothstep, type Tube } from './loft';
import { clothDepthMaterial, clothMaterial, fringeMaterial, solidMaterial, type Band, type TexPair, type Tier } from './materials';
import { Chain, Outfit } from './Outfit';

/*
 * Shared garment recipes for Saul and the men of the court (David has his own hand-tuned recipe in david.ts):
 * a generic fitted tunic (upper + skirt + sleeves), belts / sashes, headbands, headcloths, sandals, gold ornaments.
 */

export async function beginFit(human: HumanModel, name: string, tier: Tier, seed: number): Promise<Fit> {
  const outfit = new Outfit(human, name);
  const body = new BodyIndex(human);
  const lm = landmarks(body);
  return { human, body, tier, lm, outfit, seed };
}

export interface TunicOptions {
  /** 0..1: a stiff skirt (leather-backed armour) follows the pelvis more than the thighs (default 0) */
  skirtStiff?: number;
  tex: TexPair;
  tile: number;
  dye: THREE.ColorRepresentation;
  /** hem height as a fraction between knee (0) and ankle (1); negative = above the knee */
  hem: number;
  /** sleeve length (fraction of the upper arm; >1 continues onto the forearm) */
  sleeve: number;
  neck: 'v' | 'round' | 'slit';
  ease?: number;
  flare?: number;
  folds?: number;
  bands?: Band[];
  sleeveBands?: Band[];
  neckBands?: Band[];
  palette?: THREE.ColorRepresentation[];
  fray?: number;
  fringe?: boolean;
  sheen?: number;
  roughness?: number;
  /** extra radial offset for outer layers */
  offset?: number;
  /** open side slits from the hem up to this height (tabard / four-cornered robe) and slit half-angle */
  sideSlit?: { top: number; half: number };
  sleeveless?: boolean;
  /** rest positions of garments under this one (TunicResult.restPos of the inner layer) */
  inner?: Float32Array[];
  seed: number;
  name: string;
  beltY?: number;
  hide?: boolean;
  dust?: number;
  /**
   * open the upper body at the sides (sleeveless robe / tabard): the lower edge of the bodice rises to `top` (m)
   * round each arm within `half` rad of the side, so the arms (and the sleeves of the garment under it) come out of
   * a clean, finished armhole instead of cutting through the cloth
   */
  armhole?: { half: number; top: number };
  /** extra vertical folds falling from the shoulders (heavy cloth hanging from the shoulder seam) */
  shoulderFolds?: number;
}

export interface TunicResult {
  upper: ReturnType<typeof bodyTube>;
  skirt: ReturnType<typeof bodyTube>;
  hemY: number;
  beltY: number;
  corners: THREE.Vector3[];
  meshes: THREE.Object3D[];
  /** rest positions of every tube of this garment (pass as `inner` to the next layer) */
  restPos: Float32Array[];
}

export function fittedTunic(fit: Fit, o: TunicOptions): TunicResult {
  const { lm, tier, human, outfit } = fit;
  const low = tier === 'low';
  const S = lm.height / 1.75;
  const hipY = (lm.hip.L.y + lm.hip.R.y) / 2;
  const kneeY = (lm.knee.L.y + lm.knee.R.y) / 2;
  const ankY = (lm.ankle.L.y + lm.ankle.R.y) / 2;
  const beltY = o.beltY ?? lm.yWaist - 0.015 * S;
  const hemY = o.hem >= 0 ? kneeY + (ankY + 0.05 * S - kneeY) * o.hem : kneeY - o.hem * 0.25 * S;
  const neckY = lm.neck.y;
  const off = o.offset ?? 0;
  const vDepth = o.neck === 'v' ? 0.1 * S : o.neck === 'slit' ? 0.07 * S : 0.02 * S;
  const vHalf = o.neck === 'v' ? 0.55 : o.neck === 'slit' ? 0.12 : 0.5;
  const neckline = (th: number) => {
    const a = Math.atan2(Math.sin(th), Math.cos(th));
    const front = 0.5 + 0.5 * Math.cos(a);
    const v = Math.max(0, 1 - Math.abs(a) / vHalf);
    return neckY - (0.012 + off * 0.5) * S - 0.03 * S * front - vDepth * (o.neck === 'round' ? Math.sqrt(v) : Math.pow(v, 1.1));
  };
  const cols = low ? 56 : 96;
  const U = outfit.uniforms;
  const rag = noise1(o.seed + 21);
  const hem = (th: number) => hemY + (rag(th * 4.1) - 0.5) * 0.012 * S;
  const upLow0 = beltY - 0.035 * S;
  const ah = o.armhole;
  // lower edge of the bodice: under the belt, rising smoothly into the armhole openings at the sides
  const upLow = (th: number) => {
    if (!ah) return upLow0;
    const d = Math.asin(Math.min(1, Math.abs(Math.cos(th)))); // angular distance from the side (rad)
    const w = 1 - smoothstep(ah.half * 0.55, ah.half, d);
    return upLow0 + (ah.top - upLow0) * w * w * (3 - 2 * w);
  };
  const sf = o.shoulderFolds ?? 0;
  const upper = bodyTube(fit, {
    low: upLow,
    high: neckline,
    mask: C.TORSO | C.NECK,
    armsAbove: lm.yArmpit + 0.012,
    ease: (y) => 0.005 + off + (o.ease ?? 0.008) * smoothstep(lm.yArmpit + 0.07, lm.yArmpit - 0.06, y),
    drape: 0.3,
    sideCling: 3,
    cinch: [beltY, 0.03 * S, 0.004 + off],
    blouse: 0.015,
    folds: {
      amp: (y) => 0.002 + (o.folds ?? 1) * 0.005 * smoothstep(lm.yArmpit, beltY + 0.05, y) + sf * 0.004 * smoothstep(lm.yArmpit + 0.13, lm.yArmpit + 0.02, y),
      k: sf > 0 ? [4, 11] : [7, 17], count: 8, seed: o.seed + 11,
    },
    cols, rows: low ? 36 : 64,
    grime: () => 0.15,
    inner: o.inner,
  });
  const skirt = bodyTube(fit, {
    low: hem, high: () => beltY + 0.035 * S,
    mask: C.TORSO | C.THIGH_L | C.THIGH_R | C.SHIN_L | C.SHIN_R,
    ease: () => 0.012 + off,
    drape: 0.18,
    flare: o.flare ?? 0.16,
    flareFrom: hipY - 0.01,
    cinch: [beltY, 0.03 * S, 0.004 + off],
    folds: { amp: (y) => 0.004 + (o.folds ?? 1) * 0.02 * smoothstep(hipY + 0.03, hemY, y), k: [4, 12], count: 9, seed: o.seed + 5 },
    cols, rows: low ? 26 : 48,
    grime: () => 0.1,
    inner: o.inner,
  });
  const sway = { uniforms: U, length: Math.max(0.3, (beltY - hemY) * 0.6) };
  const common = { tier, tex: o.tex, tile: o.tile, dye: o.dye, roughness: o.roughness ?? 0.9, sheen: o.sheen ?? 0.6, transmit: 0.5 };
  // armhole edges get a narrow woven border in the first palette colour (like the neck and hem bands)
  const upBands = ah && o.palette ? [...(o.neckBands ?? []), { from: 0.0, to: 0.01, motif: 0, pal: 0, edge: 'lower' as const }] : o.neckBands;
  const upMat = clothMaterial({ ...common, bands: upBands, palette: o.palette, hem: [0, 0.1, 0.012, o.fray ?? 0.3], edgeMask: [0, 1], grime: [0.7, 0.62, 0.5, 0.4] });
  // outer layers keep their offset from the inner ones where a leg pushes both out (no z-fighting / white flecks)
  const pad = Math.max(0, off * 0.8);
  const skMat = clothMaterial({ ...common, bands: o.bands, palette: o.palette, hem: [o.dust ?? 0.45, 0.16, 0.015, o.fray ?? 0.3], edgeMask: [1, 0], sway, collide: U, collidePad: pad });
  const meshes: THREE.Object3D[] = [];
  const restPos: Float32Array[] = [upper.tube.pos, skirt.tube.pos];
  let tw = torsoWeights(fit);
  if (ah) {
    // the shoulder cap over the deltoid follows the upper arm like the sleeve under it (no sleeve poking through)
    const aw = partWeights(fit, C.TORSO | C.NECK | C.UPARM_L | C.UPARM_R, 8);
    const t0w = tw;
    tw = (i: number, p: THREE.Vector3) => {
      const side = Math.abs(p.x) / Math.max(1e-6, Math.hypot(p.x, p.z));
      const t = smoothstep(ah.top - 0.03, ah.top + 0.05, p.y) * smoothstep(0.55, 0.9, side) * 0.85;
      return t > 0.01 ? blendWeights(t0w(i, p), aw(i, p), t) : t0w(i, p);
    };
  }
  const up = makeSkinned(human, upper.tube.geometry, upMat, tw, { name: `${o.name}Upper` });
  outfit.add(up);
  meshes.push(up);
  // side slits (four corners): drop skirt quads near θ = ±90° below the slit top
  let skirtGeo = skirt.tube.geometry;
  const corners: THREE.Vector3[] = [];
  if (o.sideSlit) {
    const idx = skirtGeo.getIndex()!;
    const keep: number[] = [];
    const Wc = skirt.tube.cols + 1;
    const cut = (i: number) => {
      const th = skirt.tube.th[i];
      const y = skirt.tube.pos[i * 3 + 1];
      const side = Math.abs(Math.cos(th)) < Math.sin(o.sideSlit!.half);
      return side && y < o.sideSlit!.top;
    };
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      if (cut(a) && cut(b) && cut(c)) continue;
      keep.push(a, b, c);
    }
    skirtGeo = skirtGeo.clone();
    skirtGeo.setIndex(keep);
    // the four corners: hem vertices at the slit edges
    for (const th of [Math.PI / 2 - o.sideSlit.half, Math.PI / 2 + o.sideSlit.half, -Math.PI / 2 + o.sideSlit.half, -Math.PI / 2 - o.sideSlit.half]) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < Wc; c++) {
        const d = Math.abs(Math.atan2(Math.sin(skirt.tube.th[c] - th), Math.cos(skirt.tube.th[c] - th)));
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      corners.push(new THREE.Vector3().fromArray(skirt.tube.pos, best * 3));
    }
  }
  const skGeos = [skirtGeo];
  const mats: THREE.Material[] = [skMat];
  if (o.fringe) {
    skGeos.push(fringeStrip(skirt.tube, 0.018 * S, o.seed + 7, 0.1));
    mats.push(fringeMaterial({ tier, tex: o.tex, dye: o.dye, width: 0.05, sway, collide: U }));
  }
  const sk = makeSkinned(human, skGeos.length > 1 ? merge(skGeos) : skirtGeo, mats.length > 1 ? mats : skMat, skirtWeights(fit, o.skirtStiff ?? 0), { name: `${o.name}Skirt`, depthMaterial: clothDepthMaterial({ sway, collide: U, collidePad: pad }) });
  outfit.add(sk);
  meshes.push(sk);
  if (!o.sleeveless) {
    // both sleeves in one skinned mesh (weights chosen per vertex by side): one draw call instead of two
    const slMat = clothMaterial({ ...common, bands: o.sleeveBands, palette: o.palette, hem: [0, 0.05, 0.012, o.fray ?? 0.3], edgeMask: [1, 0] });
    const geos: THREE.BufferGeometry[] = [];
    for (const [i, side] of (['L', 'R'] as const).entries()) {
      const s = sleeveTube(fit, { side, length: o.sleeve, top: 0.07 * S, easeTop: 0.003 + off, easeEnd: o.sleeve > 1 ? (low ? 0.022 : 0.014) : 0.02, folds: 0.006, cols: low ? 24 : 40, rows: low ? 18 : 28, seed: o.seed + 40 + i, ragged: 0.004 });
      restPos.push(s.tube.pos);
      geos.push(s.tube.geometry);
    }
    const wL = armWeights(fit, 'L', o.sleeve > 1), wR = armWeights(fit, 'R', o.sleeve > 1);
    const m = makeSkinned(human, merge(geos, false), slMat, (i, p) => (p.x > 0 ? wL(i, p) : wR(i, p)), { name: `${o.name}Sleeves` });
    outfit.add(m);
    meshes.push(m);
  }
  if (o.hide !== false) {
    human.hideSkin((p, bone) => {
      if (/^(wrist|finger|metacarpal|head|jaw|eye|foot|toe)/.test(bone)) return false;
      if (/^lowerarm/.test(bone)) return o.sleeve > 1.3 && p.y > (p.x > 0 ? lm.elbow.L.y : lm.elbow.R.y) - 0.05;
      if (/^(upperarm|shoulder)/.test(bone)) {
        const sh = p.x > 0 ? lm.shoulder.L : lm.shoulder.R;
        const el = p.x > 0 ? lm.elbow.L : lm.elbow.R;
        return (sh.y - p.y) / (sh.y - el.y) < Math.min(o.sleeve, 1) - 0.18;
      }
      if (/^lowerleg/.test(bone)) return p.y > hemY + 0.08 && !o.sideSlit;
      const th = Math.atan2(p.x, p.z);
      return p.y < neckline(th) - 0.03 && p.y > hemY + 0.08 && !(o.sideSlit && p.y < o.sideSlit.top && Math.abs(p.x) > 0.08);
    });
  }
  return { upper, skirt, hemY, beltY, corners, meshes, restPos };
}

/** A belt / sash band around the waist over the garment (flat band + optional hanging ends). */
export function beltBand(fit: Fit, t: TunicResult, o: { width: number; thickness: number; material: THREE.Material; offset?: number; name: string }) {
  const { tier, human, outfit } = fit;
  const low = tier === 'low';
  const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
  const N = low ? 60 : 120;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU;
    const r = t.upper.R(t.beltY, th) + o.thickness * 0.5 + 0.002 + (o.offset ?? 0);
    const p = t.upper.field.point(t.beltY, th, r);
    pts.push(p);
    nrm.push(new THREE.Vector3(Math.sin(th), 0, Math.cos(th)));
  }
  const g = ribbon(pts, nrm, o.width, o.thickness, { closed: true });
  // ribbon(): width along w = t x n (vertical here) -> fine; uv.y = along
  const m = makeSkinned(human, g, o.material, partWeights(fit, C.TORSO, 8), { name: o.name });
  outfit.add(m);
  return m;
}

/** Headband / fillet / diadem ring around the head at crown height (rigid on the crownAnchor socket). */
export function headRing(fit: Fit, o: { height: number; thickness: number; material: THREE.Material; lift?: number; tilt?: number; extra?: number; ornament?: THREE.Material }) {
  const { human, tier } = fit;
  const low = tier === 'low';
  const [rx, rz] = human.metrics.crownRadius;
  const ex = o.extra ?? 0.008;
  const N = low ? 40 : 80;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  // closed band: outer, top, inner, bottom faces (4 x 2 verts per step)
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    const nx = c / (rx + ex), nz = s / (rz + ex);
    const nl = Math.hypot(nx, nz);
    const ox = c * (rx + ex), oz = s * (rz + ex);
    const tiltY = (o.tilt ?? 0) * -s; // lower at the front (+z) when tilt > 0
    const y0 = (o.lift ?? 0) + tiltY - o.height / 2, y1 = y0 + o.height;
    const tt = o.thickness;
    const inX = ox - (nx / nl) * tt, inZ = oz - (nz / nl) * tt;
    // outer
    pos.push(ox, y0, oz, ox, y1, oz, inX, y1, inZ, inX, y0, inZ);
    nor.push(nx / nl, 0, nz / nl, nx / nl, 0.3, nz / nl, -nx / nl, 0, -nz / nl, -nx / nl, 0, -nz / nl);
    const u = i / N;
    uv.push(u * 6, 0, u * 6, 1, u * 6, 1, u * 6, 0);
    if (i < N) {
      const k = i * 4;
      for (const [p, q] of [[0, 1], [1, 2], [2, 3], [3, 0]]) idx.push(k + p, k + 4 + p, k + q, k + q, k + 4 + p, k + 4 + q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, o.material);
  m.castShadow = true;
  m.name = 'headRing';
  human.sockets.crownAnchor.add(m);
  fit.outfit.add(m);
  return { mesh: m, rx: rx + ex, rz: rz + ex };
}

/** Hang a group of tzitzit (white wool strings + one tekhelet thread) from rest-space corner points. */
export function tzitzit(
  fit: Fit,
  corners: THREE.Vector3[],
  o: { white: THREE.Material; blue: THREE.Material; fringe: THREE.Material; length: number; batch?: { material: THREE.Material; white: THREE.ColorRepresentation; blue: THREE.ColorRepresentation } },
) {
  const { human, tier, outfit, lm } = fit;
  const low = tier === 'low';
  const all: Chain[] = [];
  const cw = o.batch ? new THREE.Color(o.batch.white) : undefined, cb = o.batch ? new THREE.Color(o.batch.blue) : undefined;
  corners.forEach((c, i) => {
    const bone = c.x > 0 ? 'upperleg01.L' : 'upperleg01.R';
    const sock = human.addSocket(`wardrobeTzitzit${i}`, bone, c.clone().add(new THREE.Vector3(0, -0.004, 0)));
    const white = new Chain(sock, o.length, low ? 5 : 8, 0.0032, [o.white, o.fringe], { radial: low ? 3 : 5, tassel: { length: o.length * 0.45, cards: 2 }, initialDir: new THREE.Vector3(0, -1, 0), color: cw });
    const blue = new Chain(sock, o.length * 0.92, low ? 5 : 8, 0.0014, o.blue, { radial: 3, initialDir: new THREE.Vector3(0.05, -1, 0.02), color: cb });
    all.push(white, blue);
  });
  // all 4 corners (8 strings + tassels) in one mesh: 2 draw calls instead of 12
  if (o.batch) outfit.addChainBatch(all, [o.batch.material, o.fringe], 'tzitzit');
  else for (const ch of all) outfit.addChain(ch);
  void lm;
}

/** Leather sandals (sole + criss-cross thongs). */
export function sandals(fit: Fit, leather: TexPair, o: { color?: number; wraps?: number; height?: number } = {}): THREE.Group {
  const { body, lm, tier, human } = fit;
  const low = tier === 'low';
  const S = lm.height / 1.75;
  const grp = new THREE.Group();
  grp.name = 'sandals';
  // one material + one skinned mesh for both sandals (soles and straps told apart by vertex colour, UVs pre-scaled)
  const mat = solidMaterial({ tier, tex: leather, color: 0xffffff, roughness: 0.66, repeat: [1, 1], normal: 1.1 });
  mat.vertexColors = true;
  const soleCol = new THREE.Color(0x5e3f28), strapCol = new THREE.Color(o.color ?? 0x4f321f);
  const all: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, col: THREE.Color, su: number, sv: number) => {
    const n = (g.getAttribute('position') as THREE.BufferAttribute).count;
    const ca = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) col.toArray(ca, v * 3);
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (uv) for (let v = 0; v < uv.count; v++) uv.setXY(v, uv.getX(v) * su, uv.getY(v) * sv);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    all.push(g);
  };
  const wFoot = { L: partWeights(fit, C.FOOT_L, 6), R: partWeights(fit, C.FOOT_R, 6) };
  const wLeg = { L: partWeights(fit, C.SHIN_L | C.FOOT_L, 6), R: partWeights(fit, C.SHIN_R | C.FOOT_R, 6) };
  const ankY = Math.max(lm.ankle.L.y, lm.ankle.R.y);
  for (const s of ['L', 'R'] as const) {
    const footMask = s === 'L' ? C.FOOT_L : C.FOOT_R;
    const pts: number[] = [];
    for (let i = 0; i < body.n; i++) {
      if (!(body.cls[i] & footMask) || body.pos[i * 3 + 1] > 0.028 * S) continue;
      pts.push(body.pos[i * 3], body.pos[i * 3 + 2]);
    }
    const h = hull2(pts);
    const hn = h.length / 2;
    let cx = 0, cz = 0;
    for (let i = 0; i < hn; i++) {
      cx += h[i * 2] / hn;
      cz += h[i * 2 + 1] / hn;
    }
    const nOut = low ? 24 : 40;
    const outline: [number, number][] = [];
    for (let i = 0; i < nOut; i++) {
      const a = (i / nOut) * TAU;
      const d = rayPoly(h, cx, cz, Math.cos(a), Math.sin(a));
      outline.push([cx + Math.cos(a) * (d + 0.005), cz + Math.sin(a) * (d + 0.005)]);
    }
    const yTop = 0.0025, yBot = -0.0095;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const ring = (y: number) => {
      const base = pos.length / 3;
      for (const [x, z] of outline) {
        pos.push(x, y, z);
        uv.push(x * 4, z * 4);
      }
      return base;
    };
    const r0 = ring(yTop), r1 = ring(yBot);
    for (let i = 0; i < nOut; i++) {
      const i1 = (i + 1) % nOut;
      idx.push(r0 + i, r1 + i, r0 + i1, r0 + i1, r1 + i, r1 + i1);
    }
    const cT = pos.length / 3;
    pos.push(cx, yTop, cz);
    uv.push(0, 0);
    const cB = pos.length / 3;
    pos.push(cx, yBot, cz);
    uv.push(0, 0);
    for (let i = 0; i < nOut; i++) {
      const i1 = (i + 1) % nOut;
      idx.push(cT, r0 + i1, r0 + i);
      idx.push(cB, r1 + i, r1 + i1);
    }
    const sole = new THREE.BufferGeometry();
    sole.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sole.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    sole.setIndex(idx);
    sole.computeVertexNormals();
    paint(sole, soleCol, 6, 6);
    const ank = lm.ankle[s];
    const legMask = (s === 'L' ? C.SHIN_L : C.SHIN_R) | footMask;
    const F = new HullField(body, makeFrame(new THREE.Vector3(ank.x, 0, ank.z - 0.01), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)), legMask, 0.01, ank.y + 0.2 * S, 0.004, 64, 0.006, 2);
    const geos: THREE.BufferGeometry[] = [];
    const y0 = ank.y - 0.018 * S, y1 = ank.y + (o.height ?? 0.09) * S;
    const turns = o.wraps ?? 1.75;
    for (const dir of [1, -1]) {
      const p: THREE.Vector3[] = [], n: THREE.Vector3[] = [];
      const N = low ? 36 : 72;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const th = Math.PI + dir * u * turns * TAU;
        const y = y0 + (y1 - y0) * u;
        const q = F.point(y, th, F.radius(y, th) + 0.0028);
        p.push(q);
        n.push(q.clone().sub(F.point(y, th, 0)).setY(0).normalize());
      }
      geos.push(ribbon(p, n, 0.01 * S, 0.0022));
    }
    let zmin = Infinity, zmax = -Infinity;
    for (const [, z] of outline) {
      zmin = Math.min(zmin, z);
      zmax = Math.max(zmax, z);
    }
    const bandZ = zmin + (zmax - zmin) * 0.66;
    const FF = new HullField(body, makeFrame(new THREE.Vector3(cx, 0, bandZ - 0.05), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)), footMask, 0.0, 0.1, 0.004, 64, 0.006, 1);
    {
      const p: THREE.Vector3[] = [], n: THREE.Vector3[] = [];
      const N = low ? 16 : 28;
      for (let i = 0; i <= N; i++) {
        const th = -Math.PI * 0.62 + (i / N) * Math.PI * 1.24;
        const q = FF.point(0.05, th, FF.radius(0.05, th) + 0.0028);
        if (q.y < yTop + 0.002) q.y = yTop + 0.002;
        p.push(q);
        n.push(q.clone().sub(FF.point(0.05, th, 0)).normalize());
      }
      geos.push(ribbon(p, n, 0.016 * S, 0.0022));
    }
    paint(merge(geos, false), strapCol, 2, 30);
    void legMask;
  }
  // soles take the foot's weights only (never the shin), straps above the foot the shin's too
  grp.add(makeSkinned(human, merge(all, false), mat, (i, p) => {
    const s = p.x > 0 ? 'L' : 'R';
    return p.y < 0.012 ? wFoot[s](i, p) : wLeg[s](i, p);
  }, { name: 'sandals' }));
  void ankY;
  human.root.add(grp);
  fit.outfit.add(grp);
  fit.outfit.groundOffset = 0.009;
  return grp;
}

/** Hang a rigid accessory (sword / dagger, +Y toward the hilt) from the belt at angle th. */
export function hangFromBelt(fit: Fit, t: TunicResult, obj: THREE.Object3D, o: { th: number; out: number; drop: number; forward: number; bone: string; name: string }) {
  const outward = new THREE.Vector3(Math.sin(o.th), 0, Math.cos(o.th));
  const p = t.upper.field.point(t.beltY - o.drop, o.th, t.upper.R(t.beltY, o.th) + o.out);
  const tangent = new THREE.Vector3(0, 1, 0).cross(outward).normalize(); // toward the front at the left hip
  const Y = new THREE.Vector3(0, 1, 0).multiplyScalar(0.9).addScaledVector(tangent, o.forward).normalize();
  const X = new THREE.Vector3().crossVectors(Y, outward).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  const sock = fit.human.addSocket(o.name, o.bone, p, q);
  sock.add(obj);
  fit.outfit.add(obj);
  return sock;
}

/** Rigid ring (armlet / bracelet) around a limb at fraction t between two joints. */
export function limbRing(fit: Fit, o: { side: 'L' | 'R'; from: string; to: string; t: number; bone: string; mask: number; width: number; thickness: number; clearance: number; material: THREE.Material; ridges?: number }) {
  const { body, human, tier } = fit;
  const a = body.joint(`${o.from}.${o.side}`), b = body.joint(`${o.to}.${o.side}`);
  const axis = a.clone().sub(b).normalize();
  const F = new HullField(body, makeFrame(a, axis, new THREE.Vector3(0, 0, 1)), o.mask, -a.distanceTo(b) * o.t - 0.03, -a.distanceTo(b) * o.t + 0.03, 0.005, 48, 0.008, 2);
  const s0 = -a.distanceTo(b) * o.t;
  const N = tier === 'low' ? 32 : 64;
  const rows = o.ridges ?? 6;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const f = r / rows;
    const s = s0 + (f - 0.5) * o.width;
    const bulge = Math.sin(Math.PI * f) * o.thickness + (o.ridges ? 0.0008 * Math.cos(f * Math.PI * o.ridges * 2) : 0);
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU;
      const R = F.radius(s0, th) + o.clearance + bulge;
      const p = F.point(s, th, R);
      pos.push(p.x, p.y, p.z);
      uv.push(i / N * 4, f);
      if (r < rows && i < N) {
        const k = r * (N + 1) + i;
        idx.push(k, k + 1, k + N + 1, k + 1, k + N + 2, k + N + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = makeSkinned(human, g, o.material, () => new Map([[body.boneIndex[o.bone], 1]]), { name: 'limbRing' });
  fit.outfit.add(m);
  return m;
}

export { tubeAlong, legCapsules, partWeights, type Tube, smoothstep };
