import * as THREE from 'three';

/**
 * Pooled, allocation-free gameplay VFX: one additive point cloud for every
 * spark / ember / splash / debris particle, a few shockwave rings, a shear
 * seam and two flash lights. Everything is created up front so a kill frame
 * never compiles a shader or allocates.
 */
const MAX = 1600;

interface Emit {
  pos: THREE.Vector3;
  vel?: THREE.Vector3;
  spread?: number;
  speed?: number;
  color: THREE.Color;
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  count: number;
  /** Particles home toward this point (embers flying to the player). */
  home?: THREE.Vector3;
}

const _v = new THREE.Vector3();
const _c = new THREE.Color();

export class FxKit {
  group = new THREE.Group();
  private px = new Float32Array(MAX * 3);
  private pv = new Float32Array(MAX * 3);
  private pc = new Float32Array(MAX * 3);
  private ps = new Float32Array(MAX);
  private pa = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private drag = new Float32Array(MAX);
  private homing = new Uint8Array(MAX);
  private n = 0;
  private geo: THREE.BufferGeometry;
  private points: THREE.Points;
  private rings: { mesh: THREE.Mesh; t: number; dur: number; r: number }[] = [];
  private seams: { mesh: THREE.Mesh; t: number }[] = [];
  private flashes: { light: THREE.PointLight; t: number; dur: number; peak: number }[] = [];
  private homeTarget = new THREE.Vector3();
  private pxScale = 1;

  constructor(pixelRatio = 1) {
    this.pxScale = pixelRatio;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.px, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.pc, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.ps, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.pa, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPx: { value: pixelRatio } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying vec3 vC;
        varying float vA;
        uniform float uPx;
        void main() {
          vC = color;
          vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * uPx * 300.0 / max(0.1, -mv.z), 1.0, 96.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = clamp(vA, 0.0, 1.0) * smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(max(vC, vec3(0.0)) * a, a);
        }`,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 40;
    this.group.add(this.points);

    const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true }));
      m.visible = false;
      m.renderOrder = 39;
      this.group.add(m);
      this.rings.push({ mesh: m, t: 1, dur: 1, r: 1 });
    }
    const seamGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(seamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true }));
      m.visible = false;
      this.group.add(m);
      this.seams.push({ mesh: m, t: 1 });
    }
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffa050, 0, 14, 2);
      this.group.add(l);
      this.flashes.push({ light: l, t: 1, dur: 1, peak: 0 });
    }
  }

  /** The blast flash lights (intensity 0 between blasts). */
  get flashLights(): THREE.PointLight[] {
    return this.flashes.map((f) => f.light);
  }

  setPixelRatio(r: number) {
    this.pxScale = r;
    (this.points.material as THREE.ShaderMaterial).uniforms.uPx.value = r;
  }

  /** The point embers fly to. */
  setHome(p: THREE.Vector3) {
    this.homeTarget.copy(p);
  }

  emit(e: Emit) {
    const speed = e.speed ?? 4;
    const spread = e.spread ?? 1;
    for (let k = 0; k < e.count; k++) {
      if (this.n >= MAX) return;
      const i = this.n++;
      const i3 = i * 3;
      this.px[i3] = e.pos.x + (Math.random() - 0.5) * 0.1;
      this.px[i3 + 1] = e.pos.y + (Math.random() - 0.5) * 0.1;
      this.px[i3 + 2] = e.pos.z + (Math.random() - 0.5) * 0.1;
      // random direction around vel
      let dx = (Math.random() - 0.5) * 2, dy = (Math.random() - 0.5) * 2, dz = (Math.random() - 0.5) * 2;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
      const s = speed * (0.35 + Math.random() * 0.65);
      const bx = e.vel ? e.vel.x : 0, by = e.vel ? e.vel.y : 0, bz = e.vel ? e.vel.z : 0;
      this.pv[i3] = bx + dx * s * spread;
      this.pv[i3 + 1] = by + dy * s * spread;
      this.pv[i3 + 2] = bz + dz * s * spread;
      const tint = 0.75 + Math.random() * 0.5;
      this.pc[i3] = e.color.r * tint;
      this.pc[i3 + 1] = e.color.g * tint;
      this.pc[i3 + 2] = e.color.b * tint;
      this.ps[i] = (e.size ?? 0.06) * (0.6 + Math.random() * 0.8);
      const L = (e.life ?? 0.6) * (0.6 + Math.random() * 0.7);
      this.life[i] = L;
      this.maxLife[i] = L;
      this.pa[i] = 1;
      this.grav[i] = e.gravity ?? 9;
      this.drag[i] = e.drag ?? 1.5;
      this.homing[i] = e.home ? 1 : 0;
    }
  }

  sparks(pos: THREE.Vector3, normal: THREE.Vector3 | null, color: THREE.Color, count = 14) {
    this.emit({ pos, vel: normal ? _v.copy(normal).multiplyScalar(3) : undefined, speed: 6, color, size: 0.05, life: 0.35, gravity: 12, drag: 2, count });
  }

  splash(pos: THREE.Vector3, size = 1) {
    _c.setRGB(0.75, 0.9, 1.1);
    this.emit({ pos, vel: _v.set(0, 5.5 * size, 0), spread: 0.8, speed: 3.5 * size, color: _c, size: 0.12 * size, life: 0.9, gravity: 14, drag: 0.6, count: Math.round(40 * size) });
    this.ring(pos, 2.4 * size, 0.7, _c.setRGB(0.6, 0.8, 1));
  }

  explosion(pos: THREE.Vector3, size = 1) {
    this.emit({ pos, speed: 11 * size, color: _c.setRGB(4, 1.8, 0.5), size: 0.2 * size, life: 0.45, gravity: 2, drag: 3, count: Math.round(70 * size) });
    this.emit({ pos, vel: _v.set(0, 3, 0), speed: 4 * size, color: _c.setRGB(0.5, 0.42, 0.36), size: 0.5 * size, life: 1.4, gravity: -1.2, drag: 1.2, count: Math.round(22 * size) });
    this.emit({ pos, speed: 14 * size, color: _c.setRGB(2.2, 1.4, 0.6), size: 0.05, life: 1.1, gravity: 16, drag: 0.5, count: Math.round(40 * size) });
    this.ring(pos, 5.5 * size, 0.5, _c.setRGB(3, 1.6, 0.6));
    this.flash(pos, 60 * size, 0.35, 0xffa050);
  }

  /** Embers stream from a kill to the player (health). */
  embers(from: THREE.Vector3, count = 18) {
    this.emit({ pos: from, vel: _v.set(0, 3, 0), speed: 3, color: _c.setRGB(2.6, 1.2, 0.35), size: 0.07, life: 1.2, gravity: 0, drag: 0.4, count, home: this.homeTarget });
  }

  dust(pos: THREE.Vector3, size = 1) {
    this.emit({ pos, vel: _v.set(0, 1.2, 0), speed: 3.2 * size, color: _c.setRGB(0.55, 0.5, 0.45), size: 0.28 * size, life: 0.9, gravity: -0.5, drag: 2.5, count: Math.round(16 * size) });
  }

  /** Charged flight streaks (called every frame for fast charged bodies). */
  streak(pos: THREE.Vector3, vel: THREE.Vector3, color: THREE.Color) {
    this.emit({ pos, vel: _v.copy(vel).multiplyScalar(-0.05), speed: 0.4, color, size: 0.09, life: 0.25, gravity: 0, drag: 4, count: 2 });
  }

  riftBurst(pos: THREE.Vector3, normal: THREE.Vector3, color: THREE.Color) {
    this.emit({ pos, vel: _v.copy(normal).multiplyScalar(4), speed: 5, color, size: 0.07, life: 0.5, gravity: 2, drag: 2, count: 26 });
  }

  ring(pos: THREE.Vector3, radius: number, dur: number, color: THREE.Color) {
    const r = this.rings.find((q) => q.t >= q.dur) ?? this.rings[0];
    r.t = 0;
    r.dur = dur;
    r.r = radius;
    r.mesh.position.copy(pos).setY(pos.y + 0.08);
    (r.mesh.material as THREE.MeshBasicMaterial).color.copy(color);
    r.mesh.visible = true;
  }

  /** Bright cut line where a rift closed on something. */
  seam(center: THREE.Vector3, normal: THREE.Vector3, width = 1.4) {
    const s = this.seams.find((q) => q.t >= 1) ?? this.seams[0];
    s.t = 0;
    s.mesh.position.copy(center);
    s.mesh.lookAt(_v.copy(center).add(normal));
    s.mesh.scale.set(width, 2.1, 1);
    s.mesh.visible = true;
    this.emit({ pos: center, speed: 5, color: _c.setRGB(3, 2.5, 2), size: 0.05, life: 0.6, gravity: 6, drag: 1, count: 30 });
  }

  flash(pos: THREE.Vector3, intensity: number, dur: number, color: number) {
    const f = this.flashes.find((q) => q.t >= q.dur) ?? this.flashes[0];
    f.t = 0;
    f.dur = dur;
    f.peak = intensity;
    f.light.position.copy(pos);
    f.light.color.setHex(color);
  }

  update(dt: number) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        const last = --this.n;
        if (i !== last) {
          const i3 = i * 3, l3 = last * 3;
          for (let k = 0; k < 3; k++) {
            this.px[i3 + k] = this.px[l3 + k];
            this.pv[i3 + k] = this.pv[l3 + k];
            this.pc[i3 + k] = this.pc[l3 + k];
          }
          this.ps[i] = this.ps[last];
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
          this.grav[i] = this.grav[last];
          this.drag[i] = this.drag[last];
          this.homing[i] = this.homing[last];
        }
        continue;
      }
      const i3 = i * 3;
      if (this.homing[i]) {
        const hx = this.homeTarget.x - this.px[i3], hy = this.homeTarget.y + 1 - this.px[i3 + 1], hz = this.homeTarget.z - this.px[i3 + 2];
        const k = Math.min(1, dt * 5);
        this.pv[i3] += (hx * 6 - this.pv[i3]) * k;
        this.pv[i3 + 1] += (hy * 6 - this.pv[i3 + 1]) * k;
        this.pv[i3 + 2] += (hz * 6 - this.pv[i3 + 2]) * k;
        if (hx * hx + hy * hy + hz * hz < 0.4) this.life[i] = Math.min(this.life[i], 0.05);
      } else {
        const dr = Math.exp(-this.drag[i] * dt);
        this.pv[i3] *= dr;
        this.pv[i3 + 1] = this.pv[i3 + 1] * dr - this.grav[i] * dt;
        this.pv[i3 + 2] *= dr;
      }
      this.px[i3] += this.pv[i3] * dt;
      this.px[i3 + 1] += this.pv[i3 + 1] * dt;
      this.px[i3 + 2] += this.pv[i3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.pa[i] = Math.min(1, k * 1.6);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    if (this.n > 0) {
      (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.getAttribute('alpha') as THREE.BufferAttribute).needsUpdate = true;
    }
    for (const r of this.rings) {
      if (r.t >= r.dur) continue;
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const s = 0.2 + r.r * (1 - (1 - k) * (1 - k));
      r.mesh.scale.set(s, s, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
      if (k >= 1) r.mesh.visible = false;
    }
    for (const s of this.seams) {
      if (s.t >= 1) continue;
      s.t += dt / 0.5;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - s.t);
      s.mesh.scale.y = 2.1 * (1 + s.t * 0.3);
      if (s.t >= 1) s.mesh.visible = false;
    }
    for (const f of this.flashes) {
      if (f.t >= f.dur) {
        f.light.intensity = 0;
        continue;
      }
      f.t += dt;
      f.light.intensity = f.peak * Math.max(0, 1 - f.t / f.dur);
    }
  }

  clear() {
    this.n = 0;
    this.geo.setDrawRange(0, 0);
    for (const r of this.rings) {
      r.t = r.dur;
      r.mesh.visible = false;
    }
    for (const s of this.seams) {
      s.t = 1;
      s.mesh.visible = false;
    }
    for (const f of this.flashes) {
      f.t = f.dur;
      f.light.intensity = 0;
    }
  }
}
