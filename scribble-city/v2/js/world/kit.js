import * as THREE from 'three';

// Building kit: geometry merged per material (one draw per material), each part keeping an
// id of its own so the inker can see where one part ends and the next begins.

let partSeed = 7;
export function nextId() {
  partSeed = (partSeed * 16807) % 2147483647;
  return (partSeed % 100000) / 100000;
}

export class Batch {
  constructor() {
    this.groups = new Map(); // material -> [{ geo, id }]
  }

  // add a geometry (already placed in world space, or with a matrix) with a part id
  add(material, geo, matrix = null, id = nextId()) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.groups.has(material)) this.groups.set(material, []);
    this.groups.get(material).push({ geo: g, id });
    return id;
  }

  box(material, x0, y0, z0, x1, y1, z1, id) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(material, g, null, id);
  }

  flush(scene, opts = {}) {
    const meshes = [];
    for (const [mat, list] of this.groups) {
      let n = 0;
      for (const it of list) n += it.geo.attributes.position.count;
      const pos = new Float32Array(n * 3);
      const nor = new Float32Array(n * 3);
      const uv = new Float32Array(n * 2);
      const ids = new Float32Array(n);
      let o = 0;
      for (const it of list) {
        const g = it.geo;
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array, o * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
        uv.set(g.attributes.uv.array, o * 2);
        ids.fill(it.id, o, o + c);
        o += c;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      Object.assign(m.userData, opts);
      scene.add(m);
      meshes.push(m);
    }
    this.groups.clear();
    return meshes;
  }
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// a rough hand: a line drawn twice with a little wobble
export function handLine(g, pts, w, col, passes = 2, jit = 1.5) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    g.strokeStyle = col;
    g.lineWidth = w * (p ? 0.7 : 1);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (Math.random() - 0.5) * jit;
      const jy = y + (Math.random() - 0.5) * jit;
      if (i === 0) g.moveTo(jx, jy);
      else g.lineTo(jx, jy);
    });
    g.stroke();
  }
}

export const rand = (() => {
  let s = 4242;
  const f = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
})();
