import './style.css';
import * as THREE from 'three';
import { GAME_CONFIG } from './core/config';

type Limb = 'leftHand' | 'rightHand';
type PartName = 'head' | 'chest' | 'hips' | 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot';
type Part = { name: PartName; pos: THREE.Vector3; vel: THREE.Vector3; mesh: THREE.Mesh; radius: number };
type Puppet = { id: string; color: string; parts: Record<PartName, Part>; stamina: number; slack: number; activeLimb: Limb; cross: THREE.Vector3; aiTimer: number; aiPhase: number; isAI: boolean };

type InputFrame = { target: THREE.Vector3; held: boolean; activeLimb: Limb; release: THREE.Vector3 };

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('Missing #app root element');
const app = appRoot;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17110c);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 3.2, 7.5);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
app.innerHTML = '';
app.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffe7c2, 0x3b2413, 2.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(4, 7, 5);
scene.add(sun);

const arena = new THREE.Mesh(
  new THREE.CylinderGeometry(GAME_CONFIG.arenaRadius, GAME_CONFIG.arenaRadius, 0.14, 96),
  new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }),
);
arena.position.y = -0.08;
scene.add(arena);
const ring = new THREE.Mesh(new THREE.TorusGeometry(GAME_CONFIG.arenaRadius, 0.045, 8, 128), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.02;
scene.add(ring);

const wireGroup = new THREE.Group();
scene.add(wireGroup);

const hud = document.createElement('div');
hud.className = 'hud';
hud.innerHTML = `
  <div class="title">PUPPET BRAWL</div>
  <div class="topright">
    <button id="left">Left Wire (Q / 1)</button>
    <button id="right">Right Wire (E / 2)</button>
    <div class="hint">Drag to steer. Hold, aim, release to punch.</div>
  </div>
  <div class="panel">
    <b>Playable physics puppet duel</b>
    <div>Player stamina</div><div class="bar"><div id="pbar" class="fill"></div></div>
    <div>AI stamina</div><div class="bar"><div id="ebar" class="fill"></div></div>
    <small>Push the blue puppet out of the ring. No instant AI wins.</small>
  </div>
  <div class="prompt">Drag slowly to walk. Hold and release for a snap strike.</div>`;
document.body.appendChild(hud);
const pbar = hud.querySelector<HTMLDivElement>('#pbar')!;
const ebar = hud.querySelector<HTMLDivElement>('#ebar')!;
const prompt = hud.querySelector<HTMLDivElement>('.prompt')!;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0.1);
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.25);
let pointerDown = false;
let selected: Limb = 'rightHand';
let previousTarget = new THREE.Vector3();
let releaseVelocity = new THREE.Vector3();
let hasPointer = false;

hud.querySelector<HTMLButtonElement>('#left')!.onclick = () => (selected = 'leftHand');
hud.querySelector<HTMLButtonElement>('#right')!.onclick = () => (selected = 'rightHand');
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'q' || event.key === '1') selected = 'leftHand';
  if (event.key.toLowerCase() === 'e' || event.key === '2') selected = 'rightHand';
});
renderer.domElement.addEventListener('pointermove', setPointer);
renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = true;
  setPointer(event);
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointerup', (event) => {
  pointerDown = false;
  renderer.domElement.releasePointerCapture(event.pointerId);
});

function setPointer(event: PointerEvent) {
  hasPointer = true;
  pointer.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
}

function makeMesh(name: PartName, color: string) {
  const sizes: Record<PartName, [number, number, number]> = {
    head: [0.38, 0.38, 0.34], chest: [0.62, 0.68, 0.34], hips: [0.54, 0.36, 0.3],
    leftHand: [0.22, 0.22, 0.22], rightHand: [0.22, 0.22, 0.22], leftFoot: [0.22, 0.22, 0.28], rightFoot: [0.22, 0.22, 0.28],
  };
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...sizes[name]), new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
  scene.add(mesh);
  return mesh;
}

function makePuppet(id: string, x: number, color: string, isAI: boolean): Puppet {
  const coords: Record<PartName, THREE.Vector3> = {
    head: new THREE.Vector3(x, 2.18, 0), chest: new THREE.Vector3(x, 1.62, 0), hips: new THREE.Vector3(x, 1.08, 0),
    leftHand: new THREE.Vector3(x - 0.74, 1.18, 0), rightHand: new THREE.Vector3(x + 0.74, 1.18, 0),
    leftFoot: new THREE.Vector3(x - 0.22, 0.32, 0), rightFoot: new THREE.Vector3(x + 0.22, 0.32, 0),
  };
  const parts = Object.fromEntries(Object.entries(coords).map(([name, pos]) => [name, { name: name as PartName, pos, vel: new THREE.Vector3(), mesh: makeMesh(name as PartName, color), radius: name.includes('Hand') ? 0.18 : 0.28 }])) as unknown as Record<PartName, Part>;
  return { id, color, parts, stamina: 100, slack: 0, activeLimb: 'rightHand', cross: new THREE.Vector3(x, 2.9, 0), aiTimer: 0, aiPhase: 0, isAI };
}

const player = makePuppet('Player', -1.35, '#d9904a', false);
const enemy = makePuppet('AI', 1.35, '#6db4ff', true);
let elapsed = 0;
let resultShown = false;

function projectedTarget(base: THREE.Vector3, dt: number): InputFrame {
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  if (!hasPointer) hit.copy(base).add(new THREE.Vector3(0, 0.15, 0));
  hit.x = THREE.MathUtils.clamp(hit.x, -4.3, 4.3);
  hit.z = THREE.MathUtils.clamp(hit.z, -2.2, 2.2);
  if (pointerDown) releaseVelocity.copy(hit).sub(previousTarget).multiplyScalar(1 / Math.max(dt, 0.001)).clampLength(0, 4.5);
  previousTarget.copy(hit);
  return { target: hit, held: pointerDown, activeLimb: selected, release: pointerDown ? new THREE.Vector3() : releaseVelocity.clone() };
}

function aiInput(puppet: Puppet, target: Puppet, dt: number): InputFrame {
  puppet.aiTimer += dt;
  const dir = target.parts.chest.pos.clone().sub(puppet.parts.chest.pos).normalize();
  const passive = elapsed < 5;
  const held = !passive && Math.sin(puppet.aiTimer * 2.1) > 0.55;
  const aim = target.parts.chest.pos.clone().add(new THREE.Vector3(-0.25, held ? 0.15 : 0.55, 0));
  const release = !held && Math.sin(puppet.aiTimer * 2.1) < -0.86 ? dir.multiplyScalar(1.2) : new THREE.Vector3();
  return { target: aim, held, activeLimb: puppet.aiTimer % 4 > 2 ? 'leftHand' : 'rightHand', release };
}

function spring(a: Part, b: Part, rest: number, strength: number) {
  const delta = b.pos.clone().sub(a.pos);
  const len = Math.max(0.001, delta.length());
  const force = delta.multiplyScalar((len - rest) * strength);
  a.vel.add(force);
  b.vel.sub(force);
}

function pull(part: Part, target: THREE.Vector3, strength: number, damping = 0.88) {
  part.vel.add(target.clone().sub(part.pos).multiplyScalar(strength));
  part.vel.multiplyScalar(damping);
}

function updatePuppet(puppet: Puppet, input: InputFrame, dt: number, facing: 1 | -1) {
  puppet.activeLimb = input.activeLimb;
  puppet.cross.lerp(input.target.clone().add(new THREE.Vector3(0, 1.55, 0)), 0.13);
  puppet.stamina = THREE.MathUtils.clamp(puppet.stamina + (input.held ? -18 : 16) * dt, 0, 100);

  const p = puppet.parts;
  pull(p.chest, puppet.cross.clone().add(new THREE.Vector3(-0.12 * facing, -1.18, 0)), 0.045);
  pull(p.hips, puppet.cross.clone().add(new THREE.Vector3(0.1 * facing, -1.7, 0)), 0.038);
  pull(p.head, puppet.cross.clone().add(new THREE.Vector3(0, -0.58, 0)), 0.025);

  const relaxedLeft = p.chest.pos.clone().add(new THREE.Vector3(-0.72, -0.38, 0));
  const relaxedRight = p.chest.pos.clone().add(new THREE.Vector3(0.72, -0.38, 0));
  pull(p.leftHand, input.held && input.activeLimb === 'leftHand' ? input.target : relaxedLeft, input.held ? 0.08 : 0.035);
  pull(p.rightHand, input.held && input.activeLimb === 'rightHand' ? input.target : relaxedRight, input.held ? 0.08 : 0.035);

  if (input.release.lengthSq() > 0.04 && puppet.stamina > 8) {
    p[input.activeLimb].vel.add(input.release.clone().multiplyScalar(0.95));
  }

  pull(p.leftFoot, p.hips.pos.clone().add(new THREE.Vector3(-0.24, -0.82, 0.08)), 0.032);
  pull(p.rightFoot, p.hips.pos.clone().add(new THREE.Vector3(0.24, -0.82, -0.08)), 0.032);

  spring(p.head, p.chest, 0.58, 0.028); spring(p.chest, p.hips, 0.58, 0.035);
  spring(p.chest, p.leftHand, 0.92, 0.018); spring(p.chest, p.rightHand, 0.92, 0.018);
  spring(p.hips, p.leftFoot, 0.95, 0.024); spring(p.hips, p.rightFoot, 0.95, 0.024);

  for (const part of Object.values(p)) {
    part.vel.y -= 1.2 * dt;
    part.vel.clampLength(0, 0.16);
    part.pos.add(part.vel);
    if (part.pos.y < part.radius) { part.pos.y = part.radius; part.vel.y = Math.abs(part.vel.y) * 0.18; part.vel.multiplyScalar(0.82); }
    part.mesh.position.copy(part.pos);
    part.mesh.rotation.z = THREE.MathUtils.lerp(part.mesh.rotation.z, (part.vel.x * -2.2), 0.08);
  }
}

function collide(a: Puppet, b: Puppet) {
  for (const handName of ['leftHand', 'rightHand'] as Limb[]) {
    const hand = a.parts[handName];
    for (const partName of ['head', 'chest', 'hips'] as PartName[]) {
      const target = b.parts[partName];
      const delta = target.pos.clone().sub(hand.pos);
      const dist = delta.length();
      if (dist < 0.48) {
        const push = delta.normalize().multiplyScalar((0.48 - dist) * 0.065 + hand.vel.length() * 0.028);
        target.vel.add(push);
        hand.vel.sub(push.multiplyScalar(0.45));
      }
    }
  }
}

function drawWire(a: THREE.Vector3, b: THREE.Vector3, color: number) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 }));
  wireGroup.add(line);
}

function checkWin() {
  if (elapsed < 6 || resultShown) return;
  for (const p of [player, enemy]) {
    const c = p.parts.chest.pos;
    if (Math.hypot(c.x, c.z) > GAME_CONFIG.arenaRadius + 0.35) showResult(p === player ? enemy : player, 'Ring-Out');
  }
}

function showResult(winner: Puppet, reason: string) {
  resultShown = true;
  const result = document.createElement('div');
  result.className = 'result';
  result.innerHTML = `<div class="card"><h1>${winner.id} wins!</h1><p>${reason}</p><button onclick="location.reload()">Fight again</button></div>`;
  document.body.appendChild(result);
}

let last = performance.now();
function animate(now = performance.now()) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  elapsed += dt;
  const playerInput = projectedTarget(player.parts.chest.pos, dt);
  const enemyInput = aiInput(enemy, player, dt);
  updatePuppet(player, playerInput, dt, 1);
  updatePuppet(enemy, enemyInput, dt, -1);
  collide(player, enemy); collide(enemy, player); checkWin();

  wireGroup.clear();
  drawWire(player.cross, player.parts.chest.pos, 0xffffff); drawWire(player.cross, player.parts[player.activeLimb].pos, playerInput.held ? 0xffd166 : 0x777777);
  drawWire(enemy.cross, enemy.parts.chest.pos, 0xffffff); drawWire(enemy.cross, enemy.parts[enemy.activeLimb].pos, enemyInput.held ? 0xffd166 : 0x777777);
  pbar.style.width = `${player.stamina}%`; ebar.style.width = `${enemy.stamina}%`;
  prompt.textContent = elapsed < 5 ? 'Opening grace period: learn the controls. Drag, hold, release.' : 'Push the AI out of the ring. Hold/release to punch.';

  const center = player.parts.chest.pos.clone().add(enemy.parts.chest.pos).multiplyScalar(0.5);
  camera.position.lerp(new THREE.Vector3(center.x, 3.2, 7.5), 0.035);
  camera.lookAt(center.x, 1.2, center.z);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
requestAnimationFrame(animate);
