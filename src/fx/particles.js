// Particle pools (sparks, smoke, blood, debris), tracers, bullet decals, rain, muzzle flashes.
import * as THREE from 'three';

const vs = /* glsl */`
  attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aRot;
  varying float vAlpha; varying vec3 vColor; varying float vRot;
  void main() {
    vAlpha = aAlpha; vColor = aColor; vRot = aRot;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const fs = /* glsl */`
  uniform sampler2D uMap; uniform float uSoft;
  varying float vAlpha; varying vec3 vColor; varying float vRot;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c) + 0.5;
    vec4 t = texture2D(uMap, uv);
    float a = t.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * t.rgb, a);
  }
`;

function softDiscTexture(size = 64, hard = false) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if (hard) { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function smokeTexture(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const r = size * (0.12 + Math.random() * 0.22), x = size / 2 + (Math.random() - 0.5) * size * 0.45, y = size / 2 + (Math.random() - 0.5) * size * 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function flashTexture(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size); ctx.translate(size / 2, size / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2); g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(0.25, 'rgba(255,200,120,0.8)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const r = i % 2 ? size * 0.5 : size * 0.22; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.2); g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function holeTexture(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(10,10,10,0.95)'); g.addColorStop(0.3, 'rgba(20,18,16,0.85)'); g.addColorStop(0.6, 'rgba(60,55,50,0.35)'); g.addColorStop(1, 'rgba(80,80,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rainTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64; const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(3, 0, 2, 64);
  const t = new THREE.CanvasTexture(c); return t;
}

class Pool {
  constructor(scene, count, texture, blending, opts = {}) {
    this.count = count; this.n = 0;
    this.pos = new Float32Array(count * 3); this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count); this.life = new Float32Array(count);
    this.size = new Float32Array(count); this.size0 = new Float32Array(count);
    this.alpha = new Float32Array(count); this.col = new Float32Array(count * 3); this.rot = new Float32Array(count); this.rotV = new Float32Array(count);
    this.grav = new Float32Array(count); this.drag = new Float32Array(count); this.grow = new Float32Array(count);
    this.alive = new Uint8Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: texture }, uSoft: { value: 1 } }, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending, depthTest: true });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = opts.renderOrder ?? 10;
    scene.add(this.points);
    this.collide = opts.collide || null;
    this.cursor = 0; this.high = 0;
  }
  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, { grav = 0, drag = 0, grow = 0, alpha = 1, rotV = 0 } = {}) {
    let i = this.cursor; this.cursor = (this.cursor + 1) % this.count;
    this.alive[i] = 1; this.age[i] = 0; this.life[i] = life;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.size[i] = size; this.size0[i] = size; this.alpha[i] = alpha; this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow; this.rot[i] = Math.random() * 6.28; this.rotV[i] = rotV;
    if (i + 1 > this.high) this.high = i + 1;
  }
  update(dt) {
    let high = 0;
    for (let i = 0; i < this.high; i++) {
      if (!this.alive[i]) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.alive[i] = 0; this.alpha[i] = 0; continue; }
      const k = this.age[i] / this.life[i];
      let vx = this.vel[i * 3], vy = this.vel[i * 3 + 1], vz = this.vel[i * 3 + 2];
      vy -= this.grav[i] * dt;
      const d = Math.max(0, 1 - this.drag[i] * dt); vx *= d; vy *= d; vz *= d;
      let nx = this.pos[i * 3] + vx * dt, ny = this.pos[i * 3 + 1] + vy * dt, nz = this.pos[i * 3 + 2] + vz * dt;
      if (this.collide && ny < this.collide(nx, nz)) { ny = this.collide(nx, nz) + 0.01; vy = -vy * 0.3; vx *= 0.6; vz *= 0.6; }
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.pos[i * 3] = nx; this.pos[i * 3 + 1] = ny; this.pos[i * 3 + 2] = nz;
      this.size[i] = this.size0[i] * (1 + this.grow[i] * k);
      this.alpha[i] = (1 - k) * (k < 0.1 ? k / 0.1 : 1);
      this.rot[i] += this.rotV[i] * dt;
      high = i + 1;
    }
    this.high = high;
    this.geo.setDrawRange(0, high);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true; this.geo.attributes.aRot.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio;
    const disc = softDiscTexture(64), hard = softDiscTexture(32, true), smoke = smokeTexture();
    const groundFn = (x, z) => world.groundAt(x, z, 100).y;
    this.sparks = new Pool(scene, 1500, hard, THREE.AdditiveBlending, { collide: groundFn, renderOrder: 12 });
    this.smoke = new Pool(scene, 900, smoke, THREE.NormalBlending, { renderOrder: 9 });
    this.blood = new Pool(scene, 700, disc, THREE.NormalBlending, { collide: groundFn, renderOrder: 11 });
    this.debris = new Pool(scene, 600, hard, THREE.NormalBlending, { collide: groundFn, renderOrder: 11 });
    this.flashTex = flashTexture();

    // Tracers: instanced thin boxes
    this.tracerMax = 120;
    const tg = new THREE.BoxGeometry(0.03, 0.03, 1); tg.translate(0, 0, 0.5);
    this.tracerMesh = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), this.tracerMax);
    this.tracerMesh.frustumCulled = false; this.tracerMesh.count = 0; scene.add(this.tracerMesh);
    this.tracers = [];

    // Decals: instanced quads
    this.decalMax = 250;
    this.decalMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: holeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), this.decalMax);
    this.decalMesh.frustumCulled = false; this.decalMesh.count = 0; this.decalMesh.renderOrder = 5; scene.add(this.decalMesh);
    this.decalCursor = 0;

    // Muzzle flashes: pool of sprites + lights
    // Lights stay in the scene permanently (intensity 0 when idle) so the light count — and thus the
    // compiled shaders — never changes at runtime.
    this.flashes = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, color: 0xffe0b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.visible = false; s.scale.set(0.6, 0.6, 1); s.renderOrder = 20; scene.add(s);
      const l = new THREE.PointLight(0xffb060, 0, 9, 2); scene.add(l);
      this.flashes.push({ sprite: s, light: l, t: 0 });
    }
    this.explLightPool = [];
    { const l = new THREE.PointLight(0xffa040, 0, 30, 2); scene.add(l); this.explLightPool.push(l); }
    this.explCursor = 0;
    this.flashCursor = 0;

    // Explosion lights + shockwaves
    this.shockGeo = new THREE.RingGeometry(0.6, 1, 48);
    this.shocks = [];
    this.explLights = [];

    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.rain = null;
    this.time = 0;
  }

  // ---- Rain: thin line streaks (one draw call), wrapped around the camera ----
  createRain(count) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 2 * 3), seed = new Float32Array(count * 2), end = new Float32Array(count * 2);
    const W = 60, H = 30;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * W, y = Math.random() * H, z = (Math.random() - 0.5) * W, sd = Math.random();
      for (let k = 0; k < 2; k++) { const j = i * 2 + k; pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z; seed[j] = sd; end[j] = k; }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uIntensity: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCenter; varying float vA;
        void main() {
          float H = 30.0; float W = 60.0;
          float speed = 14.0 + aSeed * 6.0;
          vec3 wind = vec3(1.2, 0.0, 0.4);
          vec3 p = position;
          p.y = mod(position.y - uTime * speed, H);
          p.x = mod(position.x + uCenter.x + W * 0.5 + uTime * wind.x, W) - W * 0.5 + uCenter.x;
          p.z = mod(position.z + uCenter.z + W * 0.5 + uTime * wind.z, W) - W * 0.5 + uCenter.z;
          p.y += uCenter.y - 5.0;
          // second vertex of each streak trails along the fall direction
          vec3 fall = normalize(vec3(wind.x, -speed, wind.z));
          p -= fall * aEnd * (0.35 + aSeed * 0.35);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          vA = smoothstep(45.0, 6.0, dist) * (0.18 + aSeed * 0.22) * (1.0 - aEnd * 0.8);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uIntensity; varying float vA;
        void main() { float a = vA * uIntensity; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.72, 0.8, 0.9), a); }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.rain = new THREE.LineSegments(g, mat); this.rain.frustumCulled = false; this.rain.renderOrder = 8; this.scene.add(this.rain);
  }

  // ---- Emitters ----
  muzzleFlash(pos, dir, scale = 1) {
    const f = this.flashes[this.flashCursor]; this.flashCursor = (this.flashCursor + 1) % this.flashes.length;
    f.sprite.position.copy(pos).addScaledVector(dir, 0.12); f.sprite.visible = true; f.sprite.material.rotation = Math.random() * 6.28;
    f.sprite.scale.setScalar((0.45 + Math.random() * 0.3) * scale);
    f.light.position.copy(pos).addScaledVector(dir, 0.3); f.light.intensity = 26 * scale;
    f.t = 0.055;
    // hot gas puff
    for (let i = 0; i < 3; i++) this.smoke.spawn(pos.x, pos.y, pos.z, dir.x * 3 + (Math.random() - 0.5), dir.y * 3 + 0.5, dir.z * 3 + (Math.random() - 0.5), 0.5, 0.35, 0.6, 0.6, 0.6, { drag: 4, grow: 2.5, alpha: 0.35 });
  }

  tracer(from, to, speed = 260) {
    const len = from.distanceTo(to);
    this.tracers.push({ from: from.clone(), to: to.clone(), t: 0, dur: len / speed, len });
  }

  impact(point, normal, material = 'concrete') {
    const n = normal;
    if (material === 'metal') {
      for (let i = 0; i < 10; i++) { const s = 4 + Math.random() * 8; this.sparks.spawn(point.x, point.y, point.z, (n.x + (Math.random() - 0.5) * 1.4) * s, (n.y + Math.random() * 0.8) * s, (n.z + (Math.random() - 0.5) * 1.4) * s, 0.25 + Math.random() * 0.35, 0.07, 1, 0.8, 0.45, { grav: 14, drag: 1.5 }); }
      this.sparks.spawn(point.x, point.y, point.z, 0, 0, 0, 0.08, 0.5, 1, 0.9, 0.7);
    } else {
      for (let i = 0; i < 5; i++) { const s = 1.5 + Math.random() * 3; this.debris.spawn(point.x, point.y, point.z, (n.x + (Math.random() - 0.5)) * s, (n.y + Math.random()) * s, (n.z + (Math.random() - 0.5)) * s, 0.5 + Math.random() * 0.5, 0.05, 0.55, 0.52, 0.48, { grav: 16, drag: 1 }); }
      for (let i = 0; i < 4; i++) this.smoke.spawn(point.x + n.x * 0.05, point.y + n.y * 0.05, point.z + n.z * 0.05, n.x * 1.2 + (Math.random() - 0.5), n.y * 1.2 + 0.6, n.z * 1.2 + (Math.random() - 0.5), 0.9 + Math.random() * 0.5, 0.3, 0.62, 0.6, 0.56, { drag: 3, grow: 2, alpha: 0.45 });
    }
    this.decal(point, n);
  }

  bloodHit(point, dir) {
    for (let i = 0; i < 14; i++) { const s = 1 + Math.random() * 4; this.blood.spawn(point.x, point.y, point.z, dir.x * s + (Math.random() - 0.5) * 2.5, Math.random() * 2.5 - 0.5, dir.z * s + (Math.random() - 0.5) * 2.5, 0.35 + Math.random() * 0.4, 0.06 + Math.random() * 0.08, 0.42, 0.02, 0.02, { grav: 14, drag: 1.5, alpha: 0.9 }); }
    for (let i = 0; i < 3; i++) this.smoke.spawn(point.x, point.y, point.z, (Math.random() - 0.5), 0.4, (Math.random() - 0.5), 0.45, 0.25, 0.45, 0.06, 0.05, { drag: 3, grow: 1.5, alpha: 0.5 });
  }

  dust(point, amount = 6, color = [0.5, 0.47, 0.42]) {
    for (let i = 0; i < amount; i++) this.smoke.spawn(point.x + (Math.random() - 0.5) * 0.6, point.y + 0.05, point.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.5, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 1.5, 1.2 + Math.random(), 0.5, color[0], color[1], color[2], { drag: 2, grow: 2.5, alpha: 0.4 });
  }

  moduleLand(box) {
    // dust ring around the footprint of a placed module
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = box.x + Math.cos(a) * (box.hx + 0.2), z = box.z + Math.sin(a) * (box.hz + 0.2);
      this.smoke.spawn(x, box.minY + 0.1, z, Math.cos(a) * 2, 0.6, Math.sin(a) * 2, 1.4, 0.7, 0.5, 0.47, 0.42, { drag: 2, grow: 2.5, alpha: 0.5 });
    }
  }

  explosion(pos) {
    for (let i = 0; i < 90; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.2, s = 6 + Math.random() * 16; this.sparks.spawn(pos.x, pos.y + 0.3, pos.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 3, Math.sin(a) * Math.cos(e) * s, 0.5 + Math.random() * 0.8, 0.1 + Math.random() * 0.1, 1, 0.65, 0.3, { grav: 12, drag: 1.2 }); }
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 5; this.smoke.spawn(pos.x, pos.y + 0.4, pos.z, Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s, 1.8 + Math.random() * 1.6, 1.2, 0.25, 0.22, 0.2, { drag: 1.6, grow: 3, alpha: 0.75 }); }
    for (let i = 0; i < 16; i++) this.smoke.spawn(pos.x, pos.y + 0.3, pos.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.35, 1.5, 1, 0.55, 0.15, { drag: 2, grow: 2, alpha: 0.9 });
    for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, s = 4 + Math.random() * 10; this.debris.spawn(pos.x, pos.y + 0.3, pos.z, Math.cos(a) * s, 4 + Math.random() * 8, Math.sin(a) * s, 1.5 + Math.random(), 0.08, 0.2, 0.18, 0.16, { grav: 18, drag: 0.6 }); }
    const ring = new THREE.Mesh(this.shockGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).add(new THREE.Vector3(0, 0.25, 0)); ring.scale.setScalar(0.5); this.scene.add(ring);
    this.shocks.push({ mesh: ring, t: 0 });
    const light = this.explLightPool[this.explCursor]; this.explCursor = (this.explCursor + 1) % this.explLightPool.length;
    light.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0)); light.intensity = 400;
    this.explLights = this.explLights.filter((e) => e.light !== light); this.explLights.push({ light, t: 0 });
  }

  decal(point, normal) {
    const i = this.decalCursor; this.decalCursor = (this.decalCursor + 1) % this.decalMax;
    this._v.copy(point).addScaledVector(normal, 0.012);
    this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const rot = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * 6.28);
    this._q.premultiply(rot);
    const s = 0.8 + Math.random() * 0.6;
    this._m.compose(this._v, this._q, this._s.set(s, s, s));
    this.decalMesh.setMatrixAt(i, this._m);
    this.decalMesh.count = Math.max(this.decalMesh.count, i + 1);
    this.decalMesh.instanceMatrix.needsUpdate = true;
  }

  clearDecals() { this.decalMesh.count = 0; this.decalCursor = 0; }

  update(dt, camera) {
    this.time += dt;
    this.sparks.update(dt); this.smoke.update(dt); this.blood.update(dt); this.debris.update(dt);
    // flashes
    for (const f of this.flashes) { if (!f.sprite.visible) continue; f.t -= dt; if (f.t <= 0) { f.sprite.visible = false; f.light.intensity = 0; } else f.light.intensity *= 0.75; }
    // tracers
    let n = 0;
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]; tr.t += dt;
      const k = tr.t / tr.dur;
      if (k >= 1.15) { this.tracers.splice(i, 1); continue; }
      if (n >= this.tracerMax) continue;
      const head = Math.min(1, k), tail = Math.max(0, k - 0.035 / Math.max(0.03, tr.dur));
      const dir = this._v.subVectors(tr.to, tr.from).normalize();
      const start = new THREE.Vector3().copy(tr.from).addScaledVector(dir, tr.len * tail);
      const segLen = Math.max(0.1, tr.len * (head - tail));
      this._m.lookAt(start, new THREE.Vector3().copy(start).add(dir), up);
      this._q.setFromRotationMatrix(this._m);
      this._m.compose(start, this._q, this._s.set(1, 1, segLen));
      this.tracerMesh.setMatrixAt(n++, this._m);
    }
    this.tracerMesh.count = n; this.tracerMesh.instanceMatrix.needsUpdate = true;
    // shockwaves / explosion lights
    for (let i = this.shocks.length - 1; i >= 0; i--) { const s = this.shocks[i]; s.t += dt; const k = s.t / 0.55; if (k >= 1) { this.scene.remove(s.mesh); s.mesh.material.dispose(); this.shocks.splice(i, 1); continue; } s.mesh.scale.setScalar(0.5 + k * 9); s.mesh.material.opacity = 0.7 * (1 - k); }
    for (let i = this.explLights.length - 1; i >= 0; i--) { const e = this.explLights[i]; e.t += dt; const k = e.t / 0.6; if (k >= 1) { e.light.intensity = 0; this.explLights.splice(i, 1); continue; } e.light.intensity = 400 * (1 - k) * (1 - k); }
    if (this.rain) { this.rain.material.uniforms.uTime.value = this.time; this.rain.material.uniforms.uCenter.value.copy(camera.position); }
  }
}
