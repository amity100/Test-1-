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
  // the shepherd and flock cross the eastern slope from north to south, 150-300 m behind the stone
  const shepherdRoute = [g(175, -95, 0), g(190, -40, 0), g(200, 10, 0), g(215, 60, 0)];
  const flockRoute = [g(182, -112, 0), g(196, -58, 0), g(206, -8, 0), g(220, 42, 0)];

  const shots: Record<string, Shot> = {};
  // A — the establishing image: low, west of the stone, looking east into the first light; the sun just off the
  //     stone's shoulder, the slope falling away to the desert and the Moab wall; a slow push-in with a drift left.
  shots.dawn = path([g(-9.5, 3.4, 0.55), g(-7.2, 2.1, 0.62)], [V(P.x + 30, top.y + 1.2, P.z - 4.5), V(P.x + 30, top.y + 1.4, P.z - 3.2)], [40, 36], 6.5);
  // B — side light: from the south on the road, the light rakes from the right, the long shadow falls west across
  //     the road; a slow lateral move, the flock small on the slope behind.
  shots.side = path([g(-3.5, 11.5, 1.35), g(-7.5, 10.2, 1.3)], [g(1.5, -3, 1.25), g(-0.5, -3.5, 1.2)], [34, 32], 5.5);
  // C — telephoto: far west on the road, long lens: the stone large against the sun-hazed slope, the shepherd and
  //     the flock crossing behind it (lens compression brings them close).
  shots.tele = path([g(-78, 7, 1.7), g(-78, 4, 1.7)], [V(P.x + 6, P.y + 1.15, P.z - 1.2), V(P.x + 6, P.y + 1.15, P.z - 0.4)], [10.5, 10], 5);
  const sequence = [shots.dawn];
  return { shots, sequence, anchors: { pillar: P.clone(), pillarTop: top, road, shepherdRoute, flockRoute, walkSpeed: 1.0 } };
}
