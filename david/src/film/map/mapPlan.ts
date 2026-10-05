import { takeBeat, takeDur } from '../FilmCams';
import { MAP_NAMES, TRIBE_ORDER } from '../../content/mapNames';

/**
 * THE MAP'S SCRIPT — CUT v6.1 (docs/intro-script-v6-1.md; the concept: docs/intro-script-v6.md): P4 'map-exodus', take
 * 'exodus', ONE 10.5 s shot tied to the story, in by a match dissolve out of P1, out by a dissolve into P6.
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
/** one pose of the map camera: looking at a point at SEA LEVEL from `range` metres, `heading` (deg, from north
 *  clockwise) and `pitch` (deg below the horizon); `fov` = vertical lens angle (16:9 canvas, 2.39 picture); `roll`
 *  (deg, the film's convention: - = banking right) */
export interface MapPose {
  lon: number;
  lat: number;
  range: number;
  heading: number;
  pitch: number;
  fov: number;
  roll: number;
}

/** a key of the move; `m` overrides the spline's tangent of a channel at this key (units per second; lr = log range) */
export interface CamKey extends MapPose {
  t: number;
  m?: Partial<Record<'lon' | 'lat' | 'lr' | 'heading' | 'pitch' | 'fov' | 'roll', number>>;
}

/**
 * P1's last frame (cut7's judah 'flight' at its end, FilmCams FILM_CAM.flight keys at flightT(6.5) = 11.15): the lens
 * ~100 m over the hills just east of Bethlehem (35.2146 E, 31.6999 N), looking WNW (bearing 284.4) 7.9 deg down, a
 * 40.9 deg lens, banked 2.75 deg right — and moving: turning right 18 deg/s, unbanking 1.9 deg/s, the lens narrowing
 * 1 deg/s, pushing on and down over the ridges (the moving dissolve carries exactly this on as a layer over P4).
 * The low sun is behind the lens' right shoulder in both sets (judah: az ~87; the map's bake: 104).
 */
export const P1_END = { lon: 35.2146, lat: 31.6999, heading: -75.6, pitch: 7.9, fov: 40.9, roll: -2.75, dHeading: 18, dRoll: 1.9, dFov: -1 } as const;

/**
 * P4's ONE move (CUT v6.1): IN by a MATCH dissolve out of P1 — the map opens on the same ridges at the same angle and
 * light as P1's last frame (the lens over the hills of Judah looking WNW toward the coast, still turning right, the
 * horizon high in the frame, banked a little) and goes on with P1's motion; as the dissolve ends the lens lifts and
 * soars up and back — one continuous rise, the turn to the right carried on until the whole region lies below, north
 * up (Egypt left, the wilderness low, the rift right) — while the flock crosses the wilderness. From `land` it sinks
 * over the land of Israel, turns back WNW (bearing 290) and comes down toward the coast, the five Philistine cities
 * glowing on the horizon in a warm haze, arriving low over the Shephelah — the dissolve into P6's dust lands on them.
 */
export function exodusKeys(): CamKey[] {
  const b = mapBeats();
  // the opening pose: P1's lens and heading from higher up (the map's relief is exaggerated x2.6 and ~1 km coarse: 6 km
  // world over the sea, the horizon where P1's skyline is — its own dip compensated), the look point at sea level
  const H0 = 6000;
  const dip0 = (Math.sqrt((2 * H0) / 6_371_000) * 180) / Math.PI;
  const p0 = 9.4 + dip0;
  const r0 = H0 / Math.sin((p0 * Math.PI) / 180);
  const h0 = r0 * Math.cos((p0 * Math.PI) / 180);
  const hd0 = (P1_END.heading * Math.PI) / 180;
  const lon0 = P1_END.lon + (h0 * Math.sin(hd0)) / (111_320 * Math.cos((P1_END.lat * Math.PI) / 180));
  const lat0 = P1_END.lat + (h0 * Math.cos(hd0)) / 110_574;
  const FL = b.flock, J = b.jordan;
  return [
    {
      t: 0, lon: lon0, lat: lat0, range: r0, heading: P1_END.heading, pitch: p0, fov: P1_END.fov, roll: P1_END.roll,
      // P1's motion at its cut: the push along the view (the range closing ~6 %/s), the turn, the lens, the bank
      m: { lon: 0, lat: 0, lr: -0.06, heading: P1_END.dHeading, pitch: 0, fov: P1_END.dFov, roll: P1_END.dRoll },
    },
    // the dissolve is over: the lens lifts off the ridges (still turning right), the look point barely moving yet
    { t: 1.0, lon: lon0 - 0.07, lat: lat0 - 0.04, range: 40_000, heading: -57.6, pitch: 14, fov: 37.5, roll: -0.8, m: { lon: -0.08, lat: -0.08 } },
    // the soar: up and back, the turn carried on — the coast, the delta coming into view on the left
    { t: 1.8, lon: 34.55, lat: 31.4, range: 210_000, heading: -30, pitch: 24, fov: 31, roll: 0 },
    // the whole region below, north up (Egypt left, the wilderness low, the rift right); the flock out of the delta
    { t: FL + 1.0, lon: 33.75, lat: 30.35, range: 900_000, heading: -6, pitch: 37, fov: 26.5, roll: 0 },
    { t: (FL + J) / 2 + 0.15, lon: 34.05, lat: 29.7, range: 800_000, heading: -2, pitch: 44, fov: 26, roll: 0 },
    { t: J - 0.5, lon: 35.05, lat: 29.85, range: 700_000, heading: -7, pitch: 47, fov: 26, roll: 0 },
    { t: b.gilgal, lon: 35.15, lat: 31.45, range: 520_000, heading: -14, pitch: 46, fov: 26, roll: 0 },
    { t: b.land + 0.9, lon: 35.0, lat: 31.7, range: 360_000, heading: -30, pitch: 45, fov: 26, roll: 0 },
    { t: b.dur - 1.8, lon: 34.8, lat: 31.71, range: 105_000, heading: -62, pitch: 17, fov: 28, roll: 0 },
    {
      // arriving: ~3 km over the western edge of the hills, the horizon 40 % down the picture, Ashdod ahead, the five
      // cities on the horizon band; still sinking a little at the cut (never a hold)
      t: b.dur, lon: 34.674, lat: 31.733, range: 43_000, heading: -70, pitch: 4.0, fov: 30, roll: 0,
      m: { lon: -0.004, lat: 0.0015, lr: -0.12, heading: -1.0, pitch: -0.6, fov: 0.3, roll: 0 },
    },
  ];
}

/**
 * The camera: ONE cubic Hermite spline through the keys, Catmull-Rom tangents inside (C1: no stop at any key) unless a
 * key sets its own (`m`), the range in LOG space (a constant perceived speed of climb / descent). It starts with P1's
 * motion and ends moving (the moving dissolve into P6 extrapolates it). C1 everywhere (no kink at a key): the look
 * point's tangents are set small where the lens is low (P1's match, the arrival), so the land never slides sideways
 * under a low lens; it travels while the lens is high.
 */
export interface MapCamPath {
  pose(take: string, t: number, out: MapPose): MapPose;
}

export function mapCamPath(): MapCamPath {
  const keys = exodusKeys();
  const n = keys.length;
  const T = keys.map((k) => k.t);
  type Ch = 'lon' | 'lat' | 'lr' | 'heading' | 'pitch' | 'fov' | 'roll';
  const ch: Record<Ch, number[]> = {
    lon: keys.map((k) => k.lon),
    lat: keys.map((k) => k.lat),
    lr: keys.map((k) => Math.log(k.range)),
    heading: keys.map((k) => k.heading),
    pitch: keys.map((k) => k.pitch),
    fov: keys.map((k) => k.fov),
    roll: keys.map((k) => k.roll),
  };
  const slope = (v: number[], i: number) => (v[i + 1] - v[i]) / (T[i + 1] - T[i]);
  const M = {} as Record<Ch, number[]>;
  for (const c of Object.keys(ch) as Ch[]) {
    const v = ch[c];
    M[c] = v.map((_, i) => {
      const o = keys[i].m?.[c];
      if (o !== undefined) return o;
      return i === 0 ? slope(v, 0) * 0.5 : i === n - 1 ? slope(v, n - 2) * 0.4 : (v[i + 1] - v[i - 1]) / (T[i + 1] - T[i - 1]);
    });
  }
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
      out.roll = herm(ch.roll, M.roll, i, u, dt);
      out.lon = herm(ch.lon, M.lon, i, u, dt);
      out.lat = herm(ch.lat, M.lat, i, u, dt);
      return out;
    },
  };
}
