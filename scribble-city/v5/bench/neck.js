// A bench for the head, the neck and the gaze (dev tool, not part of the game): one or a few of the
// game's own people (render/people.js, game/doodle.js) in a plain lit scene before a fixed camera, so
// that their heads can be turned to any pose and looked at from any side in seconds.
//
// Driven from a test script (S/gta4/play4.mjs with PAGE=v5/bench/neck.html):
//   __bench.scene({ figs: [{ who: 'folk:2' | 'hero' | 'gen:3', x, z, face, look: { yaw, pitch } | null,
//                    at: [x, y, z], jaw, hold }], cam: { x, y, z, tx, ty, tz, fov } })
//     face: the body's yaw (degrees, 0 = facing +z); look: where they look, relative to the body
//     (degrees, pitch up positive) - turned into a point 3 m away that they look at (fig.lookAt);
//     at: a world point instead; jaw: the jaw open (0..1, the face held: fig.__ew)
//   __bench.view(name, dist, height): the camera round figure 0 ('front', '34', 'profile', 'behind',
//     'below', 'above'), framed on the head and neck
//   __bench.ready(): a promise, resolved when the people's pictures have come
//   __frame(n, dt): n steps of the rig, one picture
//   __bench.time(n): how long the people's own work takes a frame (rig + parts), ms
import * as THREE from 'three';
import { shared, makeSky, makeSurface } from '../js/render/materials.js';
import { Pipeline } from '../js/render/pipeline.js';
import { FigureRenderer } from '../js/game/figure.js';
import { Doodle } from '../js/game/doodle.js';
import { folkLook, heroLook, civilianLook, copLook, kidLook, elderLook } from '../js/game/looks.js';
import { DayNight } from '../js/game/daynight.js';

const params = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
document.getElementById('viewport').appendChild(renderer.domElement);
shared.uQuality.value = 1;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(22, innerWidth / innerHeight, 0.05, 3000);
camera.rotation.order = 'YXZ';
const pipe = new Pipeline(renderer, scene, camera, { low: false });
pipe.scale = 1;
pipe.defaultScale = 1;
pipe.minScale = 1;
pipe.maxScale = 1;
pipe.reflections = false;
pipe.setPens(false);
shared.uPR.value = pipe.pixelsPerCss;
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), makeSky());
sky.frustumCulled = false;
sky.renderOrder = 100;
scene.add(sky);
// the ground: a plain paper floor
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), makeSurface({ kind: 'ground', color: new THREE.Color(0.86, 0.84, 0.8) }));
ground.userData.noShadow = false;
scene.add(ground);
const game = { params: new URLSearchParams(`test=1&hour=${params.get('hour') || 15.5}`), pipe, world: null, weather: null };
const day = new DayNight(game);
day.update(0);
const fr = new FigureRenderer(scene);
fr.bodies.lodFar = 55;
fr.bodies.setRenderer(renderer);

// ------------------------------------------------------------------ the people
const made = new Map();
function figOf(who) {
  if (made.has(who)) return made.get(who);
  const [kind, arg] = who.split(':');
  const n = +arg || 0;
  let L;
  if (kind === 'folk') L = folkLook(n);
  else if (kind === 'hero') L = heroLook();
  else if (kind === 'cop') L = copLook();
  else if (kind === 'kid') L = kidLook(n % 2 === 0);
  else if (kind === 'elder') L = elderLook(n % 2 === 0);
  else {
    // (a generic person, the same each time for the same number)
    const r = Math.random;
    let s = 1234 + n * 977;
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    L = civilianLook({ fem: n % 2 === 1 });
    Math.random = r;
  }
  const f = new Doodle(fr, L, { seed: 3 + n });
  f.indoor = false;
  made.set(who, f);
  return f;
}

let figs = [];
const _t = new THREE.Vector3();
function setScene(cfg) {
  for (const f of made.values()) f.setVisible(false);
  figs = [];
  for (const o of cfg.figs || []) {
    const f = figOf(o.who);
    f.setVisible(true);
    f.pos.set(o.x || 0, o.y || 0, o.z || 0);
    f.yaw = ((o.face || 0) * Math.PI) / 180;
    f.speed = o.speed || 0;
    f.hunch = o.hunch || 0;
    f.sneak = o.sneak || 0;
    f.__ew = o.jaw !== undefined ? [o.jaw, 0, 0, 0, 0, 0, 0, 0] : null;
    f.__bench = o;
    if (!f._at) f._at = new THREE.Vector3();
    figs.push(f);
  }
  if (cfg.cam) {
    const c = cfg.cam;
    camera.position.set(c.x, c.y, c.z);
    camera.lookAt(c.tx, c.ty, c.tz);
    camera.fov = c.fov || 22;
    camera.updateProjectionMatrix();
  }
  return figs.length;
}

// the look of each this step: a point 3 m off in the direction asked (relative to the body), from the
// height of the head at rest
function aim(f) {
  const o = f.__bench;
  if (o.at) {
    f.lookAt = f._at.set(o.at[0], o.at[1], o.at[2]);
    return;
  }
  if (!o.look) {
    f.lookAt = null;
    return;
  }
  const y = f.yaw + (o.look.yaw * Math.PI) / 180;
  const p = (o.look.pitch * Math.PI) / 180;
  const hy = f.pos.y + 1.62 * f.scale;
  f.lookAt = f._at.set(f.pos.x + Math.sin(y) * Math.cos(p) * 3, hy + Math.sin(p) * 3, f.pos.z + Math.cos(y) * Math.cos(p) * 3);
}

function view(name, dist = 1.15, height = 0, side = 1) {
  const f = figs[0];
  if (!f) return;
  f.ensureShapes();
  const yaw = f.yaw;
  const A = side * ({ front: 0, 34: 0.75, profile: 1.5708, behind: Math.PI, back34: 2.4, below: 0.5, above: 0.6, belowside: 1.2 }[name] ?? 0);
  const el = name === 'below' || name === 'belowside' ? -0.55 : name === 'above' ? 0.45 : 0.04 + height;
  // (framed on the neck's base and up: the same whatever the head does)
  const ty = f.j.neck.y + 0.15 * f.scale;
  const cx = f.pos.x + Math.sin(yaw + A) * Math.cos(el) * dist;
  const cz = f.pos.z + Math.cos(yaw + A) * Math.cos(el) * dist;
  camera.position.set(cx, ty + Math.sin(el) * dist, cz);
  camera.lookAt(f.pos.x, ty, f.pos.z);
  camera.fov = 22;
  camera.updateProjectionMatrix();
}

let tWork = 0;
function step(dt) {
  for (const f of figs) {
    aim(f);
    f.update(dt);
  }
}
function render() {
  const t0 = performance.now();
  fr.begin(camera);
  for (const f of figs) f.draw(camera.position);
  fr.end();
  tWork = performance.now() - t0;
  const c = camera.position;
  pipe.render(_t.set(c.x, 0, c.z));
  pipe.syncGpu && pipe.syncGpu();
  renderer.setRenderTarget(null);
}

let gameT = 0;
window.__frame = (n = 1, dt = 1 / 30) => {
  for (let i = 0; i < n; i++) {
    gameT += dt;
    shared.uTime.value = gameT;
    step(dt);
  }
  render();
  return true;
};

window.__bench = {
  scene: setScene,
  view,
  figs: () => figs,
  label: (t) => {
    document.getElementById('label').textContent = t;
  },
  // (the people's pictures in, for those in the scene)
  async ready(max = 400) {
    const A = fr.bodies.atlas;
    const all = () => figs.every((f) => f.look.folk === undefined || A.got[f.look.folk] >= 5);
    if (all()) return 0;
    for (let i = 0; i < max; i++) {
      window.__frame(1, 1 / 30);
      if (all() && i > 4) return i;
      await new Promise((r) => setTimeout(r, 50));
    }
    return -1;
  },
  // (ms the people's own work takes a frame: the rig's steps and their parts put down)
  time(n = 30) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      step(1 / 60);
      for (const f of figs) f.ensureShapes();
      a += performance.now() - t0;
      fr.begin(camera);
      const t1 = performance.now();
      for (const f of figs) f.draw(camera.position);
      b += performance.now() - t1;
      fr.end();
    }
    return { rig: +(a / n).toFixed(3), draw: +(b / n).toFixed(3), figs: figs.length };
  },
  // the head's frame and the neck's top, as the rig has them (for checks)
  head(i = 0) {
    const f = figs[i];
    f.ensureShapes();
    const r = (v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
    return { headC: r(f.j.headC), neck: r(f.j.neck), hu: r(f.hu), hf: r(f.hf), lookYaw: f.lookYaw, lookPitch: f.lookPitch, chestYaw: f.chestYaw, eye: f.eyeYaw };
  },
};
window.__frame(1);
window.__ready = true;
