import * as THREE from 'three';
import { Kit, linC } from '../items.js';
import { makeSurface, canvasTexture } from '../../render/materials.js';

// (v5, ROADMAP 18) Lily's drawing - the page itself, out of her sketchbook, in her two hands: held
// up to whoever she shows it to, its picture to them, the back of it to her; or held to her chest.
// A thing in the scene, seen as the people in it see it, not a picture laid over the film.
//
// Its material is the boards' own kind (a box's surface with a picture on it), so the graphics card
// has it ready already: nothing new to make the moment it is held up.

const _c = new THREE.Vector3();
const _n = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _l = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const hexRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export class HeldPage {
  constructor(game, canvas) {
    this.game = game;
    const tex = canvasTexture(canvas);
    // (a sketchbook's page: about the size of a sheet of A4, the drawing's own proportions)
    const W = 0.31;
    const H = (W * canvas.height) / canvas.width;
    this.W = W;
    this.H = H;
    const front = makeSurface({ kind: 'box', map: tex, emMap: tex, emissive: new THREE.Color(0.26, 0.25, 0.24), ang: 1.45, wash: 0.92, line: 0.3 });
    const paper = makeSurface({ kind: 'box', color: new THREE.Color(0.96, 0.94, 0.88), line: 0.3 });
    const K = new Kit();
    // its face (+z, the picture), and its back a hair behind it; a little bowed, as paper held by its
    // two edges is
    const face = new THREE.PlaneGeometry(W, H, 8, 1);
    const back = new THREE.PlaneGeometry(W, H, 8, 1);
    back.rotateY(Math.PI);
    for (const [g, dz] of [[face, 0.002], [back, -0.002]]) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / (W / 2);
        p.setZ(i, dz - 0.018 * (1 - u * u));
      }
      g.computeVertexNormals();
    }
    K.add(front, face, linC(1, 1, 1));
    K.add(paper, back, linC(0.97, 0.95, 0.9));
    this.grp = K.build({ seed: 0.61 });
    this.grp.matrixAutoUpdate = false;
    this.grp.visible = false;
    game.scene.add(this.grp);
    this.mats = [front, paper];
    this.tex = tex;
    this.canvas = canvas;
    this.drawn = 1;
    this.fig = null;
    this.to = null;
    this.mode = 'show';
    // (where its middle is: for a camera to look at, a hand to go to)
    this.at = new THREE.Vector3();
    // (round 14: where her pencil is on it as she draws - its place on the page (u across, v down),
    // its colour - and that place in the world: follow, her hand and pencil on it)
    this.tip = { u: 0.5, v: 0.5, col: '#e8457c', done: false };
    this.tipW = new THREE.Vector3();
    this.follow = false;
  }

  // (ROADMAP 18.9) her drawing as far as she has got with it: k of it (game/prologue/ui.js
  // lilyDrawing), drawn again only when there is more of it
  draw(fn, k) {
    // (fine enough that a stroke grows smoothly under her pencil when it is seen close: round 14)
    const q = Math.round(Math.max(0, Math.min(1, k)) * 1500) / 1500;
    if (q === this.drawn) return;
    this.drawn = q;
    fn(q, this.canvas, this.tip);
    this.tex.needsUpdate = true;
  }

  // held up by fig, its picture towards `to` (a point, or a function giving one); mode 'show' (held
  // out at the height of her chest, tilted up to who looks at it), 'low' (let down a little, still
  // towards them), 'read' (up before her own eyes, the picture to her) or 'hug' (to her chest,
  // picture in)
  hold(fig, to, mode = 'show') {
    this.fig = fig;
    this.to = to;
    this.mode = mode;
    if (!this.saved) this.saved = { carry: fig.carry, carryL: fig.carryL };
    fig.carry = null;
    fig.carryL = null;
    this.grp.visible = true;
  }

  // put away (back into the sketchbook in her hand)
  release() {
    const f = this.fig;
    if (f) {
      f.reachR = null;
      f.reachL = null;
      if (this.saved) {
        f.carry = this.saved.carry === 'icecream' ? null : this.saved.carry;
        f.carryL = this.saved.carryL;
      }
    }
    this.saved = null;
    this.fig = null;
    this.grp.visible = false;
  }

  // every frame, after the figure is posed: the page where her hands are, her hands on its edges
  update() {
    const f = this.fig;
    if (!f || !f.j || f.j.neck.lengthSq() === 0) return;
    const S = f.scale || 1;
    const j = f.j;
    const mode = this.mode;
    // (ROADMAP 18.9: 'draw' - her sketchbook low before her, sitting, tipped up to her eyes; her left
    // hand holding it, the pencil in her right going over the page in short strokes)
    if (mode === 'draw') {
      this.drawPose(f);
      return;
    }
    const hug = mode === 'hug';
    // (round 13: 'up' - held up high at arms' length against the sky, the picture to her: her drawing
    // over where the wheel stood)
    const up = mode === 'up';
    const read = mode === 'read' || up;
    // in front of her chest (up before her eyes to read it; lower, let down)
    _c.copy(j.shoulderL).add(j.shoulderR).multiplyScalar(0.5);
    _c.addScaledVector(f.forward, (hug ? 0.12 : up ? 0.36 : read ? 0.3 : 0.27) * S);
    _c.y += (hug ? -0.13 : up ? 0.34 : read ? 0.1 : mode === 'low' ? -0.2 : -0.06) * S;
    // facing who looks at it (only so far round from her front), or her own eyes, or her chest
    const to = typeof this.to === 'function' ? this.to() : this.to;
    if (hug || read || !to) _n.copy(f.forward).multiplyScalar(hug || read ? -1 : 1);
    else {
      _n.copy(to).sub(_c);
      _n.y = 0;
      if (_n.lengthSq() < 1e-6) _n.copy(f.forward);
      _n.normalize();
      // (at most some 50 degrees off her front: her arms are only so long)
      const d = _n.dot(f.forward);
      if (d < 0.64) {
        _x.crossVectors(UP, f.forward);
        const s = Math.sign(_n.dot(_x)) || 1;
        _n.copy(f.forward).multiplyScalar(0.64).addScaledVector(_x, s * 0.77).normalize();
      }
    }
    // tilted up a little towards a taller looker (or down, held to her)
    const tilt = hug ? -0.1 : up ? -0.42 : read ? -0.25 : to ? Math.max(-0.1, Math.min(0.45, Math.atan2(to.y - _c.y, Math.hypot(to.x - _c.x, to.z - _c.z)))) * 0.8 : 0.2;
    _n.y = Math.sin(tilt);
    _n.normalize();
    _x.crossVectors(UP, _n).normalize();
    _y.crossVectors(_n, _x).normalize();
    _m.makeBasis(_x, _y, _n);
    // (her size: a child's hands hold a page as big as anybody's)
    this.grp.matrix.copy(_m).setPosition(_c);
    this.grp.matrixWorldNeedsUpdate = true;
    this.at.copy(_c);
    // her hands on its two side edges, a little below their middle (her right hand on the edge to
    // her right: from the front, the picture's left)
    const hw = this.W / 2 - 0.012;
    f.reachR = f.reachR || new THREE.Vector3();
    f.reachL = f.reachL || new THREE.Vector3();
    f.reachR.copy(_c).addScaledVector(_x, -hw).addScaledVector(_y, -0.02);
    f.reachL.copy(_c).addScaledVector(_x, hw).addScaledVector(_y, -0.02);
  }

  drawPose(f) {
    const S = f.scale || 1;
    const j = f.j;
    _c.copy(j.shoulderL).add(j.shoulderR).multiplyScalar(0.5);
    _c.addScaledVector(f.forward, 0.27 * S);
    _c.y -= 0.24 * S;
    // (facing up and back to her: tipped some 55 degrees from upright)
    _n.copy(f.forward).multiplyScalar(-Math.cos(0.95));
    _n.y = Math.sin(0.95);
    _n.normalize();
    // (round 14: the picture the right way up to her - its top the edge away from her, its right on
    // her right; it lay upside down on her knees, which nobody saw until her pencil was seen on it)
    _l.crossVectors(UP, f.forward).normalize();
    _x.copy(_l).negate();
    _y.crossVectors(_n, _x).normalize();
    _m.makeBasis(_x, _y, _n);
    this.grp.matrix.copy(_m).setPosition(_c);
    this.grp.matrixWorldNeedsUpdate = true;
    this.at.copy(_c);
    const hw = this.W / 2 - 0.012;
    f.reachR = f.reachR || new THREE.Vector3();
    f.reachL = f.reachL || new THREE.Vector3();
    // her left hand on the book's edge; the right one drawing: across a little and down a little, in
    // short strokes, now and then lifted off to look up at what she draws
    f.reachL.copy(_c).addScaledVector(_l, hw).addScaledVector(_y, -0.03);
    // (where her pencil is on the page, in the world: the page's own place for it, on its bowed face)
    const lx = (this.tip.u - 0.5) * this.W;
    const ly = (0.5 - this.tip.v) * this.H;
    const u = lx / (this.W / 2);
    this.tipW.copy(_c).addScaledVector(_x, lx).addScaledVector(_y, ly).addScaledVector(_n, 0.004 - 0.018 * (1 - u * u));
    if (this.follow && !this.tip.done) {
      // (round 14: her pencil's point on the page where the colour is going on - the hand as far back
      // from it along her forearm as the pencil is long - and the pencil the colour it draws)
      const el = j.elbowR;
      _x.subVectors(this.tipW, el);
      const l = _x.length() || 1;
      f.reachR.copy(this.tipW).addScaledVector(_x, -(0.27 * S) / l).addScaledVector(_n, 0.006);
      f.pencilCol = hexRgb(this.tip.col);
    } else {
      const t = (this.game.time || 0) + (this.ph || (this.ph = Math.random() * 10));
      const lift = Math.max(0, Math.sin(t * 0.9)) > 0.93 ? 0.05 : 0;
      f.reachR.copy(_c).addScaledVector(_l, -0.04 + Math.sin(t * 6.3) * 0.05 + Math.sin(t * 1.7) * 0.03).addScaledVector(_y, -(Math.sin(t * 3.7) * 0.035 + Math.sin(t * 0.8) * 0.03)).addScaledVector(_n, 0.018 + lift);
      if (!this.follow) f.pencilCol = null;
    }
    if (f.carry !== 'pencil') f.carry = 'pencil';
  }

  dispose() {
    this.release();
    this.game.scene.remove(this.grp);
    for (const m of this.grp.children) m.geometry.dispose();
    for (const m of this.mats) m.dispose();
    this.tex.dispose();
  }
}
