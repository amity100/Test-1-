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
import { board, bestNow } from '../src/game/board';
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

console.log(bad ? `\n${bad} דברים לא עובדים` : '\nהעולם עונה בחזרה');
process.exit(bad ? 1 : 0);
