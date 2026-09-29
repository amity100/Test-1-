import * as THREE from 'three';
import { Colliders } from './Colliders';
import { shared } from './Shared';
import { PostFX, createGradeUniforms, createLookUniforms, type DoFSettings } from '../fx/PostFX';
import { Motes, ParticleSystem, SmokeColumns } from '../fx/Particles';
import { SkySystem } from '../world/Sky';
import { Terrain } from '../world/Terrain';
import { Vegetation } from '../world/Vegetation';
import { Rocks } from '../world/Rocks';
import { Grass } from '../world/Grass';
import { Village } from '../world/Village';
import { loadTextures, type TextureSet } from '../world/Textures';
import { configureWorld } from '../world/WorldQuality';
import { SUN } from '../world/Layout';

// =====================================================================================================
// Quality tiers
// =====================================================================================================
//
// `tier` is the *device* tier (render budget); `name` is the *content* tier other modules key geometry /
// texture detail on. Phones are always content 'low' (tight memory, tile GPUs) but a recent phone gets
// the 'mobile-high' render budget: a sharp 2x image, FXAA + sharpening, bloom and 2k shadows.
//
// | tier           | name   | max PR | max px (w*h) | AA          | DoF (bokeh) | shadow | bloom (scale/mips) | god rays | CAS  | grain+CA | grass (patch) | trees | shrubs | farTrees | rocks | tex max | tris/frame | budget |
// |----------------|--------|--------|--------------|-------------|-------------|--------|--------------------|----------|------|----------|---------------|-------|--------|----------|-------|---------|------------|--------|
// | desktop-high   | high   | 2.0    | 3.7 M        | TAA hq      | 43 taps     | 4096   | 1/2, 6             | 40       | 0.30 | yes      | 46000 (54 m)  | 1.00  | 4200   | 9000     | 3600  | 4096    | 8 M        | 18 ms  |
// | desktop-medium | medium | 1.5    | 2.1 M        | TAA hq      | 22 taps     | 2048   | 1/2, 5             | 28       | 0.30 | yes      | 28000 (44 m)  | 0.80  | 2600   | 6000     | 2400  | 2048    | 5 M        | 24 ms  |
// | mobile-high    | low    | 2.0    | 1.7 M        | TAA lq      | 16 taps     | 2048   | 1/2, 5             | 20       | 0.40 | no       | 15000 (36 m)  | 0.65  | 1600   | 4000     | 1600  | 2048    | 2.5 M      | 30 ms  |
// | mobile-low     | low    | 1.5    | 0.9 M        | FXAA        | off         | 1024   | 1/4, 4             | 12       | 0.40 | no       | 9000 (30 m)   | 0.50  | 1000   | 2600     | 1000  | 1024    | 1.5 M      | 38 ms  |
//
// Anti-aliasing: TAA (see fx/TAA.ts) replaces MSAA on every tier that can afford it. MSAA 4 at 3.7 MP costs
// ~180 MB of multisample storage and a resolve per frame and does nothing for sub-pixel shading (strand hair,
// fur shells, grass, specular glints); TAA resolves all of it (hair dither converges) for 2 history targets.
// quality.msaa stays the value hair / fur materials key on (GroomOptions.msaa): 0 on every tier now.
// Pixel ratio = min(devicePixelRatio, maxPixelRatio), lowered only if the backing store would exceed
// maxPixels (e.g. an iPhone 14, 390x844 CSS px @3x: mobile-high renders 780x1688 = 1.32 MP, i.e. 2x CSS
// pixels; mobile-low 585x1266). The pixel ratio is chosen ONCE (detection + warm-up benchmark behind the
// loading screen); during play the canvas is only resized when the viewport itself changes size.
// "budget" is the synchronous (CPU+GPU) frame time the warm-up benchmark allows for the tier; "tris/frame" is the
// drawn-triangle target (camera + shadow pass) content modules should size their LODs against (not enforced).

export type TierName = 'desktop-high' | 'desktop-medium' | 'mobile-high' | 'mobile-low';
export const TIER_LADDER: readonly TierName[] = ['desktop-high', 'desktop-medium', 'mobile-high', 'mobile-low'];

/** Render-side knobs: can change after the world is built (warm-up benchmark / runtime governor). */
export interface RenderBudget {
  /** upper bound of the renderer pixel ratio */
  maxPixelRatio: number;
  /** upper bound of the drawing buffer area in pixels */
  maxPixels: number;
  /** MSAA samples of the HDR scene target (0 = off) */
  msaa: number;
  /** spatial post anti-aliasing used when neither MSAA nor TAA is on */
  aa: 'fxaa' | 'none';
  /** temporal anti-aliasing: 'hq' (desktop), 'lq' (phones), false = off */
  taa: false | 'hq' | 'lq';
  /** depth-of-field bokeh kernel (0 = no DoF on this tier; 16 / 22 / 43 samples) */
  dofSamples: number;
  shadowSize: number;
  bloom: boolean;
  /** first bloom mip resolution relative to the render resolution */
  bloomScale: number;
  bloomMips: number;
  godRaySamples: number;
  /** contrast-adaptive sharpening strength 0..1 */
  sharpen: number;
  /** film grain + chromatic aberration (desktop only) */
  filmFx: boolean;
  /** allowed synchronous frame time in the warm-up benchmark (ms) */
  frameBudgetMs: number;
}

/** Content-side knobs: read by world / character modules while building (fixed after build). */
export interface ContentBudget {
  /** content tier: modules key geometry / texture detail on this. Phones are always 'low'. */
  name: 'low' | 'medium' | 'high';
  nearSpacing: number;
  farSegments: number;
  grassCount: number;
  /** half-size (m) of the toroidal grass patch around the camera */
  grassPatch: number;
  treeScale: number;
  shrubs: number;
  farTrees: number;
  rocks: number;
  motes: number;
  /** capacity of the shared particle system (smoke, dust) */
  particles: number;
  /** largest texture edge modules should upload (downscale bigger images / pick smaller variants) */
  texMax: number;
  /** anisotropic filtering cap */
  anisotropy: number;
  /**
   * target for content modules (not enforced): triangles drawn per frame including the sun shadow pass,
   * i.e. renderer.info.render.triangles of a full frame. Size LODs / instance counts against it.
   */
  triangleBudget: number;
}

export interface Quality extends RenderBudget, ContentBudget {
  /** device tier (render budget) chosen by detection + warm-up benchmark */
  tier: TierName;
  /** touch-first device with a mobile GPU (phones, tablets) */
  mobile: boolean;
  /** current renderer pixel ratio (kept up to date by Engine; read-only for other modules) */
  pixelRatio: number;
  /**
   * multiplier on maxPixels picked by the warm-up benchmark: < 1 when even the lowest tier is too slow
   * (down to 0.55), > 1 when a fast device is limited by maxPixels, e.g. a tablet (up to 2.2)
   */
  renderScale: number;
  /** GPU renderer string (for diagnostics) */
  gpu: string;
}

const RENDER: Record<TierName, RenderBudget> = {
  'desktop-high': { maxPixelRatio: 2, maxPixels: 3_700_000, msaa: 0, aa: 'none', taa: 'hq', dofSamples: 43, shadowSize: 4096, bloom: true, bloomScale: 0.5, bloomMips: 6, godRaySamples: 40, sharpen: 0.3, filmFx: true, frameBudgetMs: 18 },
  'desktop-medium': { maxPixelRatio: 1.5, maxPixels: 2_100_000, msaa: 0, aa: 'none', taa: 'hq', dofSamples: 22, shadowSize: 2048, bloom: true, bloomScale: 0.5, bloomMips: 5, godRaySamples: 28, sharpen: 0.3, filmFx: true, frameBudgetMs: 24 },
  'mobile-high': { maxPixelRatio: 2, maxPixels: 1_700_000, msaa: 0, aa: 'none', taa: 'lq', dofSamples: 16, shadowSize: 2048, bloom: true, bloomScale: 0.5, bloomMips: 5, godRaySamples: 20, sharpen: 0.4, filmFx: false, frameBudgetMs: 30 },
  'mobile-low': { maxPixelRatio: 1.5, maxPixels: 900_000, msaa: 0, aa: 'fxaa', taa: false, dofSamples: 0, shadowSize: 1024, bloom: true, bloomScale: 0.25, bloomMips: 4, godRaySamples: 12, sharpen: 0.4, filmFx: false, frameBudgetMs: 38 },
};

const CONTENT: Record<TierName, ContentBudget> = {
  'desktop-high': { name: 'high', nearSpacing: 1.6, farSegments: 300, grassCount: 46000, grassPatch: 54, treeScale: 1, shrubs: 4200, farTrees: 9000, rocks: 3600, motes: 700, particles: 1800, texMax: 4096, anisotropy: 8, triangleBudget: 8_000_000 },
  'desktop-medium': { name: 'medium', nearSpacing: 2.0, farSegments: 240, grassCount: 28000, grassPatch: 44, treeScale: 0.8, shrubs: 2600, farTrees: 6000, rocks: 2400, motes: 450, particles: 1500, texMax: 2048, anisotropy: 8, triangleBudget: 5_000_000 },
  'mobile-high': { name: 'low', nearSpacing: 2.4, farSegments: 200, grassCount: 15000, grassPatch: 36, treeScale: 0.65, shrubs: 1600, farTrees: 4000, rocks: 1600, motes: 300, particles: 1200, texMax: 2048, anisotropy: 4, triangleBudget: 2_500_000 },
  'mobile-low': { name: 'low', nearSpacing: 2.6, farSegments: 180, grassCount: 9000, grassPatch: 30, treeScale: 0.5, shrubs: 1000, farTrees: 2600, rocks: 1000, motes: 180, particles: 900, texMax: 1024, anisotropy: 4, triangleBudget: 1_500_000 },
};

const STORE_KEY = 'david.gpuTier.v2';
interface StoredTier { tier: TierName; scale: number; ms: number; when: number; gpu: string }

function readStored(gpu: string): StoredTier | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as StoredTier | null;
    if (!s || !TIER_LADDER.includes(s.tier) || s.gpu !== gpu) return null;
    if (Date.now() - s.when > 21 * 864e5) return null;
    return s;
  } catch {
    return null;
  }
}

function writeStored(s: StoredTier) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / blocked storage: fine */
  }
}

export function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true; // iPadOS reports as a Mac
  try {
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches && Math.min(screen.width, screen.height) < 900) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext | null): string {
  if (!gl) return '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch {
    return '';
  }
}

export function isSoftwareGpu(gpu: string) {
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

/** First guess before any measurement (the warm-up benchmark corrects it). */
function guessTier(mobile: boolean, gpu: string): TierName {
  if (!mobile) {
    if (isSoftwareGpu(gpu)) return 'desktop-high'; // headless test rigs: keep the reference look
    if (/Intel.*(HD Graphics|UHD Graphics 6\d\d)|GMA|Mali|Adreno|PowerVR|Apple GPU/i.test(gpu)) return 'desktop-medium';
    return 'desktop-high';
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem <= 3) return 'mobile-low';
  if (isSoftwareGpu(gpu)) return 'mobile-high'; // device emulation in tests
  if (/Apple/i.test(gpu)) return 'mobile-high'; // A12+ in practice (WebGL2 Safari); the benchmark catches older ones
  const adreno = /Adreno\D*(\d{3})/i.exec(gpu);
  if (adreno) return +adreno[1] >= 640 ? 'mobile-high' : 'mobile-low';
  if (/Mali-G(7[6-9]|\d{3})|Immortalis|Xclipse|Maleoon/i.test(gpu)) return 'mobile-high';
  return 'mobile-low';
}

/** `?q=` values: a tier name, or the content names (high / medium / low; `?q=high` on a phone = mobile-high). */
function tierFromParam(p: string | null, mobile: boolean): TierName | null {
  if (!p) return null;
  if ((TIER_LADDER as readonly string[]).includes(p)) return p as TierName;
  if (p === 'high') return mobile ? 'mobile-high' : 'desktop-high';
  if (p === 'medium') return mobile ? 'mobile-high' : 'desktop-medium';
  if (p === 'low') return 'mobile-low';
  return null;
}

export function makeQuality(tier: TierName, mobile: boolean, gpu: string, renderScale = 1): Quality {
  return { ...RENDER[tier], ...CONTENT[tier], tier, mobile, gpu, renderScale, pixelRatio: 1 };
}

/**
 * Initial quality: `?q=` (low|medium|high or a tier name) forces a tier and disables the benchmark;
 * otherwise the last benchmark result stored on this device, otherwise a guess from the GPU string.
 */
export function detectQuality(gl: WebGLRenderingContext | WebGL2RenderingContext | null = null): Quality & { forced: boolean } {
  const params = new URLSearchParams(location.search);
  const mobile = isMobileDevice();
  const gpu = gpuName(gl);
  const forced = tierFromParam(params.get('q'), mobile);
  const stored = forced ? null : readStored(gpu);
  const q = forced
    ? { ...makeQuality(forced, mobile, gpu), forced: true }
    : stored
      ? { ...makeQuality(stored.tier, mobile, gpu, stored.scale), forced: false }
      : { ...makeQuality(guessTier(mobile, gpu), mobile, gpu), forced: false };
  // developer A/B overrides: ?pr=1.5 (max pixel ratio), ?sharpen=0..1, ?aa=fxaa|none, ?msaa=0|2|4, ?texmax=512,
  // ?taa=0|1|hq|lq, ?dof=0|16|22|43
  const num = (k: string) => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : null);
  const pr = num('pr'), sh = num('sharpen'), ms = num('msaa'), tm = num('texmax');
  if (pr !== null) { q.maxPixelRatio = pr; q.maxPixels = 1e9; q.forced = true; }
  if (sh !== null) q.sharpen = Math.max(0, Math.min(1, sh));
  if (ms !== null) q.msaa = ms;
  if (tm !== null) q.texMax = Math.max(64, tm);
  const aa = params.get('aa');
  if (aa === 'fxaa' || aa === 'none') q.aa = aa;
  const taa = params.get('taa');
  if (taa === '0' || taa === 'off') q.taa = false;
  else if (taa === '1' || taa === 'hq') q.taa = 'hq';
  else if (taa === 'lq') q.taa = 'lq';
  const dof = num('dof');
  if (dof !== null) q.dofSamples = Math.max(0, dof);
  return q;
}

export interface BenchView {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export interface BenchResult {
  tier: TierName;
  renderScale: number;
  /** measured synchronous frame time (ms) at the chosen settings */
  ms: number;
  pixelRatio: number;
  log: string[];
}

// =====================================================================================================
// Texture budget helpers
// =====================================================================================================

/** Texture slots whose alpha channel is never read: safe to resample through a (premultiplied) 2D canvas. */
const OPAQUE_SLOTS = new Set([
  'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap', 'specularMap',
  'specularIntensityMap', 'specularColorMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
  'sheenColorMap', 'sheenRoughnessMap', 'thicknessMap', 'lightMap', 'anisotropyMap', 'iridescenceMap',
]);

/**
 * Every texture referenced by the materials under `root` (standard slots and ShaderMaterial uniforms).
 * The value tells whether the texture may be resampled on the CPU: only opaque data (`map` of an opaque
 * material, normal / roughness / ... maps). Alpha-tested or blended colour maps and custom-shader
 * uniforms are never resampled (a 2D canvas premultiplies alpha: cut-out foliage would get dark fringes).
 */
function collectTextures(root: THREE.Object3D): Map<THREE.Texture, boolean> {
  const out = new Map<THREE.Texture, boolean>();
  const seen = new Set<THREE.Material>();
  const add = (v: unknown, resampleOk: boolean) => {
    if (!v || !(v as THREE.Texture).isTexture) return;
    const t = v as THREE.Texture;
    out.set(t, (out.get(t) ?? true) && resampleOk);
  };
  root.traverse((o) => {
    const holder = o as THREE.Mesh & { customDepthMaterial?: THREE.Material; customDistanceMaterial?: THREE.Material };
    const mats: (THREE.Material | undefined)[] = [];
    if (Array.isArray(holder.material)) mats.push(...holder.material);
    else mats.push(holder.material as THREE.Material | undefined);
    mats.push(holder.customDepthMaterial, holder.customDistanceMaterial);
    for (const m of mats) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      const cutout = m.transparent || m.alphaTest > 0 || m.alphaHash || m.alphaToCoverage || !!(m as THREE.MeshStandardMaterial).alphaMap;
      for (const [k, v] of Object.entries(m)) add(v, OPAQUE_SLOTS.has(k) || (k === 'map' && !cutout));
      const uniforms = (m as THREE.ShaderMaterial).uniforms;
      if (uniforms) {
        for (const u of Object.values(uniforms)) {
          const val = u?.value as unknown;
          if (Array.isArray(val)) val.forEach((x) => add(x, false));
          else add(val, false);
        }
      }
    }
  });
  return out;
}

/** JPEG-decoded images carry no alpha: always safe to resample. */
function isJpegImage(img: unknown): boolean {
  if (typeof HTMLImageElement === 'undefined' || !(img instanceof HTMLImageElement)) return false;
  const src = img.currentSrc || img.src || '';
  return /^data:image\/jpe?g/i.test(src) || /\.jpe?g(\?|#|$)/i.test(src);
}

/** Pixel size of a texture's CPU-side image, if it is a decoded browser image. */
function imageSize(img: unknown): { w: number; h: number; bitmap: boolean } | null {
  if (!img) return null;
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0 ? { w: img.naturalWidth, h: img.naturalHeight, bitmap: false } : null;
  }
  if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) return { w: img.width, h: img.height, bitmap: false };
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) return { w: img.width, h: img.height, bitmap: true };
  return null;
}

/** Area-filtered CPU downscale: repeated 2x halving (box filter, no aliasing), then one bilinear step. */
function downscaleImage(img: CanvasImageSource, w: number, h: number, tw: number, th: number): HTMLCanvasElement | null {
  let src = img;
  let sw = w, sh = h;
  for (;;) {
    const halve = sw >= tw * 2 && sh >= th * 2;
    const nw = halve ? Math.round(sw / 2) : tw;
    const nh = halve ? Math.round(sh / 2) : th;
    const c = document.createElement('canvas');
    c.width = nw;
    c.height = nh;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, sw, sh, 0, 0, nw, nh);
    if (nw === tw && nh === th) return c;
    src = c;
    sw = nw;
    sh = nh;
  }
}

// =====================================================================================================
// Spatial chunking of static instanced scenery
// =====================================================================================================

export interface ChunkOptions {
  /** smallest cell edge in metres (default 150) */
  minCell?: number;
  /** most cells along one axis (default 5, i.e. <= 25 chunks per mesh: bounded draw-call growth) */
  maxAxis?: number;
  /** meshes with fewer instances are left alone (default 64) */
  minInstances?: number;
  /** meshes drawing fewer triangles in total are left alone: not worth the extra draw calls (default 40000) */
  minTriangles?: number;
}

/**
 * Splits one static InstancedMesh into spatial chunks (an XZ grid in the mesh's local space) that share
 * its geometry and material. An InstancedMesh spread over the whole map has one huge bounding sphere, so
 * without this every instance is drawn every frame, twice (camera + sun shadow pass), even though the
 * shadow camera only covers ~110 m. Returns the group that replaced the mesh, or null if not worth it.
 */
export function chunkInstancedMesh(mesh: THREE.InstancedMesh, opts: ChunkOptions = {}): THREE.Group | null {
  const n = mesh.count;
  const minCell = opts.minCell ?? 150, maxAxis = opts.maxAxis ?? 5;
  // (frustumCulled = false: splitting would only add draw calls)
  if (n < (opts.minInstances ?? 64) || !mesh.parent || mesh.children.length || !mesh.frustumCulled) return null;
  const g0 = mesh.geometry;
  const triangles = ((g0.index ? g0.index.count : (g0.attributes.position?.count ?? 0)) / 3) * n;
  if (triangles < (opts.minTriangles ?? 40000)) return null;
  if (mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || mesh.morphTexture) return null;
  const src = mesh.instanceMatrix.array as Float32Array;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = src[i * 16 + 12], z = src[i * 16 + 14];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const cell = Math.max(minCell, (x1 - x0) / maxAxis, (z1 - z0) / maxAxis);
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell + 1e-6)), nz = Math.max(1, Math.ceil((z1 - z0) / cell + 1e-6));
  if (nx * nz < 3) return null;
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const cx = Math.min(nx - 1, Math.floor((src[i * 16 + 12] - x0) / cell));
    const cz = Math.min(nz - 1, Math.floor((src[i * 16 + 14] - z0) / cell));
    const key = cz * nx + cx;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = []));
    b.push(i);
  }
  const geo = mesh.geometry;
  const instAttrs = Object.entries(geo.attributes).filter(([, a]) => (a as THREE.InstancedBufferAttribute).isInstancedBufferAttribute) as [string, THREE.InstancedBufferAttribute][];
  const group = new THREE.Group();
  group.name = (mesh.name || 'instanced') + ':chunks';
  if (mesh.matrixAutoUpdate) mesh.updateMatrix();
  mesh.matrix.decompose(group.position, group.quaternion, group.scale);
  group.matrixAutoUpdate = mesh.matrixAutoUpdate;
  if (!group.matrixAutoUpdate) group.matrix.copy(mesh.matrix);
  group.visible = mesh.visible;
  group.renderOrder = mesh.renderOrder;
  group.userData = { chunkedFrom: mesh };
  const holder = mesh as THREE.InstancedMesh & { customDepthMaterial?: THREE.Material; customDistanceMaterial?: THREE.Material };
  for (const [key, idx] of buckets) {
    let g = geo;
    if (instAttrs.length) {
      // per-instance attributes live on the geometry: give the chunk a shallow copy with sliced data
      g = new THREE.BufferGeometry();
      g.index = geo.index;
      for (const [name, a] of Object.entries(geo.attributes)) g.setAttribute(name, a);
      for (const [name, a] of instAttrs) {
        const Arr = a.array.constructor as new (len: number) => THREE.TypedArray;
        const out = new Arr(idx.length * a.itemSize);
        idx.forEach((i, j) => {
          for (let c = 0; c < a.itemSize; c++) out[j * a.itemSize + c] = a.array[i * a.itemSize + c];
        });
        g.setAttribute(name, new THREE.InstancedBufferAttribute(out, a.itemSize, a.normalized, a.meshPerAttribute));
      }
      g.morphAttributes = geo.morphAttributes;
      g.morphTargetsRelative = geo.morphTargetsRelative;
      for (const gr of geo.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
      g.setDrawRange(geo.drawRange.start, geo.drawRange.count);
      g.boundingBox = geo.boundingBox;
      g.boundingSphere = geo.boundingSphere;
    }
    const c = new THREE.InstancedMesh(g, mesh.material, idx.length);
    const dst = c.instanceMatrix.array as Float32Array;
    idx.forEach((i, j) => dst.set(src.subarray(i * 16, i * 16 + 16), j * 16));
    if (mesh.instanceColor) {
      const ic = mesh.instanceColor.array as Float32Array;
      const out = new Float32Array(idx.length * 3);
      idx.forEach((i, j) => out.set(ic.subarray(i * 3, i * 3 + 3), j * 3));
      c.instanceColor = new THREE.InstancedBufferAttribute(out, 3);
    }
    c.name = `${mesh.name || 'instanced'}#${key}`;
    c.castShadow = mesh.castShadow;
    c.receiveShadow = mesh.receiveShadow;
    c.renderOrder = mesh.renderOrder;
    c.layers.mask = mesh.layers.mask;
    c.customDepthMaterial = holder.customDepthMaterial;
    c.customDistanceMaterial = holder.customDistanceMaterial;
    c.userData = { ...mesh.userData };
    c.computeBoundingSphere();
    c.boundingSphere!.radius += 3; // headroom for vertex-shader displacement (wind, ground conforming)
    group.add(c);
  }
  const parent = mesh.parent;
  const at = parent.children.indexOf(mesh);
  parent.remove(mesh);
  parent.add(group);
  // keep the original draw order among siblings
  parent.children.splice(parent.children.indexOf(group), 1);
  parent.children.splice(at, 0, group);
  return group;
}

/**
 * true when any texel of a (resampled) canvas is not opaque. The canvas stores premultiplied 8-bit colour,
 * so an image whose alpha carries data (height / AO packed into alpha, cut-outs) must not go through it:
 * where alpha is 0 the colour is lost entirely, where it is low the colour is quantised.
 */
function canvasHasAlpha(c: HTMLCanvasElement): boolean {
  const ctx = c.getContext('2d');
  if (!ctx) return true;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

export interface TextureBudgetReport {
  /** image textures inspected */
  textures: number;
  /** textures resampled down to quality.texMax */
  downscaled: number;
  /** textures above texMax that could not be resampled safely (alpha / custom shader / keepSize) */
  oversized: string[];
  /** estimated GPU bytes of the inspected image textures (RGBA8 + mip chain) after the pass */
  bytes: number;
}

export interface MemoryReport {
  textureMB: number;
  textures: number;
  geometryMB: number;
  geometries: number;
  /** triangles of every mesh under the root (instanced meshes x instance count), before culling */
  sceneTriangles: number;
  /** HDR targets, depth, bloom mips, shadow map and the canvas' own buffers */
  renderTargetsMB: number;
  totalMB: number;
}

/**
 * Another world rendered through the engine's ONE post chain (same targets, same tier settings): Saul's house at
 * Gibeah in the intro, any future set. See Engine.setView. Everything but `scene` is optional.
 */
export interface ViewSpec {
  scene: THREE.Scene;
  /** camera for this view (default: engine.camera, which the CameraRig drives) */
  camera?: THREE.PerspectiveCamera;
  /**
   * the view's sky: its `cubeTarget.texture` colours the aerial perspective; `update(camera, focus)` runs every
   * frame (sky dome follows the camera, sun shadow framing) unless `update` below is given
   */
  sky?: { cubeTarget: { texture: THREE.Texture }; update(camera: THREE.Camera, focus: THREE.Vector3): void } | null;
  /** renderer.toneMappingExposure for this view (a number, or read every frame, e.g. () => palace.exposure) */
  exposure?: number | (() => number);
  /** atmosphere (aerial perspective / god rays) of this view; unspecified values keep the world's */
  atmosphere?: { density?: number; heightFalloff?: number; baseHeight?: number; godRays?: number; hazeTint?: THREE.ColorRepresentation };
  /** extra post configuration applied after `atmosphere` (e.g. (p) => palace.configurePost(p)); undone on leave */
  configurePost?: (post: PostFX) => void;
  /**
   * per-frame update of the view's own content, called with the game dt before rendering (e.g.
   * (dt, cam) => palace.update(dt, cam)). Called with dt = 0 on the first frame after setView / resetTemporal
   * so smoothed state (exposure, interior blend) snaps to the new shot instead of easing in.
   */
  update?: (dt: number, camera: THREE.PerspectiveCamera) => void;
  /** shadow focus for `sky.update` when there is no `update` (default engine.focus) */
  focus?: THREE.Vector3;
  /** camera clip planes for this view (restored on leave), e.g. near 0.08 for close inserts */
  near?: number;
  far?: number;
  /** called when the engine leaves this view (after the world state is restored), e.g. () => palace.restoreSharedSun() */
  onLeave?: () => void;
}

/** Options of setView / restoreWorldView / cut. */
export interface ViewSwitchOptions {
  /** dissolve from the last frame of the outgoing view over this many seconds (0 / undefined = hard cut) */
  crossfade?: number;
  /** with crossfade: dip through this colour instead of a direct dissolve (e.g. 0x000000) */
  through?: THREE.ColorRepresentation;
}

// =====================================================================================================
// Engine
// =====================================================================================================

/** Owns renderer, scene, camera, the whole environment and the post-processing stack. */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly colliders = new Colliders();
  /** Live quality settings (same object for the whole session; render fields may change during warm-up). */
  readonly quality: Quality;
  /** true when the tier was forced with ?q= (no benchmark, no persistence) */
  readonly qualityForced: boolean;
  tex!: TextureSet;
  terrain!: Terrain;
  sky!: SkySystem;
  post!: PostFX;
  vegetation!: Vegetation;
  rocks!: Rocks;
  grass!: Grass;
  village!: Village;
  particles!: ParticleSystem;
  motes!: Motes;
  smoke!: SmokeColumns;
  readonly dynamic = new THREE.Group(); // things simulated in world space (sling, projectiles, fx)
  focus = new THREE.Vector3();
  timeScale = 1;

  /** WebGL context state. While lost nothing is rendered; see onContextLost / onContextRestored. */
  contextLost = false;
  onContextLost: (() => void) | null = null;
  onContextRestored: (() => void) | null = null;
  /** half-float colour targets renderable on this device */
  readonly floatTargets: boolean;

  private readonly gradeUniforms = createGradeUniforms();
  private readonly lookUniforms = createLookUniforms();
  /** active non-world view (null = the Bethlehem world) and the world state saved when it was entered */
  private activeView: ViewSpec | null = null;
  private worldState: {
    exposure: number; near: number; far: number; sunDir: THREE.Vector3; sunColor: THREE.Color;
    atmo: { density: number; heightFalloff: number; baseHeight: number; godRays: number; hazeTint: THREE.Color; tSky: THREE.Texture };
  } | null = null;
  /** next rendered frame is the first of a new shot: view.update(0) snaps smoothed state */
  private snapNext = false;

  private readonly restoreHooks: (() => void)[] = [];
  private readonly container: HTMLElement;
  private cssW = 0;
  private cssH = 0;
  private resizePending = false;
  private resizeRequestedAt = 0;
  private syncPx = new Uint8Array(4);
  private gov = { acc: 0, n: 0, strikes: 0, level: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // MSAA / FXAA happen in the post chain
      depth: false, // the default framebuffer only receives full-screen post passes
      stencil: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    const gl = this.renderer.getContext();
    const q = detectQuality(gl);
    this.qualityForced = q.forced;
    const { forced: _forced, ...quality } = q;
    this.quality = quality;
    const ext = this.renderer.extensions;
    this.floatTargets = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    if (!this.floatTargets) console.warn('[engine] float render targets unsupported: falling back to 8-bit HDR buffers');

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.58;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    // CSS size is always the full container; only the backing store follows the pixel ratio.
    canvas.style.cssText = 'display:block;position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none;outline:none';
    container.style.position ||= 'relative';
    container.appendChild(canvas);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.3, 26000);
    this.scene.add(this.dynamic);
    this.applySize(true);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // allow the browser to restore the context
      this.contextLost = true;
      console.warn('[engine] WebGL context lost');
      this.onContextLost?.();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      // three has re-initialised its GL state (its listener runs first); rebuild GPU-generated content
      this.contextLost = false;
      console.warn('[engine] WebGL context restored');
      try {
        this.sky?.capture(this.scene);
        // render-target contents are gone: start the temporal history (and any dissolve) from scratch
        this.post?.resetHistory();
        for (const h of this.restoreHooks) h();
      } catch (err) {
        console.error('[engine] restore failed', err);
      }
      this.onContextRestored?.();
    });
  }

  /** Register a callback that re-creates GPU-only content (render-to-texture bakes) after a context loss. */
  onRestore(cb: () => void) {
    this.restoreHooks.push(cb);
  }

  async build(progress: (f: number, label: string) => void) {
    const q = this.quality;
    const step = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    // world modules resolve their content tier / texture caps from the engine's quality (see WorldQuality)
    configureWorld(q);
    progress(0.02, 'טוען מרקמים…');
    this.tex = await loadTextures(this.renderer, (f) => progress(0.02 + f * 0.2, 'טוען מרקמים…'), q);
    progress(0.25, 'מעצב את הרי יהודה…');
    await step();
    this.terrain = new Terrain({ nearSpacing: q.nearSpacing, farSegments: q.farSegments });
    progress(0.45, 'מדליק את השמש…');
    await step();
    this.sky = new SkySystem(this.renderer, q.shadowSize);
    this.scene.add(this.sky.group);
    this.sky.setSun(SUN.elevation, SUN.azimuth, this.scene);
    this.terrain.build(this.tex, shared.uSunDir.value);
    this.scene.add(this.terrain.group);
    progress(0.6, 'בונה את בית לחם…');
    await step();
    this.village = new Village(this.terrain, this.tex, this.colliders);
    this.village.build();
    this.scene.add(this.village.group);
    progress(0.7, 'נוטע עצי זית…');
    await step();
    this.rocks = new Rocks(this.terrain, this.tex, this.colliders, q.rocks);
    this.rocks.build();
    this.scene.add(this.rocks.group);
    this.vegetation = new Vegetation(this.terrain, this.tex, this.colliders, { treeScale: q.treeScale, shrubs: q.shrubs, farTrees: q.farTrees });
    this.vegetation.build();
    this.scene.add(this.vegetation.group);
    progress(0.82, 'מגדל עשב…');
    await step();
    this.grass = new Grass(this.terrain, q.grassCount, q.grassPatch);
    this.scene.add(this.grass.mesh);
    this.particles = new ParticleSystem(q.particles);
    this.scene.add(this.particles.points);
    this.motes = new Motes(q.motes);
    this.scene.add(this.motes.points);
    this.smoke = new SmokeColumns(this.particles, this.village.smokeSources);
    // static scenery: spatial chunks so the camera / shadow frustums can cull (?chunk=0 to compare)
    if (new URLSearchParams(location.search).get('chunk') !== '0') {
      for (const g of [this.rocks.group, this.vegetation.group, this.village.group]) this.chunkStatic(g);
    }
    this.enforceTextureBudget();
    this.makePost();
    this.applySize(true);
    const onResize = () => this.requestResize();
    addEventListener('resize', onResize);
    addEventListener('orientationchange', onResize);
    try {
      new ResizeObserver(onResize).observe(this.container);
    } catch {
      /* old browsers: window resize is enough */
    }
    progress(0.95, 'מכין את הצאן…');
    await step();
  }

  // ------------------------------------------------------------------------------------------ sizing

  private viewSize() {
    const w = this.container.clientWidth || innerWidth || 1;
    const h = this.container.clientHeight || innerHeight || 1;
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  }

  /** Pixel ratio for a CSS viewport under the current budget. */
  computePixelRatio(w: number, h: number) {
    const q = this.quality;
    const dpr = window.devicePixelRatio || 1;
    let pr = Math.min(dpr, q.maxPixelRatio);
    const cap = q.maxPixels * q.renderScale;
    if (w * h * pr * pr > cap) pr = Math.sqrt(cap / (w * h));
    const maxTex = this.renderer.capabilities.maxTextureSize || 4096;
    pr = Math.min(pr, maxTex / w, maxTex / h);
    return Math.max(0.5, Math.floor(pr * 64) / 64);
  }

  /** Ask for a resize; it is applied (debounced) at the start of the next rendered frame. */
  requestResize() {
    this.resizePending = true;
    this.resizeRequestedAt = performance.now();
  }

  /**
   * Legacy entry point. Applied at the start of the next rendered frame (no debounce), never on the
   * spot: resizing the canvas clears it, and a cleared canvas that gets composited before the next
   * render is exactly the one-frame black flash this engine avoids.
   */
  resize() {
    this.resizePending = true;
    this.resizeRequestedAt = -Infinity;
  }

  private applySize(force = false) {
    const { w, h } = this.viewSize();
    const pr = this.computePixelRatio(w, h);
    if (!force && w === this.cssW && h === this.cssH && pr === this.quality.pixelRatio) return;
    this.cssW = w;
    this.cssH = h;
    this.quality.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const bw = Math.floor(w * pr), bh = Math.floor(h * pr);
    this.post?.setSize(bw, bh);
    this.particles?.setPixelScale(h * pr, this.camera.fov);
    this.motes?.setPixelScale(h * pr, this.camera.fov);
  }

  private flushResize() {
    if (!this.resizePending) return;
    // debounce: while the viewport animates (rotation, toolbars) the canvas is just CSS-stretched
    if (performance.now() - this.resizeRequestedAt < 150) return;
    this.resizePending = false;
    this.applySize(false);
  }

  setFov(fov: number) {
    if (Math.abs(this.camera.fov - fov) < 0.01) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.particles.setPixelScale(this.cssH * pr, fov);
    this.motes.setPixelScale(this.cssH * pr, fov);
  }

  // ------------------------------------------------------------------------------------------ post / tiers

  private makePost() {
    const q = this.quality;
    const prevDoF: DoFSettings | null = this.post ? { ...this.post.dofSettings } : null;
    this.post?.dispose();
    this.post = new PostFX(this.renderer, this.scene, this.camera, this.sky.cubeTarget.texture, {
      msaa: q.msaa, bloom: q.bloom, godRaySamples: q.godRaySamples, pixelRatio: q.pixelRatio,
      aa: q.aa, taa: q.taa, dofSamples: q.dofSamples, sharpen: q.sharpen, filmFx: q.filmFx,
      bloomScale: q.bloomScale, bloomMips: q.bloomMips,
      colorType: this.floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
      gradeUniforms: this.gradeUniforms,
      lookUniforms: this.lookUniforms,
    });
    if (prevDoF) this.post.setDoF(prevDoF);
    if (this.activeView) this.bindView(this.activeView);
    this.post.setSize(Math.floor(this.cssW * q.pixelRatio), Math.floor(this.cssH * q.pixelRatio));
    // developer A/B: ?bloomfx=strength,radius,threshold
    const bfx = new URLSearchParams(location.search).get('bloomfx');
    if (bfx && this.post.bloom) {
      const [st, ra, th] = bfx.split(',').map(Number);
      if (Number.isFinite(st)) this.post.bloom.strength = st;
      if (Number.isFinite(ra)) this.post.bloom.radius = ra;
      if (Number.isFinite(th)) this.post.bloom.threshold = th;
    }
  }

  private setShadowSize(size: number) {
    const sun = this.sky.sun;
    if (sun.shadow.mapSize.x === size) return;
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    (sun.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
  }

  /** Switch the render budget (not the content) to another tier. Resizes the canvas: loading screen only. */
  private applyRenderTier(tier: TierName, renderScale = 1) {
    Object.assign(this.quality, RENDER[tier], { tier, renderScale });
    this.setShadowSize(this.quality.shadowSize);
    this.applySize(true);
    this.makePost();
  }

  // ------------------------------------------------------------------------------------------ budgets

  /**
   * Re-buckets the big static InstancedMeshes under `root` into spatial chunks (see chunkInstancedMesh)
   * so the camera and the shadow camera can cull them. Engine applies it to the rocks, vegetation and
   * village groups right after they are built. Skips meshes marked `userData.dynamic` / `userData.noChunk`
   * (anything whose instances are rewritten at runtime must set one of them). Returns meshes split.
   */
  chunkStatic(root: THREE.Object3D, opts?: ChunkOptions): number {
    const targets: THREE.InstancedMesh[] = [];
    root.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh && !im.userData.dynamic && !im.userData.noChunk && !o.parent?.userData.chunkedFrom) targets.push(im);
    });
    let split = 0;
    for (const im of targets) if (chunkInstancedMesh(im, opts)) split++;
    return split;
  }

  /**
   * Textures under `root` (see collectTextures); for the whole scene also the engine's shared TextureSet,
   * which custom terrain / world shaders sample through uniforms that are not discoverable on materials
   * (resampled only when JPEG-decoded, i.e. certainly without alpha).
   */
  private textureMap(root: THREE.Object3D): Map<THREE.Texture, boolean> {
    const map = collectTextures(root);
    if (root === this.scene && this.tex) {
      for (const t of Object.values(this.tex) as THREE.Texture[]) map.set(t, (map.get(t) ?? true) && isJpegImage(t.image));
    }
    return map;
  }

  /**
   * Keeps GPU texture memory inside the tier budget. Every decoded image texture under `root` larger
   * than quality.texMax is resampled on the CPU (before its first upload; it is re-uploaded if it was
   * already on the GPU) and anisotropy is capped at quality.anisotropy. Leaves alone: DataTextures,
   * render-target / video / compressed / cube textures, alpha-tested or blended colour maps and custom
   * shader uniforms (see collectTextures), any image whose alpha is not fully opaque (checked after the
   * resample: alpha-packed height / AO would be destroyed by the premultiplied canvas), and any texture
   * with `userData.keepSize = true`. Those are reported in `oversized` (and logged) instead.
   * Engine runs it on the whole scene at the end of build() and at the start of warmup(); modules that
   * add big content later can call it on their own root.
   */
  enforceTextureBudget(root: THREE.Object3D = this.scene): TextureBudgetReport {
    const q = this.quality;
    const rep: TextureBudgetReport = { textures: 0, downscaled: 0, oversized: [], bytes: 0 };
    for (const [t, resampleOk] of this.textureMap(root)) {
      const tex = t as THREE.Texture & { isRenderTargetTexture?: boolean; isVideoTexture?: boolean; isCompressedTexture?: boolean; isCubeTexture?: boolean; isDataTexture?: boolean };
      if (tex.isRenderTargetTexture || tex.isVideoTexture || tex.isCompressedTexture || tex.isCubeTexture || tex.isDataTexture) continue;
      if (tex.anisotropy > q.anisotropy) {
        tex.anisotropy = q.anisotropy;
        tex.needsUpdate = true;
      }
      let s = imageSize(tex.image);
      if (!s) continue;
      rep.textures++;
      const big = Math.max(s.w, s.h);
      if (big > q.texMax) {
        if (resampleOk && !tex.userData?.keepSize) {
          const k = q.texMax / big;
          const tw = Math.max(1, Math.round(s.w * k)), th = Math.max(1, Math.round(s.h * k));
          const c = downscaleImage(tex.image as CanvasImageSource, s.w, s.h, tw, th);
          if (c && canvasHasAlpha(c)) rep.oversized.push(`${tex.name || tex.uuid.slice(0, 8)} ${s.w}x${s.h} (alpha data)`);
          else if (c) {
            tex.dispose(); // immutable GL storage: an already uploaded texture must be re-allocated
            // ImageBitmaps are uploaded as they are (WebGL ignores flipY / premultiply for them); a canvas
            // is not, so keep the orientation the bitmap was uploaded with
            if (s.bitmap) tex.flipY = false;
            tex.image = c;
            tex.needsUpdate = true;
            rep.downscaled++;
            s = { w: tw, h: th, bitmap: false };
          }
        } else rep.oversized.push(`${tex.name || tex.uuid.slice(0, 8)} ${s.w}x${s.h}`);
      }
      const mips = tex.generateMipmaps && tex.minFilter !== THREE.NearestFilter && tex.minFilter !== THREE.LinearFilter;
      rep.bytes += s.w * s.h * 4 * (mips ? 4 / 3 : 1);
    }
    if (rep.downscaled || rep.oversized.length) {
      console.info(`[engine] texture budget ${q.texMax}px: ${rep.downscaled} resampled` + (rep.oversized.length ? `, kept (alpha/custom): ${rep.oversized.join(', ')}` : ''));
    }
    return rep;
  }

  /** Rough GPU memory estimate of the scene and the renderer's own targets (diagnostics / tests). */
  memoryReport(root: THREE.Object3D = this.scene): MemoryReport {
    const q = this.quality;
    const MB = 1 / (1024 * 1024);
    let texBytes = 0, textures = 0;
    for (const [t] of this.textureMap(root)) {
      const tex = t as THREE.Texture & { isRenderTargetTexture?: boolean };
      if (tex.isRenderTargetTexture) continue;
      const img = tex.image as { width?: number; height?: number; data?: ArrayBufferView } | null;
      const s = imageSize(img) ?? (img && typeof img.width === 'number' && typeof img.height === 'number' ? { w: img.width, h: img.height } : null);
      if (!s) continue;
      const bpp = img?.data ? Math.max(1, img.data.byteLength / Math.max(1, s.w * s.h)) : 4;
      const mips = tex.generateMipmaps && tex.minFilter !== THREE.NearestFilter && tex.minFilter !== THREE.LinearFilter;
      texBytes += s.w * s.h * bpp * (mips ? 4 / 3 : 1);
      textures++;
    }
    const geos = new Set<THREE.BufferGeometry>();
    const arrays = new Set<ArrayBufferLike>();
    let geoBytes = 0, tris = 0;
    const addArray = (a: ArrayBufferView | undefined) => {
      if (a && !arrays.has(a.buffer)) {
        arrays.add(a.buffer);
        geoBytes += a.byteLength;
      }
    };
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      const g = m.geometry as THREE.BufferGeometry | undefined;
      if (!g || !g.isBufferGeometry) return;
      const inst = (m as unknown as THREE.InstancedMesh).isInstancedMesh ? (m as unknown as THREE.InstancedMesh) : null;
      if (m.isMesh) {
        const n = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
        tris += (Math.min(n, g.drawRange.count) / 3) * (inst ? inst.count : 1);
      }
      if (inst) {
        addArray(inst.instanceMatrix.array);
        addArray(inst.instanceColor?.array);
      }
      if (geos.has(g)) return;
      geos.add(g);
      for (const a of Object.values(g.attributes)) {
        const ia = a as THREE.InterleavedBufferAttribute;
        addArray(ia.isInterleavedBufferAttribute ? ia.data.array : (a as THREE.BufferAttribute).array);
      }
      addArray(g.index?.array);
    });
    // renderer-owned targets: the post chain (scene colour + MSAA + depth, 2 buffers, TAA history, DoF, bloom),
    // shadow map (RGBA8 + depth), canvas (double buffered)
    const px = Math.floor(this.cssW * q.pixelRatio) * Math.floor(this.cssH * q.pixelRatio);
    let rt = px * 4 * 2 + (this.post?.bytes ?? 0);
    const sh = this.sky?.sun.shadow.mapSize.x ?? q.shadowSize;
    rt += sh * sh * 8;
    const r = (x: number) => Math.round(x * MB * 10) / 10;
    return {
      textureMB: r(texBytes), textures, geometryMB: r(geoBytes), geometries: geos.size, sceneTriangles: Math.round(tris),
      renderTargetsMB: r(rt), totalMB: r(texBytes + geoBytes + rt),
    };
  }

  /** Render one frame of the current scene state without advancing time. */
  private renderStill() {
    shared.uCamPos.value.copy(this.camera.position);
    this.camera.updateMatrixWorld();
    this.sky.update(this.camera, this.focus);
    this.post.render(0);
  }

  /** Block until the GPU finished the frame (1-pixel read of the default framebuffer). */
  private gpuSync() {
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.syncPx);
  }

  /**
   * Compile every material (also of objects that are hidden right now, e.g. the bear) for the HDR target, so
   * no shader compiles mid-game (a multi-hundred-ms hitch on phones). `scene` / `camera` default to the world;
   * pass another view's scene (e.g. palace.scene) to prepare it during loading — or use precompileView().
   */
  async precompile(scene: THREE.Scene = this.scene, camera: THREE.Camera = this.camera) {
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const prev = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(this.post.sceneTarget);
      // bounded: compileAsync polls forever if the context is lost mid-way
      await Promise.race([this.renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 12000))]);
    } catch (e) {
      console.warn('[engine] precompile failed', e);
    } finally {
      for (const o of hidden) o.visible = false;
      this.renderer.setRenderTarget(prev);
    }
  }

  /**
   * Prepare another view during loading so the first cut to it is never unlit, black or half-initialised:
   * compiles its materials (hidden objects included) for this post chain, renders one full frame from each
   * pose (uploads textures, allocates its shadow map, first-use programs incl. the depth-of-field passes) and
   * returns to the view that was active before. Renders go to the canvas: call it behind the loading screen.
   */
  async precompileView(view: ViewSpec, poses: BenchView[] = []) {
    const back = this.activeView;
    const cam = view.camera ?? this.camera;
    const pos = cam.position.clone(), quat = cam.quaternion.clone();
    this.setView(view);
    await this.precompile(view.scene, cam);
    const dof = this.post.dofSettings.enabled;
    for (const p of poses.length ? poses : [{ pos: pos.clone(), look: pos.clone().add(cam.getWorldDirection(new THREE.Vector3())) }]) {
      cam.position.copy(p.pos);
      cam.lookAt(p.look);
      cam.updateMatrixWorld();
      this.renderViewFrame(0, 0);
    }
    this.post.setDoF({ enabled: true });
    this.renderViewFrame(0, 0);
    this.post.warmupPasses();
    this.post.setDoF({ enabled: dof });
    this.gpuSync();
    cam.position.copy(pos);
    cam.quaternion.copy(quat);
    cam.updateMatrixWorld();
    if (back) this.setView(back);
    else this.restoreWorldView();
  }

  // ------------------------------------------------------------------------------------------ views (intro)

  /**
   * Render another world (e.g. Saul's house at Gibeah) through the engine's post chain until restoreWorldView():
   * swaps the scene / camera / sky cube of the ONE PostFX (no render targets reallocated), applies the view's
   * exposure, atmosphere and clip planes, and resets the temporal history. The world state (exposure, atmosphere,
   * sun uniforms, clip planes) is saved on the first switch away from the world and restored on the way back.
   * `crossfade` dissolves from the last frame of the outgoing view (see PostFX.crossfade).
   *
   *   engine.setView({ scene: palace.scene, sky: palace.sky, exposure: () => palace.exposure,
   *                    update: (dt, cam) => palace.update(dt, cam), configurePost: (p) => palace.configurePost(p),
   *                    near: 0.08, onLeave: () => palace.restoreSharedSun() }, { crossfade: 1.2 });
   *   ... engine.restoreWorldView({ crossfade: 1.2 });
   */
  setView(view: ViewSpec, opts: ViewSwitchOptions = {}) {
    if (opts.crossfade && opts.crossfade > 0) this.post.crossfade(opts.crossfade, { through: opts.through });
    if (this.activeView && this.activeView !== view) this.leaveView();
    if (!this.worldState) {
      const a = this.post.atmosphere.uniforms;
      this.worldState = {
        exposure: this.renderer.toneMappingExposure,
        near: this.camera.near,
        far: this.camera.far,
        sunDir: shared.uSunDir.value.clone(),
        sunColor: shared.uSunColor.value.clone(),
        atmo: {
          density: a.uDensity.value, heightFalloff: a.uHeightFalloff.value, baseHeight: a.uBaseHeight.value,
          godRays: a.uGodRays.value, hazeTint: (a.uHazeTint.value as THREE.Color).clone(), tSky: a.tSky.value,
        },
      };
    }
    this.activeView = view;
    this.bindView(view);
  }

  /** Back to the Bethlehem world (restores exposure, atmosphere, sun uniforms, clip planes); see setView. */
  restoreWorldView(opts: ViewSwitchOptions = {}) {
    if (opts.crossfade && opts.crossfade > 0) this.post.crossfade(opts.crossfade, { through: opts.through });
    if (this.activeView) this.leaveView();
    this.activeView = null;
    this.post.setView(this.scene, this.camera, this.sky.cubeTarget.texture);
    this.snapNext = true;
  }

  /** The active non-world view, or null while the world renders. */
  get view(): ViewSpec | null {
    return this.activeView;
  }

  /**
   * A camera cut inside the current view: forget the temporal history (no ghost of the previous shot) and snap
   * the view's smoothed state on the next frame. The intro calls this on every cut. Optional crossfade.
   */
  resetTemporal(opts: ViewSwitchOptions = {}) {
    if (opts.crossfade && opts.crossfade > 0) this.post.crossfade(opts.crossfade, { through: opts.through });
    this.post.resetHistory();
    this.snapNext = true;
  }

  /** Dissolve from the last rendered frame into the next frames (see PostFX.crossfade). */
  crossfade(seconds: number, opts: { through?: THREE.ColorRepresentation } = {}) {
    return this.post.crossfade(seconds, opts);
  }

  private bindView(view: ViewSpec) {
    const cam = view.camera ?? this.camera;
    const sky = view.sky ?? null;
    this.post.setView(view.scene, cam, sky ? sky.cubeTarget.texture : null);
    const a = this.post.atmosphere.uniforms;
    const at = view.atmosphere;
    if (at) {
      if (at.density !== undefined) a.uDensity.value = at.density;
      if (at.heightFalloff !== undefined) a.uHeightFalloff.value = at.heightFalloff;
      if (at.baseHeight !== undefined) a.uBaseHeight.value = at.baseHeight;
      if (at.godRays !== undefined) a.uGodRays.value = at.godRays;
      if (at.hazeTint !== undefined) (a.uHazeTint.value as THREE.Color).set(at.hazeTint);
    }
    view.configurePost?.(this.post);
    if (view.near !== undefined || view.far !== undefined) {
      if (view.near !== undefined) cam.near = view.near;
      if (view.far !== undefined) cam.far = view.far;
      cam.updateProjectionMatrix();
    }
    this.snapNext = true;
  }

  /** Undo a view's settings: world atmosphere, exposure, sun uniforms, clip planes. */
  private leaveView() {
    const v = this.activeView;
    const w = this.worldState;
    if (w) {
      const a = this.post.atmosphere.uniforms;
      a.uDensity.value = w.atmo.density;
      a.uHeightFalloff.value = w.atmo.heightFalloff;
      a.uBaseHeight.value = w.atmo.baseHeight;
      a.uGodRays.value = w.atmo.godRays;
      (a.uHazeTint.value as THREE.Color).copy(w.atmo.hazeTint);
      a.tSky.value = w.atmo.tSky;
      this.renderer.toneMappingExposure = w.exposure;
      shared.uSunDir.value.copy(w.sunDir);
      shared.uSunColor.value.copy(w.sunColor);
      const cam = v?.camera ?? this.camera;
      if (v && (v.near !== undefined || v.far !== undefined)) {
        cam.near = w.near;
        cam.far = w.far;
        cam.updateProjectionMatrix();
      }
    }
    v?.onLeave?.();
  }

  /** Per-frame view update + render of the active view (non-world). */
  private renderViewFrame(dt: number, gdt: number) {
    const v = this.activeView!;
    const cam = v.camera ?? this.camera;
    cam.updateMatrixWorld();
    shared.uCamPos.value.copy(cam.position);
    const vdt = this.snapNext ? 0 : gdt;
    if (v.update) v.update(vdt, cam);
    else v.sky?.update(cam, v.focus ?? this.focus);
    if (v.exposure !== undefined) this.renderer.toneMappingExposure = typeof v.exposure === 'function' ? v.exposure() : v.exposure;
    this.snapNext = false;
    this.post.render(dt);
  }

  /**
   * One-time warm-up behind the loading screen: enforces the texture budget, pre-compiles shaders, primes
   * GPU uploads and (unless the tier is forced, the GPU is a software rasteriser or `bench` is false)
   * measures real frames of the built scene from the given views and walks the tier ladder until the
   * frame fits the tier's budget. Hysteresis: down when over budget; up one step only when under 45 % of
   * the higher tier's budget; a device that is still that fast but limited by maxPixels (tablets) gets
   * more pixels (renderScale up to 2.2) if the measured frame stays within 90 % of the budget. The result
   * is stored per device so the next session starts at the right tier. Never runs during play.
   * `force` runs the benchmark even on software GPUs / forced tiers (tests of the ladder itself).
   */
  async warmup(opts: { views?: BenchView[]; bench?: boolean; precompile?: boolean; force?: boolean } = {}): Promise<BenchResult | null> {
    const q = this.quality;
    const cam = this.camera;
    const savedPos = cam.position.clone();
    const savedQuat = cam.quaternion.clone();
    this.enforceTextureBudget();
    if (opts.precompile ?? true) await this.precompile();
    const views = opts.views?.length ? opts.views : [{ pos: cam.position.clone(), look: cam.position.clone().add(cam.getWorldDirection(new THREE.Vector3())) }];
    const setView = (v: BenchView) => {
      cam.position.copy(v.pos);
      cam.lookAt(v.look);
      cam.updateMatrixWorld();
      this.focus.copy(v.look);
    };
    const bench = !this.contextLost && (opts.force || ((opts.bench ?? true) && !this.qualityForced && !isSoftwareGpu(q.gpu)));
    if (bench || (opts.precompile ?? true)) {
      // prime: uploads, shadow maps, first-use programs
      for (const v of views) {
        setView(v);
        this.renderStill();
      }
      this.gpuSync();
    }
    let result: BenchResult | null = null;
    if (bench) {
      const log: string[] = [];
      const t0 = performance.now();
      const measure = (): number => {
        let worst = 0;
        for (const v of views) {
          setView(v);
          this.renderStill();
          this.gpuSync();
          const times: number[] = [];
          for (let i = 0; i < 5; i++) {
            const s = performance.now();
            this.renderStill();
            this.gpuSync();
            const dt = performance.now() - s;
            times.push(dt);
            if (dt > 250 || performance.now() - t0 > 6000) break;
          }
          times.sort((a, b) => a - b);
          worst = Math.max(worst, times[Math.floor(times.length / 2)]);
        }
        return worst;
      };
      const ladder = TIER_LADDER.filter((t) => (q.mobile ? t.startsWith('mobile') : true));
      let tier = q.tier;
      let ms = measure();
      log.push(`${tier}@${q.pixelRatio.toFixed(2)}: ${ms.toFixed(1)}ms`);
      // down while over budget
      while (ms > RENDER[tier].frameBudgetMs && ladder.indexOf(tier) < ladder.length - 1 && performance.now() - t0 < 6000) {
        tier = ladder[ladder.indexOf(tier) + 1];
        this.applyRenderTier(tier);
        await this.precompile();
        this.renderStill();
        ms = measure();
        log.push(`${tier}@${q.pixelRatio.toFixed(2)}: ${ms.toFixed(1)}ms`);
      }
      let scale = 1;
      if (ms > RENDER[tier].frameBudgetMs * 1.15) {
        // lowest tier and still slow: shrink the backing store a bit more (never below ~74 % linear)
        scale = Math.max(0.55, Math.min(1, RENDER[tier].frameBudgetMs / ms));
        this.applyRenderTier(tier, scale);
        this.renderStill();
        ms = measure();
        log.push(`${tier}x${scale.toFixed(2)}@${q.pixelRatio.toFixed(2)}: ${ms.toFixed(1)}ms`);
      } else if (log.length === 1) {
        // up one step (render budget only) when comfortably fast
        const i = ladder.indexOf(tier);
        const up = i > 0 ? ladder[i - 1] : null;
        let stepped = false;
        if (up && ms < RENDER[up].frameBudgetMs * 0.45) {
          this.applyRenderTier(up);
          await this.precompile();
          this.renderStill();
          const ms2 = measure();
          log.push(`${up}@${q.pixelRatio.toFixed(2)}: ${ms2.toFixed(1)}ms`);
          if (ms2 <= RENDER[up].frameBudgetMs * 0.9) {
            tier = up;
            ms = ms2;
            stepped = true;
          } else this.applyRenderTier(tier);
        }
        // still very fast but capped by maxPixels (tablets, big high-dpi screens): render more pixels
        const { w, h } = this.viewSize();
        const fullPr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);
        const want = Math.min(2.2, (w * h * fullPr * fullPr) / q.maxPixels);
        if (!stepped && want > 1.1 && ms < RENDER[tier].frameBudgetMs * 0.45 && performance.now() - t0 < 6000) {
          this.applyRenderTier(tier, want);
          this.renderStill();
          const ms2 = measure();
          log.push(`${tier}x${want.toFixed(2)}@${q.pixelRatio.toFixed(2)}: ${ms2.toFixed(1)}ms`);
          if (ms2 <= RENDER[tier].frameBudgetMs * 0.9) {
            scale = want;
            ms = ms2;
          } else this.applyRenderTier(tier);
        }
      }
      writeStored({ tier, scale, ms, when: Date.now(), gpu: q.gpu });
      result = { tier, renderScale: scale, ms, pixelRatio: q.pixelRatio, log };
      console.info('[engine] warm-up benchmark', log.join(' → '), `(${(performance.now() - t0).toFixed(0)} ms)`);
    }
    cam.position.copy(savedPos);
    cam.quaternion.copy(savedQuat);
    cam.updateMatrixWorld();
    this.gov = { acc: 0, n: 0, strikes: 0, level: 0 };
    return result;
  }

  /**
   * Runtime governor (call once per frame with the real frame time). If the frame rate stays far below
   * the tier budget for ~8 s it sheds cost WITHOUT touching the canvas size: first god-ray samples and
   * bloom, then the shadow map resolution. Never steps back up during the session (hysteresis); the
   * next session starts one tier lower.
   */
  perfTick(realDt: number, active: boolean) {
    const g = this.gov;
    if (!active || realDt > 0.5 || this.contextLost) return;
    g.acc += realDt;
    g.n++;
    if (g.acc < 4) return;
    const avgMs = (g.acc / g.n) * 1000;
    g.acc = 0;
    g.n = 0;
    if (avgMs > this.quality.frameBudgetMs * 1.6) g.strikes++;
    else g.strikes = Math.max(0, g.strikes - 1);
    if (g.strikes < 2 || g.level >= 2) return;
    g.strikes = 0;
    g.level++;
    const q = this.quality;
    if (g.level === 1) {
      q.godRaySamples = Math.max(6, Math.round(q.godRaySamples / 2));
      this.post.setGodRaySamples(q.godRaySamples);
      if (q.mobile) {
        q.bloom = false;
        this.post.setBloomEnabled(false);
      }
    } else {
      q.shadowSize = Math.max(512, q.shadowSize / 2);
      this.setShadowSize(q.shadowSize);
    }
    console.warn(`[engine] sustained ${avgMs.toFixed(1)} ms frames: degraded render budget (level ${g.level})`);
    if (!this.qualityForced) {
      const ladder = TIER_LADDER.filter((t) => (q.mobile ? t.startsWith('mobile') : true));
      const next = ladder[Math.min(ladder.length - 1, ladder.indexOf(q.tier) + 1)];
      writeStored({ tier: next, scale: q.renderScale, ms: avgMs, when: Date.now(), gpu: q.gpu });
    }
  }

  /** Degradation level applied by the runtime governor (0 = none). */
  get degradeLevel() {
    return this.gov.level;
  }

  // ------------------------------------------------------------------------------------------ frame

  /** Advance time-based environment state without rendering (used by tests). */
  tickEnvironment(gdt: number) {
    shared.uTime.value += gdt;
    shared.uCamPos.value.copy(this.camera.position);
    this.particles.update(gdt);
    this.smoke.update(gdt);
  }

  /**
   * Per-frame environment update + render. dt is real (unscaled) seconds (post: fades, letterbox, grain), gdt the
   * game dt (world / view animation). Renders the active view (setView) instead of the world when one is set.
   */
  render(dt: number, gdt: number) {
    shared.uTime.value += gdt;
    if (this.activeView) {
      if (this.contextLost) return;
      this.flushResize();
      this.renderViewFrame(dt, gdt);
      return;
    }
    shared.uCamPos.value.copy(this.camera.position);
    this.particles.update(gdt);
    this.smoke.update(gdt);
    if (this.contextLost) return;
    this.flushResize();
    this.sky.update(this.camera, this.focus);
    this.snapNext = false;
    this.post.render(dt);
  }
}
