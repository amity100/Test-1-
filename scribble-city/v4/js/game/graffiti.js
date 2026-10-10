import * as THREE from 'three';
import { groundHeight } from '../world/layout.js';

// (ROADMAP 9.3, not with ?classic) Graffiti. Standing in front of a wall, G (or "גרפיטי" in the
// phone) opens a sheet (ui/sketchpad.js) with the spray cans' colours; what is drawn on it goes
// up on the wall in front of you, three metres wide, and stays there - in the save too, the last
// two dozen. The city notices: painting a gang's wall in its turf brings it to have a look, and
// the police, if they see it, call it vandalism.

export const SPRAY = [
  { css: '#1b1622', c: [0.06, 0.05, 0.08], name: 'שחור', px: 10 },
  { css: '#ffffff', c: [0.98, 0.98, 0.96], name: 'לבן', px: 10 },
  { css: '#e8333d', c: [0.95, 0.18, 0.22], name: 'אדום', px: 10 },
  { css: '#ffd23f', c: [1.0, 0.84, 0.22], name: 'צהוב', px: 10 },
  { css: '#33d6ff', c: [0.25, 0.85, 1.0], name: 'תכלת', px: 10 },
  { css: '#4ee06a', c: [0.32, 0.9, 0.42], name: 'ירוק', px: 10 },
  { css: '#ff7cc8', c: [1.0, 0.48, 0.78], name: 'ורוד', px: 10 },
  { css: '#a35cff', c: [0.62, 0.36, 1.0], name: 'סגול', px: 10 },
];
const W = 3; // metres across on the wall
const H = 1.4; // ...and up
const MAX = 24;
const REACH = 2.8;
const WALLS = new Set(['wall', 'roomwall']);

export class Graffiti {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.stats = { painted: 0 };
  }

  // the wall in front of you (a building's, tall enough): where, and which way it faces
  wallAhead() {
    const g = this.game;
    const P = g.player;
    if (P.inVehicle || P.mode !== 'foot') return null;
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    const y = P.pos.y + 1.3;
    const h = g.world.collision.raycast(P.pos.x, y, P.pos.z, fx, 0, fz, REACH);
    if (!h || !h.box || !WALLS.has(h.box.tag) || h.box.y1 - h.box.y0 < 2.4 || Math.abs(h.ny) > 0.5) return null;
    return { x: h.x, z: h.z, nx: h.nx, nz: h.nz, y0: Math.max(groundHeight(h.x - h.nx * 0.5, h.z - h.nz * 0.5), h.box.y0) };
  }

  // done(): when the sheet is closed (painted or not)
  start(done = null) {
    const g = this.game;
    const w = this.wallAhead();
    if (!w) {
      g.hud.toast(g.touch ? 'עומדים מול קיר של בניין, ואז גרפיטי בטלפון' : 'עומדים מול קיר של בניין, ואז G — גרפיטי', 'info', 2.6);
      return false;
    }
    g.sketchpad.show({
      title: 'גרפיטי',
      hint: 'מה שמציירים כאן עולה על הקיר שמולכם, בגודל אמיתי',
      done: 'לרסס על הקיר!',
      aspect: W / H,
      pens: SPRAY,
      bg: (c, cw, ch) => {
        // the wall: plaster and a few bricks showing through
        c.fillStyle = '#e9ddd0';
        c.fillRect(0, 0, cw, ch);
        c.strokeStyle = 'rgba(150, 110, 90, 0.18)';
        c.lineWidth = 2;
        for (let y = 0; y < ch; y += 36) {
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(cw, y);
          c.stroke();
          for (let x = (y / 36) % 2 ? 0 : 40; x < cw; x += 80) {
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x, y + 36);
            c.stroke();
          }
        }
      },
    }, (strokes) => {
      if (done) done();
      if (strokes) this.paint(w, strokes);
    });
    return true;
  }

  // the sheet's strokes up on the wall: u along it (left to right as you face it), v up from a
  // hand's height over the sidewalk; a finger off the wall
  paint(w, strokes) {
    const g = this.game;
    const rx = w.nz;
    const rz = -w.nx;
    const cx = w.x + w.nx * 0.03;
    const cz = w.z + w.nz * 0.03;
    const y0 = w.y0 + 0.5;
    const lines = strokes.map((s) => {
      const p = [];
      for (const [u, v] of s.pts) p.push(cx + rx * (u - 0.5) * W, y0 + v * H, cz + rz * (u - 0.5) * W);
      return { pen: s.pen, p };
    });
    this.list.push({ x: cx, z: cz, lines, seed: (this.stats.painted * 97) % 1000 });
    while (this.list.length > MAX) this.list.shift();
    this.stats.painted++;
    g.audio.play('paint', 0.8);
    g.hud.toast('גרפיטי על הקיר!', 'good', 2);
    // (whose wall is it)
    const pos = new THREE.Vector3(cx, 1, cz);
    const turf = (g.gangs ? g.gangs.turfs : []).find((t) => Math.hypot(t.x - cx, t.z - cz) < (t.r || 40));
    if (turf && g.enemies) g.enemies.noise(pos, 35, 'shot');
    if (g.onCrime) g.onCrime('vandal', cx, cz);
  }

  draw(fr) {
    const cam = this.game.camera.position;
    for (const gr of this.list) {
      const d = Math.hypot(gr.x - cam.x, gr.z - cam.z);
      if (d > 90) continue;
      const wd = Math.max(1.6, Math.min(13, 260 / Math.max(1, d)));
      let seed = gr.seed;
      for (const L of gr.lines) {
        const c = SPRAY[L.pen] ? SPRAY[L.pen].c : SPRAY[0].c;
        const p = L.p;
        for (let i = 3; i < p.length; i += 3) fr.lineXYZ(p[i - 3], p[i - 2], p[i - 1], p[i], p[i + 1], p[i + 2], c, wd, seed++, 0.95, 0.002, 0);
      }
    }
  }

  // ------------------------------------------------------------------ the save (game/save.js)
  save() {
    return this.list.map((gr) => ({ x: +gr.x.toFixed(2), z: +gr.z.toFixed(2), seed: gr.seed, lines: gr.lines.map((L) => ({ pen: L.pen, p: L.p.map((v) => Math.round(v * 100) / 100) })) }));
  }

  load(s) {
    if (!Array.isArray(s)) return;
    this.list = s.filter((gr) => gr && Array.isArray(gr.lines)).slice(-MAX).map((gr) => ({ x: gr.x, z: gr.z, seed: gr.seed || 0, lines: gr.lines.filter((L) => L && Array.isArray(L.p) && L.p.length >= 6).map((L) => ({ pen: L.pen | 0, p: L.p })) }));
  }
}
