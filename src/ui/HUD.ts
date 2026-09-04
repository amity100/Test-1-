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
  grappleCd: number;
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
  private hpWrap: HTMLElement;
  private ammoText: HTMLElement;
  private reserveText: HTMLElement;
  private weaponName: HTMLElement;
  private slots: HTMLElement;
  private grenadesEl: HTMLElement;
  private grappleFill: HTMLElement;
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
  private last: Partial<Record<string, string | number | boolean>> = {};
  private hitTimer = 0;
  private dmgTimer = 0;

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
    const grapple = el('div', 'grapple');
    grapple.innerHTML = `<span class="lbl">Q</span><div class="gbar"><div class="fill"></div></div>`;
    this.grappleFill = grapple.querySelector('.fill') as HTMLElement;
    gear.append(this.grenadesEl, grapple);
    this.hpWrap.append(this.hpText, hpBar, gear);
    this.root.appendChild(this.hpWrap);

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
    this.death = el('div', 'death');
    this.deathText = el('div', 'dtext');
    this.deathTimer = el('div', 'dtimer');
    this.death.append(this.deathText, this.deathTimer);
    this.death.hidden = true;
    this.root.appendChild(this.death);

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
  }

  show(): void {
    this.root.hidden = false;
  }
  hide(): void {
    this.root.hidden = true;
    this.scoreboard.hidden = true;
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
    this.grappleFill.style.width = `${(1 - s.grappleCd) * 100}%`;
    this.set('timer', this.timer, formatTime(s.timeLeft));
    this.timer.classList.toggle('urgent', s.timeLeft < 30);
    this.set('round', this.roundLabel, t('round', { n: s.round, total: s.totalRounds }));
    this.set('target', this.targetLabel, s.role === 'defender' ? t('defendFortress') : t('attackFortress', { name: s.targetName }));
    this.set('role', this.roleBadge, s.role === 'defender' ? t('defender') : t('attacker'));
    this.roleBadge.classList.toggle('def', s.role === 'defender');
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
    // Damage flash
    if (this.dmgTimer > 0) {
      this.dmgTimer -= dt;
      this.dmg.style.opacity = String(Math.max(0, this.dmgTimer / 0.5) * 0.85);
    } else this.dmg.style.opacity = String(hpPct < 0.3 ? 0.25 + 0.15 * Math.sin(performance.now() / 200) : 0);
    // Death
    if (!s.alive) {
      this.death.hidden = false;
      this.set('dtext', this.deathText, s.killedBy ? t('eliminatedBy', { name: s.killedBy }) : '');
      this.set('dtimer', this.deathTimer, t('respawnIn', { n: Math.ceil(s.respawnIn) }));
    } else this.death.hidden = true;
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

  killFeed(html: string): void {
    const item = el('div', 'item', html);
    this.feed.prepend(item);
    while (this.feed.children.length > 6) this.feed.lastChild?.remove();
    window.setTimeout(() => item.classList.add('fade'), 4500);
    window.setTimeout(() => item.remove(), 5500);
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
