import * as THREE from 'three';
import { BLUEPRINTS, drawBlueprint, blueprintBounds } from '../game/blueprints.js';
import { scoreDrawing, gradeOf } from '../game/recognizer.js';
import { LineBatch } from '../render/LineBatch.js';
import { makeLineMaterial, makeSpriteMaterial, getSpriteGeometry } from '../render/materials.js';
import { Sketcher, FONT_HAND } from '../render/sketch2d.js';

const PX = 250; // virtual pixels per metre handed to the recognizer (what the paper pad used)
const INK_C = [0.07, 0.07, 0.11];
const RED = [0.8, 0.12, 0.15];
const GUIDE = [0.32, 0.34, 0.46];
const GHOST = [0.36, 0.56, 0.86]; // non-photo blue, like an artist's tracing guide
const RED_CSS = '#c81e24';
const TRACED_MAX = 70; // tracing over the ghost never makes a perfect item

const COMMENTS = {
  perfect: ['מושלם! כל הכבוד', 'יצירת מופת!', 'מדויק להפליא'],
  good: ['טוב מאוד', 'יפה! זה יעבוד', 'ציור טוב'],
  wonky: ['עקום... יעבוד חלקית', 'בערך... נקווה לטוב', 'יצא קצת מעוות'],
  fail: ['זה לא דומה בכלל', 'אוי... זה ייצא מקולקל', 'צריך לתרגל'],
};

const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();

// ease-in with a little wind-up before the jump
const easeIn = (t) => 2.70158 * t * t * t - 1.70158 * t * t;

/**
 * Drawing happens in the game's own world: the hero raises the pencil and draws on an
 * invisible sheet of air in front of him, the strokes hang there as ink, the teacher's red pen
 * marks them, and then they "plop" into the real thing.
 */
export class AirDraw {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = $('airdraw');
    this.inputEl = $('air-input');
    this.titleEl = $('air-title');
    this.statusEl = $('air-status');
    this.dangerEl = $('air-danger');
    this.footEl = $('air-foot');
    this.refEl = $('air-ref');
    this.refCanvas = this.refEl.querySelector('canvas');
    this.refCaption = this.refEl.querySelector('.caption');
    this.countEl = $('air-count');
    this.ghostBtn = $('air-ghost');
    this.ids = [];
    this.ghost = false;
    this.traced = false;

    this.mat = makeLineMaterial({ nudge: 0, minWidth: 1.4, depthTest: false });
    this.batch = new LineBatch(9000, this.mat, { dynamic: true });
    this.batch.mesh.renderOrder = 40;
    game.scene.add(this.batch.mesh);

    // the teacher's grade, floating next to the drawing
    this.stickerCanvas = document.createElement('canvas');
    this.stickerCanvas.width = 512;
    this.stickerCanvas.height = 300;
    this.stickerTex = new THREE.CanvasTexture(this.stickerCanvas);
    this.stickerTex.colorSpace = THREE.NoColorSpace;
    const sm = makeSpriteMaterial(this.stickerTex, { noFog: true, transparent: true });
    sm.uniforms.uRect.value.set(0, 0, 1, 1);
    sm.uniforms.uPivot.value.set(0.5, 0.5);
    sm.uniforms.uMode.value = 1;
    sm.uniforms.uNightMode.value = 1;
    sm.depthTest = false;
    sm.depthWrite = false;
    this.sticker = new THREE.Mesh(getSpriteGeometry(), sm);
    this.sticker.frustumCulled = false;
    this.sticker.renderOrder = 41;
    this.sticker.visible = false;
    game.scene.add(this.sticker);

    this.phase = 'idle'; // idle | draw | grade | plop | cancel
    this.t = 0;
    this.strokes = [];
    this.current = null;
    this.bp = null;
    this.res = null;
    this.C = new THREE.Vector3();
    this.U = new THREE.Vector3();
    this.V = new THREE.Vector3();
    this.N = new THREE.Vector3();
    this.W = 2;
    this.H = 1.4;
    this.pen = null; // last pen position on the sheet [u, v]
    this.penWorld = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.targetScale = 0.12;
    this.camOpts = { dist: 2.3, height: 1.72, shoulder: 0.95 };
    this._bind();
  }

  get open() {
    return this.phase !== 'idle';
  }

  _bind() {
    const el = this.inputEl;
    el.addEventListener('pointerdown', (e) => {
      if (this.phase === 'grade') {
        this.startPlop();
        return;
      }
      if (this.phase !== 'draw') return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        // synthetic pointers may not be capturable
      }
      const p = this.toSheet(e.clientX, e.clientY);
      if (!p) return;
      this.current = [p];
      this.strokes.push(this.current);
      this.pen = p;
      this.game.audio.scratchStart();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.current || this.phase !== 'draw') return;
      e.preventDefault();
      // coalesced points give smoother lines at low frame rates; some browsers return none
      let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      const minStep = this.W / 700;
      let moved = 0;
      for (const ev of evs) {
        const p = this.toSheet(ev.clientX, ev.clientY);
        if (!p) continue;
        const last = this.current[this.current.length - 1];
        const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
        if (d < minStep) continue;
        this.current.push(p);
        this.pen = p;
        moved += d * PX * 0.5;
      }
      this.game.audio.scratch(moved);
    });
    const end = () => {
      if (!this.current) return;
      this.current = null;
      this.game.audio.scratchStop();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    document.getElementById('air-done').addEventListener('click', () => this.finish());
    document.getElementById('air-undo').addEventListener('click', () => this.undo());
    document.getElementById('air-clear').addEventListener('click', () => {
      if (this.phase === 'draw') this.strokes = [];
    });
    document.getElementById('air-cancel').addEventListener('click', () => this.close(true));
    document.getElementById('air-ghost').addEventListener('click', () => this.toggleGhost());
    // the reference photo: tap to see it big, arrows to switch to another photo from the album
    const zoom = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.refEl.classList.toggle('zoom');
    };
    document.getElementById('air-zoom').addEventListener('click', zoom);
    this.refCanvas.addEventListener('click', zoom);
    document.getElementById('air-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycle(-1);
    });
    document.getElementById('air-next').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycle(1);
    });
    this.countEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.phase === 'draw') this.game.album.show((id) => this.pick(id));
    });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (this.game.album.open) {
        if (e.code === 'Escape') this.game.album.hide();
        return;
      }
      if (e.code === 'Escape') {
        if (this.refEl.classList.contains('zoom')) this.refEl.classList.remove('zoom');
        else this.close(true);
      } else if (e.code === 'BracketLeft' || e.code === 'PageUp') this.cycle(-1);
      else if (e.code === 'BracketRight' || e.code === 'PageDown') this.cycle(1);
      else if (e.code === 'Enter') {
        if (this.phase === 'grade') this.startPlop();
        else this.finish();
      } else if (e.code === 'Backspace' || (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey))) this.undo();
    });
  }

  // screen point -> position on the floating sheet, in metres from its centre (u right, v up)
  toSheet(clientX, clientY) {
    const cam = this.game.camera;
    _ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, cam);
    const r = _ray.ray;
    const den = r.direction.dot(this.N);
    if (Math.abs(den) < 1e-6) return null;
    const t = _a.copy(this.C).sub(r.origin).dot(this.N) / den;
    if (t <= 0) return null;
    _b.copy(r.origin).addScaledVector(r.direction, t).sub(this.C);
    const mx = this.W / 2 + 0.25;
    const my = this.H / 2 + 0.25;
    return [Math.max(-mx, Math.min(mx, _b.dot(this.U))), Math.max(-my, Math.min(my, _b.dot(this.V)))];
  }

  world(u, v, out) {
    return out.copy(this.C).addScaledVector(this.U, u).addScaledVector(this.V, v);
  }

  show(bpId) {
    const g = this.game;
    this.strokes = [];
    this.current = null;
    this.res = null;
    this.pen = null;
    this.phase = 'draw';
    this.t = 0;
    this.ghost = false;
    this.traced = false;
    this.ghostBtn.classList.remove('on');
    this.refEl.classList.remove('zoom');
    this.el.classList.remove('hidden');
    this.footEl.classList.remove('hidden');
    document.body.classList.add('air-drawing');
    this.setBp(bpId);
    // camera behind the hero's right shoulder, looking where he faces; the sheet hangs in front
    const p = g.player;
    g.camRig.yaw = p.yaw;
    g.camRig.pitch = -0.04;
    g.camRig.curDist = this.camOpts.dist;
    g.camRig.update(0, p.pos, this.camOpts);
    g.camera.updateMatrixWorld();
    this.setupSheet();
    this.setDanger(false);
  }

  // which photo is being drawn (the reference in the corner, the title, the ghost)
  setBp(id) {
    const bp = BLUEPRINTS[id];
    this.bp = bp;
    this.ghostPts = null;
    this.ids = this.game.album.ids();
    if (!this.ids.includes(id)) this.ids.push(id);
    const i = this.ids.indexOf(id);
    this.titleEl.textContent = `מציירים באוויר: ${bp.name}`;
    this.refCaption.textContent = bp.name;
    this.countEl.textContent = `${i + 1}/${this.ids.length} ▦`;
    this.refEl.classList.toggle('single', this.ids.length < 2);
    const rc = this.refCanvas;
    const rctx = rc.getContext('2d');
    rctx.fillStyle = '#f7f4ec';
    rctx.fillRect(0, 0, rc.width, rc.height);
    drawBlueprint(rctx, bp, 0, 0, rc.width, rc.height, { pad: 0.08, seed: 3, width: 5 });
    this.game.drawPick = id;
  }

  cycle(dir) {
    if (this.phase !== 'draw' || this.ids.length < 2) return;
    const i = this.ids.indexOf(this.bp.id);
    this.pick(this.ids[(i + dir + this.ids.length) % this.ids.length]);
  }

  pick(id) {
    if (this.phase !== 'draw' || !id || id === this.bp.id) return;
    if (this.strokes.length) {
      this.strokes = [];
      this.current = null;
      this.game.audio.play('erase', 0.5);
    }
    this.game.audio.play('pageflip', 0.5);
    this.setBp(id);
  }

  toggleGhost() {
    if (this.phase !== 'draw') return;
    this.ghost = !this.ghost;
    if (this.ghost) this.traced = true;
    this.ghostBtn.classList.toggle('on', this.ghost);
    if (this.ghost) this.game.hud.toast(`נייר העתקה: עוברים על הקווים הכחולים (ציון עד ${TRACED_MAX})`, 'info', 2.6);
  }

  setupSheet() {
    const cam = this.game.camera;
    const fwd = _a.set(0, 0, -1).applyQuaternion(cam.quaternion);
    this.U.set(1, 0, 0).applyQuaternion(cam.quaternion);
    this.V.set(0, 1, 0).applyQuaternion(cam.quaternion);
    this.N.copy(fwd).negate();
    const D = 3.6;
    const vh = 2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const vw = vh * cam.aspect;
    this.H = vh * 0.6;
    this.W = Math.min(this.H * 1.45, vw * 0.78);
    this.C.copy(cam.position).addScaledVector(fwd, D).addScaledVector(this.U, vw * 0.07).addScaledVector(this.V, vh * 0.03);
  }

  setDanger(on, text) {
    if (this.dangerOn === on && !text) return;
    this.dangerOn = on;
    this.dangerEl.classList.toggle('on', !!on);
    this.statusEl.classList.toggle('danger', !!on);
    this.statusEl.textContent = on ? text || '⚠ תוקפים אותך!' : text || 'שקט… אפשר לצייר';
  }

  undo() {
    if (this.phase !== 'draw') return;
    this.strokes.pop();
  }

  finish() {
    if (this.phase !== 'draw') return;
    const W = this.W;
    const H = this.H;
    const strokesPx = this.strokes.map((s) => s.map(([u, v]) => [(u + W / 2) * PX, (H / 2 - v) * PX]));
    const ink = strokesPx.reduce((a, s) => a + s.length, 0);
    if (ink < 6) {
      this.game.hud.toast('עוד לא ציירתם כלום באוויר…', 'info');
      return;
    }
    const res = scoreDrawing(strokesPx, this.bp);
    if (this.traced && res.score > TRACED_MAX) {
      res.score = TRACED_MAX;
      res.grade = gradeOf(res.score);
    }
    this.res = res;
    this.refEl.classList.remove('zoom');
    if (this.game.album.open) this.game.album.hide();
    this.strokesPx = strokesPx;
    this.current = null;
    this.game.audio.scratchStop();
    this.phase = 'grade';
    this.t = 0;
    this.footEl.classList.add('hidden');
    this.renderSticker(res);
    this.game.audio.play(res.grade === 'fail' ? 'fail' : res.grade === 'wonky' ? 'meh' : 'ding');
  }

  renderSticker(res) {
    const c = this.stickerCanvas;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    const sk = new Sketcher(g, 7);
    sk.circle(400, 92, 72, { width: 7, color: RED_CSS, passes: 2 });
    sk.text(`${res.score}`, 400, 96, { size: 74, color: RED_CSS, font: FONT_HAND, dir: 'ltr', weight: 400 });
    const list = COMMENTS[res.grade];
    sk.text(list[Math.floor(Math.random() * list.length)], 300, 200, { size: 54, color: RED_CSS, font: FONT_HAND, align: 'right', weight: 400 });
    sk.stroke([[40, 228], [300, 222]], { width: 5, color: RED_CSS, passes: 1 });
    const missing = [];
    this.bp.strokes.forEach((st, i) => {
      if (res.partCoverage[i] < 0.38 && !missing.includes(st.label)) missing.push(st.label);
    });
    if (missing.length) sk.text(`חסר: ${missing.slice(0, 3).join(', ')}`, 300, 268, { size: 34, color: RED_CSS, font: FONT_HAND, align: 'right', weight: 400 });
    if (this.traced) sk.text('(העתקה)', 150, 70, { size: 38, color: RED_CSS, font: FONT_HAND, weight: 400 });
    this.stickerTex.needsUpdate = true;
    const sw = this.W * 0.42;
    this.sticker.material.uniforms.uSize.value.set(sw, sw * (c.height / c.width));
    this.world(this.W * 0.38, this.H * 0.36, this.sticker.position);
    this.sticker.visible = true;
  }

  startPlop() {
    if (this.phase !== 'grade') return;
    const g = this.game;
    const p = g.player;
    this.phase = 'plop';
    this.t = 0;
    this.sticker.visible = false;
    if (this.bp.kind === 'weapon') {
      this.target.copy(p.fig.j.handR);
      this.targetScale = 0.1;
    } else {
      const f = p.fig.forward;
      const len = { car: 4.4, tank: 7.2, ufo: 9 }[this.bp.id] || 5;
      const d = len * 0.5 + 3;
      this.target.set(p.pos.x + f.x * d, p.pos.y + 1.0, p.pos.z + f.z * d);
      this.targetScale = Math.max(0.5, len / this.W);
    }
    g.audio.play('swing', 0.6);
  }

  finishPlop() {
    const g = this.game;
    const res = this.res;
    const bp = this.bp;
    const strokesPx = this.strokesPx;
    g.audio.play('plop');
    g.fx.crumbs(this.target.x, this.target.y, this.target.z, 26, 4.5);
    this.hide();
    g.onDrawingDone(bp, res, strokesPx);
  }

  close(cancelled = false) {
    if (!this.open) return;
    if (cancelled && this.phase === 'draw' && this.strokes.length) {
      // the ink fades out of the air
      this.phase = 'cancel';
      this.t = 0;
      this.current = null;
      this.footEl.classList.add('hidden');
      this.game.audio.scratchStop();
      this.game.audio.play('erase', 0.6);
      return;
    }
    this.hide();
    this.game.onDrawClosed(cancelled);
  }

  hide() {
    this.phase = 'idle';
    this.current = null;
    this.pen = null;
    this.el.classList.add('hidden');
    this.refEl.classList.remove('zoom');
    if (this.game.album.open) this.game.album.hide();
    document.body.classList.remove('air-drawing');
    this.sticker.visible = false;
    this.game.audio.scratchStop();
    this.game.player.fig.reachR = null;
    this.batch.clear();
    this.batch.commit();
  }

  // called every frame by the game
  frame(dt) {
    if (this.phase === 'idle') return;
    this.t += dt;
    const g = this.game;
    const b = this.batch;
    b.clear();
    if (this.phase === 'draw' || this.phase === 'grade') {
      this.drawGuides(b, this.phase === 'draw' ? 1 : Math.max(0, 1 - this.t * 2));
      if (this.ghost) this.drawGhost(b, this.phase === 'draw' ? 1 : Math.max(0, 1 - this.t * 3));
      this.drawStrokes(b, 1, -1);
      if (this.phase === 'grade') {
        this.drawCorrections(b, Math.min(1, this.t * 3));
        if (this.t > 1.8) this.startPlop();
      }
    } else if (this.phase === 'plop') {
      const k = Math.min(1, this.t / 0.42);
      this.drawStrokes(b, 1, k);
      if (k >= 1) {
        b.commit();
        this.finishPlop();
        return;
      }
    } else if (this.phase === 'cancel') {
      const k = Math.min(1, this.t / 0.32);
      this.drawStrokes(b, 1 - k, -1);
      if (k >= 1) {
        b.commit();
        this.hide();
        this.game.onDrawClosed(true);
        return;
      }
    }
    b.commit();
    // the hero's hand follows the pen tip
    const fig = g.player.fig;
    if (this.phase === 'draw' && this.pen) {
      this.world(this.pen[0], this.pen[1], this.penWorld);
      fig.reachR = this.penWorld;
    } else if (this.phase === 'draw') {
      fig.reachR = this.world(-this.W * 0.2, 0, this.penWorld);
    } else fig.reachR = null;
    // danger: someone is coming for you while you draw
    if (this.phase === 'draw') {
      const p = g.player;
      let threat = g.time - (p.lastHurt || -9) < 1.2;
      if (!threat) {
        for (const e of g.enemies.list) {
          if (!e.hostile) continue;
          if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 30) {
            threat = true;
            break;
          }
        }
      }
      this.setDanger(threat);
    }
  }

  drawGuides(b, alpha) {
    if (alpha <= 0) return;
    const hw = this.W / 2;
    const hh = this.H / 2;
    const L = Math.min(this.W, this.H) * 0.12;
    const corners = [[-hw, hh, 1, -1], [hw, hh, -1, -1], [hw, -hh, -1, 1], [-hw, -hh, 1, 1]];
    let s = 1;
    for (const [u, v, du, dv] of corners) {
      this.seg(b, u, v, u + du * L, v, GUIDE, 0.85 * alpha, 3, s++);
      this.seg(b, u, v, u, v + dv * L, GUIDE, 0.85 * alpha, 3, s++);
    }
  }

  // tracing paper: the photo's lines, faint and blue, hanging in the middle of the sheet
  drawGhost(b, alpha) {
    if (alpha <= 0) return;
    if (!this.ghostPts) {
      const bb = blueprintBounds(this.bp);
      const s = Math.min((this.W * 0.8) / bb.w, (this.H * 0.8) / bb.h);
      const cx = bb.x0 + bb.w / 2;
      const cy = bb.y0 + bb.h / 2;
      this.ghostPts = this.bp.strokes.map((st) => st.pts.map(([x, y]) => [(x - cx) * s, -(y - cy) * s]));
    }
    let seed = 500;
    for (const pts of this.ghostPts) {
      for (let i = 1; i < pts.length; i++) this.seg(b, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], GHOST, 0.8 * alpha, 3.4, seed++);
    }
  }

  seg(b, u0, v0, u1, v1, col, a, w, seed, plopK = -1) {
    this.world(u0, v0, _a);
    this.world(u1, v1, _b);
    if (plopK >= 0) {
      this.plopPoint(_a, plopK);
      this.plopPoint(_b, plopK);
    }
    b.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, col[0], col[1], col[2], a, w, seed, 0.01, 0.004);
  }

  // during the plop every point flies to the target, shrinking (weapon) or growing (vehicle)
  plopPoint(p, k) {
    const e = easeIn(k);
    const s = 1 + (this.targetScale - 1) * k;
    _d.copy(p).sub(this.C).multiplyScalar(s).add(this.target);
    p.lerp(_d, e);
  }

  drawStrokes(b, alpha, plopK) {
    if (alpha <= 0) return;
    let seed = 11;
    for (const s of this.strokes) {
      if (s.length === 1) {
        const [u, v] = s[0];
        this.seg(b, u - 0.01, v, u + 0.01, v + 0.005, INK_C, alpha, 3.6, seed++, plopK);
        continue;
      }
      for (let i = 1; i < s.length; i++) this.seg(b, s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], INK_C, alpha, 3.4, seed++, plopK);
    }
  }

  // the teacher's red pen: ghost of the right shape and circles around what is missing
  drawCorrections(b, k) {
    const res = this.res;
    if (!res || !res.transform) return;
    const T = res.transform;
    const W = this.W;
    const H = this.H;
    const toSheet = ([X, Y]) => {
      const X0 = (X - T.cx - T.ddx) / T.ksx + T.cx;
      const Y0 = (Y - T.cy - T.ddy) / T.ksy + T.cy;
      const x = (X0 - T.tx) / T.sx;
      const y = (Y0 - T.ty) / T.sy;
      return [x / PX - W / 2, H / 2 - y / PX];
    };
    let seed = 300;
    this.bp.strokes.forEach((st, i) => {
      const pts = st.pts.map(toSheet);
      for (let j = 1; j < pts.length; j++) this.seg(b, pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], RED, 0.42 * k, 2.4, seed++);
      if (res.partCoverage[i] >= 0.38) return;
      let u0 = Infinity;
      let v0 = Infinity;
      let u1 = -Infinity;
      let v1 = -Infinity;
      for (const [u, v] of pts) {
        u0 = Math.min(u0, u);
        v0 = Math.min(v0, v);
        u1 = Math.max(u1, u);
        v1 = Math.max(v1, v);
      }
      const cu = (u0 + u1) / 2;
      const cv = (v0 + v1) / 2;
      const r = Math.max(0.1, Math.max(u1 - u0, v1 - v0) * 0.65);
      const n = 18;
      for (let j = 0; j < n; j++) {
        const a0 = (j / n) * Math.PI * 2 * k;
        const a1 = ((j + 1) / n) * Math.PI * 2 * k;
        this.seg(b, cu + Math.cos(a0) * r, cv + Math.sin(a0) * r * 0.8, cu + Math.cos(a1) * r, cv + Math.sin(a1) * r * 0.8, RED, 0.9, 3.2, seed++);
      }
    });
  }
}
