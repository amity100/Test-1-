import { takeBeat, takeDur } from '../FilmCams';
import { MAP_NAMES, TRIBE_ORDER } from '../../content/mapNames';

/**
 * THE MAP'S SCRIPT — CUT v6 (docs/intro-script-v6.md): P4 'map-exodus', take 'exodus', ONE 10 s shot tied to the story.
 * Everything is keyed to the shot's beats in src/content/introScript.ts (egypt, flock, verse, jordan, gilgal, land,
 * noKing — never hard-coded seconds).
 *
 * The user: "connect it to our story — how we got to David's story; something similar happens with the people of Israel
 * — but not too long". The film's answer is Ps 78:52 (on screen from `verse`): out of Egypt God led His people LIKE A
 * FLOCK through the wilderness — the psalm that at the end chooses David from the sheepfolds (78:70-71, over D3). So the
 * road out of Egypt is drawn as a FLOCK OF LIGHT: one leading light and many small warm lights following it, spreading
 * and gathering like sheep, across the wilderness and the Jordan to Gilgal; then the flock scatters over the land, each
 * light to its own place, and the leading light goes out — "in those days there was no king in Israel, every man did
 * what was right in his own eyes" (Judg 21:25, from `noKing`); the lens sinks over the land and turns WNW to the coast,
 * where the five Philistine cities glow — the dissolve lands on P6's front rank.
 *
 * THE ROUTE (lon, lat): out of רַעְמְסֵס in the eastern delta (Ex 12:37) by Succoth over the isthmus WITHOUT a halt or a
 * mark (no point is marked as the crossing of the sea), into the wilderness (one sweep: no station, no mountain is
 * marked as Sinai), Kadesh (Deut 1:46; the flock rests a moment), by the hills of Seir (Deut 2:1) down to Etzion-Gever
 * (Num 33:35), around Edom by the desert east of it (Num 21:4, 21:11), across the Arnon to the plains of Moab (Num
 * 22:1), across the Jordan opposite Jericho (Josh 3:16) to Gilgal (Josh 4:19). Num 33's stations are mostly
 * unidentified: the sweep is an artistic reading of the forty years, not an itinerary.
 */
export interface RouteKey {
  lon: number;
  lat: number;
  /** shot seconds when the leading light reaches this point (undefined: by arc length between the timed keys) */
  t?: number;
  /** the flock rests here this long (s) */
  hold?: number;
}

const B = (beat: string, fb: number) => takeBeat('exodus', beat, fb);

/** the shot's beats (with the contract's fallbacks) */
export function mapBeats() {
  return {
    egypt: B('egypt', 0.6),
    flock: B('flock', 1.4),
    verse: B('verse', 1.8),
    jordan: B('jordan', 4.8),
    gilgal: B('gilgal', 5.4),
    land: B('land', 5.8),
    noKing: B('noKing', 6.0),
    dur: takeDur('exodus', 10),
  };
}

export function routeKeys(): RouteKey[] {
  const b = mapBeats();
  const FL = b.flock, J = b.jordan, G = b.gilgal;
  const span = J - FL; // the crossing of the wilderness
  return [
    { lon: 31.83, lat: 30.8, t: FL }, // רַעְמְסֵס (Qantir) — not labelled in CUT v6
    { lon: 32.02, lat: 30.64 },
    { lon: 32.12, lat: 30.54 }, // Succoth (Tell el-Maskhuta)
    { lon: 32.35, lat: 30.45 }, // the isthmus — no halt, no mark
    { lon: 32.75, lat: 30.25 },
    { lon: 33.1, lat: 29.95, t: FL + span * 0.26 }, // the wilderness
    { lon: 33.5, lat: 29.6 },
    { lon: 33.95, lat: 29.5 },
    { lon: 34.3, lat: 29.8 },
    { lon: 34.28, lat: 30.25 },
    { lon: 34.42, lat: 30.64, t: FL + span * 0.52, hold: 0.18 }, // קָדֵשׁ — the long stay (Deut 1:46)
    { lon: 34.8, lat: 30.5 },
    { lon: 34.95, lat: 30.1 },
    { lon: 34.98, lat: 29.56 }, // Etzion-Gever (Num 33:35)
    { lon: 35.36, lat: 29.47 },
    { lon: 35.8, lat: 29.8 }, // around Edom, by the desert east of it
    { lon: 36.03, lat: 30.3 },
    { lon: 36.07, lat: 30.86 },
    { lon: 35.95, lat: 31.3 }, // across the Arnon
    { lon: 35.8, lat: 31.62 },
    { lon: 35.63, lat: 31.8, t: J - 0.15 }, // עַרְבוֹת מוֹאָב
    { lon: 35.555, lat: 31.835 }, // the Jordan opposite Jericho
    { lon: 35.52, lat: 31.848, t: J + 0.32 },
    { lon: 35.5, lat: 31.855, t: G }, // הַגִּלְגָּל
  ];
}

/** the few names that orient (the user: fewer words): Egypt over the delta, the Jordan at the crossing */
export function labelPlan(): { id: 'egypt' | 'jordan'; t0: number; t1: number }[] {
  const b = mapBeats();
  return [
    { id: 'egypt', t0: b.egypt - 0.1, t1: b.jordan - 0.3 },
    { id: 'jordan', t0: b.jordan - 0.35, t1: b.noKing + 1.2 },
  ];
}

/**
 * Where the scattered lights settle (from `land`): the inheritances of the tribes (mapNames' tribe points, no names
 * on screen), each light jittered around one of them — "every man to his inheritance" (Judg 21:24).
 */
export function scatterHomes(n: number, seed = 7): { lon: number; lat: number }[] {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out: { lon: number; lat: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = MAP_NAMES[TRIBE_ORDER[i % TRIBE_ORDER.length]];
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    out.push({ lon: t.lon + Math.cos(a) * r * 0.16, lat: t.lat + Math.sin(a) * r * 0.13 });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------- the camera
/** one pose of the map camera: looking at a ground point from `range` metres, `heading` (deg, from north
 *  clockwise) and `pitch` (deg below the horizon); `fov` = vertical lens angle (16:9 canvas, 2.39 picture) */
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

/**
 * P4's ONE move: out of P1's dive through the cloud deck the lens is already high above the region — the Earth's curved
 * horizon and the atmosphere's limb along the top — and it keeps coming forward and down (the dive continues), settling
 * onto the region while the flock crosses the wilderness (north-up: the delta lower-left, the wilderness low, the rift
 * right); from `land` it sinks over the land of Israel while the lights scatter, and turns WNW (bearing 290) toward
 * the coast and the Philistine cities — P6 opens on the same bearing on the front rank.
 */
export function exodusKeys(): CamKey[] {
  const b = mapBeats();
  return [
    { t: 0, lon: 33.35, lat: 31.45, range: 1_320_000, heading: 0, pitch: 21, fov: 26 },
    { t: b.flock, lon: 33.3, lat: 30.75, range: 1_000_000, heading: 0, pitch: 33, fov: 26 },
    { t: (b.flock + b.jordan) / 2, lon: 34.05, lat: 30.05, range: 800_000, heading: -2, pitch: 44, fov: 26 },
    { t: b.jordan - 0.5, lon: 35.05, lat: 30.2, range: 700_000, heading: -7, pitch: 47, fov: 26 },
    { t: b.gilgal, lon: 35.15, lat: 31.4, range: 520_000, heading: -14, pitch: 46, fov: 26 },
    { t: b.land + 0.9, lon: 35.0, lat: 31.7, range: 360_000, heading: -30, pitch: 45, fov: 26 },
    { t: b.dur, lon: 34.8, lat: 31.72, range: 118_000, heading: -70, pitch: 24, fov: 28 },
  ];
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/**
 * The camera: ONE cubic Hermite spline through the keys, Catmull-Rom tangents inside (C1: no stop at any key), the range
 * in LOG space (a constant perceived speed of climb / descent). It starts moving (forward and down, the dive of P1 goes
 * on) and ends moving (the moving dissolve into P6 extrapolates it). Over a big change of range the ground point moves
 * in proportion to the height gained / lost, so the land never slides sideways under a low lens.
 */
export interface MapCamPath {
  pose(take: string, t: number, out: MapPose): MapPose;
}

export function mapCamPath(): MapCamPath {
  const keys = exodusKeys();
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
  const tangents = (v: number[], m0: number, mEnd: number) =>
    v.map((_, i) => (i === 0 ? m0 : i === n - 1 ? mEnd : (v[i + 1] - v[i - 1]) / (T[i + 1] - T[i - 1])));
  const M = {
    lon: tangents(ch.lon, slope(ch.lon, 0) * 0.5, 0),
    lat: tangents(ch.lat, slope(ch.lat, 0) * 0.5, 0),
    lr: tangents(ch.lr, slope(ch.lr, 0) * 0.9, slope(ch.lr, n - 2) * 0.85),
    heading: tangents(ch.heading, 0, slope(ch.heading, n - 2) * 0.4),
    pitch: tangents(ch.pitch, slope(ch.pitch, 0) * 0.9, slope(ch.pitch, n - 2) * 0.4),
    fov: tangents(ch.fov, 0, 0),
  };
  const herm = (v: number[], m: number[], i: number, u: number, dt: number) => {
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * dt * m[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * dt * m[i + 1];
  };
  return {
    pose(_take, t, out) {
      const tc = Math.max(T[0], Math.min(T[n - 1], t));
      let i = 0;
      while (i < n - 2 && tc > T[i + 1]) i++;
      const dt = T[i + 1] - T[i];
      const u = (tc - T[i]) / dt;
      out.range = Math.exp(herm(ch.lr, M.lr, i, u, dt));
      out.heading = herm(ch.heading, M.heading, i, u, dt);
      out.pitch = herm(ch.pitch, M.pitch, i, u, dt);
      out.fov = herm(ch.fov, M.fov, i, u, dt);
      const ra = keys[i].range, rb = keys[i + 1].range;
      if (Math.abs(Math.log(rb / ra)) > 1.0) {
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
