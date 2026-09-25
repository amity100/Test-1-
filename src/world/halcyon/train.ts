import * as THREE from 'three';
import type { MissionEndDef } from '../../core/contracts';
import { Builder, V, box3, col, type Ctx } from '../tower/kit';
import { CITY } from './kit';
import { BOARD_AT, BOARD_BOX, TRAIN, TRAIN_DOOR } from './layout';

/** Seconds for the doors to slide, metres they open, and the departure (ease-in). */
const DOOR_T = 0.8;
const DOOR_OPEN = 0.8;
const DEPART_T = 8;
const DEPART_X = 120;
/** Warm lit windows (HDR: they bloom a little once she wakes). */
const WIN = new THREE.Color(1.35, 0.66, 0.22);

/**
 * The Meridian Express waiting in the station (steel-blue over navy with a
 * cream belt, a warm window band, glowing blue-white strips at the roof, the
 * belt and the skirt, a brass nose) and the
 * mission's end: once the city's four fights are won its doors open, and
 * stepping into car 1's door boards it; it pulls out east into the tunnel.
 */
export function buildTrain(ctx: Ctx, requires: string[]): MissionEndDef {
  const { x0, x1, z0, z1, y0, y1, cars } = TRAIN;
  col(ctx, x0, y0, z0, x1, y1, z1, { tag: 'train' });
  const group = new THREE.Group();
  group.name = 'train';
  // its own glow materials, so ready() can brighten them
  const win = (ctx.materials.emissive as THREE.MeshBasicMaterial).clone();
  const strip = (ctx.materials.emissive as THREE.MeshBasicMaterial).clone();
  const mats = { ...ctx.materials, trainWin: win, trainStrip: strip };
  const b = new Builder();
  const len = (x1 - x0) / cars;
  const bodyY0 = y0 + 0.6, top = y1 - 0.25;
  const zc = (z0 + z1) / 2, hw = (z1 - z0) / 2 - 0.15;
  const cream = 0xede5d2, steel = 0x2a3850;
  for (let i = 0; i < cars; i++) {
    const a = x0 + i * len + 0.2, e = x0 + (i + 1) * len - 0.2;
    // (the lead car ends in a streamlined deco nose)
    const nose = i === cars - 1;
    const bodyEnd = nose ? e - 4.5 : e;
    const L = bodyEnd - a, xm = (a + bodyEnd) / 2;
    // steel blue over navy (the concept's dark train: a cream one lit through the vault blew the platform white),
    // a cream belt with a gilt pinstripe, a rounded roof with the blue-white strip along its edge
    b.box('enamel', a, bodyY0, zc - hw, bodyEnd, bodyY0 + 1.3, zc + hw, CITY.navy, 2, { ao: 0 });
    b.box('enamel', a, bodyY0 + 1.3, zc - hw, bodyEnd, bodyY0 + 1.6, zc + hw, cream, 2, { ao: 0 });
    b.box('enamel', a, bodyY0 + 1.6, zc - hw, bodyEnd, top - 0.45, zc + hw, steel, 2, { ao: 0 });
    const roof = new THREE.CylinderGeometry(hw, hw, L, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.42, 1).translate(xm, top - 0.45, zc);
    b.geo('enamel', roof, 0x3a4558, 1, (p, n) => 0.85 + 0.15 * n.y);
    roof.dispose();
    for (const s of [1, -1]) {
      const zf = zc + s * (hw + 0.012);
      const zb = zc + s * (hw - 0.03);
      b.box('metal', a, bodyY0 + 1.27, Math.min(zf, zb), bodyEnd, bodyY0 + 1.37, Math.max(zf, zb), CITY.brass, 1, { ao: 0 });
      b.box('trainStrip', a, top - 0.52, Math.min(zf, zb), bodyEnd, top - 0.44, Math.max(zf, zb), 0x9fdfff, 1, { ao: 0 });
      b.box('trainStrip', a, bodyY0, Math.min(zf, zb), bodyEnd, bodyY0 + 0.08, Math.max(zf, zb), 0x9fdfff, 1, { ao: 0 });
      b.box('trainStrip', a, bodyY0 + 1.58, Math.min(zf, zb), bodyEnd, bodyY0 + 1.63, Math.max(zf, zb), 0x9fdfff, 1, { ao: 0 });
      // windows: separate panes with cream mullions (car 1's door left clear on the platform side)
      const wy0 = bodyY0 + 1.65, wy1 = bodyY0 + 2.55;
      for (let x = a + 0.9; x + 1.1 < bodyEnd - 0.5; x += 1.55) {
        if (nose && s > 0 && x + 1.1 > TRAIN_DOOR.x0 - 0.3 && x < TRAIN_DOOR.x1 + 0.3) continue;
        b.box('trainWin', x, wy0, Math.min(zf, zb), x + 1.1, wy1, Math.max(zf, zb), WIN, 1, { ao: 0 });
      }
    }
    // the bogies' dark skirts
    b.box('enamel', a + 1.5, y0 + 0.1, zc - hw + 0.2, a + 4.5, bodyY0, zc + hw - 0.2, 0x22262c, 1, { ao: 0 });
    b.box('enamel', bodyEnd - 4.5, y0 + 0.1, zc - hw + 0.2, bodyEnd - 1.5, bodyY0, zc + hw - 0.2, 0x22262c, 1, { ao: 0 });
    if (nose) {
      // a half-ellipsoid nose: polished brass above a navy chin, gilt speed whiskers, the round headlamp
      const yc = bodyY0 + 1.7, ry = 1.7, rx = 4.5;
      for (const [t0, t1, c, key] of [[0, Math.PI / 2 + 0.3, CITY.brass, 'metal'], [Math.PI / 2 + 0.3, Math.PI, CITY.navy, 'enamel']] as [number, number, number, string][]) {
        const g = new THREE.SphereGeometry(1, 18, 10, Math.PI / 2, Math.PI, t0, t1 - t0).scale(rx, ry, hw).translate(bodyEnd, yc, zc);
        b.geo(key, g, c, 1, (p, n) => 0.85 + 0.15 * Math.max(0, n.y));
        g.dispose();
      }
      for (const dy of [-0.35, -0.6, -0.85]) {
        for (const s of [1, -1]) {
          let prev: THREE.Vector3 | null = null;
          for (let k = 0; k <= 6; k++) {
            const x = bodyEnd - 1.5 + (k / 6) * 5.2;
            const u = Math.min(0.98, Math.max(0, (x - bodyEnd) / rx));
            const zz = hw * Math.sqrt(Math.max(0.02, 1 - u * u - (dy / ry) ** 2)) + 0.02;
            const q = V(x, yc + dy, zc + s * zz);
            if (prev) b.beam('metal', prev, q, 0.05, 0.07, CITY.gilt, 1);
            prev = q;
          }
        }
      }
      const lamp = new THREE.CircleGeometry(0.34, 16).rotateY(Math.PI / 2).translate(bodyEnd + rx * 0.99, yc - 0.3, zc);
      b.geo('trainStrip', lamp, new THREE.Color(2.4, 2.2, 1.8));
      lamp.dispose();
    }
  }
  // car 1's doorway: warm light behind two sliding leaves
  b.box('trainWin', TRAIN_DOOR.x0, bodyY0, z1 - 0.2, TRAIN_DOOR.x1, bodyY0 + 2.8, z1 - 0.17, new THREE.Color(1.6, 0.95, 0.45), 1, { ao: 0 });
  group.add(b.build(mats, { name: 'train', noShadow: ['trainWin', 'trainStrip'] }));
  const leafW = (TRAIN_DOOR.x1 - TRAIN_DOOR.x0) / 2;
  const leafGeo = new THREE.BoxGeometry(leafW, 2.8, 0.06);
  const leafMat = new THREE.MeshStandardMaterial({ color: steel, roughness: 0.4, metalness: 0.3, envMap: (ctx.materials.metal as THREE.MeshStandardMaterial).envMap });
  const leaves = [-1, 1].map((side) => {
    const m = new THREE.Mesh(leafGeo, leafMat);
    m.position.set((TRAIN_DOOR.x0 + TRAIN_DOOR.x1) / 2 + (side * leafW) / 2, bodyY0 + 1.4, z1 - 0.12);
    m.userData.x = m.position.x;
    m.userData.side = side;
    m.castShadow = true;
    group.add(m);
    return m;
  });
  ctx.zoneRoot.add(group);

  const st = { ready: false, departing: false, door: 0, glow: 0, t0: -1, lastT: -1 };
  const apply = () => {
    for (const m of leaves) m.position.x = m.userData.x + m.userData.side * st.door * (DOOR_OPEN / 2);
    // windows 1.0 -> 1.6, strips x2 -> x4.2 as she wakes (idle, they already glow against the dark body)
    win.color.setScalar(1 + 0.6 * st.glow);
    strip.color.setScalar(2 + 2.2 * st.glow);
  };
  apply();
  ctx.animated.push((t) => {
    const dt = st.lastT < 0 ? 0 : Math.max(0, Math.min(0.1, t - st.lastT));
    st.lastT = t;
    const want = st.ready && !st.departing ? 1 : 0;
    st.door += THREE.MathUtils.clamp(want - st.door, -dt / DOOR_T, dt / DOOR_T);
    st.glow += THREE.MathUtils.clamp((st.ready ? 1 : 0) - st.glow, -dt, dt);
    if (st.departing) {
      if (st.t0 < 0) st.t0 = t;
      const u = THREE.MathUtils.clamp((t - st.t0) / DEPART_T, 0, 1);
      group.position.x = DEPART_X * u * u;
    }
    apply();
  });

  return {
    box: box3(BOARD_BOX.min.x, BOARD_BOX.min.y, BOARD_BOX.min.z, BOARD_BOX.max.x, BOARD_BOX.max.y, BOARD_BOX.max.z),
    target: V(BOARD_AT.x, BOARD_AT.y, BOARD_AT.z),
    requires: requires.slice(),
    objKey: 'obj.train',
    toastKey: 'toast.trainReady',
    ready(on: boolean) {
      st.ready = on;
      if (!on) {
        // a new run: back at the platform, doors shut
        st.departing = false;
        st.t0 = -1;
        st.door = 0;
        st.glow = 0;
        group.position.x = 0;
        apply();
      }
    },
    depart() {
      st.departing = true;
      st.t0 = -1;
    },
  };
}
