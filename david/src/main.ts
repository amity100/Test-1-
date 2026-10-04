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
import { Intro } from './gameplay/Intro';
import { LAYOUT, SUN } from './world/Layout';
import { narration } from './content/introNarration';
import { setSafeSkinning } from './characters/human/DualQuatSkinning';
import { bootLog, bootMark, bootStep, bootSync } from './core/bootProfile';

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

/**
 * The artifact host wraps the page in its own document (with a device-width viewport). Opened on its own,
 * dist-artifact/index.html has no <head>: without this, phones lay the page out 980 px wide and the game renders
 * blurry at a fraction of the screen's pixels, with tiny UI.
 */
function ensureViewport() {
  if (document.querySelector('meta[name="viewport"]')) return;
  const m = document.createElement('meta');
  m.name = 'viewport';
  m.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no';
  document.head.appendChild(m);
}

async function boot() {
  ensureViewport();
  // Hebrew UI; set on the container too because the artifact host wraps the page in its own <html>
  app.dir = 'rtl';
  app.lang = 'he';
  (window as unknown as Record<string, unknown>).__boot = bootLog;
  bootMark('boot');
  const engine = bootSync('engine:new', () => new Engine(app));
  // humans: standard 4-influence skinning on phones and Apple / mobile GPUs (the 8-influence DQS path lost the legs
  // there — see DualQuatSkinning SAFE SKINNING); ?skin=safe | ?skin=dqs force either path
  {
    const p = params.get('skin');
    const safe = p === 'safe' ? true : p === 'dqs' ? false
      : engine.quality.mobile || /Apple|Mali|Adreno|PowerVR|Immortalis|Xclipse|Maleoon|Mobile/i.test(engine.quality.gpu);
    setSafeSkinning(safe);
    (window as unknown as Record<string, unknown>).__skin = safe ? 'safe' : 'dqs';
  }
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

  // The opening film needs its stage (CUT v3: only the Gilgal set with its cast and its army — FilmStage builds just the
  // sets the shot sheet films in; lazily imported chunks): it is built behind this loading screen so the film starts at
  // once after the start click, and it is disposed after the film. Not built when the film is skipped (?skip=1, ?jump=...) or with ?preload=0 (the intro then builds it itself
  // behind its pre-roll card). Headless tests (?test=1) keep the lazy path unless ?preload=1.
  const wantIntro = params.get('skip') !== '1' && !params.get('jump');
  const preloadStage = wantIntro && (params.get('preload') ?? (testMode ? '0' : '1')) !== '0';
  // share of the loading bar before the film stage (its build is the longest single step; load1: with the progressive
  // start only the film's first set is built before the start screen)
  const LP = preloadStage ? (Intro.progressive() ? 0.7 : 0.45) : 1;
  // load1: the film's first set needs the regional and the Judah height tiles (~1.5 MB): requested now, so they download
  // and decode while the CPU builds the world (landData caches the promise; the judah builder picks it up)
  if (preloadStage) {
    import('./film/land/landData')
      .then((m) => {
        void m.loadTile('region').catch(() => undefined);
        void m.loadTile('judah').catch(() => undefined);
      })
      .catch(() => undefined);
  }
  await bootStep('world', () => engine.build((f, label) => ui.setLoading(f * LP, label)));
  const terrain = engine.terrain;
  const ground = (x: number, z: number) => terrain.heightAt(x, z);

  const projectiles = new Projectiles(ground);
  engine.scene.add(projectiles.group);
  const audio = new GameAudio(engine.camera);
  const props = bootSync('props', () => new Props(terrain, engine.tex, engine.colliders));
  engine.scene.add(props.group);
  ui.setLoading(0.96 * LP, 'מכין את הצאן…');
  await bootStep('flock:preload', () => Flock.preloadAsync(7));
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
  ui.setLoading(0.97 * LP, 'דָּוִד יוֹצֵא אֶל הַצֹּאן…');
  const david = await bootStep('david:preload', () => DavidModel.preload(q, { msaa: engine.quality.msaa }));
  for (const k of ['human', 'outfit', 'groom'] as const) bootLog.steps.push({ name: `david:${k}`, start: -1, ms: Math.round(david.loadMs[k]) });
  const player = bootSync('player', () => new Player(engine, projectiles, audio));
  const bear = bootSync('bear', () => new BearActor(terrain, engine.colliders, engine.scene));
  const cam = new CameraRig(engine.camera, ground);
  // the follow camera's boom stops in front of boulders (e.g. the big rock beside David's lookout)
  cam.solid = (x, y, z) => engine.colliders.solidAt(x, y, z, 0.35);
  const story = new Story(engine, ui, input, audio, cam, player, flock, bear, props, projectiles);
  const jump = params.get('jump');
  if (jump === 'sling' || jump === 'bear' || jump === 'fight' || jump === 'end') story.jump = jump;

  // initial frame so the world is ready behind the start screen
  player.place(LAYOUT.start.x + 0.2, LAYOUT.start.z + 2.3, 0.46);
  cam.playShots([{ duration: 1e6, ease: false, at: (_u, t) => ({ pos: new THREE.Vector3(620 - t * 3, 140, 230), look: new THREE.Vector3(-100, 30, -150), fov: 42 }) }]);

  // one-time warm-up behind the loading screen: shader pre-compilation + GPU benchmark that picks the
  // render tier (pixel ratio, AA, shadows, bloom...). The canvas is never resized for performance later.
  ui.setLoading(0.98 * LP, 'מכוונן את התמונה למכשיר…');
  engine.setFov(42);
  const px = LAYOUT.start.x, pz = LAYOUT.start.z;
  const warmViews = [
    // gameplay: shepherd's-eye view over the pasture (grass, flock, trees: the heaviest shot)
    { pos: new THREE.Vector3(px - 3, ground(px - 3, pz - 5) + 2.2, pz - 5), look: new THREE.Vector3(LAYOUT.pasture.x, ground(LAYOUT.pasture.x, LAYOUT.pasture.z) + 1, LAYOUT.pasture.z) },
    // the start-screen vista
    { pos: new THREE.Vector3(620, 140, 230), look: new THREE.Vector3(-100, 30, -150) },
  ];
  const benchOpts = {
    bench: !testMode && params.get('bench') !== '0',
    force: params.get('bench') === 'force', // exercise the tier ladder even on software GPUs / in tests
  };
  const precompileOn = !testMode || params.get('precompile') === '1'; // headless tests: keep boot fast
  // load1 (the progressive start): when no benchmark has to measure the primed world (a stored result, a forced tier,
  // a software GPU), the world's first-frame warm-up (one full frame per view: uploads, shadow maps, first-use programs
  // — mostly GPU work) leaves the critical path: its programs are still created here (the driver compiles them while
  // the CPU builds the film's first set), its frames are drawn by the background builder before the film's first shot
  // in the world (P2) — behind the start screen, or off the canvas while the film plays. ?prime=boot keeps it here.
  const deferPrime = preloadStage && Intro.progressive() && precompileOn && !engine.willBenchmark(benchOpts) && params.get('prime') !== 'boot';
  const bench = await bootStep('warmup', () => engine.warmup({ ...benchOpts, precompile: precompileOn, prime: !deferPrime, views: warmViews }));
  (window as unknown as Record<string, unknown>).__bench = bench;
  // the score's voicing follows the final render tier (phones: lighter synthesis, shorter reverb)
  audio.setLite(engine.quality.name === 'low');
  if (preloadStage) {
    // after the warm-up: the film stage is built and pre-compiled for the final tier's post chain behind the loading
    // bar, so the film starts at once after the start click (a build behind the start screen left the player on a
    // black screen after the click while long build tasks held the page)
    const label = narration('chapterTitle');
    ui.setLoading(LP, label);
    const t0 = performance.now();
    await bootStep('film:preload', () =>
      Intro.preload(engine, {
        onProgress: (f) => ui.setLoading(LP + (0.995 - LP) * f, label),
        primeWorld: deferPrime ? (covered, slice) => engine.primeWorld(warmViews, covered, slice) : undefined,
      }),
    );
    (window as unknown as Record<string, unknown>).__stageMs = performance.now() - t0;
  }
  ui.setLoading(1, 'מוכן');
  bootMark('ready');

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

  // the score's context is created / resumed inside the click's gesture (load1: at the click itself, so a held start
  // builds its graph during the hold)
  let audioP: Promise<void> | null = null;
  const initAudio = () =>
    (audioP ??= audio.init().then(
      () => audio.setVolume(0.9),
      (e) => console.warn('audio init failed', e),
    ));
  // load1 (the progressive start): the film's later sets build in the background from here on (start screen and
  // prologue). A click on a device too slow for them to be ready before their shots keeps the start screen up (its bar
  // back on) until they will be — then the film starts by itself.
  const sched = Intro.schedule;
  ui.showStart(
    TIER_LABEL[engine.quality.tier],
    async () => {
      bootMark('click');
      await initAudio();
      started = true;
      story.start(params.get('skip') === '1');
    },
    sched
      ? async (progress) => {
          bootMark('click');
          void initAudio();
          await sched.waitForStart(progress);
          // from here the picture may show: no film set is pre-compiled on the canvas any more
          await sched.enterFilm();
          bootMark('hold-end');
        }
      : undefined,
  );

  // ------------------------------------------------------------------ loop
  /** load1: the film's start is held (its black pre-roll card covers the canvas): nothing needs drawing */
  const filmHolding = () => (window as unknown as { __intro?: { state: string } }).__intro?.state === 'loading';
  let time = 0;
  let pausedFrames = 0;
  let idleFrames = 0;
  const camDir = new THREE.Vector3();
  // load1 (wave 4): main-thread ms per frame by system, draw calls and triangles over all passes — ?perf=1 or tests
  // (window.__frameStats; __frameStats.reset() starts a new window)
  const perfOn = testMode || params.has('perf');
  const fstats = {
    n: 0,
    ms: {} as Record<string, number>,
    max: {} as Record<string, number>,
    calls: 0,
    tris: 0,
    reset() {
      this.n = 0;
      this.ms = {};
      this.max = {};
      this.calls = 0;
      this.tris = 0;
    },
  };
  if (perfOn) {
    engine.renderer.info.autoReset = false;
    (window as unknown as Record<string, unknown>).__frameStats = fstats;
  }
  let lapT = 0;
  const lap = (k: string) => {
    if (!perfOn) return;
    const t = performance.now();
    const d = t - lapT;
    lapT = t;
    fstats.ms[k] = (fstats.ms[k] ?? 0) + d;
    if (d > (fstats.max[k] ?? 0)) fstats.max[k] = d;
  };
  const frame = (rawDt: number, render = true) => {
    if (perfOn) {
      lapT = performance.now();
      engine.renderer.info.reset();
    }
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
    lap('input');
    const dt = started ? story.update(rawDt) : rawDt;
    lap('story');
    time += dt;
    if (!cam.inCinematic && started) {
      const look = input.consumeLook();
      cam.applyLook(look.x, look.y);
    } else input.consumeLook();
    player.update(dt, input, cam, time);
    lap('player');
    flock.update(dt, time, { shepherd: player.pos, threats: story.threats, camera: engine.camera });
    lap('flock');
    bear.update(dt);
    lap('bear');
    projectiles.update(dt);
    props.update(dt);
    lap('props');
    cam.target.set(player.pos.x, player.pos.y + 1.55, player.pos.z);
    cam.update(rawDt, time);
    engine.setFov(cam.fov);
    if (cam.inCinematic) engine.focus.copy(engine.camera.position).addScaledVector(engine.camera.getWorldDirection(camDir), 18);
    else engine.focus.copy(player.pos);
    audio.update(rawDt);
    lap('cam+audio');
    // the start screen is opaque: until the start click, redraw only now and then (keeps the canvas valid) instead of
    // spending a phone's GPU and battery on a picture nobody sees — and not at all while the film's sets are being built
    // behind it (load1: the GPU is theirs); nor while the film's start is held under its black card
    const holding = started ? filmHolding() : !!sched && !sched.settled;
    if (render && (started ? !holding : !holding && idleFrames++ % 30 === 0)) engine.render(rawDt, dt);
    else {
      engine.tickEnvironment(dt);
      // test stepping (__step): keep dissolves and letterbox moves in film time though nothing is drawn
      if (!render || holding) engine.post.tick(rawDt);
    }
    // unconsumed edge presses expire each frame
    input.clearEdges();
    if (perfOn) {
      lap('render');
      fstats.n++;
      fstats.calls += engine.renderer.info.render.calls;
      fstats.tris += engine.renderer.info.render.triangles;
    }
  };
  // black-frame watchdog: every frame in test runs, every 30th with ?watchdog=1 (field diagnostics)
  const watchdog = testMode || params.has('watchdog') ? new FrameWatchdog(engine.renderer, testMode ? 1 : 30) : null;
  if (watchdog) watchdog.ignore = () => engine.post.intentionallyDark; // dips to black / fades are intended
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
