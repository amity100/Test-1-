import * as THREE from 'three';
import { clamp, smoothstep } from '../core/MathUtil';

/** Painted banner texture: owner colour, dark diagonal band, emblem and fabric weave. */
function bannerTexture(color: THREE.Color): THREE.CanvasTexture {
  const w = 256;
  const h = 160;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const base = `#${color.getHexString()}`;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Dark band
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.moveTo(w * 0.42, 0);
  ctx.lineTo(w * 0.62, 0);
  ctx.lineTo(w * 0.36, h);
  ctx.lineTo(w * 0.16, h);
  ctx.closePath();
  ctx.fill();
  // Light band
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(w * 0.66, 0);
  ctx.lineTo(w * 0.72, 0);
  ctx.lineTo(w * 0.46, h);
  ctx.lineTo(w * 0.4, h);
  ctx.closePath();
  ctx.fill();
  // Emblem: ring + star
  const ex = w * 0.68;
  const ey = h * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(ex, ey, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 24 : 10;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = ex + Math.cos(a) * r;
    const y = ey + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // Fringe on the free edge
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let y = 4; y < h; y += 12) ctx.fillRect(w - 8, y, 8, 6);
  // Weave
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const weave = ((x + y) & 1) === 0 ? 1.04 : 0.96;
      const n = 0.94 + 0.12 * (((x * 7 + y * 13) % 17) / 17);
      const k = weave * n;
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function glowSprite(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

let sharedGlow: THREE.CanvasTexture | null = null;

/**
 * The flag: a banner on a pole with cloth simulation, an owner-coloured light that brightens as
 * you approach, drifting sparkles, a halo and a short light shaft so it reads from corridors.
 */
export class FlagMesh {
  readonly group = new THREE.Group();
  private cloth: THREE.Mesh;
  private clothGeo: THREE.PlaneGeometry;
  private clothMat: THREE.MeshStandardMaterial;
  private base: Float32Array;
  private glow: THREE.PointLight;
  private beacon: THREE.Mesh;
  private halo: THREE.Sprite;
  private shaft: THREE.Mesh;
  private ring: THREE.Mesh;
  private sparks: THREE.Points;
  private sparkSeed: Float32Array;
  private ghost: THREE.Group;
  private ghostMat: THREE.MeshBasicMaterial;
  private ghostBackMat: THREE.MeshBasicMaterial;
  private beaconBase = 0;
  private fitScale = 1;
  private time = 0;
  private near = 0;
  color: THREE.Color;

  constructor(color: THREE.Color) {
    this.color = color.clone();
    if (!sharedGlow) sharedGlow = glowSprite();
    const metal = new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: 0.95, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x23282f, metalness: 0.7, roughness: 0.45 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd36a, metalness: 1, roughness: 0.22, emissive: 0x6a4a10, emissiveIntensity: 0.4 });

    // Plinth
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.55, 0.16, 6), dark);
    plinth.position.y = 0.08;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);
    const step = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 6), metal);
    step.position.y = 0.22;
    this.group.add(step);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 40), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.4 }));
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.17;
    this.group.add(this.ring);

    // Pole + finial
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.75, 12), metal);
    pole.position.y = 0.28 + 2.75 / 2;
    pole.castShadow = true;
    this.group.add(pole);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), gold);
    knob.position.y = 3.06;
    this.group.add(knob);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 10), gold);
    spike.position.y = 3.26;
    this.group.add(spike);
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.75, 8), metal);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0.82, 2.92, 0);
    this.group.add(crossbar);

    // Cloth hanging from the crossbar
    this.clothGeo = new THREE.PlaneGeometry(1.6, 1.05, 24, 14);
    this.clothGeo.translate(0.8, -0.525, 0);
    this.base = (this.clothGeo.attributes.position.array as Float32Array).slice();
    const tex = bannerTexture(color);
    this.clothMat = new THREE.MeshStandardMaterial({ map: tex, emissive: color, emissiveMap: tex, emissiveIntensity: 0.4, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 });
    this.cloth = new THREE.Mesh(this.clothGeo, this.clothMat);
    this.cloth.position.set(0.06, 2.9, 0);
    this.cloth.castShadow = true;
    this.cloth.receiveShadow = true;
    this.group.add(this.cloth);

    // Light
    this.glow = new THREE.PointLight(color, 6, 9, 1.8);
    this.glow.position.y = 2.3;
    this.group.add(this.glow);

    // Halo sprite behind the cloth
    const haloMat = new THREE.SpriteMaterial({ map: sharedGlow, color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    this.halo = new THREE.Sprite(haloMat);
    this.halo.scale.set(3.2, 3.2, 1);
    this.halo.position.set(0.7, 2.4, 0);
    this.group.add(this.halo);

    // Short light shaft
    const shaftGeo = new THREE.CylinderGeometry(0.22, 0.6, 5.5, 16, 1, true);
    shaftGeo.translate(0, 2.75, 0);
    const shaftMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.shaft = new THREE.Mesh(shaftGeo, shaftMat);
    this.group.add(this.shaft);

    // Sparkles
    const n = 56;
    const pos = new Float32Array(n * 3);
    this.sparkSeed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.sparkSeed[i * 3] = Math.random() * Math.PI * 2; // angle
      this.sparkSeed[i * 3 + 1] = 0.35 + Math.random() * 0.9; // radius
      this.sparkSeed[i * 3 + 2] = Math.random(); // phase
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparkMat = new THREE.PointsMaterial({ map: sharedGlow, color, size: 0.16, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.sparks = new THREE.Points(sparkGeo, sparkMat);
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);

    // Tall beacon shown on capture/reveal only
    const beaconMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 16, 1, true), beaconMat);
    this.beacon.position.y = 30;
    this.beacon.visible = false;
    this.group.add(this.beacon);

    // Through-wall hologram of the flag, shown to attackers closing in on the fortress.
    this.ghostMat = new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color(1, 1, 1), 0.45), transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.ghost = new THREE.Group();
    const gPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.0, 8), this.ghostMat);
    gPole.position.y = 1.7;
    const gBanner = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), this.ghostMat);
    gBanner.position.set(0.85, 2.4, 0);
    const gBase = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 32), this.ghostMat);
    gBase.rotation.x = Math.PI / 2;
    gBase.position.y = 0.17;
    for (const m of [gPole, gBanner, gBase]) {
      m.renderOrder = 1000;
      m.frustumCulled = false;
    }
    // Dark backing drawn first so the hologram stays legible over bright or same-coloured walls.
    this.ghostBackMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const bPole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.12, 8), this.ghostBackMat);
    bPole.position.y = 1.7;
    const bBanner = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 1.16), this.ghostBackMat);
    bBanner.position.set(0.85, 2.4, -0.001);
    for (const m of [bPole, bBanner]) {
      m.renderOrder = 999;
      m.frustumCulled = false;
    }
    this.ghost.add(bPole, bBanner, gPole, gBanner, gBase);
    this.ghost.visible = false;
    this.group.add(this.ghost);
    this.group.name = 'flag';
  }

  setColor(c: THREE.Color): void {
    this.color.copy(c);
    const tex = bannerTexture(c);
    this.clothMat.map?.dispose();
    this.clothMat.map = tex;
    this.clothMat.emissiveMap = tex;
    this.clothMat.emissive.copy(c);
    this.clothMat.needsUpdate = true;
    this.glow.color.copy(c);
    (this.beacon.material as THREE.MeshBasicMaterial).color.copy(c);
    (this.halo.material as THREE.SpriteMaterial).color.copy(c);
    (this.shaft.material as THREE.MeshBasicMaterial).color.copy(c);
    (this.sparks.material as THREE.PointsMaterial).color.copy(c);
    (this.ring.material as THREE.MeshStandardMaterial).color.copy(c);
    (this.ring.material as THREE.MeshStandardMaterial).emissive.copy(c);
    this.ghostMat.color.copy(c).lerp(new THREE.Color(1, 1, 1), 0.45);
  }

  /**
   * Scales the flag so the banner fits under a low ceiling (`freeHeight` metres of air above the base).
   * The beacon and hologram keep their world size so they stay readable.
   */
  fit(freeHeight: number): void {
    const s = clamp((freeHeight - 0.12) / 3.4, 0.5, 1);
    this.fitScale = s;
    this.group.scale.setScalar(s);
    this.beacon.scale.setScalar(1 / s);
    this.beacon.position.y = 30 / s;
    const ghostWorld = Math.max(s, 0.75);
    this.ghost.scale.setScalar(ghostWorld / s);
  }

  /** Beacon visibility 0..1 (used when a captured flag or reveal is shown). */
  setBeacon(strength: number): void {
    this.beaconBase = strength;
    (this.beacon.material as THREE.MeshBasicMaterial).opacity = strength * 0.35;
    this.beacon.visible = strength > 0.01;
  }

  /**
   * @param viewer camera position (proximity glow)
   * @param reveal true for attackers: a beacon marks the fortress from afar and a hologram shows the
   *   flag through walls while closing in, so a well-hidden flag is a challenge to reach, not to find.
   */
  update(dt: number, viewer?: THREE.Vector3, reveal = false): void {
    this.time += dt;
    const t = this.time;
    // Proximity: brighten from 20 m in, fully lit within 5 m.
    let target = 0;
    let d = 1e9;
    if (viewer) {
      d = viewer.distanceTo(this.group.position);
      target = smoothstep(20, 5, d);
    }
    this.near += (target - this.near) * Math.min(1, dt * 4);
    const near = this.near;

    // Turn the banner broadside to the viewer so it never hides edge-on in a narrow corridor.
    if (viewer && d < 80) {
      const want = Math.atan2(viewer.x - this.group.position.x, viewer.z - this.group.position.z);
      let diff = want - this.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (diff > Math.PI / 2) diff -= Math.PI;
      else if (diff < -Math.PI / 2) diff += Math.PI;
      this.group.rotation.y += diff * Math.min(1, dt * 2.5);
    }

    // Reveal aids for attackers.
    const holo = reveal && viewer ? smoothstep(7, 14, d) * (1 - smoothstep(40, 60, d)) : 0;
    const holoOpacity = holo * (0.55 + Math.sin(t * 3.5) * 0.08);
    this.ghostMat.opacity += (holoOpacity - this.ghostMat.opacity) * Math.min(1, dt * 5);
    this.ghostBackMat.opacity = this.ghostMat.opacity * 0.8;
    this.ghost.visible = this.ghostMat.opacity > 0.01;
    const farBeacon = reveal && viewer ? 0.6 * smoothstep(12, 30, d) : 0;
    const beacon = Math.max(this.beaconBase, farBeacon);
    const bm = this.beacon.material as THREE.MeshBasicMaterial;
    bm.opacity += (beacon * 0.35 - bm.opacity) * Math.min(1, dt * 3);
    this.beacon.visible = bm.opacity > 0.004;

    // Cloth: wind wave growing towards the free edge, plus a gentle flutter.
    const pos = this.clothGeo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const bx = this.base[i * 3];
      const by = this.base[i * 3 + 1];
      const k = bx / 1.6; // 0 at pole, 1 at tip
      const hang = 1 + (by + 0.525) / 1.05; // 1 bottom .. 2 top
      const wave = Math.sin(t * 4.6 + bx * 4.2 - by * 1.5) * 0.14 * k * k + Math.sin(t * 8.1 + by * 7 + bx * 2.5) * 0.035 * k;
      arr[i * 3] = bx - k * k * 0.08;
      arr[i * 3 + 1] = by + Math.sin(t * 3.3 + bx * 3) * 0.04 * k * (2.2 - hang);
      arr[i * 3 + 2] = wave;
    }
    pos.needsUpdate = true;
    this.clothGeo.computeVertexNormals();

    // Lights and glow ramp
    this.glow.intensity = 4.5 + near * 11 + Math.sin(t * 3) * 0.8;
    this.glow.distance = 8 + near * 6;
    this.clothMat.emissiveIntensity = 0.35 + near * 0.9;
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.16 + near * 0.34 + Math.sin(t * 2.2) * 0.03;
    this.halo.scale.setScalar(2.8 + near * 1.4 + Math.sin(t * 1.7) * 0.15);
    (this.shaft.material as THREE.MeshBasicMaterial).opacity = 0.07 + near * 0.16;
    (this.ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + near * 2.5 + Math.sin(t * 4) * 0.4;

    // Sparkles orbit and rise
    const sp = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
    const sarr = sp.array as Float32Array;
    const n = sp.count;
    for (let i = 0; i < n; i++) {
      const a0 = this.sparkSeed[i * 3];
      const r = this.sparkSeed[i * 3 + 1];
      const ph = this.sparkSeed[i * 3 + 2];
      const life = (t * 0.22 + ph) % 1;
      const ang = a0 + t * (0.6 + r * 0.4) + life * 1.5;
      sarr[i * 3] = Math.cos(ang) * r * (1 - life * 0.35);
      sarr[i * 3 + 1] = 0.3 + life * 3.2;
      sarr[i * 3 + 2] = Math.sin(ang) * r * (1 - life * 0.35);
    }
    sp.needsUpdate = true;
    (this.sparks.material as THREE.PointsMaterial).opacity = 0.35 + near * 0.6;
    (this.sparks.material as THREE.PointsMaterial).size = 0.13 + near * 0.08;
  }

  dispose(): void {
    this.clothMat.map?.dispose();
    this.clothGeo.dispose();
    this.sparks.geometry.dispose();
  }
}
