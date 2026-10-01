import * as THREE from 'three';
import type { Shot, ShotFrame } from '../../gameplay/CameraRig';

/**
 * Shot 3 of docs/intro-script.md — RACHEL'S TOMB, filmed in the GAME WORLD near Bethlehem (src/world, the chapter's
 * morning sun: elevation 13 deg, azimuth 100 = low in the east). The pillar is `village.rachelPillar` (Village.ts):
 * "וַיַּצֵּב יַעֲקֹב מַצֵּבָה עַל־קְבֻרָתָהּ" (Gen 35:20) — ONE rough standing stone (visual-bible 3.10: an unworked,
 * aniconic, uninscribed limestone monolith ≈2.25 m, tapering, round-topped, deeply weathered, grey-cream with rain
 * streaks) on a low mound of fieldstones, beside the worn earthen road (Gen 35:19 "בְּדֶרֶךְ אֶפְרָתָה"; Rashi on
 * Gen 48:7 — the road is the point). No building, no dome, no fence, no candles, no inscription, no pilgrims.
 *
 * Everything here is pure data (camera paths + marks): it adds nothing to the scene. The film puts the game flock
 * and one shepherd ('man' preset, a staff, a plain wool cloak — no weapons) on `flockRoute` / `shepherdRoute`:
 * they cross the slope 150-300 m east of the pillar, small against the low sun.
 */
export interface RachelAnchors {
  /** foot of the pillar (ground at its centre) and the top of the stone */
  pillar: THREE.Vector3;
  pillarTop: THREE.Vector3;
  /** the worn earthen road past the tomb (ground points, north -> south: toward Ephrath / Bethlehem) */
  road: THREE.Vector3[];
  /** the shepherd walks this polyline (ground points) during the shot; `walkSpeed` m/s */
  shepherdRoute: THREE.Vector3[];
  /** the flock follows the shepherd a few metres behind; its centre starts at flockRoute[0] */
  flockRoute: THREE.Vector3[];
  walkSpeed: number;
}

export interface RachelShots {
  shots: Record<string, Shot>;
  /** in the order of the script (≈6 s total for shot 3; `side` and `tele` are alternates / inserts) */
  sequence: Shot[];
  anchors: RachelAnchors;
}

/** point along a polyline at arc length s (clamped) */
export function alongPolyline(pts: THREE.Vector3[], s: number, out = new THREE.Vector3()): THREE.Vector3 {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = pts[i].distanceTo(pts[i - 1]);
    if (acc + L >= s || i === pts.length - 1) {
      const f = THREE.MathUtils.clamp((s - acc) / Math.max(L, 1e-6), 0, 1);
      return out.lerpVectors(pts[i - 1], pts[i], f);
    }
    acc += L;
  }
  return out.copy(pts[0]);
}

/**
 * Camera shots (CameraRig-compatible `Shot`s in world metres) and marks around the pillar.
 * @param ground  engine.terrain.heightAt
 * @param pillar  village.rachelPillar (foot of the stone)
 */
export function rachelShots(ground: (x: number, z: number) => number, pillar: THREE.Vector3): RachelShots {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const P = pillar;
  const g = (dx: number, dz: number, up: number) => V(P.x + dx, ground(P.x + dx, P.z + dz) + up, P.z + dz);
  const path = (pts: THREE.Vector3[], looks: THREE.Vector3[], fov: [number, number], duration: number, ease = true): Shot => {
    const pc = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const lc = new THREE.CatmullRomCurve3(looks, false, 'centripetal');
    return { duration, ease, at: (u: number): ShotFrame => ({ pos: pc.getPoint(u), look: lc.getPoint(u), fov: fov[0] + (fov[1] - fov[0]) * u }) };
  };
  const top = V(P.x, P.y + 2.25, P.z);
  // the road: the ridge route north -> south past the tomb, a few metres west of the stone
  const road = [g(-22, -140, 0), g(-12, -70, 0), g(-5.5, -20, 0), g(-4.2, 0, 0), g(-5.5, 25, 0), g(-14, 70, 0), g(-40, 125, 0)];
  // the shepherd and flock cross the slope east of the stone from north to south, 120-220 m away, then turn down
  // toward the pasture (the chapter's pasture lies SE of the tomb)
  const shepherdRoute = [g(112, -58, 0), g(150, -8, 0), g(168, 52, 0), g(172, 112, 0), g(150, 170, 0)];
  const flockRoute = [g(100, -76, 0), g(140, -26, 0), g(162, 34, 0), g(170, 96, 0), g(152, 156, 0)];

  const shots: Record<string, Shot> = {};
  // A — the establishing image: eye level, west of the stone, looking east into the first light; the sun just off
  //     the stone's shoulder, the slope falling away toward the desert and the Moab wall; a slow push-in.
  shots.dawn = path([g(-10.5, 2.6, 1.45), g(-7.6, 1.6, 1.38)], [V(P.x + 40, top.y + 0.2, P.z - 7.5), V(P.x + 40, top.y + 0.3, P.z - 6.0)], [38, 34], 6.5);
  // B — the road: on the worn road north-west of the tomb, looking down it to the south-east; the stone stands by
  //     the road side-lit from the left, its long shadow thrown west; the flock and the shepherd far down the slope.
  shots.road = path([g(-8.2, -8.8, 1.75), g(-6.9, -7.6, 1.65)], [g(12, 13, 0.4), g(13, 14, 0.5)], [40, 38], 6);
  // C — the stone itself (insert): close, three-quarter from the south-west, light raking across the weathered face.
  shots.stone = path([g(-2.6, 3.3, 1.2), g(-3.3, 2.5, 1.3)], [g(0, 0, 1.25), g(0, 0, 1.3)], [34, 32], 4.5);
  // D — high wide (alternate establishing): a crane from the south-west, the stone small by the road, the slope and the
  //     crossing flock beyond, the desert and the Moab wall on the horizon.
  //     (the camera rises clear of the terrace west of the road and keeps the stone in the lower left third)
  shots.wide = path([g(-24, 30, 15), g(-21, 26, 8.5)], [g(38, -14, 0.5), g(34, -12, 0.2)], [40, 38], 6);
  const sequence = [shots.dawn, shots.road];
  return { shots, sequence, anchors: { pillar: P.clone(), pillarTop: top, road, shepherdRoute, flockRoute, walkSpeed: 1.0 } };
}

/**
 * Film hook (land p4): hide the game world's trees of the given kinds within `radius` metres of Rachel's pillar
 * for the shot-3 takes and return a restore function. visual-bible 3.10 wants the stone by the worn road with
 * terrace walls and a few OLIVE trees; the tall Mediterranean cypresses the chapter plants along its paths read
 * as a later, ornamental (Ottoman / modern) planting next to the tomb, so the film removes them round the stone.
 * The vegetation's instanced meshes are named `tree-<kind>` (src/world/Vegetation.ts). Instances are collapsed to
 * a zero scale (their baked ground shadow stays: keep the radius where the camera doesn't dwell on the ground).
 *
 *   const restore = hideTreesNear(engine.scene, engine.village.rachelPillar, 45);   // on entering 'rachel-dawn'
 *   restore();                                                                        // after 'rachel-road'
 */
export function hideTreesNear(root: THREE.Object3D, center: THREE.Vector3, radius = 45, kinds: string[] = ['cypress']): () => void {
  const saved: { mesh: THREE.InstancedMesh; i: number; m: THREE.Matrix4 }[] = [];
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const names = new Set(kinds.map((k) => `tree-${k}`));
  root.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    // (the world's vegetation is chunked: 'tree-olive#12' is an olive mesh too)
    if (!im.isInstancedMesh || !names.has(im.name.split('#')[0])) return;
    let touched = false;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m4);
      p.setFromMatrixPosition(m4).applyMatrix4(im.matrixWorld);
      if (Math.hypot(p.x - center.x, p.z - center.z) > radius) continue;
      saved.push({ mesh: im, i, m: m4.clone() });
      im.setMatrixAt(i, zero);
      touched = true;
    }
    if (touched) im.instanceMatrix.needsUpdate = true;
  });
  return () => {
    for (const s of saved) { s.mesh.setMatrixAt(s.i, s.m); s.mesh.instanceMatrix.needsUpdate = true; }
    saved.length = 0;
  };
}
