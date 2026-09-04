import * as THREE from 'three';
import type { App } from './App';
import { Entity, type Role } from '../sim/Entities';
import { CharacterController } from '../sim/CharacterController';
import { Combat } from '../sim/Combat';
import { Player } from '../sim/Player';
import { Match, type MatchConfig, RULES } from '../sim/Match';
import { WEAPONS, type WeaponId } from '../sim/Weapons';
import { WeaponLogic } from '../sim/WeaponLogic';
import { BotBrain, PROFILES, BOT_NAMES } from '../ai/BotBrain';
import { NavSystem } from '../ai/NavSystem';
import { BlockThumbs } from '../render/BlockThumbs';
import { CharacterMesh } from '../render/CharacterMesh';
import { ViewModel } from '../render/ViewModel';
import { VFX } from '../render/VFX';
import { FlagMesh } from '../render/FlagMesh';
import { FocusZone } from '../render/FocusZone';
import { buildWeaponModel } from '../render/WeaponModels';
import { HUD, type HudState, type ScoreRow } from '../ui/HUD';
import { Screens, type SummaryRow, type PodiumRow } from '../ui/Screens';
import { BuildMode } from '../build/BuildMode';
import { BuildUI } from '../build/BuildUI';
import { TouchControls } from '../ui/TouchControls';
import { IS_TOUCH } from './Input';
import { generateFortress } from '../world/FortressGen';
import { STYLE_IDS, type StyleId } from '../world/Styles';
import { PLOT_Y, PLOT_MAX_HEIGHT, PLOT_HALF, ZONE_RADIUS, PLAYABLE_RADIUS, type Plot } from '../world/Layout';
import { blockColor, PALETTE } from '../world/Voxel';
import { STYLES } from '../world/Styles';
import { Random } from './Random';
import { settings } from './Settings';
import { t } from './i18n';
import { audio } from '../audio/AudioEngine';
import { clamp, formatTime, damp } from './MathUtil';

type Mode = 'menu' | 'build' | 'intro' | 'battle' | 'summary' | 'podium';

const PLAYER_COLORS = ['#00e5ff', '#ff2bd6', '#ffb300', '#39ff14', '#ff3355', '#a78bfa', '#ff8c42', '#7aa7ff'];
const PRIMARY_CHOICES: WeaponId[] = ['rifle', 'smg', 'shotgun', 'sniper', 'rocket'];

/** Wires simulation, rendering and UI together and runs the match flow. */
export class Game {
  mode: Mode = 'menu';
  paused = false;
  time = 0;
  entities: Entity[] = [];
  player: Entity;
  local!: Player;
  bots: BotBrain[] = [];
  controller: CharacterController;
  combat: Combat;
  match: Match | null = null;
  nav: NavSystem | null = null;
  private thumbs: BlockThumbs | null = null;
  private exitOk = new Map<number, boolean>();
  chars = new Map<number, CharacterMesh>();
  flags = new Map<number, FlagMesh>();
  focus = new FocusZone();
  vfx = new VFX();
  viewModel: ViewModel;
  hud: HUD;
  screens: Screens;
  build: BuildMode | null = null;
  buildUI: BuildUI | null = null;
  touch: TouchControls;
  private rotateHint: HTMLElement;
  private projectileMeshes = new Map<number, THREE.Object3D>();
  private rocketModel: THREE.Group;
  private grenadeModel: THREE.Group;
  private cinematicAngle = 0;
  private cameraFocus = new THREE.Vector3(0, 20, 0);
  private scoreAtRoundStart = new Map<number, number>();
  private playerPrimary: WeaponId = 'rifle';
  private killedBy = '';
  private scoreboardTimer = 0;
  private lastHudRows: ScoreRow[] | null = null;
  private rng = new Random(Date.now() >>> 0);
  private introBannerShown = false;
  private endBannerShown = false;
  private summaryShown = false;
  private footAcc = 0;
  private lastDefenderAlarm = 0;
  private lastCaptureTick = -1;
  private uiRoot: HTMLElement;

  constructor(readonly app: App) {
    this.uiRoot = document.getElementById('ui')!;
    this.controller = new CharacterController(app.world, app.terrain);
    this.combat = new Combat(app.world, app.terrain, () => this.entities);
    this.player = new Entity();
    this.player.name = settings.data.playerName || 'You';
    this.player.colorHex = PLAYER_COLORS[0];
    this.viewModel = new ViewModel(app.gr.camera, new THREE.Color(PLAYER_COLORS[0]));
    app.gr.scene.add(app.gr.camera);
    app.gr.scene.add(this.focus.group);
    app.gr.scene.add(this.vfx.group);
    this.rocketModel = buildWeaponModel('rocket', new THREE.Color('#ffb300'));
    this.grenadeModel = buildWeaponModel('grenade', new THREE.Color('#39ff14'));
    this.hud = new HUD(this.uiRoot);
    this.screens = new Screens(this.uiRoot, {
      start: (cfg) => this.startMatch(cfg),
      resume: () => this.resume(),
      quit: () => this.quitToMenu(),
      playAgain: () => this.playAgain(),
      settingsChanged: () => this.applySettings(),
      languageChanged: () => this.onLanguageChanged(),
      clickToPlay: () => this.onClickToPlay(),
      uiSound: (k) => {
        audio.init();
        audio.play(k === 'click' ? 'uiClick' : 'uiHover');
      },
    });
    this.touch = new TouchControls(this.uiRoot, app.input, {
      pause: () => (this.paused ? this.resume() : this.pause()),
      weaponSlot: (i) => {
        if (this.mode === 'battle' && WeaponLogic.switchWeapon(this.player, i)) audio.play('switch');
      },
      build: {
        tools: () => this.buildUI?.toggleSheet(),
        rotate: () => this.build?.rotate(),
        undo: () => this.build?.undo(),
        redo: () => this.build?.redo(),
        layer: () => {
          this.build?.toggleLayerLock();
          this.touch.setLayerLock(!!this.build?.state.layerLock);
        },
        nudge: (d) => this.build?.nudge(d),
      },
    });
    this.touch.applyStyle(settings.data.touchScale, settings.data.touchOpacity);
    this.touch.setAutoFire(settings.data.autoFire);
    this.touch.bindWeaponSlots(this.hud.root);
    this.rotateHint = document.createElement('div');
    this.rotateHint.className = 'rotate-hint';
    this.rotateHint.textContent = t('rotateDevice');
    this.rotateHint.hidden = true;
    this.uiRoot.appendChild(this.rotateHint);
    this.wireCombat();
    this.app.input.onLockChange = (locked) => {
      if (locked && this.screens.name === 'click') this.screens.hideAll();
      if (!locked && !this.app.input.fallbackLook && this.mode === 'battle' && !this.paused && !this.screens.visible) this.pause();
    };
    window.addEventListener('pointerdown', () => audio.init(), { once: true });
    window.addEventListener('keydown', () => audio.init(), { once: true });
  }

  /** Called once after the world exists. */
  init(): void {
    this.showcaseIsland();
    this.screens.showMenu();
    this.mode = 'menu';
    this.cinematicAngle = 0;
    audio.music('menu');
  }

  private lastConfig: MatchConfig | null = null;

  /** Populates all plots with random fortresses for the menu backdrop. */
  private showcaseIsland(): void {
    const rng = new Random(42);
    for (const p of this.app.plots) {
      const style = rng.pick(STYLE_IDS);
      this.paintGround(p, style);
      generateFortress(this.app.world, p, style, rng.fork());
    }
    this.app.chunks.flush();
  }

  private applySettings(): void {
    const q = settings.resolveQuality(this.app.gr.gpuName);
    if (q !== this.app.gr.quality) {
      this.app.gr.setQuality(q);
      this.app.sky.setShadowMapSize(this.app.gr.profile.shadowMap);
      this.app.sky.setShadowRadius(this.app.gr.profile.shadowRadius);
    }
    audio.setVolumes(settings.data.volume, settings.data.music);
    this.touch.applyStyle(settings.data.touchScale, settings.data.touchOpacity);
    this.touch.setAutoFire(settings.data.autoFire);
  }

  private onLanguageChanged(): void {
    if (this.buildUI) this.buildUI.render();
  }

  // ---------------- match flow ----------------
  startMatch(cfg: MatchConfig): void {
    this.lastConfig = cfg;
    audio.init();
    this.applySettings();
    this.screens.hideAll();
    this.cleanupMatch();
    const plots = this.app.plots;
    const count = clamp(cfg.botCount + 1, 2, plots.length);
    // Entities
    this.entities = [];
    this.player.name = cfg.playerName || t('you');
    this.player.plotIndex = 0;
    this.player.colorHex = PLAYER_COLORS[0];
    this.player.score = { total: 0, defenseSeconds: 0, holdBonuses: 0, captures: 0, kills: 0, killsAsDefender: 0, deaths: 0 };
    this.entities.push(this.player);
    const names = new Random(Date.now() >>> 1).shuffle([...BOT_NAMES]);
    this.bots = [];
    for (let i = 1; i < count; i++) {
      const e = new Entity();
      e.isBot = true;
      e.name = names[i - 1];
      e.plotIndex = i;
      e.colorHex = PLAYER_COLORS[i % PLAYER_COLORS.length];
      this.entities.push(e);
    }
    // Clear all plots, generate bot fortresses
    for (const p of plots) this.app.world.clearBox(p.minX, PLOT_Y, p.minZ, p.maxX, PLOT_Y + PLOT_MAX_HEIGHT + 2, p.maxZ);
    const match = new Match(cfg, { spawnFor: (e, role, target) => this.spawnFor(e, role, target) });
    this.match = match;
    match.setEntities(this.entities);
    this.paintGround(plots[0], cfg.style);
    for (const e of this.entities) {
      if (!e.isBot) continue;
      const style = this.rng.pick(STYLE_IDS);
      this.paintGround(plots[e.plotIndex], style);
      const res = generateFortress(this.app.world, plots[e.plotIndex], style, this.rng.fork());
      match.setFlag(e.plotIndex, res.flag);
      match.setSpawn(e.plotIndex, res.spawn);
      const brain = new BotBrain(e, this.botContext(), PROFILES[cfg.difficulty], this.rng.int(1, 1e9));
      this.bots.push(brain);
    }
    this.app.chunks.flush();
    // Character meshes
    for (const e of this.entities) {
      const cm = new CharacterMesh(new THREE.Color(e.colorHex), e.name, e.colorHex);
      cm.root.visible = false;
      this.app.gr.scene.add(cm.root);
      this.chars.set(e.id, cm);
    }
    this.viewModel.setAccent(new THREE.Color(this.player.colorHex));
    // Match events
    match.events.on('phase', ({ phase }) => this.onPhase(phase));
    match.events.on('spawn', ({ entity }) => this.onSpawn(entity));
    match.events.on('score', ({ entity, delta, reason }) => {
      if (entity === this.player && reason !== 'defense') this.hud.scorePop(`+${delta}`);
    });
    match.events.on('buildTimeUp', () => this.finishBuild(true));
    // Build phase
    this.build = new BuildMode(this.app.world, this.app.terrain, plots[0], cfg.style, this.app.input, this.app.gr.camera, this.app.gr.scene);
    if (!this.thumbs) this.thumbs = new BlockThumbs(this.app.gr.renderer, this.app.materials, this.app.gr.scene.environment);
    const thumbs = this.thumbs;
    this.buildUI = new BuildUI(
      this.uiRoot,
      this.build,
      {
        ready: () => this.finishBuild(false),
        autoBuild: (arch) => this.build?.autoBuild(this.rng.int(1, 1e9), arch),
        thumb: (m, c) => thumbs.block(m, c),
        prefabThumb: (id, size, style) => thumbs.prefab(id, size, style),
      },
      IS_TOUCH || window.innerWidth < 900,
    );
    this.build.events.on('placed', () => audio.play('place', { pitch: 0.9 + Math.random() * 0.2 }));
    this.build.events.on('placedCells', ({ cells }) => {
      for (const c of cells) this.vfx.puff(new THREE.Vector3(c.x + 0.5, c.y + 0.65, c.z + 0.5), new THREE.Vector3(0, 1, 0), 3, 0.8, 0.22);
    });
    this.build.events.on('erased', () => audio.play('erase'));
    this.build.enter();
    this.buildUI.show();
    this.mode = 'build';
    this.setTouchMode();
    match.startBuild();
    audio.music('build');
    this.app.gr.camera.position.set(plots[0].cx + 30, PLOT_Y + 30, plots[0].cz + 40);
  }

  /** Ground layer of a plot takes the style's ground block. */
  private paintGround(plot: Plot, style: StyleId): void {
    const v = STYLES[style].roles.ground;
    for (let x = plot.minX; x <= plot.maxX; x++) for (let z = plot.minZ; z <= plot.maxZ; z++) this.app.world.set(x, PLOT_Y - 1, z, v);
  }

  private botContext() {
    return {
      world: this.app.world,
      combat: this.combat,
      controller: this.controller,
      entities: () => this.entities,
      nav: () => this.nav,
      targetPlot: () => (this.match && this.match.targetPlotIndex >= 0 ? this.app.plots[this.match.targetPlotIndex] : null),
      flagPos: () => this.match?.currentFlag?.pos ?? null,
      defender: () => this.match?.defender ?? null,
      roundTime: () => (this.match ? this.match.config.roundTime - this.match.timeLeft : 0),
      anyCaptureProgress: () => {
        let m = 0;
        for (const e of this.entities) if (e.role === 'attacker') m = Math.max(m, e.captureProgress / RULES.captureTime);
        return m;
      },
    };
  }

  finishBuild(timeUp: boolean): void {
    if (!this.match || !this.build || this.mode !== 'build') return;
    const plot = this.app.plots[0];
    const used = this.app.world.countBlocksInBox(plot.minX, PLOT_Y, plot.minZ, plot.maxX, PLOT_Y + PLOT_MAX_HEIGHT, plot.maxZ);
    if (used < 40) this.build.autoBuild(this.rng.int(1, 1e9));
    this.build.validateNow();
    if (!this.build.state.reach.ok) {
      this.build.ensureMarkers(this.rng);
      if (this.build.state.flag) this.hud.showBanner(t('placeFlagAuto'), '', 4);
    }
    const flag = this.build.state.flag ?? { x: plot.cx, y: PLOT_Y, z: plot.cz };
    const spawn = this.build.state.spawn ?? flag;
    this.match.setFlag(0, flag);
    this.match.setSpawn(0, spawn);
    this.build.exit();
    this.buildUI?.hide();
    this.app.chunks.flush();
    // The world is final for the rest of the match: build navigation for every fortress now.
    this.nav = new NavSystem(this.app.world, this.app.terrain, this.app.plots);
    this.exitOk.clear();
    const t0 = performance.now();
    this.nav.prepare(this.entities.length);
    const navMs = performance.now() - t0;
    if (navMs > 400) console.warn(`navigation build took ${navMs.toFixed(0)}ms`);
    if (timeUp) this.hud.showBanner(t('buildTimeUp'), '', 3);
    // Flags
    for (const [plotIndex, info] of this.match.flags) {
      const owner = this.entities.find((e) => e.plotIndex === plotIndex);
      const fm = new FlagMesh(new THREE.Color(owner?.colorHex ?? '#ffffff'));
      fm.group.position.copy(info.pos);
      fm.group.visible = false;
      this.app.gr.scene.add(fm.group);
      this.flags.set(plotIndex, fm);
    }
    this.match.finishBuild();
  }

  /** Shows the on-screen controls that match the current mode (touch devices only). */
  private setTouchMode(): void {
    if (!IS_TOUCH) {
      this.touch.setMode('none');
      this.rotateHint.hidden = true;
      return;
    }
    const m = this.mode === 'battle' ? 'battle' : this.mode === 'build' ? 'build' : 'none';
    this.touch.setMode(m);
    this.rotateHint.hidden = m === 'none';
  }

  private onPhase(phase: string): void {
    const match = this.match!;
    switch (phase) {
      case 'roundIntro': {
        this.mode = 'intro';
        this.setTouchMode();
        this.screens.hideAll();
        this.app.input.exitPointerLock();
        this.introBannerShown = false;
        this.endBannerShown = false;
        this.summaryShown = false;
        const plot = this.app.plots[match.targetPlotIndex];
        for (const [idx, fm] of this.flags) fm.group.visible = idx === match.targetPlotIndex;
        const color = new THREE.Color(match.defender!.colorHex);
        this.focus.show(new THREE.Vector3(plot.cx, PLOT_Y, plot.cz), color);
        for (const b of this.bots) b.newRound();
        for (const e of this.entities) this.scoreAtRoundStart.set(e.id, e.score.total);
        this.cinematicAngle = this.rng.range(0, Math.PI * 2);
        // Each fortress gets its own light: the sun swings around and climbs/dips per round.
        this.app.sky.setSun(16 + ((match.roundIndex * 7) % 22), 110 + match.roundIndex * 55 + this.rng.range(-10, 10));
        this.hud.show();
        audio.play('roundStart');
        audio.music('battle');
        this.vfx.clear();
        this.combat.clearProjectiles();
        break;
      }
      case 'round': {
        this.mode = 'battle';
        this.setTouchMode();
        this.hud.show();
        const def = match.defender!;
        this.hud.showBanner(this.player === def ? t('defendFortress') : t('attackFortress', { name: def.name }), t('round', { n: match.roundIndex + 1, total: match.roundOrder.length }), 3.5);
        this.requestPlayControl();
        break;
      }
      case 'roundEnd': {
        this.mode = 'summary';
        this.setTouchMode();
        this.app.input.exitPointerLock();
        this.hud.hide();
        this.viewModel.hidden = true;
        const r = match.lastRound!;
        audio.play(r.reason === 'captured' ? 'captureDone' : 'roundEnd');
        const title = r.reason === 'captured' ? t('flagCaptured', { name: r.capturer?.name ?? '', owner: r.defender.name }) : t('fortressHeld', { owner: r.defender.name });
        const rows: SummaryRow[] = match
          .standings()
          .map((e) => ({ name: e.name, color: e.colorHex, delta: `+${e.score.total - (this.scoreAtRoundStart.get(e.id) ?? 0)}`, total: e.score.total, isYou: e === this.player }));
        this.screens.showRoundSummary({ title, sub: t('roundSummary') + ` · ${t('round', { n: r.round, total: r.total })}`, rows }, RULES.summaryTime);
        if (this.flags.get(r.plotIndex)) this.flags.get(r.plotIndex)!.setBeacon(r.reason === 'captured' ? 1 : 0);
        break;
      }
      case 'podium': {
        this.mode = 'podium';
        this.setTouchMode();
        this.app.input.exitPointerLock();
        this.hud.hide();
        this.focus.hide();
        this.viewModel.hidden = true;
        const rows: PodiumRow[] = match.standings().map((e) => ({ name: e.name, score: e.score.total, captures: e.score.captures, kills: e.score.kills, defense: formatTime(e.score.defenseSeconds), color: e.colorHex, isYou: e === this.player }));
        this.screens.showPodium(rows);
        audio.music('podium');
        audio.play('victory');
        break;
      }
      default:
        break;
    }
  }

  private onSpawn(e: Entity): void {
    if (e.isBot) {
      const brain = this.bots.find((b) => b.entity === e);
      brain?.reset();
      e.setLoadout(brain?.preferredWeapon ?? 'rifle');
    } else {
      e.setLoadout(this.playerPrimary);
      this.viewModel.show(e.weapon ? e.weapon.id : null, true);
      this.viewModel.hidden = false;
      this.killedBy = '';
    }
    const cm = this.chars.get(e.id);
    if (cm) cm.setWeapon(e.weapon?.id ?? null);
    audio.play('spawn', { pos: e.pos, volume: 0.6 });
  }

  /**
   * Defenders appear at the spawn point chosen for the contested fortress; attackers appear at
   * their own fortress and run over. A fortress whose spawn cannot reach open ground (a pit, a
   * sealed room) falls back to its doorstep on the side facing the target.
   */
  private spawnFor(e: Entity, role: Role, targetPlotIndex: number): THREE.Vector3 {
    const plotIndex = role === 'defender' ? targetPlotIndex : e.plotIndex;
    const plot = this.app.plots[plotIndex];
    const spawn = this.match?.spawns.get(plotIndex);
    if (role === 'defender') {
      if (spawn) return spawn.clone();
      const f = this.match?.flags.get(plotIndex);
      if (f) return f.pos.clone().add(new THREE.Vector3(0.5, 0, 0));
      return new THREE.Vector3(plot.cx, PLOT_Y, plot.cz);
    }
    if (spawn && this.nav) {
      let ok = this.exitOk.get(plotIndex);
      if (ok === undefined) {
        ok = this.nav.canExit(plotIndex, spawn);
        this.exitOk.set(plotIndex, ok);
        if (!ok) console.warn(`fortress ${plotIndex}: spawn cannot reach open ground, using the doorstep`);
      }
      if (ok) return spawn.clone();
    } else if (spawn) return spawn.clone();
    return this.doorstep(plot, this.app.plots[targetPlotIndex] ?? plot);
  }

  /** A clear terrain cell just outside a plot on the side facing `toward`. */
  private doorstep(plot: Plot, toward: Plot): THREE.Vector3 {
    const base = Math.atan2(toward.cz - plot.cz, toward.cx - plot.cx);
    for (let attempt = 0; attempt < 10; attempt++) {
      const a = base + (attempt % 2 === 0 ? 1 : -1) * Math.ceil(attempt / 2) * 0.35;
      const r = PLOT_HALF + 5 + Math.floor(attempt / 4) * 2;
      let x = plot.cx + Math.cos(a) * r;
      let z = plot.cz + Math.sin(a) * r;
      const rr = Math.sqrt(x * x + z * z);
      if (rr > PLAYABLE_RADIUS - 6) {
        x *= (PLAYABLE_RADIUS - 6) / rr;
        z *= (PLAYABLE_RADIUS - 6) / rr;
      }
      const y = this.app.terrain.heightAt(x, z);
      if (y > 1.0 && !this.app.world.boxIntersectsSolid(x - 0.4, y, z - 0.4, x + 0.4, y + 2, z + 0.4)) return new THREE.Vector3(x, y + 0.05, z);
    }
    return new THREE.Vector3(plot.cx + Math.cos(base) * (PLOT_HALF + 5), PLOT_Y + 1, plot.cz + Math.sin(base) * (PLOT_HALF + 5));
  }

  private requestPlayControl(): void {
    const input = this.app.input;
    if (IS_TOUCH) {
      this.screens.hideAll();
      return;
    }
    if (input.looking) {
      this.screens.hideAll();
      return;
    }
    this.screens.showClickToPlay(input.fallbackLook);
  }

  private onClickToPlay(): void {
    audio.init();
    audio.resume();
    this.app.input.requestPointerLock();
    this.screens.hideAll();
    this.paused = false;
  }

  pause(): void {
    if (this.mode !== 'battle' && this.mode !== 'build') return;
    this.paused = true;
    this.app.input.exitPointerLock();
    this.screens.showPause();
  }

  resume(): void {
    this.paused = false;
    this.screens.hideAll();
    if (this.mode !== 'battle') return;
    // The Resume click is a user gesture, so we can lock the pointer directly.
    this.app.input.requestPointerLock();
    if (!this.app.input.looking) this.screens.showClickToPlay(this.app.input.fallbackLook);
  }

  quitToMenu(): void {
    this.cleanupMatch();
    this.showcaseIsland();
    this.screens.showMenu();
    this.mode = 'menu';
    this.setTouchMode();
    this.paused = false;
    this.app.input.exitPointerLock();
    audio.music('menu');
  }

  playAgain(): void {
    if (this.lastConfig) this.startMatch(this.lastConfig);
    else this.quitToMenu();
  }

  private cleanupMatch(): void {
    this.build?.dispose();
    this.build = null;
    this.buildUI?.hide();
    this.buildUI?.root.remove();
    this.buildUI = null;
    for (const cm of this.chars.values()) {
      this.app.gr.scene.remove(cm.root);
      cm.dispose();
    }
    this.chars.clear();
    for (const fm of this.flags.values()) {
      this.app.gr.scene.remove(fm.group);
      fm.dispose();
    }
    this.flags.clear();
    for (const m of this.projectileMeshes.values()) this.app.gr.scene.remove(m);
    this.projectileMeshes.clear();
    this.focus.hide();
    this.vfx.clear();
    this.combat.clearProjectiles();
    this.hud.hide();
    this.viewModel.hidden = true;
    this.match = null;
    this.nav = null;
    this.bots = [];
    this.entities = [];
    this.player.reset();
  }

  // ---------------- combat wiring ----------------
  private wireCombat(): void {
    const c = this.combat;
    c.events.on('shot', ({ shooter, origin, end, weapon }) => {
      const muzzle = new THREE.Vector3();
      if (shooter === this.player && !this.viewModel.hidden) this.viewModel.getMuzzleWorld(muzzle);
      else {
        const cm = this.chars.get(shooter.id);
        if (cm) cm.getMuzzle(muzzle);
        else muzzle.copy(origin);
      }
      const dir = end.clone().sub(muzzle).normalize();
      const accent = new THREE.Color(shooter.colorHex);
      this.vfx.muzzleFlash(muzzle.clone().addScaledVector(dir, 0.1), dir, new THREE.Color(1, 0.75, 0.4), weapon.id === 'shotgun' || weapon.id === 'sniper' ? 1.5 : 1);
      if (weapon.tracer) this.vfx.tracer(muzzle.clone().addScaledVector(dir, 0.5), end, accent.clone().lerp(new THREE.Color(1, 0.9, 0.6), 0.5), weapon.id === 'sniper' ? 0.05 : 0.03);
      audio.play(weapon.sound, { pos: shooter === this.player ? undefined : origin, volume: shooter === this.player ? 0.9 : 1 });
    });
    c.events.on('impact', ({ point, normal, blockValue, onEntity }) => {
      let tint: THREE.Color | null = null;
      if (blockValue) tint = new THREE.Color(PALETTE[blockColor(blockValue)]);
      this.vfx.impact(point, normal, tint, onEntity);
      if (!onEntity && Math.random() < 0.25) audio.play('ricochet', { pos: point, volume: 0.5, pitch: 0.8 + Math.random() * 0.4 });
    });
    c.events.on('damage', ({ target, attacker, amount, headshot }) => {
      const cm = this.chars.get(target.id);
      cm?.hitFlash();
      if (attacker === this.player && target !== this.player) {
        this.hud.hitMarker(false, headshot);
        audio.play(headshot ? 'headshot' : 'hit', { volume: 0.7 });
      }
      if (target === this.player) {
        this.hud.damage();
        this.local?.addShake(Math.min(0.6, amount / 60));
        audio.play('hurt', { volume: 0.8 });
        if (attacker) this.killedBy = attacker.name;
      }
    });
    c.events.on('kill', ({ victim, killer, headshot }) => {
      this.match?.onKill(victim, killer, this.time);
      if (killer) this.hud.killFeed(`<b style="color:${killer.colorHex}">${esc(killer.name)}</b> ➜ <b style="color:${victim.colorHex}">${esc(victim.name)}</b>${headshot ? ' ✦' : ''}`);
      if (killer === this.player) {
        this.hud.hitMarker(true);
        this.hud.showBanner(t('youEliminated', { name: victim.name }), '', 1.5);
        audio.play('kill');
      }
      if (victim === this.player) this.killedBy = killer?.name ?? '';
      const brain = this.bots.find((b) => b.entity === victim);
      brain?.reset();
      this.vfx.deathBurst(victim.center, new THREE.Color(victim.colorHex));
    });
    c.events.on('explosion', ({ pos, radius }) => {
      this.vfx.explosion(pos, radius);
      audio.play('explosion', { pos });
      const d = pos.distanceTo(this.app.gr.camera.position);
      this.local?.addShake(clamp(1 - d / 30, 0, 1) * 0.9);
    });
    c.events.on('projectileBounce', ({ pos }) => audio.play('bounce', { pos, volume: 0.6 }));
  }

  // ---------------- per-frame ----------------
  update(dt: number): THREE.Vector3 {
    this.time += dt;
    const input = this.app.input;
    const match = this.match;
    if (match && !this.paused) match.update(dt, this.time);

    // Global keys
    if (input.wasPressedRaw('Escape')) {
      if (this.mode === 'battle' || this.mode === 'build') {
        if (this.paused) this.resume();
        else if (!this.screens.visible || this.screens.name === 'click') this.pause();
      } else if (this.mode === 'summary' && match) {
        match.skipSummary();
      }
    }
    input.enabled = !this.screens.visible && !this.paused;

    switch (this.mode) {
      case 'menu':
        this.menuCamera(dt);
        break;
      case 'build':
        if (!this.paused) this.build?.update(dt);
        this.buildUI?.update(dt, match?.buildTimeLeft ?? null);
        this.cameraFocus.copy(this.app.gr.camera.position);
        break;
      case 'intro':
        this.introUpdate(dt);
        break;
      case 'battle':
        this.battleUpdate(dt);
        break;
      case 'summary':
      case 'podium':
        this.cinematicCamera(dt, this.mode === 'podium' ? this.winnerPlot() : this.app.plots[match?.lastRound?.plotIndex ?? 0]);
        this.updateCharacters(dt);
        if (this.mode === 'summary' && match) this.screens.updateSummaryCountdown(RULES.summaryTime - match.phaseTimer);
        break;
    }
    if (this.simOnly) return this.cameraFocus;
    for (const fm of this.flags.values()) if (fm.group.visible) fm.update(dt, this.app.gr.camera.position);
    this.focus.update(dt, this.time);
    if (this.mode !== 'menu') this.vfx.ambient(this.app.gr.camera.position, dt);
    this.vfx.update(dt);
    this.syncProjectiles();
    audio.setListener(this.app.gr.camera.position, new THREE.Vector3(1, 0, 0).applyQuaternion(this.app.gr.camera.quaternion));
    return this.cameraFocus;
  }

  private winnerPlot(): Plot {
    const w = this.match?.standings()[0];
    return this.app.plots[w?.plotIndex ?? 0];
  }

  private menuCamera(dt: number): void {
    this.cinematicAngle += dt * 0.06;
    const cam = this.app.gr.camera;
    const r = 150;
    cam.position.set(Math.cos(this.cinematicAngle) * r, 48 + Math.sin(this.cinematicAngle * 0.7) * 8, Math.sin(this.cinematicAngle) * r);
    cam.lookAt(0, 14, 0);
    cam.updateMatrixWorld();
    this.cameraFocus.set(0, 14, 0);
    if (Math.abs(cam.fov - 60) > 0.1) {
      cam.fov = damp(cam.fov, 60, 4, dt);
      cam.updateProjectionMatrix();
    }
  }

  private cinematicCamera(dt: number, plot: Plot): void {
    this.cinematicAngle += dt * 0.25;
    const cam = this.app.gr.camera;
    const r = 52;
    const cx = plot.cx;
    const cz = plot.cz;
    cam.position.set(cx + Math.cos(this.cinematicAngle) * r, PLOT_Y + 26 + Math.sin(this.cinematicAngle * 0.5) * 4, cz + Math.sin(this.cinematicAngle) * r);
    cam.lookAt(cx, PLOT_Y + 7, cz);
    cam.updateMatrixWorld();
    this.cameraFocus.set(cx, PLOT_Y + 7, cz);
    if (Math.abs(cam.fov - 65) > 0.1) {
      cam.fov = damp(cam.fov, 65, 4, dt);
      cam.updateProjectionMatrix();
    }
  }

  private introUpdate(dt: number): void {
    const match = this.match!;
    const plot = this.app.plots[match.targetPlotIndex];
    if (!this.simOnly) {
      this.cinematicCamera(dt, plot);
      this.updateCharacters(dt);
      this.hud.update(this.hudState(), dt);
    }
    const input = this.app.input;
    // Loadout choice
    const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    keys.forEach((k, i) => {
      if (input.wasPressedRaw(k)) {
        this.playerPrimary = PRIMARY_CHOICES[i];
        audio.play('switch');
        this.introBannerShown = false;
      }
    });
    if (!this.introBannerShown) {
      this.introBannerShown = true;
      const def = match.defender!;
      const title = this.player === def ? t('defendFortress') : t('targetLabel', { name: def.name });
      const choices = PRIMARY_CHOICES.map((w, i) => `${i + 1}·${t(WEAPONS[w].nameKey)}${w === this.playerPrimary ? ' ✔' : ''}`).join('   ');
      this.hud.showBanner(title, `${t('intro')} — ${choices}`, RULES.introTime);
    }
  }

  private battleUpdate(dt: number): void {
    const match = this.match!;
    const input = this.app.input;
    if (!this.local) {
      this.local = new Player(this.player, input, this.controller, this.combat, this.viewModel, this.app.gr.camera, this.app.gr.scene);
      this.local.entities = () => this.entities;
      this.local.events.on('grenade', () => audio.play('switch', { volume: 0.5 }));
      this.local.events.on('grapple', ({ point }) => audio.play(point ? 'grapple' : 'grappleMiss'));
      this.local.events.on('reload', () => audio.play('reload'));
      this.local.events.on('weaponSwitch', () => audio.play('switch'));
    }
    this.local.enabled = !this.paused && !this.screens.visible;
    const simDt = this.paused ? 0 : dt;
    if (simDt > 0) {
      // Player
      const wasAlive = this.player.alive;
      this.local.update(simDt, this.time);
      if (wasAlive && !this.player.alive) {
        /* death handled via events */
      }
      // Bots
      for (const b of this.bots) b.update(simDt, this.time);
      this.combat.updateProjectiles(simDt, this.time);
      // Slow health regeneration after a few seconds without damage
      for (const e of this.entities) {
        if (e.alive && e.hp < e.maxHp && this.time - e.lastDamageTime > e.regenDelay) e.hp = Math.min(e.maxHp, e.hp + 7 * simDt);
      }
      // Footsteps
      const p = this.player;
      if (p.alive && p.grounded) {
        const sp = Math.sqrt(p.vel.x * p.vel.x + p.vel.z * p.vel.z);
        this.footAcc += sp * simDt;
        if (this.footAcc > 2.2) {
          this.footAcc = 0;
          audio.play('footstep', { volume: 0.5, pitch: 0.9 + Math.random() * 0.2 });
        }
      }
      for (const e of this.entities) {
        if (e === p || !e.alive || !e.grounded) continue;
        const sp = Math.sqrt(e.vel.x * e.vel.x + e.vel.z * e.vel.z);
        e.footstepAcc += sp * simDt;
        if (e.footstepAcc > 2.4) {
          e.footstepAcc = 0;
          audio.play('footstep', { pos: e.pos, volume: 0.7, pitch: 0.85 + Math.random() * 0.2 });
        }
      }
      // Capture ticks for the local attacker
      if (p.role === 'attacker' && p.captureProgress > 0.05) {
        const tick = Math.floor(p.captureProgress * 3);
        if (tick !== this.lastCaptureTick) {
          this.lastCaptureTick = tick;
          audio.play('captureTick', { volume: 0.6, pitch: 1 + tick * 0.12 });
        }
      } else this.lastCaptureTick = -1;
      // Defender alarm
      if (p.role === 'defender') {
        const threat = Math.max(0, ...this.entities.filter((e) => e !== p).map((e) => e.captureProgress));
        if (threat > 0.1 && this.time - this.lastDefenderAlarm > 1.5) {
          this.lastDefenderAlarm = this.time;
          audio.play('alarm', { volume: 0.5 });
        }
      }
    }
    if (this.simOnly) return;
    this.updateCharacters(dt);
    // Camera when dead: orbit the body
    if (!this.player.alive) this.deathCamera(dt);
    this.cameraFocus.copy(this.app.gr.camera.position);
    // Scoreboard
    if (input.isDown('Tab')) {
      this.scoreboardTimer -= dt;
      if (this.scoreboardTimer <= 0 || !this.lastHudRows) {
        this.scoreboardTimer = 0.5;
        this.lastHudRows = match.standings().map((e) => ({
          name: e.name,
          role: e.role === 'defender' ? t('defender') : t('attacker'),
          score: e.score.total,
          captures: e.score.captures,
          kills: e.score.kills,
          defense: e.score.defenseSeconds,
          color: e.colorHex,
          isYou: e === this.player,
        }));
        this.hud.showScoreboard(this.lastHudRows);
      }
    } else if (this.lastHudRows) {
      this.lastHudRows = null;
      this.hud.showScoreboard(null);
    }
    this.hud.update(this.hudState(), dt);
  }

  private deathCamera(dt: number): void {
    const cam = this.app.gr.camera;
    const p = this.player;
    this.cinematicAngle += dt * 0.6;
    const target = new THREE.Vector3(p.pos.x + Math.cos(this.cinematicAngle) * 5, p.pos.y + 4.5, p.pos.z + Math.sin(this.cinematicAngle) * 5);
    // Avoid burying the camera in blocks: raise until clear.
    for (let i = 0; i < 6 && this.app.world.boxIntersectsSolid(target.x - 0.3, target.y - 0.3, target.z - 0.3, target.x + 0.3, target.y + 0.3, target.z + 0.3); i++) target.y += 1;
    cam.position.lerp(target, Math.min(1, dt * 4));
    cam.lookAt(p.pos.x, p.pos.y + 1, p.pos.z);
    cam.updateMatrixWorld();
  }

  private updateCharacters(dt: number): void {
    const camPos = this.app.gr.camera.position;
    for (const e of this.entities) {
      const cm = this.chars.get(e.id);
      if (!cm) continue;
      const firstPerson = e === this.player && this.mode === 'battle' && e.alive;
      cm.visible = !firstPerson && this.mode !== 'build';
      cm.setWeapon(e.weapon?.id ?? null);
      cm.update(dt, e, camPos, this.time);
    }
  }

  private syncProjectiles(): void {
    const live = new Set<number>();
    for (const p of this.combat.projectiles) {
      live.add(p.id);
      let m = this.projectileMeshes.get(p.id);
      if (!m) {
        m = (p.kind === 'rocket' ? this.rocketModel : this.grenadeModel).clone();
        if (p.kind === 'rocket') {
          m.scale.setScalar(0.55);
        }
        this.app.gr.scene.add(m);
        this.projectileMeshes.set(p.id, m);
      }
      m.position.copy(p.pos);
      if (p.kind === 'rocket') {
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), p.vel.clone().normalize());
        this.vfx.puff(p.pos, p.vel.clone().normalize().negate(), 1, 0.75, 0.35);
      } else {
        m.rotation.x += 0.2;
        m.rotation.z += 0.13;
      }
    }
    for (const [id, m] of this.projectileMeshes) {
      if (!live.has(id)) {
        this.app.gr.scene.remove(m);
        this.projectileMeshes.delete(id);
      }
    }
  }

  private hudState(): HudState {
    const match = this.match!;
    const p = this.player;
    const w = p.weapon;
    const def = match.defender;
    const flag = match.currentFlag;
    const standings = match.standings();
    const others = this.entities
      .filter((e) => e !== p && e.alive && e.pos.distanceTo(p.pos) < 14)
      .map((e) => ({ x: e.pos.x, z: e.pos.z, color: e.colorHex }));
    let flagThreat = 0;
    if (p.role === 'defender') for (const e of this.entities) if (e !== p) flagThreat = Math.max(flagThreat, e.captureProgress / RULES.captureTime);
    const spread = w ? THREE.MathUtils.lerp(WEAPONS[w.id].spread, WEAPONS[w.id].adsSpread, p.ads) * 6 + Math.min(20, Math.sqrt(p.vel.x * p.vel.x + p.vel.z * p.vel.z) * 1.2) : 4;
    const objective = this.objectiveMarker();
    return {
      objective,
      hp: p.hp,
      maxHp: p.maxHp,
      weaponName: w ? t(WEAPONS[w.id].nameKey) : '',
      ammo: w?.ammo ?? 0,
      reserve: w?.reserve ?? 0,
      reloading: p.reloading,
      weapons: p.weapons.map((s, i) => ({ name: t(WEAPONS[s.id].nameKey), ammo: s.ammo, active: i === p.weaponIndex })),
      grenades: p.grenades,
      grappleCd: clamp(p.grappleCooldown / 2.5, 0, 1),
      timeLeft: match.phase === 'roundIntro' ? match.config.roundTime : match.timeLeft,
      round: match.roundIndex + 1,
      totalRounds: match.roundOrder.length,
      role: p.role,
      targetName: def?.name ?? '',
      capture: { progress: clamp(p.captureProgress / RULES.captureTime, 0, 1), contested: !!(def && def.alive && flag && def.pos.distanceTo(flag.pos) < RULES.captureRadius && p.captureProgress > 0), active: p.role === 'attacker' && p.captureProgress > 0.01 },
      flagThreat,
      score: p.score.total,
      rank: standings.indexOf(p) + 1,
      players: this.entities.length,
      alive: p.alive,
      respawnIn: Math.max(0, p.respawnAt - this.time),
      killedBy: this.killedBy,
      sniperScope: !!w && w.id === 'sniper' && p.ads > 0.85,
      spread,
      fps: settings.data.showFps ? this.app.fps : null,
      prompt: '',
      minimap: {
        self: { x: p.pos.x, z: p.pos.z, yaw: p.yaw },
        target: match.targetPlotIndex >= 0 ? { x: this.app.plots[match.targetPlotIndex].cx, z: this.app.plots[match.targetPlotIndex].cz } : null,
        zoneRadius: ZONE_RADIUS,
        flag: p.role === 'defender' && flag ? { x: flag.pos.x, z: flag.pos.z } : null,
        plots: this.app.plots.slice(0, this.entities.length).map((pl) => ({ x: pl.cx, z: pl.cz, active: pl.index === match.targetPlotIndex, color: this.entities.find((e) => e.plotIndex === pl.index)?.colorHex ?? '#888' })),
        others,
      },
    };
  }

  /** Screen-space marker guiding attackers to the contested fortress (hidden once inside it). */
  private objectiveMarker(): HudState['objective'] {
    const match = this.match;
    if (!match || match.targetPlotIndex < 0 || this.player.role !== 'attacker' || this.mode !== 'battle') return null;
    const plot = this.app.plots[match.targetPlotIndex];
    const p = this.player.pos;
    const dist = Math.hypot(p.x - plot.cx, p.z - plot.cz);
    if (dist < 26) return null;
    const cam = this.app.gr.camera;
    const world = new THREE.Vector3(plot.cx, PLOT_Y + 14, plot.cz);
    const view = world.clone().applyMatrix4(cam.matrixWorldInverse);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const margin = 56;
    let sx: number;
    let sy: number;
    let onScreen = false;
    if (view.z < -0.1) {
      const ndc = world.clone().project(cam);
      sx = (ndc.x * 0.5 + 0.5) * w;
      sy = (1 - (ndc.y * 0.5 + 0.5)) * h;
      onScreen = sx > margin && sx < w - margin && sy > margin && sy < h - margin;
    } else {
      sx = w / 2 + Math.sign(view.x || 1) * w;
      sy = h / 2;
    }
    let angle = 0;
    if (!onScreen) {
      // Clamp to the screen edge along the direction from the centre.
      const dx = sx - w / 2;
      const dy = sy - h / 2;
      angle = Math.atan2(dy, dx);
      const kx = Math.abs(dx) > 1e-3 ? (w / 2 - margin) / Math.abs(dx) : Infinity;
      const ky = Math.abs(dy) > 1e-3 ? (h / 2 - margin) / Math.abs(dy) : Infinity;
      const k = Math.min(kx, ky, 1);
      sx = w / 2 + dx * k;
      sy = h / 2 + dy * k;
    }
    return { sx, sy, dist, onScreen, angle, label: match.defender ? match.defender.name : '' };
  }

  // ---------------- debug helpers (smoke tests) ----------------
  debugQuickMatch(botCount = 3, difficulty: 'easy' | 'normal' | 'hard' | 'nightmare' = 'normal', roundTime = 240): void {
    this.startMatch({ playerName: 'Tester', botCount, difficulty, buildTime: 0, roundTime, style: 'medieval' });
  }
  debugSkipBuild(): void {
    this.build?.autoBuild(7);
    this.finishBuild(false);
  }
  debugSkipIntro(): void {
    if (this.match && this.match.phase === 'roundIntro') this.match.update(RULES.introTime + 0.1, this.time);
  }
  /** Advances the simulation without rendering (headless tests). */
  debugAdvance(seconds: number, step = 1 / 60): void {
    const n = Math.max(1, Math.round(seconds / step));
    this.simOnly = true;
    try {
      for (let i = 0; i < n; i++) {
        this.update(step);
        this.app.input.endFrame();
      }
    } finally {
      this.simOnly = false;
    }
  }
  /** When true, per-frame presentation work (HUD, meshes, VFX) is skipped. */
  simOnly = false;
  debugAudioTest(): string[] {
    audio.init();
    const names = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'rocket', 'explosion', 'hit', 'hurt', 'kill', 'headshot', 'reload', 'empty', 'footstep', 'jump', 'land', 'grapple', 'grappleMiss', 'ricochet', 'bounce', 'captureTick', 'captureDone', 'alarm', 'roundStart', 'roundEnd', 'countdown', 'uiClick', 'uiHover', 'place', 'erase', 'pickup', 'switch', 'spawn', 'victory'] as const;
    const failed: string[] = [];
    for (const n of names) {
      try {
        audio.play(n, { pos: new THREE.Vector3(5, 12, 5) });
      } catch (err) {
        failed.push(`${n}: ${String(err)}`);
      }
    }
    for (const m of ['menu', 'build', 'battle', 'podium', 'off'] as const) {
      try {
        audio.music(m);
      } catch (err) {
        failed.push(`music ${m}: ${String(err)}`);
      }
    }
    return failed;
  }
  debugKillPlayer(): void {
    this.combat.applyDamage(this.player, 999, null, this.time, false, this.player.center);
  }
  /** Exercises the build tools programmatically. */
  debugBuildTest(): Record<string, unknown> {
    const b = this.build;
    if (!b) return { error: 'not in build mode' };
    const p = b.plot;
    b.setTool('block');
    b.placeBlock({ x: p.cx, y: PLOT_Y, z: p.cz - 8 });
    b.fillBox({ x: p.cx - 5, y: PLOT_Y, z: p.cz - 5 }, { x: p.cx + 5, y: PLOT_Y + 4, z: p.cz + 5 }, false);
    b.setPrefab('tower');
    b.stampPrefab({ x: p.cx + 12, y: PLOT_Y, z: p.cz + 12 });
    b.setPrefab('stairs');
    b.stampPrefab({ x: p.cx - 12, y: PLOT_Y, z: p.cz + 12 });
    b.paintBlock({ x: p.cx - 5, y: PLOT_Y, z: p.cz - 5 });
    b.eraseBlock({ x: p.cx - 5, y: PLOT_Y + 1, z: p.cz - 5 });
    b.placeFlag({ x: p.cx, y: PLOT_Y + 1, z: p.cz + 1 });
    b.placeSpawn({ x: p.cx + 1, y: PLOT_Y + 1, z: p.cz + 1 });
    const sealed = b.validateNow();
    b.eraseBlock({ x: p.cx - 5, y: PLOT_Y + 1, z: p.cz });
    b.eraseBlock({ x: p.cx - 5, y: PLOT_Y + 2, z: p.cz });
    const open = b.validateNow();
    b.undo();
    b.redo();
    b.saveBlueprint('smoke-test');
    const loaded = b.loadBlueprint('smoke-test');
    const after = b.validateNow();
    b.deleteBlueprint('smoke-test');
    return { used: b.state.used, sealed: sealed.reason, open: open.reason, loaded, after: after.reason, flag: b.state.flag, spawn: b.state.spawn };
  }
  debugState(): Record<string, unknown> {
    const target = this.match?.targetPlotIndex ?? -1;
    const tp = target >= 0 ? this.app.plots[target] : null;
    return {
      mode: this.mode,
      phase: this.match?.phase,
      round: this.match?.roundIndex,
      target,
      alive: this.player.alive,
      pos: this.player.pos.toArray(),
      hp: this.player.hp,
      entities: this.entities.map((e) => ({
        name: e.name,
        alive: e.alive,
        role: e.role,
        plot: e.plotIndex,
        pos: e.pos.toArray().map((v) => Math.round(v * 10) / 10),
        distToTarget: tp ? Math.round(Math.hypot(e.pos.x - tp.cx, e.pos.z - tp.cz)) : -1,
        hp: Math.round(e.hp),
        score: e.score.total,
        captures: e.score.captures,
        kills: e.score.kills,
        state: this.bots.find((b) => b.entity === e)?.state ?? 'human',
      })),
    };
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
