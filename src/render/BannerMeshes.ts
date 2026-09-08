import * as THREE from 'three';

/**
 * Heraldic banners on the castle walls: team-coloured cloth with a cream device (chevron, cross,
 * saltire or pale with roundels), a dark border and a swallow-tailed hem, hung from an iron rod
 * and swaying in the wind. Purely decorative; nothing collides with them.
 */
function heraldry(color: string, device: number): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, w, 7);
  ctx.fillRect(0, 0, 7, h);
  ctx.fillRect(w - 7, 0, 7, h);
  ctx.fillStyle = '#f3e9d2';
  ctx.strokeStyle = '#f3e9d2';
  ctx.lineWidth = 17;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  switch (device % 4) {
    case 0: // chevron
      ctx.moveTo(14, h * 0.6);
      ctx.lineTo(w / 2, h * 0.3);
      ctx.lineTo(w - 14, h * 0.6);
      ctx.stroke();
      break;
    case 1: // cross
      ctx.moveTo(w / 2, 22);
      ctx.lineTo(w / 2, h * 0.7);
      ctx.moveTo(18, h * 0.34);
      ctx.lineTo(w - 18, h * 0.34);
      ctx.stroke();
      break;
    case 2: // saltire
      ctx.moveTo(18, 22);
      ctx.lineTo(w - 18, h * 0.66);
      ctx.moveTo(w - 18, 22);
      ctx.lineTo(18, h * 0.66);
      ctx.stroke();
      break;
    default: // pale with roundels
      ctx.fillRect(w / 2 - 9, 20, 18, h * 0.55);
      for (const y of [0.26, 0.46]) {
        ctx.beginPath();
        ctx.arc(w * 0.25, h * y, 9, 0, Math.PI * 2);
        ctx.arc(w * 0.75, h * y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  // Weave and a little fading towards the hem.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const weave = ((x + y) & 1) === 0 ? 1.04 : 0.96;
      const n = 0.95 + 0.1 * (((x * 7 + y * 13) % 17) / 17);
      const fade = 1 - 0.12 * (y / h);
      const k = weave * n * fade;
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  ctx.putImageData(img, 0, 0);
  // Swallow tail: cut a notch out of the hem.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h);
  ctx.lineTo(w / 2, h * 0.8);
  ctx.lineTo(w * 0.82, h);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

interface Banner {
  mesh: THREE.Mesh;
  base: Float32Array;
  phase: number;
  height: number;
}

export class BannerMeshes {
  readonly group = new THREE.Group();
  private items: Banner[] = [];
  private textures = new Map<string, THREE.CanvasTexture>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private iron = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, metalness: 0.85, roughness: 0.5 });
  private rodGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
  private bracketGeo = new THREE.BoxGeometry(0.06, 0.06, 1);
  private time = 0;

  constructor() {
    this.group.name = 'banners';
  }

  private material(color: string, device: number): THREE.MeshStandardMaterial {
    const key = `${color}:${device % 4}`;
    let m = this.materials.get(key);
    if (m) return m;
    let tex = this.textures.get(key);
    if (!tex) {
      tex = heraldry(color, device);
      this.textures.set(key, tex);
    }
    m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.92, metalness: 0, alphaTest: 0.5 });
    this.materials.set(key, m);
    return m;
  }

  /**
   * Hangs a banner whose rod sits at `pos`, facing along the wall normal (nx, nz). The cloth hangs
   * `height` metres down from the rod.
   */
  add(pos: THREE.Vector3, nx: number, nz: number, color: string, device = 0, height = 2.6, width = 1.1): void {
    const root = new THREE.Group();
    root.position.copy(pos);
    root.rotation.y = Math.atan2(nx, nz);
    const geo = new THREE.PlaneGeometry(width, height, 3, 9);
    geo.translate(0, -height / 2 - 0.05, 0);
    const mesh = new THREE.Mesh(geo, this.material(color, device));
    mesh.castShadow = true;
    root.add(mesh);
    const rod = new THREE.Mesh(this.rodGeo, this.iron);
    rod.scale.set(1, width + 0.3, 1);
    rod.rotation.z = Math.PI / 2;
    root.add(rod);
    // Two brackets back to the wall.
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(this.bracketGeo, this.iron);
      b.scale.set(1, 1, 0.7);
      b.position.set(sx * (width / 2 - 0.05), 0, -0.35);
      root.add(b);
    }
    this.group.add(root);
    const base = new Float32Array((geo.attributes.position as THREE.BufferAttribute).array as Float32Array);
    this.items.push({ mesh, base, phase: this.items.length * 1.7, height });
  }

  clear(): void {
    for (const it of this.items) it.mesh.geometry.dispose();
    this.items.length = 0;
    while (this.group.children.length) this.group.remove(this.group.children[0]);
  }

  get count(): number {
    return this.items.length;
  }

  /** The cloth sways: more towards the hem, a little side to side, each banner out of step with the next. */
  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const it of this.items) {
      const attr = it.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const b = it.base;
      for (let v = 0; v < arr.length; v += 3) {
        const x = b[v];
        const y = b[v + 1];
        const hang = Math.min(1, -y / it.height);
        const w = hang * hang;
        arr[v] = x + Math.sin(t * 1.3 + it.phase + y * 1.1) * 0.05 * w;
        arr[v + 1] = y;
        arr[v + 2] = (Math.sin(t * 2.6 + it.phase + y * 2.2 + x * 1.5) * 0.11 + Math.sin(t * 0.7 + it.phase) * 0.12) * w;
      }
      attr.needsUpdate = true;
      it.mesh.geometry.computeVertexNormals();
    }
  }

  dispose(): void {
    this.clear();
    for (const m of this.materials.values()) m.dispose();
    for (const tx of this.textures.values()) tx.dispose();
    this.materials.clear();
    this.textures.clear();
    this.rodGeo.dispose();
    this.bracketGeo.dispose();
    this.iron.dispose();
  }
}
