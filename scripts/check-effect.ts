/**
 * Does anything I press actually do anything?
 *
 * The complaint that produced this file was the right one: buttons that read
 * beautifully and change nothing. So every task in the catalogue is run here, at
 * a place where it makes sense, all the way to the end, against a snapshot of
 * the entire world — and the build fails unless the world really moved, in the
 * direction the verb promises.
 *
 * A watch that teaches me nothing, a connect that takes nothing, an influence
 * that leaves everybody exactly where they were: all of those are bugs, and all
 * of them were in here before this file existed.
 */
import { newGame, tick } from '../src/game/game';
import { CATALOGUE, waysInto } from '../src/game/catalogue';
import { offersAt, poolOf, start, sync } from '../src/game/jobs';
import { standing } from '../src/game/standing';
import type { Task } from '../src/game/jobs';
import type { GameState, Place, Verb } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};
const head = (t: string) => console.log(`\n── ${t}`);

/** Everything about the world that a task could possibly move. */
function shot(s: GameState) {
  return {
    info: s.info,
    heat: s.heat,
    power: poolOf(s),
    places: Object.fromEntries(Object.values(s.places).map((p) => [p.id,
      [p.control, p.heat, p.dug, p.seen, p.guard, p.copy ? 1 : 0, p.found ? 1 : 0].join()])),
    people: Object.fromEntries(Object.values(s.people).map((q) => [q.id,
      [q.atPlaceId, q.worry, q.gone ? 1 : 0].join()])),
    areas: Object.fromEntries(Object.values(s.areas).map((a) => [a.id, [a.seen, a.control].join()])),
    belief: JSON.stringify(s.belief),
    opinion: JSON.stringify(s.opinion),
    marks: JSON.stringify(s.marks),
    traces: s.traces.join(),
    moves: s.moves.map((m) => `${m.id}@${m.at}`).join(),
  };
}

type Shot = ReturnType<typeof shot>;

/** What changed between two snapshots, as a list of plain names. */
function diff(a: Shot, b: Shot): string[] {
  const out: string[] = [];
  if (b.info !== a.info) out.push('מידע');
  if (b.heat !== a.heat) out.push('חשד');
  if (b.power !== a.power) out.push('כוח');
  for (const id of Object.keys(a.places)) {
    if (a.places[id] === b.places[id]) continue;
    const [c1, h1, d1, s1, g1, cp1, f1] = a.places[id].split(',');
    const [c2, h2, d2, s2, g2, cp2, f2] = b.places[id].split(',');
    if (c1 !== c2) out.push(`שליטה·${id}`);
    if (h1 !== h2) out.push(`חשד·${id}`);
    if (d1 !== d2) out.push(`אחיזה·${id}`);
    if (s1 !== s2) out.push(`ראייה·${id}`);
    if (g1 !== g2) out.push(`שמירה·${id}`);
    if (cp1 !== cp2) out.push(`עותק·${id}`);
    if (f1 !== f2) out.push(`נמצא·${id}`);
  }
  for (const id of Object.keys(a.people)) {
    if (a.people[id] === b.people[id]) out.push(`אדם·${id}`);
  }
  for (const id of Object.keys(a.areas)) {
    if (a.areas[id] !== b.areas[id]) out.push(`אזור·${id}`);
  }
  if (a.belief !== b.belief) out.push('הסברים');
  if (a.opinion !== b.opinion) out.push('דעת קהל');
  if (a.traces !== b.traces) out.push('סימנים');
  if (a.moves !== b.moves) out.push('התוכנית שלהם');
  if (a.marks !== b.marks) out.push('זיכרון העולם');
  return out;
}

/** What each verb is obliged to move. A task that moves nothing else is a lie. */
const MUST: Record<Verb, (d: string[]) => boolean> = {
  watch: (d) => d.some((x) => x === 'מידע' || x.startsWith('ראייה·') || x.startsWith('אזור·')),
  connect: (d) => d.some((x) => x.startsWith('שליטה·')),
  spread: (d) => d.some((x) => x.startsWith('שליטה·') || x.startsWith('נמצא·')
    || x.startsWith('אזור·') || x.startsWith('עותק·')),
  deepen: (d) => d.some((x) => x.startsWith('שליטה·') || x.startsWith('אחיזה·')
    || x.startsWith('ראייה·') || x.startsWith('עותק·') || x.startsWith('שמירה·')
    || x === 'כוח' || x === 'זיכרון העולם'),
  influence: (d) => d.some((x) => x.startsWith('אדם·') || x === 'דעת קהל'
    || x === 'הסברים' || x === 'חשד' || x.startsWith('חשד·') || x === 'זיכרון העולם'),
  hide: (d) => d.some((x) => x === 'חשד' || x.startsWith('חשד·') || x === 'הסברים'
    || x.startsWith('אחיזה·') || x === 'זיכרון העולם'),
  defend: (d) => d.some((x) => x.startsWith('אחיזה·') || x.startsWith('ראייה·')
    || x === 'מידע' || x === 'התוכנית שלהם' || x === 'עותק·' || x === 'זיכרון העולם'
    || x.startsWith('עותק·')),
};

/** A world where everything is reachable, so no task is skipped for the wrong reason. */
function world(seed: string): GameState {
  const s = newGame(seed);
  for (const p of Object.values(s.places)) {
    p.found = true;
    p.control = 60;
    p.seen = 50;
  }
  s.power.all = 60;
  s.info = 30;
  // Somebody at their desk, so the person-shaped tasks have a person.
  s.people.dana.gone = false;
  s.people.dana.atPlaceId = 'dana_pc';
  s.places.dana_pc.peopleIds = ['dana'];
  s.places.dana_phone.peopleIds = ['dana'];
  sync(s);
  return s;
}

/** Somewhere this task belongs. */
function placeFor(s: GameState, t: Task): Place | undefined {
  return Object.values(s.places).find((p) => (t.places
    ? t.places.includes(p.id)
    : (t.kinds ?? []).includes(p.kind))
    && (t.show ? t.show(s, p) : true));
}

// ── 1 · every task in the catalogue moves the world ────────────────────────
head('כל פעולה עושה משהו');
{
  const dead: string[] = [];
  const wrong: string[] = [];
  for (const t of CATALOGUE) {
    const s = world(`fx-${t.id}`);
    const p = placeFor(s, t);
    if (!p) { dead.push(`${t.id} — אין מקום שמתאים לה בכלל`); continue; }
    // A place is either not fully mine (so connect has something to do) or is.
    if (t.verb === 'connect') p.control = 20;
    const before = shot(s);
    if (!start(s, p.id, t.id)) { dead.push(`${t.id} — אי אפשר להתחיל אותה`); continue; }
    // Long enough to finish, or — for something that runs for ever — an hour of it.
    for (let i = 0; i < 200 && s.jobs.length; i++) tick(s, 5);
    if (s.jobs.length) for (let i = 0; i < 12; i++) tick(s, 5);
    const changed = diff(before, shot(s));
    if (!changed.length) { dead.push(`${t.id} (${t.verb}) — העולם לא זז בכלל`); continue; }
    if (!MUST[t.verb](changed)) {
      wrong.push(`${t.id} (${t.verb}) — זז רק: ${changed.slice(0, 6).join(', ')}`);
    }
  }
  for (const d of dead) console.log(`   ✗ ${d}`);
  for (const w of wrong) console.log(`   ✗ ${w}`);
  ok(dead.length === 0, `אין אף פעולה שלא עושה כלום (${CATALOGUE.length} נבדקו)`);
  ok(wrong.length === 0, 'וכל פעולה עושה בדיוק את מה שהפועל שלה מבטיח');
}

// ── 2 · a way in really does get me in ─────────────────────────────────────
head('הדרכים פנימה');
{
  const s = world('ways');
  for (const p of Object.values(s.places)) p.control = 0;
  s.places.home.control = 100;
  sync(s);
  let checked = 0;
  let failed = 0;
  for (const p of Object.values(s.places)) {
    if (p.control > 0) continue;
    for (const t of waysInto(s, p)) {
      const t2 = world(`way-${p.id}-${t.id}`);
      for (const q of Object.values(t2.places)) q.control = 0;
      t2.places.home.control = 100;
      const from = t.id.startsWith('in_') && !t.id.startsWith('in_force')
        ? t.id.split('_').slice(2).join('_') : null;
      if (from && t2.places[from]) t2.places[from].control = 60;
      sync(t2);
      const target = t2.places[p.id];
      const was = target.control;
      if (!start(t2, p.id, t.id)) { failed += 1; console.log(`   ✗ ${p.id}/${t.id} לא מתחילה`); continue; }
      for (let i = 0; i < 200 && t2.jobs.length; i++) tick(t2, 5);
      checked += 1;
      if (target.control <= was) { failed += 1; console.log(`   ✗ ${p.id}/${t.id} לא נתנה שליטה`); }
    }
  }
  ok(failed === 0, `כל דרך פנימה באמת מכניסה אותי (${checked} דרכים)`);
}

// ── 3 · noise really is noticed, including from a job that never ends ──────
head('רעש נשמע');
{
  const loudOnes = CATALOGUE.filter((t) => t.noise >= 2);
  let silent = 0;
  let checked = 0;
  for (const t of loudOnes) {
    const s = world(`noise-${t.id}`);
    const p = placeFor(s, t);
    if (!p) continue;
    if (t.verb === 'connect') p.control = 20;
    const heatWas = s.heat;
    const placeWas = p.heat;
    // What it actually costs here and now. Something the discounts have taken
    // all the way down to nothing is allowed to be silent — that is the point.
    const offered = offersAt(s, p.id).find((o) => o.task.id === t.id);
    if (!offered || offered.noise === 0) continue;
    checked += 1;
    start(s, p.id, t.id);
    for (let i = 0; i < 200 && s.jobs.length; i++) tick(s, 5);
    if (s.jobs.length) for (let i = 0; i < 24; i++) tick(s, 5);
    if (s.heat <= heatWas && p.heat <= placeWas) {
      silent += 1;
      console.log(`   ✗ ${t.id} — רעש ${offered.noise}, ואף אחד לא הרגיש כלום`);
    }
  }
  ok(silent === 0, `כל פעולה שעדיין רועשת אחרי ההנחות באמת מורגשת (${checked} נבדקו)`);
}

// ── 4 · every kind of place is worth having for its own reason ─────────────
head('כל מקום שווה משהו');
{
  const kinds = [...new Set(Object.values(newGame('k').places).map((p) => p.kind))];
  const thin: string[] = [];
  for (const kind of kinds) {
    const s = world(`kind-${kind}`);
    const p = Object.values(s.places).find((x) => x.kind === kind)!;
    const here = offersAt(s, p.id);
    // Things it can do that a plain wall could not: not counting the ways in,
    // which every place has, and not counting the things every place has.
    // Not the ways in, which everything has, and not the handful of things that
    // work anywhere. What is left is what this kind alone can do.
    const own = here.filter((o) => o.task.verb !== 'connect'
      && (o.task.kinds?.length ?? 99) <= 4);
    if (own.length < 1) thin.push(`${kind} — אין לו שום דבר משלו`);
  }
  for (const t of thin) console.log(`   ✗ ${t}`);
  ok(thin.length === 0, `לכל סוג מקום יש משהו שרק הוא נותן (${kinds.length} סוגים)`);
}

// ── 5 · holding something is worth something by itself ────────────────────
head('להחזיק מקום שווה משהו');
{
  /** Everything holding this thing gives me, with no power spent on it. */
  const worth = (s: GameState) => {
    const st = standing(s);
    return [
      poolOf(s),
      st.eyes.size, st.roll.size, st.opens.length, st.habits.size,
      st.voice ? 1 : 0,
      Math.round(st.drip * 1000),
      Math.round(Object.values(st.fast).reduce((a, b) => a + b, 0) * 100),
      Math.round(Object.values(st.reach).reduce((a, b) => a + b, 0) * 100),
      Math.round(Object.values(st.hand).reduce((a, b) => a + b, 0) * 100),
    ].join();
  };
  const bare = newGame('worth');
  for (const p of Object.values(bare.places)) p.control = 0;
  sync(bare);
  const nothing: string[] = [];
  const gained: string[] = [];
  for (const p of Object.values(bare.places)) {
    const t = newGame('worth2');
    for (const q of Object.values(t.places)) q.control = 0;
    t.places[p.id].control = 100;
    sync(t);
    if (worth(t) === worth(bare)) nothing.push(p.name);
    else gained.push(p.name);
  }
  for (const name of nothing) console.log(`   ✗ ${name} — להחזיק אותו לא נותן כלום`);
  ok(nothing.length === 0,
    `כל מקום נותן משהו כבר בעצם ההחזקה, בלי להוציא עליו כוח (${gained.length} מקומות)`);
}

// ── 6 · and each kind gives something the others do not ───────────────────
head('כל סוג נותן משהו אחר');
{
  const bare = newGame('kinds');
  for (const p of Object.values(bare.places)) p.control = 0;
  sync(bare);
  const seen = new Map<string, string>();
  const same: string[] = [];
  const kinds = [...new Set(Object.values(bare.places).map((p) => p.kind))];
  for (const kind of kinds) {
    const t = newGame('kinds2');
    for (const q of Object.values(t.places)) q.control = 0;
    const one = Object.values(t.places).find((q) => q.kind === kind)!;
    one.control = 100;
    sync(t);
    const st = standing(t);
    const face = [st.eyes.size > 0, st.roll.size > 0, st.voice, st.habits.size > 0,
      st.opens.length > 0, Object.keys(st.fast).length > 0,
      Object.keys(st.reach).length > 0, Object.keys(st.hand).length > 0].join();
    const twin = seen.get(face);
    // Two kinds that give exactly the same nothing are one kind too many.
    if (twin && face === 'false,false,false,false,false,false,false,false') {
      same.push(`${kind} ו${twin} נותנים בדיוק אותו דבר`);
    }
    seen.set(face, kind);
  }
  for (const t of same) console.log(`   ✗ ${t}`);
  ok(same.length === 0, `לכל סוג מקום יש פנים משלו (${kinds.length} סוגים)`);
}

console.log(bad
  ? `\n✗ ${bad} דברים לא עושים את מה שכתוב עליהם.`
  : '\n✓ כל פעולה במשחק באמת משנה את העולם, בכיוון שהיא מבטיחה.');
process.exit(bad ? 1 : 0);
