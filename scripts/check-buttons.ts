/**
 * Presses every button in the game and checks that it did something.
 *
 * A button that is shown but leads nowhere is worse than a button that is
 * missing, so this walks every place, every way in and every thing you can do,
 * and fails if any of them are unreachable, unwired, or silent when pressed.
 */
import { newGame, refresh } from '../src/game/game';
import { USES, actionsFor, run } from '../src/game/actions';
import { WAYS, TRACES, waysTo } from '../src/game/ways';
import { STAGES, DONE } from '../src/game/stages';
import { TEACH } from '../src/game/game';
import { readFileSync } from 'fs';
import type { GameState } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { console.log(`✗ ${what}`); bad += 1; }
};
const shot = (s: GameState) => JSON.stringify({
  places: s.places, people: s.people, marks: s.marks, traces: s.traces, hunt: s.hunt,
});

// ── 1 · every way points at somewhere real ──────────────────────────────────
const base = newGame('buttons');
for (const [placeId, list] of Object.entries(WAYS)) {
  ok(!!base.places[placeId], `הדרכים מוגדרות למקום שקיים: ${placeId}`);
  ok(list.length > 0, `יש לפחות דרך אחת ל־${placeId}`);
  const ids = new Set<string>();
  for (const w of list) {
    ok(!!base.places[w.from], `${placeId}/${w.id}: באים ממקום שקיים (${w.from})`);
    ok(!ids.has(w.id), `${placeId}/${w.id}: אין שתי דרכים עם אותו שם`);
    ids.add(w.id);
    ok(w.text.trim().length > 0, `${placeId}/${w.id}: יש כיתוב על הכפתור`);
    ok(w.says.trim().length > 0, `${placeId}/${w.id}: כתוב מה יקרה`);
    // A way that is shut must say what is missing, or the player is stuck with no clue.
    ok(w.can(base) || w.need.trim().length > 0, `${placeId}/${w.id}: כתוב מה חסר כשהיא סגורה`);
  }
}

// ── 2 · every place you can reach at all, can be reached ────────────────────
const reachable = new Set<string>(
  Object.values(base.places).filter((p) => p.mine).map((p) => p.id),
);
for (let pass = 0; pass < 12; pass++) {
  for (const [placeId, list] of Object.entries(WAYS)) {
    if (list.some((w) => reachable.has(w.from))) reachable.add(placeId);
  }
}
for (const p of Object.values(base.places)) {
  ok(reachable.has(p.id), `אפשר להגיע ל־${p.id} (${p.name}) מאיפשהו`);
}

// ── 3 · every step points at a place that exists and can be finished ────────
for (const stage of STAGES) {
  for (const step of stage.steps) {
    ok(!!DONE[step.id], `לשלב ${stage.n}/${step.id} יש בדיקת סיום`);
    if (step.placeId) {
      ok(!!base.places[step.placeId], `${step.id} מצביע על מקום שקיים: ${step.placeId}`);
      ok(reachable.has(step.placeId), `${step.id} מצביע על מקום שאפשר להגיע אליו`);
    }
    ok(step.hint.trim().length > 0, `${step.id}: יש הסבר מה לעשות`);
  }
}
for (const t of TEACH) ok(t.body.trim().length > 0, `לכרטיס ההסבר ${t.id} יש טקסט`);

// ── 4 · press every way into every place, from a state that holds everything ─
const all = newGame('buttons-all');
for (const p of Object.values(all.places)) { p.found = true; }
for (const placeId of Object.keys(WAYS)) {
  const s = newGame(`w-${placeId}`);
  // Hold everything except the target, so every way in is at least offered.
  for (const p of Object.values(s.places)) {
    p.found = true;
    if (p.id !== placeId) p.mine = true;
  }
  const acts = actionsFor(s, placeId);
  ok(acts.length === (WAYS[placeId] ?? []).length,
    `${placeId}: כל הדרכים מוצגות (${acts.length}/${(WAYS[placeId] ?? []).length})`);
  for (const a of acts) {
    ok(a.id.startsWith('take:'), `${placeId}: ${a.id} הוא כפתור השתלטות`);
    const t = newGame(`t-${placeId}-${a.id}`);
    for (const p of Object.values(t.places)) { p.found = true; if (p.id !== placeId) p.mine = true; }
    const one = actionsFor(t, placeId).find((x) => x.id === a.id)!;
    const before = shot(t);
    const done = run(t, placeId, a.id);
    if (one.blocked) {
      ok(!done, `${placeId}/${a.id}: דרך חסומה לא מבוצעת`);
      ok(one.blocked.trim().length > 0, `${placeId}/${a.id}: החסימה מסבירה את עצמה`);
    } else {
      ok(done, `${placeId}/${a.id}: הדרך פועלת`);
      ok(t.places[placeId].mine, `${placeId}/${a.id}: המקום באמת נתפס`);
      ok(shot(t) !== before, `${placeId}/${a.id}: משהו בעולם השתנה`);
    }
  }
}

// ── 5 · press everything you can do with a place you already hold ───────────
//
// Some buttons only exist once another one has been pressed — you cannot turn a
// computer back on before turning it off, and you cannot show an old recording
// before making one. So press in rounds until no new button turns up.
const seen = new Set<string>();
for (const placeId of Object.keys(base.places)) {
  const s = newGame(`u-${placeId}`);
  for (const p of Object.values(s.places)) { p.found = true; p.mine = true; }
  s.places[placeId].attention = 1;   // so the "make it look like a fault" trick shows too

  const pressed = new Set<string>();
  let round = 0;
  let acts = actionsFor(s, placeId);
  ok(acts.length > 0, `${placeId}: יש לפחות דבר אחד לעשות איתו`);

  while (round++ < 8) {
    const next = actionsFor(s, placeId).find((a) => !pressed.has(a.id));
    if (!next) break;
    pressed.add(next.id);
    seen.add(next.id);
    ok(next.text.trim().length > 0, `${placeId}/${next.id}: יש כיתוב`);
    ok(next.says.trim().length > 0, `${placeId}/${next.id}: כתוב מה יקרה`);
    const before = shot(s);
    const logBefore = s.log.length;
    const done = run(s, placeId, next.id);
    ok(done, `${placeId}/${next.id}: הכפתור פועל`);
    ok(shot(s) !== before || s.log.length > logBefore,
      `${placeId}/${next.id}: הלחיצה עשתה משהו`);
    refresh(s);
    // Keep holding everything, so losing a place cannot end the sweep early.
    for (const p of Object.values(s.places)) { p.found = true; p.mine = true; }
  }
}

// ── 6 · nothing in the tables is dead code the player can never see ─────────
for (const u of USES) {
  ok(seen.has(u.id), `אפשר להגיע לכפתור "${u.text}" (${u.id}) באיזשהו מקום`);
}
ok(seen.has('copy'), 'אפשר להשאיר עותק');
ok(seen.has('explain'), 'אפשר להסביר מקום כתקלה');

// Every mark must be something a button can actually leave behind.
const src = [
  ...Object.values(WAYS).flat().map((w) => String(w.after ?? '')),
  ...USES.map((u) => String(u.run)),
  ...USES.map((u) => u.cost ?? ''),
].join('\n');
for (const id of Object.keys(TRACES)) {
  ok(src.includes(`'${id}'`) || src.includes(`"${id}"`) || id === 'blamed_cable',
    `הסימן "${id}" נוצר על ידי משהו שהשחקן יכול ללחוץ עליו`);
}

// ── 7 · no screen is a wall with no door in it ──────────────────────────────
//
// A modal pauses the game, so one without a button on it strands the player.
// The end-of-game screen was exactly that until this check went in.
const ui = readFileSync('src/ui/ui.ts', 'utf8');
const sheets = ui.split('this.modal(').slice(1);
ok(sheets.length >= 4, 'נמצאו מסכי הביניים בקוד');
for (const [i, sheet] of sheets.entries()) {
  const body = sheet.slice(0, sheet.indexOf('`);') + 1);
  ok(/data-do="[a-z]+"/.test(body), `למסך ${i + 1} יש כפתור יציאה`);
}

// ── 8 · "continue game" must never open a game that falls over ──────────────
const gameSrc = readFileSync('src/game/game.ts', 'utf8');
ok(gameSrc.includes('SAVE_VERSION'), 'לשמירה יש מספר גרסה');
ok(/s\.v !== SAVE_VERSION/.test(gameSrc), 'שמירה מגרסה ישנה נזרקת במקום להיטען');
for (const field of ['traces', 'marks', 'log', 'taught', 'steps']) {
  ok(gameSrc.includes(`s.${field} ??=`), `שדה חסר בשמירה מקבל ברירת מחדל: ${field}`);
}

console.log(bad ? `\n✗ ${bad} כפתורים לא בסדר.` : '\n✓ כל כפתור במשחק פעיל, מוסבר, ומוביל למשהו.');
process.exit(bad ? 1 : 0);
