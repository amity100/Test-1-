import { onPlane, readDrawing } from './fusedraw.js';
import { clamp, damp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { parGone } from './drawlock.js';

// (ROADMAP 15.3) Parts you choose and then draw onto your car - and the drawing decides what they are.
//
// The part is said first (wings, a turbo, a rotor, a propeller, off-road wheels, armour), so nothing
// is guessed: the drawing is read for what matters - how big it is in metres, where on the car it is,
// which way it points (game/fusedraw.js: each point of the line a ray into the car's own frame). The
// model is the game's own, made at that size and put there (game/fusemodel.js), never a scribble
// blown up. What it does comes of those numbers, and parts add up: lift from wings is speed's, lift
// from a rotor its size's, a turbo pushes the way its flame does not go - wings and a turbo fly far,
// a rotor and wings take off on the spot and then go fast, armour weighs everything down.

export const PAR_ORDER = ['wing', 'jet', 'rotor', 'prop', 'wheel', 'armor'];
export const PAR = {
  wing: {
    name: 'כנפיים',
    how: 'קו מצד המכונית החוצה: האורך שלו — גודל הכנף, המקום לאורך המכונית — איפה היא',
    icon: '<path d="M2 15 L10 11 L14 11 L22 15 L14 13 L10 13 Z"/>',
  },
  jet: {
    name: 'טורבו',
    how: 'קו מהמכונית לאן שהלהבה יוצאת: אחורה — מהירות, למטה — קפיצה וריחוף, הצידה — החלקה, קדימה — בלם',
    icon: '<path d="M4 12 h9 l5 -3 v6 l-5 -3"/><path d="M18 12 h4"/>',
  },
  rotor: {
    name: 'רוטור',
    how: 'קו מעל הגג: ככל שהוא ארוך יותר — מרים יותר. מעל החרטום — נוטה ומושך קדימה',
    icon: '<path d="M3 7 h18"/><path d="M12 7 v6"/><rect x="7" y="13" width="10" height="6" rx="2"/>',
  },
  prop: {
    name: 'מדחף',
    how: 'קו מהמכונית לאן שהרוח נדחפת: דוחף לאט וכל הזמן, גם באוויר',
    icon: '<path d="M12 12 L12 4 M12 12 L19 16 M12 12 L5 16"/><circle cx="12" cy="12" r="2"/>',
  },
  wheel: {
    name: 'גלגלי שטח',
    how: 'עיגול סביב גלגל: כמה שהוא גדול — כך הגלגלים. גדולים עולים על מדרגות ומועכים',
    icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  },
  armor: {
    name: 'שריון',
    how: 'קו לאורך הצד, החזית או הגג: כמה שהוא מכסה — כך הוא מגן, וכבד',
    icon: '<path d="M4 6 L12 3 L20 6 V12 C20 17 12 21 12 21 C12 21 4 17 4 12 Z"/>',
  },
};

// (ROADMAP 15.4) and from the car's pen, on the road: a ramp ahead, a bridge, a barrier behind
export const WORLD_PAR = ['ramp', 'bridge', 'barrier'];
export const WORLD_NAME = { ramp: 'רמפה', bridge: 'גשר', barrier: 'מחסום' };
export const WORLD_ICON = {
  ramp: '<path d="M3 19 L19 9 L21 10 L21 19 Z"/>',
  bridge: '<path d="M2 12 H22"/><path d="M4 12 V18 M20 12 V18"/><path d="M2 8 H22"/>',
  barrier: '<rect x="3" y="8" width="18" height="5"/><path d="M6 13 V19 M18 13 V19 M9 8 L12 13 M15 8 L18 13"/>',
};

// (ROADMAP 15.5) in the story (not the sandbox): a drawn part is open once its thing of the car's pen
// is (game/gearplay.js - blueprint pages at the corners, an escape from the police...): the turbo and
// the armour from the start, the wings, the wheels, the rotor as the city opens up
export const PAR_GATE = { wing: 'wing', jet: 'turbo', rotor: 'rotor', prop: 'water', wheel: 'monster', armor: 'armor' };
export function parOpen(game, type) {
  // (round 15, game/drawlock.js: the wings, the rotor, the propeller gone from the story - the jump's
  // own rotor apart)
  if (parGone(game, type)) return false;
  if (type === 'rotor' && game.prologue && game.prologue.drawingRotor) return true;
  const play = game.gear && game.gear.play;
  if (!play || !PAR_GATE[type]) return true;
  return play.isOpen(PAR_GATE[type]);
}

// km/h, as the speedometer says it
export const kmh = (ms) => Math.round(ms * 3.6);

// the strokes drawn on the car (game/fuse.js capture: each point a ray in the car's frame) as the part
// said - { type, v, n, at, dir, par: true, ... } - or { why } (what was drawn cannot be that, said)
export function readPar(type, caps, ctx, inkI, time) {
  const D = ctx.D;
  const K = ctx.K;
  const roof = K ? K.roofY : D.h;
  const all = [];
  for (const c of caps) for (const q of c.pts) all.push(q);
  if (all.length < 2) return null;
  const base = { par: true, ink: inkI, t0: time, cost: 0, id: Math.random().toString(36).slice(2, 8) };
  const sane = (X) => X && Math.abs(X[0]) < 14 && X[1] > -1 && X[1] < 12 && Math.abs(X[2]) < 14;
  if (type === 'wing') {
    // on the level of its waist: how far out past its side it goes - each side gets one as long - and
    // where along it
    const y = K ? K.clear + (roof - K.clear) * 0.45 : D.h * 0.48;
    const X = all.map((q) => onPlane(q, 'y', y) || (q.k ? q.k.p : null)).filter(sane);
    if (X.length < 2) return null;
    let out = 0;
    let z0 = Infinity;
    let z1 = -Infinity;
    let zs = 0;
    let n = 0;
    for (const p of X) {
      const o = Math.abs(p[0]) - D.hw;
      out = Math.max(out, o);
      if (o > -D.hw * 0.35) {
        z0 = Math.min(z0, p[2]);
        z1 = Math.max(z1, p[2]);
        zs += p[2];
        n++;
      }
    }
    if (out < 0.25) return { why: 'כנף מציירים מהצד של המכונית החוצה — ככל שהקו ארוך, הכנף גדולה' };
    const span = clamp(out, 0.4, 5.5);
    const chord = clamp(Math.max(z1 - z0, span * 0.3), 0.4, 2.2);
    const zc = n ? zs / n : 0;
    return { ...base, type: 'wing', v: 'wing', n: { span: r2(span), chord: r2(chord), area: r2(2 * span * chord) }, at: [0, r2(y), r2(clamp(zc, -D.hl * 0.85, D.hl * 0.85))], dir: null };
  }
  if (type === 'rotor') {
    // a little over its roof: where its middle is, and how far it reaches either way
    const y = roof + 0.3;
    const X = all.map((q) => onPlane(q, 'y', y) || (q.k ? q.k.p : null)).filter(sane);
    if (X.length < 2) return null;
    let cx = 0;
    let cz = 0;
    for (const p of X) {
      cx += p[0];
      cz += p[2];
    }
    cx /= X.length;
    cz /= X.length;
    let rr = 0;
    for (const p of X) rr = Math.max(rr, Math.hypot(p[0] - cx, p[2] - cz));
    const span = clamp(rr * 2, 1, 9);
    return { ...base, type: 'rotor', v: 'top', n: { span: r2(span) }, at: [r2(clamp(cx, -D.hw * 0.5, D.hw * 0.5)), r2(roof), r2(clamp(cz, -D.hl * 0.7, D.hl * 0.7))], dir: null };
  }
  if (type === 'jet' || type === 'prop') {
    // where it meets the car, and which way from there it goes: its flame's way (a propeller: its wind's)
    const r = readDrawing(caps, ctx, 'jet');
    if (!r || r.kind !== 'part') return null;
    let d = r.dir;
    if (!d) d = r.face === 'front' ? [0, 0, 1] : r.face === 'bottom' ? [0, -1, 0] : r.face === 'top' ? [0, 1, 0] : r.face === 'side' ? [Math.sign(r.at[0]) || 1, 0, 0] : [0, 0, -1];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    d = d.map((x) => r2(x / l));
    const len = clamp(r.n.len || 1, 0.4, 3);
    return { ...base, type, v: dirName(d), n: { len: r2(len), size: r2(len) }, at: r.at, dir: d };
  }
  if (type === 'wheel') {
    // round about a wheel: as big as it is drawn (the real ones bigger still - its middle under it)
    const r = readDrawing(caps, ctx, 'wheel');
    if (!r || r.kind !== 'part') return null;
    const r0 = ctx.r0 || 0.34;
    const rr = clamp(r.n.r || r0, r0, r0 * 2.6);
    return { ...base, type: 'wheel', v: rr >= r0 * 1.35 ? 'bigteeth' : 'teeth', n: { r: r2(rr), bumps: 12 }, at: r.at, dir: null };
  }
  if (type === 'armor') {
    // along a face of it: which, and how much of that face
    const r = readDrawing(caps, ctx, 'blade');
    if (!r || r.kind !== 'part') return null;
    const face = r.face === 'bottom' ? 'side' : r.face;
    const L = r.n.long || 1;
    const along = face === 'side' ? 2 * D.hl : face === 'top' ? 2 * D.hl * 0.7 : 2 * D.hw;
    const cover = clamp(L / along, 0.2, 1);
    return { ...base, type: 'armor', v: face, n: { cover: r2(cover), face }, at: r.at, dir: null };
  }
  return null;
}

const r2 = (x) => Math.round(x * 100) / 100;

// which way a jet's flame (a propeller's wind) goes, in a word
function dirName(d) {
  const [x, y, z] = d;
  const a = [Math.abs(x), Math.abs(y), Math.abs(z)];
  if (a[2] >= a[0] && a[2] >= a[1]) return z < 0 ? 'back' : 'front';
  if (a[1] >= a[0]) return y < 0 ? 'under' : 'up';
  return 'side';
}

// (game/fuse.js applyVeh) a drawn part's say over how it drives and flies - H its handling, fz its
// parts' state, D its size. Wheels go the way any drawn wheel does (its v and its r are as drawn)
export function applyPar(v, p, H, fz, D) {
  const n = p.n;
  fz.par = true;
  fz.cols = fz.cols || [];
  if (p.type === 'wing') {
    const area = 2 * n.span * n.chord;
    fz.wingA = (fz.wingA || 0) + area;
    fz.wingSpan = Math.max(fz.wingSpan || 0, n.span);
    v.glide = Math.max(v.glide || 0, clamp(0.3 + area * 0.06, 0.35, 0.88));
    fz.airCtl = Math.max(fz.airCtl || 0, 0.6);
    // (over its nose they lift it into a climb more readily; over its tail it is steadier)
    fz.climb = 1 + 0.35 * clamp(p.at[2] / D.hl, -1, 1);
    // (wide wings: slower round a corner - and their tips catch walls, lamp posts, a narrow street)
    H.steer *= 1 - clamp(n.span - 1.6, 0, 4) * 0.05;
    H.mass = (H.mass || 1.25) + area * 0.015;
    if (n.span > 0.7) for (const s of [1, -1]) fz.cols.push({ a: p.at[2], b: s * (D.hw + n.span * 0.88), r: 0.32 });
  } else if (p.type === 'rotor') {
    fz.rotorSpan = Math.max(fz.rotorSpan || 0, n.span);
    // (lift: as the disc it sweeps - a little one only slows its fall; about its own length lifts it)
    fz.rotorRaw = (fz.rotorRaw || 0) + (n.span / 4.2) ** 2 * 1.25;
    // (off its middle it leans: over the nose it pulls forward, over the tail it holds back)
    fz.rotorTilt = clamp(p.at[2] / (D.hl * 0.6), -1, 1);
    fz.airCtl = Math.max(fz.airCtl || 0, 1);
    H.mass = (H.mass || 1.25) + 0.08;
    H.top *= 0.97;
    // (a disc wider than the car: it catches what is beside it)
    if (n.span > D.hw * 2 + 0.3) fz.cols.push({ a: p.at[2], b: 0, r: n.span * 0.45 });
  } else if (p.type === 'jet' || p.type === 'prop') {
    const d = p.dir || [0, 0, -1];
    // (the push: the other way from its flame, its wind - as strong as it is long)
    if (p.type === 'jet') {
      const T = clamp(6 + n.len * 4.5, 7, 19);
      const back = Math.max(0, -d[2]);
      const down = Math.max(0, -d[1]);
      const front = Math.max(0, d[2]);
      if (back > 0.35) {
        v.jets = Math.max(1, v.jets || 0);
        fz.jetK = Math.max(fz.jetK || 1, clamp(0.8 + n.len * 0.35, 0.9, 1.9) * back + (1 - back));
        fz.thrust = (fz.thrust || 0) + T * back;
      }
      if (down > 0.35) fz.vtol = { power: ((fz.vtol && fz.vtol.power) || 0) + T * down * 0.95, fuel: 2.6, max: 2.6 };
      if (front > 0.35) fz.retro = (fz.retro || 0) + T * front;
      if (Math.abs(d[0]) > 0.35) fz.side = (fz.side || 0) - T * d[0];
      fz.jetFuelMax = (fz.jetFuelMax || 0) + 2.5 + n.len * 1.2;
    } else {
      // (a propeller: no fuel, gentle, pushing all the while you drive on)
      const P = clamp(2.2 + n.len * 2.4, 2.5, 8);
      fz.prop = fz.prop || [0, 0, 0];
      fz.prop[0] -= d[0] * P;
      fz.prop[1] -= d[1] * P;
      fz.prop[2] -= d[2] * P;
    }
    H.mass = (H.mass || 1.25) + 0.04;
  } else if (p.type === 'armor') {
    const c = clamp(n.cover || 0.4, 0.15, 1);
    v.armor = Math.max(v.armor || 0, clamp(0.2 + c * 0.55, 0.2, 0.72));
    H.top *= 1 - 0.09 * c;
    H.power *= 1 - 0.16 * c;
    H.mass = (H.mass || 1.25) * (1 + 0.38 * c);
    // (over its nose: a ram - through barriers, police cars out of the way)
    if (n.face === 'front') v.ram = { k: 1.8 + c * 1.4, shield: true };
    fz.armorFace = n.face;
  }
}

// (game/fuse.js applyVeh, after them all) what they make of each other: the lift for its weight now
// that every part's weight is in, how fast its wings need it to go, and the names of what they make
export function finishPar(v, H, fz) {
  if (!fz.par) return;
  const m = H.mass || 1.25;
  if (fz.rotorRaw) fz.rotor = clamp(fz.rotorRaw / (m / 1.25), 0.05, 3.2);
  if (fz.wingA) {
    // (big wings off at about 60 km/h, middling ones about 100 - small ones need a turbo, a ramp)
    fz.takeoff = Math.sqrt((m * 1500) / fz.wingA);
    // (fast enough to on the ground - with a turbo, faster; or off a ramp, a roof)
    fz.wingFly = fz.takeoff <= H.top * 0.92 * (v.jets ? 1 + 0.4 * (fz.jetK || 1) : 1);
  }
  if (fz.jetFuelMax) fz.jetFuel = fz.jetFuelMax;
  const C = fz.combos;
  if (fz.wingA && fz.thrust) C.push('plane');
  if (fz.wingA && fz.rotor >= 0.6) C.push('vtol');
  if (fz.rotor >= 1 && fz.thrust) C.push('jetcopter');
  if (v.armor >= 0.4 && fz.wheels && fz.wheels.r > 0.5) C.push('breaker');
  if (fz.vtol && fz.wingA) C.push('harrier');
  // (the car's own combinations, game/fuse.js, may have said one already)
  fz.combos = [...new Set(C)];
}

// what it does now, in a few words (the tag by the car once it is on)
export function parSay(p, v) {
  const fz = v.fz || {};
  const n = p.n;
  const parts = [];
  if (p.type === 'wing') {
    parts.push(`${n.span.toFixed(1)} מ' לכל צד`);
    if (fz.wingFly) parts.push(`ממריאה ב־${kmh(fz.takeoff)} קמ"ש (רווח)`);
    else parts.push(`דאייה — להמראה צריך ${kmh(fz.takeoff)} קמ"ש: טורבו, רמפה או כנפיים גדולות יותר`);
    if (n.span > 2.2) parts.push('רחבות: נתקעות בסמטאות');
  } else if (p.type === 'rotor') {
    parts.push(`${n.span.toFixed(1)} מ'`);
    if (fz.rotor >= 1) parts.push(fz.rotor >= 1.6 ? 'מרים בקלות (רווח למעלה, C למטה)' : 'מרחף (רווח למעלה, C למטה)');
    else parts.push(`קטן מדי להרים (${Math.round(fz.rotor * 100)}%) — רק מאט נפילה. ציירו ארוך יותר`);
    if (fz.rotorTilt > 0.35) parts.push('מעל החרטום: מושך קדימה');
    else if (fz.rotorTilt < -0.35) parts.push('מעל הזנב: יציב ואיטי');
  } else if (p.type === 'jet') {
    const w = { back: 'אחורה — Shift: מהירות', under: 'למטה — רווח: קפיצה וריחוף קצר', up: 'למעלה — לוחץ את המכונית לכביש', side: 'הצידה — Shift: החלקה לצד', front: 'קדימה — בלימה חזקה (S עם Shift)' };
    parts.push(w[p.v] || w.back);
    parts.push(`דלק ${Math.round(fz.jetFuelMax || 0)} שנ', מתמלא על הקרקע`);
  } else if (p.type === 'prop') {
    const w = { back: 'דוחף קדימה לאט, כל הזמן', front: 'מושך אחורה — מאט', under: 'דוחף למעלה — מאט נפילה', up: 'דוחף למטה', side: 'דוחף הצידה' };
    parts.push(w[p.v] || w.back);
  } else if (p.type === 'wheel') {
    parts.push(`${(n.r * 2).toFixed(1)} מ'`);
    if (p.v === 'bigteeth') parts.push(`עולים על מדרגות של ${(fz.step || 0).toFixed(1)} מ' ומועכים מכוניות`);
    else parts.push('אחיזה בשטח ובמדרגות נמוכות');
  } else if (p.type === 'armor') {
    parts.push(`${Math.round(n.cover * 100)}% מה${n.face === 'front' ? 'חזית' : n.face === 'back' ? 'גב' : n.face === 'top' ? 'גג' : 'צד'}`);
    parts.push(`${Math.round((v.armor || 0) * 100)}% פחות נזק`);
    if (n.face === 'front') parts.push('איל: פורץ מחסומים');
    parts.push('כבד — מאיץ ועף פחות');
  }
  const C = fz.combos || [];
  const combo = C.includes('vtol') ? 'רוטור + כנפיים: ממריאה במקום וטסה מהר' : C.includes('plane') ? 'כנפיים + טורבו: טיסה ארוכה' : C.includes('jetcopter') ? 'רוטור + טורבו: מסוק מהיר' : C.includes('breaker') ? 'שריון + גלגלי שטח: פורץ מחסומים' : C.includes('harrier') ? 'כנפיים + טורבו למטה: קפיצה ודאייה' : '';
  return { name: PAR[p.type].name, text: parts.join(' · '), combo };
}

// (game/fuse.js preDrive) on the ground: its jets' fuel back, their pushes that are not forward (a
// side jet slides it, a front one brakes), a propeller's push, and off - on the lift its parts give it
// together at this speed
export function preDrivePar(F, v, dt, input) {
  const fz = v.fz;
  const g = F.game;
  const up = !!input && (input.keys.has('Space') || input.flyUp);
  const boost = !!input && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || input.boost || (input.pad && input.pad.sprint));
  const mv = input ? input.readMove() : { x: 0, y: 0 };
  if (fz.jetFuelMax) {
    if (!v.air) fz.jetFuel = Math.min(fz.jetFuelMax, fz.jetFuel + dt * 0.55);
    if (boost && (fz.thrust || fz.side || fz.retro) && fz.jetFuel > 0) {
      fz.jetFuel = Math.max(0, fz.jetFuel - dt);
      if (fz.jetFuel <= 0 && v.driver === g.player) F.say('הטורבו ריק — מתמלא כשנוסעים על הקרקע', 'info');
    }
    // (an empty one does not push - on the ground either)
    if (fz.thrust) v.jets = fz.jetFuel > 0.05 ? Math.max(1, v.fzBase ? v.fzBase.jets || 1 : 1) : (v.fzBase && v.fzBase.jets) || 0;
  }
  const hx = Math.sin(v.yaw);
  const hz = Math.cos(v.yaw);
  if (!v.air) {
    const fuel = !fz.jetFuelMax || fz.jetFuel > 0;
    if (boost && fuel && fz.side) {
      v.vx += hz * fz.side * dt;
      v.vz += -hx * fz.side * dt;
    }
    if (boost && fuel && fz.retro && mv.y < 0) {
      const fwd = v.vx * hx + v.vz * hz;
      const k = Math.min(Math.abs(fwd), fz.retro * dt) * Math.sign(fwd);
      v.vx -= hx * k;
      v.vz -= hz * k;
    }
    if (fz.prop && mv.y > 0) {
      const P = fz.prop;
      v.vx += (P[0] * hz + P[2] * hx) * dt * 0.6;
      v.vz += (-P[0] * hx + P[2] * hz) * dt * 0.6;
    }
    // off the ground on what its parts give it together at this speed: a rotor and wings both
    const sp = Math.max(0, v.speed || 0);
    const Lw = fz.wingA ? (sp / fz.takeoff) ** 2 : 0;
    const L = (fz.rotor || 0) + Lw + (fz.balloon || 0) + Math.max(0, (fz.prop ? fz.prop[1] : 0) / 20);
    if (up && !v.flipped && L >= 1 && !(fz.rotor >= 1 || fz.balloon >= 1)) {
      v.air = true;
      v.vy = 3;
      g.audio.play('whoosh', 0.5);
    }
  }
}

// (game/fuse.js air) in the air: every part's lift added up - wings' with its speed, a rotor's, the
// jets under it while ▲ is held and they have fuel, a balloon's, a propeller pushing up - and every
// push along its own way. Held up (all of it at least its weight): ▲ climbs as fast as the spare lets
// it, C comes down, else it holds its height. Not enough: it comes down, the slower the more there is.
// Mostly on its wings: it flies like a plane, banking round, its engine its speed; else it steers like
// a helicopter. Returns how much of the fall's pull is left
export function airPar(F, v, dt, input) {
  const fz = v.fz;
  const up = !!input && (input.keys.has('Space') || input.flyUp);
  const down = !!input && (input.keys.has('KeyC') || input.flyDown);
  const mv = input ? input.readMove() : { x: 0, y: 0 };
  const boost = !!input && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || input.boost || (input.pad && input.pad.sprint));
  const H = v.handling || {};
  const gy = groundHeight(v.pos.x, v.pos.z);
  const ceil = gy + (fz.ceil || 90);
  const hx = Math.sin(v.yaw);
  const hz = Math.cos(v.yaw);
  const fwd = v.vx * hx + v.vz * hz;
  const sp = Math.hypot(v.vx, v.vz);
  const fuel = !fz.jetFuelMax || fz.jetFuel > 0;
  const firing = boost && fuel && !!(fz.thrust || fz.side || fz.retro);
  if (firing && fz.jetFuelMax) fz.jetFuel = Math.max(0, fz.jetFuel - dt);
  // the lift of each, a share of its weight
  const Lw = fz.wingA ? Math.min(2.4, (Math.max(0, fwd) / fz.takeoff) ** 2) : 0;
  const Lr = fz.rotor || 0;
  let Lj = 0;
  if (fz.vtol && up && fz.vtol.fuel > 0) {
    fz.vtol.fuel -= dt;
    Lj = (fz.vtol.power / 20) * 1.25;
    v.fzThrust = 1;
  }
  const Lp = fz.prop ? Math.max(0, fz.prop[1]) / 20 : 0;
  const Lb = fz.balloon || 0;
  const L = Lw + Lr + Lj + Lp + Lb;
  let pull = 1;
  let lifting = false;
  if (L >= 1) {
    lifting = true;
    pull = 0;
    const spare = Math.min(2, L - 1);
    const climb = (2.6 + spare * 3.2) * (Lw > Lr ? fz.climb || 1 : 1);
    const want = v.pos.y > ceil ? -2 : up ? climb : down ? -5 : 0;
    v.vy = damp(v.vy, want, 2.4, dt);
  } else {
    pull = Math.max(0.1, 1 - L * 0.9);
    if (Lj > 0) v.vy = Math.min(v.vy + fz.vtol.power * dt * 1.4, 9);
  }
  // the pushes: jets with Shift while they have fuel; a propeller while you drive on
  if (firing) {
    const T = fz.thrust || 0;
    const S = fz.side || 0;
    v.vx += (hx * T + hz * S) * dt;
    v.vz += (hz * T - hx * S) * dt;
    if (fz.retro && mv.y < 0) {
      v.vx -= hx * fz.retro * dt;
      v.vz -= hz * fz.retro * dt;
    }
    v.fzThrust = 1;
  }
  if (fz.prop && (mv.y > 0 || up)) {
    const P = fz.prop;
    v.vx += (P[0] * hz + P[2] * hx) * dt;
    v.vz += (-P[0] * hx + P[2] * hz) * dt;
  }
  // (on its wings once they hold it up by themselves - fast enough: a rotor beside them only lifts
  // the more. Off the ground on a rotor, wings and a turbo: up on the spot, then away like a plane)
  const winged = Lw >= 1 || (Lw >= 0.5 && Lw >= Lr);
  if (winged && input) {
    // on its wings: a plane - its engine (W) holds its speed, S its air brakes; it goes where it points,
    // banking round
    let a = mv.y > 0 ? (H.power || 14) * 0.55 * mv.y : mv.y < 0 ? 10 * mv.y : -0.6;
    if (up && lifting) a -= 2;
    const cap = (H.top || 28) * (firing ? 1.7 : 1.15);
    const nsp = clamp(sp + a * dt, 0, Math.max(cap, sp - 3 * dt));
    const kx = sp > 0.1 ? v.vx / sp : hx;
    const kz = sp > 0.1 ? v.vz / sp : hz;
    const t = 1 - Math.exp(-3 * dt);
    const dx = kx + (hx - kx) * t;
    const dz = kz + (hz - kz) * t;
    const dl = Math.hypot(dx, dz) || 1;
    v.vx = (dx / dl) * nsp;
    v.vz = (dz / dl) * nsp;
    v.yawRate = damp(v.yawRate, -mv.x * 1.3, 3, dt);
  } else if (input) {
    // a helicopter's way (or falling): it turns on the spot, W/S push it along
    const ctl = fz.airCtl || 0.3;
    v.yawRate = damp(v.yawRate, -mv.x * 1.5 * ctl, 3, dt);
    const A = lifting ? (Lr >= 1 ? 8 : 4) : 2.2;
    v.vx += hx * mv.y * A * ctl * dt;
    v.vz += hz * mv.y * A * ctl * dt;
    // (a rotor off its middle leans: it goes the way it leans - forward, over the nose)
    if (lifting && Lr >= 1 && fz.rotorTilt) {
      v.vx += hx * fz.rotorTilt * 3.5 * dt;
      v.vz += hz * fz.rotorTilt * 3.5 * dt;
    }
    const cap = (Lr >= 1 ? 22 + 10 * Math.max(0, fz.rotorTilt || 0) : 32) * (firing ? 1.6 : 1);
    const s2 = Math.hypot(v.vx, v.vz);
    if (s2 > cap) {
      v.vx *= cap / s2;
      v.vz *= cap / s2;
    }
    // (holding still in the air on a rotor: it stops, over where it is to come down)
    if (lifting && Lr >= 1 && !mv.y) {
      v.vx *= Math.exp(-1.4 * dt);
      v.vz *= Math.exp(-1.4 * dt);
    }
  }
  v.fzWinged = winged;
  v.fzLifting = lifting;
  return pull;
}
