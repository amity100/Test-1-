import * as THREE from 'three';
import { shared } from '../render/materials.js';
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { CameraRig } from './camera.js';
import { FigureRenderer } from './figure.js';
import { Effects } from './fx.js';
import { Player } from './player.js';
import { Weapons, WEAPON_DEFS, GRADE } from './weapons.js';
import { Enemies } from './enemies.js';
import { Vehicles } from './vehicles.js';
import { Civilians } from './civilians.js';
import { Traffic } from './traffic.js';
import { HUD } from '../ui/hud.js';
import { Album } from '../ui/album.js';
import { AirDraw } from '../ui/airdraw.js';
import { Bubbles } from '../ui/bubbles.js';
import { Police } from './police.js';
import { Inkwell } from './inkwell.js';
import { Dialog } from '../ui/dialog.js';
import { Pickups } from './pickups.js';
import { AirSketches } from './airsketch.js';
import { StreetLife } from './streetlife.js';
import { Vignettes } from './vignettes.js';
import { DayNight, savedMagic } from './daynight.js';
import { LightMap } from '../render/lightmap.js';
import { NightLights } from '../render/nightlights.js';
import { Weather } from './weather.js';
import { Ambient } from './ambient.js';
import { Intro } from './intro.js';
import { BLUEPRINTS } from './blueprints.js';
import { CAR_VARIANTS, DRIVER_SEAT } from './traffic.js';
import { rebakeSunShadows } from '../render/sunlight.js';
import { buildDrawnFlatModel } from './items.js';
import { openWall } from '../world/interiors.js';
import { BLACK_INK } from '../render/LineBatch.js';
import { clamp } from '../core/util.js';

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
    const { scene, camera, world, mats } = this;
    mats.itemSurface = mats.itemSurface || mats.surface;
    this.input = new Input(this.renderer.domElement, this.touch);
    this.audio = new Audio();
    // the magic world: day and night, the districts' artists, glow (off = the original look)
    this.daynight = new DayNight(this);
    this.lightmap = new LightMap(world);
    this.nightlights = new NightLights(scene, world);
    const mp = this.params.get('magic');
    this.daynight.setMagic(mp !== null ? mp !== '0' : savedMagic());
    const tp0 = this.params.get('time');
    if (tp0) this.daynight.setMode(tp0);
    this.camRig = new CameraRig(camera, world.collision);
    this.figures = new FigureRenderer(scene, this.atlas);
    this.bubbles = new Bubbles(this.pipe.overlay);
    this.fx = new Effects(this);
    this.vehicles = new Vehicles(this);
    this.traffic = new Traffic(this);
    this.player = new Player(this);
    this.civilians = new Civilians(this);
    this.enemies = new Enemies(this);
    this.weapons = new Weapons(this);
    this.hud = new HUD(this);
    this.police = new Police(this);
    this.pickups = new Pickups(this);
    this.inkwell = new Inkwell(this);
    this.dialog = new Dialog(this);
    this.inBar = false;
    // the outlines redrawn a few times a second: lively on a big screen, calm on a phone
    this.boilOn = !this.touch;
    this.album = new Album(this);
    this.album.onAdd = (id) => this.onAlbumAdd(id);
    this.airdraw = new AirDraw(this);
    this.airsketch = new AirSketches(this);
    this.streetlife = new StreetLife(this);
    this.vignettes = new Vignettes(this);
    this.weather = new Weather(this);
    this.ambient = new Ambient(this);
    this.intro = new Intro(this);
    const wp0 = this.params.get('weather');
    if (wp0) {
      this.weather.setMode(wp0);
      this.weather.snap();
    }
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
    this.updateGoals();
    this.hud.updateWeapon();
    this.bindUI();
    const ip = this.params.get('intro');
    if (this.daynight.on && ip !== '0' && (!this.params.has('autostart') || ip === '1')) this.intro.showDesk();
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
    $('opt-time').value = this.daynight.mode;
    $('opt-time').addEventListener('change', (e) => this.daynight.setMode(e.target.value));
    $('opt-weather').value = this.weather.mode;
    $('opt-weather').addEventListener('change', (e) => this.weather.setMode(e.target.value));
    $('opt-sens').addEventListener('input', (e) => (this.input.sensitivity = parseFloat(e.target.value)));
    this.input.on('lock', (locked) => {
      if (!locked && this.state === 'play' && !this.airdraw.open && !this.album.open && !this.dialog.open && !this.dialog.justClosed && !this.inkwell.flipping && !this.touch && !this.input.lockFailed) this.pause();
    });
  }

  start() {
    const intro = this.intro.phase === 'desk';
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
        if (!this.album.has('paint')) this.hud.toast(this.touch ? 'צלמו את השרטוט שממול (כפתור המצלמה)' : 'צלמו את השרטוט שממול (F)', 'info', 3.5);
      }, 2600);
    };
    if (intro) {
      this.intro.onDone = () => {
        this.input.enabled = true;
        this.hud.show();
        if (this.touch) $('touch').classList.remove('hidden');
        welcome();
      };
      setTimeout(() => this.intro.dive(), 560);
    } else welcome();
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
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
    if (this.inBar) {
      this.inBar = false;
      this.inkwell.inside = false;
      this.inkwell.room.group.visible = false;
      document.body.classList.remove('in-bar');
      this.audio.music(false);
    }
    for (const c of this.traffic.list) if (c.police) c.mode = c.crew && c.crew.length ? 'patrol' : 'leave';
    this.respawn();
    this.state = 'play';
    if (!this.touch) this.input.requestLock(true);
    this.hud.toast('צוירת מחדש במחבוא', 'info');
  }

  onPlayerDeath() {
    if (this.player.inVehicle) this.exitVehicle(true);
    this.player.mode = 'dead';
    if (this.airdraw.open) this.airdraw.close(false);
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
    if (this.inBar && this.world.bar) {
      this._anchor = this._anchor || new THREE.Vector3();
      return this._anchor.set(this.world.bar.x, 0, this.world.bar.z);
    }
    return p.inVehicle ? p.inVehicle.pos : p.pos;
  }

  // ------------------------------------------------------------------ main loop
  renderFrame() {
    if (this.intro.drawsDesk) {
      this.intro.render(this.renderer);
      return;
    }
    // the sun's little box of moving things follows a point ahead of the camera
    const c = this.camera.position;
    const f = this.camera.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
    this._sc = this._sc || new THREE.Vector3();
    this.pipe.render(this._sc.set(c.x + f.x * 24, 0, c.z + f.z * 24));
  }

  loop() {
    if (this.params.has('test')) {
      window.__frame = (n = 1, dt = 1 / 30) => {
        for (let i = 0; i < n; i++) this.update(dt);
        this.renderFrame();
        return true;
      };
      window.__frame(1);
      return;
    }
    // the drawing keeps its pace: its own resolution follows how long the frames take (with
    // some patience both ways, so it does not keep changing its mind)
    const pipe = this.pipe;
    let acc = 0;
    let n = 0;
    let slow = 0;
    let fast = 0;
    const tick = () => {
      const raw = this.clock.getDelta();
      const dt = Math.min(raw, 0.05);
      this.update(dt);
      this.renderFrame();
      if (this.state === 'play' && !this.intro.drawsDesk) {
        acc += raw;
        n++;
      }
      if (acc > 1.0) {
        const ms = (acc / n) * 1000;
        slow = ms > 26 ? slow + 1 : 0;
        fast = ms < 14 ? fast + 1 : 0;
        if (slow >= 2 && pipe.scale > pipe.minScale) {
          pipe.scale = Math.max(pipe.minScale, pipe.scale - 0.1);
          slow = 0;
        } else if (fast >= 3 && pipe.scale < pipe.maxScale) {
          pipe.scale = Math.min(pipe.maxScale, pipe.scale + 0.05);
          fast = 0;
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
    if (this.boilOn) shared.uBoil.value = Math.floor(this.time * 5);
    this.intro.update(dt);
    this.daynight.update(dt);
    this.weather.update(dt);
    this.ambient.update(dt);
    this.nightlights.update(this);
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
      this.vehicles.update(dt);
      this.weapons.update(dt);
      this.enemies.update(dt);
      this.civilians.update(dt);
      this.streetlife.update(dt);
      this.vignettes.update(dt);
      this.airsketch.update(dt);
      this.traffic.update(dt);
      this.world.objects.update(dt, rebakeSunShadows, this.camera.position);
      this.police.update(dt);
      this.pickups.update(dt);
      this.inkwell.update(dt);
      this.updateHidden();
    }
    // camera
    if (this.state === 'title' && !this.freeCam) {
      // slow cinematic orbit behind the title page
      const t = this.time * 0.04 + 0.9;
      const cx = 10;
      const cz = 30;
      this.camera.position.set(cx + Math.cos(t) * 235, 92 + Math.sin(this.time * 0.07) * 10, cz + Math.sin(t) * 235);
      this.camera.lookAt(cx, 28, cz);
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
      const opt = v.kind === 'tank' ? { dist: 11, height: 3.4, shoulder: 0 } : v.kind === 'ufo' ? { dist: 15, height: 2.2, shoulder: 0 } : v.kind === 'copter' ? { dist: 13, height: 3.2, shoulder: 0 } : v.kind === 'bike' ? { dist: 5.2, height: 2.2, shoulder: 0, fovMul: 1 + Math.min(0.2, v.speedAbs / 150) } : { dist: 8.5, height: 3.1, shoulder: 0, fovMul: 1 + Math.min(0.15, v.speedAbs / 200) };
      this.camRig.update(dt, v.pos, opt);
    } else {
      if (this.airdraw.open) this.camRig.update(dt, player.pos, this.airdraw.camOpts);
      else this.camRig.update(dt, player.pos, { aim: !this.inBar && this.weapons.current.def.kind === 'gun' && input.aim, height: 1.62 - player.fig.sit * 0.7, dist: this.inBar ? 3.1 : 4.4 });
    }
    const tipsy = this.inkwell.tipsy;
    if (tipsy > 0.05 && this.state === 'play') {
      // a few drinks in: the page sways
      this.camera.rotation.z += Math.sin(this.time * 1.1) * 0.045 * tipsy;
      this.camera.rotation.x += Math.sin(this.time * 0.7 + 1) * 0.02 * tipsy;
    }
    // the opening: the camera comes down out of the page into the street
    if (this.intro.phase === 'reveal') this.intro.applyCamera(this.camera);
    if (this.params.has('test') && window.__camOverride) {
      // test hook: fixed camera for screenshots
      const o = window.__camOverride;
      this.camera.position.set(o.pos[0], o.pos[1], o.pos[2]);
      this.camera.lookAt(o.look[0], o.look[1], o.look[2]);
    }
    this.camera.updateMatrixWorld();
    this.bubbles.update(dt, this.camera);
    if (this.onFrame) this.onFrame(dt);
    this.airdraw.frame(dt);
    // render dynamic figures
    if (dt > 0) {
      player.draw(this.camera.position);
      this.weapons.updateModels();
      this.enemies.draw(this.camera.position);
      this.civilians.draw(this.camera.position);
      this.streetlife.draw(fr);
      this.vignettes.draw(fr);
      this.airsketch.render(fr);
      this.traffic.draw(this.camera.position);
      this.drawStuckPencils(fr);
      this.weather.draw(fr);
      this.ambient.draw(fr);
      this.pickups.draw(fr);
      this.inkwell.draw(this.camera.position);
      this.fx.update(dt, fr);
      fr.end();
    }
    this.focus.copy(player.inVehicle ? player.inVehicle.pos : player.pos);
    this.sky.update(dt, this.camera, this.focus);
    if (this.state !== 'title') this.hud.update(dt);
    this.updatePrompts();
    this.audio.tick();
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
      else if (this.inBar) this.inkwell.interact();
      else if (p.mode === 'foot' && this.inkwell.nearStreetDoor(p.pos)) this.inkwell.enter();
      else if (p.mode === 'foot' && !this.streetlife.interact()) this.tryEnter();
    }
    if (input.wasPressed('KeyM')) this.hud.mapScale = this.hud.mapScale > 1 ? 0.55 : 1.1;
  }

  // ------------------------------------------------------------------ hiding
  updateHidden() {
    const p = this.player;
    let spot = null;
    if (!p.inVehicle && p.mode !== 'dead') {
      for (const h of this.world.hideSpots) {
        if (!h.gone && Math.hypot(p.pos.x - h.x, p.pos.z - h.z) < h.r) {
          spot = h;
          break;
        }
      }
    }
    let close = false;
    if (spot) {
      for (const e of this.enemies.list) {
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
      if (b.id === 'tank' || b.id === 'ufo') this.goalFlags.heavy = true;
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
    if (p.mode !== 'foot') return;
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

  onDrawingDone(bp, res, strokes) {
    const p = this.player;
    if (p.mode === 'draw') p.mode = 'foot';
    this.album.recordGrade(bp.id, res.score);
    const grade = res.grade;
    const msg = GRADE_TEXT[grade](bp.name);
    this.hud.toast(msg, grade === 'fail' ? 'bad' : grade === 'wonky' ? 'info' : 'good', 3.2);
    if (bp.kind === 'heal') {
      // the giant band-aid: every rubbed-out spot fills back in
      const q = { perfect: 1, good: 1, wonky: 0.7, fail: 0.35 }[grade];
      p.hp = Math.min(p.maxHp, Math.max(p.hp, p.maxHp * q));
      if (q >= 1) p.fig.holes.length = 0;
      else p.fig.holes.length = Math.floor(p.fig.holes.length * 0.5);
      this.hud.toast(q >= 1 ? 'הפלסטר הענק סגר את כל החורים — חיים מלאים!' : 'הפלסטר עקום… אבל עזר קצת', q >= 1 ? 'good' : 'info', 2.8);
      this.audio.play('cheer');
    } else if (bp.kind === 'weapon') {
      const def = WEAPON_DEFS[bp.id];
      const model = buildDrawnFlatModel(bp, res.aligned, this.mats, { anchor: bp.anchors.grip, color: BLACK_INK, width: 2.2 });
      if (bp.anchors.muzzle) {
        const ml = model.toLocal(bp.anchors.muzzle);
        model.muzzle = new THREE.Vector3(0, ml[1], ml[0] + 0.05);
      }
      if (bp.anchors.tip) {
        const tl = model.toLocal(bp.anchors.tip);
        model.tip = new THREE.Vector3(0, tl[1], tl[0]);
      }
      this.weapons.add(def, grade, model, res.score);
      this.weapons.current.strokes = strokes;
      this.weapons.current.popAt = this.time;
      this.hud.updateWeapon();
    } else {
      const v = this.vehicles.spawn(bp.id, grade, res.score, res.aligned);
      this.hud.toast(this.touch ? `לחצו על כפתור הרכב הירוק כדי להיכנס ל${bp.name}` : `לחצו E כדי להיכנס ל${bp.name}`, 'info', 3);
      v.strokes = strokes;
      if (bp.id === 'car') this.goalFlags.car = true;
    }
    this.goalFlags.drew = true;
    if (bp.id === 'tank' || bp.id === 'ufo') this.goalFlags.heavyDrawn = true;
    this.updateGoals();
    this.fx.crumbs(p.pos.x, p.pos.y + 1, p.pos.z, 16, 3);
    if (!this.touch) setTimeout(() => this.input.requestLock(), 50);
  }

  // ------------------------------------------------------------------ vehicles
  // what E would get you into right now: { kind, target, label }
  enterTarget() {
    const p = this.player;
    const v = this.vehicles.nearest(p.pos, 3.2);
    if (v) return { kind: 'vehicle', target: v, label: v.label || BLUEPRINTS[v.kind].name };
    const c = this.traffic.nearestDoor(p.pos, 1.7);
    if (c) return { kind: 'carjack', target: c, label: CAR_VARIANTS[c.variant].taxi ? 'מונית' : 'מכונית' };
    const o = this.world.objects.nearest(p.pos.x, p.pos.z, 1.4, 'car');
    if (o && o.data) return { kind: 'parked', target: o, label: o.data.taxi ? 'מונית' : 'מכונית' };
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
    const v = this.vehicles.spawnStock(CAR_VARIANTS[t.variant], t.pos, t.yaw);
    if (t.driver) this.ejectDriver(t.driver, t.pos, t.yaw, true);
    if (t.police) {
      this.onCrime('copcar', t.pos.x, t.pos.z);
      if (t.crew && t.crew.length) {
        const fx = Math.sin(t.yaw);
        const fz = Math.cos(t.yaw);
        t.crew.forEach((m, i) => {
          const side = i === 0 ? 1 : -1;
          m.fig.dispose();
          this.enemies.spawnOfficer(m.type, t.pos.x + fz * side * 1.9, t.pos.z - fx * side * 1.9, m.look, this.player.pos);
        });
      }
    }
    this.audio.play('punch', 0.6);
    this.enterVehicle(v);
    if (!t.police) this.onCrime('carjack', t.pos.x, t.pos.z);
  }

  // drive off with a car parked at the curb
  stealParked(o) {
    const d = o.data;
    const cx = (o.x0 + o.x1) / 2;
    const cz = (o.z0 + o.z1) / 2;
    this.world.objects.remove(o, false);
    // head off along the curb, toward the side with more room
    const p = this.player.pos;
    let yaw = d.alongX ? Math.PI / 2 : 0;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    if ((p.x - cx) * fx + (p.z - cz) * fz > 0) yaw += Math.PI;
    const v = this.vehicles.spawnStock({ color: d.color, taxi: d.taxi }, new THREE.Vector3(cx, 0, cz), yaw);
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
    d.fig.dispose();
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
    if (v.flies && v.alt > 3) p.vel.y = 0;
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
    if (o.kind === 'lamp') {
      this.lightmap.refresh();
      this.nightlights.refresh();
    }
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
      prompt = this.touch ? '' : p.inVehicle.kind === 'ufo' ? 'רווח/C — למעלה/למטה · קליק — קרן מחיקה · E — לצאת' : p.inVehicle.kind === 'copter' ? 'רווח/C — למעלה/למטה · קליק — מטוסי נייר · E — לצאת' : p.inVehicle.kind === 'tank' ? 'קליק — ירי · E — לצאת' : 'E — לצאת';
    } else if (p.mode === 'foot' && this.inBar) {
      const t = this.inkwell.target();
      prompt = t ? (this.touch ? '' : t.label) : '';
      enter = !!t;
    } else if (p.mode === 'foot' && this.inkwell.nearStreetDoor(p.pos)) {
      enter = true;
      prompt = this.touch ? '' : 'E — להיכנס לבר The Inkwell';
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
      { text: this.touch ? 'לצלם את השרטוט של אקדח הצבע (מצלמה)' : 'לצלם את השרטוט של אקדח הצבע (F)', done: f.photo },
      { text: 'להתחבא ליד פח, תא טלפון או בשיחים', done: f.hidden },
      { text: this.touch ? 'לצייר את אקדח הצבע (עיפרון)' : 'לצייר את אקדח הצבע (Q)', done: f.drew },
      { text: 'לקפוץ לבר The Inkwell (מעבר לפינה, ברחוב הצפוני)', done: f.bar },
      { text: `למחוק 5 עבריינים (${Math.min(5, f.kills)}/5)`, done: f.kills >= 5 },
      { text: 'למצוא את שרטוט המכונית בסוכנות (מזרח)', done: f.car },
      { text: this.touch ? 'לצייר מכונית ולנהוג בה' : 'לצייר מכונית ולנהוג בה (E)', done: f.drove },
      { text: 'להשיג שרטוט טנק או חללית (צפון)', done: f.heavy },
      { text: 'לצייר טנק או חללית', done: f.heavyDrawn },
    ];
    const firstOpen = all.findIndex((g) => !g.done);
    const start = Math.max(0, (firstOpen < 0 ? all.length : firstOpen) - 1);
    this.hud.setGoals(all.slice(start, start + 3));
  }
}

export { GRADE };
