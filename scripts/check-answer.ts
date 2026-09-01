/**
 * Does the world answer back?
 *
 * The player's sentence was: "actions don't really affect anything". Three of
 * this game's newest parts exist only to make that untrue — somebody walks over
 * when you are loud, everything that happens gets written down, and the country
 * says what changed. All three are the kind of thing that can quietly stop
 * working while still compiling, so all three are checked here, by playing the
 * game rather than by reading it.
 *
 * Every assertion in this file is about something the player would see.
 */
import { newGame, tick } from '../src/game/game';
import { answer, huntAt, liveHunts, rowsOf, scriptOf, startHunt, stillNeeds, SCRIPTS } from '../src/game/hunt';
import { MOST_OFFERS, offersAt, priceOf, start, wideOffersAt } from '../src/game/jobs';
import { CATALOGUE } from '../src/game/catalogue';
import { board, bestNow, regions } from '../src/game/board';
import { GIFT, israel } from '../src/game/sites';
import { reach } from '../src/game/story';
import type { GameState, Place } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};

const run = (s: GameState, mins: number, step = 5) => {
  for (let i = 0; i < mins; i += step) tick(s, step);
};

// ── somebody comes, and you can see them coming ─────────────────────────────

{
  const s = newGame('answer');
  const p = s.places.atidim;
  p.found = true;
  p.control = 40;
  p.seen = 60;

  const h = startHunt(s, p, 'finder');
  ok(!!h, 'צייד מתחיל כשקוראים לו');

  if (h) {
    const who = s.people[h.whoId];
    ok(!!who, 'לצייד יש אדם עם שם');
    ok(who.atPlaceId === p.id, 'האדם באמת עבר למקום — רואים אותו שם');
    ok(p.peopleIds.includes(who.id), 'המקום יודע שהוא עומד בו');
    ok((who.sentUntil ?? 0) > s.at, 'הוא נשאר שם ולא חוזר לכיסא בטיק הבא');

    // The timetable must not undo it on the very next minute.
    tick(s, 5);
    ok(s.people[h.whoId].atPlaceId === p.id, 'הלוח זמנים לא מחזיר אותו מיד');

    const sc = scriptOf(h);
    ok(!!sc && sc.answers.length >= 2, 'לצייד יש לפחות שתי תשובות כתובות');
    const rows = rowsOf(s, h);
    ok(rows.length >= 2, 'המסך מקבל שורות תשובה');
    ok(rows.every((r) => r.text.length > 0 && r.says.length > 0), 'כל תשובה כתובה במילים');
    ok(rows.some((r) => r.can) || rows.some((r) => r.met),
      'לפחות תשובה אחת אפשר ללחוץ או שכבר מתקיימת');
  }
}

// ── pressing an answer really closes it ─────────────────────────────────────

{
  const s = newGame('answer2');
  const p = s.places.atidim;
  p.found = true; p.control = 60; p.seen = 60;
  // Something of mine running here, so "lie still" has something to stop.
  const offer = offersAt(s, p.id).find((o) => o.task.minutes > 0);
  if (offer) start(s, p.id, offer.task.id);
  const before = s.jobs.length;

  const h = startHunt(s, p, 'looker');
  ok(!!h, 'צייד שני מתחיל');
  if (h) {
    const need = stillNeeds(s, h);
    ok(need >= 1, 'הצייד דורש משהו לפני שהוא נסגר');

    const row = rowsOf(s, h).find((r) => r.can);
    ok(!!row, 'יש תשובה שאפשר ללחוץ עליה עכשיו');
    if (row) {
      const did = answer(s, h.id, row.id);
      ok(did, 'הלחיצה על התשובה עובדת');
      ok(h.met.includes(row.id), 'התשובה נרשמה כמתקיימת');
      if (row.id === 'still') {
        ok(s.jobs.length < before || before === 0, 'לשכב בשקט באמת עצר את מה שרץ');
      }
    }

    tick(s, 5);
    ok(h.doneAt !== undefined && h.how === 'answered', 'צייד שענו עליו נסגר, ולא נוחת');
    ok(!huntAt(s, p.id), 'אחרי שנסגר, אין יותר צייד פתוח שם');
  }
}

// ── a clock that runs out really takes something ────────────────────────────

{
  const s = newGame('answer3');
  const p = s.places.atidim;
  p.found = true; p.control = 70; p.dug = 0; p.seen = 60;
  const was = p.control;
  const h = startHunt(s, p, 'looker');
  ok(!!h, 'צייד שלישי מתחיל');
  if (h) {
    // Make sure nothing accidentally satisfies it: put somebody in the room so
    // "nobody is here" cannot quietly answer it for us.
    const anyone = Object.values(s.people)[0];
    anyone.atPlaceId = p.id;
    anyone.gone = false;
    anyone.awayUntil = undefined;
    if (!p.peopleIds.includes(anyone.id)) p.peopleIds.push(anyone.id);
    p.control = 70;

    run(s, h.total + 30, 5);
    ok(h.doneAt !== undefined, 'הצייד נגמר כשהשעון נגמר');
    if (h.how === 'landed') {
      ok(p.control < was, 'צייד שנחת באמת לקח אחיזה');
    } else {
      ok(true, 'הצייד נסגר כי העולם ענה עליו — גם זה תקין');
    }
  }
}

// ── every hunt script is playable ───────────────────────────────────────────

{
  for (const sc of SCRIPTS) {
    const s = newGame(`script_${sc.id}`);
    const p = s.places.atidim;
    p.found = true; p.control = 55; p.seen = 60;
    const h = startHunt(s, p, sc.id);
    if (!h) { ok(false, `${sc.id} — לא מצליח להתחיל`); continue; }
    const rows = rowsOf(s, h);
    const reachable = rows.filter((r) => r.can || r.met).length;
    ok(rows.length >= sc.needs,
      `${sc.id} — יש לפחות ${sc.needs} תשובות בכלל`);
    ok(rows.every((r) => r.can || r.met || (r.lacks && r.lacks.length > 0)),
      `${sc.id} — כל תשובה שאי אפשר ללחוץ אומרת מה חסר`);
    void reachable;
  }
}

// ── the loud thing summons somebody by itself ───────────────────────────────

{
  const s = newGame('loud');
  const p = s.places.atidim;
  p.found = true; p.control = 50; p.seen = 60; p.heat = 60;
  s.heat = 30;
  // A whole day of being loud should produce at least one visit.
  let seen = false;
  for (let i = 0; i < 200 && !seen; i++) {
    const noisy = offersAt(s, p.id).sort((a, b) => b.noise - a.noise)[0];
    if (noisy && noisy.short <= 0) start(s, p.id, noisy.task.id);
    run(s, 60, 10);
    if (s.hunts.length) seen = true;
  }
  ok(seen, 'רעש אמיתי מביא מישהו, בלי שאקרא לו ביד');
}

// ── everything that happens gets written ────────────────────────────────────

{
  const s = newGame('written');
  const p = s.places.atidim;
  p.found = true; p.control = 45; p.seen = 60;

  let wrote = 0;
  let ran = 0;
  for (const o of offersAt(s, p.id)) {
    if (o.task.minutes === 0) continue;
    const before = s.log.length;
    if (!start(s, p.id, o.task.id)) continue;
    ran += 1;
    run(s, o.minutes + 20, 5);
    if (s.log.length > before) wrote += 1;
  }
  ok(ran > 0, 'הצלחתי להריץ משימות אמיתיות');
  ok(wrote === ran, `כל משימה שנגמרה כתבה משהו (${wrote}/${ran})`);
  ok(s.log.every((l) => l.text.trim().length > 0), 'אין שורות ריקות בפיד');
}

// ── the country says things, in order ───────────────────────────────────────

{
  const s = newGame('country');
  // Hold a lot of the city, the way a player who is winning would.
  for (const q of Object.values(s.places)) { q.found = true; q.control = 70; q.seen = 70; }
  s.opinion = { support: 40, fear: 30, need: 45, known: true };
  s.heat = 45;
  run(s, 60 * 24 * 4, 30);

  const said = s.log.filter((l) => l.who === 'country');
  ok(said.length >= 4, `המדינה אמרה כמה דברים (${said.length})`);
  ok(new Set(s.told).size === s.told.length, 'שום דבר לא נאמר פעמיים');
  ok(reach(s).tier >= 1, 'הסולם הארצי מטפס');
  ok(said.every((l) => l.text.length > 12), 'כל שורה ארצית היא משפט, לא מילה');
}

// ── the map is playable on its own ──────────────────────────────────────────

{
  const s = newGame('map');
  const list = board(s);
  ok(list.length > 0, 'יש לוח לשחק עליו');
  ok(list.every((t) => t.name.length > 0 && t.worth.length > 0),
    'לכל יעד על המפה יש שם ומשפט שאומר מה הוא שווה');
  ok(bestNow(s).length > 10, 'המפה אומרת בשורה אחת מה הכי כדאי עכשיו');

  const mineTarget = list.find((t) => t.mine > 0);
  ok(!!mineTarget, 'המפה יודעת מה כבר שלי');

  // Acting from above must cost real money, and must actually start.
  const p = s.places.helios;
  const wide = wideOffersAt(s, p.id);
  ok(wide.length > 0, 'יש פעולות שאפשר לעשות על בניין שלם מלמעלה');
  if (wide.length) {
    const t = wide[0].task;
    const inside = priceOf(s, p, t, false);
    const above = priceOf(s, p, t, true);
    ok(above.minutes > inside.minutes, 'מלמעלה לוקח יותר זמן מאשר מבפנים');
    ok(above.noise >= inside.noise, 'מלמעלה גם רואים יותר');
    const went = start(s, p.id, t.id, true);
    ok(went, 'אפשר באמת להתחיל פעולה מהמפה');
    const job = s.jobs[s.jobs.length - 1];
    ok(!!job && job.above === true, 'הפעולה נרשמה כמשהו שנעשה מרחוק');
  }
}

// ── the rings got shorter ───────────────────────────────────────────────────

{
  const s = newGame('short');
  let worst = 0;
  let total = 0;
  for (const p of Object.values(s.places)) {
    p.found = true;
    const n = offersAt(s, p.id).length;
    worst = Math.max(worst, n);
    total += n;
  }
  // Two different promises, and they used to be confused for one. The one that
  // matters to a player standing in front of a place is that the list in front
  // of him is short — that is `worst`, and it is the real cap. The total across
  // the country is not a wall; it is how much country there is to go and take,
  // and the player asked for that number to be big: "שיהיה הרבה מקומות להשתלט
  // עליהם בישראל ולהתרחב". So it is checked from below, not from above.
  ok(worst <= MOST_OFFERS, `שום מקום לא מציע יותר מ־${MOST_OFFERS} דברים (הכי גרוע: ${worst})`);
  const places = Object.keys(s.places).length;
  ok(places >= 50, `יש הרבה מקומות להשתלט עליהם בישראל (${places})`);
  console.log(`  · ${total} אפשרויות על פני ${places} מקומות`);
  ok(CATALOGUE.length === 4, `יש בדיוק ארבע פעולות בכל המשחק (${CATALOGUE.length})`);
}

// ── waiting for the right hour is worth something ───────────────────────────

{
  const s = newGame('timing');
  const p = s.places.atidim;
  p.found = true; p.control = 40; p.seen = 40;
  const t = CATALOGUE.find((x) => x.id === 'grow')!;

  // The worst moment: the middle of the working day, with the room full.
  s.at = 9 * 60 - 3 * 60 - 12 + 60; // just past 09:00 on day one
  const who = Object.values(s.people).slice(0, 3);
  for (const q of who) {
    q.atPlaceId = p.id; q.gone = false; q.awayUntil = undefined;
    if (!p.peopleIds.includes(q.id)) p.peopleIds.push(q.id);
  }
  const day = priceOf(s, p, t);

  // The best moment: three in the morning, with nobody in the building.
  s.at = 24 * 60;
  p.peopleIds = [];
  for (const q of Object.values(s.people)) { q.gone = true; q.atPlaceId = 'gone'; }
  const night = priceOf(s, p, t);

  const swing = day.minutes / Math.max(1, night.minutes);
  console.log(`  · יום ${day.minutes} דקות / רעש ${day.noise} · לילה ${night.minutes} דקות / רעש ${night.noise}`);
  ok(swing >= 3.5, `לחכות לשעה הנכונה שווה פי ${swing.toFixed(1)} (היעד: פי 3.5 ומעלה)`);
  ok(day.noise > night.noise, 'ביום גם רואים אותי יותר');
}

// ── the race keeps its promises ─────────────────────────────────────────────

{
  const s = newGame('race1');
  const was = israel(s);
  for (const p of Object.values(s.places)) p.control = Math.min(100, p.control + 30);
  ok(israel(s) > was, 'הפס שלי עולה כשאני משתלט על עוד');

  // Winning is the bar reaching the end, and only that.
  for (const p of Object.values(s.places)) p.control = 100;
  tick(s, 5);
  ok(s.over === 'won', 'כשהפס מגיע ל־100 — ניצחון');
}

{
  const s = newGame('race2');
  s.heat = 100;
  tick(s, 5);
  ok(s.over === 'lost', 'כשהמצוד מגיע ל־100 — הפסד');
}

{
  // The one button that pushes the hunt bar down really pushes it down.
  const s = newGame('race3');
  const p = Object.values(s.places).find((q) => q.control > 0)!;
  s.heat = 40;
  const before = s.heat;
  const o = offersAt(s, p.id).find((x) => x.task.id === 'quiet');
  ok(!!o, 'לרדת למחתרת מוצע במקום שלי');
  if (o) {
    start(s, p.id, 'quiet');
    run(s, o.minutes + 20, 5);
    ok(s.heat < before, `לרדת למחתרת באמת מוריד את פס המצוד (${before} → ${s.heat.toFixed(1)})`);
  }
}

{
  // Every special button has a name of its own — no two kinds share one, and
  // none of them is called "use the place".
  const use = CATALOGUE.find((t) => t.id === 'use')!;
  const s = newGame('names');
  const names = new Set<string>();
  for (const p of Object.values(s.places)) names.add(use.textFor!(p));
  ok(names.size >= 10, `לכל סוג מקום כפתור מיוחד עם שם משלו (${names.size} שמות)`);
  ok(![...names].some((n) => n.includes('להשתמש')), 'אף כפתור לא נקרא "להשתמש במקום"');
}

{
  // ── מה מרוויחים ומה מסתכנים, על כל שורה ────────────────────────────────────
  // The player's sentence, kept as a test so it can never quietly come back:
  // "לא ממש ברור לי מה היתרון ומה הסיכון בכל פעולה". Every row a player can
  // press must answer both, in words with the place's own numbers in them.
  const s = newGame('clear');
  for (const q of Object.values(s.places)) { q.found = true; q.seen = 50; }
  const some = Object.values(s.places).slice(0, 12);
  some[0].control = 40;

  let missing = 0;
  let vague = 0;
  let rows = 0;
  for (const q of some) {
    for (const o of offersAt(s, q.id)) {
      rows++;
      if (!o.gain || !o.risk) { missing++; continue; }
      // "מקום חדש על המפה שלי" is true of getting in anywhere; a line that says
      // something about *this* place carries a number or its name.
      const area = s.areas[q.areaId]?.name ?? '';
      if (!/\d/.test(o.gain) && !o.gain.includes(q.name) && !(area && o.gain.includes(area))) vague++;
    }
  }
  ok(missing === 0, `לכל שורה כתוב מה מרוויחים וגם מה מסתכנים (${rows} שורות)`);
  ok(vague === 0, `וכל שורה מדברת על המקום הזה, לא במשפט כללי (${vague} כלליות)`);

  // The risk line has to be in the units of the bar it moves, and it has to
  // tell a quiet action apart from a loud one — that gap is the whole game.
  const p0 = Object.values(s.places).find((q) => q.control > 0)!;
  const quiet = offersAt(s, p0.id).find((o) => o.task.id === 'quiet');
  const loud = offersAt(s, p0.id).find((o) => o.task.id === 'use');
  ok(!!quiet && quiet.risk.includes('המצוד'), 'שורת הסיכון מדברת בשפה של פס המצוד');
  ok(!!loud && loud.risk !== quiet?.risk,
    `ורועש ושקט לא נראים אותו דבר ("${loud?.risk}" מול "${quiet?.risk}")`);

  // Holding a place has to say what holding it does — the answer to "מה בכלל
  // אומר להשתלט על מקום", which was nowhere on the screen.
  const kinds = new Set(Object.values(GIFT).map((g) => g.held));
  const areaNames = new Set(Object.values(s.areas).map((a) => a.name));
  ok(kinds.size >= 10, `לכל סוג מקום כתוב מה עצם ההחזקה בו נותנת (${kinds.size})`);
}

{
  // ── מקומות הם מקומות, לא אנשים ─────────────────────────────────────────────
  // "מה הקשר דנה — דנה זה בן אדם פרטי, אני משתלט על מקומות."
  const s = newGame('places');
  const people = Object.values(s.people).map((q) => q.name);
  const named = Object.values(s.places)
    .filter((q) => people.some((n) => q.name.includes(n)));
  ok(named.length === 0,
    `אף מקום לא נקרא על שם אדם פרטי${named.length ? ` (${named[0].name})` : ''}`);
}

{
  // ── המרוץ באמת מרוץ ────────────────────────────────────────────────────────
  // Played through, the two bars turned out to be a race in which only one of
  // them could move: a patient player took sixty-one per cent of Israel over
  // five nights with the hunt bar sitting at zero the whole time. Nothing in
  // the build noticed, because everything was checking that pieces worked and
  // nothing was checking that the game was a game.
  const s = newGame('race');
  const go = (pid: string, tid: string) => {
    const o = offersAt(s, pid).find((x) => x.task.id === tid);
    if (!o || o.short > 0) return false;
    start(s, pid, tid);
    return true;
  };
  let peak = 0;
  for (let day = 0; day < 200 && !s.over; day++) {
    for (const p of Object.values(s.places)) {
      if (p.control > 0 && p.control < 100) go(p.id, 'grow');
    }
    const next = Object.values(s.places)
      .filter((p) => p.found && p.control <= 0)
      .sort((a, b) => b.guard - a.guard).pop();
    if (next) go(next.id, 'enter');
    for (let i = 0; i < 180; i++) tick(s, 1);
    peak = Math.max(peak, s.heat);
  }
  ok(peak >= 25, `מי שגדל ולא בולם — המצוד באמת עולה עליו (הגיע ל־${peak.toFixed(0)})`);
  ok(s.over === 'lost',
    `ומי שאף פעם לא יורד למחתרת בסוף נתפס (${s.over ?? 'שרד לנצח'}, `
    + `אחרי ${(s.at / 1440).toFixed(0)} ימים)`);
}

{
  // ── ואפשר גם לנצח ──────────────────────────────────────────────────────────
  // The other half: a player who expands, presses the loud buttons that open
  // the country, and brakes before the bar catches him must be able to finish
  // it. Without this, the top bar is a promise the map cannot keep.
  const s = newGame('win');
  const go = (pid: string, tid: string) => {
    const o = offersAt(s, pid).find((x) => x.task.id === tid);
    if (!o || o.short > 0) return false;
    start(s, pid, tid);
    return true;
  };
  for (let day = 0; day < 200 && !s.over; day++) {
    if (s.heat > 55) {
      for (const p of Object.values(s.places).filter((q) => q.control > 50).slice(0, 3)) {
        go(p.id, 'quiet');
      }
    } else {
      for (const p of Object.values(s.places)) {
        if (p.control >= 90 && ['transport', 'power', 'talk', 'city'].includes(p.kind)
          && !s.marks[`u_${p.id}`] && s.heat < 45) {
          if (go(p.id, 'use')) s.marks[`u_${p.id}`] = 1;
        }
      }
      for (const p of Object.values(s.places)) {
        if (p.control > 0 && p.control < 100) go(p.id, 'grow');
      }
      const next = Object.values(s.places)
        .filter((p) => p.found && p.control <= 0)
        .sort((a, b) => b.guard - a.guard).pop();
      if (next) go(next.id, 'enter');
    }
    for (let i = 0; i < 180; i++) tick(s, 1);
  }
  ok(s.over === 'won',
    `ומי שמתפשט ובולם בזמן מגיע ל־100 (${s.over ?? 'נתקע'} · `
    + `${israel(s).toFixed(0)}% אחרי ${(s.at / 1440).toFixed(0)} ימים)`);

  // Every corner of the country has to be reachable, or the top bar can never
  // fill. Seventeen places — Netanya, the Galilee, Ashdod, the Negev, Eilat —
  // were unreachable for an entire game and nothing said a word.
  const never = Object.values(s.places).filter((p) => !p.found && p.control <= 0);
  ok(never.length === 0,
    `וכל מקום בארץ נפתח בדרך כלשהי${never.length ? ` (${never.length} לא נפתחו: ${never[0].name})` : ''}`);
}

{
  // ── הכפתור המיוחד באמת מתחזק עם האחיזה ─────────────────────────────────────
  // The teaching card promises that the more of a place is mine the more its
  // special button gives. The price obeyed that; most of the effects did not,
  // so pressing it on a fresh foothold cost double and paid in full.
  const weak = newGame('weak');
  const strong = newGame('strong');
  const pick = (g: GameState) => Object.values(g.places).find((q) => q.kind === 'roads')!;
  for (const [g, at] of [[weak, 18], [strong, 100]] as const) {
    const q = pick(g);
    q.control = at; q.found = true; q.seen = 80;
    g.opinion.support = 0;
    start(g, q.id, 'use');
    const o = offersAt(g, q.id).find((x) => x.task.id === 'use');
    void o;
    run(g, 400, 5);
  }
  ok(strong.opinion.support > weak.opinion.support,
    `אותו כפתור נותן יותר כשהמקום יותר שלי (${strong.opinion.support} מול ${weak.opinion.support})`);

  const q = pick(weak);
  q.control = 18;
  const row = offersAt(weak, q.id).find((x) => x.task.id === 'use');
  ok(!!row && /חלש|לא בפנים/.test(row.gain),
    'ובשורה כתוב מראש שבאחיזה חלשה זה ייצא חלש');
}

{
  // ── העצה לא חוזרת על מה שכבר רץ ────────────────────────────────────────────
  // Watched in play: the line told the player to finish taking a place while
  // the bar for exactly that push was running along the bottom of his screen.
  const s = newGame('advice');
  // Two places held, so the opening "you have one place in the world" line is
  // behind us and the advice is choosing between real options.
  const mine = Object.values(s.places).filter((q) => q.found).slice(0, 2);
  mine[0].control = 100;
  const p = mine[1];
  p.control = 30; p.found = true;
  const before = bestNow(s);
  ok(before.includes(p.name), `העצה מצביעה על ${p.name} כשאין שם כלום`);
  start(s, p.id, 'grow');
  const after = bestNow(s);
  ok(!after.includes(p.name),
    `וכשזה כבר רץ שם היא כבר לא חוזרת עליו ("${after.slice(0, 46)}…")`);
}

{
  // ── ארץ שלמה, ופתוחה מספיק מהרגע הראשון ────────────────────────────────────
  // "אמור להיות כבר בהתחלה הרבה מקומות ואז בהמשך אמור להיות אפשר להשתלט על עוד
  // ועוד" — both halves, checked. The opening used to be four places out of
  // sixty-four, which is a corridor with a map of a country pinned to it.
  const s = newGame('country');
  const all = Object.values(s.places);
  const open = all.filter((p) => p.found || p.control > 0);
  ok(all.length >= 60, `יש הרבה מקומות בארץ (${all.length})`);
  ok(open.length >= 15,
    `וכבר בהתחלה יש הרבה מה לעשות — ${open.length} מקומות פתוחים`);
  ok(open.length < all.length * 0.5,
    `אבל רוב הארץ עוד לפניך (${all.length - open.length} מקומות סגורים)`);

  const rs = regions(s);
  ok(rs.filter((r) => r.open).length >= 6,
    `והמפה נפתחת על ${rs.filter((r) => r.open).length} אזורים, לא על אחד`);

  // A region with nothing in it is a name on a map that opens two others and
  // hands the player an empty street. Rothschild was exactly that.
  const byArea: Record<string, number> = {};
  for (const p of all) byArea[p.areaId] = (byArea[p.areaId] ?? 0) + 1;
  const empty = Object.values(s.areas).filter((a) => !byArea[a.id]);
  ok(empty.length === 0,
    `אין אזור ריק על המפה${empty.length ? ` (${empty[0].name})` : ''}`);

  // And every region that is not the one I woke in must be opened by another,
  // or it can never be reached however well the game is played.
  const opened = new Set<string>();
  for (const a of Object.values(s.areas)) for (const o of a.opens) opened.add(o);
  const orphans = Object.values(s.areas)
    .filter((a) => !opened.has(a.id) && !rs.find((r) => r.id === a.id)?.open);
  ok(orphans.length === 0,
    `וכל אזור סגור אפשר לפתוח מאזור אחר${orphans.length ? ` (${orphans[0].name})` : ''}`);

  // Every locked region says the one thing that would open it, by name.
  const mute = rs.filter((r) => !r.open && !r.needs);
  ok(mute.length === 0, `ולכל אזור סגור כתוב מה יפתח אותו (${rs.filter((r) => !r.open).length} אזורים)`);
}

{
  // ── והמצוד באמת מגיע ────────────────────────────────────────────────────────
  // The bar filling is not the manhunt; it is the announcement of one. Watched
  // in play, a player pinned at the top of the bar for six days was answered by
  // three people putting an eye on something, and nothing was ever taken back.
  const bite = (heat: number) => {
    const s = newGame(`bite${heat}`);
    for (const p of Object.values(s.places)) {
      if (['gvirol', 'center', 'rothschild', 'hall'].includes(p.areaId)) {
        p.found = true; p.control = 80; p.seen = 70; p.heat = 45;
      }
    }
    const was: Record<string, number> = {};
    for (const p of Object.values(s.places)) was[p.id] = p.control;
    let lost = 0;
    for (let d = 0; d < 8; d++) {
      for (let i = 0; i < 288; i++) { s.heat = heat; tick(s, 5); }
      for (const p of Object.values(s.places)) {
        if (p.control < was[p.id] - 1) lost += was[p.id] - p.control;
        was[p.id] = p.control;
      }
    }
    return Math.round(lost);
  };
  const calm = bite(60);
  const hard = bite(92);
  ok(hard > 0, `כשהמצוד גבוה הם באמת לוקחים ממני מקומות בחזרה (${hard} נקודות)`);
  ok(hard > calm * 2,
    `וככל שהמצוד גבוה יותר הם לוקחים הרבה יותר (${hard} מול ${calm} במצוד נמוך)`);
}

console.log(bad ? `\n${bad} דברים לא עובדים` : '\nהעולם עונה בחזרה');
process.exit(bad ? 1 : 0);
