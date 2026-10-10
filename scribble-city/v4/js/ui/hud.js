import { BOUNDS, AVES, STREETS, districtName, WATER_X, PIER, NORTH_EDGE, SOUTH_EDGE, WEST_EDGE, STREET_X0, STREET_X1 } from '../world/layout.js';
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
    this.clockEl = $('clock');
    this.lastClock = -1;
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
    this.wantedEl = $('wanted');
    this.wantedStars = [...this.wantedEl.children];
    this.splatsEl = $('splats');
    this.wantedLevel = 0;
    this.mctx = this.minimap.getContext('2d');
    this.lastDistrict = '';
    this.prompt = '';
    this.mapCanvas = this.buildMap();
    this.mapScale = 1.1;
    // the city's map lies under the markers and is turned and slid by the browser itself (a
    // transform on the page, nothing drawn): each frame only the markers are drawn
    this.mapCanvas.className = 'minimap-city';
    this.minimap.parentNode.insertBefore(this.mapCanvas, this.minimap);
    this.mapK = 0;
    this.mapKey = '';
    window.addEventListener('resize', () => (this.mapK = 0));
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  // the city from above, once: the bay, the roads, the parks, every building (from its walls)
  buildMap() {
    const pad = 60;
    const x0 = BOUNDS.minX - pad;
    const x1 = PIER.x1 + pad;
    const z0 = BOUNDS.minZ - pad;
    const z1 = BOUNDS.maxZ + pad;
    const W = Math.ceil(x1 - x0);
    const H = Math.ceil(z1 - z0);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const ox = -x0;
    const oz = -z0;
    this.mapOrigin = [ox, oz];
    const R = (ax, az, bx, bz, col) => {
      g.fillStyle = col;
      g.fillRect(ax + ox, az + oz, bx - ax, bz - az);
    };
    // the land (pavers), the bay to the east and the sea to the south
    R(x0, z0, x1, z1, '#d9b9c4');
    R(WATER_X, z0, x1, z1, '#34307a');
    R(x0, SOUTH_EDGE + 36, x1, z1, '#34307a');
    R(WEST_EDGE - 40, SOUTH_EDGE + 4, WATER_X, SOUTH_EDGE + 36, '#f0d9a8');
    R(PIER.x0, PIER.z0, PIER.x1, PIER.z1, '#c98f68');
    R(STREET_X1, NORTH_EDGE - 60, WATER_X, SOUTH_EDGE + 36, '#efc9b4');
    // the roads
    const road = '#4a4258';
    for (const a of AVES) {
      if (a.blvd) R(STREET_X0, NORTH_EDGE - 60, STREET_X1, SOUTH_EDGE + 30, road);
      else R(a.x - a.half, NORTH_EDGE, a.x + a.half, SOUTH_EDGE, road);
    }
    for (const st of STREETS) R(WEST_EDGE - 6, st.z - st.half, STREET_X0, st.z + st.half, road);
    // parks, plazas, the market
    const w = this.game.world;
    for (const p of w.parks || []) R(p.x0, p.z0, p.x1, p.z1, '#7fc485');
    for (const p of w.plazas || []) R(p.x0, p.z0, p.x1, p.z1, '#f2c9a0');
    for (const p of w.markets || []) R(p.x0, p.z0, p.x1, p.z1, '#f2c9a0');
    // the buildings, from their walls
    g.strokeStyle = '#1b1430';
    g.lineWidth = 1;
    for (const b of w.collision.boxes) {
      if (b.tag !== 'wall' || b.y1 - b.y0 < 3) continue;
      if (b.x1 - b.x0 > 120 || b.z1 - b.z0 > 120) continue;
      g.fillStyle = b.y1 > 30 ? '#8e7fd0' : '#f4e6ec';
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
    // the hour in the city (written only when the minute changes)
    const dnc = game.daynight;
    if (dnc && this.clockEl) {
      const m = Math.floor(dnc.hour * 60);
      if (m !== this.lastClock) {
        this.lastClock = m;
        this.clockEl.textContent = dnc.clock;
      }
    }
    this.hiddenTag.classList.toggle('hidden', !p.hidden);
    this.vignette.classList.toggle('on', p.hidden);
    const dmgA = Math.max(0, 1 - (game.time - p.lastHurt) / 0.6);
    this.damageEl.style.opacity = `${Math.max(dmgA * 0.9, p.hp < 30 ? 0.35 + Math.sin(game.time * 6) * 0.15 : 0)}`;
    this.crosshair.classList.toggle('melee', game.weapons.current.def.kind === 'melee');
    this.crosshair.style.display = (p.mode === 'foot' && !game.inBar) || (v && v.kind !== 'car') ? '' : 'none';
    // the minimap looks further around the faster you go (and closer again on foot)
    const sp = v ? v.speedAbs || Math.abs(v.speed || 0) : 0;
    if (sp > 9) this.mapFar = true;
    else if (sp < 5) this.mapFar = false;
    const want = this.mapFar ? 0.62 : 1.1;
    if (this.mapScale !== want) {
      this.mapScale += (want - this.mapScale) * (1 - Math.exp(-dt * 1.6));
      if (Math.abs(want - this.mapScale) < 0.002) this.mapScale = want;
    }
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

  // the car radio's line (the station's name, what the DJ says, an ad); null hides it
  radio(text, kind = null) {
    const el = this.radioEl || (this.radioEl = document.getElementById('radio'));
    if (!el) return;
    if (!text) {
      el.classList.add('hidden');
      return;
    }
    el.textContent = text;
    el.classList.toggle('ad', kind === 'ad');
    el.classList.remove('hidden');
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

  // police stars; blinking while they have lost sight of you
  setWanted(level, searching) {
    this.wantedEl.classList.toggle('hidden', level <= 0);
    this.wantedEl.classList.toggle('search', !!searching);
    this.wantedStars.forEach((s, i) => s.classList.toggle('on', i < level));
    if (level > this.wantedLevel) {
      this.wantedEl.classList.remove('bump');
      void this.wantedEl.offsetWidth;
      this.wantedEl.classList.add('bump');
    }
    this.wantedLevel = level;
  }

  // a paint ball or ink blot hit you: a blob on the screen that drips and fades
  splat(color) {
    const el = document.createElement('div');
    el.className = 'splat';
    const s = 70 + Math.random() * 110;
    el.style.width = `${s}px`;
    el.style.height = `${s * (0.75 + Math.random() * 0.4)}px`;
    el.style.left = `${15 + Math.random() * 65}%`;
    el.style.top = `${15 + Math.random() * 55}%`;
    el.style.background = `rgb(${color.map((c) => Math.round(c * 255)).join(',')})`;
    this.splatsEl.appendChild(el);
    while (this.splatsEl.children.length > 6) this.splatsEl.firstChild.remove();
    setTimeout(() => el.remove(), 2400);
  }

  updateWeapon() {
    const s = this.game.weapons.current;
    this.weaponName.textContent = s.def.name;
    const d = s.def;
    this.weaponAmmo.textContent = d.block ? `המגן יחזיק עוד ${s.uses} מכות`
      : s.uses !== undefined ? `נשארו ${s.uses} מחיקות`
      : d.kind === 'beam' ? `${Math.ceil(s.ammo)} שניות של אור`
      : d.projectile === 'scissors' ? (s.out ? 'באוויר… חוזרים אליך' : 'זורקים — וחוזרים')
      : d.projectile === 'inkbomb' ? `${s.ammo} בקבוקי דיו`
      : s.ammo === Infinity ? 'תמיד איתך' : `${s.ammo} יריות`;
    this.weaponGrade.className = s.def.id === 'pencil' || s.def.gear ? '' : s.grade;
    this.weaponGrade.textContent = s.def.id === 'pencil' ? '' : s.def.gear ? 'ציוד משטרה שנאסף' : `ציור ${GRADE[s.grade].label}${s.score !== undefined ? ` · ${s.score}` : ''}`;
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
    } else if (s.def.gear) {
      drawGearIcon(g, s.def.id, c.width, c.height, s.uses !== undefined ? s.uses / s.def.uses : 1);
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
    // (page pixels per pixel of the markers' canvas: measured again after a resize)
    if (!this.mapK) this.mapK = this.minimap.clientWidth / W || 1;
    const k = this.mapK;
    const [ox, oz] = this.mapOrigin;
    // the city's map: the camera's forward points up
    const key = `translate(${((W / 2) * k).toFixed(2)}px, ${((H / 2) * k).toFixed(2)}px) rotate(${(Math.PI + yaw).toFixed(4)}rad) scale(${(s * k).toFixed(4)}) translate(${(-(p.x + ox)).toFixed(2)}px, ${(-(p.z + oz)).toFixed(2)}px)`;
    if (key !== this.mapKey) {
      this.mapKey = key;
      this.mapCanvas.style.transform = key;
    }
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(Math.PI + yaw);
    g.scale(s, s);
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
      if (h.gone || Math.abs(h.x - p.x) > 110 || Math.abs(h.z - p.z) > 110) continue;
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
    const barShop = this.barShop || (this.barShop = (game.world.shops || []).find((sh) => sh.kind === 'bar') || null);
    const bar = barShop ? { x: barShop.door[0], z: barShop.door[2] } : null;
    if (bar) {
      // a little martini glass for The Inkwell
      g.save();
      g.translate(bar.x - p.x, bar.z - p.z);
      g.rotate(-(Math.PI + yaw)); // keep the glass upright on the rotating map
      g.strokeStyle = '#e0408a';
      g.fillStyle = '#ff9cc8';
      g.lineWidth = 2 / s;
      g.beginPath();
      g.moveTo(-6 / s, -6 / s);
      g.lineTo(6 / s, -6 / s);
      g.lineTo(0, 1 / s);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(0, 1 / s);
      g.lineTo(0, 6 / s);
      g.moveTo(-3.5 / s, 6 / s);
      g.lineTo(3.5 / s, 6 / s);
      g.stroke();
      g.restore();
    }
    for (const v of game.vehicles.list) dot(v.pos.x, v.pos.z, 4, '#5f8be8', '#141418');
    for (const e of game.enemies.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d > 70) continue;
      dot(e.pos.x, e.pos.z, e.hostile ? 3.4 : 2.4, e.hostile ? '#c81e24' : '#d98a8a', null);
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
    g.fillStyle = '#ffd23f';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('N', -Math.sin(yaw) * nr, Math.cos(yaw) * nr);
    g.restore();
  }
}

// little drawings of police gear for the weapon card
function drawGearIcon(g, id, w, h, wear = 1) {
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-0.12);
  g.lineWidth = 2;
  g.strokeStyle = '#141418';
  g.lineJoin = 'round';
  const box = (x, y, bw, bh, fill) => {
    g.fillStyle = fill;
    g.fillRect(x, y, bw, bh);
    g.strokeRect(x, y, bw, bh);
  };
  if (id === 'pen') {
    box(-30, -6, 56, 12, '#dfe9f4');
    box(-24, -2, 46, 4, '#3a5cc6');
    box(26, -6, 8, 12, '#3a5cc6');
    box(-26, 6, 12, 22, '#2b2f3d');
    g.beginPath();
    g.moveTo(34, -5);
    g.lineTo(44, 0);
    g.lineTo(34, 5);
    g.stroke();
  } else if (id === 'm4') {
    box(-52, -4, 22, 12, '#5a5b62');
    box(-30, -8, 40, 14, '#43454d');
    box(10, -6, 22, 10, '#5d5f68');
    box(32, -3, 22, 4, '#43454d');
    box(-12, 6, 12, 18, '#ee5a96');
    box(-26, 6, 8, 14, '#43454d');
    box(-20, -14, 24, 6, '#43454d');
  } else {
    const L = 24 + 52 * Math.max(0.2, wear);
    box(-L / 2, -12, L / 2, 24, '#ee8a94');
    box(0, -12, L / 2, 24, '#5d7bd2');
    box(-8, -13, 16, 26, '#f6f3ea');
  }
  g.restore();
}
