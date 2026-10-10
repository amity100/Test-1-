import { AVES, STREETS, BLOCK_TYPES, DISTRICT_NAMES, blockRect, westRect, districtName, WATER_X, PIER, NORTH_EDGE, SOUTH_EDGE, WEST_EDGE, STREET_X0, STREET_X1, WALK_X0, PROM_X1 } from '../world/layout.js';
import { NODES } from '../world/roads.js';
import { BLUEPRINTS } from '../game/blueprints.js';
import { shopOpen, shopHours } from '../game/rhythm.js';
import { sticker, pin } from './mapglyphs.js';

// The city's map (ROADMAP 2.1). The whole city drawn in pen on a page of graph paper: the bay with
// its waves, the beach, the pier with the big wheel, the park, every building from above in its own
// colours with its shadow, the streets with their names, the districts, and little drawn stickers
// for the shops, the blueprints' boards and the places worth a visit. Zoom with the wheel or two
// fingers, drag to move; a sticker tells what it is (with the hours, open or shut right now).
// A click on the map marks a destination there (or a sticker's card offers its place): the way
// to it along the roads is drawn on the map and on the minimap (game/gps.js).
//
// Opened with M, a tap on the minimap or from the pause menu. The game waits while it is open, and
// the 3D city is not drawn under it (the map covers the screen). It is drawn again only when the
// view changes.

const $ = (id) => document.getElementById(id);
const STORE = 'scribble-city-map-v1';
const TAU = Math.PI * 2;

// what the map shows: from behind the west edge's houses to past the pier, from the far blocks in
// the north to the open sea
const MAP = { x0: WEST_EDGE - 60, x1: PIER.x1 + 60, z0: NORTH_EDGE - 80, z1: SOUTH_EDGE + 90 };
// where the beach goes into the sea
const SHORE_Z = SOUTH_EDGE + 36;
// the closest the map comes (pixels a metre)
const K_MAX = 9;

const COL = {
  paper: '#f6efe0',
  grid: 'rgba(96, 128, 205, 0.17)',
  grid2: 'rgba(96, 128, 205, 0.3)',
  ink: '#1b1430',
  ground: '#efdccb',
  north: '#f1e5d6',
  road: '#fffbf3',
  yellow: '#e3a53a',
  water: '#a7c5ec',
  waterLine: '#5577c4',
  sand: '#f7e2b2',
  grass: '#a9da93',
  grassInk: '#4f9a4a',
  path: '#f3e2c6',
  plaza: '#f6d6b4',
  deck: '#d9a676',
  lot: '#d2cbd9',
  alley: '#ddd2dc',
  pool: '#86d4ea',
  shadow: 'rgba(27, 20, 48, 0.16)',
  tower: '#b9addf',
  farInk: 'rgba(27, 20, 48, 0.35)',
};

// every kind of shop: its group on the map and what it is in Hebrew
const KINDS = {
  cafe: ['food', 'בית קפה'],
  tacos: ['food', 'טאקו'],
  diner: ['food', 'דיינר'],
  pizza: ['food', 'פיצרייה'],
  icecream: ['food', 'גלידרייה'],
  juice: ['food', 'בר מיצים'],
  falafel: ['food', 'פלאפל'],
  bagel: ['food', 'מאפייה'],
  deli: ['food', 'מעדנייה'],
  sushi: ['food', 'סושי'],
  grocery: ['shop', 'סופרמרקט'],
  shop: ['shop', 'מינימרקט'],
  books: ['shop', 'חנות ספרים'],
  phones: ['shop', 'חנות טלפונים'],
  boutique: ['shop', 'חנות בגדים'],
  music: ['shop', 'חנות תקליטים'],
  hardware: ['shop', 'כלי עבודה'],
  optics: ['shop', 'אופטיקה'],
  flowers: ['shop', 'חנות פרחים'],
  surf: ['shop', 'חנות גלישה'],
  barber: ['service', 'מספרה'],
  laundry: ['service', 'מכבסה'],
  gym: ['service', 'חדר כושר'],
  pharmacy: ['service', 'בית מרקחת'],
  bar: ['fun', 'בר'],
  club: ['fun', 'מועדון ריקודים'],
  cinema: ['fun', 'קולנוע'],
  arcade: ['fun', 'ארקייד'],
  friends: ['fun', 'דוכן "ציירו לעצמכם חבר"'],
  lobby: ['hotel', 'מלון'],
  motel: ['hotel', 'מוטל'],
};

// the legend: each group's sticker, its name, and from how close it shows (pixels a metre)
const CATS = [
  { id: 'blueprint', name: 'שלטי שרטוטים', glyph: 'board', fill: '#ffd23f', square: true, k: 0 },
  { id: 'fun', name: 'בילוי ולילה', glyph: 'bar', fill: '#ff9ccc', k: 0 },
  { id: 'place', name: 'מקומות מיוחדים', glyph: 'wheel', fill: '#fff3c4', k: 0 },
  { id: 'hotel', name: 'מלונות', glyph: 'lobby', fill: '#aec6f6', k: 1.4 },
  { id: 'food', name: 'אוכל ושתייה', glyph: 'cafe', fill: '#ffc580', k: 1.75 },
  { id: 'shop', name: 'חנויות', glyph: 'shop', fill: '#a6e5e1', k: 1.75 },
  { id: 'service', name: 'שירותים', glyph: 'barber', fill: '#d2c0f3', k: 1.75 },
  { id: 'hide', name: 'מחבואים', glyph: 'hide', fill: '#dcefff', dashed: true, k: 3 },
  { id: 'bus', name: 'תחנות אוטובוס', glyph: 'bus', fill: '#ffffff', square: true, k: 3, off: true },
  { id: 'gang', name: 'שטחי כנופיות', glyph: 'gang', fill: '#ffd0d0', k: 0 },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
const ORDER = ['blueprint', 'fun', 'place', 'hotel', 'food', 'shop', 'service', 'hide', 'bus'];

const HIDE_NOTE = {
  alley: 'בקצה הסמטה',
  dumpster: 'מאחורי פח אשפה',
  bush: 'בין השיחים בפארק',
  motel: 'מאחורי המוטל',
};

const VEHICLE_NAME = { car: 'המכונית שלכם', tank: 'הטנק שלכם', bike: 'האופנוע שלכם', copter: 'המסוק שלכם' };
const SKY_NAME = { clear: 'בהיר', cloudy: 'מעונן', drizzle: 'טפטוף', rain: 'גשם', storm: 'סערה', fog: 'ערפל' };

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// the same small numbers every time the map is drawn (the waves, the sand)
function hash(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hhmm(h) {
  const t = Math.round((((h % 24) + 24) % 24) * 60);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export class CityMap {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.built = false;
    this.el = $('citymap');
    this.canvas = $('map-canvas');
    this.g = this.canvas.getContext('2d');
    this.card = $('map-card');
    this.me = $('map-me');
    this.view = { cx: 0, cz: 0, k: 3 };
    this.lastK = 0;
    this.W = 1;
    this.H = 1;
    this.dpr = 1;
    this.raf = 0;
    this.anim = null;
    this.placed = [];
    this.hover = null;
    this.sel = null;
    this.pointers = new Map();
    this.pinch = null;
    this.lastTap = null;
    this.openedAt = 0;
    this.off = new Set();
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && Array.isArray(s.off)) for (const id of s.off) this.off.add(id);
      else for (const c of CATS) if (c.off) this.off.add(c.id);
    } catch (e) {
      for (const c of CATS) if (c.off) this.off.add(c.id);
    }
    this.bind();
  }

  // ------------------------------------------------------------------ the page around the map
  bind() {
    const c = this.canvas;
    $('map-close').addEventListener('click', () => this.hide());
    $('map-in').addEventListener('click', () => this.zoomBy(1.6));
    $('map-out').addEventListener('click', () => this.zoomBy(1 / 1.6));
    $('map-home').addEventListener('click', () => this.centreOnPlayer(true));
    $('map-legend-btn').addEventListener('click', () => this.el.classList.toggle('legend-open'));
    const list = $('map-legend-list');
    for (const cat of CATS) {
      const row = document.createElement('button');
      row.className = 'lg-row';
      row.dataset.cat = cat.id;
      const ic = document.createElement('canvas');
      ic.width = 52;
      ic.height = 52;
      const g = ic.getContext('2d');
      g.scale(2, 2);
      sticker(g, 13, 12.5, cat.glyph, cat.fill, 10, { square: cat.square, dashed: cat.dashed });
      row.appendChild(ic);
      const name = document.createElement('span');
      name.textContent = cat.name;
      row.appendChild(name);
      row.classList.toggle('off', this.off.has(cat.id));
      row.addEventListener('click', () => {
        if (this.off.has(cat.id)) this.off.delete(cat.id);
        else this.off.add(cat.id);
        row.classList.toggle('off', this.off.has(cat.id));
        try {
          localStorage.setItem(STORE, JSON.stringify({ off: [...this.off] }));
        } catch (e) {
          // (not kept)
        }
        this.hideCard();
        this.dirty();
      });
      list.appendChild(row);
    }
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e, true));
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !this.pointers.size) this.setHover(null);
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0018));
      this.anim = null;
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, this.view.k * f);
    }, { passive: false });
    // a right click lets the destination go
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.game.gps.target) this.clearTarget();
    });
    this.card.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const it = this.sel;
      if (b.dataset.act === 'go' && it) {
        const at = it.vehicle ? it.vehicle.pos : it;
        this.game.gps.set(at.x, at.z, it.vehicle ? it.name : it.name || it.he || null);
        this.updateHead();
      } else if (b.dataset.act === 'clear') this.clearTarget();
      this.hideCard();
      this.dirty();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => {
      if (this.open) {
        this.resize();
        this.dirty();
      }
    });
    // (the fonts of the labels may come after the first drawing)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.dirty());
  }

  show() {
    if (this.open) return;
    if (!this.built) this.build();
    this.open = true;
    this.openedAt = performance.now();
    this.el.classList.remove('hidden');
    this.el.classList.remove('opening');
    void this.el.offsetWidth;
    this.el.classList.add('opening');
    this.resize();
    this.sel = null;
    this.hideCard();
    this.centreOnPlayer(false, this.lastK || clamp(this.H / 300, this.kMin(), K_MAX));
    this.updateHead();
    $('map-hint').textContent = this.game.pad && this.game.pad.active
      ? 'סטיק — הזזה · RT/LT — זום · Ⓐ — יעד, או מה זה · Ⓧ — בלי יעד · Ⓨ — אליכם · Ⓑ — סגירה'
      : this.game.touch
      ? 'גרירה — הזזה · שתי אצבעות — זום · נגיעה — יעד, או מה זה'
      : 'גרירה — הזזה · גלגלת — זום · קליק — יעד · קליק ימני — בלי יעד · M — סגירה';
    this.render();
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.lastK = this.view.k;
    this.anim = null;
    this.pointers.clear();
    this.pinch = null;
    this.el.classList.add('hidden');
    this.el.classList.remove('legend-open');
    this.hideCard();
    // (the page's pixels are let go until the map opens again)
    this.canvas.width = 1;
    this.canvas.height = 1;
    if (this.game.onMapClosed) this.game.onMapClosed();
  }

  // the map covers the screen: the city under it need not be drawn
  get covering() {
    return this.open && performance.now() - this.openedAt > 220;
  }

  resize() {
    const W = Math.max(1, this.el.clientWidth || window.innerWidth);
    const H = Math.max(1, this.el.clientHeight || window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
  }

  kMin() {
    return Math.min(this.W / (MAP.x1 - MAP.x0), this.H / (MAP.z1 - MAP.z0)) * 0.92;
  }

  playerPos() {
    const p = this.game.player;
    const v = p.inVehicle;
    return v ? { x: v.pos.x, z: v.pos.z, yaw: v.yaw } : { x: p.pos.x, z: p.pos.z, yaw: p.yaw };
  }

  centreOnPlayer(animate, k = this.view.k) {
    const p = this.playerPos();
    const to = { cx: p.x, cz: p.z, k: clamp(k, this.kMin(), K_MAX) };
    this.clampView(to);
    if (animate) this.animateTo(to);
    else {
      this.view = to;
      this.dirty();
    }
  }

  updateHead() {
    const p = this.playerPos();
    const where = districtName(p.x, p.z);
    const dn = this.game.daynight;
    const w = this.game.weather;
    const sky = w ? SKY_NAME[w.kind] || '' : '';
    // (in Hebrew "in the market" drops the article: השוק -> בשוק)
    const inn = where ? `אתם ב${where.startsWith('ה') ? where.slice(1) : where}` : 'אתם מחוץ לעיר';
    const gps = this.game.gps;
    const r = gps && gps.target && gps.route;
    const to = r ? ` · ⚑ ${r.len < 1000 ? `${Math.max(10, Math.round(r.len / 10) * 10)} מ׳` : `${(r.len / 1000).toFixed(1)} ק״מ`}` : '';
    $('map-where').textContent = `${inn} · ${dn ? dn.clock : ''}${sky ? ` · ${sky}` : ''}${to}`;
  }

  // ------------------------------------------------------------------ the view
  // the map's edge may come in to a fifth of the screen, no further (and a map smaller than the
  // screen stays in its middle)
  clampView(v) {
    v.k = clamp(v.k, this.kMin(), K_MAX);
    const hw = (this.W / 2 / v.k) * 0.6;
    const hh = (this.H / 2 / v.k) * 0.6;
    v.cx = MAP.x1 - MAP.x0 > 2 * hw ? clamp(v.cx, MAP.x0 + hw, MAP.x1 - hw) : (MAP.x0 + MAP.x1) / 2;
    v.cz = MAP.z1 - MAP.z0 > 2 * hh ? clamp(v.cz, MAP.z0 + hh, MAP.z1 - hh) : (MAP.z0 + MAP.z1) / 2;
    return v;
  }

  zoomAt(px, py, k) {
    const v = this.view;
    const wx = (px - this.W / 2) / v.k + v.cx;
    const wz = (py - this.H / 2) / v.k + v.cz;
    v.k = clamp(k, this.kMin(), K_MAX);
    v.cx = wx - (px - this.W / 2) / v.k;
    v.cz = wz - (py - this.H / 2) / v.k;
    this.clampView(v);
    this.hideCard();
    this.dirty();
  }

  zoomBy(f) {
    const v = this.view;
    this.animateTo(this.clampView({ cx: v.cx, cz: v.cz, k: v.k * f }));
  }

  animateTo(to, ms = 260) {
    this.hideCard();
    this.anim = { from: { ...this.view }, to, t0: performance.now(), ms };
    this.dirty();
  }

  stepAnim() {
    const a = this.anim;
    if (!a) return;
    const t = clamp((performance.now() - a.t0) / a.ms, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);
    // (the zoom goes evenly in its logarithm, so it does not rush at the start)
    const k = Math.exp(Math.log(a.from.k) + (Math.log(a.to.k) - Math.log(a.from.k)) * e);
    this.view = { cx: a.from.cx + (a.to.cx - a.from.cx) * e, cz: a.from.cz + (a.to.cz - a.from.cz) * e, k };
    if (t >= 1) this.anim = null;
  }

  dirty() {
    if (!this.open || this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  sx(x) {
    return (x - this.view.cx) * this.view.k + this.W / 2;
  }

  sy(z) {
    return (z - this.view.cz) * this.view.k + this.H / 2;
  }

  // ------------------------------------------------------------------ the city, read once
  build() {
    this.built = true;
    const game = this.game;
    const w = game.world;
    const fp = w.footprints || [];
    this.buildings = [];
    this.far = [];
    this.lots = [];
    this.pools = [];
    for (const f of fp) {
      if (f.lot) this.lots.push(f);
      else if (f.pool) this.pools.push(f);
      else if (f.far) this.far.push({ ...f, fill: f.color ? f.color.getStyle() : '#ddd' });
      else {
        this.buildings.push({
          ...f,
          fill: f.tower ? COL.tower : f.color ? f.color.getStyle() : '#f4e6ec',
          front: f.awning ? f.awning.getStyle() : f.trim ? f.trim.getStyle() : null,
        });
      }
    }
    // (the tall ones last: their shadows fall over the low ones)
    this.buildings.sort((a, b) => a.top - b.top);
    this.trees = [];
    for (const b of w.collision.boxes) if (b.tag === 'tree') this.trees.push({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 });
    this.alleys = (w.alleys || []).filter((a) => !['park', 'plaza', 'motel', 'market'].includes(a.type));
    this.items = [];
    const add = (o) => this.items.push(o);
    // the shops (the towers' lobbies are only doors to offices)
    for (const s of w.shops || []) {
      let kind = s.kind;
      if (kind === 'lobby' && s.name === 'tower') continue;
      if (s.name === 'INK CLUB') kind = 'club';
      if (s.name === 'Star Motel') kind = 'motel';
      const k = KINDS[kind];
      if (!k) continue;
      const d = s.door;
      add({ cat: k[0], glyph: kind, x: d[0], z: d[2], name: s.name === 'tower' ? null : s.name, he: k[1], hours: kind === 'club' ? 'club' : kind === 'motel' ? 'lobby' : kind, shop: s });
    }
    // the blueprints' boards
    for (const b of w.billboards || []) {
      const bp = BLUEPRINTS[b.id];
      if (!bp) continue;
      add({ cat: 'blueprint', glyph: 'board', x: b.x, z: b.z, name: bp.name, bp, board: b });
    }
    // the places worth a visit
    if (w.wheel) add({ cat: 'place', glyph: 'wheel', x: w.wheel.x, z: w.wheel.z, name: 'הגלגל הענק', note: 'על המזח' });
    if (w.helipad) add({ cat: 'place', glyph: 'heli', x: w.helipad.x, z: w.helipad.z, name: 'מנחת המסוקים', note: 'בקצה המזח, ולידו השרטוטים של המסוק ושל המצנח' });
    for (const f of w.fountains || []) add({ cat: 'place', glyph: 'fountain', x: f.x, z: f.z, name: 'כיכר המזרקה', note: 'בתי קפה ושולחנות סביב המזרקה' });
    for (const c of w.courts || []) add({ cat: 'place', glyph: 'court', x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2, name: 'מגרש הכדורסל', note: 'בפארק הדקלים' });
    for (const m of w.markets || []) add({ cat: 'place', glyph: 'market', x: (m.x0 + m.x1) / 2, z: (m.z0 + m.z1) / 2, name: 'השוק', note: 'דוכנים של פירות, פרחים, דגים ובגדים' });
    add({ cat: 'place', glyph: 'beach', x: -150, z: SOUTH_EDGE + 20, name: 'החוף', note: 'חול, ים, ושקיעה מול המפרץ' });
    // where nobody sees you
    for (const h of w.hideSpots || []) add({ cat: 'hide', glyph: 'hide', x: h.x, z: h.z, name: 'מחבוא', note: `${HIDE_NOTE[h.kind] || ''}${HIDE_NOTE[h.kind] ? '. ' : ''}כאן לא רואים אתכם, ואפשר לצייר בשקט`, spot: h });
    for (const b of w.busStops || []) add({ cat: 'bus', glyph: 'bus', x: b.x, z: b.z, name: 'תחנת אוטובוס', note: districtName(b.x, b.z) });
    // the most important first: they keep their place when the stickers crowd
    const rank = Object.fromEntries(ORDER.map((id, i) => [id, i]));
    this.items.sort((a, b) => rank[a.cat] - rank[b.cat]);
    this.gangs = (w.territories || []).filter((t) => t.name === 'gang');
    // the market's stalls
    this.stalls = (w.stands || []).filter((s) => s.kind !== 'icecream' && s.f);
  }

  // ------------------------------------------------------------------ drawing
  render() {
    if (!this.open) return;
    this.stepAnim();
    const g = this.g;
    const { W, H, dpr } = this;
    const { cx, cz, k } = this.view;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COL.paper;
    g.fillRect(0, 0, W, H);
    // the world, in metres
    g.setTransform(dpr * k, 0, 0, dpr * k, dpr * (W / 2 - cx * k), dpr * (H / 2 - cz * k));
    const vis = { x0: cx - W / 2 / k, x1: cx + W / 2 / k, z0: cz - H / 2 / k, z1: cz + H / 2 / k };
    this.vis = vis;
    const px = 1 / k;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    this.drawGrid(g, vis, px);
    this.drawWater(g, vis, px);
    this.drawLand(g, vis, px);
    this.drawRoads(g, vis, px);
    this.drawPlaces(g, vis, px);
    this.drawBuildings(g, vis, px);
    this.drawTrees(g, vis, px);
    if (!this.off.has('gang')) this.drawGangs(g, px);
    this.drawRoute(g, px);
    // the page, in pixels
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawLabels(g);
    this.drawStickers(g);
    this.drawMoving(g);
    this.drawScale(g);
    if (this.anim) this.dirty();
  }

  drawGrid(g, vis, px) {
    // graph paper: a line every 25 m, a darker one every 100 m
    const step = this.view.k < 1.2 ? 50 : 25;
    g.lineWidth = px;
    for (const [col, every] of [[COL.grid, step], [COL.grid2, 100]]) {
      g.strokeStyle = col;
      g.beginPath();
      for (let x = Math.ceil(vis.x0 / every) * every; x <= vis.x1; x += every) {
        if (every === step && x % 100 === 0) continue;
        g.moveTo(x, vis.z0);
        g.lineTo(x, vis.z1);
      }
      for (let z = Math.ceil(vis.z0 / every) * every; z <= vis.z1; z += every) {
        if (every === step && z % 100 === 0) continue;
        g.moveTo(vis.x0, z);
        g.lineTo(vis.x1, z);
      }
      g.stroke();
    }
  }

  drawWater(g, vis, px) {
    // the bay to the east and the sea to the south
    g.fillStyle = COL.water;
    g.fillRect(WATER_X, vis.z0 - 10, Math.max(0, vis.x1 - WATER_X + 10), vis.z1 - vis.z0 + 20);
    g.fillRect(vis.x0 - 10, SHORE_Z, Math.max(0, WATER_X - vis.x0 + 10), Math.max(0, vis.z1 - SHORE_Z + 10));
    // lines along the shore, further and fainter (the way the old maps drew water)
    const coast = (d) => {
      g.beginPath();
      g.moveTo(WATER_X + d, vis.z0 - 10);
      g.lineTo(WATER_X + d, SHORE_Z + d);
      g.lineTo(vis.x0 - 10, SHORE_Z + d);
    };
    g.strokeStyle = COL.waterLine;
    for (const [d, a] of [[3, 0.5], [7.5, 0.32], [14, 0.18]]) {
      g.globalAlpha = a;
      g.lineWidth = 1.2 * px;
      coast(d);
      g.stroke();
    }
    g.globalAlpha = 1;
    // the waves: little pen marks on a loose grid
    const k = this.view.k;
    const step = 26;
    const every = k < 1.1 ? 2 : 1;
    const s = clamp(k * 2.2, 3.2, 8) * px;
    g.lineWidth = 1.25 * px;
    g.strokeStyle = COL.waterLine;
    g.globalAlpha = 0.55;
    g.beginPath();
    for (let i = Math.floor(vis.x0 / step); i <= Math.ceil(vis.x1 / step); i++) {
      for (let j = Math.floor(vis.z0 / step); j <= Math.ceil(vis.z1 / step); j++) {
        if ((i + j) % every) continue;
        const x = (i + 0.2 + hash(i, j) * 0.6) * step;
        const z = (j + 0.2 + hash(j, i + 7) * 0.6) * step;
        const inBay = x > WATER_X + 18;
        const inSea = z > SHORE_Z + 18 && x < WATER_X - 4;
        if (!inBay && !inSea) continue;
        if (x < PIER.x1 + 8 && z > PIER.z0 - 20 && z < PIER.z1 + 20) continue;
        if (Math.abs(z + 430) < 14) continue;
        g.moveTo(x - s, z);
        g.quadraticCurveTo(x - s / 2, z - s * 0.7, x, z);
        g.quadraticCurveTo(x + s / 2, z - s * 0.7, x + s, z);
      }
    }
    g.stroke();
    g.globalAlpha = 1;
  }

  drawLand(g, vis, px) {
    // the far blocks in the north: the city goes on beyond the map
    g.lineWidth = px;
    for (const f of this.far) {
      if (f.z1 < vis.z0 || f.z0 > vis.z1 || f.x1 < vis.x0 || f.x0 > vis.x1) continue;
      g.globalAlpha = 0.35;
      g.fillStyle = f.fill;
      g.fillRect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0);
      g.globalAlpha = 1;
      g.strokeStyle = COL.farInk;
      g.strokeRect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0);
    }
    // the city's pavers, and the boulevard's sidewalks going on north
    g.fillStyle = COL.north;
    g.fillRect(WALK_X0, NORTH_EDGE - 60, WATER_X - WALK_X0, 60);
    g.fillStyle = COL.ground;
    g.fillRect(WEST_EDGE, NORTH_EDGE, WATER_X - WEST_EDGE, SOUTH_EDGE + 4 - NORTH_EDGE);
    // the beach, its sand dotted
    g.fillStyle = COL.sand;
    g.fillRect(WEST_EDGE - 30, SOUTH_EDGE + 4, STREET_X1 - WEST_EDGE + 30, SHORE_Z - SOUTH_EDGE - 4);
    g.fillRect(STREET_X1, SOUTH_EDGE + 30, WATER_X - STREET_X1, SHORE_Z - SOUTH_EDGE - 30);
    if (this.view.k > 1.3) {
      g.fillStyle = 'rgba(160, 120, 60, 0.45)';
      const d = 0.35 * Math.max(1, px * 1.6);
      for (let i = Math.floor(Math.max(vis.x0, WEST_EDGE - 30) / 5); i * 5 < Math.min(vis.x1, WATER_X); i++) {
        for (let j = Math.floor((SOUTH_EDGE + 4) / 5); j * 5 < SHORE_Z; j++) {
          const x = (i + hash(i, j)) * 5;
          const z = (j + hash(j, i)) * 5;
          if (z < SOUTH_EDGE + 5 || z > SHORE_Z - 1) continue;
          g.fillRect(x, z, d, d);
        }
      }
    }
    // the promenade along the sea wall
    g.fillStyle = '#f4dcc0';
    g.fillRect(STREET_X1, NORTH_EDGE - 60, PROM_X1 - STREET_X1, SOUTH_EDGE + 30 - NORTH_EDGE + 60);
    // the shore: the ink line of the land
    g.strokeStyle = COL.ink;
    g.lineWidth = 1.6 * px;
    g.beginPath();
    g.moveTo(WATER_X, vis.z0 - 10);
    g.lineTo(WATER_X, SHORE_Z);
    g.lineTo(vis.x0 - 10, SHORE_Z);
    g.stroke();
    // the sea wall's railing
    if (this.view.k > 2) {
      g.lineWidth = px;
      g.beginPath();
      g.moveTo(PROM_X1 - 0.4, NORTH_EDGE - 60);
      g.lineTo(PROM_X1 - 0.4, SOUTH_EDGE + 30);
      g.stroke();
    }
    // the alleys down the blocks
    g.fillStyle = COL.alley;
    for (const a of this.alleys) g.fillRect(a.x0, a.z0, a.x1 - a.x0, a.z1 - a.z0);
    // the motel's parking lot (its bays painted) and its pool
    for (const l of this.lots) {
      g.fillStyle = COL.lot;
      g.fillRect(l.x0 + 10, l.z0, l.x1 - l.x0 - 10, l.z1 - l.z0);
      if (this.view.k > 2.4) {
        g.strokeStyle = '#fffbf3';
        g.lineWidth = 1.2 * px;
        g.beginPath();
        for (let z = l.z0 + 30; z < l.z1 - 4; z += 3.2) {
          g.moveTo(l.x0 + 12, z);
          g.lineTo(l.x0 + 17, z);
        }
        g.stroke();
      }
    }
    for (const p of this.pools) {
      g.fillStyle = '#fbfaf6';
      g.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
      g.fillStyle = COL.pool;
      g.fillRect(p.x0 + 0.6, p.z0 + 0.6, p.x1 - p.x0 - 1.2, p.z1 - p.z0 - 1.2);
      g.strokeStyle = COL.ink;
      g.lineWidth = px;
      g.strokeRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
    }
  }

  roadRects() {
    if (this._roads) return this._roads;
    const r = [];
    for (const a of AVES) {
      if (a.blvd) r.push([STREET_X0, NORTH_EDGE - 60, STREET_X1, SOUTH_EDGE + 30]);
      else r.push([a.x - a.half, NORTH_EDGE, a.x + a.half, SOUTH_EDGE]);
    }
    for (const s of STREETS) r.push([WEST_EDGE - 6, s.z - s.half, STREET_X0, s.z + s.half]);
    this._roads = r;
    return r;
  }

  drawRoads(g, vis, px) {
    const k = this.view.k;
    const roads = this.roadRects();
    // the curbs in ink under the asphalt (where two roads cross, the lines open by themselves)
    const e = 1.3 * px;
    g.fillStyle = COL.ink;
    for (const [x0, z0, x1, z1] of roads) g.fillRect(x0 - e, z0 - e, x1 - x0 + 2 * e, z1 - z0 + 2 * e);
    g.fillStyle = COL.road;
    for (const [x0, z0, x1, z1] of roads) g.fillRect(x0, z0, x1 - x0, z1 - z0);
    if (k < 1.5) return;
    // the lines down the middle: yellow between the two ways, dashes between the lanes
    const segZ = [];
    for (let j = 0; j < STREETS.length; j++) {
      const a = j === 0 ? NORTH_EDGE : STREETS[j - 1].z + STREETS[j - 1].half + 1;
      segZ.push([a, STREETS[j].z - STREETS[j].half - 1]);
    }
    segZ.push([STREETS[STREETS.length - 1].z + STREETS[STREETS.length - 1].half + 1, SOUTH_EDGE]);
    const lanes = k > 2.6;
    g.lineCap = 'butt';
    for (const a of AVES) {
      for (const [z0, z1] of segZ) {
        const za = a.blvd && z0 === NORTH_EDGE ? NORTH_EDGE - 60 : z0;
        const zb = a.blvd && z1 === SOUTH_EDGE ? SOUTH_EDGE + 30 : z1;
        if (zb < vis.z0 || za > vis.z1) continue;
        g.setLineDash([]);
        g.strokeStyle = COL.yellow;
        g.lineWidth = Math.max(0.3, 1.4 * px);
        g.beginPath();
        g.moveTo(a.x, za);
        g.lineTo(a.x, zb);
        g.stroke();
        if (lanes) {
          g.strokeStyle = 'rgba(27, 20, 48, 0.35)';
          g.lineWidth = Math.max(0.15, px);
          g.setLineDash([3, 4]);
          g.beginPath();
          if (a.blvd) {
            g.moveTo(a.x + 4, za);
            g.lineTo(a.x + 4, zb);
          } else {
            for (const s of [-3.5, 3.5]) {
              g.moveTo(a.x + s, za);
              g.lineTo(a.x + s, zb);
            }
          }
          g.stroke();
        }
      }
    }
    // the cross streets: one lane each way, a dashed line between
    g.setLineDash([3, 4]);
    g.strokeStyle = COL.yellow;
    g.lineWidth = Math.max(0.3, 1.3 * px);
    g.beginPath();
    for (const s of STREETS) {
      if (s.z < vis.z0 - 10 || s.z > vis.z1 + 10) continue;
      let x = WEST_EDGE - 6;
      for (const a of AVES) {
        const x1 = (a.blvd ? STREET_X0 : a.x - a.half) - 1;
        g.moveTo(x, s.z);
        g.lineTo(x1, s.z);
        x = a.x + a.half + 1;
        if (a.blvd) break;
      }
    }
    g.stroke();
    g.setLineDash([]);
    g.lineCap = 'round';
    // the zebras at the crossings
    if (k > 3.4) {
      g.fillStyle = 'rgba(27, 20, 48, 0.55)';
      for (const n of NODES) {
        if (n.x < vis.x0 - 30 || n.x > vis.x1 + 30 || n.z < vis.z0 - 30 || n.z > vis.z1 + 30) continue;
        const ah = n.ave.blvd ? (STREET_X1 - STREET_X0) / 2 : n.ave.half;
        const acx = n.ave.blvd ? (STREET_X0 + STREET_X1) / 2 : n.x;
        const sh = n.street.half;
        for (const m of n.nb) {
          if (m.x === n.x) {
            // across the avenue, north or south of the crossing
            const dir = Math.sign(m.z - n.z);
            const z0 = n.z + dir * (sh + 1.2);
            const z1 = n.z + dir * (sh + 4);
            for (let x = acx - ah + 0.5; x < acx + ah - 0.4; x += 1.1) g.fillRect(x, Math.min(z0, z1), 0.55, Math.abs(z1 - z0));
          } else {
            const dir = Math.sign(m.x - n.x);
            if (n.ave.blvd && dir > 0) continue;
            const x0 = (dir < 0 ? acx - ah : acx + ah) + dir * 1.2;
            const x1 = x0 + dir * 2.8;
            for (let z = n.z - sh + 0.5; z < n.z + sh - 0.4; z += 1.1) g.fillRect(Math.min(x0, x1), z, Math.abs(x1 - x0), 0.55);
          }
        }
      }
    }
  }

  drawPlaces(g, vis, px) {
    const w = this.game.world;
    const k = this.view.k;
    // the park: paths round lawns, the basketball court
    for (const p of w.parks || []) {
      g.fillStyle = COL.path;
      g.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
      const lawn = (x0, x1, z0, z1) => {
        g.fillStyle = COL.grass;
        g.fillRect(x0, z0, x1 - x0, z1 - z0);
        g.strokeStyle = COL.grassInk;
        g.lineWidth = 1.1 * px;
        g.strokeRect(x0, z0, x1 - x0, z1 - z0);
      };
      lawn(p.x0 + 2, p.cx - 2, p.z0 + 2, p.cz - 2);
      lawn(p.cx + 2, p.x1 - 2, p.z0 + 2, p.cz - 2);
      lawn(p.x0 + 2, p.cx - 2, p.cz + 2, p.z1 - 2);
    }
    for (const c of w.courts || []) {
      g.fillStyle = '#5f84c9';
      g.fillRect(c.x0, c.z0, c.x1 - c.x0, c.z1 - c.z0);
      g.strokeStyle = '#fffbf3';
      g.lineWidth = Math.max(0.2, 1.1 * px);
      const mx = (c.x0 + c.x1) / 2;
      const mz = (c.z0 + c.z1) / 2;
      g.strokeRect(c.x0 + 1, c.z0 + 1, c.x1 - c.x0 - 2, c.z1 - c.z0 - 2);
      g.beginPath();
      if (c.z1 - c.z0 > c.x1 - c.x0) {
        g.moveTo(c.x0 + 1, mz);
        g.lineTo(c.x1 - 1, mz);
      } else {
        g.moveTo(mx, c.z0 + 1);
        g.lineTo(mx, c.z1 - 1);
      }
      g.stroke();
      g.beginPath();
      g.arc(mx, mz, Math.min(c.x1 - c.x0, c.z1 - c.z0) * 0.14, 0, TAU);
      g.stroke();
    }
    // the plaza's tiles and its fountain
    for (const p of w.plazas || []) {
      g.fillStyle = COL.plaza;
      g.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
      if (k > 3) {
        g.strokeStyle = 'rgba(190, 130, 90, 0.35)';
        g.lineWidth = px;
        g.beginPath();
        for (let x = p.x0 + 3; x < p.x1; x += 3) {
          g.moveTo(x, p.z0);
          g.lineTo(x, p.z1);
        }
        for (let z = p.z0 + 3; z < p.z1; z += 3) {
          g.moveTo(p.x0, z);
          g.lineTo(p.x1, z);
        }
        g.stroke();
      }
    }
    for (const f of w.fountains || []) {
      g.fillStyle = '#f3e6d6';
      g.beginPath();
      g.arc(f.x, f.z, 4.4, 0, TAU);
      g.fill();
      g.strokeStyle = COL.ink;
      g.lineWidth = 1.2 * px;
      g.stroke();
      g.fillStyle = COL.pool;
      g.beginPath();
      g.arc(f.x, f.z, 3.7, 0, TAU);
      g.fill();
      g.fillStyle = '#f3e6d6';
      g.beginPath();
      g.arc(f.x, f.z, 0.8, 0, TAU);
      g.fill();
      g.stroke();
    }
    // the market's ground and its stalls under striped awnings
    for (const m of w.markets || []) {
      g.fillStyle = COL.plaza;
      g.fillRect(m.x0, m.z0, m.x1 - m.x0, m.z1 - m.z0);
    }
    if (k > 1.6) {
      for (const s of this.stalls) {
        const f = s.f;
        const ax = f.ux;
        const az = f.uz;
        // (2.6 m along the front, 1.8 m deep, from the front at w = 0)
        const cxs = s.x - f.nx * 0.9;
        const czs = s.z - f.nz * 0.9;
        g.save();
        g.translate(cxs, czs);
        g.rotate(Math.atan2(az, ax));
        g.fillStyle = '#fffbf3';
        g.fillRect(-1.5, -1, 3, 2);
        g.fillStyle = '#e2335f';
        for (let i = 0; i < 3; i++) g.fillRect(-1.5 + i * 1.0, -1, 0.5, 2);
        g.strokeStyle = COL.ink;
        g.lineWidth = px;
        g.strokeRect(-1.5, -1, 3, 2);
        g.restore();
      }
    }
    // the pier, its planks, the helipad at its end and the big wheel
    g.fillStyle = COL.deck;
    g.fillRect(PIER.x0, PIER.z0, PIER.x1 - PIER.x0, PIER.z1 - PIER.z0);
    if (k > 1.6) {
      g.strokeStyle = 'rgba(110, 60, 30, 0.35)';
      g.lineWidth = px;
      g.beginPath();
      const st = k > 3.5 ? 1.5 : 3;
      for (let x = PIER.x0 + st; x < PIER.x1; x += st) {
        g.moveTo(x, PIER.z0);
        g.lineTo(x, PIER.z1);
      }
      g.stroke();
    }
    g.strokeStyle = COL.ink;
    g.lineWidth = 1.4 * px;
    g.strokeRect(PIER.x0, PIER.z0, PIER.x1 - PIER.x0, PIER.z1 - PIER.z0);
    const hp = w.helipad;
    if (hp) {
      g.fillStyle = '#5a5470';
      g.beginPath();
      g.arc(hp.x, hp.z, 5.6, 0, TAU);
      g.fill();
      g.stroke();
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 0.35;
      g.beginPath();
      g.arc(hp.x, hp.z, 4.95, 0, TAU);
      g.stroke();
      g.strokeStyle = '#fffbf3';
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(hp.x - 1.3, hp.z - 2);
      g.lineTo(hp.x - 1.3, hp.z + 2);
      g.moveTo(hp.x + 1.3, hp.z - 2);
      g.lineTo(hp.x + 1.3, hp.z + 2);
      g.moveTo(hp.x - 1.3, hp.z);
      g.lineTo(hp.x + 1.3, hp.z);
      g.stroke();
    }
    const wh = w.wheel;
    if (wh) {
      // from above the wheel is a narrow ring standing on its edge: two rims and the cars
      g.fillStyle = 'rgba(27, 20, 48, 0.12)';
      g.fillRect(wh.x - 2, wh.z - wh.R - 1, 4, wh.R * 2 + 2);
      g.strokeStyle = COL.ink;
      g.lineWidth = 1.2 * px;
      g.beginPath();
      for (const s of [-1.2, 1.2]) {
        g.moveTo(wh.x + s, wh.z - wh.R);
        g.lineTo(wh.x + s, wh.z + wh.R);
      }
      g.moveTo(wh.x - 3, wh.z);
      g.lineTo(wh.x + 3, wh.z);
      g.stroke();
      g.fillStyle = '#ff7eb6';
      for (let i = 0; i <= 8; i++) {
        const z = wh.z - wh.R + (i / 8) * wh.R * 2;
        g.fillRect(wh.x - 1.6, z - 0.7, 3.2, 1.4);
      }
    }
    // the long bridge over the bay, coming ashore in the north
    const bz = -430;
    if (vis.z0 < bz + 10 && vis.z1 > bz - 10) {
      g.fillStyle = 'rgba(27, 20, 48, 0.14)';
      g.fillRect(WATER_X, bz - 5, vis.x1 - WATER_X + 20, 14);
      g.fillStyle = '#d4c9e9';
      g.fillRect(21, bz - 7, vis.x1 - 21 + 20, 14);
      g.strokeStyle = COL.ink;
      g.lineWidth = 1.3 * px;
      g.beginPath();
      g.moveTo(21, bz - 7);
      g.lineTo(vis.x1 + 20, bz - 7);
      g.moveTo(21, bz + 7);
      g.lineTo(vis.x1 + 20, bz + 7);
      g.moveTo(21, bz - 7);
      g.lineTo(21, bz + 7);
      g.stroke();
      g.strokeStyle = 'rgba(27, 20, 48, 0.4)';
      g.setLineDash([2.5, 3]);
      g.lineWidth = px;
      g.beginPath();
      g.moveTo(25, bz);
      g.lineTo(vis.x1 + 20, bz);
      g.stroke();
      g.setLineDash([]);
    }
  }

  drawBuildings(g, vis, px) {
    const k = this.view.k;
    const list = this.buildings;
    // shadows towards the south-east, as long as the building is tall
    g.fillStyle = COL.shadow;
    g.beginPath();
    for (const b of list) {
      if (b.x1 < vis.x0 - 30 || b.x0 > vis.x1 || b.z1 < vis.z0 - 30 || b.z0 > vis.z1) continue;
      const L = Math.min(26, b.top * 0.16);
      const dx = L * 0.62;
      const dz = L * 0.78;
      g.moveTo(b.x0, b.z0);
      g.lineTo(b.x1, b.z0);
      g.lineTo(b.x1 + dx, b.z0 + dz);
      g.lineTo(b.x1 + dx, b.z1 + dz);
      g.lineTo(b.x0 + dx, b.z1 + dz);
      g.lineTo(b.x0, b.z1);
      g.closePath();
    }
    g.fill();
    const detail = k > 2.3;
    for (const b of list) {
      if (b.x1 < vis.x0 || b.x0 > vis.x1 || b.z1 < vis.z0 || b.z0 > vis.z1) continue;
      const w = b.x1 - b.x0;
      const d = b.z1 - b.z0;
      g.fillStyle = b.fill;
      g.fillRect(b.x0, b.z0, w, d);
      if (b.tower) {
        // the tower's crown, stepped back, and its spire
        g.fillStyle = 'rgba(255, 255, 255, 0.35)';
        g.fillRect(b.x0 + w * 0.18, b.z0 + d * 0.18, w * 0.64, d * 0.64);
        g.strokeStyle = 'rgba(27, 20, 48, 0.5)';
        g.lineWidth = px;
        g.strokeRect(b.x0 + w * 0.18, b.z0 + d * 0.18, w * 0.64, d * 0.64);
        g.fillStyle = COL.ink;
        g.beginPath();
        g.arc(b.x0 + w / 2, b.z0 + d / 2, Math.max(0.6, 1.6 * px), 0, TAU);
        g.fill();
      } else if (detail) {
        // the parapet round the flat roof
        g.strokeStyle = 'rgba(27, 20, 48, 0.28)';
        g.lineWidth = px;
        g.strokeRect(b.x0 + 0.8, b.z0 + 0.8, w - 1.6, d - 1.6);
      }
      g.strokeStyle = COL.ink;
      g.lineWidth = 1.15 * px;
      g.strokeRect(b.x0, b.z0, w, d);
      // the shop's awning over the sidewalk, in its stripes
      if (b.front && b.nx !== undefined && k > 1.4) this.drawAwning(g, b, px, k);
    }
  }

  drawAwning(g, b, px, k) {
    const dep = 1.7;
    const alongZ = Math.abs(b.nx) > 0.5;
    let x0;
    let z0;
    let x1;
    let z1;
    if (alongZ) {
      z0 = b.z0 + 1.4;
      z1 = b.z1 - 1.4;
      x0 = b.nx > 0 ? b.x1 : b.x0 - dep;
      x1 = x0 + dep;
    } else {
      x0 = b.x0 + 1.4;
      x1 = b.x1 - 1.4;
      z0 = b.nz > 0 ? b.z1 : b.z0 - dep;
      z1 = z0 + dep;
    }
    g.fillStyle = b.front;
    g.fillRect(x0, z0, x1 - x0, z1 - z0);
    if (k > 3.2) {
      g.fillStyle = '#fffbf3';
      if (alongZ) for (let z = z0 + 0.45; z < z1 - 0.3; z += 0.9) g.fillRect(x0, z, dep, 0.45);
      else for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.9) g.fillRect(x, z0, 0.45, dep);
    }
    g.strokeStyle = COL.ink;
    g.lineWidth = px;
    g.strokeRect(x0, z0, x1 - x0, z1 - z0);
  }

  drawTrees(g, vis, px) {
    const k = this.view.k;
    if (k < 1.2) return;
    const r = 1.9;
    const fine = k > 2.6;
    g.fillStyle = '#7cc46e';
    g.strokeStyle = '#2f7a3a';
    g.lineWidth = 1.1 * px;
    for (const t of this.trees) {
      if (t.x < vis.x0 - 3 || t.x > vis.x1 + 3 || t.z < vis.z0 - 3 || t.z > vis.z1 + 3) continue;
      g.beginPath();
      if (fine) {
        // a palm from above: a star of fronds
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + hash(Math.round(t.x * 3), Math.round(t.z * 3)) * 2;
          const ox = Math.cos(a) * r;
          const oz = Math.sin(a) * r;
          g.moveTo(t.x, t.z);
          g.quadraticCurveTo(t.x + ox * 0.5 - oz * 0.25, t.z + oz * 0.5 + ox * 0.25, t.x + ox, t.z + oz);
        }
        g.stroke();
      } else {
        g.arc(t.x, t.z, r * 0.8, 0, TAU);
        g.fill();
        g.stroke();
      }
    }
  }

  drawGangs(g, px) {
    for (const t of this.gangs) {
      g.save();
      g.beginPath();
      g.arc(t.x, t.z, t.r, 0, TAU);
      g.fillStyle = 'rgba(226, 51, 95, 0.08)';
      g.fill();
      g.clip();
      g.strokeStyle = 'rgba(226, 51, 95, 0.32)';
      g.lineWidth = 1.4 * px;
      g.beginPath();
      for (let d = -t.r * 2; d < t.r * 2; d += 5) {
        g.moveTo(t.x + d - t.r, t.z - t.r);
        g.lineTo(t.x + d + t.r, t.z + t.r);
      }
      g.stroke();
      g.restore();
      g.strokeStyle = 'rgba(226, 51, 95, 0.75)';
      g.lineWidth = 1.6 * px;
      g.setLineDash([6 * px, 4 * px]);
      g.beginPath();
      g.arc(t.x, t.z, t.r, 0, TAU);
      g.stroke();
      g.setLineDash([]);
    }
  }

  // the way to the destination, in a highlighter's pink over an ink line; dots where it is on foot
  drawRoute(g, px) {
    const gps = this.game.gps;
    const r = gps && gps.target ? gps.route : null;
    if (!r) return;
    const pts = r.pts;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokeStyle = COL.ink;
    g.lineWidth = Math.max(9 * px, 2.2);
    g.stroke();
    g.strokeStyle = '#ff4fa3';
    g.lineWidth = Math.max(5.6 * px, 1.4);
    g.stroke();
    g.setLineDash([0.1, 9 * px]);
    g.strokeStyle = '#ff4fa3';
    g.lineWidth = 5 * px;
    g.beginPath();
    if (r.lead > 2) {
      g.moveTo(r.from[0], r.from[1]);
      g.lineTo(pts[0][0], pts[0][1]);
    }
    if (r.tail > 2) {
      const e = pts[pts.length - 1];
      g.moveTo(e[0], e[1]);
      g.lineTo(r.to[0], r.to[1]);
    }
    g.stroke();
    g.setLineDash([]);
  }

  clearTarget() {
    this.game.gps.clear();
    this.updateHead();
    this.dirty();
  }

  // ------------------------------------------------------------------ the writing on the map
  text(g, s, x, y, o = {}) {
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    g.font = o.font;
    g.textAlign = o.align || 'center';
    g.textBaseline = 'middle';
    g.direction = o.dir || 'rtl';
    if (o.halo !== 0) {
      g.lineJoin = 'round';
      g.lineWidth = o.halo || 4;
      g.strokeStyle = o.haloCol || COL.paper;
      g.strokeText(s, 0, 0);
    }
    g.fillStyle = o.color || COL.ink;
    g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    g.fillText(s, 0, 0);
    g.restore();
  }

  // the biggest size (up to size0) at which a name fits in maxW: on one line, or on two
  fitText(g, name, maxW, size0, minSize, family) {
    g.font = `${size0}px ${family}`;
    const s1 = Math.min(size0, (size0 * maxW) / g.measureText(name).width);
    const sp = name.lastIndexOf(' ');
    if (s1 >= size0 * 0.8 || sp < 0) return { lines: [name], size: Math.max(minSize, s1) };
    const lines = [name.slice(0, sp), name.slice(sp + 1)];
    const w2 = Math.max(g.measureText(lines[0]).width, g.measureText(lines[1]).width);
    const s2 = Math.min(size0, (size0 * maxW) / w2);
    return s2 > s1 * 1.15 ? { lines, size: Math.max(minSize, s2) } : { lines: [name], size: Math.max(minSize, s1) };
  }

  drawLabels(g) {
    const k = this.view.k;
    const W = this.W;
    const H = this.H;
    const on = (x, y, m = 80) => x > -m && x < W + m && y > -m && y < H + m;
    const hand = '"Gveret Levin", "Rubik", sans-serif';
    // the water
    const bay = clamp(14 + k * 7, 20, 44);
    for (const z of [-260, 60]) {
      const x = this.sx(Math.min(110, (WATER_X + MAP.x1) / 2));
      const y = this.sy(z);
      if (on(x, y, 200)) this.text(g, 'מפרץ השקיעה', x, y, { font: `${bay}px ${hand}`, color: '#3b5fb3', haloCol: COL.water, halo: 5, alpha: 0.9 });
    }
    {
      const x = this.sx(-110);
      const y = this.sy(SHORE_Z + 40);
      if (on(x, y, 200)) this.text(g, 'הים', x, y, { font: `${bay}px ${hand}`, color: '#3b5fb3', haloCol: COL.water, halo: 5, alpha: 0.9 });
    }
    // the streets' names, along them
    const st = clamp(9 + k * 1.6, 11, 15);
    const font = `600 ${st}px Rubik, sans-serif`;
    const both = k > 4.2;
    const rows = k < 2.1 ? [1, 3] : [0, 1, 2, 3, 4];
    for (const a of AVES) {
      if (k < 1.3 || a.half * 2 * k < st + 2) continue;
      const name = both ? `${a.name} · ${a.sign}` : a.name;
      for (const j of rows) {
        const zm = (STREETS[j].z + STREETS[j + 1].z) / 2 + (a.blvd ? 34 : 0);
        const x = this.sx(a.x + (a.blvd ? 0 : 0));
        const y = this.sy(zm);
        if (on(x, y, 120)) this.text(g, name, x, y, { font, rot: -Math.PI / 2, haloCol: COL.road, halo: 3.5, color: '#3d3358' });
      }
    }
    const cols = k < 2.1 ? [1] : [0, 1, 2, 3];
    for (const s of STREETS) {
      if (k < 1.3 || s.half * 2 * k < st + 2) continue;
      const name = both ? `${s.name} · ${s.sign}` : s.name;
      for (const c of cols) {
        const xa = c === 0 ? WEST_EDGE : AVES[c - 1].x;
        const xb = AVES[c].x;
        const x = this.sx((xa + xb) / 2 + (c === 0 ? 4 : 0));
        const y = this.sy(s.z);
        if (on(x, y, 120)) this.text(g, name, x, y, { font, haloCol: COL.road, halo: 3.5, color: '#3d3358' });
      }
    }
    // the districts, written big across their blocks (on two lines when the block is narrow)
    const fade = k > 5 ? 0.45 : 0.92;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const r = blockRect(col, row);
        const type = BLOCK_TYPES[row][col];
        const name = DISTRICT_NAMES[type];
        const bw = (r.x1 - r.x0) * k;
        const x = this.sx((r.x0 + r.x1) / 2);
        const y = this.sy((r.z0 + r.z1) / 2);
        if (!on(x, y, 150) || k < 0.75) continue;
        const fit = this.fitText(g, name, bw * 0.9, clamp(bw * 0.3, 14, 36), 11, hand);
        const n = fit.lines.length;
        fit.lines.forEach((line, i) => this.text(g, line, x, y + (i - (n - 1) / 2) * fit.size * 0.95, { font: `${fit.size}px ${hand}`, halo: 4.5, alpha: fade }));
      }
    }
    // the houses west of Coral Ave, the promenade, the pier, the beach, the bridge
    const side = clamp(10 + k * 4, 14, 28);
    for (const row of k < 0.75 ? [] : k < 2.1 ? [1, 3] : [0, 1, 2, 3, 4]) {
      const r = westRect(row);
      const x = this.sx((r.x0 + r.x1) / 2);
      const y = this.sy((r.z0 + r.z1) / 2);
      if (on(x, y, 150)) this.text(g, DISTRICT_NAMES.west, x, y, { font: `${side}px ${hand}`, rot: -Math.PI / 2, halo: 5, alpha: fade });
    }
    for (const z of k < 0.75 ? [] : k < 2.1 ? [-120] : [-300, -120, 60, 220]) {
      const x = this.sx((STREET_X1 + PROM_X1) / 2);
      const y = this.sy(z);
      if (on(x, y, 150)) this.text(g, 'הטיילת', x, y, { font: `${side}px ${hand}`, rot: -Math.PI / 2, halo: 5, alpha: fade });
    }
    {
      const x = this.sx((PIER.x0 + PIER.x1) / 2 + 22);
      const y = this.sy(PIER.z1 + 10);
      if (on(x, y, 150)) this.text(g, 'המזח', x, y, { font: `${side}px ${hand}`, halo: 5, haloCol: COL.water });
      const bx = this.sx(Math.min(140, (this.vis.x1 + WATER_X) / 2));
      const by = this.sy(-430 - 14);
      if (on(bx, by, 150)) this.text(g, 'גשר המפרץ', bx, by, { font: `${side}px ${hand}`, halo: 5, haloCol: COL.water });
      const cx = this.sx(-110);
      const cy = this.sy(SOUTH_EDGE + 20);
      if (on(cx, cy, 150) && k > 1.2) this.text(g, 'החוף', cx + 70, cy, { font: `${side}px ${hand}`, halo: 5, haloCol: COL.sand });
    }
  }

  // ------------------------------------------------------------------ the stickers
  drawStickers(g) {
    const k = this.view.k;
    const W = this.W;
    const H = this.H;
    const placed = [];
    // (smaller stickers when the whole city is on the screen)
    const R = clamp(5.5 + k * 4.5, 7, this.game.touch ? 12 : 11);
    const gap = R * 1.75;
    for (const it of this.items) {
      if (this.off.has(it.cat)) continue;
      const cat = CAT[it.cat];
      if (k < cat.k) continue;
      const x = this.sx(it.x);
      const y = this.sy(it.z);
      if (x < -R || y < -R || x > W + R || y > H + R) continue;
      let free = true;
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i];
        if ((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < gap * gap) {
          free = false;
          break;
        }
      }
      if (!free) continue;
      placed.push({ x, y, it, r: R });
    }
    this.placed = placed;
    // the names of the shops and the boards, once there is room for them
    const names = [];
    if (k > 4.4) {
      for (const p of placed) {
        const it = p.it;
        if (!it.name || it.cat === 'hide' || it.cat === 'bus') continue;
        const latin = /^[\x20-\x7e]+$/.test(it.name);
        const font = latin ? '700 16px Caveat, sans-serif' : '600 13px Rubik, sans-serif';
        g.font = font;
        const w = g.measureText(it.name).width;
        const box = { x0: p.x - w / 2 - 3, x1: p.x + w / 2 + 3, y0: p.y + R + 1, y1: p.y + R + 17 };
        let free = true;
        for (const b of names) if (box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0) free = false;
        for (const q of placed) if (q !== p && Math.abs(q.x - p.x) < w / 2 + R && q.y > box.y0 - R && q.y < box.y1 + R) free = false;
        if (!free) continue;
        names.push(box);
        this.text(g, it.name, p.x, p.y + R + 9, { font, dir: latin ? 'ltr' : 'rtl', halo: 3.5 });
      }
    }
    // (the less important under the more important)
    for (let i = placed.length - 1; i >= 0; i--) {
      const p = placed[i];
      const it = p.it;
      const cat = CAT[it.cat];
      const sel = this.sel === it || this.hover === it;
      const shut = it.hours && !this.isOpen(it);
      if (shut) g.globalAlpha = 0.55;
      sticker(g, p.x, p.y, it.glyph, cat.fill, R, { square: cat.square, dashed: cat.dashed, ring: sel });
      g.globalAlpha = 1;
      // a board already photographed: a tick in its corner
      if (it.bp && this.game.album.items && this.game.album.items.has(it.bp.id)) {
        g.fillStyle = '#3fbf6a';
        g.strokeStyle = COL.ink;
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(p.x + R * 0.8, p.y - R * 0.8, 5, 0, TAU);
        g.fill();
        g.stroke();
        g.strokeStyle = '#fffbf3';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(p.x + R * 0.8 - 2.4, p.y - R * 0.8);
        g.lineTo(p.x + R * 0.8 - 0.6, p.y - R * 0.8 + 1.8);
        g.lineTo(p.x + R * 0.8 + 2.4, p.y - R * 0.8 - 1.8);
        g.stroke();
      }
    }
  }

  isOpen(it) {
    const dn = this.game.daynight;
    return shopOpen(it.hours, dn ? dn.hour : 18.3);
  }

  drawMoving(g) {
    const game = this.game;
    const k = this.view.k;
    // the police, while they look for you
    if (game.police && game.police.level > 0) {
      for (const c of game.traffic.list) {
        if (!c.police || c.wrecked) continue;
        const x = this.sx(c.pos.x);
        const y = this.sy(c.pos.z);
        g.fillStyle = '#e2335f';
        g.strokeStyle = COL.ink;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x - 3, y, 4.2, 0, TAU);
        g.fill();
        g.stroke();
        g.fillStyle = '#3a6ad6';
        g.beginPath();
        g.arc(x + 3, y, 4.2, 0, TAU);
        g.fill();
        g.stroke();
      }
    }
    // your vehicles, where you left them
    const mine = game.player.inVehicle;
    const R = clamp(5.5 + k * 4.5, 7, game.touch ? 12 : 11);
    for (const v of game.vehicles.list) {
      if (v === mine) continue;
      const x = this.sx(v.pos.x);
      const y = this.sy(v.pos.z);
      if (x < -R || y < -R || x > this.W + R || y > this.H + R) continue;
      sticker(g, x, y, 'car', '#cfe0ff', R, { ring: this.hover === v || this.sel === v });
      this.placed.unshift({ x, y, it: { vehicle: v, cat: 'vehicle', name: VEHICLE_NAME[v.kind] || 'כלי הרכב שלכם' }, r: R });
    }
    // the destination: a pin (it can be pointed at like a sticker)
    const tg = game.gps && game.gps.target;
    if (tg) {
      const x = this.sx(tg.x);
      const y = this.sy(tg.z);
      pin(g, x, y, 1);
      this.placed.unshift({ x, y: y - 23, it: { waypoint: true, cat: 'waypoint', name: tg.name || 'היעד שלכם', x: tg.x, z: tg.z }, r: 13 });
    }
    // you: an arrow the way you face
    const p = this.playerPos();
    const x = this.sx(p.x);
    const y = this.sy(p.z);
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI - p.yaw);
    const s = clamp(0.9 + k * 0.05, 0.95, 1.25);
    g.scale(s, s);
    g.fillStyle = 'rgba(27, 20, 48, 0.85)';
    g.beginPath();
    g.moveTo(1.5, -10);
    g.lineTo(9.5, 11);
    g.lineTo(1.5, 6);
    g.lineTo(-6.5, 11);
    g.closePath();
    g.fill();
    g.fillStyle = '#e2335f';
    g.strokeStyle = COL.ink;
    g.lineWidth = 2.2;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(0, -12);
    g.lineTo(8, 9);
    g.lineTo(0, 4);
    g.lineTo(-8, 9);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    const vis = x > 0 && y > 0 && x < this.W && y < this.H;
    this.me.style.display = vis ? '' : 'none';
    if (vis) this.me.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  drawScale(g) {
    // a scale bar and the north, in the corner
    const k = this.view.k;
    const want = 110 / k;
    const steps = [10, 20, 25, 50, 100, 200, 250, 500];
    let m = steps[steps.length - 1];
    for (const s of steps) {
      if (s >= want * 0.7) {
        m = s;
        break;
      }
    }
    const len = m * k;
    const x1 = this.W - 22;
    const x0 = x1 - len;
    const y = this.H - 26;
    g.fillStyle = 'rgba(246, 239, 224, 0.88)';
    g.fillRect(x0 - 10, y - 30, len + 22, 42);
    g.strokeStyle = COL.ink;
    g.lineWidth = 2;
    g.fillStyle = COL.ink;
    g.fillRect(x0, y - 3, len / 2, 6);
    g.strokeRect(x0, y - 3, len, 6);
    this.text(g, `${m} מ׳`, (x0 + x1) / 2, y - 15, { font: '600 13px Rubik, sans-serif', halo: 0 });
    // the north
    const nx = x1 - 6;
    const ny = y - 64;
    g.save();
    g.translate(nx, ny);
    g.fillStyle = '#e2335f';
    g.strokeStyle = COL.ink;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -16);
    g.lineTo(6, 4);
    g.lineTo(0, 0);
    g.lineTo(-6, 4);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    this.text(g, 'צ', nx, ny + 14, { font: '700 14px Rubik, sans-serif', halo: 3 });
  }

  // ------------------------------------------------------------------ pointing at the map
  hit(x, y) {
    let best = null;
    let bd = Infinity;
    for (const p of this.placed) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < p.r + 6 && d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  setHover(p) {
    const it = p ? p.it.vehicle || p.it : null;
    if (it === this.hover) return;
    this.hover = it;
    this.canvas.style.cursor = p ? 'pointer' : '';
    // (a card opened by a click stays until the next click)
    if (!this.sel) {
      if (p) this.showCard(p);
      else this.card.classList.add('hidden');
    }
    this.dirty();
  }

  showCard(p, pinned = false) {
    const it = p.it;
    const c = this.card;
    const pl = this.playerPos();
    const tx = it.vehicle ? it.vehicle.pos.x : it.x;
    const tz = it.vehicle ? it.vehicle.pos.z : it.z;
    const d = Math.hypot(tx - pl.x, tz - pl.z);
    const far = d < 15 ? 'ממש לידכם' : `${d < 1000 ? Math.round(d / 10) * 10 : (d / 1000).toFixed(1)} ${d < 1000 ? 'מ׳' : 'ק״מ'} מכם`;
    const rows = [];
    if (it.shop || it.hours) {
      const latin = it.name && /^[\x20-\x7e]+$/.test(it.name);
      rows.push(`<div class="t${latin ? ' en' : ''}" ${latin ? 'dir="ltr"' : ''}>${it.name || it.he}</div>`);
      if (it.name) rows.push(`<div class="s">${it.he}</div>`);
      const hrs = shopHours(it.hours);
      if (!hrs) rows.push('<div class="h open">פתוח 24 שעות</div>');
      else if (this.isOpen(it)) rows.push(`<div class="h open">פתוח עכשיו · עד ${hhmm(hrs[1])}</div>`);
      else rows.push(`<div class="h shut">סגור עכשיו · נפתח ב־${hhmm(hrs[0])}</div>`);
    } else if (it.bp) {
      rows.push(`<div class="t">${it.name}</div>`);
      rows.push('<div class="s">שלט שרטוט</div>');
      const got = this.game.album.items && this.game.album.items.has(it.bp.id);
      rows.push(got ? '<div class="h open">צילמתם אותו ✓</div>' : `<div class="h">עוד לא צולם · ${this.game.touch ? 'כפתור המצלמה' : 'F'} ליד השלט</div>`);
    } else if (it.waypoint) {
      rows.push(`<div class="t">${it.name}</div>`);
      rows.push('<div class="s">היעד שלכם</div>');
    } else {
      rows.push(`<div class="t">${it.name}</div>`);
      if (it.note) rows.push(`<div class="s">${it.note}</div>`);
    }
    rows.push(`<div class="d">${far}</div>`);
    if (pinned) {
      const tg = this.game.gps.target;
      const here = it.waypoint || (tg && Math.abs(tg.x - tx) < 0.5 && Math.abs(tg.z - tz) < 0.5);
      rows.push(here ? '<button class="card-btn" data-act="clear">✕ בלי יעד</button>' : '<button class="card-btn go" data-act="go">⚑ סמנו כיעד</button>');
    }
    c.innerHTML = rows.join('');
    c.classList.toggle('pinned', pinned);
    c.classList.remove('hidden');
    // beside the sticker, kept on the page
    const cw = c.offsetWidth;
    const ch = c.offsetHeight;
    let x = p.x + p.r + 10;
    if (x + cw > this.W - 10) x = p.x - p.r - 10 - cw;
    let y = p.y - ch / 2;
    y = clamp(y, 10, this.H - ch - 10);
    c.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  hideCard() {
    this.card.classList.add('hidden');
    this.card.classList.remove('pinned');
    if (this.sel || this.hover) {
      this.sel = null;
      this.hover = null;
      this.dirty();
    }
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  onDown(e) {
    const p = this.pos(e);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // (a pointer the browser does not know: the events still come)
    }
    this.pointers.set(e.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y, t: performance.now(), moved: false });
    this.anim = null;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const v = this.view;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.pinch = { d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), k: v.k, wx: (mx - this.W / 2) / v.k + v.cx, wz: (my - this.H / 2) / v.k + v.cz };
      for (const q of this.pointers.values()) q.moved = true;
      this.hideCard();
    }
  }

  onMove(e) {
    const p = this.pos(e);
    const q = this.pointers.get(e.pointerId);
    if (!q) {
      if (e.pointerType === 'mouse') this.setHover(this.hit(p.x, p.y));
      return;
    }
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    q.x = p.x;
    q.y = p.y;
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const v = this.view;
      v.k = clamp(this.pinch.k * (d / this.pinch.d), this.kMin(), K_MAX);
      v.cx = this.pinch.wx - (mx - this.W / 2) / v.k;
      v.cz = this.pinch.wz - (my - this.H / 2) / v.k;
      this.clampView(v);
      this.dirty();
      return;
    }
    if (!q.moved && Math.hypot(p.x - q.x0, p.y - q.y0) > 6) {
      q.moved = true;
      this.canvas.classList.add('dragging');
      this.hideCard();
    }
    if (q.moved) {
      const v = this.view;
      v.cx -= dx / v.k;
      v.cz -= dy / v.k;
      this.clampView(v);
      this.dirty();
    }
  }

  onUp(e, cancel = false) {
    const q = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (!this.pointers.size) this.canvas.classList.remove('dragging');
    if (!q || cancel || q.moved || this.pointers.size) return;
    const p = this.pos(e);
    const now = performance.now();
    // a mouse's click acts at once (it zooms with its wheel)
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.tap(p.x, p.y);
      return;
    }
    // a finger: a second tap at the same place comes closer (so a tap on the open map waits a
    // moment before it marks a destination: it may be the first of two)
    const last = this.lastTap;
    if (last && now - last.t < 320 && Math.hypot(last.x - p.x, last.y - p.y) < 24) {
      this.lastTap = null;
      clearTimeout(this.tapTimer);
      const v = this.view;
      const k = clamp(v.k * 2, this.kMin(), K_MAX);
      const wx = (p.x - this.W / 2) / v.k + v.cx;
      const wz = (p.y - this.H / 2) / v.k + v.cz;
      this.animateTo(this.clampView({ k, cx: wx - (p.x - this.W / 2) / k, cz: wz - (p.y - this.H / 2) / k }));
      return;
    }
    this.lastTap = { t: now, x: p.x, y: p.y };
    if (this.hit(p.x, p.y) || this.sel) this.tap(p.x, p.y);
    else {
      clearTimeout(this.tapTimer);
      this.tapTimer = setTimeout(() => {
        if (this.open) this.tap(p.x, p.y);
      }, 300);
    }
  }

  // a sticker: its card (with its place as a destination); the first click after a card only
  // closes it; anywhere else: the destination is there
  tap(x, y) {
    const p = this.hit(x, y);
    if (p) {
      this.sel = p.it.vehicle ? { ...p.it, x: p.it.vehicle.pos.x, z: p.it.vehicle.pos.z } : p.it;
      this.showCard(p, true);
      this.dirty();
      return;
    }
    if (this.sel) {
      this.hideCard();
      return;
    }
    const v = this.view;
    const wx = (x - this.W / 2) / v.k + v.cx;
    const wz = (y - this.H / 2) / v.k + v.cz;
    this.game.gps.set(wx, wz, null);
    this.updateHead();
    this.dirty();
  }

  onKey(e) {
    if (!this.open) return;
    const code = e.code;
    const input = this.game.input;
    // (the game's own keys wait while the map is open)
    const eat = () => {
      e.preventDefault();
      if (input && input.pressed) input.pressed.delete(code);
    };
    if (code === 'KeyM' || code === 'Escape') {
      eat();
      this.hide();
      return;
    }
    const v = this.view;
    const pan = 90 / v.k;
    if (code === 'Equal' || code === 'NumpadAdd') this.zoomBy(1.6);
    else if (code === 'Minus' || code === 'NumpadSubtract') this.zoomBy(1 / 1.6);
    else if (code === 'ArrowLeft' || code === 'KeyA') this.animateTo(this.clampView({ ...v, cx: v.cx - pan }), 160);
    else if (code === 'ArrowRight' || code === 'KeyD') this.animateTo(this.clampView({ ...v, cx: v.cx + pan }), 160);
    else if (code === 'ArrowUp' || code === 'KeyW') this.animateTo(this.clampView({ ...v, cz: v.cz - pan }), 160);
    else if (code === 'ArrowDown' || code === 'KeyS') this.animateTo(this.clampView({ ...v, cz: v.cz + pan }), 160);
    else if (code === 'Space' || code === 'KeyC') this.centreOnPlayer(true);
    else if (code === 'Delete' || code === 'Backspace') this.clearTarget();
    else return;
    eat();
  }
}

export { MAP as MAP_BOUNDS };
