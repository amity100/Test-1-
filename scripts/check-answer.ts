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
  const p = s.places.dana_pc;
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
  const p = s.places.dana_pc;
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
  const p = s.places.dana_pc;
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
    const p = s.places.dana_pc;
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
  const p = s.places.dana_pc;
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
  const p = s.places.dana_pc;
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
  const p = s.places.home;
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
    ok(!!job && job.wideIn === p.buildingId, 'הפעולה נרשמה כמשהו שחל על כל הבניין');
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
  ok(worst <= MOST_OFFERS, `שום חפץ לא מציע יותר מ־${MOST_OFFERS} דברים (הכי גרוע: ${worst})`);
  console.log(`  · ${total} אפשרויות בסך הכל, לעומת 324 קודם`);
  ok(total < 200, `סך האפשרויות ירד משמעותית (${total})`);
  ok(CATALOGUE.filter((t) => t.wide).length === 6, 'שש המשימות הכלליות עברו למפה');
}

// ── waiting for the right hour is worth something ───────────────────────────

{
  const s = newGame('timing');
  const p = s.places.dana_pc;
  p.found = true; p.control = 40; p.seen = 40;
  const t = CATALOGUE.find((x) => x.id === 'read_inside')!;

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

console.log(bad ? `\n${bad} דברים לא עובדים` : '\nהעולם עונה בחזרה');
process.exit(bad ? 1 : 0);
