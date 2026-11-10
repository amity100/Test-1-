import * as THREE from 'three';
import { buildRide } from '../game/partbuild.js';
import { itemMats } from '../game/items.js';

// (ROADMAP 11.10, the sample) What is being drawn, as it will be made: a small model by the
// drawing, turning slowly, built again after each line (game/partbuild.js, the very model the
// street will get) - so you see what the game understood before the ink is spent. A little
// renderer of its own: the game's picture is not touched, and it draws only while the pen is out
// and there is something to show (no more than 30 times a second). Its paint under ordinary
// lights, a soft room to shine in, an inked outline round it, its shadow under it.

const INK = new THREE.Color(0.07, 0.06, 0.1);

export class PartView {
  constructor(canvas) {
    this.cv = canvas;
    this.r = null;
    this.dead = false;
    this.root = null;
    this.yaw = -0.75;
    this.acc = 1;
    this.w = 0;
    this.h = 0;
    // (a phone draws the game at the same time: the model a little less often there)
    this.every = matchMedia && matchMedia('(pointer: coarse)').matches ? 1 / 20 : 1 / 30;
  }

  init() {
    if (this.r || this.dead) return !!this.r;
    try {
      this.r = new THREE.WebGLRenderer({ canvas: this.cv, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch (err) {
      this.dead = true;
      return false;
    }
    const r = this.r;
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(26, 2, 0.1, 500);
    this.scene.add(new THREE.HemisphereLight(0xfff3e0, 0x786f62, 1.3));
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.3);
    sun.position.set(-4, 7, 5);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xc4dcff, 1.3);
    rim.position.set(5, 3, -6);
    this.scene.add(rim);
    this.scene.environment = roomEnv(r);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.shadow = shadowDisc();
    this.pivot.add(this.shadow);
    this.mats = previewMats();
    this.uW = { value: 0.02 };
    this.outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    this.outline.onBeforeCompile = (sh) => {
      sh.uniforms.uW = this.uW;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uW;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += normalize(normal) * uW;');
    };
    return true;
  }

  // the design to show (null: nothing)
  set(design, spec) {
    if (!this.init()) return;
    this.drop();
    if (!design || !spec || !spec.ok || !(spec.L > 0)) {
      this.render(true);
      return;
    }
    let m;
    try {
      m = buildRide(design, spec);
    } catch (err) {
      console.warn('partview', err);
      return;
    }
    this.show(m.body);
  }

  // (ROADMAP 11.11, parts 2) a thing for the hand, as it will be made: its model (game/freeform.js
  // buildWeapon) - a gun, a blade, a hammer, a bomb (null: nothing)
  setModel(make, small = true) {
    if (!this.init()) return;
    this.drop();
    let root = null;
    try {
      root = make ? make() : null;
    } catch (err) {
      console.warn('partview', err);
      root = null;
    }
    if (!root) {
      this.render(true);
      return;
    }
    this.show(root, small);
  }

  // (small: a thing for the hand - its outline and its shadow as fine as it is)
  show(root, small = false) {
    this.small = small;
    root.updateMatrixWorld(true);
    // (its paint as it will be, under the lights here; an outline round each part)
    const add = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      // (a paint of the game's own that is none of the kit's - a parachute's: an ordinary one)
      let pm = this.mats.get(o.material);
      if (!pm && o.material && !o.material.isMeshBasicMaterial && !o.material.isMeshStandardMaterial) {
        pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: o.material.side });
        this.mats.set(o.material, pm);
      }
      if (pm) o.material = pm;
      if (o.material && o.material.isMeshBasicMaterial) return;
      const ol = new THREE.Mesh(o.geometry, this.outline);
      ol.frustumCulled = false;
      ol.matrixAutoUpdate = false;
      add.push([o, ol]);
    });
    for (const [o, ol] of add) o.add(ol);
    // (centred, turning about its middle)
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);
    root.matrixAutoUpdate = true;
    this.pivot.add(root);
    this.root = root;
    this.size = size;
    this.R = Math.max(small ? 0.1 : 0.5, size.length() / 2);
    this.uW.value = small ? clampN(this.R * 0.014, 0.002, 0.012) : clampN(this.R * 0.012, 0.012, 0.08);
    const m = small ? 0.12 : 0.6;
    this.shadow.scale.set(Math.max(size.x, m) * 0.75, 1, Math.max(size.z, m) * 0.62);
    this.acc = 1;
  }

  drop() {
    if (!this.root) return;
    this.pivot.remove(this.root);
    this.root.traverse((o) => {
      if (o.isMesh && o.material !== this.outline) o.geometry.dispose();
    });
    this.root = null;
  }

  // each frame while the pen is out (dt: s)
  frame(dt) {
    if (!this.r || !this.root) return;
    this.yaw += dt * 0.55;
    // (a thing for the hand: seen from its side, its front to the right - turning a little to
    // and fro, not all the way round)
    if (this.small) this.pivot.userData.sway = Math.sin(this.yaw * 1.4) * 0.7;
    this.acc += dt;
    if (this.acc < this.every) return;
    this.acc = 0;
    this.render();
  }

  render(clear = false) {
    const r = this.r;
    if (!r) return;
    const w = Math.max(1, this.cv.clientWidth);
    const h = Math.max(1, this.cv.clientHeight);
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.setSize(w, h, false);
      this.cam.aspect = w / h;
      this.cam.updateProjectionMatrix();
    }
    if (clear || !this.root) {
      r.clear();
      return;
    }
    this.pivot.rotation.y = this.small ? Math.PI / 2 + (this.pivot.userData.sway || 0) : this.yaw;
    // (far enough back for all of it as it turns - across, and up, seen from a little above)
    const el = 0.3;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.cam.fov) / 2);
    const rxz = Math.hypot(this.size.x, this.size.z) / 2;
    const hp = this.size.y * Math.cos(el) + rxz * 2 * Math.sin(el);
    const d = Math.max(rxz / (0.9 * this.cam.aspect * tan), hp / 2 / (0.82 * tan)) + rxz * 0.35;
    const cy = this.size.y * 0.42;
    this.cam.position.set(0, cy + Math.sin(el) * d, Math.cos(el) * d);
    this.cam.lookAt(0, cy, 0);
    r.render(this.scene, this.cam);
  }
}

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// the game's paints (game/items.js) as ordinary materials: glossy paint, matte, metal, glass, glow
function previewMats() {
  const M = itemMats();
  const map = new Map();
  map.set(M.paint, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.06, clearcoat: 0.7, clearcoatRoughness: 0.14 }));
  map.set(M.matte, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }));
  map.set(M.round, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 }));
  map.set(M.metal, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.72 }));
  map.set(M.glass, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 }));
  map.set(M.glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  return map;
}

// a soft room to shine in: light from above, a darker floor, two windows of light
function roomEnv(r) {
  const pm = new THREE.PMREMGenerator(r);
  const sc = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const pos = geo.attributes.position;
  const col = [];
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 10 + 1) / 2;
    col.push(0.28 + t * 0.62, 0.26 + t * 0.6, 0.24 + t * 0.6);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (x, y, z, w, h, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.97, k * 0.92), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    sc.add(m);
  };
  panel(-5, 6, 4, 6, 3, 3.2);
  panel(6, 2.5, -4, 3, 5, 1.8);
  const tex = pm.fromScene(sc, 0.04).texture;
  pm.dispose();
  geo.dispose();
  return tex;
}

// its shadow under it: a soft dark ellipse
function shadowDisc() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(20, 18, 28, 0.42)');
  gr.addColorStop(1, 'rgba(20, 18, 28, 0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.position.y = 0.005;
  m.renderOrder = -1;
  return m;
}
