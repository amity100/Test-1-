import * as THREE from 'three';
import { Kit, itemMats, linC } from '../items.js';
import { surfaceVariant } from '../../render/materials.js';
import { clamp } from '../../core/util.js';

// (v5, ROADMAP 18) The first drawing: a ramp off the roof.
//
// Time all but stops, and the drawing is the player's - in the game's own picture, from behind the
// car, the way every drawing in the game is drawn: on the screen, over the world. A faint dotted line
// shows the way, from the car's nose down the roof to its edge; whatever is drawn over it (a line,
// roughly that way: it is the first drawing of the game, and it is forgiving) is laid onto the roof
// where it was drawn. Let go of, the line settles into the world - onto the ramp's own spine - and
// grows: the deck plates one after another along it, the columns up from the roof under them, the
// girders, the braces, the rails, the hazard stripes at the lip, the hatching - white as the paper,
// all of it, until the colour sweeps along it from the car to the lip and it is a real thing, made of
// steel, strong enough to take a car at speed. The car then flies off it (Jump, below) on a line that
// lands it on the other roof.

const UP = new THREE.Vector3(0, 1, 0);
// (the kick plate at its start, from the roof up onto the deck: how long)
const KICK = 1.4;

// (a frame: where the roof run does not go along -x - 5th Street Garage's goes south, +z - the
// drawing, the ramp and the jump are worked out along -x all the same, in the run's own frame:
// toLocal(x, z) gives its [x, z], toWorld(lx, lz) the world's, rotY the turn that puts what is built
// in it back in the world. game/prologue/carpark.js PARK.runFrame. None: the world's own)
const NOFRAME = { toLocal: (x, z) => [x, z], toWorld: (x, z) => [x, z], rotY: 0 };

export class RampDraw {
  // ui: game/prologue/ui.js; spec: { camera, roofY, laneZ, carX, edgeX, frame, floorY } - drawn from
  // where the player is, the game's own camera behind the car, the way every ramp in the game is
  // drawn: a line on the ground, from where it starts to where it goes (game/gadgets.js fromLine).
  // laneZ, carX, edgeX in the frame's terms; floorY(x, z): the roof's own height in the world there
  // (a roof run that still slopes up near the car), roofY where it gives none
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.on = false;
    this.pts = [];
    this.fails = 0;
  }

  open(spec, done) {
    this.spec = spec;
    this.F = spec.frame || NOFRAME;
    this.floorY = (x, z) => {
      const h = spec.floorY ? spec.floorY(x, z) : spec.roofY;
      return Number.isFinite(h) ? h : spec.roofY;
    };
    this.done = done;
    this.on = true;
    this.pts = [];
    const el = this.ui.drawEl;
    const cv = el.querySelector('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
    this.cv = cv;
    this.g = cv.getContext('2d');
    this.dpr = dpr;
    el.classList.add('on');
    // (the mouse let go of the game's camera: it draws now - game/game.js keeps it free while the
    // sheet is up, and does not take it for the pause)
    if (!this.game.touch) this.game.input.releaseLock();
    this.ui.hint('Draw a ramp to jump across<small>① לחצו על הנקודה ליד המכונית ② גררו קו לאורך הגג עד הקצה ③ עזבו</small>');
    this.t = 0;
    this.drawing = false;
    const P = (e) => [e.clientX * dpr, e.clientY * dpr];
    this.onDown = (e) => {
      if (!this.on) return;
      e.preventDefault();
      this.drawing = true;
      this.pts = [P(e)];
      try {
        el.setPointerCapture(e.pointerId);
      } catch (er) {
        // (not everywhere)
      }
      this.game.audio.play('scribble', 0.35);
    };
    this.onMove = (e) => {
      if (!this.drawing) return;
      const p = P(e);
      const l = this.pts[this.pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 3 * dpr) this.pts.push(p);
    };
    this.onUp = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.finish();
    };
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
  }

  close() {
    const el = this.ui.drawEl;
    el.classList.remove('on');
    if (!this.settle) this.g.clearRect(0, 0, this.cv.width, this.cv.height);
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    this.ui.hint(null);
    this.on = false;
    // (when: the mouse is asked back for the camera as it closes - a lock that comes late, or not at
    // all, is no reason to pause; game/game.js)
    this.shutAt = performance.now();
  }

  // a world point on the screen (canvas pixels); null behind the camera
  toScreen(x, y, z, out = [0, 0]) {
    const v = new THREE.Vector3(x, y, z).project(this.spec.camera);
    if (v.z > 1) return null;
    out[0] = ((v.x + 1) / 2) * this.cv.width;
    out[1] = ((1 - v.y) / 2) * this.cv.height;
    return out;
  }

  // a screen point down onto the roof (the plane it is drawn on: the roof's own, and on out over its
  // edge - the line can run on past it, into the air over the street)
  toWorld(px, py) {
    const cam = this.spec.camera;
    const nx = (px / this.cv.width) * 2 - 1;
    const ny = 1 - (py / this.cv.height) * 2;
    const p = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
    const o = cam.position;
    const d = p.sub(o).normalize();
    if (d.y > -1e-3) return null;
    // (onto the roof as it is there: the plane at its top first, then the floor's own height where
    // that falls, a few times over - a slope's)
    let y = this.spec.roofY;
    let t = (y - o.y) / d.y;
    for (let i = 0; i < 4 && t > 0; i++) {
      y = this.floorY(o.x + d.x * t, o.z + d.z * t);
      t = (y - o.y) / d.y;
    }
    if (t < 0 || t > 160) return null;
    return new THREE.Vector3(o.x + d.x * t, y, o.z + d.z * t);
  }

  // the way shown, dotted on the roof: from the car's nose to the edge (worked out every frame from
  // where the camera is)
  guideCurve() {
    const s = this.spec;
    const pts = [];
    const x0 = s.carX - 3.4;
    const x1 = s.edgeX - 0.8;
    for (let i = 0; i <= 28; i++) {
      const x = x0 + ((x1 - x0) * i) / 28;
      const [wx, wz] = this.F.toWorld(x, s.laneZ);
      const q = this.toScreen(wx, this.floorY(wx, wz) + 0.04, wz, [0, 0]);
      if (q) pts.push(q);
    }
    return pts;
  }

  finish() {
    const P = this.pts;
    let len = 0;
    for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    // (on the roof in the world; then in the run's own frame, where the ramp is worked out)
    const W = P.map(([x, y]) => this.toWorld(x, y))
      .filter(Boolean)
      .map((p) => {
        const [lx, lz] = this.F.toLocal(p.x, p.z);
        return new THREE.Vector3(lx, p.y, lz);
      });
    const xs = W.map((p) => p.x);
    const ext = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    if (len < 60 * this.dpr || W.length < 3 || ext < 3) {
      // (too short to be a ramp, or not on the roof: again, with the way shown plainer)
      this.fails++;
      this.pts = [];
      this.ui.hint('Draw a ramp to jump across<small>קו ארוך יותר: מהנקודה ליד המכונית, לאורך הגג, עד הקצה</small>');
      this.game.audio.play('meh', 0.4);
      return;
    }
    // how much the line bows up on the screen from its chord: a kick to the ramp's curve
    const a = P[0];
    const b = P[P.length - 1];
    const cl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let bow = 0;
    for (const q of P) {
      const cross = ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / cl;
      bow = Math.max(bow, Math.abs(cross));
    }
    const prof = fitProfile(W, this.spec, bow / cl);
    prof.frame = this.spec.frame || null;
    // (the line stays where it was drawn until the ramp's own line is there to settle onto)
    this.settle = { from: resample(P, 40), to3: null, t: 0 };
    this.ui.drawEl.classList.add('settle');
    this.close();
    // (and the mouse back to the camera, on this same click)
    if (!this.game.touch) this.game.input.requestLock(true);
    this.done(prof, P.map((p) => [p[0] / this.dpr, p[1] / this.dpr]));
  }

  // the line let go of settles into the world: onto the ramp's own spine (P3: its points, from the
  // car's end to the lip), wherever that is in the picture as the camera moves - then the ink there
  // has it, and the line on the screen fades
  settleTo(P3) {
    const S = this.settle;
    if (!S) return;
    const n = S.from.length;
    const to3 = [];
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * (P3.length - 1);
      const a = P3[Math.floor(u)];
      const b = P3[Math.min(P3.length - 1, Math.floor(u) + 1)];
      to3.push(a.clone().lerp(b, u - Math.floor(u)));
    }
    // (drawn from the edge back to the car: the same way round)
    const q0 = this.toScreen(to3[0].x, to3[0].y, to3[0].z);
    const q1 = this.toScreen(to3[n - 1].x, to3[n - 1].y, to3[n - 1].z);
    if (q0 && q1) {
      const f = S.from;
      const same = Math.hypot(f[0][0] - q0[0], f[0][1] - q0[1]) + Math.hypot(f[n - 1][0] - q1[0], f[n - 1][1] - q1[1]);
      const flip = Math.hypot(f[0][0] - q1[0], f[0][1] - q1[1]) + Math.hypot(f[n - 1][0] - q0[0], f[n - 1][1] - q0[1]);
      if (flip < same) to3.reverse();
    }
    S.to3 = to3;
    S.t = 0;
  }

  ink(pts, alpha = 1) {
    const g = this.g;
    const d = this.dpr;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalAlpha = alpha;
    for (const [w, col] of [[11, 'rgba(255, 252, 244, 0.85)'], [6.5, '#1c1830']]) {
      g.strokeStyle = col;
      g.lineWidth = w * d;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // every frame while it is open: the guide breathing, the line as it is drawn - in the ink the
  // game draws with, a pale edge round it so it shows over anything
  frame(dt) {
    const g = this.g;
    const W = this.cv.width;
    const H = this.cv.height;
    if (!this.on) {
      const S = this.settle;
      if (!S) return;
      g.clearRect(0, 0, W, H);
      S.t += dt;
      if (!S.to3) {
        this.ink(S.from);
        return;
      }
      const k = Math.min(1, S.t / 0.42);
      const e = 1 - Math.pow(1 - k, 3);
      const fade = S.t < 0.5 ? 1 : 1 - (S.t - 0.5) / 0.35;
      if (fade <= 0) {
        this.settle = null;
        this.ui.drawEl.classList.remove('settle');
        return;
      }
      const q = [0, 0];
      const pts = S.from.map((p, i) => {
        const w = S.to3[i];
        const s = this.toScreen(w.x, w.y, w.z, q);
        return s ? [p[0] + (s[0] - p[0]) * e, p[1] + (s[1] - p[1]) * e] : p;
      });
      this.ink(pts, fade);
      return;
    }
    this.t += dt;
    const d = this.dpr;
    g.clearRect(0, 0, W, H);
    this.guide = this.guideCurve();
    const a = 0.45 + 0.35 * Math.sin(this.t * 4);
    if (this.guide.length > 3) {
      g.save();
      g.setLineDash([12 * d, 12 * d]);
      g.lineDashOffset = -this.t * 46 * d;
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = 5 * d;
      g.lineCap = 'round';
      g.beginPath();
      this.guide.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.restore();
      // its arrowhead at the edge
      const n = this.guide.length;
      const [ex, ey] = this.guide[n - 1];
      const [px, py] = this.guide[n - 3];
      const ang = Math.atan2(ey - py, ex - px);
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath();
      g.moveTo(ex + Math.cos(ang) * 18 * d, ey + Math.sin(ang) * 18 * d);
      g.lineTo(ex + Math.cos(ang + 2.5) * 15 * d, ey + Math.sin(ang + 2.5) * 15 * d);
      g.lineTo(ex + Math.cos(ang - 2.5) * 15 * d, ey + Math.sin(ang - 2.5) * 15 * d);
      g.fill();
      // (v5, ROADMAP 18) until a line is begun: what to do, shown - where to put the pen down (a
      // dot breathing there), where to take it (a ring at the edge), and a pen drawing it once,
      // slowly, over and over, its line fading after it
      if (!this.drawing && this.pts.length < 2) this.teach(g, d);
    }
    if (this.pts.length > 1) this.ink(this.pts);
  }

  teach(g, d) {
    const G = this.guide;
    const n = G.length;
    const [sx, sy] = G[0];
    const [ex, ey] = G[n - 1];
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
    // the start: here
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.arc(sx, sy, (9 + 3 * pulse) * d, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.55 * (1 - pulse);
    g.strokeStyle = '#ffd23f';
    g.lineWidth = 3 * d;
    g.beginPath();
    g.arc(sx, sy, (16 + 20 * pulse) * d, 0, Math.PI * 2);
    g.stroke();
    // the end: there
    g.globalAlpha = 0.8;
    g.strokeStyle = '#ff6fa8';
    g.lineWidth = 3.5 * d;
    g.beginPath();
    g.arc(ex, ey, (15 + 2 * pulse) * d, 0, Math.PI * 2);
    g.stroke();
    // the pen, drawing it: 1.6 s along, a moment to see it, again
    const T = 2.4;
    const u = Math.min(1, (this.t % T) / 1.6);
    const e = u * u * (3 - 2 * u);
    const k = Math.max(1, Math.floor(e * (n - 1)));
    const tail = G.slice(0, k + 1);
    const fade = this.t % T > 1.9 ? 1 - (this.t % T - 1.9) / 0.5 : 1;
    if (tail.length > 1) this.ink(tail, 0.55 * fade);
    const [px, py] = tail[tail.length - 1];
    // (a pencil, leaning as a hand holds one: its tip on the line)
    g.translate(px, py);
    g.rotate(-0.75);
    g.globalAlpha = 0.95 * fade;
    g.fillStyle = '#ffcf4a';
    g.fillRect(4 * d, -5 * d, 46 * d, 10 * d);
    g.fillStyle = '#f2a6b8';
    g.fillRect(50 * d, -5 * d, 9 * d, 10 * d);
    g.fillStyle = '#f3dcb4';
    g.beginPath();
    g.moveTo(4 * d, -5 * d);
    g.lineTo(-8 * d, 0);
    g.lineTo(4 * d, 5 * d);
    g.fill();
    g.fillStyle = '#1c1830';
    g.beginPath();
    g.moveTo(-3 * d, -2 * d);
    g.lineTo(-8 * d, 0);
    g.lineTo(-3 * d, 2 * d);
    g.fill();
    g.strokeStyle = '#1c1830';
    g.lineWidth = 1.6 * d;
    g.strokeRect(4 * d, -5 * d, 55 * d, 10 * d);
    g.restore();
  }
}

// a line (screen points) as n points evenly along it
function resample(P, n) {
  if (P.length < 2) return Array.from({ length: n }, () => P[0].slice());
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1] || 1;
  const out = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * L;
    while (j < P.length - 1 && cum[j] < s) j++;
    const a = P[j - 1];
    const b = P[j];
    const t = (s - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// the ramp's shape from the line drawn on the roof: where it starts (where the line starts, towards the
// car - a few metres short of it at most), its lip (at the roof's edge, a little out over the street),
// how high and how it curves - from the drawing (a longer line, a longer and higher ramp; a line bowed
// up, more of a kick), kept within what a car can take. Whatever way it was drawn, and wherever across
// the roof: it goes the way the car is pointing
export function fitProfile(W, s, bow = 0) {
  const xs = W.map((p) => p.x);
  const near = Math.max(...xs);
  const far = Math.min(...xs);
  const startX = clamp(near, s.edgeX + 9, Math.min(s.edgeX + 24, s.carX - 4));
  const lipX = clamp(far, s.edgeX - 2.5, s.edgeX - 0.4);
  const L = startX - lipX;
  const h = clamp(L * 0.34, 3.6, 5.4);
  const pow = clamp(1.05 + bow * 4, 1.0, 2.1);
  return { startX, lipX, h, pow, z: s.laneZ, half: 3.4, roofY: s.roofY };
}

// the ramp's surface height at x (0 before its start)
export function rampH(P, x) {
  const u = (P.startX - x) / (P.startX - P.lipX);
  if (u <= 0) return 0;
  return P.h * Math.pow(Math.min(1, u), P.pow);
}

// ------------------------------------------------------------------ the ramp, growing out of the line
export class Ramp {
  constructor(game, P) {
    this.game = game;
    this.P = P;
    this.t = 0;
    this.pieces = [];
    this.F = P.frame || NOFRAME;
    this.root = new THREE.Group();
    this.root.matrixAutoUpdate = true;
    // (built along -x in its frame; turned into the world with it - the frames are turns about the
    // origin, nothing more)
    this.root.rotation.y = this.F.rotY || 0;
    game.scene.add(this.root);
    this.build();
    // (round 8, the player's word: the ramp drawn before their eyes - a giant pencil, his, down out
    // of the sky onto the roof, its point going round the ramp's lines one after another, each line
    // there as it goes; only then is it filled in, white as the page, and coloured. The pieces wait
    // for the drawing: buildSketch, update)
    this.buildSketch();
    for (const p of this.pieces) if (p.grow !== 'none') p.delay = this.SK + p.delay * 0.3;
    this.grown = false;
  }

  // the lines the pencil draws, in the order it draws them (the ramp's frame: x along it, y up, z
  // across), each a tube of ink shown as far as the point has gone; and the pencil itself, point
  // down - in a group of their own, beside the ramp's (they are ink, not to be whitened with it)
  buildSketch() {
    const P = this.P;
    const Y = P.roofY;
    const z = P.z;
    const half = P.half;
    const xAt = (u) => P.startX + (P.lipX - P.startX) * u;
    const yAt = (u) => Y + 0.3 + P.h * Math.pow(u, P.pow);
    const v = (x, y, zz) => new THREE.Vector3(x, y, zz);
    const line = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
    const S = [];
    // its near end across, its left edge up to the lip, the lip across, its right edge back down
    S.push(line(4, (t) => v(P.startX + KICK, Y + 0.06, z - half + 2 * half * t)));
    S.push(line(28, (u) => v(xAt(u), yAt(u) + 0.08, z + half)));
    S.push(line(4, (t) => v(P.lipX, yAt(1) + 0.08, z + half - 2 * half * t)));
    S.push(line(28, (u) => v(xAt(1 - u), yAt(1 - u) + 0.08, z - half)));
    // its legs down to the roof, one side then the other
    for (const sd of [-1, 1]) for (const i of [1, 4, 7]) {
      const u = (i + 0.4) / 8.4;
      S.push(line(3, (t) => v(xAt(u), yAt(u) - (yAt(u) - Y) * t, z + sd * half)));
    }
    // the deck's planks across, a few, and the line up its middle
    for (let c = 1; c <= 3; c++) {
      const u = c / 4;
      S.push(line(4, (t) => v(xAt(u), yAt(u) + 0.1, z + (c % 2 ? 1 : -1) * half * (1 - 2 * t))));
    }
    const INK = linC(0.09, 0.07, 0.15);
    const grp = (this.sketch = new THREE.Group());
    grp.rotation.y = this.F.rotY || 0;
    grp.matrixAutoUpdate = true;
    this.game.scene.add(grp);
    this.strokes = [];
    let t = 0.45;
    for (const pts of S) {
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
      const K = new Kit();
      const M = itemMats();
      const segs = Math.max(8, Math.round(len * 3));
      K.add(M.matte, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, 0.085, 5, false), INK);
      const g = K.build({ seed: Math.random() });
      g.matrixAutoUpdate = true;
      const meshes = [];
      g.traverse((m) => {
        if (m.isMesh) {
          const n = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
          meshes.push([m, n]);
          m.geometry.setDrawRange(0, 0);
        }
      });
      grp.add(g);
      // (a long line at some 34 m a second, a short one in a breath; a hop between)
      const dur = Math.max(0.1, len / 34);
      this.strokes.push({ pts, len, t0: t, t1: t + dur, meshes, shown: 0 });
      t += dur + 0.04;
    }
    // the pencil: graphite, the shaved wood, the six-sided yellow body, the tin band, the eraser -
    // along +y from its point; 9 m of it
    const R = 0.32;
    const K = new Kit();
    const M = itemMats();
    K.cyl(M.round, 0.012, R * 0.3, 0, R * 0.95, linC(0.16, 0.15, 0.2), { axis: 'y', segs: 12 });
    K.cyl(M.matte, R * 0.3, R, R * 0.95, R * 3.3, linC(0.93, 0.74, 0.5), { axis: 'y', segs: 12 });
    K.cyl(M.paint, R, R, R * 3.3, R * 25, linC(0.99, 0.76, 0.14), { axis: 'y', segs: 6 });
    K.cyl(M.metal, R * 1.05, R * 1.05, R * 25, R * 26.4, linC(0.84, 0.84, 0.88), { axis: 'y', segs: 16 });
    for (const yy of [25.4, 25.9]) K.torus(M.metal, R * 1.07, R * 0.05, 0, R * yy, 0, linC(0.5, 0.5, 0.56), Math.PI / 2);
    K.cyl(M.round, R, R * 0.82, R * 26.4, R * 28, linC(0.98, 0.56, 0.64), { axis: 'y', segs: 16 });
    const pen = K.build({ seed: 0.31 });
    pen.matrixAutoUpdate = true;
    pen.visible = false;
    grp.add(pen);
    // (leaning back up towards the car it is drawn from, as a hand holds it)
    const q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(0.5, 1, -0.32).normalize());
    this.pen = { obj: pen, q, tip: new THREE.Vector3(), fx: 0 };
    // when the drawing is done, and the pencil off up out of the picture again
    this.SK = t + 0.35;
  }

  // the point of the drawing at time t: [where, drawing or not]
  penAt(t, out) {
    const L = this.strokes;
    const first = L[0].pts[0];
    if (t < 0.45) {
      // (down out of the sky onto the first line's start)
      const k = clamp(t / 0.45, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      out.set(first.x, first.y + 16 * (1 - e), first.z);
      return false;
    }
    for (let i = 0; i < L.length; i++) {
      const s = L[i];
      if (t < s.t0) {
        // (lifted between two lines: across in an arc)
        const a = L[i - 1].pts[L[i - 1].pts.length - 1];
        const b = s.pts[0];
        const k = clamp((t - L[i - 1].t1) / Math.max(1e-3, s.t0 - L[i - 1].t1), 0, 1);
        out.lerpVectors(a, b, k);
        out.y += Math.sin(k * Math.PI) * 0.7;
        return false;
      }
      if (t <= s.t1) {
        const d = ((t - s.t0) / (s.t1 - s.t0)) * s.len;
        let acc = 0;
        for (let j = 1; j < s.pts.length; j++) {
          const seg = s.pts[j].distanceTo(s.pts[j - 1]);
          if (acc + seg >= d) {
            out.lerpVectors(s.pts[j - 1], s.pts[j], (d - acc) / Math.max(1e-6, seg));
            return true;
          }
          acc += seg;
        }
        out.copy(s.pts[s.pts.length - 1]);
        return true;
      }
    }
    // (done: up and away)
    const last = L[L.length - 1].pts[L[L.length - 1].pts.length - 1];
    const k = clamp((t - L[L.length - 1].t1) / 0.35, 0, 1);
    out.set(last.x, last.y + 18 * k * k, last.z);
    return false;
  }

  tickSketch(dt) {
    const t = this.t;
    const pen = this.pen;
    if (!pen) return;
    // each line as far as the point has gone
    for (const s of this.strokes) {
      const k = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
      if (k === s.shown) continue;
      s.shown = k;
      for (const [m, n] of s.meshes) m.geometry.setDrawRange(0, Math.floor((n * k) / 3) * 3);
    }
    const on = t > 0 && t < this.SK;
    pen.obj.visible = on;
    if (!on) return;
    const drawing = this.penAt(t, pen.tip);
    pen.obj.position.copy(pen.tip);
    // (a hand's wobble as it goes)
    pen.obj.quaternion.copy(pen.q);
    pen.obj.rotateZ(Math.sin(t * 23) * 0.025);
    pen.obj.rotateX(Math.cos(t * 17) * 0.02);
    // the graphite's dust off the point, and its scratch
    if (drawing) {
      pen.fx -= dt;
      if (pen.fx <= 0) {
        pen.fx = 0.05;
        const w = this.sketch.localToWorld(pen.tip.clone());
        if (this.game.fx && this.game.fx.sparks) this.game.fx.sparks(w.x, w.y + 0.05, w.z, 3, [0.12, 0.1, 0.18]);
      }
      if (!pen.drawing && this.game.audio) this.game.audio.play('scribble', 0.32);
    }
    pen.drawing = drawing;
  }

  // its floor (a car on it), for the car park it stands on (Garage.extra)
  floorAt(wx, wz, y) {
    const P = this.P;
    if (!this.solid) return -Infinity;
    const [x, z] = this.F.toLocal(wx, wz);
    if (Math.abs(z - P.z) > P.half || x > P.startX + KICK || x < P.lipX) return -Infinity;
    // (the kick plate onto it: up from the roof to the deck)
    const h = x > P.startX ? P.roofY + 0.3 * (1 - (x - P.startX) / KICK) : P.roofY + 0.3 + rampH(P, x);
    return h <= y + 1.6 ? h : -Infinity;
  }

  // its spine: the line drawn, as it lies along the deck's middle (n points from the car's end to
  // the lip)
  inkLine(n = 40) {
    const P = this.P;
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const [wx, wz] = this.F.toWorld(P.startX + (P.lipX - P.startX) * u, P.z);
      out.push(new THREE.Vector3(wx, P.roofY + 0.36 + P.h * Math.pow(u, P.pow), wz));
    }
    return out;
  }

  // a point of its frame (x along it, y up, z across) in the world
  world(x, y, z) {
    const [wx, wz] = this.F.toWorld(x, z);
    return new THREE.Vector3(wx, y, wz);
  }

  piece(at, delay, fn, grow = 'y', pivot = null) {
    const K = new Kit();
    const M = itemMats();
    fn(K, M);
    const g = K.build({ seed: Math.random() });
    const holder = new THREE.Group();
    const pv = pivot || at;
    holder.position.copy(pv);
    g.position.set(-pv.x, -pv.y, -pv.z);
    g.matrixAutoUpdate = true;
    holder.add(g);
    holder.scale.set(grow === 'x' ? 0.001 : 1, grow === 'y' ? 0.001 : 1, grow === 'all' ? 0.001 : 1);
    if (grow === 'all') holder.scale.setScalar(0.001);
    holder.visible = false;
    this.root.add(holder);
    this.pieces.push({ holder, delay, grow, done: false });
  }

  build() {
    const P = this.P;
    const Y = P.roofY;
    const STEEL = linC(0.62, 0.64, 0.7);
    const DARK = linC(0.2, 0.2, 0.26);
    const PLATE = linC(0.78, 0.76, 0.72);
    const YEL = linC(0.98, 0.8, 0.18);
    const RED = linC(0.88, 0.22, 0.24);
    const INK = linC(0.1, 0.08, 0.16);
    const z = P.z;
    const half = P.half;
    const N = 14;
    const xAt = (u) => P.startX + (P.lipX - P.startX) * u;
    const yAt = (u) => Y + 0.3 + P.h * Math.pow(u, P.pow);
    const span = P.startX - P.lipX;
    // 0: the line itself, in ink, laid on the roof where it was drawn (a fat tube along the deck's
    // middle) - there from the first moment
    {
      const pts = [];
      for (let i = 0; i <= 30; i++) pts.push(new THREE.Vector3(xAt(i / 30), yAt(i / 30) + 0.06, z));
      const curve = new THREE.CatmullRomCurve3(pts);
      this.piece(new THREE.Vector3(P.startX, Y, z), 0, (K, M) => {
        K.add(M.matte, new THREE.TubeGeometry(curve, 60, 0.13, 6, false), INK);
        for (const s of [-1, 1]) {
          const side = curve.points.map((p) => p.clone().setZ(z + s * half));
          K.add(M.matte, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(side), 60, 0.07, 5, false), INK);
        }
      }, 'none');
    }
    // 1: the kick plate up onto it from the roof (a wedge, its nose chamfered), then the deck
    // plates, one after another from the car to the lip
    this.piece(new THREE.Vector3(P.startX + KICK / 2, Y, z), 0.1, (K, M) => {
      const g = new THREE.BoxGeometry(Math.hypot(KICK, 0.3), 0.07, half * 2);
      // (its far end, at the deck, up: it rises towards -x)
      g.rotateZ(-Math.atan2(0.3, KICK));
      g.translate(P.startX + KICK / 2, Y + 0.15, z);
      K.add(M.metal, g, STEEL);
      // its bolts along the roof edge, and the yellow nose
      K.box(M.paint, P.startX + KICK - 0.18, Y, z - half, P.startX + KICK + 0.02, Y + 0.05, z + half, YEL);
      for (let k = 0; k < 7; k++) {
        const bz = z - half + 0.3 + (k * (half * 2 - 0.6)) / 6;
        K.box(M.metal, P.startX + KICK - 0.45, Y, bz - 0.05, P.startX + KICK - 0.35, Y + 0.09, bz + 0.05, DARK);
      }
    }, 'all');
    for (let i = 0; i < N; i++) {
      const u0 = i / N;
      const u1 = (i + 1) / N;
      const xa = xAt(u0);
      const xb = xAt(u1);
      const ya = yAt(u0);
      const yb = yAt(u1);
      const cx = (xa + xb) / 2;
      const cy = (ya + yb) / 2;
      const len = Math.hypot(xb - xa, yb - ya) + 0.04;
      const pitch = Math.atan2(yb - ya, xb - xa);
      this.piece(new THREE.Vector3(cx, cy, z), 0.15 + i * 0.06, (K, M) => {
        const g = new THREE.BoxGeometry(len, 0.32, half * 2);
        g.rotateZ(pitch);
        g.translate(cx, cy - 0.16, z);
        K.add(M.metal, g, PLATE);
        // the tread on it: raised bars across, and the rivets along its edges
        for (let b = 0; b < 3; b++) {
          const t = (b + 0.5) / 3;
          const bx = xa + (xb - xa) * t;
          const by = ya + (yb - ya) * t;
          const bar = new THREE.BoxGeometry(0.12, 0.06, half * 2 - 0.5);
          bar.translate(bx, by + 0.02, z);
          K.add(M.metal, bar, STEEL);
        }
        // its edges: a channel along each side, sloped with it (the deck's fascia, seen from the side)
        for (const s of [-1, 1]) {
          const e = new THREE.BoxGeometry(len, 0.46, 0.16);
          e.rotateZ(pitch);
          e.translate(cx, cy - 0.21, z + s * (half - 0.02));
          K.add(M.metal, e, DARK);
        }
      }, 'all');
    }
    // 2: the columns up from the roof under the girders, and the girders along the edges
    for (let i = 0; i <= 8; i++) {
      const u = (i + 0.4) / 8.4;
      const x = xAt(u);
      const top = yAt(u) - 0.3;
      if (top - Y < 0.4) continue;
      for (const s of [-1, 1]) {
        const zz = z + s * (half - 0.35);
        this.piece(new THREE.Vector3(x, Y, zz), 0.5 + i * 0.08, (K, M) => {
          K.box(M.metal, x - 0.18, Y, zz - 0.18, x + 0.18, top, zz + 0.18, STEEL);
          // its foot plate, bolted to the roof
          K.box(M.metal, x - 0.38, Y, zz - 0.38, x + 0.38, Y + 0.08, zz + 0.38, DARK);
        }, 'y', new THREE.Vector3(x, Y, zz));
      }
    }
    for (const s of [-1, 1]) {
      const zz = z + s * (half - 0.35);
      this.piece(new THREE.Vector3(P.startX, Y, zz), 0.7, (K, M) => {
        const pts = [];
        for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(xAt(i / 20), yAt(i / 20) - 0.55, zz));
        K.add(M.metal, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.26, 4, false), STEEL);
      }, 'x', new THREE.Vector3(P.startX, Y, zz));
    }
    // 3: the cross braces between the columns (an X in each bay, both sides), the struts under
    // the lip out over the street
    for (let i = 1; i <= 8; i++) {
      const u0 = (i - 1 + 0.4) / 8.4;
      const u1 = (i + 0.4) / 8.4;
      const x0 = xAt(u0);
      const x1 = xAt(u1);
      const t0 = yAt(u0) - 0.6;
      const t1 = yAt(u1) - 0.6;
      if (t0 - Y < 1.2) continue;
      for (const s of [-1, 1]) {
        const zz = z + s * (half - 0.35);
        this.piece(new THREE.Vector3((x0 + x1) / 2, (Y + t1) / 2, zz), 1.05 + i * 0.07, (K, M) => {
          strut(K, M.metal, [x0, Y + 0.3, zz], [x1, t1, zz], 0.07, DARK);
          strut(K, M.metal, [x0, t0, zz], [x1, Y + 0.3, zz], 0.07, DARK);
        }, 'all');
      }
      // and across, under the deck
      this.piece(new THREE.Vector3(x1, t1, z), 1.15 + i * 0.07, (K, M) => {
        K.box(M.metal, x1 - 0.1, t1 - 0.1, z - half + 0.35, x1 + 0.1, t1 + 0.1, z + half - 0.35, DARK);
      }, 'all');
    }
    const lipTop = yAt(1);
    for (const s of [-1, 1]) {
      const zz = z + s * (half - 0.35);
      this.piece(new THREE.Vector3(P.lipX, lipTop, zz), 1.45, (K, M) => {
        strut(K, M.metal, [P.lipX + 0.2, lipTop - 0.5, zz], [P.lipX + 3.4, Y + 0.2, zz], 0.16, STEEL);
        strut(K, M.metal, [P.lipX + 1.4, lipTop - 0.4, zz], [P.lipX + 3.4, Y + 0.2, zz], 0.1, DARK);
      }, 'all');
    }
    // 4: the rails along the deck's edges, the hazard stripes at the lip, chevrons up the middle
    for (const s of [-1, 1]) {
      const zz = z + s * (half - 0.05);
      this.piece(new THREE.Vector3(P.startX, Y, zz), 1.5, (K, M) => {
        for (let i = 0; i < 12; i++) {
          const u = i / 12;
          const x = xAt(u);
          const y = yAt(u);
          K.box(M.metal, x - 0.05, y, zz - 0.05, x + 0.05, y + 0.75, zz + 0.05, STEEL);
        }
        const pts = [];
        for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(xAt(i / 20), yAt(i / 20) + 0.75, zz));
        K.add(M.metal, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.05, 4, false), STEEL);
      }, 'x', new THREE.Vector3(P.startX, Y, zz));
    }
    this.piece(new THREE.Vector3(P.lipX, lipTop, z), 1.7, (K, M) => {
      const u0 = 0.9;
      const x0 = xAt(u0);
      for (let i = 0; i < 8; i++) {
        const za = z - half + (i * half * 2) / 8;
        const g = new THREE.BoxGeometry(span * 0.1, 0.03, (half * 2) / 8);
        const pitch = Math.atan2(yAt(1) - yAt(u0), P.lipX - x0);
        g.rotateZ(pitch);
        g.translate((x0 + P.lipX) / 2, (yAt(u0) + yAt(1)) / 2 + 0.02, za + half / 8);
        K.add(M.paint, g, i % 2 ? YEL : DARK);
      }
      for (let c = 0; c < 5; c++) {
        const u = 0.12 + c * 0.15;
        const x = xAt(u);
        const y = yAt(u) + 0.03;
        for (const s of [-1, 1]) {
          const g = new THREE.BoxGeometry(0.22, 0.03, 1.5);
          g.rotateY(s * 0.6);
          g.translate(x - 0.4, y, z + s * 0.55);
          K.add(M.paint, g, c % 2 ? YEL : RED);
        }
      }
    }, 'all');
    // 5: the hatching: short dark strokes over its sides and on the deck, as the city is drawn
    this.piece(new THREE.Vector3(P.startX, Y, z), 1.9, (K, M) => {
      for (let i = 0; i < 60; i++) {
        const u = Math.random();
        const x = xAt(u);
        const y = Y + 0.4 + Math.random() * (yAt(u) - Y - 0.6);
        if (y > yAt(u) - 0.5) continue;
        const s = Math.random() < 0.5 ? -1 : 1;
        const g = new THREE.BoxGeometry(0.035, 0.9 + Math.random() * 0.8, 0.035);
        g.rotateZ(0.7);
        g.translate(x, y, z + s * (half + 0.02));
        K.add(M.matte, g, INK);
      }
    }, 'all');
  }

  // growing: each piece in its turn, with a boing; the colour sweep at the end (game/materialize.js
  // does the same for whatever is drawn in the air)
  update(dt) {
    this.t += dt;
    const t = this.t;
    this.tickSketch(dt);
    for (const p of this.pieces) {
      if (p.done) continue;
      const k = (t - p.delay) / 0.32;
      if (k <= 0) continue;
      p.holder.visible = true;
      if (p.grow === 'none') {
        p.done = true;
        continue;
      }
      const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3) * Math.cos(k * 4.2);
      const v = Math.max(0.001, e);
      if (p.grow === 'y') p.holder.scale.set(1, v, 1);
      else if (p.grow === 'x') p.holder.scale.set(v, 1, 1);
      else p.holder.scale.setScalar(v);
      if (k >= 1) {
        p.holder.scale.set(1, 1, 1);
        p.done = true;
        if (this.game.audio && Math.random() < 0.5) this.game.audio.play(p.grow === 'y' ? 'clank' : 'poof', 0.25);
      }
    }
    // white as the paper until the end, then the colours sweep from the car to the lip
    if (!this.swept) {
      const s0 = this.SK + 0.75;
      this.paper(t < s0 ? 0 : clamp((t - s0) / 0.8, 0, 1));
      if (t >= s0 + 0.85) {
        this.swept = true;
        this.unpaper();
        this.solid = true;
        this.grown = true;
      }
    }
  }

  paper(k) {
    const P = this.P;
    if (!this.U) {
      // the sweep runs along -x of its frame (from the car's end to the lip): in the world, that
      // turned (the sweep is worked out on the world's positions)
      const [sx, sz] = this.F.toWorld(-1, 0);
      this.U = {
        uMatOn: { value: 1 },
        uMatFlat: { value: new THREE.Vector4(0, 1, 0, 0) },
        uMatK: { value: 1 },
        uMatSweep: { value: new THREE.Vector4(sx, 0.25, sz, 0) },
        uMatBand: { value: new THREE.Vector4(0.6, 1, 1.2, 0) },
      };
      this.swaps = [];
      this.copies = new Map();
      this.root.traverse((m) => {
        if (!m.isMesh || !m.material || !m.material.uniforms || !m.material.uniforms.uMatOn) return;
        let c = this.copies.get(m.material);
        if (!c) {
          c = surfaceVariant(m.material, this.U);
          this.copies.set(m.material, c);
        }
        this.swaps.push([m, m.material]);
        m.material = c;
      });
    }
    // along (-1, 0.25, 0) of its frame: from the car's end (-startX) to beyond the lip (the lane's
    // own share of it, across: the same at both ends)
    const [sx, sz] = this.F.toWorld(-1, 0);
    const [ax, az] = this.F.toWorld(P.startX, P.z);
    const [bx, bz] = this.F.toWorld(P.lipX, P.z);
    const d0 = ax * sx + az * sz + P.roofY * 0.25 - 1;
    const d1 = bx * sx + bz * sz + (P.roofY + P.h) * 0.25 + 1;
    this.U.uMatSweep.value.w = d0 + (d1 - d0) * k;
  }

  unpaper() {
    if (!this.swaps) return;
    for (const [m, mat] of this.swaps) m.material = mat;
    for (const c of this.copies.values()) c.dispose();
    this.swaps = null;
  }

  dispose() {
    this.unpaper();
    this.game.scene.remove(this.root);
    this.root.traverse((m) => {
      if (m.isMesh) m.geometry.dispose();
    });
    if (this.sketch) {
      this.game.scene.remove(this.sketch);
      this.sketch.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
    }
  }
}

function strut(K, mat, a, b, r, color) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, 6, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  K.add(mat, g, color);
}

// ------------------------------------------------------------------ the jump
// Off the lip, the car is flown on the line that brings it down on the other roof, whatever speed it
// came up with: the right speed out over the street, the arc, the nose dipping with it; the prologue
// slows the time at the top of the arc (its dt here is the slowed one). Down on the roof it is the
// car's own again, landing hard on its springs.
export class Jump {
  constructor(game, car, P, land) {
    this.game = game;
    this.car = car;
    this.t = 0;
    // (land: x along the way, z0..z1 across, y - in the frame of the run, as P is)
    const F = (this.F = land.frame || P.frame || NOFRAME);
    const lipY = P.roofY + 0.3 + P.h;
    const [px, pz] = F.toLocal(car.pos.x, car.pos.z);
    // (as fast as it came - but within what makes a jump to remember, and lands it)
    const sp = clamp(Math.abs(car.speed || 0), 19, 23);
    const [fx, fz] = F.toLocal(Math.sin(car.yaw), Math.cos(car.yaw));
    // where it lands: on the far roof, along the way it is going (kept on the clear aisle)
    const D0 = Math.max(10, (px - land.x) / Math.max(0.3, -fx));
    const lz = clamp(pz + fz * D0, land.z0, land.z1);
    const dx = land.x - px;
    const dz = lz - pz;
    const D = Math.hypot(dx, dz);
    this.T = D / sp;
    this.vh = sp;
    this.dir = [dx / D, dz / D];
    this.y0 = Math.max(car.pos.y, lipY);
    this.x0 = px;
    this.z0 = pz;
    this.vy = (land.y - this.y0 + 10 * this.T * this.T) / this.T;
    this.apexT = this.vy / 20;
    this.landY = land.y;
    this.yaw0 = car.yaw;
    const [wx, wz] = F.toWorld(this.dir[0], this.dir[1]);
    this.wdir = [wx, wz];
    // (the shorter way round from the yaw it has to the one it flies at)
    let y1 = Math.atan2(wx, wz);
    while (y1 - this.yaw0 > Math.PI) y1 -= Math.PI * 2;
    while (y1 - this.yaw0 < -Math.PI) y1 += Math.PI * 2;
    this.yaw1 = y1;
    this.done = false;
    car.air = true;
    car.script = (dt) => this.step(dt);
  }

  get apex() {
    return this.t >= this.apexT;
  }

  step(dt) {
    const v = this.car;
    this.t += dt;
    const t = Math.min(this.t, this.T);
    const [wx, wz] = this.F.toWorld(this.x0 + this.dir[0] * this.vh * t, this.z0 + this.dir[1] * this.vh * t);
    v.pos.x = wx;
    v.pos.z = wz;
    v.pos.y = this.y0 + this.vy * t - 10 * t * t;
    const vyNow = this.vy - 20 * t;
    // (its nose with the arc, turned onto its line)
    v.bodyPitch = clamp(Math.atan2(vyNow, this.vh) * 0.55, -0.35, 0.3);
    v.yaw = this.yaw0 + (this.yaw1 - this.yaw0) * Math.min(1, t / 0.4);
    v.vx = this.wdir[0] * this.vh;
    v.vz = this.wdir[1] * this.vh;
    v.speed = this.vh;
    v.speedAbs = this.vh;
    if (this.t >= this.T) {
      // down: its own again, falling the last few centimetres onto its springs
      v.script = null;
      v.pos.y = this.landY + 0.08;
      v.vy = vyNow;
      v.air = true;
      this.done = true;
    }
  }
}
