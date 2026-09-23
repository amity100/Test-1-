/**
 * Visual check for the retargeted animation library.
 * `npx vite --port 4320` then open /tools/anim-preview.html?mode=clips&look=rifleman&u=0.5&az=35
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Character, CLIP_NAMES, loadAnimLibrary, parseCharacterAsset, type AnimLibrary, type CharacterPoseExt, type Look } from '../src/game/characters';
import type { ClipName, DeathKind } from '../src/core/contracts';

const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'clips';
const U = parseFloat(q.get('u') ?? '0.5');
const AZ = THREE.MathUtils.degToRad(parseFloat(q.get('az') ?? '35'));
const EL = THREE.MathUtils.degToRad(parseFloat(q.get('el') ?? '8'));
const ZOOM = parseFloat(q.get('zoom') ?? '1');
const LOOK = (q.get('look') ?? 'rifleman') as Look;
const COLS = parseInt(q.get('cols') ?? '6', 10);

function basePose(): CharacterPoseExt {
  return {
    loco: { speed: 0, grounded: true, vy: 0, crouch: 0, aim: 0, downed: false, weaponUp: 0 },
    clip: null,
    clipT: 0,
    clipW: 0,
    tumble: null,
    dead: false,
    deathKind: null,
    mixerT: 0,
    air: 0,
    swim: 0,
  };
}

function clipPose(lib: AnimLibrary, clip: ClipName, u: number): CharacterPoseExt {
  const p = basePose();
  const I = lib.info[clip];
  const d = I.duration;
  switch (clip) {
    case 'idle':
      p.mixerT = u * d;
      break;
    case 'walk':
    case 'run':
    case 'sprint':
      p.loco.speed = I.speed;
      p.mixerT = u;
      break;
    case 'crouchIdle':
      p.loco.crouch = 1;
      p.mixerT = u * d;
      break;
    case 'crouchWalk':
      p.loco.crouch = 1;
      p.loco.speed = I.speed;
      p.mixerT = u;
      break;
    case 'jumpLoop':
      p.air = 1;
      p.loco.grounded = false;
      p.mixerT = u * d;
      break;
    case 'swimIdle':
      p.swim = 1;
      p.mixerT = u * d;
      break;
    case 'swim':
      p.swim = 1;
      p.loco.speed = I.speed;
      p.mixerT = u;
      break;
    case 'aim':
      p.loco.weaponUp = 1;
      break;
    default:
      p.clip = clip;
      p.clipT = u * d;
      p.clipW = 1;
      if (clip === 'death') p.dead = true, (p.deathKind = 'shot');
  }
  return p;
}

interface Cell {
  label: string;
  look: Look;
  pose: CharacterPoseExt;
}

function cells(lib: AnimLibrary): Cell[] {
  if (mode === 'clips') {
    const list = (q.get('clips')?.split(',') as ClipName[] | undefined) ?? [...CLIP_NAMES];
    return list.map((c) => ({ label: `${c} @${U}`, look: LOOK, pose: clipPose(lib, c, U) }));
  }
  if (mode === 'looks') {
    const looks = (q.get('looks')?.split(',') as Look[] | undefined) ?? (['hero', 'rifleman', 'grenadier', 'warden', 'brute', 'sniper', 'jammer', 'boss', 'hologram'] as Look[]);
    const out: Cell[] = looks.map((l) => ({ label: l, look: l, pose: clipPose(lib, 'idle', U) }));
    for (const l of looks) {
      const p = clipPose(lib, 'idle', U);
      if (l === 'hero' || l === 'boss') p.loco.aim = 1;
      else p.loco.weaponUp = 1;
      out.push({ label: `${l} aim`, look: l, pose: p });
    }
    return out;
  }
  if (mode === 'motion') {
    // blends and layers
    const S = lib.info;
    const mk = (label: string, look: Look, f: (p: CharacterPoseExt) => void): Cell => {
      const p = basePose();
      p.mixerT = U;
      f(p);
      return { label, look, pose: p };
    };
    const deaths: DeathKind[] = ['shot', 'fall', 'blast', 'cut'];
    return [
      mk('walk 1.0', LOOK, (p) => (p.loco.speed = 1.0)),
      mk('3.1 m/s', LOOK, (p) => (p.loco.speed = 3.1)),
      mk('6.0 m/s', LOOK, (p) => (p.loco.speed = 6.0)),
      mk('crouch 1.9', LOOK, (p) => ((p.loco.speed = 1.9), (p.loco.crouch = 1))),
      mk('walk+weaponUp', 'rifleman', (p) => ((p.loco.speed = 1.4), (p.loco.weaponUp = 1))),
      mk('hero run+aim', 'hero', (p) => ((p.loco.speed = 3.1), (p.loco.aim = 1))),
      mk('run+punch', 'hero', (p) => ((p.loco.speed = 3.1), (p.clip = 'punch'), (p.clipT = S.punch.duration * 0.45), (p.clipW = 1))),
      mk('run+shoot', 'rifleman', (p) => ((p.loco.speed = 3.1), (p.loco.weaponUp = 1), (p.clip = 'shoot'), (p.clipT = 0.1), (p.clipW = 1))),
      mk('push dash', 'hero', (p) => ((p.loco.speed = 12), (p.clip = 'push'), (p.clipT = S.push.duration * 0.6), (p.clipW = 1))),
      mk('warden walk', 'warden', (p) => (p.loco.speed = 1.3)),
      mk('fall vy-15', LOOK, (p) => ((p.air = 1), (p.loco.grounded = false), (p.loco.vy = -15))),
      mk('tumble', LOOK, (p) => ((p.air = 1), (p.loco.grounded = false), (p.tumble = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.1, 0.4, 0.6)).toArray() as [number, number, number, number]))),
      mk('downed', LOOK, (p) => ((p.loco.downed = true), (p.clip = 'death'), (p.clipT = S.death.duration), (p.clipW = 1))),
      mk('get up', LOOK, (p) => ((p.clip = 'death'), (p.clipT = 0.6), (p.clipW = 1))),
      ...deaths.map((k) => mk(`die ${k}`, LOOK, (p) => ((p.dead = true), (p.deathKind = k), (p.clip = 'death'), (p.clipT = S.death.duration * U), (p.clipW = 1)))),
      mk('die drown', LOOK, (p) => ((p.dead = true), (p.deathKind = 'drown'), (p.swim = 1), (p.clip = 'swimIdle'), (p.clipT = 3), (p.clipW = 1))),
      mk('jumpStart', LOOK, (p) => ((p.clip = 'jumpStart'), (p.clipT = S.jumpStart.duration * U), (p.clipW = 1))),
      mk('land moving', LOOK, (p) => ((p.loco.speed = 3.1), (p.clip = 'jumpLand'), (p.clipT = 0.2), (p.clipW = 1))),
    ];
  }
  if (mode === 'seq') return [];
  return [];
}

/** mode=seq: run a scripted simulation through update() and show snapshots over time. */
function sequence(lib: AnimLibrary, asset: Awaited<ReturnType<typeof parseCharacterAsset>>): Cell[] {
  const scen = q.get('scen') ?? 'jump';
  const sim = new Character(asset, lib, LOOK);
  const out: Cell[] = [];
  const every = parseFloat(q.get('every') ?? '0.15');
  const total = parseFloat(q.get('total') ?? '2.7');
  const dt = 1 / 60;
  let next = 0;
  let vy = 0;
  let grounded = true;
  for (let t = 0; t <= total + 1e-6; t += dt) {
    const input = { speed: 0, grounded: true, vy: 0, crouch: 0, aim: 0, downed: false, swimming: false, weaponUp: 0 };
    if (scen === 'jump') {
      input.speed = 3.1;
      if (Math.abs(t - 0.4) < dt / 2) (sim.play('jumpStart', { fade: 0.05, speed: 1.4 }), (vy = 6.6), (grounded = false));
      if (!grounded) {
        vy -= 22 * dt;
        if (t > 1.0) (grounded = true), sim.play('jumpLand', { fade: 0.05, speed: 1.3 });
      }
      input.grounded = grounded;
      input.vy = grounded ? 0 : vy;
    } else if (scen === 'downed') {
      input.downed = t > 0.2 && t < 1.6;
    } else if (scen === 'die') {
      input.speed = t < 0.3 ? 3 : 0;
      if (Math.abs(t - 0.3) < dt / 2) sim.die((q.get('kind') as DeathKind) ?? 'shot');
    } else if (scen === 'shove') {
      input.speed = t > 0.4 && t < 0.7 ? 13 : 1.5;
      if (Math.abs(t - 0.4) < dt / 2) sim.play('push', { fade: 0.08, speed: 1.6 });
    } else if (scen === 'start') {
      input.speed = t < 0.3 ? 0 : Math.min(6, (t - 0.3) * 4);
    } else if (scen === 'aim') {
      input.speed = 2;
      input.aim = t > 0.3 && t < 1.8 ? 1 : 0;
    }
    sim.update(dt, input);
    if (t >= next - 1e-6) {
      out.push({ label: `${scen} t=${t.toFixed(2)}`, look: LOOK, pose: sim.getPose() as CharacterPoseExt });
      next += every;
    }
  }
  return out;
}

async function main() {
  const [glb, json] = await Promise.all([fetch('/assets/Soldier.glb').then((r) => r.arrayBuffer()), fetch('/assets/anims.json').then((r) => r.json())]);
  const asset = await parseCharacterAsset(glb);
  const lib = loadAnimLibrary(json, asset);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d2126);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x6a5a48, 3.2));
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.6);
  scene.add(sun, sun.target);

  const list = mode === 'seq' ? sequence(lib, asset) : cells(lib);
  const rows = Math.ceil(list.length / COLS);
  const sx = 2.0;
  const shelf = 2.9;
  const right = new THREE.Vector3(Math.cos(AZ), 0, -Math.sin(AZ));
  const view = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
  const holo = new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.4, depthWrite: false });
  const chars: { c: Character; pos: THREE.Vector3; label: string }[] = [];
  list.forEach((cell, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const pos = right.clone().multiplyScalar((col - (COLS - 1) / 2) * sx);
    pos.y = -row * shelf;
    const c = new Character(asset, lib, cell.look, cell.look === 'hologram' ? holo : undefined);
    c.root.position.copy(pos);
    c.setPose(cell.pose);
    scene.add(c.root);
    // ground tile
    const g = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 1.7), new THREE.MeshStandardMaterial({ color: 0x59636e, roughness: 0.9 }));
    g.position.copy(pos).y -= 0.02;
    g.receiveShadow = true;
    scene.add(g);
    const grid = new THREE.GridHelper(1.7, 6, 0x8fa0b0, 0x7a8794);
    grid.position.copy(pos).y += 0.002;
    scene.add(grid);
    chars.push({ c, pos, label: cell.label });
  });

  const aspect = innerWidth / innerHeight;
  const halfH = Math.max((rows * shelf) / 2 + 0.3, (COLS * sx) / 2 / aspect) / ZOOM;
  const halfW = halfH * aspect;
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 200);
  const center = new THREE.Vector3(0, -((rows - 1) * shelf) / 2 + 0.9, 0);
  cam.position.copy(center).addScaledVector(view, 40);
  cam.lookAt(center);
  sun.position.copy(center).add(new THREE.Vector3(4, 12, 7));
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -Math.max(halfW, halfH) - 3;
  sc.right = sc.top = Math.max(halfW, halfH) + 3;
  sc.far = 60;

  renderer.render(scene, cam);
  for (const { pos, label } of chars) {
    const p = pos.clone().add(new THREE.Vector3(0, -0.12, 0)).project(cam);
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = label;
    el.style.left = `${((p.x + 1) / 2) * innerWidth}px`;
    el.style.top = `${((1 - p.y) / 2) * innerHeight}px`;
    document.body.appendChild(el);
  }
  const mb = (JSON.stringify(json).length / 1024).toFixed(0);
  document.getElementById('info')!.textContent = `${mode} look=${LOOK} u=${U} az=${q.get('az') ?? 35} | anims.json ${mb} KB, ${lib.bones.length} bones`;
  (window as any).__ready = true;
  (window as any).__lib = lib;
}

main().catch((e) => {
  document.body.textContent = String(e?.stack ?? e);
  (window as any).__ready = true;
});
