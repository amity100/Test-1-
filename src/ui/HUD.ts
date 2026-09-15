import { el, esc } from './dom';
import { t } from '../core/i18n';
import { formatTime } from '../core/MathUtil';

export interface HudMinimap {
  self: { x: number; z: number; yaw: number };
  target: { x: number; z: number } | null;
  zoneRadius: number;
  flag: { x: number; z: number } | null;
  plots: { x: number; z: number; active: boolean; color: string }[];
  others: { x: number; z: number; color: string }[];
  /** War capture points: owner colour (null = neutral) and the capture ring of whoever is taking it. */
  points?: { x: number; z: number; label: string; color: string | null; progress: number; progressColor: string | null }[];
}

/** Fortress War overlay: tickets, capture points, supplies and the respawn choice while dead. */
export interface HudWar {
  team: number;
  /** Ours first, theirs second. */
  tickets: [number, number];
  colors: [string, string];
  outposts: { label: string; owner: string | null; mine: boolean; progress: number; capturing: string | null; contested: boolean }[];
  supplies: number;
  flagDown: [boolean, boolean];
  spawnChoices: { label: string; key: string; selected: boolean; enabled: boolean }[] | null;
}

/** Sky Flag overlay: bricks, heights, the sea, the mark, the flag carrier, the pieces, the architect view. */
export interface HudAscent {
  bricks: number;
  bricksMax: number;
  altitude: number;
  flagAltitude: number;
  flagDist: number;
  sea: { level: number; rising: boolean; boosted: boolean; inSeconds: number; gap: number };
  marked: { name: string; color: string; you: boolean } | null;
  holder: { name: string; color: string; you: boolean; progress: number } | null;
  build: {
    kind: string;
    reason: string;
    /** The bar shows for a few seconds after any build key, and while a set piece is armed. */
    visible: boolean;
    /** What the bar says when nothing is wrong: how to build, or what the armed piece is. */
    hint: string;
    pieces: { kind: string; name: string; cost: number; icon: string; active: boolean; affordable: boolean }[];
    skins: { id: string; name: string; swatch: [string, string, string]; active: boolean }[];
  } | null;
  arch: { on: boolean; left: number; cooldown: number };
  /** Everyone alive on the altitude strip. */
  strip: { y: number; color: string; you: boolean; marked: boolean; flag: boolean }[];
  stripFlag: number | null;
  stripSea: number;
  stripMax: number;
  eliminated: boolean;
  alive: number;
  holdTime: number;
}

export interface HudGadget {
  icon: string;
  key: string;
  name: string;
  /** Remaining uses; -1 = unlimited. */
  charges: number;
  /** Remaining cooldown fraction 0..1. */
  cooldown: number;
  active: boolean;
}

export interface HudState {
  hp: number;
  maxHp: number;
  weaponName: string;
  ammo: number;
  reserve: number;
  reloading: boolean;
  weapons: { name: string; ammo: number; active: boolean }[];
  grenades: number;
  gadgets: HudGadget[];
  /** Underground presentation: energy 0..1, blind when the periscope is buried in a block, amount = blend. */
  burrow: { energy: number; blind: boolean; amount: number } | null;
  /** Drill progress 0..1 while drilling a block, -1 otherwise. */
  dig: number;
  timeLeft: number;
  round: number;
  totalRounds: number;
  role: 'defender' | 'attacker' | 'none';
  targetName: string;
  capture: { progress: number; contested: boolean; active: boolean };
  flagThreat: number;
  score: number;
  rank: number;
  players: number;
  alive: boolean;
  respawnIn: number;
  killedBy: string;
  sniperScope: boolean;
  spread: number;
  fps: number | null;
  prompt: string;
  minimap: HudMinimap;
  /** Screen-space objective marker (attackers: the contested fortress). */
  objective: { sx: number; sy: number; dist: number; onScreen: boolean; angle: number; label: string } | null;
  /** The crosshair rests on a living enemy. */
  onEnemy: boolean;
  /** Enemies worth pointing out: whoever shot you recently, and anyone close in plain sight. */
  markers: HudMarker[];
  /** Live grenades near the player. */
  grenadeWarnings: { sx: number; sy: number; onScreen: boolean; angle: number; dist: number }[];
  /** Armour points (streak reward) shown as a blue bar under health. */
  armor: number;
  /** On fire (flame vent): orange edges. */
  burning: boolean;
  /** Kills since the last death. */
  streak: number;
  /** The clock ran out mid-capture: the timer reads OVERTIME. */
  overtime: boolean;
  /** Someone is taking the flag: red pulse for the defender, amber for rival attackers. */
  alarm: 'none' | 'defender' | 'attacker';
  /** Fortress War state (null in the classic rotation). */
  war: HudWar | null;
  /** Sky Flag state (null in the other modes). */
  ascent: HudAscent | null;
}

export interface HudMarker {
  sx: number;
  sy: number;
  name: string;
  color: string;
  dist: number;
  /** threat = damaged you within the last seconds; capture = taking the flag; leader = comeback target; radar = streak reveal; ally = squadmate. */
  kind: 'threat' | 'near' | 'capture' | 'leader' | 'radar' | 'ally';
}

export interface ScoreRow {
  name: string;
  role: string;
  score: number;
  captures: number;
  kills: number;
  defense: number;
  color: string;
  isYou: boolean;
}

/** Battle HUD: crosshair, vitals, weapons, timer, minimap, capture ring, kill feed, banners, scoreboard. */
export class HUD {
  readonly root: HTMLElement;
  private cross: HTMLElement;
  private crossTicks: HTMLElement[] = [];
  private hitMark: HTMLElement;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private armorBar: HTMLElement;
  private armorFill: HTMLElement;
  private streakEl: HTMLElement;
  private alarmVeil: HTMLElement;
  private burnVeil: HTMLElement;
  private announceEl: HTMLElement;
  private announceTitle: HTMLElement;
  private announceSub: HTMLElement;
  private announceUntil = 0;
  private hpWrap: HTMLElement;
  private ammoText: HTMLElement;
  private reserveText: HTMLElement;
  private weaponName: HTMLElement;
  private slots: HTMLElement;
  private grenadesEl: HTMLElement;
  private gadgetsEl: HTMLElement;
  private gadgetSlots: { root: HTMLElement; cd: HTMLElement; count: HTMLElement; key: string }[] = [];
  private veil: HTMLElement;
  private veilEnergy: HTMLElement;
  private veilLabel: HTMLElement;
  private digEl: HTMLElement;
  private digFill: HTMLElement;
  private digText: HTMLElement;
  private timer: HTMLElement;
  private roundLabel: HTMLElement;
  private targetLabel: HTMLElement;
  private roleBadge: HTMLElement;
  private scoreEl: HTMLElement;
  private captureWrap: HTMLElement;
  private captureRing: SVGCircleElement;
  private captureText: HTMLElement;
  private threat: HTMLElement;
  private feed: HTMLElement;
  private banner: HTMLElement;
  private bannerTitle: HTMLElement;
  private bannerSub: HTMLElement;
  private bannerUntil = 0;
  private dmg: HTMLElement;
  private death: HTMLElement;
  private deathText: HTMLElement;
  private deathTimer: HTMLElement;
  private scope: HTMLElement;
  private fpsEl: HTMLElement;
  private prompt: HTMLElement;
  private minimap: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private scoreboard: HTMLElement;
  private pops: HTMLElement;
  private objective: HTMLElement;
  private objDist: HTMLElement;
  private objLabel: HTMLElement;
  private objArrow: HTMLElement;
  private last: Partial<Record<string, string | number | boolean>> = {};
  private hitTimer = 0;
  private dmgTimer = 0;
  private dmgDir: HTMLElement;
  private arcs: { el: HTMLElement; t: number }[] = [];
  private nums: HTMLElement;
  private markerLayer: HTMLElement;
  private markerPool: { root: HTMLElement; name: HTMLElement; dist: HTMLElement; tag: HTMLElement }[] = [];
  private grenadeLayer: HTMLElement;
  private grenadePool: HTMLElement[] = [];
  private warBar: HTMLElement;
  private topbar: HTMLElement;
  private warOurs: HTMLElement;
  private warTheirs: HTMLElement;
  private warPoints: HTMLElement;
  private warPointEls: { root: HTMLElement; ring: SVGCircleElement; key: string }[] = [];
  private warSupplies: HTMLElement;
  private spawnBox: HTMLElement;
  private spawnKey = '';
  /** Called with -1 for the fortress or a capture point index when the player picks a respawn. */
  onSpawnChoice: ((i: number) => void) | null = null;
  // Sky Flag
  private sky: HTMLElement;
  private skyBricks: HTMLElement;
  private skyBricksN: HTMLElement;
  private skyAlt: HTMLElement;
  private skyFlagLine: HTMLElement;
  private skyStrip: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;
  private skyMarked: HTMLElement;
  private skyHold: HTMLElement;
  private skyHoldFill: HTMLElement;
  private skyHoldText: HTMLElement;
  private skySea: HTMLElement;
  private skyPieces: HTMLElement;
  private skyPieceEls: { root: HTMLElement; kind: string }[] = [];
  private skyHint: HTMLElement;
  private skyArch: HTMLElement;
  private skyArchRing: SVGCircleElement;
  private skyArchText: HTMLElement;
  private skyFrame: HTMLElement;
  private skyOut: HTMLElement;
  /** Touch: tapping a piece tile picks it. */
  onPiece: ((kind: string) => void) | null = null;
  onSkin: ((id: string) => void) | null = null;
  private skySkinEls: { root: HTMLElement; id: string }[] = [];
  private skySkins!: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud');
    this.root.hidden = true;
    this.root.setAttribute('data-game', '1');
    parent.appendChild(this.root);

    // Crosshair
    this.cross = el('div', 'crosshair');
    for (let i = 0; i < 4; i++) {
      const tick = el('div', `tick t${i}`);
      this.cross.appendChild(tick);
      this.crossTicks.push(tick);
    }
    const dot = el('div', 'dot');
    this.cross.appendChild(dot);
    this.hitMark = el('div', 'hitmark');
    for (let i = 0; i < 4; i++) this.hitMark.appendChild(el('div', `hm hm${i}`));
    this.cross.appendChild(this.hitMark);
    this.root.appendChild(this.cross);

    // Vitals
    this.hpWrap = el('div', 'vitals');
    const hpBar = el('div', 'hpbar');
    this.hpFill = el('div', 'fill');
    hpBar.appendChild(this.hpFill);
    this.hpText = el('div', 'hptext', '100');
    const gear = el('div', 'gear');
    this.grenadesEl = el('div', 'grenades');
    this.gadgetsEl = el('div', 'gadgets');
    gear.append(this.grenadesEl, this.gadgetsEl);
    this.armorBar = el('div', 'armorbar');
    this.armorFill = el('div', 'fill');
    this.armorBar.appendChild(this.armorFill);
    this.armorBar.hidden = true;
    this.streakEl = el('div', 'streak');
    this.streakEl.hidden = true;
    this.hpWrap.append(this.hpText, hpBar, this.armorBar, gear, this.streakEl);
    this.root.appendChild(this.hpWrap);

    // Underground veil (burrow drill) and drilling progress
    this.veil = el('div', 'burrow-veil');
    this.veil.innerHTML = `<div class="dirt"></div><div class="under"></div><div class="energy"><span class="lbl"></span><div class="ebar"><div class="fill"></div></div></div>`;
    (this.veil.querySelector('.under') as HTMLElement).textContent = t('burrowBanner');
    this.veilEnergy = this.veil.querySelector('.ebar .fill') as HTMLElement;
    this.veilLabel = this.veil.querySelector('.energy .lbl') as HTMLElement;
    this.veil.hidden = true;
    this.root.appendChild(this.veil);
    this.digEl = el('div', 'dig');
    this.digEl.innerHTML = `<div class="dbar"><div class="fill"></div></div><div class="dtxt"></div>`;
    this.digFill = this.digEl.querySelector('.fill') as HTMLElement;
    this.digText = this.digEl.querySelector('.dtxt') as HTMLElement;
    this.digEl.hidden = true;
    this.root.appendChild(this.digEl);

    // Weapon
    const wpn = el('div', 'weapon');
    this.weaponName = el('div', 'wname');
    const ammoRow = el('div', 'ammo');
    this.ammoText = el('span', 'mag', '30');
    this.reserveText = el('span', 'reserve', '/ 120');
    ammoRow.append(this.ammoText, this.reserveText);
    this.slots = el('div', 'slots');
    wpn.append(this.weaponName, ammoRow, this.slots);
    this.root.appendChild(wpn);

    // Top centre
    const top = el('div', 'topbar');
    this.topbar = top;
    this.roundLabel = el('div', 'round');
    this.timer = el('div', 'timer', '4:00');
    this.targetLabel = el('div', 'target');
    this.roleBadge = el('div', 'role');
    top.append(this.roundLabel, this.timer, this.targetLabel, this.roleBadge);
    this.root.appendChild(top);

    // Score
    this.scoreEl = el('div', 'score');
    this.root.appendChild(this.scoreEl);

    // Capture ring
    this.captureWrap = el('div', 'capture');
    this.captureWrap.innerHTML = `<svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42"/></svg><div class="ctext"></div>`;
    this.captureRing = this.captureWrap.querySelector('.fg') as SVGCircleElement;
    this.captureText = this.captureWrap.querySelector('.ctext') as HTMLElement;
    this.captureWrap.hidden = true;
    this.root.appendChild(this.captureWrap);
    this.threat = el('div', 'threat');
    this.threat.hidden = true;
    this.root.appendChild(this.threat);
    // Alarm pulse round the screen edge while the flag is being taken.
    this.alarmVeil = el('div', 'alarm-veil');
    this.alarmVeil.hidden = true;
    this.root.appendChild(this.alarmVeil);
    this.burnVeil = el('div', 'burn-veil');
    this.burnVeil.hidden = true;
    this.root.appendChild(this.burnVeil);
    // Announcer (multi-kills, streak rewards, denied captures): louder and shorter than the banner.
    this.announceEl = el('div', 'announce');
    this.announceTitle = el('div', 'a-title');
    this.announceSub = el('div', 'a-sub');
    this.announceEl.append(this.announceTitle, this.announceSub);
    this.announceEl.hidden = true;
    this.root.appendChild(this.announceEl);

    // Kill feed
    this.feed = el('div', 'feed');
    this.root.appendChild(this.feed);

    // Banner
    this.banner = el('div', 'banner');
    this.bannerTitle = el('div', 'btitle');
    this.bannerSub = el('div', 'bsub');
    this.banner.append(this.bannerTitle, this.bannerSub);
    this.banner.hidden = true;
    this.root.appendChild(this.banner);

    // Damage overlay & death
    this.dmg = el('div', 'dmg');
    this.root.appendChild(this.dmg);
    // Damage direction arcs around the crosshair (pooled) and floating damage numbers.
    this.dmgDir = el('div', 'dmgdir');
    for (let i = 0; i < 6; i++) {
      const a = el('div', 'dmgarc');
      a.hidden = true;
      this.dmgDir.appendChild(a);
      this.arcs.push({ el: a, t: 0 });
    }
    this.root.appendChild(this.dmgDir);
    this.nums = el('div', 'dmgnums');
    this.root.appendChild(this.nums);
    // Enemy markers and grenade warnings (pooled, positioned in screen space).
    this.markerLayer = el('div', 'markers');
    for (let i = 0; i < 8; i++) {
      const root = el('div', 'marker');
      root.innerHTML = `<div class="m-chev"></div><div class="m-name"></div><div class="m-dist"></div><div class="m-tag"></div>`;
      root.hidden = true;
      this.markerLayer.appendChild(root);
      this.markerPool.push({ root, name: root.querySelector('.m-name') as HTMLElement, dist: root.querySelector('.m-dist') as HTMLElement, tag: root.querySelector('.m-tag') as HTMLElement });
    }
    this.root.appendChild(this.markerLayer);
    this.grenadeLayer = el('div', 'gwarns');
    for (let i = 0; i < 4; i++) {
      const g = el('div', 'gwarn');
      g.innerHTML = `<div class="g-arrow"></div><div class="g-icon">!</div><div class="g-label"></div>`;
      g.hidden = true;
      this.grenadeLayer.appendChild(g);
      this.grenadePool.push(g);
    }
    this.root.appendChild(this.grenadeLayer);
    this.death = el('div', 'death');
    this.deathText = el('div', 'dtext');
    this.deathTimer = el('div', 'dtimer');
    this.spawnBox = el('div', 'spawnbox');
    this.spawnBox.setAttribute('data-ui', '1');
    this.spawnBox.hidden = true;
    this.death.append(this.deathText, this.deathTimer, this.spawnBox);
    this.death.hidden = true;
    this.root.appendChild(this.death);
    // Fortress War bar: tickets either side, the three points in the middle, the objective and supplies
    // below. It lives inside the topbar, right under the timer, so it can never overlap it.
    this.warBar = el('div', 'warbar');
    this.warOurs = el('div', 'wt ours');
    this.warTheirs = el('div', 'wt theirs');
    this.warPoints = el('div', 'wpoints');
    this.warSupplies = el('div', 'wsupplies');
    this.warBar.append(this.warOurs, this.warPoints, this.warTheirs, this.warSupplies);
    this.warBar.hidden = true;
    this.topbar.insertBefore(this.warBar, this.roleBadge);

    // Scope
    this.scope = el('div', 'scope');
    this.scope.innerHTML = `<div class="lens"></div><div class="hl"></div><div class="vl"></div>`;
    this.scope.hidden = true;
    this.root.appendChild(this.scope);

    this.fpsEl = el('div', 'fps');
    this.fpsEl.hidden = true;
    this.root.appendChild(this.fpsEl);
    this.prompt = el('div', 'prompt');
    this.prompt.hidden = true;
    this.root.appendChild(this.prompt);

    // Minimap
    this.minimap = el('canvas', 'minimap');
    this.minimap.width = 200;
    this.minimap.height = 200;
    this.mctx = this.minimap.getContext('2d')!;
    this.root.appendChild(this.minimap);

    this.scoreboard = el('div', 'scoreboard');
    this.scoreboard.setAttribute('data-ui', '1');
    this.scoreboard.hidden = true;
    this.root.appendChild(this.scoreboard);
    this.pops = el('div', 'pops');
    this.root.appendChild(this.pops);

    // Objective marker
    this.objective = el('div', 'objective');
    this.objective.innerHTML = `<div class="o-arrow"></div><div class="o-diamond"></div><div class="o-label"></div><div class="o-dist"></div>`;
    this.objArrow = this.objective.querySelector('.o-arrow') as HTMLElement;
    this.objLabel = this.objective.querySelector('.o-label') as HTMLElement;
    this.objDist = this.objective.querySelector('.o-dist') as HTMLElement;
    this.objective.hidden = true;
    this.root.appendChild(this.objective);

    // Sky Flag overlay.
    this.sky = el('div', 'sky');
    this.sky.hidden = true;
    this.skyFrame = el('div', 'sky-frame');
    this.skyFrame.hidden = true;
    this.sky.appendChild(this.skyFrame);
    this.skyBricks = el('div', 'sky-bricks');
    this.skyBricksN = el('span', 'n', '0');
    this.skyBricks.append(el('span', 'ico', '🧱'), this.skyBricksN, el('span', 'lbl', t('bricks')));
    this.sky.appendChild(this.skyBricks);
    const heights = el('div', 'sky-heights');
    this.skyAlt = el('div', 'sky-alt', '▲ 0 m');
    this.skyFlagLine = el('div', 'sky-flagline', '');
    heights.append(this.skyAlt, this.skyFlagLine);
    this.sky.appendChild(heights);
    this.skyMarked = el('div', 'sky-marked');
    this.skyMarked.hidden = true;
    this.sky.appendChild(this.skyMarked);
    this.skyHold = el('div', 'sky-hold');
    this.skyHold.innerHTML = `<div class="htxt"></div><div class="hbar"><div class="fill"></div></div>`;
    this.skyHoldFill = this.skyHold.querySelector('.fill') as HTMLElement;
    this.skyHoldText = this.skyHold.querySelector('.htxt') as HTMLElement;
    this.skyHold.hidden = true;
    this.sky.appendChild(this.skyHold);
    this.skySea = el('div', 'sky-sea');
    this.skySea.hidden = true;
    this.sky.appendChild(this.skySea);
    this.skyStrip = el('canvas', 'sky-strip');
    this.skyStrip.width = 72;
    this.skyStrip.height = 720;
    this.sctx = this.skyStrip.getContext('2d')!;
    this.sky.appendChild(this.skyStrip);
    this.skyPieces = el('div', 'sky-pieces');
    this.skyPieces.setAttribute('data-ui', '1');
    this.skyPieces.hidden = true;
    this.sky.appendChild(this.skyPieces);
    this.skySkins = el('div', 'sky-skins');
    this.skySkins.setAttribute('data-ui', '1');
    this.skySkins.hidden = true;
    this.sky.appendChild(this.skySkins);
    this.skyHint = el('div', 'sky-hint');
    this.skyHint.hidden = true;
    this.sky.appendChild(this.skyHint);
    this.skyArch = el('div', 'sky-arch');
    this.skyArch.innerHTML = `<svg viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="16"/><circle class="fg" cx="20" cy="20" r="16"/></svg><div class="atxt"></div>`;
    this.skyArchRing = this.skyArch.querySelector('.fg') as SVGCircleElement;
    this.skyArchText = this.skyArch.querySelector('.atxt') as HTMLElement;
    this.skyArch.hidden = true;
    this.sky.appendChild(this.skyArch);
    this.skyOut = el('div', 'sky-out', '');
    this.skyOut.hidden = true;
    this.sky.appendChild(this.skyOut);
    this.root.appendChild(this.sky);
  }

  show(): void {
    this.root.hidden = false;
  }
  hide(): void {
    this.root.hidden = true;
    this.scoreboard.hidden = true;
  }

  /** Two kit slots: icon, key, name, charges and a cooldown line. */
  private syncGadgets(list: HudGadget[]): void {
    const sig = list.map((g) => g.icon + g.name + g.key).join('|');
    if (this.last.gsig !== sig) {
      this.last.gsig = sig;
      this.gadgetsEl.innerHTML = '';
      this.gadgetSlots = list.map((g) => {
        const root = el('div', 'gslot');
        root.innerHTML = `<span class="lbl">${esc(g.key)}</span><span class="gi">${g.icon}</span><span class="gname">${esc(g.name)}</span><span class="n"></span><div class="cd"><div class="fill"></div></div>`;
        this.gadgetsEl.appendChild(root);
        return { root, cd: root.querySelector('.cd .fill') as HTMLElement, count: root.querySelector('.n') as HTMLElement, key: '' };
      });
    }
    list.forEach((g, i) => {
      const slot = this.gadgetSlots[i];
      if (!slot) return;
      const k = `${g.charges}|${g.active}`;
      if (slot.key !== k) {
        slot.key = k;
        slot.count.textContent = g.charges < 0 ? '∞' : String(g.charges);
        slot.root.classList.toggle('active', g.active);
        slot.root.classList.toggle('empty', g.charges === 0);
      }
      slot.cd.style.width = `${(1 - g.cooldown) * 100}%`;
    });
  }

  private set(key: string, elem: HTMLElement, value: string | number): void {
    if (this.last[key] === value) return;
    this.last[key] = value;
    elem.textContent = String(value);
  }

  update(s: HudState, dt: number): void {
    this.set('hp', this.hpText, Math.ceil(s.hp));
    const hpPct = Math.max(0, s.hp / s.maxHp);
    this.hpFill.style.width = `${hpPct * 100}%`;
    this.hpFill.style.background = hpPct < 0.3 ? 'var(--danger)' : hpPct < 0.6 ? 'var(--accent2)' : 'linear-gradient(90deg,#39ff14,#00e5ff)';
    this.hpWrap.classList.toggle('low', hpPct < 0.3);
    this.set('wname', this.weaponName, s.weaponName);
    this.set('ammo', this.ammoText, s.reloading ? t('reloading') : String(s.ammo));
    this.ammoText.classList.toggle('reloading', s.reloading);
    this.set('reserve', this.reserveText, `/ ${s.reserve}`);
    const slotsKey = s.weapons.map((w) => `${w.name}:${w.active}`).join('|');
    if (this.last.slots !== slotsKey) {
      this.last.slots = slotsKey;
      this.slots.innerHTML = s.weapons.map((w, i) => `<div class="slot ${w.active ? 'active' : ''}"><span class="k">${i + 1}</span>${esc(w.name)}</div>`).join('');
    }
    if (this.last.grenades !== s.grenades) {
      this.last.grenades = s.grenades;
      this.grenadesEl.innerHTML = `<span class="lbl">G</span>` + Array.from({ length: 4 }, (_, i) => `<span class="gr ${i < s.grenades ? 'on' : ''}"></span>`).join('');
    }
    this.syncGadgets(s.gadgets);
    // Burrow veil + drill progress
    if (s.burrow && s.burrow.amount > 0.02) {
      this.veil.hidden = false;
      this.veil.style.opacity = String(Math.min(1, s.burrow.amount));
      this.veil.classList.toggle('blind', s.burrow.blind);
      this.veilEnergy.style.width = `${Math.max(0, Math.min(1, s.burrow.energy)) * 100}%`;
      this.set('veilLabel', this.veilLabel, `${t('underground')} · ${t('energy')} ${Math.round(s.burrow.energy * 100)}%`);
    } else this.veil.hidden = true;
    if (s.dig >= 0) {
      this.digEl.hidden = false;
      this.digFill.style.width = `${Math.min(1, s.dig) * 100}%`;
      this.set('digText', this.digText, t('drilling'));
    } else this.digEl.hidden = true;
    this.set('timer', this.timer, s.overtime ? t('overtime') : formatTime(s.timeLeft));
    this.timer.classList.toggle('urgent', s.timeLeft < 30 && !s.overtime);
    this.timer.classList.toggle('overtime', s.overtime);
    // Armour and streak
    if (s.armor > 0) {
      this.armorBar.hidden = false;
      this.armorFill.style.width = `${Math.min(1, s.armor / 50) * 100}%`;
    } else this.armorBar.hidden = true;
    if (s.streak >= 2 && s.alive) {
      this.streakEl.hidden = false;
      this.set('streak', this.streakEl, `🔥 ${s.streak} ${t('streakLabel')}`);
    } else this.streakEl.hidden = true;
    if (s.alarm !== 'none' && s.alive) {
      this.alarmVeil.hidden = false;
      this.alarmVeil.classList.toggle('att', s.alarm === 'attacker');
    } else this.alarmVeil.hidden = true;
    this.burnVeil.hidden = !(s.burning && s.alive);
    if (!this.announceEl.hidden) {
      const left = (this.announceUntil - performance.now()) / 1000;
      if (left <= 0) this.announceEl.hidden = true;
      else this.announceEl.style.opacity = String(Math.min(1, left / 0.35));
    }
    if (s.war) {
      this.set('round', this.roundLabel, t('fortressWar'));
      // The war bar sits right under the timer, so the objective line moves into it (see syncWar).
      this.targetLabel.hidden = true;
      this.roleBadge.hidden = true;
    } else if (s.ascent) {
      this.set('round', this.roundLabel, `${t('skyFlag')} · ${s.ascent.alive}/${s.players}`);
      this.targetLabel.hidden = true;
      this.roleBadge.hidden = true;
    } else {
      this.set('round', this.roundLabel, t('round', { n: s.round, total: s.totalRounds }));
      this.targetLabel.hidden = false;
      this.roleBadge.hidden = false;
      this.set('target', this.targetLabel, s.role === 'defender' ? t('defendFortress') : t('attackFortress', { name: s.targetName }));
      this.set('role', this.roleBadge, s.role === 'defender' ? t('defender') : t('attacker'));
      this.roleBadge.classList.toggle('def', s.role === 'defender');
    }
    this.set('score', this.scoreEl, `${t('score')} ${s.score}  ·  #${s.rank}/${s.players}`);

    // Capture ring
    if (s.capture.active) {
      this.captureWrap.hidden = false;
      const c = 2 * Math.PI * 42;
      this.captureRing.style.strokeDasharray = `${c}`;
      this.captureRing.style.strokeDashoffset = `${c * (1 - s.capture.progress)}`;
      this.captureWrap.classList.toggle('contested', s.capture.contested);
      this.set('ctext', this.captureText, s.capture.contested ? t('contested') : t('capturing'));
    } else this.captureWrap.hidden = true;
    if (s.role === 'defender' && s.flagThreat > 0.01) {
      this.threat.hidden = false;
      this.threat.textContent = `⚠ ${t('capturing')} ${Math.round(s.flagThreat * 100)}%`;
    } else this.threat.hidden = true;

    // Crosshair
    this.cross.classList.toggle('enemy', s.onEnemy);
    const gap = 6 + s.spread;
    this.crossTicks[0].style.transform = `translate(-50%, ${-gap - 8}px)`;
    this.crossTicks[1].style.transform = `translate(-50%, ${gap}px)`;
    this.crossTicks[2].style.transform = `translate(${-gap - 8}px, -50%)`;
    this.crossTicks[3].style.transform = `translate(${gap}px, -50%)`;
    this.cross.hidden = !s.alive || s.sniperScope;
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      this.hitMark.style.opacity = String(Math.max(0, this.hitTimer / 0.18));
    }
    // Damage direction arcs fade out over a second.
    for (const a of this.arcs) {
      if (a.el.hidden) continue;
      a.t -= dt;
      if (a.t <= 0) a.el.hidden = true;
      else a.el.style.opacity = String(Math.min(1, a.t / 0.7));
    }
    // Damage flash
    if (this.dmgTimer > 0) {
      this.dmgTimer -= dt;
      this.dmg.style.opacity = String(Math.max(0, this.dmgTimer / 0.5) * 0.85);
    } else this.dmg.style.opacity = String(hpPct < 0.3 ? 0.25 + 0.15 * Math.sin(performance.now() / 200) : 0);
    // Death
    if (!s.alive) {
      this.death.hidden = false;
      const out = !!s.ascent?.eliminated;
      this.set('dtext', this.deathText, out ? t('spectating') : s.killedBy ? t('eliminatedBy', { name: s.killedBy }) : '');
      this.set('dtimer', this.deathTimer, out ? t('eliminatedOut') : t('respawnIn', { n: Math.ceil(s.respawnIn) }));
      this.syncSpawnChoices(s.war?.spawnChoices ?? null);
    } else this.death.hidden = true;
    this.syncWar(s.war);
    this.syncAscent(s);
    this.scope.hidden = !s.sniperScope;
    if (s.fps !== null) {
      this.fpsEl.hidden = false;
      this.set('fps', this.fpsEl, `${Math.round(s.fps)} ${t('fpsLabel')}`);
    } else this.fpsEl.hidden = true;
    if (s.prompt) {
      this.prompt.hidden = false;
      this.set('prompt', this.prompt, s.prompt);
    } else this.prompt.hidden = true;
    // Banner (wall-clock based so it also expires while the sim is stepped without rendering)
    if (!this.banner.hidden) {
      const left = (this.bannerUntil - performance.now()) / 1000;
      if (left <= 0) this.banner.hidden = true;
      else this.banner.style.opacity = String(Math.min(1, left / 0.5));
    }
    this.drawMinimap(s.minimap);
    this.syncMarkers(s.markers);
    this.syncGrenades(s.grenadeWarnings);
    // Objective marker
    const o = s.objective;
    if (o && s.alive) {
      this.objective.hidden = false;
      this.objective.style.transform = `translate(${o.sx.toFixed(0)}px, ${o.sy.toFixed(0)}px)`;
      this.objective.classList.toggle('off', !o.onScreen);
      this.objArrow.style.transform = `rotate(${o.angle.toFixed(1)}rad)`;
      this.set('odist', this.objDist, `${Math.round(o.dist)} m`);
      this.set('olabel', this.objLabel, o.label);
    } else this.objective.hidden = true;
  }

  private syncAscent(s: HudState): void {
    const a = s.ascent;
    if (!a) {
      if (!this.sky.hidden) this.sky.hidden = true;
      return;
    }
    this.sky.hidden = false;
    this.set('skyBricks', this.skyBricksN, a.bricks);
    this.skyBricks.classList.toggle('low', a.bricks < 3);
    this.skyBricks.classList.toggle('full', a.bricks >= a.bricksMax);
    this.set('skyAlt', this.skyAlt, `▲ ${Math.round(a.altitude)} ${t('metres')}`);
    this.set('skyFlag', this.skyFlagLine, `🚩 ${Math.round(a.flagAltitude)} ${t('metres')} · ${Math.round(a.flagDist)} ${t('metres')} ${t('away')}`);
    // The mark.
    if (a.marked) {
      this.skyMarked.hidden = false;
      this.set('skyMarked', this.skyMarked, a.marked.you ? `👑 ${t('youAreMarked')}` : `👑 ${a.marked.name} · ${t('markedTag')}`);
      this.skyMarked.style.color = a.marked.you ? '#ffd36a' : a.marked.color;
      this.skyMarked.classList.toggle('you', a.marked.you);
    } else this.skyMarked.hidden = true;
    this.skyFrame.hidden = !(a.marked?.you && s.alive);
    // The carrier.
    if (a.holder) {
      this.skyHold.hidden = false;
      const left = Math.ceil((1 - a.holder.progress) * a.holdTime);
      this.skyHoldFill.style.width = `${(a.holder.progress * 100).toFixed(1)}%`;
      this.skyHoldFill.style.background = a.holder.you ? '#ffd36a' : a.holder.color;
      this.set('skyHoldText', this.skyHoldText, a.holder.you ? t('holdTheFlag', { n: left }) : t('holderHas', { name: a.holder.name, n: left }));
      this.skyHold.classList.toggle('you', a.holder.you);
    } else this.skyHold.hidden = true;
    // The sea.
    const sea = a.sea;
    let seaText = '';
    let seaCls = '';
    if (!sea.rising) seaText = sea.inSeconds > 0 && sea.inSeconds < 120 ? `🌊 ${t('seaIn', { t: formatTime(sea.inSeconds) })}` : '';
    else {
      seaText = `🌊 ${t('seaBelow', { n: Math.max(0, Math.round(sea.gap)) })}${sea.boosted ? ` · ${t('seaSurging')}` : ''}`;
      seaCls = sea.gap < 8 ? 'danger' : sea.gap < 20 ? 'warn' : '';
    }
    this.skySea.hidden = !seaText || !s.alive;
    this.set('skySea', this.skySea, seaText);
    if (this.last.seaCls !== seaCls) {
      this.last.seaCls = seaCls;
      this.skySea.className = `sky-sea ${seaCls}`;
    }
    // The piece bar: the path and the set pieces, with the finish chips over it.
    const b = a.build;
    if (b && s.alive && b.visible) {
      if (this.skyPieceEls.length === 0) {
        for (const p of b.pieces) {
          const tile = el('div', 'sky-piece');
          tile.innerHTML = `<div class="pi">${p.icon}</div><div class="pn"></div><div class="pc"></div><div class="pk"></div>`;
          tile.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onPiece?.(p.kind);
          });
          this.skyPieces.appendChild(tile);
          this.skyPieceEls.push({ root: tile, kind: p.kind });
        }
      }
      this.skyPieces.hidden = false;
      b.pieces.forEach((p, i) => {
        const tile = this.skyPieceEls[i];
        if (!tile) return;
        tile.root.classList.toggle('active', p.active);
        tile.root.classList.toggle('poor', !p.affordable);
        const pn = tile.root.querySelector('.pn') as HTMLElement;
        if (pn.textContent !== p.name) pn.textContent = p.name;
        const pc = tile.root.querySelector('.pc') as HTMLElement;
        const cost = `${p.cost} 🧱`;
        if (pc.textContent !== cost) pc.textContent = cost;
        const pk = tile.root.querySelector('.pk') as HTMLElement;
        const key = String(i + 1);
        if (pk.textContent !== key) pk.textContent = key;
      });
      // The finish chips: one per skin, the active one lit.
      if (this.skySkinEls.length === 0) {
        for (const sk of b.skins) {
          const chip = el('div', 'sky-skin');
          chip.innerHTML = `<span class="sw"><i style="background:${sk.swatch[0]}"></i><i style="background:${sk.swatch[1]}"></i><i style="background:${sk.swatch[2]}"></i></span><span class="sn"></span>`;
          chip.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onSkin?.(sk.id);
          });
          this.skySkins.appendChild(chip);
          this.skySkinEls.push({ root: chip, id: sk.id });
        }
      }
      this.skySkins.hidden = false;
      b.skins.forEach((sk, i) => {
        const chip = this.skySkinEls[i];
        if (!chip) return;
        chip.root.classList.toggle('active', sk.active);
        const sn = chip.root.querySelector('.sn') as HTMLElement;
        if (sn.textContent !== sk.name) sn.textContent = sk.name;
      });
      this.skyHint.hidden = false;
      const hint =
        b.reason === 'ok'
          ? b.hint
          : t(b.reason === 'bricks' ? 'needBricksShort' : b.reason === 'occupied' ? 'placeOccupied' : b.reason === 'unsupported' ? 'placeUnsupported' : b.reason === 'full' ? 'placeFull' : 'placeRange');
      this.set('skyHint', this.skyHint, hint);
      this.skyHint.classList.toggle('bad', b.reason !== 'ok');
    } else {
      this.skyPieces.hidden = true;
      this.skySkins.hidden = true;
      this.skyHint.hidden = true;
    }
    // Architect view ring: counting down while on, filling back up while cooling.
    const arch = a.arch;
    if ((arch.on || arch.cooldown > 0) && s.alive) {
      this.skyArch.hidden = false;
      const c = 2 * Math.PI * 16;
      const frac = arch.on ? arch.left : 1 - arch.cooldown;
      this.skyArchRing.style.strokeDasharray = `${c}`;
      this.skyArchRing.style.strokeDashoffset = `${c * (1 - frac)}`;
      this.skyArch.classList.toggle('on', arch.on);
      this.set('skyArchText', this.skyArchText, arch.on ? t('archOn') : t('archCooling'));
    } else this.skyArch.hidden = true;
    this.skyOut.hidden = !a.eliminated;
    if (a.eliminated) this.set('skyOut', this.skyOut, t('eliminatedOut'));
    this.drawStrip(a);
  }

  /** The altitude strip: everyone alive as a dot at their height, the flag, and the sea filling from below. */
  private drawStrip(a: HudAscent): void {
    const ctx = this.sctx;
    const W = this.skyStrip.width;
    const H = this.skyStrip.height;
    ctx.clearRect(0, 0, W, H);
    const top = 16;
    const bottom = H - 16;
    const barX = W / 2 - 7;
    const yPx = (y: number): number => bottom - Math.max(0, Math.min(1, y / a.stripMax)) * (bottom - top);
    ctx.fillStyle = 'rgba(6, 12, 24, 0.6)';
    ctx.beginPath();
    ctx.roundRect(barX, top - 8, 14, bottom - top + 16, 7);
    ctx.fill();
    // Height ticks every 25 m.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let h = 25; h < a.stripMax; h += 25) {
      const y = yPx(h);
      ctx.beginPath();
      ctx.moveTo(barX, y);
      ctx.lineTo(barX + 14, y);
      ctx.stroke();
    }
    // The sea.
    if (a.stripSea > 0.2) {
      const sy = yPx(a.stripSea);
      const grad = ctx.createLinearGradient(0, sy, 0, bottom + 8);
      grad.addColorStop(0, 'rgba(120, 230, 240, 0.95)');
      grad.addColorStop(1, 'rgba(10, 90, 110, 0.9)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, sy, 14, bottom + 8 - sy, 4);
      ctx.fill();
    }
    // The flag.
    if (a.stripFlag !== null) {
      const fy = yPx(a.stripFlag);
      ctx.fillStyle = '#ffd36a';
      ctx.beginPath();
      ctx.moveTo(barX + 16, fy - 8);
      ctx.lineTo(barX + 30, fy - 3);
      ctx.lineTo(barX + 16, fy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(barX + 15, fy - 8, 2, 14);
    }
    // Players, the local one last so it draws on top.
    const sorted = [...a.strip].sort((p, q) => Number(p.you) - Number(q.you));
    for (const p of sorted) {
      const y = yPx(p.y);
      const x = W / 2;
      const r = p.you ? 7 : 5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      if (p.you || p.marked) {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = p.marked ? '#ffd36a' : '#ffffff';
        ctx.stroke();
      }
      if (p.flag) {
        ctx.fillStyle = '#ffd36a';
        ctx.beginPath();
        ctx.moveTo(x + 8, y - 9);
        ctx.lineTo(x + 18, y - 5);
        ctx.lineTo(x + 8, y - 1);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private syncWar(w: HudWar | null): void {
    if (!w) {
      this.warBar.hidden = true;
      return;
    }
    this.warBar.hidden = false;
    this.set('wours', this.warOurs, w.tickets[0]);
    this.set('wtheirs', this.warTheirs, w.tickets[1]);
    this.warOurs.style.color = w.colors[0];
    this.warTheirs.style.color = w.colors[1];
    if (this.warPointEls.length !== w.outposts.length) {
      this.warPoints.innerHTML = '';
      this.warPointEls = w.outposts.map((o) => {
        const root = el('div', 'wpoint');
        root.innerHTML = `<svg viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="16"/><circle class="fg" cx="20" cy="20" r="16"/></svg><span class="lb">${esc(o.label)}</span>`;
        this.warPoints.appendChild(root);
        return { root, ring: root.querySelector('.fg') as SVGCircleElement, key: '' };
      });
    }
    w.outposts.forEach((o, i) => {
      const p = this.warPointEls[i];
      const key = `${o.owner}|${o.mine}|${o.progress.toFixed(2)}|${o.capturing}|${o.contested}`;
      if (p.key === key) return;
      p.key = key;
      p.root.style.setProperty('--own', o.owner ?? 'rgba(255,255,255,0.18)');
      p.root.classList.toggle('mine', o.mine);
      p.root.classList.toggle('theirs', !!o.owner && !o.mine);
      p.root.classList.toggle('contested', o.contested);
      const c = 2 * Math.PI * 16;
      p.ring.style.strokeDasharray = `${c}`;
      p.ring.style.strokeDashoffset = `${c * (1 - o.progress)}`;
      p.ring.style.stroke = o.capturing ?? 'transparent';
    });
    this.set('wsup', this.warSupplies, `${w.flagDown[1] ? t('theirFlagDown') : w.flagDown[0] ? t('ourFlagDown') : t('warObjective')}  ·  ${t('supplies')} ${w.supplies}`);
  }

  private syncSpawnChoices(list: HudWar['spawnChoices']): void {
    if (!list) {
      this.spawnBox.hidden = true;
      this.spawnKey = '';
      return;
    }
    this.spawnBox.hidden = false;
    const key = list.map((c) => `${c.label}${c.selected}${c.enabled}`).join('|');
    if (key === this.spawnKey) return;
    this.spawnKey = key;
    this.spawnBox.innerHTML = `<div class="sb-title">${esc(t('chooseSpawn'))}</div>`;
    list.forEach((c, i) => {
      const b = el('button', `sb-opt ${c.selected ? 'sel' : ''} ${c.enabled ? '' : 'off'}`);
      b.innerHTML = `<span class="k">${esc(c.key)}</span>${esc(c.label)}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (c.enabled) this.onSpawnChoice?.(i - 1);
      });
      this.spawnBox.appendChild(b);
    });
  }

  private drawMinimap(m: HudMinimap): void {
    const ctx = this.mctx;
    const W = this.minimap.width;
    const H = this.minimap.height;
    ctx.clearRect(0, 0, W, H);
    // Circular island background
    const cx = W / 2;
    const cy = H / 2;
    const scale = (W / 2 - 6) / 160; // world radius 160 → pixels
    const toX = (x: number): number => cx + x * scale;
    const toY = (z: number): number => cy + z * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 12, 24, 0.7)';
    ctx.fill();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(cx, cy, 150 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(70, 120, 60, 0.55)';
    ctx.fill();
    // Plots
    for (const p of m.plots) {
      ctx.fillStyle = p.active ? p.color : 'rgba(200,200,200,0.35)';
      ctx.globalAlpha = p.active ? 0.9 : 0.6;
      ctx.fillRect(toX(p.x - 20), toY(p.z - 20), 40 * scale, 40 * scale);
      ctx.globalAlpha = 1;
    }
    // Zone
    if (m.target) {
      ctx.beginPath();
      ctx.arc(toX(m.target.x), toY(m.target.z), m.zoneRadius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // War capture points: a ring in the owner's colour, filling with the taker's.
    for (const pt of m.points ?? []) {
      const px = toX(pt.x);
      const py = toY(pt.z);
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = pt.color ?? 'rgba(255,255,255,0.25)';
      ctx.fill();
      if (pt.progress > 0 && pt.progressColor) {
        ctx.beginPath();
        ctx.arc(px, py, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pt.progress);
        ctx.strokeStyle = pt.progressColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = '700 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pt.label, px, py + 0.5);
    }
    // Flag
    if (m.flag) {
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.moveTo(toX(m.flag.x), toY(m.flag.z) - 6);
      ctx.lineTo(toX(m.flag.x) + 5, toY(m.flag.z) - 3);
      ctx.lineTo(toX(m.flag.x), toY(m.flag.z));
      ctx.closePath();
      ctx.fill();
    }
    // Others (only those exposed)
    for (const o of m.others) {
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(toX(o.x), toY(o.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Self
    ctx.save();
    ctx.translate(toX(m.self.x), toY(m.self.z));
    ctx.rotate(-m.self.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private syncMarkers(list: HudMarker[]): void {
    for (let i = 0; i < this.markerPool.length; i++) {
      const slot = this.markerPool[i];
      const m = list[i];
      if (!m) {
        slot.root.hidden = true;
        continue;
      }
      slot.root.hidden = false;
      slot.root.style.transform = `translate(${m.sx.toFixed(0)}px, ${m.sy.toFixed(0)}px)`;
      slot.root.style.setProperty('--mc', m.color);
      slot.root.classList.toggle('threat', m.kind === 'threat');
      if (slot.root.dataset.kind !== m.kind) slot.root.dataset.kind = m.kind;
      if (slot.name.textContent !== m.name) slot.name.textContent = m.name;
      const d = `${Math.round(m.dist)} m`;
      if (slot.dist.textContent !== d) slot.dist.textContent = d;
      const tag = m.kind === 'capture' ? t('capturingTag') : m.kind === 'leader' ? t('leaderTag') : m.kind === 'radar' ? t('radarTag') : m.kind === 'ally' ? t('squadTag') : '';
      if (slot.tag.textContent !== tag) slot.tag.textContent = tag;
    }
  }

  private syncGrenades(list: HudState['grenadeWarnings']): void {
    for (let i = 0; i < this.grenadePool.length; i++) {
      const g = this.grenadePool[i];
      const w = list[i];
      if (!w) {
        g.hidden = true;
        continue;
      }
      g.hidden = false;
      g.style.transform = `translate(${w.sx.toFixed(0)}px, ${w.sy.toFixed(0)}px)`;
      g.classList.toggle('off', !w.onScreen);
      (g.firstElementChild as HTMLElement).style.transform = `rotate(${w.angle.toFixed(2)}rad)`;
      const label = g.lastElementChild as HTMLElement;
      const txt = `${t('grenadeWarn')} ${Math.round(w.dist)} m`;
      if (label.textContent !== txt) label.textContent = txt;
    }
  }

  /** Red arc around the crosshair pointing at whoever just hit you (0 = ahead, clockwise). */
  damageFrom(screenAngle: number): void {
    let slot = this.arcs.find((a) => a.el.hidden) ?? this.arcs.reduce((m, a) => (a.t < m.t ? a : m), this.arcs[0]);
    slot.el.hidden = false;
    slot.t = 1.1;
    slot.el.style.opacity = '1';
    slot.el.style.transform = `rotate(${screenAngle.toFixed(3)}rad)`;
  }

  /** Floating number at the hit position: white for body hits, gold for headshots, red for kills. */
  damageNumber(sx: number, sy: number, amount: number, headshot: boolean, kill: boolean): void {
    const n = el('div', `dnum ${kill ? 'kill' : headshot ? 'head' : ''}`, String(Math.round(amount)));
    n.style.left = `${sx.toFixed(0)}px`;
    n.style.top = `${sy.toFixed(0)}px`;
    n.style.setProperty('--dx', `${((Math.random() - 0.5) * 36).toFixed(0)}px`);
    this.nums.appendChild(n);
    while (this.nums.children.length > 14) this.nums.firstChild?.remove();
    // Gone when its animation ends (frame-rate independent), with a safety net.
    n.addEventListener('animationend', () => n.remove(), { once: true });
    window.setTimeout(() => n.remove(), 3000);
  }

  killFeed(html: string): void {
    const item = el('div', 'item', html);
    this.feed.prepend(item);
    while (this.feed.children.length > 6) this.feed.lastChild?.remove();
    window.setTimeout(() => item.classList.add('fade'), 4500);
    window.setTimeout(() => item.remove(), 5500);
  }

  /** Announcer line: multi-kills (gold), streak rewards (cyan) and denied captures (red). */
  announce(title: string, sub: string, kind: 'multi' | 'streak' | 'clutch', seconds = 1.6): void {
    this.announceTitle.textContent = title;
    this.announceSub.textContent = sub;
    this.announceEl.className = `announce ${kind}`;
    this.announceEl.hidden = false;
    this.announceEl.style.opacity = '1';
    this.announceUntil = performance.now() + seconds * 1000;
    void this.announceEl.offsetWidth;
    this.announceTitle.style.animation = 'none';
    void this.announceTitle.offsetWidth;
    this.announceTitle.style.animation = '';
  }

  showBanner(title: string, sub = '', seconds = 3): void {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.banner.hidden = false;
    this.banner.style.opacity = '1';
    this.bannerUntil = performance.now() + seconds * 1000;
    this.banner.classList.remove('pop');
    void this.banner.offsetWidth;
    this.banner.classList.add('pop');
  }

  hitMarker(kill: boolean, headshot = false): void {
    this.hitTimer = 0.18;
    this.hitMark.style.opacity = '1';
    this.hitMark.classList.toggle('kill', kill);
    this.hitMark.classList.toggle('head', headshot && !kill);
  }

  damage(): void {
    this.dmgTimer = 0.5;
  }

  scorePop(text: string): void {
    const p = el('div', 'pop', text);
    this.pops.appendChild(p);
    window.setTimeout(() => p.remove(), 1400);
  }

  showScoreboard(rows: ScoreRow[] | null): void {
    if (!rows) {
      this.scoreboard.hidden = true;
      return;
    }
    this.scoreboard.hidden = false;
    this.scoreboard.innerHTML =
      `<h3>${t('scoreboard')}</h3><table><thead><tr><th></th><th>${t('score')}</th><th>${t('captures')}</th><th>${t('kills')}</th><th>${t('defenseTime')}</th></tr></thead><tbody>` +
      rows
        .map(
          (r) =>
            `<tr class="${r.isYou ? 'you' : ''}"><td><span class="sw" style="background:${r.color}"></span>${esc(r.name)} <span class="muted">${esc(r.role)}</span></td><td class="num">${r.score}</td><td class="num">${r.captures}</td><td class="num">${r.kills}</td><td class="num">${formatTime(r.defense)}</td></tr>`,
        )
        .join('') +
      '</tbody></table>';
  }
}
