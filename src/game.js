// Game orchestrator: renderer, scene, main loop, mode/state machine, events, checkpoints.
import * as THREE from 'three';
import { CONFIG } from './core/config.js';
import { i18n } from './core/i18n.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { CollisionWorld } from './core/collision.js';
import { NavGrid } from './core/navgrid.js';
import { Assets } from './core/assets.js';
import { MaterialLibrary } from './render/materials.js';
import { PostFX } from './render/postfx.js';
import { FX } from './fx/particles.js';
import { LevelBuilder } from './world/builder.js';
import { buildLevel1, Level1Script, LEVEL1_BOUNDS } from './world/level1.js';
import { Player } from './entities/player.js';
import { Squadmate } from './entities/squadmate.js';
import { Enemy } from './entities/enemy.js';
import { Hostage } from './entities/hostage.js';
import { Architect } from './architect/architect.js';
import { separateCharacters } from './entities/character.js';
import { canSee } from './entities/ai.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';

const _v = new THREE.Vector3();

export class Game {
  constructor(container) {
    this.container = container;
    this.state = 'loading';     // loading | menu | playing | paused | end
    this.mode = 'ground';       // ground | architect
    this.time = 0; this.realTime = 0; this.timeScale = 1; this.timeScaleTarget = 1;
    this.characters = []; this.enemies = []; this.squad = []; this.hostages = []; this.grenades = [];
    this.squadMode = 'follow';
    this.width = 1; this.height = 1;
    this.t = i18n.t;
    this.stats = { kills: 0, startTime: 0 };
    this.checkpointData = null;
    this._enemyId = 0;
    this.heliDown = false;
  }

  async init() {
    i18n.set(i18n.detect());
    // renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    } catch (e) { this.fatal(i18n.t('menu.webglError')); throw e; }
    if (!renderer.capabilities.isWebGL2) { this.fatal(i18n.t('menu.webglError')); throw new Error('WebGL2 required'); }
    this.renderer = renderer;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = CONFIG.render.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.id = 'game';
    this.container.appendChild(renderer.domElement);
    this.input = new Input(renderer.domElement);
    this.audio = new AudioEngine();
    this.menus = new Menus(this, this.container);
    this.menus.show('loading');
    this.hud = new HUD(this, this.container);
    // scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0f1a, CONFIG.render.fogDensity);
    this._buildSky();
    this._buildLights();
    this.mats = new MaterialLibrary(renderer);
    this.assets = new Assets(renderer);
    await this.assets.load((p) => this.menus.setLoading(p * 0.7));
    if (this.assets.envMap) { this.scene.environment = this.assets.envMap; this.mats.setEnvironment(this.assets.envMap); }
    this.world = new CollisionWorld(LEVEL1_BOUNDS);
    this.fx = new FX(this.scene, this.world, this.audio);
    this.fx.createRain(CONFIG.render.rainCount);
    this.menuCamera = new THREE.PerspectiveCamera(50, 1, 0.5, 500);
    this.camera = this.menuCamera;
    this.postfx = new PostFX(renderer, this.scene, this.camera, CONFIG.render);
    this.architect = new Architect(this);
    this._buildLevel();
    this.menus.setLoading(1);
    this.applySettings(this.menus.settings);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this._bindGlobalKeys();
    this.input.on('lockchange', (locked) => {
      if (locked) { this.hadLock = true; if (this.state === 'paused' && this.menus.current === 'click') this.resume(); }
      else if (this.state === 'playing') { if (this.hadLock) this.pause(true); else this.showClickToResume(); }
    });
    this.input.on('lockerror', () => { if (this.state === 'playing') this.showClickToResume(); });
    this.input.on('softlook', () => { this.container.classList.add('softlook'); this.hud.toast(this.t('hud.softlook'), 6000); if (this.state === 'paused' && this.menus.current === 'click') this.resume(); });
    this.state = 'menu';
    this.menus.show('main');
    this.menuOrbit = 0;
    this._loop = this._loop.bind(this);
    this.lastFrame = performance.now();
    requestAnimationFrame(this._loop);
    // expose for automation / debugging
    window.__game = this;
  }

  fatal(msg) { const d = document.createElement('div'); d.className = 'fatal'; d.textContent = msg; this.container.appendChild(d); }

  _buildSky() {
    const geo = new THREE.SphereGeometry(380, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        uniform float uTime, uFlash; varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=hash(vec3(i,0.0)), b=hash(vec3(i+vec2(1,0),0.0)), c=hash(vec3(i+vec2(0,1),0.0)), d=hash(vec3(i+vec2(1,1),0.0)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
        void main(){
          float h = clamp(vDir.y, -0.1, 1.0);
          vec3 horizon = vec3(0.10, 0.13, 0.20); vec3 zenith = vec3(0.015, 0.02, 0.045);
          vec3 col = mix(horizon, zenith, pow(h, 0.55));
          // moon
          vec3 moonDir = normalize(vec3(-0.35, 0.55, 0.45));
          float m = dot(vDir, moonDir);
          col += vec3(0.55, 0.62, 0.8) * (smoothstep(0.9985, 0.9995, m) * 1.6 + pow(max(0.0, m), 40.0) * 0.12);
          // clouds
          vec2 uv = vDir.xz / (vDir.y + 0.25);
          float c = noise(uv * 2.0 + uTime * 0.01) * 0.6 + noise(uv * 5.0 - uTime * 0.02) * 0.3;
          c = smoothstep(0.45, 0.85, c) * smoothstep(0.0, 0.25, vDir.y);
          col = mix(col, vec3(0.12, 0.14, 0.19), c * 0.7);
          // stars
          float s = step(0.9985, hash(floor(vDir * 300.0))) * smoothstep(0.1, 0.5, vDir.y) * (1.0 - c);
          col += s * 0.35;
          col += uFlash * vec3(0.9, 0.95, 1.0);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat); this.sky.renderOrder = -10; this.scene.add(this.sky);
  }

  _buildLights() {
    this.moon = new THREE.DirectionalLight(0x8fa8d8, 1.35);
    this.moon.position.set(-35, 55, 45); this.moon.castShadow = true;
    const s = this.moon.shadow; s.mapSize.set(CONFIG.render.shadowMapSize, CONFIG.render.shadowMapSize);
    s.camera.near = 1; s.camera.far = 200; s.camera.left = s.camera.bottom = -45; s.camera.right = s.camera.top = 45; s.bias = -0.0008; s.normalBias = 0.03;
    this.scene.add(this.moon); this.scene.add(this.moon.target);
    this.hemi = new THREE.HemisphereLight(0x223550, 0x0d0a08, 0.75); this.scene.add(this.hemi);
    this.lightning = { t: 18 + Math.random() * 30, flash: 0 };
  }

  _buildLevel() {
    this.builder = new LevelBuilder(this);
    this.level = buildLevel1(this, this.builder);
    this.builder.finalize();
    this.nav = new NavGrid(this.world, LEVEL1_BOUNDS, 0.5, CONFIG.stepHeight);
    this.nav.buildAll();
    this.script = null;
  }

  interactables() {
    const list = [...this.level.interactables];
    for (const h of this.hostages) if (h.alive && h.state === 'captive') list.push({ id: 'free_' + h.id, pos: h.pos, radius: 2.2, holdTime: CONFIG.player.interactTime, enabled: true, prompt: 'hud.interact.free', onUse: () => h.free() });
    for (const s of this.squad) if (s.downed) list.push({ id: 'revive_' + s.slot, pos: s.pos, radius: 2.2, holdTime: CONFIG.squad.reviveTime, enabled: true, prompt: 'hud.interact.revive', onUse: () => { s.reviveByPlayer(); this.hud.callout('revive', s); } });
    return list;
  }
  hostilesOf(faction) {
    if (faction === 'enemy') { const out = []; if (this.player.alive) out.push(this.player); for (const s of this.squad) if (s.alive) out.push(s); for (const h of this.hostages) if (h.alive && h.state === 'freed') out.push(h); return out; }
    return this.enemies.filter((e) => e.alive);
  }
  isDark() { return this.level && !this.level.power; }
  // Is a world position inside a powered floodlight cone (with a clear line from the lamp)?
  isLitCached(ch) {
    if (ch._litTime !== undefined && this.time - ch._litTime < 0.15) return ch._lit;
    ch._litTime = this.time; ch._lit = this.isLit(ch.pos); return ch._lit;
  }
  isLit(pos) {
    if (!this.level || !this.level.power) return false;
    const target = _v.set(pos.x, pos.y + 1.0, pos.z);
    for (const l of this.level.floodlights) {
      if (l.intensity <= 0) continue;
      const dx = target.x - l.position.x, dy = target.y - l.position.y, dz = target.z - l.position.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > l.distance * 0.75) continue;
      const tx = l.target.position.x - l.position.x, ty = l.target.position.y - l.position.y, tz = l.target.position.z - l.position.z;
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      const cos = (dx * tx + dy * ty + dz * tz) / (d * tl);
      if (cos < Math.cos(l.angle * 1.05)) continue;
      if (this.world.lineOfSight(l.position, target)) return true;
    }
    return false;
  }

  // ---- mission lifecycle ----
  startMission() {
    this.audio.start();
    this._clearEntities();
    const L = this.level;
    // reset modules to their original placement
    for (const m of L.modules) { if (m.origin) m.setTransform(m.origin.x, m.origin.y, m.origin.z, m.origin.yaw); else m.origin = { x: m.x, y: m.y, z: m.z, yaw: m.yaw }; }
    this.script = new Level1Script(this, L);
    for (const b of L.explosives) b.reset();
    this._resetLights();
    L.cellDoor.setLocked(true);
    for (const it of L.interactables) it.enabled = true;
    // spawn
    const sp = L.spawns;
    this.player = new Player(this, { position: new THREE.Vector3(sp.player.x, 0, sp.player.z), yaw: sp.player.yaw });
    this.player.camYaw = sp.player.yaw;
    this.characters.push(this.player);
    sp.squad.forEach((s, i) => { const m = new Squadmate(this, { position: new THREE.Vector3(s.x, 0, s.z), yaw: s.yaw, name: s.name, slot: i }); this.squad.push(m); this.characters.push(m); });
    for (const h of sp.hostages) { const m = new Hostage(this, { position: new THREE.Vector3(h.x, h.y || 0, h.z), yaw: h.yaw, name: h.name, id: h.id }); this.hostages.push(m); this.characters.push(m); }
    for (const e of sp.enemies) this.spawnEnemy(e);
    this.architect.energy = CONFIG.architect.energyMax; this.architect.stats.placed = 0;
    this.architect.enemyIntel.clear();
    this.fx.clearDecals();
    this.time = 0; this.stats = { kills: 0, startTime: 0 };
    this.squadMode = 'follow';
    this.state = 'playing'; this.mode = 'ground';
    this.camera = this.player.camera; this.postfx.setCamera(this.camera);
    this.resize();
    this.hud.show(); this.menus.hide();
    this.script.setPrimary('insert');
    this.hud.hint('move'); setTimeout(() => { if (this.state === 'playing') this.hud.hint('aim'); }, 9000);
    this.input.lock();
    this.checkpoint('start');
    this.player.update(0, 0);
  }
  spawnEnemy(def) {
    const e = new Enemy(this, { position: new THREE.Vector3(def.x, def.y || 0, def.z), yaw: def.yaw, patrol: def.patrol, accuracy: def.accuracy, role: def.role, name: def.name, grenades: def.grenades });
    e.id = this._enemyId++;
    e.aimYaw = e.yaw; e.scanYaw = e.yaw; e.homeYaw = e.yaw;
    this.enemies.push(e); this.characters.push(e);
    return e;
  }
  _clearEntities() {
    for (const c of this.characters) c.dispose();
    for (const g of this.grenades) if (g.alive) this.scene.remove(g.mesh);
    this.characters = []; this.enemies = []; this.squad = []; this.hostages = []; this.grenades = [];
    if (this.script && this.script.heli) { this.scene.remove(this.script.heli.grp); }
    this.heliDown = false;
  }
  _resetLights() {
    const L = this.level; L.power = true;
    for (const l of L.floodlights) { l.intensity = l.userData.baseIntensity; if (l.userData.fixture) l.userData.fixture.material = this.mats.get('emissiveWarm'); if (l.userData.cone) l.userData.cone.visible = true; }
    for (const l of L.roomLights) { l.intensity = l.userData.baseIntensity; if (l.userData.fixture) l.userData.fixture.material = this.mats.get(l.userData.kind === 'cool' ? 'emissiveCool' : 'emissiveWarm'); }
    for (const l of L.emergency) { l.intensity = 0; l.userData.fixture.material = this.mats.get('lightHousing'); }
    if (L.fuseLed) L.fuseLed.material = this.mats.get('emissiveGreen');
  }

  quitToMenu() {
    this._clearEntities();
    this.state = 'menu'; this.mode = 'ground'; this.architect.active = false; this.architect.markers.visible = false;
    this.postfx.state.architect = 0; this.audio.setSlowMotion(false); this.timeScaleTarget = 1; this.timeScale = 1;
    this.hud.hide(); this.hud.setArchitect(false); this.menus.show('main'); this.input.unlock();
    this.camera = this.menuCamera; this.postfx.setCamera(this.camera);
    this.player = null;
  }
  pause(fromLock = false) {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.menus.show('pause'); this.input.unlock(); this.audio.setSlowMotion(true);
  }
  showClickToResume() { if (this.state !== 'playing') return; this.state = 'paused'; this.menus.show('click'); this.audio.setSlowMotion(true); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.menus.hide(); this.audio.setSlowMotion(this.mode === 'architect'); this.input.lock(); this.lastFrame = performance.now(); }
  resumeFromClick() { this.resume(); }

  missionComplete() {
    if (this.state !== 'playing') return;
    this.state = 'end'; this.audio.ui('win'); this.input.unlock(); this.audio.setSlowMotion(true);
    if (this.architect.active) this.architect.exit();
    this.hud.hide(); this.menus.showEnd(true, null, this._endStats());
  }
  missionFailed(reason) {
    if (this.state !== 'playing') return;
    this.state = 'end'; this.audio.ui('fail'); this.audio.setSlowMotion(true);
    if (this.architect.active) this.architect.exit();
    setTimeout(() => { this.input.unlock(); this.hud.hide(); this.menus.showEnd(false, reason, this._endStats()); }, 1800);
  }
  _endStats() { return { time: this.time, kills: this.stats.kills, accuracy: this.player ? this.player.accuracy : 0, modules: this.architect.stats.placed, hostages: this.hostages.filter((h) => h.alive && h.state === 'extracted').length }; }

  onPlayerDeath() { this.missionFailed('player'); }
  onCharacterDeath(ch, info) {
    if (ch.isEnemy) { if (info.from && (info.from.isPlayer || info.from.isSquad)) this.stats.kills++; this.script && this.script.onEnemyDeath(ch); }
  }
  onSquadDowned(s) { this.hud.callout('downed', s); this.hud.hint('revive'); }
  onSquadDead() { /* mission continues */ }
  onHostageFreed(h) { this.script && this.script.onHostageFreed(h); this.audio.ui('objective'); }
  onEnemyAlert(e, target) { if (target === this.player || target?.isSquad) { if (this.time - (this._lastAlertToast || -10) > 6) { this._lastAlertToast = this.time; this.hud.alert('hud.alert.spotted'); this.audio.ui('alert'); } } // radio to nearby guards
    setTimeout(() => { if (e.alive && e.state === 'combat') this.emitNoise(e.pos, CONFIG.enemy.alertRadioRange, e, 'radio'); }, CONFIG.enemy.alertRadioDelay * 1000 / Math.max(0.2, this.timeScale)); }
  onEnemySuspicious() { if (this.time - (this._lastSusToast || -10) > 8) { this._lastSusToast = this.time; this.hud.alert('hud.alert.suspicious', 1600); } }
  onModulePlaced() { this.settleModules(); }
  // Any module left hanging in the air after a change drops onto whatever is beneath it.
  settleModules() {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const m of this.level.modules) {
        if (m.y <= this.world.groundY + 0.01) continue;
        const support = this.architect._supportHeight(m, m.x, m.z, m.yaw);
        if (support < m.y - 0.05) { m.setTransform(m.x, support, m.z, m.yaw); this.audio.modulePlace(m.group.position, m.cfg.mass >= 3); this.fx.moduleLand(m.mainCollider); moved = true; }
      }
      if (!moved) break;
    }
  }
  onExplosion(pos) { this.emitNoise(pos, 60, null, 'explosion'); this.postfx.state.flash = 0.6; if (this.player) this.player.shake = Math.min(1, this.player.shake + Math.max(0, 1 - pos.distanceTo(this.player.pos) / 20)); }

  emitNoise(pos, radius, source, kind) { for (const e of this.enemies) e.hear(pos, radius, source, kind); }
  hint(key) { this.hud.hint(key); }

  // ---- checkpoints ----
  checkpoint(id) {
    this.checkpointData = {
      id, time: this.time,
      player: this.player.snapshot(), squad: this.squad.map((s) => s.snapshot()), hostages: this.hostages.map((h) => h.snapshot()),
      enemies: this.enemies.map((e) => e.snapshot()), enemyDefs: this.enemies.map((e) => ({ patrol: e.patrol.map((p) => [p.x, p.z]), role: e.role, accuracy: e.accuracy, name: e.name })),
      modules: this.level.modules.map((m) => ({ x: m.x, y: m.y, z: m.z, yaw: m.yaw })),
      architect: this.architect.snapshot(), script: this.script.snapshot(), stats: { ...this.stats },
      explosives: this.level.explosives.map((b) => b.alive),
    };
    if (id !== 'start') { this.hud.toast(this.t('hud.checkpoint')); this.audio.ui('checkpoint'); }
  }
  restoreCheckpoint() {
    const d = this.checkpointData; if (!d) { this.startMission(); return; }
    this.audio.start();
    if (this.architect.active) this.architect.exit();
    // modules
    this.level.modules.forEach((m, i) => { const s = d.modules[i]; m.setTransform(s.x, s.y, s.z, s.yaw); });
    // enemies: rebuild the list to match the snapshot
    for (const e of this.enemies) { e.dispose(); const i = this.characters.indexOf(e); if (i >= 0) this.characters.splice(i, 1); }
    this.enemies = [];
    d.enemies.forEach((s, i) => { const def = d.enemyDefs[i]; const e = this.spawnEnemy({ x: s.pos[0], y: s.pos[1], z: s.pos[2], yaw: s.yaw, patrol: def.patrol, role: def.role, accuracy: def.accuracy, name: def.name, grenades: s.grenades }); e.restore(s); });
    this.player.restore(d.player);
    this.squad.forEach((s, i) => s.restore(d.squad[i]));
    this.hostages.forEach((h, i) => h.restore(d.hostages[i]));
    for (const g of this.grenades) if (g.alive) this.scene.remove(g.mesh); this.grenades = [];
    this.architect.restore(d.architect);
    d.explosives.forEach((alive, i) => { const b = this.level.explosives[i]; if (alive) b.reset(); else if (b.alive) { b.alive = false; b.mesh.visible = false; this.world.remove(b.collider); } });
    this._resetLights();
    this.script.restore(d.script);
    this.stats = { ...d.stats }; this.time = d.time;
    this.state = 'playing'; this.mode = 'ground'; this.squadMode = 'follow';
    this.camera = this.player.camera; this.postfx.setCamera(this.camera);
    this.postfx.state.damage = 0; this.postfx.state.architect = 0; this.audio.setSlowMotion(false); this.timeScale = 1; this.timeScaleTarget = 1;
    this.hud.show(); this.menus.hide(); this.input.lock();
    this.player.update(0, 0);
  }

  // ---- settings ----
  applySettings(s) {
    const q = s.quality;
    const pr = Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : q === 'medium' ? 1.25 : q === 'high' ? 1.5 : CONFIG.render.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.moon.shadow.mapSize.setScalar(q === 'ultra' ? 4096 : q === 'high' ? 2048 : 1024); if (this.moon.shadow.map) { this.moon.shadow.map.dispose(); this.moon.shadow.map = null; }
    for (const l of this.builder.lights.flood) { l.castShadow = l.castShadow && q !== 'low'; }
    this.postfx.setQuality(q);
    if (this.fx.rain) this.fx.rain.visible = q !== 'low';
    if (this.player) { this.player.sensitivity = CONFIG.camera.sensitivity * s.sensitivity; this.player.invertY = s.invertY; }
    this.settings = s;
    const d = s.difficulty || 'normal';
    this.difficulty = { accuracy: d === 'easy' ? 0.7 : d === 'hard' ? 1.25 : 1, damage: d === 'easy' ? 0.65 : d === 'hard' ? 1.3 : 1 };
    this.audio.setVolume(s.volume);
    this.resize();
  }
  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    for (const c of [this.menuCamera, this.architect && this.architect.camera, this.player && this.player.camera]) if (c) { c.aspect = w / h; c.updateProjectionMatrix(); }
    this.postfx.setSize(w, h);
  }

  _bindGlobalKeys() {
    this.input.on('keydown', (code, e) => {
      if (this.state === 'playing') {
        if (code === 'Escape') { if (this.architect.active && this.architect.dragging) return; this.pause(); return; }
        if (code === 'Tab') { e.preventDefault(); if (this.player.alive) this.architect.toggle(); }
        if (code === 'KeyQ' && this.mode === 'ground') { this.squadMode = this.squadMode === 'follow' ? 'hold' : 'follow'; for (const s of this.squad) if (s.alive) { if (this.squadMode === 'hold') { s.setOrder('hold', { pos: s.pos }); s.order.yaw = s.yaw; } else s.setOrder('follow'); } this.hud.toast(this.t(this.squadMode === 'hold' ? 'hud.squadHold' : 'hud.squadFollow')); this.audio.ui('click'); if (!this.script.flags.hintSquad) { this.script.flags.hintSquad = true; } }
      } else if (this.state === 'paused' && code === 'Escape') this.resume();
      else if (this.state === 'menu' && (code === 'Enter' || code === 'Space')) this.startMission();
    });
  }

  // ---- main loop ----
  _loop(now) {
    requestAnimationFrame(this._loop);
    let realDt = Math.min(0.05, (now - this.lastFrame) / 1000); this.lastFrame = now;
    if (!(realDt > 0)) realDt = 0.016;
    if (this.debugFrozen) return;
    this._frame(realDt, true);
  }
  _frame(realDt, render) {
    this.realTime += realDt;
    if (this.state === 'menu') { this._updateMenu(realDt); }
    else if (this.state === 'playing') { this._updatePlaying(realDt); }
    else if (this.state === 'end' || this.state === 'paused') { this.fx.update(0, this.camera); this.postfx.update(realDt, this.realTime); }
    this._updateEnvironment(realDt);
    this.audio.update(realDt, this.state === 'menu');
    const ht = this.profile ? performance.now() : 0;
    this.hud.update(realDt);
    if (this.profile) this._prof('hud', ht);
    if (render) this.postfx.render();
    this.input.endFrame();
  }
  // Test/debug helper: advance the simulation without rendering (deterministic, fast).
  debugStep(seconds, step = 1 / 60) { const n = Math.round(seconds / step); for (let i = 0; i < n; i++) this._frame(step, false); }
  debugRender() { this.postfx.render(); }

  _updateMenu(realDt) {
    this.menuOrbit += realDt * 0.05;
    const c = this.menuCamera; const r = 48;
    c.position.set(Math.sin(this.menuOrbit) * r, 22 + Math.sin(this.menuOrbit * 0.7) * 4, Math.cos(this.menuOrbit) * r + 2);
    c.lookAt(0, 2, 2);
    this.fx.update(realDt, c); this.postfx.state.architect = 0.35; this.postfx.update(realDt, this.realTime);
    this._updateShadowFocus(new THREE.Vector3(0, 0, 0));
    this.audio.setListener(c.position, c.getWorldDirection(_v), new THREE.Vector3(1, 0, 0));
  }

  _prof(name, t0) { if (!this.profile) return; this.profile[name] = (this.profile[name] || 0) + (performance.now() - t0); }
  _updatePlaying(realDt) {
    const P = this.profile; let t0 = P ? performance.now() : 0;
    // time scale (slow motion in architect view)
    this.timeScaleTarget = this.mode === 'architect' ? CONFIG.architectTimeScale : 1;
    this.timeScale += (this.timeScaleTarget - this.timeScale) * Math.min(1, realDt * 6);
    const dt = realDt * this.timeScale;
    this.time += dt; this.dt = dt;
    // player first (camera), then architect (uses player position)
    this.player.update(dt, realDt);
    if (P) { this._prof('player', t0); t0 = performance.now(); }
    this.architect.update(realDt, dt);
    if (P) { this._prof('architect', t0); t0 = performance.now(); }
    this.hemi.intensity = 0.75 + this.architect.transition * 1.1;
    this.camera = this.mode === 'architect' ? this.architect.camera : this.player.camera;
    if (this.postfx.camera !== this.camera) this.postfx.setCamera(this.camera);
    // friendlies' view of enemies (for fog of war & squad targeting)
    this._visTimer = (this._visTimer || 0) - dt;
    if (this._visTimer <= 0) { this._visTimer = 0.1; this._updateVisibility(); }
    if (P) { this._prof('visibility', t0); t0 = performance.now(); }
    // AI
    for (const c of this.characters) if (!c.isPlayer) { const ct = P ? performance.now() : 0; c.update(dt); if (P) this._prof(c.isEnemy ? 'enemies' : c.isSquad ? 'squad' : 'hostages', ct); }
    if (P) t0 = performance.now();
    separateCharacters(this.characters, dt);
    // doors
    let navDirty = false;
    for (const d of this.level.doors) { d.update(dt, this.characters); if (d.navDirty) { d.navDirty = false; navDirty = true; this.nav.rebuildRegion(d.collider.minX, d.collider.minZ, d.collider.maxX, d.collider.maxZ); } }
    // grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) { const g = this.grenades[i]; g.update(dt); if (!g.alive) this.grenades.splice(i, 1); }
    // explosive props
    for (const b of this.level.explosives) b.update(dt);
    // loot: walking over a fallen guard's rifle restocks ammo
    if (this.player.alive) for (const e of this.enemies) {
      if (e.alive || e.looted || !e._rifleDropped) continue;
      if (e.rifle.position.distanceToSquared(this.player.pos) < 1.6 * 1.6) {
        e.looted = true; e.rifle.visible = false;
        const g = this.player.gun; const add = Math.min(60, g.cfg.reserve * 2 - g.reserve); g.reserve += add;
        let msg = '+' + add + ' ' + this.t('hud.rounds');
        if (this.player.grenades < 3 && Math.random() < 0.35) { this.player.grenades++; msg += ' · +1 ' + this.t('hud.grenade'); }
        this.hud.toast(msg, 1800); this.audio.ui('click');
      }
    }
    // zones
    for (const id in this.level.zones) { const z = this.level.zones[id]; const inside = z.contains(this.player.pos); if (inside && !z.wasInside) { z.wasInside = true; this.script.onZoneEnter(id); } else if (!inside) z.wasInside = false; }
    if (P) { this._prof('doors+grenades+zones', t0); t0 = performance.now(); }
    // script
    this.script.update(dt);
    // fx / post
    this.fx.update(dt, this.camera);
    this.postfx.update(realDt, this.realTime);
    if (P) { this._prof('script+fx', t0); t0 = performance.now(); }
    this._updateShadowFocus(this.player.pos);
    // audio listener
    const cam = this.camera; cam.getWorldDirection(_v);
    this.audio.setListener(cam.position, _v, new THREE.Vector3().crossVectors(_v, new THREE.Vector3(0, 1, 0)).normalize());
    // music tension
    let tension = 0; for (const e of this.enemies) if (e.alive) { if (e.state === 'combat') tension = 1; else if (e.state !== 'patrol') tension = Math.max(tension, 0.45); }
    if (this.script.objectives.hold === 'active') tension = 1;
    this.audio.setTension(tension);
    if (tension >= 1) this._wasInCombat = true;
    else if (this._wasInCombat && tension < 0.5) { this._wasInCombat = false; if (!this.script.flags.hintSquad) { this.script.flags.hintSquad = true; this.hint('squad'); } else if (!this.script.flags.hintVault) { this.script.flags.hintVault = true; this.hint('vault'); } }
    if (this.mode === 'ground' && !this.input.locked && this.input.wantLock) { /* waiting for lock */ }
  }

  _updateVisibility() {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) { e.seenByFriendly = false; continue; }
      let seen = false;
      if (p.alive) { const saveYaw = p.aimYaw; p.aimYaw = p.camYaw; seen = canSee(this, p, e, 130, 70); p.aimYaw = saveYaw; }
      if (!seen) for (const s of this.squad) { if (s.alive && canSee(this, s, e, CONFIG.squad.fovDeg, CONFIG.squad.visionRange)) { seen = true; break; } }
      e.seenByFriendly = seen;
    }
  }

  _updateShadowFocus(center) {
    // keep the moon's shadow frustum centred on the action
    const m = this.moon;
    m.position.set(center.x - 35, 55, center.z + 45); m.target.position.set(center.x, 0, center.z); m.target.updateMatrixWorld();
  }

  _updateEnvironment(realDt) {
    this.sky.material.uniforms.uTime.value = this.realTime;
    // lightning
    const L = this.lightning; L.t -= realDt;
    if (L.t <= 0) { L.t = 20 + Math.random() * 40; L.flash = 1; this.postfx.state.flash = Math.max(this.postfx.state.flash, 0.35); setTimeout(() => { if (this.audio.ctx) { this.audio._noise(this.audio.ambBus, { dur: 1.6, filter: 'lowpass', freq: 220, freqEnd: 60, gain: 0.9, attack: 0.05, decay: 0.7 }); } }, 600 + Math.random() * 800); }
    if (L.flash > 0) { L.flash = Math.max(0, L.flash - realDt * 4); this.moon.intensity = 1.35 + L.flash * 6; this.sky.material.uniforms.uFlash.value = L.flash * 0.25; }
    else { this.moon.intensity = 1.35; this.sky.material.uniforms.uFlash.value = 0; }
  }
}
