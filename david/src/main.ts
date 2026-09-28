import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Input } from './core/Input';
import { UI } from './ui/UI';
import { Flock } from './characters/Flock';
import { Player } from './gameplay/Player';
import { BearActor } from './gameplay/BearActor';
import { Props } from './gameplay/Props';
import { Projectiles } from './gameplay/Projectiles';
import { CameraRig } from './gameplay/CameraRig';
import { GameAudio } from './gameplay/GameAudio';
import { Story } from './gameplay/Story';
import { LAYOUT, SUN } from './world/Layout';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app')!;

async function boot() {
  const engine = new Engine(app);
  const input = new Input(engine.renderer.domElement, app);
  const ui = new UI(app, input.isTouch);
  input.setTouchVisible(false);
  (window as unknown as Record<string, unknown>).__engine = engine;

  await engine.build((f, label) => ui.setLoading(f, label));
  const terrain = engine.terrain;
  const ground = (x: number, z: number) => terrain.heightAt(x, z);

  const projectiles = new Projectiles(ground);
  engine.scene.add(projectiles.group);
  const audio = new GameAudio(engine.camera);
  const props = new Props(terrain, engine.tex, engine.colliders);
  engine.scene.add(props.group);
  ui.setLoading(0.96, 'מכין את הצאן…');
  await Flock.preloadAsync(7);
  const q = engine.quality.name;
  const flock = new Flock({
    sheep: q === 'low' ? 8 : q === 'medium' ? 12 : 15,
    rams: q === 'low' ? 1 : 2,
    goats: q === 'low' ? 4 : q === 'medium' ? 6 : 8,
    ground,
    pastureCenter: new THREE.Vector3(LAYOUT.pasture.x, ground(LAYOUT.pasture.x, LAYOUT.pasture.z), LAYOUT.pasture.z),
    pastureRadius: LAYOUT.pasture.r,
    seed: 7,
    walkable: (x, z) => terrain.slopeAt(x, z) < 0.5 && engine.colliders.free(x, z, 0.3),
  });
  engine.scene.add(flock.group);
  flock.onSound = (kind, pos, vol) => audio.at(kind, pos, vol * 0.8, 1, 70);
  const player = new Player(engine, projectiles, audio);
  const bear = new BearActor(terrain, engine.colliders, engine.scene);
  const cam = new CameraRig(engine.camera, ground);
  const story = new Story(engine, ui, input, audio, cam, player, flock, bear, props, projectiles);
  const jump = params.get('jump');
  if (jump === 'sling' || jump === 'bear' || jump === 'fight' || jump === 'end') story.jump = jump;

  // initial frame so the world is ready behind the start screen
  player.place(LAYOUT.start.x + 0.2, LAYOUT.start.z + 2.3, 0.46);
  cam.playShots([{ duration: 1e6, ease: false, at: (_u, t) => ({ pos: new THREE.Vector3(620 - t * 3, 140, 230), look: new THREE.Vector3(-100, 30, -150), fov: 42 }) }]);
  ui.setLoading(1, 'מוכן');

  // ------------------------------------------------------------------ pause handling
  let paused = false;
  let started = false;
  const setPaused = (p: boolean) => {
    if (!started) return;
    paused = p;
    ui.pause(p);
    input.enabled = !p;
    if (p && document.pointerLockElement) document.exitPointerLock();
  };
  ui.onResume = () => {
    setPaused(false);
    if (!input.isTouch) engine.renderer.domElement.requestPointerLock?.();
  };
  ui.onRestart = () => {
    setPaused(false);
    engine.sky.setSun(SUN.elevation, SUN.azimuth, engine.scene);
    story.start(true);
  };
  ui.onVolume = (v) => audio.setVolume(v);
  ui.onSensitivity = (v) => (cam.sensitivity = 0.0024 * v);
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && started && !paused && !cam.inCinematic && !input.isTouch) setPaused(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && started && !cam.inCinematic) setPaused(true);
  });
  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'pause-btn';
  pauseBtn.textContent = '☰';
  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setPaused(!paused);
  });
  ui.root.appendChild(pauseBtn);

  ui.showStart(engine.quality.name === 'high' ? 'גבוהה' : engine.quality.name === 'medium' ? 'בינונית' : 'נמוכה', async () => {
    try {
      await audio.init();
      audio.setVolume(0.9);
    } catch (e) {
      console.warn('audio init failed', e);
    }
    started = true;
    story.start(params.get('skip') === '1');
  });

  // ------------------------------------------------------------------ loop
  let time = 0;
  const frame = (rawDt: number, render = true) => {
    input.update();
    if (started && input.take('pause') && !cam.inCinematic) setPaused(!paused);
    if (paused) {
      input.clearEdges();
      if (render) engine.render(rawDt, 0);
      return;
    }
    const dt = started ? story.update(rawDt) : rawDt;
    time += dt;
    if (!cam.inCinematic && started) {
      const look = input.consumeLook();
      cam.applyLook(look.x, look.y);
    } else input.consumeLook();
    player.update(dt, input, cam, time);
    flock.update(dt, time, { shepherd: player.pos, threats: story.threats, camera: engine.camera });
    bear.update(dt);
    projectiles.update(dt);
    props.update(dt);
    cam.target.set(player.pos.x, player.pos.y + 1.55, player.pos.z);
    cam.update(rawDt, time);
    engine.setFov(cam.fov);
    engine.focus.copy(cam.inCinematic ? engine.camera.position.clone().add(engine.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(18)) : player.pos);
    audio.update(rawDt);
    if (render) engine.render(rawDt, dt);
    else engine.tickEnvironment(dt);
    // unconsumed edge presses expire each frame
    input.clearEdges();
  };
  const testMode = params.get('test') === '1';
  let last = performance.now();
  // adaptive resolution: keep the frame rate smooth on weaker GPUs
  let acc = 0, frames = 0, pr = engine.renderer.getPixelRatio();
  const maxPr = pr;
  const tick = () => {
    requestAnimationFrame(tick);
    const now = performance.now();
    const realDt = (now - last) / 1000;
    const rawDt = Math.min(0.05, Math.max(0.0001, realDt));
    last = now;
    frame(rawDt);
    if (started && !paused && realDt < 0.5) {
      acc += realDt;
      frames++;
      if (acc > 2.5) {
        const avg = acc / frames;
        const next = avg > 0.027 ? Math.max(0.6, pr * 0.85) : avg < 0.0145 ? Math.min(maxPr, pr * 1.1) : pr;
        if (Math.abs(next - pr) > 0.02) {
          pr = next;
          engine.renderer.setPixelRatio(pr);
          engine.resize();
        }
        acc = 0;
        frames = 0;
      }
    }
  };
  if (!testMode) tick();
  else {
    const w = window as unknown as Record<string, unknown>;
    w.__frame = (dt: number, render: boolean) => frame(dt, render);
    w.__step = (seconds: number, dt = 1 / 30) => {
      const n = Math.round(seconds / dt);
      for (let i = 0; i < n; i++) frame(dt, false);
      frame(dt, true);
      const gl = engine.renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // wait for the GPU
    };
    w.__start = () => {
      ui.dismissLoading();
      started = true;
      story.start(params.get('skip') === '1');
    };
    frame(1 / 30, true);
  }
  (window as unknown as Record<string, unknown>).__game = { engine, story, player, bear, flock, cam, ui, input };
  (window as unknown as Record<string, unknown>).__ready = true;
}

boot().catch((e) => {
  console.error(e);
  (window as unknown as Record<string, unknown>).__error = String((e as Error)?.stack || e);
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;color:#f99;font:14px monospace;padding:24px;white-space:pre-wrap;background:#0b0806';
  d.textContent = 'שגיאה בטעינת המשחק:\n' + String((e as Error)?.message || e);
  document.body.appendChild(d);
});
