// Game orchestrator: renderer, scene, main loop, mode/state machine, gateways, the witness chain, checkpoints.
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
import { Enemy } from './entities/enemy.js';
import { Hostage } from './entities/hostage.js';
import { TacMap } from './map/tacmap.js';
import { PortalSystem } from './portal/portal.js';
import { separateCharacters } from './entities/character.js';
import { canSeeVia, canSeePoint } from './entities/ai.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { TouchControls } from './ui/touch.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const F = CONFIG.focus;

// Phones and tablets get touch controls; ?touch=1 / ?touch=0 (or window.__VANTAGE_TOUCH) overrides.
function detectTouch() {
  try {
    const q = new URLSearchParams(location.search).get('touch');
    if (q === '1') return true; if (q === '0') return false;
    if (typeof window.__VANTAGE_TOUCH === 'boolean') return window.__VANTAGE_TOUCH;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
    const touchPts = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    return (coarse && touchPts) || (mobileUA && touchPts);
  } catch (e) { return false; }
}

export class Game {
  constructor(container) {
    this.container = container;
    this.state = 'loading';     // loading | menu | intro | playing | paused | end
    this.mode = 'ground';       // ground | map
    this.time = 0; this.realTime = 0; this.timeScale = 1; this.timeScaleTarget = 1;
    this.characters = []; this.enemies = []; this.hostages = []; this.grenades = [];
    this.width = 1; this.height = 1;
    this.t = i18n.t;
    this.stats = this._freshStats();
    this.checkpointData = null;
    this._enemyId = 0;
    this.heliDown = false;
    this.focus = 0; this.chain = 0; this.alarm = false; this.alarmTime = -100;
    this.isTouch = detectTouch();
    // rendering-health watchdog
    this.contextLost = false; this.frameMs = 16;
    this._sinceCheck = 0; this._repairStep = 0; this._blackFrames = 0; this._pendingSample = false; this._checksLeft = 10;
    this._slowTime = 0;
  }
  _freshStats() { return { kills: 0, knifeKills: 0, portals: 0, reports: 0, witnesses: 0, loudShots: 0, alarmKills: 0, startTime: 0, longestChain: 0, bodiesHidden: 0, locks: 0 }; }

  async init() {
    i18n.set(i18n.detect());
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    } catch (e) { this.fatal(i18n.t('menu.webglError')); throw e; }
    if (!renderer.capabilities.isWebGL2) { this.fatal(i18n.t('menu.webglError')); throw new Error('WebGL2 required'); }
    this.renderer = renderer;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = this.isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;   // the soft filter is ~3x the shadow cost per pixel
    renderer.shadowMap.autoUpdate = false;   // shadows are refreshed once per frame, shared by the gateway views
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = CONFIG.render.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.id = 'game';
    this.container.appendChild(renderer.domElement);
    this.input = new Input(renderer.domElement);
    this.input.touch = this.isTouch;
    this.audio = new AudioEngine();
    this.menus = new Menus(this, this.container);
    this.menus.show('loading');
    this.hud = new HUD(this, this.container);
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
    this.fx.createRain(this.isTouch ? Math.round(CONFIG.render.rainCount * 0.45) : CONFIG.render.rainCount);
    this.menuCamera = new THREE.PerspectiveCamera(50, 1, 0.5, 500);
    this.camera = this.menuCamera;
    this.postfx = new PostFX(renderer, this.scene, this.camera, CONFIG.render, { mobile: this.isTouch });
    this.tacmap = new TacMap(this); this.tacmap.touch = this.isTouch;
    if (this.isTouch) { this.touch = new TouchControls(this, this.container); this.container.classList.add('touch-mode'); }
    this._buildLevel();
    this.portals = new PortalSystem(this);
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
    this._bindContextEvents();
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(true); else if (!document.hidden) this.audio.resume(); });
    this.state = 'menu';
    this.menus.show('main');
    this.menuOrbit = 0;
    this._loop = this._loop.bind(this);
    this.lastFrame = performance.now();
    requestAnimationFrame(this._loop);
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
          vec3 moonDir = normalize(vec3(-0.35, 0.55, 0.45));
          float m = dot(vDir, moonDir);
          col += vec3(0.55, 0.62, 0.8) * (smoothstep(0.9985, 0.9995, m) * 1.6 + pow(max(0.0, m), 40.0) * 0.12);
          vec2 uv = vDir.xz / (vDir.y + 0.25);
          float c = noise(uv * 2.0 + uTime * 0.01) * 0.6 + noise(uv * 5.0 - uTime * 0.02) * 0.3;
          c = smoothstep(0.45, 0.85, c) * smoothstep(0.0, 0.25, vDir.y);
          col = mix(col, vec3(0.12, 0.14, 0.19), c * 0.7);
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
    const R = this.isTouch ? 32 : 45;
    s.camera.near = 1; s.camera.far = 200; s.camera.left = s.camera.bottom = -R; s.camera.right = s.camera.top = R; s.bias = -0.0008; s.normalBias = 0.03;
    this.scene.add(this.moon); this.scene.add(this.moon.target);
    this.hemi = new THREE.HemisphereLight(0x2a3e5c, 0x100d0a, 0.95); this.scene.add(this.hemi);
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
    if (this.player && !this.player.carrying) for (const e of this.enemies) if (!e.alive && !e.carriedBy && !e.thrown && e.deathT > 0.8) list.push({ id: 'body_' + e.id, pos: e.pos, radius: 2.0, holdTime: 0.6, enabled: true, prompt: 'hud.interact.body', onUse: () => this.player.carry(e) });
    return list;
  }
  hostilesOf(faction) {
    if (faction === 'enemy') { const out = []; if (this.player && this.player.alive) out.push(this.player); for (const h of this.hostages) if (h.alive && h.state === 'freed') out.push(h); return out; }
    return this.enemies.filter((e) => e.alive);
  }
  isDark() { return this.level && !this.level.power; }
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
  // guards currently on the radio, soonest first
  witnesses() { return this.enemies.filter((e) => e.alive && e.report.active).sort((a, b) => a.report.t - b.report.t); }

  // ---- mission lifecycle ----
  startMission() {
    this.audio.start();
    this._clearEntities();
    const L = this.level;
    for (const m of L.modules) { if (m.origin) m.setTransform(m.origin.x, m.origin.y, m.origin.z, m.origin.yaw); else m.origin = { x: m.x, y: m.y, z: m.z, yaw: m.yaw }; }
    this.script = new Level1Script(this, L);
    for (const b of L.explosives) b.reset();
    this._resetLights();
    L.cellDoor.setLocked(true);
    for (const it of L.interactables) it.enabled = true;
    const sp = L.spawns;
    this.player = new Player(this, { position: new THREE.Vector3(sp.player.x, 0, sp.player.z), yaw: sp.player.yaw });
    this.player.camYaw = sp.player.yaw;
    this.characters.push(this.player);
    for (const h of sp.hostages) { const m = new Hostage(this, { position: new THREE.Vector3(h.x, h.y || 0, h.z), yaw: h.yaw, name: h.name, id: h.id }); this.hostages.push(m); this.characters.push(m); }
    for (const e of sp.enemies) this.spawnEnemy(e);
    this.portals.reset(); this.tacmap.reset();
    this.fx.clearDecals();
    this.time = 0; this.stats = this._freshStats();
    this.focus = 0; this.chain = 0; this.alarm = false; this.alarmTime = -100;
    this.state = 'intro'; this.mode = 'ground';
    this.camera = this.player.camera; this.postfx.setCamera(this.camera);
    this.resize();
    this.hud.show(); this.menus.hide(); this.hud.tutorial(null);
    this._checksLeft = Math.max(this._checksLeft, 12); this._sinceCheck = 0;
    this.script.setPrimary('insert');
    this.player.update(0, 0);
    this.checkpoint('start');
    this.hud.showIntro(() => this.beginPlay());
  }
  // Compile every material the mission can show before the first frame: a gateway opening or the first blood
  // spray must not stall on shader compilation (a visible hitch on phones).
  _warmShaders() {
    const r = this.renderer, ps = this.portals;
    const shown = [];
    if (ps) for (const e of ps.ends) { if (!e.group.visible) { e.group.visible = true; shown.push(e.group); } }
    try { r.compile(this.scene, this.camera); } catch (err) { /* compile is best-effort */ }
    for (const grp of shown) grp.visible = false;
  }
  beginPlay() {
    this._warmShaders();
    if (this.state !== 'intro') return;
    if (this.hud.introEl) { this.hud.introEl.remove(); this.hud.introEl = null; }
    this.audio.start(); this.audio.resume();
    if (this.isTouch) this._enterFullscreen();
    this.state = 'playing';
    this.lastFrame = performance.now();
    this.hud.hint('move'); setTimeout(() => { if (this.state === 'playing' && !this.hud.tutKey) this.hud.hint('aim'); }, 9000);
    this.input.lock();
  }
  // Phones: play full-screen and sideways when the browser allows it (must be called from a tap).
  _enterFullscreen() {
    try {
      const c = document.documentElement;
      const req = c.requestFullscreen || c.webkitRequestFullscreen;
      if (req && !document.fullscreenElement) { const p = req.call(c); if (p && p.catch) p.catch(() => {}); }
      if (screen.orientation && screen.orientation.lock) { const p = screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* not available */ }
  }
  spawnEnemy(def) {
    const e = new Enemy(this, { position: new THREE.Vector3(def.x, def.y || 0, def.z), yaw: def.yaw, patrol: def.patrol, accuracy: def.accuracy, role: def.role, name: def.name, grenades: def.grenades, zone: def.zone, look: def.look, armor: def.armor, ...(def.maxHealth ? { maxHealth: def.maxHealth } : {}) });
    e.id = this._enemyId++;
    e.aimYaw = e.yaw; e.scanYaw = e.yaw; e.homeYaw = e.yaw;
    this.enemies.push(e); this.characters.push(e);
    return e;
  }
  _clearEntities() {
    for (const c of this.characters) c.dispose();
    for (const g of this.grenades) if (g.alive) this.scene.remove(g.mesh);
    this.characters = []; this.enemies = []; this.hostages = []; this.grenades = [];
    if (this.script && this.script.heli) { this.scene.remove(this.script.heli.grp); }
    this.heliDown = false;
  }
  _resetLights() {
    const L = this.level; L.power = true;
    for (const l of L.floodlights) { l.intensity = l.userData.baseIntensity; if (l.userData.fixture) l.userData.fixture.material = this.mats.get('emissiveWarm'); if (l.userData.cone) l.userData.cone.visible = true; }
    this.hud.tutorial(null);
    for (const l of L.roomLights) { l.intensity = l.userData.baseIntensity; if (l.userData.fixture) l.userData.fixture.material = this.mats.get(l.userData.kind === 'cool' ? 'emissiveCool' : 'emissiveWarm'); }
    for (const l of L.emergency) { l.intensity = 0; l.userData.fixture.material = this.mats.get('lightHousing'); }
    if (L.fuseLed) L.fuseLed.material = this.mats.get('emissiveGreen');
  }

  quitToMenu() {
    this._clearEntities();
    this.portals.reset();
    this.state = 'menu'; this.mode = 'ground'; this.tacmap.active = false; this.tacmap.markers.visible = false;
    this.postfx.state.architect = 0; this.audio.setSlowMotion(false); this.timeScaleTarget = 1; this.timeScale = 1; this.focus = 0;
    this.hud.hide(); this.hud.setMap(false); this.menus.show('main'); this.input.unlock();
    this.camera = this.menuCamera; this.postfx.setCamera(this.camera);
    this.player = null;
  }
  pause(fromLock = false) {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.menus.show('pause'); this.input.unlock(); this.audio.setSlowMotion(true);
    if (this.touch) this.touch.setVisibleButtons(false);
  }
  showClickToResume() { if (this.state !== 'playing') return; this.state = 'paused'; this.menus.show('click'); this.audio.setSlowMotion(true); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.menus.hide(); this.audio.setSlowMotion(this.mode === 'map' || this.focus > 0); this.input.lock(); this.lastFrame = performance.now(); }
  resumeFromClick() { this.resume(); }

  missionComplete() {
    if (this.state !== 'playing') return;
    this.state = 'end'; this.audio.ui('win'); this.input.unlock(); this.audio.setSlowMotion(true);
    if (this.touch) this.touch.setVisibleButtons(false);
    if (this.tacmap.active) this.tacmap.exit();
    this.hud.hide(); this.menus.showEnd(true, null, this._endStats());
  }
  missionFailed(reason) {
    if (this.state !== 'playing') return;
    this.state = 'end'; this.audio.ui('fail'); this.audio.setSlowMotion(true);
    if (this.touch) this.touch.setVisibleButtons(false);
    if (this.tacmap.active) this.tacmap.exit();
    setTimeout(() => { this.input.unlock(); this.hud.hide(); this.menus.showEnd(false, reason, this._endStats()); }, 1800);
  }
  rank() {
    const s = this.stats;
    if (s.reports === 0) return 'ghost';
    if (s.loudShots > 20 || s.alarmKills >= 8) return 'loud';
    return 'operative';
  }
  _endStats() { const s = this.stats; return { time: this.time, kills: s.kills, knife: s.knifeKills, portals: s.portals, reports: s.reports, chain: s.longestChain || 0, hidden: s.bodiesHidden || 0, hostages: this.hostages.filter((h) => h.alive && h.state === 'extracted').length, rank: this.rank() }; }

  // ---- events ----
  onPlayerDeath() { this.missionFailed('player'); }
  onCharacterDeath(ch, info) {
    if (!ch.isEnemy) return;
    const byPlayer = info.from && info.from.isPlayer;
    if (byPlayer) {
      this.stats.kills++; if (this.alarm) this.stats.alarmKills++;
      // a kill inside the focus window extends it and grows the chain
      if (this.focus > 0 && this.mode === 'ground') {
        this.addFocus(F.perKill);
        this.chain++; this.stats.longestChain = Math.max(this.stats.longestChain || 0, this.chain);
        if (this.chain >= 2) { this.hud.chain(this.chain); this.audio.chain(this.chain); }
      }
    }
    const wasReporting = ch.report.active; ch.report.active = false;
    if (wasReporting) { this.hud.toast(this.t('hud.reportCut'), 1600); this.audio.ui('objective'); }
    if (info.knife && info.silent) this.stats.silentKills = (this.stats.silentKills || 0) + 1;
    // everyone who watched it happen keys his radio
    _v.set(ch.pos.x, ch.pos.y + 1.0, ch.pos.z);
    for (const e of this.enemies) {
      if (e === ch || !e.alive) continue;
      const seen = canSeePoint(this, e, _v, CONFIG.enemy.fovDeg, e.visionRange() * 0.9);
      if (!seen) continue;
      e.seenBodies.add(ch);
      e.witnessed('kill', ch.pos);
      if (e.state !== 'combat') { e.state = 'search'; e.investigate = (seen.image || ch.pos).clone(); e.lastKnown.copy(e.investigate); e.searchUntil = this.time + CONFIG.enemy.searchTime; e.alertLevel = Math.max(e.alertLevel, 1); }
    }
    this.script && this.script.onEnemyDeath(ch, info);
  }
  onHostageFreed(h) { this.script && this.script.onHostageFreed(h); this.audio.ui('objective'); }
  onEnemyAlert(e, target) {
    if (target === this.player) { if (this.time - (this._lastAlertToast || -10) > 6) { this._lastAlertToast = this.time; this.hud.alert('hud.alert.spotted'); this.audio.ui('alert'); } }
    // shouting to the guards nearby
    setTimeout(() => { if (e.alive && e.state === 'combat') this.emitNoise(e.pos, 22, e, 'radio'); }, CONFIG.enemy.alertRadioDelay * 1000 / Math.max(0.2, this.timeScale));
  }
  onEnemySuspicious() { if (this.time - (this._lastSusToast || -10) > 8) { this._lastSusToast = this.time; this.hud.alert('hud.alert.suspicious', 1600); } }
  onEnemyWitness(e, reason) {
    this.stats.witnesses++;
    this.audio.radioStart(e.pos);
    if (this.time - (this._lastWitnessToast || -10) > 4) { this._lastWitnessToast = this.time; this.hud.alert('hud.alert.witness', 2200); }
    this.hud.callout('radio' + (reason === 'body' ? 2 : reason === 'portal' ? 3 : reason === 'gunshot' ? 4 : 1), null);
    this.script && this.script.onWitness && this.script.onWitness(e, reason);
  }
  raiseAlarm(e, reason, pos) {
    if (this.alarm) return;
    this.alarm = true; this.alarmTime = this.time; this.stats.reports++;
    this.audio.alarm(); this.hud.alert('hud.alert.alarm', 3600); this.hud.hint('alarm');
    const p = pos ? pos.clone() : e.pos.clone();
    for (const g of this.enemies) if (g.alive) g.onAlarm(p);
    // two guards to each captive prisoner
    for (const h of this.hostages) {
      if (!h.alive || h.state !== 'captive') continue;
      const near = this.enemies.filter((g) => g.alive && g !== e && !g.post).sort((a, b) => a.pos.distanceTo(h.pos) - b.pos.distanceTo(h.pos)).slice(0, 2);
      near.forEach((g, i) => { const a = h.yaw + Math.PI + (i ? 0.9 : -0.9); g.assignPost(new THREE.Vector3(h.pos.x + Math.sin(a) * 2.2, h.pos.y, h.pos.z + Math.cos(a) * 2.2), a + Math.PI); });
    }
    this.script && this.script.onAlarm && this.script.onAlarm(p, reason);
  }
  // a guard is about to step through your gateway: a flash at the end he will come out of, and a warning
  onGuardAtGateway(e, end) {
    const other = this.portals.other(end);
    this.fx.portalBurst(other.center.clone(), 0.8); this.audio.portalClose(other.center.clone());
    this.hud.alert('hud.alert.gateGuard', 2000); this.audio.ui('alert');
    this.stats.gateIntrusions = (this.stats.gateIntrusions || 0) + 1;
  }
  onPortalNoticed(e, end) { if (this.time - (this._lastPortalHint || -30) > 25) { this._lastPortalHint = this.time; this.hud.hint('portalSeen'); } }
  onPortalOpened(sys) { this.stats.portals++; this.script && this.script.onPortalOpened && this.script.onPortalOpened(sys); }
  onPortalTraversal(c, from, to) { if (c.isPlayer) { this.script && this.script.onPortalTraversal && this.script.onPortalTraversal(c); } }
  onBodyLanded(b) { /* hook for scripts */ }
  onExplosion(pos) { this.emitNoise(pos, 60, null, 'explosion'); this.postfx.state.flash = 0.6; if (this.player) this.player.shake = Math.min(1, this.player.shake + Math.max(0, 1 - pos.distanceTo(this.player.pos) / 20)); }

  emitNoise(pos, radius, source, kind) {
    for (const e of this.enemies) e.hear(pos, radius, source, kind);
    const m = this.portals && this.portals.mirrorNoise(pos, radius);
    if (m && m.radius > 0.5) for (const e of this.enemies) e.hear(m.pos, m.radius, source, kind);
  }
  hint(key) { this.hud.hint(key); }

  // ---- gateways / focus ----
  openPortalAt(point, opts = {}) {
    const res = this.portals.openFromPlayer(point, opts);
    if (res.ok) { this.audio.ui('click'); }
    return res;
  }
  quickPortal() {
    const p = this.player; if (!p || !p.alive || this.mode !== 'ground') return;
    if (p.lockTarget) {
      // the gateway opens behind the locked guard and you go straight through
      const res = this.portals.openBehind(p.lockTarget);
      if (res.ok) { this.audio.ui('click'); p.startDash(res.near); this.stats.locks = (this.stats.locks || 0) + 1; this.script && this.script.onLockGate && this.script.onLockGate(p.lockTarget); }
      else { this.hud.toast(res.reason); this.audio.moduleInvalid(); }
      return;
    }
    const cam = p.camera; cam.getWorldDirection(_v);
    const hit = this.world.raycast(cam.position, _v, 45, (c) => c.blocksMovement && c.tag !== 'door');
    let point;
    if (hit) { point = hit.point.clone(); if (hit.normal.y < 0.5) point.addScaledVector(hit.normal, 0.9); else point.addScaledVector(_v2.set(_v.x, 0, _v.z).normalize(), 0.3); }
    else { const t = _v.y < -0.02 ? -cam.position.y / _v.y : 30; point = cam.position.clone().addScaledVector(_v, Math.min(30, t)); point.y = Math.max(0, point.y); }
    const res = this.openPortalAt(point, { hintYaw: p.camYaw, radius: 3.5 });
    if (!res.ok) { this.hud.toast(res.reason); this.audio.moduleInvalid(); }
  }
  closePortal() { if (this.portals.active) { this.portals.close(); } }
  addFocus(sec) { this.focus = Math.min(F.max, this.focus + sec); if (this.mode === 'ground') this.audio.setSlowMotion(true); }

  // ---- checkpoints ----
  checkpoint(id) {
    this.checkpointData = {
      id, time: this.time,
      player: this.player.snapshot(), hostages: this.hostages.map((h) => h.snapshot()),
      enemies: this.enemies.map((e) => e.snapshot()), enemyDefs: this.enemies.map((e) => ({ patrol: e.patrol.map((p) => [p.x, p.z]), role: e.role, accuracy: e.accuracy, name: e.name, zone: e.zoneName })),
      portals: this.portals.snapshot(), script: this.script.snapshot(), stats: { ...this.stats }, alarm: this.alarm, alarmTime: this.alarmTime,
      explosives: this.level.explosives.map((b) => b.alive),
    };
    if (id !== 'start') { this.hud.toast(this.t('hud.checkpoint')); this.audio.ui('checkpoint'); }
  }
  restoreCheckpoint() {
    const d = this.checkpointData; if (!d) { this.startMission(); return; }
    this.audio.start();
    if (this.tacmap.active) this.tacmap.exit();
    for (const e of this.enemies) { e.dispose(); const i = this.characters.indexOf(e); if (i >= 0) this.characters.splice(i, 1); }
    this.enemies = [];
    this.alarm = d.alarm; this.alarmTime = d.alarmTime;
    d.enemies.forEach((s, i) => { const def = d.enemyDefs[i]; const e = this.spawnEnemy({ x: s.pos[0], y: s.pos[1], z: s.pos[2], yaw: s.yaw, patrol: def.patrol, role: def.role, accuracy: def.accuracy, name: def.name, grenades: s.grenades, zone: def.zone }); e.restore(s); });
    this.player.restore(d.player);
    this.hostages.forEach((h, i) => h.restore(d.hostages[i]));
    for (const g of this.grenades) if (g.alive) this.scene.remove(g.mesh); this.grenades = [];
    this.portals.restore(d.portals); this.tacmap.reset();
    d.explosives.forEach((alive, i) => { const b = this.level.explosives[i]; if (alive) b.reset(); else if (b.alive) { b.alive = false; b.mesh.visible = false; this.world.remove(b.collider); } });
    this._resetLights();
    this.script.restore(d.script);
    this.stats = { ...d.stats }; this.time = d.time; this.focus = 0;
    this.state = 'playing'; this.mode = 'ground';
    this.camera = this.player.camera; this.postfx.setCamera(this.camera);
    this.postfx.state.damage = 0; this.postfx.state.architect = 0; this.audio.setSlowMotion(false); this.timeScale = 1; this.timeScaleTarget = 1;
    this.hud.show(); this.menus.hide(); this.input.lock();
    this.player.update(0, 0);
  }

  // ---- settings ----
  applySettings(s) {
    const q = s.quality;
    if (this.settings && this.settings.quality !== q) { this._repairStep = 0; this._blackFrames = 0; this._checksLeft = 12; this.postfx.enabled = true; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; }
    const caps = this.isTouch ? { low: 1, medium: 1.2, high: 1.5, ultra: 2 } : { low: 1, medium: 1.25, high: 1.5, ultra: CONFIG.render.maxPixelRatio };
    let pr = Math.min(window.devicePixelRatio || 1, caps[q] || 1.5);
    if (this.isTouch) { const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight; pr = Math.min(pr, Math.sqrt(1.15e6 / Math.max(1, w * h))); }
    this.renderer.setPixelRatio(pr);
    this.renderer.toneMappingExposure = CONFIG.render.exposure * (s.brightness ?? 1);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.moon.shadow.mapSize.setScalar(q === 'ultra' ? 4096 : q === 'high' ? 2048 : 1024); if (this.moon.shadow.map) { this.moon.shadow.map.dispose(); this.moon.shadow.map = null; }
    for (const l of this.builder.lights.flood) { l.castShadow = l.castShadow && q !== 'low' && !(this.isTouch && q === 'medium'); }
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
    for (const c of [this.menuCamera, this.tacmap && this.tacmap.camera, this.player && this.player.camera]) if (c) { c.aspect = w / h; c.updateProjectionMatrix(); }
    this.postfx.setSize(w, h);
  }

  _bindGlobalKeys() {
    this.input.on('keydown', (code, e) => {
      if (this.state === 'intro') return;
      if (this.state === 'playing') {
        if (code === 'Escape') { this.pause(); return; }
        if (code === 'Tab') { e.preventDefault(); if (this.player.alive) this.tacmap.toggle(); }
        if (code === 'KeyQ' && this.mode === 'ground') this.quickPortal();
        if (code === 'KeyC') { if (this.portals.active) { this.closePortal(); this.hud.toast(this.t('portal.closed'), 1200); } }
      } else if (this.state === 'paused' && code === 'Escape') this.resume();
      else if (this.state === 'menu' && (code === 'Enter' || code === 'Space')) this.startMission();
    });
  }

  // ---- main loop ----
  _loop(now) {
    requestAnimationFrame(this._loop);
    let realDt = Math.min(0.05, (now - this.lastFrame) / 1000); this.lastFrame = now;
    if (!(realDt > 0)) realDt = 0.016;
    if (this.debugFrozen || this.contextLost) return;
    try {
      this._frame(realDt, true);
    } catch (e) {
      console.error('VANTAGE frame error:', e);
      if (!this._frameErrors) this._frameErrors = 0;
      if (++this._frameErrors === 3) this.showTrouble(this.t('trouble.frame'), e && e.message);
    }
    this.frameMs += (realDt * 1000 - this.frameMs) * 0.05;
    if (this.state === 'playing') { this._watchdog(realDt); this._checkPerformance(realDt); }
    else if (this.state === 'menu') this._watchdog(realDt);
  }
  _frame(realDt, render) {
    this.realTime += realDt;
    if (this.touch && this.state !== 'playing') this.touch.setVisibleButtons(false);
    if (this.state === 'menu') { this._updateMenu(realDt); }
    else if (this.state === 'playing') { this._updatePlaying(realDt); }
    else if (this.state === 'end' || this.state === 'paused' || this.state === 'intro') { this.fx.update(0, this.camera); this.postfx.update(realDt, this.realTime); if (this.portals) this.portals.update(0, realDt * 0.0001); }
    this._updateEnvironment(realDt);
    this.audio.update(realDt, this.state === 'menu');
    const ht = this.profile ? performance.now() : 0;
    this.hud.update(realDt);
    if (this.profile) this._prof('hud', ht);
    if (render) { this._render(); this._pendingSample = true; }
    this.input.endFrame();
  }
  _render() {
    this._renderFrame = (this._renderFrame || 0) + 1;
    this.renderer.shadowMap.needsUpdate = !this.isTouch || (this._renderFrame & 1) === 0;
    if (this.portals) this.portals.render(this.renderer, this.scene, this.camera);
    this.postfx.render();
  }

  _checkPerformance(realDt) {
    if (this._autoQualityDone || this.realTime < 4) return;
    if (this.frameMs > (this.isTouch ? 48 : 90)) this._slowTime += realDt; else this._slowTime = Math.max(0, this._slowTime - realDt * 0.5);
    if (this._slowTime < 4) return;
    this._slowTime = 0;
    const order = ['ultra', 'high', 'medium', 'low'];
    const i = order.indexOf(this.settings.quality);
    if (i >= 0 && i < order.length - 1) {
      const next = order[i + 1];
      this.menus.settings.quality = next; this.menus.saveSettings();
      this.hud.toast(this.t('trouble.slow', { q: this.t('menu.quality.' + next) }), 5000);
      this._repairStep = 0;
    } else { this._autoQualityDone = true; this.postfx.enabled = false; }
  }

  // ---- black-screen / performance watchdog ----
  _watchdog(realDt) {
    if (this._checksLeft <= 0 || this._repairStep > 3) return;
    this._sinceCheck += realDt;
    if (this._sinceCheck < 0.6) return;
    this._sinceCheck = 0;
    const lum = this._sampleCanvas();
    if (lum === null) return;
    this._checksLeft--;
    if (lum > 1) { this._blackFrames = 0; return; }
    if (++this._blackFrames < 2) return;
    this._blackFrames = 0; this._checksLeft = 12;
    this._repair();
  }
  _sampleCanvas() {
    if (!this._pendingSample) return null;
    this._pendingSample = false;
    const gl = this.renderer.getContext();
    if (!gl || gl.isContextLost()) return null;
    const c = this.renderer.domElement, w = c.width, h = c.height;
    if (!w || !h) return null;
    try {
      this.renderer.setRenderTarget(null);
      const buf = this._sampleBuf || (this._sampleBuf = new Uint8Array(4));
      let max = 0;
      for (const [fx, fy] of [[0.5, 0.55], [0.3, 0.7], [0.7, 0.7], [0.5, 0.85], [0.15, 0.4], [0.85, 0.4]]) {
        gl.readPixels(Math.min(w - 1, Math.floor(fx * w)), Math.min(h - 1, Math.floor(fy * h)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        max = Math.max(max, buf[0], buf[1], buf[2]);
      }
      return max;
    } catch (e) { return null; }
  }
  _repair() {
    const step = ++this._repairStep;
    if (step === 1 && this.postfx.enabled) { this.postfx.enabled = false; console.warn('VANTAGE: black frame detected — disabling post-processing'); this.hud.toast(this.t('trouble.postfx'), 5000); return; }
    if (step <= 2) { this.renderer.shadowMap.enabled = false; this.renderer.setPixelRatio(1); this.postfx.enabled = false; this.resize(); console.warn('VANTAGE: black frame persists — disabling shadows and lowering resolution'); this.hud.toast(this.t('trouble.quality'), 5000); return; }
    if (step === 3) { this.renderer.toneMapping = THREE.NoToneMapping; this.scene.traverse((o) => { if (o.isLight && o.isPointLight) o.visible = false; }); console.warn('VANTAGE: black frame persists — stripping tone mapping and point lights'); return; }
    this.showTrouble(this.t('trouble.black'), this.rendererInfo());
  }
  rendererInfo() {
    try {
      const gl = this.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) + ' · ' + (this.settings ? this.settings.quality : '?');
    } catch (e) { return 'unknown renderer'; }
  }
  showTrouble(text, detail) {
    if (this._troubleEl) return;
    const d = document.createElement('div'); d.className = 'trouble';
    d.innerHTML = `<b>${text}</b>${detail ? `<span>${String(detail).slice(0, 160)}</span>` : ''}`;
    const b = document.createElement('button'); b.textContent = this.t('trouble.dismiss');
    b.onclick = () => { d.remove(); this._troubleEl = null; };
    d.appendChild(b);
    this.container.appendChild(d); this._troubleEl = d;
  }
  _bindContextEvents() {
    const c = this.renderer.domElement;
    c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.contextLost = true; if (this.state === 'playing') this.pause(true); console.warn('VANTAGE: WebGL context lost'); this.showTrouble(this.t('trouble.contextLost'), this.rendererInfo()); }, false);
    c.addEventListener('webglcontextrestored', () => { this.contextLost = false; if (this._troubleEl) { this._troubleEl.remove(); this._troubleEl = null; } this.postfx.enabled = false; this.renderer.shadowMap.enabled = false; this.renderer.setPixelRatio(1); this.resize(); this.lastFrame = performance.now(); this._checksLeft = 12; this._repairStep = 2; console.warn('VANTAGE: WebGL context restored (running in reduced mode)'); this.hud.toast(this.t('trouble.restored'), 6000); }, false);
  }

  // Only the lights nearest the camera stay active; the count is held constant so shaders never recompile mid-game.
  _updateLightBudget() {
    const pools = this._lightPools || (this._lightPools = [
      { list: this.builder.lights.points, budget: this.isTouch ? 5 : 8 },
      { list: this.builder.lights.flood.concat(this.builder.lights.spots), budget: this.isTouch ? 3 : 4 },
    ]);
    const cam = this.camera.position;
    for (const { list, budget } of pools) {
      if (list.length <= budget) { for (const l of list) l.visible = true; continue; }
      for (const l of list) {
        const d = Math.hypot(l.position.x - cam.x, l.position.y - cam.y, l.position.z - cam.z);
        l._score = d - (l.intensity > 0 ? 400 : 0) - (l.castShadow ? 1e5 : 0);
      }
      list.sort((a, b) => a._score - b._score);
      for (let i = 0; i < list.length; i++) list[i].visible = i < budget;
    }
  }
  // Test/debug helpers: advance the simulation without rendering (deterministic, fast).
  debugStep(seconds, step = 1 / 60) { const n = Math.round(seconds / step); for (let i = 0; i < n; i++) this._frame(step, false); }
  debugRender() { this._render(); }

  _updateMenu(realDt) {
    this.menuOrbit += realDt * 0.05;
    const c = this.menuCamera; const r = 48;
    c.position.set(Math.sin(this.menuOrbit) * r, 22 + Math.sin(this.menuOrbit * 0.7) * 4, Math.cos(this.menuOrbit) * r + 2);
    c.lookAt(0, 2, 2);
    this.fx.update(realDt, c); this.postfx.state.architect = 0.35; this.postfx.update(realDt, this.realTime);
    this._updateShadowFocus(new THREE.Vector3(0, 0, 0));
    this._lightTimer = (this._lightTimer || 0) - realDt;
    if (this._lightTimer <= 0) { this._lightTimer = 0.25; this._updateLightBudget(); }
    this.audio.setListener(c.position, c.getWorldDirection(_v), new THREE.Vector3(1, 0, 0));
  }

  _prof(name, t0) { if (!this.profile) return; this.profile[name] = (this.profile[name] || 0) + (performance.now() - t0); }
  _updatePlaying(realDt) {
    const P = this.profile; let t0 = P ? performance.now() : 0;
    if (this.touch) this.touch.update(realDt);
    // clocks: the map freezes the world almost still; focus slows the world while you keep most of your speed
    if (this.focus > 0) { this.focus -= realDt; if (this.focus <= 0) { this.focus = 0; this.chain = 0; this.hud.chain(0); if (this.mode === 'ground') this.audio.setSlowMotion(false); } }
    const focused = this.focus > 0 && this.mode === 'ground';
    this.timeScaleTarget = this.mode === 'map' ? CONFIG.mapTimeScale : focused ? F.worldScale : 1;
    this.timeScale += (this.timeScaleTarget - this.timeScale) * Math.min(1, realDt * 8);
    const dt = realDt * this.timeScale;
    const playerDt = this.mode === 'map' ? dt : realDt * Math.max(this.timeScale, focused ? F.playerScale : 0);
    this.time += dt; this.dt = dt;
    this.player.update(playerDt, realDt);
    if (P) { this._prof('player', t0); t0 = performance.now(); }
    this.tacmap.update(realDt, dt);
    if (P) { this._prof('map', t0); t0 = performance.now(); }
    this.hemi.intensity = 0.95 + this.tacmap.transition * 1.9;
    this.camera = this.mode === 'map' ? this.tacmap.camera : this.player.camera;
    if (this.postfx.camera !== this.camera) this.postfx.setCamera(this.camera);
    this._visTimer = (this._visTimer || 0) - dt;
    if (this._visTimer <= 0) { this._visTimer = 0.1; this._updateVisibility(); }
    if (P) { this._prof('visibility', t0); t0 = performance.now(); }
    for (const c of this.characters) if (!c.isPlayer) { const ct = P ? performance.now() : 0; c.update(dt); if (P) this._prof(c.isEnemy ? 'enemies' : 'hostages', ct); }
    if (P) t0 = performance.now();
    separateCharacters(this.characters, dt);
    // gateways: crossings, animation, hum
    this.portals.update(dt, realDt);
    // doors
    for (const d of this.level.doors) { d.update(dt, this.characters); if (d.navDirty) { d.navDirty = false; this.nav.rebuildRegion(d.collider.minX, d.collider.minZ, d.collider.maxX, d.collider.maxZ); } }
    for (let i = this.grenades.length - 1; i >= 0; i--) { const g = this.grenades[i]; g.update(dt); if (!g.alive) this.grenades.splice(i, 1); }
    for (const b of this.level.explosives) b.update(dt);
    // a fallen guard's kit restocks you: pistol rounds always, carbine rounds once you carry the M4
    if (this.player.alive) for (const e of this.enemies) {
      if (e.alive || e.looted || !e._rifleDropped || e.carriedBy) continue;
      if (e.rifle.position.distanceToSquared(this.player.pos) < 1.6 * 1.6) {
        e.looted = true; e.rifle.visible = false;
        const parts = [];
        const pg = this.player.weapons.pistol; const addP = Math.min(12, pg.cfg.reserve * 2 - pg.reserve); if (addP > 0) { pg.reserve += addP; parts.push('+' + addP); }
        const rg = this.player.weapons.rifle; if (rg) { const addR = Math.min(30, rg.cfg.reserve * 2 - rg.reserve); if (addR > 0) { rg.reserve += addR; parts.push('+' + addR + ' M4'); } }
        if (parts.length) { this.hud.toast(parts.join(' · ') + ' ' + this.t('hud.rounds'), 1500); this.audio.ui('click'); }
      }
    }
    for (const id in this.level.zones) { const z = this.level.zones[id]; const inside = z.contains(this.player.pos); if (inside && !z.wasInside) { z.wasInside = true; this.script.onZoneEnter(id); } else if (!inside) z.wasInside = false; }
    if (P) { this._prof('doors+grenades+zones', t0); t0 = performance.now(); }
    this.script.update(dt);
    this.fx.update(dt, this.camera);
    this.postfx.update(realDt, this.realTime);
    this._lightTimer = (this._lightTimer || 0) - realDt;
    if (this._lightTimer <= 0) { this._lightTimer = 0.25; this._updateLightBudget(); }
    this._updateSearchlights(dt);
    if (P) { this._prof('script+fx', t0); t0 = performance.now(); }
    this._updateShadowFocus(this.player.pos);
    const cam = this.camera; cam.getWorldDirection(_v);
    this.audio.setListener(cam.position, _v, new THREE.Vector3().crossVectors(_v, new THREE.Vector3(0, 1, 0)).normalize());
    // music tension
    let tension = this.alarm && this.time - this.alarmTime < 40 ? 1 : 0;
    for (const e of this.enemies) if (e.alive) { if (e.state === 'combat') tension = 1; else if (e.report.active) tension = Math.max(tension, 0.75); else if (e.state !== 'patrol' && e.state !== 'post') tension = Math.max(tension, 0.4); }
    if (this.script.objectives.hold === 'active') tension = Math.max(tension, 0.7);
    this.audio.setTension(tension);
  }

  _updateVisibility() {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) { e.seenByFriendly = false; continue; }
      let seen = false;
      if (p.alive) { const saveYaw = p.aimYaw; p.aimYaw = p.camYaw; seen = !!canSeeVia(this, p, e, 130, 70); p.aimYaw = saveYaw; }
      e.seenByFriendly = seen;
      if (seen) e.lastSeenT = this.time;
    }
  }

  _updateSearchlights(dt) {
    for (const sl of this.level.searchlights || []) {
      const pts = sl.points; if (pts.length < 2) continue;
      sl.t = (sl.t || 0) + dt * sl.speed;
      const seg = Math.floor(sl.t) % (pts.length - 1), k = sl.t % 1;
      const fwd = Math.floor(sl.t / (pts.length - 1)) % 2 === 0;
      const i = fwd ? seg : pts.length - 2 - seg;
      const a = pts[fwd ? i : i + 1], b = pts[fwd ? i + 1 : i];
      const x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k;
      sl.light.target.position.set(x, 0, z); sl.light.target.updateMatrixWorld();
      if (sl.light.userData.cone) { const c = sl.light.userData.cone; const dir = new THREE.Vector3(x - c.position.x, -c.position.y, z - c.position.z).normalize(); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); }
    }
  }

  _updateShadowFocus(center) {
    const m = this.moon;
    m.position.set(center.x - 35, 55, center.z + 45); m.target.position.set(center.x, 0, center.z); m.target.updateMatrixWorld();
  }

  _updateEnvironment(realDt) {
    this.sky.material.uniforms.uTime.value = this.realTime;
    const L = this.lightning; L.t -= realDt;
    if (L.t <= 0) { L.t = 20 + Math.random() * 40; L.flash = 1; this.postfx.state.flash = Math.max(this.postfx.state.flash, 0.35); setTimeout(() => { if (this.audio.ctx) { this.audio._noise(this.audio.ambBus, { dur: 1.6, filter: 'lowpass', freq: 220, freqEnd: 60, gain: 0.9, attack: 0.05, decay: 0.7 }); } }, 600 + Math.random() * 800); }
    if (L.flash > 0) { L.flash = Math.max(0, L.flash - realDt * 4); this.moon.intensity = 1.35 + L.flash * 6; this.sky.material.uniforms.uFlash.value = L.flash * 0.25; }
    else { this.moon.intensity = 1.35; this.sky.material.uniforms.uFlash.value = 0; }
  }
}
