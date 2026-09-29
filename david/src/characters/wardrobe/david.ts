import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { BodyIndex, C } from './body';
import {
  armWeights, bodyTube, fringeStrip, landmarks, legCapsules, merge, partWeights, projectOnto, ribbon, skirtWeights,
  sleeveTube, torsoWeights, tubeAlong, tubeSurface, tubeUV, type Fit,
} from './garments';
import { HullField, TAU, makeFrame, noise1, rng, smoothstep } from './loft';
import { makeSkinned } from './body';
import { clothDepthMaterial, clothMaterial, fringeMaterial, solidMaterial, texPair, type Tier } from './materials';
import { Chain, Outfit, Pendulum } from './Outfit';
import { makeSlingPouch, makeStaff, slingCordMaterial } from './props';

/*
 * David son of Jesse as a shepherd (1 Sam 16:11-12, 17:34-40), after the reference still:
 *   - kuttonet: coarse, loosely woven undyed wool tunic (oatmeal, open grid weave), short sleeves ending above the
 *     elbow, frayed V-neck with a rough whip-stitched edge, small holes / tears, knee length with a ragged hem and a
 *     slightly longer frayed under-layer.  WOOL ONLY (no linen in the same garment: sha'atnez, Deut 22:11); a closed
 *     tunic has no corners, so it carries no tzitzit.
 *   - a sash of twisted rust-brown and tan wool cords wound three times round the waist, knotted in front, long
 *     cords hanging to the knee with frayed ends (verlet chains).
 *   - kli ha-ro'im / yalqut (1 Sam 17:40): leather-and-woven satchel at the LEFT hip on a leather strap over the
 *     LEFT shoulder, bulging with the five smooth stones, flap with laced edge (pendulum sway).
 *   - leather sandals: sole + forefoot strap + thongs wrapped criss-cross round the ankle.
 *   - props (not attached): maqel (gnarled staff, 1.75 m), qela' (sling: leather cradle + braided cord material).
 */

export interface DressOptions {
  quality: Tier;
  seed?: number;
}

export async function dressDavid(human: HumanModel, opts: DressOptions): Promise<Outfit> {
  const t0 = performance.now();
  const tier = opts.quality;
  const low = tier === 'low';
  const [coarse, medium, fringeT, leather, rope, braid, wood, bark] = await Promise.all([
    texPair('weave_coarse', tier), texPair('weave_medium', tier), texPair('fringe', tier), texPair('leather', tier),
    texPair('rope', tier), texPair('braid', tier), texPair('wood', tier), texPair('bark', tier),
  ]);
  const outfit = new Outfit(human, 'david');
  const body = new BodyIndex(human);
  const lm = landmarks(body);
  const fit: Fit = { human, body, tier, lm, outfit, seed: opts.seed ?? 1 };
  const U = outfit.uniforms;
  const S = lm.height / 1.75;
  const hipY = (lm.hip.L.y + lm.hip.R.y) / 2;
  const kneeY = (lm.knee.L.y + lm.knee.R.y) / 2;
  const beltY = lm.yWaist - 0.015 * S;
  const hemY = kneeY + 0.03 * S;
  const underHemY = kneeY - 0.012 * S;
  const neckY = lm.neck.y;
  outfit.capsules.push(...legCapsules(fit, 0.012, 0.05));

  // ---------------------------------------------------------------- grime (armpits, neck, back sweat)
  const pitL = new THREE.Vector3(lm.shoulder.L.x - 0.055 * S, lm.yArmpit, lm.shoulder.L.z - 0.01);
  const pitR = new THREE.Vector3(lm.shoulder.R.x + 0.055 * S, lm.yArmpit, lm.shoulder.R.z - 0.01);
  const nape = new THREE.Vector3(0, neckY - 0.03, lm.neck.z - 0.07);
  const grime = (p: THREE.Vector3) => {
    const g = (c: THREE.Vector3, r: number) => Math.exp(-p.distanceToSquared(c) / (r * r));
    return Math.min(1, 0.85 * g(pitL, 0.07) + 0.85 * g(pitR, 0.07) + 0.45 * g(nape, 0.09) + 0.12);
  };

  // ---------------------------------------------------------------- tunic: upper body (neck .. under the sash)
  const vDepth = 0.12 * S, vHalf = 0.62;
  const neckline = (th: number) => {
    const a = Math.atan2(Math.sin(th), Math.cos(th));
    const front = 0.5 + 0.5 * Math.cos(a);
    const v = Math.max(0, 1 - Math.abs(a) / vHalf);
    return neckY - 0.014 * S - 0.028 * S * front - vDepth * Math.pow(v, 1.15);
  };
  const cols = low ? 64 : 104, rowsUp = low ? 40 : 72;
  const upper = bodyTube(fit, {
    low: () => beltY - 0.035 * S,
    high: neckline,
    mask: C.TORSO | C.NECK,
    armsAbove: lm.yArmpit + 0.012,
    ease: (y) => 0.0055 + 0.0085 * smoothstep(lm.yArmpit + 0.07, lm.yArmpit - 0.06, y),
    drape: 0.3,
    sideCling: 3,
    cinch: [beltY, 0.028 * S, 0.0045],
    blouse: 0.02,
    folds: { amp: (y) => 0.0022 + 0.0065 * smoothstep(lm.yArmpit, beltY + 0.05, y), k: [7, 17], count: 8, seed: 11 },
    cols, rows: rowsUp, grime,
  });
  // ---------------------------------------------------------------- tunic: skirt (under the sash .. knee) + under-layer
  const rag = noise1(21), rag2 = noise1(33);
  const hem = (th: number) => hemY + (rag(th * 4.1) - 0.5) * 0.028 * S + (rag(th * 13) - 0.5) * 0.008;
  const underHem = (th: number) => underHemY + (rag2(th * 3.3) - 0.5) * 0.03 * S + (rag2(th * 17) - 0.5) * 0.01;
  const skirtSpec = {
    mask: C.TORSO | C.THIGH_L | C.THIGH_R,
    ease: () => 0.012,
    drape: 0.18,
    flare: 0.2,
    flareFrom: hipY - 0.01,
    cinch: [beltY, 0.028 * S, 0.0045] as [number, number, number],
    folds: { amp: (y: number) => 0.005 + 0.024 * smoothstep(hipY + 0.03, hemY, y), k: [4, 11] as [number, number], count: 9, seed: 5 },
    cols, rows: low ? 26 : 44, grime: () => 0.1,
  };
  const skirt = bodyTube(fit, { ...skirtSpec, low: hem, high: () => beltY + 0.035 * S });
  const under = bodyTube(fit, { ...skirtSpec, low: underHem, high: () => hemY + 0.09 * S, offset: -0.0045, rows: low ? 10 : 16 });

  // ---------------------------------------------------------------- sleeves
  const sleeves = (['L', 'R'] as const).map((side, i) =>
    sleeveTube(fit, { side, length: 0.56, top: 0.07 * S, easeTop: 0.003, easeEnd: 0.022, folds: 0.008, cols: low ? 28 : 44, rows: low ? 14 : 26, seed: 40 + i, ragged: 0.01 }),
  );

  // ---------------------------------------------------------------- materials
  const swayCfg = { uniforms: U, length: 0.32 * S };
  const holesUp: [number, number, number, number][] = [
    [...tubeUV(upper.tube, 0.48, lm.yArmpit - 0.045), 0.011, 1.4],
    [...tubeUV(upper.tube, -0.95, beltY + 0.11), 0.006, 1.0],
  ];
  const holesSkirt: [number, number, number, number][] = [
    [...tubeUV(skirt.tube, -0.62, hipY - 0.1), 0.014, 1.2],
    [...tubeUV(skirt.tube, 0.35, hemY + 0.09), 0.009, 0.8],
    [...tubeUV(skirt.tube, 2.7, hemY + 0.17), 0.012, 1.3],
  ];
  const oat = 0xeadcc4;
  const tunicUp = clothMaterial({ tier, tex: coarse, tile: 0.36, dye: oat, roughness: 0.93, sheen: 0.55, normal: 1.1, grime: [0.62, 0.52, 0.4, 0.75], hem: [0, 0.1, 0.022, 0.75], edgeMask: [0, 1], holes: holesUp, transmit: 1.1 });
  const tunicSk = clothMaterial({ tier, tex: coarse, tile: 0.36, dye: oat, roughness: 0.93, sheen: 0.55, normal: 1.1, grime: [0.6, 0.5, 0.38, 0.5], hem: [0.75, 0.2, 0.03, 0.85], edgeMask: [1, 0], holes: holesSkirt, sway: swayCfg, collide: U, transmit: 1.1 });
  const underMat = clothMaterial({ tier, tex: medium, tile: 0.1, dye: 0xe6d3a8, roughness: 0.95, sheen: 0.5, hem: [0.85, 0.12, 0.03, 0.9], edgeMask: [1, 0], sway: swayCfg, collide: U, transmit: 1.0 });
  const sleeveMat = clothMaterial({ tier, tex: coarse, tile: 0.36, dye: oat, roughness: 0.93, sheen: 0.55, normal: 1.1, grime: [0.62, 0.52, 0.4, 0.6], hem: [0.15, 0.06, 0.022, 0.8], edgeMask: [1, 0], transmit: 1.2 });
  const fringeMat = fringeMaterial({ tier, tex: fringeT, dye: 0xd9ccb2, width: 0.05, sway: swayCfg, collide: U, dust: 0.5 });
  const fringeMatUnder = fringeMaterial({ tier, tex: fringeT, dye: 0xc9b58c, width: 0.045, sway: swayCfg, collide: U, dust: 0.55 });
  const fringeMatArm = fringeMaterial({ tier, tex: fringeT, dye: 0xd9ccb2, width: 0.05 });
  const depthSkirt = clothDepthMaterial({ sway: swayCfg, collide: U });

  // ---------------------------------------------------------------- skinned meshes
  const tw = torsoWeights(fit);
  // neckline: rough whip-stitched rolled edge (a thin twisted cord along the upper edge)
  const W = upper.tube.cols + 1;
  const edgePts: THREE.Vector3[] = [];
  for (let c = 0; c < W - 1; c++) {
    const i = (upper.tube.rows - 1) * W + c, j = (upper.tube.rows - 2) * W + c;
    const p = new THREE.Vector3().fromArray(upper.tube.pos, i * 3);
    const q = new THREE.Vector3().fromArray(upper.tube.pos, j * 3);
    const out = p.clone().setY(0).normalize();
    edgePts.push(p.addScaledVector(p.clone().sub(q).normalize(), -0.002).addScaledVector(out, 0.0025));
  }
  const neckEdge = tubeAlong(edgePts, 0.0034, low ? 4 : 6, { closed: true, twist: 260, uScale: 1 });
  const ropeMatNeck = solidMaterial({ tier, tex: rope, color: 0xd6c7a6, roughness: 0.95, repeat: [1, 1 / 0.012], normal: 1.2 });
  const upGeo = merge([upper.tube.geometry, neckEdge]);
  const upMesh = makeSkinned(human, upGeo, [tunicUp, ropeMatNeck], tw, { name: 'tunicUpper' });
  outfit.add(upMesh);
  const sw = skirtWeights(fit);
  const skirtGeo = merge([skirt.tube.geometry, fringeStrip(skirt.tube, 0.024 * S, 7, 0.1)]);
  const skMesh = makeSkinned(human, skirtGeo, [tunicSk, fringeMat], sw, { name: 'tunicSkirt', depthMaterial: depthSkirt });
  outfit.add(skMesh);
  const underGeo = merge([under.tube.geometry, fringeStrip(under.tube, 0.032 * S, 9, 0.05)]);
  const unMesh = makeSkinned(human, underGeo, [underMat, fringeMatUnder], sw, { name: 'tunicUnder', depthMaterial: depthSkirt, castShadow: !low });
  outfit.add(unMesh);
  for (const [i, s] of sleeves.entries()) {
    const side = i === 0 ? 'L' : 'R';
    const g = merge([s.tube.geometry, fringeStrip(s.tube, 0.016 * S, 50 + i, 0.2)]);
    const m = makeSkinned(human, g, [sleeveMat, fringeMatArm], armWeights(fit, side), { name: `sleeve${side}` });
    outfit.add(m);
  }

  // ---------------------------------------------------------------- hide covered skin
  const hideTop = neckline;
  human.hideSkin((p, bone) => {
    if (/^(wrist|finger|metacarpal|lowerarm|head|jaw|eye|foot|toe|lowerleg)/.test(bone)) return false;
    // torso under the tunic (below the neckline, above the hem), keep a margin at the edges
    const th = Math.atan2(p.x, p.z);
    if (/^(upperarm|shoulder)/.test(bone)) {
      const side = p.x > 0 ? lm.shoulder.L : lm.shoulder.R;
      const el = p.x > 0 ? lm.elbow.L : lm.elbow.R;
      const t = (side.y - p.y) / (side.y - el.y);
      return t < 0.4;
    }
    return p.y < hideTop(th) - 0.03 && p.y > hemY + 0.06 && !/^upperleg/.test(bone) ? true : /^upperleg/.test(bone) ? p.y > hemY + 0.12 && p.y < hipY : false;
  });

  // ---------------------------------------------------------------- sash: three twisted wraps + knot + hanging cords
  const rust = new THREE.Color(0x7c3a1d), tan = new THREE.Color(0xb48a55);
  const sashGeos: THREE.BufferGeometry[] = [];
  const ringR = (th: number) => upper.R(beltY, th);
  const wraps = low ? 2 : 3;
  const rc = 0.0046 * S; // strand radius
  const cordR = rc * 2.1;
  for (let k = 0; k < wraps; k++) {
    const dy = (k - (wraps - 1) / 2) * cordR * 1.55;
    const tilt = (k - 1) * 0.006;
    const ph = k * 1.9;
    for (let sIdx = 0; sIdx < 2; sIdx++) {
      const pts: THREE.Vector3[] = [];
      const N = low ? 120 : 220;
      for (let i = 0; i < N; i++) {
        const th = (i / N) * TAU;
        const r = ringR(th) + cordR * 0.95;
        const tau = th * 26 + sIdx * Math.PI + ph;
        const y = beltY + dy + tilt * Math.cos(th - 0.3) + Math.sin(tau) * rc * 0.95;
        const rr = r + Math.cos(tau) * rc * 0.95;
        pts.push(upper.field.point(y, th, rr));
      }
      const g = tubeAlong(pts, rc, low ? 4 : 6, { closed: true, uScale: 1 });
      const col = sIdx === 0 ? rust : tan;
      const n = (g.getAttribute('position') as THREE.BufferAttribute).count;
      const ca = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) col.toArray(ca, v * 3);
      g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      sashGeos.push(g);
    }
  }
  // knot (front, a little to his left)
  const knotTh = 0.26;
  const knotBase = upper.field.point(beltY - 0.004, knotTh, ringR(knotTh) + cordR * 2.2);
  const outDir = new THREE.Vector3(Math.sin(knotTh), 0, Math.cos(knotTh));
  for (let sIdx = 0; sIdx < 2; sIdx++) {
    const kg = new THREE.TorusKnotGeometry(0.0135 * S, rc * 1.05, low ? 40 : 72, low ? 4 : 6, 2, 3);
    kg.scale(1, 1.1, 0.55);
    kg.rotateZ(sIdx * 0.9 + 0.3);
    kg.lookAt(outDir);
    kg.translate(knotBase.x, knotBase.y, knotBase.z);
    kg.deleteAttribute('normal');
    kg.computeVertexNormals();
    const n = (kg.getAttribute('position') as THREE.BufferAttribute).count;
    const ca = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) (sIdx === 0 ? rust : tan).toArray(ca, v * 3);
    kg.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    const uvs = kg.getAttribute('uv') as THREE.BufferAttribute;
    for (let v = 0; v < n; v++) uvs.setXY(v, uvs.getY(v), uvs.getX(v) * 0.5);
    sashGeos.push(kg);
  }
  const sashMat = solidMaterial({ tier, tex: rope, color: 0xffffff, roughness: 0.88, repeat: [1, 1 / 0.025], normal: 1.3 });
  sashMat.vertexColors = true;
  const sashMesh = makeSkinned(human, merge(sashGeos, false), sashMat, partWeights(fit, C.TORSO, 8), { name: 'sash' });
  outfit.add(sashMesh);
  // hanging cords (verlet) with frayed tassels
  const knotSock = human.addSocket('wardrobeKnot', 'spine05', knotBase.clone().addScaledVector(outDir, 0.004).add(new THREE.Vector3(0, -0.012, 0)));
  const cordMat = solidMaterial({ tier, tex: rope, color: 0xffffff, roughness: 0.9, repeat: [1, 1 / 0.02], normal: 1.4 });
  cordMat.vertexColors = true;
  const tasselMat = fringeMaterial({ tier, tex: fringeT, dye: 0xa0764a, width: 0.03 });
  const cords = low ? [0.5, 0.44] : [0.47, 0.52, 0.43, 0.55];
  cords.forEach((len, i) => {
    const ch = new Chain(knotSock, len * S, low ? 7 : 11, rc * 1.45, [cordMat, tasselMat], {
      radial: low ? 4 : 6, tassel: { length: 0.055 * S, cards: 2 }, color: i % 2 ? tan : rust,
      initialDir: new THREE.Vector3((i - 1.5) * 0.12, -1, 0.25),
    });
    outfit.addChain(ch);
  });

  // ---------------------------------------------------------------- satchel (left hip) + strap over the left shoulder
  const bagTh = 1.22;
  const bagTopY = beltY - 0.05 * S;
  const bagOut = new THREE.Vector3(Math.sin(bagTh), 0, Math.cos(bagTh));
  const bagDepth = 0.075 * S;
  const bagSurf = skirt.field.point(bagTopY, bagTh, skirt.R(bagTopY, bagTh) + bagDepth * 0.42 + 0.006);
  const bagX = new THREE.Vector3(0, 1, 0).cross(bagOut).normalize(); // along the body (toward the front)
  const bagRot = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(bagX, new THREE.Vector3(0, 1, 0), bagOut));
  const bagSock = human.addSocket('wardrobeSatchel', 'pelvis.L', bagSurf, bagRot);
  const satchel = buildSatchel(tier, { coarse, leather, rope }, S, bagDepth);
  bagSock.add(satchel.pivot);
  outfit.add(satchel.pivot);
  outfit.props.satchel = satchel.pivot;
  outfit.pendulums.push(new Pendulum(bagSock, satchel.swing, { freq: 1.25, damping: 0.18, gain: 0.02, limit: 0.3 }));
  // strap path: bag front corner -> up the left chest -> over the left shoulder -> down the back -> bag back corner
  const bagWorld = (x: number, y: number) => new THREE.Vector3(x, y, 0.0).applyQuaternion(bagRot).add(bagSurf);
  const colLen = (th: number) => {
    const gdA = upper.tube.geometry.getAttribute('gdata') as THREE.BufferAttribute;
    const W0 = upper.tube.cols + 1;
    const c = Math.round(((((th - upper.tube.th[0]) / TAU) % 1) + 1) % 1 * upper.tube.cols);
    return gdA.getX(c) + gdA.getY(c);
  };
  // (θ, distance below the neckline) control points; the shoulder crossing sits ~4.5 cm out from the neck
  const onBody: [number, number][] = [
    [0.95, colLen(0.95) - 0.05], [0.9, 0.3 * S], [0.86, 0.18 * S], [0.9, 0.09 * S], [Math.PI / 2, 0.045 * S],
    [Math.PI - 0.9, 0.09 * S], [Math.PI - 0.84, 0.2 * S], [Math.PI - 0.9, 0.32 * S], [Math.PI - 0.95, colLen(Math.PI - 0.95) - 0.05],
  ];
  const NP = low ? 40 : 72;
  const strapPts: THREE.Vector3[] = [], strapN: THREE.Vector3[] = [];
  const endA = bagWorld(0.075 * S, 0.012), endB = bagWorld(-0.075 * S, 0.012);
  const ctrlTh = onBody.map((c) => c[0]), ctrlD = onBody.map((c) => c[1]);
  const interp = (arr: number[], t: number) => {
    const f = t * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f)), u = f - i;
    const a = arr[Math.max(0, i - 1)], b = arr[i], c = arr[i + 1], d = arr[Math.min(arr.length - 1, i + 2)];
    return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  };
  const lead = 6;
  for (let i = 0; i <= lead; i++) {
    // free-hanging lead from the bag's front corner up to the body
    const first = tubeSurface(upper.tube, ctrlTh[0], ctrlD[0]);
    const t = i / (lead + 1);
    strapPts.push(endA.clone().lerp(first.p.clone().addScaledVector(first.n, 0.006), t));
    strapN.push(bagOut.clone().lerp(first.n, t).normalize());
  }
  for (let i = 0; i <= NP; i++) {
    const t = i / NP;
    const sf = tubeSurface(upper.tube, interp(ctrlTh, t), interp(ctrlD, t));
    strapPts.push(sf.p.addScaledVector(sf.n, 0.0065));
    strapN.push(sf.n);
  }
  const lastOn = strapPts[strapPts.length - 1].clone(), lastN = strapN[strapN.length - 1].clone();
  for (let i = 1; i <= lead + 1; i++) {
    const t = i / (lead + 1);
    strapPts.push(lastOn.clone().lerp(endB, t));
    strapN.push(lastN.clone().lerp(bagOut, t).normalize());
  }
  for (let it = 0; it < 2; it++) for (let i = 1; i < strapPts.length - 1; i++) strapPts[i].lerp(strapPts[i - 1].clone().add(strapPts[i + 1]).multiplyScalar(0.5), 0.3);
  const strapGeo = ribbon(strapPts, strapN, 0.03 * S, 0.004);
  const strapMat = solidMaterial({ tier, tex: leather, color: 0x4a2f1d, roughness: 0.62, repeat: [3, 1 / 0.12], normal: 1.2, sheen: low ? 0 : 0.25 });
  const strapW = partWeights(fit, C.TORSO | C.NECK, 8);
  const strapMesh = makeSkinned(human, strapGeo, strapMat, strapW, { name: 'satchelStrap' });
  outfit.add(strapMesh);

  // ---------------------------------------------------------------- sandals
  const sandals = buildSandals(fit, { leather }, S);
  outfit.add(sandals);
  outfit.groundOffset = 0.009;

  // ---------------------------------------------------------------- props
  const staff = makeStaff(tier, wood, bark, { length: 1.75 * S, gripAt: 1.18 * S, seed: 7 });
  outfit.props.staff = staff;
  outfit.props.slingPouch = makeSlingPouch(tier, leather);
  outfit.props.slingCordMaterial = slingCordMaterial(tier, braid);

  outfit.finish(t0);
  void rng;
  void HullField;
  void makeFrame;
  return outfit;
}

// ------------------------------------------------------------------------------------------ satchel
function buildSatchel(tier: Tier, t: { coarse: Awaited<ReturnType<typeof texPair>>; leather: Awaited<ReturnType<typeof texPair>>; rope: Awaited<ReturnType<typeof texPair>> }, S: number, D: number) {
  const low = tier === 'low';
  const Wd = 0.22 * S, Hb = 0.2 * S;
  const pivot = new THREE.Group();
  pivot.name = 'satchel';
  const swing = new THREE.Group();
  pivot.add(swing);
  // bag body: section ellipse a(v) x b(v); flat back (toward the body = -Z), bulging bottom (five stones)
  const nu = low ? 20 : 36, nv = low ? 12 : 22;
  const stones = [[-0.05, 0.8], [0.0, 0.84], [0.05, 0.79], [-0.025, 0.66], [0.03, 0.68]];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const a = (v: number) => (Wd / 2) * (0.9 + 0.1 * Math.sin(Math.PI * v)) * (v > 0.78 ? Math.sqrt(Math.max(0, 1 - ((v - 0.78) / 0.22) ** 2 * 0.9)) : 1);
  const b = (v: number) => (D / 2) * (0.35 + 0.65 * smoothstep(0, 0.65, v)) * (v > 0.8 ? Math.sqrt(Math.max(0, 1 - ((v - 0.8) / 0.2) ** 2 * 0.92)) : 1);
  for (let i = 0; i <= nv; i++) {
    const v = i / nv;
    for (let j = 0; j <= nu; j++) {
      const th = (j / nu) * TAU;
      let x = Math.cos(th) * a(v);
      let z = Math.sin(th) * b(v);
      if (z < 0) z *= 0.45; // flat back against the hip
      let y = -v * Hb;
      // stones pressing the cloth outward at the front-bottom
      if (z > 0) {
        let bump = 0;
        for (const [sx, sv] of stones) bump += Math.exp(-(((x - sx * S) / 0.03) ** 2 + ((v - sv) / 0.09) ** 2));
        z += bump * 0.007 * Math.sin(th);
      }
      // sag of the bottom
      y -= 0.012 * Math.sin(Math.PI * v) * (1 - Math.abs(Math.cos(th)));
      pos.push(x, y, z);
      uv.push((th / TAU) * (2 * Wd + D), v * Hb);
      if (i < nv && j < nu) {
        const k = i * (nu + 1) + j;
        idx.push(k, k + nu + 1, k + 1, k + 1, k + nu + 1, k + nu + 2);
      }
    }
  }
  const bagGeo = new THREE.BufferGeometry();
  bagGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bagGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  bagGeo.setIndex(idx);
  bagGeo.computeVertexNormals();
  const n = bagGeo.getAttribute('position').count;
  bagGeo.setAttribute('gdata', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, k) => (k % 4 === 2 ? 0.35 : k % 4 === 0 ? 1 : 1)), 4));
  // woven bag body (goat-hair / wool, darker), dusty
  const bagMat = clothMaterial({ tier, tex: t.coarse, tile: 0.1, dye: 0x9b8062, roughness: 0.95, sheen: 0.3, normal: 1.3, grime: [0.55, 0.45, 0.35, 0.6], hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
  const bag = new THREE.Mesh(bagGeo, bagMat);
  bag.castShadow = true;
  bag.receiveShadow = true;
  swing.add(bag);
  // leather flap over the top and front
  const fu = low ? 12 : 24, fv = low ? 10 : 18;
  const fpos: number[] = [], fuv: number[] = [], fidx: number[] = [];
  const edge: THREE.Vector3[] = [];
  for (let i = 0; i <= fv; i++) {
    const q = i / fv; // 0 back-top .. 0.25 top .. 1 front bottom edge
    for (let j = 0; j <= fu; j++) {
      const s = (j / fu) * 2 - 1;
      const x = s * a(0.1) * 1.02;
      let y: number, z: number;
      const vEnd = 0.52 - 0.13 * s * s;
      if (q < 0.25) {
        const ang = (q / 0.25) * Math.PI * 0.5; // over the top from the back
        const rb = b(0.02) + 0.006;
        y = 0.004 + Math.sin(ang) * 0.012;
        z = -Math.cos(ang) * rb * 0.45;
      } else {
        const v = ((q - 0.25) / 0.75) * vEnd;
        y = -v * Hb + 0.012 * (1 - (q - 0.25) / 0.75) - 0.01 * Math.sin(Math.PI * v);
        const zz = b(v) * Math.sqrt(Math.max(0, 1 - (x / (a(v) * 1.03)) ** 2)) + 0.005;
        z = zz;
      }
      fpos.push(x, y, z);
      fuv.push(x * 3, q * 0.3);
      if (i === fv) edge.push(new THREE.Vector3(x, y, z + 0.001));
      if (i < fv && j < fu) {
        const k = i * (fu + 1) + j;
        fidx.push(k, k + fu + 1, k + 1, k + 1, k + fu + 1, k + fu + 2);
      }
    }
  }
  const flapGeo = new THREE.BufferGeometry();
  flapGeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
  flapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  flapGeo.setIndex(fidx);
  flapGeo.computeVertexNormals();
  const flapMat = solidMaterial({ tier, tex: t.leather, color: 0x4e3220, roughness: 0.6, repeat: [1, 1], normal: 1.4, sheen: low ? 0 : 0.25 });
  flapMat.side = THREE.DoubleSide;
  const flap = new THREE.Mesh(flapGeo, flapMat);
  flap.castShadow = true;
  swing.add(flap);
  // laced edge of the flap + a toggle
  const lace = tubeAlong(edge, 0.0028, low ? 4 : 5, { twist: 400 });
  const laceMat = solidMaterial({ tier, tex: t.rope, color: 0x4a2e1a, roughness: 0.8, repeat: [1, 1 / 0.01] });
  swing.add(new THREE.Mesh(lace, laceMat));
  const toggle = new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8);
  toggle.rotateZ(Math.PI / 2);
  const mid = edge[Math.floor(edge.length / 2)];
  toggle.translate(mid.x, mid.y - 0.008, mid.z + 0.004);
  swing.add(new THREE.Mesh(toggle, laceMat));
  // strap loops at the top corners
  for (const sx of [-1, 1]) {
    const loop = new THREE.TorusGeometry(0.011, 0.0035, 5, 10);
    loop.translate(sx * 0.075 * S, 0.004, 0);
    swing.add(new THREE.Mesh(loop, flapMat));
  }
  swing.traverse((c) => ((c as THREE.Mesh).isMesh ? ((c as THREE.Mesh).castShadow = true) : null));
  return { pivot, swing };
}

// ------------------------------------------------------------------------------------------ sandals
function buildSandals(fit: Fit, t: { leather: Awaited<ReturnType<typeof texPair>> }, S: number): THREE.Group {
  const { body, lm, tier, human } = fit;
  const low = tier === 'low';
  const grp = new THREE.Group();
  grp.name = 'sandals';
  const soleMat = solidMaterial({ tier, tex: t.leather, color: 0x5e3f28, roughness: 0.75, repeat: [6, 6], normal: 1 });
  const strapMat = solidMaterial({ tier, tex: t.leather, color: 0x4f321f, roughness: 0.6, repeat: [2, 30], normal: 1.2, sheen: low ? 0 : 0.2 });
  for (const s of ['L', 'R'] as const) {
    const footMask = s === 'L' ? C.FOOT_L : C.FOOT_R;
    // footprint hull (xz) of the lowest foot vertices
    const pts: number[] = [];
    for (let i = 0; i < body.n; i++) {
      if (!(body.cls[i] & footMask)) continue;
      if (body.pos[i * 3 + 1] > 0.028 * S) continue;
      pts.push(body.pos[i * 3], body.pos[i * 3 + 2]);
    }
    let hullPts: number[] = [];
    {
      // convex hull via the shared helper
      hullPts = hull2d(pts);
    }
    // resample the outline, offset outward
    const nOut = low ? 24 : 44;
    const outline: [number, number][] = [];
    let cx = 0, cz = 0;
    const hn = hullPts.length / 2;
    for (let i = 0; i < hn; i++) {
      cx += hullPts[i * 2] / hn;
      cz += hullPts[i * 2 + 1] / hn;
    }
    for (let i = 0; i < nOut; i++) {
      const a = (i / nOut) * TAU;
      const d = rayPoly2(hullPts, cx, cz, Math.cos(a), Math.sin(a));
      outline.push([cx + Math.cos(a) * (d + 0.005), cz + Math.sin(a) * (d + 0.005)]);
    }
    const yTop = 0.0025, yBot = -0.0095;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const ring = (y: number, inset: number) => {
      const base = pos.length / 3;
      for (const [x, z] of outline) {
        const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz);
        pos.push(x - (dx / l) * inset, y, z - (dz / l) * inset);
        uv.push(x * 4, z * 4);
      }
      return base;
    };
    const r0 = ring(yTop, 0.002), r1 = ring(yTop - 0.002, 0), r2 = ring(yBot + 0.002, 0), r3 = ring(yBot, 0.002);
    for (const [ra, rb] of [[r0, r1], [r1, r2], [r2, r3]])
      for (let i = 0; i < nOut; i++) {
        const i1 = (i + 1) % nOut;
        idx.push(ra + i, rb + i, ra + i1, ra + i1, rb + i, rb + i1);
      }
    const cTop = pos.length / 3;
    pos.push(cx, yTop, cz);
    uv.push(cx * 4, cz * 4);
    const cBot = pos.length / 3;
    pos.push(cx, yBot, cz);
    uv.push(cx * 4, cz * 4);
    for (let i = 0; i < nOut; i++) {
      const i1 = (i + 1) % nOut;
      idx.push(cTop, r0 + i1, r0 + i);
      idx.push(cBot, r3 + i, r3 + i1);
    }
    const sole = new THREE.BufferGeometry();
    sole.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sole.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    sole.setIndex(idx);
    sole.computeVertexNormals();
    const footW = partWeights(fit, footMask, 6);
    const soleMesh = makeSkinned(human, sole, soleMat, footW, { name: `sole${s}` });
    grp.add(soleMesh);
    // straps: forefoot band + criss-cross thongs round the ankle + side risers to the sole
    const ank = lm.ankle[s];
    const legMask = (s === 'L' ? C.SHIN_L : C.SHIN_R) | footMask;
    const F = new HullField(body, makeFrame(new THREE.Vector3(ank.x, 0, ank.z - 0.01), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)), legMask, 0.01, ank.y + 0.2 * S, 0.004, 64, 0.006, 2);
    const strapGeos: THREE.BufferGeometry[] = [];
    const y0 = ank.y - 0.018 * S, y1 = ank.y + 0.115 * S;
    const turns = 2.25;
    for (const dir of [1, -1]) {
      const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
      const N = low ? 40 : 90;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const th = Math.PI + dir * u * turns * TAU;
        const y = y0 + (y1 - y0) * u + 0.006 * Math.sin(th * 2);
        const r = F.radius(y, th) + 0.0028;
        const p = F.point(y, th, r);
        pts.push(p);
        const c = F.point(y, th, 0);
        nrm.push(p.clone().sub(c).setY(0).normalize());
      }
      strapGeos.push(ribbon(pts, nrm, 0.0105 * S, 0.0022));
    }
    // forefoot band across the metatarsals (in the plane across the foot)
    const toe = new THREE.Vector3(), heel = new THREE.Vector3();
    {
      let zmin = Infinity, zmax = -Infinity;
      for (let i = 0; i < outline.length; i++) {
        zmin = Math.min(zmin, outline[i][1]);
        zmax = Math.max(zmax, outline[i][1]);
      }
      heel.set(cx, 0, zmin);
      toe.set(cx, 0, zmax);
    }
    const bandZ = heel.z + (toe.z - heel.z) * 0.66;
    const FF = new HullField(body, makeFrame(new THREE.Vector3(cx, 0, bandZ - 0.05), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)), footMask, 0.0, 0.1, 0.004, 64, 0.006, 1);
    for (const [zOff, wdt] of [[0, 0.016], [-0.045, 0.012]] as const) {
      const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
      const N = low ? 16 : 30;
      for (let i = 0; i <= N; i++) {
        const th = -Math.PI * 0.62 + (i / N) * Math.PI * 1.24; // over the top (θ = 0 is +Y)
        const s0 = 0.05 + zOff;
        const r = FF.radius(s0, th) + 0.0028;
        const p = FF.point(s0, th, r);
        if (p.y < yTop + 0.002) p.y = yTop + 0.002;
        pts.push(p);
        nrm.push(p.clone().sub(FF.point(s0, th, 0)).normalize());
      }
      strapGeos.push(ribbon(pts, nrm, wdt * S, 0.0022));
    }
    // risers: from the sole edge (both sides, mid-foot) up to the lowest wrap; heel strap
    for (const side of [1, -1]) {
      const th = side * Math.PI * 0.5 + Math.PI * 0.12 * side;
      const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const y = yTop + (y0 + 0.01 - yTop) * (i / 8);
        const p = F.point(Math.max(0.012, y), th, F.radius(Math.max(0.012, y), th) + 0.0028);
        p.y = y;
        pts.push(p);
        nrm.push(p.clone().sub(F.point(y, th, 0)).setY(0).normalize());
      }
      strapGeos.push(ribbon(pts, nrm, 0.011 * S, 0.0022));
    }
    const strapW = partWeights(fit, legMask, 6);
    const straps = makeSkinned(human, merge(strapGeos, false), strapMat, strapW, { name: `sandalStraps${s}` });
    grp.add(straps);
  }
  human.root.add(grp);
  return grp;
}

// small local helpers (avoid importing body's hull under a different name)
import { hull2, rayPoly } from './body';
function hull2d(p: number[]) {
  return hull2(p);
}
function rayPoly2(poly: number[], cx: number, cz: number, dx: number, dz: number) {
  return rayPoly(poly, cx, cz, dx, dz);
}
