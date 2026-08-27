import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GradeShader } from './postfx';
import { BUILDINGS, FLOOR_H, buildCity, buildingOf, floorY, spotAt, type CityParts } from './city';
import { buildInteriors, revealFloors, type Interior } from './interior';
import { CodeVeins, type Vein } from './glyphs';
import { Figures } from './figures';
import { bus } from '../game/bus';
import { makeObject, type PlaceObject } from './objects';
import type { GameState, Place } from '../game/types';

/**
 * One world, one camera, and no other screens.
 *
 * You can be anywhere: a hundred metres above the block, level with the
 * fourteenth floor, or close enough to a desk to read the light on a monitor.
 * The buildings open as you come down through them, and everything you hold is
 * joined by running code you can watch move.
 */

const MINE = new THREE.Color('#5ff6ff');
const COLD = new THREE.Color('#5c7383');
const WARM = new THREE.Color('#ffb347');
const HOT = new THREE.Color('#ff5470');

interface Marker { place: Place; obj: PlaceObject; ring: THREE.Mesh }

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private grade: ShaderPass;
  private bloom: UnrealBloomPass;

  private city: CityParts;
  private inside: Interior;
  private veins = new CodeVeins();
  private figures = new Figures();
  private markers = new Map<string, Marker>();
  private objectGroup = new THREE.Group();
  private ray = new THREE.Raycaster();
  private t = 0;
  /** Which building is open right now, and which floor the camera is on. */
  private host: string | null = null;
  private onFloor = 0;
  /** A soft light that travels with you, so a room is never a black box. */
  private here = new THREE.PointLight(0xbfe4f5, 0, 30, 2);
  private hereWant = 0;

  /** Where the camera is looking, how far away, and from what angle. */
  private target = new THREE.Vector3(10, 26, 10);
  private want = new THREE.Vector3(10, 26, 10);
  private dist = 150;
  private wantDist = 150;
  private yaw = -0.75;
  private pitch = 0.5;
  private wantPitch = 0.5;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.42;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'world-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.15, 4000);

    this.city = buildCity();
    this.inside = buildInteriors();
    this.scene.add(this.city.group, this.inside.group, this.objectGroup,
      this.veins.group, this.figures.group);
    this.light();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.7, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.grade.renderToScreen = true;
    this.composer.addPass(this.grade);
    this.grade.uniforms.uScan.value = 0.18;
    this.grade.uniforms.uGrain.value = 0.34;
    this.grade.uniforms.uChroma.value = 0.5;

    // Something happened in a room: everyone near enough turns and looks.
    bus.on('felt', ({ placeId, kind }) => {
      const m = this.markers.get(placeId);
      if (m) this.figures.felt(m.obj.group.position.clone().setY(m.obj.group.position.y + 1.2), kind);
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ── night ─────────────────────────────────────────────────────────────────

  private light() {
    this.scene.fog = new THREE.FogExp2(0x061020, 0.0011);
    this.scene.background = new THREE.Color(0x060d1a);

    // Sky glow above, the warm wash off the pavement below.
    this.scene.add(new THREE.HemisphereLight(0x3d5a78, 0x2a2013, 1.45));
    this.scene.add(new THREE.AmbientLight(0x2e3646, 0.5));

    const moon = new THREE.DirectionalLight(0xa9c9e4, 1.15);
    moon.position.set(-140, 190, 90);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 20;
    moon.shadow.camera.far = 520;
    const c = moon.shadow.camera as THREE.OrthographicCamera;
    c.left = -140; c.right = 140; c.top = 140; c.bottom = -140;
    this.scene.add(moon);

    // A warm bounce off the street, so the ground floor is not a black hole.
    const street = new THREE.PointLight(0xffb060, 1400, 210, 2);
    street.position.set(34, 9, 40);
    this.scene.add(street);

    // Wherever you are, there is enough light to see the room you are in.
    this.scene.add(this.here);
  }

  // ── the things you click ──────────────────────────────────────────────────

  build(state: GameState) {
    this.objectGroup.clear();
    this.markers.clear();
    for (const place of Object.values(state.places)) {
      const obj = makeObject(place.kind);
      obj.group.position.copy(spotAt(place.buildingId, place.floor, place.x, place.z, place.y));
      obj.group.userData.placeId = place.id;
      obj.hit.userData.placeId = place.id;

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.035, 6, 28),
        new THREE.MeshBasicMaterial({
          color: WARM, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.1;
      obj.group.add(ring);

      this.objectGroup.add(obj.group);
      this.markers.set(place.id, { place, obj, ring });
    }
    this.figures.build(state);
    this.figures.sync(state);
  }

  /** Colour is the whole readout: cyan is mine, amber is watched, red is going. */
  sync(state: GameState) {
    for (const [id, m] of this.markers) {
      const p = state.places[id];
      m.place = p;
      const shown = p.mine || p.found;
      m.obj.group.visible = shown;
      if (!shown) continue;

      let color = p.mine ? MINE : COLD;
      if (p.attention >= 2) color = WARM;
      if (p.cutOn !== undefined) color = HOT;
      for (const part of m.obj.glowParts) {
        (part.material as THREE.MeshBasicMaterial).color.copy(color);
      }
    }

    // A vein for every wire between two places you hold.
    const veins = new Map<string, Vein>();
    for (const p of Object.values(state.places)) {
      if (!p.mine) continue;
      for (const l of p.links) {
        const other = state.places[l.to];
        if (!other?.mine) continue;
        const k = [p.id, l.to].sort().join('|');
        if (veins.has(k)) continue;
        veins.set(k, {
          from: spotAt(p.buildingId, p.floor, p.x, p.z, p.y + 0.4),
          to: spotAt(other.buildingId, other.floor, other.x, other.z, other.y + 0.4),
        });
      }
    }
    this.veins.set(veins);
    this.figures.sync(state);
  }

  /** The ring that says "this is the one". */
  point(placeId: string | null) {
    for (const [id, m] of this.markers) {
      (m.ring.material as THREE.MeshBasicMaterial).opacity = id === placeId ? 0.95 : 0;
    }
  }

  // ── camera ────────────────────────────────────────────────────────────────

  /** Fly to a place and stand close enough to see what is on the desk. */
  goTo(place: Place, close = true) {
    const at = spotAt(place.buildingId, place.floor, place.x, place.z, place.y);
    this.want.copy(at).add(new THREE.Vector3(0, 1.2, 0));
    this.wantDist = close ? 12 : 34;
    // Inside a room you look across it, not down onto it through the ceiling.
    this.wantPitch = place.buildingId === 'street' ? 0.3 : 0.1;
  }

  /** Back out to where you can see the whole block. */
  wide() {
    this.want.set(18, 26, 14);
    this.wantDist = this.fit(190);
    this.wantPitch = 0.62;
  }

  private fit(d: number) {
    const r = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    return d * (r < 1 ? 1.5 : r < 1.4 ? 1.18 : 1);
  }

  orbit(dx: number, dy: number) {
    this.yaw -= dx * 0.005;
    this.wantPitch = Math.min(1.32, Math.max(-0.28, this.wantPitch + dy * 0.004));
  }

  pan(dx: number, dy: number) {
    const s = Math.max(0.02, this.dist * 0.0013);
    const f = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    this.want.addScaledVector(r, -dx * s).addScaledVector(f, dy * s);
  }

  /** One wheel gesture takes you from over the roofs down to a keyboard. */
  zoom(delta: number) {
    const k = Math.exp(delta * 0.0016);
    this.wantDist = Math.min(560, Math.max(3.2, this.wantDist * k));
  }

  /** Climb or drop through the floors of the building you are in. */
  lift(dy: number) {
    this.want.y = Math.max(-FLOOR_H, Math.min(floorY(15) + 30, this.want.y + dy));
  }

  pick(clientX: number, clientY: number): string | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    ), this.camera);
    const targets = Array.from(this.markers.values())
      .filter((m) => m.obj.group.visible)
      .map((m) => m.obj.hit);
    const hits = this.ray.intersectObjects(targets, false);
    return hits.length ? (hits[0].object.userData.placeId as string) : null;
  }

  project(placeId: string): { x: number; y: number; z: number } | null {
    const m = this.markers.get(placeId);
    if (!m || !m.obj.group.visible) return null;
    const v = m.obj.group.position.clone();
    v.y += 1.3;
    v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, z: v.z };
  }

  /** True once you are close enough that naming everything around you helps. */
  get near(): boolean { return this.dist < 78; }

  shake(a: number) { this.grade.uniforms.uGlitch.value = a; }
  alert(a: number) { this.grade.uniforms.uAlert.value = a; }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.grade.uniforms.uRes.value.set(w, h);
  }

  // ── frame ─────────────────────────────────────────────────────────────────

  render(dt: number) {
    this.t += dt;
    const k = Math.min(1, dt * 3.2);
    this.target.lerp(this.want, k);
    this.dist += (this.wantDist - this.dist) * k;
    this.pitch += (this.wantPitch - this.pitch) * k;

    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.cos(this.yaw) * cp * this.dist,
      Math.max(0.9, this.target.y + Math.sin(this.pitch) * this.dist),
      this.target.z + Math.sin(this.yaw) * cp * this.dist,
    );
    this.camera.lookAt(this.target);

    this.openBuildings();

    // The travelling light comes up only when you are close enough to be indoors.
    // Behind and above the eye, so the near wall is not the brightest thing in the room.
    this.here.position.copy(this.camera.position).sub(
      this.target.clone().sub(this.camera.position).normalize().multiplyScalar(-2.4),
    );
    this.here.position.y += 1.6;
    // Enough to see the room by, and no more: this light is a torch, not a sun.
    this.hereWant = this.dist < 46 ? 26 : this.dist < 110 ? 34 : 0;
    this.here.intensity += (this.hereWant - this.here.intensity) * Math.min(1, dt * 4);
    this.here.distance = 26 + this.dist * 0.7;
    this.city.tick(this.t, dt);
    this.veins.setScale(THREE.MathUtils.clamp(this.dist * 0.0055, 0.16, 1.5));
    this.veins.update(dt);
    this.figures.update(dt, this.camera.position, this.host, this.onFloor);

    // Rings and lit faces breathe, so a live board never looks like a picture.
    const pulse = 0.72 + Math.abs(Math.sin(this.t * 2.2)) * 0.28;
    for (const m of this.markers.values()) {
      if (!m.obj.group.visible) continue;
      m.ring.rotation.z += dt * 0.9;
      const mat = m.ring.material as THREE.MeshBasicMaterial;
      if (mat.opacity > 0) mat.opacity = 0.45 + pulse * 0.5;
      if (m.place.cutOn !== undefined) {
        for (const part of m.obj.glowParts) {
          (part.material as THREE.MeshBasicMaterial).color.copy(HOT).multiplyScalar(pulse);
        }
      }
    }

    this.grade.uniforms.uTime.value = this.t;
    this.grade.uniforms.uGlitch.value = Math.max(0, this.grade.uniforms.uGlitch.value - dt * 1.7);
    this.composer.render();
  }

  /**
   * The building you are inside opens up: its near walls dissolve and the
   * floors around you appear. Step back out and it closes again.
   */
  private openBuildings() {
    const cam = this.camera.position;
    let host: string | null = null;
    let best = Infinity;
    for (const b of BUILDINGS) {
      if (!b.inside) continue;
      const d = Math.hypot(cam.x - b.x, cam.z - b.z);
      const within = d < Math.max(b.w, b.d) * 1.9 + 26 && cam.y < b.floors * FLOOR_H + 24;
      if (within && d < best) { best = d; host = b.id; }
    }

    for (const b of BUILDINGS) {
      const parts = this.city.shells.get(b.id);
      if (!parts) continue;
      const open = host === b.id;
      // Standing in the room is different from looking into it from the street:
      // from inside, every wall has to get out of the way, not just the near one.
      const within = Math.abs(cam.x - b.x) < b.w / 2 + 2 && Math.abs(cam.z - b.z) < b.d / 2 + 2;
      for (const part of parts) {
        const mat = part.material as THREE.MeshStandardMaterial;
        // From outside: only the walls between you and the room dissolve.
        const toWall = part.position.clone().sub(new THREE.Vector3(b.x, part.position.y, b.z));
        const toCam = cam.clone().sub(new THREE.Vector3(b.x, cam.y, b.z));
        const facing = toWall.normalize().dot(toCam.normalize()) > 0.15;
        const want = open ? (within ? 0.04 : facing ? 0.06 : 0.42) : 1;
        mat.opacity += (want - mat.opacity) * 0.12;
        mat.transparent = mat.opacity < 0.99;
        mat.depthWrite = mat.opacity > 0.55;
      }
      const win = this.city.windows.get(b.id);
      if (win) {
        const wm = win.material as THREE.MeshBasicMaterial;
        wm.opacity += ((host === b.id ? 0.12 : 0.8) - wm.opacity) * 0.12;
      }
    }

    const floor = Math.round(this.target.y / FLOOR_H);
    this.host = host;
    this.onFloor = floor;
    revealFloors(this.inside, host, floor, host ? 3 : 0);
  }
}

export { buildingOf };
