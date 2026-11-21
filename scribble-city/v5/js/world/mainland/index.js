import * as THREE from 'three';
import { makeSurface, releaseLights } from '../../render/materials.js';
import { canvas } from '../kit.js';
import { M_BLOCKS, MAINLAND_ON } from './plan.js';
import { Streamer } from './stream.js';
import { buildMBlock } from './blocks.js';
import { groundTiles, buildGroundTile } from './tiles.js';
import { FarShells } from './far.js';
import { LANDMARK_CELLS } from './landmarks.js';

// (v5, ROADMAP 11.17) The mainland, alive: what is built near you (the streamer), what stands
// for the rest from afar (the far bodies), and how the city's systems hear of a block coming and
// going (its shops, its lights, its props). Made after the island is built (world/city.js).

// ------------------------------------------------------------------ the neon of the mainland
// The island's neon is one picture made once and let go of (world/paint.js NeonAtlas). The
// mainland's signs come and go with their blocks: a picture of 128 places, each sign written into
// its place when a block wants it, and only that place sent to the graphics card; a place no block
// shown needs any more is the next one written over.
export class MainNeon {
  constructor(renderer, cols = 4, rows = 32, cw = 512, ch = 128) {
    this.r = renderer;
    this.cols = cols;
    this.rows = rows;
    this.cw = cw;
    this.ch = ch;
    this.W = cols * cw;
    this.H = rows * ch;
    const data = new Uint8Array(this.W * this.H * 2);
    this.tex = new THREE.DataTexture(data, this.W, this.H, THREE.RGFormat);
    this.tex.flipY = false;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
    this.slot = canvas(cw, ch);
    this.slotTex = new THREE.CanvasTexture(this.slot);
    this.slotTex.flipY = false;
    this.slotTex.generateMipmaps = false;
    this.slotTex.format = THREE.RGFormat;
    this.cache = new Map();
    this.uses = new Map();
    this.free = [];
    for (let i = cols * rows - 1; i >= 0; i--) this.free.push(i);
    this.pending = [];
    this.n = 0;
    this.missed = 0;
  }

  // a block's sign: its place in the picture (written now if it has none) - [u0, v0, u1, v1]
  add(text, { font = 'Caveat', size = 75, italic = false } = {}) {
    const key = `${text}|${font}|${size}|${italic}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.uses.set(key, (this.uses.get(key) || 0) + 1);
      if (this.owner) this.owner.push(key);
      return hit.r;
    }
    let i = this.free.pop();
    if (i === undefined) {
      // a place no block needs now
      for (const [k, e] of this.cache) {
        if ((this.uses.get(k) || 0) > 0) continue;
        this.cache.delete(k);
        i = e.i;
        break;
      }
    }
    if (i === undefined) {
      this.missed++;
      return null;
    }
    const x0 = (i % this.cols) * this.cw;
    const y0 = Math.floor(i / this.cols) * this.ch;
    const r = [x0 / this.W, y0 / this.H, (x0 + this.cw) / this.W, (y0 + this.ch) / this.H];
    this.cache.set(key, { r, i });
    this.uses.set(key, 1);
    if (this.owner) this.owner.push(key);
    this.pending.push({ text, font, size, italic, x0, y0 });
    this.n++;
    return r;
  }

  // a block let go of: its signs' places may be written over
  release(keys) {
    for (const k of keys) this.uses.set(k, Math.max(0, (this.uses.get(k) || 0) - 1));
    keys.length = 0;
  }

  // the places written since: up to the graphics card, a place at a time
  flush(max = 64) {
    let n = 0;
    while (this.pending.length && n < max) {
      const p = this.pending.shift();
      const g = this.slot.getContext('2d');
      g.save();
      g.fillStyle = '#000';
      g.fillRect(0, 0, this.cw, this.ch);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let sz = p.size;
      g.font = `${p.italic ? 'italic ' : ''}700 ${sz}px "${p.font}", "Rubik", sans-serif`;
      const max2 = this.cw * 0.92;
      const tw = g.measureText(p.text).width;
      if (tw > max2) {
        sz = Math.floor((sz * max2) / tw);
        g.font = `${p.italic ? 'italic ' : ''}700 ${sz}px "${p.font}", "Rubik", sans-serif`;
      }
      const cx = this.cw / 2;
      const cy = this.ch / 2;
      g.lineJoin = 'round';
      g.lineWidth = sz * 0.11;
      g.strokeStyle = '#f00';
      g.strokeText(p.text, cx, cy);
      g.globalCompositeOperation = 'lighter';
      g.lineWidth = sz * 0.045;
      g.strokeStyle = 'rgb(0, 255, 0)';
      g.strokeText(p.text, cx, cy);
      g.restore();
      try {
        this.write(p.x0, p.y0);
      } catch (e) {
        console.warn('[neon] copy failed', e);
      }
      n++;
    }
  }

  // (ROADMAP 11.47) the slot straight into its place in the picture on the graphics card. three.js's
  // copyTextureToTexture first asks the card five questions about how it unpacks pictures, and each
  // answer makes the processor wait for the card to finish everything it was given: a stall at
  // every sign a block brings (on a phone the whole frame, and more)
  write(x0, y0) {
    const r = this.r;
    const gl = r.getContext();
    if (!this.onCard) {
      r.initTexture(this.tex);
      this.onCard = true;
    }
    const t = r.properties.get(this.tex).__webglTexture;
    if (!t) return;
    r.state.activeTexture(gl.TEXTURE0);
    r.state.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, gl.RG, gl.UNSIGNED_BYTE, this.slot);
  }
}

// ------------------------------------------------------------------ the mainland
export class Mainland {
  constructor(world, o = {}) {
    this.world = world;
    this.on = MAINLAND_ON;
    this.renderer = o.renderer || null;
    this.listeners = [];
    if (!this.on) return;
    const M = world.ctx.M;
    // the mainland's own pens where they differ from the island's: its signs' neon
    // (v5, ROADMAP 11.30: a picture of 224 places on a computer - downtown round the mega mall
    // wants more than 128 signs at once; 128 on a phone)
    this.neon = new MainNeon(this.renderer, 4, o.low ? 32 : 56);
    const signNeon = makeSurface({ kind: 'neon', neonMask: true, vcolor: true, alphaTest: 0.5, emissive: new THREE.Color(2.0, 2.0, 2.0), line: 0.15, side: THREE.DoubleSide, noShadow: true });
    signNeon.uniforms.uMap.value = this.neon.tex;
    signNeon.uniforms.uUseMap.value = 1;
    world.mainM = Object.assign(Object.create(M), { signNeon });
    world.mainNeon = this.neon;
    // (the sign pen made ready with the city's: a speck of it, out of sight under the bay)
    const speck = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), signNeon);
    speck.position.set(-450, -30, 0);
    world.group.add(speck);
    this.far = new FarShells(world, o.farData || null, M.wallSolid);
    // (every plot to draw a home on, from the bake: [key, x, z] - the map, game/friend.js)
    world.allPlots = (o.farData && o.farData.plots) || [];
    world.allStands = (o.farData && o.farData.stands) || [];
    // (a phone: the blocks in full within 150 m; past that their far bodies, world/mainland/far.js)
    const near = o.low ? 150 : 230;
    const cells = M_BLOCKS.map((b) => ({
      id: `b${b.id}`,
      rect: { x0: b.rect.x0 - 12, x1: b.rect.x1 + 12, z0: b.rect.z0 - 12, z1: b.rect.z1 + 12 },
      near,
      far: near + 90,
      block: b,
      build: (c) => this.buildBlock(c.block),
    }));
    // the pier's shops and rides, the beach, the Point, the bayfront (world/mainland/landmarks.js)
    for (const b of LANDMARK_CELLS) {
      cells.push({
        id: b.id,
        rect: { x0: b.rect.x0 - 8, x1: b.rect.x1 + 8, z0: b.rect.z0 - 8, z1: b.rect.z1 + 8 },
        near,
        far: near + 90,
        block: b,
        build: (c) => this.buildBlock(c.block),
      });
    }
    // the streets, a tile at a time (they are seen from further off than the blocks' insides)
    const gnear = o.low ? 190 : 280;
    for (const t of groundTiles()) cells.push({ id: t.id, rect: t.rect, near: gnear, far: gnear + 90, tile: t, build: (c) => buildGroundTile(this.world, c.tile) });
    this.pipe = o.pipe || null;
    this.stream = new Streamer(cells, { budget: o.low ? 2.5 : 3, rush: o.low ? 6 : 8, adaptive: !!o.low, warm: (m) => this.warm(m) });
    this.blocks = new Map();
    // (the graphics card's copy of a mesh made before it is shown: drawn once, alone, into a
    // speck of a picture nobody sees)
    this.warmRT = new THREE.WebGLRenderTarget(4, 4);
    this.warmScene = new THREE.Scene();
    this.warmCam = new THREE.OrthographicCamera(-1e5, 1e5, 1e5, -1e5, -1e5, 1e5);
    this.farAt = null;
  }

  // (ROADMAP 11.47) First the shaders it will be drawn with - its pen's, and the twin of it the
  // still city wears (render/solid.js) - asked of the graphics card and not waited for: where the
  // card makes shaders alongside the game (KHR_parallel_shader_compile) the frame never stands still
  // for one (on a phone a second or more each, the picture frozen); the mesh waits instead, a few
  // frames at most (false: not yet). Then drawn once, alone, into a speck of a picture nobody sees
  // (its buffers up to the card). true once it is ready
  warm(m) {
    const r = this.renderer;
    if (!r) return true;
    const parent = m.parent;
    const vis = m.visible;
    const mat0 = m.material;
    this.warmScene.add(m);
    m.visible = true;
    const was = r.getRenderTarget();
    let ready = true;
    try {
      r.setRenderTarget(this.warmRT);
      const ud = m.userData;
      if (!ud.warmProgs) {
        const progs = [];
        for (const mat of [mat0, this.pipe && this.pipe.solid ? this.pipe.solid.twinFor(mat0) : null]) {
          if (!mat || Array.isArray(mat)) continue;
          m.material = mat;
          for (const x of r.compile(this.warmScene, this.warmCam)) {
            const prog = r.properties.get(x).currentProgram;
            if (prog) progs.push(prog);
          }
        }
        m.material = mat0;
        ud.warmProgs = progs;
        ud.warmT0 = performance.now();
      }
      // (never more than a few seconds: then the frame makes what is left, as before)
      ready = ud.warmProgs.every((p) => p.isReady()) || performance.now() - ud.warmT0 > 4000;
      if (ready) {
        r.render(this.warmScene, this.warmCam);
        delete ud.warmProgs;
        delete ud.warmT0;
      }
    } catch (e) {
      console.warn('[stream] warm failed', e);
      ready = true;
    } finally {
      m.material = mat0;
    }
    r.setRenderTarget(was);
    this.warmScene.remove(m);
    m.visible = vis;
    if (parent) parent.add(m);
    return ready;
  }

  // a cell's group into the city (one of the groups the renderer was given at the start), and its
  // meshes into everything the renderer keeps of the still city; and out again
  show(group, key) {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const bucket = this.world.buckets[h % this.world.buckets.length];
    bucket.add(group);
    group.updateMatrixWorld(true);
    if (this.pipe) this.pipe.addStatic(group);
  }

  hide(group) {
    if (this.pipe) this.pipe.removeStatic(group);
    if (group.parent) group.parent.remove(group);
  }

  *buildBlock(b) {
    // (the block's signs: their places kept while it is here)
    const keys = [];
    this.neon.owner = keys;
    let live;
    try {
      const it = buildMBlock(this.world, b);
      for (;;) {
        this.neon.owner = keys;
        const r = it.next();
        this.neon.owner = null;
        if (r.done) {
          live = r.value;
          break;
        }
        yield;
      }
    } finally {
      this.neon.owner = null;
    }
    live.neonKeys = keys;
    return live;
  }

  // a block shown or let go of (blocks.js live.attach / detach)
  onBlock(live, on) {
    const b = live.block;
    if (on) this.blocks.set(b.id, live);
    else {
      this.blocks.delete(b.id);
      this.neon.release(live.neonKeys || []);
    }
    if (!b.landmark) this.far.setNear(b, on);
    // (the roofs the rain stops at are drawn again: render/rain.js)
    this.world.roofVer = (this.world.roofVer || 0) + 1;
    for (const f of this.listeners) f(live, on);
  }

  // systems that want to hear of blocks coming and going: fn(live, on)
  listen(fn) {
    this.listeners.push(fn);
  }

  update(dt, pos, vel) {
    if (!this.on) return;
    this.stream.update(pos.x, pos.z, vel ? vel.x : 0, vel ? vel.z : 0);
    this.neon.flush(8);
    // (the blocks built or let go of: where people can walk, worked out again a little a frame)
    const nav = this.world.nav;
    if (nav && nav.pump) nav.pump(1.2);
    // the far shadows go with you on the mainland (the island's own box when you are back there)
    if (this.pipe && this.pipe.farMaps) {
      const onMain = pos.x < -330;
      const want = onMain ? [Math.round(pos.x / 200) * 200, Math.round(pos.z / 200) * 200] : null;
      const key = want ? want.join(',') : 'island';
      if (key !== this.farAt) {
        this.farAt = key;
        const box = want
          ? new THREE.Box3(new THREE.Vector3(want[0] - 360, -1, want[1] - 360), new THREE.Vector3(want[0] + 360, 260, want[1] + 360))
          : new THREE.Box3(new THREE.Vector3(-262, -1, -600), new THREE.Vector3(36, 95, 345));
        this.pipe.moveFarShadows(box);
      }
    }
  }

  // a block built again where it is (a house drawn on one of its plots: game/friend.js); the old
  // one stays shown until the new one is all there
  rebuild(blockId) {
    if (!this.on) return false;
    return this.stream.rebuild(`b${blockId}`);
  }

  // everything near p built now (the start; a jump across the map)
  fill(p, ms) {
    if (!this.on) return;
    this.stream.fill(p.x, p.z, ms);
    this.neon.flush(1e9);
    if (this.world.interiors) this.world.interiors.fill(p.x, p.z, ms, p.y !== undefined ? p.y : null);
    const nav = this.world.nav;
    if (nav && nav.pump) nav.pump(1e9);
  }

  // (tools/mainland-bake.mjs) every block built once, not shown, and its buildings' bodies kept:
  // what the far bodies are made of (far.json). Returns { [blockId]: [[x0, z0, x1, z1, top, hex]] }
  bake(ids = null) {
    const out = {};
    const times = [];
    const releaseAll = (live) => {
      const bctx = live.bctx;
      this.world.objects.releaseLocal(bctx.props);
      releaseLights(bctx.lightOwner);
      this.neon.release(live.neonKeys || []);
      live.group.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
    };
    for (const b of M_BLOCKS) {
      if (ids && !ids.includes(b.id)) continue;
      const t0 = performance.now();
      const it = this.buildBlock(b);
      let r;
      do r = it.next();
      while (!r.done);
      const live = r.value;
      const list = [];
      for (const f of live.bctx.footprints) {
        if (f.pool || f.lot || f.tower || f.top === undefined) continue;
        const c = f.color && f.color.isColor ? '#' + f.color.getHexString() : typeof f.color === 'string' ? f.color : '#e6d6cc';
        const q = [+f.x0.toFixed(2), +f.z0.toFixed(2), +f.x1.toFixed(2), +f.z1.toFixed(2), +f.top.toFixed(2), c];
        // (its foot, if it stands over the street: a bridge, the gate over the avenue)
        if (f.y0 !== undefined) q.push(+f.y0.toFixed(2));
        list.push(q);
      }
      out[b.id] = list;
      // (the stands where a friend is drawn: for the map)
      for (const s of live.bctx.shops) if (s.kind === 'friends') (out.stands = out.stands || []).push([+s.door[0].toFixed(1), +s.door[2].toFixed(1)]);
      // (the plots to draw a home on: where they are, for the map and for a friend looking for one)
      for (const p of live.bctx.plots || []) {
        const f = p.f;
        (out.plots = out.plots || []).push([p.key, +(f.ox + f.ux * p.L * 0.5 - f.nx * 1).toFixed(2), +(f.oz + f.uz * p.L * 0.5 - f.nz * 1).toFixed(2)]);
      }
      times.push({ id: b.id, kind: b.kind, ms: Math.round(performance.now() - t0), verts: live.verts });
      releaseAll(live);
    }
    // (the landmarks' own cells: no far bodies - the landmarks are always there - only their friend
    // stands, for the map)
    if (!ids) {
      for (const b of LANDMARK_CELLS) {
        const t0 = performance.now();
        const it = this.buildBlock(b);
        let r;
        do r = it.next();
        while (!r.done);
        const live = r.value;
        for (const s of live.bctx.shops) if (s.kind === 'friends') (out.stands = out.stands || []).push([+s.door[0].toFixed(1), +s.door[2].toFixed(1)]);
        times.push({ id: b.id, kind: b.kind, ms: Math.round(performance.now() - t0), verts: live.verts });
        releaseAll(live);
      }
    }
    return { data: out, times };
  }

  info() {
    if (!this.on) return null;
    let verts = 0;
    for (const l of this.blocks.values()) verts += l.verts;
    return { ...this.stream.info(), verts, signs: this.neon.n, signsMissed: this.neon.missed };
  }
}
