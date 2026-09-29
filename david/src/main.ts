import * as THREE from 'three';
import { Engine, type TierName } from './core/Engine';
import { FrameWatchdog } from './fx/Watchdog';
import { Input } from './core/Input';
import { UI } from './ui/UI';
import { Flock } from './characters/Flock';
import { Player } from './gameplay/Player';
import { DavidModel } from './characters/DavidModel';
import { BearActor } from './gameplay/BearActor';
import { Props } from './gameplay/Props';
import { Projectiles } from './gameplay/Projectiles';
import { CameraRig } from './gameplay/CameraRig';
import { GameAudio } from './gameplay/GameAudio';
import { Story } from './gameplay/Story';
import { LAYOUT, SUN } from './world/Layout';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app')!;
const testMode = params.get('test') === '1';

const TIER_LABEL: Record<TierName, string> = {
  'desktop-high': 'גבוהה',
  'desktop-medium': 'בינונית',
  'mobile-high': 'גבוהה (נייד)',
  'mobile-low': 'חסכונית (נייד)',
};

/** Overlay shown while the WebGL context is lost (phones drop it under memory pressure / backgrounding). */
function contextOverlay(root: HTMLElement) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;place-items:center;background:#0b0806;color:#f4ead4;font:500 17px Heebo,system-ui,sans-serif;text-align:center;direction:rtl;pointer-events:auto';
  const msg = document.createElement('div');
  const btn = document.createElement('button');
  btn.textContent = 'טעינה מחדש';
  btn.style.cssText = 'display:none;margin:18px auto 0;padding:10px 26px;border-radius:24px;border:1.5px solid rgba(232,199,126,.7);background:rgba(20,14,8,.6);color:#f7e3b0;font:600 16px Heebo,system-ui,sans-serif';
  btn.addEventListener('click', () => location.reload());
  const inner = document.createElement('div');
  inner.append(msg, btn);
  d.append(inner);
  root.appendChild(d);
  let timer = 0;
  return {
    lost() {
      msg.textContent = 'התמונה נטענת מחדש…';
      btn.style.display = 'none';
      d.style.display = 'grid';
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        msg.textContent = 'הגרפיקה של המכשיר אותחלה. הקש כדי לטעון את המשחק מחדש.';
        btn.style.display = 'block';
      }, 4000);
    },
    restored() {
      clearTimeout(timer);
      d.style.display = 'none';
    },
    fatal(text: string) {
      clearTimeout(timer);
      msg.textContent = text;
      btn.style.display = 'block';
      d.style.display = 'grid';
    },
  };
}

async function boot() {
  // Hebrew UI; set on the container too because the artifact host wraps the page in its own <html>
  app.dir = 'rtl';
  app.lang = 'he';
  const engine = new Engine(app);
  const input = new Input(engine.renderer.domElement, app);
  const ui = new UI(app, input.isTouch);
  input.setTouchVisible(false);
  (window as unknown as Record<string, unknown>).__engine = engine;
  const overlay = contextOverlay(document.body);
  let wasPausedBeforeLoss = false;
  let paused = false;
  let started = false;
  engine.onContextLost = () => {
    wasPausedBeforeLoss = paused;
    if (started) setPaused(true);
    overlay.lost();
  };
  engine.onContextRestored = () => {
    overlay.restored();
    if (started && !wasPausedBeforeLoss) setPaused(false);
  };

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
  // David: realistic human + strand hair + fitted costume (async; the Player constructs him synchronously)
  ui.setLoading(0.97, 'דָּוִד יוֹצֵא אֶל הַצֹּאן…');
  await DavidModel.preload(q, { msaa: engine.quality.msaa });
  const player = new Player(engine, projectiles, audio);
  const bear = new BearActor(terrain, engine.colliders, engine.scene);
  const cam = new CameraRig(engine.camera, ground);
  const story = new Story(engine, ui, input, audio, cam, player, flock, bear, props, projectiles);
  const jump = params.get('jump');
  if (jump === 'sling' || jump === 'bear' || jump === 'fight' || jump === 'end') story.jump = jump;

  // initial frame so the world is ready behind the start screen
  player.place(LAYOUT.start.x + 0.2, LAYOUT.start.z + 2.3, 0.46);
  cam.playShots([{ duration: 1e6, ease: false, at: (_u, t) => ({ pos: new THREE.Vector3(620 - t * 3, 140, 230), look: new THREE.Vector3(-100, 30, -150), fov: 42 }) }]);

  // one-time warm-up behind the loading screen: shader pre-compilation + GPU benchmark that picks the
  // render tier (pixel ratio, AA, shadows, bloom...). The canvas is never resized for performance later.
  ui.setLoading(0.98, 'מכוונן את התמונה למכשיר…');
  engine.setFov(42);
  const px = LAYOUT.start.x, pz = LAYOUT.start.z;
  const bench = await engine.warmup({
    bench: !testMode && params.get('bench') !== '0',
    force: params.get('bench') === 'force', // exercise the tier ladder even on software GPUs / in tests
    precompile: !testMode || params.get('precompile') === '1', // headless tests: keep boot fast
    views: [
      // gameplay: shepherd's-eye view over the pasture (grass, flock, trees: the heaviest shot)
      { pos: new THREE.Vector3(px - 3, ground(px - 3, pz - 5) + 2.2, pz - 5), look: new THREE.Vector3(LAYOUT.pasture.x, ground(LAYOUT.pasture.x, LAYOUT.pasture.z) + 1, LAYOUT.pasture.z) },
      // the start-screen vista
      { pos: new THREE.Vector3(620, 140, 230), look: new THREE.Vector3(-100, 30, -150) },
    ],
  });
  (window as unknown as Record<string, unknown>).__bench = bench;
  ui.setLoading(1, 'מוכן');

  // ------------------------------------------------------------------ pause handling
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

  ui.showStart(TIER_LABEL[engine.quality.tier], async () => {
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
  let pausedFrames = 0;
  const camDir = new THREE.Vector3();
  const frame = (rawDt: number, render = true) => {
    input.update();
    if (started && input.take('pause') && !cam.inCinematic) setPaused(!paused);
    if (paused) {
      input.clearEdges();
      // the menu covers a still image: redraw only now and then (keeps the canvas valid after a
      // resize / context restore) instead of burning the phone's GPU and battery every frame
      if (render && pausedFrames++ % 12 === 0) engine.render(rawDt, 0);
      return;
    }
    pausedFrames = 0;
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
    if (cam.inCinematic) engine.focus.copy(engine.camera.position).addScaledVector(engine.camera.getWorldDirection(camDir), 18);
    else engine.focus.copy(player.pos);
    audio.update(rawDt);
    if (render) engine.render(rawDt, dt);
    else engine.tickEnvironment(dt);
    // unconsumed edge presses expire each frame
    input.clearEdges();
  };
  // black-frame watchdog: every frame in test runs, every 30th with ?watchdog=1 (field diagnostics)
  const watchdog = testMode || params.has('watchdog') ? new FrameWatchdog(engine.renderer, testMode ? 1 : 30) : null;
  (window as unknown as Record<string, unknown>).__watchdog = watchdog;
  let errors = 0;
  const safeFrame = (dt: number, render = true) => {
    try {
      frame(dt, render);
      if (render && watchdog && watchdog.afterFrame()) console.warn('[watchdog]', JSON.stringify(watchdog.events[watchdog.events.length - 1]));
    } catch (e) {
      // keep the loop alive; a persistent failure (e.g. a restored context that can't rebuild) asks for a reload
      console.error(e);
      if (++errors > 30) overlay.fatal('אירעה תקלה בגרפיקה. הקש כדי לטעון את המשחק מחדש.');
    }
  };
  let last = performance.now();
  // phones: cap at 60 fps on 90/120 Hz screens (steadier pacing, less heat -> less thermal throttling)
  const minFrameMs = engine.quality.mobile && params.get('fps') !== 'max' ? 1000 / 60 - 2.5 : 0;
  const tick = () => {
    requestAnimationFrame(tick);
    const now = performance.now();
    if (now - last < minFrameMs) return;
    const realDt = (now - last) / 1000;
    const rawDt = Math.min(0.05, Math.max(0.0001, realDt));
    last = now;
    safeFrame(rawDt);
    // performance governor: sheds post / shadow cost after sustained slowness; never resizes the canvas
    engine.perfTick(realDt, started && !paused && !document.hidden);
  };
  if (!testMode) tick();
  else {
    const w = window as unknown as Record<string, unknown>;
    w.__frame = (dt: number, render: boolean) => safeFrame(dt, render);
    w.__step = (seconds: number, dt = 1 / 30) => {
      const n = Math.round(seconds / dt);
      for (let i = 0; i < n; i++) frame(dt, false);
      safeFrame(dt, true);
      const gl = engine.renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // wait for the GPU
    };
    /** render `n` consecutive frames (each sampled by the watchdog); returns the watchdog stats */
    w.__frames = (n: number, dt = 1 / 30) => {
      for (let i = 0; i < n; i++) safeFrame(dt, true);
      return watchdog?.stats();
    };
    w.__start = () => {
      ui.dismissLoading();
      started = true;
      story.start(params.get('skip') === '1');
    };
    safeFrame(1 / 30, true);
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
