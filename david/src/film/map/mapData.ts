import * as THREE from 'three';

/**
 * THE MAP'S DATA (CUT v5 P4-P5, src/film/map/MapSet.ts): the frame, the geography and the baked assets of
 * tools/map/build_map.py (real elevation: AWS Terrain Tiles / SRTM + bathymetry; real natural colour: Natural Earth I;
 * restored to ~1000 BCE — see the tool's header). The constants mirror the tool's: keep them identical.
 *
 * World frame of the map scene: METRES on a sphere of the Earth's radius, a local tangent frame at the region's
 * centre C0 (lon 33.5, lat 30.55): +X east, +Y up, +Z south (as the land sets); the sphere's centre is (0, -R, 0).
 * Heights are exaggerated by EXAG (the relief reads from 100+ km up).
 */
export const MAP = {
  bbox: { lon0: 29.5, lon1: 37.5, lat0: 27.0, lat1: 34.5 },
  globe: { lon0: 5.0, lon1: 65.0, lat0: 5.0, lat1: 55.0 },
  exag: 2.6,
  hMin: -430,
  hMax: 2900,
  sunAz: 104,
  sunEl: 11,
  R: 6_371_000,
  center: { lon: 33.5, lat: 30.55 },
  /** the ~56 m inset over the coastal plain, the Shephelah, Judah and the north of the Salt Sea (build_map.py INSET) */
  inset: { lon0: 34.4, lon1: 35.62, lat0: 31.38, lat1: 32.02 },
} as const;

const D2R = Math.PI / 180;

/** the local tangent frame at C0 (float64 on the CPU; positions are stored relative to it) */
const C0 = (() => {
  const lo = MAP.center.lon * D2R, la = MAP.center.lat * D2R;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  return { up, east, north };
})();

/** world position (metres, the map scene's frame) of lon / lat (deg) at height h (m above sea level, NOT exaggerated) */
export function geoToWorld(lon: number, lat: number, h: number, out = new THREE.Vector3(), exag: number = MAP.exag): THREE.Vector3 {
  const lo = lon * D2R, la = lat * D2R;
  const r = MAP.R + h * exag;
  const px = r * Math.cos(la) * Math.cos(lo), py = r * Math.cos(la) * Math.sin(lo), pz = r * Math.sin(la);
  // relative to the sphere's centre, in the tangent frame; then shifted so C0 (h 0) is the origin
  const { up, east, north } = C0;
  const x = px * east[0] + py * east[1] + pz * east[2];
  const y = px * up[0] + py * up[1] + pz * up[2] - MAP.R;
  const zn = px * north[0] + py * north[1] + pz * north[2];
  return out.set(x, y, -zn);
}

/** lon / lat (deg) and height above the sphere (m, real) of a world position */
export function worldToGeo(p: THREE.Vector3): { lon: number; lat: number; alt: number } {
  const { up, east, north } = C0;
  const x = p.x, y = p.y + MAP.R, zn = -p.z;
  const px = x * east[0] + y * up[0] + zn * north[0];
  const py = x * east[1] + y * up[1] + zn * north[1];
  const pz = x * east[2] + y * up[2] + zn * north[2];
  const r = Math.hypot(px, py, pz);
  return { lon: Math.atan2(py, px) / D2R, lat: Math.asin(pz / r) / D2R, alt: r - MAP.R };
}

/** the local "up" (unit, world) at lon / lat */
export function geoUp(lon: number, lat: number, out = new THREE.Vector3()): THREE.Vector3 {
  geoToWorld(lon, lat, 0, out, 0);
  return out.add(_c.set(0, MAP.R, 0)).normalize();
}
const _c = new THREE.Vector3();

/** local east / north unit vectors (world) at lon / lat */
export function geoBasis(lon: number, lat: number, east: THREE.Vector3, north: THREE.Vector3, up: THREE.Vector3) {
  geoUp(lon, lat, up);
  const a = geoToWorld(lon + 0.01, lat, 0, _t1, 0), b = geoToWorld(lon - 0.01, lat, 0, _t2, 0);
  east.copy(a).sub(b).normalize();
  north.crossVectors(up, east).normalize();
  east.crossVectors(north, up).normalize();
}
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();

// ------------------------------------------------------------------------------------------------- assets
const URLS = import.meta.glob('../../assets/map/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
export function mapAssetUrl(name: string): string {
  const k = Object.keys(URLS).find((p) => p.endsWith('/' + name));
  if (!k) throw new Error('map asset missing: ' + name);
  return URLS[k];
}

/** decode an image off the main thread where the browser can (createImageBitmap), never premultiplied / colour-managed */
export async function loadBitmap(name: string): Promise<ImageBitmap | HTMLImageElement> {
  const url = mapAssetUrl(name);
  const r = await fetch(url);
  const blob = await r.blob();
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    } catch {
      /* fall back to an <img> */
    }
  }
  const img = new Image();
  img.decoding = 'async';
  const u = URL.createObjectURL(blob);
  img.src = u;
  await img.decode();
  URL.revokeObjectURL(u);
  return img;
}

/** a texture of a decoded image (sRGB colour or linear data) */
export function bitmapTexture(img: ImageBitmap | HTMLImageElement, srgb: boolean, mips = true): THREE.Texture {
  const t = new THREE.Texture(img as unknown as HTMLImageElement);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.flipY = false; // row 0 = the north edge (v = 0 at lat1)
  t.premultiplyAlpha = false;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** the height grid (m, real) of the mesh vertices from the 8-bit height map (h = hMin + (hMax - hMin) * (q/255)^2) */
export class MapHeights {
  readonly w: number;
  readonly h: number;
  readonly data: Float32Array;
  constructor(img: ImageBitmap | HTMLImageElement) {
    this.w = img.width;
    this.h = img.height;
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img as CanvasImageSource, 0, 0);
    const px = g.getImageData(0, 0, this.w, this.h).data;
    this.data = new Float32Array(this.w * this.h);
    const span = MAP.hMax - MAP.hMin;
    for (let i = 0; i < this.data.length; i++) {
      const q = px[i * 4] / 255;
      this.data[i] = MAP.hMin + span * q * q;
    }
    c.width = c.height = 1;
  }
  /** bilinear height (m, real) at lon / lat; outside the box: the edge */
  at(lon: number, lat: number): number {
    const b = MAP.bbox;
    let u = ((lon - b.lon0) / (b.lon1 - b.lon0)) * (this.w - 1);
    let v = ((b.lat1 - lat) / (b.lat1 - b.lat0)) * (this.h - 1);
    u = Math.max(0, Math.min(this.w - 1.001, u));
    v = Math.max(0, Math.min(this.h - 1.001, v));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const d = this.data, w = this.w;
    const a = d[j * w + i], b2 = d[j * w + i + 1], c = d[(j + 1) * w + i], e = d[(j + 1) * w + i + 1];
    return (a * (1 - fu) + b2 * fu) * (1 - fv) + (c * (1 - fu) + e * fu) * fv;
  }
}

/** the relief fades to sea level over the last `edge` degrees of the box (the mesh meets the relief-free globe) */
export function edgeFade(lon: number, lat: number, edge = 0.35): number {
  const b = MAP.bbox;
  const d = Math.min(lon - b.lon0, b.lon1 - lon, lat - b.lat0, b.lat1 - lat);
  const x = Math.max(0, Math.min(1, d / edge));
  return x * x * (3 - 2 * x);
}
