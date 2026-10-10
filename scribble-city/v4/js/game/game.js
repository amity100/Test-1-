import * as THREE from 'three';
import { shared, pickLights } from '../render/materials.js';
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { CameraRig } from './camera.js';
import { FigureRenderer } from './figure.js';
import { Effects } from './fx.js';
import { Player } from './player.js';
import { Weapons, WEAPON_DEFS, GRADE } from './weapons.js';
import { Enemies } from './enemies.js';
import { Vehicles } from './vehicles.js';
import { Parachute } from './parachute.js';
import { Nightlife } from './nightlife.js';
import { Civilians } from './civilians.js';
import { Traffic } from './traffic.js';
import { HUD } from '../ui/hud.js';
import { Album, ALL_OPEN } from '../ui/album.js';
import { Materialize } from './materialize.js';
import { Signals } from './signals.js';
import { Perf } from './perf.js';
import { AirDraw } from '../ui/airdraw.js';
import { Bubbles } from '../ui/bubbles.js';
import { Police } from './police.js';
import { Dialog } from '../ui/dialog.js';
import { Pickups } from './pickups.js';
import { AirSketches } from './airsketch.js';
import { StreetLife } from './streetlife.js';
import { Vignettes } from './vignettes.js';
import { Ambient } from './ambient.js';
import { BLUEPRINTS } from './blueprints.js';
import { DRIVER_SEAT } from './traffic.js';
import { CarRenderer } from '../render/cars.js';
import { buildWeaponModel } from './items.js';
import { openWall } from '../world/rooms.js';
import { BLACK_INK } from '../render/LineBatch.js';
import { clamp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { DayNight } from './daynight.js';
import { Weather } from './weather.js';
import { Rhythm } from './rhythm.js';
import { Shutters } from './shutters.js';
import { Soundscape } from './soundscape.js';

// things a photo of a billboard can be taken past (only buildings hide a board)
const PHOTO_SEE_THROUGH = new Set(['board', 'pole', 'fence', 'rail', 'tree', 'prop', 'car', 'cover']);
const BOARD_SAMPLES = [[0, 0], [-0.38, -0.32], [0.38, -0.32], [-0.38, 0.32], [0.38, 0.32]];

const $ = (id) => document.getElementById(id);

const GRADE_TEXT = {
  perfect: (n) => `ציור מושלם! ה${n} חזק במיוחד`,
  good: (n) => `ציור טוב — ה${n} מוכן`,
  wonky: (n) => `יצא עקום… ה${n} יעבוד רק חלקית`,
  fail: (n) => `ציירת לא טוב — יצא ${n} מקולקל`,
};

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.clock = new THREE.Clock();
    this.time = 0;
    this.state = 'title'; // title | play | paused | dead
    this.focus = new THREE.Vector3();
    this.stuck = [];
    this.goalFlags = { photo: false, hidden: false, drew: false, kills: 0, car: false, drove: false, heavy: false, heavyDrawn: false };
    this.lastLookInput = 0;
  }

  async init() {
    const { scene, camera, world } = this;
    this.input = new Input(this.renderer.domElement, this.touch);
    this.audio = new Audio();
    this.camRig = new CameraRig(camera, world.collision);
    this.figures = new FigureRenderer(scene);
    this.bubbles = new Bubbles(this.pipe.overlay);
    this.fx = new Effects(this);
    this.cars = new CarRenderer(scene);
    this.vehicles = new Vehicles(this);
    this.chute = new Parachute(this);
    this.materialize = new Materialize(this);
    this.traffic = new Traffic(this);
    this.signals = new Signals(this);
    this.player = new Player(this);
    this.perf = new Perf(this);
    this.civilians = new Civilians(this);
    this.enemies = new Enemies(this);
    this.weapons = new Weapons(this);
    this.hud = new HUD(this);
    this.police = new Police(this);
    this.pickups = new Pickups(this);
    // a few drinks at the Neon Bar (or one ice cream too fast): the page sways for a while
    // (after(t, fn): something to do t seconds from now, game time - the busker's dance ends)
    this.inkwell = {
      tipsy: 0,
      flipping: false,
      timers: [],
      after(t, fn) {
        this.timers.push({ t, fn });
      },
      update(dt) {
        this.tipsy = Math.max(0, this.tipsy - dt * 0.02);
        if (!this.timers.length) return;
        for (const tm of this.timers) tm.t -= dt;
        const due = this.timers.filter((tm) => tm.t <= 0);
        if (due.length) {
          this.timers = this.timers.filter((tm) => tm.t > 0);
          due.forEach((tm) => tm.fn());
        }
      },
    };
    this.dialog = new Dialog(this);
    // the hour of the day: the sun, the moon, the lamps (game/daynight.js)
    this.daynight = new DayNight(this);
    // and the weather (game/weather.js): grey skies, rain, storms, the morning fog
    this.weather = new Weather(this);
    // and the life of the city by the hour (game/rhythm.js): rush hours, who is out, shops shut
    this.rhythm = new Rhythm(this);
    this.inBar = false;
    // the outlines redrawn a few times a second: lively on a big screen, calm on a phone
    this.boilOn = !this.touch;
    this.album = new Album(this);
    this.album.onAdd = (id) => this.onAlbumAdd(id);
    this.airdraw = new AirDraw(this);
    this.airsketch = new AirSketches(this);
    this.streetlife = new StreetLife(this);
    this.vignettes = new Vignettes(this);
    this.ambient = new Ambient(this);
    this.nightlife = new Nightlife(this);
    // the shops' shutters (made last: what was there before keeps its numbers)
    this.shutters = new Shutters(this);
    // the sounds of the city around you (game/soundscape.js)
    this.soundscape = new Soundscape(this);
    this.drawPick = null; // the photo the pencil opens with
    this.nudgeDraw = false; // a new photo nobody drew yet: the pencil button wiggles
    this.drewOnce = false;
    this.drawBtnKey = '';
    // eyes over hiding spots
    for (const h of world.hideSpots) {
      this.fx.marks.push({ rect: 'eye', x: h.x, y: 2.6, z: h.z, size: 0.75, visible: false, alpha: 0.85, spot: h });
    }
    this.respawn();
    if (this.album.has('paint')) this.goalFlags.photo = true;
    // (every blueprint open: the goals about finding them are done already)
    if (ALL_OPEN) this.goalFlags.car = this.goalFlags.heavy = true;
    this.updateGoals();
    this.hud.updateWeapon();
    this.bindUI();
    const free = this.params.get('free');
    if (free) {
      const v = free.split(',').map(Number);
      this.freeCam = v;
    }
    const tp = this.params.get('tp');
    if (tp) {
      const v = tp.split(',').map(Number);
      this.player.spawn(v[0], v[1], v[2] || 0);
      this.camRig.yaw = v[2] || 0;
    }
  }

  __bp(id) {
    return BLUEPRINTS[id];
  }

  bindUI() {
    $('start-btn').addEventListener('click', () => this.start());
    $('resume-btn').addEventListener('click', () => this.resume());
    $('respawn-btn').addEventListener('click', () => this.respawnFromDeath());
    $('opt-sound').addEventListener('change', (e) => this.audio.setEnabled(e.target.checked));
    $('opt-boil').checked = this.boilOn;
    $('opt-boil').addEventListener('change', (e) => {
      this.boilOn = e.target.checked;
      shared.uBoilAmp.value = e.target.checked ? 1 : 0;
    });
    $('opt-look').checked = this.pipe.reflections;
    $('opt-look').addEventListener('change', (e) => (this.pipe.reflections = e.target.checked));
    $('opt-magic').checked = shared.uQuality.value > 0.5;
    $('opt-magic').addEventListener('change', (e) => (shared.uQuality.value = e.target.checked ? 1 : 0));
    $('opt-sens').addEventListener('input', (e) => (this.input.sensitivity = parseFloat(e.target.value)));
    $('opt-perf').addEventListener('change', (e) => this.perf.toggle(e.target.checked));
    // the city's clock: how long a day is (or the hour standing still), and a jump to an hour
    const dn = this.daynight;
    const sel = $('opt-clock');
    sel.value = [24, 48, 96, 0].includes(dn.dayMin) ? String(dn.dayMin) : '48';
    sel.addEventListener('change', (e) => dn.setDayLength(parseFloat(e.target.value)));
    for (const b of document.querySelectorAll('#pause .hours [data-h]')) {
      b.addEventListener('click', () => {
        dn.setHour(parseFloat(b.dataset.h));
        $('clock-now').textContent = dn.clock;
      });
    }
    // the weather: let the sky decide, or keep one
    const ws = $('opt-weather');
    ws.value = this.weather.mode;
    ws.addEventListener('change', (e) => this.weather.setMode(e.target.value));
    $('bench-btn').addEventListener('click', () => {
      this.resume();
      this.perf.startBench();
    });
    this.input.on('lock', (locked) => {
      if (!locked && this.state === 'play' && !this.airdraw.open && !this.album.open && !this.dialog.open && !this.dialog.justClosed && !this.inkwell.flipping && !this.perf.reportOpen && !this.touch && !this.input.lockFailed) this.pause();
    });
  }

  start() {
    const intro = false;
    const title = $('title');
    if (intro) {
      // the title card slides off the desk, then the camera dives into the notebook
      title.classList.add('leaving');
      setTimeout(() => title.classList.add('hidden'), 480);
    } else title.classList.add('hidden');
    this.audio.init();
    this.state = 'play';
    this.input.enabled = !intro;
    if (!intro) this.hud.show();
    if (this.touch) {
      if (!intro) $('touch').classList.remove('hidden');
      try {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      } catch (e) {
        // optional
      }
    } else {
      this.input.requestLock(true);
    }
    const welcome = () => {
      this.hud.toast('ברוכים הבאים לעיר השרבוטים', 'info', 2.4);
      setTimeout(() => {
        if (ALL_OPEN) this.hud.toast(this.touch ? 'כל השרטוטים פתוחים: לוחצים על העיפרון ✏ ובוחרים מה לצייר' : 'כל השרטוטים פתוחים: Q — בוחרים מה לצייר', 'info', 4);
        else if (!this.album.has('paint')) this.hud.toast(this.touch ? 'צלמו את השרטוט שממול (כפתור המצלמה)' : 'צלמו את השרטוט שממול (F)', 'info', 3.5);
      }, 2600);
    };
    welcome();
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    $('clock-now').textContent = this.daynight.clock;
    $('pause').classList.remove('hidden');
    this.input.releaseLock();
  }

  resume() {
    $('pause').classList.add('hidden');
    this.state = 'play';
    this.audio.init();
    if (!this.touch) this.input.requestLock(true);
  }

  respawn() {
    const s = this.world.spawn;
    this.player.spawn(s.x, s.z, s.yaw);
    this.camRig.yaw = s.yaw;
    this.camRig.pitch = -0.08;
  }

  respawnFromDeath() {
    $('death').classList.add('hidden');
    // drawn weapons are lost (you need to draw them again), the album stays
    while (this.weapons.slots.length > 1) {
      const sl = this.weapons.slots.pop();
      this.weapons.removeModel(sl);
    }
    this.weapons.select(0);
    this.weapons.projectiles = [];
    this.enemies.reset();
    this.bubbles.clear();
    this.police.reset();
    for (const c of this.traffic.list) if (c.police) c.mode = c.crew && c.crew.length ? 'patrol' : 'leave';
    this.respawn();
    this.state = 'play';
    if (!this.touch) this.input.requestLock(true);
    this.hud.toast('צוירת מחדש במחבוא', 'info');
  }

  onPlayerDeath() {
    if (this.player.inVehicle) this.exitVehicle(true);
    this.player.mode = 'dead';
    if (this.airdraw.open) this.airdraw.close(false, true);
    this.state = 'dead';
    this.audio.play('fail');
    setTimeout(() => {
      $('death').classList.remove('hidden');
      this.input.releaseLock();
    }, 1300);
  }

  onEnemyKilled(e) {
    if (e && e.faction === 'police') this.dropWeapon(e);
    if (e && e.faction !== 'gang' && e.faction !== 'monster') return;
    this.goalFlags.kills++;
    this.updateGoals();
  }

  // the gun (or eraser) falls out of a hand that was rubbed out, or off a beaten officer
  dropWeapon(e) {
    const id = e.cfg.gun === 'pen' ? 'pen' : e.cfg.gun === 'm4' ? 'm4' : e.cfg.club === 'eraser' ? 'bigEraser' : null;
    if (!id || e.dropped) return;
    e.dropped = true;
    const h = e.fig.j.handR;
    this.pickups.drop(id, h.x, Math.max(h.y, 0.6), h.z);
  }

  onCrime(kind, x, z) {
    this.police.crime(kind, x, z);
  }

  onCivilianHurt(c) {
    this.onCrime('hurtCiv', c.pos.x, c.pos.z);
  }

  onCivilianKilled(c) {
    this.onCrime('killCiv', c.pos.x, c.pos.z);
  }

  // where the city simulation centres itself (in the bar: its street door)
  anchorPos() {
    const p = this.player;
    return p.inVehicle ? p.inVehicle.pos : p.pos;
  }

  // ------------------------------------------------------------------ main loop
  renderFrame() {
    // the sun's box follows a point ahead of the camera
    const c = this.camera.position;
    const f = this.camera.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
    this._sc = this._sc || new THREE.Vector3();
    pickLights(c);
    if (this.world.cull) this.world.cull(c);
    this.world.sky.position.copy(c);
    this.pipe.render(this._sc.set(c.x + f.x * 35, 0, c.z + f.z * 35));
  }

  loop() {
    if (this.params.has('test')) {
      window.__test = { buildWeaponModel, WEAPON_DEFS, BLUEPRINTS };
      window.__frame = (n = 1, dt = 1 / 30) => {
        this.perf.frameStart();
        for (let i = 0; i < n; i++) this.update(dt);
        this.perf.afterUpdate();
        this.renderFrame();
        this.perf.frameEnd(dt);
        return true;
      };
      window.__frame(1);
      return;
    }
    // the drawing keeps its pace: its own resolution follows how long the frames take, with
    // some patience both ways. The screen's own refresh caps how fast a frame can come (16.7 ms
    // at 60 Hz), so keeping up with it counts as fast: a drawing that had to get coarser for a
    // busy moment (an explosion, a chase) gets its sharpness back once the moment has passed.
    const pipe = this.pipe;
    let acc = 0;
    let n = 0;
    let slow = 0;
    let fast = 0;
    let settle = 3;
    // the scale that was last too slow, and when (it is not tried again for a while)
    let ceiling = Infinity;
    let ceilingAt = -1e9;
    const tick = () => {
      const raw = this.clock.getDelta();
      const dt = Math.min(raw, 0.05);
      const perf = this.perf;
      perf.frameStart();
      this.update(dt);
      perf.afterUpdate();
      this.renderFrame();
      perf.frameEnd(raw);
      // (the test route is measured at the drawing's full quality: the resolution waits)
      if (this.state === 'play' && !perf.bench) {
        acc += raw;
        n++;
      }
      if (acc > 1.0) {
        const ms = (acc / n) * 1000;
        if (settle > 0) settle--;
        else {
          // slow: under 40 frames a second; fast: keeping up with a 60 Hz screen
          slow = ms > 25 ? slow + 1 : 0;
          fast = ms < 18.5 ? fast + 1 : 0;
          const now = this.time;
          const cap = now - ceilingAt < 40 ? Math.min(pipe.maxScale, ceiling - 0.05) : pipe.maxScale;
          if (slow >= 2 && pipe.scale > pipe.minScale) {
            ceiling = pipe.scale;
            ceilingAt = now;
            pipe.scale = Math.max(pipe.minScale, pipe.scale - 0.1);
            slow = 0;
            fast = 0;
            settle = 2;
          } else if (fast >= 3 && pipe.scale < cap - 0.001) {
            pipe.scale = Math.min(cap, pipe.scale + 0.05);
            fast = 0;
            settle = 1;
          }
        }
        acc = 0;
        n = 0;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  update(dt) {
    const playing = this.state === 'play' || this.state === 'dead';
    if (this.state === 'paused') dt = 0;
    this.time += dt;
    shared.uTime.value = this.time;
    if (this.weather) this.weather.update(dt);
    if (this.daynight) this.daynight.update(dt);
    if (this.rhythm) this.rhythm.update();
    if (this.shutters) this.shutters.update(dt);
    if (this.boilOn) shared.uBoil.value = Math.floor(this.time * 5);
    this.ambient.update(dt);
    if (this.world.update) this.world.update(dt, this.time);
    const input = this.input;
    const player = this.player;
    const fr = this.figures;
    // dynamic ink (figures, projectiles, particles, beams) is rebuilt every running frame
    if (dt > 0) fr.begin(this.camera);
    if (playing) this.handleKeys();
    const look = input.consumeLook();
    if (playing && !this.airdraw.open) {
      this.camRig.applyLook(look.x, look.y);
      if (look.x || look.y) this.lastLookInput = this.time;
    }
    if (dt > 0) {
      player.update(dt, input, this.camRig, this.weapons);
      this.chute.update(dt);
      this.vehicles.update(dt);
      this.materialize.update(dt);
      this.weapons.update(dt);
      this.enemies.update(dt);
      this.civilians.update(dt);
      this.streetlife.update(dt);
      this.nightlife.update(dt);
      this.vignettes.update(dt);
      this.airsketch.update(dt);
      this.traffic.update(dt);
      this.world.objects.update(dt, this.world.bakeShadows, this.camera.position);
      this.police.update(dt);
      this.pickups.update(dt);
      this.inkwell.update(dt);
      this.updateHidden();
    }
    // camera
    if (this.state === 'title' && !this.freeCam) {
      // behind the title page: drifting slowly up the first boulevard, into the sunset
      const z = -20 + Math.sin(this.time * 0.025) * 70;
      this.camera.position.set(14.5 + Math.sin(this.time * 0.05) * 2, 7.5 + Math.sin(this.time * 0.04) * 1.5, z);
      this.camera.lookAt(1, 4.5, z - 70);
    } else if (this.freeCam && this.state !== 'play') {
      const v = this.freeCam;
      this.camera.position.set(v[0], v[1], v[2]);
      this.camera.rotation.set(v[4] || 0, v[3] || 0, 0, 'YXZ');
    } else if (player.inVehicle) {
      const v = player.inVehicle;
      if (v.kind === 'car' && this.time - this.lastLookInput > 1.2 && Math.abs(v.speed) > 2) {
        // drift the camera behind the car
        const want = v.yaw + (v.speed < 0 ? Math.PI : 0);
        let d = want - this.camRig.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.camRig.yaw += d * (1 - Math.exp(-2.5 * dt));
      }
      const opt = v.kind === 'tank' ? { dist: 11, height: 3.4, shoulder: 0 } : v.kind === 'copter' ? { dist: 13, height: 3.2, shoulder: 0 } : v.kind === 'bike' ? { dist: 5.2, height: 2.2, shoulder: 0, fovMul: 1 + Math.min(0.2, v.speedAbs / 150) } : { dist: 8.5, height: 3.1, shoulder: 0, fovMul: 1 + Math.min(0.15, v.speedAbs / 200) };
      this.camRig.update(dt, v.pos, opt);
    } else {
      if (this.airdraw.open) this.camRig.update(dt, player.pos, this.airdraw.camOpts);
      else if (this.chute.open) this.camRig.update(dt, player.pos, { height: 2.6, dist: 8.5, shoulder: 0 });
      else this.camRig.update(dt, player.pos, { aim: this.weapons.current.def.kind === 'gun' && input.aim, height: 1.62 - player.fig.sit * 0.7, dist: this.player.indoor ? 2.6 : 3.3 });
    }
    const tipsy = this.inkwell.tipsy;
    if (tipsy > 0.05 && this.state === 'play') {
      // a few drinks in: the page sways
      this.camera.rotation.z += Math.sin(this.time * 1.1) * 0.045 * tipsy;
      this.camera.rotation.x += Math.sin(this.time * 0.7 + 1) * 0.02 * tipsy;
    }
    // the opening: the camera comes down out of the page into the street
    if (this.params.has('test') && window.__camOverride) {
      // test hook: fixed camera for screenshots
      const o = window.__camOverride;
      this.camera.position.set(o.pos[0], o.pos[1], o.pos[2]);
      this.camera.lookAt(o.look[0], o.look[1], o.look[2]);
    }
    // the performance test route drives the camera (and the city's life follows it)
    if (this.perf.bench) this.perf.benchCamera(dt);
    this.camera.updateMatrixWorld();
    this.bubbles.update(dt, this.camera);
    if (this.onFrame) this.onFrame(dt);
    this.airdraw.frame(dt);
    // render dynamic figures
    if (dt > 0) {
      if (!this.perf.bench) player.draw(this.camera.position);
      this.weapons.updateModels();
      this.enemies.draw(this.camera.position);
      this.civilians.draw(this.camera.position);
      this.streetlife.draw(fr);
      this.vignettes.draw(fr);
      this.airsketch.render(fr);
      this.traffic.draw(this.camera.position);
      this.signals.draw(this.camera.position);
      this.vehicles.draw(this.cars);
      this.cars.end();
      this.drawStuckPencils(fr);
      this.ambient.draw(fr);
      this.chute.draw(fr);
      this.pickups.draw(fr);
      this.weather.draw(fr);
      this.fx.update(dt, fr);
      fr.end();
    }
    this.focus.copy(player.inVehicle ? player.inVehicle.pos : player.pos);
    if (this.state !== 'title') this.hud.update(dt);
    this.updatePrompts();
    this.audio.tick();
    if (this.soundscape) this.soundscape.update(dt);
    input.endFrame();
  }

  handleKeys() {
    const input = this.input;
    const p = this.player;
    if (this.dialog.open) {
      this.dialog.update();
      return;
    }
    if (input.wasPressed('Escape')) {
      if (this.album.open) this.album.hide();
      else if (!this.airdraw.open && this.state === 'play') this.pause();
      return;
    }
    if (this.state !== 'play') return;
    if (input.wasPressed('KeyF')) this.takePhoto();
    if (input.wasPressed('KeyQ') || input.wasPressed('KeyT')) this.openDraw();
    if (input.wasPressed('KeyE')) {
      if (p.inVehicle) this.exitVehicle();
      else if (p.mode === 'foot' && !this.streetlife.interact()) this.tryEnter();
    }
    if (input.wasPressed('KeyM')) this.hud.mapScale = this.hud.mapScale > 1 ? 0.55 : 1.1;
  }

  // ------------------------------------------------------------------ hiding
  updateHidden() {
    const p = this.player;
    if (!this.goalFlags.bar) {
      if (this.barRoom === undefined) {
        const s = (this.world.shops || []).find((sh) => sh.kind === 'bar');
        this.barRoom = s && s.room && s.room.inside ? s.room : null;
      }
      if (this.barRoom && !p.inVehicle && this.barRoom.inside(p.pos.x, p.pos.z, 0)) {
        this.goalFlags.bar = true;
        this.updateGoals();
        this.hud.toast('ברוכים הבאים ל-Neon Bar!', 'good', 2.2);
      }
    }
    let spot = null;
    if (!p.inVehicle && p.mode !== 'dead') {
      const hs = this.world.hideSpots;
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i];
        if (!h.gone && Math.hypot(p.pos.x - h.x, p.pos.z - h.z) < h.r) {
          spot = h;
          break;
        }
      }
    }
    let close = false;
    if (spot) {
      const es = this.enemies.list;
      for (let i = 0; i < es.length; i++) {
        const e = es[i];
        if (e.alive && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 3.2) close = true;
      }
    }
    const was = p.hidden;
    p.hidden = !!spot && !close;
    p.hideSpot = spot;
    if (p.hidden && !was) {
      if (!this.goalFlags.hidden) {
        this.goalFlags.hidden = true;
        this.updateGoals();
      }
    }
    // show eye markers near the player
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    for (const m of this.fx.marks) {
      if (!m.spot) continue;
      const d = Math.hypot(m.x - pp.x, m.z - pp.z);
      m.visible = d < 32 && d > 1.5 && !m.spot.gone;
      m.y = 2.4 + Math.sin(this.time * 2 + m.x) * 0.1;
      m.alpha = clamp(1 - (d - 20) / 12, 0, 0.85);
    }
  }

  // ------------------------------------------------------------------ photos
  photoTarget() {
    const cam = this.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null;
    let bestScore = 0;
    for (const b of this.world.billboards) {
      const dx = b.x - cam.position.x;
      const dy = b.y - cam.position.y;
      const dz = b.z - cam.position.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 85) continue;
      // in view: within ~25 degrees of the centre, more when the board fills the frame
      const cos = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
      if (Math.acos(Math.min(1, cos)) > 0.45 + Math.atan2(b.w * 0.5, d) * 0.8) continue;
      const facing = -(dx * b.nx + dz * b.nz) / Math.hypot(dx, dz);
      if (facing < 0.15) continue;
      if (!this.boardVisible(b)) continue;
      const sc = cos * 2 + facing - d / 120;
      if (sc > bestScore) {
        bestScore = sc;
        best = b;
      }
    }
    return best;
  }

  // Some part of the board (centre or an inset corner) is not hidden behind a building.
  boardVisible(b) {
    const c = this.camera.position;
    const col = this.world.collision;
    for (const [u, v] of BOARD_SAMPLES) {
      const dx = b.x + b.rx * b.w * u - c.x;
      const dy = b.y + b.h * v - c.y;
      const dz = b.z + b.rz * b.w * u - c.z;
      const d = Math.hypot(dx, dy, dz);
      if (!col.raycast(c.x, c.y, c.z, dx, dy, dz, d - 0.6, PHOTO_SEE_THROUGH)) return true;
    }
    return false;
  }

  takePhoto() {
    if (this.player.mode !== 'foot' && !this.player.inVehicle) return;
    const flash = $('flash');
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    this.audio.play('shutter');
    const b = this.photoTarget();
    if (!b) {
      this.hud.toast('אין פה שרטוט לצלם — כוונו אל שלט שרטוט', 'info');
      return;
    }
    const bp = BLUEPRINTS[b.id];
    const isNew = this.album.add(b.id);
    // polaroid animation
    const pop = $('photo-pop');
    const c = pop.querySelector('canvas');
    const g = c.getContext('2d');
    g.fillStyle = '#f7f4ec';
    g.fillRect(0, 0, c.width, c.height);
    import('./blueprints.js').then(({ drawBlueprint }) => drawBlueprint(g, bp, 0, 0, c.width, c.height, { pad: 0.1, width: 3 }));
    pop.querySelector('.caption').textContent = bp.name;
    pop.classList.remove('hidden');
    const pol = pop.querySelector('.polaroid');
    pol.style.animation = 'none';
    void pol.offsetWidth;
    pol.style.animation = '';
    clearTimeout(this.popT);
    this.popT = setTimeout(() => pop.classList.add('hidden'), 2300);
    // the polaroid flies into the pencil button (that's where your photos are now)
    const btn = $('btn-draw');
    if (this.touch && btn.offsetParent) {
      const r = btn.getBoundingClientRect();
      pol.style.setProperty('--fly-x', `${r.left + r.width / 2 - window.innerWidth / 2}px`);
      pol.style.setProperty('--fly-y', `${r.top + r.height / 2 - window.innerHeight / 2}px`);
    }
    if (isNew) {
      this.hud.toast(this.touch ? `שרטוט חדש באלבום: ${bp.name}! לחצו על העיפרון ✏ כדי לצייר אותו באוויר` : `שרטוט חדש באלבום: ${bp.name}! לחצו Q כדי לצייר`, 'good', 3.8);
      if (b.id === 'paint') this.goalFlags.photo = true;
      if (b.id === 'car') this.goalFlags.car = true;
      if (b.id === 'tank' || b.id === 'copter') this.goalFlags.heavy = true;
      this.updateGoals();
    } else this.hud.toast(`${bp.name} כבר באלבום`, 'info');
  }

  // ------------------------------------------------------------------ drawing
  openDraw() {
    const p = this.player;
    if (p.inVehicle) {
      this.hud.toast('צריך לצאת מהרכב כדי לצייר', 'info');
      return;
    }
    if (p.mode !== 'foot') return;
    if (this.album.size === 0) {
      this.hud.toast(this.touch ? 'האלבום ריק — קודם מצלמים שלט עם שרטוט (כפתור המצלמה ליד שלט)' : 'האלבום ריק — קודם מצלמים שלט עם שרטוט (F)', 'info', 3);
      return;
    }
    this.input.releaseLock();
    if (ALL_OPEN) {
      // the whole library is open: pick what to draw
      this.album.show(
        (id) => this.beginDrawing(id),
        () => {
          if (!this.touch && this.state === 'play' && !this.airdraw.open) this.input.requestLock();
        },
      );
      return;
    }
    // straight into the air with the newest photo; the arrows on the reference switch photos
    const ids = this.album.ids();
    this.beginDrawing(this.album.has(this.drawPick) ? this.drawPick : ids[ids.length - 1]);
  }

  onAlbumAdd(id) {
    this.drawPick = id;
    this.nudgeDraw = true;
    if (this.touch && !this.drewOnce) {
      const hint = $('draw-hint');
      hint.classList.remove('hidden');
      clearTimeout(this.hintT);
      this.hintT = setTimeout(() => hint.classList.add('hidden'), 9000);
    }
  }

  beginDrawing(id) {
    const p = this.player;
    if (p.mode !== 'foot' || this.chute.open) return;
    p.mode = 'draw';
    p.vel.set(0, 0, 0);
    this.nudgeDraw = false;
    this.drewOnce = true;
    $('draw-hint').classList.add('hidden');
    this.airdraw.show(id);
    if (!p.hidden) this.hud.toast('זהירות — לא מוסתרים! האויבים ימשיכו לתקוף', 'bad', 2.2);
  }

  onDrawClosed() {
    if (this.player.mode === 'draw') this.player.mode = 'foot';
  }

  // plan: what the drawing became and where (game/materialize.js), the strokes landed on it
  onDrawingDone(bp, res, strokes, plan = null) {
    const p = this.player;
    if (p.mode === 'draw') p.mode = 'foot';
    this.album.recordGrade(bp.id, res.score);
    const grade = res.grade;
    const msg = GRADE_TEXT[grade](bp.name);
    // (what the drawing became is said once it is all there, not over the show)
    const said = [];
    const say = (...a) => (plan ? said.push(a) : this.hud.toast(...a));
    const onReal = () => said.forEach((a) => this.hud.toast(...a));
    say(msg, grade === 'fail' ? 'bad' : grade === 'wonky' ? 'info' : 'good', 3.2);
    // a thing that flies to the hero once it is real (the plaster, the parachute)
    const toHero = (where, then) => {
      if (!plan || !plan.model) return then();
      const root = plan.model.group;
      root.matrixAutoUpdate = false;
      root.matrix.copy(plan.frame.matrix);
      root.matrixWorldNeedsUpdate = true;
      this.scene.add(root);
      this.materialize.begin({ frame: plan.frame, root, toHero: where, onArrive: then, onReal });
    };
    if (bp.kind === 'heal') {
      toHero('chest', () => {
        // the giant band-aid: every rubbed-out spot fills back in
        const q = { perfect: 1, good: 1, wonky: 0.7, fail: 0.35 }[grade];
        p.hp = Math.min(p.maxHp, Math.max(p.hp, p.maxHp * q));
        if (q >= 1) p.fig.holes.length = 0;
        else p.fig.holes.length = Math.floor(p.fig.holes.length * 0.5);
        this.hud.toast(q >= 1 ? 'הפלסטר הענק סגר את כל החורים — חיים מלאים!' : 'הפלסטר עקום… אבל עזר קצת', q >= 1 ? 'good' : 'info', 2.8);
        this.audio.play('cheer');
      });
    } else if (bp.kind === 'gear') {
      toHero('back', () => {
        // the parachute: on your back from now on
        p.parachute = { grade };
        this.hud.toast(this.touch ? 'יש לכם מצנח! קפצו מהמסוק בגובה — הוא ייפתח לבד, או לחצו על כפתור הקפיצה' : 'יש לכם מצנח! קפצו מהמסוק בגובה — הוא ייפתח לבד, או לחצו רווח', 'good', 4);
        this.audio.play('cheer');
      });
    } else if (bp.kind === 'weapon') {
      const def = WEAPON_DEFS[bp.id];
      const model = plan && plan.model ? plan.model : buildWeaponModel(bp.id, grade, { seed: res.score });
      this.weapons.add(def, grade, model, res.score);
      const slot = this.weapons.current;
      slot.strokes = strokes;
      if (plan) {
        // it hangs in the air where it was drawn, turns real, then flies into the hand
        slot.present = { matrix: plan.frame.matrix.clone(), k: 0 };
        this.materialize.begin({ frame: plan.frame, root: model.group, held: slot, onReal });
      } else slot.popAt = this.time;
      this.hud.updateWeapon();
    } else {
      let v;
      if (plan && plan.vehicle) {
        v = this.vehicles.add(plan.vehicle);
        this.materialize.begin({ frame: plan.frame, root: v.kind === 'car' ? null : v.group, car: v.kind === 'car' ? v : null, vehicle: v, onReal });
      } else v = this.vehicles.spawn(bp.id, grade, res.score);
      say(this.touch ? `לחצו על כפתור הרכב הירוק כדי להיכנס ל${bp.name}` : `לחצו E כדי להיכנס ל${bp.name}`, 'info', 3);
      v.strokes = strokes;
      if (bp.id === 'car') this.goalFlags.car = true;
    }
    this.goalFlags.drew = true;
    if (bp.id === 'tank' || bp.id === 'copter') this.goalFlags.heavyDrawn = true;
    this.updateGoals();
    if (!plan) this.fx.crumbs(p.pos.x, p.pos.y + 1, p.pos.z, 16, 3);
    if (!this.touch) setTimeout(() => this.input.requestLock(), 50);
  }

  // ------------------------------------------------------------------ vehicles
  // what E would get you into right now: { kind, target, label }
  enterTarget() {
    const p = this.player;
    const v = this.vehicles.nearest(p.pos, 3.2);
    if (v) return { kind: 'vehicle', target: v, label: v.label || BLUEPRINTS[v.kind].name };
    const c = this.traffic.nearestDoor(p.pos, 1.7);
    if (c && !c.wrecked) {
      const s = c.spec;
      return { kind: c.parkedCar ? 'parked' : 'carjack', target: c, label: s.police ? 'ניידת' : s.taxi ? 'מונית' : s.kind === 'van' ? 'טנדר' : 'מכונית' };
    }
    return null;
  }

  tryEnter() {
    const t = this.enterTarget();
    if (!t) return;
    if (t.kind === 'vehicle') this.enterVehicle(t.target);
    else if (t.kind === 'carjack') this.carjack(t.target);
    else this.stealParked(t.target);
  }

  // pull the driver out of a car in traffic and drive off with it
  carjack(c) {
    if (Math.abs(c.speed) > 7.5) {
      this.hud.toast('המכונית נוסעת מהר מדי — עמדו מולה כדי שתעצור', 'info', 2.2);
      return;
    }
    const t = this.traffic.take(c);
    const v = this.vehicles.spawnStock(t.spec, t.pos, t.yaw);
    if (t.driver) this.ejectDriver(t.driver, t.pos, t.yaw, true);
    if (t.police) {
      this.onCrime('copcar', t.pos.x, t.pos.z);
      if (t.crew && t.crew.length) {
        const fx = Math.sin(t.yaw);
        const fz = Math.cos(t.yaw);
        t.crew.forEach((m, i) => {
          const side = i === 0 ? 1 : -1;
          if (m.fig) m.fig.dispose();
          this.enemies.spawnOfficer(m.type, t.pos.x + fz * side * 1.9, t.pos.z - fx * side * 1.9, m.look, this.player.pos);
        });
      }
    }
    this.audio.play('punch', 0.6);
    this.enterVehicle(v);
    if (!t.police) this.onCrime('carjack', t.pos.x, t.pos.z);
  }

  // drive off with a car parked at the curb
  stealParked(c) {
    const t = this.traffic.take(c);
    const cx = t.pos.x;
    const cz = t.pos.z;
    const v = this.vehicles.spawnStock(t.spec, t.pos, t.yaw);
    this.enterVehicle(v);
    if (Math.random() < 0.45) {
      this.audio.play('alarm', 0.7);
      this.hud.toast('אזעקה! מישהו בטח שמע…', 'bad', 1.8);
      this.enemies.noise(v.pos, 35, 'alarm');
    }
    if (this.onCrime) this.onCrime('steal', cx, cz);
  }

  // the driver gets out on the left: runs off screaming, or (sometimes) wants the car back
  ejectDriver(d, pos, yaw, pulled) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = -fz;
    const rz = fx;
    const x = pos.x + fx * DRIVER_SEAT.u - rx * 1.7;
    const z = pos.z + fz * DRIVER_SEAT.u - rz * 1.7;
    if (d.fig) d.fig.dispose();
    if (pulled && Math.random() < 0.3) {
      this.enemies.spawnAngry(x, z, d.look);
    } else {
      const c = this.civilians.spawnAt(x, z, d.look);
      c.panicT = 9;
      c.fearX = pos.x;
      c.fearZ = pos.z;
      const lines = pulled ? ['Take it! Take it!', 'Help!! Thief!', 'Not my taxi!', 'Okay, okay!'] : ['Aaah!', 'What the...', 'My car!!'];
      this.bubbles.say(c, lines[Math.floor(Math.random() * lines.length)], 'alarm');
    }
  }

  enterVehicle(v) {
    const p = this.player;
    p.inVehicle = v;
    p.mode = 'vehicle';
    v.driver = p;
    p.fig.setVisible(!!v.seat);
    this.camRig.yaw = v.yaw;
    this.goalFlags.drove = true;
    this.updateGoals();
    this.audio.play('click');
    $('btn-up').classList.toggle('hidden', !v.flies);
    $('btn-down').classList.toggle('hidden', !v.flies);
  }

  exitVehicle(force = false) {
    const p = this.player;
    const v = p.inVehicle;
    if (!v) return;
    v.driver = null;
    p.inVehicle = null;
    p.mode = 'foot';
    p.fig.setVisible(true);
    p.fig.reachR = null;
    // step out on the left side (or wherever there is room)
    const fx = Math.sin(v.yaw);
    const fz = Math.cos(v.yaw);
    const cands = [[fz, -fx], [-fz, fx], [-fx, -fz], [fx, fz]];
    let placed = false;
    for (const [sx, sz] of cands) {
      const d = v.halfWid + 1.2;
      const x = v.pos.x + sx * d;
      const z = v.pos.z + sz * d;
      if (!this.world.collision.pointInside(x, 1, z, 0.4)) {
        p.pos.set(x, Math.max(0, v.flies ? v.pos.y : 0), z);
        placed = true;
        break;
      }
    }
    if (!placed) p.pos.set(v.pos.x, v.pos.y + 2, v.pos.z);
    p.vel.set(0, 0, 0);
    if (v.flies && v.alt > 3) {
      p.vel.y = 0;
      // out of the helicopter high over the city
      if (v.alt > 9) this.hud.toast(p.parachute ? 'קופצים! המצנח ייפתח בעוד רגע' : 'קפצתם בלי מצנח! (יש שלט של מצנח ליד המסוק)', p.parachute ? 'info' : 'bad', 2.6);
    }
    $('btn-up').classList.add('hidden');
    $('btn-down').classList.add('hidden');
    if (!force) this.audio.play('click');
  }

  // ------------------------------------------------------------------ combat helpers
  explosion(x, y, z, radius, damage, owner) {
    this.fx.boom(x, y, z, radius * 0.75);
    this.audio.play('boom', 0.9);
    const p = this.player;
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    const d = Math.hypot(pp.x - x, pp.z - z);
    this.camRig.addShake(clamp(1.2 - d / 40, 0.1, 1));
    this.enemies.explosion(x, y, z, radius, damage);
    this.civilians.explosion(x, y, z, radius);
    this.eraseBlast(x, y, z, radius, damage);
    this.traffic.explosion(x, z, radius);
    if (d < radius) p.hurt((owner === 'player' ? 0.25 : 1) * damage * 0.35 * (1 - d / radius), x, z);
    this.enemies.noise(new THREE.Vector3(x, y, z), 60, 'boom');
    this.civilians.panic(new THREE.Vector3(x, y, z), 60);
  }

  // the tank's glob of correction fluid bursts: a white splash over everything around, and what
  // it covers is wiped off the page (props crumble, walls open, cars vanish, people are rubbed
  // out where it lands on them)
  whiteOut(x, y, z, radius, damage, owner, hit = null) {
    const fx = this.fx;
    const W = [1.15, 1.15, 1.12];
    const gy = groundHeight(x, z) + 0.02;
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.4;
      fx.decal(Math.random() < 0.5 ? 'splat0' : 'splat1', x + Math.cos(a) * r, gy + 0.01 * i, z + Math.sin(a) * r, radius * (1.25 - i * 0.22), W, 0.95, [1, 0, 0], [0, 0, -1]);
    }
    if (hit && hit.nx !== undefined && Math.abs(hit.ny || 0) < 0.7) fx.splatAt(x, y, z, hit.nx, hit.ny, hit.nz, radius * 0.9, W);
    fx.splash(x, y + 0.3, z, 46, radius * 1.3, [1, 1, 0.98]);
    fx.crumbs(x, y + 0.5, z, 24, radius);
    this.audio.play('splat', 1);
    this.audio.play('boom', 0.45);
    const p = this.player;
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    const d = Math.hypot(pp.x - x, pp.z - z);
    this.camRig.addShake(clamp(0.8 - d / 50, 0.05, 0.6));
    this.enemies.explosion(x, y, z, radius, damage);
    this.civilians.explosion(x, y, z, radius);
    this.eraseBlast(x, y, z, radius * 1.15, damage * 1.2);
    this.traffic.whiteOut(x, y, z, radius + 1.5, damage * 1.3);
    if (d < radius * 0.6 && !p.inVehicle) p.hurt((owner === 'player' ? 0.15 : 0.8) * damage * 0.3 * (1 - d / radius), x, z);
    this.enemies.noise(new THREE.Vector3(x, y, z), 60, 'boom');
    this.civilians.panic(new THREE.Vector3(x, y, z), 60);
    if (this.onCrime) this.onCrime('vandal', x, z);
  }

  // ------------------------------------------------------------------ rubbing out the world
  // A spot of the drawing at (x, y, z) is rubbed back to blank paper; a prop hit there loses
  // ink and crumbles away when it runs out.
  eraseWorld(x, y, z, r, rub, box, hit) {
    const objs = this.world.objects;
    const o = box ? objs.ofBox(box) : null;
    if (o) {
      if (objs.rub(o, rub)) this.onPropErased(o);
    } else if (box && box.tag === 'bound') return;
    // sit the spot a little inside the surface so the rim wraps around corners
    const k = hit && hit.nx !== undefined ? 0.12 : 0;
    const spot = objs.addSpot(x - (hit ? hit.nx || 0 : 0) * k, y - (hit ? hit.ny || 0 : 0) * k, z - (hit ? hit.nz || 0 : 0) * k, r);
    this.fx.crumbs(x, y, z, 10, 2.4);
    // a wall with a room behind it: rubbed through far enough, you can step inside
    if (box && box.tag === 'roomwall' && spot && openWall(this.world.collision, this.world.nav, box, spot)) {
      if (!this.wallTip) {
        this.wallTip = true;
        this.hud.toast('מחקת חור בקיר — אפשר להיכנס פנימה!', 'good', 2.6);
      }
      this.audio.play('crumble', 0.7);
    }
  }

  onPropErased(o) {
    const cx = (o.x0 + o.x1) / 2;
    const cz = (o.z0 + o.z1) / 2;
    this.fx.crumbs(cx, Math.min(2, o.y1 * 0.5), cz, 40, 3.6);
    this.fx.smoke(cx, Math.min(2, o.y1 * 0.5), cz, 1.6);
    this.audio.play('crumble', 1);
    if (this.onCrime) this.onCrime('vandal', cx, cz);
  }

  // big rub: everything in the radius loses ink, the middle is wiped to paper
  eraseBlast(x, y, z, radius, power) {
    const objs = this.world.objects;
    for (const o of objs.within(x, z, radius, this._objs || (this._objs = []))) {
      const d = Math.hypot((o.x0 + o.x1) / 2 - x, (o.z0 + o.z1) / 2 - z);
      if (objs.rub(o, power * (1.2 - Math.min(1, d / radius)))) this.onPropErased(o);
    }
    const spot = objs.addSpot(x, y, z, radius * 0.55);
    // a blast against the front of a house blows a doorway into it
    if (spot) {
      const col = this.world.collision;
      const walls = [];
      col.forEachIn(x - spot.r, z - spot.r, x + spot.r, z + spot.r, (b) => {
        if (b.tag === 'roomwall') walls.push(b);
      });
      for (const b of walls) openWall(col, this.world.nav, b, spot);
    }
  }

  playerSegmentHit(ox, oy, oz, dx, dy, dz, maxT) {
    const p = this.player;
    if (p.mode === 'dead') return null;
    const len2 = dx * dx + dz * dz;
    if (p.inVehicle) {
      const v = p.inVehicle;
      let t = len2 > 1e-8 ? ((v.pos.x - ox) * dx + (v.pos.z - oz) * dz) / len2 : 0;
      t = clamp(t, 0, maxT);
      const hx = ox + dx * t - v.pos.x;
      const hz = oz + dz * t - v.pos.z;
      const hy = oy + dy * t - v.pos.y;
      if (Math.hypot(hx, hz) < v.radius && hy > -0.5 && hy < v.heightM + 0.5) return { t };
      return null;
    }
    let t = len2 > 1e-8 ? ((p.pos.x - ox) * dx + (p.pos.z - oz) * dz) / len2 : 0;
    t = clamp(t, 0, maxT);
    const hx = ox + dx * t - p.pos.x;
    const hz = oz + dz * t - p.pos.z;
    const hy = oy + dy * t - p.pos.y;
    const h = p.mode === 'draw' ? 1.1 : 1.85;
    if (Math.hypot(hx, hz) < 0.45 && hy > 0 && hy < h) return { t };
    return null;
  }

  stuckPencil(x, y, z, dx, dy, dz) {
    this.stuck.push({ x, y, z, dx, dy, dz, seed: Math.random() * 100 });
    if (this.stuck.length > 40) this.stuck.shift();
  }

  drawStuckPencils(fr) {
    for (const s of this.stuck) {
      const L = 0.5;
      // eraser end in the wall, pencil sticking out
      fr.lineXYZ(s.x, s.y, s.z, s.x - s.dx * L, s.y - s.dy * L, s.z - s.dz * L, [0.86, 0.72, 0.3], 5, s.seed, 1, 0.01, 0);
      fr.lineXYZ(s.x - s.dx * L, s.y - s.dy * L, s.z - s.dz * L, s.x - s.dx * (L + 0.1), s.y - s.dy * (L + 0.1), s.z - s.dz * (L + 0.1), [0.2, 0.2, 0.24], 3, s.seed + 1, 1, 0.01, 0);
    }
  }

  // ------------------------------------------------------------------ prompts & goals
  updatePrompts() {
    if (this.state !== 'play') {
      this.hud.setPrompt('');
      return;
    }
    const p = this.player;
    let prompt = '';
    let photo = false;
    let enter = false;
    if (p.inVehicle) {
      enter = true;
      prompt = this.touch ? '' : p.inVehicle.kind === 'copter' ? 'רווח/C — למעלה/למטה · קליק — מטוסי נייר · E — לצאת' : p.inVehicle.kind === 'tank' ? 'קליק — ירי · E — לצאת' : 'E — לצאת';
    } else if (p.mode === 'foot' && this.streetlife.target()) {
      const sh = this.streetlife.target();
      enter = sh.shop.open;
      prompt = this.touch ? sh.label.replace('E — ', '') : sh.label;
    } else if (p.mode === 'foot') {
      const et = this.enterTarget();
      if (et) {
        enter = true;
        const verb = et.kind === 'carjack' ? 'לחטוף את ה' : et.kind === 'parked' ? 'לגנוב את ה' : 'להיכנס ל';
        prompt = this.touch ? '' : `E — ${verb}${et.label}`;
      } else {
        const b = this.photoTarget();
        if (b) {
          photo = true;
          prompt = this.album.has(b.id) ? `${BLUEPRINTS[b.id].name} כבר באלבום` : this.touch ? 'לצלם את השרטוט' : 'F — לצלם את השרטוט';
        } else if (p.hidden && this.album.size) {
          prompt = this.touch ? 'מוסתרים — זה הזמן לצייר' : 'מוסתרים — Q כדי לצייר';
        }
      }
    }
    this.hud.setPrompt(prompt);
    if (this.touch) {
      $('btn-photo').classList.toggle('hidden', !photo);
      $('btn-enter').classList.toggle('hidden', !enter);
      // the pencil: how many photos you carry, and a wiggle when one is waiting to be drawn
      const n = this.album.size;
      const key = `${n}|${this.nudgeDraw}`;
      if (key !== this.drawBtnKey) {
        this.drawBtnKey = key;
        const btn = $('btn-draw');
        btn.classList.toggle('empty', n === 0);
        btn.classList.toggle('nudge', this.nudgeDraw && n > 0);
        const badge = btn.querySelector('.badge');
        badge.textContent = n;
        badge.classList.toggle('hidden', n === 0);
      }
    }
  }

  updateGoals() {
    const f = this.goalFlags;
    const all = [
      { text: this.touch ? 'לצלם את השרטוט של אקדח הצבע בטיילת, ממול (מצלמה)' : 'לצלם את השרטוט של אקדח הצבע בטיילת, ממול (F)', done: f.photo },
      { text: 'להתחבא ליד תא טלפון, פח אשפה או שיח', done: f.hidden },
      { text: this.touch ? 'לצייר את אקדח הצבע (עיפרון)' : 'לצייר את אקדח הצבע (Q)', done: f.drew },
      { text: 'לקפוץ ל-Neon Bar (בשדרה הראשונה, כמה דלתות צפונה)', done: f.bar },
      { text: `למחוק 5 עבריינים — הם מסתובבים בסמטה מאחורי החנויות (${Math.min(5, f.kills)}/5)`, done: f.kills >= 5 },
      { text: 'למצוא את שרטוט המכונית בחניה של מוטל הכוכב (מערבה)', done: f.car },
      { text: this.touch ? 'לצייר מכונית ולנהוג בה' : 'לצייר מכונית ולנהוג בה (E)', done: f.drove },
      { text: 'להשיג שרטוט טנק (מרכז העיר) או מסוק (בקצה המזח)', done: f.heavy },
      { text: 'לצייר טנק או מסוק', done: f.heavyDrawn },
    ];
    const firstOpen = all.findIndex((g) => !g.done);
    const start = Math.max(0, (firstOpen < 0 ? all.length : firstOpen) - 1);
    this.hud.setGoals(all.slice(start, start + 3));
  }
}

export { GRADE };
