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
const _t = new THREE.Vector3();
const _a = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _h = new THREE.Vector3();
const _hn = new THREE.Vector3();
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
    // (round 24: from one way of holding it to another over a moment, not at once - fromP/fromQ where
    // it was, blend how far on; still: her pencil lifted off it, her hand resting)
    this.fromP = new THREE.Vector3();
    this.fromQ = new THREE.Quaternion();
    this.blend = 1;
    this.blendT = null;
    this.still = false;
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
    // (her fist round the pencil let go: it is put away while she holds the page in her two hands)
    if (fig && this.gripV && fig.grip === this.gripV) fig.grip = null;
    // (round 24: held another way by the same hands - it goes there, it does not jump)
    if (this.fig === fig && this.grp.visible && mode !== this.mode) {
      this.fromP.setFromMatrixPosition(this.grp.matrix);
      this.fromQ.setFromRotationMatrix(this.grp.matrix);
      this.blend = 0;
      this.blendT = null;
    } else this.blend = 1;
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
      f.pencilAx = null;
      if (this.gripV && f.grip === this.gripV) f.grip = null;
      this.still = false;
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
    if (this.blend < 1) {
      const now = this.game.time || 0;
      this.blend = Math.min(1, this.blend + Math.max(0, Math.min(0.1, now - (this.blendT === null ? now : this.blendT))) / 0.5);
      this.blendT = now;
      const k = this.blend * this.blend * (3 - 2 * this.blend);
      _q.setFromRotationMatrix(_m);
      _q2.copy(this.fromQ).slerp(_q, k);
      _c.lerpVectors(this.fromP, _c, k);
      _m.makeRotationFromQuaternion(_q2);
      _x.setFromMatrixColumn(_m, 0);
      _y.setFromMatrixColumn(_m, 1);
    }
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
    // (round 24, the player's word: her hands unnatural, the pencils part of her hand - the pencil went
    // on along her forearm out of her fist, a stick grown out of her arm. Now held as a child holds a
    // pencil to colour: its point on the page, its body slanting up out of her fingers and back over
    // her knuckles towards her shoulder, her hand a little above the page at its side - game/carry.js
    // fig.pencilAx)
    let lift = 0;
    if (this.follow && !this.tip.done) {
      _t.copy(this.tipW);
      f.pencilCol = hexRgb(this.tip.col);
    } else {
      // (round 24: still - done, the pencil lifted off the page and resting there)
      if (!this.still) this.stillT = (this.game.time || 0) + (this.ph || (this.ph = Math.random() * 10));
      const t = this.stillT;
      lift = this.still ? 0.05 : Math.max(0, Math.sin(t * 0.9)) > 0.93 ? 0.04 : 0;
      _t.copy(_c).addScaledVector(_l, -0.06 + Math.sin(t * 6.3) * 0.045 + Math.sin(t * 1.7) * 0.03).addScaledVector(_y, -(Math.sin(t * 3.7) * 0.03 + Math.sin(t * 0.8) * 0.03));
      // (the same pencil in her hand when she stops - not another)
      if (!this.follow && !this.still) f.pencilCol = null;
    }
    // (its slant: a child's fist round a coloured pencil - nearly upright on the page, leaning back a
    // little towards her right shoulder)
    _a.subVectors(j.shoulderR, _t);
    _a.addScaledVector(_n, -_a.dot(_n));
    if (_a.lengthSq() < 1e-6) _a.copy(_l).negate();
    _a.normalize();
    const ax = f.pencilAx || (f.pencilAx = new THREE.Vector3());
    ax.copy(_n).multiplyScalar(0.9).addScaledVector(_a, 0.34).addScaledVector(_l, -0.1).normalize();
    // (her fist closed round it - render/people.js, fig.grip towards its point - its hollow on the pencil
    // a little above the point: render/heroshapes.js heroHandGeo, the hollow 0.07 down the hand from
    // the wrist and 0.062 out from the palm; her hand 0.86 of a man's)
    const gp = this.gripV || (this.gripV = new THREE.Vector3());
    gp.copy(ax).negate();
    f.grip = gp;
    const hk = S * 0.862;
    _h.subVectors(j.handR, j.elbowR);
    _h.addScaledVector(gp, -_h.dot(gp));
    if (_h.lengthSq() < 1e-8) _h.copy(_l).negate();
    _h.normalize();
    _hn.crossVectors(gp, _h);
    f.reachR.copy(_t).addScaledVector(ax, 0.075 * S + lift).addScaledVector(_h, -0.07 * hk).addScaledVector(_hn, -0.0607 * hk);
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
