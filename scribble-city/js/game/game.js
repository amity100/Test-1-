import * as THREE from 'three';
import { shared, setLook } from '../render/materials.js';
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
import { BLUEPRINTS } from './blueprints.js';
import { buildDrawnFlatModel } from './items.js';
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
    this.camRig = new CameraRig(camera, world.collision);
    this.figures = new FigureRenderer(scene, this.atlas);
    this.fx = new Effects(this);
    this.vehicles = new Vehicles(this);
    this.traffic = new Traffic(this);
    this.player = new Player(this);
    this.civilians = new Civilians(this);
    this.enemies = new Enemies(this);
    this.weapons = new Weapons(this);
    this.hud = new HUD(this);
    this.album = new Album(this);
    this.airdraw = new AirDraw(this);
    // eyes over hiding spots
    for (const h of world.hideSpots) {
      this.fx.marks.push({ rect: 'eye', x: h.x, y: 2.6, z: h.z, size: 0.75, visible: false, alpha: 0.85, spot: h });
    }
    this.respawn();
    if (this.album.has('paint')) this.goalFlags.photo = true;
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
    $('opt-boil').addEventListener('change', (e) => (shared.uBoilAmp.value = e.target.checked ? 1 : 0));
    $('opt-look').addEventListener('change', (e) => setLook(e.target.checked ? 1 : 0));
    $('opt-sens').addEventListener('input', (e) => (this.input.sensitivity = parseFloat(e.target.value)));
    this.input.on('lock', (locked) => {
      if (!locked && this.state === 'play' && !this.airdraw.open && !this.album.open && !this.touch && !this.input.lockFailed) this.pause();
    });
  }

  start() {
    $('title').classList.add('hidden');
    this.audio.init();
    this.state = 'play';
    this.input.enabled = true;
    this.hud.show();
    if (this.touch) {
      $('touch').classList.remove('hidden');
      try {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      } catch (e) {
        // optional
      }
    } else {
      this.input.requestLock(true);
    }
    this.hud.toast('ברוכים הבאים לעיר השרבוטים', 'info', 2.4);
    setTimeout(() => {
      if (!this.album.has('paint')) this.hud.toast(this.touch ? 'צלמו את השרטוט שממול (כפתור המצלמה)' : 'צלמו את השרטוט שממול (F)', 'info', 3.5);
    }, 2600);
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

  onEnemyKilled() {
    this.goalFlags.kills++;
    this.updateGoals();
  }

  // ------------------------------------------------------------------ main loop
  loop() {
    if (this.params.has('test')) {
      window.__frame = (n = 1, dt = 1 / 30) => {
        for (let i = 0; i < n; i++) this.update(dt);
        this.renderer.render(this.scene, this.camera);
        return true;
      };
      window.__frame(1);
      return;
    }
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  update(dt) {
    const playing = this.state === 'play' || this.state === 'dead';
    if (this.state === 'paused') dt = 0;
    this.time += dt;
    shared.uTime.value = this.time;
    shared.uBoil.value = Math.floor(this.time * 7);
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
      this.traffic.update(dt);
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
      const opt = v.kind === 'tank' ? { dist: 11, height: 3.4, shoulder: 0 } : v.kind === 'ufo' ? { dist: 15, height: 2.2, shoulder: 0 } : { dist: 8.5, height: 3.1, shoulder: 0, fovMul: 1 + Math.min(0.15, v.speedAbs / 200) };
      this.camRig.update(dt, v.pos, opt);
    } else {
      if (this.airdraw.open) this.camRig.update(dt, player.pos, this.airdraw.camOpts);
      else this.camRig.update(dt, player.pos, { aim: this.weapons.current.def.kind === 'gun' && input.aim, height: 1.62 - player.fig.sit * 0.7, dist: 4.4 });
    }
    if (this.params.has('test') && window.__camOverride) {
      // test hook: fixed camera for screenshots
      const o = window.__camOverride;
      this.camera.position.set(o.pos[0], o.pos[1], o.pos[2]);
      this.camera.lookAt(o.look[0], o.look[1], o.look[2]);
    }
    this.camera.updateMatrixWorld();
    if (this.onFrame) this.onFrame(dt);
    this.airdraw.frame(dt);
    // render dynamic figures
    if (dt > 0) {
      player.draw(this.camera.position);
      this.weapons.updateModels();
      this.enemies.draw(this.camera.position);
      this.civilians.draw(this.camera.position);
      this.drawStuckPencils(fr);
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
      else {
        const v = this.vehicles.nearest(p.pos, 3.2);
        if (v && p.mode === 'foot') this.enterVehicle(v);
      }
    }
    if (input.wasPressed('KeyM')) this.hud.mapScale = this.hud.mapScale > 1 ? 0.55 : 1.1;
  }

  // ------------------------------------------------------------------ hiding
  updateHidden() {
    const p = this.player;
    let spot = null;
    if (!p.inVehicle && p.mode !== 'dead') {
      for (const h of this.world.hideSpots) {
        if (Math.hypot(p.pos.x - h.x, p.pos.z - h.z) < h.r) {
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
      m.visible = d < 32 && d > 1.5;
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
    if (isNew) {
      this.hud.toast(`שרטוט חדש באלבום: ${bp.name}! לחצו Q כדי לצייר`, 'good', 3.4);
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
      this.hud.toast('האלבום ריק — קודם מצלמים שלט עם שרטוט (F)', 'info');
      return;
    }
    this.input.releaseLock();
    const ids = this.album.ids();
    if (ids.length === 1) this.beginDrawing(ids[0]);
    else this.album.show((id) => this.beginDrawing(id));
  }

  beginDrawing(id) {
    const p = this.player;
    if (p.mode !== 'foot') return;
    p.mode = 'draw';
    p.vel.set(0, 0, 0);
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
    if (bp.kind === 'weapon') {
      const def = WEAPON_DEFS[bp.id];
      const model = buildDrawnFlatModel(bp, res.aligned, this.mats, { anchor: bp.anchors.grip, color: BLACK_INK, width: 2.2 });
      const m = bp.anchors.muzzle;
      const ml = model.toLocal(m);
      model.muzzle = new THREE.Vector3(0, ml[1], ml[0] + 0.05);
      this.weapons.add(def, grade, model, res.score);
      this.weapons.current.strokes = strokes;
      this.weapons.current.popAt = this.time;
      this.hud.updateWeapon();
    } else {
      const v = this.vehicles.spawn(bp.id, grade, res.score, res.aligned);
      this.hud.toast(`לחצו E כדי להיכנס ל${bp.name}`, 'info', 3);
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
  enterVehicle(v) {
    const p = this.player;
    p.inVehicle = v;
    p.mode = 'vehicle';
    v.driver = p;
    p.fig.setVisible(false);
    this.camRig.yaw = v.yaw;
    this.goalFlags.drove = true;
    this.updateGoals();
    this.audio.play('click');
    $('btn-up').classList.toggle('hidden', v.kind !== 'ufo');
    $('btn-down').classList.toggle('hidden', v.kind !== 'ufo');
  }

  exitVehicle(force = false) {
    const p = this.player;
    const v = p.inVehicle;
    if (!v) return;
    v.driver = null;
    p.inVehicle = null;
    p.mode = 'foot';
    p.fig.setVisible(true);
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
        p.pos.set(x, Math.max(0, v.kind === 'ufo' ? v.pos.y : 0), z);
        placed = true;
        break;
      }
    }
    if (!placed) p.pos.set(v.pos.x, v.pos.y + 2, v.pos.z);
    p.vel.set(0, 0, 0);
    if (v.kind === 'ufo' && v.alt > 3) p.vel.y = 0;
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
    this.traffic.explosion(x, z, radius);
    if (d < radius) p.hurt((owner === 'player' ? 0.25 : 1) * damage * 0.35 * (1 - d / radius), x, z);
    this.enemies.noise(new THREE.Vector3(x, y, z), 60);
    this.civilians.panic(new THREE.Vector3(x, y, z), 60);
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
      prompt = this.touch ? '' : p.inVehicle.kind === 'ufo' ? 'רווח/C — למעלה/למטה · קליק — קרן מחיקה · E — לצאת' : p.inVehicle.kind === 'tank' ? 'קליק — ירי · E — לצאת' : 'E — לצאת';
    } else if (p.mode === 'foot') {
      const v = this.vehicles.nearest(p.pos, 3.2);
      if (v) {
        enter = true;
        prompt = this.touch ? '' : `E — להיכנס ל${BLUEPRINTS[v.kind].name}`;
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
    }
  }

  updateGoals() {
    const f = this.goalFlags;
    const all = [
      { text: 'לצלם את השרטוט של אקדח הצבע (F)', done: f.photo },
      { text: 'להתחבא ליד פח, תא טלפון או בשיחים', done: f.hidden },
      { text: 'לצייר את אקדח הצבע (Q)', done: f.drew },
      { text: `למחוק 5 עבריינים (${Math.min(5, f.kills)}/5)`, done: f.kills >= 5 },
      { text: 'למצוא את שרטוט המכונית בסוכנות (מזרח)', done: f.car },
      { text: 'לצייר מכונית ולנהוג בה (E)', done: f.drove },
      { text: 'להשיג שרטוט טנק או חללית (צפון)', done: f.heavy },
      { text: 'לצייר טנק או חללית', done: f.heavyDrawn },
    ];
    const firstOpen = all.findIndex((g) => !g.done);
    const start = Math.max(0, (firstOpen < 0 ? all.length : firstOpen) - 1);
    this.hud.setGoals(all.slice(start, start + 3));
  }
}

export { GRADE };
