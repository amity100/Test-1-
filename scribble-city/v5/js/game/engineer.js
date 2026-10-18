import { clamp } from '../core/util.js';
import { shapeOf, spanAt } from './drawncar.js';
import { rideSpec } from './partsum.js';

// (ROADMAP 11.12) The engineer: what was drawn, made to work - its form by what it does, its look by
// the drawing. Three ways to have it (ui/freedraw.js, on the card):
//   - as drawn: as it is (and what that does, its warnings: a rotor not over its weight leans)
//   - tidy: its lines made clean - its outline smooth, its bottom straight; its wheels round, on one
//     line, alike two by two; its barrels, wings, rotors, propellers level (or upright) as they
//     nearly were
//   - engineered (as it starts): and each part where it works - its wheels on its body, spread to
//     carry its weight; its body down low between them when it would roll over; a rotor over its
//     weight, up on its mast, as big as it must be to lift it; wings under its weight, as big as
//     they must be to fly; its jets under it too; a barrel on its roof, a propeller in its nose's
//     middle, its jets on its tail's
// Never far from the drawing: each line moves a little of its size at most - the drawing is what it
// is. And never something else: each part still does what it did (a step that would make one
// something else is undone). Rule by rule, here and now, no guessing what was meant. Returns { design (a new one - the
// one given untouched), notes (what it did, said on the card), changes ([{ src (the line, or the
// body: -1), from, to }] - ui/freedraw.js turns the drawing into it, the page's lines into these) }
export const ENG_LEVELS = [
  ['raw', 'כמו שצויר'],
  ['tidy', 'מסודר'],
  ['eng', 'מהונדס'],
];

const ROLLS = new Set(['wheel', 'square', 'big']);

export function engineer(design, level = 'eng') {
  if (!design || level === 'raw' || (design.above && level !== 'eng')) return { design, notes: [], changes: [] };
  const D = Object.assign({}, design, { strokes: design.strokes.map((s) => copyStroke(s)) });
  const S = D.strokes;
  const drawn = new Map(S.map((s) => [s, copyStroke(s)]));
  let spec = rideSpec(D);
  const role = spec.role || new Map();
  const vOf = (s) => (role.has(s) ? role.get(s).v : null);
  const bodies = S.filter((s) => s.type === 'body');
  if (!bodies.length) return { design, notes: [], changes: [] };
  const main = bodies.reduce((a, s) => (!a || area(s.pts) > area(a.pts) ? s : a), null);
  const box = boxOf(bodies);
  const L = box.x1 - box.x0;
  const H = box.y1 - box.y0;
  const ground = S.some((s) => s.type === 'wheel') && !main.hull;
  // (a plane drawn from above: its side made by the game - only its wings and engines to place)
  const above = !!design.above;
  const wheels = S.filter((s) => s.type === 'wheel' && ROLLS.has(vOf(s))).map((s) => {
    const sh = shapeOf(s.pts);
    return { s, x: sh.mx, y: sh.my, r: (sh.w + sh.h) / 4, sq: vOf(s) === 'square' };
  });
  const notes = [];
  // (the rotors, the wings made bigger to fly)
  const grown = new Set();
  // (each note, and the lines it is about)
  const about = new Map();
  const say = (t, of) => {
    if (!notes.includes(t)) notes.push(t);
    about.set(t, new Set([...(about.get(t) || []), ...of]));
  };
  // Step by step, and each keeps what every part does: one that would make a part something else by
  // where it moves it (a propeller moved down under it - a hovercraft's fan; a wheel made bigger than
  // half its body - one that runs cars over) is undone, and the next goes on from before it
  const keeps = (sp) => S.every((s) => !vOf(s) || !sp.role || !sp.role.has(s) || sp.role.get(s).v === vOf(s));
  const step = (fn) => {
    const was = { pts: S.map((s) => s.pts), at: S.map((s) => copyStroke(s)), wh: wheels.map((w) => [w.x, w.y, w.r]), notes: notes.slice(), about: new Map([...about].map(([t, of]) => [t, new Set(of)])), spec };
    fn();
    if (S.every((s, i) => s.pts === was.pts[i])) return;
    const sp = rideSpec(D);
    if (keeps(sp)) {
      spec = sp;
      return;
    }
    S.forEach((s, i) => Object.assign(s, was.at[i]));
    wheels.forEach((w, i) => ([w.x, w.y, w.r] = was.wh[i]));
    notes.splice(0, notes.length, ...was.notes);
    about.clear();
    for (const [t, of] of was.about) about.set(t, of);
    spec = was.spec;
  };
  const wheelAt = (w) => (w.s.pts = w.sq ? square(w.x, w.y, w.r) : circle(w.x, w.y, w.r));
  // ---- tidy: its lines clean
  step(() => {
    if (!main.made || main.slim || above || main.pts.length <= 8) return;
    main.pts = smoothLoop(main.pts, 2);
    // (its bottom straight, a car's: along its lowest)
    if (ground) {
      const y0 = Math.min(...main.pts.map((p) => p[1]));
      for (const p of main.pts) if (p[1] < y0 + H * 0.12) p[1] = y0 + (p[1] - y0) * 0.3;
    }
    say('הקווים הוחלקו', [main]);
  });
  // its wheels round, on one line, alike
  step(() => {
    if (!wheels.length) return;
    const bottoms = wheels.map((w) => w.y - w.r).sort((a, b) => a - b);
    const mid = bottoms[Math.floor(bottoms.length / 2)];
    const lined = [];
    for (const w of wheels) {
      if (Math.abs(w.y - w.r - mid) > 1e-3 && Math.abs(w.y - w.r - mid) < w.r * 0.5) {
        w.y = mid + w.r;
        lined.push(w.s);
      }
    }
    const rs = wheels.map((w) => w.r);
    if (Math.max(...rs) / Math.min(...rs) < 1.18 && wheels.length > 1) {
      const r = rs.reduce((a, b) => a + b, 0) / rs.length;
      for (const w of wheels) {
        w.y += r - w.r;
        w.r = r;
      }
      say('הגלגלים הושוו', wheels.map((w) => w.s));
    } else {
      // (two by two: those at its back alike, those at its front)
      for (const half of [wheels.filter((w) => w.x < (box.x0 + box.x1) / 2), wheels.filter((w) => w.x >= (box.x0 + box.x1) / 2)]) {
        if (half.length < 2) continue;
        const hr = half.map((w) => w.r);
        if (Math.max(...hr) / Math.min(...hr) >= 1.3) continue;
        const r = hr.reduce((a, b) => a + b, 0) / hr.length;
        for (const w of half) {
          w.y += r - w.r;
          w.r = r;
        }
      }
    }
    for (const w of wheels) wheelAt(w);
    if (lined.length) say(lined.length > 1 ? `${lined.length} גלגלים יושרו על קו אחד` : 'גלגל יושר לקו של האחרים', lined);
  });
  // its barrels, wings, rotors level (a propeller upright) - as they nearly were
  for (const s of above ? [] : S) {
    step(() => {
      const t = s.part;
      const v = vOf(s);
      if (t === 'barrel' && !s.whole && s.base && s.muz) {
        const a = Math.atan2(s.muz[1] - s.base[1], s.muz[0] - s.base[0]);
        const to = snap(a, (8 * Math.PI) / 180);
        if (to !== a) {
          rotate(s, s.base, to - a);
          say('הקנה יושר', [s]);
        }
      } else if ((t === 'wing' && v === 'wing' && !s.span) || ((t === 'rotor' || t === 'prop') && v === 'lift')) {
        const a = axisOf(s.pts);
        const d = wrapHalf(-a);
        if (Math.abs(d) > 1e-3 && Math.abs(d) < (12 * Math.PI) / 180) {
          rotate(s, centre(s.pts), d);
          say(t === 'wing' ? 'הכנף יושרה' : 'הרוטור יושר', [s]);
        }
      } else if ((t === 'prop' || t === 'rotor') && (v === 'pusher' || v === 'puller')) {
        const a = axisOf(s.pts);
        const d = wrapHalf(Math.PI / 2 - a);
        if (Math.abs(d) > 1e-3 && Math.abs(d) < (15 * Math.PI) / 180) {
          rotate(s, centre(s.pts), d);
          say('המדחף הוזקף', [s]);
        }
      }
    });
  }
  if (level === 'eng') {
    // ---- its wheels on its body: not hanging under it, not lost in it (most of each out under it)
    step(() => {
      const up = [];
      const down = [];
      for (const w of above ? [] : wheels) {
        const sp = spanAt(main.pts, clamp(w.x, box.x0 + 1e-3, box.x1 - 1e-3));
        if (!sp) continue;
        const yb = sp[0];
        const y = clamp(w.y, yb - w.r * 0.55, yb + w.r * 0.15);
        if (Math.abs(y - w.y) > w.r * 0.12) {
          if (y > w.y) up.push(w.s);
          else down.push(w.s);
          w.y = w.y + clamp(y - w.y, -w.r * 0.8, w.r * 0.8);
          wheelAt(w);
        }
      }
      if (up.length) say(up.length > 1 ? 'הגלגלים חוברו לגוף' : 'גלגל חובר לגוף', up);
      if (down.length) say(down.length > 1 ? 'הגלגלים הורדו מתוך הגוף — שיהיה מרווח מהכביש' : 'גלגל הורד מתוך הגוף — שיהיה מרווח מהכביש', down);
    });
    // ---- spread to carry its weight: its weight between its wheels
    step(() => {
      if (!spec.ok || spec.balance === undefined || wheels.length < 2 || !spec.com) return;
      const xs = wheels.map((w) => w.x);
      const zr = Math.min(...xs);
      const zf = Math.max(...xs);
      const com = spec.com[0];
      const t = spec.balance;
      let end = null;
      let to = 0;
      if (t < 0.12) {
        end = wheels.filter((w) => w.x < zr + L * 0.15);
        to = (com - 0.2 * zf) / 0.8;
      } else if (t > 0.88) {
        end = wheels.filter((w) => w.x > zf - L * 0.15);
        to = zr + (com - zr) / 0.8;
      }
      if (!end || !end.length) return;
      const at = end.reduce((a, w) => a + w.x, 0) / end.length;
      const r = Math.max(...end.map((w) => w.r));
      const lim = t < 0.5 ? box.x0 + r * 0.7 : box.x1 - r * 0.7;
      const want = t < 0.5 ? Math.max(to, lim) : Math.min(to, lim);
      const dx = clamp(want - at, -L * 0.25, L * 0.25);
      if (Math.abs(dx) <= 0.02) return;
      for (const w of end) {
        w.x += dx;
        wheelAt(w);
      }
      say(t < 0.5 ? 'הגלגלים האחוריים הוזזו אחורה — שהמשקל יהיה ביניהם' : 'הגלגלים הקדמיים הוזזו קדימה — שהמשקל יהיה ביניהם', end.map((w) => w.s));
    });
    // ---- down low between its wheels, when it would roll over in a turn
    step(() => {
      if (!spec.ok || !spec.handling || !spec.handling.tipA || !wheels.length || !spec.ssf) return;
      const rAvg = wheels.reduce((a, w) => a + w.r, 0) / wheels.length;
      const hC = (clamp(0.55 + L * 0.24, 0.9, 2.3) / 2 + 0.08) / spec.ssf;
      const need = hC - (clamp(0.55 + L * 0.24, 0.9, 2.3) / 2 + 0.08) / 0.31;
      const d = Math.min(need, rAvg * 0.45);
      if (d <= 0.02) return;
      const wheelSet = new Set(wheels.map((w) => w.s));
      const low = S.filter((s) => !wheelSet.has(s) && vOf(s) !== 'track');
      for (const s of low) shift(s, 0, -d);
      say('הגוף הונמך בין הגלגלים — יציב יותר בפניות', low);
    });
    const top = (x) => {
      const sp = spanAt(main.pts, clamp(x, box.x0 + 1e-3, box.x1 - 1e-3));
      return sp ? sp[1] : box.y1;
    };
    const mid = (x) => {
      const sp = spanAt(main.pts, clamp(x, box.x0 + 1e-3, box.x1 - 1e-3));
      return sp ? (sp[0] + sp[1]) / 2 : (box.y0 + box.y1) / 2;
    };
    // ---- a rotor over its weight, up on its mast - as big as it must be to lift it
    const rotors = S.filter((s) => (s.part === 'rotor' || s.part === 'prop') && vOf(s) === 'lift');
    step(() => {
      if (!rotors.length || !spec.com) return;
      // (where they hold it up: the big one most - as game/partsum.js rideSpec has it)
      let c = 0;
      let cw = 0;
      for (const s of rotors) {
        const sh = shapeOf(s.pts);
        c += sh.cx * sh.w * sh.w;
        cw += sh.w * sh.w;
      }
      c /= Math.max(1e-9, cw);
      const dx = clamp(spec.com[0] - c, -L * 0.3, L * 0.3);
      if (Math.abs(dx) > L * 0.03) {
        for (const s of rotors) shift(s, dx, 0);
        say('הרוטור הוזז מעל מרכז הכובד', rotors);
      }
      // (each rotor - its blades drawn one by one, together - up on its mast)
      for (const g of rotorSets(rotors)) {
        const b = boxOf(g);
        const cx = (b.x0 + b.x1) / 2;
        const cy = (b.y0 + b.y1) / 2;
        const t = top(cx);
        const dy = cy < t + 0.25 ? t + 0.35 - cy : cy > t + 1.4 ? t + 0.7 - cy : 0;
        if (Math.abs(dy) > 0.05) {
          for (const s of g) shift(s, 0, dy);
          say('הרוטור הוצב על תורן', g);
        }
      }
    });
    // (too small to lift it: as big as it must be, all its blades round its hub - up to as wide as
    // the whole of it is long, as a real helicopter's is: most draw a rotor short)
    step(() => {
      if (above || !rotors.length || !spec.com) return;
      // (the rotor's own lift - not the card's, the most of all it has: its wings' may be more)
      const lift = liftOf(spec, 'R');
      if (lift === null || lift >= 1) return;
      const sets = rotorSets(rotors);
      const wMax = Math.max(...sets.map((g) => boxOf(g).x1 - boxOf(g).x0));
      // (its lift goes as the square of its radius - and one drawn very short lifts as a small
      // rotor does: game/partsum.js rideSpec)
      const R0 = Math.max(wMax * 0.575, 0.8);
      const f = Math.min((R0 * Math.sqrt(1.15 / Math.max(0.05, lift))) / Math.max(1e-6, wMax * 0.575), (Math.max(L, H) * 1.2) / Math.max(1e-6, wMax));
      if (f < 1.03) return;
      for (const g of sets) {
        const rb = boxOf(g);
        const hub = (rb.x0 + rb.x1) / 2;
        for (const s of g) {
          s.pts = s.pts.map(([x, y]) => [hub + (x - hub) * f, y]);
          if (s.len) s.len *= f;
          grown.add(s);
        }
      }
      say(f > 1.6 ? `הרוטור הוגדל פי ${f.toFixed(1)} — רוטור של מסוק אמיתי ארוך כמעט כמו המסוק כולו` : `הרוטור הוגדל ב־${Math.round((f - 1) * 100)}% — כדי שירים אותו`, rotors);
    });
    // (ROADMAP 11.13: a helicopter of one rotor, nothing to hold it straight - it turns round itself:
    // a small rotor at the end of its tail, as a real one has, a fifth of its rotor's size)
    if (design.copter && !design.drone && !design.rocket && spec.spin && rotors.length) {
      const tails = S.filter((s) => s.part === 'tail');
      const end = tails.length ? tails.flatMap((s) => s.pts).reduce((a, p) => (p[0] < a[0] ? p : a)) : [box.x0, mid(box.x0 + L * 0.05)];
      const wMax = Math.max(...rotorSets(rotors).map((g) => boxOf(g).x1 - boxOf(g).x0));
      const r = clamp(wMax * 0.09, 0.25, 0.7);
      const s = { type: 'prop', part: 'prop', pts: circle(end[0] - r * 0.2, end[1] + r * 0.5, r), col: main.col ? main.col.slice() : null, pencil: !!main.pencil, neon: false, made: true, implicit: true };
      S.push(s);
      drawn.set(s, copyStroke(s));
      const sp = rideSpec(D);
      if (sp.spin || !keeps(sp)) {
        S.pop();
        drawn.delete(s);
      } else {
        spec = sp;
        say('נוסף רוטור זנב — בלעדיו מסוק מסתובב סביב עצמו', [s]);
      }
    }
    // ---- jets under it, under its weight
    const vtols = S.filter((s) => s.part === 'jet' && vOf(s) === 'vtol');
    step(() => {
      if (!vtols.length || !spec.com) return;
      const c = vtols.reduce((a, s) => a + centre(s.pts)[0], 0) / vtols.length;
      const dx = clamp(spec.com[0] - c, -L * 0.3, L * 0.3);
      if (Math.abs(dx) <= L * 0.03) return;
      for (const s of vtols) shift(s, dx, 0);
      say('הסילונים הוזזו אל מתחת למרכז הכובד', vtols);
    });
    // (ROADMAP 11.13: too weak to lift it - a rocket's engine, a jump jet's: bigger, as much as it
    // must be - its thrust goes as its size, up to four times as big as drawn)
    for (let round = 0; round < 2; round++) {
      if (!vtols.length || !spec.sum || !spec.sum.warn.some((w) => w.startsWith('הסילונים שמתחת חלשים'))) break;
      const before = spec;
      step(() => {
        const lift = liftOf(spec, 'J');
        const f = clamp(1.15 / Math.max(0.2, lift === null ? 0.8 : Math.min(lift, 0.95)), 1.05, 2);
        for (const s of vtols) {
          const [cx] = centre(s.pts);
          const t = Math.max(...s.pts.map((p) => p[1]));
          // (from where it meets its body, out and down)
          s.pts = s.pts.map(([x, y]) => [cx + (x - cx) * f, t + (y - t) * f]);
          grown.add(s);
        }
        say('הסילונים הוגדלו — כדי שירימו אותו', vtols);
      });
      if (spec === before) break;
    }
    // ---- wings under its weight (its weight a little ahead of where they hold it) - as big as they
    // must be to fly
    const wings = S.filter((s) => s.part === 'wing' && vOf(s) === 'wing' && (above || !s.span));
    step(() => {
      if (!wings.length || !spec.com || !(spec.pitchy || (spec.modes && spec.modes.plane))) return;
      const fins = S.some((s) => s.part === 'fin' || (s.part === 'wing' && vOf(s) === 'fin'));
      let np = 0;
      let aw = 0;
      for (const s of wings) {
        const sh = shapeOf(s.pts);
        np += (sh.x1 - sh.w * (fins ? 0.45 : 0.3)) * sh.w;
        aw += sh.w;
      }
      np /= Math.max(1e-6, aw);
      const want = spec.com[0] + L * 0.03;
      const dx = clamp(want - np, -L * 0.25, L * 0.25);
      if (Math.abs(dx) <= L * 0.03 || !(spec.pitchy || want - np < -L * 0.2)) return;
      for (const s of wings) shift(s, dx, 0);
      say('הכנפיים הוזזו אל מרכז הכובד', wings);
    });
    // (too small to hold it up: as big as they must be - out longer, their shape as drawn (drawn edge
    // on: deeper) - up to a glider's)
    const wingsAll = S.filter((s) => s.part === 'wing' && vOf(s) === 'wing');
    // (ROADMAP 11.13: again, while it is still too heavy for them - a glider's wings at most, twice
    // as long as it is, near half as deep)
    for (let round = 0; round < 3; round++) {
      if (!wingsAll.length || !spec.sum || !spec.sum.warn.some((w) => w.startsWith('הכנפיים קטנות'))) break;
      const before = spec;
      step(() => {
        const lift = liftOf(spec, 'W');
        const f = clamp(1.12 / Math.max(0.1, lift === null ? 0.77 : lift), 1.05, 2.4);
        for (const s of wingsAll) {
          if (s.span) {
            // (out longer - and, as long as a wing can be, deeper too)
            const g = Math.max(1, Math.min(f, (L * (round ? 2 : 1.7)) / Math.max(1e-6, s.span)));
            const sh = shapeOf(s.pts);
            const c = Math.max(1, Math.min(f / g, (L * (round ? 0.45 : 0.4)) / Math.max(1e-6, sh.w)));
            s.span *= g;
            if (s.plan) s.plan = s.plan.map(([z, v]) => [sh.cx + (z - sh.cx) * c, v * g]);
            s.pts = s.pts.map(([x, y]) => [sh.cx + (x - sh.cx) * c, y]);
          } else stretch(s, Math.max(1, Math.min(f, (L * (round ? 0.55 : 0.45)) / Math.max(1e-6, shapeOf(s.pts).w))), 1);
          grown.add(s);
        }
        say(f > 1.5 || round ? 'הכנפיים הוארכו — כנף קטנה מדי לא מחזיקה מטוס באוויר' : 'הכנפיים הוגדלו — כדי שימריא', wingsAll);
      });
      // (no bigger they can be)
      if (spec === before) break;
    }
    // ---- a barrel on its roof, not over it in the air
    for (const s of S) {
      if (s.part !== 'barrel' || s.whole || !s.base) continue;
      step(() => {
        const t = top(s.base[0]);
        if (s.base[0] > box.x0 && s.base[0] < box.x1 && s.base[1] > t + 0.35) {
          shift(s, 0, Math.max(t + 0.12 - s.base[1], -0.9));
          say('הקנה הונח על הגג', [s]);
        }
      });
    }
    // ---- a propeller in its nose's middle, a jet on its tail's
    for (const s of S) {
      const v = vOf(s);
      const front = (s.part === 'prop' || s.part === 'rotor') && v === 'puller';
      const back = (s.part === 'prop' || s.part === 'rotor') && v === 'pusher';
      const jet = s.part === 'jet' && v === 'jet' && !s.side;
      if (!front && !back && !jet) continue;
      step(() => {
        const [cx, cy] = centre(s.pts);
        const x = front ? box.x1 - L * 0.04 : box.x0 + L * 0.04;
        // (on a tail, a boom, away from its body's end: where it is - its body's middle is not there)
        if (Math.abs(cx - x) >= L * 0.3) return;
        const dy = clamp(mid(x) - cy, -H * 0.4, H * 0.4);
        if (Math.abs(dy) > H * 0.05) {
          shift(s, 0, dy);
          say(jet ? 'הסילון מורכז על הזנב' : front ? 'המדחף מורכז על החרטום' : 'המדחף מורכז על הזנב', [s]);
        }
        if (!jet && Math.abs(cx - x) > L * 0.1) shift(s, x - cx, 0);
      });
    }
  }
  // ---- never far from the drawing: each line a little of its size at most (a rotor, a wing made
  // as big as it must be to fly: further)
  const cap0 = Math.max(L, H) * 0.32;
  for (const s of S) {
    const a = drawn.get(s);
    if (a.pts.length !== s.pts.length) continue;
    const cap = grown.has(s) ? cap0 * 2.2 : cap0;
    let far = 0;
    for (let i = 0; i < a.pts.length; i++) far = Math.max(far, Math.hypot(s.pts[i][0] - a.pts[i][0], s.pts[i][1] - a.pts[i][1]));
    if (far > cap) {
      const k = cap / far;
      const to = (p, q) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
      s.pts = a.pts.map((p, i) => to(p, s.pts[i]));
      if (s.base && a.base) s.base = to(a.base, s.base);
      if (s.muz && a.muz) s.muz = to(a.muz, s.muz);
    }
  }
  // (and if that, part of the way back, made one something else after all: those lines as they were
  // drawn - and if that is not enough, less of it: tidy, or as drawn)
  let fin = rideSpec(D);
  const turned = S.filter((s) => vOf(s) && fin.role && fin.role.has(s) && fin.role.get(s).v !== vOf(s));
  if (turned.length) {
    for (const s of turned) Object.assign(s, copyStroke(drawn.get(s)));
    // (what it says, of them no more)
    for (const [t, of] of about) {
      const at = notes.indexOf(t);
      const had = of.size;
      for (const s of turned) of.delete(s);
      if (at < 0 || of.size === had) continue;
      if (!of.size) notes.splice(at, 1);
      else if (/^\d+ גלגלים יושרו/.test(t)) notes[at] = of.size > 1 ? `${of.size} גלגלים יושרו על קו אחד` : 'גלגל יושר לקו של האחרים';
    }
    fin = rideSpec(D);
    if (!keeps(fin)) return level === 'eng' ? engineer(design, 'tidy') : { design, notes: [], changes: [] };
  }
  // (what it says is what it did: when the most it may move did not get it there - closer, not over)
  const warn = (fin.sum || {}).warn || [];
  for (let i = 0; i < notes.length; i++) {
    const c = CLOSER.find((c) => c[0] === notes[i]);
    if (c && warn.some((w) => c[2].some((p) => w.startsWith(p)))) notes[i] = c[1];
  }
  const changes = [];
  for (const s of S) {
    const a = drawn.get(s).pts;
    let far = 0;
    for (let i = 0; i < Math.min(a.length, s.pts.length); i++) far = Math.max(far, Math.hypot(s.pts[i][0] - a[i][0], s.pts[i][1] - a[i][1]));
    if (far < 0.01 && a.length === s.pts.length) continue;
    changes.push({ src: s.made && s.type === 'body' ? -1 : s.src === undefined ? null : s.src, from: a, to: s.pts });
  }
  return { design: D, notes, changes };
}

// [the note, said instead when it did not get all the way, the warnings still on the card that say so]
const CLOSER = [
  ['הרוטור הוזז מעל מרכז הכובד', 'הרוטור קורב למרכז הכובד — לא עד הסוף, כדי שיישאר דומה לציור', ['הרוטור מאחורי מרכז הכובד', 'הרוטור לפני מרכז הכובד']],
  ['הסילונים הוזזו אל מתחת למרכז הכובד', 'הסילונים קורבו אל מתחת למרכז הכובד — לא עד הסוף, כדי שיישאר דומה לציור', ['הסילונים מאחורי מרכז הכובד', 'הסילונים לפני מרכז הכובד']],
  ['הכנפיים הוזזו אל מרכז הכובד', 'הכנפיים קורבו אל מרכז הכובד — לא עד הסוף, כדי שיישאר דומה לציור', ['מרכז הכובד מאחורי הכנפיים']],
  ['הגלגלים האחוריים הוזזו אחורה — שהמשקל יהיה ביניהם', 'הגלגלים האחוריים הוזזו אחורה — לא עד הסוף, כדי שיישאר דומה לציור', ['מרכז הכובד מאחורי הגלגלים', 'מרכז הכובד מעל הגלגלים האחוריים']],
  ['הגלגלים הקדמיים הוזזו קדימה — שהמשקל יהיה ביניהם', 'הגלגלים הקדמיים הוזזו קדימה — לא עד הסוף, כדי שיישאר דומה לציור', ['מרכז הכובד לפני הגלגלים', 'מרכז הכובד מעל הגלגלים הקדמיים']],
];

// (the rotors of it: the lines of each one - its blades drawn one by one, an X - together, as
// game/partsum.js rideSpec has them)
function rotorSets(list) {
  let sets = list.map((s) => ({ s: [s], b: boxOf([s]), lat: s.lat || 0 }));
  const near = (p, q) => {
    const wp = p.b.x1 - p.b.x0;
    const wq = q.b.x1 - q.b.x0;
    const w = Math.max(wp, wq);
    return p.b.x1 > q.b.x0 - Math.min(wp, wq) * 0.3 && p.b.x0 < q.b.x1 + Math.min(wp, wq) * 0.3 && Math.abs((p.b.y0 + p.b.y1) / 2 - (q.b.y0 + q.b.y1) / 2) < w * 0.5 && Math.abs(p.lat - q.lat) < w * 0.5;
  };
  // (one into another while any two are near: an X, blades drawn one by one, all one)
  for (let joined = true; joined; ) {
    joined = false;
    for (let i = 0; i < sets.length && !joined; i++) {
      for (let j = i + 1; j < sets.length && !joined; j++) {
        if (!near(sets[i], sets[j])) continue;
        sets[i].s.push(...sets[j].s);
        sets[i].b = boxOf(sets[i].s);
        sets = sets.filter((q, k) => k !== j);
        joined = true;
      }
    }
  }
  return sets.map((q) => q.s);
}

function copyStroke(s) {
  const c = Object.assign({}, s, { pts: s.pts.map((p) => p.slice()) });
  if (s.base) c.base = s.base.slice();
  if (s.muz) c.muz = s.muz.slice();
  return c;
}

// what the parts it has now give it to lift itself (a rotor's), or null
// (ROADMAP 11.13) how much one kind of what lifts it does - k: 'R' its rotors, 'J' its jets under it,
// 'W' its wings (1: just enough) - else, as the card shows the most of them
function liftOf(spec, k) {
  if (spec.lifts && Number.isFinite(spec.lifts[k])) return spec.lifts[k];
  return specLift(spec);
}

function specLift(spec) {
  const bar = spec.sum && spec.sum.bars ? spec.sum.bars.find((b) => b.k === 'lift') : null;
  if (!bar) return null;
  const v = parseFloat(String(bar.txt).replace('×', ''));
  return Number.isFinite(v) ? v : null;
}

function boxOf(list) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of list) {
    for (const [x, y] of s.pts) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1 };
}

function area(P) {
  let a = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]);
  return Math.abs(a) / 2;
}

function centre(P) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of P) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

// (the line its points lie along: its angle, 0 level)
function axisOf(P) {
  let mx = 0;
  let my = 0;
  for (const [x, y] of P) {
    mx += x;
    my += y;
  }
  mx /= P.length;
  my /= P.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of P) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

// (an angle of a line, which has no way it points: into -90..90 degrees)
function wrapHalf(a) {
  while (a > Math.PI / 2) a -= Math.PI;
  while (a < -Math.PI / 2) a += Math.PI;
  return a;
}

// (a barrel's way, level - or upright, or slanting half way - when it nearly was: within tol)
function snap(a, tol) {
  for (let k = -4; k <= 4; k++) {
    const t = (k * Math.PI) / 4;
    if (Math.abs(a - t) < tol) return t;
  }
  return a;
}

function rotate(s, [cx, cy], d) {
  const c = Math.cos(d);
  const n = Math.sin(d);
  const R = ([x, y]) => [cx + (x - cx) * c - (y - cy) * n, cy + (x - cx) * n + (y - cy) * c];
  s.pts = s.pts.map(R);
  if (s.base) s.base = R(s.base);
  if (s.muz) s.muz = R(s.muz);
}

function shift(s, dx, dy) {
  s.pts = s.pts.map(([x, y]) => [x + dx, y + dy]);
  if (s.base) s.base = [s.base[0] + dx, s.base[1] + dy];
  if (s.muz) s.muz = [s.muz[0] + dx, s.muz[1] + dy];
}

// (bigger across - fx - and up - fy - round its middle)
function stretch(s, fx, fy) {
  const [cx, cy] = centre(s.pts);
  s.pts = s.pts.map(([x, y]) => [cx + (x - cx) * fx, cy + (y - cy) * fy]);
  if (s.len) s.len *= fx;
}

function circle(x, y, r) {
  const out = [];
  for (let k = 0; k <= 24; k++) out.push([x + Math.cos((k / 24) * Math.PI * 2) * r, y + Math.sin((k / 24) * Math.PI * 2) * r]);
  return out;
}

function square(x, y, r) {
  return [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r], [x - r, y - r]];
}

// a closed outline smoothed (Taubin's way: it keeps its size), its last point its first again
function smoothLoop(P, n) {
  const closed = Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6;
  let Q = (closed ? P.slice(0, -1) : P.slice()).map((p) => p.slice());
  const m = Q.length;
  const step = (k) => {
    Q = Q.map((p, i) => {
      const a = Q[(i - 1 + m) % m];
      const b = Q[(i + 1) % m];
      return [p[0] + k * ((a[0] + b[0]) / 2 - p[0]), p[1] + k * ((a[1] + b[1]) / 2 - p[1])];
    });
  };
  for (let i = 0; i < n; i++) {
    step(0.5);
    step(-0.53);
  }
  return Q.concat([Q[0].slice()]);
}
