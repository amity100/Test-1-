import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { setGroomSkin } from '../human/SkinMaterial';
import type { HeadSurface } from './HeadSurface';
import { ss } from './HeadSurface';
import type { Tier } from './grow';
import { slice } from '../../core/slice';

/*
 * beard1 (wave 6) — the skin under a beard / scalp: "a beard that grows out of the skin".
 *
 * The old groom laid an offset copy of the skin, hair-coloured at 0.8 alpha, over the whole beard and scalp region (the
 * "cap"): a felt mask with an edge — Samuel's grey band at the hairline, the bib under every beard. Instead the skin
 * itself is changed under the hair: a small map in the head's uv rectangle, rasterised from per-vertex values of the
 * HeadSurface and handed to the HumanModel's SkinMaterial (BEARD / SCALP SKIN section; uniforms only, no recompile):
 *   R  root density: the strands' growth mask, plus the sparse stubble zone beyond the last strands (cheeks, neck)
 *   G  occlusion: the optical depth of the actual strands above each skin point (grow.ts bakeAO) — the beard's shadow
 *      on the chin and down the neck, the moustache's on the upper lip, the hair's on the scalp
 *   B  1 beard / 0 scalp: which root colour
 *   A  where single stubble hairs show (the thin border of the beard)
 * The rasteriser writes every texel inside a head triangle, then dilates 3 texels so bilinear / mip filtering never
 * reads the black outside an island seam.
 */

export interface GroomSkinStyle {
  /** root density on the skin for the beard / the scalp (per HeadSurface vertex, 0..1), incl. the stubble zone */
  beard?: (S: HeadSurface) => Float32Array;
  scalp?: (S: HeadSurface) => Float32Array;
  /** root colours (sRGB) */
  beardColor: [number, number, number];
  scalpColor: [number, number, number];
  /** max cover of the skin by the root colour (white hair: less, the pink skin shows) */
  cover: number;
  /** occlusion of direct / indirect light by the hair over the skin */
  occDirect: number;
  occIndirect: number;
  /** optical depth -> occlusion gain (default 0.55), max occlusion (default 0.9) */
  occGain?: number;
  occMax?: number;
  stubble?: number;
  edgeNoise?: number;
  sheen?: number;
}

export interface GroomSkinMap {
  texture: THREE.DataTexture;
  rect: THREE.Vector4;
  bytes: number;
  ms: number;
  /** diagnostics: mean / max occlusion over the dense root region (density > 0.5) */
  occ: [number, number];
}

/**
 * build the map and attach it to the human's skin (null when the body has no uv / mismatching vertices). Pauses between
 * its phases when the film's background builder's slice is used up (core/slice); ms counts only its own work.
 */
export async function buildGroomSkin(human: HumanModel, S: HeadSurface, st: GroomSkinStyle, tau: Float32Array | undefined, q: Tier): Promise<GroomSkinMap | null> {
  let t0 = performance.now();
  let ms = 0;
  const pause = async () => {
    if (!slice.due()) return;
    ms += performance.now() - t0;
    await slice.pause();
    t0 = performance.now();
  };
  const g = human.body.geometry;
  const uvA = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const nv = S.region.length;
  if (!uvA || uvA.count !== nv || !(uvA as THREE.BufferAttribute).isBufferAttribute) return null;
  const beard = st.beard ? st.beard(S) : null;
  const scalp = st.scalp ? st.scalp(S) : null;
  const occGain = st.occGain ?? 0.55, occMax = st.occMax ?? 0.9;
  const R = new Float32Array(nv), G = new Float32Array(nv), B = new Float32Array(nv), A = new Float32Array(nv);
  let u0 = 1e9, v0 = 1e9, u1 = -1e9, v1 = -1e9;
  let oSum = 0, oN = 0, oMax = 0;
  for (let v = 0; v < nv; v++) {
    const b = beard ? beard[v] : 0, s = scalp ? scalp[v] : 0;
    const occ = tau ? Math.min(occMax, 1 - Math.exp(-tau[v] * occGain)) : 0;
    const d = Math.max(b, s);
    R[v] = d;
    G[v] = occ;
    B[v] = b + s > 1e-5 ? b / (b + s) : 1;
    // single hairs show where the beard thins out (the border band), not in its dense core nor on the scalp
    A[v] = b > s ? ss(0.0, 0.35, b) * (1 - ss(0.55, 0.95, b)) : 0;
    if (d > 0.5) {
      oSum += occ;
      oN++;
      if (occ > oMax) oMax = occ;
    }
    if (d > 0.002 || occ > 0.01) {
      const u = uvA.getX(v), w = uvA.getY(v); // (once per vertex)
      if (u < u0) u0 = u;
      if (w < v0) v0 = w;
      if (u > u1) u1 = u;
      if (w > v1) v1 = w;
    }
  }
  if (u1 <= u0 || v1 <= v0) return null;
  await pause();
  const mu = (u1 - u0) * 0.02 + 0.004, mv = (v1 - v0) * 0.02 + 0.004;
  u0 = Math.max(0, u0 - mu);
  v0 = Math.max(0, v0 - mv);
  u1 = Math.min(1, u1 + mu);
  v1 = Math.min(1, v1 + mv);
  // texel size ~1 mm (high) / 2 mm (low) over the face: the head island is ~0.35 x 0.65 of the atlas
  const base = q === 'low' ? 128 : 256;
  const asp = (v1 - v0) / (u1 - u0);
  const W = asp >= 1 ? base : base * 2;
  const H = asp >= 1 ? base * 2 : base;
  const data = new Uint8Array(W * H * 4);
  const filled = new Uint8Array(W * H);
  const su = W / (u1 - u0), sv = H / (v1 - v0);
  const T = S.tris;
  const UV = uvA.array as ArrayLike<number>;
  const us = uvA.itemSize;
  for (let t = 0; t < T.length; t += 3) {
    const ia = T[t], ib = T[t + 1], ic = T[t + 2];
    // every head triangle inside the rectangle is written (zeros too): the dilation below then only fills seams
    const ax = (UV[ia * us] - u0) * su, ay = (UV[ia * us + 1] - v0) * sv;
    const bx = (UV[ib * us] - u0) * su, by = (UV[ib * us + 1] - v0) * sv;
    const cx = (UV[ic * us] - u0) * su, cy = (UV[ic * us + 1] - v0) * sv;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x1 < x0 || y1 < y0) continue;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-12) continue;
    const zero = R[ia] + R[ib] + R[ic] + G[ia] + G[ib] + G[ic] < 0.003;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const wa = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const wb = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        const wc = 1 - wa - wb;
        if (wa < -0.02 || wb < -0.02 || wc < -0.02) continue;
        const o = y * W + x;
        filled[o] = 1;
        if (zero) continue;
        data[o * 4] = Math.round(255 * Math.min(1, R[ia] * wa + R[ib] * wb + R[ic] * wc));
        data[o * 4 + 1] = Math.round(255 * Math.min(1, G[ia] * wa + G[ib] * wb + G[ic] * wc));
        data[o * 4 + 2] = Math.round(255 * Math.min(1, B[ia] * wa + B[ib] * wb + B[ic] * wc));
        data[o * 4 + 3] = Math.round(255 * Math.min(1, A[ia] * wa + A[ib] * wb + A[ic] * wc));
      }
  }
  // dilate (seams, sub-texel triangles): an empty texel takes the mean of its filled neighbours
  const addO = new Int32Array(W * H), addV = new Uint8Array(W * H * 4);
  for (let pass = 0; pass < 3; pass++) {
    await pause();
    let na = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        if (filled[o]) continue;
        let n = 0, r = 0, gg = 0, b = 0, a = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= W) continue;
            const p = yy * W + xx;
            if (!filled[p]) continue;
            n++;
            r += data[p * 4];
            gg += data[p * 4 + 1];
            b += data[p * 4 + 2];
            a += data[p * 4 + 3];
          }
        }
        if (!n) continue;
        addO[na] = o;
        addV[na * 4] = Math.round(r / n);
        addV[na * 4 + 1] = Math.round(gg / n);
        addV[na * 4 + 2] = Math.round(b / n);
        addV[na * 4 + 3] = Math.round(a / n);
        na++;
      }
    for (let i = 0; i < na; i++) {
      const o = addO[i];
      data[o * 4] = addV[i * 4];
      data[o * 4 + 1] = addV[i * 4 + 1];
      data[o * 4 + 2] = addV[i * 4 + 2];
      data[o * 4 + 3] = addV[i * 4 + 3];
      filled[o] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  tex.name = 'groomSkin';
  tex.userData.keepSize = true; // a data texture: never resampled by engine.enforceTextureBudget (re-uploaded after a context loss)
  const rect = new THREE.Vector4(u0, v0, u1 - u0, v1 - v0);
  const lin = (c: [number, number, number]) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  setGroomSkin(human.skin, {
    map: tex, rect, beardColor: lin(st.beardColor), scalpColor: lin(st.scalpColor), cover: st.cover,
    occDirect: st.occDirect, occIndirect: st.occIndirect, stubble: st.stubble, edgeNoise: st.edgeNoise, sheen: st.sheen,
  });
  return { texture: tex, rect, bytes: Math.round(W * H * 4 * 1.333), ms: ms + performance.now() - t0, occ: [oN ? +(oSum / oN).toFixed(3) : 0, +oMax.toFixed(3)] };
}

/** detach a groom's map from the skin (the skin is exactly as before) and free it */
export function releaseGroomSkin(human: HumanModel, m: GroomSkinMap | null) {
  if (!m) return;
  if (human.skin.groomSkin.uGroomMap.value === m.texture) setGroomSkin(human.skin, null);
  m.texture.dispose();
}
