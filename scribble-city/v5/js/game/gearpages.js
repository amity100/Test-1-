import { NODES } from '../world/roads.js';
import { groundHeight } from '../world/layout.js';

// (ROADMAP 11.28) The blueprint pages: hidden about the city, at the corners of its crossings - each one
// found opens the next thing of the pen (game/gearplay.js page). A page is a sheet of blue paper standing
// a little over the road, turning, a thing's drawing in white on it; the minimap shows the ones near you.
// Not in the lab as it is (everything open there) - only as a game plays it (?lab=1&prog=1).

const N_PAGES = 36;
const REACH = 3.6; // how near you come to take one (on foot or at the wheel)
const BLUE = [0.16, 0.36, 0.78];
const WHITE = [0.95, 0.97, 1];

// (a fixed shuffle: the same corners in every game)
function rnd(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the corners: of each crossing one, inside the crossing near its curb - where a car turning passes
function spotsOf() {
  const r = rnd(1128);
  const nodes = NODES.filter((n) => n.ave && n.street && n.ave.half && n.street.half);
  for (let i = nodes.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
  }
  return nodes.slice(0, N_PAGES).map((n, i) => {
    const sx = r() < 0.5 ? -1 : 1;
    const sz = r() < 0.5 ? -1 : 1;
    const x = n.x + sx * (n.ave.half - 1.8);
    const z = n.z + sz * (n.street.half - 1.8);
    return { id: i, x, z, y: groundHeight(x, z) * 0.5, seed: 9900 + i * 17 };
  });
}

export class GearPages {
  constructor(G) {
    this.G = G;
    this.game = G.game;
    this.spots = spotsOf();
  }

  get on() {
    return !this.G.play.all();
  }

  left() {
    const F = this.G.play.state.found;
    return this.spots.filter((s) => !F.includes(s.id));
  }

  update() {
    if (!this.on) return;
    const g = this.game;
    const p = g.player;
    const at = p.inVehicle ? p.inVehicle.pos : p.pos;
    const P = this.G.play;
    for (const s of this.spots) {
      if (Math.abs(s.x - at.x) > REACH + 2 || Math.abs(s.z - at.z) > REACH + 2) continue;
      if (P.state.found.includes(s.id) || Math.hypot(s.x - at.x, s.z - at.z) > REACH) continue;
      P.state.found.push(s.id);
      g.fx.sparks(s.x, s.y + 1.2, s.z, 18, [0.6, 0.8, 1]);
      g.fx.crumbs(s.x, s.y + 1.2, s.z, 10, 2);
      P.page(`נמצא דף ${P.state.found.length} מתוך ${this.spots.length}`);
    }
  }

  // each page within sight: blue paper turning over the road, its drawing in white, a light down to it
  draw(fr) {
    if (!this.on) return;
    const g = this.game;
    const cam = g.camera.position;
    const t = g.time;
    const F = this.G.play.state.found;
    for (const s of this.spots) {
      const d = Math.hypot(s.x - cam.x, s.z - cam.z);
      if (d > 160 || F.includes(s.id)) continue;
      const yaw = t * 1.3 + s.id;
      const y = s.y + 1.25 + Math.sin(t * 2 + s.id) * 0.12;
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      const P = (u, v) => [s.x + u * c, y + v, s.z - u * sn];
      const W = 0.42;
      const H = 0.56;
      const q = [P(-W, -H), P(W, -H), P(W, H), P(-W, H)];
      for (let i = 0; i < 4; i++) {
        const a = q[i];
        const b = q[(i + 1) % 4];
        fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], BLUE, 6, s.seed + i, 1, 0.004, 0);
      }
      // the paper filled in blue (lines across it), the drawing on it in white: a gear wheel and a line
      for (let k = 1; k < 6; k++) {
        const v = -H + (2 * H * k) / 6;
        const a = P(-W, v);
        const b = P(W, v);
        fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], BLUE, 9, s.seed + 10 + k, 0.85, 0.004, 0);
      }
      let pr = null;
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const r = k % 2 ? 0.16 : 0.22;
        const pt = P(Math.cos(a) * r, 0.1 + Math.sin(a) * r);
        if (pr) fr.lineXYZ(pr[0], pr[1], pr[2], pt[0], pt[1], pt[2], WHITE, 2, s.seed + 20 + k, 1, 0.004, 0);
        pr = pt;
      }
      const l0 = P(-W * 0.7, -H * 0.6);
      const l1 = P(W * 0.7, -H * 0.6);
      fr.lineXYZ(l0[0], l0[1], l0[2], l1[0], l1[1], l1[2], WHITE, 2, s.seed + 40, 1, 0.004, 0);
      // (seen from further: a light down onto it)
      if (d > 12) fr.lineXYZ(s.x, y + H + 0.2, s.z, s.x, y + 9, s.z, [0.45, 0.7, 1], 3, s.seed + 50, 0.45, 0.004, 0);
    }
  }

  // (ui/hud.js) the minimap: the pages near you, little blue sheets
  mini(g, p, s) {
    if (!this.on) return;
    const F = this.G.play.state.found;
    for (const q of this.spots) {
      if (F.includes(q.id) || Math.abs(q.x - p.x) > 70 || Math.abs(q.z - p.z) > 70) continue;
      g.save();
      g.translate(q.x - p.x, q.z - p.z);
      g.fillStyle = '#2f62d0';
      g.strokeStyle = '#f2f6ff';
      g.lineWidth = 1.5 / s;
      g.fillRect(-3.5 / s, -4.5 / s, 7 / s, 9 / s);
      g.strokeRect(-3.5 / s, -4.5 / s, 7 / s, 9 / s);
      g.restore();
    }
  }
}
