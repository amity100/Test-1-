import * as THREE from 'three';
import { Random } from '../core/Random';

const MAX_PARTICLES = 2400;
const MAX_TRACERS = 96;
const MAX_DEBRIS = 320;
const MAX_DECALS = 240;

const BILLBOARD_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iColor;
attribute vec2 iSizeRot;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vUv = uv;
  vColor = iColor;
  float c = cos(iSizeRot.y), s = sin(iSizeRot.y);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSizeRot.x;
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = iPos + camRight * p.x + camUp * p.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const BILLBOARD_FRAG = /* glsl */ `
precision highp float;
varying vec4 vColor;
varying vec2 vUv;
uniform float uSoft;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 1.0 - uSoft, d);
  if (a <= 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

class ParticlePool {
  mesh: THREE.Mesh;
  pos: Float32Array;
  col: Float32Array;
  sizeRot: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  startSize: Float32Array;
  endSize: Float32Array;
  gravity: Float32Array;
  drag: Float32Array;
  startAlpha: Float32Array;
  spin: Float32Array;
  count = 0;
  private iPos: THREE.InstancedBufferAttribute;
  private iColor: THREE.InstancedBufferAttribute;
  private iSizeRot: THREE.InstancedBufferAttribute;

  constructor(readonly max: number, additive: boolean, soft: number) {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.sizeRot = new Float32Array(max * 2);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.startSize = new Float32Array(max);
    this.endSize = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.startAlpha = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.iPos = new THREE.InstancedBufferAttribute(this.pos, 3);
    this.iColor = new THREE.InstancedBufferAttribute(this.col, 4);
    this.iSizeRot = new THREE.InstancedBufferAttribute(this.sizeRot, 2);
    this.iPos.setUsage(THREE.DynamicDrawUsage);
    this.iColor.setUsage(THREE.DynamicDrawUsage);
    this.iSizeRot.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos);
    geo.setAttribute('iColor', this.iColor);
    geo.setAttribute('iSizeRot', this.iSizeRot);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      vertexShader: BILLBOARD_VERT,
      fragmentShader: BILLBOARD_FRAG,
      uniforms: { uSoft: { value: soft } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 19;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size0: number, size1: number, r: number, g: number, b: number, a: number, gravity: number, drag: number, spin = 0): void {
    let i: number;
    if (this.count < this.max) i = this.count++;
    else i = Math.floor(Math.random() * this.max);
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.startSize[i] = size0;
    this.endSize[i] = size1;
    this.col[i * 4] = r;
    this.col[i * 4 + 1] = g;
    this.col[i * 4 + 2] = b;
    this.col[i * 4 + 3] = a;
    this.startAlpha[i] = a;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.spin[i] = spin;
    this.sizeRot[i * 2] = size0;
    this.sizeRot[i * 2 + 1] = Math.random() * Math.PI * 2;
  }

  update(dt: number): void {
    let n = this.count;
    for (let i = 0; i < n; ) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap with last
        n--;
        this.copy(n, i);
        continue;
      }
      const t = 1 - this.life[i] / this.maxLife[i];
      const dragK = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dragK;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dragK - this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= dragK;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.sizeRot[i * 2] = this.startSize[i] + (this.endSize[i] - this.startSize[i]) * t;
      this.sizeRot[i * 2 + 1] += this.spin[i] * dt;
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      this.col[i * 4 + 3] = this.startAlpha[i] * Math.max(0, fade);
      i++;
    }
    this.count = n;
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
    this.iPos.needsUpdate = true;
    this.iColor.needsUpdate = true;
    this.iSizeRot.needsUpdate = true;
  }

  private copy(from: number, to: number): void {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
    }
    for (let k = 0; k < 4; k++) this.col[to * 4 + k] = this.col[from * 4 + k];
    this.sizeRot[to * 2] = this.sizeRot[from * 2];
    this.sizeRot[to * 2 + 1] = this.sizeRot[from * 2 + 1];
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.startSize[to] = this.startSize[from];
    this.endSize[to] = this.endSize[from];
    this.gravity[to] = this.gravity[from];
    this.drag[to] = this.drag[from];
    this.startAlpha[to] = this.startAlpha[from];
    this.spin[to] = this.spin[from];
  }
}

interface Tracer { from: THREE.Vector3; to: THREE.Vector3; life: number; max: number; color: THREE.Color; width: number }
interface Debris { pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; life: number; size: number }
interface Decal { life: number }
interface Flash { light: THREE.PointLight; life: number; max: number; intensity: number }
interface Shock { mesh: THREE.Mesh; life: number; max: number; radius: number }

function decalTexture(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.95)');
  g.addColorStop(0.35, 'rgba(10,10,10,0.8)');
  g.addColorStop(0.7, 'rgba(20,20,20,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** Sparks, smoke, tracers, muzzle flashes, explosions, debris and bullet decals. */
export class VFX {
  readonly group = new THREE.Group();
  private sparkPool = new ParticlePool(MAX_PARTICLES, true, 0.7);
  private smokePool = new ParticlePool(MAX_PARTICLES / 2, false, 0.95);
  private tracers: Tracer[] = [];
  private tracerMesh: THREE.InstancedMesh;
  private debris: Debris[] = [];
  private debrisMesh: THREE.InstancedMesh;
  private decals: THREE.Mesh[] = [];
  private decalData: Decal[] = [];
  private decalIndex = 0;
  private decalMat: THREE.MeshBasicMaterial;
  private flashes: Flash[] = [];
  private lightPool: THREE.PointLight[] = [];
  private shocks: Shock[] = [];
  private shockMat: THREE.ShaderMaterial;
  private rng = new Random(77);
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.group.name = 'vfx';
    this.group.add(this.sparkPool.mesh, this.smokePool.mesh);

    const tGeo = new THREE.BoxGeometry(1, 1, 1);
    const tMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.5, 2.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.tracerMesh = new THREE.InstancedMesh(tGeo, tMat, MAX_TRACERS);
    this.tracerMesh.count = 0;
    this.tracerMesh.frustumCulled = false;
    this.group.add(this.tracerMesh);

    const dGeo = new THREE.BoxGeometry(1, 1, 1);
    const dMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    this.debrisMesh = new THREE.InstancedMesh(dGeo, dMat, MAX_DEBRIS);
    this.debrisMesh.count = 0;
    this.debrisMesh.castShadow = true;
    this.debrisMesh.frustumCulled = false;
    this.group.add(this.debrisMesh);

    this.decalMat = new THREE.MeshBasicMaterial({ map: decalTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const decalGeo = new THREE.PlaneGeometry(0.22, 0.22);
    for (let i = 0; i < MAX_DECALS; i++) {
      const m = new THREE.Mesh(decalGeo, this.decalMat);
      m.visible = false;
      m.renderOrder = 5;
      this.decals.push(m);
      this.decalData.push({ life: 0 });
      this.group.add(m);
    }

    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffc070, 0, 14, 2);
      l.castShadow = false;
      this.lightPool.push(l);
      this.group.add(l);
    }

    this.shockMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.7, 0.35) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uT; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float a = f * (1.0 - uT) * 1.8; gl_FragColor = vec4(uColor * (2.0 + 4.0 * (1.0 - uT)), a); }`,
    });
  }

  private lightFor(): THREE.PointLight | null {
    for (const l of this.lightPool) if (l.intensity <= 0.001) return l;
    return null;
  }

  sparks(pos: THREE.Vector3, normal: THREE.Vector3, count: number, color: THREE.Color, speed = 7): void {
    for (let i = 0; i < count; i++) {
      const d = new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)).normalize();
      if (d.dot(normal) < 0) d.negate();
      d.addScaledVector(normal, 0.6).normalize();
      const s = speed * this.rng.range(0.3, 1.2);
      this.sparkPool.spawn(pos.x, pos.y, pos.z, d.x * s, d.y * s, d.z * s, this.rng.range(0.2, 0.6), this.rng.range(0.03, 0.08), 0.01, color.r * 3, color.g * 3, color.b * 3, 1, 14, 2.5);
    }
  }

  puff(pos: THREE.Vector3, normal: THREE.Vector3, count: number, gray = 0.5, size = 0.4): void {
    for (let i = 0; i < count; i++) {
      const d = new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(-0.3, 1), this.rng.range(-1, 1)).normalize().addScaledVector(normal, 1.2);
      const s = this.rng.range(0.8, 2.2);
      this.smokePool.spawn(pos.x, pos.y, pos.z, d.x * s, d.y * s, d.z * s, this.rng.range(0.5, 1.1), size * 0.5, size * 1.6, gray, gray, gray, 0.45, -0.6, 2.2, this.rng.range(-2, 2));
    }
  }

  debrisBurst(pos: THREE.Vector3, normal: THREE.Vector3, count: number, color: THREE.Color): void {
    for (let i = 0; i < count; i++) {
      const d = new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(0.2, 1), this.rng.range(-1, 1)).normalize().addScaledVector(normal, 0.8).normalize();
      const s = this.rng.range(2, 7);
      const deb: Debris = {
        pos: pos.clone(),
        vel: d.multiplyScalar(s),
        rot: new THREE.Euler(this.rng.range(0, 3), this.rng.range(0, 3), 0),
        spin: new THREE.Vector3(this.rng.range(-8, 8), this.rng.range(-8, 8), this.rng.range(-8, 8)),
        life: this.rng.range(1.2, 2.4),
        size: this.rng.range(0.06, 0.16),
      };
      if (this.debris.length >= MAX_DEBRIS) this.debris.shift();
      this.debris.push(deb);
      this.debrisMesh.setColorAt(this.debris.length - 1, color);
    }
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
  }

  impact(point: THREE.Vector3, normal: THREE.Vector3, tint: THREE.Color | null, onEntity: boolean): void {
    if (onEntity) {
      this.sparks(point, normal, 10, new THREE.Color(1.0, 0.55, 0.2), 6);
      this.puff(point, normal, 2, 0.35, 0.3);
      return;
    }
    this.sparks(point, normal, 6, new THREE.Color(1.0, 0.8, 0.45), 5);
    this.puff(point, normal, 3, 0.62, 0.3);
    if (tint) this.debrisBurst(point, normal, 3, tint);
    this.decal(point, normal);
  }

  decal(point: THREE.Vector3, normal: THREE.Vector3): void {
    if (Math.abs(normal.lengthSq() - 1) > 0.1) return;
    const m = this.decals[this.decalIndex];
    this.decalData[this.decalIndex].life = 25;
    this.decalIndex = (this.decalIndex + 1) % MAX_DECALS;
    m.visible = true;
    m.position.copy(point).addScaledVector(normal, 0.012);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    m.rotateZ(this.rng.range(0, Math.PI * 2));
    const s = this.rng.range(0.8, 1.3);
    m.scale.set(s, s, s);
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color = new THREE.Color(1, 0.85, 0.5), width = 0.03): void {
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    this.tracers.push({ from: from.clone(), to: to.clone(), life: 0.09, max: 0.09, color, width });
  }

  muzzleFlash(pos: THREE.Vector3, dir: THREE.Vector3, color = new THREE.Color(1, 0.7, 0.3), scale = 1): void {
    // Bright core sparks + a light.
    for (let i = 0; i < 4; i++) {
      const d = dir.clone().add(new THREE.Vector3(this.rng.range(-0.3, 0.3), this.rng.range(-0.3, 0.3), this.rng.range(-0.3, 0.3)));
      this.sparkPool.spawn(pos.x, pos.y, pos.z, d.x * 6, d.y * 6, d.z * 6, 0.06, 0.25 * scale, 0.05, color.r * 4, color.g * 4, color.b * 4, 1, 0, 0);
    }
    this.sparkPool.spawn(pos.x, pos.y, pos.z, dir.x, dir.y, dir.z, 0.05, 0.32 * scale, 0.08, 6, 4.5, 2.5, 1, 0, 0);
    this.puff(pos, dir, 1, 0.7, 0.25 * scale);
    const l = this.lightFor();
    if (l) {
      l.position.copy(pos);
      l.color.copy(color);
      l.distance = 12 * scale;
      this.flashes.push({ light: l, life: 0.06, max: 0.06, intensity: 25 * scale });
      l.intensity = 25 * scale;
    }
  }

  explosion(pos: THREE.Vector3, radius: number): void {
    const up = this.up;
    // Fireball sparks
    for (let i = 0; i < 90; i++) {
      const d = new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(-0.4, 1), this.rng.range(-1, 1)).normalize();
      const s = this.rng.range(3, 14);
      const hot = this.rng.next();
      this.sparkPool.spawn(pos.x, pos.y + 0.3, pos.z, d.x * s, d.y * s + 3, d.z * s, this.rng.range(0.3, 0.9), this.rng.range(0.25, 0.7), 0.05, 4 + hot * 4, 1.6 + hot * 2, 0.4, 1, 6, 3);
    }
    // Fire core
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(0, 1), this.rng.range(-1, 1)).normalize();
      this.sparkPool.spawn(pos.x, pos.y + 0.4, pos.z, d.x * 2.5, d.y * 3 + 2, d.z * 2.5, this.rng.range(0.25, 0.5), radius * 0.5, radius * 0.9, 5, 2.2, 0.6, 0.9, 1, 2, this.rng.range(-3, 3));
    }
    // Smoke
    for (let i = 0; i < 26; i++) {
      const d = new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(0.2, 1), this.rng.range(-1, 1)).normalize();
      const s = this.rng.range(1.5, 5);
      const g = this.rng.range(0.12, 0.3);
      this.smokePool.spawn(pos.x, pos.y + 0.5, pos.z, d.x * s, d.y * s + 1.5, d.z * s, this.rng.range(1.2, 2.6), radius * 0.35, radius * 1.1, g, g, g, 0.7, -0.8, 1.6, this.rng.range(-1.5, 1.5));
    }
    this.debrisBurst(pos, up, 18, new THREE.Color(0.25, 0.22, 0.2));
    const l = this.lightFor();
    if (l) {
      l.position.copy(pos).addScaledVector(up, 0.8);
      l.color.set(0xffa040);
      l.distance = radius * 6;
      this.flashes.push({ light: l, life: 0.5, max: 0.5, intensity: 120 });
      l.intensity = 120;
    }
    const geo = new THREE.SphereGeometry(1, 24, 16);
    const mesh = new THREE.Mesh(geo, this.shockMat.clone());
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.shocks.push({ mesh, life: 0.45, max: 0.45, radius: radius * 1.6 });
  }

  /** Burst of coloured sparks and smoke when a character is eliminated. */
  deathBurst(pos: THREE.Vector3, color: THREE.Color): void {
    for (let i = 0; i < 40; i++) {
      const d = new THREE.Vector3(this.rng.range(-1, 1), this.rng.range(-0.2, 1), this.rng.range(-1, 1)).normalize();
      const sp = this.rng.range(2, 9);
      this.sparkPool.spawn(pos.x, pos.y, pos.z, d.x * sp, d.y * sp + 2, d.z * sp, this.rng.range(0.4, 1.1), this.rng.range(0.05, 0.14), 0.01, color.r * 3.5, color.g * 3.5, color.b * 3.5, 1, 9, 2.2);
    }
    this.puff(pos, new THREE.Vector3(0, 1, 0), 8, 0.3, 0.7);
    this.debrisBurst(pos, new THREE.Vector3(0, 1, 0), 8, new THREE.Color(0.2, 0.22, 0.26));
    const l = this.lightFor();
    if (l) {
      l.position.copy(pos);
      l.color.copy(color);
      l.distance = 10;
      this.flashes.push({ light: l, life: 0.3, max: 0.3, intensity: 30 });
      l.intensity = 30;
    }
  }

  private ambientAcc = 0;
  /** Drifting dust motes around the camera. */
  ambient(camPos: THREE.Vector3, dt: number): void {
    this.ambientAcc += dt * 14;
    while (this.ambientAcc >= 1) {
      this.ambientAcc -= 1;
      const x = camPos.x + this.rng.range(-9, 9);
      const y = camPos.y + this.rng.range(-3, 5);
      const z = camPos.z + this.rng.range(-9, 9);
      this.sparkPool.spawn(x, y, z, this.rng.range(-0.25, 0.25), this.rng.range(-0.1, 0.15), this.rng.range(-0.25, 0.25), this.rng.range(2.5, 5), 0.03, 0.02, 0.9, 0.85, 0.7, 0.35, -0.02, 0.2);
    }
  }

  spawnBeam(from: THREE.Vector3, to: THREE.Vector3): void {
    this.tracer(from, to, new THREE.Color(0.4, 1.0, 1.0), 0.05);
  }

  update(dt: number): void {
    this.sparkPool.update(dt);
    this.smokePool.update(dt);
    // Tracers
    let n = 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.tracers.splice(i, 1);
        continue;
      }
    }
    for (const t of this.tracers) {
      const dir = t.to.clone().sub(t.from);
      const len = dir.length();
      if (len < 0.01) continue;
      const mid = t.from.clone().addScaledVector(dir, 0.5);
      this.tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
      const fade = t.life / t.max;
      this.tmpS.set(t.width * fade, t.width * fade, len);
      this.tmpM.compose(mid, this.tmpQ, this.tmpS);
      this.tracerMesh.setMatrixAt(n++, this.tmpM);
    }
    this.tracerMesh.count = n;
    this.tracerMesh.instanceMatrix.needsUpdate = true;
    // Debris
    let dn = 0;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.debris.splice(i, 1);
        continue;
      }
      d.vel.y -= 20 * dt;
      d.pos.addScaledVector(d.vel, dt);
      d.rot.x += d.spin.x * dt;
      d.rot.y += d.spin.y * dt;
      d.rot.z += d.spin.z * dt;
    }
    for (const d of this.debris) {
      this.tmpQ.setFromEuler(d.rot);
      const s = d.size * Math.min(1, d.life * 2);
      this.tmpS.set(s, s, s);
      this.tmpM.compose(d.pos, this.tmpQ, this.tmpS);
      this.debrisMesh.setMatrixAt(dn++, this.tmpM);
    }
    this.debrisMesh.count = dn;
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    // Decals
    for (let i = 0; i < MAX_DECALS; i++) {
      const dd = this.decalData[i];
      if (dd.life > 0) {
        dd.life -= dt;
        if (dd.life <= 0) this.decals[i].visible = false;
      }
    }
    // Flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.light.intensity = 0;
        this.flashes.splice(i, 1);
      } else {
        f.light.intensity = f.intensity * (f.life / f.max);
      }
    }
    // Shockwaves
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.group.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        s.mesh.geometry.dispose();
        this.shocks.splice(i, 1);
        continue;
      }
      const t = 1 - s.life / s.max;
      const r = 0.3 + s.radius * Math.pow(t, 0.5);
      s.mesh.scale.setScalar(r);
      (s.mesh.material as THREE.ShaderMaterial).uniforms.uT.value = t;
    }
  }

  clear(): void {
    this.tracers.length = 0;
    this.debris.length = 0;
    for (let i = 0; i < MAX_DECALS; i++) {
      this.decalData[i].life = 0;
      this.decals[i].visible = false;
    }
  }
}
