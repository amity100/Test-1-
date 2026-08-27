import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GradeShader } from './postfx';
import type { GameState, Place } from '../game/types';

/**
 * The view from outside: a dark tower on a dark street, and a light for every
 * place. What the player is watching is the light spreading — that is the whole
 * game, drawn.
 */

const MINE = new THREE.Color('#5ff6ff');
const KNOWN = new THREE.Color('#7d8fa0');
const WARM = new THREE.Color('#ffb347');
const HOT = new THREE.Color('#ff5470');

/** Floors are read off the plain Hebrew, so the world file never repeats itself. */
function floorY(where: string): number {
  if (where.includes('מינוס')) return -16;
  if (where.includes('14')) return 128;
  if (where.includes('9')) return 78;
  if (where.includes('קרקע')) return 6;
  if (where.includes('הבית')) return 26;
  return 6;
}

interface Marker {
  place: Place;
  group: THREE.Group;
  core: THREE.Mesh;
  glow: THREE.Sprite;
  ring: THREE.Mesh;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Scene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private grade: ShaderPass;
  private markers = new Map<string, Marker>();
  private linkGroup = new THREE.Group();
  private markerGroup = new THREE.Group();
  private ray = new THREE.Raycaster();
  private glowTex = glowTexture();
  private t = 0;

  /** Where the camera is looking, and how far away. */
  private target = new THREE.Vector3(25, 68, 30);
  private want = new THREE.Vector3(25, 68, 30);
  private dist = 660;
  private wantDist = 660;
  private yaw = -0.9;
  private pitch = 0.33;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.className = 'world-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(44, 1, 1, 6000);
    this.scene.add(this.linkGroup, this.markerGroup);
    this.buildScenery();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.6, 0.22));
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.grade.renderToScreen = true;
    this.composer.addPass(this.grade);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ── the tower and the street ──────────────────────────────────────────────

  private buildScenery() {
    this.scene.fog = new THREE.FogExp2(0x04070c, 0.0009);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshBasicMaterial({ color: 0x060b12 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -26;
    this.scene.add(ground);

    this.tower(25, 30, 224, 190, -24, 152, 15, 0x5ff6ff);   // the tower you woke up in
    this.tower(432, 100, 170, 150, -20, 74, 8, 0x3a5566);   // the company across the street

    // Two strips of asphalt, so "the street" is a place and not a word.
    for (const [x, z, w, d] of [[300, 215, 780, 34], [280, 300, 34, 700]] as const) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ color: 0x0b141d }),
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, -25, z);
      this.scene.add(road);
    }

    // Cold neighbours out to the horizon.
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cold = new THREE.MeshBasicMaterial({ color: 0x08111a });
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(box, cold);
      const a = (i / 34) * Math.PI * 2 + 0.4;
      const r = 780 + (i % 5) * 240;
      m.position.set(Math.cos(a) * r + 160, 18 + (i % 6) * 26, Math.sin(a) * r + 160);
      m.scale.set(90 + (i % 3) * 44, 70 + (i % 6) * 70, 90 + (i % 4) * 34);
      this.scene.add(m);
    }
  }

  /** A building: floor plates you can count, faint corners, and a few lit windows. */
  private tower(
    cx: number, cz: number, w: number, d: number,
    yBottom: number, yTop: number, floors: number, tint: number,
  ) {
    const step = (yTop - yBottom) / floors;

    // Each floor is an outline, so the stack reads as storeys from any angle.
    const plate = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.6, d));
    const plateMat = new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.16 });
    for (let i = 0; i <= floors; i++) {
      const m = new THREE.LineSegments(plate, plateMat);
      m.position.set(cx, yBottom + i * step, cz);
      this.scene.add(m);
    }

    // A dark mass inside, so the building has weight and the lights sit on it.
    const mass = new THREE.Mesh(
      new THREE.BoxGeometry(w - 4, yTop - yBottom, d - 4),
      new THREE.MeshBasicMaterial({ color: 0x070e15 }),
    );
    mass.position.set(cx, (yTop + yBottom) / 2, cz);
    this.scene.add(mass);

    // Corners.
    const corner = new THREE.CylinderGeometry(1.1, 1.1, yTop - yBottom, 6);
    const cornerMat = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.22 });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const c = new THREE.Mesh(corner, cornerMat);
      c.position.set(cx + sx * (w / 2), (yTop + yBottom) / 2, cz + sz * (d / 2));
      this.scene.add(c);
    }

    // Windows: a handful still on at three in the morning.
    const winGeo = new THREE.PlaneGeometry(6.5, 3.6);
    const winMat = new THREE.MeshBasicMaterial({
      color: 0xa8dbea, transparent: true, opacity: 0.62, side: THREE.DoubleSide,
    });
    let n = 0;
    for (let f = 0; f < floors; f++) {
      for (let k = 0; k < 10; k++) {
        n += 1;
        if ((n * 7919) % 13 > 3) continue;
        const y = yBottom + f * step + step * 0.55;
        const t = (k / 9) * 2 - 1;
        const side = (n * 104729) % 4;
        const win = new THREE.Mesh(winGeo, winMat);
        if (side < 2) {
          win.position.set(cx + t * (w / 2 - 14), y, cz + (side === 0 ? d / 2 : -d / 2) + 1.5);
        } else {
          win.position.set(cx + (side === 2 ? w / 2 : -w / 2) + 1.5, y, cz + t * (d / 2 - 14));
          win.rotation.y = Math.PI / 2;
        }
        this.scene.add(win);
      }
    }
  }

  // ── markers ───────────────────────────────────────────────────────────────

  build(state: GameState) {
    this.markerGroup.clear();
    this.markers.clear();
    const geo = new THREE.SphereGeometry(6, 16, 12);

    for (const place of Object.values(state.places)) {
      const group = new THREE.Group();
      group.position.set(place.x, floorY(place.where), place.z);

      const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: KNOWN }));
      group.add(core);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: KNOWN, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
      }));
      glow.scale.set(64, 64, 1);
      group.add(glow);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(12, 13.6, 32),
        new THREE.MeshBasicMaterial({
          color: WARM, transparent: true, opacity: 0, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      group.add(ring);

      this.markerGroup.add(group);
      this.markers.set(place.id, { place, group, core, glow, ring });
    }
  }

  /** Redrawn whenever anything changes: colour is the whole readout. */
  sync(state: GameState) {
    for (const [id, m] of this.markers) {
      const p = state.places[id];
      m.place = p;
      const shown = p.mine || p.found;
      m.group.visible = shown;
      if (!shown) continue;

      let color = p.mine ? MINE : KNOWN;
      if (p.attention >= 2) color = WARM;
      if (p.cutOn !== undefined) color = HOT;

      (m.core.material as THREE.MeshBasicMaterial).color.copy(color);
      const gm = m.glow.material as THREE.SpriteMaterial;
      gm.color.copy(color);
      gm.opacity = p.mine ? 0.85 : 0.3;
      m.glow.scale.setScalar(p.mine ? 92 : 52);
      m.core.scale.setScalar(p.mine ? 1.25 : 0.8);
      (m.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    // Links: a lit thread between two places that are both yours.
    this.linkGroup.clear();
    const seen = new Set<string>();
    for (const p of Object.values(state.places)) {
      if (!p.mine) continue;
      for (const l of p.links) {
        const other = state.places[l.to];
        if (!other || !(other.mine || other.found)) continue;
        const key = [p.id, l.to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = new THREE.Vector3(p.x, floorY(p.where), p.z);
        const b = new THREE.Vector3(other.x, floorY(other.where), other.z);
        const both = other.mine;
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([a, b]),
          new THREE.LineBasicMaterial({
            color: both ? MINE : KNOWN,
            transparent: true,
            opacity: both ? 0.5 : 0.16,
          }),
        );
        this.linkGroup.add(line);
      }
    }
  }

  /** A soft ring around the place the game is asking about. */
  point(placeId: string | null) {
    for (const [id, m] of this.markers) {
      const mat = m.ring.material as THREE.MeshBasicMaterial;
      mat.opacity = id === placeId ? 0.9 : 0;
    }
  }

  // ── camera ────────────────────────────────────────────────────────────────

  focus(place: Place, close = false) {
    this.want.set(place.x, floorY(place.where), place.z);
    this.wantDist = this.fit(close ? 260 : 440);
  }

  /** A narrow screen needs to stand further back to see the same building. */
  private fit(d: number): number {
    const r = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    return d * (r < 1 ? 1.55 : r < 1.4 ? 1.2 : 1);
  }

  wide() { this.want.set(25, 68, 30); this.wantDist = this.fit(660); }
  orbit(dx: number, dy: number) {
    this.yaw -= dx * 0.005;
    this.pitch = Math.min(1.25, Math.max(0.08, this.pitch + dy * 0.004));
  }
  pan(dx: number, dy: number) {
    const s = this.dist * 0.0016;
    this.want.x -= (Math.cos(this.yaw) * dx - Math.sin(this.yaw) * dy) * s;
    this.want.z -= (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dy) * s;
  }
  zoom(d: number) { this.wantDist = Math.min(1400, Math.max(120, this.wantDist + d)); }

  /** Which place is under this screen point, if any. */
  pick(clientX: number, clientY: number): string | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(v, this.camera);
    const hits = this.ray.intersectObjects(
      Array.from(this.markers.values()).filter((m) => m.group.visible).map((m) => m.core),
      false,
    );
    if (!hits.length) return null;
    for (const [id, m] of this.markers) if (m.core === hits[0].object) return id;
    return null;
  }

  /** Screen position of a place, for drawing its name on top of the canvas. */
  project(placeId: string): { x: number; y: number; z: number } | null {
    const m = this.markers.get(placeId);
    if (!m || !m.group.visible) return null;
    const v = m.group.position.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * r.width,
      y: (-v.y * 0.5 + 0.5) * r.height,
      z: v.z,
    };
  }

  shake(amount: number) { this.grade.uniforms.uGlitch.value = amount; }
  alert(level: number) { this.grade.uniforms.uAlert.value = level; }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.grade.uniforms.uRes.value.set(w, h);
  }

  render(dt: number) {
    this.t += dt;
    this.target.lerp(this.want, Math.min(1, dt * 3.4));
    this.dist += (this.wantDist - this.dist) * Math.min(1, dt * 3.4);

    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.cos(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.sin(this.yaw) * cp * this.dist,
    );
    this.camera.lookAt(this.target);

    // The mine-markers breathe, so a live board never looks like a screenshot.
    const pulse = 1 + Math.sin(this.t * 2.1) * 0.12;
    for (const m of this.markers.values()) {
      if (!m.group.visible) continue;
      if (m.place.mine) m.glow.scale.setScalar(92 * pulse);
      if (m.place.cutOn !== undefined) {
        (m.core.material as THREE.MeshBasicMaterial).color.setScalar(0.5 + Math.abs(Math.sin(this.t * 4)) * 0.5);
        (m.core.material as THREE.MeshBasicMaterial).color.multiply(HOT);
      }
      m.ring.lookAt(this.camera.position);
    }

    this.grade.uniforms.uTime.value = this.t;
    this.grade.uniforms.uGlitch.value = Math.max(0, this.grade.uniforms.uGlitch.value - dt * 1.8);
    this.composer.render();
  }
}
