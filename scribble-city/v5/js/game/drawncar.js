import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { clamp } from '../core/util.js';
import { setupDrawn, startMode } from './hybrid.js';
import { rideSpec } from './partsum.js';
import { buildPolished } from './partbuild.js';

// (ROADMAP 11.6) A vehicle drawn freehand from the side (ui/freedraw.js, read by
// game/freeform.js), its shape what it does. Each line drawn is read as a part of it:
//   - a big closed shape: the body (as long, as high as it was drawn; as wide as it is long); a
//     closed shape on it - a cab, a turret - is body too
//   - a round one low down: a wheel (a pair of them, one each side)
//   - a long thin line from up on it out past its nose: a cannon (it fires; drawn out of a closed
//     shape up there, that is a turret, and it turns to where you look)
//   - a long flat line at its middle: a wing (it glides; with a propeller or a jet, it flies)
//   - a flat line over its top: a rotor (it is a helicopter)
//   - a line up its nose: a propeller; a small shape at its back: a jet (Shift: faster)
//   - anything else: a line drawn on it (windows, a door, flames: drawn on its sides; off it -
//     a tail, skids, an aerial - a rod of its own)
// What it is follows from its parts: a rotor - a helicopter (game/vehicles.js updateCopter); wings
// and a propeller or a jet - a plane (game/rides.js updatePlane); wheels - it drives (drive, with
// a handling of its own: big wheels hold the road, a long one turns slowly, a heavy one is slow
// off the mark, jets give it a boost, wings let it glide off a ramp). It rides as one of the kinds
// the city has, with a model built from the drawing, in the colours it was drawn in.

export const KIND_NAME = { car: 'מכונית', glider: 'מכונית עם כנפיים', jetcar: 'מכונית סילון', copter: 'מסוק', plane: 'מטוס', still: 'פסל', bike: 'אופנוע', bus: 'אוטובוס', monster: 'מכונית מפלצת', tank: 'טנק', boat: 'סירה', balloon: 'כדור פורח', skate: 'סקייטבורד' };

// ------------------------------------------------------------------ reading the lines
// a stroke's shape: [z, y] points in metres (z forward, y up from the ground)
export function shapeOf(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let len = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    cx += x;
    cy += y;
    if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
  }
  cx /= pts.length;
  cy /= pts.length;
  const w = x1 - x0;
  const h = y1 - y0;
  const size = Math.max(w, h);
  const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  // (a long thin one goes round in not much more than twice its length)
  const closed = pts.length > 5 && gap < Math.max(0.3, size * 0.3) && len > size * 1.8 && len > gap * 6;
  // how round: the spread of the distances from its middle
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  let rs = 0;
  let rs2 = 0;
  for (const [x, y] of pts) {
    const d = Math.hypot(x - mx, y - my);
    rs += d;
    rs2 += d * d;
  }
  const r = rs / pts.length;
  const sd = Math.sqrt(Math.max(0, rs2 / pts.length - r * r));
  let area = 0;
  if (closed) for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  // how far it strays from the straight line between its ends (for its length)
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const cl = Math.hypot(bx - ax, by - ay) || 1e-6;
  let dev = 0;
  for (const [x, y] of pts) dev = Math.max(dev, Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / cl);
  // (round: no corners - a square's area fills more of its box than a circle's)
  const fillE = Math.abs(area) / 2 / Math.max(1e-6, (Math.PI / 4) * w * h);
  return { x0, x1, y0, y1, w, h, size, cx, cy, mx, my, r, round: closed && sd < r * 0.22 && w > h * 0.6 && h > w * 0.6 && fillE > 0.8 && fillE < 1.14, closed, area: Math.abs(area) / 2, len, dev: dev / cl };
}

// (ROADMAP 11.8) how often a line turns back: across (x) and up and down (y), wobbles smaller than
// eps of its size left out - a zigzag or a coil (a spring) turns back again and again, a wheel twice
export function turns(vals, e) {
  let n = 0;
  let dir = 0;
  let hi = vals[0];
  let lo = vals[0];
  let ext = vals[0];
  for (const v of vals) {
    if (dir === 0) {
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
      if (v >= lo + e) {
        dir = 1;
        ext = v;
      } else if (v <= hi - e) {
        dir = -1;
        ext = v;
      }
    } else if (dir > 0) {
      if (v > ext) ext = v;
      else if (v < ext - e) {
        n++;
        dir = -1;
        ext = v;
      }
    } else if (v < ext) ext = v;
    else if (v > ext + e) {
      n++;
      dir = 1;
      ext = v;
    }
  }
  return n;
}
export function wiggles(pts, eps = 0.07) {
  const sh = shapeOf(pts);
  const e = Math.max(1e-6, sh.size * eps);
  return { x: turns(pts.map((p) => p[0]), e), y: turns(pts.map((p) => p[1]), e) };
}
// a spring drawn: a zigzag (up and down it, or along it) or a coil of loops, not closed
export function springy(pts) {
  const sh = shapeOf(pts);
  if (sh.closed || sh.len < sh.size * 2.2) return 0;
  const w = wiggles(pts);
  if ((w.x >= 3 && w.y <= 1) || (w.y >= 3 && w.x <= 1)) return Math.max(w.x, w.y);
  if (w.x + w.y >= 7) return Math.round((w.x + w.y) / 2);
  return 0;
}

// what each stroke is (by itself and by where it is on the body); `fixed` ones keep their type
export function readParts(strokes) {
  const S = strokes.map((s) => ({ s, sh: shapeOf(s.pts) }));
  // the body: the biggest closed shape that is no wheel (a round one only if nothing else is
  // closed - two round ones are wheels whatever their size)
  let main = null;
  const other = S.some((o) => !o.s.fixed && o.sh.closed && !o.sh.round && o.sh.area > 0.1);
  for (const o of S) {
    if (o.s.fixed) continue;
    if (o.sh.closed && !(o.sh.round && (o.sh.size < 1.4 || other)) && o.sh.area > 0.2 && (!main || o.sh.area > main.sh.area)) main = o;
  }
  for (const o of S) if (o.s.fixed && o.s.type === 'body' && (!main || o.sh.area > main.sh.area)) main = o;
  const B = main ? main.sh : null;
  const outl = main ? outline(main.s.pts) : null;
  for (const o of S) {
    const { s, sh } = o;
    if (s.fixed) continue;
    const inside = outl && o !== main ? s.pts.filter((p) => inPoly(p[0], p[1], outl)).length / s.pts.length : 0;
    s.type = guess(sh, B, o === main, inside);
  }
  // a turret: a closed shape round the cannon's back end, up on the body
  const gun = S.find((o) => o.s.type === 'gun');
  if (gun && B) {
    const bx = gun.sh.x0;
    const by = gun.sh.cy;
    for (const o of S) {
      if (o === main || o.s.fixed || o.s.type !== 'body' || !o.sh.closed) continue;
      if (o.sh.cy > B.cy && bx > o.sh.x0 - 0.15 && bx < o.sh.x1 + 0.15 && by > o.sh.y0 - 0.15 && by < o.sh.y1 + 0.15) o.s.type = 'turret';
    }
  }
  return strokes;
}

function guess(sh, B, isMain, inside) {
  if (isMain) return 'body';
  if (!B) return sh.round ? 'wheel' : sh.closed && sh.area > 0.2 ? 'body' : 'line';
  const L = B.w;
  // a wheel: round, its bottom low (on the ground, or under the body's middle)
  if (sh.round && sh.size > L * 0.07 && sh.size < Math.max(2.4, L * 0.7) && sh.y0 < B.y0 + B.h * 0.45) return 'wheel';
  // a cannon: long and thin, from up on the body (behind its middle) out past its nose
  if (sh.w > sh.h * 3.5 && sh.w > L * 0.18 && (sh.closed || sh.dev < 0.1) && sh.x1 > B.x1 + L * 0.04 && sh.x0 > B.x0 + L * 0.3 && sh.x0 < B.x1 + L * 0.05 && sh.cy > B.y0 + B.h * 0.45) return 'gun';
  // a rotor: over the top, flat, about its middle, half as long as the body at least
  if (sh.cy > B.y1 - B.h * 0.1 && sh.w > sh.h * 3 && sh.w > L * 0.4 && Math.abs(sh.cx - B.cx) < L * 0.25 && (!sh.closed || sh.h < L * 0.08)) return 'rotor';
  // drawn on it (a window, a door, a stripe)
  if (inside >= 0.85) return 'line';
  // a flat line at its side: a wing
  // a flat line at its side, along it (not out past its nose or its tail): a wing
  // (touching it: one all under it is a skid; thin: a closed one sitting on its top is a cab)
  if (sh.w > sh.h * 2.5 && sh.w > L * 0.2 && sh.cy > B.y0 - B.h * 0.5 && sh.y1 > B.y0 && sh.cy < B.y1 + 0.1 && sh.x0 > B.x0 - L * 0.1 && sh.x1 < B.x1 + L * 0.1 && (!sh.closed || (sh.h < Math.max(0.25, L * 0.15) && sh.cy < B.cy + B.h * 0.3))) return 'wing';
  // up its nose: a propeller
  if (sh.h > sh.w * 1.8 && sh.cx > B.x1 - Math.max(0.35, L * 0.12)) return 'prop';
  // at its back, small: a jet
  if (sh.closed && sh.size < Math.max(1.1, L * 0.3) && sh.cx < B.x0 + Math.max(0.5, L * 0.2) && sh.cy > B.y0 - 0.2) return 'jet';
  // standing up over its back end: a fin (a plane's tail; on a car, a spoiler)
  if (sh.cx < B.x0 + L * 0.28 && sh.y1 > B.y1 + B.h * 0.2 && sh.cy > B.cy && sh.h > sh.w * 0.6 && sh.size < L * 0.45) return 'fin';
  // closed and on the body: a cab, a turret
  if (sh.closed && sh.x1 > B.x0 && sh.x0 < B.x1 && sh.y0 < B.y1 + B.h * 0.15 && sh.y1 > B.y0) return 'body';
  if (sh.closed && sh.area > Math.max(0.35, B.area * 0.5)) return 'body';
  return 'line';
}

// ------------------------------------------------------------------ what it is
// design: { strokes: [{ pts, type, col }], color, force?, abil? }. -> { ok, why, kind, base, label,
// stats, ... }. (ROADMAP 11.8) abil: what else it does (game/freeform.js) - what it needs for each
// way it goes is worked out then too: its handling on wheels, its rotor, its wings, its hull, its
// balloon (spec.modes)
export function specOf(design) {
  const P = design.strokes;
  const bodies = P.filter((s) => s.type === 'body');
  if (!bodies.length) return { ok: false, why: 'חסר גוף: ציירו צורה סגורה גדולה' };
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let area = 0;
  for (const s of bodies) {
    const sh = shapeOf(s.pts);
    x0 = Math.min(x0, sh.x0);
    x1 = Math.max(x1, sh.x1);
    y0 = Math.min(y0, sh.y0);
    y1 = Math.max(y1, sh.y1);
    area += sh.area || sh.w * sh.h * 0.7;
  }
  const L = x1 - x0;
  const H = y1 - y0;
  if (L < (design.force ? 0.15 : 0.4)) return { ok: false, why: 'הגוף קטן מדי' };
  const wheels = P.filter((s) => s.type === 'wheel').map((s) => {
    const sh = shapeOf(s.pts);
    return { z: sh.mx, y: sh.my, r: clamp((sh.w + sh.h) / 4, design.force === 'skate' ? 0.03 : 0.15, 1.3) };
  });
  const wings = P.filter((s) => s.type === 'wing').map((s) => shapeOf(s.pts));
  const rotors = P.filter((s) => s.type === 'rotor').map((s) => shapeOf(s.pts));
  const props = P.filter((s) => s.type === 'prop').map((s) => shapeOf(s.pts));
  const jets = P.filter((s) => s.type === 'jet').map((s) => shapeOf(s.pts));
  const guns = P.filter((s) => s.type === 'gun').map((s) => shapeOf(s.pts));
  const fins = P.filter((s) => s.type === 'fin');
  const chord = wings.reduce((a, w) => a + w.w, 0);
  let kind;
  // (what the network saw it as: game/freeform.js has made sure of its parts)
  const force = design.force;
  const A = design.abil || null;
  if (force === 'copter' || (!force && rotors.length)) kind = 'copter';
  // (wings and something to push it - or, with no wheels to drive on, a tail: a jet plane)
  else if (force === 'plane' || (!force && chord >= L * 0.22 && (props.length || jets.length || (fins.length && wheels.length < 2)))) kind = 'plane';
  else if (force === 'boat' || force === 'balloon' || force === 'skate') kind = force;
  else if (wheels.length) kind = jets.length ? 'jetcar' : chord > L * 0.2 && force !== 'car' ? 'glider' : 'car';
  else kind = force === 'car' ? 'car' : 'still';
  // as wide as it is long - a plane's body as wide as it is high, a boat's hull a third of its
  // length, a skateboard's deck a hand's width, a balloon's basket square
  const W = kind === 'plane' ? clamp(H * 1.05, 0.8, 1.9) : kind === 'boat' ? clamp(L * 0.32, 0.9, 4.2) : kind === 'skate' ? 0.24 : kind === 'balloon' ? clamp(L, 0.9, 2.2) : clamp(0.55 + L * 0.24, 0.9, 2.3);
  // its weight (a car's about 1: game/vehicles.js HANDLING)
  const mass = clamp((area * W) / 4.2 + wheels.length * 0.04 + jets.length * 0.08, kind === 'skate' ? 0.1 : 0.35, 3.2);
  const base = kind === 'copter' || kind === 'plane' || kind === 'boat' || kind === 'balloon' ? kind : kind === 'still' ? null : 'car';
  const out = { ok: !!base, kind, base, label: KIND_NAME[kind], L, H, W, mass, area, wheels, wings, rotors, props, jets, guns, chord, x0, x1, y0, y1 };
  if (!base) {
    out.why = 'בלי גלגלים, רוטור, או כנפיים עם מדחף — הוא לא יזוז';
    out.stats = { speed: 0, grip: 0, steady: 0, air: 0 };
    return out;
  }
  // the ways it goes (more than one: ROADMAP 11.8)
  const modes = {
    drive: base === 'car' || !!(A && A.drive),
    copter: base === 'copter' || !!(A && A.fly === 'rotor'),
    plane: base === 'plane' || !!(A && A.fly === 'wings'),
    boat: base === 'boat' || !!(A && A.float),
    balloon: base === 'balloon' || !!(A && A.fly === 'balloon'),
  };
  out.modes = modes;
  if (A) out.abil = A;
  // the wheels: their size, how far apart; the ground under them
  const rAvg = wheels.length ? wheels.reduce((a, w) => a + w.r, 0) / wheels.length : 0;
  let base0 = 0;
  let base1 = 0;
  if (wheels.length) {
    base0 = Math.min(...wheels.map((w) => w.z));
    base1 = Math.max(...wheels.map((w) => w.z));
  }
  const wheelbase = base1 - base0;
  if (modes.drive) {
    const nW = wheels.length;
    const grip = clamp(4.5 + Math.min(4, nW) * 1.1 + rAvg * 2.2 - (wheelbase < L * 0.35 ? 1.2 : 0), 3.5, 11);
    const top = clamp(26 + jets.length * 5 - mass * 3 + (rAvg > 0.5 ? 2 : 0) - (nW === 1 ? 6 : 0), 12, 42);
    const power = clamp(15 + jets.length * 2.5 - mass * 2.2, 6, 22);
    const steer = clamp(1.9 - L * 0.1 - (wheelbase > 4 ? 0.2 : 0), 0.8, 2.1);
    out.handling = { mass: clamp(mass, 0.5, 3), power, top, grip, slide: clamp(0.8 + grip * 0.03, 0.85, 1.2), steer, roll: clamp(H * 0.45, 0.2, 1.4), pitch: 0.5 };
    // (a skateboard: kicked along, light and quick to turn - and it hops, Space: an ollie)
    if (kind === 'skate') {
      out.handling = { mass: 0.5, power: 8.5, top: 14, grip: 6.5, slide: 1.0, steer: 2.3, roll: 0.2, pitch: 0.3 };
      out.spring = { jump: 5.4, ollie: true };
    }
    out.glide = chord > 0 && !modes.plane ? clamp(chord / L, 0.15, 0.75) : 0;
  }
  if (modes.copter) {
    const R = clamp((rotors.length ? Math.max(...rotors.map((r) => r.w)) / 2 : L * 0.5) * 1.4, 1.0, 4.5);
    out.rotorR = R;
    out.qCopter = { speed: clamp(0.65 + R * 0.12 - mass * 0.08, 0.5, 1.35), accel: clamp(0.8 + R * 0.1, 0.7, 1.3) };
  }
  if (modes.plane) out.qPlane = { speed: clamp(0.75 + jets.length * 0.18 + props.length * 0.05 - mass * 0.05, 0.6, 1.3), accel: clamp(1.15 + props.length * 0.1 + jets.length * 0.3, 1.0, 1.9) };
  if (modes.boat) {
    // on the water: an engine (at its back) fast; a sail as fast as it is big for the hull; with
    // neither, paddled - slow. How deep it sits: a third of its hull. A submarine dives.
    const hull = P.find((s) => s.hull && s.type === 'body');
    const hb = hull ? shapeOf(hull.pts) : { h: H, w: L };
    const sailA = P.filter((s) => s.type === 'sail').reduce((a, s) => {
      const sh = shapeOf(s.pts);
      return a + (sh.area || sh.w * sh.h * 0.5);
    }, 0);
    // (a submarine, a ship: engines inside them)
    const motors = jets.length || (design.cls === 'submarine' || design.cls === 'cruise ship' ? 1 : 0);
    let speed = motors ? clamp(1.0 + motors * 0.12 - mass * 0.03, 0.85, 1.35) : sailA > 0 ? clamp(0.55 + (sailA / Math.max(1, hb.w * hb.w)) * 1.4, 0.6, 1.15) : 0.5;
    if (design.cls === 'cruise ship') speed = Math.min(speed, 0.7);
    if (design.cls === 'submarine') speed = Math.min(speed, 0.85);
    // (a submarine sits low even up at the top, half of it under)
    const sink = design.cls === 'submarine' ? 0.55 : 0.38;
    out.boat = { q: { speed, accel: motors ? 1.25 : sailA ? 0.75 : 0.85 }, sail: sailA > 0 && !jets.length, motor: motors > 0, paddle: !motors && !sailA, jet: jets.length > 0 && hb.w < 4.5, dive: design.cls === 'submarine', draft: clamp(hb.h * sink, 0.15, 2.6) };
  }
  if (modes.balloon) {
    // the hotter its air, the higher it goes: how fast, by the size of its envelope for its weight
    const env = P.filter((s) => s.type === 'envelope').map((s) => shapeOf(s.pts));
    const E = env.length ? env[0] : { w: L * 2, h: L * 2.2 };
    const vol = (Math.PI / 6) * E.w * E.w * E.h;
    const lift = clamp(vol / (mass * 45 + 25), 0.5, 1.6);
    out.balloon = { lift, climb: clamp(1.8 + lift * 2.4, 2, 5.5), drift: clamp(3 + lift * 2.5, 3.5, 7) };
    out.envR = E.w / 2;
  }
  // its gun (any of them; armed, ROADMAP 11.8): a thick barrel a cannon, a thin one a machine gun -
  // or what the player picked
  if (guns.length) {
    const g = guns[0];
    const r = clamp(g.h * 0.5, 0.05, 0.3);
    const gk = A && A.gunKind;
    const cannon = gk ? gk === 'launcher' || gk === 'bomb' : !A && base === 'car' ? true : r >= 0.13;
    out.gun = { r, len: g.w, type: cannon ? 'cannon' : 'mg' };
  }
  // its gear (ROADMAP 11.8): a spring - it jumps (higher, the more it coils); a parachute - it
  // comes down slowly (the wider, the slower); armour - hits hurt it less
  const springs = P.filter((s) => s.type === 'spring');
  if (springs.length) {
    const sh = shapeOf(springs[0].pts);
    const n = springy(springs[0].pts);
    out.spring = { jump: clamp(7 + n * 0.45 + sh.h * 0.6, 7, 13) };
  }
  const chutes = P.filter((s) => s.type === 'chute').map((s) => shapeOf(s.pts));
  if (chutes.length) out.chute = { sink: clamp(4.4 - (chutes[0].w / Math.max(0.5, L)) * 1.1, 2.4, 4.4) };
  const armor = P.filter((s) => s.type === 'armor').length;
  if (armor || (A && A.gear === 'shield')) out.armor = clamp(0.3 + armor * 0.04, 0.3, 0.5);
  // how it goes on its own kind, for the tag (game/freeform.js statLine)
  if (base === 'car') {
    const nW = wheels.length;
    out.stats = { speed: out.handling.top / 42, grip: out.handling.grip / 11, steady: clamp((nW >= 4 ? 0.8 : nW === 3 ? 0.65 : nW === 2 ? 0.45 : 0.2) + (wheelbase / L) * 0.25 - H * 0.05, 0, 1), air: out.glide };
    // what it is called, by the look of it
    if (guns.length) out.label = KIND_NAME.tank;
    else if (rAvg > 0.62 && kind === 'car') out.label = KIND_NAME.monster;
    else if (nW === 2 && kind === 'car' && rAvg > H * 0.33) out.label = KIND_NAME.bike;
    else if (L > 6.6 && kind === 'car') out.label = KIND_NAME.bus;
    if (guns.length && (!out.gun || out.gun.type === 'cannon')) {
      const g = guns[0];
      out.cannon = { r: clamp(g.h * 0.5, 0.07, 0.3), len: g.w };
      out.stats.gun = clamp(out.cannon.r / 0.25, 0.3, 1);
    }
  } else if (base === 'copter') {
    out.q = out.qCopter;
    out.stats = { speed: out.q.speed / 1.35, grip: 0.5, steady: clamp(0.4 + out.rotorR * 0.12, 0, 1), air: 1 };
  } else if (base === 'plane') {
    out.q = out.qPlane;
    out.stats = { speed: out.q.speed / 1.3, grip: 0.4, steady: clamp(chord / L, 0, 1), air: 1 };
  } else if (base === 'boat') {
    out.q = out.boat.q;
    out.stats = { speed: out.q.speed / 1.35, grip: 0.5, steady: clamp(0.35 + L / 20, 0, 1), air: 0 };
  } else {
    out.q = { speed: 1, accel: 1 };
    out.stats = { speed: out.balloon.drift / 7, grip: 0.3, steady: clamp(out.balloon.lift / 1.6, 0, 1), air: 1 };
  }
  // (its name as the network called it: a truck, a bus, a tractor...)
  if (design.name) out.label = design.name;
  const nModes = Object.values(modes).filter(Boolean).length;
  out.hp = Math.round(clamp(90 + mass * 60 + (base === 'copter' ? 60 : 0) + (guns.length ? 80 : 0), 80, 400) * (out.armor ? 1.35 : 1));
  out.cost = Math.round(clamp(24 + P.length * 1.5 + jets.length * 4 + guns.length * 10 + (base === 'copter' ? 14 : base === 'plane' ? 10 : 0) + (nModes - 1) * 8 + (out.spring && kind !== 'skate' ? 6 : 0) + (out.chute ? 6 : 0) + (out.armor ? 6 : 0), 24, 90));
  return out;
}

// ------------------------------------------------------------------ the model
// the closed outline, simplified; a crossed one: its hull
export function outline(pts) {
  const out = [];
  const step = Math.max(0.06, pathLength(pts) / 140);
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > step) out.push(p);
  }
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.05) out.pop();
  return crossed(out) ? hull(out) : out;
}

function pathLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

function crossed(P) {
  const n = P.length;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < n; i++) {
    const a = P[i];
    const b = P[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = P[j];
      const d = P[(j + 1) % n];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
    }
  }
  return false;
}

export function hull(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}

export const shade = (c, k) => linC(Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k));
const lum = (c) => c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;

// a line's colour on a surface of colour `under`: its own, unless it would not show there
export function inkOn(c, under) {
  if (Math.abs(lum(c) - lum(under)) > 0.18 || Math.hypot(c[0] - under[0], c[1] - under[1], c[2] - under[2]) > 0.35) return linC(c[0], c[1], c[2]);
  return lum(under) < 0.35 ? shade([0.75, 0.74, 0.7], 1) : shade(c, 0.3);
}

export function inPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if (P[i][1] > y !== P[j][1] > y && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1] + 1e-9) + P[i][0]) inside = !inside;
  }
  return inside;
}

// a line with no point closer than d to the last
export function thin(pts, d, max = 40) {
  const out = [pts[0]];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= d) out.push(p);
  }
  if (out.length === 1 && pts.length > 1) out.push(pts[pts.length - 1]);
  return out.slice(0, max);
}

// a drawn shape made solid (three.js's extrusion), without its triangles that are only a line -
// three points of a hand-drawn outline almost in a row - or not numbers at all: such a triangle
// has no side to face, its normal is nothing, and in the pen's shader that is no number at all,
// which the glow then spreads into a black blot. They covered nothing, so the shape looks the same
export function solid(g) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  if (g.index || !n) return g;
  const keep = [];
  for (let t = 0; t + 2 < p.count; t += 3) {
    let ok = true;
    for (let i = t; i < t + 3 && ok; i++) {
      const l = n.getX(i) * n.getX(i) + n.getY(i) * n.getY(i) + n.getZ(i) * n.getZ(i);
      ok = l > 0.5 && Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i));
    }
    if (ok) keep.push(t);
  }
  if (keep.length * 3 === p.count) return g;
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) {
    const k = a.itemSize;
    const arr = new a.array.constructor(keep.length * 3 * k);
    keep.forEach((t, j) => arr.set(a.array.subarray(t * k, (t + 3) * k), j * 3 * k));
    out.setAttribute(name, new THREE.BufferAttribute(arr, k, a.normalized));
  }
  g.dispose();
  return out;
}

const _ta = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _UP = new THREE.Vector3(0, 1, 0);
// a round rod from a to b ([x, y, z])
export function tube(K, mat, a, b, r, color, segs = 7) {
  _ta.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _ta.length();
  if (len < 0.005) return;
  const g = new THREE.CylinderGeometry(r, r, len + r, segs);
  _tq.setFromUnitVectors(_UP, _ta.normalize());
  g.applyQuaternion(_tq);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  K.add(mat, g, color);
}

// a flat band along pts on the plane x = x0, w wide, facing sx
export function ribbon(pts, x0, w, sx) {
  const pos = [];
  const nor = [];
  const h = w / 2;
  for (let i = 1; i < pts.length; i++) {
    const [z0, y0] = pts[i - 1];
    const [z1, y1] = pts[i];
    const dz = z1 - z0;
    const dy = y1 - y0;
    const l = Math.hypot(dz, dy);
    if (l < 1e-5) continue;
    // across the line in its plane, and a little past both its ends (round enough joins)
    const nz = (-dy / l) * h;
    const ny = (dz / l) * h;
    const ez = (dz / l) * h * 0.6;
    const ey = (dy / l) * h * 0.6;
    const a = [x0, y0 + ny - ey, z0 + nz - ez];
    const b = [x0, y0 - ny - ey, z0 - nz - ez];
    const c = [x0, y1 - ny + ey, z1 - nz + ez];
    const d = [x0, y1 + ny + ey, z1 + nz + ez];
    const quad = sx > 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
    for (const q of quad) {
      pos.push(q[0], q[1], q[2]);
      nor.push(sx, 0, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

function wheelModel(M, r, w, rim) {
  const K = new Kit();
  K.add(M.matte, new THREE.TorusGeometry(r * 0.78, r * 0.24, 8, 22).rotateY(Math.PI / 2), linC(0.1, 0.1, 0.13));
  K.add(M.metal, new THREE.CylinderGeometry(r * 0.55, r * 0.55, w, 16).rotateZ(Math.PI / 2), rim);
  K.add(M.matte, new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.25, 10).rotateZ(Math.PI / 2), linC(0.16, 0.16, 0.2));
  for (let k = 0; k < 3; k++) {
    const sp = new THREE.BoxGeometry(w * 1.1, r * 1.0, 0.05);
    sp.rotateX((k / 3) * Math.PI);
    K.add(M.matte, sp, linC(0.2, 0.2, 0.24));
  }
  const g = K.build();
  g.matrixAutoUpdate = true;
  return g;
}

// ------------------------------------------------------------------ (ROADMAP 11.8) boats, balloons
// the outline's top and bottom at z (o: a closed outline of [z, y]); null: not over it
export function spanAt(o, z) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [za, ya] = o[j];
    const [zb, yb] = o[i];
    if ((za <= z && zb >= z) || (zb <= z && za >= z)) {
      const t = Math.abs(zb - za) < 1e-9 ? 0.5 : (z - za) / (zb - za);
      const y = ya + (yb - ya) * t;
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

// a boat's hull from its outline drawn side on (o: [z, y] in the model's frame, the bow at +z):
// at each station along it from the deck down to the keel and up again, round-bottomed, as wide
// as the boat amidships, narrowing to an edge at the bow and a little at the stern (a transom).
// Returns { geo, deck, half(z, y): how far its side is out from its middle there }
export function hullGeometry(o, W) {
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [z] of o) {
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const NZ = 28;
  const K2 = 16;
  const taper = (u) => (u > 0.55 ? 1 - Math.pow((u - 0.55) / 0.45, 1.7) * 0.92 : u < 0.1 ? 0.8 + (u / 0.1) * 0.2 : 1);
  const pos = [];
  const idx = [];
  const rows = [];
  let last = [0, 0.1];
  for (let i = 0; i <= NZ; i++) {
    const u = i / NZ;
    const z = z0 + (z1 - z0) * (0.003 + u * 0.994);
    const sp = spanAt(o, z) || last;
    last = sp;
    const hw = (W / 2) * taper(u);
    const row = [];
    for (let k = 0; k <= K2; k++) {
      const th = (-1 + (2 * k) / K2) * (Math.PI / 2);
      row.push(pos.length / 3);
      pos.push(hw * Math.sin(th), sp[1] - (sp[1] - sp[0]) * Math.cos(th), z);
    }
    rows.push({ row, sp, hw, z });
  }
  for (let i = 0; i < NZ; i++) {
    for (let k = 0; k < K2; k++) {
      const a = rows[i].row[k];
      const b = rows[i].row[k + 1];
      const c = rows[i + 1].row[k];
      const d = rows[i + 1].row[k + 1];
      idx.push(a, b, c, b, d, c);
    }
  }
  // the transom and the bow's last sliver: closed by a fan from their middles (their own points,
  // for a sharp edge round them)
  for (const [ri, dir] of [[0, -1], [NZ, 1]]) {
    const R = rows[ri];
    const c = pos.length / 3;
    pos.push(0, (R.sp[0] + R.sp[1]) / 2, R.z);
    const own = R.row.map((v) => {
      pos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      return pos.length / 3 - 1;
    });
    for (let k = 0; k < K2; k++) {
      if (dir < 0) idx.push(c, own[k + 1], own[k]);
      else idx.push(c, own[k], own[k + 1]);
    }
    if (dir < 0) idx.push(c, own[0], own[K2]);
    else idx.push(c, own[K2], own[0]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  // the deck: flat across its top, station to station
  const dp = [];
  const dn = [];
  for (let i = 0; i < NZ; i++) {
    const A = rows[i];
    const B = rows[i + 1];
    const L0 = [-A.hw, A.sp[1], A.z];
    const R0 = [A.hw, A.sp[1], A.z];
    const L1 = [-B.hw, B.sp[1], B.z];
    const R1 = [B.hw, B.sp[1], B.z];
    for (const v of [L0, L1, R0, R0, L1, R1]) {
      dp.push(v[0], v[1], v[2]);
      dn.push(0, 1, 0);
    }
  }
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  deck.setAttribute('normal', new THREE.Float32BufferAttribute(dn, 3));
  deck.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((dp.length / 3) * 2), 2));
  const half = (z, y) => {
    const u = clamp((z - z0) / Math.max(1e-3, z1 - z0), 0, 1);
    const sp = spanAt(o, z) || last;
    const c = clamp((sp[1] - y) / Math.max(1e-3, sp[1] - sp[0]), 0, 1);
    return (W / 2) * taper(u) * Math.sqrt(1 - c * c);
  };
  return { geo, deck, half };
}

// a hot air balloon's envelope from its outline (o: [z, y]): turned round its upright middle - as
// wide at each height as it was drawn there - in gores of its colours. Returns { geos: [[geo,
// colour]], axis (its z), r(y), y0, y1 }
export function envelopeGeometry(o, cols) {
  let y0 = Infinity;
  let y1 = -Infinity;
  let za = Infinity;
  let zb = -Infinity;
  for (const [z, y] of o) {
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    za = Math.min(za, z);
    zb = Math.max(zb, z);
  }
  const axis = (za + zb) / 2;
  const N = 22;
  const prof = [];
  for (let i = 0; i <= N; i++) {
    const y = y0 + ((y1 - y0) * i) / N;
    // (across the outline at this height: where it is crossed)
    let lo = Infinity;
    let hi = -Infinity;
    for (let a = 0, b = o.length - 1; a < o.length; b = a++) {
      const [zA, yA] = o[b];
      const [zB, yB] = o[a];
      if ((yA <= y && yB >= y) || (yB <= y && yA >= y)) {
        const t = Math.abs(yB - yA) < 1e-9 ? 0.5 : (y - yA) / (yB - yA);
        const z = zA + (zB - zA) * t;
        lo = Math.min(lo, z);
        hi = Math.max(hi, z);
      }
    }
    prof.push(lo <= hi ? (hi - lo) / 2 : 0);
  }
  // (closed at the crown, the mouth left a little open at the bottom; smoothed a little)
  const r = prof.map((v, i) => (i === 0 || i === N ? v : (prof[i - 1] + v * 2 + prof[i + 1]) / 4));
  r[N] = 0;
  r[0] = Math.max(r[0], Math.max(...r) * 0.16);
  const pts = r.map((v, i) => new THREE.Vector2(Math.max(0.001, v), y0 + ((y1 - y0) * i) / N));
  const G = 12;
  const geos = [];
  for (let k = 0; k < G; k++) {
    const g = new THREE.LatheGeometry(pts, 3, (k / G) * Math.PI * 2, (Math.PI * 2) / G);
    g.translate(0, 0, axis);
    geos.push([g, cols[k % cols.length]]);
  }
  const rAt = (y) => {
    const t = clamp((y - y0) / Math.max(1e-3, y1 - y0), 0, 1) * N;
    const i = Math.min(N - 1, Math.floor(t));
    return r[i] + (r[i + 1] - r[i]) * (t - i);
  };
  return { geos, axis, rAt, y0, y1, pts, G };
}

// a coil spring standing from y0 up to y1 at z, r round
export function helixGeometry(z, y0, y1, r, turns) {
  const P = [];
  const n = Math.max(24, Math.round(turns * 16));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2;
    P.push(new THREE.Vector3(Math.cos(a) * r, y0 + ((y1 - y0) * i) / n, z + Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P), n, clamp(r * 0.14, 0.02, 0.07), 6, false);
}

// a stroke's colour ([r, g, b], 0..1); one drawn in pencil takes the vehicle's own paint
export const colOf = (s, design) => (s.col && !s.pencil ? s.col : design.color);

// the vehicle's own frame (game/vehicles.js): x across (+x its left), y up, z forward, on the
// ground at y = 0. Returns what game/vehicles.js needs of a model.
export function buildModel(design, spec) {
  const M = itemMats();
  const base = design.color;
  const W = spec.W;
  const zc = (spec.x0 + spec.x1) / 2;
  // what touches the ground: the wheels' bottoms (else the body's; a spring under it, its foot)
  let floor = spec.y0;
  if (spec.wheels.length) floor = Math.min(...spec.wheels.map((w) => w.y - w.r));
  for (const s of design.strokes) if (s.type === 'spring') floor = Math.min(floor, shapeOf(s.pts).y0);
  const Z = (z) => z - zc;
  const Y = (y) => y - floor;
  const K = new Kit();
  // the body: each closed part as drawn, as wide as it is long; its edges rounded off
  const bev = Math.min(0.08, W * 0.06);
  const slab = (Kk, s, w, mat) => {
    const o = outline(s.pts);
    if (o.length < 3) return;
    const shape = new THREE.Shape(o.map(([z, y]) => new THREE.Vector2(Z(z), Y(y))));
    const g = solid(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.02, w - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 }));
    // (shape x - forward - to z; its depth across, centred)
    g.rotateY(-Math.PI / 2);
    g.translate(w / 2 - bev, 0, 0);
    Kk.add(mat, g, linC(...colOf(s, design)));
  };
  // (the biggest first; a part on it a little narrower, so both show)
  // (a bicycle's frame of lines: slim)
  const bodies = design.strokes.filter((s) => s.type === 'body').map((s) => ({ s, a: shapeOf(s.pts).area })).sort((a, b) => b.a - a.a);
  // (ROADMAP 11.8) a boat's hull: shaped like one (narrowing to its bow), its deck flat; what stands
  // on it (a cabin, a tower) narrower
  let hull = null;
  const hullS = spec.base === 'boat' ? bodies.find((o) => o.s.hull) || bodies[0] : null;
  bodies.forEach((o, i) => {
    if (o === hullS) {
      const ol = outline(o.s.pts).map(([z, y]) => [Z(z), Y(y)]);
      if (ol.length >= 3) {
        hull = hullGeometry(ol, W);
        const c = colOf(o.s, design);
        K.add(M.paint, hull.geo, linC(...c));
        K.add(M.matte, hull.deck, shade(c, 0.62));
        o.w = W;
        return;
      }
    }
    o.w = o.s.slim ? W * 0.3 : hullS ? W * 0.58 : i ? W * 0.94 : W;
    slab(K, o.s, o.w, M.paint);
  });
  // the lines drawn on it, on both its sides (a flat band on each - on a boat's hull, on its side
  // as it curves in)
  const lineOn = (pts, w, c, out = 0.02, onHull = false) => {
    const P = pts.map(([z, y]) => [Z(z), Y(y)]);
    for (const sx of [-1, 1]) {
      const g = ribbon(P, sx * (W / 2 + out), w, sx);
      if (onHull && hull) {
        const a = g.attributes.position;
        for (let i = 0; i < a.count; i++) a.setX(i, sx * (hull.half(a.getZ(i), a.getY(i)) + out));
      }
      K.add(M.matte, g, c);
    }
  };
  const hullOl = hullS ? outline(hullS.s.pts) : null;
  const onHullP = (p) => hullOl && inPoly(p[0], p[1], hullOl);
  // (a line on the body is drawn on both its sides; one off it - a tail, an aerial, skids under
  // it - is a rod of its own: two under it, one anywhere else)
  const outl = bodies.map((o) => outline(o.s.pts));
  const onBody = (p) => outl.some((o) => inPoly(p[0], p[1], o));
  const rod = (pts, x, r, c) => {
    const P = thin(pts, 0.06);
    for (let i = 1; i < P.length; i++) tube(K, M.matte, [x, Y(P[i - 1][1]), Z(P[i - 1][0])], [x, Y(P[i][1]), Z(P[i][0])], r, c);
  };
  // (a balloon's envelope: turned round, in gores of its colours - the lines drawn on it, on its
  // skin front and back)
  let env = null;
  const envS = design.strokes.find((s) => s.type === 'envelope');
  if (envS) {
    const ol = outline(envS.pts).map(([z, y]) => [Z(z), Y(y)]);
    const inks = [...new Set(design.strokes.filter((s) => s.type === 'line' && s.col && !s.pencil && !s.neon && shapeOf(s.pts).cy > shapeOf(envS.pts).y0).map((s) => s.col.join(',')))].map((k) => k.split(',').map(Number));
    const c0 = colOf(envS, design);
    const cols = [c0, inks[0] || [0.98, 0.95, 0.86], inks[1] || c0.map((v) => v * 0.72)];
    if (ol.length >= 3) {
      env = envelopeGeometry(ol, cols.map((c) => linC(...c)));
      for (const [g, col] of env.geos) K.add(M.paint, g, col);
      // its seams down the gores, the burner under its mouth
      const dark = linC(0.07, 0.06, 0.1);
      for (let k = 0; k < env.G; k++) {
        const a = (k / env.G) * Math.PI * 2;
        const P = env.pts.map((v) => [Math.sin(a) * v.x * 1.004, v.y, env.axis + Math.cos(a) * v.x * 1.004]);
        for (let i = 1; i < P.length; i++) tube(K, M.matte, P[i - 1], P[i], 0.022, dark, 5);
      }
      K.cyl(M.metal, 0.22, 0.22, env.y0 - 0.5, env.y0 - 0.15, linC(0.45, 0.45, 0.5), { axis: 'y', z: env.axis, segs: 10 });
    }
  }
  const onEnv = (p) => env && Math.abs(Z(p[0]) - env.axis) < env.rAt(Y(p[1])) * 0.98 && Y(p[1]) > env.y0 && Y(p[1]) < env.y1;
  for (const s of design.strokes) {
    if (s.type !== 'line' && s.type !== 'armor') continue;
    const c = s.col && !s.pencil ? s.col : [0.07, 0.06, 0.1];
    if (env && s.type === 'line' && s.pts.filter(onEnv).length / s.pts.length >= 0.7) {
      const P = thin(s.pts, 0.08, 60).filter(onEnv);
      const ink = s.neon ? linC(...c) : inkOn(c, colOf(envS, design));
      for (const sx of [-1, 1]) {
        const at = ([z, y]) => {
          const dz = Z(z) - env.axis;
          const r = env.rAt(Y(y));
          return [sx * Math.sqrt(Math.max(0, r * r - dz * dz)) * 1.01, Y(y), Z(z)];
        };
        for (let i = 1; i < P.length; i++) tube(K, M.matte, at(P[i - 1]), at(P[i]), 0.035, ink, 5);
      }
      continue;
    }
    const inside = s.pts.filter(onBody).length / s.pts.length;
    // (on a part narrower than the body - a boat's cabin: on its sides)
    let host = null;
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (bodies[i].w < W - 0.01 && s.pts.filter((p) => inPoly(p[0], p[1], outl[i])).length / s.pts.length >= 0.6) {
        host = bodies[i];
        break;
      }
    }
    if (s.type === 'armor') lineOn(thin(s.pts, 0.04, 80), 0.11, inkOn(s.col && !s.pencil ? s.col : [0.32, 0.33, 0.36], base), 0.03, s.pts.some(onHullP));
    else if (host) lineOn(thin(s.pts, 0.04, 80), 0.06, s.neon ? linC(...c) : inkOn(c, colOf(host.s, design)), 0.02 - (W - host.w) / 2);
    else if (inside >= 0.6) lineOn(thin(s.pts, 0.04, 80), 0.06, s.neon ? linC(...c) : inkOn(c, base), 0.02, s.pts.filter(onHullP).length / s.pts.length >= 0.6);
    else if (Math.max(...s.pts.map((p) => p[1])) < spec.y0 + 0.15) for (const x of [-W * 0.35, W * 0.35]) rod(s.pts, x, 0.05, shade(colOf(s, design), 0.45));
    else rod(s.pts, 0, 0.07, shade(colOf(s, design), 0.45));
  }
  // the outlines of the closed parts, a dark edge on both sides
  for (const o of bodies) if (!o.s.slim) lineOn(thin(outline(o.s.pts).concat([outline(o.s.pts)[0]]), 0.05, 80), 0.045, inkOn([0.07, 0.06, 0.1], colOf(o.s, design)), 0.02 - (W - o.w) / 2, o === hullS);
  // wings: flat across, as deep as drawn; in their colour, the tips darker
  const parts = { wheels: [], jetsAt: [] };
  for (const s of design.strokes) {
    if (s.type !== 'wing') continue;
    const sh = shapeOf(s.pts);
    // (seen from above, ui/freeform.js: as wide as it was drawn)
    const span = s.span ? clamp(s.span, 2.2, 16) : clamp(sh.w * 2.4, 2.2, 9);
    const c = colOf(s, design);
    K.box(M.paint, -span / 2, Y(sh.cy) - 0.05, Z(sh.x0), span / 2, Y(sh.cy) + 0.05, Z(sh.x1), shade(c, 1.15));
    K.box(M.matte, -span / 2 - 0.02, Y(sh.cy) - 0.06, Z(sh.x0), -span / 2 + 0.25, Y(sh.cy) + 0.06, Z(sh.x1), shade(c, 0.45));
    K.box(M.matte, span / 2 - 0.25, Y(sh.cy) - 0.06, Z(sh.x0), span / 2 + 0.02, Y(sh.cy) + 0.06, Z(sh.x1), shade(c, 0.45));
    parts.span = Math.max(parts.span || 0, span);
  }
  // fins: a thin upright plate where it was drawn
  for (const s of design.strokes) {
    if (s.type !== 'fin') continue;
    const sh = shapeOf(s.pts);
    const c = colOf(s, design);
    const P = sh.closed ? outline(s.pts) : null;
    if (P && P.length >= 3) {
      const g = solid(new THREE.ExtrudeGeometry(new THREE.Shape(P.map(([z, y]) => new THREE.Vector2(Z(z), Y(y)))), { depth: 0.08, bevelEnabled: false, curveSegments: 2 }));
      g.rotateY(-Math.PI / 2);
      g.translate(0.04, 0, 0);
      K.add(M.paint, g, shade(c, 1.1));
    } else {
      const top = s.pts.reduce((a, p) => (p[1] > a[1] ? p : a), s.pts[0]);
      const shp = new THREE.Shape([new THREE.Vector2(Z(sh.x0), Y(spec.y1) - 0.1), new THREE.Vector2(Z(sh.x1 + 0.15), Y(spec.y1) - 0.1), new THREE.Vector2(Z(top[0]), Y(top[1]))]);
      const g = solid(new THREE.ExtrudeGeometry(shp, { depth: 0.08, bevelEnabled: false, curveSegments: 2 }));
      g.rotateY(-Math.PI / 2);
      g.translate(0.04, 0, 0);
      K.add(M.paint, g, shade(c, 1.1));
    }
  }
  // (ROADMAP 11.8) sails: a thin sheet where it was drawn (in pencil: sailcloth white)
  for (const s of design.strokes) {
    if (s.type !== 'sail') continue;
    const P = outline(s.pts);
    if (P.length < 3) continue;
    const g = solid(new THREE.ExtrudeGeometry(new THREE.Shape(P.map(([z, y]) => new THREE.Vector2(Z(z), Y(y)))), { depth: 0.05, bevelEnabled: false, curveSegments: 2 }));
    g.rotateY(-Math.PI / 2);
    g.translate(0.025, 0, 0);
    K.add(M.paint, g, s.col && !s.pencil ? linC(...s.col) : linC(0.97, 0.95, 0.9));
    lineOn(thin(P.concat([P[0]]), 0.06, 60), 0.04, linC(0.07, 0.06, 0.1), 0.03 - W / 2);
  }
  // a parachute over it: a dome in gores, on its lines (the lines are rods: drawn as they were)
  for (const s of design.strokes) {
    if (s.type !== 'chute') continue;
    const sh = shapeOf(s.pts);
    const rx = clamp(sh.w / 2, 0.6, 7);
    const ry = clamp(sh.closed ? sh.h : sh.h * 0.9, rx * 0.25, rx * 0.8);
    const c = colOf(s, design);
    for (let k = 0; k < 10; k++) {
      const g = new THREE.SphereGeometry(1, 3, 6, (k / 10) * Math.PI * 2, Math.PI / 5, 0, Math.PI / 2);
      g.scale(rx, ry, rx * 0.86);
      g.translate(0, Y(sh.y0), Z(sh.mx));
      K.add(M.paint, g, k % 2 ? linC(0.98, 0.96, 0.9) : linC(...c));
    }
    const under = new THREE.CircleGeometry(1, 20).rotateX(Math.PI / 2);
    under.scale(rx, 1, rx * 0.86);
    under.translate(0, Y(sh.y0), Z(sh.mx));
    K.add(M.matte, under, shade(c, 0.55));
  }
  // a spring under it: a coil, steel
  for (const s of design.strokes) {
    if (s.type !== 'spring') continue;
    const sh = shapeOf(s.pts);
    const r = clamp(Math.min(sh.w, sh.h) / 2, 0.12, 0.55);
    const n = clamp(Math.round(springy(s.pts) / 2), 3, 9);
    for (const x of spec.base === 'car' && W > 0.6 ? [-W * 0.22, W * 0.22] : [0]) {
      const g = helixGeometry(Z(sh.mx), Y(sh.y0), Y(sh.y1), r, n);
      g.translate(x, 0, 0);
      K.add(M.metal, g, linC(0.7, 0.72, 0.78));
    }
  }
  // jets: a tube out of its back, the glow at its end (on a boat: its outboard motor, its leg down
  // in the water)
  for (const s of design.strokes) {
    if (s.type !== 'jet') continue;
    const sh = shapeOf(s.pts);
    if (spec.base === 'boat') {
      const zc2 = Z(Math.min(sh.cx, spec.x0 + 0.3));
      const top2 = Y(Math.max(sh.y1, spec.y0 + 0.3));
      const c = s.col && !s.pencil ? linC(...s.col) : linC(0.36, 0.37, 0.42);
      K.box(M.paint, -0.22, top2 - 0.55, zc2 - 0.3, 0.22, top2, zc2 + 0.18, c);
      K.sphere(M.paint, 0.26, 0, top2, zc2 - 0.06, c, 0.9, 0.7, 1.2, 10);
      K.box(M.matte, -0.06, -0.55, zc2 - 0.12, 0.06, top2 - 0.5, zc2, linC(0.12, 0.12, 0.15));
      parts.jetsAt.push([0, -0.3, zc2 - 0.3]);
      continue;
    }
    const r = clamp(sh.size / 2, 0.15, 0.6);
    const z1 = Z(Math.max(sh.x1, spec.x0 + 0.2));
    const z0 = Z(sh.x0) - 0.2;
    K.cyl(M.metal, r, r * 0.8, z0, z1, linC(0.55, 0.56, 0.62), { y: Y(sh.cy), segs: 12 });
    K.cyl(M.glow, r * 0.62, r * 0.62, z0 - 0.04, z0 + 0.02, s.neon ? linC(...s.col) : linC(1.0, 0.55, 0.2), { y: Y(sh.cy), segs: 12 });
    parts.jetsAt.push([0, Y(sh.cy), z0 - 0.1]);
  }
  const body = K.build({ seed: 0.42 });
  body.matrixAutoUpdate = true;
  // the wheels: a pair each, turning (one model for each size and colour, copies of it)
  const made = new Map();
  for (const s of design.strokes) {
    if (s.type !== 'wheel') continue;
    const sh = shapeOf(s.pts);
    // (a skateboard's: little ones on their trucks, under its deck)
    const skate = spec.kind === 'skate';
    const r = clamp((sh.w + sh.h) / 4, skate ? 0.025 : 0.15, 1.3);
    const ww = skate ? 0.045 : Math.min(0.42, r * 0.7);
    const rim = s.col && !s.pencil ? shade(s.col, 1) : linC(0.78, 0.78, 0.82);
    const key = `${r.toFixed(2)}:${rim.join(',')}`;
    for (const sx of [-1, 1]) {
      let g = made.get(key);
      if (g) g = g.clone();
      else {
        g = wheelModel(M, r, ww, rim);
        made.set(key, g);
      }
      g.position.set(sx * (skate ? W * 0.42 : W / 2 + ww / 2 + 0.02), Y(sh.my), Z(sh.mx));
      body.add(g);
      parts.wheels.push(g);
    }
  }
  // the cannon: out of the turret (a closed shape round its back end), the turret turning
  let turret = null;
  let muzzle = null;
  const gunS = design.strokes.find((s) => s.type === 'gun');
  if (gunS) {
    const g = shapeOf(gunS.pts);
    const T = new Kit();
    const tur = design.strokes.filter((s) => s.type === 'turret');
    const piv = tur.length ? shapeOf(tur[0].pts) : g;
    const pz = Z(tur.length ? piv.cx : g.x0);
    const py = Y(tur.length ? piv.cy : g.cy);
    const slabT = (s) => {
      const o = outline(s.pts);
      if (o.length < 3) return;
      const w = W * 0.72;
      const shape = new THREE.Shape(o.map(([z, y]) => new THREE.Vector2(Z(z) - pz, Y(y) - py)));
      const geo = solid(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.02, w - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 }));
      geo.rotateY(-Math.PI / 2);
      geo.translate(w / 2 - bev, 0, 0);
      T.add(M.paint, geo, linC(...colOf(s, design)));
    };
    for (const s of tur) slabT(s);
    const r = spec.cannon ? spec.cannon.r : 0.12;
    const zb = Z(g.x0) - pz;
    const zf = Z(g.x1) - pz;
    const yb = Y(g.cy) - py;
    T.cyl(M.metal, r, r * 0.9, zb, zf, shade(colOf(gunS, design), 0.6), { y: yb, segs: 12 });
    T.cyl(M.metal, r * 1.25, r * 1.25, zf - 0.18, zf, shade(colOf(gunS, design), 0.45), { y: yb, segs: 12 });
    T.cyl(M.matte, r * 0.7, r * 0.7, zf - 0.01, zf + 0.004, linC(0.03, 0.03, 0.04), { y: yb, segs: 10 });
    turret = T.build({ seed: 0.31 });
    turret.matrixAutoUpdate = true;
    turret.position.set(0, py, pz);
    body.add(turret);
    muzzle = new THREE.Vector3(0, yb, zf + 0.15);
  }
  // the rotor: over its top, on a mast
  let rotor = null;
  if (spec.rotors.length) {
    const r = spec.rotors[0];
    const R = spec.rotorR || 2;
    const y = Y(Math.max(r.cy, spec.y1 + 0.2));
    const ink = linC(0.07, 0.06, 0.1);
    const Rk = new Kit();
    Rk.box(M.matte, -0.09, -0.04, -R, 0.09, 0.04, R, ink);
    Rk.box(M.matte, -R, -0.04, -0.09, R, 0.04, 0.09, ink);
    Rk.cyl(M.metal, 0.14, 0.14, -0.08, 0.1, linC(0.5, 0.5, 0.55), { axis: 'y', segs: 10 });
    rotor = Rk.build();
    rotor.matrixAutoUpdate = true;
    rotor.position.set(0, y, Z(r.cx));
    body.add(rotor);
    const mast = new Kit();
    mast.cyl(M.metal, 0.07, 0.07, Y(spec.y1) - 0.1, y, linC(0.4, 0.4, 0.45), { axis: 'y', segs: 8 });
    const mg = mast.build();
    mg.position.set(0, 0, Z(r.cx));
    mg.updateMatrix();
    body.add(mg);
  }
  // the propeller: on its nose, turning about the way it goes
  let prop = null;
  if (spec.props.length) {
    const p = spec.props[0];
    const R = clamp(p.h / 2, 0.35, 1.6);
    const Pk = new Kit();
    Pk.box(M.matte, -0.07, -R, -0.03, 0.07, R, 0.03, linC(0.07, 0.06, 0.1));
    Pk.cyl(M.metal, 0.12, 0.05, -0.05, 0.2, linC(0.6, 0.6, 0.65), { segs: 10 });
    prop = Pk.build();
    prop.matrixAutoUpdate = true;
    prop.position.set(0, Y(p.cy), Z(Math.max(p.x1, spec.x1)) + 0.08);
    body.add(prop);
  }
  // where the rider sits: on its top, about its middle (out of it from the chest up) - on a
  // skateboard standing on its deck, arms out; in a balloon's basket standing, hands on its rim
  const top = Y(spec.y1);
  const seatY = Math.max(Y(spec.y0) + 0.5, top - 0.55);
  const seatZ = clamp(-spec.L * 0.08, -1.2, 0);
  const halfWid = Math.max(W / 2 + 0.3, (parts.span || 0) / 2);
  let pose = 'pilot';
  let deck = 0;
  let bar = [0, seatY + 0.95, seatZ + 0.55];
  let grip = 0.22;
  if (spec.kind === 'skate') {
    pose = 'stand';
    deck = top;
    bar = [0, top + 1.0, 0.05];
    grip = 0.5;
  } else if (spec.base === 'balloon') {
    pose = 'stand';
    deck = Y(spec.y0) + 0.1;
    bar = [0, top + 0.02, Z(spec.x1) - 0.18];
    grip = clamp(W * 0.3, 0.2, 0.4);
  }
  // (a balloon's burner: its flame, on while it heats - game/hybrid.js)
  let flame = null;
  if (env) {
    const F = new Kit();
    F.add(M.glow, new THREE.ConeGeometry(0.2, 0.9, 10).translate(0, 0.45, 0), linC(1.0, 0.62, 0.2));
    F.add(M.glow, new THREE.ConeGeometry(0.1, 0.55, 8).translate(0, 0.3, 0), linC(1.0, 0.92, 0.55));
    flame = F.build();
    flame.matrixAutoUpdate = true;
    flame.position.set(0, env.y0 - 0.15, env.axis);
    flame.scale.setScalar(0.01);
    body.add(flame);
  }
  return {
    body,
    wheels: parts.wheels,
    prop: prop || new THREE.Object3D(),
    rotor: rotor || new THREE.Object3D(),
    tailRotor: new THREE.Object3D(),
    turret,
    muzzle,
    flame,
    jetsAt: parts.jetsAt,
    pose,
    deck,
    seatAt: [0, seatY + 0.5, seatZ],
    bar,
    grip,
    halfLen: Math.max(0.8, spec.L / 2),
    halfWid,
    heightM: Math.max(1.2, top + 0.6),
    radius: clamp(spec.L * 0.42, 0.9, 3.2),
    circles: [-spec.L * 0.3, 0, spec.L * 0.3],
    circleR: clamp(W / 2, 0.5, 1.1),
    span: parts.span || W,
  };
}

// ------------------------------------------------------------------ into the city
// a drawn vehicle at (x, z), facing yaw: one of the city's kinds, with the drawing's model and
// handling (null: it is no vehicle). design.strokes: [{ pts, type, col, pencil, neon }]
export function spawnDrawn(game, design, x, z, yaw, add = true, alt = 0) {
  // (ROADMAP 11.10: made of parts - what it does their sum, each made properly: game/partsum.js,
  // game/partbuild.js)
  const spec = design.polish ? rideSpec(design) : specOf(design);
  if (!spec.ok) return null;
  const V = game.vehicles;
  const v = V.create(spec.base === 'car' ? 'bike' : spec.base, 'good', 90);
  // (its own model instead of the kind's)
  v.group.remove(v.body);
  v.body.traverse((m) => m.geometry && m.geometry.dispose());
  const m = design.polish ? buildPolished(design, spec) : buildModel(design, spec);
  Object.assign(v, m);
  v.group.add(v.body);
  v.model = 'drawn';
  v.drawn = {
    strokes: design.strokes.map((s) => ({ type: s.type, pts: s.pts.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]), col: s.col ? s.col.slice() : null, pencil: !!s.pencil, neon: !!s.neon, slim: !!s.slim, span: s.span || undefined, hull: s.hull || undefined, part: s.part || undefined, r: s.r || undefined, len: s.len || undefined, coils: s.coils || undefined, base: s.base || undefined, muz: s.muz || undefined, edge: s.edge || undefined, made: s.made || undefined, side: s.side || undefined })),
    polish: design.polish || undefined,
    plane: design.plane || undefined,
    above: design.above || undefined,
    color: design.color.slice(),
    force: design.force || null,
    name: design.name || null,
    // (ROADMAP 11.8: what the network called it, and what else it does)
    group: design.group || null,
    cls: design.cls || null,
    abil: design.abil || null,
  };
  v.spec = spec;
  v.seat = true;
  v.label = design.name || spec.label;
  v.maxHp = spec.hp;
  v.hp = spec.hp;
  v.leanK = 0.25;
  // (a cannon: it fires as the tank does, its turret after where you look - game/vehicles.js)
  v.muzzleLocal = m.muzzle;
  // (ROADMAP 11.10: every barrel drawn on it fires, each as it was drawn - game/partsum.js gunOf)
  if (m.turrets && m.turrets.length) {
    v.turrets = m.turrets.map((t, i) => Object.assign(t, { gun: spec.guns[i] || { type: t.type, reload: 0.12, dmg: 12, speed: 88, spread: 0.035, life: 2.5, blast: 6 }, yaw: t.yaw0, cool: 0.2 + i * 0.07 }));
  } else v.turrets = null;
  v.ram = spec.ram || null;
  v.stallV = spec.stallV || 0;
  v.takeoffV = spec.takeoffV || 0;
  v.turretYaw = 0;
  v.reload = 0;
  v.q = Object.assign({}, v.q, { reload: 1 });
  if (spec.handling) {
    v.handling = spec.handling;
    v.glide = spec.glide;
  }
  if (spec.base !== 'car') Object.assign(v.q, spec.q);
  v.jets = spec.jets.length;
  // (a machine gun's paint: the colour the gun was drawn in)
  const gunS = design.strokes.find((s) => s.type === 'gun');
  if (gunS && gunS.col && !gunS.pencil) v.mgColor = gunS.col.slice();
  // (a big boat, a balloon: the camera further back)
  v.camOpt = spec.base === 'balloon' ? { dist: 19, height: 5.5, shoulder: 0, fovMul: 1 } : { dist: clamp(spec.L * 1.3 + 3.2, 5.5, spec.base === 'boat' ? 26 : 14), height: clamp(spec.H + 1.4, 2.3, 5), shoulder: 0, fovMul: 1 };
  // (ROADMAP 11.8: how it goes each of its ways, its gear and its gun - game/hybrid.js - and the
  // way it starts where it stands)
  setupDrawn(v, spec);
  v.pos.set(x, 0, z);
  v.yaw = yaw;
  startMode(v, alt);
  v.reveal = 0;
  if (add) V.add(v);
  return v;
}

// the rider's view of it while it goes: the jets' flames when it boosts (ui/freedraw.js update)
export function jetFlames(game, v, dt) {
  if (!v.jetsAt || !v.jetsAt.length || !(v.boosting || (v.kind === 'plane' && (v.thr || 0) > 0.6))) return;
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  for (const j of v.jetsAt) {
    if (Math.random() > dt * 40) continue;
    const x = v.pos.x + fz * j[0] + fx * j[2];
    const z = v.pos.z - fx * j[0] + fz * j[2];
    game.fx.sparks(x, v.pos.y + j[1], z, 2, [1.0, 0.6, 0.2]);
  }
}
