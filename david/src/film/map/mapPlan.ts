import { takeBeat, takeDur } from '../FilmCams';

/**
 * THE MAP'S SCRIPT (CUT v5 P4 'exodus' 13 s + P5 'tribes' 9 s, docs/intro-script-v5.md): the route of the journey and
 * the camera, both keyed to the shots' beats in src/content/introScript.ts (never hard-coded seconds).
 *
 * THE ROUTE (lon, lat): out of רַעְמְסֵס in the eastern delta (Ex 12:37) by Succoth (Tell el-Maskhuta) over the isthmus
 * between Lake Timsah and the Bitter Lakes into the wilderness (no point is marked as the crossing of the sea, no
 * mountain as Sinai: the line passes on without a halt), the forty years' wandering in loops over the central
 * wilderness and the Negev highlands with the long stay at Kadesh (Deut 1:46: the head rests there and pulses), down
 * to Etzion-Gever at the head of the gulf (Num 33:35-36), around the land of Edom by the desert east of it (Num 21:4,
 * 21:11 "in the wilderness which is before Moab, toward the sunrising"), across the Arnon to the plains of Moab
 * (Num 22:1), across the Jordan opposite Jericho (Josh 3:16) and to Gilgal (Josh 4:19), where it ends in a glow.
 * The way through the wilderness is not known station by station (Num 33's stations are mostly unidentified): the
 * loops are an artistic reading of "forty years", not a claimed itinerary.
 */
export interface RouteKey {
  lon: number;
  lat: number;
  /** shot seconds (P4) when the head reaches this point (undefined: by arc length between the timed keys) */
  t?: number;
  /** the head rests here this long (s) */
  hold?: number;
}

const B = (beat: string, fb: number) => takeBeat('exodus', beat, fb);

export function routeKeys(): RouteKey[] {
  const E = B('exodus', 3.4), W = B('wilderness', 6.0), J = B('jordan', 9.0), G = B('gilgal', 10.2);
  const K = W + (J - W) * 0.43; // Kadesh
  return [
    { lon: 31.83, lat: 30.8, t: E }, // רַעְמְסֵס (Qantir)
    { lon: 32.02, lat: 30.64 },
    { lon: 32.12, lat: 30.54 }, // Succoth (Tell el-Maskhuta)
    { lon: 32.35, lat: 30.45 }, // the isthmus (Serapeum ridge) — no halt, no mark
    { lon: 32.75, lat: 30.25 },
    { lon: 33.1, lat: 29.95, t: W }, // the wilderness
    // the wandering: one long sweep south through the wilderness and back north to Kadesh
    { lon: 33.45, lat: 29.55 },
    { lon: 33.86, lat: 29.36 },
    { lon: 34.26, lat: 29.56 },
    { lon: 34.4, lat: 29.96 },
    { lon: 34.22, lat: 30.32 },
    { lon: 34.42, lat: 30.64, t: K, hold: 0.45 }, // קָדֵשׁ — "many days" (Deut 1:46)
    // "we compassed mount Seir many days" (Deut 2:1): a turn by the hills of Seir, down to the gulf
    { lon: 34.8, lat: 30.56 },
    { lon: 34.96, lat: 30.15 },
    { lon: 34.98, lat: 29.56 }, // Etzion-Gever, the head of the gulf (Num 33:35)
    { lon: 35.36, lat: 29.47 },
    { lon: 35.8, lat: 29.8 }, // around Edom, by the desert east of it (Num 21:4, 21:11)
    { lon: 36.03, lat: 30.3 },
    { lon: 36.07, lat: 30.86 },
    { lon: 35.95, lat: 31.3 }, // across the Arnon
    { lon: 35.8, lat: 31.62 },
    { lon: 35.63, lat: 31.8, t: J - 0.1 }, // עַרְבוֹת מוֹאָב
    { lon: 35.555, lat: 31.835 }, // the Jordan opposite Jericho
    { lon: 35.52, lat: 31.848, t: J + 0.55 },
    { lon: 35.5, lat: 31.855, t: G }, // הַגִּלְגָּל
  ];
}

/** shot times (P4) at which each label comes up: as the head reaches it, the regions on the beats */
export function labelTimes(): Record<string, number> {
  const E = B('exodus', 3.4), W = B('wilderness', 6.0), J = B('jordan', 9.0), G = B('gilgal', 10.2), eg = B('egypt', 3.0);
  const K = W + (J - W) * 0.43;
  return {
    egypt: eg - 0.2,
    greatSea: eg + 0.3,
    raamses: E,
    wilderness: W + 0.1,
    kadesh: K - 0.1,
    edom: K + 0.75,
    saltSea: J - 0.75,
    moabPlains: J - 0.25,
    kinneret: J + 0.1,
    jordan: J + 0.15,
    jericho: J + 0.4,
    gilgal: G - 0.05,
  };
}

// ------------------------------------------------------------------------------------------------- the camera
/** one pose of the map camera: looking at a ground point from `range` metres, `heading` (deg, from north
 *  clockwise) and `pitch` (deg below the horizon); `fov` = vertical lens angle for the 2.39 picture */
export interface MapPose {
  lon: number;
  lat: number;
  range: number;
  heading: number;
  pitch: number;
  fov: number;
}

export interface CamKey extends MapPose {
  t: number;
}

/** P4: from above Rachel's tomb (P3's rising lens) up to the whole region by `egypt`, then a slow drift */
export function exodusKeys(): CamKey[] {
  const eg = B('egypt', 3.0), dur = takeDur('exodus', 13);
  return [
    // P3's end view (cut8_notes): above Rachel's tomb, heading north, pitch -58, fov 40 — the map starts higher on
    // the same climb (the 1.4 s moving dissolve hides the change of scale; below ~2 km its 375 m texels are too soft)
    { t: 0, lon: 35.2024, lat: 31.7193, range: 2600, heading: 0, pitch: 58, fov: 40 },
    // the top of the climb (just before `egypt`): the lens lifts its eyes over the region to the Earth's curved horizon
    // and the atmosphere's limb (from ~560 km the curvature tilts the lens ~11 deg further down: pitch 22 shows it)
    { t: eg - 0.4, lon: 33.3, lat: 31.3, range: 1_250_000, heading: 0, pitch: 22, fov: 26 },
    // then it settles slowly onto the land while the road draws (the whole road stays in the frame)
    { t: eg + 1.6, lon: 33.6, lat: 30.9, range: 860_000, heading: 1, pitch: 40, fov: 26 },
    { t: dur, lon: 34.25, lat: 30.78, range: 760_000, heading: 3, pitch: 47, fov: 26 },
  ];
}

/** P5 (continues P4's last pose): lower over the land of Israel; from `cities` down toward Ashdod's coast, the lens
 *  turning WNW (bearing 290) over the coastal plain toward the city and the Great Sea — P6 opens on the same bearing
 *  (cut7_notes D: the host on the plain ESE of Ashdod, the sea beyond) */
export function tribesKeys(): CamKey[] {
  const tb = takeBeat('tribes', 'tribes', 0.4), ci = takeBeat('tribes', 'cities', 6.2), dur = takeDur('tribes', 9);
  return [
    // the twelve tribes over their land, Dan at the top, Simeon above the verse's band
    { t: tb + 2.4, lon: 35.12, lat: 32.15, range: 560_000, heading: 0, pitch: 46, fov: 26 },
    { t: ci, lon: 34.95, lat: 31.82, range: 300_000, heading: -8, pitch: 45, fov: 26 },
    // the end: high over the plain east of Ashdod, looking WNW past Ashdod's tell (a little below the centre) to the
    // shore and the Great Sea, the five cities glowing, still descending at the cut
    { t: dur, lon: 34.64, lat: 31.765, range: 115_000, heading: -70, pitch: 36, fov: 28 },
  ];
}

/**
 * THE MAP CAMERA: ONE cubic Hermite spline through P4's and P5's keys on a common clock (P5 seconds + P4's length),
 * Catmull-Rom tangents at the inner keys (C1: the move flows through every key and through the invisible P4 -> P5 cut
 * without a stop), the range in LOG space (a climb / descent at a constant perceived speed). The first key's
 * log-range slope is P3's climb (cut8: k = 2.5 / s); the last keeps moving (end on motion: the moving dissolve into P6
 * extrapolates it). Over a big climb / descent the ground point moves in proportion to the height gained (linear in
 * range), so the land never slides sideways under a low lens.
 */
export interface MapCamPath {
  pose(take: string, t: number, out: MapPose): MapPose;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export function mapCamPath(): MapCamPath {
  const d4 = takeDur('exodus', 13);
  const keys = [...exodusKeys(), ...tribesKeys().map((k) => ({ ...k, t: k.t + d4 }))];
  const n = keys.length;
  const T = keys.map((k) => k.t);
  const ch = {
    lon: keys.map((k) => k.lon),
    lat: keys.map((k) => k.lat),
    lr: keys.map((k) => Math.log(k.range)),
    heading: keys.map((k) => k.heading),
    pitch: keys.map((k) => k.pitch),
    fov: keys.map((k) => k.fov),
  };
  const slope = (v: number[], i: number) => (v[i + 1] - v[i]) / (T[i + 1] - T[i]);
  /** tangents (value / s): Catmull-Rom inside; the ends as given */
  const tangents = (v: number[], m0: number, mEnd: number) =>
    v.map((_, i) => (i === 0 ? m0 : i === n - 1 ? mEnd : (v[i + 1] - v[i - 1]) / (T[i + 1] - T[i - 1])));
  const M = {
    lon: tangents(ch.lon, 0, 0),
    lat: tangents(ch.lat, 0, 0),
    lr: tangents(ch.lr, 2.5, slope(ch.lr, n - 2) * 0.7),
    heading: tangents(ch.heading, 0, slope(ch.heading, n - 2) * 0.45),
    pitch: tangents(ch.pitch, 0, slope(ch.pitch, n - 2) * 0.45),
    fov: tangents(ch.fov, 0, 0),
  };
  const herm = (v: number[], m: number[], i: number, u: number, dt: number) => {
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * dt * m[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * dt * m[i + 1];
  };
  return {
    pose(take, t, out) {
      const tc = Math.max(T[0], Math.min(T[n - 1], take === 'tribes' ? d4 + t : t));
      let i = 0;
      while (i < n - 2 && tc > T[i + 1]) i++;
      const dt = T[i + 1] - T[i];
      const u = (tc - T[i]) / dt;
      out.range = Math.exp(herm(ch.lr, M.lr, i, u, dt));
      out.heading = herm(ch.heading, M.heading, i, u, dt);
      out.pitch = herm(ch.pitch, M.pitch, i, u, dt);
      out.fov = herm(ch.fov, M.fov, i, u, dt);
      const ra = keys[i].range, rb = keys[i + 1].range;
      if (Math.abs(Math.log(rb / ra)) > 1.5) {
        const w = Math.max(0, Math.min(1, (out.range - ra) / (rb - ra)));
        out.lon = lerp(ch.lon[i], ch.lon[i + 1], w);
        out.lat = lerp(ch.lat[i], ch.lat[i + 1], w);
      } else {
        out.lon = herm(ch.lon, M.lon, i, u, dt);
        out.lat = herm(ch.lat, M.lat, i, u, dt);
      }
      return out;
    },
  };
}

export { smooth };
