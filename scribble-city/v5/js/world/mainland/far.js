import * as THREE from 'three';
import { srgb, hex } from '../../render/materials.js';
import { seeded, nextId } from '../kit.js';
import { skyscraper } from '../skyline.js';
import { M_BLOCKS, towersOf, CURB } from './plan.js';

// (v5, ROADMAP 11.17) The mainland from afar: what is always there, wherever you are.
// - its towers, built once at the start (they are what you see of it from the island: the skyline
//   across the bay, now standing on the blocks they belong to);
// - every other building as a plain body in its own colours (FarShells): the footprints the block
//   itself makes when it is built (baked once into far.json by tools/mainland-bake.mjs, so the
//   body from afar is the building up close), merged a tile of blocks at a time; a tile is merged
//   again without the blocks that are built near you, so a building is never drawn twice.

const CROWNS = ['#ff5ad1', '#3fe8ff', '#ffb43f', '#9b6bff', '#ffe14f', '#5aff8a'].map(hex);

export function buildMainlandTowers(ctx) {
  const M = ctx.M;
  const out = [];
  for (const b of M_BLOCKS) {
    const ts = towersOf(b);
    if (!ts.length) continue;
    const r = seeded(b.seed * 13 + 5);
    for (const t of ts) {
      const o = {
        mats: ctx.towerMats || [M.wall],
        steel: M.steel,
        neon: M.neon,
        rand: r,
        chunk: `mt_${b.district}_${Math.floor(b.row / 3)}`,
        trimCol: srgb(0.86, 0.82, 0.92),
        crownCol: r.pick(CROWNS),
        style: t.style,
        podium: t.podium,
        solids: [],
      };
      const peak = skyscraper(ctx, t.x, t.z, t.w, t.d, t.h, o);
      out.push({ ...t, peak, block: b.id, solids: o.solids });
    }
  }
  return out;
}

// the tiles of the far bodies: 3 x 3 blocks each
const TILE = 3;
const tileOf = (b) => `${Math.floor(b.col / TILE)},${Math.floor(b.row / TILE)}`;

export class FarShells {
  /**
   * data: { [blockId]: [[x0, z0, x1, z1, top, colorHex, y0?], ...] } (far.json; y0: its foot, when it
   * stands over the street - a bridge); mat: the pen
   */
  constructor(world, data, mat) {
    this.world = world;
    this.data = data || {};
    this.mat = mat;
    this.group = new THREE.Group();
    this.group.name = 'mainlandFar';
    this.tiles = new Map();
    this.near = new Set();
    for (const b of M_BLOCKS) {
      const k = tileOf(b);
      if (!this.tiles.has(k)) this.tiles.set(k, { key: k, blocks: [], mesh: null, dirty: true });
      this.tiles.get(k).blocks.push(b);
    }
    world.group.add(this.group);
    for (const t of this.tiles.values()) this.rebuild(t);
  }

  // a block is built near you (its far bodies go), or let go of (they come back)
  setNear(b, on) {
    if (on) this.near.add(b.id);
    else this.near.delete(b.id);
    const t = this.tiles.get(tileOf(b));
    if (t) this.rebuild(t);
  }

  rebuild(t) {
    if (t.mesh) {
      this.group.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh = null;
    }
    const pos = [];
    const nor = [];
    const col = [];
    const ids = [];
    const c = new THREE.Color();
    const face = (a, b, d, e, n, cc, id) => {
      for (const p of [a, b, d, a, d, e]) {
        pos.push(p[0], p[1], p[2]);
        nor.push(n[0], n[1], n[2]);
        col.push(cc.r, cc.g, cc.b);
        ids.push(id);
      }
    };
    for (const b of t.blocks) {
      if (this.near.has(b.id)) continue;
      const list = this.data[b.id];
      if (!list) continue;
      for (const s of list) {
        const [x0, z0, x1, z1, top, hx] = s;
        if (top < CURB + 1) continue;
        c.set(hx || '#e8d8d0');
        const id = nextId();
        const y0 = s[6] !== undefined ? s[6] : CURB - 0.2;
        const y1 = top;
        // four walls and the roof (a little darker: the parapet's shadow)
        face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c, id);
        face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], c, id);
        face([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], c, id);
        face([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], c, id);
        const roof = c.clone().multiplyScalar(0.82);
        face([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], roof, id);
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.setAttribute('aId', new THREE.Float32BufferAttribute(ids, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.mat);
    m.name = `far ${t.key}`;
    m.matrixAutoUpdate = false;
    m.userData.static = true;
    m.userData.farShell = true;
    this.group.add(m);
    t.mesh = m;
    if (this.world.onStaticChange) this.world.onStaticChange(m);
  }
}
