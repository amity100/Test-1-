// Material library: procedural canvas textures (normal / roughness / albedo) + a few photo textures.
// All world geometry uses metre-scaled UVs so that textures tile consistently.
import * as THREE from 'three';

const canvas = (size) => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };

// --- Value noise (tileable) ---
function makeNoise(size, octaves = 4, seed = 1) {
  const data = new Float32Array(size * size);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let amp = 1, freq = 4, total = 0;
  for (let o = 0; o < octaves; o++) {
    const grid = new Float32Array(freq * freq);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * freq, fy = (y / size) * freq;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % freq, y1 = (y0 + 1) % freq;
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = grid[y0 * freq + x0], b = grid[y0 * freq + x1], c = grid[y1 * freq + x0], d = grid[y1 * freq + x1];
      data[y * size + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
    }
    total += amp; amp *= 0.5; freq *= 2;
  }
  for (let i = 0; i < data.length; i++) data[i] /= total;
  return data;
}

function heightToNormal(height, size, strength = 2) {
  const c = canvas(size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = height[y * size + ((x - 1 + size) % size)], r = height[y * size + ((x + 1) % size)];
    const u = height[((y - 1 + size) % size) * size + x], d = height[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(data, size, lo = 0, hi = 255) {
  const c = canvas(size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const v = lo + data[i] * (hi - lo); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, { srgb = false, repeat = 1, aniso = 16 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class MaterialLibrary {
  constructor(renderer, assetBase = './assets/') {
    this.renderer = renderer;
    this.base = assetBase;
    this.aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    this.mats = {};
    this.loader = new THREE.TextureLoader();
    this._build();
  }

  loadTex(name, srgb, repeat = 1) {
    const embedded = (typeof window !== 'undefined' && window.__VANTAGE_EMBED && window.__VANTAGE_EMBED.textures) || null;
    const t = this.loader.load(embedded && embedded[name] ? embedded[name] : this.base + 'textures/' + name);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = this.aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _build() {
    const S = 256;
    const n1 = makeNoise(S, 5, 7), n2 = makeNoise(S, 3, 13), n3 = makeNoise(S, 6, 29);

    // ---- Concrete ----
    const concAlb = canvas(S); { const ctx = concAlb.getContext('2d'); const img = ctx.createImageData(S, S);
      for (let i = 0; i < S * S; i++) { const v = 118 + (n1[i] - 0.5) * 60 + (n3[i] - 0.5) * 30; const t = 0.92 + (n2[i] - 0.5) * 0.1; img.data[i * 4] = v * t; img.data[i * 4 + 1] = v * t; img.data[i * 4 + 2] = v * (t + 0.03); img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0); }
    const concRough = grayCanvas(n3, S, 150, 235);
    const concHeight = new Float32Array(S * S); for (let i = 0; i < S * S; i++) concHeight[i] = n3[i] * 0.6 + n1[i] * 0.4;
    this.mats.concrete = new THREE.MeshStandardMaterial({ map: tex(concAlb, { srgb: true, repeat: 1 / 3, aniso: this.aniso }), roughnessMap: tex(concRough, { repeat: 1 / 3 }), normalMap: tex(heightToNormal(concHeight, S, 1.6), { repeat: 1 / 3 }), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1, metalness: 0.02, color: 0xbdbdbd });
    this.mats.concreteDark = this.mats.concrete.clone(); this.mats.concreteDark.color.set(0x8a8c90);

    // ---- Asphalt (wet) ----
    const aspAlb = canvas(S); { const ctx = aspAlb.getContext('2d'); const img = ctx.createImageData(S, S);
      for (let i = 0; i < S * S; i++) { const v = 34 + (n3[i] - 0.5) * 26 + (n1[i] > 0.62 ? 18 : 0); img.data[i * 4] = v; img.data[i * 4 + 1] = v + 1; img.data[i * 4 + 2] = v + 4; img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0); }
    const aspRough = new Float32Array(S * S); for (let i = 0; i < S * S; i++) { const p = THREE.MathUtils.smoothstep(n2[i], 0.36, 0.46); aspRough[i] = THREE.MathUtils.lerp(0.22 + n3[i] * 0.15, 0.62 + n3[i] * 0.3, p); } // puddles with soft edges
    this.mats.asphalt = new THREE.MeshStandardMaterial({ map: tex(aspAlb, { srgb: true, repeat: 1 / 4, aniso: this.aniso }), roughnessMap: tex(grayCanvas(aspRough, S, 0, 255), { repeat: 1 / 4 }), normalMap: tex(heightToNormal(n3, S, 1.2), { repeat: 1 / 4 }), normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1, metalness: 0.08, color: 0xffffff, envMapIntensity: 1.2 });

    // ---- Corrugated metal (containers, hangar walls) ----
    const corrH = new Float32Array(S * S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) corrH[y * S + x] = 0.5 + 0.5 * Math.sin((x / S) * Math.PI * 2 * 12) * 0.9 + (n3[y * S + x] - 0.5) * 0.08;
    const corrNormal = tex(heightToNormal(corrH, S, 3.2), { repeat: 1 / 2.4 });
    const paintAlb = (r, g, b) => { const c = canvas(S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
      for (let i = 0; i < S * S; i++) { const rust = n1[i] > 0.66 ? (n1[i] - 0.66) * 3 : 0; const k = 0.8 + n3[i] * 0.3; img.data[i * 4] = Math.min(255, r * k * (1 - rust) + 110 * rust); img.data[i * 4 + 1] = Math.min(255, g * k * (1 - rust) + 62 * rust); img.data[i * 4 + 2] = Math.min(255, b * k * (1 - rust) + 40 * rust); img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0); return c; };
    const metalRough = tex(grayCanvas(n1, S, 110, 210), { repeat: 1 / 2.4 });
    const mkContainer = (r, g, b) => new THREE.MeshStandardMaterial({ map: tex(paintAlb(r, g, b), { srgb: true, repeat: 1 / 2.4, aniso: this.aniso }), normalMap: corrNormal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: metalRough, roughness: 1, metalness: 0.45, envMapIntensity: 0.9 });
    this.mats.containerRed = mkContainer(150, 48, 36);
    this.mats.containerBlue = mkContainer(40, 74, 120);
    this.mats.containerGreen = mkContainer(62, 96, 60);
    this.mats.containerGray = mkContainer(96, 100, 104);
    this.mats.corrugated = new THREE.MeshStandardMaterial({ color: 0x7c8388, normalMap: corrNormal, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: metalRough, roughness: 1, metalness: 0.6, envMapIntensity: 0.8 });

    // ---- Steel plate with rivets (panels, catwalks, doors) ----
    const plateH = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let h = 0.5 + (n3[y * S + x] - 0.5) * 0.08;
      const bx = x % 128, by = y % 128; // panel seams every 128px
      if (bx < 3 || by < 3) h -= 0.35;
      for (const [rx, ry] of [[16, 16], [112, 16], [16, 112], [112, 112]]) { const d = Math.hypot(bx - rx, by - ry); if (d < 5) h += 0.4 * (1 - d / 5); }
      plateH[y * S + x] = h;
    }
    const plateNormal = tex(heightToNormal(plateH, S, 2.5), { repeat: 1 / 2 });
    const plateAlb = canvas(S); { const ctx = plateAlb.getContext('2d'); const img = ctx.createImageData(S, S);
      for (let i = 0; i < S * S; i++) { const v = 96 + (n1[i] - 0.5) * 40 + (n3[i] - 0.5) * 20; img.data[i * 4] = v; img.data[i * 4 + 1] = v + 3; img.data[i * 4 + 2] = v + 6; img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0); }
    this.mats.steel = new THREE.MeshStandardMaterial({ map: tex(plateAlb, { srgb: true, repeat: 1 / 2, aniso: this.aniso }), normalMap: plateNormal, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: metalRough, roughness: 0.85, metalness: 0.75, envMapIntensity: 1 });
    this.mats.steelDark = this.mats.steel.clone(); this.mats.steelDark.color.set(0x55595e);
    this.mats.steelYellow = this.mats.steel.clone(); this.mats.steelYellow.color.set(0xd8a21c);

    // ---- Grating (catwalk floors) ----
    const grateC = canvas(128); { const ctx = grateC.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 128); ctx.fillStyle = '#fff';
      for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) { ctx.fillRect(x, y, 16, 3); ctx.fillRect(x, y, 3, 16); } }
    const grateAlpha = tex(grateC, { repeat: 1 / 0.6 });
    this.mats.grating = new THREE.MeshStandardMaterial({ color: 0x5a5e63, alphaMap: grateAlpha, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.8 });

    // ---- Brick (photo textures) ----
    this.mats.brick = new THREE.MeshStandardMaterial({ map: this.loadTex('brick_diffuse.jpg', true, 1 / 2.5), bumpMap: this.loadTex('brick_bump.jpg', false, 1 / 2.5), bumpScale: 0.6, roughnessMap: this.loadTex('brick_roughness.jpg', false, 1 / 2.5), roughness: 1, metalness: 0, color: 0x9a9a9a });
    this.mats.brickDark = this.mats.brick.clone(); this.mats.brickDark.color.set(0x6f6a66);

    // ---- Wood (crates) ----
    this.mats.wood = new THREE.MeshStandardMaterial({ map: this.loadTex('hardwood2_diffuse.jpg', true, 1 / 1.6), bumpMap: this.loadTex('hardwood2_bump.jpg', false, 1 / 1.6), bumpScale: 0.35, roughnessMap: this.loadTex('hardwood2_roughness.jpg', false, 1 / 1.6), roughness: 1, metalness: 0, color: 0x9c8468 });

    // ---- Misc ----
    this.mats.rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.95, metalness: 0 });
    this.mats.plastic = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.6, metalness: 0.1 });
    this.mats.glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.08, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 1.5, side: THREE.DoubleSide });
    this.mats.gunmetal = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.45, metalness: 0.85 });
    this.mats.gunPolymer = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.75, metalness: 0.05 });
    this.mats.hazard = new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.7, metalness: 0.1 });
    this.mats.chainlink = (() => {
      const c = canvas(64); const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 64, 64); ctx.strokeStyle = '#cfd4d8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(32, 0); ctx.lineTo(64, 32); ctx.lineTo(32, 64); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-32, 32); ctx.lineTo(0, 0); ctx.moveTo(32, 64); ctx.lineTo(64, 32); ctx.stroke();
      const t = tex(c, { srgb: true, repeat: 1 / 0.25 });
      return new THREE.MeshStandardMaterial({ map: t, alphaMap: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.8, color: 0xffffff });
    })();
    this.mats.lightHousing = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.8 });
    this.mats.emissiveWarm = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffd28a, emissiveIntensity: 6, roughness: 0.3 });
    this.mats.emissiveCool = new THREE.MeshStandardMaterial({ color: 0xd8ecff, emissive: 0xbfe0ff, emissiveIntensity: 5, roughness: 0.3 });
    this.mats.emissiveRed = new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xff2020, emissiveIntensity: 4, roughness: 0.4 });
    this.mats.emissiveGreen = new THREE.MeshStandardMaterial({ color: 0x60ff80, emissive: 0x30ff60, emissiveIntensity: 4, roughness: 0.4 });
    this.mats.cloth = new THREE.MeshStandardMaterial({ color: 0x4a4f3a, roughness: 0.95 });
    this.mats.dirt = new THREE.MeshStandardMaterial({ map: tex(concAlb, { srgb: true, repeat: 1 / 5, aniso: this.aniso }), color: 0x5b4f3f, roughness: 1, normalMap: tex(heightToNormal(n1, S, 2.0), { repeat: 1 / 5 }), normalScale: new THREE.Vector2(0.6, 0.6) });

    this.mats.paintWhite = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.mats.paintYellow = new THREE.MeshStandardMaterial({ color: 0xd9b23a, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.mats.stain = new THREE.MeshBasicMaterial({ color: 0x08090a, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.mats.orange = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    this.mats.steelBlue = this.mats.steel.clone(); this.mats.steelBlue.color.set(0x3a5f8a);
    this.mats.concreteLight = this.mats.concrete.clone(); this.mats.concreteLight.color.set(0xd6d6d0);

    // Architect-mode ghost materials
    this.mats.ghostValid = new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true, opacity: 0.35, depthWrite: false });
    this.mats.ghostInvalid = new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.35, depthWrite: false });
    this.mats.highlight = new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.BackSide });
  }

  get(name) { return this.mats[name] || this.mats.concrete; }

  // Painted sign: text rendered to a canvas, mapped on a plane. Cached per text/colour combination.
  sign(text, { bg = '#1c1f24', fg = '#e8e6df', w = 512, h = 128, font = 'bold 72px Arial, sans-serif', border = '#c9a227' } = {}) {
    const key = text + bg + fg + w + h;
    this._signs ||= {};
    if (this._signs[key]) return this._signs[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12); }
    ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.aniso;
    return (this._signs[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2 }));
  }

  setEnvironment(envMap) {
    for (const k in this.mats) { const m = this.mats[k]; if (m.isMeshStandardMaterial) { m.envMap = envMap; m.needsUpdate = true; } }
  }
}

// Box geometry whose UVs are in metres (so tiling is consistent across sizes).
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
  return g;
}

// Wedge (ramp) geometry: width w (x), height h (y), depth d (z). Low edge at -z, high at +z.
export function wedgeGeo(w, h, d) {
  const hw = w / 2, hd = d / 2;
  const geo = new THREE.BufferGeometry();
  const v = [
    // bottom (y=0)
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
    // top (sloped)
    -hw, 0, -hd, hw, 0, -hd, hw, h, hd, -hw, h, hd,
    // back (z=+hd, vertical)
    -hw, 0, hd, hw, 0, hd, hw, h, hd, -hw, h, hd,
    // left side (x=-hw) triangle
    -hw, 0, -hd, -hw, 0, hd, -hw, h, hd,
    // right side (x=+hw)
    hw, 0, -hd, hw, h, hd, hw, 0, hd,
  ];
  const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 15, 16, 17];
  const slopeLen = Math.hypot(h, d);
  const uv = [
    0, 0, w, 0, w, d, 0, d,
    0, 0, w, 0, w, slopeLen, 0, slopeLen,
    0, 0, w, 0, w, h, 0, h,
    0, 0, d, 0, d, h,
    0, 0, d, h, d, 0,
  ];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
