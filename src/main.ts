import './style.css';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PhysicsWorld } from './core/PhysicsWorld';
import { SimulationClock } from './core/SimulationClock';
import { GAME_CONFIG } from './core/config';
import { Ragdoll } from './entities/Ragdoll';
import { MarionetteController } from './entities/MarionetteController';
import { LocalPointerInput } from './input/InputManager';
import { AIOpponent } from './game/AIOpponent';
import { MatchManager } from './game/MatchManager';
import { SceneManager } from './rendering/SceneManager';
import { RagdollRenderer } from './rendering/RagdollRenderer';
import { CameraRig } from './rendering/CameraRig';
import { VFX } from './rendering/VFX';
import { ClipRecorder } from './replay/ClipRecorder';
import { HUD } from './ui/HUD';
import { SFXManager } from './audio/SFXManager';

const app = document.querySelector<HTMLDivElement>('#app')!;
let currentMatch: { dispose: () => void } | undefined;

function createMatch() {
  app.innerHTML = '';

  const scene = new SceneManager(app);
  const physics = new PhysicsWorld();
  physics.addArena();

  const arena = new THREE.Mesh(
    new THREE.CylinderGeometry(GAME_CONFIG.arenaRadius, GAME_CONFIG.arenaRadius, 0.12, 72),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }),
  );
  arena.position.y = -0.06;
  scene.scene.add(arena);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(GAME_CONFIG.arenaRadius, 0.035, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  scene.scene.add(ring);

  const player = new Ragdoll(physics, 'Player', new THREE.Vector3(-1.35, 0, 0), '#d9904a');
  const enemy = new Ragdoll(physics, 'AI', new THREE.Vector3(1.35, 0, 0), '#6db4ff');
  const playerRenderer = new RagdollRenderer(scene.scene, player);
  const enemyRenderer = new RagdollRenderer(scene.scene, enemy);

  const input = new LocalPointerInput(scene.renderer.domElement, scene.camera, () => player.center());
  const playerController = new MarionetteController(player, input, 1);
  const aiInput = new AIOpponent(() => enemy.center(), () => player.center());
  const enemyController = new MarionetteController(enemy, aiInput, -1);

  const match = new MatchManager();
  const clock = new SimulationClock();
  const camera = new CameraRig(scene.camera);
  const vfx = new VFX(scene.camera, scene.scene);
  const sfx = new SFXManager();
  const recorder = new ClipRecorder(GAME_CONFIG.replaySeconds);
  const hud = new HUD();
  hud.onLimb = (limb) => input.setLimb(limb);
  hud.onRestart = () => {
    currentMatch?.dispose();
    currentMatch = createMatch();
  };

  let elapsed = 0;
  let ended = false;
  let active = true;
  const lines = new THREE.Group();
  scene.scene.add(lines);

  function drawWire(a: THREE.Vector3, b: THREE.Vector3, color: number, opacity = 0.76) {
    const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    lines.add(line);
  }

  function step(dt: number) {
    elapsed += dt;
    playerController.update(dt);
    enemyController.update(dt);
    physics.step();
    recorder.record(elapsed, physics.snapshots());
    match.update(dt, [player, enemy]);

    if (playerController.justSnapped) {
      sfx.snap();
      vfx.snap(player.position(playerController.state.activeLimb));
    }
    if (enemyController.justSnapped) vfx.snap(enemy.position(enemyController.state.activeLimb));

    if (match.result && !ended) {
      ended = true;
      sfx.ko();
      hud.showResult(match.result, 'share' in navigator, async () => {
        const blob = await recorder.exportCanvas(scene.renderer.domElement);
        const file = new File([blob], 'puppet-brawl.webm', { type: 'video/webm' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Puppet Brawl KO' });
        } else {
          const anchor = document.createElement('a');
          anchor.href = URL.createObjectURL(blob);
          anchor.download = file.name;
          anchor.click();
        }
      });
    }
  }

  function render() {
    playerRenderer.update();
    enemyRenderer.update();
    lines.clear();

    for (const controller of [playerController, enemyController]) {
      const chest = controller.ragdoll.position('chest');
      const hand = controller.ragdoll.position(controller.state.activeLimb);
      drawWire(controller.cross, chest, 0xffffff, 0.62);
      drawWire(controller.cross, hand, controller.state.tension ? 0xffd166 : 0x6c757d, controller.state.tension ? 0.95 : 0.45);
    }

    camera.update([player.center(), enemy.center()]);
    vfx.update(1 / 60);
    hud.update(playerController, enemyController);
    scene.render();
  }

  function animate() {
    if (!active) return;
    requestAnimationFrame(animate);
    clock.tick(step);
    render();
  }

  animate();

  return {
    dispose() {
      active = false;
      hud.destroy();
      scene.renderer.dispose();
      app.innerHTML = '';
    },
  };
}

RAPIER.init().then(() => {
  currentMatch = createMatch();
});
