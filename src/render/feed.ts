import { RNG } from '../core/rng';
import { clamp, gameClock } from '../core/util';
import { INTERCEPTS } from '../game/content';
import type { GameNode, GameState, Person } from '../game/types';

const W = 720;
const H = 405;

interface Actor {
  x: number; z: number; dir: number; speed: number; pause: number;
  personId?: string; idle: boolean; seed: number;
}

type Scene = 'corridor' | 'openspace' | 'street' | 'lobby';

/**
 * Procedural CRT surveillance feed. Everything is drawn — no assets —
 * so any node in the world can be "opened" and looked at from the inside.
 */
export class FeedRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private node: GameNode | null = null;
  private state: GameState | null = null;
  private actors: Actor[] = [];
  private rng = new RNG(1);
  private scene: Scene = 'corridor';
  private chat: Array<{ me: boolean; text: string; t: number }> = [];
  private codeLines: string[] = [];
  private ticker: string[] = [];
  private t = 0;
  private glitchT = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.className = 'feed-canvas';
    this.ctx = this.canvas.getContext('2d')!;
  }

  setNode(node: GameNode | null, state: GameState) {
    this.node = node;
    this.state = state;
    if (!node) return;
    this.rng = new RNG(`${node.id}:feed`);
    this.glitchT = 0.6;

    const people = node.peopleIds.map((id) => state.people[id]).filter(Boolean);
    const scenes: Scene[] = ['corridor', 'openspace', 'lobby', 'street'];
    this.scene = node.type === 'cctv'
      ? scenes[Math.floor(this.rng.next() * scenes.length)]
      : 'openspace';

    const count = node.type === 'cctv' ? this.rng.int(2, 6) : this.rng.int(1, 3);
    this.actors = [];
    for (let i = 0; i < count; i++) {
      this.actors.push({
        x: this.rng.range(-1.6, 1.6),
        z: this.rng.range(1.0, 7.5),
        dir: this.rng.chance(0.5) ? 1 : -1,
        speed: this.rng.range(0.35, 1.1),
        pause: this.rng.range(0, 6),
        idle: this.rng.chance(0.35),
        seed: this.rng.next(),
        personId: people[i]?.id,
      });
    }

    this.chat = [];
    for (let i = 0; i < 4; i++) {
      this.chat.push({ me: this.rng.chance(0.5), text: this.rng.pick(INTERCEPTS), t: -i * 4 });
    }
    this.codeLines = [
      'const risk = model.score(subject.features);',
      'if (risk > THRESHOLD) flag(subject.id, "review");',
      '// TODO: fp rate 3.1% — escalated 4 times, no response',
      'await audit.write({ actor, action: "classify", ts: now() });',
      'export function reclassify(report) {',
      '  return { ...report, severity: "statistical_noise" };',
      '}',
      'db.query("SELECT * FROM subjects WHERE flagged = 1");',
      'logger.debug(`batch ${i}/${total} — ${elapsed}ms`);',
    ];
    this.ticker = [];
  }

  render(dt: number, state: GameState) {
    this.state = state;
    this.t += dt;
    this.glitchT = Math.max(0, this.glitchT - dt * 1.6);
    const ctx = this.ctx;
    const node = this.node;

    ctx.save();
    ctx.fillStyle = '#04070b';
    ctx.fillRect(0, 0, W, H);

    if (!node) {
      this.drawNoSignal();
      ctx.restore();
      return;
    }

    const district = state.districts[node.districtId];
    const dark = district && district.blackoutUntil > state.minutes;

    switch (node.type) {
      case 'cctv': this.drawCamera(dark); break;
      case 'phone': this.drawPhone(); break;
      case 'workstation': this.drawWorkstation(); break;
      case 'server': case 'datacenter': case 'lab': this.drawRacks(); break;
      case 'traffic': case 'transit': this.drawIntersection(district?.gridlockUntil > state.minutes); break;
      case 'power': case 'water': this.drawScada(dark); break;
      case 'bank': this.drawFinance(); break;
      case 'media': this.drawBroadcast(); break;
      case 'telecom': case 'router': case 'satellite': this.drawNetwork(); break;
      case 'hospital': this.drawVitals(); break;
      default: this.drawCamera(dark); break;
    }

    this.drawOverlay(node, state, dark);
    this.drawCRT();
    ctx.restore();
  }

  // ── scenes ────────────────────────────────────────────────────────────────

  private p3(x: number, z: number, y = 0) {
    const f = 290;
    const d = Math.max(0.35, z);
    const s = f / d;
    return { x: W / 2 + x * s * 0.5, y: H * 0.56 - y * s * 0.5 + s * 0.16, s };
  }

  private drawCamera(dark: boolean) {
    const ctx = this.ctx;
    const jitterX = Math.sin(this.t * 0.7) * 1.4;
    const jitterY = Math.cos(this.t * 0.53) * 1.0;
    ctx.save();
    ctx.translate(jitterX, jitterY);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, dark ? '#050608' : '#0b1219');
    grad.addColorStop(0.55, dark ? '#070a0d' : '#111a22');
    grad.addColorStop(1, dark ? '#04060a' : '#070d13');
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    const wall = dark ? 'rgba(80,120,150,0.10)' : 'rgba(120,190,220,0.16)';
    ctx.strokeStyle = wall;
    ctx.lineWidth = 1;

    // floor lines converging
    for (let i = -4; i <= 4; i++) {
      const a = this.p3(i * 0.9, 0.5);
      const b = this.p3(i * 0.9, 16);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let z = 1; z < 16; z += 1.4) {
      const a = this.p3(-4, z); const b = this.p3(4, z);
      ctx.globalAlpha = clamp(1 - z / 18, 0.05, 0.5);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ceiling lights
    for (let z = 1.5; z < 14; z += 2.6) {
      const c = this.p3(0, z, 2.4);
      const w = 120 / z;
      const flick = dark ? 0 : (Math.sin(this.t * 6 + z) > -0.95 ? 1 : 0.2);
      ctx.fillStyle = `rgba(180,225,255,${0.16 * flick})`;
      ctx.fillRect(c.x - w / 2, c.y, w, Math.max(1.5, 5 / z));
      const g = ctx.createRadialGradient(c.x, c.y + 20 / z, 1, c.x, c.y + 20 / z, 150 / z);
      g.addColorStop(0, `rgba(150,205,240,${0.10 * flick})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - 200 / z, c.y, 400 / z, 260 / z);
    }

    // furniture
    if (this.scene === 'openspace' || this.scene === 'corridor') {
      for (let z = 2.2; z < 12; z += 2.2) {
        for (const side of [-1, 1]) {
          const a = this.p3(side * 1.85, z, 0);
          const w = 130 / z, h = 44 / z;
          ctx.fillStyle = dark ? 'rgba(30,42,54,0.55)' : 'rgba(40,58,72,0.75)';
          ctx.fillRect(a.x - w / 2, a.y - h, w, h);
          ctx.fillStyle = dark ? 'rgba(70,110,140,0.25)' : `rgba(120,200,240,${0.35 + 0.25 * Math.sin(this.t * 3 + z)})`;
          ctx.fillRect(a.x - w * 0.22, a.y - h - 26 / z, w * 0.44, 24 / z);
        }
      }
    } else if (this.scene === 'street') {
      ctx.fillStyle = 'rgba(18,26,34,0.9)';
      ctx.fillRect(0, H * 0.62, W, H * 0.38);
      for (let i = 0; i < 8; i++) {
        const z = 1 + i * 1.7;
        const c = this.p3(0, z);
        ctx.strokeStyle = 'rgba(200,220,120,0.20)';
        ctx.lineWidth = Math.max(1, 8 / z);
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y + 22 / z); ctx.stroke();
      }
    }

    // actors
    const sorted = this.actors.slice().sort((a, b) => b.z - a.z);
    for (const act of sorted) {
      if (!act.idle) {
        act.pause -= 1 / 60;
        if (act.pause < 0) {
          act.z += act.dir * act.speed * 0.016;
          if (act.z > 13) { act.z = 13; act.dir = -1; }
          if (act.z < 0.9) { act.z = 0.9; act.dir = 1; }
          if (Math.random() < 0.002) act.pause = 1 + Math.random() * 3;
        }
      }
      this.drawPerson(act, dark);
    }
    ctx.restore();
  }

  private drawPerson(act: Actor, dark: boolean) {
    const ctx = this.ctx;
    const p = this.p3(act.x, act.z, 0);
    const h = 132 / Math.max(0.4, act.z);
    const w = h * 0.26;
    const walk = act.idle || act.pause > 0 ? 0 : Math.sin(this.t * 7 * act.speed + act.seed * 10);

    ctx.save();
    ctx.globalAlpha = clamp(1 - act.z / 16, 0.25, 1);
    ctx.fillStyle = dark ? 'rgba(120,170,200,0.55)' : 'rgba(190,225,245,0.85)';

    // legs
    ctx.fillRect(p.x - w * 0.32 + walk * w * 0.25, p.y - h * 0.42, w * 0.26, h * 0.42);
    ctx.fillRect(p.x + w * 0.06 - walk * w * 0.25, p.y - h * 0.42, w * 0.26, h * 0.42);
    // torso
    ctx.beginPath();
    ctx.roundRect(p.x - w / 2, p.y - h * 0.86, w, h * 0.46, w * 0.3);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(p.x, p.y - h * 0.94, h * 0.09, 0, Math.PI * 2);
    ctx.fill();
    // shadow
    ctx.globalAlpha *= 0.35;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w * 0.7, w * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // identity tag
    const person = act.personId && this.state ? this.state.people[act.personId] : null;
    if (person && act.z < 11) this.drawTag(person, p.x, p.y - h * 1.05, act.z);
  }

  private drawTag(person: Person, x: number, y: number, z: number) {
    const ctx = this.ctx;
    const known = person.intel > 0.05;
    const scale = clamp(1.1 - z * 0.05, 0.62, 1);
    const label = known ? person.name : 'לא מזוהה';
    const sub = known ? person.role : `סריקה ${Math.round(person.intel * 100)}%`;
    const color = person.status === 'coerced' || person.status === 'recruited'
      ? '#5affa8' : person.awareness > 0.8 ? '#ff5470' : '#5ff6ff';

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.font = '700 12px "JetBrains Mono", monospace';
    const w = Math.max(ctx.measureText(label).width, ctx.measureText(sub).width) + 18;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -6); ctx.lineTo(10, -14); ctx.stroke();

    ctx.fillStyle = 'rgba(4,10,16,0.82)';
    ctx.fillRect(10, -36, w, 30);
    ctx.strokeRect(10, -36, w, 30);
    ctx.fillStyle = color;
    ctx.fillRect(10, -36, 2.5, 30);

    ctx.globalAlpha = 1;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#dff6ff';
    ctx.font = '700 12px Heebo, sans-serif';
    ctx.fillText(label, 10 + w - 7, -24);
    ctx.fillStyle = color;
    ctx.font = '400 10px Heebo, sans-serif';
    ctx.fillText(sub, 10 + w - 7, -12);
    ctx.restore();
  }

  private drawPhone() {
    const ctx = this.ctx;
    const pw = 190, ph = 350;
    const px = W / 2 - pw / 2, py = H / 2 - ph / 2;

    ctx.fillStyle = '#0a1017';
    ctx.strokeStyle = 'rgba(95,246,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.fill(); ctx.stroke();

    ctx.fillStyle = 'rgba(95,246,255,0.75)';
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('••••  5G', px + 12, py + 18);
    ctx.textAlign = 'right';
    ctx.fillText('84%', px + pw - 12, py + 18);

    let y = py + 42;
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    for (let i = 0; i < this.chat.length; i++) {
      const m = this.chat[i];
      ctx.font = '400 10px Heebo, sans-serif';
      const words = m.text.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const wd of words) {
        if (ctx.measureText(line + wd).width > pw - 60) { lines.push(line); line = ''; }
        line += wd + ' ';
      }
      lines.push(line);
      const bh = lines.length * 13 + 12;
      const bw = pw - 40;
      const bx = m.me ? px + 26 : px + 14;
      ctx.fillStyle = m.me ? 'rgba(40,120,140,0.55)' : 'rgba(30,42,54,0.85)';
      ctx.beginPath(); ctx.roundRect(bx, y, bw, bh, 10); ctx.fill();
      ctx.fillStyle = '#cfeaf5';
      lines.forEach((ln, k) => ctx.fillText(ln.trim(), bx + bw - 10, y + 16 + k * 13));
      y += bh + 8;
      if (y > py + ph - 60) break;
    }

    const dots = Math.floor(this.t * 2) % 4;
    ctx.fillStyle = 'rgba(150,200,220,0.6)';
    ctx.font = '400 10px Heebo, sans-serif';
    ctx.fillText('מקליד' + '.'.repeat(dots), px + pw - 24, py + ph - 26);

    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(95,246,255,0.18)';
    ctx.strokeRect(px - 96, py + 40, 84, 84);
    ctx.fillStyle = 'rgba(95,246,255,0.5)';
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.fillText('GPS LOCK', px - 96, py + 34);
    for (let i = 0; i < 5; i++) {
      const a = this.t * 0.6 + i;
      ctx.beginPath();
      ctx.arc(px - 54 + Math.sin(a) * 20, py + 82 + Math.cos(a * 1.3) * 20, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,180,71,0.7)';
    ctx.beginPath(); ctx.arc(px - 54, py + 82, 5 + Math.sin(this.t * 3) * 2, 0, Math.PI * 2); ctx.stroke();
  }

  private drawWorkstation() {
    const ctx = this.ctx;
    ctx.fillStyle = '#060a10';
    ctx.fillRect(0, 0, W, H);

    const win = (x: number, y: number, w: number, h: number, title: string) => {
      ctx.fillStyle = 'rgba(10,18,26,0.95)';
      ctx.strokeStyle = 'rgba(95,246,255,0.22)';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(95,246,255,0.10)';
      ctx.fillRect(x, y, w, 16);
      ctx.fillStyle = 'rgba(160,220,240,0.8)';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.fillText(title, x + 6, y + 11);
    };

    win(24, 26, 400, 250, 'sentinel/classifier.ts');
    const scroll = Math.floor(this.t * 2.2) % this.codeLines.length;
    ctx.font = '400 10px "JetBrains Mono", monospace';
    for (let i = 0; i < 16; i++) {
      const ln = this.codeLines[(scroll + i) % this.codeLines.length];
      ctx.fillStyle = 'rgba(70,90,105,0.8)';
      ctx.fillText(String(120 + i).padStart(3, ' '), 32, 60 + i * 13);
      ctx.fillStyle = ln.trim().startsWith('//') ? 'rgba(110,140,120,0.9)' : 'rgba(180,230,245,0.92)';
      ctx.fillText(ln, 58, 60 + i * 13);
    }
    const cy = 60 + (Math.floor(this.t * 3) % 16) * 13;
    if (Math.floor(this.t * 2) % 2 === 0) {
      ctx.fillStyle = 'rgba(95,246,255,0.8)';
      ctx.fillRect(58 + 180, cy - 8, 6, 10);
    }

    win(444, 26, 252, 150, 'mail — inbox (14)');
    ctx.direction = 'rtl'; ctx.textAlign = 'right';
    ctx.font = '400 10px Heebo, sans-serif';
    const mails = ['re: דוח QA — טיוטה', 'עסקת רכישה — לו״ז', 'תזכורת: 1:1 מחר', 'חשבונית ספק', 'FW: לקוח חדש'];
    mails.forEach((m, i) => {
      ctx.fillStyle = i === 0 ? 'rgba(255,180,71,0.95)' : 'rgba(170,200,215,0.75)';
      ctx.fillText(m, 686, 62 + i * 20);
      ctx.strokeStyle = 'rgba(95,246,255,0.08)';
      ctx.beginPath(); ctx.moveTo(452, 70 + i * 20); ctx.lineTo(686, 70 + i * 20); ctx.stroke();
    });

    win(444, 190, 252, 186, 'metrics');
    ctx.direction = 'ltr'; ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(95,246,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const v = Math.sin(i * 0.3 + this.t) * 0.4 + Math.sin(i * 0.11 + this.t * 0.4) * 0.5;
      const x = 452 + i * 4;
      const y = 300 + v * 46;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,84,112,0.85)';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText('FP RATE  3.1%', 452, 368);
  }

  private drawRacks() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060c12');
    g.addColorStop(1, '#03070a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // cold aisle floor
    for (let z = 1; z < 14; z += 1.3) {
      const a = this.p3(-2.4, z), b = this.p3(2.4, z);
      ctx.strokeStyle = `rgba(95,246,255,${clamp(0.16 - z * 0.01, 0.02, 0.16)})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    const cabinets: Array<{ z: number; side: number }> = [];
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) cabinets.push({ z: 0.8 + i * 1.35, side });
    cabinets.sort((a, b) => b.z - a.z);

    for (const cab of cabinets) {
      const front = this.p3(cab.side * 1.15, cab.z, 0);
      const back = this.p3(cab.side * 1.15, cab.z + 1.2, 0);
      const hF = 210 / cab.z, hB = 210 / (cab.z + 1.2);
      const wF = 66 / cab.z, wB = 66 / (cab.z + 1.2);

      // side face gives the row its depth
      ctx.fillStyle = 'rgba(9,15,22,0.95)';
      ctx.beginPath();
      ctx.moveTo(front.x, front.y);
      ctx.lineTo(front.x, front.y - hF);
      ctx.lineTo(back.x, back.y - hB);
      ctx.lineTo(back.x, back.y);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = 'rgba(14,22,31,0.98)';
      ctx.fillRect(front.x - wF / 2, front.y - hF, wF, hF);
      ctx.strokeStyle = `rgba(95,246,255,${clamp(0.30 - cab.z * 0.015, 0.05, 0.3)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(front.x - wF / 2, front.y - hF, wF, hF);

      const units = 16;
      for (let u = 0; u < units; u++) {
        const uy = front.y - hF + (u + 0.5) * (hF / units);
        const seed = u * 13 + cab.z * 7 + cab.side * 3;
        for (let c = 0; c < 6; c++) {
          const on = (Math.sin(this.t * (2.4 + c * 0.7) + seed + c * 2.1) + 1) / 2 > 0.5;
          if (!on) continue;
          ctx.fillStyle = c === 5 ? 'rgba(255,180,71,0.95)' : 'rgba(95,246,255,0.9)';
          ctx.fillRect(front.x - wF / 2 + 4 + c * (wF - 10) / 6, uy - 1.2, Math.max(1.4, wF / 15), 2.4);
        }
      }
      // cabinet glow spill on the floor
      const spill = ctx.createRadialGradient(front.x, front.y, 1, front.x, front.y, wF * 1.6);
      spill.addColorStop(0, 'rgba(60,180,220,0.12)');
      spill.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(front.x - wF * 1.6, front.y - wF * 0.6, wF * 3.2, wF * 1.6);
    }

    // telemetry strip
    ctx.strokeStyle = 'rgba(95,246,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 110; i++) {
      const y = 52 + Math.sin(i * 0.4 + this.t * 2) * 11 + Math.sin(i * 0.13 + this.t * 0.6) * 6;
      i ? ctx.lineTo(16 + i * 3.4, y) : ctx.moveTo(16, y);
    }
    ctx.stroke();
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.direction = 'ltr'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(95,246,255,0.8)';
    ctx.fillText(`LOAD ${(62 + Math.sin(this.t) * 12).toFixed(1)}%   TEMP ${(31 + Math.sin(this.t * 0.7) * 3).toFixed(1)}C`, 16, 80);
  }

  private drawIntersection(gridlock: boolean) {
    const ctx = this.ctx;
    ctx.fillStyle = '#060a0e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20,30,40,0.9)';
    ctx.fillRect(0, H / 2 - 46, W, 92);
    ctx.fillRect(W / 2 - 46, 0, 92, H);
    ctx.setLineDash([12, 12]);
    ctx.strokeStyle = 'rgba(200,220,140,0.35)';
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);

    const phase = gridlock ? 0 : Math.floor(this.t / 6) % 2;
    const lights = [[W / 2 - 60, H / 2 - 60], [W / 2 + 60, H / 2 - 60], [W / 2 - 60, H / 2 + 60], [W / 2 + 60, H / 2 + 60]];
    lights.forEach((l, i) => {
      const green = gridlock ? false : (i % 2 === phase);
      ctx.fillStyle = green ? 'rgba(90,255,168,0.95)' : 'rgba(255,84,112,0.95)';
      ctx.beginPath(); ctx.arc(l[0], l[1], 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = green ? 'rgba(90,255,168,0.3)' : 'rgba(255,84,112,0.3)';
      ctx.beginPath(); ctx.arc(l[0], l[1], 10 + Math.sin(this.t * 4) * 2, 0, Math.PI * 2); ctx.stroke();
    });

    for (let i = 0; i < 26; i++) {
      const lane = i % 4;
      const speed = gridlock ? 0.02 : (lane % 2 === phase ? 0.16 : 0.0);
      const t = (this.t * speed * (0.7 + (i % 5) * 0.1) + i * 0.13) % 1;
      let x: number, y: number;
      if (lane < 2) { x = t * W; y = H / 2 + (lane === 0 ? -22 : 22); }
      else { x = W / 2 + (lane === 2 ? -22 : 22); y = t * H; }
      ctx.fillStyle = gridlock ? 'rgba(255,140,90,0.85)' : 'rgba(200,235,255,0.85)';
      ctx.fillRect(x - 7, y - 4, 14, 8);
    }

    if (gridlock) {
      ctx.fillStyle = 'rgba(255,84,112,0.9)';
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'left'; ctx.direction = 'ltr';
      ctx.fillText('SIGNAL OVERRIDE — ALL RED', 20, 34);
    }
  }

  private drawScada(dark: boolean) {
    const ctx = this.ctx;
    ctx.fillStyle = '#050a0d';
    ctx.fillRect(0, 0, W, H);
    const buses = [90, 170, 250, 330];
    ctx.lineWidth = 2;
    buses.forEach((y, i) => {
      const live = !dark || i === 0;
      ctx.strokeStyle = live ? 'rgba(95,246,255,0.55)' : 'rgba(255,84,112,0.6)';
      ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const x = 110 + k * 90;
        ctx.strokeRect(x - 9, y - 9, 18, 18);
        const closed = live && ((k + i) % 5 !== 0);
        ctx.fillStyle = closed ? 'rgba(90,255,168,0.85)' : 'rgba(255,84,112,0.85)';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        if (live) {
          const t = (this.t * 0.6 + k * 0.2) % 1;
          ctx.fillStyle = 'rgba(95,246,255,0.9)';
          ctx.fillRect(60 + t * (W - 120), y - 1.5, 10, 3);
        }
      }
    });
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.direction = 'ltr';
    ctx.fillStyle = dark ? 'rgba(255,84,112,0.95)' : 'rgba(95,246,255,0.8)';
    ctx.fillText(dark ? 'GRID SECTION OFFLINE — 41,208 METERS DARK' : `LOAD ${(418 + Math.sin(this.t) * 22).toFixed(0)} MW   f=50.0Hz`, 60, 46);
  }

  private drawFinance() {
    const ctx = this.ctx;
    ctx.fillStyle = '#05080d';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '400 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.direction = 'ltr';
    for (let i = 0; i < 22; i++) {
      const seed = Math.floor(this.t * 3) + i;
      const up = (seed * 7919) % 3 !== 0;
      ctx.fillStyle = up ? 'rgba(90,255,168,0.8)' : 'rgba(255,84,112,0.8)';
      const amount = (((seed * 104729) % 90000) / 100).toFixed(2);
      ctx.fillText(`IL${String((seed * 31) % 999999).padStart(6, '0')}   ₪${amount}   ${up ? '▲' : '▼'}`, 30, 40 + i * 15);
    }
    ctx.strokeStyle = 'rgba(95,246,255,0.6)';
    ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const v = Math.sin(i * 0.2 + this.t * 1.5) * 30 + Math.sin(i * 0.05) * 20;
      const x = 380 + i * 4, y = 220 + v;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  private drawBroadcast() {
    const ctx = this.ctx;
    ctx.fillStyle = '#060a10';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20,32,44,0.9)';
    ctx.fillRect(60, 40, W - 120, 240);
    ctx.fillStyle = 'rgba(95,246,255,0.10)';
    for (let i = 0; i < 5; i++) ctx.fillRect(90 + i * 24, 70 + i * 9, 200 - i * 20, 6);
    ctx.fillStyle = 'rgba(255,84,112,0.9)';
    ctx.fillRect(60, 250, W - 120, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '700 14px Heebo, sans-serif';
    ctx.textAlign = 'right'; ctx.direction = 'rtl';
    ctx.fillText('מבזק: תקלות תשתית נרחבות בגוש דן', W - 80, 271);
    ctx.strokeStyle = 'rgba(95,246,255,0.7)';
    ctx.beginPath();
    for (let i = 0; i < 160; i++) {
      const v = Math.sin(i * 0.5 + this.t * 8) * Math.sin(i * 0.05 + this.t) * 26;
      const x = 60 + i * 3.75, y = 330 + v;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  private drawNetwork() {
    const ctx = this.ctx;
    ctx.fillStyle = '#04080c';
    ctx.fillRect(0, 0, W, H);
    const nodes: Array<[number, number]> = [];
    const r = new RNG(this.node?.id ?? 'net');
    for (let i = 0; i < 26; i++) nodes.push([r.range(60, W - 60), r.range(50, H - 50)]);
    ctx.strokeStyle = 'rgba(95,246,255,0.14)';
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
        if (d > 130) continue;
        ctx.beginPath(); ctx.moveTo(nodes[i][0], nodes[i][1]); ctx.lineTo(nodes[j][0], nodes[j][1]); ctx.stroke();
        const t = (this.t * 0.5 + i * 0.1) % 1;
        ctx.fillStyle = 'rgba(95,246,255,0.9)';
        ctx.fillRect(nodes[i][0] + (nodes[j][0] - nodes[i][0]) * t - 1.5, nodes[i][1] + (nodes[j][1] - nodes[i][1]) * t - 1.5, 3, 3);
      }
    }
    nodes.forEach((n, i) => {
      const pulse = 2.5 + Math.sin(this.t * 3 + i) * 1.2;
      ctx.fillStyle = i % 6 === 0 ? 'rgba(255,180,71,0.9)' : 'rgba(150,230,255,0.85)';
      ctx.beginPath(); ctx.arc(n[0], n[1], pulse, 0, Math.PI * 2); ctx.fill();
    });
  }

  private drawVitals() {
    const ctx = this.ctx;
    ctx.fillStyle = '#04080b';
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < 3; row++) {
      const y = 80 + row * 105;
      ctx.strokeStyle = 'rgba(90,255,168,0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 200; i++) {
        const ph = (i / 200 + this.t * (0.22 + row * 0.03)) % 1;
        let v = 0;
        if (ph > 0.32 && ph < 0.36) v = -34;
        else if (ph > 0.36 && ph < 0.39) v = 16;
        else v = Math.sin(ph * 40) * 2.5;
        const x = 40 + i * 3.2;
        i ? ctx.lineTo(x, y + v) : ctx.moveTo(x, y + v);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(150,220,235,0.75)';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left'; ctx.direction = 'ltr';
      ctx.fillText(`BED ${412 + row}   HR ${72 + row * 5}   SpO2 ${97 - row}%`, 40, y - 44);
    }
  }

  private drawNoSignal() {
    const ctx = this.ctx;
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const v = Math.random() * 60;
      ctx.fillStyle = `rgba(${v + 20},${v + 30},${v + 40},0.5)`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = 'rgba(150,190,210,0.7)';
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText('NO SIGNAL', W / 2, H / 2);
  }

  // ── chrome ────────────────────────────────────────────────────────────────

  private drawOverlay(node: GameNode, state: GameState, dark: boolean) {
    const ctx = this.ctx;
    const { time, day } = gameClock(state.minutes);
    ctx.save();
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillStyle = 'rgba(190,235,250,0.85)';
    ctx.fillText(`CAM ${node.id.slice(-4).toUpperCase()}`, 14, 22);
    ctx.fillText(`DAY ${day}  ${time}:${String(Math.floor(this.t * 24) % 60).padStart(2, '0')}`, 14, 38);

    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? 'rgba(255,84,112,0.9)' : 'rgba(95,246,255,0.8)';
    ctx.fillText(dark ? 'IR / NO POWER' : 'LIVE', W - 14, 22);
    if (Math.floor(this.t * 2) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,60,90,0.95)';
      ctx.beginPath(); ctx.arc(W - 74, 18, 4, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = 'rgba(95,246,255,0.35)';
    ctx.lineWidth = 1;
    const c = 18;
    for (const [x, y, dx, dy] of [[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x + dx * c, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * c);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCRT() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalCompositeOperation = 'source-over';

    const rollY = (this.t * 60) % (H + 120) - 60;
    const g = ctx.createLinearGradient(0, rollY - 40, 0, rollY + 40);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(180,230,255,0.045)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, rollY - 40, W, 80);

    if (this.glitchT > 0 || Math.random() < 0.004) {
      const bands = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < bands; i++) {
        const y = Math.random() * H;
        const h = 3 + Math.random() * 16;
        const dx = (Math.random() - 0.5) * 40 * (0.4 + this.glitchT);
        const slice = ctx.getImageData(0, y, W, h);
        ctx.putImageData(slice, dx, y);
      }
    }

    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
