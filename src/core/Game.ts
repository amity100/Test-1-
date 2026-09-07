import * as THREE from 'three';
import type { App } from './App';
import { Entity, type Role, emptyScore } from '../sim/Entities';
import { CharacterController } from '../sim/CharacterController';
import { Combat } from '../sim/Combat';
import { Player } from '../sim/Player';
import { Match, type MatchConfig, RULES } from '../sim/Match';
import { WEAPONS, type WeaponId } from '../sim/Weapons';
import { WeaponLogic } from '../sim/WeaponLogic';
import { BotBrain, PROFILES, BOT_NAMES } from '../ai/BotBrain';
import { NavSystem } from '../ai/NavSystem';
import { CharacterMesh } from '../render/CharacterMesh';
import { ViewModel } from '../render/ViewModel';
import { VFX } from '../render/VFX';
import { FlagMesh } from '../render/FlagMesh';
import { FocusZone } from '../render/FocusZone';
import { buildWeaponModel } from '../render/WeaponModels';
import { HUD, type HudMarker, type HudState, type ScoreRow } from '../ui/HUD';
import { GadgetSystem, GADGETS, GADGET_IDS, KIT_SIZE, type GadgetId } from '../sim/Gadgets';
import { GadgetMeshes } from '../render/GadgetMeshes';
import { outfitFor } from '../render/Outfits';
import { Screens, type SummaryRow, type PodiumRow } from '../ui/Screens';
import { composeCard } from '../ui/FortressCard';
import { Builder } from '../build/Builder';
import { BuilderUI } from '../build/BuilderUI';
import { TouchControls, vibrate } from '../ui/TouchControls';
import { IS_TOUCH } from './Input';
import { generateFortress } from '../world/FortressGen';
import { STYLE_IDS, type StyleId } from '../world/Styles';
import { PLOT_Y, PLOT_MAX_HEIGHT, PLOT_HALF, ZONE_RADIUS, PLAYABLE_RADIUS, type Plot } from '../world/Layout';
import { blockColor, PALETTE } from '../world/Voxel';
import { STYLES } from '../world/Styles';
import { Random } from './Random';
import { settings } from './Settings';
import { BUILD_ID } from './Version';
import { t } from './i18n';
import { audio } from '../audio/AudioEngine';
import { clamp, formatTime, damp } from './MathUtil';

type Mode = 'menu' | 'build' | 'intro' | 'battle' | 'summary' | 'podium';

const PLAYER_COLORS = ['#00e5ff', '#ff2bd6', '#ffb300', '#39ff14', '#ff3355', '#a78bfa', '#ff8c42', '#7aa7ff'];
const PRIMARY_CHOICES: WeaponId[] = ['rifle', 'smg', 'shotgun', 'sniper', 'rocket'];
const GADGET_KEY_LABELS = ['Q', 'F'];

/** Keeps a stored kit valid: known ids, no duplicates, exactly KIT_SIZE entries. */
function sanitizeKit(ids: unknown): GadgetId[] {
  const out: GadgetId[] = [];
  if (Array.isArray(ids)) for (const id of ids) if ((GADGET_IDS as string[]).includes(id) && !out.includes(id as GadgetId)) out.push(id as GadgetId);
  for (const id of ['zipline', 'breach', 'grapple'] as GadgetId[]) if (out.length < KIT_SIZE && !out.includes(id)) out.push(id);
  return out.slice(0, KIT_SIZE);
}

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
  gadgets: GadgetSystem;
  private gadgetMeshes: GadgetMeshes;
  private playerKit: GadgetId[];
  private promptText = '';
  private promptUntil = 0;
  match: Match | null = null;
  nav: NavSystem | null = null;
  private exitOk = new Map<number, boolean>();
  chars = new Map<number, CharacterMesh>();
  flags = new Map<number, FlagMesh>();
  focus = new FocusZone();
  vfx = new VFX();
  viewModel: ViewModel;
  hud: HUD;
  screens: Screens;
  builder: Builder | null = null;
  builderUI: BuilderUI | null = null;
  private lastUpdateCheck = -Infinity;
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
  private lastCaptureTick = -1;
  /** Whoever is taking the flag while the alarm sounds. */
  private alarmEntity: Entity | null = null;
  private lastSiren = 0;
  /** Sim time scale for hit-stops and slow motion; camera and HUD keep real time. */
  private timeScale = 1;
  private slowmoUntil = 0;
  private slowmoScale = 1;
  /** Who killed the local player (death cam looks at them). */
  private killerEntity: Entity | null = null;
  private uiRoot: HTMLElement;

  constructor(readonly app: App) {
    this.uiRoot = document.getElementById('ui')!;
    this.controller = new CharacterController(app.world, app.terrain);
    this.combat = new Combat(app.world, app.terrain, () => this.entities);
    this.gadgets = new GadgetSystem(app.world, app.terrain, this.combat, app.plots, () => this.entities);
    this.controller.gadgets = this.gadgets;
    this.gadgetMeshes = new GadgetMeshes(this.gadgets, () => this.entities);
    app.gr.scene.add(this.gadgetMeshes.group);
    this.playerPrimary = (PRIMARY_CHOICES as string[]).includes(settings.data.primary) ? (settings.data.primary as WeaponId) : 'rifle';
    this.playerKit = sanitizeKit(settings.data.kit);
    this.player = new Entity();
    this.player.name = settings.data.playerName || 'You';
    this.player.colorHex = PLAYER_COLORS[0];
    this.viewModel = new ViewModel(app.gr.camera, new THREE.Color(PLAYER_COLORS[0]));
    app.gr.scene.add(app.gr.camera);
    app.gr.scene.add(this.focus.group);
    app.gr.scene.add(this.vfx.group);
    this.rocketModel = buildWeaponModel('rocketShell', new THREE.Color('#ffb300'), false, 'high');
    this.grenadeModel = buildWeaponModel('grenade', new THREE.Color('#39ff14'), false, 'high');
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
      card: () => void this.showFortressCard(),
    });
    this.touch = new TouchControls(this.uiRoot, app.input, {
      pause: () => (this.paused ? this.resume() : this.pause()),
      weaponSlot: (i) => {
        if (this.mode === 'battle' && WeaponLogic.switchWeapon(this.player, i)) audio.play('switch');
      },
    });
    this.touch.applyStyle(settings.data.touchScale, settings.data.touchOpacity);
    this.touch.setAutoFire(settings.data.autoFire);
    this.touch.bindWeaponSlots(this.hud.root);
    this.rotateHint = document.createElement('div');
    this.rotateHint.className = 'rotate-hint';
    this.rotateHint.innerHTML = `<span>${t('rotateDevice')}</span>`;
    this.rotateHint.hidden = true;
    this.uiRoot.appendChild(this.rotateHint);
    this.wireCombat();
    this.wireGadgets();
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
  /** Enemies that hurt the player recently (entity id → time the marker expires). */
  private threatUntil = new Map<number, number>();
  /** Damage dealt this frame per target, shown as one floating number. */
  private pendingDmg = new Map<number, { amount: number; point: THREE.Vector3; headshot: boolean; kill: boolean }>();

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
    const q = this.app.forcedQuality ?? settings.resolveQuality(this.app.gr.gpuName);
    const safe = settings.mobileSafe || this.app.gr.flags.has('mobile');
    if (q !== this.app.gr.quality || safe !== this.app.gr.mobileSafe) {
      this.app.gr.mobileSafe = safe;
      this.app.gr.setQuality(q);
      this.app.sky.setShadowMapSize(this.app.gr.profile.shadowMap);
      this.app.sky.setShadowRadius(this.app.gr.profile.shadowRadius);
    }
    audio.setVolumes(settings.data.volume, settings.data.music);
    this.touch.applyStyle(settings.data.touchScale, settings.data.touchOpacity);
    this.touch.setAutoFire(settings.data.autoFire);
  }

  private onLanguageChanged(): void {
    if (this.builderUI) this.builderUI.render();
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
    this.player.score = emptyScore();
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
    match.events.on('spawn', ({ entity, initial }) => this.onSpawn(entity, initial));
    match.events.on('score', ({ entity, delta, reason }) => {
      if (entity !== this.player || reason === 'defense') return;
      if (reason === 'holdMinute') this.hud.scorePop(`+${delta} · ${t('heldMinute', { m: entity.score.holdMinutes })}`);
      else this.hud.scorePop(`+${delta}`);
    });
    match.events.on('alarm', ({ entity, on }) => this.onAlarm(on ? entity : null));
    match.events.on('overtime', () => this.onOvertime());
    match.events.on('buildTimeUp', () => this.finishBuild(true));
    // Build phase: the block builder.
    this.builder = new Builder(this.app.world, this.app.terrain, plots[0], cfg.style, this.app.input, this.app.gr.camera, this.app.gr.scene);
    this.builderUI = new BuilderUI(
      this.uiRoot,
      this.builder,
      {
        ready: () => this.finishBuild(false),
        card: () => void this.showFortressCard(),
        pause: () => (this.paused ? this.resume() : this.pause()),
      },
      IS_TOUCH || window.innerWidth < 900,
    );
    this.builder.events.on('placed', () => {
      audio.play('place', { pitch: 0.9 + Math.random() * 0.2 });
      if (IS_TOUCH) vibrate(8);
    });
    this.builder.events.on('placedCells', ({ cells }) => {
      for (const c of cells) this.vfx.puff(new THREE.Vector3(c.x + 0.5, c.y + 0.65, c.z + 0.5), new THREE.Vector3(0, 1, 0), 3, 0.8, 0.22);
    });
    this.builder.events.on('removed', () => {
      audio.play('erase');
      if (IS_TOUCH) vibrate(16);
    });
    this.builder.enter();
    this.builderUI.show();
    this.mode = 'build';
    this.setTouchMode();
    match.startBuild();
    audio.music('build');
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
    if (!this.match || !this.builder || this.mode !== 'build') return;
    const plot = this.app.plots[0];
    // An empty or tiny plot gets a generated fortress so every round has an arena.
    if (this.builder.blocks < 4) this.builder.autoBuild(this.rng.int(1, 1e9));
    this.builder.validateNow();
    if (!this.builder.reach.ok) {
      this.builder.ensureMarkers(this.rng);
      if (this.builder.flag) this.hud.showBanner(t('placeFlagAuto'), '', 4);
    }
    const flag = this.builder.flag ?? { x: plot.cx, y: PLOT_Y, z: plot.cz };
    const spawn = this.builder.spawn ?? flag;
    this.match.setFlag(0, flag);
    this.match.setSpawn(0, spawn);
    this.builder.exit();
    this.builderUI?.hide();
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
      // Low rooms: shrink the banner so it is not buried in the ceiling.
      let free = 0;
      while (free < 6 && this.app.world.get(info.cell.x, info.cell.y + free, info.cell.z) === 0) free++;
      fm.fit(Math.max(1, free));
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
        for (const [idx, fm] of this.flags) {
          fm.group.visible = idx === match.targetPlotIndex;
          fm.setAlert(false);
        }
        this.alarmEntity = null;
        this.killerEntity = null;
        this.focus.setAlert(false);
        audio.setIntensity(0);
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
        this.gadgets.reset();
        this.gadgetMeshes.clear();
        this.showLoadout();
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

  private onSpawn(e: Entity, initial = true): void {
    if (!initial) e.protectedUntil = this.time + 2.5;
    if (e.isBot) {
      const brain = this.bots.find((b) => b.entity === e);
      brain?.reset();
      e.setLoadout(brain?.preferredWeapon ?? 'rifle');
      if (initial) e.setKit(this.randomKit());
    } else {
      e.setLoadout(this.playerPrimary);
      if (initial) e.setKit(this.playerKit);
    }
    if (initial) this.chars.get(e.id)?.setOutfit(outfitFor(e.gadgets, this.entities.indexOf(e) + e.colorIndex));
    if (!e.isBot) {
      this.touch.setGadgetIcons(e.gadgets.map((id) => GADGETS[id].icon));
      this.viewModel.show(e.weapon ? e.weapon.id : null, true);
      this.viewModel.hidden = false;
      this.killedBy = '';
    }
    const cm = this.chars.get(e.id);
    if (cm) cm.setWeapon(e.weapon?.id ?? null);
    audio.play('spawn', { pos: e.pos, volume: 0.6 });
  }

  /** Two distinct gadgets for a bot. */
  private randomKit(): GadgetId[] {
    const pool = GADGET_IDS.slice();
    const out: GadgetId[] = [];
    while (out.length < KIT_SIZE && pool.length) out.push(pool.splice(this.rng.int(0, pool.length - 1), 1)[0]);
    return out;
  }

  /** Round-intro loadout picker (weapon + two gadgets); choices persist in settings. */
  private showLoadout(): void {
    const match = this.match!;
    const def = match.defender!;
    this.screens.showLoadout({
      title: this.player === def ? t('defendFortress') : t('targetLabel', { name: def.name }),
      weapons: PRIMARY_CHOICES.map((w) => ({ id: w, name: t(WEAPONS[w].nameKey) })),
      weapon: this.playerPrimary,
      gadgets: GADGET_IDS.map((id) => ({ id, name: t(GADGETS[id].nameKey), desc: t(GADGETS[id].descKey), icon: GADGETS[id].icon })),
      kit: this.playerKit,
      kitSize: KIT_SIZE,
      onWeapon: (id) => {
        this.playerPrimary = id as WeaponId;
        settings.data.primary = id;
        settings.save();
        audio.play('switch');
      },
      onKit: (ids) => {
        this.playerKit = sanitizeKit(ids.length >= KIT_SIZE ? ids : ids.concat(this.playerKit.filter((k) => !ids.includes(k))));
        settings.data.kit = this.playerKit.slice();
        settings.save();
      },
      onReady: () => this.screens.hideAll(),
    });
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
    this.threatUntil.clear();
    this.pendingDmg.clear();
    this.builder?.dispose();
    this.builder = null;
    this.builderUI?.hide();
    this.builderUI?.root.remove();
    this.builderUI = null;
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
    this.gadgets.reset();
    this.gadgetMeshes.clear();
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
  /** Gadget events → sound, particles, navigation invalidation and HUD hints. */
  private wireGadgets(): void {
    const g = this.gadgets.events;
    const up = new THREE.Vector3(0, 1, 0);
    const dirt = new THREE.Color(0x6b5236);
    const dust = new THREE.Color(0x9a948c);
    g.on('zipline', ({ line }) => {
      audio.play('grapple', { pos: line.a });
      this.vfx.sparks(line.b, up, 8, new THREE.Color(0x9ad7ff), 5);
    });
    g.on('zipRide', ({ entity, start }) => {
      if (start) audio.play('switch', { pos: entity.pos, pitch: 0.8 });
      else audio.play('land', { pos: entity.pos, volume: 0.4 });
    });
    g.on('jumppad', ({ pad }) => audio.play('place', { pos: pad.pos, pitch: 0.8 }));
    g.on('launch', ({ entity, pad }) => {
      audio.play('jump', { pos: pad.pos, pitch: 0.6, volume: 0.9 });
      this.vfx.sparks(pad.pos.clone().setY(pad.pos.y + 0.2), up, 12, new THREE.Color(0x00e5ff), 7);
      if (entity === this.player) this.local?.addShake(0.25);
    });
    g.on('breachThrow', ({ entity }) => audio.play('switch', { pos: entity.pos, pitch: 1.2, volume: 0.6 }));
    g.on('breachStick', ({ charge }) => audio.play('bounce', { pos: charge.pos }));
    g.on('breachBlast', ({ pos, cells }) => {
      if (cells > 0) this.vfx.debrisBurst(pos, up, Math.min(48, 10 + cells * 3), dust);
    });
    g.on('grapple', ({ entity, point }) => audio.play(point ? 'grapple' : 'grappleMiss', { pos: entity.pos }));
    g.on('burrow', ({ entity, down, pos }) => {
      audio.play(down ? 'erase' : 'place', { pos, pitch: down ? 0.6 : 0.7 });
      this.vfx.debrisBurst(pos, up, down ? 26 : 34, dirt);
      if (entity === this.player) {
        this.local?.addShake(0.35);
        // Going under is a big state change: say so, and say how to get back up.
        if (down) this.hud.showBanner(t('burrowBanner'), this.surfaceInstruction(), 3.2);
      }
    });
    g.on('dig', ({ pos }) => {
      audio.play('erase', { pos, pitch: 0.75 });
      this.vfx.debrisBurst(pos, up, 16, dust);
    });
    g.on('mound', ({ pos }) => this.vfx.debrisBurst(pos, up, 3, dirt));
    g.on('deny', ({ entity, key }) => {
      if (entity !== this.player) return;
      this.promptText = t(key);
      this.promptUntil = this.time + 1.4;
      audio.play('empty', { volume: 0.5 });
    });
    g.on('blocksChanged', ({ plotIndex }) => {
      this.nav?.invalidatePlot(plotIndex);
      this.exitOk.delete(plotIndex);
      this.app.chunks.flush();
    });
  }

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
    c.events.on('damage', ({ target, attacker, amount, headshot, point }) => {
      const cm = this.chars.get(target.id);
      cm?.hitFlash();
      if (attacker === this.player && target !== this.player) {
        this.hud.hitMarker(false, headshot);
        audio.play(headshot ? 'headshot' : 'hit', { volume: 0.7 });
        const pd = this.pendingDmg.get(target.id);
        if (pd) {
          pd.amount += amount;
          pd.headshot = pd.headshot || headshot;
          pd.point.copy(point);
        } else this.pendingDmg.set(target.id, { amount, point: point.clone(), headshot, kill: false });
      }
      if (target === this.player) {
        this.hud.damage();
        this.local?.addShake(Math.min(0.6, amount / 60));
        audio.play('hurt', { volume: 0.8 });
        if (attacker) this.killedBy = attacker.name;
        if (attacker && attacker !== this.player) {
          this.threatUntil.set(attacker.id, this.time + 3.5);
          this.hud.damageFrom(this.screenAngleTo(attacker.pos));
        }
      }
    });
    c.events.on('kill', ({ victim, killer, headshot }) => {
      this.match?.onKill(victim, killer, this.time);
      if (killer) this.hud.killFeed(`<b style="color:${killer.colorHex}">${esc(killer.name)}</b> ➜ <b style="color:${victim.colorHex}">${esc(victim.name)}</b>${headshot ? ' ✦' : ''}`);
      if (killer === this.player) {
        this.hud.hitMarker(true);
        this.hud.showBanner(t('youEliminated', { name: victim.name }), '', 1.5);
        audio.play('kill');
        const pd = this.pendingDmg.get(victim.id);
        if (pd) pd.kill = true;
        else this.pendingDmg.set(victim.id, { amount: 0, point: victim.center, headshot, kill: true });
      }
      if (killer && killer !== victim) this.onKillRewards(killer, victim);
      if (victim === this.player) {
        this.killerEntity = killer && killer !== victim ? killer : null;
        this.killedBy = killer ? `${killer.name} · ${Math.round(killer.pos.distanceTo(victim.pos))} m` : '';
      }
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
        if (this.time - this.lastUpdateCheck > 60) {
          this.lastUpdateCheck = this.time;
          void this.checkForUpdate();
        }
        break;
      case 'build':
        if (!this.paused) this.builder?.update(dt);
        this.builderUI?.update(dt, match?.buildTimeLeft ?? null);
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
    for (const fm of this.flags.values()) if (fm.group.visible) fm.update(dt, this.app.gr.camera.position, this.player.role === 'attacker' && this.mode === 'battle');
    this.focus.update(dt, this.time);
    if (this.mode !== 'menu') this.vfx.ambient(this.app.gr.camera.position, dt);
    this.vfx.update(dt);
    this.gadgetMeshes.update(dt, this.time);
    this.syncProjectiles();
    audio.setListener(this.app.gr.camera.position, new THREE.Vector3(1, 0, 0).applyQuaternion(this.app.gr.camera.quaternion));
    return this.cameraFocus;
  }

  private winnerPlot(): Plot {
    const w = this.match?.standings()[0];
    return this.app.plots[w?.plotIndex ?? 0];
  }

  /** Compares the deployed build stamp with the one in memory so a tab left open learns about a newer version. */
  private async checkForUpdate(): Promise<void> {
    try {
      const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const info = (await res.json()) as { buildId?: string };
      if (info.buildId && BUILD_ID !== 'dev' && info.buildId !== BUILD_ID) this.screens.showUpdateAvailable();
    } catch {
      // Offline, or the single-file build: nothing to compare against.
    }
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

  /** Round-opening flyby: swoop from high and far down to a low orbit over the fortress about to be stormed. */
  private flybyCamera(dt: number, plot: Plot, progress: number): void {
    const cam = this.app.gr.camera;
    const k = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    const ease = k * k * (3 - 2 * k);
    const a = this.flybyAngle + ease * 2.1;
    const r = 110 - ease * 66;
    const h = PLOT_Y + 62 - ease * 42;
    const cx = plot.cx;
    const cz = plot.cz;
    cam.position.set(cx + Math.cos(a) * r, h + Math.sin(this.time * 0.8) * 0.6, cz + Math.sin(a) * r);
    cam.lookAt(cx, PLOT_Y + 6 + (1 - ease) * 4, cz);
    cam.updateMatrixWorld();
    this.cameraFocus.set(cx, PLOT_Y + 7, cz);
    const fov = 72 - ease * 16;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    void dt;
  }
  private flybyAngle = 0;

  private introUpdate(dt: number): void {
    const match = this.match!;
    const plot = this.app.plots[match.targetPlotIndex];
    if (!this.simOnly) {
      if (match.phaseTimer < 0.05) this.flybyAngle = Math.atan2(this.player.pos.z - plot.cz, this.player.pos.x - plot.cx) - 0.6;
      this.flybyCamera(dt, plot, match.phaseTimer / RULES.introTime);
      this.updateCharacters(dt);
      this.flushDamageNumbers();
      this.hud.update(this.hudState(), dt);
    }
    this.screens.updateLoadoutCountdown(RULES.introTime - match.phaseTimer);
    if (!this.introBannerShown) {
      this.introBannerShown = true;
      const def = match.defender!;
      const title = this.player === def ? t('defendFortress') : t('targetLabel', { name: def.name });
      this.hud.showBanner(title, t('intro'), 2.6);
    }
  }

  private battleUpdate(dt: number): void {
    const match = this.match!;
    const input = this.app.input;
    if (!this.local) {
      this.local = new Player(this.player, input, this.controller, this.combat, this.gadgets, this.viewModel, this.app.gr.camera, this.app.gr.scene);
      this.local.entities = () => this.entities;
      this.local.events.on('grenade', () => audio.play('switch', { volume: 0.5 }));
      this.local.events.on('reload', () => audio.play('reload'));
      this.local.events.on('weaponSwitch', () => audio.play('switch'));
    }
    this.local.enabled = !this.paused && !this.screens.visible;
    this.timeScale = this.time < this.slowmoUntil ? this.slowmoScale : 1;
    const simDt = this.paused ? 0 : dt * this.timeScale;
    if (simDt > 0) {
      // Player
      const wasAlive = this.player.alive;
      this.local.update(simDt, this.time);
      if (wasAlive && !this.player.alive) {
        /* death handled via events */
      }
      // Bots
      if (!this.debugFreezeBots) for (const b of this.bots) b.update(simDt, this.time);
      this.gadgets.update(simDt, this.time);
      this.combat.updateProjectiles(simDt, this.time);
      // Slow health regeneration after a few seconds without damage
      for (const e of this.entities) {
        if (e.alive && e.hp < e.maxHp && this.time - e.lastDamageTime > e.regenDelay) e.hp = Math.min(e.maxHp, e.hp + 10 * simDt);
        e.overdrive = e.overdriveUntil > this.time;
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
      // The siren keeps wailing for everyone but the capturer while the flag is being taken.
      if (this.alarmEntity && this.alarmEntity !== p && this.time - this.lastSiren > 1.7) {
        this.lastSiren = this.time;
        audio.play('siren', { volume: 0.45 });
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
    this.flushDamageNumbers();
    this.hud.update(this.hudState(), dt);
    if (IS_TOUCH) {
      const p = this.player;
      p.gadgets.forEach((id, i) => {
        const unlimited = GADGETS[id].charges === Infinity;
        this.touch.setGadgetState(i, p.gadgetCooldown[i] <= 0 && (unlimited || p.gadgetCharges[i] > 0), unlimited ? -1 : p.gadgetCharges[i]);
        this.touch.setGadgetBadge(i, p.gadgets[i] === 'burrow' && p.burrowed ? t('surfaceBadge') : null);
      });
    }
  }

  private deathCamera(dt: number): void {
    const cam = this.app.gr.camera;
    const p = this.player;
    // First moment after death: look at whoever did it, then orbit the body.
    const k = this.killerEntity;
    if (k && k.alive && k !== p && p.deadSince >= 0 && this.time - p.deadSince < 1.8) {
      const eye = new THREE.Vector3(p.pos.x, p.pos.y + 1.5, p.pos.z);
      cam.position.lerp(eye, Math.min(1, dt * 8));
      const q = cam.quaternion.clone();
      cam.lookAt(k.pos.x, k.pos.y + 1.3, k.pos.z);
      const want = cam.quaternion.clone();
      cam.quaternion.copy(q).slerp(want, Math.min(1, dt * 5));
      cam.updateMatrixWorld();
      return;
    }
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
      cm.visible = !firstPerson && this.mode !== 'build' && !e.burrowed;
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
    // Crosshair colour: is a living enemy under the reticle?
    const eye = p.eyePos;
    const look = p.alive ? this.combat.raycast(eye, p.forward(new THREE.Vector3()), 160, p, true) : null;
    const onEnemy = !!(look && look.entity && look.entity.alive && look.entity !== p);
    // Markers: whoever hurt you lately, plus enemies close by in plain sight.
    const markers: HudMarker[] = [];
    if (p.alive) {
      for (const e of this.entities) {
        if (e === p || !e.alive || e.burrowed) continue;
        const d = e.pos.distanceTo(p.pos);
        const threat = (this.threatUntil.get(e.id) ?? 0) > this.time;
        if (d > 70 || (!threat && d > 24)) continue;
        const sc = this.toScreen(new THREE.Vector3(e.pos.x, e.pos.y + e.height + 0.35, e.pos.z), 40);
        if (!sc.onScreen) continue;
        const to = new THREE.Vector3(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z).sub(eye);
        const dist = to.length();
        to.divideScalar(Math.max(dist, 1e-3));
        if (dist > 1 && this.combat.raycast(eye, to, dist - 0.4, p, false)) continue;
        markers.push({ sx: sc.sx, sy: sc.sy, name: e.name, color: e.colorHex, dist: d, kind: threat ? 'threat' : 'near' });
      }
      // The capturer is called out to everyone else, through walls.
      const cap = this.alarmEntity;
      if (cap && cap !== p && cap.alive) this.pushMarker(markers, cap, 'capture');
      // Radar pulse (streak reward): every enemy for a few seconds.
      if (p.radarUntil > this.time) for (const e of this.entities) if (e !== p && e.alive && e !== cap) this.pushMarker(markers, e, 'radar');
      // Comeback: last place always knows where the leader is.
      if (standings.length >= 3 && standings[standings.length - 1] === p) {
        const lead = standings[0];
        if (lead !== p && lead.alive && lead !== cap) this.pushMarker(markers, lead, 'leader');
      }
      const order: Record<HudMarker['kind'], number> = { capture: 0, threat: 1, leader: 2, radar: 3, near: 4 };
      markers.sort((a, b) => order[a.kind] - order[b.kind] || a.dist - b.dist);
    }
    const grenadeWarnings: HudState['grenadeWarnings'] = [];
    if (p.alive) {
      for (const pr of this.combat.projectiles) {
        if (pr.dead || pr.kind !== 'grenade') continue;
        const d = pr.pos.distanceTo(p.pos);
        if (d > 9) continue;
        const sc = this.toScreen(pr.pos, 56);
        grenadeWarnings.push({ sx: sc.sx, sy: sc.sy, onScreen: sc.onScreen, angle: sc.angle, dist: d });
        if (grenadeWarnings.length >= 4) break;
      }
    }
    return {
      objective,
      onEnemy,
      markers,
      grenadeWarnings,
      hp: p.hp,
      maxHp: p.maxHp,
      weaponName: w ? t(WEAPONS[w.id].nameKey) : '',
      ammo: w?.ammo ?? 0,
      reserve: w?.reserve ?? 0,
      reloading: p.reloading,
      weapons: p.weapons.map((s, i) => ({ name: t(WEAPONS[s.id].nameKey), ammo: s.ammo, active: i === p.weaponIndex })),
      grenades: p.grenades,
      gadgets: p.gadgets.map((id, i) => ({
        icon: GADGETS[id].icon,
        key: GADGET_KEY_LABELS[i] ?? String(i + 1),
        name: t(GADGETS[id].nameKey),
        charges: GADGETS[id].charges === Infinity ? -1 : p.gadgetCharges[i],
        cooldown: GADGETS[id].cooldown > 0 ? clamp(p.gadgetCooldown[i] / GADGETS[id].cooldown, 0, 1) : 0,
        active: (id === 'grapple' && !!p.grapplePoint) || (id === 'zipline' && !!p.zipRide) || (id === 'burrow' && p.burrowed),
      })),
      burrow: p.gadgets.includes('burrow') || p.burrowed ? { energy: p.burrowEnergy / 100, blind: p.burrowed && this.app.world.isSolid(Math.floor(p.pos.x), Math.floor(this.app.gr.camera.position.y), Math.floor(p.pos.z)), amount: this.local ? this.local.burrowAmount : p.burrowed ? 1 : 0 } : null,
      dig: p.digTarget && p.digProgress > 0 ? clamp(p.digProgress, 0, 1) : -1,
      timeLeft: match.phase === 'roundIntro' ? match.config.roundTime : match.timeLeft,
      round: match.roundIndex + 1,
      totalRounds: match.roundOrder.length,
      role: p.role,
      targetName: def?.name ?? '',
      capture: { progress: clamp(p.captureProgress / RULES.captureTime, 0, 1), contested: !!(def && def.alive && flag && def.pos.distanceTo(flag.pos) < RULES.captureRadius && p.captureProgress > 0), active: p.role === 'attacker' && p.captureProgress > 0.01 },
      flagThreat,
      armor: p.armor,
      streak: p.streak,
      overtime: match.overtime,
      alarm: this.alarmEntity && this.alarmEntity !== p && match.phase === 'round' ? (p.role === 'defender' ? 'defender' : 'attacker') : 'none',
      score: p.score.total,
      rank: standings.indexOf(p) + 1,
      players: this.entities.length,
      alive: p.alive,
      respawnIn: Math.max(0, p.respawnAt - this.time),
      killedBy: this.killedBy,
      sniperScope: !!w && w.id === 'sniper' && p.ads > 0.85,
      spread,
      fps: settings.data.showFps ? this.app.fps : null,
      prompt: this.time < this.promptUntil ? this.promptText : p.protectedUntil > this.time ? t('spawnShield') : p.burrowed ? this.surfaceInstruction() : '',
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
  /** Marker shown through walls (no line-of-sight test); replaces a plain sighting of the same entity. */
  private pushMarker(markers: HudMarker[], e: Entity, kind: HudMarker['kind']): void {
    const p = this.player;
    const d = e.pos.distanceTo(p.pos);
    const sc = this.toScreen(new THREE.Vector3(e.pos.x, e.pos.y + e.height + 0.35, e.pos.z), 40);
    const existing = markers.find((m) => m.name === e.name);
    if (existing) {
      existing.kind = kind;
      return;
    }
    markers.push({ sx: sc.sx, sy: sc.sy, name: e.name, color: e.colorHex, dist: d, kind });
  }

  /** Alarm: siren, red fortress and flag, banner for everyone but the capturer. */
  private onAlarm(entity: Entity | null): void {
    this.alarmEntity = entity;
    const match = this.match;
    if (!match) return;
    this.flags.get(match.targetPlotIndex)?.setAlert(!!entity);
    this.focus.setAlert(!!entity);
    if (!entity) return;
    this.lastSiren = this.time;
    if (entity === this.player) return;
    audio.play('siren', { volume: 0.7 });
    if (this.player.role === 'defender') this.hud.showBanner(t('alarmDefender'), t('alarmStop', { name: entity.name }), 2.5);
    else this.hud.showBanner(t('alarmAttacker', { name: entity.name }), t('alarmRace'), 2.5);
  }

  /** The clock ran out mid-capture: no respawns, faster music, until the flag falls or is cleared. */
  private onOvertime(): void {
    this.hud.showBanner(t('overtime'), t('overtimeSub'), 3.5);
    audio.play('overtime');
    audio.setIntensity(1);
  }

  /** Brief slow motion for the sim (kills, denied captures); the camera and HUD keep real time. */
  private slowmo(scale: number, seconds: number): void {
    this.slowmoScale = scale;
    this.slowmoUntil = this.time + seconds;
  }

  /** Streaks, multi-kills and the clutch of stopping a capture. Rewards apply to bots too. */
  private onKillRewards(killer: Entity, victim: Entity): void {
    const now = this.time;
    killer.streak++;
    killer.multiKill = now - killer.lastKillTime < 4 ? killer.multiKill + 1 : 1;
    killer.lastKillTime = now;
    const local = killer === this.player;
    const denied = victim.captureProgress > 0.12;
    if (local) {
      this.local?.addShake(0.35);
      this.slowmo(denied ? 0.3 : 0.2, denied ? 0.8 : 0.07);
      if (denied) {
        this.hud.announce(t('captureDenied'), '', 'clutch', 1.8);
        audio.play('clutch');
      } else if (killer.multiKill >= 2) {
        const m = killer.multiKill;
        this.hud.announce(t(m === 2 ? 'doubleKill' : m === 3 ? 'tripleKill' : m === 4 ? 'quadKill' : 'rampage'), '', 'multi', 1.5);
        audio.play('announce', { pitch: 1 + Math.min(4, m - 2) * 0.12, volume: 0.9 });
      }
    }
    let reward: 'rewardArmor' | 'rewardRadar' | 'rewardOverdrive' | null = null;
    if (killer.streak === 3) {
      killer.armor = 50;
      reward = 'rewardArmor';
    } else if (killer.streak === 5) {
      killer.radarUntil = now + 4;
      reward = 'rewardRadar';
    } else if (killer.streak === 7) {
      killer.overdriveUntil = now + 10;
      reward = 'rewardOverdrive';
    }
    if (reward && local) {
      window.setTimeout(() => {
        this.hud.announce(t(reward!), t(`${reward}Sub`), 'streak', 2.2);
        audio.play('streak');
      }, denied || killer.multiKill >= 2 ? 1400 : 300);
    }
  }

  private objectiveMarker(): HudState['objective'] {
    const match = this.match;
    if (!match || match.targetPlotIndex < 0 || this.player.role !== 'attacker' || this.mode !== 'battle') return null;
    const plot = this.app.plots[match.targetPlotIndex];
    const p = this.player.pos;
    const dist = Math.hypot(p.x - plot.cx, p.z - plot.cz);
    if (dist < 26) return null;
    const sc = this.toScreen(new THREE.Vector3(plot.cx, PLOT_Y + 14, plot.cz), 56);
    return { sx: sc.sx, sy: sc.sy, dist, onScreen: sc.onScreen, angle: sc.angle, label: match.defender ? match.defender.name : '' };
  }

  /** Projects a world point to the screen; off-screen points are clamped to the edge with a pointing angle. */
  private toScreen(world: THREE.Vector3, margin: number): { sx: number; sy: number; onScreen: boolean; angle: number } {
    const cam = this.app.gr.camera;
    const view = world.clone().applyMatrix4(cam.matrixWorldInverse);
    const w = window.innerWidth;
    const h = window.innerHeight;
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
    return { sx, sy, onScreen, angle };
  }

  /** How to get back above ground with the burrow drill, for the input in use. */
  private surfaceInstruction(): string {
    if (this.app.input.isTouch) return t('surfaceTouch');
    const slot = this.player.gadgets.indexOf('burrow');
    return t('surfaceKey', { key: GADGET_KEY_LABELS[Math.max(0, slot)] ?? 'Q' });
  }

  /** Bearing of a world position relative to the view direction (0 = ahead, clockwise positive). */
  private screenAngleTo(pos: THREE.Vector3): number {
    const p = this.player;
    const dx = pos.x - p.pos.x;
    const dz = pos.z - p.pos.z;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  }

  /** Shows the damage dealt this frame as floating numbers at the hit points. */
  private flushDamageNumbers(): void {
    if (this.pendingDmg.size === 0) return;
    for (const pd of this.pendingDmg.values()) {
      const sc = this.toScreen(pd.point, 0);
      if (sc.onScreen || (sc.sx > 0 && sc.sx < window.innerWidth && sc.sy > 0 && sc.sy < window.innerHeight)) this.hud.damageNumber(sc.sx, sc.sy, pd.amount, pd.headshot, pd.kill);
    }
    this.pendingDmg.clear();
  }

  // ---------------- fortress card ----------------
  /** Renders the player's fortress from a three-quarter aerial view through the full post-processing chain. */
  private captureFortress(plot: Plot): string {
    const gr = this.app.gr;
    const cam = gr.camera;
    const savedPos = cam.position.clone();
    const savedQuat = cam.quaternion.clone();
    const savedFov = cam.fov;
    // Highest storey in use decides the framing.
    let top = PLOT_Y;
    for (let y = PLOT_Y + PLOT_MAX_HEIGHT - 1; y >= PLOT_Y; y--) {
      if (this.app.world.countBlocksInBox(plot.minX, y, plot.minZ, plot.maxX, y, plot.maxZ) > 0) {
        top = y + 1;
        break;
      }
    }
    const h = Math.max(4, top - PLOT_Y);
    const dist = 30 + h * 1.15;
    cam.position.set(plot.cx + dist * 0.72, PLOT_Y + 10 + h * 0.85, plot.cz + dist * 0.72);
    cam.lookAt(plot.cx, PLOT_Y + h * 0.4, plot.cz);
    cam.fov = 48;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const hidden: THREE.Object3D[] = [];
    const hide = (o: THREE.Object3D | null | undefined): void => {
      if (o && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    };
    hide(this.builder?.visuals);
    hide(this.viewModel.root);
    gr.composer.render(1 / 60);
    const url = gr.renderer.domElement.toDataURL('image/jpeg', 0.92);
    for (const o of hidden) o.visible = true;
    cam.position.copy(savedPos);
    cam.quaternion.copy(savedQuat);
    cam.fov = savedFov;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    return url;
  }

  /** Composes and shows the shareable card of the player's fortress. */
  async showFortressCard(): Promise<void> {
    const plot = this.app.plots[0];
    const shot = this.captureFortress(plot);
    const blocks = this.app.world.countBlocksInBox(plot.minX, PLOT_Y, plot.minZ, plot.maxX, PLOT_Y + PLOT_MAX_HEIGHT, plot.maxZ);
    const standings = this.match?.standings() ?? [];
    const place = standings.indexOf(this.player);
    const finished = this.mode === 'podium';
    const styleId = this.match?.config.style ?? 'medieval';
    const { dataUrl, blob } = await composeCard(shot, {
      name: this.player.name,
      colorHex: this.player.colorHex,
      styleName: t(STYLES[styleId].nameKey),
      blocks,
      score: finished ? this.player.score.total : undefined,
      captures: finished ? this.player.score.captures : undefined,
      place: finished && place >= 0 ? place + 1 : undefined,
      players: finished ? standings.length : undefined,
      labels: { fortressOf: t('fortressOf'), blocks: t('blocks'), score: t('score'), captures: t('captures'), place: t('place'), tagline: t('tagline'), style: t('style') },
      rtl: document.documentElement.dir === 'rtl',
    });
    const wasScreen = this.screens.name;
    this.screens.showCard(dataUrl, blob, () => {
      // Back to the podium (with its rows) or straight back into the game.
      if (wasScreen === 'podium') this.screens.refreshPodium();
      else this.screens.hideAll();
    });
  }

  // ---------------- debug helpers (smoke tests) ----------------
  debugQuickMatch(botCount = 3, difficulty: 'easy' | 'normal' | 'hard' | 'nightmare' = 'normal', roundTime = 240): void {
    this.startMatch({ playerName: 'Tester', botCount, difficulty, buildTime: 0, roundTime, style: 'medieval' });
  }
  debugSkipBuild(): void {
    this.builder?.autoBuild(7);
    this.finishBuild(false);
  }
  /** Equips the local player with a kit (tests). */
  debugSetKit(ids: GadgetId[]): void {
    this.playerKit = sanitizeKit(ids);
    this.player.setKit(this.playerKit);
    this.touch.setGadgetIcons(this.player.gadgets.map((id) => GADGETS[id].icon));
  }
  /** Simulates the gadget button of a slot through the virtual input channel (tests): consumed by the next update. */
  debugGadget(slot: number, action: 'press' | 'hold' | 'release'): void {
    const v = this.app.input.virtual;
    if (action === 'press') v.gadget[slot] = true;
    v.gadgetHeld[slot] = action !== 'release';
    if (action === 'release') v.gadgetReleased[slot] = true;
  }
  /** Snapshot of gadget state (tests). */
  debugGadgetState(): Record<string, unknown> {
    const p = this.player;
    return {
      kit: p.gadgets.slice(),
      charges: p.gadgetCharges.slice(),
      cooldown: p.gadgetCooldown.map((c) => Math.round(c * 100) / 100),
      ziplines: this.gadgets.ziplines.length,
      pads: this.gadgets.pads.length,
      chargesLive: this.gadgets.charges.length,
      zipRide: !!p.zipRide,
      grapple: !!p.grapplePoint,
      latched: p.grappleLatched,
      burrowed: p.burrowed,
      energy: Math.round(p.burrowEnergy),
      pos: p.pos.toArray().map((v) => Math.round(v * 100) / 100),
      vel: p.vel.toArray().map((v) => Math.round(v * 100) / 100),
      grounded: p.grounded,
    };
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
  /** When true, bot brains are not updated (model showcase screenshots). */
  debugFreezeBots = false;
  /**
   * Lines the bots up in front of the player with different weapons and freezes them, and equips the
   * player with `weapon`, so characters and guns can be reviewed up close.
   */
  debugShowcase(weapon: WeaponId = 'rifle', distance = 4.5, pitch = 0, openGround = false): Record<string, unknown> {
    const p = this.player;
    if (openGround) {
      // Plaza in front of the monument: flat, lit, no walls.
      const x = 0;
      const z = 27;
      p.pos.set(x, this.app.terrain.heightAt(x, z) + 0.05, z);
      p.vel.set(0, 0, 0);
      p.yaw = 0;
      p.alive = true;
      p.hp = p.maxHp;
    }
    const ids: WeaponId[] = ['rifle', 'smg', 'shotgun', 'sniper', 'rocket', 'pistol'];
    const fwd = p.forwardFlat();
    const right = p.right();
    const bots = this.entities.filter((e) => e !== p);
    bots.forEach((e, i) => {
      const t = bots.length > 1 ? i / (bots.length - 1) - 0.5 : 0;
      const pos = p.pos.clone().addScaledVector(fwd, distance + Math.abs(t) * 1.5).addScaledVector(right, t * 3.2);
      pos.y = Math.max(this.app.terrain.heightAt(pos.x, pos.z), p.pos.y - 0.5);
      e.pos.copy(pos);
      e.vel.set(0, 0, 0);
      e.alive = true;
      e.hp = e.maxHp;
      e.yaw = Math.atan2(-(p.pos.x - pos.x), -(p.pos.z - pos.z));
      e.pitch = 0;
      e.crouching = false;
      e.setLoadout(ids[i % ids.length]);
      e.setKit([GADGET_IDS[i % GADGET_IDS.length], GADGET_IDS[(i + 2) % GADGET_IDS.length]]);
      this.chars.get(e.id)?.setOutfit(outfitFor(e.gadgets, i));
    });
    this.debugFreezeBots = true;
    p.setLoadout(weapon);
    this.local.viewModel.show(weapon, true);
    p.pitch = pitch;
    return { bots: bots.map((e) => ({ name: e.name, weapon: e.weapon?.id, pos: e.pos.toArray().map((v) => Math.round(v * 10) / 10) })) };
  }
  /** Sets the player's aim-down-sights amount directly (viewmodel screenshots). */
  debugAds(amount: number): void {
    this.player.ads = amount;
    this.local.debugAdsHold = amount > 0.5 ? true : null;
  }
  /** Triangle counts of the first-person weapon and one character (perf review). */
  debugModelStats(): Record<string, unknown> {
    const tally = (root: THREE.Object3D): Record<string, number> => {
      const out: Record<string, number> = {};
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const g = o.geometry as THREE.BufferGeometry;
          out[o.name || 'mesh'] = (out[o.name || 'mesh'] ?? 0) + Math.round(g.index ? g.index.count / 3 : g.attributes.position.count / 3);
        }
      });
      out.total = Object.values(out).reduce((a, b) => a + b, 0);
      return out;
    };
    let viewmodel: Record<string, number> = {};
    this.app.gr.camera.traverse((o) => {
      if (o.name.startsWith('weapon-')) viewmodel = tally(o);
    });
    const first = this.chars.values().next().value as CharacterMesh | undefined;
    return { viewmodel, character: first ? tally(first.root) : null, drawCallsHint: this.app.gr.renderer.info.render.calls };
  }
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
  /** Exercises the block builder programmatically: grow, stack, recolour, remove, undo, flag. */
  debugBuilderTest(): Record<string, unknown> {
    const b = this.builder;
    if (!b) return { error: 'not in build mode' };
    const before = b.blocks;
    const a1 = b.addBlock(3, 3, 0, 0);
    const a2 = b.addBlock(4, 3, 0, 1);
    const a3 = b.addBlock(3, 3, 1, 0);
    const a4 = b.addBlock(4, 4, 1, 3); // overhang with nothing below
    const voxels = b.result?.blocks ?? 0;
    const painted = b.paintBlock(4, 3, 0, 2);
    const removed = b.removeBlock(4, 4, 1);
    const afterRemove = b.blocks;
    b.undo();
    const afterUndo = b.blocks;
    b.redo();
    const afterRedo = b.blocks;
    const flag = b.placeFlagIn(3, 3, 1);
    const reach = b.validateNow();
    return { before, a1, a2, a3, a4, voxels, painted, removed, afterRemove, afterUndo, afterRedo, flag, flagCell: b.flag, reach, rooms: b.result?.rooms.length, entrances: b.result?.entrances.length };
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
