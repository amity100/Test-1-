import * as THREE from 'three';
import { FEEL, IS_TOUCH, QualityName } from '../config';
import { Input } from '../engine/input';
import { TouchControls } from '../engine/touch';
import { Audio } from '../engine/audio';
import { Renderer } from '../render/renderer';
import { createBeam, createSky, LampSystem, Rain } from '../render/fx';
import { buildHarbor, LevelData } from '../world/harbor';
import { NavGrid } from '../world/nav';
import { radial } from '../world/textures';
import { CameraRig } from './camera';
import { Character, CharacterAsset } from './characters';
import { Body, Guard, GuardSystem } from './guards';
import { Player } from './player';
import { Placement, Portal, RiftSystem } from './portals';
import { HUD } from '../ui/hud';
import { t } from '../ui/i18n';
import { orientFrame } from './portalMath';

export interface Settings {
  quality: QualityName;
  sensitivity: number;
  invertY: boolean;
  slowmo: boolean;
}

export interface MissionStats {
  time: number;
  detections: number;
  kills: number;
  bodiesFound: number;
  rifts: number;
}

type Mode = 'menu' | 'playing' | 'paused' | 'ended';

const _v = new THREE.Vector3();

export class Game {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FEEL.fov, 1, 0.08, 1200);
  renderer: Renderer;
  input: Input;
  touch: TouchControls | null = null;
  audio = new Audio();
  hud: HUD;
  level!: LevelData;
  nav!: NavGrid;
  rift!: RiftSystem;
  guards!: GuardSystem;
  player!: Player;
  rig: CameraRig;
  lamps!: LampSystem;
  rain!: Rain;
  sky: THREE.Mesh;
  moon: THREE.DirectionalLight;
  mode: Mode = 'menu';
  time = 0;
  timeScale = 1;
  cineT = 0;
  damage = 0;
  flash = 0;
  anchorHold = -1;
  anchorFired = false;
  playerLight = 0;
  stats: MissionStats = { time: 0, detections: 0, kills: 0, bodiesFound: 0, rifts: 0 };
  obj = { manifest: false, keycard: false, generator: false, door: false, extracted: false };
  checkpoint = { pos: new THREE.Vector3(), yaw: 0 };
  hintsSeen = new Set<string>();
  private scryCam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 400);
  private helpers: THREE.Object3D[] = [];
  private muzzle: THREE.PointLight;
  private tracer: THREE.Line;
  private tracerT = 0;
  private objMarker: HTMLDivElement;
  private lastAlarm = 0;
  private startT = 0;
  onEnd: (win: boolean, stats: MissionStats, rating: string) => void = () => {};
  onPause: () => void = () => {};
  settings: Settings;
  private menuT = 0;
  private asset!: CharacterAsset;
  private envMap: THREE.Texture | null = null;
  private searchlights: { guard: Guard; spot: THREE.SpotLight; beam: THREE.Mesh; pool: THREE.Mesh }[] = [];
  private hintWall = false;
  private hintPlaza = false;

  constructor(private canvas: HTMLCanvasElement, private uiRoot: HTMLElement, settings: Settings) {
    this.settings = settings;
    this.renderer = new Renderer(canvas, settings.quality, this.scene, this.camera);
    this.input = new Input(canvas);
    this.input.sensitivity = settings.sensitivity;
    this.input.invertY = settings.invertY;
    this.hud = new HUD(uiRoot);
    this.hud.show(false);
    if (IS_TOUCH) {
      this.touch = new TouchControls(this.input, uiRoot);
      this.touch.show(false);
      this.input.lastDevice = 'touch';
    }
    this.rig = new CameraRig(this.camera);
    this.sky = createSky();
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.21, 0.16, 0.17, THREE.LinearSRGBColorSpace), 0.0062);
    this.scene.background = new THREE.Color(0x000000);
    const hemi = new THREE.HemisphereLight(0xa3b6dc, 0x4a3d33, 1.35);
    this.scene.add(hemi);
    // low evening sun (the field keeps its old name)
    this.moon = new THREE.DirectionalLight(0xffb880, 2.6);
    this.moon.castShadow = true;
    this.moon.shadow.bias = -0.0004;
    this.moon.shadow.normalBias = 0.03;
    const sc = this.moon.shadow.camera;
    sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 220;
    this.scene.add(this.moon, this.moon.target);
    this.muzzle = new THREE.PointLight(0xffc070, 0, 10, 2);
    this.scene.add(this.muzzle);
    this.tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), new THREE.LineBasicMaterial({ color: new THREE.Color(4, 3, 1.5), transparent: true }));
    this.tracer.visible = false;
    this.tracer.frustumCulled = false;
    this.scene.add(this.tracer);
    this.objMarker = document.createElement('div');
    this.objMarker.className = 'objmarker';
    this.objMarker.innerHTML = '<i></i><span></span>';
    this.hud.el.appendChild(this.objMarker);
  }

  async load(asset: CharacterAsset, envMap: THREE.Texture | null) {
    this.asset = asset;
    this.envMap = envMap;
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 0.9;
    const mobile = IS_TOUCH;
    this.level = buildHarbor(envMap, mobile);
    this.scene.add(this.level.root);
    this.nav = new NavGrid(this.level.world, this.level.navBounds);
    const preset = this.renderer.preset;
    this.lamps = new LampSystem(this.level.lamps, preset.lampLights, !mobile && preset.shadowMap >= 2048);
    this.scene.add(this.lamps.group);
    this.rain = new Rain(Math.round(preset.rainDrops * 0.3));
    this.scene.add(this.rain.mesh);
    this.moon.shadow.mapSize.set(preset.shadowMap, preset.shadowMap);

    this.rift = new RiftSystem(
      {
        world: this.level.world,
        snapTargets: () => this.guards.guards.filter((g) => g.alive).map((g) => ({ id: g.name, pos: g.pos, forward: g.forward(), aware: g.aware })),
        exposureAt: (p) => this.guards.exposureAt(p, this.lightAt(p, false)),
        lightAt: (p) => this.lightAt(p, false),
        inhibited: (p) => this.level.inhibitor.active && p.distanceTo(this.level.inhibitor.center) < this.level.inhibitor.radius,
      },
      this.scene,
      this.renderer.renderer,
      preset.portalScale,
      mobile ? 2 : 4,
    );
    this.rift.maxViews = preset.portalViews;
    (this.sky.material as THREE.ShaderMaterial).uniforms.uMoonDir.value.copy(this.level.sunDir);
    const holo = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 1.4), transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
    const ghostChar = new Character(asset, 'hologram', holo);
    ghostChar.update(0, 0);
    this.rift.ghostFigure = ghostChar.root;
    ghostChar.root.visible = false;
    this.rift.group.add(ghostChar.root);

    this.guards = new GuardSystem(this.level.world, this.nav, {
      bark: (g, key) => {
        if (g.pos.distanceTo(this.player.pos) < 30) this.hud.subtitle(`${g.name}: ${t(key)}`, 2.6);
      },
      shoot: (g, hit, target) => this.guardShot(g, hit, target),
      alarmRaised: () => {},
      bodyDiscovered: () => {
        this.stats.bodiesFound++;
        this.audio.sting('found');
      },
      becameSuspicious: () => this.audio.sting('suspicious'),
      becameAlert: () => {
        if (this.time - this.lastAlarm > 20) this.stats.detections++;
        this.lastAlarm = this.time;
        this.audio.sting('alert');
      },
    });
    this.guards.radioCheck = (g) => {
      const body = this.guards.bodies.find((b) => b.guard === g);
      const at = body ? body.pos : g.pos;
      this.audio.radio(at);
      if (at.distanceTo(this.player.pos) < 25) this.hud.subtitle(`RADIO: ${t('radioCheck', { name: g.name })}`, 3.5);
      setTimeout(() => {
        if (this.mode === 'playing' || this.mode === 'paused') this.guards.dispatchCheck(g);
      }, 6000);
    };
    this.scene.add(this.guards.group);
    this.level.guards.forEach((def, i) => {
      const c = new Character(asset, def.kind === 'heavy' || def.kind === 'sniper' ? 'heavy' : def.kind === 'officer' ? 'officer' : 'guard');
      this.guards.add(new Guard(def, c, i));
    });

    const heroChar = new Character(asset, 'hero');
    this.player = new Player(heroChar);
    this.scene.add(heroChar.root);
    this.helpers = [this.rift.ghost, this.rift.ghostRing, this.rift.ghostArrow, this.rift.beam, ghostChar.root, ...this.guards.guards.map((g) => g.fan)];

    // Pre-compile every shader variant (including clipped rift views) so the
    // first rift never hitches.
    const r = this.renderer.renderer;
    r.compile(this.scene, this.camera);
    const tmp = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    r.setRenderTarget(tmp);
    r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 10)];
    r.render(this.scene, this.camera);
    r.clippingPlanes = [];
    r.setRenderTarget(null);
    tmp.dispose();
    this.resetMission();
  }

  applySettings(s: Settings) {
    const qualityChanged = s.quality !== this.settings.quality;
    this.settings = s;
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    if (qualityChanged) {
      this.renderer.applyQuality(s.quality);
      this.rift?.setPortalScale(this.renderer.preset.portalScale);
      if (this.rift) this.rift.maxViews = this.renderer.preset.portalViews;
    }
  }

  // ------------------------------------------------------------------
  // Mission flow
  // ------------------------------------------------------------------

  resetMission() {
    const L = this.level;
    this.rift.reset();
    for (const b of this.guards.bodies) b.char.root.removeFromParent();
    this.guards.bodies = [];
    this.guards.group.clear();
    const defs = L.guards;
    const old = this.guards.guards;
    this.guards.guards = [];
    old.forEach((g) => g.char.dispose());
    defs.forEach((def, i) => {
      const c = new Character(this.asset, def.kind === 'heavy' || def.kind === 'sniper' ? 'heavy' : def.kind === 'officer' ? 'officer' : 'guard');
      this.guards.add(new Guard(def, c, i));
    });
    this.helpers = this.helpers.filter((h) => !(h as any).isMesh || !(h as THREE.Mesh).geometry.getAttribute('alpha'));
    this.helpers.push(...this.guards.guards.map((g) => g.fan));
    this.buildSearchlights();
    this.hintWall = false;
    this.hintPlaza = false;
    this.player.teleport(L.playerStart, L.playerYaw);
    this.player.health = FEEL.maxHealth;
    this.player.carrying = null;
    this.player.crouched = false;
    this.rig.yaw = L.playerYaw;
    this.rig.pitch = -0.15;
    this.rig.snapTo(this.player.pos);
    this.obj = { manifest: false, keycard: false, generator: false, door: false, extracted: false };
    L.inhibitor.active = true;
    ((L.doorMesh.userData.reader as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setRGB(4, 0.3, 0.3);
    this.nav.rebuild();
    this.stats = { time: 0, detections: 0, kills: 0, bodiesFound: 0, rifts: 0 };
    this.checkpoint = { pos: L.playerStart.clone(), yaw: L.playerYaw };
    this.hintsSeen.clear();
    this.hud.clearIcons();
    this.damage = 0;
    this.time = 0;
    this.lastAlarm = -100;
    this.refreshObjectives();
  }

  /** Searchlight towers: a real spot light plus a volumetric beam that follow the sniper's gaze. */
  private buildSearchlights() {
    for (const s of this.searchlights) {
      s.spot.removeFromParent();
      s.spot.target.removeFromParent();
      s.beam.removeFromParent();
      s.pool.removeFromParent();
    }
    this.searchlights = [];
    for (const g of this.guards.guards) {
      if (!g.def.sweep) continue;
      const spot = new THREE.SpotLight(0xf2f6ff, 0, 90, g.def.fov ?? 0.26, 0.35, 1.1);
      const beam = createBeam(0xdfe8ff, 48, (g.def.fov ?? 0.26) * 0.9);
      // the lit ellipse on the ground: exactly what the sniper is watching
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1, 40),
        new THREE.MeshBasicMaterial({ map: radial(128, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: new THREE.Color(1.3, 1.35, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 }),
      );
      pool.rotation.order = 'YXZ';
      pool.renderOrder = 12;
      this.scene.add(spot, spot.target, beam, pool);
      this.searchlights.push({ guard: g, spot, beam, pool });
    }
  }

  private updateSearchlights() {
    for (const s of this.searchlights) {
      const g = s.guard;
      const on = g.alive;
      s.beam.visible = on;
      s.pool.visible = on;
      s.spot.intensity = on ? 420 : 0;
      if (!on) continue;
      const eye = g.eye(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0));
      const f = g.forward();
      const pitch = 0.45;
      const dir = new THREE.Vector3(f.x * Math.cos(pitch), -Math.sin(pitch), f.z * Math.cos(pitch));
      s.spot.position.copy(eye).addScaledVector(f, 0.4);
      s.spot.target.position.copy(eye).addScaledVector(dir, 30);
      s.beam.position.copy(s.spot.position);
      s.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      const col = g.state === 'alert' ? [1.0, 0.35, 0.3] : g.suspicion > 0.3 ? [1.0, 0.85, 0.5] : [0.87, 0.91, 1.0];
      (s.beam.material as THREE.ShaderMaterial).uniforms.uColor.value.setRGB(col[0], col[1], col[2]);
      s.spot.color.setRGB(col[0], col[1], col[2]);
      const hit = this.level.world.raycast(s.spot.position, dir, 80);
      if (hit) {
        const dist = hit.distance;
        const r = Math.tan((g.def.fov ?? 0.26) * 0.9) * dist;
        s.pool.position.copy(hit.point).addScaledVector(hit.normal, 0.04);
        s.pool.rotation.set(-Math.PI / 2, g.yaw, 0);
        s.pool.scale.set(r, r / Math.max(0.3, Math.sin(pitch)), 1);
        (s.pool.material as THREE.MeshBasicMaterial).color.setRGB(col[0] * 0.9, col[1] * 0.9, col[2] * 0.9);
      } else s.pool.visible = false;
    }
  }

  start() {
    this.audio.unlock();
    this.mode = 'playing';
    this.input.active = true;
    this.hud.show(true);
    this.touch?.show(true);
    this.startT = performance.now();
    this.input.requestLock();
    setTimeout(() => this.hint('move', t('hintMove'), 6), 1200);
    setTimeout(() => this.hint('aim', this.deviceText('hintAimKbm', 'hintAimPad', 'hintAimTouch'), 9), 7800);
  }

  retryFromCheckpoint() {
    this.rift.reset();
    this.player.teleport(this.checkpoint.pos, this.checkpoint.yaw);
    this.player.health = FEEL.maxHealth;
    if (this.player.carrying) this.dropBody(false);
    this.rig.yaw = this.checkpoint.yaw;
    for (const g of this.guards.guards) {
      if (!g.alive) continue;
      g.state = 'patrol';
      g.suspicion = 0;
      g.alertLevel = 0;
      g.pos.copy(g.def.route[0]);
      g.path = [];
      g.routeIdx = 0;
      g.waitT = 0;
      g.investigateBody = null;
    }
    this.guards.globalAlarm = 0;
    this.damage = 0;
    this.mode = 'playing';
    this.input.active = true;
    this.hud.show(true);
    this.touch?.show(true);
    this.input.requestLock();
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.active = false;
    this.touch?.show(false);
    this.onPause();
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.input.active = true;
    this.touch?.show(true);
    this.input.requestLock();
  }

  quitToMenu() {
    this.mode = 'menu';
    this.input.active = false;
    this.hud.show(false);
    this.touch?.show(false);
    this.resetMission();
    document.exitPointerLock?.();
  }

  private end(win: boolean) {
    this.mode = 'ended';
    this.input.active = false;
    this.hud.show(false);
    this.touch?.show(false);
    document.exitPointerLock?.();
    this.stats.time = this.time;
    this.stats.rifts = this.rift.riftsOpened;
    const s = this.stats;
    const rating = !win ? '' : s.detections === 0 && s.kills === 0 ? t('ghost') : s.detections === 0 && s.bodiesFound === 0 ? t('shadow') : s.detections <= 1 ? t('assassin') : t('blunt');
    this.onEnd(win, { ...s }, rating);
  }

  private deviceText(kbm: any, pad: any, touch: any) {
    const d = this.input.lastDevice;
    return t(d === 'touch' ? touch : d === 'pad' ? pad : kbm);
  }

  private hint(key: string, html: string, dur = 7) {
    if (this.hintsSeen.has(key)) return;
    this.hintsSeen.add(key);
    this.hud.showHint(key, html, dur);
  }

  refreshObjectives() {
    this.hud.setObjectives([
      { text: t('objManifest'), done: this.obj.manifest },
      { text: t('objExtract'), done: this.obj.extracted },
      { text: t('objOptKeycard'), done: this.obj.keycard, optional: true },
      { text: t('objOptGenerator'), done: this.obj.generator, optional: true },
    ]);
  }

  // ------------------------------------------------------------------
  // Light
  // ------------------------------------------------------------------

  /** 0..1 illumination at a point from lamps, rifts and moonlight. */
  lightAt(p: THREE.Vector3, precise = true) {
    // dusk: open ground is readable; shade from walls and stacks still hides you
    let L = 0.26;
    if (!this.level.world.raycast(p, this.level.sunDir, 160, { sight: true })) L += 0.3;
    for (const l of this.level.lamps) {
      const d = l.pos.distanceTo(p);
      if (d > l.range) continue;
      _v.subVectors(p, l.pos).normalize();
      const cos = _v.dot(l.dir);
      const cone = THREE.MathUtils.smoothstep(cos, Math.cos(l.angle), Math.cos(l.angle * 0.55));
      if (cone <= 0) continue;
      const atten = Math.pow(1 - d / l.range, 1.3) * l.intensity;
      const c = cone * atten * 1.35;
      if (c < 0.02) continue;
      if (precise || c > 0.05) {
        const from = l.pos.clone().addScaledVector(l.dir, 0.3);
        if (!this.level.world.lineOfSight(from, p)) continue;
      }
      L += c;
    }
    return Math.min(1, L);
  }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  private tryOpenRift(pl: Placement) {
    if (pl.invalid) {
      this.audio.ui('deny');
      navigator.vibrate?.(40);
      return;
    }
    const near = this.rift.solveNear(this.player.pos, this.rig.yaw);
    this.rift.charges -= 1;
    const far = { frame: pl.frame, kind: pl.kind, host: pl.host };
    if (!near) {
      // no room in front: blink straight through
      this.instantPass(pl.exitFeet, pl.exitYaw);
      this.rift.riftsOpened++;
      this.audio.riftOpen(pl.frame.position);
      return;
    }
    const pair = this.rift.openPair(near, far, 'rift');
    this.audio.riftOpen(pair.a.position);
    this.audio.riftOpen(pair.b.position);
    navigator.vibrate?.(20);
    if (pl.snap === 'behind') this.hint('takedown', this.input.lastDevice === 'touch' ? t('hintTakedownTouch') : t('hintTakedown'), 7);
  }

  private instantPass(feet: THREE.Vector3, yaw: number) {
    const dy = yaw - this.player.yaw;
    this.player.teleport(feet.clone(), yaw);
    this.rig.rotateBy(dy);
    this.flash = 1;
    this.audio.whoosh();
  }

  private handleAnchor(realDt: number) {
    const inp = this.input;
    if (inp.wasPressed('anchor')) {
      this.anchorHold = 0;
      this.anchorFired = false;
    }
    if (this.anchorHold >= 0 && inp.isHeld('anchor')) {
      this.anchorHold += realDt;
      if (!this.anchorFired && this.anchorHold > FEEL.anchorHoldTime) {
        this.anchorFired = true;
        this.setAnchor();
      }
    }
    if (inp.wasReleased('anchor') && this.anchorHold >= 0) {
      if (!this.anchorFired) this.callAnchor();
      this.anchorHold = -1;
    }
  }

  private setAnchor() {
    const pl = this.rift.placement;
    if (this.rift.aiming && pl && !pl.invalid) {
      this.rift.anchor = { frame: pl.frame, kind: pl.kind, host: pl.host, exitFeet: pl.exitFeet.clone(), exitYaw: pl.exitYaw };
    } else {
      const f = this.player.forward();
      const base = this.player.pos.clone().addScaledVector(f, -0.55);
      const fr = this.rift.standingFrame(base.x, this.player.pos.y, base.z, f);
      this.rift.anchor = { frame: { ...fr, width: FEEL.portalWidth, height: FEEL.portalHeight }, kind: 'stand', host: null, exitFeet: this.player.pos.clone(), exitYaw: this.player.yaw };
    }
    this.audio.ui('confirm');
    navigator.vibrate?.(30);
    this.hud.flashToast(t('anchorSet'), 1.6, 'good');
    this.hint('anchorTip', t('anchorHint'), 6);
  }

  private callAnchor() {
    const a = this.rift.anchor;
    if (!a) {
      this.hud.flashToast(this.input.lastDevice === 'touch' ? t('noAnchorTouch') : t('noAnchor'), 2.2, 'warn');
      this.audio.ui('deny');
      return;
    }
    if (this.rift.charges < 1) {
      this.hud.flashToast(t('noCharge'), 1.6, 'warn');
      this.audio.ui('deny');
      return;
    }
    const inh = this.level.inhibitor;
    if (inh.active && (this.player.pos.distanceTo(inh.center) < inh.radius || a.exitFeet.distanceTo(inh.center) < inh.radius)) {
      this.hud.flashToast(t('inhibited'), 1.6, 'warn');
      this.audio.ui('deny');
      return;
    }
    if (a.exitFeet.distanceTo(this.player.pos) < 3) return;
    this.rift.charges -= 1;
    const near = this.rift.solveNear(this.player.pos, this.rig.yaw);
    if (!near) {
      this.instantPass(a.exitFeet, a.exitYaw);
      return;
    }
    const pair = this.rift.openPair(near, { frame: a.frame, kind: a.kind, host: a.host }, 'anchor');
    this.audio.riftOpen(pair.a.position, true);
    navigator.vibrate?.(20);
  }

  /** Decide what F does right now. */
  private contextAction(): { label: string; run: () => void } | null {
    const p = this.player;
    const fwd = p.forward();
    if (p.carrying) return { label: t('throw'), run: () => this.throwBody() };

    // snatch: guard waiting at the far end of a rift we're standing at
    for (const r of this.rift.openPortals()) {
      if (!r.isOpen || !r.linked.isOpen) continue;
      const toRift = _v.subVectors(r.position, p.pos).setY(0);
      const d = toRift.length();
      if (d > FEEL.snatchRange + 0.6) continue;
      if (_v.subVectors(p.pos, r.position).dot(r.normal) < 0) continue; // must be on the front side
      const far = r.linked;
      for (const g of this.guards.guards) {
        if (!g.alive || g.state === 'alert') continue;
        const gd = _v.subVectors(g.pos, far.position);
        const front = gd.dot(far.normal);
        if (front > -0.2 && Math.hypot(gd.x, gd.z) < 2.6 && Math.abs(g.pos.y - (far.position.y - far.height / 2)) < 1.2) {
          return { label: t('snatch'), run: () => this.snatch(g, r) };
        }
      }
    }

    // takedown
    let best: Guard | null = null, bd = FEEL.takedownRange;
    for (const g of this.guards.guards) {
      if (!g.alive || g.state === 'alert') continue;
      const d = g.pos.distanceTo(p.pos);
      if (d > bd || Math.abs(g.pos.y - p.pos.y) > 1) continue;
      const to = _v.subVectors(g.pos, p.pos).setY(0).normalize();
      if (to.dot(fwd) < 0.2 && d > 1.0) continue;
      if (g.def.kind === 'heavy') {
        // only from behind
        const behind = g.forward().dot(to) > 0.2;
        if (!behind) continue;
      }
      bd = d;
      best = g;
    }
    if (best) {
      const g = best;
      return { label: t('takedown'), run: () => this.takedown(g) };
    }
    // bodies
    for (const b of this.guards.bodies) {
      if (b.state !== 'lying') continue;
      const center = this.bodyCenter(b, new THREE.Vector3());
      if (center.distanceTo(p.pos) < 1.7 && Math.abs(b.pos.y - p.pos.y) < 1) return { label: t('grab'), run: () => this.grabBody(b) };
    }
    const L = this.level;
    // generator
    if (L.inhibitor.active && p.pos.distanceTo(L.inhibitor.generator) < 1.9) {
      return {
        label: t('sabotage'),
        run: () => {
          L.inhibitor.active = false;
          this.obj.generator = true;
          this.refreshObjectives();
          this.hud.flashToast(t('inhibitorDown'), 3, 'good');
          this.audio.ui('objective');
          this.guards.noise(L.inhibitor.generator, 7, 0.4);
        },
      };
    }
    // keycard elevator at the control tower base
    const reader = (L.doorMesh.userData.reader as THREE.Mesh).position;
    if (p.pos.y < 1 && p.pos.distanceTo(_v.set(reader.x, p.pos.y, reader.z)) < 2.2) {
      if (this.obj.keycard) {
        return {
          label: t('useKeycard'),
          run: () => {
            this.obj.door = true;
            ((L.doorMesh.userData.reader as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setRGB(0.3, 4, 0.5);
            this.audio.ui('confirm');
            this.flash = 0.6;
            const dy = 0 - this.player.yaw;
            this.player.teleport(L.elevatorTop.clone(), 0);
            this.rig.rotateBy(dy);
            this.rig.pivot.y = L.elevatorTop.y + FEEL.camHeight;
            this.hud.flashToast(t('doorOpened'), 2.2, 'good');
          },
        };
      }
      return { label: t('locked'), run: () => this.audio.ui('deny') };
    }
    // the same elevator, riding back down from the deck
    if (Math.abs(p.pos.y - L.elevatorTop.y) < 1 && p.pos.distanceTo(L.elevatorTop) < 2.2) {
      return {
        label: t('rideDown'),
        run: () => {
          this.audio.ui('confirm');
          this.flash = 0.6;
          const dy = Math.PI - this.player.yaw;
          this.player.teleport(new THREE.Vector3(24, 0, 52.4), Math.PI);
          this.rig.rotateBy(dy);
          this.rig.pivot.y = FEEL.camHeight;
        },
      };
    }
    // manifest
    if (!this.obj.manifest && Math.abs(p.pos.y - (L.manifest.y - 0.9)) < 1.2 && p.pos.distanceTo(_v.set(L.manifest.x, p.pos.y, L.manifest.z)) < 1.9) {
      return {
        label: t('takeManifest'),
        run: () => {
          this.obj.manifest = true;
          this.refreshObjectives();
          this.hud.flashToast(t('manifestTaken'), 3.5, 'good');
          this.audio.ui('objective');
          this.checkpoint = { pos: p.pos.clone(), yaw: p.yaw };
          setTimeout(() => this.hud.flashToast(t('checkpoint'), 1.6, 'info'), 3600);
        },
      };
    }
    // extraction
    if (this.obj.manifest && p.pos.distanceTo(L.extraction) < 3.2) {
      return {
        label: t('extract'),
        run: () => {
          this.obj.extracted = true;
          this.refreshObjectives();
          this.audio.ui('objective');
          this.end(true);
        },
      };
    }
    // step into a rift we're facing (handy on touch)
    for (const r of this.rift.openPortals()) {
      if (!r.isOpen || r.kind === 'ceiling') continue;
      const to = _v.subVectors(r.position, p.pos).setY(0);
      const d = to.length();
      if (d < 3.2 && d > 0.3 && to.normalize().dot(fwd) > 0.6 && _v.subVectors(p.pos, r.position).dot(r.normal) > 0) {
        const target = r.position.clone().addScaledVector(r.normal, -1.0);
        return { label: t('enterRift'), run: () => (this.player.autoWalk = { target, t: 1.6 }) };
      }
    }
    return null;
  }

  private takedown(g: Guard) {
    const p = this.player;
    // turn to face the target
    p.yaw = Math.atan2(g.pos.x - p.pos.x, g.pos.z - p.pos.z);
    p.lungeT = 0.45;
    this.cineT = 0.32;
    this.rig.shake = 0.6;
    this.audio.takedown(g.pos);
    navigator.vibrate?.([10, 30, 40]);
    const body = this.guards.kill(g);
    // bodies fall away from the attacker
    body.yaw = g.yaw;
    this.stats.kills++;
    this.guards.noise(g.pos, 2.2, 0.3);
    this.loot(g);
    this.hint('body', t('hintBody'), 6);
    setTimeout(() => this.hint('anchor', this.input.lastDevice === 'touch' ? t('hintAnchorTouch') : t('hintAnchorKbm'), 8), 6500);
  }

  private snatch(g: Guard, near: Portal) {
    const p = this.player;
    p.lungeT = 0.5;
    this.cineT = 0.4;
    this.rig.shake = 0.5;
    this.flash = 0.5;
    this.audio.takedown(p.pos);
    this.audio.whoosh(0.25);
    navigator.vibrate?.([10, 30, 60]);
    const body = this.guards.kill(g);
    // pulled through to our side, lands at our feet
    const drop = p.pos.clone().addScaledVector(near.normal.clone().setY(0).normalize().negate(), -0.2).addScaledVector(p.forward(), 0.9);
    const gy = this.level.world.groundAt(drop.x, drop.z, 0.2, p.pos.y + 0.5);
    body.pos.set(drop.x, gy > -5 ? gy : p.pos.y, drop.z);
    body.yaw = p.yaw + Math.PI;
    g.pos.copy(body.pos);
    this.rift.markPassed(near.linked, 'body');
    this.stats.kills++;
    this.loot(g);
    this.hint('body', t('hintBody'), 6);
  }

  private loot(g: Guard) {
    if (g.hasKeycard) {
      g.hasKeycard = false;
      this.obj.keycard = true;
      this.refreshObjectives();
      setTimeout(() => {
        this.hud.flashToast(t('keycardTaken'), 2.2, 'good');
        this.audio.ui('pickup');
      }, 500);
    }
  }

  private bodyCenter(b: Body, out: THREE.Vector3) {
    // lying bodies extend backwards from the feet pivot
    return out.set(b.pos.x - Math.sin(b.yaw) * 0.9, b.pos.y, b.pos.z - Math.cos(b.yaw) * 0.9);
  }

  private grabBody(b: Body) {
    b.state = 'carried';
    this.player.carrying = b;
    this.player.crouched = false;
    this.audio.bodyDrop(this.player.pos, 0.3);
  }

  private throwBody() {
    const b = this.player.carrying as Body;
    if (!b) return;
    this.player.carrying = null;
    b.state = 'flying';
    const f = this.player.forward();
    const pitch = this.rift.aiming ? Math.max(-0.2, this.rig.pitch) : 0.12;
    this.player.chest(b.pos).addScaledVector(f, 0.5);
    b.vel.set(f.x * 7.5 * Math.cos(pitch), 2.6 + Math.sin(pitch) * 6, f.z * 7.5 * Math.cos(pitch));
    b.yaw = this.player.yaw;
    this.audio.whoosh(0.2);
  }

  private dropBody(sound = true) {
    const b = this.player.carrying as Body;
    if (!b) return;
    this.player.carrying = null;
    b.state = 'lying';
    b.pos.copy(this.player.pos);
    if (sound) this.audio.bodyDrop(b.pos, 0.5);
  }

  private updateBodies(dt: number) {
    const w = this.level.world;
    for (const b of this.guards.bodies) {
      const root = b.char.root;
      if (b.state === 'carried') {
        const p = this.player;
        const f = p.forward();
        const left = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
        root.position.copy(p.pos).add(new THREE.Vector3(0, p.height * 0.78, 0)).addScaledVector(left, 0.95).addScaledVector(f, -0.05);
        root.rotation.set(0, p.yaw, 0);
        root.rotateZ(Math.PI / 2 - 0.15);
        b.pos.copy(p.pos);
      } else if (b.state === 'flying') {
        const prev = b.pos.clone();
        b.vel.y -= FEEL.gravity * dt;
        b.pos.addScaledVector(b.vel, dt);
        const portal = this.rift.findCrossing(prev, b.pos, 0.25);
        if (portal) {
          const np = this.rift.transform(portal, b.pos);
          const nv = this.rift.transformDir(portal, b.vel);
          b.pos.copy(np).addScaledVector(portal.linked.normal, 0.3);
          b.vel.copy(nv);
          const fwd = this.rift.transformDir(portal, new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw)));
          b.yaw = Math.atan2(fwd.x, fwd.z);
          this.rift.markPassed(portal, 'body');
        }
        const pushed = w.resolveCircle(b.pos, 0.3, b.pos.y, b.pos.y + 0.5, 0.25, (c) => this.rift.hostPassable(c, b.pos, 0.3));
        if (pushed) { b.vel.x *= -0.2; b.vel.z *= -0.2; }
        const g = w.groundAt(b.pos.x, b.pos.z, 0.25, b.pos.y + 0.3);
        if (b.pos.y < -1.3) {
          // into the sea: gone for good
          this.audio.bodyDrop(b.pos, 0.6);
          b.state = 'lying';
          b.discovered = true;
          root.removeFromParent();
          b.pos.set(0, -100, 0);
          continue;
        }
        if (g > -5 && b.pos.y <= g + 0.05 && b.vel.y <= 0) {
          b.pos.y = g;
          b.state = 'lying';
          b.vel.set(0, 0, 0);
          // feet pivot sits a body-length forward of the landing spot
          b.pos.x += Math.sin(b.yaw) * 0.9;
          b.pos.z += Math.cos(b.yaw) * 0.9;
          this.audio.bodyDrop(b.pos);
          this.guards.noise(b.pos, 6, 0.35);
          b.guard.pos.copy(b.pos);
          b.guard.deadT = 1;
        }
        root.position.copy(b.pos);
        root.rotation.set(0, b.yaw, 0);
        root.rotateX(-Math.PI / 2);
      }
    }
  }

  private guardShot(g: Guard, hit: boolean, target: THREE.Vector3) {
    const from = g.eye(new THREE.Vector3()).addScaledVector(g.forward(), 0.5).add(new THREE.Vector3(0, -0.25, 0));
    this.audio.gunshot(from);
    this.muzzle.position.copy(from);
    this.muzzle.intensity = 40;
    const to = target.clone();
    if (!hit) to.add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.3) * 1.5, (Math.random() - 0.5) * 2));
    (this.tracer.geometry as THREE.BufferGeometry).setFromPoints([from, to]);
    this.tracer.visible = true;
    this.tracerT = 0.06;
    if (hit) {
      this.player.health -= FEEL.guardDamage;
      this.player.hurtT = 0.3;
      this.damage = 1;
      this.rig.shake = 0.7;
      this.audio.hurt();
      navigator.vibrate?.(80);
      if (this.player.health <= 0) {
        this.player.health = 0;
        setTimeout(() => this.end(false), 700);
        this.mode = 'ended';
      }
    }
  }

  // ------------------------------------------------------------------
  // Frame
  // ------------------------------------------------------------------

  /** Advance the simulation without rendering (automated tests). */
  debugStep(dt: number, n = 1) {
    for (let i = 0; i < n; i++) {
      this.input.poll(dt);
      if (this.mode === 'playing') this.update(dt);
      this.input.endFrame();
    }
  }

  frame(realDt: number) {
    this.input.poll(realDt);
    if (this.mode === 'playing') this.update(realDt);
    else if (this.mode === 'menu') this.updateMenu(realDt);
    else if (this.mode === 'ended') this.updateAmbient(realDt * 0.3);
    this.render(realDt);
    this.input.endFrame();
  }

  private updateMenu(dt: number) {
    this.menuT += dt;
    // slow cinematic drift across the yard toward the cranes
    const k = (Math.sin(this.menuT * 0.03) + 1) / 2;
    this.camera.position.set(-70 + k * 70, 26 + Math.sin(this.menuT * 0.07) * 2, -62 + k * 4);
    this.camera.lookAt(-18 + k * 36, 6, 24);
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
    this.updateAmbient(dt);
    for (const g of this.guards.guards) {
      g.char.root.position.copy(g.pos);
    }
    this.guards.update(dt, { chest: new THREE.Vector3(0, -100, 0), feet: new THREE.Vector3(0, -100, 0), light: 0, crouched: true, speed: 0, alive: false }, [], this.time);
  }

  private updateAmbient(dt: number) {
    this.time += dt;
    this.lamps.update(this.time, this.mode === 'menu' ? this.camera.position : this.player.pos);
    this.rain.update(this.time, this.camera.position);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    this.sky.position.copy(this.camera.position);
    for (const f of this.level.animated) f(this.time);
    this.updateSearchlights();
    const focus = this.mode === 'menu' ? new THREE.Vector3(-10, 0, 0) : this.player.pos;
    this.moon.position.copy(focus).addScaledVector(this.level.sunDir, 110);
    this.moon.target.position.copy(focus);
  }

  private update(realDt: number) {
    const inp = this.input;
    const p = this.player;
    if (inp.wasPressed('pause')) {
      this.pause();
      return;
    }

    // ---- look ----
    const look = inp.consumeLook();
    this.rig.look(look.x, look.y);

    // ---- aim state ----
    const wantAim = inp.isHeld('aim') && !p.isMantling();
    if (wantAim && !this.rift.aiming) {
      this.rift.distanceOverride = null;
      this.rift.rotation = 0;
      this.audio.ui('click');
      this.hint('open', this.deviceText('hintOpenKbm', 'hintOpenPad', 'hintOpenTouch'), 9);
    }
    if (!wantAim && this.rift.aiming) {
      this.rift.placement = null;
    }
    this.rift.aiming = wantAim;

    // ---- time scale ----
    let ts = 1;
    if (wantAim && this.settings.slowmo && this.rift.focus > 0) {
      ts = FEEL.focusTimeScale;
      this.rift.focus = Math.max(0, this.rift.focus - realDt);
    }
    if (this.cineT > 0) {
      this.cineT -= realDt;
      ts = Math.min(ts, 0.3);
    }
    this.timeScale = THREE.MathUtils.damp(this.timeScale, ts, 14, realDt);
    const dt = realDt * this.timeScale;
    this.audio.setFocus(wantAim ? 0.6 : this.cineT > 0 ? 0.4 : 0);

    // ---- aim adjustments ----
    const wheel = inp.consumeWheel();
    if (wantAim) {
      if (wheel) {
        const base = this.rift.distanceOverride ?? (this.rift.placement ? Math.max(FEEL.riftMinDistance, this.rift.placement.distance) : 8);
        this.rift.distanceOverride = THREE.MathUtils.clamp(base + wheel * FEEL.wheelStep, FEEL.riftMinDistance + 0.4, FEEL.riftRange);
        this.audio.ui('click');
      }
      if (inp.wasPressed('rotL')) this.rift.rotation += FEEL.rotateStep;
      if (inp.wasPressed('rotR')) this.rift.rotation -= FEEL.rotateStep;
    }

    if (inp.wasPressed('crouch')) p.crouched = !p.crouched && !p.carrying;
    this.touch?.setCrouched(p.crouched);

    // ---- player ----
    p.update(dt, { x: inp.moveX, y: inp.moveY }, this.rig.yaw, inp.wasPressed('jump'), inp.isHeld('sprint'), wantAim, this.level.world, this.rift, {
      footstep: (pos, loud, radius) => {
        this.audio.footstep(pos, loud);
        if (radius > 2) this.guards.noise(pos, radius, loud * 0.35);
      },
      landed: (pos, impact) => {
        const force = Math.min(1, impact / 14);
        // long drops hurt: ~5m stings, ~9m cripples, a rooftop is fatal
        if (impact > 13.5) {
          p.health -= (impact - 13.5) * 9.5;
          this.damage = 1;
          this.audio.hurt();
          navigator.vibrate?.(60);
          if (p.health <= 0) {
            p.health = 0;
            setTimeout(() => this.end(false), 500);
            this.mode = 'ended';
          }
        }
        this.audio.bodyDrop(pos, force * 0.5);
        this.guards.noise(pos, 4 + force * 8, 0.3 + force * 0.4);
        this.rig.shake = Math.max(this.rig.shake, force * 0.5);
      },
      passed: (portal, dyaw) => {
        this.rig.rotateBy(dyaw);
        this.rig.pivot.y = p.pos.y + FEEL.camHeight;
        this.flash = 0.8;
        this.audio.whoosh();
        navigator.vibrate?.(15);
      },
      fellInWater: () => {
        this.audio.bodyDrop(p.pos, 0.8);
        p.teleport(p.lastSafe.clone());
        p.health -= 20;
        this.damage = 0.6;
        if (p.health <= 0) this.end(false);
      },
    });
    // bodies don't overlap: keep the player out of living guards
    for (const g of this.guards.guards) {
      if (!g.alive || Math.abs(g.pos.y - p.pos.y) > 1.5) continue;
      const dx = p.pos.x - g.pos.x, dz = p.pos.z - g.pos.z;
      const d = Math.hypot(dx, dz);
      const min = 0.72;
      if (d < min && d > 1e-4) {
        p.pos.x = g.pos.x + (dx / d) * min;
        p.pos.z = g.pos.z + (dz / d) * min;
      }
    }
    if (p.lungeT > 0) {
      p.lungeT = Math.max(0, p.lungeT - realDt);
      p.char.lunge = Math.sin((1 - p.lungeT / 0.5) * Math.PI);
    } else p.char.lunge = 0;
    p.char.aimArm = THREE.MathUtils.damp(p.char.aimArm, wantAim ? 1 : 0, 12, realDt);

    // ---- placement ----
    if (wantAim) {
      const ray = this.rig.aimRay();
      const pl = this.rift.solve(ray.origin, ray.dir, p.eye(), p.pos, inp.isHeld('freeAim'), inp.lastDevice === 'touch');
      this.rift.placement = pl;
      this.hud.setPlacement(pl);
      const hand = p.pos.clone().add(new THREE.Vector3(0, p.height * 0.72, 0)).addScaledVector(p.forward(), 0.45).addScaledVector(new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw)), 0.25);
      this.rift.updatePreview(pl, hand, this.camera);
      if (inp.wasPressed('open')) {
        this.tryOpenRift(pl);
        if (!pl.invalid && this.touch) this.touch.syncAim(false);
      }
    } else {
      this.rift.updatePreview(null, p.pos, this.camera);
      this.hud.setPlacement(null);
    }

    this.handleAnchor(realDt);
    if (inp.wasPressed('close')) this.rift.closeAll();

    // ---- interaction ----
    const act = this.contextAction();
    const key = inp.lastDevice === 'pad' ? 'X' : inp.lastDevice === 'touch' ? null : 'F';
    this.hud.setPrompt(key, act?.label ?? null);
    this.touch?.setAction(act?.label ?? null);
    if (act && inp.wasPressed('interact')) act.run();
    if (!act && inp.wasPressed('interact') && p.carrying) this.dropBody();

    // arena hints: the wall, then the searchlight plaza
    if (!this.hintWall && p.pos.z > -45 && p.pos.z < -10.5 && p.pos.y < 1) {
      this.hintWall = true;
      this.hud.showHint('wall', t('hintWall'), 9);
    }
    if (!this.hintPlaza && p.pos.z > -9 && p.pos.y < 13) {
      this.hintPlaza = true;
      this.hud.showHint('plaza', t('hintPlaza'), 9);
    }
    // snatch hint
    if (act && act.label === t('snatch')) this.hint('snatch', t('hintSnatch'), 6);

    // ---- world ----
    this.updateBodies(dt);
    this.playerLight = this.lightAt(p.chest(), true);
    const perception = { chest: p.chest(), feet: p.pos.clone(), light: this.playerLight, crouched: p.crouched, speed: Math.hypot(p.vel.x, p.vel.z), alive: p.health > 0 };
    const openRifts = this.rift.openPortals().filter((r) => r.open > 0.5);
    this.guards.viewer.copy(p.pos);
    const res = this.guards.update(dt, perception, openRifts, this.time);
    this.audio.setIntensity(res.tension, res.alarm, realDt);
    this.rift.update(dt, realDt, this.time, this.audio);
    this.rig.update(realDt, p.pos, p.crouchT, wantAim, this.level.world);
    this.guards.setFanVisibility(THREE.MathUtils.damp(this.guards.fansVisible, wantAim || inp.isHeld('tactical') ? 1 : 0, 10, realDt));
    this.updateAmbient(dt);
    this.audio.updateListener(this.camera);

    // ---- effects ----
    this.damage = Math.max(0, this.damage - realDt * 1.5);
    this.flash = Math.max(0, this.flash - realDt * 2.5);
    if (this.tracerT > 0 && (this.tracerT -= realDt) <= 0) this.tracer.visible = false;
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - realDt * 600);
    if (!this.guards.guards.some((g) => g.state === 'alert') && p.health > 0 && p.health < FEEL.maxHealth) p.health = Math.min(FEEL.maxHealth, p.health + realDt * 4);
    const grade = this.renderer.grade.uniforms;
    grade.uFocus.value = this.rig.aim * (this.settings.slowmo ? 1 : 0.5);
    grade.uDamage.value = this.damage * 0.8 + (p.health < 35 ? 0.25 : 0);
    grade.uFlash.value = this.flash;
    grade.uAlert.value = res.alarm * 0.6;

    // ---- HUD ----
    this.hud.update(realDt, { charges: this.rift.charges, focus: this.rift.focus, light: this.playerLight, health: p.health, aiming: this.rig.aim, anchor: !!this.rift.anchor });
    this.hud.updateGuardIcons(this.guards.guards, this.camera, this.renderer.width, this.renderer.height);
    this.updateObjectiveMarker();
    this.stats.time = this.time;
  }

  private updateObjectiveMarker() {
    const L = this.level;
    let target: THREE.Vector3 | null = null;
    if (!this.obj.manifest) target = L.manifest.clone().add(new THREE.Vector3(0, 0.9, 0));
    else if (!this.obj.extracted) target = L.extraction.clone().add(new THREE.Vector3(0, 1.6, 0));
    if (!target || this.rig.aim > 0.5) {
      this.objMarker.style.display = 'none';
      return;
    }
    const v = target.clone().project(this.camera);
    const w = this.renderer.width, h = this.renderer.height;
    let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    if (v.z > 1) { x = w - x; y = h - 60; }
    x = THREE.MathUtils.clamp(x, 40, w - 40);
    y = THREE.MathUtils.clamp(y, 70, h - 90);
    this.objMarker.style.display = '';
    this.objMarker.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    this.objMarker.querySelector('span')!.textContent = `${Math.round(target.distanceTo(this.player.pos))}m`;
  }

  private render(realDt: number) {
    const r = this.renderer.renderer;
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    if (this.mode !== 'menu') {
      this.rift.renderViews(this.camera, this.renderer.width, this.renderer.height, this.helpers);
    }
    this.renderer.render(realDt);
    // live rift-view window while aiming
    const pl = this.rift.placement;
    if (this.mode === 'playing' && this.rift.aiming && pl && this.renderer.preset.scryWindow && this.rig.aim > 0.9) {
      const rect = this.hud.scryRect;
      if (rect.w > 10) {
        const H = this.renderer.height;
        this.scryCam.aspect = rect.w / rect.h;
        this.scryCam.position.copy(pl.exitFeet).add(new THREE.Vector3(0, 1.6, 0));
        this.scryCam.rotation.set(0, 0, 0);
        this.scryCam.lookAt(this.scryCam.position.clone().add(new THREE.Vector3(Math.sin(pl.exitYaw), -0.12, Math.cos(pl.exitYaw))));
        this.scryCam.updateProjectionMatrix();
        const vis = this.helpers.map((o) => o.visible);
        this.helpers.forEach((o) => (o.visible = false));
        const pc = this.player.char.root.visible;
        r.setScissorTest(true);
        r.setViewport(rect.x, H - rect.y - rect.h, rect.w, rect.h);
        r.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h);
        r.autoClear = false;
        r.clearDepth();
        r.render(this.scene, this.scryCam);
        r.autoClear = true;
        r.setScissorTest(false);
        r.setViewport(0, 0, this.renderer.width, H);
        this.helpers.forEach((o, i) => (o.visible = vis[i]));
        this.player.char.root.visible = pc;
      }
    }
  }
}
