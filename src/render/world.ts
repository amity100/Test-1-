import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GradeShader } from './postfx';
import { BUILDINGS, FLOOR_H, buildCity, buildingOf, doorSpot, floorY, spotAt, type CityParts } from './city';
import { buildInteriors, revealFloors, type Interior } from './interior';
import { Swarm } from './swarm';
import { CodeVeins, type Vein } from './glyphs';
import { Figures } from './figures';
import { bus } from '../game/bus';
import { makeObject, type ObjState, type PlaceObject } from './objects';
import { makeStructure, ringSize } from './structures';
import { hasLandmark, landmarkSize, makeLandmark } from './landmarks';
import { buildLand, type Land } from './land';
import { buildTelAviv, type TelAviv } from './telaviv';
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
/** How wide the thing standing here is: the real building, or its kind's shape. */
function sizeOf(placeId: string, kind: Place['kind']): number {
  return hasLandmark(placeId) ? landmarkSize(placeId) * 0.5 : ringSize(kind);
}

const MOON_OFF = new THREE.Vector3(-140, 190, 90);
const LAMP_OFF = new THREE.Vector3(20, 90, 40);
const WARM = new THREE.Color('#ffb347');
const HOT = new THREE.Color('#ff5470');

interface Marker { place: Place; obj: PlaceObject; ring: THREE.Mesh; busy: number }

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private grade: ShaderPass;
  private bloom: UnrealBloomPass;

  private city: CityParts;
  private lamp!: THREE.PointLight;
  private fogBase = 0.0011;
  private drawn = 0;
  private tris = 0;

  /**
   * How many real pixels to draw for each pixel of screen — and the machinery
   * that keeps lowering it until the game runs smoothly.
   *
   * A phone reports three device pixels per screen pixel, and drawing three
   * times as many pixels through a night scene with a glow pass is exactly the
   * "מאוד איטי בפלאפון" the game was. So the picture starts sharp and steps
   * down whenever frames take too long, and steps back up when there is room.
   * The player never sees the switch; they see a game that keeps up.
   */
  private sharp = Math.min(devicePixelRatio || 1, 2);
  private readonly sharpest = Math.min(devicePixelRatio || 1, 2);
  /** Rolling frame times, in milliseconds. */
  private frames: number[] = [];
  /** Seconds until the next time the picture is allowed to change. */
  private settle = 2.5;
  private lastFrame = 0;
  /**
   * The sharpest setting that has already been measured as too slow.
   *
   * Without it the thing meant to stop the picture flickering becomes a flicker
   * of its own: a machine that misses at two and comfortably makes it at one
   * and a half steps up, misses, steps down, and pulses every three seconds for
   * as long as the game is open. Once a setting has been shown not to hold, it
   * is not tried again.
   */
  private tooSharp = Infinity;
  private land: Land | null = null;
  private tlv: TelAviv;
  private inside: Interior;
  private veins = new CodeVeins();
  private swarm = new Swarm();
  private figures = new Figures();
  private markers = new Map<string, Marker>();
  private state: GameState | null = null;
  private objectGroup = new THREE.Group();
  private ray = new THREE.Raycaster();
  private t = 0;
  /** Which building is open right now, and which floor the camera is on. */
  private host: string | null = null;
  private onFloor = 0;
  /** 0 in the dark, 1 when the sun is up. The morning is a thing you watch. */
  private dawnNow = 0;
  private wantDawn = 0;
  private hemi!: THREE.HemisphereLight;
  private amb!: THREE.AmbientLight;
  private moon!: THREE.DirectionalLight;
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
    // No multisampling: every pass after the first draws into a buffer of its
    // own, so the flag would cost a phone a full extra sample per pixel and
    // never reach the screen. The softening the picture actually gets comes
    // from the grade pass at the end.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.sharp);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.42;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'world-canvas';
    container.appendChild(this.renderer.domElement);

    // The near plane moves with the view — see `nearFor`. A fixed 0.15 metres
    // against a four-kilometre horizon left barely a decimetre of depth
    // accuracy half a kilometre out, which is why every window pane and road
    // marking in the city flickered against the wall behind it.
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.15, 4000);
    // Counted by hand, so a frame with several passes reports the whole frame.
    this.renderer.info.autoReset = false;

    this.city = buildCity();
    // The real city: sea, river, sand, streets and the ordinary blocks between
    // the landmarks.
    this.tlv = buildTelAviv();
    this.scene.add(this.tlv.group);
    this.inside = buildInteriors();
    this.scene.add(this.city.group, this.inside.group, this.objectGroup,
      this.veins.group, this.swarm.group, this.figures.group);
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
    this.grade.uniforms.uGrain.value = 0.22;
    this.grade.uniforms.uChroma.value = 0.5;

    // Something happened in a room: everyone near enough turns and looks.
    bus.on('felt', ({ placeId, kind }) => {
      const m = this.markers.get(placeId);
      if (!m) return;
      // The thing itself reacts too: the phone lights up, the door swings, the
      // printer pushes a sheet out. It settles down again over a second or two.
      m.busy = 1;
      this.figures.felt(m.obj.group.position.clone().setY(m.obj.group.position.y + 1.2), kind);
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ── night ─────────────────────────────────────────────────────────────────

  private light() {
    this.scene.fog = new THREE.FogExp2(0x061020, 0.0011);
    this.scene.background = new THREE.Color(0x060d1a);

    // Sky glow above, the warm wash off the pavement below.
    const hemi = new THREE.HemisphereLight(0x44607e, 0x33281a, 2.1);
    const amb = new THREE.AmbientLight(0x33405a, 0.95);
    this.scene.add(hemi);
    this.scene.add(amb);
    this.hemi = hemi;
    this.amb = amb;

    const moon = new THREE.DirectionalLight(0xa9c9e4, 1.15);
    moon.position.set(-140, 190, 90);
    moon.castShadow = true;
    // A smaller map that covers less ground is both cheaper and sharper than a
    // big one stretched over a whole city, and a stretched one is what put the
    // crawling speckle on every wall.
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 20;
    moon.shadow.camera.far = 520;
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.6;
    const c = moon.shadow.camera as THREE.OrthographicCamera;
    c.left = -180; c.right = 180; c.top = 180; c.bottom = -180;
    this.scene.add(moon);
    // The moon travels with the eye. Its shadow frustum is a box a few hundred
    // metres across, and the map is a country three thousand metres long — nailed
    // over Tel Aviv, it left everywhere else in permanent shadow, which is why
    // flying to Haifa arrived at a black screen with the right name on it.
    this.scene.add(moon.target);
    this.moon = moon;

    // A warm bounce off the street, so the ground floor is not a black hole.
    const street = new THREE.PointLight(0xffb060, 1400, 210, 2);
    street.position.set(34, 9, 40);
    this.scene.add(street);

    // And the same courtesy everywhere else: a soft lamp riding the view, so a
    // district four hundred metres from the city is lit like a place people
    // live in rather than a silhouette.
    this.lamp = new THREE.PointLight(0xffc98a, 0, 320, 2);
    this.scene.add(this.lamp);

    // Wherever you are, there is enough light to see the room you are in.
    this.scene.add(this.here);
  }

  // ── the things you click ──────────────────────────────────────────────────

  build(state: GameState) {
    // The country the districts stand in, built once from where they are.
    if (this.land) this.scene.remove(this.land.group);
    this.land = buildLand(Object.values(state.areas));
    this.scene.add(this.land.group);

    this.objectGroup.clear();
    this.markers.clear();
    for (const place of Object.values(state.places)) {
      // Inside one of the two towers you can walk into, a place is still the
      // thing on the desk. Everywhere else — which is the whole country — it is
      // a building, and it is drawn at the size of the building it is.
      // A hand-built model of the real place if one has been authored, the
      // generic shape for its kind if not, and the thing on the desk if you are
      // standing inside a room rather than in the city.
      const outside = place.buildingId === 'street';
      const obj = (outside && makeLandmark(place.id))
        || (outside ? makeStructure(place.kind, place.id) : makeObject(place.kind));
      obj.group.position.copy(spotAt(place.buildingId, place.floor, place.x, place.z, place.y));
      obj.group.userData.placeId = place.id;
      obj.hit.userData.placeId = place.id;

      const wide = outside ? sizeOf(place.id, place.kind) : 0.72;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(wide, wide * 0.05, 6, 28),
        new THREE.MeshBasicMaterial({
          color: WARM, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = outside ? 0.3 : 1.1;
      obj.group.add(ring);

      // Anything hung on a wall looks into the room; a front door looks out of it.
      const b = outside ? undefined : buildingOf(place.buildingId);
      if (b) {
        const inward = ['power', 'talk', 'water', 'money', 'company'].includes(place.kind);
        const outward = place.kind === 'city' || place.kind === 'state';
        if (inward) obj.group.rotation.y = Math.atan2(-place.x, -place.z);
        else if (outward) obj.group.rotation.y = Math.atan2(place.x, place.z);
      }

      this.objectGroup.add(obj.group);
      this.markers.set(place.id, { place, obj, ring, busy: 0 });
    }
    this.figures.build(state, this.inside.seats);
    this.figures.sync(state);
  }

  /** Colour is the whole readout: cyan is mine, amber is watched, red is going. */
  sync(state: GameState) {
    this.state = state;
    for (const [id, m] of this.markers) {
      const p = state.places[id];
      m.place = p;
      const shown = p.mine || p.found;
      m.obj.group.visible = shown;
      if (!shown) continue;

      let color = p.mine ? MINE : COLD;
      if (p.attention >= 2) color = WARM;
      if (p.cutAt !== undefined) color = HOT;
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

    // And a nest of them climbing the place itself, thicker the more of it is
    // mine. This is the one thing on screen that answers "how much of this is
    // yours" without a number: a place at a fifth has two strands feeling their
    // way up it, and a place that is entirely mine is wrapped.
    for (const p of Object.values(state.places)) {
      if (p.control <= 0) continue;
      const strands = Math.max(1, Math.round((p.control / 100) * 9));
      const root = spotAt(p.buildingId, p.floor, p.x, p.z, p.y);
      for (let i = 0; i < strands; i++) {
        // Fixed angles rather than random ones, so a vein does not jump to a
        // new side of the building every time anything in the game changes.
        const a = (i / strands) * Math.PI * 2 + p.x * 0.13;
        const reach = 1.1 + (i % 3) * 0.55;
        const up = 0.7 + ((i * 7) % 5) * 0.55;
        veins.set(`${p.id}~${i}`, {
          from: root.clone(),
          to: root.clone().add(new THREE.Vector3(Math.cos(a) * reach, up, Math.sin(a) * reach)),
        });
      }
    }
    this.veins.set(veins);

    // The storm. A churning wrap of source-tokens on every held place, sized
    // by how much of it is really held — and a pour of them across the city
    // toward anywhere a break-in is running, so spreading is something you
    // watch travel.
    const clouds = [];
    const streams = [];
    for (const p of Object.values(state.places)) {
      if (p.control <= 0) continue;
      clouds.push({
        id: p.id,
        center: spotAt(p.buildingId, p.floor, p.x, p.z, p.y + 1.2),
        grip: p.control / 100,
        size: 0.6 + Math.min(1, (p.guard + 20) / 80) * 0.7,
      });
    }
    for (const j of state.jobs) {
      if (j.taskId !== 'enter') continue;
      const target = state.places[j.placeId];
      if (!target) continue;
      // The pour comes from wherever I am strongest nearby — the same story
      // the game tells, drawn in the air.
      const source = Object.values(state.places)
        .filter((q) => q.control > 0 && q.id !== target.id)
        .sort((a, b) => {
          const near = (q: typeof a) => (q.areaId === target.areaId ? 0 : 1);
          return near(a) - near(b) || b.control - a.control;
        })[0];
      if (!source) continue;
      streams.push({
        id: `pour_${j.id}`,
        from: spotAt(source.buildingId, source.floor, source.x, source.z, source.y + 1.5),
        to: spotAt(target.buildingId, target.floor, target.x, target.z, target.y + 1.0),
      });
    }
    this.swarm.set(clouds, streams);
    this.figures.sync(state);
  }

  /** A place's special button fired: its storm erupts for a couple of seconds. */
  burst(placeId: string) { this.swarm.burst(placeId); }

  /** The ring that says "this is the one". */
  point(placeId: string | null) {
    for (const [id, m] of this.markers) {
      (m.ring.material as THREE.MeshBasicMaterial).opacity = id === placeId ? 0.95 : 0;
    }
  }

  // ── camera ────────────────────────────────────────────────────────────────

  /**
   * The nearest thing the camera bothers to draw, for a given view distance.
   *
   * Depth accuracy is decided almost entirely by this number, and it decides
   * whether the city shimmers. Held at fifteen centimetres against a
   * four-kilometre horizon, half a kilometre out the card could only tell
   * depths a decimetre apart — and every window pane in this city sits two
   * centimetres in front of its own wall, every road marking a hand's breadth
   * above its road. They flickered, all of them, all the time.
   *
   * From a kilometre up there is nothing within a few metres of the camera to
   * lose, so it is pushed out with the view; down in a room it comes back in,
   * because there a desk really is half a metre away.
   */
  static nearFor(dist: number): number {
    return THREE.MathUtils.clamp(dist * 0.012, 0.12, 6);
  }

  /** Fly to a place and stand close enough to see what is on the desk. */
  goTo(place: Place, close = true) {
    const at = spotAt(place.buildingId, place.floor, place.x, place.z, place.y);
    const outside = place.buildingId === 'street';
    // Frame the structure, not a point in front of it. Twelve metres is the
    // right distance from a monitor and completely inside a power station.
    const size = outside ? sizeOf(place.id, place.kind) : 1.2;
    // Far enough back that the whole structure is in the picture with some of
    // its district around it. Framed at three times its width the camera ends
    // up standing at the foot of a wall, which tells the player nothing about
    // where he is.
    this.want.copy(at).add(new THREE.Vector3(0, outside ? size * 0.55 : 1.2, 0));
    this.wantDist = outside
      ? this.fit(size * (close ? 5.5 : 9))
      : (close ? 12 : 34);
    // Inside a room you look across it, not down onto it through the ceiling.
    this.wantPitch = outside ? 0.5 : 0.1;
  }

  /**
   * Fly up and back until a whole district is in the picture.
   *
   * Districts are no longer all the same size: a generated one is a plate a
   * hundred metres across, and the surveyed Tel Aviv ones are as wide as the
   * ground they really cover — Ibn Gvirol's district is most of a kilometre.
   * One fixed distance cannot frame both, so it is framed from the span.
   */
  goToArea(x: number, z: number, span = 96) {
    this.want.set(x, 6, z);
    this.wantDist = this.fit(Math.max(240, span * 2.2));
    this.wantPitch = 0.62;
  }

  /** Back out to where you can see the whole block. */
  wide() {
    // Over the middle of Tel Aviv, high enough that the sea is on the right of
    // the picture and the towers read as a skyline rather than as a wall.
    this.want.set(120, 20, 380);
    this.wantDist = this.fit(1250);
    this.wantPitch = 0.58;
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

  /** What the renderer is actually being asked to do each frame. */
  cost() {
    const r = this.renderer.info.render;
    let meshes = 0;
    let inst = 0;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes += 1;
      if ((m as unknown as THREE.InstancedMesh).isInstancedMesh) inst += 1;
    });
    const count = (o: THREE.Object3D | null) => {
      let n = 0;
      o?.traverse((x) => { if ((x as THREE.Mesh).isMesh) n += 1; });
      return n;
    };
    return {
      city: count(this.city.group), tlv: count(this.tlv.group),
      land: count(this.land ? this.land.group : null),
      inside: count(this.inside.group), objs: count(this.objectGroup),
      figs: count(this.figures.group),
      calls: this.drawn, tris: this.tris, meshes, inst,
      progs: this.renderer.info.programs?.length ?? 0,
      geo: this.renderer.info.memory.geometries,
      tex: this.renderer.info.memory.textures,
    };
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

  project(placeId: string): { x: number; y: number; z: number; away: number } | null {
    const m = this.markers.get(placeId);
    if (!m || !m.obj.group.visible) return null;
    const at = m.obj.group.position;
    const v = at.clone();
    // Label a structure over its middle, not at its feet — a power station is
    // forty metres tall and a tag pinned to the tarmac beside it reads as
    // belonging to the ground.
    v.y += m.place.buildingId === 'street' ? sizeOf(m.place.id, m.place.kind) * 0.6 : 1.3;
    v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * r.width,
      y: (-v.y * 0.5 + 0.5) * r.height,
      z: v.z,
      away: at.distanceTo(this.camera.position),
    };
  }

  /** How far the camera is from a point, for deciding what to name on screen. */
  awayFrom(v: THREE.Vector3): number { return v.distanceTo(this.camera.position); }

  /** True once you are close enough that naming everything around you helps. */
  get near(): boolean { return this.dist < 78; }
  /** How far back the camera is sitting right now. */
  get howFar(): number { return this.dist; }

  /** Which building the camera is actually inside, and on which floor. */
  get inBuilding(): string | null { return this.host; }
  get onFloorNow(): number { return this.onFloor; }

  /** Go in through the front of a building and stop on a floor. */
  enter(buildingId: string, floor = 0) {
    const b = buildingOf(buildingId);
    if (!b) return;
    this.want.set(b.x, floorY(floor) + 1.7, b.z);
    this.wantDist = 17;
    this.wantPitch = 0.1;
  }

  /** Screen position of any point in the world, for a label that is not a place. */
  projectPoint(v: THREE.Vector3): { x: number; y: number; z: number } | null {
    const p = v.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height, z: p.z };
  }

  /** Where you would stand to go into a building. */
  doorOf(buildingId: string): THREE.Vector3 { return doorSpot(buildingId); }

  /**
   * Bring the sun up, or put it away again.
   *
   * The whole game happens between 03:12 and eight in the morning, so daylight
   * is not decoration: it is the thing that ends the night. When they come in
   * and start looking, you watch it happen in the light.
   */
  dawn(a: number) { this.wantDawn = Math.max(0, Math.min(1, a)); }

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
    // The glow is a blur to begin with, so it is built at half size: a quarter
    // of the pixels for a difference nobody can point to.
    this.bloom.setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
    this.grade.uniforms.uRes.value.set(w, h);
  }

  // ── frame ─────────────────────────────────────────────────────────────────

  render(dt: number) {
    this.renderer.info.reset();
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

    // Keep the moon over whatever is being looked at.
    this.moon.target.position.copy(this.target);
    // Enough to see the room by, and no more: this light is a torch, not a sun.
    this.hereWant = this.dist < 46 ? 26 : this.dist < 110 ? 34 : 0;
    this.here.intensity += (this.hereWant - this.here.intensity) * Math.min(1, dt * 4);
    this.here.distance = 26 + this.dist * 0.7;
    this.lamp.position.copy(this.target).add(LAMP_OFF.clone().multiplyScalar(
      Math.max(1, this.dist / 90)));
    this.lamp.distance = 320 + this.dist * 3.2;
    this.lamp.intensity = 30000 + this.dist * this.dist * 2.2;

    // Haze that belongs to the distance you are looking across. Tuned once for
    // a two-hundred-metre block, the same density erased a four-kilometre city
    // completely: from eighteen hundred metres up, Tel Aviv was a black screen
    // with correct labels floating on it.
    // How thick the haze should be for the distance being looked across. The
    // daybreak code below thins it further as the sun comes up, so this is the
    // base it works from rather than a value it can overwrite — which is what
    // it was doing, pinning the night density at the figure that was tuned for
    // a two-hundred-metre block and erasing a four-kilometre city completely.
    this.fogBase = THREE.MathUtils.clamp(0.62 / Math.max(60, this.dist), 0.00010, 0.0014);

    // And the moon's shadow box grows with the view, or a city seen from above
    // is lit by a torch pointed at one street of it.
    const box = this.moon.shadow.camera as THREE.OrthographicCamera;
    // Wide enough for the view, and no wider. Stretched over the whole country
    // the same thousand pixels of shadow map gave every wall a crawling
    // speckle, and every building in Israel was drawn a second time to fill it.
    const reach = THREE.MathUtils.clamp(this.dist * 1.15, 180, 620);
    if (Math.abs(box.right - reach) > 20) {
      box.left = -reach; box.right = reach; box.top = reach; box.bottom = -reach;
      box.far = 40 + reach * 6;
      box.updateProjectionMatrix();
    }
    // From high enough up a shadow is thinner than a pixel, so there is nothing
    // to lose by not drawing the whole city a second time to cast one. The two
    // thresholds are far apart on purpose: one line and the shadows would
    // switch on and off every time the camera breathed.
    const wantShadow = this.moon.castShadow ? this.dist < 1150 : this.dist < 900;
    if (this.moon.castShadow !== wantShadow) this.moon.castShadow = wantShadow;
    this.moon.position.copy(this.target)
      .add(MOON_OFF.clone().multiplyScalar(Math.max(1, this.dist / 140)));

    const near = World.nearFor(this.dist);
    if (Math.abs(this.camera.near - near) > near * 0.08) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    this.city.tick(this.t, dt);
    this.tlv.tick(this.t);
    this.veins.setScale(THREE.MathUtils.clamp(this.dist * 0.0055, 0.16, 1.5));
    this.veins.update(dt);
    this.swarm.setScale(THREE.MathUtils.clamp(this.dist * 0.0075, 0.28, 2.2));
    this.swarm.update(dt);
    this.figures.update(dt, this.camera.position, this.host, this.onFloor);

    // Rings and lit faces breathe, so a live board never looks like a picture.
    const pulse = 0.72 + Math.abs(Math.sin(this.t * 2.2)) * 0.28;
    const s = this.state;
    const dark = !!s && (s.marks.power_off ?? 0) > 0;
    // How far away a place stops being worth animating. Cars, waves and blinking
    // lamps are under a pixel across at that range, and there are sixty-five
    // places: keeping all of them awake was most of what the phone was drawing.
    const LIVE = 640;
    for (const m of this.markers.values()) {
      if (!m.obj.group.visible) continue;
      const near = m.obj.group.position.distanceTo(this.camera.position) < LIVE;
      if (m.obj.movers && m.obj.movers.visible !== near) m.obj.movers.visible = near;
      if (near) {
        m.busy = Math.max(0, m.busy - dt * 0.55);
        m.obj.tick(this.t, {
          mine: m.place.mine,
          off: !!s && (s.marks[`off_${m.place.id}`] ?? 0) > 0,
          dark: dark && m.place.buildingId !== 'street',
          attention: m.place.attention,
          busy: m.busy,
        });
      }
      // The ring and the red pulse keep going at any distance: they are how the
      // player finds the place they just chose, and that is usually far away.
      m.ring.rotation.z += dt * 0.9;
      const mat = m.ring.material as THREE.MeshBasicMaterial;
      if (mat.opacity > 0) mat.opacity = 0.45 + pulse * 0.5;
      if (m.place.cutAt !== undefined) {
        for (const part of m.obj.glowParts) {
          (part.material as THREE.MeshBasicMaterial).color.copy(HOT).multiplyScalar(pulse);
        }
      }
    }

    // The sun coming up, eased so it reads as time passing rather than a switch.
    this.dawnNow += (this.wantDawn - this.dawnNow) * Math.min(1, dt * 1.1);
    const d = this.dawnNow;
    if (this.hemi) {
      this.hemi.intensity = 1.45 + d * 2.5;
      this.hemi.color.setHex(0x3d5a78).lerp(new THREE.Color(0xbcd8ef), d);
      this.amb.intensity = 0.5 + d * 1.15;
      this.moon.intensity = 1.15 + d * 1.1;
      this.moon.color.setHex(0xa9c9e4).lerp(new THREE.Color(0xffe6bd), d);
      const fog = this.scene.fog as THREE.FogExp2;
      fog.density = this.fogBase * (1 - d * 0.55);
      fog.color.setHex(0x061020).lerp(new THREE.Color(0x9fb8cc), d);
      (this.scene.background as THREE.Color).setHex(0x060d1a).lerp(new THREE.Color(0x8fabc4), d);
    }
    this.grade.uniforms.uDawn.value = d;
    this.grade.uniforms.uTime.value = this.t;
    this.grade.uniforms.uGlitch.value = Math.max(0, this.grade.uniforms.uGlitch.value - dt * 1.7);
    this.keepUp();
    this.composer.render();
    // After the frame, not before it: this is what drawing it actually cost.
    this.drawn = this.renderer.info.render.calls;
    this.tris = this.renderer.info.render.triangles;
  }

  /**
   * Keep the picture as sharp as the machine can hold, and no sharper.
   *
   * Judged on the middle frame of the last two seconds rather than the worst
   * one, so a single hitch — a window opening, a place being built — does not
   * blur the game. Both thresholds sit far apart and every change is followed
   * by a quiet spell, because a picture that keeps changing its own sharpness
   * is itself a flicker.
   */
  private keepUp() {
    // Its own clock. The caller clamps its dt so the world never jumps when a
    // phone is put down and picked up again, and a clamped dt cannot tell you
    // how slow the phone actually is.
    const now = performance.now();
    const gap = now - this.lastFrame;
    this.lastFrame = now;
    if (gap <= 0 || gap > 2000) return;
    this.frames.push(gap);
    if (this.frames.length > 90) this.frames.shift();
    this.settle -= gap / 1000;
    if (this.settle > 0 || this.frames.length < 14) return;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    // A machine this far behind gets the whole cut at once rather than waiting
    // three seconds a step to catch up.
    const drop = mid > 55 ? 0.7 : 0.35;
    // Under 40 frames a second is where a phone starts to feel like a slideshow.
    if (mid > 25) this.tooSharp = Math.min(this.tooSharp, this.sharp);
    const want = mid > 25 ? this.sharp - drop : mid < 12 ? this.sharp + 0.35 : this.sharp;
    const ceiling = Math.min(this.sharpest, this.tooSharp - 0.35);
    const next = Math.max(0.6, Math.min(ceiling, Math.round(want * 20) / 20));
    if (Math.abs(next - this.sharp) < 0.01) return;
    this.sharp = next;
    this.renderer.setPixelRatio(next);
    this.resize();
    this.frames.length = 0;
    this.settle = 3;
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

    // Which floor am I standing on — not which one am I nearest. The eye sits a
    // little above the desk, and rounding sent you up a storey the whole time.
    const floor = Math.floor(this.target.y / FLOOR_H + 0.001);
    this.host = host;
    this.onFloor = floor;
    revealFloors(this.inside, host, floor, host ? 3 : 0);
  }
}

export { buildingOf };
