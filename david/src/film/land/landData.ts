import * as THREE from 'three';
import { gunzip } from '../../characters/human/inflate';

/**
 * Real elevation of the land of Judah / Philistia / Moab for the opening film's prologue sets.
 * Source: NASA SRTM 1" (public domain), resampled by tools/land/build_dem.py into local metres:
 * origin Bethlehem (31.7054 N, 35.2024 E), +X east, +Z south (-Z north), y = metres above sea level.
 */
const URLS = import.meta.glob('../../assets/land/*.{binz,webp}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const url = (name: string) => {
  const k = Object.keys(URLS).find((p) => p.endsWith('/' + name));
  if (!k) throw new Error('land asset missing: ' + name);
  return URLS[k];
};

export type TileName = 'region' | 'judah' | 'coast' | 'ramah';

/** geographic helpers (the same projection as the baker) */
export const GEO = {
  lat0: 31.7054, lon0: 35.2024,
  kx: 111320 * Math.cos((31.7054 * Math.PI) / 180), kz: 110574,
  /** local metres of a lat / lon */
  toLocal(lat: number, lon: number): { x: number; z: number } {
    return { x: (lon - GEO.lon0) * GEO.kx, z: -(lat - GEO.lat0) * GEO.kz };
  },
  /** Earth radius used for the curvature drop of the far terrain and water */
  R: 6_371_000,
  /** Iron Age level of the Dead Sea used by the baker (see tools/land/build_dem.py) */
  deadSea: -398,
};

/** real places, in local metres (y = ground from the DEM is looked up at runtime) */
export const PLACES = {
  bethlehem: GEO.toLocal(31.7054, 35.2024),
  rachelTomb: GEO.toLocal(31.7192, 35.2023),
  jerusalem: GEO.toLocal(31.7733, 35.2355),
  gibeah: GEO.toLocal(31.8231, 35.2311),
  ramah: GEO.toLocal(31.8496, 35.2322),
  herodionHill: GEO.toLocal(31.6658, 35.2417),
  jericho: GEO.toLocal(31.8711, 35.4440),
  deadSeaNorth: GEO.toLocal(31.765, 35.53),
  ashdod: GEO.toLocal(31.7547, 34.6667),
  ashkelon: GEO.toLocal(31.6644, 34.5469),
  gath: GEO.toLocal(31.7003, 34.8469),
  ekron: GEO.toLocal(31.7786, 34.8497),
  nebo: GEO.toLocal(31.7676, 35.7254),
};

/** One height tile: int16 decimetres on a regular grid. */
export class HeightTile {
  readonly w: number; readonly h: number;
  readonly x0: number; readonly z0: number; readonly dx: number; readonly dz: number;
  readonly data: Int16Array;
  readonly x1: number; readonly z1: number;
  constructor(buf: ArrayBuffer) {
    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'LDEM') throw new Error('bad land tile');
    this.w = dv.getInt32(4, true); this.h = dv.getInt32(8, true);
    this.x0 = dv.getFloat32(12, true); this.z0 = dv.getFloat32(16, true);
    this.dx = dv.getFloat32(20, true); this.dz = dv.getFloat32(24, true);
    this.data = new Int16Array(buf.slice(28, 28 + this.w * this.h * 2));
    this.x1 = this.x0 + (this.w - 1) * this.dx; this.z1 = this.z0 + (this.h - 1) * this.dz;
  }
  inside(x: number, z: number, margin = 0) {
    return x >= this.x0 + margin && x <= this.x1 - margin && z >= this.z0 + margin && z <= this.z1 - margin;
  }
  /** bilinear height (m); outside the tile the grid is mirrored (continuous, plausible far terrain) */
  height(x: number, z: number): number {
    let u = (x - this.x0) / this.dx, v = (z - this.z0) / this.dz;
    const W = this.w - 1, H = this.h - 1;
    if (u < 0) u = -u; else if (u > W) u = Math.max(0, 2 * W - u);
    if (v < 0) v = -v; else if (v > H) v = Math.max(0, 2 * H - v);
    const i = Math.min(W - 1, Math.floor(u)), j = Math.min(H - 1, Math.floor(v));
    const fu = u - i, fv = v - j;
    const d = this.data, w = this.w, k = j * w + i;
    const a = d[k], b = d[k + 1], c = d[k + w], e = d[k + w + 1];
    return ((a + (b - a) * fu) * (1 - fv) + (c + (e - c) * fu) * fv) * 0.1;
  }
}

const cache = new Map<TileName, Promise<HeightTile>>();
/** load (once) a height tile */
export function loadTile(name: TileName): Promise<HeightTile> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(url(`${name}.binz`)).then((r) => r.arrayBuffer()).then(gunzip).then((b) => new HeightTile(b));
    cache.set(name, p);
  }
  return p;
}
/** forget cached tiles (after the film: frees ~3 MB of JS heap) */
export function releaseTiles() { cache.clear(); }

export function loadLandcover(name: TileName, anisotropy = 4): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(url(`${name}_lc.webp`)).then((t) => {
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.anisotropy = anisotropy;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.flipY = false;
    return t;
  });
}

/** Height field made of a fine local tile over the regional one (blended across the local tile's border). */
export class LandHeight {
  constructor(readonly region: HeightTile, readonly local: HeightTile | null, readonly mods: ((x: number, z: number, h: number) => number)[] = []) {}
  raw(x: number, z: number): number {
    const r = this.region.height(x, z);
    const L = this.local;
    if (!L || !L.inside(x, z)) return r;
    const edge = Math.min(x - L.x0, L.x1 - x, z - L.z0, L.z1 - z);
    const w = Math.min(1, edge / 1200);
    const l = L.height(x, z);
    return r + (l - r) * w * w * (3 - 2 * w);
  }
  /** terrain height incl. set-specific modifications (levelled gate plaza, road bed...) */
  height(x: number, z: number): number {
    let h = this.raw(x, z);
    for (const m of this.mods) h = m(x, z, h);
    return h;
  }
}

/**
 * Per-tile shading texture (RGBA8): RG = surface normal xz, B = soft sun visibility (terrain self-shadow for the
 * set's sun, incl. the Earth's curvature), A = convexity (ridges bright, gullies dark).
 */
export function shadeTexture(tile: HeightTile, H: LandHeight, sunDir: THREE.Vector3, opts: { step?: number; maxDist?: number; useMods?: boolean } = {}): THREE.DataTexture {
  const { w, h, x0, z0, dx } = tile;
  const out = new Uint8Array(w * h * 4);
  const hs = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + i * dx, z = z0 + j * dx;
    hs[j * w + i] = opts.useMods ? H.height(x, z) : H.raw(x, z);
  }
  const sh = Math.hypot(sunDir.x, sunDir.z) || 1;
  const sx = sunDir.x / sh, sz = sunDir.z / sh, tanE = sunDir.y / sh;
  const step0 = opts.step ?? dx;
  const maxDist = opts.maxDist ?? 40000;
  const R2 = 2 * GEO.R;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const c = hs[k];
      const l = hs[j * w + Math.max(0, i - 1)], r = hs[j * w + Math.min(w - 1, i + 1)];
      const u = hs[Math.max(0, j - 1) * w + i], d = hs[Math.min(h - 1, j + 1) * w + i];
      let nx = (l - r) / (2 * dx), nz = (u - d) / (2 * dx);
      const nl = Math.hypot(nx, 1, nz);
      nx /= nl; nz /= nl;
      out[k * 4] = Math.round((nx * 0.5 + 0.5) * 255);
      out[k * 4 + 1] = Math.round((nz * 0.5 + 0.5) * 255);
      // soft horizon shadow toward the sun
      const x = x0 + i * dx, z = z0 + j * dx;
      let vis = 1, t = step0 * 0.7, st = step0;
      const h0 = c + 2;
      while (t < maxDist) {
        const ray = h0 + t * tanE + (t * t) / R2;
        if (ray > 1400) break;
        const th = H.raw(x + sx * t, z + sz * t);
        const pen = (ray - th) / (t * 0.035 + 8); // penumbra widens with distance
        if (pen < vis) { vis = pen; if (vis <= 0) { vis = 0; break; } }
        t += st;
        st *= 1.035;
      }
      out[k * 4 + 2] = Math.round(Math.max(0, Math.min(1, vis)) * 255);
      const conv = c - (l + r + u + d) * 0.25;
      out[k * 4 + 3] = Math.round(Math.max(0, Math.min(1, 0.5 + conv / (dx * 0.25))) * 255);
    }
  }
  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
