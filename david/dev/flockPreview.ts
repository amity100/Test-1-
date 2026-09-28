// Dev-only preview harness for src/characters/Flock.ts (not part of the build).
// Open /dev/flock.html?view=sheep|goat|ram|lamb|flock|walk|trot|canter|mouth|shoulders|graze&t=3
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Flock, Animal } from '../src/characters/Flock';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'flock';
const simT = parseFloat(params.get('t') ?? '4');
const live = params.has('live');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 800);

// ---- sky + env
const skyGeo = new THREE.SphereGeometry(400, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: { sunDir: { value: new THREE.Vector3() } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
  void main(){
    float h = vDir.y;
    vec3 zen = vec3(0.22,0.36,0.62);
    vec3 hor = vec3(1.0,0.66,0.38);
    vec3 c = mix(hor, zen, pow(clamp(h,0.0,1.0),0.55));
    c = mix(c, vec3(0.45,0.36,0.28), smoothstep(0.0,-0.2,h));
    float s = max(dot(normalize(vDir), normalize(sunDir)),0.0);
    c += vec3(1.0,0.6,0.3) * pow(s, 8.0) * 0.5 + vec3(1.0,0.85,0.6) * pow(s, 900.0) * 12.0;
    gl_FragColor = vec4(c*0.75,1.0);
  }`,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

const sunDir = new THREE.Vector3(-0.75, 0.24, -0.55).normalize();
if (params.get('sun') !== 'back') sunDir.set(0.55, 0.32, 0.75).normalize();
skyMat.uniforms.sunDir.value.copy(sunDir);

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(skyGeo, skyMat));
scene.environment = pmrem.fromScene(envScene, 0.04).texture;
scene.environmentIntensity = 0.55;

const sun = new THREE.DirectionalLight(0xffcf94, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xa9c2e8, 0x7a5d3a, 0.9);
scene.add(hemi);
scene.fog = new THREE.Fog(0xd9a877, 60, 320);

// ---- ground
const ground = (x: number, z: number) =>
  0.35 * Math.sin(x * 0.09) * Math.cos(z * 0.11) + 0.12 * Math.sin(x * 0.31 + z * 0.23) + 0.05 * Math.cos(x * 0.8 - z * 0.6);

function grassTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9c8a55';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const t = Math.random();
    const col = t < 0.3 ? '#6f6a38' : t < 0.6 ? '#b8a266' : t < 0.8 ? '#8a7a45' : '#c9b27a';
    g.strokeStyle = col;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 7);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
const gGeo = new THREE.PlaneGeometry(300, 300, 300, 300);
gGeo.rotateX(-Math.PI / 2);
const gp = gGeo.attributes.position as THREE.BufferAttribute;
for (let i = 0; i < gp.count; i++) gp.setY(i, ground(gp.getX(i), gp.getZ(i)));
gGeo.computeVertexNormals();
const gMesh = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, color: 0xd8c8a0 }));
gMesh.receiveShadow = true;
scene.add(gMesh);

// ---- flock
const cfg: { sheep?: number; rams?: number; goats?: number } = {};
const walkable = view === 'walktest' ? (x: number, z: number) => z < 6 && !(Math.abs(x - 4) < 2 && Math.abs(z + 2) < 2) : undefined;
const tBuild = performance.now();
const flock = new Flock({ ground, pastureCenter: new THREE.Vector3(0, 0, 0), pastureRadius: 18, seed: 7, walkable, ...cfg });
scene.add(flock.group);
console.log('BUILD ms ' + (performance.now() - tBuild).toFixed(0));
const sounds: string[] = [];
flock.onSound = (k, p, v) => sounds.push(`${k}@${p.x.toFixed(1)},${p.z.toFixed(1)} v${v.toFixed(2)}`);

const shepherd = new THREE.Vector3(8, 0, 8);
const threats: THREE.Vector3[] = [];

function isolate(subject: Animal, x = 0, z = 0, heading = 0.6) {
  let i = 0;
  for (const a of flock.animals) {
    if (a === subject) continue;
    a.aiEnabled = false;
    a.manualSpeed = 0;
    a.position.set(60 + (i % 6) * 3, 0, 60 + Math.floor(i / 6) * 3);
    i++;
  }
  subject.aiEnabled = false;
  subject.position.set(x, ground(x, z), z);
  subject.heading = heading;
}
const pick = (k: string) => flock.animals.find((a) => a.kind === k)!;

let subject: Animal | null = null;
let carrier: THREE.Object3D | null = null;
const camTarget = new THREE.Vector3();
const setCam = (px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov = 35) => {
  camera.position.set(px, py, pz);
  camTarget.set(tx, ty, tz);
  camera.fov = fov;
  camera.updateProjectionMatrix();
};

switch (view) {
  case 'sheep':
  case 'goat':
  case 'ram':
  case 'lamb': {
    subject = view === 'sheep' ? flock.animals[1] : pick(view);
    isolate(subject, 0, 0, parseFloat(params.get('h') ?? '-0.1'));
    subject.state = (params.get('state') as 'graze') ?? 'walk';
    if (params.get('state') === 'graze') subject.graze = 1;
    else subject.graze = 0;
    const y = ground(0, 0);
    const d = view === 'lamb' ? 1.6 : 2.6;
    const h = view === 'lamb' ? 0.5 : 0.8;
    setCam(d * 0.95, y + h, d * 0.55, 0, y + h * 0.75, 0.05, 35);
    break;
  }
  case 'lambface': {
    subject = pick('lamb');
    isolate(subject, 0, 0, 0.2);
    subject.state = 'walk';
    subject.graze = 0;
    const y = ground(0, 0);
    setCam(0.35, y + 0.52, 0.95, 0, y + 0.45, 0.2, 30);
    break;
  }
  case 'walk':
  case 'trot':
  case 'canter': {
    subject = flock.animals[0];
    isolate(subject, 0, -2, Math.PI / 2);
    subject.state = view === 'canter' ? 'flee' : 'walk';
    subject.graze = 0;
    subject.manualSpeed = view === 'walk' ? 0.7 : view === 'trot' ? 1.9 : 4.2;
    const y = ground(0, 0);
    setCam(1.0, y + 0.7, 3.6, 1.0, y + 0.5, 0, 35);
    break;
  }
  case 'goatwalk': {
    subject = pick('goat');
    isolate(subject, 0, -2, Math.PI / 2);
    subject.state = 'walk';
    subject.graze = 0;
    subject.manualSpeed = 0.8;
    const y = ground(0, 0);
    setCam(1.0, y + 0.8, 3.6, 1.0, y + 0.55, 0, 35);
    break;
  }
  case 'mouth':
  case 'shoulders': {
    subject = flock.lamb;
    isolate(subject, 0, 0, 0);
    carrier = new THREE.Group();
    const y = ground(0, 0);
    carrier.position.set(0, y + (view === 'mouth' ? 0.9 : 1.55), 0);
    scene.add(carrier);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.85 });
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x9c8664, roughness: 0.95 });
    if (view === 'shoulders') {
      // a stand-in shepherd so the pose reads
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 6, 16), robeMat);
      torso.position.set(0, y + 1.05, 0);
      const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 6, 12), robeMat);
      sh.rotation.z = Math.PI / 2;
      sh.position.set(0, y + 1.4, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), skinMat);
      head.position.set(0, y + 1.62, 0.02);
      for (const m of [torso, sh, head]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
    } else {
      // a stand-in jaw
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a2618 }));
      jaw.position.copy(carrier.position);
      scene.add(jaw);
    }
    flock.update(1 / 30, 0, { shepherd, threats });
    carrier.attach(subject.object);
    subject.setCarried(view as 'mouth');
    subject.object.position.set(0, 0, 0);
    subject.object.quaternion.identity();
    if (view === 'mouth') {
      // align backGrip with the carrier origin
      const gp2 = subject.backGrip.position.clone().add(subject.bones[0].position);
      subject.object.position.copy(gp2).multiplyScalar(-1);
    } else {
      // lamb's spine along the shepherd's shoulders, belly on the nape, legs down his chest
      scene.attach(subject.object);
      const Z = new THREE.Vector3(1, 0, 0);
      const Y = new THREE.Vector3(0, 0.45, -0.89).normalize();
      const X = new THREE.Vector3().crossVectors(Y, Z);
      subject.object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      subject.object.position.set(0, y + 1.53, -0.17).addScaledVector(Y, -0.335).addScaledVector(Z, -0.03);
    }
    const yy = carrier.position.y;
    if (view === 'mouth') setCam(1.3, yy + 0.1, 1.2, 0, yy - 0.3, 0, 38);
    else setCam(0.9, y + 1.55, 1.9, 0, y + 1.35, 0, 38);
    break;
  }
  case 'hop': {
    subject = flock.lamb;
    isolate(subject, 0, 0, 1.2);
    subject.aiEnabled = true;
    subject.state = 'graze';
    subject['hopCool'] = 0;
    const y = ground(0, 0);
    setCam(0.4, y + 0.45, 2.2, 0.3, y + 0.35, 0.3, 35);
    break;
  }
  case 'drop': {
    // carried in the mouth, then released 0.9 m above the ground
    subject = flock.lamb;
    isolate(subject, 0, 0, 0.5);
    subject.aiEnabled = true;
    const y = ground(0, 0);
    const holder = new THREE.Group();
    holder.position.set(0.3, y + 0.9, 0.2);
    holder.rotation.set(0.3, 1.0, 0.2);
    scene.add(holder);
    flock.update(1 / 30, 0, { shepherd, threats });
    holder.attach(subject.object);
    subject.setCarried('mouth');
    subject.object.position.set(0, -0.4, 0);
    let tt = 0;
    for (let i = 0; i < 20; i++) { tt += 1 / 30; flock.update(1 / 30, tt, { shepherd, threats }); }
    flock.group.attach(subject.object);
    subject.setCarried('none');
    const log: string[] = [];
    log.push(`released: state ${subject.state} pos ${subject.position.x.toFixed(2)},${subject.position.y.toFixed(2)},${subject.position.z.toFixed(2)} heading ${subject.heading.toFixed(2)} objY ${subject.object.position.y.toFixed(2)} ground ${y.toFixed(2)}`);
    for (let i = 0; i < 45; i++) { tt += 1 / 30; flock.update(1 / 30, tt, { shepherd, threats }); if (i % 9 === 0) log.push(`t+${(i / 30).toFixed(2)} objY ${subject.object.position.y.toFixed(3)} ground ${ground(subject.position.x, subject.position.z).toFixed(3)} state ${subject.state}`); }
    console.log('AITEST\n' + log.join('\n'));
    setCam(1.6, y + 0.6, 1.6, 0, y + 0.3, 0, 38);
    break;
  }
  case 'flee': {
    threats.push(new THREE.Vector3(-6, 0, -6));
    setCam(22, 9, 22, 2, 0, 2, 45);
    break;
  }
  case 'aitest': {
    // headless-ish behaviour test: logs stats, renders the end state
    const log: string[] = [];
    const stats = (label: string) => {
      const st: Record<string, number> = {};
      let minD = 99, maxP = 0;
      const A = flock.animals;
      for (const a of A) {
        st[a.state] = (st[a.state] ?? 0) + 1;
        maxP = Math.max(maxP, Math.hypot(a.position.x - flock.pastureCenter.x, a.position.z - flock.pastureCenter.z));
      }
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) minD = Math.min(minD, Math.hypot(A[i].position.x - A[j].position.x, A[i].position.z - A[j].position.z));
      const dS = A.map((a) => Math.hypot(a.position.x - shepherd.x, a.position.z - shepherd.z));
      log.push(`${label}: ${JSON.stringify(st)} minPair ${minD.toFixed(2)} maxFromPasture ${maxP.toFixed(1)} shepherdDist min ${Math.min(...dS).toFixed(1)} med ${dS.sort((a, b) => a - b)[13].toFixed(1)} lambMother ${flock.lamb['mother'] ? flock.lamb.position.distanceTo(flock.lamb['mother'].position).toFixed(1) : '-'}`);
    };
    let tt = 0;
    const run = (sec: number, ctx: { shepherd: THREE.Vector3; threats: THREE.Vector3[] }) => {
      for (let i = 0; i < sec * 30; i++) { tt += 1 / 30; flock.update(1 / 30, tt, ctx); }
    };
    run(30, { shepherd, threats: [] }); stats('graze30s');
    run(30, { shepherd, threats: [] }); stats('graze60s');
    shepherd.set(25, 0, 5);
    log.push('call responders ' + flock.call(shepherd));
    run(3, { shepherd, threats: [] }); stats('call+3s');
    run(9, { shepherd, threats: [] }); stats('call+12s');
    run(6, { shepherd, threats: [] }); stats('call+18s');
    // bear approaches from the west
    const bear = new THREE.Vector3(flock.centroid.x - 30, 0, flock.centroid.z);
    for (let i = 0; i < 20 * 30; i++) {
      tt += 1 / 30;
      bear.x += 1.6 / 30 * 1.0;
      flock.update(1 / 30, tt, { shepherd, threats: [bear] });
      if (i % 90 === 0) stats('bear@' + bear.x.toFixed(0));
    }
    run(20, { shepherd, threats: [] }); stats('after bear 20s');
    flock.setPasture(new THREE.Vector3(10, 0, -10), 15);
    run(40, { shepherd, threats: [] }); stats('newPasture40s');
    log.push('countNear pasture ' + flock.countNear(new THREE.Vector3(10, 0, -10), 15));
    console.log('AITEST\n' + log.join('\n'));
    setCam(35, 22, 35, 5, 0, -5, 45);
    break;
  }
  case 'walktest': {
    const log: string[] = [];
    let tt = 0;
    const bad = () => flock.animals.filter((a) => walkable && !walkable(a.position.x, a.position.z)).length;
    for (let i = 0; i < 30 * 30; i++) { tt += 1 / 30; flock.update(1 / 30, tt, { shepherd, threats: [] }); }
    log.push('after 30s outside walkable: ' + bad());
    shepherd.set(0, 0, 14);
    flock.call(shepherd);
    let worst = 0;
    for (let i = 0; i < 20 * 30; i++) { tt += 1 / 30; flock.update(1 / 30, tt, { shepherd, threats: [] }); worst = Math.max(worst, bad()); }
    log.push('call from across the barrier: max outside ' + worst + ' maxZ ' + Math.max(...flock.animals.map((a) => a.position.z)).toFixed(2));
    flock.panic(new THREE.Vector3(0, 0, -20));
    for (let i = 0; i < 10 * 30; i++) { tt += 1 / 30; flock.update(1 / 30, tt, { shepherd, threats: [] }); worst = Math.max(worst, bad()); }
    log.push('panic toward barrier: max outside ' + worst + ' maxZ ' + Math.max(...flock.animals.map((a) => a.position.z)).toFixed(2));
    console.log('AITEST\n' + log.join('\n'));
    setCam(20, 25, 30, 0, 0, 0, 45);
    break;
  }
  case 'flock':
  default: {
    setCam(15, 5.5, 17, 0, 0.3, 0, 40);
    break;
  }
}

// generic orbit camera: cam=azimuthDeg,elevationDeg,distance,targetY,targetZ
if (params.get('cam')) {
  const [az, el, d, ty, tz] = params.get('cam')!.split(',').map(Number);
  const y = ground(0, 0);
  const tgt = new THREE.Vector3(0, y + (ty || 0.5), tz || 0);
  const A = (az * Math.PI) / 180, E = (el * Math.PI) / 180;
  setCam(tgt.x + Math.sin(A) * Math.cos(E) * d, tgt.y + Math.sin(E) * d, tgt.z + Math.cos(A) * Math.cos(E) * d, tgt.x, tgt.y, tgt.z, parseFloat(params.get('fov') ?? '35'));
}
// shadow camera around target
function fitShadow() {
  const ext = subject ? 3 : 24;
  sun.position.copy(camTarget).addScaledVector(sunDir, 40);
  sun.target.position.copy(camTarget);
  const sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 100;
  sc.updateProjectionMatrix();
}
fitShadow();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(camTarget);
controls.update();

// simulate
const dt = 1 / 30;
let t = 0;
const steps = Math.round(simT / dt);
const t0 = performance.now();
for (let i = 0; i < steps; i++) {
  t += dt;
  if (view === 'flee' && i === Math.floor(steps * 0.4)) flock.panic(new THREE.Vector3(-6, 0, -6));
  flock.update(dt, t, { shepherd, threats, camera });
}
if (subject && params.has('bleat')) {
  subject.bleat(1);
  for (let i = 0; i < 9; i++) { t += dt; flock.update(dt, t, { shepherd, threats, camera }); }
}
const simMs = performance.now() - t0;
if (subject && (view === 'walk' || view === 'trot' || view === 'canter' || view === 'goatwalk')) {
  const d = camera.position.clone().sub(camTarget);
  camTarget.set(subject.position.x, subject.position.y + 0.45, subject.position.z);
  camera.position.copy(camTarget).add(d);
  controls.target.copy(camTarget);
  fitShadow();
}

let info = `${view} | animals ${flock.animals.length} | sim ${simMs.toFixed(0)}ms | sounds ${sounds.length}`;
if (subject) info += ` | state ${subject.state} speed ${subject['speed'].toFixed(2)}`;
(document.getElementById('info') as HTMLElement).textContent = params.has('hud') ? info : '';
console.log(info);
{
  const seen = new Set<THREE.BufferGeometry>();
  const rows: string[] = [];
  for (const a of flock.animals) for (const m of a['meshes'] as THREE.Mesh[]) {
    if (seen.has(m.geometry)) continue;
    seen.add(m.geometry);
    rows.push(`${m.name}: tris ${(m.geometry.index!.count / 3) | 0} verts ${m.geometry.attributes.position.count}`);
  }
  console.log('GEOM ' + rows.join(' | '));
}
console.log(sounds.slice(-5).join('\n'));

function frame() {
  if (live) {
    t += dt;
    flock.update(dt, t, { shepherd, threats, camera });
  }
  controls.update();
  renderer.render(scene, camera);
  if (live) requestAnimationFrame(frame);
}
frame();
renderer.render(scene, camera);
(window as unknown as { __ready: boolean; __info: string }).__ready = true;
(window as unknown as { __info: string }).__info = info + ' | calls ' + renderer.info.render.calls + ' tris ' + renderer.info.render.triangles;
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.render(scene, camera);
});
