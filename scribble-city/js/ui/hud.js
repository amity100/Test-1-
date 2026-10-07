import { BOUNDS, AVES, STREETS, AVE_W, ST_W, districtName, WATER_EAST_X, WATER_SOUTH_Z } from '../world/layout.js';
import { GRADE } from '../game/weapons.js';
import { BLUEPRINTS, drawBlueprint } from '../game/blueprints.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.healthFill = document.querySelector('#health .fill');
    this.vehWrap = $('vehicle-hp');
    this.vehFill = document.querySelector('#vehicle-hp .fill');
    this.districtEl = $('district');
    this.goalsEl = $('goals');
    this.weaponName = $('weapon-name');
    this.weaponAmmo = $('weapon-ammo');
    this.weaponGrade = $('weapon-grade');
    this.weaponIcon = $('weapon-icon');
    this.hiddenTag = $('hidden-tag');
    this.promptEl = $('prompt');
    this.toastsEl = $('toasts');
    this.bigEl = $('bigmsg');
    this.hitEl = $('hitmarker');
    this.damageEl = $('damage');
    this.vignette = $('vignette');
    this.crosshair = $('crosshair');
    this.minimap = $('minimap');
    this.mctx = this.minimap.getContext('2d');
    this.lastDistrict = '';
    this.prompt = '';
    this.mapCanvas = this.buildMap();
    this.mapScale = 1.1;
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  buildMap() {
    const W = Math.ceil(BOUNDS.maxX - BOUNDS.minX) + 80;
    const H = Math.ceil(BOUNDS.maxZ - BOUNDS.minZ) + 80;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const ox = -BOUNDS.minX + 40;
    const oz = -BOUNDS.minZ + 40;
    this.mapOrigin = [ox, oz];
    g.fillStyle = '#f2eee2';
    g.fillRect(0, 0, W, H);
    // water
    g.fillStyle = '#c9d8ec';
    g.fillRect(WATER_EAST_X + ox, 0, W, H);
    g.fillRect(0, WATER_SOUTH_Z + oz, W, H);
    // blocks (sidewalk color) then roads stay paper
    g.fillStyle = '#e3ddcc';
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const x0 = AVES[i] + AVE_W / 2;
        const x1 = AVES[i + 1] - AVE_W / 2;
        const z0 = STREETS[j] + ST_W / 2;
        const z1 = STREETS[j + 1] - ST_W / 2;
        g.fillRect(x0 + ox, z0 + oz, x1 - x0, z1 - z0);
      }
    }
    // park
    g.fillStyle = '#cbd9b6';
    g.fillRect(-36 + 4.5 + ox, -82 + 4.5 + oz, 72 - 9, 48 - 9);
    // buildings from the collision boxes
    g.strokeStyle = '#2a3260';
    g.lineWidth = 1;
    for (const b of this.game.world.collision.boxes) {
      if (b.tag !== 'wall' || b.y1 - b.y0 < 3) continue;
      if (b.x1 - b.x0 > 120 || b.z1 - b.z0 > 120) continue;
      g.fillStyle = b.y1 > 40 ? '#b9bfd6' : '#d0d3df';
      g.fillRect(b.x0 + ox, b.z0 + oz, b.x1 - b.x0, b.z1 - b.z0);
      g.strokeRect(b.x0 + ox + 0.5, b.z0 + oz + 0.5, b.x1 - b.x0 - 1, b.z1 - b.z0 - 1);
    }
    return c;
  }

  update(dt) {
    const game = this.game;
    const p = game.player;
    this.healthFill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    const v = p.inVehicle;
    this.vehWrap.classList.toggle('hidden', !v);
    if (v) this.vehFill.style.width = `${Math.max(0, (v.hp / v.maxHp) * 100)}%`;
    const pos = v ? v.pos : p.pos;
    const dn = districtName(pos.x, pos.z);
    if (dn !== this.lastDistrict) {
      this.lastDistrict = dn;
      this.districtEl.textContent = dn || '…';
      this.districtEl.classList.toggle('hidden', !dn);
    }
    this.hiddenTag.classList.toggle('hidden', !p.hidden);
    this.vignette.classList.toggle('on', p.hidden);
    const dmgA = Math.max(0, 1 - (game.time - p.lastHurt) / 0.6);
    this.damageEl.style.opacity = `${Math.max(dmgA * 0.9, p.hp < 30 ? 0.35 + Math.sin(game.time * 6) * 0.15 : 0)}`;
    this.crosshair.classList.toggle('melee', game.weapons.current.def.kind === 'melee');
    this.crosshair.style.display = p.mode === 'foot' || (v && v.kind !== 'car') ? '' : 'none';
    this.drawMinimap();
  }

  setPrompt(text) {
    if (text === this.prompt) return;
    this.prompt = text;
    this.promptEl.textContent = text || '';
    this.promptEl.classList.toggle('hidden', !text);
  }

  toast(text, kind = 'info', life = 2.6) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    el.style.setProperty('--life', `${life}s`);
    this.toastsEl.appendChild(el);
    while (this.toastsEl.children.length > 3) this.toastsEl.firstChild.remove();
    setTimeout(() => el.remove(), (life + 0.6) * 1000);
  }

  big(text, ms = 1600) {
    this.bigEl.textContent = text;
    this.bigEl.classList.remove('hidden');
    clearTimeout(this.bigT);
    this.bigT = setTimeout(() => this.bigEl.classList.add('hidden'), ms);
  }

  hitMarker() {
    this.hitEl.classList.add('on');
    clearTimeout(this.hitT);
    this.hitT = setTimeout(() => this.hitEl.classList.remove('on'), 90);
  }

  hurtFlash() {
    this.damageEl.style.opacity = '0.9';
  }

  updateWeapon() {
    const s = this.game.weapons.current;
    this.weaponName.textContent = s.def.name;
    this.weaponAmmo.textContent = s.ammo === Infinity ? 'תמיד איתך' : `${s.ammo} יריות`;
    this.weaponGrade.className = s.def.id === 'pencil' ? '' : s.grade;
    this.weaponGrade.textContent = s.def.id === 'pencil' ? '' : `ציור ${GRADE[s.grade].label}${s.score !== undefined ? ` · ${s.score}` : ''}`;
    const c = this.weaponIcon;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (s.def.id === 'pencil') {
      g.save();
      g.translate(c.width / 2, c.height / 2);
      g.rotate(-0.25);
      g.fillStyle = '#e6cf7a';
      g.fillRect(-44, -7, 70, 14);
      g.fillStyle = '#e3aab8';
      g.fillRect(26, -7, 14, 14);
      g.fillStyle = '#e3cdb2';
      g.beginPath();
      g.moveTo(-44, -7);
      g.lineTo(-58, 0);
      g.lineTo(-44, 7);
      g.fill();
      g.strokeStyle = '#141418';
      g.lineWidth = 2;
      g.strokeRect(-44, -7, 84, 14);
      g.beginPath();
      g.moveTo(-44, -7);
      g.lineTo(-58, 0);
      g.lineTo(-44, 7);
      g.stroke();
      g.restore();
    } else if (s.strokes) {
      this.drawStrokesInto(g, s.strokes, c.width, c.height);
    } else {
      drawBlueprint(g, BLUEPRINTS[s.def.id], 0, 0, c.width, c.height, { width: 2 });
    }
  }

  drawStrokesInto(g, strokes, w, h) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of strokes) for (const [x, y] of s) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const sc = Math.min((w * 0.9) / Math.max(1, x1 - x0), (h * 0.9) / Math.max(1, y1 - y0));
    const ox = (w - (x1 - x0) * sc) / 2 - x0 * sc;
    const oy = (h - (y1 - y0) * sc) / 2 - y0 * sc;
    g.strokeStyle = '#1c2650';
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (const s of strokes) {
      g.beginPath();
      s.forEach(([x, y], i) => (i ? g.lineTo(x * sc + ox, y * sc + oy) : g.moveTo(x * sc + ox, y * sc + oy)));
      g.stroke();
    }
  }

  setGoals(goals) {
    const html = ['<h4>מה עושים עכשיו?</h4>'];
    for (const g of goals) html.push(`<div class="g ${g.done ? 'done' : ''}"><span class="box"></span><span>${g.text}</span></div>`);
    this.goalsEl.innerHTML = html.join('');
  }

  drawMinimap() {
    const game = this.game;
    const c = this.minimap;
    const g = this.mctx;
    const W = c.width;
    const H = c.height;
    const p = game.player.inVehicle ? game.player.inVehicle.pos : game.player.pos;
    const yaw = game.camRig.yaw;
    const s = this.mapScale;
    g.save();
    g.fillStyle = '#f2eee2';
    g.fillRect(0, 0, W, H);
    g.translate(W / 2, H / 2);
    // rotate so the camera's forward points up
    g.rotate(Math.PI + yaw);
    g.scale(s, s);
    const [ox, oz] = this.mapOrigin;
    g.drawImage(this.mapCanvas, -(p.x + ox), -(p.z + oz));
    // markers in world coords
    const dot = (x, z, r, fill, stroke) => {
      g.beginPath();
      g.arc(x - p.x, z - p.z, r / s, 0, Math.PI * 2);
      if (fill) {
        g.fillStyle = fill;
        g.fill();
      }
      if (stroke) {
        g.strokeStyle = stroke;
        g.lineWidth = 1.5 / s;
        g.stroke();
      }
    };
    for (const h of game.world.hideSpots) {
      if (Math.abs(h.x - p.x) > 110 || Math.abs(h.z - p.z) > 110) continue;
      dot(h.x, h.z, 3, null, '#3a6ad6');
    }
    for (const b of game.world.billboards) {
      const got = game.album.has(b.id);
      g.save();
      g.translate(b.x - p.x, b.z - p.z);
      g.fillStyle = got ? '#9aa0b0' : '#ffd400';
      g.strokeStyle = '#141418';
      g.lineWidth = 1.5 / s;
      g.fillRect(-5 / s, -4 / s, 10 / s, 8 / s);
      g.strokeRect(-5 / s, -4 / s, 10 / s, 8 / s);
      g.restore();
    }
    for (const v of game.vehicles.list) dot(v.pos.x, v.pos.z, 4, '#5f8be8', '#141418');
    for (const e of game.enemies.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d > 70) continue;
      dot(e.pos.x, e.pos.z, e.state === 'chase' ? 3.4 : 2.4, e.state === 'chase' ? '#c81e24' : '#d98a8a', null);
    }
    g.restore();
    // player arrow (always up)
    g.save();
    g.translate(W / 2, H / 2);
    const rel = (game.player.inVehicle ? game.player.inVehicle.yaw : game.player.yaw) - yaw;
    g.rotate(-rel);
    g.fillStyle = '#c81e24';
    g.strokeStyle = '#141418';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -9);
    g.lineTo(6, 7);
    g.lineTo(0, 3);
    g.lineTo(-6, 7);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    // north marker
    g.save();
    g.translate(W / 2, H / 2);
    const nr = W / 2 - 14;
    g.font = 'bold 16px Rubik, sans-serif';
    g.fillStyle = '#141418';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('N', -Math.sin(yaw) * nr, Math.cos(yaw) * nr);
    g.restore();
  }
}
