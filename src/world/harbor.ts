import * as THREE from 'three';
import { CollisionWorld, Collider } from './collision';
import { MeshBuilder } from './builder';
import * as TX from './textures';

export interface LampDef {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  color: number;
  range: number;
  angle: number;
  intensity: number;
  /** Lamp is on a pole (draw pole) or hanging/wall mounted. */
  kind: 'pole' | 'hang' | 'wall';
}

export interface GuardDef {
  id: string;
  kind: 'guard' | 'heavy' | 'officer' | 'sniper';
  route: THREE.Vector3[];
  wait: number[];
  facing?: number;
  /** Never leaves its post (towers, decks). */
  static?: boolean;
  /** Searchlight sweep half-angle (radians). */
  sweep?: number;
  fov?: number;
  range?: number;
}

export interface Inhibitor {
  center: THREE.Vector3;
  radius: number;
  active: boolean;
  generator: THREE.Vector3;
}

export interface LevelData {
  world: CollisionWorld;
  root: THREE.Group;
  lamps: LampDef[];
  guards: GuardDef[];
  playerStart: THREE.Vector3;
  playerYaw: number;
  manifest: THREE.Vector3;
  keycardDoor: Collider;
  doorMesh: THREE.Object3D;
  inhibitor: Inhibitor;
  generatorMesh: THREE.Object3D;
  extraction: THREE.Vector3;
  elevatorTop: THREE.Vector3;
  sunDir: THREE.Vector3;
  water: THREE.Mesh;
  navBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  animated: ((t: number) => void)[];
  materials: Record<string, THREE.Material>;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * PIER 9 — a walled port compound at dusk, built so that walking is never
 * enough:
 *  - you start on a 16m rooftop across a canal (no stairs, no bridge on your
 *    side): the first rift is mandatory;
 *  - the compound wall is 6.5m of concrete; only a guarded mesh gate lets you
 *    see inside, or you climb a container stack to look over it;
 *  - the central plaza is swept by a searchlight sniper: crossing it on foot
 *    is suicide, crossing it cover-to-cover by rift is the point;
 *  - the target sits on a control-tower deck 18m up, reached by a keycard
 *    elevator or, once the warehouse inhibitor is sabotaged, by rift from a
 *    crane boom or the warehouse roof;
 *  - extraction is a helicopter on a barge out on the water.
 */
export function buildHarbor(envMap: THREE.Texture | null, mobile: boolean): LevelData {
  const world = new CollisionWorld();
  const mb = new MeshBuilder();
  const root = new THREE.Group();
  root.name = 'pier9';
  const texSize = mobile ? 256 : 512;
  const animated: ((t: number) => void)[] = [];

  // ---------- Materials ----------
  const asph = TX.asphalt(texSize * 2 > 1024 ? 1024 : texSize * 2);
  const conc = TX.concrete(texSize, 3);
  const corr = TX.corrugated(texSize);
  const envI = 0.7;
  const materials: Record<string, THREE.Material> = {
    asphalt: new THREE.MeshStandardMaterial({ map: asph.map, roughnessMap: asph.roughnessMap, normalMap: asph.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0.05, vertexColors: true, envMap, envMapIntensity: envI * 1.3 }),
    concrete: new THREE.MeshStandardMaterial({ map: conc.map, roughnessMap: conc.roughnessMap, normalMap: conc.normalMap, roughness: 1, vertexColors: true, envMap, envMapIntensity: envI }),
    container: new THREE.MeshStandardMaterial({ map: corr.map, roughnessMap: corr.roughnessMap, normalMap: corr.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 0.5, vertexColors: true, envMap, envMapIntensity: envI }),
    metal: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.75, vertexColors: true, envMap, envMapIntensity: envI, roughnessMap: conc.roughnessMap }),
    cladding: new THREE.MeshStandardMaterial({ map: corr.map, roughnessMap: corr.roughnessMap, normalMap: corr.normalMap, roughness: 1, metalness: 0.4, vertexColors: true, envMap, envMapIntensity: envI }),
    floor: new THREE.MeshStandardMaterial({ map: conc.map, roughnessMap: conc.roughnessMap, roughness: 0.55, vertexColors: true, envMap, envMapIntensity: envI }),
  };

  /** Solid box: collider + merged mesh. */
  const solid = (key: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, uv = 3, col: Partial<Collider> = {}, mesh: { skipBottom?: boolean } = {}) => {
    const c = world.add(V(x0, y0, z0), V(x1, y1, z1), col);
    mb.box(key, V(x0, y0, z0), V(x1, y1, z1), color, uv, { skipBottom: mesh.skipBottom ?? y0 <= 0.01 });
    return c;
  };

  // ---------- Land, canal, harbour ----------
  // south bank (city side, where you start)
  world.add(V(-112, -2, -102), V(112, 0, -68), { tag: 'ground' });
  mb.box('asphalt', V(-112, -2, -102), V(112, 0, -68), 0xffffff, 9, { skipBottom: true });
  // north bank (outer yard + compound + quay)
  world.add(V(-112, -2, -45), V(112, 0, 72), { tag: 'ground' });
  mb.box('asphalt', V(-112, -2, -45), V(112, 0, 72), 0xffffff, 9, { skipBottom: true });
  // quay curbs
  for (const z of [-68.4, -45, 71.4]) {
    world.add(V(-112, 0, z), V(112, 0.25, z + 0.6));
    mb.box('concrete', V(-112, -2, z), V(112, 0.25, z + 0.6), 0xb4afa6, 3);
  }
  // bridge over the canal (the loud way in)
  solid('concrete', 60, -1, -68, 68, 0, -45, 0x8e8a84, 3, { tag: 'bridge' });
  for (const x of [60, 67.8]) {
    world.add(V(x, 0, -68), V(x + 0.2, 1.1, -45), { seeThrough: true, noPortal: true });
    mb.box('metal', V(x, 0.9, -68), V(x + 0.2, 1.1, -45), 0x9aa0a6, 2);
    for (let z = -68; z <= -45; z += 2.3) mb.box('metal', V(x + 0.05, 0, z), V(x + 0.15, 1.0, z + 0.1), 0x9aa0a6, 2);
  }

  // Sea (reflective, animated normals)
  const waterN = TX.waterNormals(256);
  waterN.repeat.set(60, 60);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x0b1a24, roughness: 0.08, metalness: 0.2, normalMap: waterN, normalScale: new THREE.Vector2(0.3, 0.3), envMap, envMapIntensity: 1.2 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.1, 0);
  water.receiveShadow = true;
  root.add(water);
  animated.push((t) => waterN.offset.set(t * 0.004, t * 0.007));

  // Invisible level bounds
  world.add(V(-120, -5, -104), V(120, 40, -102), { noPortal: true, tag: 'bound' });
  world.add(V(-114, -5, -104), V(-112, 40, 110), { noPortal: true, tag: 'bound' });
  world.add(V(112, -5, -104), V(114, 40, 110), { noPortal: true, tag: 'bound' });
  world.add(V(-120, -5, 108), V(120, 40, 110), { noPortal: true, tag: 'bound' });

  // ---------- Mesh / chain-link panels (see-through, block walking) ----------
  const fenceTex = TX.chainLink(256);
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.4, envMap, envMapIntensity: envI });
  const addMesh = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.PlaneGeometry(len, h);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 1.6, (uv.getY(i) * h) / 1.6);
    const m = new THREE.Mesh(g, fenceMat);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.castShadow = true;
    root.add(m);
    world.add(V(Math.min(x0, x1) - 0.15, 0, Math.min(z0, z1) - 0.15), V(Math.max(x0, x1) + 0.15, h, Math.max(z0, z1) + 0.15), { seeThrough: true, noPortal: true, tag: 'fence' });
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {
      const px = x0 + ((x1 - x0) * i) / n, pz = z0 + ((z1 - z0) * i) / n;
      mb.box('metal', V(px - 0.08, 0, pz - 0.08), V(px + 0.08, h + 0.1, pz + 0.08), 0x4a4f55, 2);
    }
  };

  // ---------- SOUTH BANK: city blocks, your starting rooftop ----------
  const building = (x0: number, z0: number, x1: number, z1: number, h: number, col: number, parapet = true) => {
    solid('concrete', x0, 0, z0, x1, h, z1, col, 4, { tag: 'building' });
    // window bands
    for (let y = 2.2; y < h - 1; y += 3.2) {
      mb.box('metal', V(x0 - 0.03, y, z0 + 0.8), V(x1 + 0.03, y + 1.1, z1 - 0.8), 0x1a2733, 2);
      mb.box('metal', V(x0 + 0.8, y, z0 - 0.03), V(x1 - 0.8, y + 1.1, z1 + 0.03), 0x1a2733, 2);
    }
    if (parapet) {
      // see-through railing: stops you walking off, never blocks a rift's aim
      const t = 0.12, ph = 1.1;
      const railSeg = (a0: number, b0: number, a1: number, b1: number) => {
        world.add(V(a0, h, b0), V(a1, h + ph, b1), { seeThrough: true, noPortal: true, tag: 'rail' });
        mb.box('metal', V(a0, h + ph - 0.08, b0), V(a1, h + ph, b1), 0xb9bec4, 2);
      };
      railSeg(x0, z0, x1, z0 + t);
      railSeg(x0, z1 - t, x1, z1);
      railSeg(x0, z0, x0 + t, z1);
      railSeg(x1 - t, z0, x1, z1);
      for (let x = x0; x <= x1; x += 1.6) {
        mb.box('metal', V(x, h, z0), V(x + 0.06, h + ph, z0 + t), 0xb9bec4, 2);
        mb.box('metal', V(x, h, z1 - t), V(x + 0.06, h + ph, z1), 0xb9bec4, 2);
      }
      for (let z = z0; z <= z1; z += 1.6) {
        mb.box('metal', V(x0, h, z), V(x0 + t, h + ph, z + 0.06), 0xb9bec4, 2);
        mb.box('metal', V(x1 - t, h, z), V(x1, h + ph, z + 0.06), 0xb9bec4, 2);
      }
    }
  };
  building(-100, -96, -78, -74, 16, 0xa39a8c); // Old Customs House — start
  solid('metal', -97, 16, -93, -93, 19.5, -89, 0x5b6168, 2); // roof water tank
  solid('metal', -84, 16, -94, -80, 17.6, -91, 0x6d737a, 2); // AC units
  building(-70, -95, -52, -76, 10, 0x8c8478);
  building(-44, -96, -26, -80, 12, 0x9a9184);
  building(-12, -94, 12, -78, 7, 0x7f7a72);
  building(28, -96, 50, -82, 9, 0x958d80);
  building(80, -96, 100, -78, 11, 0x8a8277);

  // ---------- OUTER YARD (between canal and compound wall) ----------
  const WALL_Z0 = -10.5, WALL_Z1 = -9.5, WALL_H = 6.5;
  solid('concrete', -112, 0, WALL_Z0, -5, WALL_H, WALL_Z1, 0xb8b2a6, 3, { tag: 'wall' });
  solid('concrete', 5, 0, WALL_Z0, 112, WALL_H, WALL_Z1, 0xb8b2a6, 3, { tag: 'wall' });
  // wall cap + hazard stripe
  mb.box('metal', V(-112, WALL_H, WALL_Z0 - 0.1), V(-5, WALL_H + 0.2, WALL_Z1 + 0.1), 0x3a3d42, 2);
  mb.box('metal', V(5, WALL_H, WALL_Z0 - 0.1), V(112, WALL_H + 0.2, WALL_Z1 + 0.1), 0x3a3d42, 2);
  // the steel-mesh gate: you can look through it, not walk through it
  addMesh(-5, -10, 5, -10, WALL_H);
  mb.box('metal', V(-5.6, 0, -10.6), V(-4.9, WALL_H + 1, -9.4), 0xd8b020, 2);
  mb.box('metal', V(4.9, 0, -10.6), V(5.6, WALL_H + 1, -9.4), 0xd8b020, 2);
  // gatehouse
  solid('concrete', 8, 0, -21, 15, 3, -15, 0xd0cabe, 2, { tag: 'gatehouse' });
  mb.box('metal', V(7.8, 3, -21.2), V(15.2, 3.3, -14.8), 0x2d3035, 2);
  // stepped container stacks — the climbable vantage points over the wall
  const stepStack = (x0: number, dir: 1 | -1, z0: number) => {
    const cz0 = z0, cz1 = z0 + 2.44;
    const L = (a: number, b: number) => (dir > 0 ? [x0 + a, x0 + b] : [x0 - b, x0 - a]);
    const [cx0, cx1] = L(1.2, 13.2);
    solid('container', ...([cx0, 0, cz0, cx1, 2.6, cz1] as [number, number, number, number, number, number]), 0x2e6b8a, 2.4, { tag: 'container' });
    const [bx0, bx1] = L(5.2, 13.2);
    solid('container', bx0, 2.6, cz0, bx1, 5.2, cz1, 0xa33a2a, 2.4, { tag: 'container' });
    const [ax0, ax1] = L(9.2, 13.2);
    solid('container', ax0, 5.2, cz0, ax1, 7.8, cz1, 0xc98a1f, 2.4, { tag: 'container' });
    const [kx0, kx1] = L(0, 1.2);
    solid('container', kx0, 0, cz0 + 0.6, kx1, 1.1, cz1 - 0.6, 0x7b5a36, 1.2, { tag: 'crate' });
  };
  stepStack(-62, 1, -22);
  stepStack(44, -1, -24);
  // parked trailers + cover
  const trailer = (x: number, z: number, rotX: boolean, col: number) => {
    const [sx, sz] = rotX ? [12, 2.6] : [2.6, 12];
    solid('container', x - sx / 2, 1.0, z - sz / 2, x + sx / 2, 3.6, z + sz / 2, col, 2.4, { tag: 'trailer' }, { skipBottom: true });
    world.add(V(x - sx / 2, 0, z - sz / 2), V(x + sx / 2, 1.0, z + sz / 2));
    mb.box('metal', V(x - sx / 2 + 0.3, 0, z - sz / 2 + 0.3), V(x + sx / 2 - 0.3, 1.0, z + sz / 2 - 0.3), 0x1d1f22, 2);
  };
  trailer(-30, -33, true, 0xd9d4c7);
  trailer(-12, -26, true, 0x6e7f5a);
  trailer(24, -36, true, 0xc4c0b4);
  trailer(80, -24, false, 0x8a3b2a);
  trailer(-86, -32, false, 0x4c5b6b);

  const crate = (x: number, z: number, s = 1.25, h = 1.1) => solid('container', x - s / 2, 0, z - s / 2, x + s / 2, h, z + s / 2, 0x7b5a36, 1.2, { tag: 'crate' });
  [[-44, -38], [-43.2, -36.9], [-4, -38], [30, -18], [58, -30], [95, -40], [-100, -20], [-70, -40]].forEach(([x, z], i) => crate(x, z, 1.3, i % 2 ? 1.1 : 1.3));
  // bridge checkpoint booth
  solid('concrete', 69.5, 0, -44, 73.5, 2.8, -40, 0xd4d0c8, 2, { tag: 'booth' });

  // ---------- COMPOUND: west container yard ----------
  const r = rng(90210);
  const palette = [0x9e2b25, 0x1f4e79, 0x2e6b3a, 0xc27c1a, 0x6a6e73, 0x7a2f58, 0x2a8a8c, 0xb5a33a, 0x3c3c46, 0xa34d1f];
  const segs: [number, number][] = [[-104, -91.8], [-88.8, -76.6], [-73.6, -61.4], [-58.4, -46.2]];
  const CH = 2.6, CW = 2.44;
  const decals: { pos: THREE.Vector3; rotY: number; tex: number }[] = [];
  for (let blk = 0; blk < 6; blk++) {
    for (let row = 0; row < 2; row++) {
      const z = blk * 10 + CW / 2 + row * CW;
      for (let si = 0; si < segs.length; si++) {
        const [sx0, sx1] = segs[si];
        let h = 1 + Math.floor(r() * 3.2);
        if (h > 3) h = 3;
        for (let k = 0; k < h; k++) {
          const jitter = (r() - 0.5) * 0.3;
          const col = palette[Math.floor(r() * palette.length)];
          const x0 = sx0 + jitter, x1 = sx1 + jitter;
          const y0 = k * CH;
          mb.box('container', V(x0, y0, z - CW / 2), V(x1, y0 + CH, z + CW / 2), col, 2.4, { skipBottom: k === 0 });
          for (const cx of [x0, x1 - 0.12]) for (const cz of [z - CW / 2 - 0.01, z + CW / 2 - 0.11]) mb.box('metal', V(cx, y0, cz), V(cx + 0.12, y0 + CH, cz + 0.12), 0x1a1a1a, 2);
          world.add(V(x0, y0, z - CW / 2), V(x1, y0 + CH, z + CW / 2), { tag: 'container' });
          if (r() < 0.3 && decals.length < 30) {
            const side = row === 0 ? -1 : 1;
            decals.push({ pos: V((x0 + x1) / 2, y0 + CH * 0.62, z + side * (CW / 2 + 0.02)), rotY: side > 0 ? 0 : Math.PI, tex: Math.floor(r() * 4) });
          }
        }
      }
    }
  }
  const names = ['OKEANOS', 'NORDLINE', 'KESTREL', 'HALCYON'];
  const decalMats = names.map((n) => new THREE.MeshStandardMaterial({ map: TX.stencil(n), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.8, metalness: 0.3 }));
  for (let ti = 0; ti < 4; ti++) {
    const geos: THREE.BufferGeometry[] = [];
    for (const d of decals.filter((d) => d.tex === ti)) {
      const g = new THREE.PlaneGeometry(4.2, 1.05);
      g.rotateY(d.rotY);
      g.translate(d.pos.x, d.pos.y, d.pos.z);
      geos.push(g);
    }
    if (geos.length) root.add(new THREE.Mesh(mergeGeos(geos), decalMats[ti]));
  }

  // ---------- COMPOUND: plaza + searchlight tower ----------
  [[-20, 10], [-19, 11.2], [14, 12], [-10, 34], [22, 38], [-26, 45], [7, -3], [28, 20], [-28, 22], [4, 42]].forEach(([x, z], i) => crate(x, z, 1.4, i % 3 === 0 ? 1.4 : 1.1));
  // forklift-sized cover
  solid('metal', -6, 0, 14, -3.6, 2.1, 15.6, 0xd8a820, 2, { tag: 'forklift' });
  solid('metal', 11, 0, 30, 13.4, 2.1, 31.6, 0xd8a820, 2, { tag: 'forklift' });
  // searchlight tower
  solid('metal', -1.5, 0, 20.5, 1.5, 11.6, 23.5, 0x5a5f66, 2, { tag: 'tower' });
  solid('metal', -3, 11.6, 19, 3, 12, 25, 0x3a3e44, 2, { tag: 'towerdeck' });
  for (const [a, b] of [[-3, 19], [2.8, 19], [-3, 24.8], [2.8, 24.8]]) mb.box('metal', V(a, 12, b), V(a + 0.2, 13.1, b + 0.2), 0x3a3e44, 2);

  // ---------- COMPOUND: warehouse ----------
  const WX0 = 38, WX1 = 95, WZ0 = 0, WZ1 = 45, WH = 12, T = 0.5;
  const clad = 0x5d6b78;
  const wall = (x0: number, z0: number, x1: number, z1: number, y0 = 0, y1 = WH) => solid('cladding', x0, y0, z0, x1, y1, z1, clad, 2.2, { tag: 'wall' });
  wall(WX0, WZ0, WX0 + T, 18);
  wall(WX0, 26, WX0 + T, WZ1);
  wall(WX0, 18, WX0 + T, 26, 5.5, WH);
  wall(WX0, WZ0, 60, WZ0 + T);
  wall(63, WZ0, WX1, WZ0 + T);
  wall(60, WZ0, 63, WZ0 + T, 3, WH);
  wall(WX0, WZ1 - T, WX1, WZ1);
  wall(WX1 - T, WZ0, WX1, WZ1);
  // roof with three open skylights (x ranges) over z[18,26]
  const roof = (x0: number, z0: number, x1: number, z1: number) => solid('metal', x0, WH, z0, x1, WH + 0.4, z1, 0x3a4048, 3, { tag: 'roof' });
  roof(WX0, WZ0, WX1, 18);
  roof(WX0, 26, WX1, WZ1);
  for (const [a, b] of [[WX0, 50], [56, 66], [72, 82], [88, WX1]]) roof(a, 18, b, 26);
  for (const [a, b] of [[50, 56], [66, 72], [82, 88]]) {
    mb.box('metal', V(a - 0.15, WH + 0.4, 17.85), V(b + 0.15, WH + 0.7, 18.15), 0xd8b020, 2);
    mb.box('metal', V(a - 0.15, WH + 0.4, 25.85), V(b + 0.15, WH + 0.7, 26.15), 0xd8b020, 2);
  }
  mb.box('floor', V(WX0 + T, 0, WZ0 + T), V(WX1 - T, 0.02, WZ1 - T), 0x8d8a85, 4, { skipBottom: true });
  mb.box('metal', V(WX0 - 0.1, 5.3, 17.8), V(WX0 + T + 0.1, 5.7, 26.2), 0xd8b020, 2);
  // racks
  const rack = (x0: number, z0: number, x1: number, z1: number) => {
    world.add(V(x0, 0, z0), V(x1, 4.6, z1), { tag: 'rack' });
    for (let lvl = 0; lvl < 3; lvl++) {
      const y = 0.1 + lvl * 1.5;
      mb.box('metal', V(x0, y, z0), V(x1, y + 0.1, z1), 0xc05a1c, 2);
      for (let x = x0 + 0.2; x < x1 - 1; x += 1.6) mb.box('container', V(x, y + 0.1, z0 + 0.1), V(x + 1.3, y + 1.15, z1 - 0.1), 0x8a6a45, 1.2);
    }
    for (let x = x0; x <= x1; x += (x1 - x0) / 5) mb.box('metal', V(x - 0.06, 0, z0), V(x + 0.06, 4.6, z0 + 0.12), 0x1f4e79, 2);
  };
  rack(48, 7.4, 80, 8.8);
  rack(48, 15.4, 76, 16.8);
  rack(52, 29.4, 80, 30.8);
  // catwalk along the north wall + stairs up the east side
  solid('metal', 40, 5.6, 38, 94.5, 6, 44.5, 0x4a5058, 2, { tag: 'catwalk' });
  world.add(V(40, 6, 37.9), V(88.8, 7.1, 38.1), { seeThrough: true, noPortal: true });
  mb.box('metal', V(40, 6.95, 37.9), V(88.8, 7.1, 38.1), 0xd8b020, 2);
  for (let x = 40; x < 88.8; x += 2) mb.box('metal', V(x, 6, 37.95), V(x + 0.08, 7.0, 38.05), 0xd8b020, 2);
  for (let i = 0; i < 15; i++) solid('metal', 89, 0, 23 + i, 93, 0.4 * (i + 1), 24 + i, 0x4a5058, 2, { tag: 'stairs' });

  // inhibitor generator on the catwalk
  const inhibitor: Inhibitor = { center: V(24, 19, 60), radius: 10.5, active: true, generator: V(72, 6, 41.5) };
  world.add(V(71.4, 6, 40.9), V(72.6, 7.6, 42.1), { tag: 'generator', noPortal: true });
  const gen = new THREE.Group();
  const genBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.8, roughness: 0.35, envMap }));
  genBody.position.y = 0.8;
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb050ff).multiplyScalar(5) }));
  coil.position.y = 1.75;
  coil.rotation.x = Math.PI / 2;
  gen.add(genBody, coil);
  gen.position.copy(inhibitor.generator);
  root.add(gen);
  // the inhibitor's field around the tower deck (visible dome)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(inhibitor.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); float hex = step(0.92, fract(vW.y * 2.0 - uTime * 0.4)) * 0.35; float a = (f * 0.55 + hex * f) ; gl_FragColor = vec4(vec3(0.7, 0.3, 1.0) * a * 1.6, a); }`,
    }),
  );
  dome.position.set(inhibitor.center.x, 17.9, inhibitor.center.z);
  root.add(dome);
  animated.push((t) => {
    coil.rotation.z = t * 2;
    coil.visible = inhibitor.active;
    dome.visible = inhibitor.active;
    (dome.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  });

  // ---------- COMPOUND: control tower (the objective) ----------
  solid('concrete', 18, 0, 54, 30, 17.6, 66, 0xc9c3b8, 3, { tag: 'ctower' });
  for (let y = 3; y < 17; y += 3.5) mb.box('metal', V(17.97, y, 55), V(30.03, y + 1.2, 65), 0x1a2733, 2);
  solid('metal', 16, 17.6, 52, 32, 18, 68, 0x3a3e44, 2, { tag: 'cdeck' });
  // deck railing (see-through)
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    world.add(V(x0, 18, z0), V(x1, 19.1, z1), { seeThrough: true, noPortal: true });
    mb.box('metal', V(x0, 18.95, z0), V(x1, 19.1, z1), 0xd8b020, 2);
  };
  rail(16, 52, 32, 52.15);
  rail(16, 67.85, 32, 68);
  rail(16, 52, 16.15, 68);
  rail(31.85, 52, 32, 68);
  // operations booth with the terminal
  solid('concrete', 21, 18, 59, 27, 20.8, 65, 0xe0dbd0, 2, { tag: 'booth' });
  mb.box('metal', V(20.8, 20.8, 58.8), V(27.2, 21.1, 65.2), 0x2d3035, 2);
  const monitor = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5ab0ff).multiplyScalar(2.2) }));
  monitor.position.set(24, 19.3, 58.97);
  monitor.rotation.y = Math.PI;
  root.add(monitor);
  mb.box('metal', V(23, 18, 58.3), V(25, 19.0, 59), 0x30343a, 1);
  // radar dish on the booth
  const radar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.25), new THREE.MeshStandardMaterial({ color: 0xdedede, metalness: 0.6, roughness: 0.3 }));
  radar.position.set(24, 21.8, 62);
  root.add(radar);
  animated.push((t) => (radar.rotation.y = t * 0.9));
  // elevator head on the deck (the way back down)
  solid('concrete', 22.6, 18, 52.3, 25.4, 20.6, 53.4, 0xe0dbd0, 2, { tag: 'lifthead', noPortal: true });
  const liftDoor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 0.06), new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.85, roughness: 0.25, envMap }));
  liftDoor.position.set(24, 19.15, 53.44);
  root.add(liftDoor);
  // elevator door + keycard reader at the tower base
  const keycardDoor = world.add(V(22.8, 0, 53.7), V(25.2, 2.4, 54), { tag: 'door', noPortal: true });
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.85, roughness: 0.25, envMap }));
  doorMesh.position.set(24, 1.2, 53.95);
  root.add(doorMesh);
  const readerLight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2020).multiplyScalar(4) }));
  readerLight.position.set(26, 1.35, 53.9);
  doorMesh.userData.reader = readerLight;
  root.add(readerLight);

  // ---------- North quay + gantry cranes ----------
  const crane = (cx: number) => {
    const col = 0xc9a227;
    for (const [lx, lz] of [[cx - 8, 59], [cx + 8, 59], [cx - 8, 67], [cx + 8, 67]]) {
      world.add(V(lx - 0.6, 0, lz - 0.6), V(lx + 0.6, 23, lz + 0.6), { tag: 'crane' });
      mb.box('metal', V(lx - 0.6, 0, lz - 0.6), V(lx + 0.6, 23, lz + 0.6), col, 3);
    }
    mb.box('metal', V(cx - 8.6, 22, 58.4), V(cx + 8.6, 23.4, 59.6), col, 3);
    mb.box('metal', V(cx - 8.6, 22, 66.4), V(cx + 8.6, 23.4, 67.6), col, 3);
    world.add(V(cx - 1.5, 23.4, 44), V(cx + 1.5, 25, 100), { tag: 'boom' });
    mb.box('metal', V(cx - 1.5, 23.4, 44), V(cx + 1.5, 25, 100), col, 3);
    solid('metal', cx - 3, 25, 54, cx + 3, 28, 59, 0x2f3a45, 3);
    mb.box('metal', V(cx - 8.6, 6, 58.6), V(cx + 8.6, 6.8, 59.4), col, 3);
    mb.box('metal', V(cx - 8.6, 6, 66.6), V(cx + 8.6, 6.8, 67.4), col, 3);
    mb.box('metal', V(cx - 0.05, 12, 84), V(cx + 0.05, 23.4, 84.1), 0x111111, 3);
    mb.box('metal', V(cx - 3, 11.5, 83.2), V(cx + 3, 12, 84.8), 0x333333, 3);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a1a).multiplyScalar(6) }));
    w.position.set(cx, 28.4, 56.5);
    root.add(w);
    animated.push((t) => (w.visible = Math.sin(t * 2.4 + cx) > 0.1));
  };
  crane(-50);
  crane(-15);
  for (let x = -100; x < 110; x += 9) {
    world.add(V(x - 0.2, 0, 70.4), V(x + 0.2, 0.7, 70.8));
    mb.box('metal', V(x - 0.2, 0, 70.4), V(x + 0.2, 0.7, 70.8), 0x1c1c1c);
  }

  // ---------- Barge with the extraction helicopter ----------
  solid('metal', -42, -2, 82, -10, 0.45, 98, 0x27323c, 3, { tag: 'barge' });
  mb.box('metal', V(-42.2, 0.45, 81.8), V(-9.8, 0.85, 82.1), 0xd8b020, 2);
  mb.box('metal', V(-42.2, 0.45, 97.9), V(-9.8, 0.85, 98.2), 0xd8b020, 2);
  world.add(V(-42.2, 0.45, 81.8), V(-9.8, 0.85, 82.1), { seeThrough: true, noPortal: true });
  world.add(V(-42.2, 0.45, 97.9), V(-9.8, 0.85, 98.2), { seeThrough: true, noPortal: true });
  solid('container', -36, 0.45, 90.5, -30, 3.2, 92.94, 0x2a8a8c, 2.4, { tag: 'container' });
  solid('container', -16, 0.45, 85, -13.5, 2.0, 88, 0x7b5a36, 1.2, { tag: 'crate' });
  const pad = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.3).multiplyScalar(1.6) }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(-22, 0.48, 91);
  root.add(pad);
  const heli = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1f262d, metalness: 0.5, roughness: 0.4, envMap });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 5.5), hullMat);
  body.position.y = 1.6;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 5), hullMat);
  tail.position.set(0, 2.1, -5);
  const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 5), hullMat);
  skid.position.y = 0.2;
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.35), hullMat);
  rotor.position.y = 3.0;
  heli.add(body, tail, skid, rotor);
  heli.position.set(-22, 0.45, 91);
  heli.rotation.y = 0.4;
  heli.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o.castShadow = true), (o.receiveShadow = true)) : null));
  root.add(heli);
  animated.push((t) => (rotor.rotation.y = t * 0.6));
  world.add(V(-23.4, 0.45, 88.4), V(-20.6, 2.9, 93.6), { tag: 'heli' });
  const extraction = V(-25.5, 0.45, 88.5);

  // ---------- Distant city skyline ----------
  const winTex = TX.windows(256);
  const skyMat = new THREE.MeshBasicMaterial({ map: winTex, color: 0x9aa3b8, fog: false });
  const sr = rng(4242);
  const skyGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 110; i++) {
    const w = 10 + sr() * 22, h = 18 + sr() * 80, d = 10 + sr() * 14;
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * w) / 24 + sr(), (uv.getY(k) * h) / 40);
    const ang = (i / 110) * Math.PI * 2 + (sr() - 0.5) * 0.03;
    const dist = 380 + sr() * 100;
    g.translate(Math.sin(ang) * dist, h / 2 - 8, Math.cos(ang) * dist);
    skyGeos.push(g);
  }
  root.add(new THREE.Mesh(mergeGeos(skyGeos), skyMat));

  // ---------- Lamps (dusk: floodlights coming on) ----------
  const lamps: LampDef[] = [];
  const SODIUM = 0xffb060, COOL = 0xcfe0ff, WARM = 0xffd4a0;
  const pole = (x: number, z: number, h = 8, color = SODIUM, range = 18, angle = 0.85, intensity = 0.8) => {
    lamps.push({ pos: V(x, h, z), dir: V(0, -1, 0), color, range, angle, intensity, kind: 'pole' });
    world.add(V(x - 0.15, 0, z - 0.15), V(x + 0.15, h, z + 0.15), { tag: 'pole', seeThrough: true, noPortal: true });
    mb.box('metal', V(x - 0.1, 0, z - 0.1), V(x + 0.1, h + 0.2, z + 0.1), 0x3a3d40, 2);
    mb.box('metal', V(x - 0.35, h + 0.05, z - 0.2), V(x + 0.35, h + 0.3, z + 0.2), 0x2a2c2e, 2);
  };
  // wall floodlights facing the outer yard
  for (const x of [-80, -40, 40, 80]) lamps.push({ pos: V(x, 7.2, -11.2), dir: V(0, -1, -0.55).normalize(), color: COOL, range: 22, angle: 0.8, intensity: 1.0, kind: 'wall' });
  lamps.push({ pos: V(0, 8, -11.5), dir: V(0, -1, -0.4).normalize(), color: COOL, range: 20, angle: 0.9, intensity: 1.1, kind: 'wall' });
  pole(64, -40, 7, WARM, 15, 0.9, 0.8);
  pole(-60, -72, 7, SODIUM, 14);
  pole(-20, -72, 7, SODIUM, 14);
  pole(20, -72, 7, SODIUM, 14);
  pole(-20, 20, 9, SODIUM, 20);
  pole(22, 26, 9, SODIUM, 20);
  pole(-82, 27.45, 7.5, SODIUM, 15);
  pole(-60, 7.45, 7.5, SODIUM, 15);
  pole(-30, 64, 8, WARM, 16);
  lamps.push({ pos: V(55, 11.4, 12), dir: V(0, -1, 0), color: COOL, range: 14, angle: 1.0, intensity: 0.8, kind: 'hang' });
  lamps.push({ pos: V(75, 11.4, 34), dir: V(0, -1, 0), color: COOL, range: 14, angle: 1.0, intensity: 0.8, kind: 'hang' });
  lamps.push({ pos: V(24, 21.5, 58.4), dir: V(0, -1, -0.3).normalize(), color: WARM, range: 8, angle: 1.0, intensity: 0.45, kind: 'wall' });
  lamps.push({ pos: V(-22, 7, 91), dir: V(0, -1, 0), color: WARM, range: 12, angle: 1.0, intensity: 0.9, kind: 'hang' });

  // ---------- Guards ----------
  const S = true;
  const guards: GuardDef[] = [
    // outer yard
    { id: 'gate-a', kind: 'heavy', route: [V(-2.5, 0, -13)], wait: [0], facing: Math.PI },
    { id: 'gate-b', kind: 'guard', route: [V(2.5, 0, -13)], wait: [0], facing: Math.PI },
    { id: 'outer-west', kind: 'guard', route: [V(-96, 0, -15), V(-12, 0, -15)], wait: [3, 3] },
    { id: 'outer-east', kind: 'guard', route: [V(10, 0, -30), V(96, 0, -30)], wait: [3, 3] },
    { id: 'bridge-post', kind: 'guard', route: [V(64, 0, -42)], wait: [0], facing: Math.PI },
    { id: 'bridge-walk', kind: 'guard', route: [V(52, 0, -38), V(78, 0, -38)], wait: [2, 2] },
    // compound
    { id: 'searchlight', kind: 'sniper', route: [V(0, 12, 22)], wait: [0], facing: Math.PI, static: S, sweep: 1.25, fov: 0.26, range: 50 },
    { id: 'officer', kind: 'officer', route: [V(-24, 0, 4), V(24, 0, 4), V(24, 0, 44), V(-24, 0, 44)], wait: [3, 2, 3, 2] },
    { id: 'plaza', kind: 'guard', route: [V(-28, 0, 28), V(28, 0, 28)], wait: [2, 2] },
    { id: 'yard-1', kind: 'guard', route: [V(-104, 0, 7.45), V(-40, 0, 7.45)], wait: [2, 2] },
    { id: 'yard-2', kind: 'guard', route: [V(-40, 0, 27.45), V(-104, 0, 27.45)], wait: [2, 2] },
    { id: 'yard-3', kind: 'guard', route: [V(-104, 0, 47.45), V(-40, 0, 47.45)], wait: [3, 3] },
    { id: 'wh-door', kind: 'guard', route: [V(41, 0, 22)], wait: [0], facing: -Math.PI / 2 },
    { id: 'wh-floor', kind: 'guard', route: [V(45, 0, 4), V(85, 0, 4), V(85, 0, 34), V(45, 0, 34)], wait: [2, 2, 2, 2] },
    { id: 'catwalk', kind: 'heavy', route: [V(60, 6, 41)], wait: [0], facing: -Math.PI / 2, static: S },
    { id: 'deck-a', kind: 'guard', route: [V(18.5, 18, 55)], wait: [0], facing: -2.4, static: S },
    { id: 'deck-b', kind: 'guard', route: [V(30, 18, 66.5)], wait: [0], facing: Math.PI / 2, static: S },
    { id: 'quay', kind: 'guard', route: [V(-100, 0, 63), V(8, 0, 63)], wait: [3, 3] },
    { id: 'barge-walk', kind: 'guard', route: [V(-38, 0.45, 85), V(-18, 0.45, 85)], wait: [3, 3] },
    { id: 'barge-post', kind: 'guard', route: [V(-14, 0.45, 95)], wait: [0], facing: -Math.PI / 2 },
  ];

  const staticMeshes = mb.build(materials);
  root.add(staticMeshes);

  return {
    world,
    root,
    lamps,
    guards,
    playerStart: V(-89, 16, -77),
    playerYaw: 0,
    manifest: V(24, 18.9, 58.9),
    keycardDoor,
    doorMesh,
    inhibitor,
    generatorMesh: gen,
    extraction,
    elevatorTop: V(24, 18, 55.2),
    sunDir: V(-0.78, 0.3, 0.55).normalize(),
    water,
    navBounds: { minX: -111, maxX: 111, minZ: -101, maxZ: 101 },
    animated,
    materials,
  };
}

export function mergeGeos(geos: THREE.BufferGeometry[]) {
  let total = 0, idxTotal = 0;
  for (const g of geos) {
    total += g.getAttribute('position').count;
    idxTotal += g.index ? g.index.count : g.getAttribute('position').count;
  }
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  const idx = new Uint32Array(idxTotal);
  let o = 0, io = 0;
  for (const g of geos) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
    pos.set(p.array as Float32Array, o * 3);
    nrm.set(n.array as Float32Array, o * 3);
    if (u) uv.set(u.array as Float32Array, o * 2);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + o;
    else for (let i = 0; i < p.count; i++) idx[io++] = i + o;
    o += p.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  m.computeBoundingSphere();
  return m;
}
