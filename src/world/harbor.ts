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
  kind: 'guard' | 'heavy' | 'officer';
  route: THREE.Vector3[];
  wait: number[];
  facing?: number;
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

export function buildHarbor(envMap: THREE.Texture | null, mobile: boolean): LevelData {
  const world = new CollisionWorld();
  const mb = new MeshBuilder();
  const root = new THREE.Group();
  root.name = 'harbor';
  const texSize = mobile ? 256 : 512;
  const animated: ((t: number) => void)[] = [];

  // ---------- Materials ----------
  const asph = TX.asphalt(texSize * 2 > 1024 ? 1024 : texSize * 2);
  const conc = TX.concrete(texSize, 3);
  const corr = TX.corrugated(texSize);
  const envI = 0.55;
  const materials: Record<string, THREE.Material> = {
    asphalt: new THREE.MeshStandardMaterial({ map: asph.map, roughnessMap: asph.roughnessMap, normalMap: asph.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0.05, vertexColors: true, envMap, envMapIntensity: envI * 1.4 }),
    concrete: new THREE.MeshStandardMaterial({ map: conc.map, roughnessMap: conc.roughnessMap, normalMap: conc.normalMap, roughness: 1, vertexColors: true, envMap, envMapIntensity: envI }),
    container: new THREE.MeshStandardMaterial({ map: corr.map, roughnessMap: corr.roughnessMap, normalMap: corr.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 0.55, vertexColors: true, envMap, envMapIntensity: envI }),
    metal: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.8, vertexColors: true, envMap, envMapIntensity: envI, roughnessMap: conc.roughnessMap }),
    cladding: new THREE.MeshStandardMaterial({ map: corr.map, roughnessMap: corr.roughnessMap, normalMap: corr.normalMap, roughness: 1, metalness: 0.4, vertexColors: true, envMap, envMapIntensity: envI }),
    floor: new THREE.MeshStandardMaterial({ map: conc.map, roughnessMap: conc.roughnessMap, roughness: 0.5, vertexColors: true, envMap, envMapIntensity: envI }),
    emissive: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc27a, emissiveIntensity: 5, vertexColors: false }),
  };
  // Containers: rotate UVs so ribs run vertically on the long sides.
  (materials.container as THREE.MeshStandardMaterial).map!.rotation = 0;

  // ---------- Ground, quay, sea ----------
  const LAND = { minX: -72, maxX: 72, minZ: -58, maxZ: 40 };
  world.add(V(LAND.minX, -2, LAND.minZ), V(LAND.maxX, 0, LAND.maxZ), { tag: 'ground' });
  mb.box('asphalt', V(LAND.minX, -2, LAND.minZ), V(LAND.maxX, 0, LAND.maxZ), 0xffffff, 9, { skipBottom: true });
  // quay edge curb
  world.add(V(LAND.minX, 0, 39.4), V(LAND.maxX, 0.25, 40));
  mb.box('concrete', V(LAND.minX, -2, 39.4), V(LAND.maxX, 0.25, 40), 0xb0aca4, 3);
  // Pier
  world.add(V(10, -2, 40), V(16, 0, 64), { tag: 'pier' });
  mb.box('concrete', V(10, -2, 40), V(16, 0, 64), 0x8a8580, 3, { skipBottom: true });
  for (let z = 43; z < 64; z += 4) {
    mb.box('metal', V(10.1, -3, z), V(10.5, -0.1, z + 0.4), 0x2a2a2a);
    mb.box('metal', V(15.5, -3, z), V(15.9, -0.1, z + 0.4), 0x2a2a2a);
  }
  // Bollards
  for (let z = 44; z < 63; z += 6) {
    world.addBox(15.5, 0.35, z, 0.4, 0.7, 0.4);
    mb.box('metal', V(15.3, 0, z - 0.2), V(15.7, 0.7, z + 0.2), 0x1c1c1c);
  }

  // Sea (reflective, animated normals)
  const waterN = TX.waterNormals(256);
  waterN.repeat.set(40, 40);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 400),
    new THREE.MeshStandardMaterial({ color: 0x03080d, roughness: 0.06, metalness: 0.3, normalMap: waterN, normalScale: new THREE.Vector2(0.35, 0.35), envMap, envMapIntensity: 1.1 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.1, 240);
  water.receiveShadow = true;
  root.add(water);
  animated.push((t) => {
    waterN.offset.set(t * 0.004, t * 0.007);
  });

  // Invisible level bounds
  world.add(V(-80, -5, LAND.minZ - 2), V(80, 30, LAND.minZ), { noPortal: true, tag: 'bound' });
  world.add(V(LAND.minX - 2, -5, -60), V(LAND.minX, 30, 70), { noPortal: true, tag: 'bound' });
  world.add(V(LAND.maxX, -5, -60), V(LAND.maxX + 2, 30, 70), { noPortal: true, tag: 'bound' });
  world.add(V(-80, -5, 70), V(80, 30, 72), { noPortal: true, tag: 'bound' });

  // ---------- Perimeter fence (see-through, blocks walking) ----------
  const fenceTex = TX.chainLink(256);
  fenceTex.repeat.set(1, 1);
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.4, envMap, envMapIntensity: envI, transparent: false });
  const fenceGroup = new THREE.Group();
  const fenceH = 3.4;
  const addFence = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.PlaneGeometry(len, fenceH);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 1.6, uv.getY(i) * fenceH / 1.6);
    const m = new THREE.Mesh(g, fenceMat);
    m.position.set((x0 + x1) / 2, fenceH / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.castShadow = true;
    fenceGroup.add(m);
    const t = 0.15;
    world.add(V(Math.min(x0, x1) - t, 0, Math.min(z0, z1) - t), V(Math.max(x0, x1) + t, fenceH, Math.max(z0, z1) + t), { seeThrough: true, noPortal: true, tag: 'fence' });
    // posts + top rail
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {
      const px = x0 + ((x1 - x0) * i) / n, pz = z0 + ((z1 - z0) * i) / n;
      mb.box('metal', V(px - 0.05, 0, pz - 0.05), V(px + 0.05, fenceH + 0.1, pz + 0.05), 0x55595e, 2);
    }
    const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    mb.box('metal', V(Math.min(x0, x1) - 0.03 * Math.abs(dz), fenceH - 0.04, Math.min(z0, z1) - 0.03 * Math.abs(dx)), V(Math.max(x0, x1) + 0.03 * Math.abs(dz), fenceH + 0.04, Math.max(z0, z1) + 0.03 * Math.abs(dx)), 0x55595e, 2);
  };
  addFence(-60, -30, -4.5, -30);
  addFence(4.5, -30, 60, -30);
  addFence(-60, -30, -60, 39.4);
  addFence(60, -30, 60, 39.4);
  root.add(fenceGroup);
  // Gate barrier arm (visual + low collider)
  mb.box('metal', V(-4.5, 0, -30.3), V(-4, 1.2, -29.7), 0x333333);
  mb.box('metal', V(-4, 1.0, -30.08), V(3.6, 1.14, -29.92), 0xd8b020);
  world.add(V(-4, 0.9, -30.1), V(3.6, 1.2, -29.9), { seeThrough: true });

  // ---------- South outside zone (start) ----------
  const shed = (x0: number, z0: number, x1: number, z1: number, h: number, col: number) => {
    world.add(V(x0, 0, z0), V(x1, h, z1));
    mb.box('cladding', V(x0, 0, z0), V(x1, h, z1), col, 2.2, { skipBottom: true });
    mb.box('metal', V(x0 - 0.3, h, z0 - 0.3), V(x1 + 0.3, h + 0.25, z1 + 0.3), 0x2b2d30, 3);
  };
  shed(-54, -52, -40, -40, 5, 0x5a6470);
  shed(-36, -54, -28, -46, 4, 0x6d5f50);
  shed(22, -53, 40, -42, 6, 0x4d5a54);
  shed(46, -52, 58, -38, 4.5, 0x606060);
  // Parked truck trailer near start
  world.add(V(-20, 0, -50), V(-17.4, 3.4, -38));
  mb.box('container', V(-20, 1.0, -50), V(-17.4, 3.4, -38), 0xc9c4b8, 2.4);
  mb.box('metal', V(-19.8, 0, -49), V(-17.6, 1.0, -39), 0x202020);

  // ---------- Gate booth ----------
  world.add(V(5.5, 0, -29), V(9.5, 2.9, -25));
  mb.box('concrete', V(5.5, 0, -29), V(9.5, 1.0, -25), 0xd4d0c8, 2);
  mb.box('concrete', V(5.5, 2.5, -29), V(9.5, 2.9, -25), 0xd4d0c8, 2);
  mb.box('metal', V(5.6, 1.0, -28.9), V(5.7, 2.5, -25.1), 0x222222);
  mb.box('metal', V(9.3, 1.0, -28.9), V(9.4, 2.5, -25.1), 0x222222);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.5, 3.8), new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, envMap, emissive: 0x332211, emissiveIntensity: 0.6 }));
  glass.position.set(7.5, 1.75, -27);
  root.add(glass);

  // ---------- Container yard ----------
  const r = rng(1337);
  const palette = [0x9e2b25, 0x1f4e79, 0x2e6b3a, 0xc27c1a, 0x6a6e73, 0x7a2f58, 0x2a8a8c, 0xb5a33a, 0x3c3c46, 0xa34d1f];
  const rowZ = [-15.2, -12.7, -6.3, -3.8, 2.6, 5.1, 11.5, 14.0, 20.4, 22.9];
  const segs: [number, number][] = [[-50, -37.8], [-34.8, -22.6], [-19.6, -7.4], [-4.4, 7.8], [10.8, 16.9]];
  const CH = 2.6, CW = 2.44;
  const decals: { pos: THREE.Vector3; rotY: number; tex: number }[] = [];
  for (let ri = 0; ri < rowZ.length; ri++) {
    for (let si = 0; si < segs.length; si++) {
      const [sx0, sx1] = segs[si];
      let h = Math.floor(r() * 3.3);
      // guarantee some climbable singles near the start side and some towers
      if (ri === 0 && si === 2) h = 1;
      if (ri === 3 && si === 1) h = 3;
      if (h === 0 && r() < 0.5) h = 1;
      const z = rowZ[ri];
      // containers stacked, each slightly offset for a lived-in look
      for (let k = 0; k < h; k++) {
        const jitter = (r() - 0.5) * 0.25;
        const col = palette[Math.floor(r() * palette.length)];
        const short = sx1 - sx0 < 7 || r() < 0.2;
        const x0 = sx0 + jitter, x1 = short ? sx0 + 6.05 + jitter : sx1 + jitter;
        const y0 = k * CH;
        mb.box('container', V(x0, y0, z - CW / 2), V(x1, y0 + CH, z + CW / 2), col, 2.4, { skipBottom: k === 0 });
        // corner posts
        for (const cx of [x0, x1 - 0.12]) for (const cz of [z - CW / 2 - 0.01, z + CW / 2 - 0.11]) mb.box('metal', V(cx, y0, cz), V(cx + 0.12, y0 + CH, cz + 0.12), 0x1a1a1a, 2);
        if (short && x1 < sx1 - 3) {
          world.add(V(x0, y0, z - CW / 2), V(x1, y0 + CH, z + CW / 2), { tag: 'container' });
        } else {
          world.add(V(x0, y0, z - CW / 2), V(x1, y0 + CH, z + CW / 2), { tag: 'container' });
        }
        if (r() < 0.35 && decals.length < 26) {
          const side = rowZ[ri] === Math.min(rowZ[ri], rowZ[ri ^ 1] ?? 999) ? -1 : 1;
          decals.push({ pos: V((x0 + x1) / 2, y0 + CH * 0.62, z + side * (CW / 2 + 0.02)), rotY: side > 0 ? 0 : Math.PI, tex: Math.floor(r() * 4) });
        }
      }
    }
  }
  // Container decals (fictional shipping lines)
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
    if (!geos.length) continue;
    const merged = mergeGeos(geos);
    root.add(new THREE.Mesh(merged, decalMats[ti]));
  }

  // Loose cover: crate stacks, barrels, pallets
  const crate = (x: number, z: number, s = 1.2, h = 1.1) => {
    world.add(V(x - s / 2, 0, z - s / 2), V(x + s / 2, h, z + s / 2), { tag: 'crate' });
    mb.box('container', V(x - s / 2, 0, z - s / 2), V(x + s / 2, h, z + s / 2), 0x7b5a36, 1.2, { skipBottom: true });
  };
  const barrel = (x: number, z: number, col = 0x2f5d7a) => {
    world.add(V(x - 0.32, 0, z - 0.32), V(x + 0.32, 0.95, z + 0.32), { tag: 'barrel' });
    const g = new THREE.CylinderGeometry(0.3, 0.3, 0.95, 12, 1);
    g.translate(x, 0.475, z);
    mb.geometry('metal', g, col);
  };
  [[-28, -24], [-27, -22.6], [12, -22], [22, 4], [-44, 28], [-8, 30], [20, 30.5], [24, -14], [-52, -5]].forEach(([x, z], i) => crate(x, z, 1.25, i % 3 === 0 ? 1.25 : 1.05));
  [[21, -16], [21.8, -16.4], [-46, 30], [-45.2, 30.6], [18, 33], [-24, 26.5]].forEach(([x, z], i) => barrel(x, z, i % 2 ? 0x2f5d7a : 0x7a2f2f));

  // ---------- Gantry cranes on the quay ----------
  const crane = (cx: number) => {
    const col = 0xc9a227;
    const legs = [[cx - 8, 29], [cx + 8, 29], [cx - 8, 37.5], [cx + 8, 37.5]];
    for (const [lx, lz] of legs) {
      world.add(V(lx - 0.6, 0, lz - 0.6), V(lx + 0.6, 23, lz + 0.6), { tag: 'crane' });
      mb.box('metal', V(lx - 0.6, 0, lz - 0.6), V(lx + 0.6, 23, lz + 0.6), col, 3);
    }
    // cross beams
    mb.box('metal', V(cx - 8.6, 22, 28.4), V(cx + 8.6, 23.4, 29.6), col, 3);
    mb.box('metal', V(cx - 8.6, 22, 36.9), V(cx + 8.6, 23.4, 38.1), col, 3);
    // boom running out over the sea — walkable top
    world.add(V(cx - 1.5, 23.4, 20), V(cx + 1.5, 25, 62), { tag: 'boom' });
    mb.box('metal', V(cx - 1.5, 23.4, 20), V(cx + 1.5, 25, 62), col, 3);
    mb.box('metal', V(cx - 3, 25, 26), V(cx + 3, 28, 31), 0x2f3a45, 3); // cab/machinery
    world.add(V(cx - 3, 25, 26), V(cx + 3, 28, 31));
    // lower sill beams
    mb.box('metal', V(cx - 8.6, 6, 29.4 - 0.4), V(cx + 8.6, 6.8, 29.4 + 0.4), col, 3);
    mb.box('metal', V(cx - 8.6, 6, 37.1), V(cx + 8.6, 6.8, 37.9), col, 3);
    // cables + spreader
    const spreaderY = 12 + (cx % 7);
    mb.box('metal', V(cx - 0.05, spreaderY, 45), V(cx + 0.05, 23.4, 45.1), 0x111111, 3);
    mb.box('metal', V(cx - 3, spreaderY - 0.5, 44.2), V(cx + 3, spreaderY, 45.8), 0x333333, 3);
    // aircraft warning light
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a1a).multiplyScalar(6) }));
    w.position.set(cx, 28.4, 28.5);
    root.add(w);
    animated.push((t) => {
      w.visible = Math.sin(t * 2.4 + cx) > 0.1;
    });
  };
  crane(-32);
  crane(-4);

  // ---------- Warehouse ----------
  const WX0 = 28, WX1 = 56, WZ0 = -20, WZ1 = 6, WH = 9, T = 0.4;
  const clad = 0x55606b;
  const wall = (x0: number, z0: number, x1: number, z1: number, y0 = 0, y1 = WH) => {
    world.add(V(x0, y0, z0), V(x1, y1, z1), { tag: 'wall' });
    mb.box('cladding', V(x0, y0, z0), V(x1, y1, z1), clad, 2.2);
  };
  // West wall with big roller door opening z[-11,-4]
  wall(WX0, WZ0, WX0 + T, -11);
  wall(WX0, -4, WX0 + T, WZ1);
  wall(WX0, -11, WX0 + T, -4, 5, WH);
  // South wall with small door x[40,41.6] and high windows
  wall(WX0, WZ0, 40, WZ0 + T);
  wall(41.6, WZ0, WX1, WZ0 + T);
  wall(40, WZ0, 41.6, WZ0 + T, 2.3, WH);
  // North and east walls
  wall(WX0, WZ1 - T, WX1, WZ1);
  wall(WX1 - T, WZ0, WX1, WZ1);
  // Roof (walkable) with parapet
  world.add(V(WX0, WH, WZ0), V(WX1, WH + 0.3, WZ1), { tag: 'roof' });
  mb.box('metal', V(WX0 - 0.2, WH, WZ0 - 0.2), V(WX1 + 0.2, WH + 0.3, WZ1 + 0.2), 0x3a3f45, 3);
  // Interior floor (clean concrete)
  mb.box('floor', V(WX0 + T, 0.0, WZ0 + T), V(WX1 - T, 0.02, WZ1 - T), 0x8d8a85, 4, { skipBottom: true });
  // Door frames
  mb.box('metal', V(WX0 - 0.1, 4.8, -11.2), V(WX0 + T + 0.1, 5.2, -3.8), 0xd8b020, 2);
  // Racks inside
  const rack = (x0: number, z0: number, x1: number, z1: number) => {
    world.add(V(x0, 0, z0), V(x1, 4.6, z1), { tag: 'rack' });
    for (let lvl = 0; lvl < 3; lvl++) {
      const y = 0.1 + lvl * 1.5;
      mb.box('metal', V(x0, y, z0), V(x1, y + 0.1, z1), 0xc05a1c, 2);
      // goods
      for (let x = x0 + 0.2; x < x1 - 1; x += 1.6) mb.box('container', V(x, y + 0.1, z0 + 0.1), V(x + 1.3, y + 1.15, z1 - 0.1), 0x8a6a45, 1.2);
    }
    for (let x = x0; x <= x1; x += (x1 - x0) / 4) mb.box('metal', V(x - 0.06, 0, z0), V(x + 0.06, 4.6, z0 + 0.12), 0x1f4e79, 2);
  };
  rack(31, -16.5, 44, -15.2);
  rack(31, -11.5, 40, -10.2);
  rack(31, -1.5, 42, -0.2);
  // Office box in NE corner: walls 3.2 high with a window on its south wall
  const OX0 = 46, OZ0 = -4, OH = 3.2;
  const owall = (x0: number, z0: number, x1: number, z1: number, y0 = 0, y1 = OH) => {
    world.add(V(x0, y0, z0), V(x1, y1, z1), { tag: 'office' });
    mb.box('concrete', V(x0, y0, z0), V(x1, y1, z1), 0xbfb8aa, 2);
  };
  // west wall with locked door z[0,1.6]
  owall(OX0, OZ0, OX0 + 0.25, 0);
  owall(OX0, 1.6, OX0 + 0.25, WZ1 - T);
  owall(OX0, 0, OX0 + 0.25, 1.6, 2.3, OH);
  // south wall with window x[49.5,53] y[1.1,2.3]
  owall(OX0, OZ0, 49.5, OZ0 + 0.25);
  owall(53, OZ0, WX1 - T, OZ0 + 0.25);
  owall(49.5, OZ0, 53, OZ0 + 0.25, 0, 1.1);
  owall(49.5, OZ0, 53, OZ0 + 0.25, 2.3, OH);
  // office ceiling
  world.add(V(OX0, OH, OZ0), V(WX1 - T, OH + 0.2, WZ1 - T), { tag: 'office' });
  mb.box('concrete', V(OX0, OH, OZ0), V(WX1 - T, OH + 0.2, WZ1 - T), 0x9a948a, 2);
  // window glass (visual only; rifts pass the open frame)
  const wglass = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.12, roughness: 0.05, envMap, depthWrite: false }));
  wglass.position.set(51.25, 1.7, OZ0 - 0.01);
  wglass.rotation.y = Math.PI;
  root.add(wglass);
  // Locked door
  const keycardDoor = world.add(V(OX0 - 0.02, 0, 0), V(OX0 + 0.27, 2.3, 1.6), { tag: 'door', noPortal: true });
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 1.6), new THREE.MeshStandardMaterial({ color: 0x3a4a5a, metalness: 0.7, roughness: 0.35, envMap }));
  doorMesh.position.set(OX0 + 0.12, 1.15, 0.8);
  doorMesh.castShadow = true;
  root.add(doorMesh);
  const readerLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2020).multiplyScalar(4) }));
  readerLight.position.set(OX0 - 0.05, 1.3, 1.9);
  readerLight.name = 'reader';
  doorMesh.userData.reader = readerLight;
  root.add(readerLight);
  // Desk with manifest
  world.add(V(50, 0, 2.2), V(53, 0.8, 3.4), { tag: 'desk' });
  mb.box('metal', V(50, 0.72, 2.2), V(53, 0.8, 3.4), 0x5a4030, 1);
  mb.box('metal', V(50.1, 0, 2.3), V(50.25, 0.72, 3.3), 0x222222);
  mb.box('metal', V(52.75, 0, 2.3), V(52.9, 0.72, 3.3), 0x222222);
  // monitor glow
  const monitor = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5ab0ff).multiplyScalar(2.5) }));
  monitor.position.set(52.2, 1.05, 3.2);
  monitor.rotation.y = Math.PI;
  root.add(monitor);
  mb.box('metal', V(51.85, 0.8, 3.22), V(52.55, 1.28, 3.3), 0x111111);
  // filing cabinets
  world.add(V(54.2, 0, -3.5), V(55.5, 1.4, -1.5));
  mb.box('metal', V(54.2, 0, -3.5), V(55.5, 1.4, -1.5), 0x6a7078, 1);

  // Rift inhibitor generator (purple) guarding the office
  const inhibitor: Inhibitor = { center: V(50.5, 1, 0.5), radius: 8.5, active: true, generator: V(43.4, 0, -2.6) };
  world.add(V(42.8, 0, -3.2), V(44.0, 1.6, -2.0), { tag: 'generator', noPortal: true });
  const gen = new THREE.Group();
  const genBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.8, roughness: 0.35, envMap }));
  genBody.position.y = 0.8;
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb050ff).multiplyScalar(5) }));
  coil.position.y = 1.75;
  coil.rotation.x = Math.PI / 2;
  gen.add(genBody, coil);
  gen.position.copy(inhibitor.generator);
  gen.userData.coil = coil;
  root.add(gen);
  animated.push((t) => {
    coil.rotation.z = t * 2;
    coil.visible = inhibitor.active;
  });

  // ---------- Boat at the pier (extraction) ----------
  const boat = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1c2630, metalness: 0.4, roughness: 0.5, envMap });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 11), hullMat);
  hull.position.set(0, -0.6, 0);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 3.6), new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.6, envMap }));
  cabin.position.set(0, 1.1, 1.8);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3, 4, 1), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  bow.position.set(0, -0.6, 7);
  boat.add(hull, cabin, bow);
  boat.position.set(19, 0, 55);
  boat.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(boat);
  world.add(V(16.8, -2, 49.5), V(21.2, 0.2, 60.5), { tag: 'boat' });
  world.add(V(17.5, 0.2, 55), V(20.5, 2, 58.6), { tag: 'boat' });
  animated.push((t) => {
    boat.rotation.z = Math.sin(t * 0.7) * 0.015;
    boat.position.y = Math.sin(t * 0.9) * 0.05;
  });
  const extraction = V(17.6, 0.2, 51.5);

  // ---------- Distant city skyline across the water ----------
  const winTex = TX.windows(256);
  const skyMat = new THREE.MeshBasicMaterial({ map: winTex, color: 0x9aa4b4, fog: false });
  const sr = rng(4242);
  const skyGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 70; i++) {
    const w = 8 + sr() * 18, h = 15 + sr() * 70, d = 8 + sr() * 12;
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 24 + sr(), uv.getY(k) * h / 40);
    const ang = -1.2 + (i / 70) * 2.4 + (sr() - 0.5) * 0.04;
    const dist = 330 + sr() * 90;
    g.translate(Math.sin(ang) * dist, h / 2 - 8, Math.cos(ang) * dist);
    skyGeos.push(g);
  }
  const skyline = new THREE.Mesh(mergeGeos(skyGeos), skyMat);
  root.add(skyline);

  // ---------- Lamps ----------
  const lamps: LampDef[] = [];
  const SODIUM = 0xffa650, COOL = 0xbfd8ff, WARM = 0xffd4a0;
  const pole = (x: number, z: number, h = 7.5, color = SODIUM, range = 17, angle = 0.8, intensity = 1) => {
    lamps.push({ pos: V(x, h, z), dir: V(0, -1, 0), color, range, angle, intensity, kind: 'pole' });
    world.add(V(x - 0.15, 0, z - 0.15), V(x + 0.15, h, z + 0.15), { tag: 'pole', seeThrough: true, noPortal: true });
    mb.box('metal', V(x - 0.1, 0, z - 0.1), V(x + 0.1, h + 0.2, z + 0.1), 0x3a3d40, 2);
    mb.box('metal', V(x - 0.35, h + 0.05, z - 0.2), V(x + 0.35, h + 0.3, z + 0.2), 0x2a2c2e, 2);
  };
  pole(0, -32.5, 7, SODIUM, 16, 0.85, 1.1);
  pole(-26, -27.5);
  pole(28, -27.5);
  pole(-41, -9.5);
  pole(-8, -9.5, 7.5, SODIUM, 15);
  pole(18.5, -8.8);
  pole(-27, -0.6, 7.5, COOL, 14, 0.7, 0.9);
  pole(4, 8.3);
  pole(-40, 17.2, 7.5, SODIUM, 15);
  pole(-14, 26.5, 8, COOL, 18, 0.9, 0.9);
  pole(16, 26.5, 8, SODIUM, 18);
  pole(12.5, 50, 6, WARM, 13, 0.9, 0.9);
  // warehouse wall lights + interior hanging lamps
  lamps.push({ pos: V(27.4, 6, -7.5), dir: V(-0.5, -1, 0).normalize(), color: SODIUM, range: 16, angle: 0.95, intensity: 1.2, kind: 'wall' });
  lamps.push({ pos: V(35, 8.2, -13), dir: V(0, -1, 0), color: COOL, range: 12, angle: 1.0, intensity: 0.8, kind: 'hang' });
  lamps.push({ pos: V(36, 8.2, -5), dir: V(0, -1, 0), color: COOL, range: 12, angle: 1.0, intensity: 0.7, kind: 'hang' });
  lamps.push({ pos: V(51, 3.0, 1.5), dir: V(0, -1, 0), color: WARM, range: 7, angle: 1.2, intensity: 0.8, kind: 'hang' });
  lamps.push({ pos: V(7.5, 2.7, -27), dir: V(0, -1, 0), color: WARM, range: 6, angle: 1.3, intensity: 0.6, kind: 'hang' });

  // ---------- Guards ----------
  const guards: GuardDef[] = [
    { id: 'gate-a', kind: 'guard', route: [V(1.5, 0, -27.5)], wait: [0], facing: Math.PI },
    { id: 'fence-walker', kind: 'guard', route: [V(-24, 0, -26.5), V(-3, 0, -26.5), V(-3, 0, -21), V(-24, 0, -21)], wait: [4, 1, 3, 1] },
    { id: 'aisle-south', kind: 'guard', route: [V(-46, 0, -9.5), V(14, 0, -9.5)], wait: [3, 3] },
    { id: 'aisle-mid', kind: 'guard', route: [V(-30, 0, 8.3), V(8, 0, 8.3), V(8, 0, -0.6), V(-30, 0, -0.6)], wait: [2, 1, 2, 1] },
    { id: 'officer', kind: 'officer', route: [V(19.5, 0, 2), V(24.5, 0, -7.5), V(19.5, 0, -18), V(19, 0, 17)], wait: [3, 4, 2, 3] },
    { id: 'wh-inside', kind: 'guard', route: [V(33, 0, -13.2), V(45, 0, -13.2), V(45, 0, -7), V(33, 0, -7)], wait: [2, 1, 2, 1] },
    { id: 'office-heavy', kind: 'heavy', route: [V(44.9, 0, 1.2), V(44.9, 0, -5.5)], wait: [5, 5] },
    { id: 'quay', kind: 'guard', route: [V(-44, 0, 32.5), V(22, 0, 32.5)], wait: [2, 2] },
    { id: 'pier', kind: 'guard', route: [V(13, 0, 44), V(13, 0, 59)], wait: [4, 5] },
    { id: 'yard-north', kind: 'guard', route: [V(-48, 0, 17.2), V(-14, 0, 17.2), V(-14, 0, 26), V(-48, 0, 26)], wait: [2, 1, 2, 1] },
  ];

  // Build merged static meshes
  const staticMeshes = mb.build(materials);
  root.add(staticMeshes);

  return {
    world,
    root,
    lamps,
    guards,
    playerStart: V(-24, 0, -45),
    playerYaw: 0,
    manifest: V(51.2, 0.85, 2.8),
    keycardDoor,
    doorMesh,
    inhibitor,
    generatorMesh: gen,
    extraction,
    water,
    navBounds: { minX: -71, maxX: 71, minZ: -57, maxZ: 64 },
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
