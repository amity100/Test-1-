import * as THREE from 'three';
import { FEEL } from '../config';
import { t, StrKey } from './i18n';
import { Guard } from '../game/guards';
import { Placement } from '../game/portals';

/** DOM HUD. Everything is positioned via CSS; per-frame updates are cheap text/style writes. */
export class HUD {
  el: HTMLDivElement;
  private obj: HTMLDivElement;
  private prompt: HTMLDivElement;
  private sub: HTMLDivElement;
  private hint: HTMLDivElement;
  private toast: HTMLDivElement;
  private focus: HTMLDivElement;
  private light: HTMLDivElement;
  private health: HTMLDivElement;
  private cross: HTMLDivElement;
  private aimInfo: HTMLDivElement;
  private icons = new Map<Guard, HTMLDivElement>();
  private iconLayer: HTMLDivElement;
  private scry: HTMLDivElement;
  private chainEl: HTMLDivElement;
  private beat: SVGCircleElement;
  private witnesses = new Set<Guard>();
  private subT = 0;
  private toastT = 0;
  private hintKey = '';
  private hintT = 0;
  scryRect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-obj"></div>
      <div class="hud-hint"></div>
      <div class="hud-toast"></div>
      <div class="hud-icons"></div>
      <div class="hud-cross"><i></i><i></i><i></i><i></i><b></b><svg class="beat" viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" pathLength="100"/></svg></div>
      <div class="hud-chain"><b></b><span></span></div>
      <div class="hud-aiminfo"></div>
      <div class="hud-scry"><span>RIFT VIEW</span></div>
      <div class="hud-sub"></div>
      <div class="hud-prompt"></div>
      <div class="hud-bottom">
        <div class="hud-light"><svg viewBox="0 0 24 24"><path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z" fill="currentColor"/></svg><div class="bar"><i></i></div></div>
        <div class="hud-rift">
          <div class="hud-focus"><i></i></div>
        </div>
        <div class="hud-health"><i></i></div>
      </div>`;
    root.appendChild(this.el);
    const q = (s: string) => this.el.querySelector(s) as HTMLDivElement;
    this.obj = q('.hud-obj');
    this.prompt = q('.hud-prompt');
    this.sub = q('.hud-sub');
    this.hint = q('.hud-hint');
    this.toast = q('.hud-toast');
    this.focus = q('.hud-focus i');
    this.light = q('.hud-light .bar i');
    this.health = q('.hud-health i');
    this.cross = q('.hud-cross');
    this.aimInfo = q('.hud-aiminfo');
    this.iconLayer = q('.hud-icons');
    this.scry = q('.hud-scry');
    this.chainEl = q('.hud-chain');
    this.beat = this.el.querySelector('.hud-cross .beat circle') as SVGCircleElement;
  }

  show(v: boolean) {
    this.el.style.display = v ? '' : 'none';
  }

  setObjectives(items: { text: string; done: boolean; optional?: boolean }[]) {
    this.obj.innerHTML = items
      .map((o) => `<div class="o ${o.done ? 'done' : ''} ${o.optional ? 'opt' : ''}"><span class="box"></span>${o.text}</div>`)
      .join('');
  }

  setPrompt(key: string | null, label: string | null) {
    if (!label) {
      this.prompt.classList.remove('on');
      return;
    }
    this.prompt.innerHTML = `${key ? `<kbd>${key}</kbd>` : ''}<span>${label}</span>`;
    this.prompt.classList.add('on');
  }

  subtitle(text: string, dur = 3) {
    this.sub.textContent = text;
    this.sub.classList.add('on');
    this.subT = dur;
  }

  flashToast(text: string, dur = 2.2, kind: 'info' | 'warn' | 'good' = 'info') {
    this.toast.textContent = text;
    this.toast.className = `hud-toast on ${kind}`;
    this.toastT = dur;
  }

  showHint(key: string, html: string, dur = 7) {
    if (this.hintKey === key && this.hintT > 0) return;
    this.hintKey = key;
    this.hint.innerHTML = html;
    this.hint.classList.add('on');
    this.hintT = dur;
  }

  clearHint() {
    this.hintT = 0;
    this.hint.classList.remove('on');
  }

  /** Kill chain: ×N and the moves that built it. */
  setChain(n: number, trail: string[]) {
    this.chainEl.classList.toggle('on', n >= 2);
    if (n >= 2) {
      this.chainEl.querySelector('b')!.textContent = `×${n}`;
      this.chainEl.querySelector('span')!.textContent = trail.join(' › ');
      this.chainEl.classList.remove('pop');
      void this.chainEl.offsetWidth;
      this.chainEl.classList.add('pop');
    }
  }

  /** Guards who would see the kill on the locked target get an eye. */
  setWitnesses(list: Guard[]) {
    this.witnesses = new Set(list);
  }

  update(dt: number, s: { focus: number; light: number; health: number; aiming: number; chainT: number; chainMax: number }) {
    if (this.subT > 0 && (this.subT -= dt) <= 0) this.sub.classList.remove('on');
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) this.toast.classList.remove('on');
    if (this.hintT > 0 && (this.hintT -= dt) <= 0) this.hint.classList.remove('on');
    this.focus.style.transform = `scaleX(${s.focus / FEEL.focusDuration})`;
    this.light.style.transform = `scaleX(${Math.max(0.04, s.light)})`;
    this.light.parentElement!.parentElement!.classList.toggle('lit', s.light > 0.45);
    this.health.style.transform = `scaleX(${s.health / FEEL.maxHealth})`;
    this.health.parentElement!.classList.toggle('low', s.health < 40);
    this.cross.style.opacity = String(s.aiming);
    this.aimInfo.style.opacity = String(s.aiming);
    this.scry.style.opacity = String(s.aiming > 0.9 ? 1 : 0);
    // the beat: a ring around the reticle draining while the chain window is open
    const beatOn = s.chainT > 0;
    this.cross.classList.toggle('beating', beatOn);
    this.beat.style.strokeDasharray = `${Math.round((s.chainT / Math.max(0.01, s.chainMax)) * 100)} 100`;
    if (beatOn) this.cross.style.opacity = '1';
    this.el.classList.toggle('aiming', s.aiming > 0.5);
    const r = this.scry.getBoundingClientRect();
    this.scryRect = { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  setPlacement(p: Placement | null, witnesses = 0) {
    if (!p) {
      this.aimInfo.innerHTML = '';
      this.cross.className = 'hud-cross';
      return;
    }
    const reason: Record<string, StrKey> = { range: 'outOfRange', close: 'tooClose', los: 'blocked', space: 'noSpace', inhibited: 'inhibited', charge: 'noCharge', drop: 'lethalDrop' };
    const blocks: Record<string, StrKey> = { armoured: 'blockArmoured', sees: 'blockSees', far: 'blockFar', room: 'noSpace' };
    let html = `<div class="dist">${p.distance.toFixed(1)}<small>m</small></div>`;
    if (p.move) {
      // the kill move is the headline
      const name = p.move === 'strike' ? t('move_strike') : t('move_drop');
      html += `<div class="tag kill">${p.move === 'strike' ? '🗡' : '⬇'} ${name}${witnesses ? ` <em>· ${witnesses} ${t('see')}</em>` : ''}</div>`;
      if (p.canSwap) html += `<div class="tag swap">${t('swapHint')}</div>`;
    } else if (p.block && p.invalid) html += `<div class="tag bad">${t(blocks[p.block])}</div>`;
    else if (p.invalid) html += `<div class="tag bad">${t(reason[p.invalid])}</div>`;
    else {
      if (p.block) html += `<div class="tag bad">${t(blocks[p.block])}</div>`;
      if (p.snap === 'perch') html += `<div class="tag snap">⤒ ${t('snapPerch')}</div>`;
      const ex = p.exposure > 0.66 ? ['bad', t('seenRed')] : p.exposure > 0.25 ? ['warn', t('seenYellow')] : ['good', t('seenGreen')];
      html += `<div class="tag ${ex[0]}">${ex[1]}</div>`;
      if (p.light < 0.25) html += `<div class="tag moon">☾ ${t('snapShadow')}</div>`;
    }
    this.aimInfo.innerHTML = html;
    this.cross.className = `hud-cross ${p.move ? 'kill' : p.invalid ? 'bad' : p.snap ? 'snap' : 'ok'}`;
  }

  /** Floating ?/! indicators over guards, clamped to screen edges. */
  updateGuardIcons(guards: Guard[], cam: THREE.Camera, w: number, h: number) {
    const v = new THREE.Vector3();
    for (const g of guards) {
      let el = this.icons.get(g);
      const witness = this.witnesses.has(g);
      const show = g.alive && (g.suspicion > 0.04 || g.state !== 'patrol' || witness || g.stunT > 0);
      if (!show) {
        if (el) el.style.display = 'none';
        continue;
      }
      if (!el) {
        el = document.createElement('div');
        el.className = 'gicon';
        el.innerHTML = '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg" pathLength="100"/></svg><b></b>';
        this.iconLayer.appendChild(el);
        this.icons.set(g, el);
      }
      el.style.display = '';
      v.set(g.pos.x, g.pos.y + 2.25, g.pos.z).project(cam);
      let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      const behind = v.z > 1;
      if (behind) { x = w - x; y = h - 40; }
      const off = behind || x < 30 || x > w - 30 || y < 30 || y > h - 30;
      x = THREE.MathUtils.clamp(x, 30, w - 30);
      y = THREE.MathUtils.clamp(y, 30, h - 30);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${off ? 0.8 : 1})`;
      const alert = g.state === 'alert';
      const startled = g.state === 'startled';
      const stunned = g.stunT > 0;
      el.classList.toggle('alert', alert);
      el.classList.toggle('startled', startled);
      el.classList.toggle('stunned', stunned);
      el.classList.toggle('witness', witness && !startled && !alert);
      el.classList.toggle('search', g.state === 'search' || g.state === 'investigate');
      el.classList.toggle('edge', off);
      // a startled witness's ring drains: silence him before it closes
      const fill = startled ? g.startleT / Math.max(0.01, g.startleMax) : g.suspicion;
      (el.querySelector('.fg') as SVGElement).style.strokeDasharray = `${Math.round(fill * 100)} 100`;
      el.querySelector('b')!.textContent = stunned ? '✶' : alert || startled ? '!' : witness ? '👁' : '?';
    }
  }

  clearIcons() {
    for (const el of this.icons.values()) el.remove();
    this.icons.clear();
  }
}
