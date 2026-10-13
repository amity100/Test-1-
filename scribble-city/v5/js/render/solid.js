import * as THREE from 'three';

// (v5) The still city's pens without their scissors (ROADMAP 11.1ה).
//
// The pens' shader may throw a pixel away: a hole the eraser rubbed in a wall, a prop crumbling
// away, a hole in somebody, a cut-out leaf. Where a shader may do that and writes the depth, the
// graphics cards of most phones (and the software one) test the depth only after the shader has
// run, so every pixel of every triangle is worked out with the pens, hidden or not. At the test
// route's spot that was 2.8 million pixels a frame for a picture of 0.7 million (the walls, drawn
// from both sides, 1.1 million of them for the 80 thousand that show).
//
// Each piece of the still city whose pens never cut out a shape (no cut-out leaf, no picture with
// holes) gets a twin of its pen without the scissors (SOLID, render/glsl.js), and wears it whenever
// nothing of it can be thrown away: no rubbed-out spot within reach of it and, if it has props
// that crumble, none crumbling anywhere. Otherwise it wears its own pen. The same pixels either way.

// what a twin copies of its pen besides the shader (the uniforms are the pen's own: shared)
const COPY = [
  'name', 'side', 'vertexColors', 'transparent', 'opacity', 'visible', 'depthWrite', 'depthTest', 'depthFunc', 'colorWrite',
  'blending', 'blendSrc', 'blendDst', 'blendEquation', 'blendSrcAlpha', 'blendDstAlpha', 'blendEquationAlpha',
  'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'forceSinglePass', 'alphaToCoverage', 'premultipliedAlpha',
  'toneMapped', 'fog', 'lights', 'clipping', 'precision', 'dithering', 'wireframe', 'extensions',
];

function twin(m) {
  const t = new THREE.ShaderMaterial({ glslVersion: m.glslVersion, uniforms: m.uniforms, defines: { ...m.defines, SOLID: '' }, vertexShader: m.vertexShader, fragmentShader: m.fragmentShader });
  for (const k of COPY) if (m[k] !== undefined) t[k] = m[k];
  t.userData = m.userData;
  t.solidOf = m;
  return t;
}

// the pen a piece of the still city really has (its own, even while it wears the twin): for a
// thing made from a piece of it (a prop knocked off its place, game/knock.js)
export function ownPen(mat) {
  return (mat && mat.solidOf) || mat;
}

// a rubbed-out spot's reach (render/glsl.js erasedAt: nothing beyond 1.27 of its radius)
const REACH = 1.3;

export class Solid {
  constructor() {
    this.list = [];
    this.twins = new Map();
    this.key = NaN;
    // (the test route: every piece in its own pen, to time it against the twins)
    this.forceFull = false;
  }

  // root: the still city; spots(): the rubbed-out spots ({ x, y, z, r }); fading(): is a prop
  // crumbling away now
  setup(root, spots, fading) {
    this.spots = spots;
    this.fading = fading;
    root.updateMatrixWorld(true);
    // (not the parts that move, the big wheel: their boxes go with them)
    const visit = (o) => {
      if (o.userData.dynamic) return;
      this.consider(o);
      for (const c of o.children) visit(c);
    };
    visit(root);
    this.key = NaN;
    this.update();
  }

  // a piece of the still city: in the list if its pens never cut out a shape
  consider(o) {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    const m = o.material;
    if (!m.isShaderMaterial || !m.uniforms || !m.uniforms.uKind || m.transparent || !m.depthWrite) return;
    // (the pens' own shader, and a thing drawn once: not the people's, not a car's)
    if (!m.fragmentShader.includes('#ifndef SOLID')) return;
    const d = m.defines || {};
    if (d.SOLID !== undefined || d.USE_PULL !== undefined || d.USE_INSTANCING !== undefined || d.USE_CABIN !== undefined) return;
    // the pens drawn in it (the city's batches say; a draw of many pens that does not is left as
    // it is)
    const pens = o.userData.pens && o.userData.pens.length ? o.userData.pens : d.USE_MATTAB !== undefined ? null : [m];
    if (!pens) return;
    let erase = !!(m.uniforms.uErasable && m.uniforms.uErasable.value > 0.5);
    for (const p of pens.concat(m)) {
      const u = p.uniforms || {};
      // (a cut-out leaf, a picture with holes: always its own pen)
      if (u.uAlphaTest && u.uAlphaTest.value > 0) return;
      if (u.uErasable && u.uErasable.value > 0.5) erase = true;
    }
    let t = this.twins.get(m);
    if (!t) {
      t = twin(m);
      this.twins.set(m, t);
    }
    const box = new THREE.Box3().setFromObject(o);
    if (box.isEmpty()) return;
    this.list.push({ o, full: m, solid: t, erase, obj: d.USE_OBJ !== undefined, box });
  }

  // every frame: each piece in its twin, or in its own pen where something of it may be thrown
  // away (only worked out again when the spots or the crumbling change)
  update() {
    if (!this.list.length) return;
    const S = this.spots ? this.spots() : null;
    const n = S ? S.length : 0;
    const fading = !!(this.fading && this.fading());
    let key = (fading ? 1 : 0) + n * 2 + (this.forceFull ? 1e9 : 0);
    for (let i = 0; i < n; i++) {
      const s = S[i];
      key = key * 1.000003 + s.x * 0.71 + s.y * 1.37 + s.z * 1.93 + s.r * 2.39;
    }
    if (key === this.key) return;
    this.key = key;
    for (const c of this.list) {
      let full = this.forceFull || (c.obj && fading);
      if (!full && c.erase && n) {
        const b = c.box;
        for (let i = 0; i < n; i++) {
          const s = S[i];
          const m = s.r * REACH + 0.05;
          if (s.x > b.min.x - m && s.x < b.max.x + m && s.y > b.min.y - m && s.y < b.max.y + m && s.z > b.min.z - m && s.z < b.max.z + m) {
            full = true;
            break;
          }
        }
      }
      const o = c.o;
      // (only between the two: a pass that put a pen of its own on it puts it back itself)
      if (o.material === c.full || o.material === c.solid) o.material = full ? c.full : c.solid;
    }
  }

  // the pieces' own pens, to be made ready in the background (the first rubbed-out spot or
  // crumbling prop then wears one without a pause): a scene of stand-ins, one per pen
  standIns() {
    const scene = new THREE.Scene();
    const seen = new Set();
    for (const c of this.list) {
      if (seen.has(c.full)) continue;
      seen.add(c.full);
      const s = new THREE.Mesh(c.o.geometry, c.full);
      s.frustumCulled = false;
      scene.add(s);
    }
    return scene;
  }
}
